'use strict';
const $=id=>document.getElementById(id),H=FloodHistory;
const fmt=n=>Math.round(n).toLocaleString('en-US'),pct=p=>(p*100).toFixed(1)+'%';
let rows=[],threshold=72000,start=1940,season='all';const storeKey='russian-river-flood-history-v1';
const query=new URLSearchParams(location.search),stage=Number(query.get('stage'));
function links(){const params=new URLSearchParams({threshold:String(threshold),period:start===1984?'modern':'full',season});if(Number.isInteger(stage)&&stage>=32&&stage<=52){params.set('stage',stage);$('atlas-link').href='./?stage='+stage;}$('hydrology-link').href='hydrology.html?'+params;$('data-link').href='hydrology.html?'+params+'#methods';}
function draw(){
 if(!rows.length)return;
 const host=$('history-chart'),w=host.clientWidth,h=host.clientHeight,fs=parseFloat(getComputedStyle(host).fontSize),left=fs*4.6,right=18,top=30,bottom=fs*3.4;
 const x=yr=>left+(yr-start)/(2025-start)*(w-left-right),y=q=>top+(1-q/120000)*(h-top-bottom);
 const text=(x,y,s,anchor='middle',color='#55736b')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}">${s}</text>`;
 let svg='';for(const q of [0,30000,60000,90000,120000])svg+=`<path d="M${left} ${y(q)}H${w-right}" stroke="#e1e9e3"/>`+text(left-8,y(q)+4,q/1000+'k','end');
 const years=w<600?[start,Math.round((start+2025)/2),2025]:start===1940?[1940,1960,1980,2000,2025]:[1984,1995,2005,2015,2025];for(const yr of years)svg+=text(x(yr),h-fs*1.7,yr);
 const selected=new Set(H.summarize(rows,threshold,start,season).rows.map(r=>r.water_year));
 for(const row of rows.filter(r=>r.water_year>=start)){
  const active=selected.has(row.water_year),color=row.el_nino_winter===true?'#a67b38':row.el_nino_winter===false?'#267972':'#aab7b2';
  svg+=`<g opacity="${active?1:.14}"><title>${row.water_year}: ${fmt(row.peak_cfs)} cfs · ${row.el_nino_winter===true?'El Niño':row.el_nino_winter===false?'other winter':'unclassified'} · ${row.peak_cfs>=threshold?'at or above':'below'} threshold</title><path d="M${x(row.water_year)} ${y(0)}V${y(row.peak_cfs)}" stroke="${color}" stroke-width="${active&&row.peak_cfs>=threshold?2.5:1.2}"/><circle cx="${x(row.water_year)}" cy="${y(row.peak_cfs)}" r="${row.water_year===2019?5:3}" fill="${color}" ${row.water_year===2019?'stroke="#fff" stroke-width="1.5"':''}/></g>`;
 }
 svg+=`<path d="M${left} ${y(threshold)}H${w-right}" stroke="#996c2c" stroke-width="2" stroke-dasharray="7 4"/>`+text(w-right,Math.max(top+fs,y(threshold)-9),'House damage threshold · '+fmt(threshold)+' cfs','end','#8c6026');
 svg+=text(left,fs+2,'cfs','start')+text(left+(w-left-right)/2,h-3,'Water year');
 host.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Annual peak flow, ${start} to 2025; ${season==='all'?'all years':season==='el_nino'?'El Niño years':'other years'} highlighted; threshold ${fmt(threshold)} cfs"><g font-family="system-ui,sans-serif" font-size="${fs}">${svg}</g></svg>`;
}
function render(){
 $('threshold-slider').value=threshold;$('threshold-number').value=threshold;$('error').hidden=true;
 for(const name of ['all','el_nino','other']){const s=H.summarize(rows,threshold,start,name);$(name+'-rate').textContent=s.p===null?'—':pct(s.p);$(name+'-count').textContent=`${s.k} of ${s.n} years reached this level`;}
 for(const b of document.querySelectorAll('[data-season]'))b.setAttribute('aria-pressed',String(b.dataset.season===season));links();draw();
 try{localStorage.setItem(storeKey,JSON.stringify({threshold,start,season}));}catch{}
}
async function init(){
 const response=await fetch('data/research/flood_enso_history.json?v=1');if(!response.ok)throw Error('The flow record could not load. Please reload.');rows=(await response.json()).annual_peaks;
 try{const saved=JSON.parse(localStorage.getItem(storeKey));if(saved){if(H.validThreshold(saved.threshold))threshold=saved.threshold;if([1940,1984].includes(saved.start))start=saved.start;if(['all','el_nino','other'].includes(saved.season))season=saved.season;}}catch{}
 if(query.has('threshold')&&H.validThreshold(Number(query.get('threshold'))))threshold=Number(query.get('threshold'));if(query.get('period')==='modern')start=1984;else if(query.get('period')==='full')start=1940;
 if(['all','el_nino','other'].includes(query.get('season')))season=query.get('season');
 $('record').value=start;$('record').onchange=e=>{start=Number(e.target.value);render();};
 $('threshold-slider').oninput=e=>{threshold=Number(e.target.value);render();};
 $('threshold-number').oninput=e=>{const n=e.target.value.trim()===''?NaN:Number(e.target.value);if(H.validThreshold(n)){threshold=n;render();}else{$('error').textContent='Enter a threshold from 500 to 120,000 cfs.';$('error').hidden=false;for(const name of ['all','el_nino','other']){$(name+'-rate').textContent='—';$(name+'-count').textContent='';}}};
 $('reference').onclick=()=>{threshold=rows.find(r=>r.water_year===2019).peak_cfs;render();};for(const b of document.querySelectorAll('[data-season]'))b.onclick=()=>{season=b.dataset.season;render();};
 new ResizeObserver(draw).observe($('history-chart'));render();
}
init().catch(e=>{$('error').hidden=false;$('error').textContent=e.message;});
