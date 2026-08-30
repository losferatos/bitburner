# Kurs

**Die Leitgröße, aus dem Quellcode hergeleitet.** Der Optimierloop liest den
obersten Eintrag und richtet sich danach; alle anderen Loops arbeiten darauf
zu. Geschrieben wird hier nur vom Kursloop (`loops/loop-kurs.md`, alle 12 h).

**Warum die Datei existiert:** Bis zum 27.08.2026 bekam der Optimierloop seine
Leitgröße im Prompt vorgeschrieben und las zur Bestätigung `nodes/HEBEL.md` —
wo derselbe Satz stand. Er las als Quelle seine eigene Ausgabe. Die Größe war
zufällig richtig, wurde aber nie hergeleitet und deshalb auch nie
durchgerechnet: Optimiert wurde auf den nächsten Meilenstein statt auf den
Ausgang. Diese Datei bricht den Kreis, indem sie nur aus
`reference/bitburner-src/` gespeist wird.

**Wie man einen Eintrag herleitet**, wenn der Kursloop nicht gelaufen ist:

1. `NetscriptFunctions/Singularity.ts`, `destroyW0r1dD43m0n` — was genau muss
   erfüllt sein? Es gibt meist **mehrere** Wege; alle durchrechnen.
2. `BitNode/BitNode.tsx` — die Multiplikatoren des Knotens. Sie entscheiden,
   welcher Weg überhaupt in Frage kommt.
3. Den Engpass **absolut** beziffern (X von Y), und abziehen, was unterwegs
   ohnehin anfällt.
4. Prüfen, ob die Rate sich selbst beschleunigt — eine lineare Fortschreibung
   ist fast immer falsch.

---

## 30.08., 19:30 - BitNode 10

**Ausgangsbedingung:** `destroyW0r1dD43m0n` (`NetscriptFunctions/Singularity.ts:1146-1165`)
prueft zwei Wege mit ODER. Der Hackingweg verlangt `Player.skills.hacking >=
wd.requiredHackingSkill` **und** Adminrechte auf `w0r1d_d43m0n`; bei
`HackingLevelMultiplier 0.35` (`BitNode.tsx` case 10) ist das Level 6.000, also
10^175 Erfahrung - verworfen und im ENTSCHIEDEN-Kopf von `BAUSTELLEN.md`
festgehalten. Bleibt `numBlackOpsComplete >= 21`, und die 21. ist Operation
Daedalus mit `reqdRank: 400e3` (`Bladeburner/data/BlackOperations.ts:708`).

**Engpass:** Bladeburner-Rang **907 von 400.000 = 0,23 %**.

**Restweg netto:** 399.093 minus 73.660, die unterwegs aus den `rankGain`-Werten
der ersten zwanzig Black Ops anfallen (`BlackOperations.ts`, Summe aller 21 ist
113.660, davon Daedalus selbst 40.000) = **325.433**. Die zwanzig sind
allerdings nur einloesbar, wenn ihre Erfolgschancen tragen - heute liegt schon
Typhoon bei 4,6 %.

**Rate:** gemessen ueber `data/verlauf-strategie.json`: 49,8/h ueber 0,8 h,
56,1/h ueber 1,7 h, **49,5/h ueber 4,8 h**. Die Rate ist ueber alle drei Fenster
stabil - kein exponentielles Wachstum, wie es der Eintrag von 14:45 annahm.

**ETA:**
- **Ohne Eingriff: 325.433 / 49,5 = 6.575 Stunden.** Das ist die ehrliche
  Fortschreibung des Ist-Zustands und der Grund, warum ein Zwischenschritt
  noetig ist.
- **Mit dem Graft-Paket: rund 63 Stunden** - 42 h Graften plus 21,1 h
  Assassination. Herleitung im Eintrag von 18:45 und im obersten Sofort-Punkt
  von `nodes/BAUSTELLEN.md`. Vorlauf 18:45: 63 h, unveraendert.

**Leitgroesse:** `max(Aktionszeit / Arbeitsanteil, Nachschubzeit)` bis Rang
400.000, mit Arbeitsanteil `min(1, (R + Z) / (V + Z))` - R = **1,360** je
Minute, Z = Kammerzulage (maxStamina x 1 % je Abschluss), V der Verbrauch der
Aktion. Fuer Assassination sind das **21,8 h**; jede Aenderung wird daran
gemessen.

*Korrigiert 19:50 (Commit `712442c`, nach einem Skeptiker-Lauf).* Hier stand
`min(1, R / V)` mit R = 1,774. Beides war falsch: Die 1,774 stammten aus einer
Vorgabe vom 26.08. aus einem anderen Lauf, und die Kammerzulage gehoert nicht
weggerechnet, sondern auf die Ruhe-Seite. `calculateStaminaGainPerSecond`
(`Bladeburner.ts:1317-1325`) ergibt 1,349-1,366, die Messung ueber 11
Kammerphasen 1,360. **Assassination ist damit nicht ausdauerneutral** (1,42
gegen 1,360), Anteil 0,969. Stealth Retirement faellt von 21,2 auf 25,9 h -
die Wahl kippt nicht, sie wird robuster.

**Entscheidung: Zwischenschritt - das Graft-Paket.** Der Faktor zwischen 6.575
und 63 Stunden ist zu gross, um ihn zu diskutieren. Die drei Codeaenderungen,
die vorher stehen muessen, sind eingetragen; die erste (`src/blade.js`) ist
seit 19:15 drin (`578e750`).

**Naechste Pruefung:** Ob der Graft-Riegel im Ernstfall haelt. Er ist bisher
nur im Normalbetrieb geprueft (kein Graft laeuft). Der erste echte Test ist das
Graften von `Neuroreceptor Management Implant` ($1,65 Mrd, 14 min) - klein
genug, dass ein Fehlschlag nichts kostet, und es ist ohnehin das erste Stueck
der Reihenfolge.

---

## 30.08., 18:45 - BitNode 10: Assassination, 21 Stunden, Ausgang bei rund 63 h

**Verfeinerung des Eintrags von 18:20, nicht sein Widerruf.** Zwei Zahlen sind
dazugekommen: das maximale Graft-Paket beim heutigen Geldstand und die
berichtigte Ausdauerregeneration (R = 1,774 statt 2,300, Commit `929f177` -
die Kammer gibt 1 % maxStamina je Abschluss obendrauf, das gehoerte
herausgerechnet).

> **Leitgroesse: `max(Aktionszeit / Arbeitsanteil, Nachschubzeit)` bis
> Rang 400.000.** Der Arbeitsanteil ist `min(1, R / Ausdauerverbrauch)`; er
> fehlte bis 18:20 in der Rechnung.

