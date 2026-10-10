// Earth surface additions injected into MeshStandardMaterial (view-space vectors).
uniform vec3 uSunDirView;
uniform sampler2D uCloudMap;
uniform float uCloudShift;
uniform float uCloudShadow;

float earthCloudCover(vec2 uv) {
  return texture2D(uCloudMap, uv + vec2(uCloudShift, 0.0)).r;
}

// 1 on the night side, 0 in daylight, with a soft civil-twilight band.
float earthNight(vec3 n) {
  return 1.0 - smoothstep(-0.1, 0.22, dot(n, uSunDirView));
}
