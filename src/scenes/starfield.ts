import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  CubeCamera,
  Group,
  HalfFloatType,
  Mesh,
  Points,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLCubeRenderTarget,
} from 'three';
import bandFrag from '../shaders/stars/band.frag';
import bandVert from '../shaders/stars/band.vert';
import nearVert from '../shaders/stars/near.vert';
import skyVert from '../shaders/stars/sky.vert';
import skyboxFrag from '../shaders/stars/skybox.frag';
import skyboxVert from '../shaders/stars/skybox.vert';
import starFrag from '../shaders/stars/star.frag';
import { GALAXY } from '../config/layout';
import type { QualitySettings } from '../config/quality';
import type { FrameContext } from '../core/frame';
import { clamp, createRng, gaussian } from '../utils/math';
import type { InitContext, SceneModule } from './SceneModule';

const SKY_COUNT = 18000;
const NEAR_COUNT = 2600;
const NEAR_BOX = 2400;

/** Approximate blackbody colour (Tanner Helland's fit), returned in linear space. */
export function kelvinToColor(kelvin: number, out = new Color()): Color {
  const t = kelvin / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  return out.setRGB(clamp(r / 255), clamp(g / 255), clamp(b / 255), SRGBColorSpace);
}

/** Temperature of a random naked-eye-like star: hot stars are over-represented among bright ones. */
function sampleTemperature(rng: () => number): number {
  const x = rng();
  if (x < 0.06) return 12000 + rng() * 14000; // B
  if (x < 0.16) return 7600 + rng() * 2400; // A
  if (x < 0.32) return 6000 + rng() * 1500; // F
  if (x < 0.55) return 5200 + rng() * 800; // G
  if (x < 0.8) return 3900 + rng() * 1300; // K
  return 2800 + rng() * 1000; // M
}

function randomUnit(rng: () => number, out: Vector3): Vector3 {
  const z = rng() * 2 - 1;
  const a = rng() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return out.set(r * Math.cos(a), z, r * Math.sin(a));
}

export class Starfield implements SceneModule {
  readonly id = 'starfield';
  readonly root = new Group();

  private readonly sky: Points<BufferGeometry, ShaderMaterial>;
  private readonly near: Points<BufferGeometry, ShaderMaterial>;
  private readonly band: Mesh<SphereGeometry, ShaderMaterial>;
  private bandTarget: WebGLCubeRenderTarget | null = null;

  constructor(quality: QualitySettings) {
    this.sky = this.createSky();
    this.near = this.createNear();
    this.band = this.createBandSkybox();
    this.root.add(this.band, this.sky, this.near);
    this.setQuality(quality);
  }

  init({ renderer, quality }: InitContext): void {
    const size = quality.tier === 'low' ? 256 : 512;
    this.bandTarget = new WebGLCubeRenderTarget(size, { type: HalfFloatType, generateMipmaps: false });
    const cubeCamera = new CubeCamera(0.1, 10, this.bandTarget);
    const bakeScene = new Scene();
    const bakeMaterial = new ShaderMaterial({
      vertexShader: bandVert,
      fragmentShader: bandFrag,
      side: BackSide,
      depthWrite: false,
      uniforms: {
        uNormal: { value: GALAXY.normal.clone() },
        uCenterDir: { value: GALAXY.center.clone().normalize() },
      },
    });
    const bakeSphere = new Mesh(new SphereGeometry(1, 64, 32), bakeMaterial);
    bakeScene.add(bakeSphere);
    cubeCamera.update(renderer, bakeScene);
    bakeSphere.geometry.dispose();
    bakeMaterial.dispose();
    this.band.material.uniforms.uBand!.value = this.bandTarget.texture;
  }

  update(ctx: FrameContext): void {
    const env = ctx.env;
    const sky = this.sky.material.uniforms;
    sky.uTime!.value = ctx.time;
    sky.uBrightness!.value = env.stars;
    sky.uTwinkle!.value = ctx.motion < 1 ? 0 : 1;

    const near = this.near.material.uniforms;
    near.uOpacity!.value = env.nearStars;
    this.near.visible = env.nearStars > 0.001;

    this.band.material.uniforms.uIntensity!.value = env.milkyWay;
    this.band.visible = env.milkyWay > 0.001 && this.bandTarget !== null;
  }

