# Audit: Volle Autonomie (02.09.2026, 17:14)

Auftrag von Eric: "Ich will wirklich einmal alles auditen mit der Praemisse,
dass der Bot letztendlich ohne deinen und meinen Eingriff ALLES autonom
macht, was geht."

Methode: fuenf Skeptiker-Subagenten mit getrennten Winkeln, jeder mit dem
Auftrag, Schwachstellen zu finden statt zu bestaetigen. Einzelberichte
(insgesamt 1.212 Zeilen) liegen unter `nodes/audit-2026-09-02/`:
`praemisse.md`, `uebergaenge.md`, `betrieb.md`, `knoten.md`, `zahlen.md`,
dazu das `briefing.md`. Alle Zahlen dort sind als Python/Node nachgebaut
und gegen gemessene Werte geeicht (RAM-Rechner auf 7 Messwerte exakt,
Levelformel, Rechnerpreise, Favor, Sleeve-Chance, Gymkosten).

Dieses Dokument ist die Synthese: nur, was standhaelt, mit eigener
Einschaetzung; am Ende, was NICHT geaendert wird und warum.

---

## Kernaussage

**Der Bot ist heute in keinem einzigen Uebergang autonom.** Er spielt einen
Knoten gut, aber jeder der ~41 verbleibenden Knotenwechsel und ein Teil der
Augmentierungs-Einbauten enden ohne Menschen im Stillstand - nicht wegen
eines Fehlers, sondern weil die Zielwahl, die Ausgangserkennung und der
Selbstsprung-Schutz auf einen Menschen gebaut sind. Dazu kommen drei
Knoten (BN8, BN9, BN15), fuer die der Bot das noetige Gewerk gar nicht hat,
und ein Geldboden, der fehlt: Sleeves und Kurse koennen das Konto ins Minus
ziehen, und ein negatives Konto blockiert jeden Kauf.

Die gute Nachricht: Die Bauform selbst (grosse Skripte je Aufgabe,
Werkzeugliste, boot.js als Rueckruf, feste Route) traegt. Die Route loest
das Singularity-RAM-Problem ab Position 8 von selbst. Was fehlt, ist
umgrenzt und in einer Reihenfolge zu bauen, die unten steht.

---

## A. Was jeden Uebergang stoppt (KRITISCH, alle fuenf Berichte)

1. **Der Zielknoten kommt nur vom Menschen.** `data/exit-ziel.txt` hat in
   `src/` und `tools/` keinen Schreiber (nur den Leser `bn4rep.js:906`).
   boot.js loescht die Datei nicht; nach dem Sprung steht darin der Knoten,
   den der Bot gerade betreten hat.
2. **Der Selbstsprung-Schutz verbietet die Route.** `bn4rep.js:907-908`
   weist `ziel === eigenerKnoten` und `ziel > 13` ab. Die Route verlangt
   25 Spruenge in denselben Knoten und 6 nach BN14/15: **27 der 40
   verbleibenden Spruenge sind verboten.** Der naechste (BN10 L2 -> L3)
   ist bereits einer davon.
3. **Der Ausgang wohnt im falschen Skript.** `bn4rep.js:891` prueft nur
   `The Red Pill`; der Black-Ops-Weg (BN6/7/10 und laut Route 8 weitere
   Knoten) wird nicht erkannt. bn4rep braucht ausserhalb BN4 848 GB und
   lief in BN10 L2 bis 16 Uhr gar nicht. Und selbst mit Fix: `exec` von
   `exit.js` ist fest auf `home` (`:929`), exit.js kostet mit SF4.1
   **519 GB** - passt auf kein home unter 4 TB. Der Sprung am 01.09. lief
   ueber `tools/task.js`, nicht ueber bn4rep.
4. **Die Knotenrolle steht als `BLADE_KNOTEN = [6, 7, 10]` im Code**
   (`bn4rep.js:70`). Die Route faehrt Bladeburner in BN4, 9, 2, 3, 11, 13,
   14, 15 - 22 der 41 Restlaeufe. Dort haelt bn4rep den Knoten fuer einen
   Hackingknoten: Faktionsarbeit bricht Bladeburner-Aktionen im Sekundentakt
   ab (Vorfall 25.08. in ERLEDIGT.md:7446), Einbauten setzen Kampfwerte
   auf 1 (6,6 h je Einbau, gemessen 29.08.), und in BN8 ruft bbtrain alle
   30 s `stopAction()`, weil der Beitritt dort abgelehnt wird.
