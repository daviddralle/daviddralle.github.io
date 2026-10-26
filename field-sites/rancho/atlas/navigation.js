import * as THREE from './vendor/three/three.module.js';

export function wheelPixels(event, pageHeight=800) {
  return event.deltaY * (event.deltaMode===1?16:event.deltaMode===2?pageHeight:1) * (event.ctrlKey?8:1);
}

// Translate the eye and pivot together: zoom never runs into the old orbit pivot.
export function dollyView(camera,controls,direction,distance,pixels) {
  const scale=Math.max(12,Math.min(distance,10000));
  const amount=scale*(1-Math.exp(THREE.MathUtils.clamp(pixels*.0025,-.7,.7)));
  camera.position.addScaledVector(direction,amount);
  controls.target.addScaledVector(direction,amount);
  controls.update();
}

export function createNavigation({camera,controls,canvas,surface,isFollowing,releaseFollow,reset}) {
  const ray=new THREE.Raycaster();
  const toolbar=document.createElement('div');toolbar.className='scene-navigation';toolbar.setAttribute('aria-label','3D navigation');
  toolbar.innerHTML='<div role="group" aria-label="Drag action"><button data-mode="rotate" aria-pressed="true">Rotate</button><button data-mode="pan" aria-pressed="false">Pan</button></div><button data-zoom="-100" aria-label="Zoom in" title="Zoom in (+)">+</button><button data-zoom="100" aria-label="Zoom out" title="Zoom out (−)">−</button><button data-reset title="Reset view (Home)">Reset</button><details><summary aria-label="Navigation help">?</summary><p>Two-finger swish or pinch: zoom toward the pointer.<br>Drag: rotate around the view’s center.<br>Pan button or Shift-drag: move the view.<br>Keyboard, with the view focused: arrows pan, +/− zoom, Home resets.</p></details>';
  canvas.parentElement.append(toolbar);
  canvas.tabIndex=0;
  canvas.setAttribute('aria-label','3D terrain. Drag to rotate; Shift-drag to pan; two-finger scroll or pinch to zoom toward the pointer. Arrow keys pan, plus and minus zoom, Home resets.');
  controls.minDistance=.5;controls.maxDistance=Infinity;controls.zoomSpeed=2;
  controls.screenSpacePanning=true;
  let mode='rotate';
  function hitAt(x=0,y=0) {
    camera.updateMatrixWorld();surface.updateWorldMatrix(true,false);
    ray.setFromCamera(new THREE.Vector2(x,y),camera);
    return ray.intersectObject(surface,false)[0];
  }
  function centerPivot() {
    if(isFollowing())return;
    const hit=hitAt();
    // Keep the center ray unchanged, including when looking beyond the terrain.
    const distance=hit?Math.max(1,hit.distance):Math.max(12,camera.position.distanceTo(controls.target));
    controls.target.copy(camera.position).addScaledVector(ray.ray.direction,distance);
    controls.update();
  }
  function zoom(pixels,clientX,clientY) {
    controls.minDistance=.5;
    const bounds=canvas.getBoundingClientRect();
    const x=clientX==null?0:(clientX-bounds.left)/bounds.width*2-1;
    const y=clientY==null?0:1-(clientY-bounds.top)/bounds.height*2;
    const hit=hitAt(x,y),direction=ray.ray.direction.clone();
    dollyView(camera,controls,direction,hit?.distance??camera.position.distanceTo(controls.target),pixels);
    centerPivot();
  }
  canvas.addEventListener('wheel',event=>{
    if(!controls.enabled)return;
    event.preventDefault();event.stopImmediatePropagation();releaseFollow();
    zoom(wheelPixels(event,canvas.clientHeight),event.clientX,event.clientY);
  },{capture:true,passive:false});
  canvas.addEventListener('pointerdown',()=>{
    if(!controls.enabled)return;
    canvas.focus({preventScroll:true});
    if(mode==='pan')releaseFollow();
    if(!isFollowing())controls.minDistance=.5;
    centerPivot();
  },true);
  // Pinch/middle-button zoom still use OrbitControls; refresh a near pivot so
  // repeated gestures can advance instead of reaching a fixed-coordinate wall.
  controls.addEventListener('end',()=>{
    if(!isFollowing()&&camera.position.distanceTo(controls.target)<2){
      camera.getWorldDirection(ray.ray.direction);
      controls.target.copy(camera.position).addScaledVector(ray.ray.direction,12);controls.update();
    }
  });
  toolbar.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||!controls.enabled)return;
    if(button.dataset.mode){
      mode=button.dataset.mode;controls.mouseButtons.LEFT=mode==='pan'?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;controls.touches.ONE=mode==='pan'?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE;
      toolbar.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    }else if(button.dataset.zoom){releaseFollow();zoom(Number(button.dataset.zoom));}
    else if(button.hasAttribute('data-reset'))reset();
  });
  canvas.addEventListener('keydown',event=>{
    if(!controls.enabled||event.altKey||event.ctrlKey||event.metaKey)return;
    if(['+','=','-','_','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
      event.preventDefault();releaseFollow();
      if(event.key==='Home'){reset();return;}
      if(['+','=','-','_'].includes(event.key)){zoom(['+','='].includes(event.key)?-100:100);return;}
      const distance=Math.max(12,camera.position.distanceTo(controls.target))*.06;
      camera.updateMatrixWorld();
      const direction=new THREE.Vector3().setFromMatrixColumn(camera.matrix,event.key==='ArrowLeft'||event.key==='ArrowRight'?0:1);
      direction.multiplyScalar(distance*(event.key==='ArrowLeft'||event.key==='ArrowDown'?-1:1));
      camera.position.add(direction);controls.target.add(direction);controls.update();
    }
  });
  return {centerPivot};
}
