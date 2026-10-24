import math, json
S = 20  # px per meter
def P(x, y, ox, oy): return (ox + x*S, oy - y*S)   # y up = toward back

# ---------- RUN layout (meters; origin = front centre of stage floor, +y = toward back wall) ----------
A, B = 11.0, 9.0          # stage semi-ellipse
COND = (0.0, 1.0)
sections = [  # key, label, count per row list of (r, deg0, deg1, n)
 ("vl1","1e violen",[(2.7,-88,-42,4),(3.9,-88,-42,4)]),
 ("vl2","2e violen",[(5.2,-84,-50,4),(6.4,-80,-56,3)]),
 ("va","altviolen",[(3.6,18,42,3),(4.8,22,40,2)]),
 ("vc","cello's",[(2.8,52,88,3),(4.0,58,86,2)]),
 ("cb","contrabassen",[(6.2,62,82,3)]),
 ("ww","houtblazers",[(4.9,-16,12,4),(6.0,-14,10,4)]),
 ("br","koper",[(7.3,-30,30,7)]),
 ("pc","slagwerk",[(7.6,36,58,4)]),
 ("hp","harp",[(6.3,-100,-100,1)]),
 ("pn","piano",[(7.2,-75,-75,1)]),
]
def norm(x,y): return math.hypot(x/A, y/B)
def tier(x,y):
    n = norm(x,y); return 0 if n < 0.62 else (1 if n < 0.80 else 2)
mus = []
for key,label,rows in sections:
    for r,d0,d1,n in rows:
        for i in range(n):
            d = d0 if n==1 else d0+(d1-d0)*i/(n-1)
            t = math.radians(d)
            x, y = COND[0]+r*math.sin(t), COND[1]+r*math.cos(t)
            mus.append(dict(s=key,label=label,x=x,y=y,t=tier(x,y)))
total = len(mus)
counts = {}
for m in mus: counts[m["label"]] = counts.get(m["label"],0)+1

