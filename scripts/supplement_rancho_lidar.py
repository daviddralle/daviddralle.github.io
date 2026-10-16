#!/usr/bin/env python3
"""Fill the northwestern 2019 survey gap with measured 2017 NCALM data.

Run after the 2019 canopy builder, saving its products in --baseline first.
Raw inputs and the composite DEM remain in an external --work directory.
Then rebuild the atlas terrain/contours with --dem WORK/rancho-composite-dem.tif.
"""
import argparse, hashlib, json, urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import rasterio, laspy
from rasterio.warp import reproject
from rasterio.enums import Resampling
from rasterio.features import shapes, rasterize
from rasterio.transform import from_bounds
from scipy.ndimage import map_coordinates, binary_dilation
from scipy.interpolate import LinearNDInterpolator
from scipy.spatial import cKDTree
from pyproj import Transformer
from shapely.geometry import shape, mapping
from shapely.ops import transform, unary_union
from PIL import Image

ap=argparse.ArgumentParser()
ap.add_argument('--work',type=Path,required=True)
ap.add_argument('--baseline',type=Path,required=True)
ap.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'field-sites/rancho/atlas/data')
a=ap.parse_args();repo=Path(__file__).resolve().parents[1]
if a.work.resolve()==repo or repo in a.work.resolve().parents:raise ValueError('Raw sources must remain external')
raw=a.work/'fill2017';raw.mkdir(parents=True,exist_ok=True)
base='https://opentopography.s3.sdsc.edu/'
jobs=[('pc-bulk/CA17_Dietrich/'+name,raw/name) for name in ['555000_4335000.laz','556000_4335000.laz']]
jobs.append(('raster/CA17_Dietrich/CA17_Dietrich_be/2017_GND_50cm.tif',raw/'2017_GND_50cm.tif'))
def fetch(job):
    url,p=job
    if not p.exists():
        urllib.request.urlretrieve(base+url,p.with_suffix('.part'));p.with_suffix('.part').rename(p)
with ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(fetch,jobs))
def save(name,value):(a.output/name).write_text(json.dumps(value,separators=(',',':'),allow_nan=False)+'\n')
with rasterio.open(a.work/'rancho-2019-dem.tif') as dem:
    original=dem.read(1);aff=dem.transform;profile=dem.profile;crs=dem.crs
    older=np.full(original.shape,np.nan,np.float32)
    with rasterio.open(raw/'2017_GND_50cm.tif') as source:
        reproject(rasterio.band(source,1),older,src_transform=source.transform,src_crs=source.crs,
            dst_transform=aff,dst_crs=crs,dst_nodata=np.nan,resampling=Resampling.bilinear)
older[(older>10000)|~np.isfinite(older)]=np.nan
ny,nx=original.shape
ys=aff.f+(np.arange(ny)+.5)*aff.e
# The downloaded point tiles cover this northwestern missing portion.
fill=~np.isfinite(original)&np.isfinite(older)&(ys[:,None]>=4335001)
to_ll=Transformer.from_crs(crs,4326,always_xy=True).transform
to_utm=Transformer.from_crs(4326,crs,always_xy=True).transform
watershed=transform(to_utm,shape(json.loads((a.baseline/'catchments.geojson').read_text())['features'][0]['geometry']))
inside=rasterize([(mapping(watershed),1)],out_shape=original.shape,transform=aff).astype(bool)
# Small nodata holes in the provider raster can still have surveyed ground returns.
# Build a local ground-only TIN there, bounded by the ground points' convex hull
# and a 20 m maximum nearest-return distance; never extrapolate across survey edges.
repair=binary_dilation(inside,iterations=3)&~np.isfinite(original)&~np.isfinite(older)&(ys[:,None]>=4335001)
rr,cc=np.where(repair);repaired=0
if len(rr):
    tx,ty=rasterio.transform.xy(aff,rr,cc);targets=np.column_stack([tx,ty]);ground_points=[]
    lo=targets.min(axis=0)-20;hi=targets.max(axis=0)+20
    for file in sorted(raw.glob('*.laz')):
        with laspy.open(file) as reader:
            source_crs=reader.header.parse_crs()
            if source_crs.is_compound:source_crs=source_crs.sub_crs_list[0]
            proj=Transformer.from_crs(source_crs,crs,always_xy=True)
            for las in reader.chunk_iterator(1000000):
                x,y=proj.transform(np.asarray(las.x),np.asarray(las.y))
                ok=(np.asarray(las.classification)==2)&~np.asarray(las.withheld,dtype=bool)&(x>=lo[0])&(x<=hi[0])&(y>=lo[1])&(y<=hi[1])
                if ok.any():ground_points.append(np.column_stack([x[ok],y[ok],np.asarray(las.z)[ok]]))
    ground_points=np.concatenate(ground_points)
    _,unique=np.unique(ground_points[:,:2],axis=0,return_index=True);ground_points=ground_points[unique]
    z=LinearNDInterpolator(ground_points[:,:2],ground_points[:,2])(targets)
    distance=cKDTree(ground_points[:,:2]).query(targets)[0];valid=np.isfinite(z)&(distance<=20)
    older[rr[valid],cc[valid]]=z[valid];repaired=int(valid.sum())
    print('2017 DEM cells reconstructed from local surveyed ground TIN:',repaired,flush=True)
