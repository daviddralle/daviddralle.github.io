import json,tempfile,unittest,contextlib,io
from pathlib import Path
from build_quick import build
class QuickTests(unittest.TestCase):
 def test_missing_values_constant_sensor_and_incomplete_rain(self):
  def row(t,v):return {'timestamp':t,'values':v,'flags':{},'received_utc':'2026-11-01T20:00:00Z'}
  tables={'top_soil':{'records':[row('2026-11-01 12:10:00',{'VMC_Seg1':0.0,'VMC_Seg2':None})]},'top_sap':{'records':[row('2026-11-01 10:07:00',{'TotalSapFlow_A':2,'TotalSapFlow_B':0}),row('2026-11-01 12:07:00',{'TotalSapFlow_A':4,'TotalSapFlow_B':0})]},'top_weather':{'records':[row('2026-11-01 10:00:00',{'Rain_mm_Tot':2}),row('2026-11-01 12:00:00',{'Rain_mm_Tot':3})]}}
  data={'tables':tables,'months':['2026-11'],'received_through_utc':'2026-11-01T20:00:00Z','time_basis':'test'}
  with tempfile.TemporaryDirectory() as tmp,contextlib.redirect_stdout(io.StringIO()):
   p=Path(tmp)
   for name in ['telemetry.json','telemetry-2026-11.json']:(p/name).write_text(json.dumps(data))
   d=build(p)
  self.assertEqual(d['soil']['rows'][0][1:3],[0.,None])
  self.assertEqual([r[1] for r in d['sap']['normalized_rows']],[0.,1.])
  self.assertIsNone(d['sap']['normalized_rows'][0][2])
  self.assertFalse(d['rainfall']['complete_water_year_to_latest_weather'])
  self.assertEqual(d['rainfall']['total_recorded_mm'],5)
  self.assertEqual(d['rainfall']['missing_hours_within_record'],1)
if __name__=='__main__':unittest.main()
