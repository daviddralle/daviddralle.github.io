(function(root){'use strict';
function validThreshold(q){return Number.isFinite(q)&&q>=500&&q<=120000;}
function summarize(rows,q,start=1940,season='all'){
 if(!validThreshold(q))throw Error('Threshold must be between 500 and 120,000 cfs.');
 const selected=rows.filter(r=>r.water_year>=start&&(season==='all'||r.el_nino_winter===(season==='el_nino')));
 const k=selected.filter(r=>r.peak_cfs>=q).length,n=selected.length;return{rows:selected,k,n,p:n?k/n:null};
}
function interpolate(xs,ys,q){if(q<=xs[0])return ys[0];for(let i=1;i<xs.length;i++)if(q<=xs[i])return ys[i-1]+(ys[i]-ys[i-1])*(q-xs[i-1])/(xs[i]-xs[i-1]);return ys.at(-1);}
function stageTransfer(data){
 const qs=data.nodes.map(n=>n.flow_cfs),ss=data.nodes.map(n=>n.stage_ft);
 if(qs.length<2||qs.some((q,i)=>!Number.isFinite(q)||!Number.isFinite(ss[i])||(i&&(q<=qs[i-1]||ss[i]<=ss[i-1]))))throw Error('Stage transfer must be finite and strictly increasing.');
 return {toStage:q=>interpolate(qs,ss,q),toFlow:s=>Math.round(interpolate(ss,qs,s)*1e6)/1e6,minStage:ss[0],maxStage:ss.at(-1)};
}
const api={validThreshold,summarize,interpolate,stageTransfer};if(typeof module==='object'&&module.exports)module.exports=api;else root.FloodHistory=api;
})(globalThis);
