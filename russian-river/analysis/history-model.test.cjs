const {test}=require('node:test'),assert=require('node:assert/strict'),H=require('../history-model.js'),data=require('../data/research/flood_enso_history.json');
test('2019 reference counts include equality and exclude unclassified years from ENSO subsets',()=>{for(const [season,n,k] of [['all',86,11],['el_nino',27,4],['other',49,6]]){const r=H.summarize(data.annual_peaks,72000,1940,season);assert.equal(r.n,n);assert.equal(r.k,k);assert.equal(r.p,k/n);}});
test('modern groups partition all years',()=>{for(const [season,n,k] of [['all',42,5],['el_nino',14,2],['other',28,3]]){const r=H.summarize(data.annual_peaks,72000,1984,season);assert.equal(r.n,n);assert.equal(r.k,k);}});
test('raising threshold never increases exceedance probability',()=>{for(const start of [1940,1984])for(const season of ['all','el_nino','other']){let p=1;for(let q=500;q<=120000;q+=500){const r=H.summarize(data.annual_peaks,q,start,season);assert.ok(r.p<=p);p=r.p;}}});
test('bounds and invalid thresholds',()=>{assert.equal(H.summarize(data.annual_peaks,500).p,1);assert.equal(H.summarize(data.annual_peaks,120000).p,0);for(const n of [NaN,Infinity,-1,0,120001])assert.throws(()=>H.summarize(data.annual_peaks,n));});
test('fitted curve interpolation preserves endpoints and linear weights',()=>{assert.equal(H.interpolate([500,1000,1500],[1,.6,.2],750),.8);assert.equal(H.interpolate([500,1000],[1,.6],500),1);assert.equal(H.interpolate([500,1000],[1,.6],1000),.6);});
const transferData=require('../data/research/history_stage_transfer.json'),T=H.stageTransfer(transferData);
test('stage display preserves event order, reverses to flow and leaves counts unchanged',()=>{
 let previous=-Infinity;
 for(let q=500;q<=120000;q+=137){const s=T.toStage(q);assert.ok(s>previous);previous=s;assert.ok(Math.abs(T.toFlow(s)-q)<1e-5);}
 for(const row of data.annual_peaks){const s=T.toStage(row.peak_cfs),q=T.toFlow(s);for(const season of ['all','el_nino','other'])assert.equal(H.summarize(data.annual_peaks,q,1940,season).k,H.summarize(data.annual_peaks,row.peak_cfs,1940,season).k);}
});
test('2019 damage reference is unchanged by display units',()=>{assert.equal(T.toStage(72000),45.38);assert.equal(T.toFlow(45.38),72000);assert.equal(T.toStage(102000),49.5);assert.equal(H.summarize(data.annual_peaks,T.toFlow(45.38)).k,11);});
test('rejects nonmonotone transfers and clamps to supported input bounds',()=>{assert.throws(()=>H.stageTransfer({nodes:[{flow_cfs:500,stage_ft:10},{flow_cfs:1000,stage_ft:9}]}));assert.equal(T.toFlow(-1),500);assert.equal(T.toFlow(100),120000);});
