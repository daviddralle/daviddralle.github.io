"""Fit VMS sleeves in the archived survey/platform alignment; requires pyproj.

The VSP/FS surface marks are interpreted as plan projections of port midpoints.
This reconstructs collars, not a downhole deviation survey. Use the original
survey here: the well-registered survey and unmodified VMS platform do not share
the same local alignment.
"""
from pathlib import Path
import json
import math
import re
import struct
from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'field-sites/rivendell/atlas/data'
read = lambda name: json.loads((DATA / name).read_text())
tx = Transformer.from_crs(4326, 26910, always_xy=True)
ll = Transformer.from_crs(26910, 4326, always_xy=True)
bores = read('vms_bores.geojson')
meta = read('3d/scene.json')
tm = meta['terrain']
origin = meta['origin_utm_e_n_z']
heights = struct.unpack('<' + 'f' * (tm['width'] * tm['height']), (DATA / '3d/terrain.f32').read_bytes())


def ground(east, north):
    c, r = (east - tm['x0']) / tm['step'], (tm['y0'] - north) / tm['step']
    assert 0 <= c <= tm['width'] - 1 and 0 <= r <= tm['height'] - 1
    i, j = min(math.floor(c), tm['width'] - 2), min(math.floor(r), tm['height'] - 2)
    x, y, k = c - i, r - j, j * tm['width'] + i
    a, b, e, d = [heights[v] for v in [k, k + 1, k + tm['width'], k + tm['width'] + 1]]
    return a + x * (b - a) + y * (e - a) if x + y <= 1 else d + (1 - x) * (e - d) + (1 - y) * (b - d)


def fit(source):
    lookup = {f['properties']['id']: f for f in read(source)['features']
              if f['properties']['survey_group'] == 'well15_northside'}
    groups, vector = {}, [0., 0.]
    for bore in bores['features']:
        p = bore['properties']
        ports = {port['label']: port for port in p['ports']}
        rows = []
        for sid in p['survey_control_ids']:
            feature = lookup[sid]
            match = re.search(r'(?:VSP|FS)\s*(\d+)\s+Sleeve\s+([AB])', feature['properties']['description'])
            assert match and match[2] == p['sleeve'], (sid, match)
            port = ports[match[2] + match[1]]
            rows.append(((port['top_depth_m'] + port['bottom_depth_m']) / 2,
                         tx.transform(*feature['geometry']['coordinates'])))
        md = sum(d for d, xy in rows) / len(rows)
        for j in range(2):
            mp = sum(xy[j] for d, xy in rows) / len(rows)
            vector[j] += sum((d - md) * (xy[j] - mp) for d, xy in rows)
        groups[p['sleeve']] = rows
    norm = math.hypot(*vector)
    direction = [v / norm for v in vector]
    output = {}
    for bore in bores['features']:
        p = bore['properties']
        rows = groups[p['sleeve']]
        cot = 1 / math.tan(math.radians(p['inclination_deg']))
        collar = [sum(xy[j] - d * cot * direction[j] for d, xy in rows) / len(rows) for j in range(2)]
        residuals = [math.dist(xy, [collar[j] + d * cot * direction[j] for j in range(2)]) for d, xy in rows]
        output[p['sleeve']] = {'collar': collar, 'direction': direction,
                              'azimuth_grid_deg': math.degrees(math.atan2(direction[0], direction[1])) % 360,
                              'rmse_m': math.sqrt(sum(r * r for r in residuals) / len(residuals))}
    return output


platform = [tx.transform(*c) for c in read('vms_platform.geojson')['features'][0]['geometry']['coordinates'][0]]
rendered = [(v[0] + origin[0], origin[1] - v[2]) for v in read('3d/features.json')['vms_platform'][0]['geometry']['coordinates'][0]]
assert max(min(math.dist(a, b) for b in rendered) for a in platform) < .002, 'Projection must match the rendered platform'
west = min(zip(platform, platform[1:]), key=lambda edge: (edge[0][0] + edge[1][0]) / 2)


def edge_distance(p):
    a, b = west
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
    return math.dist(p, (a[0] + t * dx, a[1] + t * dy))


original, registered = fit('survey_original.geojson'), fit('survey.geojson')
report = {'alignment': 'Original archived total-station geometry, consistent with VMS platform', 'sleeves': []}
for feature in bores['features']:
    p = feature['properties']
    result = original[p['sleeve']]
    collar, direction = result['collar'], result['direction']
    elevation = ground(*collar)
    cot = 1 / math.tan(math.radians(p['inclination_deg']))
    drop = p['display_downhole_length_m'] * math.sin(math.radians(p['inclination_deg']))

    def position(depth):
        return [round(collar[j] + depth * cot * direction[j], 4) for j in range(2)] + [round(elevation - depth, 4)]

    p.update(collar_utm_e_n=collar, collar_lidar_elevation_m=elevation,
             azimuth_grid_deg=round(result['azimuth_grid_deg'], 2),
             trajectory_utm_e_n_z=[position(0), position(drop)],
             vertical_drop_m=round(drop, 4), plan_fit_rmse_m=result['rmse_m'],
             horizontal_alignment='Original archived survey; same local alignment as VMS platform',
             placement='Reconstructed from original survey port marks near the western platform edge',
             location_note='Parallel sleeves fitted to original archived VSP/FS survey marks, interpreted as plan projections of port interval midpoints. Uses the original survey alignment shared by the VMS platform, rather than the separately well-registered survey. Collar elevations use the rendered LiDAR ground. Inclination and port depths retained; exact collars and downhole deviation remain unmeasured.')
    for port in p['ports']:
        port['start_utm_e_n_z'] = position(port['top_depth_m'])
        port['end_utm_e_n_z'] = position(port['bottom_depth_m'])
    feature['geometry']['coordinates'] = [list(ll.transform(*pos[:2])) for pos in p['trajectory_utm_e_n_z']]
    distance = edge_distance(collar)
    assert distance < .7, 'Reconstructed collar must remain near the western platform edge'
    report['sleeves'].append({'sleeve': p['sleeve'], 'collar_utm_e_n': collar,
                              'distance_to_western_platform_edge_m': distance,
                              'well_registered_fit_distance_m': edge_distance(registered[p['sleeve']]['collar']),
                              'horizontal_shift_from_well_registered_fit_m': math.dist(collar, registered[p['sleeve']]['collar']),
                              'azimuth_grid_deg': result['azimuth_grid_deg'], 'collar_lidar_elevation_m': elevation})

(DATA / 'vms_bores.geojson').write_text(json.dumps(bores, separators=(',', ':')))
(DATA / 'vms-alignment.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
