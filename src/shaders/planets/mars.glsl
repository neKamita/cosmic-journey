// Mars: southern cratered highlands, northern lowlands, the Tharsis bulge with Olympus Mons, the
// Valles Marineris canyon, dark albedo features and polar ice caps.
const vec3 THARSIS = vec3(0.17, 0.12, -0.98);
const vec3 OLYMPUS = vec3(0.45, 0.32, -0.83);

float surfaceHeight(vec3 p) {
  float h = fbm(p * 2.0, 5) * 0.35;
  h += smoothstep(0.25, -0.35, p.y + 0.15 * fbm(p * 3.0, 2)) * 0.35;
  h += craters(p + 2.0, 7.0, 0.5) * 0.28 * smoothstep(0.3, -0.2, p.y);
  h += craters(p + 5.0, 16.0, 0.55) * 0.12;
  h += exp(-pow(distance(p, normalize(THARSIS)) / 0.32, 2.0)) * 0.45;
  h += exp(-pow(distance(p, normalize(OLYMPUS)) / 0.07, 2.0)) * 0.9;
  // Valles Marineris: a long trough east of Tharsis along the equator.
  vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), normalize(THARSIS)));
  float along = dot(p, east);
  float across = p.y + 0.12 + 0.03 * fbm(p * 12.0, 2);
  float valles = exp(-pow(across / 0.025, 2.0)) * smoothstep(0.05, 0.15, along) * smoothstep(0.75, 0.45, along);
  h -= valles * 0.7;
  return h;
}

vec3 surfaceColor(vec3 p) {
  float h = surfaceHeight(p);
  float darkField = fbm(p * 2.6 + 2.0, 5) * 0.5 + 0.5;
  float dark = smoothstep(0.52, 0.7, darkField) * (1.0 - smoothstep(0.55, 0.8, abs(p.y)));
  vec3 rust = vec3(0.74, 0.38, 0.2);
  vec3 darkRock = vec3(0.3, 0.19, 0.13);
  vec3 dust = vec3(0.88, 0.6, 0.4);
  vec3 col = mix(rust, darkRock, dark * 0.8);
  col = mix(col, dust, smoothstep(0.2, 0.7, h) * 0.35);
  col *= 0.85 + 0.25 * (fbm(p * 18.0, 3) * 0.5 + 0.5);
  float cap = smoothstep(0.84, 0.9, abs(p.y) + fbm(p * 7.0, 3) * 0.04);
  return mix(col, vec3(0.94, 0.93, 0.92), cap);
}
