import * as THREE from './vendor/three/three.module.js';
// Screen-space ribbons keep drainage legible on WebGL implementations whose
// native lines are fixed at one pixel. Widths are display symbols, not channels.
// Test against terrain depth: unlike monitoring symbols, streams disappear
// behind ridges. Draw after the terrain so its depth buffer is available.
export function createStreamLines(paths){
  const positions=[],others=[],sides=[],indices=[];
  for(const points of paths)for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];if(a.distanceToSquared(b)<1e-8)continue;
    const offset=positions.length/3;
    for(const p of [a,a,b,b])positions.push(...p.toArray());
    for(const p of [b,b,a,a])others.push(...p.toArray());
    sides.push(-1,1,1,-1);indices.push(offset,offset+2,offset+1,offset+1,offset+2,offset+3);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('other',new THREE.Float32BufferAttribute(others,3));g.setAttribute('side',new THREE.Float32BufferAttribute(sides,1));g.setIndex(indices);
  const resolution=new THREE.Vector2(1,1),group=new THREE.Group();
  for(const [width,color,opacity,order] of [[5.5,'#123f50',.78,4],[3,'#a6edff',.98,5]]){
    const m=new THREE.ShaderMaterial({uniforms:{resolution:{value:resolution},width:{value:width},color:{value:new THREE.Color(color)},opacity:{value:opacity}},transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,
      vertexShader:`attribute vec3 other; attribute float side; uniform vec2 resolution; uniform float width;
      void main(){vec4 a=modelViewMatrix*vec4(position,1.0), b=modelViewMatrix*vec4(other,1.0);
        if(a.z>-.51&&b.z>-.51){gl_Position=vec4(2.,2.,2.,1.);return;}
        if(a.z>-.51)a=mix(a,b,(-.51-a.z)/(b.z-a.z));
        if(b.z>-.51)b=mix(b,a,(-.51-b.z)/(a.z-b.z));
        vec4 p=projectionMatrix*a,q=projectionMatrix*b;vec2 delta=(q.xy/q.w-p.xy/p.w)*resolution;
        vec2 d=delta/max(length(delta),.001);p.xy+=vec2(-d.y,d.x)*side*width/resolution*p.w;gl_Position=p;
      }`,
      fragmentShader:`uniform vec3 color;uniform float opacity;void main(){gl_FragColor=vec4(color,opacity);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`.replace(';#include',';\n#include')});
    const mesh=new THREE.Mesh(g,m);mesh.renderOrder=order;mesh.frustumCulled=false;group.add(mesh);
  }
  return {group,resize:(w,h)=>resolution.set(w,h)};
}
