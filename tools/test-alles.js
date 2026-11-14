/**
 * Ebene 0 am Stueck.
 *
 * Alle Tests laufen OHNE Spiel und ohne Bruecke. Das ist Absicht: ein
 * Testgeschirr, das eine laufende Umgebung braucht, wird genau dann nicht
 * gefahren, wenn die Umgebung kaputt ist.
 *
 * Aufruf:
 *   node tools/test-alles.js            alle Tests + Listenpruefung
 *   node tools/test-alles.js --schnell  nur die, die unter einer Sekunde brauchen
 *   node tools/test-alles.js --nur-tests  wie ohne Flag (alter Schalter, bleibt gueltig)
 *   node tools/test-alles.js --stufe-a  zusaetzlich: Exit 1, solange eine Messluecke offen ist
 *   node tools/test-alles.js --nur-liste [--tests-dir <ordner>]
 *                                        nur die Listenpruefung (readdir-Abgleich)
 *
 * EXIT-CODE (B01/B09, 14.11.2026):
 *   0 = alle Testdateien gruen UND die Liste vollstaendig (jede tools/test-*.js
 *       steht in TESTS oder mit Grund in NICHT_IN_SUITE, jeder Eintrag hat eine
 *       Datei, keiner steht doppelt).
 *   1 = eine Testdatei rot, ein Eintrag ohne Datei, eine Datei ohne Eintrag
 *       oder (nur mit --stufe-a) eine offene Messluecke.
 *   Die Messluecken stehen immer als Zeilen in der Ausgabe, zaehlen aber nur mit
 *   --stufe-a fuer den Exit-Code: vorher endete jeder Lauf ohne --nur-tests mit
 *   Exit 1, und ein Rot, das immer rot ist, sagt nichts mehr.
 */

import { execFile } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

/**
 * Je Eintrag: Datei, worum es geht, und ob der Test schnell ist.
 * Ein Test, der hier fehlt, wird nicht gefahren - deshalb steht bei jedem, was
 * er abdeckt, damit eine Luecke beim Lesen auffaellt.
 */
