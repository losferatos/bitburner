/**
 * IPvGO-Spieler (Befund B8, Roadmap-Pruefung 10/2026).
 *
 * WAS ES TUT
 *
 * Spielt in einer Endlosschleife 7x7-Partien gegen die Fraktion "Tetrads".
 * Jede beendete Partie erhoeht die "Node Power" dieser Fraktion; daraus macht
 * das Spiel einen Multiplikator auf Staerke, Abwehr, Geschick und Gewandtheit
 * (Go/effects/effect.ts:84-88 calculateMults: strength, defense, dexterity,
 * agility je mal `effect`). Kampfwerte sind der Engpass des Bladeburner-Bots.
 *
 * WARUM NUR BN14 UND BN13 (GO_NODES)
 *
 * Der Bonus ist 1 + ln(n+1) * (n+1)^0.3 * 0.002 * 0.7 * GoPower * SF14
 * (effect.ts:16-22; 0.7 = bonusPower der Tetrads, Constants.ts). GoPower ist
 * nur in BitNode 14 gesetzt (4, BitNode.tsx:1042), sonst 1; SF14 verdoppelt
 * den Bonus in JEDEM Knoten. Gerechnet (n = Node Power):
 *
 *            n=500   n=2000   n=5000
 *   BN14.1   +22 %   +42 %    +61 %     (GoPower 4, kein SF14)
 *   BN14.2+  +45 %   +83 %    +123 %    (mit SF14.1: x2)
 *   BN13+SF14 +11 %  +21 %    +31 %     (GoPower 1, SF14 x2 - Reihenfolge
 *                                        BN14 vor BN13 laut Route)
 *
 * Ohne SF14 und ausserhalb BN14 waeren es nur 5 % bei n=500: das lohnt weder
 * den RAM noch den Platz auf der Werkbank. Deshalb [14, 13] und sonst sofort
 * Ende.
 *
 * ACHTUNG: Die Node Power wird bei JEDEM Augmentierungs-Einbau auf 0 gesetzt
 * (Go.ts prestigeAugmentation: nodePower = 0). Der Bonus muss nach jedem
 * Einbau neu aufgebaut werden - dieses Gewerk laeuft deshalb dauerhaft. Eine
 * gewonnene 7x7-Partie bringt rund 30 Punkte * 1,5 * Siegesserie (1..3) =
 * 45..135 Node Power, n=500 sind also etwa 5-10 Partien.
 *
 * WARUM 7x7 (BOARD_SIZE)
 *
 * Node Power je Partie = Punktzahl des Spielers * Schwierigkeit * Serie
 * (scoring.ts endGoGame). Schwierigkeit = (komi+0.5)*0.25 = 1,5 fuer Tetrads
 * und UNABHAENGIG von der Brettgroesse (effect.ts getDifficultyMultiplier;
 * nur Illuminati auf 5x5 hat einen Sonderfaktor). Die Punktzahl waechst mit
 * N^2, die Dauer ebenfalls: Der Gegner wartet je Zug mehrere waitCycles zu
 * 200 ms (goAI.ts waitCycle, 40 ms mit Offline-Zyklen), und es werden etwa
 * N^2/2 Zuege je Seite gespielt. Node Power je Sekunde ist damit nahezu
 * groessenunabhaengig; was bleibt, sind die Unterschiede, die gegen grosse
 * Bretter sprechen:
 *   - Die Siegesserie (x1 bis x3, Bruch einer Niederlagenserie bis x5) haengt
 *     an Siegen. Die Heuristik hier ist 2 Zuege tief; auf 7x7 ist sie dem
 *     Gegner deutlich ueberlegen, auf 13x13 nicht mehr.
 *   - Rechenzeit der Heuristik waechst etwa mit N^4.
 *   - 5x5 scheidet aus: Komi 5,5 bei nur 25 Punkten (Schwarz braucht 16).
 * Ein Brett pro Partie ist daher 7x7. Dass es ein Optimum ist, ist NICHT
 * gemessen, nur aus dem Quellcode begruendet.
 *
 * WAS OHNE SF14 GEHT (BN14.1)
 *
 * Nur die Cheat-Funktionen (go.cheat.*) pruefen SF14 (checkCheatApiAccess,
 * netscriptGoImplementation.ts). Alles, was hier benutzt wird, laeuft ohne:
 * makeMove 4 GB, getBoardState 4 GB, der Rest (passTurn, getGameState,
 * getMoveHistory, getCurrentPlayer, getOpponent, opponentNextTurn,
 * resetBoardState, analysis.getStats) 0 GB. Die Analysefunktionen
 * (getValidMoves 8, getChains/getLiberties/getControlledEmptyNodes je 16 GB)
 * werden NICHT benutzt - Ketten, Freiheiten, Zugpruefung und Gebiet sind hier
 * in reinem JS nachgebaut. Das spart 40 GB RAM.
 *
 * ZUGWAHL (chooseMove, rein und ohne ns testbar)
 *
 *   1. Alle legalen Zuege simulieren (Schlagen, Selbstmord, Ko ueber die
 *      Brettverlaeufe von getMoveHistory).
 *   2. Verboten: eigene Augen fuellen, Selbst-Atari ohne Schlag.
 *   3. Bewertung = Flaechenwertung wie im Spiel (Steine + umschlossene leere
 *      Gebiete) + 0,2 * Einflussdifferenz (Voronoi ueber leere Punkte) +
 *      Abzuege/Zuschlaege fuer Ketten mit 1 oder 2 Freiheiten.
 *   4. Die besten K Zuege werden 2 Halbzuege tief geprueft: der Gegner
 *      antwortet mit seinem besten Zug (oder passt); es zaehlt der schlechteste
 *      Ausgang. Das faengt Zuege, die eine eigene Kette ins Atari stellen oder
 *      einen Schlag uebersehen.
 *   5. Gespielt wird nur, was gegenueber Passen gewinnt (PASS_EPS). Auch bei
 *      Fuehrung wird weitergespielt, solange das Punkte bringt (nodePower
 *      haengt an der eigenen Punktzahl); gepasst wird erst, wenn nichts
 *      mehr besser ist als Passen.
 *
 * ZEIT
 *
 * Die Uhr der Partie ist die des Spiels (setTimeout im Spiel). In einem
 * verdeckten Browsertab werden diese Zeitgeber auf 1 je Minute gedrosselt;
 * der Tonanker wakelock.js haelt das offen. Ohne ihn dauert eine Partie
 * Stunden statt Minuten - das ist kein Fehler dieses Skripts.
 *
 * ANLAUF UND ABBRUCH
 *
 * Eine laufende Partie gegen Tetrads auf dem richtigen Brett wird
 * FORTGESETZT (Neustart nach Kill oder Einbau). Nur Spielende, andere Gegner
 * oder andere Groesse starten neu - resetBoardState mitten in einer Partie
 * zaehlt als Niederlage (netscriptGoImplementation.ts resetBoardState).
 *
 * @param {NS} ns
 */

