# Vorbereitung der naechsten Knoten

**Zweck:** Beim Knotenwechsel nicht bei null anfangen. Hier steht, was den
Ausgang der jeweils naechsten BitNodes bestimmt - aus dem Spielquellcode
hergeleitet, nicht geschaetzt.

**Erstellt am 30.08.2026** von einem Audit-Subagenten, geprueft gegen
`reference/bitburner-src/src/` (v3.0.2). Die Reihenfolge stammt unveraendert
aus `nodes/AUDIT-ROADMAP-2026-08-24.md` und wird hier nicht bewertet.

Aktuell laeuft **BitNode 10** (Plaetze 3-5). Die naechsten drei sind
**BN4** (6-7), **BN9** (8-10) und **BN1** (11-12).

---

## Gemeinsame Grundlage

`w0r1d_d43m0n` hat `requiredHackingSkill: 3000` (`Server/data/servers.ts:1553`),
multipliziert mit `WorldDaemonDifficulty` beim Netzaufbau
(`Server/ServerHelpers.ts:422-423`). Beide Ausgaenge stehen als ODER in
`NetscriptFunctions/Singularity.ts:1148-1164`.

**Der Hacking-Weg setzt The Red Pill zwingend voraus.** Ohne TRP hat der
WD-Server `serversOnNetwork.length === 0`, und `getServer` wirft "Invalid
host" (`Prestige.ts:173-181`, `Netscript/NetscriptHelpers.tsx:554-570`) -
`ns.nuke` kommt gar nicht erst dran. Wer den Hacking-Weg plant, plant den
Daedalus-Sockel mit: 30 Augmentierungen, 100 Mrd Dollar, Hacking 2500 oder
alle Kampfwerte 1500, dann 2,5 Mio Daedalus-Rep
(`Faction/FactionInfo.tsx:138-149`).

Erfahrungsbedarf fuer ein angezeigtes Level S bei Gesamtmultiplikator
M = `mults.hacking * HackingLevelMultiplier`:

    exp = e^((S/M + 200)/32) - 534,6      (`PersonObjects/formulas/skill.ts:17`)

---

## BitNode 4 (Plaetze 6-7)

    Ausgangsbedingung: Hacking 9000 + Adminrechte (WorldDaemonDifficulty 3,
                       `BitNode.tsx:654`) ODER 21 Black Ops, Rang 400.000
    Billigerer Weg:    Bladeburner, mit Abstand
    Engpass:           Rang 400.000 - und zwar der Anlauf 0 bis rund 80.000
    SourceFile:        SF4, keine Multiplikatoren - sein ganzer Wert ist der
                       RAM-Rabatt auf die Singularity-API
    Groesste Falle:    Sleeve-Schock 100 beim Verlassen von BN10

Hacking 9000 ist die hoechste Schwelle der drei Knoten: bei M = 13,195
(25-Aug-Satz mal SF1.1) sind das 9,36e11 Erfahrung, und `HackExpGain: 0.4`
drueckt die Rate auf 40 Prozent - rund **170 Stunden allein fuer das Level**,
zusaetzlich zum Daedalus-Sockel.

Bladeburner dagegen: `BladeburnerRank` und `BladeburnerSkillCost` sind in
case 4 **nicht gesetzt**, also Default 1 (`BitNodeMultipliers.ts:19,22`) -
exakt die 400.000 aus BN6. Dort wurden **80.340 auf 452.411 Rang in 10,05
Stunden** gemessen (`data/verlauf-strategie.json`, 28.08. 05:02-15:05), die
letzten vier Stunden mit rund 85.000 Rang je Stunde.

**Der Engpass ist der Anlauf, nicht der Rest.** In BN6 dauerte 80k auf 452k
zehn Stunden; in BN10 dauerten die ersten 596 Rang achtzehn. Aufpreis in
BN4: die Kampfwerte 100 fuer den Beitritt bei allen vier Erfahrungsquellen
auf 0,5 (`:639-642`) - doppelte Trainingszeit.

Weitere Multiplikatoren, die die Strategie aendern: `HacknetNodeMoney: 0.05`
(Hacknet als Anschub tot), `ScriptHackMoney: 0.2` mal `ServerMaxMoney: 0.1125`,
`CloudServerSoftcap: 1.2` (ein 1-PB-Server kostet 741 Mrd). **Nicht gesetzt
und damit 1:** HackingLevelMultiplier, AugmentationMoneyCost und -RepCost.

SF4 hat **keine** Multiplikatoren (`SourceFile/applySourceFile.ts:73-77`).
Sein Wert ist allein der RAM-Preis der Singularity-API: mal 16 bei SF4 <= 1,
mal 4 bei SF4.2, mal 1 bei SF4.3 (`Netscript/RamCostGenerator.ts:82-95`).
`b1tflum3` faellt damit von 257,6 GB auf 17,6 GB - auf 33 Restlaeufen der
Unterschied zwischen "braucht erst einen Mietrechner" und "laeuft auf dem
frischen home".

---

