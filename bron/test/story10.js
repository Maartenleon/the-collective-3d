const { chromium } = require('playwright'); const fs=require('fs'), path=require('path');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const mobile = process.env.MOB==='1';
const p=await b.newPage(mobile?{viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}:{viewport:{width:1400,height:820}});
p.on('pageerror',e=>console.log('ERR',e.message)); p.on('console',m=>{if(m.type()==='error')console.log('console',m.text().slice(0,300))});
await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/,r=>{const rel=r.request().url().split('three@0.147.0/')[1];r.fulfill({body:fs.readFileSync(path.join(__dirname,'node_modules/three',rel)),contentType:'application/javascript'})});
await p.route(/fonts\./,r=>r.abort());
const t0=Date.now(); setTimeout(()=>p.screenshot({path:process.env.PFX+"_load.png"}).catch(()=>{}),20000);
await p.setContent('<!doctype html><html><head><meta charset=utf-8>'+(process.env.NOPEOPLE?'<script>window.__noPeople=true</script>':'')+'</head><body>'+fs.readFileSync(process.argv[2],'utf8').replace(/^<!doctype html>/i,'')+'</body></html>');
for(let i=0;i<300;i++){ const ok=await p.evaluate(()=>!!window.__people||document.getElementById('loading').textContent.includes('could not')); if(ok)break; await p.waitForTimeout(500);}
console.log("loaded in",(Date.now()-t0)/1000,"s"); await p.waitForTimeout(2500); console.log("loader done:", await p.evaluate(()=>document.getElementById("loader").className+" | "+document.body.className));
const stops = JSON.parse(process.env.STOPS||'null') || await p.evaluate(()=>__story.stops.map((s,i)=>i));
for (const i of stops){ await p.evaluate(i=>{__story.go(i); __story.pause(true);},i); await p.waitForTimeout(+(process.env.WAIT||3500)); await p.screenshot({path:process.env.PFX+'_'+String(i).padStart(2,'0')+'.png',timeout:120000}); }
await b.close();})();