| Aktion | Erfolge | Aktionszeit | Arbeitsanteil | **Realzeit** | Nachschub |
|---|---|---|---|---|---|
| **Assassination** | 533 | 21,1 h | **1,000** | **21,1 h** | 7,0 h |
| Stealth Retirement | 901 | 21,2 h | 1,000 | 21,2 h | 23,2 h |
| Undercover | 1.953 | 22,2 h | 0,657 | 33,9 h | 63,4 h |
| Raid | Abbruch nach 349 Synthoid-Gemeinden bei 83.236 Rang | | | | |

Assassination ist die einzige Aktion, die beides erfuellt: ausdauerneutral
(1,41 Verbrauch gegen 1,774 Regeneration) und genug Nachschub. **21,1 Stunden.**

**Ausgang aus dem Knoten: rund 63 Stunden** - 42 h Graften, dann 21 h
Assassination. Herleitung und die drei Codeaenderungen, die vorher noetig
sind, im obersten Sofort-Punkt von `nodes/BAUSTELLEN.md`.

---

## 30.08., 18:20 - BitNode 10: die Leitgroesse ist der NACHSCHUB, nicht die Rate

**Dritter Korrektureintrag heute, und diesmal mit einer durchgerechneten
Zahl.** Der Eintrag von 17:15 sagte "Welche Aktion faehrt der Bot, und wie
viele Erfolge braucht sie bis Rang 400.000?". Die Frage war richtig, die
Antwort unvollstaendig - sie liess zwei Deckel aus.

> **Leitgroesse: `max(Aktionszeit, Nachschubzeit)` bis Rang 400.000.**
> Der Vorrat jeder Operationsart waechst mit 18,75 Stueck je Stunde
> (`Bladeburner.ts`, `count += seconds * growthFunction() / 480`). Wer mit
> niedriger Erfolgschance faehrt, verbrennt Vorrat statt Rang.

| Aktion | Erfolge | Versuche | Aktionszeit | Nachschub | massgeblich |
|---|---|---|---|---|---|
| Raid | - | - | Abbruch nach 349 | - | **nicht gangbar** |
| **Assassination** | 534 | 792 | 27,0 h | 18,9 h | **27,0 h** |
| Stealth Retirement | 902 | 1.087 | 24,8 h | 33,9 h | 33,9 h |
| Undercover | 1.822 | 1.839 | 20,9 h | 60,5 h | 60,5 h |

*(Mit dem Graft-Paket aus `nodes/GRAFTING.md`. Ohne Grafting: 526 / 409 /
246 h. Alle Modelle geeicht an der bbspann-Messung von 17:58.)*

**Der zweite Deckel: Synthoid-Gemeinden.** Jeder erfolgreiche Raid ruft
`--city.comms` (`Bladeburner.ts:830-836`). Ueber alle sechs Staedte gibt es
**349**, und sie wachsen mit rund 0,007 je Stunde nach. Raid liefert damit
83.237 Rang - 21 % des Wegs - und ist dann tot. Assassination und Stealth
Retirement verbrauchen keine Gemeinde.

**Was daraus folgt:** Der Ausgang liegt bei rund **70 Stunden** - etwa 42 h
Graften, dann 27 h Assassination. Herleitung, Grenzen und der offene Punkt
(das Graft-Paket ist nach Daedalus-Gewichten gebaut, nicht nach denen von
Assassination) stehen im obersten Sofort-Punkt von `nodes/BAUSTELLEN.md`.

---

## 30.08., 17:15 - BitNode 10: die Leitgroesse ist der Rang je OPERATION

**Zweiter Korrektureintrag ausser der Reihe.** Der Eintrag von 14:45 ersetzte
"Rang je Stunde" durch "Verdopplungszeit des Rangs, Ziel unter 3 h". Auch das
traegt nicht - eine Messung ueber 33 Verlaufspunkte in diesem Knoten zeigt
etwas Drittes.

**Was gemessen wurde** (`data/verlauf-strategie.json`, 30.08. 17:00):

- Rangrate 45,7/h ueber 1,8 h, 41,9/h ueber 3,3 h, 44,6/h ueber 4,4 h. Das ist
  **konstant**, nicht exponentiell. Rang 575 -> 771 in 4,4 h waere eine
  Verdopplungszeit von 10,4 h, nicht 2,5-3,8 h.
- Im 22,6-h-Mittel 34,1/h. Die Rate waechst also - aber langsam und
  abflachend, nicht mit fester Verdopplungszeit.

**Warum beide bisherigen Modelle falsch waren.** Der Ranggewinn ist
`rankGain x rewardFac^(level-1) x BladeburnerRank` (`Bladeburner/Formulas.ts:9-28`),
und das Level waechst wie `sqrt(2 x Erfolge)`
(`LevelableAction.getSuccessesNeededForNextLevel`, an Tracking geeicht: Level 32
bei 563 Erfolgen). Der Ertrag je Erfolg waechst also mit `rewardFac^sqrt(E)` -
anfangs schnell, dann immer flacher. Weder eine konstante Rate noch eine
konstante Verdopplungszeit beschreibt das.

**Die Leitgroesse ist deshalb keine Rate, sondern eine Auswahl:**

> **Welche Aktion faehrt der Bot, und wie viele Erfolge braucht sie bis
> Rang 400.000?**

| Aktion | Rang je Erfolg (Lvl 1) | netto je Level | Erfolge bis 400.000 |
|---|---|---|---|
| Tracking | 0,24 | 1,021 | 12.251 |
| Bounty Hunter | 0,72 | 1,043 | 3.283 |
| Raid | 44,0 | 1,053 | 710 |
| **Assassination** | **35,2** | **1,076** | **532** |

Der Bot faehrt derzeit ausschliesslich Vertraege - Weg: Wochen. Alle sechs
Operationen stehen auf Level 1 mit vollen Vorraeten. Ueber Assassination sind
es bei einem Nachschub von 18,75/h rund **28 Stunden**.

**Was den Wechsel blockiert:** 20 Trefferpunkte Maximum. Ein Raid-Fehlschlag
kostet 315,8 HP (gemessen 30.08., `bbspann.js`). Nach dem Graft-Paket waere
`hp.max = 1.912` - das ist der eigentliche Zweck des Graftens, nicht die
Black-Op-Chance. Herleitung und Zahlen: `nodes/BAUSTELLEN.md`, oberster
Sofort-Punkt, und `nodes/GRAFTING.md`.

**Und eine Hoffnung ist gestrichen:** Die 21 Black Ops geben zusammen nur
113.660 Rang (`data/BlackOperations.ts`). Sie koennen den Weg zu 400.000
nicht selbst tragen.

---

## 30.08., 14:45 - BitNode 10: die Leitgroesse war die falsche Kennzahl

**Korrektureintrag ausser der Reihe.** Der Eintrag von 07:20 steht auf einer
Modellklasse, die drei unabhaengige Pruefungen heute widerlegt haben. Weil
vier Loops die Zeile `Leitgroesse` lesen, wird sie hier richtiggestellt statt
erst beim naechsten regulaeren Kurslauf um 18:44.

