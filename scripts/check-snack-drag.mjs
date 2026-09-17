import assert from 'node:assert/strict';
import * as THREE from '../field-sites/rivendell/atlas/vendor/three/three.module.js';
import {createBill} from '../field-sites/rivendell/atlas/bill.js';
// Exercise the production interaction handlers, including down/up with no animation frame.
function setup(kind){
 const elements=new Map();let hit=true,captureFails=false;
 class Element {
  constructor(){this.listeners={};this.style={};this.dataset={};this.hidden=false;this.captures=new Set();this.children=[];this.attrs={};this.textContent='';const classes=new Set();this.classList={add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c)};}
  set id(v){this._id=v;elements.set('#'+v,this);}get id(){return this._id;}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  fire(type,props={}){const e={type,button:0,isPrimary:true,pointerId:1,clientX:500,clientY:100,target:this,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;},...props};for(const fn of this.listeners[type]||[])fn(e);return e;}
  setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}
  setPointerCapture(id){if(captureFails)throw new Error('Capture unavailable');this.captures.add(id);}hasPointerCapture(id){return this.captures.has(id);}releasePointerCapture(id){this.captures.delete(id);this.fire('lostpointercapture',{pointerId:id});}
  append(e){this.children.push(e);}remove(){this.removed=true;}contains(el){return this===el;}getBoundingClientRect(){return {left:0,top:0,right:1000,bottom:800,width:1000,height:800};}
 }
 const el=id=>{if(!elements.has(id)){const e=new Element();e.id=id.slice(1);}return elements.get(id);};
 const canvas=new Element(),container=new Element(),doc=new Element(),win=new Element();
 globalThis.document=Object.assign(doc,{querySelector:el,createElement:()=>new Element(),elementFromPoint:(x,y)=>hit&&y>=200?canvas:null});
 globalThis.window=win;globalThis.matchMedia=()=>({matches:false});globalThis.performance={now:()=>0};
 el('#bill-chocolate').textContent='🍫 Chocolate';el('#bill-almonds').textContent='Almonds';
 const host=new Element();host.parentElement=container;host.clientWidth=1000;host.clientHeight=800;host.querySelector=()=>canvas;
 const camera=new THREE.PerspectiveCamera(43,1,.2,6000),controls=Object.assign(new Element(),{target:new THREE.Vector3(),enabled:true,autoRotate:false,update(){}});
 const bill=createBill({scene:new THREE.Scene(),pits:{clear(){},begin(){return null;}},heightAt:(x,n)=>400+.1*x+.2*n,origin:[0,0,400],camera,controls,host,render(){},project:v=>({x:400+v.x*10,y:400-v.y*10,z:0}),pickGround:(x,y)=>new THREE.Vector3((x-400)/10,.1*(x-400)/10-.2*(y-400)/10,(y-400)/10),stations:[{x:0,z:0,label:'A'}],explore(){}});
 el('#bill-toggle').onclick();el('#bill-pause').onclick();
 const button=el(kind==='almond'?'#bill-almonds':'#bill-chocolate'),key=kind==='almond'?'billAlmondCount':'billChocolateCount';
 return {bill,canvas,container,doc,win,button,controls,el,camera,count:()=>Number(container.dataset[key]),hit:v=>{hit=v;},captureFails:v=>{captureFails=v;},start:props=>button.fire('pointerdown',props),up:props=>doc.fire('pointerup',{clientX:500,clientY:500,...props}),tags:()=>container.children.filter(e=>e.className?.includes('chocolate-label')&&!e.removed)};
}
for(const kind of ['chocolate','almond']){
 let h=setup(kind);const text=h.button.textContent,camera=h.camera.position.clone();
 h.start();assert(h.bill.dragging);assert(h.canvas.hasPointerCapture(1));assert.equal(h.button.textContent,text);assert(!h.controls.enabled);
 h.up();assert.equal(h.tags()[0].style.left,'500px');assert.equal(h.tags()[0].hidden,false);assert.equal(h.count(),1,`${kind}: very first, sub-frame drop`);assert(!h.bill.dragging);assert(h.controls.enabled);assert(h.camera.position.equals(camera));
 // Every subsequent press/release creates exactly one new snack, despite implicit capture loss.
 for(let n=2;n<=4;n++){h.start();h.up();h.up();assert.equal(h.count(),n);}
 // Re-grabbing a dropped snack neither hides the capture owner nor duplicates the food.
 const tag=h.tags()[0];tag.fire('pointerdown');assert(h.canvas.hasPointerCapture(1));assert(!h.canvas.hidden);h.up({clientX:600});assert.equal(h.count(),4);assert(!tag.hidden);
 tag.fire('pointerdown');h.doc.fire('pointercancel');assert(!tag.hidden);assert.equal(h.count(),4);assert(h.controls.enabled);
 // Native image/text DnD must never steal the pointer stream.
 assert.equal(h.button.draggable,false);assert(h.button.fire('dragstart').defaultPrevented);assert(tag.fire('dragstart').defaultPrevented);
 // Another finger/cancel/key release cannot steal or complete an active pointer gesture.
 h.start();h.button.fire('pointerdown',{pointerId:2,isPrimary:false});h.doc.fire('pointercancel',{pointerId:2});h.up({pointerId:2});h.button.fire('keyup',{code:'Space'});assert(h.bill.dragging);h.up();assert.equal(h.count(),5);
 // Returning to toolbar or leaving terrain cancels, and the next first attempt still works.
 h.start();h.up({clientY:100});assert.equal(h.count(),5);h.start();h.hit(false);h.up();h.hit(true);assert.equal(h.count(),5);h.start();h.up();assert.equal(h.count(),6);
 for(const cancel of [()=>h.doc.fire('pointercancel'),()=>h.canvas.fire('lostpointercapture'),()=>h.doc.fire('keydown',{key:'Escape'}),()=>h.win.fire('blur')]){h.start();cancel();assert(!h.bill.dragging);assert(h.controls.enabled);assert.equal(h.count(),6);}
 // Document listeners still complete the drop if pointer capture is unavailable.
 h=setup(kind);h.captureFails(true);h.start();h.up();assert.equal(h.count(),1);assert(h.controls.enabled);
 // A preview from the preceding frame must not override the actual release location.
 h=setup(kind);h.start();h.doc.fire('pointermove',{clientX:550,clientY:500});h.bill.update(.016);assert.equal(h.container.dataset.chocolateDropValid,'true');h.hit(false);h.up();assert.equal(h.count(),0);assert(!h.bill.dragging);
 // Keyboard drop and disabling Bill mode are independent of pointer ownership.
 h=setup(kind);h.button.fire('keydown',{code:'Space',repeat:false});h.button.fire('keyup',{code:'Space'});assert.equal(h.count(),1);h.start();h.el('#bill-toggle').onclick();assert(!h.bill.dragging);h.start();h.up();assert.equal(h.count(),1);
 console.log(`PASS ${kind}: fresh/fast/repeated drops, source stability, re-grab, native drag prevention, pointer ownership, invalid drops, interruption recovery, capture fallback, keyboard and mode exit.`);
}
