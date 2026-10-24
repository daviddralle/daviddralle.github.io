// Fictional pool visit, separate from the research layers. UTM meters.
export const POOL=Object.freeze({center:[556736,4332554],angle:-.1,width:7.2,length:18,deckWidth:9.7,deckLength:20.8,parking:[556725,4332565],lapSeconds:13,laps:2});
export const POOL_PHASES=new Set(['change-swim','walk-pool','swim','walk-back','change-drive']);
export function poolPoint(x,n){const c=Math.cos(POOL.angle),s=Math.sin(POOL.angle);return [POOL.center[0]+c*x-s*n,POOL.center[1]+s*x+c*n];}
export function poolPose(state){
  const entry=poolPoint(0,5.2),deck=poolPoint(-3.65,5.2),car=[POOL.parking[0]+2.6,POOL.parking[1]-1];
  let point=car,heading=0,swimming=false;
  if(state.phase==='walk-pool'||state.phase==='walk-back'){
    const forward=state.phase==='walk-pool',t=Math.min(1,state.wait/3),a=forward?car:entry,b=forward?entry:car;
    point=a.map((v,i)=>v+(b[i]-v)*t);heading=Math.atan2(b[0]-a[0],b[1]-a[1]);
  }else if(state.phase==='swim'){
    const theta=state.wait/POOL.lapSeconds*Math.PI*2;
    point=poolPoint(.8*Math.sin(theta),5.2*Math.cos(theta));
    const next=poolPoint(.8*Math.sin(theta+.01),5.2*Math.cos(theta+.01));
    heading=Math.atan2(next[0]-point[0],next[1]-point[1]);swimming=true;
  }
  return {point,heading,swimming,deck,entry,car};
}
