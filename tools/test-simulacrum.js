/**
 * Simulacrum-Parallelarbeit (Befund B5, 07.10.2026).
 *
 * Mit `The Blade's Simulacrum` laeuft Faktionsarbeit neben einer Bladeburner-
 * Aktion (`Bladeburner.ts:178`, `:1354`). Geprueft wird die ganze Kette, denn
 * nur die Sperre in bn4rep zu lockern waere ein stiller No-op:
 *   1. vergib(): Prio 20 (Bladeburner) darf einen Antrag mit Prio 30 mitlaufen
 *      lassen, aber nur mit opts.simulacrum; ohne bleibt es bitgleich.
 *   2. darfFigur()/pruefeHandlung() kennen die Mitaktion.
 *   3. bn4net reicht den Marker an vergib; bn4rep fuehrt den Marker, sperrt
 *      nur ohne Simulacrum bzw. vor dem Kampfwert-Ziel; bbtrain meldet ziel.
 *
 * Gegen den alten Stand ROT. Aufruf: node tools/test-simulacrum.js [repo]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Der Stand vor B5, gegen den "ohne Simulacrum bitgleich" gemessen wird.
const BASIS = "d8c7b5b";
let gruen = 0, rot = 0;
const pruefe = (name, ok, info = "") => {
  if (ok) { gruen++; console.log("  ok    " + name + (info ? "  (" + info + ")" : "")); }
  else { rot++; console.log("  ROT   " + name + (info ? " - " + info : "")); }
};
const lies = (rel) => fs.readFileSync(path.join(ROOT, "src", rel), "utf8").replace(/\r/g, "");
const F = await import(pathToFileURL(path.join(ROOT, "src", "lib", "figur.js")).href);

console.log("\n=== Simulacrum-Parallelarbeit ===\n");
const NR = 1000, W0 = 5000000;
const blade = (wall) => F.antrag("blade.js", F.PRIO.bladeburner, "bladeburner", "Contract/Tracking", "Rang", { wall, nodeReset: NR });
const rep = (wall) => F.antrag("bn4rep.js", F.PRIO.faktion, "faktion", "CyberSec", "Rep", { wall, nodeReset: NR });
const firma = (wall) => F.antrag("bn4rep.js", F.PRIO.faktion, "arbeit", "ECorp", "Firmenrep", { wall, nodeReset: NR });
const graft = (wall) => F.antrag("graft.js", F.PRIO.graft, "graft", null, "Graft", { wall, nodeReset: NR });
const gym = (wall) => F.antrag("bbtrain.js", F.PRIO.gym, "gym", "str", "Gym", { wall, nodeReset: NR });
const SIM = { simulacrum: true };

console.log("-- Vergabe --");
{
  const a = [blade(W0), rep(W0)];
  const alt = F.vergib(a, null, W0, NR);
  pruefe("ohne Simulacrum: Bladeburner gewinnt, Faktion darf NICHT",
    alt.vergabe.owner === "blade.js" && !F.darfFigur(alt.vergabe, "bn4rep.js", W0, NR).darf);
  const sim = F.vergib(a, null, W0, NR, undefined, SIM);
  pruefe("mit Simulacrum: Besitzer bleibt blade.js", sim.vergabe.owner === "blade.js" && sim.vergabe.action === "bladeburner");
  pruefe("mit Simulacrum: bn4rep.js darf neben Bladeburner",
    F.darfFigur(sim.vergabe, "bn4rep.js", W0, NR).darf, JSON.stringify(sim.vergabe.mit));
  pruefe("mit Simulacrum: blade.js darf weiter", F.darfFigur(sim.vergabe, "blade.js", W0, NR).darf);
  pruefe("mit Simulacrum: Firmenarbeit (arbeit) laeuft ebenfalls mit",
    F.darfFigur(F.vergib([blade(W0), firma(W0)], null, W0, NR, undefined, SIM).vergabe, "bn4rep.js", W0, NR).darf);
  pruefe("mit Simulacrum: Gym laeuft NICHT mit",
    !F.darfFigur(F.vergib([blade(W0), gym(W0)], null, W0, NR, undefined, SIM).vergabe, "bbtrain.js", W0, NR).darf);
  const g = F.vergib([graft(W0), blade(W0), rep(W0)], null, W0, NR, undefined, SIM);
  pruefe("mit Simulacrum: Graft (10) hat die Figur allein, nichts laeuft mit",
    g.vergabe.owner === "graft.js" && !g.vergabe.mit && !F.darfFigur(g.vergabe, "bn4rep.js", W0, NR).darf);
  // Lease-Verlaengerung kopiert die alte Vergabe: veraltetes mit darf nicht haengen bleiben.
  const t1 = F.vergib([blade(W0 + 1000), rep(W0 + 1000)], sim.vergabe, W0 + 1000, NR, undefined, SIM);
  pruefe("naechste Runde: Mitlauf bleibt, kein Wechsel", !!(t1.vergabe.mit && t1.vergabe.mit[0] === "bn4rep.js") && !t1.wechsel);
  const t2 = F.vergib([blade(W0 + 2000)], t1.vergabe, W0 + 2000, NR, undefined, SIM);
  pruefe("bn4rep stellt keinen Antrag mehr: mit verschwindet sofort",
    !t2.vergabe.mit && !F.darfFigur(t2.vergabe, "bn4rep.js", W0 + 2000, NR).darf);
  const t3 = F.vergib([blade(W0 + 3000), rep(W0 + 3000)], t1.vergabe, W0 + 3000, NR, undefined, { simulacrum: false });
  pruefe("Simulacrum weg: mit verschwindet auch aus der alten Vergabe", !t3.vergabe.mit);
  const t4 = F.vergib([blade(W0), rep(W0)], null, W0, NR, (t) => t !== "bn4rep.js", SIM);
  pruefe("toter Antragsteller laeuft nicht mit", !t4.vergabe.mit);
}

console.log("-- Figur-Wache --");
{
  const v = F.vergib([blade(W0), rep(W0)], null, W0, NR, undefined, SIM).vergabe;
  pruefe("Wache: Faktionsarbeit bei Bladeburner-Vergabe mit Mitlauf ist KEIN Konflikt", F.pruefeHandlung(v, "faktion").stimmt);
  pruefe("Wache: Gym bei dieser Vergabe bleibt ein Konflikt", !F.pruefeHandlung(v, "gym").stimmt);
  const o = F.vergib([blade(W0), rep(W0)], null, W0, NR).vergabe;
  pruefe("Wache ohne Simulacrum unveraendert: Faktion bei Bladeburner-Vergabe = Konflikt", !F.pruefeHandlung(o, "faktion").stimmt);
}

console.log("-- ohne Simulacrum bitgleich zum Stand davor --");
{
  let alt = null;
  try {
    const tmp = path.join(os.tmpdir(), "figur-alt-test-" + process.pid + ".mjs");
    const code = execFileSync("git", ["show", BASIS + ":src/lib/figur.js"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    fs.writeFileSync(tmp, code);
    alt = await import(pathToFileURL(tmp).href);
    fs.rmSync(tmp, { force: true });
  } catch { alt = null; }
  if (!alt) console.log("  (git-Stand " + BASIS + " nicht lesbar - Vergleich uebersprungen)");
  else {
    let n = 0, gleich = 0, sim = 0;
    let seed = 12345;
    const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff) / 0x7fffffff;
    const tools = [["blade.js", F.PRIO.bladeburner, "bladeburner"], ["bn4rep.js", F.PRIO.faktion, "faktion"],
      ["bbtrain.js", F.PRIO.gym, "gym"], ["joinrun.js", F.PRIO.beitritt, "gym"]];
    let bisher = null;
    for (let i = 0; i < 400; i++) {
      const jetzt = W0 + i * 20000;
      const as = tools.filter(() => rnd() < 0.6)
        .map(([t, p, ak]) => F.antrag(t, p, ak, null, "", { wall: jetzt - Math.floor(rnd() * 200000), nodeReset: NR }));
      const lebt = rnd() < 0.3 ? (t) => t !== "blade.js" : undefined;
      const a = alt.vergib(as, bisher, jetzt, NR, lebt);
      const b = F.vergib(as, bisher, jetzt, NR, lebt);
      const c = F.vergib(as, bisher, jetzt, NR, lebt, { simulacrum: false });
      n++;
      if (JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) === JSON.stringify(c)) gleich++;
      const s = F.vergib(as, bisher, jetzt, NR, lebt, SIM);
      if (s.vergabe && s.vergabe.mit) sim++;
      bisher = a.vergabe;
    }
    pruefe("400 Zufallslagen: Ergebnis ohne Simulacrum Byte fuer Byte wie vorher", gleich === n, gleich + "/" + n);
    pruefe("Probe ist nicht leer: mit Simulacrum entsteht in einigen Lagen ein Mitlauf", sim > 0, sim + " Lagen");
  }
}

console.log("-- Verdrahtung --");
{
  const net = lies("bn4net.js"), brep = lies("bn4rep.js"), bt = lies("bbtrain.js");
  pruefe("bn4net reicht den Marker als simulacrum an vergib",
    /figVergib\(antraege, bisher, jetztF, nodeResetF, lebt, \{ simulacrum: simulacrumF \}\)/.test(net)
    && net.includes('ns.fileExists("data/simulacrum.txt", "home")'));
  pruefe("bn4rep: Sperre nur ohne Parallelfreigabe",
    brep.includes("const bladeSperreArbeit = () => bladeburnerTraegtHier() && !simulacrumParallelFrei();"));
  pruefe("bn4rep: Parallelfreigabe braucht Marker UND Kampfwert-Ziel",
    /simulacrumParallelFrei = \(\) => \{[\s\S]{0,900}SIMULACRUM_MARKER[\s\S]{0,900}< ziel/.test(brep));
  pruefe("bn4rep fuehrt den Marker aus der Besitzpruefung (schreiben UND loeschen)",
    brep.includes("eingebauteAugs.includes(SIMULACRUM)") && brep.includes("schreibNachHome(SIMULACRUM_MARKER")
    && brep.includes("loeschAufHome(SIMULACRUM_MARKER)"));
  pruefe("bbtrain veroeffentlicht sein Kampfwert-Ziel", /data\/bbtrain\.json", JSON\.stringify\(\{[^}]*ziel: ZIEL/.test(bt));
}

console.log("-- Nachbesserung Skeptiker (TTL, Gym, gemeinsames Ziel) --");
{
  const brep = lies("bn4rep.js"), bl2 = lies("blade.js"), bt = lies("bbtrain.js");
  // 1. Ablauf ueber die TTL: bn4rep stellt EINEN Antrag und erneuert ihn nicht
  // (alter Stand) - nach ANTRAG_TTL_MS faellt der Mitlauf weg, die Arbeit laeuft
  // aber weiter. Mit Erneuerung im Minutentakt bleibt er.
  let bisher = null, ohne = null, mit = null;
  const einmal = rep(W0);
  for (let t = 0; t <= 390000; t += 15000) {
    const j = W0 + t;
    bisher = F.vergib([blade(j), einmal], bisher, j, NR, undefined, SIM).vergabe;
    if (t === 390000) ohne = bisher;
  }
  pruefe("ohne Erneuerung verfaellt der Mitlauf nach der TTL (Grund fuer die Erneuerung)", !(ohne && ohne.mit));
  let b2 = null, letzter = rep(W0);
  for (let t = 0; t <= 390000; t += 15000) {
    const j = W0 + t;
    if (t % 60000 === 0) letzter = rep(j);
    b2 = F.vergib([blade(j), letzter], b2, j, NR, undefined, SIM).vergabe;
    if (t === 390000) mit = b2;
  }
  pruefe("mit Erneuerung im Minutentakt bleibt der Mitlauf ueber 390 s", !!(mit && mit.mit && mit.mit[0] === "bn4rep.js"));
  pruefe("bn4rep erneuert den Antrag im Zweig 'Faktionsarbeit laeuft schon'",
    /\} else \{\s*simulacrumAntragHalten\("faktion"/.test(brep));
  pruefe("bn4rep erneuert den Antrag auch bei laufender Firmenarbeit",
    /\} else \{\s*simulacrumAntragHalten\("arbeit"/.test(brep));

  // 2./3. das Gate selbst, aus dem Quelltext gezogen und gegen eine Attrappe gefahren
  const von = brep.indexOf("  const simulacrumParallelFrei = () => {");
  const bis = brep.indexOf("  // Antrag HALTEN");
  pruefe("Gate im Quelltext gefunden", von > 0 && bis > von);
  const gate = (dat, skills) => {
    const ns = { fileExists: (d) => d in dat, getPlayer: () => ({ skills }) };
    const liesVonHome = (d) => (d in dat ? dat[d] : "");
    if (!(von > 0 && bis > von)) return null;
    const fn = new Function("ns", "liesVonHome", "SIMULACRUM_MARKER", "KAMPFZIEL_STANDARD",
      brep.slice(von, bis) + "\nreturn simulacrumParallelFrei;");
    return fn(ns, liesVonHome, "data/simulacrum.txt", F.KAMPFZIEL_STANDARD)();
  };
  const hoch = { strength: 120, defense: 120, dexterity: 120, agility: 120 };
  const M = "data/simulacrum.txt", BT = "data/bbtrain.json", BJ = "data/blade.json";
  pruefe("Gate offen: Marker, Werte >= Ziel, blade will nicht ins Gym",
    gate({ [M]: "1", [BJ]: JSON.stringify({ gymWunsch: false }) }, hoch) === true);
  pruefe("Gate zu ohne Marker", gate({ [BJ]: "{}" }, hoch) === false);
  pruefe("Gate zu, wenn blade ins Gym will (gymWunsch)", gate({ [M]: "1", [BJ]: JSON.stringify({ gymWunsch: true }) }, hoch) === false);
  pruefe("Gate zu, wenn ein Kampfwert unter dem Ziel liegt",
    gate({ [M]: "1", [BJ]: "{}" }, { ...hoch, agility: 99 }) === false);
  pruefe("Gate nimmt das GROESSERE Ziel: bbtrain ziel 150 sperrt bei 120",
    gate({ [M]: "1", [BJ]: "{}", [BT]: JSON.stringify({ ziel: 150 }) }, hoch) === false);
  pruefe("Gate: bbtrain ziel 50 senkt das Ziel nicht unter blades 100",
    gate({ [M]: "1", [BJ]: "{}", [BT]: JSON.stringify({ ziel: 50 }) }, { ...hoch, agility: 99 }) === false);

  pruefe("blade.js meldet gymWunsch in blade.json und setzt es am Gym-Zweig",
    bl2.includes("      gymWunsch,\n") && /!lohntSich\) \{\s*gymWunsch = true;/.test(bl2));
  pruefe("blade.js, bbtrain.js und bn4rep.js teilen KAMPFZIEL_STANDARD",
    bl2.includes("BBTRAIN_ZIEL = KAMPFZIEL_STANDARD") && bt.includes("|| KAMPFZIEL_STANDARD") && brep.includes("KAMPFZIEL_STANDARD"));
  pruefe("gymGreifen loest parallele Faktions-/Firmenarbeit mit Simulacrum ab",
    /laeuft\.type === "FACTION" \|\| laeuft\.type === "COMPANY"\)\s*&& ns\.fileExists\("data\/simulacrum\.txt"/.test(bl2));
}

console.log("\n" + gruen + " ok, " + rot + " ROT");
process.exit(rot ? 1 : 0);
