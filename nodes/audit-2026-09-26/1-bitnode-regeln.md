# Audit 1: BitNode-Regeln und Multiplikatoren (Stand 26.09.2026, 18:07)

Grundlage: Spielquelle 3.0.2 (`reference/bitburner-src/src`), Bot `src/`, Spielstände `backups/*BN5L2*`, `*BN1L2*`, `*BN1L3*` (lokal entpackt, nur gelesen). Rechnungen: `scratchpad/audit/skill.mjs` (Skill-Formel gegen den Spielstand geeicht: exp 1,4237e8 bei mult 7,1655 ergibt 2871, das Spiel sagt 2871), `endzeit.mjs`, `verlauf.mjs`, `rp.mjs`, `park.mjs`.

Lage BN5.2 um 18:04: 17,4 h im Knoten, Hacking 3895, `mults.hacking` 9,04, 35 Augs eingebaut, Daedalus beigetreten (Rep 183.012, Favor 3), Red Pill fehlt noch, Kontostand 6,66e12. Ziel `w0r1d_d43m0n` = 4500 (im Spielstand gelesen).

## Befunde, wichtigste zuerst

### 1. Die Graft-Automatik läuft auch in V1-Knoten, mit einem reinen Kampfplan, und verdrängt dort die Faktionsarbeit
- **Bot:** `src/registry.json` (graftauto.js: `"verfahren":"alle"`, einzige Vorbedingung `requiresFile: graftplan.json`); `src/graftauto.js` (kein Blick auf `data/verfahren.txt`); `src/lib/graftwahl.js` `naechstes()` (kein Blick auf den Knoten); `src/graftplan.json` (39 Stücke, SPTN-97, Bionic Legs, Hyperion, Combat Rib …); `src/lib/figur.js:53-60` (`graft: 10` schlägt `faktion: 30`).
- **Spiel:** `NetscriptFunctions/Grafting.ts:80` → `Player.startWork(new GraftingWork)`, `PersonObjects/Player/PlayerObjectWorkMethods.ts:5-15` beendet die laufende Arbeit, also auch die Faktionsarbeit. Die Kosten sind `baseCost × 3` (`GraftableAugmentation.ts:20-22`, `Constants.ts:96`).
- **Was falsch ist:** Heute schlummert das nur, weil `graftplan.json` in `data/nicht-schieben.txt` steht. Sobald Eric den Zünder für die V2-Knoten setzt, graftet der Bot auch in BN5.3 und BN12.1-12.3 Kampf-Augs. Die tragen zum Hacking-Ausgang nichts bei, und weil die Figur-Priorität 10 vor 30 steht, halten sie die Figur fest, die im V1-Knoten die Daedalus-Reputation für die Red Pill erarbeiten muss.
- **Folge:** 39 Grafts zu je 17,6-88 min (gemessen, `lib/figur.js:65-69`) blockieren 11-57 h Faktionsarbeit. Beim heute gemessenen Daedalus-Tempo (1.529 → 183.012 Rep in 2.700 s Spielzeit, also rund 67 Rep/s oder 242.000/h) entspricht das 2,7-13,8 Mio. Rep, also dem 1- bis 5-fachen der Red Pill. Dazu kommen Graft-Preise von `baseCost × 3` aus dem Konto, das in V1 für Augs und NFG gebraucht wird.
- **Konfidenz:** Mechanik belegt. Ob der Schaden eintritt, hängt am Zünder.
- **Fix:** Für graftauto in der Registry `"verfahren":"V2"` eintragen oder in V1 einen eigenen Hacking-Plan mit Priorität unter `faktion` fahren. Ein Graft kennt keinen `AugmentationMoneyCost` und keine Rep, das ist in BN5 (×2) sogar ein Hebel, aber nur für Hacking-Stücke.

