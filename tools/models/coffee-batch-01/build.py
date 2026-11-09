"""Build the Batch 01 products with Blender 4.5 LTS.

blender -b -t 4 --python-exit-code 1 --python build.py -- MAPS RENDERS PRODUCT [--render]
"""

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[3]
DEST = ROOT / "assets/models/realistic"
SOURCES = Path(__file__).resolve().parent / "sources"
TAU = math.tau
PRODUCTS = ("americano", "cappuccino", "espresso", "flat-white", "latte-macchiato")


def linear(value):
    channel = value / 255
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055)**2.4


def material(name, color, roughness, metallic=0, alpha=1, transmission=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*map(linear, color), alpha)
    shader = mat.node_tree.nodes.get("Principled BSDF")
    for key, value in {
        "Base Color": mat.diffuse_color, "Roughness": roughness, "Metallic": metallic,
        "Alpha": alpha, "Transmission Weight": transmission,
    }.items():
        shader.inputs[key].default_value = value
    if transmission:
        shader.inputs["IOR"].default_value = 1.46
    return mat


def image_node(mat, path, space):
    nodes = mat.node_tree.nodes
    node = nodes.new("ShaderNodeTexImage")
    node.label = path.stem.replace("-", " ").title()
    node.image = bpy.data.images.load(str(path), check_existing=True)
    node.image.colorspace_settings.name = space
    return node


def beverage_material(maps, product):
    mat = material("Beverage • crema and microfoam", (185, 114, 55), 0.28)
    tree = mat.node_tree
    shader = tree.nodes.get("Principled BSDF")
    base = image_node(mat, maps / "surface.jpg", "sRGB")
    tree.links.new(base.outputs["Color"], shader.inputs["Base Color"])
    normal_map = image_node(mat, maps / "micro-normal.png", "Non-Color")
    normal = tree.nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value = 0.52 if product == "americano" else 0.82
    tree.links.new(normal_map.outputs["Color"], normal.inputs["Color"])
    tree.links.new(normal.outputs["Normal"], shader.inputs["Normal"])

    # glTF samples roughness from G. Keep the texture as a standard PBR input.
    rough = image_node(mat, maps / "roughness.png", "Non-Color")
    channels = tree.nodes.new("ShaderNodeSeparateColor")
    tree.links.new(rough.outputs["Color"], channels.inputs["Color"])
    tree.links.new(channels.outputs["Green"], shader.inputs["Roughness"])
    base.location = (-580, 250)
    rough.location = (-580, 20)
    normal_map.location = (-580, -250)
    channels.location = (-280, 20)
    normal.location = (-280, -250)
    return mat


def layers_material(maps):
    mat = material("Steamed milk, coffee and foam • continuous gradient", (207, 153, 101), 0.43)
    tex = image_node(mat, maps / "layers.jpg", "sRGB")
    tex.location = (-350, 200)
    mat.node_tree.links.new(tex.outputs["Color"], mat.node_tree.nodes.get("Principled BSDF").inputs["Base Color"])
    return mat


def spline(knots, subdivisions=3, clamp=False):
    points = list(map(Vector, knots))
    out = []
    for i, start in enumerate(points[:-1]):
        end = points[i + 1]
        m0 = (end - points[max(0, i - 1)]) * 0.5
        m1 = (points[min(i + 2, len(points) - 1)] - start) * 0.5
        for step in range(subdivisions):
            t = step / subdivisions
            value = start.lerp(end, t*t*(3 - 2*t)) + m0*(t*(1-t)**2) - m1*(t*t*(1-t))
            if clamp:
                value = Vector(max(min(a, b), min(max(a, b), v)) for a, b, v in zip(start, end, value))
            out.append(value)
    return [*out, points[-1]]


