/** Regressionstest: Zaehlt die Stillstandsuhr ueber einen Einbau hinweg?
 *
 * Dieser Fehler kam ZWEIMAL zurueck - am 27.08. um 03:52 und um 14:40, beide
 * Male mit derselben Wirkung: "STAGNATION: Kampfwert-Tiefstand steht seit
 * <viele hundert> min auf 1", waehrend bbtrain planmaessig hochtrainierte.
 * Die Wache geht dabei in ihren Eingriffsmodus, im denkbar schlechtesten
 * Moment. Beim ersten Mal wurde ein Symptom behoben; der Fix half nur ab dem
 * ZWEITEN Lauf nach dem Einbau, weil er den Phasenwechsel im gespeicherten
 * Verlauf suchte - dort steht beim ersten Lauf aber noch kein Punkt der neuen
 * Phase.
 *
 * Getestet wird der Schnitt aus `tools/strategie-check.js` isoliert: Welche
 * Punkte bleiben in `frueher` stehen, wenn ein Einbau gerade stattgefunden
 * hat? Zwei Faelle, beide echt aufgetreten.
 *
 *   node tools/test-stillstandsuhr.js
 */
const PHASE = "Wiederaufbau nach Einbau";

/** Der Schnitt, wie er in strategie-check.js steht (Stand 16:52). */
function schnitt(punkte, traeger) {
  let frueher = punkte.filter((x) => x.traeger === traeger);
  const alle = punkte;
  const letzte = alle.length ? alle[alle.length - 1].phase : null;
  if (letzte !== null && letzte !== PHASE) {
    frueher = [];
  } else {
    let idx = -1;
    for (let i = alle.length - 1; i > 0; i--) {
      if (alle[i].phase === PHASE && alle[i - 1].phase !== PHASE) { idx = i; break; }
    }
    if (idx >= 0) frueher = frueher.filter((x) => x.zeit >= alle[idx].zeit);
  }
  return frueher;
}

const min = (h, m) => new Date(2026, 7, 27, h, m).getTime();
let fehler = 0;
const pruefe = (name, ist, soll) => {
  const ok = ist === soll;
  if (!ok) fehler++;
  console.log((ok ? "OK   " : "FEHL ") + name + ": " + ist + " (erwartet " + soll + ")");
};

// Fall 1: DER ERSTE LAUF NACH DEM EINBAU (14:40).
// Der Verlauf endet in "Black Operations"; der aktuelle Punkt der neuen
// Wiederaufbauphase ist noch nicht angehaengt. Der alte Schnitt fand den
// Beginn der VORIGEN Wiederaufbauphase um 03:51 und behielt deren Punkte -
// daraus wurden die gemeldeten 649 Minuten.
const verlauf1 = [
  { zeit: min(3, 51), phase: PHASE, traeger: "Kampfwert-Tiefstand", wert: 1 },
  { zeit: min(3, 55), phase: PHASE, traeger: "Kampfwert-Tiefstand", wert: 1 },
  { zeit: min(4, 0), phase: "Black Operations", traeger: "Bladeburner-Rang", wert: 3000 },
  { zeit: min(14, 35), phase: "Black Operations", traeger: "Bladeburner-Rang", wert: 5400 },
];
pruefe("erster Lauf nach dem Einbau laesst nichts stehen",
  schnitt(verlauf1, "Kampfwert-Tiefstand").length, 0);

// Fall 2: DER ZWEITE LAUF (14:45). Jetzt steht ein Punkt der neuen Phase im
// Verlauf. Der Schnitt muss ihn behalten - und nur ihn, nicht die Punkte der
// Wiederaufbauphase von 03:51.
const verlauf2 = verlauf1.concat([
  { zeit: min(14, 40), phase: PHASE, traeger: "Kampfwert-Tiefstand", wert: 1 },
]);
const b = schnitt(verlauf2, "Kampfwert-Tiefstand");
pruefe("zweiter Lauf behaelt genau den neuen Punkt", b.length, 1);
pruefe("und zwar den von 14:40", b.length ? new Date(b[0].zeit).getHours() : -1, 14);

// Fall 3: Kein Einbau in Sicht - ein reiner Wiederaufbauverlauf bleibt ganz.
const verlauf3 = [
  { zeit: min(14, 40), phase: PHASE, traeger: "Kampfwert-Tiefstand", wert: 1 },
  { zeit: min(14, 45), phase: PHASE, traeger: "Kampfwert-Tiefstand", wert: 40 },
];
pruefe("laufender Wiederaufbau bleibt vollstaendig",
  schnitt(verlauf3, "Kampfwert-Tiefstand").length, 2);

console.log(fehler ? "\n" + fehler + " Test(s) fehlgeschlagen." : "\nAlle Tests bestanden.");
process.exit(fehler ? 1 : 0);
