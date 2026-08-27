# Hebel — das Optimierungsprotokoll

**Diese Datei ist die Verlustfunktion des Optimierungs-Loops.** Ohne sie wäre er
ein Bastler: Er würde alle drei Stunden etwas ändern, und niemand wüsste
hinterher, welche Änderung getragen hat und welche geschadet.

Jeder Eintrag braucht drei Zahlen — vorher, nachher, und wie lange dazwischen
gemessen wurde. Ein Eintrag ohne Nachher-Messung ist kein Ergebnis, sondern eine
offene Wette.

## Regeln

- **Eine Änderung je Lauf.** Zwei gleichzeitig sind nicht mehr auseinanderzuhalten.
- **Vorher messen, ändern, nachher messen.** Mindestens 20 Minuten Abstand,
  sonst misst man Rauschen.
- **Wird die Zahl schlechter, wird zurückgenommen** — `git revert`, und der
  Eintrag bleibt trotzdem stehen. Eine widerlegte Hypothese ist wertvoll: Sie
  verhindert, dass jemand dieselbe in zwei Wochen noch einmal probiert.
- **Kein Hebel ohne Zahl.** „Fühlt sich besser an" ist kein Ergebnis.

## Was ein guter Hebel ist

Der Engpass, nicht das Naheliegende. In BitNode 6 hängt alles am
Bladeburner-Rang; eine Verbesserung der Hackrate ist dort messbar richtig und
strategisch wertlos. Die Frage lautet immer: **Welche Zahl bringt den Knoten
näher an seinen Ausgang, und was begrenzt sie gerade?**

Quellen, in dieser Reihenfolge:
1. `data/*.json` über die Brücke — was der Bot tatsächlich tut
2. `doku/formeln-*.md` — was daran schon verstanden ist
3. `reference/bitburner-src/` — der Spielquellcode selbst, wenn die Doku
   schweigt oder veraltet ist

---

## Protokoll

*Neueste zuoberst.*

### Feste Deckel raus, wo die Sortierung greift (27.08., 20:33)

Engpass: Zum **fuenften Mal an einem Tag** lag die beste Faehigkeit gedeckelt
daneben. Gemessen um 20:33 mit `src/skillcheck.js`:

    Faehigkeit         Stufe  Preis  Nutzen   Wert je Punkt
    Hyperdrive             7     19   0,738   0,0388  <- gedeckelt
    Digital Observer      15     34   1,100   0,0324     wurde gekauft
    Evasive System        17     38   1,035   0,0272  <- gedeckelt
    Reaper                16     36   0,944   0,0262  <- gedeckelt
    Blade's Intuition     30     66   1,579   0,0239     wurde gekauft
    Short-Circuit         30     65   1,142   0,0176  <- gedeckelt

Hypothese: Ohne die Deckel kauft der Motor sofort Hyperdrive statt Digital
Observer, und die Faehigkeitspunkte fliessen dauerhaft dorthin, wo der
Grenznutzen am hoechsten ist - statt dorthin, wo zufaellig kein Deckel steht.

Beleg: Die Sortierung in `faehigkeitenKaufen()` rechnet den Grenznutzen bei
der AKTUELLEN Stufe. Ein Deckel bildet dasselbe grob nach und ist damit
ueberfluessig - aber er ueberstimmt die Sortierung, weil ein Eintrag am
Deckel auf `-1` faellt. Zwei Mechanismen fuer dieselbe Frage, und der
groebere gewinnt.

**Das Muster war der Fehler, nicht die einzelne Zahl.** 12:52 Hyperdrive,
13:19 Short-Circuit, 15:53 Reaper und Evasive System, 18:55 Digital Observer -
jedes Mal wurde ein Deckel einzeln hochgesetzt, und beim naechsten Lauf stand
das naechste Deckel-Problem an.

Vorher: Hyperdrive **Stufe 7** (Deckel 7) seit 12:52, Cloak 3, Rang 10.398
Nachher: **Hyperdrive 8, Cloak 15** binnen 13 Minuten (20:20) - beide vorher
blockiert. Rang 10.505.

Bleibende Deckel, jeder mit Grund: Cyber's Edge 5 (Arbeitsanteil ist bei 1,00
angekommen), Tracer 14 (Vertragschancen klemmen bei 0,92-1,00), Overclock 90
(Maximum des Spiels).

Abbruchkriterium: Faellt die Rangrate ueber 45 Minuten unter 15/min oder
sammelt sich ein Faehigkeitspunktestau (`punkte` ueber 100), war die
Sortierung ohne Deckel doch nicht ausreichend.
Commit: siehe git log, blade.js 27.08. 20:33

### Raid wieder an und ein Trupp von sechs (27.08., 19:54)

Engpass: Die Rangrate. Sie stand ueber 45 Minuten bei 18 bis 32 je Minute,
waehrend `data/bbspann.json` fuer Raid **80,01** meldet - bei Chance 0,919,
794 offenen Laeufen und Arbeitsanteil 1,00 (2,2 Ausdauer je Minute gegen
3,07 Regeneration, also ohne Kammerpausen).

Hypothese: Die geglaettete Rangrate steigt von 32,75 auf **mindestens 60**
je Minute. Dazu +9,4 Prozent competence aus dem Trupp
(`(teamCount+1)^0,05`, `Actions/Operation.ts:96-98`).

Beleg: `data/Operations.ts:113-132` (Raid: baseDifficulty 800, rewardFac 1,1,
rankGain 55, aktuell Stufe 7 also 97,4 effektiv) und
`data/GeneralActions.ts:24-31` (Recruitment: Dauer
`max(10, 300-(cha^0,81+cha/90))` = 206 s, Chance `cha^0,45/(team+1)` = 1,00
bis elf Mitglieder bei Charisma 264).

**Die alte Ablehnung war doppelt falsch.** Sie stand seit 26.08., 17:20 auf
`RAID_AN = false` mit der Begruendung "bei Charisma 27 ... Gleichstand erst
bei Charisma 440". Erstens ist Charisma **264**, nicht 27. Zweitens sagt
`data/Operations.ts:120` woertlich "Unaffected by Charisma" - es wirkt auf
Raid gar nicht, sondern nur ueber die Truppkosten, und die sind bei 264
vernachlaessigbar.

Vorher: Rangrate **32,75/min** (45-min-Fenster 18:26-19:11), Trupp **0**,
Rang 9.083 um 19:10, popEst Sector-12 **1,109e9**, Chaos **48,9**

Nachher (teilweise widerlegt, 20:15 - noch bevor der erste Raid lief):

**Die 80 Rang je Minute stimmen, die Reichweite nicht.** `Raid` senkt bei
jedem Erfolg `city.comms` um eins (`Bladeburner.ts:830-844`), und
`Operation.getSuccessChance` gibt **0** zurueck, sobald `comms <= 0`
(`Actions/Operation.ts:63-68`). Raid ist also nicht dauerhaft fahrbar,
sondern **endlich** - und Sector-12 hat nur **15 comms**.

    15 Raids x 97 Rang (55 x rewardFac 1,1^6) = 1.455 Rang
    Restweg 317.000  ->  Raid deckt davon 0,46 Prozent

Dazu die zweite Grenze: Raid hebt das Chaos um **1 bis 5 Prozent je Lauf**
(`Bladeburner.ts:843`, `changeChaosByPercentage`). Sector-12 steht bei 48,9
gegen `RAID_CHAOS_MAX = 50` - nach **einem** Raid ist die Schwelle gerissen,
und der Motor schaltet Raid selbst wieder ab.

**Was ich falsch gemacht habe:** Ich habe `ertragJeMinute` aus
`data/bbspann.json` genommen und daraus einen Hebel gemacht, ohne den Vorrat
zu pruefen. Die Zahl 794 in `offen` ist der Vorrat der OPERATION, nicht die
Zahl der Gemeinden - die steht nur im Spielstand unter `cities`. Eine
Ertragsrate ohne ihre Reichweite ist keine Entscheidungsgrundlage.

**Der Schalter bleibt trotzdem an.** 1.455 Rang sind kein Hebel, aber sie
sind auch nicht falsch: Raid ist waehrend seiner fuenfzehn Laeufe die beste
verfuegbare Aktion, und der Motor waehlt ohnehin nach Ertrag je Minute. Was
faellt, ist die Erwartung - nicht die Entscheidung.

**Der Trupp bleibt richtig und unberuehrt.** `(teamCount+1)^0,05` wirkt auf
Operationen UND Black Ops, unabhaengig von comms. +9,4 Prozent fuer
siebzehn Minuten steht.

Zu messen bleibt: Rangrate ueber 45 Minuten, `popEst` und Chaos - wie unten
beschrieben. Nach fuenfzehn Raids ist der Effekt vorbei.
**Drei Zahlen gehoeren zusammen geprueft, nicht nur die erste:**
  1. Rangrate ueber 45 Minuten - traegt der Hebel? Ziel > 60/min.
  2. `popEst` in Sector-12 - Raid senkt die Bevoelkerung prozentual, und die
     steckt in `getPopulationSuccessFactor = (pop/1e9)^0,7`. **Faellt sie
     unter 1e9, dreht der Hebel ins Minus**, weil der Faktor dann unter 1
     rutscht und JEDE Aktion ausser Black Ops schwaecher macht.
  3. Chaos - Raid hebt es prozentual. Ueber 50 greift die Diplomacy-Regel und
     frisst Arbeitszeit; ueber `RAID_CHAOS_MAX` schaltet sich Raid selbst ab.

