# BitNode-Roadmap (Fassung 4, 22.08.2026)

> **UEBERHOLT SEIT 23.08.2026 - Abschnitt 4.1 und Abschnitt 6.**
>
> Abschnitt 4.1 extrapoliert die Erfahrungsrate nur ueber RAM und haelt dabei
> `hacking_exp` bei 1,39 fest, waehrend dieselbe Tabelle `mults.hacking` auf
> 26,8 zieht. Beides kommt aus denselben Augmentierungen, die real
> `hacking_exp` 15,32 und `hacking_speed` 3,63 tragen - Faktor 300 bis 3.000
> auf jede Zeile. Kein BitNode ist unter dem Hacking-Weg unerreichbar; die
> Begruendung fuer die Bladeburner-Route und damit fuer BN6 auf Platz 2
> faellt. **Massgeblich ist `nodes/ROADMAP-KORREKTUR.md`.**
>
> Unberuehrt bleiben: BN4 zuerst, BN8 zuletzt, und der strukturelle Vorteil
> von Bladeburner (sein Fortschritt ueberlebt den Augmentierungs-Einbau).

Dritte Ueberarbeitung nach adversarieller Pruefung. Route, Reihenfolge und
V2-als-Hauptverfahren sind seit Fassung 3 unbestritten und unveraendert; diese
Fassung korrigiert Zahlen und den Betriebsteil. Die BN4-Planerabstimmung liegt
in [`nodes/bn4/PLANER.md`](bn4/PLANER.md) — sie gilt fuer einen Knoten, dieses
Dokument fuer 520-900 Stunden.

**Belegarten.** Jede tragende Aussage ist gekennzeichnet:
**[belegt]** = Quelltext, Datei:Zeile · **[gemessen]** = an der laufenden
Spielinstanz ueber die Bruecke auf Port 8795 gemessen ·
**[gerechnet]** = aus belegten Formeln abgeleitet, mit genannten Annahmen ·
**[zu bauen]** = existiert noch nicht.

**Quelltextbaum.** `reference/bitburner-src/` meldet sich als **v3.0.2**
(`Constants.ts:7`), nicht 3.0.1. Zeilennummern koennen abweichen; im Zweifel
im selben Block suchen.

**Namensfalle v3.** Die Server-Kauf-API heisst `ns.cloud.*`
(`NetscriptFunctions/Cloud.ts`), die Multiplikatoren `CloudServerCost`,
`CloudServerSoftcap`, `CloudServerLimit`, `CloudServerMaxRam`
(`BitNodeMultipliers.ts:131-140`). `PurchasedServer*` existiert nicht mehr.

---

## 1. Zielfunktion

> **Minimiere die Gesamt-Wanduhrzeit bis alle 15 BitNodes mindestens einmal
> abgeschlossen sind.**

1. **Ein Wiederholungslauf zaehlt null.** Er ist nur richtig, wenn er die
   Restzeit aller offenen Knoten um **mehr** verkuerzt, als er selbst kostet.
   Diese Huerde wird unten genau einmal gerissen (BN10, 6.2).
2. **Uebertragbar sind vier Dinge:** Source-Files, persistente Intelligence ab
   SF5 (`Person.ts:149-190`) [belegt], die Anzahl der Sleeves
   (`SleeveCovenantPurchases.tsx:58-73`) [belegt], und **der Bot-Code auf
   `home`** (5.1) [belegt].
3. **Zeit ist die Waehrung**, nicht Geld und nicht Level. Ein Betrag, der in
   einer Viertelstunde verdient ist, ist kein Argument.
4. **Gleichfoermigkeit ist ein Wert.** Ein Verfahren fuer 13 von 14 Knoten
   schlaegt zwei Verfahren fuer 14.

**Offen sind 14 Knoten**: BN2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15 plus
den laufenden BN4. **BN1 ist erledigt** (SF1 Level 1 liegt vor).

---

## 2. Abschlussmechanik

`ns.singularity.destroyW0r1dD43m0n` (`Singularity.ts:1124-1176`) [belegt]
prueft ein ODER:

```ts
const hackingRequirements = () => {
  if (Player.skills.hacking < wd.requiredHackingSkill || !wd.hasAdminRights) return false;
  return true; };
const bladeburnerRequirements = () => {
  if (!Player.bladeburner) return false;
  return Player.bladeburner.numBlackOpsComplete >= numberOfBlackOperations; };
```

### 2.1 Der Hacking-Weg (V1) braucht The Red Pill, nicht nur ein Level

Die alte Fassung nannte nur `3000 x WorldDaemonDifficulty`. Das ist die
letzte Huerde, nicht die einzige. Vollstaendig [belegt]:

| Schritt | Anforderung | Beleg |
|---|---|---|
| a) Daedalus-Einladung | **30 installierte Augmentierungen** (BN6/7: 35, BN15: 20, BN12: `floor(min(30 + 1.02^lvl, 40))` = 31), **$100 Mrd**, **Hacking 2500 ODER alle Kampfwerte 1500** | `FactionInfo.tsx:138-149`, `FactionJoinCondition.ts:116-131` |
| b) The Red Pill | **2.500.000** Daedalus-Reputation, Geldpreis $0 | `Augmentations.ts:1953-1960` |
| c) TRP **einbauen** | erst dabei wird `w0r1d_d43m0n` ans Netz gehaengt | `Prestige.ts:173-181` |
| d) Root auf `w0r1d_d43m0n` | **5 offene Ports** + NUKE ($287,0 Mio Programme + TOR $200k) | `servers.ts:1547-1556`, `DarkWebItems.ts:6-10` |
| e) Hacking >= `3000 x WDD` | | `ServerHelpers.ts:422-424` |

Schritt (c) ist der Punkt, den weder die alte Fassung noch einer der drei
Skeptiker hatte. `w0r1d_d43m0n` bekommt in `initForeignServers` **keine
Netzwerkebene**; erst `Prestige.ts:173-181` verbindet ihn mit `The-Cave`, und
nur bei installiertem TRP. Ohne diese Kante wirft `helpers.getServer`
(`NetscriptHelpers.tsx:554-570`, Bedingung `serversOnNetwork.length > 0`) —
**`ns.nuke("w0r1d_d43m0n")` ist ohne TRP nicht ausfuehrbar**, also kann
`wd.hasAdminRights` nie wahr werden. Auch mit SF4.

**Folge:** V1 kostet in jedem Knoten einen **festen Sockel** — 30
Augmentierungen, $100 Mrd, 2,5 Mio Reputation, ein zusaetzlicher Aug-Reset,
fuenf Portprogramme — **plus** den knotenabhaengigen Levelaufbau.

### 2.2 Der Bladeburner-Weg (V2) prueft eine Zahl

`numBlackOpsComplete >= 21` (`BlackOperations.ts:735`) [belegt]. Keine
Reputation, kein Geld, keine Augmentierung, kein Hacking-Level, kein Daedalus,
kein TRP.

---

## 3. Die drei Streitentscheidungen

| Frage | Entscheidung | Beleg |
|---|---|---|
| **Bladeburner-Zugang** | **Skeptiker 1 hat recht.** `canAccessBladeburner = (canAccessBitNodeFeature(6) \|\| canAccessBitNodeFeature(7)) && !disableBladeburner`, mit `canAccessBitNodeFeature(n) = bitNodeN === n \|\| activeSourceFileLvl(n) > 0`. Also: **in BN6/BN7 selbst ohne jedes Source-File, sonst nur mit SF6/SF7.** Nicht "in jedem Node ausser BN8". In BN8 zusaetzlich tot (`BladeburnerRank 0`). Beitritt braucht 4x100 Kampfwerte, sonst nichts. | `PlayerObjectBladeburnerMethods.ts:6-8`, `BitNodeUtils.ts:17-19`, `SpecialLocation.tsx:105-113`, `BitNode.tsx:784` |
| **Position 2/3: BN1 / BN5 / BN8** | **Alle drei hinfaellig.** BN1 ist abgeschlossen. BN5 rueckt vor, aber wegen `formulas.exe` gratis + Intelligence-Tor, nicht wegen der Schwelle. BN8 gehoert ans **Ende**: einziger Knoten ohne V2, ohne Gang (`GangSoftcap 0`), ohne Corporation, mit `ScriptHackMoneyGain 0`, `CrimeMoney 0`, `CodingContractMoney 0`. | `Prestige.ts:93-95, 268-270`, `Person.ts:154-159`, `BitNode.tsx:764-794` |
| **SF4-x16 in BN4** | **Skeptiker 3 hat recht — und es ist kein Widerspruch.** `SF4Cost` steigt bei `Player.bitNodeN === 4` sofort mit `return cost` aus, vor jeder SF-Pruefung. In BN4 also immer x1. Ausserhalb: SF4 <= 1 -> x16, SF4 = 2 -> x4, SF4 >= 3 -> x1. Skeptiker 2 sprach vom Folge-Node, Skeptiker 3 von BN4; beide korrekt. Der Fehler lag beim Zitat `82-92` der alten Fassung, richtig ist **82-96**. | `RamCostGenerator.ts:82-96` |

Praktische Folge der dritten Zeile: `getRamCost` wertet bei jeder Abfrage neu
aus (`:772`), und genau deshalb setzt `Prestige.ts:232-233` beim Node-Wechsel
`script.ramUsage = null`. **Dieselbe Datei kostet in BN4 33,6 GB und in BN5
513,6 GB.** [belegt] [gemessen, siehe 7.3]

---

## 4. Die drei Verfahren und ihre Kosten

Die alte Fassung sortierte nach `WorldDaemonDifficulty`. Der korrigierte
Schluessel `Schwelle / HackingLevelMultiplier` ist zwar richtig gerechnet, misst
aber nur V1. Der Schluessel dieser Fassung:

> **Sortiere nach der Wanduhrzeit des billigsten VERFUEGBAREN Verfahrens —
> unter Beruecksichtigung, dass ein Knoten Verfahren fuer alle spaeteren
> Knoten freischaltet.** Das ist ein Ablaufproblem mit Freischaltungen, keine
> Formel.

### 4.1 V1 — Hacking/Daedalus (immer verfuegbar, Rueckfallweg fuer jeden Knoten)

**Diese Tabelle bleibt vollstaendig, weil V1 in BN8 der einzige Weg ist und
bei jedem V2-Fehlschlag der Rueckfall.**

`skill.ts:13`: `level = floor(mult * (32*ln(exp+534.6) - 200))`, umgekehrt
`exp = e^((level/mult + 200)/32) - 534.6`, mit
`mult = Player.mults.hacking * currentNodeMults.HackingLevelMultiplier`
(`Person.ts:60-63`) [belegt].

**Die Obergrenze des Aug-Multiplikators, korrekt gefiltert.** Fassung 3
nannte hier 43,49 und leitete daraus "50 bis 85" ab. **Beides war falsch** —
die Rohzahl war ungefiltert. Neu ausgezaehlt (Klammer-Matching ueber
`Augmentations.ts`, 136 Bloecke) [gerechnet]:

