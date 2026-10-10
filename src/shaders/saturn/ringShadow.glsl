// Shadow of the rings on Saturn: march from the shaded point towards the Sun, intersect the ring
// plane and look up the ring opacity at that radius.
uniform sampler2D uRingShadowMap;
uniform vec3 uRingNormal;
uniform vec3 uRingCenter;
uniform vec3 uRingSunDir;
uniform float uRingInner;
uniform float uRingOuter;

varying vec3 vRingWorldPos;

float ringShadow() {
  float denom = dot(uRingSunDir, uRingNormal);
  if (abs(denom) < 1e-4) return 0.0;
  float t = dot(uRingCenter - vRingWorldPos, uRingNormal) / denom;
  if (t <= 0.0) return 0.0;
  vec3 hit = vRingWorldPos + uRingSunDir * t;
  float u = (length(hit - uRingCenter) - uRingInner) / (uRingOuter - uRingInner);
  if (u < 0.0 || u > 1.0) return 0.0;
  return texture2D(uRingShadowMap, vec2(u, 0.5)).a * 0.9;
}
