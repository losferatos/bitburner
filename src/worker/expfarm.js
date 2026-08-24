/**
 * Dauerlaeufer fuer den Erfahrungsofen.
 *
 * WARUM DIESER ARBEITER ANDERS IST ALS DIE DREI NEBENAN
 *
 * hack.js, grow.js und weaken.js sind Einwegskripte: Sie erledigen genau eine
 * Aktion und beenden sich. Das ist fuer den Stapelbetrieb richtig - dort zaehlt
 * der Landezeitpunkt auf die Millisekunde, und ein Skript, das mehrfach
 * zuschlaegt, waere in der Kette nicht mehr terminierbar.
 *
 * Fuer den Erfahrungsofen ist es genau falsch, und zwar teuer:
 *
 * bn4net.js legt den gesamten Speicherueberschuss jede Runde als frische Welle
 * aufs Erfahrungsziel. Eine Runde dauert aber mindestens zehn Sekunden
 * (Schlafzeit plus Rundenarbeit ueber ~96 Rechner), waehrend eine weaken-Aktion
 * auf einem kleinen Ziel unter einer Sekunde braucht. Der Faden arbeitet also
 * 0,3 bis 1,2 Sekunden und liegt danach neun bis neunzehn Sekunden tot -
 * Auslastung fuenf bis zehn Prozent.
 *
 * Gemessen am 24.08.2026 in BitNode 5: Die Telemetrie wies 94,8 % "Brachanteil"
 * aus, und das Feld hat nicht gelogen - der Speicher WAR vergeben, nur eben an
 * Fadenleichen. Ein Fremd-Audit hat den Ist-Zustand nachgerechnet (568.734
 * Faeden x 70 exp / 11,5-20 s = 2,0-3,5e6 exp/s) und damit die Messung von
 * 1,4-2,2e6 exp/s getroffen. Die Ursache ist damit bewiesen, nicht vermutet.
 *
 * Dieser Arbeiter laeuft stattdessen bis jemand ihn beendet. Derselbe Speicher,
 * dieselbe Aktion, aber ohne Leerlauf zwischen den Runden.
 *
 * WARUM WEAKEN UND NICHT HACK ODER GROW
 *
 * Erfahrung haengt allein an baseDifficulty des Ziels und ist von der Aktion
 * unabhaengig (Hacking.ts:30-38). Aber:
 *
 *   - grow und weaken schreiben sie BEDINGUNGSLOS gut - nachgeschlagen in
 *     NetscriptFunctions.ts:291 und :366, beide rechnen
 *     `calculateHackingExpGain(server, Player) * threads` ohne jede
 *     Erfolgspruefung.
 *   - hack dagegen faellt auf ein Viertel, sobald das Ziel leer ist:
 *     `if (moneyDrained === 0) expGainedOnSuccess = expGainedOnFailure`
 *     (NetscriptHelpers.tsx:639-641). Ein Ofen, der sein Ziel leerhackt,
 *     wuerde sich damit selbst vierteln.
 *
 * weaken ist ausserdem harmlos: Es senkt die Sicherheitsstufe, was nie schadet,
 * und beruehrt weder Geld noch die Stapelketten der Geldziele.
 *
 * Kosten: 1,60 GB Grundlast + 0,15 GB fuer weaken = 1,75 GB je Faden. Das ist
 * ein Zwanzigstel GIGABYTE WENIGER als der Einweg-Arbeiter (1,80 GB), weil die
 * Terminrechnung samt getWeakenTime hier entfaellt.
 *
 * args: [ziel]
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const ziel = String(ns.args[0]);
  // Kein Logging: Bei Hunderttausenden Faeden wuerde jede Zeile die Anzeige
  // fluten und Rechenzeit kosten, die dem Ofen fehlt.
  ns.disableLog("ALL");
  for (;;) {
    await ns.weaken(ziel);
  }
}
