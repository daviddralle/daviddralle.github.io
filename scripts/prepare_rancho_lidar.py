#!/usr/bin/env python3
"""Retrieve the matching point tiles and bare-earth DEM for Mountain House."""
from pathlib import Path
import xml.etree.ElementTree as ET,urllib.request
from concurrent.futures import ThreadPoolExecutor
import rasterio,numpy as np
from rasterio.warp import reproject
from rasterio.transform import from_origin
from rasterio.enums import Resampling
import argparse
ap=argparse.ArgumentParser(description='Retrieve public 2019 NCALM data to an external working folder')
ap.add_argument('--work',type=Path,required=True)
a=ap.parse_args();repo=Path(__file__).resolve().parents[1]
if a.work.resolve()==repo or repo in a.work.resolve().parents:
 raise ValueError('Raw LiDAR must be stored outside the public repository')
root=a.work/'source';root.mkdir(parents=True,exist_ok=True)
base='https://opentopography.s3.sdsc.edu/'
if not (root/'terrain.vrt').exists():urllib.request.urlretrieve(base+'raster/CA19_Dietrich/CA19_Dietrich_be.vrt',root/'terrain.vrt')
with ThreadPoolExecutor(max_workers=3) as pool:
 def fetch_points(name):
  p=root/name
  if not p.exists():
   urllib.request.urlretrieve(base+'pc-bulk/CA19_Dietrich/'+name,p.with_suffix('.part'));p.with_suffix('.part').rename(p)
  return name
 for name in pool.map(fetch_points,[f'{x}_{y}.laz' for x in [555000,556000,557000] for y in [4332000,4333000,4334000,4335000]]):print(name,flush=True)
coverage='https://raw.githubusercontent.com/OpenTopography/Data_Catalog_Spatial_Boundaries/main/OpenTopography_Point_Cloud_Lidar/CA19_Dietrich.geojson'
urllib.request.urlretrieve(coverage,a.work/'survey-coverage.geojson')
tree=ET.parse(root/'terrain.vrt');top=tree.getroot();gt=list(map(float,top.findtext('GeoTransform').split(',')))
bounds=[555700,4332480,557200,4335800]
# Download only 500 m raster tiles overlapping the target, leaving raw data external.
keep=[]
for src in top.findall('.//ComplexSource'):
 d=src.find('DstRect').attrib;x=gt[0]+int(d['xOff'])*gt[1];y=gt[3]+int(d['yOff'])*gt[5]
 if x+int(d['xSize'])*gt[1]<bounds[0] or x>bounds[2] or y<bounds[1] or y+int(d['ySize'])*gt[5]>bounds[3]:
  top.find('VRTRasterBand').remove(src);continue
 keep.append(src.findtext('SourceFilename'))
def fetch(name):
 p=root/name;p.parent.mkdir(exist_ok=True)
 if not p.exists():urllib.request.urlretrieve('https://opentopography.s3.sdsc.edu/raster/CA19_Dietrich/'+name,p)
 return name
with ThreadPoolExecutor(max_workers=4) as pool:
 for name in pool.map(fetch,keep):print(name,flush=True)
tree.write(root/'crop.vrt')
aff=from_origin(bounds[0],bounds[3],1,1)
dest=np.full((bounds[3]-bounds[1],bounds[2]-bounds[0]),np.nan,np.float32)
with rasterio.open(root/'crop.vrt') as ds:
 reproject(rasterio.band(ds,1),dest,src_transform=ds.transform,src_crs=ds.crs,dst_transform=aff,dst_crs='EPSG:26910',dst_nodata=np.nan,resampling=Resampling.bilinear)
dest[(dest>10000)|~np.isfinite(dest)]=np.nan
with rasterio.open(a.work/'rancho-2019-dem.tif','w',driver='GTiff',width=dest.shape[1],height=dest.shape[0],count=1,dtype='float32',transform=aff,crs='EPSG:26910',nodata=np.nan,compress='deflate') as out:out.write(dest,1)
print('DEM ready',dest.shape,'valid',np.isfinite(dest).mean(),flush=True)
