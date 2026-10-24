// Pruefstand IPvGO (24.10.2026): laesst src/go.js (oder eine Kopie, GO_SRC)
// mit seiner echten main()-Schleife gegen die echte Gegner-KI des Spiels
// spielen (reference/bitburner-src/src/Go, ueber loader.mjs).
//
// Aufruf: node --import ./tools/goprobe/register.mjs tools/goprobe/play.mjs [partien] [go.js-pfad]
// Ausgabe: Siege/Niederlagen, Node Power, mittlere Punktzahl, Rechenzeit je eigenem Zug.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const REF = path.resolve(HIER, "../../reference/bitburner-src/src/Go");
const imp = (p) => import(pathToFileURL(path.join(REF, p)).href);

const N = Number(process.argv[2]) || 50;
const GO_PFAD = path.resolve(process.argv[3] || path.join(HIER, "../../src/go.js"));

const { Go } = await imp("Go.ts");
const impl = await imp("effects/netscriptGoImplementation.ts");
const { simpleBoardFromBoard } = await imp("boardAnalysis/boardAnalysis.ts");
const { getOpponentStats, getScore } = await imp("boardAnalysis/scoring.ts");

const ctx = {};
let partien = 0, siege = 0, punkteSchwarz = 0, punkteWeiss = 0, zuege = 0, maxZuege = 0, tPartie = Date.now(), maxSek = 0;
const STOP = "PRUEFSTAND-ENDE";
let anrufe = 0;
const T_START = Date.now();
// Zeitbudget: nach GO_MAX_SEK Sekunden endet der Lauf nach der laufenden Partie.
const MAX_SEK = Number(process.env.GO_MAX_SEK) || Infinity;

// Spielende mitschneiden: getGameState nach jeder Partie (go.js ruft es selbst).
const ns = {
  write: (f, d) => { if (f === "data/go.json") globalThis.__goTele = d; },
  disableLog() {}, print: (m) => { if (process.env.GO_LANG) console.error("ns.print: " + m); }, scp() {}, getHostname: () => "home",
  getResetInfo: () => ({ currentNode: 14, ownedSF: new Map() }),
  asleep: () => new Promise((r) => setImmediate(r)),
  // Wie im Spiel ein echter Abgabepunkt an die Ereignisschleife (setImmediate).
  sleep: async () => { if (partien >= N || (Date.now() - T_START) / 1000 > MAX_SEK) throw new Error(STOP); await new Promise((r) => setImmediate(r)); },
  go: {
    getBoardState: () => simpleBoardFromBoard(Go.currentGame.board),
    getMoveHistory: () => impl.getMoveHistory(),
    getCurrentPlayer: () => impl.getCurrentPlayer(),
    getOpponent: () => Go.currentGame.ai,
    getGameState: () => {
      const gs = impl.getGameState();
      if (gs.currentPlayer === "None") {
        partien++;
        const sek = (Date.now() - tPartie) / 1000; tPartie = Date.now();
        if (zuege > maxZuege) maxZuege = zuege;
        if (sek > maxSek) maxSek = sek;
        if (process.env.GO_LANG && (zuege > 60 || sek > 20)) console.error("lange Partie", partien, zuege, "Zuege", sek, "s");
        zuege = 0;
        if (partien % 10 === 0) console.error("... " + partien + " Partien, " + siege + " Siege, " + Math.round((Date.now() - T_START) / 1000) + " s, Heap " + Math.round(process.memoryUsage().heapUsed / 1e6) + " MB");
        if (gs.blackScore > gs.whiteScore) siege++;
        else if (process.env.GO_VERLUST) {
          // Verlorene Partie: Endstellung und Zugfolge (aelteste zuerst) fuer die Analyse.
          const verlauf = impl.getMoveHistory().map((b) => b.join("")).reverse();
          console.error(JSON.stringify({ verlust: partien, schwarz: gs.blackScore, weiss: gs.whiteScore,
            ende: simpleBoardFromBoard(Go.currentGame.board).join(" "), zuege: verlauf.length,
            start: verlauf[0] ? verlauf[0].match(/.{7}/g).join(" ") : "" }));
        }
        punkteSchwarz += gs.blackScore; punkteWeiss += gs.whiteScore;
      }
      return gs;
    },
    resetBoardState: (o, s) => impl.resetBoardState(ctx, o, s),
    makeMove: (x, y) => { zuege++; if (process.env.GO_LANG && (zuege % 40 === 0 || zuege > 60)) console.error("Zug " + zuege + " Partie " + (partien + 1) + " " + ((Date.now() - tPartie) / 1000).toFixed(0) + " s | " + simpleBoardFromBoard(Go.currentGame.board).join(" ")); return impl.makePlayerMove(ctx, x, y); },
    passTurn: () => { zuege++; anrufe++; if (process.env.GO_LANG && anrufe % 200 === 0) console.error("Pass/Gegner-Aufrufe " + anrufe + " Partie " + (partien + 1) + " Zuege " + zuege + " " + Math.round((Date.now() - tPartie) / 1000) + " s"); return impl.handlePassTurn(ctx); },
    opponentNextTurn: (log) => { anrufe++; if (process.env.GO_LANG && anrufe % 200 === 0) console.error("Pass/Gegner-Aufrufe " + anrufe + " Partie " + (partien + 1) + " Zuege " + zuege + " " + Math.round((Date.now() - tPartie) / 1000) + " s"); return impl.getOpponentNextMove(ctx, log); },
    analysis: { getStats: () => impl.getStats() },
  },
};

const mod = await import(pathToFileURL(GO_PFAD).href);
setInterval(() => {
  if (Date.now() - tPartie > 60000) {
    console.error("HAENGT in Partie " + (partien + 1) + " nach " + zuege + " Zuegen; Spieler " + impl.getCurrentPlayer()
      + ", previousPlayer " + Go.currentGame.previousPlayer + ", passCount " + Go.currentGame.passCount);
    console.error(simpleBoardFromBoard(Go.currentGame.board).join("\n"));
    console.error("Fehler: " + (globalThis.__goFehler || []).slice(-3).join("\n"));
    process.exit(3);
  }
}, 5000).unref();
// Rechenzeit der eigenen Zugwahl messen.
const t0 = Date.now();
try { await mod.main(ns); } catch (e) { if (!String(e).includes(STOP)) throw e; }
const dauer = (Date.now() - t0) / 1000;
const st = getOpponentStats("Tetrads");
console.log(JSON.stringify({
  datei: path.basename(GO_PFAD), partien, siege, quote: +(siege / partien).toFixed(3),
  nodePower: Math.round(st.nodePower), npJePartie: +(st.nodePower / partien).toFixed(1),
  schwarz: +(punkteSchwarz / partien).toFixed(1), weiss: +(punkteWeiss / partien).toFixed(1),
  sekunden: dauer, maxZuege, maxSek,
  tele: (() => { try { const t = JSON.parse(globalThis.__goTele || "{}"); return { v: t.visitsPerMove, p: t.ponderPerMove, o: t.ownPerMove, oms: t.ownMsPerMove }; } catch { return null; } })(), fehler: (globalThis.__goFehler || []).length,
}));
