// Eichung der Cheat-Chance und der Cheat-Folgen gegen den Spielcode (27.10.2026).
//
// 1. cheatChance() aus lib/gocheat.js gegen cheatSuccessChance() aus
//    netscriptGoImplementation.ts: Zaehler 0..15, crime_success-Werte, SF14 0..3.
// 2. Unabhaengig bekannte Werte: die Tabelle im Kommentar des Spielcodes
//    (Zeile 549-559): N Cheats mit je 100 % brauchen +66 % / +145 % / +282 % /
//    +535 % / +1027 % / +4278 % / +59854 % crime_success (ohne SF-Bonus).
// 3. Folgen: Fehlschlag ohne vorigen Cheat = Zug verloren; mit vorigem Cheat
//    und Auswurf-Wurf < 0,1 = Partie beendet, Niederlage, keine Node Power;
//    Erfolg: playTwoMoves schlaegt eine Kette mit zwei Freiheiten, und der
//    Nachbau simulatePair() liefert dasselbe Brett.
//
// Aufruf: node --import ./tools/goprobe/register.mjs tools/goprobe/eich-cheat.mjs [gocheat.js]
// Ausgabe: eine JSON-Zeile { chanceAbweichung, tabelleAbweichung, folgen: {...}, ok }
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const REF = path.resolve(HIER, "../../reference/bitburner-src/src/Go");
const imp = (p) => import(pathToFileURL(path.join(REF, p)).href);
const MOD = path.resolve(process.argv[2] || path.join(HIER, "../../nodes/bau-2026-10-27-gocheat/lib/gocheat.js"));

const impl = await imp("effects/netscriptGoImplementation.ts");
const { Go } = await imp("Go.ts");
const bs = await imp("boardState/boardState.ts");
const { getOpponentStats } = await imp("boardAnalysis/scoring.ts");
const { Player } = await import(pathToFileURL(path.join(HIER, "stubs/player.mjs")).href);
const { cheatChance, planKill, simulatePair } = await import(pathToFileURL(MOD).href);
const { _intern } = await import(pathToFileURL(path.resolve(path.dirname(MOD), "gomcts.js")).href);

// 1. Chance gegen den Spielcode
let chanceAb = 0, faelle = 0;
for (const sf of [0, 1, 2, 3]) for (const crime of [0.5, 1, 1.25, 1.886, 2.5, 4, 10]) for (let c = 0; c <= 15; c++) {
  Player.sf14 = sf; Player.mults.crime_success = crime;
  const spiel = impl.cheatSuccessChance(c);
  const unser = cheatChance(c, crime, sf);
  faelle++;
  if (Math.abs(spiel - unser) > 1e-12) chanceAb++;
}

// 2. Tabelle aus dem Quellkommentar
const TAB = { 1: 66, 2: 145, 3: 282, 4: 535, 5: 1027, 7: 4278, 10: 59854 };
let tabAb = 0; const tabDetail = {};
for (const [N, prozent] of Object.entries(TAB)) {
  const crime = 1 + prozent / 100;
  const letzter = cheatChance(Number(N) - 1, crime, 0);       // N-ter Cheat, Zaehler N-1
  const vorletzter = Number(N) > 1 ? cheatChance(Number(N) - 2, crime, 0) : 1;
  tabDetail[N] = +letzter.toFixed(4);
  // Rundung der Tabelle auf ganze Prozent: Chance muss in [0.99, 1] liegen und der Vorgaenger 1 sein
  if (!(letzter >= 0.99 && letzter <= 1 && vorletzter >= 1 - 1e-9)) tabAb++;
}

