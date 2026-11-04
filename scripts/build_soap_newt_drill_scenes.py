#!/usr/bin/env python3
"""Build small, measured terrain/vegetation crops around the two drilled areas.
Raw NEON tiles stay outside Git. No depths or subsurface stratigraphy inferred.
"""
import argparse, hashlib, json
from pathlib import Path
import numpy as np
import rasterio
from rasterio.windows import from_bounds
from PIL import Image
from pyproj import Transformer
from scipy.ndimage import map_coordinates
import laspy
import contourpy


def save(path,obj): path.write_text(json.dumps(obj,separators=(',',':'),allow_nan=False)+'\n')

def hillshade_texture(z):
 """Contrast-stretched multidirectional shading of the unmodified 1 m DTM."""
 gy,gx=np.gradient(z)
 normal_length=np.sqrt(1+gx*gx+gy*gy)
 altitude=np.deg2rad(35)
 shade=np.zeros_like(z)
 for azimuth,weight in [(315,.6),(45,.25),(270,.15)]:
  az=np.deg2rad(azimuth)
  illumination=(-gx*np.sin(az)*np.cos(altitude)+gy*np.cos(az)*np.cos(altitude)+np.sin(altitude))/normal_length
  shade+=weight*np.clip(illumination,0,1)
 lo,hi=np.nanpercentile(shade,[2,98])
 relief=np.clip((shade-lo)/max(hi-lo,1e-6),0,1)
 gray=np.uint8((.14+.82*relief)*255)
 return np.dstack([gray,gray,gray,np.uint8(np.isfinite(z)*255)])


def crop_contours(terrain):
 z=np.array(terrain['elevations'],float).reshape(terrain['height'],terrain['width'])
 x=terrain['xmin']+np.arange(terrain['width']);y=terrain['ymax']-np.arange(terrain['height'])
 cg=contourpy.contour_generator(x=x,y=y,z=z);to_ll=Transformer.from_crs(32611,4326,always_xy=True)
 features=[]
 for elevation in np.arange(np.ceil(np.nanmin(z)/2)*2,np.nanmax(z),2):
  for line in cg.lines(elevation):
   if len(line)<3 or np.linalg.norm(np.diff(line,axis=0),axis=1).sum()<5:continue
   lon,lat=to_ll.transform(line[:,0],line[:,1])
   features.append({'type':'Feature','properties':{'elevation_m':int(elevation),'index':bool(elevation%10==0),'source':'Native 1 m NEON 2026_SOAP_9 DTM'},'geometry':{'type':'LineString','coordinates':np.column_stack([lon,lat]).round(8).tolist()}})
 return {'type':'FeatureCollection','features':features}


