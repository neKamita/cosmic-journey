// Differential rotation for Jupiter's cloud map: alternating prograde and retrograde jets shift the
// texture lookup by latitude over time, with a small wave along the band edges.
uniform float uFlowTime;

vec2 jupiterFlowUv(vec2 uv) {
  float lat = (uv.y - 0.5) * 3.14159265;
  float jets = sin(lat * 24.0);
  vec2 q = uv;
  q.x += uFlowTime * (jets * 0.0016 + 0.0006 * cos(lat * 2.0));
  float edge = 1.0 - abs(jets);
  q.y += edge * 0.0011 * sin(q.x * 180.0 + uFlowTime * 0.3 + lat * 40.0);
  return q;
}
