// Neptune: deep blue banded atmosphere with the Great Dark Spot, the small bright "Scooter" and
// high methane-ice cirrus streaks.
float surfaceHeight(vec3 p) {
  return 0.0;
}

vec3 surfaceColor(vec3 p) {
  float lat = asin(clamp(p.y, -1.0, 1.0));
  float lon = atan(p.z, -p.x);
  float bands = sin(lat * 10.0 + fbm(p * vec3(2.0, 9.0, 2.0), 4) * 0.8) * 0.5 + 0.5;
  vec3 col = mix(vec3(0.16, 0.3, 0.74), vec3(0.27, 0.44, 0.88), bands);

  float spot = pow((lon - 0.6) / 0.22, 2.0) + pow((lat + 0.35) / 0.1, 2.0);
  col = mix(col, vec3(0.07, 0.13, 0.38), smoothstep(1.0, 0.3, spot));
  col = mix(col, vec3(0.75, 0.85, 1.0), smoothstep(0.35, 0.0, abs(spot - 1.15)) * 0.35);

  float streak = smoothstep(0.74, 0.95, fbm(vec3(p.x * 3.0, p.y * 30.0, p.z * 3.0), 3) * 0.5 + 0.5);
  col = mix(col, vec3(0.92, 0.95, 1.0), streak * 0.8);

  float scooter = pow((lon - 0.62) / 0.08, 2.0) + pow((lat + 0.5) / 0.03, 2.0);
  return mix(col, vec3(0.9, 0.95, 1.0), smoothstep(1.0, 0.2, scooter) * 0.9);
}
