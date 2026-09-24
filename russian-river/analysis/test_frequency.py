import unittest,json
import numpy as np
from scipy import stats
from fit_frequency import gev_lmom,gumbel_lmom,lp3,DATA

class FrequencyTests(unittest.TestCase):
 def test_gev_recovers_known_quantile_samples(self):
  # Deterministic, dense quantile samples verify scale/location/shape conventions.
  for k in [-.2,0,.2]:
   p=(np.arange(100000)+.5)/100000
   x=stats.genextreme.ppf(p,k,loc=30000,scale=12000)
   fit,pars=gev_lmom(x)
   self.assertAlmostEqual(pars['shape'],k,delta=.001)
   self.assertAlmostEqual(pars['location'],30000,delta=5)
   self.assertAlmostEqual(pars['scale'],12000,delta=10)
   self.assertAlmostEqual(float(fit.sf(stats.genextreme.isf(.1,k,loc=30000,scale=12000))),.1,delta=.0001)
 def test_gumbel_recovers_known_distribution(self):
  p=(np.arange(100000)+.5)/100000
  d,pars=gumbel_lmom(stats.gumbel_r.ppf(p,loc=30000,scale=12000))
  self.assertAlmostEqual(pars["location"],30000,delta=5)
  self.assertAlmostEqual(pars["scale"],12000,delta=10)
 def test_lp3_uses_log_moments(self):
  x=10**np.array([3.5,4.,4.5,5.,5.5]);d,p=lp3(x)
  self.assertAlmostEqual(p['mean_log10'],4.5); self.assertAlmostEqual(p['skew'],0)
  self.assertAlmostEqual(float(d.sf(4.5)),.5)
 def test_published_curves_and_counts(self):
  d=json.loads((DATA/'flood_frequency.json').read_text())
  self.assertEqual(d['groups']['modern_all']['n'],42)
  self.assertEqual(d['groups']['modern_el_nino']['n'],14)
  self.assertEqual(d['groups']['full_all']['n'],86)
  self.assertEqual(d['groups']['full_el_nino']['n'],27)
  self.assertEqual(d['threshold']['living_floor_ft_NAVD88'],45.6)
  self.assertTrue(43<d['threshold']['gage_stage_ft']<44)
  self.assertTrue(66000<d['threshold']['hacienda_flow_cfs']<70000)
  for g in d['groups'].values():
   self.assertEqual(g['n'],len(g['peaks']));self.assertEqual(g['observed']['k'],sum(q>d['threshold']['hacienda_flow_cfs'] for q in g['peaks']))
   for name,f in g['models'].items():
    dist,_=(gev_lmom if name=='gev' else gumbel_lmom)(g['peaks'])
    self.assertTrue(np.all(np.isfinite(dist.logpdf(g['peaks']))))
    for crossing,p in zip(d['threshold']['crossings'],f['threshold_limb_probabilities']):
     self.assertAlmostEqual(float(dist.sf(crossing['flow_cfs'])),p)
    self.assertGreaterEqual(f['threshold_limb_probabilities'][1],f['threshold_limb_probabilities'][0])
    self.assertTrue(0<f['p']<1)
    self.assertTrue(0<=f['interval_95'][0]<=f['interval_95'][1]<=1)
    self.assertTrue(np.all(np.diff(f['survival'])<=1e-12))
    self.assertTrue(np.all(np.array(f['band_95'][0])<=f['band_95'][1]))
    self.assertEqual(len(f['survival']),len(d['grid_cfs']))
 def test_groups_partition_record(self):
  d=json.loads((DATA/'flood_frequency.json').read_text())
  a=set(d['groups']['modern_el_nino']['years']);b=set(d['groups']['modern_other']['years'])
  self.assertFalse(a&b);self.assertEqual(a|b,set(range(1984,2026)))
if __name__=='__main__':unittest.main()
