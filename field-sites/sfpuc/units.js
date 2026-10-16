/* Canonical data stay in source/SI units; only presentation changes. */
(()=>{
  let system='metric';try{system=localStorage.getItem('sfpuc-units')==='imperial'?'imperial':'metric';}catch{}
  const definitions={temperature:['°C','°F',v=>v*9/5+32],rain:['mm','in',v=>v/25.4],length:['m','ft',v=>v/0.3048],depth:['cm','in',v=>v/2.54],distance:['km','mi',v=>v/1.609344],wind:['m/s','mph',v=>v/0.44704],vwc:['m³/m³','m³/m³',v=>v],potential:['MPa','MPa',v=>v]};
  const number=(v,type)=>system==='imperial'?definitions[type][2](Number(v)):Number(v);
  const label=type=>definitions[type][system==='imperial'?1:0];
  const format=(v,type,d=1)=>v===null||v===undefined||v===''?'Not recorded':`${number(v,type).toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:0})} ${label(type)}`;
  const html=(v,type,d=1)=>v===null||v===undefined||v===''?'Not recorded':`<span data-quantity="${type}" data-value="${Number(v)}" data-decimals="${d}">${format(v,type,d)}</span>`;
  function refresh(root=document){const els=[...(root.matches?.('[data-quantity]')?[root]:[]),...(root.querySelectorAll?.('[data-quantity]')||[])];for(const e of els){const text=format(e.dataset.value,e.dataset.quantity,Number(e.dataset.decimals??1));if(e.textContent!==text)e.textContent=text;}}
  function updateButtons(){document.querySelectorAll('[data-unit-system]').forEach(b=>{const on=b.dataset.unitSystem===system;b.setAttribute('aria-pressed',String(on));b.classList.toggle('selected',on);});}
  function set(value){if(!['metric','imperial'].includes(value))return;system=value;try{localStorage.setItem('sfpuc-units',system);}catch{}updateButtons();refresh();document.dispatchEvent(new CustomEvent('sfpuc-units-change',{detail:system}));}
  window.SFPUCUnits={get system(){return system;},number,label,format,html,refresh,set};
  document.addEventListener('DOMContentLoaded',()=>{
    updateButtons();refresh();document.querySelectorAll('[data-unit-system]').forEach(b=>b.addEventListener('click',()=>set(b.dataset.unitSystem)));
    new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)refresh(node);}).observe(document.body,{childList:true,subtree:true});
    document.querySelectorAll('[data-view-link]').forEach(a=>a.addEventListener('click',()=>{const site=['sheep-camp','maguire-ridge'].includes(location.hash.slice(1))?location.hash.slice(1):'sheep-camp';a.hash=site;}));
  });
})();
