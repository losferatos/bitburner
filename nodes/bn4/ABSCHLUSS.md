# BN4 — Abschlussplan (22.08.2026, Fassung 3)

> **UEBERHOLT SEIT 23.08.2026.** Der Plan steht auf "m = 14 statt 16" - die
> Zeitrechnung dahinter war Faktor 338 zu optimistisch (4,07e8 statt
> gemessener 1,2e6 Erfahrung je Sekunde). Die noetige Schwelle liegt bei
> mult 16 bis 17. Auch die Empfehlung zu b1tflum3 ist damit neu zu bewerten.
> Siehe `nodes/bn4/INVENTUR-ERGEBNIS.md` und `nodes/bn4/BEFUNDE.md`.

> **Fassung 3** arbeitet elf Befunde eines Skeptikers (B1-B11) und drei
> Messkorrekturen eines zweiten Agenten (N1-N3) ein. **Alle vierzehn wurden
> nachgerechnet, nicht uebernommen.** Zehn halten unveraendert, drei halten in
> der Diagnose, aber nicht in der Therapie, einer ist gegen die Beobachtung
> aufgeloest. Die Einzelurteile stehen in **Abschnitt 8**.
>
> **Drei Dinge haben sich substanziell geaendert:**
>
> 1. **Der Rechnerpark ist kein Kostenposten, sondern Zinseszins.** Fassung 2
>    und der Skeptiker haben beide mit *festem* Park gerechnet — der eine mit
>    1,6 PB und falschem Etikett, der andere mit 79 TB. Beides ist falsch: der
>    Park waechst waehrend jeder Phase aus sich selbst, von $1.262 auf 25 PB in
>    6-10 h. Das gekoppelte Modell steht in **2.2** und traegt jede Zeitzahl
>    dieses Dokuments.
> 2. **Der Multiplikator-Sockel ist niedriger als gedacht (8,68 statt 9,11),
>    das Multiplikatorziel aber ebenfalls (m = 14 statt 16).** Beides zusammen
>    hebt sich fast auf. NeuroFlux Stufe **48** statt 57 reicht, und damit
>    verschwindet das Geldproblem aus B2.
> 3. **Der dominierende Posten ist ein anderer:** nicht mehr die
>    Reputationsbeschaffung als Ganzes, sondern **der eine Zyklus, in dem
>    Clarke, OmniTek und Daedalus gleichzeitig bezahlt werden** (Z4, 30-45 h).
>
> **Neue Restzeit: ~72-135 h Spielzeit, Erwartungswert ~95 h** (5.1) — gegen
> 71-132 h in Fassung 2. Die Zahl ist fast gleich; darunter hat sich fast alles
> bewegt.
>
> **Neue Empfehlung: der Bescheid kippt.** Fassung 2 empfahl BN4 zu Ende zu
> spielen, falls der DOM-Ausgang nicht getestet ist, weil sonst 13 Knoten an
> einem ungetesteten Alleinausgang haengen. **Es sind nicht 13, es sind zwei**
> (6.2). Damit traegt das Risikoargument nicht mehr die 78-150 h. Begruendung
> in **Abschnitt 6**.

Alle Zahlen entweder **[gemessen]** am laufenden Spielstand ueber die Bruecke
auf Port 8795, **[belegt]** aus `reference/bitburner-src/src/` (meldet v3.0.2)
mit Datei:Zeile, **[gerechnet]** aus belegten Formeln mit genannten Annahmen,
oder **[zu bauen]** — noch nicht vorhandene Bot-Faehigkeit.

Der Messrahmen bleibt der der Fassung 2: **962 s Spielzeit am 22.08.2026,
08:28-08:44 Uhr**, `playtimeSinceLastBitnode` 63.913 -> 64.875 s, 16 Proben im
Minutenabstand, Netzgroesse konstant.

---

## 0. Der Befund in einem Satz

Der Engpass ist der **Levelmultiplikator `mults.hacking`**, und der kommt aus
**eingebauten** Augmentierungen, die an **Faktionsreputation** haengen. Alles
andere — Level, Geld, Rechnerpark — reguliert sich selbst, sobald der
Multiplikator stimmt.

Reputation ist **exklusive Zeit**: wer fuer eine Faktion arbeitet, arbeitet
nicht fuer eine andere und nicht fuer eine Firma. Geld und Erfahrung entstehen
daneben ohne Zutun. **Der ganze Plan ist deshalb eine Rechnung darueber, welche
Reputation zu welchem Hackinglevel bezahlt wird.** Dieselben 462.490 Reputation
kosten bei Level 1.100 vierzehn Stunden und bei Level 2.900 sechs.

---

## 1. Bestandsaufnahme

### 1.1 Der Spielstand

| Groesse | Wert | Herkunft |
|---|---|---|
| BitNode | 4, seit **18,0 h** (`playtimeSinceLastBitnode` 64.875 s) | [gemessen] |
| Hackinglevel | **518** | [gemessen, 22.08. 13:30] |
| `mults.hacking` | **1,38536** | [gemessen] |
| `mults.faction_rep` / `hacking_exp` | 1,16348 / 1,54540 | [gemessen] |
| Guthaben | $16,8 Mrd | [gemessen, 13:30] |
| Augmentierungen | **9 installiert, 6 in der Warteschlange** | [gemessen, 13:30] |
| Faktionen | TBH, NiteSec, Aevum, Sector-12, CyberSec, **BitRunners** | [gemessen] |
| Netz gesamt | **129.452 GB** inkl. `home` 2.048 GB | [gemessen, 13:30] |
| Boerse | kein Zugang | [gemessen] |
| Source-Files | nur SF1.1 | [gemessen] |
| Karma / Kampfwerte | -277,8 / str 1, def 1, dex 42, agi 38 | [gemessen] |

Die 9 installierten tragen drei `hacking`-Multiplikatoren: BitWire 1,05 x
CSP-G1 1,05 x ENM 1,08 = 1,1907; mal SF1.1 (`applySourceFile.ts:20-26`) =
**1,38536**. Der gemessene Wert reproduziert sich exakt. [belegt/gerechnet]

### 1.2 Die drei Ratengesetze

Alles Weitere haengt an drei Konstanten. Zwei sind gemessen, eine ist es nur
zur Haelfte.

| Groesse | Gesetz | Verankerung |
|---|---|---|
| **Hacking-Erfahrung** | `1,133e-4 x (level+50) x RAM_GB` exp/s | [gemessen] bei Level 451,5 / 79.276 GB / 4.505 exp/s |
| **Geld** | `6,44e-2 x (level+50) x RAM_GB` $/s | [gemessen] bei Level 451,5 / 79.276 GB / $2,567 Mio/s |
| **Faktionsarbeit** | `3,40 rep/s x (L/460) x ((1+favor/100)/1,4164) x (faction_rep/1,16348) x shareBonus` | [gemessen] NiteSec 3,40 rep/s bei Level 460, Favor 41,64 |

Die Linearitaet in `(level+50)` folgt aus `calculateHackingTime`
(`Hacking.ts:57-79`: `skillFactor / (hacking + 50)`), die Linearitaet in RAM
aus der Fadenzahl. **Beide sind bei 79 TB verankert und werden in diesem
Dokument bis 25 PB extrapoliert.** Das ist die groesste offene Annahme des
Plans; sie wird in 2.2 geprueft und in Abschnitt 7 als Hauptrisiko gefuehrt.

### 1.3 Die vier Tore

`Singularity.ts:1124-1176` und `FactionInfo.tsx:138-149` [belegt];
`DaedalusAugsRequirement` fehlt in `BitNode.tsx` case 4, gilt also mit dem
Vorgabewert **30** (`BitNodeMultipliers.ts:61`). Bladeburner scheidet aus.

| # | Tor | Ist | Soll |
|---|---|---|---|
| 1 | Augmentierungen **installiert** | 9 | **30** |
| 2 | Guthaben | $16,8 Mrd | $100 Mrd |
| 3 | Hacking (Daedalus) | 518 | **2.500** |
| 4 | Daedalus-Reputation | 0 | **2.500.000** |
| 5 | Hacking (Endkampf) | 518 | **9.000** |

`haveAugmentations(n)` prueft `p.augmentations.length >= n`
(`FactionJoinCondition.ts:116-131`) — die Warteschlange zaehlt nicht, und
NeuroFlux zaehlt als genau ein Eintrag, egal auf welcher Stufe.

---

## 2. Der Multiplikator und der Park

### 2.1 Die Stufentabelle — korrigiert

Maschinelle Auszaehlung ueber `Augmentations.ts` (Klammer-Matching, Skript im
Scratchpad): **31 Augmentierungen tragen ein `hacking`-Feld**, davon 25 ueber
Faktionen kaufbar (`BigDsBigBrain` hat `factions: []`, `TheSword` ist
`isSpecial`, die drei Staneks-Gaben verlangen SF13, NFG wird gesondert
gefuehrt).

**Fassung 2 hat die Stufentabelle kumulativ aufgebaut und dabei die
Verbrecherkette mitgeschleppt, die die Route nie baut.** Der Befund B5 haelt
und ist hier eingearbeitet — die Tabelle zeigt jetzt getrennt, was der Plan
tatsaechlich erreicht:

| Stufe | Faktionsmenge | hacking-Produkt | **m mit SF1.1** |
|---|---|---|---|
| **A** | heutige 5 (TBH, NiteSec, Aevum, Sector-12, CyberSec) | 1,9065 | **2,218** |
| **B-** | + BitRunners ohne Neurolink/ENMCoreV2 | 3,0535 | 3,553 |
| **B** | + BitRunners vollstaendig | 3,7924 | **4,412** |
| **C** | + Clarke Inc. | 5,2335 | 6,089 |
| **D** | + OmniTek | 6,7826 | **7,891** |
| **E** | + Daedalus (ENM Core V3 x1,1) | 7,4609 | **8,681** |
| E+T | + Tetrads (PowerRecirculator x1,05) | 7,8339 | 9,115 |
| E+N | + NWO (Xanipher x1,2 **und** PowerRecirculator) | 9,4007 | 10,938 |

**Der Sockel des Plans ist 8,681, nicht 9,11.** Die 9,11 der Fassung 2
enthielten den PowerRecirculator, den es nur bei Tetrads, The Dark Army, The
Syndicate und NWO gibt (`Augmentations.ts:1437-1456`, Zeile 1456 ist die
`factions`-Zeile) — also genau in der Verbrecherkette, die 2.1 und 4.3d der
Fassung 2 als "dominiert" verwerfen. [belegt, B5 haelt]

**Zwei Schwellen sind entscheidend und stehen dicht beieinander:**

- **m < 3,6 macht Level 2.500 unbezahlbar.** Bei m=3,553 dauert es 83 h, bei
  m=4,14 zwoelf, bei m=4,412 neun (2.2). Die drei teuren BitRunners-Augs
  (Neurolink x1,15, ENM Core V2 x1,08) sind damit **keine Feinarbeit, sondern
  das Tor zu M5a**.
- **m < 13 macht Level 9.000 unbezahlbar** (2.3).

### 2.2 Der Park ist Zinseszins, kein Kostenposten — das gekoppelte Modell

**Das ist die wichtigste Korrektur der Fassung 3, und sie trifft Fassung 2 und
den Skeptiker gleichermassen.**

Fassung 2 rechnete Level- und Endkampfzeiten bei **fester** Netzgroesse und
suchte sich dann die passende Zeile aus. Der Skeptiker hat das zurecht
angegriffen (B1) — aber er hat dieselbe Tabelle mit der Zeile "79 TB" gelesen
und daraus 329,8 h gemacht. **Beide Zeilen sind falsch, weil der Park nicht
fest ist.** Erfahrung *und* Geld sind beide linear in RAM (1.2); Geld kauft
RAM; RAM macht Erfahrung und Geld. Der Vorgang ist selbstverstaerkend, bis der
Deckel greift.

Der Deckel: **25 Rechner** (`Server/data/Constants.ts:12`) zu je hoechstens
**1.048.576 GB** (`:13`), Preis `RAM x 55.000 x 1,2^(log2(RAM)-6)`
(`ServerPurchases.ts:22-40`, `CloudServerSoftcap 1.2` aus `BitNode.tsx:631`).
Ein voller Park kostet **25 x $740 Mrd = $18,5 Billionen** und misst
**25 PB**. [belegt]

Simulation ab dem Zustand direkt nach einem Einbau ($1.262, kein Park,
`home` 2.048 GB, `prestigeAllServers()` in `Prestige.ts:74` hat alles
geloescht), Geld wird laufend in die naechste Zweierpotenz reinvestiert
[gerechnet, Skript im Scratchpad]:

| m | nach 4 h | nach 6 h | nach 8 h | nach 10 h | nach 12 h |
|---|---|---|---|---|---|
| **1,385** (heute) | Lv 411 / 0,03 PB | Lv 469 / 0,05 PB | Lv 515 / 0,10 PB | Lv 555 / 0,20 PB | Lv 591 / 0,41 PB |
| **2,218** (Stufe A) | Lv 754 / 0,05 PB | Lv 865 / 0,20 PB | Lv 953 / 0,41 PB | Lv 1.027 / 1,6 PB | Lv 1.096 / 3,3 PB |
| **4,412** (Stufe B) | Lv 1.870 / 0,41 PB | Lv 2.149 / 1,6 PB | Lv 2.374 / 6,6 PB | Lv 2.547 / **25 PB** | Lv 2.682 / 25 PB, $34 Bio |
| **7,891** (Stufe D) | Lv 4.049 / 3,3 PB | Lv 4.639 / **25 PB** | Lv 4.925 / 25 PB | Lv 5.060 / 25 PB, $130 Bio | Lv 5.148 / $193 Bio |
| **8,681** (Stufe E) | Lv 4.608 / 6,6 PB | Lv 5.237 / **25 PB** | Lv 5.486 / 25 PB | Lv 5.618 / $161 Bio | Lv 5.709 / $231 Bio |

**Drei Folgerungen, die den Plan umbauen:**

1. **Der Parkaufbau kostet 6-10 h je Zyklus und ist damit der Preis jedes
   Einbaus** — nicht null, wie Fassung 2 unterstellte (B8 haelt), aber auch
   nicht mehr. Er ist in jedem Zyklus in Abschnitt 4 eingepreist.
2. **Ab etwa Stunde 10 eines Zyklus ist Geld keine Groesse mehr.** Bei vollem
   Park und Level 2.700 laeuft die Kasse mit **~$18.000 Mrd/h**, bei Level
   5.700 mit **~$37.000 Mrd/h**. Die $352 Mrd/h aus Fassung 2 sind die Zahl
   fuer 3,3 PB **bei Level 460** — sie ist um Faktor 50 zu klein fuer die
   Stelle, an der Fassung 2 sie benutzt. (Der Skeptiker hat mit derselben Zahl
   weitergerechnet, B2.)
3. **Die Selbstverstaerkung bricht bei m unter etwa 3,5 zusammen**, weil das
   Level dann nicht mehr schnell genug steigt, um die naechste Parkstufe zu
   verdienen. Bei m=2,218 steht man nach 12 h bei Level 1.096 und kommt kaum
   weiter.

**Haelt die Geldlinearitaet bis 25 PB? — Wahrscheinlich ja, und der Grund ist
ein anderer als in Fassung 2.** Fassung 2 fuerchtete die Summe aller `moneyMax`
($797,2 Mrd [gemessen]) als Deckel. Das ist der falsche Vergleich: der Topf ist
kein Vorrat, sondern ein Durchsatz — `grow` fuellt ihn wieder, und mit
Fliessbandbetrieb (HWGW) laesst sich je Ziel mehrfach je Weaken-Fenster
abschoepfen. Der echte Deckel ist die **Taktgranularitaet**: `MilliPerCycle`
ist 200 ms (`Constants.ts:19`), ein Weaken-Fenster misst bei Level 2.900 rund
9 s, es passen also ~45 Buendel je Ziel und Fenster. Bei ~70 Zielen und
~3.000-5.000 Faeden je Buendel sind das **10-16 Mio nutzbare Faeden**, bei
1,75 GB je Faden **18-28 PB**. **Der Park saettigt also ziemlich genau dort,
wo der Kaufdeckel ohnehin greift.** [gerechnet — nicht gemessen, siehe 7.1]

Zur Sicherheit fuehrt dieses Dokument jede kritische Zeitzahl **zweifach**:
einmal mit ungebremster Linearitaet, einmal mit einem harten Deckel von
**$1.000 Mrd/h**. Der Deckel ist die pessimistische Annahme, dass die
Geldlinearitaet schon bei ~1 PB endet.

### 2.3 Wieviel Multiplikator braucht Level 9.000 — das Knie liegt bei 13,5

Zeit von Level 1 bis 9.000, ab Einbau ($1.262, kein Park), Park waechst mit
[gerechnet]:

| m | 12 | 13 | **14** | **15** | 16 | 17 | 18 |
|---|---|---|---|---|---|---|---|
| Geld linear | 87,8 h | 17,0 h | **5,8 h** | 3,4 h | 2,6 h | 2,1 h | 1,7 h |
| Deckel $1.000 Mrd/h | 97,7 h | 27,0 h | **12,1 h** | 6,3 h | 3,8 h | 2,5 h | 1,8 h |

**Das Knie liegt bei m = 13,5, nicht bei 15.** Fassung 2 kam auf 15, weil sie
mit festem Park rechnete. **m = 14 ist das Arbeitsziel**; alles darueber kauft
wenige Stunden fuer viel Reputation und Geld.

Aus Stufe E (m = 8,681) fehlt damit der Faktor **1,613** — und der kommt aus
NeuroFlux.

### 2.4 NeuroFlux Governor — Reputation gratis, Geld ist die Waehrung

`getAugCost` (`AugmentationHelpers.ts:132-139`) [belegt]:

```
repCost   = 500     * 1,14^L * AugmentationRepCost      (in BN4: x1)
moneyCost = 750.000 * 1,14^L * AugmentationMoneyCost * getGenericAugmentationPriceMultiplier()
```

