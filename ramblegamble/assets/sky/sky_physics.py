"""Offline, zero-gravity compound convex contact solver (pixel-world units).
Broad phase spheres/AABBs only reject pairs. Closed convex render pieces retain
all extremal vertices; concave/open meshes use their actual triangular surfaces.
No runtime dependency or continuous collision detection.
"""
import itertools
import trimesh
import numpy as np
from scipy.spatial import ConvexHull
from scipy.spatial.transform import Rotation

DT=1/120
MIN_SPIN=.42
MAX_SPIN=4.2

def directions(a):
 a=np.asarray(a).reshape(-1,3);n=np.linalg.norm(a,axis=1);a=a[n>1e-8]/n[n>1e-8,None]
 if not len(a):return a
 sign=np.where(a[np.arange(len(a)),np.argmax(np.abs(a),axis=1)]<0,-1,1)
 a=a*sign[:,None];_,idx=np.unique(np.round(a,5),axis=0,return_index=True);return a[idx]

class Hull:
 def __init__(self,vertices):
  v=np.unique(np.round(np.asarray(vertices).reshape(-1,3),6),axis=0)
  # Thin authored planes need a tiny physical thickness to have stable contacts.
  center=v.mean(0);_,s,vt=np.linalg.svd(v-center,full_matrices=False)
  if len(s)<3 or s[-1]<1e-5:
   if len(v)<3:raise ValueError('degenerate collision component')
   axis=vt[-1]*.25;v=np.concatenate([v+axis,v-axis])
  # Retain every extremal vertex of the render mesh; never round the shape
  # down to a small directional support set. Ignore coplanar triangulation
  # diagonals when collecting true polyhedron edges for SAT.
  h=ConvexHull(v);self.v=v[h.vertices];self.norm=directions(h.equations[:,:3]);edges=[]
  for i,face in enumerate(h.simplices):
   for k,j in enumerate(h.neighbors[i]):
    if j<i or j<0:continue
    if np.dot(h.equations[i,:3],h.equations[j,:3])>1-1e-8:continue
    a,b=np.delete(face,k);edges.append(v[b]-v[a])
  self.edge=directions(edges)
 def transform(self,p,r):
  v=self.v@r.T+p;return (v,self.norm@r.T,self.edge@r.T,v.min(0),v.max(0))

def box(extents,center=(0,0,0)):
 return np.array(list(itertools.product((-1,1),repeat=3)))*np.array(extents)/2+center

class MeshParts:
 """Grouped exact triangular prisms or convex pieces; vectorized AABB pruning.
 Thin/open surfaces get a subpixel thickness, not a volume-filling convex hull.
 """
 def __init__(self,hulls):
  self.hulls=hulls
  n=max(len(h.v) for h in hulls)
  self.vertices=np.stack([np.pad(h.v,((0,n-len(h.v)),(0,0)),mode='edge') for h in hulls])
  self.v=self.vertices.reshape(-1,3)
 def transform(self,p,r):
  v=self.vertices@r.T+p
  return MeshWorld(self,p,r,v.min(1),v.max(1))

class MeshWorld:
 def __init__(self,mesh,p,r,lo,hi):
  self.mesh=mesh;self.p=p.copy();self.r=r;self.lo=lo;self.hi=hi
  self.bounds=(lo.min(0),hi.max(0))
 def __getitem__(self,k):return self.bounds[k-3]
 def piece(self,i):return self.mesh.hulls[i].transform(self.p,self.r)

def triangle_prisms(tris):
 # Opposite-winding front/back duplicates represent the same surface.
 seen=set();out=[]
 for tri in tris:
  key=tuple(sorted(map(tuple,np.round(tri,6))))
  if key in seen:continue
  seen.add(key);normal=np.cross(tri[1]-tri[0],tri[2]-tri[0]);length=np.linalg.norm(normal)
  if length<1e-7:continue
  d=normal/length*.30
  out.append(Hull(np.concatenate([tri+d,tri-d])))
 return out

