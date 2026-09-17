import assert from 'node:assert/strict';
import * as THREE from '../field-sites/rivendell/atlas/vendor/three/three.module.js';
import {createBill} from '../field-sites/rivendell/atlas/bill.js';
const elements=new Map();
class Element {
 constructor(){this.listeners={};this.style={};this.dataset={};this.hidden=false;this.captures=new Set();this.classList={toggle(){},add(){},remove(){}};this.attrs={};}
 set id(v){this._id=v;elements.set('#'+v,this);}get id(){return this._id;}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 fire(type,props={}){const e={type,button:0,pointerId:1,clientX:400,clientY:400,target:this,preventDefault(){},stopImmediatePropagation(){},...props};for(const fn of this.listeners[type]||[])fn(e);return e;}
 setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}
 setPointerCapture(id){this.captures.add(id);}hasPointerCapture(id){return this.captures.has(id);}releasePointerCapture(id){this.captures.delete(id);}
 append(){}remove(){}contains(el){return this===el;}getBoundingClientRect(){return {left:0,top:0,right:1000,bottom:800,width:1000,height:800};}
}
const el=id=>{if(!elements.has(id)){const e=new Element();e.id=id.slice(1);}return elements.get(id);};
const canvas=new Element(),container=new Element(),doc=new Element();let overGround=true,now=0;
globalThis.document=Object.assign(doc,{querySelector:el,createElement:()=>new Element(),elementFromPoint:()=>overGround?canvas:null});
globalThis.window=new Element();globalThis.matchMedia=()=>({matches:false});globalThis.performance={now:()=>now};
const host=new Element();host.parentElement=container;host.clientWidth=1000;host.clientHeight=800;host.querySelector=()=>canvas;
const camera=new THREE.PerspectiveCamera(43,1,.2,6000);const controls=Object.assign(new Element(),{target:new THREE.Vector3(),enabled:true,autoRotate:false,update(){}});
const heightAt=(x,n)=>400+.1*x+.2*n,origin=[0,0,400];
const bill=createBill({scene:new THREE.Scene(),pits:{clear(){},begin(){return null;}},heightAt,origin,camera,controls,host,render(){},project:v=>({x:400+v.x*10,y:400-v.y*10,z:0}),pickGround:(x,y)=>{const e=(x-400)/10,z=(y-400)/10;return new THREE.Vector3(e,heightAt(e,-z)-400,z);},stations:[{x:0,z:0,label:'A'},{x:100,z:0,label:'B'}],explore(){}});
el('#bill-toggle').onclick();
let overlay;bill.renderOverlay({autoClear:true,clearDepth(){},render(s){overlay=s;}},camera);const root=overlay.children.find(o=>o.isGroup);const label=el('#bill-label');
const tick=dt=>{now+=dt*1000;bill.update(dt);};
const down=()=>label.fire('pointerdown');
const move=(x,y)=>{doc.fire('pointermove',{clientX:x,clientY:y,target:canvas});tick(.016);};
const up=(x,y)=>doc.fire('pointerup',{clientX:x,clientY:y,target:canvas});
const initialCamera=camera.position.clone();down();assert(bill.carrying);assert(!controls.enabled);move(480,440);const billRing=overlay.children.find(o=>o.geometry?.type==='RingGeometry'&&o.visible);assert(billRing);assert.equal(billRing.position.x,8);assert.equal(billRing.position.z,4);assert(Math.abs(billRing.position.y-(heightAt(8,-4)-400+.08))<1e-9);assert(overlay.children.some(o=>o.isLine&&o.visible));assert(root.position.y>heightAt(8,-4)-400+1);up(480,440);assert(!bill.carrying&&controls.enabled);assert(Math.abs(root.position.y-(heightAt(8,-4)-400))<1e-9);assert.deepEqual(camera.position.toArray(),initialCamera.toArray());
const before=root.position.clone();down();up(400,400);assert(root.position.distanceTo(before)<1e-9);down();move(520,450);doc.fire('pointercancel');assert(root.position.distanceTo(before)<1e-9);assert(controls.enabled);
down();move(520,450);overGround=false;up(520,450);overGround=true;assert(root.position.distanceTo(before)<1e-9);assert(!bill.carrying);
el('#bill-pause').onclick();down();move(490,440);up(490,440);tick(.1);assert.equal(el('#bill-pause').textContent,'Resume');el('#bill-pause').onclick();
// A nearby snack interrupts the walking/measurement route, is consumed, and starts one boost.
el('#bill-chocolate').fire('pointerdown');doc.fire('pointermove',{clientX:500,clientY:440,target:canvas});tick(.016);assert.equal(container.dataset.chocolateDropValid,'true');assert(!controls.enabled);const foodRing=overlay.children.find(o=>o.geometry?.type==='RingGeometry'&&o.visible);assert(foodRing);assert.equal(foodRing.position.x,10);assert.equal(foodRing.position.z,4);assert.equal(foodRing.material.color.getHex(),billRing.material.color.getHex());up(500,440);assert.equal(container.dataset.billChocolateCount,'1');
for(let i=0;i<120&&Number(container.dataset.billBoostSeconds)===0;i++)tick(.05);
assert(Number(container.dataset.billBoostSeconds)>0);assert.equal(container.dataset.billChocolateCount,'0');
let old=root.position.clone();tick(.1);const fast=Math.hypot(root.position.x-old.x,root.position.z-old.z);assert(Math.abs(fast-.34)<1e-7);
now+=30001;old=root.position.clone();tick(.1);const normal=Math.hypot(root.position.x-old.x,root.position.z-old.z);assert(Math.abs(normal-.17)<1e-7);assert.equal(container.dataset.billBoostSeconds,'0');
// Distant chocolate does not attract Bill until he is within the detection radius.
el('#bill-chocolate').fire('pointerdown');up(950,950);tick(.1);assert.equal(container.dataset.billChocolateCount,'1');assert(!el('#bill-status').textContent.includes('Chocolate spotted'));
// Cancelling a chocolate drag restores navigation and creates no extra snack.
const count=container.dataset.billChocolateCount;el('#bill-chocolate').fire('pointerdown');doc.fire('pointermove',{clientX:510,clientY:440,target:canvas});tick(.016);doc.fire('pointercancel');assert(!bill.dragging);assert(controls.enabled);assert.equal(container.dataset.billChocolateCount,count);
console.log('PASS: held pickup, ground drop, fixed camera, pointer cancellation, invalid drop, paused-state restoration, nearby chocolate, distant detection limit, 2x speed and 30-second expiry.');
