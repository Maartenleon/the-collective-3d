const { launch, open } = require('./open');
(async()=>{const b=await launch();
const mobile = process.env.MOB==='1';
const p=await b.newPage(mobile?{viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}:{viewport:{width:1400,height:820}});
p.on('pageerror',e=>console.log('ERR',e.message)); p.on('console',m=>{if(m.type()==='error')console.log('console',m.text().slice(0,300))});
const t0=Date.now(); setTimeout(()=>p.screenshot({path:process.env.PFX+"_load.png"}).catch(()=>{}),20000);
await open(p, process.argv[2]);
for(let i=0;i<300;i++){ const ok=await p.evaluate(()=>!!window.__people||document.getElementById('loading').textContent.includes('could not')); if(ok)break; await p.waitForTimeout(500);}
console.log("loaded in",(Date.now()-t0)/1000,"s"); await p.waitForTimeout(2500); console.log("loader done:", await p.evaluate(()=>document.getElementById("loader").className+" | "+document.body.className));
const stops = JSON.parse(process.env.STOPS||'null') || await p.evaluate(()=>__story.stops.map((s,i)=>i));
for (const i of stops){ await p.evaluate(i=>{__story.go(i); __story.pause(true);},i); await p.waitForTimeout(+(process.env.WAIT||3500)); await p.screenshot({path:process.env.PFX+'_'+String(i).padStart(2,'0')+'.png',timeout:120000}); }
await b.close();})();