## BitNode 9 (Plaetze 8-10)

    Ausgangsbedingung: Hacking 6000 + Adminrechte (WorldDaemonDifficulty 2)
                       ODER 21 Black Ops, Rang 400.000
    Billigerer Weg:    Bladeburner, noch deutlicher als in BN4
    Engpass:           382 Hashes je Sekunde = 95,5 Mio Dollar je Sekunde -
                       die Decke der gesamten BN9-Wirtschaft
    SourceFile:        SF9.2 gibt jedem frischen home 128 GB statt 32
    Groesste Falle:    Skripte auf Hacknet-Servern drosseln die einzige
                       Geldquelle 1:1

Hacking faellt hier aus: `HackingLevelMultiplier: 0.5` (`:797`) - angezeigt
6000 entspricht dem Bedarf von Level 12.000 in einem ungedaempften Knoten,
bei M = 6,60 also **1,14e15**. Dazu `HackExpGain: 0.05`, ein Zwanzigstel der
BN1-Rate, und die noetige Farm ist nicht baubar.

Bladeburner: 400.000 geteilt durch `BladeburnerRank: 0.9` = **444.444**
Ranggewinn-Einheiten, elf Prozent mehr als in BN6. `BladeburnerSkillCost: 1.2`
verteuert jeden Skillpunkt um 20 Prozent (`Bladeburner/Skill.ts:78`). Braucht
weder Geld noch Mietrechner - in diesem Knoten der entscheidende Vorteil.

**Der Engpass, hergeleitet:** `CloudServerLimit: 0` (`:810`) laesst
`getCloudServerLimit()` 0 zurueckgeben (`ServerPurchases.ts:92-94`),
`ns.purchaseServer` verweigert **immer**. `ServerMaxMoney: 0.01` mal
`ScriptHackMoney: 0.1` drueckt HWGW auf ein Promille von BN1. Einzig
unangetastet: **BN9 setzt `HacknetNodeMoney` nicht**, der bleibt 1. Maximal
20 Hacknet-Server (`Hacknet/data/Constants.ts`, `MaxServers: 20`) mit Level
300, RAM 8192 und 128 Kernen liefern je 19,1 Hashes je Sekunde
(`Hacknet/formulas/HacknetServers.ts:4-17`) = **382 Hashes/s**. `SellForMoney`
hat Festpreis 4 Hashes je 1 Mio - also **95,5 Mio Dollar je Sekunde**.

Daraus muss home-RAM bezahlt werden, bei `HomeComputerRamCost: 5`:
32 auf 1024 GB = 7,33 Mrd, 32 auf 8192 GB = 232 Mrd, 32 GB auf 1 PB rund
730 Bio.

*Nebenbefund, der einen offenen Punkt schliesst:* Dieselbe Formel mit Faktor
1 ergibt fuer 32 auf 1024 GB **1,466 Mrd** - das reproduziert die als
"[gemessen]" markierte Zahl 1,47 Mrd aus `nodes/ROADMAP.md` 7.4 und schliesst
den offenen Punkt 5 des Audits.

SF9.1 schaltet Hacknet-Server dauerhaft in allen Knoten frei. **SF9.2 gibt
jedem frischen home 128 GB statt 32** (`Prestige.ts:242-243`) - der
eigentliche Ertrag auf einer 45-Laeufe-Route, weil er die "erst Mietrechner
kaufen"-Stufe in rund 28 Restlaeufen streicht. SF9.3 legt bei jedem
Knoteneintritt einen Gratis-Hacknet-Server bei (Level 100, 10 Kerne,
`Prestige.ts:329-339`) = 0,28 Hashes/s = 70.000 Dollar je Sekunde; sein
`maxRam` bleibt 1 GB - eine Geldquelle, kein RAM.

**Die Falle im Detail:** `calculateHashGainRate` multipliziert mit
`ramRatio = 1 - ramUsed/maxRam` (`HacknetServers.ts:11,16`). Ein voll
belegter Hacknet-Server produziert **exakt null Hashes**. In einem Knoten
ohne Mietrechner ist "nimm halt das Hacknet-RAM als Farm" der naheliegende
Zug - und er schaltet das Einkommen ab. **Zweitfalle:** `ns.purchaseServer`
scheitert hier **still**, es loggt und gibt `false` zurueck, es wirft nicht
(`Cloud.ts:51-56`). Eine Wiederanlaufkette, die auf einen Mietrechner
wartet, dreht sich endlos.

---

## BitNode 1 (Plaetze 11-12)

    Ausgangsbedingung: Hacking 3000 + Adminrechte (5 Ports + nuke)
                       ODER 21 Black Ops, Rang 400.000
    Billigerer Weg:    Hacking - der einzige der drei Knoten, wo das gilt
    Engpass:           2,5 Mio Daedalus-Reputation fuer The Red Pill
    SourceFile:        das breiteste im Spiel, +16/24/28 Prozent auf ALLE 26
                       Spieler-Multiplikatoren
    Groesste Falle:    NeuroFlux zaehlt als genau EINE Augmentierung

`case 1` gibt schlicht `new BitNodeMultipliers()` zurueck
(`BitNode.tsx:566-568`) - **jeder Wert auf Default**. Erfahrung fuer Level
3000 bei M = 13,195: **6,30e5**. Bei ungedaempfter Rate ist das unter einer
Sekunde.

