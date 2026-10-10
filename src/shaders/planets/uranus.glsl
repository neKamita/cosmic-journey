// Uranus: a nearly featureless pale cyan disk (methane absorbs red light) with faint bands and a
// brighter polar region.
float surfaceHeight(vec3 p) {
  return 0.0;
}

vec3 surfaceColor(vec3 p) {
  float lat = asin(clamp(p.y, -1.0, 1.0));
  float bands = sin(lat * 12.0 + fbm(p * vec3(2.0, 8.0, 2.0), 3) * 0.6) * 0.5 + 0.5;
  vec3 col = vec3(0.42, 0.74, 0.8) * (0.95 + 0.05 * bands);
  return mix(col, vec3(0.62, 0.84, 0.88), smoothstep(0.6, 1.2, lat) * 0.5);
}
