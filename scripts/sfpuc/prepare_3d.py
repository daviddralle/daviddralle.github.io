"""Prepare measured LiDAR returns and terrain for the SFPUC browser scene.
Requires laspy/lazrs, rasterio, scipy, pyproj, numpy; run after prepare_terrain.py.
Input cropped EPT LAZs: SFPUC_WORK/lidar/<site>.laz (see saved retrieval pipelines).
"""
import os,json,hashlib
from pathlib import Path
import numpy as np,laspy,rasterio
from scipy.ndimage import map_coordinates
from pyproj import Transformer
ROOT=Path(__file__).resolve().parents[2]/'field-sites/sfpuc/data'
WORK=Path(os.environ['SFPUC_WORK'])/'lidar'
proj=Transformer.from_crs(4326,26910,always_xy=True)
for site,group in [('sheep-camp',3),('maguire-ridge',1)]:
 out=ROOT/site/'3d';out.mkdir(exist_ok=True)
 with rasterio.open(ROOT/site/'terrain.tif') as ds:
  dem=ds.read(1);aff=ds.transform;bounds=list(ds.bounds)
  grid=dem[::2,::2].astype('<f4');grid.tofile(out/'terrain.f32')
  tm={'width':grid.shape[1],'height':grid.shape[0],'x0':aff.c+.5,'y0':aff.f-.5,'step':2,'min_m':float(dem.min()),'max_m':float(dem.max()),'url':'terrain.f32','source_resolution_m':1}
  def ground(x,y):return map_coordinates(dem,[(aff.f-y)-.5,(x-aff.c)-.5],order=1,mode='nearest')
  def inside(x,y):return (x>=bounds[0]+1)&(x<bounds[2]-1)&(y>=bounds[1]+1)&(y<bounds[3]-1)
  chunks=[];checks=[];counts={};eligible=0;total=0
  with laspy.open(WORK/f'{site}.laz') as reader:
   print(site,reader.header.parse_crs(),reader.header.point_count,flush=True)
   for las in reader.chunk_iterator(1000000):
    x=np.asarray(las.x);y=np.asarray(las.y);z=np.asarray(las.z);c=np.asarray(las.classification);valid=inside(x,y)&~np.asarray(las.withheld,dtype=bool)
    total+=int(valid.sum())
    for k,n in zip(*np.unique(c[valid],return_counts=True)):counts[str(k)]=counts.get(str(k),0)+int(n)
    g=ground(x,y);h=z-g
    v=valid&(c==2)
    checks.append(h[v][::50])
    v=valid&np.isin(c,[1,3,4,5])&(h>=.5)&(h<=85)
    eligible+=int(v.sum());chunks.append(np.column_stack((x[v],y[v],z[v],h[v])))
  cloud=np.concatenate(chunks);del chunks
  origin=[bounds[0],bounds[1],0,0]
  vox=np.floor((cloud[:,:3]-np.array(origin[:3]))/.4).astype(np.int32)
  _,idx=np.unique(vox,axis=0,return_index=True);cloud=cloud[np.sort(idx)];voxel_count=len(cloud)
  if len(cloud)>650000:cloud=cloud[np.sort(np.random.default_rng(42).choice(len(cloud),650000,replace=False))]
  enc=np.rint((cloud-origin)/.02)
  assert enc.min()>=0 and enc.max()<=65535
  enc.astype('<u2').tofile(out/'canopy.u16')
  residual=np.concatenate(checks)
  features={}
  for name in ['trees','plots','boundaries','contours']:
   fs=json.loads((ROOT/site/f'{name}.geojson').read_text())['features'];result=[]
   for f in fs:
    cs=np.asarray(f['geometry']['coordinates']);kind=f['geometry']['type']
    if kind=='Polygon':cs=cs[0]
    if kind=='Point':cs=cs[None,:]
    x,y=proj.transform(cs[:,0],cs[:,1]);z=ground(np.asarray(x),np.asarray(y))
    result.append({'id':f['properties'].get('id'),'coordinates':np.round(np.column_stack((x,y,z)),3).tolist(),'properties':{'plot':f['properties'].get('plot'),'index':f['properties'].get('index')}})
   features[name]=result
  (out/'features.json').write_text(json.dumps(features,separators=(',',':')))
  pipe=json.loads((WORK/f'{site}-pipeline.json').read_text());pipe[-1]['filename']=f'{site}.laz'
  meta={'site':site,'crs':'EPSG:26910','vertical_datum':'NAVD88 meters','vertical_exaggeration':1,'bounds_utm':bounds,'terrain':tm,'canopy':{'url':'canopy.u16','count':len(cloud),'encoding':'uint16 little endian interleaved easting,northing,elevation,height above ground; value * scale + offset','scale':.02,'offset':origin,'classes':[1,3,4,5],'height_range_m':[.5,85],'eligible_returns':eligible,'after_40cm_voxel':voxel_count,'display_limit':650000,'sampling_seed':42,'color_stops':[[0,'#c3a675'],[2,'#c5bb76'],[7,'#91b34e'],[20,'#4d973b'],[65,'#206038']]},'source':{'url':pipe[0]['filename'],'ept_resolution':.75,'retrieval_pipeline':pipe,'class_counts_in_crop':counts,'returns_in_crop':total,'ground_minus_dem_m':{'sample_count':len(residual),'median':float(np.median(residual)),'p05':float(np.quantile(residual,.05)),'p95':float(np.quantile(residual,.95))}},'notes':['Actual measured returns, not reconstructed crowns. Class 1 is unclassified and may include structures.','EPT level of detail 0.75 Web Mercator meters; additional 0.4 m voxel thinning retains one original return per voxel, then seeded random display limit.','Height above ground uses bilinear interpolation of the 1 m DEM. Terrain mesh uses every second DEM cell.','Both sites use a common horizontal coordinate reference and true meter scale; no terrain is supplied between the cutouts.','Inventory markers inherit plot GPS error and have not been snapped to canopy returns.']}
  for file in ['canopy.u16','terrain.f32','features.json']:meta.setdefault('sha256',{})[file]=hashlib.sha256((out/file).read_bytes()).hexdigest()
  (out/'scene.json').write_text(json.dumps(meta,indent=2)+'\n')
  print(site,'display',len(cloud),'ground residual',meta['source']['ground_minus_dem_m'],flush=True)
