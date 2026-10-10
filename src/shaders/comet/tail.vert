// Comet tail particles with a fully GPU-side life cycle: each particle is born at the nucleus,
// travels away from the Sun and fades. The dust tail is broad, warm and curved (dust lags behind
// along the orbit); the ion tail is narrow, blue and points straight away from the Sun.
attribute vec4 aSeed; // x: age offset, y: lateral angle, z: lateral radius, w: 0 dust / 1 ion

uniform float uTime;
uniform vec3 uNucleus;
uniform vec3 uTailDir;
uniform vec3 uCurveDir;
uniform float uLength;
uniform float uWidth;
uniform float uSpeed;
uniform float uPixelRatio;

varying float vAlpha;
varying float vType;

void main() {
  bool ion = aSeed.w > 0.5;
  float age = fract(aSeed.x + uTime * uSpeed * (ion ? 1.7 : 1.0));
  float len = uLength * (ion ? 1.3 : 1.0);

  vec3 side = normalize(cross(uTailDir, abs(uTailDir.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
  vec3 up = normalize(cross(side, uTailDir));
  float spread = (ion ? 0.22 : 1.0) * uWidth * (0.12 + age) * aSeed.z;
  float a = aSeed.y * 6.28318530718;
  vec3 lateral = (cos(a) * side + sin(a) * up) * spread;
  vec3 curve = ion ? vec3(0.0) : uCurveDir * age * age * len * 0.32;
  vec3 pos = uNucleus + uTailDir * (age * len) + lateral + curve;

  vec4 mv = viewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = (ion ? 2.6 : 5.5) * (0.6 + age * 2.4);
  gl_PointSize = clamp(size * uPixelRatio * 160.0 / max(-mv.z, 1.0), 2.0, 72.0);
  vAlpha = pow(1.0 - age, ion ? 1.1 : 1.7) * smoothstep(0.0, 0.03, age);
  vType = aSeed.w;
}
