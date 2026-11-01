import contextlib,io,json,tempfile,unittest
from pathlib import Path
from test_telemetry import toa
from ingest_telemetry import build
class PakBusMerge(unittest.TestCase):
 def test_overlap_restart_provenance_and_idempotence(self):
  with tempfile.TemporaryDirectory() as tmp,contextlib.redirect_stdout(io.StringIO()):
   p=Path(tmp);src=p/'source';src.mkdir();(src/'top_sap_old.dat').write_bytes(toa())
   direct=p/'direct.json';direct.write_text(json.dumps({'schema_version':1,'logger':1,'sources':[{'filename':'top_sap_pakbus_generation_3.dat','received_utc':'2026-11-01T18:00:00Z','toa5':toa().decode(),'identity':{'serial':'16309','compiled':[10,0]},'provenance':{'1':{'generation':3,'fingerprint':'abc','received_utc':'2026-11-01T18:00:00Z'}}}]}))
   a=build(src,p/'out',p/'archive',0,direct);rows=a['tables']['top_sap']['records'];self.assertEqual(len(rows),1);self.assertEqual(rows[0]['source_generation'],3);self.assertEqual(rows[0]['previous_source_file'],'top_sap_old.dat')
   b=build(src,p/'out',p/'archive',0,direct);self.assertEqual(a,b)
   self.assertTrue(list((p/'archive/raw').glob('*.dat')))

class PowerTable(unittest.TestCase):
 def test_new_power_table_retains_intervals_and_provenance(self):
  raw='"TOA5","16309","CR350","16309","CR350.1.9","CPU:TOP_16309_PAKBUS_POWER.CRB","123","Power15"\n"TIMESTAMP","RECORD","BattV_Avg","BattV_Min"\n"TS","RN","Volts","Volts"\n"","","Avg","Min"\n"2026-11-01 12:00:00",0,12.93,12.85\n'
  with tempfile.TemporaryDirectory() as tmp,contextlib.redirect_stdout(io.StringIO()):
   p=Path(tmp);src=p/'source';src.mkdir();direct=p/'direct.json'
   direct.write_text(json.dumps({'schema_version':1,'logger':1,'sources':[{'filename':'top_power_pakbus_generation_9.dat','received_utc':'2026-11-01T19:20:00Z','toa5':raw,'identity':{'serial':'16309','compiled':[100,0]},'provenance':{'0':{'generation':9,'fingerprint':'power-test','received_utc':'2026-11-01T19:20:00Z'}}}]}))
   d=build(src,p/'out',p/'archive',0,direct);t=d['tables']['top_power']
   self.assertEqual(t['interval_minutes'],15)
   self.assertEqual(t['records'][0]['values'],{'BattV_Avg':12.93,'BattV_Min':12.85})
   self.assertEqual(t['records'][0]['source_fingerprint'],'power-test')
   self.assertEqual(t['records'][0]['quality'],'provisional')

if __name__=='__main__':unittest.main()
