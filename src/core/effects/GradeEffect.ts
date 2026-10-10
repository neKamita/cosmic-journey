import { Effect } from 'postprocessing';
import { Color, Uniform } from 'three';

const fragmentShader = /* glsl */ `
uniform vec3 tint;
uniform float saturation;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb * tint;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  outputColor = vec4(mix(vec3(l), c, saturation), inputColor.a);
}
`;

/** Scene-wide colour grade in HDR (before tone mapping): multiplicative tint and saturation. */
export class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', fragmentShader, {
      uniforms: new Map<string, Uniform>([
        ['tint', new Uniform(new Color(1, 1, 1))],
        ['saturation', new Uniform(1)],
      ]),
    });
  }

  setGrade(tint: Color, saturation: number): void {
    (this.uniforms.get('tint')!.value as Color).copy(tint);
    this.uniforms.get('saturation')!.value = saturation;
  }
}
