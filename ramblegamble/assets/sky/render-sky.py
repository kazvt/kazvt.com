#!/usr/bin/env python3
"""Offline deterministic sky bake. Requires Python, numpy, scipy, Pillow, opencv, trimesh and FFmpeg.
No runtime models, network access or audio. Optional locally licensed GLB overrides and eye photo.
"""
import argparse, base64, io, json, math, subprocess, tempfile, multiprocessing as mp, os
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.spatial.transform import Rotation
import trimesh
from sky_physics import Body, Hull, box, compound, simulate, text_rotation

HERE=Path(__file__).resolve().parent
N=1024; FPS=20; SECONDS=20; TAU=math.tau
rng=np.random.default_rng(78298)
PALETTE=['#c6a8ee','#ffe3a0','#a5dce9','#f4a5a9','#f8c29b','#e9b5e3','#353041']
def rgb(s):return np.array(tuple(bytes.fromhex(s.lstrip('#'))),float)
def mesh_box(size,at=(0,0,0),color='#c6a8ee'):
 m=trimesh.creation.box(extents=size);m.apply_translation(at);return (m.vertices[m.faces],np.tile(rgb(color),(len(m.faces),1)),None,None)
def mesh_ellipsoid(size,at=(0,0,0),color='#c6a8ee',sub=1):
 m=trimesh.creation.icosphere(subdivisions=sub);m.vertices*=np.array(size);m.apply_translation(at);return (m.vertices[m.faces],np.tile(rgb(color),(len(m.faces),1)),None,None)
def mesh_cylinder(radius,height,at,color,axis='y',sections=12):
 m=trimesh.creation.cylinder(radius=radius,height=height,sections=sections)
 if axis=='y':m.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2,[1,0,0]))
 elif axis=='x':m.apply_transform(trimesh.transformations.rotation_matrix(math.pi/2,[0,1,0]))
 m.apply_translation(at);return (m.vertices[m.faces],np.tile(rgb(color),(len(m.faces),1)),None,None)
def mesh_cone(radius,height,at,color):
 m=trimesh.creation.cone(radius=radius,height=height,sections=4);m.apply_transform(trimesh.transformations.rotation_matrix(-math.pi/2,[1,0,0]));m.apply_translation(at);return (m.vertices[m.faces],np.tile(rgb(color),(len(m.faces),1)),None,None)

def stage_assets():
 j=json.loads((HERE/'../provided/rg_stage.gltf').read_text());raw=base64.b64decode(j['buffers'][0]['uri'].split(',')[1]);
 def acc(i):
  a=j['accessors'][i];b=j['bufferViews'][a['bufferView']];n={'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']];dt=np.dtype({5126:'<f4',5123:'<u2',5125:'<u4',5121:'u1'}[a['componentType']]);return np.ndarray((a['count'],n),dtype=dt,buffer=raw,offset=b.get('byteOffset',0)+a.get('byteOffset',0),strides=(b.get('byteStride',dt.itemsize*n),dt.itemsize)).copy()
 def part(p,node=0,start=None,end=None,tint=None):
  a=p['attributes'];ix=acc(p['indices']).reshape(-1,3)[start:end];v=acc(a['POSITION'])[ix];uv=acc(a['TEXCOORD_0'])[ix];
  n=j['nodes'][node];v=Rotation.from_quat(n.get('rotation',[0,0,0,1])).apply(v.reshape(-1,3)).reshape(v.shape)
  m=j['materials'][p['material']]['pbrMetallicRoughness'];tex=j['textures'][m['baseColorTexture']['index']]['source'];im=np.asarray(Image.open(io.BytesIO(base64.b64decode(j['images'][tex]['uri'].split(',')[1]))).convert('RGBA')).copy()
  if tint:
   a=im[:,:,:3].astype(float);l=(a.mean(2,keepdims=True)/255);im[:,:,:3]=np.clip(rgb(tint)[None,None,:]*(.70+.40*l),0,255)
  return (v,np.ones((len(v),3))*255,uv,im)
 p=j['meshes'][0]['primitives'];out={}
 # Use actual indexed card faces, not an approximation of the art.
 out['card1']=[part(p[2]),part(p[3])];out['card2']=[part(p[4]),part(p[5])]
 out['die']=[part(p[36],start=60,end=72)]
 for name,node,tint in [('chair',9,PALETTE[0]),('desk',8,PALETTE[4]),('chair2',13,PALETTE[2])]:
  out[name]=[part(p,node,tint=tint) for p in j['meshes'][j['nodes'][node]['mesh']]['primitives']]
 return out