5. **Das Notruf-Modell ist ein Stillstands-Modell.** Fuenf
   `rufeMenschen`/`hilfe.txt`-Stellen (bn4rep 3x, bbtrain 2x) und der
   20-Minuten-Abbruch in boot.js:88-126. Im Spiel liest die Datei niemand;
   die Wache ist seit 31.08. abgeschaltet, ntfy ist aus. Jeder Ruf ist eine
   Endlosschleife.

**Ein Umbau loest 1-5 zusammen:** ein singularityfreies `ausgang.js`
(gerechnet 10,75 GB, passt auf jedes frische home, ganz oben in
`WERKZEUGE`) plus `data/route.json` auf home (Textdateien ueberleben den
Sprung, bewiesen durch exit-ziel.txt). ausgang.js liest
`ns.getResetInfo()` (currentNode, ownedSF), waehlt den ersten
Routeneintrag, dessen Stufe noch fehlt, legt `data/verfahren.txt` (V1/V2)
ab, prueft je Verfahren die Ausgangsbedingung (`getNextBlackOp() === null`
bzw. w0r1d_d43m0n-Level) und startet exit.js ueber den vorhandenen
Auftragskanal auf dem Wirt mit dem meisten Platz. Der Selbstsprung-Schutz
wird zu "Ziel ist der erste offene Routeneintrag" - schaerfer als heute.
bn4rep, blade, bbtrain, sleeve lesen `verfahren.txt` statt `BLADE_KNOTEN`.
Entwurf der Datei: `audit-2026-09-02/praemisse.md`, Frage 3.
Kosten: ~150-200 Zeilen neu, ~60 raus, Skeptiker-Lauf, ein Testsprung.

**Dringlichkeit:** BN10 L2 steht ~10 h Gym plus die Rangphase vor dem
Ausgang. Ohne diesen Umbau ist der naechste Sprung wieder Handarbeit.

---

## B. Was den Kaltstart stoppt (KRITISCH/HOCH)

6. **Kein Geldboden.** `sleeve.js:316` und `joinrun.js:91` schicken
   Koerper ohne Geldpruefung ins Powerhouse (2.400 $/s je Koerper). Das
   Spiel bucht Kurskosten ins Minus (`Work/Formulas.ts`, `gainMoney` ohne
   Boden). Bei negativem Konto geben purchaseServer, purchaseProgram,
   upgradeHomeRam, travelToCity `false` zurueck - **Deadlock**. Heute
   06:00 gemessen: -18,5 Mio in 5 Minuten. Nach dem naechsten Einbau
   (Konto 1.000 $, Sleeves an Position 3 der Werkzeugliste) passiert das
   in der ersten Minute, ohne dass ein contracts.js-Zufallsfund es rettet.
7. **Sleeves holen mit 15-facher Geschwindigkeit nach.**
   `Sleeve.ts:263-275`: Zyklusdeckel 15 je Takt, Rueckstand wird
   gespeichert. Gedrosselter Tab (1 Takt/min) -> Sleeves auf 5 %; danach
   15x. Im Gym kostet das 36.000 $/s je Sleeve - die gemessenen 73.000 $/s
   sind exakt 2 x 15 x 2.400 + 2.400. Live 17:07: 76.076 gespeicherte
   Zyklen = 4,2 h Rueckstand je Sleeve; Abbau live mit Faktor 14,0
   nachgemessen. `GYM_MIN_GELD = 5e6` deckt in diesem Zustand 67 Sekunden.
   `ns.sleeve.getSleeve(i).storedCycles` ist offiziell lesbar.
8. **Offline-Klumpen.** `engine.tsx:280-282`: beim Laden wird die zuletzt
   laufende Arbeit fuer die GESAMTE Abwesenheit auf einen Schlag
   gutgeschrieben (`ClassWork.tsx:105-110`, ungedeckelt, inkl. Kosten).
   Heute: Rechner 06:06-16:04 aus, Figur stand auf Agility -> agi 474.881
   exp, str/def/dex je ~28.000. Zehn Stunden Training zu drei Vierteln
   verschenkt, und beim Laden 86 Mio abgebucht. Trifft jeden Werktag im
   Betriebsmodell "Rechner aus".
