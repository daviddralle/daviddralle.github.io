"""Summarize cached SSURGO components/horizons without filling missing values."""
import os,json,hashlib,collections
from pathlib import Path
import requests
ROOT=Path(__file__).resolve().parents[2]/'field-sites/sfpuc/data/soils'
WORK=Path(os.environ['SFPUC_WORK'])/'soils';WORK.mkdir(parents=True,exist_ok=True)
meta=json.loads((ROOT/'metadata.json').read_text());keys=','.join(meta['units']);URL=meta['service_url']
queries={
'aggregates':f'SELECT * FROM muaggatt WHERE mukey IN ({keys})',
'components':f'SELECT mukey,cokey,compname,compkind,comppct_r,majcompflag,drainagecl,hydgrp FROM component WHERE mukey IN ({keys})',
'horizons':f'SELECT c.mukey,h.cokey,h.chkey,h.hzname,h.desgnmaster,h.hzdept_r,h.hzdepb_r,h.awc_r,h.ksat_r,h.claytotal_r,h.sandtotal_r,h.om_r FROM component c INNER JOIN chorizon h ON c.cokey=h.cokey WHERE c.mukey IN ({keys})',
'restrictions':f'SELECT c.mukey,r.cokey,r.reskind,r.resdept_r FROM component c INNER JOIN corestrictions r ON c.cokey=r.cokey WHERE c.mukey IN ({keys})'}
data={};hashes={}
for name,q in queries.items():
 p=WORK/(name+'.json')
 if not p.exists():
  r=requests.post(URL,json={'query':q,'format':'JSON+COLUMNNAME'},timeout=90);r.raise_for_status();p.write_text(r.text)
 raw=json.loads(p.read_text())['Table'];data[name]=[dict(zip(raw[0],row))for row in raw[1:]];hashes[name]=hashlib.sha256(p.read_bytes()).hexdigest()
def num(v):return None if v in [None,''] else float(v)
def weighted(pairs):
 valid=[(v,w)for v,w in pairs if v is not None and w is not None and w>0];total=sum(w for v,w in valid)
 return {'value':round(sum(v*w for v,w in valid)/total,5)if total else None,'component_percent':total}
def profile_value(hs,restriction,field,limit):
 # Average only described, non-rock soil above the first restriction. A component
 # is eligible only when every centimeter through its represented interval is rated.
 bottom=max([num(h['hzdepb_r'])for h in hs if num(h['hzdepb_r']) is not None and h['desgnmaster']!='R'],default=0)
 end=min(limit,restriction if restriction is not None else bottom,bottom)
 if end<=0:return None
 intervals=[]
 for h in hs:
  if h['desgnmaster']=='R':continue
  a,b,v=num(h['hzdept_r']),num(h['hzdepb_r']),num(h[field])
  if a is None or b is None or v is None:continue
  a,b=max(0,a),min(end,b)
  if b>a:intervals.append((a,b,v))
 intervals.sort();last=0;total=0
 for a,b,v in intervals:
  if abs(a-last)>1e-5:return None # Do not bridge missing or overlapping horizons.
  total+=(b-a)*v;last=b
 if abs(last-end)>1e-5:return None
 return total/end
summaries={}
for key in meta['units']:
 comps=[]
 for c in data['components']:
  if c['mukey']!=key:continue
  hs=[h for h in data['horizons']if h['cokey']==c['cokey']];rs=[r for r in data['restrictions']if r['cokey']==c['cokey'] and num(r['resdept_r']) is not None]
  first=min(rs,key=lambda r:num(r['resdept_r']))if rs else None;depth=num(first['resdept_r'])if first else None
  item={'name':c['compname'],'percent':num(c['comppct_r']),'major':c['majcompflag'].strip()=='Yes','restriction_cm':depth,'restriction_kind':first['reskind']if first else None,'described_profile_cm':max([num(h['hzdepb_r'])for h in hs if num(h['hzdepb_r']) is not None],default=None),'awc_0_100':profile_value(hs,depth,'awc_r',100),'clay_0_30':profile_value(hs,depth,'claytotal_r',30),'om_0_30':profile_value(hs,depth,'om_r',30)}
  comps.append(item)
 agg=next((a for a in data['aggregates']if a['mukey']==key),{})
 stats={field:weighted([(c[field],c['percent'])for c in comps])for field in ['restriction_cm','described_profile_cm','awc_0_100','clay_0_30','om_0_30']}
 stats.update(aws_0_100_mm=None if num(agg.get('aws0100wta')) is None else num(agg['aws0100wta'])*10,aws_0_150_mm=None if num(agg.get('aws0150wta')) is None else num(agg['aws0150wta'])*10,bedrock_min_cm=num(agg.get('brockdepmin')),drainage=agg.get('drclassdcd'),hydrologic_group=agg.get('hydgrpdcd'))
 summaries[key]={'statistics':stats,'components':sorted(comps,key=lambda c:-(c['percent']or 0))}
 # Depth and capacity ranges are checks, not imputations.
 assert all(c['awc_0_100'] is None or 0<=c['awc_0_100']<=1 for c in comps)
 assert sum(c['percent']or 0 for c in comps)<=100.01
out={'source_url':meta['source_url'],'retrieved':'2026-10-14','units':summaries,'queries':queries,'source_hashes':hashes,'methods':{
'averages':'Representative component percentages weight the rated component values, renormalized over components with data. Every derived mean includes the sum of component percentages represented. Missing values remain null; they are never zero-filled.',
'restriction_cm':'First reported restriction per component; percentage-weighted mean only over components with a reported restriction. This conditional mean is not whole-unit soil thickness. No restriction record does not establish unlimited depth.',
'described_profile_cm':'Deepest described horizon bottom per component, including rock horizons if present. Describes database coverage, not soil thickness or bedrock depth.',
'awc_0_100':'Within each component, thickness-weight awc_r over described non-rock soil in the upper 100 cm, stopping at the first reported restriction or described profile bottom. Require continuous rated horizons over that interval. Then percentage-weight the component means. Units cm water / cm soil.',
'clay_0_30':'Same averaging as AWC over the upper 30 cm using claytotal_r, percent of the fine-earth fraction.',
'om_0_30':'Same averaging as AWC over the upper 30 cm using om_r, percent organic matter by weight.',
'aws':'NRCS muaggatt.aws0100wta and aws0150wta, multiplied by 10 to convert cm of water to mm. These are agency map-unit weighted water-storage summaries, separate from our AWC averaging. They do not include weathered-bedrock water.',
'bedrock_min_cm':'NRCS muaggatt.brockdepmin: shallowest bedrock depth among components comprising at least 15 percent of the map unit; not an average.',
'drainage':'Dominant-condition drainage and hydrologic group from NRCS muaggatt.'},'metadata_reference':'https://www.nrcs.usda.gov/sites/default/files/2022-08/SSURGO-Metadata-Table-Column-Descriptions-Report.pdf'}
(ROOT/'properties.json').write_text(json.dumps(out,indent=2,allow_nan=False)+'\n')
for key in ['456606','2747731']:print(meta['units'][key]['muname'],summaries[key]['statistics'])
