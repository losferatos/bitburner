/**
 * Baumsuche fuer IPvGO (UCT mit schnellen Zufallspartien), 24.10.2026.
 *
 * Reines JS ohne ns - kostet im Spiel 0 GB RAM und ist ausserhalb testbar.
 *
 * Brett: flaches Feld, 0 leer, 1 Spieler (Schwarz), 2 Gegner (Weiss),
 * 3 offline. Wertung wie scoring.ts getScore: Steine plus leere Gebiete, die
 * nur an eine Farbe grenzen; Weiss bekommt das Komi. Tote Steine werden NICHT
 * entfernt (das Spiel tut es auch nicht) - deshalb laufen die Zufallspartien
 * bis zum Ende (keine Zuege ausser eigenen Augen), dann ist die Flaechen-
 * wertung exakt.
 *
 * Wiederholungsverbot: an der Wurzel gegen die echte Brett-Historie
 * (boardRepeated, boardAnalysis.ts:88-91), im Baum und in den Zufallspartien
 * nur der einfache Ko (Naeherung).
 */

const E = 0, B = 1, Wt = 2, X = 3;

function makeGeom(n) {
  const N = n * n;
  const nb = new Int16Array(N * 4).fill(-1);
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
    const i = x * n + y;
    let k = 0;
    if (x > 0) nb[i * 4 + k++] = i - n;
    if (x < n - 1) nb[i * 4 + k++] = i + n;
    if (y > 0) nb[i * 4 + k++] = i - 1;
    if (y < n - 1) nb[i * 4 + k++] = i + 1;
  }
  return { n, N, nb, stamp: new Int32Array(N), stack: new Int16Array(N), mark: 1, chain: new Int16Array(N),
    seen: new Int32Array(N), seenMark: 1, size: 0, last: -1,
    capPts: new Int16Array(N), savePts: new Int16Array(N), tmp: new Uint8Array(N) };
}
const geomCache = new Map();

// MARKEN NIE UEBER INT32 (24.10.2026). stamp/seen sind Int32Array; ab 2^31
// Aufrufen wickelt der gespeicherte Wert um, `stamp[q] === m` greift nie
// mehr, und chainLibs laeuft endlos. Im Pruefstand nach rund 140 s Rechenzeit
// (2,1 Mrd Kettensuchen), im Spiel nach wenigen Stunden.
const MARK_MAX = 1e9;
function nextMark(geo) {
  if (geo.mark >= MARK_MAX) { geo.stamp.fill(0); geo.mark = 0; }
  return ++geo.mark;
}
function nextSeen(geo) {
  if (geo.seenMark >= MARK_MAX) { geo.seen.fill(0); geo.seenMark = 0; }
  return ++geo.seenMark;
}
function geomOf(n) {
  let g = geomCache.get(n);
  if (!g) { g = makeGeom(n); geomCache.set(n, g); }
  return g;
}

/** Freiheiten der Kette ab s (bis max zaehlen); fuellt geo.chain, gibt [libs, size, lastLib]. */
function chainLibs(geo, b, s, max) {
  const { nb, stamp, stack, chain } = geo;
  const m = nextMark(geo);
  const c = b[s];
  let sp = 0, size = 0, libs = 0, lastLib = -1;
  stack[sp++] = s; stamp[s] = m;
  while (sp > 0) {
    const p = stack[--sp];
    chain[size++] = p;
    for (let k = 0; k < 4; k++) {
      const q = nb[p * 4 + k];
      if (q < 0 || stamp[q] === m) continue;
      const v = b[q];
      if (v === E) { stamp[q] = m; libs++; lastLib = q; if (libs >= max) { geo.size = size; geo.last = lastLib; return libs; } }
      else if (v === c) { stamp[q] = m; stack[sp++] = q; }
    }
  }
  geo.size = size; geo.last = lastLib;
  return libs;
}

/**
 * Spielt c auf i. Gibt -1 bei illegal (besetzt, Selbstmord, Ko), sonst die
 * Zahl der geschlagenen Steine. koOut[0] = neuer Ko-Punkt oder -1.
 */
