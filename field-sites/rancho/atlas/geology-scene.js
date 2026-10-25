import * as THREE from './vendor/three/three.module.js';
// Paint published polygons onto the existing DEM facets; no subsurface inference.
export function createGeologySurface({geometry,terrain,project}){
  let mesh,texture,source;
  const [x0,y0,x1,y1]=terrain.bounds;
  function update({data,active,opacity}){
    if(data&&source!==data){
      source=data;
      const canvas=document.createElement('canvas');canvas.height=2048;canvas.width=Math.round(canvas.height*(x1-x0)/(y1-y0));
      const ctx=canvas.getContext('2d');
      const point=ll=>{const [e,n]=project(ll);return [(e-x0)/(x1-x0)*canvas.width,(y1-n)/(y1-y0)*canvas.height];};
      function path(coords){coords.forEach((ll,i)=>{const p=point(ll);i?ctx.lineTo(...p):ctx.moveTo(...p);});}
      for(const f of data.units.features){
        ctx.fillStyle=data.metadata.units[f.properties.unit].color;
        for(const rings of f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates]){
          ctx.beginPath();for(const ring of rings){path(ring);ctx.closePath();}ctx.fill('evenodd');
        }
      }
      ctx.strokeStyle='#625e50';ctx.lineWidth=1.5;
      for(const f of data.lines.features){ctx.setLineDash(f.properties.concealed?[2,5]:f.properties.existence_confidence!=='certain'?[6,5]:[]);ctx.beginPath();for(const coords of f.geometry.type==='MultiLineString'?f.geometry.coordinates:[f.geometry.coordinates])path(coords);ctx.stroke();}
      texture?.dispose();texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
      if(!mesh){mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:THREE.DoubleSide}));mesh.renderOrder=1.5;}
      mesh.material.map=texture;mesh.material.needsUpdate=true;
    }
    if(mesh){mesh.visible=active;mesh.material.opacity=opacity;}
    return mesh;
  }
  return {update};
}