9. **Die Kaltstart-Leiter rechnet mit BN6-Preisen.** `CloudServerCost` 5
   in BN10, 2 in BN3; Faktor 1,25 obendrauf. Heute 13,5 h Stillstand bei
   8/70 Rechnern. In BN3 (14 $/s Modell) waeren es **~87 h**, BN14 39 h,
   BN11 17 h, BN13 12 h - ueber 12 Laeufe 300-600 h Leerlauf.
10. **Bis zum ersten Mietrechner laeuft nur bn4net.** Nichts anderes passt
    auf 32 GB: contracts.js (17,65) fehlt um **1,9 GB** neben bn4net
    (16,25); die 24 liegengebliebenen Vertraege brachten heute 86 Mio
    gegen 1,3 Mio/h Hacking - das ist der eigentliche Kaltstart-Hebel.
    wakelock.js (34 GB, DOM-Zugriff 25 GB) fehlt ebenfalls -> der Tab ist
    im Kaltstart immer gedrosselt (Faktor 6 auf jede Runde).
11. **Kein Autoexec im Spiel.** `Settings.AutoexecScript` ist leer
    (aufsicht.log meldet es seit Tagen). Nach einem Neuladen ohne laufende
    Skripte startet nichts - die haeufigste Uebergabe im neuen
    Betriebsmodell ist die einzige ohne Selbstheilung. Ein Handgriff:
    Options -> System -> Autoexec auf `boot.js` (idempotent).

---

## C. Was nach zwei Tagen bricht (KRITISCH/HOCH, `betrieb.md`)

12. **Die Entdopplung behaelt die haengende Instanz.** `bn4net.js:2555-2573`
    killt alle bis auf die aelteste PID. Jeder Neustart eines haengenden
    Werkzeugs (Wache -> task.txt) erzeugt eine frische Instanz, die binnen
    10 s als "doppelt" stirbt. wache.log: 17 wirkungslose wakelock-Neustarts
    in 4 h; sleeve.json seit 06:00 nicht geschrieben, obwohl "laufend".
    Stillstandserkennung gehoert in den Motor (Telemetriealter je
    Werkzeug), und die Entdopplung muss die Instanz mit frischer Telemetrie
    behalten.
13. **Die alte Betriebsart laeuft wieder.** `Bitburner-Aufsicht.cmd` im
    Windows-Autostart hat heute 16:04 `tools/aufsicht.js` und
    `tools/wache.js` neu gestartet - die am 31.08. bewusst beendeten
    Werkzeuge. Sie schreiben in `task.txt` (Doppelstarts, Befund 12) und
    streiten mit bbtrain um die Statwahl (alle 15 min Start + Kill). Unter
    der Praemisse gehoert der Autostart-Eintrag weg (Erics Entscheidung,
    nicht angefasst).
14. **Sechs Skripte greifen nach der Figur, ohne Rangordnung.** bbtrain,
    joinrun, bn4life, blade, kampfaugs, graft, bn4rep. Ping-Pong nach jedem
    Einbau: bbtrain `stopAction()` (Konto < 5 Mio) -> joinrun "kein Kurs" ->
    Gym auf Pump -> bbtrain stoppt wieder. Dokumentiert 25.08. 22:18;
    die Reparatur greift nicht, wenn bbtrain selbst stoppt. Noetig: EIN
    Vergabepunkt (`data/figur.txt` oder Funktion) mit fester Rangfolge
    Graft > Bladeburner > Faktionsarbeit > Gym > Verbrechen; joinrun
    verliert sein Gym ganz.
15. **boot.js gibt nach 20 Minuten auf** (240 x 5 s) und raeumt `task.txt`
    nicht - ein Auftrag aus dem alten Knoten laeuft im neuen. Der eine
    Fall, in dem der Rueckruf gebraucht wird (home belegt), ist der, in dem
    er aufgibt.
16. **Logs sind Speicherlisten mit "w".** Jeder Neustart loescht die
    Vorgeschichte; bn4net-log haelt 200 Zeilen (~30 min). Post-mortem nach
    einem unbeobachteten Ausfall ist unmoeglich - heute nur ueber die
    Erfahrungswerte rekonstruierbar.