| Menge | Anzahl | Produkt |
|---|---|---|
| alle Bloecke mit `hacking`-Feld (Rohwert) | 31 | 43,49 |
| davon **nie erreichbar**: `BigDsBigBrain` x2,0 — kein `factions`-Eintrag, und im ganzen Baum keine Vergabestelle ausser der Definition selbst | 1 | /2,0 |
| davon **nur ueber das Darknet**: `TheSword` x1,1 (`DarkNet/effects/labyrinth.ts:411`) | 1 | /1,1 |
| davon **freiwillig vermeidbare Malusse**: `StaneksGift1` x0,90, `StaneksGift2` x0,95 | 2 | /0,855 |
| **-> ueber Faktionen realistisch kaeuflich** | 27 | **23,1** |
| **-> was eine GANG-Fraktion anbietet** (Filter `!a.isSpecial`, s. u.) | 25 | **22,9** |

Mit SF1.1 (`applySourceFile.ts:14-46`, `incMult = 1,16` auf `mults.hacking`)
sind das **26,8** bzw. **26,6**. **Die m=25-Spalte unten ist damit praktisch
die Obergrenze des Aug-Wegs, nicht ein "guter Ausbau".** Darueber hinaus wirkt
nur noch NeuroFlux (`1,01^level`, aber `1,14^level` auf Preis und Reputation).

Bemerkenswert: die Gang allein kommt auf 1 % an das heran, was alle Faktionen
zusammen hergeben.

| BN | WDD | HackLvlMult | Zielevel | eff. Schwelle | EXP bei m=10 | bei m=25 | HackExpGain |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 1 | 3000 | 3.000 | 6,1e6 | 2,1e4 | 1 |
| 8 | 1 | 1 | 3000 | 3.000 | 6,1e6 | 2,1e4 | 1 |
| 12 (lvl1) | 1.02 | 0.980 | 3060 | 3.121 | 8,9e6 | 2,5e4 | 0.98 |
| 5 | 1.5 | 1 | 4500 | 4.500 | 6,6e8 | 1,4e5 | 0.5 |
| 3 | 2 | 0.8 | 6000 | 7.500 | 7,8e12 | 6,1e6 | 1 |
| 11 | 1.5 | 0.6 | 4500 | 7.500 | 7,8e12 | 6,1e6 | 0.5 |
| 4 | 3 | 1 | 9000 | 9.000 | 8,5e14 | 4,0e7 | 0.4 |
| 15 | 2 | 0.6 | 6000 | 10.000 | 1,9e16 | 1,4e8 | 1 |
| 9 | 2 | 0.5 | 6000 | 12.000 | 1,0e19 | 1,7e9 | **0.05** |
| 6 / 7 / 10 | 2 | 0.35 | 6000 | 17.143 | 9,6e25 | 1,0e12 | 0.25/0.25/1 |
| 2 | 5 | 0.8 | 15000 | 18.750 | 1,5e28 | 7,8e12 | 1 |
| 13 | 3 | 0.25 | 9000 | 36.000 | 3,7e51 | 1,8e22 | **0.1** |
| 14 | 5 | 0.4 | 15000 | 37.500 | 4,1e53 | 1,2e23 | 1 |

Rechnung vorgefuehrt, BN13 bei m=10: `mult = 10*0,25 = 2,5`,
`exp = e^((9000/2,5+200)/32) - 534,6 = e^118,75 = 3,7e51`.

Alle 13 WDD-Werte an den `case`-Grenzen `BitNode.tsx:566/569/593/627/657/688/
722/764/795/838/883/918/991/1040/1085` geprueft; **BN1 und BN8 haben keinen
Eintrag** (= 1,0) [belegt].

**Zeitschaetzung V1:** Sockel 25-50 h (davon 10-24 h allein Daedalus-Rep, aus
`reputation.ts:16-24` gerechnet) plus Levelaufbau.

**Wo V1 ueberhaupt realistisch ist.** Fassung 4 rechnete hier mit
**129.640 EXP/s** aus `data/tick-last.json`. **Diese Zahl wird
zurueckgezogen** — Begruendung am Ende des Abschnitts. Statt ihrer zwei Werte,
die sich am laufenden Spielstand belegen lassen [gemessen]:

- **Analytische Obergrenze heute:** bestes Erfahrungsziel mal alle verfuegbaren
  Faeden = **~1,1e3 EXP/s** bei 6.508 GB Netz.
- **Tatsaechlich gefahren:** aus `data/watch-verlauf.json` ueber 26 Fenster von
  je >= 5 min, Hacking-Level nach `skill.ts:19` in Erfahrung zurueckgerechnet,
  mit dem **echten** Spielermultiplikator **1,39** (aus dem Spielstand, nicht
  geschaetzt): **Median 42 EXP/s, bestes Fenster 282 EXP/s.** Der Abstand zur
  Obergrenze ist genau der Planerbefund aus `PLANER.md` — nur rund 5 % des RAM
  liegt auf dem Erfahrungsziel.

**Arbeitsband: 1e2 bis 1e3 EXP/s beim heutigen Netz.** Die Rate skaliert
linear mit der Zahl der Faeden — `calculateHackingExpGain` haengt nur von
`baseDifficulty` und den Multiplikatoren ab, **nicht** vom Level
(`Hacking.ts:30-38`) [belegt]. Eine Farm der Groessenordnung des BN1-Endstands
(5,3 PB, rund 800-fach) traegt entsprechend **1e5 bis 1e6 EXP/s**.

| eff. Schwelle | Knoten | noetige EXP bei m=26,8 | bei 1e3 EXP/s (heutiges Netz) | bei 1e5 EXP/s (ausgebaute Farm) |
|---|---|---|---|---|
| 3.000-4.500 | BN1, BN8, BN12, BN5 | 1,7e4 - 9,9e4 | 17 s - 2 min | Sekunden |
| 7.500 | BN3, BN11 | 3,3e6 | **55 min - 9 h** | 33 s |
| 9.000 | BN4 | 1,8e7, **/0,4** = 4,5e7 | **12 - 125 h** | 7 min |
| 10.000 | BN15 | 5,9e7 | **16 - 164 h** | 10 min |
| 12.000 | BN9 | 6,0e8, **/0,05** = 1,2e10 | 3.300 h | 33 h — aber in BN9 waechst die Farm nicht (`CloudServerLimit 0`) |
| 17.143 | BN6, BN7, BN10 | 2,4e11 | 67.000 h | 670 h |
| 18.750 | BN2 | 1,6e12 | 444.000 h | 4.400 h |
| >= 36.000 | BN13, BN14 | >1e19 | aussichtslos | aussichtslos |

**Der Schnitt ist eine Bandbreite, keine Zahl: effektive Schwelle 4.500 bis
12.000.** Wo er genau liegt, haengt daran, wie weit die Farm im jeweiligen
Knoten gebaut ist — und die Farm haengt am Geld, das in genau den gedaempften
Knoten selbst der Engpass ist. Daraus drei Klassen:

| Klasse | Knoten | Bedeutung |
|---|---|---|
| **V1 unbedingt tragfaehig** (<= 4.500) | BN1, BN5, BN8, BN12 | Levelaufbau ist Minuten, der Sockel ist die ganze Arbeit |
| **V1 nur mit ausgebauter Farm** (7.500 - 10.000) | BN3, BN4, BN11, BN15 | 1 bis 7 Tage beim heutigen Netz, Minuten bei 1e5 EXP/s. **Kein verlaesslicher Rueckfall**, sondern eine Wette auf den Farmausbau |
| **V1 aussichtslos** (>= 12.000) | BN2, BN6, BN7, BN9, BN10, BN13, BN14 | auch mit ausgebauter Farm hunderte bis tausende Stunden |

**Fuer die Route aendert das nichts:** der einzige geplante V1-Knoten ist BN8
mit effektiver Schwelle 3.000, also tief in der ersten Klasse. Fuer den
**Rueckfall** aendert es einiges — siehe 6.3.

**Zur zurueckgezogenen Zahl.** `data/tick-last.json` stammt vom 21.08. aus
**BitNode 1** bei `ramMax: 5.311.204` GB und `hack: 1`; der Bot hat heute
6.508 GB, also 0,12 % davon. Fassung 2 und 3 dieses Dokuments haben die Datei
ausdruecklich als Blindgaenger bezeichnet — "wer sie fuer eine Modellrechnung
heranzieht, liegt um Faktor 800 daneben" — und Fassung 4 hat sie dann selbst
zur tragenden Zahl gemacht. **Es gilt die frueherer Warnung: die Datei taugt
nicht als Quelle.** Sie bleibt in `PLANER.md` als zu loeschender Blindgaenger
vermerkt. Beides gleichzeitig ging nicht, und die Warnung war richtig.

### 4.2 V2 — Bladeburner (nach SF6/SF7 ueberall ausser BN8)

**Die Zahlen aus Fassung 2 (15-40 h) waren zu optimistisch. Hier die
korrigierten.** [gerechnet]

Die Ratenbegrenzung ist **nicht** die Aktionsdauer, sondern `count` — die Zahl
verfuegbarer Auftraege. Nachwachsen: `count += sekunden * growth / 480`
(`Bladeburner.ts:1385-1392`, `ActionCountGrowthPeriod: 480`) [belegt]. Zwei
Beschleuniger:

- **Incite Violence:** `count += 60*3*growth/480` je Ausfuehrung, dauert 60 s
  (`Bladeburner.ts:1218-1233`) [belegt]. Wirkt **gratis**, solange es reine
  Leerlaufzeit fuellt.
- **Sleeve-Infiltration:** `count += n^(-0.5)/2` je Sleeve-Zyklus, also in
  Summe `sqrt(n)/2` je 60 s auf **jede** Aktion (`Bladeburner.ts:1251-1263`)
  [belegt].

**Ereignisgesteuerte Simulation** (eine Aktion zur Zeit, gierig nach
Rang/Zeit; Aktionsdaten aus `data/Operations.ts` und `data/Contracts.ts`;
Aktionszeit nach `Actions/Action.ts:104-122`; Stufenaufstieg nach
`LevelableAction.ts:49-63`; Rangertrag nach `Formulas.ts:9-28`; Kampfwerte
1000, **Overclock auf Maximalstufe 90**, Erfolgsrate 1,0):

| Sleeves | Rang 400.000 bei BladeburnerRank 1,0 / 0,9 / 0,8 / 0,6 / 0,45 / 0,2 | IV-Zeitanteil |
|---|---|---|
| **0** | **48** / 52 / 57 / 71 / 87 / 154 h | 45 % |
| **1** (SF10.1) | **29** / 32 / 35 / 44 / 54 / 94 h | 15 % |
| 2 (SF10.2) | 25 / 27 / 30 / 37 / 45 / 78 h | 3 % |
| 3 (SF10.3) | 22 / 24 / 26 / 32 / 40 / 68 h | 0 % |
| 8 (nur BN10, $10e12+ je Sleeve) | 16 / 17 / 19 / 23 / 29 / 51 h | 0 % |

