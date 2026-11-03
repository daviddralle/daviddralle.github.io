#!/usr/bin/env python3
"""Regression checks for UTC aggregation, QA selection, heights and source identity."""
import importlib.util
from datetime import datetime,timedelta,timezone
from pathlib import Path
import unittest
from unittest.mock import patch
import tempfile,json
from urllib.request import Request

path=Path(__file__).with_name('update_soap_newt_observations.py')
spec=importlib.util.spec_from_file_location('observations',path)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class FixtureClient:
 def __init__(self,code):
  self.code=code;self.c=m.CONFIG[code];self.rows=[];self.positions=[{'HOR.VER':'000.060','zOffset':'51.74','referenceLocationID':'TOWER111206'}]
  start=datetime(2026,9,1,tzinfo=timezone.utc)
  for n in range(96):
   t=start+timedelta(minutes=30*n)
   self.rows.append({'startDateTime':t.isoformat().replace('+00:00','Z'),'endDateTime':(t+timedelta(minutes=30)).isoformat().replace('+00:00','Z'),self.c['variable']:'1',self.c['flag']:'0'})
 def api(self,path):
  return {'siteCode':'SOAP','productCode':self.code,'release':'PROVISIONAL','files':[
   {'name':f'NEON.{self.code}.variables.csv'}, {'name':f'NEON.{self.code}.sensor_positions.csv'},
   {'name':f'NEON.{self.code}.000.060.030.{self.c["table"]}.2026-09.csv'},
   {'name':f'NEON.{self.code}.000.030.002.{self.c["table"]}.2026-09.csv'}]}
 def file(self,entry):
  name=entry['name']
  if 'variables' in name:rows=[{'table':self.c['table'],'fieldName':self.c['variable'],'units':self.c['native_unit']}]
  elif 'sensor_positions' in name:rows=self.positions
  else:rows=self.rows
  return rows,{'name':name,'bytes':100,'sha256':'fixture'}
 def result(self):return m.read_product(self,self.code,self.c,['2026-09'],'2026-11-03T00:00:00Z')[0][0]

class AggregationTests(unittest.TestCase):
 def test_midnight_and_complete_rain(self):
  s=FixtureClient('DP1.00045.001').result()
  self.assertEqual(s['values'][:3],[['2026-09-01',48.0],['2026-09-02',48.0],['2026-09-03',None]])
  self.assertEqual(s['latest_valid_time'],'2026-09-03T00:00:00Z')
  self.assertEqual(s['latest_unit'],'mm');self.assertEqual(s['unit'],'mm/day')
 def test_incomplete_rain_not_zero_or_partial_total(self):
  f=FixtureClient('DP1.00045.001');f.rows[0]['finalQF']='1';s=f.result()
  self.assertIsNone(s['values'][0][1]);self.assertEqual(s['coverage'][0][1],47)
 def test_mean_threshold_and_unknown_flags(self):
  f=FixtureClient('DP1.00003.001')
  for r in f.rows[:12]:r['finalQF']='-1'
  self.assertEqual(f.result()['values'][0][1],1.0)
  f.rows[12]['finalQF']='';self.assertIsNone(f.result()['values'][0][1])
 def test_nonfinite_value_rejected_even_if_flag_zero(self):
  f=FixtureClient('DP1.00045.001');f.rows[-1]['precipBulk']='NaN';s=f.result()
  self.assertEqual(s['latest_valid_time'],'2026-09-02T23:30:00Z');self.assertIsNone(s['values'][1][1])
 def test_conflicting_duplicate_rejected(self):
  f=FixtureClient('DP1.00045.001');f.rows.append(dict(f.rows[0],precipBulk='9'))
  with self.assertRaisesRegex(ValueError,'Conflicting duplicate'):f.result()
 def test_height_change_rejected(self):
  f=FixtureClient('DP1.00003.001');f.positions.append(dict(f.positions[0],zOffset='52.0'))
  with self.assertRaisesRegex(ValueError,'Sensor height changed'):f.result()
 def test_missing_credential_retains_last_good_output(self):
  with tempfile.TemporaryDirectory() as root:
   output=Path(root)/'observations.json'
   old={'last_success_at':'2026-11-01T00:00:00Z','series':[{'id':'retained'}],'status':'ok'}
   output.write_text(json.dumps(old))
   with patch('sys.argv',['update','--token-file',str(Path(root)/'missing-token'),'--output',str(output)]):
    with self.assertRaises(SystemExit):m.main()
   result=json.loads(output.read_text())
   self.assertEqual(result['series'],old['series'])
   self.assertEqual(result['last_success_at'],old['last_success_at'])
   self.assertEqual(result['status'],'check_failed')
 def test_token_removed_on_cross_origin_redirect(self):
  req=Request('https://data.neonscience.org/api/v0/test',headers={'X-API-Token':'synthetic-test-token'})
  redirected=m.SafeRedirect().redirect_request(req,None,302,'Found',{},'https://storage.googleapis.com/example')
  self.assertIsNone(redirected.get_header('X-api-token'))

if __name__=='__main__':unittest.main()
