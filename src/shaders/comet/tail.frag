uniform float uIntensity;
uniform vec3 uDustColor;
uniform vec3 uIonColor;

varying float vAlpha;
varying float vType;

void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = exp(-r * r * 3.5) * vAlpha * uIntensity;
  if (a < 0.002) discard;
  gl_FragColor = vec4(mix(uDustColor, uIonColor, vType) * a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
