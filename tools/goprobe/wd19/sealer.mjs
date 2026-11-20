// Versuchspolitik "Taschenbauer": Schwarz mauert leere Gebiete bis 11 Punkte ein,
// die die Gegner-KI danach nie betritt (controlledTerritory.ts findDisputedTerritory).
import { _intern } from "./gomcts-versuch.js";
const { geomOf, chainLibs, play } = _intern;
const E = 0, B = 1, W = 2;
const POCKET_MAX = 11;

export function createPolicy(n, opt = {}) {
  const geo = geomOf(n); const N = n * n; const nb = geo.nb;
  const blocked = new Set();
  const koOut = [-1];
  const tmp = new Uint8Array(N);
  const vis = new Int32Array(N); let visMark = 0;
  const minEff = opt.minEff ?? 0.5;
  const maxWall = opt.maxWall ?? 99;
  const minDist = opt.minDist ?? 0;      // Mauersteine mindestens so weit von Weiss
  const react2 = opt.react2 ?? false;    // eigene Kette mit 2 Freiheiten neben Weiss staerken
  const distW = opt.distW ?? 0;          // Gewicht: Plaene fern von Weiss bevorzugen

  const libsAfter = (g, i) => {
    if (g[i] !== E || blocked.has(i)) return -1;
    tmp.set(g);
    if (play(geo, tmp, i, B, -1, koOut, false) < 0) return -1;
    return chainLibs(geo, tmp, i, 9);
  };
  const whiteAdj = (g, i) => { for (let k = 0; k < 4; k++) { const q = nb[i * 4 + k]; if (q >= 0 && g[q] === W) return true; } return false; };

  /** Dringendes: schlagen, retten. */
  function urgent(g) {
    visMark++;
    let best = -1, bestSize = 0;
    for (let i = 0; i < N; i++) {
      if (g[i] !== W || vis[i] === visMark) continue;
      const libs = chainLibs(geo, g, i, 2), size = geo.size, last = geo.last;
      for (let t = 0; t < size; t++) vis[geo.chain[t]] = visMark;
      if (libs === 1 && size > bestSize && libsAfter(g, last) >= 1) { best = last; bestSize = size; }
    }
    if (best >= 0) return best;
    visMark++;
    for (let i = 0; i < N; i++) {
      if (g[i] !== B || vis[i] === visMark) continue;
      const libs = chainLibs(geo, g, i, 2), size = geo.size, last = geo.last;
      for (let t = 0; t < size; t++) vis[geo.chain[t]] = visMark;
      if (libs === 1 && size > bestSize && libsAfter(g, last) >= 2) { best = last; bestSize = size; }
    }
    if (best >= 0 || !react2) return best;
    // Eigene Kette mit 2 Freiheiten, die Weiss beruehrt: an der Freiheit verlaengern, die am meisten bringt.
    visMark++;
    let gain = 0;
    for (let i = 0; i < N; i++) {
      if (g[i] !== B || vis[i] === visMark) continue;
      const libs = chainLibs(geo, g, i, 3), size = geo.size;
      let touch = false; const ch = Array.from(geo.chain.subarray(0, size));
      for (const c of ch) { vis[c] = visMark; if (whiteAdj(g, c)) touch = true; }
      if (libs !== 2 || !touch) continue;
      for (const c of ch) for (let k = 0; k < 4; k++) {
        const q = nb[c * 4 + k]; if (q < 0 || g[q] !== E) continue;
        const la = libsAfter(g, q);
        if (la >= 3 && la * 10 + size > gain) { gain = la * 10 + size; best = q; }
      }
    }
    return best;
  }

  /** Ist das leere Gebiet um i schon eine sichere Tasche (<= 11, nur Schwarz am Rand)? */
  const inR = new Int32Array(N); let rMark = 0;
  function pocketOf(g, i, list) {
    rMark++; let nn = 0, head = 0, black = false, white = false;
    list[nn++] = i; inR[i] = rMark;
    while (head < nn) {
      const p = list[head++];
      for (let k = 0; k < 4; k++) {
        const q = nb[p * 4 + k]; if (q < 0) continue;
        const v = g[q];
        if (v === W) white = true; else if (v === B) black = true;
        else if (v === E && inR[q] !== rMark) { if (nn > POCKET_MAX) return -1; inR[q] = rMark; list[nn++] = q; }
      }
    }
    return (!white && black && nn <= POCKET_MAX) ? nn : -1;
  }
  const plist = new Int16Array(64);
  function sealedMask(g) {
    const m = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (g[i] !== E || m[i]) continue;
      const s = pocketOf(g, i, plist);
      if (s > 0) for (let t = 0; t < s; t++) m[plist[t]] = 1;
      else m[i] = 2;   // geprueft, keine Tasche (nur dieser Punkt markiert)
    }
    return m;
  }

  /** Bester Taschenplan: Gebiet R (<= 11, kein weisser Nachbar) und Mauer Wl (leere Randpunkte). */
  function bestPlans(g, sealed) {
    const plans = [];
    const inRegion = new Int32Array(N), inWall = new Int32Array(N); let mark = 0;
    for (let seed = 0; seed < N; seed++) {
      if (g[seed] !== E || sealed[seed] === 1 || whiteAdj(g, seed)) continue;
      mark++;
      const R = [seed]; inRegion[seed] = mark;
      let Wl = [];
      const addWall = (p) => { for (let k = 0; k < 4; k++) { const q = nb[p * 4 + k]; if (q >= 0 && g[q] === E && inRegion[q] !== mark && inWall[q] !== mark) { inWall[q] = mark; Wl.push(q); } } };
      addWall(seed);
      while (true) {
        if (Wl.length > 0 && Wl.length <= maxWall) {
          let blackNb = false;
          plans.push({ eff: R.length / Wl.length, R: R.slice(), Wl: Wl.slice() });
        }
        if (R.length >= POCKET_MAX) break;
        // wachsen: Mauerpunkt ohne weissen Nachbarn, der die Mauer am wenigsten verlaengert
        let bc = -1, bAdd = 99;
        for (const c of Wl) {
          if (whiteAdj(g, c) || sealed[c] === 1) continue;
          let add = 0;
          for (let k = 0; k < 4; k++) { const q = nb[c * 4 + k]; if (q >= 0 && g[q] === E && inRegion[q] !== mark && inWall[q] !== mark) add++; }
          if (add < bAdd) { bAdd = add; bc = c; }
        }
        if (bc < 0) break;
        inRegion[bc] = mark; R.push(bc);
        Wl = Wl.filter((x) => x !== bc);
        addWall(bc);
      }
    }
    plans.sort((a, b) => b.eff - a.eff || a.Wl.length - b.Wl.length);
    return plans;
  }

  const distWhite = (g, i) => {
    const x = Math.floor(i / n), y = i % n; let d = 99;
    for (let j = 0; j < N; j++) if (g[j] === W) { const dd = Math.abs(Math.floor(j / n) - x) + Math.abs((j % n) - y); if (dd < d) d = dd; }
    return d;
  };

  function move(g, info) {
    const u = urgent(g);
    if (u >= 0) return u;
    const sealed = sealedMask(g);
    const plans = bestPlans(g, sealed);
    let chosen = null, cs = -1;
    for (const p of plans.slice(0, 60)) {
      if (p.eff < minEff) break;
      const cand = p.Wl.filter((i) => libsAfter(g, i) >= 2).sort((a, b) => distWhite(g, a) - distWhite(g, b));
      if (cand.length < p.Wl.length) continue;   // Mauer nicht vollstaendig baubar
      const d = distWhite(g, cand[0]);
      if (d < minDist) continue;
      const sc = p.eff + distW * Math.min(d, 6);
      if (sc > cs) { cs = sc; chosen = cand[0]; }
      if (!distW) break;
    }
    if (chosen !== null) return chosen;
    // Rest: sicherer Punkt ausserhalb eigener Taschen mit den meisten freien Nachbarn
    let best = -1, bs = -1;
    for (let i = 0; i < N; i++) {
      if (g[i] !== E || sealed[i] === 1) continue;
      const la = libsAfter(g, i);
      if (la < 2) continue;
      let s = la;
      if (s > bs) { bs = s; best = i; }
    }
    return best;
  }

  function sealedCount(g) {
    const m = sealedMask(g); let c = 0;
    for (let i = 0; i < N; i++) if (g[i] === B || m[i] === 1) c++;
    return c;
  }
  return { move, reject: (i) => blocked.add(i), sealedCount };
}
