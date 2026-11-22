const {test}=require('node:test');
const assert=require('node:assert/strict');
const {increment,prepareRaw,prepareDaily,rainAddition,cumulative,convert}=require('../../field-sites/riverpark/dashboard.js');
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
test('approved storm addition agrees in recent, monthly and daily views without changing station data',()=>{
  const data='../../field-sites/riverpark/data/';
  const corrections=require(data+'rain-corrections.json').corrections;
  const monthly=require(data+'observations-2026-11.json').rows;
  const recent=require(data+'recent.json').rows;
  const daily=require(data+'daily.json').days;
  const before=JSON.stringify(monthly);
  const start=Date.parse('2026-11-18T00:00:00-08:00');
  const end=Date.parse('2026-11-19T00:00:00-08:00');
  const total=points=>points.reduce((sum,p)=>sum+(p.rain||0),0);
  const raw=prepareRaw(monthly,start,end);
  const filled=prepareRaw(monthly,start,end,corrections);
  assert.ok(Math.abs(total(filled)-total(raw)-1.16)<1e-10);
  if(recent[0][0]<=start && recent.at(-1)[0]>=end) {
    assert.deepEqual(filled,prepareRaw(recent,start,end,corrections));
  }
  const day=prepareDaily(daily,corrections).find(d=>d.date==='2026-11-18');
  assert.ok(Math.abs(day.rain-total(filled))<1e-10);
  assert.equal(day.complete,false);
  assert.equal(filled.filter(p=>p.missing).length,raw.filter(p=>p.missing).length);
  assert.equal(JSON.stringify(monthly),before);
  assert.deepEqual(prepareRaw(monthly,start,end,corrections),filled);
  assert.equal(rainAddition(end,end+86400000,corrections),0);
  assert.equal(rainAddition(start-86400000,start,corrections),0);
  assert.ok(Math.abs(rainAddition(Date.parse(corrections[0].start),Date.parse(corrections[0].end),corrections)-1.16)<1e-10);
});
test('uniform addition respects partial intervals and preserves unknown rain',()=>{
  const corrections=[{start:new Date(step/2).toISOString(),end:new Date(step*2).toISOString(),amount_in:1.5}];
  const points=prepareRaw([row(0,0),row(step,0),row(step*2,0),row(step*4,.1)],0,step*4,corrections);
  assert.deepEqual(points.map(p=>p.rain),[.5,1,null]);
  assert.equal(points[2].missing,true);
});
