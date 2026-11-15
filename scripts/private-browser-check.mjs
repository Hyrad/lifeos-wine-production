// Synthetic API/browser acceptance only. Never claim this is real Notion acceptance.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
const url=process.env.CHECK_URL || 'http://127.0.0.1:4178/lifeos-wine-production/';
const views=[['desktop',1440,900],['compact',1280,800],['ipad-landscape',1180,820],['ipad-portrait',820,1180],['ipad-mini',744,1133],['iphone',390,844],['small-phone',320,720]];
const sections=[['planned','Planned Batches'],['batches','Active Batches'],['archive','Production History'],['recipes','Recipe Library'],['actions','Production Actions'],['methods','Methods & Guides'],['documents','Photos & Documents'],['ideas','Ideas & Experiments'],['supplies','Wine Supplies / To Buy']];
const synthetic={name:'Synthetic nutrient',quantity:'4',unit:'g',purpose:'for a synthetic trial',classification:'confirmed',condition:''};
let checks=0,scans=0;
const eq=(a,b,l)=>{assert.deepEqual(a,b,l);checks++;};const ok=(v,l)=>{assert.ok(v,l);checks++;};
const browser=await chromium.launch();await mkdir('test-results/private',{recursive:true});
try{
for(const [name,width,height] of views){
 const context=await browser.newContext({viewport:{width,height},hasTouch:width<1200,isMobile:width<1200,reducedMotion:'reduce'});const page=await context.newPage();
 const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));context.on('request',r=>{if(new URL(r.url()).origin!==new URL(url).origin)external.push(r.url());});
 let mode='success',calls=0;
 await context.route('**/api/v1/wine-supplies',async route=>{
  calls++;eq(route.request().headers()['x-lifeos-client'],'wine-private',`${name}: client intent header`);
  if(mode==='network')return route.abort('failed');
  if(mode==='denied')return route.fulfill({status:403,contentType:'application/json',body:'{"error":"forbidden"}'});
  const data={items:mode==='empty'?[]:[synthetic,{...synthetic,name:'Synthetic fruit',quantity:'about 7',unit:'L',purpose:'Only if the synthetic trial is retained.',classification:'conditional',condition:'Only if the synthetic trial is retained.'}],fetchedAt:mode==='empty'?'2030-01-01T12:02:00Z':'2030-01-01T12:00:00Z'};
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data),headers:{'Cache-Control':'no-store, private'}});
 });
 eq((await page.goto(url,{waitUntil:'networkidle'})).status(),200,`${name}: served private build`);
 eq(await page.locator('.release-version').textContent(),'v1.207-private.1',`${name}: private version`);eq(calls,0,`${name}: no automatic private read`);
 await page.locator('.wine-supplies-shortcut').click();
 const section=page.getByRole('region',{name:'Wine Supplies / To Buy'}),button=section.getByRole('button',{name:'Refresh from LifeOS'});
 await button.focus();await page.keyboard.press('Enter');await section.getByRole('status').filter({hasText:'Refresh successful.'}).waitFor();eq(calls,1,`${name}: real fetch path triggered (synthetic upstream)`);
 eq(await section.locator('li').count(),2,`${name}: only response items`);ok(await section.getByRole('heading',{name:'Conditional purchases'}).isVisible(),`${name}: conditional group`);ok(await section.getByText('Conditional — confirm before buying.').isVisible(),`${name}: restriction label`);
 eq(await section.locator('time').getAttribute('datetime'),'2030-01-01T12:00:00Z',`${name}: successful timestamp`);
 eq(await section.locator('input').count(),0,`${name}: read-only`);
 eq(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name}: no horizontal overflow`);
 const targets=await page.locator('a,button').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&!e.classList.contains('skip-link')&&r.height<44;}).map(e=>e.textContent));eq(targets,[],`${name}: touch targets`);
 for(const state of ['success','denied','empty']){
  if(state==='denied'){mode='denied';await button.click();await section.getByRole('alert').waitFor();ok((await section.getByRole('alert').textContent()).includes('stale'),`${name}: stale on denied`);eq(await section.locator('time').getAttribute('datetime'),'2030-01-01T12:00:00Z',`${name}: denied cannot advance freshness`);}
  if(state==='empty'){mode='empty';await button.click();await section.getByText(/No outstanding winemaking purchases/).waitFor();eq(await section.locator('li').count(),0,`${name}: empty clears previous data`);}
  const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();eq(scan.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],`${name}: ${state} accessibility`);scans++;
 }
 await page.screenshot({path:`test-results/private/${name}.png`,fullPage:true});
 mode='network';await button.click();await section.getByRole('alert').waitFor();ok((await section.getByRole('alert').textContent()).includes('Unable to reach LifeOS'),`${name}: network failure`);
 await context.setOffline(true);await button.click();ok((await section.getByRole('alert').textContent()).includes('offline'),`${name}: offline feedback`);await context.setOffline(false);
 for(const [id,title]of sections){await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:title,exact:true}).click();eq(new URL(page.url()).hash,`#${id}`,`${name}: retained anchor ${id}`);await page.goto(new URL(`#${id}`,url).href);await page.reload({waitUntil:'networkidle'});await page.locator(`#${id}`).waitFor();}
 eq(await page.getByRole('link',{name:'Back to LifeOS Home'}).getAttribute('href'),'https://hyrad.github.io/lifeos-home/',`${name}: Home retained`);
 eq(await page.evaluate(()=>[localStorage.length,sessionStorage.length]),[0,0],`${name}: no client ledger`);eq(errors,[],`${name}: no runtime errors`);eq(external,[],`${name}: no unrelated external request`);
 await context.close();console.log(`${name}: private synthetic refresh, conditional, stale, empty, network, offline, keyboard/navigation and 3 axe scans PASS`);
}
}finally{await browser.close();}
await writeFile('test-results/private/result.json',JSON.stringify({status:'PASS',checks,viewports:views.length,axeScans:scans,source:'synthetic intercepted API; NOT real Notion or deployed authentication acceptance',physicalDevices:'pending'},null,2));console.log(`Private synthetic browser PASS: ${checks} assertions, ${views.length} viewports, ${scans} axe scans. Real source and deployment acceptance remain separate.`);