const TESTS = [
  {
    datei: "test-backup.js",
    deckt: "Sicherungskette: Format, Kennwerte, jeder Ablehnungsgrund, Rotation, + Epochenpraefix in sichere() (Z1)",
    schnell: true,
  },
  {
    datei: "test-verbote.js",
    // --bau: gegen den Worktree pruefen, solange dort gebaut wird. Ein
    // Befund, der erst nach dem Einspielen kommt, kommt zu spaet.
    args: ["--bau"],
    deckt: "Verbotsgrep und Selbstblockade-Muster, mit Selbstprobe",
    schnell: true,
  },
  {
    datei: "test-route.js",
    deckt: "planeRoute ueber alle Routeneintraege",
    schnell: true,
  },
  {
    datei: "test-stillstandsuhr.js",
    deckt: "Stillstandsuhr des Motors",
    schnell: true,
  },
  {
    datei: "test-motorzeit.js",
    deckt: "Motorzeit gegen Drosselung, Offline-Nacht und Nachholklumpen",
    schnell: true,
  },
  {
    datei: "test-kontrakte.js",
    deckt: "Herzschlag v2, kpi.json-Feldliste und Ereignisstrom (C.1)",
    schnell: true,
  },
  {
    datei: "test-syntax.js",
    deckt: "Ebene -1: jede Datei in src/ parst (acorn aus der Referenzkopie)",
    schnell: true,
  },
  {
    datei: "test-scope-tot.js",
    deckt: "Ebene -1: kein Name in src/ ausserhalb seines Scopes (toter Aufruf im try/catch, Befund 03.10.), mit Selbstprobe",
    schnell: true,
  },
  {
    datei: "test-sprung-latenz.js",
    deckt: "jump_latency_min misst den Sprung (erster Boot danach), nicht die Zeit seit dem Sprung (Befund 03.10.)",
    schnell: true,
  },
  {
    datei: "test-go.js",
    deckt: "IPvGO-Spieler go.js (B8): Zugwahl (Schlag, Atari, Pass, Ko), falscher Knoten, ganze Partien gegen Ersatzgegner, Fortsetzen, Concurrency-Check (asleep statt sleep)",
    schnell: false,
  },
  {
    datei: "test-gomcts.js",
    deckt: "Baumsuche lib/gomcts.js: Regel-Engine gegen den Spielcode (goprobe/eich.mjs), Markenzaehler ueber 2^31, Baumuebernahme, Schlag/Augen/Pass (24.10.)",
    schnell: false,
  },
  {
    datei: "test-kindreserve.js",
    deckt: "Kern haelt Platz fuer Kinder-Skripte (childRamGb) auf dem Wirt frei; corp-act deckt das groesste Kind (Befund 06.10.)",
    schnell: true,
  },
  {
    datei: "test-gang-knoten.js",
    deckt: "Check-in ignoriert gang.json aus dem Vorknoten (Fehlalarm BN3.1, 05.10.)",
    schnell: true,
  },
  {
    datei: "test-knotenmarke.js",
    deckt: "Knotenmarken (keine-hacknet/keine-sleeves) sperren nur im eigenen Knoten; hacknet.js nicht mehr als fehlend gemeldet (Befund 05.10.)",
    schnell: true,
  },
  {
    datei: "test-kurvepflege.js",
    deckt: "Check-in zieht die Referenzkurve nach, wenn ein schnellerer abgeschlossener Lauf vorliegt (Befund 05.10.)",
    schnell: true,
  },
  {
    datei: "test-einbauhalt.js",
    deckt: "Augs beim Sprung: Endspurt-Tor zaehlt als bewusst gehalten, Graft nicht (Fehlbefund BN6.3, 15.10.)",
    schnell: true,
  },
  {
    datei: "test-gleichstand.js",
    deckt: "Gleichstand-Vergleich zaehlt ab Knotenstart und bekommt eine Knotenzeit (war tot, Befund 10.10.)",
    schnell: true,
  },
  {
    datei: "test-stadtwahl-echtpop.js",
    deckt: "Stadtwahl nach echter Bevoelkerung (r je Stadt per Probenwechsel), nicht popEst - Rang fiel in leergeraidetem Sector-12 (Befund 04.10.); Feinwahl bei sicherem r ab 15 % Chance (BN7.1 Volhaven, 16.10.)",
    schnell: true,
  },
  {
    datei: "test-tracer-anteil.js",
    deckt: "Tracer nach Vertragsanteil der Spielerwahl gewichtet statt fest 1,0 (433 Punkte in BN7.1 bei leeren Vertraegen, 16.10.)",
    schnell: true,
  },
  {
    datei: "test-rundreise-wert.js",
    deckt: "Stadtwahl nach Wert statt Gemeinden, Rundreise nicht in die Leere, Hysterese 4 / 0,5 (BN7.3 h43-54 Ishima statt Volhaven, 23.10.)",
    schnell: true,
  },
  {
    datei: "test-drossel.js",
    deckt: "Drosselbefund nur ueber kurze Fenster plus direkte Probe (Fehlalarm 22.10.: Vergleich gegen Punkt vom 08.10.)",
    schnell: true,
  },
  {
    datei: "test-umzug.js",
    deckt: "Umzug in volle Stadt mit hohem Chaos und Aufraeumen per Diplomacy, Budget in Spielzeit (BN7.1 Aevum 0,73 Mrd bei Chaos 163, 17.10.)",
    schnell: true,
  },
  {
    datei: "test-history.js",
    deckt: "Dashboard-Verlauf der Bruecke: Probe nur aus dem laufenden Knoten, Motoruhr, Takt ueber Neustart, kaputte Datei beiseite (29.10.)",
    schnell: true,
  },
  {
    datei: "test-netburn-marker.js",
    deckt: "netburn.js entwertet die Hacknet-Knotenmarke nach Serverkauf (BN13.1, 29.10.)",
    schnell: true,
  },
  {
    datei: "test-strafzeile.js",
    deckt: "/bb zaehlt Entwarnungen des Waechters nicht als Strafe (BN13.2, 30.10.)",
    schnell: true,
  },
  {
    datei: "test-verdraenger.js",
    deckt: "home-Werkzeug (shop.js) verdraengt ein Werkbank-Werkzeug von home nach evictRank (BN13.2 nach Einbau, 30.10.)",
    schnell: true,
  },
  {
    datei: "test-bruecke-alarm.js",
    deckt: "Sicherungsalarm erlischt mit der naechsten gruenen Sicherung; Check-in beschriftet die Black-Op-Chance (Befund 04.10.); alarm() mit alarmMelde-Stub, CRLF-tolerant (B08)",
    schnell: true,
  },
  {
    datei: "test-ram.js",
    deckt: "RAM-Rechner gegen 114 Live-Messwerte, registry.json und das Tor E1",
    schnell: true,
  },
  {
    datei: "test-ram-namen.js",
    deckt: "Namenspruefer gegen die wakelock-Fehlerklasse, mit Selbstprobe",
    schnell: true,
  },
  {
    datei: "test-zielvalidierung.js",
    deckt: "Zielpruefung vor dem Sprung gegen die echte route.json (C.3)",
    schnell: true,
  },
  {
    datei: "test-kaltstart-budget.js",
    deckt: "passt der Kaltstart auf 32 GB - und findet eine Geldquelle Platz? (C.7/C.8); K10: Lauf 2 mit home 8/16/32 und SF-Stand aus route-lauf2.json, home-Formel gegen Prestige.ts geeicht",
    schnell: false,
  },
  {
    datei: "test-registry.js",
    deckt: "Registry, Rollen-Riegel und der Migrationsbeweis gegen die heutige Liste (C.4)",
    schnell: true,
  },
  {
    datei: "test-graftwahl.js",
    deckt: "Graft-Auswahl: Vorzug, Puffer, Sprungnaehe, gegen den echten Plan (C.14)",
    schnell: true,
  },
  {
    datei: "test-handschlag-nachblick.js",
    deckt: "Handschlag liest die Antwort auch nach dem letzten (gedrosselten) Schlaf (Uhren-Audit 08.10.)",
    schnell: true,
  },
  {
    datei: "test-notexec-frist.js",
    deckt: "ausgang.js: NOT_EXECUTABLE-Frist laeuft wirklich ab (Uhren-Audit 08.10.)",
    schnell: true,
  },
  {
    datei: "test-figur.js",
    deckt: "Figur-Vergabepunkt: Lease, Rangfolge, Folgenummer, Knotenstempel (C.11)",
    schnell: true,
  },
  {
    datei: "test-simulacrum.js",
    deckt: "Simulacrum-Parallelarbeit (B5): Faktionsarbeit neben Bladeburner nur mit Simulacrum UND Kampfwert-Ziel; ohne Simulacrum bitgleich",
    schnell: true,
  },
  {
    datei: "test-joinrun-ebene2.js",
    deckt: "EBENE 2: joinrun.js gegen eine dauerhafte PRIO.faktion(30)-Konkurrenz - PRIO.beitritt (25) gewinnt und behaelt die Figur (C2-Blocker, Audit 3#6/6#4), auch ueber die 15-min-Lease hinaus (Integration 27.09.); ausserdem G-Ueberschiessen (eigenes Training stoppt aktiv am Ziel) und G2 (Stadt wird unter der Lease nachgezogen, kein Haemmern) (Audit-Nachmessung 27.09.)",
    schnell: true,
  },
  {
    datei: "test-ofen-raeumung.js",
    deckt: "EBENE 2: der Werkzeugstarter des Kerns raeumt auch den Erfahrungsofen (worker/expfarm.js), wenn ein Werkzeug Platz braucht (Integration 27.09.)",
    schnell: true,
  },
  {
    datei: "test-bn4life-beitritt.js",
    deckt: "EBENE 2: bn4life.js startet joinrun/netburn erst ab dem Gym-Geldboden - nach dem Sprung bleibt home fuer shop.js frei (Integration 27.09.); ausserdem G1 (Beitrittsmarke landet zuverlaessig auf home, auch von einem Fremdwirt aus, und ein laufendes joinrun.js mit Ziel 80 verhindert einen zweiten Start) (Audit-Nachmessung 27.09.)",
    schnell: true,
  },
  {
    datei: "test-syndicate-reise.js",
    deckt: "EBENE 0+2: bn4life.js holt die Figur in BN3 (Corp-Knoten, = CORP_MONEY_NODES) nach Sector-12, sobald fuer The Syndicate nur noch die Stadt fehlt - in BN2.3/BN3.1 stand sie in Zyklus 1 bis zum Einbau in Ishima (H2-light 06.10.)",
    schnell: true,
  },
  {
    datei: "test-leiter.js",
    deckt: "Strafleiter, Signale und die drei Waechteruhren, mit Uhren-Lint (C.6)",
    schnell: true,
  },
  {
    datei: "test-tor.js",
    deckt: "tor.js gegen praeparierte Spielstaende: Multiplikator, Verlauf, Gym-Rate",
    schnell: true,
  },
  {
    datei: "test-motor-ebene2.js",
    deckt: "EBENE 2: der echte Kern gegen den ns-Mock, drei Pflichtproben (C.1)",
    schnell: false,
  },
  {
    datei: "test-matrix-ebene2.js",
    deckt: "EBENE 2: Szenarienmatrix ueber alle 15 Knoten der Route",
    schnell: false,
  },
  {
    datei: "test-boerse.js",
    deckt: "Aktienhandel: Trendschaetzung, Kommission, Schliessung vor dem Sprung (C.15)",
    schnell: true,
  },
  {
    datei: "test-casino.js",
    // Die Eichung liest RNG.ts und typescript aus reference/v301; der Worktree bb-lauf2 hat nur
    // v301/src + acorn. Fehlt es, wird SICHTBAR uebersprungen (Zeile in der Auswertung).
    braucht: ["reference/v301/src/Casino/RNG.ts", "reference/v301/node_modules/typescript"],
    deckt: "Casino-Roulette BN8: Vorhersage bitgleich gegen RNG.ts, Geldwunsch fuer boerse.js, Pausen nach Abbruch, Pause/Abruf je Dreh (13.11.2026)",
    schnell: true,
  },
  {
    datei: "test-kern-c789.js",
    deckt: "EBENE 2: Platzreservierung, shop-Bedarfsbetrieb, Wirtsperren, BN9 (C.7-C.13)",
    schnell: false,
  },
  {
    datei: "test-kernwache.js",
    deckt: "EBENE 2: SELBST-Neustart des Kerns nur mit Wache, sonst verschieben; Lebenswache in guard.js",
    schnell: false,
  },
  {
    datei: "test-hacknet-ebene2.js",
    deckt: "EBENE 2: hacknet.js baut den Cache aus, wenn der Rangtausch nicht in den Speicher passt",
    schnell: false,
  },
  {
    datei: "test-kampfaugs.js",
    deckt: "EBENE 0: Kampfknoten kauft nur nuetzliche Augs; Namen gegen den Spielquelltext; P0/G02: hacknetNachEinbau (ein Praedikat fuer bn4rep.js und hacknet.js)",
    schnell: true,
  },
  {
    datei: "test-v1kurve.js",
    deckt: "EBENE 0: V1-Referenzkurve - Offline-Fenster, Hoechststand, Restzeit fuer checkin",
    schnell: true,
  },
  {
    datei: "test-kein-wd-backdoor.js",
    deckt: "EBENE 0: nur exit.js beendet w0r1d_d43m0n - kein Backdoor-Skript schickt aufs BitVerse (F1)",
    schnell: true,
  },
  {
    datei: "test-sprosse5-kette.js",
    deckt: "EBENE 2: Waechter beauftragt, Kern startet punish.js - im Trockenlauf (C.12)",
    schnell: false,
  },
  {
    datei: "test-loeser-verify.js",
    deckt: "Die Gegenproben der 30 Vertragsloeser, gegen falsche Antworten (C4)",
    schnell: true,
  },
  {
    datei: "test-punish.js",
    deckt: "Sprosse 5: die acht Vorbedingungen und die beiden Deckel (C.12)",
    schnell: true,
  },
  {
    datei: "test-handschlag-nachhome.js",
    deckt: "EBENE 2: lib/handschlag.js setzt die Einbausperre per nachHome - erreicht home auch von der Werkbank aus (C.4)",
    schnell: true,
  },
  {
    datei: "test-graftauto-ebene2.js",
    deckt: "EBENE 2: Grafting-Automatik - Vorzug, Abbrucherkennung, Motorzeit-Quote (C.14)",
    schnell: false,
  },
  {
    datei: "test-blade-ebene2.js",
    deckt: "EBENE 2: das Traegergewerk fuer 30 der 40 Laeufe - Ausdauer, Chaos, Black-Op-Schwelle, Fertigkeiten, und das Tor 4 x 100 in bbtrain.js",
    schnell: false,
  },
  {
    datei: "test-hashes-ebene2.js",
    deckt: "EBENE 2: hashes.js - Marker ohne Server, Gym-Training im Anlauf, Rang in der Division, Deckelregel",
    schnell: true,
  },
  {
    datei: "test-chem-nachbau.js",
    deckt: "Corp: Chemical-Division nach allen Investorenrunden auch unter 363 Mrd Kasse (BN3.3 Pflanzen-q 10,8)",
    schnell: true,
  },
  {
    datei: "test-rundenboden.js",
    deckt: "Corp-Investorenrunden: fester Mindestbetrag nach >2 h Verschiebung (letzte Runde 0, Runden 1-3 ein Viertel)",
    schnell: true,
  },
  {
    datei: "test-hashrang.js",
    deckt: "Hash-Rang im Anlauf (B7): BN13/BN14/BN15 tauschen Hashes unter 1 Mrd (ab 50 Mio ueber der Ruecklage) in Rang (Preisdeckel 1000), Cache im ersten Zyklus; alle anderen Knoten unveraendert",
    schnell: true,
  },
  {
    datei: "test-sleeve-ebene2.js",
    deckt: "EBENE 2: der Geldboden der Koerper gegen den Nachholrueckstand (storedCycles) - und der Mock, der ihn nachbildet",
    schnell: false,
  },
  {
    datei: "test-sleeve-hackingweg.js",
    deckt: "EBENE 2: Sleeves im Hackingweg (V1) - Faktionsarbeit statt Shoplift, Mug/Shoplift wie Crime.ts gerechnet, BN8 ohne Verbrechensgeld, Schockerholung bis 65 stehenlassen, Rueckfall nie Leerlauf",
    schnell: false,
  },
  {
    datei: "test-bruecke.js",
    deckt: "EBENE 2: die Bruecke gegen ein nachgebautes Spiel - Rollentrennung, Wachhund, Sicherung vor pushAll, zweite Verbindung, belegter Port (Auftrag 6.1)",
    schnell: false,
  },
  {
    datei: "test-lader.js",
    deckt: "DER PRUEFSTAND SELBST: Importumschreibung, Heimatordner, keine Reste unter src/, zwei gleichzeitige Laeufe (R29)",
    schnell: false,
  },
  {
    datei: "test-guard-ebene2.js",
    deckt: "EBENE 2: der Waechter im Beobachtungsmodus, boot.js-Schonliste (C.6)",
    schnell: false,
  },
  {
    datei: "test-endspurt.js",
    deckt: "Ausgangs-Interlock und Endspurt-Regel, inkl. ns.read-Asymmetrie (C.3)",
    schnell: true,
  },
  {
    datei: "test-bn4rep-einbau.js",
    deckt: "lib/einbau.js: Fokus-Ruecknahme, BN12-Spendenformel, Daedalus-Schwelle,"
      + " Spendenrecht- und Red-Pill-Einbauzwang, Horizont-Unbezahlbarkeit,"
      + " Favor-Relevanz (Audit A1-A7), mit echten Spielstandzahlen und"
      + " echten Aug-Namen (Skeptiker-Nacharbeit)",
    schnell: true,
  },
  {
    datei: "test-bn4rep-ebene2.js",
    deckt: "EBENE 2: bn4rep.js-Hauptlauf gegen nachgebauten Spielzustand -"
      + " erste Runde nach Neustart (BN5.2 19:03), Handschlag/Interlock ohne"
      + " Prozessende und ohne NFG-Kauf, Fuellstueck nicht im Kampfknoten,"
      + " Fokus mit Karenz und NMI nur eingebaut (Skeptiker-Nacharbeit A);"
      + " P1/AUG-4: Kampfknoten mit Gang - Kaufaufschub bei gesperrtem Tor, Torrunde,"
      + " Warten auf den Gang-Vorrat mit Zwei-Stunden-Grenze, Runde vor dem Einbau,"
      + " Fehlerzaehler, SF11-Preisfaktor; ohne Gang unveraendert;"
      + " P0/GANG-2+G02: The Red Pill nur mit positivem V1-Nachweis, Einbausperre nach TRP nur im Hackingweg,"
      + " Hacknet-Stuecke nur in BN9; Z1: die echte Telemetrie (v1Positiv, gateBuy, knoten, nodeReset, zeit)"
      + " besteht checkPrereq von gang.js",
    schnell: true,
  },
  {
    datei: "test-tor-runde.js",
    deckt: "P1/AUG-4: waehleTorRunde gegen tools/audit/gang-round.mjs bestRound"
      + " (30/48/100 Mrd, q0 0 und 4: Menge, Reihenfolge, Kosten), Wartegrenze"
      + " gangBonusWait (30 min, Zustand ueber Neustart), Gewichte der Black Ops in blackops.json,"
      + " Faehigkeiten Reaper/Evasive in der Potenz (geeicht gegen Skills.ts), Hackingfaktoren"
      + " der COMBAT_AUGS",
    schnell: true,
  },
  {
    datei: "test-exportpruefung.js",
    deckt: "P2d/B2: benannte Importe gegen die Exporte der Zieldatei (tools/lib/exportpruefung.js, benutzt von importpruefung.js) -"
      + " Zerlegung, der Fall bn4rep.js gegen eine alte lib/einbau.js, Gegenprobe an allen Dateien in src/ (kein Fehlalarm), Mutanten",
    schnell: true,
  },
  {
    datei: "test-gate-round-status.js",
    deckt: "P1/AUG-4: der Leser der Torrunden-Telemetrie fuer den Check-in (mode error, gangErrors,"
      + " buyFailures, planDrift als Befund; kein Befund im gesunden Zustand)",
    schnell: true,
  },
  {
    datei: "test-reserve-eta.js",
    deckt: "Wirtreserve mit Verfall und Restzeit gegen Nachholklumpen (C.3)",
    schnell: true,
  },
  {
    datei: "test-analyse-eichung.js",
    deckt: "Eichung der ersetzten Analyse-Familie gegen den Spielquelltext (C.7)",
    schnell: true,
  },
  {
    datei: "test-formeln.js",
    deckt: "Die entscheidungstragenden Formeln gegen unabhaengige Eichpunkte",
    schnell: true,
  },
  {
    datei: "test-b1-security100.js",
    deckt: "B1 (Audit 26.09.2026 2#2): Server bei Sicherheit 100 bleiben fuer die Zielwahl sichtbar",
    schnell: true,
  },
  {
    datei: "test-b2-expfarm-dauerlaeufer.js",
    deckt: "EBENE 2: B2 (Audit 26.09.2026 2#1): Erfahrungsofen als Dauerlaeufer, Geldziele nicht verhungert",
    schnell: true,
  },
  {
    datei: "test-b3-darkweb-fokus.js",
    deckt: "EBENE 2: B3 (Audit 26.09.2026 6#1): darkweb.js nur ohne lebendiges bn4life",
    schnell: true,
  },
  {
    datei: "test-b6-bitnodes-tabelle.js",
    deckt: "B6 (Audit 26.09.2026 2#6/1#4): negative Literale und BN12-Stufen im Generator",
    schnell: true,
  },
  {
    datei: "test-b7-zielwahl-gegenpruefung.js",
    deckt: "EBENE 2: Gegenpruefung Skeptiker B - grow-Wellen in der Vorbereitung, kein Pendeln am achten Platz, Anlauffrist ueber eine Stapelphase",
    schnell: true,
  },
  {
    datei: "test-b8-ofen-gegenpruefung.js",
    deckt: "EBENE 2: Gegenpruefung Skeptiker B - Ofenfrist nach dem kuerzesten Takt, Ofenfaeden ohne Frist werden geraeumt",
    schnell: true,
  },
  {
    datei: "test-b5-stapeldurchsatz.js",
    deckt: "EBENE 2: B5 (Audit 26.09.2026 2#4): Stapelziele nach erreichbarem Stapeldurchsatz statt nach Rang",
    schnell: true,
  },
  {
    datei: "test-h1-weakenrate.js",
    deckt: "H1 (Audit bn12-bericht SHOULD-FIX #1): ServerWeakenRate in Vorbereitung, Mischung, Stapeltakt",
    schnell: true,
  },
  {
    datei: "test-b5-flattern.js",
    deckt: "B5-Skeptiker, Einwand 2b: keine Sprossen-Sprünge in batchThroughput über ZIELWAHL.bonusBatch hinaus",
    schnell: true,
  },
  {
    datei: "test-blackops-summe.js",
    deckt: "Die Black-Ops-Summe gegen den Quelltext (E.2 - drei Zahlen, alle falsch)",
    schnell: true,
  },
  {
    datei: "test-d2-wahre-chance.js",
    deckt: "D2 (Audit 4#2): wahre Chance statt s.min, wenn eine Black Op offen ist - Monte Carlo gegen einen Action.ts-Nachbau",
    schnell: true,
  },
  {
    datei: "test-d1-recruitment.js",
    deckt: "D1 (Audit 4#1): der Spieler rekrutiert nicht mehr selbst; Trupp nur bei echtem Bedarf und ohne den Pool zu ueberschreiben",
    schnell: false,
  },
  {
    datei: "test-d4-op-schwelle.js",
    deckt: "D4 (Audit 4#4): die feste 0,85 fuer Operationen gilt nur bei knapper Kasse - sonst entscheidet EV_Rang/min",
    schnell: false,
  },
  {
    datei: "test-trupp-sleeve.js",
    deckt: "Trupp fuer die Black Op: truppAnfrage nur bei echtem Bedarf, Feuern mit Pool, ein Sleeve rekrutiert nur, wenn der naechste Mann lohnt",
    schnell: false,
  },
  {
    datei: "test-blackop-gym.js",
    deckt: "Faellige Black Op holt die Figur aus dem Gym (dieselbe Feuerzahl wie waehle(), kein Pendeln), klemmFaktor und fahrbar leben",
    schnell: false,
  },
  {
    datei: "test-maenner-endlos.js",
    deckt: "maennerNoetig (blade.js) endet fuer jede Chance - die unbegrenzte Schleife fror am 03.10. den Spiel-Tab ein (Typhoon 0,102 gegen 0,90)",
    schnell: true,
  },
  {
    datei: "test-gang.js",
    deckt: "EBENE 2: gang.js (Paket P2, GANG-1) gegen einen ns.gang-Nachbau - Gruendung nur einmal und nur mit beigetretener Kampf-Faktion kleinsten Rufs (nie NiteSec/Black Hand, Pause auch ueber Neustart, unlesbarer Ruf zaehlt nicht als 0), Rekrutierung mit Grenze, Aufgabenwahl Training -> Terrorism -> Vigilante, Aufstiegsschwellen 1,3/2, nie Warfare/Ausruestung, Takt = nextUpdate mit Rueckfall, Abbruch/Fehlerserie/MAX_ROUNDS, Fehler in der Telemetrie, Schalter data/gang-an.txt, Registry-Gating; VORAUSSETZUNGSSPERRE vor createGang (nur mit frischer, zum Knoteneintritt passender data/bn4rep.json, die Paket 0 UND Paket 1 meldet; gesperrter Versuch zaehlt nicht), Vertrag mit bn4rep.js, /bb-Zeile aus gang.json, Logzeit in Ortszeit; Formeln gegen gang-formulas.mjs; GELDMODUS (P2d): Modus je Runde mit Hysterese, Rueckfall auf RESPECT, Human Trafficking und Wanted-Regler, Ausruestung nur im Modus MONEY ueber der Ruecklage; Skeptiker-Runde: Notschalter data/gang-geld-aus.txt, repNeedNullSince, /bb-Zeile und Befund zum Geldmodus; Selbstprobe mit 70 Mutanten",
    schnell: true,
  },
  {
    datei: "test-bn8-einbaurunde.js",
    deckt: "BN8: der echte bn4rep.js-Hauptlauf (Einbaurunde) gegen nachgebauten Spielzustand mit Boersen-Stub - home-RAM, Spende ab Favor 0, Depot vor den letzten Kaeufen",
    schnell: false,
  },
  {
    datei: "test-bn8-tdh.js",
    deckt: "BN8: Tian Di Hui ohne Gym, Sector-12-Rueckreise, kein Pingpong mit Aevum (bn4life.js bn8TripPlan)",
    schnell: true,
  },
  {
    datei: "test-bn8-xp.js",
    deckt: "BN8: reiner Erfahrungsmodus - Verteilung (alles an den Ofen), nichts aendert sich ausserhalb Knoten 8, Kaufregel, homegrow-Freigabe",
    schnell: false,
  },
  {
    datei: "test-bn8plan.js",
    deckt: "BN8: Einbauplan lib/bn8plan.js (300 Mrd, 1 Bio, 30 h je Stufe) und seine Verdrahtung in bn4rep.js",
    schnell: true,
  },
  {
    datei: "test-boersepause.js",
    deckt: "BN8: Depot wird VOR den letzten Kaeufen des Einbaus verkauft (lib/boersepause.js)",
    schnell: true,
  },
  {
    datei: "test-ereignisstrom.js",
    deckt: "EBENE 2: bleibende Ereignis-Eintraege ueberleben die Schreiber, ein Dauerkonflikt (figwatch) flutet nicht (BN15.2, 07.11.)",
    schnell: true,
  },
  {
    datei: "test-gocheat.js",
    deckt: "go.cheat im IPvGO-Spieler: Chance-Formel gegen den Spielcode (448 Faelle) und Szenariotest; ohne reference/bitburner-src meldet der Test selbst 'uebersprungen'",
    schnell: true,
  },
  {
    datei: "test-handel.js",
    // Die Boersensimulation liest den Spielquelltext; der Worktree bb-lauf2 hat
    // nur eine Kopie von reference/v301. Fehlt der Quelltext, wird SICHTBAR
    // uebersprungen (eigene Zeile in der Auswertung), nicht stillschweigend rot.
    braucht: ["reference/bitburner-src/src/StockMarket"],
    deckt: "BN8: Handelsregel lib/handel.js, Bargeld auf Abruf und boerse.js gegen das nachgebaute Marktmodell (Verdrahtung, nicht nur reine Funktionen)",
    schnell: true,
  },
  {
    datei: "test-hoffnung.js",
    deckt: "EBENE 2: Field Analysis, wenn die Unschaerfe die Wahl kippen kann (BN15.1 Raid gegen Retirement, 05.11.)",
    schnell: true,
  },
  {
    datei: "test-raid-stadt.js",
    deckt: "blade.js: Raid in der ausgebrannten Stadt - Chaos-Formel gegen Messwerte geeicht (Live-Fall BN3.3, 08.10.)",
    schnell: true,
  },
  {
    datei: "test-restertrag.js",
    deckt: "EBENE 2: die laufende Aktion wird mit ihrem Restertrag bewertet, kein Abbruch kurz vor dem Ende (BN15.1, 05.11.)",
    schnell: true,
  },
  {
    datei: "test-coldstart.js",
    deckt: "Z6: Kaltstart-Pfad bis 8 GB home - coldstart.js <= 5 GB (ram.js), Handkauf-Formel gegen Spielwerte, Fake-Welt home 8 GB, coldbuy.js, boot.js ab 32 GB bitgleich zu master, Neuladen mit Autoexec bei 8/16/32 GB",
    schnell: false,
  },
  {
    datei: "test-homegrow-kern.js",
    deckt: "G50: Kernkauf nur mit Ertragspruefung (homegrow.js) - Kostenformel und Knotenfaktoren geeicht, Mock-Lagen, ohne neue Lage bitgleich zu master",
    schnell: false,
  },
  {
    datei: "test-lauf2-uebergabe.js",
    // Laufzeit gemessen 14.11.2026: ~110 s unter dem CPU-Deckel (Mock-Bruecke + Wegwerfordner),
    // das Zeitlimit je Datei ist 300 s (TIMEOUT_MS) - waechst der Test, hier zuerst nachsehen.
    deckt: "Z1: Lauf-2-Uebergabe der Bruecke - Identitaets-Lader, tools/lauf2-uebergabe.js gegen Wegwerfordner, Bruecke (Mock-Rolle) lehnt Lauf 1 ab und nimmt das neue Spiel an",
    schnell: false,
  },
  {
    datei: "test-epoche-leser.js",
    deckt: "K01-Leser (Skeptiker 14.11.): exit.js und ausgang.js laufen im Mock - Lauf-1-Lagen bitgleich zu route.json, frischer Stand ohne epoche.json = kein Sprung, Epoche lauf2 = Route aus route-lauf2.json (BN1.1->4, BN4.3->1), kaputte Epoche = kein Sprung, Fremdrechner holt von home; pruefeLeser der Uebergabe",
    schnell: false,
  },
  {
    datei: "test-sf4-riegel.js",
    deckt: "K09/K10-Mock: Singularity-Gewerke starten ohne SF4 ausserhalb BN4 nicht; mit SF4 (Lauf 1) exakt dieselbe Auswahl wie vor K09; Mock wirft wie das Spiel",
    schnell: false,
  },
  {
    datei: "test-suite-gate.js",
    deckt: "B01: die Listenpruefung von test-alles.js schlaegt bei verwaister Datei, Eintrag ohne Datei und Doppeleintrag an (Mutanten gegen ein Namensabbild von tools/)",
    schnell: true,
  },
  {
    datei: "test-alarme.js",
    // Laufzeit gemessen 14.11.2026: ~75 s (Mock-Bruecke wartet den 60-s-Urteilstakt ab).
    deckt: "B05+B08: Alarmliste (Klassen, Schutz endet nie durch Zeit, Messung nur mit Beleg, Hand-Beleg), tools/alarme.js (Aufraeumen von ## Sofort gegen Fixtures und Kopie der echten Liste), Neustartgrenze + statische Pruefung bridge-start.cmd, Bruecken-Haken, MOCK-Bruecke mit alarme.json (Zaehlen statt Neueintrag, Messung beendet, Neustart, Ablauf, kaputte Datei)",
    schnell: false,
  },
  {
    datei: "test-checkin.js",
    deckt: "B07: checkin.js zeigt Einbau faellig/steht samt Sperrgrund (Urteil, Zeile, JSON-Feld einbau); bestehende JSON-Felder unveraendert",
    schnell: true,
  },
];