fill=~np.isfinite(original)&np.isfinite(older)&(ys[:,None]>=4335001)
composite=np.where(fill,older,original)
with rasterio.open(a.work/'rancho-composite-dem.tif','w',**profile) as dst:dst.write(composite,1)
assert np.isfinite(composite[inside]).all(),'Composite DEM still misses study watershed cells'
fill_geom=unary_union([shape(g) for g,v in shapes(fill.astype('uint8'),mask=fill,transform=aff) if v==1])
# Check the seam without changing either survey's elevations.
overlap=binary_dilation(fill,iterations=20)&np.isfinite(original)&np.isfinite(older)
delta=older[overlap]-original[overlap]
seam={'n':len(delta),'median':float(np.median(delta)),'p05':float(np.quantile(delta,.05)),'p95':float(np.quantile(delta,.95))}
print('DEM seam 2017 minus 2019:',seam,flush=True)
meta=json.loads((a.baseline/'canopy.json').read_text());cloud=meta['cloud'];origin=np.array(cloud['offset']);scale=cloud['scale']
maxima=np.zeros(original.shape,np.float32);observed=np.zeros(original.shape,bool)
points=[];residuals=[];source_tiles=[];eligible=0
for file in sorted(raw.glob('*.laz')):
    with laspy.open(file) as reader:
        source_crs=reader.header.parse_crs()
        if source_crs.is_compound:source_crs=source_crs.sub_crs_list[0]
        proj=Transformer.from_crs(source_crs,crs,always_xy=True)
        source_tiles.append({'file':file.name,'url':base+'pc-bulk/CA17_Dietrich/'+file.name,'points':reader.header.point_count,'sha256':hashlib.file_digest(file.open('rb'),'sha256').hexdigest()})
        for las in reader.chunk_iterator(1000000):
            x,y=proj.transform(np.asarray(las.x),np.asarray(las.y));z=np.asarray(las.z);c=np.asarray(las.classification)
            col,row=(~aff)*(x,y);rr=np.floor(row).astype(int);cc=np.floor(col).astype(int)
            valid=(rr>=0)&(rr<ny)&(cc>=0)&(cc<nx)&~np.asarray(las.withheld,dtype=bool)&np.isin(c,[1,2,3,4,5])
            x,y,z,c,row,col,rr,cc=[v[valid] for v in [x,y,z,c,row,col,rr,cc]]
            valid=fill[rr,cc];x,y,z,c,row,col,rr,cc=[v[valid] for v in [x,y,z,c,row,col,rr,cc]]
            h=z-map_coordinates(older,[row-.5,col-.5],order=1,mode='nearest')
            valid=np.isfinite(h);x,y,z,c,h,rr,cc=[v[valid] for v in [x,y,z,c,h,rr,cc]]
            observed[rr,cc]=True;residuals.append(h[c==2][::50])
            keep=np.isin(c,[1,3,4,5])&(h>=.5)&(h<=85)
            np.maximum.at(maxima,(rr[keep],cc[keep]),h[keep]);eligible+=int(keep.sum())
            pts=np.column_stack([x[keep],y[keep],z[keep],h[keep]])
            _,idx=np.unique(np.floor((pts[:,:3]-origin[:3])/.6).astype('int32'),axis=0,return_index=True)
            points.append(pts[idx])
    print(file.name,'fill returns processed',flush=True)
pts=np.concatenate(points)
_,idx=np.unique(np.floor((pts[:,:3]-origin[:3])/.6).astype('int32'),axis=0,return_index=True);pts=pts[idx]
if len(pts)>100000:pts=pts[np.random.default_rng(2017).choice(len(pts),100000,replace=False)]
encoded=np.rint((pts-origin)/scale);assert encoded.min()>=0 and encoded.max()<=65535
original_cloud=np.fromfile(a.baseline/cloud['url'],dtype='<u2').reshape(-1,4)
np.concatenate([original_cloud,encoded.astype('<u2')]).tofile(a.output/cloud['url'])
cloud['count']=len(original_cloud)+len(pts);cloud['sample_limit']+=100000
cloud['supplement_count']=len(pts);cloud['eligible_returns']+=eligible
(south,west),(north,east)=meta['raster']['bounds'];dst_aff=from_bounds(west,south,east,north,nx,ny)
heights=np.full(original.shape,np.nan,np.float32)
reproject(np.where(observed,maxima,np.nan),heights,src_transform=aff,src_crs=crs,src_nodata=np.nan,
    dst_transform=dst_aff,dst_crs=4326,dst_nodata=np.nan,resampling=Resampling.nearest)
