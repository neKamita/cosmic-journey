// Procedural Milky Way band, baked once into a cube map. Oriented to the scene's galactic frame,
// so the band on the sky matches the 3D galaxy the camera later flies out of.
#include "../common/noise.glsl"

uniform vec3 uNormal;
uniform vec3 uCenterDir;

varying vec3 vDir;

void main() {
  vec3 d = normalize(vDir);
  float lat = asin(clamp(dot(d, uNormal), -1.0, 1.0));
  float toCenter = dot(normalize(d - uNormal * dot(d, uNormal)), uCenterDir);

  float band = exp(-pow(lat / 0.17, 2.0));
  float bulge = exp(-pow(lat / 0.3, 2.0)) * pow(max(toCenter, 0.0), 6.0);
  float clouds = fbm(d * 3.2, 5) * 0.5 + 0.5;
  float fine = fbm(d * 11.0 + 4.0, 4) * 0.5 + 0.5;
  float dust = smoothstep(0.45, 0.8, ridged(d * 5.5 + 1.7, 4)) * exp(-pow(lat / 0.06, 2.0));

  float glow = band * (0.35 + 0.65 * clouds) * (0.7 + 0.3 * fine) + bulge * 1.4;
  glow *= 1.0 - 0.8 * dust;

  vec3 warm = vec3(1.0, 0.82, 0.62);
  vec3 cool = vec3(0.62, 0.7, 1.0);
  vec3 col = mix(cool, warm, smoothstep(-0.6, 0.9, toCenter));
  // Faint pinkish emission knots along the plane.
  col += vec3(0.5, 0.18, 0.3) * smoothstep(0.72, 0.95, fine) * band * 0.6;

  gl_FragColor = vec4(col * glow * 0.045, 1.0);
}
