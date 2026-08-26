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
