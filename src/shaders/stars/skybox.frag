uniform samplerCube uBand;
uniform float uIntensity;

varying vec3 vDir;

void main() {
  vec3 col = textureCube(uBand, normalize(vDir)).rgb * uIntensity;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