17. **task.txt ist ein Ein-Platz-Kanal ohne Wiederholung.** Fehlgeschlagene
    Auftraege verfallen (heute: wakelock 34 GB), zwei Schreiber binnen einer
    Sekunde verlieren einen.

---

## D. Knoten, die der Bot nicht kann (`knoten.md`, `uebergaenge.md`)

| Knoten | Was fehlt | Folge ohne Umbau |
|---|---|---|
| **BN9 x3** (Position 8-10) | `CloudServerLimit 0` - kein Mietrechner, `bn4net.js:616` betritt die Leiter nie. Hacking 0,35-3,5 $/s. Der Gratis-Hacknet-Server (SF9.1/BN9 nativ) liefert 0,28 Hashes/s = **70.000 $/s** - kein Skript verkauft Hashes (`spendHashes` kommt in src/ nicht vor). home 32->64 GB kostet 50 Mio. | **Totalstillstand in drei Laeufen.** Ein Hash-Verkaeufer (Hacknet-API 4 GB, kein Singularity) als erstes Werkzeug traegt den Kaltstart allein. Muss VOR Position 8 stehen. |
| **BN8 x3** (Ende) | Einzige Geldquelle Boerse; `stocks.js` steht in keiner Liste und weigert sich ohne 4S (26 Mrd). Die Leiter kauft aus den 250 Mio Startkapital binnen 50 min 25 Rechner fuer 211 Mio, die 0 $ verdienen. Bladeburner-Beitritt unmoeglich (Rank 0), bbtrain ruft alle 30 s `stopAction()`. | **Kapitalvernichtung + Totalstillstand.** Boersenbot ohne 4S ist ein eigenes Gewerk. Bis es existiert, ist BN8 nicht autonom - in der Route so fuehren. |
| **BN15 x3** | V1 ueber Daedalus existiert dort nicht (TRP nur im 4. Darknet-Labor); V2 bei BladeburnerRank **0,2** = ~94 h je Lauf; Labyrinth-Code: keine Zeile. | 3 x >= 94 h, teuerster Block. Entscheidung vor BN15: Labyrinth bauen oder 280 h einplanen. |
| BN13/14/7 | BladeburnerRank 0,45/0,6/0,6, SkillCost 2. blade.js kennt keinen Knotenfaktor; Kontrollpunkte sind BN6/10-Zahlen. | Kein Bruch, aber Fehlalarme und falsch dosierter Skillkauf. |
| BN3 | CloudServerCost 2, ScriptHackMoney 0,2 x StartingMoney 0,2 | Kaltstart 2-4 Tage je Lauf (Befund 9). |
| BN4 L2/L3 | Nicht in BLADE_KNOTEN -> faehrt V1 (46 h) statt V2 (25-29 h) | 40 h Routenzeit. Mit Befund 4 erledigt. |

---

## E. Zahlen: was falsch ist und was bestaetigt wurde (`zahlen.md`)

Falsch oder fehlend:
- `tools/checkin.js:46` `RANG_UNTERWEGS 73.660` ignoriert `BladeburnerRank`
  (BN10: 0,8). Restweg in BN10 um 14.732 Rang zu klein, BN15 um 58.928.
  Gleicher Fehler in `blade.js:1758-1769` (Einsatzschwelle p*: Vindictus
  0,750 -> korrekt 0,806).
- `blade.js:785-794` Hyperdrive-Nutzen ohne Levelmultiplikator: in BN10
  um >= Faktor 2 zu hoch, gewinnt die Skillsortierung um Faktor 5.
- `blade.js:2703` "123 Rang/min" - korrekt 84,5 (Vor-Audit F5, steht noch).
- `sleeve.js:66-72` Sleeve-Beitrag 3,25/s - korrekt 2,5/s (Sleeverate x
  sync 25, nicht Spielerrate).
- `bn4rep.js:113` `WD_DIFFICULTY[12] = 1` statt 1,02^Stufe (2-6 %, nur
  Rangfolge).
- **Meine Messung "106.000 exp/h" war Nachholbetrieb, nicht Rate.**
  Stationaer: Spieler 12,62/s + 2 Sleeves x 2,5 = **63.400 exp/h**. Rest bis
  zum Tor ~627.000 exp -> **~9,9 h**, nicht 6,2.

