'use strict';
const BASE = 'https://loltsvobibvrbjboezax.supabase.co';
const KEY = 'sb_publishable_puHfRsYmiwMXxReV_-bEaw_Cox74CCq';
const $ = s => document.querySelector(s);
const fields = [
 ['event','What happened?','Record the date, measure, magnitude and source.'],
 ['reaction','Immediate market reaction','Separate observed price changes from your explanation.'],
 ['triggers','Immediate triggers','What new information arrived, and when?'],
 ['mechanism','Economic mechanism','Explain each link in the causal chain using precise terminology.'],
 ['alternatives','Competing explanations & qualifications','What else could explain this? What would contradict your account?'],
 ['implications','Who is affected, and how?','Trace transmission channels and distinguish horizons.'],
 ['watch','What to watch next','Specify indicators and conditional scenarios, not certain predictions.'],
 ['notes','Personal notes & open questions','Private working thoughts. Not approved public copy.']
];
let session=null, cases=[], current=null, dirty=false, busy=false, news=[];
function message(t){$('#message').textContent=t;}
function changed(){dirty=true;$('#save-state').textContent='Unsaved changes';}
function safeURL(s){try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
function make(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;}
function discard(){return !dirty||confirm('Discard unsaved edits? Export this draft first if you need a copy.');}
function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=make('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function request(path,method='GET',body,authenticated=true){
 const headers={apikey:KEY,'Content-Type':'application/json'};
 if(authenticated){
  if(!session)throw Error('Sign in to access your workspace.');
  if(Date.now()>session.expires_at*1000-30000){
   const refresh=await request('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:session.refresh_token},false);
   session={...refresh,expires_at:refresh.expires_at||Date.now()/1000+refresh.expires_in};
  }
  headers.Authorization='Bearer '+session.access_token;
 }
 if(path.startsWith('/rest/'))headers.Prefer='return=representation';
 const r=await fetch(BASE+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 const text=await r.text();let data;try{data=text?JSON.parse(text):null;}catch{throw Error('Unexpected server response. Your draft is unchanged.');}
 if(!r.ok)throw Error(data?.msg||data?.message||data?.error_description||'Request failed. Check the connection and database setup.');
 return data;
}
async function run(fn){if(busy)return;busy=true;document.querySelectorAll('button,input,textarea,select').forEach(b=>b.disabled=true);try{await fn();}catch(e){message(e.message);}finally{busy=false;document.querySelectorAll('button,input,textarea,select').forEach(b=>b.disabled=false);}}
function renderCases(){const host=$('#cases');host.replaceChildren();if(!cases.length)host.append(make('p','No saved cases yet.'));for(const c of cases){const b=make('button',c.title);b.className='case'+(current?.id===c.id?' selected':'');b.append(make('small',c.body.status||'Researching'));b.onclick=()=>{if(!busy&&discard())openCase(c);};host.append(b);}}
function draft(){const form=$('#editor');const body={...current.body};for(const [key] of fields)body[key]=form.elements[key].value;body.status=form.elements.status.value;body.concepts=form.elements.concepts.value;body.sources=current.body.sources||[];body.claims=[...$('#claims').children].map(row=>({claim:row.querySelector('[data-claim]').value,evidence:row.querySelector('[data-evidence]').value,confidence:row.querySelector('select').value}));return {...current,title:form.elements.title.value.trim(),body};}
function addClaim(value={}){const row=make('div');row.className='claim';for(const [key,label] of [['claim','Claim'],['evidence','Evidence / source URL / counterevidence']]){const l=make('label',label),input=make('textarea');input.dataset[key]='';input.value=value[key]||'';l.append(input);row.append(l);}const l=make('label','Confidence'),select=make('select');for(const s of ['Unassessed','Low','Medium','High'])select.add(new Option(s,s));select.value=value.confidence||'Unassessed';l.append(select);row.append(l);$('#claims').append(row);}
function renderSources(){const host=$('#sources');host.replaceChildren();for(const s of current.body.sources||[]){const row=make('div');row.className='source';const link=make('a',s.title||s.url);const url=safeURL(s.url);if(url){link.href=url;link.target='_blank';link.rel='noopener noreferrer';}row.append(link,make('br'),make('small',[s.source,s.ts].filter(Boolean).join(' · ')));host.append(row);}}
function openCase(value){current=structuredClone(value);dirty=false;$('#empty').hidden=true;$('#editor').hidden=false;const f=$('#editor');f.elements.title.value=current.title;f.elements.status.value=current.body.status||'Researching';f.elements.concepts.value=current.body.concepts||'';for(const [key]of fields)f.elements[key].value=current.body[key]||'';$('#claims').replaceChildren();for(const c of current.body.claims||[])addClaim(c);$('#source-title').value='';$('#source-url').value='';renderSources();renderCases();$('#save-state').textContent=current.revision?'Saved revision '+current.revision:'New unsaved case';}
async function loadCases(){const all=[];for(let offset=0;;offset+=500){const rows=await request('/rest/v1/seabit_cases?select=*&order=updated_at.desc,id.asc&limit=500&offset='+offset);all.push(...rows);if(rows.length<500)break;}cases=all;renderCases();}
function attach(item){if(!current){openCase({id:crypto.randomUUID(),title:item.title||'',body:{sources:[],claims:[]}});}const existing=current.body.sources||[];const candidates=Array.isArray(item.sources)?item.sources:[item];for(const s of candidates){const url=safeURL(s.url);if(url&&!existing.some(x=>x.url===url))existing.push({title:s.title||item.title,url,source:s.source||item.source,ts:s.ts||item.ts});}current.body.sources=existing;renderSources();changed();message('Source attached to the open case. Save to cloud to keep it.');}
function renderNews(){const q=$('#news-search').value.toLowerCase();const host=$('#news');host.replaceChildren();const selected=new URLSearchParams(location.search).get('article');for(const item of news.filter(i=>(i.title||'').toLowerCase().includes(q)).slice(0,100)){const row=make('div');row.className='news-item';const text=make('div');const a=make('a',item.title);const url=safeURL(item.url);if(url){a.href=url;a.target='_blank';a.rel='noopener noreferrer';}text.append(a,make('div',[item.source,item.ts].filter(Boolean).join(' · ')));const b=make('button',selected===item.id?'Attach selected article':'Attach to case');b.onclick=()=>{if(!busy)attach(item);};row.append(text,b);host.append(row);}if(!host.children.length)host.append(make('p','No matching articles. You can attach a source URL manually.'));}
async function loadNews(){try{const r=await fetch('feed.json',{cache:'no-store'});if(!r.ok)throw Error();const data=await r.json();news=Array.isArray(data)?data:data.items;if(!Array.isArray(news))throw Error();$('#feed-status').textContent=data.generated?'Feed generated '+new Date(data.generated).toLocaleString():'Feed generation time unavailable.';renderNews();}catch{$('#feed-status').textContent='Live feed unavailable. No sample news is substituted. Add source links manually, or run the existing feed workflow.';}}
for(const [key,title,hint]of fields){const l=make('label',title),a=make('textarea');a.name=key;a.placeholder=hint;l.append(a);$('#analysis-fields').append(l);}
$('#login').onsubmit=e=>{e.preventDefault();run(async()=>{const password=$('#password').value;$('#password').value='';const data=await request('/auth/v1/token?grant_type=password','POST',{email:$('#email').value.trim(),password},false);session={...data,expires_at:data.expires_at||Date.now()/1000+data.expires_in};$('#login-panel').hidden=true;$('#workspace').hidden=false;$('#logout').hidden=false;message('Signed in. Loading your cases…');await loadCases();message('Workspace connected. Save explicitly; use Refresh to retrieve changes from another device.');await loadNews();});};
$('#editor').addEventListener('input',changed);
$('#editor').onsubmit=e=>{e.preventDefault();run(async()=>{const value=draft();if(!value.title)throw Error('Give this case a title first.');const path='/rest/v1/seabit_cases'+(value.revision?'?id=eq.'+value.id+'&revision=eq.'+value.revision:'');const payload={title:value.title,body:value.body};if(!value.revision)payload.id=value.id;$('#save-state').textContent='Saving…';try{const rows=await request(path,value.revision?'PATCH':'POST',payload);if(!rows?.length)throw Error('This case changed on another device. Export this draft, then Refresh to load the newer version. Nothing was overwritten.');cases=cases.filter(c=>c.id!==rows[0].id);cases.unshift(rows[0]);openCase(rows[0]);message('Saved to cloud. Available on your other devices.');}catch(e){$('#save-state').textContent='Not saved — draft retained';throw e;}});};
$('#new').onclick=()=>{if(discard())openCase({id:crypto.randomUUID(),title:'',body:{sources:[],claims:[]}});};
$('#refresh').onclick=()=>{if(discard())run(async()=>{const id=current?.id;await loadCases();const c=cases.find(c=>c.id===id);if(c)openCase(c);else{current=null;dirty=false;$('#editor').hidden=true;$('#empty').hidden=false;}message('Loaded latest saved cases.');});};
$('#add-claim').onclick=()=>{addClaim();changed();};
$('#add-source').onclick=()=>{const url=safeURL($('#source-url').value);if(!url){message('Enter a complete http or https source URL.');return;}attach({title:$('#source-title').value||url,url});$('#source-title').value='';$('#source-url').value='';};
$('#export-draft').onclick=()=>download('SEABIT-draft.json',{format:'seabit-research-v1',exported:new Date().toISOString(),case:draft()});
$('#backup').onclick=()=>run(async()=>{await loadCases();download('SEABIT-research-backup.json',{format:'seabit-research-v1',exported:new Date().toISOString(),cases});message('Exported saved cases. Unsaved edits require Export this draft. Keep downloaded notes private.');});
$('#logout').onclick=()=>{if(discard())run(async()=>{let remote=true;try{await request('/auth/v1/logout?scope=local','POST');}catch{remote=false;}session=null;cases=[];current=null;dirty=false;$('#cases').replaceChildren();$('#editor').reset();$('#claims').replaceChildren();$('#sources').replaceChildren();$('#editor').hidden=true;$('#empty').hidden=false;$('#workspace').hidden=true;$('#logout').hidden=true;$('#login-panel').hidden=false;message(remote?'Signed out.':'Cleared this tab. Server sign-out could not be confirmed; close this tab.');});};
$('#news-search').oninput=renderNews;
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
