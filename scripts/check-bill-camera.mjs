import assert from 'node:assert/strict';
import * as THREE from '../field-sites/rivendell/atlas/vendor/three/three.module.js';
import {createBillCamera} from '../field-sites/rivendell/atlas/bill-camera.js';

const camera=new THREE.PerspectiveCamera(),controls={target:new THREE.Vector3(),update(){camera.lookAt(this.target);}};
const ground=(x,z)=>.4*z+.08*x;
const follow=createBillCamera({camera,controls,ground}),p=new THREE.Vector3();
let view=follow.update(p,0,0,{snap:true});
assert.equal(view.mode,'front');assert(camera.position.z>12,'Uphill camera must see his face');
assert.equal(controls.target.y,1.2);
view=follow.update(p,Math.PI,0,{snap:true});
assert.equal(view.mode,'side');assert(Math.abs(camera.position.x)>13,'Downhill camera must travel beside him');
assert(camera.position.z<0,'Side view should still favor the front, never trail behind');
// Abrupt destination reversal must ease around Bill rather than cut through him.
for(let i=0;i<600;i++){
 const before=Math.atan2(camera.position.x-p.x,camera.position.z-p.z);
 view=follow.update(p,0,1/60);
 const after=Math.atan2(camera.position.x-p.x,camera.position.z-p.z);
 assert(Math.abs(Math.atan2(Math.sin(after-before),Math.cos(after-before)))<=.7/60+1e-10);
 assert(Math.abs(Math.hypot(camera.position.x-p.x,camera.position.z-p.z)-14)<1e-10);
 assert(camera.position.y>=ground(camera.position.x,camera.position.z)+3-1e-10);
}
assert.equal(view.mode,'front');assert(camera.position.z>12);
follow.update(p,0,0,{snap:true});
const stable=camera.position.clone();
for(let i=0;i<120;i++)follow.update(new THREE.Vector3(0,Math.sin(i)*.04,0),0,1/60,{moving:false});
assert(camera.position.distanceTo(stable)<.02,'Gait bounce must not bob the camera');
// A near-flat noisy patch should not alternate side/front on every terrain cell.
let noise=0;
const flat=createBillCamera({camera,controls,ground:(x,z)=>(-.04+noise)*z});
flat.update(p,0,0,{snap:true});
for(let i=0;i<300;i++){noise=i%2?.015:-.015;assert.equal(flat.update(p,0,1/60).mode,'front');}
console.log('PASS: uphill face view, downhill side view, smooth turnarounds, fixed orbit radius, terrain clearance, stable stops and slope hysteresis.');

// A wheel zoom changes the persistent orbit distance, even as Bill walks.
follow.update(p,0,0,{snap:true});
camera.position.sub(controls.target).multiplyScalar(2).add(controls.target);
follow.adoptZoom(p);
for(let i=0;i<120;i++){p.z+=.02;follow.update(p,0,1/60);}
assert(Math.abs(Math.hypot(camera.position.x-p.x,camera.position.z-p.z)-28)<1e-9);
console.log('PASS: zoom distance persists during follow movement.');