Abbruchkriterium: Faellt popEst unter 1,0e9 oder steigt das Chaos ueber 55,
gehoert `RAID_AN` zurueck auf `false` - dann kostet der Hebel mehr, als er
bringt. Bleibt die Rangrate unter 45/min, war die bbspann-Zahl irrefuehrend.
Commit: siehe git log, blade.js 27.08. 19:54

### Reaper und Evasive System dynamisch, Deckel 16 und 17 (27.08., 15:53)

Engpass: **Zum dritten und vierten Mal an einem Tag dasselbe Muster** - eine
gedeckelte Faehigkeit mit besserem Nutzen je Punkt, waehrend Blade's Intuition
mit dem schlechtesten Wert alle Punkte bekommt.

Hypothese: Die competence steigt je Punkt um **0,059 (Reaper) und 0,047
(Evasive System)** statt um 0,031 - Faktor 1,9 beziehungsweise 1,5.

Beleg: `data/Skills.ts:54-72`. Beide heben nicht die Chance, sondern den
**effektiven Kampfwert**: Reaper 2 Prozent auf alle vier, Evasive System 4 auf
dex und agi. Der wirkt ueber
`competence += weights[stat] * effSkill^decays[stat]`
(`Actions/Action.ts:173`), bei Black Ops mit Gewicht 0,2 und Decay 0,8 je
Kampfwert - also gedaempft und abhaengig vom aktuellen Stand. Gerechnet auf
str 172, def 143, dex 325, agi 168:

    Short-Circuit     St.20   41,9 Punkte   0,0642 je Punkt
    Reaper            St. 9   18,8          0,0593
    Evasive System    St.13   27,2          0,0467
    Blade's Intuition St.26   55,5          0,0309   <- bekam alles

**Nebenbefund, der eine naheliegende Idee erledigt:** Die Kampfwerte stehen
sehr ungleich (dex 325 gegen def 143). Weil der Decay 0,8 fast linear ist,
braechte eine Gleichverteilung bei gleicher Summe nur **+0,8 Prozent** - es
lohnt nicht, gezielt den Tiefstand hochzuziehen, sobald er ueber der
Beitrittsschwelle liegt.

Vorher: Reaper **Stufe 8** (Deckel 8), Evasive System **Stufe 12** (Deckel 12),
Typhoon-Chance min **0,133** um 15:51
Nachher (gemessen 16:19 mit `node tools/spann.js`, 26 Minuten spaeter):
**Reaper Stufe 8 auf 9** - die Sortierung greift, der alte Deckel haette hier
gestoppt. **Evasive System steht unveraendert auf 12**, und das ist kein
Fehlschlag, sondern der Preis: 27 Punkte bei 16 verfuegbaren. Es ist die
teuerste der vier dynamischen Faehigkeiten und liegt im Nutzen je Punkt hinten
(0,0467 gegen 0,0593), also kommt es zuletzt dran - so soll die Sortierung
arbeiten. **Typhoon-Chance 0,133 auf 0,212**, und die Schaetzspanne ist dabei
ganz zugegangen (min = max). Der Deckel wird erst dann wieder zum Thema, wenn
Reaper die 16 erreicht.

**Offen bleibt der Vergleichsmassstab.** Short-Circuit stieg im selben Fenster
von 19 auf 21, Blade’s Intuition blieb auf 25 - die Punkte gehen also
ueberwiegend an Short-Circuit, nicht an Reaper. Ob die +0,079 Chance aus der
Umlenkung kommen oder schlicht aus den gestiegenen Kampfwerten, trennt diese
Messung nicht. Dafuer braeuchte es einen Lauf mit eingefrorenen Stufen.
Commit: siehe git log, blade.js 27.08. 15:53

### Short-Circuit-Deckel von 12 auf 30 (27.08., 13:19)

Engpass: Dieselbe Luecke wie bei Hyperdrive - die Faehigkeitspunkte gingen an
Blade's Intuition, waehrend eine billigere Faehigkeit gedeckelt danebenlag.

Hypothese: Die Erfolgschance aller Kill-Aktionen steigt von Multiplikator
**1,66 auf 2,65**, also um **59 Prozent**. Dieselben Punkte reichen bei
Blade's Intuition nur fuer +36 Prozent.

Beleg: `data/Skills.ts:21-28` - Short-Circuit, baseCost 2, costInc 2,1,
`SuccessChanceKill: 5,5`. Und `data/BlackOperations.ts:35`: **Typhoon ist
`isKill: true`** - genau wie Bounty Hunter und Retirement, die zwei Vertraege,
die der Motor faehrt. Die Faehigkeit trifft also alles, was zaehlt.

    Blade's Intuition St. 26   55,5 Punkte   +1,71 %   0,031 je Punkt
    Short-Circuit     St. 13   27,2 Punkte   +3,31 %   0,122
    Short-Circuit     St. 20   41,9 Punkte   +2,69 %   0,064
    Short-Circuit     St. 30   62,9 Punkte   +2,12 %   0,034   <- Schnittpunkt

Vorher: Short-Circuit **Stufe 12**, Typhoon-Chance min **0,125** um 13:17
Nachher: **BESTAETIGT um 15:51 - Stufe 19**, und die Chance steht bei min
**0,133** (max 0,186), obwohl zwischendurch ein Augmentierungs-Einbau alle
Kampfwerte auf 1 zurueckgesetzt hat. Blade's Intuition blieb dabei
unveraendert auf 25 - die dynamische Sortierung von 13:49 lenkt die Punkte
also nachweislich um.
Commit: ac7565c

**Struktureller Befund, der aus beiden Hebeln folgt:** Ein Faehigkeitsplan mit
**festen Deckeln veraltet zwangslaeufig.** Die Kosten steigen linear mit der
Stufe, der Nutzen je Punkt faellt - also wandert die beste Faehigkeit im Lauf
der Zeit. Zweimal heute lag eine deutlich bessere Option gedeckelt daneben,
waehrend die Infinity-Eintraege alles auffrassen. Der saubere Fix waere, den
Plan durch einen Vergleich des relativen Nutzens je Punkt zu ersetzen. Eingetragen
in `nodes/BAUSTELLEN.md`.

### Hyperdrive in den Faehigkeitsplan, Deckel 7 (27.08., 12:52)

Engpass: Die Kampfwerte tragen den Knotenausgang (`competence = Sum weights *
skill^0,9`), und ihre einzige Quelle ist die Erfahrung. Die Faehigkeitspunkte
gingen bisher vollstaendig an Blade's Intuition - die steht auf **Stufe 25**,
und die naechste kostet **56 Punkte** fuer +3 Prozent.

Hypothese: Die Chance steigt je investiertem Punkt um **1,45 statt 0,054
Prozent**, also Faktor 27 auf der ersten Stufe. Der Grund ist die
Erfahrungskurve: +10 Prozent Erfahrung geben ueber
`lvl = mult * (32*ln(exp+534,6) - 200)` genau **+3,05 Levelpunkte** auf alle
vier Kampfwerte, und zwar unabhaengig vom Niveau.

Beleg: `Bladeburner/data/Skills.ts:98-104` - Hyperdrive, baseCost **1**,
costInc 2,5, `ExpGain: 10`. Gegen Blade's Intuition (`:5-10`, baseCost 3,
costInc 2,1, `SuccessChanceAll: 3`). Nutzen je Punkt:

    Blade's Intuition Stufe 26    56 Punkte   +3,00 %   0,054 % je Punkt
    Hyperdrive Stufe 1             1 Punkt    +1,45 %   1,451
    Hyperdrive Stufe 3             6 Punkte   +1,22 %   0,203
    Hyperdrive Stufe 5            11 Punkte   +1,05 %   0,096
    Hyperdrive Stufe 7            16 Punkte   +0,92 %   0,058   <- Gleichstand
    Hyperdrive Stufe 8            18,5        +0,87 %   0,047   <- schlechter

Deckel 7 ist der Schnittpunkt. Die 59,5 Punkte fuer sieben Stufen bringen
Erfahrungsfaktor **1,7**; dieselben Punkte reichen bei Blade's Intuition fuer
genau EINE Stufe.

Vorher: **84 exp/min** (def, 12:10 gegen 12:40), Hyperdrive Stufe 0
Nachher: **BESTAETIGT um 13:10.** `kampfExp.def` stieg von 38.479 (12:40) auf
41.931 (13:10), also 115 exp/min im Fenster. Der Bonus wirkte aber erst ab
12:54 - rechnet man die ersten 14 Minuten mit der alten Rate heraus, bleiben
fuer die letzten 16 Minuten **142 exp/min, Faktor 1,69**. Erwartet waren 143
bei Stufe 7, die Abbruchschwelle lag bei 110. Um 13:17 stand Hyperdrive auf
**Stufe 7**, dem Deckel.
Commit: siehe git log, blade.js 27.08. 12:52

### Geprueft und verworfen: Gym statt Bladeburner-Arbeit (27.08., 09:56)

Engpass: **Die Kampfwerte, nicht der Rang.** Rang 3476 liegt laengst ueber den
2500 fuer Operation Typhoon; was fehlt, ist die Chance (Mitte 0,104 gegen
Schwelle 0,80), und die haengt an `competence = Sum weights * skill^0,9`.

Hypothese: Powerhouse Gym hat `expMult: 10` (`Locations/data/LocationsMetadata.ts:325`)
und `costMult: 20`. Bei 10,4 Mrd auf der Hand sind die Kosten irrelevant
(480 $/s, also 361.000 Minuten Vorrat). Wenn Gym die Kampfwerte schneller
hebt als Bladeburner-Arbeit, gehoert der Motor umgestellt.

Beleg, beide Seiten gerechnet statt geschaetzt:

