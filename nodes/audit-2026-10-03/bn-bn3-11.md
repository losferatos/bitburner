# Audit 03.10.2026 - BitNode-Gruppe BN3 (3.1-3.3) und BN11 (11.1-11.3)

Pruefer BN3/BN11, Stand 2026-10-03 17:44 (Systemzeit). Streng lesend: `src/`
unveraendert, Spiel nicht angefasst, keine git-Operation. Bot-Stand master
`0cc5a80`. Spielquelle 3.0.2 `reference/bitburner-src/src/`. Spielstaende
`backups/LIVE_197f4d61481686_BN2L1_*` (bis 17:17, 12,6 h im Knoten) plus die
V2-Laeufe BN4.2/4.3, BN9.1-9.3, BN10.2/10.3 zum Vergleich.

Rechner (alle `tools/audit/bn311-*.mjs`, nur lesend, Eichung in Abschnitt 7):

| Datei | Was |
|---|---|
| `bn311-mults.mjs` | `src/lib/bitnodes.json` gegen `BitNode.tsx` case 3/11, Feld fuer Feld |
| `bn311-hack.mjs` | Hackertrag BN3/BN11 gegen BN2 mit dem Hacking-Level, den derselbe Spieler im Zielknoten haette (BN11: HLM 0,6, HackExpGain 0,5) |
| `bn311-kaltstart.mjs` | Gratis-Hashserver (SF9.3), erster Mietrechner, Gym-Geld nach dem Sprung |
| `bn311-hosp.mjs` | Krankenhauskosten der Raid-Fehlschlaege gegen das Einkommen in BN3/BN11 |
| `bn311-hnaugs.mjs` | Treppenaufschlag der Hacknet-Augs, Kaufregel des Bots mit/ohne |
| `bn311-crime.mjs` | Sleeve-Verbrechen je Knoten, Spieler-Karmaphase BN11 |
| `bn311-sf.mjs` | SF11-Treppe, Zykluskosten BN3/BN11 |
| `bn311-geld.mjs`, `bn311-sleevegeld.mjs` | Geldquellen aller V2-Laeufe aus `moneySourceB` |

Wiederverwendet: `player-save.mjs`, `hack-save.mjs`, `aug-data.mjs`,
`aug-order.mjs`, `blade-formeln.mjs`, `bn2-verlauf.mjs`; Formeln des Bots aus
`src/lib/calc.js` (bereits gegen `ns.formulas` geeicht, inventar-hack).

---

## Kurzfazit

1. **Der Rangmotor ist in beiden Knoten unbeschaedigt** (BladeburnerRank,
   BladeburnerSkillCost, Kampf-LevelMults, ClassGymExpGain alle 1 - wie BN2/BN4).
   Der Unterschied ist **nur Geld** (und in BN3 Ruf x3). Kaufkraft fuer Augs je
   Stunde gegen BN2.1: **BN3 5-7 %, BN11 1,8-2,4 %** (Hack x0,12-0,17 bzw.
   x0,025-0,036, Augs x3 bzw. x2). Kein bisheriger V2-Lauf war annaehernd so arm
   (BN9.3: 2,4 Mrd/h bei Augs x1; BN3 0,71-0,93, BN11 0,17-0,22 Mrd/h bei x3/x2).
2. **Kaltstart traegt** - die alte Warnung "BN3 87 h, BN11 17 h bis zur Werkbank"
   (`nodes/audit-2026-09-02/knoten.md:24-25,59-63`) ist mit SF9.3 erledigt: der
   Gratis-Hashserver (Formel gegen Spielstand exakt) bringt 28 k$/s (BN3) bzw.
   11 k$/s (BN11); erster 32-GB-Mietrechner nach 1,5/2,2 min, Gym-Geld (5 Mio)
   nach 2,2/6,2 min, Beitritts-Gym 19 min fuer 2,7 Mio $.
3. **`src/lib/bitnodes.json` stimmt** (BN3 20/20, BN11 21/21 Felder), Route,
   Verfahrenswahl (`data/verfahren.txt`) und V2-Ausgang sind knotenneutral richtig.
4. **BN311-1 (RISIKO, P1):** Die Raid-Phase kostet je toedlichem Fehlschlag
   min(10 % Konto, ~44 Mio $). In BN2 ist das der Deckel und 8 % des Einkommens;
   in BN3/BN11 ist es das 10-%-Regime und frisst **29-36 % des Einkommens der
   ersten 12,6 h** (BN3 2,9-3,4 Mrd, BN11 0,74-0,98 Mrd). Gleichgewichtskonto
   waehrend Raids BN3 0,24-0,53 Mrd, BN11 0,03-0,13 Mrd - unter dem Preis fast jeder
   BB-Aug. Die Fixes aus BLADE-1 / SLEEVE-2/3 (mehr Raids) verschaerfen das.
5. **BN311-2 (SUBOPTIMAL, P2):** Der V2-Filter kauft Hacknet-Augs. Im BN2.1-Zyklus
   kosteten die drei Stueck **12,46 Mrd $ Treppenaufschlag (+78 %, exakt geeicht)**
   fuer +0,142 Mrd/h. In BN3/BN11 bringen sie 0,036/0,014 Mrd/h, und der
   Rangtausch, mit dem die Aufnahme begruendet ist, schaltet dort nie frei.
6. **BN311-3 (SUBOPTIMAL, P2):** Die Sleeve-Zuteilung rechnet nur Rang. In
   BN3/BN11 sind Sleeve-Vertraege (ungedaempft, gemessen 0,2-5,5 Mrd/h in
   Mittel-/Spaetphasen frueherer Laeufe) und in BN11 Mug (x3: 0,248 Mrd/h) die
   groessten Geldquellen ueberhaupt.
