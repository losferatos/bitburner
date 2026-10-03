// Abschreibpruefung: laeuft der ORIGINAL-Quelltext des Spiels
// (Gang/formulas/formulas.ts, Gang/data/tasks.ts, GangMember.calculateSkill)
// per Node-Typ-Stripping und vergleicht ihn mit dem Nachbau in
// gang-formulas.mjs ueber Zufallseingaben.
//
// Das ist KEINE Eichung gegen einen Spielstand (es gibt in keinem Backup eine
// Gang - AllGangsSave ist leer, Player.gang null), sondern der Beweis, dass
// der Nachbau den Spielcode Wort fuer Wort trifft. Die Eichung der
// Dynamik (Wachstum ueber Stunden) bleibt offen.
//
// Aufruf: node tools/audit/gang-check.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as F from "./gang-formulas.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const SRC = path.join(ROOT, "reference", "bitburner-src", "src", "Gang");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "gangcheck-"));

// 1) formulas.ts: Importzeilen ersetzen, sonst unveraendert
const fBody = fs.readFileSync(path.join(SRC, "formulas", "formulas.ts"), "utf8").split("\n").filter((l) => !l.startsWith("import ")).join("\n");
fs.writeFileSync(path.join(TMP, "formulas_orig.ts"),
  // Getter, damit der BN-Multiplikator je Vergleich gesetzt werden kann
  "const currentNodeMults = { get GangSoftcap() { return (globalThis as any).__softcap ?? 1; } };\n"
  + "type GangMember = any; type GangMemberTask = any;\n" + fBody);
// 2) tasks.ts: Enum-Verweise durch die Namen aus Enums.ts ersetzen
const enumSrc = fs.readFileSync(path.join(SRC, "Enums.ts"), "utf8");
const enumMap = {};
for (const m of enumSrc.matchAll(/(\w+):\s*"([^"]+)"/g)) enumMap[m[1]] = m[2];
let tBody = fs.readFileSync(path.join(SRC, "data", "tasks.ts"), "utf8").split("\n").filter((l) => !l.startsWith("import ")).join("\n");
tBody = tBody.replace(/GangTaskNameEnum\.(\w+)/g, (_, k) => JSON.stringify(enumMap[k]));
fs.writeFileSync(path.join(TMP, "tasks_orig.ts"), "type GangTaskName = string; type ITaskParams = any;\n" + tBody);
// 3) GangMember.calculateSkill als Text herausloesen
const gm = fs.readFileSync(path.join(SRC, "GangMember.ts"), "utf8");
const skillSrc = gm.match(/calculateSkill\(exp: number, mult = 1\): number \{([\s\S]*?)\n  \}/)[1];
fs.writeFileSync(path.join(TMP, "skill_orig.ts"), "export function calculateSkill(exp: number, mult = 1): number {" + skillSrc + "\n}\n");

const O = await import(pathToFileURL(path.join(TMP, "formulas_orig.ts")).href);
const OT = await import(pathToFileURL(path.join(TMP, "tasks_orig.ts")).href);
const OS = await import(pathToFileURL(path.join(TMP, "skill_orig.ts")).href);

let fails = 0, checks = 0;
function eq(a, b, what) {
  checks++;
  const ok = (a === b) || (Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b)));
  if (!ok) { fails++; if (fails < 10) console.log("ABWEICHUNG", what, a, b); }
}

// Aufgaben-Parameter
const origTasks = {};
for (const e of OT.gangMemberTasksMetadata) origTasks[e.name] = e;
for (const [name, t] of Object.entries(F.TASKS)) {
  const o = origTasks[name];
  if (!o) { fails++; console.log("FEHLT im Original:", name); continue; }
  const p = o.params;
  eq(t.baseRespect, p.baseRespect || 0, name + ".baseRespect");
  eq(t.baseWanted, p.baseWanted || 0, name + ".baseWanted");
  eq(t.baseMoney, p.baseMoney || 0, name + ".baseMoney");
  eq(t.difficulty, p.difficulty || 1, name + ".difficulty");
  for (const s of F.STATS) eq(t.w[s], p[s + "Weight"] || 0, name + "." + s + "Weight");
  const terr = p.territory || { money: 1, respect: 1, wanted: 1 };
  for (const k of ["money", "respect", "wanted"]) eq(t.territory[k], terr[k], name + ".territory." + k);
  eq(+t.isHacking, +o.isHacking, name + ".isHacking"); eq(+t.isCombat, +o.isCombat, name + ".isCombat");
}
if (Object.keys(origTasks).length !== Object.keys(F.TASKS).length) { fails++; console.log("Anzahl Aufgaben weicht ab"); }

// Formeln ueber Zufallseingaben (deterministischer Zufall)
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
for (const softcap of [1, 0.9, 0.7, 0.3, 0]) {
  globalThis.__softcap = softcap;
  for (let i = 0; i < 4000; i++) {
    const g = { respect: Math.exp(rnd() * 20), territory: rnd() < 0.3 ? 1 / 7 : rnd(), wantedLevel: 1 + Math.exp(rnd() * 12) };
    const lv = {}; for (const s of F.STATS) lv[s] = Math.floor(1 + Math.exp(rnd() * 8));
    const task = Object.values(F.TASKS)[Math.floor(rnd() * Object.keys(F.TASKS).length)];
    const o = origTasks[task.name];
    const oTask = { ...Object.fromEntries(F.STATS.map((s) => [s + "Weight", o.params[s + "Weight"] || 0])),
      baseRespect: o.params.baseRespect || 0, baseWanted: o.params.baseWanted || 0, baseMoney: o.params.baseMoney || 0,
      difficulty: o.params.difficulty || 1, territory: o.params.territory || { money: 1, respect: 1, wanted: 1 } };
    eq(F.respectGain(g, lv, task, softcap), O.calculateRespectGain(g, lv, oTask), "respect " + task.name);
    eq(F.wantedGain(g, lv, task), O.calculateWantedLevelGain(g, lv, oTask), "wanted " + task.name);
    eq(F.moneyGain(g, lv, task, softcap), O.calculateMoneyGain(g, lv, oTask), "money " + task.name);
    eq(F.wantedPenalty(g), O.calculateWantedPenalty(g), "penalty");
  }
}
for (let i = 0; i < 2000; i++) {
  const p = Math.exp(rnd() * 25), e = Math.exp(rnd() * 25), mu = rnd() * 50;
  eq(F.ascMult(p), O.calculateAscensionMult(p), "ascMult");
  eq(F.ascPointsGain(e), O.calculateAscensionPointsGain(e), "ascPoints");
  eq(F.calculateSkill(e, mu), OS.calculateSkill(e, mu), "calculateSkill");
}
console.log(`Abschreibpruefung: ${checks} Vergleiche, ${fails} Abweichungen -> ${fails === 0 ? "OK" : "FEHLER"}`);
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(fails ? 1 : 0);
