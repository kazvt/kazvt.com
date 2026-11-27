"""Solid vector-font extrusion and its exact convex-prism decomposition.
The inscription is one rigid assembly of disconnected glyphs, not a billboard.
Only the offline bake uses fontTools/Shapely; no browser dependency.
"""
from fontTools.ttLib import TTFont
from shapely import constrained_delaunay_triangles
from shapely.geometry import Polygon
from shapely.geometry.polygon import orient
import numpy as np
import trimesh
from sky_physics import Hull, MeshParts

FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
INSCRIPTION='ILY LILLIE'

def lettering(font_path=FONT):
    """Return render triangle parts, normalized solid convex pieces and inertia.

    The selected capital glyphs have straight on-curve outlines, so no curve
    flattening or image masks are involved. Fail explicitly if a replacement
    font would require outline/hole handling rather than silently fill it.
    """
    polygons=[]; pen=0
    with TTFont(font_path) as font:
        glyphs=font['glyf']; cmap=font.getBestCmap()
        for char in INSCRIPTION:
            name=cmap[ord(char)]
            if char!=' ':
                coords, ends, flags=glyphs[name].getCoordinates(glyphs)
                if len(ends)!=1 or not all(flag & 1 for flag in flags):
                    raise ValueError('Inscription requires single straight-outline glyphs')
                points=np.asarray(coords,dtype=float)+[pen,0]
                polygon=orient(Polygon(points),sign=1.)
                if not polygon.is_valid or polygon.area<=0:raise ValueError('Invalid glyph outline')
                polygons.append(polygon)
            pen+=font['hmtx'][name][0]
    cap_height=max(p.bounds[3] for p in polygons)-min(p.bounds[1] for p in polygons)
    half_depth=cap_height*.43
    triangles=[]; colors=[]; prisms=[]
    front=np.array([255,224,172]); back=np.array([239,190,226]); side=np.array([167,109,199])
    def lift(points,z):return np.column_stack([points,np.full(len(points),z)])
    def append(tri,color):triangles.append(tri);colors.append(color)
    for polygon in polygons:
        faces=list(constrained_delaunay_triangles(polygon).geoms)
        if not np.isclose(sum(t.area for t in faces),polygon.area,rtol=1e-10):raise ValueError('Glyph triangulation lost area')
        for face in faces:
            xy=np.asarray(orient(face,sign=1.).exterior.coords[:-1]); hi=lift(xy,half_depth);lo=lift(xy,-half_depth)
            append(hi,front);append(lo[::-1],back)
            prisms.append(np.concatenate([lo,hi]))
        xy=np.asarray(polygon.exterior.coords[:-1]);hi=lift(xy,half_depth);lo=lift(xy,-half_depth)
        for i,j in zip(range(len(xy)),np.roll(np.arange(len(xy)),-1)):
            append(np.array([lo[i],lo[j],hi[j]]),side);append(np.array([lo[i],hi[j],hi[i]]),side)
    triangles=np.array(triangles);mesh=trimesh.Trimesh(vertices=triangles.reshape(-1,3),faces=np.arange(triangles.size//3).reshape(-1,3),process=True)
    if not mesh.is_watertight or not mesh.is_winding_consistent or mesh.volume<=0:raise ValueError('Extruded glyph mesh must be a closed positive solid')
    center=mesh.center_mass.copy();scale=np.linalg.norm(triangles-center,axis=2).max()
    triangles=(triangles-center)/scale;prisms=[(p-center)/scale for p in prisms]
    inertia=mesh.moment_inertia/(mesh.mass*scale**2)
    return [(triangles,np.array(colors),None,None)],prisms,inertia

def lettering_hulls(prisms,radius):
    # Each prism is the solid between the very same rendered front/back triangles.
    # The union retains concave corners and all spaces between glyphs.
    return [MeshParts([Hull(p*radius) for p in prisms])]