`L` ist `aug.getLevel()`, und das zaehlt **jede gekaufte Stufe als eigenen
Eintrag in `queuedAugmentations`** (`Augmentation.ts:238-246`).
`getGenericAugmentationPriceMultiplier()` ist `1,9^(Zahl der wartenden
Nicht-SoA-Augs)` (`AugmentationHelpers.ts:30-37`, `Constants.ts:41`).
**Jede weitere NFG-Stufe im selben Zyklus kostet also 1,14 x 1,9 = 2,166 mal
die vorige.** [belegt — B2 haelt in diesem Punkt vollstaendig]

Wirkung `1,01^L` auf `hacking` (`Augmentations.ts:1159-1203`; der
`donationBonus` in `:1170-1194` ist 262/1e6/100 und vernachlaessigbar).
Angeboten von **jeder** Faktion ausser SoA, Bladeburners und Church of the
Machine God (`Augmentations.ts:1197-1202`). [belegt]

| Ziel-m | Stufe ab 8,681 | Rep-Schwelle `500 x 1,14^(N-1)` | Geld, 5 Zyklen, DP-optimiert |
|---|---|---|---|
| 12,0 | 33 | 26.630 | ~$3e11 |
| 13,0 | 41 | 90.000 | ~$1,2e12 |
| **14,0** | **48** | **236.250** | **~$5,3e12** |
| 15,0 | 55 | 590.650 | ~$2,0e13 |
| 16,0 | 62 | 1.479.674 | ~$1,3e14 |
| 18,0 | 74 | 7.130.000 | unbezahlbar |

**Zwei Befunde, die B2 und B3 zusammen aufloesen:**

- **Die Reputation fuer NeuroFlux kostet nichts.** NFG ist bei jeder Faktion zu
  haben, auch bei **Daedalus**, wo fuer The Red Pill ohnehin **2.500.000**
  liegen. Jede Stufe bis 66 (`500 x 1,14^65` = 2,49 Mio) ist damit von der
  Daedalus-Schwelle mit abgedeckt. Die Zeile "NeuroFlux Stufe 57 = 874.000" in
  Tabelle 3.4 der Fassung 2 war **doppelt gezaehlt**. [B3 haelt]
- **Das Geld ist bei Stufe 48 kein Problem.** $5,3 Billionen sind bei vollem
  Park **~18 Minuten**. B2's "$8,7e24 in einem Zyklus" ist exakt reproduziert
  und richtig — aber es ist ein Argument gegen *einen* Zyklus, nicht gegen die
  Stufe. Und B2's Ausweg (5 auf 12 Einbauzyklen strecken) ist **nicht noetig**:
  fuenf Zyklen genuegen, wenn die NFG-Stufen ueber sie verteilt und **innerhalb
  jedes Zyklus vor den teuren Augs** gekauft werden.

**Kaufregel [zu bauen], sie ist bindend:** In jedem Zyklus zuerst die
NFG-Stufen (aufsteigend, sie muessen es), dann die uebrigen Augs **absteigend
nach Grundpreis**. Die heutige aufsteigende Sortierung ist bei `1,9^wartend`
die teuerstmoegliche Reihenfolge; bei 12 Kaeufen liegt ein Faktor 2.214 auf dem
letzten Posten.

### 2.5 Was ein Einbau kostet

`prestigeAugmentation` [belegt]: verloren gehen Hackinglevel und alle Erfahrung
(`PlayerObjectGeneralMethods.ts:85-100`), **das Guthaben faellt auf
$1.000 + 262 = $1.262** (`:103` mit `Constants.ts:107`), **alle 25 gemieteten
Rechner werden geloescht** (`Prestige.ts:74`), dazu alle Programme ausser NUKE,
alle Backdoors, alle Faktions- und Firmenmitgliedschaften und -reputationen.

> Der Skeptiker zitiert fuer die $1.262 `Constants.ts:107`. Dort steht
> `Donations: 262`; die ausfuehrbare Zeile ist
> `PlayerObjectGeneralMethods.ts:103`. Sachlich unveraendert. [B8 haelt]

Erhalten bleiben: Augmentierungen, **Favor** (und es waechst), Karma,
`home`-RAM und -Kerne, alle Dateien auf `home`.

**Preis eines Einbaus in Zeit: 6-10 h Parkwiederaufbau** (2.2) **plus die
gesamte Faktionsreputation, die im naechsten Zyklus wieder gebraucht wird.**
Der zweite Posten ist der teurere — und der Grund, warum Favor 150 (3.2) der
wichtigste Einzelhebel des Plans ist.

**`keepOnInstall` bleibt gueltig** (Fassung 2, 2.6): `prestigeAugmentation`
sammelt vor dem Zuruecksetzen alle Faktionen mit `keep`-Flag und traegt sie
danach unbedingt wieder als Einladung ein (`Prestige.ts:61-66`, `:118-120`);
`joinFaction` (`Singularity.ts:750-768`) prueft **keine** Bedingung erneut. Die
zehn Firmenfaktionen tragen das Flag. **Anstellung und Firmenreputation sind
ein Einmalposten fuer den ganzen Knoten.**

---

## 3. Die Reputationsseite

### 3.1 Die Kanaele — mit der Firmenkorrektur N2

`FactionWorkRepGain = 0.75` in BN4 (`BitNode.tsx:645`); `CompanyWorkRepGain`
fehlt in case 4 und steht nur in case 11 — **Firmenreputation ist in BN4
ungedaempft**. [belegt]

Die vollstaendige Firmenformel (`CompanyPosition.ts:156-172`, 5 Takte je
Sekunde):

```
rep/s = 5 * repMultiplier * SUMME(effectiveness_i * skill_i)/975/100
          * mults.company_rep * (1 + Firmenfavor/100)
```

**N2 haelt vollstaendig, nachgerechnet.** In Stufe B tragen drei der Augs einen
`company_rep`-Multiplikator: **Magnetism x1,1** (`Augmentations.ts:1055`, The
Black Hand, 15.000 Rep), **PCMatrix x1,0777** (`:1406`, Aevum, 100.000 Rep),
**Wit x1,05** (`:2042`, BitRunners/Slum Snakes, 5.000 Rep). Produkt 1,24473,
mal SF1.1 = **`mults.company_rep` = 1,44821**. Zum Vergleich traegt nur PCMatrix
ein `faction_rep`-Feld, also **`mults.faction_rep` = 1,25388**. [belegt]

**Damit sind diese drei Augs Pflichtkaeufe vor dem Firmenzyklus**, nicht
Beiwerk — sie heben die Firmenrate um 24 % und die Faktionsrate um 7,8 %.
Das steht so in keiner frueheren Fassung.

Raten bei Stufe-B-Multiplikatoren [gerechnet, gegen den Messanker geprueft]:

| Level | Faktion, Favor 0, share 1,0 | Faktion, Favor 0, share 1,4 | Faktion, Favor 150, share 1,4 | Firma IT Analyst | Firma **Systems Administrator** |
|---|---|---|---|---|---|
| 1.100 | 8,7 | 12,2 | 30,4 | 7,8 | 9,3 |
| 1.900 | 15,0 | 21,0 | 52,5 | 13,4 | 16,1 |
| **2.500** | 19,7 | **27,6** | **69,1** | **17,5** | **21,0** |
| 2.900 | 22,9 | 32,0 | 80,0 | 20,2 | 24,3 |
| 5.000 | 39,4 | 55,2 | 138,0 | 34,8 | 41,8 |

Der Messanker fuer die Firmenrate: **2,936 rep/s** als IT Analyst bei Hacking
526 / Charisma 19 / `company_rep` 1,16348 / Favor 0 [gemessen]; die Formel
liefert 2,953. Fassung 2 nannte 14,09 rep/s bei Level 2.500 — richtig sind
**17,5**, und mit der Befoerderung zum Systems Administrator **21,0**.

**Die Befoerderung ist gratis und lohnt.** `JobName.IT3` (Systems
Administrator) hat `repMultiplier: 1.4` gegen 1,1 beim IT Analyst
(`CompanyPositionsMetadata.ts`, IT-Block) und verlangt Hacking 251, Charisma 76
und 175.000 Firmenreputation — mit Backdoor **131.250**
(`Constants.ts:110` -> `Company/utils.ts:15-19` -> `GetJobRequirements.ts:15-16`).
Da ohnehin 300.000 aufgebaut werden, faellt die Befoerderung unterwegs an.
Charisma 76 kostet rund 40 Minuten Universitaet; **das ist der einzige Punkt,
an dem sich Charisma-Training in diesem Plan rechnet** (+20 % auf einen
8-10-h-Posten).

Die uebrigen Kanaele unveraendert aus Fassung 2: `ns.share`
(`Share.ts:43-48`, `bonus = 1 + ln(threads)/25`, bei 20 % Parkanteil x1,335),
Passiveinnahme (`FactionHelpers.tsx:155-168`), Codingvertraege
(~5.700 rep/h ueber alle Faktionen verteilt, ~9 % der Faktionsarbeit),
Spenden (`donation.ts:9-11`).

### 3.2 Die Spendenschwelle — und warum sie fast alles entscheidet

`favorToRep(f) = 25.000 x (e^(0,019802627296179712 x f) - 1)`
(`Faction/formulas/favor.ts:12-15`), `favorNeededToDonate = 150 x 1`
(`donation.ts:16-18`, `Constants.ts:31 BaseFavorToDonate: 150`,
`FavorToDonateToFaction` fehlt in BN4). [belegt]