/** Knoten, in denen der Bonus den Platz lohnt (Begruendung oben). */
export const GO_NODES = [14, 13];
/**
 * Lohnt IPvGO hier? BN14 immer (GoPower 4); BN13 nur mit SF14 (sonst GoPower 1
 * ohne Verdopplung, rund 5 % bei n=500: lohnt den RAM nicht).
 */
export function goLohnt(node, sf14) {
  if (!GO_NODES.includes(node)) return false;
  if (node === 14) return true;
  return sf14 > 0;
}
const TELEMETRY_MS = 30000;
/** Gegner und Brett (Begruendung oben). */
export const OPPONENT = "Tetrads";
export const BOARD_SIZE = 7;

/** Wie viele Kandidaten die Tiefenpruefung bekommen. */
const TOP_K = 49;
/** So viel besser als Passen muss ein Zug sein (Flaecheneinheiten). */
const PASS_EPS = 0.8;
/** Gewicht des Einflusses (Voronoi) in der Bewertung. */
const INFLUENCE_W = 0.2;
/** Harte Obergrenze an Schleifendurchlaeufen je Partie, gegen Endlosspiel. */
const MAX_TURNS = 6 * BOARD_SIZE * BOARD_SIZE;
const TELEMETRY_FILE = "data/go.json";

