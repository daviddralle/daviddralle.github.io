import * as THREE from './vendor/three/three.module.js';
import {POOL,POOL_PHASES,poolPose} from './jerry-pool-trip.js?v=4fa0ee8db8ec';
export function createIceCream(){
  const root=new THREE.Group(),chocolate=new THREE.MeshStandardMaterial({color:'#493024',roughness:.95}),cream=new THREE.MeshStandardMaterial({color:'#fff0cd'});
  for(const [y,h,m] of [[0,.15,cream],[-.12,.1,chocolate],[.12,.1,chocolate]]){const o=new THREE.Mesh(new THREE.BoxGeometry(.52,h,.32),m);o.position.y=y;root.add(o);}
  const dot=new THREE.MeshStandardMaterial({color:'#251a16'});
  for(const x of [-.17,0,.17])for(const z of [-.09,.09]){const o=new THREE.Mesh(new THREE.SphereGeometry(.018,6,4),dot);o.position.set(x,.176,z);root.add(o);}
  return root;
}
export function createPoolVisit({ground,position,getVertical}){
  const root=new THREE.Group(),person=new THREE.Group(),torso=new THREE.Group();root.add(person);person.add(torso);person.scale.setScalar(1.6);
  const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.8});
  const skin=mat('#d4a88b'),hair=mat('#bbc1bb'),trunks=mat('#dd864c'),fin=mat('#3e8e9e'),dark=mat('#263b42');
  function box(g,m,x,y,z,w,h,d){const a=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);a.position.set(x,y,z);g.add(a);return a;}
  function ball(g,m,x,y,z,r,sx=1,sy=1,sz=1){const a=new THREE.Mesh(new THREE.SphereGeometry(r,12,10),m);a.position.set(x,y,z);a.scale.set(sx,sy,sz);g.add(a);return a;}
  box(torso,skin,0,.18,0,.47,.63,.28);box(torso,trunks,0,-.23,0,.5,.24,.32);box(torso,mat('#f0d295'),0,-.13,0,.51,.055,.33);
  ball(torso,skin,0,.77,.025,.205,.91,1.12,.96);
  for(const side of [-1,1]){ball(torso,hair,side*.185,.77,-.03,.055,.55,1.4,1.6);ball(torso,skin,side*.2,.73,.055,.05,.5,1,1);ball(torso,dark,side*.075,.82,.206,.017);}
  ball(torso,skin,0,.75,.225,.04,.8,1,1.3);box(torso,mat('#8d6654'),0,.67,.21,.075,.012,.012);
  const arms=[],legs=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.position.set(side*.29,.43,0);torso.add(arm);box(arm,skin,0,-.26,0,.13,.54,.14);ball(arm,skin,0,-.55,0,.075);arms.push(arm);
    const leg=new THREE.Group();leg.position.set(side*.14,-.32,0);torso.add(leg);box(leg,trunks,0,-.09,0,.21,.2,.25);box(leg,skin,0,-.39,0,.13,.46,.15);box(leg,fin,0,-.65,.21,.24,.065,.66);legs.push(leg);
  }
  const water=new THREE.Mesh(new THREE.PlaneGeometry(5.5,14.2),new THREE.MeshStandardMaterial({color:'#3fa5bd',roughness:.28,metalness:.12,transparent:true,opacity:.95,side:THREE.DoubleSide}));water.rotation.set(-Math.PI/2,0,0);const waterFrame=new THREE.Group();waterFrame.rotation.y=POOL.angle;waterFrame.add(water);root.add(waterFrame);
  const ripples=[];for(let i=0;i<5;i++){const r=new THREE.Mesh(new THREE.RingGeometry(.32,.36,28),new THREE.MeshBasicMaterial({color:'#e1f8fb',transparent:true,opacity:.5,side:THREE.DoubleSide,depthWrite:false}));r.rotation.x=-Math.PI/2;root.add(r);ripples.push(r);}
  const base=ground(...POOL.center)+.43;
  root.visible=false;
  function placed(point,z){const p=position(...point,z);p.y*=getVertical();return p;}
  function update(s){
    root.visible=POOL_PHASES.has(s.phase);if(!root.visible)return null;
    const pose=poolPose(s),swim=pose.swimming;
    waterFrame.position.copy(placed(POOL.center,base));
    const changing=s.phase.startsWith('change-');
    const groundHeight=ground(...pose.point),z=swim?base+.08:Math.max(groundHeight,base)+1.6;
    person.position.copy(placed(pose.point,z));person.rotation.y=Math.PI-pose.heading;
    torso.rotation.x=swim?Math.PI/2:0;
    torso.rotation.z=swim?Math.sin(s.wait*5)*.1:changing?Math.sin(s.wait*5)*.04:0;
    for(let i=0;i<2;i++){arms[i].rotation.x=swim?s.wait*4.4+i*Math.PI:changing?-1.7+Math.sin(s.wait*6+i)*.3:Math.sin(s.wait*5+i*Math.PI)*.35;legs[i].rotation.x=swim?Math.sin(s.wait*7+i*Math.PI)*.3:changing?0:Math.sin(s.wait*5+i*Math.PI)*.2;}
    for(let i=0;i<ripples.length;i++){const r=ripples[i],age=(s.wait*.8+i/ripples.length)%1;r.visible=swim;r.position.copy(placed(pose.point,base+.025));r.scale.setScalar(.7+age*2.5);r.material.opacity=(1-age)*.4;}
    return {position:person.position.clone(),swimming:swim};
  }
  return {root,update,hide(){root.visible=false;}};
}
