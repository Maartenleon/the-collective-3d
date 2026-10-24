const { chromium } = require('playwright'); const fs=require('fs'), path=require('path');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const mobile = process.env.MOB==='1';
const p=await b.newPage(mobile?{viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}:{viewport:{width:1400,height:820}});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/,r=>{const rel=r.request().url().split('three@0.147.0/')[1];r.fulfill({body:fs.readFileSync(path.join(__dirname,'node_modules/three',rel)),contentType:'application/javascript'})});
await p.route(/fonts\./,r=>r.abort());
await p.setContent('<!doctype html><html><head><meta charset=utf-8></head><body>'+fs.readFileSync(process.argv[2],'utf8').replace(/^<!doctype html>/i,'')+'</body></html>');
for(let i=0;i<300;i++){ const ok=await p.evaluate(()=>!!window.__people); if(ok)break; await p.waitForTimeout(500);}
await p.waitForTimeout(3000);
await p.evaluate(()=>{__story.go("t5"); __story.pause(true);});
const goals=JSON.parse(process.env.AT||'[1,2.5,4.5]');
for(const g of goals){ for(let i=0;i<400;i++){ if(await p.evaluate(()=>__offT())>=g)break; await p.waitForTimeout(300);} await p.screenshot({path:`${process.env.PFX}_${g}.png`,timeout:120000}); console.log(g, await p.evaluate(()=>__offT())); }
await b.close();})();
