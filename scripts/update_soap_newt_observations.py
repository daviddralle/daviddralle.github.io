#!/usr/bin/env python3
"""Download SOAP meteorology on the Pi, cache source CSVs, publish QA-filtered daily summaries.

Token is read from a private file and sent only as an official API header.
Raw downloads and file cache stay outside the website checkout. No signed URLs
or token material are written to output, cache manifests, or logs.
"""
import argparse
import calendar
import csv
from collections import defaultdict, Counter
from datetime import datetime, timedelta, timezone
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, HTTPSHandler, HTTPRedirectHandler, build_opener

API = 'https://data.neonscience.org/api/v0/'
CONFIG = {
 'DP1.00003.001': dict(table='TAAT_30min', variable='tempTripleMean', flag='finalQF', native_unit='celsius', unit='°C', category='Air temperature', title='Triple aspirated temperature', positions=['060']),
 'DP1.00098.001': dict(table='RH_30min', variable='RHMean', flag='RHFinalQF', native_unit='percent', unit='%', category='Relative humidity', title='Tower relative humidity', positions=['060']),
 'DP1.00001.001': dict(table='2DWSD_30min', variable='windSpeedMean', flag='windSpeedFinalQF', native_unit='metersPerSecond', unit='m/s', category='Wind speed', title='Wind speed', positions=None),
 'DP1.00045.001': dict(table='TIPPRE_30min', variable='precipBulk', flag='finalQF', native_unit='millimeter', unit='mm/day', category='Precipitation', title='Tower tipping-bucket precipitation', positions=['060']),
}


def utc_now():
 return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z')


def atomic_json(path, value):
 path.parent.mkdir(parents=True,exist_ok=True)
 fd,tmp=tempfile.mkstemp(prefix=path.name+'.',suffix='.tmp',dir=path.parent)
 try:
  with os.fdopen(fd,'w') as f:
   json.dump(value,f,separators=(',',':'),allow_nan=False);f.write('\n')
  os.replace(tmp,path)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)


class SafeRedirect(HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  if urlsplit(newurl).scheme!='https':raise ValueError('Non-HTTPS redirect rejected')
  nxt=super().redirect_request(req,fp,code,msg,headers,newurl)
  if nxt and urlsplit(newurl).netloc != urlsplit(req.full_url).netloc:
   nxt.remove_header('X-api-token')
  return nxt


class Client:
 def __init__(self,token,cache):
  self.token=token;self.cache=cache;self.cache.mkdir(parents=True,exist_ok=True)
  self.opener=build_opener(HTTPSHandler(),SafeRedirect())
  self.downloads=0;self.hits=0
 def get(self,url,api=False):
  parsed=urlsplit(url)
  if parsed.scheme!='https' or parsed.username or parsed.password:raise ValueError('Untrusted download URL')
  if api and parsed.hostname!='data.neonscience.org':raise ValueError('Token destination rejected')
  if not api and not (parsed.hostname=='data.neonscience.org' or parsed.hostname=='storage.googleapis.com' or (parsed.hostname or '').endswith('.storage.googleapis.com')):
   raise ValueError('Unexpected NEON download host')
  headers={'User-Agent':'SoapNewtAtlas/1.0'}
  if api:headers['X-API-Token']=self.token
  for attempt in range(3):
   try:
    with self.opener.open(Request(url,headers=headers),timeout=60) as r:
     return r.read()
   except HTTPError as exc:
    if exc.code not in (429,500,502,503,504) or attempt==2:raise
    delay=min(30,float(exc.headers.get('Retry-After',exc.headers.get('RetryAfter',2**(attempt+1)))))
   except (URLError,TimeoutError):
    if attempt==2:raise
    delay=2**(attempt+1)
   time.sleep(delay)
 def api(self,path):return json.loads(self.get(API+path,api=True))['data']
 def file(self,entry):
  name=entry['name']
  if Path(name).name != name or not name.endswith('.csv'):raise ValueError('Unexpected source filename')
  expected_size=int(entry['size']);md5=(entry.get('md5') or '').lower()
  if md5 and not re.fullmatch('[0-9a-f]{32}',md5):raise ValueError('Unexpected source checksum')
  path=self.cache/name
  def valid(b):return len(b)==expected_size and (not md5 or hashlib.md5(b).hexdigest()==md5)
  if path.exists() and valid(path.read_bytes()):self.hits+=1
  else:
   # Token is never sent to the signed Google Cloud URL.
   raw=self.get(entry['url'],api=urlsplit(entry['url']).hostname=='data.neonscience.org')
   if not valid(raw):raise ValueError('Source size or checksum mismatch')
   fd,tmp=tempfile.mkstemp(dir=self.cache)
   try:
    with os.fdopen(fd,'wb') as f:f.write(raw)
    os.replace(tmp,path)
   finally:
    if os.path.exists(tmp):os.unlink(tmp)
   self.downloads+=1
  raw=path.read_bytes()
  return list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))), {'name':name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}


def parse_time(value):return datetime.fromisoformat(value.replace('Z','+00:00')).astimezone(timezone.utc)


