// Star/gas particles of galaxies, nebulae and the cosmic web. Sizes are in world units (so they
// shrink with the Powers-of-Ten zoom) and fade near the camera to avoid "flies" in front of the lens.
// Sub-pixel particles keep a 1 px footprint and lose alpha instead, which preserves brightness.
attribute float aSize;
attribute float aBright;
attribute vec3 aColor;

uniform float uTime;
uniform float uRotation;
uniform float uPixelRatio;
uniform float uProjection;
uniform float uOpacity;
uniform float uNearFade0;
uniform float uNearFade1;
uniform float uScale;
uniform float uMaxSize;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec3 p = position;
#ifdef ROTATE
  // Flat rotation curve: angular speed falls off as 1/r outside the core.
  float r = length(p.xz);
  float a = uTime * uRotation * 2000.0 / max(r, 1500.0);
  float c = cos(a);
  float s = sin(a);
  p.xz = mat2(c, -s, s, c) * p.xz;
#endif
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = max(-mv.z, 1e-3);
  float px = aSize * uScale * uProjection / dist;
  gl_PointSize = clamp(px, 1.0, uMaxSize) * uPixelRatio;
  float nearFade = smoothstep(uNearFade0 * uScale, uNearFade1 * uScale, dist);
  vAlpha = aBright * uOpacity * nearFade * min(px, 1.0);
  vColor = aColor;
}