**Was falsch war: Rang je Stunde ist keine Leitgroesse, sondern ein
Momentanwert auf einer Exponentialkurve.**

Der Rangzuwachs folgt `dR/dt ~ R^a` mit **a nahe 1,0** - also **konstante
Verdopplungszeit**, nicht konstante Rate. Die Projektakte hatte das am 29.08.
um 01:20 bereits gemessen (Log-log-Regression ueber 142 gleitende
Zweistundenfenster, `nodes/ERLEDIGT.md:1846-1858`); der Eintrag von 07:20 hat
es nicht benutzt.

Die Folgen waren gross: Aus einem Messwert von 42,5 Rang/h wurden per linearer
Fortschreibung **338 Tage** - und der Messwert war zusaetzlich ein
Post-Reset-Loch (der Einbau von 09:21 hatte die Kampfwerte auf 1 gesetzt).
Dieselbe Fehlerklasse traf heute dreimal: 254 Rang/h waren Lagerabbau,
30 Rang/h waren Lagerabbau, 42,5 Rang/h war ein Trog.

**Die richtige Kennzahl, gemessen in beiden Knoten:**

    BN10   Rang     10 ->     366    13,1 h / 5,19 Verdopplungen   T = 2,53 h
    BN6    Rang 13.209 -> 452.411    19,2 h / 5,10 Verdopplungen   T = 3,76 h

BN10 laeuft im Anlauf also **schneller** als BN6. Und BN6 brauchte fuer die
ersten 80.000 Rang rund **40 Spielstunden**, danach nur noch **10** bis
452.411 - der Anlauf ist der teure Teil, in beiden Knoten.

Ausgangsbedingung: unveraendert - alle 21 Black Ops, Daedalus verlangt Rang
                   400.000 (`BlackOperations.ts:708`). Der Weg dorthin ist
                   geprueft: `destroyW0r1dD43m0n` setzt `backdoorInstalled`,
                   sobald `numBlackOpsComplete >= 21` (`Singularity.ts:1155-1166`),
                   SF4 liegt vor.
Engpass:           Bladeburner-Rang **671 von 400.000**; netto 340.401 nach
                   Abzug der 58.928 aus den Black-Ops-Ertraegen.
Restweg:           9,28 Verdopplungen von 671 aus.
Rate:              **Verdopplungszeit 2,53 h** (BN10, gemessen vor dem
                   Einbau) bzw. 3,76 h (BN6-Regression). Rang je Stunde wird
                   nicht mehr fortgeschrieben.
ETA:               **30-110 h, Erwartungswert 50-70 h** | Vorlauf: 45-134 h
                   (dieselbe Groessenordnung, aber auf falschem Weg erreicht).
                   Zwei unabhaengige Modelle: Verdopplungsfortschreibung 23-46 h,
                   mechanistische Stundensimulation aus dem Quellcode 62-113 h.
Leitgroesse:       **Die Verdopplungszeit des Bladeburner-Rangs**, gemessen
                   ueber mindestens zwei Verdopplungen. Ziel: unter 3 h.
                   *Nicht* Rang je Stunde - dieser Wert steigt exponentiell
                   und sagt ohne den Rangstand nichts.
Entscheidung:      **weiterfahren.** Der Hacking-Weg wurde vollstaendig
                   durchgerechnet: 150-250 h gegen 50-70 h - Faktor 2 bis 4
                   schlechter. Bladeburner bleibt.
Naechste Pruefung: **Rang 1.342** (eine Verdopplung ab 671). Wird er in rund
                   2,5 h erreicht, traegt das Modell. Braucht er deutlich
                   laenger, flacht die Kurve ab und die ETA steigt - dann
                   gehoert der Exponent neu bestimmt, nicht die Rate.

**Zwei Randbedingungen, die die Prognose kippen koennen und deshalb
mitgemessen gehoeren:**

1. **Jeder Augmentierungs-Einbau kostet 5 bis 7 Stunden** (Kampfwerte auf 1,
   rund 3 h Gym plus Ratenverlust). Der Einbau von 09:21 war nach der
   Aktenlage ein Fehler - die Sperre in `bn4rep.js:683` hat nicht gegriffen;
   eigener Punkt in `nodes/BAUSTELLEN.md`.
2. **Chaos ueber 50** multipliziert die Schwierigkeit mit `sqrt(1+chaos-50)`
   (`Actions/Action.ts:94-101`). Aevum steht bei 47,15, stabil, und der Motor
   treibt es nicht (null Incite-Abschnitte im Protokoll). Bei Chaos 60 faellt
   die Rate auf 30 Prozent.

---

## 30.08., 07:20 - BitNode 10: erste Messung im Vollbetrieb, ETA halbiert sich

Der erste Kurslauf, der auf einer Rangreihe im **Vollbetrieb** steht statt auf
Hochrechnungen aus BitNode 6. Seit 06:26 ist der Kampfwert-Wiederaufbau nach
dem Einbau abgeschlossen, seit 06:20/06:35 leistet der Sleeve wieder
Kontrakte. Erst ab diesem Zeitpunkt misst man den Motor und nicht das Anlaufen.

**Ausgangsbedingung, neu aus dem Quellcode hergeleitet.**
`Singularity.ts:1153-1158`: `bladeburnerRequirements()` verlangt
`numBlackOpsComplete >= numberOfBlackOperations`, also **alle 21 Black Ops**.
Die letzte ist Operation Daedalus (`BlackOperations.ts:704-709`) mit
`reqdRank: 400e3`. Der Hacking-Weg bleibt verworfen (Level 6.000, siehe
`## ENTSCHIEDEN`); `WorldDaemonDifficulty: 2` in BN10 macht ihn zusaetzlich
teurer.

**Was schon eingerechnet ist.** Die 21 Black Ops tragen zusammen 113.660
`rankGain`. Davon zaehlt Daedalus' eigener Ertrag (40.000) nicht auf die
Schwelle, weil er erst danach anfaellt. Es bleiben 73.660 - und **in BitNode 10
wirkt `BladeburnerRank: 0,8`** auf jeden Rangertrag, Black Ops eingeschlossen
(`Formulas.ts:22-25`, `BitNode.tsx:870`). Unterwegs fallen also
73.660 x 0,8 = **58.928** Rang von allein an, knapp 15 Prozent der Strecke.

    Ziel                400.000
    Stand (07:15)           287   = 0,07 %
    Black Ops unterwegs  58.928
    ---------------------------------
    selbst zu erarbeiten 340.785

**Die Rate, gemessen ueber 22 Punkte des Waechters (06:13 bis 07:15):**

    1. Drittel (Rang 99-136)    111,5 Rang/h
    2. Drittel (Rang 136-198)   176,8 Rang/h
    3. Drittel (Rang 198-287)   253,8 Rang/h
    gesamt                      182,0 Rang/h

