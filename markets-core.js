'use strict';
const MarketCore = (() => {
 const countries={US:'United States',SG:'Singapore',MY:'Malaysia'};
 const shift=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')-days*86400000).toISOString().slice(0,10);
 const valid=p=>p&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&typeof p.value==='number'&&Number.isFinite(p.value);
 const points=s=>(s.observations||[]).filter(valid).sort((a,b)=>a.date.localeCompare(b.date));
 function comparison(s,days=7){
  const rows=points(s),last=rows.at(-1);if(!last)return {last:null,prior:null,delta:null};
  // Macro releases compare with the previous reference period; markets use a calendar lookback.
  const macro=['monthly','quarterly'].includes(s.frequency);
  const prior=macro?rows.at(-2):rows.filter(p=>p.date<=shift(last.date,days)).at(-1);
  const delta=prior?(s.category==='fx'?(prior.value?(last.value/prior.value-1)*100:null):(last.value-prior.value)*(s.category==='inflation'||s.category==='growth'?1:100)):null;
  return {last,prior:prior||null,delta,deltaUnit:s.category==='fx'?'%':macro?'pp':'bp',basis:macro?'previous reference period':days+' calendar days'};
 }
 const fmt=(value,digits=2)=>value==null?'—':value.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
 function health(s,now=new Date()){
  const last=points(s).at(-1);
  if(!last)return 'Unavailable';
  if(s.status==='error')return 'Refresh failed · retained data';
  const age=(now-Date.parse(last.date+'T00:00:00Z'))/86400000;
  const limit={daily:5,monthly:80,quarterly:210,event:Infinity}[s.frequency]||5;
  if(age>limit)return 'Older observation · check source';
  if(s.status==='manual')return 'Manual import';
  if(s.status==='pending')return 'Connection pending';
  return 'Published data';
 }
 function snapshot(data,country,days){
  return {country,days,checked_at:data.checked_at,created_at:new Date().toISOString(),series:data.series.filter(s=>s.country===country).map(s=>({id:s.id,label:s.label,source_url:s.source_url,note:s.note,unit:s.unit,frequency:s.frequency,health:health(s),...comparison(s,days)}))};
 }
 function commentary(snap){
  return snap.series.map(s=>s.last?`${s.label}: ${fmt(s.last.value,s.unit==='%'?2:4)} ${s.unit} (${s.last.date}); ${s.prior?`${s.delta>=0?'+':''}${fmt(s.delta)} ${s.deltaUnit} versus ${s.prior.date} (${s.basis})`:'comparison unavailable'}. ${s.health}.`:`${s.label}: unavailable.`).join('\n');
 }
 return {countries,shift,points,comparison,fmt,health,snapshot,commentary};
})();
if(typeof module!=='undefined')module.exports=MarketCore;
