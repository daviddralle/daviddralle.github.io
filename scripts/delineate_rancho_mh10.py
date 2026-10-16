#!/usr/bin/env python3
"""Delineate provisional MH10 from the external 1 m LiDAR DEM.

Requires pysheds 0.5, numpy <2.4, rasterio, shapely and pyproj.
Raw DEMs and flow rasters remain in --work, outside the public repository.
"""
import argparse
import hashlib
import json
from importlib.metadata import version
from pathlib import Path

import numpy as np
import rasterio
from rasterio.features import shapes
from pysheds.grid import Grid
from shapely.geometry import shape, mapping, Point
from shapely.ops import transform, unary_union

from build_rancho_atlas import TO_LL, TO_UTM, save, collection, feature

OFFSETS = {64: (-1, 0), 128: (-1, 1), 1: (0, 1), 2: (1, 1),
           4: (1, 0), 8: (1, -1), 16: (0, -1), 32: (-1, -1)}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--dem', type=Path, required=True)
    ap.add_argument('--streams', type=Path, required=True)
    ap.add_argument('--work', type=Path, required=True)
    ap.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'field-sites/rancho/atlas/data')
    args = ap.parse_args()
    repo = Path(__file__).resolve().parents[1]
    if args.work.resolve().is_relative_to(repo):
        raise ValueError('Keep working rasters outside the public repository')
    args.work.mkdir(parents=True, exist_ok=True)
    with rasterio.open(args.dem) as ds:
        assert ds.crs.to_epsg() == 26910 and ds.res == (1, 1)
        original = ds.read(1)
        profile = ds.profile.copy()
        affine = ds.transform
    finite = np.isfinite(original) & (original > 0) & (original < 10000)
    profile.update(dtype='float64', nodata=-9999)
    routing_dem = args.work / 'routing-dem.tif'
    with rasterio.open(routing_dem, 'w', **profile) as ds:
        ds.write(np.where(finite, original, -9999).astype('float64'), 1)
    grid = Grid.from_raster(str(routing_dem))
    dem = grid.read_raster(str(routing_dem))
    filled = grid.fill_depressions(grid.fill_pits(dem))
    fdir = grid.flowdir(grid.resolve_flats(filled))
    acc = grid.accumulation(fdir)
    streams = {f['properties']['FID']: shape(f['geometry'])
               for f in json.loads(args.streams.read_text())['features']}

    def downstream(fid):
        reach = streams[fid]
        seed = reach.interpolate(reach.length - 12)
        x, y = grid.snap_to_mask(acc > 20000, (seed.x, seed.y))
        assert Point(x, y).distance(seed) < 10, 'Unexpected channel snap'
        c, r = grid.nearest_cell(x, y)
        path, seen = [], set()
        while (r, c) not in seen and 0 <= r < fdir.shape[0] and 0 <= c < fdir.shape[1]:
            seen.add((r, c)); path.append((r, c))
            if fdir[r, c] not in OFFSETS:
                break
            dr, dc = OFFSETS[fdir[r, c]]
            r, c = r + dr, c + dc
        return path

    # FID 164 is the first east-bank tributary above MH9; 169 is the
    # mainstem reach entering the same archived junction from the north.
    tributary, mainstem = downstream(164), set(downstream(169))
    join = next(i for i, cell in enumerate(tributary) if cell in mainstem)
    assert join > 0
    row, col = tributary[join - 1]  # Last tributary cell, before mainstem area joins.
    catch = np.asarray(grid.catchment(x=col, y=row, fdir=fdir, xytype='index'))
    assert finite[catch].all() and catch.sum() == acc[row, col]
    assert not (catch[0].any() or catch[-1].any() or catch[:, 0].any() or catch[:, -1].any())
    raw = unary_union([shape(g) for g, v in shapes(catch.astype('uint8'), mask=catch, transform=affine) if v])
    parts = list(raw.geoms) if raw.geom_type == 'MultiPolygon' else [raw]
    largest = max(parts, key=lambda p: p.area)
    omitted = raw.area - largest.area
    assert omitted / raw.area < .0001  # Three diagonal-only 1 m cells in this DEM.
    polygon = largest.simplify(1, preserve_topology=True)
    assert polygon.is_valid and polygon.geom_type == 'Polygon'
    outlet = rasterio.transform.xy(affine, row, col)
    label = polygon.representative_point()
    existing = json.loads((args.output / 'catchments.geojson').read_text())
    archives = {f['properties']['id']: transform(TO_UTM.transform, shape(f['geometry']))
                for f in existing['features'] if f['properties']['id'] != 'MH10'}
    qa = dict(upstream_cells=int(catch.sum()), raster_area_ha=float(raw.area / 10000),
              omitted_diagonal_cells_m2=omitted, polygon_area_ha=polygon.area / 10000,
              within_archived_watershed_fraction=raw.intersection(archives['Mountain House']).area / raw.area,
              overlap_archived_mh9_m2=raw.intersection(archives['MH9']).area,
              max_depression_fill_m=float(np.max(np.asarray(filled)[catch] - original[catch])),
              nodata_cells=0, touches_dem_edge=False)
    props = dict(id='MH10', kind='catchment', provisional=True, area_ha=round(raw.area / 10000, 4),
                 label_position=TO_LL.transform(label.x, label.y),
                 outlet_position=TO_LL.transform(*outlet), outlet_ground_m=float(original[row, col]),
                 source='2019 NCALM CA19_Dietrich bare-earth LiDAR, 1 m DEM; pysheds D8 delineation',
                 note='Provisional MH10: the next east-bank tributary north of MH9. DEM-derived boundary and working name, not an archived or field-verified catchment. Small differences from archived MH9 and Mountain House divides are retained.',
                 delineation=dict(method='D8 flow routing after pit/depression filling and flat resolution; last tributary cell before its DEM-derived mainstem confluence',
                                  resolution_m=1, tributary_source_fid=164, mainstem_source_fid=169,
                                  source_doi='https://doi.org/10.5069/G9FX77MW',
                                  dem_sha256=hashlib.sha256(args.dem.read_bytes()).hexdigest(),
                                  pysheds_version=version('pysheds'), simplification_m=1, qa=qa))
    derived = feature(mapping(transform(TO_LL.transform, polygon)), **props)
    derived_path = args.output / 'derived-catchments.geojson'
    others = json.loads(derived_path.read_text())['features'] if derived_path.exists() else []
    save(derived_path, collection([f for f in others if f['properties']['id'] != 'MH10'] + [derived]))
    save(args.output / 'catchments.geojson', collection([f for f in existing['features'] if f['properties']['id'] != 'MH10'] + [derived]))
    np.savez_compressed(args.work / 'mh10-routing.npz', fdir=fdir, accumulation=acc, catchment=catch)
    print(json.dumps(props, indent=2))


if __name__ == '__main__':
    main()