7. **BN311-4 (NICHT_GENUTZT, P2, zu GANG-3):** In BN11 ist die Gang (nach SF2.3)
   die einzige grosse, ungedaempfte Geldquelle (GangSoftcap 1, Gang-Geld ohne
   CrimeMoney). Die Karmaphase (15-19 h Homicide) verdient in BN11 selbst so viel
   wie das ganze Grundeinkommen.
8. **SF3/SF11 fuer die Restroute:** SF3 ~0 (Corp ausserhalb BN3 netto negativ,
   Charisma/Firmenlohn wertlos in V2). SF11 senkt die Treppe auf 1,824/1,786/1,767:
   bei 8-12-Stueck-Zyklen -32/-49 % (BN6/7/14/13/15/8), bei BN3/BN11-Budgets
   0-1 Stueck. Die Reihenfolge BN3 vor BN11 ist damit neutral.

---

## 1. Multiplikatoren und Sonderregeln

### 1.1 BN3 "Corporatocracy" (`BitNode/BitNode.tsx:593-626`)

| Multiplikator | Wert | Wirkung | Bot beruecksichtigt? |
|---|---|---|---|
| HackingLevelMultiplier | 0,8 (:595) | Hack-Level wie BN2 | live (Spielwert); `bn311-hack.mjs`: Level 408 = BN2 |
| ServerGrowthRate | 0,2 (:597) | grow-Faeden x4 gegen BN1 | ja, `src/bn4net.js:130-152` (liest `lib/bitnodes.json`) |
| ServerMaxMoney | 0,04 (:598) | moneyMax x0,04 | live `getServerMaxMoney` |
| ServerStartingMoney | 0,2 (:599) | Startfuellung 20 % -> Vorbereitung | live, prepSec in `src/lib/calc.js` |
| HomeComputerRamCost | 1,5 (:601) | home-RAM x1,5 | ja, `src/homegrow.js:116` live (`src/homeram.js:289` fest 1,5, aber tot, INFRA-6) |
| CloudServerCost | 2 (:603) | Mietrechner x2 (32 GB 3,52 Mio) | ja, `src/shop.js:150-160` -> `data/preise.json`, Leiter `src/bn4net.js:1306-1349` |
| CloudServerSoftcap | 1,3 (:604) | grosse Rechner teurer | dito |
| CompanyWorkMoney | 0,25 (:606) | Firmenlohn | V2 ohne Firmenarbeit - n/a |
| CrimeMoney | 0,25 (:607) | Mug je Sleeve 1.916 $/s | V2 ohne Verbrechen nach Kaltstart - richtig |
| HacknetNodeMoney | 0,25 (:608) | Hashrate x0,25 (Gratis-Server 28 k$/s) | `src/hashes.js` live; aber Hacknet-Augs im V2-Filter -> **BN311-2** |
| ScriptHackMoney | 0,2 (:609) | Beute je Faden x0,2 | ja, `src/bn4net.js:149` |
| FavorToDonateToFaction | 0,5 (:611) | Spende ab Favor 75 | live `src/bn4rep.js:1125,1154`; in V2 ohne Bedeutung (Bladeburners nimmt keine Spende) |
| AugmentationMoneyCost | 3 (:613) | Augs x3 | live `src/bn4rep.js:675-676` |
| AugmentationRepCost | 3 (:614) | Ruf x3: alle BB-Augs bis 187.500 Ruf = ~70.600 Rang bei faction_rep 1,33, Favor 0 (`Bladeburner/Formulas.ts:46-49`; BN2: 23.500) | live; kein Hebel ausser Graft (AUG-1: Graft ohne Ruf) |
| GangSoftcap / GangUniqueAugs | 0,9 / 0,5 (:616-617) | Gang schwaecher, Sortiment 74/73/81 Augs | keine Gang (GANG-3) |
| StaneksGift* | 0,75 / -2 (:619-620) | Stanek | SF13 fehlt - n/a |
| DarknetMoneyMultiplier | 0,4 (:622) | Darknet-Geld | kein Gewerk - n/a |
| WorldDaemonDifficulty | 2 (:624) | V1-Ziel 6.000 | V2-Ausgang ueber Black Ops (`NetscriptFunctions/Singularity.ts:1154-1159`) - n/a |
| (nicht gesetzt) BladeburnerRank / SkillCost | 1 / 1 | Rangmotor wie BN2 | `src/blade.js:803` live |
| (nicht gesetzt) CodingContractMoney | 1 | Vertraege ungedaempft (BN2.1: 0,118 Mrd/h) | `contracts.js` (Registry "alle") |
| (nicht gesetzt) Kampf-LevelMults, ClassGymExpGain | 1 | Beitritt 19 min Gym | `src/bbtrain.js` |
| Sonderregel Seed-Gruendung | `Corporation/helpers.ts:71-78`, `Actions.ts:64-66` | 150 Mrd Corp-Kasse gratis | **fehlt -> CORP-1** (inventar-corp) |
| Sonderregel Corp-API gratis | `PlayerObjectCorporationMethods.ts:21` | Office/Warehouse ohne Unlock | fehlt (CORP) |
| Sonderregel Handbuch + Dialog | `Prestige.ts:147-150, 273-283` | Dialog beim Knotenstart | `src/popups.js` (Escape leert AlertManager) - ok |

### 1.2 BN11 "The Big Crash" (`BitNode/BitNode.tsx:883-916`)

