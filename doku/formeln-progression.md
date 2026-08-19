# Bitburner - Progressionssystem (exakt aus dem Quellcode)

Quellstand: **Release v3.0.1**, Ordner `reference\v301`.
Alle Zeilenangaben `src/Datei.ts:Zeile` beziehen sich auf diesen Baum, nicht auf den dev-Branch.
Version bestaetigt in `src/Constants.ts:7` (`VersionString: "3.0.1"`, `isDevBranch: false`).

Alle Angaben sind aus dem Code gelesen. Wo etwas nicht im Code steht oder ich es nicht
belegen konnte, steht es ausdruecklich unter **Luecke**.

Grundtakt des Spiels: ein "Cycle" sind 200 ms (`src/Constants.ts:19`, `MilliPerCycle: 200`),
also **5 Cycles pro Sekunde** (`src/Work/Formulas.ts:38`, `gameCPS`).
Alle Arbeits-Formeln unten liefern Werte **pro Cycle**; fuer "pro Sekunde" mal 5 rechnen.

---

## 1. Skills und Erfahrung

### 1.1 Exp -> Level

`src/PersonObjects/formulas/skill.ts:7`

```
calculateSkill(exp, mult) = clamp( floor( mult * (32 * ln(exp + 534.6) - 200) ), min = 1 )
```

Sonderfall: `mult === 0` gibt hart 1 zurueck (`src/PersonObjects/formulas/skill.ts:10`, betrifft BN12
mit sehr hohem SF12).

### 1.2 Level -> Exp (Umkehrung)

`src/PersonObjects/formulas/skill.ts:17`

```
calculateExp(skill, mult) = e^((skill / mult + 200) / 32) - 534.6
```

Die Funktion korrigiert danach noch Gleitkomma-Rundung nach oben, damit
`calculateSkill(calculateExp(n)) === n` gilt (`src/PersonObjects/formulas/skill.ts:20-32`).

**Konstanten**: `534.6`, `32`, `200`. Sie stehen fest im Code, es gibt keinen Multiplikator darauf.

### 1.3 Wieviel Exp kostet welches Level (mult = 1)

| Level | benoetigte Exp |
|------:|---------------:|
| 1 | 0 |
| 10 | 173 |
| 25 | 597 |
| 50 | 1.937 |
| 75 | 4.863 |
| 100 | 11.260 |
| 150 | 55.710 |
| 200 | 267.800 |
| 300 | 6,107e6 |
| 400 | 1,390e8 |
| 500 | 3,164e9 |
| 750 | 7,818e12 |
| 975 | 8,846e15 |
| 1500 | 1,18e23 |
| 2500 | 4,40e36 |

Die Kurve ist exponentiell mit Basis `e^(1/32)`: **jedes Level kostet rund 3,2 % mehr Exp als das
vorige** (genau: Faktor `e^(1/32) = 1,03175`). Ueber 100 Level also Faktor `e^(100/32) = 22,8`.

`CONSTANTS.MaxSkillLevel = 975` (`src/Constants.ts:16`) ist kein harter Deckel, sondern der Wert,
den man bei Exp = MAX_SAFE_INTEGER und mult = 1 erreicht. Mit Multiplikatoren geht es darueber.
Wichtig: 975 ist der **Normierungsnenner** in allen Reputationsformeln (siehe unten).

### 1.4 Wie die Spieler-Multiplikatoren wirken

Es gibt **zwei getrennte Hebel** pro Skill, sie multiplizieren sich in der Wirkung:

1. **Exp-Multiplikator** (`hacking_exp`, `strength_exp`, ...): skaliert die *gewonnene Erfahrung*.
   Angewandt in `multWorkStats` (`src/Work/WorkStats.ts:106-111`) bzw. in `Person.gainStats`
   (`src/PersonObjects/Person.ts:193-198`) fuer Verbrechen/Infiltration.
2. **Level-Multiplikator** (`hacking`, `strength`, ...): geht als `mult` direkt in `calculateSkill`
   (`src/PersonObjects/Person.ts:213-225`, `updateSkillLevels`; und
   `src/PersonObjects/Person.ts:60-63`, `gainHackingExp`).

```
skills[s] = max(1, floor( calculateSkill( exp[s], mults[s] * BitNodeMult[s] ) ))
```

Der Level-Multiplikator ist **linear auf das Level**: 1.5x Hacking-Mult heisst 1,5-faches Level bei
gleicher Exp. Das ist der mit Abstand staerkste Hebel, weil der Weg von Level 500 auf 750 sonst
Faktor 2470 an Exp kostet.

Der Exp-Multiplikator wirkt dagegen nur **logarithmisch auf das Level**: doppelte Exp bringt
`32 * ln(2) = 22` Level dazu (bei mult = 1).

**Merksatz**: `hacking: 1.2` ist ungefaehr so stark wie `hacking_exp` mal 1000.

### 1.5 Intelligence

- Intelligence wird nur bei SF5 oder in BN5 ueberhaupt gesammelt
  (`src/PersonObjects/Person.ts:185-189`).
- Der Level-Mult ist dort hart 1 (`src/PersonObjects/Person.ts:187`).
- Der Intelligence-Bonus auf andere Systeme (`src/PersonObjects/formulas/intelligence.ts:1`):

```
calculateIntelligenceBonus(int, weight) = 1 + weight * int^0.8 / 600
```

Mit weight = 1 (so wird er in allen Faction-Rep-Formeln benutzt) gibt int = 100 einen Bonus von
1,066, int = 1000 einen Bonus von 1,42.

### 1.6 HP

`src/PersonObjects/Person.ts:228`: `hp.max = floor(10 + defense / 10)`.

---

## 2. Augmentations

### 2.1 Wo die Daten liegen

**Es gibt keinen Ordner `src/Augmentation/data/`.** Die komplette Basisliste steht in einer einzigen
Datei:

- `src/Augmentation/Augmentations.ts` - 136 Augmentations, jede als Objektliteral mit
  `repCost`, `moneyCost`, `factions`, optional `prereqs`, `isSpecial`, `programs`, `startingMoney`
  und den Multiplikatorfeldern. Beginn der Tabelle: `src/Augmentation/Augmentations.ts:10`
  (`const metadata`).
- `src/Augmentation/Augmentation.ts:173` - die Klasse `Augmentation` (nimmt die Metadaten entgegen).
- `src/Augmentation/Enums.ts` - die Anzeigenamen (`AugmentationName`).
- `src/Augmentation/AugmentationHelpers.ts` - die Preisberechnung.
- `src/Augmentation/CircadianModulator.ts` - der Sonderfall "Unstable Circadian Modulator"
  (zufaellige Multiplikatoren pro Aug-Reset).

Die Zuordnung Faktion -> Augmentation wird beim Programmstart aus den `factions`-Feldern der
Augmentations aufgebaut (`src/Faction/Factions.ts:16-21`), nicht umgekehrt.

### 2.2 Preisskalierung innerhalb einer Kaufrunde

`src/Augmentation/AugmentationHelpers.ts:29-37`

```
getBaseAugmentationPriceMultiplier() = CONSTANTS.MultipleAugMultiplier
                                     * [1, 0.96, 0.94, 0.93][SF11-Level]

getGenericAugmentationPriceMultiplier() = base ^ (Anzahl bereits gekaufter Nicht-SoA-Augs
                                                  in der aktuellen Kaufrunde)
```

`CONSTANTS.MultipleAugMultiplier = 1.9` (`src/Constants.ts:41`).

Gezaehlt wird `Player.queuedAugmentations` **ohne** die neun SoA-Augs
(`src/Augmentation/AugmentationHelpers.ts:17-27, 33-36`). NeuroFlux Governor zaehlt mit und erhoeht
den Zaehler jedes Mal.

Der Zaehler wird bei der Installation auf null gesetzt
(`src/Augmentation/AugmentationHelpers.ts:103`, `Player.queuedAugmentations = []`).
**Ueber Installationen hinweg gibt es also keine Preissteigerung** - der Multiplikator gilt nur
innerhalb einer Kaufrunde.

| gekaufte Augs vorher (k) | Preisfaktor 1.9^k (BN1, kein SF11) |
|---:|---:|
| 0 | 1,00 |
| 1 | 1,90 |
| 2 | 3,61 |
| 3 | 6,86 |
| 4 | 13,03 |
| 5 | 24,76 |
| 6 | 47,05 |
| 7 | 89,39 |
| 8 | 169,84 |
| 10 | 613,11 |
| 12 | 2.213,31 |
| 15 | 15.181,13 |

Mit SF11: Basis 1,824 (Lvl 1), 1,786 (Lvl 2), 1,767 (Lvl 3).

**Direkte Folgerung**: Da der k-te Kauf `baseCost * 1.9^k` kostet, minimiert man die Gesamtkosten,
indem man **die teuerste Augmentation zuerst kauft** und dann absteigend weiter. Die
Reputationsanforderung ist davon nicht betroffen (siehe 2.3).

