/**
 * Gemeinsame Kaltstart-Definition fuer Kern (bn4net.js) und Waechter
 * (guard.js) - Audit 26.09.2026, Fund 6#7 (nodes/audit-2026-09-26/
 * 6-orchestrierung.md Abschnitt 7), Paket C.5.
 *
 * ===========================================================================
 * WARUM ES DIESE DATEI BRAUCHT
 * ===========================================================================
 *
 * Beide Dateien kannten "Kaltstart" bisher als `home <= 64 GB`. Das galt nur,
 * solange home nach jedem Reset mit 32 GB startet - `Prestige.ts:246-251`
 * setzt home aber ab Source-File 9 Stufe 2 auf 128 GB (Eric hat SF9.3), und
 * "<=64" ist damit in GENAU dem Fenster, in dem der Waechter allein
 * zustaendig ist (Kern tot, oder das kurze Fenster direkt nach einem
 * Sprung), nie mehr wahr gewesen.
 *
 * BELEGT AM EIGENEN LAUF (27.09.2026). Der BN5L3-Sprung fand am 26.09. um
 * 20:41 statt (backups/LIVE_..._BN5L3_2026-09-26T20-41_connect.json.gz).
 * `data/bn4net.json` zeigte darin bereits "phase":"normal" - in der ERSTEN
 * Sekunde nach dem Sprung, mit home = 128 GB, 0 gekauften Rechnern und
 * insgesamt 245 GB gerootetem Netz. Das ist derselbe Fehler wie in Bericht
 * 6#7 fuer BN5L2 (00:39:42), jetzt ein zweiter, unabhaengiger Beleg auf
 * BN5L3 mit genau der Zahl, die HOME_KALTSTART_GB=64 nicht mehr abdeckt.
 *
 * Ein erster Versuch (b16e381, 26.09.2026) flickte nur die Zahl (64 -> 128
 * ab SF9 Stufe 2) und wurde deshalb zurueckgenommen (11eb9a6): die naechste
 * SF9-Stufe (oder ein anderer BitNode mit anderem Reset-home) haette
 * dieselbe Falle wieder aufgestellt. Der Audit empfiehlt ausdruecklich eine
 * andere GRUNDLAGE, nicht nur eine andere ZAHL: Park/Geld/Netzgroesse statt
 * home-RAM.
 *
 * ===========================================================================
 * WARUM NETZGROESSE UND NICHT GELD
 * ===========================================================================
 *
 * Geld ist knotenabhaengig um Groessenordnungen verschieden (BN9-Hashes vs.
 * BN5-Hacking) und haengt an der laufenden Zielwahl (B1/B4), nicht an der
 * Ausbaustufe des Netzes. Die Netzgroesse (Summe maxRam ueber GEROOTETE
 * Wirte, inklusive home) waechst dagegen genau dann, wenn ein Park oder ein
 * groesseres home wirklich etwas zum Arbeiten hat - und sie steht in bn4net
 * bereits in genau dieser Form (`ramTotal` in bn4net.js, Abschnitt "Gerooteter
 * Netzspeicher" - dieselbe Summe `hasRootAccess ? getServerMaxRam : 0`),
 * keine neue Idee, nur ein neuer Ort dafuer. (Keine Zeilennummer hier - die
 * verschiebt sich mit jeder Aenderung an bn4net.js, siehe C.5-Skeptikerfund.)
 *
 * ===========================================================================
 * WARUM DIE SCHWELLE 2048 GB
 * ===========================================================================
 *
 * Gemessen am eigenen BN5L3-Sprung (26.09. 20:41, s. o.): Netz gesamt 245 GB
 * im Sprungmoment (0 Park, home 128 GB), 1957 GB 23 Minuten spaeter (Park
 * bereits 2 Rechner, 96 GB). 2048 GB liegt mit rund dem Achtfachen
 * komfortabel ueber dem Sprungmoment-Wert.
 *
 * Die Schwelle ist NUR ein Rueckfall fuer Knoten OHNE Park (CloudServerLimit
 * 0, z. B. BitNode 9): Existiert ein Park, entscheidet die Park-Bedingung
 * allein (s. u.), egal wie klein er ist (der erste Rechner reicht) - und die
 * Schwelle wird gar nicht ausgewertet. Sie muss also nicht "die Grenze zum
 * Normalbetrieb" treffen, nur zuverlaessig ZWISCHEN "Sprungmoment" und
 * "danach" liegen. Deckt sich mit dem Beispiel aus Bericht 6#7 ("Netz < 2 TB").
 *
 * EHRLICH BLEIBEN, WAS DIE SCHWELLE IN BITNODE 9 MISST (Skeptiker-Fund
 * 27.09.2026): dort waechst `netzGb` NICHT durch eigene Kaufkraft (es gibt
 * keinen Park), sondern durch das ROOTEN fremder Weltserver plus das
 * Wachstum von home selbst (`homegrow.js`). "2048 GB" ist dort also ein Mass
 * fuer Cracking-Fortschritt, nicht fuer "jetzt passt ein 768-GB-Werkzeug
 * irgendwohin" - das haengt am GROESSTEN einzelnen Wirt, nicht an der Summe,
 * und die Weltserver-Summe variiert mit dem Startwert (Server/data/servers.ts:
 * grob 1-7 TB je nach Seed, ueberwiegend kleine Wirte). Wo genau die Schwelle
 * in einem gegebenen BN9-Lauf faellt, haengt also vom Seed ab - vermutlich
 * folgenlos, weil die BN9-normal-Werkzeuge (sleeve.js, contracts.js) schon
 * auf ein 128-GB-home passen, aber ungemessen und nicht Teil dieses Fixes.
 *
 * ===========================================================================
 * WAS "KALTSTART" STEUERT, UND OB DAS NOCH GEWOLLT IST
 * ===========================================================================
 *
 * `registry.json` gibt vier Gewerken `"phase": "kaltstart"` (cdump.js,
 * csolve.js, darkweb.js, sleevecrime.js) - einfache Einnahme-/Setup-Quellen,
 * die abgeschaltet werden, sobald der eigentliche Motor (Geldziele, dann
 * bn4rep/Faktionsarbeit) laeuft. Neun Gewerke stehen umgekehrt auf
 * `"phase": "normal"` (u. a. bn4rep.js, bn4door.js, blade.js, bbtrain.js,
 * graftauto.js, figwatch.js, bn4life.js, export.js, popups.js) - sie
 * brauchen Platz oder Park, den es im Sprungmoment noch nicht gibt. Beide
 * Seiten der Aufteilung sind weiterhin sinnvoll (darkweb.js z. B. haelt
 * ohnehin per `data/portknacker-komplett.txt` an, sleevecrime.js weicht den
 * Sleeves fuer bn4rep-Faktionsarbeit) - geaendert wird hier nur, WANN
 * zwischen den beiden Seiten umgeschaltet wird, nicht WAS geschaltet wird.
 *
 * ===========================================================================
 * WARUM EINE REINE FUNKTION
 * ===========================================================================
 *
 * Kein `ns`-Parameter: Ein Import zaehlt in Bitburners RAM-Rechnung den
 * GANZEN globalen Bereich des importierten Moduls (tools/ram.js-Kopf), nicht
 * nur die benutzten Namen. Eine reine Funktion ohne `ns`-Bezeichner kostet
 * die Importierenden also 0 GB - genau das Muster von `lib/calc.js` und
 * `lib/reg.js` (`gilt`/`auswahl` nehmen ebenfalls fertige Werte entgegen,
 * kein `ns`).
 *
 * Die BESCHAFFUNG der beiden Eingaben ist bewusst NICHT hier drin, weil sie
 * fuer beide Aufrufer verschieden ist:
 *
 *   bn4net.js  hat `parkLage()` (liest data/preise.json) und `ramTotal`
 *              ohnehin schon fuer sich selbst berechnet.
 *   guard.js   darf sich keine neue Singularity-Klasse leisten (RAM-Deckel
 *              fuer ein Skript, das frueh in ein kleines home passen muss)
 *              und liest deshalb hatPark ebenfalls aus data/preise.json,
 *              netzGb ueber sein ohnehin vorhandenes `netz()` (0,2 GB,
 *              laengst bezahlt) plus `hasRootAccess` (neu, 0,05 GB) und
 *              `getServerMaxRam` (laengst bezahlt).
 *
 * @param {boolean} hatPark irgendein gekaufter Rechner (ohne Hacknet-Server,
 *   ohne home) existiert gerade
 * @param {number} netzGb Summe maxRam ueber alle GEROOTETEN Wirte,
 *   inklusive home (dieselbe Summe wie bn4net.js `ramTotal`)
 */

// Nur Rueckfall fuer Knoten ohne Park (BitNode 9). Solange ein Park
// existiert, entscheidet allein die Park-Bedingung - siehe Kopfkommentar.
export const KALTSTART_NETZ_SCHWELLE_GB = 2048;

/**
 * @returns {boolean} true, solange die Startlage noch nicht vorbei ist
 */
export function istKaltstart(hatPark, netzGb) {
  if (hatPark) return false;
  // Number(...) >= statt < gespiegelt: NaN/undefined soll KALTSTART ergeben
  // (die sichere Richtung - siehe Aufrufer), nicht "irgendwas < Schwelle".
  return !(Number(netzGb) >= KALTSTART_NETZ_SCHWELLE_GB);
}

/** Bequemlichkeit fuer die Aufrufer: liefert direkt den Phasen-String. */
export function phaseAus(hatPark, netzGb) {
  return istKaltstart(hatPark, netzGb) ? "kaltstart" : "normal";
}
