#!/usr/bin/env python3
"""Retain Soap GPS and add an explicitly approximate Newt outlet gage waypoint.

Newt's position is the unique intersection of the published watershed boundary
and DEM-derived drainage. It is not a surveyed gage coordinate. User confirmed
gages at the watershed outlets on 2026-11-03.
"""
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET
from shapely.geometry import shape, mapping
from shapely.ops import transform, unary_union
from pyproj import Transformer


def update_gages(out):
    out = Path(out)
    read = lambda name: json.loads((out/name).read_text())
    save = lambda name, data: (out/name).write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False)+'\n')
    infrastructure = read('infrastructure.geojson')
    features = [f for f in infrastructure['features'] if f['properties'].get('name') != 'Newt Creek stream gage']
    soap = [f for f in features if f['properties'].get('name') in ('Soap Creek stream gage', 'Soaproot Creek stream gage')]
    assert len(soap) == 1
    soap[0]['properties'].update(location_method='Archived GPS coordinate', position_status='GPS archive; accuracy not documented')
    fwd = Transformer.from_crs(4326, 32611, always_xy=True).transform
    rev = Transformer.from_crs(32611, 4326, always_xy=True).transform
    watershed = next(f for f in read('watersheds.geojson')['features'] if f['properties']['site'] == 'Newt')
    boundary = transform(fwd, shape(watershed['geometry'])).boundary
    channels = unary_union([transform(fwd, shape(f['geometry'])) for f in read('channels.geojson')['features']])
    outlet = boundary.intersection(channels)
    assert outlet.geom_type == 'Point', 'Outlet is ambiguous; inspect candidate intersections before publishing.'
    terrain = read('terrain.json')
    gx, gy = (outlet.x-terrain['xmin'])/terrain['cell_size'], (terrain['ymax']-outlet.y)/terrain['cell_size']
    c, r = math.floor(gx), math.floor(gy)
    u, v = gx-c, gy-r
    w = terrain['width']
    assert 0 <= c < w-1 and 0 <= r < terrain['height']-1
    a,b,d,e = [terrain['elevations'][i] for i in [r*w+c,r*w+c+1,(r+1)*w+c,(r+1)*w+c+1]]
    assert all(x is not None and math.isfinite(x) for x in [a,b,d,e])
    elevation = a+(b-a)*u+(d-a)*v if u+v<=1 else e+(d-e)*(1-u)+(b-e)*(1-v)
    newt = dict(type='Feature', geometry=mapping(transform(rev,outlet)), properties=dict(
        name='Newt Creek stream gage', type='stream gage', site='Newt', depth_m=None,
        elevation_m=round(elevation,2), approximate=True,
        position_status='Approximate outlet; not GPS-surveyed',
        location_method='Unique intersection of archived watershed boundary and DEM-derived drainage',
        source='watersheds.geojson + channels.geojson; outlet gage presence supplied by user',
        note='Approximate position for the outlet gage reported by the user. Derived from archived boundary and 5 m DEM drainage; no surveyed coordinate or positional accuracy is available.'))
    features.append(newt)
    assert len({f['properties']['name'] for f in features}) == len(features)
    infrastructure['features'] = features
    save('infrastructure.geojson',infrastructure)
    gages=[soap[0],newt]
    save('stream-gages.geojson',dict(type='FeatureCollection',features=gages))
    namespace='http://www.topografix.com/GPX/1/1'
    ET.register_namespace('',namespace)
    root=ET.Element(f'{{{namespace}}}gpx',version='1.1',creator='Soaproot & Newt Creek field atlas')
    for feature in gages:
        lon,lat=feature['geometry']['coordinates'];p=feature['properties']
        waypoint=ET.SubElement(root,f'{{{namespace}}}wpt',lat=f'{lat:.7f}',lon=f'{lon:.7f}')
        for tag,value in [('name',p['name']+(' (approximate)' if p.get('approximate') else '')),
                          ('desc',p['position_status']+'. '+p['note']),('sym','Water Source'),('type','Stream gage')]:
            ET.SubElement(waypoint,f'{{{namespace}}}{tag}').text=value
    ET.indent(root)
    ET.ElementTree(root).write(out/'stream-gages.gpx',encoding='utf-8',xml_declaration=True)
    manifest=read('manifest.json')
    manifest['mapped_infrastructure']=len(features)
    manifest['stream_gages']={'count':2,'gps_waypoints':'stream-gages.gpx','geojson':'stream-gages.geojson',
        'Soap':'Archived GPS coordinate retained unchanged.',
        'Newt':'Approximate mapped outlet. User reports a gage; its GPS coordinate is not available.'}
    save('manifest.json',manifest)
    if (out/'qa.json').exists():
        qa=read('qa.json');qa['mapped_points']=len(features)
        qa['gage_positions']={'Soap':'Archived GPS; retained unchanged.','Newt':'Unique channel/boundary intersection, valid terrain elevation; approximate, not surveyed.'}
        save('qa.json',qa)
    print(json.dumps({'mapped_points':len(features),'gages':[(f['properties']['name'],f['geometry']['coordinates']) for f in gages]}))
    return features


if __name__=='__main__':
    update_gages(Path(__file__).resolve().parents[1]/'field-sites/soap-newt/atlas/data')
