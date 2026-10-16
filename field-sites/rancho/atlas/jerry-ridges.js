// Jump gates use the atlas catchments and displayed DEM, never slope noise alone.
export function createRidgeDetector({catchments,project,height,valid}){
  const areas=catchments.filter(f=>/^MH\d+$/.test(f.properties.id)).map(f=>{
    const polygons=(f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates).map(p=>p.map(r=>r.map(project)));
    const points=polygons.flat(2),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    return {id:f.properties.id,number:Number(f.properties.id.slice(2)),polygons,bounds:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]};
  });
  function insideRing(e,n,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>n)!==(yj>n)&&e<(xj-xi)*(n-yi)/(yj-yi)+xi)inside=!inside;
  }return inside;}
  function locate(e,n){return areas.find(a=>e>=a.bounds[0]&&e<=a.bounds[2]&&n>=a.bounds[1]&&n<=a.bounds[3]&&a.polygons.some(p=>insideRing(e,n,p[0])&&!p.slice(1).some(r=>insideRing(e,n,r))));}
  function boundaryDistance(e,n,area){let best=Infinity;for(const p of area.polygons)for(const ring of p)for(let i=1;i<ring.length;i++){
    const [x,y]=ring[i-1],[xx,yy]=ring[i],dx=xx-x,dy=yy-y,t=Math.max(0,Math.min(1,((e-x)*dx+(n-y)*dy)/(dx*dx+dy*dy||1)));
    best=Math.min(best,Math.hypot(e-x-t*dx,n-y-t*dy));
  }return best;}
  return function ridgeAt(e,n,heading){
    const se=Math.sin(heading),sn=Math.cos(heading),span=15;
    const back=[e-se*span,n-sn*span],front=[e+se*span,n+sn*span];
    if(!valid(...back)||!valid(...front))return null;
    const from=locate(...back),to=locate(...front);
    // Require a crossing between neighboring MH areas, not the outer watershed
    // edge or a drive along a divide. Both boundaries must be within 6 m,
    // allowing for the 10 m displayed terrain mesh and polygon simplification.
    if(!from||!to||Math.abs(from.number-to.number)!==1)return null;
    const distance=Math.max(boundaryDistance(e,n,from),boundaryDistance(e,n,to));
    if(distance>6)return null;
    const z=height(e,n),up=(z-height(...back))/span,down=(height(...front)-z)/span;
    if(up<=.025||down>=-.025)return null;
    return {id:[from,to].sort((a,b)=>a.number-b.number).map(a=>a.id).join('/'),distance,up,down};
  };
}
