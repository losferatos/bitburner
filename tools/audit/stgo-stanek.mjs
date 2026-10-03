// Audit 03.10.2026, Bereich STGO: Stanek's Gift fuer V2-Knoten.
//
// Formeln 1:1 aus reference/bitburner-src/src (3.0.2):
//   Gittergroesse           CotMG/StaneksGift.ts:22-31, data/Constants.ts (BaseSize 9, MaxSize 25)
//   Ladung                  CotMG/StaneksGift.ts:33-44 (highestCharge/numCharge, Kirchen-Rep)
//   Wirkung                 CotMG/formulas/effect.ts:3-12, Booster StaneksGift.ts:64-81
//   Fragmente/Formen        CotMG/Fragment.ts:93-375, data/Shapes.ts, Drehung Fragment.ts:24-53
//   Wirkungsziele           CotMG/StaneksGift.ts:135-204
//   Genesis-Malus 0,9       Augmentation/Augmentations.ts:1593-1630
//   Laden: 1 s je Aufruf (200 ms im Bonus), Faeden*Kernbonus  NetscriptFunctions/Stanek.ts:32-57
//   BN-Multiplikatoren      BitNode/BitNode.tsx (BN13 :1033-1034, BN15 :1113-1114, BN8 :792)
//
// NICHT GEEICHT: kein Spielstand hat je Stanek (StaneksGiftSave.fragments = 0 in
// allen geprueften Staenden). Die Uebersetzung Stufen-Mult -> Chance ist in
// stgo-blade.mjs geeicht.
//
// Aufruf: node tools/audit/stgo-stanek.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadState, blackOpChance, TYPHOON, skillsWithCombatFactor, calculateExp } from "./stgo-blade.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function gridSize(extraSize, sf13) {
  const base = 9 + extraSize + sf13;
  return {
    base,
    w: Math.max(2, Math.min(Math.floor(base / 2 + 1), 25)),
    h: Math.max(3, Math.min(Math.floor(base / 2 + 0.6), 25)),
  };
}

export function effect(highestCharge, numCharge, power, boost, bnPower) {
  return 1 + (Math.log(highestCharge + 1) / 60) * Math.pow((numCharge + 1) / 5, 0.07) * power * boost * bnPower;
}

// Formen (Shapes.ts) und Fragmente (Fragment.ts)
const _ = false, X = true;
const SH = {
  L: [[_, _, X], [X, X, X]],
  J: [[X, _, _], [X, X, X]],
  S: [[_, X, X], [X, X, _]],
  Z: [[X, X, _], [_, X, X]],
  T: [[X, X, X], [_, X, _]],
};
const FR = {
  str: { shape: SH.T, power: 2 }, // id 10
  def: { shape: SH.L, power: 2 }, // id 12
  dex: { shape: SH.L, power: 2 }, // id 14
  agi: { shape: SH.S, power: 2 }, // id 16
  blade: { shape: SH.S, power: 0.4 }, // id 30
  cha: { shape: SH.S, power: 3 }, // id 18
  boost100: { shape: [[_, X, X], [X, X, _], [_, X, _]], power: 1.1, booster: true },
  boost107: { shape: [[_, X, _], [X, X, X], [_, X, _]], power: 1.1, booster: true },
};

// Fragment.ts:24-53 fullAt mit Drehung
function width(shape, rot) { return rot % 2 === 0 ? shape[0].length : shape.length; }
function height(shape, rot) { return rot % 2 === 0 ? shape.length : shape[0].length; }
function fullAt(shape, x, y, rot) {
  if (y < 0 || x < 0 || y >= height(shape, rot) || x >= width(shape, rot)) return false;
  let [sx, sy, mx, my] = [0, 0, 1, 1];
  if (rot === 1) [sx, sy, mx, my] = [width(shape, rot) - 1, 0, -1, 1];
  else if (rot === 2) [sx, sy, mx, my] = [width(shape, rot) - 1, height(shape, rot) - 1, -1, -1];
  else if (rot === 3) [sx, sy, mx, my] = [0, height(shape, rot) - 1, 1, -1];
  let [qx, qy] = [sx + mx * x, sy + my * y];
  if (rot % 2 === 1) [qx, qy] = [qy, qx];
  return shape[qy][qx];
}
function cells(shape, rot, ox, oy) {
  const out = [];
  for (let y = 0; y < height(shape, rot); y++) for (let x = 0; x < width(shape, rot); x++) if (fullAt(shape, x, y, rot)) out.push([ox + x, oy + y]);
  return out;
}

