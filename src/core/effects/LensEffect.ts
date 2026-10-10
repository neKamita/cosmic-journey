import { Effect, EffectAttribute } from 'postprocessing';
import { Matrix4, Uniform, Vector3, type PerspectiveCamera, type WebGLRenderer } from 'three';
import lensFrag from '../../shaders/blackhole/lens.frag';
import { BLACK_HOLE, GALAXY } from '../../config/layout';

/** Disk extent in Schwarzschild radii: inner edge at the ISCO (3 r_s). */
export const DISK_INNER = 3;
export const DISK_OUTER = 12;

/** Basis of the accretion disk plane: it lies in the galactic plane. */
export function diskBasis(): { normal: Vector3; u: Vector3; v: Vector3 } {
  const normal = GALAXY.normal.clone();
  const u = GALAXY.toSun.clone();
  const v = new Vector3().crossVectors(normal, u).normalize();
  return { normal, u, v };
}

/** Ray-traced Schwarzschild lens with the accretion disk computed in the same pass. */
export class LensEffect extends Effect {
  private readonly viewProj = new Matrix4();

  constructor(private readonly camera: PerspectiveCamera) {
    const basis = diskBasis();
    super('LensEffect', lensFrag, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ['uCamPos', new Uniform(new Vector3())],
        ['uInvProj', new Uniform(new Matrix4())],
        ['uCamWorld', new Uniform(new Matrix4())],
        ['uViewProj', new Uniform(new Matrix4())],
        ['uCenter', new Uniform(BLACK_HOLE.position.clone())],
        ['uRs', new Uniform(BLACK_HOLE.horizon)],
        ['uNormal', new Uniform(basis.normal)],
        ['uBasisU', new Uniform(basis.u)],
        ['uBasisV', new Uniform(basis.v)],
        ['uInner', new Uniform(DISK_INNER)],
        ['uOuter', new Uniform(DISK_OUTER)],
        ['uTime', new Uniform(0)],
        ['uStrength', new Uniform(1)],
        ['uDiskIntensity', new Uniform(0.85)],
      ]),
    });
  }

  setState(time: number, strength: number): void {
    this.uniforms.get('uTime')!.value = time;
    this.uniforms.get('uStrength')!.value = strength;
  }

  override update(_renderer: WebGLRenderer, _input: unknown, _dt?: number): void {
    const camera = this.camera;
    (this.uniforms.get('uCamPos')!.value as Vector3).setFromMatrixPosition(camera.matrixWorld);
    (this.uniforms.get('uInvProj')!.value as Matrix4).copy(camera.projectionMatrixInverse);
    (this.uniforms.get('uCamWorld')!.value as Matrix4).copy(camera.matrixWorld);
    this.viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    (this.uniforms.get('uViewProj')!.value as Matrix4).copy(this.viewProj);
  }
}
