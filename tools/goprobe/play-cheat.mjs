// Pruefstand IPvGO MIT go.cheat (27.10.2026): wie play.mjs, aber ns.go.cheat.*
// ist angeschlossen und die Auswertung zaehlt, was fuer Ertrag je Minute noetig ist.
//
// Umgebung: GO_SF14 (Stufe, Standard 3), GO_CRIME (crime_success, Standard 1.886
// = Live-Wert 27.10.), GO_STREAK (Anfangs-Siegesserie, Standard 20 = Dauerzustand),
// GO_MAX_SEK, GO_MCTS_OPT, GO_CHEAT_OPT (Optionen des Kandidaten, JSON).
//
// Aufruf: node --import ./tools/goprobe/register.mjs tools/goprobe/play-cheat.mjs [partien] [go.js-pfad]
// Ausgabe (eine JSON-Zeile): Partien, Siege (laut Spiel-Statistik, Auswurf zaehlt als Niederlage),
// Schwarz-Punkte der gewonnenen Partien, Aktionen je Partie (Zug, Pass, Cheat = je eine
// Antwort des Gegners = Zeitmass), Cheat-Zaehler, Node Power laut Spielstatistik.
process.env.GO_SF14 ??= "3";
process.env.GO_CRIME ??= "1.886";
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
const { getOpponentStats } = await imp("boardAnalysis/scoring.ts");

const ctx = {};
const STOP = "PRUEFSTAND-ENDE";
const T_START = Date.now();
const MAX_SEK = Number(process.env.GO_MAX_SEK) || Infinity;
const st0 = getOpponentStats("Tetrads");
st0.winStreak = Number(process.env.GO_STREAK ?? 20); st0.oldWinStreak = st0.winStreak - 1;

let partien = 0, aktionen = 0, aktionenGesamt = 0;
let cheatsVersucht = 0, cheatsErfolg = 0, cheatPartien = 0, cheatsInPartie = 0;
let punkteSchwarzSieg = 0, siegeLautScore = 0, punkteWeissSieg = 0, tPartie = Date.now(), maxAkt = 0;
const liste = [];
let npVorher = st0.nodePower;

const zaehle = () => { aktionen++; };
const cheatWrap = (name, f) => (...a) => {
  zaehle(); cheatsVersucht++; cheatsInPartie++;
  return f(...a);
};
// Erfolg/Misserfolg ueber helpers.log des Spiels erkennen (Stub schluckt es): eigener Haken.
import { helpers } from "./stubs/nsHelpers.mjs";
helpers.log = (c, f) => { try { const m = f(); if (/Cheat successful/.test(m)) cheatsErfolg++; } catch { /* egal */ } };

const cheatNs = {
  getCheatSuccessChance: (cnt, white) => {
    impl.checkCheatApiAccess(ctx);
    return impl.cheatSuccessChance(cnt ?? Go.currentGame.cheatCount, !!white);
  },
  getCheatCount: (white) => { impl.checkCheatApiAccess(ctx); return white ? Go.currentGame.cheatCountForWhite : Go.currentGame.cheatCount; },
  removeRouter: cheatWrap("removeRouter", (x, y) => {
    impl.checkCheatApiAccess(ctx);
    impl.validateMove(ctx, x, y, "removeRouter", { emptyNode: false, requireNonEmptyNode: true, repeat: false, suicide: false });
    return impl.cheatRemoveRouter(ctx, x, y);
  }),
  playTwoMoves: cheatWrap("playTwoMoves", (x1, y1, x2, y2) => {
    impl.checkCheatApiAccess(ctx);
    impl.validateMove(ctx, x1, y1, "playTwoMoves", { repeat: false, suicide: false });
    impl.validateMove(ctx, x2, y2, "playTwoMoves", { repeat: false, suicide: false });
    return impl.cheatPlayTwoMoves(ctx, x1, y1, x2, y2);
  }),
  repairOfflineNode: cheatWrap("repairOfflineNode", (x, y) => {
    impl.checkCheatApiAccess(ctx);
    impl.validateMove(ctx, x, y, "repairOfflineNode", { emptyNode: false, repeat: false, onlineNode: false, requireOfflineNode: true, suicide: false });
    return impl.cheatRepairOfflineNode(ctx, x, y);
  }),
  destroyNode: cheatWrap("destroyNode", (x, y) => {
    impl.checkCheatApiAccess(ctx);
    impl.validateMove(ctx, x, y, "destroyNode", { repeat: false, onlineNode: true, suicide: false });
    return impl.cheatDestroyNode(ctx, x, y);
  }),
};