Die gesamten Kosten stecken im Daedalus-Sockel - und der ist hier billiger
als irgendwo sonst: `AugmentationMoneyCost` und `-RepCost` sind 1,
`CloudServerSoftcap` ist 1. 25 Cloudserver zu 1 PB kosten **1,44 Bio**, das
billigste RAM der ganzen Route (BN4: 18,5 Bio, BN9: gar nicht).

**Der Engpass:** 2,5 Mio Daedalus-Rep (`Augmentations.ts:1954`). Sie wird
erst nach Favor 150 zur reinen Geldfrage (`Constants.ts:31`), und Favor 150
entspricht **462.500 kumulierter Reputation**
(`Faction/formulas/favor.ts:12-14`) - erarbeitet **vor** dem ersten Einbau,
weil Favor erst beim Prestige gutgeschrieben wird.

SF1 gibt +16 / +24 / +28 Prozent kumulativ (16 + 8 + 4,
`applySourceFile.ts:14-48`) auf **alle 26 Spieler-Multiplikatoren**,
einschliesslich `hacking`, `hacking_exp`, `faction_rep`, `crime_money`,
`work_money` und der vier Hacknet-Kostenmultiplikatoren. Dazu ein frisches
home mit 32 statt 8 GB. **Achtung beim Ertrag:** Lauf 2 bringt nur +8
Prozent, Lauf 3 nur +4 - nicht dreimal 16.

**Die Falle im Detail:** `applyAugmentation` erhoeht bei NeuroFlux nur
`ownedNfg.level` und kehrt vorzeitig zurueck, ohne einen neuen Eintrag zu
pushen (`AugmentationHelpers.ts:54-59`) - waehrend die Daedalus-Einladung
`Player.augmentations.length >= 30` prueft (`FactionInfo.tsx:142`,
`FactionJoinCondition.ts:116-131`). Ein Bot, der NeuroFlux-Level farmt, um
den Hacking-Multiplikator hochzuziehen, erreicht Level 3000 und bekommt
**nie die Einladung** - also nie TRP, also nie die Netzkante zum WD-Server.
**Zweitfalle:** Der k-te Aug einer Einbau-Charge kostet das
1,9^(k-1)-fache (`CONSTANTS.MultipleAugMultiplier`) - 30 Stueck in einer
Charge heisst Faktor 1,2e8 auf den letzten. Die 30 muessen ueber mehrere
Einbauten verteilt werden.

---

## Was der Knotenwechsel mitnimmt

Gilt fuer alle drei Uebergaenge (`Prestige.ts`, `RedPill.tsx`):

**Ueberlebt:** SourceFiles - Sleeve-Anzahl ueber
`min(3, sourceFileLvl(10)) + sleevesFromCovenant`
(`SleeveCovenantPurchases.tsx:62-64`; `sleevesFromCovenant` wird nirgends
zurueckgesetzt) - **Sleeve-Memory**: `prestige()` setzt exp, augs, shock und
sync zurueck, aber nicht `memory`, und `sync = max(memory, 1)`
(`Sleeve.ts:228-253`); kaufbar **nur in BN10** - persistente Intelligence
(`Person.ts:149-174`) - SF1-Multiplikatoren werden neu angewandt.

**Ueberlebt nicht:** alle Augmentierungen inklusive NeuroFlux -
Fraktionsmitgliedschaft **und Favor** (`Prestige.ts:252-253`) - Karma -
Bladeburner samt Rang und Skillpunkten (`:160`) - Geld, es bleiben **1.262
Dollar** (`:102`) - alle Fertigkeiten auf 1 - alle Server und Backdoors -
home faellt auf 32 GB und einen Kern.

---

## Zwei Querbefunde fuer alle drei Knoten

1. **Nach jedem Wechsel steht ein Dialog offen.** `enterBitNode` ruft
   `giveSourceFile` (`RedPill.tsx:67`) **vor** dem Setzen von `bitNodeN`
   (`:70`) und dem Prestige (`:82`), und `giveSourceFile` oeffnet in jedem
   Fall einen `dialogBoxCreate`-Modal (`:30-45`). Der muss weggeklickt
   werden, sonst blockiert er die Oberflaeche. Fuer BN10 kommt beim Eintritt
   zusaetzlich ein `delayedDialog` (`Prestige.ts:305-310`).

2. **Bladeburner ist ueberall verfuegbar, die Doppelarbeit nicht.**
   `canAccessBladeburner()` verlangt nur SF6 **oder** SF7
   (`PlayerObjectBladeburnerMethods.ts:6-8`), und `BladeburnerRank` ist in
   keinem der drei Knoten 0. Aber das **Blade-Simulacrum** - Bladeburner-
   Aktion und normale Arbeit gleichzeitig - gibt es erst ab SF7 Level 3
   (`:13-19`). Bis dahin schliessen Bladeburner-Aktion und Fraktionsarbeit
   einander aus, und jeder Reputationsaufbau laeuft nur ueber Sleeves. BN7
   steht in der Reihenfolge auf Platz 30-32, also weit nach diesen drei.
