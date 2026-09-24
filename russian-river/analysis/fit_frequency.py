"""Reproducible exploratory annual-maximum fits; not a Bulletin 17C analysis.
Run with numpy/scipy. Inputs are public USGS peaks, NOAA classifications, and
2019 paired gauge observations. Shape convention matches scipy.stats.genextreme.
"""
from pathlib import Path
import json, hashlib, csv
from datetime import datetime
import numpy as np
from scipy import stats, special, optimize
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data/research'
SEED=24092026
REPLICATES=2000

def gev_lmom(sample):
    x=np.sort(np.asarray(sample,dtype=float)); n=len(x); i=np.arange(n)
    b0=x.mean(); b1=np.mean(i/(n-1)*x); b2=np.mean(i*(i-1)/((n-1)*(n-2))*x)
    l2=2*b1-b0; t3=(6*b2-6*b1+b0)/l2
    def ratio(k):
        if abs(k)<1e-7: return 2*np.log(3)/np.log(2)-3
        return 2*np.expm1(-k*np.log(3))/np.expm1(-k*np.log(2))-3
    k=optimize.brentq(lambda k:ratio(k)-t3,-.999,20)
    if abs(k)<1e-7:
        scale=l2/np.log(2); loc=b0-np.euler_gamma*scale
    else:
        g=special.gamma(1+k); scale=l2*k/(-np.expm1(-k*np.log(2))*g); loc=b0-scale*(1-g)/k
    if not np.isfinite(scale) or scale<=0: raise ValueError('Invalid GEV scale')
    return stats.genextreme(k,loc=loc,scale=scale), dict(shape=float(k),location=float(loc),scale=float(scale))

def gumbel_lmom(sample):
    x=np.sort(np.asarray(sample,dtype=float)); n=len(x)
    l2=2*np.mean(np.arange(n)/(n-1)*x)-x.mean()
    scale=l2/np.log(2); loc=x.mean()-np.euler_gamma*scale
    return stats.gumbel_r(loc=loc,scale=scale),dict(location=float(loc),scale=float(scale))

def lp3(sample):
    logs=np.log10(sample); pars=dict(skew=float(stats.skew(logs,bias=False)),mean_log10=float(logs.mean()),sd_log10=float(logs.std(ddof=1)))
    return stats.pearson3(pars['skew'],loc=pars['mean_log10'],scale=pars['sd_log10']),pars

def main():
    history=json.loads((DATA/'flood_enso_history.json').read_text())
    config=json.loads((ROOT/'data/config.json').read_text()); floor=config['elevation_certificate']['C2b_next_higher_floor_ft']
    assert config['elevation_certificate']['vertical_datum']=='NAVD88'
    scenarios=config['scenarios']; stages=np.array([s['stage'] for s in scenarios]); water=np.array([s['water_elevation_ft'] for s in scenarios])
    assert np.all(np.diff(water)>0) and water.min()<floor<water.max()
    stage=float(np.interp(floor,water,stages))
    pairs=list(csv.DictReader((DATA/'2019_stage_flow.csv').open()))
    crossings=[]
    for a,b in zip(pairs,pairs[1:]):
        assert (datetime.fromisoformat(b['time'])-datetime.fromisoformat(a['time'])).total_seconds()==900, 'Review gaps before crossing interpolation'
        s0,s1=float(a['johnsons_stage_ft']),float(b['johnsons_stage_ft'])
        if (s0-stage)*(s1-stage)<0:
            q0,q1=float(a['hacienda_cfs']),float(b['hacienda_cfs'])
            crossings.append(dict(start=a['time'],end=b['time'],limb='rising' if s1>s0 else 'falling',flow_cfs=q0+(q1-q0)*(stage-s0)/(s1-s0)))
    assert {c['limb'] for c in crossings}=={'rising','falling'}
    q=float(np.mean([c['flow_cfs'] for c in crossings]))
    grid=np.arange(500,150001,500,dtype=float); rng=np.random.default_rng(SEED); groups={}
    rows=history['annual_peaks']
    for period,start in [('modern',1984),('full',1940)]:
      for season in ['all','el_nino','other']:
        selected=[r for r in rows if r['water_year']>=start and (season=='all' or (r['el_nino_winter'] is not None and r['el_nino_winter']==(season=='el_nino')))]
        x=np.array([r['peak_cfs'] for r in selected],dtype=float); n=len(x); models={}
        for name,fit in [('gev',gev_lmom),('gumbel',gumbel_lmom)]:
          dist,pars=fit(x); xx=grid; qq=q
          boot=[]; curves=[]
          for _ in range(REPLICATES):
            d,_=fit(rng.choice(x,n,replace=True)); boot.append(float(d.sf(qq))); curves.append(d.sf(xx))
          p=float(dist.sf(qq)); ci=np.quantile(boot,[.025,.975]); band=np.quantile(curves,[.025,.975],axis=0)
          models[name]=dict(parameters=pars,p=p,interval_95=ci.tolist(),survival=dist.sf(xx).tolist(),band_95=band.tolist(),threshold_limb_probabilities=[float(dist.sf(c['flow_cfs'])) for c in crossings])
        lp,lp_pars=lp3(x); lp_invalid=x[~np.isfinite(lp.logpdf(np.log10(x)))].tolist()
        k=int(np.sum(x>q)); ci=[float(stats.beta.ppf(.025,k,n-k+1)) if k else 0,float(stats.beta.ppf(.975,k+1,n-k)) if k<n else 1]
        groups[period+'_'+season]=dict(n=n,start=min(r['water_year'] for r in selected),end=2025,years=[r['water_year'] for r in selected],peaks=x.tolist(),lp3_diagnostic=dict(parameters=lp_pars,peaks_outside_support=lp_invalid,status='Excluded from decision model; plain log-moment fitting is not Bulletin 17C'),observed=dict(k=k,p=k/n,interval_95=ci),models=models)
    result=dict(schema=1,prepared='2026-09-24',seed=SEED,bootstrap_replicates=REPLICATES,grid_cfs=grid.tolist(),groups=groups,
      threshold=dict(living_floor_ft_NAVD88=floor,gage_stage_ft=stage,hacienda_flow_cfs=q,crossings=crossings,method='Linear interpolation of atlas WSE to fixed certificate floor; mean of linearly interpolated simultaneous Hacienda flow at rising and falling 2019 Johnsons stage crossings. Single-event transfer scenario, not an official rating or independent property validation.'),
      sources=history['sources'],inputs_sha256={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [DATA/'flood_enso_history.json',DATA/'2019_stage_flow.csv',ROOT/'data/config.json']})
    (DATA/'flood_frequency.json').write_text(json.dumps(result,separators=(',',':'),allow_nan=False)+'\n')
    for k,g in groups.items():print(k,g['n'],g['observed']['k'],{m:round(f['p'],4) for m,f in g['models'].items()})
    print('Threshold',result['threshold'])
if __name__=='__main__':main()
