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
if __name__=='__main__':unittest.main()
