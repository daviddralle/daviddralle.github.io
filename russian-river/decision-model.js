/* Binary annual-loss scenario. All amounts represent one covered building loss. */
(function(root){
'use strict';
const defaults={limit:250000,deductible:10000,premium:null,damage:100000};
function assess(a,p,baseline=p){
 for(const k of ['limit','deductible','damage'])if(!Number.isFinite(a[k])||a[k]<0||a[k]>10000000)throw Error('Enter amounts from $0 to $10,000,000.');
 if(a.premium!==null&&(!Number.isFinite(a.premium)||a.premium<0||a.premium>10000000))throw Error('Enter a nonnegative annual premium, or leave it blank.');
 if(![p,baseline].every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw Error('Invalid flood probability.');
 const payout=Math.min(a.limit,Math.max(0,a.damage-a.deductible)), retained=a.damage-payout, breakEven=p*payout, without=p*a.damage, withInsurance=a.premium===null?null:a.premium+p*retained;
 return {p,payout,retained,breakEven,without,withInsurance,savings:a.premium===null?null:breakEven-a.premium,tenYear:1-(1-p)*Math.pow(1-baseline,9),choice:a.premium===null?'quote':Math.abs(breakEven-a.premium)<1e-8?'equal':breakEven>a.premium?'insure':'retain'};
}
const api={defaults,assess};if(typeof module==='object'&&module.exports)module.exports=api;else root.DecisionModel=api;
})(globalThis);