- **Gym**: `Classes[GymType.defense].earnings = {defExp: 1}` je Zyklus,
  skaliert mit `expMult / gameCPS` (`Work/Formulas.ts:115-118`) und mit
  `person.mults`. Bei 5 Zyklen je Sekunde sind das **600 * mult exp/min**
  fuer **einen** Wert.
- **Bladeburner**, gemessen 09:04 gegen 09:52 aus `data/bblage.json`:
  str 39.467 -> 45.935, def 18.615 -> 25.083. Beide **+6.468 in 48 Minuten**,
  also **135 exp/min je Wert** - und zwar fuer **alle vier gleichzeitig**,
  in Summe 540.
- Der Multiplikator faellt aus den Daten selbst: `lvl = mult * (32*ln(exp+534,6) - 200)`
  gibt fuer str (196 / 45.935) und def (170 / 25.083) **beide Male 1,362**.
  Gym liefert damit 817 exp/min je Wert.

Der Vergleich ueber die 101 Minuten, die ORION-MKIV Shoulder noch entfernt ist:

    Bladeburner   +13.635 exp je Wert  ->  def 170 -> 188,7   (+18,7)
                  plus ORION-MKIV (str/def/dex x1,05)          (+8,5)
                  ------------------------------------------------
                                                        SUMME  +27,2

    Gym           25 min je Wert, +20.425 exp -> def 195,6     (+25,6)

**Bladeburner gewinnt** - knapp bei den Kampfwerten, und ohne dass Rang fuer
die spaeteren Black Ops und die weiteren Augmentierungen ueberhaupt gezaehlt
sind. Der Grund ist, dass Gym nur EINEN Wert traegt: je Wert ist es Faktor
4,4 besser, in der Summe nur Faktor 1,51 - und das kauft den Verlust von
8,7 Rang und 19 Reputation je Minute nicht auf.

**Die bestehende Auslegung ist also richtig**, und die Ausnahme stimmt auch:
Nach einem Einbau stehen alle Werte auf 1, Bladeburner-Aktionen scheitern,
und dort schlaegt der Faktor 4,4 je Wert voll durch - genau dafuer gibt es
`bbtrain.js`.

Vorher: keine Aenderung
Nachher: (keine Aenderung - dies ist die Absage an den Umbau auf Gym-Betrieb)
Commit: nur dieser Eintrag

### Black-Op-Schwelle von 0,99 auf 0,80 (27.08., 06:56)

Engpass: **Nicht der Rang - die Schwelle, ab der er benutzt wird.** Der Rang
steht um 06:51 bei 2477 und faellt in Minuten unter die 2500 von Operation
Typhoon. Danach entscheidet `SICHER_BLACKOP` in `blade.js`, ob die Black Op
ueberhaupt versucht wird. Sie stand auf **0,99** - nie gerechnet, nur
vorsichtig gesetzt. Bei 21 Black Ops mit steigender Schwierigkeit heisst das
unter Umstaenden: nie.

Hypothese: Sobald die Chance 0,80 erreicht, steigt die Rangrate von **2,0**
(Bounty Hunter, gemessen 22:45) auf **13,2** je Minute.

Beleg: `data/BlackOperations.ts:10-14` (baseDifficulty 2000, rankGain 50,
rankLoss 10, hpLoss 100), `Actions/Action.ts:105-120` (Dauer),
`Actions/BlackOperation.ts:50-52` (`getActionTimePenalty` 1,5),
`Hospital.ts:4-10` (Krankenhauskosten).

    statFac  = 0,5 * (161^0,04 + 209^0,035 + 161/1e4 + 209/1e4) = 1,234
    Dauer    = 2000/10 * 0,86 / 1,234 * 1,5 = 209 s = 3,49 min
    Ertrag/min = (chance*50 - (1-chance)*10) / 3,49

Der **Gleichstand mit Bounty Hunter liegt bei chance 0,283** - alles darueber
ist besser als weiterzufahren wie bisher. Gewaehlt wurde trotzdem 0,80, und
zwar wegen der Trefferpunkte: 100 Verlust gegen eine Hoechstgrenze um 23
heisst Krankenhaus bei JEDEM Fehlschlag, und das kostet `min(Geld * 0,1, ...)`
- bei 3,6 Milliarden also 360 Millionen je Versuch. Bei 0,80 ist jeder fuenfte
Versuch ein Fehlschlag statt jeder dritte.

Vorher: **Chance 0,062-0,075 um 06:10**, Schwelle 0,99 - die Black Op wurde
nie versucht, und bei 0,99 waere sie es womoeglich nie geworden.
Nachher: **UEBERHOLT am 27.08., 12:49 - die Begruendung war falsch.** Der Satz
"das kostet min(Geld * 0,1, ...) - bei 3,6 Milliarden also 360 Millionen" las
nur den ERSTEN Term des Minimums. Der zweite deckelt bei
`(hp.max - hp.current) * 100.000`, und mit `damage = hpLoss * difficultyMult
= 100 * (2000^0,28 + 2000/650) = 1.148` sind das **114,8 Millionen** - drei
Minuten Einkommen. Die Kosten haengen an der Schwierigkeit, nicht am
Kontostand. Schwelle steht seither auf **0,40**.
Commit: siehe git log, blade.js 27.08. 06:56

### Die Stillstandsuhr zaehlte ueber den Einbau hinweg (27.08., 04:00)

Engpass: Nicht der Bot, sondern der Pruefer. Vier Minuten nach dem
Augmentierungs-Einbau von 03:48 meldete er
**"STAGNATION: Kampfwert-Tiefstand steht seit 681 min auf 1"**, waehrend
`bbtrain` str gerade von 51 auf 75 hochtrainierte. Die Wache waere damit
unmittelbar nach dem Einbau in ihren Eingriffsmodus gegangen - im
ungeeignetsten Moment, denn dort arbeitet der Bot planmaessig.

Hypothese: Das Urteil kehrt von STAGNATION auf SPUR zurueck, und die
gemeldete Stillstandsdauer faellt von 681 auf unter 10 Minuten.

Beleg: `tools/strategie-check.js:537-556` verwirft den Verlauf, wenn ein
Traeger **faellt**. Beim Einbau faellt er aber nicht, er **wechselt** - von
"Bladeburner-Rang" auf "Kampfwert-Tiefstand". Dessen alte Punkte stammen aus
der vorigen Wiederaufbauphase (16:31 desselben Tages) und stehen dort
ebenfalls auf 1. Die Uhr zaehlte also von damals durch, quer ueber elf Stunden
Bladeburner-Arbeit hinweg.

Geaendert: Bei Phase "Wiederaufbau nach Einbau" wird der Verlauf am letzten
Phasenwechsel abgeschnitten. Die Punkte davor bleiben in der Datei - dort sind
sie Geschichte, nicht Messwert.

Vorher: **STAGNATION, 681 min** um 03:52
Nachher: **SPUR, 3 min** um 04:02 - unmittelbar verifiziert, dieselbe Lage.
Commit: siehe git log, strategie-check.js 27.08. 04:00

### Der Knotenausgang haengt an den Kampfwerten, nicht am Rang (27.08., 01:05)

Engpass: **Die Erfolgschance von Operation Typhoon steht seit zehn Stunden
still.** Gemessen 15:46 bei Rang 745: `min 0,035, max 0,042`. Gemessen 00:57
bei Rang **1528**: `min 0,035, max 0,038`. Der Rang hat sich verdoppelt, die
Kampfwerte sind von rund 115 auf 224 (dex) gestiegen - die Chance ist
unveraendert.

Beleg: `Actions/Action.ts:169-196`. Fuer Black Ops faellt alles weg, was sonst
hilft: `getPopulationSuccessFactor` gibt 1, `getChaosSuccessFactor` gibt 1
(`Actions/BlackOperation.ts:54-60`), und `getDifficulty` ist die **feste**
`baseDifficulty` 2000 (`data/BlackOperations.ts:10`) - Black Ops sind nicht
levelbar, es gibt keinen `difficultyFac`. Der **Rang geht ueberhaupt nicht in
die Chance ein**; er ist nur die Eintrittskarte (`reqdRank` 2500).

Was bleibt, ist die Kompetenz:

    competence = SUMME weights[stat] * effSkill[stat]^0,9
    chance     = competence / 2000

Mit den Gewichten von Typhoon (hacking 0,1; str/def/dex/agi je 0,2) und den
Werten von 00:57 ergibt das rund 92 roh, mit Blade's Intuition Stufe 10
(x1,30) und dem Intelligenzbonus rund 124 - also **0,062**, in derselben
Groessenordnung wie die gemessenen 0,037.

**Die Konsequenz ist unbequem und gehoert festgehalten:** Fuer eine Chance von
50 Prozent braucht es Faktor 13,5 in der Kompetenz. Weil die Werte mit
Exponent 0,9 eingehen, sind das **Faktor 19,6 in den Kampfwerten** - also dex
von 224 auf rund 4.400. Ueber Faehigkeiten allein ist das nicht zu holen:
Reaper gibt 2 Prozent je Stufe auf die effektiven Werte, Evasive System 4
Prozent auf dex und agi; selbst Stufe 50 in beiden braechte nur rund x3,5.

**Damit steht die Route des Knotens zur Ueberpruefung.** Rang 2500 ist in gut
zehn Stunden erreicht, die Kampfwerte fuer eine fahrbare Chance nicht. Was das
heisst - Gym-Training aus den 18,7 Milliarden, Augmentierungen, oder Typhoon
mit kleiner Chance wiederholt versuchen und die Rangverluste hinnehmen - ist
eine Abwaegung mit Zahlen und steht als eigener Punkt in BAUSTELLEN.md.

