/**
 * go.cheat im IPvGO-Spieler (27.10.2026). Zwei Teile, beide gegen den echten Spielcode
 * (reference/bitburner-src, per tools/goprobe geladen):
 *
 *   1. Eichung (tools/goprobe/eich-cheat.mjs): Chance-Formel des Nachbaus gleich der des
 *      Spiels (448 Faelle), Tabelle aus dem Quellkommentar, Folgen eines Fehlschlags
 *      (Zug verloren / Auswurf), Doppelzug-Nachbau liefert dasselbe Brett.
 *   2. Szenariotest (tools/goprobe/test-gocheat.mjs) mit dem angegebenen go.js:
 *      Schlaegt der Spieler eine Kette mit zwei Freiheiten per playTwoMoves, und haelt er
 *      sich bei zu geringer Chance / ohne SF14 / bei Chance < Mindestchance zurueck?
 *
 * Aufruf: node tools/test-gocheat.js [pfad/zu/go.js]
 *   alte src/go.js            -> ROT (kennt keinen Cheat)
 *   nodes/bau-2026-10-27-gocheat/go.js -> gruen
 * Braucht reference/ (gitignored).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const GO = path.resolve(process.argv[2] || path.join(ROOT, "nodes", "bau-2026-10-27-gocheat", "go.js"));
const LIB = path.join(path.dirname(GO), "lib", "gocheat.js");

let gruen = 0, rot = 0;
const pruefe = (was, ok, zusatz = "") => {
  if (ok) { gruen++; console.log("  ok    " + was + (zusatz ? "  (" + zusatz + ")" : "")); }
  else { rot++; console.log("  ROT   " + was + (zusatz ? " - " + zusatz : "")); }
};
const lauf = (skript, args) => {
  const r = spawnSync(process.execPath, ["--no-warnings", "--import", "./tools/goprobe/register.mjs", skript, ...args],
    { cwd: ROOT, encoding: "utf8", timeout: 240000 });
  try { return JSON.parse(r.stdout.trim().split("\n").pop()); } catch { return { fehler: (r.stderr || "").slice(-300) }; }
};

console.log("\n=== go.cheat (" + path.relative(ROOT, GO) + ") ===\n");
if (!fs.existsSync(path.join(ROOT, "reference", "bitburner-src", "src", "Go", "Go.ts"))) {
  console.log("  --    uebersprungen: reference/ fehlt");
  process.exit(0);
}

console.log("-- 1. Eichung der Chance und der Folgen --");
if (fs.existsSync(LIB)) {
  const e = lauf("tools/goprobe/eich-cheat.mjs", [LIB]);
  pruefe("Chance-Formel gleich dem Spielcode", e.chanceAbweichung === 0, e.chanceFaelle + " Faelle");
  pruefe("Tabelle aus dem Quellkommentar stimmt", e.tabelleAbweichung === 0);
  pruefe("Fehlschlag ohne Vorgaenger: Zug verloren, kein Auswurf", e.folgen && e.folgen.fehlschlagErsterCheat.spielLaeuft && e.folgen.fehlschlagErsterCheat.steineSchwarz === 0);
  pruefe("Fehlschlag mit Vorgaenger + Wurf < 0,1: Partie vorbei, 1 Niederlage, 0 Node Power",
    e.folgen && e.folgen.auswurf.partieBeendet && e.folgen.auswurf.niederlagen === 1 && e.folgen.auswurf.nodePowerZuwachs === 0);
  pruefe("Doppelzug-Nachbau liefert das Brett des Spiels", e.folgen && e.folgen.doppelzugSchlaegt.brettGleich);
} else {
  pruefe("lib/gocheat.js neben go.js vorhanden", false, "fehlt: " + path.relative(ROOT, LIB));
}

console.log("\n-- 2. Szenario: Kette mit zwei Freiheiten --");
const s = lauf("tools/goprobe/test-gocheat.mjs", [GO]);
const f = s.faelle || {};
pruefe("A: erste Aktion ist playTwoMoves auf die zwei Freiheiten, Kette geschlagen",
  f.A && f.A.erste === "playTwoMoves" && f.A.weisseSteineDanach === 0, JSON.stringify(f.A));
pruefe("B: Chance 0,55 unter Mindestchance -> kein Cheat", f.B && f.B.erste && f.B.erste !== "playTwoMoves" && !f.B.absturz, JSON.stringify(f.B));
pruefe("C: ohne SF14 kein Absturz, normaler Zug", f.C && f.C.erste && f.C.erste !== "playTwoMoves" && !f.C.absturz, JSON.stringify(f.C));
pruefe("D: Zaehler 2 bei crime 1,0 (Chance unter Mindestchance) -> kein Cheat", f.D && f.D.erste && f.D.erste !== "playTwoMoves" && !f.D.absturz, JSON.stringify(f.D));
if (s.fehler) console.log("  stderr: " + s.fehler);

console.log("\n" + (rot ? "ROT: " + rot + " von " + (rot + gruen) : "alle " + gruen + " gruen"));
process.exit(rot ? 1 : 0);
