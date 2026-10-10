// Photosphere: convective granulation (cellular noise, bright cells with dark intergranular lanes)
// advected by a slow large-scale flow, sunspots with umbra and penumbra in the activity belts,
// faculae near the limb, and quadratic limb darkening with limb reddening. Output is HDR so the
// bloom pass produces the glare.
#include "../common/noise.glsl"
#include "../common/cellular.glsl"

uniform float uTime;
uniform float uIntensity;

varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vViewV;

void main() {
  vec3 p = vObj;
  float t = uTime;

  vec3 flow = vec3(
    fbm(p * 2.0 + vec3(0.0, t * 0.02, 0.0), 3),
    fbm(p * 2.0 + vec3(5.2, -t * 0.015, 1.3), 3),
    fbm(p * 2.0 + vec3(2.1, 3.7, t * 0.017), 3)
  ) * 0.12;

#ifdef LOW_DETAIL
  float gran = fbm(p * 60.0 + flow * 8.0 + vec3(t * 0.05), 3) * 0.5 + 0.5;
#else
  vec2 cells = cellular(p * 72.0 + flow * 10.0 + vec3(t * 0.05));
  float gran = smoothstep(0.0, 0.5, cells.y - cells.x);
  // Mesogranulation: larger, fainter brightness modulation.
  gran = mix(gran, fbm(p * 18.0 + flow * 4.0, 3) * 0.5 + 0.5, 0.35);
#endif
  float fine = fbm(p * 140.0 + vec3(t * 0.1), 2) * 0.5 + 0.5;

  float lat = abs(p.y);
  float belt = smoothstep(0.06, 0.24, lat) * (1.0 - smoothstep(0.45, 0.62, lat));
  float spotField = fbm(p * 3.2 + vec3(1.7, t * 0.002, 4.1), 4);
  float penumbra = smoothstep(0.3, 0.4, spotField) * belt;
  float umbra = smoothstep(0.43, 0.5, spotField) * belt;

  vec3 n = normalize(vNormalV);
  vec3 v = normalize(vViewV);
  float mu = clamp(dot(n, v), 0.0, 1.0);
  float faculae = smoothstep(0.58, 0.85, fbm(p * 12.0 + flow * 3.0, 3) * 0.5 + 0.5) * pow(1.0 - mu, 1.5) * (1.0 - penumbra);

  float intensity = mix(0.8, 1.1, gran) * (0.94 + 0.12 * fine);
  intensity *= 1.0 - penumbra * 0.45;
  intensity *= 1.0 - umbra * 0.55;
  intensity += faculae * 0.4;

  float x = 1.0 - mu;
  float limb = 1.0 - 0.6 * x - 0.18 * x * x;
  vec3 core = vec3(1.0, 0.74, 0.38);
  vec3 edge = vec3(1.0, 0.36, 0.08);
  vec3 col = mix(edge, core, pow(mu, 0.45)) * intensity * limb;

  gl_FragColor = vec4(col * uIntensity, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
