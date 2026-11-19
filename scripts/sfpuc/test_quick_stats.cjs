const assert=require('node:assert/strict');
const {storageChange,summarize}=require(process.argv[2]||require('node:path').resolve(__dirname,'../../field-sites/sfpuc/dashboard/quick-stats.js'));
const H=3600000,t=Date.parse('2026-11-16T00:00:00Z');
const ts=h=>new Date(t+h*H).toISOString().slice(0,19).replace('T',' ');
const soil=(h,a,b=a)=>[ts(h),...a,...b];
const all=v=>Array(5).fill(v);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
// 10 percentage points × 750 mm = 75 mm; each probe independent.
const rows=[soil(0,all(10),all(30)),soil(2,all(20),all(20)),soil(4,all(30),all(10))];
close(storageChange(rows,0,t,t+2*H).value,75);
close(storageChange(rows,5,t,t+2*H).value,-75);
// A 1-hour boundary interpolates between complete 2-hour profiles.
close(storageChange(rows,0,t+H,t+4*H).value,112.5);
// Zero readings are valid, but any missing layer invalidates that endpoint.
close(storageChange([soil(0,all(0)),soil(2,all(1))],0,t,t+2*H).value,7.5);
assert.equal(storageChange([soil(0,[0,0,null,0,0]),soil(2,all(1))],0,t,t+2*H).value,null);
assert.equal(storageChange([soil(0,all(0)),soil(8,all(1))],0,t+4*H,t+8*H).value,null);
assert.equal(storageChange(rows,0,t-H,t+4*H).value,null);
assert.equal(storageChange(rows,0,t,t+8*H).value,null);
// Last observation's actual time is retained; end is never extrapolated.
const lag=storageChange(rows,0,t,t+4.25*H);close(lag.value,150);assert.equal(lag.final.time,t+4*H);
// Different layer thicknesses are integrated with their own weights.
close(storageChange([soil(0,all(0)),soil(2,[1,2,3,4,5])],0,t,t+2*H,[[0,10],[10,20],[20,30],[30,50],[50,75]]).value,26.5);
const data={weather:{fields:['Rain_mm_Tot','AirT_C_Avg'],rows:[[ts(0),20,-10],[ts(1),4,10],[ts(2),0,12],[ts(3),null,null],[ts(4),2,8]]},soil:{rows}};
const s=summarize(data,t+.5*H,t+4*H);
close(s.rain.value,4);close(s.rain.coveredMs/H,2.5);assert.equal(s.rain.apportioned,true);assert.equal(s.rain.lastRain.time,t+4*H);assert.equal(s.temperature.min,8);assert.equal(s.temperature.max,12);
const noRain=summarize({...data,weather:{...data.weather,rows:[[ts(1),0,10]]}},t,t+H);assert.equal(noRain.rain.value,0);assert.equal(noRain.rain.lastRain,null);
const missing=summarize({...data,weather:{...data.weather,rows:[[ts(1),null,null]]}},t,t+H);assert.equal(missing.rain.value,null);assert.equal(missing.temperature.min,null);
console.log('Passed storage integration, endpoint coverage, rainfall interval and temperature checks.');