/**
 * Testdateien, die bewusst NICHT in der Suite laufen. Jeder Eintrag braucht
 * einen Grund; ohne Eintrag hier und ohne Eintrag in TESTS schlaegt die
 * Listenpruefung an (B01). Heute leer: test-alles.js selbst ist implizit
 * ausgenommen.
 */
const NICHT_IN_SUITE = [
  // { datei: "test-beispiel.js", grund: "braucht das laufende Spiel (Ebene 3)" },
];

/**
 * Was Ebene 0 nach Auftrag 6.1 noch abdecken MUSS und heute nicht abdeckt.
 * Die Liste wird ausgegeben, nicht verschwiegen: ein gruener Sammellauf, der
 * die Haelfte nicht prueft, ist gefaehrlicher als ein roter.
 */
/**
 * WAS DIESE SUITE NICHT PRUEFT.
 *
 * Sie steht hier, weil eine leere Lueckenliste die bequemste Art ist, sich
 * fertig zu fuehlen. Stufe A der Abnahme verlangt Exit 0 UND eine leere
 * Liste - beides, nicht eines.
 *
 * Alles hier Genannte braucht das laufende Spiel (Ebene 3) oder eine
 * Beobachtung ueber Stunden. Kein Mock der Welt ersetzt das: der ns-Mock
 * bildet nach, was ich vom Spiel VERSTANDEN habe, und genau die Stellen, an
 * denen ich es falsch verstanden habe, bildet er falsch nach.
 */
