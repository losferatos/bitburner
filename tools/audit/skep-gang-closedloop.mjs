// Skeptiker P2 (03.10.2026): gang.js-Regler im geschlossenen Kreis.
//
// Frage: Die Sim (gang-sim.mjs) traegt ihren EIGENEN Regler. gang.js ist ein
// zweiter Nachbau desselben Reglers. Liefert der echte Code von gang.js
// (planTasks, phaseOf, shouldAscend - unveraendert importiert) im Motor von
// gang-formulas.mjs dieselbe Rufkurve? Und was passiert bei
//   B) 25 Zyklen je Takt (Offline-Nachholen / gedrosselter Tab):
//      Justice-Faktor wirkt je process()-Aufruf, nicht je Zyklus (Gang.ts:160)
//   C) Einbau mitten im Lauf: Asc-Punkte x0,95 (Prestige.ts:130-143), Stufen
//      fallen, phaseOf ist zustandslos
// Aufruf: node tools/audit/skep-gang-closedloop.mjs [worktree-bitburner-pfad]
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const WT = process.argv[2]
  || "C:/Users/erche/Desktop/claude_projecto/.claude/worktrees/wf_41beb6c5-e41-3/bitburner";
const F = await import(pathToFileURL(path.join(WT, "tools/audit/gang-formulas.mjs")).href);
const src = fs.readFileSync(path.join(WT, "src/gang.js"), "utf8")
  .replace(/^import .*hostdatei\.js";\s*$/m, "");
const tmp = path.join(os.tmpdir(), "skep-gang-pure-" + process.pid + ".mjs");
fs.writeFileSync(tmp, src);
const G = await import(pathToFileURL(tmp).href);
fs.unlinkSync(tmp);

function run({ hours = 14, cycles = 10, installAtH = null, label }) {
  const gang = { respect: 1, wanted: 1, territory: 1 / 7, members: [] };
  let rep = 0, asc = 0, nameCtr = 0, flipsAfterInstall = 0, ascAfterInstall = 0, installed = false;
  const stepS = cycles * 0.2;
  const steps = Math.round(hours * 3600 / stepS);
  const targets = [1e5, 4.375e5, 7.5e5, 1.25e6, 2.5e6];
  const hit = {};
  let minPen = 1, vigSteps = 0;
  for (let step = 0; step < steps; step++) {
    const tH = step * stepS / 3600;
    if (installAtH !== null && !installed && tH >= installAtH) {
      const before = new Map(gang.members.map((m) => [m.name, G.phaseOf(m.lvl)]));
      F.installPenalty(gang);
      for (const m of gang.members) if (before.get(m.name) === "work" && G.phaseOf(m.lvl) === "train") flipsAfterInstall++;
      installed = true;
      rep = rep; // Ruf der Faktion faellt im Spiel auf 0; hier kumuliert gezaehlt
    }
    // gang.js: info zuerst (Respekt VOR Aufstieg)
    const info = { respect: gang.respect, wantedLevel: gang.wanted,
      wantedPenalty: F.wantedPenalty({ respect: gang.respect, wantedLevel: gang.wanted }), territory: gang.territory };
    // Rekrutieren
    while (gang.members.length < 12 && gang.respect >= F.respectForNextRecruit(gang.members.length)) {
      gang.members.push(F.newMember("G" + (++nameCtr)));
    }
    const mem = gang.members.map((m) => ({ name: m.name, task: m.task, lvl: { ...m.lvl }, ascended: false, ref: m }));
    for (const x of mem) {
      const phase = G.phaseOf(x.lvl);
      const r = F.ascensionResult(x.ref);
      const can = F.STATS.some((s) => F.ascPointsGain(x.ref.exp[s]) > 0);
      if (!can) continue;
      if (!G.shouldAscend(phase, r)) continue;
      F.ascend(gang, x.ref);
      x.ascended = true; asc++;
      if (installed) ascAfterInstall++;
    }
    const plan = G.planTasks(info, mem);
    for (const x of mem) x.ref.task = plan.assign[x.name];
    if (plan.justice > 0) vigSteps++;
    // processGains (Gang.ts:125-169), ein Aufruf je Takt mit `cycles` Zyklen
    const Gs = { respect: gang.respect, territory: gang.territory, wantedLevel: gang.wanted };
    let respTot = 0, wantedPC = 0, justice = 0;
    for (const m of gang.members) {
      const t = F.TASKS[m.task];
      const er = F.respectGain(Gs, m.lvl, t, 1) * cycles;
      m.earnedRespect += er; respTot += er;
      wantedPC += F.wantedGain(Gs, m.lvl, t);
      if (t.baseWanted < 0) justice++;
    }
    gang.respect += respTot;
    rep += (1.3280548527604765 * respTot) / 75;
    if (gang.wanted !== 1 || wantedPC >= 0) {
      const old = gang.wanted;
      gang.wanted = (old + wantedPC * cycles) * (1 - justice * 0.001);
      if (gang.wanted < 1 || (wantedPC <= 0 && gang.wanted > old)) gang.wanted = 1;
    }
    for (const m of gang.members) {
      const ge = F.expGain(m, F.TASKS[m.task], cycles);
      if (ge) for (const s of F.STATS) m.exp[s] += ge[s];
      F.updateSkills(m);
    }
    const pen = F.wantedPenalty({ respect: gang.respect, wantedLevel: gang.wanted });
    if (tH > 2) minPen = Math.min(minPen, pen);
    for (const t of targets) if (hit[t] === undefined && rep >= t) hit[t] = +tH.toFixed(3);
  }
  console.log(label.padEnd(44), "h bis 100k/437k/750k/1,25M/2,5M:",
    targets.map((t) => hit[t] ?? "-").join(" / "),
    "| Aufstiege", asc, "| min Abzug(>2h)", minPen.toFixed(3),
    "| Vigilante-Takte", (100 * vigSteps / steps).toFixed(1) + "%",
    installAtH !== null ? "| work->train durch Einbau " + flipsAfterInstall + ", Aufstiege danach " + ascAfterInstall : "");
}

run({ label: "A gang.js-Regler, 10 Zyklen/Takt" });
run({ label: "B gang.js-Regler, 25 Zyklen/Takt (Nachholen)", cycles: 25 });
run({ label: "C wie A, Einbau bei 6 h", installAtH: 6 });
run({ label: "C2 wie A, Einbau bei 8 h", installAtH: 8 });
