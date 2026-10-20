const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function bufferDetails(){return `<div class="eyebrow">EAGLE BUFFERS · 2026 SOURCE</div><h3>Maguire Peaks</h3><p>The supplied minimum (${window.SFPUCUnits.html(800,'length',0)}) and maximum (${window.SFPUCUnits.html(1600,'length',0)}) polygons both contain all ten mapped Maguire Ridge plot centers.</p><p>Species code: GOEA. Minimum and maximum are the source layer names. The polygons retain the original KMZ vertices.</p><p class="small muted">Source: SFPUC 2026 Eagle Nests and Buffers.kmz, provided 20 October 2026. These polygons do not establish current nest activity or the applicable conditions for a particular field activity.</p><p class="small muted">The 3D fill follows the available Maguire Ridge terrain only. Its rectangular cutout edge is not a buffer boundary; use 2D to see the complete polygons.</p><p><a href="data/eagle-buffers/buffers.geojson" download>Buffer polygons · GeoJSON ↓</a> · <a href="data/eagle-buffers/metadata.json">Source notes</a></p>`;}
export function containsBuffer(point,rings){
  const inside=ring=>{let yes=false;const [x,y]=point;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [a,b]=ring[i],[c,d]=ring[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)yes=!yes;}return yes;};
  return inside(rings[0])&&!rings.slice(1).some(inside);
}
export async function setupEagleBuffers({map,notice,isMeasuring,closeInspector,showDetails}){
  const $=id=>document.getElementById(id),group=L.layerGroup();let layers=[];
  map.createPane('eagleBuffers').style.zIndex=335;
  try{
    const r=await fetch('data/eagle-buffers/buffers.geojson');if(!r.ok)throw Error(r.status);const data=await r.json();
    layers=data.features.map(f=>{const kind=f.properties.id.endsWith('-min')?'min':'max',layer=L.geoJSON(f,{pane:'eagleBuffers',style:{color:f.properties.color,weight:2,dashArray:kind==='max'?'8 5':null,fillColor:f.properties.color,fillOpacity:.16},onEachFeature:(feature,l)=>{l.bindTooltip(`${esc(feature.properties.territory)} · ${esc(feature.properties.buffer_class)} buffer`);l.on('click',e=>{if(isMeasuring())return;L.DomEvent.stopPropagation(e);closeInspector();showDetails(bufferDetails());});}});return {kind,layer};});
    function refresh(){group.clearLayers();const enabled=$('layer-eagles').checked;$('eagle-options').hidden=!enabled;for(const {kind,layer} of layers){layer.setStyle({fillOpacity:Number($('eagle-opacity').value)/100});if(enabled&&$('eagle-'+kind).checked)layer.addTo(group);}if(enabled)group.addTo(map);else map.removeLayer(group);document.dispatchEvent(new Event('eagle-buffers-change'));}
    $('layer-eagles').disabled=false;
    $('layer-eagles').onchange=()=>{if($('layer-eagles').checked&&!$('eagle-min').checked&&!$('eagle-max').checked){$('eagle-min').checked=true;$('eagle-max').checked=true;}refresh();};
    for(const id of ['eagle-min','eagle-max'])$(id).onchange=refresh;
    $('eagle-opacity').oninput=refresh;
    $('eagle-fit').onclick=()=>{document.getElementById('close-3d').click();map.fitBounds(L.geoJSON(data).getBounds(),{padding:[45,85]});document.body.classList.remove('layers-open');$('mobile-layers').setAttribute('aria-expanded','false');};
    $('eagle-details').onclick=()=>showDetails(bufferDetails());refresh();
  }catch(e){console.error(e);notice('Eagle buffers could not load. Reload to retry.');}
}
