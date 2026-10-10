import { Quaternion, Vector3 } from 'three';

/**
 * Artistic scene layout (arbitrary units). Orbits are compressed so the whole solar system fits a
 * scroll journey; planets stay at fixed positions and only spin, so the camera path stays valid.
 */

const DEG = Math.PI / 180;

/** Point on the ecliptic plane (y-up) at radius r and longitude theta (radians). */
export const polar = (r: number, theta: number, y = 0): Vector3 =>
  new Vector3(r * Math.cos(theta), y, r * Math.sin(theta));

export interface BodyLayout {
  readonly position: Vector3;
  readonly radius: number;
  /** Axial tilt in radians (rotation about the local z axis). */
  readonly tilt: number;
  /** Spin speed in radians per second at motion scale 1. */
  readonly spin: number;
}

const body = (position: Vector3, radius: number, tiltDeg: number, spin: number): BodyLayout => ({
  position,
  radius,
  tilt: tiltDeg * DEG,
  spin,
});

export const SUN = body(new Vector3(0, 0, 0), 60, 7.25, 0.01);
export const EARTH = body(polar(460, 0), 6, 23.44, 0.035);
export const MOON = body(EARTH.position.clone().add(new Vector3(-22, 1.5, -17)), 1.65, 6.7, 0.004);
export const MERCURY = body(polar(220, -0.9), 2.3, 0.03, 0.006);
export const VENUS = body(polar(330, -0.75), 5.7, 177.4, -0.003);
export const MARS = body(polar(620, -0.35), 3.2, 25.2, 0.03);
export const JUPITER = body(polar(1200, 0.05), 40, 3.1, 0.05);
export const SATURN = body(polar(1600, 0.3), 34, 26.7, 0.045);
export const URANUS = body(polar(2050, 0.55), 16, 97.8, -0.03);
export const NEPTUNE = body(polar(2450, 0.62), 15.5, 28.3, 0.03);

/** Main asteroid belt: only the arc the camera flies through is populated densely. */
export const BELT = {
  inner: 760,
  outer: 900,
  thickness: 22,
  thetaStart: -0.62,
  thetaEnd: 0.32,
} as const;

/** Galactic frame: the Sun sits on the disk at ~55% of its radius, Sgr A* at the centre. */
const GALACTIC_CENTER = new Vector3(9000, 1200, 7000);
const toSun = GALACTIC_CENTER.clone().negate().normalize();
const helper = new Vector3(0.3, 1, -0.2).normalize();
const diskNormal = helper.clone().sub(toSun.clone().multiplyScalar(helper.dot(toSun))).normalize();

export const GALAXY = {
  center: GALACTIC_CENTER,
  radius: GALACTIC_CENTER.length() / 0.55,
  normal: diskNormal,
  /** Unit vector from the galactic centre towards the Sun (lies in the disk plane). */
  toSun,
  /** Rotation mapping local +Y to the disk normal. */
  orientation: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), diskNormal),
} as const;

export const BLACK_HOLE = {
  position: GALACTIC_CENTER,
  /** Schwarzschild radius in scene units. */
  horizon: 8,
} as const;
