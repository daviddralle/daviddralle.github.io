import assert from 'node:assert/strict';
import {PLANETS,globePoint,GAIA_MAP} from '../field-sites/rivendell/atlas/cosmic-model.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
// Geographic texture registration: round-trip both hemispheres and dateline.
for(const [lat,lon] of [[39.72892,-123.64404],[-35,150],[0,0],[0,179],[80,-45]]){
 const [x,y,z]=globePoint(lat,lon,100);
 close(Math.hypot(x,y,z),100);
 close(Math.asin(y/100)*180/Math.PI,lat);
 close(Math.atan2(-z,x)*180/Math.PI,lon);
}
close(globePoint(90,0)[1],100);
assert.equal(PLANETS.length,8);
assert.equal(PLANETS.find(p=>p.name==='Earth').au,1);
assert.ok(PLANETS.every((p,i)=>!i||p.au>PLANETS[i-1].au));
// The Sun must stay on the published labelled image coordinate as scale changes.
const dx=GAIA_MAP.sun[0]-GAIA_MAP.center[0],dy=GAIA_MAP.sun[1]-GAIA_MAP.center[1];
close(Math.hypot(dx,dy)*GAIA_MAP.width*500,26000);
assert.ok(GAIA_MAP.sun.every(v=>v>0&&v<1));
console.log('PASS: globe registration, planetary distances, Gaia Sun position and scale');