**Vorbehalt Raid** (beim Filter-Audit gefunden, 8.5): `Raid` ist die
ertragreichste Aktion des Modells und die **einzige** mit einer
Zusatzbedingung — `getAvailability` verlangt `city.comms >= 1`
(`data/Operations.ts:147-150`), und erfolgreiche Raids senken `comms`. Meine
Simulation modelliert das nicht. Obergrenze, wenn Raid **nie** verfuegbar
waere (kein Stadtwechsel, comms erschoepft):

| Sleeves | Faktor 1,0 / 0,8 / 0,6 / 0,45 / 0,2 |
|---|---|
| 0 | 84 / 99 / 122 / 149 / 254 h |
| 1 | 45 / 53 / 65 / 80 / 135 h |
| 3 | 33 / 39 / 48 / 58 / 97 h |

Der wahre Wert liegt dazwischen — sechs Staedte, `switchCity` per API, und
`comms` waechst nach. **Die Routentabelle rechnet mit der Raid-Zeile; die
Zeitgrenze aus 6.3 (Doppeltes der Schaetzung) deckt die Raid-freie Zeile mit
ab.**

Ohne Overclock werden aus 48 h **128 h**. Overclock 90 kostet **5.877
Skillpunkte** = Rang 17.631 (`Skills.ts:44-53`, `Constants.ts:47`
`RanksPerSkillPoint: 3`) [belegt], also **4,4 %** des Rangbudgets.
**Overclock zuerst kaufen ist Pflicht, nicht Kuer.**

Zur Rechnung: `Skill.calculateCost` rundet **einmal am Ende**, nicht je Stufe
— die ausfuehrbare Zeile schliesst mit `Math.round(count * mult * (baseCost +
costInc * (currentLevel + (count-1)/2)))` (`Skill.ts:76-80`). Der lange
Kommentarblock darueber (`Skill.ts:37-75`) eroertert Floor gegen Round und
entscheidet sich ausdruecklich fuer die geschlossene Form mit Round. Fassung 4
hatte daraus faelschlich ein `Math.floor` je Stufe gelesen und 5.840 gerechnet
— ein Kommentar ist kein Beleg, die ausfuehrbare Zeile ist einer.

**Kampfwerte sind fast irrelevant** — 1000 gegen 3000 aendert die Gesamtzeit
um unter 2 %. Grund: die Aktionszeit haengt ueber
`statFac = 0.5*(agi^0.04 + dex^0.035 + agi/1e4 + dex/1e4)` extrem schwach von
den Werten ab, und die Zeit ist ohnehin nicht der Engpass. (Siehe 8.3 zur
Nachforderung von Skeptiker 1.)

**Rang-Multiplikatoren** (`BitNode.tsx`, fehlender Eintrag = 1.0) [belegt]:

| BN | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BladeburnerRank | 1 | 1 | 1 | 1 | 1 | **1** | 0.6 | **0** | 0.9 | 0.8 | 1 | `1/1.02^lvl` | 0.45 | 0.6 | **0.2** |
| BladeburnerSkillCost | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 1 | 1.2 | 1 | 1 | `1.02^lvl` | 2 | 2 | **3** |

**BN6 hat keinen Malus** — BN7 hat ihn. Die 21 Black Ops selbst kosten danach
rund eine Stunde; `Operation Daedalus` verlangt Rang 400.000
(`BlackOperations.ts:708-711`), jeder Black Op mindestens ein Teammitglied
(`BlackOperation.ts:63-65`) [belegt].

**V2 ist voll per API steuerbar** (`NetscriptFunctions/Bladeburner.ts`:
`joinBladeburnerDivision` prueft SF/Rang/Kampfwerte selbst — kein Klick, keine
Reise), **ohne SF-Skalierung der RAM-Kosten** (`BladeburnerApiBase = 4`,
`RamCostGenerator.ts:61, 337-379`). Field Analysis ist ueberfluessig: der
Erfolgswurf nutzt `city.pop`, nicht `popEst` (`Action.ts:88-92`). [belegt]

### 4.3 V3 — Gang (Beschleuniger fuer V1)

Zugang: **BN2 ohne SF2 und ohne Karma**, sonst SF2 + Karma <= -54.000
(`PlayerObjectGangMethods.ts:12-30`) [belegt]. Die Gang erzeugt
Fraktions-Reputation direkt:
`playerReputation += faction_rep * respectGain * (1+favor/100) / 75`
je 200-ms-Zyklus (`Gang.ts:151-155`, `GangConstants.GangRespectToReputationRatio = 75`)
[belegt]. Und: eine Gang-Fraktion bietet die Augmentierungen **aller**
Fraktionen an, in BN2 **einschliesslich The Red Pill** — aber **gefiltert**:

```ts
// FactionHelpers.tsx:172-184
if (Player.hasGangWith(faction.name)) {
  let augs = Object.values(Augmentations);
  augs = augs.filter((a) => !a.isSpecial && a.name !== AugmentationName.CongruityImplant);
  if (Player.bitNodeN === 2) { augs.push(Augmentations[AugmentationName.TheRedPill]); }
```

Von den 31 Augmentierungen mit `hacking`-Multiplikator sind **6 `isSpecial`**
und fallen damit weg (`BigDsBigBrain` x2,0, `TheSword` x1,1,
`NeuroFluxGovernor` x1,01, `StaneksGift1/2/3`). Die Gang verkauft **25**,
Produkt **22,89** — nicht 43,49. Siehe 4.1.

**Damit entfaellt in BN2 der gesamte Daedalus-Sockel** — der Levelaufbau aber
nicht. Was das quantitativ bedeutet, steht in 8.3.

---

## 5. Was ein Wechsel ueberlebt

Gegen `Prestige.ts` und `PlayerObjectGeneralMethods.ts:80-176` geprueft
[belegt].

| | Aug-Einbau | Node-Wechsel |
|---|---|---|
| Geld | $1.262 (`:102`) | $1.262; BN8: **$250 Mio** (`Prestige.ts:38,159,294`); BN13: nur `TravelCost` (`:341-343`) |
| Skills/EXP, Programme (ausser NUKE), TOR, gekaufte Server, Depot | weg | weg |
| Augmentierungen | **bleiben** | weg (`:174`) |
| Favor | **bleibt und waechst** | weg (`:251-253`) |
| Karma | **bleibt** | weg (`:146`) |
| Gang / Corporation / Bladeburner | **bleiben** | weg (`:157-160`) |
| Sleeves | bleiben inkl. Level | Anzahl bleibt, Level 1, Schock 100 — **ausser in BN10**, dort Schock <= 25 (`PlayerObjectGeneralMethods.ts:150-156`) |
| home-RAM / Kerne | **bleiben** | SF9>=2: 128 GB, sonst SF1>0: 32 GB, sonst 8 GB; Kerne 1 (`:242-249`) |
| Intelligence-EXP | bleibt **wenn** `sourceFileLvl(5)>0` | dito (`Person.ts:149-190`) |
| **Skripte und Textdateien auf `home`** | **bleiben** | **bleiben** |
| laufende Prozesse | alle beendet | alle beendet |

### 5.1 Der Beleg fuer die wichtigste Zeile

`ServerHelpers.ts:226-264` (`prestigeHomeComputer`) fasst `homeComp.scripts`
und `homeComp.textFiles` **nicht** an — geloescht werden nur `programs`,
`serversOnNetwork`, `messages` und die Portflaggen. Positivbeweis unmittelbar
danach, `Prestige.ts:232-233`:

```ts
// Ram usage needs to be cleared for bitnode-level resets, due to possible change in singularity cost.
for (const script of homeComp.scripts.values()) script.ramUsage = null;
```

Die Map wird durchlaufen, existiert also noch. **Der Bot-Code auf `home`
ueberlebt den BitNode-Wechsel.**

---

## 6. Die Route

| # | BN | Verfahren | Warum hier | Zeit | Ertrag |
|---|---|---|---|---|---|
| 1 | **BN4** (laeuft) | V1, erzwungen | Bladeburner ist ohne SF6/SF7 hier nicht verfuegbar. SF4 ist der Schluessel: ohne es kostet jede Singularity-Funktion ausserhalb BN4 das 16-Fache. | 60-120 h (6.1) | **SF4.1** |
| 2 | **BN6** | **V2** | Rang-Faktor **1,0**, der guenstigste Bladeburner-Knoten. Kein Hacking, keine Augs, kein Daedalus. Liefert SF6 und damit V2 fuer 12 weitere Knoten. | **48-84 h** (0 Sleeves; obere Grenze = Raid-frei, 4.2) | **SF6.1** |
| 3 | **BN10** | V2 (0,8) | **Der Sleeve-Knoten.** SF10.1 gibt 1 Sleeve, und der senkt jeden folgenden V2-Knoten um **40 %** (48 -> 29 h bei Faktor 1,0). In BN10 selbst starten Sleeves mit Schock <= 25 statt 100, sind also sofort nutzbar. Dazu **Grafting** (`PlayerObjectGeneralMethods.ts:577-579`) — Augmentierungen **ohne jede Reputation**, `baseCost x 3` (`GraftableAugmentation.ts:20-22`): das Werkzeug fuer BN8. | 35-57 h | **SF10.1** |
| 4 | **BN5** | V2 (1,0) | `formulas.exe` gratis bei jedem Prestige und **0 GB** RAM (`RamCostGenerator.ts:680-748`); Intelligence-Tor ist rueckwirkungsfrei — jeder Knoten davor verschenkt die dortige Akkumulation. | 29 h | **SF5.1** |
| 5 | **BN2** | V2 (1,0) | Gang ohne SF2 und ohne Karma, Softcap 1,0, Gang-Fraktion verkauft TRP — in BN2 entfaellt der Daedalus-Sockel also ganz. **Nicht** als V1-Rueckfall geeignet: die Levelschwelle ist mit effektiv 18.750 die zweithoechste des Spiels (8.3). SF2 macht Gangs ueberall verfuegbar. | 29 h | **SF2.1** |
| 6 | **BN3** | V2 (1,0) | billig unter V2. Corporation bleibt aus der Route (8.5). | 29 h | **SF3.1** |
| 7 | **BN11** | V2 (1,0) | billig unter V2. | 29 h | **SF11.1** |
| 8 | **BN12** | V2 (~0,98) | Einmal, frueh: Schwierigkeit und Skillkosten wachsen mit `1.02^lvl` (`BitNode.tsx:919-920`). SF12 ist das einzige Source-File ohne Deckel (`RedPill.tsx:29`) und schenkt bei jedem spaeteren Node-Wechsel NeuroFlux-Startlevel (`Prestige.ts:255-261`). | 30 h | **SF12.1** |
| 9 | **BN9** | V2 (0,9) | Unter V1 einer der schlimmsten (`HackExpGain 0.05`, `ServerMaxMoney 0.01`, **`CloudServerLimit 0`**, `HomeComputerRamCost 5`), unter V2 harmlos. Betriebsweg in 7.4. | 32 h | **SF9.1** |
| 10 | **BN7** | V2 (0,6, Skill x2) | erster gedaempfter Knoten. | 44 h | **SF7.1** |
| 11 | **BN14** | V2 (0,6, Skill x2) | unter V1 mit 1,2e23 EXP der teuerste Knoten des Spiels. | 44 h | **SF14.1** |
| 12 | **BN13** | V2 (0,45, Skill x2) | unter V1 3,7e51 EXP. Startgeld nur `TravelCost`. Stanek wird mitgenommen, weil man ohnehin dort ist (8.5). | 54 h | **SF13.1** |
| 13 | **BN15** | V2 (0,2, Skill **x3**) | schlechtester V2-Knoten. Milderung: `DaedalusAugsRequirement` ist hier **20** statt 30 — falls V2 hier wirklich 94 h kostet, ist BN15 der eine Knoten, in dem V1 erneut zu pruefen ist. | 94 h | **SF15.1** |
| 14 | **BN8** | **V1**, ohne Alternative | `BladeburnerRank 0`, `GangSoftcap 0`, `CorporationSoftcap 0`. Zuletzt, wenn SF10 (Grafting), SF12 (NeuroFlux-Start), SF5, SF9, SF11 und SF1 alle mitwirken. Vorteile: `FavorToDonateToFaction 0` (spenden ab Favor 0), WSE+TIX gratis (`Prestige.ts:161-164`), Startgeld $250 Mio, eff. Schwelle 3.000, `HackExpGain 1`. | 30-70 h | **SF8.1** |

