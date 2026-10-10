uniform float uInner;
uniform float uOuter;

varying vec3 vWorldPos;
varying float vRadial;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vRadial = (length(position.xy) - uInner) / (uOuter - uInner);
  gl_Position = projectionMatrix * viewMatrix * world;
}
