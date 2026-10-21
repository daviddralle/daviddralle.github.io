import {geometryError,sessionError,toKML} from './draw-export.mjs?v=20261021';

export function setupDrawing({map,begin,currentSite,isMeasuring}) {
  const $=id=>document.getElementById(id), key='sfpuc-drawing-session-v1';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const names={polyline:'Polyline',polygon:'Shape',marker:'Point',rectangle:'Rectangle'};
  const group=L.featureGroup().addTo(map), layers=new Map(), history=[];
  const pane=map.createPane('drawings');pane.style.zIndex=660;
  const renderer=L.svg({pane:'drawings'}), style={color:'#63dbea',weight:3,fillOpacity:.18,renderer,pane:'drawings'};
  const icon=L.divIcon({className:'draw-point',html:'<span></span>',iconSize:[22,22],iconAnchor:[11,11]});
  let features=[], selected=null, handler=null, mode='', beforeEdit=null, visible=true, exporting=false;
  let name='Field drawings · '+new Date().toLocaleDateString('en-CA');
  const panel=$('drawing-panel'), menu=$('draw-menu'), form=$('drawing-attributes');
  const status=(text,error=false)=>{$('drawing-status').textContent=text;$('drawing-status').classList.toggle('draw-error',error);};
  const current=()=>features.find(f=>f.properties.uid===selected);
  const busy=()=>Boolean(mode);
  function remember(){history.push(clone(features));if(history.length>30)history.shift();}
  function persist(){
    try{localStorage.setItem(key,JSON.stringify({version:1,name,features}));$('drawing-storage').textContent='Saved in this browser. Not shared with other users.';}
    catch{$('drawing-storage').textContent='Browser storage unavailable. Export KMZ before leaving this page.';}
  }
  function syncMode(){
    document.body.classList.toggle('drawing-busy',busy());panel.dataset.mode=mode;
    $('draw-finish').hidden=mode!=='polyline'&&mode!=='polygon';
    $('draw-back').hidden=$('draw-finish').hidden;
    $('draw-save-geometry').hidden=mode!=='edit';
    $('draw-cancel').hidden=!busy();
    $('draw-session-body').hidden=busy();
    $('draw-export').disabled=busy()||!features.length||exporting;
    menu.classList.toggle('drawing-selected',busy());
  }
  function show(){panel.scrollTop=0;panel.hidden=false;menu.open=false;$('draw-menu-toggle').setAttribute('aria-expanded','false');}
  function decorate(f,layer){
    const text=document.createElement('span');text.textContent=f.properties.id;
    layer.bindTooltip(text,{direction:'top',className:'drawing-label'});
    layer.off('click');layer.on('click',e=>{if(busy())return;if(isMeasuring()){map.fire('click',{latlng:e.latlng});return;}L.DomEvent.stopPropagation(e);choose(f.properties.uid);});
    if(layer.setStyle)layer.setStyle({...style,weight:f.properties.uid===selected?5:3});
    layer.options.bubblingMouseEvents=false;layer.getElement?.()?.setAttribute('aria-label',f.properties.id);layer.getElement?.()?.setAttribute('title',f.properties.id);
  }
  function rebuild(){
    group.clearLayers();layers.clear();
    for(const f of features){
      const g=f.geometry,latlngs=g.type==='Point'?[g.coordinates[1],g.coordinates[0]]:(g.type==='Polygon'?g.coordinates[0]:g.coordinates).map(p=>[p[1],p[0]]);
      const layer=g.type==='Point'?L.marker(latlngs,{icon,keyboard:true,title:f.properties.id}):f.properties.draw_type==='rectangle'?L.rectangle(L.latLngBounds(latlngs),style):g.type==='Polygon'?L.polygon(latlngs,style):L.polyline(latlngs,style);
      decorate(f,layer);group.addLayer(layer);layers.set(f.properties.uid,layer);
    }
    if(visible&&!map.hasLayer(group))group.addTo(map);if(!visible)map.removeLayer(group);
    renderList();
  }
  function renderList(){
    $('draw-count').textContent=String(features.length);
    $('draw-session-count').textContent=`${features.length} ${features.length===1?'feature':'features'}`;
    $('draw-empty').hidden=features.length>0;
    $('draw-undo').disabled=!history.length;
    $('draw-clear').disabled=!features.length;
    $('draw-fit').disabled=!features.length;
    const list=$('draw-feature-list');list.replaceChildren();
    for(const f of features){
      const button=document.createElement('button');button.type='button';button.className='draw-feature';button.setAttribute('aria-pressed',String(f.properties.uid===selected));
      const title=document.createElement('strong');title.textContent=f.properties.id;
      const detail=document.createElement('small');detail.textContent=`${names[f.properties.draw_type]} · ${f.properties.site==='maguire-ridge'?'Maguire Ridge':'Sheep Camp'}`;
      button.append(title,detail);button.onclick=()=>choose(f.properties.uid,true);list.append(button);
    }
    form.hidden=!current();syncMode();
  }
  function fillForm(){const f=current();form.hidden=!f;if(!f)return;$('draw-id').value=f.properties.id;$('draw-description').value=f.properties.description;$('draw-feature-type').textContent=names[f.properties.draw_type];$('draw-attribute-error').textContent='';}
  function commitAttributes(){
    const f=current();if(!f)return true;
    const id=$('draw-id').value.trim(),description=$('draw-description').value;
    let error=!id?'Enter a feature ID.':features.some(x=>x!==f&&x.properties.id.toLocaleLowerCase()===id.toLocaleLowerCase())?'That ID is already in this session. Choose a unique ID.':'';
    $('draw-attribute-error').textContent=error;$('draw-id').setAttribute('aria-invalid',String(Boolean(error)));
    if(error){$('draw-id').focus();return false;}
    if(id!==f.properties.id||description!==f.properties.description){remember();Object.assign(f.properties,{id,description,updated:new Date().toISOString()});decorate(f,layers.get(f.properties.uid));persist();renderList();}
    return true;
  }
  function choose(uid,zoom=false){
    if(busy()||!commitAttributes())return;
    begin();selected=uid;show();rebuild();fillForm();status('Edit attributes below, or choose Edit geometry.');
    if(zoom){const l=layers.get(uid);l.getBounds?map.fitBounds(l.getBounds(),{maxZoom:20,padding:[65,100]}):map.panTo(l.getLatLng());}
  }
  function cancel(){
    const oldMode=mode;mode='';
    if(handler){handler.disable();handler=null;}
    if(oldMode==='edit'){layers.get(selected)?.editing?.disable();features=beforeEdit;beforeEdit=null;rebuild();fillForm();}
    syncMode();if(oldMode)status('Cancelled. Saved drawings are unchanged.');
  }
  function start(type){
    if(!commitAttributes())return;cancel();begin();visible=true;$('draw-visible').checked=true;group.addTo(map);show();selected=null;fillForm();mode=type;syncMode();
    const options={shapeOptions:style,metric:true,feet:false,showLength:false,showArea:false,repeatMode:false,allowIntersection:false,icon};
    const Class={polyline:L.Draw.Polyline,polygon:L.Draw.Polygon,marker:L.Draw.Marker,rectangle:L.Draw.Rectangle}[type];
    handler=new Class(map,options);handler.enable();
    status(type==='marker'?'Click the map to place a point.':type==='rectangle'?'Drag between opposite corners to draw a rectangle.':`Click to add ${type==='polygon'?'corners':'vertices'}. Choose Finish when ready; Back removes the last vertex.`);
  }
  map.on(L.Draw.Event.CREATED,e=>{
    const geometry=e.layer.toGeoJSON().geometry,error=geometryError(geometry),type=e.layerType;
    if(error){status(error+' Start the shape again.',true);return;}
    remember();let n=1;while(features.some(f=>f.properties.id.toUpperCase()===`DRAW-${String(n).padStart(3,'0')}`))n++;
    const now=new Date().toISOString(),uid=crypto.randomUUID();
    features.push({type:'Feature',properties:{uid,id:`DRAW-${String(n).padStart(3,'0')}`,description:'',draw_type:type,site:currentSite(),created:now,updated:now},geometry});
    selected=uid;mode='';panel.scrollTop=0;persist();rebuild();fillForm();status('Feature added. Set its ID and description below.');
    // The plugin finishes disabling its handler after firing CREATED.
    queueMicrotask(()=>{handler=null;syncMode();$('draw-id').focus();$('draw-id').select();});
  });
  map.on(L.Draw.Event.DRAWSTOP,()=>{if(mode&&mode!=='edit'){mode='';syncMode();}});
  $('draw-finish').onclick=()=>{handler?.completeShape();if(busy())status(mode==='polygon'?'Add at least three corners, then Finish.':'Add at least two vertices, then Finish.',true);};
  $('draw-back').onclick=()=>handler?.deleteLastVertex();
  $('draw-cancel').onclick=cancel;
  $('draw-edit-geometry').onclick=()=>{
    if(!commitAttributes())return;begin();beforeEdit=clone(features);visible=true;$('draw-visible').checked=true;group.addTo(map);mode='edit';
    const layer=layers.get(selected);layer.options.editing={...style};layer.options.original={...layer.options};layer.options.poly={allowIntersection:false};layer.editing.enable();syncMode();
    status(current().geometry.type==='Point'?'Drag the point, then Save geometry.':current().properties.draw_type==='rectangle'?'Drag a corner to resize, or the center handle to move the rectangle. Then Save geometry.':'Drag vertices or the midpoint handles to reshape. Click a vertex to remove it. Save geometry when finished.');
  };
  $('draw-save-geometry').onclick=()=>{
    const layer=layers.get(selected),geometry=layer.toGeoJSON().geometry,error=geometryError(geometry);if(error){status(error,true);return;}
    history.push(beforeEdit);if(history.length>30)history.shift();beforeEdit=null;
    layer.editing.disable();Object.assign(current(),{geometry});current().properties.updated=new Date().toISOString();mode='';persist();rebuild();fillForm();status('Geometry saved.');
  };
  form.onsubmit=e=>{e.preventDefault();if(commitAttributes())status('Attributes saved.');};
  $('draw-delete').onclick=()=>{if(!commitAttributes())return;remember();features=features.filter(f=>f.properties.uid!==selected);selected=null;persist();rebuild();fillForm();status('Feature deleted. Undo restores it.');};
  $('draw-undo').onclick=()=>{if(!commitAttributes()||!history.length)return;features=history.pop();selected=null;persist();rebuild();fillForm();status('Last change undone.');};
  $('draw-clear').onclick=()=>{if(!commitAttributes())return;$('draw-clear-confirm').hidden=false;};
  $('draw-keep').onclick=()=>{$('draw-clear-confirm').hidden=true;};
  $('draw-clear-yes').onclick=()=>{remember();features=[];selected=null;persist();rebuild();fillForm();$('draw-clear-confirm').hidden=true;status('Session cleared. Undo restores the drawings.');};
  $('draw-visible').onchange=()=>{visible=$('draw-visible').checked;if(visible)group.addTo(map);else map.removeLayer(group);};
  $('draw-fit').onclick=()=>{if(features.length){visible=true;$('draw-visible').checked=true;group.addTo(map);map.fitBounds(group.getBounds(),{padding:[65,100],maxZoom:19});}};
  $('draw-session-name').value=name;
  $('draw-session-name').onchange=()=>{name=$('draw-session-name').value.trim()||'Field drawings';$('draw-session-name').value=name;persist();};
  $('draw-close').onclick=()=>{if(!commitAttributes())return;cancel();panel.hidden=true;menu.open=false;$('draw-menu-toggle').focus();};
  $('draw-manage').onclick=()=>{if(!commitAttributes())return;begin();show();renderList();status('Select a feature to edit. Drawings are shown in 2D.');};
  document.querySelectorAll('[data-draw-type]').forEach(b=>b.onclick=()=>start(b.dataset.drawType));
  menu.addEventListener('toggle',()=>{$('draw-menu-toggle').setAttribute('aria-expanded',String(menu.open));});
  document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))menu.open=false;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(busy())cancel();else if(!panel.hidden&&commitAttributes())panel.hidden=true;menu.open=false;}});
  $('draw-export').onclick=async()=>{
    if(busy()||!commitAttributes()||!features.length)return;
    exporting=true;syncMode();status('Preparing KMZ…');
    try{
      const zip=new JSZip();zip.file('doc.kml',toKML(features,name));
      const r=await fetch('draw-point.png');if(!r.ok)throw Error('Point symbol could not load.');zip.file('files/point.png',await r.arrayBuffer());
      const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',mimeType:'application/vnd.google-earth.kmz'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(name.replace(/[^\p{L}\p{N}_-]+/gu,'-').replace(/^-|-$/g,'').slice(0,90)||'field-drawings')+'.kmz';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      status(`Exported ${features.length} ${features.length===1?'feature':'features'} to KMZ, including hidden drawings.`);
    }catch(e){console.error(e);status('KMZ export failed. Your drawings are still saved; please try again.',true);}
    finally{exporting=false;syncMode();}
  };
  try{
    const saved=JSON.parse(localStorage.getItem(key)||'null');
    if(saved){if(saved.version!==1||!Array.isArray(saved.features)||sessionError(saved.features)||saved.features.some(f=>!names[f.properties.draw_type]||!f.properties.uid)||new Set(saved.features.map(f=>f.properties.uid)).size!==saved.features.length)throw Error('Invalid saved session');
      features=saved.features;name=String(saved.name||name);$('draw-session-name').value=name;
    }
  }catch(e){status('The saved session could not be restored. It has not been overwritten.',true);}
  rebuild();fillForm();
  $('draw-menu-toggle').removeAttribute('aria-disabled');
  return {busy,cancel,hide(){if(!commitAttributes())return false;cancel();panel.hidden=true;menu.open=false;return true;},hideLayer(){cancel();visible=false;$('draw-visible').checked=false;map.removeLayer(group);}};
}
