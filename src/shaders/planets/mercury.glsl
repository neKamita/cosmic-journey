// Mercury: heavily cratered grey-brown regolith with bright ray craters and smooth plains.
float surfaceHeight(vec3 p) {
  float h = fbm(p * 2.5, 5) * 0.35;
  h += craters(p, 4.0, 0.45) * 0.55;
  h += craters(p + 3.1, 9.0, 0.55) * 0.35;
  h += craters(p + 7.7, 20.0, 0.6) * 0.18;
  h += craters(p + 1.3, 42.0, 0.6) * 0.08;
  float plains = smoothstep(0.15, 0.45, fbm(p * 1.4 + 5.0, 3));
  return mix(h, h * 0.35, plains);
}

vec3 surfaceColor(vec3 p) {
  float h = surfaceHeight(p);
  float albedo = 0.36 + 0.08 * fbm(p * 5.0, 4) + 0.06 * h;
  float rays = pow(smoothstep(0.55, 0.9, fbm(p * 14.0 + 2.0, 3) * 0.5 + 0.5), 2.0) * 0.12;
  vec3 tint = mix(vec3(0.5, 0.47, 0.44), vec3(0.6, 0.55, 0.48), fbm(p * 2.0 + 9.0, 3) * 0.5 + 0.5);
  return tint * (albedo + rays) * 1.25;
}