**Summe: rund 520 bis 900 Stunden** fuer die 14 offenen Knoten. Die untere
Grenze setzt voraus, dass `Raid` durchgaengig verfuegbar ist (Stadtwechsel,
`comms` waechst nach); die obere ist die Raid-freie Zeile aus 4.2, auf **alle**
V2-Knoten angewandt, nicht nur auf BN6. Fassung 2
nannte 350-700 h, Fassung 4 dann 520-700 h; beide Male war die Spanne zu eng.

### 6.1 BN4 zu Ende spielen — mit Abbruchbedingung

`ns.singularity.b1tflum3(6, "boot.js")` (`Singularity.ts:1106-1123`) hat
**keine Voraussetzung ausser Singularity-Zugang**, den es in BN4 auch ohne SF4
gibt. Man koennte sofort nach BN6 springen. Dagegen sprechen drei Dinge
[belegt]: `b1tflum3` vergibt **kein** Source-File (`RedPill.tsx:66-68`) und
keine 300 Intelligence-EXP (`Prestige.ts:353-356`); in BN6 ohne SF4 gaebe es
**keine** Singularity-Funktion, also Fitnessstudio, Reisen und Aug-Kauf nur
ueber die Oberflaeche; und der V2-Abschluss haenge dann allein am DOM-Weg.

**Abbruchbedingung, messbar:**

> Erreicht der Bot binnen **48 h** ab jetzt weder **$5 Mrd** Guthaben noch
> **150.000** Reputation bei einer Fraktion mit offenen
> Hacking-Augmentierungen, wird `b1tflum3(6, "boot.js")` gefahren und die
> Route beginnt bei Position 2. Entschieden wird an den Messwerten.

### 6.2 Die eine gerechtfertigte Wiederholung — und die drei abgelehnten

**BN10 ein zweites Mal (SF10.2, zweiter Sleeve): abgelehnt.** Ersparnis 4 h je
Folgeknoten x 9 = 36 h, Kosten ein BN10-Lauf (35-57 h). Wash, also nein.
**BN10 ein erstes Mal an Position 3: ja**, weil 19 h Ersparnis x 11
Folgeknoten = 209 h gegen 35-57 h Kosten.

**SF4 Level 2: abgelehnt, aber knapp** — Begruendung in 8.2, sie hat sich
gegenueber Fassung 2 geaendert.

**SF12-Farmen und ein zweiter BN1-Lauf: abgelehnt** nach Zielfunktion Regel 1.

### 6.3 Rueckfallregel je Knoten

**Ausloeser.** Erreicht der Rang nach **8 h** Bladeburner-Betrieb nicht
**2.500** (der erste Black Op, `BlackOperations.ts:11-14`), stimmt etwas mit
Overclock, Chaos oder den Kampfwerten nicht. Frueherer Kontrollpunkt: **Rang
nach 2 h >= 6.000** — aber nur bei `comms >= 1` in der Arbeitsstadt; ohne
`Raid` lautet der Anker **>= 3.500**, und die erste Reaktion ist ein
Stadtwechsel (`ns.bladeburner.switchCity`), nicht der Verfahrenswechsel.

**Wohin der Rueckfall geht** — nach den drei Klassen aus 4.1, nicht mehr nach
einer einzelnen Schwelle:

| Knoten | Rueckfall |
|---|---|
| **BN1, BN5, BN8, BN12** (eff. <= 4.500) | **V1 tragfaehig.** Mit V3 (Gang), sofern SF2 vorliegt und `GangSoftcap >= 0.8`. BN8 laeuft ohnehin auf V1. |
| **BN3, BN4, BN11, BN15** (eff. 7.500-10.000) | **V1 nur bedingt.** Beim heutigen Netz kostet allein der Levelaufbau 1 bis 7 Tage; erst muss die Farm stehen. Als Notfallweg brauchbar, als Plan nicht. |
| **BN2, BN6, BN7, BN9, BN10, BN13, BN14** (eff. >= 12.000) | **Kein V1-Rueckfall.** Auch mit ausgebauter Farm hunderte bis tausende Stunden. Hier bleibt nur: Ursache beheben (Chaos, Overclock, Stadt) oder den Knoten per `b1tflum3` verlassen und spaeter erneut anlaufen. |

**Das ist die Verschaerfung gegenueber Fassung 4**, die noch neun Knoten mit
V1-Rueckfall auswies. Sieben Knoten haben jetzt keinen, vier nur einen
bedingten. Praktisch heisst das: **in zwei Dritteln der Route ist V2 nicht der
bessere Weg, sondern der einzige** — und `b1tflum3` ist der eigentliche
Rueckfall. Er kostet nichts ausser dem versenkten Fortschritt
(`Singularity.ts:1106-1123`), macht den Knoten aber nicht billiger; man kommt
mit mehr Source-Files zurueck.

**Harte Zeitgrenze.** Ueberschreitet ein Knoten das **Doppelte** seiner
Zeitschaetzung, wird er per `b1tflum3` verlassen. Die obere Zeitschaetzung ist
jetzt die Raid-freie Zeile aus 4.2, die Grenze also entsprechend hoeher.

## 7. Betriebsteil

### 7.1 Grundlage [belegt]

`home.scripts` und `home.textFiles` ueberleben (5.1). Alle Prozesse sterben
(`Prestige.ts:57, 204`). Es braucht also genau eines: **etwas, das nach dem
Wechsel ein Skript auf `home` startet.**

### 7.2 Zwei Ausgaenge aus einem Knoten

**Ausgang A — `destroyW0r1dD43m0n(nextBN, "boot.js")`** [belegt]. `runAfterReset`
(`Singularity.ts:59-76`) laeuft **immer auf `home`, 1 Thread, ohne Argumente**,
~500 ms nach dem Reset im **neuen** Knoten; der RAM-Bedarf wird dabei mit den
Preisen des neuen Knotens **neu** berechnet und gegen das frische
`home.maxRam` geprueft; fehlt die Datei, bricht es **stumm** ab. **Deshalb darf
das Rueckrufskript keine Singularity-Funktion enthalten.** Kosten: ein Skript
mit `destroyW0r1dD43m0n` misst **513,6 GB** ausserhalb BN4 (7.3).

**Ausgang B — der DOM-Knopf** [belegt]. Nach dem 21. Black Op rendert
`Bladeburner/ui/BlackOpPage.tsx:39-52` einen Knopf `Destroy w0r1d_d43m0n`, der
`finishBitNode()` und `Router.toPage(Page.BitVerse)` aufruft. **Im Handler
steht keine `isTrusted`-Pruefung.** Im ganzen Quelltext gibt es 13
`isTrusted`-Stellen (Arcade, Blackjack x3, Casino/utils, Unclickable,
FactionsRoot `Join!`, InfiltrationRoot, CompanyLocation x2, HospitalLocation,
SlumsLocation, ProgramsRoot x2) — **keine davon in `BlackOpPage.tsx` oder
`PortalModal.tsx`**. Der Knoten-Wechsel danach laeuft ueber
`PortalModal.tsx:117-131`, dessen Knopf ein stabiles
`aria-label="enter-bitnode-N"` traegt.

Ein DOM-Klickskript misst **27,6 GB** [gemessen] und passt damit auf ein
frisches `home` mit 32 GB. **Auf der V2-Route wird kein 1024-GB-Rechner
gebraucht.** Ausgang B startet aber **kein** Rueckrufskript — dafuer ist
`keepalive.js` zustaendig (7.6, Vorbedingung 7).

**Ausgang B hat einen Teilausfall, und der ist der gefaehrlichste Zustand der
ganzen Route** (Skeptiker 2, Runde 3, angenommen): `BlackOpPage.tsx:39-52`
ruft `finishBitNode()` **und** `Router.toPage(Page.BitVerse)`. Scheitert
danach der Klick in `PortalModal.tsx:117-131`, steht das Spiel auf der
BitVerse-Seite. Dort gibt es **kein** `terminal-input`, und
`keepalive.js:183-186` prueft genau darauf und kehrt kommentarlos zurueck
("Sonderseite? (Recovery, BitVerse, Infiltration)"). Ergebnis: Knoten formal
beendet, kein Skript laeuft, kein Terminal, keine Datei aendert sich — und aus
dem Zustand kommt nur ein Mensch heraus. [belegt]

**Zwei Gegenmassnahmen, beide Pflicht:**

1. **`keepalive.js` bekommt einen BitVerse-Zweig** [zu bauen]: erkennt er die
   BitVerse-Seite (kein `terminal-input`, aber ein Element mit
   `aria-label^="enter-bitnode-"`), klickt er
   `[aria-label="enter-bitnode-N"]`. **N wird dem Waechter beim Setzen als
   Argument mitgegeben**, denn nach dem Reset kann er keine Datei mehr lesen
   (Vorbedingung 7). Der Zweig muss **vor** der heutigen
   "Sonderseite"-Rueckkehr stehen.
2. **Ausgang A bleibt als Rueckfall in der Route**, bis Ausgang B einmal nach
   7.8 in einer Spielstandkopie vollstaendig durchgelaufen ist. Der
   1024-GB-Rechner ist mit $56 Mio (BN1/14/15) bis $901 Mio (BN6/7/11) eine
   billige Versicherung gegen einen ungeprueften Alleinausgang.

