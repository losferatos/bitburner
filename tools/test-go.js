/**
 * Ebene 2: go.js (IPvGO-Spieler, Befund B8, 07.10.2026).
 *
 * Geprueft wird die Spiellogik gegen einen kleinen ns.go-Mock mit eigener,
 * UNABHAENGIG vom Prueflinge geschriebener Regelengine (Schlagen, Selbstmord,
 * Ko, Flaechenwertung mit Komi 5,5 wie scoring.ts) und einem einfachen
 * Tetrads-Ersatz (schlaegt, rettet Atari, sonst Zufall, fuellt kein eigenes
 * Auge, passt ohne Zug). Das ist NICHT die echte Fraktions-KI - die Siegquote
 * hier belegt "deutlich besser als Zufall", nicht eine Quote gegen Tetrads.
 *
 * Faelle:
 *   1. Schlagen moeglich -> Schlag
 *   2. Eigene Kette im Atari -> gerettet
 *   3. Kein sinnvoller Zug (nur eigene Augen) -> Pass
 *   4. Gegner hat gepasst und wir fuehren -> Pass
 *   5. Ko-Wiederholung wird nicht gespielt
 *   6. falscher Knoten -> Ende, ohne ns.go zu beruehren
 *   7. ganze Partien gegen den Ersatzgegner: Siegquote, Partien enden,
 *      kein abgelehnter Zug, Telemetrie
 *   8. laufende Partie wird fortgesetzt (kein resetBoardState), fremder
 *      Gegner/andere Groesse wird neu gestartet
 *
 * Aufruf: node tools/test-go.js
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { ladeAusBeiden } from "./mock/lader.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

let gruen = 0;
let rot = 0;
const fehler = [];
function pruefe(was, bedingung, zusatz = "") {
  if (bedingung) {
    gruen++;
    console.log("  ok    " + was + (zusatz ? "  (" + zusatz + ")" : ""));
  } else {
    rot++;
    fehler.push(was + (zusatz ? " - " + zusatz : ""));
    console.log("  ROT   " + was + (zusatz ? " - " + zusatz : ""));
  }
}

const { modul } = await ladeAusBeiden(ROOT, "go.js");

// ---------------------------------------------------------------------------
// Regelengine des Mocks (unabhaengig von go.js)
// ---------------------------------------------------------------------------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const nbr = (b, x, y) => {
  const n = b.length, r = [];
  if (x > 0) r.push([x - 1, y]);
  if (x < n - 1) r.push([x + 1, y]);
  if (y > 0) r.push([x, y - 1]);
  if (y < n - 1) r.push([x, y + 1]);
  return r.filter(([a, c]) => b[a][c] !== "#");
};
function gruppe(b, x, y) {
  const farbe = b[x][y];
  const seen = new Set([x + "," + y]);
  const st = [[x, y]];
  const libs = new Set();
  for (let k = 0; k < st.length; k++) {
    for (const [a, c] of nbr(b, st[k][0], st[k][1])) {
      if (b[a][c] === farbe) { if (!seen.has(a + "," + c)) { seen.add(a + "," + c); st.push([a, c]); } }
      else if (b[a][c] === ".") libs.add(a + "," + c);
    }
  }
  return { st, libs: libs.size };
}
/** Setzt; null bei Selbstmord. Gibt {b, schlag} zurueck. */
function setze(b, x, y, f) {
  if (b[x][y] !== ".") return null;
  const c = b.map((r) => r.split(""));
  c[x][y] = f;
  const feind = f === "X" ? "O" : "X";
  let schlag = 0;
  const joined = () => c.map((r) => r.join(""));
  for (const [a, d] of nbr(c, x, y)) {
    if (c[a][d] === feind) {
      const g = gruppe(c, a, d);
      if (g.libs === 0) { for (const [p, q] of g.st) c[p][q] = "."; schlag += g.st.length; }
    }
  }
  if (gruppe(c, x, y).libs === 0) return null;
  return { b: joined(), schlag };
}
function wertung(b, komi) {
  const n = b.length;
  let x = 0, o = 0;
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (b[i][j] === "X") x++;
      else if (b[i][j] === "O") o++;
      else if (b[i][j] === "." && !seen.has(i + "," + j)) {
        const reg = [[i, j]];
        seen.add(i + "," + j);
        let hx = false, ho = false;
        for (let k = 0; k < reg.length; k++) {
          for (const [a, c] of nbr(b, reg[k][0], reg[k][1])) {
            if (b[a][c] === ".") { if (!seen.has(a + "," + c)) { seen.add(a + "," + c); reg.push([a, c]); } }
            else if (b[a][c] === "X") hx = true; else ho = true;
          }
        }
        if (reg.length > n * n - 3) continue;
        if (hx && !ho) x += reg.length; else if (ho && !hx) o += reg.length;
      }
    }
  }
  return { black: x, white: o + komi };
}
const eigenesAuge = (b, x, y, f) => nbr(b, x, y).every(([a, c]) => b[a][c] === f);