### 2.3 Vollstaendige Kostenfunktion

`src/Augmentation/AugmentationHelpers.ts:127-161` (`getAugCost`)

**Normalfall:**
```
moneyCost = baseCost * getGenericAugmentationPriceMultiplier() * BitNode.AugmentationMoneyCost
repCost   = baseRepRequirement * BitNode.AugmentationRepCost
```

Die **Reputationsanforderung skaliert also NICHT mit der Anzahl gekaufter Augs** - nur der Preis.
In BN1 sind beide BitNode-Multiplikatoren 1 (`src/BitNode/BitNodeMultipliers.ts:13,16`).

**NeuroFlux Governor** (`src/Augmentation/AugmentationHelpers.ts:133-138`):
```
multiplier = CONSTANTS.NeuroFluxGovernorLevelMult ^ aug.getLevel()     // 1.14 ^ Level
repCost    = 500     * 1.14^Level * BitNode.AugmentationRepCost
moneyCost  = 750_000 * 1.14^Level * BitNode.AugmentationMoneyCost * getGenericAugmentationPriceMultiplier()
```
`NeuroFluxGovernorLevelMult = 1.14` (`src/Constants.ts:36`).
Basiswerte `repCost: 500`, `moneyCost: 750e3` (`src/Augmentation/Augmentations.ts:1160-1161`).

Beachte die Asymmetrie: **die NFG-Rep-Anforderung bekommt den 1.9^k-Faktor NICHT, der Geldpreis
schon.**

`getLevel()` (`src/Augmentation/Augmentation.ts:238-246`) = installiertes NFG-Level + Anzahl in der
Warteschlange. **Das Level bleibt ueber Installationen hinweg erhalten** (bei
`applyAugmentation` wird `ownedNfg.level = aug.level` gesetzt,
`src/Augmentation/AugmentationHelpers.ts:55-59`). Es wird erst beim BitNode-Wechsel
zurueckgesetzt - dort setzt SF12 den Startwert (`src/Prestige.ts:264-269`).

| NFG-Level n (naechster Kauf) | Rep-Bedarf | Geldpreis (Basis) | kumul. Rep fuer Level 1..n |
|---:|---:|---:|---:|
| 0 -> 1 | 500 | 750.000 | 500 |
| 5 -> 6 | 963 | 1,44e6 | 3.305 |
| 10 -> 11 | 1.854 | 2,78e6 | 9.669 |
| 20 -> 21 | 6.872 | 1,03e7 | 45.512 |
| 30 -> 31 | 25.475 | 3,82e7 | 178.393 |
| 40 -> 41 | 94.442 | 1,42e8 | 671.013 |
| 50 -> 51 | 350.116 | 5,25e8 | 2,50e6 |
| 75 -> 76 | 9,26e6 | 1,39e10 | 6,62e7 |
| 100 -> 101 | 2,45e8 | 3,68e11 | 1,75e9 |

Formel fuer die kumulierte Rep bis Level N: `500 * (1.14^N - 1) / 0.14`.
Wichtig: Der Rep-Bedarf ist **nicht** kumulativ zu bezahlen - man braucht nur *einmal* soviel Rep
bei der Faktion wie das teuerste Level fordert, und kann dann alle Level darunter in derselben
Runde kaufen. Der 1.9^k-Geldfaktor macht viele NFG-Level in einer Runde trotzdem schnell
unbezahlbar.

Jedes NFG-Level gibt `1.01 + donationBonus` auf fast alle Multiplikatoren
(`src/Augmentation/Augmentations.ts:1170-1197`), mit
`donationBonus = CONSTANTS.Donations / 1e6 / 100 = 262 / 1e8 = 0.00000262`
(`src/Augmentation/Augmentations.ts:9`, `src/Constants.ts:107`). Also **+1,000262 % pro Level**,
multiplikativ gestapelt. Die Hacknet-Kostenmults bekommen den Kehrwert.
In v3.0.1 hat NFG **kein** `dnet_money` (Unterschied zu dev, siehe Abschnitt 10).

**SoA-Augs** (`src/Augmentation/AugmentationHelpers.ts:141-154`):
```
soaAugCount = Anzahl bereits INSTALLIERTER SoA-Augs
moneyCost   = baseCost           * 7   ^ soaAugCount     // CONSTANTS.SoACostMult
repCost     = baseRepRequirement * 1.3 ^ soaAugCount     // CONSTANTS.SoARepMult
```
(`src/Constants.ts:100-101`). SoA-Augs bekommen den generischen 1.9-Faktor nicht und erhoehen ihn
auch nicht.

### 2.4 Kaufbedingungen

`src/Faction/FactionHelpers.tsx:60-107` (`checkIfPlayerCanPurchaseAugmentation`):

1. Mitglied der Faktion sein.
2. Die Faktion muss die Aug fuehren.
3. Noch nicht gekauft/installiert (Ausnahme NFG).
4. Alle `prereqs` gekauft oder installiert (`hasAugmentationPrereqs`,
   `src/Faction/FactionHelpers.tsx:56-58`).
5. Genug Geld.
6. `faction.playerReputation >= augCosts.repCost`.

Die Rep wird beim Kauf **nicht verbraucht** (`src/Faction/FactionHelpers.tsx:109-131`) - nur Geld.
Man kann also mit einmal erreichter Rep alle Augs bis zu dieser Schwelle kaufen.

### 2.5 Die wirkungsvollsten Augmentations

Sortiert grob nach Nutzen fuer einen Hacking-Lauf. Preise sind Basispreise (vor 1.9^k).

#### Kern-Hacking

| Aug | Faktion(en) | Rep | Basispreis | Multiplikatoren | Quelle |
|---|---|---:|---:|---|---|
| **The Red Pill** | Daedalus | 2,5e6 | 0 | *keine* - schaltet `w0r1d_d43m0n` frei | `Augmentations.ts:1946` |
| **QLink** | Illuminati | 1,875e6 | 2,5e13 | hacking 1.75, hacking_speed 2.0, hacking_chance 2.5, hacking_money 4.0 | `Augmentations.ts:1468` |
| ECorp HVMind Implant | ECorp | 1,5e6 | 5,5e9 | hacking_grow 3.0 | `Augmentations.ts:917` |
| Cranial Signal Processors Gen V | BitRunners | 2,5e5 | 2,25e9 | hacking 1.30, hacking_money 1.25, hacking_grow 1.75 (Prereq G1-G4) | `Augmentations.ts:476` |
| ENM Core V3 Upgrade | ECorp, MegaCorp, Fulcrum, NWO, Daedalus, Covenant, Illuminati | 1,75e6 | 7,5e9 | hacking 1.10, hacking_speed 1.05, hacking_money 1.40, hacking_chance 1.10, hacking_exp 1.25 | `Augmentations.ts:636` |
| ENM DMA Upgrade | ECorp, MegaCorp, Fulcrum, NWO, Daedalus, Covenant, Illuminati | 1e6 | 7e9 | hacking_money 1.40, hacking_chance 1.20 | `Augmentations.ts:659` |
| ENM Core V2 Upgrade | BitRunners, ECorp, MegaCorp, Fulcrum, NWO, Blade, OmniTek, KuaiGong | 1e6 | 4,5e9 | hacking 1.08, hacking_speed 1.05, hacking_money 1.30, hacking_chance 1.05, hacking_exp 1.15 | `Augmentations.ts:611` |
| Cranial Signal Processors Gen IV | TheBlackHand, BitRunners | 1,25e5 | 1,1e9 | hacking_speed 1.02, hacking_money 1.20, hacking_grow 1.25 | `Augmentations.ts:458` |
| BitRunners Neurolink | BitRunners | 8,75e5 | 4,375e9 | hacking 1.15, hacking_exp 1.20, hacking_chance 1.10, hacking_speed 1.05; **gibt FTPCrack.exe + relaySMTP.exe nach Install** | `Augmentations.ts:1203` |
| Neural Accelerator | BitRunners | 2e5 | 1,75e9 | hacking 1.10, hacking_exp 1.15, hacking_money 1.20 | `Augmentations.ts:1107` |
| Artificial Bio-neural Network | BitRunners, Fulcrum | 2,75e5 | 3e9 | hacking 1.12, hacking_speed 1.03, hacking_money 1.15 | `Augmentations.ts:48` |
| ENM Core Implant | BitRunners, TheBlackHand, ECorp, MegaCorp, Fulcrum, NWO, Blade | 175e3 | 2,5e9 | hacking 1.07, hacking_speed 1.03, hacking_money 1.10, hacking_chance 1.03, hacking_exp 1.07 | `Augmentations.ts:589` |
| ENM Analyze Engine | ECorp, MegaCorp, Fulcrum, NWO, Daedalus, Covenant, Illuminati | 6,25e5 | 6e9 | hacking_speed 1.10 | `Augmentations.ts:571` |
| Cranial Signal Processors Gen III | NiteSec, TheBlackHand, BitRunners | 5e4 | 5,5e8 | hacking 1.09, hacking_speed 1.02, hacking_money 1.15 | `Augmentations.ts:444` |
| DataJack | BitRunners, TheBlackHand, NiteSec, Chongqing, NewTokyo | 1,125e5 | 4,5e8 | hacking_money 1.25 | `Augmentations.ts:496` |
| Embedded Netburner Module | BitRunners, TheBlackHand, NiteSec, ECorp, MegaCorp, Fulcrum, NWO, Blade | 1,5e4 | 2,5e8 | hacking 1.08 (Prereq fuer die ganze ENM-Kette) | `Augmentations.ts:550` |
| Enhanced Myelin Sheathing | Fulcrum, BitRunners, TheBlackHand | 1e5 | 1,375e9 | hacking 1.08, hacking_speed 1.03, hacking_exp 1.10 | `Augmentations.ts:679` |
| OmniTek InfoLoad | OmniTek | 6,25e5 | 2,875e9 | hacking 1.20, hacking_exp 1.25 | `Augmentations.ts:1336` |
| Xanipher | NWO | 8,75e5 | 4,25e9 | **alle Skills 1.20, alle Exp 1.15** | `Augmentations.ts:2047` |
| nextSENS Gene Modification | Clarke Inc. | 4,375e5 | 1,925e9 | alle Skills 1.20 | `Augmentations.ts:1320` |
| Neuronal Densification | Clarke Inc. | 1,875e5 | 1,375e9 | hacking 1.15, hacking_exp 1.10, hacking_speed 1.03 | `Augmentations.ts:1217` |