Zusatzbefund: beim Eintritt in **BN6** landet die Oberflaeche auf
`Page.BladeburnerCinematic` (`RedPill.tsx:92-93`), nicht auf dem Terminal.
Kein Skript darf auf ein sichtbares Terminal bauen. Einen `location.reload`
gibt es beim Node-Wechsel **nicht** (nur `SaveObject.ts:297` und
`DeleteGameButton.tsx:30`) — ein `setInterval` im Seitenkontext ueberlebt also
auch einen BitNode-Wechsel. [belegt]

### 7.3 RAM-Kette — gemessen, nicht summiert

Alle Werte unten mit `calculateRam` ueber die Bruecke an der laufenden
Instanz **gemessen** (`RemoteFileAPI/MessageHandlers.ts:194`), Proben danach
geloescht. Die BN4-Spalte ist der Messwert; die Spalte "ausserhalb BN4" nimmt
den Singularity-Anteil mal 16 (SF4.1) [gerechnet aus dem Messwert].

| Skript | Inhalt | BN4 [gemessen] | ausserhalb, SF4.1 | ausserhalb, SF4.2 |
|---|---|---|---|---|
| `boot.js` | scan/nuke/5 Portknacker/exec/scp/ps/kill/Serverabfragen | **5,7** | 5,7 | 5,7 |
| `cloud.js` | `ns.cloud.*` + scp + exec | **7,5** | 7,5 | 7,5 |
| `blade.js` (minimal) | startAction, getActionCountRemaining, getRank, getStamina, upgradeSkill, getSkillPoints, getNextBlackOp | **27,6** | 27,6 | 27,6 |
| `blade.js` (voll, 15 Fn) | zusaetzlich join/switchCity/setTeamSize/... | **50,6** | 50,6 | 50,6 |
| `domclick.js` | `document` + querySelectorAll | **27,6** | 27,6 | 27,6 |
| `sing/tor.js` | nur `purchaseTor` | 3,6 | **33,6** | 9,6 |
| `sing/progs.js` | nur `purchaseProgram` | 3,6 | **33,6** | 9,6 |
| `sing/join.js` | checkFactionInvitations + joinFaction | 7,6 | **97,6** | 25,6 |
| `sing/work.js` | workForFaction + isBusy | 5,1 | **57,6** | 15,6 |
| `sing/gym.js` | gymWorkout + travelToCity + getCurrentWork | 6,1 | **73,6** | 19,6 |
| `sing/homeram.js` | getUpgradeHomeRamCost + upgradeHomeRam | 6,1 | **73,6** | 19,6 |
| `sing/augbuy.js` | nur `purchaseAugmentation` | 6,6 | **81,6** | 21,6 |
| `sing/install.js` | nur `installAugmentations("boot.js")` | 6,6 | **81,6** | 21,6 |
| `sing/augscan.js` | getAugmentationsFromFaction + Preis + RepReq + getFactionRep | 12,6 | **177,6** | 45,6 |
| `sing/destroy.js` | nur `destroyW0r1dD43m0n` | 33,6 | **513,6** | 129,6 |

**Korrektur gegen Fassung 2:** dort stand `blade.js ~25 GB` — der volle
Treiber misst **50,6 GB**, also das Doppelte. Genau die Fehlerklasse, vor der
Skeptiker 2 gewarnt hat: eine zu niedrig geschaetzte Zeile bedeutet, dass
`ns.exec` still 0 zurueckgibt. Deshalb ist die Tabelle jetzt gemessen.

**Regel: ein Singularity-Aufruf je Skript.** Damit bleibt jedes Skript ausser
`augscan` und `destroy` unter 128 GB, und `augscan` laesst sich in zwei
Skripte zu je 81,6 GB teilen.

### 7.4 Wo die Skripte laufen — mit dem echten Softcap je Knoten [belegt/gerechnet]

**Der zentrale Befund bleibt:** `checkSingularityAccess`
(`NetscriptHelpers.tsx:438-446`) prueft nur `canAccessBitNodeFeature(4)` —
**keinen Rechner**. Singularity laeuft auf gemieteten Rechnern.

**Die Kostenrechnung aus Fassung 2 war falsch.** Sie rechnete mit
`CloudServerSoftcap = 1`. Preisformel
(`ServerPurchases.ts:22-41`): `ram * 55.000 * CloudServerCost *
CloudServerSoftcap^max(0, log2(ram)-6)`. Alle Werte an den `case`-Grenzen
nachgeprueft [belegt]:

| BN | Cost | Softcap | Limit | MaxRam | 64 GB | 128 GB | 256 GB | 1024 GB | home 32->1024 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 1 | 25 | 1 PB | $3,5m | $7,0m | $14,1m | $56,3m | $1,47b |
| 2 | 1 | 1.3 | 25 | 1 PB | $3,5m | $9,2m | $23,8m | $160,9m | $1,47b |
| 3 | **2** | 1.3 | 25 | 1 PB | $7,0m | $18,3m | $47,6m | $321,7m | $2,20b |
| 4 | 1 | 1.2 | 25 | 1 PB | $3,5m | $8,4m | $20,3m | $116,8m | $1,47b |
| 5 | 1 | 1.2 | 25 | 1 PB | $3,5m | $8,4m | $20,3m | $116,8m | $1,47b |
| 6 | 1 | **2** | 25 | 1 PB | $3,5m | $14,1m | $56,3m | **$901,1m** | $1,47b |
| 7 | 1 | **2** | 25 | 1 PB | $3,5m | $14,1m | $56,3m | $901,1m | $1,47b |
| 8 | 1 | **4** | 25 | 1 PB | $3,5m | $28,2m | $225,3m | **$14,42b** | $1,47b |
| 9 | 1 | 1 | **0** | — | — | — | — | — | **$7,33b** |
| 10 | **5** | 1.1 | **15** | 512 TB | $17,6m | $38,7m | $85,2m | $412,3m | $2,20b |
| 11 | 1 | **2** | 25 | 1 PB | $3,5m | $14,1m | $56,3m | $901,1m | $1,47b |
| 12 | `1.02^l` | `1.02^l` | `0.98^l` | `0.98^l` | $3,6m | $7,3m | $14,9m | $62,2m | $1,50b |
| 13 | 1 | 1.6 | 25 | 1 PB | $3,5m | $11,3m | $36,0m | $369,1m | $1,47b |
| 14 | 1 | 1 | 25 | 1 PB | $3,5m | $7,0m | $14,1m | $56,3m | $1,47b |
| 15 | 1 | 1 | 25 | 1 PB | $3,5m | $7,0m | $14,1m | $56,3m | $1,47b |

**Die entscheidende Eigenschaft:** bei 64 GB ist `max(0, log2(64)-6) = 0` —
**der Softcap ist dort mathematisch wirkungslos.**

**Einschraenkung (Skeptiker 3, Runde 3, angenommen):** Das gilt fuer die
**V2**-Kette, nicht generell. `SingularityFn3 = 5` (`RamCostGenerator.ts:57`)
ist **unteilbar** — `purchaseAugmentation`, `installAugmentations`,
`getAugmentationsFromFaction`, `donateToFaction`, `commitCrime` und
`getOwnedAugmentations` kosten mit SF4.1 je `1,6 + 80 = 81,6 GB` und brauchen
zwingend **128 GB** (`:195-222`). Auf der V1-Kette und im V1-Rueckfall sind
also mindestens drei 128-GB-Rechner faellig; in **BN8** (Softcap 4) kosten sie
je **$28,2 Mio**. Teilbar sind nur `getAugmentationPrice` und
`getAugmentationRepReq` (`SingularityFn3 / 2` = 2,5 -> 41,6 GB, passt auf
64 GB).

Die **V2**-Betriebskette kostet **je Knoten** (`sing/join.js` in zwei Haelften
zu je 49,6 GB geteilt):

- BN1/2/4/5/6/7/8/11/12/13/14/15: **$10,6-10,8 Mio** (3 x 64 GB)
- BN3: $21,1 Mio · BN10: $52,8 Mio · **BN9: gar nicht** (Limit 0)

Nicht $1 Mrd. Der 1024-GB-Rechner aus Fassung 2 war ein **Einmalposten am
Knotenende**, und auf der V2-Route wird er durch Ausgang B (7.2, 27,6 GB auf
`home`) ganz ersetzt. Wo er doch gebraucht wird (V1-Knoten ohne SF4.2), gilt
**min(Miete, home-Ausbau)** — in **BN8** ist home mit $1,47b zehnmal billiger
als Miete mit $14,42b.

### 7.5 Wiederanlaufkette je Knoten [zu bauen, ausser wo anders vermerkt]

**Stufe 0 — die ersten $3,52 Mio.** Nach dem Wechsel: $1.262, nur NUKE.exe,
keine Portknacker. Erreichbar sind nur die 0-Port-Server. Das sind
`n00dles`, `foodnstuff`, `sigma-cosmetics`, `joesguns`, `hong-fang-tea`,
`harakiri-sushi` und `nectar-net` (letzterer verlangt Hacking 20) —
zusammen rund 100 GB fremdes RAM plus `home`.

| BN | ServerMaxMoney x ScriptHackMoney | Startgeld | Zeit bis $3,52 Mio [gerechnet] | Ersatzweg noetig? |
|---|---|---|---|---|
| 1, 12, 14, 15 | ~1 | $1.262 | 15-40 min | nein |
| 2, 5, 11, 13 | 0,2-0,75 | $1.262 | 30-90 min | nein |
| 3, 6, 7 | 0,15-0,2 | $1.262 | 1-3 h | nein |
| 4 | **0,0225** | $1.262 | 5-12 h | grenzwertig — Codingvertraege sind hier ungedaempft |
| 8 | **0** (`ScriptHackMoneyGain 0`) | **$250 Mio** | 0 (Startgeld reicht) | ja: Boerse, siehe 6. Route |
| 9 | **0,01**, dazu `CloudServerLimit 0` | $1.262 | **unbestimmt** | ja: siehe unten |
| 10 | 0,2, `CloudServerCost 5` | $1.262 | 2-6 h (Ziel $17,6 Mio) | nein |

**BN9 im Einzelnen** (die offene Frage aus Fassung 2, jetzt geschlossen): Es
gibt keine Mietrechner. Aber (a) `hasHacknetServers()` ist in BN9 wahr
(`HacknetHelpers.tsx:34-36`), und bei **jedem** Prestige wird dort ein
Hacknet-Server mit Level 100 und 10 Kernen geschenkt (`Prestige.ts:329-339`,
Bedingung `activeSourceFileLvl(9) >= 3 || bitNodeN === 9`) — Hacknet-Server
sind vollwertige Rechner mit bis zu **8.192 GB** (`Hacknet/data/Constants.ts:49`).
(b) Der minimale `blade.js` misst 27,6 GB und passt auf ein 32-GB-`home`.
(c) Der DOM-Ausgang misst 27,6 GB und passt ebenfalls. **BN9 braucht damit
weder Mietrechner noch einen home-Ausbau**; die Singularity-Skripte
(`sing/tor.js` 33,6 GB) laufen auf dem Hacknet-Server, dessen RAM-Ausbau
`1 -> 64 GB` nach `calculateRamUpgradeCost` **$53,4 Mio** kostet
(`Hacknet/formulas/HacknetServers.ts:40-66`, `sum(ram * 200.000 *
1,4^log2(ram))`) [gerechnet]. **Korrektur gegen Fassung 3**, die hier
$12,1 Mio nannte — das war eine falsch summierte geometrische Reihe. Auf
1 -> 128 GB waeren es $149,8 Mio; das ist der Grund, warum in BN9 die
Singularity-Skripte einzeln und klein bleiben muessen.

