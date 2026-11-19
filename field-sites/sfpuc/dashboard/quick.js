/* Partner overview. Numeric products are built on the Pi; original data remain in Data. */
(()=>{'use strict';
const $=s=>document.querySelector(s), H=3600000, palettes={moisture:['#ffffd9','#c7e9b4','#41b6c4','#225ea8','#081d58'],temperature:['#2b59a3','#82b6c9','#f2f0e6','#e5aa65','#b4482c']};
let data,windowHours='72',charts=[],heatJobs=[],loadVersion=0,cursorTime=null;
const time=s=>Date.parse(s.replace(' ','T')+'Z'), fmt=(t,short=false)=>new Date(t).toLocaleString('en-US',{timeZone:'UTC',month:'short',day:'numeric',...(short?{}:{hour:'numeric',minute:'2-digit',hour12:false})});
const finite=Number.isFinite, display=(v,d=2)=>finite(v)?Number(v).toFixed(d):'—';
function extent(){const end=time((data.latest_display_time||data.latest_logger_time));return [windowHours==='wy'?time(data.water_year_start):end-Number(windowHours)*H,end];}
function points(rows,index,gap,factor=1){const out=[];let previous=null;for(const row of rows){const x=time(row[0]);if(previous!==null&&x-previous>gap*H)out.push({x:previous+1,y:null});out.push({x,y:finite(row[index])?row[index]*factor:null});previous=x;}return out;}
function axisTicks(start,end){const step=([1,2,3,6,12,24,48,72,168,336,720,1440].find(h=>h>=(end-start)/H/5)||2160)*H,values=[];for(let x=Math.ceil(start/step)*step;x<=end;x+=step)values.push(x);return values;}
// All response panels reserve the same horizontal margins, independent of y units.
const responseIds=new Set(['rain-chart','rain-T-chart','rain-U-chart','sap-chart','soil-T-chart','soil-U-chart','vpd-chart','solar-chart']);
const sharedCursor={
 id:'sharedCursor',
 afterEvent(chart,args){
  if(!responseIds.has(chart.canvas.id)||args.replay)return;
  const e=args.event,a=chart.chartArea;
  const inside=e.type!=='mouseout'&&e.x>=a.left&&e.x<=a.right&&e.y>=a.top&&e.y<=a.bottom;
  cursorTime=inside?chart.scales.x.getValueForPixel(e.x):null;
  $('#response-time').textContent=cursorTime===null?'Fixed PST':fmt(cursorTime)+' · PST';
  for(const other of charts)if(other!==chart&&responseIds.has(other.canvas.id))other.draw();
  args.changed=true;
 },
 afterDraw(chart){
  if(cursorTime===null||!responseIds.has(chart.canvas.id))return;
  const x=chart.scales.x.getPixelForValue(cursorTime),a=chart.chartArea,c=chart.ctx;
  if(x<a.left||x>a.right)return;
  c.save();c.beginPath();c.setLineDash([3,3]);c.strokeStyle='#d5e5e9aa';c.lineWidth=1;c.moveTo(x,a.top);c.lineTo(x,a.bottom);c.stroke();c.restore();
 }
};
function line(id,datasets,unit,limits={}){
 const [start,end]=extent(),shared=responseIds.has(id),bottom=id.startsWith('rain-');
 const visible=datasets.map(s=>{
  let first=s.data.findIndex(p=>p.x>=start);if(first<0)first=s.data.length;
  let last=s.data.findIndex(p=>p.x>end);if(last<0)last=s.data.length;
  return {...s,data:s.data.slice(Math.max(0,first-1),Math.min(s.data.length,last+1))};
 });
 const c=new Chart($('#'+id),{
  type:'line',plugins:[sharedCursor],
  data:{datasets:visible.map((s,i)=>({borderWidth:1.8,pointRadius:s.data.filter(p=>finite(p.y)).length<3?3:0,pointHitRadius:7,spanGaps:false,tension:0,borderColor:['#72c8cc','#dcb575','#b8a4d7'][i%3],...s}))},
  options:{responsive:true,maintainAspectRatio:false,animation:false,parsing:false,
   layout:{autoPadding:!shared,padding:shared?{right:12,top:2}:0},
   interaction:{mode:'nearest',axis:'x',intersect:false},
   plugins:{legend:{display:datasets.length>1,position:'top',align:'start',labels:{color:'#b6c7ca',boxWidth:7,boxHeight:7,usePointStyle:true,pointStyle:'circle',padding:7,font:{size:11}}},tooltip:{callbacks:{title:items=>fmt(items[0].parsed.x)+' · PST',label:item=>item.dataset.label+': '+display(item.parsed.y,3)+' '+unit}}},
   scales:{
    x:{type:'linear',min:start,max:end,afterBuildTicks:axis=>{axis.ticks=axisTicks(start,end).map(value=>({value}));},
     grid:{display:shared,color:'#b0c5cf12',drawTicks:!shared||bottom},border:{display:!shared||bottom},
     ticks:{display:!shared||bottom,color:'#a4b6ba',autoSkip:false,maxRotation:0,font:{size:11},callback:v=>(end-start)>=72*H?fmt(v,true):[fmt(v,true),new Date(v).toLocaleTimeString('en-US',{timeZone:'UTC',hour:'2-digit',minute:'2-digit',hour12:false})]}},
    y:{...limits,afterFit:axis=>{if(shared)axis.width=54;},grid:{color:'#b0c5cf10'},ticks:{color:'#a4b6ba',maxTicksLimit:5,font:{size:11}}}
   }
  }
 });charts.push(c);
}
// FAO saturation vapor pressure in kPa, evaluated at hourly mean T and RH.
function vpd(t,rh){return finite(t)&&finite(rh)&&t>-100&&t<100&&rh>=0&&rh<=100?.6108*Math.exp(17.27*t/(t+237.3))*(1-rh/100):null;}
function scaleRange(offset,count,type){let lo=Infinity,hi=-Infinity;const factor=type==='moisture'?.01:1;for(const row of data.soil.rows)for(let i=offset+1;i<=offset+count;i++)if(finite(row[i])){lo=Math.min(lo,row[i]*factor);hi=Math.max(hi,row[i]*factor);}if(!finite(lo))return type==='moisture'?[0,.5]:[0,30];const step=type==='moisture'?.01:1;lo=Math.floor(lo/step)*step;hi=Math.ceil(hi/step)*step;if(hi<=lo)hi=lo+step;return [lo,hi];}
const paletteRGB=Object.fromEntries(Object.entries(palettes).map(([k,a])=>[k,a.map(s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)))]));
function color(v,range,palette){const u=Math.max(0,Math.min(1,(v-range[0])/(range[1]-range[0])))*(palette.length-1),i=Math.min(palette.length-2,Math.floor(u)),f=u-i;const a=palette[i],b=palette[i+1];return a.map((v,j)=>Math.round(v+(b[j]-v)*f));}
function lerp(a,b,f){if(f<1e-9)return finite(a)?a:null;if(f>1-1e-9)return finite(b)?b:null;return finite(a)&&finite(b)?a+(b-a)*f:null;}
function heat(canvas,offset,positions,type,range){
 const rect=canvas.getBoundingClientRect(),w=Math.max(240,Math.round(rect.width)),h=Math.round(rect.height),dpr=window.devicePixelRatio||1;canvas.width=w*dpr;canvas.height=h*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);c.clearRect(0,0,w,h);
 const left=54,top=10,pw=Math.max(1,w-left-12),ph=h-top-16,[start,end]=extent(),rows=data.soil.rows.map(r=>({x:time(r[0]),v:r.slice(offset+1,offset+positions.length+1)}));
 // Interpolate between observations; unavailable sensor values stay transparent.
 const raster=document.createElement('canvas');raster.width=pw;raster.height=ph;const rc=raster.getContext('2d'),img=rc.createImageData(pw,ph);let at=0;
 const depths=Array.from({length:ph},(_,y)=>{const depth=y/(ph-1)*75;if(type==='temperature'&&depth<positions[0])return null;const z=Math.max(positions[0],Math.min(positions.at(-1),depth));let i=0;while(i<positions.length-2&&positions[i+1]<z)i++;return [i,(z-positions[i])/(positions[i+1]-positions[i])];});
 for(let x=0;x<pw;x++){const t=start+x/(pw-1)*(end-start);while(at<rows.length-2&&rows[at+1].x<t)at++;const a=rows[at],b=rows[at+1];if(!a||!b||t<a.x||t>b.x||b.x===a.x)continue;const f=(t-a.x)/(b.x-a.x),v=a.v.map((a,i)=>lerp(a,b.v[i],f));for(let y=0;y<ph;y++){if(depths[y]===null)continue;const [i,g]=depths[y];let value=lerp(v[i],v[i+1],g);if(value===null)continue;if(type==='moisture')value*=.01;const rgb=color(value,range,paletteRGB[type]),j=(y*pw+x)*4;img.data[j]=rgb[0];img.data[j+1]=rgb[1];img.data[j+2]=rgb[2];img.data[j+3]=255;}}
 rc.putImageData(img,0,0);c.drawImage(raster,left,top);
 c.font='11px system-ui';c.textAlign='right';c.textBaseline='middle';[0,15,30,45,60,75].forEach(z=>{const y=top+z/75*ph;c.fillStyle='#a9b9bc';c.fillText(String(z),left-9,y);});
 c.strokeStyle='#405059';c.beginPath();c.moveTo(left,top);c.lineTo(left,top+ph);c.lineTo(left+pw,top+ph);c.stroke();
 c.save();c.translate(5,top+ph/2);c.rotate(-Math.PI/2);c.textAlign='center';c.textBaseline='top';c.fillText('Depth (cm)',0,0);c.restore();
 if(!rows.some(r=>r.x>=start&&r.x<=end)){c.fillStyle='#a4b6ba';c.textAlign='center';c.textBaseline='middle';c.fillText('No observations in this window',left+pw/2,top+ph/2);}
}
function placeWindowMetrics(){
 const box=$('#window-metrics'),main=$('main'),bar=$('.window-bar');
 const base=main.getBoundingClientRect(),head=$('header').getBoundingClientRect();
 const left=Math.max($('header>div:first-child').getBoundingClientRect().right,$('.window-bar>[role="group"]').getBoundingClientRect().right)+16;
 // Reserve room for the full shared-cursor timestamp, not only "Fixed PST".
 const right=Math.min($('.freshness').getBoundingClientRect().left,$('#battery-shortcut').getBoundingClientRect().left-195)-14;
 const width=right-left;
 box.hidden=width<300;
 if(box.hidden)return;
 box.style.left=(left-base.left)+'px';box.style.top=(head.top-base.top)+'px';box.style.width=width+'px';
 box.style.height=(bar.getBoundingClientRect().bottom-head.top)+'px';box.classList.toggle('compact-metrics',width<500);
}
function renderWindowMetrics(start,end){
 const stats=QuickStats.summarize(data,start,end),rain=stats.rain,temp=stats.temperature;
 const rainMissing=rain.coverage<.999999,metrics=[],details=[];
 const add=(label,value,sub,note)=>{metrics.push({label,value,sub,note});details.push(label+': '+value+'. '+note);};
 const range=fmt(start)+' to '+fmt(end)+' PST.';
 add('Rain · window',display(rain.value,1)+' mm'+(rainMissing?'*':''),rainMissing?'observed only':'recorded total',(rainMissing?'* Observed rainfall only. ':'')+range+' Available hourly rainfall covers '+display(rain.coveredMs/H,2)+' of '+display((end-start)/H,2)+' hours; missing hours are not treated as zero.'+(rain.apportioned?' Boundary hours are apportioned by overlap, assuming uniform rain within the hour.':''));
 const wet=rain.lastRain;
 add('Last wet hour',wet?display(wet.value,2)+' mm':'—',wet?fmt(wet.time):'none recorded',wet?'Most recent wet hourly interval intersecting the selected window, ending '+fmt(wet.time)+' PST. Amount is the full hourly total, not a storm total.':'No positive hourly rainfall recorded in the selected window. Missing coverage can hide rain.');
 add('Air · hourly min/max',finite(temp.min)?display(temp.min,1)+'–'+display(temp.max,1)+' °C':'—',temp.latest?'latest '+display(temp.latest.value,1)+' °C':'no observations',range+' Minimum and maximum of '+temp.count+' hourly mean temperatures; these are not instantaneous temperature extremes.'+(temp.latest?' Latest hourly mean ends '+fmt(temp.latest.time)+' PST.':''));
 for(const probe of ['T','U']){
  const s=stats.storage[probe],value=finite(s.value)?(s.value>0?'+':'')+display(s.value,1)+' mm':'—';
  const note=finite(s.value)?'Change in soil water stored over 0–'+s.depthCm+' cm: sum of layer VWC changes × layer thickness. All five layers required; zero is valid. From '+fmt(s.initial.time)+(s.initial.interpolated?' (linearly interpolated)':'')+' to '+fmt(s.final.time)+' PST. No extrapolation to the window end. Positive means storage gain.':s.reason;
  add('Δ storage · '+probe,value,finite(s.value)?'0–75 cm':'missing endpoint',note);
 }
 const box=$('#window-metrics');box.replaceChildren();
 for(const m of metrics){const el=document.createElement('div');el.className='window-metric';el.title=m.note;el.setAttribute('aria-label',m.label+': '+m.value+'. '+m.note);for(const [tag,cls,text] of [['span','metric-label',m.label],['strong','metric-value',m.value],['span','metric-sub',m.sub]]){const child=document.createElement(tag);child.className=cls;child.textContent=text;el.append(child);}box.append(el);}
 const detail=$('#window-metrics-detail');detail.replaceChildren();for(const text of details){const p=document.createElement('p');p.textContent=text;detail.append(p);}
 placeWindowMetrics();
}
function render(){if(!data)return;charts.forEach(c=>c.destroy());charts=[];heatJobs=[];cursorTime=null;$('#response-time').textContent='Fixed PST';document.querySelectorAll('[data-window]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.window===windowHours)));
 const [start,end]=extent();renderWindowMetrics(start,end);$('#through').textContent='Through '+fmt(end)+' · PST';const receipt=new Date(data.received_through_utc);$('#received').textContent='Received '+receipt.toLocaleString('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
 const sap=data.sap.sensors.map((s,i)=>({label:'Sensor '+s,data:points(data.sap.normalized_rows,i+1,3)}));line('sap-chart',sap,'',{min:0,max:1});$('#sap-empty').hidden=sap.some(s=>s.data.some(p=>p.x>=start&&p.x<=end&&finite(p.y)));
 const moisture=scaleRange(0,10,'moisture'),temp=scaleRange(10,14,'temperature');for(const [type,range,offsets,positions] of [['moisture',moisture,[0,5],(data.soil.moisture_midpoints_cm||[7.5,22.5,37.5,52.5,67.5])],['temperature',temp,[10,17],(data.soil.temperature_depths_cm||[3.5,10,20,30,45,60,75])]]){document.querySelectorAll('[data-scale="'+type+'-low"]').forEach(el=>el.textContent=display(range[0],type==='moisture'?2:0));document.querySelectorAll('[data-scale="'+type+'-high"]').forEach(el=>el.textContent=display(range[1],type==='moisture'?2:0));['T','U'].forEach((s,i)=>{const job=()=>heat($('#'+type+'-'+s),offsets[i],positions,type,range);heatJobs.push(job);job();});}
 document.querySelectorAll('[data-rain-title]').forEach(el=>el.textContent='Cumulative rainfall · WY '+data.water_year);$('#rain-note').textContent=display(data.rainfall.total_recorded_mm,1)+' mm recorded'+(data.rainfall.first_interval_end?' since '+fmt(time(data.rainfall.first_interval_end),true):'')+(data.rainfall.complete_water_year_to_latest_weather?'':' · incomplete water year');for(const id of ['rain-chart','rain-T-chart','rain-U-chart'])line(id,[{label:'Recorded rainfall',data:points(data.rainfall.rows,1,1.5),borderColor:'#79b9e3'}],'mm');
 const depths=data.soil.moisture_layer_bounds_cm||[[0,15],[15,30],[30,45],[45,60],[60,75]];
 const depthColors=['#84d9df','#79b98e','#dec17f','#d4938a','#ac9dd2'];
 for(const [probe,offset] of [['T',0],['U',5]])line('soil-'+probe+'-chart',depths.map((depth,i)=>({label:depth.join('–')+' cm',data:points(data.soil.rows,offset+i+1,Infinity,.01),borderColor:depthColors[i]})),'m³/m³',{min:moisture[0],max:moisture[1]});
 const weather=data.weather;
 const ti=weather.fields.indexOf('AirT_C_Avg')+1,ri=weather.fields.indexOf('RH_Avg')+1;
 const vpdRows=weather.rows.map(r=>[r[0],vpd(r[ti],r[ri])]);
 line('vpd-chart',[{label:'VPD',data:points(vpdRows,1,1.5),borderColor:'#d2a0ba'}],'kPa',{beginAtZero:true});for(const [id,field,title,unit,factor,color] of [['air','AirT_C_Avg','Air temperature','°C',1,'#e4ac85'],['humidity','RH_Avg','Relative humidity','%',1,'#89bfb5'],['solar','SlrFD_kW_Avg','Solar radiation','W/m²',1000,'#d6c184'],['wind','WS_ms_S_WVT','Wind speed','m/s',1,'#a2b8cd']])line(id+'-chart',[{label:title,data:points(weather.rows,weather.fields.indexOf(field)+1,1.5,factor),borderColor:color}],unit,id==='humidity'?{min:0,max:100}:{});
 const power=data.power.rows.length?[{label:'15-min mean',data:points(data.power.rows,1,.375)},{label:'15-min minimum',data:points(data.power.rows,2,.375),borderDash:[4,3]}]:[{label:'Daily minimum',data:points(data.daily_power.rows,1,36)}];$('#power-note').textContent=data.power.rows.length?'15-minute mean and minimum; the first interval after restart can be partial.':'Daily minimum only; awaiting 15-minute records.';line('power-chart',power,'V');
 const latest=data.power.rows.filter(r=>finite(r[1])).at(-1),daily=data.daily_power.rows.filter(r=>finite(r[1])).at(-1),battery=latest||daily;$('#battery-shortcut').textContent=battery?'Battery '+display(battery[1],2)+' V'+(latest?'':' · daily min'):'Battery · no readings';$('#battery-shortcut').title=battery?fmt(time(battery[0]))+' PST'+(latest&&finite(latest[2])?' · 15-min minimum '+display(latest[2],2)+' V':''):'Open battery plot';placeWindowMetrics();
}
new ResizeObserver(()=>placeWindowMetrics()).observe($('header'));
async function load(){const version=++loadVersion;try{const r=await fetch('data/quick.json',{cache:'no-cache'});if(!r.ok)throw Error(r.status);const next=await r.json();if(version!==loadVersion)return;if(next.schema_version!==1)throw Error('Unsupported data');data=next;$('#load-error').hidden=true;render();}catch(e){$('#load-error').hidden=false;$('#load-error').textContent='The latest observations could not be loaded. Any plots still visible show the previous update.';console.error(e);}}
$('#battery-shortcut').addEventListener('click',()=>{const extra=$('#extra-observations');extra.open=true;$('#battery-shortcut').setAttribute('aria-expanded','true');requestAnimationFrame(()=>{$('#power-chart').closest('article').scrollIntoView({behavior:'smooth',block:'center'});});});
$('#extra-observations').addEventListener('toggle',()=>{$('#battery-shortcut').setAttribute('aria-expanded',String($('#extra-observations').open));charts.forEach(c=>c.resize());});
document.querySelectorAll('[data-window]').forEach(b=>b.addEventListener('click',()=>{windowHours=b.dataset.window;render();}));let resize;window.addEventListener('resize',()=>{cancelAnimationFrame(resize);resize=requestAnimationFrame(()=>{heatJobs.forEach(f=>f());placeWindowMetrics();});});load();setInterval(()=>{if(!document.hidden)load();},600000);
})();
