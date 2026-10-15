"""Scientific integrity checks for the published Rancho atlas products."""
import json
import math
import hashlib
from array import array
import unittest
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / 'field-sites/rancho/atlas/data'

class AtlasDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.features = json.loads((DATA/'boreholes.geojson').read_text())['features']
        cls.holes = {f['properties']['id']:f for f in cls.features}
        cls.manifest = json.loads((DATA/'manifest.json').read_text())

    def test_inventory_and_missing_records_remain_explicit(self):
        self.assertEqual(len(self.holes), 47)
        self.assertEqual(sum(f['geometry'] is not None for f in self.features), 46)
        self.assertIsNone(self.holes['MH3P6']['geometry'])
        self.assertEqual(sum(f['properties']['depth_m'] is not None for f in self.features), 40)
        for ident in ['MH3P10','MH3P11','MH3P12','MH3P13','MH3P14','MH3P15']:
            self.assertIsNone(self.holes[ident]['properties']['depth_m'])

    def test_depth_units_and_completion_are_not_conflated(self):
        self.assertAlmostEqual(self.holes['MH7W1']['properties']['depth_m'], 156*.3048, places=3)
        self.assertEqual(self.holes['MH3P1']['properties']['depth_m'], .94)
        self.assertEqual(self.holes['MH7W6']['properties']['depth_basis'], 'drilled')
        self.assertIsNone(self.holes['MH7W6']['properties']['completed_depth_m'])
        self.assertIsNone(self.holes['MH7W6']['properties']['screen_m'])
        for f in self.features:
            p=f['properties']
            if p['screen_m']:
                self.assertLessEqual(0,p['screen_m'][0])
                self.assertLess(p['screen_m'][0],p['screen_m'][1])
                self.assertLessEqual(p['screen_m'][1],p['completed_depth_m'])

    def test_positions_sources_and_dem_elevations(self):
        for f in self.features:
            p=f['properties']
            self.assertNotIn('metadata_elevation_m',p)
            if not f['geometry']: continue
            lon,lat=f['geometry']['coordinates']
            self.assertTrue(-122.36<lon<-122.33 and 39.14<lat<39.17)
            self.assertTrue(100<p['ground_m']<600)
            self.assertTrue(p['position_source'])
        self.assertLess(self.holes['MH7W4']['geometry']['coordinates'][1],self.holes['MH7W1']['geometry']['coordinates'][1])
        self.assertIn('Provisional',self.holes['MH7W4']['properties']['position_note'])
        outlet=next(f for f in json.loads((DATA/'instruments.geojson').read_text())['features'] if f['properties']['kind']=='outlet')
        self.assertAlmostEqual(outlet['geometry']['coordinates'][0],-122.3471339,places=6)
        self.assertEqual(outlet['geometry']['coordinates'][1],39.143007)

    def test_terrain_and_catchments(self):
        terrain=json.loads((DATA/'terrain.json').read_text())
        self.assertEqual(len(terrain['elevation_m']),terrain['ny'])
        self.assertEqual(terrain['crs'],'EPSG:26910')
        for row in terrain['elevation_m']:
            self.assertEqual(len(row),terrain['nx'])
            self.assertTrue(all(math.isfinite(z) and 0<z<1000 for z in row))
        catchments=json.loads((DATA/'catchments.geojson').read_text())['features']
        self.assertEqual({f['properties']['id'] for f in catchments},{'Mountain House',*[f'MH{i}' for i in range(1,10)]})
        for f in catchments:
            self.assertGreater(f['properties']['area_ha'],0)
            self.assertEqual(f['geometry']['coordinates'][0][0],f['geometry']['coordinates'][0][-1])

    def test_contours_keep_native_dem_intervals_and_valid_geometry(self):
        contours=json.loads((DATA/'contours.geojson').read_text())['features']
        self.assertEqual(len(contours),self.manifest['contours']['count'])
        self.assertEqual(self.manifest['contours']['interval_m'],2)
        self.assertGreater(len(contours),100)
        self.assertTrue(any(not f['properties']['major'] for f in contours))
        for f in contours:
            p=f['properties']
            self.assertEqual(p['elevation_m']%2,0)
            self.assertEqual(p['major'],p['elevation_m']%10==0)
            self.assertEqual(f['geometry']['type'],'LineString')
            self.assertGreaterEqual(len(f['geometry']['coordinates']),2)
            for lon,lat in f['geometry']['coordinates']:
                self.assertTrue(-122.4<lon<-122.3 and 39.1<lat<39.2)

    def test_3d_contours_are_index_lines_only(self):
        contours=json.loads((DATA/'contours-3d.geojson').read_text())['features']
        self.assertGreater(len(contours),20)
        for f in contours:
            self.assertTrue(f['properties']['major'])
            self.assertEqual(f['properties']['elevation_m']%10,0)
            self.assertIn(f['geometry']['type'],['LineString','MultiLineString'])

    def test_canopy_is_a_dated_measured_cloud_with_consistent_units(self):
        meta=json.loads((DATA/'canopy.json').read_text())
        cloud=meta['cloud']
        self.assertEqual(meta['survey_dates'],['2019-04-16','2019-04-17'])
        self.assertIn('NAVD88',meta['vertical_datum'])
        self.assertGreater(cloud['count'],500000)
        self.assertLessEqual(cloud['count'],cloud['sample_limit'])
        raw=(DATA/cloud['url']).read_bytes()
        self.assertEqual(len(raw),cloud['count']*8)
        self.assertEqual(hashlib.sha256(raw).hexdigest(),meta['sha256'][cloud['url']])
        values=array('H',raw)
        import sys
        if sys.byteorder!='little':values.byteswap()
        for i in range(0,cloud['count'],1000):
            point=[values[i*4+j]*cloud['scale']+cloud['offset'][j] for j in range(4)]
            self.assertTrue(555000<point[0]<558000 and 4332000<point[1]<4336000)
            self.assertTrue(.49<=point[3]<=85.01)
        ground=meta['qa']['ground_minus_dem_m']
        self.assertGreater(ground['n'],10000)
        self.assertLess(abs(ground['median']),.1)
        self.assertLess(ground['p95']-ground['p05'],.5)

    def test_canopy_coverage_and_missing_terrain_remain_explicit(self):
        meta=json.loads((DATA/'canopy.json').read_text())
        self.assertTrue(.97<meta['coverage']['catchment_fraction']<.98)
        self.assertEqual(meta['raster']['cell_size_m'],1)
        self.assertIn('transparent',meta['raster']['nodata'])
        self.assertGreater(meta['raster']['observed_cells'],1000000)
        terrain=json.loads((DATA/'terrain.json').read_text())
        self.assertEqual(len(terrain['valid']),terrain['ny'])
        self.assertTrue(any(v==0 for row in terrain['valid'] for v in row))
        self.assertIn('CA19_Dietrich',terrain['source'])
        self.assertEqual(terrain['vertical_datum'],meta['vertical_datum'])

if __name__=='__main__': unittest.main()
