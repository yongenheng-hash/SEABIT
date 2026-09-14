'use strict';
const M=MarketCore,$=s=>document.querySelector(s);let data;
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const svgEl=(tag,attrs,text)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
const sourceURL=url=>{try{const u=new URL(url);return u.protocol==='https:'?u.href:null;}catch{return null;}};
function chart(host,rows,title,curve=false){
 host.replaceChildren();if(!rows.length){const p=el('p','No observations available for this chart. See source coverage below.');p.className='empty-chart';host.append(p);return;}
 const svg=svgEl('svg',{viewBox:'0 0 1000 300',role:'img','aria-label':title});svg.append(svgEl('title',{},title));
 const xs=rows.map(r=>curve?r.x:Date.parse(r.date+'T00:00:00Z')),ys=rows.map(r=>r.value);
 let min=Math.min(...ys),max=Math.max(...ys);const pad=(max-min)*.15||.25;min-=pad;max+=pad;
 const x=v=>65+(v-Math.min(...xs))/(Math.max(...xs)-Math.min(...xs)||1)*900,y=v=>250-(v-min)/(max-min)*210;
 for(let i=0;i<5;i++){const value=min+(max-min)*i/4;svg.append(svgEl('line',{x1:65,x2:965,y1:y(value),y2:y(value),stroke:'#e0e5eb'}),svgEl('text',{x:53,y:y(value)+4,'text-anchor':'end'},M.fmt(value)));}
 svg.append(svgEl('polyline',{points:rows.map((r,i)=>`${x(xs[i])},${y(r.value)}`).join(' '),fill:'none',stroke:'#155dcc','stroke-width':2.5,'stroke-linejoin':'round'}));
 rows.forEach((r,i)=>{const circle=svgEl('circle',{cx:x(xs[i]),cy:y(r.value),r:curve||rows.length===1?4:2,fill:'#155dcc'});circle.append(svgEl('title',{},`${curve?r.label:r.date}: ${M.fmt(r.value,4)}`));svg.append(circle);});
 const indexes=curve?rows.map((_,i)=>i):[0,Math.floor((rows.length-1)/2),rows.length-1];
 let lastLabel=-Infinity;[...new Set(indexes)].forEach(i=>{const pos=x(xs[i]);if(curve&&pos-lastLabel<65&&i!==rows.length-1)return;lastLabel=pos;svg.append(svgEl('text',{x:pos,y:280,'text-anchor':i===0?'start':i===rows.length-1?'end':'middle'},curve?rows[i].label:rows[i].date));});
 host.append(svg);
}
function renderHistory(){
 const s=data.series.find(s=>s.id===$('#indicator').value);if(!s){chart($('#history-chart'),[],'No data');$('#chart-note').textContent='';return;}
 let rows=M.points(s);const days=$('#history').value;if(days!=='all'&&rows.length)rows=rows.filter(p=>p.date>=M.shift(rows.at(-1).date,Number(days)));
 chart($('#history-chart'),rows,`${s.label}, ${s.unit}. ${rows.length} observations.`);
 $('#chart-note').textContent=`${s.unit} · ${s.frequency} · ${M.health(s)}. ${s.note||''} ${rows.length<2?'History needs at least two observations to show a trend.':''}`;
}
function render(){
 const country=$('#country').value,days=Number($('#period').value),series=data.series.filter(s=>s.country===country);
 $('#country-note').textContent=country==='SG'?'Singapore: exchange-rate-based monetary policy. USD/SGD below is a derived BNM quote; SORA and domestic releases need an official-source import.':country==='MY'?'Malaysia: OPR is the policy rate. The overnight interbank series is separate from MYOR. BNM history accumulates as daily updates run.':'United States: the Fed target is a range; EFFR is the effective overnight market rate. Treasury figures are daily par yields.';
 $('#commentary').hidden=false;$('#commentary').href='research.html?market='+country+'&days='+days+'&checked='+encodeURIComponent(data.checked_at);$('#commentary').target='_blank';$('#commentary').rel='noopener';
 $('#highlights').replaceChildren();
 const wanted={US:['us_target_high','us_yield_10y','us_cpi','us_gdp'],MY:['my_opr','my_fx_usd','my_cpi','my_gdp'],SG:['sg_sora','sg_fx_usd','sg_cpi','sg_gdp']}[country];
 for(const id of wanted){const s=series.find(s=>s.id===id),c=M.comparison(s,days),box=el('div');box.className='highlight';box.append(el('p',s.label),el('strong',c.last?M.fmt(c.last.value,s.category==='fx'?4:2)+(s.unit==='%'?'%':''):'—'),el('small',c.last?`${c.last.date} · ${M.health(s)}`:'Connection pending'));$('#highlights').append(box);}
 const current=$('#indicator').value;$('#indicator').replaceChildren();for(const s of series){const o=el('option',s.label+(!s.observations.length?' · unavailable':''));o.value=s.id;$('#indicator').append(o);}if(series.some(s=>s.id===current))$('#indicator').value=current;else $('#indicator').value=series.find(s=>s.observations.length)?.id||series[0].id;renderHistory();
 const yields=series.filter(s=>s.category==='yield'),dates=yields.flatMap(s=>M.points(s).map(p=>p.date)).sort(),date=dates.at(-1);
 const curve=yields.map(s=>{const p=M.points(s).find(p=>p.date===date);return p?{...p,x:s.tenor,label:s.tenor<1?(s.tenor*12)+'M':s.tenor+'Y'}:null;}).filter(Boolean).sort((a,b)=>a.x-b.x);
 $('#curve-date').textContent=date||'Awaiting official observations';chart($('#curve-chart'),curve,`${M.countries[country]} government yield curve ${date||''}, percent`,true);
 $('#ledger').replaceChildren();for(const s of series){const c=M.comparison(s,days),tr=el('tr'),name=el('td'),link=el('a',s.label);const url=sourceURL(s.source_url);if(url){link.href=url;link.target='_blank';link.rel='noopener noreferrer';}name.append(link);tr.append(name,el('td',c.last?M.fmt(c.last.value,s.category==='fx'?4:2)+' '+s.unit:'—'),el('td',c.last?.date||'—'),el('td',c.delta==null?'—':(c.delta>0?'+':'')+M.fmt(c.delta)+' '+c.deltaUnit),el('td',c.prior?.date||'Insufficient history'),el('td',M.health(s)));$('#ledger').append(tr);}
 $('#sources-health').replaceChildren();for(const s of series){const p=el('div');p.className='source-health';p.append(el('strong',s.label+' — '+M.health(s)),el('div',s.note||''),el('div','Last successful collection: '+(s.last_success||'none')+(s.error?' · '+s.error:'')));$('#sources-health').append(p);}
 $('#csv').disabled=false;
}
$('#country').onchange=()=>data&&render();$('#period').onchange=()=>data&&render();$('#indicator').onchange=()=>data&&renderHistory();$('#history').onchange=()=>data&&renderHistory();
$('#csv').onclick=()=>{const cell=x=>'"'+String(x??'').replaceAll('"','""')+'"';const rows=[['series_id','label','date','value','unit','source_url','method']];for(const s of data.series.filter(s=>s.country===$('#country').value))for(const p of M.points(s))rows.push([s.id,s.label,p.date,p.value,s.unit,p.source_url||s.source_url,p.method||'official source']);const url=URL.createObjectURL(new Blob([rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv'}));const a=el('a');a.href=url;a.download='SEABIT-'+$('#country').value+'-observations.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
(async()=>{try{const r=await fetch('markets.json',{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error();data=await r.json();if(data.schema_version!==1||!Array.isArray(data.series))throw Error();const checked=new Date(data.checked_at),old=(Date.now()-checked)/86400000>2;$('#load-status').textContent=`Last collection check: ${checked.toLocaleString()}. ${old?'Collection is overdue; displayed observations may be old.':'Individual observation dates are shown below.'}`;render();}catch{$('#load-status').textContent='Market data could not be loaded. Run the Update SEABIT markets workflow, then reload this page.';}})();