def finite(value):
 try:
  result=float(value)
  return result if math.isfinite(result) else None
 except (ValueError,TypeError):return None


def read_product(client,code,config,months,now):
 records=defaultdict(dict);positions=defaultdict(list);sources=[];month_meta=[]
 for month in months:
  info=client.api(f'data/{code}/SOAP/{month}?package=basic')
  if info.get('siteCode')!='SOAP' or info.get('productCode')!=code:raise ValueError('Unexpected source identity')
  files=info['files'];selected=[]
  pattern=re.compile(r'\.000\.(\d{3})\.030\.'+re.escape(config['table'])+r'\.')
  for f in files:
   match=pattern.search(f['name'])
   if match and (config['positions'] is None or match[1] in config['positions']):selected.append((match[1],f))
  if not selected:raise ValueError('No matching tower observations')
  varfiles=[f for f in files if '.variables.' in f['name'] and f['name'].endswith('.csv')]
  posfiles=[f for f in files if '.sensor_positions.' in f['name'] and f['name'].endswith('.csv')]
  if len(varfiles)!=1 or len(posfiles)!=1:raise ValueError('Ambiguous source metadata')
  variables,vsrc=client.file(varfiles[0]);pos,psrc=client.file(posfiles[0])
  units=[v for v in variables if v['table']==config['table'] and v['fieldName']==config['variable']]
  if len(units)!=1 or units[0]['units']!=config['native_unit']:raise ValueError('Source variable unit changed')
  sources.extend([dict(vsrc,product=code,month=month),dict(psrc,product=code,month=month)])
  release=info.get('release','unknown');month_meta.append({'month':month,'release':release})
  for ver,entry in selected:
   rows,src=client.file(entry);sources.append(dict(src,product=code,month=month,release=release))
   matching=[p for p in pos if p['HOR.VER']=='000.'+ver]
   if not matching:raise ValueError('Missing sensor position')
   for p in matching:
    clean={k:p.get(k) for k in ['HOR.VER','sensorLocationID','sensorLocationDescription','effectiveStartDateTime','effectiveEndDateTime','positionStartDateTime','positionEndDateTime','referenceLocationID','zOffset','locationReferenceLatitude','locationReferenceLongitude']}
    if clean not in positions[ver]:positions[ver].append(clean)
   for row in rows:
    if config['variable'] not in row or config['flag'] not in row:raise ValueError('Source variable or QA flag missing')
    start=parse_time(row['startDateTime']);end=parse_time(row['endDateTime'])
    if start.strftime('%Y-%m')!=month or end-start!=timedelta(minutes=30) or start.minute not in (0,30) or start.second:
     raise ValueError('Unexpected sample interval')
    val=finite(row[config['variable']]);flag=finite(row[config['flag']]);key=row['startDateTime']
    record=(start,end,val,flag)
    if key in records[ver] and records[ver][key]!=record:raise ValueError('Conflicting duplicate observation')
    records[ver][key]=record
 out=[]
 first=datetime.strptime(min(months),'%Y-%m').replace(tzinfo=timezone.utc)
 last_month=datetime.strptime(max(months),'%Y-%m').replace(tzinfo=timezone.utc)
 stop=last_month.replace(day=calendar.monthrange(last_month.year,last_month.month)[1])+timedelta(days=1)
 for ver,lookup in sorted(records.items()):
  rows=sorted(lookup.values());days=defaultdict(list)
  for row in rows:days[row[0].date().isoformat()].append(row)
  values=[];coverage=[];quality_counts=[];valid_rows=[];date=first
  while date<stop:
   day=date.date().isoformat();bucket=days[day]
   accepted=[r for r in bucket if r[3]==0 and r[2] is not None]
   valid_rows.extend(accepted)
   n=len(accepted);threshold=48 if config['category']=='Precipitation' else 36
   value=None
   if n>=threshold:
    value=sum(r[2] for r in accepted)
    if config['category']!='Precipitation':value/=n
    value=round(value,4)
   values.append([day,value]);coverage.append([day,n,48])
   quality_counts.append([day,dict(Counter('missing' if r[3] is None else str(int(r[3])) for r in bucket))])
   date+=timedelta(days=1)
  latest=max(valid_rows,key=lambda r:r[1]) if valid_rows else None
  zset={finite(p['zOffset']) for p in positions[ver]}
  if len(zset)!=1 or None in zset:raise ValueError('Sensor height changed or missing; explicit series split required')
  height=next(iter(zset))
  height_text=f'{height:g} m reference offset' if height is not None else 'position '+ver
  latest_unit='mm' if config['category']=='Precipitation' else config['unit']
  out.append({
   'id':f'neon_api_{code}_{ver}','label':f'NEON SOAP · {config["title"]} · {height_text}',
   'site':'NEON SOAP','category':config['category'],'unit':config['unit'],
   'start':values[0][0],'end':values[-1][0],'count':sum(v is not None for _,v in values),
   'aggregation':'daily total; 48/48 valid half-hours required' if config['category']=='Precipitation' else 'daily mean; at least 36/48 valid half-hours required',
   'time_basis':'UTC days, assigned by interval start; midnight-ending sample belongs to preceding day',
   'values':values,'coverage':coverage,'quality_counts':quality_counts,
   'latest_valid_time':latest[1].isoformat().replace('+00:00','Z') if latest else None,
   'latest_interval_start':latest[0].isoformat().replace('+00:00','Z') if latest else None,
   'latest_value':latest[2] if latest else None,'latest_unit':latest_unit,'latest_flag':0 if latest else None,
   'latest_published_interval_end':rows[-1][1].isoformat().replace('+00:00','Z'),
   'product':code,'variable':config['variable'],'quality_flag':config['flag'],
   'horizontal_position':'000','vertical_position':ver,'height_m':height,
   'height_reference':'NEON sensor zOffset relative to tower reference TOWER111206; not an independently surveyed height above local ground',
   'sensor_positions':positions[ver],'source_interval_minutes':30,'source_months':month_meta,
   'notes':'Only finite samples with the product-specific final quality flag equal to 0 are used. Heights are kept separate. Missing or flagged samples are not zero-filled. Source flags are retained in raw Pi CSVs and summarized per UTC day in quality_counts. Latest value is a single 30-minute interval, separate from the daily series.',
   'last_success_at':now,'status':'ok',
  })
 return out,sources,month_meta


