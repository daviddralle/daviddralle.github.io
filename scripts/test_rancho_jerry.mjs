import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createRidgeDetector} from '../field-sites/rancho/atlas/jerry-ridges.js';
const proj4=createRequire(import.meta.url)('../field-sites/rancho/atlas/vendor/proj4.js');
import {createMotion,HOME,ROUTE,DESTINATIONS} from '../field-sites/rancho/atlas/jerry-motion.js';
import {poems,sources,createDeck} from '../field-sites/rancho/atlas/jerry-haikus.js';
const t=JSON.parse(fs.readFileSync(new URL('../field-sites/rancho/atlas/data/terrain.json',import.meta.url)));
const [x0,y0,x1,y1]=t.bounds;
function cell(e,n){return [(e-x0)/(x1-x0)*(t.nx-1),(y1-n)/(y1-y0)*(t.ny-1)];}
function valid(e,n){if(e<x0+15||e>x1-15||n<y0+15||n>y1-15)return false;const [cc,rr]=cell(e,n),c=Math.floor(cc),r=Math.floor(rr);return [t.valid[r][c],t.valid[r][c+1],t.valid[r+1][c],t.valid[r+1][c+1]].every(Boolean);}
function height(e,n){const [cc,rr]=cell(e,n),c=Math.min(t.nx-2,Math.max(0,Math.floor(cc))),r=Math.min(t.ny-2,Math.max(0,Math.floor(rr))),dx=cc-c,dy=rr-r,g=t.elevation_m;return dx+dy<=1?g[r][c]+dx*(g[r][c+1]-g[r][c])+dy*(g[r+1][c]-g[r][c]):g[r+1][c+1]+(1-dx)*(g[r+1][c]-g[r+1][c+1])+(1-dy)*(g[r][c+1]-g[r+1][c+1]);}
const catchments=JSON.parse(fs.readFileSync(new URL('../field-sites/rancho/atlas/data/catchments.geojson',import.meta.url))).features;
const project=p=>proj4('EPSG:4326','+proj=utm +zone=10 +datum=NAD83 +units=m +no_defs',p);
const ridgeAt=createRidgeDetector({catchments,project,height,valid});
const make=()=>createMotion({height,valid,ridgeAt});
test('100 distinct original poems have three lines and traceable primary sources',()=>{assert.equal(poems.length,100);assert.equal(new Set(poems.map(p=>p.lines.join('\n'))).size,100);assert.equal(sources.length,10);for(const p of poems){assert.equal(p.lines.length,3);assert.ok(p.lines.every(x=>x.trim()));assert.ok(sources.some(s=>s.id===p.source));}assert.ok(sources.every(s=>s.url.startsWith('https://www.jerrybrown.org/views/')));});
test('shuffled deck visits every poem before repetition, including deck boundaries',()=>{const deck=createDeck();const first=Array.from({length:100},()=>deck.next());assert.equal(new Set(first.map(p=>p.id)).size,100);const next=deck.next();assert.notEqual(next.id,first.at(-1).id);});
test('starts and resets at the marked circle drive; every route waypoint has valid terrain',()=>{const m=make();assert.deepEqual([m.state.e,m.state.n],HOME);ROUTE.forEach(p=>assert.ok(valid(...p),p.join(',')));for(let i=0;i<500;i++)m.step(.05);m.reset();assert.deepEqual([m.state.e,m.state.n],HOME);assert.equal(m.state.speed,0);assert.equal(m.state.phase,'home');});
test('fast circuit visits every monitoring destination on valid terrain within three minutes',()=>{const m=make();let maxHop=0,maxSpeed=0,lastJumps=0;const seen=new Set(),jumpDivides=new Set();for(let i=0;i<3600;i++){const s=m.step(.05);assert.ok(valid(s.e,s.n));assert.ok(Number.isFinite(s.pitch));maxHop=Math.max(maxHop,s.hop);maxSpeed=Math.max(maxSpeed,s.speed);if(s.jumps>lastJumps){assert.ok(s.lastJump.distance<=6);assert.ok(s.lastJump.up>.025&&s.lastJump.down<-.025);assert.ok(ridgeAt(s.lastJump.e,s.lastJump.n,s.lastJump.heading));jumpDivides.add(s.lastJump.id);lastJumps=s.jumps;}if(s.lastVisited)seen.add(s.lastVisited);if(s.visits){assert.equal(s.phase,'drive');assert.ok(s.speed>0);}}assert.deepEqual([...seen].sort(),DESTINATIONS.map(d=>d.id).sort());assert.ok(maxSpeed>24);assert.ok(maxHop>3&&maxHop<5);assert.ok(jumpDivides.size>=3,`Only ${jumpDivides.size} divides jumped`);console.log({destinations:[...seen],jumpDivides:[...jumpDivides],maxHop,maxSpeed});});
test('destination commands reach each target from home and remain near mapped features',()=>{const holes=JSON.parse(fs.readFileSync(new URL('../field-sites/rancho/atlas/data/boreholes.geojson',import.meta.url))).features;for(const d of DESTINATIONS){const f=holes.find(f=>f.properties.id===d.feature);if(f)assert.ok(Math.hypot(d.point[0]-f.properties.easting_m,d.point[1]-f.properties.northing_m)<12);const m=make();assert.ok(m.go(d.id));for(let i=0;i<4000&&!m.state.visits;i++){m.step(.05);assert.ok(valid(m.state.e,m.state.n));}assert.equal(m.state.phase,'drive',d.id);assert.equal(m.state.lastVisited,d.id);assert.ok(m.state.speed>0);assert.ok(Math.hypot(m.state.e-d.point[0],m.state.n-d.point[1])<6);}});
test('wine collection stops the vehicle, then reveals a poem; resume and reset clear stops',()=>{const m=make();for(let i=0;i<400;i++)m.step(.05);const p=[m.state.e+12,m.state.n+15];assert.ok(m.drop(...p));const phases=new Set();for(let i=0;i<4000&&m.state.phase!=='poem';i++){m.step(.05);phases.add(m.state.phase);if(['sip','think'].includes(m.state.phase))assert.equal(m.state.speed,0);}assert.ok(phases.has('sip'));assert.ok(phases.has('think'));assert.equal(m.state.phase,'poem');assert.equal(m.state.speed,0);assert.ok(Math.hypot(m.state.e-p[0],m.state.n-p[1])<3.5);const parked=[m.state.e,m.state.n];for(let i=0;i<200;i++)m.step(.05);assert.deepEqual([m.state.e,m.state.n],parked);m.resume();assert.equal(m.state.wine,null);assert.equal(m.state.phase,'drive');assert.equal(m.drop(0,0),false);m.reset();assert.equal(m.state.phase,'home');});