| Multiplikator | Wert | Wirkung | Bot beruecksichtigt? |
|---|---|---|---|
| HackingLevelMultiplier | 0,6 (:885) | Level 285 statt 408 (gleiche Exp) | live; im Ertrag `bn311-hack.mjs` |
| ServerGrowthRate | 0,2 (:887) | wie BN3 | `src/bn4net.js:150` |
| ServerMaxMoney | 0,01 (:888) | moneyMax x0,01 | live |
| ServerStartingMoney | 0,1 (:889) | Startfuellung 40 % (relativ zu Max) | live |
| ServerWeakenRate | 2 (:890) | weaken doppelt | ja, `src/bn4net.js:151` (H1) |
| CloudServerSoftcap | 2 (:892) | 1024 GB = 901 Mio | live Preise |
| CompanyWorkMoney | 0,5 (:894) | - | n/a |
| CrimeMoney | 3 (:895) | Mug je Sleeve 22.991 $/s | **nicht genutzt (V2) -> BN311-3** |
| HacknetNodeMoney | 0,1 (:896) | Gratis-Server 11 k$/s | Hacknet-Augs -> **BN311-2** |
| CodingContractMoney | 0,25 (:897) | Vertraege 0,03 Mrd/h | `contracts.js` |
| HackExpGain | 0,5 (:899) | Level tiefer; V2 egal (Hacking-Gewicht <= 0,25 der Aktionen, Kompetenz -1,2 %) | n/a |
| AugmentationMoneyCost | 2 (:901) | Augs x2 | live |
| InfiltrationMoney / Rep | 2,5 / 2,5 (:903-904) | Infiltration lohnt hier am meisten | **n/a:** synthetische Tasten hospitalisieren (`AUFTRAG-BAU-2026-09.md` Abschnitt 12, `InfiltrationRoot.tsx:74`) |
| FourSigma* | 4 / 4 (:906-907) | 4S teurer | `boerse.js` nur BN8 - n/a |
| CorporationValuation / Softcap / Divisions | 0,1 / 0,9 / 0,9 (:909-911) | Corp nur selbstfinanziert, -132,5 Mrd netto (inventar-corp 5.) | n/a |
| GangUniqueAugs | 0,75 (:913) | Gang-Sortiment 91/87/87 | keine Gang -> **BN311-4** |
| (nicht gesetzt) GangSoftcap | 1 | Gang-Geld wie BN2 | -> BN311-4 |
| WorldDaemonDifficulty | 1,5 (:915) | V1-Ziel 4.500 | n/a |
| (nicht gesetzt) BladeburnerRank/SkillCost, Kampf-Mults, ClassGymExpGain | 1 | Rangmotor wie BN2 | `src/blade.js:803` |

### 1.3 Abgleich `src/lib/bitnodes.json` (`bn311-mults.mjs`)

    BN3: 20 Felder, 20 gleich, 0 abweichend
    BN11: 21 Felder, 21 gleich, 0 abweichend

## 2. Freigeschaltet, entwertet, aufgewertet, gesperrt

**BN3** - freigeschaltet: Corporation (Seed gratis, API gratis), mit SF2 die Gang
(Karma -54.000). Entwertet: Hacken (x0,12-0,17 gegen BN2), Hacknet x0,25,
Verbrechen x0,25, Firmenlohn x0,25, Darknet x0,4, Stanek, Augs Geld x3 und Ruf x3,
home-RAM x1,5, Mietrechner x2. Unveraendert: Bladeburner (Rang, Skills, Gym),
Codingvertraege, Bladeburner-Vertragsgeld (ohne BN-Faktor, `Bladeburner.ts:933-940`).
Aufgewertet: nichts ausser Spendenschwelle 75 (V2 irrelevant). Gesperrt: nichts.

**BN11** - entwertet: Hacken (x0,025-0,036), Hacknet x0,1, Vertraege x0,25,
Firmenlohn x0,5, Corp-Bewertung x0,1, Augs x2, Hacking-Exp x0,5. Aufgewertet:
**Verbrechen x3**, Infiltration x2,5 (Geld und Ruf), weaken x2. Unveraendert:
Bladeburner, Bladeburner-Vertragsgeld, Gang-Geld (Softcap 1). Gesperrt: nichts.

## 3. Was bringen SF3 und SF11 der Restroute (BN6.2 ... BN8.3)

- **SF3** (`SourceFile/applySourceFile.ts:62-72`): Charisma und `work_money`
  +8/12/14 % - in V2 ohne Rangwert. Corp ausserhalb BN3 (`PlayerObjectCorporationMethods.ts:8-10`)
  nur selbstfinanziert, in allen Restknoten netto -80 bis -150 Mrd (inventar-corp 5.).
  SF3.3 (volle API) braucht niemand. **Wert fuer die Route: ~0.**
- **SF11** (`applySourceFile.ts:153-163`, `AugmentationHelpers.ts:29-31`,
  `Work/Formulas.ts:131-132`): Firmenlohn/-ruf +32/48/56 % und Favor-Lohn - in V2
  wertlos. Treppe 1,9 x [1; 0,96; 0,94; 0,93] = 1,824 / 1,786 / 1,767, ab BN11.2.
  `bn311-sf.mjs` (Zyklus aus den n teuersten BB-Augs, teuerste zuerst):

      n    x1 SF11.0 -> SF11.3     |  BN3 (x3) SF11.0  SF11.3
      3        98,6 ->    91,0 (-8 %)  |      295,7    273,0
      5       281,5 ->   232,1 (-18 %) |      844,6    696,3
      8      1168,1 ->   790,1 (-32 %) |     3504,3   2370,2
      12     7120,8 ->  3640,1 (-49 %) |    21362,5  10920,2   (Mrd $)

      Stueckzahl bei festem Budget (billigste zuerst):
      Budget   2 Mrd:  BN2 3 | BN3 SF11.0 2  SF11.3 2 | BN11.1 2  BN11.3 2
      Budget   5 Mrd:  BN2 4 | BN3 SF11.0 2  SF11.3 3 | BN11.1 3  BN11.3 3
      Budget  10 Mrd:  BN2 5 | BN3 SF11.0 3  SF11.3 3 | BN11.1 4  BN11.3 4
      Budget  30 Mrd:  BN2 6 | BN3 SF11.0 5  SF11.3 5 | BN11.1 5  BN11.3 5

  SF11 wirkt erst bei grossen Zyklen - also in den geldreichen Knoten BN6/7/14/15
  und im V1-Knoten BN8 (dort NFG-Schleife). Der Bot liest Preise live
  (`src/bn4rep.js:675-676`), keine Anpassung noetig.