Eine lineare Fortschreibung ist damit widerlegt, ohne dass man den Exponenten
kennen muss: **+128 Prozent Rate binnen einer Stunde.** Das erste Drittel
enthaelt noch Gym-Anteil, aber auch 2. gegen 3. Drittel allein sind +43 Prozent
in 20 Minuten.

Der momentane Exponent aus den drei Stuetzstellen ist a = 1,09 bis 1,10 - das
ist **kein Langfristwert**, sondern die Anlaufphase: Aktionslevel steigen am
Anfang schnell (`rewardFac^(level-1)`), und die ersten Skillpunkte aus
`floor(maxRank/3)` haben bei kleinem Rang die groesste relative Wirkung. Ein
a >= 1 wuerde in endlicher Zeit divergieren; das kann die Mechanik nicht.
Langfristig gilt: Skillkosten wachsen **linear** (`Skill.ts:37-41`), also
Level ~ sqrt(Punkte) ~ sqrt(Rang), und der Multiplikator ist linear im Level -
das ergibt **a = 0,5**.

**ETA** aus `dR/dt = c*R^a` mit c aus dem 3. Drittel (253,8 Rang/h bei R=250):

    a = 0,4    134 h
    a = 0,5     77 h     <- der hergeleitete Wert
    a = 0,6     45 h

Konservativ, weil die 58.928 Rang aus den Black Ops als Spruenge die Rate
zusaetzlich anheben und hier nicht mitintegriert sind.

Ausgangsbedingung: alle 21 Black Ops; Daedalus verlangt Rang 400.000 (`BlackOperations.ts:708`)
Engpass:           Bladeburner-Rang **287 von 400.000 = 0,07 %**; netto 340.785 selbst zu erarbeiten
Restweg:           340.785 (nach Abzug von 58.928 aus Black-Ops-`rankGain` x 0,8)
Rate:              253,8 Rang/h, gemessen 06:57-07:15; 182,0 ueber die volle Stunde
ETA:               **45-134 h, Mitte 77 h** (a=0,5) | Vorlauf: 89-185 h
Leitgroesse:       **Bladeburner-Rang je Stunde**, geglaettet ueber mindestens 30 Minuten. Stand 254.
Entscheidung:      **weiterfahren.** Ein Einbau kostet den Kampfwert-Wiederaufbau (heute Nacht 11,3 h gemessen) = rund 2.800 Rang bei aktueller Rate, gegen unbezifferten Nutzen - und die Rate steigt gerade steil. Nicht jetzt.
Naechste Pruefung: Traegt a = 0,5? Bei Rang 1.000 muss die Rate rund 500/h betragen, bei Rang 4.000 rund 1.000/h. Liegt sie darunter, ist a kleiner und die ETA waechst - dann ist der Einbau neu zu rechnen.

---

## 29.08., 10:20 - BitNode 10: sofort beitreten, und was danach wirklich kommt

Zwei Fragen aus der Simulation der Startphase beantwortet, beide mit den
echten Formeln gerechnet (`LevelableAction.ts:49-56`, `Bladeburner.ts:915-946`,
`Actions/Action.ts:104-121`, `data/Constants.ts`).

**1. Beitritt bei Kampfwert 100 oder spaeter? Sofort - die Frage ist
entschieden.** Hoehere Kampfwerte helfen der Rangphase nur schwach, weil sie
dort ueber `statFac` (Exponent 0,04 bzw. 0,035) und `agi^0,8` eingehen, also
stark gedaempft. Zehn Stunden Bladeburner ab verschiedenen Niveaus:

    Kampfwerte 100   Rang nach 10 h  297   Arbeitsanteil  17,9 %
    Kampfwerte 150   Rang nach 10 h  338   Arbeitsanteil  19,3 %
    Kampfwerte 300   Rang nach 10 h  435   Arbeitsanteil  22,2 %

Von 100 auf 300 sind das **+46 Prozent Rang** - dafuer waeren Tage im Gym
noetig (der Erfahrungsbedarf waechst exponentiell im Level). Das Verhaeltnis
ist eindeutig; wer beitreten kann, tritt bei.

**2. Die Startrate ist sehr klein, und das ist normal.** Bei Kampfwerten 100,
Rang 0 und allen Faehigkeiten auf 0:

    Regeneration   1,19 Ausdauer je Minute      Verbrauch  6,65 je Minute
    Arbeitsanteil  R/V = 18 Prozent
    Tracking Lvl 1 10,4 s je Aktion, Rangertrag 0,3 * 0,8 = 0,24
    Startrate      rund **0,5 Rang je Minute**

Der Motor der Phase ist nicht die Ausdauer, sondern der **Aktionslevel**: Der
Ertrag waechst mit `rewardFac^(level-1)` (Tracking 1,041), und ein Level
braucht `ceil(0,5 * L * (2*3 + L-1))` Erfolge. Nach 10 Stunden steht Level 31
und der Ertrag bei 0,77 je Aktion - Faktor 3 gegenueber dem Start. Zum
Vergleich das BitNode-6-Spaetspiel: dort wurden **1.400 Rang je Minute**
gemessen (Verlauf 28.08., 13:40 bis 14:03).

**Was das fuer die ETA heisst - ehrlich:** Die Spanne 89-185 h aus dem
Eintrag von 07:15 ist aus BitNode-6-Raten hochgerechnet und beschreibt das
Spaetspiel, nicht den Anfang. Die Simulation hier ist umgekehrt eine **untere
Schranke**, weil sie drei Beschleuniger auslaesst: das Wachstum der
Kampfwerte durch die Aktionen selbst, die Skillpunkte aus `floor(maxRank/3)`
und den Wechsel auf Operationen mit hoeherem `rankGain`. Die belastbare Zahl
kommt aus der ersten geglaetteten Messung nach dem Beitritt - bis dahin bleibt
die Spanne stehen, jetzt aber mit dem Vermerk, dass sie am oberen Ende
wahrscheinlich zu knapp ist.

Leitgroesse: unveraendert. Bis zum Tor der Kampfwert-Tiefstand (83 von 100 um
10:07), danach der Bladeburner-Rang.

Entscheidung: **weiterfahren**, Beitritt bei 100 ohne Zwischenschritt.

---

## 29.08., 07:20 - BitNode 10 (Kursloop: beide Ausgaenge gegeneinander gerechnet)

Der Eintrag von 07:15 beziffert die Bladeburner-Strecke. Was dort fehlte: der
Beleg, dass es der billigere der beiden Ausgaenge IST. Bisher stand das als
Annahme im Kurs, hergeleitet war es nie.

Ausgangsbedingung: Es gibt **genau zwei** Wege, und beide stehen im Code.

    Weg A  Bladeburner: alle 21 Black Ops abschliessen, dann erscheint der
           Knopf 'Destroy w0r1d_d43m0n' (`Bladeburner/ui/BlackOpPage.tsx:39-51`,
           Bedingung `numBlackOpsComplete >= numberOfBlackOperations`).
           Kein Hackniveau noetig.
    Weg B  Backdoor auf w0r1d_d43m0n (`NetscriptFunctions/Singularity.ts:524`).
           `requiredHackingSkill *= WorldDaemonDifficulty`
           (`Server/ServerHelpers.ts:423`), in BitNode 10 also 3.000 * 2 =
           **6.000**.

