# Rocketbox textures -> web sizes; suits recoloured to concert black (shirts white, skin untouched)
import numpy as np, glob, os, sys
from PIL import Image
OUT='/tmp/claude-0/rbx/out/'
def hsv(a):
    r,g,b=a[...,0],a[...,1],a[...,2]; mx=a.max(-1); mn=a.min(-1); d=mx-mn+1e-6
    h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60
    s=np.where(mx>0,d/(mx+1e-6),0); return h,s,mx
def recolor(im, coat=None):
    a=np.asarray(im.convert('RGB')).astype(np.float32)/255; h,s,v=hsv(a)
    lum=a@[0.299,0.587,0.114]
    skin=(h>5)&(h<50)&(s>0.18)&(s<0.75)&(v>0.45)
    shirt=(~skin)&(lum>0.55)
    cloth=(~skin)&(~shirt)
    out=a.copy()
    # cloth: keep the weave and folds (relative luminance), push to a deep neutral black
    det=np.clip(lum/ (np.median(lum[cloth]) if cloth.any() else 0.2),0.4,1.8)
    base=np.array(coat if coat else [0.045,0.043,0.047])
    if coat:
        det=np.clip(det,0.7,1.25); H,W=lum.shape; yy,xx=np.mgrid[0:H,0:W]; shoes=cloth&(yy>0.8*H)&(xx>0.25*W)&(xx<0.72*W); cloth=cloth&~shoes
    out[cloth]=np.clip(base*det[cloth][:,None],0,1)
    if coat: out[shoes]=[0.03,0.025,0.025]
    # coloured shirts (pink, purple...) become white
    out[shirt]=np.repeat(np.clip(lum[shirt]*1.05+0.05,0,1)[:,None],3,1)*np.array([1,0.99,0.97])
    return Image.fromarray((out*255).astype(np.uint8))
for d in sorted(glob.glob('/tmp/claude-0/rbx/Business_*')):
    k=os.path.basename(d)
    for f in glob.glob(d+'/*_color.tga'):
        n=os.path.basename(f)[:-10]   # f014_body / f014_head / f014_opacity / f015_glasses_opacity
        im=Image.open(f)
        if n.endswith('_body'):
            recolor(im).resize((1024,1024),Image.LANCZOS).save(OUT+n+'.jpg',quality=82)
            if k=='Business_Male_01': recolor(im,[0.6,0.2,0.12]).resize((1024,1024),Image.LANCZOS).save(OUT+n+'_red.jpg',quality=82)
        elif n.endswith('_head'): im.convert('RGB').resize((512,512),Image.LANCZOS).save(OUT+n+'.jpg',quality=82)
        else: im.convert('RGBA').resize((512,512),Image.LANCZOS).save(OUT+n+'.png',optimize=True)
    os.system(f'cp {d}/{k}.fbx {OUT}')