- **Reihenfolge BN3 <-> BN11:** SF11 aendert bei BN3-Budgets 0-1 Stueck, SF3 nuetzt
  BN11 nichts. Kein Zahlenargument fuer einen Tausch (Sache des Praemissen-Skeptikers).

## 4. Pruefung je Phase

| Phase | BN3 | BN11 | Bot |
|---|---|---|---|
| Sprung -> Kaltstart | Gratis-Hashserver (SF9.3, `Prestige.ts:327-339`) 28.122 $/s + Hack 10.573 $/s; 32 GB nach 1,5 min, 5 Mio nach 2,2 min, 50 Mio (Hash -> Gym) nach 21,5 min | 11.249 + 2.221 $/s; 2,2 / 6,2 / 61,9 min | ok. Alte Warnung knoten.md (87 h / 17 h) erledigt |
| Aufbau bis Beitritt | Kampf 100 bei Mult 1,43: 4.072 Exp je Wert, 19 min Gym, 2,7 Mio $ | dito | ok (`bbtrain.js` GYM_MIN_GELD 5 Mio) |
| Laufphase (Raid) | Krankenhaussteuer 29-33 % des Einkommens | 34-36 % | **BN311-1** |
| Einbauzyklus | Kaufkraft 5-7 % von BN2; Hacknet-Augs kosten 1-2 Kampfstuecke | 1,8-2,4 %; dito | **BN311-2**; nach dem 1. Einbau ist der Gratis-Server weg (`PlayerObjectGeneralMethods.ts:130`): -0,091 / -0,036 Mrd/h |
| Mittel-/Spaetphase | Sleeve-Vertragsgeld 0,2-5,5 Mrd/h (ungedaempft) = groesste Quelle | dito, plus Mug x3 | **BN311-3** |
| Endspiel | Black Ops identisch (BladeburnerRank 1, Feuerschwellen ENTSCHIEDEN) | dito | ok |
| Ausgang/Sprung | `src/route.json` 3.1-3.3, 11.1-11.3 V2; Ausgang ueber `numBlackOpsComplete` | dito | ok (`src/ausgang.js:207-242`, `src/lib/route.js:51-75`) |

## 5. Geldquellen - gemessen und hochgerechnet

### 5.1 Gemessen in den V2-Laeufen (`bn311-geld.mjs`, moneySourceB, Mrd $)

    Lauf               h   bladeb  hacking  sleeves  contr  hacknet  hosp   augs  servers  Einnahmen
    BN4.2 bis Ende   45,9     0,5    151,8     21,1    6,2     0,0   -0,2  -74,6   -79,5    179,6
    BN4.3 17 BO      51,7     5,4    184,5     14,1    4,9     0,0   -0,2 -149,0   -24,1    208,8
    BN9.1           100,8     0,9      0,7     41,2   11,9   351,1   -4,1  -85,3   -87,0    405,9
    BN9.2            81,7     3,8      0,6     55,7    5,5   357,1   -3,2 -173,2    -2,3    422,9
    BN9.3            53,6     1,6      0,4     27,8    5,4    93,9   -0,7  -68,9    -9,6    129,2
    BN10.3 19 BO     91,8     0,3   1245,5     79,0    5,3     0,0  -87,5 -969,0  -155,7   1330,0
    BN2.1 laufend    12,6     0,0     52,8     -0,0    1,5     4,6   -4,7  -28,4   -22,5     58,9

Sleeve-Geld je Fenster (`bn311-sleevegeld.mjs`; in V2 Bladeburner-Vertragsgeld der
Sleeves, ohne BN-Faktor): frueh -0,026 Mrd/h (= 3 x 2.400 $/s Gym, exakt), mittel
0,2-0,5 Mrd/h (Vertragsstufen 40-60), spaet 1,0-5,5 Mrd/h (Stufen 60-80). BN2.1
seit D5 (Sleeves auf Infiltrate): 0,001 Mrd/h zwischen 5,3 und 12,6 h.

### 5.2 BN3/BN11 je Stunde (Grundlage BN2.1-Mittel 0-12,6 h)

| Quelle | BN2.1 gemessen | Faktor BN3 | BN3 Mrd/h | Faktor BN11 | BN11 Mrd/h | Fundstelle Faktor |
|---|---|---|---|---|---|---|
| Hacken | 4,20 | 0,119-0,172 | 0,50-0,72 | 0,025-0,036 | 0,105-0,151 | `bn311-hack.mjs` (Modell = `src/lib/calc.js`) |
| Hashverkauf (Gratis-Server, nur bis 1. Einbau) | 0,363 | 0,25 | 0,091 | 0,1 | 0,036 | `HacknetServers.ts:16` |
| Codingvertraege | 0,118 | 1 | 0,118 | 0,25 | 0,030 | `PlayerObjectGeneralMethods.ts:559-561` |
| Sleeves (heute Infiltrate) | ~0 | 1 | ~0 | 1 | ~0 | `Bladeburner.ts:933-940` |
| **Summe** | **4,68** | | **0,71-0,93** | | **0,17-0,22** | |
| Kaufkraft (/AugMoneyCost) gegen BN2 | 100 % | | **5-7 %** | | **1,8-2,4 %** | |
| zusaetzlich moeglich | | Corp-Seed 104,4 Mrd einmalig (CORP-1) | | Sleeves Mug +0,248; Gang | | |

