/* Rancho atlas: static, processed research products only. */
'use strict';
const dataURL = path => path+'?v=valley-outlet-20261016';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors = {well:'#83edff',piezometer:'#efbf73',weather:'#f4eee0',sapflow:'#c0ec94',soil:'#b69ce9',outlet:'#ff947a'};
const kindName = {well:'Monitoring well',piezometer:'Piezometer',weather:'Weather station',sapflow:'Sap-flow sensor',soil:'Soil-moisture sensor',outlet:'Main catchment outlet',catchment:'Subcatchment',watershed:'Study watershed'};
const enabled = new Set(['canopy','contour','watershed','catchment','channel','well','piezometer','weather','outlet']);
let map, manifest, canopyMeta, canopyRaster, coverage, holes, catchments, instruments, channels, contours, features, hillshade, base, scene, selected;
const layerGroups = {}, markers = new Map();
let currentView = 'watershed', sceneModule;

async function getJSON(url) {
  const response = await fetch(dataURL(url));
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

function featureVisible(f) { return enabled.has(f.properties.kind); }
function updateStatus() {
  const n = holes.filter(f => f.geometry && featureVisible(f)).length;
  $('status').textContent = `${n} of ${manifest.mapped_boreholes} located boreholes shown · compiled ${manifest.compiled}`;
}
function setLayer(kind, checked) {
  if (checked) enabled.add(kind); else enabled.delete(kind);
  if (layerGroups[kind]) checked ? layerGroups[kind].addTo(map) : map.removeLayer(layerGroups[kind]);
  const checkbox = document.querySelector(`[data-layer="${kind}"]`);
  if (checkbox) checkbox.checked = checked;
  scene?.setVisible(enabled);
  $('canopy-key').hidden=!enabled.has('canopy');
  updateStatus();
}
function boundsFor(view) {
  if (view === 'watershed') return L.geoJSON(catchments.filter(f => f.properties.kind === 'watershed')).getBounds();
  if (view === 'network') return L.geoJSON([...catchments.filter(f => f.properties.kind === 'catchment' && !['MH9','MH10'].includes(f.properties.id)),...instruments.filter(f => f.properties.kind === 'outlet')]).getBounds();
  return L.geoJSON(catchments.filter(f => f.properties.id === view)).getBounds();
}
function view(name) {
  currentView = name;
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('selected', b.dataset.view === name));
  $('view-title').textContent = name === 'watershed' ? 'Mountain House watershed' : name === 'network' ? 'The monitoring network' : `${name} · hillslope & channel`;
  $('view-subtitle').textContent = scene?.active ? (Number($('vertical-scale').value)===3?'Canopy, terrain & boreholes · vertical scale exaggerated 3×':'Canopy, terrain & boreholes · true metric scale') : '2019 LiDAR · 2017 northwestern gap fill';
  if (scene?.active) scene.focus(name); else map.fitBounds(boundsFor(name), {padding:[30,95],maxZoom:19});
  closeMobileLayers();
}
function closeMobileLayers() {
  $('sidebar').classList.remove('open');
  $('mobile-layers').setAttribute('aria-expanded','false');
}
function depthGraphic(p) {
  if (p.depth_m == null) return `<p class="feature-note notice">${p.easting_m == null ? 'No mapped position or depth is recorded. This hole is retained in the inventory.' : 'Depth is not recorded. This hole appears as a surface marker only.'}</p>`;
  const d = p.depth_m, screen = p.screen_m;
  const sy = v => 24 + v/d*142;
  return `<svg class="depth-diagram" viewBox="0 0 250 200" role="img" aria-label="${esc(p.id)}: ${d.toFixed(2)} metres ${p.depth_basis === 'completed' ? 'completed' : 'drilled'} depth below ground">
    <path d="M16 24H232" stroke="#a6bbc0"/><text x="16" y="15" fill="#a6bbc0" font-size="10">GROUND SURFACE</text>
    <rect x="76" y="25" width="15" height="141" fill="${colors[p.kind]}" opacity=".09"/>
    <path d="M84 24V166" stroke="${colors[p.kind]}" stroke-width="6" ${p.depth_basis === 'drilled' ? 'stroke-dasharray="5 4"' : ''}/>
    ${screen ? `<path d="M84 ${sy(screen[0])}V${sy(screen[1])}" stroke="#edf3ee" stroke-width="9"/><text x="108" y="${Math.max(52,sy(screen[0])+12)}" font-size="10" fill="#edf3ee">Screen ${screen[0].toFixed(2)}–${screen[1].toFixed(2)} m</text>` : '<text x="108" y="98" font-size="10" fill="#a6bbc0">Screen interval unknown</text>'}
    <text x="16" y="42" fill="#a6bbc0" font-size="11">0 m</text><text x="16" y="170" fill="#edf3ee" font-size="12">${d.toFixed(2)} m</text><text x="16" y="191" fill="#a6bbc0" font-size="10">Individual hole scale · width enlarged</text>
  </svg>`;
}
function inspect(f, move = false) {
  selected = f;
  const p = f.properties;
  closeMobileLayers();
  if (move && f.geometry) {
    setLayer(p.kind, true);
    if (scene?.active && f.geometry.type === 'Point') scene.focusHole(f);
    else if (scene?.active && ['catchment','watershed'].includes(p.kind)) scene.focus(p.kind === 'watershed' ? 'watershed' : p.id);
    else if (!scene?.active) {
      if (f.geometry.type === 'Point') map.setView([f.geometry.coordinates[1], f.geometry.coordinates[0]],19);
      else map.fitBounds(L.geoJSON(f).getBounds(),{padding:[40,80]});
    }
  }
  const isHole = ['well','piezometer'].includes(p.kind);
  let body = `<div class="feature-type">${esc(kindName[p.kind] || p.kind)}</div><h2>${esc(p.id)}</h2>`;
  if (f.geometry?.type === 'Point') body += `<div class="feature-coords">${f.geometry.coordinates[1].toFixed(6)}° N<br>${Math.abs(f.geometry.coordinates[0]).toFixed(6)}° W</div>`;
  if (isHole) {
    body += `<div class="feature-metrics"><div><strong>${p.depth_m == null ? '—' : p.depth_m.toFixed(2)+' m'}</strong><small>${p.depth_basis === 'completed' ? 'Completed depth' : p.depth_basis === 'drilled' ? 'Original drilled depth' : 'Depth unknown'}</small></div><div><strong>${p.ground_m == null ? '—' : p.ground_m.toFixed(1)+' m'}</strong><small>DEM ground elevation</small></div></div>`;
    if (p.note) body += `<p class="feature-note notice">${esc(p.note)}</p>`;
    if (p.depth_basis === 'drilled') body += '<p class="feature-note notice">Original drilled depth only. Final completion and screen interval are not confirmed in this record.</p>';
    body += depthGraphic(p);
    body += `<dl><dt>Location description</dt><dd>${esc(p.location || 'Not recorded')}</dd><dt>Recorded completion</dt><dd>${esc(p.completion)}</dd><dt>Drilled</dt><dd>${esc(p.installed || 'Date not recorded')}</dd>`;
    if (p.original_id && p.original_id !== p.id) body += `<dt>Original drill-log ID</dt><dd>${esc(p.original_id)} · use current ID above for mapping</dd>`;
    if (p.screen_source) body += `<dt>Screen interval source</dt><dd>${esc(p.screen_source)}</dd>`;
    body += `</dl><p class="feature-note ${['MH7W4','MH8W1'].includes(p.id) || !f.geometry ? 'notice' : ''}">${esc(p.position_note)}</p><p class="depth-key">Ground elevation is sampled from the DEM. No current water level is shown.</p><p class="feature-source">${esc(p.position_source || 'No mapped position')}<br><a href="${manifest.sources[0].url}#range=A${p.source_row}:AK${p.source_row}" target="_blank" rel="noopener">Metadata · row ${p.source_row} ↗</a></p>`;
  } else if (p.area_ha != null) {
    body += `<div class="feature-metrics"><div><strong>${p.area_ha.toFixed(1)} ha</strong><small>${p.provisional ? 'Provisional DEM-delineated area' : p.delineation ? 'DEM-delineated area' : 'Archived delineated area'}</small></div></div><p class="feature-note">${esc(p.note)}</p><p class="feature-note">Borehole prefixes name monitoring groups. A hole can sit on a shared ridge or within an adjacent catchment.</p><p class="feature-source">${esc(p.source)}</p>`;
  } else {
    body += `<p class="feature-note">${esc(p.description || '')}</p><p class="feature-note">${esc(p.position_note)}</p><p class="feature-source">${esc(p.source)}</p>`;
    if (p.kind === 'weather') body += '<p><a href="../">Open the weather dashboard →</a></p>';
  }
  $('feature-details').innerHTML = body;
  $('inspector').hidden = false;
  $('close-inspector').focus({preventScroll:true});
  scene?.highlight(p.id);
}
function pointMarker(f, latlng) {
  const p=f.properties, provisional=['MH7W4','MH8W1'].includes(p.id);
  return L.circleMarker(latlng,{pane:'fieldData',radius:p.kind==='outlet'?8:p.kind==='well'?6.5:5,color:provisional?'#ffffff':'#12414a',weight:2,fillColor:colors[p.kind],fillOpacity:1,dashArray:provisional?'2 2':null});
}
function addPoints(list, kind) {
  const group = L.geoJSON(list.filter(f => f.properties.kind === kind && f.geometry),{
    pointToLayer:pointMarker,
    onEachFeature(f,l){l.bindTooltip(esc(f.properties.id),{direction:'top',className:'point-label'});l.on('click',()=>inspect(f));markers.set(f.properties.id,l);}
  });
  layerGroups[kind]=group;
  if(enabled.has(kind))group.addTo(map);
}
function refreshLabels() {
  layerGroups.contour?.setStyle(f=>({opacity:f.properties.major?.45:(map.getZoom()>=17?.23:0)}));
  document.getElementById('map').classList.toggle('overview',map.getZoom()<16.5);
  markers.forEach((marker,id)=>{const p=features.find(f=>f.properties.id===id)?.properties;
    const permanent=map.getZoom()>=18 && p?.kind==='well';
    marker.unbindTooltip().bindTooltip(esc(id),{permanent,direction:'top',className:'point-label',offset:[0,-6]});
  });
}
function setBasemap(name) {
  document.getElementById('map').classList.toggle('terrain-mode',name==='terrain');
  if(base)map.removeLayer(base);
  if(map.hasLayer(hillshade))map.removeLayer(hillshade);
  if(name==='satellite')base=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:21,maxNativeZoom:19,attribution:'Imagery © Esri, Maxar, Earthstar Geographics'});
  else base=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:21,maxNativeZoom:19,attribution:'Tiles © Esri · USGS, NOAA, GIS community'});
  $('lidar-controls').hidden=name!=='terrain';
  base?.on('tileerror',()=>{$('status').textContent='Online basemap unavailable. Local terrain and field records remain available.';});
  base?.addTo(map); if(name==='terrain')hillshade.addTo(map);
  document.querySelectorAll('[data-basemap]').forEach(b=>{b.classList.toggle('selected',b.dataset.basemap===name);b.setAttribute('aria-pressed',String(b.dataset.basemap===name));});
}
function search() {
  const query=$('search').value.trim().toLowerCase();
  $('search-results').replaceChildren();
  if(!query)return;
  const matches=features.filter(f=>`${f.properties.id} ${kindName[f.properties.kind]} ${f.properties.description||''}`.toLowerCase().includes(query)).slice(0,15);
  if(!matches.length){$('search-results').textContent='No matching field features.';return;}
  matches.forEach(f=>{const b=document.createElement('button');b.innerHTML=`${esc(f.properties.id)}<small>${esc(kindName[f.properties.kind])}${!f.geometry?' · unlocated':''}</small>`;b.onclick=()=>inspect(f,true);$('search-results').append(b);});
}
function inventory() {
  const q=$('inventory-search').value.trim().toLowerCase();
  const filtered=holes.filter(f=>`${f.properties.id} ${f.properties.kind} ${f.properties.group}`.toLowerCase().includes(q));
  $('inventory-count').textContent=`${filtered.length} / ${holes.length}`;
  $('inventory-rows').replaceChildren();
  filtered.forEach(f=>{const p=f.properties,tr=document.createElement('tr');tr.innerHTML=`<td><button>${esc(p.id)}</button></td><td>${esc(p.kind)}</td><td>${p.depth_m==null?'Unknown':p.depth_m.toFixed(2)+' m'}</td><td>${esc(p.depth_basis)}</td><td>${!f.geometry?'Unlocated':['MH7W4','MH8W1'].includes(p.id)?'Provisional KML':'Metadata UTM'}</td>`;tr.querySelector('button').onclick=()=>{$('inventory').close();inspect(f,true);};$('inventory-rows').append(tr);});
}
function exportData() {
  const bounds=map.getBounds();
  const visible=[...features,...channels,...contours].filter(f=>f.geometry && featureVisible(f) && (scene?.active || bounds.intersects(L.geoJSON(f).getBounds())));
  const blob=new Blob([JSON.stringify({type:'FeatureCollection',compiled:manifest.compiled,note:'Selected layers; map extent in 2D, all selected layers in 3D. Historical records, not current operating status.',features:visible},null,2)],{type:'application/geo+json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='rancho-atlas.geojson';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function toggle3D() {
  if(scene?.active){scene.close();$('scene').hidden=true;$('scene-tools').hidden=true;$('basemaps').hidden=false;$('lidar-controls').hidden=!map.hasLayer(hillshade);$('map').hidden=false;$('toggle-3d').setAttribute('aria-pressed','false');map.invalidateSize();view(currentView);return;}
  $('toggle-3d').disabled=true;$('scene-loading').hidden=false;$('scene-loading').textContent='Opening LiDAR canopy & terrain…';
  try{
    sceneModule??=await import('./scene.js?v=2e46e10bb512');
    if(!scene)scene=await sceneModule.createScene({holes,catchments,channels,instruments,enabled,inspect,canopyMeta,coverage,dataURL});
    $('scene').hidden=false;$('map').hidden=true;$('scene-tools').hidden=false;$('basemaps').hidden=true;$('lidar-controls').hidden=true;
    scene.canopyOpacity(Number($('canopy-opacity').value));scene.open();scene.focus(currentView==='watershed'?'network':currentView);
    $('toggle-3d').setAttribute('aria-pressed','true');$('view-subtitle').textContent=Number($('vertical-scale').value)===3?'Canopy, terrain & boreholes · vertical scale exaggerated 3×':'Canopy, terrain & boreholes · true metric scale';$('scene-loading').hidden=true;
  }catch(error){console.error(error);$('scene-loading').textContent='3D could not open. The map and depth inventory are still available. '+error.message;}
  finally{$('toggle-3d').disabled=false;}
}
async function init() {
  const data=await Promise.all(['manifest.json','boreholes.geojson','catchments.geojson','instruments.geojson','channels.geojson','contours.geojson','canopy.json','canopy-coverage.geojson'].map(file=>getJSON('data/'+file)));
  [manifest]=data;holes=data[1].features;catchments=data[2].features;instruments=data[3].features;channels=data[4].features;contours=data[5].features;canopyMeta=data[6];coverage=data[7];features=[...holes,...catchments,...instruments];
  map=L.map('map',{zoomControl:false,maxZoom:21,zoomSnap:.25,preferCanvas:true});L.control.zoom({position:'topright'}).addTo(map);L.control.scale({imperial:false}).addTo(map);
  map.createPane('fieldData');map.getPane('fieldData').style.zIndex=625;
  map.createPane('terrain');map.getPane('terrain').style.zIndex=300;map.getPane('terrain').style.pointerEvents='none';
  map.createPane('canopy');map.getPane('canopy').style.zIndex=325;map.getPane('canopy').style.pointerEvents='none';
  map.createPane('contours');map.getPane('contours').style.zIndex=350;map.getPane('contours').style.pointerEvents='none';
  layerGroups.contour=L.geoJSON(contours,{pane:'contours',interactive:false,style:f=>({color:'#39443d',weight:f.properties.major?1:.55,opacity:f.properties.major?.45:.23})}).addTo(map);
  hillshade=L.imageOverlay(dataURL('data/hillshade.webp'),manifest.hillshade_bounds,{pane:'terrain',opacity:1,attribution:'LiDAR © NCALM / OpenTopography · <a href="https://doi.org/10.5069/G9FX77MW">2019</a> + <a href="https://doi.org/10.5069/G9QC01MQ">2017</a> · CC BY 4.0'});
  setBasemap('terrain');
  canopyRaster=L.imageOverlay(dataURL('data/'+canopyMeta.raster.url),canopyMeta.raster.bounds,{pane:'canopy',opacity:.7});
  layerGroups.canopy=canopyRaster.addTo(map);
  layerGroups.coverage=L.geoJSON(coverage,{interactive:false,style:{color:'#f2dfb1',weight:2,dashArray:'6 5',fill:false}});
  for(const kind of ['watershed','catchment']){
    layerGroups[kind]=L.geoJSON(catchments.filter(f=>f.properties.kind===kind),{style:f=>({color:kind==='watershed'?'#e0c68c':'#d1f3b2',weight:kind==='watershed'?2:1.5,fillColor:'#c0ec94',fillOpacity:kind==='watershed'?0:.07,dashArray:f.properties.id==='MH9'||f.properties.provisional?'6 5':null}),onEachFeature(f,l){l.on('click',()=>inspect(f));}}).addTo(map);
    if(kind==='catchment')catchments.filter(f=>f.properties.kind==='catchment').forEach(f=>{const [lon,lat]=f.properties.label_position;L.marker([lat,lon],{icon:L.divIcon({className:'',html:`<span class="catchment-label">${esc(f.properties.id)}</span>`,iconSize:[45,24],iconAnchor:[22,12]}),keyboard:true,title:f.properties.id}).on('click',()=>inspect(f)).addTo(layerGroups[kind]);});
  }
  layerGroups.channel=L.geoJSON(channels,{style:{color:'#a1d7e2',weight:1.4,opacity:.65},interactive:false}).addTo(map);
  for(const kind of Object.keys(colors))addPoints([...holes,...instruments],kind);
  const layers=[['Land & water',[['canopy','Canopy · 2019/17'],['coverage','LiDAR survey coverage'],['contour','LiDAR contours · 2 m'],['watershed','Watershed boundary'],['catchment','MH1–MH10 catchments'],['channel','Drainage network']]],['Monitoring network',[['well','Wells & moisture holes'],['piezometer','Piezometers'],['weather','Weather station'],['outlet','Main catchment outlet']]],['Field sensors · February 2024',[['sapflow','Sap-flow waypoints'],['soil','Soil-moisture waypoints']]]];
  $('layer-list').innerHTML=layers.map(([group,list])=>`<div class="layer-group">${group}</div>`+list.map(([kind,label])=>`<label class="layer-row"><input type="checkbox" data-layer="${kind}" ${enabled.has(kind)?'checked':''}><i class="dot" style="--c:${colors[kind]||'#c0ec94'}"></i>${label}<span class="count">${kind==='canopy'?'1 m':kind==='coverage'?'footprint':kind==='contour'?'10 m index':kind==='channel'?channels.length:features.filter(f=>f.geometry&&f.properties.kind===kind).length}</span></label>`).join('')).join('');
  document.querySelectorAll('[data-layer]').forEach(el=>el.onchange=()=>setLayer(el.dataset.layer,el.checked));
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
  document.querySelectorAll('[data-basemap]').forEach(b=>b.onclick=()=>setBasemap(b.dataset.basemap));
  $('search').oninput=search;$('clear-search').onclick=()=>{$('search').value='';search();$('search').focus();};
  $('close-inspector').onclick=()=>{$('inspector').hidden=true;selected=null;scene?.highlight(null);$('search').focus({preventScroll:true});};
  $('mobile-layers').onclick=()=>{const open=$('sidebar').classList.toggle('open');$('mobile-layers').setAttribute('aria-expanded',String(open));};
  $('hole-count').textContent=manifest.borehole_records;$('depth-count').textContent=manifest.known_depths;
  $('inventory-button').onclick=()=>{inventory();$('inventory').showModal();};$('inventory-search').oninput=inventory;
  $('methods-content').innerHTML=`<p>Compiled ${manifest.compiled}. This atlas covers the Mountain House study watershed upstream of the main valley exit marked by the user, snapped to the LiDAR-derived main channel. Its outer boundary is delineated from that pour point; archived MH1–MH9 and provisional MH10 remain unchanged. It is not a ranch property map.</p><h3>Read the subsurface carefully</h3><p>${manifest.borehole_records} borehole records · ${manifest.mapped_boreholes} mapped positions · ${manifest.known_depths} documented depths. MH3P6 was abandoned and has no mapped coordinate. All known holes remain searchable in the inventory.</p><ul>${manifest.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul><h3>Placement that needs confirmation</h3><p>MH7W4 uses its south-slope position from the retired February 2019 KML, consistent with the figures in both papers. The metadata coordinate is near MH8W1 on the north slope. MH8W1 is also located from the retired KML because its metadata coordinates are blank. Both points are marked provisional.</p><h3>Measured canopy · 2019 with 2017 gap fill</h3><p>The 2D canopy-height raster is the maximum eligible measured-return height above the matching bare-earth DEM in each 1 m cell. Cells without returns are transparent. The 3D cloud contains ${canopyMeta.cloud.count.toLocaleString()} sampled actual returns, with the same height colors as Rivendell and SFPUC. The display uses 0.6 m voxel thinning within processing chunks, seeded sampling and a final duplicate-voxel check, then 0.1 m coordinate quantization. Source point elevations are retained, without vertical offsets.</p><p>The main survey is 16–17 April 2019. Its northwestern gap is filled with measured returns and the matching DEM from 16–17 March 2017. The terrain now covers 100% of study-watershed cells at 1 m resolution. Turn on LiDAR survey coverage to see the 2017 fill boundary. This two-date mosaic does not establish present canopy condition, tree identity or mortality. Class 1 includes unclassified above-ground returns and can include non-vegetation objects. Ground and noise points are omitted from the cloud.</p><p>${esc(canopyMeta.attribution)} <a href="${canopyMeta.doi}" target="_blank" rel="noopener">2019 survey ↗</a> · <a href="https://doi.org/10.5069/G9QC01MQ" target="_blank" rel="noopener">2017 survey ↗</a>. Both surveys: Dietrich / NCALM, CC BY 4.0. <a href="data/canopy.json">Processing and elevation checks ↗</a></p><h3>LiDAR contours</h3><p>Contours follow the composite NCALM bare-earth DEM (2019, with 2017 in the northwestern gap) at 1 m resolution at 2 m elevation intervals, with stronger 10 m index lines. Index contours remain visible at the overview scale; zoom in for the 2 m detail. The 3D view shows 10 m index contours draped over its display mesh. The layer switch controls both views. Missing DEM cells are masked; lines are simplified within 0.6 m and isolated segments shorter than 8 m are omitted.</p><h3>Terrain & depth</h3><p>The NCALM bare-earth DEMs (2019 at 0.25 m and 2017 at 0.5 m, resampled to 1 m) supply ground elevations and the 10 m 3D display mesh in NAVD88. Small holes in the 2017 provider raster were reconstructed with a local TIN of measured ground returns, bounded by their convex hull and a 20 m nearest-return limit. Neither survey has been vertically shifted; the median overlap difference is about 1 cm. The 3D surface uses metric NAD83 / UTM zone 10N coordinates. Elevation and depth share a 1:1 scale by default; the optional 3× mode exaggerates both. Collars are anchored to the rendered DEM triangles; documented depths extend below those collars. Fixed-size wellhead symbols and outlined shafts are drawn over terrain and canopy for visibility. This is display placement, not a correction to source DEM elevations. Shaft widths are enlarged. Light screen segments are drawn only where a screen interval is documented. The atlas does not reconstruct a groundwater surface or geological contacts.</p><h3>Source records</h3><ul>${manifest.sources.map(s=>`<li>${s.url?`<a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)} ↗</a>`:esc(s.title)}${s.note?' · '+esc(s.note):''}</li>`).join('')}</ul><p>Drive links retain their existing access permissions. This site contains compact derived map products; full drilling notes, manuscripts, raw data and credentials stay outside the public repository.</p><h3>Continue building</h3><p>Next layers: reconciled completion logs, tree mortality and crown surveys, and water-year hydrologic bundles with freshness and provenance. These observations are not yet represented here.</p><p><a href="data/manifest.json" download>Download source manifest ↗</a> · <a href="data/boreholes.geojson" download>Download the full borehole inventory ↗</a></p>`;
  $('methods-button').onclick=()=>$('methods').showModal();document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
  $('lidar-opacity').oninput=e=>{const value=Number(e.target.value);hillshade.setOpacity(value);$('lidar-opacity-value').value=Math.round(value*100)+'%';};
  $('canopy-opacity').oninput=e=>{const value=Number(e.target.value);canopyRaster.setOpacity(value);scene?.canopyOpacity(value);};
  $('export').onclick=exportData;$('toggle-3d').onclick=toggle3D;
  $('scene-home').onclick=()=>scene?.focus(currentView==='watershed'?'network':currentView);$('scene-top').onclick=()=>scene?.top();
  $('ground-opacity').oninput=e=>scene?.opacity(Number(e.target.value));$('vertical-scale').onchange=e=>{scene?.verticalScale(Number(e.target.value));$('view-subtitle').textContent=Number(e.target.value)===1?'Canopy, terrain & boreholes · true metric scale':'Canopy, terrain & boreholes · vertical scale exaggerated 3×';};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('inspector').hidden=true;closeMobileLayers();}});
  map.on('zoomend',refreshLabels);view('network');refreshLabels();updateStatus();$('loading').hidden=true;
  // Exposed read-only data and map references support reproducible browser QA.
  window.ranchoAtlas={map,holes,catchments,instruments,contours,manifest,canopyMeta,get scene(){return scene;}};
}
init().catch(error=>{console.error(error);$('loading').textContent='The atlas could not load. Reload to try again. '+error.message;});
