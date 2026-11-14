/**
 * Selbstprobe der Listenpruefung in tools/test-alles.js (B01, 14.11.2026).
 *
 * Das Tor "jede tools/test-*.js steht in der Suite" ist selbst Code, der nach dem
 * Merge unbeaufsichtigt laeuft. Ein Tor, das nie angeschlagen hat, ist unbewiesen:
 * hier bekommt es Mutanten. Gearbeitet wird in einem TEMP-Ordner (Kopie von
 * test-alles.js plus leere Dateien mit den Namen aus tools/), nie in tools/.
 *
 * Gepruefte Faelle:
 *   1. Abbild ohne Mutation -> Exit 0
 *   2. zusaetzliche test-neu.js (verwaist) -> Exit 1, Meldung VERWAIST
 *   3. zusaetzliche test-neu.mjs -> Exit 1 (auch .mjs zaehlt)
 *   4. eine eingetragene Datei fehlt im Ordner -> Exit 1, EINTRAG OHNE DATEI
 *   5. Eintrag doppelt (Mutante der Kopie) -> Exit 1, DOPPELT
 *   6. verwaiste Datei, aber mit Grund in NICHT_IN_SUITE -> Exit 0
 *   7. NICHT_IN_SUITE ohne Grund -> Exit 1
 *   8. Datei in TESTS und NICHT_IN_SUITE -> Exit 1
 *   9. test-alles.js selbst zaehlt nicht als verwaist
 *  10. Exit-Logik: --nur-liste beendet ohne Tests zu fahren (Dauer < 5 s)
 *
 * Aufruf: node tools/test-suite-gate.js
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const QUELLE = path.join(HIER, "test-alles.js");
let gruen = 0, rot = 0;
const pruefe = (name, ok, detail) => {
  if (ok) { gruen++; console.log("  ok    " + name); }
  else { rot++; console.log("  ROT   " + name + (detail ? "\n          " + detail : "")); }
};

// Namen aus den Eintraegen von test-alles.js (NICHT aus dem echten Ordner): so ist dieser
// Test unabhaengig davon, ob gerade eine fremde Testdatei noch nicht eingetragen ist -
// das meldet die Suite selbst.
const echt = [...fs.readFileSync(QUELLE, "utf8").matchAll(/^\s*datei: "(test-[^"]+)"/gm)].map((m) => m[1]);
if (!echt.length) throw new Error("keine Eintraege in test-alles.js gefunden");

function lauf(dir, extra = []) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(dir, "test-alles.js"), "--nur-liste", ...extra],
    { encoding: "utf8", timeout: 30000 });
  return { rc: r.status, out: (r.stdout || "") + (r.stderr || ""), ms: Date.now() - t0 };
}

// Kopie anlegen; mutiere(textLF) darf den Quelltext der Kopie aendern
function abbild(mutiere, ohne = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "suite-gate-"));
  let s = fs.readFileSync(QUELLE, "utf8");
  if (mutiere) s = mutiere(s);
  fs.writeFileSync(path.join(dir, "test-alles.js"), s);
  for (const n of echt) {
    if (n === "test-alles.js" || ohne.includes(n)) continue;
    fs.writeFileSync(path.join(dir, n), "// leer\n");
  }
  return dir;
}
const weg = (d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} };

const dirs = [];
try {
  // 1 unmutiertes Abbild
  {
    const d = abbild(); dirs.push(d);
    const r = lauf(d);
    pruefe("1 unmutiertes Abbild: Exit 0", r.rc === 0, r.out.slice(-300));
    pruefe("9 test-alles.js zaehlt nicht als verwaist", !/VERWAIST: test-alles/.test(r.out));
    pruefe("10 --nur-liste faehrt keine Tests (unter 5 s, keine Testzeilen)", r.ms < 5000 && !/\(\d+ ms\)/.test(r.out), r.ms + " ms");
  }
  // 2 verwaist .js
  {
    const d = abbild(); dirs.push(d);
    fs.writeFileSync(path.join(d, "test-neu.js"), "// x\n");
    const r = lauf(d);
    pruefe("2 verwaiste test-neu.js: Exit 1 + VERWAIST", r.rc === 1 && /VERWAIST: test-neu\.js/.test(r.out), "rc=" + r.rc);
  }
  // 3 verwaist .mjs
  {
    const d = abbild(); dirs.push(d);
    fs.writeFileSync(path.join(d, "test-neu.mjs"), "// x\n");
    const r = lauf(d);
    pruefe("3 verwaiste test-neu.mjs: Exit 1", r.rc === 1 && /VERWAIST: test-neu\.mjs/.test(r.out), "rc=" + r.rc);
  }
  // 4 Eintrag ohne Datei
  {
    const fehlt = echt.find((n) => n !== "test-alles.js" && n !== "test-suite-gate.js");
    const d = abbild(null, [fehlt]); dirs.push(d);
    const r = lauf(d);
    pruefe("4 Eintrag ohne Datei (" + fehlt + "): Exit 1", r.rc === 1 && new RegExp("EINTRAG OHNE DATEI: " + fehlt.replace(".", "\\.")).test(r.out), "rc=" + r.rc);
  }
  // 5 doppelt
  {
    const d = abbild((s) => s.replace('datei: "test-route.js",', 'datei: "test-route.js",\r\n    deckt: "x", schnell: true,\r\n  },\r\n  {\r\n    datei: "test-route.js",')); dirs.push(d);
    const r = lauf(d);
    pruefe("5 doppelter Eintrag: Exit 1 + DOPPELT", r.rc === 1 && /DOPPELT eingetragen: test-route\.js/.test(r.out), "rc=" + r.rc + " " + r.out.slice(-200));
  }
  // 6 NICHT_IN_SUITE mit Grund
  {
    const d = abbild((s) => s.replace("const NICHT_IN_SUITE = [", 'const NICHT_IN_SUITE = [\n  { datei: "test-neu.js", grund: "braucht das Spiel" },')); dirs.push(d);
    fs.writeFileSync(path.join(d, "test-neu.js"), "// x\n");
    const r = lauf(d);
    pruefe("6 verwaist, aber mit Grund in NICHT_IN_SUITE: Exit 0", r.rc === 0, r.out.slice(-300));
  }
  // 7 ohne Grund
  {
    const d = abbild((s) => s.replace("const NICHT_IN_SUITE = [", 'const NICHT_IN_SUITE = [\n  { datei: "test-neu.js", grund: "" },')); dirs.push(d);
    fs.writeFileSync(path.join(d, "test-neu.js"), "// x\n");
    const r = lauf(d);
    pruefe("7 NICHT_IN_SUITE ohne Grund: Exit 1", r.rc === 1 && /ohne Grund/.test(r.out), "rc=" + r.rc);
  }
  // 8 in beiden
  {
    const d = abbild((s) => s.replace("const NICHT_IN_SUITE = [", 'const NICHT_IN_SUITE = [\n  { datei: "test-route.js", grund: "x" },')); dirs.push(d);
    const r = lauf(d);
    pruefe("8 in TESTS und NICHT_IN_SUITE: Exit 1", r.rc === 1 && /in TESTS UND NICHT_IN_SUITE/.test(r.out), "rc=" + r.rc);
  }
  // 11 --tests-dir ohne --nur-liste wirkt nicht (Schutz: keine Tests aus fremdem Ordner fahren)
  {
    const src = fs.readFileSync(QUELLE, "utf8");
    pruefe("11 --tests-dir gilt nur zusammen mit --nur-liste", /dirIdx >= 0 && nurListe/.test(src));
  }
} finally {
  for (const d of dirs) weg(d);
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
process.exit(rot ? 1 : 0);
