import unittest
import numpy as np
from soap_newt_voxels import VoxelSample

class TestVoxelSample(unittest.TestCase):
 def test_density_and_streaming(self):
  rng=np.random.default_rng(3);p=np.column_stack([rng.uniform(0,100,(10000,3)),rng.uniform(1,70,10000)])
  a=VoxelSample([0,0,100,100],2,300);a.add(p)
  b=VoxelSample([0,0,100,100],2,300)
  duplicated=np.concatenate([p,p[:3000],p[:3000]])
  rng.shuffle(duplicated)
  for block in np.array_split(duplicated,31):b.add(block)
  np.testing.assert_array_equal(a.result(),b.result())
  self.assertEqual(len(a.result()),300)
  self.assertEqual(len(np.unique(a.identify(a.result())[0])),300)
  original=set(map(tuple,p));self.assertTrue(all(tuple(row) in original for row in a.result()))
 def test_preserve_gaps(self):
  a=VoxelSample([0,0,20,20],1,100)
  p=np.array([[.1,.2,4,2],[.4,.4,4.4,2.4],[19.,19.,5.,3.]])
  a.add(p);self.assertEqual(len(a.result()),2)
  self.assertTrue(np.array_equal(a.result()[0],p[1]))

if __name__=='__main__':unittest.main()