/**
 * Die Liste hat seit dem 04.09.2026 ZWEI Teile, und das ist der Punkt
 * (Skeptiker Runde 4, R24).
 *
 * Vorher war sie eine einzige Prosaliste, die gedruckt und ignoriert wurde -
 * die Suite endete mit Exit 0 bei neun offenen Eintraegen. Wer nur den
 * Rueckgabewert liest (ein Skill, ein Loop), bekam gruen.
 *
 * Und sie vermischte zwei Dinge, die sich nicht vermischen lassen:
 *
 *   MESSLUECKEN sind Zahlen, die jemand erheben muss. Sie leeren sich durch
 *   Messen, und Abnahmestufe A verlangt zu Recht, dass sie leer sind.
 *
 *   BAUENTSCHEIDUNGEN sind Zustaende, die sich durch Messen NIE leeren -
 *   "Sprosse 4a ist nicht gebaut" bleibt wahr, solange sie nicht gebaut ist,
 *   und das ist Absicht. Sie in dieselbe Liste zu schreiben erzeugt Druck,
 *   den Eintrag zu streichen statt etwas zu messen.
 */
const MESSLUECKEN = [
  { seit: "04.09.2026", wer: "K11 (Dev-Build-Kaltstartlauf, Eric/Sitzung)",
    text: "EBENE 3, KALTSTART: ein echter Knotenwechsel auf 8/16/32 GB home aus einem FRISCHEN Spielstand. "
      + "Der Budgettest (test-kaltstart-budget.js, home 8/16/32) und der Startpfad-Test (test-coldstart.js) "
      + "rechnen ihn nach, aber gerechnet ist nicht gemessen - t_workbench gegen den Knotenpreis ist die Zahl, "
      + "die zaehlt (C.7). Protokoll: tools/kaltstart-lauf.md." },
  { seit: "04.09.2026", wer: "erster echter Vertrag in Lauf 2",
    text: "EBENE 3, VERTRAGSKETTE: erster Vertrag geloest UND kassiert vor Minute 20. "
      + "Die Loeser sind gegen 360 erzeugte Instanzen und je eine unabhaengige Gegenprobe gehalten, aber "
      + "noch nie gegen einen echten Vertrag im Spiel - ein Versuch ist unwiederbringlich (C.8). "
      + "Stand 14.11.: nicht neu geprueft, ob Lauf 1 das inzwischen belegt hat." },
  { seit: "04.09.2026", wer: "Pflichttest 5.2, nur im Spiel stellbar",
    text: "EBENE 3, STRAFLEITER: je Sprosse ein provozierter Haenger. Der Pflichttest "
      + "aus Auftrag 5.2 (Kern-Motorzeit eingefroren, Engine tickt weiter) "
      + "laesst sich nur im Spiel stellen (C.9, C.10)." },
  { seit: "04.09.2026", wer: "BN8-Lauf 1 (laeuft), Messung nach BN8.3",
    text: "BN8: boerse.js/handel.js gegen den ECHTEN Markt. BN9 ist gefahren (ERLEDIGT.md: zwei BN9-Laeufe), "
      + "das Casino ist in BN8 gemessen (10,05 Mrd in 51 s). Offen ist die Handelsrendite der Boerse "
      + "gegen den echten Markt (31+108 Proben sind Mock/Simulation, C.13, C.15)." },
  { seit: "04.09.2026", wer: "Lauf-Betrieb ueber Stunden",
    text: "GRAFTING im Betrieb: graft_busy_pct gegen 100 und graft_aborted = 0 "
      + "brauchen einen Lauf ueber Stunden, nicht eine Mock-Runde (C.14)." },
  { seit: "04.09.2026", wer: "12-h-Beobachtung im Lauf",
    text: "DER FIGUR-VERGABEPUNKT ist gegen sieben Handlungsstellen geprueft, aber "
      + "figure_conflict = 0 ueber 12 h ist eine Messung, keine Zusicherung (C.11)." },
  { seit: "04.09.2026", wer: "nur im echten Spiel stellbar",
    text: "DIE BRUECKE ist gegen ein nachgebautes Spiel geprueft (tools/test-bruecke.js). "
      + "OFFEN bleibt der Zweig, den ein Mock nicht stellen kann: uncaughtException im "
      + "laufenden Betrieb, und der Wachhund gegen einen ECHTEN zweiten Spiel-Tab." },
  { seit: "04.09.2026", wer: "erste Black Op in Lauf 2 (Rang 2.500)",
    text: "next_blackop_chance hat einen Schreiber, aber die MESSUNG gilt erst, "
      + "wenn getNextBlackOp() etwas liefert (erste Operation bei 2.500 Rang, "
      + "gemessen 596); bis dahin steht sie zu Recht auf null." },
  { seit: "04.09.2026", wer: "dauerhaft (Grenze des Mocks)",
    text: "DER MOCK RECHNET KEINE SPIELMECHANIK. Er kennt die Koerper (storedCycles), den Seed "
      + "und die Division, leitet aber keine Erfolgschance aus Kampfwerten ab, er gibt "
      + "zurueck, was der Test hineinschreibt. Geprueft ist damit die ENTSCHEIDUNG der "
      + "Gewerke, nicht die Formel des Spiels; die hat ihren eigenen, gegen den Quelltext "
      + "geeichten Test. Ein Fehler in einer Formel faellt hier NICHT auf." },
];