def book(color):
 m=[mesh_box((1.2,.20,1.65),(0,0,0),'#f0e3d3'),mesh_box((1.31,.055,1.75),(0,.13,0),color),mesh_box((1.31,.055,1.75),(0,-.13,0),color),mesh_box((.12,.27,1.75),(-.60,0,0),color),mesh_box((.70,.012,.32),(.12,.165,-.23),'#f6e7c4')]
 for i in range(6):m.append(mesh_cylinder(.055,.20,(-.65,.03,-.68+i*.27),'#4b365a',axis='y',sections=8))
 return m

def retro_chair(color):
 m=[mesh_box((.96,.14,.92),(0,0,0),color),mesh_box((.96,.76,.13),(0,.51,-.38),color)]
 for x in [-.38,.38]:
  for z in [-.34,.34]:m.append(mesh_cylinder(.057,.78,(x,-.43,z),'#8e87a7',sections=10))
  m.append(mesh_cylinder(.052,.57,(x,.26,-.39),'#a19ab6'))
 for i in range(3):m.append(mesh_box((.69,.043,.025),(0,.29+i*.19,-.301),'#f0d4e5'))
 return m

def retro_table(color):
 m=[mesh_box((1.55,.13,1.12),(0,.48,0),color)]
 for x in [-.62,.62]:
  for z in [-.43,.43]:m.append(mesh_cylinder(.065,.95,(x,-.04,z),'#a395b4',sections=10))
 return m

def retro_desk(color):
 m=[mesh_box((1.70,.13,1.03),(0,.46,0),color),mesh_box((1.55,.27,.92),(0,.27,0),'#d8a48d')]
 for x in [-.71,.71]:
  for z in [-.40,.40]:m.append(mesh_cylinder(.062,.85,(x,-.13,z),'#aaa0b0',sections=10))
 for x in [-.38,.38]:
  m.append(mesh_box((.70,.19,.034),(x,.27,.47),color));m.append(mesh_box((.19,.036,.07),(x,.28,.52),'#605268'))
 return m

def car(color):
 m=[mesh_box((1.95,.40,.95),(0,.05,0),color),mesh_box((.90,.42,.86),(-.15,.44,0),color),mesh_box((.94,.27,.89),(-.15,.47,0),'#5a647e'),mesh_box((1.00,.075,.94),(-.15,.67,0),color),mesh_box((.14,.17,.96),(.98,-.05,0),'#b4b6c8')]
 for x in [-.65,.65]:
  for z in [-.48,.48]:m.extend([mesh_cylinder(.27,.20,(x,-.19,z),'#292534',axis='z'),mesh_cylinder(.12,.218,(x,-.19,z),'#b0b5c4',axis='z')])
 for z in [-.31,.31]:m.append(mesh_box((.035,.14,.20),(1.0,.15,z),'#ffe5ac'))
 return m

def boat(color):
 # tapered hull constructed as a convex solid, mast, triangular sail.
 v=np.array([[-.95,-.3,-.42],[-.95,-.3,.42],[.65,-.3,-.32],[.65,-.3,.32],[-1,.05,-.57],[-1,.05,.57],[.58,.05,-.49],[.58,.05,.49],[1.30,.05,0],[.85,-.25,0]])
 m=trimesh.convex.convex_hull(v);h=(m.vertices[m.faces],np.tile(rgb(color),(len(m.faces),1)),None,None)
 sail=np.array([[[0,.20,0],[0,1.63,0],[1.05,.20,0]],[[0,.20,.025],[-.82,.20,.025],[0,1.48,.025]]]);return [h,mesh_box((1.6,.08,.8),(-.13,.08,0),'#d8b79d'),mesh_cylinder(.035,1.6,(0,.9,0),'#61475e'),(np.concatenate([sail,sail[:,::-1]]),np.tile(np.array([rgb('#ffedc8'),rgb('#b4dce9')]),(2,1)),None,None)]

