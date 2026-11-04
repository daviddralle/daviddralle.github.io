#!/usr/bin/env python3
"""Join pinned completion metadata by exact hole ID; retain explicit reference depths."""
import json
from pathlib import Path

def save(path,data):path.write_text(json.dumps(data,separators=(',',':'),allow_nan=False)+'\n')

def apply_completions(out):
 source_path=out/'borehole-completions.json'
 if not source_path.exists():return
 source=json.loads(source_path.read_text());records={r['hole_id']:r for r in source['records']};aliases={a['map_id']:a for a in source['aliases']}
 path=out/'infrastructure.geojson';points=json.loads(path.read_text())
 for f in points['features']:
  p=f['properties'];name=p['name'];alias=aliases.get(name);key=alias['metadata_id'] if alias else name;r=records.get(key)
  if p['type']!='borehole' or not r:continue
  if alias:
   lon,lat=f['geometry']['coordinates'][:2]
   assert abs(lon-r['longitude'])<1e-6 and abs(lat-r['latitude'])<1e-6,'Alias coordinates disagree'
  p.update(depth_m=r['display_depth_m'],depth_reference=r['display_depth_reference'],depth_method=r['display_depth_method'],depth_source=r['source_url'],depth_source_cells=r['depth_source_cells'],metadata_hole_id=key,completion=r['completion'],completion_summary=r['completion_summary'],original_drilled_depth_m=r['original_drilled_depth_m'],final_depth_from_stickup_m=r['final_stickup_depth_m'],inner_stickup_m=r['inner_stickup_m'])
  p['note']='Coordinates retain the archived GIS position. Completion metadata from the source worksheet; depths below stickup are retained separately from ground-referenced depths. Unknown ground depths are not drawn.'
  if alias:p['metadata_alias_basis']=alias['basis']
  ports=[v for v in source['ports'] if v['installation_id']==key]
  if ports:p['gas_port_metadata']='borehole-completions.json: '+str(len(ports))+' sand-pack intervals; reference datum not explicit, so intervals are listed in the inspector rather than positioned in 3D.'
 save(path,points)
 known=sum(f['properties'].get('depth_m') is not None for f in points['features'])
 path=out/'manifest.json';m=json.loads(path.read_text());m['known_completed_depths']=known;m['completion_metadata']={'file':'borehole-completions.json','source':source['source'],'policy':source['policy']};save(path,m)
 path=out/'drill-scenes.json'
 if path.exists():
  d=json.loads(path.read_text())
  for key,scene in d['scenes'].items():
   fs=[f for f in points['features'] if f['properties']['type']=='borehole' and f['properties']['site'].lower()==key]
   scene['known_depth_count']=sum(f['properties'].get('depth_m') is not None for f in fs)
  save(path,d)
 print('Applied completion metadata:',known,'ground-referenced depths')

if __name__=='__main__':apply_completions(Path(__file__).resolve().parents[1]/'field-sites/soap-newt/atlas/data')
