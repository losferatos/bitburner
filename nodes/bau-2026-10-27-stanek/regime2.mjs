// Ungeklemmte Chance (comp/difficulty) der Rang-Aktionen je Stundenstand: wo ist die Chance
// < 1 (Skalierung mit Stanek wirkt linear), wo ist sie gesaettigt (Reserve = Faktor u)?
import zlib from "node:zlib"; import fs from "node:fs"; import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "../..");
const M = await import(pathToFileURL(path.join(ROOT, "tools/bbrank/bbmodel.mjs")).href);
const { ACTIONS, skillMultipliers, difficultyOf, effSkill, intBonus, C } = M;
const tag = process.argv[2] || "14L3";
const bo = JSON.parse(fs.readFileSync(path.join(ROOT, "src/lib/blackops.json"), "utf8")).ops;
const BOBASE = [2000,2500,3000,4000,5000,6000,8000,10000,12000,15000,20000,25000,30000,35000,40000,45000,50000,55000,60000,70000,80000]; // Platzhalter, unten aus Quelle gelesen
const src = fs.readFileSync(path.join(ROOT, "reference/v301/src/Bladeburner/data/BlackOperations.ts"), "utf8");
const bases = [...src.matchAll(/baseDifficulty:\s*([0-9e.]+)/g)].map((m) => Number(m[1]));
const rows = fs.readFileSync(path.join(ROOT, "backups/INDEX.tsv"), "utf8").trim().split("\n").slice(1)
  .map((l) => l.split("\t")).filter((c) => c[3] && (c[4] + "L" + c[5]) === tag);
function unclamped(a, level, sk, m, env, kind) {
  let difficulty = a.baseDifficulty ?? difficultyOf(a, level);
  let comp = 0;
  for (const st of Object.keys(sk)) comp += (a.w[st] ?? 0) * Math.pow(effSkill(sk, m, st), a.d[st] ?? 0.9);
  comp *= intBonus(sk.intelligence, 0.75);
  comp *= Math.min(1, env.stamina / (0.5 * env.maxStamina));
  if (a.kind === "O") comp *= Math.pow((env.teamCount ?? 0) + 1, 0.05);
  comp *= Math.pow(env.pop / C.PopulationThreshold, C.PopulationExponent);
  if (env.chaos > C.ChaosThreshold) difficulty *= Math.pow(1 + (env.chaos - C.ChaosThreshold), 0.5);
  comp *= (m.SuccessChanceAll ?? 1);
  if (a.kind === "C") comp *= (m.SuccessChanceContract ?? 1);
  if (a.kind === "O") comp *= (m.SuccessChanceOperation ?? 1);
  if (a.stealth) comp *= (m.SuccessChanceStealth ?? 1);
  if (a.kill) comp *= (m.SuccessChanceKill ?? 1);
  comp *= env.bbSuccessMult ?? 1;
  return comp / difficulty;
}
for (const c of rows) {
  const f = path.join(ROOT, "backups", c[1]); if (!fs.existsSync(f)) continue;
  const o = JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString("utf8"));
  const P = JSON.parse(o.data.PlayerSave).data; const b = P.bladeburner?.data; if (!b) continue;
  const h = (P.playtimeSinceLastBitnode / 3.6e6).toFixed(1);
  const m = skillMultipliers(b.skills);
  const city = b.cities[b.city].data;
  const env = { pop: city.pop, comms: city.comms, chaos: city.chaos, stamina: b.maxStamina, maxStamina: b.maxStamina, bbSuccessMult: P.mults.bladeburner_success_chance, teamCount: 0 };
  const sk = P.skills;
  const out = [];
  for (const n of ["Raid", "Stealth Retirement Operation", "Assassination"]) {
    const d = b.operations[n].data;
    const u = unclamped(ACTIONS[n], d.level, sk, m, env);
    out.push(n.replace("Stealth Retirement Operation", "SRO").slice(0, 6) + " L" + d.level + " u" + u.toFixed(2));
  }
  // naechste Black Op
  const nb = b.numBlackOpsComplete;
  if (nb < 21) {
    const o2 = bo[nb];
    const a = { baseDifficulty: bases[nb], kind: "B", w: o2.weights, d: o2.decays, stealth: false, kill: false };
    const u = unclamped(a, 1, sk, m, env);
    out.push("BO#" + (nb + 1) + " " + o2.name.replace("Operation", "").slice(0, 8) + " rang" + o2.rang + " u" + u.toFixed(2));
  }
  console.log(c[7].slice(0, 6), "h" + h.padStart(5), "rank", String(Math.round(b.rank)).padStart(6), "|", out.join("  "));
}