test('isolated DEM crests, outer edges and along-divide travel do not launch jumps',()=>{
 const polygon=(id,x0,x1)=>({properties:{id},geometry:{type:'Polygon',coordinates:[[[x0,-100],[x1,-100],[x1,100],[x0,100],[x0,-100]]]}});
 const f=[polygon('MH1',-100,0),polygon('MH2',0,100)];
 const crest=(e,n)=>100-Math.abs(e)*.2;
 const detect=createRidgeDetector({catchments:f,project:p=>p,height:crest,valid:()=>true});
 assert.equal(detect(0,0,Math.PI/2).id,'MH1/MH2');
 assert.equal(detect(20,0,Math.PI/2),null);assert.equal(detect(-100,0,Math.PI/2),null);assert.equal(detect(0,0,0),null);
 const slope=createRidgeDetector({catchments:f,project:p=>p,height:e=>100+e*.2,valid:()=>true});assert.equal(slope(0,0,Math.PI/2),null);
 const noBoundaries=createMotion({height,valid});for(let i=0;i<3600;i++)noBoundaries.step(.05);assert.equal(noBoundaries.state.jumps,0);
});

test('ice cream trips from home and every monitoring site park, swim two laps, and resume',async()=>{
 const {POOL,POOL_PHASES,poolPose}=await import('../field-sites/rancho/atlas/jerry-pool-trip.js');
 for(const start of [HOME,...DESTINATIONS.map(d=>d.point)]){
  const m=make();Object.assign(m.state,{e:start[0],n:start[1]});assert.ok(m.drop(...start,'icecream'));
  const phases=[];let swimSeconds=0;
  for(let i=0;i<6000;i++){
   const s=m.step(.05);assert.ok(valid(s.e,s.n));if(phases.at(-1)!==s.phase)phases.push(s.phase);
   if(POOL_PHASES.has(s.phase)){assert.equal(s.speed,0);assert.deepEqual([s.e,s.n],POOL.parking);assert.equal(m.drop(...HOME),false);}
   if(s.phase==='swim'){swimSeconds+=.05;const p=poolPose(s).point;assert.ok(Math.hypot(p[0]-POOL.center[0],p[1]-POOL.center[1])<5.3);}
   if(s.phase==='drive')break;
  }
  assert.deepEqual(phases,['eat','pool-drive','change-swim','walk-pool','swim','walk-back','change-drive','drive']);
  assert.ok(Math.abs(swimSeconds-26)<.1);assert.equal(m.state.laps,2);assert.equal(m.state.wine,null);
  for(let i=0;i<100;i++)m.step(.05);assert.ok(m.state.speed>5);
 }
});
test('home and destination controls can interrupt a pool visit, and wine still works afterward',()=>{
 for(const phase of ['eat','pool-drive','change-swim','walk-pool','swim','walk-back','change-drive']){
  const m=make();Object.assign(m.state,{phase,item:'icecream',speed:0});m.reset();assert.equal(m.state.phase,'home');assert.equal(m.state.item,'wine');
  Object.assign(m.state,{phase,item:'icecream'});assert.ok(m.go('mh7'));assert.equal(m.state.phase,'drive');assert.ok(m.drop(m.state.e,m.state.n));m.step(.05);assert.equal(m.state.phase,'sip');
 }
});
