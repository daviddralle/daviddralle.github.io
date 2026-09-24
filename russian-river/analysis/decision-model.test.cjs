const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../decision-model.js');
test('expected-cost optimum changes at exact break-even premium',()=>{
 const a={...M.defaults,premium:8000},r=M.assess(a,.1);assert.equal(r.payout,90000);assert.equal(r.without,10000);assert.equal(r.withInsurance,9000);assert.equal(r.savings,1000);assert.equal(r.choice,'insure');
 assert.equal(M.assess({...a,premium:9000},.1).choice,'equal');assert.equal(M.assess({...a,premium:10000},.1).choice,'retain');
});
test('deductible, cap, and zero loss conserve loss',()=>{
 for(const damage of [0,5000,10000,10001,100000,400000]){const r=M.assess({...M.defaults,damage},.2);assert.equal(r.payout+r.retained,damage);assert.ok(r.payout<=250000);assert.ok(r.payout>=0);}
 assert.equal(M.assess({...M.defaults,damage:400000},.2).payout,250000);
 assert.equal(M.assess({...M.defaults,damage:10000},.2).payout,0);
});
test('unknown premium is distinct from free coverage',()=>{assert.equal(M.assess(M.defaults,.1).choice,'quote');assert.equal(M.assess({...M.defaults,premium:0},.1).choice,'insure');});
test('El Nino affects first year only in ten-year calculation',()=>{const r=M.assess(M.defaults,.3,.1);assert.ok(Math.abs(r.tenYear-(1-.7*.9**9))<1e-12);assert.notEqual(r.tenYear,1-.7**10);});
test('invalid money and probabilities fail instead of generating recommendations',()=>{
 for(const v of [-1,NaN,Infinity,10000001])for(const key of ['damage','premium','limit','deductible'])assert.throws(()=>M.assess({...M.defaults,[key]:v},.1));
 for(const p of [-.1,1.1,NaN])assert.throws(()=>M.assess(M.defaults,p));
});
test('zero and certain event boundaries',()=>{assert.equal(M.assess(M.defaults,0).breakEven,0);assert.equal(M.assess(M.defaults,1).tenYear,1);});