### 2. BN8 bleibt ungeschützt: Kern und Park rechnen mit Hackgeld, das es dort nicht gibt
- **Bot:** `src/bn4net.js:113-124` liest aus `lib/bitnodes.json` nur `ScriptHackMoney` (BN8: 0,3) und `ServerGrowthRate`, nicht aber `ScriptHackMoneyGain`. Damit sind `steadyEff`, `grenzErtrag` und die Amortisation (`:1395-1411`) in BN8 Phantomerträge. Die Kaltstart- und Amortisationsleiter (`:1236-1248`) kauft Rechner, sobald Geld ≥ 4× Preis da ist, ohne jede BN8-Phase. `src/sleeve.js:102-106` schickt die Sleeves im V1-Knoten zum Verbrechen, mit dem Kommentar „in BitNode 8 … Verbrechen (bringt Geld)“.
- **Spiel:** `BitNode.tsx:764-790` (`ScriptHackMoneyGain: 0`, `CrimeMoney: 0`), `Netscript/NetscriptHelpers.tsx:648` (`moneyGained = moneyDrained * ScriptHackMoneyGain`), `Work/Formulas.ts:73` (Verbrechensgeld × `CrimeMoney`).
- **Was falsch ist:** Der Befund steht als Soll in `nodes/audit-2026-09-02/knoten.md:43-45` und `nodes/AUFTRAG-BAU-2026-09.md:155` (Phasenregel: in Phase 1 keine Rechner, kein home-Ausbau, kein Gym). Im Code ist keine Zeile davon umgesetzt: `grep bn8|=== 8` findet in bn4net, shop und homegrow nichts, `bn8_phase` gibt es nur als KPI-Definition. Der Sleeve-Kommentar ist falsch, dort kommt 0 $ an.
- **Folge:** Laut der Simulation in `knoten.md:43` verbrennt die Leiter 211 der 250 Mio. Startgeld. Übrig bleiben rund 39 Mio. Börsenkapital gegen 2 × 100k Provision und eine Mindestposition von 20 Mio. Die drei BN8-Läufe starten damit praktisch ohne Kapital und hängen ab dort. Das ist der Route-Schluss, also weit weg.
- **Konfidenz:** belegt.
- **Fix:** Die Phase aus `boerse.js` (Depot < 5 Mrd) als Kaufsperre in bn4net (Leiter und Amortisation), homegrow und sleeve.js durchreichen. Außerdem soll bn4net `ScriptHackMoney × ScriptHackMoneyGain` lesen statt nur `ScriptHackMoney`.

### 3. Die Daedalus-Schwelle ist auf 30 fest verdrahtet, und gezählt wird anders als im Spiel
- **Bot:** `src/bn4rep.js:1622` `zaehlplatzWert = alleAugs.length < 30 ? 1 : 0`, mit `alleAugs = getOwnedAugmentations(true)` (`:544`).
- **Spiel:** `BitNode.tsx:923`: in BN12 `floor(min(30 + 1,02^lvl, 40))` = **31** auf allen drei Routenstufen (`nodes/BAU-2026-09/A4-bitnodes.md` B3 hat das schon ausgerechnet, im Code ist es nicht angekommen). Gezählt wird `p.augmentations.length`, also nur eingebaute Augs, NFG genau einmal (`FactionJoinCondition.ts:123-130`, `AugmentationHelpers.ts:54-59`). `getOwnedAugmentations(true)` enthält dagegen jede **wartende** NFG-Stufe als eigenen Eintrag (`NetscriptFunctions/Singularity.ts:79-92`).
- **Was falsch ist:** Der Zählbonus erlischt (a) in BN12 eine Aug zu früh und (b) überall zu früh, wenn NFG-Stufen in der Warteschlange liegen. Beispiel 17:19: 9 wartend, davon 6 NFG, die als 6 zählen, obwohl sie für Daedalus höchstens 1 wert sind.
- **Folge:** Landet ein Einbau in BN12 auf genau 30 verschiedenen, kommt keine Einladung. Die 31. Aug hat dann nur noch ihren `levelNutzen`, und wertlose Stücke (Kampf, Hacknet) fallen auf Güte 0. Das kostet einen weiteren Einbauzyklus. Die Einbauabstände in BN5.2 lagen bei 01:45 / 04:48 / 07:10 / 09:14 / 10:01 / 12:53 / 15:12 / 16:37 / 16:57 / 17:19, im Mittel etwa 1,7 h. Wahrscheinlich ist der Fall nicht: BN5.2 sprang 28→29→32, BN1.3 26→29→33. Bis zu 1,7 h je BN12-Lauf sind möglich.
- **Konfidenz:** Mechanik belegt, Eintritt plausibel.
- **Fix:** Schwelle aus `ns.getBitNodeMultipliers().DaedalusAugsRequirement` lesen, das ist mit SF5 überall verfügbar. Zählen: eingebaute plus wartende, jeweils als Menge, NFG einmal.

