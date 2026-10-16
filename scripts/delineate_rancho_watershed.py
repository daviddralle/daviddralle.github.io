#!/usr/bin/env python3
"""Snap the user-marked valley exit and delineate the study watershed.

Requires pysheds 0.5, numpy <2.4, rasterio, shapely and pyproj.
The default seed is an approximate map interpretation of the user's red X,
not a GPS observation. Raw/working rasters stay outside the public repository.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.features import shapes
from pysheds.grid import Grid
from shapely.affinity import translate
from shapely.geometry import shape, mapping, Point
from shapely.ops import transform, unary_union

from build_rancho_atlas import TO_LL, TO_UTM, save, collection, feature


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--dem', type=Path, required=True)
    ap.add_argument('--work', type=Path, required=True)
    ap.add_argument('--seed', type=float, nargs=2, default=[556644, 4332848], metavar=('EASTING', 'NORTHING'))
    ap.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'field-sites/rancho/atlas/data')
    args = ap.parse_args()
    if args.work.resolve().is_relative_to(Path(__file__).resolve().parents[1]):
        raise ValueError('Working rasters must stay outside the public repository')
    args.work.mkdir(parents=True, exist_ok=True)
    with rasterio.open(args.dem) as ds:
        assert ds.crs.to_epsg() == 26910 and ds.res == (1, 1)
        original, affine, profile = ds.read(1), ds.transform, ds.profile.copy()
    valid = np.isfinite(original) & (original > 0) & (original < 10000)
    profile.update(dtype='float64', nodata=-9999)
    routing_path = args.work / 'routing-dem.tif'
    with rasterio.open(routing_path, 'w', **profile) as ds:
        ds.write(np.where(valid, original, -9999).astype('float64'), 1)
    grid = Grid.from_raster(str(routing_path))
    dem = grid.read_raster(str(routing_path))
    filled = grid.fill_depressions(grid.fill_pits(dem))
    fdir = grid.flowdir(grid.resolve_flats(filled))
    acc = grid.accumulation(fdir)
    # A >=100 ha contributing-area threshold isolates the main valley channel
    # from neighboring side gullies. Never snap farther than 30 m from the X.
    x, y = grid.snap_to_mask(acc >= 1000000, tuple(args.seed))
    col, row = grid.nearest_cell(x, y)
    x, y = rasterio.transform.xy(affine, row, col)
    snap_distance = Point(x, y).distance(Point(*args.seed))
    assert snap_distance <= 30
    catch = np.asarray(grid.catchment(x=col, y=row, fdir=fdir, xytype='index'))
    assert valid[catch].all() and catch.sum() == acc[row, col]
    assert not (catch[0].any() or catch[-1].any() or catch[:, 0].any() or catch[:, -1].any())
    raw = unary_union([shape(g) for g, v in shapes(catch.astype('uint8'), mask=catch, transform=affine) if v])
    assert raw.is_valid and raw.geom_type == 'Polygon'
    polygon = raw.simplify(1, preserve_topology=True)
    assert polygon.is_valid and polygon.boundary.distance(Point(x, y)) < 1.5
    existing = json.loads((args.output / 'catchments.geojson').read_text())
    archive_path = args.output / 'archived-watershed.geojson'
    if not archive_path.exists():
        save(archive_path, collection([f for f in existing['features'] if f['properties']['kind'] == 'watershed']))
    subcatchments = [f for f in existing['features'] if f['properties']['kind'] == 'catchment']
    inclusion = {}
    for f in subcatchments:
        g = transform(TO_UTM.transform, shape(f['geometry']))
        inclusion[f['properties']['id']] = raw.intersection(g).area / g.area
        assert raw.covers(g.representative_point())
    assert min(inclusion.values()) > .99
    area = int(catch.sum()) / 10000
    outlet_ll = TO_LL.transform(x, y)
    provenance = dict(method='D8 routing after pit/depression filling and flat resolution; approximate user-marked valley exit snapped to the nearest main-channel cell',
                      resolution_m=1, seed_utm=args.seed, seed_basis='Approximate interpretation of user screenshot red X, 2026-10-16',
                      snap_min_area_ha=100, snap_distance_m=snap_distance, outlet_utm=[x, y], outlet_position=outlet_ll,
                      dem_sha256=hashlib.sha256(args.dem.read_bytes()).hexdigest(), pysheds_version='0.5',
                      qa=dict(upstream_cells=int(catch.sum()), area_ha=area, nodata_cells=0, touches_dem_edge=False,
                              subcatchment_inclusion_fraction=inclusion,
                              max_depression_fill_m=float(np.max(np.asarray(filled)[catch] - original[catch]))))
    label = polygon.representative_point()
    watershed = feature(mapping(transform(TO_LL.transform, polygon)), id='Mountain House', kind='watershed',
                        area_ha=area, label_position=TO_LL.transform(label.x, label.y),
                        source='NCALM 2019 LiDAR DEM with 2017 northwestern gap fill; 1 m D8 delineation',
                        note='Study watershed upstream of the user-marked main valley exit, snapped to the DEM-derived main channel. Replaces the archived outer boundary. MH1–MH9 archived divides and provisional MH10 remain unchanged; small edge differences reflect independent delineations.',
                        delineation=provenance)
    outlet = feature({'type': 'Point', 'coordinates': outlet_ll}, id='Mountain House outlet', kind='outlet',
                     ground_m=float(original[row, col]), source=watershed['properties']['source'],
                     position_note=f'Main valley exit near the user-marked red X, snapped {snap_distance:.1f} m to the DEM-derived main channel. The {area:.1f} ha study watershed is delineated upstream from this cell. Map-derived location, not a surveyed gauge.',
                     delineation=provenance)
    save(args.output / 'study-watershed.geojson', collection([watershed, outlet]))
    save(args.output / 'catchments.geojson', collection([watershed] + subcatchments))
    instruments = json.loads((args.output / 'instruments.geojson').read_text())['features']
    save(args.output / 'instruments.geojson', collection([f for f in instruments if f['properties']['kind'] != 'outlet'] + [outlet]))
    # Regenerate streams rather than retaining the old crop-edge drainage
    # artifacts. 2 ha matches 5,000 contributing cells in the archived 2 m DEM.
    network = grid.extract_river_network(fdir, acc >= 20000)
    region = polygon.buffer(60)
    lines = []
    for f in network['features']:
        # pysheds emits cell corners; shift to the same cell centers as outlet.
        g = translate(shape(f['geometry']), xoff=.5, yoff=-.5).intersection(region)
        if g.is_empty or g.geom_type not in ('LineString', 'MultiLineString'):
            continue
        lines.append(feature(mapping(transform(TO_LL.transform, g.simplify(.5))), id=f'channel-{len(lines)}',
                             kind='channel', source='1 m LiDAR DEM D8 flow accumulation', threshold_area_ha=2))
    assert min(transform(TO_UTM.transform, shape(f['geometry'])).distance(Point(x, y)) for f in lines) < 1
    save(args.output / 'channels.geojson', collection(lines))
    save(args.output / 'derived-channels.geojson', collection(lines))
    canopy_path = args.output / 'canopy.json'
    canopy = json.loads(canopy_path.read_text())
    coverage = json.loads((args.output / 'canopy-coverage.geojson').read_text())
    covered = unary_union([transform(TO_UTM.transform, shape(f['geometry'])) for f in coverage['features']])
    canopy['coverage']['catchment_fraction'] = min(1, covered.intersection(raw).area / raw.area)
    canopy['coverage']['evaluation_boundary'] = '2026-10-16 DEM-delineated study watershed at the snapped main valley exit'
    canopy['qa']['watershed_dem_valid_fraction'] = float(valid[catch].mean())
    old_key = 'supplement_observed_fraction_in_watershed'
    if old_key in canopy['qa']:
        canopy['qa']['supplement_observed_fraction_in_archived_watershed'] = canopy['qa'].pop(old_key)
    canopy['notes'] = [n.replace('97.4% of the study watershed', '97.4% of the archived watershed') for n in canopy['notes']]
    save(canopy_path, canopy)
    np.savez_compressed(args.work / 'study-routing.npz', fdir=fdir, accumulation=acc, catchment=catch)
    print(json.dumps(dict(area_ha=area, outlet=outlet_ll, snap_distance_m=snap_distance,
                          channels=len(lines), inclusion=inclusion, coverage=canopy['coverage']), indent=2))


if __name__ == '__main__':
    main()