## 6. Befunde

### BN311-1 (RISIKO, P1) - Krankenhaussteuer der Raid-Phasen frisst in BN3/BN11 ein Drittel des Einkommens

- **Bot:** `src/blade.js:3601-3611` - Operationen ohne Sicherheitsschwelle, solange
  `geld*0,1 >= hpMax*1e5` (bei hpMax 28: ab 28 Mio Konto); `src/blade.js:4360-4367`
  freiwillige Heilung. Die Raid-Wahl selbst rechnet nur Rang (`beste()`), Geld ist
  ein Ja/Nein-Schalter (Kommentar `:3593-3599`).
- **Spiel:** Fehlschlag mit hpLoss: Schaden `ceil(addOffset(hpLoss*diffMult,10))`
  (`Bladeburner/Bladeburner.ts:981-988`), `takeDamage` -> hp <= 0 -> `hospitalize`
  (`PersonObjects/Player/PlayerObjectGeneralMethods.ts:266-290`), Kosten
  `min(0,1*Konto, (hpMax - hp + Schaden)*1e5)` (`Hospital/Hospital.ts:4-10`). Raid L1-L8
  387-438 HP, Assassination L10 65 HP, Typhoon 1.148 HP gegen hpMax 21-28: jeder
  Fehlschlag ist toedlich. Kein BN-Faktor auf Schaden oder Kosten.
- **Eichung:** BN2.1 09:19 -> 09:59, nur Raid L5, 22 Fehlschlaege: Soll (Spielstand)
  0,950 Mrd, Ist 22 x 44,3 Mio = 0,975 Mrd (+2,6 %, addOffset +-10 %).
- **Rechnung** (`bn311-hosp.mjs`): toedliche Fehlschlaege je Fenster aus der
  BN2.1-Buchung (12/h, 27/h, 27/h, 8/h, 19-35/h bis 5,3 h, danach ~0), Einkommen je
  Fenster x Knotenfaktor, keine weiteren Ausgaben:

      Szenario                 Einkommen  Krankenhaus  Rest   Anteil   Konto bei 5,3 h
      BN2 (eigenes Eink.)        58,68       4,42     54,26     8 %     21,53 Mrd
      BN3 Hack 0,172             11,67       3,36      8,31    29 %      1,30 Mrd
      BN3 Hack 0,119              8,88       2,94      5,94    33 %      0,43 Mrd
      BN11 Hack 0,036             2,72       0,98      1,74    36 %      0,10 Mrd
      BN11 Hack 0,025             2,14       0,74      1,41    34 %      0,08 Mrd

      Gleichgewicht waehrend Raids (M* = I/(0,1 f)):
      BN2  4,7 Mrd/h: f=15 3,13 Mrd (Deckel) | f=33 1,42 (Deckel) | f=60 0,78 (Deckel)
      BN3  0,8 Mrd/h: f=15 0,53 Mrd          | f=33 0,24 (10 %)   | f=60 0,13 (10 %)
      BN11 0,2 Mrd/h: f=15 0,13 Mrd (10 %)   | f=33 0,06 (10 %)   | f=60 0,03 (10 %)

  Im 10-%-Regime geht im Gleichgewicht **das ganze Einkommen** ins Krankenhaus.
  BB-Augs kosten in BN3 ab 0,495 Mrd (EsperTech x3), in BN11 ab 0,33 Mrd: waehrend
  einer Raid-Phase mit f >= 15/h ist dort keins erreichbar.
- **Wechselwirkung:** BLADE-1 (Volhaven, ~42 Raids/h) und SLEEVE-2/3 (Infiltrate,
  +30 Raids/h je Sleeve) heben f. In BN2 kostet das im Deckelregime ~1,3 Mrd/h je
  30 zusaetzliche Fehlschlaege - in BN3/BN11 waere die Raid-Phase dauerhaft und
  das Sparen auf Augs unmoeglich, solange Raids laufen. Umgekehrt hebt der
  BLADE-4-Fix (Deckel = Schaden x 1e5 ~ 44 Mio) die Geldknapp-Schwelle auf ~440 Mio:
  in BN3/BN11 waeren Raids dann die meiste Zeit gesperrt - Rangverlust, den
  niemand gerechnet hat.
- **Ertrag:** BN3 2,9-3,4 Mrd, BN11 0,74-0,98 Mrd je Lauf in den ersten 12,6 h
  (~4 h Einkommen). GERECHNET_UNGEEICHT (Kostenformel geeicht, Einkommensprojektion nicht).
- **known_before:** inventar-blade BLADE-4 (falsche Obergrenze im Riegel);
  `nodes/BAUSTELLEN.md:1606-1609` ("HP kein ernsthafter Kostenposten" - galt vor
  D4 bei 197 Mrd Konto). Neu: knotenbezogene Rechnung, Gleichgewicht, Wechselwirkung.
- **calc_spec:** Wechselkurs Geld -> Rang je Knoten: (a) Kaufregel `bn311-hnaugs.mjs`
  `botBuys` je Budget, (b) competence-Gewinn je Stueck (`Bladeburner/Actions/Action.ts:169-196`,
  `tools/audit/aug-graft.mjs`), (c) Rang/h ~ competence^k mit `tools/bbrank/sim.mjs`,
  geeicht gegen BN2.1 (329 Rang/h 08:33-09:59) und BN9.3-Rangkurve; dann Raid nur, wenn
  `p*Rang_Erfolg - (1-p)*Rangverlust > (1-p)*min(0,1*M, (hpMax+Schaden)*1e5) * Wert_Geld`.

### BN311-2 (SUBOPTIMAL, P2) - Hacknet-Augs im V2-Filter: +78 % Treppe fuer nahezu nichts