**Stufe 1 bis 4** danach wie in 7.3/7.4: `boot.js` (Rueckruf) -> `cloud.js`
kauft 64-GB-Rechner -> `sing/tor.js` und `sing/progs.js` -> `blade.js` bzw.
die V1-Kette.

### 7.6 Vorbedingungen (Handschlaege)

**Vor jedem Aug-Einbau:**

1. **Depot leer** [belegt + zu bauen]. `prestigeAugmentation` ruft
   `initStockMarket()` (`Prestige.ts:166-171`), das alle `Stock`-Objekte
   loescht und neu anlegt (`StockMarket.ts:187-196`) — `playerShares` ist
   **ohne Auszahlung** weg. Der Riegel existiert halb: `src/bn4rep.js` prueft
   `ns.fileExists("data/install-frei.txt", "home")`, aber **kein Skript im
   Projekt schreibt diese Datei** (repoweit geprueft). Zu bauen: `stocks.js`
   schreibt nach dem Verkauf `data/depot-leer.txt` mit Zeitstempel;
   `install.js` verlangt einen Zeitstempel juenger als 60 s.
2. **Keine laufenden Stapel** [zu bauen]. Vor dem Einbau keine neuen Stapel
   starten, laufende auslaufen lassen (Maximaldauer = `weakenTime`). **Diese
   Bedingung wird VOR dem HWGW-Umbau gebaut, nicht danach** — sonst
   hinterlaesst jeder Einbau leergeraeumte Ziele mit hochgezogener Sicherheit.
   Eigentuemer: derselbe Umbau, der den Zuteiler auf Reservierung umstellt
   (`nodes/bn4/PLANER.md`, Stufe 4).
3. **Wiederbeschaffungswert des Rechnerparks** [zu bauen].
   `prestigeAllServers()` loescht alle gekauften Server
   (`AllServers.ts:136-138`). Das Einbaukriterium kennt Warteschlange und
   Reputationsluecke, aber nicht den Preis des Parks.

**Vor jedem Node-Wechsel zusaetzlich:**

4. **`boot.js` liegt auf `home` und passt** in das `home.maxRam` des
   **Zielknotens**. Da es keine Singularity-Funktion enthaelt, ist seine
   Groesse knotenunabhaengig (5,7 GB [gemessen]) — das ist der Zweck der
   Bauform.
5. **Zustandstragende Textdateien liegen auf `home`**, nicht auf Mietrechnern.
6. **Zielknoten aus `data/route.txt`**, damit die Route ohne Codeaenderung
   fortgeschrieben werden kann.
7. **`keepalive.js` laeuft, ist handlungsfaehig und frisch** [zu bauen]. Auf
   Ausgang B (7.2) startet **nichts** von selbst — der Seitenkontext-Waechter
   ist dann der einzige Wiederanlauf.

   **Korrektur gegen Fassung 3 (Skeptiker 2, angenommen):** Dort stand, der
   Waechter solle je Takt `data/keepalive.json` schreiben. **Das ist nicht
   baubar.** `keepalive.js` setzt sein `setInterval` und **kehrt aus `main()`
   zurueck**; damit endet der Worker, `killWorkerScript` setzt
   `ws.stopFlag = true` (`killWorkerScript.ts:85`), und jeder spaetere
   ns-Aufruf laeuft durch `helpers.checkEnvFlags` (`APIWrapper.ts:79`), das bei
   gesetztem `stopFlag` `ScriptDeath` wirft (`NetscriptHelpers.tsx:448-454`).
   Das im Seitenkontext festgehaltene `ns` ist tot. Der heutige Code weiss das:
   `melde()` mit `ns.write` laeuft ausschliesslich waehrend `main()`
   (`keepalive.js:82-86`), waehrend `W.notiz()` im Takt nur in ein Array und
   nach `console.log` schreibt (`:108-118`). Ein `ns.write` im Takt wuerde eine
   Ausnahme werfen, die `tick()` still auffaengt (`:240-253`) — die Datei
   entstuende nie. [belegt]

   **Richtiger Herzschlag:** derselbe Weg wie der Eingriff. Der Waechter setzt
   je Takt ueber seinen vorhandenen `W.terminal(...)`-Helfer
   (`keepalive.js:121-134`) den Befehl `run puls.js` ab; `puls.js` (~1,6 GB)
   schreibt Zeitstempel und Knotennummer und beendet sich. Das beweist nicht
   nur, dass der Timer tickt, sondern dass der Waechter **handlungsfaehig**
   ist — Terminal erreichbar, Feld nicht gesperrt. Genau das ist die
   Eigenschaft, auf die Ausgang B baut; ein reiner Timer-Nachweis wuerde die
   falsche Sache beweisen.

   **Der Takt wird fuer die Wechselphase von 600.000 ms
   (`keepalive.js:286`) auf 120.000 ms gesenkt** und danach wieder angehoben.

### 7.7 Stillstandserkennung — nur dateibasierte Signale

**Korrektur gegen Fassung 2:** dort stand die Regel "`ns.ps('home')` enthaelt
kein `boot.js`". Skeptiker 2 hat recht — `ps` ist nur aus einem laufenden
Skript heraus lesbar, und die Fernschnittstelle kennt neun Methoden, die
**alle dateibasiert** sind (`RemoteFileAPI/MessageHandlers.ts:92-222`)
[belegt]. Genau im Szenario, das die Regel erkennen soll, laeuft nichts, was
sie auswerten koennte. **Die Regel ist gestrichen und ersetzt.**

**Das Signal** [zu bauen]: `boot.js` schreibt als **erste Handlung**
`data/boot.json` mit `{ ts, bitNode: ns.getResetInfo().currentNode, lastNode }`.
`ns.getResetInfo` kostet 1 GB und ist in `boot.js` eingerechnet.

| Lage | stillstehend, wenn ... |
|---|---|
| **Wiederanlauf** | `data/boot.json` fehlt, ODER `bitNode` ist 15 min nach dem erwarteten Wechsel unveraendert, ODER `ts` ist aelter als 180 s |
| **Waechter handlungsunfaehig** | `data/puls.json` aelter als zwei Takte (Vorbedingung 7). Das trennt "Timer tot" von "Terminal gesperrt" — auf der BitVerse-Seite tickt der Timer weiter, aber `run puls.js` geht nicht durch, und genau das ist das Signal fuer den BitVerse-Zweig |
| **V2-Knoten** | `getRank()` in 30 min um weniger als 1 % gestiegen, ODER `getSkillPoints()` unveraendert, ODER dieselbe Aktion seit >10 min. Zusatzalarm: Chaos der Arbeitsstadt > 5.000 |
| **V1, Aufbau** | Geldrate < 25 % des Medians der letzten 6 Fenster, ODER Hacking-Level unveraendert, ODER Zahl gerooteter Rechner unveraendert bei offenen Zielen |
| **V1, Reputation** | Reputation der Zielfraktion unveraendert bei gesetztem Ziel, ODER `getCurrentWork()` seit >5 min `null` |
| **immer** | Telemetriedatei aelter als 180 s (vorhanden) |

Alle diese Groessen werden von den laufenden Skripten in JSON-Dateien
geschrieben und sind damit ueber `getFile` lesbar — das ist die einzige
Schnittstelle, die die Bruecke hat.

**Eskalation:**

1. `keepalive.js` im Seitenkontext: startet `boot.js`, wenn `data/boot.json`
   fehlt oder veraltet ist; klickt das Portal, wenn die BitVerse-Seite steht
   (7.2). Zweimal nachsehen, dann erst melden; im Zweifel nichts tun.
   [teilweise vorhanden, Herzschlag, BitVerse-Zweig und Signal zu bauen]
2. `tools/watch.js` beendet sich bei Alarm und erzeugt damit eine
   Benachrichtigung. **Neu aufzunehmen: die Einkommens- und Rangregeln oben.**
   Heute berechnet `tools/bn4watch.js` zwar `rates.geld`, loest darauf aber
   **keine** Warnung aus — ein Einkommenseinbruch ist unsichtbar. [zu bauen]
3. Harte Grenze je Knoten: das Doppelte der Zeitschaetzung -> Rueckfallregel
   6.3.

### 7.8 Testregel und Testreihenfolge

**Getestet wird im Zielzustand.** Der Wiederanlauf wird an einer **Kopie des
Spielstands** gefahren, in der der Uebergang wirklich stattfindet — nicht in
BN4, wo alle Singularity-Preise um Faktor 16 falsch sind.
`ns.singularity.getSaveData` und die Bruecke machen das Kopieren moeglich.

**T1 — sofort, im laufenden BN4, ohne Kopie** (Skeptiker 3, Runde 3): Der
DOM-Ausgang ist bis zum Erwerb von SF4 der **einzige** Ausgang der ganzen
Route. Er wird **jetzt** getestet, nicht am Knotenende: `b1tflum3` in einer
Spielstandkopie oeffnen lassen, damit die BitVerse-Seite steht, und dort
pruefen, ob ein synthetischer Klick auf `[aria-label="enter-bitnode-1"]` den
`onClick`-Handler von `PortalModal.tsx:120` erreicht. Das ist der Teil des
Ausgangs, den bisher nichts im Projekt benutzt hat — den MUI-Knopf an sich
klickt `homeram.js` seit Wochen erfolgreich.

**T2 — Ausgang B vollstaendig, in einer Kopie.** Pruefkriterium ist
ausdruecklich der **Abbruch auf BitVerse**: der Test gilt nur als bestanden,
wenn nach dem Klick auf `Destroy w0r1d_d43m0n` ohne menschliches Zutun ein
neuer Knoten laeuft und `data/boot.json` die neue Knotennummer traegt. Bleibt
das Spiel auf BitVerse stehen, ist der Test **nicht** bestanden, auch wenn
`finishBitNode()` gegriffen hat.

**T3 — Wiederanlaufkette** (`boot.js` -> `cloud.js` -> `sing/*`) in derselben
Kopie, mit den x16-Preisen des Zielknotens.

Bis T2 bestanden ist, faehrt die Route **Ausgang A** (7.2).

---

## 8. Bescheidung

