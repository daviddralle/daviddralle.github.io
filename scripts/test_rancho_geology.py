"""Integrity checks for the published regional context overlay."""
import json, unittest
from pathlib import Path
from pyproj import Transformer
from shapely.geometry import shape, box
from shapely.ops import transform, unary_union
ROOT=Path(__file__).resolve().parents[1]/'field-sites/rancho/atlas/data'
META=json.loads((ROOT/'geology/metadata.json').read_text())
UNITS=json.loads((ROOT/'geology/units.geojson').read_text())['features']
LINES=json.loads((ROOT/'geology/lines.geojson').read_text())['features']
project=Transformer.from_crs(4326,26910,always_xy=True).transform
GEOMETRIES=[transform(project,shape(f['geometry'])) for f in UNITS]
class GeologyChecks(unittest.TestCase):
    def test_valid_polygons_cover_existing_terrain_without_overlaps(self):
        self.assertTrue(all(g.is_valid and not g.is_empty for g in GEOMETRIES))
        merged=unary_union(GEOMETRIES)
        self.assertLess(sum(g.area for g in GEOMETRIES)-merged.area,1)
        self.assertLess(box(555720,4332490,557180,4335790).difference(merged).area,1)
    def test_source_scale_and_datum_remain_explicit(self):
        self.assertEqual(META['source_detail_scale'],250000)
        self.assertEqual(META['source_crs'],'EPSG:3310')
        self.assertEqual(META['year'],1960)
        self.assertEqual(len(META['source_sha256']),64)
        self.assertEqual({f['properties']['unit'] for f in UNITS},set(META['units']))
    def test_mapped_wells_have_regional_unit_coverage(self):
        merged=unary_union(GEOMETRIES)
        holes=json.loads((ROOT/'boreholes.geojson').read_text())['features']
        for f in holes:
            if f['geometry']: self.assertTrue(merged.covers(transform(project,shape(f['geometry']))),f['properties']['id'])
    def test_contacts_retain_source_identity_and_uncertainty(self):
        for f in LINES:
            self.assertTrue(shape(f['geometry']).is_valid)
            self.assertEqual(f['properties']['type'],'contact')
            self.assertEqual(f['properties']['location_confidence_m'],250)
            self.assertTrue(f['properties']['id'].startswith('CAF'))
if __name__=='__main__':unittest.main()
