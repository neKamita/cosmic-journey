// Sky stars at infinity: only the view rotation applies, depth is pinned to the far plane.
attribute float aSize;
attribute float aBright;
attribute float aPhase;
attribute vec3 aColor;

uniform float uTime;
uniform float uBrightness;
uniform float uPixelRatio;
uniform float uTwinkle;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec3 dir = normalize(position);
  vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * dir, 1.0);
  gl_Position = clip.xyww;

  float twinkle = 1.0 + uTwinkle * 0.22 * sin(uTime * (1.3 + aPhase * 2.7) + aPhase * 37.0);
  gl_PointSize = aSize * uPixelRatio;
  vAlpha = aBright * uBrightness * twinkle;
  vColor = aColor;
}
