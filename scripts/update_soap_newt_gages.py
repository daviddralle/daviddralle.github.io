#!/usr/bin/env python3
"""Refresh pressure and rebuild reviewed gage inputs; retain last-good outputs on failure."""
import argparse,json,os,subprocess,sys,tempfile
from pathlib import Path
from update_soap_newt_observations import atomic_json,utc_now

ROOT=Path(__file__).resolve().parents[1]
PRODUCTS=['soap_gage_daily.csv','newt_gage_daily.csv','gage_rating_measurements.csv','local_gage_runoff.json']

def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--inputs',type=Path,default=Path.home()/'.local/share/soap-newt-gages')
 p.add_argument('--output',type=Path,default=ROOT/'field-sites/soap-newt/dashboard/data')
 p.add_argument('--cache',type=Path,default=Path.home()/'.cache/soap-newt-pressure')
 p.add_argument('--token-file',type=Path,default=Path.home()/'.config/soap-newt/neon-token')
 a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True);checked=utc_now()
 try:
  subprocess.run([sys.executable,str(ROOT/'scripts/fetch_soap_newt_pressure.py'),'--output',str(a.inputs),'--cache',str(a.cache),'--token-file',str(a.token_file)],check=True,capture_output=True,text=True)
  with tempfile.TemporaryDirectory(dir=a.output,prefix='.gage-build-') as td:
   dest=Path(td)
   subprocess.run([sys.executable,str(ROOT/'scripts/build_soap_newt_gage_runoff.py'),'--inputs',str(a.inputs),'--output',str(dest)],check=True,capture_output=True,text=True)
   bundle=json.loads((dest/PRODUCTS[-1]).read_text())
   if len(bundle['sites'])!=2 or any(s['daily_valid_count']<1 for s in bundle['sites']):raise ValueError('Incomplete gage rebuild')
   bundle.update(update_check_status='ok',checked_at=checked,last_successful_check=checked)
   atomic_json(dest/PRODUCTS[-1],bundle)
   # Promote only a fully built set; the JSON manifest is replaced last.
   for name in PRODUCTS:os.replace(dest/name,a.output/name)
  print('Soap/Newt gages: rebuilt successfully from reviewed field inputs.');return 0
 except Exception as e:
  path=a.output/PRODUCTS[-1]
  if path.exists():
   bundle=json.loads(path.read_text());bundle.update(update_check_status='check_failed',checked_at=checked);atomic_json(path,bundle)
  # Do not expose download URLs, tokens, or subprocess error bodies.
  print('Soap/Newt gage refresh failed ('+type(e).__name__+'); retained previous estimates.',file=sys.stderr);return 1
if __name__=='__main__':sys.exit(main())
