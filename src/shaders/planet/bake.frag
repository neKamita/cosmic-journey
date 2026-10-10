// Bakes a procedural planet surface into an equirectangular texture, using exactly the UV
// convention of THREE.SphereGeometry so the result is seamless on the sphere.
// The planet body is spliced in at the SURFACE pragma and must define:
//   vec3 surfaceColor(vec3 p)   albedo in linear space, p on the unit sphere
//   float surfaceHeight(vec3 p) relief, roughly in [-1, 1]
// With BAKE_NORMAL defined the pass writes a tangent-space normal map instead
// (R = east, G = north, B = up), matching the texture pipeline's convention.
#include "../common/noise.glsl"
#include "../common/cellular.glsl"

varying vec2 vUv;
uniform float uTexel;
uniform float uStrength;

// Impact craters on a cellular lattice: each cell may hold one crater of random size, with a
// raised rim and a bowl. Returns a height contribution.
float craters(vec3 p, float scale, float density) {
  vec3 q = p * scale;
  vec3 i = floor(q);
  vec3 f = fract(q);
  float h = 0.0;
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 rnd = cellHash(i + g);
        if (rnd.z > density) continue;
        float radius = 0.18 + 0.32 * rnd.y;
        vec3 center = g + cellHash(i + g + 17.0) - f;
        float d = length(center) / radius;
        float bowl = (1.0 - smoothstep(0.0, 1.0, d)) * -0.9;
        float rim = exp(-pow((d - 1.0) / 0.22, 2.0)) * 0.55;
        h += (bowl + rim) * (0.6 + 0.4 * rnd.x);
      }
    }
  }
  return h;
}

#pragma SURFACE

vec3 spherePoint(float phi, float theta) {
  return vec3(-cos(phi) * sin(theta), cos(theta), sin(phi) * sin(theta));
}

void main() {
  float phi = vUv.x * 6.28318530718;
  float theta = (1.0 - vUv.y) * 3.14159265359;
  vec3 p = spherePoint(phi, theta);
#ifdef BAKE_NORMAL
  vec3 east = vec3(sin(phi), 0.0, cos(phi));
  vec3 north = vec3(cos(phi) * cos(theta), sin(theta), -sin(phi) * cos(theta));
  float e = uTexel;
  float dhE = (surfaceHeight(normalize(p + east * e)) - surfaceHeight(normalize(p - east * e))) / (2.0 * e);
  float dhN = (surfaceHeight(normalize(p + north * e)) - surfaceHeight(normalize(p - north * e))) / (2.0 * e);
  vec3 n = normalize(vec3(-dhE * uStrength, -dhN * uStrength, 1.0));
  gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
#else
  gl_FragColor = vec4(surfaceColor(p), 1.0);
#endif
}