/**
 * Vollsuche: alle Kernfragmente platzieren (canPlace-Regeln StaneksGift.ts:83-93),
 * dann so viele Booster wie moeglich, Ziel = Summe der Booster-Nachbarschaften
 * auf Kernfragmenten (StaneksGift.ts:64-81: jeder angrenzende Booster x1,1, je
 * Booster nur einmal gezaehlt). Kleine Gitter -> Tiefensuche reicht.
 */
export function bestLayout(W, H, core, boosterTypes = ["boost100", "boost107"], maxBoosters = 3) {
  const placements = (name) => {
    const f = FR[name];
    const out = [];
    for (let rot = 0; rot < 4; rot++) {
      const w = width(f.shape, rot), h = height(f.shape, rot);
      for (let x = 0; x + w <= W; x++) for (let y = 0; y + h <= H; y++) out.push({ name, rot, x, y, cells: cells(f.shape, rot, x, y) });
    }
    return out;
  };
  const occ = Array.from({ length: W }, () => Array(H).fill(null));
  let best = null;
  const placed = [];
  const fits = (pl) => pl.cells.every(([x, y]) => occ[x][y] === null);
  const put = (pl, v) => pl.cells.forEach(([x, y]) => (occ[x][y] = v));
  const score = () => {
    // Nachbarzellen je Kernfragment
    let s = 0;
    const per = {};
    for (const pc of placed.filter((p) => !FR[p.name].booster)) {
      const mine = new Set(pc.cells.map((c) => c.join(",")));
      const nb = new Set();
      for (const [x, y] of pc.cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${x + dx},${y + dy}`;
        if (!mine.has(k)) nb.add(k);
      }
      const boosters = new Set();
      for (const k of nb) {
        const [x, y] = k.split(",").map(Number);
        if (x >= 0 && y >= 0 && x < W && y < H && occ[x][y] !== null && FR[placed[occ[x][y]].name].booster) boosters.add(occ[x][y]);
      }
      per[pc.name] = boosters.size;
      s += boosters.size;
    }
    return { s, per };
  };
  const coreLists = core.map(placements);
  const boostLists = boosterTypes.map(placements);
  let nodes = 0;
  function addBoosters(start, count) {
    const sc = score();
    if (!best || sc.s > best.s) best = { s: sc.s, per: sc.per, layout: placed.map((p) => `${p.name}@(${p.x},${p.y})r${p.rot}`) };
    if (count >= maxBoosters || nodes > 2e6) return;
    const all = boostLists.flat();
    for (let i = start; i < all.length; i++) {
      const pl = all[i];
      if (!fits(pl)) continue;
      nodes++;
      placed.push(pl); put(pl, placed.length - 1);
      addBoosters(i + 1, count + 1);
      put(pl, null); placed.pop();
    }
  }
  let coreFound = false;
  function addCore(i) {
    if (nodes > 2e6) return;
    if (i === coreLists.length) { coreFound = true; addBoosters(0, 0); return; }
    for (const pl of coreLists[i]) {
      if (!fits(pl)) continue;
      nodes++;
      placed.push(pl); put(pl, placed.length - 1);
      addCore(i + 1);
      put(pl, null); placed.pop();
    }
  }
  addCore(0);
  return { coreFound, best, searched: nodes };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  console.log("1) Gittergroesse (StaneksGift.ts:22-31)");
  const cases = [
    ["BN13.1 (SF13=0, Extra +1, Power 2)", 1, 0, 2],
    ["BN13.2 (SF13=1)", 1, 1, 2],
    ["BN13.3 (SF13=2)", 1, 2, 2],
    ["BN15 mit SF13.3 (Extra -2, Power 0,7)", -2, 3, 0.7],
    ["BN8 mit SF13.3 (Extra -99, Power 1)", -99, 3, 1],
    ["BN2 (nur Referenz; Stanek erst mit SF13)", -6, 3, 2],
  ];
  for (const [n, ex, sf, pw] of cases) {
    const g = gridSize(ex, sf);
    console.log(`   ${n.padEnd(44)} base ${g.base}  ${g.w} x ${g.h} = ${g.w * g.h} Zellen  PowerMult ${pw}`);
  }

  console.log("\n2) Passt der V2-Satz (str T, def L, dex L, agi S, blade S) + Booster? (Vollsuche)");
  for (const [n, W, H] of [["BN13.1/BN15 6x5", 6, 5], ["BN13.2 6x6", 6, 6], ["BN13.3 7x6", 7, 6], ["BN8 2x3", 2, 3]]) {
    const r = bestLayout(W, H, ["str", "def", "dex", "agi", "blade"], ["boost100", "boost107"], 2);
    console.log(`   ${n.padEnd(18)} Kernsatz passt: ${r.coreFound}  beste Booster-Kontakte ${r.best?.s ?? "-"} ${r.best ? JSON.stringify(r.best.per) : ""}  (${r.searched} Knoten)`);
    if (r.best) console.log(`      ${r.best.layout.join("  ")}`);
  }

  console.log("\n3) Wirkung eines Kampf-Fragments (power 2) und des Bladeburner-Fragments (0,4), N = 200 Ladungen, ohne Booster");
  const T = [8, 30, 60, 250, 1000, 5000, 20000];
  console.log("   Faeden (2,0 GB je Faden)      " + T.map((t) => String(t).padStart(8)).join(""));
  for (const [n, pw] of [["BN13 (x2)", 2], ["BN15 (x0,7)", 0.7]]) {
    const comb = T.map((t) => effect(t, 200, 2, 1, pw));
    const blade = T.map((t) => effect(t, 200, 0.4, 1, pw));
    console.log(`   ${n.padEnd(12)} Kampf   brutto ` + comb.map((v) => ("x" + v.toFixed(3)).padStart(8)).join(""));
    console.log(`   ${"".padEnd(12)} Kampf   netto  ` + comb.map((v) => ("x" + (0.9 * v).toFixed(3)).padStart(8)).join(""));
    console.log(`   ${"".padEnd(12)} Blade   chance ` + blade.map((v) => ("x" + v.toFixed(3)).padStart(8)).join(""));
  }
  // Break-even gegen den Genesis-Malus 0,9 (Kampf-Stufe und -Exp)
  for (const [n, pw] of [["BN13", 2], ["BN15", 0.7]]) {
    let t = 0;
    while (0.9 * effect(t, 200, 2, 1, pw) < 1 && t < 1e7) t++;
    console.log(`   Break-even Kampf-Fragment ${n}: ${t} Faden (N=200)`);
  }

  console.log("\n4) Typhoon-Chance-Faktor (geeichte Kette, Spielstand BN2.1 als Stellvertreter)");
  const { p, bb } = loadState(path.join(root, "backups", "LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz"));
  const team = bb.blackOperations?.["Operation Typhoon"]?.data?.teamCount ?? 0;
  const c0 = blackOpChance(TYPHOON, p.skills, bb.skills, p.mults, bb.maxStamina, bb.maxStamina, team);
  for (const [n, pw] of [["BN13", 2], ["BN15", 0.7]]) {
    for (const t of [30, 250, 1000, 5000]) {
      const fC = 0.9 * effect(t, 200, 2, 1, pw);
      const fB = effect(t, 200, 0.4, 1, pw);
      const s = skillsWithCombatFactor(p, fC);
      const c = blackOpChance(TYPHOON, s, bb.skills, { ...p.mults, bladeburner_success_chance: fB }, bb.maxStamina, bb.maxStamina, team);
      console.log(`   ${n} ${String(t).padStart(5)} Faeden: Kampf netto x${fC.toFixed(3)}, Blade x${fB.toFixed(3)} -> Chance x${(c / c0).toFixed(3)}`);
    }
  }

  console.log("\n5) Kirchen-Rep je Ladung (StaneksGift.ts:41-42) und Zeit bis Awakening (1e6) bei 1 Ladung/s je Fragment, 5 Fragmente parallel");
  for (const t of [30, 250, 1000, 5000]) {
    const repPerCharge = (0.9 * 1.33 * Math.pow(t, 0.95) * (0 + 100)) / 1000; // faction_rep ~1,33 * 0,9 Genesis, favor 0
    const h = 1e6 / (repPerCharge * 5) / 3600;
    console.log(`   ${String(t).padStart(5)} Faeden je Fragment: ${repPerCharge.toFixed(1)} Rep/Ladung -> Awakening nach ${h.toFixed(1)} h`);
  }
}