def cat(color):
 m=[mesh_ellipsoid((.48,.64,.37),(0,.12,0),color),mesh_ellipsoid((.42,.39,.38),(0,.75,.09),color)]
 for x in [-.27,.27]:
  m.extend([mesh_cone(.22,.38,(x,.96,.05),color),mesh_ellipsoid((.15,.32,.15),(x,-.30,.20),color),mesh_ellipsoid((.09,.065,.055),(x*.78,.80,.415),'#f7d97b'),mesh_ellipsoid((.027,.053,.032),(x*.78,.80,.46),'#1b1722')])
 m.append(mesh_ellipsoid((.065,.045,.05),(0,.66,.46),'#c0829b'))
 for i in range(6):m.append(mesh_ellipsoid((.11,.14,.12),(.37+.105*i,-.26+.065*i*i/3,-.14),color))
 return m

def normalized(parts):
 v=np.concatenate([p[0].reshape(-1,3) for p in parts]);center=(v.max(0)+v.min(0))/2;radius=np.linalg.norm(v-center,axis=1).max();return [((p[0]-center)/radius,p[1],p[2],p[3]) for p in parts]

def override(path,tint):
 scene=trimesh.load(path,force='scene');parts=[]
 for m in scene.dump():
  if not isinstance(m,trimesh.Trimesh):continue
  if len(m.faces)>25000:raise ValueError('Offline override exceeds 25k triangles')
  uv=getattr(m.visual,'uv',None);mat=getattr(m.visual,'material',None);im=getattr(mat,'baseColorTexture',None)
  if im is None: im=getattr(mat,'image',None)
  tex=np.asarray(im.convert('RGBA')) if im is not None else None
  c=np.tile(rgb(tint),(len(m.faces),1));parts.append((m.vertices[m.faces],c,uv[m.faces]*[1,-1]+[0,1] if uv is not None and tex is not None else None,tex))
 if not parts:raise ValueError(f'Empty override {path}')
 return parts

# Fine-grained procedural obsidian/iris fallback. Optional downloaded photograph
# can be supplied by user as a cropped eye image. No claim of photographic source.
E=320; yy,xx=np.mgrid[-1:1:complex(E),-1:1:complex(E)];rr=np.hypot(xx,yy);zz=np.sqrt(np.maximum(0,1-rr*rr));
noise=rng.random((E,E));cloud=cv2.resize(rng.random((18,18)),(E,E),interpolation=cv2.INTER_CUBIC);grain=(noise-.5)*8;marble=np.sin(20*xx+13*yy+7*cloud+3*np.sin(yy*10));light=np.maximum(0,-.48*xx-.53*yy+.65*zz);spec=np.exp(-((xx+.32)**2+(yy+.52)**2)/.019)*62
orb=np.stack([12+16*light+4*marble+grain+spec,8+9*light+3*marble+grain+spec*.7,19+28*light+7*marble+grain+spec*1.25],-1);rim=np.exp(-((rr-.94)/.025)**2)*16;orb+=rim[:,:,None]*[.7,.3,1.5];orb=np.uint8(np.clip(orb,0,255));
# branching blood vessels baked into sclera, radial iris filaments and catchlights
vein=np.zeros((E,E),np.uint8)
for j in range(47):
 a=rng.uniform(0,TAU);pts=[]
 for k in range(12):
  rad=1.05-k*.052;a+=rng.normal(0,.10);pts.append((round((.5+.5*rad*math.cos(a))*(E-1)),round((.5+.23*rad*math.sin(a))*(E-1))))
 cv2.polylines(vein,[np.array(pts,np.int32)],False,int(rng.integers(50,150)),1,cv2.LINE_AA)
 if j%2==0:
  b=np.array(pts[3]);c=b+np.array([rng.integers(-23,23),rng.integers(-12,12)]);d=c+np.array([rng.integers(-15,15),rng.integers(-6,6)]);cv2.polylines(vein,[np.int32([b,c,d])],False,85,1,cv2.LINE_AA)