### 4. Die Multiplikator-Tabelle ist statisch, aus 3.0.1, und in BN12 leer; daneben stehen drei handgepflegte Knotentabellen
- **Bot:** `tools/bitnodes-tabelle.js:22` (Quelle `reference/v301`, das Spiel läuft auf 3.0.2), `:53` (Regex `[\d.]+`: negative Werte und Ausdrücke wie `inc`/`dec` fallen heraus). `src/lib/bitnodes.json` enthält für BN12 nur `{ServerStartingSecurity 1.5, CorporationSoftcap 0.8, CorporationDivisions 0.5, GangSoftcap 0.8}`, `StaneksGiftExtraSize` −6/−2/−3/−1/−99 fehlen. Handtabellen: `src/bn4rep.js:164` `FACTION_REP_GAIN` und `:1283` `NFG_REP_GAIN` (beide ohne BN12), `:166-167` `WD_DIFFICULTY` (BN12 = 1, nur Rückfall).
- **Spiel:** `BitNode.tsx:918-990`: BN12 `ScriptHackMoney`, `ServerGrowthRate` und `FactionWorkRepGain` jeweils `1/1,02^lvl`, `WorldDaemonDifficulty` `1,02^lvl`. `Faction/formulas/donation.ts:10`: Spenden-Rep × `FactionWorkRepGain`. Der Unterschied 3.0.1 → 3.0.2 betrifft nur BN12 `DarknetLabyrinthRewardsTheRedPill` und BN13 Charisma. Keins von beiden liest der Bot.
- **Was falsch ist und was es kostet (gerechnet):**
  - bn4net in BN12: Hackanteil 2-6 % zu hoch, Wachstum 2-6 % zu niedrig angesetzt. Das hebt sich auf, die Stapel driften nicht. Bei f = 0,5 auf Stufe 3 braucht es den Nachwuchs-Faktor 1,890, erreicht wird 2^0,9423 = 1,921.
  - Spende in BN12.2/12.3: 1,02 × 0,9612 = 0,980, es fehlen 2 %. Die nächste Runde spendet nach, das kostet eine Runde.
  - `WD_DIFFICULTY` wird nie gebraucht, weil `ns.serverExists("w0r1d_d43m0n")` auch vor der Red Pill wahr ist. Der Server wird immer angelegt und nur nicht verbunden (`Prestige.ts:173-181`).
  - Insgesamt: kein Stillstand, Zeitverlust vernachlässigbar. Die Tabelle ist aber eine bekannte offene Baustelle (`BEFUNDE-RUNDE2` B18) und der eigentliche Grund für Befund 2.
- **Konfidenz:** belegt.
- **Fix:** Seit SF5 gibt `ns.getBitNodeMultipliers()` die echten Werte samt BN12-Stufe zurück. Einmal je Knoten (z. B. in boot.js oder ausgang.js, 4 GB) nach `data/bnmult.json` schreiben und alle Leser darauf umstellen. Tabelle und Handtabellen streichen.

### 5. Nebenbefund außerhalb dieses Winkels, aber für den V1-Ausgang erheblich: Speicher liegt brach, und der Park wächst nicht über 1 TB je Rechner
- **Belege aus den Spielständen:** BN5.2 18:04: 6,66e12 $, Mietrechner höchstens 1024 GB, Netz nur zu 67 % belegt, auf home liegen 29.300 von 65.536 GB frei. BN1.3 00:04: 4,75e15 $, Mietrechner höchstens 1024 GB, 47 % belegt, auf home 153.000 GB frei.
- Der Ausbau (`bn4net.js:1395`) rechnet nur mit Geld-Amortisation (`grenzErtrag`, bei Überschuss > 5 % gleich 0). Erfahrung, also der Rohstoff des V1-Ausgangs, zählt dort nicht.
- In BN5 wiegt das schwerer, weil der Ausgang 4500 verlangt (Rechnung in Befund-Liste „geprüft“, Punkt 3).
- Kein Knotenfehler, deshalb nicht einsortiert. Gehört ins RAM-/Ökonomie-Audit.

## Geprüft, in Ordnung

