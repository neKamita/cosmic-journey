// Venus cloud tops: pale sulphuric-acid haze in zonal bands with sheared swirls.
float surfaceHeight(vec3 p) {
  return 0.0;
}

vec3 surfaceColor(vec3 p) {
  float lat = asin(clamp(p.y, -1.0, 1.0));
  vec3 q = vec3(p.x, p.y * 3.2, p.z);
  float warp = fbm(p * 3.0, 3);
  float swirl = fbm(q * 2.2 + warp * 0.8, 5);
  float bands = sin(lat * 9.0 + swirl * 3.0) * 0.5 + 0.5;
  // The dark "Y" shaped band near the equator seen in UV images, softened for visible light.
  float chevron = exp(-pow((abs(lat) - 0.25 + 0.15 * swirl) / 0.18, 2.0)) * 0.12;
  vec3 light = vec3(0.95, 0.86, 0.66);
  vec3 dark = vec3(0.78, 0.63, 0.4);
  vec3 col = mix(dark, light, bands * 0.55 + 0.45 * (swirl * 0.5 + 0.5));
  return col * (1.0 - chevron);
}
