// Myriads of distant small bodies in the belt, drawn as sunlit specks.
attribute float aSize;
attribute float aBright;
attribute vec3 aColor;

uniform float uPixelRatio;
uniform float uOpacity;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = -mv.z;
  gl_PointSize = clamp(aSize * uPixelRatio * 260.0 / max(d, 1.0), 1.0, 5.0);
  vAlpha = uOpacity * aBright * smoothstep(4.0, 30.0, d) * (1.0 - smoothstep(500.0, 900.0, d));
  vColor = aColor;
}
