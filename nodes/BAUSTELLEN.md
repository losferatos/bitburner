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
- **Ein alter Zeitstempel ist KEIN Stillstand.** Mehrere Skripte steigen vor
  ihrer Telemetriezeile aus der Runde aus und arbeiten trotzdem einwandfrei.
  Die Lebenszeichen stehen woanders und sind bedingungslos:
  `data/hb-rep.txt` fuer `bn4rep.js` (Puls), `data/rep-ziel.txt` fuer sein
  aktuelles Ziel samt Rangliste, `data/wache-zustand.json` fuer den Waechter.
  `data/bn4rep.json` und `data/ps.json` sind Momentaufnahmen, keine Pulse.
  *In der Nacht zum 28.08. hat diese Falle einen Sofort-Punkt erzeugt, der
  komplett falsch war - die Warnung stand seit dem 24.08. in `bn4rep.js:389`,
  nur nicht dort, wo jemand sie sucht.*
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

keine

## Offen, nach Dringlichkeit

### Die Chaos-Hysterese hat Vorrang vor allem - auch vor dem Wiederaufbau (01:57)

Gemessen: Nach dem Einbau um 01:25 faehrt der Motor durchgehend
`General/Diplomacy` bei Chaos 58,3 - fuenf Messungen im Abstand von 20
Sekunden, alle gleich. Kampfwerte 101/105/121/101, Chancen
(`src/astufe.js`, 01:39): Assassination 0,354, Raid 0,230, Stealth
Retirement 0,561 - alle unter `SICHER_OPERATION` 0,85.

Erwartet: In der Wiederaufbauphase gehoert die Figur ins **Powerhouse Gym**.
Es hebt den Kampfwert-Tiefstand mit `expMult` 10 (`bbtrain.js:50`), waehrend
Diplomacy **null Rang und null Erfahrung** gibt. Bladeburner-Training waere
mit 30 exp je 30 s auf alle vier (`Bladeburner.ts:1092-1103`) immer noch
zehnmal langsamer als das Gym.

**Was um 01:52 eingebaut wurde und warum es nicht reicht:** Die Weichen-Regel
in `blade.js` prueft jetzt nicht mehr nur `tiefstand < 100` (nach einem
Prestige mit hohen Multiplikatoren ist das binnen Minuten wieder erfuellt),
sondern auch, ob ueberhaupt eine Operation oder ein Vertrag ueber seiner
Schwelle liegt. **Sie greift trotzdem nicht** - offenbar steht mindestens ein
Vertrag ueber `SICHER_VERTRAG` = 0,45, also gilt die Arbeit als lohnend.

Und genau dann schlaegt die naechste Regel zu: `waehle()` prueft die
Chaos-Hysterese (`CHAOS_EIN` 50 / `CHAOS_AUS` 47) **vor** der Vertragswahl
und faehrt Diplomacy, bis das Chaos unter 47 liegt. Von 58,3 aus sind das bei
rund 1,5 Prozent je Lauf etwa **14 Minuten ohne jeden Ertrag** - und ohne
Gym, weil die laufende Bladeburner-Aktion die Gym-Arbeit blockiert.

Verdacht auf die Fundstelle: `src/blade.js`, der Block `if (SPIEL_CHAOS_AN)`
in `waehle()`. Die Hysterese ist fuer den Normalbetrieb richtig - dort kostet
Chaos ueber 50 den Faktor `sqrt(1+chaos-50)` auf die Schwierigkeit
(`getChaosSuccessFactor`), bei 58,3 also 3,05. Im Wiederaufbau ist der
Kampfwert aber der viel groessere Hebel, und Diplomacy blockiert das Mittel,
das ihn hebt.

Zu tun: (1) Entscheiden, ob die Chaos-Phase im Wiederaufbau ausgesetzt wird -
gerechnet, nicht geschaetzt: Chaos-Faktor 3,05 gegen den Erfahrungsgewinn von
14 Minuten Gym. (2) Falls ja, die Weichen-Regel VOR die Chaos-Pruefung
ziehen, nicht nur die Bedingung erweitern.


### Nachmessen: traegt der Assassination-Aufbau? (23:42)

Gemessen: Seit 23:39 laeuft `Operations/Assassination` mit dem Grund
"Stufenaufbau 1/12". Der Aufbau dauert rund **3,5 Stunden** (96 Erfolge),
waehrend die Rangrate unter dem Raid-Zyklus liegt.