// Punktfarben. W = offline (kein Punkt des Bretts).
const E = 0, M = 1, O = 2, W = 3;

const adjCache = new Map();
/** Nachbarlisten je Brettgroesse (nur innerhalb des Bretts). */
function adjacency(n) {
  let a = adjCache.get(n);
  if (a) return a;
  a = [];
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      const l = [];
      if (x > 0) l.push((x - 1) * n + y);
      if (x < n - 1) l.push((x + 1) * n + y);
      if (y > 0) l.push(x * n + y - 1);
      if (y < n - 1) l.push(x * n + y + 1);
      a.push(l);
    }
  }
  adjCache.set(n, a);
  return a;
}

/** SimpleBoard (Spalten als Strings, rows[x][y]) -> flaches Feld. */
export function parseBoard(rows) {
  const n = rows.length;
  const g = new Uint8Array(n * n);
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      const c = rows[x][y];
      g[x * n + y] = c === "X" ? M : c === "O" ? O : c === "#" ? W : E;
    }
  }
  return { n, g };
}

const CH = [".", "X", "O", "#"];
const boardKey = (g) => {
  let s = "";
  for (let i = 0; i < g.length; i++) s += CH[g[i]];
  return s;
};

/** Kette ab Punkt `s`: Steine und Zahl der verschiedenen Freiheiten. */
function flood(g, adj, s) {
  const c = g[s];
  const stones = [s];
  const seen = new Set([s]);
  const libs = new Set();
  for (let k = 0; k < stones.length; k++) {
    for (const j of adj[stones[k]]) {
      if (g[j] === c) {
        if (!seen.has(j)) { seen.add(j); stones.push(j); }
      } else if (g[j] === E) libs.add(j);
    }
  }
  return { stones, libs: libs.size };
}

/**
 * Stein setzen: null bei Selbstmord/belegt, sonst neues Feld und Schlagzahl.
 * Gleiche Regeln wie das Spiel (Schlagen zuerst, danach Selbstmordpruefung).
 */
function place(g, adj, i, color) {
  if (g[i] !== E) return null;
  const h = g.slice();
  h[i] = color;
  const enemy = color === M ? O : M;
  let captured = 0;
  for (const j of adj[i]) {
    if (h[j] === enemy) {
      const c = flood(h, adj, j);
      if (c.libs === 0) {
        for (const s of c.stones) h[s] = E;
        captured += c.stones.length;
      }
    }
  }
  const own = flood(h, adj, i);
  if (own.libs === 0) return null;
  return { h, captured, ownLibs: own.libs, ownSize: own.stones.length };
}

/** Flaechenwertung wie scoring.ts: Steine + einfarbig umschlossene Leerraeume. */
function areaScore(g, adj, n) {
  let me = 0, opp = 0;
  const seen = new Uint8Array(g.length);
  for (let i = 0; i < g.length; i++) {
    if (g[i] === M) me++;
    else if (g[i] === O) opp++;
    else if (g[i] === E && !seen[i]) {
      const reg = [i];
      seen[i] = 1;
      let hasM = false, hasO = false;
      for (let k = 0; k < reg.length; k++) {
        for (const j of adj[reg[k]]) {
          if (g[j] === E) { if (!seen[j]) { seen[j] = 1; reg.push(j); } }
          else if (g[j] === M) hasM = true;
          else if (g[j] === O) hasO = true;
        }
      }
      // Wie im Spiel: ein fast leeres Brett zaehlt als niemandes Gebiet.
      if (reg.length > n * n - 3) continue;
      if (hasM && !hasO) me += reg.length;
      else if (hasO && !hasM) opp += reg.length;
    }
  }
  return { me, opp };
}

