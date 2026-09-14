// Runtime tests with minimal DOM stubs; these are not browser/layout tests.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const research=fs.readFileSync(__dirname+'/../research.js','utf8');
const elements={}, doc={querySelector:s=>elements[s],querySelectorAll:()=>[]};
let calls=[];
const context=vm.createContext({document:doc,URL,AbortSignal,Date,JSON,Number,Array,String,Error,Set,Map,console,structuredClone,crypto:require('node:crypto').webcrypto,
 fetch:async(path,options)=>{calls.push({path,options});return {ok:true,text:async()=>JSON.stringify({access_token:'refreshed',refresh_token:'r2',expires_in:3600})};}});
vm.runInContext(research.slice(0,research.indexOf('for(const [key,title,hint]of fields)')),context);
const evaluate=s=>vm.runInContext(s,context);
(async()=>{
 assert.equal(evaluate("safeURL('javascript:alert(1)')"),null);
 assert.equal(evaluate("safeURL('https://example.com/report')"),'https://example.com/report');
 await assert.rejects(evaluate("request('/rest/v1/seabit_cases')"),/Sign in/);
 evaluate("session={access_token:'old',refresh_token:'r1',expires_at:0}");
 await evaluate("request('/rest/v1/seabit_cases')");
 assert.equal(calls.length,2);assert.ok(calls[0].path.includes('grant_type=refresh_token'));assert.equal(calls[1].options.headers.Authorization,'Bearer refreshed');
 elements['#save-state']={textContent:''};elements['#message']={textContent:''};
 elements['#editor']={elements:{title:{value:'Existing case'},status:{value:'Researching'},concepts:{value:'Inflation'}}};
 for(const k of ['event','reaction','triggers','mechanism','alternatives','implications','watch','notes'])elements['#editor'].elements[k]={value:'Saved '+k};
 elements['#claims']={children:[]};
 evaluate("current={id:'case-id',revision:4,title:'Existing case',body:{sources:[{url:'https://example.com/source'}],custom_field:'retain me'}}");
 const draft=evaluate('draft()');assert.equal(draft.body.notes,'Saved notes');assert.equal(draft.body.custom_field,'retain me');assert.equal(draft.body.sources.length,1);
 // Run the real submission handler with the DOM references it uses.
 evaluate('var pending; run=fn=>{pending=fn();pending.catch(()=>{});return pending;}; openCase=value=>{current=value;dirty=false;}; cases=[];');
 const start=research.indexOf("$('#editor').onsubmit="),end=research.indexOf("$('#new').onclick",start);
 vm.runInContext(research.slice(start,end),context);
 let body;
 context.fetch=async(path,options)=>{body=JSON.parse(options.body);assert.ok(path.includes('revision=eq.4'));return {ok:true,text:async()=>JSON.stringify([])};};
 elements['#editor'].onsubmit({preventDefault(){}});await assert.rejects(evaluate('pending'),/Nothing was overwritten/);
 assert.equal(evaluate('current.revision'),4);assert.equal(body.body.notes,'Saved notes');assert.equal(elements['#save-state'].textContent,'Not saved — draft retained');
 context.fetch=async()=>{throw Error('Offline');};
 elements['#editor'].onsubmit({preventDefault(){}});await assert.rejects(evaluate('pending'),/Offline/);assert.equal(evaluate('current.revision'),4);
 context.fetch=async()=>({ok:true,text:async()=>JSON.stringify([{id:'case-id',title:'Existing case',body:body.body,revision:5}])});
 elements['#editor'].onsubmit({preventDefault(){}});await evaluate('pending');assert.equal(evaluate('current.revision'),5);
 // The new news reader must deduplicate source URLs and reject invalid chart data.
 const today=fs.readFileSync(__dirname+'/../today.js','utf8');
 const tc=vm.createContext({document:doc,URL,Date,Number,Array,String,Set,Map});
 vm.runInContext(today.slice(0,today.indexOf("$('#back').onclick")),tc);
 assert.equal(vm.runInContext("refs({url:'https://example.com/a',sources:[{url:'https://example.com/a'},{url:'javascript:evil'},null,{url:'https://example.com/b'}]}).length",tc),2);
 assert.equal(vm.runInContext("makeChart({chart:{title:'No source',points:[]}})",tc),null);
 assert.equal(vm.runInContext("makeChart({chart:{title:'Invalid values',unit:'%',source:'Test',source_url:'https://example.com',points:[{date:'2026-01-01',value:1},{date:'2026-01-02',value:'wrong'}]}})",tc),null);
 console.log('PASS: URL safety, authentication requirement, session refresh, existing-field preservation, source deduplication, stale-save protection, offline draft preservation, successful save and invalid-chart rejection.');
})().catch(e=>{console.error(e);process.exitCode=1});
