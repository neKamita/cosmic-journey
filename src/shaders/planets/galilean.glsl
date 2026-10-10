// The four Galilean moons, selected with MOON: 0 Io, 1 Europa, 2 Ganymede, 3 Callisto.
float surfaceHeight(vec3 p) {
#if MOON == 3
  return craters(p, 6.0, 0.6) * 0.5 + craters(p + 2.0, 14.0, 0.6) * 0.25;
#elif MOON == 2
  return craters(p, 5.0, 0.35) * 0.3 + fbm(p * 6.0, 3) * 0.1;
#else
  return fbm(p * 4.0, 3) * 0.08;
#endif
}

vec3 surfaceColor(vec3 p) {
#if MOON == 0
  // Io: sulphur yellows, reddish poles, black volcanic vents with orange plume deposits.
  float n = fbm(p * 3.0, 5) * 0.5 + 0.5;
  vec3 col = mix(vec3(0.82, 0.7, 0.3), vec3(0.95, 0.9, 0.6), n);
  col = mix(col, vec3(0.6, 0.36, 0.2), smoothstep(0.55, 0.9, abs(p.y)));
  vec2 c = cellular(p * 7.0);
  col = mix(col, vec3(0.78, 0.46, 0.2), smoothstep(0.32, 0.1, c.x) * 0.55);
  col = mix(col, vec3(0.07, 0.05, 0.04), smoothstep(0.11, 0.04, c.x));
  return col;
#elif MOON == 1
  // Europa: bright water ice crossed by reddish-brown lineae.
  vec3 col = vec3(0.86, 0.84, 0.8) * (0.9 + 0.1 * fbm(p * 4.0, 3));
  float lines = 1.0 - smoothstep(0.0, 0.035, abs(snoise(p * 3.0 + fbm(p * 2.0, 2))));
  float lines2 = 1.0 - smoothstep(0.0, 0.03, abs(snoise(p * 6.0 + 7.0)));
  col = mix(col, vec3(0.55, 0.38, 0.25), max(lines, lines2 * 0.7) * 0.8);
  col = mix(col, vec3(0.7, 0.6, 0.5), smoothstep(0.3, 0.8, fbm(p * 2.0 + 3.0, 3) * 0.5 + 0.5) * 0.3);
  return col;
#elif MOON == 2
  // Ganymede: ancient dark terrain cut by bright grooved terrain.
  float region = smoothstep(0.45, 0.55, fbm(p * 2.2, 4) * 0.5 + 0.5);
  float grooves = sin(dot(p, vec3(30.0, 12.0, 21.0)) + fbm(p * 4.0, 3) * 6.0) * 0.5 + 0.5;
  vec3 dark = vec3(0.32, 0.28, 0.24);
  vec3 bright = vec3(0.68, 0.64, 0.6) * (0.85 + 0.15 * grooves);
  return mix(dark, bright, region) * (0.9 + 0.2 * (fbm(p * 8.0, 2) * 0.5 + 0.5));
#else
  // Callisto: dark, crater-saturated, with bright ejecta.
  float h = surfaceHeight(p);
  vec3 col = vec3(0.24, 0.21, 0.18) * (0.9 + 0.2 * fbm(p * 5.0, 3));
  return col + vec3(0.25) * smoothstep(0.3, 0.6, h);
#endif
}
