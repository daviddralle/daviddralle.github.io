import copy, unittest
from ingest_telemetry import parse_file, merge_usb_overlap, add_top_clock_basis
from test_telemetry import toa
class USBRecovery(unittest.TestCase):
 def test_signature_changed_but_retained_values_match(self):
  _,t=parse_file(toa(), 'top_sap_usb_20261112.dat','2026-11-12T21:34:00Z')
  old=copy.deepcopy(t['records'][0]);old['program_signature']='older';old['source_file']='top_sap_pakbus_generation_2.dat'
  t['records'].append(old);issues=[];merge_usb_overlap(t,issues)
  self.assertEqual(len(t['records']),1);self.assertFalse(issues)
  self.assertEqual(t['records'][0]['duplicate_sources'][0]['program_signature'],'older')
 def test_same_identity_different_values_is_not_discarded(self):
  _,t=parse_file(toa(), 'top_sap_usb_20261112.dat','2026-11-12T21:34:00Z')
  old=copy.deepcopy(t['records'][0]);old['raw']['TotalSapFlow_A']='9';old['source_file']='top_sap_old.dat';t['records'].append(old)
  issues=[];merge_usb_overlap(t,issues)
  self.assertEqual(len(t['records']),2);self.assertEqual(len(issues),1)
  self.assertTrue(all(r['flags']['source_comparison']=='conflict_requires_review' for r in t['records']))
 def test_clock_repeated_hour_keeps_original_and_distinct_pst(self):
  _,t=parse_file(toa('Hourly',record=266,stamp='2026-11-12 14:00:00'),'top_weather_usb_20261112.dat','2026-11-12T21:34:00Z')
  r=t['records'][0];r['program_signature']='64468';later=copy.deepcopy(r);later['record']=267;t['records'].append(later)
  add_top_clock_basis(t)
  self.assertEqual(r['timestamp'],'2026-11-12 14:00:00')
  self.assertEqual(r['timestamp_pst'],'2026-11-12 13:00:00')
  self.assertEqual(later['timestamp_pst'],'2026-11-12 14:00:00')
  self.assertIn('clock_adjustment',later['flags'])
if __name__=='__main__':unittest.main()
