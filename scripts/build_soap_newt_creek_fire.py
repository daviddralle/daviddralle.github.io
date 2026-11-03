#!/usr/bin/env python3
"""Publish the full USFS 2020 Creek Fire perimeter and its terrain-covered outline.

Requires shapely and pyproj. The 3D outline clips only the original boundary:
no artificial fire edges are introduced along the terrain coverage limits.
"""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.parse import urlencode
from shapely.geometry import shape, mapping, box
from shapely.ops import transform
from pyproj import Transformer
from build_soap_newt_fire import get_json, utc

SERVICE = 'https://apps.fs.usda.gov/ArcX/rest/services/EDW/EDW_FireOccurrenceAndPerimeter_01/MapServer/20'
INCIDENT = '2020-CASNF-001391'
INCIDENT_URL = 'https://www.fire.ca.gov/incidents/2020/9/4/creek-fire'
OUTPUT = Path(__file__).resolve().parents[1] / 'field-sites/soap-newt/atlas/data'


def main():
    info, _ = get_json(SERVICE + '?f=json')
    assert info['name'] == '2020 Final Fire Perimeter'
    url = SERVICE + '/query?' + urlencode(dict(f='geojson',
        where=f"uniqfireid = '{INCIDENT}' AND fireyear = 2020",
        outFields='*', outSR=4326, returnGeometry='true'))
    collection, raw = get_json(url)
    assert len(collection['features']) == 1
    feature = collection['features'][0]
    props = feature['properties']
    assert props['uniqfireid'] == INCIDENT and props['firename'].upper() == 'CREEK'
    assert props['unitidowner'] == 'CASNF' and props['featurecat'] == 'Final Wildfire Perimeter'
    geometry = shape(feature['geometry'])
    assert geometry.is_valid and not geometry.is_empty
    west, south, east, north = geometry.bounds
    assert -119.6 < west < east < -118.8 and 36.9 < south < north < 37.8
    project = Transformer.from_crs(4326, 32611, always_xy=True).transform
    unproject = Transformer.from_crs(32611, 4326, always_xy=True).transform
    projected = transform(project, geometry)
    props.update(name='Creek Fire', label='Creek Fire · 2020', year=2020,
        kind='Fire perimeter', source='USDA Forest Service final wildfire perimeter',
        source_url=SERVICE, incident_url=INCIDENT_URL,
        note='Official incident perimeter; not burn severity. Complete source geometry retained.')
    collection.pop('crs', None)
    collection['bbox'] = list(geometry.bounds)
    terrain = json.loads((OUTPUT/'terrain.json').read_text())
    extent = box(terrain['xmin'], terrain['ymin'], terrain['xmax'], terrain['ymax'])
    outline = projected.boundary.intersection(extent)
    assert outline.is_valid and not outline.is_empty
    scene = dict(type='FeatureCollection', features=[dict(type='Feature',
        properties=dict(name='Creek Fire', year=2020, kind='Fire perimeter', source_url=SERVICE),
        geometry=mapping(transform(unproject, outline)))])
    overlaps = []
    for watershed in json.loads((OUTPUT/'watersheds.geojson').read_text())['features']:
        boundary = transform(project, shape(watershed['geometry']))
        area = projected.intersection(boundary).area
        overlaps.append(dict(watershed=watershed['properties']['name'], overlap_ha=round(area/1e4,4),
            watershed_area_ha=round(boundary.area/1e4,4), fraction_of_watershed=round(area/boundary.area,6)))
    metadata = dict(schema_version=1, name='Creek Fire', year=2020, incident_id=INCIDENT,
        retrieved_at=datetime.now(timezone.utc).isoformat(), source_title=info['name'],
        source_url=SERVICE, incident_url=INCIDENT_URL, query_url=url,
        source_response_sha256=hashlib.sha256(raw).hexdigest(),
        source_crs='EPSG:4269 (NAD83)', output_crs='EPSG:4326 (WGS 84)',
        reprojection='ArcGIS query outSR=4326; full geometry retained exactly as returned.',
        perimeter_timestamp_utc=utc(props['perimeterdatetime']), revision_timestamp_utc=utc(props['revdate']),
        reported_acres=props['totalacres'], source_gis_acres=props['gisacres'],
        computed_area_ha=round(projected.area/1e4,4), bbox=list(geometry.bounds),
        geometry_valid=geometry.is_valid, clipping='None for 2D; complete source footprint.',
        scene_outline='creek-fire-scene.geojson',
        scene_processing='Original perimeter boundary intersected with terrain extent in EPSG:32611; no boundary simplification or artificial clipping edges. Missing elevation cells omitted when draping.',
        geometric_overlap_with_archived_watersheds=overlaps,
        notes=['Incident perimeter does not describe burn severity or canopy mortality.',
               'USFS recorded acreage is preserved; CAL FIRE reports 379,895 acres.',
               'Watershed overlaps are geometric intersections, not measured burned-vegetation fractions.'])
    for name, data in [('creek-fire.geojson',collection),('creek-fire-scene.geojson',scene),('creek-fire-metadata.json',metadata)]:
        (OUTPUT/name).write_text(json.dumps(data,ensure_ascii=False,allow_nan=False,
            indent=2 if name.endswith('metadata.json') else None,
            separators=None if name.endswith('metadata.json') else (',',':'))+'\n')
    print(json.dumps(dict(bytes=len(raw),overlaps=overlaps,scene_outline_length_m=round(outline.length)),indent=2))


if __name__ == '__main__':
    main()
