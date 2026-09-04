# A4 — Alle 15 BitNodes aus dem Quellcode

**Aufgenommen am 2026-09-04, 01:36–01:52 lokale Systemzeit** (jede Zeitangabe per `date`, keine geschätzte).

**Quelle, ausschließlich:** `reference/v301/src/BitNode/BitNode.tsx` (1131 Zeilen, vollständig gelesen),
Defaults aus `reference/v301/src/BitNode/BitNodeMultipliers.ts` (54 numerische Felder, Zeilen 10–180),
Source-File-Wirkung aus `reference/v301/src/SourceFile/applySourceFile.ts` (182 Zeilen, vollständig gelesen).
Spielversion `Constants.ts:7` = `"3.0.1"`, `:10` `VersionNumber: 51`.

**Verfahren.** Die Multiplikatortabellen unten sind nicht abgetippt, sondern **maschinell aus dem Quelltext
geparst** (`case N: {` … bis zum nächsten `case`/`default`, Feld + Zeilennummer + Ausdruck). Die BN12-Ausdrücke
wurden im selben Kontext ausgewertet, den die Engine benutzt (`inc = Math.pow(1.02, lvl)`, `dec = 1/inc`,
`defaultMultipliers.DaedalusAugsRequirement = 30`). Geeicht wurde gegen die Prosa im Spiel selbst: die aus
`applySourceFile.ts` berechneten Prozentreihen (16 → 16/24/28, 24 → 24/36/42, 8 → 8/12/14, 12 → 12/18/21,
32 → 32/48/56) stimmen mit den `<li>`-Texten in `BitNode.tsx` in **allen 45 Werten** überein. Maschinenlesbare
Fassung: `nodes/BAU-2026-09/bitnodes.json` (92,8 kB).

---

## Die drei Verifikationsfragen — für alle Werte dieses Dokuments

**1. Welche Uhr?** *Keine.* Die BitNode-Multiplikatoren sind Konstanten, die **einmal** beim Knoteneintritt
nach `currentNodeMults` geschrieben werden (`BitNodeMultipliers.ts:188-192`, gerufen aus
`BitNode.tsx:1129-1131`). Weder Echtzeit noch Spielzeit noch Motorzeit geht ein. Konsequenz für den Bot:
ein per Dev-Menü geänderter SF-Stand (`sourceFileOverrides`, `BitNodeUtils.ts:44-67`) wirkt **erst beim
nächsten `initBitNodeMultipliers()`-Aufruf**, nicht sofort.

**2. Was bei Stillstand und Nachholen?** Kein Nachholeffekt, weil nichts akkumuliert. **Aber drei abgeleitete
Größen werden bei der Servererzeugung eingefroren und danach nie neu gerechnet:**
`server.moneyAvailable` und `server.moneyMax` (`Server/Server.ts:75-76`) sowie
`w0r1d_d43m0n.requiredHackingSkill` (`ServerHelpers.ts:383-385`, Basis 3000 aus `servers.ts:1536`).
Wer `currentNodeMults` später ändert, ändert diese drei nicht mehr.

**3. Rate oder Bestand?** Die Mehrheit sind Raten- bzw. Preisfaktoren. **Bestände und Schwellen**, die nicht
wie Raten behandelt werden dürfen: `ServerStartingMoney`, `ServerStartingSecurity` (einmalig bei
Servererzeugung), `ServerMaxMoney` (Deckel), `DaedalusAugsRequirement` (Schwellenanzahl),
`CloudServerLimit` und `CloudServerMaxRam` (Stück- bzw. RAM-Deckel), `WorldDaemonDifficulty` (einmaliger
Faktor auf eine Schwelle) und `StaneksGiftExtraSize` — letzteres ist **additiv mit Default 0**, nicht
multiplikativ mit Default 1. Ein Filter „alles, was von 1 abweicht" übersieht `StaneksGiftExtraSize: 0`
und meldet `DaedalusAugsRequirement: 30` fälschlich als Abweichung.

---

## Hervorgehobene Befunde — Zahlen aus dem Auftragstext, die der Quellcode nicht trägt

### B1 — `BitNode.tsx` kennt **kein Schwierigkeitsfeld**

Die Klasse `BitNode` (`:6-37`) hat genau sechs Felder: `tagline`, `description`, `sfDescription`, `info`,
`name`, `number`. Ein `difficulty` existiert nicht — weder dort noch sonst irgendwo unter `src/BitNode/`
(`grep -i difficulty` findet ausschließlich `WorldDaemonDifficulty` und `hackDifficulty`).
**Die im Auftrag geforderte „Schwierigkeit" je Knoten ist kein Quelltextwert.** Sie steht in dieser Fassung
als `null`, mit Hinweistext, in `bitnodes.json`. Wer sie braucht, muss sie aus Zahlen ableiten (Teil 4 unten
tut das, offen als Ableitung gekennzeichnet), nicht aus einer Datei abschreiben.

### B2 — Zwei der im Auftrag geforderten Feldnamen existieren in 3.0.1 nicht mehr

| Auftragstext | tatsächlicher Name in 3.0.1 | Beleg |
|---|---|---|
| `RepToDonateToFaction` | `FavorToDonateToFaction` | `BitNodeMultipliers.ts:143`; Umbenennung `utils/APIBreaks/3.0.0.ts:221-227` |
| `PurchasedServerSoftcap` | `CloudServerSoftcap` | `BitNodeMultipliers.ts:134`; Umbenennung `utils/APIBreaks/3.0.0.ts:468,493-494` |

Mitbetroffen und ebenfalls umbenannt: `PurchasedServerCost` → `CloudServerCost`,
`PurchasedServerLimit` → `CloudServerLimit`, `PurchasedServerMaxRam` → `CloudServerMaxRam`
(`APIBreaks/3.0.0.ts:461-498`). Die Namen im Auftrag sind **Vor-3.0.0-Namen**. Ein Gewerk, das
`ns.getBitNodeMultipliers().PurchasedServerSoftcap` liest, bekommt `undefined` — nicht 1, nicht einen
Fehler. Alle geforderten Felder sind unten unter ihren echten Namen erfasst.

### B3 — BN12 `DaedalusAugsRequirement` ist **31**, nicht „stufenabhängig bis 40"

Der Auftrag (4.3) sagt: „in BN12 stufenabhängig mit Deckel 40". Die Formel steht in `BitNode.tsx:929`:

```js
// BitNode.tsx:925-926 und :929
const inc = Math.pow(1.02, lvl);
DaedalusAugsRequirement = Math.floor(Math.min(30 + inc, 40));   // 30 = defaultMultipliers, BitNodeMultipliers.ts:61
```

Ausgeführt (Node, 2026-09-04 01:42):

| `lvl` | `inc` | `30 + inc` | Ergebnis |
|---|---|---|---|
| 1 | 1,02 | 31,02 | **31** |
| 2 | 1,0404 | 31,0404 | **31** |
| 3 | 1,061208 | 31,061208 | **31** |
| 10 | 1,21899442 | 31,21899442 | **31** |

Der Wert **32** wird erstmals bei `lvl = 36` erreicht, der **Deckel 40 erstmals bei `lvl = 117`**
(`inc = 10,144`; nötig ist `inc ≥ 10`, also `lvl ≥ ln(10)/ln(1,02) = 116,28`). Die Route sieht BN12 auf den
Levels 1, 2, 3 vor — **auf allen dreien lautet der Wert 31**. „Deckel 40" ist im Code vorhanden, aber für
diesen Bot unerreichbar; wer danach plant, plant gegen eine Zahl, die nie eintritt. Die „Stufenabhängigkeit"
ist real, aber sie kostet in 3 Läufen **genau eine** Augmentierung mehr als der Default.

`lvl`-Semantik: `initBitNodeMultipliers()` (`:1129-1131`) ruft mit `activeSourceFileLvl(n) + 1` auf; das in
`route.json` geführte „level" ist genau dieses `lvl` (`BitNodeUtils.ts:102-104`).

### B4 — BN12 halbiert den größten Mietrechner **schon auf Stufe 1** (aus 2 % Dämpfung werden 50 %)

`CloudServerMaxRam: dec` (`:951`) ist bei `lvl = 1` gleich 0,980392. Aber:

```js
// ServerPurchases.ts:100-105
const ram = Math.round(1048576 * 0.980392);   // = 1028016
return 1 << (31 - Math.clz32(ram));            // = 524288, nicht 1028016
```

Die Abrundung auf die nächstkleinere Zweierpotenz macht aus einer nominal 2-prozentigen Dämpfung eine
**Halbierung**: 524.288 GB statt 1.048.576 GB — und zwar auf **jeder** BN12-Stufe von 1 bis 35.
`CloudServerLimit: dec` (`:950`) verhält sich harmloser, weil dort nur `Math.round` steht
(`ServerPurchases.ts:96-98`): 25 bei `lvl 1`, 24 ab `lvl 2`, 21 bei `lvl 10`.

### B5 — Der dev-Build hat **andere Multiplikatoren** und ist an der Versionsnummer nicht zu erkennen

`reference/bitburner-src` trägt `VersionString: "3.0.2"`, aber **dieselbe** `VersionNumber: 51`
(`bitburner-src/src/Constants.ts:7,10` gegen `v301/src/Constants.ts:7,10`). Ein Fehlimport ist an der
Nummer also unsichtbar — die Warnung im Auftrag ist berechtigt. Gemessener Unterschied in den
Multiplikatorzuweisungen (Diff über alle `Feld: Wert`-Zeilen ab `getBitNodeMultipliers`), **genau zwei
Zeilen**:

| Nur im dev-Build 3.0.2 | dev-Zeile | in 3.0.1 |
|---|---|---|
| BN12 `DarknetLabyrinthRewardsTheRedPill: 0` | `:954` | fehlt |
| BN13 `CharismaLevelMultiplier: 0.7` | `:998` | fehlt |

`BitNodeMultipliers.ts` ist in beiden Bäumen byteweise identisch. **Wirkung, falls versehentlich der
dev-Baum als Beleg dient:** man plante für BN12 einen V1b-Ausgang über das Darknet-Labyrinth, den es in der
laufenden Version noch gibt — genau die Ausgangsentscheidung, an der `route.json` hängt.

### B6 — BN10 dämpft **weder** `ServerMaxMoney` **noch** `ServerStartingMoney`

BN10 (`case 10`, `:844-888`, 30 Abweichungen) setzt keines der beiden Felder. Der Ertragsdämpfer des
laufenden Knotens ist **allein** `ScriptHackMoney: 0.5` (`:864`). Das ist die höchste effektive
Geldausbeute aller gedämpften Knoten (Ertragsfaktor 0,5; siehe Teil 4) — relevant, weil der Live-Stand in
BN10 steht und jede „BN10 ist geldarm"-Annahme damit falsch wäre.

### B7 — Zwei wirkungslose Einträge im Quelltext

`BN4 StaneksGiftExtraSize: 0` (`:656`) und `BN5 StaneksGiftExtraSize: 0` (`:687`) sind identisch mit dem
Default 0 (`BitNodeMultipliers.ts:177`) und wirken nicht. Sie sind unten als **No-Op** markiert. Umgekehrt
gilt: alle 54 Felder werden von mindestens einem Knoten überschrieben, es gibt kein totes Feld.

### B8 — Die Daedalus-Aug-Zählung zählt **installierte**, nicht vorgemerkte Augs

`haveAugmentations(n)` (`Faction/FactionJoinCondition.ts:116-131`) endet für `n > 0` in einer einzigen
Zeile: `return p.augmentations.length >= n;` (`:130`). Der NeuroFlux-Filter in `:124-128` gilt
**ausschließlich für `n === 0`**. Daraus zwei Folgerungen, beide für den Bot bindend:

