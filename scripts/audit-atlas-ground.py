"""Rebuild displayed elevations from the exact rendered LiDAR triangle mesh."""
from pathlib import Path
import json,struct,math
root=Path(__file__).resolve().parents[1]/'field-sites/rivendell/atlas/data'
meta=json.loads((root/'3d/scene.json').read_text());tm=meta['terrain'];origin=meta['origin_utm_e_n_z']
heights=struct.unpack('<'+'f'*(tm['width']*tm['height']),(root/'3d/terrain.f32').read_bytes())
def ground(x,z):
 c=(x+origin[0]-tm['x0'])/tm['step'];r=(tm['y0']-origin[1]+z)/tm['step']
 assert 0<=c<=tm['width']-1 and 0<=r<=tm['height']-1,(c,r)
 i=min(math.floor(c),tm['width']-2);j=min(math.floor(r),tm['height']-2);x=c-i;y=r-j;k=j*tm['width']+i
 a,b,e,d=[heights[v] for v in [k,k+1,k+tm['width'],k+tm['width']+1]]
 return a+x*(b-a)+y*(e-a) if x+y<=1 else d+(1-x)*(e-d)+(1-y)*(b-d)
features=json.loads((root/'3d/features.json').read_text());output={};changes=[]
for lid,fs in features.items():
 for f in fs:
  if f['geometry']['type']!='Point':continue
  x,y,z=f['geometry']['coordinates'];height=ground(x,z);changes.append(abs(height-origin[2]-y));output[lid+':'+f['uid']]=round(height,3)
for f in json.loads((root/'vms_bores.geojson').read_text())['features']:
 p=f['properties'];e,n,z=p['trajectory_utm_e_n_z'][0];output['vms_bores:'+p['uid']]=round(ground(e-origin[0],origin[1]-n),3)
(root/'ground-elevations.json').write_text(json.dumps(output,separators=(',',':'))+'\n')
print(json.dumps({'point_count':len(changes),'all_inside_lidar_mesh':True,'max_change_from_cached_bilinear_elevation_m':max(changes),'mean_change_m':sum(changes)/len(changes),'vertical_source':meta['source']['vertical'],'horizontal_positions_changed':False},indent=2))