vein=cv2.GaussianBlur(vein,(3,3),.45)/255

def eye_sprite(frame,phase,photo=None):
 # Discrete 5fps eyelid movement, not a 5Hz luminance flash.
 q=math.floor(frame/FPS*5); blink=(q+phase)%25;opening={17:.54,18:.10,19:.05,20:.56}.get(blink,1.0);irisx=0.;irisy=0.
 shape=np.maximum(0,1-(xx/.80)**2);center=.055*xx+.04;half=(.31*shape**.7)*opening;aperture=np.abs(yy-center)<half;rim_mask=(np.abs(yy-center)<half+.043*shape)&(np.abs(xx)<.83)
 out=orb.astype(float).copy();out[rim_mask]=np.stack([56+12*cloud,21+9*cloud,37+10*cloud],-1)[rim_mask]
 sx=(xx-irisx);sy=yy-center-irisy;ir=np.hypot(sx,sy);theta=np.arctan2(sy,sx);radius=.215;limb=np.clip((radius-ir)/.027,0,1);fibre=(np.sin(theta*83+ir*97+8*cloud)+np.sin(theta*127+ir*45)+np.sin(theta*39-20*ir))/3;inner=np.exp(-((ir-.095)/.043)**2);shade=np.clip(1-.43*(np.abs(yy-center)/(half+.001))**3,.4,1);scl=np.stack([214+12*cloud,183+17*cloud,177+18*cloud],-1)*shade[:,:,None];scl+=vein[:,:,None]*[25,-115,-100];iris=np.stack([62+39*fibre+49*inner,81+42*fibre+18*inner,83+35*fibre-15*inner],-1)*(.48+.52*limb[:,:,None]);scl[ir<radius]=iris[ir<radius];scl[ir<.083]=[7,5,9];highlight=np.exp(-((sx+.065)**2+(sy+.083)**2)/.0007)*180;scl+=highlight[:,:,None]
 if photo is not None:
  # User-supplied cropped photo, mapped to the eye aperture, including lids.
  px=np.clip(((xx/.83+1)*.5*(photo.shape[1]-1)).astype(int),0,photo.shape[1]-1);py=np.clip((((yy-center)/.36+1)*.5*(photo.shape[0]-1)).astype(int),0,photo.shape[0]-1);scl=photo[py,px]*shade[:,:,None]
 out[aperture]=scl[aperture];alpha=np.uint8(np.clip((1-rr)*E,0,1)*255);return Image.fromarray(np.dstack([np.uint8(np.clip(out,0,255)),alpha]),'RGBA')

def text_sprite():
 font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',95);im=Image.new('RGBA',(660,155));d=ImageDraw.Draw(im)
 for k in range(17,0,-1):d.text((13+k*.55,12+k), 'ILY LILLIE',font=font,fill=(92+k*3,53+k*2,116+k*3),stroke_width=1,stroke_fill=(62,35,91))
 d.text((13,12),'ILY LILLIE',font=font,fill='#ffe0ac',stroke_width=1,stroke_fill='#f7b4d9');return im.crop(im.getbbox())

# Spin the shell texture in 3D, while the eye aperture faces the viewer below.
def orb_frame(rot,eye):
 local=np.stack([xx,-yy,zz],-1)@rot
 x,y,z=np.moveaxis(local,-1,0)
 marble2=np.sin(20*x+13*y+8*z+7*np.sin(4*x+3*z)*np.cos(5*y-2*z))
 veins=np.exp(-((np.sin(11*x-7*y+4*z+2*np.sin(z*8)))/.15)**2)*5
 shell=np.clip(orb.astype(float)+(marble2-marble)[:,:,None]*[5,4,9]+veins[:,:,None]*[.6,.35,1.2],0,255)
 shape=np.maximum(0,1-(xx/.83)**2);center=.055*xx+.04
 mask=np.clip((.31*shape**.7+.065-np.abs(yy-center))*55,0,1)*np.clip((.85-np.abs(xx))*55,0,1)
 out=np.asarray(eye);shell=shell*(1-mask[:,:,None])+out[:,:,:3]*mask[:,:,None]
 return np.dstack([np.uint8(shell),out[:,:,3]])

