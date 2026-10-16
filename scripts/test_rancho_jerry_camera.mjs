import test from 'node:test';
import assert from 'node:assert/strict';
import {bindJerryCameraGestures} from '../field-sites/rancho/atlas/jerry-camera.js';
function fixture(){
  const canvas=new EventTarget();canvas.ownerDocument=new EventTarget();let following=true,radius=30,zoom=1,angle=0,retainedAngle=null;
  bindJerryCameraGestures({canvas,distance:()=>radius,canInteract:()=>following,onPan:()=>{following=false;},onZoom:r=>{zoom*=r;},onOrbit:()=>{retainedAngle=angle;}});
  canvas.addEventListener('wheel',()=>{radius*=.8;});
  canvas.addEventListener('pointermove',()=>{angle+=.1;});
  const fire=(type,values={})=>{const event=new Event(type);Object.assign(event,{pointerId:1,pointerType:'mouse',button:0,clientX:0,clientY:0,...values});canvas.dispatchEvent(event);canvas.ownerDocument.dispatchEvent(event);};
  return {canvas,fire,get following(){return following;},get zoom(){return zoom;},get retainedAngle(){return retainedAngle;},get angle(){return angle;}};
}
test('wheel zoom keeps follow and retains the new distance',async()=>{const f=fixture();f.fire('wheel');await Promise.resolve();assert.equal(f.following,true);assert.ok(Math.abs(f.zoom-.8)<1e-9);f.fire('wheel');await Promise.resolve();assert.ok(Math.abs(f.zoom-.64)<1e-9);});
test('click-drag and single-touch rotation retain follow and the post-orbit angle',()=>{for(const pointerType of ['mouse','touch']){const f=fixture();f.fire('pointerdown',{pointerType});f.fire('pointermove',{pointerType,clientX:30});assert.equal(f.following,true);assert.equal(f.retainedAngle,f.angle);f.fire('pointerup',{pointerType});assert.equal(f.following,true);}});
test('Ctrl/Command-drag and right-drag pan release follow; click and jitter do not',()=>{for(const props of [{ctrlKey:true},{metaKey:true},{button:2}]){const f=fixture();f.fire('pointerdown',props);f.fire('pointermove',{...props,clientX:3});assert.equal(f.following,true);f.fire('pointerup',props);assert.equal(f.following,true);f.fire('pointerdown',props);f.fire('pointermove',{...props,clientX:12});assert.equal(f.following,false);assert.equal(f.retainedAngle,null);}});
test('middle-button zoom and two-finger spread keep follow; touch pan releases it',async()=>{const middle=fixture();middle.fire('pointerdown',{button:1});middle.fire('pointermove',{button:1,clientY:40});await Promise.resolve();assert.equal(middle.following,true);const f=fixture();f.fire('pointerdown',{pointerType:'touch',clientX:100});f.fire('pointerdown',{pointerId:2,pointerType:'touch',clientX:200});f.fire('pointermove',{pointerType:'touch',clientX:80});f.fire('pointermove',{pointerId:2,pointerType:'touch',clientX:220});await Promise.resolve();assert.equal(f.following,true);f.fire('pointerup',{pointerId:2});f.fire('pointerup');f.fire('pointerdown',{pointerType:'touch',clientX:100});f.fire('pointerdown',{pointerId:2,pointerType:'touch',clientX:200});f.fire('pointermove',{pointerType:'touch',clientY:25,clientX:100});assert.equal(f.following,false);});
