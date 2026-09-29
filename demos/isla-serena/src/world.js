// Prozedurale Insel: Heightmap, Küstenstraße (geschlossene Spline), Abstandsfeld zur Straße, Normalen.
import * as THREE from 'three';
import { simplex, smoothstep, lerp, clamp } from './noise.js';
import noiseGLSL from './glsl/noise.glsl';

export const N = 2048;          // Texel pro Seite
export const CELL = 2;          // Meter pro Texel
export const HALF = (N * CELL) / 2; // 2048 m
export const ROAD_HALF = 4.6;   // halbe Fahrbahnbreite
export const SEA = 0;

// Geschlossene Catmull-Rom-Spline (zentripetal), in 1-m-Schritten neu abgetastet
function buildRoad(baseAt) {
  const ctrl = [];
  const K = 30;
  for (let k = 0; k < K; k++) {
    const a = (k / K) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const r = 1200 + 150 * simplex(ca * 1.2 + 4, sa * 1.2 - 2) + 70 * simplex(ca * 3.1, sa * 3.1 + 9);
    ctrl.push([ca * r, sa * r]);
  }
  // dicht abtasten
  const dense = [];
  const SUB = 60;
  for (let k = 0; k < K; k++) {
    const p0 = ctrl[(k - 1 + K) % K], p1 = ctrl[k], p2 = ctrl[(k + 1) % K], p3 = ctrl[(k + 2) % K];
    const d = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5) || 1e-4;
    const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    for (let s = 0; s < SUB; s++) {
      const t = t1 + ((t2 - t1) * s) / SUB;
      const P = [0, 0];
      for (let c = 0; c < 2; c++) {
        const A1 = ((t1 - t) / (t1 - t0)) * p0[c] + ((t - t0) / (t1 - t0)) * p1[c];
        const A2 = ((t2 - t) / (t2 - t1)) * p1[c] + ((t - t1) / (t2 - t1)) * p2[c];
        const A3 = ((t3 - t) / (t3 - t2)) * p2[c] + ((t - t2) / (t3 - t2)) * p3[c];
        const B1 = ((t2 - t) / (t2 - t0)) * A1 + ((t - t0) / (t2 - t0)) * A2;
        const B2 = ((t3 - t) / (t3 - t1)) * A2 + ((t - t1) / (t3 - t1)) * A3;
        P[c] = ((t2 - t) / (t2 - t1)) * B1 + ((t - t1) / (t2 - t1)) * B2;
      }
      dense.push(P);
    }
  }
  // Bogenlänge
  const cum = [0];
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1], b = dense[i % dense.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = cum[dense.length];
  const M = Math.floor(total);
  const X = new Float32Array(M), Z = new Float32Array(M);
  let seg = 0;
  for (let m = 0; m < M; m++) {
    const s = (m / M) * total;
    while (cum[seg + 1] < s) seg++;
    const f = (s - cum[seg]) / (cum[seg + 1] - cum[seg]);
    const a = dense[seg], b = dense[(seg + 1) % dense.length];
    X[m] = a[0] + (b[0] - a[0]) * f;
    Z[m] = a[1] + (b[1] - a[1]) * f;
  }
  const step = total / M;

  // Höhenprofil: Gelände glätten, Mindesthöhe, Steigung begrenzen
  let Y = new Float32Array(M);
  for (let m = 0; m < M; m++) Y[m] = Math.max(baseAt(X[m], Z[m]), 4.5);
  const smooth = (arr, w) => {
    const out = new Float32Array(M);
    let acc = 0;
    for (let k = -w; k <= w; k++) acc += arr[(k + M) % M];
    for (let m = 0; m < M; m++) {
      out[m] = acc / (2 * w + 1);
      acc += arr[(m + w + 1) % M] - arr[(m - w + M) % M];
    }
    return out;
  };
  for (let p = 0; p < 4; p++) Y = smooth(Y, 70);
  for (let m = 0; m < M; m++) Y[m] = Math.max(Y[m], 5.5);
  const g = 0.075 * step;
  for (let it = 0; it < 3; it++) {
    for (let m = 1; m < M * 2; m++) {
      const a = (m - 1) % M, b = m % M;
      Y[b] = clamp(Y[b], Y[a] - g, Y[a] + g);
    }
    for (let m = M * 2; m > 0; m--) {
      const a = m % M, b = (m - 1) % M;
      Y[b] = clamp(Y[b], Y[a] - g, Y[a] + g);
    }
  }
  for (let p = 0; p < 2; p++) Y = smooth(Y, 25);

  // Tangenten, Krümmung, Querneigung
  const TX = new Float32Array(M), TZ = new Float32Array(M), K2 = new Float32Array(M), BANK = new Float32Array(M);
  for (let m = 0; m < M; m++) {
    const a = (m - 2 + M) % M, b = (m + 2) % M;
    const dx = X[b] - X[a], dz = Z[b] - Z[a];
    const l = Math.hypot(dx, dz);
    TX[m] = dx / l; TZ[m] = dz / l;
  }
  for (let m = 0; m < M; m++) {
    const a = (m - 6 + M) % M, b = (m + 6) % M;
    // signierte Krümmung (Kreuzprodukt der Tangenten)
    K2[m] = (TX[a] * TZ[b] - TZ[a] * TX[b]) / (12 * step);
  }
  let kS = smooth(K2, 20);
  for (let m = 0; m < M; m++) BANK[m] = clamp(kS[m] * 9.0, -0.07, 0.07);
  BANK.set(smooth(BANK, 15));

  return { X, Z, Y, TX, TZ, K: kS, BANK, M, step, length: total };
}

