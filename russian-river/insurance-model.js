/* Transparent scenario arithmetic; no fitted hazard or proprietary damage model. */
(function(root){
'use strict';
const defaults={deductible:10000,limit:250000,premium:null,waterOffset:0,costScale:1,lowerMax:0,lowerEligible:0,upperEligible:100,repairs:[5000,40000,100000,200000,350000],weights:[10,6,5,2,1]};
const stages=[36,40,45,50,52],depthKnots=[0,1,3,6,10];
function validate(a){
 const err=[];
 for(const k of ['deductible','limit','lowerMax'])if(!Number.isFinite(a[k])||a[k]<0||a[k]>10000000)err.push(`${k} must be between 0 and 10,000,000.`);
 if(a.premium!==null&&(!Number.isFinite(a.premium)||a.premium<0||a.premium>10000000))err.push('Premium must be blank or a nonnegative amount.');
 if(!Number.isFinite(a.waterOffset)||Math.abs(a.waterOffset)>3)err.push('Water-level offset must be between −3 and +3 ft.');
 if(!Number.isFinite(a.costScale)||a.costScale<.1||a.costScale>3)err.push('Cost multiplier must be between 0.1 and 3.');
 for(const k of ['lowerEligible','upperEligible'])if(!Number.isFinite(a[k])||a[k]<0||a[k]>100)err.push('Eligible shares must be between 0 and 100%.');
 if(!Array.isArray(a.repairs)||a.repairs.length!==5||a.repairs.some((x,i)=>!Number.isFinite(x)||x<0||x>10000000||(i&&x<a.repairs[i-1])))err.push('Repair costs must be nonnegative and increase or stay level with depth.');
 if(!Array.isArray(a.weights)||a.weights.length!==5||a.weights.some(x=>!Number.isFinite(x)||x<0||x>100)||a.weights.reduce((x,y)=>x+y,0)>100+1e-8)err.push('Scenario probabilities must be nonnegative and sum to 100% or less.');
 return err;
}
function interpolate(xs,ys,x){if(x<=xs[0])return ys[0];for(let i=1;i<xs.length;i++)if(x<=xs[i])return ys[i-1]+(ys[i]-ys[i-1])*(x-xs[i-1])/(xs[i]-xs[i-1]);return ys[ys.length-1];}
function event(a,config,stage){
 const s=config.scenarios.find(x=>x.stage===stage);if(!s)throw new Error('Unavailable integer-stage scenario.');
 const ec=config.elevation_certificate;if(!ec||ec.vertical_datum!=='NAVD88')throw new Error('Certificate reference is missing.');
 const water=s.water_elevation_ft+a.waterOffset,depth=water-ec.C2b_next_higher_floor_ft,lowerDepth=water-ec.C2a_bottom_enclosure_floor_ft;
 const upper=depth>0?interpolate(depthKnots,a.repairs,depth)*a.costScale:0;
 // Owner-specified scope: zero damage below the surveyed living floor.
 // Legacy lowerMax/lowerEligible inputs are retained for saved-file compatibility only.
 const lower=0;
 const loss=upper+lower,eligible=upper*a.upperEligible/100;
 const payout=Math.min(a.limit,Math.max(0,eligible-a.deductible));
 return{stage,water,depth,lowerDepth,upper,lower,loss,eligible,payout,retained:loss-payout};
}
function annual(a,config){
 const errors=validate(a);if(errors.length)throw new Error(errors.join(' '));
 const events=stages.map((s,i)=>({...event(a,config,s),probability:a.weights[i]/100}));
 const weighted=k=>events.reduce((sum,x)=>sum+x[k]*x.probability,0);
 const probability=events.reduce((sum,x)=>sum+(x.payout>0?x.probability:0),0);
 return{events,totalWeight:a.weights.reduce((x,y)=>x+y,0)/100,loss:weighted('loss'),payout:weighted('payout'),retained:weighted('retained'),claimProbability:probability,tenYearProbability:1-Math.pow(1-probability,10),costWithInsurance:a.premium===null?null:weighted('retained')+a.premium,netPayoutAfterPremium:a.premium===null?null:weighted('payout')-a.premium};
}
function sensitivity(a,config){
 const total=a.weights.reduce((x,y)=>x+y,0);const highFactor=total?Math.min(1.5,100/total):1.5;
 const cases=[{name:'Lower-loss test',water:-1,cost:.5,frequency:.5},{name:'Entered assumptions',water:0,cost:1,frequency:1},{name:'Higher-loss test',water:1,cost:1.5,frequency:highFactor}];
 return cases.map(c=>{const b={...a,waterOffset:Math.max(-3,Math.min(3,a.waterOffset+c.water)),costScale:Math.min(3,Math.max(.1,a.costScale*c.cost)),weights:a.weights.map(x=>x*c.frequency)};return{...c,actualOffset:b.waterOffset,actualCost:b.costScale,result:annual(b,config)};});
}
const api={defaults,stages,depthKnots,validate,event,annual,sensitivity};
if(typeof module==='object'&&module.exports)module.exports=api;else root.InsuranceModel=api;
})(typeof globalThis==='object'?globalThis:this);