- **Bot:** `src/lib/hackaugs.js:346-350` (`kampfknotenNuetzlich`: Hacknet-Augs, sobald
  `mitHashes`), `src/bn4rep.js:655-672` (`mitHashes` = BN9 oder SF9 - also jeder
  V2-Knoten der Restroute). Begruendung `src/lib/hackaugs.js:328-330`: "hashes.js
  tauscht Hashes in jedem V2-Knoten in Rang". Das stimmt nur oberhalb
  `RANG_AB_GELD`: `src/hashes.js:98,242` (`geld - ruecklage > 1e9`).
- **Spiel:** Treppe `1,9^q` je wartendem Stueck (`Augmentation/AugmentationHelpers.ts:29-37`);
  Hashrate x HacknetNodeMoney (`Hacknet/formulas/HacknetServers.ts:16`; BN3 0,25
  `BitNode.tsx:608`, BN11 0,1 `:896`); der Gratis-Server verschwindet beim ersten
  Einbau (`PlayerObjectGeneralMethods.ts:130`).
- **Eichung:** Summe der BN2.1-Warteschlange in Kaufreihenfolge 28,404839550 Mrd =
  `moneySourceB.augmentations` im Spielstand 17:17 (exakt).
- **Rechnung** (`bn311-hnaugs.mjs`): ohne die drei Hacknet-Stuecke (NIC, CPU, Cache)
  kostet dieselbe Reihenfolge 15,95 Mrd -> **Treppenaufschlag 12,46 Mrd (+78 %)**.
  Nutzen: hacknet_node_money x1,391 -> BN2 +0,142 Mrd/h, BN3 +0,036, BN11 +0,014
  (und nur bis zum naechsten Einbau voll, solange Hashes verkauft werden).
  Kaufregel des Bots (teuerste bezahlbare zuerst, Geld in kleinen Schritten):

      Knoten  Budget   mit Hacknet: Stuecke (davon Kampf)   ohne: Kampfstuecke
      BN2      5,0       7 (4)                                5
      BN2     28,4       8 (5)                                7
      BN3      3,0       6 (3)                                5
      BN3      9,0       7 (4)                                5
      BN11     1,0       5 (2)                                4
      BN11     6,0       7 (4)                                5

  In BN3/BN11 schaltet der Rangtausch praktisch nie frei (Konto im Raid-Gleichgewicht
  0,03-0,53 Mrd, BN311-1) - die Begruendung des Filters faellt dort ganz weg.
- **Ertrag:** +1 bis +2 Kampfstuecke je Einbauzyklus in BN3/BN11; im gemessenen
  BN2.1-Zyklus 12,46 Mrd. GERECHNET_GEEICHT (Treppe exakt gegen Spielstand; die
  Stueckzahl ist ein Modell der Kaufregel).
- **Fix-Richtung:** `mitHashes` nur in BN9 oder wenn der Rangtausch in diesem Zyklus
  tatsaechlich lief (`data/hashes.json` rangAusHashes > 0); sonst Hacknet-Augs nur als
  letztes Stueck vor dem Einbau (q am Ende). Damit entfaellt auch der
  Netburners-Beitritt (`src/netburn.js`, 98,8 Mio je Zyklus) in BN3/BN11.
