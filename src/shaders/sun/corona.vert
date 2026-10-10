// Camera-facing quad centred on the object origin; its world scale sets the size.
varying vec2 vQuad;

void main() {
  vQuad = position.xy;
  vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float scale = length(modelMatrix[0].xyz);
  gl_Position = projectionMatrix * (center + vec4(position.xy * scale, 0.0, 0.0));
}
