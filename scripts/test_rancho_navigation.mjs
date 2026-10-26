import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../field-sites/rancho/atlas/vendor/three/three.module.js';
import {dollyView,wheelPixels} from '../field-sites/rancho/atlas/navigation.js';

function view(){
  const camera=new THREE.PerspectiveCamera();camera.position.set(0,0,30);
  const controls={target:new THREE.Vector3(),update(){camera.lookAt(this.target);}};
  controls.update();return {camera,controls};
}
test('repeated close zooms pass the original target without losing sensitivity',()=>{
  const {camera,controls}=view(),direction=new THREE.Vector3(0,0,-1),travel=[];
  for(let i=0;i<80;i++){
    const before=camera.position.clone();
    dollyView(camera,controls,direction,Math.abs(camera.position.z),-20);
    travel.push(camera.position.distanceTo(before));
    assert.ok(Math.abs(camera.position.distanceTo(controls.target)-30)<1e-8);
  }
  assert.ok(camera.position.z<0,'can advance beyond the old XYZ pivot');
  assert.ok(Math.min(...travel)>.5,'close swishes retain useful movement');
  const before=camera.position.z;dollyView(camera,controls,direction,1,20);
  assert.ok(camera.position.z>before,'zoom out works immediately');
});
test('off-center zoom follows the pointer ray and preserves view direction',()=>{
  const {camera,controls}=view();
  const direction=new THREE.Vector3(1,0,-1).normalize(),heading=camera.getWorldDirection(new THREE.Vector3());
  dollyView(camera,controls,direction,25,-100);
  assert.ok(camera.position.x>0,'moves toward the edge target');
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(heading)<1e-8);
  assert.ok(Number.isFinite(camera.position.length()));
});
test('trackpad, wheel line/page units and pinch all produce bounded movement',()=>{
  assert.equal(wheelPixels({deltaY:2,deltaMode:1}),32);
  assert.equal(wheelPixels({deltaY:1,deltaMode:2},600),600);
  assert.equal(wheelPixels({deltaY:-2,deltaMode:0,ctrlKey:true}),-16);
  for(const pixels of [-1e9,1e9]){const {camera,controls}=view();dollyView(camera,controls,new THREE.Vector3(0,0,-1),1e9,pixels);assert.ok(camera.position.length()<11000);}
});