#### Reputation und Wirtschaftlichkeit (indirekt oft staerker)

| Aug | Faktion(en) | Rep | Basispreis | Multiplikatoren | Quelle |
|---|---|---:|---:|---|---|
| **Neuroreceptor Management Implant** | TianDiHui | 0,75e5 | 5,5e8 | keine Zahlenwerte, aber **hebt die Fokus-Strafe von 0.8 auf** (`src/PersonObjects/Player/PlayerObjectGeneralMethods.ts:622-628`) -> +25 % auf alle Arbeit ohne Fokus | `Augmentations.ts:1229` |
| **SmartJaw** | Bachman & Associates | 3,75e5 | 2,75e9 | charisma 1.50, charisma_exp 1.50, company_rep 1.25, faction_rep 1.25 | `Augmentations.ts:1533` |
| ADR-V2 Pheromone Gene | Silhouette, FourSigma, B&A, Clarke | 6,25e4 | 5,5e8 | company_rep 1.20, faction_rep 1.20, charisma 1.10 | `Augmentations.ts:31` |
| Social Negotiation Assistant (S.N.A) | TianDiHui | 6,25e3 | 3e7 | company_rep 1.15, faction_rep 1.15, work_money 1.10, charisma_exp 1.15 | `Augmentations.ts:1483` |
| The Shadow's Simulacrum | Syndicate, Dark Army, Speakers | 3,75e4 | 4e8 | company_rep 1.15, faction_rep 1.15 | `Augmentations.ts:1520` |
| ADR-V1 Pheromone Gene | TianDiHui, Syndicate, NWO, MegaCorp, FourSigma | 3,75e3 | 1,75e7 | company_rep 1.10, faction_rep 1.10, charisma_exp 1.05 | `Augmentations.ts:13` |
| PCMatrix | Aevum | 100e3 | 2e9 | work_money 1.777, faction_rep/company_rep/crime_money/crime_success/charisma je 1.0777; gibt DeepscanV1.exe + AutoLink.exe | `Augmentations.ts:1405` |
| PC DNI NeuroNet Injector | Fulcrum | 1,5e6 | 7,5e9 | company_rep 2.0, hacking 1.10, hacking_speed 1.05 (Prereq PCDNI) | `Augmentations.ts:1379` |
| PC DNI Optimization Submodule | Fulcrum, ECorp, Blade | 5e5 | 4,5e9 | company_rep 1.75, hacking 1.10 (Prereq PCDNI) | `Augmentations.ts:1393` |
| PC Direct-Neural Interface | FourSigma, OmniTek, ECorp, Blade | 3,75e5 | 3,75e9 | company_rep 1.30, hacking 1.08 | `Augmentations.ts:1363` |
| CashRoot Starter Kit | Sector-12 | 1,25e4 | 1,25e8 | startingMoney 1e6 nach jeder Installation, dazu BruteSSH.exe | `Augmentations.ts:320` |
| Hacknet Node Core DNI | Netburners | 1,25e4 | 6e7 | hacknet_node_money 1.45 | `Augmentations.ts:875` |
| Neuregen Gene Modification | Chongqing | 3,75e4 | 3,75e8 | hacking_exp 1.40 | `Augmentations.ts:1149` |
| NeuroFlux Governor | fast alle Faktionen | 500 * 1.14^Lvl | 750e3 * 1.14^Lvl | +1,000262 % auf fast alles, unbegrenzt stapelbar | `Augmentations.ts:1159` |

Die NFG-Faktionsliste ist berechnet (`src/Augmentation/Augmentations.ts:1198-1204`): **alle
Faktionen ausser ShadowsOfAnarchy, Bladeburners und ChurchOfTheMachineGod.**

#### Frueh erreichbar (CyberSec/NiteSec/Netburners/TianDiHui)

| Aug | Faktion | Rep | Preis | Wirkung | Quelle |
|---|---|---:|---:|---|---|
| Neurotrainer I | CyberSec, Aevum | 1e3 | 4e6 | alle Exp 1.10 | `Augmentations.ts:1241` |
| Synaptic Enhancement Implant | CyberSec, Aevum | 2e3 | 7,5e6 | hacking_speed 1.03 | `Augmentations.ts:1725` |
| BitWire | CyberSec, NiteSec | 3,75e3 | 1e7 | hacking 1.05 | `Augmentations.ts:181` |
| Cranial Signal Processors Gen I | CyberSec, NiteSec | 1e4 | 7e7 | hacking 1.05, hacking_speed 1.01 | `Augmentations.ts:418` |
| Cranial Signal Processors Gen II | CyberSec, NiteSec | 1,875e4 | 1,25e8 | hacking 1.07, hacking_speed 1.02, hacking_chance 1.05 | `Augmentations.ts:430` |
| Artificial Synaptic Potentiation | NiteSec, TheBlackHand | 6,25e3 | 8e7 | hacking_speed 1.02, hacking_chance 1.05, hacking_exp 1.05 | `Augmentations.ts:62` |
| Neurotrainer II | NiteSec, BitRunners | 1e4 | 4,5e7 | alle Exp 1.15 | `Augmentations.ts:1257` |
| Neural-Retention Enhancement | NiteSec | 2e4 | 2,5e8 | hacking_exp 1.25 | `Augmentations.ts:1118` |
| CRTX42-AA Gene Modification | NiteSec | 4,5e4 | 2,25e8 | hacking 1.08, hacking_exp 1.15 | `Augmentations.ts:309` |
| Hacknet Node Kernel DNI | Netburners | 7,5e3 | 4e7 | hacknet_node_money 1.25 | `Augmentations.ts:885` |
| Speech Enhancement | TianDiHui u.a. | 2,5e3 | 1,25e7 | company_rep 1.10, charisma 1.10 | `Augmentations.ts:1555` |
| Nuoptimal Nootropic Injector | TianDiHui u.a. | 5e3 | 2e7 | company_rep 1.20, charisma 1.03 | `Augmentations.ts:1287` |
| Speech Processor Implant | TianDiHui, Staedte, Silhouette | 7,5e3 | 5e7 | charisma 1.20 | `Augmentations.ts:1573` |

#### Sonderfaelle

- **BigDsBigBrain** (`src/Augmentation/Augmentations.ts:85`): `repCost: Infinity`,
  `moneyCost: Infinity`, `factions: []` - alle Multiplikatoren 2.0, `startingMoney: 1e12`.
  Nicht kaufbar; wird ueber ein anderes System vergeben. **Luecke:** ich habe im Rahmen dieses
  Auftrags nicht geprueft, welcher Weg sie vergibt.
- **violet Congruity Implant** (`src/Augmentation/Augmentations.ts:391`): `repCost: Infinity`,
  `moneyCost: 50e12`, keine Faktion. Setzt bei Installation `Player.entropy = 0`
  (`src/Augmentation/AugmentationHelpers.ts:45-49`).