/** Voronoi ueber leere Punkte: (naeher an mir) - (naeher am Gegner). */
function influence(g, adj) {
  const owner = new Uint8Array(g.length);
  let front = [];
  for (let i = 0; i < g.length; i++) {
    if (g[i] === M || g[i] === O) { owner[i] = g[i]; front.push(i); }
  }
  let diff = 0;
  while (front.length) {
    const cand = new Map();
    for (const i of front) {
      for (const j of adj[i]) {
        if (g[j] === E && !owner[j]) cand.set(j, (cand.get(j) || 0) | owner[i]);
      }
    }
    const next = [];
    for (const [j, mask] of cand) {
      if (mask === M) { owner[j] = M; diff++; next.push(j); }
      else if (mask === O) { owner[j] = O; diff--; next.push(j); }
      else owner[j] = W;                     // gleich weit: niemandes, breitet sich nicht aus
    }
    front = next;
  }
  return diff;
}

/**
 * Stellungswert aus Sicht des Spielers (Schwarz/X). `toMove` sagt, wer am Zug
 * ist: Ketten im Atari des Ziehenden sind weniger verloren als die des anderen.
 */
function evalPos(g, adj, n, toMove) {
  const a = areaScore(g, adj, n);
  let v = (a.me - a.opp) + INFLUENCE_W * influence(g, adj);
  const done = new Uint8Array(g.length);
  for (let i = 0; i < g.length; i++) {
    if ((g[i] !== M && g[i] !== O) || done[i]) continue;
    const c = flood(g, adj, i);
    for (const s of c.stones) done[s] = 1;
    const size = c.stones.length;
    const mine = g[i] === M;
    if (c.libs === 1) {
      if (mine) v -= (toMove === M ? 0.8 : 2.0) * size;
      else v += (toMove === M ? 2.0 : 0.8) * size;
    } else if (c.libs === 2) {
      v += (mine ? -0.15 : 0.15) * size;
    }
  }
  return v;
}

/**
 * Wert nach einem Gegnerzug (oder Pass): der schlechteste Ausgang fuer uns.
 * `banned` sind Brettschluessel, die der Gegner nicht herstellen darf (Ko:
 * das Brett vor unserem Zug und fruehere). Ohne das gaelte jeder Ko-Schlag
 * als sofort zurueckgenommen und waere wertlos.
 */
function replyValue(g, adj, n, banned) {
  let worst = evalPos(g, adj, n, M);        // Gegner passt
  for (let j = 0; j < g.length; j++) {
    if (g[j] !== E) continue;
    const r = place(g, adj, j, O);
    if (!r) continue;
    if (banned && banned.has(boardKey(r.h))) continue;
    const v = evalPos(r.h, adj, n, M);
    if (v < worst) worst = v;
  }
  return worst;
}

/** Echtes Auge: leerer Punkt, nur eigene Nachbarn, Diagonalen eigen. */
function isOwnEye(g, adj, n, i) {
  const x = Math.floor(i / n), y = i % n;
  let nb = 0, wall = false;
  for (const j of adj[i]) {
    if (g[j] === W) { wall = true; continue; }
    if (g[j] !== M) return false;
    nb++;
  }
  if (nb === 0) return false;
  let diag = 0, bad = 0;
  for (const dx of [-1, 1]) {
    for (const dy of [-1, 1]) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue;
      const c = g[xx * n + yy];
      if (c === W) continue;
      diag++;
      if (c !== M) bad++;
    }
  }
  const edge = wall || adj[i].length < 4 || diag < 4;
  return edge ? bad === 0 : bad <= 1;
}

/** Kleiner Lageanreiz: Mitte vor Rand. */
function posBonus(n, i) {
  const x = Math.floor(i / n), y = i % n;
  const c = (n - 1) / 2;
  const d = Math.max(Math.abs(x - c), Math.abs(y - c));
  return 0.25 * (c - d);
}

