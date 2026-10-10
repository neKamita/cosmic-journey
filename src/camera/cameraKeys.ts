import { Vector3 } from 'three';
import { at } from './anchors';
import type { CameraKey } from './cameraPath';
import { chapterMeta, type ChapterId } from '../config/chapters';
import {
  BLACK_HOLE,
  EARTH,
  GALAXY,
  JUPITER,
  MARS,
  MERCURY,
  MOON,
  NEPTUNE,
  SATURN,
  SUN,
  URANUS,
  VENUS,
  polar,
  type BodyLayout,
} from '../config/layout';

/** Default horizontal shift of the focused object away from the text column. */
const FRAME = 0.17;

const UP = new Vector3(0, 1, 0);

/**
 * Camera position around a body as a blend of three directions: towards the Sun (lit side), the
 * prograde orbital tangent (side-on, shows the terminator) and world up.
 */
function viewFrom(body: BodyLayout, distance: number, sun: number, side: number, up: number): Vector3 {
  const toSun = SUN.position.clone().sub(body.position).normalize();
  const tangent = new Vector3(toSun.z, 0, -toSun.x);
  const dir = toSun.multiplyScalar(sun).add(tangent.multiplyScalar(side)).addScaledVector(UP, up).normalize();
  return body.position.clone().addScaledVector(dir, distance);
}

/** Position around the galactic centre in the disk frame: azimuth in the disk, elevation above it. */
function galactic(distance: number, azimuthDeg: number, elevationDeg: number): Vector3 {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  const u = GALAXY.toSun.clone();
  const v = new Vector3().crossVectors(GALAXY.normal, u).normalize();
  const inPlane = u.multiplyScalar(Math.cos(az)).addScaledVector(v, Math.sin(az));
  const dir = inPlane.multiplyScalar(Math.cos(el)).addScaledVector(GALAXY.normal, Math.sin(el));
  return GALAXY.center.clone().addScaledVector(dir, distance);
}

type KeyOptions = Omit<CameraKey, 'at' | 'position' | 'target'>;

function key(chapter: ChapterId, t: number, position: Vector3, target: Vector3, options: KeyOptions = {}): CameraKey {
  const frame = chapterMeta(chapter).side === 'left' ? FRAME : -FRAME;
  return { at: at(chapter, t), position, target: target.clone(), frame, ...options };
}

const moonAway = MOON.position.clone().sub(EARTH.position).normalize();
const moonSide = new Vector3(moonAway.z, 0, -moonAway.x);

