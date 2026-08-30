/**
 * Das naechste Stueck aus `nodes/GRAFTPLAN.md` graften - eines, und nur wenn
 * gerade keins laeuft.
 *
 * WARUM ES DIESES WERKZEUG GIBT UND NICHT EINE SCHLEIFE IM SPIEL
 *
 * `src/graft.js` ist bewusst so gebaut, dass es genau ein Graft je Aufruf
 * startet: Ein abgebrochenes Graft wird nicht erstattet
 * (`Work/GraftingWork.tsx:75-83`), und ein Automatismus, der aus Versehen
 * zweimal feuert, kostet den vollen Preis doppelt. Das Paket hat aber 38
 * Stuecke ueber rund 42 Stunden - von Hand ist das nichts.
 *
 * Die Loesung ist die Arbeitsteilung, die dieses Projekt ohnehin hat: Die
 * Loops sind die Steuerung. Dieses Werkzeug laeuft auf der Platte, prueft die
 * Lage ueber die Bruecke und legt hoechstens einen Auftrag ab. Es entscheidet
 * nichts, was `graft.js` nicht auch pruefen wuerde - es sucht nur heraus, was
 * als Naechstes dran ist.
 *
 * Aufruf:
 *   node tools/graftnext.js          nur zeigen, was dran waere
 *   node tools/graftnext.js --los    den Auftrag wirklich ablegen
 */

import fs from "node:fs";

const BASE = "http://localhost:8795";
const PLAN = "nodes/GRAFTPLAN.md";

async function rpc(method, params = {}) {
  const res = await fetch(BASE + "/api/rpc?" + new URLSearchParams({ method, ...params }));
  const body = await res.json();
  if (body.error) throw new Error(body.error);
  return body.result;
}

async function datei(name) {
  try { return await rpc("getFile", { filename: name, server: "home" }); }
  catch { return null; }
}

/** Die Namen aus dem Codeblock in GRAFTPLAN.md. */
function planLesen() {
  const roh = fs.readFileSync(PLAN, "utf8");
  const block = /```\r?\n([\s\S]*?)```/.exec(roh);
  if (!block) throw new Error(PLAN + ": kein Codeblock mit der Reihenfolge gefunden.");
  return block[1].split(/\r?\n/).map((z) => z.trim()).filter(Boolean);
}

const los = process.argv.includes("--los");

// --- 1. Laeuft schon ein Graft? -------------------------------------------
// `data/graft.json` allein reicht nicht: Es sagt, was zuletzt GESTARTET
// wurde, nicht, ob es noch laeuft. Die verlaessliche Quelle ist die Liste der
// graftbaren Augmentierungen - sie schrumpft erst, wenn eines fertig ist -
// und `data/blade.json`, das die laufende Arbeit meldet.
const rohGraft = await datei("data/graft.json");
const rohBlade = await datei("data/blade.json");
const blade = rohBlade ? JSON.parse(rohBlade) : null;
const letzter = rohGraft ? JSON.parse(rohGraft) : null;

if (blade && blade.aktion === "Grafting") {
  console.log("Ein Graft laeuft (blade.js haelt still) - nichts zu tun.");
  process.exit(0);
}

// Mit Simulacrum meldet blade.js normal weiter; dann hilft nur der Spielstand.
let arbeitet = false;
try {
  const zlib = await import("node:zlib");
  const save = JSON.parse(zlib.gunzipSync(
    Buffer.from((await rpc("getSaveFile")).save, "latin1")).toString("utf8"));
  const p = JSON.parse(save.data.PlayerSave).data;
  arbeitet = !!p.currentWork && String(p.currentWork.ctor || "").includes("Grafting");
} catch (e) {
  console.log("Spielstand nicht lesbar (" + e.message + ") - im Zweifel nichts tun.");
  process.exit(1);
}
if (arbeitet) {
  console.log("Ein Graft laeuft laut Spielstand - nichts zu tun.");
  process.exit(0);
}

// --- 2. Was ist noch graftbar? --------------------------------------------
if (!letzter || !Array.isArray(letzter.augs) && letzter.verfuegbar == null) {
  console.log("data/graft.json fehlt - erst `node tools/task.js graft.js` laufen lassen.");
  process.exit(1);
}
const rohBb = await datei("data/bbgraft.json");
if (!rohBb) {
  console.log("data/bbgraft.json fehlt - erst `node tools/task.js bbgraft.js` laufen lassen.");
  process.exit(1);
}
const bb = JSON.parse(rohBb);
const graftbar = new Set(bb.augs.map((a) => a.name));
const alter = Math.round((Date.now() - bb.zeit) / 60000);

// --- 3. Das naechste Stueck aus dem Plan ----------------------------------
const plan = planLesen();
const dran = plan.find((n) => graftbar.has(n));
const fertig = plan.filter((n) => !graftbar.has(n)).length;

console.log("Plan: " + plan.length + " Stuecke, davon " + fertig + " nicht mehr graftbar"
  + " (installiert oder gerade fertig).");
console.log("data/bbgraft.json ist " + alter + " min alt.");
if (alter > 30) {
  console.log("ZU ALT - erst `node tools/task.js bbgraft.js`, sonst wird ein"
    + " schon installiertes Stueck erneut vorgeschlagen.");
  process.exit(1);
}
if (!dran) {
  console.log("Nichts mehr offen - das Paket ist durch.");
  process.exit(0);
}

const eintrag = bb.augs.find((a) => a.name === dran);
console.log("Als Naechstes: " + dran
  + "  $" + (eintrag.preis / 1e9).toFixed(2) + " Mrd"
  + "  " + (eintrag.dauerMs / 60000).toFixed(1) + " min");

if (!los) {
  console.log("(Nur gezeigt. Mit --los wird der Auftrag abgelegt.)");
  process.exit(0);
}

// --- 4. Auftragskanal pruefen und belegen ---------------------------------
const kanal = await datei("data/task.txt");
if (kanal && kanal.trim() !== "") {
  console.log("Auftragskanal belegt (" + kanal.trim() + ") - nicht angefasst.");
  process.exit(1);
}
await rpc("pushFile", {
  filename: "data/task.txt",
  content: JSON.stringify(["graft.js", dran]),
  server: "home",
});
console.log("Auftrag abgelegt. Der Autopilot startet ihn in der naechsten Runde.");
