#!/usr/bin/env python3
"""One-time, bounded download of the matched April 2026 SOAP point-cloud tiles.

The official API request runs on the Pi using its private token. Only temporary
file URLs pass to this process, in memory; no credential/URL appears in logs or
saved manifests. Raw files must be saved outside the website repository.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import urlsplit
from urllib.request import urlopen

REMOTE = """from pathlib import Path
import urllib.request,json
headers={'X-API-Token':Path('/home/daviddralle/.config/soap-newt/neon-token').read_text().strip()}
u='https://data.neonscience.org/api/v0/data/DP1.30003.001/SOAP/2026-04?package=basic'
try:
 d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers=headers),timeout=45));print(json.dumps(d['data']))
except Exception as e:raise SystemExit(type(e).__name__)
"""


def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--api-host',default='pi5',help='Existing SSH host with private NEON token')
 parser.add_argument('--output',type=Path,required=True)
 args=parser.parse_args();root=args.output.resolve()
 repo=Path(__file__).resolve().parents[1]
 if root==repo or repo in root.parents:parser.error('Raw point clouds must remain outside the public repository')
 root.mkdir(parents=True,exist_ok=True)
 response=subprocess.run(['ssh','-o','BatchMode=yes',args.api_host,'python3 -'],input=REMOTE,text=True,capture_output=True)
 if response.returncode:raise SystemExit('Authenticated metadata request on Pi failed')
 data=json.loads(response.stdout)
 if data.get('siteCode')!='SOAP' or data.get('productCode')!='DP1.30003.001':raise ValueError('Unexpected API response identity')
 selected=[]
 for f in data['files']:
  match=re.fullmatch(r'NEON_D17_SOAP_DP1_(\d+)_(\d+)_classified_point_cloud_colorized.laz',f['name'])
  if match and 297000<=int(match[1])<=299000 and 4100000<=int(match[2])<=4102000:selected.append(f)
  elif f['name']=='NEON_D17_DPQA_2026_SOAP_9_lidar_tile_boundary.geojson':selected.append(f)
 if len([f for f in selected if f['name'].endswith('.laz')])!=9:raise ValueError('Expected nine matched April survey tiles')
 def fetch(f):
  name=f['name'];path=root/name;uri=urlsplit(f['url'])
  if Path(name).name!=name or uri.scheme!='https' or uri.hostname!='storage.googleapis.com':raise ValueError('Unexpected source URL or filename')
  def md5(p):return hashlib.file_digest(p.open('rb'),'md5').hexdigest()
  checksum=f.get('md5')
  if not path.exists() or path.stat().st_size!=f['size'] or (checksum and md5(path)!=checksum):
   temp=path.with_suffix(path.suffix+'.tmp')
   with urlopen(f['url'],timeout=180) as response,temp.open('wb') as stream:
    while chunk:=response.read(1048576):stream.write(chunk)
   if temp.stat().st_size!=f['size'] or (checksum and md5(temp)!=checksum):raise ValueError('Source size/checksum mismatch')
   temp.replace(path)
  result={'name':name,'bytes':path.stat().st_size,'sha256':hashlib.file_digest(path.open('rb'),'sha256').hexdigest(),'source_md5':checksum}
  print(name,result['bytes'],flush=True)
  return result
 with ThreadPoolExecutor(max_workers=3) as pool:files=list(pool.map(fetch,selected))
 (root/'sources.json').write_text(json.dumps({'product':'DP1.30003.001','site':'SOAP','month':'2026-04','release':data.get('release'),'files':files},indent=2)+'\n')
 print('Verified',len(files),'source files',flush=True)

if __name__=='__main__':main()
