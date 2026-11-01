#!/usr/bin/env python3
"""Pi-built compact partner data, derived from the validated telemetry archive."""
import json,math
from datetime import datetime,timedelta
from pathlib import Path
from ingest_telemetry import write_changed

ROOT=Path(__file__).resolve().parents[2]
SOIL=[*(f'VMC_Seg{i}' for i in range(1,6)),*(f'VMC_U_Seg{i}' for i in range(1,6)),*(f'GP_T{i}' for i in (35,100,200,300,450,600,750)),*(f'GP_U_T{i}' for i in (35,100,200,300,450,600,750))]
FIELDS={'top_soil':SOIL,'top_sap':[f'TotalSapFlow_{s}' for s in 'ABC'],'top_weather':['AirT_C_Avg','RH_Avg','SlrFD_kW_Avg','WS_ms_S_WVT','Rain_mm_Tot'],'top_power':['BattV_Avg','BattV_Min'],'top_daily':['BattV_Min']}

def wy_start(t):return datetime(t.year if t.month>=10 else t.year-1,10,1)
def finite(v):return v if isinstance(v,(int,float)) and math.isfinite(v) else None

def build(directory):
 directory=Path(directory);summary=json.loads((directory/'telemetry.json').read_text())
 stamps=[datetime.fromisoformat(r['timestamp']) for k,t in summary['tables'].items() if k in FIELDS for r in t['records']]
 if not stamps:raise ValueError('No Top observations')
 end=max(stamps);start=wy_start(end);earliest=min(start,end-timedelta(days=31))
 tables={k:{} for k in FIELDS}
 for month in summary['months']:
  if not earliest.strftime('%Y-%m')<=month<=end.strftime('%Y-%m'):continue
  part=json.loads((directory/f'telemetry-{month}.json').read_text())
  for key in FIELDS:
   for r in part['tables'].get(key,{}).get('records',[]):
    t=datetime.fromisoformat(r['timestamp'])
    if not earliest<=t<=end or r.get('flags',{}).get('source_comparison')=='conflict_requires_review':continue
    old=tables[key].get(t)
    if old is None or r['received_utc']>old['received_utc']:tables[key][t]=r
 compact={key:{'fields':fields,'rows':[[t.isoformat(sep=' '),*[finite(r['values'].get(f)) for f in fields]] for t,r in sorted(tables[key].items())]} for key,fields in FIELDS.items()}
 refs={}
 for index,sensor in enumerate('ABC',1):
  vals=[r[index] for r in compact['top_sap']['rows'] if datetime.fromisoformat(r[0])>=start and r[index] is not None]
  refs[sensor]={'min':min(vals) if vals else None,'max':max(vals) if vals else None}
 normalized=[]
 for row in compact['top_sap']['rows']:
  values=[]
  for i,sensor in enumerate('ABC',1):
   lo,hi=refs[sensor]['min'],refs[sensor]['max'];v=row[i]
   values.append(round((v-lo)/(hi-lo),6) if v is not None and lo is not None and hi>lo and start<=datetime.fromisoformat(row[0])<=end else None)
  normalized.append([row[0],*values])
 # Hourly precipitation summarizes the interval ending at its timestamp.
 # An October 1 00:00 record belongs to the preceding water year.
 rainfall=[];total=0.;previous=None;complete=True;first=None;missing=0
 for t,r in sorted(tables['top_weather'].items()):
  if wy_start(t-timedelta(microseconds=1))!=start:continue
  if first is None:first=t;complete=t==start+timedelta(hours=1)
  if previous is not None and t-previous!=timedelta(hours=1):complete=False;missing+=max(0,int((t-previous).total_seconds()/3600)-1)
  value=finite(r['values'].get('Rain_mm_Tot'))
  if value is None or value<0:complete=False;missing+=1;rainfall.append([t.isoformat(sep=' '),None])
  else:total+=value;rainfall.append([t.isoformat(sep=' '),round(total,5)])
  previous=t
 result={'schema_version':1,'site':'Sheep Camp','station':'Top','received_through_utc':summary['received_through_utc'],'latest_logger_time':end.isoformat(sep=' '),'water_year':start.year+1,'water_year_start':start.isoformat(sep=' '),'time_basis':summary['time_basis'],
 'soil':{'fields':SOIL,'rows':compact['top_soil']['rows'],'segment_positions':[1,2,3,4,5],'temperature_positions':[35,100,200,300,450,600,750],'depth_units':'sensor position; not an inferred depth in metres'},
 'sap':{'sensors':['A','B','C'],'normalized_rows':normalized,'reference':refs,'reference_start':start.isoformat(sep=' '),'reference_end':end.isoformat(sep=' '),'method':'Per-sensor minimum–maximum scaling over available water-year observations. Constant or missing series remain undefined.'},
 'weather':compact['top_weather'],'power':compact['top_power'],'daily_power':compact['top_daily'],
 'rainfall':{'rows':rainfall,'complete_water_year_to_latest_weather':complete if first else False,'first_interval_end':first.isoformat(sep=' ') if first else None,'missing_hours_within_record':missing,'total_recorded_mm':round(total,5)},
 'notes':['Preliminary sensor observations; calibration and installation metadata remain under review.','Both soil locations are GroPoints T and U at Top. Lower is not represented.','Profiles interpolate between sensor positions and across time gaps no longer than 45 minutes. No extrapolation outside the sensors or record.','Zero is a measured value; missing values remain missing.','Absolute sapflow and original records are available in the detailed Data view.']}
 changed=write_changed(directory/'quick.json',result)
 print(json.dumps({'quick_changed':changed,'water_year':result['water_year'],'soil_records':len(result['soil']['rows']),'sap_records':len(normalized)}))
 return result

if __name__=='__main__':build(ROOT/'field-sites/sfpuc/dashboard/data')
