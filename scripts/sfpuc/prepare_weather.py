"""Freeze a nearby airport weather record for context, never as on-site data."""
import argparse, csv, io, json, hashlib, math, urllib.request
from datetime import date, timedelta, datetime, timezone
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--start',default='2020-10-01');p.add_argument('--end',default=(date.today()-timedelta(days=1)).isoformat());p.add_argument('--raw',type=Path);a=p.parse_args()
root=Path(__file__).resolve().parents[2]/'field-sites/sfpuc';out=root/'dashboard/data';out.mkdir(parents=True,exist_ok=True)
url=f'https://mesonet.agron.iastate.edu/cgi-bin/request/daily.py?network=CA_ASOS&stations=LVK&sts={a.start}&ets={a.end}&var=max_temp_f,min_temp_f,precip_in,avg_wind_speed_kts&format=csv&na=M'
raw=a.raw.read_bytes()if a.raw else urllib.request.urlopen(url,timeout=90).read();source=list(csv.DictReader(io.StringIO(raw.decode())))
assert source and all(r['station']=='LVK' and r['network']=='CA_ASOS'for r in source)
def value(v):return None if v in ['M','']else float(v)
def cv(v,f):return None if value(v)is None else round(f(value(v)),5)
rows=[]
for r in source:
 trace=r['precip_in']in ['T','0.0001'];rain=0 if trace else cv(r['precip_in'],lambda x:x*25.4)
 row={'date':r['day'],'tmax_c':cv(r['max_temp_f'],lambda x:(x-32)*5/9),'tmin_c':cv(r['min_temp_f'],lambda x:(x-32)*5/9),'precip_mm':rain,'precip_trace':trace,'wind_m_s':cv(r['avg_wind_speed_kts'],lambda x:x*0.514444444444),'source':'IEM_CA_ASOS_LVK'}
 assert row['tmin_c']is None or row['tmax_c']is None or row['tmin_c']<=row['tmax_c'];assert rain is None or rain>=0
 rows.append(row)
rows.sort(key=lambda r:r['date']);expected=[(date.fromisoformat(a.start)+timedelta(days=i)).isoformat()for i in range((date.fromisoformat(a.end)-date.fromisoformat(a.start)).days+1)]
assert [r['date']for r in rows]==expected,'Unexpected gaps or duplicate dates in response'
def distance(lat,lon):
 r=math.pi/180;a1=lat*r;a2=37.69307*r;dlat=a2-a1;dlon=(-121.8149-lon)*r
 return 6371*2*math.asin(math.sqrt(math.sin(dlat/2)**2+math.cos(a1)*math.cos(a2)*math.sin(dlon/2)**2))
sites={}
for s in json.loads((root/'data/manifest.json').read_text())['sites']:
 b=s['bounds'];lat=(b[0][0]+b[1][0])/2;lon=(b[0][1]+b[1][1])/2
 sites[s['id']]={'name':s['name'],'latitude':lat,'longitude':lon,'station_distance_km':round(distance(lat,lon),2),'trees_2022':s['counts']['trees'],'plots':s['counts']['plots']}
meta={'station':{'id':'LVK','name':'Livermore Airport','network':'CA_ASOS','latitude':37.69307,'longitude':-121.81490,'elevation_m':117.81407,'time_zone':'America/Los_Angeles'},'sites':sites,'start':a.start,'end':a.end,'retrieved_at':datetime.now(timezone.utc).isoformat(),'request_url':url,'station_url':'https://mesonet.agron.iastate.edu/sites/site.php?station=LVK&network=CA_ASOS','documentation_url':'https://mesonet.agron.iastate.edu/cgi-bin/request/daily.py?help','source_sha256':hashlib.sha256(raw).hexdigest(),'coverage':{k:sum(r[k]is not None for r in rows)for k in ['tmin_c','tmax_c','precip_mm','wind_m_s']},'days':len(rows),'missing_rain_dates':[r['date']for r in rows if r['precip_mm']is None],'trace_days':sum(r['precip_trace']for r in rows),'notes':['Regional airport observations, not measurements at either field site. The same station record is shown for both sites; topographic and exposure differences are not corrected.','IEM daily summaries combine computed values with reported daily totals; airport days generally use local standard time (1 AM to 1 AM during daylight saving time).','Missing values remain null. IEM trace precipitation (0.0001 inches) is flagged and treated as zero in plotted amounts and sums; trace is not a measured zero. No gap filling or site bias correction.','This is a downloaded snapshot, not a live feed. Original Fahrenheit, inches and knots are retained in the raw CSV; normalized values use Celsius, mm and m/s.']}
(out/'weather.json').write_text(json.dumps({'metadata':meta,'daily':rows},separators=(',',':'),allow_nan=False)+'\n');(out/'weather-source.csv').write_bytes(raw)
with(out/'weather-daily.csv').open('w')as f:w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
print(json.dumps({k:meta[k]for k in ['days','coverage','missing_rain_dates','trace_days','sites']},indent=2))