/** Ersatzgegner (weiss). Gibt {x,y} oder null (Pass). */
function gegnerZug(sp, r) {
  const b = sp.b, n = b.length;
  const alle = [];
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
    if (b[x][y] !== ".") continue;
    const s = setze(b, x, y, "O");
    if (!s) continue;
    if (sp.hist.includes(s.b.join("")) ) continue;
    alle.push({ x, y, s });
  }
  if (!alle.length) return null;
  const schlaeger = alle.filter((m) => m.s.schlag > 0).sort((p, q) => q.s.schlag - p.s.schlag);
  if (schlaeger.length) return schlaeger[0];
  // eigene Kette im Atari retten
  const rettung = alle.filter((m) => {
    const g = gruppe(m.s.b.map((s) => s.split("")), m.x, m.y);
    return nbr(b, m.x, m.y).some(([a, c]) => b[a][c] === "O" && gruppe(b.map((s) => s.split("")), a, c).libs === 1) && g.libs >= 2;
  });
  if (rettung.length) return rettung[Math.floor(r() * rettung.length)];
  const frei = alle.filter((m) => !eigenesAuge(b, m.x, m.y, "O"));
  if (!frei.length) return null;
  return frei[Math.floor(r() * frei.length)];
}

function neuesSpiel(n, gegner, seed, offline = []) {
  const b = Array.from({ length: n }, () => ".".repeat(n));
  for (const [x, y] of offline) b[x] = b[x].slice(0, y) + "#" + b[x].slice(y + 1);
  return { b, n, gegner, hist: [], vorher: "O", passes: 0, r: rng(seed), komi: 5.5, ende: false };
}

/**
 * ns-Mock mit go-Teil. opts: spiel (Startspiel), knoten, maxPartien, seed
 */
