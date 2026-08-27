# Offene Baustellen

**Diese Datei ist die Arbeitsliste des Vorankommens-Loops.** Sie existiert, weil
Befunde sonst in Prosa verschwinden: Am 24.08.2026 sind drei von fuenf
Pruefbefunden untergegangen, weil sie in einem Fliesstext standen statt in einer
Liste, die man abhaken kann.

Regeln:
- **Ein Arbeitspunkt ist eine Zeile, die mit `### ` beginnt.** Nur solche Zeilen
  zaehlen. Steht unter einer Ueberschrift keine `### `-Zeile, ist der Abschnitt
  leer - Erklaerungen und Fliesstext sind keine Arbeit.
- **`## Sofort` hat Vorrang vor `## Offen`**, ohne Abwaegung. Dort tragen der
  Reportloop und die Wache ein, was sie kaputt vorfinden aber nicht selbst
  beheben. Abgeraeumtes wandert nach "Erledigt".
- **Die Reihenfolge in der Datei IST die Rangfolge.** Nicht neu bewerten, nicht
  umsortieren. Ein Punkt, dessen Ueberschrift mit "Wartet bis <Uhrzeit>"
  beginnt, wird uebersprungen statt angefangen.
- Ein Punkt je Lauf. Wer fuenf Punkte gleichzeitig anfaengt, schliesst keinen.
- **Erledigtes wandert nach `nodes/ERLEDIGT.md`, nicht nach unten** (seit
  27.08.2026, 18:35). Es wird nie geloescht - der Verlauf ist die Begruendung
  fuer das, was heute steht -, aber er gehoert nicht in die Arbeitsliste: Sie
  stand bei 1.777 Zeilen, davon 81 Prozent Archiv, und das Read-Werkzeug
  schneidet bei 2.000 stumm ab. Im Archiv wird **gegrept, nicht gelesen**:
  `grep -n -A12 "<stichwort>" nodes/ERLEDIGT.md`.
- Was hier nicht steht, wird nicht bearbeitet. Neue Befunde kommen zuerst hierher.
- **Die Loops entscheiden selbst. "Wartet bis Eric" ist kein Ablageort fuer
  unbequeme Entscheidungen** (Eric, 26.08.2026, 16:05). Aus einer belegten
  Erkenntnis wird ein **unmittelbarer Arbeitsauftrag**, nicht ein Wartestatus.
  Wer eine Zahl gemessen hat, die eine Aenderung rechtfertigt, setzt sie um und
  misst nach - und nimmt sie zurueck, wenn sie nicht traegt.
  **Seit dem 27.08.2026, 05:00 ohne Ausnahme.** Eric hat den Vorbehalt fuer
  `src/bn4net.js` und `src/boot.js` aufgehoben - mit der Auflage, dort **jede
  Aenderung einzeln zu committen**, damit sie sich einzeln zurueckdrehen
  laesst. Sein Ziel: "Ich will das Projekt hier nahezu vollstaendig durch
  Loops laufen und entscheiden lassen, so dass ich eigentlich nicht noetig
  bin."
  **Die Reihenfolge der BitNodes bleibt unangetastet** - nicht als Vorbehalt,
  sondern weil sie feststeht (Fables Analyse,
  `nodes/AUDIT-ROADMAP-2026-08-24.md`). Auch Eric will dort nicht mehr
  dazwischenfunken.
  *Anlass: Der Raid-Befund vom 26.08. stand vier Laeufe lang auf "Wartet bis
  Eric entscheidet", obwohl jede Zahl dafuer gemessen war. Das kostete den
  groessten offenen Hebel des Knotens einen halben Nachmittag.*

---

## Sofort

### Zwei Handgriffe im Spiel, die die Selbstheilung vollenden (19:45)

Beide sind Ein-Klick-Sachen fuer Eric und von aussen nicht setzbar. Die
Aufsicht prueft sie und erinnert daran, statt dass sie jemand vergisst.

**1. Autoexec auf `boot.js`** — Options -> System -> "Autoexec Script + Args".
`Settings.AutoexecScript` wird beim Laden der Seite auf `home` gestartet
(`NetscriptWorker.ts:185-253`). Damit heilt sich der Bot nach jedem
Seitenladen selbst. Risikofrei, weil `boot.js` idempotent ist — es prueft
`ns.ps("home")`, bevor es etwas startet (`boot.js:86,118`).

Was ohne diesen Schalter NICHT gedeckt ist — und nur das:

    Rechnerneustart        gedeckt: die Engine stellt laufende Skripte
                           selbst wieder her (loadAllRunningScripts)
    geplanter Einbau       gedeckt: bn4rep.js:960 ruft
                           installAugmentations("boot.js")
    alles tot, kein Reset   NUR ueber Autoexec