export const CAMERA_KEYS: readonly CameraKey[] = [
  // 1. Earth from orbit: terminator in view, night side with city lights.
  key('earth', 0, viewFrom(EARTH, 29, 0.3, 1, 0.2), EARTH.position, { fov: 38, near: 0.05, far: 6000, frame: 0.2 }),
  key('earth', 0.5, viewFrom(EARTH, 25, 0.05, 1, 0.12), EARTH.position, { stop: false }),

  // 2. Moon fly-by with Earth hanging behind it.
  key(
    'moon',
    0.18,
    MOON.position.clone().addScaledVector(moonAway, 9).addScaledVector(moonSide, 3.6).add(new Vector3(0, 1.4, 0)),
    MOON.position,
    { fov: 40 },
  ),
  key('moon', 0.6, MOON.position.clone().add(new Vector3(-16, 4, -5)), MOON.position, { stop: false }),

  // 3. Sun.
  key('sun', 0.18, SUN.position.clone().add(new Vector3(150, 45, 120)), SUN.position, {
    fov: 42,
    near: 0.5,
    far: 9000,
  }),
  key(
    'sun',
    0.62,
    SUN.position.clone().add(new Vector3(130, 55, -150)),
    SUN.position.clone().lerp(MERCURY.position, 0.6),
    { stop: false },
  ),

  // 4. Mercury, then Venus.
  key('inner', 0.16, viewFrom(MERCURY, 10, 0.6, 0.8, 0.15), MERCURY.position, { near: 0.05, fov: 38 }),
  // Narrower FOV from further away keeps the off-centre sphere from stretching at the frame edge.
  key('inner', 0.52, viewFrom(VENUS, 30, 0.6, 0.8, 0.12), VENUS.position, { fov: 32 }),

  // 5. Mars: approach, then skim the atmosphere.
  key('mars', 0.18, viewFrom(MARS, 14, 0.55, 0.8, 0.15), MARS.position, { fov: 40 }),
  key('mars', 0.45, viewFrom(MARS, 5.4, 0.3, 1, 0.38), MARS.position.clone().add(new Vector3(0, 1.4, 0)), {
    fov: 48,
    near: 0.02,
  }),

  // 6. Through the asteroid belt towards a comet.
  key('asteroids', 0.04, polar(735, -0.26, 10), polar(800, -0.2, 4), { stop: false, fov: 50, near: 0.1 }),
  key('asteroids', 0.24, polar(800, -0.2, 5), polar(885, -0.1, 16)),
  key('asteroids', 0.62, polar(905, -0.12, 0), JUPITER.position, { stop: false, fov: 45 }),

  // 7. Jupiter and its moons.
  key('jupiter', 0.18, viewFrom(JUPITER, 150, 0.6, 0.8, 0.12), JUPITER.position, { near: 0.5, far: 20000 }),
  key('jupiter', 0.55, viewFrom(JUPITER, 235, 0.15, 1, 0.3), JUPITER.position, { stop: false }),

  // 8. Saturn: orbit around the rings, ending backlit.
  key('saturn', 0.14, viewFrom(SATURN, 195, 0.6, 0.8, 0.3), SATURN.position),
  key('saturn', 0.4, viewFrom(SATURN, 160, -0.1, 1, 0.12), SATURN.position, { stop: false }),
  key('saturn', 0.62, viewFrom(SATURN, 175, -0.85, 0.55, 0.28), SATURN.position),

  // 9. Ice giants.
  key('ice', 0.14, viewFrom(URANUS, 72, 0.6, 0.8, 0.2), URANUS.position),
  key('ice', 0.52, viewFrom(NEPTUNE, 68, 0.6, 0.8, 0.2), NEPTUNE.position),

  // 10. Looking back: the Sun is just a star. Then turn towards the galactic centre.
  key('heliopause', 0.2, polar(4200, 0.75, 1200), SUN.position, { fov: 50, near: 1, far: 60000 }),
  key('heliopause', 0.7, polar(5600, 0.72, 1500), BLACK_HOLE.position, { stop: false }),

  // 11. Sgr A*: approach nearly edge-on to the accretion disk.
  key('blackhole', 0.18, galactic(210, 0, 8), BLACK_HOLE.position, { fov: 40, near: 0.5, far: 80000 }),
  key('blackhole', 0.55, galactic(140, 50, 4), BLACK_HOLE.position),

  // 12. Pull out of the galaxy (geometric spacing keeps the zoom rate even), then out to the cluster.
  key('galaxy', 0.06, galactic(1500, 70, 30), BLACK_HOLE.position, { stop: false, near: 2, far: 300000 }),
  key('galaxy', 0.14, galactic(7000, 85, 36), GALAXY.center, { stop: false }),
  key('galaxy', 0.3, galactic(40000, 95, 28), GALAXY.center, { near: 10 }),
  key('galaxy', 0.62, galactic(46000, 110, 32), GALAXY.center, { stop: false }),
  key('galaxy', 0.85, galactic(48000, 120, 35), GALAXY.center),

  // 13. The cosmic web.
  key('universe', 0.3, galactic(50000, 135, 30), GALAXY.center, { far: 400000 }),
  key('universe', 0.6, galactic(47000, 150, 26), GALAXY.center),
];
