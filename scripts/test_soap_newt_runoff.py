#!/usr/bin/env python3
"""Check dimensional conversion, coverage, flags, and mixed-cadence day assignment."""
from datetime import datetime, timedelta, timezone
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from update_soap_newt_runoff import daily_rows, runoff_mm_day, make_payload, preferred_release, read_month


def modern(n=96, value='10'):
    start = datetime(2026, 9, 1, tzinfo=timezone.utc)
    return [{'startDateTime': (start + timedelta(minutes=15*i)).isoformat(),
             'endDateTime': (start + timedelta(minutes=15*(i+1))).isoformat(),
             'stationHorizontalID': '132', 'dischargeContinuous': value,
             'dischargeFinalQF': '0', 'dischargeFinalQFSciRvw': '',
             'dischargeCorrectionApplied': ''} for i in range(n)]


class RunoffTests(unittest.TestCase):
    def test_dimensional_conversion(self):
        # 1000 L/s = 1 m3/s; over 1 km2 for 1 day this is 86.4 mm.
        self.assertAlmostEqual(runoff_mm_day(1000, 1), 86.4)
        self.assertAlmostEqual(runoff_mm_day(10), 0.07926605504587156)

    def test_complete_day_and_midnight_end(self):
        day = daily_rows(modern(), 'csd_15_min', '2026-09')['2026-09-01']
        self.assertEqual(day['valid_seconds'], 86400)
        self.assertEqual(day['discharge_l_s'], 10)
        self.assertEqual(day['quality_counts']['accepted_science_unreviewed'], 96)

    def test_coverage_threshold_without_zero_fill(self):
        below = daily_rows(modern(86), 'csd_15_min', '2026-09')['2026-09-01']
        above = daily_rows(modern(87), 'csd_15_min', '2026-09')['2026-09-01']
        self.assertIsNone(below['runoff'])
        self.assertEqual(above['discharge_l_s'], 10)
        self.assertEqual(above['valid_seconds'], 78300)

    def test_failed_flags_negative_and_nonfinite(self):
        rows = modern()
        for i in range(4):
            rows[i]['dischargeFinalQF'] = '1'
        for i in range(4, 8):
            rows[i]['dischargeFinalQFSciRvw'] = '1'
        rows[8]['dischargeContinuous'] = '-1'
        rows[9]['dischargeContinuous'] = 'NaN'
        day = daily_rows(rows, 'csd_15_min', '2026-09')['2026-09-01']
        self.assertEqual(day['valid_seconds'], 86*900)
        self.assertIsNone(day['runoff'])
        self.assertEqual(day['quality_counts']['science_review_failed'], 4)

    def test_zero_is_observation_not_gap(self):
        day = daily_rows(modern(value='0'), 'csd_15_min', '2026-09')['2026-09-01']
        self.assertEqual(day['runoff'], 0)

    def test_duplicate_not_double_counted(self):
        rows = modern()
        self.assertEqual(daily_rows(rows + [rows[0]], 'csd_15_min', '2026-09')['2026-09-01']['valid_seconds'], 86400)
        with self.assertRaises(ValueError):
            daily_rows(rows + [dict(rows[0], dischargeContinuous='11')], 'csd_15_min', '2026-09')

    def test_instantaneous_legacy_at_midnight_belongs_to_that_day(self):
        start = datetime(2018, 5, 1, tzinfo=timezone.utc)
        rows = [{'siteID': 'BIGC', 'stationHorizontalID': '102',
                 'endDate': (start + timedelta(minutes=i)).isoformat(),
                 'maxpostDischarge': '10', 'dischargeFinalQF': '0', 'dischargeFinalQFSciRvw': ''} for i in range(1440)]
        result = daily_rows(rows, 'csd_continuousDischarge', '2018-05')
        self.assertEqual(list(result), ['2018-05-01'])
        self.assertEqual(result['2018-05-01']['valid_seconds'], 86400)
        self.assertAlmostEqual(result['2018-05-01']['runoff'], 0.079266)

    def test_provisional_default_endpoint_and_incremental_cache(self):
        class FakeClient:
            def __init__(self, cache):
                self.cache = cache
                self.calls = []
                self.files = 0
            def api(self, path):
                self.calls.append(path)
                return {'siteCode': 'BIGC', 'productCode': 'DP4.00130.001', 'release': 'PROVISIONAL',
                        'files': [{'name': 'NEON.csd_15_min.2026-09.csv', 'size': 1, 'md5': 'data'},
                                  {'name': 'NEON.variables.2026-09.csv', 'size': 1, 'md5': 'vars'}]}
            def file(self, entry):
                self.files += 1
                return ([{'table': 'csd_15_min', 'fieldName': 'dischargeContinuous', 'units': 'litersPerSecond'}]
                        if '.variables.' in entry['name'] else modern()), {'name': entry['name']}
        with TemporaryDirectory() as folder:
            client = FakeClient(Path(folder))
            a = read_month(client, '2026-09', 'PROVISIONAL')
            b = read_month(client, '2026-09', 'PROVISIONAL')
            self.assertEqual(a, b)
            self.assertEqual(client.files, 2)
            self.assertEqual(len(client.calls), 2)
            self.assertEqual(client.calls[0], 'data/DP4.00130.001/BIGC/2026-09?package=basic')

    def test_missing_month_explicit_null_and_releases(self):
        monthly = [{'month': m, 'release': 'RELEASE-2026', 'table': 'csd_15_min',
                    'sources': [], 'daily': {}} for m in ['2020-01', '2020-03']]
        product = {'dataProductTitle': 'Continuous discharge', 'availableMonths': ['2020-01', '2020-03'],
                   'availableReleases': [{'release': 'RELEASE-2026', 'availableMonths': ['2020-01']}]}
        payload = make_payload(monthly, product, '2026-11-04T00:00:00Z')
        series = payload['series'][0]
        self.assertIn(['2020-02-29', None], series['values'])
        self.assertEqual(len(series['values']), 91)
        self.assertEqual(preferred_release(product, '2020-01'), 'RELEASE-2026')
        self.assertEqual(preferred_release(product, '2020-03'), 'PROVISIONAL')


if __name__ == '__main__':
    unittest.main()
