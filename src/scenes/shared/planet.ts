import {
  Color,
  LOD,
  Mesh,
  SphereGeometry,
  Vector3,
  type Camera,
  type IUniform,
  type Material,
} from 'three';
import hazeChunk from '../../shaders/planet/haze.glsl';
import { SUN } from '../../config/layout';

const spheres = new Map<number, SphereGeometry>();

/** Shared unit spheres keyed by width segments. */
export function unitSphere(widthSegments: number): SphereGeometry {
  let geometry = spheres.get(widthSegments);
  if (!geometry) {
    geometry = new SphereGeometry(1, widthSegments, Math.max(8, Math.round(widthSegments / 2)));
    spheres.set(widthSegments, geometry);
  }
  return geometry;
}

export interface LodOptions {
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
}

/** Sphere with three detail levels; the object is scaled to `radius`. */
export function createSphereLOD(material: Material, radius: number, maxSegments: number, options: LodOptions = {}): LOD {
  const lod = new LOD();
  const levels: Array<[number, number]> = [
    [Math.max(32, maxSegments), 0],
    [Math.max(32, Math.round(maxSegments / 2)), radius * 30],
    [20, radius * 220],
  ];
  for (const [segments, distance] of levels) {
    const mesh = new Mesh(unitSphere(segments), material);
    mesh.castShadow = options.castShadow ?? false;
    mesh.receiveShadow = options.receiveShadow ?? false;
    lod.addLevel(mesh, distance);
  }
  lod.scale.setScalar(radius);
  return lod;
}

export interface ShaderPatch {
  /** Unique program cache key: patched materials must not share programs with plain ones. */
  readonly key: string;
  readonly uniforms?: Record<string, IUniform>;
  readonly vertex?: ReadonlyArray<readonly [string, string]>;
  readonly fragment?: ReadonlyArray<readonly [string, string]>;
}

function applyReplacements(
  source: string,
  replacements: ReadonlyArray<readonly [string, string]> | undefined,
  key: string,
): string {
  let out = source;
  for (const [target, replacement] of replacements ?? []) {
    if (!out.includes(target)) throw new Error(`[${key}] shader chunk not found: ${target}`);
    out = out.replace(target, replacement);
  }
  return out;
}

/** Extends a built-in material's shaders by chunk replacement (keeps PBR lighting, shadows, fog). */
export function patchMaterial<T extends Material>(material: T, patch: ShaderPatch): T {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, patch.uniforms);
    shader.vertexShader = applyReplacements(shader.vertexShader, patch.vertex, patch.key);
    shader.fragmentShader = applyReplacements(shader.fragmentShader, patch.fragment, patch.key);
  };
  material.customProgramCacheKey = () => patch.key;
  return material;
}

export interface HazeUniforms extends Record<string, IUniform> {
  uHazeSunDir: IUniform<Vector3>;
  uHazeDay: IUniform<Color>;
  uHazeTwilight: IUniform<Color>;
  uHazeStrength: IUniform<number>;
  uHazePower: IUniform<number>;
}

export function hazeUniforms(day: string, twilight: string, strength: number, power = 3): HazeUniforms {
  return {
    uHazeSunDir: { value: new Vector3(1, 0, 0) },
    uHazeDay: { value: new Color(day) },
    uHazeTwilight: { value: new Color(twilight) },
    uHazeStrength: { value: strength },
    uHazePower: { value: power },
  };
}

/** Fragment replacements adding the atmosphere haze to a MeshStandardMaterial. */
export const HAZE_FRAGMENT: ReadonlyArray<readonly [string, string]> = [
  ['#include <common>', `#include <common>\n${hazeChunk}`],
  [
    '#include <opaque_fragment>',
    'outgoingLight += atmosphereHaze(nonPerturbedNormal, normalize(vViewPosition));\n#include <opaque_fragment>',
  ],
];

/** Direction from a fixed body towards the Sun, in world and current view space. */
export class SunDirection {
  readonly world = new Vector3();
  readonly view = new Vector3();

  constructor(from: Vector3) {
    this.world.copy(SUN.position).sub(from).normalize();
  }

  update(camera: Camera): Vector3 {
    return this.view.copy(this.world).transformDirection(camera.matrixWorldInverse);
  }
}