/**
 * Bewusste Bauentscheidungen. Sie stehen hier, damit sie nicht in Vergessenheit
 * geraten - aber sie sind KEINE Messluecke und blockieren Stufe A nicht.
 * Bereinigt am 14.11.2026 (B09): der Satz "graftplan.json bleibt nicht
 * eingespielt" von 04.09. ist ueberholt (Grafting laeuft seither ueber
 * graftauto.js, siehe ERLEDIGT.md) und steht nicht mehr hier.
 */
const ENTSCHIEDEN = [
  { seit: "04.09.2026",
    text: "SPROSSE 4a ist nicht gebaut und wird es nicht, bevor ein Ebene-3-Lauf "
      + "zeigt, dass ein skriptausgeloester Reload keinen beforeunload-Dialog "
      + "stehen laesst - so steht es im Auftrag. Aus dem Quelltext belegt: der "
      + "save-Prop existiert (GameRoot.tsx:536-541), und der Handler ist eine "
      + "schlichte Zuweisung an window.onbeforeunload (index.tsx:55), also mit "
      + "= null aufhebbar. Es fehlt die MESSUNG, nicht die Kenntnis." },
  { seit: "04.09.2026",
    text: "SPROSSE 5 laeuft im TROCKENLAUF: der Kern haengt 'scharf' nur an, wenn "
      + "data/punish-scharf.txt auf home liegt, und die legt ein Mensch. Das ist "
      + "der Trockenlauf, den der Auftrag vor der Schaerfe verlangt." },
  { seit: "04.09.2026",
    text: "SCHALTER-STAND seit dem 04.09.2026, 21:00: data/guard-modus.txt steht auf "
      + "'enforce' (Sprosse 1 und 2 greifen ein, 3 und 5 beobachten), die Einbausperre "
      + "ist aufgehoben. Ob das heute noch gilt, zeigt data/guard-modus.txt, nicht dieser Satz." },
];