- **`queuedAugmentations` zählen nicht.** Wer 30 Augs gekauft, aber nicht eingebaut hat, bekommt keine
  Daedalus-Einladung. Der Auftrag führt `queued_augs_at_jump` als Kennzahl — die gehört auch hier hin.
- **NeuroFlux zählt genau 1**, unabhängig vom Level, weil es *ein* Arrayeintrag mit Levelfeld ist
  (`Prestige.ts:264-270` legt genau einen an). Die Angabe im Auftrag ist damit **bestätigt**, aber die dort
  zitierte Begründung (`:116-131` als NFG-Sonderregel) trifft nicht zu — es ist schlicht die Arraylänge.

---

## Teil 1 — Die 15 Knoten im Einzelnen

Jede Tabelle listet **alle** Felder, die vom Default abweichen, mit Zeilennummer in `BitNode.tsx`.
Die Default-Spalte macht sichtbar, wo der Default nicht 1 ist (`DaedalusAugsRequirement` 30,
`StaneksGiftExtraSize` 0).

### BN1 - Source Genesis

*"The original BitNode"* | Definition `BitNode.tsx:41` | Multiplikatoren `case 1` ab `:572` | **0** Abweichungen vom Default

Keine einzige Abweichung. `case 1` gibt `new BitNodeMultipliers()` zurueck (`:573`) - alle 54 Felder stehen auf ihrem Default.

### BN2 - Rise of the Underworld

*"From the shadows, they rose"* | Definition `BitNode.tsx:70` | Multiplikatoren `case 2` ab `:575` | **14** Abweichungen vom Default

| Feld | Wert | Zeile | Default | Anmerkung |
|---|---|---|---|---|
| `CloudServerSoftcap` | 1.3 | `:583` | 1 |  |
| `CorporationDivisions` | 0.9 | `:591` | 1 |  |
| `CorporationSoftcap` | 0.9 | `:590` | 1 |  |
| `CrimeMoney` | 3 | `:585` | 1 |  |
| `FactionPassiveRepGain` | 0 | `:587` | 1 |  |
| `FactionWorkRepGain` | 0.5 | `:588` | 1 |  |
| `HackingLevelMultiplier` | 0.8 | `:577` | 1 |  |
| `InfiltrationMoney` | 3 | `:593` | 1 |  |
| `ServerGrowthRate` | 0.8 | `:579` | 1 |  |
| `ServerMaxMoney` | 0.08 | `:580` | 1 |  |
| `ServerStartingMoney` | 0.4 | `:581` | 1 |  |
| `StaneksGiftExtraSize` | -6 | `:595` | 0 |  |
| `StaneksGiftPowerMultiplier` | 2 | `:594` | 1 |  |
| `WorldDaemonDifficulty` | 5 | `:596` | 1 |  |

**Source-File 2** (`applySourceFile.ts:50-61`) - Basis 24%, `sum_{i=0}^{lvl-1} basis / 2^i` -> **Stufe 1: +24%, Stufe 2: +36%, Stufe 3: +42%** auf: crime_money, crime_success, charisma

| Stufe | Wirkung |
|---|---|
| 1 | Gangs in anderen Knoten ab Karma-Schwelle (PlayerObjectGangMethods.ts:19) |
| 2 | keine Zusatzwirkung |
| 3 | keine Zusatzwirkung |

### BN3 - Corporatocracy

*"The Price of Civilization"* | Definition `BitNode.tsx:104` | Multiplikatoren `case 3` ab `:599` | **20** Abweichungen vom Default

| Feld | Wert | Zeile | Default | Anmerkung |
|---|---|---|---|---|
| `AugmentationMoneyCost` | 3 | `:619` | 1 |  |
| `AugmentationRepCost` | 3 | `:620` | 1 |  |
| `CloudServerCost` | 2 | `:609` | 1 |  |
| `CloudServerSoftcap` | 1.3 | `:610` | 1 |  |
| `CompanyWorkMoney` | 0.25 | `:612` | 1 |  |
| `CrimeMoney` | 0.25 | `:613` | 1 |  |
| `DarknetMoneyMultiplier` | 0.4 | `:628` | 1 |  |
| `FavorToDonateToFaction` | 0.5 | `:617` | 1 |  |
| `GangSoftcap` | 0.9 | `:622` | 1 |  |
| `GangUniqueAugs` | 0.5 | `:623` | 1 |  |
| `HackingLevelMultiplier` | 0.8 | `:601` | 1 |  |
| `HacknetNodeMoney` | 0.25 | `:614` | 1 |  |
| `HomeComputerRamCost` | 1.5 | `:607` | 1 |  |
| `ScriptHackMoney` | 0.2 | `:615` | 1 |  |
| `ServerGrowthRate` | 0.2 | `:603` | 1 |  |
| `ServerMaxMoney` | 0.04 | `:604` | 1 |  |
| `ServerStartingMoney` | 0.2 | `:605` | 1 |  |
| `StaneksGiftExtraSize` | -2 | `:626` | 0 |  |
| `StaneksGiftPowerMultiplier` | 0.75 | `:625` | 1 |  |
| `WorldDaemonDifficulty` | 2 | `:630` | 1 |  |

**Source-File 3** (`applySourceFile.ts:62-72`) - Basis 8%, `sum_{i=0}^{lvl-1} basis / 2^i` -> **Stufe 1: +8%, Stufe 2: +12%, Stufe 3: +14%** auf: charisma, work_money

| Stufe | Wirkung |
|---|---|
| 1 | Corporation in anderen Knoten (PlayerObjectCorporationMethods.ts:21) |
| 2 | keine Zusatzwirkung |
| 3 | volle Corporation-API dauerhaft (PlayerObjectCorporationMethods.ts:21) |

### BN4 - The Singularity

*"The Man and the Machine"* | Definition `BitNode.tsx:139` | Multiplikatoren `case 4` ab `:633` | **18** Abweichungen vom Default

| Feld | Wert | Zeile | Default | Anmerkung |
|---|---|---|---|---|
| `ClassGymExpGain` | 0.5 | `:645` | 1 |  |
| `CloudServerSoftcap` | 1.2 | `:638` | 1 |  |
| `CompanyWorkExpGain` | 0.5 | `:646` | 1 |  |
| `CompanyWorkMoney` | 0.1 | `:640` | 1 |  |
| `CrimeExpGain` | 0.5 | `:647` | 1 |  |
| `CrimeMoney` | 0.2 | `:641` | 1 |  |
| `DarknetMoneyMultiplier` | 0.4 | `:658` | 1 |  |
| `FactionWorkExpGain` | 0.5 | `:648` | 1 |  |
| `FactionWorkRepGain` | 0.75 | `:651` | 1 |  |
| `GangUniqueAugs` | 0.5 | `:653` | 1 |  |
| `HackExpGain` | 0.4 | `:649` | 1 |  |
| `HacknetNodeMoney` | 0.05 | `:642` | 1 |  |
| `ScriptHackMoney` | 0.2 | `:643` | 1 |  |
| `ServerMaxMoney` | 0.1125 | `:635` | 1 |  |
| `ServerStartingMoney` | 0.75 | `:636` | 1 |  |
| `StaneksGiftExtraSize` | 0 | `:656` | 0 | No-Op: Wert entspricht dem Default, keine Wirkung |
| `StaneksGiftPowerMultiplier` | 1.5 | `:655` | 1 |  |
| `WorldDaemonDifficulty` | 3 | `:660` | 1 |  |

**Source-File 4** (`applySourceFile.ts:73-77`) - keine Multiplikatorwirkung im Code

| Stufe | Wirkung |
|---|---|
| 1 | Singularity-Funktionen ausserhalb BN4, RAM-Kosten x16 |
| 2 | RAM-Kosten x4 |
| 3 | RAM-Kosten x1 |

### BN5 - Artificial Intelligence

*"Posthuman"* | Definition `BitNode.tsx:170` | Multiplikatoren `case 5` ab `:663` | **17** Abweichungen vom Default

| Feld | Wert | Zeile | Default | Anmerkung |
|---|---|---|---|---|
| `AugmentationMoneyCost` | 2 | `:676` | 1 |  |
| `CloudServerSoftcap` | 1.2 | `:668` | 1 |  |
| `CorporationDivisions` | 0.75 | `:682` | 1 |  |
| `CorporationValuation` | 0.75 | `:681` | 1 |  |
| `CrimeMoney` | 0.5 | `:670` | 1 |  |
| `DarknetMoneyMultiplier` | 0.7 | `:689` | 1 |  |
| `GangUniqueAugs` | 0.5 | `:684` | 1 |  |
| `HackExpGain` | 0.5 | `:674` | 1 |  |
| `HacknetNodeMoney` | 0.2 | `:671` | 1 |  |
| `InfiltrationMoney` | 1.5 | `:678` | 1 |  |
| `InfiltrationRep` | 1.5 | `:679` | 1 |  |
| `ScriptHackMoney` | 0.15 | `:672` | 1 |  |
| `ServerStartingMoney` | 0.5 | `:666` | 1 |  |
| `ServerStartingSecurity` | 2 | `:665` | 1 |  |
| `StaneksGiftExtraSize` | 0 | `:687` | 0 | No-Op: Wert entspricht dem Default, keine Wirkung |
| `StaneksGiftPowerMultiplier` | 1.3 | `:686` | 1 |  |
| `WorldDaemonDifficulty` | 1.5 | `:691` | 1 |  |

**Source-File 5** (`applySourceFile.ts:78-92`) - Basis 8%, `sum_{i=0}^{lvl-1} basis / 2^i` -> **Stufe 1: +8%, Stufe 2: +12%, Stufe 3: +14%** auf: hacking_chance, hacking_speed, hacking_money, hacking_grow, hacking, hacking_exp

| Stufe | Wirkung |
|---|---|
| 1 | Intelligence-Stat (permanent), getBitNodeMultipliers(), Formulas.exe dauerhaft (Prestige.ts:277-279), BN-Mult-Anzeige auf der Stats-Seite; +300 Int-Exp je Knotenwechsel (Prestige.ts:362-365) |
| 2 | keine Zusatzwirkung |
| 3 | keine Zusatzwirkung |

### BN6 - Bladeburners

*"Like Tears in Rain"* | Definition `BitNode.tsx:211` | Multiplikatoren `case 6` ab `:694` | **20** Abweichungen vom Default

Namensbeleg: Quelltext schreibt FactionName.Bladeburners (Faction/Enums.ts:33 = Bladeburners)

| Feld | Wert | Zeile | Default | Anmerkung |
|---|---|---|---|---|
| `CloudServerSoftcap` | 2 | `:702` | 1 |  |
| `CompanyWorkMoney` | 0.5 | `:704` | 1 |  |
| `CorporationDivisions` | 0.8 | `:715` | 1 |  |
| `CorporationSoftcap` | 0.9 | `:714` | 1 |  |
| `CorporationValuation` | 0.2 | `:713` | 1 |  |
| `CrimeMoney` | 0.75 | `:705` | 1 |  |
| `DaedalusAugsRequirement` | 35 | `:720` | 30 |  |
| `GangSoftcap` | 0.7 | `:717` | 1 |  |
| `GangUniqueAugs` | 0.2 | `:718` | 1 |  |
| `HackExpGain` | 0.25 | `:709` | 1 |  |
| `HackingLevelMultiplier` | 0.35 | `:696` | 1 |  |
| `HacknetNodeMoney` | 0.2 | `:706` | 1 |  |
| `InfiltrationMoney` | 0.75 | `:711` | 1 |  |
| `ScriptHackMoney` | 0.75 | `:707` | 1 |  |
| `ServerMaxMoney` | 0.2 | `:698` | 1 |  |
| `ServerStartingMoney` | 0.5 | `:699` | 1 |  |
| `ServerStartingSecurity` | 1.5 | `:700` | 1 |  |
| `StaneksGiftExtraSize` | 2 | `:723` | 0 |  |
| `StaneksGiftPowerMultiplier` | 0.5 | `:722` | 1 |  |
| `WorldDaemonDifficulty` | 2 | `:725` | 1 |  |

