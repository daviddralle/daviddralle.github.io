"""Regression checks for missing values, relay quarantine and immutable history."""
import contextlib
import csv
import io
import json
import tempfile
import unittest
from pathlib import Path
from ingest_telemetry import build, parse_file
from import_field_notes import validate


def toa(table='Sap_Flow_Data', value='-0.1', record=1, stamp='2026-10-30 12:07:00'):
    rows = [['TOA5','16309','CR350','16309','OS','CPU:program.CRB','30148',table],
            ['TIMESTAMP','RECORD','TotalSapFlow_A','VMC','Temp','Missing'],
            ['TS','RN','L/h','%','deg_C',''],['','','Smp','Smp','Smp','Smp'],
            [stamp,str(record),value,'0','3176','NaN']]
    out=io.StringIO(); csv.writer(out).writerows(rows); return out.getvalue().encode()


class Telemetry(unittest.TestCase):
    def test_missing_zero_negative_and_relay(self):
        _, t=parse_file(toa(), 'top_sap_test.dat', '2026-10-31T00:00:00+00:00')
        r=t['records'][0]
        self.assertEqual(r['values']['VMC'], 0)
        self.assertEqual(r['values']['TotalSapFlow_A'], -.1)
        self.assertEqual(r['flags']['TotalSapFlow_A'], 'negative_reported')
        self.assertIsNone(r['values']['Missing'])
        self.assertIsNone(r['values']['Temp'])
        self.assertEqual(r['raw']['Temp'], '3176')
        _, b=parse_file(toa('BtmSap'), 'bottom_sap_test.dat', '2026-10-31T00:00:00+00:00')
        self.assertEqual(b['records'][0]['quality'], 'relay_review')

    def test_incomplete_and_wrong_schema(self):
        for raw in [b'', toa().rstrip(), toa('wrong')]:
            with self.assertRaises(ValueError):
                parse_file(raw, 'top_sap_test.dat', '2026-10-31T00:00:00+00:00')

    def test_archive_dedup_and_idempotence(self):
        with tempfile.TemporaryDirectory() as folder, contextlib.redirect_stdout(io.StringIO()):
            base=Path(folder); source=base/'source'; source.mkdir()
            output=base/'output'; archive=base/'archive'
            first=source/'top_sap_test.dat'; first.write_bytes(toa())
            second=source/'top_sap_repeat.dat'; second.write_bytes(toa())
            initial=build(source, output, archive, 0)
            self.assertEqual(len(initial['tables']['top_sap']['records']), 1)
            first.write_bytes(toa(value='0.2', record=2, stamp='2026-11-01 12:07:00'))
            second.unlink()
            newer=build(source, output, archive, 0)
            self.assertEqual(len(newer['tables']['top_sap']['records']), 2)
            self.assertEqual(newer['months'], ['2026-10','2026-11'])
            self.assertEqual(len(list((archive/'raw').glob('*.dat'))), 3)
            before=(output/'telemetry.json').stat().st_mtime_ns
            build(source, output, archive, 0)
            self.assertEqual(before, (output/'telemetry.json').stat().st_mtime_ns)
            self.assertEqual(json.loads((output/'telemetry-2026-10.json').read_text())['tables']['top_sap']['records'][0]['values']['TotalSapFlow_A'], -.1)

    def test_empty_source_does_not_replace(self):
        with tempfile.TemporaryDirectory() as folder:
            base=Path(folder); output=base/'output'; output.mkdir()
            published=output/'telemetry.json'; published.write_text('keep')
            with self.assertRaises(RuntimeError): build(base/'missing',output,base/'archive',0)
            self.assertEqual(published.read_text(),'keep')

    def test_notes_leave_unknowns_unknown(self):
        note={'id':'test','date':'2026-10-30','site':'sheep-camp','station':'top','text':'Test transcription'}
        clean=validate({'schema_version':1,'notes':[note]})[0]
        self.assertIsNone(clean['time']); self.assertIsNone(clean['latitude'])
        for extra in [{'latitude':91}, {'date':'2026-02-30'}, {'text':''}]:
            with self.assertRaises(ValueError):validate({'schema_version':1,'notes':[note|extra]})
        with self.assertRaises(ValueError): validate({'schema_version':1,'notes':[note,note]})

if __name__=='__main__': unittest.main()
