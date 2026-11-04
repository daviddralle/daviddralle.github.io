"""Explicit units, bounded pressure interpolation, and provisional stage ratings."""
from pathlib import Path
import xml.etree.ElementTree as ET
import hashlib
import numpy as np
import pandas as pd
from scipy.optimize import least_squares

PST='Etc/GMT+8'
KPA_TO_M=0.101972

def read_xle(path):
 raw=Path(path).read_bytes();root=ET.fromstring(raw)
 serial=root.findtext('Instrument_info/Serial_number');unit=root.findtext('Ch1_data_header/Unit')
 if root.findtext('Ch1_data_header/Identification')!='LEVEL':raise ValueError('Expected LEVEL channel')
 if unit not in {'m','kPa','cm','ft'}:raise ValueError('Unknown pressure-head unit: '+str(unit))
 scale={'m':1.,'kPa':KPA_TO_M,'cm':.01,'ft':.3048}[unit]
 rows=[(r.findtext('Date')+' '+r.findtext('Time'),float(r.findtext('ch1'))*scale) for r in root.findall('Data/Log')]
 frame=pd.DataFrame(rows,columns=['time','absolute_head_m']);frame['time']=pd.to_datetime(frame.time).dt.tz_localize(PST);frame['serial']=serial
 return frame,{'name':Path(path).name,'sha256':hashlib.sha256(raw).hexdigest(),'serial':serial,'source_unit':unit,'count':len(frame),'start':frame.time.min().isoformat(),'end':frame.time.max().isoformat()}

def merge_returns(frames):
 """Coalesce exact repeats; conflicting readings at one serial/time are missing."""
 allrows=pd.concat(frames,ignore_index=True)
 grouped=allrows.groupby(['serial','time']).absolute_head_m.agg(['min','max','count'])
 grouped['conflict']=(grouped['max']-grouped['min'])>1e-6
 grouped['absolute_head_m']=grouped['min'].where(~grouped.conflict)
 return grouped.reset_index()

def pressure_at(pressure,times):
 """Interpolate only between adjacent, valid 30 min means at interval midpoints.

 Retain invalid rows as barriers. Never extrapolate or bridge flagged intervals.
 """
 start=pd.to_datetime(pressure.startDateTime,utc=True);end=pd.to_datetime(pressure.endDateTime,utc=True)
 if not ((end-start)==pd.Timedelta('30min')).all():raise ValueError('Unexpected pressure interval')
 p=pd.DataFrame({'t':start+(end-start)/2,'p':pd.to_numeric(pressure.staPresMean,errors='coerce'),'flag':pd.to_numeric(pressure.staPresFinalQF,errors='coerce')}).sort_values('t')
 if p.t.duplicated().any():raise ValueError('Duplicate NEON pressure interval')
 x=p.t.astype('int64').to_numpy();y=p.p.where(p.flag==0).to_numpy();t=pd.DatetimeIndex(times).asi8
 j=np.searchsorted(x,t);right=np.minimum(j,len(x)-1);left=np.maximum(j-1,0)
 exact=(j<len(x))&(x[right]==t);ok=(j>0)&(j<len(x))&((x[right]-x[left])==pd.Timedelta('30min').value)&np.isfinite(y[left])&np.isfinite(y[right])
 out=np.full(len(t),np.nan);out[exact]=y[right[exact]]
 f=(t[ok]-x[left[ok]])/(x[right[ok]]-x[left[ok]])
 out[ok]=y[left[ok]]+f*(y[right[ok]]-y[left[ok]])
 return out*KPA_TO_M

def rating_predict(h,parameters):
 a,b,h0=parameters
 return np.exp(a)*np.maximum(np.asarray(h)-h0,1e-12)**b

def fit_rating(h,q):
 """Robust log-residual power law; no automatic removal based on fit residual."""
 h=np.asarray(h,float);q=np.asarray(q,float)
 if len(h)<8 or np.any(q<=0) or np.any(~np.isfinite(h)):raise ValueError('Insufficient valid rating data')
 upper=float(h.min()-.0001);lower=float(h.min()-.5)
 def residual(p):return np.log(rating_predict(h,p))-np.log(q)
 starts=[upper-.005,upper-.03,upper-.1]
 fits=[least_squares(residual,[0,2,max(lower+.001,h0)],bounds=([-20,.5,lower],[20,6,upper]),loss='soft_l1',f_scale=.5,max_nfev=3000) for h0 in starts]
 best=min(fits,key=lambda f:f.cost)
 if not best.success:raise ValueError('Rating fit did not converge')
 return best.x

def daily_runoff(q,area_km2):
 """Mean subdaily discharge, then mm/day; >=90% of 96 quarter-hour slots."""
 if area_km2<=0:raise ValueError('Area must be positive')
 slots=q.resample('15min').mean();coverage=slots.resample('D').count()
 daily=slots.resample('D').mean().where(coverage>=87)
 return daily*86.4/area_km2,coverage

def validate_ec_times(times):
 t=pd.DatetimeIndex(times);dt=np.diff(t.asi8)/1e9
 if len(dt)<2 or np.any(dt<=0) or np.max(dt)>60 or (t[-1]-t[0])>pd.Timedelta('6h'):
  raise ValueError('EC timestamps invalid for integration; do not invent a sampling interval')
 return dt
