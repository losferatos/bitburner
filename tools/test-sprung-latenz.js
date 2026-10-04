/**
 * jump_latency_min misst den Sprung, nicht die Zeit seit dem Sprung
 * (03.10.2026).
 *
 * Befund: bn4net.js rechnete die Kennzahl bei JEDEM Kernstart als "jetzt minus
 * letzter jump" (Deckel 6 h). Am 03.10. wurde das Spiel um 09:46 neu geladen,
 * fuenf Stunden nach dem Sprung BN12.3 -> BN2.1 (04:42) - der Check-in zeigte
 * "Sprung 305.6 min" statt 1,0. Jetzt: lib/events.js sprungLatenzMin() misst
 * gegen den ERSTEN Boot nach dem Sprung, und gibt keine Zahl, wenn der
 * Ringpuffer diesen Boot schon verloren haben kann.
 *
 * Aufruf: node tools/test-sprung-latenz.js [src-verzeichnis]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "src");

let gruen = 0, rot = 0;
const pruefe = (name, ok, info = "") => {
  if (ok) { gruen++; console.log("  ok    " + name); }
  else { rot++; console.log("  ROT   " + name + (info ? " - " + info : "")); }
};

let ev = null;
try { ev = await import(pathToFileURL(path.join(SRC, "lib", "events.js")).href); } catch (e) { ev = null; }
const f = ev && ev.sprungLatenzMin;
pruefe("lib/events.js exportiert sprungLatenzMin", typeof f === "function");

if (typeof f === "function") {
  const MIN = 60000;
  const t0 = Date.UTC(2026, 9, 3, 2, 42);
  const strom = (eintraege) => ({ eintraege });
  const e = (art, wall) => ({ art, wall, text: art });

  pruefe("Sprung, Boot 1 min spaeter -> 1",
    f(strom([e("jump", t0), e("boot", t0 + MIN)])) === 1);
  pruefe("zweiter Boot 305 min spaeter aendert nichts (der 03.10.-Fall)",
    f(strom([e("jump", t0), e("boot", t0 + MIN), e("note", t0 + 2 * MIN),
      e("boot", t0 + 305.6 * MIN)])) === 1);
  pruefe("kein Boot nach dem Sprung -> null",
    f(strom([e("boot", t0 - MIN), e("jump", t0)])) === null);
  pruefe("erster Boot erst nach 7 h -> null (Offline-Pause, kein Sprungmass)",
    f(strom([e("jump", t0), e("boot", t0 + 7 * 60 * MIN)])) === null);
  pruefe("kein Sprung -> null", f(strom([e("boot", t0)])) === null);

  // Beschnittener Puffer: DECKEL gewoehnliche Eintraege, alle nach dem Sprung,
  // der erste Boot ist herausgefallen - der verbliebene Boot ist der falsche.
  const viele = [e("jump", t0)];
  for (let i = 0; i < ev.DECKEL; i++) viele.push(e("note", t0 + 60 * MIN + i * 1000));
  viele.push(e("boot", t0 + 305 * MIN));
  pruefe("beschnittener Puffer -> null statt falscher Zahl", f(strom(viele)) === null);

  // Boot aus dem ALTEN Knoten zwischen jump und Reset (Handschlag bis 90 s,
  // gescheiterter exec) zaehlt nicht: abWall = lastNodeReset.
  const reset = t0 + 5 * MIN;
  pruefe("Boot im alten Knoten nach dem jump zaehlt nicht",
    f(strom([e("jump", t0), e("boot", t0 + MIN), e("boot", reset + MIN)]), reset) === 6);
  // Aeltester gewoehnlicher Eintrag ohne Wanduhr bei vollem Puffer: unbekannt -> null.
  const ohneUhr = [e("jump", t0), e("note", 0)];
  for (let i = 1; i < ev.DECKEL; i++) ohneUhr.push(e("note", t0 + i * 1000));
  ohneUhr.push(e("boot", t0 + 305 * MIN));
  pruefe("voller Puffer mit wall 0 -> null", f(strom(ohneUhr)) === null);

  // Nicht beschnitten, nur viele Eintraege vor dem Sprung: misst normal.
  const vorher = [];
  for (let i = 0; i < 50; i++) vorher.push(e("note", t0 - 3600000 + i * 1000));
  pruefe("Eintraege vor dem Sprung stoeren nicht",
    f(strom([...vorher, e("jump", t0), e("boot", t0 + 2 * MIN)])) === 2);
}

// neuerLauf nullt die Sprungkennzahlen (BN2.1 und BN2.2 teilen den Knoten-Eintrag).
try {
  const kpi = await import(pathToFileURL(path.join(SRC, "lib", "kpi.js")).href);
  const neu = kpi.neuerLauf({ jump_latency_min: 1, boot_latency_min: 2 }, Date.now());
  pruefe("neuerLauf nullt jump_latency_min und boot_latency_min",
    neu.jump_latency_min === null && neu.boot_latency_min === null);
} catch (err) { pruefe("lib/kpi.js neuerLauf ladbar", false, err.message); }

// bn4net.js nutzt die Funktion und nicht mehr die alte "jetzt minus Sprung"-Formel.
const kern = fs.readFileSync(path.join(SRC, "bn4net.js"), "utf8");
pruefe("bn4net.js ruft sprungLatenzMin mit lastNodeReset", /sprungLatenzMin\(strom, nrJetzt\)/.test(kern));
pruefe("bn4net.js rechnet nicht mehr bootWall - letzterSprung.wall",
  !/bootWall\s*-\s*letzterSprung\.wall/.test(kern));

console.log("\n=== " + gruen + " gruen, " + rot + " rot ===\n");
process.exit(rot ? 1 : 0);
