// Nachbau von Stanek's Gift (Bitburner v3.0.1, reference/v301/src/CotMG) als reiner Code.
// Quellen (Zeilen aus v301):
//   StaneksGift.ts:20-28   baseSize/width/height
//   StaneksGift.ts:30-42   charge()    (highestCharge, numCharge, Kirchenruf)
//   StaneksGift.ts:73-92   effect()    (Booster-Nachbarn, je Nachbar EINMAL)
//   StaneksGift.ts:129-200 calculateMults()
//   formulas/effect.ts:3-12 CalculateEffect
//   Fragment.ts            Formen/Power; fragmente.json ist daraus ERZEUGT (dump-fragmente.mjs)
// Geeicht gegen den echten Spielcode in eich.mjs (zufaellige Layouts, bitgenau).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
export const FRAGMENTE = JSON.parse(fs.readFileSync(path.join(HIER, "fragmente.json"), "utf8")).fragmente;
export const BY_ID = Object.fromEntries(FRAGMENTE.map((f) => [f.id, f]));
export const BASE_SIZE = 9, MAX_SIZE = 25;

/** StaneksGift.ts:20-28 */
export function gridSize(bnExtra, sf13) {
  const base = BASE_SIZE + bnExtra + sf13;
  return {
    w: Math.max(2, Math.min(Math.floor(base / 2 + 1), MAX_SIZE)),
    h: Math.max(3, Math.min(Math.floor(base / 2 + 0.6), MAX_SIZE)),
  };
}

/** Fragment.ts fullAt/width/height - Zellen eines Fragments in Drehung rot (0..3), relativ zur Wurzel. */
export function cellsOf(frag, rot) {
  const sh = frag.shape;
  const W = rot % 2 === 0 ? sh[0].length : sh.length;
  const H = rot % 2 === 0 ? sh.length : sh[0].length;
  const out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let sx = 0, sy = 0, mx = 1, my = 1;
    if (rot === 1) { sx = W - 1; sy = 0; mx = -1; my = 1; }
    else if (rot === 2) { sx = W - 1; sy = H - 1; mx = -1; my = -1; }
    else if (rot === 3) { sx = 0; sy = H - 1; mx = 1; my = -1; }
    let qx = sx + mx * x, qy = sy + my * y;
    if (rot % 2 === 1) [qx, qy] = [qy, qx];
    if (sh[qy][qx]) out.push([x, y]);
  }
  return { cells: out, w: W, h: H };
}

/** formulas/effect.ts:3-12 */
export function calcEffect(highestCharge, numCharge, power, boost, bnPow) {
  return 1 + (Math.log(highestCharge + 1) / 60) * Math.pow((numCharge + 1) / 5, process.env.STANEK_MUT ? 0.08 : 0.07) * power * boost * bnPow;
}

/** StaneksGift.ts:30-37 - Zustand eines Fragments nach einem Aufruf mit `threads` (Faeden x Kernbonus). */
export function chargeOnce(st, threads) {
  if (threads > st.hc) { st.n = (st.hc * st.n) / threads + 1; st.hc = threads; }
  else st.n += threads / st.hc;
  return st;
}
/** Kirchenruf je Aufruf (StaneksGift.ts:40): faction_rep * threads^0.95 * (favor+100) / 1000 */
export const churchRep = (threads, factionRep = 1, favor = 0) => (factionRep * Math.pow(threads, 0.95) * (favor + 100)) / 1000;

/** getCoreBonus (Server/ServerHelpers.ts): 1 + (cores-1)/16 */
export const coreBonus = (cores) => 1 + (cores - 1) / 16;

// --- Layout: Liste von { id, x, y, rot } -------------------------------------------------
export function occupancy(layout, W, H) {
  const grid = Array.from({ length: W }, () => Array(H).fill(-1));
  layout.forEach((p, i) => {
    const { cells } = cellsOf(BY_ID[p.id], p.rot);
    for (const [cx, cy] of cells) grid[p.x + cx][p.y + cy] = i;
  });
  return grid;
}
export function fits(layout, p, W, H) {
  const f = BY_ID[p.id];
  const { cells, w, h } = cellsOf(f, p.rot);
  if (p.x < 0 || p.y < 0 || p.x + w > W || p.y + h > H) return false;
  if (f.limit < 99 && layout.some((q) => q.id === p.id)) return false;
  const grid = occupancy(layout, W, H);
  return cells.every(([cx, cy]) => grid[p.x + cx][p.y + cy] === -1);
}
/** StaneksGift.ts:73-92 - Boost je Fragment: Produkt der Power aller verschiedenen angrenzenden Booster. */
export function boostOf(layout, i, grid, W, H) {
  const p = layout[i];
  const { cells } = cellsOf(BY_ID[p.id], p.rot);
  const nb = new Set();
  for (const [cx, cy] of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = p.x + cx + dx, y = p.y + cy + dy;
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const j = grid[x][y];
    if (j >= 0 && j !== i && BY_ID[layout[j].id].typ === "Booster") nb.add(j);
  }
  let b = 1; for (const j of nb) b *= BY_ID[layout[j].id].power; return b;
}
/** StaneksGift.ts:129-200 calculateMults - nur die Fragmentwirkung, OHNE Genesis. charge[i] = {hc, n}. */
export function calcMults(layout, W, H, charge, bnPow) {
  const m = { hacking_speed: 1, hacking_money: 1, hacking_grow: 1, hacking: 1, hacking_exp: 1,
    strength: 1, strength_exp: 1, defense: 1, defense_exp: 1, dexterity: 1, dexterity_exp: 1,
    agility: 1, agility_exp: 1, charisma: 1, charisma_exp: 1, faction_rep: 1, company_rep: 1,
    work_money: 1, crime_success: 1, crime_money: 1, hacknet_node_money: 1,
    bladeburner_max_stamina: 1, bladeburner_stamina_gain: 1, bladeburner_analysis: 1, bladeburner_success_chance: 1 };
  const grid = occupancy(layout, W, H);
  layout.forEach((p, i) => {
    const f = BY_ID[p.id]; if (f.typ === "Booster") return;
    const c = charge[i] ?? { hc: 0, n: 0 };
    const e = calcEffect(c.hc, c.n, f.power, boostOf(layout, i, grid, W, H), bnPow);
    switch (f.typ) {
      case "HackingSpeed": m.hacking_speed *= e; break;
      case "HackingMoney": m.hacking_money *= e; break;
      case "HackingGrow": m.hacking_grow *= e; break;
      case "Hacking": m.hacking *= e; m.hacking_exp *= e; break;
      case "Strength": m.strength *= e; m.strength_exp *= e; break;
      case "Defense": m.defense *= e; m.defense_exp *= e; break;
      case "Dexterity": m.dexterity *= e; m.dexterity_exp *= e; break;
      case "Agility": m.agility *= e; m.agility_exp *= e; break;
      case "Charisma": m.charisma *= e; m.charisma_exp *= e; break;
      case "Rep": m.company_rep *= e; m.faction_rep *= e; break;
      case "WorkMoney": m.work_money *= e; break;
      case "Crime": m.crime_success *= e; m.crime_money *= e; break;
      case "HacknetMoney": m.hacknet_node_money *= e; break;
      case "Bladeburner": m.bladeburner_max_stamina *= e; m.bladeburner_stamina_gain *= e;
        m.bladeburner_analysis *= e; m.bladeburner_success_chance *= e; break;
      default: break;
    }
  });
  return m;
}