Weg B durchgerechnet, nicht geschaetzt: `HackingLevelMultiplier` ist in diesem
Knoten 0,35 (`BitNode.tsx`, case 10), mit dem heutigen Aug-Multiplikator 1,3513
ergibt das m_eff = 0,4730. Ueber `calculateSkill` umgestellt braucht Level
6.000 dann **10^175 Erfahrung**. Selbst mit einem utopischen Hack-Multiplikator
von 10 (m_eff 3,5) blieben 10^26 - bei der aktuellen Gesamtrate von rund
64.000 Erfahrung je Stunde. Weg B ist in diesem Knoten nicht langsamer, er ist
unmoeglich. Damit ist Weg A nicht die bessere Wahl, sondern die einzige.

Engpass:           Zweistufig, und nur die erste Stufe laeuft gerade.
                   Stufe 1 (jetzt): Kampfwert-Tiefstand **67 von 100**.
                     In Erfahrung ueber alle vier Werte, weil ihre
                     Multiplikatoren verschieden sind (dex 1,4864 braucht
                     nur 98.774, str/def 1,2870 brauchen 223.671):
                     Restsumme **614.366 Erfahrung**.
                   Stufe 2 (danach): Bladeburner-Rang **0 von 400.000**,
                     netto 309.072 nach Abzug der 113.660 * 0,8 rankGain.

Rate:              1.072 Erfahrung/min, aus der Tiefstandsrate von 268/min
                   ueber 48 Minuten hochgerechnet (4 Werte im Gleichlauf).

ETA:               Stufe 1 **9,6 h** (gegen 16:45), Stufe 2 89-185 h.
                   Gesamt rund **99-195 h**.
                   Vorlauf 28.08., 21:45: Stufe 1 in 18,6 h, also gegen 16:20
                   heute. Praktisch unveraendert - und das ist ein ehrlicher
                   Befund, kein guter: Der Augmentierungs-Einbau um 04:15 hat
                   6,6 Stunden vernichtet, aber die acht Stuecke hoben die
                   Erfahrungsmultiplikatoren, und die Rate stieg von 13,25 auf
                   17,9/s. Der Fehler hat sich selbst bezahlt gemacht - was
                   ihn nicht richtig macht, denn geplant war er nicht.

Zur Selbstbeschleunigung: Fuer Stufe 1 gibt es keine, a = 0 ist hier richtig.
Die Gym-Rate haengt nicht an den Stufen (`Work/Formulas.ts:108-116`), und der
Bedarf waechst exponentiell im Level. Erst Stufe 2 hat die Rueckkopplung ueber
`skillPoints = floor(maxRank/3)`; dort gilt weiter a zwischen 0,4 und 0,6.

Leitgroesse:       Bis Tor 1 der **Kampfwert-Tiefstand** (67 von 100). Danach
                   **Bladeburner-Rang je Minute**, Ziel 400.000.

Entscheidung:      **Weiterfahren.** Beide Ausgaenge gerechnet, Weg B ist
                   ausgeschlossen; die ETA ist gegenueber dem Vorlauf nicht
                   gestiegen, die Abbruchregel greift nicht.

Naechste Pruefung: Sobald `inBladeburner` true meldet - erwartet gegen 16:45 -
                   die Rangrate ueber 45 Minuten glaetten und die Spanne
                   89-185 h durch eine gemessene ersetzen. Sie stammt aus
                   BitNode 6 und ist bisher nur mit 1/0,8 hochgerechnet.

---

## 29.08., 07:15 - BitNode 10, die Strecke NACH dem Tor

Geschrieben vom Vorankommensloop. Der Eintrag von 21:45 beziffert Tor 1 (die
vier Kampfwerte auf 100) und hoert dort auf. Was danach kommt, stand bisher
nur als Baustellenpunkt (03:45) und nirgends im Kurs - also fuhr der Bot auf
eine Strecke zu, deren Laenge er nicht kannte.

**Aus dem Quellcode gelesen, nicht gemessen:**

    Bladeburner/data/BlackOperations.ts   21 Black Ops
                                          max reqdRank   400.000
                                          Summe rankGain 113.660
    BitNode/BitNode.tsx, case 10          BladeburnerRank 0,8
    Bladeburner/Formulas.ts:8-26          Gewinn * Multiplikator,
                                          VERLUST ohne Multiplikator,
                                          reqdRank fest

**Netto-Strecke bis Daedalus (der letzte Black Op, reqdRank 400.000):**

    BitNode 10   400.000 - 113.660 * 0,8 = **309.072 Rang**
    BitNode 6    400.000 - 113.660       =   286.340 Rang

Also **+7,9 Prozent Netto-Strecke** gegenueber BitNode 6 - und weil auch die
laufende Rangrate mit 0,8 skaliert, **+25 Prozent Zeitbedarf** bei gleicher
Aktionsrate. Die BitNode-6-Erfahrung aus `nodes/ROUTE.md` (71-148 h) wird
damit zu **89-185 h** fuer diesen Knoten.

**Was das fuer die Fahrweise heisst - und was ausdruecklich NICHT:**

Die Feuerschwelle fuer Black Ops bleibt bei 0,35. Sie wurde am 28.08. um
16:00 nicht aus einem Erwartungswert hergeleitet, sondern aus der Zeit:
Rangverlust ist kein Bestandsverlust, weil `changeRank` gegen `maxRank`
vergibt und `maxRank` nie faellt (`Bladeburner.ts:1273,1283-1291`). Die
Kosten eines Fehlschlags sind `T_op + L / (m * Rangrate)`; in diesem Knoten
wird dieser Posten um ein Viertel teurer - bei Daedalus von 5,4 auf 6,8
Minuten. Dem stehen 78 bis 86 Minuten gegenueber, die Warten auf eine hoehere
Chance kosten wuerde. 1,4 Minuten gegen achtzig: die 0,35 bleiben richtig.

Leitgroesse bis Tor 1: unveraendert der **Kampfwert-Tiefstand** (66 von 100
um 07:07). Danach: **Bladeburner-Rang, 0 von 400.000**, Netto-Strecke
309.072.

Naechste Pruefung: Sobald `inBladeburner` true meldet, die tatsaechliche
Rangrate ueber 45 Minuten glaetten und die 89-185 h damit ersetzen. Die
Spanne stammt aus BitNode 6 und ist nur hochgerechnet.

---

## 28.08., 21:45 - BitNode 10 (KORREKTUR des Eintrags von 19:20)

Geschrieben vom Vorankommensloop, weil der Eintrag von 19:20 eine Leitgroesse
gesetzt hat, die einer Nachrechnung nicht standhaelt. Eine falsche Leitgroesse
kostet vier Loops zwoelf Stunden - das kann nicht bis 6:44 warten.

