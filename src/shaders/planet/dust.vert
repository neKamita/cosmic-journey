// Dust motes suspended in a thin atmosphere: they drift slowly around the planet axis and are only
// visible close to the camera, which gives a sense of speed while skimming the surface.
attribute float aSeed;

uniform float uTime;
uniform float uPixelRatio;
uniform float uOpacity;
uniform float uSize;

varying float vAlpha;

void main() {
  vec3 p = position;
  float a = uTime * (0.006 + aSeed * 0.012);
  float c = cos(a);
  float s = sin(a);
  p.xz = mat2(c, -s, s, c) * p.xz;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = -mv.z;
  gl_PointSize = clamp(uSize * uPixelRatio / max(dist, 0.05), 1.0, 24.0);
  vAlpha = uOpacity * smoothstep(0.15, 0.9, dist) * (1.0 - smoothstep(5.0, 11.0, dist)) * (0.35 + 0.65 * aSeed);
}
