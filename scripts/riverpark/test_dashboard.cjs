const {test}=require('node:test');
const assert=require('node:assert/strict');
const {increment,prepareRaw,cumulative,convert}=require('../../field-sites/riverpark/dashboard.js');
const step=300000;
const row=(t,total,daily=0)=>[t,60,75,2,5,180,total,daily,0];
test('window rain excludes the opening boundary and includes the end',()=>{
  const points=prepareRaw([row(0,0),row(step,.1),row(step*2,.3),row(step*3,.4)],step,step*3);
  assert.equal(points.length,2);
  assert.equal(cumulative(points).at(-1).cumulative,.3);
});
test('missing data stay unknown and dry readings remain zero',()=>{
  assert.equal(increment(row(0,0),row(step*2,.2)),null);
  assert.equal(increment(row(0,0),row(step,0)),0);
  assert.equal(cumulative([{rain:null}])[0].cumulative,null);
  assert.deepEqual(cumulative([{rain:.1},{rain:null},{rain:.2}]).map(p=>p.cumulative),[.1,null,.3]);
});
test('yearly reset uses the new local day counter',()=>{
  const t=Date.parse('2026-01-01T00:00:00-08:00');
  assert.equal(increment(row(t-step,12,1),row(t,0,0)),0);
  assert.equal(increment(row(t,12,1),row(t+step,0,0)),null);
});
test('unit conversions preserve nulls and zeros',()=>{
  assert.equal(convert(null,'temp','metric'),null);
  assert.equal(convert(32,'temp','metric'),0);
  assert.equal(convert(1,'rain','metric'),25.4);
  assert.equal(convert(0,'wind','metric'),0);
});