def compound(parts,r):
 result=[]
 for vertices,*_ in parts:
  triangles=np.asarray(vertices)*r
  mesh=trimesh.Trimesh(vertices=triangles.reshape(-1,3),faces=np.arange(triangles.size//3).reshape(-1,3),process=True)
  for piece in mesh.split(only_watertight=False,repair=False):
   if piece.is_watertight and piece.is_convex:
    result.append(Hull(piece.vertices))
   else:
    # Authored chair/desk meshes include holes and concavities within a single
    # material primitive. A convex envelope would bridge those empty spaces.
    prisms=triangle_prisms(piece.triangles)
    if prisms:result.append(MeshParts(prisms))
 if not result:raise ValueError('no collision geometry')
 return result

def text_hulls(alpha,r):
 # Raster silhouette runs preserve spaces and letter counters rather than
 # treating an entire connected word as a rectangle. Merge identical runs.
 h,w=alpha.shape;scale=2*r/w;active={};rects=[]
 for y in range(h+1):
  row=alpha[y]>64 if y<h else np.zeros(w,bool)
  edges=np.flatnonzero(np.diff(np.r_[False,row,False]));runs=set(map(tuple,edges.reshape(-1,2)))
  for run,start in list(active.items()):
   if run not in runs:rects.append((*run,start,y));del active[run]
  for run in runs:active.setdefault(run,y)
 return [MeshParts([Hull(box(((b-a)*scale,(d-c)*scale,1.),((a+b-w)*scale/2,(h-c-d)*scale/2,0))) for a,b,c,d in rects])]

def sat(a,b):
 if np.any(a[4]<b[3]) or np.any(b[4]<a[3]):return None
 if not isinstance(a,MeshWorld) and not isinstance(b,MeshWorld):return convex_sat(a,b)
 if isinstance(a,MeshWorld) and isinstance(b,MeshWorld):
  pairs=np.argwhere(np.all(a.hi[:,None,:]>=b.lo[None,:,:],axis=2)&np.all(b.hi[None,:,:]>=a.lo[:,None,:],axis=2))
  hits=(convex_sat(a.piece(i),b.piece(j)) for i,j in pairs)
 elif isinstance(a,MeshWorld):
  ids=np.flatnonzero(np.all(a.hi>=b[3],axis=1)&np.all(b[4]>=a.lo,axis=1));hits=(convex_sat(a.piece(i),b) for i in ids)
 else:
  ids=np.flatnonzero(np.all(b.hi>=a[3],axis=1)&np.all(a[4]>=b.lo,axis=1));hits=(convex_sat(a,b.piece(i)) for i in ids)
 return max((h for h in hits if h is not None),key=lambda h:h[0],default=None)

def convex_sat(a,b):
 va,na,ea,alo,ahi=a;vb,nb,eb,blo,bhi=b
 if np.any(ahi<blo) or np.any(bhi<alo):return None
 # Cheap face-axis rejection first; only build edge axes on surviving pairs.
 faces=np.concatenate([na,nb]);pa=va@faces.T;pb=vb@faces.T
 if np.any(pa.max(0)<=pb.min(0)) or np.any(pb.max(0)<=pa.min(0)):return None
 axes=np.concatenate([faces,np.cross(ea[:,None,:],eb[None,:,:]).reshape(-1,3)])
 n=np.linalg.norm(axes,axis=1);axes=axes[n>1e-7]/n[n>1e-7,None]
 pa=va@axes.T;pb=vb@axes.T;amin=pa.min(0);amax=pa.max(0);bmin=pb.min(0);bmax=pb.max(0)
 plus=amax-bmin;minus=bmax-amin;over=np.minimum(plus,minus)
 if np.any(over<=0):return None
 k=np.argmin(over);normal=axes[k]*(1 if plus[k]<=minus[k] else -1)
 # Contact approximates midpoint of facing support features, not body centers.
 sa=va@normal;sb=vb@normal;ca=va[sa>=sa.max()-.65].mean(0);cb=vb[sb<=sb.min()+.65].mean(0)
 return float(over[k]),normal,(ca+cb)*.5

class Body:
 def __init__(self,hulls,p,v,rot,w,radius,*,text=False):
  self.hulls=hulls;self.p=np.array(p,float);self.v=np.array(v,float);self.rot=rot;self.w=np.array(w,float);self.radius=radius;self.text=text
  self.inv_mass=1/(radius/55)**2
  vtx=np.concatenate([h.v for h in hulls]);size=np.maximum(np.ptp(vtx,axis=0),1.)
  self.inv_inertia=12*self.inv_mass/(np.sum(size**2)-size**2)
 def inertia(self):
  r=self.rot.as_matrix();return (r*self.inv_inertia)@r.T if not self.text else np.zeros((3,3))
 def world(self):return [h.transform(self.p,self.rot.as_matrix()) for h in self.hulls]

def collide(a,b,contact):
 depth,n,c=contact;ia,ib=a.inv_mass,b.inv_mass;ra=c-a.p;rb=c-b.p;A,B=a.inertia(),b.inertia()
 rel=(b.v+np.cross(b.w,rb))-(a.v+np.cross(a.w,ra));speed=rel@n
 correction=max(0,depth-.08)*.8/(ia+ib)*n;a.p-=correction*ia;b.p+=correction*ib
 if speed>=-.001:return False
 def impulse(direction,mag):
  j=direction*mag;a.v-=j*ia;b.v+=j*ib;a.w-=A@np.cross(ra,j);b.w+=B@np.cross(rb,j)
 def denom(d):
  ca=np.cross(ra,d);cb=np.cross(rb,d);return ia+ib+ca@A@ca+cb@B@cb
 j=-(1+.82)*speed/denom(n);impulse(n,j)
 tangent=rel-speed*n;length=np.linalg.norm(tangent)
 if length>1e-7:
  t=tangent/length;impulse(t,max(-.22*j,-length/denom(t)))
 return True

def text_rotation(t):
 # Slower, gentle three-axis tumble, with the front always directed downward.
 return Rotation.from_euler('xyz',np.deg2rad([7*np.sin(t*.71),6*np.cos(t*.83),9*np.sin(t*.51+.8)]))

def simulate(bodies,seconds,fps):
 steps=round(seconds/DT);stride=round(1/(fps*DT));history=[];contacts=0;pair_contacts=set();min_spin=1e9
 for step in range(steps+1):
  t=step*DT
  if step%stride==0:history.append((np.array([b.p.copy() for b in bodies]),np.array([b.rot.as_matrix() for b in bodies])))
  if step==steps:break
  for b in bodies:
   b.p+=b.v*DT
   if b.text:b.rot=text_rotation(t+DT);b.w=(text_rotation(t+DT)*text_rotation(t).inv()).as_rotvec()/DT
   else:
    speed=np.linalg.norm(b.w)
    if speed<MIN_SPIN:b.w=b.w*MIN_SPIN/speed if speed>1e-8 else np.full(3,MIN_SPIN/np.sqrt(3))
    if speed>MAX_SPIN:b.w*=MAX_SPIN/speed
    b.rot=Rotation.from_rotvec(b.w*DT)*b.rot;min_spin=min(min_spin,np.linalg.norm(b.w))
   # Keep the sparse composition inside a shallow zero-gravity volume. Wall impacts
   # use the actual rotated compound extrema rather than the bounding sphere.
   world=b.world();lo=np.min([h[3] for h in world],0);hi=np.max([h[4] for h in world],0)
   for k,(lower,upper) in enumerate([(48,976),(48,976),(-100,100)]):
    if lo[k]<lower:b.p[k]+=lower-lo[k];b.v[k]=abs(b.v[k])
    if hi[k]>upper:b.p[k]-=hi[k]-upper;b.v[k]=-abs(b.v[k])
  worlds=[b.world() for b in bodies]
  for i,a in enumerate(bodies):
   for j in range(i):
    b=bodies[j]
    if np.linalg.norm(a.p-b.p)>a.radius+b.radius+3:continue
    # Deepest component contact once per pair per substep, avoiding duplicate impulses
    # on overlapping compound pieces. Subsequent fixed substeps resolve remaining contacts.
    hits=[c for h in worlds[i] for k in worlds[j] if (c:=sat(h,k)) is not None]
    if hits:
     if collide(a,b,max(hits,key=lambda c:c[0])):contacts+=1;pair_contacts.add((i,j))
     worlds[i]=a.world();worlds[j]=b.world()
   # A corrected body may have moved; refresh before subsequent pair checks.
   worlds[i]=a.world()
 print(f'compound collision impulses: {contacts}; unique pairs: {len(pair_contacts)}; minimum spin: {min_spin:.3f} rad/s',flush=True)
 return history