// Stanek's Gift - Genesis (Augmentations.ts:1593-1630): absolute Faktoren auf Spielerwerte.
export const GENESIS = { hacking_speed: 0.9, hacking_money: 0.9, hacking_grow: 0.9, hacking: 0.9, hacking_exp: 0.9,
  strength: 0.9, strength_exp: 0.9, defense: 0.9, defense_exp: 0.9, dexterity: 0.9, dexterity_exp: 0.9,
  agility: 0.9, agility_exp: 0.9, charisma: 0.9, charisma_exp: 0.9, faction_rep: 0.9, company_rep: 0.9,
  work_money: 0.9, crime_success: 0.9, crime_money: 0.9, hacknet_node_money: 0.9 };
/** Awakening/Serenity setzen die Strafe NACH Genesis auf 0.95 bzw. 1 (Augmentations.ts:1631-1700). */
export const strafe = (stufe) => (stufe >= 3 ? 1 : stufe === 2 ? 0.95 : 0.9);

/** Zielfunktion fuer V2: log der Kompetenz-Aenderung (Gewichte aus bbmodel ACTIONS, Abklingen d).
 *  skills = Spielerstufen (ohne Stanek), w/d je Aktion. Gibt Mittel ueber die Aktionen zurueck. */
export function kompetenzLog(mults, strafeF, skills, aktionen) {
  let sum = 0;
  for (const a of aktionen) {
    let alt = 0, neu = 0;
    for (const st of ["hacking", "strength", "defense", "dexterity", "agility", "charisma"]) {
      const w = a.w[st] ?? 0; if (!w) continue;
      const d = a.d[st] ?? 0.9;
      const base = w * Math.pow(skills[st], d);
      const f = (mults[st] ?? 1) * strafeF;
      alt += base; neu += base * Math.pow(f, d);
    }
    const intT = (a.w.intelligence ?? 0) * Math.pow(skills.intelligence, a.d.intelligence ?? 0.9);
    alt += intT; neu += intT;
    sum += Math.log(neu / alt) + Math.log(mults.bladeburner_success_chance);
  }
  return sum / aktionen.length;
}

// --- Suche: einfaches Simulated Annealing ueber Platzierungen --------------------------------
export function mulberry(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function suche({ W, H, bnPow, ziel, erlaubt, h, n, iter = 60000, seed = 1 }) {
  const rnd = mulberry(seed);
  const ids = erlaubt;
  const bewerte = (lay) => {
    const ch = lay.map(() => ({ hc: h, n }));
    return ziel(calcMults(lay, W, H, ch, bnPow));
  };
  let cur = [], curV = bewerte(cur), best = cur, bestV = curV;
  for (let k = 0; k < iter; k++) {
    const T = 0.05 * (1 - k / iter) + 1e-4;
    let nxt = cur.slice();
    const r = rnd();
    if (r < 0.45 || nxt.length === 0) {
      const id = ids[Math.floor(rnd() * ids.length)];
      const p = { id, x: Math.floor(rnd() * W), y: Math.floor(rnd() * H), rot: Math.floor(rnd() * 4) };
      if (!fits(nxt, p, W, H)) continue; nxt.push(p);
    } else if (r < 0.65) { nxt.splice(Math.floor(rnd() * nxt.length), 1); }
    else {
      const i = Math.floor(rnd() * nxt.length); const q = nxt[i]; nxt.splice(i, 1);
      const p = { id: q.id, x: q.x + Math.floor(rnd() * 3) - 1, y: q.y + Math.floor(rnd() * 3) - 1, rot: rnd() < 0.5 ? q.rot : Math.floor(rnd() * 4) };
      if (!fits(nxt, p, W, H)) continue; nxt.push(p);
    }
    const v = bewerte(nxt);
    if (v >= curV || rnd() < Math.exp((v - curV) / T)) { cur = nxt; curV = v; if (v > bestV) { best = nxt; bestV = v; } }
  }
  return { layout: best, wert: bestV };
}