**Was 19:20 richtig war:** Der Multiplikator steht in `calculateSkill` vor
der Klammer, die Erfahrung im Logarithmus. Ein Kampf-Multiplikator von 2,0
statt 1,26 senkt den Bedarf von 1.019.268 auf 100.868 Erfahrung.

**Was fehlte:** der Preis. Zwei Posten, beide inzwischen gemessen.

  1. **Reputation.** Sie kostet Zeit, und zwar in derselben Waehrung: Der
     Spieler bringt bei Feldarbeit 29,6 Reputation je Minute
     (`reputation.ts:40-52` mit den heutigen Werten), waehrend sein
     Erfahrungsgewinn von 10 auf 5,04 je Sekunde faellt.
  2. **Welche Werte gehoben werden.** Von den zehn erreichbaren
     Kampf-Augmentierungen hebt **genau eine** str und def (Combat Rib I,
     Slum Snakes, 15.000 Reputation). Der Rest wirkt auf dex und agi - und
     das Tor ist der NIEDRIGSTE Wert.

Durchgerechnet mit gemessenen Raten (Details in `nodes/ERLEDIGT.md`, 21:45):

    Weg 3  nur Gym                                    **18,6 h**
    Weg 2  Feldarbeit bis Combat Rib I, Einbau, Gym    20,3 h
    Weg 1  Augmented Targeting I                       kein Gewinn

Engpass:           **Kampfwert-Tiefstand 66 von 100** - in Erfahrung 31.000
                   von 252.817 je Wert, also 12,3 %.

Restweg:           4 x (252.817 - 31.000) = **887.268 Erfahrung**.

Rate:              **13,25 je Sekunde** (Spieler 10 im Gym, Sleeve 3,25 ueber
                   `sync/100`). Gemessen 19:14 bis 19:16 und 20:57.

ETA:               **18,6 h fuer Tor 1.** Vorlauf 19:20: 21,8 h ohne
                   Zwischenschritt, 2,2 h mit - der zweite Wert war falsch.

Entscheidung:      **Weiterfahren.** Der Bot macht bereits das Richtige:
                   Spieler und Sleeve trainieren, niemand jagt Reputation.
                   Der Zwischenschritt von 19:20 wird zurueckgenommen.

Leitgroesse:       **Kampfwert-Tiefstand, jetzt 66 von 100.** NICHT
                   `mults.strength` - dieser Wert steht bis Tor 1 still, und
                   das ist richtig so.

Naechste Pruefung: Steigt der Tiefstand um mindestens 3 je halbe Stunde
                   (13,25/s auf vier Werte, logarithmische Kurve), traegt der
                   Weg. Bleibt er stehen, ist das Gym aus.

---

## 28.08., 19:20 - BitNode 10

Ausgangsbedingung: unveraendert gegenueber 18:55 - **21 Black Operations**
                   (`Singularity.ts:1148-1164`), Weg A (Hacking 6.000) bleibt
                   rechnerisch tot.

Engpass:           **Kampfwert-Tiefstand 42 von 100** = 42 %, Tor 1 zum
                   Bladeburner-Beitritt
                   (`NetscriptFunctions/Bladeburner.ts:356`). Gemessen in
                   Erfahrung ist der Stand schlechter als er aussieht: 6.723
                   von 254.817 je Wert, also **2,6 Prozent** - die Levelkurve
                   ist logarithmisch, die ersten 42 Level sind fast geschenkt.

Restweg:           4 x 254.817 minus rund 27.750 verdient = **991.500
                   Erfahrung**.

Rate:              **13 Erfahrung je Sekunde**, gemessen ueber ein
                   76-Sekunden-Fenster der SPIELZEIT (zwei Spielstaende,
                   19:14 und 19:16). Davon 10/s auf den gerade trainierten
                   Wert, der Rest aus den Shoplifts des Sleeves.

ETA:               **21,8 h fuer Tor 1 allein**, wenn nichts geaendert wird.
                   Vorlauf 18:55: "noch nicht messbar".

**Und genau deshalb ist die Entscheidung nicht "weiterfahren".**

`calculateSkill` ist `floor(mult * (32*ln(exp+534,6) - 200))`
(`PersonObjects/formulas/skill.ts:13`). Der Multiplikator steht **vor** der
Klammer, die Erfahrung **im Logarithmus** - ein besserer Multiplikator ist
also exponentiell mehr wert als mehr Training:

    mults.kampf   Erfahrung je Wert fuer 100    x4        bei 13/s
      1,26 (jetzt)          254.817          1.019.268     21,8 h
      1,50                   94.153            376.610      8,0 h
      1,75                   44.459            177.838      3,8 h
      2,00                   25.217            100.868      2,2 h
      2,50                   11.255             45.021      1,0 h

**Von 1,26 auf 2,00 spart 19,6 Stunden.** Das ist mehr, als eine
Augmentierungsrunde kosten kann - Geld steht bei 67 Mio und waechst, das Netz
bei 43 von 72.

Der Einbau setzt die Kampferfahrung auf null zurueck. Das ist hier kein
Einwand, sondern der Punkt: Die 100.868 Erfahrung DANACH sind ein Zehntel der
1.019.268 davor.

Entscheidung:      **Zwischenschritt: eine Kampf-Augmentierungsrunde vor dem
                   Beitritt.** Ziel ist `mults.strength/defense/dexterity/
                   agility` >= 2,0. Nicht weiterfahren - 21,8 Stunden Gym
                   gegen 2,2 sind kein Abwaegen mehr.

                   Zu beachten: BitNode 10 verteuert das
                   (`AugmentationMoneyCost` **5**, `AugmentationRepCost`
                   **2**, `BitNode.tsx` case 10). Welche Faktion und welche
                   Stuecke - das rechnet der Vorankommensloop; als Auftrag
                   eingetragen.

Leitgroesse:       **Kampf-Multiplikator `mults.strength` (und die drei
                   Geschwister), jetzt 1,2616, Ziel 2,0.** NICHT die
                   Erfahrung je Sekunde - die zu verdoppeln spart 11 Stunden,
                   den Multiplikator auf 2,0 zu bringen spart 19,6.

Naechste Pruefung: Steht `mults.strength` beim naechsten Lauf noch bei
                   1,2616, hat die Augmentierungsrunde nicht begonnen. Dann
                   ist die ETA fuer Tor 1 unveraendert 21,8 h - und das waere
                   das zweite Mal in Folge, also ein Fall fuer die
                   Abbruchregel.

---

## 28.08., 18:55 - BitNode 10

Geschrieben vom Optimierloop, nicht vom Kursloop: Der Eintrag darueber galt
noch fuer BitNode 6, und ein Kurs fuer den falschen Knoten ist schlechter als
keiner. Der Knoten wurde um 17:05 gewechselt.

