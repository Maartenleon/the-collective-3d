const { chromium } = require('playwright'); const fs=require('fs'), path=require('path');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const mobile = process.env.MOB==='1';
const p=await b.newPage(mobile?{viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}:{viewport:{width:1400,height:820}});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/,r=>{const rel=r.request().url().split('three@0.147.0/')[1];r.fulfill({body:fs.readFileSync(path.join(__dirname,'node_modules/three',rel)),contentType:'application/javascript'})});
await p.route(/fonts\./,r=>r.abort());
const P=process.env.PFX;
const sc=p.setContent('<!doctype html><html><head><meta charset=utf-8></head><body>'+fs.readFileSync(process.argv[2],'utf8').replace(/^<!doctype html>/i,'')+'</body></html>');
await p.waitForTimeout(2500); await p.screenshot({path:P+'_load.png'}).catch(e=>console.log(e.message));
await sc;
for(let i=0;i<300;i++){ const ok=await p.evaluate(()=>!!window.__people); if(ok)break; await p.waitForTimeout(500);}
await p.waitForTimeout(3000);
for (const [id,n] of JSON.parse(process.env.SEQ)){
  await p.evaluate(id=>{const i=__story.stops.findIndex(s=>s.id===id); __story.go(i); __story.pause(false);},id);
  for(let k=0;k<n;k++){ await p.waitForTimeout(+(process.env.GAP||3000)); const cur=await p.evaluate(()=>__story.stops[__story.at??0]?.id||JSON.stringify(Object.keys(__story))); await p.screenshot({path:`${P}_${id}_${k}.png`,timeout:120000}); console.log(id,k,cur);}
}
await b.close();})();
