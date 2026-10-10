// Saturn's rings: radial colour/opacity profile, the planet's shadow (ray from the ring point
// towards the Sun tested against the planet sphere), diffuse transmission when seen from the unlit
// side, and forward scattering when looking towards the Sun through thin ring regions.
uniform sampler2D uRingMap;
uniform vec3 uSunDir;
uniform vec3 uPlanetCenter;
uniform float uPlanetRadius;
uniform vec3 uRingNormal;
uniform float uLight;

varying vec3 vWorldPos;
varying float vRadial;

void main() {
  if (vRadial < 0.0 || vRadial > 1.0) discard;
  vec4 ring = texture2D(uRingMap, vec2(vRadial, 0.5));
  float alpha = ring.a;
  if (alpha < 0.004) discard;

  vec3 oc = vWorldPos - uPlanetCenter;
  float along = dot(oc, uSunDir);
  float perp = length(oc - uSunDir * along);
  float shadow = along < 0.0 ? 1.0 - smoothstep(uPlanetRadius * 0.97, uPlanetRadius * 1.03, perp) : 0.0;

  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float sunSide = dot(uRingNormal, uSunDir);
  float viewSide = dot(uRingNormal, viewDir);
  float litSide = step(0.0, sunSide * viewSide);
  float transmit = (1.0 - alpha) * 0.85 + 0.06;
  float light = mix(transmit, 1.0, litSide) * (0.45 + 0.55 * abs(sunSide));
  float forward = pow(max(dot(-viewDir, uSunDir), 0.0), 10.0) * (1.0 - alpha) * 3.0;

  vec3 col = ring.rgb * light * uLight + vec3(1.0, 0.92, 0.82) * forward;
  col *= 1.0 - shadow * 0.93;
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