const LUECKEN = MESSLUECKEN;

const args = process.argv.slice(2);
const nurSchnell = args.includes("--schnell");
const nurListe = args.includes("--nur-liste");
const stufeAFlag = args.includes("--stufe-a");
const dirIdx = args.indexOf("--tests-dir");
// --tests-dir nur fuer --nur-liste: der Abgleich liest dann den Namen aus einem
// anderen Ordner (Mutanten-Test in test-suite-gate.js), gefahren wird nichts.
const TESTS_DIR = dirIdx >= 0 && nurListe ? path.resolve(args[dirIdx + 1] || ".") : HIER;

/**
 * Listenpruefung (B01): jede tools/test-*.js steht in TESTS oder mit Grund in
 * NICHT_IN_SUITE; jeder Eintrag hat eine Datei; keiner steht doppelt.
 * Reine Funktion gegen einen Ordner, damit der Test sie mit Mutanten fuettern kann.
 */
function pruefeListe(dir) {
  const fehler = [];
  let namen = [];
  try { namen = fs.readdirSync(dir); }
  catch (e) { return ["Ordner nicht lesbar: " + dir + " (" + e.message + ")"]; }
  const vorhanden = namen.filter((n) => /^test-.+\.(js|mjs)$/.test(n) && n !== "test-alles.js");
  const eingetragen = TESTS.map((t) => t.datei);
  const ausgenommen = NICHT_IN_SUITE.map((x) => x.datei);
  for (const n of vorhanden) {
    if (!eingetragen.includes(n) && !ausgenommen.includes(n)) {
      fehler.push("VERWAIST: " + n + " steht weder in TESTS noch in NICHT_IN_SUITE");
    }
  }
  for (const n of eingetragen) {
    if (!vorhanden.includes(n)) fehler.push("EINTRAG OHNE DATEI: " + n);
  }
  eingetragen.forEach((n, i) => {
    if (eingetragen.indexOf(n) !== i) fehler.push("DOPPELT eingetragen: " + n);
  });
  for (const x of NICHT_IN_SUITE) {
    if (!x.grund || !String(x.grund).trim()) fehler.push("NICHT_IN_SUITE ohne Grund: " + x.datei);
    if (eingetragen.includes(x.datei)) fehler.push("in TESTS UND NICHT_IN_SUITE: " + x.datei);
  }
  return fehler;
}