function play(geo, b, i, c, ko, koOut, noSelfAtari) {
  if (b[i] !== E || i === ko) return -1;
  const { nb, chain } = geo;
  const o = 3 - c;
  b[i] = c;
  let captured = 0, capPoint = -1;
  for (let k = 0; k < 4; k++) {
    const q = nb[i * 4 + k];
    if (q < 0 || b[q] !== o) continue;
    const libs = chainLibs(geo, b, q, 1), size = geo.size;
    if (libs === 0) {
      for (let t = 0; t < size; t++) b[chain[t]] = E;
      captured += size;
      capPoint = q;
    }
  }
  const ownLibs = chainLibs(geo, b, i, 2), ownSize = geo.size;
  if (ownLibs === 0) { b[i] = E; return -1; }       // Selbstmord (nichts geschlagen)
  // Selbst-Atari einer Kette ab zwei Steinen ohne Schlag (24.10.2026): in
  // verlorenen Pruefstand-Partien starb so die ganze eigene Gruppe (0:53).
  // Ohne Schlag ist das Zuruecknehmen nur der eine Stein.
  if (noSelfAtari && captured === 0 && ownLibs === 1 && ownSize >= 2) { b[i] = E; return -1; }
  // Einfacher Ko: genau ein Stein geschlagen, eigener Stein allein mit einer Freiheit.
  koOut[0] = (captured === 1 && ownSize === 1 && ownLibs === 1) ? capPoint : -1;
  return captured;
}

/**
 * Eigenes Auge: alle Nachbarn eigene Farbe oder Rand/offline - AUSSER eine
 * angrenzende eigene Kette hat nur noch diese eine Freiheit. Dann ist der
 * Punkt ein falsches Auge, und das Verbinden dort rettet die Kette
 * (Skeptiker 24.10.2026: sonst schlug Weiss 7 Steine, die Suche durfte den
 * rettenden Zug nie spielen).
 */
function isEye(geo, b, i, c) {
  const { nb } = geo;
  for (let k = 0; k < 4; k++) {
    const q = nb[i * 4 + k];
    if (q < 0) continue;
    const v = b[q];
    if (v !== c && v !== X) return false;
  }
  for (let k = 0; k < 4; k++) {
    const q = nb[i * 4 + k];
    if (q >= 0 && b[q] === c && chainLibs(geo, b, q, 2) === 1) return false;
  }
  return true;
}

/** Flaechenwertung: [schwarz, weiss] ohne Komi. */
export function areaScore(geo, b) {
  const { N, nb, stamp, stack } = geo;
  let sb = 0, sw = 0;
  const m = nextMark(geo);
  for (let i = 0; i < N; i++) {
    const v = b[i];
    if (v === B) sb++;
    else if (v === Wt) sw++;
    else if (v === E && stamp[i] !== m) {
      let sp = 0, size = 0, seen = 0;
      stack[sp++] = i; stamp[i] = m;
      while (sp > 0) {
        const p = stack[--sp]; size++;
        for (let k = 0; k < 4; k++) {
          const q = nb[p * 4 + k];
          if (q < 0) continue;
          const w = b[q];
          if (w === E) { if (stamp[q] !== m) { stamp[q] = m; stack[sp++] = q; } }
          else if (w === B) seen |= 1;
          else if (w === Wt) seen |= 2;
        }
      }
      // Zu grosse leere Gebiete gehoeren niemandem (scoring.ts
      // checkTerritoryOwnership: mehr als n^2 - 3 Felder, Skeptiker 24.10.).
      if (size > N - 3) continue;
      if (seen === 1) sb += size;
      else if (seen === 2) sw += size;
    }
  }
  return [sb, sw];
}

