#!/usr/bin/env python3
"""Fetch the official USFS final perimeter for the 2021 Blue Fire at Soaproot.

Requires shapely and pyproj. No credentials required. Full source geometry is
preserved without simplification or clipping. The layer is an incident perimeter,
not mapped vegetation burn severity or a current fire alert.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen
from shapely.geometry import shape
from shapely.ops import transform
from pyproj import Transformer

SERVICE = 'https://apps.fs.usda.gov/ArcX/rest/services/EDW/EDW_FireOccurrenceAndPerimeter_01/MapServer/23'
INCIDENT = '2021-CASNF-000717'
CAL_FIRE = 'https://www.fire.ca.gov/incidents/2021/6/30/blue-fire'


def get_json(url):
    with urlopen(url, timeout=60) as response:
        raw = response.read()
    data = json.loads(raw)
    if 'error' in data:
        raise RuntimeError(data['error'])
    return data, raw


def utc(ms):
    return None if ms is None else datetime.fromtimestamp(ms / 1000, timezone.utc).isoformat()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'field-sites/soap-newt/atlas/data')
    args = parser.parse_args()
    info, _ = get_json(SERVICE + '?f=pjson')
    assert info['name'] == '2021 Final Fire Perimeter', 'Service layer has changed; inspect before proceeding.'
    params = {'f':'geojson', 'where': f"uniqfireid = '{INCIDENT}' AND fireyear = 2021", 'outFields':'*', 'outSR':'4326', 'returnGeometry':'true'}
    url = SERVICE + '/query?' + urlencode(params)
    collection, raw = get_json(url)
    assert len(collection['features']) == 1, 'Expected exactly one matched incident.'
    feature = collection['features'][0]
    props = feature['properties']
    assert props['uniqfireid'] == INCIDENT and props['firename'].upper() == 'BLUE'
    assert props['unitidowner'] == 'CASNF' and props['featurecat'] == 'Final Wildfire Perimeter'
    geometry = shape(feature['geometry'])
    assert geometry.is_valid and not geometry.is_empty
    west, south, east, north = geometry.bounds
    assert -119.30 < west < east < -119.20 and 37.00 < south < north < 37.06, 'Unexpected geographic location.'
    projection = Transformer.from_crs('EPSG:4326', 'EPSG:26911', always_xy=True).transform
    projected = transform(projection, geometry)
    props.update(name='Blue Fire', label='Blue Fire · 2021', year=2021, kind='Fire perimeter',
                 source='USDA Forest Service final wildfire perimeter', source_url=SERVICE,
                 incident_url=CAL_FIRE, source_crs='EPSG:4269', output_crs='EPSG:4326',
                 perimeter_timestamp_utc=utc(props['perimeterdatetime']),
                 revision_timestamp_utc=utc(props['revdate']),
                 note='Official incident perimeter; not vegetation burn severity. Full geometry retained.')
    collection.pop('crs', None)
    collection['bbox'] = list(geometry.bounds)
    metadata = dict(schema_version=1, name='Blue Fire', year=2021, incident_id=INCIDENT,
                    retrieved_at=datetime.now(timezone.utc).isoformat(), source_title=info['name'],
                    source_agency=info.get('copyrightText'), source_url=SERVICE, query_url=url,
                    incident_url=CAL_FIRE, source_response_sha256=hashlib.sha256(raw).hexdigest(),
                    source_crs='EPSG:4269 (NAD83)', output_crs='EPSG:4326 (WGS 84)',
                    reprojection='ArcGIS query outSR=4326; geometry retained exactly as returned.',
                    perimeter_timestamp_utc=utc(props['perimeterdatetime']),
                    revision_timestamp_utc=utc(props['revdate']),
                    database_source_timestamp_utc=utc(props['dbsourcedate']),
                    discovery_timestamp_utc=utc(props['discoverydatetime']),
                    reported_acres=props['totalacres'], source_gis_acres=props['gisacres'],
                    computed_area_ha=round(projected.area/10000,4),
                    bbox=list(geometry.bounds), clipping='None; complete incident footprint retained.',
                    geometry_valid=geometry.is_valid,
                    notes=[
                        'Correct incident identified by year, Sierra National Forest unit CASNF, unique incident ID, and location near Soaproot Saddle.',
                        'The source designates this a final wildfire perimeter. Its perimeter timestamp is an attribute of that record, not a containment date.',
                        'Reported incident acreage (277) and mapped GIS acreage (291.13) differ; both original attributes are retained.',
                        'CAL FIRE lists a June 30 start; the USFS discovery timestamp converts to June 29 in Pacific time. Do not treat those differing administrative dates as reconciled.',
                        'The footprint does not resolve burn severity, unburned islands omitted from source mapping, or canopy mortality.',
                        'The archived burn_outline.shp was not used because its projection and event identity were unverified.'
                    ])
    watersheds = args.output / 'watersheds.geojson'
    if watersheds.exists():
        overlaps = []
        for watershed in json.loads(watersheds.read_text())['features']:
            boundary = transform(projection, shape(watershed['geometry']))
            intersection = projected.intersection(boundary).area
            overlaps.append(dict(watershed=watershed['properties'].get('name', watershed['properties']),
                                 overlap_ha=round(intersection/10000,4),
                                 watershed_area_ha=round(boundary.area/10000,4),
                                 fraction_of_watershed=round(intersection/boundary.area,6)))
        metadata['geometric_overlap_with_archived_watersheds'] = overlaps
        metadata['overlap_note'] = 'Geometric intersection of archived watershed polygons and incident perimeter; not a measured burned-vegetation fraction.'
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output/'blue-fire.geojson').write_text(json.dumps(collection,separators=(',',':'),allow_nan=False))
    (args.output/'blue-fire-metadata.json').write_text(json.dumps(metadata,indent=2,allow_nan=False)+'\n')
    print(json.dumps({k:metadata[k] for k in ['incident_id','source_gis_acres','computed_area_ha','bbox','geometry_valid']},indent=2))


if __name__ == '__main__':
    main()
