/**
 * Der Verdraenger (30.10.2026, BN13.2): ein home-Werkzeug, das auf home
 * keinen Platz findet, verdraengt ein Werkzeug, das nicht auf home gehoert.
 *
 * Befund 08:41: nach dem Einbau um 08:24 home 126,65 von 128 GB mit
 * Werkzeugen belegt, shop.js (hostRule home, 7 GB) fand 1,3 GB und lief nie,
 * also kaufte niemand Mietrechner und blade.js (100 GB) fand keinen Platz.
 *
 * Gegen den alten Stand ROT: pickEvictionVictim fehlt in src/lib/reg.js, und
 * bn4net.js ruft keinen Verdraenger auf.
 * Aufruf: node tools/test-verdraenger.js [repo-verzeichnis]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let rot = 0;
const pruefe = (name, ok, extra = "") => {
  console.log((ok ? "  ok    " : "  ROT   ") + name + (extra ? "  (" + extra + ")" : ""));
  if (!ok) rot++;
};
console.log("\n=== Verdraenger: home-Werkzeug bekommt seinen Platz ===\n");

const lib = await import(pathToFileURL(path.join(ROOT, "src", "lib", "reg.js")).href);
const pick = lib.pickEvictionVictim;
pruefe("pickEvictionVictim exportiert", typeof pick === "function");

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "registry.json"), "utf8"));
// Die Belegung von home am 30.10.2026, 08:41 (ps.js plus Registry, mit SF4.3)
const home = [
  ["guard.js", 6.1], ["bn4net.js", 10.8], ["bn4life.js", 23.85], ["wakelock.js", 2.25],
  ["popups.js", 3.95], ["ausgang.js", 8.15], ["bbtrain.js", 12.35], ["sleeve.js", 31.85],
  ["figwatch.js", 5.35], ["export.js", 4.35], ["contracts.js", 17.65],
].map(([file, gb], i) => ({ file, pid: 100 + i, gb }));
const passt = () => true;
// wie bn4net.js darfVerdraengen: ausgang.js (Sprungtreiber) und bn4life.js
// (nicht in WERKZEUGE) nie
const wieKern = (f) => f !== "ausgang.js" && f !== "bn4life.js";

if (typeof pick === "function") {
  const o = pick(home, registry, 1.35, 7, wieKern);
  pruefe("Live-Fall: shop.js (7 GB) bei 1,35 frei -> ein Opfer", !!o, JSON.stringify(o));
  pruefe("  Opfer macht genug frei", o && 1.35 + o.gb >= 7);
  pruefe("  Opfer ist contracts.js (kleinster evictRank, der reicht, ausgang.js ausgenommen)", o && o.file === "contracts.js" && o.rank === 9, o && o.file);
  pruefe("  pid wird durchgereicht", o && o.pid === 110);
  pruefe("Gegenprobe ohne Ausnahme: die Regel allein naehme ausgang.js (evictRank 3)",
    pick(home, registry, 1.35, 7, passt)?.file === "ausgang.js");

  const steuer = new Set(["guard.js", "bn4net.js", "wakelock.js", "popups.js"]);
  const nurSteuer = home.filter((c) => steuer.has(c.file));
  pruefe("home-Werkzeuge werden nie verdraengt", pick(nurSteuer, registry, 0, 2, passt) === null);

  pruefe("export.js (4,35) reicht allein nicht -> nicht gewaehlt bei 7 GB Bedarf",
    pick(home.filter((c) => c.file === "export.js"), registry, 1.35, 7, passt) === null);
  pruefe("Gleichstand evictRank 3: das kleinere gewinnt, wenn beide reichen",
    pick(home, registry, 4, 7, passt).file === "export.js");

  const nichtAufWerkbank = (f) => f !== "ausgang.js";
  const o2 = pick(home, registry, 1.35, 7, nichtAufWerkbank);
  pruefe("passt ausgang.js nicht auf die Werkbank: naechstes nach evictRank (contracts.js 9)",
    o2 && o2.file === "contracts.js", o2 && o2.file);
  pruefe("passt nichts auf die Werkbank: kein Opfer (sonst Pingpong ueber home)",
    pick(home, registry, 1.35, 7, () => false) === null);
  pruefe("ohne Freigabe-Funktion: kein Opfer", pick(home, registry, 1.35, 7) === null);
  // Skeptiker 30.10.: bn4life.js steht nicht in WERKZEUGE und kaeme nie auf
  // die Werkbank zurueck - sind die kleineren Raenge weg, waere es dran.
  const ohneKleine = home.filter((c) => !["ausgang.js", "export.js", "contracts.js", "sleeve.js", "bbtrain.js"].includes(c.file));
  pruefe("Gegenprobe: ohne Freigabe-Filter waere bn4life.js das Opfer",
    pick(ohneKleine, registry, 1.35, 7, passt)?.file === "bn4life.js");
  pruefe("mit Filter (nicht in WERKZEUGE) nie bn4life.js",
    pick(ohneKleine, registry, 1.35, 7, (f) => f !== "bn4life.js")?.file !== "bn4life.js");

  const ohneSafe = { eintraege: registry.eintraege.map((e) => (e.name === "ausgang.js" ? { ...e, killSafe: false } : e)) };
  pruefe("killSafe false wird uebersprungen", pick(home, ohneSafe, 1.35, 7, passt).file !== "ausgang.js");
  const rang99 = { eintraege: registry.eintraege.map((e) => (e.name === "ausgang.js" ? { ...e, evictRank: 99 } : e)) };
  pruefe("evictRank 99 wird uebersprungen", pick(home, rang99, 1.35, 7, passt).file !== "ausgang.js");

  pruefe("unbekanntes Skript (nicht in der Registry) wird nie gewaehlt",
    pick([{ file: "ps.js", pid: 1, gb: 50 }], registry, 0, 7, passt) === null);
  pruefe("braucht 0: kein Opfer", pick(home, registry, 0, 0, passt) === null);
  pruefe("Unsinn rein: kein Absturz", pick(null, null, NaN, 7, passt) === null
    && pick([null, { file: 5 }], registry, 0, 7, passt) === null);
  pruefe("braucht mehr, als jedes einzelne freimacht: kein Opfer (nie mehrere auf einmal)",
    pick(home, registry, 0, 40, passt) === null);
}

// Verdrahtung im Kern
const kern = fs.readFileSync(path.join(ROOT, "src", "bn4net.js"), "utf8");
pruefe("bn4net.js importiert pickEvictionVictim", /pickEvictionVictim\s*\}\s*from\s*"lib\/reg\.js"/.test(kern));
const stelle = kern.indexOf("pickEvictionVictim(kandidaten");
pruefe("bn4net.js ruft den Verdraenger auf", stelle > 0);
const vorher = kern.slice(Math.max(0, stelle - 1500), stelle);
pruefe("  nur bei echter Werkbank (werkbank !== \"home\")", /werkbank && werkbank !== "home"/.test(vorher));
pruefe("  nur fuer hostRule home", /regel === "home" && freiAuf\("home"\) < braucht && werkbank/.test(vorher));
const nachher = kern.slice(stelle, stelle + 900);
pruefe("  Freigabe ueber darfVerdraengen", /pickEvictionVictim\(kandidaten, regGeladen, freiAuf\("home"\), braucht,\s*darfVerdraengen\)/.test(kern));
pruefe("  beendet per pid", /ns\.kill\(opfer\.pid\)/.test(nachher));
pruefe("  hoechstens ein Opfer je Runde", /&& !verdraengtDieseRunde\)/.test(vorher) && /verdraengtDieseRunde = true/.test(nachher));
pruefe("  merkt sich das Opfer fuer die Pause", /verdraengtAm\.set\(opfer\.file, Date\.now\(\)\)/.test(nachher));
const df = kern.slice(kern.indexOf("const darfVerdraengen"), kern.indexOf("const darfVerdraengen") + 1200);
pruefe("darfVerdraengen definiert", kern.indexOf("const darfVerdraengen") > 0);
pruefe("  nur was in WERKZEUGE mit restartPolicy always steht (nie bn4life.js)", /eintragPolicy\.has\(d\)/.test(df) && /!== "always"/.test(df));
pruefe("  Vorbedingung muss gelten", /vorbedingungGilt\(d\)/.test(df));
pruefe("  ausgang.js nie (Sprungtreiber, Zustand nur im Speicher)", /if \(d === "ausgang\.js" \|\| d === "sleevecrime\.js"\) return false;/.test(df));
pruefe("  Pause je Opfer", /VERDRAENG_PAUSE_MS/.test(df));
pruefe("  prueft die Waechtersperre der Werkbank", /wirtGesperrt\(d, werkbank\)/.test(df));
pruefe("  prueft den Platz auf der Werkbank", /freiAuf\(werkbank\) \+ arbeiterGbAuf\(werkbank\) >= gb/.test(df));
pruefe("verdraengtAm lebt ueber Rundengrenzen (vor der Rundenschleife)",
  kern.indexOf("const verdraengtAm = new Map()") > 0 && kern.indexOf("const verdraengtAm = new Map()") < kern.indexOf("const RESERVIERUNG_MS"));
// Skeptiker Runde 2 (Mock): beendet und erst naechste Runde gestartet, fuellten
// die uebrigen fehlenden Werkzeuge die Werkbank - das Opfer blieb 90 min tot.
// Jetzt: erst Platz auf der Werkbank, dann kill, dann sofort exec dort.
const um = kern.slice(stelle, stelle + 1800);
const iRaeum = um.indexOf("ns.scriptKill(w, werkbank)");
const iKill = um.indexOf("ns.kill(opfer.pid)");
const iExec = um.indexOf("ns.exec(opfer.file, werkbank, 1");
pruefe("Umzug in einem Zug: Werkbank raeumen -> kill -> exec auf der Werkbank",
  iRaeum > 0 && iKill > iRaeum && iExec > iKill, [iRaeum, iKill, iExec].join("/"));
pruefe("  kill nur, wenn auf der Werkbank wirklich Platz ist",
  /freiAuf\(werkbank\) >= opfer\.gb && ns\.kill\(opfer\.pid\)/.test(um));
pruefe("  Bibliotheken und Argumente aus WERKZEUGE mitgenommen",
  /ns\.scp\(\[opfer\.file, \.\.\.BIBLIOTHEKEN, \.\.\.\(oLibs \|\| \[\]\)\], werkbank, "home"\)/.test(um)
  && /\.\.\.\(oArgs \|\| \[\]\)/.test(um));
pruefe("keine Lese-Abhaengigkeit von ausgang.json mehr (sprungOffen entfernt)", !/sprungOffen/.test(kern));
pruefe("  danach greift der alte Wartezweig weiter", /if \(regel === "home" && freiAuf\("home"\) < braucht\) \{/.test(kern.slice(stelle)));

console.log(rot ? "\nROT: " + rot : "\nalles gruen");
process.exit(rot ? 1 : 0);
