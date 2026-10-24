import {createIceCream} from './jerry-swim.js?v=8359c5d876e1';
import {POOL_PHASES} from './jerry-pool-trip.js?v=c700868d6d1d';
import * as THREE from './vendor/three/three.module.js';
// Hand-built, stylized illustration based on the supplied Mule / two-dog photo.
export function createMule(){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:.85});
  const burgundy=mat('#783b43'),edge=mat('#a45b60'),black=mat('#182129'),tire=mat('#222528'),metal=mat('#84928f'),skin=mat('#d4a88b'),hair=mat('#bbc1bb'),shirt=mat('#477f9d'),fleeceTrim=mat('#315d75'),zipper=mat('#bda579'),white=mat('#ede9d8'),tan=mat('#c68e48'),pink=mat('#dc8a98');
  function mesh(g,geo,m,x=0,y=0,z=0){const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);g.add(o);return o;}
  const box=(g,m,x,y,z,w,h,d)=>mesh(g,new THREE.BoxGeometry(w,h,d),m,x,y,z);
  const ball=(g,m,x,y,z,r,sx=1,sy=1,sz=1)=>{const o=mesh(g,new THREE.SphereGeometry(r,12,10),m,x,y,z);o.scale.set(sx,sy,sz);return o;};
  function rod(g,m,a,b,r=.035){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),o=mesh(g,new THREE.CylinderGeometry(r,r,va.distanceTo(vb),8),m);o.position.copy(va).add(vb).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vb.sub(va).normalize());return o;}
  box(body,black,0,.55,0,1.7,.22,3.1);
  box(body,burgundy,0,.97,1.05,1.75,.58,1.05);box(body,edge,0,1.29,1.08,1.79,.08,1.1);
  box(body,black,0,.72,1.67,1.9,.16,.16);box(body,black,0,.92,1.59,.85,.26,.03);
  for(let x=-.32;x<.4;x+=.16)box(body,metal,x,.93,1.615,.035,.2,.02);
  for(const x of [-.64,.64])box(body,mat('#ffeac2'),x,1.12,1.6,.28,.18,.035);
  box(body,burgundy,0,.82,-1.11,1.7,.15,1.12);
  for(const x of [-.85,.85])box(body,burgundy,x,1.06,-1.1,.09,.45,1.12);
  box(body,burgundy,0,1.06,-1.65,1.8,.45,.1);
  box(body,black,0,1.05,-.17,1.6,.18,.66);box(body,black,0,1.38,-.53,1.6,.65,.12);
  for(const x of [-.84,.84]){rod(body,black,[x,.8,-.75],[x,2.55,-.75],.045);rod(body,black,[x,1.25,.66],[x,2.55,.58],.045);rod(body,black,[x,2.55,-.75],[x,2.55,.58],.045);}
  box(body,black,0,2.60,-.08,1.95,.13,1.75);
  rod(body,black,[-.84,1.85,-.75],[.84,1.85,-.75]);rod(body,black,[-.84,1.55,-.75],[.84,1.55,-.75]);
  const wheels=[];for(const x of [-.94,.94])for(const z of [-1.1,1.08]){
    const pivot=new THREE.Group();pivot.position.set(x,.43,z);body.add(pivot);
    const w=mesh(pivot,new THREE.CylinderGeometry(.43,.43,.29,16),tire);w.rotation.z=Math.PI/2;
    const hub=mesh(pivot,new THREE.CylinderGeometry(.23,.23,.31,10),metal);hub.rotation.z=Math.PI/2;
    for(let a=0;a<Math.PI*2;a+=Math.PI/6){const tread=box(pivot,black,0,Math.cos(a)*.42,Math.sin(a)*.42,.32,.06,.13);tread.rotation.x=a;}
    wheels.push(pivot);
  }
  // The Mule faces +Z, so its left-hand driver's seat is on +X.
  const driverX=.48;
  const driver=new THREE.Group();driver.position.set(driverX,1.13,-.05);body.add(driver);
  // Blue quarter-zip fleece: soft shoulders, stand collar and a small chest pocket.
  box(driver,shirt,0,.32,0,.46,.61,.31);
  for(const x of [-.19,.19])ball(driver,shirt,x,.52,0,.09,1,1,.95);
  for(const x of [-.075,.075])box(driver,fleeceTrim,x,.625,.08,.12,.085,.18);
  box(driver,fleeceTrim,0,.52,.164,.026,.19,.018);box(driver,zipper,0,.52,.177,.009,.17,.008);
  box(driver,zipper,0,.59,.187,.022,.035,.012);
  box(driver,fleeceTrim,.13,.36,.163,.105,.12,.018);box(driver,shirt,.13,.412,.178,.09,.018,.008);
  ball(driver,skin,0,.85,.025,.205,.91,1.12,.96);
  // A bald crown, gray side hair, prominent ears and a quiet half-smile.
  for(const x of [-.185,.185]){ball(driver,hair,x,.85,-.03,.055,.55,1.4,1.6);ball(driver,skin,x,.81,.055,.055,.5,1,1);}
  ball(driver,skin,0,.83,.223,.045,.8,1,1.3);
  for(const x of [-.075,.075]){ball(driver,black,x,.9,.204,.016);box(driver,hair,x,.943,.192,.07,.012,.015);}
  box(driver,mat('#8d6654'),0,.75,.2,.075,.012,.012);
  const arms=[];for(const side of [-1,1]){const arm=new THREE.Group();arm.position.set(side*.24,.54,0);driver.add(arm);rod(arm,shirt,[0,0,0],[side*.035,-.25,.22],.07);ball(arm,skin,side*.035,-.25,.26,.068);arms.push(arm);}
  for(const x of [-.13,.13]){rod(driver,black,[x,.05,0],[x,-.15,.38],.09);box(driver,black,x,-.33,.41,.18,.2,.29);}
  const steering=mesh(body,new THREE.TorusGeometry(.23,.025,6,20),black,driverX,1.44,.48);steering.rotation.x=-.6;
  rod(body,black,[driverX,1.1,.7],[driverX,1.44,.48],.04);
  const sandwich=createIceCream();arms[0].add(sandwich);sandwich.position.set(-.03,-.18,.32);sandwich.visible=false;
  const glass=new THREE.Group();arms[0].add(glass);glass.position.set(-.03,-.18,.32);glass.visible=false;
  mesh(glass,new THREE.CylinderGeometry(.065,.025,.11,12),mat('#e1d4c2'),0,.1,0);
  mesh(glass,new THREE.CylinderGeometry(.058,.024,.06,12),mat('#792b43'),0,.095,0);rod(glass,metal,[0,0,0],[0,.055,0],.008);mesh(glass,new THREE.CylinderGeometry(.045,.045,.012,12),metal);
  function dog(x,size,shaggy){
    const d=new THREE.Group();d.position.set(x,1.14,.02);d.scale.setScalar(size);body.add(d);
    const fur=shaggy?black:tan;
    ball(d,fur,0,.26,0,.23,.8,1.2,1);ball(d,fur,0,.61,.05,.22,1,1,1);
    ball(d,shaggy?metal:white,0,.53,.24,.13,1,.6,1);ball(d,black,0,.56,.35,.055);
    for(const side of [-1,1]){
      if(shaggy)ball(d,fur,side*.22,.52,.02,.14,.65,1.7,1);
      else{const ear=mesh(d,new THREE.ConeGeometry(.105,.31,3),tan,side*.16,.86,.015);ear.rotation.z=-side*.2;mesh(d,new THREE.ConeGeometry(.06,.2,3),pink,side*.16,.87,.055);}
      ball(d,shaggy?white:black,side*.088,.65,.235,.022);ball(d,black,side*.088,.65,.25,.012);
      box(d,shaggy?fur:white,side*.1,.035,.17,.1,.21,.13);
    }
    if(!shaggy)ball(d,white,0,.29,.2,.14,.8,1.3,.45);
    if(shaggy)for(let i=0;i<18;i++){const a=i*2.4;ball(d,i%3?fur:metal,Math.cos(a)*.19,.49+(i%5)*.065,.05+Math.sin(a)*.18,.06,.7,1.5,.7);}
    ball(d,pink,0,.45,.31,.055,.6,1.2,.3);
    const collar=mesh(d,new THREE.TorusGeometry(.17,.022,6,16),mat(shaggy?'#839e8d':'#b63d53'),0,.45,.025);collar.rotation.x=Math.PI/2;
    const tail=new THREE.Group();tail.position.set(0,.25,-.2);d.add(tail);rod(tail,fur,[0,0,0],[.07,.15,-.35],.05);
    return {group:d,tail};
  }
  const dogs=[dog(-.1,.96,true),dog(-.62,.78,false)];
  // Small illustrated badging, not an external texture or photograph.
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#19272b';ctx.fillRect(0,0,256,64);ctx.fillStyle='#e7e5d9';ctx.font='bold 36px sans-serif';ctx.textAlign='center';ctx.fillText('KAWASAKI',128,43);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  mesh(body,new THREE.PlaneGeometry(.65,.16),new THREE.MeshBasicMaterial({map:tex}),0,1.24,1.615);
  root.scale.setScalar(2.4);
  return {root,animate(s,dt){
    const air=s.hop>0?Math.min(1,s.hop/.8):0;
    body.rotation.x=-s.pitch-air*Math.max(-.24,Math.min(.32,s.vy*.045));body.rotation.z=s.roll+air*Math.sin(s.elapsed*5)*.07;
    body.position.y=s.speed>.1?Math.sin(s.elapsed*18)*.025:0;
    wheels.forEach(w=>w.rotation.x+=s.speed*dt/1.03);
    steering.rotation.z=Math.sin(s.heading)*.16;
    dogs.forEach((d,i)=>{d.tail.rotation.y=Math.sin(s.elapsed*9+i)*.6;d.group.rotation.z=Math.sin(s.elapsed*4+i)*.025;});
    const sipping=s.phase==='sip',eating=s.phase==='eat';driver.visible=!POOL_PHASES.has(s.phase);glass.visible=sipping;sandwich.visible=eating;sandwich.scale.setScalar(Math.max(.15,.8-Math.floor(s.wait)*.17));arms[0].rotation.x=sipping?-1.55-Math.sin(s.wait*2)*.15:eating?-1.4-Math.sin(s.wait*5)*.16:0;
  }};
}
export function createBottle(){
  const g=new THREE.Group(),green=new THREE.MeshStandardMaterial({color:'#284d35',roughness:.3});
  const piece=(r1,r2,h,y,m)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,12),m);o.position.y=y;g.add(o);};
  piece(.13,.13,.48,.3,green);piece(.055,.13,.14,.61,green);piece(.053,.053,.21,.77,green);
  piece(.057,.057,.12,.86,new THREE.MeshStandardMaterial({color:'#8d2940'}));
  piece(.133,.133,.21,.33,new THREE.MeshStandardMaterial({color:'#f0dec0'}));
  g.scale.setScalar(3);return g;
}
