"""Extend only the southern 3D display margin for the photographed ranch barns.

Uses the same external composite DEM and 10 m bilinear sampling as the atlas
builder. Existing mesh elevations/validity are retained exactly. No catchment,
well, canopy return or 2D map product changes.
"""
import argparse,json
from pathlib import Path
import numpy as np
import rasterio
from rasterio.transform import from_bounds
from rasterio.warp import reproject,Resampling
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--dem',type=Path,required=True);p.add_argument('--data',type=Path,default=Path(__file__).resolve().parents[1]/'field-sites/rancho/atlas/data');a=p.parse_args()
file=a.data/'terrain.json';t=json.loads(file.read_text());x0,y0,x1,y1=t['bounds'];bottom=4332490
if y0<=bottom:raise SystemExit('Southern context margin already present.')
extra=int((y0-bottom)/10);rows=np.full((extra,t['nx']),np.nan,dtype=np.float32)
with rasterio.open(a.dem) as dem:
 reproject(rasterio.band(dem,1),rows,src_transform=dem.transform,src_crs=dem.crs,dst_transform=from_bounds(x0-5,bottom-5,x1+5,y0-5,t['nx'],extra),dst_crs=dem.crs,dst_nodata=np.nan,resampling=Resampling.bilinear)
valid=np.isfinite(rows)
# Invalid context cells are masked, never presented as measured terrain.
filled=np.where(valid,rows,np.array(t['elevation_m'][-1])[None,:])
t['elevation_m']+=np.round(filled,1).tolist();t['valid']+=valid.astype('uint8').tolist();t['ny']+=extra;t['bounds'][1]=bottom
t['context_note']='Southern display margin extended 10 m for photo-modeled ranch buildings; same composite DEM and 10 m sampling.'
file.write_text(json.dumps(t,separators=(',',':'))+'\n')
grid=np.array(t['elevation_m']);gy,gx=np.gradient(grid,10,10);light=np.clip((.65-gx*.5+gy*.5)/np.sqrt(1+gx*gx+gy*gy),.15,1)
rgb=np.clip(np.array([180,180,180])[None,None,:]*(.3+.8*light[:,:,None]),0,255).astype('uint8')
Image.fromarray(rgb).save(a.data/'terrain-texture.jpg',quality=95)
print(f'Added {extra} DEM row(s); {valid.sum()} measured vertices. Existing elevations retained.')
