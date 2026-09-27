# BN12-Einstiegspruefung (nur lesen, 27.09.2026)

Grundlage: Spielquelle 3.0.2, `src/` auf master, Sicherung `LIVE_..._BN5L3_2026-09-27T12-08` (SF {1:3,4:3,5:2,6:1,9:3,10:3}).
Nachgerechnet mit Skripten in `scratchpad/bn12/` (mults.mjs, route.mjs, favor.mjs, climb.mjs).

## Gerechnete BN12-Werte (BitNode.tsx:918-989, lvl = SF12 + 1, BitNode.tsx:1126)

| | 12.1 | 12.2 | 12.3 |
|---|---|---|---|
| inc = 1,02^lvl | 1,02 | 1,0404 | 1,061208 |
| w0r1d_d43m0n (3000*WDD, ServerHelpers.ts:422-424) | 3060 | 3121,2 -> 3122 | 3183,62 -> 3184 |
| DaedalusAugsRequirement floor(min(30+inc,40)) | 31 | 31 | 31 |
| Red Pill Rep (2,5e6*AugRepCost) | 2.550.000 | 2.601.000 | 2.653.020 |
| Favor zum Spenden floor(150*inc) | 153 | 156 | 159 |
| Mietrechner round(25*dec) x Max-RAM | 25 x 2^19 | 24 x 2^19 | 24 x 2^19 |
| weaken je Faden 0,05*dec | 0,04902 | 0,04806 | 0,04712 |

`lib/bitnodes.json` knotenLevel["12"] 1-3 stimmt mit diesen Formeln exakt ueberein (0 Abweichungen). Daedalus Geld 100e9 und Hacking 2500 sind NICHT skaliert (FactionInfo.tsx:141-145).

## Befunde

### BLOCKER
Keiner gefunden.

### SHOULD-FIX

**1. ServerWeakenRate wird nirgends beruecksichtigt - BN12 ist der erste Knoten der Route mit weaken < 1.**
- Bot: `src/bn4net.js:1774` `WEAKEN_POWER = 0.05` (Vorbereitung `:2821-2822`, Mischbetrieb `:2375`, `:2411`), `src/lib/calc.js:17,287` `SERVER_WEAKEN_AMOUNT = 0.05` (weakenThreads, targetMetrics/prepSec).
- Spiel: `Server/ServerHelpers.ts:322` `0.05 * threads * coreBonus * ServerWeakenRate`. ServerWeakenRate != 1 gibt es nur in BN11 (2) und BN12 (bitnodes.json) - der Bot hat den Fall nie gesehen.
- Rechnung: der Bot ueberschaetzt weaken um 2,00 % / 4,04 % / 6,12 % (12.1/12.2/12.3).
  - Stapel: w1/w2 mit WEAKEN_MARGIN 1,5 (`:2893-2894`) decken bis ServerWeakenRate 0,667 ab -> kein Drift.
  - Vorbereitung (`weakenNoetig > 0`, jeder Rest loest eine neue Welle aus): phantasy in 12.3, Start 15*1,5 = 22,5, min 8, Ueberhang 14,5: Welle 1 ceil(14,5/0,05) = 290 Faeden, wirkt 290*0,04712 = 13,66, Rest 0,84 -> Welle 2 17 Faeden, Rest 0,035 -> Welle 3. **3 weaken-Zeiten statt 1** - nach JEDEM Einbau und jedem Sprung, fuer jedes Stapelziel.
  - Mischbetrieb: Rest > MIX_SEC_OK 1,0 (nur saeubern, kein grow) sobald Ueberhang > 1/0,0612 = 16,3 (12.3) - eine zusaetzliche Saeuberungswelle vor dem ersten grow.
- Folge: kein Stillstand, aber verzoegerter Stapelbetrieb nach jedem Reset (Minuten bis ~1 h je Zyklus je Ziel). Bekannt als G-10 "nur Bericht", aber dort mit "Faeden vorsichtig" begruendet - das stimmt nur fuer die Stapel, nicht fuer die Vorbereitung.
- Fix: `ServerWeakenRate` aus knotenLevel mitlesen wie ScriptHackMoney (`bn4net.js:137-140`) und in WEAKEN_POWER / weakenThreads einsetzen.

### MINOR

**2. Rueckfalltabellen in bn4rep fuer BN12 falsch** (greifen nur, wenn `getBitNodeMultipliers` wirft - mit SF5 praktisch nie).
- `src/bn4rep.js:194-195,209` WD_DIFFICULTY[12] = 1 -> 3000 statt 3060/3122/3184; `:192` DAEDALUS_SCHWELLE_FALLBACK ohne 12 -> 30 statt 31 (`lib/einbau.js:69`); `:184` FACTION_REP_GAIN ohne 12 -> 1 statt 0,98/0,96/0,94.
- Korrektur zu Audit 1#4 ("serverExists auch vor der Red Pill wahr"): falsch. `NetscriptFunctions.ts:1009-1013` verlangt `serversOnNetwork.length > 0`, und w0r1d_d43m0n wird erst beim Red-Pill-Einbau verlinkt (`Prestige.ts:174-181`); Spielstand 12:08: `onNet []`. Vor der Red Pill kommt `zielLevel` also IMMER aus dem 2. Zweig (`getBitNodeMultipliers`), die Tabelle ist echter Rueckfall.