// Rohgelände auf der GPU erzeugen (2048² Auswertungen fbm/ridged) und zurücklesen
const genFrag = /* glsl */ `
precision highp float;
${noiseGLSL}
uniform float uHalf, uCell;
out vec4 outColor;
float smooth01(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
void main() {
  vec2 ij = floor(gl_FragCoord.xy);
  vec2 p = -uHalf + ij * uCell;
  float wx = fbm2(p * 0.00055 + vec2(11.3, -4.1), 3) * 380.0;
  float wz = fbm2(p * 0.00055 + vec2(-7.7, 21.9), 3) * 380.0;
  vec2 q = p + vec2(wx, wz);
  float rr = length(q);
  float coast = 1560.0 + 210.0 * fbm2(p * 0.0011, 3);
  float island = smooth01(coast + 260.0, coast - 220.0, rr);
  float core = smooth01(1350.0, 150.0, rr);
  float mount = ridged2(q * 0.00105 + vec2(3.1, -1.7));
  float peak = pow(core, 1.25) * (mount * 470.0 + 60.0 * core);
  float hills = (fbm2(p * 0.0028, 4) * 0.5 + 0.5) * 38.0;
  float detail = fbm2(p * 0.021, 3) * 2.4;
  float northness = smooth01(-400.0, 900.0, -p.y + 300.0 * snoise(vec2(p.x * 0.0009, 5.5)));
  float cliff = northness * 30.0 * smooth01(0.35, 0.8, island);
  float land = 3.0 + hills + peak + detail + cliff;
  float seabed = -58.0 + 20.0 * fbm2(p * 0.002, 2);
  float h = mix(seabed, land, pow(island, 0.9));
  outColor = vec4(h, 0.0, 0.0, 1.0);
}`;

function generateBase(renderer) {
  const rt = new THREE.WebGLRenderTarget(N, N, { type: THREE.FloatType, format: THREE.RGBAFormat, depthBuffer: false });
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: 'in vec3 position; void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: genFrag,
    uniforms: { uHalf: { value: HALF }, uCell: { value: CELL } },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  const H = new Float32Array(N * N);
  const STRIP = 256;
  const buf = new Float32Array(N * STRIP * 4);
  for (let y = 0; y < N; y += STRIP) {
    renderer.readRenderTargetPixels(rt, 0, y, N, STRIP, buf);
    for (let k = 0; k < N * STRIP; k++) H[y * N + k] = buf[k * 4];
  }
  renderer.setRenderTarget(prev);
  rt.dispose(); mat.dispose(); quad.geometry.dispose();
  return H;
}

