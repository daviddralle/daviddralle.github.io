#!/usr/bin/env python3
"""Build compact public map products from external Rancho research sources.

Usage: python scripts/build_rancho_atlas.py --source-root /path/to/AVR-and-Rancho \
    --metadata /private/path/to/summary-meta-rows.json
Raw inputs stay outside this repository. Metadata is an array of Sheet row arrays.
Requires numpy, rasterio, pyproj, shapely, scipy and Pillow.
"""
import argparse
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
import contourpy
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import reproject, transform_bounds
from rasterio.transform import from_bounds
from pyproj import Transformer
from shapely.geometry import Polygon, shape, mapping, Point, LineString, box
from shapely.ops import transform
from PIL import Image
from scipy.ndimage import distance_transform_edt

NS = {'k': 'http://www.opengis.net/kml/2.2'}
TO_LL = Transformer.from_crs(26910, 4326, always_xy=True)
TO_UTM = Transformer.from_crs(4326, 26910, always_xy=True)

def read_points(path):
    points = {}
    for p in ET.parse(path).findall('.//k:Placemark', NS):
        c = p.findtext('.//k:Point/k:coordinates', namespaces=NS)
        if c:
            points[p.findtext('k:name', namespaces=NS)] = list(map(float, c.split(',')[:2]))
    return points

def rounded(obj):
    if isinstance(obj, float): return round(obj, 6)
    if isinstance(obj, (list, tuple)): return [rounded(v) for v in obj]
    if isinstance(obj, dict): return {k: rounded(v) for k, v in obj.items()}
    return obj

def save(path, obj):
    path.write_text(json.dumps(rounded(obj), separators=(',', ':'), allow_nan=False) + '\n')

def feature(geometry, **props):
    return {'type': 'Feature', 'geometry': geometry, 'properties': props}

def collection(features): return {'type': 'FeatureCollection', 'features': features}

def number(value):
    if value is None or value == '': return None
    try: return float(value)
    except (ValueError, TypeError): return None

