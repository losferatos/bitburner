// Szenariotest go.cheat (27.10.2026): laesst go.js (echte main()) EINEN Zug gegen die echte
// Spiellogik spielen und prueft, was der Spieler als erste Aktion waehlt.
//
// Stellung (7x7, ohne offline-Knoten): weisse Kette aus 5 Steinen in der Ecke mit genau zwei
// Freiheiten (1,2) und (2,0); Schwarz ist am Zug. Ein normaler Zug kann die Kette nicht schlagen,
// playTwoMoves auf beide Freiheiten schlaegt sie sofort.
//
//   A  SF14.3, crime 1.886 (Chance 1.0)  -> erste Aktion ist playTwoMoves auf (1,2)+(2,0), Kette geschlagen
//   B  SF14.3, crime 0.5 (Chance 0.55)   -> KEIN Cheat (unter der Mindestchance), normaler Zug
//   C  ohne SF14 (API wirft)             -> kein Absturz, normaler Zug
//   D  zweiter Cheat der Partie ohne Chance (Zaehler 2 bei crime 1.0: Chance < 0.97) -> kein Cheat
//
// Aufruf: node --import ./tools/goprobe/register.mjs tools/goprobe/test-gocheat.mjs <go.js>
// Ausgabe: eine JSON-Zeile { faelle: {A:{...}}, ok }
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const REF = path.resolve(HIER, "../../reference/bitburner-src/src/Go");
const imp = (p) => import(pathToFileURL(path.join(REF, p)).href);
const GO_PFAD = path.resolve(process.argv[2]);

const { Go } = await imp("Go.ts");
const impl = await imp("effects/netscriptGoImplementation.ts");
const bs = await imp("boardState/boardState.ts");
const { simpleBoardFromBoard } = await imp("boardAnalysis/boardAnalysis.ts");
const { Player } = await import(pathToFileURL(path.join(HIER, "stubs/player.mjs")).href);
const mod = await import(pathToFileURL(GO_PFAD).href);
const ctx = {};
const STOP = "TEST-ENDE";

function stellung(vorCheats = 0) {
  impl.resetBoardState(ctx, "Tetrads", 7);
  const b = Go.currentGame.board;
  for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) b[x][y] = { chain: "", liberties: null, y, color: "Empty", x };
  const W = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1]];
  const S = [[0, 3], [2, 1], [3, 3], [3, 1], [1, 3]];
  for (const [x, y] of W) b[x][y].color = "White";
  for (const [x, y] of S) b[x][y].color = "Black";
  bs.updateChains(b);
  Go.currentGame.cheatCount = vorCheats;
  return b;
}

async function lauf(name, { sf14, crime, vorCheats = 0 }) {
  Player.sf14 = sf14; Player.mults.crime_success = crime;
  stellung(vorCheats);
  let erste = null;
  const merke = (art, args, nachher) => {
    if (!erste) erste = { art, args, weisseSteine: nachher ? nachher().flat().filter((c) => c === "O").length : null };
  };
  const brett = () => simpleBoardFromBoard(Go.currentGame.board).join("").split("");
  const wrap = (art, f) => (...a) => { const r = f(...a); merke(art, a, brett); throw new Error(STOP); };
  const ns = {
    write() {}, disableLog() {}, print() {}, scp() {}, getHostname: () => "home",
    getResetInfo: () => ({ currentNode: 14, ownedSF: new Map([[14, sf14]]) }),
    asleep: () => new Promise((r) => setImmediate(r)),
    sleep: async () => { throw new Error(STOP); },
    go: {
      getBoardState: () => simpleBoardFromBoard(Go.currentGame.board),
      getMoveHistory: () => impl.getMoveHistory(),
      getCurrentPlayer: () => impl.getCurrentPlayer(),
      getOpponent: () => Go.currentGame.ai,
      getGameState: () => impl.getGameState(),
      resetBoardState: (o, s) => impl.resetBoardState(ctx, o, s),
      makeMove: wrap("makeMove", (x, y) => impl.makePlayerMove(ctx, x, y)),
      passTurn: wrap("passTurn", () => impl.handlePassTurn(ctx)),
      opponentNextTurn: (l) => impl.getOpponentNextMove(ctx, l),
      analysis: { getStats: () => impl.getStats() },
      cheat: {
        getCheatSuccessChance: (c) => { impl.checkCheatApiAccess(ctx); return impl.cheatSuccessChance(c ?? Go.currentGame.cheatCount, false); },
        getCheatCount: () => { impl.checkCheatApiAccess(ctx); return Go.currentGame.cheatCount; },
        playTwoMoves: wrap("playTwoMoves", (x1, y1, x2, y2) => {
          impl.checkCheatApiAccess(ctx);
          impl.validateMove(ctx, x1, y1, "playTwoMoves", { repeat: false, suicide: false });
          impl.validateMove(ctx, x2, y2, "playTwoMoves", { repeat: false, suicide: false });
          return impl.cheatPlayTwoMoves(ctx, x1, y1, x2, y2);
        }),
        removeRouter: wrap("removeRouter", (x, y) => { impl.checkCheatApiAccess(ctx); return impl.cheatRemoveRouter(ctx, x, y); }),
        destroyNode: wrap("destroyNode", (x, y) => { impl.checkCheatApiAccess(ctx); return impl.cheatDestroyNode(ctx, x, y); }),
        repairOfflineNode: wrap("repairOfflineNode", (x, y) => { impl.checkCheatApiAccess(ctx); return impl.cheatRepairOfflineNode(ctx, x, y); }),
      },
    },
  };
  let absturz = null;
  try { await mod.main(ns); } catch (e) { if (!String(e).includes(STOP)) absturz = String(e).slice(0, 120); }
  return { erste, absturz };
}

const A = await lauf("A", { sf14: 3, crime: 1.886 });
const B = await lauf("B", { sf14: 3, crime: 0.5 });
const C = await lauf("C", { sf14: 0, crime: 1.886 });
const D = await lauf("D", { sf14: 3, crime: 1.0, vorCheats: 2 });
const istCheat = (r) => r.erste && r.erste.art === "playTwoMoves";
const punkte = (r) => (r.erste && r.erste.args ? r.erste.args.slice(0, 4).join(",") : null);
const faelle = {
  A: { erste: A.erste && A.erste.art, args: punkte(A), weisseSteineDanach: A.erste && A.erste.weisseSteine, absturz: A.absturz },
  B: { erste: B.erste && B.erste.art, absturz: B.absturz },
  C: { erste: C.erste && C.erste.art, absturz: C.absturz },
  D: { erste: D.erste && D.erste.art, absturz: D.absturz },
};
const ok = istCheat(A) && ["1,2,2,0", "2,0,1,2"].includes(punkte(A)) && A.erste.weisseSteine === 0 && !A.absturz
  && !istCheat(B) && !B.absturz && !istCheat(C) && !C.absturz && !istCheat(D) && !D.absturz
  && !!B.erste && !!C.erste && !!D.erste;
console.log(JSON.stringify({ faelle, ok }));
