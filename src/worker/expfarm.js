/**
 * Erfahrungsofen: weaken auf das Erfahrungsziel, bis zu einer Frist.
 *
 * WARUM DIESER ARBEITER ANDERS IST ALS DIE DREI NEBENAN
 *
 * hack.js, grow.js und weaken.js sind Einwegskripte: Sie erledigen genau eine
 * Aktion und beenden sich. Das ist fuer den Stapelbetrieb richtig - dort zaehlt
 * der Landezeitpunkt auf die Millisekunde.
 *
 * Fuer den Erfahrungsofen ist es bei hohem Level falsch, und zwar teuer:
 * bn4net.js legt den Speicherueberschuss jede Runde (~10 s) neu aus, eine
 * weaken-Aktion auf foodnstuff dauert bei Level 2871 aber nur 1,12 s. Als
 * Einwegwelle arbeitete der Faden eine Sekunde und lag neun tot - gemessen
 * 5-10 % Auslastung auf der Haelfte des Netzes (Audit 26.09.2026 2#1).
 *
 * WARUM MIT FRIST UND NICHT ENDLOS (Skeptiker B, Einwand 1, 26.09.2026)
 *
 * Die erste Fassung lief endlos, und bn4net toetete alle Ofenfaeden jede
 * Runde, um den Speicher fuer die Geldziele sichtbar zu machen. Erfahrung
 * gibt es aber nur beim ABSCHLUSS eines Aufrufs (NetscriptFunctions.ts:
 * 354-374, im .then nach netscriptDelay); ein Kill verwirft ihn
 * (killWorkerScript.ts:62-63). Dauert weaken laenger als eine Runde, brachte
 * der ganze Ofen null - nach einem Knotenwechsel (Mult 1,43) bis Level
 * 612-654, also stundenlang, waehrend die alte Einwegwelle dort lieferte.
 *
 * Jetzt bestimmt der Faden selbst, wann er aufhoert:
 *   - den ERSTEN Aufruf macht er immer. Ist die Aktion laenger als die Runde,
 *     ist das genau die alte Einwegwelle - die dort das Richtige tat.
 *   - jeden weiteren nur, wenn er nach der Dauer des vorigen vor der Frist
 *     fertig wird. Die Frist ist die naechste Speicherzaehlung von bn4net;
 *     bis dahin ist der Speicher wieder frei, ohne dass ein Aufruf verworfen
 *     wird.
 * Die Dauer wird GEMESSEN (Date.now vor und nach dem Aufruf), nicht mit
 * ns.getWeakenTime erfragt: das kostete 0,05 GB je Faden, bei 63.000 Faeden
 * rund 3 % des Ofens. Die gemessene Dauer ist eine obere Schranke (das Level
 * steigt, die Sicherheit bleibt durch den Ofen selbst am Minimum), der Faden
 * hoert also eher zu frueh als zu spaet auf.
 *
 * WARUM WEAKEN UND NICHT HACK ODER GROW
 *
 * Erfahrung je Faden ist fuer alle drei Aktionen dieselbe (Hacking.ts:29-38).
 *   - hack faellt auf ein Viertel, sobald das Ziel leer ist
 *     (NetscriptHelpers.tsx:639-641).
 *   - grow erhoeht die Sicherheit, sobald das Ziel nicht voll ist
 *     (ServerHelpers.ts:209-214). Das Audit empfahl grow "auf einem vollen
 *     Ziel" - das Ziel war nicht voll: die Wartungswelle hackte es leer
 *     (18:04: 0,0 % Geld), und eine Auffuellung von 0 hob die Sicherheit um
 *     37,7 (Spielstaende 16:57/17:19: 44 statt 7).
 *   - weaken ist 20 % langsamer je Aufruf (4 statt 3,2 hackTime), haelt aber
 *     die Sicherheit und damit jede Aufrufdauer am Minimum.
 *
 * Kosten: 1,60 GB Grundlast + 0,15 GB fuer weaken = 1,75 GB je Faden.
 *
 * args: [ziel, frist (ms seit Epoche), runde]
 *   Ohne gueltige Frist genau EIN Aufruf - ein Faden ohne Frist darf nie
 *   endlos Speicher halten.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const ziel = String(ns.args[0]);
  const frist = Number(ns.args[1]);
  // Kein Logging: Bei Zehntausenden Faeden wuerde jede Zeile die Anzeige
  // fluten und Rechenzeit kosten, die dem Ofen fehlt.
  ns.disableLog("ALL");
  let dauer = 0;
  do {
    const start = Date.now();
    await ns.weaken(ziel);
    dauer = Date.now() - start;
  } while (Number.isFinite(frist) && Date.now() + dauer <= frist);
}
