// Accretion disk emission shared by the lens effect and the fallback mesh. Positions are relative
// to the black hole in units of the Schwarzschild radius (r_s = 1).
//  - temperature follows the thin-disk profile T ~ r^-3/4 (1 - sqrt(r_in / r))^1/4
//  - turbulence co-rotates with Keplerian angular velocity (omega ~ r^-3/2)
//  - relativistic Doppler beaming: intensity ~ g^3 with g = D * sqrt(1 - r_s / r), where
//    D = 1 / (gamma (1 - beta cos(theta))) and beta = sqrt(r_s / 2r) is the orbital speed
uniform vec3 uNormal;
uniform vec3 uBasisU;
uniform vec3 uBasisV;
uniform float uInner;
uniform float uOuter;
uniform float uTime;

vec3 diskBlackbody(float t) {
  vec3 c = mix(vec3(1.0, 0.22, 0.03), vec3(1.0, 0.6, 0.26), smoothstep(0.15, 0.6, t));
  c = mix(c, vec3(1.0, 0.92, 0.82), smoothstep(0.6, 1.1, t));
  return mix(c, vec3(0.72, 0.84, 1.0), smoothstep(1.1, 1.9, t));
}

// p: point on the disk plane; photonDir: direction the traced ray travels (from the camera), so the
// light itself travels along -photonDir. Returns emitted radiance and writes opacity.
vec3 diskEmission(vec3 p, vec3 photonDir, out float alpha) {
  float r = length(p);
  float phi = atan(dot(p, uBasisV), dot(p, uBasisU));
  float omega = 0.9 * pow(r / uInner, -1.5);
  float ang = phi - uTime * omega;
  vec2 q = vec2(cos(ang), sin(ang)) * r;
  float turb = fbm(vec3(q * 0.55, r * 0.35), 4) * 0.5 + 0.5;
  float streaks = fbm(vec3(ang * 3.0, r * 2.2, 1.7), 3) * 0.5 + 0.5;
  float density = smoothstep(uInner, uInner + 0.6, r) * (1.0 - smoothstep(uOuter * 0.6, uOuter, r));
  density *= 0.3 + 0.95 * turb * (0.55 + 0.45 * streaks);

  float temperature = pow(uInner / r, 0.75) * pow(max(1.0 - sqrt(uInner / r), 0.0), 0.25) * 1.7;
  vec3 orbit = normalize(cross(uNormal, p));
  float beta = sqrt(0.5 / r);
  float gamma = inversesqrt(1.0 - beta * beta);
  float cosTheta = dot(orbit, -photonDir);
  float doppler = 1.0 / (gamma * (1.0 - beta * cosTheta));
  float g = doppler * sqrt(max(1.0 - 1.0 / r, 0.02));

  alpha = clamp(density * 0.95, 0.0, 1.0);
  return diskBlackbody(temperature * g) * pow(g, 3.0) * (0.4 + temperature) * density;
}