def run_top():
    W, H = 640, 560; ox, oy = W/2, 250
    o = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Bovenaanzicht RUN: podium, secties, dirigent, lessenaars en bord">']
    # grain + earth
    o.append(f'<rect x="0" y="0" width="{W}" height="{H}" class="earth"/>')
    o.append(f'<rect x="0" y="{oy+3.2*S}" width="{W}" height="{H}" class="grain"/>')
    # stage: half ellipse + apron
    def arc(sc):
        x0,y0 = P(-A*sc,0,ox,oy); x1,y1 = P(A*sc,0,ox,oy)
        return f'M{x0:.1f},{y0:.1f} A{A*sc*S:.1f},{B*sc*S:.1f} 0 0 1 {x1:.1f},{y1:.1f}'
    o.append(f'<path d="{arc(1)} L{ox+A*S:.1f},{oy+2*S:.1f} L{ox-A*S:.1f},{oy+2*S:.1f} Z" class="stage"/>')
    for sc,lab in [(0.62,"trede 1  +0,35 m"),(0.80,"trede 2  +0,70 m")]:
        o.append(f'<path d="{arc(sc)}" class="tierline"/>')
    o.append(f'<path d="{arc(1)}" class="wall"/>')
    o.append(f'<text x="{ox}" y="{oy-B*S-12}" class="dim" text-anchor="middle">achterwand, 3 m hoog</text>')
    o.append(f'<text x="{ox}" y="{oy-0.62*B*S+12}" class="dim" text-anchor="middle">trede 1 · +0,35 m</text>')
    o.append(f'<text x="{ox}" y="{oy-0.80*B*S+12}" class="dim" text-anchor="middle">trede 2 · +0,70 m</text>')
    # stands + musicians
    cx,cy = P(*COND,ox,oy)
    for m in mus:
        px,py = P(m["x"],m["y"],ox,oy)
        dx,dy = cx-px, cy-py; L = math.hypot(dx,dy) or 1
        sx,sy = px+dx/L*12, py+dy/L*12
        o.append(f'<line x1="{sx-dy/L*4:.1f}" y1="{sy+dx/L*4:.1f}" x2="{sx+dy/L*4:.1f}" y2="{sy-dx/L*4:.1f}" class="standmark"/>')
        o.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="4.2" class="mus"/>')
    # section labels
    lab = {}
    for m in mus: lab.setdefault(m["label"],[]).append(m)
    nudge = {"1e violen":(-1.6,-0.6),"2e violen":(-1.2,1.0),"altviolen":(1.6,0.2),"cello's":(1.4,-1.0),"contrabassen":(1.8,0.9),
             "houtblazers":(0,-0.95),"koper":(0,-0.95),"slagwerk":(1.3,0.9),"harp":(-0.3,-0.9),"piano":(-1.6,-1.9)}
    for k,ms in lab.items():
        x = sum(m["x"] for m in ms)/len(ms)+nudge[k][0]; y = sum(m["y"] for m in ms)/len(ms)+nudge[k][1]
        px,py = P(x,y,ox,oy)
        o.append(f'<text x="{px:.1f}" y="{py:.1f}" class="lab" text-anchor="middle">{k} · {len(ms)}</text>')
    # conductor
    bx,by = P(-0.5,0.6,ox,oy)
    o.append(f'<rect x="{bx:.1f}" y="{by-0.8*S:.1f}" width="{S:.1f}" height="{0.8*S:.1f}" class="box"/>')
    o.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="6" class="cond"/>')
    sx,sy = P(0,1.9,ox,oy)
    o.append(f'<line x1="{sx-6}" y1="{sy}" x2="{sx+6}" y2="{sy}" class="standmark strong"/>')
    o.append(f'<text x="{cx:.1f}" y="{cy+24:.1f}" class="lab accent" text-anchor="middle">dirigent</text>')
    # board
    bx0,by0 = P(-12.3,-0.6,ox,oy); bx1,by1 = P(-10.2,0.9,ox,oy)
    o.append(f'<line x1="{bx0:.1f}" y1="{by0:.1f}" x2="{bx1:.1f}" y2="{by1:.1f}" class="board"/>')
    o.append(f'<text x="{bx0-4:.1f}" y="{by0+18:.1f}" class="lab">bord</text>')
    # piano body
    pm = [m for m in mus if m["s"]=="pn"][0]
    px,py = P(pm["x"]-2.2,pm["y"]+1.2,ox,oy)
    o.append(f'<rect x="{px:.1f}" y="{py:.1f}" width="{1.5*S}" height="{2.4*S}" rx="10" class="piano"/>')
    # audience: rows of seats on the grain field, backs toward the camera
    for row in range(4):
        y = -5.0 - row*1.15
        n = 12
        for i in range(n):
            x = (i-(n-1)/2)*0.9
            ax,ay = P(x,y,ox,oy)
            o.append(f'<rect x="{ax-6:.1f}" y="{ay-1:.1f}" width="12" height="7" rx="1.5" class="seat"/>')
            o.append(f'<circle cx="{ax:.1f}" cy="{ay:.1f}" r="4.2" class="aud"/>')
    lx,ly = P(5.9,-6.6,ox,oy)
    o.append(f'<text x="{lx:.1f}" y="{ly:.1f}" class="lab">publiek · 4 rijen</text>')
    # cameras
    for (x,y,t) in [(0,-3.6,"camera 1 · openingsbeeld"),(0,-12.6,"camera 2 · uitzoomen, publiek in beeld")]:
        kx,ky = P(x,y,ox,oy)
        o.append(f'<path d="M{kx-7},{ky+8} L{kx},{ky-6} L{kx+7},{ky+8} Z" class="cam"/>')
        o.append(f'<text x="{kx+14}" y="{ky+6}" class="dim">{t}</text>')
    a0 = P(-0.6,-4.0,ox,oy); a1 = P(-0.6,-11.8,ox,oy)
    o.append(f'<line x1="{a0[0]-10}" y1="{a0[1]}" x2="{a1[0]-10}" y2="{a1[1]}" class="path"/>')
    # scale bar
    o.append(f'<line x1="24" y1="{H-20}" x2="{24+5*S}" y2="{H-20}" class="scale"/><text x="24" y="{H-28}" class="dim">5 m</text>')
    o.append('</svg>'); return "\n".join(o)

