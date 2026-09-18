const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const base=path.join(__dirname,'../field-sites/rivendell/atlas/');
global.window={};vm.runInThisContext(fs.readFileSync(base+'terrain-surface.js','utf8'));
const tm={x0:0,y0:1,width:2,height:2,step:1};
const sample=window.AtlasTerrain.sampler(tm,[10,20,30,60]);
assert.equal(sample(.2,.8),16);assert.equal(sample(.8,.2),46);assert.equal(sample(1,0),60);assert.equal(sample(.5,.5),25);
const saddle={x0:0,y0:2,width:3,height:3,step:1},sampleSaddle=window.AtlasTerrain.sampler(saddle,[10,25,9,15,48,21,34,27,18]);
for(const line of [[ [.1,0,.2],[1.9,0,1.8] ],[ [.4,0,1.9],[1.7,0,.1] ]]){
 const ds=window.AtlasTerrain.drape(line,saddle,[0,2,0],sampleSaddle);
 for(let i=1;i<ds.length;i++)for(const t of [.1,.5,.9]){
  const a=ds[i-1],b=ds[i],x=a[0]+t*(b[0]-a[0]),z=a[2]+t*(b[2]-a[2]),y=a[1]+t*(b[1]-a[1]);
  assert(Math.abs(y-sampleSaddle(x,2-z)-.07)<1e-10,'Contour crosses a terrain facet');
 }
}
const read=name=>JSON.parse(fs.readFileSync(base+'data/'+name)),meta=read('3d/scene.json'),o=meta.origin_utm_e_n_z,b=fs.readFileSync(base+'data/3d/terrain.f32'),heights=new Float32Array(b.buffer,b.byteOffset,b.length/4),ground=window.AtlasTerrain.sampler(meta.terrain,heights),expected=read('ground-elevations.json');let count=0;
for(const [id,features] of Object.entries(read('3d/features.json')))for(const f of features)if(f.geometry.type==='Point'){
 const [x,y,z]=f.geometry.coordinates;assert(Math.abs(ground(x+o[0],o[1]-z)-expected[id+':'+f.uid])<=.000501);count++;
}
const platform=read('3d/features.json').vms_platform[0].geometry.coordinates[0].map(v=>[v[0]+o[0],o[1]-v[2]]);
const west=platform.slice(1).map((b,i)=>[platform[i],b]).sort((a,b)=>(a[0][0]+a[1][0])-(b[0][0]+b[1][0]))[0];
function edgeDistance(p){const [a,b]=west,dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
for(const f of read('vms_bores.geojson').features){
 const p=f.properties,[a,b]=p.trajectory_utm_e_n_z,dz=ground(a[0],a[1])-a[2];
 assert(Math.abs(ground(a[0],a[1])-expected['vms_bores:'+p.uid])<=.000501);
 assert(Math.abs(dz)<.0001,'VMS collar must use LiDAR ground');
 assert(edgeDistance(a)<.7,'VMS collar must remain near the western platform edge');
 const angle=Math.atan2(a[2]-b[2],Math.hypot(a[0]-b[0],a[1]-b[1]))*180/Math.PI;assert(Math.abs(angle-p.inclination_deg)<.001);
 for(const port of p.ports)assert(Math.abs((a[2]+dz)-(port.start_utm_e_n_z[2]+dz)-port.top_depth_m)<.0002);
}
for(const f of read('contours.geojson').features)if(f.properties.major)assert.equal(f.properties.elevation_m%10,0);
console.log(`PASS: ${count} LiDAR point elevations, both VMS inclinations and port depths, terrain-facet draping, and 10 m index contour labels.`);
