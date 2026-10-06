const D=window.HJA, records=D.summary, byId=Object.fromEntries(records.map(r=>[r.id,r]));
const map=L.map('map',{scrollWheelZoom:false}).setView([44.24,-122.185],13);
// Fixed panes keep nested catchments clickable, regardless of selection order.
for(const [name,z] of Object.entries({terrain:300,streams:350,lookout:400,mack:410,catchments:420,gauges:430})){
  map.createPane(name).style.zIndex=z;
}
map.getPane('terrain').style.pointerEvents='none';
map.getPane('streams').style.pointerEvents='none';
const basemap=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
  maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);
const terrain=L.imageOverlay('terrain.png',D.terrainBounds,{opacity:1,pane:'terrain',interactive:false}).addTo(map);
const colors={Treatment:'#aa592c',Reference:'#1f735d',Context:'#42627f'};
const layers={}, markers={}, all=L.featureGroup();
let selected='1';
function labels(){Object.entries(layers).forEach(([id,l])=>{if(l.getTooltip())l.getTooltip().setOpacity(map.getZoom()>=14||id===selected||id==='Mack'?.95:0);});}
const stream=L.geoJSON(D.streams,{pane:'streams',style:{color:'#497a94',weight:1,opacity:.55},interactive:false}).addTo(map);
const sorted=[...D.catchments.features].sort((a,b)=>b.properties.Area_ha-a.properties.Area_ha);
for(const f of sorted){const id=f.properties.Wshed_Name,r=byId[id];const layer=L.geoJSON(f,{pane:id==='Lookout'?'lookout':id==='Mack'?'mack':'catchments',style:{color:colors[r.role],weight:id==='Lookout'?1.8:2,fillColor:colors[r.role],fillOpacity:r.role==='Context'?.025:.18,dashArray:r.role==='Context'?'6 4':null}}).addTo(map);layers[id]=layer;all.addLayer(layer);layer.eachLayer(path=>{const el=path.getElement();el.setAttribute('aria-label',r.name+' boundary');el.setAttribute('role','button');el.setAttribute('tabindex','0');el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(id,false);}});});layer.on('click',()=>select(id,false));if(id!=='Lookout'){layer.bindTooltip(id==='Mack'?'Mack Creek':'WS'+id,{permanent:true,direction:'center',className:'map-label'});}markers[id]=L.circleMarker([r.lat,r.lon],{pane:'gauges',radius:3,fillColor:'#203932',color:'#fff',weight:1,fillOpacity:1}).addTo(map).bindTooltip(r.name+' gauge').on('click',()=>select(id,false));}
L.control.scale({imperial:false}).addTo(map);
L.control.layers({'OpenStreetMap':basemap}, {'Lidar hillshade':terrain,'Stream network':stream},{collapsed:true}).addTo(map);
function fit(ids){const bounds=L.latLngBounds([]);ids.forEach(id=>bounds.extend(layers[id].getBounds()));map.fitBounds(bounds,{padding:[24,24]});}
function select(id,zoom=true){selected=id;labels();const r=byId[id];document.querySelectorAll('[data-ws]').forEach(b=>{b.classList.toggle('active',b.dataset.ws===id);b.setAttribute('aria-pressed',String(b.dataset.ws===id));});Object.entries(layers).forEach(([k,l])=>l.setStyle({weight:k===id?3.5:(k==='Lookout'?1.8:2),fillOpacity:k===id?.28:(byId[k].role==='Context'?.025:.18)}));if(zoom)fit([id]);document.querySelector('#detail').innerHTML=`<div class="role">${r.group} · ${r.role}</div><h3>${r.name}</h3><dl><dt>Surveyed gauge area</dt><dd>${r.survey_area_ha.toLocaleString()} ha</dd><dt>2018 GIS area</dt><dd>${r.gis_area_ha.toFixed(2)} ha</dd><dt>Gauge / maximum</dt><dd>${r.gauge_elevation_m} / ${r.max_elevation_m} m</dd><dt>Reference basin</dt><dd>${r.reference?'WS'+r.reference:r.role==='Reference'?'Reference itself':'Not assigned'}</dd><dt>Gauge record starts</dt><dd>${r.gauge_start}</dd></dl><p>${r.treatment}</p><p><strong>Later disturbance.</strong> ${r.disturbance}</p><details><summary>Source notes</summary><p>${r.notes}</p></details><div class="links"><a href="${r.source}" target="_blank" rel="noopener">Detailed history ↗</a>${r.dem_file?`<a href="data/${r.dem_file}" download>1 m DEM ↓</a>`:''}</div>`;}
const buttons=document.querySelector('#catchment-buttons');
for(const r of records){const b=document.createElement('button');b.textContent=r.id.match(/^\d+$/)?'WS'+r.id:r.id+' Creek';b.dataset.ws=r.id;b.addEventListener('click',()=>select(r.id));buttons.append(b);}
document.querySelector('#group').addEventListener('change',e=>{const ids=records.filter(r=>e.target.value==='all'||r.group===e.target.value).map(r=>r.id);fit(ids);select(ids[0],false);document.querySelectorAll('[data-ws]').forEach(b=>b.hidden=!ids.includes(b.dataset.ws));});
document.querySelector('#reset').addEventListener('click',()=>{document.querySelector('#group').value='all';document.querySelectorAll('[data-ws]').forEach(b=>b.hidden=false);fit(records.map(r=>r.id));});
document.querySelector('#summary-rows').innerHTML=records.map(r=>`<tr><td><button data-select="${r.id}">${r.id.match(/^\d+$/)?'WS'+r.id:r.id}</button><br><span class="small">${r.role}</span></td><td>${r.survey_area_ha.toLocaleString()}</td><td>${r.reference?'WS'+r.reference:'—'}</td><td>${r.treatment}<br><a class="small" href="${r.source}" target="_blank" rel="noopener">Source, p. ${r.history_page} ↗</a></td><td>${r.disturbance}</td></tr>`).join('');
document.querySelectorAll('[data-select]').forEach(b=>b.addEventListener('click',()=>{select(b.dataset.select);document.querySelector('#explore').scrollIntoView({behavior:'smooth'});}));
map.on('zoomend',labels);fit(records.map(r=>r.id));select('1',false);