Erwartet: Ab Stufe 11 schlaegt Assassination den Raid-Zyklus (56,9 gegen
53,4 Rang/min), ab Stufe 12 sind es 61,2. Zu pruefen ist beides:

  1. **Die Stufe steigt wirklich.** `getActionMaxLevel` waechst nur bei
     Erfolgen (`Bladeburner.ts:944`). Bleibt sie stehen, greift die Regel
     nicht - dann faehrt der Motor 3,5 Stunden die schlechteste Aktion.
     Abbruch, wenn die Stufe nach einer Stunde unter 6 liegt.
  2. **Die Rangrate nach dem Aufbau**, geglaettet ueber 45 Minuten. Liegt
     sie unter 53,4, wird `ASSASSIN_AUFBAU` auf `false` gesetzt und der
     Eintrag als widerlegt vermerkt.

**Zwischenstand 00:07 - Pruefpunkt 1 ist bestanden.** `data/blade.json`
meldet `"grund":"Stufenaufbau 5/12"` und `"stufe":5` nach 28 Minuten - das
Kriterium war Stufe 6 nach einer Stunde. Die Dauer steht bei **116 s** gegen
121 s aus der Rechnung (96 x 1,06^4); die Abweichung nach unten kommt von den
gestiegenen Kampfwerten, die in `statFac` eingehen (`Action.ts:112-117`).

Die Rangrate liegt bei **30,4/min** seit 23:39 - wie erwartet unter den 53,4
des Raid-Zyklus, das ist der Preis des Aufbaus. Pruefpunkt 2 (Rate nach dem
Aufbau) steht noch aus; Stufe 12 ist gegen 02:30 zu erwarten.

Verdacht auf eine Schwachstelle: Die Chance faellt mit der Stufe
(`difficultyFac` 1,06, bei Stufe 12 das 2,01fache). Bei Stufe 1 stand sie
auf 1,000 - wo sie unter `SICHER_OPERATION` = 0,85 faellt, hoert der Aufbau
von selbst auf, und dann ist die erreichte Stufe die Antwort auf die Frage,
wie weit es ueberhaupt geht.


### Der Ausgang aus BitNode 6: 319.430 Rang netto (17:51, korrigiert 18:13, ETA neu gerechnet 23:12)

**Nachtrag 23:12 - die ETA ist zweiphasig, und das stand hier nicht.** Die
alte Spanne von 80 bis 180 Stunden ruht auf einem Exponenten `a` zwischen
0,3 und 0,6, also auf der Annahme, der Rang beschleunige sich selbst. Diese
Annahme ist heute **groesstenteils ausgereizt**: Die Selbstbeschleunigung
lief ueber die Erfolgschance, und Raid steht bei **1,0 bis 1,0** (gemessen
21:40). Weitere Faehigkeitspunkte aendern dort nichts mehr.

Ein aus der eigenen Messreihe geschaetztes `a` waere zudem wertlos: Die
Regression ueber 25 Stundenfenster ergibt 1,29, aber ein grosser Teil des
Anstiegs kommt von den Strategieaenderungen dieses Abends (Stealth
Retirement 20:42, Black-Op-Schwelle 21:55), nicht vom Rang. **Wer die eigene
Optimierarbeit als Naturgesetz misst, rechnet sich reich.**

Die belastbare Rechnung ist stattdessen eine Phasenrechnung:

    Phase 1, Raid-Zyklus     53,4 Rang/min gemessen ueber 63 min
                             361 Gemeinden Vorrat, 1 je Zyklus a 190 s
                             = 19,1 Stunden, 60.648 Rang
                             Ende bei Rang rund 77.400

    Phase 2, ohne Raid       Stealth Retirement 25,4 Rang/min
                             Restweg 322.632, davon 73.375 aus den
                             verbleibenden Black Ops
                             = 249.257 / 25,4 = 163 Stunden

    Gesamt                   rund 182 Stunden

**Das ist am oberen Rand der alten Spanne, nicht in ihrer Mitte.** Und der
Grund steht ganz woanders als vermutet: nicht in der Chance, sondern im
**endlichen Raid-Vorrat**. `Incite Violence` hilft nicht - es erhoeht nur
`count` der Vertraege und Operationen (`Bladeburner.ts:1219-1225`), nicht
`comms`.

Wie Phase 2 tatsaechlich aussehen sollte, steht im Punkt darueber
(Assassination).


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
