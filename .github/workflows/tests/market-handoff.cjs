const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),MarketCore=require('../markets-core.js');
const code=fs.readFileSync(__dirname+'/../research.js','utf8');
const dataset={schema_version:1,checked_at:'2026-09-14T00:00:00Z',series:[{id:'us_effr',country:'US',label:'EFFR',unit:'%',category:'money',frequency:'daily',status:'ok',source_url:'https://www.newyorkfed.org/markets/reference-rates/effr',observations:[{date:'2026-09-04',value:3.63},{date:'2026-09-11',value:3.63}]}]};
let captured,dirty=false,notice;
const ctx=vm.createContext({URLSearchParams,MarketCore,Object,Number,Error,AbortSignal,crypto:require('node:crypto').webcrypto,
 location:{search:'?market=US&days=7&checked='+encodeURIComponent(dataset.checked_at)},fetch:async()=>({ok:true,json:async()=>dataset}),safeURL:u=>u.startsWith('https://')?u:null,openCase:c=>{captured=structuredClone(c);},changed:()=>{dirty=true;},message:m=>{notice=m;}});
vm.runInContext(code.slice(code.indexOf('async function loadMarketDraft()')),ctx);
(async()=>{
 await vm.runInContext('loadMarketDraft()',ctx);
 assert.equal(captured.body.kind,'market_commentary');assert.equal(captured.body.market_snapshot.series[0].delta,0);assert.equal(captured.body.sources.length,1);assert.ok(dirty);assert.match(notice,/Save to cloud/);
 dataset.series[0].observations[1].value=8;assert.equal(captured.body.market_snapshot.series[0].last.value,3.63);
 ctx.location.search='?market=US&days=7&checked=outdated';await assert.rejects(vm.runInContext('loadMarketDraft()',ctx),/dataset has updated/);
 console.log('PASS: commentary handoff, source attachment, private unsaved draft, snapshot isolation and changed-dataset rejection.');
})().catch(e=>{console.error(e);process.exitCode=1;});
