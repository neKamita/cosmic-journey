import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  ShaderMaterial,
} from 'three';
import coronaFrag from '../shaders/sun/corona.frag';
import coronaVert from '../shaders/sun/corona.vert';
import sunFrag from '../shaders/sun/sun.frag';
import sunVert from '../shaders/sun/sun.vert';
import { at } from '../camera/anchors';
import { SUN } from '../config/layout';
import type { QualitySettings } from '../config/quality';
import type { FrameContext } from '../core/frame';
import { lerp, smoothstep } from '../utils/math';
import type { SceneModule } from './SceneModule';
import { unitSphere } from './shared/planet';

const CORONA_SCALE = 6.5;

const starVert = /* glsl */ `
uniform float uSize;
uniform float uPixelRatio;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * uPixelRatio;
}
`;

// A star seen from far away: hot core, soft halo and faint diffraction spikes.
const starFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  float core = exp(-r * r * 60.0) * 6.0;
  float halo = exp(-r * 5.0) * 0.6;
  float spikes = (exp(-abs(c.x) * 160.0) + exp(-abs(c.y) * 160.0)) * exp(-r * 3.0) * 0.8;
  float a = (core + halo + spikes) * uOpacity * (1.0 - smoothstep(0.85, 1.0, r));
  gl_FragColor = vec4(uColor * a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * The Sun: animated photosphere, corona billboard, and a point-like "star" it turns into when the
 * camera leaves the solar system. Also owns the occluder mesh the god-rays effect renders.
 */
export class Sun implements SceneModule {
  readonly id = 'sun';
  readonly root = new Group();
  readonly active = [at('earth', 0), at('blackhole', 0.05)] as const;
  /** Light source for GodRaysEffect. Not part of the scene graph on purpose. */
  readonly lightSource: Mesh<BufferGeometry, MeshBasicMaterial>;

  private readonly body = new Group();
  private readonly sphere: Mesh<BufferGeometry, ShaderMaterial>;
  private readonly corona: Mesh<PlaneGeometry, ShaderMaterial>;
  private readonly star: Points<BufferGeometry, ShaderMaterial>;
  private intensity = 2.4;

  constructor(quality: QualitySettings) {
    this.root.position.copy(SUN.position);
    this.root.add(this.body);

    this.sphere = new Mesh(
      unitSphere(Math.max(64, quality.sphereSegments)),
      new ShaderMaterial({
        vertexShader: sunVert,
        fragmentShader: sunFrag,
        uniforms: { uTime: { value: 0 }, uIntensity: { value: this.intensity } },
      }),
    );
    this.sphere.scale.setScalar(SUN.radius);
    this.sphere.rotation.z = SUN.tilt;

    this.corona = new Mesh(
      new PlaneGeometry(2, 2),
      new ShaderMaterial({
        vertexShader: coronaVert,
        fragmentShader: coronaFrag,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uIntensity: { value: 1.6 },
          uSunRadius: { value: 1 / CORONA_SCALE },
        },
      }),
    );
    this.corona.scale.setScalar(SUN.radius * CORONA_SCALE);
    this.corona.frustumCulled = false;
    this.corona.renderOrder = 3;
    this.body.add(this.sphere, this.corona);

    const starGeometry = new BufferGeometry();
    starGeometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0]), 3));
    this.star = new Points(
      starGeometry,
      new ShaderMaterial({
        vertexShader: starVert,
        fragmentShader: starFrag,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uSize: { value: 64 },
          uPixelRatio: { value: 1 },
          uColor: { value: new Color(1, 0.9, 0.78) },
          uOpacity: { value: 0 },
        },
      }),
    );
    this.star.frustumCulled = false;
    this.star.renderOrder = 4;
    this.root.add(this.star);

    this.lightSource = new Mesh(
      unitSphere(32),
      new MeshBasicMaterial({ color: new Color(1, 0.78, 0.5), transparent: true, depthWrite: false }),
    );
    this.lightSource.position.copy(SUN.position);
    this.lightSource.scale.setScalar(SUN.radius * 1.04);

    this.setQuality(quality);
  }

  setPixelRatio(dpr: number): void {
    this.star.material.uniforms.uPixelRatio!.value = dpr;
  }

  setQuality(quality: QualitySettings): void {
    // Without bloom the HDR disc would just clip to white; keep it bright but readable.
    this.intensity = quality.postfx ? 2.4 : 1.5;
    this.corona.material.uniforms.uIntensity!.value = quality.postfx ? 0.75 : 0.6;
    const low = quality.tier === 'low';
    if (Boolean(this.sphere.material.defines.LOW_DETAIL) !== low) {
      if (low) this.sphere.material.defines.LOW_DETAIL = '';
      else delete this.sphere.material.defines.LOW_DETAIL;
      this.sphere.material.needsUpdate = true;
    }
  }

  update(ctx: FrameContext): void {
    const sphere = this.sphere.material.uniforms;
    sphere.uTime!.value = ctx.time;
    sphere.uIntensity!.value = this.intensity;
    this.corona.material.uniforms.uTime!.value = ctx.time;
    this.sphere.rotation.y += ctx.dt * ctx.motion * SUN.spin;

    // Leaving the solar system: the disc shrinks into a point-like star.
    const distance = ctx.camera.position.distanceTo(SUN.position);
    const starMix = smoothstep(2400, 4000, distance);
    const shrink = lerp(1, 0.02, starMix);
    this.body.scale.setScalar(shrink);
    this.body.visible = shrink > 0.03;
    this.lightSource.scale.setScalar(SUN.radius * 1.04 * shrink);
    this.star.material.uniforms.uOpacity!.value = starMix;
    this.star.visible = starMix > 0.001;
  }
}