Ausgangsbedingung: **Zwei Wege, ODER-verknuepft**
                   (`NetscriptFunctions/Singularity.ts:1148-1164`):
                   Hacking >= `wd.requiredHackingSkill` **mit** Root-Zugang,
                   ODER `numBlackOpsComplete >= 21`.
                   `WorldDaemonDifficulty` ist in BitNode 10 **2**
                   (`BitNode.tsx`, case 10), das Hackziel also **6.000**.

Das Modell ist geeicht: `calculateSkill` = `floor(mult * (32*ln(exp+534,6)
- 200))` (`PersonObjects/formulas/skill.ts:13`), wobei `mult` das Produkt
aus dem Spielermultiplikator und dem Knotenfaktor ist
(`Person.ts:62`). Mit `mults.hacking` 1,2616 und
`HackingLevelMultiplier` 0,35 ergibt das aus 42.542 Erfahrung **Level 62** -
gemessen 62. Fuer die Kampfwerte (Faktor 0,4) rechnet es 29 gegen gemessene 29.

**Weg A - Hacking auf 6.000.** Der Knotenfaktor 0,35 macht das Ziel zu einer
reinen Frage des Augmentierungs-Multiplikators:

    mults.hacking    benoetigte Erfahrung fuer Level 6.000
      1,26 (jetzt)   2,3e187
      5              1,8e49
     10              9,6e25
     20              2,2e14
     40              339.456.229      <- erst hier realistisch

Zum Vergleich der eigene BitNode-5-Lauf: Dort stand `HackingLevelMultiplier`
auf **1,0**, und Level 4.500 verlangte bei mult 20 nur 585.568 Erfahrung. Der
Unterschied ist nicht die Erfahrung, sondern der Faktor 0,35 - er verschiebt
den ganzen Bedarf um Zehnerpotenzen. Weg A verlangt also **zuerst einen
Augmentierungs-Multiplikator um 40**, und BitNode 10 verteuert genau das:
`AugmentationMoneyCost` **5**, `AugmentationRepCost` **2**.

**Weg B - 21 Black Operations.** Zwei Tore:

    Tor 1  Beitritt: alle vier Kampfwerte >= 100
           (`NetscriptFunctions/Bladeburner.ts:356`).
           Bei Kampffaktor 0,4 sind das **252.822 Erfahrung je Wert**
           gegen 2.613 heute. In BitNode 6 waren es 5.633 - also das
           **45-fache**, aber es ist Gym-Zeit und Geld, beides vorhanden.

    Tor 2  Daedalus, `reqdRank` **400.000**
           (`Bladeburner/data/BlackOperations.ts:708`). Die Schwelle ist
           knotenunabhaengig; gedaempft wird der ERTRAG:
           `BladeburnerRank` **0,8** multipliziert jeden Rangzuwachs
           (`Bladeburner/Formulas.ts:13, 22, 25`). 400.000 Rang kosten hier
           also so viel Arbeit wie 500.000 in BitNode 6.

Engpass:           **Weg B, und darin zuerst Tor 1.** Kampfwert-Tiefstand
                   **27 von 100**. Weg A ist nicht verworfen, sondern
                   nachgelagert: Er wuerde denselben Augmentierungsaufbau
                   verlangen, den Weg B ohnehin unterwegs mitnimmt, und dann
                   noch einen Multiplikator um 40 obendrauf.

Restweg:           Tor 1: 4 x 252.822 Erfahrung, davon 2.287 bis 2.708
                   verdient - also praktisch der volle Weg.
                   Tor 2: 400.000 Rang bei Faktor 0,8, plus die
                   Skillpunkte fuer die Black-Op-Chancen. In BitNode 6
                   brauchte Daedalus allein **84.441 Skillpunkte = 253.323
                   Rang** (siehe nodes/ERLEDIGT.md, 15:25) - bei niedrigeren
                   Kampfwerten hier eher mehr.

Rate:              Noch nicht messbar. Der Knoten ist 110 Minuten alt, die
                   Kampfwerte steigen gerade erst (27 bis 29), und ein
                   Gym-Lauf hat noch nicht stattgefunden.

Was daraus folgt fuer die anderen Loops:
  1. **`bbtrain.js` ist das naechste Werkzeug**, nicht `blade.js`. Solange
     der Tiefstand unter 100 liegt, traegt das Training.
  2. Der Sleeve gehoert perspektivisch ins Gym oder auf Bladeburner-Support -
     seine Erfahrung faellt beim Spieler mit `sync/100` an
     (`Sleeve/Work/Work.ts:22`), in BitNode 10 mindestens 25 Prozent.
  3. Geld ist in dieser Phase **kein** Engpass (55 Mio bei 42 von 71
     Rechnern), Rechenzeit auch nicht. Zeit ist es.

---

## 28.08., 07:15 - BitNode 6

Ausgangsbedingung: **21 Black Operations.** `destroyW0r1dD43m0n` prueft
                   `numBlackOpsComplete >= numberOfBlackOperations`
                   (`NetscriptFunctions/Singularity.ts:1154-1158`); die letzte
                   (Daedalus) verlangt `reqdRank` **400.000**
                   (`Bladeburner/data/BlackOperations.ts:708`).
                   Der zweite Weg - Hacking >= `wd.requiredHackingSkill`
                   (6.000) MIT `hasAdminRights` - bleibt verworfen: bei
                   `HackingLevelMultiplier` 0,35 verlangt
                   `level = floor(mult*(32*ln(exp)-200))` ein `exp` von e^184.

Engpass:           Bladeburner-Rang. **80.706 von 400.000 = 20,2 %.**
                   Aussagekraeftiger ist der Anteil an der ARBEIT, weil die
                   Black Ops sich selbst mitfinanzieren: Von den 400.000 kommen
                   **73.660** aus den `rankGain`-Werten der ersten zwanzig
                   Operationen, es bleiben also **326.340** aus gewoehnlichen
                   Aktionen. Davon sind 79.796 verdient - **24,5 %.**

Restweg:           **246.544 netto.** 400.000 minus 80.706 Rang minus die
                   **72.750**, die die Black Ops 8 bis 20 unterwegs noch selbst
                   einbringen (aus der Tabelle erzeugt, nicht geschaetzt).

Rate:              **226,5 Rang je Minute**, geglaettet ueber **229 Minuten**
                   (`data/verlauf-strategie.json`, 03:25-07:14, 28.876 auf
                   80.706). Das Fenster schliesst den Augmentierungs-Einbau von
                   05:53 samt Wiederaufbau **ein** - genau deshalb ist es das
                   richtige. Zum Vergleich, dieselbe Reihe:

                       229 min   226,5/min   (mit Einbau)
                       132 min   224,6/min   (mit Einbau)
                        41 min    34,5/min   (nur Wiederaufbau)
                       Nacht     442,0/min   (nur Spitzenphase)

                   **Eine Rate ohne Einbaupause ueberschaetzt den Fortschritt
                   um Faktor 8.** Die 442 der Nacht sind keine Reisegeschwindig-
                   keit, sondern eine Momentaufnahme zwischen zwei Einbauten.

