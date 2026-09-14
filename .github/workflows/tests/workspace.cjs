const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext();
 let rows=[], conflict=false, fail=false;
 await context.route('https://**/*',async route=>{
  const req=route.request(), url=new URL(req.url());
  if(!url.hostname.endsWith('.supabase.co'))return route.abort();
  let result={}, status=200;
  if(url.pathname.includes('/token'))result={access_token:'test-token',refresh_token:'test-refresh',expires_in:3600,user:{id:'test-user'}};
  else if(url.pathname.includes('/logout'))result={};
  else if(req.method()==='GET')result=rows;
  else if(fail){status=503;result={message:'Test offline error'};}
  else if(req.method()==='POST'){const b=req.postDataJSON();rows=[{...b,revision:1,updated_at:new Date().toISOString()}];result=rows;}
  else if(req.method()==='PATCH'){if(conflict)result=[];else{rows=[{...rows[0],...req.postDataJSON(),revision:rows[0].revision+1}];result=rows;}}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
 });
 await context.route('**/feed.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({generated:'2026-09-13T00:00:00Z',items:[{id:'test-news',title:'Test-only economic event',url:'https://example.com/story',source:'Test source',ts:'2026-09-13T00:00:00Z'}]})}));
 const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://localhost:8080/research.html?article=test-news');
 assert.equal(await p.locator('#workspace').isVisible(),false);
 await p.fill('#email','test@example.com');await p.fill('#password','fake-password');await p.click('#login button');
 await p.getByRole('button',{name:'Attach selected article'}).click();
 await p.fill('[name=mechanism]','An evidence-based explanation.');
 await p.click('#add-claim');await p.fill('[data-claim]','A test claim');await p.fill('[data-evidence]','https://example.com/evidence');
 await p.click('#save');await p.waitForFunction(()=>document.querySelector('#save-state').textContent==='Saved revision 1');
 assert.equal(rows[0].body.sources.length,1);assert.equal(rows[0].body.claims[0].claim,'A test claim');
 await p.click('[data-case-tab=notes]');await p.fill('[name=notes]','Unsaved local notes');conflict=true;await p.click('#save');
 await p.waitForFunction(()=>document.querySelector('#message').textContent.includes('Nothing was overwritten'));
 assert.equal(await p.inputValue('[name=notes]'),'Unsaved local notes');assert.equal(rows[0].body.notes,'');
 conflict=false;fail=true;await p.click('#save');await p.waitForFunction(()=>document.querySelector('#message').textContent.includes('Test offline'));
 assert.equal(await p.inputValue('[name=notes]'),'Unsaved local notes');fail=false;
 await p.click('[data-case-tab=sources]');await p.locator('#source-entry summary').click();await p.fill('#source-title','Unsafe');await p.fill('#source-url','javascript:alert(1)');await p.click('#add-source');assert.equal(await p.locator('#sources .source').count(),1);
 await p.fill('#source-url','');await p.click('#save');await p.waitForFunction(()=>document.querySelector('#save-state').textContent==='Saved revision 2');
 await p.screenshot({path:'/workspace/scratch/a20370555e19/research-desktop.png',fullPage:true});
 await p.setViewportSize({width:390,height:844});await p.screenshot({path:'/workspace/scratch/a20370555e19/research-mobile.png',fullPage:true});
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 const second=await context.newPage();await second.goto('http://localhost:8080/research.html');await second.fill('#email','test@example.com');await second.fill('#password','fake-password');await second.click('#login button');await second.click('.case');assert.equal(await second.inputValue('[name=notes]'),'Unsaved local notes');
 await p.click('#logout');assert.equal(await p.locator('#workspace').isVisible(),false);assert.equal(await p.evaluate(()=>localStorage.length+sessionStorage.length),0);
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: login, attach, save, claims, conflict, failure preservation, unsafe URL rejection, cross-tab reload, logout, no browser storage, mobile layout.');
})().catch(e=>{console.error(e);process.exit(1)});
