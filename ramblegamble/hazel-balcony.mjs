import { fitCharacterCloseup } from "./arcade-framing.mjs?v=standing-characters-20261127-v1";
import { characterYaw } from "./character-billboards.mjs?v=fugi-stable-20261127-v1";

// Authored stage world coordinates, measured from rg_stage.gltf. The top
// decorative die reaches y=3.028; the adjoining upper L-shaped ledge is
// y=3.9624, its rear-facing inner edge z=-4.8768, right edge x=15.5448.
// Keep this guest off the three contestant chairs and the host platform.
export const HAZEL_SOURCE = Object.freeze({id:"hazel", label:"Hazel", source:"https://reactive.fugi.tech/basic/1130618562382413834"});
export const HAZEL_LEDGE_Y = 3.9624;
export const HAZEL_CAMERA_YAW = -.60;
export const HAZEL_CAMERA_ELEVATION = .10;
export function hazelBalconyPose() {
  const size = 1.8;
  // Tuck the lower quarter-unit behind the real ledge, so the live artwork
  // reads as perched on the corner. Do not distort or crop the iframe itself:
  // its depth mask naturally hides the portion below the balcony surface.
  return {anchor:{x:15.34,y:HAZEL_LEDGE_Y-.24+size/2,z:-5.14},worldWidth:size,worldHeight:size};
}
export function hazelCameraFrame({anchor,worldWidth,worldHeight}, aspect, fov, near, yawCap, pitchCap) {
  // Lower the aim enough to keep the stacked dice and balcony lip in shot.
  // Frame the context, not the entire tall upper wall or the whole room.
  const target = {x:anchor.x,y:anchor.y-.32,z:anchor.z};
  const yaw=HAZEL_CAMERA_YAW,elevation=HAZEL_CAMERA_ELEVATION;
  const relativeYaw=Math.max(...[-1,1].map(sign=>{
    const eyeYaw=yaw+sign*yawCap;
    return Math.abs(eyeYaw-characterYaw(Math.sin(eyeYaw),Math.cos(eyeYaw)));
  }));
  const distance=fitCharacterCloseup({worldWidth:worldWidth+.35,worldHeight:worldHeight+.9,aspect,fov,near,elevation,pitchCap,relativeYaw});
  const h=Math.sqrt(1-elevation*elevation);
  return {target,position:{x:target.x+Math.sin(yaw)*h*distance,y:target.y+elevation*distance,z:target.z+Math.cos(yaw)*h*distance}};
}
