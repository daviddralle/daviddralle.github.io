// Regional geology is a separate, optional 2D overlay; field layers stay above it.
export function setupGeology({map,notice,isMeasuring}){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let metadata,units,lines,loading,polygons;
  const group=L.layerGroup();
  const attribution='Geology: <a href="https://pubs.usgs.gov/of/1996/of96-252/">USGS · 1996</a>';
  map.createPane('geology').style.zIndex=290;
  map.getPane('geology').style.pointerEvents='none';
  const get=async file=>{const r=await fetch('data/geology/'+file);if(!r.ok)throw new Error(`Geology: HTTP ${r.status}`);return r.json();};
  async function load(){if(!loading)loading=Promise.all(['metadata.json','units.geojson','lines.geojson'].map(get)).then(([m,u,l])=>{metadata=m;units=u;lines=l;}).catch(e=>{loading=null;throw e;});return loading;}
  function details(feature){
    if(isMeasuring())return;
    const p=feature.properties,u=metadata.units[p.unit];
    const content=document.createElement('div');content.className='geology-popup';
    content.innerHTML=u?`<div class="eyebrow">GEOLOGIC UNIT · ${esc(p.unit)}</div><h3>${esc(u.name)}</h3><p>${esc(u.age)}</p><p>${esc(u.description)}</p>`:`<div class="eyebrow">MAPPED ${esc(p.kind.toUpperCase())}</div><h3>${esc(p.type.replace('s.s. fault, r.l.','Right-lateral strike-slip fault'))}</h3><p>Location certainty follows the original map. Fault activity is not evaluated by this layer.</p>`;
    content.innerHTML+=`<p class="geology-scale">Regional context · approximately 1:50,000 detail. Mapped contacts are not surveyed plot boundaries.</p><p><a href="${metadata.source_url}" target="_blank" rel="noopener">USGS OFR 96-252 · 1996 ↗</a> · <a href="${metadata.description_url}" target="_blank" rel="noopener">Unit descriptions ↗</a></p>`;
    return content;
  }
  function legend(){
    if(!metadata||!$('layer-geology').checked)return;
    const b=map.getBounds(),visible=new Set();polygons.eachLayer(layer=>{if(b.intersects(layer.getBounds()))visible.add(layer.feature.properties.unit);});
    $('geology-legend').innerHTML=[...visible].sort().map(code=>{const u=metadata.units[code];return `<div><i style="background:${u.color}"></i><span><b>${esc(code)}</b> ${esc(u.name)}</span></div>`;}).join('')||'<p>Outside the geology cutout. Use Geology extent to return.</p>';
    $('geology-fault-key').hidden=!$('geology-faults').checked;
  }
  function render(){
    group.clearLayers();
    const opacity=Number($('geology-opacity').value)/100;
    polygons=L.geoJSON(units,{pane:'geology',interactive:false,style:f=>({color:metadata.units[f.properties.unit].color,weight:0,fillColor:metadata.units[f.properties.unit].color,fillOpacity:opacity})}).addTo(group);
    L.geoJSON(lines,{pane:'geology',interactive:false,filter:f=>f.properties.kind==='contact'||$('geology-faults').checked,style:f=>({color:f.properties.kind==='fault'?'#9f3243':'#4d5146',weight:f.properties.kind==='fault'?2:1,opacity:.9,dashArray:f.properties.concealed?'2 5':f.properties.certain?null:'7 5'})}).addTo(group);
    L.rectangle([[metadata.bounds[1],metadata.bounds[0]],[metadata.bounds[3],metadata.bounds[2]]],{pane:'geology',color:'#64726b',weight:1,dashArray:'4 5',fill:false,interactive:false}).addTo(group);
    legend();
  }
  $('layer-geology').disabled=false;
  $('layer-geology').onchange=async()=>{
    if(!$('layer-geology').checked){map.removeLayer(group);map.attributionControl.removeAttribution(attribution);$('geology-options').hidden=true;map.closePopup();return;}
    $('geology-status').hidden=false;$('geology-status').textContent='Loading geology…';
    try{await load();if(!$('layer-geology').checked)return;if(!map.hasLayer(group)){group.addTo(map);map.attributionControl.addAttribution(attribution);}$('geology-options').hidden=false;render();}
    catch(e){console.error(e);$('layer-geology').checked=false;notice('The geology layer could not load. Toggle it again to retry.');}
    finally{$('geology-status').hidden=true;}
  };
  $('geology-opacity').oninput=()=>polygons?.setStyle({fillOpacity:Number($('geology-opacity').value)/100});
  $('geology-faults').onchange=()=>{if(metadata)render();};
  $('geology-extent').onclick=()=>{map.fitBounds([[metadata.bounds[1],metadata.bounds[0]],[metadata.bounds[3],metadata.bounds[2]]],{padding:[35,100]});document.body.classList.remove('layers-open');$('mobile-layers').setAttribute('aria-expanded','false');};
  // Canvas field panes cover the viewport. Identify geology from unclaimed map
  // clicks so its lower pane cannot block tree selection or measurement.
  function inRing([x,y],ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
  function inPolygon(point,rings){return inRing(point,rings[0])&&!rings.slice(1).some(r=>inRing(point,r));}
  map.on('click',e=>{
    if(isMeasuring()||!map.hasLayer(group)||!metadata||e.propagatedFrom)return;
    const point=[e.latlng.lng,e.latlng.lat],pixel=map.latLngToLayerPoint(e.latlng);
    let nearest=null,distance=6;
    for(const f of lines.features){
      if(f.properties.kind==='fault'&&!$('geology-faults').checked)continue;
      const paths=f.geometry.type==='MultiLineString'?f.geometry.coordinates:[f.geometry.coordinates];
      for(const path of paths)for(let i=1;i<path.length;i++){
        const a=map.latLngToLayerPoint([path[i-1][1],path[i-1][0]]),b=map.latLngToLayerPoint([path[i][1],path[i][0]]);
        const d=L.LineUtil.pointToSegmentDistance(pixel,a,b);if(d<distance){distance=d;nearest=f;}
      }
    }
    const feature=nearest||units.features.find(f=>(f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates]).some(r=>inPolygon(point,r)));
    if(feature)L.popup({maxWidth:310}).setLatLng(e.latlng).setContent(details(feature)).openOn(map);
  });
  map.on('moveend',legend);
}