**Favor 150 entspricht exakt 462.490,9 Reputation.** (Fassung 2 nannte
462.550 — nachgerechnet falsch, aber folgenlos.)

Favor waechst nur beim Einbau (`addRepToFavor`), nicht laufend. Ab Favor 150
kostet Reputation nur noch Geld: `rep = $/1e6 x 1,25388 x 0,75`, also
**$1 Mrd = 940 rep**, oder umgekehrt **1 Mio rep = $1,06 Billionen** — bei
vollem Park **drei Minuten**.

**Der Favor-Umweg lohnt genau dann, wenn die hoechste Schwelle einer Faktion
ueber 462.490 liegt.** Das ist der Kern von B4, und **B4 haelt**:

| Faktion | hoechste noetige Schwelle | Favor-Umweg? |
|---|---|---|
| **Daedalus** | The Red Pill 2.500.000 | **ja** — spart 2,04 Mio Arbeit |
| **BitRunners** | ENM Core V2 1.000.000 | **ja** — spart 538k Arbeit |
| **OmniTek** | OmniTek InfoLoad 625.000 | **ja** — spart 163k Arbeit |
| **Clarke Inc.** | nextSENS **437.500** | **nein** — der Umweg ist um 24.991 rep teurer |
| The Black Hand | ENM Core 175.000 | nein |
| Aevum | PCMatrix 100.000 | nein |
| NiteSec | CRTX42-AA 45.000 | nein |
| CyberSec | CSP-G2 18.750 | nein |

Fassung 2 zaehlte Clarke in den Favor-Vorlauf und kam auf 1,85 Mio.
**Richtig sind 3 x 462.490 = 1.387.470.** [B4 haelt]

> Eine Einschraenkung, die B4 nicht nennt: der Abstand betraegt nur 24.991 rep
> — bei Level 2.500 rund **fuenfzehn Minuten**. Wer Clarke trotzdem auf 462.490
> zieht, kauft sich fuer eine Viertelstunde das Recht, in **jedem spaeteren
> Zyklus** Clarke-Reputation mit Geld zu erzeugen. Das ist billige
> Versicherung gegen einen Fehlkauf, und der Plan in 4.1 nimmt sie mit.

### 3.3 Bestand, nicht Summe — die Schwellentabelle je Faktion

**Reputation ist eine Schwelle je Faktion, kein Verbrauch.** Wer in einem
Zyklus mehrere Augmentierungen bei derselben Faktion kauft, braucht nur das
**Maximum**, nicht die Summe.

> **Zu N1: Der "Bestand statt Summe"-Fehler steckt *nicht* in Tabelle 3.4 der
> Fassung 2.** Diese Tabelle nimmt bereits je Faktion den teuersten Posten und
> nennt fuer Clarke 437.500 und fuer OmniTek 625.000 — genau die Werte, die N1
> als Korrektur bringt. Er steckt allein in der **Zeitzeile M4** (4.1/5.1), die
> nur die 600.000 Firmenreputation bepreist und die 1.062.500 Faktionsreputation
> stillschweigend in den M6/M7-Topf schiebt. Es fehlte also keine Zeit in der
> Summe, sondern die Zuordnung war irrefuehrend. **Fassung 3 legt beides in
> denselben Meilenstein** (Z4, 4.1). N1's 34 h fuer den Doppelposten sind
> damit richtig als *Aggregat*, aber keine 22 h Mehrbedarf gegenueber
> Fassung 2.

Der vollstaendige Bedarf des getrimmten Bauplans, je Faktion das Maximum:

| Faktion | teuerster noetiger Posten | Schwelle | davon **gearbeitet** |
|---|---|---|---|
| **Daedalus** | The Red Pill (+ NFG bis Stufe 66) | **2.500.000** | 462.490 (Favor-Lauf) |
| **BitRunners** | ENM Core V2 x1,08 | **1.000.000** | 462.490 (Favor-Lauf) |
| **OmniTek** | OmniTek InfoLoad x1,2 | **625.000** | 462.490 (Favor-Lauf) |
| **Clarke Inc.** | nextSENS x1,2 | **437.500** | 437.500 (direkt) |
| The Black Hand | ENM Core x1,07 | 175.000 | 175.000 |
| Aevum | PCMatrix (company_rep!) | 100.000 | 100.000 |
| NiteSec | CRTX42-AA x1,08 | 45.000 | 45.000 |
| CyberSec | CSP-G2 x1,07 | 18.750 | 18.750 |
| Tian Di Hui / Netburners / Slum Snakes | Zaehlware, s. 3.5 | je < 25.000 | ~60.000 |
| **Summe Schwellen** | | **~4,96 Mio** | |
| **Summe gearbeitet** | | | **~2,22 Mio** |

**Die 5,7 Mio der Fassung 2 sind falsch (NeuroFlux doppelt), aber auch die
4,79 Mio des Skeptikers**, weil beide CyberSec, Aevum und die Zaehlfaktionen
uebersehen. Und vor allem: **die Schwellensumme ist nicht die Rechengroesse.**
Was Zeit kostet, ist die *gearbeitete* Reputation — **2,22 Mio**, weil der
Rest ueber Spenden mit Geld erzeugt wird.

Dazu die **600.000 Firmenreputation** (2 x 400.000 x 0,75 Backdoor-Rabatt,
`Constants.ts:110` -> `Company/utils.ts:15-19` -> `FactionJoinCondition.ts:82-86`).

### 3.4 Der harte Boden

Nicht durch Geld ersetzbar, nicht parallelisierbar, exklusive Arbeitszeit:

| Posten | Reputation | bei welchem Level bezahlbar |
|---|---|---|
| BitRunners Favor-Lauf | 462.490 | **frueh, bei Level ~1.100** — das ist der teuerste Zeitposten |
| Clarke direkt | 437.500 | Level 2.500-2.900 |
| OmniTek Favor-Lauf | 462.490 | Level 2.500-2.900 |
| Daedalus Favor-Lauf | 462.490 | Level 2.500-5.000 |
| kleine Faktionen (TBH, Aevum, NiteSec, CyberSec, Zaehlware) | ~400.000 | Level 500-1.100 |
| **Firmenreputation Clarke + OmniTek** | **600.000** | Level 2.500-2.900 |

**Die Zahl selbst ist nicht der Punkt — der Zeitpunkt ist es.** Dieselben
462.490 kosten bei Level 1.100 mit Share 14,1 h und bei Level 2.900 vier.
**Die ganze Kunst der Route besteht darin, moeglichst wenig Reputation
frueh zu bezahlen.**

### 3.5 Neuer Befund: die 30er-Zaehlung ist fast gratis

