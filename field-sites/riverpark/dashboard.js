'use strict';
const ZONE = 'America/Los_Angeles';
const DAY = 86400000;
const STEP = 300000;
const localDay = t => new Intl.DateTimeFormat('en-CA', {timeZone: ZONE, year:'numeric', month:'2-digit', day:'2-digit'}).format(t);
const valid = v => typeof v === 'number' && Number.isFinite(v);
function increment(previous, current) {
  if (!previous || current[0] <= previous[0] || current[0] - previous[0] > STEP * 1.5) return null;
  if (valid(current[6]) && valid(previous[6]) && current[6] >= previous[6] - .00001) return Math.max(0, current[6] - previous[6]);
  if (valid(current[7]) && valid(previous[7])) {
    if (localDay(current[0]) !== localDay(previous[0])) return current[7];
    if (current[7] >= previous[7] - .00001) return Math.max(0, current[7] - previous[7]);
  }
  return null;
}
function prepareRaw(rows, start, end) {
  const sorted = [...new Map(rows.map(r => [r[0], r])).values()].sort((a,b) => a[0]-b[0]);
  return sorted.map((r,i) => ({t:r[0], temp:r[1], humidity:r[2], wind:r[3], gust:r[4], rain:increment(sorted[i-1], r)})).filter(r => r.t > start && r.t <= end);
}
function cumulative(points) {
  let sum = 0;
  let known = 0;
  return points.map(p => {
    if (valid(p.rain)) { sum += p.rain; known++; }
    return {...p, cumulative: valid(p.rain) && known ? Number(sum.toFixed(5)) : null};
  });
}
function convert(v, kind, units) {
  if (!valid(v)) return null;
  if (units === 'us') return v;
  if (kind === 'temp') return (v-32)*5/9;
  if (kind === 'wind' || kind === 'gust') return v*.44704;
  if (kind === 'rain' || kind === 'cumulative') return v*25.4;
  return v;
}
if (typeof module !== 'undefined') module.exports = {increment,prepareRaw,cumulative,convert};
if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  const colors = {temp:'#efbf73',humidity:'#63dbea',wind:'#c0ec94',gust:'#8faaa4',cumulative:'#63dbea',rain:'#63dbea'};
  let units = 'us';
  try { units = localStorage.getItem('riverpark-units') === 'metric' ? 'metric' : 'us'; } catch {}
  let days = 2, manifest, recent, daily, points = [], charts = [], bounds, dailyMode = false, zoom = null, cursor = null, revision = 0;
  const months = new Map();
  const dateText = (t, opts={}) => new Intl.DateTimeFormat('en-US',{timeZone:ZONE,month:'short',day:'numeric',...opts}).format(t);
  const fmt = (v, digits=1) => valid(v) ? v.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}) : '—';
  const unit = kind => kind === 'temp' ? (units==='us'?'°F':'°C') : ['wind','gust'].includes(kind) ? (units==='us'?'mph':'m/s') : kind==='humidity'?'%':units==='us'?'in':'mm';
  const fetchJSON = async file => {
    const response = await fetch(`data/${file}`, {cache:'no-cache'});
    if (!response.ok) throw Error(`Could not load ${file}`);
    return response.json();
  };
  function showError(message) { $('error').textContent=message; $('error').hidden=false; }
  function renderCurrent() {
    const r=manifest.current, extra=manifest.current_extra;
    const reading = (id,v,kind,digits=1) => { $(id).innerHTML=`${fmt(convert(v,kind,units),digits)}<small>${unit(kind)}</small>`; };
    reading('current-temp',r[1],'temp');
    reading('current-humidity',r[2],'humidity',0);
    reading('current-wind',r[3],'wind');
    reading('current-rain',r[7],'rain',units==='us'?3:1);
    $('current-feels').textContent=`Feels like ${fmt(convert(extra.feelsLike,'temp',units))} ${unit('temp')}`;
    const compass=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    $('current-gust').textContent=`${valid(r[5])?compass[Math.round(r[5]/22.5)%16]+' · ':''}Gust ${fmt(convert(r[4],'wind',units))} ${unit('wind')}`;
    $('current-rate').textContent=`Rate ${fmt(convert(r[8],'rain',units),units==='us'?3:1)} ${unit('rain')}/h`;
    $('reading-time').textContent=dateText(r[0],{month:undefined,day:undefined,hour:'numeric',minute:'2-digit'});
    const age=Math.max(0,Math.round((Date.now()-r[0])/60000));
    $('status').textContent=age<=45?'Station reporting':age<=180?'Observations delayed':'Station data stale';
    $('status-dot').className=age<=45?'live':age<=180?'stale':'offline';
    $('updated').textContent=`${dateText(r[0],{year:'numeric',hour:'numeric',minute:'2-digit'})} · ${age<60?age+' min':Math.floor(age/60)+' h'} ago`;
    $('archive-coverage').textContent=`Archive: ${dateText(manifest.start,{year:'numeric'})} – ${dateText(manifest.end,{year:'numeric'})}. ${manifest.count.toLocaleString()} observations. Gaps are retained; no nearby stations or modeled values are substituted.`;
    document.querySelectorAll('[data-unit]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.unit===units)));
  }
  async function rawRows(start,end) {
    if (start >= recent.rows[0]?.[0]) return recent.rows;
    const required=manifest.months.filter(month=>{
      const first=Date.parse(month+'-01T00:00:00Z');
      const next=new Date(first); next.setUTCMonth(next.getUTCMonth()+1);
      return first<=end && next.getTime()>=start-STEP;
    });
    await Promise.all(required.map(async month=>{
      if (!months.has(month)) months.set(month,(await fetchJSON(`observations-${month}.json`)).rows);
    }));
    return required.flatMap(month=>months.get(month));
  }
  function hoverAt(t) {
    cursor=t;
    let nearest=null;
    if (t!==null) {
      let lo=0,hi=points.length-1;
      while(lo<hi) {const mid=Math.floor((lo+hi)/2); if(points[mid].t<t)lo=mid+1;else hi=mid;}
      nearest=points[lo];
      if(lo>0&&Math.abs(points[lo-1].t-t)<Math.abs(nearest.t-t))nearest=points[lo-1];
      if(nearest&&Math.abs(nearest.t-t)>(dailyMode?DAY:STEP)*1.5)nearest=null;
    }
    for(const kind of ['temp','humidity','wind','cumulative','rain']) {
      $('hover-'+kind).textContent=t===null?'':nearest?`${fmt(convert(nearest[kind],kind,units),['rain','cumulative'].includes(kind)?(units==='us'?3:1):1)} ${unit(kind)}`:'No observation';
    }
    $('cursor-date').textContent=t===null?'Hover to compare · drag across a plot to zoom':dateText(nearest?.t||t,{year:'numeric',...(dailyMode?{}:{hour:'numeric',minute:'2-digit',timeZoneName:'short'})});
    charts.forEach(chart=>chart.draw());
  }
  const linkedCursor={id:'linkedCursor',afterEvent(chart,args){
    if(args.event.type==='mouseout')return hoverAt(null);
    if(args.event.type!=='mousemove')return;
    const {x,y}=args.event,a=chart.chartArea;
    if(x>=a.left&&x<=a.right&&y>=a.top&&y<=a.bottom)hoverAt(chart.scales.x.getValueForPixel(x));
  },afterDraw(chart){
    if(cursor===null)return;
    const x=chart.scales.x.getPixelForValue(cursor),a=chart.chartArea,ctx=chart.ctx;
    if(x<a.left||x>a.right)return;
    ctx.save();ctx.strokeStyle='#dce8df77';ctx.setLineDash([3,3]);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,a.top);ctx.lineTo(x,a.bottom);ctx.stroke();ctx.restore();
  }};
  function plotSeries(kind) {
    const series=[];
    for(let i=0;i<points.length;i++) {
      const p=points[i],prev=points[i-1];
      if(prev&&p.t-prev.t>(dailyMode?DAY*1.6:STEP*1.5))series.push({x:(p.t+prev.t)/2,y:null});
      series.push({x:p.t,y:convert(p[kind],kind,units)});
    }
    return series;
  }
  function draw() {
    charts.forEach(c=>c.destroy());charts=[];cursor=null;
    $('temp-unit').textContent=unit('temp');$('wind-unit').textContent=unit('wind');$('cum-unit').textContent=unit('rain');$('rain-unit').textContent=`${unit('rain')} / ${dailyMode?'day':'5 min'}`;
    for(const kind of ['temp','humidity','wind','cumulative','rain']) {
      const last=kind==='rain';
      const dataset=k=>({label:k,data:plotSeries(k),borderColor:colors[k],backgroundColor:colors[k]+(last?'bb':'16'),borderWidth:last?0:1.5,pointRadius:0,pointHitRadius:4,spanGaps:false,fill:k==='cumulative',stepped:k==='cumulative',barThickness:dailyMode?'flex':3,maxBarThickness:12});
      const chart=new Chart($('plot-'+kind),{type:last?'bar':'line',plugins:[linkedCursor],data:{datasets:kind==='wind'?[dataset('gust'),dataset('wind')]:[dataset(kind)]},options:{responsive:true,maintainAspectRatio:false,animation:false,parsing:false,normalized:false,events:['mousemove','mouseout','click','touchstart','touchmove'],layout:{padding:{right:12}},plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{type:'linear',offset:false,min:bounds.start,max:bounds.end,grid:{color:'#2c464d80',drawTicks:false},border:{display:false},ticks:{display:last,color:'#a6bbc0',maxTicksLimit:window.innerWidth<600?4:7,maxRotation:0,font:{size:10},padding:8,callback:value=>dateText(value,bounds.end-bounds.start<=3*DAY?{hour:'numeric',hour12:true}:bounds.end-bounds.start>300*DAY?{month:'short',day:undefined,year:'2-digit'}:{})}},y:{min:['humidity','wind','cumulative','rain'].includes(kind)?0:undefined,max:kind==='humidity'?100:undefined,suggestedMax:last?(units==='us'?.02:.5):undefined,afterFit:scale=>{scale.width=48;},grid:{color:'#2c464d80',drawTicks:false},border:{display:false},ticks:{color:'#a6bbc0',maxTicksLimit:3,font:{size:10},padding:8}}}}});
      charts.push(chart);
      const canvas=chart.canvas;
      let down=null;
      canvas.onpointerdown=event=>{
        if(event.pointerType==='touch')return;
        const x=event.clientX-canvas.getBoundingClientRect().left;
        if(x<chart.chartArea.left||x>chart.chartArea.right)return;
        down=x;canvas.setPointerCapture(event.pointerId);
      };
      canvas.onpointerup=event=>{
        if(down===null)return;
        const x=Math.max(chart.chartArea.left,Math.min(chart.chartArea.right,event.clientX-canvas.getBoundingClientRect().left));
        const a=chart.scales.x.getValueForPixel(Math.min(down,x)),b=chart.scales.x.getValueForPixel(Math.max(down,x));
        const dragged=Math.abs(x-down)>12;down=null;
        if(dragged&&b-a>=30*60000){zoom={start:a,end:b};render();}
      };
      canvas.onpointercancel=()=>{down=null;};
    }
    hoverAt(null);
  }
  async function render() {
    const token=++revision;
    $('plot-stack').setAttribute('aria-busy','true');
    $('resolution').textContent='Loading…';
    try {
      const chosen=zoom||{start:manifest.current[0]-days*DAY,end:manifest.current[0]};
      const useDaily=chosen.end-chosen.start>30*DAY;
      let data;
      if(useDaily){data=daily.days.filter(r=>r.t>=chosen.start&&r.t<=chosen.end);}
      else {data=prepareRaw(await rawRows(chosen.start,chosen.end),chosen.start,chosen.end);}
      if(token!==revision)return;
      bounds=chosen;dailyMode=useDaily;points=cumulative(data);
      const known=points.filter(p=>valid(p.rain));
      const sum=known.reduce((s,p)=>s+p.rain,0);
      const incomplete=!points.length||known.length<points.length||points.some((p,i)=>dailyMode?!p.complete:i>0&&p.t-points[i-1].t>STEP*1.5)||points[0].t-bounds.start>(dailyMode?DAY*1.1:STEP*1.5)||bounds.end-points.at(-1).t>(dailyMode?DAY*1.1:STEP*1.5);
      $('window-rain').innerHTML=`${fmt(known.length?convert(sum,'rain',units):null,units==='us'?3:1)}<small>${unit('rain')}</small>`;
      $('window-rain-note').textContent=incomplete?'Observed subtotal · incomplete coverage':'Accumulated within this window';
      $('coverage').textContent=!points.length?'No observations in this window. Choose a different window.':incomplete?'Gaps or partial days in this window. Rain totals include observed intervals only.':'Rain accumulates from the start of the selected window. Missing values are never treated as zero.';
      $('range-label').textContent=`${dateText(bounds.start,{year:'numeric'})} – ${dateText(bounds.end,{year:'numeric'})}`;
      $('resolution').textContent=dailyMode?'Daily summaries':'5-minute observations';
      $('reset').hidden=!zoom;
      document.querySelectorAll('[data-days]').forEach(b=>b.setAttribute('aria-pressed',String(!zoom&&Number(b.dataset.days)===days)));
      draw();$('error').hidden=true;
    } catch(error) {showError('The selected observations could not be loaded. Please try another window or reload the page.');$('resolution').textContent='Data unavailable';}
    finally {if(token===revision)$('plot-stack').setAttribute('aria-busy','false');}
  }
  $('windows').addEventListener('click',event=>{const button=event.target.closest('[data-days]');if(button&&manifest){days=Number(button.dataset.days);zoom=null;render();}});
  $('units').addEventListener('click',event=>{const button=event.target.closest('[data-unit]');if(button&&manifest){units=button.dataset.unit;try{localStorage.setItem('riverpark-units',units);}catch{}renderCurrent();render();}});
  $('reset').addEventListener('click',()=>{zoom=null;render();});
  $('download').addEventListener('click',()=>{
    if(!points.length)return;
    const kinds=['temp','humidity','wind','gust','cumulative','rain'];
    const lines=[['timestamp_utc',...kinds.map(k=>`${k}_${unit(k)}`),...(dailyMode?['complete_day']:[])].join(',')];
    points.forEach(p=>lines.push([new Date(p.t).toISOString(),...kinds.map(k=>{const v=convert(p[k],k,units);return v===null?'':Number(v.toFixed(5));}),...(dailyMode?[p.complete]:[])].join(',')));
    const url=URL.createObjectURL(new Blob([lines.join('\n')+'\n'],{type:'text/csv'}));
    const a=document.createElement('a');a.href=url;a.download=`riverpark-${dailyMode?'daily':'5min'}-${localDay(bounds.end)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  async function refresh() {
    try {
      const [m,r,d]=await Promise.all(['manifest.json','recent.json','daily.json'].map(fetchJSON));
      manifest=m;recent=r;daily=d;months.clear();renderCurrent();
      if(typeof Chart==='undefined')throw Error('Chart library unavailable');
      await render();
    }catch(error){$('status').textContent='Data unavailable';$('status-dot').className='offline';showError('Station data could not be loaded. Reload to retry, or use the Ambient Weather link below.');$('plot-stack').setAttribute('aria-busy','false');}
  }
  refresh();setInterval(refresh,5*60000);
}