def run_front():
    W, H = 700, 250; ox, oy = 320, 200
    o = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Vooraanzicht RUN: podiumhoogtes, treden en achterwand">']
    o.append(f'<rect width="{W}" height="{H}" class="sky"/>')
    o.append(f'<path d="M0,{oy-70} C80,{oy-110} 160,{oy-60} 240,{oy-85} S420,{oy-115} 500,{oy-80} S600,{oy-95} {W},{oy-75} L{W},{H} L0,{H} Z" class="earth"/>')
    o.append(f'<rect x="0" y="{oy}" width="{W}" height="{H-oy}" class="grain"/>')
    def r(x0,x1,z0,z1,cls):
        X0,Y1 = P(x0,z1,ox,oy); X1,Y0 = P(x1,z0,ox,oy)
        return f'<rect x="{X0:.1f}" y="{Y1:.1f}" width="{X1-X0:.1f}" height="{Y0-Y1:.1f}" class="{cls}"/>'
    o.append(r(-11.6,11.6,0.5,3.5,"wall-f"))
    o.append(r(-11,11,0,0.5,"stage"))
    o.append(r(-8.8,8.8,0.5,0.85,"stage tier"))
    o.append(r(-6.6,6.6,0.85,1.2,"stage tier"))
    # silhouettes along x at their tier height
    base = {0:0.5,1:0.85,2:1.2}
    for m in sorted(mus,key=lambda m:-m["y"]):
        z = base[m["t"]]; o.append(r(m["x"]-0.22,m["x"]+0.22,z,z+1.3,"sil"))
    o.append(r(-0.5,0.5,0.5,0.75,"box"))
    o.append(r(-0.25,0.25,0.75,2.55,"cond"))
    o.append(r(-12.3,-10.3,2.1,3.3,"boardf")); o.append(r(-12.2,-12.1,0,2.1,"boardf")); o.append(r(-10.5,-10.4,0,2.1,"boardf"))
    for z,t in [(0.5,"podium 0,5 m"),(1.2,"trede 2 +0,70"),(3.5,"wand +3 m")]:
        X,Y = P(11.9,z,ox,oy); o.append(f'<text x="{X:.1f}" y="{Y+4:.1f}" class="dim">{t}</text>')
    o.append('</svg>'); return "\n".join(o)

# ---------- CHANGE: rehearsal room (local coords, origin front-centre of room, +y toward back) ----------
RW, RD = 16.0, 10.0
groups = [("strijkers",(-4.4,4.6),1.9,6),("blazers",(2.6,6.4),1.6,5)]
def change_top():
    W, H = 640, 300; ox, oy = W/2, 250
    o = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Bovenaanzicht CHANGE: repetitieruimte met groepjes, compositietafel, piano en planbord">']
    o.append(f'<rect width="{W}" height="{H}" class="earth"/>')
    X0,Y0 = P(-RW/2,0,ox,oy); X1,Y1 = P(RW/2,RD,ox,oy)
    o.append(f'<rect x="{X0}" y="{Y1}" width="{X1-X0}" height="{Y0-Y1}" class="floor"/>')
    o.append(f'<path d="M{X0},{Y0} L{X0},{Y1} L{X1},{Y1} L{X1},{Y0}" class="wall"/>')
    o.append(f'<text x="{ox}" y="{Y0+16}" class="dim" text-anchor="middle">open zijde, hier kijkt de camera naar binnen</text>')
    def mus(x,y,fx,fy):
        px,py = P(x,y,ox,oy); qx,qy = P(fx,fy,ox,oy); dx,dy = qx-px,qy-py; L=math.hypot(dx,dy) or 1
        sx,sy = px+dx/L*12, py+dy/L*12
        return (f'<line x1="{sx-dy/L*4:.1f}" y1="{sy+dx/L*4:.1f}" x2="{sx+dy/L*4:.1f}" y2="{sy-dx/L*4:.1f}" class="standmark draft"/>'
                f'<circle cx="{px:.1f}" cy="{py:.1f}" r="4.2" class="mus"/>')
    for name,(gx,gy),rr,n in groups:
        for i in range(n):
            a = 2*math.pi*i/n + 0.3
            o.append(mus(gx+rr*math.cos(a), gy+rr*math.sin(a), gx, gy))
        px,py = P(gx,gy,ox,oy); o.append(f'<text x="{px:.1f}" y="{py+4:.1f}" class="lab" text-anchor="middle">{name} · {n}</text>')
    # percussion
    for x in (5.6,6.6):
        px,py = P(x,2.6,ox,oy); o.append(f'<circle cx="{px}" cy="{py}" r="9" class="drum"/>')
    o.append(mus(6.1,3.6,6.1,2.6)); px,py = P(6.1,1.4,ox,oy); o.append(f'<text x="{px}" y="{py+4}" class="lab" text-anchor="middle">slagwerk · 1</text>')
    # composition table + conductor
    tx0,ty0 = P(-0.4,1.6,ox,oy); tx1,ty1 = P(2.0,2.8,ox,oy)
    o.append(f'<rect x="{tx0}" y="{ty1}" width="{tx1-tx0}" height="{ty0-ty1}" class="table"/>')
    o.append(f'<text x="{(tx0+tx1)/2}" y="{ty1-6}" class="lab" text-anchor="middle">compositietafel</text>')
    cx,cy = P(0.8,1.1,ox,oy); o.append(f'<circle cx="{cx}" cy="{cy}" r="6" class="cond"/><text x="{cx-12}" y="{cy+4}" class="lab accent" text-anchor="end">dirigent</text>')
    # piano
    px0,py0 = P(4.6,7.6,ox,oy); px1,py1 = P(7.2,9.4,ox,oy)
    o.append(f'<path d="M{px0},{py0} L{px0},{py1} L{px1},{py1} C{px1},{(py0+py1)/2} {px1-20},{py0} {px0+30},{py0} Z" class="piano"/>')
    o.append(f'<text x="{(px0+px1)/2}" y="{py0+14}" class="lab" text-anchor="middle">piano</text>')
    # plan board on back wall
    bx0,by = P(-3.2,RD-0.15,ox,oy); bx1,_ = P(1.2,RD-0.15,ox,oy)
    o.append(f'<line x1="{bx0}" y1="{by}" x2="{bx1}" y2="{by}" class="board"/><text x="{(bx0+bx1)/2}" y="{by+16}" class="lab" text-anchor="middle">planbord volgend seizoen</text>')
    # cases rack
    rx0,ry0 = P(-RW/2+0.2,0.8,ox,oy); rx1,ry1 = P(-RW/2+0.9,3.2,ox,oy)
    o.append(f'<rect x="{rx0}" y="{ry1}" width="{rx1-rx0}" height="{ry0-ry1}" class="table"/><text x="{rx1+6}" y="{(ry0+ry1)/2+4}" class="lab">koffers</text>')
    o.append(f'<line x1="24" y1="{H-14}" x2="{24+5*S}" y2="{H-14}" class="scale"/><text x="24" y="{H-20}" class="dim">5 m</text>')
    o.append('</svg>'); return "\n".join(o)