  setPixelRatio(dpr: number): void {
    this.sky.material.uniforms.uPixelRatio!.value = dpr;
    this.near.material.uniforms.uPixelRatio!.value = dpr;
  }

  setQuality(quality: QualitySettings): void {
    const scale = Math.max(0.35, quality.particleScale);
    this.sky.geometry.setDrawRange(0, Math.floor(SKY_COUNT * scale));
    this.near.geometry.setDrawRange(0, Math.floor(NEAR_COUNT * scale));
  }

  private createSky(): Points<BufferGeometry, ShaderMaterial> {
    const rng = createRng(7);
    const positions = new Float32Array(SKY_COUNT * 3);
    const colors = new Float32Array(SKY_COUNT * 3);
    const sizes = new Float32Array(SKY_COUNT);
    const brightness = new Float32Array(SKY_COUNT);
    const phases = new Float32Array(SKY_COUNT);

    const n = GALAXY.normal;
    const u = GALAXY.center.clone().normalize();
    const v = new Vector3().crossVectors(n, u).normalize();
    const dir = new Vector3();
    const color = new Color();

    for (let i = 0; i < SKY_COUNT; i++) {
      if (rng() < 0.38) {
        // Concentrate part of the stars along the galactic plane, denser towards the centre.
        const lon = rng() < 0.3 ? gaussian(rng) * 0.6 : rng() * Math.PI * 2;
        const lat = gaussian(rng) * 0.11;
        dir
          .copy(u)
          .multiplyScalar(Math.cos(lon))
          .addScaledVector(v, Math.sin(lon))
          .multiplyScalar(Math.cos(lat))
          .addScaledVector(n, Math.sin(lat))
          .normalize();
      } else {
        randomUnit(rng, dir);
      }
      dir.toArray(positions, i * 3);

      const b = Math.pow(rng(), 5);
      brightness[i] = 0.14 + 0.86 * b;
      sizes[i] = 1.15 + 3.4 * Math.pow(b, 1.4);
      kelvinToColor(sampleTemperature(rng), color);
      // The brightest few get HDR values so bloom catches them.
      color.multiplyScalar(b > 0.6 ? 2.2 : 1);
      color.toArray(colors, i * 3);
      phases[i] = rng();
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
    geometry.setAttribute('aBright', new BufferAttribute(brightness, 1));
    geometry.setAttribute('aPhase', new BufferAttribute(phases, 1));

    const material = new ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: starFrag,
      blending: AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uBrightness: { value: 1 },
        uPixelRatio: { value: 1 },
        uTwinkle: { value: 1 },
      },
    });
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = -100;
    return points;
  }

  private createNear(): Points<BufferGeometry, ShaderMaterial> {
    const rng = createRng(11);
    const positions = new Float32Array(NEAR_COUNT * 3);
    const colors = new Float32Array(NEAR_COUNT * 3);
    const sizes = new Float32Array(NEAR_COUNT);
    const brightness = new Float32Array(NEAR_COUNT);
    const color = new Color();

    for (let i = 0; i < NEAR_COUNT; i++) {
      positions[i * 3] = rng() * NEAR_BOX;
      positions[i * 3 + 1] = rng() * NEAR_BOX;
      positions[i * 3 + 2] = rng() * NEAR_BOX;
      kelvinToColor(sampleTemperature(rng), color).toArray(colors, i * 3);
      const b = Math.pow(rng(), 3);
      sizes[i] = 1 + 2.2 * b;
      brightness[i] = 0.25 + 0.75 * b;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
    geometry.setAttribute('aBright', new BufferAttribute(brightness, 1));

    const material = new ShaderMaterial({
      vertexShader: nearVert,
      fragmentShader: starFrag,
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
      uniforms: {
        uBox: { value: NEAR_BOX },
        uOpacity: { value: 0.5 },
        uPixelRatio: { value: 1 },
      },
    });
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    return points;
  }

  private createBandSkybox(): Mesh<SphereGeometry, ShaderMaterial> {
    const material = new ShaderMaterial({
      vertexShader: skyboxVert,
      fragmentShader: skyboxFrag,
      side: BackSide,
      blending: AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uBand: { value: null },
        uIntensity: { value: 1 },
      },
    });
    const mesh = new Mesh(new SphereGeometry(1, 32, 16), material);
    mesh.frustumCulled = false;
    mesh.renderOrder = -110;
    mesh.visible = false;
    return mesh;
  }
}
