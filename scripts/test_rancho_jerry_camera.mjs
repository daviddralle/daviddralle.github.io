import test from 'node:test';
import assert from 'node:assert/strict';
import {bindJerryCameraGestures} from '../field-sites/rancho/atlas/jerry-camera.js';
function fixture(){
  const canvas=new EventTarget();canvas.ownerDocument=new EventTarget();let following=true,radius=30,zoom=1;
  bindJerryCameraGestures({canvas,distance:()=>radius,canInteract:()=>following,onDrag:()=>{following=false;},onZoom:r=>{zoom*=r;}});
  canvas.addEventListener('wheel',()=>{radius*=.8;});
  const fire=(type,values={})=>{const event=new Event(type);Object.assign(event,{pointerId:1,pointerType:'mouse',button:0,clientX:0,clientY:0,...values});canvas.dispatchEvent(event);canvas.ownerDocument.dispatchEvent(event);};
  return {canvas,fire,get following(){return following;},get zoom(){return zoom;}};
}
test('wheel zoom keeps follow and retains the new distance',async()=>{const f=fixture();f.fire('wheel');await Promise.resolve();assert.equal(f.following,true);assert.ok(Math.abs(f.zoom-.8)<1e-9);f.fire('wheel');await Promise.resolve();assert.ok(Math.abs(f.zoom-.64)<1e-9);});
test('click and small pointer jitter keep follow; orbit/pan drags release it',()=>{for(const button of [0,2]){const f=fixture();f.fire('pointerdown',{button});f.fire('pointermove',{button,clientX:3});assert.equal(f.following,true);f.fire('pointerup',{button});assert.equal(f.following,true);f.fire('pointerdown',{button});f.fire('pointermove',{button,clientX:12});assert.equal(f.following,false);}});
test('middle-button zoom and two-finger spread keep follow; touch pan releases it',async()=>{const middle=fixture();middle.fire('pointerdown',{button:1});middle.fire('pointermove',{button:1,clientY:40});await Promise.resolve();assert.equal(middle.following,true);const f=fixture();f.fire('pointerdown',{pointerType:'touch',clientX:100});f.fire('pointerdown',{pointerId:2,pointerType:'touch',clientX:200});f.fire('pointermove',{pointerType:'touch',clientX:80});f.fire('pointermove',{pointerId:2,pointerType:'touch',clientX:220});await Promise.resolve();assert.equal(f.following,true);f.fire('pointerup',{pointerId:2});f.fire('pointerup');f.fire('pointerdown',{pointerType:'touch',clientX:100});f.fire('pointerdown',{pointerId:2,pointerType:'touch',clientX:200});f.fire('pointermove',{pointerType:'touch',clientY:25,clientX:100});assert.equal(f.following,false);});
