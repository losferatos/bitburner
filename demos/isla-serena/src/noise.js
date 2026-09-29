// Schnelles 2D-Simplex-Rauschen (CPU) mit festem Seed, plus fbm/ridged Varianten.

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = mulberry32(1337);

const perm = new Uint8Array(512);
const gx = new Float32Array(512);
const gy = new Float32Array(512);
{
  const r = mulberry32(90210);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    const a = (perm[i] / 256) * Math.PI * 2;
    gx[i] = Math.cos(a); gy[i] = Math.sin(a);
  }
}

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

export function simplex(x, y) {
  const s = (x + y) * F2;
  const i = Math.floor(x + s), j = Math.floor(y + s);
  const t = (i + j) * G2;
  const x0 = x - (i - t), y0 = y - (j - t);
  const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
  const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
  const ii = i & 255, jj = j & 255;
  let n = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) { const g = perm[ii + perm[jj]]; t0 *= t0; n += t0 * t0 * (gx[g] * x0 + gy[g] * y0); }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) { const g = perm[ii + i1 + perm[jj + j1]]; t1 *= t1; n += t1 * t1 * (gx[g] * x1 + gy[g] * y1); }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) { const g = perm[ii + 1 + perm[jj + 1]]; t2 *= t2; n += t2 * t2 * (gx[g] * x2 + gy[g] * y2); }
  return 99 * n; // ca. [-1,1]
}

export function fbm(x, y, oct = 5, lac = 2.03, gain = 0.5) {
  let a = 1, f = 1, s = 0, n = 0;
  for (let o = 0; o < oct; o++) {
    s += a * simplex(x * f + o * 17.3, y * f - o * 9.1);
    n += a; a *= gain; f *= lac;
  }
  return s / n;
}

export function ridged(x, y, oct = 6) {
  let a = 0.5, f = 1, s = 0, w = 1;
  for (let o = 0; o < oct; o++) {
    let n = 1 - Math.abs(simplex(x * f + o * 31.7, y * f + o * 7.7));
    n *= n;
    n *= w;
    w = Math.min(1, Math.max(0, n * 1.6));
    s += n * a;
    f *= 2.07; a *= 0.52;
  }
  return s;
}

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