- **The Red Pill**: kostet 0 Geld, nur 2,5e6 Rep bei Daedalus. Bewirkt, dass beim naechsten
  Aug-Reset `w0r1d_d43m0n` an `The-Cave` angehaengt wird
  (`src/Prestige.ts:172-180`). `w0r1d_d43m0n` braucht Hacking 3000 und 5 offene Ports
  (`src/Server/data/servers.ts`, Eintrag `SpecialServers.WorldDaemon`).
  In BN15 bietet Daedalus die Red Pill nicht an (`src/Faction/FactionHelpers.tsx:205-207`).

### 2.6 Entropy

`CONSTANTS.EntropyEffect = 0.98` (`src/Constants.ts:104`) - dieser Wert wird mit der Anzahl der
Entropy-Stacks potenziert und auf alle Spielermultiplikatoren angewandt. Entropy entsteht beim
Grafting (`src/PersonObjects/Grafting/EntropyAccumulation.ts`) und wird nur durch das Congruity
Implant zurueckgesetzt.

### 2.7 Grafting (Alternative ohne Rep)

`src/PersonObjects/Grafting/GraftableAugmentation.ts:20-29`
```
cost = aug.baseCost * CONSTANTS.AugmentationGraftingCostMult          // Faktor 3
time = (3_600_000 ms * log2(max(Summe der Mult-Werte != 1, 1)) + 1_800_000 ms) / 2
```
(`src/Constants.ts:96-97`). Grafting braucht **keine Faction-Rep**, kostet aber das Dreifache und
erzeugt Entropy. `isSpecial`-Augs sind ausgeschlossen
(`src/PersonObjects/Grafting/GraftingHelpers.ts:11-18`).

---

## 3. Faction Reputation aus Arbeit

Alle drei Formeln in `src/PersonObjects/formulas/reputation.ts`. Rueckgabe: **Rep pro Cycle**
(`src/Work/Formulas.ts:81-89`). Pro Sekunde mal 5.

Gemeinsamer Faktor (`src/PersonObjects/formulas/reputation.ts:8-14`):
```
mult(favor) = (1 + favor / 100) * BitNode.FactionWorkRepGain
```

### 3.1 Hacking Contracts

`src/PersonObjects/formulas/reputation.ts:16-24`
```
repPerCycle = ( (hacking + intelligence/3 + darknetChaBonus(0.1)) / 975 )
            * mults.faction_rep
            * (1 + intelligence^0.8 / 600)
            * (1 + favor/100) * BitNode.FactionWorkRepGain
            * shareBonus
```

### 3.2 Security Work

`src/PersonObjects/formulas/reputation.ts:26-38`
```
t = 0.9 * ( str + def + dex + agi + darknetChaBonus(0.3)
            + (hacking + intelligence) * shareBonus )
    / 975 / 4.5

repPerCycle = t * mults.faction_rep * (1 + favor/100) * BitNode.FactionWorkRepGain
              * (1 + intelligence^0.8 / 600)
```

### 3.3 Field Work

`src/PersonObjects/formulas/reputation.ts:40-52`
```
t = 0.9 * ( str + def + dex + agi + charisma
            + (hacking + intelligence + darknetChaBonus(0.3)) * shareBonus )
    / 975 / 5.5

repPerCycle = t * mults.faction_rep * (1 + favor/100) * BitNode.FactionWorkRepGain
              * (1 + intelligence^0.8 / 600)
```

### 3.4 Nebenfaktoren

- `darknetChaBonus(scalar)` (`src/PersonObjects/formulas/reputation.ts:54-59`) ist nur bei
  **SF15 Level >= 3** ungleich null und liefert `charisma * scalar`. In BN1 ohne SF15 also 0.
- `shareBonus = 1 + ln(shareThreads) / 25` (`src/NetworkShare/Share.ts:43-49`), Startwert
  `shareThreads = 1` -> Bonus 1. Effektive Threads = `threads * intBonus(int, 2) * coreBonus`
  (`src/NetworkShare/Share.ts:22-25`).
  Beim Hacking-Contract multipliziert der Share-Bonus **das gesamte Ergebnis**, bei Security und
  Field nur den `(hacking + intelligence)`-Anteil. Fuer einen reinen Hacker ist Hacking-Contract
  deshalb der einzige Arbeitstyp, bei dem Share sich voll auszahlt.
- **Fokus-Strafe**: `getReputationRate()` multipliziert mit `Player.focusPenalty()`
  (`src/Work/FactionWork.tsx:37-40`). `focusPenalty()` ist 0.8 wenn man nicht fokussiert ist -
  ausser man hat das **Neuroreceptor Management Implant**, dann immer 1
  (`src/PersonObjects/Player/PlayerObjectGeneralMethods.ts:622-628`,
  `CONSTANTS.BaseFocusBonus = 0.8`, `src/Constants.ts:87`).

### 3.5 Passiver Reputationsgewinn

`src/Faction/FactionHelpers.tsx:132-170`, ausgefuehrt alle 5 Cycles (`src/engine.tsx:185-188`).

```
favorMult = min(0.1, favor/1000 + 0.01)
rate      = max( hRep*favorMult, sRep*favorMult, fRep*favorMult, 1/120 )
rep      += rate * numCycles * BitNode.FactionPassiveRepGain
```
wobei hRep/sRep/fRep dieselben drei Formeln von oben sind.

Ausgenommen sind: die Faktion, fuer die man gerade arbeitet; Nicht-Mitglieder;
`special`-Faktionen (Bladeburners, Church of the Machine God, Shadows of Anarchy); die eigene Gang.
Untergrenze ist 1 Rep pro 2 Minuten.

Bei 0 Favor sind das 1 % der aktiven Rate, bei 50 Favor 6 %, bei >= 90 Favor 10 % (Deckel).

### 3.6 Reputation aus Coding Contracts

`src/PersonObjects/Player/PlayerObjectGeneralMethods.ts:520`
```
repGain = CONSTANTS.CodingContractBaseFactionRepGain * difficulty * (rewardScaling / 3)
```
`CodingContractBaseFactionRepGain = 2500` (`src/Constants.ts:91`);
`adjustedScaling = rewardScaling / 3` (`src/PersonObjects/Player/PlayerObjectGeneralMethods.ts:511`).
Die Faktion wird zufaellig aus den beigetretenen Faktionen gewaehlt, die `offerHackingWork` haben.
Bei der Variante `FactionReputationAll` (`:530-534`) wird derselbe Betrag gleichmaessig auf alle
diese Faktionen aufgeteilt.

### 3.7 Erfahrungsgewinn bei Faction Work

`src/Work/Formulas.ts:39-56` (Basiswerte pro Sekunde, dann durch `gameCPS` geteilt):

| Arbeitstyp | hackExp | strExp | defExp | dexExp | agiExp | chaExp |
|---|---:|---:|---:|---:|---:|---:|
| hacking | 2 | 0 | 0 | 0 | 0 | 0 |
| field | 1 | 1 | 1 | 1 | 1 | 1 |
| security | 0.5 | 1.5 | 1.5 | 1.5 | 1.5 | 0 |

Skaliert mit `person.mults.*_exp` und `BitNode.FactionWorkExpGain`
(`src/Work/Formulas.ts:92-97`). Das ist verschwindend wenig gegenueber Hacking-Scripts oder
Uni-Kursen - Faction Work betreibt man wegen der Rep, nicht wegen der Exp.

---

## 4. Faction Favor

`src/Faction/formulas/favor.ts`

```
favorToRep(f) = 25000 * (1.02^f - 1)          // Zeile 12-15
repToFavor(r) = ln(1 + r/25000) / ln(1.02)    // Zeile 17-20
```
Die Konstante ist `log1point02 = 0.019802627296179712` (`src/Faction/formulas/favor.ts:10`),
absichtlich die naechstliegende darstellbare Zahl statt `Math.log(1.02)`.
Obergrenze: `MaxFavor = 35331` (`src/Faction/formulas/favor.ts:7`).

Favor wird **nur beim Aug-Reset gutgeschrieben** (`src/Faction/Faction.ts:77-85`):
```
setFavor( repToFavor( favorToRep(favor) + playerReputation ) )
playerReputation = 0
```
Also: Favor und aktuelle Rep werden addiert (in Rep-Einheiten), dann neu in Favor umgerechnet.
Rep, die man in einem Lauf sammelt und nicht ausgibt, ist beim Reset nicht verloren - sie wird zu
Favor.

Beim BitNode-Wechsel wird Favor auf 0 gesetzt (`src/Faction/Faction.ts:68-75`).

| Favor | kumulativ noetige Reputation |
|---:|---:|
| 1 | 500 |
| 10 | 5.475 |
| 25 | 16.015 |
| 50 | 42.290 |
| 75 | 85.396 |
| 100 | 156.116 |
| 125 | 272.140 |
| **150** | **462.490** |
| 200 | 1.287.122 |
| 250 | 3.506.693 |
| 300 | 9.480.863 |

### Was Favor bewirkt

1. **Rep-Bonus bei Arbeit**: Faktor `1 + favor/100`
   (`src/PersonObjects/formulas/reputation.ts:9`). Bei 150 Favor also **2,5-fache Rep-Rate**.