**Damit korrigiere ich meine eigene Darstellung von 19:44:** Das Loch ist
kleiner, als ich es genannt hatte. Der Rechnerneustart ist kein Fall — die
Engine startet die laufenden Skripte aus dem Spielstand neu. Es bleibt der
Totalausfall ohne Prestige.

**2. Opera mit `--remote-debugging-port=9222`.** Port 9222 ist zu. Solange
das so ist, kann kein Skript pruefen, ob der Spiel-Tab lebt, und keine
Sitzung im Notfall etwas im Spielterminal eintippen. Das ist der letzte
Punkt, an dem das System einen Menschen braucht — aber ein seltener: Er
greift nur, wenn Autoexec (Punkt 1) und der Einbau-Rueckruf beide versagen.

### Die versionierten Loop-Prompts weichen von den laufenden Jobs ab (19:22)
Gemessen: Der aktive Reportloop enthaelt einen Absatz "Die Rangrate gehoert geglaettet gemessen ... Der Ausdauerzyklus ist laenger als ein 30-Minuten-Fenster". In `loops/loop-report.md` stand er **nicht** - `grep -c Ausdauerzyklus` lieferte 0 in allen vier Dateien. Dasselbe beim Optimierloop ("Miss geglaettet").
Erwartet: Die Dateien in `loops/` sind die Wahrheit. Der Skill `/bb-loops` setzt die Cron-Jobs **woertlich aus ihnen** neu auf.
Verdacht: Eine Prompt-Regel wurde direkt beim `CronCreate` ergaenzt, ohne die Datei nachzuziehen. Behoben 19:22 durch Rueckuebertragen beider Absaetze.
**Folgenschwer, weil es still ist:** Cron-Jobs sterben mit der Sitzung. Beim Wiederaufsetzen aus `loops/` gehen alle Regeln verloren, die nur im laufenden Job stehen - und niemand merkt es, weil der Bot weiterlaeuft. Genau die Glaettungsregel war eine Lehre aus einer Scheindivergenz vom 26.08.
**Strukturell, nicht einmalig:** Solange Prompts von Hand an CronCreate gehen koennen, driften Datei und Job wieder auseinander. Die Regel lautet ab jetzt: **erst die Datei aendern, dann den Job aus der Datei neu setzen** - nie umgekehrt.

### Nachmessen: traegt die Black-Op-Schwelle 0,40? (12:50)
Gemessen: Typhoon-Chance min **0,116**, Mitte 0,1305 um 12:41 (`data/bbspann.json`).
Nachtrag 16:19 (`node tools/spann.js`): Chance **0,212 - 0,212, die Schaetzspanne ist ZU**. Um 15:51 stand dort noch 0,133 / 0,186. Field Analysis hat ihre Arbeit getan; der Motor rechnet ab jetzt mit einer exakten Zahl statt mit einer Untergrenze.
Damit ist die Lage klar: Der Rang ist mit **5845 gegen 2500** um mehr als das Doppelte uebererfuellt und war nie der Engpass. Der Engpass ist die Chance, und die haengt allein an den Kampfwerten. Von 0,116 (12:41) auf 0,212 (16:19) sind **+0,096 in 3,6 Stunden** - linear fortgeschrieben faellt 0,40 gegen **23:00**, was die 12-Stunden-Schaetzung von 12:50 bestaetigt. Die Schwelle steht seit 12:49 auf **0,40** statt 0,80 (`blade.js:143`), weil die alte Begruendung eine Fehlrechnung war - siehe den Commit und `nodes/HEBEL.md`.
Erwartet: Die Schwelle darf **jetzt noch nicht feuern**. Verifiziert um 12:49: Motor waehlt `Contracts/Bounty Hunter`, `URTEIL: SPUR`. Bei der gemessenen Steigerung (Faktor 1,25 je 2,5 Stunden) wird 0,40 in **rund 12 Stunden** erreicht, also gegen Mitternacht.
**KORREKTUR 17:51: Die Kostenannahme war um Faktor 40 zu hoch.** Ein
Fehlschlag kostet `min(Geld * 0,1, fehlendeHP * 100.000)`, und der ZWEITE Term
deckelt: Die Hoechstgrenze der Trefferpunkte steht bei **29**
(`data/blade.json`, 17:47), also **maximal 2,9 Millionen** - nicht 115 und
nicht 360. Dieselbe Formel steht in `nodes/HEBEL.md` beim
Krankenhaus-statt-Kammer-Hebel richtig gerechnet und mit 1,2 Millionen
GEMESSEN; beim Black-Op-Eintrag wurde nur der erste Term eingesetzt. Damit ist
auch das Abbruchkriterium unten wertlos: 150 Millionen koennen nie eintreten.

