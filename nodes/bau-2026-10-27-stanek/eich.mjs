// Eichung von stanekmodell.mjs gegen den ECHTEN Spielcode (reference/v301/src/CotMG, ueber probe/loader.mjs).
// Geprueft: (1) Gittergroesse fuer BN13/BN15/BN7 x SF13-Stufe 0..3, (2) Formen/Drehungen/Nachbarn,
// (3) effect()/calculateMults() nach Zufallsladungen (bitgenau), (4) charge()-Dynamik und Kirchenruf.
// Aufruf: node --import ./nodes/bau-2026-10-27-stanek/probe/register.mjs nodes/bau-2026-10-27-stanek/eich.mjs
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as M from "./stanekmodell.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const REF = path.resolve(HIER, "../../reference/v301/src");
const imp = (p) => import(pathToFileURL(path.join(REF, p)).href);
const { StaneksGift } = await imp("CotMG/StaneksGift.ts");
const { Fragments, FragmentById } = await imp("CotMG/Fragment.ts");
const { Player } = await import(pathToFileURL(path.join(HIER, "probe/stubs/player.mjs")).href);
const { currentNodeMults } = await import(pathToFileURL(path.join(HIER, "probe/stubs/bitnodeMults.mjs")).href);
const { Factions } = await import(pathToFileURL(path.join(HIER, "probe/stubs/factions.mjs")).href);

let fehler = 0; const ok = (b, t) => { if (!b) { fehler++; console.log("ABWEICHUNG: " + t); } };
const BN = { "BN13": [2, 1], "BN15": [0.7, -2], "BN7": [0.9, -1], "BN1": [1, 0], "BN14": [0.5, -1] };

// (1) Gittergroesse
let nG = 0;
for (const [name, [pow, extra]] of Object.entries(BN)) for (let sf = 0; sf <= 3; sf++) {
  Player.sf13 = sf; currentNodeMults.StaneksGiftExtraSize = extra; currentNodeMults.StaneksGiftPowerMultiplier = pow;
  const g = new StaneksGift(); const m = M.gridSize(extra, sf);
  ok(g.width() === m.w && g.height() === m.h, `Gitter ${name} SF${sf}: Spiel ${g.width()}x${g.height()} Modell ${m.w}x${m.h}`); nG++;
  if (name === "BN13") console.log(`  BN13 SF13=${sf}: ${g.width()}x${g.height()} = ${g.width() * g.height()} Zellen`);
}
console.log("(1) Gittergroessen geprueft:", nG);

// (2) Formen: Modell-Zellen gegen Fragment.fullAt aller Fragmente in allen 4 Drehungen
let nF = 0;
for (const f of Fragments) for (let r = 0; r < 4; r++) {
  const { cells, w, h } = M.cellsOf(M.BY_ID[f.id], r);
  ok(w === f.width(r) && h === f.height(r), `Masse ${f.id} rot${r}`);
  const set = new Set(cells.map(([x, y]) => x + "," + y));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) ok(set.has(x + "," + y) === f.fullAt(x, y, r), `Form ${f.id} rot${r} (${x},${y})`);
  const nbSpiel = f.neighbors(r).length; nF++;
  void nbSpiel;
}
console.log("(2) Fragment x Drehung geprueft:", nF);

// (3)+(4) Zufallslayouts auf BN13/SF2, Zufallsladungen
function rnd(seed) { return M.mulberry(seed); }
let nL = 0, maxAb = 0;
for (let seed = 1; seed <= 60; seed++) {
  const R = rnd(seed);
  const [pow, extra] = BN.BN13, sf = 2;
  Player.sf13 = sf; currentNodeMults.StaneksGiftExtraSize = extra; currentNodeMults.StaneksGiftPowerMultiplier = pow;
  const g = new StaneksGift(); const { w: W, h: H } = M.gridSize(extra, sf);
  const layout = [];
  for (let t = 0; t < 400 && layout.length < 12; t++) {
    const f = M.FRAGMENTE[Math.floor(R() * M.FRAGMENTE.length)];
    const p = { id: f.id, x: Math.floor(R() * W), y: Math.floor(R() * H), rot: Math.floor(R() * 4) };
    const modellOk = M.fits(layout, p, W, H);
    const spielOk = g.canPlace(p.x, p.y, p.rot, FragmentById(p.id));
    ok(modellOk === spielOk, `canPlace seed${seed} id${p.id} (${p.x},${p.y},${p.rot}): Spiel ${spielOk} Modell ${modellOk}`);
    if (spielOk) { g.place(p.x, p.y, p.rot, FragmentById(p.id)); layout.push(p); }
  }
  // Ladung: je Fragment zufaellig 1..40 Aufrufe mit Faedenzahl aus {1,2,4,8,16,64,256,1000}
  const ch = layout.map(() => ({ hc: 0, n: 0 }));
  const FAD = [1, 2, 4, 8, 16, 64, 256, 1000, 3, 5.5];
  layout.forEach((p, i) => {
    const af = g.findFragment(p.x, p.y);
    const aufrufe = 1 + Math.floor(R() * 40);
    for (let a = 0; a < aufrufe; a++) {
      const th = FAD[Math.floor(R() * FAD.length)];
      const repVor = Factions["Church of the Machine God"].playerReputation;
      g.charge(af, th); M.chargeOnce(ch[i], th);
      const repNach = Factions["Church of the Machine God"].playerReputation;
      ok(Math.abs((repNach - repVor) - M.churchRep(th, Player.mults.faction_rep, 0)) <= 1e-9 * Math.max(1, repNach), "Kirchenruf");
    }
    ok(af.highestCharge === ch[i].hc && Math.abs(af.numCharge - ch[i].n) < 1e-9, `charge-Zustand seed${seed} frag${p.id}: Spiel ${af.highestCharge}/${af.numCharge} Modell ${ch[i].hc}/${ch[i].n}`);
  });
  // effect je Fragment und calculateMults
  layout.forEach((p, i) => {
    const af = g.findFragment(p.x, p.y);
    const f = M.BY_ID[p.id]; if (f.typ === "Booster") return;
    const grid = M.occupancy(layout, W, H);
    const em = M.calcEffect(ch[i].hc, ch[i].n, f.power, M.boostOf(layout, i, grid, W, H), pow);
    const es = g.effect(af);
    const ab = Math.abs(em - es); maxAb = Math.max(maxAb, ab);
    ok(ab < 1e-12, `effect seed${seed} frag${p.id}: Spiel ${es} Modell ${em}`);
  });
  const ms = g.calculateMults(), mm = M.calcMults(layout, W, H, ch, pow);
  for (const k of Object.keys(mm)) { ok(Math.abs(ms[k] - mm[k]) < 1e-12, `calculateMults ${k} seed${seed}: ${ms[k]} vs ${mm[k]}`); }
  nL++;
}
console.log("(3)(4) Zufallslayouts mit Ladung geprueft:", nL, "| groesste Abweichung effect():", maxAb);
console.log(fehler === 0 ? "EICHUNG GRUEN" : "EICHUNG ROT: " + fehler + " Abweichungen");
process.exit(fehler === 0 ? 0 : 1);
