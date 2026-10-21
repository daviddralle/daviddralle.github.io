// Pure geometry and KML helpers shared by the browser and export checks.
export const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const same = (a,b) => a[0] === b[0] && a[1] === b[1];
const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const onSegment = (a,b,c) => cross(a,b,c) === 0 && c[0]>=Math.min(a[0],b[0]) && c[0]<=Math.max(a[0],b[0]) && c[1]>=Math.min(a[1],b[1]) && c[1]<=Math.max(a[1],b[1]);
function intersects(a,b,c,d) {
  return (cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0) || onSegment(a,b,c) || onSegment(a,b,d) || onSegment(c,d,a) || onSegment(c,d,b);
}
export function geometryError(g) {
  if (!g || !['Point','MultiPoint','LineString','Polygon'].includes(g.type)) return 'Unsupported geometry.';
  const pts = g.type==='Point' ? [g.coordinates] : g.type==='Polygon' ? g.coordinates[0] : g.coordinates;
  if (!Array.isArray(pts) || pts.some(p=>!Array.isArray(p)||p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>90)) return 'Coordinates must be valid longitude and latitude.';
  if(g.type==='Point') return '';
  if(g.type==='MultiPoint') return pts.length?'':'Add at least one point.';
  if(pts.length < (g.type==='Polygon'?4:2)) return g.type==='Polygon'?'Add at least three corners.':'Add at least two points.';
  if(pts.some((p,i)=>i && same(p,pts[i-1]))) return 'Remove consecutive duplicate vertices.';
  if(g.type==='Polygon') {
    if(g.coordinates.length!==1 || !same(pts[0],pts.at(-1))) return 'The polygon must have one closed outer boundary.';
    const area=pts.slice(1).reduce((a,p,i)=>a+cross(pts[0],pts[i],p),0);
    if(Math.abs(area)<1e-14) return 'The shape has no area. Move its corners apart.';
    for(let i=0;i<pts.length-1;i++) for(let j=i+2;j<pts.length-1;j++) {
      if(i===0 && j===pts.length-2) continue;
      if(intersects(pts[i],pts[i+1],pts[j],pts[j+1])) return 'Shape edges cannot cross or touch. Move or remove a vertex.';
    }
  }
  return '';
}
export function sessionError(features) {
  const ids=new Set();
  for(const f of features) {
    const id=String(f.properties?.id??'').trim();
    if(!id) return 'Every feature needs an ID.';
    if(ids.has(id.toLocaleLowerCase())) return 'Feature IDs must be unique.';
    ids.add(id.toLocaleLowerCase());
    const error=geometryError(f.geometry); if(error) return `${id}: ${error}`;
  }
  return '';
}
export function toKML(features, name) {
  const error=sessionError(features);if(error)throw Error(error);
  const coordinates = pts => pts.map(p=>`${p[0]},${p[1]},0`).join(' ');
  const placemarks=features.map((f,i)=>{
    const p=f.properties,g=f.geometry;
    let geometry;
    if(g.type==='Point') geometry=`<Point><altitudeMode>clampToGround</altitudeMode><coordinates>${coordinates([g.coordinates])}</coordinates></Point>`;
    else if(g.type==='MultiPoint') geometry=`<MultiGeometry>${g.coordinates.map(p=>`<Point><altitudeMode>clampToGround</altitudeMode><coordinates>${coordinates([p])}</coordinates></Point>`).join('')}</MultiGeometry>`;
    else if(g.type==='LineString') geometry=`<LineString><tessellate>1</tessellate><altitudeMode>clampToGround</altitudeMode><coordinates>${coordinates(g.coordinates)}</coordinates></LineString>`;
    else {
      let ring=g.coordinates[0];
      if(ring.slice(1).reduce((a,p,i)=>a+cross(ring[0],ring[i],p),0)<0)ring=[...ring].reverse();
      geometry=`<Polygon><tessellate>1</tessellate><altitudeMode>clampToGround</altitudeMode><outerBoundaryIs><LinearRing><coordinates>${coordinates(ring)}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
    }
    const fields={id:p.id,description:p.description||'',draw_type:p.draw_type,site:p.site,created:p.created,updated:p.updated,session:name};
    return `<Placemark id="drawing-${i+1}"><name>${xml(p.id)}</name><description>${xml(p.description)}</description><styleUrl>#drawing</styleUrl><ExtendedData>${Object.entries(fields).map(([k,v])=>`<Data name="${k}"><value>${xml(v)}</value></Data>`).join('')}</ExtendedData>${geometry}</Placemark>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xml(name)}</name><description>User-drawn SFPUC field annotations. WGS84 coordinates; clamped to ground.</description><Style id="drawing"><IconStyle><scale>0.7</scale><Icon><href>files/point.png</href></Icon><hotSpot x="0.5" y="0.5" xunits="fraction" yunits="fraction"/></IconStyle><LabelStyle><color>ffffffff</color><scale>0.85</scale></LabelStyle><LineStyle><color>ffeadb63</color><width>3</width></LineStyle><PolyStyle><color>40eadb63</color><fill>1</fill><outline>1</outline></PolyStyle></Style>\n${placemarks}\n</Document></kml>`;
}