Runde 1 im Ueberblick: von 19 Einwaenden angenommen 14, teilweise 3,
zurueckgewiesen 2 (Bladeburner-Zugang "in jedem BitNode", BN8 auf Platz 3).
Die Begruendungen stehen in der Versionsgeschichte. Hier nur die Bedingungen
aus Runde 2.

### 8.1 Runde 1 und 2 — erledigt

Runde 1: 19 Einwaende, 14 angenommen, 3 teilweise, 2 zurueckgewiesen
(Bladeburner-Zugang "in jedem BitNode", BN8 auf Platz 3).
Runde 2: Skeptiker 3 hat drei eigene Befunde zurueckgezogen und zugestimmt;
seine acht Bedingungen (Softcap-Tabelle je Knoten, V2-Anker, Repo-Kennzeichnung,
BN9, Zahlenfehler, Saettigungsbeweis, Straffung, V1-Tabelle nach vorn) sind
eingeloest. Skeptiker 2 hat alle fuenf Bedingungen aus Runde 1 als eingeloest
bestaetigt (Depot-Handschlag, Ausgabendeckel, dateibasierte Signale,
Stufe-0-Tabelle, gemessene RAM-Tabelle). Begruendungen in der
Versionsgeschichte; die Ergebnisse stehen in 4.2, 7.3, 7.4 und 7.5.

### 8.2 SF4 Level 2 — abgelehnt, aber knapp und mit Ausloeser

Fassung 2 wies SF4.2 mit "spart ~$75m je Knoten" ab; die Zahl war falsch.
Richtig: SF4.2 senkt `sing/destroy.js` von 513,6 auf 129,6 GB (in BN6
$901,1m -> $14,1m, also **$887 Mio**) und die **gesamte** Kette unter 32 GB
(Tabelle 7.3, rechte Spalte) — der komplette Singularity-Betrieb liefe dann auf
einem frischen `home`, und die Mietrechner-Choreografie entfiele. Das ist der
eigentliche Wert, nicht das Geld.

Die Rechnung in der Waehrung der Zielfunktion: **Ertrag** 1-3 h weniger Aufbau
je Knoten x 11 Restknoten = **11-33 h** (der Geldposten faellt auf der V2-Route
gar nicht an, Ausgang B). **Kosten**: ein zweiter BN4-Lauf ist nach SF6 kein
V1-Lauf mehr — BN4 hat `BladeburnerRank 1,0` und kostet mit einem Sleeve
**29 h**. **Ein Wash.**

Nicht eingeplant, aber **als erste Reaktion vorgemerkt**, falls sich die
Mietrechner-Kette in BN6 als fehleranfaellig erweist. Dann wird BN4 direkt nach
BN6 wiederholt.

### 8.3 Skeptiker 1 — die zwei Nachforderungen

**(a) "BN2 ist der guenstigste V1-Knoten" — mit Zahl oder streichen.**

**Er hat recht, die Zahl war falsch, und ich nehme die Aussage zurueck.**

Der Fehler ist genau der, den er benennt: ich habe das ungefilterte Produkt
43,49 benutzt, obwohl die Filterzeile
`augs.filter((a) => !a.isSpecial && a.name !== CongruityImplant)` **vier Zeilen
ueber** der Stelle steht, die ich selbst als `FactionHelpers.tsx:172-184`
zitiert habe. Sechs der 31 Hacking-Augmentierungen sind `isSpecial` und fallen
fuer eine Gang-Fraktion weg; die Luecke ist fast ganz `BigDsBigBrain` x2,0 —
eine Augmentierung **ohne `factions`-Eintrag**, fuer die ich im ganzen Baum
ausser ihrer eigenen Definition und dem Enum **keine Vergabestelle** gefunden
habe. Korrekt sind **25 Augmentierungen, Produkt 22,89** (4.1).

Damit: `m = 22,89 x 1,16 (SF1.1) x 0,8 (HackingLevelMultiplier) = 21,2`,
`exp = e^((15000/21,2 + 200)/32) - 534,6 = 2,0e12` statt 5,9e7 — **Faktor
34.000**. Seine 2,1e12 reproduziere ich.

**Und die Zahl laesst sich nicht retten** — auch nicht mit der korrigierten
Erfahrungsrate. 2,0e12 Erfahrung sind beim heutigen Netz (1e2 bis 1e3 EXP/s,
4.1) **222.000 bis 4,4 Mio Stunden**, und selbst mit einer Farm der
Groessenordnung des BN1-Endstands (1e5 EXP/s) noch **4.400 Stunden**. Fuer
"20-40 h" braeuchte es 1,4e7 EXP/s — vier Groessenordnungen ueber dem
Gemessenen, und das in einem Knoten mit `ServerMaxMoney 0.08` und
`ServerGrowthRate 0.8`, in dem die Farm gerade nicht waechst.

**Was stehen bleibt:** In BN2 entfaellt der Daedalus-**Sockel** vollstaendig
(Gang ohne SF2 und ohne Karma, Gang-Fraktion verkauft TRP). **Was faellt:**
"guenstigster V1-Knoten ueberhaupt" und die Zahl 20-40 h. BN2 hat mit
effektiv 18.750 die **zweitteuerste** Levelschwelle des Spiels; der Sockel war
nie der begrenzende Posten dort.

**Folgen im Dokument** (die Route bleibt unveraendert — BN2 laeuft auf
Position 5 ueber V2 mit 29 h):

- 4.1 hat jetzt einen expliziten Schnitt: **V1 ist nur bis zu einer effektiven
  Schwelle von ~10.000 realistisch.** BN2 liegt darueber.
- 6.3 nennt die Knoten, in denen der V1-Rueckfall ueberhaupt greift — BN2 nur
  fuer den Sockel, nicht fuer das Level.
- 4.1 sagt jetzt ausdruecklich, dass die **m=25-Spalte die Obergrenze** ist,
  nicht ein mittlerer Ausbau. Das wirkt gegen V1 und fuer die Route.

Nebenbefund, der die Sache noch schaerft: die Gang allein (22,89) kommt auf
1 % an das heran, was **alle** Faktionen zusammen hergeben (23,1). Der
Gang-Weg ist als Beschaffungsweg fuer Augmentierungen also praktisch
vollstaendig — er nuetzt in BN2 nur nichts, weil dort das Level das Problem
ist.

**(b) Kampfwert-Multiplikatoren im Exponenten.** Er hat den Einwand nach
eigener Nachrechnung aufgegeben, und die Zahlen decken sich mit meinen: die
Multiplikatoren sitzen zwar im Exponenten der Skill-Formel, aber V2 benutzt die
Kampfwerte kaum. Aktionszeit haengt ueber `statFac = 0.5*(agi^0.04 +
dex^0.035 + agi/1e4 + dex/1e4)` an ihnen (1000 -> 3000 nur 1,396 -> 1,650), und
in der Simulation aendert das die Gesamtzeit um unter 2 %. Wo sie wirken
(Erfolgsrate, `competence ~ sum(w * effSkill^0.9)`), ist der Verlust mit
Skillpunkten kompensierbar, deren Kosten **quadratisch** wachsen:
`BladesIntuition` Stufe 67 gibt Faktor 3,01 und kostet
**4.844 SP = Rang 14.532** (`Skills.ts:5-11`, `Skill.ts:76-80`) — **3,6 %**
des Rangbudgets, in BN15 mit `BladeburnerSkillCost 3` 14.532 SP = Rang 43.596
= 10,9 %. (Fassung 3 nannte 4.837, Fassung 4 faelschlich 4.815; richtig ist
die Gegenrechnung des Pruefers, 4.844 — siehe die Rundungsnotiz in 4.2.)
Was bleibt: der Beitritt verlangt 4x100 Kampfwerte, und in BN10 (Mult 0,4)
kostet Kampfwert 100 rund `1,3e6` EXP je Wert — Fitnessstudio-Arbeit von
einigen Stunden, in den 35-57 h fuer BN10 enthalten.

### 8.4 Runde 2, Skeptiker 2 — erledigt

Alle sechs Bedingungen eingeloest: `ps`-Regel gestrichen und durch
`data/boot.json` ersetzt (7.7), `keepalive.js` als Vorbedingung (7.6),
Stufe-0-Tabelle je Knoten (7.5), RAM-Tabelle gemessen statt summiert (7.3 —
dabei kam heraus, dass `blade.js` 50,6 GB kostet, nicht die geschaetzten 25),
Handschlaege vor dem HWGW-Umbau festgeschrieben, Belegarten ausgezeichnet.
Was in Runde 3 offenblieb, steht in 8.6.

### 8.5 Runde 3 — Filter-Audit aller maschinellen Auszaehlungen

Skeptiker 1s dritte Bedingung war die wichtigste: der Fehler war **keine
Arithmetik, sondern eine nicht angewandte Filterbedingung, die im zitierten
Codeblock selbst stand**. Deshalb hier jede maschinell gewonnene Zahl des
Dokuments mit dem Filter, gegen den sie geprueft wurde.

| Zahl | Filter geprueft | Ergebnis |
|---|---|---|
| Produkt der Hacking-Augmentierungen | `isSpecial`, `factions`-Eintrag, Vergabestelle im Baum | **FEHLER**, 43,49 -> 23,1 (Faktionen) bzw. 22,9 (Gang). 4.1 und 8.3 neu. |
| Overclock 90, SP-Kosten | `Math.round` auf der geschlossenen Form (`Skill.ts:76-80`) | **FEHLER**, 5.751 -> **5.877 SP**. |
| BladesIntuition 67, SP-Kosten | dito | **FEHLER**, 4.837 -> **4.844 SP**. |
| Erfahrungsrate 129.640 EXP/s | Herkunft der Quelldatei (Knoten, Netzgroesse, Zeitpunkt) | **FEHLER**, und der teuerste: die Zahl stammt aus BN1 bei 5,3 PB, der Bot hat 0,12 % davon. Fassung 2 und 3 hatten die Datei selbst als Blindgaenger verworfen, Fassung 4 hat sie dann benutzt. Zurueckgezogen, ersetzt durch 1e2-1e3 EXP/s [gemessen] — siehe 4.1. **Lehre: eine Zahl, die man einmal als unbrauchbar verworfen hat, wird nicht dadurch brauchbar, dass man spaeter eine braucht.** |
| *Das Audit selbst* | Kommentarblock gegen ausfuehrbare Zeile | **ZWEI DER FUENF KORREKTUREN WAREN SELBST FALSCH**: Fassung 4 las aus `Skill.ts:37-75` ein `Math.floor` je Stufe heraus und rechnete 5.840 bzw. 4.815. Der Block ist reiner Kommentar und entscheidet sich ausdruecklich dagegen; die ausfuehrbare Zeile 76-80 rundet einmal am Ende. Zwei unabhaengige Nachrechnungen kamen auf 5.877 / 4.844. **Lehre: ein Kommentar ist kein Beleg — es zaehlt nur die ausfuehrbare Zeile.** |
| Hacknet-RAM 1 -> 64 GB | Schleife statt geometrischer Reihe | **FEHLER**, $12,1 Mio -> **$53,4 Mio**. |
| `DaedalusAugsRequirement` BN12 | Formel statt Zahl | **FEHLER**, nicht `31*1.02^lvl`, sondern `floor(min(30 + 1.02^lvl, 40))` = 31 (`BitNode.tsx:923`). |
| V2-Simulation, Aktionsverfuegbarkeit | `getAvailability`-Ueberschreibungen je Aktion | **LUECKE**: `Raid` verlangt `city.comms >= 1` (`Operations.ts:147-150`), einzige Aktion mit Zusatzbedingung. Bezifferte Obergrenze jetzt in 4.2. |
| Portprogramme $287 Mio | BN-Multiplikator auf `DarkWebItem.price`? | **keiner** (`DarkWebItem.ts:3-12`, reine Konstante). Haelt; TOR war einmal doppelt gezaehlt, korrigiert. |
| 13 `isTrusted`-Stellen | Variantensuche `grep -i trusted` (67 Treffer) | **haelt**: die 54 zusaetzlichen Treffer liegen alle in `Casino/Roulette.tsx`, `CoinFlip.tsx`, `SlotMachine.tsx`, `utils.ts` — Bereiche, die ohnehin in der Liste stehen. |
| Softcap/Cost/Limit/MaxRam je Knoten | Nachbearbeitung nach dem `switch`? | **haelt**: `getBitNodeMultipliers` ist ein reiner `switch`, der `new BitNodeMultipliers({...})` zurueckgibt (`BitNode.tsx:564-570`). |
| 21 Black Ops, 6 Operations, 3 Contracts | Enum gegen `numberOfBlackOperations` | **haelt** (21/6/3). |
| RAM-Tabelle 7.3 | entfaellt — **gemessen** | — |