Der Grund fuer eine hohe Schwelle ist ein anderer und staerker: **die
Opportunitaetsrate.** Typhoon bringt bei Chance 0,29 und 196 Sekunden Dauer
`(0,29*50 - 0,71*10)/3,27 = 2,3 Rang je Minute`, waehrend die laufende Arbeit
**15,67** liefert. Rangmaessig lohnt Typhoon bei keiner erreichbaren Chance -
es ist ein Pflichtschritt zum Freischalten, kein Ertragsschritt. Genau deshalb
bleibt 0,40 richtig: Es geht nur darum, keine Zeit in Fehlversuchen zu
verbrennen (bei 0,40 sind es 8,2 Minuten je Black Op, bei 0,80 noch 4,1 - der
Unterschied ueber 21 Stueck ist gut eine Stunde, das Warten auf 0,80 kostet
ein Vielfaches).

Zu pruefen bleibt, sobald sie feuert: **(1)** Bleiben die Kosten bei rund 2,9
Millionen? **(2)** Faellt der Rang unter 5.000 zurueck? Operation Zero
verlangt genau das.
Abbruchkriterium (neu gefasst 17:51): Kostet ein Fehlschlag mehr als 10 Millionen oder faellt der Rang um mehr als 100, gehoert die Schwelle auf 0,80 zurueck. Traegt sie, bleibt es bei 0,40 - tiefer zu gehen bringt nichts, weil der Zeitgewinn gegen die Fehlversuche laeuft.

## Offen, nach Dringlichkeit

### Der Bot rekrutiert nie ein Team - +9,4 Prozent auf jede Black Op fuer 24 Minuten (19:57, durchgerechnet 20:03)

Gemessen: `teamCount` ist 0 (`src/chance.js`, 18:19). Kein Skript in `src/`
ruft `setTeamSize` oder faehrt `General/Recruitment` - null Treffer im grep.

Beleg: `operationTeamSuccessBonus = (teamCount + 1)^0,05`
(`Actions/Operation.ts:96-98`) gilt fuer Operationen **und Black Ops** -
multiplikativ auf die competence, also auf die volle Reststrecke von 20
Black Ops.

**Charisma ist 264, nicht 27.** Damit ist `charisma^0,45 = 12,29`, und die
Rekrutierungschance `charisma^0,45/(teamSize+1)` (`data/GeneralActions.ts:
29-31`) steht **bis elf Mitglieder auf 1,00** - jeder Versuch sitzt. Erst
darueber faellt sie. Die urspruengliche Schaetzung von 3,8 Stunden ging von
Charisma 27 aus und war um Faktor vier zu pessimistisch.

Durchgerechnet, Dauer 285 s je Versuch:

    bis  5 Mitglieder   5 Versuche   0,40 h   Bonus  +9,4 %    23,7 %/h
    bis 11              11           0,87 h         +13,2 %     8,1 %/h
    bis 15              15           1,22 h         +14,9 %     4,7 %/h
    bis 20              23           1,80 h         +16,4 %     2,7 %/h
    bis 30              43           3,44 h         +18,7 %     1,2 %/h

**Der Grenznutzen bricht nach fuenf Mitgliedern um Faktor drei ein**, weil der
Exponent 0,05 extrem flach ist. Die ersten 24 Minuten bringen 9,4 Prozent,
die naechsten drei Stunden zusammen nur noch 9,3.

**Zielgroesse ist also 5 bis 8, nicht 20.** Und das haelt sich leicht selbst:
`BlackOperation.getMinimumCasualties()` gibt 1 zurueck
(`Actions/BlackOperation.ts:63-65`), aber solange die Chance auf 1,00 steht,
kostet jeder Ersatz genau einen Versuch - knapp fuenf Minuten.

**Der eigentliche Preis daneben:** `Raid` hat in `data/bbspann.json` einen
Ertrag von **66,3 Rang je Minute** gemessen - gegen 18 bis 32, die der Motor
gerade faehrt. Raid verlangt ein Team und Bevoelkerung in der Stadt. Ob es
mit fuenf Mitgliedern fahrbar wird, ist die Frage, die diesen Punkt vom
netten Bonus zum groessten Hebel des Knotens macht. Die frueheren
Raid-Rechnungen in `nodes/HEBEL.md` gingen alle von Charisma 27 aus und
gehoeren mit 264 neu aufgemacht.

Zu tun: (1) In `blade.js` eine Regel, die `General/Recruitment` faehrt,
solange `getTeamSize` unter 6 liegt - aber nur, wenn keine Black Op ansteht
und die Ausdauer nicht knapp ist. (2) Danach messen, ob `Raid` seine
Mindestchance erreicht, und die alte Ablehnung mit den neuen Zahlen
pruefen.

### Der Rechner laeuft nur 5,5 von 24 Stunden - die Schwelle liegt bei 4,8 (18:52)

**Gemessen um 18:49: `storedCycles` = 8, Rueckstand 0,0 Minuten.** Der Tab ist
also nicht gedrosselt und es haengt nichts hinterher. Das ist der Ausgangswert
einer Messreihe, kein Entwarnungssignal - der Rechner lief bisher durch.

