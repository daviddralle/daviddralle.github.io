"""Bounded-memory, density-balanced selection of actual LiDAR returns."""
import numpy as np


def hash64(code):
 with np.errstate(over='ignore'):
  z=np.asarray(code,dtype=np.uint64)+np.uint64(0x9e3779b97f4a7c15)
  z=(z^(z>>np.uint64(30)))*np.uint64(0xbf58476d1ce4e5b9)
  z=(z^(z>>np.uint64(27)))*np.uint64(0x94d049bb133111eb)
  return z^(z>>np.uint64(31))


class VoxelSample:
 """One measured return nearest each occupied voxel centre, then a voxel hash cap.

 Hash ranking depends on voxel location, never return count. No centroid replaces
 a measurement. A falling hash cutoff allows exact streaming selection.
 """
 def __init__(self,bounds,size,limit):
  self.origin=np.array([bounds[0],bounds[1],0.]);self.size=size;self.limit=limit
  self.nx=int(np.ceil((bounds[2]-bounds[0])/size))+1
  self.ny=int(np.ceil((bounds[3]-bounds[1])/size))+1
  self.points=np.empty((0,4));self.codes=np.empty(0,dtype=np.int64)
  self.cut=np.iinfo(np.uint64).max
 def identify(self,points):
  ijk=np.floor((points[:,:3]-self.origin)/self.size).astype(np.int64)
  codes=(ijk[:,2]*self.ny+ijk[:,1])*self.nx+ijk[:,0]
  distance=((points[:,:3]-(self.origin+(ijk+.5)*self.size))**2).sum(axis=1)
  return codes,distance
 def add(self,points):
  if not len(points):return
  codes,_=self.identify(points);keep=hash64(codes)<=self.cut
  points=np.concatenate([self.points,points[keep]])
  codes,distance=self.identify(points)
  # Coordinate tie-breaks keep the result independent of source/chunk order.
  order=np.lexsort((points[:,3],points[:,2],points[:,1],points[:,0],distance,codes))
  points,codes=points[order],codes[order]
  keep=np.r_[True,codes[1:]!=codes[:-1]];points,codes=points[keep],codes[keep]
  priorities=hash64(codes)
  if len(points)>self.limit:
   keep=np.argpartition(priorities,self.limit-1)[:self.limit]
   points,codes,priorities=points[keep],codes[keep],priorities[keep]
   self.cut=priorities.max()
  self.points,self.codes=points,codes
 def result(self):
  p=self.points
  return p[np.lexsort((p[:,2],p[:,1],p[:,0]))]
 def metadata(self):
  return {'sampling':'One measured return nearest each occupied 3D voxel centre; occupied voxels selected by deterministic spatial hash if over the display limit. No synthetic points, coordinate shifts or gap filling.',
          'voxel_size_m':self.size,'voxel_origin_m':self.origin.tolist(),'sample_limit':self.limit,'hash':'SplitMix64 over voxel index; deterministic, independent of return density',
          'density_note':'Display density is intentionally balanced; displayed point counts are not canopy density or biomass estimates.'}