**Fuenf Fehler und eine Luecke in elf pruefbaren Zahlen.** Die Bedingung war
berechtigt, und die Quote sagt etwas ueber die Verlaesslichkeit der uebrigen
Handrechnungen hier. Wo es ging, ist jetzt gemessen statt gerechnet (7.3); wo
nicht, steht die Ableitung im Text, damit sie nachgerechnet werden kann.
Keiner der fuenf Fehler beruehrt die Route.

### 8.6 Runde 3 — die uebrigen Bescheide

| Bedingung | Bescheid |
|---|---|
| **S1: Produkt auf 22,89, beide Fundstellen** | **Angenommen**, 4.1 (mit Herkunftstabelle) und 4.3. `BigDsBigBrain` schaerfer als von ihm formuliert: **kein `factions`-Eintrag und im ganzen Baum keine Vergabestelle** ausser der Definition. |
| **S1: BN2 beziffern oder zuruecknehmen** | **Zurueckgenommen**, mit Rechnung (8.3a): 2,0e12 EXP sind selbst mit einer Farm vom Format des BN1-Endstands noch 4.400 h. Zusatzertrag: 4.1 hat jetzt einen Schnitt als **Bandbreite** (eff. 4.500-12.000) auf gemessener Rate, und 6.3 teilt die Knoten in drei Rueckfallklassen. |
| **S1: alle Auszaehlungen gegen ihre Filter** | **Angenommen und ausgefuehrt**, 8.5. |
| **S2 A: Vorbedingung 7 nicht baubar** | **Angenommen, vollstaendig.** Die `stopFlag`/`ScriptDeath`-Kette ist nachvollzogen (`killWorkerScript.ts:85`, `APIWrapper.ts:79`, `NetscriptHelpers.tsx:448-454`), und der heutige Code belegt sie selbst. Herzschlag jetzt ueber `W.terminal("run puls.js")`. Sein Kernargument — ein Timer-Nachweis beweist die falsche Sache, gebraucht wird **Handlungsfaehigkeit** — ist uebernommen. |
| **S2 B: BitVerse ist der Fehlerzustand** | **Angenommen, alle drei Teile.** (i) BitVerse-Zweig mit `aria-label="enter-bitnode-N"`, N als Argument beim Setzen (7.2). (ii) **Ausgang A bleibt Rueckfall, bis T2 bestanden ist** (7.2, 7.8). (iii) 7.8 nennt Ausgang B als T2 mit "Abbruch auf BitVerse" als Pruefkriterium. Neu dazu: `data/puls.json` in 7.7 trennt "Timer tot" von "Terminal gesperrt". |
| **S3 1: `SingularityFn3` unteilbar** | **Angenommen**, 7.4 schraenkt die 64-GB-Aussage auf die V2-Kette ein und nennt die sechs Funktionen. Kleine Gegenrechnung: ein 128-GB-Rechner kostet in BN8 **$28,2 Mio**, nicht $56,3 Mio (`128 * 55.000 * 4^1`). An seinem Punkt aendert das nichts. |
| **S3 2: 30 gegen 31, 43,06 gegen 50,36** | **Bestaetigt — es ist eine dritte Frage.** Die 31 enthalten `NeuroFluxGovernor` mit Basiswert 1,01; ohne ihn 30 und 43,06. Ohne die beiden Stanek-Malusse 50,36 ("was ist maximal nicht schaedlich"). 4.1 beantwortet die dritte Frage: **was ist beschaffbar** (23,1 bzw. 22,9). Alle drei stimmen, sie beantworten Verschiedenes; 4.1 trennt sie in einer Tabelle. |
| **S3 3: DOM-Ausgang vor BN6 testen** | **Angenommen** als **T1** in 7.8 — sofort, an einer Spielstandkopie, gezielt auf das **Portal** (das bisher nichts im Projekt benutzt), nicht auf den MUI-Knopf, den `homeram.js` seit Wochen klickt. |

### 8.7 Was aus der Route herausbleibt

- **Corporation (SF3):** `CorporationInfo 10 GB` / `CorporationAction 20 GB`
  (`RamCostGenerator.ts:13-14`) — die volle API liegt bei ~960 GB gegen einen
  Skriptdeckel von 1.024 GB. Dazu $150 Mrd Startkapital ausserhalb BN3. Wird in
  BN3 gebaut, weil man dort ohnehin ist; sonst nie.
- **Stanek (SF13):** Effekt logarithmisch in Threads
  (`CotMG/formulas/effect.ts:3-12`); Eintrittspreis `StaneksGift1` = -10 % auf
  praktisch jeden Multiplikator; Ladung wird bei jedem Aug-Einbau geloescht.
  Nur in BN13 mitgenommen.
- **NeuroFlux-Farmen:** `1.14^level` auf Rep und Geld, dazu `1.9^queued`
  (`AugmentationHelpers.ts:127-139`). Verstaerker fuer V1, kein Routenargument.

---

## 9. BN4-Planerabstimmung

Ausgelagert: **[`nodes/bn4/PLANER.md`](bn4/PLANER.md)**. Kurzfassung: der
gemessene Faktor 7 zwischen Modell und Wirklichkeit ist aufgeklaert — nur
**6,6 %** der Arbeiter-RAM-Sekunden gehen auf `hack`, wo ~47 % moeglich waeren.
Ursache sind die Beuteschwelle und die Zuteilung nach freiem Speicher, nicht
Ausgaben, nicht Drosselung, nicht zu wenige Ziele.

---

## 10. Offene Fragen und benannte Unsicherheiten

1. **Die V2-Zeiten sind simuliert, nicht gemessen** — die groesste
   Unsicherheit des Plans. Die Simulation setzt die **Erfolgsrate auf 1,0**;
   faellt sie durch Chaos oder zu niedrige Kompetenz, kosten Fehlschlaege
   zusaetzlich Rang (`rankLoss`, `Formulas.ts:30-44`) und Counts. **Erster
   Messpunkt: Rang nach 2 h in BN6 muss >= 6.000 sein — aber nur, solange
   `comms >= 1` in der Arbeitsstadt ist; ohne `Raid` lautet der Anker
   >= 3.500** (4.2, 6.3).
2. **Chaos-Beherrschung.** Incite Violence traegt bei 0 Sleeves 45 % der
   Gesamtzeit (4.2) und erzeugt Chaos, das nur `Diplomacy` senkt — wirksam erst
   bei sehr hohem Charisma (`Bladeburner.ts:735-743`). Ohne beherrschbares
   Chaos faellt BN6 von 48 h auf 112 h. **Der wahrscheinlichste Grund, dass die
   Route langsamer wird**, und der Ort, an dem ich am ehesten irre.
3. **`Raid` und `city.comms`** (4.2). Die Raid-freie Obergrenze ist beziffert
   (BN6: 84 h statt 48 h), der Zwischenwert nicht. Ein Bot, der `switchCity`
   nutzt, sollte naeher an der unteren Zeile liegen — belegt ist das nicht.
4. **Team-Verluste.** Jeder der 21 Black Ops kostet mindestens ein
   Teammitglied (`BlackOperation.ts:63-65`); Rekrutierung laeuft ueber die
   General Action `Recruitment` und haengt an Charisma. Zeitaufwand **nicht**
   gerechnet.
5. **Der DOM-Ausgang (7.2) ist argumentativ belegt, nicht getestet** — kein
   `isTrusted` im Handler, und `homeram.js` klickt seit Wochen erfolgreich
   MUI-Knoepfe derselben Bauart. Deshalb T1 sofort (7.8) und Ausgang A als
   Rueckfall, bis T2 bestanden ist. Bis SF4 vorliegt, ist der DOM-Weg der
   **einzige** Ausgang der ganzen Route.
6. **Der BN4-Sockel (60-120 h) ist eine Bandbreite, keine Simulation.** Die
   Abbruchbedingung in 6.1 ist die Absicherung.
7. **Die Erfahrungsrate ist ein Band, kein Wert.** 4.1 rechnet mit 1e2 bis
   1e3 EXP/s (heutiges Netz, zwei unabhaengige Herleitungen) und 1e5 EXP/s
   (ausgebaute Farm, linear hochskaliert). Der V1-Schnitt steht deshalb als
   Bandbreite 4.500 bis 12.000, nicht als eine Zahl. **Ungeklaert bleibt, wie
   schnell die Farm in den gedaempften Knoten ueberhaupt waechst** — genau dort
   ist Geld der Engpass, und genau davon haengt ab, ob BN3, BN4, BN11 und BN15
   in der mittleren oder in der unteren Klasse landen. Fuer die Route ist das
   folgenlos (BN8 liegt bei 3.000), fuer den Rueckfall nicht.
8. **Der Quelltextbaum meldet v3.0.2**, die Aufgabenstellung sprach von 3.0.1.
   Zeilennummern koennen abweichen.

*(Erledigt gegenueber Fassung 3: `ns.getResetInfo` ist gegen
`NetscriptDefinitions.d.ts:86-94` geprueft — `currentNode`, `lastNodeReset`,
`ownedAugs` und `ownedSF` sind die richtigen Feldnamen fuer `boot.json`.
BN9 ist in 7.5 geloest.)*
