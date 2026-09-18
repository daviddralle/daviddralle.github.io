"""Curated transcription from Rempe (2016); page numbers checked against the local PDF.

Updates published atlas derivatives only, not the original field records.
Run from any directory; no georeferencing or vertical offsets are changed.
"""
from pathlib import Path
import csv
import json

ROOT = Path(__file__).resolve().parents[1] / 'field-sites/rivendell/atlas/data'
def read(name):
    return json.loads((ROOT / name).read_text())
def write(name, data):
    (ROOT / name).write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')

removed = {'well-11', 'well7_northside-267', 'control-well7_northside-267'}
manifest = read('manifest.json')
for layer in manifest['layers']:
    name = layer['url'].split('?')[0].removeprefix('data/')
    data = read(name)
    retained = [f for f in data['features'] if f['properties'].get('uid') not in removed]
    if len(retained) != len(data['features']):
        data['features'] = retained
        write(name, data)
    layer['count'] = len(retained)
    if layer['id'] in ('wells', 'survey', 'survey_original', 'control_residuals'):
        layer['url'] = 'data/' + name + '?v=rempe-metadata-1'
write('manifest.json', manifest)
features = read('3d/features.json')
for name in features:
    features[name] = [f for f in features[name] if f['uid'] not in removed]
write('3d/features.json', features)
qa = read('qa.json')
for key in ('well_geometry_discrepancy', 'elevation_comparison', 'controls'):
    qa[key] = [r for r in qa[key] if r['well'] != 11]
qa['registration_note'] = 'Historical registration fits and their diagnostics are unchanged. The abandoned Well 11 was a historical control; its displayed residual and survey observation are removed, without refitting other positions.'
qa['metadata_audit']['published_survey_observations'] = 283
qa['metadata_audit']['omitted_abandoned_point_ids'] = [267]
write('qa.json', qa)
audit = ROOT / 'metadata_label_audit.csv'
with audit.open(newline='') as f:
    reader = csv.DictReader(f)
    fields = reader.fieldnames
    rows = [r for r in reader if r['id'] != '267']
with audit.open('w', newline='') as f:
    writer = csv.DictWriter(f, fields, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)

zones = {1: (2.5, 5), 3: (3, 10), 6: (6, 13), 10: (11, 19), 15: (19, 26)}
wells = read('wells.geojson')
for feature in wells['features']:
    p = feature['properties']
    n = p['wellnum']
    notes = []
    def note(topic, text, pages, pdf):
        notes.append(dict(topic=topic, text=text, source=f'Rempe (2016), printed {pages}; PDF {pdf}'))
    p['drilling_date'] = 'September 2007' if p['year_drilled'] == 2007 else 'August 2010'
    p['surface_casing_diameter_in'] = 4 if n in (13, 14, 15, 16) else 2
    p['casing_material'] = 'PVC'
    p['screen_configuration'] = 'Continuously slotted over the full drilled depth'
    note('Construction', f"Drilled {p['drilling_date']} using dry augering and penetration testing. PVC casing is slotted throughout the drilled depth and sealed at the surface with cement grout. Surface casing: {p['surface_casing_diameter_in']} inches.", 'pp. 31–34, 37; Table B.1, p. 175', 'pp. 47–50, 53, 191')
    if n in zones:
        top, bottom = zones[n]
        p['thesis_hydrologic_zones'] = dict(seasonally_saturated_top_depth_m=top, chronically_saturated_top_depth_m=bottom, depth_reference='Below surface in the thesis hydrologic profile; not converted to LiDAR elevation', source='Rempe (2016), pp. 45–46; PDF pp. 61–62')
        note('Seasonal saturation', f'The thesis profile places the top of seasonal saturation at about {top:g} m depth and chronic saturation at about {bottom:g} m. These describe the historical study profile, not a current water-level reading.', 'pp. 45–46', 'pp. 61–62')
    if n in (2, 13):
        note('Seasonal drying', 'During the study, groundwater fell below the well bottom and the well drained completely. Dry intervals were excluded from hydrograph analysis; the bottom does not capture the deepest seasonal water table.', 'pp. 34, 46', 'pp. 50, 62')
    if n in (1, 3, 10):
        note('Groundwater sampling', 'Daily pumping for groundwater sampling affected summer recessions. This well was excluded from the thesis summer recession analysis for that reason.', 'p. 34', 'p. 50')
    if n in (5, 6, 7, 14):
        note('Roadcut depth reference', 'Road construction removed native soil and saprolite here. Thesis “profile depth” is referenced to a reconstructed pre-roadcut surface, rather than the present wellhead surface.', '§B.6, p. 175', 'p. 191')
    if n == 12:
        note('Drilling disturbance', 'About 1 m of material was removed during drilling. The first neutron-probe observation is 1.5 m below the original ground surface.', '§B.6, p. 175', 'p. 191')
    if n in (13, 14, 15, 16):
        note('Surface seal & neutron profiles', 'Drilling disturbed roughly the upper 0.5 m. A 4-inch PVC surround and concrete seal limit preferential entry of water. Neutron readings in the upper 0.5–0.75 m were discarded, with the cutoff varying among these wells.', '§B.6, p. 175', 'p. 191')
    if n in (2, 5, 6, 7, 12, 13, 14, 15, 16):
        note('Rock-moisture measurements', 'Included in the reported neutron-probe results. CPN 503DR Hydroprobe profiles were collected at 0.3 m intervals through the unsaturated zone.', 'pp. 32, 34', 'pp. 48, 50')
    note('Study instrumentation', 'The study used Campbell Scientific CS450/CS451 submersible sensors for water level and temperature. Full-depth slots integrate responses across fractures rather than isolating a particular interval.', 'pp. 32–34', 'pp. 48–50')
    p['thesis_notes'] = notes
write('wells.geojson', wells)
print(f'Updated {len(wells["features"])} wells with page-referenced thesis metadata.')