function neuerGoMock(opts = {}) {
  const z = {
    spiel: opts.spiel || neuesSpiel(7, "none", 1),
    resets: [],
    zuege: 0, abgelehnt: 0, passes: 0, partien: 0, siege: 0,
    goAufrufe: 0,
    dateien: {},
    sleeps: 0,
    letzteStats: {},
  };
  const seedBase = opts.seed ?? 100;
  const gesperrt = new Error("Mock-Abbruch");
  gesperrt.mockAbbruch = true;

  const ende = () => {
    const sp = z.spiel;
    sp.ende = true;
    sp.vorher = null;
    z.partien++;
    const w = wertung(sp.b, sp.komi);
    if (w.black > w.white) z.siege++;
    const st = z.letzteStats[sp.gegner] || (z.letzteStats[sp.gegner] = { wins: 0, losses: 0, winStreak: 0 });
    if (w.black > w.white) { st.wins++; st.winStreak = Math.max(1, st.winStreak + 1); }
    else { st.losses++; st.winStreak = Math.min(-1, st.winStreak - 1); }
  };
  const gegnerAmZug = () => {
    const sp = z.spiel;
    if (sp.ende || sp.vorher !== "X") return { type: sp.ende ? "gameOver" : "move", x: null, y: null };
    const m = gegnerZug(sp, sp.r);
    if (!m) {
      sp.vorher = "O";
      sp.passes++;
      if (sp.passes >= 2) { ende(); return { type: "gameOver", x: null, y: null }; }
      return { type: "pass", x: null, y: null };
    }
    sp.hist.push(sp.b.join(""));
    sp.b = m.s.b;
    sp.vorher = "O";
    sp.passes = 0;
    return { type: "move", x: m.x, y: m.y };
  };

  const go = {
    getBoardState: () => { z.goAufrufe++; return z.spiel.b.slice(); },
    getMoveHistory: () => z.spiel.hist.map((s) => {
      const n = z.spiel.n; const out = [];
      for (let i = 0; i < n; i++) out.push(s.slice(i * n, (i + 1) * n));
      return out;
    }),
    getCurrentPlayer: () => z.spiel.ende ? "None" : (z.spiel.vorher === "O" ? "Black" : "White"),
    getOpponent: () => z.spiel.gegner,
    getGameState: () => {
      const w = wertung(z.spiel.b, z.spiel.komi);
      return { currentPlayer: go.getCurrentPlayer(), blackScore: w.black, whiteScore: w.white, komi: 5.5 };
    },
    resetBoardState: (gegner, n) => {
      z.resets.push({ gegner, n, mitten: !z.spiel.ende && z.spiel.hist.length > 0 });
      if (z.resets.length > (opts.maxPartien ?? 12)) throw gesperrt;
      z.spiel = neuesSpiel(n, gegner, seedBase + z.resets.length, opts.offline || []);
      return z.spiel.b.slice();
    },
    makeMove: async (x, y) => {
      const sp = z.spiel;
      if (sp.ende || sp.vorher !== "O") { z.abgelehnt++; throw new Error("nicht am Zug"); }
      const s = setze(sp.b, x, y, "X");
      if (!s || sp.hist.includes(s.b.join(""))) { z.abgelehnt++; throw new Error("ungueltig " + x + "," + y); }
      sp.hist.push(sp.b.join(""));
      sp.b = s.b;
      sp.vorher = "X";
      sp.passes = 0;
      z.zuege++;
      return gegnerAmZug();
    },
    passTurn: async () => {
      const sp = z.spiel;
      if (sp.ende || sp.vorher !== "O") { z.abgelehnt++; throw new Error("nicht am Zug"); }
      z.passes++;
      sp.vorher = "X";
      sp.passes++;
      if (sp.passes >= 2) { ende(); return { type: "gameOver", x: null, y: null }; }
      return gegnerAmZug();
    },
    opponentNextTurn: async () => gegnerAmZug(),
    analysis: {
      getStats: () => {
        const o = {};
        for (const [k, v] of Object.entries(z.letzteStats)) o[k] = { ...v, bonusPercent: 12.5 };
        return o;
      },
    },
  };

  const ns = {
    go,
    disableLog: () => {},
    print: () => {},
    getHostname: () => "home",
    getResetInfo: () => ({ currentNode: opts.knoten ?? 14 }),
    write: (d, inh) => { z.dateien[d] = inh; },
    scp: () => true,
    sleep: async () => { z.sleeps++; if (z.sleeps > 400) throw gesperrt; },
  };
  return { ns, z };
}

async function fahre(opts) {
  const m = neuerGoMock(opts);
  try { await modul.main(m.ns); }
  catch (e) { if (!e.mockAbbruch) throw e; }
  return m;
}

// ---------------------------------------------------------------------------
console.log("");
console.log("=== go.js ===");

const reihen = (...r) => r;
const brett7 = (zeilen) => zeilen.map((s) => s.replace(/ /g, ""));

console.log("");
console.log("-- 1. Schlagen moeglich --");
{
  // Weisser Stein bei (3,3) im Atari: X an drei Seiten, Freiheit (3,4) offen.
  // Spalte x steht als String, Zeichen y. Zeile x=2: y=3 ist X usw.
  const b = Array.from({ length: 7 }, () => ".......");
  const sz = (x, y, c) => { b[x] = b[x].slice(0, y) + c + b[x].slice(y + 1); };
  sz(3, 3, "O"); sz(2, 3, "X"); sz(4, 3, "X"); sz(3, 2, "X");
  const d = modul.chooseMove(b, {});
  pruefe("zieht", d.type === "move");
  pruefe("schlaegt (3,4)", d.x === 3 && d.y === 4, d.x + "," + d.y);
}

