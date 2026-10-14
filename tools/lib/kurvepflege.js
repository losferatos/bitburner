/**
 * Die Referenzkurve nachziehen, wenn ein besserer Lauf abgeschlossen ist
 * (05.10.2026).
 *
 * Befund: BN2.2 kam auf Rang 550.010 in 19,8 h, die Kurve auf der Platte
 * stammte aber noch aus BN2.1 (488.516 in 29,1 h). Gebaut wurde sie nur von
 * Hand (tools/rangkurve-bauen.js), und nach dem Sprung in BN2.3 rechnete der
 * Check-in die ETA mit 29,1 statt 19,8 h - Faktor 1,5 daneben.
 *
 * Jetzt baut checkin.js bei jedem Besuch eine Kandidatenkurve (mit
 * Sicherungen, in eine Temp-Datei) und ersetzt die gespeicherte NUR, wenn
 * der Kandidat ein vollstaendiger, schnellerer Lauf ist. Damit kann eine
 * zerfallene Laufzerlegung (der Grund, warum --mit-sicherungen opt-in ist,
 * BN10 am 04.10.) nichts verschlechtern - sie wird verworfen.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const AUSGANG_RANG = 400000;

/**
 * Spielzeit, die beim Bladeburner WIRKLICH abgearbeitet ist (05.10.2026).
 *
 * Offline-Zeit landet voll in totalPlaytime, Bladeburner bekommt sie aber als
 * storedCycles und holt sie erst nach dem Wiederverbinden nach - mit
 * hoechstens 5 Sekunden je Tick (Bladeburner.ts:1375-1378, 5 Zyklen = 1 s,
 * Zyklus 200 ms). Gemessen BN2.2: Sicherung 04:49 hatte 98.281 Zyklen =
 * 5,46 h im Vorrat; die Kurve zeigte 5,5 h Stillstand und danach 489.000 Rang
 * in 15 Minuten. Abgezogen ist die Zeitachse wieder die des Fortschritts.
 * @param {number} totalPlaytime ms
 * @param {number} storedCycles Bladeburner-Vorrat
 */
export function effektiveSpielzeit(totalPlaytime, storedCycles) {
  const vorrat = Number.isFinite(storedCycles) && storedCycles > 0 ? storedCycles * 200 : 0;
  return totalPlaytime - vorrat;
}
export const START_RANG_MAX = 1000;
// Groesste erlaubte Strecke ohne Messpunkt in einer Kandidatenkurve.
// 6 statt 3 (14.10.2026): Nach einer Offline-Nacht laeuft die bereinigte
// Spielzeit im Nachholbetrieb 15- bis 25-mal schneller als die Wanduhr, die
// stuendlichen Sicherungen liegen dann 5 h Spielzeit auseinander (BN6.2,
// BN11.3). Mit 3 h fiel jeder Lauf mit Offline-Phase heraus. Das 11-h-Loch
// von BN2.3, fuer das die Regel gebaut wurde, bleibt ausgeschlossen.
export const LUECKE_MAX_H = 6;

/**
 * Rein: ersetzt `neu` die Kurve `alt`? Bedingungen fuer `neu`: beginnt im
 * Anlauf (erster Rang < START_RANG_MAX), erreicht den Ausgang, und ist
 * schneller als `alt` - oder `alt` fehlt bzw. erreicht den Ausgang nicht.
 * @returns {{ersetzen:boolean, grund:string}}
 */
