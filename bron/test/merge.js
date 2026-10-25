const { launch, open } = require('./open');
(async()=>{const b=await launch();
const mobile = process.env.MOB==='1';
const p=await b.newPage(mobile?{viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}:{viewport:{width:1400,height:820}});
p.on('pageerror',e=>console.log('ERR',e.message));
const P=process.env.PFX;
const sc=open(p, process.argv[2]);
await p.waitForTimeout(2500); await p.screenshot({path:P+'_load.png'}).catch(e=>console.log(e.message));
await sc;
for(let i=0;i<300;i++){ const ok=await p.evaluate(()=>!!window.__people); if(ok)break; await p.waitForTimeout(500);}
await p.waitForTimeout(3000);
for (const [id,n] of JSON.parse(process.env.SEQ)){
  await p.evaluate(id=>{const i=__story.stops.findIndex(s=>s.id===id); __story.go(i); __story.pause(false);},id);
  for(let k=0;k<n;k++){ await p.waitForTimeout(+(process.env.GAP||3000)); const cur=await p.evaluate(()=>__story.stops[__story.at??0]?.id||JSON.stringify(Object.keys(__story))); await p.screenshot({path:`${P}_${id}_${k}.png`,timeout:120000}); console.log(id,k,cur);}
}
await b.close();})();
