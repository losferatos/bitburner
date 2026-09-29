// Kachelbare Rausch-Texturen (CPU, einmalig beim Start)
import * as THREE from 'three';

function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// periodisches Gradientenrauschen, Periode P Zellen
function pnoise(x, y, P, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const g = (ix, iy) => {
    const a = hash2(((ix % P) + P) % P, ((iy % P) + P) % P, seed) * Math.PI * 2;
    return [Math.cos(a), Math.sin(a)];
  };
  const d = (ix, iy) => { const gg = g(ix, iy); return gg[0] * (x - ix) + gg[1] * (y - iy); };
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = d(x0, y0), b = d(x0 + 1, y0), c = d(x0, y0 + 1), e = d(x0 + 1, y0 + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v) * 1.414;
}

function pfbm(x, y, P, oct, seed) {
  let s = 0, a = 0.5, n = 0;
  for (let o = 0; o < oct; o++) {
    s += a * pnoise(x, y, P, seed + o * 13);
    n += a; a *= 0.5; x *= 2; y *= 2; P *= 2;
  }
  return s / n;
}

function pworley(x, y, P, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let md = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j;
    const wx = ((cx % P) + P) % P, wy = ((cy % P) + P) % P;
    const px = cx + hash2(wx, wy, seed), py = cy + hash2(wx, wy, seed + 7);
    md = Math.min(md, Math.hypot(px - x, py - y));
  }
  return md;
}

// R: fbm (Periode 4), G: fbm anderer Seed, B: invertiertes Worley, A: feines Rauschen
export function makeNoiseTexture(S = 256) {
  const data = new Uint8Array(S * S * 4);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const u = i / S, v = j / S;
    const r = pfbm(u * 4, v * 4, 4, 6, 1) * 0.5 + 0.5;
    const g = pfbm(u * 6, v * 6, 6, 5, 99) * 0.5 + 0.5;
    const w = 1 - Math.min(1, pworley(u * 8, v * 8, 8, 5) * 1.1);
    const w2 = 1 - Math.min(1, pworley(u * 16, v * 16, 16, 9) * 1.1);
    const b = w * 0.7 + w2 * 0.3;
    const a = pfbm(u * 32, v * 32, 32, 3, 55) * 0.5 + 0.5;
    const o = (j * S + i) * 4;
    data[o] = Math.max(0, Math.min(255, r * 255));
    data[o + 1] = Math.max(0, Math.min(255, g * 255));
    data[o + 2] = Math.max(0, Math.min(255, b * 255));
    data[o + 3] = Math.max(0, Math.min(255, a * 255));
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}
