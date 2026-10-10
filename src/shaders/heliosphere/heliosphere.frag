// The heliopause: a faint, turbulent boundary where the solar wind meets interstellar gas.
// Visible mostly edge-on (Fresnel) and when the camera passes through it.
#include "../common/noise.glsl"

uniform float uTime;
uniform float uIntensity;
uniform vec3 uColor;

varying vec3 vWorldPos;
varying vec3 vNormalW;

void main() {
  vec3 v = normalize(cameraPosition - vWorldPos);
  float rim = pow(1.0 - abs(dot(normalize(vNormalW), v)), 2.5);
  float n = fbm(vWorldPos * 0.0018 + vec3(0.0, uTime * 0.015, 0.0), 4) * 0.5 + 0.5;
  float filaments = pow(ridged(vWorldPos * 0.0035 + vec3(uTime * 0.01), 3), 3.0);
  float a = (rim * (0.35 + 0.65 * n) + filaments * 0.25 * rim) * uIntensity;
  gl_FragColor = vec4(uColor * a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
