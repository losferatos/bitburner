// Hebel-Vorlage 06.10.2026: Black-Op-Chancen aus einem Spielstand nach der Formel in src/blade.js blackOpChance
// (= Action.ts:169-196), Daten BLACKOP_DATEN/SKILL_WIRKUNG direkt aus src/blade.js gelesen. Nur lesen.
// Export: boData, chances(save-objekt, {statMult, extra}) ; CLI: node chance.mjs <save.json.gz...>
import fs from "node:fs"; import zlib from "node:zlib"; import path from "node:path"; import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const src = fs.readFileSync(path.join(root, "src/blade.js"), "utf8");
const grab = (name) => { const i = src.indexOf("const " + name + " = {"); let d = 0, j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) { if (src[k] === "{") d++; else if (src[k] === "}") { d--; if (!d) return eval("(" + src.slice(j, k + 1) + ")"); } } };
export const BO = grab("BLACKOP_DATEN"); export const SW = grab("SKILL_WIRKUNG");
const g = (o) => (o && o.data) || o || {};
export function load(file) { const s = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8")); return s; }
export function state(s) {
  const p = JSON.parse(s.data.PlayerSave).data; const bb = g(p.bladeburner); const sk = g(bb.skills);
  const bbs = sk.data ? Object.fromEntries(sk.data) : sk;
  return { p, bb, bbs, skills: p.skills, exp: p.exp, mults: p.mults, rank: bb.rank, bo: bb.numBlackOpsComplete,
    stam: [bb.stamina, bb.maxStamina], aug: p.playtimeSinceLastAug / 3.6e6 };
}
// opts.skills / opts.bbs ueberschreiben; opts.k multipliziert die Kampfwerte (str/def/dex/agi), opts.cm = Chance-Mult extra
export function chance(st, name, opts = {}) {
  const a = BO[name]; const bbs = opts.bbs || st.bbs; const sk = opts.skills || st.skills;
  const mult = {}; for (const [skill, w] of Object.entries(SW)) { const L = bbs[skill] || 0; if (!L) continue;
    for (const [was, b] of Object.entries(w)) mult[was] = (mult[was] ?? 1) * (1 + b * L / 100); }
  const m = (w) => mult[w] ?? 1; const sm = opts.statMult ?? 1;
  const eff = { hacking: sk.hacking, strength: sk.strength * sm * m("EffStr"), defense: sk.defense * sm * m("EffDef"),
    dexterity: sk.dexterity * sm * m("EffDex"), agility: sk.agility * sm * m("EffAgi"), charisma: sk.charisma * m("EffCha"), intelligence: sk.intelligence };
  let c = 0; for (const s of Object.keys(a.weights)) if (a.weights[s]) c += a.weights[s] * Math.pow(eff[s], a.decays[s]);
  c *= 1 + 0.75 * Math.pow(sk.intelligence, 0.8) / 600;
  c *= opts.fullStamina ? 1 : Math.min(1, st.stam[0] / (0.5 * st.stam[1]));
  c *= m("SuccessChanceAll") * m("SuccessChanceOperation");
  if (a.isStealth) c *= m("SuccessChanceStealth"); if (a.isKill) c *= m("SuccessChanceKill");
  c *= (st.mults.bladeburner_success_chance ?? 1) * (opts.cm ?? 1);
  return c / a.baseDifficulty;   // ungeklemmt
}
if ((process.argv[1] || "").endsWith("chance.mjs")) {
  for (const f of process.argv.slice(2)) {
    const st = state(load(f));
    const names = Object.keys(BO).slice(st.bo);
    console.log(path.basename(f), "hAug", st.aug.toFixed(2), "Rang", Math.round(st.rank), "BO", st.bo, "SP-Stufen", JSON.stringify(st.bbs));
    console.log("  ", names.map((n) => n.replace("Operation ", "") + " " + chance(st, n, { fullStamina: true }).toFixed(3)).join(", "));
  }
}
