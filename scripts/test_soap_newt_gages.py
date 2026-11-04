import unittest
from tempfile import TemporaryDirectory
from pathlib import Path
import numpy as np
import pandas as pd
from soap_newt_gage_processing import *

class GageTests(unittest.TestCase):
 def test_flagged_pressure_is_barrier_and_no_extrapolation(self):
  start=pd.date_range('2026-01-01',periods=4,freq='30min',tz='UTC')
  p=pd.DataFrame({'startDateTime':start,'endDateTime':start+pd.Timedelta('30min'),'staPresMean':[90,91,92,93],'staPresFinalQF':[0,0,1,0]})
  t=pd.DatetimeIndex(['2025-12-31T23:59Z','2026-01-01T00:15Z','2026-01-01T00:30Z','2026-01-01T01:00Z','2026-01-01T01:30Z','2026-01-01T02:00Z'])
  v=pressure_at(p,t);self.assertTrue(np.isnan(v[[0,3,4,5]]).all());np.testing.assert_allclose(v[1:3],[90*KPA_TO_M,90.5*KPA_TO_M])
 def test_missing_pressure_interval_not_bridged(self):
  p=pd.DataFrame({'startDateTime':['2026-01-01T00:00Z','2026-01-01T01:00Z'],'endDateTime':['2026-01-01T00:30Z','2026-01-01T01:30Z'],'staPresMean':[90,90],'staPresFinalQF':[0,0]})
  self.assertTrue(np.isnan(pressure_at(p,pd.DatetimeIndex(['2026-01-01T00:45Z']))[0]))
 def test_conflicting_overlap_missing(self):
  a=pd.DataFrame({'serial':['1','1'],'time':[1,2],'absolute_head_m':[9.,9.]});b=a.copy();b.loc[1,'absolute_head_m']=9.1
  m=merge_returns([a,b]);self.assertEqual(m.absolute_head_m.iloc[0],9);self.assertTrue(np.isnan(m.absolute_head_m.iloc[1]));self.assertEqual(m.conflict.sum(),1)
 def test_xle_units_explicit(self):
  with TemporaryDirectory() as temp:
   p=Path(temp)/'test.xle';template='<Body_xle><Instrument_info><Serial_number>1</Serial_number></Instrument_info><Ch1_data_header><Identification>LEVEL</Identification><Unit>{}</Unit></Ch1_data_header><Data><Log><Date>2026/07/01</Date><Time>01:01:00</Time><ch1>90</ch1></Log></Data></Body_xle>'
   p.write_text(template.format('kPa'));df,_=read_xle(p);self.assertAlmostEqual(df.absolute_head_m.iloc[0],90*KPA_TO_M);self.assertEqual(df.time.iloc[0].utcoffset().total_seconds(),-28800)
   p.write_text(template.format('unknown'))
   with self.assertRaises(ValueError):read_xle(p)
 def test_runoff_conversion_and_coverage(self):
  idx=pd.date_range('2026-01-01',periods=96,freq='15min',tz=PST);q=pd.Series(1.,index=idx);r,n=daily_runoff(q,1);self.assertAlmostEqual(r.iloc[0],86.4)
  q.iloc[:10]=np.nan;r,n=daily_runoff(q,1);self.assertTrue(np.isnan(r.iloc[0]));q.iloc[9]=1;r,n=daily_runoff(q,1);self.assertAlmostEqual(r.iloc[0],86.4)
 def test_apply_nonlinear_rating_before_mean(self):
  h=np.tile([1.,3.],48);q=pd.Series(rating_predict(h,[0,2,0]),index=pd.date_range('2026-01-01',periods=96,freq='15min',tz=PST));r,_=daily_runoff(q,1);self.assertAlmostEqual(r.iloc[0],5*86.4);self.assertNotAlmostEqual(r.iloc[0],4*86.4)
 def test_recover_known_rating(self):
  h=np.linspace(.03,.4,30);expected=[1.2,2.4,.01];q=rating_predict(h,expected);fit=fit_rating(h,q);np.testing.assert_allclose(rating_predict(h,fit),q,rtol=1e-4)
 def test_ec_calendar_fill_rejected(self):
  with self.assertRaises(ValueError):validate_ec_times(pd.date_range('2026-05-19',periods=40,freq='D'))
  with self.assertRaises(ValueError):validate_ec_times(pd.DatetimeIndex(['2026-05-19']*4))
  np.testing.assert_allclose(validate_ec_times(pd.date_range('2026-05-19',periods=4,freq='s')),[1,1,1])
 def test_regional_pressure_preserves_good_and_recovers_signal(self):
  idx=pd.date_range('2026-01-01',periods=96,freq='30min',tz='UTC');b=pd.Series(88+np.sin(np.arange(96)/10)*.15,index=idx);s=b+1.2+np.arange(96)*.0001;hidden=s.copy();hidden.iloc[15:38]=np.nan
  result,codes=reconstruct_pressure(hidden,b);np.testing.assert_allclose(result,s,atol=1e-12);np.testing.assert_array_equal(result[hidden.notna()],hidden.dropna());self.assertTrue((codes.iloc[15:38]==2).all())
 def test_pressure_fallback_limits_and_no_edge_extension(self):
  idx=pd.date_range('2026-01-01',periods=500,freq='30min',tz='UTC');s=pd.Series(88.,index=idx);b=pd.Series(np.nan,index=idx);s.iloc[0:3]=np.nan;s.iloc[10:20]=np.nan;s.iloc[40:100]=np.nan;s.iloc[-3:]=np.nan
  r,c=reconstruct_pressure(s,b);self.assertTrue(r.iloc[10:20].notna().all());self.assertTrue((c.iloc[10:20]==1).all());self.assertTrue(r.iloc[40:100].isna().all());self.assertTrue(r.iloc[:3].isna().all());self.assertTrue(r.iloc[-3:].isna().all())
 def test_science_review_pressure_rejected(self):
  start=pd.date_range('2026-01-01',periods=4,freq='30min',tz='UTC');p=pd.DataFrame({'startDateTime':start,'endDateTime':start+pd.Timedelta('30min'),'staPresMean':[88]*4,'staPresFinalQF':[0]*4,'staPresFinalQFSciRvw':['',0,1,2]});s=pressure_series(p);self.assertEqual(s.notna().tolist(),[True,True,False,False])
 def test_reconstructed_source_flag_reaches_logger(self):
  idx=pd.date_range('2026-01-01T00:15Z',periods=3,freq='30min');s=pd.Series([88,89,90],index=idx);codes=pd.Series([0,2,0],index=idx);v,c=reconstructed_pressure_at(s,codes,pd.DatetimeIndex(['2026-01-01T00:30Z','2026-01-01T01:15Z','2026-01-01T01:30Z']));np.testing.assert_allclose(v[:2],[88.5*KPA_TO_M,90*KPA_TO_M]);self.assertEqual(c.tolist(),[2,0,9])
if __name__=='__main__':unittest.main()