Vorher/Nachher: keine Aenderung. Dies ist der Befund, der die naechste
Entscheidung traegt.

### Geprueft und nichts geaendert: Raid, Cyber's Edge, Overclock (26.08., 21:55)

Engpass: Weiterhin die Ausdauer. Der Kammeranteil liegt bei 67 Prozent
(gemessen 21:45, siehe BAUSTELLEN.md), weil das Ruheband nur 3,4 Punkte breit
ist und die Regeneration 2,3 je Minute betraegt.

Vollstaendige Messung um 21:51 ueber `data/bbspann.js`, alle neun Aktionen:

    Aktion                  min   dauer  netto/min  aus/min  arbeit  zyklus
    Raid                  0,124     56s      4,980     2,36   0,901   4,486
    Bounty Hunter         0,480     32s      2,755     3,33   0,639   1,761  <- gefahren
    Tracking              0,953     18s      3,736     4,79   0,444   1,658
    Retirement            0,580     26s      2,829     3,79   0,561   1,588
    Undercover Operation  0,269     35s      1,527     3,16   0,673   1,028
    Investigation         0,328     28s      1,260     3,30   0,645   0,812

**Raid steht mit 4,486 wieder ganz oben - und bleibt trotzdem verworfen.**
Die Zahl ist die ROHE Zyklusrate ohne die Chaos-Gegenkraft. Raid erzeugt
+3,21 Prozent Chaos je Minute, Diplomacy baut bei Charisma 27 nur 1,187 ab
(siehe den Erledigt-Eintrag vom 17:20); der tragbare Raid-Anteil liegt damit
bei 27 Prozent, effektiv also **4,486 x 0,27 = 1,21** gegen 1,761 fuer Bounty
Hunter. Der Verwurf haelt auch mit den neuen Zahlen - **nachgerechnet, nicht
uebernommen.**

**Overclock ist nicht wirkungslos, sondern schaedlich** - der Kommentar in
`blade.js` untertreibt. Es kuerzt die Aktionsdauer um 1 Prozent je Stufe, und
weil der Ausdauerverlust JE AKTION anfaellt (`Bladeburner.ts:921`), steigt
`aus/min` im selben Mass. Bei Stufe 14 sind das rund 16 Prozent mehr
Verbrauch je Minute. Zurueckdrehen geht nicht, aber der letzte Platz im
Faehigkeitsplan ist damit doppelt begruendet.

**Cyber's Edge ueber Deckel 5 hinaus: gerechnet, verworfen.** Stufe 6 kostet
16 Punkte und hebt Hoechstausdauer und Regeneration um je 2 Prozent. Weil das
Band prozentual definiert ist, waechst die Arbeitsphase um 2 Prozent, die
Ruhephase bleibt gleich - Arbeitsanteil 0,3333 auf 0,3377, Zyklusrate 1,761
auf 1,784. Dieselben 16 Punkte in Tracer Stufe 8 geben +4 Prozent auf alle
Vertragschancen, also rund 1,83. **Der laufende Plan ist die bessere
Verwendung**, deshalb keine Aenderung.

Vorher/Nachher: keine Aenderung - dies ist die Absage an drei naheliegende
Griffe, damit sie niemand ein zweites Mal probiert.

### Faehigkeitsplan nach Nutzen je Punkt statt nach Rangliste (26.08., 18:52)

Engpass: **Die Erfolgschance, nicht der Vorrat.** Bounty Hunter lief mit 0,322
und dem Grund "Vertrag unter Schwelle, lohnt trotzdem"; gleichzeitig lagen 21
Faehigkeitspunkte eine Stunde lang ungenutzt herum (`data/blade.json`, Feld
`punkte`: 1 um 17:37, 11 um 18:07, 21 um 18:37).

Hypothese: Die Erfolgschance von Bounty Hunter steigt von **0,322** auf
mindestens **0,34**, wenn statt Blade's Intuition die billigen Stufe-0-
Faehigkeiten gekauft werden.

Beleg: Die Kosten sind **linear**, nicht exponentiell -
`(baseCost + level * costInc) * mult` (`Bladeburner/Skill.ts:37-41`). Damit
liefert Tracer auf Stufe 0 fuer 2 Punkte +4 Prozent auf alle Vertraege
(`data/Skills.ts`), Blade's Intuition auf Stufe 10 fuer 24 Punkte +3 Prozent
auf alles - **Faktor 16**. Der Gleichstand liegt bei
`m = (6 + 8,4n)/6,3`, fuer n=10 also Tracer-Stufe 14; daher die Deckel
Tracer 14, Short-Circuit 12, Evasive System 12, Reaper 8 vor Blade's
Intuition.

Vorher: Bounty-Hunter-Chance **0,322**, offene Punkte **21** um 18:37
Nachher: **BESTAETIGT um 19:37, deutlicher als erwartet.** Bei Tracer Stufe 4:

    Aktion           Chance 18:50 -> 19:37    Zyklusrate 18:50 -> 19:37
    Bounty Hunter    0,348 -> 0,394           0,971 -> 1,258   (+30%)
    Tracking         0,660 -> 0,771           0,904 -> 1,168   (+29%)
    Retirement       0,415 -> 0,487           0,893 -> 1,120   (+25%)

Erwartet war "ueber 1,10 bei Tracer Stufe 5" - erreicht sind 1,258 schon bei
Stufe 4, fuer insgesamt 20 Punkte. Blade's Intuition haette fuer dieselben 20
Punkte nicht einmal eine Stufe gebracht.

Der Gewinn ist breiter als gedacht, weil Tracer auf **alle** Vertraege wirkt
und der Motor ohnehin nur Vertraege faehrt. Die restlichen Deckel (Tracer bis
14, dann Short-Circuit 12, Evasive System 12, Reaper 8) stehen noch aus.
Commit: siehe git log, blade.js 26.08. 18:52

### Geprueft und verworfen: Team, Ausdauerschwelle, Punkterate (26.08., 15:57)

Kein Hebel in diesem Lauf. Drei Kandidaten am Quellcode geprueft, alle drei
tragen heute nicht - das steht hier, damit sie niemand ein zweites Mal aufruft.

**Bladeburner-Team.** `operationTeamSuccessBonus` ist
`(teamCount + 1)^0,05` (`Actions/Operation.ts:96-98`). Zwanzig Mann bringen
`21^0,05 = 1,164`, hundert Mann 1,259 - und der Bonus haengt **nur an
Operationen und Black Ops** (`Actions/Action.ts:124-126` gibt fuer alles andere
1 zurueck). Der Motor faehrt ausschliesslich Vertraege, also ist die Wirkung
derzeit **exakt null**. Rekrutierung kostet zwar keine Ausdauer, aber die
Erfolgschance ist `charisma^0,45 / (teamSize + 1)`
(`data/GeneralActions.ts:29-31`), und Charisma wurde in diesem Lauf nie
trainiert.
**Vermerk fuer spaeter:** Sobald Operationen oder Black Ops gefahren werden,
ist das Team Pflicht - dann sind es +16 Prozent auf die Erfolgschance, und
bei Raid schlaegt das wegen des Rangverlust-Terms als +25 Prozent auf den
Erwartungswert durch. `setTeamSize` wird von `blade.js` bisher nie aufgerufen,
`teamCount` steht also auf 0.

**Ausdauerschwelle senken.** Nachgerechnet mit den heutigen Zahlen
(V = 5,2 je Minute bei Tracking, R = 2,31, Maximum 79):

    Schwelle 51/56   Spanne 3,95   Arbeit 1,37 min   Ruhe 1,71   Anteil 44,5 %
    Schwelle 30/56   Spanne 20,5   Arbeit 7,10 min   Ruhe 8,90   Anteil 44,4 %

Der Anteil ist identisch - die Spanne ist symmetrisch, sie begrenzt Arbeit und
Ruhe gleichermassen. Unterhalb von 50 Prozent kaeme die Ausdauerstrafe dazu
(`min(1, stamina/(0,5*max))`, `Bladeburner.ts:167-169`), die den Ertrag der
laengeren Arbeitsphase auffrisst. **Damit ist die Verwerfung vom 08:14 zum
zweiten Mal bestaetigt, diesmal mit gemessenen statt geschaetzten Werten.**

**Punkterate getrennt heben.** Geht nicht: Faehigkeitspunkte fallen streng
linear aus dem Rang an - `RanksPerSkillPoint: 3` (`data/Constants.ts:47`),
ausgewertet in `Bladeburner.ts:1282-1289` gegen `maxRank`. Ein Punkt je drei
Rang, ohne Zwischengroesse, an der sich drehen liesse. Die Rueckkopplung ist
damit sauber: mehr Rang, mehr Punkte, bessere Faehigkeiten, mehr Rang - und
der einzige Angriffspunkt bleibt die Rangrate selbst.


### Diplomacy gegen Chaos ueber 50 (26.08., 15:26)

Engpass: Die Erfolgschancen. Sector-12 stand um 14:49 bei Chaos 53,89, und
`Actions/Action.ts:94-101` multipliziert oberhalb von 50 die SCHWIERIGKEIT mit
`sqrt(1 + (chaos - 50))`.

Hypothese: Faellt das Chaos unter 50, steigt die Tracking-Chance von 0,357 auf
mindestens 0,75, weil der Faktor `sqrt(4,89) = 2,21` auf exakt 1 zurueckfaellt.

Beleg: `Actions/Action.ts:94-101` (Schwellwert und Wurzelformel),
`Bladeburner.ts:735-743` und `:1185-1187` (Diplomacy senkt prozentual um
`charisma^0,045 + charisma/1000`), `data/GeneralActions.ts:37-44` (60 Sekunden,
keine Ausdauer).

