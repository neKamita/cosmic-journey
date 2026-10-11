import {
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  NoColorSpace,
  OrthographicCamera,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from 'three';
import bakeFrag from '../../shaders/planet/bake.frag';
import bakeVert from '../../shaders/planet/bake.vert';

export interface BakedSurface {
  readonly map: Texture;
  readonly normal: Texture | null;
}

const quad = new PlaneGeometry(2, 2);
const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

function renderPass(
  renderer: WebGLRenderer,
  surface: string,
  width: number,
  normalPass: boolean,
  strength: number,
): Texture {
  const height = width / 2;
  const target = new WebGLRenderTarget(width, height, {
    generateMipmaps: true,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter,
    colorSpace: normalPass ? NoColorSpace : SRGBColorSpace,
    depthBuffer: false,
  });
  const material = new ShaderMaterial({
    vertexShader: bakeVert,
    fragmentShader: bakeFrag.replace('#pragma SURFACE', surface),
    defines: normalPass ? { BAKE_NORMAL: '' } : {},
    uniforms: {
      uTexel: { value: Math.PI / height },
      uStrength: { value: strength },
    },
    depthTest: false,
    depthWrite: false,
  });
  const scene = new Scene();
  scene.add(new Mesh(quad, material));

  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(previous);
  material.dispose();

  const texture = target.texture;
  texture.wrapS = RepeatWrapping;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

/**
 * Renders a procedural planet into equirectangular colour (sRGB) and, when `normalStrength` is
 * above zero, normal map textures. Runs once at start-up on the GPU.
 */
export function bakeSurface(
  renderer: WebGLRenderer,
  surface: string,
  options: { width: number; normalStrength?: number },
): BakedSurface {
  const map = renderPass(renderer, surface, options.width, false, 0);
  const strength = options.normalStrength ?? 0;
  const normal = strength > 0 ? renderPass(renderer, surface, options.width, true, strength) : null;
  return { map, normal };
}

/**
 * Frees a baked texture (its GPU texture and framebuffer) once a real map has replaced it. Only call
 * this after no material references the texture any more.
 */
export function disposeBaked(texture: Texture | null): void {
  texture?.renderTarget?.dispose();
}

/** Bake resolution per quality tier. */
export function bakeWidth(tier: 'low' | 'medium' | 'high'): number {
  return tier === 'high' ? 2048 : tier === 'medium' ? 1024 : 512;
}