def sprite_depth(canvas,depth,sprite,x,y,r,z):
 im=cv2.resize(sprite,(2*r,2*r),interpolation=cv2.INTER_AREA);d=cv2.resize(zz,(2*r,2*r),interpolation=cv2.INTER_LINEAR)*r+z
 left=round(x-r);top=round(y-r);a=max(0,left);b=max(0,top);c=min(N,left+2*r);e=min(N,top+2*r)
 if a>=c or b>=e:return
 im=im[b-top:e-top,a-left:c-left];d=d[b-top:e-top,a-left:c-left];ds=depth[b:e,a:c];m=(im[:,:,3]>0)&(d>ds);canvas[b:e,a:c][m]=im[m];ds[m]=d[m]

def text_mesh(im):
 h=im.height/im.width;v=np.array([[-1,-h,.025],[1,-h,.025],[1,h,.025],[-1,h,.025]])
 ix=np.array([[0,1,2],[0,2,3]]);uv=np.array([[0,1],[1-1e-6,1],[1-1e-6,0],[0,0]],float);uv[:,1]=np.minimum(uv[:,1],1-1e-6)
 return [(v[ix],np.ones((2,3))*255,uv[ix],np.asarray(im))]

def crossfade(a,b,t):
 aa=a[:,:,3:4].astype(np.float32)/255;ba=b[:,:,3:4].astype(np.float32)/255;alpha=aa*(1-t)+ba*t
 color=(a[:,:,:3]*aa*(1-t)+b[:,:,:3]*ba*t)/np.maximum(alpha,1e-6)
 return np.uint8(np.clip(np.concatenate([color,alpha*255],-1)+.5,0,255))

def raster_triangle(canvas,depth,points,z,color,uv,tex,shade):
 lo=np.maximum(0,np.floor(points.min(0)).astype(int));hi=np.minimum(N,np.ceil(points.max(0)).astype(int)+1);w,h=hi-lo
 if w<=0 or h<=0:return
 p=points-lo;ax,ay=p[0];bx,by=p[1]-p[0];cx,cy=p[2]-p[0];det=bx*cy-by*cx
 if abs(det)<.04:return
 Y,X=np.ogrid[:h,:w];X=X+.5-ax;Y=Y+.5-ay;u=(X*cy-Y*cx)/det;v=(Y*bx-X*by)/det;t=1-u-v
 zz=z[0]*t+z[1]*u+z[2]*v;ds=depth[lo[1]:hi[1],lo[0]:hi[0]];mask=(t>=-.001)&(u>=-.001)&(v>=-.001)&(zz>ds)
 if not mask.any():return
 sub=canvas[lo[1]:hi[1],lo[0]:hi[0]]
 if tex is None or uv is None:
  sub[mask,:3]=np.uint8(np.clip(color*shade,0,255));sub[mask,3]=255;ds[mask]=zz[mask]
 else:
  iy,ix=np.nonzero(mask);weights=np.stack([t[mask],u[mask],v[mask]],axis=-1);q=weights@uv;tx=np.floor((q[:,0]%1)*tex.shape[1]).astype(int);ty=np.floor((q[:,1]%1)*tex.shape[0]).astype(int);pixels=tex[ty,tx];opaque=pixels[:,3]>25;iy=iy[opaque];ix=ix[opaque];pixels=pixels[opaque];sub[iy,ix,:3]=np.uint8(np.clip(pixels[:,:3]*shade,0,255));sub[iy,ix,3]=pixels[:,3];ds[iy,ix]=zz[iy,ix]