Eric hat kein Homeoffice; der Rechner laeuft kuenftig etwa **15:30 bis 21:00**.
Bitburner verliert dadurch keinen Bladeburner-Rang: `engine.tsx:333` legt die
Offline-Zeit vollstaendig als `storedCycles` zur Seite (`Bladeburner.ts:275`,
`clampInteger(..., 0)` - keine Obergrenze), und `process()` arbeitet sie mit
hoechstens fuenf Spielsekunden je Aufruf ab (`Bladeburner.ts:1375-1378`), einmal
je Realsekunde (`engine.tsx:150,201` plus `MilliPerCycle 200`).

    Abbau je Realstunde = 5 h Spielzeit, davon 1 h "neu"  ->  netto 4 h
    Gleichgewicht:  T_on * 4 = 24 - T_on   ->   T_on = 4,8 h am Tag

**5,5 Stunden liegen darueber - aber der Puffer sind 42 Minuten.** Ein
kuerzerer Tag, und der Rest bleibt stehen und summiert sich. Ausserdem gehen
4,6 der 5,5 Stunden fuers Aufholen drauf; in dieser Zeit laeuft das Spiel
fuenffach beschleunigt, waehrend die Claude-Loops in Echtzeit takten - die
Strategie entscheidet also fuenfmal traeger, als das Spiel laeuft.

**Der zweite Weg unter die Schwelle ist die Tab-Drosselung.** Ein verdeckter
Tab bekommt eine Timer-Weckung je Minute (`doku/drosselung.md`), dann faellt
der Abbau von 5 s/s auf 5 s/min - Faktor zwoelf. Damit reicht auch ein
durchlaufender Rechner nicht mehr.

Werkzeug dafuer ist neu: `node tools/rueckstand.js` liest `storedCycles` aus
dem Spielstand (die API kennt es nicht), schreibt es nach
`data/rueckstand.json` fort und meldet den Trend je Stunde. Es gehoert in den
Reportloop, damit aus der Rechnung oben eine Messreihe wird.

Zu tun: (1) Den Aufruf in den Reportloop aufnehmen. (2) Nach drei Tagen
entscheiden, ob 5,5 Stunden reichen - **an der Messreihe, nicht an dieser
Rechnung**. (3) Waechst der Rueckstand, ist die Drosselung der erste Verdacht,
nicht die Rechnerzeit.


### Der Ausgang aus BitNode 6: 319.430 Rang netto, geschaetzt 80-180 Stunden (17:51, korrigiert 18:13 nach Fremdpruefung)

**Erstmals vollstaendig gemessen** (`src/blackops.js` schreibt
`data/blackops.json`). Rang 6.910 zum Messzeitpunkt, alle 21 Black Ops:

     1. Typhoon        Rang   2.500   Chance 0,278-0,305    196 s
     2. Zero           Rang   5.000   Chance 0,086-0,094    244 s
     3. X              Rang   7.500   Chance 0,186-0,203    293 s
     5. Ares           Rang  12.500   Chance 0,133-0,146    488 s
    10. Deckard        Rang  40.000   Chance 0,032-0,035  1.952 s
    15. Morpheus       Rang 150.000   Chance 0,006-0,007  4.391 s
    21. Daedalus       Rang 400.000   Chance 0,003-0,003  7.807 s

Die Rangschwellen sind gegen `reference/bitburner-src/src/Bladeburner/data/
BlackOperations.ts` geprueft und stimmen exakt. BN6 setzt keinen
`BladeburnerRank`-Multiplikator.

**Der Rang ist der Engpass, nicht die Chance.** Das haelt. Aber drei Zahlen im
urspruenglichen Eintrag waren falsch; sie sind hier ersetzt:

**(1) Die Strecke ist kuerzer als 400.000.** Die ersten zwanzig Black Ops
liefern zusammen **73.660 Rang** (`rankGain` 50 bis 20.000, nachgerechnet).
Netto bleiben **319.430** statt 393.090 - 18 Prozent der Strecke waren
doppelt gezaehlt.

**(2) Die 418 Stunden waren eine unzulaessige lineare Fortschreibung.** Der
Rang erzeugt seine eigene Beschleunigung: `skillPoints = floor(maxRank/3)`
(`Constants.ts:47`), und weil die Fertigkeitskosten LINEAR steigen
(`Skill.ts:37-41`), waechst die Stufe mit `sqrt(Punkte)`, also mit
`sqrt(Rang)`. Damit gilt `dR/dt ~ R^a` mit a zwischen 0,4 und 0,6 statt a = 0.
Mit `t = R1/(rate*(1-a)) * ((R2/R1)^(1-a) - 1)`:

    a = 0,3  ->  179 h        a = 0,5  ->  103 h
    a = 0,44 ->  121 h        a = 0,6  ->   79 h
    a = 0    ->  443 h   <- die alte Zahl

