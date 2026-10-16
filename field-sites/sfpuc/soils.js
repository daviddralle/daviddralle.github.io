import {soilDetails} from './soil-details.js?v=20261016-units';
// Cached NRCS polygons: no third-party request is needed while using the map.
export function setupSoils({map,notice,isMeasuring,closeInspector}){
  const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let metadata,data,properties,loading,polygons,sceneCodes;
  const group=L.layerGroup(),attribution='<a href="https://sdmdataaccess.sc.egov.usda.gov/">Soils: USDA NRCS SSURGO</a>';
  map.createPane('soils').style.zIndex=300;map.getPane('soils').style.pointerEvents='none';
  async function load(){
    if(!loading)loading=Promise.all(['metadata.json','units.geojson','properties.json'].map(async f=>{const r=await fetch('data/soils/'+f);if(!r.ok)throw Error('Soils: HTTP '+r.status);return r.json();})).then(([m,d,p])=>{metadata=m;data=d;properties=p;}).catch(e=>{loading=null;throw e;});
    return loading;
  }
  function legend(){
    if(!polygons||!map.hasLayer(group))return;
    const keys=new Set(sceneCodes||[]);if(!sceneCodes)polygons.eachLayer(l=>{if(map.getBounds().intersects(l.getBounds()))keys.add(l.feature.properties.mukey);});
    $('soils-legend').innerHTML=[...keys].sort((a,b)=>metadata.units[a].musym.localeCompare(metadata.units[b].musym)).map(k=>{const u=metadata.units[k];return `<div><i style="background:${u.color}"></i><span><b>${esc(u.musym)}</b> ${esc(u.muname)}</span></div>`;}).join('')||'<p>Outside the soil map cutout. Select a site to return.</p>';
  }
  $('layer-soils').disabled=false;
  $('layer-soils').onchange=async()=>{
    if(!$('layer-soils').checked){map.removeLayer(group);map.attributionControl.removeAttribution(attribution);$('soils-options').hidden=true;map.closePopup();return;}
    $('soils-status').hidden=false;$('soils-status').textContent='Loading soil units…';
    try{
      await load();if(!$('layer-soils').checked)return;
      group.clearLayers();polygons=L.geoJSON(data,{pane:'soils',interactive:false,style:f=>({fillColor:metadata.units[f.properties.mukey].color,fillOpacity:Number($('soils-opacity').value)/100,color:'#5a5144',weight:1,opacity:.8})}).addTo(group);
      if(!map.hasLayer(group)){group.addTo(map);map.attributionControl.addAttribution(attribution);}
      $('soils-options').hidden=false;map.closePopup();legend();
    }catch(e){console.error(e);$('layer-soils').checked=false;notice('Soil units could not load. Toggle the layer to retry.');}
    finally{$('soils-status').hidden=true;}
  };
  $('soils-opacity').oninput=()=>polygons?.setStyle({fillOpacity:Number($('soils-opacity').value)/100});
  function inRing([x,y],ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
  function inPolygon(p,r){return inRing(p,r[0])&&!r.slice(1).some(h=>inRing(p,h));}
  map.on('click',e=>{
    if(isMeasuring()||!map.hasLayer(group)||!data||e.propagatedFrom)return;
    const p=[e.latlng.lng,e.latlng.lat],f=data.features.find(f=>(f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates]).some(r=>inPolygon(p,r)));
    if(!f)return;closeInspector();const u=metadata.units[f.properties.mukey],content=document.createElement('div');content.className='geology-popup';
    content.innerHTML=soilDetails(u,f.properties.mukey,properties);
    L.popup({maxWidth:350,maxHeight:420}).setLatLng(e.latlng).setContent(content).openOn(map);
  });
  document.addEventListener('context-view',e=>{sceneCodes=e.detail?.soils;legend();});
  map.on('moveend',legend);
}
