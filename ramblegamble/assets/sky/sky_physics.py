"""Offline, zero-gravity compound convex contact solver (pixel-world units).
Broad phase spheres/AABBs only reject pairs; SAT tests the actual component hulls.
No runtime dependency. Mesh hulls approximate curved/concave surfaces, not triangle CCD.
"""
import itertools
import numpy as np
from scipy.spatial import ConvexHull
from scipy.spatial.transform import Rotation

DT=1/120

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
  if len(v)>40:
   # Directional support reduction for curved decorative meshes; keep extremal points.
   axes=np.array([x for x in itertools.product(range(-2,3),repeat=3) if any(x)],float)
   v=v[np.unique(np.argmax(v@axes.T,axis=0))]
  h=ConvexHull(v);self.v=v[h.vertices];self.norm=directions(h.equations[:,:3]);f=v[h.simplices]
  self.edge=directions(np.concatenate([f[:,1]-f[:,0],f[:,2]-f[:,1],f[:,0]-f[:,2]]))
 def transform(self,p,r):
  v=self.v@r.T+p;return (v,self.norm@r.T,self.edge@r.T,v.min(0),v.max(0))

def box(extents,center=(0,0,0)):
 return np.array(list(itertools.product((-1,1),repeat=3)))*np.array(extents)/2+center

def compound(parts,r):
 result=[]
 for vertices,*_ in parts:
  # Preserve component gaps (chair legs, car wheels, book covers, cat limbs).
  v=vertices.reshape(-1,3)*r
  try:result.append(Hull(v))
  except (ValueError,RuntimeError):continue
 if not result:raise ValueError('no collision geometry')
 return result

def sat(a,b):
 va,na,ea,alo,ahi=a;vb,nb,eb,blo,bhi=b
 if np.any(ahi<blo) or np.any(bhi<alo):return None
 axes=np.concatenate([na,nb,np.cross(ea[:,None,:],eb[None,:,:]).reshape(-1,3)])
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
    if speed<.12:b.w=b.w*.12/speed if speed>1e-8 else np.array([.08,.08,.08])
    if speed>2.4:b.w*=2.4/speed
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
    if hits and collide(a,b,max(hits,key=lambda c:c[0])):contacts+=1;pair_contacts.add((i,j))
   # A corrected body may have moved; refresh before subsequent pair checks.
   worlds[i]=a.world()
 print(f'compound collision impulses: {contacts}; unique pairs: {len(pair_contacts)}; minimum spin: {min_spin:.3f} rad/s',flush=True)
 return history
