// Fictional game motion. UTM coordinates stay separate from research features.
export const HOME = Object.freeze([556769, 4332702]);
export const HOME_NOTE = 'Approximate circle-drive position interpreted from the user’s marked satellite image, 16 October 2026; not surveyed.';
// Pass-through targets are within 12 m of published well collars / RVWS, with room for the Mule.
export const DESTINATIONS = [
  {id:'mh3',label:'MH3 wells',point:[556590,4333356],waypoint:5,feature:'MH3W1'},
  {id:'mh7',label:'MH7 wells',point:[556302,4333901],waypoint:9,feature:'MH7W1'},
  {id:'mh8',label:'MH8 wells',point:[556304,4333962],waypoint:10,feature:'MH8W1'},
  {id:'weather',label:'Weather station',point:[556366,4333957],waypoint:11,feature:'RVWS'}
];
export const ROUTE = [HOME,[556781,4332730],[556678,4332870],[556616,4333060],
  [556600,4333250],DESTINATIONS[0].point,[556540,4333500],[556430,4333690],
  [556340,4333820],DESTINATIONS[1].point,DESTINATIONS[2].point,DESTINATIONS[3].point,
  [556430,4333780],[556540,4333500],DESTINATIONS[0].point,[556616,4333060],
  [556678,4332870],[556781,4332730],HOME];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function createMotion({height,valid}) {
  const s={e:HOME[0],n:HOME[1],heading:0,speed:0,hop:0,vy:0,pitch:0,roll:0,phase:'home',elapsed:0,wait:3,waypoint:1,wine:null,jumps:0,cooldown:7,destination:'MH3 wells',visits:0,lastVisited:null};
  function reset(){Object.assign(s,{e:HOME[0],n:HOME[1],heading:0,speed:0,hop:0,vy:0,pitch:0,roll:0,phase:'home',elapsed:0,wait:3,waypoint:1,wine:null,jumps:0,cooldown:7,destination:'MH3 wells',visits:0,lastVisited:null});}
  function drop(e,n){if(!valid(e,n))return false;s.wine=[e,n];s.phase='fetch';s.wait=0;return true;}
  function resume(){s.phase='drive';s.wine=null;let nearest=1;for(let i=2;i<ROUTE.length;i++)if(Math.hypot(ROUTE[i][0]-s.e,ROUTE[i][1]-s.n)<Math.hypot(ROUTE[nearest][0]-s.e,ROUTE[nearest][1]-s.n))nearest=i;s.waypoint=nearest;updateDestination();}
  function advance(){s.waypoint=(s.waypoint+1)%ROUTE.length;updateDestination();}
  function updateDestination(){for(let i=0;i<ROUTE.length;i++){const d=DESTINATIONS.find(d=>d.point===ROUTE[(s.waypoint+i)%ROUTE.length]);if(d){s.destination=d.label;return;}}}
  function go(id){const d=DESTINATIONS.find(d=>d.id===id);if(!d)return false;s.wine=null;s.phase='drive';s.wait=0;s.waypoint=d.waypoint;updateDestination();return true;}
  function compose(){s.phase='think';s.wait=0;s.speed=0;s.hop=0;s.vy=0;}
  function step(dt){
    dt=clamp(dt,0,.05);s.elapsed+=dt;s.cooldown-=dt;
    if(s.phase==='home'){s.wait-=dt;if(s.wait<=0)s.phase='drive';return s;}
    if(s.phase==='sip'){s.wait+=dt;if(s.wait>=5){s.phase='think';s.wait=0;};return s;}
    if(s.phase==='think'){s.wait+=dt;if(s.wait>=3)s.phase='poem';return s;}
    if(s.phase==='poem')return s;
    const target=s.wine||ROUTE[s.waypoint],de=target[0]-s.e,dn=target[1]-s.n,dist=Math.hypot(de,dn);
    const stop=DESTINATIONS.find(d=>d.point===ROUTE[s.waypoint]);
    if(dist<(s.wine?3.5:stop?6:12)){
      if(s.wine){s.phase='sip';s.speed=0;s.hop=0;s.vy=0;s.wait=0;return s;}
      if(stop){s.visits++;s.lastVisited=stop.id;}
      advance();return s;
    }
    const turn=wrap(Math.atan2(de,dn)-s.heading);
    const change=clamp(turn,-2.5*dt,2.5*dt);s.heading+=change;
    const se=Math.sin(s.heading),sn=Math.cos(s.heading);
    const grade=(height(s.e+se*3,s.n+sn*3)-height(s.e-se*3,s.n-sn*3))/6;
    const bend=Math.abs(turn),onDrive=Math.hypot(s.e-HOME[0],s.n-HOME[1])<45;
    const cruise=onDrive?12:33+3*Math.sin(s.elapsed*.31);
    const braking=s.wine?Math.max(3,Math.sqrt(18*dist)):cruise;
    const desired=Math.min(cruise/(1+Math.abs(grade)*.65),braking)/(1+bend*.65);
    s.speed+=(desired-s.speed)*Math.min(1,dt*4);
    const e=s.e+se*s.speed*dt,n=s.n+sn*s.speed*dt;
    if(valid(e,n)){s.e=e;s.n=n;}else{ s.speed=0;if(s.wine){s.wine=null;}advance();s.heading+=Math.PI*.55; }
    // Crest-triggered, bounded arcade hops; never changes the terrain or route data.
    const slope=Math.atan(grade),crest=s.pitch>.015&&slope<s.pitch-.002;
    if(!onDrive&&s.speed>8&&s.hop===0&&s.cooldown<=0&&crest){s.vy=8+Math.min(1.5,s.speed/20);s.hop=.001;s.cooldown=5;s.jumps++;}
    if(s.hop>0){s.vy-=9.81*dt;s.hop=Math.max(0,s.hop+s.vy*dt);if(s.hop===0)s.vy=0;}
    s.pitch+=(slope-s.pitch)*Math.min(1,dt*6);
    s.roll+=(-change/Math.max(dt,.001)*.12-s.roll)*Math.min(1,dt*5);
    return s;
  }
  return {state:s,reset,drop,resume,step,go,compose};
}