def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--dem',type=Path,required=True);p.add_argument('--tiles',type=Path,required=True)
 p.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'field-sites/soap-newt/atlas/data')
 args=p.parse_args();out=args.output;to_xy=Transformer.from_crs(4326,32611,always_xy=True)
 points=json.loads((out/'infrastructure.geojson').read_text())['features']
 source=json.loads((out/'canopy-points.json').read_text());scenes={}
 with rasterio.open(args.dem) as dem:
  assert dem.crs.to_epsg()==32611
  for site in ['Soap','Newt']:
   fs=[f for f in points if f['properties']['site']==site and f['properties']['type']=='borehole']
   xy=np.array([to_xy.transform(*f['geometry']['coordinates'][:2]) for f in fs]);pad=25
   left,bottom=np.floor((xy.min(axis=0)-pad)/2)*2;right,top=np.ceil((xy.max(axis=0)+pad)/2)*2
   # Pixel centres are the mesh nodes, preserving the native 1 m source grid.
   win=from_bounds(left,bottom,right,top,dem.transform).round_offsets().round_lengths()
   z=dem.read(1,window=win,masked=True).astype(float).filled(np.nan);aff=dem.window_transform(win)
   H,W=z.shape;x0,y0=aff*(.5,.5);right=x0+W-1;bottom=y0-H+1
   img=hillshade_texture(z)
   Image.fromarray(img).save(out/f'{site.lower()}-drill-texture.webp',lossless=True)
   meta={'crs':'EPSG:32611','width':W,'height':H,'xmin':x0,'ymax':y0,'xmax':right,'ymin':bottom,'cell_size':1,'elevations':[round(v,2) if np.isfinite(v) else None for v in z.ravel()], 'min_elevation_m':float(np.nanmin(z)),'max_elevation_m':float(np.nanmax(z)),'texture':f'{site.lower()}-drill-texture.webp','source':'NEON 2026_SOAP_9 DTM; native 1 m crop; no elevation shift','acquisition_date':'2026-04-06'}
   save(out/f'{site.lower()}-drill-terrain.json',meta)
   save(out/f'{site.lower()}-drill-contours.geojson',crop_contours(meta))
   scenes[site.lower()]={'name':site+' boreholes','contours':f'{site.lower()}-drill-contours.geojson','bounds_utm':[x0,bottom,right,y0],'terrain':f'{site.lower()}-drill-terrain.json','canopy':f'{site.lower()}-drill-canopy.json','borehole_count':len(fs),'known_depth_count':sum(f['properties'].get('depth_m') is not None for f in fs),'terrain_resolution_m':1,'grid':z,'aff':aff,'points':np.empty((0,4)),'keys':np.empty(0),'eligible':0,'rng':np.random.default_rng(20261104),'sources':[]}
 for file in sorted(args.tiles.glob('*classified_point_cloud_colorized.laz')):
  with laspy.open(file) as reader:
   b=reader.header;targets=[s for s in scenes.values() if not(b.maxs[0]<s['bounds_utm'][0] or b.mins[0]>s['bounds_utm'][2] or b.maxs[1]<s['bounds_utm'][1] or b.mins[1]>s['bounds_utm'][3])]
   if not targets:continue
   src=next(x for x in source['source_tiles'] if x['name']==file.name)
   assert hashlib.file_digest(file.open('rb'),'sha256').hexdigest()==src['sha256']
   for s in targets:s['sources'].append(src)
   for las in reader.chunk_iterator(1000000):
    x,y,z=np.asarray(las.x),np.asarray(las.y),np.asarray(las.z);valid=np.isin(np.asarray(las.classification),[3,4,5])&~np.asarray(las.withheld,dtype=bool)
    for s in targets:
     l,b,r,t=s['bounds_utm'];use=valid&(x>=l)&(x<=r)&(y>=b)&(y<=t)
     if not use.any():continue
     xx,yy,zz=x[use],y[use],z[use];col,row=(~s['aff'])*(xx,yy)
     ground=map_coordinates(s['grid'],[row-.5,col-.5],order=1,mode='constant',cval=np.nan);h=zz-ground;good=np.isfinite(h)&(h>=1)&(h<=70)
     cloud=np.column_stack((xx[good],yy[good],zz[good],h[good]));s['eligible']+=len(cloud)
     s['points']=np.concatenate([s['points'],cloud]);s['keys']=np.concatenate([s['keys'],s['rng'].random(len(cloud))])
     if len(s['points'])>150000:
      idx=np.argpartition(s['keys'],149999)[:150000];s['points']=s['points'][idx];s['keys']=s['keys'][idx]
   print(file.name,'cropped',flush=True)
 for name,s in scenes.items():
  cloud=s.pop('points');s.pop('keys');s.pop('grid');s.pop('aff');s.pop('rng');origin=np.array([s['bounds_utm'][0],s['bounds_utm'][1],0,0]);encoded=np.rint((cloud-origin)/.1)
  assert len(cloud)>0 and encoded.min()>=0 and encoded.max()<=65535
  url=f'{name}-drill-canopy.u16';encoded.astype('<u2').tofile(out/url)
  meta={k:source[k] for k in ['survey','survey_id','acquisition_date','status','source_product','source_url','horizontal_crs','vertical_reference']}
  meta.update(bounds_utm=s['bounds_utm'],source_tiles=s.pop('sources'),cloud=dict(source['cloud'],url=url,count=len(cloud),offset=list(origin),eligible_returns=s.pop('eligible'),sample_limit=150000,seed=20261104))
  meta['cloud']['retained_fraction']=len(cloud)/meta['cloud']['eligible_returns'];save(out/s['canopy'],meta)
  s['canopy_count']=len(cloud);print(name,s,flush=True)
 save(out/'drill-scenes.json',{'schema_version':1,'acquisition_date':'2026-04-06','crop_rule':'Borehole coordinate extent plus 25 m margin; native 1 m DTM. Independent uniform sample of measured canopy returns within each crop.','scenes':scenes})

if __name__=='__main__':main()
