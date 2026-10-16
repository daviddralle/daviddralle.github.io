// Separate zoom from orbit/pan: OrbitControls emits `start` for all three.
export function bindJerryCameraGestures({canvas,distance,canInteract,onPan,onZoom,onOrbit}) {
  const pointers=new Map(),zoomEvents=new WeakMap(),orbitEvents=new WeakSet();let pair=null;
  const pairGeometry=()=>{const [a,b]=[...pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,span:Math.hypot(a.x-b.x,a.y-b.y)};};
  function resetAnchor(){pair=pointers.size===2?pairGeometry():null;for(const p of pointers.values()){p.startX=p.x;p.startY=p.y;}}
  function retainZoom(event){if(canInteract())zoomEvents.set(event,distance());}
  function finishZoom(event){
    const before=zoomEvents.get(event);zoomEvents.delete(event);
    if(orbitEvents.has(event)){orbitEvents.delete(event);if(canInteract())onOrbit();}
    // Document bubbling runs after OrbitControls' canvas listener, including
    // pointermove listeners it installs dynamically at gesture start.
    if(canInteract()&&before>0){const ratio=distance()/before;if(Number.isFinite(ratio)&&ratio>0)onZoom(ratio);}
  }
  for(const type of ['wheel','pointermove'])(canvas.ownerDocument||canvas).addEventListener(type,finishZoom);
  canvas.addEventListener('wheel',retainZoom,{capture:true,passive:true});
  canvas.addEventListener('pointerdown',e=>{
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,touch:e.pointerType==='touch',button:e.button,pan:(e.button===0&&!!(e.ctrlKey||e.metaKey||e.shiftKey))||(e.button===2&&!(e.ctrlKey||e.metaKey||e.shiftKey))});resetAnchor();
  },true);
  canvas.addEventListener('pointermove',e=>{
    const p=pointers.get(e.pointerId);if(!p)return;p.x=e.clientX;p.y=e.clientY;
    if(!canInteract())return;
    if(p.touch&&pointers.size===2){
      const now=pairGeometry(),translation=Math.hypot(now.x-pair.x,now.y-pair.y),spread=Math.abs(now.span-pair.span);
      // A pinch may move its midpoint a little; a deliberate two-finger pan releases follow.
      if(translation>8&&translation>spread*.75)onPan();else retainZoom(e);
    }else if(!p.touch&&p.button===1){retainZoom(e);}
    else if(p.touch||!p.pan){orbitEvents.add(e);}
    else if(Math.hypot(p.x-p.startX,p.y-p.startY)>5){onPan();}
  },true);
  const finish=e=>{pointers.delete(e.pointerId);resetAnchor();};
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,finish,true);
}
