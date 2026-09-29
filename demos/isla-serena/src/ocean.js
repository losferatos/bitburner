// Ozean: Gerstner-Wellen, Himmelsreflexion mit Wolken, Sonnenglitzern, Flachwasserfarbe und Brandung.
import * as THREE from 'three';
import skyCommonGLSL from './glsl/sky_common.glsl';
import { U } from './atmosphere.js';
import { terrainUniforms, terrainParsGLSL } from './terrain.js';

const WAVES = [
  // dir.x, dir.z, Wellenlänge, Amplitude, Steilheit
  [0.9, 0.44, 64, 0.52, 0.55],
  [0.62, -0.78, 37, 0.33, 0.6],
  [-0.3, 0.95, 21, 0.2, 0.55],
  [0.98, -0.2, 13, 0.12, 0.5],
  [-0.7, -0.71, 7.5, 0.06, 0.45],
];

const waveGLSL = /* glsl */ `
const int NW = ${WAVES.length};
uniform vec4 uWaveA[NW];
uniform float uWaveQ[NW];
vec3 gerstner(vec2 p, float t, float att, out vec3 nrm) {
  vec3 o = vec3(0.0);
  vec3 n = vec3(0.0, 1.0, 0.0);
  for (int i = 0; i < NW; i++) {
    vec2 d = uWaveA[i].xy;
    float k = 6.28318 / uWaveA[i].z;
    float a = uWaveA[i].w * att;
    float w = sqrt(9.81 * k);
    float ph = k * dot(d, p) - w * t + float(i) * 1.7;
    float c = cos(ph), s = sin(ph);
    float q = uWaveQ[i] / (k * max(uWaveA[i].w, 1e-3) * float(NW));
    o.xz += q * a * d * c;
    o.y += a * s;
    n.xz -= d * k * a * c;
    n.y -= q * k * a * s;
  }
  nrm = normalize(n);
  return o;
}`;

