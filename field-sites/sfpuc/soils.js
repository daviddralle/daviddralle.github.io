// Cached NRCS polygons: no third-party request is needed while using the map.
export function setupSoils({map,notice,isMeasuring,closeInspector}){
  const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let metadata,data,loading,polygons;
  const group=L.layerGroup(),attribution='<a href="https://sdmdataaccess.sc.egov.usda.gov/">Soils: USDA NRCS SSURGO</a>';
  map.createPane('soils').style.zIndex=300;map.getPane('soils').style.pointerEvents='none';
  async function load(){
    if(!loading)loading=Promise.all(['metadata.json','units.geojson'].map(async f=>{const r=await fetch('data/soils/'+f);if(!r.ok)throw Error('Soils: HTTP '+r.status);return r.json();})).then(([m,d])=>{metadata=m;data=d;}).catch(e=>{loading=null;throw e;});
    return loading;
  }
  function legend(){
    if(!polygons||!map.hasLayer(group))return;
    const keys=new Set();polygons.eachLayer(l=>{if(map.getBounds().intersects(l.getBounds()))keys.add(l.feature.properties.mukey);});
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
    content.innerHTML=`<div class="eyebrow">SOIL MAP UNIT · ${esc(u.musym)}</div><h3>${esc(u.muname)}</h3><p>${esc(u.areaname)} · ${esc(u.areasymbol)}</p><p class="geology-scale">Mapped soil units may contain multiple soil components and local inclusions. This is not a soil measurement at a tree or plot. Slope ranges belong to the map-unit name.</p><p><a href="${metadata.source_url}" target="_blank" rel="noopener">USDA NRCS SSURGO ↗</a><br>Retrieved 14 October 2026 · map-unit key ${esc(f.properties.mukey)}</p>`;
    L.popup({maxWidth:310}).setLatLng(e.latlng).setContent(content).openOn(map);
  });
  map.on('moveend',legend);
}