console.log("");
console.log("-- 2. Eigene Kette im Atari retten --");
{
  // Kette (3,3)-(3,4) im Atari: O ringsum, letzte Freiheit (3,5).
  // Verlaengern auf (3,5) gibt drei Freiheiten ((2,5),(4,5),(3,6)). Ausserdem steht
  // ein sicherer eigener Block am Rand, damit der Verlust der Kette nicht mit
  // "ich habe gar keine Steine mehr" vermischt wird.
  const b = Array.from({ length: 7 }, () => ".......");
  const sz = (x, y, c) => { b[x] = b[x].slice(0, y) + c + b[x].slice(y + 1); };
  for (let y = 0; y < 7; y++) { sz(0, y, "X"); sz(1, y, y % 2 === 0 ? "X" : "."); }
  sz(3, 3, "X"); sz(3, 4, "X");
  sz(2, 3, "O"); sz(2, 4, "O"); sz(4, 3, "O"); sz(4, 4, "O"); sz(3, 2, "O");
  const d = modul.chooseMove(b, {});
  pruefe("zieht", d.type === "move");
  pruefe("verlaengert bei (3,5)", d.x === 3 && d.y === 5, d.x + "," + d.y);
}

console.log("");
console.log("-- 3. Kein sinnvoller Zug -> Pass --");
{
  // Alles X bis auf zwei echte Augen.
  const b = Array.from({ length: 7 }, () => "XXXXXXX");
  const sz = (x, y, c) => { b[x] = b[x].slice(0, y) + c + b[x].slice(y + 1); };
  sz(1, 1, "."); sz(5, 5, ".");
  const d = modul.chooseMove(b, {});
  pruefe("passt", d.type === "pass", JSON.stringify(d));
  // Volles Brett ohne Leerpunkte
  const voll = Array.from({ length: 7 }, () => "XXXXXXX");
  pruefe("volles Brett -> Pass", modul.chooseMove(voll, {}).type === "pass");
  // Zwei getrennte Gruppen mit je einem echten Auge, dazwischen ein Gegner-
  // streifen ohne Zugmoeglichkeit fuer uns, der nicht gefuellt werden kann.
  const streifen = Array.from({ length: 7 }, () => "XXXXXXX");
  const ss = (x, y, c) => { streifen[x] = streifen[x].slice(0, y) + c + streifen[x].slice(y + 1); };
  for (let x = 0; x < 7; x++) ss(x, 3, "O");
  ss(1, 1, "."); ss(5, 1, ".");
  // Der O-Streifen hat 0 Freiheiten - Stellung ist so nur fuer die Augenregel
  // gedacht: es darf kein Auge gefuellt werden.
  const dd = modul.chooseMove(streifen, {});
  pruefe("Augen werden nicht gefuellt", !(dd.type === "move" && ((dd.x === 1 && dd.y === 1) || (dd.x === 5 && dd.y === 1))),
    JSON.stringify(dd));
}

console.log("");
console.log("-- 4. Gegner hat gepasst und wir fuehren -> Pass --");
{
  const b = Array.from({ length: 7 }, () => ".......");
  const sz = (x, y, c) => { b[x] = b[x].slice(0, y) + c + b[x].slice(y + 1); };
  // Stellung wie in Fall 1: ein Schlag steht zur Verfuegung.
  sz(3, 3, "O"); sz(2, 3, "X"); sz(4, 3, "X"); sz(3, 2, "X");
  const mit = modul.chooseMove(b, { oppPassed: true, ahead: true });
  pruefe("passt, um die Partie zu beenden", mit.type === "pass");
  const zurueck = modul.chooseMove(b, { oppPassed: true, ahead: false });
  pruefe("liegen wir zurueck, wird weitergespielt (Schlag)", zurueck.type === "move" && zurueck.x === 3 && zurueck.y === 4,
    JSON.stringify(zurueck));
}

