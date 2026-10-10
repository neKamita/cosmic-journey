// Near star layer: points live in a cube that wraps around the camera, which gives real parallax
// while the field never runs out.
attribute float aSize;
attribute float aBright;
attribute vec3 aColor;

uniform float uBox;
uniform float uOpacity;
uniform float uPixelRatio;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec3 rel = mod(position - cameraPosition, uBox) - 0.5 * uBox;
  vec4 mv = viewMatrix * vec4(cameraPosition + rel, 1.0);
  gl_Position = projectionMatrix * mv;

  float d = length(rel);
  float fade = (1.0 - smoothstep(0.32 * uBox, 0.5 * uBox, d)) * smoothstep(0.004 * uBox, 0.04 * uBox, d);
  gl_PointSize = aSize * uPixelRatio;
  vAlpha = aBright * fade * uOpacity;
  vColor = aColor;
}