Bestaetigt (identisch mit dem Quellcode, programmatisch verglichen): alle
21 Black Ops (Daten, Gewichte, Rang), Rang je Aktion, Erfolgsformel inkl.
Skill-/Int-/Ausdauer-/Truppfaktoren, Chaos, Bevoelkerung, Nachschub,
Skillkosten, HP-Folgen, Beitrittstor, Gym-Exp und -Kosten,
Entropie-Tabelle (Vor-Audit F4 entkraeftet), Augmentierungspreise, NFG,
Favor, Spendenformel, Einbau-Moment, WD-Ziel je Knoten, Hack/Grow/Weaken-
Kennzahlen, growthAnalyze-Nutzung, Amortisation. Daedalus 400.000 und die
21 Black Ops skalieren in keinem Knoten.

---

## F. Meine eigenen Werkzeuge sind Teil des Problems

- **Die "Spielzeit"-Uhr ist falsch.** `engine.tsx:344-350` schreibt
  Offline-Zeit VOLL auf `totalPlaytime`. `checkin.js` und `rueckstand.js`
  nehmen sie als Mass fuer "das Spiel lief" - "Tempo 1,0 ueber 11,5 h" war
  heute die Offline-Gutschrift. Jede Rate ueber ein Fenster mit Rechner-aus
  ist damit Bestand, nicht Rate (Lehre vom 30.08., hier nicht angewendet).
  Richtig: Spruenge von `lastUpdate` > 1 h als Offline markieren und Fenster
  verwerfen.
- `checkin.js` meldet 13 h Stillstand als `ANLAUF`, nicht `STEHT`
  (eingetragen 02.09. 05:27).
- `tools/tor.js` liest veraltete Telemetrie und kennt die Sleeves nicht.
- `skills/bb.md` behaelt sich drei Entscheidungen vor (Ziel bestaetigen,
  Ausgang ausloesen, Kurs herleiten) - alle drei entfallen mit A.

---

## G. Das Betriebsmodell (Erics Entscheidung, `praemisse.md` H4)

Skripte laufen offline **nicht**; Bladeburner holt hoechstens 5 Spiel-
sekunden je Realsekunde nach, Sleeves 15 Zyklen je Takt, Spielerarbeit als
Klumpen. Gleichgewicht fuer Bladeburner: 4,8 h Vordergrund-Tab je Tag. Alle
Entscheidungen des Bots fallen nur im Fenster. BN10 L1 brauchte 94,9 h
Kalender fuer ~52 h Spielzeit ab Beitritt (Faktor 1,8). Hochgerechnet:
1.100-1.900 h Spielzeit -> **3-5 Monate Kalender**, bei schlechterer
Tab-Disziplin ein Jahr. "Autonom" heisst heute: autonom in 5,5 von 24 h.

Der eine Hebel ausserhalb des Codes: die Electron-Fassung des Spiels setzt
`backgroundThrottling: false` (`reference/v301/electron/gameWindow.js`) -
gleicher Quellcode, Remote-API vorhanden (nicht ausprobiert), kein wakelock,
kein Vordergrundzwang. Rechnung dann 46-79 Tage. Kosten: Spielstand
umziehen, `tools/save.js` verliert die IndexedDB-Abkuerzung.

---

## H. Was NICHT geaendert wird (Einwaende, die nicht standhalten)

- **Zerlegung in Einzelaufruf-Skripte.** Gerechnet: ein Skript mit genau
  EINEM Singularity-Aufruf kostet mit SF4.1 33,6 GB (Fn1), 49,6 (Fn2),
  81,6 (Fn3) - passt auf kein frisches 32-GB-home. Es gibt genau noch
  einen 16x-Kaltstart (BN10 L3); ab Position 8 (SF4.3) ist das Problem
  weg. Zwei Steuerskripte umbauen fuer einen Lauf lohnt nicht. Die einzige
  richtige Zerlegung ist die des Ausgangs (A).
- **Die Route aendern.** Sie ist der Grund, warum sich die RAM-Frage
  selbst loest. Bleibt.
- **`ClassGymExpGain`** wird in v3.0.1 nirgends angewendet - BN4/BN13 (0,5)
  daempfen das Gym NICHT. Kein Bot-Fehler, nur die Roadmap-Formulierung
  "Skill x2/x3" meint `BladeburnerSkillCost`.
- **Hacknet-Server-RAM als Werkbank.** `ramRatio` halbiert die Hash-Rate,
  sobald Skripte darauf laufen. Erst Hashes verkaufen, dann sehen.