console.log("");
console.log("-- 5. Ko / abgelehnte Punkte werden nicht gespielt --");
{
  // Klassisches Ko: Wuerde (3,3) schlagen, steht aber in der Verlaufsliste.
  const b = Array.from({ length: 7 }, () => ".......");
  const sz = (x, y, c) => { b[x] = b[x].slice(0, y) + c + b[x].slice(y + 1); };
  for (let y = 0; y < 7; y++) { sz(6, y, "X"); sz(5, y, y % 2 === 0 ? "X" : "."); }   // sicherer Block am Rand
  sz(3, 4, "O"); sz(2, 4, "X"); sz(4, 4, "X"); sz(3, 5, "X");   // O bei (3,4), Freiheit (3,3)
  sz(2, 3, "O"); sz(4, 3, "O"); sz(3, 2, "O");                   // Ko-Form
  // Schlag auf (3,3) ergibt Brett K:
  const nach = b.map((s) => s.split(""));
  nach[3][4] = "."; nach[3][3] = "X";
  const k = nach.map((s) => s.join("")).join("");
  // (3,3) ist ein legaler Kandidat - ob es der BESTE ist, haengt an der
  // Bewertung und ist hier nicht Gegenstand; die Ko-Regel schon.
  const hat = (d, x, y) => (d.scored || []).some((s) => s.x === x && s.y === y);
  const ohne = modul.chooseMove(b, { debug: true });
  pruefe("ohne Verlauf ist der Ko-Schlag Kandidat", hat(ohne, 3, 3));
  const mitVerlauf = modul.chooseMove(b, { debug: true, history: [k] });
  pruefe("mit dem Wiederholungsbrett im Verlauf nicht", !hat(mitVerlauf, 3, 3));
  const gesperrt = modul.chooseMove(b, { blocked: new Set([3 * 7 + 3]) });
  pruefe("gesperrter Punkt wird ausgelassen", !(gesperrt.type === "move" && gesperrt.x === 3 && gesperrt.y === 3));
}

console.log("");
console.log("-- 6. falscher Knoten -> Ende ohne ns.go --");
{
  for (const kn of [1, 3, 10, 15]) {
    const m = await fahre({ knoten: kn });
    pruefe("Knoten " + kn + ": kein go-Aufruf, keine Datei, kein Sleep",
      m.z.goAufrufe === 0 && m.z.resets.length === 0 && Object.keys(m.z.dateien).length === 0 && m.z.sleeps === 0);
  }
  pruefe("GO_NODES = [14, 13]", JSON.stringify(modul.GO_NODES) === "[14,13]");
}

console.log("");
console.log("-- 7. Ganze Partien gegen den Ersatzgegner (7x7) --");
{
  const m = await fahre({ knoten: 14, maxPartien: 40, seed: 7 });
  const nEnde = m.z.partien;
  pruefe("Partien enden und es werden mehrere gespielt", nEnde >= 10, String(nEnde));
  pruefe("Gegner Tetrads, Brett 7", m.z.resets.every((r) => r.gegner === "Tetrads" && r.n === 7),
    JSON.stringify(m.z.resets[0]));
  pruefe("kein Zug vom Spiel abgelehnt", m.z.abgelehnt === 0, String(m.z.abgelehnt));
  const quote = m.z.siege / Math.max(1, nEnde);
  pruefe("Siegquote gegen den Ersatzgegner >= 80 %", quote >= 0.8,
    m.z.siege + "/" + nEnde + ", " + m.z.zuege + " Zuege, " + m.z.passes + " Paesse");
  pruefe("Neustart nur nach Spielende, nie mitten in der Partie", m.z.resets.slice(1).every((r) => r.mitten === false));
  const t = JSON.parse(m.z.dateien["data/go.json"] || "null");
  pruefe("Telemetrie data/go.json mit Stempel und Bilanz", !!t && t.state === "work" && t.knoten === 14 && t.games >= 1 && Number.isFinite(t.zeit),
    JSON.stringify(t));

  // Gegen reinen Zufall zur Eichung der Messlatte: ein Spieler, der zufaellig
  // legal zieht, gewinnt gegen denselben Ersatzgegner deutlich seltener.
  let zufallSiege = 0, zufallN = 12;
  for (let s = 0; s < zufallN; s++) {
    const sp = neuesSpiel(7, "Tetrads", 500 + s);
    const r = rng(900 + s);
    let sicherung = 0;
    sp.vorher = "O";
    while (!sp.ende && sicherung++ < 400) {
      const frei = [];
      for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) {
        if (sp.b[x][y] !== ".") continue;
        const st = setze(sp.b, x, y, "X");
        if (st && !eigenesAuge(sp.b, x, y, "X") && !sp.hist.includes(st.b.join(""))) frei.push({ x, y, st });
      }
      let schwarzPasst = false;
      if (!frei.length || r() < 0.02) schwarzPasst = true;
      if (schwarzPasst) {
        sp.passes++;
        if (sp.passes >= 2) { sp.ende = true; break; }
      } else {
        const k = frei[Math.floor(r() * frei.length)];
        sp.hist.push(sp.b.join("")); sp.b = k.st.b; sp.passes = 0;
      }
      sp.vorher = "X";
      const zg = gegnerZug(sp, sp.r);
      if (!zg) { sp.passes++; if (sp.passes >= 2) { sp.ende = true; break; } }
      else { sp.hist.push(sp.b.join("")); sp.b = zg.s.b; sp.passes = 0; }
      sp.vorher = "O";
    }
    const w = wertung(sp.b, 5.5);
    if (w.black > w.white) zufallSiege++;
  }
  pruefe("Eichung: Zufallsspieler schneidet deutlich schlechter ab",
    zufallSiege / zufallN < quote - 0.3, "Zufall " + zufallSiege + "/" + zufallN + " gegen go.js " + m.z.siege + "/" + nEnde);
}