def depth(value):
    if isinstance(value, str) and "'" in value:
        return round(float(value.replace("'", '')) * .3048, 3)
    return number(value)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--source-root', type=Path, required=True)
    ap.add_argument('--metadata', type=Path, required=True)
    ap.add_argument('--dem', type=Path, help='Optional matching survey DEM; elevations remain unshifted DEM values')
    ap.add_argument('--dem-source', default='MountainHouseClip.tif')
    ap.add_argument('--vertical-datum', default='Not specified in source metadata')
    ap.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'field-sites/rancho/atlas/data')
    args = ap.parse_args()
    out = args.output
    out.mkdir(parents=True, exist_ok=True)
    gis = args.source_root / 'Data/GIS'
    retired = read_points(gis / 'Retired Well Piezo KMLs/RanchoVenadaFeb2019 (Retired Nov.21 2019).kml')
    watershed = []
    for filename in ['Mountain_House_Watershed.kml', 'MH1-9_catchments.kml']:
        for p in ET.parse(gis / 'Watershed Boundaries' / filename).findall('.//k:Placemark', NS):
            text = p.findtext('.//k:outerBoundaryIs/k:LinearRing/k:coordinates', namespaces=NS)
            if not text: continue
            coords = [list(map(float, pair.split(',')[:2])) for pair in text.split()]
            polygon = Polygon(coords)
            metric = transform(TO_UTM.transform, polygon)
            label = p.findtext('k:name', namespaces=NS) or 'Mountain House'
            watershed.append(feature(mapping(transform(TO_LL.transform, metric.simplify(1, preserve_topology=True))),
                id=label, kind='watershed' if label == 'Mountain House' else 'catchment',
                area_ha=round(metric.area / 10000, 2), label_position=list(polygon.representative_point().coords)[0],
                source='Data/GIS/Watershed Boundaries/' + filename,
                note='Archived watershed boundary; retained separately for reference.' if label == 'Mountain House' else ('Additional MH9 polygon in source archive.' if label == 'MH9' else 'Archived catchment delineation.')))
    derived_path = out / 'derived-catchments.geojson'
    derived = json.loads(derived_path.read_text())['features'] if derived_path.exists() else []
    watershed.extend(derived)
    study = json.loads((out / 'study-watershed.geojson').read_text())['features']
    study_boundary = next(f for f in study if f['properties']['kind'] == 'watershed')
    study_outlet = next(f for f in study if f['properties']['kind'] == 'outlet')
    watershed = [study_boundary] + [f for f in watershed if f['properties']['kind'] != 'watershed']
    save(out / 'catchments.geojson', collection(watershed))
    domain = shape(watershed[0]['geometry'])
    metric_bounds = transform(TO_UTM.transform, domain).buffer(160).bounds
    x0, y0, x1, y1 = [round(v / 10) * 10 for v in metric_bounds]
    with rasterio.open(args.dem or gis / 'elevation dem/MountainHouseClip.tif') as dem:
        # Contour the native DEM, not the coarser browser mesh. Mask nodata edges.
        native = dem.read(1, masked=True)
        xx = dem.transform.c + (np.arange(dem.width) + .5) * dem.transform.a
        yy = dem.transform.f + (np.arange(dem.height) + .5) * dem.transform.e
        generator = contourpy.contour_generator(x=xx, y=yy, z=native)
        contours, contours3d = [], []
        mesh_extent = box(x0, y0, x1, y1)
        for elevation in range(int(np.ceil(native.min()/2))*2, int(native.max())+1, 2):
            major = elevation % 10 == 0
            for coords in generator.lines(elevation):
                line = LineString(coords)
                if line.length < 8: continue
                line = line.simplify(.6, preserve_topology=True)
                props = dict(kind='contour', elevation_m=elevation, major=major)
                contours.append(feature(mapping(transform(TO_LL.transform, line)), **props))
                if major:
                    clipped = line.intersection(mesh_extent)
                    if not clipped.is_empty and clipped.geom_type in ('LineString', 'MultiLineString'):
                        contours3d.append(feature(mapping(transform(TO_LL.transform, clipped)), **props))
        save(out/'contours.geojson', collection(contours))
        save(out/'contours-3d.geojson', collection(contours3d))
        def ground(lon, lat):
            x, y = TO_UTM.transform(lon, lat)
            val = float(next(dem.sample([(x, y)]))[0])
            return round(val, 2) if np.isfinite(val) and val < 10000 else None

        holes = []
        for index, raw in enumerate(json.loads(args.metadata.read_text())[1:], 2):
            if not raw or not re.fullmatch(r'MH\d+[WP]\d+', raw[0]): continue
            r = raw + [None] * (37 - len(raw))
            ident = r[0]
            xy = [number(r[12]), number(r[13])]
            ll = list(TO_LL.transform(*xy)) if all(v is not None for v in xy) else None
            position_source = 'Summary meta: NAD83 / UTM zone 10N (EPSG:26910)'
            position_note = 'Source coordinate precision is not a survey accuracy estimate.'
            if ident in ['MH7W4', 'MH8W1']:
                ll = retired[ident]
                position_source = 'RanchoVenadaFeb2019 KML (retired November 2019)'
                position_note = ('Provisional correction: metadata coordinate falls near MH8W1 on the north slope. Archived KML places MH7W4 on the south slope, consistent with Hahm (2022) and Whiting manuscript figures. Field confirmation needed.' if ident == 'MH7W4' else 'Metadata coordinates missing; archived KML position used provisionally. Field confirmation needed.')
            completed = depth(r[18])
            drilled = depth(r[17]) or (number(r[16]) * .3048 if number(r[16]) else None)
            display_depth = completed if completed is not None else drilled
            screen_length = number(r[19])
            screen = [round(completed - screen_length, 3), completed] if completed is not None and screen_length else None
            screen_source = 'Summary meta: completed depth minus screened interval length' if screen else None
            if ident in ['MH7W1', 'MH3W1', 'MH3W5']:
                screen = [9.1 if ident == 'MH7W1' else 6.1, completed]
                screen_source = 'Hahm et al. (2022), section 2.6: continuously slotted casing below 9.1 / 6.1 m; base from completion metadata'
            note = ''
            if ident == 'MH3P6': note = 'Abandoned after caving before completion. No coordinate or final depth in metadata.'
            if ident == 'MH7W5': note = 'Cave-in documented; MH7W6 described as its replacement. Depth shown is original drilled depth, not verified completion.'
            holes.append(feature({'type':'Point','coordinates':ll} if ll else None,
                id=ident, kind='well' if 'W' in ident else 'piezometer', group=ident.split('W')[0].split('P')[0],
                completion=r[5], installed=r[11], location=r[10], original_id=r[1],
                depth_m=display_depth, depth_basis='completed' if completed is not None else ('drilled' if drilled is not None else 'unknown'),
                completed_depth_m=completed, drilled_depth_m=drilled, screen_m=screen, screen_source=screen_source,
                ground_m=ground(*ll) if ll else None,
                easting_m=round(TO_UTM.transform(*ll)[0], 2) if ll else None,
                northing_m=round(TO_UTM.transform(*ll)[1], 2) if ll else None,
                position_source=position_source if ll else None, position_note=position_note if ll else 'Unlocated: no coordinate recorded.',
                note=note, source='Borehole and well and piezometer metadata / Summary meta', source_row=index))
        save(out / 'boreholes.geojson', collection(holes))

        instruments = []
        for name, ll in read_points(gis / 'feb-2024-rancho-gps-waypoints.kml').items():
            kind = 'weather' if name.startswith('RVWS') else ('sapflow' if name.startswith('sapflow') else 'soil')
            instruments.append(feature({'type':'Point','coordinates':ll}, id='RVWS' if kind == 'weather' else name,
                kind=kind, description=name, source='February 2024 GPS waypoints', position_note='Field GPS waypoint; positional accuracy unspecified. Current operation not verified.'))
        instruments.append(study_outlet)
        save(out / 'instruments.geojson', collection(instruments))

        lines = json.loads((out / 'derived-channels.geojson').read_text())['features']
        save(out / 'channels.geojson', collection(lines))

        # A 10 m display mesh, retaining metric UTM axes. Full-resolution DEM remains external.
        nx, ny = int((x1-x0)/10)+1, int((y1-y0)/10)+1
        grid = np.full((ny,nx), np.nan, dtype=np.float32)
        mesh_transform = from_bounds(x0-5,y0-5,x1+5,y1+5,nx,ny)
        reproject(rasterio.band(dem,1),grid,src_transform=dem.transform,src_crs=dem.crs,dst_transform=mesh_transform,dst_crs=dem.crs,dst_nodata=np.nan,resampling=Resampling.bilinear)
        missing = ~np.isfinite(grid)
        if missing.any():
            indices = distance_transform_edt(missing,return_distances=False,return_indices=True)
            grid[missing] = grid[tuple(indices[:,missing])]
        save(out/'terrain.json', dict(crs='EPSG:26910',bounds=[x0,y0,x1,y1],nx=nx,ny=ny,spacing_m=10,rows='north to south',elevation_m=np.round(grid,1).tolist(),valid=(~missing).astype('uint8').tolist(),source=args.dem_source,vertical_datum=args.vertical_datum))
        from build_rancho_terrain_texture import build_texture
        build_texture(args.dem, out)

        # Geographic hillshade for Leaflet, derived from the same DEM.
        west,south,east,north=transform_bounds(dem.crs,4326,*dem.bounds)
        width,height=dem.width,dem.height
        shade_grid=np.full((height,width),np.nan,dtype=np.float32)
        reproject(rasterio.band(dem,1),shade_grid,src_transform=dem.transform,src_crs=dem.crs,dst_transform=from_bounds(west,south,east,north,width,height),dst_crs='EPSG:4326',dst_nodata=np.nan,resampling=Resampling.bilinear)
        mask=~np.isfinite(shade_grid)
        if mask.any():
            idx=distance_transform_edt(mask,return_distances=False,return_indices=True)
            shade_grid[mask]=shade_grid[tuple(idx[:,mask])]
        gy,gx=np.gradient(shade_grid,(dem.bounds.top-dem.bounds.bottom)/height,(dem.bounds.right-dem.bounds.left)/width)
        light=(.65-gx*.5+gy*.5)/np.sqrt(1+gx*gx+gy*gy)
        light=np.clip(light,.15,1)
        tint=np.array([180,180,180])[None,None,:]
        rgb=np.clip(tint*(.35+.75*light[:,:,None]),0,255).astype('uint8')
        rgba=np.dstack((rgb,(~mask).astype('uint8')*255))
        Image.fromarray(rgba).save(out/'hillshade.webp',quality=92)
        Image.fromarray(rgb).save(out/'hillshade.jpg',quality=88)
        mapped=sum(f['geometry'] is not None for f in holes)
        save(out/'qa.json', dict(metadata_records=len(holes),mapped_records=mapped,unlocated=[f['properties']['id'] for f in holes if f['geometry'] is None],unknown_depths=[f['properties']['id'] for f in holes if f['properties']['depth_m'] is None],provisional_positions=['MH7W4','MH8W1'],elevation_source=args.dem_source+'; DEM only, no offsets applied'))
        save(out/'manifest.json', dict(version=2,compiled='2026-10-16',source_metadata_modified='2024-04-06',borehole_records=len(holes),mapped_boreholes=mapped,known_depths=sum(f['properties']['depth_m'] is not None for f in holes),hillshade_bounds=[[south,west],[north,east]],dem_source=args.dem_source,vertical_datum=args.vertical_datum,contours=dict(source=args.dem_source,interval_m=2,index_interval_m=10,simplification_m=.6,minimum_length_m=8,nodata='Masked; no contours inferred across missing cells',count=len(contours),display_3d='10 m index contours clipped to the display mesh and draped on its surface'),sources=[
            dict(title='Borehole metadata · Summary meta',url='https://docs.google.com/spreadsheets/d/1P59EhTR2UbpZTWIMZYkxYSYm6P2P-3Obs6523HpuX1o/edit'),
            dict(title='AVR and Rancho Venada research archive',url='https://drive.google.com/drive/folders/0B1oatSIQtIaJZkc4RXBMZl8wVDQ'),
            dict(title='Hahm et al. (2022) · Bedrock vadose zone storage dynamics under extreme drought',url='https://doi.org/10.1029/2021WR031781'),
            dict(title='Whiting et al. · Emergence from drought',note='User-supplied manuscript; figure 1 used to cross-check site orientation. Manuscript not redistributed.')],notes=[
                'Map covers the DEM-delineated study watershed upstream of the snapped main valley exit, not a ranch property boundary.',
                'MH1–MH8 are the primary study sequence; the GIS archive also contains MH9.',
                *[f"{f['properties']['id']}: {f['properties']['note']}" for f in derived],
                'Metadata well names identify monitoring groups and do not always match the polygon containing a point.',
                'Two provisional positions: MH7W4 and MH8W1 use archived KML. MH3P6 is unlocated.',
                'Depth values bearing a foot mark in the nominal metre column were converted using 0.3048 m/ft.',
                'Completed depths and original drilled depths remain distinct. Unknown depths have no invented shaft.',
                'All ground elevations and the 3D surface use the source DEM directly, without elevation offsets.',
                'Channel lines are D8 drainage paths from the full 1 m LiDAR DEM at a 2 ha contributing-area threshold, not observations of current streamflow. Old clipped-DEM edge artifacts are removed.',
                'The main outlet follows the user-marked valley exit, snapped to the DEM-derived main channel; the study boundary is its upstream contributing area. Archived MH1–MH9 and provisional MH10 are unchanged.',
                'No groundwater levels, stratigraphic contacts, or tree mortality are inferred in this first atlas.'
            ]))
        print(json.dumps(dict(records=len(holes),mapped=mapped,depths=sum(f['properties']['depth_m'] is not None for f in holes),mesh=[nx,ny],channels=len(lines))))

if __name__ == '__main__': main()
