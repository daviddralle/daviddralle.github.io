#!/usr/bin/env python3
"""Combine an explicit inventory of raw gage XLE files into private pipeline inputs.

Inventory is a JSON list of {path, source_url?}. Use original files, not re-exported
CSV data. Shared Drive originals remain unchanged. Exact overlaps are coalesced;
conflicting values are missing. Inspect provenance before rating new deployments.
"""
import argparse,json
from pathlib import Path
from soap_newt_gage_processing import read_xle,merge_returns

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--inventory',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();frames=[];sources=[]
 for entry in json.loads(a.inventory.read_text()):
  frame,meta=read_xle(entry['path'])
  if meta['serial'] not in ['2143062','2144104','2000099']:raise ValueError('Unexpected gage serial')
  if entry.get('source_url'):meta['source_url']=entry['source_url']
  frames.append(frame);sources.append(meta)
 merged=merge_returns(frames);a.output.mkdir(parents=True,exist_ok=True);merged.to_csv(a.output/'gage-absolute-head.csv',index=False)
 (a.output/'gage-raw-provenance.json').write_text(json.dumps({'sources':sources,'conflicts':int(merged.conflict.sum()),'duplicate_samples':int((merged['count']-1).sum())},indent=2)+'\n')
 print(len(merged),'unique gage readings;',int(merged.conflict.sum()),'conflicts')
if __name__=='__main__':main()