- **known_before:** inventar-aug AUG-4 (Filter qualitativ: "Hacknet-Stuecke mit SF9,
  ohne Wert je Warteschlangenplatz"); `nodes/BAUSTELLEN.md:550` (b) (V1-Fall).

### BN311-3 (SUBOPTIMAL, P2) - Sleeve-Zuteilung rechnet nur Rang; in BN3/BN11 sind Sleeves die groesste Geldquelle

- **Bot:** `src/sleeve.js:626` (KONTRAKT_MIN_KAMPF 40), `:661-853` (V2: Vertraege,
  D5-Infiltrate, Gym), `:368` (`OHNE_VERBRECHENSGELD = [8]` - einziger Knotenbezug),
  `:919-930` (Verbrechen nur als Armuts-Rueckfall). Die Sleeve-Pruefer-Vorschlaege
  SLEEVE-2/3 (Infiltrate/Diplomacy ab Beitritt) sind ebenfalls rein rangbewertet.
- **Spiel:** Sleeve-Vertragsgeld `250e3 * rewardFac^(L-1)` ohne BN-Faktor
  (`Bladeburner/Bladeburner.ts:933-940`, Buchung `PersonObjects/Sleeve/Work/Work.ts:19`);
  Sleeve-Verbrechen `money * crime_money * CrimeMoney`, nicht schockskaliert
  (`Work/Formulas.ts:58-79`, `SleeveCrimeWork.ts:29-50`); BN11 CrimeMoney 3
  (`BitNode.tsx:895`); Infiltrate/Diplomacy bringen 0 $.
- **Rechnung:** (a) gemessen (`bn311-sleevegeld.mjs`): Sleeve-Geld in Mittelphasen
  0,2-0,5 Mrd/h, in Spaetphasen 1,0-5,5 Mrd/h (BN4.2, BN4.3, BN9.1-9.3, BN10.2/10.3);
  BN2.1 seit D5 0,001 Mrd/h. In BN3 ist das das 0,2- bis 8-fache, in BN11 das 0,9- bis
  32-fache des uebrigen Einkommens (5.2). (b) `bn311-crime.mjs`: Sleeve mit Kampf 40,
  int 24: Mug p 0,85 = 22.991 $/s, 3 Sleeves **0,248 Mrd/h in BN11** (+113-146 % des
  BN11-Einkommens), in BN3 nur 0,021 Mrd/h. Eichung Homicide-Chance 0,211 gegen 0,21
  der Sleeve-Pruefer-Rechnung (Formel, kein Spielwert).
- **Gegenseite:** Infiltrate/Diplomacy +117 Rang/h (SLEEVE-3, frueh), Infiltrate als
  Assassination-Nachschub in der Op-Phase (SLEEVE-1: bis ~26.000 Rang je Stunde
  Op-Phase) - der Rangwert ist spaet gross, der Geldwert auch.
- **Ertrag:** BN11 +0,25 Mrd/h frueh (Mug), BN3/BN11 0,2-5,5 Mrd/h mittel/spaet
  (Vertraege statt Infiltrate) gegen 0,17-0,93 Mrd/h Rest. GERECHNET_UNGEEICHT
  (Verbrechen) bzw. gemessen (Vertragsgeld), Rangseite offen.
- **calc_spec:** Rang je Sleeve-Stunde je Aufgabe (`tools/audit/sleeve-lp.mjs`,
  Stand BN2.1) gegen Geld je Sleeve-Stunde (oben) mal Wechselkurs Geld -> Rang aus
  BN311-1; Ergebnis als knotenabhaengige Regel ("in BN3/BN11 Vertraege/Mug, solange
  Wert_Geld x $/h > Wert_Rang x Rang/h").
- **known_before:** inventar-sleeve SLEEVE-1/2/3 (Rang), Audit 26.09. D5. Neu: Geldseite.

### BN311-4 (NICHT_GENUTZT, P2) - BN11: Gang als einzige ungedaempfte Geldquelle (zu GANG-3)

- **Bot:** fehlt (`grep ns.gang src/` = 0); `nodes/AUFTRAG-BAU-2026-09.md` Abschnitt 12
  "Keine Gang-/Corporation-Gewerke".
- **Spiel:** Zugang ausserhalb BN2 mit SF2 und Karma <= -54.000
  (`PersonObjects/Player/PlayerObjectGangMethods.ts:12-30`); Gang-Geld
  `pow(5*baseMoney*..., (0,2*territory+0,8)*GangSoftcap)` OHNE CrimeMoney
  (`Gang/formulas/formulas.ts:56-73`); BN11 GangSoftcap 1 (nicht gesetzt),
  GangUniqueAugs 0,75 (`BitNode.tsx:913`); Karma je Verbrechen x Fokusfaktor,
  Fehlschlag /4 (`Work/CrimeWork.ts:64-84`); SF2.3 crime_success/crime_money x1,42
  (`SourceFile/applySourceFile.ts` case 2).
- **Rechnung** (`bn311-crime.mjs`): Spieler-Homicide in BN11 nach SF2.3: p 0,80 (Kampf
  100) bis 1,00 (Kampf 190), Karma 2.888-3.600/h -> **-54.000 nach 15-19 h** (ohne
  Fokus x1,25), Geld dabei **0,185-0,230 Mrd/h** - so viel wie das ganze uebrige
  BN11-Einkommen. Gang-Geld laut `gang-sim.mjs` (Softcap 1 = BN2-Formel, ungeeicht):
  48,8 Mrd nach 8 h ab Gruendung (17,4 Mrd/h), 466,8 Mrd nach 20 h.
- **Andere Bewertung als GANG-3** ("BN11 0 bis -10 h"): GANG-3 rechnet die
  Karmaphase als reinen Verlust und vergleicht nicht mit dem BN11-Grundeinkommen.
  In BN11 ist die Alternative 0,17-0,22 Mrd/h; die Karmaphase verdient genauso
  viel, und danach liegt das Gang-Geld zwei Groessenordnungen darueber. Die Kosten
  sind 15-19 h ohne Bladeburner-Aktion (fruehe Rangrate 180-590/h, BN2.1).
- **Ertrag:** GESCHAETZT: BN11 ist nach BN15 der Knoten, in dem die Gang am meisten
  bringt; Vorzeichen fuer BN11 eher deutlich negativ in Stunden (schneller), Hoehe
  offen.
- **calc_spec:** Laufmodell BN11 mit/ohne Gang: Rangverlust waehrend 15-19 h
  Homicide (Rangmodell `tools/bbrank/sim.mjs`, Kurve BN2.1/BN9.3) gegen
  Aug-Kaufkraft aus Gang-Geld (`gang-sim.mjs` Softcap 1, Angebot `gang-augs.mjs`
  `exactGangOffer(11, sf, 0,75)`, `gang-round.mjs` mit AugMoneyCost 2) und Gang-Ruf
  (1,25 Mio nach 8,6 h) -> h bis 21 Black Ops. Erst nach GANG-1/2 (BN2) entscheiden.
- **known_before:** inventar-gang GANG-3; AUFTRAG-BAU Abschnitt 12.

## 7. Rechnungen und Eichung (Soll/Ist)

| Groesse | Rechner | Soll (Spielstand/Spiel) | Ist |
|---|---|---|---|
| bitnodes.json gegen BitNode.tsx | `bn311-mults.mjs` | BN3 20, BN11 21 Felder | 20/20, 21/21 gleich |
| Hacking-Level aus Exp (`skill.ts:7-15`) | `bn311-hack.mjs` | 408 (17:17), 257 (05:33) | 408, 257 |
| Hashrate Gratis-Server (`HacknetServers.ts:4-17`) | `bn311-kaltstart.mjs` | 0,449945/s | 0,449945/s |
| Gym-Kosten 3 Sleeves (`Work/Formulas.ts:100-105`) | `bn311-sleevegeld.mjs` | -0,026 Mrd/h (BN2.1 0,8-3,9 h, BN9.3 0,1-5,5 h) | 3 x 2.400 $/s = 0,0259 Mrd/h |
| Krankenhaus Raid L5 (`Hospital.ts:4-10`) | `bn311-hosp.mjs` | 0,950 Mrd (09:19-09:59) | 0,975 Mrd (+2,6 %) |
| Augsumme in Kaufreihenfolge (`AugmentationHelpers.ts:29-37`) | `bn311-hnaugs.mjs`, `bn311-sf.mjs` | 28,404839550 Mrd (17:17), 2,491975 Mrd (09:59) | 28,404839550, 2,491975 |
| Homicide-Chance Sleeve (`Crime.ts:120-136`) | `bn311-crime.mjs` | 0,21 (Sleeve-Pruefer) | 0,211 |

Hackertrag relativ zu BN2 (gleicher Speicher 6.745 GB):

    Stand 17:17 (Level 408): BN3 0,172; BN11 0,050 bei BN2-Level, 0,036 bei Knoten-Level 285
    Stand 05:33 (Level 257, 1.500 GB): BN3 0,119; BN11 0,040 / 0,025 bei Level 172

## 8. Ergaenzungen und Widersprueche zu den Bereichsberichten

- **CORP-1 (inventar-corp):** bestaetigt und eingeordnet. 104,4 Mrd Seed-Auszahlung
  sind 112-147 h BN3-Einkommen (5.2) und mehr als zehn erste Zyklen (Budget 6-9 Mrd).
  Zusatz: mehr als ~0,44 Mrd Bargeld schiebt BN3 vom 10-%-Regime in den Deckel
  (BN311-1) - Krankenhaus dann ~44 Mio je Fehlschlag statt 10 %. Die Anteile selbst
  sind krankenhausfest; der Tranchenverkauf direkt vor dem Kauf (CORP-4 d) ist
  deshalb doppelt richtig. Verkaufssperre 1 h (CORP-4 e) begrenzt die Tranchen.
- **GANG-3:** fuer BN11 andere Bewertung, siehe BN311-4.
- **AUG-1 (Grafting):** in BN3 doppelt stark - Graft kennt weder AugmentationRepCost 3
  noch die Treppe; in BN3 ist der Kauf des ersten Stuecks schon so teuer wie der Graft.
- **BLADE-4 / SLEEVE-2/3 / BLADE-1:** Geldseite der Raid- und Sleeve-Entscheidungen
  fehlt, in BN3/BN11 entscheidend (BN311-1, BN311-3).
- **inventar-hack 4.5:** BN11-Faktor 0,05 ist eine obere Schranke; mit dem
  Knoten-Level (HLM 0,6, HackExpGain 0,5) 0,025-0,036.
- **nodes/audit-2026-09-02/knoten.md:24-25, 59-63 ("Kaltstart BN3 2-4 Tage, BN11
  ~1 Tag"):** mit SF9.3 ueberholt (Abschnitt 4). Auch "BLADE_KNOTEN fehlt 3/11" ist
  erledigt (Verfahren aus `route.json`, `src/bn4rep.js:109-139`).
- **ROADMAP.md:410-411 ("BN3/BN11 je 29 h"):** mit 5-7 % bzw. 1,8-2,4 % der
  BN2-Kaufkraft nicht belegbar; alle gemessenen V2-Laeufe lagen bei 46-106 h mit
  2,4-14,5 Mrd/h. Offene Frage, keine Zahl.

## 9. Abdeckungsmatrix (BN3/BN11-spezifisch, 33 Zeilen)

| Kategorie | Zahl | Zeilen |
|---|---|---|
| OPTIMAL | 17 | HLM, ServerGrowthRate, ServerMax/StartingMoney, ServerWeakenRate, ScriptHackMoney, HomeComputerRamCost, CloudServerCost/Softcap, CrimeMoney BN3 (Nichtnutzung richtig), CodingContractMoney, AugmentationMoneyCost, AugmentationRepCost, Bladeburner-Mults, Kaltstart-Geld, Beitritts-Gym, Route/Verfahren/Ausgang, Handbuch-Dialog BN3, SF11-Preise live |
| GENUTZT-SUBOPTIMAL | 2 | HacknetNodeMoney/Hacknet-Augs (BN311-2), Raid-Entscheidung gegen Krankenhaus (BN311-1) |
| NICHT GENUTZT | 3 | CrimeMoney BN11 / Sleeve-Geld (BN311-3), Gang (BN311-4, GANG-3), Corp-Seed BN3 (CORP-1) |
| GENUTZT-TOT | 0 | - |
| NICHT ANWENDBAR | 11 | HackExpGain, CompanyWorkMoney, FavorToDonate, Stanek, Darknet-Geld, WorldDaemonDifficulty, Infiltration (synthetische Tasten), 4S, Corp BN11, SF3-Bonus, Gratis-Server nach Einbau (Spielregel) |

(BN311-3 ist inhaltlich SUBOPTIMAL - die Sleeves sind genutzt -, in der Matrix
aber als "CrimeMoney BN11 nicht genutzt" gezaehlt.)

## 10. Offene Fragen

1. Wechselkurs Geld -> Rang je V2-Knoten (calc_spec BN311-1) - gemeinsame Grundlage
   fuer BLADE-4, BN311-1, BN311-3, CORP-1 (Stunden) und AUG-1.
2. Laufdauer BN3/BN11: braucht ein End-zu-End-Laufmodell (Rangmodell + Kaufregel +
   Einkommen 5.2), geeicht gegen BN4.3 und BN9.3. ROADMAP-Wert 29 h ist ungedeckt.
3. Infiltration in BN11 (x2,5 Geld und Ruf, `Infiltration/formulas/victory.ts:9-26`):
   nach `AUFTRAG-BAU` Abschnitt 12 ausgeschlossen (synthetische Tasten
   hospitalisieren) - nicht neu aufgemacht.
4. Reihenfolge Corp-Gewerk vor BN3.1: BN3.1 folgt direkt auf BN2.3; CORP-1 muss
   vorher stehen, sonst laeuft BN3.1 ohne den groessten Hebel.
