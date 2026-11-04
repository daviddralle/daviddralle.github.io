import sys,json,argparse,hashlib
from pathlib import Path
import pandas as pd,numpy as np
repo=Path(__file__).resolve().parents[1];sys.path.insert(0,str(repo/'scripts'))
from soap_newt_gage_processing import pressure_series,reconstruct_pressure,bounded_fill,KPA_TO_M
parser=argparse.ArgumentParser();parser.add_argument('--inputs',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args();w=args.inputs;s=pressure_series(pd.read_csv(w/'neon-pressure.csv'));b=pressure_series(pd.read_csv(w/'neon-pressure-bigc.csv'));out,code=reconstruct_pressure(s,b)
summer=(out.index>='2026-06-01T08:00Z')&(out.index<'2026-09-01T08:00Z');print('summer pressure source counts',code[summer].value_counts().to_dict());print('donor summer good',b[summer].notna().mean());print('paired correlation',pd.concat([s[summer],b[summer]],axis=1).corr().iloc[0,1]);print('all record source counts',code.value_counts().to_dict())
# Hide complete SOAP blocks; use only observations outside each hidden block.
ss=s.loc['2026-05-01':'2026-09-30'];bb=b.reindex(ss.index);rng=np.random.default_rng(48);result=[]
for n in [3,5,11,23,47]:
 candidates=[i for i in range(1,len(ss)-n-1) if ss.iloc[i-1:i+n+1].notna().all()];take=rng.choice(candidates,min(80,len(candidates)),replace=False);errors=[];linear=[];nblocks=0
 for i in take:
  hidden=ss.copy();hidden.iloc[i:i+n]=np.nan;pred,_=reconstruct_pressure(hidden,bb);truth=ss.iloc[i:i+n];e=(pred.iloc[i:i+n]-truth)*KPA_TO_M*1000;errors.extend(e.dropna().tolist());lin=bounded_fill(hidden,24);linear.extend(((lin.iloc[i:i+n]-truth)*KPA_TO_M*1000).dropna().tolist());nblocks+=1
 row={'missing_hours':n/2,'blocks':nblocks,'predictions':len(errors),'mae_mm_head':float(np.mean(np.abs(errors))),'p95_absolute_mm_head':float(np.quantile(np.abs(errors),.95)),'linear_mae_mm_head':float(np.mean(np.abs(linear))) if linear else None};result.append(row);print(row,flush=True)
args.output.write_text(json.dumps({'seed':48,'inputs':[{'name':name,'sha256':hashlib.sha256((w/name).read_bytes()).hexdigest()} for name in ['neon-pressure.csv','neon-pressure-bigc.csv']],'period':'May–September 2026','method':'Contiguous good SOAP blocks hidden; donor and bias reconstruction without withheld SOAP values. Blocks can overlap, so diagnostics are not independent uncertainty bounds.','results':result},indent=2))
