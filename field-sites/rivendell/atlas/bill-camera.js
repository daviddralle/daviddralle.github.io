// Terrain-aware follow framing. Bill faces local +Z; angles use atan2(x, z).
export function createBillCamera({camera,controls,ground}){
 const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
 let radius=14,lift=7;
 let angle=0,grade=0,mode='front',side=1,ready=false;
 function slope(p,heading){const x=Math.sin(heading)*4,z=Math.cos(heading)*4;return (ground(p.x+x,p.z+z)-ground(p.x-x,p.z-z))/8;}
 function chooseSide(p,heading){
  const x=Math.cos(heading)*radius,z=-Math.sin(heading)*radius;
  return ground(p.x+x,p.z+z)<=ground(p.x-x,p.z-z)?1:-1;
 }
 function update(p,heading,dt,{snap=false,moving=true}={}){
  const fresh=snap||!ready;
  if(fresh){grade=slope(p,heading);mode=grade<-.05?'side':'front';side=chooseSide(p,heading);}
  else if(moving){
   grade+=(slope(p,heading)-grade)*(1-Math.exp(-dt/1.2));
   // Separate thresholds prevent noisy LiDAR cells from flipping the view.
   if(mode==='front'&&grade<-.07){mode='side';side=chooseSide(p,heading);}
   else if(mode==='side'&&grade>-.015)mode='front';
  }
  const desired=heading+side*(mode==='side'?Math.PI*.44:Math.PI*.10);
  if(fresh)angle=desired;
  else angle+=Math.max(-.7*dt,Math.min(.7*dt,wrap(desired-angle)*(1-Math.exp(-dt/1.1))));
  // Orbit on an arc, maintaining distance even through a complete turnaround.
  const x=p.x+radius*Math.sin(angle),z=p.z+radius*Math.cos(angle),targetY=ground(p.x,p.z)+1.2;
  let y=Math.max(targetY+lift,ground(x,z)+3);
  // Keep the view over intervening ground as well as the camera's own cell.
  for(let i=1;i<=12;i++){const t=i/12;y=Math.max(y,targetY+(ground(p.x+(x-p.x)*t,p.z+(z-p.z)*t)+.6-targetY)/t);}
  if(!fresh)y=Math.max(ground(x,z)+3,camera.position.y+(y-camera.position.y)*(1-Math.exp(-dt/1.1)));
  controls.target.set(p.x,targetY,p.z);camera.position.set(x,y,z);controls.update();ready=true;
  return {mode,grade,angle};
 }
 function adoptZoom(p){
  radius=Math.max(1,Math.hypot(camera.position.x-p.x,camera.position.z-p.z));
  lift=Math.max(.5,camera.position.y-(ground(p.x,p.z)+1.2));
 }
 return {update,adoptZoom};
}
