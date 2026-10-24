# Head/hair textures of the adult avatars, and body textures whose hands match the swapped-in face.
import numpy as np, glob, os, json
from PIL import Image
OUT='/tmp/claude-0/rbx/out/'; SRC='/tmp/claude-0/rba/'
def hsv(a):
    r,g,b=a[...,0],a[...,1],a[...,2]; mx=a.max(-1); mn=a.min(-1); d=mx-mn+1e-6
    h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60
    return h,np.where(mx>0,d/(mx+1e-6),0),mx
def skinmask(a, vmin=0.2):
    h,s,v=hsv(a); return (h>5)&(h<50)&(s>0.15)&(s<0.8)&(v>vmin)
PAIRS=json.load(open('/tmp/claude-0/rbx/pairs.json'))
pref={}
for d in sorted(glob.glob(SRC+'*/')):
    k=os.path.basename(d[:-1])
    for f in glob.glob(d+'*_color.tga'):
        n=os.path.basename(f)[:-10]; pref[k]=n.split('_')[0]; im=Image.open(f)
        if n.endswith('_head'): im.convert('RGB').resize((512,512),Image.LANCZOS).save(OUT+n+'.jpg',quality=84)
        elif 'opacity' in n: im.convert('RGBA').resize((256,256),Image.LANCZOS).save(OUT+n+'.png',optimize=True)
        elif n.endswith('_body') and k=='Female_Adult_10': im.convert('RGB').resize((1024,1024),Image.LANCZOS).save(OUT+n+'.jpg',quality=82)
    if k=='Female_Adult_10': os.system(f'cp {d}{k}.fbx {OUT}')
def headskin(k):
    a=np.asarray(Image.open(glob.glob(SRC+k+'/*_head_color.tga')[0]).convert('RGB')).astype(np.float32)/255
    H,W=a.shape[:2]; c=a[int(H*0.15):int(H*0.5), int(W*0.35):int(W*0.65)]   # the face
    m=skinmask(c,0.15); return np.median(c[m],0) if m.any() else np.median(c.reshape(-1,3),0)
for body,head in PAIRS:   # body = recoloured business texture prefix (e.g. m005), head = adult key
    bt=np.asarray(Image.open(OUT+body+'_body.jpg').convert('RGB')).astype(np.float32)/255
    m=skinmask(bt,0.3); src=np.median(bt[m],0); dst=headskin(head)
    out=bt.copy(); out[m]=np.clip(bt[m]*(dst/src),0,1)
    Image.fromarray((out*255).astype(np.uint8)).resize((512,512),Image.LANCZOS).save(OUT+body+'_body_'+pref[head]+'.jpg',quality=82)
    print(body,head,pref[head],src.round(2),dst.round(2))
json.dump(pref,open('/tmp/claude-0/rbx/prefix.json','w'))
