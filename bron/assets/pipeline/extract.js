// Offline: pull the head + hair (opacity) parts out of Rocketbox adult avatars, in bind-world space, compact.
const { chromium } = require('/tmp/claude-0/shot/node_modules/playwright'); const fs=require('fs');
const T='/tmp/claude-0/shot/node_modules/three/';
const names=process.argv.slice(2);
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=swiftshader']});
const p=await b.newPage(); p.on('pageerror',e=>console.log('ERR',e.message)); p.on('console',m=>{const t=m.text(); if(!/TGA/.test(t)) console.log('c',t.slice(0,500))});
await p.route('http://x/**',r=>{const u=r.request().url().slice(9); const f=u.startsWith('three/')?T+u.slice(6):'/tmp/claude-0/'+u; fs.existsSync(f)?r.fulfill({body:fs.readFileSync(f)}):r.fulfill({status:404,body:''})});
await p.goto('http://x/three/package.json');
for (const s of ['build/three.min.js','examples/js/libs/fflate.min.js','examples/js/curves/NURBSUtils.js','examples/js/curves/NURBSCurve.js','examples/js/loaders/FBXLoader.js','examples/js/utils/BufferGeometryUtils.js']) await p.addScriptTag({url:'http://x/three/'+s});
const out={};
for (const n of names){
  out[n]=await p.evaluate(async(n)=>{
    const dir=n.startsWith('Business')?'rbx/out/':'rba/'+n+'/';
    const buf=await (await fetch('http://x/'+dir+n+'.fbx')).arrayBuffer();
    const o=new THREE.FBXLoader().parse(buf,''); o.updateMatrixWorld(true);
    let sm; o.traverse(c=>{ if(c.isSkinnedMesh&&!sm) sm=c; });
    const mats=[].concat(sm.material).map(m=>m.name), sk=sm.skeleton;
    const bindW=name=>{ const i=sk.bones.findIndex(bb=>bb.name===name); const m=sk.boneInverses[i].clone().invert(); return [m.elements[12],m.elements[13],m.elements[14]]; };
    const info={mats, groups:sm.geometry.groups.map(g=>[g.start,g.count,mats[g.materialIndex]]), head:bindW('Bip01_Head'), neck:bindW('Bip01_Neck')};
    if(n.startsWith('Business')) return info;
    // keep head + opacity triangles
    const g=sm.geometry, keep=[];
    g.groups.forEach(gr=>{ const mn=mats[gr.materialIndex]; if(/head|opacity/.test(mn)) for(let i=gr.start;i<gr.start+gr.count;i++) keep.push([i, /opacity/.test(mn)?1:0]); });
    const P=g.attributes.position, N=g.attributes.normal, U=g.attributes.uv, SI=g.attributes.skinIndex, SW=g.attributes.skinWeight, BM=sm.bindMatrix;
    const v=new THREE.Vector3(), nn=new THREE.Vector3(), nm=new THREE.Matrix3().getNormalMatrix(BM);
    const key=new Map(), pos=[], nor=[], uv=[], si=[], sw=[], idx=[[],[]], used=new Map(), boneNames=[];
    const bi=j=>{ const nmB=sk.bones[j].name; if(!used.has(nmB)){used.set(nmB,boneNames.length); boneNames.push(nmB);} return used.get(nmB); };
    for(const [i,part] of keep){
      v.fromBufferAttribute(P,i).applyMatrix4(BM); nn.fromBufferAttribute(N,i).applyMatrix3(nm).normalize();
      const k=[v.x,v.y,v.z,U.getX(i),U.getY(i),nn.x,nn.y].map(x=>x.toFixed(3)).join(',')+part;
      let id=key.get(k);
      if(id===undefined){ id=pos.length/3; key.set(k,id); pos.push(v.x,v.y,v.z); nor.push(nn.x,nn.y,nn.z); uv.push(U.getX(i),U.getY(i));
        for(let q=0;q<4;q++){ const G=["getX","getY","getZ","getW"][q]; si.push(bi(SI[G](i))); sw.push(SW[G](i)); } }
      idx[part].push(id);
    }
    const q16=a=>Array.from(a,x=>Math.round(x*10)); // mm
    return {...info, boneNames, nv:pos.length/3, pos:q16(pos), nor:nor.map(x=>Math.round(x*127)), uv:uv.map(x=>Math.round(x*65535)), si, sw:sw.map(x=>Math.round(x*255)), idxHead:idx[0], idxHair:idx[1]};
  },n);
  const r=out[n]; console.log(n, JSON.stringify(r.mats), 'groups', JSON.stringify(r.groups.map(g=>g[2]+':'+g[1])), 'nv', r.nv, 'tri', r.idxHead&&r.idxHead.length/3, r.idxHair&&r.idxHair.length/3, 'head', r.head.map(x=>x.toFixed(1)).join(','));
}
fs.writeFileSync('/tmp/claude-0/rbt/heads.json', JSON.stringify(out));
await b.close();})();