// 180 s -> 300 s (14.11.2026): unter dem CPU-Deckel (Idle-Prioritaet, 4 Kerne) und neben
// anderen Prozessen brauchte test-go.js 165 s und test-bruecke.js 140 s - das alte Limit
// lag 15 s ueber der langsamsten Datei. BB_TEST_TIMEOUT_MS ueberschreibt es.
const TIMEOUT_MS = Number(process.env.BB_TEST_TIMEOUT_MS) || 300000;

function fahre(datei, args = []) {
  return new Promise((fertig) => {
    const p = path.join(HIER, datei);
    if (!fs.existsSync(p)) {
      fertig({ datei, rc: 127, ausgabe: "Datei fehlt: " + p });
      return;
    }
    const beginn = Date.now();
    // ZWEI AENDERUNGEN AM 04.09.2026 (Skeptiker Runde 5, W5):
    //
    //   `process.execPath` statt "node" - findet die Umgebung `node` nicht auf
    //   dem PATH (Aufgabenplanung, ein .cmd mit eigenem PATH, ein anderer
    //   Rechner), bricht die Suite mit ENOENT ab statt zu laufen.
    //
    //   `timeout` - es gab keines. Haengt eine Testdatei, haengt die Suite
    //   endlos, und niemand sieht warum. Bei Ebene-2-Tests, die echte Prozesse
    //   und Sockets fahren, ist das die falsche Vorgabe. 180 s ist reichlich:
    //   die langsamste Datei braucht gemessen 39 s.
    execFile(process.execPath, [p, ...args],
      { cwd: ROOT, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: TIMEOUT_MS,
        killSignal: "SIGKILL" },
      (err, out, errout) => {
        const abgewuergt = err && err.killed;
        fertig({
          datei,
          rc: err ? (err.code ?? 1) : 0,
          ms: Date.now() - beginn,
          ausgabe: (out || "") + (errout || "")
            + (abgewuergt ? String.fromCharCode(10) + "  ABGEBROCHEN: laenger als " + (TIMEOUT_MS / 1000) + " s - die Datei haengt." + String.fromCharCode(10) : ""),
        });
      });
  });
}

