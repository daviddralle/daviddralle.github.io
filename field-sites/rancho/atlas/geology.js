// Published regional geology; always below field observations in either view.
export function inRing([x,y],ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [xi,yi]=ring[i],[xj,yj]=ring[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
}
export function contains(feature,point){
  const polygons=feature.geometry.type==='MultiPolygon'?feature.geometry.coordinates:[feature.geometry.coordinates];
  return polygons.some(rings=>inRing(point,rings[0])&&!rings.slice(1).some(r=>inRing(point,r)));
}
export function setupGeology({map,onChange,inspect,is3D,closeInspector}){
  const $=id=>document.getElementById(id),checkbox=$('layer-geology');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pane=map.createPane('geology');pane.style.zIndex=315;pane.style.pointerEvents='none';
  const group=L.layerGroup(),attribution='Geology: <a href="https://www.conservation.ca.gov/cgs/publications/maps-data/rgm">CGS · Ukiah 1960</a>';
  let data,loading,polygons,active=false,opacity=.48;
  const get=async file=>{const r=await fetch('./data/geology/'+file+'?v=ukiah-20261024');if(!r.ok)throw Error(`Geology HTTP ${r.status}`);return r.json();};
  async function load(){
    if(!loading)loading=Promise.all(['metadata.json','units.geojson','lines.geojson'].map(get)).then(([metadata,units,lines])=>{
      data={metadata,units,lines};
      polygons=L.geoJSON(units,{pane:'geology',interactive:false,style:f=>({stroke:false,fillColor:metadata.units[f.properties.unit].color,fillOpacity:opacity})}).addTo(group);
      L.geoJSON(lines,{pane:'geology',interactive:false,style:f=>({color:'#625e50',weight:1,opacity:.72,dashArray:f.properties.concealed?'2 5':f.properties.existence_confidence!=='certain'?'6 5':null})}).addTo(group);
      return data;
    }).catch(error=>{loading=null;throw error;});
    return loading;
  }
  function legend(){
    if(!data||!active)return;
    const codes=new Set();
    if(is3D())data.metadata.terrain_units.forEach(c=>codes.add(c));
    else polygons.eachLayer(l=>{if(map.getBounds().intersects(l.getBounds()))codes.add(l.feature.properties.unit);});
    $('geology-legend').innerHTML=[...codes].sort().map(code=>{const u=data.metadata.units[code];return `<div><i style="background:${u.color}"></i><span><b>${esc(code)}</b> ${esc(u.name)}</span></div>`;}).join('')||'<p>Outside the mapped cutout. Use Regional extent to return.</p>';
  }
  function notify(){onChange({data,active,opacity});legend();}
  function identify(point){
    if(!active||!data)return false;
    const f=data.units.features.find(f=>contains(f,point));if(!f)return false;
    inspect({...f,properties:{...f.properties,...data.metadata.units[f.properties.unit],source_url:data.metadata.source_url,description_url:data.metadata.description_url,limitations:data.metadata.limitations}});return true;
  }
  checkbox.disabled=false;
  checkbox.onchange=async()=>{
    if(!checkbox.checked){active=false;map.removeLayer(group);map.attributionControl.removeAttribution(attribution);$('geology-options').hidden=true;$('geology-status').hidden=true;closeInspector();notify();return;}
    $('geology-status').hidden=false;$('geology-status').textContent='Loading regional geology…';
    try{
      await load();if(!checkbox.checked)return;
      active=true;group.addTo(map);map.attributionControl.addAttribution(attribution);$('geology-options').hidden=false;$('geology-status').hidden=true;notify();
    }catch(error){console.error(error);checkbox.checked=false;active=false;$('geology-status').textContent='Geology could not load. Check the box to retry.';$('geology-status').hidden=false;notify();}
  };
  $('geology-opacity').oninput=()=>{opacity=Number($('geology-opacity').value)/100;$('geology-opacity-value').value=Math.round(opacity*100)+'%';polygons?.setStyle({fillOpacity:opacity});notify();};
  $('geology-extent').onclick=()=>{const b=data.metadata.bounds;map.fitBounds([[b[1],b[0]],[b[3],b[2]]],{padding:[30,85]});document.getElementById('sidebar').classList.remove('open');$('mobile-layers').setAttribute('aria-expanded','false');};
  map.on('moveend',legend);
  map.on('click',e=>{if(!e.propagatedFrom)identify([e.latlng.lng,e.latlng.lat]);});
  return {identify,legend,getState:()=>({data,active,opacity}),features:()=>active?[...data.units.features,...data.lines.features]:[]};
}
