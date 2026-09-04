/**
 * Ebene 0: der Namensprüfer selbst - MIT Selbstprobe.
 *
 * Ein Pruefwerkzeug, das immer gruen meldet, ist schlimmer als keins: es
 * erzeugt Vertrauen, das es nicht deckt. Deshalb prueft dieser Test nicht nur,
 * dass `ram-namen.js` ueber src/ sauber durchlaeuft, sondern auch, dass es den
 * Fehler FINDET, fuer den es gebaut wurde.
 *
 * Der Beleg ist die Fassung von `wakelock.js` vor dem Fix vom 04.09.2026: dort
 * stand `osc.connect(gain).connect(ctx.destination)` und kostete 32 GB, weil
 * der RAM-Rechner des Spiels nur den NAMEN sieht.
 *
 * Aufruf: node tools/test-ram-namen.js
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const WERKZEUG = path.join(HIER, "ram-namen.js");

let gruen = 0;
let rot = 0;
const fehler = [];

function pruefe(name, bedingung, hinweis = "") {
  if (bedingung) {
    gruen++;
    console.log("  ok    " + name);
  } else {
    rot++;
    fehler.push(name + (hinweis ? " - " + hinweis : ""));
    console.log("  ROT   " + name + (hinweis ? " - " + hinweis : ""));
  }
}

function lauf(args) {
  try {
    return { code: 0, aus: execFileSync("node", [WERKZEUG, ...args], { encoding: "utf8", cwd: ROOT }) };
  } catch (e) {
    return { code: e.status ?? 1, aus: (e.stdout || "") + (e.stderr || "") };
  }
}

console.log("");
console.log("=== Ebene 0: Namenspruefer ===");

console.log("");
console.log("-- Selbstprobe: findet er den Fehler, fuer den er gebaut wurde? --");
{
  // Eine Wegwerfdatei mit genau dem Muster aus wakelock.js vor dem Fix.
  const tmp = path.join(os.tmpdir(), "ram-namen-probe-" + process.pid + ".js");
  fs.writeFileSync(tmp, [
    "export async function main(ns) {",
    "  const ctx = new AudioContext();",
    "  const osc = ctx.createOscillator();",
    "  const gain = ctx.createGain();",
    "  osc.connect(gain).connect(ctx.destination);",
    "  osc.start();",
    "}",
    "",
  ].join("\n"), "utf8");

  const r = lauf([tmp]);
  pruefe("die Probe wird als Befund gemeldet", r.code !== 0,
    "Exit " + r.code + " - ohne Befund waere das Werkzeug wertlos");
  pruefe("der Name connect wird genannt", /VERDAECHTIG: \.connect/.test(r.aus));
  pruefe("der Preis 32 GB wird genannt", /32\.00 GB/.test(r.aus), r.aus.slice(0, 200));
  pruefe("der Singularity-Faktor wird benannt", /Singularity x16/.test(r.aus));
  pruefe("die Fundstelle wird mit Zeile genannt", /:5\s/.test(r.aus));

  // Die Gegenprobe: dieselbe Datei mit dem Kniff aus wakelock.js muss SAUBER
  // sein. Ein Werkzeug, das auch die Loesung anmeckert, zwingt zum Wegsehen.
  fs.writeFileSync(tmp, [
    "export async function main(ns) {",
    "  const ctx = new AudioContext();",
    "  const osc = ctx.createOscillator();",
    "  const gain = ctx.createGain();",
    '  const verbinde = "con" + "nect";',
    "  osc[verbinde](gain)[verbinde](ctx.destination);",
    "  osc.start();",
    "}",
    "",
  ].join("\n"), "utf8");
  const r2 = lauf([tmp]);
  pruefe("der Kniff aus wakelock.js gilt als sauber", r2.code === 0,
    "Exit " + r2.code);

  // Und die Alias-Aufloesung: `const b = ns.bladeburner; b.getRank()` ist
  // gewollt und darf kein Befund sein.
  fs.writeFileSync(tmp, [
    "export async function main(ns) {",
    "  const b = ns.bladeburner;",
    "  const rang = b.getRank();",
    "  ns.tprint(rang);",
    "}",
    "",
  ].join("\n"), "utf8");
  const r3 = lauf([tmp]);
  pruefe("ein ns-Alias ist kein Befund", r3.code === 0,
    "sonst ertrinkt der echte Fund in 60 Fehlalarmen");

  fs.unlinkSync(tmp);
}

console.log("");
console.log("-- der aktive Code ist sauber --");
{
  const r = lauf(["--alle"]);
  pruefe("src/ laeuft ohne Befund durch", r.code === 0,
    r.code ? r.aus.split("\n").filter((z) => /VERDAECHTIG/.test(z)).slice(0, 3).join(" | ") : "");
  // Die bekannten toten Dateien sollen weiterhin GEMELDET werden - nur nicht
  // als Fehler zaehlen. Verschwaende sie ganz, faende niemand sie wieder.
  pruefe("tote Dateien werden weiterhin ausgewiesen", /^\s{2}--\s+src\/keepalive\.js/m.test(r.aus),
    "keepalive.js traegt denselben 32-GB-Fehler und soll sichtbar bleiben");
}

console.log("");
console.log("-- die Kontraktmodule kosten nichts --");
{
  const r = lauf(["--lib"]);
  pruefe("lib laeuft ohne Befund durch", r.code === 0);
  for (const m of ["motorzeit.js", "herzschlag.js", "kpi.js", "events.js", "route.js", "eta.js"]) {
    pruefe(m + " ohne teure Namen",
      new RegExp("ok\\s+\\S*" + m.replace(".", "\\.") + "[\\s\\S]{0,120}?Namen aus der Kostentabelle: 0").test(r.aus),
      "diese Module gehen in den Kern und muessen 0 GB kosten");
  }
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
