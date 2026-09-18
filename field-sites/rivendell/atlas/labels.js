/* Screen-space cartographic labels, recomputed after map and UI changes.
   Never move source features. Hide lower-priority labels when no clear slot exists. */
window.setupMapLabels=function(){
 const overlay=document.createElement('div');overlay.id='cartographic-labels';overlay.setAttribute('aria-hidden','true');$('.map-shell').append(overlay);
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('label-leaders');overlay.append(svg);
 const labels=document.createElement('div');overlay.append(labels);
 let raf=0;window.scheduleLabels=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;layout();});};
 const intersects=(a,b,p=3)=>a.x<b.x+b.w+p&&a.x+a.w+p>b.x&&a.y<b.y+b.h+p&&a.y+a.h+p>b.y;
 function layout(){
  if(!map)return;const size=map.getSize(),z=map.getZoom(),base=$('.map-shell').getBoundingClientRect();
  if(z<16){labels.replaceChildren();svg.replaceChildren();overlay.dataset.placed='0';overlay.dataset.candidates='0';return;}
  const obstacles=[...document.querySelectorAll('.map-title,.map-tools,#inspector,.leaflet-control-zoom,.map-bottom,.leaflet-control-scale,#map-message:not([hidden]),#canopy-legend:not([hidden])')].filter(e=>!e.hidden&&getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return{x:r.left-base.left,y:r.top-base.top,w:r.width,h:r.height};});
  const points=[],candidates=[];
  for(const id of S.visible){const d=manifest.layers.find(l=>l.id===id);for(const f of S.data.get(id).features){if(f.geometry.type!=='Point'||!matches(f,d))continue;const [lng,lat]=f.geometry.coordinates,p=map.latLngToContainerPoint([lat,lng]);if(p.x<0||p.x>size.x||p.y<0||p.y>size.y)continue;const r=style(f,d).radius;points.push({x:p.x,y:p.y,r,uid:f.properties.uid});let text,priority;
   if(d.kind==='well'){text=f.properties.label;priority=1000;}
   else if(d.kind==='tree'&&z>=20&&f.properties.tree_tag!=null){text=String(f.properties.tree_tag);priority=100+(f.properties.dbh_cm||0);}
   else if(d.kind==='port'&&z>=22){text='P'+f.properties.id;priority=30;}
   else if(d.kind==='survey'&&z>=22){text=String(f.properties.id);priority=20;}
   if(text)candidates.push({text,priority,p,r,f,d});
  }}
  candidates.sort((a,b)=>b.priority-a.priority);const placed=[],leaderLines=[],nodes=[];
  for(const c of candidates){const isWell=c.d.kind==='well',w=c.text.length*(isWell?6.65:6.1)+(isWell?13:10),h=isWell?22:19;const offsets=isWell?[12,24,38,54]:[7,14,23];let best=null;
   for(const gap of offsets){const options=[{x:c.p.x+c.r+gap,y:c.p.y-h/2},{x:c.p.x-c.r-gap-w,y:c.p.y-h/2},{x:c.p.x-w/2,y:c.p.y-c.r-gap-h},{x:c.p.x-w/2,y:c.p.y+c.r+gap},{x:c.p.x+c.r+gap,y:c.p.y-c.r-gap-h},{x:c.p.x-c.r-gap-w,y:c.p.y-c.r-gap-h},{x:c.p.x+c.r+gap,y:c.p.y+c.r+gap},{x:c.p.x-c.r-gap-w,y:c.p.y+c.r+gap}];
    for(const o of options){const b={...o,w,h};if(b.x<10||b.x+w>size.x-10||b.y<10||b.y+h>size.y-46)continue;if(obstacles.some(x=>intersects(b,x,6))||placed.some(x=>intersects(b,x,4)))continue;
     const coversPoint=points.some(p=>p.uid!==c.f.properties.uid&&p.x+p.r>b.x-2&&p.x-p.r<b.x+w+2&&p.y+p.r>b.y-2&&p.y-p.r<b.y+h+2);if(coversPoint)continue;
     const ax=Math.max(b.x,Math.min(c.p.x,b.x+w)),ay=Math.max(b.y,Math.min(c.p.y,b.y+h));const score=Math.hypot(ax-c.p.x,ay-c.p.y);if(!best||score<best.score)best={...b,ax,ay,score};
    }if(best)break;
   }
   if(!best)continue;placed.push(best);const node=document.createElement('span');node.className='map-feature-label '+(isWell?'well':'tree');node.textContent=c.text;node.style.cssText=`left:${best.x}px;top:${best.y}px;width:${best.w}px;height:${best.h}px`;nodes.push(node);
   const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('x1',c.p.x);line.setAttribute('y1',c.p.y);line.setAttribute('x2',best.ax);line.setAttribute('y2',best.ay);line.setAttribute('class',isWell?'well':'tree');leaderLines.push(line);
  }
  if($('#contours').checked)nodes.push(...window.AtlasContourLabels.layout({lines:window.atlasContourLines||[],project:c=>map.latLngToContainerPoint([c[1],c[0]]),width:size.x,height:size.y,obstacles:[...obstacles,...placed],points}));
  labels.replaceChildren(...nodes);svg.replaceChildren(...leaderLines);overlay.dataset.placed=String(nodes.length);overlay.dataset.candidates=String(candidates.length);
 }
 map.on('move zoomend resize',window.scheduleLabels);map.on('zoomend',()=>{for(const id of S.visible){const d=manifest.layers.find(l=>l.id===id);S.layers.get(id).eachLayer(l=>{if(l.setStyle)l.setStyle(style(l.feature,d));if(l.setRadius)l.setRadius(style(l.feature,d).radius);});}});
 new ResizeObserver(window.scheduleLabels).observe($('.map-shell'));window.scheduleLabels();
};