**Die eigene Messreihe widerlegt a = 0**: 6.910 Rang in rund 50 Stunden
Knotenlaufzeit sind 2,3 je Minute im Mittel gegen 14,8 jetzt - Faktor 6.
**Massgeblich sind 80-180 Stunden, Mitte rund 120.** Nicht die Aktionsstufen
sind der Motor (`rewardFac/difficultyFac^2` ist bei Bounty Hunter 1,003, also
fast neutral), sondern die Fertigkeitspunkte.

**(3) "43.000 Versuche" bei Chance 0,003 war Faktor 130 daneben.** Der
Erwartungswert ist `1/p = 333` Versuche. Die Aussage, die spaeten Black Ops
seien mit heutigen Kampfwerten nicht fahrbar, bleibt trotzdem richtig -
333 Versuche zu 7.807 Sekunden sind 722 Stunden.

**Der Hackweg ist geprueft und faellt aus.** `destroyW0r1dD43m0n` akzeptiert
Hacking >= 6.000 (`requiredHackingSkill 3000` x `WorldDaemonDifficulty 2`)
ODER 21 Black Ops (`Singularity.ts:1148-1160`). Aber `level = floor(mult *
(32*ln(exp) - 200))` mit `mult = 0,35 * Aug-Mult` (BN6:
`HackingLevelMultiplier 0,35`) verlangt bei Aug-Mult 3 ein `exp` von e^184 -
unerreichbar. Erst ab Hacking-Multiplikator 25-30 wird es rechnerisch
moeglich. Dazu verlangt Daedalus in BN6 **35 Augmentierungen** statt 30
(`DaedalusAugsRequirement`). Black Ops bleiben der Weg.

### Der groesste ungehobene Hebel: eine Augmentierungsrunde - Engpass ist GELD (18:13)