**Source-File 6** (`applySourceFile.ts:93-109`) - Basis 8%, `sum_{i=0}^{lvl-1} basis / 2^i` -> **Stufe 1: +8%, Stufe 2: +12%, Stufe 3: +14%** auf: strength, defense, dexterity, agility und deren vier *_exp

| Stufe | Wirkung |
|---|---|
| 1 | Zugang zur Bladeburner-Division in anderen Knoten (PlayerObjectBladeburnerMethods.ts:6-8) |
| 2 | keine Zusatzwirkung |
| 3 | keine Zusatzwirkung |

### BN7 - Bladeburners 2079

*"More human than humans"* | Definition `BitNode.tsx:244` | Multiplikatoren `case 7` ab `:728` | **25** Abweichungen vom Default

Namensbeleg: Quelltext schreibt ${FactionName.Bladeburners} 2079

| Feld | Wert | Zeile | Default | Anmerkung |
|---|---|---|---|---|
| `AugmentationMoneyCost` | 3 | `:745` | 1 |  |
| `BladeburnerRank` | 0.6 | `:756` | 1 |  |
| `BladeburnerSkillCost` | 2 | `:757` | 1 |  |
| `CloudServerSoftcap` | 2 | `:736` | 1 |  |
| `CompanyWorkMoney` | 0.5 | `:738` | 1 |  |
| `CorporationDivisions` | 0.8 | `:754` | 1 |  |
| `CorporationSoftcap` | 0.9 | `:753` | 1 |  |
| `CorporationValuation` | 0.2 | `:752` | 1 |  |
| `CrimeMoney` | 0.75 | `:739` | 1 |  |
| `DaedalusAugsRequirement` | 35 | `:762` | 30 |  |
| `FourSigmaMarketDataApiCost` | 2 | `:750` | 1 |  |
| `FourSigmaMarketDataCost` | 2 | `:749` | 1 |  |
| `GangSoftcap` | 0.7 | `:759` | 1 |  |
| `GangUniqueAugs` | 0.2 | `:760` | 1 |  |
| `HackExpGain` | 0.25 | `:743` | 1 |  |
| `HackingLevelMultiplier` | 0.35 | `:730` | 1 |  |
| `HacknetNodeMoney` | 0.2 | `:740` | 1 |  |
| `InfiltrationMoney` | 0.75 | `:747` | 1 |  |
| `ScriptHackMoney` | 0.5 | `:741` | 1 |  |
| `ServerMaxMoney` | 0.2 | `:732` | 1 |  |
| `ServerStartingMoney` | 0.5 | `:733` | 1 |  |
| `ServerStartingSecurity` | 1.5 | `:734` | 1 |  |
| `StaneksGiftExtraSize` | -1 | `:765` | 0 |  |
| `StaneksGiftPowerMultiplier` | 0.9 | `:764` | 1 |  |
| `WorldDaemonDifficulty` | 2 | `:767` | 1 |  |

**Source-File 7** (`applySourceFile.ts:110-122`) - Basis 8%, `sum_{i=0}^{lvl-1} basis / 2^i` -> **Stufe 1: +8%, Stufe 2: +12%, Stufe 3: +14%** auf: bladeburner_max_stamina, bladeburner_stamina_gain, bladeburner_analysis, bladeburner_success_chance

| Stufe | Wirkung |
|---|---|
| 1 | Zugang zur Bladeburner-Division in anderen Knoten (PlayerObjectBladeburnerMethods.ts:6-8) |
| 2 | keine Zusatzwirkung |
| 3 | Blade's Simulacrum landet SOFORT beim Divisionsbeitritt in Player.augmentations (PlayerObjectBladeburnerMethods.ts:14-19) |

### BN8 - Ghost of Wall Street

*"Money never sleeps"* | Definition `BitNode.tsx:280` | Multiplikatoren `case 8` ab `:770` | **19** Abweichungen vom Default

| Feld | Wert | Zeile | Default | Anmerkung |
|---|---|---|---|---|
| `BladeburnerRank` | 0 | `:790` | 1 |  |
| `CloudServerSoftcap` | 4 | `:772` | 1 |  |
| `CodingContractMoney` | 0 | `:780` | 1 |  |
| `CompanyWorkMoney` | 0 | `:774` | 1 |  |
| `CorporationDivisions` | 0 | `:788` | 1 |  |
| `CorporationSoftcap` | 0 | `:787` | 1 |  |
| `CorporationValuation` | 0 | `:786` | 1 |  |
| `CrimeMoney` | 0 | `:775` | 1 |  |
| `DarknetLabyrinthRewardsTheRedPill` | 0 | `:792` | 1 |  |
| `DarknetMoneyMultiplier` | 0 | `:793` | 1 |  |
| `FavorToDonateToFaction` | 0 | `:782` | 1 |  |
| `GangSoftcap` | 0 | `:795` | 1 |  |
| `GangUniqueAugs` | 0 | `:796` | 1 |  |
| `HacknetNodeMoney` | 0 | `:776` | 1 |  |
| `InfiltrationMoney` | 0 | `:784` | 1 |  |
| `ManualHackMoney` | 0 | `:777` | 1 |  |
| `ScriptHackMoney` | 0.3 | `:778` | 1 |  |
| `ScriptHackMoneyGain` | 0 | `:779` | 1 |  |
| `StaneksGiftExtraSize` | -99 | `:798` | 0 |  |

**Source-File 8** (`applySourceFile.ts:123-132`) - Basis 12%, `sum_{i=0}^{lvl-1} basis / 2^i` -> **Stufe 1: +12%, Stufe 2: +18%, Stufe 3: +21%** auf: hacking_grow

| Stufe | Wirkung |
|---|---|
| 1 | WSE + TIX-API dauerhaft (Prestige.ts:164-167) |
| 2 | Leerverkaeufe in anderen Knoten |
| 3 | Limit-/Stop-Order in anderen Knoten |

### BN9 - Hacktocracy

*"Hacknet Unleashed"* | Definition `BitNode.tsx:316` | Multiplikatoren `case 9` ab `:801` | **27** Abweichungen vom Default

| Feld | Wert | Zeile | Default | Anmerkung |
|---|---|---|---|---|
| `AgilityLevelMultiplier` | 0.45 | `:807` | 1 |  |
| `BladeburnerRank` | 0.9 | `:830` | 1 |  |
| `BladeburnerSkillCost` | 1.2 | `:831` | 1 |  |
| `CharismaLevelMultiplier` | 0.45 | `:808` | 1 |  |
| `CloudServerLimit` | 0 | `:816` | 1 |  |
| `CorporationDivisions` | 0.8 | `:828` | 1 |  |
| `CorporationSoftcap` | 0.75 | `:827` | 1 |  |
| `CorporationValuation` | 0.5 | `:826` | 1 |  |
| `CrimeMoney` | 0.5 | `:818` | 1 |  |
| `DarknetMoneyMultiplier` | 0.05 | `:839` | 1 |  |
| `DefenseLevelMultiplier` | 0.45 | `:805` | 1 |  |
| `DexterityLevelMultiplier` | 0.45 | `:806` | 1 |  |
| `FourSigmaMarketDataApiCost` | 4 | `:824` | 1 |  |
| `FourSigmaMarketDataCost` | 5 | `:823` | 1 |  |
| `GangSoftcap` | 0.8 | `:833` | 1 |  |
| `GangUniqueAugs` | 0.25 | `:834` | 1 |  |
| `HackExpGain` | 0.05 | `:821` | 1 |  |
| `HackingLevelMultiplier` | 0.5 | `:803` | 1 |  |
| `HomeComputerRamCost` | 5 | `:814` | 1 |  |
| `ScriptHackMoney` | 0.1 | `:819` | 1 |  |
| `ServerMaxMoney` | 0.01 | `:810` | 1 |  |
| `ServerStartingMoney` | 0.1 | `:811` | 1 |  |
| `ServerStartingSecurity` | 2.5 | `:812` | 1 |  |
| `StaneksGiftExtraSize` | 2 | `:837` | 0 |  |
| `StaneksGiftPowerMultiplier` | 0.5 | `:836` | 1 |  |
| `StrengthLevelMultiplier` | 0.45 | `:804` | 1 |  |
| `WorldDaemonDifficulty` | 2 | `:841` | 1 |  |

**Source-File 9** (`applySourceFile.ts:133-147`) - Basis 12%, `sum_{i=0}^{lvl-1} basis / 2^i` -> **Stufe 1: +12%, Stufe 2: +18%, Stufe 3: +21%** auf: hacknet_node_money x(1+m); hacknet_node_{core,level,purchase,ram}_cost x (1-m) -- ACHTUNG: (1-m), nicht 1/(1+m) wie bei SF1

| Stufe | Wirkung |
|---|---|
| 1 | Hacknet-Server dauerhaft freigeschaltet |
| 2 | 128 GB home-RAM beim Knoteneintritt (Prestige.ts:246-247) |
| 3 | hochgeruesteter Gratis-Hacknet-Server beim Knoteneintritt (Prestige.ts:335-348); ausdruecklich NICHT beim Aug-Einbau (BitNode.tsx:344-345) |

### BN10 - Digital Carbon

*"Your body is not who you are"* | Definition `BitNode.tsx:357` | Multiplikatoren `case 10` ab `:844` | **30** Abweichungen vom Default

| Feld | Wert | Zeile | Default | Anmerkung |
|---|---|---|---|---|
| `AgilityLevelMultiplier` | 0.4 | `:850` | 1 |  |
| `AugmentationMoneyCost` | 5 | `:867` | 1 |  |
| `AugmentationRepCost` | 2 | `:868` | 1 |  |
| `BladeburnerRank` | 0.8 | `:876` | 1 |  |
| `CharismaLevelMultiplier` | 0.4 | `:851` | 1 |  |
| `CloudServerCost` | 5 | `:855` | 1 |  |
| `CloudServerLimit` | 0.6 | `:857` | 1 |  |
| `CloudServerMaxRam` | 0.5 | `:858` | 1 |  |
| `CloudServerSoftcap` | 1.1 | `:856` | 1 |  |
| `CodingContractMoney` | 0.5 | `:865` | 1 |  |
| `CompanyWorkMoney` | 0.5 | `:860` | 1 |  |
| `CorporationDivisions` | 0.9 | `:874` | 1 |  |
| `CorporationSoftcap` | 0.9 | `:873` | 1 |  |
| `CorporationValuation` | 0.5 | `:872` | 1 |  |
| `CrimeMoney` | 0.5 | `:861` | 1 |  |
| `DarknetMoneyMultiplier` | 0.4 | `:884` | 1 |  |
| `DefenseLevelMultiplier` | 0.4 | `:848` | 1 |  |
| `DexterityLevelMultiplier` | 0.4 | `:849` | 1 |  |
| `GangSoftcap` | 0.9 | `:878` | 1 |  |
| `GangUniqueAugs` | 0.25 | `:879` | 1 |  |
| `HackingLevelMultiplier` | 0.35 | `:846` | 1 |  |
| `HacknetNodeMoney` | 0.5 | `:862` | 1 |  |
| `HomeComputerRamCost` | 1.5 | `:853` | 1 |  |
| `InfiltrationMoney` | 0.5 | `:870` | 1 |  |
| `ManualHackMoney` | 0.5 | `:863` | 1 |  |
| `ScriptHackMoney` | 0.5 | `:864` | 1 |  |
| `StaneksGiftExtraSize` | -3 | `:882` | 0 |  |
| `StaneksGiftPowerMultiplier` | 0.75 | `:881` | 1 |  |
| `StrengthLevelMultiplier` | 0.4 | `:847` | 1 |  |
| `WorldDaemonDifficulty` | 2 | `:886` | 1 |  |

