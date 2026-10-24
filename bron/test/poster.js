const { chromium } = require('playwright'); const fs=require('fs'), path=require('path');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const mobile = process.env.MOB==='1';
const p=await b.newPage(mobile?{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}:{viewport:{width:1600,height:900}});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/,r=>{const rel=r.request().url().split('three@0.147.0/')[1];r.fulfill({body:fs.readFileSync(path.join(__dirname,'node_modules/three',rel)),contentType:'application/javascript'})});
await p.route(/fonts\./,r=>r.abort());
await p.setContent('<!doctype html><html><head><meta charset=utf-8></head><body>'+fs.readFileSync(process.argv[2],'utf8').replace(/^<!doctype html>/i,'')+'</body></html>');
for(let i=0;i<300;i++){ const ok=await p.evaluate(()=>!!window.__people); if(ok)break; await p.waitForTimeout(500);}
await p.waitForTimeout(3000);
await p.evaluate(()=>{__story.go(0);__story.pause(true); const st=document.createElement('style'); st.textContent='.beats,.brand,.timeline,.scroll-hint,.meet,.fw,.loader,.loading,.labels,.caption{display:none!important}'; document.head.appendChild(st);});
await p.waitForTimeout(4000);
await p.screenshot({path:process.argv[3],type:'jpeg',quality:mobile?55:62,timeout:120000});
await b.close();})();