**Der Bladeburner-Fortschritt ueberlebt den Einbau fast vollstaendig.**
`Prestige.ts:153-154` ruft `Bladeburner.prestigeAugmentation()
(`Bladeburner.ts:259-263`), und das macht **nur** `resetAction()` +
`joinFaction()`. Rang, `skillPoints`, Fertigkeitsstufen und Aktionsstufen
bleiben stehen. Es fallen allein die Kampfwerte.

**Und die kommen ueberproportional schneller zurueck.** Die Kampfstufe ist
*multiplikativ* im Augmentierungs-Multiplikator, aber nur *logarithmisch* in
der Erfahrung (`PersonObjects/formulas/skill.ts:13`). Stufe 1.000 bei
mult 1,0 verlangt `exp = e^37,5 = 1,9e16`; bei mult 1,1 genuegt
`exp = e^34,6 = 1,1e15` - **17-mal weniger, also rund 6 Prozent der bisherigen
Trainingszeit**. Der Wiederaufbau kostet Stunden, die Decke steigt dauerhaft.

**Reputation ist kein Engpass, Geld ist einer.** Bei Rang 6.910 sind
mindestens 13.820 Bladeburner-Reputation verdient (`RankToFactionRepFactor 2`).
Die Preise:

    INTERLINKED     25.000 Rep   $5,5 Mrd   (Erfahrung auf alle vier Werte)
    Golem Serum     31.250 Rep   $11 Mrd    (str/def/dex/agi je x1,07)
    Omnibeam        62.500 Rep   $27,5 Mrd  (+10 % Erfolgschance)

Kontostand um 18:00: **2,5 Milliarden**. Damit ist die Zielsetzung der Loops
unvollstaendig: Sie optimieren Rangrate, aber der Hebel mit dem groessten
Dauerertrag haengt am Geld - und Geld steht in keinem Ziel der letzten sechs
Berichte.

Zu tun: (1) Die drei Augmentierungen gegen ihre Wirkung auf die Rangrate
rechnen, nicht schaetzen. (2) Pruefen, was `bn4net` an Geld je Stunde liefert
und ob sich das heben laesst (BN6 hat `ScriptHackMoney 0,75`, also nur leicht
gedaempft). (3) Erst dann entscheiden, wann der Einbau faellt.

### Der Faehigkeitsplan hat feste Deckel - er veraltet zwangslaeufig

**Zweimal am 27.08. lag eine deutlich bessere Faehigkeit gedeckelt daneben**,
waehrend die `Infinity`-Eintraege alle Punkte auffrassen:

    12:52   Hyperdrive       Stufe 0, 1 Punkt      1,451 % je Punkt
    13:19   Short-Circuit    Stufe 12, 27 Punkte   0,122
            Blade's Intuition Stufe 25, 56 Punkte  0,031   <- bekam alles

Die Ursache ist strukturell: Die Kosten steigen **linear** mit der Stufe
(`(baseCost + level * costInc) * mult`, `Bladeburner/Skill.ts:37-41`), der
Nutzen je Stufe bleibt konstant - also faellt der Nutzen je Punkt monoton, und
die beste Faehigkeit wandert im Lauf des Knotens. Ein Plan mit festen Zahlen
kann das nicht abbilden; er ist ab dem Moment falsch, in dem eine
`Infinity`-Faehigkeit teurer wird als eine gedeckelte.

**Der Fix:** `SKILL_PLAN` durch einen Vergleich ersetzen, der bei jedem Kauf
den **relativen Nutzen je Punkt** rechnet und die beste Faehigkeit nimmt.
Relativ, nicht absolut - die Multiplikatoren verrechnen sich multiplikativ, ein
Prozentpunkt auf 1,66 ist mehr wert als auf 2,65. Die Daten dafuer liegen
bereits vor: `ns.bladeburner.getSkillUpgradeCost` und die Tabelle in
`data/Skills.ts`.

**GEAENDERT 13:49, Wirkung noch nicht gemessen.** Die drei Faehigkeiten, deren
Wirkung auf die Black-Op-Chance gerechnet ist - **Hyperdrive, Short-Circuit,
Blade's Intuition** -, werden vor jedem Kauf nach relativem Nutzen je Punkt
sortiert und tauschen ihre Planplaetze untereinander. Deckel und alle uebrigen
Eintraege bleiben unangetastet; wer am Deckel steht, faellt auf -1 und wandert
nach hinten.

Verifiziert ist bisher nur, dass nichts bricht: nach dem Neustart um 13:49
Rang 5.024, Aktion `Contracts/Tracking`, `URTEIL: SPUR`.

**Nachzumessen:** Bei 26 Punkten und Preis 27 muss der Motor jetzt auf
**Short-Circuit** sparen (0,122 je Punkt) statt auf Blade's Intuition (0,031).
Ablesen an der Stufe in `data/bbspann.json` - steigt Short-Circuit ueber 12,
traegt die Sortierung. Steigt stattdessen Blade's Intuition ueber 25, greift
sie nicht und der Commit gehoert zurueckgedreht.

**Was offen bleibt:** Die neun uebrigen Faehigkeiten stehen weiter in fester
Folge, weil ihre Wirkung auf den Traeger nicht gerechnet ist. Digital Observer
trifft nur Operations, Cloak nur Stealth, Hands of Midas nur Geld - fuer sie
braucht es erst eine Umrechnung in Prozent Black-Op-Chance, bevor sie in den
Vergleich duerfen.

**Achtung bei der Umsetzung:** Nicht jede Faehigkeit wirkt auf den Traeger.
Digital Observer trifft nur Operations, Cloak nur Stealth, Hands of Midas nur
Geld - Typhoon ist `isKill`, also zaehlen Blade's Intuition (alle),
Short-Circuit (kill) und ueber die Erfahrung Hyperdrive. Ein blinder
Nutzen-je-Punkt-Vergleich ueber alle zwoelf Faehigkeiten kauft sonst Unsinn.


### Operation Typhoon ist mit Rang 2500 erreichbar, aber nicht fahrbar

**Alle drei Messauftraege sind erledigt (27.08., 01:20) - und die Antwort ist
beruhigender als der Befund klang.**

**1. Kampfwerte aus Bladeburner-Arbeit: 0,159 dex je Minute.** Gemessen aus
den Pruefausgaben, 20:07 (dex 181) gegen 01:15 (dex 230), 308 Minuten. Fuer
dex 4.400 waeren das **434 Stunden** - auf diesem Weg unerreichbar.

**2. Gym scheidet ebenfalls aus, und zwar rechnerisch.** Die Erfahrungskurve
ist `exp = e^((lvl/mult + 200)/32) - 534,6`
(`PersonObjects/formulas/skill.ts:17-19`). Bei `mults.dexterity` = 1,834
braeuchte dex 4.400 einen Exponenten von rund `(2.399+200)/32 = 81` - eine
Zahl jenseits jeder Spielzeit.

**3. Der Fehlschlag-Versuch ist strikt defizitaer** (schon 01:05 gerechnet):
`rankLoss` 10 gegen `rankGain` 50, bei 3,7 Prozent Chance im Mittel 27
Versuche je Erfolg - also 270 Rang Verlust gegen 50 Gewinn.

**Der Ausweg stand die ganze Zeit im Multiplikator.** `calculateSkill` ist
`floor(mult * (32*ln(exp + 534,6) - 200))` - der Multiplikator wirkt **direkt
auf das Ergebnis**, nicht auf die Erfahrung. Gemessen 01:15: `mults.dexterity`
steht bei **1,834**, str und def bei 1,260, agi bei 1,389, bei 14
installierten Augmentierungen. Die Basis hinter dex 230 ist also 125 - mit
einem Multiplikator von 20 waeren daraus 2.508, mit 35 rund 4.390.

**Damit ist die Route richtig und nur die Erwartung war falsch.** Rang 2500 ist
kein Ausgang, sondern ein Zwischenschritt; die Black Ops kommen nach mehreren
Augmentierungs-Zyklen im selben Knoten. Genau das tut der Bot bereits -
`bn4rep` sammelt Reputation, `bn4net` baut aus, und um 16:31 lief der erste
Einbau dieses Laufs.

**Was daraus folgt, ohne Umbau:** Die Bladeburner-Augmentierungen selbst sind
schwach (`bladeburner_success_chance` 1,02 bis 1,06,
`Augmentation/Augmentations.ts:203,215,228`; nur eine gibt x2). Der Hebel sind
die **Kampfwert-Multiplikatoren**.

**Und genau die sieht der Bot nicht (geprueft 27.08., 01:50).** `bn4rep.js`
waehlt Faktion und Zielaugmentierung ueber `levelNutzen`/`hackNutzen` aus
`lib/hackaugs.js` - und dessen Kopfkommentar sagt es selbst: die Liste enthaelt
"alle Augmentierungen, die mindestens einen **Hacking- oder
Reputations-Multiplikator** setzen". Kampfwert-Augmentierungen kommen darin
**gar nicht vor**. In einem Knoten, dessen Traeger der Bladeburner-Rang ist und
dessen Ausgang an den Kampfwerten haengt, priorisiert der Reputationsmotor also
ausschliesslich nach Hacking.

Was dabei liegen bleibt, aus `Augmentations.ts` gezaehlt - 17 Augmentierungen
setzen mindestens drei Kampfwerte, die staerksten:

    Augmentierung          Produkt   repCost   je Wert
    SPTN-97                   9,38   1,25e6    1,75
    CordiARC Reactor          3,32   1,125e6   1,35
    Photosynthetic Cells      2,74   5,625e5   1,40 (str/def/agi)
    nextSENS / Xanipher       2,07   4,375e5   1,20
    Bionic Spine              1,75   4,5e4     1,15

Zum Vergleich: `mults.dexterity` steht heute bei **1,834**. Allein SPTN-97
wuerde ihn auf 3,21 heben - dex 230 wuerde damit zu rund 402, und die
Typhoon-Chance von 0,037 auf grob 0,075 steigen.

**Auftrag, eigener Lauf:** Eine Kampfwert-Liste analog zu `lib/hackaugs.js`
anlegen und `bn4rep.js` in den Kampfknoten (6 und 7) danach priorisieren
lassen. Zwei Dateien, deshalb nicht in diesem Lauf. **Vorher zu klaeren:** ob
`bn4rep` ueberhaupt kauft oder nur freischaltet, und wie die Nachtsteuerung
(`nacht.cmd`) die Auswahl trifft - sonst wird an der falschen Stelle
umgebaut.

**Dringlichkeit: hoch.** Es ist die Frage, ob der Knoten ueberhaupt auf dem
eingeschlagenen Weg endet.

Gemessen 27.08., 00:57: Die Erfolgschance von Operation Typhoon liegt bei
**0,035 bis 0,038** - unveraendert gegenueber 15:46 (0,035 bis 0,042), obwohl
sich der Rang von 745 auf 1528 verdoppelt hat. Der Grund steht in HEBEL.md
(01:05): **Der Rang geht nicht in die Chance ein.** Black Ops ignorieren
Stadtwerte und Chaos, ihre Schwierigkeit ist die feste `baseDifficulty` 2000,
und die Chance ist `competence / 2000` mit
`competence = SUMME weights[stat] * effSkill^0,9`.

Fuer 50 Prozent braucht es **Faktor 19,6 in den Kampfwerten** - dex von 224
auf rund 4.400. Ueber Faehigkeiten ist das nicht zu holen (Reaper 2 Prozent je
Stufe, Evasive System 4 auf dex/agi; Stufe 50 in beiden braechte x3,5).

**Zu messen, bevor irgendetwas entschieden wird:**
1. Wie schnell wachsen die Kampfwerte aus Bladeburner-Arbeit? Aus
   `data/aktionen.txt` laesst sich das nicht ablesen - es braucht zwei
   Messpunkte der Kampfwerte mit Zeitstempel. Der Strategiepruefer schreibt
   sie bereits in `data/verlauf-strategie.json`.
2. Was kostet dieselbe Steigerung im Gym? Powerhouse Gym kostet 2.400 Dollar
   je Sekunde, das Guthaben liegt bei 18,7 Milliarden - Geld ist hier nicht
   der Engpass, Zeit ist es.
3. Was bringt ein Fehlschlag-Versuch? `rankLoss` 10, `hpLoss` 100
   (`data/BlackOperations.ts:12-14`). Bei 3,7 Prozent Chance kostet ein
   Erfolg im Mittel 27 Versuche, also 270 Rang und 2.700 HP-Schaden - gegen
   `rankGain` 50. **Das ist strikt defizitaer**, Typhoon auf gut Glueck zu
   versuchen scheidet damit aus.

**Erst danach ist die Route zu bewerten** - und eine Aenderung an der
Reihenfolge der BitNodes waere Erics Entscheidung, kein Loop-Beschluss.


### 1. Der V2-Kontrollpunkt ist nie gemessen worden

`nodes/ROUTE.md` Abschnitt 4 erklaert ihn fuer bindend: **Rang nach zwei Stunden
in BitNode 6 mindestens 6.000 mit Raid, mindestens 3.500 ohne.** Die gesamte
Reihenfolge ab Platz 3 steht auf einer Simulation, die nie gegen einen echten
Lauf geprueft wurde.

**Der Beitritt steht seit dem 25.08.2026 zwischen 16:20 und 16:29** (um 16:19:55
war der Kampfwert-Tiefstand noch 98, um 16:29:23 meldete `bblage.json`
`inBladeburner: true` bei Rang 0). Genauer laesst er sich nicht mehr eingrenzen:
bbtrain schrieb `data/bbjoin.txt` lokal auf die Werkbank statt nach home - das
ist inzwischen behoben, half aber fuer diesen Beitritt nicht mehr.

**Der Kontrollpunkt faellt damit auf 18:30 Uhr.** Zu messen ist dann der Rang
aus `data/blade.json` gegen die Schwelle aus ROUTE.md: mindestens 6.000 mit
Raid, mindestens 3.500 ohne. Das Ergebnis gehoert nach ROUTE.md.

Zwischenstand 16:29: Rang 0, Ausdauer 41/41, Aktion "Field Analysis" (die
Erfolgsschaetzungen sind noch zu unscharf fuer einen Vertrag), naechste Black Op
"Operation Typhoon" ab Rang 2.500.

**Dringlichkeit:** hoch. Es ist das wertvollste Einzelergebnis der naechsten
Tage - an ihm haengt die gesamte Reihenfolge ab Platz 3.

### 2. Der Erfahrungsofen (Befund B1 aus dem Bot-Audit)

Der Umbau wurde am 25.08. per `git checkout` zurueckgenommen, weil die
Skeptiker-Runde vier Konstruktionsfehler fand: Das "Ventil" mass Fragmentierung
statt Bedarf, hebelte die Kaufbremse aus, vertrat den Stapelbetrieb gar nicht
und hatte eine katastrophale Kill-Granularitaet.

`src/worker/expfarm.js` liegt fertig und unverdrahtet im Baum (1,75 GB je Faden
statt 1,80 beim Einwegarbeiter). Was fehlt, ist die Zuteilung:
- Ofenbudget aus den Bedarfen DERSELBEN Runde ableiten, nicht aus der vorigen
- Raeumen nach dem share-Muster (bn4net.js:1565)
- Lease im Arbeiter gegen Waisen
- `ramJeSkript` um `worker/expfarm.js` ergaenzen
- danach den Einweg-Pfad (bn4net.js ~1596-1622) streichen

**Dringlichkeit:** niedrig in BitNode 6 - der Ofen beschleunigt den
Hacking-Weg, und der traegt diesen Knoten nicht. Vor dem naechsten V1-Knoten
wieder hochstufen.

### 3. Boersen-Bot fuer BitNode 8

BitNode 8 steht ganz am Ende der Route (Platz 42-44) und ist der einzige Knoten
ohne Bladeburner, Gang, Corporation und Skript-Hackgeld. Reputation ist dort
eine reine Geldfrage - und Geld kommt nur aus dem Aktienmarkt. Den Bot gibt es
noch nicht.

**Dringlichkeit:** niedrig, aber nicht null: Er ist die einzige Voraussetzung
auf der ganzen Route, die noch gar nicht existiert.

### 4. Darknet-Labyrinth-Gewerk (V1b)

`labyrinth.ts:424-427` legt The Red Pill ins sechste Darknet-Labor, aber nur bei
`hasFullDarknetAccess()` - also in BitNode 15 oder mit SF15. Jeder
Augmentierungs-Einbau wuerfelt das Darknet neu (Prestige.ts:76), es braucht also
je Labor einen Einbauzyklus und rund 24 Raetselloeser.

**Dringlichkeit:** niedrig. Erst vor BitNode 15 relevant.

---

---

## Erledigt

Ausgelagert nach [`nodes/ERLEDIGT.md`](ERLEDIGT.md) - dort steht das Archiv
mit allen Nachmessungen, neueste zuerst.

**Ein abgeraeumter Punkt wandert dorthin, nicht hierher.** Oben in die Datei,
mit Datum und der Zeile `Verifiziert: <Zahl> um <HH:MM>`.

**Vor dem Anlegen eines neuen Punktes dort nachsehen** - aber gezielt, nicht
durch Volllesung:

```bash
grep -n -A12 "<stichwort>" nodes/ERLEDIGT.md
```