**3. Installzeitpunkt kennt die 31 nicht.** Der A3-Fix wirkt nur auf die Zielwahl (`zaehlplatzWert`, `bn4rep.js:1945-1947`), nicht auf den Einbau-Trigger (`:1369-1375`). Landet ein Einbau bei genau 30 installierten, kommt keine Daedalus-Einladung -> ein Zyklus mehr (Audit 1#3: im Mittel ~1,7 h). In BN5 waere 30 gerade die Einladung gewesen; in BN12 ist genau dieser Fall neu.

**4. levelNutzen ohne HackingLevelMultiplier.** `lib/hackaugs.js:168` `hebel = ziel/(32*mult)` mit `spieler.mults.hacking` (`bn4rep.js:707,2009`); wirksam ist mult*dec. Hacking-Stuecke werden gegen exp/speed/rep-Stuecke um 2-6 % unterbewertet. Nur Rangfolge.

**5. `eta_min: 0` im V1-Knoten aus veralteter blade.json.** `ausgang.js:355-371` rechnet ohne w0r1d_d43m0n den Rangweg aus `data/blade.json` (Stand BN9/10: Rang 623.300 >= 400.000) -> `eta_min 0, eta_sicher false` (so im Spielstand 12:08, BN5.3). Kein Steuerfehler: `einbauErlaubt`/`lohntSich` verlangen `sicher` (`lib/endspurt.js:145,279`), `geldIstVerderblich` hat keinen Aufrufer. Aber kpi.json (`bn4net.js:4975`) und /bb zeigen in allen drei BN12-Laeufen "Sprung in 0 min".

**6. `lib/endspurt.js:83-122` prueft kein nodeReset.** Nach 12.1->12.2 liegt bis zur ersten ausgang.js-Runde (<= ~2 min) die letzte 12.1-Zeile mit `offen: true, eta_min 0` vor -> `einbauErlaubt` sperrt kurz. Folgenlos (in den ersten Minuten gibt es nichts einzubauen), nur Hygiene.

## Gehalten (geprueft, stimmt)

- **Route/V1:** planeRoute ab echtem SF-Stand: 5.3 -> exit.js 12 -> 12.1 (V1) -> 12 -> 12.2 -> 12 -> 12.3 -> 2 (V2); zielErlaubt jedes Mal true (route.mjs, dazu `tools/test-route.js` gruen). `verfahren.txt` "V1 12 n"; alle Leser (bn4rep:139, bn4net:3726, sleeve:110, hashes:115, guard/reg) pruefen nur die Knotennummer - beim Gleichknotensprung bleibt "V1 12 1" gueltig, was richtig ist. graftauto und blade.js `verfahren V2` (registry), bbtrain per `verfahrenV1` gefiltert (`bn4net.js:3847`).
- **Sprung:** destroyW0r1dD43m0n prueft nur `validBitNodes` (Constants.ts:1, Singularity.ts:1129) - Sprung in denselben Knoten erlaubt; giveSourceFile ohne Deckel fuer 12 (RedPill.tsx:29). Gleichknotenspruenge per exit.js schon gelaufen (1.2->1.3).
- **Handschlag/Sicherung:** knotenunabhaengig; Dateiname `_BN12L<sf+1>_`, Rueckwaertspruefung ueber totalPlaytime (laeuft ueber Spruenge weiter). Ohne Bruecke springt der Bot trotzdem (`lib/handschlag.js:270-277`).
- **Knotenmarker:** `data/keine-hacknet.txt` (liegt jetzt mit "5") wird von boot.js bei jedem Knotenwechsel geloescht (`boot.js:159-171`, lastNodeReset < 5 min); SF9.3-Gratisserver in 12.x wird von hashes.js verkauft, nach dem ersten Einbau Marker "12", beim naechsten Sprung wieder weg.
- **Live gelesen:** Daedalus 31 (joinrun.js:79-81, bn4rep ueber daedalusSchwelle), FactionWorkRepGain fuer Spende/NFG (bn4rep:2082,1587,1705), Favor 153/156/159 (`getFavorToDonate`), Aug-Preis/Rep, Mietrechner-Limit/Max-RAM (shop.js:150-151), home-RAM-Preis (homegrow.js:116; homeram.js:291 richtig), WD-Level (ausgang.js:265, exit.js:146). Favor-Rundreise 153/156/159 ohne Gleitkommaverlust (favor.mjs).
- **NFG-Geschenk SF12 (Prestige.ts:256-260):** ein Eintrag, zaehlt fuer Daedalus als 1, genau wie `ownedAugs.size`/`getOwnedAugmentations(false)` im Bot.
- **Endanstieg nach der Red Pill:** BN5.2 installierte die Red Pill bei m ~10 und erreichte 4500 in ~4 min. BN12.3 braucht effektiv 3184/0,9423 = 3379 Level-Einheiten, also weniger als BN5 (4500). Kritisch waere erst m < ~6,5 (climb.mjs); die Red Pill faellt wie in BN5.2 erst nach 31+ Augs samt NFG-Schleife.
- **RAM:** kein BN12-Multiplikator beruehrt RAM-Kosten; Start mit 128 GB (Prestige.ts:241, SF9.3) wie seit 9.3. Bekannt und offen bleibt I#2 (joinrun+netburn 58,2 GB auf home ab 5 Mio).
- **Keine Absturzstelle gefunden:** alle gelesenen Felder existieren in 3.0.2; ownedSF.get(12) = undefined in 12.1 wird ueberall mit `|| 0` abgefangen.