2. **Passiver Rep-Gewinn**: `favorMult = min(0.1, favor/1000 + 0.01)`
   (`src/Faction/FactionHelpers.tsx:157`).
3. **Spenden freischalten** ab der Schwelle (siehe 5).
4. Bei **Firmen** ebenfalls `1 + favor/100` auf Company-Rep (`src/Work/Formulas.ts:131, 156`) und
   - nur mit SF11 - auch auf das Gehalt (`src/Work/Formulas.ts:132`).

### Die 150-Favor-Schwelle - geprueft

`src/Faction/formulas/donation.ts:16-18`
```
favorNeededToDonate() = floor( CONSTANTS.BaseFavorToDonate * BitNode.FavorToDonateToFaction )
```
`BaseFavorToDonate = 150` (`src/Constants.ts:31`), `FavorToDonateToFaction = 1` in BN1
(`src/BitNode/BitNodeMultipliers.ts:143`). **Also exakt 150 Favor in BN1.**

Durchgesetzt wird das an zwei Stellen:
- UI: `src/Faction/ui/FactionRoot.tsx:103-104` (`canDonate = faction.favor >= favorToDonate`),
  Button deaktiviert in `src/Faction/ui/DonateOption.tsx:60-62`.
- Singularity-API: `src/NetscriptFunctions/Singularity.ts:951-957`.

150 Favor entsprechen 462.490 kumulierter Reputation.

---

## 5. Geld gegen Reputation spenden

`src/Faction/formulas/donation.ts:8-14`

```
repFromDonation(amt, person)  = (amt / CONSTANTS.DonateMoneyToRepDivisor)
                              * person.mults.faction_rep
                              * BitNode.FactionWorkRepGain

donationForRep(rep, person)   = rep * CONSTANTS.DonateMoneyToRepDivisor
                              / person.mults.faction_rep
                              / BitNode.FactionWorkRepGain
```

`DonateMoneyToRepDivisor = 1e6` (`src/Constants.ts:33`).

**Ohne Multiplikatoren also: 1.000.000 $ = 1 Reputation.**
Mit `faction_rep = 2.0` sind es 500.000 $ pro Rep.

Die Spende schreibt die Rep sofort gut und zieht das Geld ab
(`src/Faction/formulas/donation.ts:25-35`). Es gibt keinen Deckel und keine Abnutzung.

Praktische Groessenordnungen bei `faction_rep = 1`:

| Ziel | Kosten |
|---|---:|
| 462.490 Rep (150 Favor) | 462 Mrd. $ |
| 2,5e6 Rep (The Red Pill) | 2,5 Bio. $ |
| 1,875e6 Rep (QLink) | 1,875 Bio. $ |

---

## 6. Faction-Beitrittsbedingungen (alle Faktionen)

Definiert in `src/Faction/FactionInfo.tsx` als `inviteReqs` (Einladung) und `rumorReqs`
(Geruecht/Hinweis). Alle Bedingungen einer Liste muessen erfuellt sein
(`everyCondition`, `src/Faction/FactionInfo.tsx:98-99`). Die Praedikate selbst stehen in
`src/Faction/FactionJoinCondition.ts`.

Geprueft wird laufend in `checkForFactionInvitations`
(`src/PersonObjects/Player/PlayerObjectGeneralMethods.ts:453-466`).

### 6.1 Frueh erreichbar

| Faktion | Beitrittsbedingung | Arbeit | Quelle |
|---|---|---|---|
| **CyberSec** | Backdoor auf `CSEC` | hacking | `FactionInfo.tsx:489` |
| **Netburners** | hacking >= 80, Hacknet-RAM gesamt >= 8, Hacknet-Cores gesamt >= 4, Hacknet-Level gesamt >= 100 | hacking | `FactionInfo.tsx:675` |
| **Tian Di Hui** | in Chongqing / New Tokyo / Ishima, hacking >= 50, >= 1e6 $ | hacking, security | `FactionInfo.tsx:683-687` |
| **NiteSec** | Backdoor auf `avmnite-02h` | hacking | `FactionInfo.tsx:464-466` |
| **The Black Hand** | Backdoor auf `I.I.I.I` | hacking, field | `FactionInfo.tsx:419` |
| **BitRunners** | Backdoor auf `run4theh111z` | hacking | `FactionInfo.tsx:402` |
| **Slum Snakes** | alle Kampfskills >= 30, >= 1e6 $, Karma <= -9 | field, security | `FactionInfo.tsx:665` |
| **Tetrads** | in Chongqing / New Tokyo / Ishima, alle Kampfskills >= 75, Karma <= -18 | field, security | `FactionInfo.tsx:648-652` |

Die Backdoor-Server (`src/Server/data/SpecialServers.ts:4-11`) und ihre Anforderungen
(`src/Server/data/servers.ts`):

| Server | Faktion | benoetigtes Hacking-Level | Ports |
|---|---|---|---:|
| `CSEC` | CyberSec | 51 - 60 (zufaellig pro Lauf) | 1 |
| `avmnite-02h` | NiteSec | 202 - 220 | 2 |
| `I.I.I.I` | The Black Hand | 340 - 365 | 3 |
| `run4theh111z` | BitRunners | 505 - 550 | 4 |
| `fulcrumassets` | Fulcrum Secret Technologies | 1100 - 1600 | 5 |
| `The-Cave` | (Daedalus-Server) | 925 | 5 |
| `w0r1d_d43m0n` | Endgegner | 3000 | 5 |

### 6.2 Stadtfaktionen

Alle: in der Stadt sein plus Geldschwelle. Sie sind untereinander **verfeindet** - der Beitritt zu
einer sperrt die Gegner dauerhaft (`src/Faction/FactionHelpers.tsx:44-46`).

| Faktion | Bedingung | Feinde | Quelle |
|---|---|---|---|
| Sector-12 | in Sector-12, >= 15e6 $ | Chongqing, New Tokyo, Ishima, Volhaven | `FactionInfo.tsx:540-541` |
| Chongqing | in Chongqing, >= 20e6 $ | Sector-12, Aevum, Volhaven | `FactionInfo.tsx:508-509` |
| New Tokyo | in New Tokyo, >= 20e6 $ | Sector-12, Aevum, Volhaven | `FactionInfo.tsx:530-531` |
| Ishima | in Ishima, >= 30e6 $ | Sector-12, Aevum, Volhaven | `FactionInfo.tsx:520-521` |
| Aevum | in Aevum, >= 40e6 $ | Chongqing, New Tokyo, Ishima, Volhaven | `FactionInfo.tsx:498-499` |
| Volhaven | in Volhaven, >= 50e6 $ | Chongqing, Sector-12, New Tokyo, Aevum, Ishima | `FactionInfo.tsx:552-553` |

Praktisch: **Sector-12 + Aevum** vertragen sich, ebenso **Chongqing + New Tokyo + Ishima**.
Volhaven ist mit allen verfeindet.

### 6.3 Kriminelle Organisationen

| Faktion | Bedingung | Quelle |
|---|---|---|
| Silhouette | CTO, CFO oder CEO einer Firma, >= 15e6 $, Karma <= -22 | `FactionInfo.tsx:639` |
| The Syndicate | in Aevum oder Sector-12, nicht bei CIA/NSA angestellt, >= 10e6 $, hacking >= 200, alle Kampfskills >= 200, Karma <= -90 | `FactionInfo.tsx:604-612` |
| The Dark Army | in Chongqing, nicht bei CIA/NSA, hacking >= 300, alle Kampfskills >= 300, >= 5 Menschen getoetet, Karma <= -45 | `FactionInfo.tsx:581-589` |
| Speakers for the Dead | nicht bei CIA/NSA, hacking >= 100, alle Kampfskills >= 300, >= 30 Menschen getoetet, Karma <= -45 | `FactionInfo.tsx:564-571` |

### 6.4 Megakonzern-Faktionen

Alle nach demselben Muster (`src/Faction/FactionInfo.tsx:191, 214-217, 240-243, 256-259, 276,
292-295, 311-314, 332-335, 351-354`):
```
inviteReqs: [ employedBy(<Firma>), haveCompanyRep(<Firma>, CONSTANTS.CorpFactionRepRequirement) ]
```
`CorpFactionRepRequirement = 400e3` (`src/Constants.ts:25`).

Betroffen: ECorp, MegaCorp, Bachman & Associates, Blade Industries, NWO, Clarke Incorporated,
OmniTek Incorporated, Four Sigma, KuaiGong International.

**Fulcrum Secret Technologies** braucht zusaetzlich einen Backdoor auf `fulcrumassets`
(`src/Faction/FactionInfo.tsx:376-380`).

Die geforderte Firmen-Rep sinkt auf **75 %**, wenn auf dem Firmenserver ein Backdoor installiert ist
(`src/Company/utils.ts:15-19`, `CompanyRequiredReputationMultiplier = 0.75`,
`src/Constants.ts:110`) - also 300.000 statt 400.000.

