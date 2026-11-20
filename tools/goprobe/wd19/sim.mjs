// Schneller Testrahmen: eine Schwarz-Politik (ohne Bedenkzeit) gegen die echte Gegner-KI "????????????".
// Aufruf (im bitburner-Ordner): node --import ./tools/goprobe/register.mjs <dieses>/sim.mjs <policy.mjs> [partien] [json-opt]
// Ausgabe: je Partie eine Zeile, am Ende eine JSON-Zusammenfassung.
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const REF = path.resolve(ROOT, "reference/bitburner-src/src/Go");
const imp = (p) => import(pathToFileURL(path.join(REF, p)).href);
const POLICY = path.resolve(process.argv[2]);
const N = Number(process.argv[3]) || 10;
const OPT = JSON.parse(process.argv[4] || "{}");
const VERB = !!process.env.SIM_VERB;

const { Player } = await import("@player");
Player.hasAugmentation = () => true;
const { Go } = await imp("Go.ts");
const impl = await imp("effects/netscriptGoImplementation.ts");
const { simpleBoardFromBoard } = await imp("boardAnalysis/boardAnalysis.ts");
const pol = await import(pathToFileURL(POLICY).href);

const ctx = {};
const CH = { X: 1, O: 2, ".": 0, "#": 3 };
const flat = () => {
  const rows = simpleBoardFromBoard(Go.currentGame.board); const n = rows.length; const g = new Uint8Array(n * n);
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) g[x * n + y] = CH[rows[x][y]];
  return { g, n, rows };
};
const show = (g, n) => { const c = [".", "X", "O", "#"]; const out = []; for (let x = 0; x < n; x++) { let r = ""; for (let y = 0; y < n; y++) r += c[g[x * n + y]]; out.push(r); } return out.join("\n"); };

const res = [];
const klass = { nahSchwarz: 0, nahWeiss: 0, frei: 0, pass: 0 };
for (let p = 0; p < N; p++) {
  impl.resetBoardState(ctx, "????????????", 19);
  const policy = pol.createPolicy(19, OPT);
  let moves = 0, over = false, oppPassed = false, rejected = 0, passes = 0;
  const SNAP = Number(process.env.SIM_SNAP || 0);
  const t0 = Date.now();
  while (!over && moves < 400) {
    const { g, n } = flat();
    if (SNAP && moves % SNAP === 0) { console.log("--- vor Zug " + moves); console.log(show(g, n)); }
    let mv = policy.move(g, { oppPassed, moves });
    if (mv < 0) passes++;
    let reply = null;
    for (let tries = 0; tries < 8 && reply === null; tries++) {
      if (mv < 0) { reply = await impl.handlePassTurn(ctx); break; }
      try { reply = await impl.makePlayerMove(ctx, Math.floor(mv / n), mv % n); }
      catch (e) { rejected++; policy.reject && policy.reject(mv); mv = policy.move(g, { oppPassed, moves, retry: true }); }
    }
    if (reply === null) reply = await impl.handlePassTurn(ctx);
    moves++;
    if (reply.type === "gameOver") over = true;
    else if (reply.type === "pass") { oppPassed = true; klass.pass++; }
    else {
      oppPassed = false;
      // weissen Zug einordnen (Brett VOR dem Zug: g mit dem eigenen Stein)
      const i = reply.x * n + reply.y; const gg = flat().g;
      let nb = 0, nw = 0;
      for (const d of [-n, n, -1, 1, -n - 1, -n + 1, n - 1, n + 1]) { const q = i + d; if (q < 0 || q >= n * n) continue; if (Math.abs((q % n) - (i % n)) > 1) continue; if (gg[q] === 1) nb++; else if (gg[q] === 2) nw++; }
      if (nb) klass.nahSchwarz++; else if (nw) klass.nahWeiss++; else klass.frei++;
    }
    if (impl.getCurrentPlayer() === "None") over = true;
  }
  const gs = impl.getGameState();
  const { g, n } = flat();
  const sealed = policy.sealedCount ? policy.sealedCount(g) : null;
  res.push({ schwarz: gs.blackScore, weiss: gs.whiteScore, zuege: moves, rejected });
  console.log(JSON.stringify({ partie: p + 1, schwarz: gs.blackScore, weiss: gs.whiteScore, sieg: gs.blackScore > gs.whiteScore, zuege: moves, passes, steine: [...g].filter((v) => v === 1).length, rejected, sek: +((Date.now() - t0) / 1000).toFixed(0), sealed }));
  if (VERB) console.log(show(g, n));
}
const m = (k) => res.reduce((a, r) => a + r[k], 0) / res.length;
const sd = Math.sqrt(res.reduce((a, r) => a + (r.schwarz - m("schwarz")) ** 2, 0) / res.length);
console.log(JSON.stringify({ policy: path.basename(POLICY), opt: OPT, partien: res.length, siege: res.filter((r) => r.schwarz > r.weiss).length,
  schwarz: +m("schwarz").toFixed(1), sd: +sd.toFixed(1), weiss: +m("weiss").toFixed(1), zuege: +m("zuege").toFixed(0), weissZuege: klass }));
