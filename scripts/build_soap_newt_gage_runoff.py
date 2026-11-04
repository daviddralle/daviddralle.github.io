#!/usr/bin/env python3
"""Build provisional local runoff from archived logger files and measured ratings.

Inputs remain outside the website. No source archive is overwritten.
"""
import argparse,json,hashlib
from pathlib import Path
from datetime import datetime,timezone
import numpy as np
import pandas as pd
from soap_newt_gage_processing import PST,pressure_at,fit_rating,rating_predict,daily_runoff

ROOT=Path(__file__).resolve().parents[1]
SOURCE_URL='https://docs.google.com/spreadsheets/d/1OZ4TdHuAB5bwqt3Pr5W6rAAq8P-u2-651wOBtlIYnzU/edit#gid=580744958'

def clock(date,value):
 if value is None or str(value).strip()=='':return pd.NaT
 v=str(value).zfill(4)
 return pd.Timestamp(date+' '+v[:2]+':'+v[2:]).tz_localize(PST)

def clean(value):
 if isinstance(value,dict):return {k:clean(v) for k,v in value.items()}
 if isinstance(value,list):return [clean(v) for v in value]
 if isinstance(value,(np.integer,)):return int(value)
 if isinstance(value,(np.floating,float)):return float(value) if np.isfinite(value) else None
 return value

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--inputs',type=Path,required=True);p.add_argument('--output',type=Path,default=ROOT/'field-sites/soap-newt/dashboard/data');args=p.parse_args();w=args.inputs;out=args.output;out.mkdir(parents=True,exist_ok=True)
 raw=pd.read_csv(w/'gage-absolute-head.csv',dtype={'serial':str});raw['time']=pd.to_datetime(raw.time,utc=True).dt.tz_convert(PST)
 pressure=pd.read_csv(w/'neon-pressure.csv');raw['pressure_head_m']=raw.absolute_head_m-pressure_at(pressure,raw.time)
 values=json.loads((w/'stageq-snapshot.json').read_text())['values'];visits=[]
 for i,row in enumerate(values[1:],2):
  row=row+[None]*(len(values[0])-len(row));d=dict(zip(values[0],row));flags=[]
  h=pd.to_numeric(d['Stage Height (ft)'],errors='coerce')*.3048;q=pd.to_numeric(d['Site Visit Discharge (cms)'],errors='coerce')
  st=clock(d['Date'],d['Stage Time (PST)']);qt=clock(d['Date'],d['Time (PST)'])
  if not np.isfinite(h):flags.append('missing_manual_stage')
  if not np.isfinite(q) or q<=0:flags.append('missing_or_nonpositive_discharge')
  if str(d['Uncertainty (%) (Ive)']).lower()=='flag':flags.append('source_flag')
  if d['Site']=='NEWT' and d['Date']=='2026-05-19':flags.append('invalid_ec_timestamps')
  if pd.notna(st) and pd.notna(qt) and abs(st-qt)>pd.Timedelta('60min'):flags.append('stage_discharge_times_over_60min_apart')
  visits.append({'source_row':i,'site':'Soap' if d['Site']=='SOAP' else 'Newt','date':d['Date'],'stage_time':st,'q_time':qt,'stage_m':h,'q_m3_s':q,'method':d['Q Method'],'flags':flags})
 sites=[];series=[];public_visits=[]
 areas={d['site']:d['area_km2'] for d in json.loads((ROOT/'field-sites/soap-newt/atlas/data/manifest.json').read_text())['watersheds']}
 for site,serial,start in [('Soap','2143062','2023-10-18 10:00'),('Newt','2144104','2024-03-12 14:30')]:
  g=raw[(raw.serial==serial)&(raw.time>=pd.Timestamp(start,tz=PST))].set_index('time').sort_index();v=[dict(x) for x in visits if x['site']==site];offsets=[]
  for d in v:
   t=d['stage_time'];head=np.nan
   if pd.notna(t):
    pos=g.index.get_indexer([t],method='nearest',tolerance=pd.Timedelta('8min'))[0]
    if pos>=0:head=g.pressure_head_m.iloc[pos]
   d['paired_pressure_head_m']=head;d['staff_minus_head_m']=d['stage_m']-head
   if np.isfinite(d['staff_minus_head_m']):offsets.append(d['staff_minus_head_m'])
  if len(offsets)<5:raise ValueError('Not enough staff-stage datum checks')
  offset=float(np.median(offsets));datum_mad=float(np.median(np.abs(np.array(offsets)-offset)))
  fit=[d for d in v if not d['flags']];h=np.array([d['stage_m'] for d in fit]);q=np.array([d['q_m3_s'] for d in fit]);parameters=fit_rating(h,q)
  errors=[]
  for date in sorted(set(d['date'] for d in fit)):
   train=np.array([d['date']!=date for d in fit]);test=~train;cv=fit_rating(h[train],q[train]);errors.extend(np.log(rating_predict(h[test],cv)/q[test]).tolist())
  error_factor=float(np.exp(np.median(np.abs(errors))));lo,hi=float(h.min()),float(h.max());begin=min(d['date'] for d in fit);finish=max(d['date'] for d in fit)
  stage=g.pressure_head_m+offset;in_range=stage.between(lo,hi);in_time=(stage.index>=pd.Timestamp(begin,tz=PST))&(stage.index<pd.Timestamp(finish,tz=PST)+pd.Timedelta('1D'))
  flow=pd.Series(rating_predict(stage.to_numpy(),parameters),index=stage.index).where(in_range&in_time)
  runoff,coverage=daily_runoff(flow,areas[site]);valid=runoff.dropna()
  if valid.empty:raise ValueError('No sufficiently complete daily runoff')
  idx=pd.date_range(pd.Timestamp(begin,tz=PST),g.index.max().normalize(),freq='D');runoff=runoff.reindex(idx);coverage=coverage.reindex(idx,fill_value=0)
  vals=[[t.date().isoformat(),None if pd.isna(x) else round(float(x),6)] for t,x in runoff.items()]
  notes=['Provisional single power-law rating fitted to manual staff-stage/discharge pairs; channel stability and datum shifts are not independently established.',
   'Raw logger pressure corrected using NEON SOAP station pressure (staPresFinalQF=0), interpolated only between adjacent valid 30-minute interval midpoints. No extrapolation or gap filling.',
   'Fixed PST (UTC−08:00), confirmed by site operator. Constant staff-gage offset estimated from paired manual readings; local atmospheric elevation effects and sensor bias are not separately identified.',
   'Discharge evaluated before daily averaging. At least 87 of 96 quarter-hour slots required. Daily means describe covered intervals; missing intervals are not filled.',
   'Estimates outside the observed rating stage range or first/last accepted rating-visit dates are omitted; missing values are not zero runoff.',
   'Catchment areas use archived watershed polygons; contributing area at each gage requires field confirmation.',
   'Held-out error describes rating scatter only; it is not a complete runoff uncertainty interval.']
  series.append({'id':site.lower()+'_gage_runoff','site':site,'label':site+' gage · provisional runoff','category':'Runoff','unit':'mm/day','aggregation':'daily mean-equivalent runoff; ≥90% quarter-hour coverage','time_basis':'Fixed PST (UTC−08:00)','source_id':'local_gage_ratings','status':'provisional','start':vals[0][0],'end':vals[-1][0],'count':int(runoff.count()),'missing_count':int(runoff.isna().sum()),'values':vals,'coverage':[[t.date().isoformat(),int(coverage.loc[t])*900,86400] for t in idx],'notes':notes,'latest_valid_time':valid.index[-1].date().isoformat(),'latest_value':float(valid.iloc[-1])})
  curve_h=np.linspace(lo,hi,150)
  sites.append({'site':site,'area_km2':areas[site],'serial':serial,'deployment_start':start,'staff_offset_m':offset,'datum_pair_count':len(offsets),'datum_median_absolute_deviation_m':datum_mad,'rating_count':len(fit),'rating_stage_range_m':[lo,hi],'rating_dates':[begin,finish],'model':'Q = exp(log_a) × (h − h0)^b; Q in m³/s, h in m','parameters':dict(zip(['log_a','b','h0'],parameters.tolist())),'fit_method':'Soft-L1 log-discharge residuals, scale 0.5; b constrained 0.5–6; h0 between min(h)−0.5 m and min(h)−0.0001 m. No fit-residual exclusions.','cross_validation':'Leave one visit date out; refit all parameters; median multiplicative absolute error.','held_out_error_factor':error_factor,'curve':[[float(x),float(y)] for x,y in zip(curve_h,rating_predict(curve_h,parameters))],'daily_valid_count':int(runoff.count()),'daily_missing_count':int(runoff.isna().sum()),'native_samples':len(g),'pressure_missing_samples':int(g.pressure_head_m.isna().sum()),'stage_outside_rating_samples':int((stage.notna()&~in_range).sum()),'raw_conflict_samples':int(g.conflict.sum()),'raw_latest_time':g.index[-1].isoformat()})
  for d in v:
   d['used_in_rating']=not bool(d['flags']);d['predicted_q_m3_s']=float(rating_predict(d['stage_m'],parameters)) if np.isfinite(d['stage_m']) else None
   d['stage_time']=d['stage_time'].isoformat() if pd.notna(d['stage_time']) else None;d['q_time']=d['q_time'].isoformat() if pd.notna(d['q_time']) else None
   public_visits.append(d)
  # Compact diagnostic daily stage series, including gaps.
  pd.DataFrame({'staff_equivalent_stage_m':stage.resample('D').median(),'runoff_mm_day':runoff,'valid_quarter_hours':coverage}).to_csv(out/f'{site.lower()}_gage_daily.csv',index_label='date_pst')
  print(site,'rating pairs',len(fit),'held-out factor',round(error_factor,2),'offset_m',round(offset,4),'days',len(valid),'range',lo,hi,flush=True)
 bundle={'schema_version':1,'built_at':datetime.now(timezone.utc).isoformat(),'status':'provisional','source_url':SOURCE_URL,'sites':sites,'series':series,'measurements':public_visits,'review_findings':[
  {'site':'Newt','date':'2026-05-19','issue':'EC file advances one day per row; archived dilution discharge 1.862409e-8 m³/s is invalid. Actual sampling interval is unresolved.','action':'Excluded from rating; no inferred replacement discharge.'},
  {'site':'Soap','date':'2025-04-16','issue':'High dilution discharge relative to other measurements at similar stage.','action':'Retained in robust fit; review calibration and tracer record.'},
  {'site':'Soap','date':'2025-05-15','issue':'Same recorded staff stage as 2025-05-12 but discharge differs by about 5.4 times.','action':'Both retained; review measurements and channel conditions.'},
  {'site':'Both','issue':'Rating Curve Dates sheet has no documented change dates.','action':'Single provisional rating per site; no invented shifts.'}],
 'source_notes':['Input snapshots are dated 2026-11-04. Staff-stage and discharge source cells are identified by source_row. Logger clocks and field visits use fixed PST, confirmed by the site operator.',
 'Raw source files remain outside the website. Exact source checksums are retained. Pressure corrections do not use the previously interpolated meteorological archive.',
 'Missing and flagged measurements remain in the downloadable measurement table; only rows with an empty flags list enter the rating.',
 'Previous Soap sensor deployments before 2023-10-18 are not rated. No automatic corrections are applied to the shared source notebooks or spreadsheets.'],
 'provenance':{'raw':json.loads((w/'gage-raw-provenance.json').read_text()),'pressure':json.loads((w/'neon-pressure-provenance.json').read_text()),'inputs':[{'name':name,'sha256':hashlib.sha256((w/name).read_bytes()).hexdigest()} for name in ['stageq-snapshot.json','gage-absolute-head.csv','neon-pressure.csv']]}}
 (out/'local_gage_runoff.json').write_text(json.dumps(clean(bundle),separators=(',',':'),allow_nan=False)+'\n')
 pd.DataFrame(clean(public_visits)).to_csv(out/'gage_rating_measurements.csv',index=False)
if __name__=='__main__':main()