### 6.5 Endgame

| Faktion | Bedingung | Quelle |
|---|---|---|
| **Daedalus** | >= `BitNode.DaedalusAugsRequirement` installierte Augs (BN1: **30**), >= 100e9 $, UND (hacking >= 2500 ODER alle Kampfskills >= 1500) | `FactionInfo.tsx:141-145`, `BitNodeMultipliers.ts:61` |
| The Covenant | >= 20 Augs, >= 75e9 $, hacking >= 850, alle Kampfskills >= 850 | `FactionInfo.tsx:167` |
| Illuminati | >= 30 Augs, >= 150e9 $, hacking >= 1500, alle Kampfskills >= 1200 | `FactionInfo.tsx:132` |

`haveAugmentations(n)` zaehlt `p.augmentations.length` inklusive NFG
(`src/Faction/FactionJoinCondition.ts:116-132`). Nur bei `n === 0` werden NFG-Level ausgenommen.
**NFG-Level zaehlen also fuer die Daedalus-Schwelle mit** - aber nur als *eine* Aug, da NFG in
`Player.augmentations` nur einmal mit einem `level`-Feld steht
(`src/Augmentation/AugmentationHelpers.ts:55-59`).

### 6.6 Sonderfaktionen

| Faktion | Bedingung | Besonderheit | Quelle |
|---|---|---|---|
| Bladeburners | BN6/BN7 oder SF6/SF7, Bladeburner-Rank >= `RankNeededForFaction` | `special: true`, keine Arbeit - Rep nur ueber Contracts/Operations | `FactionInfo.tsx:709-713` |
| Church of the Machine God | BN13 oder SF13, **0 Augs installiert** (NFG ausgenommen), Kirche in Chongqing besucht | `special`, `keepOnInstall` | `FactionInfo.tsx:760-769` |
| Shadows of Anarchy | eine Infiltration abgeschlossen | `special`, `keepOnInstall`, Rep nur ueber Infiltration | `FactionInfo.tsx:798-805` |

### 6.7 Was beim Aug-Reset mit den Faktionen passiert

`src/Prestige.ts:61-67, 106, 118-121`:
- Alle Mitgliedschaften und Einladungen werden geloescht (`src/Faction/Faction.ts:77-85`).
- Faktionen mit `keepOnInstall: true` behalten ihre Einladung: die neun Megakonzerne, Fulcrum,
  Church of the Machine God, Shadows of Anarchy.
- Favor wird gutgeschrieben, Rep auf 0.

---

## 7. Company-Arbeit

### 7.1 Rep-Formel

`src/Company/CompanyPosition.ts:156-172` (`calculateJobPerformance`):
```
ratio_s      = effectiveness_s * skill_s / 975      fuer s in {hack, str, def, dex, agi, cha}
performance  = repMultiplier * (Summe aller ratio_s) / 100
             + intelligence / 975
```
Die sechs `*Effectiveness`-Werte summieren sich per Konstruktion auf 100
(`src/Company/CompanyPosition.ts:123-134`).

`src/Work/Formulas.ts:154-156`:
```
repPerCycle = performance * mults.company_rep * (1 + favor/100) * BitNode.CompanyWorkRepGain
```

Dazu die Fokus-Strafe, ausser bei Teilzeitstellen (`src/Work/CompanyWork.tsx:36-39`).

**Wichtig**: `company.expMultiplier` und `company.salaryMultiplier` wirken **nicht** auf die
Reputation. In `calculateCompanyWorkStats` wird `gains.reputation` erst *nach* dem
`scaleWorkStats(..., company.expMultiplier * ...)` gesetzt (`src/Work/Formulas.ts:135-156`).
Fuer die Rep-Rate zaehlen also nur: Position (`repMultiplier`), eigene Skills, `company_rep`-Mult,
Favor. Die Firma selbst spielt nur ueber `jobStatReqOffset` (welche Position man ueberhaupt halten
kann) und ueber Geld/Exp eine Rolle.

### 7.2 Geld und Exp

`src/Work/Formulas.ts:135-152`:
```
money   = baseSalary * company.salaryMultiplier * bn11Mult * BitNode.CompanyWorkMoney
          * mults.work_money * sf15Mult                      (pro Cycle)
xxxExp  = xxxExpGain * mults.xxx_exp * company.expMultiplier * BitNode.CompanyWorkExpGain
```
`bn11Mult = 1 + favor/100`, aber **nur mit SF11** (`src/Work/Formulas.ts:131-132`).

`baseSalary` ist $ pro 200-ms-Cycle (`src/Company/CompanyPosition.ts:52-56`).

### 7.3 Positionen - die relevanten Werte

`src/Company/data/CompanyPositionsMetadata.ts`. `repMultiplier` ist der einzige positionsabhaengige
Rep-Hebel.

**Software-Leiter** (fuer Hacker der natuerliche Weg, hackingEffectiveness 65-85):

| Position | Zeile | baseSalary | repMult | benoetigt (vor `jobStatReqOffset`) | benoetigte Firmen-Rep |
|---|---:|---:|---:|---|---:|
| Software Engineering Intern | 7 | 33 | 0,9 | hack 1 | 0 |
| Junior Software Engineer | 19 | 80 | 1,1 | hack 51 | 8e3 |
| Senior Software Engineer | 31 | 165 | 1,3 | hack 251, cha 51 | 40e3 |
| Lead Software Developer | 44 | 500 | 1,5 | hack 401, cha 151 | 200e3 |
| Head of Software | 57 | 800 | 1,6 | hack 501, cha 251 | 400e3 |
| Head of Engineering | 71 | 1650 | 1,6 | hack 501, cha 251 | 800e3 |
| Vice President of Technology | 85 | 2310 | 1,75 | hack 601, cha 401 | 1,6e6 |
| Chief Technology Officer | 99 | 2640 | 2,0 | hack 751, cha 501 | 3,2e6 |

**Business-Leiter** (charismaEffectiveness 85-90):

| Position | Zeile | baseSalary | repMult | benoetigt | Firmen-Rep |
|---|---:|---:|---:|---|---:|
| Business Intern | 204 | 46 | 0,9 | cha 1, hack 1 | 0 |
| Business Analyst | 217 | 100 | 1,1 | cha 51, hack 6 | 8e3 |
| Business Manager | 230 | 200 | 1,3 | cha 101, hack 51 | 40e3 |
| Operations Manager | 243 | 660 | 1,5 | cha 226, hack 51 | 200e3 |
| Chief Financial Officer | 256 | 1950 | 1,6 | cha 501, hack 76 | 800e3 |
| Chief Executive Officer | 270 | 3900 | 1,75 | cha 751, hack 101 | 3,2e6 |

Weitere Leitern: IT (Zeile 113-162, repMult 0,9 bis 1,4), Security Engineer (163), Network Engineer
(177-203), Security Guard bis Head of Security (284 ff.), Agent (agent0-agent2), Employee/Waiter
(Teilzeit, repMult 1, `isPartTime: true` bei Zeile 567 und 586), Software-/Business-Consultant.

Der `jobStatReqOffset` der Firma wird auf **alle** Skill-Anforderungen aufgeschlagen
(`src/Company/CompanyPosition.ts:144-154`, `src/Company/GetJobRequirements.ts:7-19`):

| Firma | expMult / salaryMult | jobStatReqOffset | Quelle |
|---|---:|---:|---|
| ECorp, MegaCorp | 3,0 | 249 | `CompaniesMetadata.ts:22, 30` |
| NWO, Blade Industries | 2,75 | 249 / 224 | `CompaniesMetadata.ts:54, 46` |
| Bachman & Associates | 2,6 | 224 | `CompaniesMetadata.ts:38` |
| Four Sigma | 2,5 | 224 | `CompaniesMetadata.ts:78` |
| Clarke Inc., OmniTek | 2,25 | 224 | `CompaniesMetadata.ts:62, 70` |
| KuaiGong International | 2,2 | 224 | `CompaniesMetadata.ts:86` |
| Fulcrum Technologies | 2,0 | 224 | `CompaniesMetadata.ts:94` |
| Storm Technologies, Helios Labs, VitaLife | 1,8 | 199 | `CompaniesMetadata.ts:102, 116, 123` |
| DefComm | 1,75 | 199 | `CompaniesMetadata.ts:109` |

Ein "Chief Technology Officer" bei ECorp braucht also hacking 751+249 = **1000** und charisma
501+249 = **750**.

### 7.4 Wann bringt was am meisten

- **Rep pro Sekunde**: `5 * (repMult * gewichtete Skillsumme / 100 + int/975) * company_rep * (1+favor/100)`.
  Bei voll ausgereizten Skills (alle Ratios = 100) ist der Unterschied zwischen Intern (0,9) und
  CTO (2,0) genau Faktor 2,22. Der viel groessere Hebel ist die **Skillhoehe**: mit hacking 250 bei
  einem Job mit 85 % Hacking-Gewichtung ist die Summe nur 21,8 statt 85.