def render_mesh(canvas,depth,parts,center,radius,rot,zoffset=0):
 for verts,colors,uv,tex in parts:
  vv=verts@rot.T;normal=np.cross(vv[:,1]-vv[:,0],vv[:,2]-vv[:,0]);norm=np.linalg.norm(normal,axis=1);normal/=np.maximum(1e-9,norm[:,None]);lights=.66+.35*np.maximum(0,normal@np.array([-.38,.55,.74]));p=vv[:,:,:2]*[radius,-radius]+center
  # Back-face culling is essential for authored cards whose front and back
  # share coplanar vertices. A depth buffer removes interpenetration artefacts.
  for i in np.flatnonzero(normal[:,2]>1e-7):raster_triangle(canvas,depth,p[i],vv[i,:,2]*radius+zoffset,colors[i],None if uv is None else uv[i],tex,lights[i])

_worker_frame=None
def bake_one(f):
 return f,_worker_frame(f)

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--models',type=Path);parser.add_argument('--eye',type=Path);parser.add_argument('--output',type=Path,default=HERE);parser.add_argument('--preview-only',action='store_true');args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
 assets=stage_assets();assets.update(chair=retro_chair(PALETTE[0]),desk=retro_desk(PALETTE[4]),table=retro_table(PALETTE[2]),book=book(PALETTE[3]),book2=book(PALETTE[1]),car=car(PALETTE[2]),car2=car(PALETTE[5]),boat=boat(PALETTE[1]),cat=cat(PALETTE[6]),cat2=cat(PALETTE[4]))
 if args.models:
  for k in list(assets):
   path=args.models/(k+'.glb')
   if path.is_file():assets[k]=override(path,PALETTE[0])
 assets={k:normalized(v) for k,v in assets.items()};photo=np.asarray(Image.open(args.eye).convert('RGB')) if args.eye else None
 # Sparse clusters with ample negative space. No model is a live scene object.
 names=['chair','book','orb','boat','card1','cat','car','desk','die','text','orb','book2','chair2','card2','cat2','car2','table']
 radii=[60,51,73,59,50,49,55,67,39,95,64,43,48,48,45,50,49]
 pos=[(180,180),(350,140),(580,220),(810,145),(210,365),(398,363),(760,370),(155,650),(410,595),(560,450),(830,650),(610,720),(330,820),(190,835),(830,855),(565,870),(102,490)]
 vel=rng.uniform(-34,34,(len(names),2));vel[0]=[27,13];vel[1]=[-27,14];vel[6]=[24,25];vel[10]=[-26,-24]
 text=text_sprite();assets['text']=text_mesh(text)
 bodies=[];phases=rng.uniform(0,TAU,(len(names),3))
 for i,(name,r) in enumerate(zip(names,radii)):
  ang=phases[i];rot=Rotation.from_euler('xyz',[(1.12 if name.startswith('book') else -.18)+.35*math.sin(ang[0]),.55*math.sin(ang[1])+.28+(math.pi if name=='card2' else 0),.32*math.sin(ang[2])]);w=rng.uniform(-.8,.8,3)
  if name=='orb':
   sphere=trimesh.creation.icosphere(subdivisions=2);hulls=[Hull(sphere.vertices*r)]
  elif name=='text':
   alpha=np.asarray(text)[:,:,3];occupied=np.any(alpha>64,axis=0);edges=np.flatnonzero(np.diff(np.r_[False,occupied,False]));hulls=[]
   for a,b in edges.reshape(-1,2):
    ys=np.nonzero(alpha[:,a:b]>64)[0];scale=2*r/text.width;cx=(a+b-text.width)*scale/2;cy=(text.height-ys.min()-ys.max()-1)*scale/2
    hulls.append(Hull(box(((b-a)*scale,(ys.max()-ys.min()+1)*scale,5),(cx,cy,0))))
   rot=text_rotation(0);w=np.zeros(3)
  else:hulls=compound(assets[name],r)
  bodies.append(Body(hulls,[pos[i][0],-pos[i][1]+N,rng.uniform(-18,18)],[vel[i][0],-vel[i][1],rng.uniform(-9,9)],rot,w,r,text=name=='text'))
 blend=FPS*2;history=simulate(bodies,SECONDS+blend/FPS,FPS);eye_cache={}
 def frame(f):
  p,rotations=history[f];canvas=np.zeros((N,N,4),np.uint8);depth=np.full((N,N),-np.inf,np.float32)
  for i,(name,r) in enumerate(zip(names,radii)):
   if name!='orb':continue
   x,y,z=p[i];y=N-y
   for j in range(17):
    u=(f/(FPS*SECONDS)*(4+j%3)+j*.618+i*.27)%1;angle=j*2.399+u*.8;d=r*(1+.52*u);px=x+math.cos(angle)*d;py=y+math.sin(angle)*d-u*r*.16;size=max(1,round(3.4*(1-u)));cv2.rectangle(canvas,(round(px)-size,round(py)-size),(round(px)+size,round(py)+size),(140+int(j%3)*25,72+int(j%3)*17,175+int(j%3)*20,int(150*math.sin(math.pi*u))),-1)
  for i,(name,r) in enumerate(zip(names,radii)):
   x,y,z=p[i];y=N-y;rot=rotations[i]
   if name=='orb':
    q=int(f/FPS*5);key=(q,i)
    if key not in eye_cache:eye_cache[key]=eye_sprite(f,i,photo)
    sprite_depth(canvas,depth,orb_frame(rot,eye_cache[key]),x,y,r,z)
   else:render_mesh(canvas,depth,assets[name],np.array([x,y]),r,rot,z)
  mask=canvas[:,:,3]==255;noise2=((np.indices((N,N))[0]*13+np.indices((N,N))[1]*17)%11-5)*.45;canvas[mask,:3]=np.uint8(np.clip(canvas[mask,:3].astype(float)+noise2[mask,None],0,255))
  return canvas
 def loop_frame(f):
  if f<FPS*SECONDS-blend:return frame(f+blend)
  i=f-(FPS*SECONDS-blend);t=i/blend;t=t*t*(3-2*t)
  return crossfade(frame(f+blend),frame(i),t)
 with tempfile.TemporaryDirectory() as tmp:
  d=Path(tmp);count=1 if args.preview_only else FPS*SECONDS
  global _worker_frame
  _worker_frame=loop_frame
  pool=mp.get_context("fork").Pool(min(4,os.cpu_count() or 1)) if not args.preview_only and "fork" in mp.get_all_start_methods() else None
  results=pool.imap(bake_one,range(count),chunksize=2) if pool else map(bake_one,range(count))
  for f,a in results:
   if f==0:Image.fromarray(a).save(args.output/'sky-preview.png')
   if args.preview_only:break
   # Extend edge RGB by 2 pixels so subsampled chroma doesn't create black halos.
   color=a[:,:,:3].copy();mask=a[:,:,3]>0;dil=cv2.dilate(color,np.ones((5,5),np.uint8));color[~mask]=dil[~mask];a[:,:,:3]=color
   Image.fromarray(a).save(d/f'{f:04d}.png',compress_level=1)
   if f%50==0:print('frame',f,'/',count,flush=True)
  if pool:pool.close();pool.join()
  if not args.preview_only:
   common=['ffmpeg','-hide_banner','-loglevel','error','-y','-threads','4','-framerate',str(FPS),'-i',str(d/'%04d.png')]
   # Packed matte is cross-browser; one texture, no browser-dependent native alpha.
   subprocess.run(common+['-filter_complex_threads','2','-filter_complex','[0:v]split[c][a];[c]format=rgb24[c1];[a]alphaextract,format=rgb24[a1];[c1][a1]hstack,format=yuv420p','-an','-c:v','libx264','-preset','fast','-crf','19','-threads','4','-movflags','+faststart',str(args.output/'floating-sky-matte.mp4')],check=True)
   subprocess.run(common+['-an','-c:v','libvpx-vp9','-pix_fmt','yuva420p','-b:v','0','-crf','24','-deadline','good','-cpu-used','4','-row-mt','1','-threads','4','-auto-alt-ref','0',str(args.output/'floating-sky-alpha.webm')],check=True)
   print('bake complete',flush=True)
if __name__=='__main__':main()