**Fassung 2 hat die 30-Augmentierungen-Schwelle an die Stufentabelle gekoppelt
und daraus geschlossen, BitRunners sei dafuer noetig ("Stufe B ergibt exakt 30
verschiedene"). Das ist richtig gezaehlt und falsch geschlossen:** die Schwelle
zaehlt nur Eintraege, sie fragt nicht nach Multiplikatoren. Und es gibt
Ramschware.

Reputationspreise der billigen Faktionen [belegt, Auszaehlung aus
`Augmentations.ts`]:

| Faktion | Augs | teuerste | Bedingung |
|---|---|---|---|
| **Tian Di Hui** | 8, davon 6 unter 7.500 rep | 75.000 | Hacking 50, $1 Mio, Stadt Chongqing/New Tokyo/Ishima |
| **Netburners** | 5, **alle unter 12.500 rep** | 12.500 | Hacknet 8 GB / 4 Kerne / 100 Stufen |
| **Sector-12** | 6, fuenf unter 12.500 rep | 50.000 | bereits Mitglied |
| **Aevum** | 6, vier unter 7.500 rep | 100.000 | bereits Mitglied |
| **Slum Snakes** | 7, **alle unter 22.500 rep** | 22.500 | Karma -9 (bei -278), Kampfwerte je 30 |
| CyberSec / NiteSec | 5 / 6 | 18.750 / 45.000 | bereits Mitglied |

**Rund 25 verschiedene Augmentierungen kosten je weniger als 25.000 Reputation.**
Zusammen mit den 9 installierten und den 6 wartenden ist die 30er-Schwelle
damit **im zweiten Zyklus erreichbar, lange bevor der Multiplikator stimmt** —
fuer insgesamt etwa 100.000 Reputation statt der 1,5 Mio, die Stufe B kostet.

**Folge fuer die Route:** Das Daedalus-Tor "30 installiert" und der
Multiplikatoraufbau werden **entkoppelt**. Daedalus haengt dann nur noch an
Hacking 2.500 — und das an m >= 4,1 (2.1). Slum Snakes verlangt Kampfwerte 30
(str 1 und def 1 heute), also **1-2 h Fitnessstudio**; `ClassGymExpGain` wird
in v3.0.2 nirgends angewandt (Fassung 2, 2.1, nachgeprueft — der Multiplikator
steht in `BitNodeMultipliers.ts:28` und `BitNode.tsx:639`, aber kein Rechenpfad
liest ihn).

---

## 4. Die Reihenfolge

### 4.0 Bauarbeit (keine Spielzeit)

Reihenfolge bindend. Punkte 1 und 2 sind seit dem 22.08. erledigt (Einbauschloss
umgedreht, `src/bn4rep.js:296-310`; Firmenpfad gebaut).

3. **Kaufreihenfolge korrigieren** [zu bauen] — NFG zuerst aufsteigend, dann
   der Rest **absteigend nach Grundpreis** (2.4). Ohne das ist der Plan
   unbezahlbar, unabhaengig von allem anderen.
4. **`donateToFaction` scharfschalten** [zu bauen] — ohne Spendenkanal
   verdoppelt sich die Reputationsphase (3.3: 4,96 statt 2,22 Mio gearbeitet).
5. **Share-Deckel anheben** [zu bauen] — `src/bn4net.js` deckelt bei 100
   Faeden; wirksam waeren 20 % des Parks (x1,335 auf alle Reputation).
6. **Junk-Beschaffung** [zu bauen] — Stadtreise, Hacknet auf 8 GB/4 Kerne/100
   Stufen, Fitnessstudio bis Kampfwert 30, dann alle Augs unter 25.000 rep
   kaufen (3.5).
7. **Befoerderungslogik** [zu bauen] — auf `JobName.IT3` befoerdern, Charisma
   bis 76 an der Universitaet (3.1).

### 4.1 Sechs Zyklen

| Zyklus | Zweck | Reputationsarbeit | Park/Level | Dauer |
|---|---|---|---|---|
| **Z1** | **Einbau 1, sofort.** Die 6 wartenden Augs plus alles, was aus vorhandener Reputation bezahlbar ist. Zweck ist allein, `mults.hacking` von 1,385 zu loesen. | ~50k | vorhanden (129 TB, Lv 518) | **2-4 h** |
| **Z2** | **Zaehl- und Favor-Zyklus.** Tian Di Hui, Netburners, Slum Snakes freischalten (3.5), alle Billig-Augs kaufen -> **30+ installiert**. Parallel **BitRunners auf 462.490** ziehen (Favor 150). Dazu TBH 175k, Aevum 100k (PCMatrix!), NiteSec 45k, CyberSec 18,75k, sowie CSP-G5/ABNN/Neural Accelerator/CSP-G4/CSP-G3 aus der BitRunners-Reputation. | **~1,17 Mio bei Level 550-1.100** | Aufbau auf ~1,1 PB | **20-30 h** |
| **Z3** | **Stufe B vollenden.** BitRunners hat jetzt Favor 150: **spenden** bis 1.000.000, Neurolink und ENM Core V2 kaufen. Einbau. | ~0 (nur Geld) | 25 PB, Level ~1.800 | **8-12 h** |
| **Z4** | **Der teuerste Zyklus.** m = 4,412. Level 2.500 (9-11 h), Backdoors `clarkinc` (Lv 1.151) und `omnitek` (Lv 927). Dann **600.000 Firmenreputation** (Clarke + OmniTek, mit IT3-Befoerderung 21 rep/s), dann **Clarke 437.500 + OmniTek 462.490** Faktionsarbeit. Daedalus oeffnet unterwegs (30 Augs, $100 Mrd, Hacking 2.500) -> **Daedalus 462.490** fuer Favor 150. NFG-Stufen bis ~30 mitnehmen. Einbau. | **~1,36 Mio bei Level 2.500-2.900 + 600k Firma** | 25 PB, Level bis ~2.900 | **30-45 h** |
| **Z5** | **TRP-Zyklus.** m = 7,891 + NFG. Park und Level hoch (6 h). Daedalus und OmniTek haben Favor 150: **spenden** bis 2.500.000 bzw. 625.000 (~$3,3 Billionen, Minuten). The Red Pill + ENM Core V3 + OmniTek InfoLoad + PCDNI + **NFG bis Stufe 48** kaufen. Einbau. **Der letzte.** | ~0 (nur Geld) | 25 PB, Level ~5.000 | **6-10 h** |
| **Z6** | **Endkampf.** m = 14,0. Park neu, Level 9.000, 5 Portknacker ($287,2 Mio) + TOR, `nuke("w0r1d_d43m0n")`, `destroyW0r1dD43m0n(6, "boot.js")` (32 GB in BN4, `RamCostGenerator.ts:82-96,220`). | — | 25 PB, Level 9.000 | **6-12 h** |

**Vier Dinge sind gegenueber Fassung 2 umgestellt:**

1. **Die 30er-Schwelle wandert nach vorn (Z2) und wird billig** (3.5). Fassung 2
   hatte sie an Stufe B gekoppelt und dafuer 1,5 Mio Reputation eingeplant.
2. **Der BitRunners-Favor-Lauf wandert nach vorn (Z2).** Er ist der teuerste
   Zeitposten des Plans, weil er beim niedrigsten Level bezahlt wird — aber
   ohne ihn kostet ENM Core V2 in Z3 volle 1.000.000 Arbeit statt einer
   Spende, und ohne ENM Core V2 und Neurolink bleibt m bei 3,553, wo Level
   2.500 **83 h** dauert statt 9 (2.2). Es gibt keinen billigeren Weg.
3. **Clarke, OmniTek und Daedalus liegen jetzt im selben Zyklus (Z4)** — das
   ist N1's Zusammenlegung, und sie ist richtig: alle drei brauchen hohes
   Level, alle drei sind Faktionsarbeit, und `keepOnInstall` sorgt dafuer, dass
   die Firmenreputation nur einmal faellig ist.
4. **NeuroFlux zielt auf Stufe 48, nicht 57** (2.3/2.4). Das aufloest B2, B3,
   B5 und B7 in einem Zug.

**Der Widerspruch B7 ist damit erledigt:** Fassung 2 nannte in 2.4 Stufe 50 fuer
m=15,0 und in 4.1 Stufe 57 fuer m=15 — beides gerechnet aus verschiedenen
Sockeln (9,11 bzw. 10,94) und beides mit falschem Sockel. Richtig ist: **Sockel
8,681, Stufe 48, m = 14,0.**

### 4.2 Was parallel laeuft

- **Parkausbau und Levelaufbau sind derselbe Vorgang** und stehen nie im
  Wettbewerb (2.2).
- **Spenden kosten keine Zeit.** Faktionsarbeit ist exklusiv, der Park laeuft
  daneben. Ab Favor 150 addieren sich beide Kanaele — bei vollem Park erzeugt
  der Geldkanal **~17.000 rep/s** aequivalent und macht die Faktionsarbeit
  bedeutungslos. **Deshalb ist Favor 150 der Angelpunkt des ganzen Plans.**
- **Firmenarbeit und Faktionsarbeit sind gegenseitig exklusiv** — beide belegen
  `currentWork`. In Z4 laufen sie nacheinander.
- **Codingvertraege** laufen immer mit: $56 Mio/h plus ~5.700 rep/h, verteilt
  auf alle Faktionen mit `offerHackingWork`
  (`PlayerObjectGeneralMethods.ts:514-537`).
- **`ns.share`** nur in der Reputationsphase eines Zyklus, nie in der
  Aufbauphase.

### 4.3 Die offenen Fragen

**(a) Lohnt der Serverausbau? — Er *ist* der Plan** (2.2). Der Vorbehalt der
Fassung 2 ("als Geldrechnung nicht gueltig", B9) ist aufgeloest: der Deckel ist
nicht der Geldtopf, sondern die Taktgranularitaet, und die liegt bei 18-28 PB
— also dort, wo der Kaufdeckel ohnehin greift (2.2). **B9 haelt als Vorwurf
gegen Fassung 2**, die tatsaechlich erst die Extrapolation verwarf und sie dann
benutzte.

**(b) Lohnt der Boersenzugang? — Nein**, unveraendert. $31,2 Mrd
(`StockMarket/data/Constants.ts:7-10`), ohne SF8 nur Long
(`NetscriptFunctions/StockMarket.ts:46-53`), und das Depot verfaellt bei jedem
Einbau ohne Auszahlung (`Prestige.ts:166-171`). Gegen $18.000 Mrd/h bei vollem
Park ist das Geraeusch.

**(c) Wieviele Einbauten? — Fuenf**, der letzte ist der TRP-Einbau (Z5).
Zwischen Z5 und dem Endkampf darf nichts mehr eingebaut werden, auch kein
NeuroFlux. Vorher haengt `w0r1d_d43m0n` gar nicht am Netz
(`Prestige.ts:173-181`).

**B2's Vorschlag von 12 Zyklen ist ausdruecklich abgelehnt.** Jeder zusaetzliche
Zyklus kostet 6-10 h Parkwiederaufbau plus die gesamte Faktionsreputation des
Folgezyklus. Sieben zusaetzliche Zyklen waeren 50-80 h — fuer ein Geldproblem,
das bei Stufe 48 gar nicht besteht.

**(d) Kampfwert 1500 statt Hacking 2500 fuer Daedalus? — Nein.**
`someCondition([haveSkill("hacking", 2500), haveCombatSkills(1500)])`
(`FactionInfo.tsx:141-145`). Bei erreichbarem Kampfmultiplikator ~4,42 kostet
Kampfwert 1.500 rund 2,11e7 Erfahrung **je Wert** = 398 h je Wert. Hacking
2.500 kostet bei m=4,412 neun Stunden (2.2). Unveraendert aus Fassung 2, dort
korrekt gerechnet.

**(e) Soll Tetrads rein? — Nein, aber knapper als gedacht.** B5 nennt Tetrads
als billigsten Multiplikatorposten (Kampfwert 75, Karma -18 bei -278, 25.000
Rep, $180 Mio fuer PowerRecirculator x1,05). Nachgerechnet: Tetrads hebt den
Sockel von 8,681 auf 9,115 und senkt die noetige NFG-Stufe von 48 auf 43. **Die
Reputationsersparnis ist null** (beide Stufen liegen unter der
Daedalus-Schwelle), die Geldersparnis betraegt ~$3,5 Billionen — bei vollem
Park **elf Minuten**. Dem stehen 1-2 h Fitnessstudio und ein Warteschlangenplatz
(Faktor 1,9 auf alles Folgende im selben Zyklus) gegenueber.

> **Aber:** Slum Snakes steht in Z2 ohnehin im Plan (3.5, Kampfwert 30), und
> von 30 auf 75 ist der Sprung klein. **Wenn die Fitnessstudio-Logik einmal
> gebaut ist, nimmt der Plan Tetrads mit** — nicht wegen des Multiplikators,
> sondern weil es dann fast nichts mehr kostet und den Puffer bei den 30
> Augmentierungen weiter verbreitert.

**(f) Soll NWO rein? — Nein. Ergebnis wie Fassung 2, Begruendung neu, und die
des Skeptikers ist ebenfalls falsch.**

B6 rechnet: Xanipher hebt den Sockel 9,11 -> 10,94 und senkt die NFG-Stufe fuer
m=16 von 57 (768.496 Rep) auf 39 (72.670 Rep); Ersparnis 696k gegen Kosten
875k, NWO verliert um 179k. **Die Rechnung ist in sich richtig — beide Zahlen
reproduzieren sich auf die Stelle — und trotzdem unbrauchbar, weil NFG-Rep von
der Daedalus-Schwelle absorbiert wird und damit nichts kostet** (2.4).

Richtig gerechnet, gegen den korrigierten Sockel 8,681 und das korrigierte Ziel
m=14: NWO wuerde die NFG-Stufe von 48 auf 24 senken, das spart Geld (Minuten).
**Was NWO wirklich kostet: 875.000 Faktionsreputation (Xanipher) bei Level
2.900 = 7,6 h, plus eine dritte Firmenanstellung (300.000 Firmenrep = 4 h),
plus eine Reise nach Volhaven.** Was es bringt: m 14 -> 17,7, also 6-12 h
Endkampf statt 2-3. **Rund 12 h Einsatz fuer rund 6 h Ersparnis.** Draussen.

**(g) The Covenant und Illuminati? — Draussen, Begruendung aus Fassung 2 haelt.**
The Covenant bietet SPTN-97 x1,15 fuer 1,25 Mio Reputation; dieselben x1,15
kosten ueber NFG vom Sockel 8,681 aus 15 Stufen, also gar keine zusaetzliche
Reputation. Illuminatis QLink x1,75 kostet **$25 Billionen** — das ist bei
vollem Park zwar nur noch gut eine Stunde, aber 1,875 Mio Reputation dazu, plus
Kampfwert 1.200 (47,6 h je Wert). Draussen.

---

## 5. Der ehrliche Gesamtwert

### 5.1 Restzeit

| Posten | untere Grenze | obere Grenze | Treiber |
|---|---|---|---|
| Bauarbeit (4.0, Punkte 3-7) | 6 h | 15 h | Entwicklung, keine Spielzeit |
| **Z1** Einbau 1 | 2 h | 4 h | |
| **Z2** Zaehl- und BitRunners-Favor-Zyklus | **20 h** | **30 h** | **1,17 Mio Rep bei Level 550-1.100** |
| **Z3** Stufe B vollenden | 8 h | 12 h | Parkaufbau, dann Spende |
| **Z4** Clarke + OmniTek + Daedalus | **30 h** | **45 h** | **1,36 Mio Faktionsrep + 600k Firmenrep bei Level 2.500-2.900** |
| **Z5** TRP-Zyklus | 6 h | 10 h | Parkaufbau, dann Spende |
| **Z6** Endkampf bei m = 14,0 | 6 h | 12 h | Geldlinearitaet (2.2) |
| **Summe Spielzeit** | **~72 h** | **~113 h** | |
| **Summe inkl. Bauarbeit** | **~78 h** | **~128 h** | |
| **mit einem verlorenen Zyklus** (Fehlkauf, Rep-Fehlplanung) | | **~150 h** | |

**Erwartungswert ~95 h Spielzeit.** Die ROADMAP-Spanne (60-120 h) haelt am
oberen Rand.

**Der dominierende Posten ist Z4 (30-45 h), gefolgt von Z2 (20-30 h).**
Beide sind **exklusive Faktionsarbeitszeit** — der einzige Posten des ganzen
Knotens, den kein Rechnerpark und kein Geld ersetzen kann.

**Was sich gegenueber Fassung 2 verschoben hat:**

| | Fassung 2 | Fassung 3 | Grund |
|---|---|---|---|
| dominierender Posten | Reputation gesamt (33-55 h) | **Z4, ein einzelner Zyklus (30-45 h)** | Zusammenlegung nach N1, Entkopplung der 30er-Zaehlung |
| M5a Hacking 2.500 | 4-8 h ("16 h bei 79 TB") | **9-11 h**, aber nur bei m >= 4,1 | gekoppeltes Modell (2.2) |
| Endkampf | 3-8 h bei m=16-18 | **6-12 h bei m=14** | niedrigeres Ziel, gekoppeltes Modell |
| Favor-Vorlauf | 1,85 Mio | **1,39 Mio** | B4 |
| Rep-Schwellensumme | 5,66 Mio | **4,96 Mio** (davon 2,22 gearbeitet) | B3 + Spendenkanal |
| NeuroFlux | Stufe 57 | **Stufe 48** | Sockel 8,681, Ziel m=14 |
| 30er-Zaehlung | ueber Stufe B (~1,5 Mio Rep) | **~100k Rep** | 3.5 |

### 5.2 Der neue dominierende Posten in einem Satz

**Die 462.490 Reputation, die BitRunners bei Level ~1.100 abverlangt** (Z2), und
die **1,96 Mio Faktions- plus Firmenreputation, die Clarke, OmniTek und Daedalus
bei Level ~2.700 abverlangen** (Z4). Zusammen **50-75 h**, also gut zwei Drittel
des Knotens. Alles andere ist Beiwerk.

---

## 6. Die Kernentscheidung — neu gestellt

### 6.1 Was feststeht

- **`b1tflum3` vergibt kein Source-File.** `enterBitNode` ruft `giveSourceFile`
  nur unter `if (!isFlume)` (`RedPill.tsx:66-67`). [belegt]
- **BN4-Abschluss gibt SF4 Stufe 1** (`RedPill.tsx:39`, Stufe 3 erst nach drei
  BN4-Durchlaeufen, `:29`). [belegt]
- **SF4 Stufe 1 gibt keinen RAM-Rabatt.** `SF4Cost` gibt bei `sf4 <= 1` den
  Faktor **x16** (`RamCostGenerator.ts:82-96`); in BN4 selbst steigt die
  Funktion vorher mit `return cost` aus. Konkret ausserhalb BN4:
  `destroyW0r1dD43m0n` 32 -> **512 GB** (`:220`), `b1tflum3` 16 -> **256 GB**
  (`:219`). [belegt — **B11 haelt**]
- **Ohne SF4 ist ausserhalb von BN4 gar keine Singularity-Funktion verfuegbar**
  — auch `destroyW0r1dD43m0n` nicht und auch `b1tflum3` nicht
  (`checkSingularityAccess`, `NetscriptHelpers.tsx:438-446`:
  `bitNodeN === 4 || activeSourceFileLvl(4) > 0`). [belegt]

> **Zu B11:** Der Befund haelt, ist aber **kein neuer Befund fuers Projekt** —
> ROADMAP Fassung 4 fuehrt ihn in Zeile 101 ausdruecklich, beziffert
> `sing/destroy.js` in 8.2 mit **513,6 GB** unter SF4.1 und budgetiert in 7.4
> je Folgeknoten $10,6-10,8 Mio fuer gekaufte Rechner. Er fehlte allein in
> diesem Dokument. **Wirkung auf die Entscheidung: nahe null** — ein
> 512-GB-Rechner kostet $48,7 Mio (`512 x 55.000 x 1,2^3`), also Minuten.

### 6.2 Der Punkt, den Fassung 2 falsch hatte

Fassung 2 argumentierte: ohne SF4 haengen **13 Folgeknoten** an einem
ungetesteten DOM-Ausgang, und dreizehnmal auf einen ungetesteten Alleinausgang
zu setzen sei kein Zeitproblem, sondern ein Risikoprofil.

**Es sind nicht dreizehn. Es sind zwei.**

Die ROADMAP-Route laeuft nach BN4 ueber **BN6 und BN7** — die beiden
Bladeburner-Knoten, die die V2-Route ueberhaupt erst freischalten (ROADMAP
Positionen 2 und 3). Danach ist ein **BN4-Wiederholungslauf unter V2** moeglich,
und der kostet laut ROADMAP **29 h** statt 78-128. In BN4 selbst ist
Singularity nativ verfuegbar, der Ausgang dort ist also wieder geskriptet.

**Damit lautet der Vergleich:**

| | Zeit | ungetestete DOM-Ausgaenge |
|---|---|---|
| **Route X — BN4 jetzt zu Ende** | **78-128 h** (5.1), im schlechten Fall 150 | **0** |
| **Route Y — `b1tflum3(6, "boot.js")` jetzt** | **0 h jetzt**, spaeter 29 h fuer BN4-V2 | **2** (BN6, BN7) |

**Differenz: 49-99 h fuer die Vermeidung von zwei DOM-Ausgaengen** statt, wie
Fassung 2 rechnete, dreizehn. Pro Ausgang sind das 25-50 h Versicherungspraemie.
Das ist zu teuer, wenn der Ausgang testbar ist — und er ist testbar.

### 6.3 Bescheid

> **Der Bescheid der Fassung 2 kippt: `b1tflum3(6, "boot.js")`, sobald T1 und
> T2 aus ROADMAP 7.8 bestanden sind.**

- **T1/T2 bestehen** -> **Route Y.** BN4 wird verlassen, SF4 spaeter aus einem
  BN4-Wiederholungslauf unter V2 geholt (29 h). Der Verzicht kostet zwei
  DOM-Ausgaenge und spart 49-99 h.
- **T1 oder T2 scheitern** -> **Route X.** Dann ist BN4-V1 der einzige Weg zu
  SF4 und damit zu jedem geskripteten Ausgang ueberhaupt; 78-128 h sind dann
  nicht der Preis fuer Bequemlichkeit, sondern fuer Fortsetzbarkeit. Der Plan
  in Abschnitt 4 gilt unveraendert.
- **T1/T2 werden nicht gefahren** -> **Route X**, denn ohne Test ist die
  Ausfallwahrscheinlichkeit des DOM-Ausgangs unbekannt, und ein Ausfall
  bedeutet laut ROADMAP 7.2: Spiel steht auf der BitVerse-Seite, kein Terminal,
  kein Skript, nur ein Mensch kommt da heraus.

**Wovon der Bescheid abhaengt — ausdruecklich:**

1. **Von T1/T2**, einem Test von 1-2 h. Er ist um zwei Groessenordnungen
   billiger als die Entscheidung, die er traegt. **Er gehoert vor jede weitere
   Stunde BN4-Arbeit.**
2. **Von den 29 h fuer BN4-V2.** Diese Zahl stammt aus der ROADMAP und ist dort
   selbst eine Schaetzung. Waeren es 60 h, schruempfte der Vorteil der Route Y
   auf 18-68 h — die Richtung bliebe.
3. **Nicht** von der Geldlinearitaet (7.1). Faellt die, wird Route X **teurer**,
   nicht billiger; der Bescheid wird dadurch nur deutlicher.

**Abbruchbedingung, falls Route X gefahren wird** (ersetzt ROADMAP 6.1, deren
"$5 Mrd in 48 h" heute in 32 Minuten erreicht wird):

> **Sind 48 h nach dem ersten Einbau nicht mindestens 30 Augmentierungen
> installiert und `mults.hacking >= 4,0`, wird BN4 verlassen.**

Beide Groessen sind mit `tools/save.js` in einer Zeile ablesbar. Die Schwelle
ist bewusst auf das Ende von Z3 gelegt: wer dort steht, hat die
Selbstverstaerkung erreicht (2.2) und kommt durch; wer dort nicht steht, kommt
auch in 200 h nicht durch.

---

## 7. Wo ich unsicher bin

1. **Die Geldlinearitaet bis 25 PB ist die tragende Annahme des ganzen
   Dokuments und sie ist nicht gemessen.** Verankert bei 79 TB, benutzt bis
   26.214.400 GB — Faktor 330. Das Saettigungsargument in 2.2 (Taktgranularitaet
   statt Geldtopf) ist gerechnet, nicht beobachtet, und es setzt voraus, dass
   `src/bn4net.js` echten HWGW-Fliessbandbetrieb faehrt. **Prueffaellig, und
   billig zu pruefen:** Park einmal auf 1 PB ziehen und die Rate gegen
   `6,44e-2 x (level+50) x RAM_GB` halten. Weicht sie ab, verschieben sich alle
   Zeiten in 5.1 nach oben, Z6 am staerksten (6-12 h -> 12-27 h bei m=14).
2. **Die Reputationsraten in 3.1 sind aus einem Anker extrapoliert.** 3,40 rep/s
   bei Level 460 [gemessen] wird bis Level 5.000 gestreckt. Die Formel
   (`reputation.ts:16-24`) ist linear im Level, das Risiko ist gering — aber der
   `calculateIntelligenceBonus`-Anteil ist im Anker mit enthalten und wird
   mitskaliert, obwohl er es nicht muss.
3. **Die Zyklusdauern in 4.1 sind konstruiert, nicht gefahren.** Der Bot hat in
   18 h BitNode-Zeit keinen vollstaendigen Zyklus absolviert. Insbesondere Z2
   (20-30 h) haengt daran, wie schnell Tian Di Hui, Netburners und Slum Snakes
   tatsaechlich freizuschalten sind — das ist [zu bauen] und nie erprobt.
4. **Die 29 h fuer BN4-V2 in 6.2 sind aus der ROADMAP uebernommen**, nicht
   nachgerechnet. Sie tragen die Empfehlung mit.
5. **`ns.share` auf x1,335 ist [zu bauen] und nirgends gemessen.** Faellt es
   aus, wachsen Z2 und Z4 um zusammen 10-15 h.
6. **Ob 12 Kaeufe in einem Zyklus wirklich durchgehen**, haengt allein an der
   Kaufreihenfolge (4.0 Punkt 3). Bei aufsteigender Sortierung ist der Plan
   unbezahlbar, und zwar unabhaengig von jeder anderen Zahl hier.

### 7.1 N3 — der Firmenreputations-Vertrag: aufgeloest gegen die Beobachtung

**Der Referenzcode ist eindeutig und kennt keinen Gratiskanal.**
`PlayerObjectGeneralMethods.ts:539-556` [belegt]:

```
case CodingContractRewardType.CompanyReputation: {
  const companies = getRecordKeys(Player.jobs);
  if (companies.length === 0) {
    return this.gainCodingContractReward(
      { type: Math.random() < 0.5 ? FactionReputation : FactionReputationAll }, ...);
  }
  const randomCompany = companies[getRandomIntInclusive(0, companies.length - 1)];
  ...
}
```

Ohne Eintrag in `Player.jobs` faellt der Lohn auf **Faktions**reputation
zurueck. Der Zielserver des Vertrags spielt fuer die Belohnungsart **keine
Rolle** — die Firma wird zufaellig aus den *eigenen Anstellungen* gezogen.

**Die wahrscheinlichste Erklaerung der Beobachtung ist, dass eine Anstellung
bestand.** Fassung 2 fuehrt selbst als Messanker "Clarke Inc., **IT Intern**,
Hacking 505 -> 514" — der Bot war bei Clarke angestellt. Und der beobachtete
Anstieg von ~2.100 Reputation in 24 Minuten entspricht **1,46 rep/s**, was
exakt in das Band der gemessenen Firmen*arbeit* faellt (2,4-2,9 rep/s bei voller
Konzentration). Ein Vertrag haette 2.666 auf einen Schlag gegeben und danach
nichts mehr.

**Bescheid: kein Gratiskanal. [ungeklaert] bleibt allein die Beobachtung, nicht
der Mechanismus.** Es wird keine Zeitrechnung darauf gebaut.

**Entscheidender Test, falls es jemand aufloesen will** [zu bauen]: `quitJob`
bei Clarke, `Player.jobs` als leer bestaetigen, dann einen Vertrag auf
`clarkinc` loesen und den Rueckgabetext lesen. Er nennt die Belohnungsart im
Klartext ("Gained X company reputation for ..." gegen "Gained X faction
reputation for ..."). Zwei Minuten Arbeit.

---

## 8. Die Befunde im Einzelnen

### 8.1 Der Skeptiker (B1-B11)

| # | Behauptung | Urteil | Begruendung |
|---|---|---|---|
| **B1** | M5a um Faktor 20,6 zu niedrig; 329,8 h statt 16 h bei 79 TB | **haelt in der Arithmetik, nicht im Schluss** | Ich reproduziere die Integration exakt: bei **festem** 79-TB-Park kostet Level 2.500 bei m=4,41 **329,8 h**, bei 410 TB 63,8 h, 16,0 h erst bei 1.638 TB. Das Etikett "16 h bei 79 TB" in Tabelle 4.1 ist also falsch. **Aber der Park ist nicht fest** (2.2): gekoppelt kostet M5a **9,3 h** (Geld linear) bis **10,6 h** (Deckel $1.000 Mrd/h). Fassung 2 lag um Faktor 1,5-2 zu niedrig, nicht 20,6. |
| **B2** | NFG Stufe 57 finanziell unmoeglich; Ausweg 12 statt 5 Zyklen | **haelt als Diagnose, nicht als Therapie** | $8,728e24 fuer 0->57 in einem Zyklus exakt reproduziert; Faktor 2,166 je Stufe belegt (`AugmentationHelpers.ts:134-137`, `Augmentation.ts:238-246`). **Aber:** (i) Stufe 57 ist ueberspezifiziert — Stufe **48** reicht fuer m=14 (2.3); (ii) bei vollem Park sind $5,3 Billionen **18 Minuten**, nicht 2.250 h — die $352 Mrd/h stammen aus einer Zeile fuer Level 460 (2.2); (iii) 12 Zyklen kosten 50-80 h Wiederaufbau (4.3c). **Abgelehnt.** |
| **B3** | Rep-Summe 15,4 % zu hoch, NFG doppelt gezaehlt | **haelt** | NFG ist bei jeder Faktion ausser SoA/Bladeburners/CotMG zu haben (`Augmentations.ts:1197-1202`), also auch bei Daedalus, wo 2,5 Mio ohnehin liegen. Meine eigene Auszaehlung ergibt **4,96 Mio** (nicht 4,79 — der Skeptiker uebersieht CyberSec, Aevum und die Zaehlfaktionen). Entscheidend ist ohnehin die **gearbeitete** Summe: **2,22 Mio** (3.3). |
| **B4** | Favor-Vorlauf 25 % zu hoch, Clarke faellt raus | **haelt** | `favorToRep(150)` = **462.490,9** (`favor.ts:12-15`, `Constants.ts:31`) — Fassung 2 nannte 462.550. Clarkes hoechste Schwelle ist nextSENS **437.500**; der Umweg ist um 24.991 rep teurer. Harter Boden **1.387.470**. Nachtrag: der Abstand betraegt 15 Minuten, der Umweg lohnt als Versicherung trotzdem (3.2). |
| **B5** | Stufe E setzt den PowerRecirculator aus der Verbrecherkette voraus; Sockel 8,68 statt 9,11 | **haelt vollstaendig** | 1,9065 x 1,98874 x 1,38 x 1,296 x 1,1 = **7,4609**, m = **8,6804** — auf die vierte Stelle wie behauptet. PowerRecirculator nur bei Tetrads/Dark Army/Syndicate/NWO (`Augmentations.ts:1456`). NFG-Stufe fuer m=16 springt 57 -> 62 (Rep 768.496 -> 1.479.674) — beide unter Daedalus' 2,5 Mio, die Rep-Wirkung ist also **null**, die Geldwirkung gross. **Tetrads: aufgenommen als Mitnahme, nicht als Posten** (4.3e). |
| **B6** | NWO-Begruendung falsch, Ergebnis richtig | **haelt gegen Fassung 2, aber die Ersatzrechnung traegt auch nicht** | Beide Zahlen des Skeptikers reproduzieren sich (768.496 und 72.670 = `500 x 1,14^56` bzw. `1,14^38`). Aber die Marginalrechnung behandelt NFG-Reputation als Kosten, und die ist bei Daedalus absorbiert. Die tragfaehige Rechnung steht in 4.3f: **~12 h Einsatz fuer ~6 h Ersparnis. NWO bleibt draussen.** |
| **B7** | Interner Widerspruch 2.4 gegen 4.1 | **haelt** | Zwei Sockel (9,11 und 10,94) gemischt, beide falsch. Erledigt durch Sockel 8,681 / Stufe 48 (4.1). |
| **B8** | M7 setzt einen Park voraus, den der Einbau zerstoert | **haelt** | `prestigeAllServers()` in `Prestige.ts:74`; Guthaben auf $1.262 in `PlayerObjectGeneralMethods.ts:103` (**nicht** `Constants.ts:107`, dort steht `Donations: 262`). Fassung 3 preist den Wiederaufbau in **jedem** Zyklus mit 6-10 h ein (2.2, 4.1). |
| **B9** | Methodischer Widerspruch: lineare Geldextrapolation erst verworfen, dann benutzt | **haelt** | Der Widerspruch war real. Aufgeloest, nicht weggeraeumt: der Deckel ist nicht der Geldtopf ($797 Mrd sind ein Durchsatz, kein Vorrat), sondern die Taktgranularitaet von 200 ms (`Constants.ts:19`), und die liegt bei 18-28 PB (2.2). Bleibt Hauptrisiko (7.1). |
| **B10** | CSP-G5 verlangt G4 als Pflichtkauf ohne eigenen hacking-Multiplikator | **haelt, Wirkung klein** | `Augmentations.ts:458-474`: G4 traegt `hacking_speed 1.02`, `hacking_money 1.2`, `hacking_grow 1.25` — **kein `hacking`-Feld**. G5 listet G4 in `prereqs` (`:484-489`). 125.000 rep, $1,1 Mrd. Die Rep liegt unter BitRunners' ohnehin noetiger Schwelle, und der Warteschlangenplatz zaehlt fuer die 30er-Schwelle mit. |
| **B11** | SF4 Stufe 1 gibt keinen RAM-Rabatt; x16 in allen 13 Folgeknoten | **haelt als Luecke dieses Dokuments, nicht als neuer Befund** | `RamCostGenerator.ts:82-96`: `sf4 <= 1` -> `cost * 16`; `:219-220` `b1tflum3` 16 GB, `destroyW0r1dD43m0n` 32 GB. Ausserhalb BN4 also 256 bzw. **512 GB**. **Steht bereits in ROADMAP Fassung 4, Zeile 101 und 8.2** (dort 513,6 GB), mit budgetierten $10,6-10,8 Mio je Knoten. Ein 512-GB-Rechner kostet $48,7 Mio. **Wirkung auf die Kernentscheidung: nahe null.** |

### 8.2 Der Messagent (N1-N3)

| # | Behauptung | Urteil | Begruendung |
|---|---|---|---|
| **N1** | M4 kostet ~34 h statt 11,8 h; Bestand statt Summe | **haelt als Aggregat, nicht als Fehlerdiagnose** | Der "Bestand statt Summe"-Fehler steckt **nicht** in Tabelle 3.4 — die nimmt bereits je Faktion das Maximum und nennt genau 437.500 und 625.000. Er steckt in der **Zuordnung**: die Zeitzeile M4 bepreiste nur die 600.000 Firmenrep und schob die 1.062.500 Faktionsrep in den M6/M7-Topf. Kein fehlender Posten, aber ein irrefuehrender Schnitt. **Fassung 3 legt beides in Z4** (4.1). N1's 24,4 h fuer den Faktionsteil setzen 12,1 rep/s an; mit Stufe-B-`faction_rep` 1,2538, Share 1,4 und OmniTek auf dem Favor-Weg sind es **13,7 h**. |
| **N2** | Firmenrate +24 %, `mults.company_rep` = 1,4482 | **haelt vollstaendig** | Magnetism x1,1 (`:1055`) x PCMatrix x1,0777 (`:1406`) x Wit x1,05 (`:2042`) = 1,24473; x SF1.1 = **1,44821**. `faction_rep` in Stufe B = 1,0777 x 1,16348 = **1,25388**. IT Analyst bei Hacking 2.500: **17,45 rep/s** (Formel `CompanyPosition.ts:156-172`). **Ergaenzung, die N2 nicht hat:** `JobName.IT3` (Systems Administrator) hat `repMultiplier: 1.4` statt 1,1 und kommt auf **20,95 rep/s** — Charisma 76 kostet 40 Minuten Universitaet. Die drei `company_rep`-Augs werden damit zu **Pflichtkaeufen vor Z4** (3.1). |
| **N3** | Codingvertrag zahlte Firmenrep ohne Anstellung | **gegen die Beobachtung aufgeloest** | `PlayerObjectGeneralMethods.ts:539-556` faellt bei leerem `Player.jobs` auf Faktionsreputation zurueck; der Zielserver ist irrelevant. Der Bot war bei Clarke als IT Intern angestellt (Messanker der Fassung 2), und 2.100 rep in 24 min = 1,46 rep/s ist Arbeits-, keine Vertragsrate. **Kein Gratiskanal. Keine Zeitrechnung darauf.** Entscheidender Test in 7.1. |

### 8.3 Zusammenfassung der Wirkung

| Befund | Wirkung auf die Restzeit |
|---|---|
| B1 (gekoppeltes Modell statt fester Park) | **-15 bis -300 h** gegenueber der Skeptikerrechnung, **+3 h** gegenueber Fassung 2 |
| B2 + B5 + B7 (Sockel 8,681, Ziel m=14, NFG 48) | **+3 bis +6 h** (Endkampf laenger), Geldproblem entfaellt |
| B3 + B4 (Rep-Buchfuehrung) | **-6 bis -9 h** |
| B8 (Parkwiederaufbau je Zyklus) | **+30 bis +50 h** — der groesste Einzelposten der Fassung 3, weil er fuenfmal anfaellt |
| N1 + N2 (Firmenrate, Zusammenlegung) | **-4 bis -6 h** |
| 3.5 (30er-Zaehlung entkoppelt) | **-15 bis -25 h** |
| **Netto** | **72-113 h statt 65-117 h** — fast unveraendert, komplett anders zusammengesetzt |