- Deshalb: fuer die 400e3 Firmen-Rep der Megakonzern-Faktion ist die **hoechste erreichbare
  Position** in der Firma richtig, aber es lohnt nicht, dafuer erst Charisma zu trainieren -
  Software Engineering Intern bei ECorp mit hacking 1000 bringt bereits
  `0.9 * (85*1000/975 + 15*cha/975) / 100`; der Sprung zum CTO verdoppelt das nur.
- **Geld**: hier zaehlt `salaryMultiplier` der Firma voll mit. CEO bei ECorp: `3900 * 3 = 11.700 $`
  pro Cycle = 58.500 $/s. Das ist gegenueber Hacking-Scripts im Mittelspiel vernachlaessigbar.
- **Firmen-Favor** wirkt nur mit SF11 auf das Gehalt, aber **immer** auf die Rep
  (`src/Work/Formulas.ts:131, 156`).

### 7.5 Rep aus Coding Contracts

`CodingContractBaseCompanyRepGain = 4000` (`src/Constants.ts:92`), analog zur Faction-Variante.

---

## 8. Was der Aug-Reset (Installation) zuruecksetzt

`src/Prestige.ts:55-160` und `src/PersonObjects/Player/PlayerObjectGeneralMethods.ts:80-126`.

**Zurueckgesetzt:**
- Alle Skills auf 1, alle Exp auf 0 (`PlayerObjectGeneralMethods.ts:86-100`) - danach setzt
  `setInitialExpForPlayer()` die Exp so, dass Level 1 herauskommt (`src/Prestige.ts:43-52`).
- Geld auf `1000 + CONSTANTS.Donations` = **1262 $** (`PlayerObjectGeneralMethods.ts:102`).
- Stadt zurueck nach Sector-12, alle Jobs, alle gekauften Server, alle Faktionen weg.
- Alle Server ausser `home` neu erzeugt, Backdoors weg (`src/Prestige.ts:73-98`).
- `home`-Programme bis auf die von Augs gewaehrten geloescht.
- `numPeopleKilled = 0`.

**Bleibt erhalten:**
- Alle installierten Augmentations und damit alle Multiplikatoren.
- **Karma** (wird erst beim BitNode-Wechsel genullt,
  `src/PersonObjects/Player/PlayerObjectGeneralMethods.ts:145-146`).
- Faction-Favor und Company-Favor (frisch aufgestockt).
- Source Files, Sleeves, Stanek's Gift, Go-Fortschritt.
- Einladungen von Faktionen mit `keepOnInstall`.
- NFG-Level.
- Startgeld/Startprogramme aus Augs (CashRoot: 1e6 $ + BruteSSH; PCMatrix: DeepscanV1 + AutoLink;
  Neurolink: FTPCrack + relaySMTP) (`src/Prestige.ts:85-92`).

---

## 9. Praktische Folgerungen

### 9.1 Reihenfolge der Faktionen (BN1, Hacking-Lauf)

1. **CyberSec** - erreichbar ab Hacking ~60, braucht nur den Backdoor auf `CSEC`. Liefert
   Neurotrainer I, Synaptic Enhancement, BitWire, Cranial Signal Processors Gen I+II. Das sind
   ~35.000 Rep fuer die komplette Liste - in der ersten Stunde machbar.
2. **Tian Di Hui** (Hacking 50, 1e6 $, in einer der drei Ost-Staedte). Zwei Gruende: **S.N.A**
   (faction_rep 1.15 fuer nur 6.250 Rep und 30e6 $) und spaeter das **Neuroreceptor Management
   Implant**. S.N.A. so frueh wie moeglich, weil es alle nachfolgende Rep beschleunigt.
   Achtung: der Umzug kostet 200e3 $ (`CONSTANTS.TravelCost`, `src/Constants.ts:28`).
3. **Netburners** - nur wenn man ohnehin Hacknet-Nodes baut. Die 100 kumulierten Node-Level plus
   8 GB RAM und 4 Cores sind ein spuerbarer Umweg; die Augs (hacknet_node_money) helfen nur einer
   Strategie, die im Mittelspiel ohnehin uninteressant wird.
4. **NiteSec** (Backdoor `avmnite-02h`, Hacking ~202-220). Kern: CRTX42-AA, Neural-Retention
   Enhancement, Cranial Signal Processors Gen III. ~120.000 Rep fuer alles.
5. **Sector-12 oder Aevum** (15e6 bzw. 40e6 $). Sector-12 wegen **CashRoot Starter Kit** - 1e6 $
   plus BruteSSH.exe bei jedem Reset ist im frueheren Spiel viel wert. Aevum wegen **PCMatrix**
   (work_money 1.777 und zwei Programme). Beide sind untereinander vertraeglich, aber sie sperren
   Chongqing/New Tokyo/Ishima/Volhaven - also **erst Tian Di Hui beitreten, dann Sector-12/Aevum**.
6. **The Black Hand** (Backdoor `I.I.I.I`, Hacking ~340-365). Cranial Signal Processors Gen IV,
   DataJack, "The Black Hand".
7. **BitRunners** (Backdoor `run4theh111z`, Hacking ~505-550). Die ergiebigste Hacking-Faktion:
   Cranial Signal Processors Gen V, Neural Accelerator, Artificial Bio-neural Network, Neurolink,
   ENM Core V2. Ab hier lohnt Rep-Farmen richtig.
8. **Ein Megakonzern** (400e3 Firmen-Rep, mit Firmen-Backdoor nur 300e3). Praktisch ECorp oder
   MegaCorp - deren Faktionen fuehren die ENM-Oberklasse und, ueber Fulcrum, die PCDNI-Kette
   mit company_rep 2.0.
9. **Daedalus** - 30 installierte Augs, 100e9 $ und Hacking 2500. Ab hier ist der Lauf entschieden;
   The Red Pill kostet nur Rep, kein Geld.

Fuer Kampf-/Verbrechenslaeufe ersetzen Slum Snakes -> Tetrads -> The Syndicate die Schritte 1-7;
The Shadow's Simulacrum (faction_rep 1.15 fuer 37.500 Rep) ist dort das Gegenstueck zu S.N.A.

### 9.2 Reihenfolge der Augmentations in einer Kaufrunde

Zwei Regeln folgen zwingend aus `getAugCost`:

1. **Rep-Anforderungen skalieren nicht.** Man kann in Ruhe die hoechste noetige Rep sammeln und
   dann alles darunter mitnehmen. Rep sammeln lohnt sich also lange, bevor man kauft.
2. **Geldpreise skalieren mit 1.9^k in Kaufreihenfolge.** Also: **teuerste Aug zuerst, dann
   absteigend.** Bei 8 Augs kostet die letzte das 170-fache ihres Basispreises.

Daraus folgt der Standardablauf einer Runde:
- Zuerst alle Rep-Multiplikator-Augs identifizieren (S.N.A, ADR-V1/V2, Shadow's Simulacrum,
  SmartJaw). Sie wirken erst nach der Installation, verbilligen aber die naechste Runde massiv.
- Dann die teuren Augs absteigend kaufen.
- **NeuroFlux Governor immer zuletzt.** Jedes NFG-Level erhoeht den 1.9^k-Zaehler und damit den
  Preis aller danach gekauften Augs. Da NFG selbst nur +1 % gibt, ist jedes Level, das den Kauf
  einer echten Aug verhindert, ein Verlust.
- SoA-Augs stoeren die Rechnung nicht (eigener Kostenpfad, zaehlen nicht mit).

### 9.3 Wann lohnt ein Reset

Der Reset kostet alle Skills und alles Geld, behaelt aber die Multiplikatoren. Entscheidungshilfen
direkt aus den Formeln:

- **Der Level-Multiplikator ist der Grund zu resetten.** Exp fuer Level L ist
  `e^((L/mult + 200)/32) - 534.6`. Der Exp-Bedarf sinkt also um den Faktor `e^(L/32 * (1 - 1/mult))`.
  Konkret bei Level 500: mit mult 1 sind 3,16e9 Exp noetig, mit mult 1.5 nur 1,73e7 - **Faktor 183**.
  Bei Level 750: 7,82e12 gegen 3,16e9, **Faktor 2.471**. Je hoeher das Zielniveau, desto brutaler
  wirkt derselbe Multiplikator.
- **Faustregel aus der Formel**: der Reset lohnt, sobald das Produkt der neu installierten
  `hacking`-Level-Multiplikatoren spuerbar ueber 1 liegt (praktisch ab ~1,2 bis 1,3) - denn der
  Wiederaufbau bis zum alten Stand dauert dann nur noch `1/mult` der urspruenglichen Zeit im
  Exponenten, waehrend der Verlust nur die aktuelle Sitzung ist.