console.log("");
console.log("-- 7b. Brett mit offline-Knoten --");
{
  const m = await fahre({ knoten: 13, maxPartien: 8, seed: 21, offline: [[0, 0], [3, 3], [6, 2]] });
  pruefe("Partien mit '#'-Knoten enden ohne abgelehnten Zug", m.z.partien >= 5 && m.z.abgelehnt === 0,
    m.z.partien + " Partien, " + m.z.abgelehnt + " abgelehnt");
}

console.log("");
console.log("-- 8. Fortsetzen und Neustart --");
{
  // Laufende Tetrads-Partie auf 7x7 mit ein paar Zuegen: darf NICHT zurueckgesetzt werden.
  const sp = neuesSpiel(7, "Tetrads", 3);
  sp.b[3] = "...X...";
  sp.b[2] = "..O....";
  sp.hist.push(".".repeat(49));
  sp.vorher = "O";                  // Schwarz am Zug
  const m = await fahre({ knoten: 14, spiel: sp, maxPartien: 1 });
  pruefe("laufende Partie wird fortgesetzt (erster Reset erst nach Spielende)", m.z.resets.length >= 1 && m.z.resets[0].mitten === false
    && m.z.partien >= 1);

  // Partie gegen fremden Gegner / andere Groesse -> Neustart gegen Tetrads 7x7.
  const sp2 = neuesSpiel(9, "none", 4);
  const m2 = await fahre({ knoten: 14, spiel: sp2, maxPartien: 1 });
  pruefe("fremdes Brett wird auf Tetrads 7x7 umgestellt",
    m2.z.resets.length >= 1 && m2.z.resets[0].gegner === "Tetrads" && m2.z.resets[0].n === 7);

  // Gegner ist am Zug (Neustart waehrend seiner Bedenkzeit): wir warten.
  const sp3 = neuesSpiel(7, "Tetrads", 5);
  sp3.b[3] = "...X...";
  sp3.hist.push(".".repeat(49));
  sp3.vorher = "X";                 // Weiss am Zug
  const m3 = await fahre({ knoten: 14, spiel: sp3, maxPartien: 1 });
  pruefe("Gegner am Zug -> wird abgewartet, kein abgelehnter Zug", m3.z.abgelehnt === 0 && m3.z.partien >= 1,
    m3.z.abgelehnt + " abgelehnt");
}

console.log("");
console.log(rot === 0 ? "ALLES GRUEN: " + gruen + " Pruefungen" : "ROT: " + rot + " von " + (gruen + rot));
if (rot) {
  for (const f of fehler) console.log("  - " + f);
  process.exit(1);
}
