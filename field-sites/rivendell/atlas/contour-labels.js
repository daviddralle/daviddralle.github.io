/* Shared map/3D label placement. Contours have lower priority than field labels. */
window.AtlasContourLabels={layout({lines,project,width,height,obstacles=[],points=[],visible=()=>true}){
 const candidates=[],out=[],accepted=[];
 const overlap=(a,b,p=7)=>a.x<b.x+b.w+p&&a.x+a.w+p>b.x&&a.y<b.y+b.h+p&&a.y+a.h+p>b.y;
 for(const line of lines){
  const runs=[];let run=[];
  for(const world of line.points){const p=project(world);
   if(!p||p.z!==undefined&&(p.z<=-1||p.z>=1)||p.x<0||p.x>width||p.y<0||p.y>height){if(run.length>1)runs.push(run);run=[];continue;}
   const last=run.at(-1);if(!last||Math.hypot(p.x-last.x,p.y-last.y)>=7)run.push({...p,world});
  }if(run.length>1)runs.push(run);
  for(const run of runs){let arc=0,next=38;
   for(let i=1;i<run.length-1;i++){arc+=Math.hypot(run[i].x-run[i-1].x,run[i].y-run[i-1].y);if(arc<next)continue;next=arc+65;
    let l=i-1,r=i+1;while(l>0&&Math.hypot(run[i].x-run[l].x,run[i].y-run[l].y)<25)l--;while(r<run.length-1&&Math.hypot(run[r].x-run[i].x,run[r].y-run[i].y)<25)r++;
    const a=run[l],b=run[r],p=run[i],dx=b.x-a.x,dy=b.y-a.y,span=Math.hypot(dx,dy);if(span<40)continue;
    const bend=Math.abs(dx*(a.y-p.y)-(a.x-p.x)*dy)/span;if(bend>5)continue;
    let angle=Math.atan2(dy,dx);if(angle>Math.PI/2)angle-=Math.PI;if(angle< -Math.PI/2)angle+=Math.PI;
    const w=44,h=17,bw=Math.abs(w*Math.cos(angle))+Math.abs(h*Math.sin(angle)),bh=Math.abs(w*Math.sin(angle))+Math.abs(h*Math.cos(angle));
    const box={x:p.x-bw/2,y:p.y-bh/2,w:bw,h:bh};
    if(box.x<14||box.y<14||box.x+bw>width-14||box.y+bh>height-48)continue;
    if(obstacles.some(o=>overlap(box,o))||points.some(o=>overlap(box,{x:o.x-6,y:o.y-6,w:12,h:12})))continue;
    candidates.push({p,box,angle,elevation:line.elevation,score:bend*12+Math.abs(angle)*8+Math.hypot(p.x-width/2,p.y-height/2)*.025});
   }
  }
 }
 candidates.sort((a,b)=>a.score-b.score);
 const max=Math.max(3,Math.min(24,Math.floor(width*height/28000)));
 for(const c of candidates){
  if(accepted.some(a=>overlap(a.box,c.box,20)||Math.hypot(a.p.x-c.p.x,a.p.y-c.p.y)<(a.elevation===c.elevation?260:105)))continue;
  if(!visible(c.p.world))continue;
  const el=document.createElement('span');el.className='contour-elevation-label';el.textContent=`${c.elevation} m`;
  el.style.cssText=`left:${c.p.x}px;top:${c.p.y}px;transform:translate(-50%,-50%) rotate(${c.angle}rad)`;
  out.push(el);accepted.push(c);if(out.length>=max)break;
 }
 return out;
}};