- **Rep ist nicht verloren.** Beim Reset wird ungenutzte Rep in Favor umgewandelt
  (`src/Faction/Faction.ts:77-85`), und Favor gibt `1 + favor/100` auf alle kuenftige Rep. Es ist
  also *kein* Fehler, mit ungenutzter Rep zu resetten - im Gegenteil, es beschleunigt die naechste
  Runde bei genau dieser Faktion.
- **Die 150-Favor-Marke ist die eigentliche Zaesur.** Ab 150 Favor kann man bei der Faktion spenden
  und braucht nie wieder Faction Work dort - Geld ersetzt Zeit im Verhaeltnis 1e6 $ pro Rep.
  Diese Marke (462.490 kumulierte Rep) erreicht man selten in einem Lauf; sie ist ein Ziel ueber
  mehrere Resets hinweg. Faktionen, bei denen man auf 150 Favor hinarbeitet, sollte man in jedem
  Lauf mitnehmen.
- **Nicht resetten**, wenn man kurz vor einer Schwelle steht, die den Lauf beendet: Daedalus
  (30 Augs, Hacking 2500), The Red Pill, `w0r1d_d43m0n` (Hacking 3000).
- **Aug-Zahl fuer Daedalus**: `haveAugmentations(30)` zaehlt nur *installierte* Augs, und NFG zaehlt
  als eine. Wer auf Daedalus zusteuert, braucht 30 verschiedene Augs - dann sind billige
  Ein-Prozent-Augs (Wired Reflexes, Speech Enhancement, ...) plotzlich wertvoll, weil sie den
  Zaehler erhoehen.
- **Entropy beachten**, wenn man Grafting nutzt: jeder Stack multipliziert alle Multiplikatoren mit
  0,98 (`src/Constants.ts:104`).

### 9.4 Rechenbeispiele

Rep-Rate bei Hacking Contracts, ohne Share, ohne Int, faction_rep = 1, Favor 0, fokussiert:

| Hacking-Level | Rep/Cycle | Rep/s | Zeit fuer 100.000 Rep |
|---:|---:|---:|---|
| 100 | 0,103 | 0,51 | 54 h |
| 300 | 0,308 | 1,54 | 18 h |
| 500 | 0,513 | 2,56 | 10,8 h |
| 1000 | 1,026 | 5,13 | 5,4 h |
| 2500 | 2,564 | 12,8 | 2,2 h |

Dieselbe Tabelle mit Favor 100 (Faktor 2,0) und faction_rep 1,5 (S.N.A. + ADR-V2 + Shadow's
Simulacrum ergeben 1,15 * 1,20 * 1,15 = 1,59): Faktor 3,17 - aus 10,8 h werden 3,4 h.

Das zeigt, warum die Rep-Multiplikator-Augs und Favor wichtiger sind als das Hacking-Level allein.

---

## 10. Abweichungen dev vs. v3.0.1

Ich habe `reference/bitburner-src` (dev, v3.0.2) gegen `reference/v301` diffed. Fuer dieses Dokument
relevante Unterschiede:

**Alle Formeldateien sind identisch.** Bitgleich sind:
`Augmentation/Augmentation.ts`, `Augmentation/AugmentationHelpers.ts`, `Faction/Faction.ts`,
`Faction/FactionJoinCondition.ts`, `Faction/formulas/favor.ts`, `Faction/formulas/donation.ts`,
`PersonObjects/formulas/skill.ts`, `PersonObjects/formulas/reputation.ts`,
`PersonObjects/formulas/intelligence.ts`, `Work/FactionWork.tsx`, `Work/CompanyWork.tsx`,
`Company/CompanyPosition.ts`, `Company/data/CompanyPositionsMetadata.ts`,
`Company/data/CompaniesMetadata.ts`, `Faction/FactionHelpers.tsx`, `PersonObjects/Person.ts`.

Inhaltliche Unterschiede in `Augmentation/Augmentations.ts` - **dev nerft mehrere Charisma-Werte,
v3.0.1 hat die hoeheren**:

| Aug | v3.0.1 (gespielt) | dev v3.0.2 | Zeile v301 |
|---|---|---|---:|
| DermaForce Particle Barrier | charisma 1.05 | charisma 1.03 | 512 |
| Primer | charisma 1.10, charisma_exp 1.40 | charisma 1.05, charisma_exp 1.20 | 1457 |
| Speech Enhancement | charisma 1.10 | charisma 1.05 | 1555 |
| Speech Processor Implant | charisma 1.20 | charisma 1.10 | 1573 |
| Synthetic Heart | charisma 1.30 | charisma 1.15 | 1754 |
| NeuroFlux Governor | **kein** `dnet_money` | `dnet_money: 1.01 + donationBonus` | 1159 |

Strategisch relevant: Wer in v3.0.1 Charisma fuer Firmenpositionen braucht (CEO/CFO verlangen
501-751 Charisma plus `jobStatReqOffset`), kommt mit Speech Processor + Synthetic Heart + Primer
deutlich schneller ans Ziel als es der dev-Branch erlauben wuerde
(1,20 * 1,30 * 1,10 = 1,716 statt 1,10 * 1,15 * 1,05 = 1,328).

Weitere Unterschiede (rein kosmetisch, ohne Zahlenwirkung): geaenderte Beschreibungstexte der
Labyrinth-Kette TheBrokenWings `:1850` -> TheBoots `:1866` -> TheHammer `:1881` -> TheStaff `:1897`
-> TheLaw `:1912` -> TheSword `:1928`), Umbenennung `classs` -> `classInfo` in
`Work/Formulas.ts`, `Terminal.prestige()` statt zweier Einzelaufrufe in `Prestige.ts`,
`deleteStockMarket()`-Zweig in `Prestige.ts`, Textaenderungen bei Bladeburners/Dark Army/Syndicate
in `FactionInfo.tsx`.

---

## 11. Luecken

Was ich **nicht** aus dem Code belegen konnte oder bewusst nicht untersucht habe:

1. **BigDsBigBrain**: `repCost: Infinity`, `moneyCost: Infinity`, `factions: []`. Der Vergabeweg
   ist nicht in `Augmentation/`, `Faction/` oder `PersonObjects/` zu finden. Vermutlich ein
   Achievement- oder Exploit-Mechanismus - nicht verifiziert.
2. **Unstable Circadian Modulator**: die Multiplikatoren werden zur Laufzeit erzeugt
   (`src/Augmentation/Augmentations.ts:1963` ruft `getUnstableCircadianModulatorParams()` aus
   `src/Augmentation/CircadianModulator.ts:9-25` auf; Neuwurf bei jedem Aug-Reset ueber
   `initCircadianModulator`, `src/Augmentation/Augmentations.ts:2092-2094`).
   Ich habe die Zufallsverteilung der Boni dort nicht ausgewertet.
3. **Bladeburner-Rep**: der Erwerbspfad (Contracts/Operations) liegt in `src/Bladeburner/` und ist
   nicht geprueft. `BladeburnerConstants.RankNeededForFaction = 25`
   (`src/Bladeburner/data/Constants.ts:42`).
4. **Gang-Reputation** (BN2/SF2): Gangs erzeugen Faction-Rep auf einem eigenen Pfad
   (`src/Gang/`), den ich nicht gelesen habe. Die Sonderregel, dass eine Gang-Faktion fast alle
   Augs anbietet, steht in `src/Faction/FactionHelpers.tsx:172-201` und haengt an
   `currentNodeMults.GangUniqueAugs` sowie einem deterministischen RNG-Seed
   `BN{n}.{SF-Level}`.
5. **Stanek's Gift / Church of the Machine God**: die Rep-Erzeugung durch "Charging" steht in
   `src/CotMG/`, nicht geprueft.
6. **Infiltration-Rep fuer Shadows of Anarchy**: in `src/Infiltration/`, nicht geprueft.
7. **Sleeves**: `src/PersonObjects/Sleeve/Sleeve.ts` benutzt dieselben Rep-Formeln
   (`Sleeve.ts:392` fuer Aug-Kauf), aber die Besonderheiten (Shock, Sync, eigene Aug-Liste) habe
   ich nicht ausgewertet.
8. **BitNode-Multiplikatoren ausser BN1**: ich habe nur die Defaultwerte aus
   `src/BitNode/BitNodeMultipliers.ts` genommen (alle relevanten = 1, `DaedalusAugsRequirement = 30`).
   Die BN-spezifischen Ueberschreibungen in `src/BitNode/BitNode.tsx` habe ich nicht durchgesehen.
9. **Der genaue Hacking-Level-Wurf der Backdoor-Server** wird pro Lauf aus dem Bereich
   (z. B. 51-60 fuer `CSEC`) gezogen; wo genau die Ziehung stattfindet, habe ich nicht verfolgt.
