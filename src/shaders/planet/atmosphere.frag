// Limb glow of a planetary atmosphere, rendered on the back faces of a slightly larger shell.
// The glow depends on the view ray's impact parameter b (closest distance to the planet centre):
// density falls off from the surface (b = R) to the top of the shell. Colour shifts from blue
// (Rayleigh-scattered daylight) to orange towards the terminator, and a forward-scattering term
// lights the rim when the camera looks towards the Sun past the planet.
uniform vec3 uCenter;
uniform float uRadius;
uniform float uShell;
uniform vec3 uSunDir;
uniform vec3 uDayColor;
uniform vec3 uTwilightColor;
uniform float uIntensity;
uniform float uFalloff;
uniform float uForward;

varying vec3 vWorldPos;

void main() {
  vec3 rayDir = normalize(vWorldPos - cameraPosition);
  float tc = dot(uCenter - cameraPosition, rayDir);
  vec3 radial = cameraPosition + rayDir * tc - uCenter;
  float b = length(radial);
  if (b < uRadius * 0.996) discard;

  float h = clamp((b - uRadius) / (uShell - uRadius), 0.0, 1.0);
  float density = pow(1.0 - h, uFalloff);
  vec3 limb = radial / max(b, 1e-5);
  float mu = dot(limb, uSunDir);
  float lit = smoothstep(-0.2, 0.3, mu);
  vec3 color = mix(uTwilightColor, uDayColor, smoothstep(0.0, 0.35, mu));
  float forward = pow(max(dot(rayDir, uSunDir), 0.0), 6.0) * uForward;

  vec3 col = color * density * (lit + forward * 1.5);
  gl_FragColor = vec4(col * uIntensity, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