def site():
    W,H = 640,300; ox,oy = W/2,250; s=8
    def Q(x,y): return (ox+x*s, oy-y*s)
    o=[f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Situatie: concertpodium vooraan, repetitieruimte achter de achterwand, camerapad over de wand">']
    o.append(f'<rect width="{W}" height="{H}" class="earth"/>')
    gx,gy = Q(0,-6); o.append(f'<rect x="0" y="{gy}" width="{W}" height="{H-gy}" class="grain"/>')
    x0,y0=Q(-A,0); x1,_=Q(A,0)
    o.append(f'<path d="M{x0},{y0} A{A*s},{B*s} 0 0 1 {x1},{y0} Z" class="stage"/><path d="M{x0},{y0} A{A*s},{B*s} 0 0 1 {x1},{y0}" class="wall"/>')
    tx,ty=Q(0,3); o.append(f'<text x="{tx}" y="{ty}" class="lab" text-anchor="middle">RUN</text>')
    rx0,ry0=Q(-8,14); rx1,ry1=Q(8,24)
    o.append(f'<rect x="{rx0}" y="{ry1}" width="{rx1-rx0}" height="{ry0-ry1}" class="floor"/><path d="M{rx0},{ry0} L{rx0},{ry1} L{rx1},{ry1} L{rx1},{ry0}" class="wall"/>')
    tx,ty=Q(0,19); o.append(f'<text x="{tx}" y="{ty}" class="lab" text-anchor="middle">CHANGE</text>')
    a0=Q(0,-4); a1=Q(-3,12); a2=Q(0,15)
    o.append(f'<path d="M{a0[0]},{a0[1]} Q{a1[0]-40},{a1[1]} {a2[0]},{a2[1]+6}" class="path"/>')
    o.append(f'<path d="M{a2[0]-5},{a2[1]+15} L{a2[0]},{a2[1]+6} L{a2[0]+6},{a2[1]+14}" class="path"/>')
    tx,ty=Q(9.5,19); o.append(f'<text x="{tx}" y="{ty}" class="dim">repetitieruimte, achter de wand</text>'); tx,ty=Q(12,4); o.append(f'<text x="{tx}" y="{ty}" class="dim">concertpodium</text>'); tx,ty=Q(-10,11.5); o.append(f'<text x="{tx}" y="{ty}" class="dim" text-anchor="end">camera gaat over de wand</text>')
    o.append('</svg>'); return "\n".join(o)

json.dump(dict(run_top=run_top(), run_front=run_front(), change_top=change_top(), site=site(), total=total, counts=counts), open('/tmp/claude-0/bp/svg.json','w'))
print(total, counts)