- **Die Wache wieder anwerfen.** Sie ist unter der Praemisse ein
  Aussenwerkzeug und heute nachweislich schaedlich (Befund 12/13).
  Stillstandserkennung gehoert in bn4net.
- **Entropie-Tabelle in bbtrain** (Vor-Audit F4): nachgerechnet korrekt.

---

## I. Reihenfolge der Umbauten

Jeder Punkt laeuft danach unbeaufsichtigt weiter, also: Skeptiker-Lauf vor
dem Einbau, `[skeptiker]` im Commit. Aufwand grob.

1. **Ausgang + Route** (A, Befunde 1-5). Vor dem Ende von BN10 L2, also in
   den naechsten 2-3 Tagen. `ausgang.js` + `data/route.json` +
   `verfahren.txt`; `BLADE_KNOTEN`, Guard, Obergrenze 13, Home-only-exec
   raus; boot.js raeumt exit-ziel.txt, task.txt, simulacrum.txt. ~250 Z.
2. **Geldboden** (Befunde 6-8). sleeve.js/joinrun.js/bbtrain: Gym nur,
   wenn Konto >= 2.400 $/s x Koerper x (storedCycles/5 + Takt) und ueber
   einer gemeinsamen Reserve; sonst Verbrechen (Mug: Kampf-exp + Geld).
   Sleeves nie auf denselben Stat wie die Figur (Offline-Klumpen verteilen).
   Nach Einbau/Laden erst Konto pruefen. ~60 Z.
3. **Kaltstart** (Befunde 9-11). Leiter mit Knotenpreis und Faktor 1,0 bei
   null eigenen Rechnern; bn4net um 2 GB verschlanken, damit contracts.js
   ab Sekunde 1 auf home laeuft; wakelock unter 15 GB (Worker-Timer statt
   DOM) und an Position 1; Autoexec `boot.js` (Handgriff von Eric oder per
   DOM). ~80 Z. + 1 Handgriff.
4. **Selbstheilung im Motor** (Befunde 12, 14-17). Telemetriealter je
   Werkzeug in bn4net, Entdopplung behaelt die frische Instanz, boot.js
   endlos, task.txt mit Wiederholung, Logs anhaengen statt ueberschreiben,
   Figur-Vergabepunkt, jede rufeMenschen-Stelle wird eine Handlung.
   ~200 Z., verteilt.
5. **Autostart-Eintrag** `Bitburner-Aufsicht.cmd` entfernen (Eric).
6. **BN9-Gewerk** (Hash-Verkaeufer, Werkbank ohne Mietrechner) vor
   Position 8 - das sind nach BN10 L3 und BN4 L2/L3 rund 3 Laeufe Zeit.
   ~60 Z.
7. **Zahlen** (E): BladeburnerRank-Skalierung in checkin/blade, Hyperdrive,
   Kommentar 2703, Sleeve 2,5/s, WD[12]. ~20 Z.
8. **Werkzeuge** (F): Offline-Erkennung in checkin/rueckstand, ANLAUF ->
   STEHT, tor.js Frische. ~40 Z.
9. **BN15-Entscheidung** und **BN8-Boersenbot**: spaet, aber vor Position
   39 bzw. 42 - der Boersenbot ist ein eigenes Projekt.
10. **Betriebsmodell** (G): Electron oder Zweitprofil - Erics Entscheidung,
    unabhaengig vom Code.

---

## J. Nicht geprueft / offen

- RAM von exit.js im Spiel (519 GB gerechnet, nicht gemessen); Wirt des
  Sprungs vom 01.09.
- Electron-Fassung: Remote-API und Spielstand-Umzug nicht ausprobiert.
- Kaltstart-Raten ausserhalb BN10 sind Modell (BN6-Kontrolle: Faktor 2 zu
  pessimistisch); BN3/BN14 sind Groessenordnungen.
- `ns.cloud.getServerLimit()` in BN9 = 0 aus dem Quellcode, nicht im Spiel.
- Bladeburner-Aufbauphase bei SkillCost 2/3 nicht simuliert.
- Ob sich in bn4net wirklich 2 GB sparen lassen (getScriptRam nach Umbau).
- bn4rep im Kampfknoten-Zweig (`lueckeZuGross` fuer die Bladeburner-
  Faktion) nicht verfolgt.