fill_ll=np.zeros(original.shape,'uint8')
reproject(fill.astype('uint8'),fill_ll,src_transform=aff,src_crs=crs,dst_transform=dst_aff,dst_crs=4326,resampling=Resampling.nearest)
rgba=np.array(Image.open(a.baseline/'canopy.webp').convert('RGBA'));levels=np.array([v[0] for v in cloud['color_stops']])
rgb=np.array([[int(v[1][i:i+2],16) for i in (1,3,5)] for v in cloud['color_stops']]);valid=np.isfinite(heights)&fill_ll.astype(bool)
colors=np.stack([np.interp(np.nan_to_num(heights),levels,rgb[:,i]) for i in range(3)],axis=-1)
rgba[valid,:3]=colors[valid].astype('uint8');rgba[valid,3]=np.where(heights[valid]>=.5,255,55)
Image.fromarray(rgba).save(a.output/'canopy.webp',quality=92)
coverage=json.loads((a.baseline/'canopy-coverage.geojson').read_text())
coverage['features'].append({'type':'Feature','geometry':mapping(transform(to_ll,fill_geom.simplify(1,preserve_topology=True))),
    'properties':{'kind':'coverage','id':'2017 LiDAR gap fill','source':'NCALM / OpenTopography, CA17_Dietrich','survey_dates':['2017-03-16','2017-03-17']}})
save('canopy-coverage.geojson',coverage)
full=unary_union([transform(to_utm,shape(f['geometry'])) for f in coverage['features']])
meta['survey']='2019 NCALM with 2017 northwestern gap fill'
meta['coverage']['catchment_fraction']=min(1,full.intersection(watershed).area/watershed.area)
meta['coverage']['basis']='Union of published 2019 survey footprint and 2017 DEM fill; rasterized terrain coverage is reported separately in qa.watershed_dem_valid_fraction'
meta['raster']['observed_cells']+=int(observed.sum())
meta['dem_source']='NCALM CA19_Dietrich bare-earth DEM with CA17_Dietrich northwestern gap fill, resampled to 1 m'
meta['vertical_datum']='NAVD88, meters (2019 GEOID 12B; 2017 provider NAVD88)'
residual=np.concatenate(residuals)
meta['supplement']={'survey':'2017 NCALM · Antelope Valley Ranch','survey_dates':['2017-03-16','2017-03-17'],
    'doi':'https://doi.org/10.5069/G9QC01MQ','license':'CC BY 4.0',
    'attribution':'Dietrich, W. (2019). High Resolution Mapping of Antelope Valley Ranch, CA. NCALM, distributed by OpenTopography. NSF EAR-1339015.',
    'dem_url':base+'raster/CA17_Dietrich/CA17_Dietrich_be/2017_GND_50cm.tif',
    'dem_sha256':hashlib.file_digest((raw/'2017_GND_50cm.tif').open('rb'),'sha256').hexdigest(),
    'dem_nodata_repair':{'cells':repaired,'method':'Local TIN of measured class-2 ground returns, within convex hull and 20 m maximum nearest-return distance; no vertical offsets'},
    'source_tiles':source_tiles,'point_count':len(pts),'observed_cells':int(observed.sum()),
    'ground_minus_dem_m':{'n':len(residual),'median':float(np.median(residual)),'p05':float(np.quantile(residual,.05)),'p95':float(np.quantile(residual,.95))},
    'dem_seam_2017_minus_2019_m':seam,'rule':'2017 used only where 2019 DEM is missing in northern tiles; no vertical offsets or synthetic canopy.'}
meta['qa']['watershed_dem_valid_fraction']=float(np.isfinite(composite[inside]).mean())
meta['qa']['supplement_observed_fraction_in_watershed']=float(observed[inside&fill].mean())
meta['notes']=[n for n in meta['notes'] if not n.startswith('The 2019 survey footprint')]
meta['notes'].append('2019 covers 97.4% of the study watershed. The northwestern gap uses March 2017 measured returns and the matching 2017 bare-earth DEM. This is a two-date mosaic, not a single-date canopy survey.')
meta['sha256']={name:hashlib.sha256((a.output/name).read_bytes()).hexdigest() for name in ['canopy.u16','canopy.webp']}
save('canopy.json',meta)
print(json.dumps({'cloud_count':cloud['count'],'supplement':len(pts),'coverage':meta['coverage'],'qa':meta['qa']}),flush=True)
