// Fallback accretion disk without lensing (used when post-processing is off).
#include "../common/noise.glsl"
#include "./disk.glsl"

uniform vec3 uCenter;
uniform float uRs;
uniform float uDiskIntensity;

varying vec3 vWorldPos;

void main() {
  vec3 p = (vWorldPos - uCenter) / uRs;
  float alpha;
  vec3 c = diskEmission(p, normalize(vWorldPos - cameraPosition), alpha);
  gl_FragColor = vec4(c * uDiskIntensity, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
