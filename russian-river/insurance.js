'use strict';
const $=id=>document.getElementById(id), M=DecisionModel;
const money=x=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(x);
const pct=x=>(100*x).toFixed(1)+'%';
const key='russian-river-binary-insurance-v2';
let data,view='frequency',result,inputs,storageAvailable=true;
function selection(){return {period:$('period').value,season:$('enso').checked?'el_nino':'all',model:$('model').value};}
function group(){const s=selection();return data.groups[s.period+'_'+s.season];}
function fit(){return group().models[$('model').value];}
function read(){return Object.fromEntries(['limit','deductible','premium','damage'].map(k=>[k,$(k).value.trim()===''?(k==='premium'?null:NaN):Number($(k).value)]));}
function set(a){for(const k of ['limit','deductible','premium','damage'])$(k).value=a[k]===null?'':a[k];}
function save(){try{localStorage.setItem(key,JSON.stringify({schema:2,inputs,selection:selection()}));$('save-status').textContent='Inputs saved in this browser.';}catch{storageAvailable=false;$('save-status').textContent='Browser storage unavailable · use Export to keep inputs.';}}
function draw(){
 const s=selection(),g=group(),f=fit(),w=Math.max(300,Math.round($('plot').clientWidth)),h=$('plot').clientHeight;
 const fontSize=parseFloat(getComputedStyle($('plot')).fontSize)||10, unit=fontSize/10;
 const l=43*unit,r=12*unit,t=15*unit,b=34*unit,W=w-l-r,H=h-t-b;
 let graphic='',legend='';const gridColor='#e2e9e4';
 const text=(x,y,v,anchor='middle',color='#637b74')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}">${v}</text>`;
 const line=(x1,y1,x2,y2,color=gridColor,dash='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
 const label=sel=>sel==='all'?'All years':sel==='el_nino'?'El Niño':'Other winters';
 if(view==='frequency'){
  $('plot-title').textContent='Annual flood exceedance';
  const x=q=>l+q/120000*W,y=p=>t+(1-p)*H;
  for(const p of [0,.25,.5,.75,1])graphic+=line(l,y(p),w-r,y(p))+text(l-7*unit,y(p)+4*unit,Math.round(p*100)+'%','end');
  for(const q of [0,30000,60000,90000,120000])graphic+=text(x(q),h-16*unit,q/1000+'k');
  const curve=(values)=>data.grid_cfs.map((q,i)=>q<=120000?`${x(q).toFixed(2)},${y(values[i]).toFixed(2)}`:null).filter(Boolean);
  const band=curve(f.band_95[0]).concat(curve(f.band_95[1]).reverse()).join(' ');
  graphic+=`<polygon points="${band}" fill="#c5e1d8" opacity=".65"/>`;
  for(const season of ['all','el_nino','other'].filter(v=>v!==s.season).concat(s.season)){
   const selected=season===s.season,color=selected?'#167b75':season==='el_nino'?'#ae8243':'#8b9f98';
   graphic+=`<polyline points="${curve(data.groups[s.period+'_'+season].models[s.model].survival).join(' ')}" fill="none" stroke="${color}" stroke-width="${selected?2.5:1.2}" ${selected?'':'stroke-dasharray="4 4"'}/>`;
   legend+=`<span style="--key:${color}">${label(season)}</span>`;
  }
  const peaks=[...g.peaks].sort((a,b)=>b-a);
  peaks.forEach((q,i)=>{if(q<=120000)graphic+=`<circle cx="${x(q)}" cy="${y((i+1)/(peaks.length+1))}" r="2.4" fill="#fff" stroke="#297e76"><title>${q.toLocaleString()} cfs; empirical plotting position ${pct((i+1)/(peaks.length+1))}</title></circle>`;});
  const q=data.threshold.hacienda_flow_cfs;
  graphic+=line(x(q),t,x(q),h-b,'#a7783c','4 3')+`<circle cx="${x(q)}" cy="${y(f.p)}" r="4.5" fill="#a7783c" stroke="white"/>`+text(Math.min(w-r-20,x(q)+7),t+10*unit,'House threshold','start','#936932');
  graphic+=text(l+W/2,h-1,'Annual peak discharge · cfs');
  legend+='<span style="--key:#c5e1d8">95% fit interval</span>';
 }else{
  $('plot-title').textContent='Observed annual peak discharge';
  const all=data.groups[s.period+'_all'],start=all.start,end=all.end,x=yr=>l+(yr-start)/(end-start)*W,y=q=>t+(1-q/115000)*H;
  for(const q of [0,50000,100000])graphic+=line(l,y(q),w-r,y(q))+text(l-7*unit,y(q)+4*unit,q/1000+'k','end');
  for(const yr of [start,Math.round((start+end)/2),end])graphic+=text(x(yr),h-16*unit,yr);
  all.years.forEach((yr,i)=>{const selected=g.years.includes(yr),c=selected?'#167b75':'#cad6d0';graphic+=line(x(yr),y(0),x(yr),y(all.peaks[i]),c)+`<circle cx="${x(yr)}" cy="${y(all.peaks[i])}" r="2.6" fill="${c}"><title>${yr}: ${all.peaks[i].toLocaleString()} cfs</title></circle>`;});
  graphic+=line(l,y(data.threshold.hacienda_flow_cfs),w-r,y(data.threshold.hacienda_flow_cfs),'#a7783c','4 3')+text(w-r,y(data.threshold.hacienda_flow_cfs)-5,'House threshold','end','#936932')+text(l+W/2,h-1,'Water year');
  legend=`<span style="--key:#167b75">${label(s.season)}</span><span style="--key:#a7783c">Modeled threshold</span>`;
 }
 $('plot').innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${$('plot-title').textContent}; ${g.n} years; fitted house flood probability ${pct(f.p)}"><g font-family="system-ui,sans-serif" font-size="${fontSize}">${graphic}</g></svg>`;
 $('plot-key').innerHTML=legend;
}
function methods(){
 const s=selection(),g=group(),f=fit(),th=data.threshold;
 $('fit-details').innerHTML=`<p>Selected fit: <b>${s.model==='gev'?'GEV / L-moments':'Gumbel / L-moments'}</b>. ${g.n} years; house-threshold exceedance probability ${pct(f.p)}; bootstrap 95% interval ${f.interval_95.map(pct).join('–')}. Observed: ${g.observed.k}/${g.n} (${pct(g.observed.p)}); exact binomial interval ${g.observed.interval_95.map(pct).join('–')}.</p><table><thead><tr><th>Year group</th><th>n</th><th>GEV</th><th>Gumbel</th><th>Observed</th></tr></thead><tbody>${['all','el_nino','other'].map(k=>{const a=data.groups[s.period+'_'+k];return `<tr><td>${k==='all'?'All years':k==='el_nino'?'El Niño':'Other winters'}</td><td>${a.n}</td><td>${pct(a.models.gev.p)}</td><td>${pct(a.models.gumbel.p)}</td><td>${a.observed.k}/${a.n}</td></tr>`;}).join('')}</tbody></table><p>Fit parameters (SciPy convention): ${Object.entries(f.parameters).map(([k,v])=>`${k} = ${v.toPrecision(6)}`).join('; ')}.</p>`;
 $('threshold-details').innerHTML=`<p>Certificate living floor: <b>${th.living_floor_ft_NAVD88.toFixed(1)} ft NAVD88</b>. Modeled Guerneville gage threshold: <b>${th.gage_stage_ft.toFixed(2)} ft</b>. Working Hacienda flow threshold: <b>${Math.round(th.hacienda_flow_cfs).toLocaleString()} cfs</b>.</p><table><thead><tr><th>2019 crossing</th><th>Hacienda flow</th><th>Selected fitted probability</th></tr></thead><tbody>${th.crossings.map((c,i)=>`<tr><td>${c.limb} · ${c.start.slice(0,16).replace('T',' ')}</td><td>${Math.round(c.flow_cfs).toLocaleString()} cfs</td><td>${pct(f.threshold_limb_probabilities[i])}</td></tr>`).join('')}</tbody></table>`;
}
function render(){
 if(!data)return;
 const s=selection(),g=group(),f=fit(),base=data.groups[s.period+'_all'].models[s.model].p;
 $('sample').textContent=`${s.model==='gev'?'GEV fit':'Gumbel fit'} · ${g.n} ${s.season==='el_nino'?'El Niño winters':'years'}`;
 $('annual-p').textContent=pct(f.p);$('annual-note').textContent=`Peak flows above threshold: ${g.observed.k} of ${g.n} years`;
 $('ten-p').textContent=pct(1-(1-f.p)*Math.pow(1-base,9));$('ten-note').textContent=s.season==='el_nino'?'El Niño first year; all-year risk thereafter':'All-year risk repeated over 10 years';
 $('threshold-note').textContent=`Modeled living-floor threshold: ${data.threshold.gage_stage_ft.toFixed(1)} ft at Guerneville · floor ${data.threshold.living_floor_ft_NAVD88.toFixed(1)} ft NAVD88`;
 draw();methods();inputs=read();
 try{
  result=M.assess(inputs,f.p,base);$('error').hidden=true;$('export').disabled=false;
  $('break-even').textContent=money(result.breakEven);$('break-even-note').textContent=result.payout?'Premium below this reduces expected cost':'No payout for the entered flood loss';$('payout').textContent=money(result.payout);$('retained').textContent=money(result.retained);$('without').textContent=money(result.without);$('with').textContent=result.withInsurance===null?'—':money(result.withInsurance);
  const max=Math.max(result.without,result.withInsurance||0,1);$('without-bar').style.width=(100*result.without/max)+'%';$('with-bar').style.width=result.withInsurance===null?'0%':(100*result.withInsurance/max)+'%';
  if(!result.payout)$('conclusion').textContent='This policy pays nothing for the entered flood loss. A positive premium increases expected annual cost.';
  else if(result.choice==='quote')$('conclusion').textContent=`Insurance reduces expected annual cost below a premium of ${money(result.breakEven)}. Enter the annual quote to compare.`;
  else if(result.choice==='equal')$('conclusion').textContent=`Both options have the same expected annual cost. Insurance reduces the flood-year repair bill by ${money(result.payout)}.`;
  else $('conclusion').textContent=`${result.choice==='insure'?'Buying insurance':'Retaining the risk'} has the lower modeled annual cost, by ${money(Math.abs(result.savings))}. Insurance reduces the flood-year repair bill from ${money(inputs.damage)} to ${money(result.retained)}.`;
  save();
 }catch(e){result=null;$('error').hidden=false;$('error').textContent=e.message;$('conclusion').textContent='Correct the policy inputs to calculate the cost comparison.';$('export').disabled=true;for(const id of ['break-even','payout','retained','without','with'])$(id).textContent='—';for(const id of ['without-bar','with-bar'])$(id).style.width='0%';}
}
async function init(){
 const stage=Number(new URLSearchParams(location.search).get('stage'));if(Number.isInteger(stage)&&stage>=32&&stage<=52)$('atlas-link').href='./?stage='+stage;
 const response=await fetch('data/research/flood_frequency.json?v=1');if(!response.ok)throw Error('Flood-frequency data could not be loaded.');data=await response.json();
 set(M.defaults);try{const saved=JSON.parse(localStorage.getItem(key));if(saved?.schema===2){M.assess(saved.inputs,.1);set(saved.inputs);if(['modern','full'].includes(saved.selection?.period))$('period').value=saved.selection.period;$('enso').checked=saved.selection?.season==='el_nino';if(['gev','gumbel'].includes(saved.selection?.model))$('model').value=saved.selection.model;}}catch{}
 for(const id of ['limit','deductible','premium','damage'])$(id).oninput=render;
 for(const id of ['period','enso','model'])$(id).onchange=render;
 $('frequency-tab').onclick=()=>{view='frequency';$('frequency-tab').setAttribute('aria-pressed','true');$('history-tab').setAttribute('aria-pressed','false');draw();};
 $('history-tab').onclick=()=>{view='history';$('history-tab').setAttribute('aria-pressed','true');$('frequency-tab').setAttribute('aria-pressed','false');draw();};
 $('methods-open').onclick=()=>$('methods').showModal();$('methods-close').onclick=()=>$('methods').close();
 for(const button of document.querySelectorAll('[data-method]'))button.onclick=()=>{for(const b of document.querySelectorAll('[data-method]')){const active=b===button;b.setAttribute('aria-pressed',String(active));$('method-'+b.dataset.method).hidden=!active;}};
 $('reset').onclick=()=>{set(M.defaults);$('period').value='modern';$('enso').checked=false;$('model').value='gev';render();};
 $('export').onclick=()=>{const record={schema:2,created:new Date().toISOString(),inputs,selection:selection(),result,frequencyFit:fit(),threshold:data.threshold,status:'Exploratory binary expected-cost scenario; provisional single-event hydraulic transfer',source:'data/research/flood_frequency.json'};$('export-text').value=JSON.stringify(record,null,2);$('copy-status').textContent='';$('export-dialog').showModal();};
 $('export-close').onclick=()=>$('export-dialog').close();$('export-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('export-text').value);$('copy-status').textContent='Copied.';}catch{$('export-text').focus();$('export-text').select();$('copy-status').textContent='Selected; use your device’s Copy command.';}};
 new ResizeObserver(draw).observe($('plot'));render();
}
init().catch(e=>{$('conclusion').textContent='Assessment unavailable.';$('error').hidden=false;$('error').textContent=e.message;$('export').disabled=true;});