1. **Ausgangslevel:** exit.js und ausgang.js lesen `requiredHackingSkill` live; das Spiel setzt ihn auf `3000 × WorldDaemonDifficulty` (`servers.ts:1553`, `ServerHelpers.ts:422-424`). BN5 = 4500 steht so im Spielstand. BN12 = 3060 / 3121,2 / 3183,6; der Vergleich `level < req` stimmt auch bei Nachkommastellen. Die Bedingung in `destroyW0r1dD43m0n` ist Level ≥ req und Root (`Singularity.ts:1148-1153`), genau wie im Bot.
2. **`zielLevel` in bn4rep** (`:168-182`) kommt vom Server oder aus `getBitNodeMultipliers`, mit SF5 überall verfügbar. `levelNutzen` ist damit knotenrichtig skaliert (BN5 4500).
3. **Endspiel-Riegel in BN5** (kein Einbau nach der Red Pill): Zeit von Level 1 bis 4500 in Abhängigkeit vom Multiplikator, gerechnet mit der gemessenen Rate (c = 42,2 exp/s je Level, geeicht auf 17:04 → 17:19):

   | `mults.hacking` | Zeit bis 4500 |
   |---|---|
   | 7,17 | 191 h |
   | 8 | 25 h |
   | 9,04 | 3,4 h |
   | 10 | 0,8 h |

   Zum Vergleich BN1/BN12 (Ziel ≈ 3000): Minuten. Der Riegel ist nur deshalb unkritisch, weil die NFG-Schleife vor jedem Einbau (`bn4rep.js:1282-1310`) auch den Red-Pill-Einbau auflädt. Mit 6,66e12 $ reicht das für etwa 11 NFG-Stufen, also ×1,116, und bringt m von 9,04 auf rund 10,1. **Empfindlich:** Fällt diese Schleife aus (Geld, Spendenrecht), kostet jedes fehlende Zehntel Multiplikator in BN5 Stunden.
4. **Red-Pill-Gewicht:** `EXIT_KEY_VALUE` 10 ist knotenunabhängig. In BN1.2, BN1.3 und BN5.2 war laut Spielständen immer die 30er-Schwelle das Nadelöhr (Daedalus bei etwa 11-16 h), und direkt nach dem Beitritt ging die Arbeit an Daedalus (`rp.mjs`). Kein Handlungsbedarf.
5. **Spendenschwelle:** `ns.getFavorToDonate()` live (`bn4rep.js:1020,1282,1735`). Gilt für BN3 75, BN8 0 und BN12 153/156/159.
6. **Aug-Preise und Rep:** live über `getAugmentationPrice`/`getAugmentationRepReq` (`bn4rep.js:597-598`), also inklusive `AugmentationMoneyCost` 2 in BN5 und `AugmentationRepCost` in BN12.
7. **Mietrechner:** Limit, Höchst-RAM und Preise live (`shop.js:150-151`, `data/preise.json`). Damit ist auch BN12 abgedeckt: 2^19 statt 2^20 schon auf Stufe 1 (`ServerPurchases.ts:96-100`), 25/24/24 Plätze.
8. **home-RAM-Preis:** `homeram.js:288-292` stimmt für alle 15 Knoten (BN3/10 1,5, BN9 5, BN12 1,02^(SF12+1)), gegengeprüft mit `PlayerObjectServerMethods.ts:30-38`.
9. **Hacknet:** hacknet.js baut nur in BN9 aus (BN5 `HacknetNodeMoney` 0,2), hashes.js sperrt sich in BN8.
10. **Route:** planeRoute ergibt BN5.2 → 5.3 → 12.1 → 12.2 → 12.3. Die Stufe kommt aus `ownedSF`, und das `lvl` im Spiel ist `activeSourceFileLvl + 1` (`BitNode.tsx:1126`); das passt zusammen.
11. **Formulas.exe:** kommt mit SF5 nach jedem Einbau gratis (`Prestige.ts:92-94`), darkweb.js überspringt vorhandene Programme (`:238`).
12. **Infiltration** (BN5 Rep ×1,5) und **IPvGO** (Daedalus-Gegner: Rep-Bonus) sind ungenutzt. Beides ist bewusst ausgeschlossen (`AUFTRAG-BAU-2026-09.md:346`: keine Infiltration; Go nur nach Messung) und wird nicht neu aufgemacht.
