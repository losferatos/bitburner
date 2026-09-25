/**
 * Ebene 0: V1-Referenzkurve (tools/lib/v1kurve.js, 25.09.2026).
 *
 * Geprueft wird, was die Fertig-Schaetzung im Hackingweg traegt: dass
 * Offline-Fenster abgezogen werden (eine tote Bruecke aber NICHT als offline
 * zaehlt), dass der Hoechststand monoton ist, obwohl das Level bei jedem
 * Einbau faellt, und dass die Restzeit an den Raendern nicht kippt.
 *
 * Aufruf: node tools/test-v1kurve.js
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const V = await import(pathToFileURL(path.join(ROOT, "tools", "lib", "v1kurve.js")).href);

let gruen = 0, rot = 0;
const fehler = [];
function pruefe(was, bedingung, zusatz = "") {
  if (bedingung) { gruen++; console.log("  ok    " + was); }
  else { rot++; fehler.push(was + (zusatz ? " - " + zusatz : "")); console.log("  ROT   " + was + (zusatz ? " - " + zusatz : "")); }
}
const H = 3600000, T0 = Date.parse("2026-09-24T14:00:00Z");
const iso = (ms) => new Date(ms).toISOString();

console.log("\n=== V1-Referenzkurve ===");

// Offline-Fenster: getrennt/verbunden; ein "verbunden" ohne vorheriges
// "getrennt" (Brueckenneustart bei laufendem Spiel) ist KEIN Fenster.
const log = [
  iso(T0 + 1 * H) + "\tinfo\tSpiel verbunden - Verifikation laeuft",
  iso(T0 + 2 * H) + "\tinfo\tSpielverbindung getrennt - warte auf neue Verbindung",
  iso(T0 + 5 * H) + "\tinfo\tSpiel verbunden - Verifikation laeuft",
].join("\n");
const f = V.offlineFenster(log);
pruefe("ein Fenster 2h-5h", f.length === 1 && f[0][0] === T0 + 2 * H && f[0][1] === T0 + 5 * H, JSON.stringify(f));
pruefe("Online 0-10h minus 3h = 7h", Math.abs(V.onlineStunden(T0, T0 + 10 * H, f) - 7) < 1e-9);
pruefe("Online 3h-4h (ganz offline) = 0", V.onlineStunden(T0 + 3 * H, T0 + 4 * H, f) === 0);
const offenBleibt = V.offlineFenster(iso(T0 + 2 * H) + "\tinfo\tSpielverbindung getrennt");
pruefe("offenes Fenster zaehlt bis jetzt", V.onlineStunden(T0, T0 + 5 * H, offenBleibt) === 2);

// Hoechststand monoton trotz Einbau-Einbruch.
const pkt = V.kurvenPunkte([
  { ts: T0 + 1 * H, level: 160 }, { ts: T0 + 2 * H, level: 360 },
  { ts: T0 + 3 * H, level: 20 }, { ts: T0 + 6 * H, level: 800 },
], T0, f);
pruefe("Hoechststand faellt nicht beim Einbau", pkt[2].maxLevel === 360, JSON.stringify(pkt));
pruefe("Punkt nach dem Fenster: 6h Wanduhr = 3h online", pkt[3].h === 3, JSON.stringify(pkt[3]));

// Restzeit: Interpolation und Raender.
const ref = { gesamtH: 10, punkte: [{ h: 1, maxLevel: 100 }, { h: 3, maxLevel: 300 }, { h: 5, maxLevel: 300 }, { h: 9, maxLevel: 900 }] };
pruefe("mittig interpoliert: 200 -> refH 2, Rest 8", (() => { const r = V.restzeitV1(ref, 200); return r && r.refH === 2 && r.restH === 8; })());
pruefe("Plateau: erster Zeitpunkt zaehlt (300 -> refH 3)", V.restzeitV1(ref, 300).refH === 3);
pruefe("unter dem ersten Punkt: refH 1", V.restzeitV1(ref, 5).refH === 1);
pruefe("ueber dem Hoechststand: jenseits, Rest = Schlussphase 1h", (() => { const r = V.restzeitV1(ref, 5000); return r.jenseits && r.restH === 1; })());
pruefe("ohne Referenz: null", V.restzeitV1(null, 100) === null && V.restzeitV1(ref, NaN) === null);
pruefe("Wanduhr ohne hWand-Felder: null statt Unsinn", V.restzeitV1(ref, 200, "wand") === null);
const ref2 = { gesamtH: 10, wandH: 16, punkte: [{ h: 1, hWand: 1, maxLevel: 100 }, { h: 3, hWand: 9, maxLevel: 300 }] };
pruefe("Wanduhr: 200 -> refH 5, Rest 11 (Online-Uhr: Rest 8)", (() => {
  const w = V.restzeitV1(ref2, 200, "wand"), o = V.restzeitV1(ref2, 200);
  return w && w.refH === 5 && w.restH === 11 && o.restH === 8;
})());
pruefe("Kurvenpunkte tragen beide Uhren", pkt[3].hWand === 6 && pkt[3].h === 3);

// Laufgrenzen aus dem Index.
const idx = ["ts\tdatei\tsha\tid\tbitNode\tlauf\ttotalPlaytime\tanlass",
  iso(T0) + "\ta\tx\ty\t9\t3\t1\tpre-jump",
  iso(T0 + H) + "\tb\tx\ty\t1\t2\t1\thourly",
  iso(T0 + 5 * H) + "\tc\tx\ty\t1\t2\t1\tpre-jump",
  iso(T0 + 6 * H) + "\td\tx\ty\t1\t3\t1\thourly"].join("\n");
const g = V.laufGrenzen(V.indexZeilen(idx), 1, 2);
pruefe("Lauf BN1.2: Beginn = Sprung aus BN9, Ende = eigener pre-jump", g.start === T0 && g.ende === T0 + 5 * H, JSON.stringify(g));
const g3 = V.laufGrenzen(V.indexZeilen(idx), 1, 3);
pruefe("laufender Lauf BN1.3: Beginn = Sprung aus BN1.2, kein Ende", g3.start === T0 + 5 * H && g3.ende === null);

// Die echte Referenz, falls gebaut: monoton und mit Ende hinter dem letzten Punkt.
const echt = path.join(ROOT, "data", "v1kurve-BN1.json");
if (fs.existsSync(echt)) {
  const k = JSON.parse(fs.readFileSync(echt, "utf8"));
  const mono = k.punkte.every((p, i) => i === 0 || (p.h >= k.punkte[i - 1].h && p.maxLevel >= k.punkte[i - 1].maxLevel));
  pruefe("data/v1kurve-BN1.json monoton", mono);
  pruefe("gesamtH >= letzter Punkt", k.gesamtH >= k.punkte[k.punkte.length - 1].h);
}

console.log("\n=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const x of fehler) console.log("  ROT: " + x); }
console.log("");
process.exit(rot ? 1 : 0);
