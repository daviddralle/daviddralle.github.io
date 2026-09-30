'use strict';
const $=id=>document.getElementById(id),H=FloodHistory;
const fmt=n=>Math.round(n).toLocaleString('en-US'),pct=p=>(p*100).toFixed(1)+'%';
let rows=[],threshold=72000,start=1940,season='all';const storeKey='russian-river-flood-history-v1';
const query=new URLSearchParams(location.search),stage=Number(query.get('stage'));
function links(){const params=new URLSearchParams({threshold:String(threshold),period:start===1984?'modern':'full',season});if(Number.isInteger(stage)&&stage>=32&&stage<=52){params.set('stage',stage);$('atlas-link').href='./?stage='+stage;}$('hydrology-link').href='hydrology.html?'+params;$('data-link').href='hydrology.html?'+params+'#methods';}
function draw(){
 if(!rows.length)return;
 const host=$('history-chart'),w=Math.max(host.clientWidth,760),h=host.clientHeight,fs=parseFloat(getComputedStyle(host).fontSize),left=fs*4.6,right=24,top=38;
 const step=(w-left-right)/(2025-start),stagger=step<14,bottom=stagger?94:56;
 const x=yr=>left+(yr-start)*step,y=q=>top+(1-q/120000)*(h-top-bottom);
 const text=(x,y,s,anchor='middle',color='#55736b')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}">${s}</text>`;
 const record=rows.filter(r=>r.water_year>=start),selected=new Set(H.summarize(rows,threshold,start,season).rows.map(r=>r.water_year));
 let svg='';
 for(const row of record){
  const yr=row.water_year,px=x(yr),offset=stagger?(yr-start)%2*36:0,active=selected.has(yr);
  svg+=`<path d="M${px} ${top}V${y(0)+6+offset}" stroke="${yr%10===0?'#cbd9d1':'#edf1ee'}"/>`;
  svg+=`<text class="year-label" transform="translate(${px+4},${y(0)+10+offset}) rotate(90)" fill="${active?'#274f4c':'#8b9b95'}" font-size="12" font-weight="${yr%10===0?700:500}">${yr}</text>`;
 }
 for(const q of [0,30000,60000,90000,120000])svg+=`<path d="M${left} ${y(q)}H${w-right}" stroke="#dce6df"/>`+text(left-8,y(q)+4,q/1000+'k','end');
 for(const row of record){
  const active=selected.has(row.water_year),color=row.el_nino_winter===true?'#a67b38':row.el_nino_winter===false?'#267972':'#aab7b2';
  svg+=`<g opacity="${active?1:.14}"><title>${row.water_year}: ${fmt(row.peak_cfs)} cfs · peak ${row.peak_date} · ${row.el_nino_winter===true?'El Niño':row.el_nino_winter===false?'other winter':'unclassified'} · ${row.peak_cfs>=threshold?'at or above':'below'} threshold</title><path d="M${x(row.water_year)} ${y(0)}V${y(row.peak_cfs)}" stroke="${color}" stroke-width="${active&&row.peak_cfs>=threshold?2.5:1.2}"/><circle cx="${x(row.water_year)}" cy="${y(row.peak_cfs)}" r="${row.water_year===2019?5:3}" fill="${color}" ${row.water_year===2019?'stroke="#fff" stroke-width="1.5"':''}/></g>`;
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
    const candidate={x:Math.max(left,Math.min(w-right-labelW,px+dx)),y:Math.max(20,Math.min(y(0)-labelH,py+dy))};
    if(!placed.some(p=>candidate.x<p.x+labelW+6&&candidate.x+labelW+6>p.x&&candidate.y<p.y+labelH+4&&candidate.y+labelH+4>p.y)){box=candidate;break;}
   }
   if(box)break;
  }
  if(!box)continue;
  placed.push(box);
  const color=row.water_year===2019?'#8c6026':'#244e49',bx=box.x+labelW/2,by=box.y;
  svg+=`<g class="peak-label"><path d="M${px} ${py}L${bx} ${by+labelH/2}" stroke="${color}" stroke-width="1"/><rect x="${box.x}" y="${by}" width="${labelW}" height="${labelH}" rx="4" fill="white" fill-opacity=".94"/><text x="${bx}" y="${by+13}" text-anchor="middle" fill="${color}" font-size="13" font-weight="700">${row.water_year}</text><text x="${bx}" y="${by+28}" text-anchor="middle" fill="${color}" font-size="11">${fmt(row.peak_cfs)} cfs</text></g>`;
 }
 svg+=text(left,14,'cfs','start')+text(w-right,14,'House damage threshold · '+fmt(threshold)+' cfs','end','#8c6026')+text(left+(w-left-right)/2,h-3,'Water year');
 host.innerHTML=`<svg style="min-width:${w}px" viewBox="0 0 ${w} ${h}" role="img" aria-label="Annual peak flow, ${start} to 2025; every water year labeled; ${season==='all'?'all years':season==='el_nino'?'El Niño years':'other years'} highlighted; threshold ${fmt(threshold)} cfs"><g font-family="system-ui,sans-serif" font-size="${fs}">${svg}</g></svg>`;
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
