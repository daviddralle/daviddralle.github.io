/* Window summaries. VWC input is percent; layer thickness is centimetres. */
(function(root){
'use strict';
const H=3600000, finite=Number.isFinite;
const stamp=s=>Date.parse(s.replace(' ','T')+'Z');
const defaultBounds=[[0,15],[15,30],[30,45],[45,60],[60,75]];
function profile(row,offset,count){
 const values=row.slice(offset+1,offset+count+1);
 return values.length===count&&values.every(finite)?values:null;
}
function storageChange(rows,offset,start,end,bounds=defaultBounds){
 // Two-hour observations are current; never interpolate across an outage.
 const maxGap=2.5*H,n=bounds.length;
 let before=null,after=null;
 for(const row of rows){const t=stamp(row[0]);if(t<=start)before=row;if(t>=start){after=row;break;}}
 let initial=null;
 if(before&&stamp(before[0])===start){const v=profile(before,offset,n);if(v)initial={time:start,values:v,interpolated:false};}
 else if(before&&after&&stamp(after[0])-stamp(before[0])<=maxGap){
  const a=profile(before,offset,n),b=profile(after,offset,n);
  if(a&&b){const f=(start-stamp(before[0]))/(stamp(after[0])-stamp(before[0]));initial={time:start,values:a.map((v,i)=>v+(b[i]-v)*f),interpolated:true};}
 }
 if(!initial)return {value:null,reason:'No complete profile at the window start, or no valid pair within 2.5 hours bracketing it.'};
 let final=null;
 for(let i=rows.length-1;i>=0;i--){const t=stamp(rows[i][0]);if(t>end)continue;if(end-t>maxGap||t<=start)break;const v=profile(rows[i],offset,n);if(v){final={time:t,values:v};break;}}
 if(!final)return {value:null,reason:'No complete profile within 2.5 hours of the window end.'};
 const value=final.values.reduce((sum,v,i)=>sum+(v-initial.values[i])/100*(bounds[i][1]-bounds[i][0])*10,0);
 return {value,initial,final,depthCm:bounds.at(-1)[1]-bounds[0][0]};
}
function summarize(data,start,end){
 const rainIndex=data.weather.fields.indexOf('Rain_mm_Tot')+1,tempIndex=data.weather.fields.indexOf('AirT_C_Avg')+1;
 let total=0,coveredMs=0,apportioned=false,lastRain=null;
 const temperatures=[];
 for(const row of data.weather.rows){
  const t=stamp(row[0]),rain=rainIndex>0?row[rainIndex]:null;
  // Rain is an hourly interval total ending at t. Prorate only an interval
  // intersecting the selected edge, assuming uniform rainfall within that hour.
  const overlap=Math.max(0,Math.min(t,end)-Math.max(t-H,start));
  if(overlap>0&&finite(rain)&&rain>=0){total+=rain*overlap/H;coveredMs+=overlap;apportioned ||= overlap<H;if(rain>0)lastRain={time:t,value:rain};}
  const temp=tempIndex>0?row[tempIndex]:null;
  if(t>start&&t<=end&&finite(temp))temperatures.push({time:t,value:temp});
 }
 const values=temperatures.map(p=>p.value),bounds=data.soil.moisture_layer_bounds_cm||defaultBounds;
 return {start,end,rain:{value:coveredMs?total:null,coveredMs,coverage:coveredMs/(end-start),apportioned,lastRain},temperature:{min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null,latest:temperatures.at(-1)||null,count:values.length},storage:{T:storageChange(data.soil.rows,0,start,end,bounds),U:storageChange(data.soil.rows,5,start,end,bounds)}};
}
const api={summarize,storageChange};
if(typeof module==='object'&&module.exports)module.exports=api;else root.QuickStats=api;
})(typeof globalThis==='object'?globalThis:this);
