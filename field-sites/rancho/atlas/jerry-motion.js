// Fictional game motion. UTM coordinates stay separate from research features.
export const HOME = Object.freeze([556769, 4332702]);
export const HOME_NOTE = 'Approximate circle-drive position interpreted from the user’s marked satellite image, 16 October 2026; not surveyed.';
export const ROUTE = [
  HOME,[556781,4332714],[556781,4332730],[556766,4332738],[556751,4332728],
  [556752,4332711],[556769,4332702],[556790,4332742],[556750,4332800],
  [556678,4332870],[556616,4332990],[556650,4333110],[556705,4333190],
  [556610,4333290],[556571,4333450],[556465,4333570],[556395,4333740],
  [556320,4333880],[556234,4334040],[556172,4334220],[556175,4334440],
  [556240,4334640],[556388,4334635],[556438,4334430],[556414,4334220],
  [556402,4334060],[556506,4333910],[556552,4333710],[556620,4333550],
  [556706,4333370],[556776,4333190],[556781,4333010],[556737,4332850],
  [556800,4332770],[556790,4332720],HOME
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function createMotion({height,valid}) {
  const s={e:HOME[0],n:HOME[1],heading:0,speed:0,hop:0,vy:0,pitch:0,roll:0,phase:'home',elapsed:0,wait:3,waypoint:1,wine:null,jumps:0,cooldown:7};
  function reset(){Object.assign(s,{e:HOME[0],n:HOME[1],heading:0,speed:0,hop:0,vy:0,pitch:0,roll:0,phase:'home',elapsed:0,wait:3,waypoint:1,wine:null,jumps:0,cooldown:7});}
  function drop(e,n){if(!valid(e,n))return false;s.wine=[e,n];s.phase='fetch';s.wait=0;return true;}
  function resume(){s.phase='drive';s.wine=null;let nearest=1;for(let i=2;i<ROUTE.length;i++)if(Math.hypot(ROUTE[i][0]-s.e,ROUTE[i][1]-s.n)<Math.hypot(ROUTE[nearest][0]-s.e,ROUTE[nearest][1]-s.n))nearest=i;s.waypoint=nearest;}
  function step(dt){
    dt=clamp(dt,0,.05);s.elapsed+=dt;s.cooldown-=dt;
    if(s.phase==='home'){s.wait-=dt;if(s.wait<=0)s.phase='drive';return s;}
    if(s.phase==='sip'){s.wait+=dt;if(s.wait>=5)s.phase='poem';return s;}
    if(s.phase==='poem')return s;
    const target=s.wine||ROUTE[s.waypoint],de=target[0]-s.e,dn=target[1]-s.n,dist=Math.hypot(de,dn);
    if(dist<3.5){
      if(s.wine){s.phase='sip';s.speed=0;s.hop=0;s.vy=0;s.wait=0;return s;}
      s.waypoint=(s.waypoint+1)%ROUTE.length;return s;
    }
    const turn=wrap(Math.atan2(de,dn)-s.heading);
    const change=clamp(turn,-1.7*dt,1.7*dt);s.heading+=change;
    const se=Math.sin(s.heading),sn=Math.cos(s.heading);
    const grade=(height(s.e+se*3,s.n+sn*3)-height(s.e-se*3,s.n-sn*3))/6;
    const bend=Math.abs(turn),onDrive=s.waypoint<8&&!s.wine;
    const cruise=onDrive?6:15+3*Math.sin(s.elapsed*.31);
    const desired=Math.min(cruise/(1+Math.abs(grade)*1.6),Math.max(2,dist*.9))/(1+bend*1.7);
    s.speed+=(desired-s.speed)*Math.min(1,dt*2.5);
    const e=s.e+se*s.speed*dt,n=s.n+sn*s.speed*dt;
    if(valid(e,n)){s.e=e;s.n=n;}else{ s.speed=0;if(s.wine){s.wine=null;}s.waypoint=(s.waypoint+1)%ROUTE.length;s.heading+=Math.PI*.55; }
    // Crest-triggered, bounded arcade hops; never changes the terrain or route data.
    const slope=Math.atan(grade),crest=s.pitch>.035&&slope<s.pitch-.004;
    if(!onDrive&&s.speed>8&&s.hop===0&&s.cooldown<=0&&crest){s.vy=4.5+Math.min(1.5,s.speed/12);s.hop=.001;s.cooldown=8;s.jumps++;}
    if(s.hop>0){s.vy-=9.81*dt;s.hop=Math.max(0,s.hop+s.vy*dt);if(s.hop===0)s.vy=0;}
    s.pitch+=(slope-s.pitch)*Math.min(1,dt*6);
    s.roll+=(-change/Math.max(dt,.001)*.12-s.roll)*Math.min(1,dt*5);
    return s;
  }
  return {state:s,reset,drop,resume,step};
}
