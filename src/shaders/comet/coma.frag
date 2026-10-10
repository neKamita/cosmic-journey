// Coma: the bright gas cloud around the nucleus, drawn on a camera-facing quad.
uniform vec3 uColor;
uniform float uIntensity;

varying vec2 vQuad;

void main() {
  float r = length(vQuad);
  float g = exp(-r * r * 20.0) * 2.4 + exp(-r * 4.5) * 0.35;
  g *= 1.0 - smoothstep(0.75, 1.0, r);
  gl_FragColor = vec4(uColor * g * uIntensity, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
