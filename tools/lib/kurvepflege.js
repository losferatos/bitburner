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
export const START_RANG_MAX = 1000;

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
  if (!alt || !(max(alt) >= AUSGANG_RANG) || !(Number(alt.dauerH) > 0)) {
    return { ersetzen: true, grund: "bisherige Kurve fehlt oder ist unvollstaendig" };
  }
  if (Number(neu.dauerH) < Number(alt.dauerH) - 0.05) {
    return { ersetzen: true, grund: "schneller: " + Number(neu.dauerH).toFixed(1) + " h statt " + Number(alt.dauerH).toFixed(1) + " h" };
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
