// Gravitational lensing by a Schwarzschild black hole, ray traced per pixel (pmndrs Effect).
// Rays from the camera are bent with the photon orbit equation in r_s units,
//   d^2x/dt^2 = -1.5 h^2 x / |x|^5,  h = |x × v| (conserved),
// integrated with velocity Verlet and an adaptive step. Rays that fall below the horizon return
// black (the shadow); rays that cross the disk plane pick up disk emission (so the far side of the
// disk appears lensed above and below the shadow); rays that escape sample the rendered scene in
// their new direction (lensed background).
#include "../common/noise.glsl"
#include "./disk.glsl"

uniform vec3 uCamPos;
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform mat4 uViewProj;
uniform vec3 uCenter;
uniform float uRs;
uniform float uStrength;
uniform float uDiskIntensity;

const float INFLUENCE = 15.0;
const int MAX_STEPS = 160;

vec3 viewRay(vec2 uv) {
  vec4 view = uInvProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
  view /= view.w;
  return normalize((uCamWorld * vec4(view.xyz, 0.0)).xyz);
}

vec3 sceneAlong(vec3 dir) {
  vec4 clip = uViewProj * vec4(uCamPos + dir * 50000.0, 1.0);
  if (clip.w <= 0.0) return vec3(0.0);
  vec2 suv = clip.xy / clip.w * 0.5 + 0.5;
  vec2 inside = step(vec2(0.0), suv) * step(suv, vec2(1.0));
  return texture2D(inputBuffer, clamp(suv, 0.0, 1.0)).rgb * inside.x * inside.y;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 dir = viewRay(uv);
  vec3 o = (uCamPos - uCenter) / uRs;
  float tca = -dot(o, dir);
  float b = length(o + dir * tca);
  if (b > INFLUENCE || tca < 0.0) {
    outputColor = inputColor;
    return;
  }

  float tEnter = max(tca - sqrt(max(INFLUENCE * INFLUENCE - b * b, 0.0)), 0.0);
  vec3 pos = o + dir * tEnter;
  vec3 vel = dir;
  vec3 hv = cross(pos, vel);
  float h2 = dot(hv, hv);

  vec3 emitted = vec3(0.0);
  float opacity = 0.0;
  bool captured = false;
  float prevSide = dot(pos, uNormal);

  for (int i = 0; i < MAX_STEPS; i++) {
    float r = length(pos);
    float dt = clamp(0.07 * r, 0.025, 0.9);
    vec3 a = -1.5 * h2 * pos / pow(r, 5.0);
    vec3 prev = pos;
    pos += vel * dt + 0.5 * a * dt * dt;
    float rNew = length(pos);
    vel += 0.5 * (a - 1.5 * h2 * pos / pow(rNew, 5.0)) * dt;

    float side = dot(pos, uNormal);
    if (side * prevSide < 0.0) {
      vec3 hit = mix(prev, pos, prevSide / (prevSide - side));
      float hr = length(hit);
      if (hr > uInner && hr < uOuter) {
        float alpha;
        vec3 c = diskEmission(hit, normalize(vel), alpha);
        emitted += (1.0 - opacity) * c;
        opacity += (1.0 - opacity) * alpha;
        if (opacity > 0.985) break;
      }
    }
    prevSide = side;
    if (rNew < 1.0) {
      captured = true;
      break;
    }
    if (rNew > INFLUENCE && dot(pos, vel) > 0.0) break;
  }

  vec3 background = captured ? vec3(0.0) : sceneAlong(normalize(vel));
  vec3 lensed = emitted * uDiskIntensity + (1.0 - opacity) * background;
  outputColor = vec4(mix(inputColor.rgb, lensed, uStrength), inputColor.a);
}
