/**
 * Stadtwahl nach ECHTER Bevoelkerung statt popEst (04.10.2026).
 *
 * Befund BitNode 2.2, 16:57: blade.js sass in Sector-12 (popEst 765 Mio,
 * real r = 0,46 davon), weil gescheiterte Raids nur `pop` senken, nicht
 * `popEst` (Bladeburner.ts:837-842). Die Stadtwahl verglich popEst und sah
 * keinen Grund zu wechseln; real war Raid dort 7,5 Prozent, in Chongqing 25.
 * Der Rang fiel in einer Stunde von 812 auf 710.
 *
 * Der Test extrahiert die REALEN Funktionen `rAusBlackOp` und
 * `popEchtGeschaetzt` aus src/blade.js und faehrt die Stadtwahl mit den
 * gemessenen Spannenpaaren aller sechs Staedte (data/probe-raid.json vom
 * 04.10. 16:57, unten als Konstante). Erwartung: neue Regel wechselt nach
 * Chongqing, alte (popEst) bleibt in Sector-12. Dazu Quelltextpruefungen:
 * Rueckwechsel im finally, kein await im Probenblock.
 *
 * Gegen die alte Fassung ROT: popEchtGeschaetzt fehlt.
 *
 * Aufruf: node tools/test-stadtwahl-echtpop.js [pfad/zu/blade.js]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATEI = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "src", "blade.js");
const quelle = fs.readFileSync(DATEI, "utf8");

let gruen = 0, rot = 0;
const pruefe = (name, ok, info = "") => {
  if (ok) { gruen++; console.log("  ok    " + name + (info ? "  (" + info + ")" : "")); }
  else { rot++; console.log("  ROT   " + name + (info ? " - " + info : "")); }
};

// Klammerzaehlung wie in tools/test-d2-wahre-chance.js.
function extrahiere(text, name) {
  const start = text.indexOf("const " + name + " = ");
  if (start < 0) return null;
  const k = text.indexOf("{", start);
  if (k < 0) return null;
  let tiefe = 0, i = k;
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "/") { const nl = text.indexOf("\n", i); i = nl < 0 ? text.length : nl; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; i++;
      while (i < text.length && text[i] !== q) { if (text[i] === "\\") i++; i++; }
      continue;
    }
    if (c === "{") tiefe++;
    else if (c === "}") { tiefe--; if (tiefe === 0) break; }
  }
  if (tiefe !== 0) return null;
  return text.slice(start, text[i + 1] === ";" ? i + 2 : i + 1);
}

console.log("\n=== Stadtwahl nach echter Bevoelkerung ===\n");

const qR = extrahiere(quelle, "rAusBlackOp");
const qP = extrahiere(quelle, "popEchtGeschaetzt");
pruefe("rAusBlackOp im Quelltext", !!qR);
pruefe("popEchtGeschaetzt im Quelltext", !!qP, qP ? "" : "alte Fassung");

let rAusBlackOp = null, popEchtGeschaetzt = null;
if (qR && qP) {
  ({ rAusBlackOp, popEchtGeschaetzt } = new Function(qR + "\n" + qP + "\nreturn { rAusBlackOp, popEchtGeschaetzt };")());
}

// Gemessen 04.10.2026 16:57 (data/probe-raid.json), naechste Black Op
// Operation Typhoon, echte Chance 0.060217523983598455 (Obergrenze in den
// Staedten mit r<1, Untergrenze in denen mit r>1 - beide Male derselbe Wert).
const BO_REAL = 0.060217523983598455;
const MESSUNG = {
  "Sector-12": { bo: [0.027628144453117745, 0.060217523983598455], popEst: 764872916, chaos: 17.53, comms: 133 },
  "Aevum": { bo: [0.01755683948223077, 0.060217523983598455], popEst: 1485927889, chaos: 0, comms: 65 },
  "Volhaven": { bo: [0.060217523983598455, 0.08697875801902075], popEst: 1361902107, chaos: 0.12, comms: 98 },
  "Chongqing": { bo: [0.060217523983598455, 0.13549810170716356], popEst: 893414876, chaos: 0, comms: 81 },
  "New Tokyo": { bo: [0.060217523983598455, 0.09407754813826337], popEst: 1059786358, chaos: 0.41, comms: 129 },
  "Ishima": { bo: [0.05641038156023503, 0.060217523983598455], popEst: 1295966554, chaos: 0.54, comms: 95 },
};
const faktor = (chaos) => (chaos > 50 ? Math.sqrt(1 + chaos - 50) : 1);

// Nachbau der Wahl in blade.js (Vorsprung 2), einmal mit, einmal ohne r.
function waehle(hier, mitR, messung = MESSUNG) {
  const MESSUNG_ = messung;
  const wert = (st) => {
    const m = MESSUNG_[st];
    const rr = mitR ? rAusBlackOp({ min: m.bo[0], max: m.bo[1] }, BO_REAL) : null;
    return (mitR ? popEchtGeschaetzt(m.popEst, rr) : m.popEst) / faktor(m.chaos);
  };
  const wHier = wert(hier);
  let beste = null, bw = wHier;
  for (const st of Object.keys(MESSUNG_)) {
    if (st === hier) continue;
    if (MESSUNG_[st].comms < 3) continue;
    const w = wert(st);
    if (w > bw) { bw = w; beste = st; }
  }
  return beste && bw > wHier * 2 ? beste : hier;
}

if (rAusBlackOp && popEchtGeschaetzt) {
  const r12 = rAusBlackOp({ min: MESSUNG["Sector-12"].bo[0], max: MESSUNG["Sector-12"].bo[1] }, BO_REAL);
  pruefe("r in Sector-12 = 0,459 und sicher", r12.sicher && Math.abs(r12.r - 0.4588) < 0.001, r12.r.toFixed(4));
  const rCq = rAusBlackOp({ min: MESSUNG.Chongqing.bo[0], max: MESSUNG.Chongqing.bo[1] }, BO_REAL);
  pruefe("r in Chongqing = 2,25 und sicher", rCq.sicher && Math.abs(rCq.r - 2.2501) < 0.001, rCq.r.toFixed(4));

  pruefe("alte Regel (popEst) bleibt in Sector-12 - der Befund", waehle("Sector-12", false) === "Sector-12");
  const neu = waehle("Sector-12", true);
  pruefe("neue Regel wechselt nach Chongqing", neu === "Chongqing", neu);
  pruefe("aus Chongqing kein Rueckwechsel (kein Pendeln)", waehle("Chongqing", true) === "Chongqing");

  pruefe("unsicher mit r<=1: popEst unveraendert", popEchtGeschaetzt(1e9, { r: 1, sicher: false }) === 1e9);
  pruefe("fehlendes r: popEst unveraendert", popEchtGeschaetzt(1e9, null) === 1e9);
  pruefe("NaN-r: popEst unveraendert", popEchtGeschaetzt(1e9, { r: NaN, sicher: true }) === 1e9);
  pruefe("unsicher mit r>1: Untergrenze popEst*r statt popEst (Befund 1)", popEchtGeschaetzt(1e9, { r: 2, sicher: false }) === 2e9);
  // Kippfall: in Chongqing klemmt die Black-Op-Obergrenze (boReal 0,5 dort
  // 1,0) - r unsicher, 1/0,5 = 2. Darf NICHT nach Volhaven (r 1,44 sicher)
  // ziehen, denn echt stehen 2,0 Mrd gegen 1,97 Mrd.
  {
    const rrCq = rAusBlackOp({ min: 0.5, max: 1 }, 0.5);
    const cq = popEchtGeschaetzt(MESSUNG.Chongqing.popEst, rrCq);
    const vh = popEchtGeschaetzt(MESSUNG.Volhaven.popEst, rAusBlackOp({ min: 0.5, max: 0.722 }, 0.5));
    pruefe("Kippfall: Chongqing unsicher, kein Wechsel nach Volhaven", !rrCq.sicher && !(vh > 2 * cq), (cq / 1e6).toFixed(0) + " gegen " + (vh / 1e6).toFixed(0) + " Mio");
  }
  {
    const ohneGemeinden = JSON.parse(JSON.stringify(MESSUNG));
    ohneGemeinden.Chongqing.comms = 2; ohneGemeinden.Volhaven.comms = 2;
    const z = waehle("Sector-12", true, ohneGemeinden);
    pruefe("Ziele unter RAID_VORRAT_MIN Gemeinden fallen raus (Befund 2)", z === "New Tokyo", z);
  }
  pruefe("sicheres r: popEst * r", popEchtGeschaetzt(1e9, { r: 0.5, sicher: true }) === 5e8);
}

// FEINWAHL (16.10.2026): BitNode 7.1, 12:57 - Volhaven 0,43 Mrd echt, Chaos
// 26, Sector-12 0,55 Mrd, Chaos 22 (tools-Nachrechnung: Raid 0,169 gegen
// 0,205). Die grobe Regel (linear, Vorsprung 2) blieb. Gegen die alte
// Fassung ROT: feinWahl fehlt.
{
  const qF = extrahiere(quelle, "feinWahl");
  const mV = quelle.match(/const FEIN_VORSPRUNG = ([\d.]+);/);
  pruefe("feinWahl im Quelltext", !!qF && !!mV, qF ? "" : "alte Fassung");
  if (qF && mV) {
    const feinWahl = new Function("const FEIN_VORSPRUNG = " + mV[1] + ";\n" + qF + "\nreturn feinWahl;")();
    const st = (stadt, pop, chaos, sicher = true, comms = 100) => ({ stadt, pop, chaos, sicher, comms });
    const bn7 = [st("Aevum", 0.766e9, 64.8), st("Chongqing", 1.169e9, 59.6), st("Sector-12", 0.554e9, 22.0),
      st("New Tokyo", 0.217e9, 6.0)];
    pruefe("BN7.1-Befund: aus Volhaven nach Sector-12", feinWahl(st("Volhaven", 0.43e9, 26.2), bn7, 55) === "Sector-12");
    pruefe("aus Sector-12 kein Rueckwechsel nach Volhaven (kein Pendeln)",
      feinWahl(st("Sector-12", 0.554e9, 22), [st("Volhaven", 0.43e9, 26.2)], 55) === null);
    pruefe("unter 15 % Vorsprung kein Wechsel",
      feinWahl(st("Volhaven", 0.5e9, 20), [st("Sector-12", 0.55e9, 20)], 55) === null);
    pruefe("nie Bevoelkerung gegen Chaos tauschen (Einwand 22.09.)",
      feinWahl(st("Aevum", 1.2e9, 70), [st("New Tokyo", 0.5e9, 0)], 55) === null);
    pruefe("Ziel mit unsicherem r zaehlt nicht",
      feinWahl(st("Volhaven", 0.43e9, 26), [st("Sector-12", 0.9e9, 0, false)], 55) === null);
    pruefe("hier unsicher: keine Feinwahl",
      feinWahl(st("Volhaven", 0.43e9, 26, false), [st("Sector-12", 0.9e9, 0)], 55) === null);
    pruefe("Ziel mit 4 Gemeinden zaehlt nicht (Skeptiker 1)",
      feinWahl(st("Volhaven", 0.43e9, 26), [st("Sector-12", 0.9e9, 0, true, 4)], 55) === null);
    pruefe("mehr Bevoelkerung UND weniger Chaos: Wechsel",
      feinWahl(st("Ishima", 0.6e9, 58), [st("Chongqing", 0.7e9, 40)], 55) === "Chongqing");
  }
  pruefe("Feinwahl haengt am else der groben Regel, gesperrt beim Chaos-Aufraeumen",
    /STADT_VORSPRUNG\) \{[\s\S]{0,400}\} else if \(!chaosAufraeumen && [\s\S]{0,300}"Diplomacy"[\s\S]{0,200}const ziel = feinWahl\(feinHier, fein, RUNDREISE_MIN_COMMS\);/.test(quelle));
}

// Quelltext: der Probenblock stellt die Stadt im finally zurueck und
// enthaelt kein await (sonst koennte eine Aktion in der Probestadt enden).
const a = quelle.indexOf("const rJetzt = ");
const e = a >= 0 ? quelle.indexOf("if (beste && besterWert > wertHier * STADT_VORSPRUNG)", a) : -1;
const block = a >= 0 && e > a ? quelle.slice(a, e) : "";
pruefe("Probenblock gefunden", block.length > 0);
pruefe("Rueckwechsel im finally", /finally\s*\{\s*ns\.bladeburner\.switchCity\(hier\);/.test(block));
pruefe("Ziel-Filter auf Gemeinden im Quelltext", block.includes("RAID_AN && staedteGemeinden(stadt) < RAID_VORRAT_MIN"));
pruefe("Spanne {0,0} gilt nicht als r=0", block.includes("if (!(sp.max > 0)) return null;"));
pruefe("kein await im Probenblock", block.length > 0 && !/\bawait\b/.test(block.replace(/\/\/.*$/gm, "")));

console.log("\n=== " + gruen + " gruen, " + rot + " rot ===\n");
process.exit(rot ? 1 : 0);
