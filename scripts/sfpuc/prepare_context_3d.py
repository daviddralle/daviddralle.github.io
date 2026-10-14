"""Rasterize vector cartography onto the existing 2 m 3D mesh; no elevation changes."""
import json,hashlib
from pathlib import Path
import numpy as np,geopandas as gpd
from rasterio.features import rasterize
from rasterio.transform import from_origin
from shapely.ops import substring
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]/'field-sites/sfpuc/data'
layers={k:gpd.read_file(ROOT/k/'units.geojson').to_crs(26910)for k in ['geology','soils']}
meta={k:json.loads((ROOT/k/'metadata.json').read_text())for k in layers}
lines=gpd.read_file(ROOT/'geology/lines.geojson').to_crs(26910)
def cartographic_lines(frame):
 segments=[]
 for _,r in frame.iterrows():
  for line in (r.geometry.geoms if r.geometry.geom_type=='MultiLineString'else[r.geometry]):
   if r.certain:segments.append(line);continue
   on,off=(4,8)if r.concealed else(12,10)
   for start in np.arange(0,line.length,on+off):
    seg=substring(line,start,min(start+on,line.length))
    if seg.geom_type=='LineString':segments.append(seg)
 return segments

for site in ['sheep-camp','maguire-ridge']:
 out=ROOT/site/'3d/context';out.mkdir(exist_ok=True)
 tm=json.loads((ROOT/site/'3d/scene.json').read_text())['terrain'];w,h,step=tm['width'],tm['height'],tm['step'];tr=from_origin(tm['x0']-step/2,tm['y0']+step/2,step,step)
 manifest={'width':w,'height':h,'x0':tm['x0'],'y0':tm['y0'],'step':step,'crs':'EPSG:26910','notes':'Display textures and nearest-cell picking IDs rasterized from vector units on the existing 2 m terrain vertices. No added stratigraphy or inferred thickness. Geology and soil source mapping remain coarser than the mesh.','layers':{}}
 for kind,df in layers.items():
  key='unit'if kind=='geology'else'mukey';codes=sorted(set(df[key]));lookup=['']+codes
  ids=rasterize([(g,codes.index(str(code))+1)for g,code in zip(df.geometry,df[key])],out_shape=(h,w),transform=tr,dtype='uint16')
  rgba=np.zeros((h,w,4),dtype=np.uint8)
  for i,code in enumerate(lookup[1:],1):
   color=meta[kind]['units'][code]['color'].lstrip('#');rgba[ids==i]=[int(color[j:j+2],16)for j in [0,2,4]]+[255]
  boundaries=[g.boundary for g in df.geometry]if kind=='soils'else cartographic_lines(lines[lines.kind=='contact'])
  mask=rasterize([(g,1)for g in boundaries],out_shape=(h,w),transform=tr,dtype='uint8');rgba[(mask==1)&(ids>0)]=[75,78,67,255]
  Image.fromarray(rgba).save(out/(kind+'.png'));ids.astype('<u2').tofile(out/(kind+'.u16'))
  manifest['layers'][kind]={'texture':kind+'.png','ids':kind+'.u16','lookup':lookup,'unit_codes':sorted({lookup[int(i)]for i in np.unique(ids)if i}),'covered_vertices':int((ids>0).sum()),'source_sha256':hashlib.sha256((ROOT/kind/'units.geojson').read_bytes()).hexdigest()}
  assert (ids>0).all(),(site,kind,'incomplete coverage')
 # Preserve the source certainty distinction in the optional fault texture.
 segments=cartographic_lines(lines[lines.kind=='fault'])
 mask=rasterize([(g,1)for g in segments],out_shape=(h,w),transform=tr,dtype='uint8');rgba=np.zeros((h,w,4),dtype=np.uint8);rgba[mask==1]=[159,50,67,255];Image.fromarray(rgba).save(out/'faults.png')
 manifest['line_source_sha256']=hashlib.sha256((ROOT/'geology/lines.geojson').read_bytes()).hexdigest()
 (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(site,w,h,'all vertices assigned')
