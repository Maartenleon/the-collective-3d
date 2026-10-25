const { launch, open } = require('./open');
(async()=>{const b=await launch();
const mobile = process.env.MOB==='1';
const p=await b.newPage(mobile?{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}:{viewport:{width:1600,height:900}});
p.on('pageerror',e=>console.log('ERR',e.message));
await open(p, process.argv[2]);
for(let i=0;i<300;i++){ const ok=await p.evaluate(()=>!!window.__people); if(ok)break; await p.waitForTimeout(500);}
await p.waitForTimeout(3000);
await p.evaluate(()=>{__story.go(0);__story.pause(true); const st=document.createElement('style'); st.textContent='.beats,.brand,.timeline,.scroll-hint,.meet,.fw,.loader,.loading,.labels,.caption{display:none!important}'; document.head.appendChild(st);});
await p.waitForTimeout(4000);
await p.screenshot({path:process.argv[3],type:'jpeg',quality:mobile?55:62,timeout:120000});
await b.close();})();
