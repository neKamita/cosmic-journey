// Atmospheric tint over the lit side of a planet disk, strongest towards the limb.
// Injected into MeshStandardMaterial; all vectors are in view space.
uniform vec3 uHazeSunDir;
uniform vec3 uHazeDay;
uniform vec3 uHazeTwilight;
uniform float uHazeStrength;
uniform float uHazePower;

vec3 atmosphereHaze(vec3 n, vec3 viewDir) {
  float mu = dot(n, uHazeSunDir);
  float rim = pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), uHazePower);
  float lit = smoothstep(-0.1, 0.4, mu);
  vec3 col = mix(uHazeTwilight, uHazeDay, smoothstep(0.05, 0.45, mu));
  return col * (rim * 0.9 + 0.05) * lit * uHazeStrength;
}