export async function buildWorld(renderer, progress = () => {}) {
  const tick = () => new Promise((r) => setTimeout(r, 0));
  progress(0.05, 'Insel wird geformt'); await tick();
  const H = generateBase(renderer);
  const baseAt = (x, z) => {
    const fx = clamp((x + HALF) / CELL, 0, N - 1.001), fz = clamp((z + HALF) / CELL, 0, N - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    return lerp(lerp(H[j * N + i], H[j * N + i + 1], tx), lerp(H[(j + 1) * N + i], H[(j + 1) * N + i + 1], tx), tz);
  };

  // 2) Straße
  progress(0.62, 'Küstenstraße wird trassiert'); await tick();
  const road = buildRoad(baseAt);

  // 3) Abstandsfeld + Straßenhöhe stempeln
  const D = new Float32Array(N * N).fill(1e4);
  const RH = new Float32Array(N * N);
  const RT = new Float32Array(N * N); // Bogenlängen-Index der nächsten Straßenstelle
  const R = 56;
  const rc = Math.ceil(R / CELL);
  for (let m = 0; m < road.M; m++) {
    const x = road.X[m], z = road.Z[m];
    const ci = Math.round((x + HALF) / CELL), cj = Math.round((z + HALF) / CELL);
    for (let dj = -rc; dj <= rc; dj++) {
      const j = cj + dj; if (j < 0 || j >= N) continue;
      const wz = -HALF + j * CELL - z;
      for (let di = -rc; di <= rc; di++) {
        const i = ci + di; if (i < 0 || i >= N) continue;
        const wx = -HALF + i * CELL - x;
        const d = Math.hypot(wx, wz);
        const idx = j * N + i;
        if (d < D[idx]) { D[idx] = d; RH[idx] = road.Y[m]; RT[idx] = m; }
      }
    }
    if ((m & 1023) === 0) { progress(0.62 + 0.18 * (m / road.M), 'Küstenstraße wird trassiert'); await tick(); }
  }
  // exakte Querprojektion: Abstand senkrecht zur Tangente (glatter als Punktabstand)
  for (let idx = 0; idx < N * N; idx++) {
    if (D[idx] > R) continue;
    const m = RT[idx];
    const i = idx % N, j = (idx / N) | 0;
    const wx = -HALF + i * CELL - road.X[m], wz = -HALF + j * CELL - road.Z[m];
    // seitlicher Abstand und Querneigung
    const side = wx * -road.TZ[m] + wz * road.TX[m];
    D[idx] = Math.abs(side);
    RH[idx] = road.Y[m] + side * road.BANK[m];
  }

  // 4) Gelände an Straße anpassen (Einschnitte/Dämme)
  progress(0.82, 'Böschungen werden modelliert'); await tick();
  for (let idx = 0; idx < N * N; idx++) {
    const d = D[idx];
    if (d > R) continue;
    const w = 1 - smoothstep(ROAD_HALF + 1.2, ROAD_HALF + 26, d);
    const target = RH[idx] - (d < ROAD_HALF + 0.6 ? 0.3 : 0.12);
    H[idx] = lerp(H[idx], target, w);
  }

  // 5) Normalen + Straßenabstand in RGBA8
  progress(0.9, 'Normalen werden berechnet'); await tick();
  const NRM = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const l = H[j * N + Math.max(i - 1, 0)], r = H[j * N + Math.min(i + 1, N - 1)];
      const u = H[Math.max(j - 1, 0) * N + i], d = H[Math.min(j + 1, N - 1) * N + i];
      let nx = -(r - l) / (2 * CELL), ny = 1, nz = -(d - u) / (2 * CELL);
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const o = (j * N + i) * 4;
      NRM[o] = (nx * 0.5 + 0.5) * 255;
      NRM[o + 1] = (ny * 0.5 + 0.5) * 255;
      NRM[o + 2] = (nz * 0.5 + 0.5) * 255;
      NRM[o + 3] = Math.min(255, (D[j * N + i] / 64) * 255);
    }
  }

  const heightAt = (x, z) => {
    const fx = clamp((x + HALF) / CELL, 0, N - 1.001), fz = clamp((z + HALF) / CELL, 0, N - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz);
    const tx = fx - i, tz = fz - j;
    const a = H[j * N + i], b = H[j * N + i + 1], c = H[(j + 1) * N + i], d = H[(j + 1) * N + i + 1];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  };
  const sample = (arr, x, z) => {
    const i = Math.round((x + HALF) / CELL), j = Math.round((z + HALF) / CELL);
    if (i < 0 || j < 0 || i >= N || j >= N) return 1e4;
    return arr[j * N + i];
  };
  const roadDistAt = (x, z) => sample(D, x, z);
  const normalYAt = (x, z) => {
    const i = clamp(Math.round((x + HALF) / CELL), 0, N - 1), j = clamp(Math.round((z + HALF) / CELL), 0, N - 1);
    return NRM[(j * N + i) * 4 + 1] / 127.5 - 1;
  };

  progress(0.95, 'Vegetation wird gepflanzt'); await tick();
  return { H, D, NRM, road, heightAt, roadDistAt, normalYAt };
}
