/* Calendar-aligned cumulative precipitation. A missing day invalidates later totals. */
(function(root){
  const year=date=>Number(date.slice(0,4))+(date.slice(5)>='10-01'?1:0);
  const leap=y=>y%4===0&&(y%100!==0||y%400===0);
  const keys=Array.from({length:366},(_,i)=>new Date(Date.UTC(2023,9,1+i)).toISOString().slice(5,10));
  function build(daily){
    const byDate=new Map(daily.map(d=>[d.date,d]));
    if(!daily.length)return [];
    const dates=[...byDate.keys()].sort(),first=year(dates[0]),last=year(dates.at(-1));
    return Array.from({length:last-first+1},(_,i)=>{
      const wy=first+i,end=dates.at(-1)<`${wy}-09-30`?dates.at(-1):`${wy}-09-30`;
      let total=0,valid=true,missing=0,traces=0;
      const points=keys.map(key=>{
        const date=`${key>='10-01'?wy-1:wy}-${key}`;
        if(date>end)return {key,date,total:null,missing,traces,future:true};
        if(key==='02-29'&&!leap(wy))return {key,date:null,total:valid?total:null,missing,traces,calendarGap:true};
        const row=byDate.get(date);
        if(!row||row.precip_mm===null){missing++;valid=false;}else{total+=row.precip_mm;if(row.precip_trace)traces++;}
        return {key,date,total:valid?total:null,reportedSum:total,missing,traces};
      });
      return {year:wy,end,points};
    });
  }
  const median=values=>{if(!values.length)return null;const a=[...values].sort((x,y)=>x-y),i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2;};
  function compare(series,focusYear){
    const focus=series.find(s=>s.year===Number(focusYear));
    const index=keys.indexOf(focus.end.slice(5)),current=focus.points[index];
    const previous=series.filter(s=>s.year<focus.year),eligible=previous.filter(s=>s.points[index].total!==null),values=eligible.map(s=>s.points[index].total);
    return {focus,index,current,previous,eligible,median:median(values),min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null};
  }
  const api={year,keys,build,compare,median};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SFPUCWaterYears=api;
})(typeof window==='undefined'?{}:window);
