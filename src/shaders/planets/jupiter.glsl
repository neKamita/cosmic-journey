// Jupiter: light zones and dark belts with turbulent edges, polar haze and the Great Red Spot
// (an anticyclone at about 22°S with a pale collar).
float surfaceHeight(vec3 p) {
  return 0.0;
}

vec3 surfaceColor(vec3 p) {
  float lat = asin(clamp(p.y, -1.0, 1.0));
  float lon = atan(p.z, -p.x);
  float warp = fbm(vec3(p.x * 2.2, p.y * 9.0, p.z * 2.2), 4) * 0.07;
  float l = lat + warp;

  float bands = sin(l * 13.5 + 0.4) * 0.5 + 0.5;
  float fine = sin(l * 44.0 + fbm(p * vec3(3.0, 22.0, 3.0), 3) * 2.2) * 0.5 + 0.5;
  vec3 zone = vec3(0.9, 0.82, 0.68);
  vec3 belt = vec3(0.52, 0.32, 0.19);
  vec3 col = mix(belt, zone, bands * 0.72 + fine * 0.28);
  col = mix(col, vec3(0.56, 0.53, 0.5), smoothstep(0.8, 1.2, abs(lat)));
  col *= 0.86 + 0.26 * (fbm(vec3(p.x * 7.0, p.y * 20.0, p.z * 7.0) + warp * 4.0, 4) * 0.5 + 0.5);

  // White ovals along the southern temperate belt.
  vec2 ov = cellular(vec3(lon * 3.0, lat * 18.0 + 6.0, 0.5)).xy;
  float ovals = smoothstep(0.22, 0.08, ov.x) * exp(-pow((lat + 0.6) / 0.05, 2.0));
  col = mix(col, vec3(0.95, 0.93, 0.88), ovals * 0.8);

  // Great Red Spot.
  float dLon = lon - 1.35;
  float dLat = lat + 0.38;
  float e = dLon * dLon / (0.17 * 0.17) + dLat * dLat / (0.075 * 0.075);
  float swirl = fbm(vec3(dLon * 12.0, dLat * 24.0, e), 3) * 0.15;
  col = mix(col, vec3(0.93, 0.85, 0.74), smoothstep(0.6, 0.0, abs(e - 1.6 + swirl)) * 0.5);
  col = mix(col, vec3(0.74, 0.36, 0.22) * (0.9 + swirl), smoothstep(1.2, 0.3, e + swirl));
  return col;
}
