'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors = {'Coast live oak':'#b5ec86','Valley oak':'#efd28d','Blue oak':'#85c7e4','California buckeye':'#d6b5ed','Other / uncertain':'#e7e4d6'};
const state = {site:null, data:{}, views:{}, terrain:true, measuring:false, measurePoints:[], contourMarkers:[]};
let manifest, map, base, hillshade, contours, field, coverage, labels, measurement, selected, locations;
const getJSON = async url => {const r = await fetch(url); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.json();};
const current = () => manifest.sites.find(s => s.id === state.site);
const dataset = () => state.combined;
let scene3d,soilContext,renderSoilDetails;
const notice = text => {$('#notice').textContent=text; $('#notice').hidden=!text;};
const ll = f => [f.geometry.coordinates[1], f.geometry.coordinates[0]];
const checked = id => $(id).checked;
const treeRadius = p => Math.max(3.5, Math.min(10, 2.5 + Math.sqrt(p.dbh_cm)*.65));
const row = (k,v) => `<dt>${esc(k)}</dt><dd>${esc(v === '' || v == null ? 'Not recorded' : v)}</dd>`;
function closeInspector(){ $('#inspector').hidden=true; selected.clearLayers(); }
function closeLayers(){ document.body.classList.remove('layers-open'); $('#mobile-layers').setAttribute('aria-expanded','false'); }
function filteredTrees(){
  return dataset().trees.features.filter(f => {
    const p=f.properties;
    return (!$('#species').value || p.species===$('#species').value) && (!$('#status').value || p.status===$('#status').value) && (!checked('#plan-only') || p.in_sampling_plan);
  });
}
function fitSite(){ scene3d?.focus(state.site); map.fitBounds(current().bounds,{paddingTopLeft:[35,110],paddingBottomRight:[45,60],maxZoom:18}); }
function goFeature(f){
  if (state.measuring) return;
  closeLayers();
  const center=f.geometry.type==='Point' ? ll(f) : [Number(f.properties.latitude),Number(f.properties.longitude)];
  map.setView(center,Math.max(map.getZoom(),20));
  scene3d?.focusFeature(f);
  inspect(f);
}
function treeTooltip(p){return `${esc(p.id)} · ${esc(p.plot)} tag ${esc(p.tree_tag_number)}<br>${esc(p.species)} · ${p.dbh_cm} cm DBH${p.status==='dead'?' · recorded dead':''}`;}
function inspect(f){
  const p=f.properties;
  $('#inspector .inspector-header span').textContent='Field record · 2022';
  const site=manifest.sites.find(s=>s.id===p.site||s.code===p.site);
  if(site){state.site=site.id;$('#map-title').textContent=site.name;$('#site-code').textContent=site.code+' · North';history.replaceState(null,'','#'+site.id);}
  map.closePopup();closeLayers();
  selected.clearLayers();
  if (f.geometry.type==='Point') L.circleMarker(ll(f),{radius:p.kind==='trees'?treeRadius(p)+6:11,color:'#fff',weight:2,fill:false,interactive:false,pane:'selection'}).addTo(selected);
  let html=`<div class="eyebrow">${esc(manifest.sites.find(s=>s.id===p.site||s.code===p.site)?.name||p.site)} · ${esc(p.plot)}</div><h2>${esc(p.id)}</h2>`;
  if(p.kind==='trees'){
    html+=`<div class="subtitle">${esc(p.species)} · field tag ${esc(p.tree_tag_number)}</div><span class="badge ${p.status==='dead'?'dead':''}">Recorded ${esc(p.status)} · 2022</span>${p.in_sampling_plan?'<span class="badge plan">Sampling plan</span>':''}<dl>${row('DBH',p.dbh_cm+' cm')}${row('Crown score',p.crown_condition_rating+' / 10')}${row('Crown position',p.crown_position)}${row('Azimuth',p.azimuth_degrees+'°')}${row('Distance to center',p.distance_from_center_m+' m')}${row('Ground elevation',p.lidar_ground_elevation_m+' m NAVD88')}${row('Record created',p.record_date)}</dl>`;
    if(p.status==='dead') html+=`<dl>${row('Recorded death year',Number(p.year_dead)>0?p.year_dead:'Not recorded')}${row('Cause',p.cause_of_death.replaceAll('_',' '))}</dl>`;
    if(p.diseases_and_pests) html+=`<h3>Recorded condition</h3><p>${esc(p.diseases_and_pests.replaceAll('_',' ').replaceAll(',',', '))}${p.specify_other_pest?'; '+esc(p.specify_other_pest):''}</p>`;
    if(p.notes) html+=`<p>${esc(p.notes)}</p>`;
    if(p.specify_other_species) html+=`<p>Species note: ${esc(p.specify_other_species)}</p>`;
    if(p.in_sampling_plan){
      const plan=p.sampling_plan;
      html+=`<h3>Sampling plan · proposed work</h3><p>${esc(plan['Study role'])}</p><dl>${['Predawn water potential','Midday water potential','Stomatal conductance','Lab hydraulics','Tree-ring width','Tree-ring δ13C'].map(k=>row(k,plan[k])).join('')}</dl><p>${esc(plan['Field verification notes'])}</p><p class="small muted">Plan membership does not establish that measurements or installations are complete.</p>`;
    }
    html+=`<p class="note">Position inherits plot GPS accuracy (reported ${p.gps_accuracy_m} m), plus unquantified bearing and distance error. No present-day status check is implied.</p>`;
  } else if(p.kind==='regeneration'){
    html+=`<div class="subtitle">Regeneration record · ${esc(p.record_date)}</div><p class="note">${esc(p.position_note)}</p>`;
    for(const c of ['sc1','sc2']){
      html+=`<h3>${c==='sc1'?'Size class 1':'Size class 2'} · source categories</h3><dl>${row('Species',p['all_'+c+'_species']||p[c==='sc1'?'all_sc1_species':'all_sc2_species'])}${[1,2,3,4,5].filter(i=>Number(p[`total_count_${c}_species${i}`])>0).map(i=>row('Species '+i+' count',p[`total_count_${c}_species${i}`])).join('')}</dl>`;
    }
    html+=`<p>${esc(p.notes||'No additional notes.')}</p><p class="small muted">Source categories and count order are retained; no individual seedling positions were recorded.</p>`;
  } else {
    const trees=dataset().trees.features.filter(t=>t.properties.plot===p.plot);
    html+=`<div class="subtitle">Plot center · field tag ${esc(p.center_tree_tag)}</div><dl>${row('Plot radius',p.radius_m+' m')}${row('Recorded trees',trees.length)}${row('Reported GPS accuracy',p.gps_accuracy_m+' m')}${row('Ground elevation',p.lidar_ground_elevation_m==null?'See plot center':p.lidar_ground_elevation_m+' m NAVD88')}${row('Aspect',p.aspect_degrees+'°')}${row('Record created',p.record_date)}</dl>`;
    const val=(v,u='')=>v===''||v==null?null:String(v)+u;
    const land={gr:'Grazing',wf:'Wildland fire',hl:'Historical logging',fs:'Fire suppression',rt:'Recent thinning',pf:'Prescribed fire',n:'None'};
    const landUse=p.land_use?p.land_use.split(',').map(v=>land[v]||v).join(', '):null;
    html+=`<h3>Field measurements · ${esc(p.record_date)}</h3><dl>${row('Litter depth',val(p.litter_depth_cm,' cm'))}${row('Rock cover',val(p.prockcov,' %'))}${row('Forb cover',val(p.forb_cover,' %'))}${row('Slope (source value)',p.slope_recorded)}${row('Slope position (code)',p.slope_position)}${row('Land-use history',landUse)}${row('Parent material',p.parent_material)}</dl><p class="small muted">Slope units and slope-position code definitions were not supplied in the source workbook. Land-use history is a field observation, not a complete disturbance record.</p>`;
    html+=`<details><summary>Shrub observations</summary><dl>${[1,2,3,4].map(i=>row('Cover · source slot '+i,val(p['shrub_cover'+i],' %'))).join('')}</dl><p>${esc(p.list_4_dominant_shrub_species?.replaceAll('_',' ').replaceAll(',',', ')||'No species recorded.')}</p>${p.specify_other_shrub_species?`<p>${esc(p.specify_other_shrub_species)}</p>`:''}<p class="small muted">Source slots and species list are retained separately; a species-to-slot match is not assumed.</p></details>`;
    if(soilContext){const key=soilContext.metadata.plot_center_intersections[p.plot];if(key)html+=`<details><summary>Mapped soil properties</summary>${renderSoilDetails(soilContext.metadata.units[key],key,soilContext.properties)}</details>`;}
    if(p.plot_notes)html+=`<p>${esc(p.plot_notes)}</p>`;
    if(p.radius_note)html+=`<p class="note">${esc(p.radius_note)}</p>`;
    html+=`<p class="note">Reported GPS accuracy is a device estimate, not a validated confidence radius.${p.gps_accuracy_m>=50?' This plot has a notably larger reported uncertainty than the others.':''}</p>`;
    const regen=dataset().regeneration.features.find(r=>r.properties.plot===p.plot);
    html+=regen?`<button class="feature-link" data-regen="${esc(p.plot)}">Inspect regeneration record →</button>`:'<p class="small muted">No regeneration record found for this plot.</p>';
    html+=`<details><summary>Trees in this plot (${trees.length})</summary>${trees.sort((a,b)=>Number(a.properties.tree_tag_number)-Number(b.properties.tree_tag_number)).map(t=>`<button class="feature-link" data-tree="${esc(t.properties.id)}">Tag ${esc(t.properties.tree_tag_number)} · ${esc(t.properties.id)} · ${esc(t.properties.species)}${t.properties.in_sampling_plan?' ◇':''}</button>`).join('')}</details>`;
  }
  if(f.geometry.type==='Point')html+=`<details><summary>Coordinates & provenance</summary><dl>${row('Latitude',f.geometry.coordinates[1].toFixed(7))}${row('Longitude',f.geometry.coordinates[0].toFixed(7))}</dl>`;
  html+=`<p class="small muted">Source: ${esc(p.inventory_source||p.source)}${p.kind==='trees'?'<br>Position: SFPUC_tree_plot_map.kml':''}</p>${f.geometry.type==='Point'?'</details>':''}`;
  $('#feature-details').innerHTML=html; $('#inspector').hidden=false; $('#inspector').scrollTop=0;
  $('#feature-details').querySelectorAll('[data-tree]').forEach(b=>b.onclick=()=>goFeature(dataset().trees.features.find(t=>t.properties.id===b.dataset.tree)));
  $('#feature-details').querySelectorAll('[data-regen]').forEach(b=>b.onclick=()=>goFeature(dataset().regeneration.features.find(r=>r.properties.plot===b.dataset.regen)));
}
function addClick(layer,f){layer.on('click',e=>{if(state.measuring)return;L.DomEvent.stopPropagation(e);inspect(f);});return layer;}
function renderFields(){
  field.clearLayers();labels.clearLayers();scene3d?.refresh();
  const d=dataset(), trees=filteredTrees(), plot=$('#plot').value;
  $('#summary').textContent=`${trees.length} of 234 trees · 20 plots · 36 planned study trees`;
  $('#tree-count').textContent=trees.length;
  $('#filter-state').textContent=$('#species').value||$('#status').value||checked('#plan-only')?'Filtered':'';
  updateLayerCount();
  $('#map-subtitle').textContent=`234 tree records · April 2022`;
  if(map.getZoom()<15){contourLabels();return;}
  const plotMatch=()=>true;
  if(checked('#layer-boundaries')) L.geoJSON(d.boundaries,{filter:plotMatch,pane:'plotAreas',interactive:false,style:{color:'#65d9e8',weight:1.3,opacity:.85,fillColor:'#63dbea',fillOpacity:.07}}).addTo(field);
  if(checked('#layer-accuracy')) d.plots.features.filter(plotMatch).forEach(f=>L.circle(ll(f),{radius:f.properties.gps_accuracy_m,color:'#e7ac6a',weight:1.5,dashArray:'5 5',fillOpacity:.04,interactive:false,pane:'plotAreas'}).addTo(field));
  if(checked('#layer-plan')) trees.filter(f=>f.properties.in_sampling_plan).forEach(f=>addClick(L.circleMarker(ll(f),{radius:treeRadius(f.properties)+4,color:'#f5b8ed',weight:2,fill:false,pane:'planPoints'}),f).addTo(field));
  if(checked('#layer-trees')) trees.forEach(f=>{
    const p=f.properties;
    const marker=L.circleMarker(ll(f),{radius:treeRadius(p),color:p.status==='dead'?'#ec884e':'#253b31',weight:p.status==='dead'?2:1,fillColor:colors[p.species]||'#ddd',fillOpacity:.95,pane:'treePoints'}).bindTooltip(treeTooltip(p));
    addClick(marker,f).addTo(field);
    if(checked('#tree-labels')&&map.getZoom()>=20) L.marker(ll(f),{icon:L.divIcon({className:'',html:'',iconSize:[0,0]}),interactive:false,keyboard:false,pane:'pointLabels'}).bindTooltip(`${esc(p.plot)} · ${esc(p.tree_tag_number)}`,{permanent:true,direction:'right',offset:[treeRadius(p)+3,0],className:'tree-label'}).addTo(labels);
  });
  if(checked('#layer-regen')) d.regeneration.features.filter(plotMatch).forEach(f=>addClick(L.circleMarker(ll(f),{radius:10,color:'#e9cc8b',weight:3,fill:false,pane:'plotPoints'}).bindTooltip('Regeneration · '+esc(f.properties.plot)),f).addTo(field));
  if(checked('#layer-plots')) d.plots.features.filter(plotMatch).forEach(f=>{
    const m=L.marker(ll(f),{pane:'plotPoints',title:'Plot center · '+f.properties.plot,icon:L.divIcon({className:'plot-cross',iconSize:[20,20],iconAnchor:[10,10],html:'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v14M3 10h14" stroke="#11262d" stroke-width="5"/><path d="M10 3v14M3 10h14" stroke="white" stroke-width="2.5"/></svg>'})});
    m.bindTooltip(esc(f.properties.plot),{permanent:true,direction:'top',offset:[0,-9],className:'plot-label'});
    addClick(m,f).addTo(field);
  });
  contourLabels();
}
function renderTerrain(){
  if(hillshade)map.removeLayer(hillshade);
  if(state.terrain){hillshade=L.layerGroup(manifest.sites.map(s=>L.imageOverlay(`data/${s.id}/hillshade.webp`,s.terrain.image_bounds,{opacity:Number($('#opacity').value)/100,pane:'terrain',attribution:'Terrain: USGS 3DEP · 1 m'}))).addTo(map);}
  $('#terrain-on').classList.toggle('selected',state.terrain);$('#terrain-off').classList.toggle('selected',!state.terrain);
  $('#terrain-on').setAttribute('aria-pressed',String(state.terrain));$('#terrain-off').setAttribute('aria-pressed',String(!state.terrain));
  $('#layer-terrain').checked=state.terrain;
  $('#map-legend').textContent=state.terrain?'1 m LiDAR · USGS 3DEP':'Basemap · '+$('#basemap').selectedOptions[0].textContent;
  $('#opacity').disabled=!state.terrain;
  $('#opacity-small').disabled=!state.terrain;
}
function renderContours(){
  contours.clearLayers();
  const interval=Number($('#contours').value);
  $('#layer-contours').checked=Boolean(interval);
  if(interval)L.geoJSON(dataset().contours,{filter:f=>interval===2||f.properties.index,interactive:false,pane:'contours',style:f=>({color:state.terrain?'#3f5146':'#f3e8c0',weight:f.properties.index?1:.55,opacity:f.properties.index?.6:.35})}).addTo(contours);
  contourLabels();
}
function contourLabels(){
  state.contourMarkers.forEach(m=>map.removeLayer(m)); state.contourMarkers=[];
  if(!state.site||!Number($('#contours').value)||map.getZoom()<16)return;
  const bounds=map.getBounds(),size=map.getSize(),used=[];
  dataset().plots.features.forEach(f=>{const p=map.latLngToContainerPoint(ll(f));used.push([p.x,p.y-20]);});
  for(const f of dataset().contours.features){
    if(!f.properties.index)continue;
    const cs=f.geometry.coordinates;
    for(let i=Math.floor(cs.length/3);i<cs.length;i+=Math.max(6,Math.floor(cs.length/4))){
      const point=L.latLng(cs[i][1],cs[i][0]);if(!bounds.contains(point))continue;
      const p=map.latLngToContainerPoint(point);
      if(p.x<30||p.y<100||p.x>size.x-60||p.y>size.y-70||used.some(([x,y])=>Math.abs(p.x-x)<105&&Math.abs(p.y-y)<65))continue;
      used.push([p.x,p.y]);state.contourMarkers.push(L.marker(point,{icon:L.divIcon({className:'contour-label',html:`${f.properties.elevation_m} m`,iconSize:[42,16],iconAnchor:[21,8]}),interactive:false,keyboard:false,pane:'contourLabels'}).addTo(map));break;
    }
  }
}
function updateLayerCount(){$('#extra-layer-state').textContent=['layer-boundaries','layer-plan','layer-regen','layer-accuracy','tree-labels','layer-coverage'].filter(id=>checked('#'+id)).length+' on';}
function renderCoverage(){updateLayerCount();scene3d?.refresh();coverage.clearLayers();if(checked('#layer-coverage'))manifest.sites.forEach(s=>L.rectangle(s.terrain.image_bounds,{color:'#e0eee3',weight:1.5,dashArray:'6 5',fill:false,interactive:false}).addTo(coverage));}
function setBasemap(){
  if(!state.terrain)$('#map-legend').textContent='Basemap · '+$('#basemap').selectedOptions[0].textContent;
  if(base)map.removeLayer(base);
  const config={satellite:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}','Imagery © Esri, Maxar, Earthstar Geographics & contributors',19],topo:['https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}','<a href="https://www.usgs.gov/programs/national-geospatial-program/national-map">USGS The National Map</a>',16],streets:['https://tile.openstreetmap.org/{z}/{x}/{y}.png','© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',19]}[$('#basemap').value];
  base=L.tileLayer(config[0],{maxNativeZoom:config[2],maxZoom:23,attribution:config[1]}).addTo(map);
  let errors=0;base.on('tileerror',()=>{if(++errors===3&&!state.measuring)notice('Some basemap tiles could not load. Try another basemap; local field layers remain available.');});
}
function setSite(id){
  if(!manifest.sites.some(s=>s.id===id))id='sheep-camp';
  state.site=id;closeInspector();closeLayers();map.closePopup();$('#plot').value='';
  $('#map-title').textContent=current().name;
  $('#site-code').textContent=current().code+' · North';
  fitSite();history.replaceState(null,'','#'+id);
}
function initInventory(){
  $('#plot').innerHTML='<option value="">Choose a plot…</option>'+dataset().plots.features.map(f=>`<option value="${esc(f.properties.plot)}">${esc(f.properties.plot)}</option>`).join('');
  $('#species').innerHTML='<option value="">All species</option>'+[...new Set(dataset().trees.features.map(f=>f.properties.species))].sort().map(s=>`<option>${esc(s)}</option>`).join('');
  $('#regen-count').textContent=dataset().regeneration.features.length;
  $('#position-note').textContent='Plot GPS reports 5–10 m accuracy, except SCN.3: 50 m. Tree bearing and distance add unquantified error.';
  $('#download-all').onclick=e=>{e.preventDefault();exportTrees(true);};
  $('#map-key').open=!window.matchMedia('(max-width:760px)').matches;
  $('#dbh-key').innerHTML=[10,50,100].map(dbh=>`<span><i style="width:${2*treeRadius({dbh_cm:dbh})}px;height:${2*treeRadius({dbh_cm:dbh})}px"></i>${dbh} cm</span>`).join('');
  function updateContourKey(){const three=document.body.classList.contains('scene-active'),interval=three?($('#contours-3d').checked?'2':'0'):$('#contours').value;$('#key-contour-interval').textContent=interval==='0'?'· off':`· ${interval} m`;$('#map-key').classList.toggle('key-light-contours',three||!state.terrain);}
  ['#contours','#layer-contours','#layer-terrain','#contours-3d'].forEach(id=>$(id).addEventListener('change',()=>queueMicrotask(updateContourKey)));
  ['#terrain-on','#terrain-off'].forEach(id=>$(id).addEventListener('click',()=>queueMicrotask(updateContourKey)));
  new MutationObserver(updateContourKey).observe(document.body,{attributes:true,attributeFilter:['class']});updateContourKey();
  $('#species-legend').innerHTML=Object.entries(colors).map(([n,c])=>`<span><i class="dot" style="--c:${c}"></i>${esc(n)}</span>`).join('');
}
function doSearch(){
  const q=$('#search').value.trim().toLowerCase();const out=$('#search-results');out.innerHTML='';if(!q)return;
  const fs=[...dataset().plots.features,...dataset().trees.features].filter(f=>{const p=f.properties;return [p.id,p.plot,p.species,p.tree_tag_number,p.center_tree_tag,`${p.plot}.${p.tree_tag_number}`].some(s=>String(s??'').toLowerCase().includes(q));});
  const message=document.createElement('p');message.textContent=fs.length?`${fs.length} matches${fs.length>25?' · showing first 25':''}`:'No matches at either site.';out.append(message);
  fs.slice(0,25).forEach(f=>{const p=f.properties,b=document.createElement('button');b.innerHTML=`${esc(p.id)}${p.kind==='trees'?` · tag ${esc(p.tree_tag_number)}`:''}<small>${esc(p.species||'Plot center')} · ${esc(p.plot)}</small>`;b.onclick=()=>goFeature(f);out.append(b);});
}
function exportTrees(all=false){
  const rows=all===true?dataset().trees.features:filteredTrees();const fields=['id','site','plot','tree_tag_number','species','status','dbh_cm','record_date','crown_condition_rating','azimuth_degrees','distance_from_center_m','gps_accuracy_m','lidar_ground_elevation_m','in_sampling_plan','longitude','latitude'];
  const quote=s=>'"'+String(s??'').replaceAll('"','""')+'"';
  const csv=[fields.join(','),...rows.map(f=>{const p={...f.properties,longitude:f.geometry.coordinates[0],latitude:f.geometry.coordinates[1]};return fields.map(k=>quote(p[k])).join(',');})].join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`sfpuc-${all===true?'all':'filtered'}-trees.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice(`Exported ${rows.length} tree records across both sites${all===true?'':', using the current species, status, and sampling-plan filters'}.`);
}
function sourcesHTML(){return `
  <p>Two northern oak-woodland sites from the SFPUC drought study: Sheep Camp (SCN) and Maguire Ridge (MN). The original report uses the spelling <em>Maguire</em>. Other study sites are excluded.</p>
  <table><thead><tr><th>Site</th><th>Plots</th><th>Trees</th><th>Sampling plan</th></tr></thead><tbody>${manifest.sites.map(s=>`<tr><td>${s.name}</td><td>10</td><td>${s.counts.trees}</td><td>18</td></tr>`).join('')}</tbody></table>
  <h3>Inventory and positions</h3><p>The April 2022 tree records come from <code>tree_data_drought_study.xls</code>, with plot metadata from <code>plot_data_drought_study.xls</code>. Locations are retained from <code>SFPUC_tree_plot_map.kml</code>. Each tree's plot, tag, species, DBH, status, azimuth, and distance were checked against the original table. A separate WGS84 geodesic calculation agrees with mapped positions within 0.038 m; this verifies the calculation, not the field accuracy.</p>
  <p class="note">Tree locations inherit plot GPS error. Device-reported horizontal accuracy is 5–10 m for 19 plots and 50 m for SCN.3. The optional circles show those reported distances; they are not statistical confidence intervals. Azimuth north reference and slope-distance correction are not documented. Trees have not been snapped to aerial crowns or LiDAR features.</p>
  <p>The report describes 500 m² plots with a nominal 12.6 m radius. Four records lie just beyond that radius (12.7–13.6 m); their measured distances are retained. Circles represent sampling geometry, not property boundaries. Symbols are enlarged for visibility and scaled by DBH, not crown diameter. Multiple stem records are retained independently. Status is historical and does not establish whether a tree is alive or standing today.</p>
  <p><a href="https://tahoe.ucdavis.edu/sites/g/files/dgvnsk4286/files/inline-files/SFPUC_DROUGHT_FINAL_REPORT_2022.pdf" target="_blank" rel="noopener">SFPUC 2022 drought report ↗</a></p>
  <h3>Sampling plan and regeneration</h3><p>The 36 highlighted records are joined by Tree ID to <code>SFPUC_Tree_Sampling_Measurement_Plan.xlsx / Tree measurements</code>: 18 at each site. Click a tree to read its proposed measurement schedule. These are planning attributes, not evidence of completed sampling or sensor installation. No surveyed sensor locations were found in the supplied folder.</p><p>Regeneration records are summarized at their plot centers; individual seedlings were not mapped. Records are available for all 10 MN plots and 9 SCN plots. SCN.10 has no regeneration record in the workbook. Original size-class codes, species lists, and counts are retained without inferring individual locations.</p>
  <h3>LiDAR terrain</h3><p>Hillshade and contours use public-domain USGS 3DEP 1 m bare-earth DEM tiles from <code>CA_AlamedaCounty_2021_B21</code>, downloaded 14 October 2026. Both site cutouts have complete raster coverage. Horizontal coordinates are NAD83 / UTM zone 10N (EPSG:26910); elevations are meters above NAVD88. The project incorporates Alameda County collections from 2019–2021; exact acquisition dates at these two cutouts have not been established.</p><p>Contours are generated every 2 m after Gaussian smoothing with a 1 m standard deviation and simplified with 0.4 m tolerance. Labels mark 10 m index contours. The display hillshade is reprojected to Web Mercator. Downloadable GeoTIFFs retain the original 1 m grid. The rectangular LiDAR edges are processing cutouts, not study boundaries. Ground elevations attached to tree records sample this DEM at the mapped position; they are not independently surveyed tree elevations.</p>
  <p><a href="https://www.fisheries.noaa.gov/inport/item/71712" target="_blank" rel="noopener">Alameda County acquisition metadata ↗</a></p>
  ${manifest.sites.map(s=>`<h3>${s.name} downloads</h3><p><a href="data/${s.id}/trees.csv" download>All trees · CSV</a> · <a href="data/${s.id}/trees.geojson" download>Trees · GeoJSON</a> · <a href="data/${s.id}/plots.geojson" download>Plot centers</a> · <a href="data/${s.id}/boundaries.geojson" download>Plot circles</a> · <a href="data/${s.id}/regeneration.geojson" download>Regeneration</a> · <a href="data/${s.id}/contours.geojson" download>2 m contours</a> · <a href="data/${s.id}/terrain.tif" download>1 m DEM · GeoTIFF</a></p><ul>${s.terrain.sources.map(i=>`<li><a href="${esc(i.metaUrl)}" target="_blank" rel="noopener">${esc(i.title)}</a></li>`).join('')}</ul>`).join('')}
  <h3>3D LiDAR point clouds</h3><p>The 3D view uses actual USGS Alameda County returns from the public Entwine collections <code>CA_AlamedaCo_3_2021</code> (Sheep Camp) and <code>CA_AlamedaCo_1_2021</code> (Maguire Ridge). Heights are in meters NAVD88. Terrain and points have no vertical exaggeration. Above-ground returns use the same 0–65 m height color scale as Rivendell. Unclassified returns can include shrubs and structures; they are not individual identified trees. Inventory markers retain species colors and the original GPS uncertainty.</p><p>The browser display uses a spatially thinned subset of measured returns. Height above ground is calculated from the local 1 m DEM. Ground, noise, water, bridge and withheld returns are excluded from the canopy layer. See each site's <a href="data/sheep-camp/3d/scene.json">Sheep Camp metadata</a> or <a href="data/maguire-ridge/3d/scene.json">Maguire Ridge metadata</a> for counts, source URLs, thinning, and ground-elevation checks. The two terrain patches share one coordinate system; the intervening area has no local terrain data.</p>
  <h3>Geology</h3><p>The optional geology overlay uses Graymer, Jones and Brabb's <a href="https://pubs.usgs.gov/of/1996/of96-252/" target="_blank" rel="noopener">USGS Open-File Report 96-252 (1996)</a>, from the <a href="https://ngmdb.usgs.gov/Prodesc/proddesc_22969.htm" target="_blank" rel="noopener">NGMDB shapefile conversion</a>. The source database's effective detail is approximately 1:50,000. It provides regional rock-unit context, not surveyed contacts at individual trees. Most young surface deposits are grouped into Qu, and most landslides are omitted. Dashed contacts and faults retain the source's approximate, inferred or concealed classifications. No present fault activity is inferred.</p><p>The original projection is UTM zone 10 in meters. Because the shapefiles omit a coordinate-reference definition, NAD27 was identified by checking original 7.5-minute grid controls: residuals are below 1 m in NAD27 versus about 205 m in NAD83. Coordinates were transformed to WGS84, then clipped around both sites without snapping or simplifying. Colors are selected for this atlas; descriptions summarize the source and preserve broad age ranges where assemblages differ.</p><p>Mapped units do not measure soil depth, weathered-bedrock thickness or water-storage capacity. <a href="data/geology/units.geojson" download>Download units</a> · <a href="data/geology/lines.geojson" download>Contacts and faults</a> · <a href="data/geology/metadata.json">Source and coordinate checks</a> · <a href="https://pubs.usgs.gov/of/1996/of96-252/algeo.pdf" target="_blank" rel="noopener">Full geologic descriptions</a>.</p>
  <h3>Soil map units and properties</h3><p>The optional soil layer uses USDA NRCS SSURGO map-unit polygons and names from <a href="https://sdmdataaccess.sc.egov.usda.gov/" target="_blank" rel="noopener">Soil Data Access</a>, retrieved 14 October 2026. The WGS84 polygons are clipped around both sites without simplifying or shifting boundaries. Map units may contain multiple soil components and local inclusions; names and slope ranges describe mapped units, not measured soil properties at each plot. <a href="data/soils/units.geojson" download>Download soil units</a> · <a href="data/soils/metadata.json">Source, query and provenance</a>.</p><p>Properties are joined from SSURGO component and horizon tables using map-unit keys. AWC, clay and organic matter are horizon-thickness averages within each component, then weighted by representative component percentages. Missing components are excluded; the represented percentage appears beside each derived mean. Available water storage is the NRCS map-unit weighted summary, converted from cm of water to mm. It does not include weathered-bedrock storage.</p><p>Depth to first restriction averages only components with a reported restriction. It is not a whole-unit soil-thickness estimate. Described profile depth is database coverage and may include rock horizons. No reported restriction does not establish unlimited depth. <a href="data/soils/properties.json">Values, components, queries and averaging methods</a>.</p><p>In 3D, geology and soil colors are rasterized from these vectors onto the existing 2 m terrain mesh. This is a display texture, not a new soil-property raster or a subsurface model. Picking uses the nearest 2 m terrain cell; mapping precision remains that of the original sources. The same layer switches and opacity controls work in both views. When both layers are on, ground clicks identify soils; turn soils off to inspect geology.</p>
  <h3>Plot measurements</h3><p>Plot details retain litter depth, rock and forb cover, shrub-cover slots, recorded species, land-use history, slope and slope-position codes from the 2022 plot workbook. Missing values remain missing. Slope units and slope-position code definitions are not documented in that workbook. The 2022 report defines land-use codes. Shrub cover slots are not assigned to species without a documented correspondence.</p>
  <h3>Imagery and basemaps</h3><p>Imagery is the Esri World Imagery mosaic, with credits shown on the map; acquisition date and resolution vary by location and zoom and have not been independently established here. USGS Topo and OpenStreetMap provide alternative context. Basemaps require an internet connection. At tree scale, some basemap pixels are enlarged beyond native resolution. Use the LiDAR opacity slider to compare imagery and ground form.</p>
  <h3>Data and reproducibility</h3><p>Export trees downloads records from both sites using the species, recorded-status, and sampling-plan filters. It is independent of map extent and display-layer switches. The full site CSVs are always available separately. Search includes all records at both sites, including those hidden by filters.</p><p><a href="data/manifest.json">Source filenames, hashes & layer catalog</a> · <a href="data/qa.json">Inventory checks</a>. Map compiled 14 October 2026. Raw collector accounts and device identifiers are omitted from the public layers.</p>`;}
async function boot(){
  manifest=await getJSON('data/manifest.json');
  await Promise.all(manifest.sites.map(async s=>{const names=['trees','plots','boundaries','regeneration','contours'];const ds=await Promise.all(names.map(n=>getJSON(`data/${s.id}/${n}.geojson?v=20261014-polish`)));state.data[s.id]=Object.fromEntries(names.map((n,i)=>[n,ds[i]]));}));
  state.combined=Object.fromEntries(['trees','plots','boundaries','regeneration','contours'].map(n=>[n,{type:'FeatureCollection',features:manifest.sites.flatMap(s=>state.data[s.id][n].features)}]));
  map=L.map('map',{zoomControl:false,maxZoom:23,preferCanvas:true});
  for(const [name,z] of Object.entries({terrain:250,contours:320,plotAreas:350,contourLabels:370,planPoints:410,treePoints:420,plotPoints:430,pointLabels:640,selection:650})){map.createPane(name).style.zIndex=z;if(['terrain','contours','plotAreas','contourLabels','pointLabels','selection'].includes(name))map.getPane(name).style.pointerEvents='none';}
  field=L.layerGroup().addTo(map);coverage=L.layerGroup().addTo(map);contours=L.layerGroup().addTo(map);labels=L.layerGroup().addTo(map);measurement=L.layerGroup().addTo(map);selected=L.layerGroup().addTo(map);locations=L.layerGroup().addTo(map);
  L.control.zoom({position:'topright'}).addTo(map);L.control.scale({imperial:false,position:'bottomleft'}).addTo(map);
  manifest.sites.forEach(s=>{const center=L.latLngBounds(s.bounds).getCenter();L.circleMarker(center,{radius:7,color:'#e6f3dc',fillColor:'#284c4e',fillOpacity:1,weight:2}).bindTooltip(s.name,{permanent:true,direction:'right'}).on('click',()=>{setSite(s.id);fitSite();}).addTo(locations);});
  initInventory();setBasemap();setSite(location.hash.slice(1));renderTerrain();renderContours();renderFields();renderCoverage();
  map.on('zoomend',()=>{if(!state.site)return;renderFields();if(map.getZoom()<15){if(!map.hasLayer(locations))locations.addTo(map);}else map.removeLayer(locations);});
  map.removeLayer(locations);
  map.on('moveend',()=>{contourLabels();if(!state.measuring){const outside=!manifest.sites.some(s=>L.latLngBounds(s.terrain.image_bounds).contains(map.getCenter()));if(outside)notice('Outside the local LiDAR cutout. Basemap context continues; select All plots to return.');else if($('#notice').textContent.startsWith('Outside'))notice('');}});
  map.on('mousemove',e=>{$('#coordinates').textContent=`${e.latlng.lat.toFixed(5)}° N · ${Math.abs(e.latlng.lng).toFixed(5)}° W`;});
  map.on('click',e=>{if(!state.measuring)return;state.measurePoints.push(e.latlng);L.circleMarker(e.latlng,{radius:4,color:'#fff',fillColor:'#183c43',fillOpacity:1,interactive:false}).addTo(measurement);if(state.measurePoints.length>1)L.polyline(state.measurePoints,{color:'#fff',weight:2,dashArray:'5 5',interactive:false}).addTo(measurement);const distance=state.measurePoints.slice(1).reduce((a,p,i)=>a+map.distance(state.measurePoints[i],p),0);notice(`${distance.toFixed(1)} m horizontal distance · ${state.measurePoints.length} points. Click Measure to clear.`);});
  document.querySelectorAll('[data-site]').forEach(b=>b.onclick=()=>setSite(b.dataset.site));
  window.addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(id!==state.site)setSite(id);});
  $('#mobile-layers').onclick=()=>{$('#mobile-layers').setAttribute('aria-expanded',String(document.body.classList.toggle('layers-open')));map.invalidateSize();};
  $('#fit-site').onclick=()=>{$('#plot').value='';renderFields();fitSite();closeLayers();};
  $('#landscape').onclick=()=>{scene3d?.focus(state.site,true);map.fitBounds(current().terrain.image_bounds,{padding:[35,80]});closeLayers();};
  $('#both-sites').onclick=()=>{scene3d?.focus('both');map.fitBounds(manifest.sites.map(s=>L.latLngBounds(s.bounds).getCenter()),{padding:[75,100]});closeLayers();};
  $('#plot').onchange=()=>{closeInspector();renderFields();if($('#plot').value){const f=dataset().plots.features.find(p=>p.properties.plot===$('#plot').value);map.setView(ll(f),20);scene3d?.focusFeature(f);inspect(f);}else fitSite();closeLayers();};
  ['#species','#status','#plan-only'].forEach(s=>$(s).onchange=()=>{closeInspector();renderFields();});
  $('#reset-filters').onclick=()=>{$('#species').value='';$('#status').value='';$('#plot').value='';$('#plan-only').checked=false;closeInspector();renderFields();fitSite();};
  ['#layer-trees','#layer-plots','#layer-boundaries','#layer-plan','#layer-regen','#layer-accuracy','#tree-labels'].forEach(s=>$(s).onchange=()=>{closeInspector();renderFields();});
  $('#tree-labels').addEventListener('change',()=>{notice(checked('#tree-labels')&&map.getZoom()<20?'Tree tags appear at close zoom. Select a plot to see them.':'');});
  $('#layer-coverage').onchange=renderCoverage;
  $('#layer-terrain').onchange=()=>{state.terrain=checked('#layer-terrain');renderTerrain();renderContours();};
  $('#layer-contours').onchange=()=>{$('#contours').value=checked('#layer-contours')?'2':'0';renderContours();};
  $('#hide-overlays').onclick=()=>{
    document.querySelectorAll('.primary-layers input[type=checkbox],.disclosure input[id^=layer-],#tree-labels').forEach(el=>{if(el.checked){el.checked=false;el.dispatchEvent(new Event('change'));}});
    if(state.measuring)$('#measure').click();
    if(scene3d&&document.body.classList.contains('scene-active')){for(const id of ['cloud-3d','contours-3d']){const el=$('#'+id);if(el.checked){el.checked=false;el.dispatchEvent(new Event('change'));}}}
    map.closePopup();closeInspector();
  };
  $('#terrain-on').onclick=()=>{state.terrain=true;renderTerrain();renderContours();};$('#terrain-off').onclick=()=>{state.terrain=false;renderTerrain();renderContours();};
  $('#opacity').oninput=()=>{$('#opacity-small').value=$('#opacity').value;if(hillshade)hillshade.eachLayer(l=>l.setOpacity(Number($('#opacity').value)/100));};
  $('#opacity-small').oninput=()=>{$('#opacity').value=$('#opacity-small').value;if(hillshade)hillshade.eachLayer(l=>l.setOpacity(Number($('#opacity').value)/100));};
  $('#basemap').onchange=()=>{notice('');setBasemap();};$('#contours').onchange=renderContours;
  $('#search').oninput=doSearch;$('#clear-search').onclick=()=>{$('#search').value='';doSearch();$('#search').focus();};
  $('#close-inspector').onclick=closeInspector;$('#export').onclick=()=>exportTrees();
  $('#measure').onclick=()=>{state.measuring=!state.measuring;state.measurePoints=[];measurement.clearLayers();closeInspector();$('#measure').classList.toggle('selected',state.measuring);$('#measure').setAttribute('aria-pressed',String(state.measuring));map.doubleClickZoom[state.measuring?'disable':'enable']();notice(state.measuring?'Click points on the map to measure horizontal distance. Click Measure again to clear.':'');};
  $('#methods-content').innerHTML=sourcesHTML();$('#sources').onclick=()=>$('#methods').showModal();$('#close-sources').onclick=()=>$('#methods').close();
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#map-key').open=false;closeLayers();closeInspector();map.closePopup();if(state.measuring)$('#measure').click();}});
  window.addEventListener('resize',()=>map.invalidateSize());
  $('#view-3d').onclick=async()=>{
    closeLayers();closeInspector();map.closePopup();
    const button=$('#view-3d');button.disabled=true;button.textContent='Opening 3D…';
    try{
      if(!scene3d){const {createScene}=await import('./scene3d.js?v=20261014-south');scene3d=await createScene({showContext:(title,html)=>{closeLayers();map.closePopup();selected.clearLayers();$('#inspector .inspector-header span').textContent=title;$('#feature-details').innerHTML=html;$('#inspector').hidden=false;$('#inspector').scrollTop=0;},manifest,data:dataset(),filteredTrees,treeRadius,colors,inspect,currentSite:()=>state.site});}
      scene3d.open();
    }catch(e){console.error(e);notice('3D could not load. The 2D map remains available; try 3D again.');}
    finally{button.disabled=false;button.textContent='3D view';}
  };
  import('./geology.js?v=20261014-context3d').then(({setupGeology})=>setupGeology({map,notice,closeInspector,isMeasuring:()=>state.measuring})).catch(e=>{console.error(e);$('#geology-status').hidden=false;$('#geology-status').textContent='Geology controls could not load. Reload to retry.';});
  import('./soils.js?v=20261014-context3d').then(({setupSoils})=>setupSoils({map,notice,closeInspector,isMeasuring:()=>state.measuring})).catch(e=>{console.error(e);$('#soils-status').hidden=false;$('#soils-status').textContent='Soil controls could not load. Reload to retry.';});
  try{const [m,p,view]=await Promise.all([getJSON('data/soils/metadata.json'),getJSON('data/soils/properties.json?v=20261014-context3d'),import('./soil-details.js?v=20261014-context3d')]);soilContext={metadata:m,properties:p};renderSoilDetails=view.soilDetails;}catch(e){console.error('Soil property details unavailable',e);}
  $('#loading').hidden=true;
}
boot().catch(e=>{console.error(e);$('#loading').innerHTML='The field atlas could not load. Reload to retry.<p>Inventory downloads: <a href="data/sheep-camp/trees.csv">Sheep Camp CSV</a> · <a href="data/maguire-ridge/trees.csv">Maguire Ridge CSV</a>.</p>';});