def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--token-file',type=Path,default=Path.home()/'.config/soap-newt/neon-token')
 parser.add_argument('--cache',type=Path,default=Path.home()/'.cache/soap-newt-neon')
 parser.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'field-sites/soap-newt/dashboard/data/neon_observations.json')
 parser.add_argument('--months',type=int,default=3)
 args=parser.parse_args()
 if not 1<=args.months<=12:parser.error('--months must be 1–12')
 now=utc_now()
 old=json.loads(args.output.read_text()) if args.output.exists() else {}
 try:
  if args.token_file.stat().st_mode & 0o077:raise ValueError('Token file permissions')
  token=args.token_file.read_text().strip()
  if len(token)<10 or '\n' in token:raise ValueError('Token file format')
 except (OSError,ValueError) as exc:
  if old:
   old.update(checked_at=now,status='check_failed',error='credential_unavailable');atomic_json(args.output,old)
  raise SystemExit('NEON observation credentials unavailable or insecure')
 client=Client(token,args.cache)
 payload={'schema_version':1,'checked_at':now,'site':'SOAP','status':'ok','series':[],'sources':[],'products':[],
  'source_notes':[
   'Daily summaries of authenticated NEON SOAP instrument files. Source products are published monthly, not in real time.',
   'Latest valid sample time, portal availability month, and download check time are distinct.',
   'Provisional source data may be revised. Daily checks compare source file size and checksum; unchanged files are read from the Pi cache.',
   f'{args.months} latest available months are refreshed. UTC daily means require at least 75% of half-hour intervals; precipitation totals require complete valid coverage.',
   'NEON source products and metadata are credited through the product URLs and exact source filenames/checksums. Raw files remain cached on the Pi.',
  ]}
 errors=[]
 try:
  site=client.api('sites/SOAP');available={p['dataProductCode']:p for p in site['dataProducts']}
 except (HTTPError,URLError,TimeoutError,ValueError,KeyError) as exc:
  if old:
   old.update(checked_at=now,status='check_failed',error=type(exc).__name__);atomic_json(args.output,old)
  raise SystemExit('NEON observation availability check failed: '+type(exc).__name__)
 for code,config in CONFIG.items():
  try:
   months=sorted(available[code]['availableMonths'])[-args.months:]
   if not months:raise ValueError('No available months')
   series,sources,month_meta=read_product(client,code,config,months,now)
   payload['series'].extend(series);payload['sources'].extend(sources)
   payload['products'].append({'id':code,'name':available[code]['dataProductTitle'],'url':'https://data.neonscience.org/data-products/'+code,'months':month_meta,'status':'ok','last_success_at':now})
  except (HTTPError,URLError,TimeoutError,ValueError,KeyError,OSError) as exc:
   errors.append({'product':code,'error':type(exc).__name__})
   payload['series'].extend(dict(s,status='check_failed') for s in old.get('series',[]) if s.get('product')==code)
   payload['sources'].extend(s for s in old.get('sources',[]) if s.get('product')==code)
   previous=next((p for p in old.get('products',[]) if p['id']==code),{})
   payload['products'].append(dict(previous,id=code,status='check_failed',error=type(exc).__name__))
 payload['status']='partial_failure' if errors else 'ok'
 payload['last_success_at']=old.get('last_success_at') if errors else now
 if errors:payload['errors']=errors
 payload['cache_statistics']={'downloads':client.downloads,'cache_hits':client.hits}
 atomic_json(args.output,payload)
 print('SOAP observations:',len(payload['series']),'series;',client.downloads,'files downloaded;',client.hits,'cache hits;',len(errors),'product errors')
 if errors:
  for e in errors:print(e['product'],e['error'])
  raise SystemExit(1)


if __name__=='__main__':main()
