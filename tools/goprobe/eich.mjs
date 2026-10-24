// Eichung der Regel-Engine von src/lib/gomcts.js gegen den Spielcode
// (reference/bitburner-src/src/Go), 24.10.2026.
//
// Zufallspartien auf 7x7 mit offline-Knoten: jeder Zug wird in beiden Engines
// gespielt. Verglichen werden Legalitaet (ohne Wiederholungsregel - die prueft
// gomcts an der Wurzel ueber die Historie), das Brett nach dem Zug und am Ende
// die Flaechenwertung (scoring.ts getScore ohne Komi).
//
// Aufruf: node --import ./tools/goprobe/register.mjs tools/goprobe/eich.mjs [partien] [gomcts.js]
// Ausgabe: eine JSON-Zeile { partien, zuege, legalAbweichung, brettAbweichung, wertungAbweichung }
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const REF = path.resolve(HIER, "../../reference/bitburner-src/src/Go");
const imp = (p) => import(pathToFileURL(path.join(REF, p)).href);
const N_PARTIEN = Number(process.argv[2]) || 200;
const MCTS = path.resolve(process.argv[3] || path.join(HIER, "../../src/lib/gomcts.js"));

const bs = await imp("boardState/boardState.ts");
const { evaluateIfMoveIsValid, simpleBoardFromBoard } = await imp("boardAnalysis/boardAnalysis.ts");
const { getScore } = await imp("boardAnalysis/scoring.ts");
const { _intern } = await import(pathToFileURL(MCTS).href);
const { geomOf, play, areaScore } = _intern;

const n = 7, NN = n * n;
const geo = geomOf(n);
const CH = { X: 1, O: 2, ".": 0, "#": 3 };
const flach = (st) => {
  const rows = simpleBoardFromBoard(st.board);
  const g = new Uint8Array(NN);
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) g[x * n + y] = CH[rows[x][y]];
  return g;
};
const gleich = (a, b) => { for (let i = 0; i < NN; i++) if (a[i] !== b[i]) return false; return true; };

let zuege = 0, legalAb = 0, brettAb = 0, wertAb = 0, wiederholung = 0;
const beispiele = [];
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };

for (let p = 0; p < N_PARTIEN; p++) {
  const st = bs.getNewBoardState(n, "Tetrads", true);
  let g = flach(st);
  let ko = -1, passes = 0, farbe = "Black";
  const koOut = [-1];
  for (let k = 0; k < 120 && passes < 2; k++) {
    const c = farbe === "Black" ? 1 : 2;
    // Kandidaten in zufaelliger Reihenfolge, erster legaler (laut Spiel) wird gespielt
    const ord = [...Array(NN).keys()].sort(() => rnd() - 0.5);
    let gespielt = false;
    for (const i of ord) {
      const x = Math.floor(i / n), y = i % n;
      if (!st.board[x][y]) continue;
      // Spiel: Legalitaet ohne Wiederholungspruefung (possibleRepeat = false)
      const v = evaluateIfMoveIsValid(st, x, y, farbe, false);
      const spielLegal = v === "Valid move";
      const t = g.slice();
      const r = play(geo, t, i, c, ko, koOut);
      const unserLegal = r >= 0;
      // Einfacher Ko ist bei uns verboten, im Spiel ueber die Historie -
      // bei Ko-Punkten ist "wir illegal, Spiel legal" erwartet.
      // Wiederholung (Superko) prueft gomcts an der Wurzel gegen die Historie,
      // nicht im Baum - getrennt gezaehlt, kein Fehler.
      if (v === "It is illegal to repeat prior board states" && unserLegal) { wiederholung++; continue; }
      if (spielLegal !== unserLegal && !(i === ko && !unserLegal)) {
        legalAb++;
        if (beispiele.length < 3) beispiele.push({ art: "legal", spiel: v, unser: r, i, brett: simpleBoardFromBoard(st.board).join(" ") });
      }
      if (!spielLegal || !unserLegal) continue;
      if (rnd() < 0.15) continue;      // nicht immer den ersten - mehr Vielfalt
      bs.makeMove(st, x, y, farbe);
      const g2 = flach(st);
      if (!gleich(g2, t)) {
        brettAb++;
        if (beispiele.length < 3) beispiele.push({ art: "brett", i, spiel: simpleBoardFromBoard(st.board).join(" ") });
      }
      g = g2; ko = koOut[0]; passes = 0; gespielt = true; zuege++;
      break;
    }
    if (!gespielt) { passes++; ko = -1; st.previousPlayer = farbe; }   // Pass ohne Spielende-Logik
    farbe = farbe === "Black" ? "White" : "Black";
  }
  const s = getScore(st);
  const [sb, sw] = areaScore(geo, g);
  if (s.Black.sum !== sb || s.White.sum - s.White.komi !== sw) {
    wertAb++;
    if (beispiele.length < 3) beispiele.push({ art: "wertung", spiel: [s.Black.sum, s.White.sum - s.White.komi], unser: [sb, sw] });
  }
}
console.log(JSON.stringify({ partien: N_PARTIEN, zuege, legalAbweichung: legalAb, brettAbweichung: brettAb, wiederholung,
  wertungAbweichung: wertAb, beispiele }));
