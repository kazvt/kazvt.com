import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DICE_DOOR_OPENING, isDiceDoorBackingTriangle } from "./dice-doorway.mjs";

test("only triangles wholly inside the door backing plane are removed", () => {
  const inside = [
    { x: 14.8, y: 0.8, z: -6.16 },
    { x: 15.5, y: 0.8, z: -6.16 },
    { x: 15.5, y: 2.1, z: -6.16 },
  ];
  assert.equal(isDiceDoorBackingTriangle(inside), true);
  assert.equal(isDiceDoorBackingTriangle([...inside.slice(0, 2), { x: 16.84, y: 1, z: -6.16 }]), false);
  assert.equal(isDiceDoorBackingTriangle([...inside.slice(0, 2), { x: 15.5, y: 2.6, z: -6.16 }]), false);
  assert.equal(isDiceDoorBackingTriangle([...inside.slice(0, 2), { x: 15.5, y: 1, z: -6.1 }]), false);
});

test("the supplied stage has exactly six backing triangles inside the dice frame", () => {
  const gltf = JSON.parse(readFileSync(new URL("./assets/provided/rg_stage.gltf", import.meta.url), "utf8"));
  const buffer = Buffer.from(gltf.buffers[0].uri.split(",", 2)[1], "base64");
  const stageNode = gltf.nodes.find((node) => node.mesh === 0);
  assert.ok(stageNode, "the room geometry node should exist");

  const quaternion = stageNode.rotation || [0, 0, 0, 1];
  const translation = stageNode.translation || [0, 0, 0];
  const worldVertex = (accessorIndex, vertexIndex) => {
    const accessor = gltf.accessors[accessorIndex];
    const view = gltf.bufferViews[accessor.bufferView];
    const offset = (view.byteOffset || 0) + (accessor.byteOffset || 0) + vertexIndex * (view.byteStride || 12);
    const x = buffer.readFloatLE(offset);
    const y = buffer.readFloatLE(offset + 4);
    const z = buffer.readFloatLE(offset + 8);
    const [qx, qy, qz, qw] = quaternion;
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;
    return {
      x: ix * qw - iw * qx - iy * qz + iz * qy + translation[0],
      y: iy * qw - iw * qy - iz * qx + ix * qz + translation[1],
      z: iz * qw - iw * qz - ix * qy + iy * qx + translation[2],
    };
  };
  const readIndex = (accessor, byteOffset) => {
    const view = gltf.bufferViews[accessor.bufferView];
    const offset = (view.byteOffset || 0) + (accessor.byteOffset || 0) + byteOffset;
    if (accessor.componentType === 5123) return buffer.readUInt16LE(offset);
    if (accessor.componentType === 5125) return buffer.readUInt32LE(offset);
    throw new Error(`Unsupported GLTF index type: ${accessor.componentType}`);
  };

  let cuttableTriangles = 0;
  for (const primitive of gltf.meshes[stageNode.mesh].primitives) {
    const indices = gltf.accessors[primitive.indices];
    const bytesPerIndex = indices.componentType === 5123 ? 2 : 4;
    for (let offset = 0; offset < indices.count; offset += 3) {
      const points = [0, 1, 2].map((corner) =>
        worldVertex(primitive.attributes.POSITION, readIndex(indices, (offset + corner) * bytesPerIndex))
      );
      if (isDiceDoorBackingTriangle(points, DICE_DOOR_OPENING)) cuttableTriangles += 1;
    }
  }

  assert.equal(cuttableTriangles, 6);
});
