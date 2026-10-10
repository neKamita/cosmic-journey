// Solar corona: a bright inner glow plus radial streamers from noise sampled in direction space,
// slowly evolving. Drawn on a billboard behind the photosphere.
#include "../common/noise.glsl"

uniform float uTime;
uniform float uIntensity;
// Photosphere radius as a fraction of the billboard half-size.
uniform float uSunRadius;

varying vec2 vQuad;

void main() {
  float r = length(vQuad);
  if (r > 1.0) discard;
  float x = max(r - uSunRadius, 0.0) / (1.0 - uSunRadius);
  vec2 dir = vQuad / max(r, 1e-4);

  float streamers = fbm(vec3(dir * 1.8, uTime * 0.02 + x * 0.25), 3) * 0.5 + 0.5;
  float rays = pow(streamers, 3.0) * exp(-x * 2.0);
  float fineRays = pow(fbm(vec3(dir * 6.0, uTime * 0.03), 2) * 0.5 + 0.5, 5.0) * exp(-x * 4.0);

  float glow = exp(-x * 11.0) * 1.5 + exp(-x * 3.2) * 0.22;
  float corona = glow * (0.6 + rays * 1.2 + fineRays * 0.4);
  corona *= 1.0 - smoothstep(0.55, 1.0, r);

  vec3 hot = vec3(1.0, 0.86, 0.62);
  vec3 warm = vec3(1.0, 0.52, 0.2);
  vec3 col = mix(warm, hot, exp(-x * 6.0));

  gl_FragColor = vec4(col * corona * uIntensity, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