export function makeOcean(waterNormalsTex) {
  // radiales Gitter, dicht in der Mitte
  const rings = [0];
  let r = 0.6;
  while (r < 60000) { rings.push(r); r = r * 1.045 + 0.45; }
  const SEG = 220;
  const pos = [];
  for (let k = 0; k < rings.length; k++) for (let s = 0; s < SEG; s++) {
    const a = (s / SEG) * Math.PI * 2;
    pos.push(Math.cos(a) * rings[k], 0, Math.sin(a) * rings[k]);
  }
  const idx = [];
  for (let k = 0; k < rings.length - 1; k++) for (let s = 0; s < SEG; s++) {
    const a = k * SEG + s, b = k * SEG + ((s + 1) % SEG), c = (k + 1) * SEG + s, d = (k + 1) * SEG + ((s + 1) % SEG);
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);

  waterNormalsTex.wrapS = waterNormalsTex.wrapT = THREE.RepeatWrapping;
  waterNormalsTex.anisotropy = 8;

  const uniforms = {
    ...U,
    ...terrainUniforms,
    uWaterNrm: { value: waterNormalsTex },
    uWaveA: { value: WAVES.map((w) => new THREE.Vector4(w[0], w[1], w[2], w[3])) },
    uWaveQ: { value: WAVES.map((w) => w[4]) },
    uAmbient: U.uAmbient,
    uSunLight: U.uSunLight,
    uHeadlight: { value: new THREE.Vector4(0, 0, 0, 0) },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      ${terrainParsGLSL}
      ${waveGLSL}
      uniform float uTime;
      varying vec3 vWorld;
      varying vec3 vNrm;
      varying float vDepth;
      varying float vWaveH;
      void main() {
        vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
        float depth = 60.0;
        if (abs(wp.x) < uTerr.x - 4.0 && abs(wp.z) < uTerr.x - 4.0) depth = -terrHeight(wp.xz);
        float att = mix(0.15, 1.0, smoothstep(0.0, 14.0, depth));
        float far = length(wp.xz - cameraPosition.xz);
        att *= 1.0 - smoothstep(3000.0, 9000.0, far) * 0.9;
        vec3 n;
        vec3 off = gerstner(wp.xz, uTime, att, n);
        wp += off;
        vWorld = wp; vNrm = n; vDepth = depth; vWaveH = off.y / max(att, 0.2);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      ${skyCommonGLSL}
      ${terrainParsGLSL}
      uniform sampler2D uWaterNrm;
      uniform vec3 uAmbient;
      uniform vec3 uSunLight;
      uniform vec4 uHeadlight;
      varying vec3 vWorld;
      varying vec3 vNrm;
      varying float vDepth;
      varying float vWaveH;
      vec3 wn(vec2 uv) { vec3 n = texture(uWaterNrm, uv).rgb * 2.0 - 1.0; return vec3(n.x, n.z, n.y); }
      void main() {
        vec3 V = cameraPosition - vWorld;
        float dist = length(V); V /= dist;
        float t = uTime;
        vec2 p = vWorld.xz;
        vec3 d1 = wn(p * 0.045 + vec2(t * 0.011, t * 0.007));
        vec3 d2 = wn(p * 0.013 - vec2(t * 0.005, -t * 0.008));
        vec3 d3 = wn(p * 0.21 + vec2(-t * 0.03, t * 0.02));
        float dStr = mix(0.55, 0.12, smoothstep(40.0, 1400.0, dist));
        vec3 dn = d1 + d2 + d3 * 0.5;
        vec3 N = normalize(vNrm + vec3(dn.x, 0.0, dn.z) * dStr);
        float NdV = max(dot(N, V), 0.0);
        float F = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);
        vec3 R = reflect(-V, N);
        R.y = abs(R.y) + 0.002;
        vec3 refl = skyColor(vWorld, normalize(R), false);
        // Sonnenglitzern
        vec3 H = normalize(V + uSunDir);
        float NdH = max(dot(N, H), 0.0);
        vec3 spec = uSunLight * (pow(NdH, 1400.0) * 90.0 + pow(NdH, 180.0) * 1.2) * step(0.0, uSunDir.y);
        vec3 Hm = normalize(V + uMoonDir);
        spec += vec3(0.6, 0.7, 0.9) * pow(max(dot(N, Hm), 0.0), 600.0) * 6.0 * uNight;
        // Wasserkörper
        float sunUp = max(uSunDir.y, 0.0);
        vec3 light = uAmbient + uSunLight * (0.35 + 0.65 * sunUp);
        vec3 deep = vec3(0.004, 0.028, 0.045) * light;
        float scatter = max(vWaveH, 0.0) * 0.6 + pow(max(dot(V, -uSunDir) * 0.5 + 0.5, 0.0), 4.0) * 0.3;
        deep += vec3(0.0, 0.16, 0.14) * uSunLight * scatter * 0.25;
        float depth = max(vDepth, 0.0);
        vec3 sandCol = vec3(0.6, 0.55, 0.42) * (uAmbient * 0.8 + uSunLight * sunUp * 0.9);
        vec3 shallow = mix(sandCol * vec3(0.35, 0.8, 0.78), sandCol, exp(-depth * 1.2));
        vec3 body = mix(shallow, deep, 1.0 - exp(-depth * 0.22));
        vec3 col = mix(body, refl, F) + spec;
        // Brandung
        vec4 nz = texture(uNoise, p * 0.05 + vec2(t * 0.01, 0.0));
        float shore = smoothstep(2.4, 0.0, depth);
        float bands = smoothstep(0.55, 0.95, sin(depth * 4.5 - t * 1.4 + nz.r * 6.0) * 0.5 + 0.5);
        float foam = shore * (bands * 0.8 + smoothstep(0.6, 0.0, depth)) * smoothstep(0.25, 0.65, nz.b + texture(uNoise, p * 0.3).a * 0.4);
        foam += smoothstep(0.35, 0.75, vWaveH) * smoothstep(0.55, 0.8, texture(uNoise, p * 0.08 - t * 0.02).b) * 0.35;
        foam = clamp(foam, 0.0, 1.0);
        col = mix(col, vec3(0.85, 0.9, 0.92) * (uAmbient + uSunLight * (0.3 + 0.7 * sunUp)), foam * 0.85);
        // Scheinwerferkegel des Autos (nachts)
        if (uHeadlight.w > 0.0) {
          float hd = length(vWorld.xz - uHeadlight.xz);
          col += vec3(1.0, 0.95, 0.85) * uHeadlight.w * 0.4 / (1.0 + hd * hd * 0.02) * F;
        }
        col = fogBlend(col, cameraPosition, -V, dist);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return {
    mesh,
    update(camera) {
      // horizontal mitführen, in Schritten gerastert (weniger Schwimmen)
      mesh.position.set(Math.round(camera.position.x / 4) * 4, 0, Math.round(camera.position.z / 4) * 4);
    },
    uniforms,
  };
}
