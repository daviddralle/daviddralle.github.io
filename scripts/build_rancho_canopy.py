#!/usr/bin/env python3
"""Publish compact canopy products from measured 2019 NCALM returns.
Raw LAZ tiles and the provider-derived DEM stay outside the public repository.
"""
import argparse,hashlib,json
from pathlib import Path
import numpy as np,laspy,rasterio
from rasterio.warp import reproject,transform_bounds
from rasterio.transform import from_bounds
from rasterio.enums import Resampling
from scipy.ndimage import map_coordinates
from pyproj import Transformer
from PIL import Image
from shapely.geometry import shape,mapping,box
from shapely.ops import transform

RAMP=[[0,'#c3a675'],[2,'#c5bb76'],[7,'#91b34e'],[20,'#4d973b'],[65,'#206038']]
ap=argparse.ArgumentParser()
ap.add_argument('--tiles',type=Path,required=True)
ap.add_argument('--dem',type=Path,required=True)
ap.add_argument('--survey-coverage',type=Path,required=True)
ap.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'field-sites/rancho/atlas/data')
a=ap.parse_args();out=a.output;out.mkdir(exist_ok=True)
def save(name,obj):(out/name).write_text(json.dumps(obj,separators=(',',':'),allow_nan=False)+'\n')
with rasterio.open(a.dem) as dem:
 grid=dem.read(1);aff=dem.transform;left,bottom,right,top=dem.bounds
 ny,nx=grid.shape;maxima=np.zeros((ny,nx),np.float32);observed=np.zeros((ny,nx),bool)
 rng=np.random.default_rng(42);pool=[];keys=[];limit=1200000;count=0;eligible=0;class_counts={};residuals=[];source=[]
 origin=np.array([left,bottom,0,0]);voxel=.6
 for file in sorted(a.tiles.glob('*.laz')):
  with laspy.open(file) as reader:
   crs=reader.header.parse_crs();horizontal=crs.sub_crs_list[0] if crs.is_compound else crs
   proj=Transformer.from_crs(horizontal,dem.crs,always_xy=True)
   source.append({'file':file.name,'url':'https://opentopography.s3.sdsc.edu/pc-bulk/CA19_Dietrich/'+file.name,'points':reader.header.point_count,'sha256':hashlib.file_digest(file.open('rb'),'sha256').hexdigest()})
   for las in reader.chunk_iterator(1000000):
    x,y=proj.transform(np.asarray(las.x),np.asarray(las.y));z=np.asarray(las.z);c=np.asarray(las.classification)
    valid=(x>=left+1)&(x<right-1)&(y>=bottom+1)&(y<top-1)&~np.asarray(las.withheld,dtype=bool)&np.isin(c,[1,2,3,4,5])
    if not valid.any():continue
    x,y,z,c=x[valid],y[valid],z[valid],c[valid];col,row=(~aff)*(x,y)
    ground=map_coordinates(grid,[row-.5,col-.5],order=1,mode='nearest');h=z-ground
    valid=np.isfinite(ground);x,y,z,c,h,col,row=[v[valid] for v in [x,y,z,c,h,col,row]]
    count+=len(x)
    for k,n in zip(*np.unique(c,return_counts=True)):class_counts[str(k)]=class_counts.get(str(k),0)+int(n)
    rr,cc=row.astype(int),col.astype(int);observed[rr,cc]=True
    residuals.append(h[c==2][::100])
    keep=np.isin(c,[1,3,4,5])&(h>=.5)&(h<=85)
    np.maximum.at(maxima,(rr[keep],cc[keep]),h[keep]);eligible+=int(keep.sum())
    cloud=np.column_stack((x[keep],y[keep],z[keep],h[keep]))
    if not len(cloud):continue
    vox=np.floor((cloud[:,:3]-origin[:3])/voxel).astype('int32')
    _,idx=np.unique(vox,axis=0,return_index=True);cloud=cloud[idx]
    priority=rng.random(len(cloud));pool.append(cloud);keys.append(priority)
    if sum(len(v) for v in pool)>limit*2:
     points=np.concatenate(pool);priority=np.concatenate(keys);idx=np.argpartition(priority,limit)[:limit]
     pool=[points[idx]];keys=[priority[idx]]
  print(file.name,'processed; crop returns',count,flush=True)
 points=np.concatenate(pool);priority=np.concatenate(keys)
 if len(points)>limit:
  idx=np.argpartition(priority,limit)[:limit];points=points[idx]
 # Remove any voxel duplicates at chunk boundaries without inventing coordinates.
 vox=np.floor((points[:,:3]-origin[:3])/voxel).astype('int32');_,idx=np.unique(vox,axis=0,return_index=True);points=points[np.sort(idx)]
 scale=.1;encoded=np.rint((points-origin)/scale)
 assert encoded.min()>=0 and encoded.max()<=65535
 encoded.astype('<u2').tofile(out/'canopy.u16')
 # Project the measured 1 m maximum-return heights to the image overlay grid.
 bounds=transform_bounds(dem.crs,4326,*dem.bounds);dst_aff=from_bounds(*bounds,nx,ny)
 heights=np.full((ny,nx),np.nan,np.float32);source_chm=np.where(observed,maxima,np.nan)
 reproject(source_chm,heights,src_transform=aff,src_crs=dem.crs,src_nodata=np.nan,dst_transform=dst_aff,dst_crs=4326,dst_nodata=np.nan,resampling=Resampling.nearest)
 levels=np.array([v[0] for v in RAMP]);rgb=np.array([[int(v[1][i:i+2],16) for i in (1,3,5)] for v in RAMP])
 valid=np.isfinite(heights);v=np.nan_to_num(heights)
 colors=np.stack([np.interp(v,levels,rgb[:,i]) for i in range(3)],axis=-1)
 Image.fromarray(np.dstack((colors.astype('uint8'),np.where(valid,np.where(v>=.5,255,55),0).astype('uint8')))).save(out/'canopy.webp',quality=92)
 coverage=json.loads(a.survey_coverage.read_text());survey=shape(coverage.get('geometry',coverage))
 to_ll=Transformer.from_crs(26910,4326,always_xy=True).transform
 survey=survey.intersection(transform(to_ll,box(left,bottom,right,top)))
 save('canopy-coverage.geojson',{'type':'FeatureCollection','features':[{'type':'Feature','geometry':mapping(survey),'properties':{'kind':'coverage','id':'2019 LiDAR coverage','source':'NCALM / OpenTopography, CA19_Dietrich'}}]})
 watershed=shape(json.loads((out/'catchments.geojson').read_text())['features'][0]['geometry'])
 to_utm=Transformer.from_crs(4326,26910,always_xy=True).transform
 watershed=transform(to_utm,watershed);survey_utm=transform(to_utm,survey)
 residual=np.concatenate(residuals)
 meta={'survey':'2019 NCALM · Antelope Valley Ranch','survey_dates':['2019-04-16','2019-04-17'],'doi':'https://doi.org/10.5069/G9FX77MW','license':'CC BY 4.0','attribution':'Dietrich, W. (2021). Repeat Mapping of Antelope Valley Ranch, CA, 2019. NCALM, distributed by OpenTopography. NCALM acquisition and processing supported by NSF EAR-1339015.','horizontal_crs':'EPSG:26910 (transformed from provider EPSG:6339)','vertical_datum':'NAVD88 (GEOID 12B), meters','dem_source':'NCALM CA19_Dietrich bare-earth 0.25 m raster, resampled to 1 m','raster':{'url':'canopy.webp','bounds':[[bounds[1],bounds[0]],[bounds[3],bounds[2]]],'width':nx,'height':ny,'cell_size_m':1,'statistic':'Maximum eligible return height above matching bare-earth DEM per 1 m cell; no crown interpolation','nodata':'Cells without measured returns are transparent; ground-only cells are lightly tinted to reveal the LiDAR hillshade','observed_cells':int(observed.sum())},'cloud':{'url':'canopy.u16','count':len(points),'scale':scale,'offset':origin.tolist(),'encoding':'uint16 little endian, interleaved easting, northing, elevation, height above ground','classes':[1,3,4,5],'height_range_m':[.5,85],'voxel_m':voxel,'sample_limit':limit,'seed':42,'eligible_returns':eligible,'color_stops':RAMP},'coverage':{'url':'canopy-coverage.geojson','catchment_fraction':survey_utm.intersection(watershed).area/watershed.area},'qa':{'crop_returns':count,'class_counts':class_counts,'ground_minus_dem_m':{'n':len(residual),'median':float(np.median(residual)),'p05':float(np.quantile(residual,.05)),'p95':float(np.quantile(residual,.95))}},'source_tiles':source,'notes':['Each 3D point is a sampled measured return; coordinates are quantized to 0.1 m for browser delivery. No synthetic crowns.','Class 1 is unclassified, predominantly vegetation above ground; this is not a tree-species or mortality inventory.','The 2019 survey footprint covers most of Mountain House. Unobserved areas remain unfilled and the footprint is available as a layer.','Terrain, borehole collars, contours, point elevations and canopy heights use the matching survey DEM reference, with no elevation offsets.']}
 meta['sha256']={name:hashlib.sha256((out/name).read_bytes()).hexdigest() for name in ['canopy.u16','canopy.webp']}
 save('canopy.json',meta)
 print(json.dumps({'cloud':len(points),'ground_check':meta['qa']['ground_minus_dem_m'],'coverage':meta['coverage']}),flush=True)