Vorher: Tracking-Chance 0,357 um 14:49, Rangrate 0,625 je Minute.
Nachher: **Tracking-Chance 0,801 um 15:26** - Faktor 2,24 gegen den
vorhergesagten 2,21. Rangrate **1,361 je Minute** ueber die zwanzig Minuten bis
15:47, Kammeranteil 40 Prozent. Zehn Minuten Diplomacy waren dafuer noetig.

Commit: "blade: Diplomacy gegen Chaos ueber 50"

**Das war der groesste Einzelhebel des Tages** - und er lag seit gestern als
verworfener Nebensatz in einem Offen-Punkt, mit der Begruendung "Chaos unter
50 ist nutzlos". Die Begruendung stimmte, als sie geschrieben wurde. Die
Lehre: **Eine Verwerfung mit Bedingung muss die Bedingung mitpruefen.**


### Cyber's Edge vor Overclock im SKILL_PLAN (26.08., 12:22)

Engpass: Die Regeneration. Der Motor stand 62,9 Prozent der Zeit in der
Kammer und wartete auf Ausdauer.

Hypothese: Cyber's Edge hebt R um 2 Prozent je Stufe, weil
`getSkillMult(Stamina)` in BEIDEN Formeln steckt - `calculateMaxStamina`
(`Bladeburner.ts:1327-1343`) und `calculateStaminaGainPerSecond`
(`:1317-1325`). Die Ruhezeit `S/R` bleibt gleich, die Arbeitszeit `S/(V-R)`
waechst ueberproportional, weil V fest ist.

Mitgeprueft und dabei verworfen: **Overclock ist im Ausdauer-Engpass
wirkungslos.** Der Ausdauerverlust faellt je AKTION an (`Bladeburner.ts:921`),
eine um ein Prozent kuerzere Aktion heisst also auch ein Prozent mehr
Verbrauch je Minute. Nachgerechnet 0,4444 gegen 0,4445 - und es hatte bis
dahin 14 Stufen bekommen, rund 169 Punkte.

Vorher: R = 2,068 Ausdauer je Minute (53 Kammerphasen, 108 min),
Hoechstausdauer 70, Rangrate 0,649 je Minute, Kammeranteil 62,9 Prozent.
Nachher: **R = 2,313** (11 Phasen, 23 min) bei Cyber's Edge Stufe 5,
Hoechstausdauer 79. Das sind 11,8 Prozent - fuenf Stufen zu je zwei Prozent
plus das Agility-Wachstum.

Commit: "blade: Cyber's Edge vor Overclock, Deckel 5"

Die Rangrate stieg im selben Zeitraum von 0,649 auf 0,842. Der Anteil, der
auf Cyber's Edge entfaellt, ist damit **nicht sauber getrennt** - der
Krankenhaus-Hebel und die schwankenden Erfolgschancen liefen mit. Belastbar
ist nur die Regeneration selbst, und die ist die Groesse, auf die der Hebel
zielt.


### bbspann.js rechnete einen irrefuehrenden Ertrag (26.08., 13:05)