const ns = {
  write: (f, d) => { if (f === "data/go.json") globalThis.__goTele = d; },
  disableLog() {}, print: (m) => { if (process.env.GO_LANG) console.error("ns.print: " + m); }, scp() {}, getHostname: () => "home",
  getResetInfo: () => ({ currentNode: 14, ownedSF: new Map([[14, 3]]) }),
  asleep: () => new Promise((r) => setImmediate(r)),
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
        aktionenGesamt += aktionen; if (aktionen > maxAkt) maxAkt = aktionen;
        const stN = getOpponentStats("Tetrads"); const win = gs.blackScore > gs.whiteScore && stN.nodePower > npVorher;
        liste.push([Math.round((stN.nodePower - npVorher) * 100) / 100, aktionen, gs.blackScore, win ? 1 : 0, cheatsInPartie]); npVorher = stN.nodePower;
        if (cheatsInPartie) cheatPartien++;
        if (gs.blackScore > gs.whiteScore) { siegeLautScore++; punkteSchwarzSieg += gs.blackScore; punkteWeissSieg += gs.whiteScore; }
        if (process.env.GO_FINAL) console.error("ENDE " + gs.blackScore + ":" + gs.whiteScore + " akt " + aktionen + " cheats " + cheatsInPartie + "\n" + simpleBoardFromBoard(Go.currentGame.board).join("\n"));
        aktionen = 0; cheatsInPartie = 0; tPartie = Date.now();
        if (partien % 10 === 0) console.error("... " + partien + " Partien, " + Math.round((Date.now() - T_START) / 1000) + " s");
      }
      return gs;
    },
    resetBoardState: (o, s) => impl.resetBoardState(ctx, o, s),
    makeMove: (x, y) => { zaehle(); return impl.makePlayerMove(ctx, x, y); },
    passTurn: () => { zaehle(); return impl.handlePassTurn(ctx); },
    opponentNextTurn: (log) => impl.getOpponentNextMove(ctx, log),
    analysis: { getStats: () => impl.getStats() },
    cheat: cheatNs,
  },
};

const mod = await import(pathToFileURL(GO_PFAD).href);
setInterval(() => {
  if (Date.now() - tPartie > 90000) {
    console.error("HAENGT in Partie " + (partien + 1) + " nach " + aktionen + " Aktionen; Spieler " + impl.getCurrentPlayer());
    console.error(simpleBoardFromBoard(Go.currentGame.board).join("\n"));
    console.error("Fehler: " + (globalThis.__goFehler || []).slice(-3).join("\n"));
    process.exit(3);
  }
}, 5000).unref();
const t0 = Date.now();
try { await mod.main(ns); } catch (e) { if (!String(e).includes(STOP)) throw e; }
const dauer = (Date.now() - t0) / 1000;
const st = getOpponentStats("Tetrads");
console.log(JSON.stringify({
  datei: path.basename(GO_PFAD), partien, siege: st.wins, niederlagen: st.losses, siegeLautScore,
  punkteSchwarzSieg, punkteWeissSieg, aktionenGesamt, maxAkt, cheatsVersucht, cheatsErfolg, cheatPartien,
  nodePower: Math.round(st.nodePower * 100) / 100, winStreakEnde: st.winStreak, sekunden: dauer,
  liste, fehler: (globalThis.__goFehler || []).length,
}));
