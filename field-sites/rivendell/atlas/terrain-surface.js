/* Sample the same two triangles per cell that the WebGL terrain renders. */
window.AtlasTerrain={sampler(tm,heights){
 return (east,north)=>{
  const c=Math.max(0,Math.min(tm.width-1,(east-tm.x0)/tm.step));
  const r=Math.max(0,Math.min(tm.height-1,(tm.y0-north)/tm.step));
  const i=Math.min(Math.floor(c),tm.width-2),j=Math.min(Math.floor(r),tm.height-2),x=c-i,y=r-j;
  const a=heights[j*tm.width+i],b=heights[j*tm.width+i+1],d=heights[(j+1)*tm.width+i+1],e=heights[(j+1)*tm.width+i];
  return x+y<=1?a+x*(b-a)+y*(e-a):d+(1-x)*(e-d)+(1-y)*(b-d);
 };
},drape(points,tm,origin,heightAt,clearance=.07){
 // Split at every grid edge and triangle diagonal, so lines never cut into a facet.
 const result=[];
 const at=(a,b,t)=>{const x=a[0]+t*(b[0]-a[0]),z=a[2]+t*(b[2]-a[2]);return [x,heightAt(x+origin[0],origin[1]-z)-origin[2]+clearance,z];};
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],c0=(a[0]+origin[0]-tm.x0)/tm.step,c1=(b[0]+origin[0]-tm.x0)/tm.step,r0=(tm.y0-origin[1]+a[2])/tm.step,r1=(tm.y0-origin[1]+b[2])/tm.step,ts=[0,1];
  for(const [u,v] of [[c0,c1],[r0,r1],[c0+r0,c1+r1]])if(Math.abs(v-u)>1e-10)for(let k=Math.ceil(Math.min(u,v));k<Math.max(u,v);k++){const t=(k-u)/(v-u);if(t>1e-8&&t<1-1e-8)ts.push(t);}
  ts.sort((a,b)=>a-b);for(let j=0;j<ts.length;j++){if(j&&ts[j]-ts[j-1]<1e-8||i>1&&j===0)continue;result.push(at(a,b,ts[j]));}
 }
 return result;
}};
