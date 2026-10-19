// Gargantua: raymarched Schwarzschild lensing (rs = 1) with a baked, animated accretion disk.
// The expensive procedural noise was moved to CPU-baked textures, and the integrator step
// count is driven by a uniform so quality can scale with the measured frame budget.

export const quadVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const bhFragment = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3 uCamPos;
uniform mat4 uCamMat;
uniform float uTanHalfFov;
uniform float uAspect;
uniform float uSteps;
uniform float uDiskBoost;
uniform sampler2D uStars;
uniform sampler2D uDisk;
varying vec2 vUv;

const float INV_TAU = 0.15915494;
const float INV_PI = 0.31830989;
const float INNER = 2.6;
const float OUTER = 14.0;

vec3 sampleSky(vec3 d) {
  vec2 uv = vec2(atan(d.z, d.x) * INV_TAU + 0.5, acos(clamp(d.y, -1.0, 1.0)) * INV_PI);
  return texture2D(uStars, uv).rgb;
}

vec4 sampleDisk(vec3 p, float r, vec3 rd) {
  if (r < INNER || r > OUTER) return vec4(0.0);
  float ang = atan(p.z, p.x);
  float omega = 2.4 / (r * sqrt(r));
  float u = (ang + uTime * omega) * INV_TAU;
  float v = (r - INNER) / (OUTER - INNER);
  float dens = texture2D(uDisk, vec2(u, v)).r;
  dens *= smoothstep(INNER, INNER + 0.55, r) * (1.0 - smoothstep(8.5, OUTER, r));
  if (dens < 0.004) return vec4(0.0);

  float temp = clamp(pow(3.0 / r, 1.3), 0.0, 1.5);
  vec3 tang = normalize(vec3(-p.z, 0.0, p.x));
  float beam = 1.0 + 0.6 * dot(tang, -rd);           // relativistic beaming
  vec3 col = mix(vec3(0.55, 0.2, 0.06), vec3(1.0, 0.56, 0.18), smoothstep(0.1, 0.55, temp));
  col = mix(col, vec3(1.0, 0.94, 0.86), smoothstep(0.55, 1.15, temp));
  col *= dens * temp * 3.6 * beam * uDiskBoost;
  return vec4(col, clamp(dens * 1.5, 0.0, 1.0));
}

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  vec3 rdCam = normalize(vec3(uv.x * uTanHalfFov * uAspect, uv.y * uTanHalfFov, -1.0));
  vec3 rd = normalize((uCamMat * vec4(rdCam, 0.0)).xyz);

  vec3 pos = uCamPos;
  vec3 vel = rd;
  vec3 hv = cross(pos, vel);
  float h2 = dot(hv, hv);

  // Skip the numerical solver for distant rays that cannot approach the disk.
  // Weak lensing on these peripheral rays is intentionally approximated away.
  float camR2 = dot(pos, pos);
  float toward = -dot(pos, rd);
  float impact2 = max(0.0, camR2 - toward * toward);
  if (camR2 > 576.0 && (toward < 0.0 || impact2 > 484.0)) {
    gl_FragColor = vec4(aces(sampleSky(rd) * 1.12), 1.0);
    return;
  }
  if (camR2 > 900.0 && toward > 0.0 && impact2 < 900.0) {
    float entry = max(0.0, toward - sqrt(900.0 - impact2));
    pos += rd * entry;
  }

  vec3 acc = vec3(0.0);
  float alpha = 0.0;
  float minR = 1e5;
  bool captured = false;

  for (int i = 0; i < 300; i++) {
    if (float(i) >= uSteps) break;
    float r2 = dot(pos, pos);
    float r = sqrt(r2);
    minR = min(minR, r);
    float dt = clamp(0.075 * r, 0.02, 2.6);
    vec3 prev = pos;
    vel += (-1.5 * h2 * pos / (r2 * r2 * r)) * dt;
    pos += vel * dt;

    float nr = length(pos);
    if (nr < 1.0) { captured = true; break; }
    if (prev.y * pos.y < 0.0) {
      vec3 hit = mix(prev, pos, prev.y / (prev.y - pos.y));
      vec4 d = sampleDisk(hit, length(hit.xz), normalize(vel));
      acc += d.rgb * (1.0 - alpha);
      alpha += d.a * (1.0 - alpha);
      if (alpha > 0.97) break;
    }
    if (nr > 90.0 && dot(pos, vel) > 0.0) break;
  }

  vec3 bg = captured ? vec3(0.0) : sampleSky(normalize(vel));
  vec3 col = acc + bg * (1.0 - alpha);
  float ring = captured ? 0.0 : exp(-pow((minR - 1.5) * 4.0, 2.0));
  col += vec3(1.0, 0.76, 0.5) * ring * 0.38;

  gl_FragColor = vec4(aces(col * 1.12), 1.0);
}
`;

// Full-resolution finishing pass: the lensing buffer is upscaled here, so grain,
// vignette and chromatic aberration all stay crisp even at low render scale.
export const compositeFragment = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform float uTime;
uniform float uAspect;
uniform float uWarp;
uniform float uFade;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  float r2 = dot(c, c);
  float ab = (0.0016 + uWarp * 0.006) * r2;
  vec3 col;
  col.r = texture2D(uTex, uv + c * ab).r;
  col.g = texture2D(uTex, uv).g;
  col.b = texture2D(uTex, uv - c * ab).b;

  col += vec3(1.0, 0.6, 0.3) * uWarp * 0.14 * (1.0 - length(c) * 0.9);
  float vig = 1.0 - smoothstep(0.3, 1.25, length(c * vec2(uAspect * 0.78, 1.0)) * 1.35);
  col *= mix(0.34, 1.0, vig);
  col += (hash(gl_FragCoord.xy + fract(uTime) * 311.0) - 0.5) * 0.035;
  gl_FragColor = vec4(col * uFade, 1.0);
}
`;

export const wormholeFragment = /* glsl */ `
precision highp float;
uniform sampler2D uStars;
uniform float uTime;
varying vec3 vNormalW;
varying vec3 vViewDirW;

const float INV_TAU = 0.15915494;
const float INV_PI = 0.31830989;

void main() {
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(vViewDirW);
  float f = pow(1.0 - abs(dot(n, v)), 2.2);
  vec3 d = normalize(refract(-v, n, 0.7) + 0.08 * vec3(sin(uTime * 0.6), cos(uTime * 0.5), sin(uTime * 0.4)));
  float a = atan(d.z, d.x) + uTime * 0.22 + f * 2.4;
  vec2 uv = vec2(a * INV_TAU + 0.5, acos(clamp(d.y, -1.0, 1.0)) * INV_PI);
  vec3 col = texture2D(uStars, uv).rgb * 1.7;
  col += vec3(0.42, 0.68, 1.0) * f * 1.5;
  col += vec3(0.2, 0.42, 0.75) * (0.5 + 0.5 * sin(uTime * 2.0 + f * 9.0)) * 0.18;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const wormholeVertex = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vViewDirW;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDirW = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