console.log("");
console.log("===========================================");
console.log("  Ebene 0 - alle Tests ohne Spiel");
console.log("===========================================");

const listenFehler = pruefeListe(TESTS_DIR);
console.log("");
if (listenFehler.length) {
  console.log("  [ROT  ] Listenpruefung (readdir-Abgleich gegen " + path.basename(TESTS_DIR) + "/)");
  for (const f of listenFehler) console.log("           " + f);
} else {
  console.log("  [gruen] Listenpruefung: jede test-*.js ist eingetragen, jeder Eintrag hat eine Datei");
}

if (nurListe) {
  console.log("");
  process.exit(listenFehler.length ? 1 : 0);
}

const auswahl = TESTS.filter((t) => !nurSchnell || t.schnell);
const ergebnisse = [];

for (const t of auswahl) {
  // braucht: Pfade relativ zu ROOT. Fehlt einer, wird sichtbar uebersprungen -
  // das ist kein Rot (die Umgebung kann es nicht), aber auch kein Gruen.
  const fehlt = (t.braucht || []).filter((p) => !fs.existsSync(path.join(ROOT, p)));
  if (fehlt.length) {
    ergebnisse.push({ ...t, rc: 0, uebersprungen: true, ms: 0, ausgabe: "" });
    console.log("");
    console.log("  [uebersprungen] " + t.datei + " - fehlt: " + fehlt.join(", "));
    console.log("           " + t.deckt);
    continue;
  }
  const r = await fahre(t.datei, t.args || []);
  ergebnisse.push({ ...t, ...r });
  const zeichen = r.rc === 0 ? "gruen" : "ROT  ";
  console.log("");
  console.log("  [" + zeichen + "] " + t.datei + "  (" + (r.ms ?? "?") + " ms)");
  console.log("           " + t.deckt);
  if (r.rc !== 0) {
    console.log("");
    for (const z of r.ausgabe.split("\n").slice(-25)) console.log("      " + z);
  }
}

const rot = ergebnisse.filter((r) => r.rc !== 0);
const uebersprungen = ergebnisse.filter((r) => r.uebersprungen);

console.log("");
console.log("===========================================");
console.log("  " + (ergebnisse.length - rot.length - uebersprungen.length) + " von " + ergebnisse.length + " gruen"
  + (uebersprungen.length ? ", " + uebersprungen.length + " uebersprungen" : ""));
if (rot.length) {
  for (const r of rot) console.log("  ROT: " + r.datei + " (Exit " + r.rc + ")");
}
for (const r of uebersprungen) console.log("  UEBERSPRUNGEN: " + r.datei + " (braucht " + r.braucht.join(", ") + ")");
if (listenFehler.length) {
  for (const f of listenFehler) console.log("  LISTE ROT: " + f);
}
console.log("===========================================");
console.log("");
console.log("  MESSLUECKEN - Zahlen, die jemand erheben muss (" + MESSLUECKEN.length + " offen):");
for (const l of MESSLUECKEN) console.log("    - [seit " + l.seit + ", " + l.wer + "] " + l.text);
console.log("");
console.log("  BEWUSST SO GEBAUT - keine Luecke, aber nicht vergessen:");
for (const l of ENTSCHIEDEN) console.log("    - [seit " + l.seit + "] " + l.text);
console.log("");

// EXIT-LOGIK (B09, 14.11.2026).
//
// Vorher: Exit 0 nur bei gruenen Tests UND leerer Messluecken-Liste, sonst 1 -
// die Liste war nie leer, der Lauf also immer rot, und wer nur den Rueckgabewert
// las (Skill, Loop), lernte, ihn zu ignorieren. Jetzt: Exit 1 heisst, dass ein
// TEST rot ist oder die LISTE nicht stimmt. Die Messluecken stehen als Zeilen
// oben und zaehlen nur mit --stufe-a fuer den Exit-Code (Abnahmestufe A).
const stufeA = rot.length === 0 && listenFehler.length === 0 && MESSLUECKEN.length === 0;
const ok = rot.length === 0 && listenFehler.length === 0;

if (stufeAFlag) {
  console.log("  Stufe A = alle Tests gruen, Liste stimmt UND keine offene Messluecke.");
  console.log("  Stand: " + (ok ? "Tests gruen" : "ROT") + ", " + MESSLUECKEN.length
    + " offene Messluecke(n) -> " + (stufeA ? "STUFE A ERREICHT" : "Stufe A NICHT erreicht"));
  console.log("");
  process.exit(stufeA ? 0 : 1);
}

console.log("  Ergebnis: " + (ok ? "Tests gruen, Liste vollstaendig" : "ROT")
  + " (Messluecken zaehlen nur mit --stufe-a fuer den Exit-Code)");
console.log("");
process.exit(ok ? 0 : 1);