// 3. Folgen
const folgen = {};
const ctx = {};
// Sauberes Brett: keine offline-Knoten (der Zufall des Spiels setzt welche), alles leer.
const neuesSpiel = () => {
  Player.sf14 = 3; Player.mults.crime_success = 1.886; impl.resetBoardState(ctx, "Tetrads", 7);
  const b = Go.currentGame.board;
  for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) b[x][y] = { chain: "", liberties: null, y, color: "Empty", x };
  bs.updateChains(b);
  return Go.currentGame;
};
const freiePunkte = () => {
  const frei = [];
  Go.currentGame.board.forEach((col, x) => col.forEach((p, y) => { if (p && p.color === "Empty") frei.push([x, y]); }));
  return frei;
};
{
  // 3a: Fehlschlag ohne vorigen Cheat: Zug verloren, kein Auswurf (Auswurf-Wurf 0 wuerde ausloesen)
  neuesSpiel();
  await impl.cheatPlayTwoMoves(ctx, 3, 3, 3, 4, 2, 0);
  folgen.fehlschlagErsterCheat = {
    cheatCount: Go.currentGame.cheatCount,
    steineSchwarz: Go.currentGame.board.flat().filter((p) => p && p.color === "Black").length,
    spielLaeuft: Go.currentGame.previousPlayer !== null,
  };
}
{
  // 3b: Fehlschlag mit vorigem Cheat und Auswurf-Wurf 0 (< 0.1): Partie vorbei, Niederlage, keine Node Power
  neuesSpiel();
  const stats = getOpponentStats("Tetrads");
  const np0 = stats.nodePower, l0 = stats.losses;
  await impl.cheatPlayTwoMoves(ctx, 3, 3, 3, 4, 0, 0);       // Erfolg
  const nachErsten = { cheatCount: Go.currentGame.cheatCount, steine: Go.currentGame.board.flat().filter((p) => p && p.color === "Black").length };
  await impl.getOpponentNextMove(ctx, false);
  const frei = freiePunkte();
  await impl.cheatPlayTwoMoves(ctx, frei[0][0], frei[0][1], frei[1][0], frei[1][1], 2, 0);
  folgen.auswurf = {
    nachErstemCheat: nachErsten, partieBeendet: Go.currentGame.previousPlayer === null,
    niederlagen: stats.losses - l0, nodePowerZuwachs: stats.nodePower - np0,
  };
}
{
  // 3c: Fehlschlag mit vorigem Cheat und Auswurf-Wurf 0.5 (>= 0.1): nur Zug verloren
  neuesSpiel();
  const stats = getOpponentStats("Tetrads"); const l0 = stats.losses;
  await impl.cheatPlayTwoMoves(ctx, 3, 3, 3, 4, 0, 0);
  await impl.getOpponentNextMove(ctx, false);
  const frei = freiePunkte();
  await impl.cheatPlayTwoMoves(ctx, frei[0][0], frei[0][1], frei[1][0], frei[1][1], 2, 0.5);
  folgen.fehlschlagMitVorgaenger = {
    spielLaeuft: Go.currentGame.previousPlayer !== null, niederlagen: stats.losses - l0, cheatCount: Go.currentGame.cheatCount,
  };
}
{
  // 3d: Doppelzug auf die letzten zwei Freiheiten einer weissen Kette: Spielcode vs Nachbau.
  // Wir lesen das Brett DIREKT nach dem Cheat (vor Weisses Antwort): der Spielcode ruft handleNextTurn
  // und die KI antwortet erst nach waitCycle, also ist das Brett hier noch unberuehrt.
  neuesSpiel();
  const board = Go.currentGame.board;
  board[1][1].color = "White"; board[0][1].color = "Black"; board[1][0].color = "Black";   // Weiss (1,1): Freiheiten (1,2), (2,1)
  bs.updateChains(board);
  const n = 7, g = new Uint8Array(49);
  board.forEach((col, x) => col.forEach((p, y) => { g[x * n + y] = p.color === "Black" ? 1 : p.color === "White" ? 2 : 0; }));
  const geo = _intern.geomOf(n);
  const sim = simulatePair(geo, g, 1 * n + 2, 2 * n + 1);
  const plan = planKill(g, n, {});
  const promise = impl.cheatPlayTwoMoves(ctx, 1, 2, 2, 1, 0, 0);
  const nachCheat = new Uint8Array(49);
  Go.currentGame.board.forEach((col, x) => col.forEach((p, y) => { nachCheat[x * n + y] = p.color === "Black" ? 1 : p.color === "White" ? 2 : 0; }));
  await promise;
  let gleich = true;
  for (let i = 0; i < 49; i++) if (nachCheat[i] !== sim.h[i]) gleich = false;
  folgen.doppelzugSchlaegt = { nachbauGeschlagen: sim.captured, planErkannt: !!plan && plan.captured === 1, brettGleich: gleich };
}

const ok = chanceAb === 0 && tabAb === 0
  && folgen.fehlschlagErsterCheat.spielLaeuft === true && folgen.fehlschlagErsterCheat.steineSchwarz === 0
  && folgen.auswurf.partieBeendet === true && folgen.auswurf.niederlagen === 1 && folgen.auswurf.nodePowerZuwachs === 0
  && folgen.fehlschlagMitVorgaenger.spielLaeuft === true && folgen.fehlschlagMitVorgaenger.niederlagen === 0
  && folgen.doppelzugSchlaegt.nachbauGeschlagen === 1 && folgen.doppelzugSchlaegt.brettGleich === true;
console.log(JSON.stringify({ chanceFaelle: faelle, chanceAbweichung: chanceAb, tabelleAbweichung: tabAb, tabelle: tabDetail, folgen, ok }));
