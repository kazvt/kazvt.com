import { sampleVipAmbience } from './vip-atmosphere.mjs';

const clamp01 = value => Math.max(0, Math.min(1, value));
const smooth = value => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const validPosition = position => Boolean(position &&
  Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z));

// Match the VIP ambience's 3D doorway falloff and give the Smeemo hideout its
// own soft spherical approach zone. The close-up camera sits inside the silent
// radius; freecam starts hearing music again only after leaving the wider ring.
export const MUSIC_ZONE = Object.freeze({
  smeemoSilentDistance: 3.6,
  smeemoFadeDistance: 8.4,
  portalCrossingMargin: 0.24,
  portalExitMargin: 0.42,
});

export function sampleSmeemoMusicGain(position, anchor, zone = MUSIC_ZONE) {
  if (!validPosition(position) || !validPosition(anchor)) return 1;
  const distance = Math.hypot(position.x - anchor.x, position.y - anchor.y, position.z - anchor.z);
  if (distance <= zone.smeemoSilentDistance + 1e-9) return 0;
  if (distance >= zone.smeemoFadeDistance - 1e-9) return 1;
  return smooth((distance - zone.smeemoSilentDistance) /
    (zone.smeemoFadeDistance - zone.smeemoSilentDistance));
}

export function sampleMusicZoneGain(position, door, smeemoAnchor, {
  insideVip = false,
  focusedVip = false,
  vipGain: sampledVipGain = null,
} = {}) {
  if (!validPosition(position)) return 1;
  const vipGain = Number.isFinite(sampledVipGain)
    ? clamp01(sampledVipGain)
    : sampleVipAmbience(position, door, { inside: insideVip, focused: focusedVip }).room;
  const smeemoGain = sampleSmeemoMusicGain(position, smeemoAnchor);
  // Zones compose by taking the strongest attenuation. This also handles a
  // camera moving directly from one silent area into the other without a bump.
  const combined = Math.min(vipGain, smeemoGain);
  return combined < 1e-9 ? 0 : combined > 1 - 1e-9 ? 1 : combined;
}

function insideDoorAperture(position, door, margin) {
  return position.y >= door.minY - margin && position.y <= door.maxY + margin &&
    position.z >= door.minZ - margin && position.z <= door.maxZ + margin;
}

// Freecam can cross the portal and then move around inside the room, away from
// the aperture. Keep the interior state until it crosses back out or clearly
// returns to the exterior side; a simple distance-to-door test would unmute it
// as soon as it moved deeper into the room.
export function createVipInteriorTracker(door, zone = MUSIC_ZONE) {
  let inside = false;
  let previous = null;

  function update(position) {
    if (!validPosition(position)) return inside;

    if (previous) {
      const dx = position.x - previous.x;
      if (Math.abs(dx) > 1e-9) {
        const t = (door.wallX - previous.x) / dx;
        if (t >= 0 && t <= 1) {
          const crossing = {
            y: previous.y + (position.y - previous.y) * t,
            z: previous.z + (position.z - previous.z) * t,
          };
          if (insideDoorAperture(crossing, door, zone.portalCrossingMargin)) {
            inside = position.x > door.wallX;
          }
        }
      }
    }

    // Also seed correctly if a scene restore or a new freecam session begins
    // just beyond the opening, without a previous sampled crossing.
    if (!inside && position.x > door.wallX + zone.portalCrossingMargin &&
        insideDoorAperture(position, door, zone.portalCrossingMargin)) {
      inside = true;
    }
    if (inside && position.x < door.wallX - zone.portalExitMargin) inside = false;

    if (!previous) previous = { x:position.x, y:position.y, z:position.z };
    else { previous.x=position.x;previous.y=position.y;previous.z=position.z; }
    return inside;
  }

  function reset(position = null) {
    inside = false;
    previous = validPosition(position) ? { x: position.x, y: position.y, z: position.z } : null;
  }

  return {
    update,
    reset,
    get inside() { return inside; },
  };
}
