/**
 * Stadtwahl nach Wert statt Gemeinden (23.10.2026).
 *
 * Befund BitNode 7.3 ab Spielstunde 43: Der Bot sass elf Stunden in Ishima
 * (echt 0,17-0,41 Mrd), weil Volhaven (echt 1,75 Mrd, Chaos um 45) nur 2
 * Gemeinden hatte - die grobe Stadtwahl liess Staedte unter
 * RAID_VORRAT_MIN nicht zu, und die Rundreise zog zur Stadt mit den meisten
 * Gemeinden, egal wie leer. Gemeinden braucht nur Raid.
 *
 * Daten: Probe data/probe-raid.json vom 23.10.2026 15:31 (alle sechs
 * Staedte, naechste Black Op Operation Typhoon). Der Test extrahiert
 * rAusBlackOp, popEchtGeschaetzt, sureValues, roundTripAllowed und
 * lowCommsTargetAllowed aus src/blade.js und faehrt beide Regeln als
 * Nachbau; dazu Quelltextpruefungen, dass der Nachbau der Datei entspricht.
 *
 * Gegen den alten Stand ROT: die Funktionen fehlen, der Filter ist hart.
 *
 * Aufruf: node tools/test-rundreise-wert.js [pfad/zu/blade.js]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATEI = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "src", "blade.js");
const quelle = fs.readFileSync(DATEI, "utf8").replace(/\r\n/g, "\n");

let gruen = 0, rot = 0;
const pruefe = (name, ok, info = "") => {
  if (ok) { gruen++; console.log("  ok    " + name + (info ? "  (" + info + ")" : "")); }
  else { rot++; console.log("  ROT   " + name + (info ? " - " + info : "")); }
};

// Pfeilfunktion bis zur passenden Klammer; Einzeiler ohne Block bis ";".
function extrahiere(text, name) {
  const start = text.indexOf("const " + name + " = ");
  if (start < 0) return null;
  const pfeil = text.indexOf("=>", start);
  let j = pfeil + 2;
  while (/\s/.test(text[j])) j++;
  if (text[j] !== "{") return text.slice(start, text.indexOf(";\n", pfeil) + 1);
  let tiefe = 0, i = j;
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "/") { const nl = text.indexOf("\n", i); i = nl < 0 ? text.length : nl; continue; }
    if (c === "{") tiefe++;
    else if (c === "}") { tiefe--; if (tiefe === 0) break; }
  }
  return text.slice(start, text[i + 1] === ";" ? i + 2 : i + 1);
}

console.log("\n=== Stadtwahl nach Wert statt Gemeinden ===\n");

const qR = extrahiere(quelle, "rAusBlackOp");
const qP = extrahiere(quelle, "popEchtGeschaetzt");
const qS = extrahiere(quelle, "usableValue");
const qA = extrahiere(quelle, "roundTripAllowed");
const qL = extrahiere(quelle, "lowCommsTargetAllowed");
const mR = quelle.match(/const ROUND_TRIP_VALUE_MIN = ([\d.]+);/);
const mL = quelle.match(/const LOW_COMMS_LEAD = ([\d.]+);/);
const neu = !!(qS && qA && qL && mR && mL);
pruefe("usableValue, roundTripAllowed, lowCommsTargetAllowed im Quelltext", neu, neu ? "" : "alte Fassung");

const BO_REAL = 0.6239377089411591;
const PROBE = {
  "Sector-12": { bo: [0.15577864229826496, 0.6239377089411591], popEst: 1138204202, chaos: 96.58367650084915, comms: 122 },
  "Aevum": { bo: [0.6239377089411591, 1], popEst: 497775091, chaos: 133.69668611834527, comms: 51 },
  "Volhaven": { bo: [0.6239377089411591, 0.8477050219529615], popEst: 1289026189, chaos: 51.0061315465113, comms: 2 },
  "Chongqing": { bo: [0.11023149343463659, 0.6239377089411591], popEst: 1347259170, chaos: 67.42172919548042, comms: 3 },
  "New Tokyo": { bo: [0.5090664233725964, 0.6239377089411591], popEst: 1581269539, chaos: 69.26350287660618, comms: 2 },
  "Ishima": { bo: [0.06363228391768509, 0.6239377089411591], popEst: 1695847782, chaos: 9.741602918358437, comms: 5 },
};
const faktor = (chaos) => (chaos > 50 ? Math.sqrt(1 + chaos - 50) : 1);

if (qR && qP) {
  const { rAusBlackOp, popEchtGeschaetzt } = new Function(qR + "\n" + qP + "\nreturn { rAusBlackOp, popEchtGeschaetzt };")();
  const f = neu
    ? new Function("const ROUND_TRIP_VALUE_MIN = " + mR[1] + "; const LOW_COMMS_LEAD = " + mL[1] + ";\n"
      + qS + "\n" + qA + "\n" + qL + "\nreturn { roundTripAllowed, lowCommsTargetAllowed };")()
    : { roundTripAllowed: () => true, lowCommsTargetAllowed: () => false };   // alter Stand
  // info je Stadt wie cityInfo in blade.js; Wert direkt vorgebbar (value) oder aus Probe.
  const info = (m, st) => {
    const d = m[st];
    if (Number.isFinite(d.value)) return { value: d.value, sure: d.sure !== false && !d.lower, lower: !!d.lower };
    const rr = rAusBlackOp({ min: d.bo[0], max: d.bo[1] }, d.boReal ?? BO_REAL);
    return { value: popEchtGeschaetzt(d.popEst, rr) / faktor(d.chaos), sure: !!(rr && rr.sicher && Number.isFinite(rr.r)),
      lower: !!(rr && !rr.sicher && Number.isFinite(rr.r)) };
  };
  // Nachbau der groben Regel (Vorsprung 2) und der Rundreise (3 / 55).
  const grob = (hier, m) => {
    const iH = info(m, hier);
    let beste = null, bw = iH.value;
    for (const st of Object.keys(m)) {
      if (st === hier) continue;
      const iS = info(m, st);
      if (m[st].comms < 3 && !f.lowCommsTargetAllowed(iH, iS)) continue;
      if (iS.value > bw) { bw = iS.value; beste = st; }
    }
    return beste && bw > iH.value * 2 ? beste : hier;
  };
  const rundreise = (hier, m) => {
    if (m[hier].comms >= 3) return hier;
    const iH = info(m, hier);
    let beste = null, bc = 0, bw = -1;
    for (const st of Object.keys(m)) {
      if (st === hier || !(m[st].comms >= 55)) continue;
      const iS = info(m, st);
      if (!f.roundTripAllowed(iH, iS)) continue;
      const w = neu && iS.sure ? iS.value : -1;
      if (beste === null || w > bw || (w === bw && m[st].comms > bc)) { beste = st; bc = m[st].comms; bw = w; }
    }
    return beste || hier;
  };
  const runde = (hier, m = PROBE) => rundreise(grob(hier, m), m);

  const iI = info(PROBE, "Ishima"), iV = info(PROBE, "Volhaven");
  pruefe("Ishima echt 0,17 Mrd, Volhaven 1,24 Mrd je Chaos-Faktor, beide sicher",
    Math.abs(iI.value / 1e9 - 0.173) < 0.01 && Math.abs(iV.value / 1e9 - 1.236) < 0.01 && iI.sure && iV.sure,
    (iI.value / 1e9).toFixed(3) + " / " + (iV.value / 1e9).toFixed(3));
  const nach = runde("Ishima");
  pruefe("Befund 15:31: aus Ishima nach Volhaven (Faktor 7)", nach === "Volhaven", nach);
  pruefe("Volhaven mit 2 Gemeinden: Rundreise zieht NICHT nach Sector-12", rundreise("Volhaven", PROBE) === "Volhaven");
  pruefe("Volhaven stabil ueber zehn Runden", (() => { let h = "Volhaven"; for (let i = 0; i < 10; i++) h = runde(h); return h; })() === "Volhaven");

  // Hysterese (Skeptiker Alltag, Befund 1): H 2 Gemeinden Wert 1,0; Z 100
  // Gemeinden Wert 0,6 -> Rundreise nach Z. Ein Raid in Z senkt den Wert
  // um ~0,75 % - mit Schwelle 2 waere der Bot bei 0,5 sofort zurueck.
  const hz = (wz) => ({ H: { value: 1e9, comms: 2 }, Z: { value: wz, comms: 100 } });
  pruefe("Rundreise H -> Z bei Wert 0,6", runde("H", hz(0.6e9)) === "Z");
  pruefe("nach einem Raid in Z (0,595): kein Rueckwurf nach H", runde("Z", hz(0.595e9)) === "Z");
  pruefe("Grenzfall 0,5: Rundreise, dann bei 0,49 kein Rueckwurf",
    runde("H", hz(0.5e9)) === "Z" && runde("Z", hz(0.49e9)) === "Z");
  pruefe("erst unter einem Viertel zurueck nach H", runde("Z", hz(0.26e9)) === "Z" && runde("Z", hz(0.24e9)) === "H");
  pruefe("zurueck in H mit 0,24: Rundreise verzichtet (kein Pendeln)", runde("H", hz(0.24e9)) === "H");

  // Unsicheres r: Verhalten wie vor dem 23.10. (Befund 5).
  const unsicher = { H: { value: 1e9, comms: 2, sure: false }, Z: { value: 0.1e9, comms: 100 } };
  pruefe("hier unsicher: Rundreise zieht wie frueher", rundreise("H", unsicher) === "Z");
  const zielUnsicher = { H: { value: 0.1e9, comms: 50 }, Y: { value: 5e9, comms: 1, sure: false } };
  pruefe("Ziel ohne Gemeinden mit unsicherem r: grobe Regel laesst es aus", grob("H", zielUnsicher) === "H");
  pruefe("BN7.2 h23,9: Ziel ohne Gemeinden 2,96-fach - bleibt in der Raid-Stadt (Skeptiker Praemisse)",
    grob("H", { H: { value: 1e9, comms: 22 }, Y: { value: 2.96e9, comms: 2 } }) === "H");
  pruefe("Ziel ohne Gemeinden 3,9-fach: bleibt; 4,1-fach: zieht",
    grob("H", { H: { value: 1e9, comms: 50 }, Y: { value: 3.9e9, comms: 1 } }) === "H"
    && grob("H", { H: { value: 1e9, comms: 50 }, Y: { value: 4.1e9, comms: 1 } }) === "Y");

  // Nachmessung 23.10. 15:59: Volhavens Black-Op-Obergrenze klemmt bei 1,
  // r nur als Untergrenze (>= 1,595). Mit "nur sicher" blieb der Bot in
  // Ishima - die Untergrenze reicht fuer ein Ziel.
  const B2 = 0.6271;
  const P1559 = {
    "Sector-12": { boReal: B2, bo: [0.1566, B2], popEst: 1138e6, chaos: 96.4, comms: 122 },
    "Aevum": { boReal: B2, bo: [B2, 1], popEst: 498e6, chaos: 133.5, comms: 51 },
    "Volhaven": { boReal: B2, bo: [B2, 1], popEst: 1289e6, chaos: 50.8, comms: 2 },
    "Chongqing": { boReal: B2, bo: [0.1108, B2], popEst: 1347e6, chaos: 71.7, comms: 3 },
    "New Tokyo": { boReal: B2, bo: [0.5117, B2], popEst: 1581e6, chaos: 69.1, comms: 2 },
    "Ishima": { boReal: B2, bo: [0.0883, B2], popEst: 1696e6, chaos: 10.3, comms: 6 },
  };
  const iV2 = info(P1559, "Volhaven");
  pruefe("15:59: Volhaven nur Untergrenze (r >= 1,595)", !iV2.sure && iV2.lower, (iV2.value / 1e6).toFixed(0) + " Mio");
  pruefe("15:59: aus Ishima trotzdem nach Volhaven", runde("Ishima", P1559) === "Volhaven");
  pruefe("15:59: in Volhaven (Untergrenze) verzichtet die Rundreise auf Sector-12", rundreise("Volhaven", P1559) === "Volhaven");
  pruefe("hier nur Untergrenze: keine Stadt ohne Gemeinden (hier muss exakt sein)",
    grob("H", { H: { value: 1e9, comms: 50, lower: true }, Y: { value: 9e9, comms: 1 } }) === "H");
  pruefe("Ziel exakt 0 (tote Stadt): Rundreise verzichtet (Skeptiker Untergrenze F1)",
    rundreise("H", { H: { value: 1e9, comms: 2 }, Z: { value: 0, comms: 100 } }) === "H");
  pruefe("Ziel nur Untergrenze: Rundreise verzichtet nicht (Ziel koennte besser sein)",
    rundreise("H", { H: { value: 1e9, comms: 2 }, Z: { value: 0.1e9, comms: 100, lower: true } }) === "Z");

  // Bestes erlaubtes Ziel statt nur der meisten Gemeinden (Befund 4).
  const zwei = { H: { value: 1e9, comms: 2 }, A: { value: 0.1e9, comms: 120 }, B: { value: 0.9e9, comms: 60 } };
  pruefe("Rundreise waehlt B (Wert 0,9, 60 Gemeinden) statt A (0,1, 120)", rundreise("H", zwei) === "B");
  const ohneWerte = { H: { value: 1e9, comms: 2, sure: false }, A: { value: 0.1e9, comms: 120, sure: false }, B: { value: 0.9e9, comms: 60, sure: false } };
  pruefe("ohne sichere Werte: wie frueher die meisten Gemeinden", rundreise("H", ohneWerte) === "A");

  // Fruehes Spiel: Werte nah beieinander - die Rundreise zieht weiter.
  pruefe("fruehes Spiel: Rundreise zieht bei 0,75-fachem Wert",
    rundreise("V", { V: { value: 0.8e9, comms: 1 }, S: { value: 0.6e9, comms: 120 } }) === "S");
}

// Quelltext entspricht dem Nachbau.
const a = quelle.indexOf("const rJetzt = ");
const e = a >= 0 ? quelle.indexOf("if (beste && besterWert > wertHier * STADT_VORSPRUNG)", a) : -1;
const block = a >= 0 && e > a ? quelle.slice(a, e) : "";
pruefe("Probenblock gefunden", block.length > 0);
pruefe("grobe Regel: Filter nur noch ohne lowCommsTargetAllowed",
  /let w = 0;\s*try \{ w = wert\(stadt\); \} catch \{ continue; \}\s*if \(RAID_AN && staedteGemeinden\(stadt\) < RAID_VORRAT_MIN\s*&& !lowCommsTargetAllowed\(cityInfo\.get\(hier\), cityInfo\.get\(stadt\)\)\) continue;/.test(block));
pruefe("wert() haelt Wert und Sicherheit fest",
  /cityInfo\.set\(stadt, \{ value: pop \/ faktor, sure: eintrag\.sicher,\s*lower: !!\(rr && !rr\.sicher && Number\.isFinite\(rr\.r\)\) \}\);\s*return pop \/ faktor;/.test(block));
pruefe("cityInfo je Runde neu (vor stadtwahl null, im Block neue Map)",
  /let cityInfo = null;\s*stadtwahl: try \{/.test(quelle) && /let feinHier = null;\s*cityInfo = new Map\(\);/.test(quelle));
pruefe("Rundreise: nur Ziele ab RUNDREISE_MIN_COMMS, mit roundTripAllowed",
  /if \(!\(c >= RUNDREISE_MIN_COMMS\)\) continue;\s*const info = cityInfo \? cityInfo\.get\(stadt\) : null;\s*if \(!roundTripAllowed\(infoHier, info\)\)/.test(quelle));
pruefe("Rundreise: bester Wert, bei Gleichstand meiste Gemeinden",
  /const w = info && info.sure && Number.isFinite\(info\.value\) \? info\.value : -1;\s*if \(beste === null \|\| w > besteWert \|\| \(w === besteWert && c > besteComms\)\)/.test(quelle));

console.log("\n=== " + gruen + " gruen, " + rot + " rot ===\n");
process.exit(rot ? 1 : 0);
