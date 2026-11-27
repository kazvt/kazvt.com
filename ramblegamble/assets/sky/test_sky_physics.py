"""Run offline: python -m unittest discover -p 'test_sky_physics.py'."""
import unittest
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation
from sky_lettering import lettering, lettering_hulls
from sky_physics import Body,Hull,box,sat,collide,simulate,compound,MIN_SPIN,MAX_SPIN,MeshParts

class PhysicsTests(unittest.TestCase):
 def test_narrowphase_rejects_broadphase_overlap(self):
  h=Hull(box((12,1,1)));i=np.eye(3)
  self.assertIsNone(sat(h.transform([0,0,0],i),h.transform([0,2,0],i)))
  self.assertIsNotNone(sat(h.transform([0,0,0],i),h.transform([0,.8,0],i)))
 def test_compound_empty_chair_space(self):
  legs=[Hull(box((1,8,1),(x,0,z))) for x in (-4,4) for z in (-4,4)]
  probe=Hull(box((2,2,2))).transform([0,0,0],np.eye(3))
  self.assertFalse(any(sat(h.transform([0,0,0],np.eye(3)),probe) for h in legs))
 def test_off_center_contact_impulse_transfers_spin(self):
  h=Hull(box((10,10,10)));a=Body([h],[0,0,0],[10,0,0],Rotation.identity(),[0,0,0],9);b=Body([h],[9,3,0],[-10,0,0],Rotation.identity(),[0,0,0],9)
  c=sat(a.world()[0],b.world()[0]);self.assertIsNotNone(c);self.assertTrue(collide(a,b,c));self.assertGreater(np.linalg.norm(a.w),.01);self.assertGreater(np.linalg.norm(b.w),.01);np.testing.assert_allclose(a.v+b.v,[0,0,0],atol=1e-10)
 def test_z_separation(self):
  h=Hull(box((8,8,1)));self.assertIsNone(sat(h.transform([0,0,0],np.eye(3)),h.transform([0,0,2],np.eye(3))))
 def test_nonstop_rotation_and_unrestricted_text(self):
  h=Hull(box((8,8,8)));b=Body([h],[400,400,0],[12,0,0],Rotation.identity(),[0,0,0],8)
  hist=simulate([b],1,20);self.assertEqual(len(hist),21)
  for (p,r),(p1,r1) in zip(hist,hist[1:]):self.assertGreater(np.linalg.norm(r1-r),.001);np.testing.assert_allclose(p1-p,[[.6,0,0]],atol=1e-8)
  parts,prisms,inertia=lettering();body=Body(lettering_hulls(prisms,95),[500,500,0],[0,0,0],Rotation.identity(),[1.05,.81,.52],95,inertia_per_mass=inertia)
  hist=simulate([body],5,20);normals=np.array([r[0,:,2] for _,r in hist]);self.assertLess(normals[:,2].min(),-.6);self.assertGreater(np.ptp(normals[:,0]),1);self.assertGreater(np.ptp(normals[:,1]),1)
  self.assertTrue(np.all(np.linalg.eigvalsh(body.inertia())>0))
  for (_,a),(_,b) in zip(hist,hist[1:]):self.assertGreater(Rotation.from_matrix(b[0]@a[0].T).magnitude(),.01)

class RenderTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  import importlib.util
  spec=importlib.util.spec_from_file_location('render_sky',Path(__file__).with_name('render-sky.py'));cls.render=importlib.util.module_from_spec(spec);spec.loader.exec_module(cls.render)
 def test_two_sparse_casts_and_genuinely_new_model_geometry(self):
  from sky_models import CASTS,RADII,new_models
  self.assertEqual([len(c) for c in CASTS],[17,17]);self.assertEqual(len(RADII),17)
  a,b=(set(c)-{'orb','text'} for c in CASTS);self.assertEqual(len(a),14);self.assertEqual(len(b),14);self.assertFalse(a&b)
  self.assertTrue(all(c.count('orb')==2 and c.count('text')==1 for c in CASTS))
  r=self.render;new=new_models(r.mesh_box,r.mesh_ellipsoid,r.mesh_cylinder,r.mesh_cone,r.PALETTE)
  self.assertTrue(b<=new.keys())
  for name,parts in new.items():
   v=r.normalized(parts);vertices=np.concatenate([x[0].reshape(-1,3) for x in v]);self.assertTrue(np.isfinite(vertices).all(),name);self.assertAlmostEqual(np.linalg.norm(vertices,axis=1).max(),1.,places=6);self.assertTrue(compound(v,45),name)
  self.assertNotEqual(len(new['car2']),len(r.car(r.PALETTE[0])))
  self.assertNotEqual(len(new['book2']),len(r.book(r.PALETTE[0])))
  self.assertNotEqual(len(new['cat2']),len(r.cat(r.PALETTE[0])))
 def test_exact_authored_concave_mesh_does_not_fill_open_space(self):
  r=self.render;i=np.eye(3);zero=np.zeros(3);probe=Hull(box((2,2,2)))
  # These points lie well inside the OLD whole-component convex envelope,
  # yet are far from any actual triangle of the authored chair or desk.
  for name,point in [('chair',[-5.218,-19.725,0]),('chair2',[5.778,-20.410,-5.211]),('desk',[-12.618,-10.159,0])]:
   parts=r.normalized(r.stage_assets()[name]);verts=np.concatenate([p[0].reshape(-1,3) for p in parts])*45
   shapes=compound(parts,45);self.assertTrue(any(isinstance(h,MeshParts) for h in shapes))
   test=probe.transform(point,i)
   self.assertIsNotNone(sat(Hull(verts).transform(zero,i),test),name)
   self.assertFalse(any(sat(h.transform(zero,i),test) for h in shapes),name)
   # Contact still occurs at an actual triangle rather than disabling the prop.
   face=parts[0][0][0]*45;on_face=probe.transform(face.mean(0),i)
   self.assertTrue(any(sat(h.transform(zero,i),on_face) is not None for h in shapes),name)
 def test_lettering_solid_mesh_exact_prism_volume_and_gaps(self):
  import trimesh
  from scipy.spatial import ConvexHull
  parts,prisms,inertia=lettering();tri,colors,uv,texture=parts[0];self.assertIsNone(uv);self.assertIsNone(texture)
  mesh=trimesh.Trimesh(vertices=tri.reshape(-1,3),faces=np.arange(tri.size//3).reshape(-1,3),process=True)
  self.assertTrue(mesh.is_watertight);self.assertTrue(mesh.is_winding_consistent);self.assertEqual(len(mesh.split()),9)
  self.assertGreater(mesh.extents[2]/mesh.extents[1],.8);self.assertAlmostEqual(mesh.volume,sum(ConvexHull(p).volume for p in prisms),places=10)
  np.testing.assert_allclose(mesh.center_mass,[0,0,0],atol=1e-10);np.testing.assert_allclose(mesh.moment_inertia/mesh.mass,inertia,atol=1e-10)
  # All prism vertices are actual render vertices; letter gaps stay empty.
  for p in prisms:
   for v in p:self.assertTrue(np.any(np.linalg.norm(tri.reshape(-1,3)-v,axis=1)<1e-9))
  components=sorted(mesh.split(),key=lambda m:m.bounds[0,0]);world=lettering_hulls(prisms,95)[0].transform(np.zeros(3),np.eye(3));probe=Hull(box((.5,.5,.5)))
  for a,b in zip(components,components[1:]):
   gap=(a.bounds[1,0]+b.bounds[0,0])*95/2
   self.assertIsNone(sat(world,probe.transform([gap,0,0],np.eye(3))))
  for prism in prisms:self.assertIsNotNone(sat(world,probe.transform(prism.mean(0)*95,np.eye(3))))
 def test_text_contacts_transfer_angular_impulses(self):
  _,prisms,inertia=lettering();a=Body(lettering_hulls(prisms,95),[0,0,0],[0,0,0],Rotation.identity(),[0,0,0],95,inertia_per_mass=inertia)
  # Strike a real letter off-center along its front face.
  p=prisms[0].mean(0)*95;p[2]=prisms[0][:,2].max()*95+.25
  b=Body([Hull(box((2,2,2)))],p,[0,0,-15],Rotation.identity(),[0,0,0],2)
  c=sat(a.world()[0],b.world()[0]);self.assertIsNotNone(c);self.assertTrue(collide(a,b,c));self.assertGreater(np.linalg.norm(a.w),1e-6)
  self.assertGreater(np.linalg.norm(a.v),0)
 def test_lettering_renders_front_back_and_real_sidewalls(self):
  r=self.render;parts,_,_=lettering();masks=[];colors=[]
  for rotation in (Rotation.identity(),Rotation.from_euler('y',90,degrees=True),Rotation.from_euler('y',180,degrees=True)):
   canvas=np.zeros((r.N,r.N,4),np.uint8);depth=np.full((r.N,r.N),-np.inf,np.float32)
   r.render_mesh(canvas,depth,parts,np.array([512,512]),95,rotation.as_matrix());masks.append(np.count_nonzero(canvas[:,:,3]));colors.append(canvas[canvas[:,:,3]>0,:3].mean(0))
  self.assertGreater(min(masks),100);self.assertNotEqual(masks[0],masks[1]);self.assertGreater(np.linalg.norm(colors[0]-colors[2]),15)
 def test_angular_motion_has_stronger_floor_and_cap(self):
  h=Hull(box((8,8,8)));b=Body([h],[400,400,0],[0,0,0],Rotation.identity(),[0,0,0],8)
  hist=simulate([b],1,20)
  for (_,a),(_,z) in zip(hist,hist[1:]):
   speed=Rotation.from_matrix(z[0]@a[0].T).magnitude()*20
   self.assertAlmostEqual(speed,MIN_SPIN,places=7)
  b.w=np.array([10.,10.,10.]);simulate([b],.1,20);self.assertAlmostEqual(np.linalg.norm(b.w),MAX_SPIN,places=7)
 def test_eye_does_not_follow_shell(self):
  r=self.render;eye=r.eye_sprite(0,0);a=r.orb_frame(np.eye(3),eye);b=r.orb_frame(Rotation.from_euler('xyz',[1.2,2.,.7]).as_matrix(),eye)
  # Central iris and sclera stay registered exactly while the shell changes.
  np.testing.assert_array_equal(a[140:177,130:190],b[140:177,130:190]);self.assertGreater(np.abs(a[:80,:,:3].astype(float)-b[:80,:,:3]).sum(),10000);np.testing.assert_array_equal(a[:,:,3],b[:,:,3])
 def test_eye_ticks_at_five_fps(self):
  r=self.render;a=np.asarray(r.eye_sprite(68,0));b=np.asarray(r.eye_sprite(69,0));c=np.asarray(r.eye_sprite(72,0));np.testing.assert_array_equal(a,b);self.assertFalse(np.array_equal(a,c))
 def test_pingpong_no_dissolve_no_duplicate_turning_frames(self):
  r=self.render;n=r.FORWARD_COUNT;seq=r.pingpong_indices(n)
  self.assertEqual(n,360);self.assertEqual(r.FORWARD_START,40)
  self.assertEqual(len(seq),718);self.assertEqual(seq[:n],list(range(n)))
  self.assertEqual(seq[n:],list(range(n-2,0,-1)))
  self.assertTrue(all(abs(a-b)==1 for a,b in zip(seq,seq[1:]+seq[:1])))
  self.assertEqual(r.pingpong_indices(2),[0,1])
  with self.assertRaises(ValueError):r.pingpong_indices(1)

class MaterialTests(unittest.TestCase):
 def test_material_maps_are_distinct_bounded_and_repeatable(self):
  from sky_materials import material_map
  maps=[material_map(k,12) for k in ('wood','fabric','paper','metal','rubber','fur','glass','paint')]
  for m in maps:self.assertEqual(m.shape,(256,256));self.assertTrue(np.isfinite(m).all());self.assertGreater(m.std(),.02);self.assertGreaterEqual(m.min(),.54);self.assertLessEqual(m.max(),1.41)
  np.testing.assert_array_equal(maps[0],material_map('wood',12));self.assertFalse(np.array_equal(maps[0],maps[1]))
 def test_face_uv_and_existing_art(self):
  from sky_materials import mapped_parts
  v=np.array([[[0,0,0],[1,0,0],[0,1,0]]],float);c=np.array([[200,150,100]],float);parts=mapped_parts('chair',[(v,c,None,None)]);self.assertEqual(parts[0][2].shape,(1,3,2));self.assertGreater(parts[0][3][:,:,:3].std(),0)
  tex=np.ones((8,8,4),np.uint8)*255;uv=np.zeros((1,3,2));self.assertIs(mapped_parts('card1',[(v,c,uv,tex)])[0][3],tex)

if __name__=='__main__':unittest.main()
