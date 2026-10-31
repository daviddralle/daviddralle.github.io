/* Received observations, with logger clocks kept separate from receipt times. */
(()=>{
  'use strict';
  const $=s=>document.querySelector(s), U=window.SFPUCUnits;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stamp=s=>Date.parse(s.replace(' ','T')+'Z'); // Plot coordinates only; not a UTC claim.
  const tick=x=>new Date(x).toISOString().slice(5,16).replace('T',' ');
  const colors=['#63dbea','#efbf73','#c0ec94','#d3a6d8','#9bb8fc','#f49c8f'];
  let data, metadata, chart, group='soil', definitions=[], request=0;
  const groups={
    weather:[['Air temperature','AirT_C_Avg','temperature'],['Relative humidity','RH_Avg','%'],['Vapor pressure','VP_hPa_Avg','hPa'],['Air pressure','BP_hPa','hPa'],['Wind speed','WS_ms_S_WVT','wind'],['Maximum wind speed','MaxWS_ms_Max','wind'],['Wind direction','WindDir_D1_WVT','°'],['Solar radiation','SlrFD_kW_Avg','W/m²',1000],['Solar energy','SlrTF_MJ_Tot','MJ/m²'],['Hourly precipitation','Rain_mm_Tot','rain'],['Lightning strikes','Strikes_Tot','count']],
    soil:[...Array.from({length:5},(_,i)=>[`Water content · segment ${i+1}`,'vwc'+(i+1),'vwc']),...[35,100,200,300,450,600,750].map(n=>[`Temperature · T${n}`,'temp'+n,'temperature'])],
    sap:[['Total sap flow','TotalSapFlow','L/h'],['Sap flux density · outer','SFD_Outer','cm/h'],['Sap flux density · inner','SFD_Inner','cm/h'],['Stem temperature · outer','TpreDownOuter','temperature'],['Stem temperature · inner','TpreDownInner','temperature'],['Stem water content · outer','StemWaterOuter','%'],['Stem water content · inner','StemWaterInner','%']],
    power:[['Battery voltage','BattV','V'],['Logger temperature','PTemp_C','temperature']]
  };
  const label=type=>['temperature','rain','wind','vwc'].includes(type)?U.label(type):type;
  const convert=(value,type,factor=1)=>value===null||value===undefined?null:['temperature','rain','wind','vwc'].includes(type)?U.number(value*factor,type):value*factor;
  const number=(value,places=2)=>value===null||value===undefined?'Not available':Number(value).toLocaleString('en-US',{maximumFractionDigits:places});
  const selected=()=>groups[group][Number($('#observation-variable').value)||0];
  function series(){
    const [title,key,type,factor=1]=selected(), result=[];
    const add=(table,field,name,scale=factor)=>{if(data.tables[table]?.fields.some(f=>f.name===field))result.push({table,field,name,type,scale});};
    if(group==='weather')add('top_weather',key,'Top · weather station');
    if(group==='soil'){
      if(key.startsWith('vwc')){const n=key.slice(3);add('top_soil','VMC_Seg'+n,'Top · profile T',.01);add('top_soil','VMC_U_Seg'+n,'Top · profile U',.01);add('bottom_soil','VMC_Seg'+n+'_Avg','Bottom · profile B',.01);}
      else {const n=key.slice(4);add('top_soil','GP_T'+n,'Top · profile T');add('top_soil','GP_U_T'+n,'Top · profile U');add('bottom_soil','GP_T'+n+'_Avg','Bottom · profile B');}
    }
    if(group==='sap'){
      for(const sensor of ['A','B','C'])add('top_sap',key+'_'+sensor,'Top · sap '+sensor);
      for(const sensor of ['a','b']){
        if(key.startsWith('Tpre'))add('bottom_temp','Pre_Temp_Down_'+(key.endsWith('Outer')?'Outer':'Inner')+'_'+sensor,'Bottom · sap '+sensor);
        else if(key.startsWith('StemWater'))add('bottom_water','SWC_'+(key.endsWith('Outer')?'Outer':'Inner')+'_'+sensor,'Bottom · sap '+sensor);
        else add('bottom_sap',key+'_'+sensor,'Bottom · sap '+sensor);
      }
    }
    if(group==='power'){add('bottom_diag',key,'Bottom · reported');add('top_daily',key==='BattV'?'BattV_Min':'PTemp_C_Avg','Top · daily');}
    const station=$('#observation-station').value;
    return result.filter(s=>station==='both'||data.tables[s.table].station===station);
  }
  function records(s){const start=$('#observation-start').value, end=$('#observation-end').value;return data.tables[s.table].records.filter(r=>r.timestamp.slice(0,10)>=start&&r.timestamp.slice(0,10)<=end);}
  function latest(table){return data.tables[table]?.records.at(-1);}
  function cards(){
    const weather=latest('top_weather'), sap=latest('top_sap'), battery=latest('bottom_diag');
    const items=[['Air temperature',weather?.values.AirT_C_Avg,'temperature',weather?.timestamp],['Relative humidity',weather?.values.RH_Avg,'%',weather?.timestamp],...['A','B','C'].map(s=>['Sap '+s,sap?.values['TotalSapFlow_'+s],'L/h',sap?.timestamp]),['Bottom battery',battery?.values.BattV,'V','Relay time under review']];
    $('#telemetry-metrics').innerHTML=items.map(([name,v,type,time])=>`<div class="metric"><span>${name}</span><strong>${number(convert(v,type),type==='L/h'?3:2)}${v==null?'':' '+label(type)}</strong><small>${esc(time||'No record')}</small></div>`).join('');
  }
  function render(){
    if(!data)return;
    definitions=series();
    const [title,,type]=selected();
    $('#observation-chart-title').textContent=title;
    const datasets=definitions.filter(s=>data.tables[s.table].station!=='bottom').map((s,i)=>{
      const rows=records(s), points=[];
      rows.forEach((r,index)=>{const x=stamp(r.timestamp), previous=rows[index-1];if(previous&&x-stamp(previous.timestamp)>data.tables[s.table].interval_minutes*90000)points.push({x:stamp(previous.timestamp)+1,y:null});points.push({x,y:convert(r.values[s.field],s.type,s.scale)});});
      return {label:s.name,data:points,borderColor:colors[i%colors.length],backgroundColor:colors[i%colors.length],borderWidth:2,pointRadius:rows.length<40?3:0,pointHitRadius:8,spanGaps:false,tension:0};
    });
    chart?.destroy();chart=null;
    const hasPoints=datasets.some(s=>s.data.some(p=>p.y!==null));
    const xs=datasets.flatMap(s=>s.data.map(p=>p.x));
    const hours=xs.length?(Math.max(...xs)-Math.min(...xs))/3600000:0;
    const tickHours=[1,2,3,6,12,24,48,72,168,336].find(h=>h>=hours/6)||720;
    $('#observation-empty').hidden=hasPoints;
    $('#observation-empty').textContent=$('#observation-station').value==='bottom'?'Bottom records are held out of plots until the relay timestamps and values are verified. Latest reported values are listed below.':'No plottable records for this selection. Missing values are not replaced with zero.';
    $('#observation-chart').hidden=!hasPoints;
    if(hasPoints)chart=new Chart($('#observation-chart'),{type:group==='weather'&&selected()[1]==='Rain_mm_Tot'?'bar':'line',data:{datasets},options:{responsive:true,maintainAspectRatio:false,animation:false,parsing:false,normalized:false,interaction:{mode:'nearest',intersect:false},plugins:{legend:{position:'top',align:'start',labels:{color:'#c5d6d5',usePointStyle:true,boxWidth:12}},tooltip:{callbacks:{title:items=>tick(items[0].parsed.x)+' · logger clock',label:item=>`${item.dataset.label}: ${number(item.parsed.y,4)} ${label(type)}`}}},scales:{x:{type:'linear',ticks:{color:'#a6bbc0',maxTicksLimit:7,maxRotation:0,stepSize:tickHours*3600000,callback:tick},grid:{color:'#2c464d55'},title:{display:true,text:'Logger clock · time zone not yet confirmed',color:'#a6bbc0'}},y:{ticks:{color:'#a6bbc0'},title:{display:true,text:label(type),color:'#a6bbc0'},grid:{color:'#2c464d80'}}}}});
    $('#observation-chart').setAttribute('aria-label',`${title} in ${label(type)}. Logger timestamps. Data values and quality notes are available below.`);
    $('#observation-values').innerHTML=`<table><thead><tr><th>Series</th><th>Latest in selection</th><th>Value (${label(type)})</th><th>Status</th></tr></thead><tbody>${definitions.map(s=>{const r=records(s).at(-1);return `<tr><td>${esc(s.name)}</td><td>${esc(r?.timestamp||'No record')}</td><td>${number(convert(r?.values[s.field],s.type,s.scale),4)}</td><td>${r?.quality==='relay_review'?'Relay review · not plotted':esc(r?.flags[s.field]?.replaceAll('_',' ')||'Provisional')}</td></tr>`;}).join('')||'<tr><td colspan="4">No records.</td></tr>'}</tbody></table>`;
  }
  function setGroup(){
    $('#observation-variable').innerHTML=groups[group].map(([name],i)=>`<option value="${i}">${esc(name)}</option>`).join('');
    document.querySelectorAll('[data-observation-group]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.observationGroup===group)));
    render();
  }
  function siteChanged(){const sheep=location.hash!=='#maguire-ridge';$('#site-telemetry').hidden=!sheep;$('#site-no-telemetry').hidden=sheep;if(sheep)chart?.resize();}
  function download(){
    const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
    const rows=[['station','series','timestamp_logger','record','variable','raw_value','native_unit','display_value','display_unit','quality','source_file','received_utc']];
    for(const s of definitions)for(const r of records(s))rows.push([data.tables[s.table].station,s.name,r.timestamp,r.record,s.field,r.raw[s.field],data.tables[s.table].fields.find(f=>f.name===s.field)?.unit,convert(r.values[s.field],s.type,s.scale),label(s.type),[r.quality,r.flags[s.field]].filter(Boolean).join(';'),r.source_file,r.received_utc]);
    const url=URL.createObjectURL(new Blob([rows.map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`sheep-camp-${group}-${$('#observation-start').value}-${$('#observation-end').value}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function renderQuality(){
    $('#telemetry-quality').innerHTML=`<ul>${data.quality_notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul><p>${data.issues.length} excluded source file(s): ${data.issues.map(i=>`${esc(i.file)} — ${esc(i.reason)}`).join('; ')||'none'}.</p><p>Downloads retain native values, file provenance and quality flags, including records withheld from plots.</p>`;
    $('#telemetry-files').innerHTML=`<table><thead><tr><th>Table</th><th>Rows in loaded period</th><th>Latest logger time</th><th>Status</th></tr></thead><tbody>${Object.entries(data.tables).map(([key,t])=>`<tr><td>${esc(key)}</td><td>${t.records.length}</td><td>${esc(t.records.at(-1)?.timestamp||'No record')}</td><td>${t.station==='bottom'?'Relay review':'Provisional'}</td></tr>`).join('')}</tbody></table>`;
  }
  async function load(url, setup=false){
    const version=++request;$('#telemetry-error').hidden=true;
    try{
      const response=await fetch(url,{cache:'no-cache'});if(!response.ok)throw Error(response.status);const value=await response.json();if(version!==request)return;data=value;
      if(setup){$('#telemetry-period').innerHTML='<option value="recent">Latest 31 days</option>'+data.months.slice().reverse().map(m=>`<option value="${m}">${m}</option>`).join('');}
      const dates=Object.values(data.tables).flatMap(t=>t.records.map(r=>r.timestamp.slice(0,10))).sort();
      $('#observation-start').value=dates[0]||'';$('#observation-end').value=dates.at(-1)||'';
      const received=new Date(data.received_through_utc), hours=(Date.now()-received)/3600000;
      $('#telemetry-received').textContent='Pi received through '+received.toLocaleString('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'})+(hours>8?' · no upload in the past 8 hours':'');
      $('#telemetry-received').classList.toggle('attention',hours>8);
      cards();setGroup();renderQuality();
    }catch(error){$('#telemetry-error').hidden=false;$('#telemetry-error').textContent='Could not load the telemetry file. The previous chart, if shown, has not refreshed.';console.error(error);}
  }
  async function boot(){
    document.querySelectorAll('[data-observation-group]').forEach(b=>b.addEventListener('click',()=>{group=b.dataset.observationGroup;setGroup();}));
    for(const id of ['observation-variable','observation-station','observation-start','observation-end'])$('#'+id).addEventListener('change',render);
    $('#telemetry-period').addEventListener('change',()=>load($('#telemetry-period').value==='recent'?'data/telemetry.json':'data/telemetry-'+$('#telemetry-period').value+'.json'));
    $('#download-observations').addEventListener('click',download);
    document.addEventListener('sfpuc-units-change',()=>{if(data){cards();render();}});window.addEventListener('hashchange',siteChanged);siteChanged();
    await load('data/telemetry.json',true);
    try{const response=await fetch('data/stations.json');if(!response.ok)throw Error(response.status);metadata=await response.json();$('#station-metadata').innerHTML=metadata.stations.map(s=>`<div><strong>${esc(s.label)}</strong><p>CR350 ${esc(s.logger_serial)} · PakBus ${s.pakbus_address}<br>Soil: ${s.soil_profiles.join(', ')} · sap: ${s.sap_sensors.join(', ')}<br>Soil every ${s.soil_interval_minutes} min · sap every ${s.sap_interval_minutes} min<br>Coordinates: ${s.latitude===null||s.longitude===null?'Pending':esc(s.latitude+', '+s.longitude)}<br>${esc(s.setting_description||'Installation description pending.')}</p></div>`).join('');$('#metadata-pending').textContent='To add: '+metadata.pending_fields.join('; ')+'.';}catch{$('#metadata-pending').textContent='Station metadata unavailable.';}
  }
  boot();
})();