ETA:               **13,3-18,1 h**, Mitte rund **15,4** (a = 0,6 / 0,44 / 0).
                   Vorlauf: **71-148 h**, Mitte 104. **Faktor 6,7 besser.**

                   Die Selbstbeschleunigung ist belegt, aber sie ist nicht
                   allein Rueckkopplung: 32,75/min bei Rang 9.083 gegen
                   442/min bei 51.000 waere a = 1,51 - das ist zu steil, weil
                   in dieser Zeit vier bewusste Hebel eingebaut wurden
                   (Assassination als Rangfahrzeug, Overclock, Chaos-
                   Folgekosten, Cyber's Edge). a = 0 bis 0,6 ist die
                   ehrliche Spanne.

Leitgroesse:       **Bladeburner-Rang je Minute, gemessen ueber mindestens
                   45 Minuten und EINSCHLIESSLICH der Wiederaufbaupausen nach
                   einem Einbau.** Der Zusatz ist neu und er ist der Kern
                   dieses Laufs: Wer nur die Spitzenphase misst, optimiert
                   gegen eine Zahl, die achtmal zu gross ist - und uebersieht
                   damit genau den Posten, der gerade der groesste ist.

Entscheidung:      **Weiterfahren.** Der Kurs stimmt, die ETA ist von 104 auf
                   15,4 Stunden gefallen. Kein Zwischenschritt noetig: Die
                   Augmentierungsrunde, die der Eintrag vom 27.08. vorbereiten
                   wollte, ist zweimal gelaufen (01:25 mit 25 Stueck, 05:53),
                   und der Bot loest sie selbst aus.

                   Der einzige verbliebene Bremsklotz ist die Wiederaufbau-
                   phase nach jedem Einbau. Sie wird mit jedem Einbau laenger,
                   weil die AKTIONSSTUFE ihn ueberlebt und die Kampfwerte
                   nicht - Assassination steht auf Stufe 20 und verlangt Werte,
                   die der Wiederaufbau erst wieder erreichen muss. Das ist
                   bereits als Hebel adressiert (07:00, Gym laeuft jetzt
                   parallel weiter), gehoert aber dauerhaft in die ETA.

Naechste Pruefung: Liegt die 45-Minuten-Rate wieder ueber 220/min, also ist der
                   Wiederaufbau vorbei? Faellt Operation Red Dragon (Nr. 8 von
                   21, `reqdRank` 25.000 laengst erfuellt, Chance zuletzt
                   0,780-1,000)? Und ist die ETA erneut gesunken - zweimal
                   steigend hiesse, der Knoten wird falsch gefahren.

---

## 27.08., 19:22 - BitNode 6

Ausgangsbedingung: **21 Black Operations**, die letzte (Daedalus) verlangt Rang
                   **400.000** (`Bladeburner/data/BlackOperations.ts`,
                   Freigabe über `destroyW0r1dD43m0n`,
                   `NetscriptFunctions/Singularity.ts:1148-1160`).
                   Der zweite Weg — Hacking ≥ 6.000
                   (`requiredHackingSkill 3000` × `WorldDaemonDifficulty 2`) —
                   ist **geprüft und verworfen**: bei
                   `HackingLevelMultiplier 0,35` verlangt
                   `level = floor(mult·(32·ln(exp) − 200))` ein `exp` von
                   e^184. Dazu 35 statt 30 Augmentierungen für Daedalus.

Engpass:           Bladeburner-Rang. **9.083 von 400.000 = 2,3 %**
                   (Stand 19:10). Nicht die Erfolgschance — der Rang für
                   Typhoon ist um Faktor 3,6 übererfüllt.

Restweg:           **317.257 netto.** Die ersten zwanzig Black Ops liefern
                   zusammen 73.660 Rang aus ihren eigenen `rankGain`-Werten;
                   die zählen mit und wurden vorher doppelt gerechnet.

Rate:              **32,75 Rang je Minute**, geglättet über 45 Minuten
                   (`data/wache-zustand.json`, 18:26–19:11). Über den ganzen
                   Knoten gemittelt waren es 2,3 — Faktor 14 Anstieg.

ETA:               **71–148 h**, Mitte rund 104 (a = 0,3 / 0,44 / 0,6).
                   | Vorlauf: (erster Eintrag)
                   Die Rate beschleunigt sich selbst: `skillPoints =
                   floor(maxRank/3)` bei linear steigenden Fähigkeitskosten
                   (`Bladeburner/Skill.ts:37-41`) heißt Stufe ~ √Rang, also
                   `dR/dt ~ R^a`. Eine lineare Fortschreibung (a = 0) ergäbe
                   443 h und ist durch die eigene Messreihe widerlegt.

Leitgröße:         **Bladeburner-Rang je Minute.** Jeder Hebel, der sie hebt,
                   zahlt direkt auf die 317.257 ein. Die Black-Op-Chance ist
                   ausdrücklich **nicht** die Leitgröße — sie ist über weite
                   Strecken unkritisch, weil der Rang der Engpass ist.
                   **Zweitgrößte:** Geld je Minute, weil es die
                   Augmentierungsrunde finanziert (siehe Entscheidung).

Entscheidung:      **Zwischenschritt vorbereiten: eine Augmentierungsrunde.**
                   In BitNode 6 überlebt der Bladeburner-Fortschritt einen
                   Einbau fast vollständig — `Prestige.ts:153-154` ruft
                   `Bladeburner.prestigeAugmentation()`
                   (`Bladeburner.ts:259-263`), und das macht **nur**
                   `resetAction()` + `joinFaction()`. Rang, `skillPoints`,
                   Fähigkeits- und Aktionsstufen bleiben stehen; es fallen
                   allein die Kampfwerte. Die kommen mit besseren
                   Multiplikatoren um **Faktor 17** schneller zurück, weil die
                   Stufe multiplikativ im Multiplikator, aber nur logarithmisch
                   in der Erfahrung steckt
                   (`PersonObjects/formulas/skill.ts:13`): Stufe 1.000 bei
                   mult 1,0 verlangt exp = e^37,5; bei mult 1,1 genügt e^34,6.
                   Reputation reicht (≥13.820 aus Rang 9.083 bei
                   `RankToFactionRepFactor 2`), **Geld ist der Engpass**:
                   INTERLINKED 5,5 Mrd, Golem Serum 11 Mrd, Omnibeam 27,5 Mrd
                   gegen einen Kontostand von 3,2 Mrd.

Nächste Prüfung:   Ist die ETA gesunken? Steht die Geldrate wieder über
                   10 Mio/min (um 19:11 war sie von 22,9 auf 1,3
                   eingebrochen, Ursache offen)? Reicht das Guthaben für die
                   erste Augmentierung?
