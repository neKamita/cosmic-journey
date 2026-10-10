// Saturn: muted golden bands under a high haze, with a bluer northern polar region.
float surfaceHeight(vec3 p) {
  return 0.0;
}

vec3 surfaceColor(vec3 p) {
  float lat = asin(clamp(p.y, -1.0, 1.0));
  float warp = fbm(vec3(p.x * 2.0, p.y * 10.0, p.z * 2.0), 3) * 0.035;
  float l = lat + warp;
  float bands = sin(l * 17.0) * 0.5 + 0.5;
  float fine = sin(l * 56.0) * 0.5 + 0.5;
  vec3 zone = vec3(0.9, 0.79, 0.56);
  vec3 belt = vec3(0.68, 0.54, 0.34);
  vec3 col = mix(belt, zone, bands * 0.7 + fine * 0.3);
  col = mix(col, vec3(0.6, 0.66, 0.74), smoothstep(1.0, 1.35, lat));
  col *= 0.94 + 0.08 * (fbm(vec3(p.x * 5.0, p.y * 25.0, p.z * 5.0), 3) * 0.5 + 0.5);
  return col;
}