export function kurveErsetzen(alt, neu) {
  const max = (k) => (k && Array.isArray(k.rangSpanne) ? Number(k.rangSpanne[1]) : NaN);
  const start = (k) => (k && Array.isArray(k.punkte) && k.punkte.length ? Number(k.punkte[0].rang) : NaN);
  if (!neu || !Array.isArray(neu.punkte) || neu.punkte.length < 5) return { ersetzen: false, grund: "Kandidat leer" };
  if (!(start(neu) < START_RANG_MAX)) return { ersetzen: false, grund: "Kandidat beginnt nicht im Anlauf" };
  if (!(max(neu) >= AUSGANG_RANG)) return { ersetzen: false, grund: "Kandidat erreicht den Ausgang nicht" };
  if (!(Number(neu.dauerH) > 0)) return { ersetzen: false, grund: "Kandidat ohne Dauer" };
  // Ein Kandidat mit Messloch ersetzt nichts (11.10.2026, Skeptiker: BN2.3
  // haette mit 11 h ohne Punkt die dichte BN2.2-Kurve verdraengt).
  let luecke = 0;
  for (let i = 1; i < neu.punkte.length; i++) luecke = Math.max(luecke, Number(neu.punkte[i].h) - Number(neu.punkte[i - 1].h));
  if (luecke > LUECKE_MAX_H) return { ersetzen: false, grund: "Kandidat mit Messloch " + luecke.toFixed(1) + " h" };
  if (!alt || !(max(alt) >= AUSGANG_RANG) || !(Number(alt.dauerH) > 0)) {
    return { ersetzen: true, grund: "bisherige Kurve fehlt oder ist unvollstaendig" };
  }
  // Die bisherige Kurve beginnt nach dem Anlauf (14.10.2026, BN6.1 ab Rang
  // 80.340): ein Kandidat, der den Anlauf abdeckt, ersetzt sie - die
  // Restzeit ab Rang 0 kannte sie gar nicht.
  if (!(start(alt) < START_RANG_MAX)) {
    return { ersetzen: true, grund: "bisherige Kurve deckt den Anlauf nicht ab (Start Rang " + start(alt) + ")" };
  }
  // Ab Knotenstart vergleichen, wenn beide Kurven den Abstand kennen
  // (11.10.2026): BN11.2 lag ab erstem Rangpunkt bei 22,5 h gegen 17,8 h,
  // ab Knotenstart aber bei 23,5 h gegen 28,5 h - die Anlaufzeit vor dem
  // ersten Rang gehoert zum Lauf.
  const abStart = (k) => {
    const off = k && k.nullpunkt ? k.nullpunkt.hSeitKnotenstart : null;
    return Number.isFinite(off) && off >= 0 ? Number(k.dauerH) + off : null;
  };
  const tAlt = abStart(alt) !== null && abStart(neu) !== null ? abStart(alt) : Number(alt.dauerH);
  const tNeu = abStart(alt) !== null && abStart(neu) !== null ? abStart(neu) : Number(neu.dauerH);
  if (tNeu < tAlt - 0.05) {
    return { ersetzen: true, grund: "schneller: " + tNeu.toFixed(1) + " h statt " + tAlt.toFixed(1) + " h" };
  }
  return { ersetzen: false, grund: "nicht schneller" };
}

/**
 * Baut die Kandidatenkurve und ersetzt die gespeicherte, wenn kurveErsetzen
 * es erlaubt. Fehler sind nie fatal (der Check-in laeuft mit der alten
 * Kurve weiter). Muss VOR dem ersten Lesen der Kurve laufen (lib/rangkurve.js
 * cacht je Prozess).
 * @returns {string|null} Meldung, wenn ersetzt wurde
 */
export function kurveAuffrischen(root, knoten) {
  const ziel = path.join(root, "doku", "rangkurve-bn" + knoten + ".json");
  const temp = path.join(os.tmpdir(), "rangkurve-kandidat-bn" + knoten + "-" + process.pid + ".json");
  try {
    execFileSync(process.execPath, [path.join(root, "tools", "rangkurve-bauen.js"),
      "--knoten", String(knoten), "--mit-sicherungen", "--out", temp],
    { cwd: root, stdio: "ignore", timeout: 30000 });
    const neu = JSON.parse(fs.readFileSync(temp, "utf8"));
    let alt = null;
    try { alt = JSON.parse(fs.readFileSync(ziel, "utf8")); } catch { alt = null; }
    const e = kurveErsetzen(alt, neu);
    if (!e.ersetzen) return null;
    fs.copyFileSync(temp, ziel);
    return "Referenzkurve BN" + knoten + " neu gebaut (" + e.grund + ").";
  } catch {
    return null;
  } finally {
    try { fs.rmSync(temp, { force: true }); } catch { /* egal */ }
  }
}