Engpass: Nicht der Bot, sondern das Messwerkzeug. Der falsche Ertrag hat um
12:55 einen Auftrag mit hoher Dringlichkeit erzeugt ("Operationen bringen das
Siebenfache"), der so nicht stimmt.

Zwei Fehler, die sich gegenseitig verstaerkten:
- **Levelfaktor fehlte.** `Bladeburner.ts:917` multipliziert den Ertrag mit
  `rewardFac^(level-1)`. Tracking steht auf Stufe 29 (1,041^28 = 3,07), alle
  Operationen auf Stufe 1. Verglichen wurde eine ausgereizte Aktion mit einer
  frischen.
- **Rangverlust fehlte.** Nur Operationen haben `rankLoss` (Operations.ts:20,
  54, 90, 125, 165, 203). Bei Chancen unter 0,2 dominiert dieser Term.

Beleg: `Bladeburner.ts:917` (Levelfaktor), `:975-978` (`changeRank` mit
negativem Vorzeichen bei Misserfolg), `data/Operations.ts` (rankLoss, hpLoss).

Gemessen 13:05 mit der korrigierten Rechnung - `netto` gegen `brutto`, wie es
vorher dastand:

    Aktion                 Stufe  Chance   netto/min   brutto/min
    Tracking                  29   0,700       2,425        0,787
    Retirement                16   0,434       1,828        0,711
    Bounty Hunter             12   0,363       1,783        0,727
    Raid                       1   0,103       3,669        6,071
    Undercover Operation       1   0,225       1,166        1,697
    Investigation              1   0,271       0,965        1,277
    Sting Operation            1   0,142       0,461        1,021
    Stealth Retirement         1   0,087       0,077        1,642
    Assassination              1   0,055      -0,772        1,408

**Drei Ergebnisse:**
1. **Assassination hat einen negativen Erwartungswert**, Stealth Retirement
   einen von praktisch null. Die alte Zahl wies beiden 1,4 bis 1,6 zu.
2. **Raid ist besser, aber um Faktor 1,5 statt 7.** Der Auftrag von 12:55
   bleibt bestehen, mit korrigierter Zahl.
3. **Der Levelfaktor ist der Grund, warum Vertraege mithalten.** Tracking
   bringt roh 0,3 Rang, effektiv 0,92. Das ist kein Argument gegen
   Operationen, sondern eines dafuer, eine davon HOCHZUSPIELEN - jede
   Operationsstufe zahlt 7 bis 14 Prozent, gegen 4,1 bei Tracking.

Vorher: kein Vergleichswert - die Zahl war vorher schlicht falsch.
Nachher: Die Datei fuehrt jetzt `gewinnEff`, `rangVerlust`, `hpJeMisserfolg`,
`ertragJeMinute` (netto) und `bruttoJeMinute` (die alte Zahl, zum Vergleich).
Commit: siehe unten.

**Keine Aenderung am Bot in diesem Lauf.** Der Hebel ist gerechnet und liegt
bei Raid, aber er haengt an einer ungeklaerten Frage: Raid nimmt 50
Trefferpunkte je Misserfolg (`data/Operations.ts:126`) bei einem Maximum von
25, also **Krankenhaus bei jedem einzelnen Fehlschlag** - und ob eine
Hospitalisierung die laufende Bladeburner-Aktion abbricht, ist nicht geprueft.
Das gehoert vor jede Aenderung an `SICHER_OPERATION`.


### Die Kammerzeit ist strukturell - gerechnet, keine Aenderung (26.08., 11:45)

**Ziel dieses Laufs war die Frage, ob gegen die 55 Prozent Kammerzeit
ueberhaupt ein Hebel existiert.** Antwort: kaum. Zum ersten Mal mit echten
Zahlen statt Schaetzungen, gemessen ueber 161 Abschnitte seit 09:15:

    Regenerationskammer     +2,04 Ausdauer je Minute
    Contracts/Tracking      -4,09 je Minute netto   (2,18 Rang/min)
    Contracts/Retirement    -2,50                   (1,71)
    Contracts/Bounty Hunter -2,17                   (1,60)

Daraus folgt der Kammeranteil zwingend, denn Arbeit und Ruhe teilen sich
dieselbe Spanne:

    Anteil = (1/R) / (1/V + 1/R)

    mit Tracking        66,7 %   ->  Zyklusrate 2,18 * 0,333 = 0,726 Rang/min
    mit Bounty Hunter   51,5 %   ->              1,60 * 0,485 = 0,776

Gemessen wurden 55 Prozent - die Mischung passt.

**Zwei Ergebnisse:**

1. **Bounty Hunter ist tatsaechlich besser, aber nur um sieben Prozent** -
   nicht um die 44, die die Rechnung von 09:46 ergab. Der Unterschied
   verschwindet im Rauschen, und genau deshalb war in der Messung von
   09:57-10:14 nichts davon zu sehen. Die Umstellung bleibt zurueckgedreht;
   sieben Prozent rechtfertigen die zusaetzliche Verwicklung nicht.

2. **Die Kammerzeit laesst sich mit der Aktionsauswahl allein nicht unter
   etwa 50 Prozent druecken.** Selbst die sparsamste Aktion verbraucht mehr
   als das Doppelte dessen, was die Kammer nachliefert. Eine Aktion mit
   Verbrauch nahe 2,04 gaebe zwar wenig Kammerzeit, braechte aber auch
   entsprechend wenig Rang.

**Was den Knoten wirklich beschleunigen wuerde, haengt an
Faehigkeitspunkten** - hoehere Regeneration (Cyber's Edge), hoehere
Erfolgschancen (Blade's Intuition, Tracer), kuerzere Aktionen (Overclock).
Alle drei Multiplikatoren kosten Punkte, und die kommen aus Rangaufstiegen.
Gemessen 10:45: **null Punkte.** Der eigentliche Engpass ist damit nicht die
Kammerzeit, sondern dass nichts da ist, um die Multiplikatoren zu heben.

Vorher: 0,707 Rang je Minute, 55,9 Prozent Kammerzeit (10:49-11:15)
Nachher: (keine Aenderung - dies ist die Absage an weitere Versuche in diese
Richtung)
Commit: siehe git log, HEBEL.md 26.08. 11:45

### Incite Violence, wenn der beste Vertrag leergespielt ist (26.08., 10:49)

Engpass: **Der Vorrat, nicht die Auswahl.** Gemessen 10:45: Tracking hat noch
1,0 offene Auftraege (von ueber 200), seine Chance ist von 0,74 auf 0,525
gefallen. Bounty Hunter und Retirement liegen bei 0,273 und 0,324 - beide
unter der Sicherheitsschwelle von 0,45. Die Rangrate ist deshalb von 0,926 auf
0,60 je Minute eingebrochen.

Hypothese: `Incite Violence` fuellt ALLE Vertraege und Operationen auf einen
Schlag - es rechnet 180 Wachstumsschritte gut (`Bladeburner.ts:1219-1225`,
`60 * 3 * growthFunction()`). Es dauert 60 Sekunden und kostet **keine
Ausdauer** (`data/GeneralActions.ts:52-58`), was gerade dann zaehlt, wenn die
Ausdauer der Engpass ist. Erwartung: Die Rate kehrt auf **ueber 0,9** zurueck.

Die Rechnung: Eine Minute Incite kostet den Ertrag des Notvertrags (Bounty
Hunter, 0,567 Rang je Minute). Danach ist Tracking mit 2,2 wieder da - der
Verlust ist nach gut dreissig Sekunden eingespielt.

**Chaos geprueft, bevor es zum Problem wird:** Incite hebt das Chaos jeder
Stadt um 10 plus `chaos/log10(chaos)`. Erst ueber **50** macht Chaos die
Aktionen schwerer (`ChaosThreshold`, `Actions/Action.ts:94-101`); Sector-12
steht bei 13. Ein Durchlauf bringt es auf etwa 35, ein zweiter darueber -
deshalb greift der Block nur unter Chaos 25.

Damit ist auch der zweite Teil des alten Baustellenpunkts entschieden:
**Diplomacy braucht es vorerst nicht.** Es senkt Chaos, und Chaos schadet
unterhalb von 50 gar nicht.

Vorher: 0,602 Rang je Minute, Tracking-Vorrat 1,0 (10:16-10:44)
Nachher: **Nie ausgeloest - und heute waere er schaedlich (26.08., 18:55).**
Gemessen: Tracking-Vorrat **1,52** (von ueber 200), Chaos in Sector-12
**48,78**. Der Block greift nur unter Chaos 25, ist also gesperrt - genau in
der Lage, fuer die er gebaut wurde.

**Die Sperre ist richtig, aber der Hebel taugt heute ohnehin nichts.** Incite
wuerde Tracking auffuellen, und Tracking hat eine Zyklusrate von **0,904** -
schlechter als der gerade gefahrene Bounty Hunter mit **0,971** (587 offene
Auftraege, kein Vorratsproblem). Der Vorrat ist seit dem Einbau von 16:31
nicht mehr der Engpass; die Erfolgschance ist es.

Dazu kaeme der Schaden: Incite hebt das Chaos um 10 plus `chaos/log10(chaos)`,
von 48,78 aus also ueber 60. Ueber der Schwelle 50 werden alle Aktionen mit
`sqrt(1 + chaos - 50)` schwerer - der Block wuerde die Chancen halbieren, um
einen Vertrag aufzufuellen, den niemand fahren will.

**Der Block bleibt stehen** (er kostet nichts und greift in einem Knoten mit
niedrigem Chaos wieder), aber er zaehlt nicht mehr als offener Hebel.
Commit: siehe git log, blade.js 26.08. 10:49

### Auswahl nach Rang je Ausdauer, selbstkalibrierend (26.08., 09:57)

Engpass: 55 Prozent Kammerzeit, allein wegen Ausdauer. Die Minuten sind
reichlich da, die Ausdauer ist knapp - also zaehlt Rang je AUSDAUERPUNKT.

Hypothese und Rechnung stehen im Eintrag von 09:46: Ueber den vollen Zyklus
aus Arbeit und Ruhe gewinnt Bounty Hunter (0,989 Rang je Ausdauer) gegen
Tracking (0,533) um **Faktor 1,44**, obwohl Tracking bei Rang je Minute vorne
liegt. Erwartung: Die Rangrate steigt von **0,926 auf mindestens 1,15** je
Minute.

Umgesetzt **selbstkalibrierend**, nicht als Tabelle: `blade.js` liest alle
fuenf Minuten die juengsten dreihundert Abschnitte aus `data/aktionen.txt` -
derselben Datei, die es selbst fuellt - und rechnet daraus den Verbrauch je
Aktion. Damit passt sich die Auswahl an steigende Aktionslevel an, statt auf
den Zahlen von heute stehen zu bleiben. Aktionen mit weniger als fuenf
Abschnitten bekommen den Durchschnitt der uebrigen als Schaetzwert.

**Zwei Einheitenfehler in einem Lauf, beide selbst verursacht und behoben:**
1. 09:54: Ungemessene Aktionen fielen auf "Rang je Minute" zurueck - eine
   voellig andere Skala (0,77 gegen 0,19). Der Rueckfall gewann dadurch immer,
   und der Motor fuhr prompt Retirement, die einzige Aktion ohne Messwert.
   Behoben durch den Durchschnitts-Schaetzwert.
2. 09:55: Der Notvertrag-Zweig vergleicht gegen Field Analysis, und General-
   Aktionen kosten gar keine Ausdauer - der Vergleich geht nur ueber die Zeit.
   Der Motor landete auf Field Analysis mit 0,2 Rang je Minute. Behoben:
   `beste()` fuehrt jetzt BEIDE Zahlen mit, `ertrag` fuer die Auswahl und
   `proMinute` fuer den Vergleich mit General-Aktionen.

Wer die Bewertungsgroesse aendert, muss JEDEN Vergleich mitziehen, in dem sie
vorkommt. Das ist die Lehre.

Beleg: `Bladeburner.ts:921` (Ausdauerverlust je Aktion), `1317-1325`
(Regeneration), eigene Messung ueber 295 Abschnitte.

Vorher: 0,926 Rang je Minute, 55,5 Prozent Kammerzeit (09:19-09:45)
Nachher: **WIDERLEGT, zurueckgedreht um 10:15.**

    vorher (09:19-09:45)   55,5 % Kammer   0,926 Rang/min
    danach (09:57-10:14)   62,3 % Kammer   0,606 Rang/min

Erwartet waren mindestens 1,15. Gemessen ist ein Drittel WENIGER - und selbst
auf siebzehn Minuten Messstrecke ist das kein Rauschen mehr.

**Was die Rechnung uebersehen hat:** Bounty Hunter liegt mit 44 Prozent
Erfolgschance UNTER der Sicherheitsschwelle und lief nur ueber den
Notvertrag-Zweig. Mehr als die Haelfte der Versuche schlaegt fehl, und jeder
Fehlschlag kostet die volle Ausdauer bei null Rang. Die Kennzahl "Rang je
Ausdauer" aus `ratencheck.js` enthaelt diese Fehlschlaege zwar, aber der
Zyklus rechnet sich dadurch anders als angenommen: Die Ausdauer ist schneller
weg, ohne dass die kuerzere Arbeitsphase das ausgleicht.

Zurueckgedreht wurde NUR das Auswahlkriterium - ausgewaehlt wird wieder nach
Rang je Minute. **Die Messung bleibt** (`kostenAktualisieren` in blade.js):
Sie kostet nichts, liefert weiter Daten, und die naechste Hypothese kann
darauf aufbauen, statt bei null anzufangen.

**KORREKTUR 10:50 - die Widerlegung war selbst falsch.** Nach dem
Zurueckdrehen gemessen:

    mit neuer Auswahl (09:57-10:14)   62,3 % Kammer   0,606 Rang/min
    zurueckgedreht    (10:16-10:44)   55,7 % Kammer   0,602 Rang/min

**Die Rate blieb unten.** Die Auswahl war also nicht die Ursache - sie war
unschuldig. Gefunden 10:45 ueber `data/bbspann.json`:

    Tracking        Chance 0,525 (war 0,74)   offen  1,0   <- leergespielt
    Bounty Hunter   Chance 0,273 (war 0,44)   offen  487
    Retirement      Chance 0,324 (war 0,45)   offen  359

Der **Vorrat des besten Vertrags war erschoepft**, und der Motor fiel auf
Aktionen zurueck, deren Erfolgschance unter der Sicherheitsschwelle liegt.
Genau in dieses Loch fiel die Messung der neuen Auswahl.

Die Aenderung bleibt trotzdem zurueckgedreht: Sie ist damit weder belegt noch
widerlegt, und ohne Beleg faehrt der Motor die einfachere Regel. Wer sie
erneut probiert, braucht eine Strecke mit gefuellten Vorraeten.

Drei Lehren, alle teuer bezahlt:
1. Wer die Bewertungsgroesse aendert, muss JEDEN Vergleich mitziehen, in dem
   sie vorkommt (zwei Einheitenfehler in einem Lauf, siehe oben).
2. Eine Zyklusrechnung auf dem Papier ersetzt keine Messung. Der Faktor 1,44
   war sauber hergeleitet und trotzdem falsch.
3. **Eine Widerlegung braucht dieselbe Sorgfalt wie eine Bestaetigung.** Ich
   habe eine Aenderung fuer schuldig erklaert, ohne zu pruefen, ob die Zahl
   nach dem Zurueckdrehen wieder steigt. Sie tat es nicht.
Commit: siehe git log, blade.js 26.08. 09:57

### Die Auswahl misst die falsche Groesse - gerechnet, noch nicht umgesetzt (26.08., 09:46)

Engpass: 55 Prozent Kammerzeit, allein wegen Ausdauer. Wenn die Ausdauer der
Engpass ist, zaehlt **Rang je Ausdauerpunkt**, nicht Rang je Minute - und die
Auswahl in `blade.js` optimiert bis heute Letzteres.

Gemessen 09:45 ueber 295 Abschnitte (`tools/ratencheck.js`):

    Aktion                   Rang/min   Rang/Ausdauer   Ausdauer/Lauf   s/Lauf
    Contracts/Tracking          2,180           0,533            1,17       26
    Contracts/Bounty Hunter     1,710           0,989            1,78       48

**Die beiden Kennzahlen widersprechen sich.** Tracking ist in der Arbeitszeit
schneller, Bounty Hunter je Ausdauerpunkt fast doppelt so ergiebig.

Ueber den vollen Zyklus aus Arbeit UND Ruhe gerechnet, mit Budget B (die
Hysteresespanne) und 1,2 Ausdauer je Minute passiver Regeneration, in der
Kammer verdoppelt:

    Bounty Hunter   Verbrauch 2,22/min, netto 1,02  ->  Zyklus 1,397 B, Rang 0,989 B  =  0,708 Rang/min
    Tracking        Verbrauch 2,70/min, netto 1,50  ->  Zyklus 1,084 B, Rang 0,533 B  =  0,492 Rang/min

**Bounty Hunter gewinnt ueber den vollen Zyklus um Faktor 1,44**, obwohl die
bisherige Kennzahl Tracking vorne sieht. Die Absolutwerte des Modells passen
nicht exakt zur Messung (0,708 gegen gemessene 0,93 ueber alles) - das
Verhaeltnis ist die belastbare Aussage, nicht die Zahl.

**Bewusst NICHT in diesem Lauf umgesetzt.** Die saubere Loesung ist
selbstkalibrierend: `blade.js` liest den gemessenen Verbrauch je Aktion aus
`data/aktionen.txt` und waehlt danach. Eine hartkodierte Tabelle aus dreissig
Minuten Messung waere genau der Fehler, gegen den `tools/ratencheck.js`
ueberhaupt gebaut wurde - und Retirement fehlt in der Messung noch ganz.

Ausserdem korrigiert: Der erste Lauf um 09:18 meldete "Tracking 99,8 Rang je
Ausdauer". Diese Zahl war falsch - der Zaehler stammte aus allen Abschnitten,
der Nenner nur aus denen mit Ausdauermessung. Nach der Korrektur sind es 0,533,
und die Rangfolge kehrt sich um.

Vorher: 0,926 Rang je Minute, 55,5 Prozent Kammerzeit (09:19)
Nachher: (keine Aenderung - dies ist die Rechnung, die der Aenderung vorausgeht)
Commit: siehe git log, ratencheck.js 26.08. 09:45

### Ausdauer-Ruhespanne von 52/60 auf 51/56 Prozent (26.08., 07:46)

Engpass: Nach dem Krankenhaus-Hebel ist die Ausdauer der letzte Grund, aus dem
der Motor ruht - gemessen **33,5 Prozent der Zeit** (07:15).

Hypothese: Die Haelfte davon ist geschenkt. Die Spanne von 52 auf 60 Prozent
sind acht Prozent der Hoechstausdauer, bei 64 also gut fuenf Punkte; die
Regeneration betraegt rund 1,2 je Minute (`Bladeburner.ts:1317-1325`), macht
vier Minuten Ruhe je Zyklus. Die Strafe beginnt aber erst UNTER 50 Prozent
(`min(1, stamina/(0,5*max))`, `Bladeburner.ts:167-169`) - alles zwischen 50
und 100 ist gleich gut. 51 auf 56 haelt denselben Abstand zur Strafgrenze und
halbiert die Ruhezeit. Erwartung: Kammeranteil von 33,5 auf unter 25 Prozent,
Rangrate rund ein Zehntel hoeher.

Beleg: `Bladeburner.ts:167-169` (die Strafe und ihre Grenze), `1317-1325`
(Regeneration), `1327-1343` (Hoechstausdauer).

**Geprueft und fuer jetzt verworfen: die Faehigkeit "Cyber's Edge."** Sie hebt
die Hoechstausdauer um 2 Prozent je Stufe (`Skills.ts:84-89`) - und weil
`getSkillMult(Stamina)` in BEIDEN Formeln steckt, auch die Regeneration. Der
Ruheanteil sinkt dadurch tatsaechlich, aber nur schwach: Bei gleicher
prozentualer Steigerung von Reserve und Regeneration bleibt die Ruhezeit
gleich, waehrend die Arbeitsphase mitwaechst. Drei Stufen kosten 1+3+9 = 13
Punkte (baseCost 1, costInc 3) und braechten rund sechs Prozent laengere
Arbeitsphasen, also gut zwei Prozent Rate - dieselbe Groessenordnung wie eine
Stufe Overclock fuer zehn Punkte. Kein klarer Gewinner, deshalb keine
Aenderung am Faehigkeitsplan ohne Messung.

Vorher: 50,1 Prozent Kammerzeit, 0,888 Rang je Minute (06:55-07:46, 49 min)
Nachher: **Die Hypothese ist widerlegt.** Gemessen 08:14 ueber 26 Minuten:

    seit 07:46   26,3 min | Kammer 16,0 min = 60,7 % | 0,941 Rang/min

Die Kammerzeit ist nicht gefallen, sondern **gestiegen** - von 50,1 auf 60,7
Prozent. Die Rangrate liegt mit 0,941 gegen 0,888 leicht darueber, aber das
ist bei 26 Minuten Messstrecke nicht von Rauschen zu unterscheiden.

**Der Denkfehler, und er ist lehrreich:** Die Spanne ist SYMMETRISCH. Sie
begrenzt nicht nur, wie lange geruht wird, sondern auch, wie lange gearbeitet
werden darf - von 56 Prozent hinunter auf 51 statt von 60 auf 52. Beide
Phasen schrumpfen um denselben Anteil, das Verhaeltnis bleibt gleich, und
zusaetzlich steigt der Umschalt-Overhead: acht Kammerabschnitte in 26 Minuten
statt weniger, laengerer.

Nicht zurueckgenommen, weil die ZIELGROESSE - die Rangrate - nicht gefallen
ist. Aber der behauptete Mechanismus tritt nicht ein, und der Eintrag bleibt
als Warnung stehen: An der Hysteresespanne zu drehen bringt nichts. Wer die
Ausdauerruhe verkuerzen will, muss an den Verbrauch (leichtere Aktionen) oder
an die Regeneration heran.
Commit: siehe git log, blade.js 26.08. 07:46

### Krankenhaus statt Regenerationskammer (26.08., 06:55)

Engpass: **Der Motor stand 161 von 222 Minuten - 72,5 Prozent - in der
Regenerationskammer** (`tools/ratencheck.js`, 06:47). Die Arbeitszeit bringt
1,4 bis 2,0 Rang je Minute, ueber alles blieben **0,475**. Das ist der
groesste Einzelhebel des Knotens; bei Rang 331 von 2.500 entscheidet er ueber
Tage.

Der Ruhegrund waren fast immer die Trefferpunkte, nicht die Ausdauer. Kein
Wunder: Das Maximum ist `floor(10 + defense/10)` = 23 (`Person.ts:97`), und
die Kammer heilt **2 je Durchlauf** (`Bladeburner.ts:1198`). Von 11 auf 17
sind das drei Durchlaeufe.

Verworfen, bevor es umgesetzt wurde: **mehr Trefferpunkte durch hoeheres
Trainingsziel.** Bei doppeltem Maximum verdoppelt sich die Arbeitsspanne, aber
die Heilung bleibt bei 2 je Durchlauf - die Ruhezeit verdoppelt sich mit. Der
ANTEIL bleibt gleich, und das Training selbst kostet Stunden ohne Rang.

Hypothese: `ns.singularity.hospitalize()` setzt `hp.current` in EINEM Aufruf
auf das Maximum (`PlayerObjectGeneralMethods.ts:281-290`). Es kostet Geld und
sonst nichts - keine Zeit, keine Aktionsunterbrechung; auf das Ereignis hoert
nur die Infiltration (`Infiltration.ts:83`). Kosten:
`min(Guthaben * 0,1, fehlendeHP * 100.000)` (`Hospital.ts:4-10`), bei zwoelf
fehlenden Punkten also 1,2 Millionen gegen ein Guthaben von 7,5 Milliarden.

Erwartung: Die Kammerzeit faellt von 72,5 auf unter 25 Prozent (es bleibt nur
noch die Ausdauer-Ruhe), die Rangrate steigt von **0,475 auf mindestens 1,3**
je Minute.

Untergrenze eingebaut: Unter zehn Millionen Guthaben bleibt die Kammer. Nach
einem Augmentierungs-Einbau zaehlt jeder Euro fuer Server und Programme, und
der Deckel `Guthaben * 0,1` waere dort ein schlechter Tausch.

Vorher: 0,475 Rang je Minute, 72,5 Prozent Kammerzeit (06:47)
Nachher: **1,118 Rang je Minute, 33,5 Prozent Kammerzeit** - gemessen 07:15
ueber die 18 Minuten seit der Aenderung, gegen 229 Minuten davor:

    bis 06:55   229,0 min gesamt, 166,0 in der Kammer (72,5 %)  ->  0,484/min
    ab  06:55    18,1 min gesamt,   6,1 in der Kammer (33,5 %)  ->  1,118/min

**Faktor 2,3 - diese Zahl war zu guenstig.** Nachgemessen 07:47 ueber die
volle Strecke 06:55 bis 07:46 (49 Minuten statt 18):

    06:55-07:46   49,0 min | Kammer 50,1 % | 0,888 Rang/min

Der Hebel bringt also **72,5 auf 50,1 Prozent** und **0,484 auf 0,888** -
Faktor 1,8, nicht 2,3. Die ersten achtzehn Minuten waren ein zu guenstiger
Ausschnitt; wer auf so kurzer Strecke misst, misst Rauschen mit. Die
Erwartung von 1,3 ist damit klar verfehlt, das Ziel von unter 25 Prozent
Kammerzeit ebenso.

Was uebrig bleibt, ist ein ANDERER Engpass: Die verbliebenen 33,5 Prozent sind
Ausdauer-Ruhe, nicht Trefferpunkte. Die Ausdauer regeneriert passiv rund 1,2
je Minute (`Bladeburner.ts:1382`), die Kammer verdoppelt das nur - gegen sie
hilft kein Krankenhaus. Das ist der naechste Hebel, nicht dieser.
Commit: siehe git log, blade.js 26.08. 06:55

### Notvertrag statt Field Analysis (26.08., 00:55)

Engpass: Der Motor stand zweieinhalb Stunden auf `General/Field Analysis` und
kam auf **0,22 Rang je Minute** (Rang 143 um 22:43, 171 um 00:51 - 28 in 128
Minuten). Field Analysis gibt rankGain 0,1, also rund 0,2 je Minute; die
Messung trifft den Wert exakt.

Hypothese: Der Rueckfall ist falsch bemessen. Gemessen 00:52 ueber
`data/bbspann.json`:

    Bounty Hunter   0,381 Chance · 0,9 Rang · 21 s  ->  0,98 Rang/min
    Retirement      0,386        · 0,6      · 21 s  ->  0,70
    Field Analysis  --           · 0,1      · 30 s  ->  0,20

Beide Vertraege lagen knapp unter der Sicherheitsschwelle von 0,45 - und
brachten trotzdem das Drei- bis Fuenffache von Field Analysis. Die Schwelle
vergleicht die Chance mit einer festen Zahl, statt den Ertrag mit der
Alternative. Bei Vertraegen ist ein Misserfolg billig: etwas Ausdauer, etwas
Chaos, kein Rangverlust und kein Toter. Erwartung: mindestens 0,9 statt 0,22.

Beleg: rankGain in `reference/bitburner-src/src/Bladeburner/data/Contracts.ts`
(19, 53, 86) und `data/GeneralActions.ts`; Dauern ueber
`ns.bladeburner.getActionTime`.

Umgesetzt: Faellt kein Vertrag ueber die Schwelle, wird trotzdem der
ertragsstaerkste genommen, sofern er das Anderthalbfache von Field Analysis
bringt. Operationen (Teamverluste) und Black Ops (Tod) behalten ihre
Sicherheitsschwellen unangetastet.

Vorher: 0,22 Rang je Minute (22:43 bis 00:51)
Nachher: **gegriffen, aber selten.** In `data/aktionen.txt` steht bis 06:51
genau EIN Abschnitt mit dem Grund "Vertrag unter Schwelle, lohnt trotzdem" -
der Fall tritt nur ein, wenn gleichzeitig alle Vorraete knapp und alle Chancen
unter 0,45 sind. Der Wert des Hebels liegt darin, dass die Alternative
(Field Analysis mit 0,2 je Minute) nie wieder gewaehlt wird; als Dauerzustand
war er nie gedacht. Nicht zurueckgenommen.

**Naechster Kandidat, bewusst nicht in diesem Lauf:** Auch oberhalb der
Schwelle waehlt der Motor nicht optimal. Um 01:00 fuhr er Tracking (0,78 Rang
je Minute), waehrend Bounty Hunter 0,98 gebracht haette - der lag nur unter
der Schwelle. Konsequent waere, bei VERTRAEGEN ganz auf die Sicherheitsschwelle
zu verzichten und rein nach Ertrag zu waehlen, mit einer harten Untergrenze
gegen Unsinn. Erst messen, was der jetzige Schritt bringt.

Commit: siehe git log, blade.js 26.08. 00:55

### Aktionsauswahl nach Rangertrag je Minute statt nach Erfolgschance (25.08., 21:57)

Engpass: Der Bladeburner-Rang. Bei 129 von 2.500 fuer die erste Black Op und
0,84 Rang je Minute sind das noch **47 Stunden** - das ist die Zahl, an der
dieser Knoten haengt.

Hypothese: Der Motor fuhr die **schlechteste** Aktion der ganzen Liste.
Gemessen 21:56 ueber `data/bbspann.json`, sortiert nach Ertrag je Minute:

    Raid                          0,094 Chance ·   55 Rang ·  62 s  ->  5,00
    Stealth Retirement Operation  0,077        ·   22      ·  77 s  ->  1,32
    Undercover Operation          0,191        ·  4,4      ·  39 s  ->  1,29
    Bounty Hunter                 0,457        ·  0,9      ·  21 s  ->  1,18
    Assassination                 0,049        ·   44      · 116 s  ->  1,11
    Tracking                      0,734        ·  0,3      ·  13 s  ->  1,02
    Investigation                 0,230        ·  2,2      ·  31 s  ->  0,98
    Sting Operation               0,122        ·  5,5      ·  51 s  ->  0,79
    Retirement                    0,449        ·  0,6      ·  21 s  ->  0,77   <- gefahren

Bounty Hunter und Retirement sind gleich lang und praktisch gleich sicher,
aber der eine bringt die Haelfte mehr. Die alte Regel waehlte nach `s.min`
allein und nahm deshalb Retirement, sobald dessen Schaetzung einen Hauch
hoeher lag. Erwartung: Die Rangrate steigt von 0,84 auf mindestens 1,1 je
Minute.

Beleg: rankGain in `reference/bitburner-src/src/Bladeburner/data/`
(Contracts.ts:19, 53, 86 · Operations.ts:19, 53, 89, 124, 164, 202), Dauern
ueber `ns.bladeburner.getActionTime`.

Bewusst NICHT geaendert: die Schwelle fuer Operationen (`SICHER_OPERATION`
0,85). Raid steht mit 5,0 Rang je Minute weit oben, aber bei 9,4 Prozent
Erfolg sind das ueber neunzig Prozent Fehlschlaege - jeder kostet Ausdauer und
Trefferpunkte und erhoeht das Chaos der Stadt, was wiederum alle Chancen
senkt. Das gehoert durchgerechnet, nicht ueberstuerzt.

Vorher: 0,84 Rang je Minute (21:19 bis 21:51, Rang 102 -> 129)
Nachher: **nicht sauber messbar.** Um 22:01 kam ein Augmentierungs-Einbau
dazwischen, danach lag der Motor bis 00:51 bei 0,22 Rang je Minute - aber aus
einem anderen Grund (siehe den Eintrag darueber: Field Analysis statt
Vertraege). Die Auswahl nach Ertrag ist davon unberuehrt richtig; nachzumessen
ist sie erst auf einer Strecke ohne Einbau.
Commit: f5b7f07

### Ausdauer-Hysterese von 55/90 auf 52/60 Prozent (25.08., 20:02)

Engpass: Der Bot verbrachte den Grossteil seiner Zeit in der
Regenerationskammer statt in Vertraegen. Im Messverlauf steht der Rang
zwischen 19:40 und 19:59 unveraendert bei 73, Aktion durchgehend
`General/Hyperbolic Regeneration Chamber`, Ausdauer 29 von 53.

Hypothese: Die Ruhe war ohne Wirkung. Die Ausdauerstrafe ist
`min(1, stamina / (0,5 * maxStamina))` und wirkt an genau einer Stelle:
`competence *= inst.calculateStaminaPenalty()`. Oberhalb von 50 Prozent ist
sie exakt 1 — der Bot ruhte ab 55 Prozent, wo er noch volle Leistung hatte,
und ruhte dann bis 90, was ihm nichts brachte. Erwartung: Der Anteil der
Arbeitszeit steigt von rund 40 auf ueber 80 Prozent, der Rangzuwachs
entsprechend.

Beleg: `reference/bitburner-src/src/Bladeburner/Bladeburner.ts:167-169` (die
Strafe), `Actions/Action.ts:176` (ihre einzige Verwendung),
`Bladeburner.ts:1382` (Ausdauer regeneriert passiv weiter, auch waehrend der
Arbeit — die Kammer verdoppelt das nur).

Mitgeaendert, weil sonst ein neues Problem entstuende: Die Kammer heilte
nebenbei 2 HP je Durchlauf (`Bladeburner.ts:1198`). Bei kurzer Ruhe faellt das
weg, also ruht der Bot jetzt zusaetzlich unter 50 Prozent Trefferpunkten und
arbeitet ab 95 Prozent weiter.

Vorher: Rang 73, unveraendert ueber 19 Minuten Kammer (19:40-19:59)
Nachher: 20:02 sofort nach dem Neustart `Contracts/Tracking` bei Ausdauer
41/53 (77 Prozent) — unter der alten Regel haette er weitergeruht.

**Nachgemessen 21:51:** Auf der einzigen sauberen Strecke (21:19 bis 21:51,
nach dem Neuladen, ohne Drosselung, ohne Engine-Stillstand) stieg der Rang von
102 auf 129 — **0,84 je Minute**. Eine belastbare Vorher-Zahl gibt es nicht:
Alle Strecken davor sind durch die Tab-Drosselung oder den Engine-Ausfall
verunreinigt. Der Hebel bleibt damit **plausibel, aber nicht sauber belegt**.
Zurueckgenommen wird er nicht - die Begruendung haengt am Quellcode, nicht an
der Messung: Oberhalb von 50 Prozent Ausdauer ist die Strafe exakt 1.

Nachtrag zur HP-Schwelle: 0,95 war unerreichbar und hielt den Motor in der
Kammer fest; seit 20:47 steht sie auf 0,75.
Commit: (siehe git log, blade.js 25.08.)
