#!/usr/bin/env python3
"""Cache quality-flagged NEON SOAP pressure; publish no credentials or signed URLs."""
import argparse,csv,json,os,tempfile
from pathlib import Path
from update_soap_newt_observations import Client,atomic_json,utc_now

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);p.add_argument('--cache',type=Path,default=Path.home()/'.cache/soap-newt-pressure');p.add_argument('--token-file',type=Path,default=Path.home()/'.config/soap-newt/neon-token');a=p.parse_args()
 if a.token_file.stat().st_mode&0o077:raise ValueError('Private token permissions required')
 c=Client(a.token_file.read_text().strip(),a.cache)
 for site,position,stem in [('SOAP','000.025','neon-pressure'),('BIGC','200.000','neon-pressure-bigc')]:
  product=next(x for x in c.api('sites/'+site)['dataProducts'] if x['dataProductCode']=='DP1.00004.001');months=sorted(m for m in product['availableMonths'] if m>='2023-10');records=[];sources=[]
  for month in months:
   info=c.api('data/DP1.00004.001/'+site+'/'+month+'?package=basic')
   files=[f for f in info['files'] if '.'+position+'.030.BP_30min.' in f['name']];varfiles=[f for f in info['files'] if '.variables.' in f['name'] and f['name'].endswith('.csv')]
   if len(files)!=1 or len(varfiles)!=1:raise ValueError('Ambiguous pressure stream or variables')
   variables,vsrc=c.file(varfiles[0]);unit=[v for v in variables if v['table']=='BP_30min' and v['fieldName']=='staPresMean']
   if len(unit)!=1 or unit[0]['units']!='kilopascal':raise ValueError('Pressure unit changed')
   rows,src=c.file(files[0]);sources.append(dict(src,month=month,release=info.get('release'),variable_metadata=vsrc))
   records.extend({k:r.get(k,'') for k in ['startDateTime','endDateTime','staPresMean','staPresFinalQF','staPresFinalQFSciRvw']} for r in rows)
  a.output.mkdir(parents=True,exist_ok=True);fd,tmp=tempfile.mkstemp(dir=a.output)
  try:
   with os.fdopen(fd,'w') as f:
    writer=csv.DictWriter(f,fieldnames=list(records[0]));writer.writeheader();writer.writerows(records)
   os.replace(tmp,a.output/(stem+'.csv'))
  finally:
   if os.path.exists(tmp):os.unlink(tmp)
  atomic_json(a.output/(stem+'-provenance.json'),{'product':'DP1.00004.001','site':site,'position':position,'units':'kPa','checked_at':utc_now(),'sources':sources})
  print(site,'pressure:',len(records),'intervals;',len(months),'months; latest',months[-1])
if __name__=='__main__':main()
