// Background sphere at infinity: rotation-only view transform, depth pinned to the far plane.
varying vec3 vDir;

void main() {
  vDir = position;
  vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = clip.xyww;
}
