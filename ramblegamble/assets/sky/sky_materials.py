"""Deterministic offline surface maps; no external photographs claimed."""
import numpy as np
import cv2
S=256
Y,X=np.mgrid[0:S,0:S].astype(np.float32)/S

def material_map(kind,seed):
 rng=np.random.default_rng(seed)
 def noise(n):return cv2.resize(rng.random((n,n)).astype(np.float32),(S,S),interpolation=cv2.INTER_CUBIC)-.5
 fine=noise(S);coarse=noise(12);mid=noise(48)
 if kind=='wood':tone=1+.15*np.sin(2*np.pi*(Y*31+2*coarse+.3*np.sin(X*10)))+.26*coarse+.09*mid+.06*fine
 elif kind=='fabric':tone=1+.16*np.sin(X*2*np.pi*64)*np.sin(Y*2*np.pi*64)+.22*coarse+.11*fine
 elif kind=='paper':tone=1+.14*mid+.12*fine+.18*coarse+.06*np.sin(Y*2*np.pi*43)
 elif kind=='metal':tone=1+.19*np.sin(Y*2*np.pi*90+coarse)+.27*coarse+.12*fine
 elif kind=='rubber':tone=1+.23*mid+.15*fine+.12*np.sin(X*2*np.pi*18)
 elif kind=='fur':tone=1+.17*np.sin((Y+coarse*.065)*2*np.pi*55)+.34*coarse+.16*fine
 elif kind=='glass':tone=.83+.36*np.exp(-((X+Y-.85)/.11)**2)+.17*coarse
 else:tone=1+.18*coarse+.09*mid+.06*fine
 if kind in ('paint','metal','wood'):
  wear=np.zeros((S,S),np.float32)
  for _ in range(35):
   x,y=rng.integers(0,S,2);cv2.line(wear,(int(x),int(y)),(int(min(S-1,x+rng.integers(2,18))),int(min(S-1,y+1))),float(rng.uniform(.08,.22)),1)
  tone-=wear
 return np.clip(tone,.55,1.4).astype(np.float32)

def classify(name,color):
 r,g,b=color/255
 if name in ('television','arcade','submarine','plane') and b>r and max(color)<145:return 'glass'
 if name in ('cart','lamp','telephone','cassette','train','scooter','plane','submarine') and max(color)-min(color)<45:return 'metal'
 if name in ('train','scooter') and max(color)<90:return 'rubber'
 if name in ('armchair','umbrella'):return 'fabric'
 if name=='guitar' and r>.55:return 'wood'
 if name.startswith('cat'):return 'fur' if not(r>.8 and g>.6 and b<.5) else 'paint'
 if name.startswith('book'):return 'paper' if r>.8 and g>.75 and b>.65 else 'fabric' if r>.55 else 'metal'
 if name.startswith('car'):
  if max(color)<90:return 'rubber'
  if b>r and max(color)<145:return 'glass'
  if max(color)-min(color)<35:return 'metal'
  return 'paint'
 if name.startswith(('desk','table','boat')):return 'wood' if r>.55 else 'metal'
 if name.startswith('chair'):return 'metal' if max(color)-min(color)<55 else 'fabric'
 return 'paint'

def mapped_parts(name,parts):
 result=[]
 for i,(verts,colors,uv,tex) in enumerate(parts):
  if tex is not None and uv is not None:
   if name.startswith(('card','die')) or name=='text':result.append((verts,colors,uv,tex));continue
   tone=cv2.resize(material_map('fabric' if name.startswith('chair') else 'wood',i+37),(tex.shape[1],tex.shape[0]))
   image=tex.copy();image[:,:,:3]=np.uint8(np.clip(image[:,:,:3]*tone[:,:,None],0,255));result.append((verts,colors,uv,image));continue
  # Preserve per-face color differences (e.g. sail panels).
  for color in np.unique(colors,axis=0):
   mask=np.all(colors==color,axis=1);v=verts[mask];c=colors[mask]
   tone=material_map(classify(name,color),13+i*7+sum(map(ord,name)))
   normal=np.cross(v[:,1]-v[:,0],v[:,2]-v[:,0]);axis=np.argmax(np.abs(normal),axis=1)
   coords=np.empty((*v.shape[:2],2),float)
   for a in range(3):coords[axis==a]=v[axis==a][:,:,[j for j in range(3) if j!=a]]*.85+.5
   image=np.empty((S,S,4),np.uint8);image[:,:,:3]=np.uint8(np.clip(color*tone[:,:,None],0,255));image[:,:,3]=255
   result.append((v,c,coords,image))
 return result
