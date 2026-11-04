#!/usr/bin/env python3
"""Sample measured NEON vegetation returns for the Soap/Newt 3D atlas.

Input: classified April 2026 SOAP LAZ tiles, matching 1 m NEON DTM, and the
checksum manifest from acquisition. Every output point is a measured return;
coordinates are only quantized for delivery. Raw inputs stay outside Git.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import time
import laspy
import pandas as pd
from soap_newt_voxels import VoxelSample
import numpy as np
import rasterio
from rasterio.features import rasterize, shapes
from rasterio.transform import from_origin
from scipy.ndimage import map_coordinates
from pyproj import CRS, Transformer
from shapely.geometry import shape, mapping, box
from shapely.ops import transform, unary_union


def save(path,obj):path.write_text(json.dumps(obj,separators=(',',':'),allow_nan=False)+'\n')


def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--tiles',type=Path,required=True)
 p.add_argument('--dem',type=Path,required=True)
 p.add_argument('--sources',type=Path,required=True)
 p.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'field-sites/soap-newt/atlas/data')
 p.add_argument('--limit',type=int,default=250000)
 args=p.parse_args();out=args.output;out.mkdir(parents=True,exist_ok=True)
 terrain=json.loads((out/'terrain.json').read_text())
 left,bottom,right,top=[terrain[k] for k in ['xmin','ymin','xmax','ymax']]
 bounds=[left,bottom,right,top];origin=np.array([left,bottom,0,0],dtype=float)
 source_manifest=json.loads(args.sources.read_text());source_files={f['name']:f for f in source_manifest['files']}
 with rasterio.open(args.dem) as src:
  if src.crs.to_epsg()!=32611:raise ValueError('DTM must use EPSG:32611')
  grid=src.read(1,masked=True).astype(np.float32).filled(np.nan)
  aff=src.transform
 sampler=VoxelSample(bounds,2.,args.limit);flight_samples=[]
 class_counts=Counter();eligible_counts=Counter();excluded_heights=Counter()
 raw_total=0;crop_total=0;eligible=0;residuals=[];sources=[];withheld_count=0
 cell=10;ny=int(np.ceil((top-bottom)/cell));nx=int(np.ceil((right-left)/cell))
 seen=np.zeros((ny,nx),dtype=bool);vegetated=np.zeros((ny,nx),dtype=bool)
 t0=time.monotonic()
 for file in sorted(args.tiles.glob('*classified_point_cloud_colorized.laz')):
  if file.name not in source_files:raise ValueError('Input LAZ missing acquisition manifest')
  checksum=hashlib.file_digest(file.open('rb'),'sha256').hexdigest()
  if checksum!=source_files[file.name]['sha256']:raise ValueError('Input LAZ checksum differs from acquisition manifest')
  with laspy.open(file) as reader:
   crs=reader.header.parse_crs()
   if crs.to_epsg()!=32611:raise ValueError('Point CRS differs from matching DTM')
   sources.append(dict(source_files[file.name],point_count=reader.header.point_count,creation_date=str(reader.header.creation_date)))
   for las in reader.chunk_iterator(1000000):
    raw_total+=len(las)
    x,y,z=np.asarray(las.x),np.asarray(las.y),np.asarray(las.z)
    c=np.asarray(las.classification);withheld=np.asarray(las.withheld,dtype=bool)
    inside=(x>=left)&(x<right)&(y>=bottom)&(y<top)
    withheld_count+=int(np.sum(inside&withheld))
    use=inside&~withheld&np.isfinite(z)&~np.isin(c,[7,18])
    if not use.any():continue
    source_id=np.asarray(las.point_source_id)[use]
    x,y,z,c=[a[use] for a in [x,y,z,c]]
    crop_total+=len(x)
    class_counts.update({str(k):int(n) for k,n in zip(*np.unique(c,return_counts=True))})
    rr=np.clip(((top-y)/cell).astype(int),0,ny-1);cc=np.clip(((x-left)/cell).astype(int),0,nx-1);seen[rr,cc]=True
    col,row=(~aff)*(x,y)
    ground=map_coordinates(grid,[row-.5,col-.5],order=1,mode='constant',cval=np.nan)
    h=z-ground;valid=np.isfinite(ground)&np.isfinite(h)
    ground_mask=(c==2)&valid
    if ground_mask.any():
     residuals.append(h[ground_mask][::1000])
     idx=np.flatnonzero(ground_mask)[::50]
     flight_samples.append(np.column_stack((rr[idx]*nx+cc[idx],source_id[idx],h[idx])))
    isveg=np.isin(c,[3,4,5])&valid
    excluded_heights['below_1m']+=int(np.sum(isveg&(h<1)))
    excluded_heights['above_70m']+=int(np.sum(isveg&(h>70)))
    keep=isveg&(h>=1)&(h<=70)
    eligible+=int(keep.sum())
    if not keep.any():continue
    vegetated[rr[keep],cc[keep]]=True
    eligible_counts.update({str(k):int(n) for k,n in zip(*np.unique(c[keep],return_counts=True))})
    sampler.add(np.column_stack((x[keep],y[keep],z[keep],h[keep])))
  print(file.name,'eligible',eligible,'sample',len(sampler.points),'elapsed_s',round(time.monotonic()-t0,1),flush=True)
 points=sampler.result()
 if not len(points):raise ValueError('No eligible vegetation returns')
 ground_residual=np.concatenate(residuals)
 qa={'n':len(ground_residual),'median':float(np.median(ground_residual)),'p05':float(np.quantile(ground_residual,.05)),'p95':float(np.quantile(ground_residual,.95))}
 if abs(qa['median'])>.5:raise ValueError('Ground-return/DTM mismatch exceeds 0.5 m; do not apply an unexplained elevation shift')
 # Compare ground residuals between flight IDs in shared 10 m cells.
 frame=pd.DataFrame(np.concatenate(flight_samples),columns=['cell','flight','residual'])
 grouped=frame.groupby(['cell','flight']).residual.agg(['median','count'])
 wide=grouped[grouped['count']>=5]['median'].unstack('flight');pairs=[]
 for i,a in enumerate(wide.columns):
  for b in wide.columns[i+1:]:
   diff=(wide[a]-wide[b]).dropna()
   if len(diff)<20:continue
   pairs.append({'flight_ids':[int(a),int(b)],'shared_cells':len(diff),'median_difference_m':float(diff.median()),'p05_m':float(diff.quantile(.05)),'p95_m':float(diff.quantile(.95))})
 save(out/'flight-line-qa.json',{'method':'Every 50th valid classified ground return per source chunk, minus bilinear matching 1 m DTM. Compare per-flight median residuals within shared 10 m cells, at least 5 samples per flight per cell and 20 shared cells per pair.','sampled_ground_returns':len(frame),'pairs':pairs,'limitations':'Ground residual diagnostic only; not a complete strip-adjustment or horizontal registration assessment. Vegetation movement and differences in canopy visibility remain possible. No coordinate correction applied.'})
 # Sort by coordinates for deterministic delivery after voxel selection.
 points=points[np.lexsort((points[:,2],points[:,1],points[:,0]))]
 scale=.1;encoded=np.rint((points-origin)/scale)
 if encoded.min()<0 or encoded.max()>65535:raise ValueError('Quantized coordinates exceed uint16')
 cloud_path=out/'canopy-points.u16';encoded.astype('<u2').tofile(cloud_path)
 # Coverage means cells containing source returns, not interpolated tree crowns.
 transform_utm=from_origin(left,top,cell,cell)
 polys=[shape(g) for g,v in shapes(seen.astype('uint8'),mask=seen,transform=transform_utm) if v==1]
 coverage=unary_union(polys).intersection(box(*bounds))
 to_ll=Transformer.from_crs(32611,4326,always_xy=True).transform
 coverage_ll=transform(to_ll,coverage)
 save(out/'canopy-points-coverage.geojson',{'type':'FeatureCollection','features':[{'type':'Feature','geometry':mapping(coverage_ll),'properties':{'name':'April 2026 measured return coverage','resolution_m':10,'note':'10 m cells with one or more non-withheld source returns; not continuous canopy cover.'}}]})
 watersheds=json.loads((out/'watersheds.geojson').read_text())
 to_utm=Transformer.from_crs(4326,32611,always_xy=True).transform
 watershed_coverage=[]
 for f in watersheds['features']:
  geom=transform(to_utm,shape(f['geometry']))
  watershed_coverage.append({'name':f['properties'].get('name',f['properties'].get('id')),'observed_cell_area_fraction':min(1.0,max(0.0,coverage.intersection(geom).area/geom.area))})
 meta={
  'schema_version':1,'survey':'NEON SOAP airborne LiDAR','survey_id':'2026_SOAP_9','acquisition_date':'2026-04-06','status':'PROVISIONAL',
  'source_product':'DP1.30003.001','source_url':'https://data.neonscience.org/data-products/DP1.30003.001',
  'source_api':'https://data.neonscience.org/api/v0/data/DP1.30003.001/SOAP/2026-04',
  'source_sensor':'Riegl VQ-780 II-S','horizontal_crs':'EPSG:32611',
  'vertical_reference':'Source NEON elevations, no vertical shift applied; matching 2026_SOAP_9 DTM used to normalize heights.',
  'bounds_utm':bounds,
  'cloud':{'url':'canopy-points.u16','count':len(points),'scale':scale,'offset':origin.tolist(),
   'encoding':'uint16 little endian, interleaved easting, northing, absolute elevation, height above matching DTM',
   'classes':[3,4,5],'height_range_m':[1,70],**sampler.metadata(),
   'eligible_returns':eligible,'retained_fraction':len(points)/eligible,
   'color_stops':[[1,'#c5bb76'],[7,'#91b34e'],[20,'#4d973b'],[45,'#206038'],[70,'#133d29']]},
  'coverage':{'url':'canopy-points-coverage.geojson','cell_size_m':cell,'observed_cells':int(seen.sum()),'vegetation_return_cells':int(vegetated.sum()),'total_cells':nx*ny,'watersheds':watershed_coverage},
  'qa':{'source_returns_read':raw_total,'crop_returns_after_noise_withheld_filter':crop_total,'crop_class_counts':dict(class_counts),'eligible_class_counts':dict(eligible_counts),'excluded_height_counts':dict(excluded_heights),'withheld_crop_returns':withheld_count,'ground_minus_dtm_m':qa,'flight_line_comparison':'flight-line-qa.json'},
  'source_tiles':sources,'dtm':{'survey_id':'2026_SOAP_9','product':'DP3.30024.001','resolution_m':1,'height_sampling':'Bilinear at measured point XY; cells adjacent to nodata excluded','sha256':hashlib.file_digest(args.dem.open('rb'),'sha256').hexdigest()},
  'sha256':hashlib.file_digest(cloud_path.open('rb'),'sha256').hexdigest(),
  'notes':[
   'Every displayed point is a sampled measured airborne return classified as vegetation (LAS classes 3–5). Unclassified class 1, ground, noise, and withheld points are excluded.',
   'The source is a real point cloud, not a surface sampled from a canopy-height raster. Canopy-height shading remains a separate layer.',
   'Locations and elevations are quantized to 0.1 m for delivery; this does not imply 0.1 m survey accuracy. Spatial balancing reduces overlap-density striping; display density is not a vegetation-density estimate or tree census.',
   'Heights are source point elevation minus the matching 1 m bare-earth DTM. Ground residual statistics check alignment; no arbitrary vertical adjustment is applied.',
   'Coverage is limited to the April survey and valid matching terrain. The western scene margin is unobserved; missing areas are not filled.',
   'Raw source tiles and private access material remain outside the website repository. Exact source filenames and checksums are included for reproducibility.',
  ]}
 save(out/'canopy-points.json',meta)
 print(json.dumps({'count':len(points),'eligible':eligible,'bytes':cloud_path.stat().st_size,'ground_qa':qa,'coverage':watershed_coverage}),flush=True)

if __name__=='__main__':main()
