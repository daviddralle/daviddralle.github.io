'use strict';
const $=id=>document.getElementById(id),H=FloodHistory;
const fmt=n=>Math.round(n).toLocaleString('en-US'),pct=p=>(p*100).toFixed(1)+'%';
let rows=[],threshold=72000,start=1940,season='all',view='stage',transfer,selectedYear=2019;const storeKey='russian-river-flood-history-v1';
const query=new URLSearchParams(location.search),stage=Number(query.get('stage'));
function links(){const params=new URLSearchParams({threshold:String(threshold),period:start===1984?'modern':'full',season});if(Number.isInteger(stage)&&stage>=32&&stage<=52){params.set('stage',stage);$('atlas-link').href='./?stage='+stage;}$('hydrology-link').href='hydrology.html?'+params;$('data-link').href='hydrology.html?'+params+'#methods';}
const displayValue=q=>view==='stage'?transfer.toStage(q):q;
const valueLabel=q=>view==='stage'?transfer.toStage(q).toFixed(2)+' ft':fmt(q)+' cfs';
function updateHouse(){
 const row=rows.find(r=>r.water_year===selectedYear),delta=transfer.toStage(row.peak_cfs)-transfer.toStage(threshold),level=Math.max(12,Math.min(55,40-delta*4));
 $('house-water').setAttribute('y',level);$('house-waterline').setAttribute('d',`M4 ${level}H72`);
 $('house-year').textContent=`${row.water_year} · ${valueLabel(row.peak_cfs)}`;
 $('house-status').textContent=Math.abs(delta)<1e-6?'At damage threshold':delta>0?'Above damage threshold':'Below damage threshold';
}
const peakDate=date=>new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
function showPeak(target){
 const row=rows.find(r=>r.water_year===Number(target.dataset.year)),tip=$('peak-tooltip');
 selectedYear=row.water_year;updateHouse();
 tip.replaceChildren();
 const date=document.createElement('strong'),detail=document.createElement('span');
 date.textContent=(view==='stage'?'Flow peak · ':'')+peakDate(row.peak_date);detail.textContent=`${view==='stage'?'Estimated stage · ':''}${valueLabel(row.peak_cfs)} · Water year ${row.water_year}`;
 tip.append(date,detail);tip.hidden=false;
 const dot=target.querySelector('circle').getBoundingClientRect(),box=tip.getBoundingClientRect();
 tip.style.left=Math.max(8,Math.min(innerWidth-box.width-8,dot.left+dot.width/2-box.width/2))+'px';
 tip.style.top=(dot.top-box.height-12>8?dot.top-box.height-12:dot.bottom+12)+'px';
}
function draw(){
 if(!rows.length)return;
 $('peak-tooltip').hidden=true;
 const host=$('history-chart'),w=Math.max(host.clientWidth,760),h=host.clientHeight,fs=parseFloat(getComputedStyle(host).fontSize),left=fs*4.6,right=24,top=38;
 const step=(w-left-right)/(2025-start),stagger=step<14,bottom=stagger?94:56,axisMax=view==='stage'?70:120000;
 const x=yr=>left+(yr-start)*step,y=q=>top+(1-(q===0?0:displayValue(q))/axisMax)*(h-top-bottom);
 const text=(x,y,s,anchor='middle',color='#55736b')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}">${s}</text>`;
 const record=rows.filter(r=>r.water_year>=start),selected=new Set(H.summarize(rows,threshold,start,season).rows.map(r=>r.water_year));
 let svg='';
 for(const row of record){
  const yr=row.water_year,px=x(yr),offset=stagger?(yr-start)%2*36:0,active=selected.has(yr);
  svg+=`<path d="M${px} ${top}V${y(0)+6+offset}" stroke="${yr%10===0?'#cbd9d1':'#edf1ee'}"/>`;
  svg+=`<text class="year-label" transform="translate(${px},${y(0)+10+offset}) rotate(90)" dominant-baseline="central" fill="${active?'#274f4c':'#8b9b95'}" font-size="12" font-weight="${yr%10===0?700:500}">${yr}</text>`;
 }
 for(const tick of view==='stage'?[0,10,20,30,40,50,60,70]:[0,30000,60000,90000,120000]){const py=top+(1-tick/axisMax)*(h-top-bottom);svg+=`<path class="grid-line" d="M${left} ${py}H${w-right}" stroke="#dce6df"/>`+text(left-8,py+4,view==='stage'?tick:tick/1000+'k','end');}
 for(const row of record){
  const active=selected.has(row.water_year),color=row.el_nino_winter===true?'#a67b38':row.el_nino_winter===false?'#267972':'#aab7b2';
  svg+=`<g opacity="${active?1:.14}"><path d="M${x(row.water_year)} ${y(0)}V${y(row.peak_cfs)}" stroke="${color}" stroke-width="${active&&row.peak_cfs>=threshold?2.5:1.2}"/><circle cx="${x(row.water_year)}" cy="${y(row.peak_cfs)}" r="${row.water_year===2019?5:3}" fill="${color}" ${row.water_year===2019?'stroke="#fff" stroke-width="1.5"':''}/></g>`;
 }
 svg+=`<path d="M${left} ${y(threshold)}H${w-right}" stroke="#996c2c" stroke-width="2" stroke-dasharray="7 4"/>`;
 // Label the largest selected peaks, keeping the 2019 reference visible in its subset.
 const peaks=record.filter(r=>selected.has(r.water_year)).sort((a,b)=>b.peak_cfs-a.peak_cfs).slice(0,6);
 const reference=record.find(r=>r.water_year===2019&&selected.has(2019));if(reference&&!peaks.includes(reference))peaks.push(reference);
 const placed=[],labelW=86,labelH=34;
 for(const row of peaks){
  const px=x(row.water_year),py=y(row.peak_cfs);
  let box;
  for(const dy of [-labelH-9,-labelH-46,12,48]){
   for(const dx of [-labelW/2,-labelW-12,12]){
    const candidate={x:Math.max(left,Math.min(w-right-labelW,px+dx)),y:py+dy};
    if(candidate.y<top+5||candidate.y+labelH>y(0)-5)continue;
    if(!placed.some(p=>candidate.x<p.x+labelW+6&&candidate.x+labelW+6>p.x&&candidate.y<p.y+labelH+4&&candidate.y+labelH+4>p.y)){box=candidate;break;}
   }
   if(box)break;
  }
  if(!box)continue;
  placed.push(box);
  const color=row.water_year===2019?'#8c6026':'#244e49',bx=box.x+labelW/2,by=box.y;
  svg+=`<g class="peak-label" data-year="${row.water_year}"><path d="M${px} ${py}L${bx} ${by+labelH/2}" stroke="${color}" stroke-width="1"/><rect x="${box.x}" y="${by}" width="${labelW}" height="${labelH}" rx="4" fill="white" fill-opacity=".94"/><text x="${bx}" y="${by+13}" text-anchor="middle" fill="${color}" font-size="13" font-weight="700">${row.water_year}</text><text x="${bx}" y="${by+28}" text-anchor="middle" fill="${color}" font-size="11">${valueLabel(row.peak_cfs)}</text></g>`;
 }
 svg+=text(left,14,view==='stage'?'Estimated Guerneville stage · ft':'Flow · cfs','start')+text(w-right,14,'House damage threshold · '+valueLabel(threshold),'end','#8c6026')+text(left+(w-left-right)/2,h-3,'Water year');
 // Wide transparent hit areas make the small peaks easy to inspect with mouse or touch.
 for(const row of record){
  const px=x(row.water_year),py=y(row.peak_cfs),label=`${view==='stage'?'Estimated stage · ':''}${valueLabel(row.peak_cfs)} · Flow peak ${peakDate(row.peak_date)} · Water year ${row.water_year}`;
  svg+=`<g class="peak-hit" data-year="${row.water_year}" tabindex="0" role="button" aria-label="${label}" aria-describedby="peak-tooltip"><path d="M${px} ${y(0)}V${py}" stroke="transparent" stroke-width="${Math.max(8,step*.8)}"/><circle cx="${px}" cy="${py}" r="${Math.max(5,Math.min(9,step*.45))}" fill="transparent"/></g>`;
 }
 host.innerHTML=`<svg style="min-width:${w}px" viewBox="0 0 ${w} ${h}" role="group" aria-label="Annual peak ${view==='stage'?'estimated stage':'flow'}, ${start} to 2025; every water year labeled; ${season==='all'?'all years':season==='el_nino'?'El Niño years':'other years'} highlighted; threshold ${valueLabel(threshold)}"><g font-family="system-ui,sans-serif" font-size="${fs}">${svg}</g></svg>`;
 for(const target of host.querySelectorAll('.peak-hit')){
  target.onpointerenter=()=>showPeak(target);target.onfocus=()=>showPeak(target);target.onclick=()=>showPeak(target);
  target.onpointerleave=target.onblur=()=>{$('peak-tooltip').hidden=true;};
  target.onkeydown=e=>{if(e.key==='Escape')$('peak-tooltip').hidden=true;else if(e.key==='Enter'||e.key===' '){e.preventDefault();showPeak(target);}};
 }
 host.onscroll=()=>{$('peak-tooltip').hidden=true;};
}
function render(){
 if(selectedYear<start)selectedYear=2019;
 for(const id of ['threshold-slider','threshold-number']){const input=$(id);input.min=view==='stage'?transfer.minStage.toFixed(2):500;input.max=view==='stage'?transfer.maxStage.toFixed(2):120000;input.step=view==='stage'?.01:500;input.value=view==='stage'?transfer.toStage(threshold).toFixed(2):Number(threshold.toFixed(2));}
 $('threshold-unit').textContent=view==='stage'?'ft':'cfs';$('chart-title').textContent=view==='stage'?'Annual peak river level':'Annual peak river flow';
 for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===view));
 updateHouse();$('error').hidden=true;
 for(const name of ['all','el_nino','other']){const s=H.summarize(rows,threshold,start,name);$(name+'-rate').textContent=s.p===null?'—':pct(s.p);$(name+'-count').textContent=`${s.k} of ${s.n} years reached this level`;}
 for(const b of document.querySelectorAll('[data-season]'))b.setAttribute('aria-pressed',String(b.dataset.season===season));links();draw();
 try{localStorage.setItem(storeKey,JSON.stringify({threshold,start,season}));}catch{}
}
async function init(){
 const responses=await Promise.all(['data/research/flood_enso_history.json?v=1','data/research/history_stage_transfer.json?v=1'].map(url=>fetch(url)));if(responses.some(r=>!r.ok))throw Error('The flow record could not load. Please reload.');
 const [history,stageData]=await Promise.all(responses.map(r=>r.json()));rows=history.annual_peaks;transfer=H.stageTransfer(stageData);
 try{const saved=JSON.parse(localStorage.getItem(storeKey));if(saved){if(H.validThreshold(saved.threshold))threshold=saved.threshold;if([1940,1984].includes(saved.start))start=saved.start;if(['all','el_nino','other'].includes(saved.season))season=saved.season;}}catch{}
 if(query.has('threshold')&&H.validThreshold(Number(query.get('threshold'))))threshold=Number(query.get('threshold'));if(query.get('period')==='modern')start=1984;else if(query.get('period')==='full')start=1940;
 if(['all','el_nino','other'].includes(query.get('season')))season=query.get('season');
 $('record').value=start;$('record').onchange=e=>{start=Number(e.target.value);render();};
 const readThreshold=value=>view==='stage'?transfer.toFlow(value):value;
 $('threshold-slider').oninput=e=>{threshold=readThreshold(Number(e.target.value));render();};
 $('threshold-number').oninput=e=>{const n=e.target.value.trim()===''?NaN:Number(e.target.value);if(Number.isFinite(n)&&(view==='stage'?n>=Number(transfer.minStage.toFixed(2))&&n<=Number(transfer.maxStage.toFixed(2)):H.validThreshold(n))){threshold=readThreshold(n);render();}else{$('error').textContent=view==='stage'?`Enter a stage from ${transfer.minStage.toFixed(2)} to ${transfer.maxStage.toFixed(2)} ft.`:'Enter a threshold from 500 to 120,000 cfs.';$('error').hidden=false;for(const name of ['all','el_nino','other']){$(name+'-rate').textContent='—';$(name+'-count').textContent='';}}};
 for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{view=b.dataset.view;render();};
 $('reference').onclick=()=>{selectedYear=2019;threshold=rows.find(r=>r.water_year===2019).peak_cfs;render();};for(const b of document.querySelectorAll('[data-season]'))b.onclick=()=>{season=b.dataset.season;render();};
 window.addEventListener('scroll',()=>{$('peak-tooltip').hidden=true;},true);
 new ResizeObserver(draw).observe($('history-chart'));render();
}
init().catch(e=>{$('error').hidden=false;$('error').textContent=e.message;});
