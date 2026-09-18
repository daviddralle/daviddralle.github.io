import assert from 'node:assert/strict';
import {PLANETS,globePoint,GAIA_MAP,SOLAR_DISPLAY} from '../field-sites/rivendell/atlas/cosmic-model.js';
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

// Regression: enlarged symbols and the solar glow must not engulf inner orbits.
const inner=PLANETS.slice(0,4),scale=SOLAR_DISPLAY.unitsPerAU;
assert.ok(SOLAR_DISPLAY.sunRadius+inner[0].radius < inner[0].au*scale*.5);
assert.ok(SOLAR_DISPLAY.sunGlowDiameter/2 < inner[0].au*scale-inner[0].radius);
for(let i=1;i<inner.length;i++){
 assert.ok((inner[i].au-inner[i-1].au)*scale > inner[i].radius+inner[i-1].radius);
}
console.log('PASS: Sun, Mercury, and inner-planet symbols have clear orbital separation');