/** Schnelle Zufallspartie ab b (wird veraendert). Gibt [schwarz, weiss] zurueck. */
function rollout(geo, b, toMove, ko, rnd, moves, amaf, oppModel, noSA, passes0) {
  const { N } = geo;
  const koOut = [-1];
  // Pass-Stand aus dem Baum uebernehmen (Skeptiker 24.10.): nach einem Pass
  // im Baum beendet ein weiterer Pass die Partie auch in der Simulation.
  let passes = passes0 || 0, c = toMove, steps = 0;
  const cand = moves;
  const { capPts, savePts, tmp } = geo;
  // 6N statt 3N (Skeptiker 24.10.): 3N schnitt 15 % der Zufallspartien ab.
  while (passes < 2 && steps < 6 * N) {
    steps++;
    // Kandidaten sammeln
    let nc = 0;
    for (let i = 0; i < N; i++) if (b[i] === E && i !== ko && !isEye(geo, b, i, c)) cand[nc++] = i;
    // Ein Durchlauf ueber alle Ketten: Schlagpunkte (Gegnerkette mit einer
    // Freiheit) und Rettungspunkte (eigene Kette mit einer Freiheit).
    const { chain, seen } = geo;
    const sm = nextSeen(geo);
    let ncap = 0, nsave = 0;
    for (let i = 0; i < N; i++) {
      const v = b[i];
      if ((v !== B && v !== Wt) || seen[i] === sm) continue;
      const libs = chainLibs(geo, b, i, 2), size = geo.size, last = geo.last;
      for (let t = 0; t < size; t++) seen[chain[t]] = sm;
      if (libs === 1 && last !== ko) {
        if (v !== c) capPts[ncap++] = last; else savePts[nsave++] = last;
      }
    }
    let played = -1;
    // Gegnermodell (goAI.ts getTetradPriorityMove): Weiss schlaegt IMMER, wenn
    // es kann, und rettet sonst eine eigene Kette in Atari (defendCapture).
    const pCap = oppModel && c === Wt ? 1 : 0.8;
    if (ncap > 0 && rnd() < pCap) {
      const start = Math.floor(rnd() * ncap);
      for (let t = 0; t < ncap && played < 0; t++) {
        const i = capPts[(start + t) % ncap];
        if (play(geo, b, i, c, ko, koOut) >= 0) played = i;
      }
    }
    if (played < 0 && nsave > 0 && oppModel && c === Wt) {
      for (let t = 0; t < nsave && played < 0; t++) {
        const i = savePts[t];
        if (b[i] !== E) continue;
        tmp.set(b);
        if (play(geo, b, i, c, ko, koOut) >= 0) {
          if (chainLibs(geo, b, i, 2) > 1) played = i;
          else b.set(tmp);
        }
      }
    }
    while (played < 0 && nc > 0) {
      const t = Math.floor(rnd() * nc);
      const i = cand[t];
      cand[t] = cand[--nc];
      if (play(geo, b, i, c, ko, koOut, noSA) >= 0) played = i;
    }
    if (played < 0) { passes++; ko = -1; }
    else {
      passes = 0; ko = koOut[0];
      if (amaf && amaf[played] === 0) amaf[played] = c;
    }
    c = 3 - c;
  }
  return areaScore(geo, b);
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


class Node {
  constructor(move, toMove) {
    this.move = move;          // Zug, der hierher fuehrte (-1 Pass)
    this.toMove = toMove;      // wer hier am Zug ist
    this.children = null;
    this.visits = 0;
    this.wins = 0;             // aus Sicht dessen, der `move` gespielt hat
    this.raveV = 0; this.raveW = 0;
  }
}

/**
 * Sucher mit wiederverwendbarem Baum (24.10.2026).
 *
 * reset(g0, toMove, passes) setzt die Wurzel; simulate() sucht von ihr aus;
 * advance(move) zieht die Wurzel einen Zug weiter und BEHAELT den Teilbaum.
 * So kann go.js waehrend der Bedenkzeit des Gegners weitersuchen (Wurzel:
 * Weiss am Zug) und nach dessen Zug den passenden Teilbaum uebernehmen.
 *
 * Wiederholungsverbot: Ist Schwarz an der Wurzel am Zug, werden deren Kinder
 * gegen die echte Historie (opt.history mit opt.keyOf) gefiltert; im Baum
 * gilt nur der einfache Ko.
 *
 * opt: komi, history (Set), keyOf, blocked (Set), c, raveK, rave, scoreW,
 *      oppModel, noSelfAtari, noSelfAtariTree, seed
 */
export function createSearcher(n, opt = {}) {
  const geo = geomOf(n);
  const { N } = geo;
  const komi = opt.komi ?? 5.5;
  const rnd = mulberry(opt.seed ?? ((Math.random() * 2 ** 31) | 0));
  const C = opt.c ?? 0.6;
  const RAVE_K = opt.raveK ?? 300;
  const useRave = opt.rave !== false;
  const scoreW = opt.scoreW ?? 0;
  const noSA = opt.noSelfAtari !== false;
  const noSAtree = !!opt.noSelfAtariTree;
  const keyOf = opt.keyOf || null;
  let history = opt.history || new Set();
  let blocked = opt.blocked || new Set();

  const g = new Uint8Array(N);      // Brett an der Wurzel
  let rootKo = -1, rootPasses = 0, root = null, realN = N;
  const b = new Uint8Array(N);
  const tmpB = new Uint8Array(N);
  const moves = new Int16Array(N);
  const amaf = new Uint8Array(N);
  const koOut = [-1];
  let done = 0;                     // Playouts seit reset/advance
  const path = [];

  const legalAtRoot = (i) => {
    // Schwarz an der Wurzel: echte Wiederholung, Sperrliste, eigene Augen.
    if (g[i] !== E || blocked.has(i)) return false;
    if (isEye(geo, g, i, B)) return false;
    tmpB.set(g);
    if (play(geo, tmpB, i, B, rootKo, koOut, noSAtree) < 0) return false;
    if (keyOf && history.has(keyOf(tmpB))) return false;
    return true;
  };

  const expand = (node, bb, ko) => {
    node.children = [];
    const c = node.toMove;
    if (node === root && c === B) {
      for (let i = 0; i < N; i++) if (legalAtRoot(i)) node.children.push(new Node(i, 3 - c));
    } else {
      for (let i = 0; i < N; i++) {
        if (bb[i] !== E || i === ko || isEye(geo, bb, i, c)) continue;
        tmpB.set(bb);
        if (play(geo, tmpB, i, c, ko, koOut, noSAtree) >= 0) node.children.push(new Node(i, 3 - c));
      }
    }
    node.children.push(new Node(-1, 3 - c));          // Pass
  };

  /** Kinder einer uebernommenen Schwarz-Wurzel nachtraeglich filtern. */
  const filterRoot = () => {
    if (!root || !root.children || root.toMove !== B) return;
    root.children = root.children.filter((ch) => ch.move < 0 || legalAtRoot(ch.move));
  };

  const reset = (g0, toMove, passes = 0) => {
    g.set(g0);
    rootKo = -1; rootPasses = passes;
    root = new Node(-2, toMove);
    realN = 0; for (let i = 0; i < N; i++) if (g[i] !== X) realN++;
    done = 0;
  };

  /** Historie und Sperrliste aktualisieren (vor der eigenen Suche). */
  const setContext = (o) => {
    if (o.history) history = o.history;
    if (o.blocked) blocked = o.blocked;
    filterRoot();
  };

  /**
   * Wurzel um einen Zug weiterziehen (move = Punkt oder -1 fuer Pass).
   * Gibt false zurueck, wenn der Zug auf dem Wurzelbrett illegal ist - dann
   * muss der Aufrufer reset() rufen.
   */
  const advance = (move) => {
    const c = root.toMove;
    const child = root.children ? root.children.find((ch) => ch.move === move) : null;
    if (move < 0) { rootPasses++; rootKo = -1; }
    else {
      if (play(geo, g, move, c, rootKo, koOut) < 0) return false;
      rootKo = koOut[0]; rootPasses = 0;
    }
    root = child || new Node(move, 3 - c);
    filterRoot();
    done = 0;
    return true;
  };

  // Nicht "run" nennen: der RAM-Rechner des Spiels zaehlt den Bezeichner als ns.run (1 GB).
  const simulate = (deadline, maxPlayouts) => {
    while (done < maxPlayouts && (done % 32 !== 0 || Date.now() < deadline)) {
      done++;
      b.set(g);
      let node = root, ko = rootKo, passes = rootPasses;
      path.length = 0; path.push(node);
      amaf.fill(0);
      let terminal = passes >= 2;
      // Auswahl
      while (!terminal && node.children && node.children.length) {
        let best = null, bestV = -Infinity;
        const lnN = Math.log(node.visits + 1);
        for (const ch of node.children) {
          let v;
          if (ch.visits === 0) v = 1e9 + rnd();
          else {
            const q = ch.wins / ch.visits;
            if (useRave && ch.raveV > 0) {
              const beta = Math.sqrt(RAVE_K / (3 * node.visits + RAVE_K));
              v = (1 - beta) * q + beta * (ch.raveW / ch.raveV) + C * Math.sqrt(lnN / ch.visits);
            } else v = q + C * Math.sqrt(lnN / ch.visits);
          }
          if (v > bestV) { bestV = v; best = ch; }
        }
        const c = node.toMove;
        if (best.move < 0) { passes++; ko = -1; }
        else {
          play(geo, b, best.move, c, ko, koOut); ko = koOut[0]; passes = 0;
          if (amaf[best.move] === 0) amaf[best.move] = c;
        }
        node = best; path.push(node);
        if (passes >= 2) terminal = true;
      }
      // Erweitern
      if (!terminal && !node.children && (node.visits > 0 || node === root)) {
        expand(node, b, ko);
        const ch = node.children[Math.floor(rnd() * node.children.length)];
        const c = node.toMove;
        if (ch.move < 0) { passes++; ko = -1; }
        else { play(geo, b, ch.move, c, ko, koOut); ko = koOut[0]; passes = 0; if (amaf[ch.move] === 0) amaf[ch.move] = c; }
        node = ch; path.push(node);
        if (passes >= 2) terminal = true;
      }
      // Simulation
      const sc = terminal ? areaScore(geo, b)
        : rollout(geo, b, node.toMove, ko, rnd, moves, useRave ? amaf : null, !!opt.oppModel, noSA, passes);
      const blackWins = (1 - scoreW) * (sc[0] > sc[1] + komi ? 1 : 0) + scoreW * (sc[0] / realN);
      // Rueckpropagation
      for (let k = 0; k < path.length; k++) {
        const nd = path[k];
        nd.visits++;
        const mover = 3 - nd.toMove;
        nd.wins += mover === B ? blackWins : 1 - blackWins;
        if (useRave && nd.children) {
          for (const ch of nd.children) {
            if (ch.move >= 0 && amaf[ch.move] === nd.toMove) {
              ch.raveV++;
              ch.raveW += nd.toMove === B ? blackWins : 1 - blackWins;
            }
          }
        }
      }
    }
  };

  const fertig = (deadline, cap) => done >= cap || Date.now() >= deadline;

  /**
   * Sucht, bis die Wurzel targetVisits Besuche hat UND mindestens minNew neue
   * Playouts gelaufen sind - oder die Frist ablaeuft. Gibt die neuen zurueck.
   */
  const runUntil = (deadline, targetVisits, minNew) => {
    const start = done;
    const need = Math.max(minNew, targetVisits - root.visits);
    simulate(deadline, start + Math.max(0, need));
    return done - start;
  };

  /** Bester Zug an der Wurzel (meiste Besuche). Nur sinnvoll, wenn Schwarz am Zug ist. */
  const result = () => {
    if (!root.children || root.children.length === 0) {
      return { type: "pass", winrate: 0, playouts: done, visits: root.visits };
    }
    let best = root.children[0];
    for (const ch of root.children) if (ch.visits > best.visits) best = ch;
    const wr = best.visits ? best.wins / best.visits : 0;
    if (best.move < 0) return { type: "pass", winrate: wr, playouts: done, visits: root.visits };
    return { type: "move", i: best.move, winrate: wr, playouts: done, visits: root.visits };
  };

  return {
    reset, advance, setContext, simulate, runUntil, fertig, result,
    rootVisits: () => (root ? root.visits : 0),
    boardAtRoot: () => g,
    toMove: () => (root ? root.toMove : 0),
    rootPasses: () => rootPasses,
  };
}

/** Einmalige Suche fuer Schwarz (ohne Baumuebernahme). */
export function mctsMove(g0, n, opt = {}) {
  const s = createSearcher(n, opt);
  s.reset(g0, B, opt.oppPassed ? 1 : 0);
  s.simulate(opt.ms ? Date.now() + opt.ms : Infinity, opt.playouts ?? 4000);
  return s.result();
}

export const _intern = { geomOf, chainLibs, play, areaScore, isEye, Node };
