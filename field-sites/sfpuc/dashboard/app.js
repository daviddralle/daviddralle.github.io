'use strict';
const $=s=>document.querySelector(s), U=window.SFPUCUnits;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let weather, selected=[], chart, variable='cumulative', site='sheep-camp';
let waterYears=[], comparisonExtent='full';
const W=window.SFPUCWaterYears;
const metric=(title,value,note)=>`<div class="metric"><span>${title}</span><strong>${value}</strong><small>${note}</small></div>`;
function comparisonRows(){
  const c=W.compare(waterYears,$('#compare-year').value),end=comparisonExtent==='full'?365:c.index;
  return [...c.previous,c.focus].flatMap(s=>s.points.slice(0,end+1).filter(p=>!p.future).map(p=>({water_year:s.year,date:p.date||'',calendar_day:p.key,cumulative:p.total,missing_days:p.missing,trace_days:p.traces,status:p.calendarGap?'calendar alignment':p.total===null?'incomplete cumulative total':'reported'})));
}
function renderComparison(){
  const c=W.compare(waterYears,$('#compare-year').value),cutoff=c.focus.end.slice(5),total=c.current.total,end=comparisonExtent==='full'?365:c.index;
  const delta=total!==null&&c.median!==null?total-c.median:null;
  const deltaText=delta===null?'Unavailable':delta===0?'Same as median':`${U.format(Math.abs(delta),'rain')} ${delta>0?'above':'below'}`;
  const percent=c.median>0&&total!==null?`${Math.round(total/c.median*100)}% of previous-year median`:'Percentage not defined when median is zero';
  $('#weather-metrics').innerHTML=metric(`WY ${c.focus.year} through ${cutoff}`,U.format(total,'rain'),total===null?'Incomplete record since October 1':`${c.current.traces} trace days; no missing days`)+metric('Previous-year median',U.format(c.median,'rain'),`${c.eligible.length} complete comparisons through ${cutoff}`)+metric('Difference from median',delta===null?'Unavailable':U.format(delta,'rain'),delta===null?'Missing data prevent comparison':c.median===0?'Median is zero; no percentage shown':percent)+metric('Previous-year range',c.min===null?'Unavailable':`${U.number(c.min,'rain').toFixed(1)}–${U.format(c.max,'rain')}`,`Same calendar date · ${c.previous.length} earlier years available`);
  $('#comparison-date').textContent=`Through ${c.focus.end} · ${deltaText}`;
  const palette=['#8caaa9','#dfba80','#8bb7dc','#bb9bb9','#6eaa98','#a7acba'];
  chart?.destroy();
  chart=new Chart($('#weather-chart'),{type:'line',data:{labels:W.keys.slice(0,end+1),datasets:[...c.previous,c.focus].map((s,i)=>({label:`WY ${s.year}${s===c.focus?' · selected':''}`,data:s.points.slice(0,end+1).map(p=>p.total===null?null:U.number(p.total,'rain')),borderColor:s===c.focus?'#c0ec94':palette[i%palette.length],borderWidth:s===c.focus?3:1.4,pointRadius:0,pointHitRadius:7,spanGaps:false,tension:0,order:s===c.focus?0:1}))},options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'top',align:'start',labels:{color:'#c5d6d5',usePointStyle:true,pointStyle:'line',boxWidth:18,font:{size:10}}},tooltip:{callbacks:{title:items=>`Since October 1 · through ${W.keys[items[0].dataIndex]}`,label:item=>`${item.dataset.label}: ${item.parsed.y.toFixed(2)} ${U.label('rain')}`,afterBody:items=>W.keys[items[0]?.dataIndex]==='02-29'?'Non-leap years carry February 28 total for calendar alignment.':''}}},scales:{x:{grid:{display:false},ticks:{color:'#a6bbc0',maxTicksLimit:12,maxRotation:0}},y:{beginAtZero:true,title:{display:true,text:`Cumulative precipitation (${U.label('rain')})`,color:'#a6bbc0'},grid:{color:'#2c464d80'},ticks:{color:'#a6bbc0'}}}}});
  $('#weather-chart').setAttribute('aria-label',`Cumulative water-year precipitation in ${U.label('rain')}. Selected WY ${c.focus.year} through ${c.focus.end}, compared with ${c.previous.length} earlier years. ${deltaText}. Totals available below.`);
  const gaps=[...c.previous,c.focus].map(s=>{const p=s.points.find(p=>!p.future&&!p.calendarGap&&p.total===null);return p?`WY ${s.year}: ${p.date}`:null;}).filter(Boolean);
  $('#coverage').textContent=`October 1 start; years aligned by month and day. Selected year stops at ${c.focus.end}. ${c.eligible.length} of ${c.previous.length} earlier years have complete precipitation through ${cutoff}; only those enter the median and range. Cumulative lines stop at the first missing day${gaps.length?' ('+gaps.join('; ')+')':''}. Traces count as zero. This short station history is not a climate normal. Click legend entries to hide or show years.`;
  $('#values-summary').textContent=`Compare totals through ${cutoff}`;
  $('#daily-table').innerHTML=`<table><thead><tr><th>Water year</th><th>Through</th><th>Cumulative (${U.label('rain')})</th><th>Missing days</th><th>Trace days</th></tr></thead><tbody>${[...c.previous,c.focus].map(s=>{const p=s.points[c.index];return `<tr><td>${s.year}${s===c.focus?' · selected':''}</td><td>${p.date||`${s.year}-02-28`}</td><td>${p.total===null?'Incomplete':U.number(p.total,'rain').toFixed(2)}</td><td>${p.missing}</td><td>${p.traces}</td></tr>`;}).join('')}</tbody></table>`;
}
function downloadComparison(){
  const rows=comparisonRows(),header=['water_year','date','calendar_day',U.system==='imperial'?'cumulative_in':'cumulative_mm','missing_days_to_date','trace_days_to_date','status'];
  const text=[header.join(','),...rows.map(r=>[r.water_year,r.date,r.calendar_day,r.cumulative===null?'':U.number(r.cumulative,'rain').toFixed(5),r.missing_days,r.trace_days,r.status].join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`LVK_WY${$('#compare-year').value}_comparison_${comparisonExtent}_${U.system}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function setSite(){
  site=['sheep-camp','maguire-ridge'].includes(location.hash.slice(1))?location.hash.slice(1):'sheep-camp';
  const names={'sheep-camp':'Sheep Camp','maguire-ridge':'Maguire Ridge'};
  $('#site-name').textContent=names[site];
  document.querySelectorAll('[data-site]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.site===site)));
  if(!weather)return;
  const s=weather.metadata.sites[site], m=weather.metadata;
  $('#site-description').textContent=`North plots · ${s.plots} plots · ${s.trees_2022} trees in the 2022 inventory`;
  $('#station-description').innerHTML=`LVK · ${U.html(s.station_distance_km,'distance')} from ${esc(s.name)} · station elevation ${U.html(m.station.elevation_m,'length')} · ${m.start} – ${m.end}`;
}
function setPeriod(){
  const value=$('#period').value,m=weather.metadata;
  if(value==='custom')return;
  let start=m.start,end=m.end;
  if(value==='30'){const d=new Date(m.end+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-29);start=d.toISOString().slice(0,10);}
  else if(value!=='all'){start=`${Number(value)-1}-10-01`;end=`${value}-09-30`>m.end?m.end:`${value}-09-30`;}
  $('#start').value=start;$('#end').value=end;applyRange();
}
function applyRange(){
  const start=$('#start').value,end=$('#end').value,m=weather.metadata;
  const valid=start&&end&&start<=end&&start>=m.start&&end<=m.end;
  $('#range-error').hidden=Boolean(valid);
  if(!valid){$('#range-error').textContent=`Choose dates between ${m.start} and ${m.end}, with From before Through.`;return;}
  selected=weather.daily.filter(d=>d.date>=start&&d.date<=end);renderWeather();
}
function mean(key){const a=selected.map(d=>d[key]).filter(v=>v!==null);return a.length?a.reduce((s,v)=>s+v,0)/a.length:null;}
function renderWeather(){
  if(!selected.length)return;
  const cumulative=variable==='cumulative';
  $('#range-form').hidden=cumulative;$('#range-error').hidden=true;$('#comparison-controls').hidden=!cumulative;
  if(cumulative){renderComparison();return;}
  $('#values-summary').textContent='View selected daily values';
  const rain=selected.filter(d=>d.precip_mm!==null), traces=selected.filter(d=>d.precip_trace).length;
  const metric=(title,value,note)=>`<div class="metric"><span>${title}</span><strong>${value}</strong><small>${note}</small></div>`;
  $('#weather-metrics').innerHTML=metric('Recorded precipitation',U.format(rain.length?rain.reduce((s,d)=>s+d.precip_mm,0):null,'rain',1),`${rain.length} / ${selected.length} days reported`)+metric('Mean daily maximum',U.format(mean('tmax_c'),'temperature',1),'Air temperature')+metric('Mean daily minimum',U.format(mean('tmin_c'),'temperature',1),'Air temperature')+metric('Mean daily wind',U.format(mean('wind_m_s'),'wind',1),'Airport exposure');
  $('#coverage').textContent=`${selected[0].date} – ${selected.at(-1).date} · ${selected.length} days. Precipitation: ${selected.length-rain.length} missing, ${traces} trace. Missing values are not filled; traces plot as zero and are flagged in the table and download. Summary values use reported days only.`;
  const series=variable==='temperature'?[['Daily maximum','tmax_c','#efbf73'],['Daily minimum','tmin_c','#63dbea']]:variable==='rain'?[['Daily precipitation','precip_mm','#63dbea']]:[['Daily mean wind','wind_m_s','#c0ec94']];
  chart?.destroy();
  chart=new Chart($('#weather-chart'),{type:variable==='rain'?'bar':'line',data:{labels:selected.map(d=>d.date),datasets:series.map(([label,key,color])=>({label:`${label} (${U.label(variable)})`,data:selected.map(d=>d[key]===null?null:U.number(d[key],variable)),borderColor:color,backgroundColor:color+(variable==='rain'?'ba':'22'),borderWidth:variable==='rain'?0:1.4,pointRadius:0,pointHitRadius:8,spanGaps:false,tension:0}))},options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'top',align:'start',labels:{color:'#c5d6d5',usePointStyle:true,pointStyle:'line',boxWidth:22,font:{size:11}}},tooltip:{callbacks:{afterBody:items=>variable==='rain'&&selected[items[0]?.dataIndex]?.precip_trace?'Trace precipitation (less than measurable amount)':''}}},scales:{x:{grid:{display:false},ticks:{color:'#a6bbc0',maxTicksLimit:8,maxRotation:0,callback:function(value){return this.getLabelForValue(value).slice(2);}}},y:{beginAtZero:variable!=='temperature',title:{display:true,text:U.label(variable),color:'#a6bbc0'},grid:{color:'#2c464d80'},ticks:{color:'#a6bbc0'}}}}});
  $('#weather-chart').setAttribute('aria-label',`${series.map(s=>s[0]).join(' and ')} in ${U.label(variable)}, Livermore Airport, ${selected[0].date} through ${selected.at(-1).date}. Daily values available in the table below.`);
  $('#daily-table').innerHTML=`<table><thead><tr><th>Date</th><th>Max (${U.label('temperature')})</th><th>Min (${U.label('temperature')})</th><th>Precip. (${U.label('rain')})</th><th>Mean wind (${U.label('wind')})</th></tr></thead><tbody>${selected.map(d=>`<tr><td>${d.date}</td>${[['tmax_c','temperature'],['tmin_c','temperature'],['precip_mm','rain'],['wind_m_s','wind']].map(([k,t])=>`<td>${d[k]===null?'Missing':d.precip_trace&&k==='precip_mm'?'Trace':U.number(d[k],t).toFixed(t==='rain'?2:1)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function download(){
  if(!selected.length)return;
  const imperial=U.system==='imperial', headers=['date',imperial?'tmax_f':'tmax_c',imperial?'tmin_f':'tmin_c',imperial?'precip_in':'precip_mm','precip_trace',imperial?'wind_mph':'wind_m_s','source'];
  const value=(d,k,t)=>d[k]===null?'':U.number(d[k],t).toFixed(5);
  const rows=selected.map(d=>[d.date,value(d,'tmax_c','temperature'),value(d,'tmin_c','temperature'),value(d,'precip_mm','rain'),d.precip_trace,value(d,'wind_m_s','wind'),d.source].join(','));
  const url=URL.createObjectURL(new Blob([[headers.join(','),...rows].join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`LVK_${selected[0].date}_${selected.at(-1).date}_${U.system}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function boot(){
  $('#jump-notes').addEventListener('click',()=>$('#data-notes').scrollIntoView({behavior:'smooth'}));
  document.querySelectorAll('[data-site]').forEach(b=>b.addEventListener('click',()=>{location.hash=b.dataset.site;}));window.addEventListener('hashchange',setSite);setSite();
  document.addEventListener('sfpuc-units-change',()=>{setSite();renderWeather();});
  try{
    const response=await fetch('data/weather.json');if(!response.ok)throw new Error(`HTTP ${response.status}`);weather=await response.json();
    const m=weather.metadata;
    waterYears=W.build(weather.daily);
    $('#compare-year').innerHTML=[...waterYears].reverse().map(s=>`<option value="${s.year}">Water year ${s.year}</option>`).join('');
    $('#compare-year').addEventListener('change',renderWeather);
    $('#download-comparison').addEventListener('click',downloadComparison);
    document.querySelectorAll('[data-extent]').forEach(b=>b.addEventListener('click',()=>{comparisonExtent=b.dataset.extent;document.querySelectorAll('[data-extent]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));renderWeather();}));
    const firstYear=Number(m.start.slice(0,4))+1,lastYear=W.year(m.end);
    $('#period').innerHTML=Array.from({length:Math.max(0,lastYear-firstYear+1)},(_,i)=>`<option value="${lastYear-i}">Water year ${lastYear-i}</option>`).join('')+'<option value="30">Latest 30 days</option><option value="all">Full record</option><option value="custom">Custom dates</option>';
    for(const id of ['start','end']){$('#'+id).min=m.start;$('#'+id).max=m.end;$('#'+id).addEventListener('change',()=>{$('#period').value='custom';});}
    $('#period').addEventListener('change',setPeriod);$('#range-form').addEventListener('submit',e=>{e.preventDefault();applyRange();});$('#download-filtered').addEventListener('click',download);
    document.querySelectorAll('[data-variable]').forEach(b=>b.addEventListener('click',()=>{variable=b.dataset.variable;document.querySelectorAll('[data-variable]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));renderWeather();}));
    $('#source-notes').innerHTML=`<p><a href="${esc(m.station_url)}" target="_blank" rel="noopener">Iowa Environmental Mesonet · LVK station record ↗</a> · <a href="${esc(m.documentation_url)}" target="_blank" rel="noopener">Daily-summary documentation ↗</a></p><p>Retrieved ${esc(m.retrieved_at.slice(0,10))}. ${m.days} calendar days; temperature and wind cover ${m.coverage.tmax_c} and ${m.coverage.wind_m_s} days. Precipitation covers ${m.coverage.precip_mm} days; missing on ${m.missing_rain_dates.map(esc).join(', ')}. ${m.trace_days} days report trace precipitation.</p><ul>${m.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>`;
    $('#snapshot-date').textContent=`Weather snapshot retrieved ${m.retrieved_at.slice(0,10)}`;setSite();setPeriod();
  }catch(error){$('#weather-error').hidden=false;$('#weather-error').textContent='The weather record could not be loaded. Reload to retry, or use the CSV downloads below.';$('#station-description').textContent='Historical weather unavailable';console.error(error);}
}
boot();