**Source-File 10** (`applySourceFile.ts:148-152`) - keine Multiplikatorwirkung im Code

| Stufe | Wirkung |
|---|---|
| 1 | 1 Sleeve, Sleeve- und Grafting-API |
| 2 | ein weiterer Sleeve |
| 3 | ein weiterer Sleeve |

### BN11 - The Big Crash

*"Okay. Sell it all."* | Definition `BitNode.tsx:391` | Multiplikatoren `case 11` ab `:889` | **21** Abweichungen vom Default

| Feld | Wert | Zeile | Default | Anmerkung |
|---|---|---|---|---|
| `AugmentationMoneyCost` | 2 | `:907` | 1 |  |
| `CloudServerSoftcap` | 2 | `:898` | 1 |  |
| `CodingContractMoney` | 0.25 | `:903` | 1 |  |
| `CompanyWorkMoney` | 0.5 | `:900` | 1 |  |
| `CorporationDivisions` | 0.9 | `:917` | 1 |  |
| `CorporationSoftcap` | 0.9 | `:916` | 1 |  |
| `CorporationValuation` | 0.1 | `:915` | 1 |  |
| `CrimeMoney` | 3 | `:901` | 1 |  |
| `FourSigmaMarketDataApiCost` | 4 | `:913` | 1 |  |
| `FourSigmaMarketDataCost` | 4 | `:912` | 1 |  |
| `GangUniqueAugs` | 0.75 | `:919` | 1 |  |
| `HackExpGain` | 0.5 | `:905` | 1 |  |
| `HackingLevelMultiplier` | 0.6 | `:891` | 1 |  |
| `HacknetNodeMoney` | 0.1 | `:902` | 1 |  |
| `InfiltrationMoney` | 2.5 | `:909` | 1 |  |
| `InfiltrationRep` | 2.5 | `:910` | 1 |  |
| `ServerGrowthRate` | 0.2 | `:893` | 1 |  |
| `ServerMaxMoney` | 0.01 | `:894` | 1 |  |
| `ServerStartingMoney` | 0.1 | `:895` | 1 |  |
| `ServerWeakenRate` | 2 | `:896` | 1 |  |
| `WorldDaemonDifficulty` | 1.5 | `:921` | 1 |  |

**Source-File 11** (`applySourceFile.ts:153-163`) - Basis 32%, `sum_{i=0}^{lvl-1} basis / 2^i` -> **Stufe 1: +32%, Stufe 2: +48%, Stufe 3: +56%** auf: work_money, company_rep

| Stufe | Wirkung |
|---|---|
| 1 | Firmen-Favor hebt Gehalt UND Rep-Rate um 1% je Favor; zusaetzlich -4% Preisanstieg je gekaufter Aug |
| 2 | -6% Preisanstieg |
| 3 | -7% Preisanstieg |

### BN12 - The Recursion

*"Repeat."* | Definition `BitNode.tsx:432` | Multiplikatoren `case 12` ab `:924` | **48** Abweichungen vom Default

