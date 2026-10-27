// Gekettetes Replay: Kampfwerte und Bladeburner-Skills laufen als gemessene Kurve (BN14.3,
// Backups), Rang/Stufen/Erfolge werden vom Rangmodell (tools/bbrank) fortgeschrieben.
// Gegenprobe: Zeit bis Rang 400.000 mit c = 1 gegen gemessen (22,2 h). Danach Szenarien.
// Aufruf: node nodes/bau-2026-10-27-stanek/chain.mjs [tag] [c] [bbChance] [bbStamina]
import zlib from "node:zlib"; import fs from "node:fs"; import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "../..");
const U = (p) => pathToFileURL(path.join(ROOT, p)).href;
const M = await import(U("tools/bbrank/bbmodel.mjs"));
const S = await import(U("tools/bbrank/sim.mjs"));
export async function lade(tag) {
  const rows = fs.readFileSync(path.join(ROOT, "backups/INDEX.tsv"), "utf8").trim().split("\n").slice(1)
    .map((l) => l.split("\t")).filter((r) => r[3] && (r[4] + "L" + r[5]) === tag);
  const st = [];
  for (const r of rows) {
    const f = path.join(ROOT, "backups", r[1]); if (!fs.existsSync(f)) continue;
    const o = JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString("utf8"));
    const P = JSON.parse(o.data.PlayerSave).data; const b = P.bladeburner?.data; if (!b) continue;
    st.push({ h: P.playtimeSinceLastBitnode / 3.6e6, P, b });
  }
  return st;
}
const OPS = ["Tracking", "Bounty Hunter", "Retirement", "Investigation", "Undercover Operation", "Sting Operation", "Raid", "Stealth Retirement Operation", "Assassination"];
const lerp = (a, b, t) => a + (b - a) * t;
export function kette(st, { c = 1, fk = null, bbChance = 1, bbStamina = 1, bnRank = 0.6, zielRang = 4e5, dt = 0.25, ab = 0 }) {
  const a0 = st[ab];
  let rank = a0.b.rank, stamina = a0.b.stamina;
  const levels = {}, succ = {};
  for (const n of OPS) { const d = { ...a0.b.contracts, ...a0.b.operations }[n].data; levels[n] = d.level; succ[n] = d.successes; }
  // Hinter dem letzten Stand werden die Werte festgehalten (Obergrenze 200 h Knotenzeit).
  let t = a0.h; const tEnd = Math.max(200, st[st.length - 1].h);
  while (t < tEnd - 1e-9 && rank < zielRang) {
    let i = 0; while (i + 2 < st.length && st[i + 1].h <= t) i++;
    const A = st[i], B = st[Math.min(i + 1, st.length - 1)];
    const f = B.h === A.h ? 1 : Math.min(1, Math.max(0, (t + dt / 2 - A.h) / (B.h - A.h)));
    const sk = {};
    for (const k of Object.keys(A.P.skills)) sk[k] = lerp(A.P.skills[k], B.P.skills[k], f);
    for (const k of ["strength", "defense", "dexterity", "agility"]) sk[k] *= (fk ? (fk[k] ?? 1) : c);
    if (fk) { sk.hacking *= (fk.hacking ?? 1); sk.charisma *= (fk.charisma ?? 1); }
    const city = A.b.cities[A.b.city].data;
    const cityB = B.b.cities[B.b.city].data;
    const r = S.simulate({
      skills: sk, bbSkills: A.b.skills, levels, successes: succ, rank,
      env: { pop: lerp(city.pop, cityB.pop, f), comms: Math.max(1, lerp(city.comms, cityB.comms, f)), chaos: Math.min(city.chaos, cityB.chaos),
        teamCount: 0, bbSuccessMult: lerp(A.P.mults.bladeburner_success_chance, B.P.mults.bladeburner_success_chance, f) * bbChance },
      bnRankMult: bnRank, hours: dt, policy: "greedy", stamina, staminaBonus: A.b.staminaBonus,
    });
    rank = r.rank; Object.assign(levels, r.lvl); Object.assign(succ, r.succ);
    stamina = r.trace ? stamina : stamina; // Ausdauer pro Segment frisch auf Maximum (Naeherung)
    stamina = undefined;
    t += dt;
  }
  return { t, rank };
}
if (process.argv[1] && process.argv[1].endsWith("chain.mjs")) {
  const tag = process.argv[2] || "14L3";
  const c = Number(process.argv[3] || 1), bbc = Number(process.argv[4] || 1), bbs = Number(process.argv[5] || 1);
  const st = await lade(tag);
  const abP2 = st.findIndex((s) => s.h > 12.5);
  for (const [name, ab] of [["ab Beginn P1", 0], ["ab Einbau (P2)", abP2]]) {
    const r = kette(st, { c, bbChance: bbc, bbStamina: bbs, ab });
    console.log(name.padEnd(16), "c=" + c, "bb=" + bbc, "-> Rang", Math.round(r.rank), "bei h", r.t.toFixed(2), "(Startstand h" + st[ab].h.toFixed(1) + ")");
  }
}