/**
 * Waehlt den naechsten Zug. Rein: kein ns, keine Zeit.
 *
 * @param {string[]} rows SimpleBoard aus ns.go.getBoardState()
 * @param {object} [opt]
 * @param {string[]} [opt.history] fruehere Bretter als rows.join("")
 * @param {boolean} [opt.oppPassed] hat der Gegner zuletzt gepasst?
 * @param {boolean|null} [opt.ahead] fuehrt der Spieler laut Spiel (inkl. Komi)?
 * @param {Set<number>} [opt.blocked] Punkte, die das Spiel schon abgelehnt hat
 * @param {number} [opt.moveCount]
 * @returns {{type:"move",x:number,y:number,gain:number}|{type:"pass"}}
 */
export function chooseMove(rows, opt = {}) {
  const { n, g } = parseBoard(rows);
  const adj = adjacency(n);
  const hist = new Set(opt.history || []);
  const blocked = opt.blocked || new Set();

  // KEIN fruehes Passen bei Fuehrung: nodePower haengt an der eigenen
  // Punktzahl (scoring.ts endGoGame), also wird weiter eingesammelt, solange
  // ein Zug besser ist als Passen. Hat der Gegner gepasst, endet die Partie,
  // sobald wir auch passen - und das tun wir erst, wenn nichts mehr bringt.

  const cands = [];
  for (let i = 0; i < g.length; i++) {
    if (g[i] !== E || blocked.has(i)) continue;
    const r = place(g, adj, i, M);
    if (!r) continue;
    if (hist.has(boardKey(r.h))) continue;            // Ko / Wiederholung
    if (r.captured === 0) {
      if (r.ownLibs <= 1) continue;                    // Selbst-Atari
      if (isOwnEye(g, adj, n, i)) continue;            // eigenes Auge
    }
    cands.push({ i, h: r.h, v1: evalPos(r.h, adj, n, O) + posBonus(n, i) });
  }
  if (cands.length === 0) return { type: "pass" };
  cands.sort((a, b) => b.v1 - a.v1 || a.i - b.i);

  const banned = new Set(hist);
  banned.add(boardKey(g));
  const passValue = replyValue(g, adj, n, hist);
  let best = null;
  const scored = [];
  for (const c of cands.slice(0, TOP_K)) {
    const val = replyValue(c.h, adj, n, banned);
    const score = val + posBonus(n, c.i);
    scored.push({ x: Math.floor(c.i / n), y: c.i % n, v1: c.v1, val, score });
    if (!best || score > best.score) best = { i: c.i, val, score };
  }
  const gain = best.val - passValue;
  if (opt.debug) {
    return { type: gain <= PASS_EPS ? "pass" : "move", x: Math.floor(best.i / n), y: best.i % n, gain, passValue, scored };
  }
  if (gain <= PASS_EPS) return { type: "pass" };
  return { type: "move", x: Math.floor(best.i / n), y: best.i % n, gain };
}

/** Innenleben fuer Tests und Fehlersuche (kein Teil der Spiel-Schnittstelle). */
export const _intern = { place, evalPos, adjacency, boardKey, areaScore, influence };