| Feld | Formel (`:Zeile`) | Default | lvl 1 | lvl 2 | lvl 3 | lvl 10 |
|---|---|---|---|---|---|---|
| `AgilityLevelMultiplier` | `dec` (`:935`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `AugmentationMoneyCost` | `inc` (`:971`) | 1 | 1.02 | 1.0404 | 1.061208 | 1.218994 |
| `AugmentationRepCost` | `inc` (`:972`) | 1 | 1.02 | 1.0404 | 1.061208 | 1.218994 |
| `BladeburnerRank` | `dec` (`:984`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `BladeburnerSkillCost` | `inc` (`:985`) | 1 | 1.02 | 1.0404 | 1.061208 | 1.218994 |
| `CharismaLevelMultiplier` | `dec` (`:936`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `ClassGymExpGain` | `dec` (`:961`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `CloudServerCost` | `inc` (`:948`) | 1 | 1.02 | 1.0404 | 1.061208 | 1.218994 |
| `CloudServerLimit` | `dec` (`:950`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `CloudServerMaxRam` | `dec` (`:951`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `CloudServerSoftcap` | `inc` (`:949`) | 1 | 1.02 | 1.0404 | 1.061208 | 1.218994 |
| `CodingContractMoney` | `dec` (`:958`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `CompanyWorkExpGain` | `dec` (`:962`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `CompanyWorkMoney` | `dec` (`:953`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `CorporationDivisions` | `0.5` (`:982`) | 1 | 0.5 | 0.5 | 0.5 | 0.5 |
| `CorporationSoftcap` | `0.8` (`:981`) | 1 | 0.8 | 0.8 | 0.8 | 0.8 |
| `CorporationValuation` | `dec` (`:980`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `CrimeExpGain` | `dec` (`:963`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `CrimeMoney` | `dec` (`:954`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `DaedalusAugsRequirement` | `Math.floor(Math.min(defaultMultipliers.DaedalusAugsRequirement + inc, 40))` (`:929`) | 30 | 31 | 31 | 31 | 31 |
| `DarknetMoneyMultiplier` | `dec` (`:959`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `DefenseLevelMultiplier` | `dec` (`:933`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `DexterityLevelMultiplier` | `dec` (`:934`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `FactionPassiveRepGain` | `dec` (`:967`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `FactionWorkExpGain` | `dec` (`:964`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `FactionWorkRepGain` | `dec` (`:968`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `FavorToDonateToFaction` | `inc` (`:969`) | 1 | 1.02 | 1.0404 | 1.061208 | 1.218994 |
| `FourSigmaMarketDataApiCost` | `inc` (`:978`) | 1 | 1.02 | 1.0404 | 1.061208 | 1.218994 |
| `FourSigmaMarketDataCost` | `inc` (`:977`) | 1 | 1.02 | 1.0404 | 1.061208 | 1.218994 |
| `GangSoftcap` | `0.8` (`:987`) | 1 | 0.8 | 0.8 | 0.8 | 0.8 |
| `GangUniqueAugs` | `dec` (`:988`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `HackExpGain` | `dec` (`:965`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `HackingLevelMultiplier` | `dec` (`:931`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `HacknetNodeMoney` | `dec` (`:955`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `HomeComputerRamCost` | `inc` (`:946`) | 1 | 1.02 | 1.0404 | 1.061208 | 1.218994 |
| `InfiltrationMoney` | `dec` (`:974`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `InfiltrationRep` | `dec` (`:975`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `ManualHackMoney` | `dec` (`:956`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `ScriptHackMoney` | `dec` (`:957`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `ServerGrowthRate` | `dec` (`:938`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `ServerMaxMoney` | `dec * dec` (`:939`) | 1 | 0.961169 | 0.923845 | 0.887971 | 0.672971 |
| `ServerStartingMoney` | `dec` (`:940`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `ServerStartingSecurity` | `1.5` (`:944`) | 1 | 1.5 | 1.5 | 1.5 | 1.5 |
| `ServerWeakenRate` | `dec` (`:941`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `StaneksGiftExtraSize` | `inc` (`:991`) | 0 | 1.02 | 1.0404 | 1.061208 | 1.218994 |
| `StaneksGiftPowerMultiplier` | `inc` (`:990`) | 1 | 1.02 | 1.0404 | 1.061208 | 1.218994 |
| `StrengthLevelMultiplier` | `dec` (`:932`) | 1 | 0.980392 | 0.961169 | 0.942322 | 0.820348 |
| `WorldDaemonDifficulty` | `inc` (`:993`) | 1 | 1.02 | 1.0404 | 1.061208 | 1.218994 |

**Source-File 12** (`applySourceFile.ts:164-166`) - keine Multiplikatorwirkung im Code

| Stufe | Wirkung |
|---|---|
| 1 | Start jedes Knotens mit NeuroFlux-Governor-Level = SF12-Level (Prestige.ts:264-270). Kein Maximallevel fuer SF12. |
| 2 | dito |
| 3 | dito |

### BN13 - They are lunatics (Quelltext: They're lunatics)

*"1 step back, 2 steps forward"* | Definition `BitNode.tsx:448` | Multiplikatoren `case 13` ab `:996` | **33** Abweichungen vom Default

| Feld | Wert | Zeile | Default | Anmerkung |
|---|---|---|---|---|
| `AgilityLevelMultiplier` | 0.7 | `:1002` | 1 |  |
| `BladeburnerRank` | 0.45 | `:1031` | 1 |  |
| `BladeburnerSkillCost` | 2 | `:1032` | 1 |  |
| `ClassGymExpGain` | 0.5 | `:1016` | 1 |  |
| `CloudServerSoftcap` | 1.6 | `:1004` | 1 |  |
| `CodingContractMoney` | 0.4 | `:1014` | 1 |  |
| `CompanyWorkExpGain` | 0.5 | `:1017` | 1 |  |
| `CompanyWorkMoney` | 0.4 | `:1010` | 1 |  |
| `CorporationDivisions` | 0.4 | `:1029` | 1 |  |
| `CorporationSoftcap` | 0.4 | `:1028` | 1 |  |
| `CorporationValuation` | 0.001 | `:1027` | 1 |  |
| `CrimeExpGain` | 0.5 | `:1018` | 1 |  |
| `CrimeMoney` | 0.4 | `:1011` | 1 |  |
| `DarknetMoneyMultiplier` | 0.1 | `:1039` | 1 |  |
| `DefenseLevelMultiplier` | 0.7 | `:1000` | 1 |  |
| `DexterityLevelMultiplier` | 0.7 | `:1001` | 1 |  |
| `FactionWorkExpGain` | 0.5 | `:1019` | 1 |  |
| `FactionWorkRepGain` | 0.6 | `:1022` | 1 |  |
| `FourSigmaMarketDataApiCost` | 10 | `:1025` | 1 |  |
| `FourSigmaMarketDataCost` | 10 | `:1024` | 1 |  |
| `GangSoftcap` | 0.3 | `:1034` | 1 |  |
| `GangUniqueAugs` | 0.1 | `:1035` | 1 |  |
| `HackExpGain` | 0.1 | `:1020` | 1 |  |
| `HackingLevelMultiplier` | 0.25 | `:998` | 1 |  |
| `HacknetNodeMoney` | 0.4 | `:1012` | 1 |  |
| `ScriptHackMoney` | 0.2 | `:1013` | 1 |  |
| `ServerMaxMoney` | 0.3375 | `:1006` | 1 |  |
| `ServerStartingMoney` | 0.75 | `:1007` | 1 |  |
| `ServerStartingSecurity` | 3 | `:1008` | 1 |  |
| `StaneksGiftExtraSize` | 1 | `:1038` | 0 |  |
| `StaneksGiftPowerMultiplier` | 2 | `:1037` | 1 |  |
| `StrengthLevelMultiplier` | 0.7 | `:999` | 1 |  |
| `WorldDaemonDifficulty` | 3 | `:1041` | 1 |  |

**Source-File 13** (`applySourceFile.ts:167-169`) - keine Multiplikatorwirkung im Code

| Stufe | Wirkung |
|---|---|
| 1 | Church of the Machine God erscheint in anderen Knoten (canAccessCotMG -> canAccessBitNodeFeature(13), PlayerObjectGeneralMethods.ts:603-605) |
| 2 | groessere Gabe |
| 3 | groessere Gabe |

### BN14 - IPvGO Subnet Takeover

*"Territory exists only in the 'net"* | Definition `BitNode.tsx:479` | Multiplikatoren `case 14` ab `:1044` | **28** Abweichungen vom Default

| Feld | Wert | Zeile | Default | Anmerkung |
|---|---|---|---|---|
| `AgilityLevelMultiplier` | 0.5 | `:1062` | 1 |  |
| `AugmentationMoneyCost` | 1.5 | `:1065` | 1 |  |
| `BladeburnerRank` | 0.6 | `:1076` | 1 |  |
| `BladeburnerSkillCost` | 2 | `:1077` | 1 |  |
| `CompanyWorkRepGain` | 0.2 | `:1070` | 1 |  |
| `CorporationDivisions` | 0.8 | `:1074` | 1 |  |
| `CorporationSoftcap` | 0.9 | `:1073` | 1 |  |
| `CorporationValuation` | 0.4 | `:1072` | 1 |  |
| `CrimeMoney` | 0.75 | `:1055` | 1 |  |
| `CrimeSuccessRate` | 0.4 | `:1056` | 1 |  |
| `DefenseLevelMultiplier` | 0.5 | `:1063` | 1 |  |
| `DexterityLevelMultiplier` | 0.5 | `:1061` | 1 |  |
| `FactionWorkRepGain` | 0.2 | `:1069` | 1 |  |
| `GangSoftcap` | 0.7 | `:1079` | 1 |  |
| `GangUniqueAugs` | 0.4 | `:1080` | 1 |  |
| `GoPower` | 4 | `:1046` | 1 |  |
| `HackingLevelMultiplier` | 0.4 | `:1048` | 1 |  |
| `HackingSpeedMultiplier` | 0.3 | `:1049` | 1 |  |
| `HacknetNodeMoney` | 0.25 | `:1057` | 1 |  |
| `InfiltrationMoney` | 0.75 | `:1067` | 1 |  |
| `ScriptHackMoney` | 0.3 | `:1058` | 1 |  |
| `ServerMaxMoney` | 0.7 | `:1051` | 1 |  |
| `ServerStartingMoney` | 0.5 | `:1052` | 1 |  |
| `ServerStartingSecurity` | 1.5 | `:1053` | 1 |  |
| `StaneksGiftExtraSize` | -1 | `:1083` | 0 |  |
| `StaneksGiftPowerMultiplier` | 0.5 | `:1082` | 1 |  |
| `StrengthLevelMultiplier` | 0.5 | `:1060` | 1 |  |
| `WorldDaemonDifficulty` | 5 | `:1085` | 1 |  |

**Source-File 14** (`applySourceFile.ts:170-172`) - keine Multiplikatorwirkung im Code

| Stufe | Wirkung |
|---|---|
| 1 | +100% Stat-Mults aus Node Power; Favor-Deckel aus Winstreaks 200k Rep-Aequivalent; 1000 Rep zu Favor |
| 2 | go.cheat-API dauerhaft; 300k; 1500 |
| 3 | +25% additive Erfolgsrate fuer go.cheat; 400k; 2000 |

### BN15 - The Secrets of the Dark Net

*"The rules have changed"* | Definition `BitNode.tsx:519` | Multiplikatoren `case 15` ab `:1089` | **21** Abweichungen vom Default

| Feld | Wert | Zeile | Default | Anmerkung |
|---|---|---|---|---|
| `AgilityLevelMultiplier` | 0.7 | `:1097` | 1 |  |
| `AugmentationMoneyCost` | 3 | `:1104` | 1 |  |
| `BladeburnerRank` | 0.2 | `:1112` | 1 |  |
| `BladeburnerSkillCost` | 3 | `:1113` | 1 |  |
| `CharismaLevelMultiplier` | 1.1 | `:1098` | 1 |  |
| `CorporationDivisions` | 0.4 | `:1108` | 1 |  |
| `CorporationSoftcap` | 0.4 | `:1107` | 1 |  |
| `CorporationValuation` | 0.2 | `:1106` | 1 |  |
| `DaedalusAugsRequirement` | 20 | `:1110` | 30 |  |
| `DefenseLevelMultiplier` | 0.7 | `:1095` | 1 |  |
| `DexterityLevelMultiplier` | 0.7 | `:1096` | 1 |  |
| `GangUniqueAugs` | 0.3 | `:1115` | 1 |  |
| `HackingLevelMultiplier` | 0.6 | `:1091` | 1 |  |
| `HackingSpeedMultiplier` | 0.6 | `:1092` | 1 |  |
| `ServerMaxMoney` | 0.8 | `:1100` | 1 |  |
| `ServerStartingMoney` | 0.5 | `:1101` | 1 |  |
| `ServerStartingSecurity` | 1.5 | `:1102` | 1 |  |
| `StaneksGiftExtraSize` | -2 | `:1118` | 0 |  |
| `StaneksGiftPowerMultiplier` | 0.7 | `:1117` | 1 |  |
| `StrengthLevelMultiplier` | 0.7 | `:1094` | 1 |  |
| `WorldDaemonDifficulty` | 2 | `:1120` | 1 |  |

**Source-File 15** (`applySourceFile.ts:173-177`) - keine Multiplikatorwirkung im Code

| Stufe | Wirkung |
|---|---|
| 1 | Start mit TOR-Router und DarkscapeNavigator.exe, volles Darkweb ueberall (Prestige.ts:242-244) |
| 2 | Charisma hebt Gehalt und Firmen-Rep; +20% Authentifizierungstempo |
| 3 | Charisma hebt Faktions-Rep; +50% XP und Geld aus .cache-Dateien |

---

## Teil 2 — Auswertung 1: Die 40 Restläufe und ihr Träger

Gelesen: `C:\Users\erche\Desktop\claude_projecto\bitburner\src\route.json`, Stand `2026-09-02`, **40 Einträge**.
Aufteilung: **30 × V2** (BN10 ×2, BN4 ×2, BN9 ×3, BN2 ×3, BN3 ×3, BN11 ×3, BN6 ×2, BN7 ×3, BN14 ×3,
BN13 ×3, BN15 ×3) und **10 × V1** (BN1 ×2, BN5 ×2, BN12 ×3, BN8 ×3). Die Angabe „V2 (30 der 40 Läufe)"
aus Auftrag 4.3 ist damit **bestätigt**.

### 2.1 Prüfung jeder Einzelangabe aus Auftrag 3.4

| Behauptung im Auftrag | Befund | Beleg |
|---|---|---|
| BN9 `CloudServerLimit` 0 (`:816`) | **bestätigt**, Zeile stimmt exakt | `BitNode.tsx:816` |
| BN7 `BladeburnerRank` 0,6 | **bestätigt** | `:756` |
| BN7 `BladeburnerSkillCost` 2 | **bestätigt** | `:757` |
| BN14 `BladeburnerRank` 0,6 | **bestätigt** | `:1076` |
| BN14 `BladeburnerSkillCost` 2 | **bestätigt** | `:1077` |
| BN13 `BladeburnerRank` 0,45 | **bestätigt** | `:1031` |
| BN13 `BladeburnerSkillCost` 2 | **bestätigt** | `:1032` |
| BN15 `BladeburnerRank` 0,2 | **bestätigt** | `:1112` |
| BN15 `BladeburnerSkillCost` 3 | **bestätigt** | `:1113` |
| BN15: Daedalus führt The Red Pill nicht (`FactionHelpers.tsx:204-207`) | **bestätigt**, Zeilen exakt | `Faction/FactionHelpers.tsx:204-207` |
| BN8 `BladeburnerRank` 0 | **bestätigt** | `:790` |
| BN8 `ScriptHackMoneyGain` 0 | **bestätigt** | `:779` |
| BN8 „FavorToDonate 0" | **bestätigt**, Feld heißt `FavorToDonateToFaction` | `:782` |
| Nach Position 4 SF4.3 | **bestätigt**: Pos. 4 ist `{node:4, level:3}`, Zerstörung hebt SF4 auf 3 | `route.json`, `BitNode.tsx:162-166` |
| Nach Position 6 SF9.2 → home 128 GB | **bestätigt**: Pos. 6 ist `{node:9, level:2}` | `Prestige.ts:246-247` |
| Nach Position 7 SF9.3 → Gratis-Hacknet-Server | **bestätigt**, gilt ausdrücklich **nur beim Knoteneintritt**, nicht beim Aug-Einbau | `Prestige.ts:335-348`, `BitNode.tsx:344-345` |

**Keine einzige der geprüften Angaben aus 3.4 ist falsch.** Der Abschnitt ist belastbar.

### 2.2 Träger je Routeneintrag, mit den Knotenzahlen dahinter

`BladeburnerRank` skaliert den Rangzuwachs jeder Aktion (`Bladeburner/Formulas.ts:13,22,25`),
`BladeburnerSkillCost` multipliziert den Skillpreis linear (`Bladeburner/Skill.ts:76-80`:
`round(count · BladeburnerSkillCost · (baseCost + costInc · (level + (count-1)/2)))`).
Die WorldDaemon-Schwelle ist `3000 · WorldDaemonDifficulty` (`servers.ts:1536` × `ServerHelpers.ts:383-385`).

| # | Knoten | Level | Traeger laut route.json | BladeburnerRank | BladeburnerSkillCost | DaedalusAugs | WorldDaemon-Schwelle |
|---|---|---|---|---|---|---|---|
| 1 | BN10 | 2 | V2 | 0.8 `:876` | 1 (Default) | 30 (Default 30) | 6000 `:886` |
| 2 | BN10 | 3 | V2 | 0.8 `:876` | 1 (Default) | 30 (Default 30) | 6000 `:886` |
| 3 | BN4 | 2 | V2 | 1 (Default) | 1 (Default) | 30 (Default 30) | 9000 `:660` |
| 4 | BN4 | 3 | V2 | 1 (Default) | 1 (Default) | 30 (Default 30) | 9000 `:660` |
| 5 | BN9 | 1 | V2 (braucht hashes.js) | 0.9 `:830` | 1.2 `:831` | 30 (Default 30) | 6000 `:841` |
| 6 | BN9 | 2 | V2 (braucht hashes.js) | 0.9 `:830` | 1.2 `:831` | 30 (Default 30) | 6000 `:841` |
| 7 | BN9 | 3 | V2 (braucht hashes.js) | 0.9 `:830` | 1.2 `:831` | 30 (Default 30) | 6000 `:841` |
| 8 | BN1 | 2 | V1 | 1 (Default) | 1 (Default) | 30 (Default 30) | 3000 (Default) |
| 9 | BN1 | 3 | V1 | 1 (Default) | 1 (Default) | 30 (Default 30) | 3000 (Default) |
| 10 | BN5 | 2 | V1 | 1 (Default) | 1 (Default) | 30 (Default 30) | 4500 `:691` |
| 11 | BN5 | 3 | V1 | 1 (Default) | 1 (Default) | 30 (Default 30) | 4500 `:691` |
| 12 | BN12 | 1 | V1 | dec (0.980392 bei L1) `:984` | inc (1.02 bei L1) `:985` | 31 `:929` | 3060 `:993` |
| 13 | BN12 | 2 | V1 | dec (0.980392 bei L1) `:984` | inc (1.02 bei L1) `:985` | 31 `:929` | 3060 `:993` |
| 14 | BN12 | 3 | V1 | dec (0.980392 bei L1) `:984` | inc (1.02 bei L1) `:985` | 31 `:929` | 3060 `:993` |
| 15 | BN2 | 1 | V2 | 1 (Default) | 1 (Default) | 30 (Default 30) | 15000 `:596` |
| 16 | BN2 | 2 | V2 | 1 (Default) | 1 (Default) | 30 (Default 30) | 15000 `:596` |
| 17 | BN2 | 3 | V2 | 1 (Default) | 1 (Default) | 30 (Default 30) | 15000 `:596` |
| 18 | BN3 | 1 | V2 | 1 (Default) | 1 (Default) | 30 (Default 30) | 6000 `:630` |
| 19 | BN3 | 2 | V2 | 1 (Default) | 1 (Default) | 30 (Default 30) | 6000 `:630` |
| 20 | BN3 | 3 | V2 | 1 (Default) | 1 (Default) | 30 (Default 30) | 6000 `:630` |
| 21 | BN11 | 1 | V2 | 1 (Default) | 1 (Default) | 30 (Default 30) | 4500 `:921` |
| 22 | BN11 | 2 | V2 | 1 (Default) | 1 (Default) | 30 (Default 30) | 4500 `:921` |
| 23 | BN11 | 3 | V2 | 1 (Default) | 1 (Default) | 30 (Default 30) | 4500 `:921` |
| 24 | BN6 | 2 | V2 | 1 (Default) | 1 (Default) | 35 `:720` | 6000 `:725` |
| 25 | BN6 | 3 | V2 | 1 (Default) | 1 (Default) | 35 `:720` | 6000 `:725` |
| 26 | BN7 | 1 | V2 | 0.6 `:756` | 2 `:757` | 35 `:762` | 6000 `:767` |
| 27 | BN7 | 2 | V2 | 0.6 `:756` | 2 `:757` | 35 `:762` | 6000 `:767` |
| 28 | BN7 | 3 | V2 | 0.6 `:756` | 2 `:757` | 35 `:762` | 6000 `:767` |
| 29 | BN14 | 1 | V2 | 0.6 `:1076` | 2 `:1077` | 30 (Default 30) | 15000 `:1085` |
| 30 | BN14 | 2 | V2 | 0.6 `:1076` | 2 `:1077` | 30 (Default 30) | 15000 `:1085` |
| 31 | BN14 | 3 | V2 | 0.6 `:1076` | 2 `:1077` | 30 (Default 30) | 15000 `:1085` |
| 32 | BN13 | 1 | V2 | 0.45 `:1031` | 2 `:1032` | 30 (Default 30) | 9000 `:1041` |
| 33 | BN13 | 2 | V2 | 0.45 `:1031` | 2 `:1032` | 30 (Default 30) | 9000 `:1041` |
| 34 | BN13 | 3 | V2 | 0.45 `:1031` | 2 `:1032` | 30 (Default 30) | 9000 `:1041` |
| 35 | BN15 | 1 | V2 | 0.2 `:1112` | 3 `:1113` | 20 `:1110` | 6000 `:1120` |
| 36 | BN15 | 2 | V2 | 0.2 `:1112` | 3 `:1113` | 20 `:1110` | 6000 `:1120` |
| 37 | BN15 | 3 | V2 | 0.2 `:1112` | 3 `:1113` | 20 `:1110` | 6000 `:1120` |
| 38 | BN8 | 1 | V1 (braucht boerse.js) | 0 `:790` | 1 (Default) | 30 (Default 30) | 3000 (Default) |
| 39 | BN8 | 2 | V1 (braucht boerse.js) | 0 `:790` | 1 (Default) | 30 (Default 30) | 3000 (Default) |
| 40 | BN8 | 3 | V1 (braucht boerse.js) | 0 `:790` | 1 (Default) | 30 (Default 30) | 3000 (Default) |

### 2.3 Ist der zugewiesene Träger überhaupt möglich?

Der Träger ist nicht frei wählbar; beide Wege haben eine harte Sperre im Quellcode.

**V2 setzt `BladeburnerRank > 0` voraus.** Bei `BladeburnerRank === 0` blendet
`Locations/ui/SpecialLocation.tsx:105-107` den Bewerbungsknopf ersatzlos aus, und
`Augmentation/ui/PlayerMultipliers.tsx:275` blendet die Bladeburner-Multiplikatoren aus.
Das trifft **genau einen** Knoten: **BN8** (`:790`). `route.json` weist BN8 folgerichtig V1 zu — die
Zuweisung ist dort nicht eine Wahl, sondern die einzige Möglichkeit.
Zugang selbst: `canAccessBladeburner()` = `(canAccessBitNodeFeature(6) || canAccessBitNodeFeature(7)) && !disableBladeburner`
(`PlayerObjectBladeburnerMethods.ts:6-8`, `BitNodeUtils.ts:17-19`). Der Live-Stand hat SF6 auf Stufe 1 —
V2 ist damit in allen 29 übrigen V2-Einträgen technisch offen.

**V1 setzt eine erreichbare The-Red-Pill-Quelle voraus.** In **BN15** entfernt
`FactionHelpers.tsx:204-207` TRP aus dem Daedalus-Sortiment (`Player.bitNodeN === 15 && faction === Daedalus`).
V1 ist dort tot; der einzige Ersatz ist das Darknet-Labyrinth (V1b), für das laut `route.json`-Hinweis noch
kein Gewerk existiert. Die Zuweisung V2 für BN15 ist also **erzwungen** — trotz des mit Abstand
schlechtesten Bladeburner-Profils des Spiels (`Rank 0,2` `:1112`, `SkillCost 3` `:1113`).
Kombiniert heißt das: BN15 braucht den **fünffachen** Rangaufwand von BN1/BN2/BN3/BN11 und zahlt dabei
den **dreifachen** Skillpreis.

**Rangfolge der V2-Härte** (Rangzuwachs × Skillpreis; kleiner = härter):

| Rang | Knoten | `BladeburnerRank` | `BladeburnerSkillCost` | Routeneinträge |
|---|---|---|---|---|
| 1 (härtester) | BN15 | 0,2 `:1112` | 3 `:1113` | 35–37 |
| 2 | BN13 | 0,45 `:1031` | 2 `:1032` | 32–34 |
| 3 | BN7 / BN14 | 0,6 `:756` / `:1076` | 2 `:757` / `:1077` | 26–28 / 29–31 |
| 4 | BN10 | 0,8 `:876` | 1 (Default) | 1–2 |
| 5 | BN9 | 0,9 `:830` | 1,2 `:831` | 5–7 |
| 6 | BN12 | `dec` ≈ 0,98 / 0,96 / 0,94 `:984` | `inc` ≈ 1,02 / 1,04 / 1,06 `:985` | (V1 in der Route) |
| 7 | BN2, BN3, BN4, BN6, BN11 | 1 (Default) | 1 (Default) | diverse |
| — | BN8 | **0** `:790` | — | V2 unmöglich |

**Die letzten neun V2-Läufe (Positionen 29–37, BN14/BN13/BN15) tragen zusammen den Löwenanteil der
V2-Härte der Restroute.** Wer an der Bladeburner-Mechanik optimiert, optimiert für diese neun.

---

## Teil 3 — Auswertung 2: `DaedalusAugsRequirement` je Knoten

Default **30**, `BitNodeMultipliers.ts:61`. Verwendet in `Faction/FactionInfo.tsx:141-145` als
`delayedCondition(() => haveAugmentations(currentNodeMults.DaedalusAugsRequirement))`, daneben
`haveMoney(100e9)` und `someCondition([haveSkill("hacking", 2500), haveCombatSkills(1500)])`.
Zweite Fundstelle: `Programs/Programs.ts:328`.

| Knoten | Wert | Beleg |
|---|---|---|
| BN1, BN2, BN3, BN4, BN5, BN8, BN9, BN10, BN11, BN13, BN14 | **30** | kein Override; Default `BitNodeMultipliers.ts:61` |
| BN6 | **35** | `BitNode.tsx:720` |
| BN7 | **35** | `BitNode.tsx:762` |
| BN12 | **31** auf allen erreichbaren Stufen | `BitNode.tsx:929` (Formel), siehe Befund B3 |
| BN15 | **20** | `BitNode.tsx:1110` |

**Die Formel als ausführbarer JavaScript-Ausdruck** (wörtlich aus `BitNode.tsx:925,929`, mit aufgelöstem
`defaultMultipliers`):

```js
// lvl = Player.activeSourceFileLvl(12) + 1   (BitNode.tsx:1130)
const daedalusAugsRequirementBN12 = (lvl) =>
  Math.floor(Math.min(30 + Math.pow(1.02, lvl), 40));
```

**Prüfung, gerechnet und nicht überschlagen** (Node, 2026-09-04 01:42):

| `lvl` | `Math.pow(1.02, lvl)` | `30 + inc` | `Math.min(…, 40)` | `Math.floor` |
|---|---|---|---|---|
| **1** | 1,02 | 31,02 | 31,02 | **31** |
| **2** | 1,0404 | 31,0404 | 31,0404 | **31** |
| **3** | 1,061208 | 31,061208 | 31,061208 | **31** |
| **10** | 1,2189944199947573 | 31,2189944… | 31,2189944… | **31** |

Ergänzend, weil es die Aussage „mit Deckel 40" einordnet: der Wert springt auf **32 erst bei `lvl = 36`**
(`inc = 2,0399`) und erreicht den **Deckel 40 erst bei `lvl = 117`** (`inc = 10,144`; algebraisch
`lvl ≥ ln(10)/ln(1,02) = 116,28`). **Der Auftragstext ist damit formal richtig und praktisch irreführend:
für die drei geplanten BN12-Läufe lautet der Wert konstant 31.**

Der Bot braucht also in BN12 genau **eine** installierte Augmentierung mehr als im Default-Fall — nicht zehn.
Und: gezählt werden nur **installierte** Augs, `queuedAugmentations` zählen nicht (Befund B8).


---

## Teil 4 — Auswertung 3: Welche Knoten kappen den Kaltstart am härtesten?

### 4.1 Was „Kaltstart" hier heißt, mit Belegen

Beim Eintritt in einen neuen Knoten gilt in **allen** Knoten dasselbe Ausgangsbild:

| Größe | Wert | Beleg |
|---|---|---|
| Geld | **1.262 $** (`1000 + CONSTANTS.Donations`, `Donations = 262`) | `PlayerObjectGeneralMethods.ts:102`, `Constants.ts:107` |
| … außer BN8 | **250.000.000 $** | `Prestige.ts:38` (`BitNode8StartingMoney`), gesetzt `:162` und `:303` |
| … außer BN13 | **200.000 $** (`CONSTANTS.TravelCost`) | `Prestige.ts:350-352`, `Constants.ts:28` |
| home-RAM | 8 GB ohne SF; **32 GB ab SF1.1**; **128 GB ab SF9.2** | `Prestige.ts:246-252` |
| home-Kerne | 1 | `Prestige.ts:253` |
| alle Skills | 1, alle Exp 0 | `PlayerObjectGeneralMethods.ts:86-100` |
| Mietrechner | 0 | `PlayerObjectGeneralMethods.ts:109` |

Die drei Stellschrauben, an denen ein Knoten diesen Start zusätzlich verengt, und die Formeln dahinter:

```js
// 1) Mietrechner-Park
getCloudServerLimit()  = Math.round(25 * CloudServerLimit)                     // ServerPurchases.ts:96-98,  Basis Server/data/Constants.ts:12
getCloudServerMaxRam() = 1 << (31 - Math.clz32(Math.round(1048576 * CloudServerMaxRam)))
                                                                               // ServerPurchases.ts:100-105, Basis Server/data/Constants.ts:13
getCloudServerCost(ram)= ram * 55000 * CloudServerCost
                       * Math.pow(CloudServerSoftcap, Math.max(0, Math.log2(ram) - 6))
                                                                               // ServerPurchases.ts:23-42,   Basis Server/data/Constants.ts:4
// 2) home-RAM
getUpgradeHomeRamCost()= currentRam * 32000 * Math.pow(1.58, Math.log2(currentRam)) * HomeComputerRamCost
                                                                               // PlayerObjectServerMethods.ts:30-40, Basis Server/data/Constants.ts:3
// 3) Geld in der Welt
server.moneyAvailable  = baseMoney * ServerStartingMoney                       // Server/Server.ts:75
server.moneyMax        = 25 * baseMoney * ServerMaxMoney                       // Server/Server.ts:76
```

Zwei abgeleitete Kennzahlen für die Tabelle:

- **Ertragsfaktor** = `ServerMaxMoney · ScriptHackMoney · ScriptHackMoneyGain`. Das ist der Faktor, um den
  ein Hack-Faden am vollen Server gegenüber BN1 weniger einbringt. (`Hacking.ts:54` für `ScriptHackMoney`,
  `NetscriptHelpers.tsx:594` für `ScriptHackMoneyGain`.) **Bestand-Anteil beachten:** `ServerMaxMoney` ist
  ein Deckel, kein Ratenfaktor — der Faktor gilt erst, wenn der Server am Deckel steht.
- **Exp-×-Level-Faktor** = `HackExpGain · HackingLevelMultiplier`. Wie schnell das Hacking-Level wächst.

**Der „größte Server bei Budget X"** ist die größte Zweierpotenz, deren `getCloudServerCost` unter dem
Budget liegt — die aussagekräftigere Zahl als `Limit × MaxRAM`, weil `CloudServerSoftcap` den nominellen
Deckel bei allen Knoten mit Softcap > 1 unbezahlbar macht (in BN6/7 kostet ein 1.048.576-GB-Rechner das
$2,4·10^19-fache … der Deckel steht dort nur auf dem Papier).

### 4.2 Die Zahlen (gerechnet 2026-09-04 01:44, Node)

| Knoten | Cloud-Park (Limit x MaxRAM) | groesster Server bei $1 Mrd / $1 Bio / $100 Bio | home 32 -> 1024 GB | Ertragsfaktor | Exp-x-Level-Faktor | ServerStartingMoney |
|---|---|---|---|---|---|---|
| BN1 | 25 x 1048576 = 26.214.400 GB | 16384 / 1048576 / 1048576 GB | $1466.2 Mio | 1 | 1 | 1 |
| BN2 | 25 x 1048576 = 26.214.400 GB | 2048 / 524288 / 1048576 GB | $1466.2 Mio | 0.08 | 0.8 | 0.4 |
| BN3 | 25 x 1048576 = 26.214.400 GB | 2048 / 262144 / 1048576 GB | $2199.3 Mio | 0.008 | 0.8 | 0.2 |
| BN4 | 25 x 1048576 = 26.214.400 GB | 4096 / 1048576 / 1048576 GB | $1466.2 Mio | 0.0225 | 0.4 | 0.75 |
| BN5 | 25 x 1048576 = 26.214.400 GB | 4096 / 1048576 / 1048576 GB | $1466.2 Mio | 0.15 | 0.5 | 0.5 |
| BN6 | 25 x 1048576 = 26.214.400 GB | 1024 / 32768 / 262144 GB | $1466.2 Mio | 0.15 | 0.0875 | 0.5 |
| BN7 | 25 x 1048576 = 26.214.400 GB | 1024 / 32768 / 262144 GB | $1466.2 Mio | 0.1 | 0.0875 | 0.5 |
| BN8 | 25 x 1048576 = 26.214.400 GB | 256 / 4096 / 16384 GB | $1466.2 Mio | 0 | 1 | 1 |
| BN9 | 0 x 1048576 = 0 GB | 16384 / 1048576 / 1048576 GB | $7330.9 Mio | 0.001 | 0.025 | 0.1 |
| BN10 | 15 x 524288 = 7.864.320 GB | 2048 / 524288 / 524288 GB | $2199.3 Mio | 0.5 | 0.35 | 1 |
| BN11 | 25 x 1048576 = 26.214.400 GB | 1024 / 32768 / 262144 GB | $1466.2 Mio | 0.01 | 0.3 | 0.1 |
| BN12.L1 | 25 x 524288 = 13.107.200 GB | 8192 / 524288 / 524288 GB | $1495.5 Mio | 0.94232233 | 0.96116878 | 0.980392 |
| BN13 | 25 x 1048576 = 26.214.400 GB | 1024 / 65536 / 1048576 GB | $1466.2 Mio | 0.0675 | 0.025 | 0.75 |
| BN14 | 25 x 1048576 = 26.214.400 GB | 16384 / 1048576 / 1048576 GB | $1466.2 Mio | 0.21 | 0.4 | 0.5 |
| BN15 | 25 x 1048576 = 26.214.400 GB | 16384 / 1048576 / 1048576 GB | $1466.2 Mio | 0.8 | 0.6 | 0.5 |
| BN12.L2 | 24 x 524288 = 12.582.912 GB | 8192 / 524288 / 524288 GB | $1525.4 Mio | 0.88797138 | 0.92384543 | 0.961169 |
| BN12.L3 | 24 x 524288 = 12.582.912 GB | 8192 / 524288 / 524288 GB | $1555.9 Mio | 0.83675527 | 0.88797138 | 0.942322 |

### 4.3 Rangfolge — drei getrennte Achsen, dann das Urteil

Eine einzige Kennzahl wäre eine erfundene Zahl. Deshalb drei Achsen mit den echten Werten.

**Achse A — RAM-Beschaffung (härteste zuerst)**

| # | Knoten | Zahl | Beleg |
|---|---|---|---|
| 1 | **BN9** | Park **0 GB**. `CloudServerLimit 0` → `Math.round(25·0) = 0`. Kein einziger Mietrechner, in keinem Budget. Dazu `HomeComputerRamCost 5`: 32 → 1024 GB kostet **$7,33 Mrd** statt $1,47 Mrd. | `:816`, `:814` |
| 2 | **BN8** | `CloudServerSoftcap 4` — der härteste Softcap des Spiels. Bei $1 Mrd nur **256 GB**, bei $1 Bio **4.096 GB**, bei $100 Bio **16.384 GB** (BN1: 16.384 / 1.048.576 / 1.048.576). | `:772` |
| 3 | **BN6, BN7, BN11** | `CloudServerSoftcap 2`: bei $1 Bio **32.768 GB** statt 1.048.576 — Faktor 32. | `:702`, `:736`, `:898` |
| 4 | **BN10** | `Limit 0,6` → 15 Rechner, `MaxRam 0,5` → 524.288 GB, `Cost 5` → ein 64-GB-Rechner kostet **$17,6 Mio** statt $3,52 Mio; `HomeComputerRamCost 1,5`. | `:857`, `:858`, `:855`, `:853` |
| 5 | **BN3** | `CloudServerCost 2` × `Softcap 1,3`; bei $1 Bio **262.144 GB**. `HomeComputerRamCost 1,5`. | `:609`, `:610`, `:607` |
| 6 | **BN12** | Halbierter Maximalrechner (**524.288 GB**) schon auf Stufe 1 — siehe Befund B4; Limit 25 → 24 ab Stufe 2. | `:951`, `:950` |
| 7 | **BN13** | `Softcap 1,6`: bei $1 Bio 65.536 GB. | `:1004` |

**Achse B — Geldertrag (härteste zuerst)**

| # | Knoten | Ertragsfaktor | die Bestandteile |
|---|---|---|---|
| 1 | **BN8** | **0** | `ScriptHackMoneyGain 0` `:779`. Hacken bringt **nichts**. Dazu `CompanyWorkMoney 0` `:774`, `CrimeMoney 0` `:775`, `HacknetNodeMoney 0` `:776`, `CodingContractMoney 0` `:780`, `InfiltrationMoney 0` `:784`, `ManualHackMoney 0` `:777`, `DarknetMoneyMultiplier 0` `:793`. **Jede Geldquelle außer der Börse ist auf null.** Ausgleich: 250 Mio Startgeld. |
| 2 | **BN9** | **0,001** | `ServerMaxMoney 0,01` `:810` × `ScriptHackMoney 0,1` `:819`; `ServerStartingMoney 0,1` `:811`. |
| 3 | **BN3** | **0,008** | `ServerMaxMoney 0,04` `:604` × `ScriptHackMoney 0,2` `:615`; dazu `ServerGrowthRate 0,2` `:603` — der Weg zum Deckel dauert das Fünffache. |
| 4 | **BN11** | **0,01** | `ServerMaxMoney 0,01` `:894`; `ServerGrowthRate 0,2` `:893`. Ausgleich: `CrimeMoney 3` `:901`, `InfiltrationMoney/Rep 2,5` `:909-910`. |
| 5 | **BN4** | **0,0225** | `ServerMaxMoney 0,1125` `:635` × `ScriptHackMoney 0,2` `:643`. |
| 6 | **BN13** | **0,0675** | `ServerMaxMoney 0,3375` `:1006` × `ScriptHackMoney 0,2` `:1013`. |
| 7 | **BN2** | **0,08** | `ServerMaxMoney 0,08` `:580`; `ServerGrowthRate 0,8` `:579`. Ausgleich: `CrimeMoney 3` `:585`, `InfiltrationMoney 3` `:593`. |

**Achse C — Hacking-Levelwachstum (härteste zuerst)**

| # | Knoten | `HackExpGain` × `HackingLevelMultiplier` | Beleg |
|---|---|---|---|
| 1 | **BN9** | 0,05 × 0,5 = **0,025** | `:821`, `:803` |
| 1 | **BN13** | 0,1 × 0,25 = **0,025** | `:1020`, `:998` |
| 3 | **BN6, BN7** | 0,25 × 0,35 = **0,0875** | `:709`/`:743`, `:696`/`:730` |
| 4 | **BN11** | 0,5 × 0,6 = **0,3** | `:905`, `:891` |
| 5 | **BN10** | 1 × 0,35 = **0,35** | (kein `HackExpGain`), `:846` |
| 6 | **BN4** | 0,4 × 1 = **0,4** | `:649` |
| 6 | **BN14** | 1 × 0,4 = **0,4**, zusätzlich `HackingSpeedMultiplier 0,3` `:1049` — Fäden laufen 3,3× so lang | `:1048` |

### 4.4 Urteil — die harte Rangfolge für den Kaltstart

1. **BN9 — mit Abstand der härteste Kaltstart des Spiels.** Als einziger Knoten sperrt er die
   Mietrechner **vollständig** (`CloudServerLimit 0`, `:816`); der Ersatzweg home-RAM kostet gleichzeitig das
   Fünffache (`:814`). Ertragsfaktor 0,001 und Exp-Faktor 0,025 sind je für sich schon Spitzenwerte, zusammen
   heben sie sich nicht auf, sondern multiplizieren. Dazu `ServerStartingSecurity 2,5` (`:812`).
   **Betriebliche Folge: die Routenpositionen 5–7 sind die drei schwersten Läufe der ganzen Restroute** —
   und sie kommen früh, bevor SF9.2/9.3 den Kaltstart entschärfen (die entschärfen ihn erst *danach*).
2. **BN8 — Sonderfall, nicht vergleichbar.** Einkommen exakt null, Softcap 4, aber 250 Mio Startkapital.
   Der Kaltstart ist nicht knapp an Geld, sondern an **Rate**: es gibt keine. Die Phasenregel aus Auftrag 4.3
   ist damit belegt richtig — jeder vor der Börse gekaufte Rechner ist totes Kapital.
3. **BN3** — Ertragsfaktor 0,008 *und* `ServerGrowthRate 0,2` *und* teure Rechner *und* teures home *und*
   `AugmentationMoneyCost/RepCost 3` (`:619-620`). Der einzige Knoten, der auf allen drei Achsen im
   schlechteren Drittel liegt, ohne einen Ausgleichshebel zu bekommen.
4. **BN13** — schlechtestes Levelwachstum (0,025), höchste Startsicherheit des Spiels
   (`ServerStartingSecurity 3`, `:1008`), `FactionWorkRepGain 0,6` (`:1022`). Ausgleich: 200.000 $ Startgeld.
5. **BN11** — Ertragsfaktor 0,01, `ServerGrowthRate 0,2`, Softcap 2 — aber `CrimeMoney 3` und
   `InfiltrationMoney/Rep 2,5` sind ein voll ausgebauter Ersatzweg. `ServerWeakenRate 2` (`:896`) **hilft**:
   Weaken wirkt doppelt.
6. **BN6 / BN7** — Levelwachstum 0,0875 und Softcap 2; für V2 aber der Heimatknoten, das relativiert.
7. **BN10** — hart bei der RAM-Beschaffung (Limit 15, MaxRAM halbiert, Kosten ×5), aber mit Ertragsfaktor
   0,5 der **geldreichste** aller gedämpften Knoten (Befund B6).
8. **BN12** — mild in den Zahlen, mit einer Ausnahme: der halbierte Maximalrechner (Befund B4).
9. **BN2, BN4, BN5, BN14, BN15, BN1** — kein hartes Kaltstart-Nadelöhr.


---

## Teil 5 — Auswertung 4: Die Stanek-Frage (Quellcode-Teil)

Drei Teilfragen, drei klare Antworten, danach die Folgerung — und die weicht von der im Auftrag
vorgezeichneten ab.

### 5.1 Schenkt SF7.3 beim Bladeburner-Beitritt „Blade's Simulacrum"? — **JA**

```ts
// PersonObjects/Player/PlayerObjectBladeburnerMethods.ts:10-20
export function startBladeburner(this: PlayerObject): void {
  this.bladeburner = new Bladeburner();
  this.bladeburner.init();
  // Give Blades Simulacrum if you have unlocked it
  if (this.activeSourceFileLvl(7) >= 3) {            // :14
    this.augmentations.push({                        // :15  -> DIREKT in augmentations,
      name: AugmentationName.BladesSimulacrum,        // :16     nicht in queuedAugmentations
      level: 1,
    });
  }
}
```

Zeilenbeleg des Auftrags (`PlayerObjectBladeburnerMethods.ts:14-19`) ist **exakt richtig**. Die Aug landet
**sofort und installiert** in `Player.augmentations` — nicht in der Warteschlange. Zusätzlich sagt der
Spieltext dasselbe: `BitNode.tsx:272-275` (SF7-Beschreibung, Stufe 3) und `BitNode.tsx:474-475`
(SF13-Beschreibung: *„Due to the effect of Source-File 7.3, you must accept Stanek's Gift before joining the
Bladeburner division if you have that Source-File."*). Auch dieser Beleg stimmt zeilengenau.

Zwei Randbedingungen, die im Auftrag fehlen und für die Ablaufplanung zählen:
`Player.augmentations` wird beim **Knotenwechsel geleert** (`PlayerObjectGeneralMethods.ts:174`) und
`Player.bladeburner` auf `null` gesetzt (`:160`). **Die Frage stellt sich also in jedem Knoten neu**, und
das Simulacrum wird in jedem Knoten mit SF7.3 beim Beitritt **erneut geschenkt** — es muss ab
Routenposition 28 nicht mehr gegraftet werden.

### 5.2 Blockiert das Staneks Gabe? — **JA**, und zwar strenger als der Auftrag annimmt

Zwei Prüfungen, beide auf derselben Bedingung:

```ts
// CotMG/Helper.tsx:59-74
export function canAcceptStaneksGift(): Result {
  if (!Player.canAccessCotMG()) return { success:false, ... };            // :60-62
  if ([...Player.augmentations, ...Player.queuedAugmentations]            // :63-66
        .filter(a => a.name !== AugmentationName.NeuroFluxGovernor).length !== 0)
    return { success:false, ... };
  return { success:true };
}
```

```tsx
// Locations/ui/SpecialLocation.tsx:302-316  (renderCotMG)
if (Player.augmentations.filter(a => a.name !== NeuroFluxGovernor).length > 0 ||
    Player.queuedAugmentations.filter(a => a.name !== NeuroFluxGovernor).length > 0) {
  return <>… "Begone you filth! My gift must be the first modification …" </>;   // kein Annahmeknopf
}
```

Sobald `Blade's Simulacrum` in `Player.augmentations` liegt, greifen beide. **Der Annahmeknopf verschwindet
sofort mit dem Divisionsbeitritt** — es braucht dafür keinen Aug-Einbau.

**Zwei Verschärfungen gegenüber der Annahme im Auftrag:**

1. **Diese Prüfung kennt keine BN13-Ausnahme.** Sie steht ohne `bitNodeN`-Bedingung da. Wer in BN13 selbst
   mit SF7.3 zuerst der Bladeburner-Division beitritt, hat die Gabe **auch dort** verloren.
2. **Sie zählt `queuedAugmentations` mit.** Eine gekaufte, aber noch nicht eingebaute Aug sperrt die Gabe
   ebenso wie eine installierte.

Warnhinweis vor der Falle gibt es im Spiel: `SpecialLocation.tsx:77-96` zeigt eine Rückfrage („Do you
really want to join the Bladeburner division now?"), **aber nur** solange `canAcceptStaneksGift().success`
noch wahr ist. Der Bot bedient das per DOM — die Rückfrage ist also ein Dialog, der abgefangen werden muss,
kein stiller Vorgang.

### 5.3 Ist der Kirchenbeitritt außerhalb BN13 gesperrt, sobald eine Nicht-NFG-Aug installiert ist? — **JA für das Flag, NEIN als wirksamer Riegel**

Das im Auftrag zitierte Codestück existiert und steht zeilengenau, wo behauptet:

```ts
// Prestige.ts:184-191, innerhalb von prestigeAugmentation() — also bei JEDEM Aug-Einbau
// Bitnode 13: Church of the Machine God
if (Player.hasAugmentation(AugmentationName.StaneksGift1, true)) {
  joinFaction(Factions[FactionName.ChurchOfTheMachineGod]);      // :186
} else if (Player.bitNodeN !== 13) {                             // :187
  if (Player.augmentations.some(a => a.name !== AugmentationName.NeuroFluxGovernor)) {
    Factions[FactionName.ChurchOfTheMachineGod].isBanned = true; // :189
  }
}
```

**Aber `isBanned` ist nicht das, was die Gabe verhindert.** Drei Belege:

- `joinFaction()` (`Faction/FactionHelpers.tsx:35-52`) prüft `isBanned` **überhaupt nicht** — nur
  `isMember` (`:36`). `handleCotMG()` (`SpecialLocation.tsx:193-206`) ruft `joinFaction` direkt auf.
  Das Flag blockiert nur `receiveInvite()` (`PlayerObjectGeneralMethods.ts:179`), die Einladungsliste
  (`:460`) und die Darstellung (`FactionsRoot.tsx:66-67`).
- Das Flag wird bei **jedem** Aug-Einbau zuerst auf `false` zurückgesetzt
  (`Faction.prestigeAugmentation()`, `Faction.ts:84`, gerufen `Prestige.ts:106`) und danach in `:189`
  gegebenenfalls neu gesetzt — es ist ein Zustand pro Einbaurunde, kein dauerhaftes Verbot.
- Beim **Knotenwechsel** setzt `Faction.prestigeSourceFile()` (`Faction.ts:68-75`, gerufen
  `Prestige.ts:257`) es ebenfalls auf `false`, und in `prestigeSourceFile` gibt es **keine** erneute
  Sperrsetzung. **Jeder neue Knoten startet also mit ungesperrter Kirche.**

Der wirksame Riegel ist der aus 5.2 — und der ist strenger (kein BN13-Ausweg, zählt `queued` mit).

### 5.4 Folgerung — die im Auftrag vorgesehene Schlussfolgerung greift **nicht**

Auftrag 4.3 formuliert eine Weiche: *„Ist der Ausschluss bestätigt, entfällt Stanek ersatzlos … ist er es
nicht, muss `acceptGift` VOR dem Divisionsbeitritt stehen."*
**Der Quellcode wählt eindeutig den zweiten Zweig.** Der Ausschluss ist kein Ausschluss, sondern eine
**Reihenfolgebedingung**, und die Reihenfolge geht auf:

1. Gabe annehmen: `handleCotMG()` fügt `StaneksGift1` per `applyAugmentation` direkt in
   `Player.augmentations` ein (`SpecialLocation.tsx:198-203`; `AugmentationHelpers.ts:62-66` pusht
   ohne Warteschlange).
2. Danach der Bladeburner-Beitritt: `handleBladeburner()` (`SpecialLocation.tsx:77-96`) prüft
   `… && !Player.hasAugmentation(StaneksGift1)`. Mit der Gabe im Bestand ist die Bedingung **falsch**, die
   Rückfrage entfällt, `joinBladeburnerDivision()` läuft normal durch (`:97`). Nichts entfernt die Gabe.
3. Ab dem ersten Aug-Einbau hält `Prestige.ts:185-186` die Kirchenmitgliedschaft automatisch aufrecht.

**Damit ist Stanek in jedem Knoten erreichbar, in dem SF13 gilt** (`canAccessCotMG()` =
`canAccessBitNodeFeature(13)`, `PlayerObjectGeneralMethods.ts:603-605`) — **vorausgesetzt, die Gabe wird
angenommen, bevor irgendeine Nicht-NFG-Aug installiert oder gekauft und bevor die Bladeburner-Division
betreten wird.** Für BN13 selbst (Routenpositionen 32–34) heißt das konkret: die Reise nach Chongqing und
`acceptGift` gehören in den **Kaltstart vor** das Bladeburner-Tor — nicht dahinter. Das ist, wie der Auftrag
selbst schreibt, „eine Reihenfolgeentscheidung im Kaltstart, kein Zusatzgewerk".

**Was der Quellcode nicht beantwortet** und was der geplante Phase-D-Versuch in der Spielstandkopie noch
klären muss: ob es sich lohnt. `StaneksGiftPowerMultiplier` und `StaneksGiftExtraSize` variieren stark
(BN13: 2 / +1 `:1037-1038`; BN2: 2 / −6 `:594-595`; BN8: 0 / −99 `:798` — dort ist die Gabe faktisch
abgeschaltet), und die Gabe kostet den Kaltstart Reisezeit plus Reisekosten. Der Zeitpunkt-Konflikt ist
gelöst; die Nutzenfrage ist offen.

### 5.5 Zusammenfassung der vier JA/NEIN

| Teilfrage | Antwort | Kernbeleg |
|---|---|---|
| SF7.3 schenkt „Blade's Simulacrum" beim Bladeburner-Beitritt? | **JA** | `PlayerObjectBladeburnerMethods.ts:14-19` |
| Das blockiert Staneks Gabe? | **JA** | `CotMG/Helper.tsx:63-72`, `SpecialLocation.tsx:302-316` |
| Kirchenbeitritt außerhalb BN13 gesperrt, sobald eine Nicht-NFG-Aug installiert ist? | **JA für das `isBanned`-Flag** (`Prestige.ts:185-191`) — **aber das Flag ist nicht der wirksame Riegel** (`joinFaction` ignoriert es, `FactionHelpers.tsx:35-52`), und es wird bei jedem Knotenwechsel gelöscht (`Faction.ts:68-75`) | s. 5.3 |
| Entfällt Stanek deshalb ersatzlos? | **NEIN** — es ist eine Reihenfolgebedingung, und die Reihenfolge „Gabe zuerst, Division danach" funktioniert | s. 5.4 |

---

## Anhang — Was in dieser Fassung bewusst *nicht* steht

- **Keine Schwierigkeitsgrade.** Es gibt sie im Quellcode nicht (Befund B1). Teil 4 ersetzt sie durch
  gerechnete Achsen; das ist eine Ableitung und als solche gekennzeichnet.
- **Keine Werte aus `nodes/*.md`.** Jede Zahl dieses Dokuments stammt aus `reference/v301/src/` oder aus
  einer Rechnung, die hier vollständig abgedruckt ist.
- **Keine Werte aus `reference/bitburner-src`.** Der dev-Baum wurde ausschließlich für den Versionsvergleich
  in Befund B5 gelesen.
- **Nichts geschrieben außerhalb** von `nodes/BAU-2026-09/`. Kein Zugriff auf `src/`, keine schreibende
  RFA, kein `tools/task.js`, kein Browser.