def mesh(name, vertices, faces, mat, collection, uv_faces=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    data.materials.append(mat)
    data.polygons.foreach_set("use_smooth", [True] * len(faces))
    if uv_faces:
        uvs = data.uv_layers.new(name="UVMap")
        for poly, coords in zip(data.polygons, uv_faces):
            for loop_id, uv in zip(poly.loop_indices, coords):
                uvs.uv[loop_id].vector = uv
    return obj


def lathe(name, knots, mat, collection, *, count=96, subdivisions=3, tex=None,
          shape=None, reverse=False, ellipsoid=(1, 1), offset=(0, 0, 0)):
    profile = spline(knots, subdivisions, clamp=True)
    height = max(p.y for p in profile) - min(p.y for p in profile)
    bottom = min(p.y for p in profile)
    radius = max(p.x for p in profile)
    vertices, faces, uvs, rings = [], [], [], []
    for r, z in profile:
        ring = []
        for i in range(1 if r < 1e-7 else count):
            theta = TAU * i / count
            actual_r = r + (shape(theta, r, z) if shape else 0)
            x = math.cos(theta) * actual_r * ellipsoid[0] + offset[0]
            y = math.sin(theta) * actual_r * ellipsoid[1] + offset[1]
            ring.append(len(vertices))
            vertices.append((x, y, z + offset[2]))
        rings.append(ring)

    for j, (a, b) in enumerate(zip(rings, rings[1:])):
        if len(a) == len(b) == 1:
            continue
        for i in range(count):
            nxt = (i + 1) % count
            if len(a) == 1:
                face = [a[0], b[nxt], b[i]]
                columns = [i + 0.5, i + 1, i]
                rows = [j, j+1, j+1]
            elif len(b) == 1:
                face = [a[i], a[nxt], b[0]]
                columns = [i, i + 1, i + 0.5]
                rows = [j, j, j+1]
            else:
                face = [a[i], a[nxt], b[nxt], b[i]]
                columns = [i, i+1, i+1, i]
                rows = [j, j, j+1, j+1]
            if tex == "planar":
                uv = [(0.5 + vertices[index][0] / (2 * radius), 0.5 + vertices[index][1] / (2 * radius)) for index in face]
            elif tex == "cylinder":
                uv = [(col / count, (profile[row].y - bottom) / height) for col, row in zip(columns, rows)]
            if tex:
                uvs.append(uv[::-1] if reverse else uv)
            faces.append(face[::-1] if reverse else face)
    return mesh(name, vertices, faces, mat, collection, uvs)


def handle(name, knots, mat, collection, thickness, flattening):
    path = spline(knots, 6)
    rings = 20
    vertices, faces = [], []
    for i, (x, z) in enumerate(path):
        tangent = (path[min(i+1, len(path)-1)] - path[max(0, i-1)]).normalized()
        width = thickness * (1 + 0.16 * math.cos(i * math.pi / (len(path) - 1)))
        for j in range(rings):
            angle = j * TAU / rings
            across = math.cos(angle) * width
            vertices.append((x + tangent.y * across, math.sin(angle) * width * flattening,
                             z - tangent.x * across))
    for i in range(len(path) - 1):
        for j in range(rings):
            a = i * rings + j
            b = i * rings + (j + 1) % rings
            faces.append((a, b, b + rings, a + rings))
    faces.append(tuple(reversed(range(rings))))
    faces.append(tuple(range(len(vertices) - rings, len(vertices))))
    return mesh(name, vertices, faces, mat, collection)


def saucer(radius, ceramic, objects):
    return lathe("Saucer • recessed well and rounded foot", [
        (0, .0021), (radius*.36, .0021), (radius*.43, .0018), (radius*.47, 0),
        (radius*.54, 0), (radius*.57, .0014), (radius*.71, .003),
        (radius*.89, .0064), (radius*.985, .0116), (radius, .0135),
        (radius*.991, .015), (radius*.946, .0148), (radius*.84, .0108),
        (radius*.69, .0077), (radius*.57, .0066), (radius*.51, .0057),
        (radius*.43, .0049), (0, .0049),
    ], ceramic, objects)


def spoon(product, objects):
    steel = material("Polished stainless steel", (197, 194, 184), 0.20, metallic=1)
    bowl = lathe("Teaspoon • pressed bowl", [
        (0, 0), (.005, .0004), (.009, .0015), (.010, .0032), (.0096, .0037),
        (.0088, .003), (.006, .0016), (.002, .0008), (0, .0008),
    ], steel, objects, count=64, ellipsoid=(1.65, 1))
    grip = lathe("Teaspoon • tapered grip", [
        (0, 0), (.004, 0), (.0088, .00025), (.010, .00062), (.010, .0011),
        (.0088, .0015), (.0055, .0017), (0, .0017),
    ], steel, objects, count=64, ellipsoid=(3.7, .40), offset=(.044, 0, .0018))
    angle = -0.09
    scale = 1.00 if product == "americano" else 0.91
    for part in (bowl, grip):
        for vert in part.data.vertices:
            x, y, z = vert.co * scale
            vert.co = (
                x*math.cos(angle) - y*math.sin(angle) - .041*scale,
                x*math.sin(angle) + y*math.cos(angle) - .045*scale,
                z + .011*scale - .10*x + .75*x*x,
            )


def porcelain(product, objects, surface):
    # Each outer and inner silhouette is measured separately from the chosen presentation.
    settings = {
        "americano": {
            "r": .045, "foot": .029, "h": .063, "fill": .0555, "plate": .077,
            "color": (239, 229, 215), "curve": (.0315, .0345, .0415),
            "handle": ((.0415,.0515), (.052,.053), (.062,.047), (.065,.038),
                       (.061,.029), (.051,.025), (.0375,.030)), "tube": .0048,
        },
        "cappuccino": {
            "r": .043, "foot": .022, "h": .056, "fill": .053, "plate": .073,
            "color": (236, 227, 208), "curve": (.025, .034, .041),
            "handle": ((.038,.0465), (.049,.047), (.056,.042), (.058,.034),
                       (.053,.0265), (.044,.022), (.033,.024)), "tube": .0046,
        },
        "espresso": {
            "r": .030, "foot": .0185, "h": .055, "fill": .0415, "plate": .057,
            "color": (230, 233, 231), "curve": (.020, .0235, .0285),
            "handle": ((.0265,.044), (.0345,.045), (.042,.040), (.044,.032),
                       (.038,.024), (.030,.023), (.023,.028)), "tube": .0039,
        },
    }[product]
    r, foot, h, fill = (settings[k] for k in ("r", "foot", "h", "fill"))
    lower, mid, upper = settings["curve"]
    ceramic = material("Vitrified porcelain • glazed", settings["color"], 0.18)
    saucer(settings["plate"], ceramic, objects)
    lip = .0019 if product == "americano" else .00155
    seated = .0049
    cup = lathe("Cup • porcelain wall, rolled lip and interior", [
        (0, seated+.0018), (foot-.003, seated+.0018), (foot-.002, seated),
        (foot, seated), (foot+.0009, seated+.0023), (lower, seated+.007),
        (mid, h*.48), (upper, h*.84), (r-.0004, h-.003),
        (r, h-lip*.65), (r-.0006, h-.0004), (r-lip*.74, h),
        (r-lip*1.57, h-.0007), (r-lip*2, h-.0022), (upper-lip*1.5, h*.84),
        (mid-lip*1.55, h*.48), (lower-.0037, seated+.011), (.014, seated+.007), (0, seated+.0067),
    ], ceramic, objects, subdivisions=4)
    handle("Cup handle • molded ceramic", settings["handle"], ceramic, objects, settings["tube"], 1.25)

    # Intersect the inside wall slightly so a natural meniscus closes without a visible gap.
    radii = [math.hypot(v.co.x, v.co.y) for v in cup.data.vertices
             if fill-.003 <= v.co.z <= fill+.003 and v.co.x > 0.99 * math.hypot(v.co.x, v.co.y)]
    fluid_r = min(radii) + (0.0016 if product != "espresso" else 0.0013)
    liquid_top(fluid_r, fill, surface, objects, 0.00062 if product == "cappuccino" else -0.0003)
    if product != "espresso":
        spoon(product, objects)


def liquid_top(r, z, mat, objects, crown):
    return lathe("Liquid surface • curved meniscus", [
        (0, z+crown), (r*.24, z+crown*.97), (r*.54, z+crown*.78),
        (r*.80, z+crown*.45), (r*.93, z+crown*.12), (r*.985, z+.00012), (r, z+.00057),
    ], mat, objects, tex="planar", reverse=True, subdivisions=2)


def glassware(product, objects, surface, maps):
    ribbed = product == "flat-white"
    if ribbed:
        outer = [
            (0, .0016), (.025, .0016), (.027, 0), (.0315, 0), (.034, .0012),
            (.035, .0037), (.0358, .0078), (.0362, .014), (.0369, .033),
            (.0375, .058), (.0384, .075), (.0388, .079), (.0385, .0808),
            (.0372, .0815), (.036, .081), (.0355, .079), (.035, .064),
            (.0341, .038), (.033, .015), (.031, .009), (.026, .007), (0, .0068),
        ]
        loop = ((.0365,.066), (.045,.067), (.054,.064), (.056,.058),
                (.055,.040), (.054,.030), (.050,.025), (.036,.025))
        fill = .0787
        volume = [(0,.007), (.026,.0073), (.0307,.0095), (.0329,.015),
                  (.034,.038), (.0349,.064), (.0355,fill)]
    else:
        outer = [
            (0, .0018), (.019, .0018), (.0205, 0), (.0245, 0), (.0265, .0015),
            (.0278, .0042), (.0279, .010), (.0285, .017), (.0305, .029),
            (.0342, .053), (.0394, .079), (.0432, .105), (.0451, .121),
            (.0455, .1255), (.0448, .127), (.0434, .1273), (.0427, .1256),
            (.0417, .119), (.0403, .105), (.0366, .079), (.0311, .053),
            (.0269, .029), (.0256, .019), (.0242, .013), (.020, .010), (0, .0095),
        ]
        loop = ((.042,.112), (.051,.113), (.061,.109), (.067,.100), (.067,.087),
                (.061,.074), (.049,.062), (.034,.056))
        fill = .1245
        volume = [(0,.0098), (.0195,.0101), (.0238,.0135), (.0256,.019),
                  (.0267,.029), (.0311,.053), (.0365,.079), (.0402,.105),
                  (.0416,.119), (.0426,fill)]

    physical = material("Clear glass • Cycles transmission", (253, 254, 253), .074, transmission=1)
    portable = material("Clear glass • mobile wall", (239, 243, 235), .15, alpha=.17)
    portable_edge = material("Clear glass • mobile rim, foot and handle", (173, 190, 184), .10, metallic=.23, alpha=.31)
    for mat in (portable, portable_edge):
        mat.surface_render_method = "BLENDED"
        mat.use_backface_culling = True

    def ribs(angle, r, z):
        outer_wall = min(1, max(0, (r - (.034 + z*.029)) / .0014))
        end_fade = max(0, min(1, (z-.002)/.007, (.078-z)/.007))
        return -0.00060 * (0.5 + 0.5*math.cos(56*angle))**1.35 * outer_wall * end_fade

    glass = lathe("Glass • thick wall, rolled rim and solid base", outer, physical, objects,
                  count=336 if ribbed else 112, subdivisions=3, shape=ribs if ribbed else None)
    glass.data.materials.append(physical)
    glass["export_glass_wall"] = True
    for poly in glass.data.polygons:
        poly.material_index = int(poly.center.z < (.007 if ribbed else .012) or poly.center.z > outer[15 if not ribbed else 12][1]-.0021)
    grip = handle("Glass handle • polished solid grip", loop, physical, objects,
                  .00355 if ribbed else .0036, 1.0)
    grip["export_glass_handle"] = True
    layer = layers_material(maps)
    lathe("Beverage body • milk, espresso and foam", volume, layer, objects, tex="cylinder",
          count=112, subdivisions=3)
    liquid_top(volume[-1][0]+.00015, fill, surface, objects, .00063)
    return physical, portable, portable_edge


def center_on_table(objects):
    vertices = [v for obj in objects.objects for v in obj.data.vertices]
    low, high = [[fn(v.co[axis] for v in vertices) for axis in range(3)] for fn in (min, max)]
    shift = Vector(((low[0]+high[0])/2, (low[1]+high[1])/2, low[2]))
    for v in vertices:
        v.co -= shift
    return tuple(high[axis]-low[axis] for axis in range(3))


def studio(scene, dimensions):
    stage = bpy.data.collections.new("Studio • excluded from model exports")
    scene.collection.children.link(stage)
    width, depth, height = dimensions
    ground = material("Warm limestone • matte studio", (181, 166, 143), .74)
    shader = ground.node_tree.nodes.get("Principled BSDF")
    noise = ground.node_tree.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 210
    tex_coords = ground.node_tree.nodes.new("ShaderNodeTexCoord")
    ground.node_tree.links.new(tex_coords.outputs["Object"], noise.inputs["Vector"])
    ramp = ground.node_tree.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = tuple(map(linear, (167,153,132))) + (1,)
    ramp.color_ramp.elements[1].color = tuple(map(linear, (195,181,159))) + (1,)
    ground.node_tree.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    ground.node_tree.links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
    mesh("Limestone sweep", [(-5,-5,-.00012),(5,-5,-.00012),(5,5,-.00012),(-5,5,-.00012)],
         [(0,1,2,3)], ground, stage)

    def area(name, loc, energy, size, color, vertical=None):
        light = bpy.data.lights.new(name, "AREA")
        light.energy, light.color, light.size = energy, color, size
        if vertical:
            light.shape = "RECTANGLE"
            light.size_y = vertical
        obj = bpy.data.objects.new(name, light)
        stage.objects.link(obj)
        obj.location = loc
        obj.rotation_euler = (Vector((0,0,height*.32))-obj.location).to_track_quat("-Z","Y").to_euler()

    area("Window • soft key", (-.24,-.18,.37), 6.5, .25, (1,.96,.90), .36)
    area("Strip • back edge", (.13,.21,.30), 3.5, .075, (1,.93,.84), .23)
    area("Bounce • cool fill", (.18,-.18,.17), .95, .20, (.86,.93,1), .25)
    scene.world = bpy.data.worlds.new("Soft ambient studio")
    scene.world.color = (.15,.15,.15)
    camera = bpy.data.cameras.new("Product camera")
    obj = bpy.data.objects.new("Product camera", camera)
    stage.objects.link(obj)
    scene.camera = obj
    camera.type = "ORTHO"
    camera.lens = 52
    camera.clip_start = .01
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 20
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    scene.cycles.transmission_bounces = 6
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -.32
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.resolution_x = scene.render.resolution_y = 600
    return obj


def camera_view(camera, dimensions, azimuth, elevation, frame):
    width, depth, height = dimensions
    a, e = map(math.radians, (azimuth, elevation))
    direction = Vector((math.sin(a)*math.cos(e), -math.cos(a)*math.cos(e), math.sin(e)))
    target = Vector((0, 0, height*.46 if elevation < 75 else height*.08))
    camera.location = target + direction * .48
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z","Y").to_euler()
    camera.data.ortho_scale = max(width, depth, height) * frame


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("maps", type=Path)
    parser.add_argument("renders", type=Path)
    parser.add_argument("product", choices=PRODUCTS)
    parser.add_argument("--render", action="store_true")
    parser.add_argument("--views", nargs="+", choices=("three-quarter", "front", "right", "top"))
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:])
    product = args.product
    slug = f"alba-{product}"
    maps = (args.maps / product).resolve()
    output = (args.renders / product).resolve()
    output.mkdir(exist_ok=True, parents=True)
    SOURCES.mkdir(exist_ok=True, parents=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene["reference_notes"] = "Reference-guided modeling. Dimensions estimated in meters."
    objects = bpy.data.collections.new("Product • meter-scale export")
    scene.collection.children.link(objects)
    surface = beverage_material(maps, product)
    glass = None
    if product in {"flat-white", "latte-macchiato"}:
        glass = glassware(product, objects, surface, maps)
    else:
        porcelain(product, objects, surface)
    dimensions = center_on_table(objects)
    width, depth, height = dimensions
    (output / "bounds.json").write_text(json.dumps([width,height,depth]), encoding="utf8")
    camera = studio(scene, dimensions)
    hero_frame = 1.37 if glass else 1.22
    camera_view(camera, dimensions, 18, 35, hero_frame)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_perspective = "CAMERA"
    bpy.ops.file.pack_all()
    bpy.context.preferences.filepaths.save_version = 0
    # Save the studio and transparent glass materials in the editable source.
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES / f"{slug}.blend"), compress=True)

    if glass:
        physical, mobile_wall, mobile_edge = glass
        for obj in objects.objects:
            if obj.get("export_glass_wall"):
                obj.data.materials[0] = mobile_wall
                obj.data.materials[1] = mobile_edge
            if obj.get("export_glass_handle"):
                obj.data.materials[0] = mobile_edge
    for obj in objects.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = next(iter(objects.objects))
    bpy.ops.export_scene.gltf(filepath=str(DEST/f"{slug}.glb"), export_format="GLB",
                              use_selection=True, export_animations=False, export_tangents=True)
    bpy.ops.wm.usd_export(filepath=str(DEST/f"{slug}.usdz"), selected_objects_only=True,
                          convert_orientation=True, export_global_forward_selection="NEGATIVE_Z",
                          export_global_up_selection="Y", export_animation=False, export_subdivision="BEST_MATCH",
                          export_mesh_colors=False, export_lights=False, export_cameras=False,
                          export_custom_properties=False, generate_preview_surface=True)
    if not (args.render or args.views):
        return
    if glass:
        for obj in objects.objects:
            if obj.get("export_glass_wall"):
                obj.data.materials[0] = obj.data.materials[1] = physical
            if obj.get("export_glass_handle"):
                obj.data.materials[0] = physical
    for view, azimuth, elevation, frame, size in (
        ("three-quarter", 18, 35, hero_frame, 600),
        ("front", 0, 8, 1.18, 480),
        ("right", 90, 8, 1.18, 480),
        ("top", 0, 90, 1.13, 480),
    ):
        if args.views and view not in args.views:
            continue
        camera_view(camera, dimensions, azimuth, elevation, frame)
        scene.render.resolution_x = scene.render.resolution_y = size
        scene.render.filepath = str(output / f"{view}.png")
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