export async function main(ns) {
  ns.disableLog("ALL");
  let node = 0;
  try { node = ns.getResetInfo().currentNode; } catch { node = 0; }
  // SF14 (ownedSF ist eine Map) wird mit demselben getResetInfo gelesen.
  let sf14 = 0;
  try {
    const o = ns.getResetInfo().ownedSF;
    sf14 = (o && typeof o.get === "function" ? o.get(14) : o && o[14]) || 0;
  } catch { sf14 = 0; }
  if (!goLohnt(node, sf14)) {
    ns.print("BitNode " + node + " (SF14 " + sf14 + "): IPvGO lohnt hier nicht - beende mich.");
    return;
  }

  let games = 0, won = 0, lost = 0, lastTelemetry = 0;

  const telemetry = (extra) => {
    let st = null;
    try { st = ns.go.analysis.getStats()[OPPONENT] || null; } catch { st = null; }
    const o = {
      zeit: Date.now(), knoten: node, state: "work", opponent: OPPONENT, size: BOARD_SIZE,
      games, won, lost,
      bonusPercent: st ? st.bonusPercent : null,
      winStreak: st ? st.winStreak : null,
      ...(extra || {}),
    };
    lastTelemetry = Date.now();
    // Die Telemetrie muss auf home liegen; das Gewerk laeuft auf der Werkbank.
    // Eigenes write+scp statt lib/hostdatei.js: das Modul zieht fileExists
    // (0,1 GB) mit, das hier sonst nirgends gebraucht wird.
    ns.write(TELEMETRY_FILE, JSON.stringify(o), "w");
    if (ns.getHostname() !== "home") { try { ns.scp(TELEMETRY_FILE, "home", ns.getHostname()); } catch { /* egal */ } }
  };

  /** Ein Zug (oder Pass); gibt die Antwort des Gegners zurueck. */
  const takeTurn = async (oppPassed, turn) => {
    const rows = ns.go.getBoardState();
    const history = ns.go.getMoveHistory().map((b) => b.join(""));
    const blocked = new Set();
    for (let tries = 0; tries < 6; tries++) {
      const d = turn > MAX_TURNS
        ? { type: "pass" }
        : chooseMove(rows, { history, oppPassed, blocked });
      if (d.type === "pass") return { play: await ns.go.passTurn(), passed: true };
      try {
        return { play: await ns.go.makeMove(d.x, d.y), passed: false };
      } catch (e) {
        // Das Spiel lehnt den Zug ab (Ko-Regel o. ae., die der Nachbau nicht
        // kennt): Punkt sperren und neu waehlen.
        blocked.add(d.x * rows.length + d.y);
        ns.print("Zug " + d.x + "," + d.y + " abgelehnt: " + String(e).slice(0, 80));
      }
    }
    return { play: await ns.go.passTurn(), passed: true };
  };

  const playGame = async () => {
    let cur = ns.go.getCurrentPlayer();
    const size = ns.go.getBoardState().length;
    if (cur === "None" || ns.go.getOpponent() !== OPPONENT || size !== BOARD_SIZE) {
      ns.go.resetBoardState(OPPONENT, BOARD_SIZE);
    }
    let oppPassed = false;
    for (let turn = 0; turn < MAX_TURNS + 20; turn++) {
      cur = ns.go.getCurrentPlayer();
      if (cur === "None") break;
      if (cur === "White") { await ns.go.opponentNextTurn(false); continue; }
      const r = await takeTurn(oppPassed, turn);
      if (r.play.type === "gameOver") break;
      oppPassed = r.play.type === "pass";
      // Zeitbedingung statt Zugzahl: im gedrosselten Tab dauert ein Zug
      // Minuten, die Frist des Waechters laeuft in Wanduhr.
      if (Date.now() - lastTelemetry > TELEMETRY_MS) telemetry();
    }
    if (ns.go.getCurrentPlayer() !== "None") {
      // Das Spiel endet nicht: wirklich neu anfangen. Das Spiel selbst bucht
      // das als Niederlage (resetBoardState mitten in der Partie); in den
      // eigenen Zaehlern steht es NICHT - lost sind nur beendete Partien.
      ns.print("Partie endet nicht - neu gestartet.");
      ns.go.resetBoardState(OPPONENT, BOARD_SIZE);
      return;
    }
    const gs = ns.go.getGameState();
    games++;
    if (gs.blackScore > gs.whiteScore) won++; else lost++;
  };

  telemetry();
  while (true) {
    try {
      await playGame();
      telemetry();
    } catch (e) {
      ns.print("Fehler in der Partie: " + String(e));
    }
    await ns.sleep(200);
  }
}
