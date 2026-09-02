# Audit „Substanz“: Zahlen, Schwellen, Formeln des Bots gegen reference/v301

Stand 02.09.2026, 17:10 Uhr (Systemzeit). Prüfmethode: jede Formel als Python/Node
nachgebaut (Skripte im Scratchpad: `formeln.py`, `sleevechance.py`, `cmp_blackops.js`,
`sleeves.mjs`) und gegen den Spielstand geeicht, bevor damit argumentiert wurde.

**Eichungen (alle getroffen):**
- Levelformel `skill.ts:13`: exp 28.841, mult 0,4 × 1,262 → Level **65** (gemessen 65).
- Mietrechner `ServerPurchases.ts:34-41`: 32 GB in BN10 = 55.000 × 32 × 5 × 1,1^0 = **8,80 Mio** (gemessen 8,8 Mio).
- Favor `favor.ts`: 16,4 Favor + 50.000 Rep → **61,56** (bn4rep-Kommentar sagt 61,6).
- Sleeve-Tracking-Chance `Action.ts:170-197` mit 72/72/69/71 → **0,308** (sleeve.js-Kommentar sagt 0,310).
- Gymkosten `Work/Formulas.ts:110-127`, `LocationsMetadata.ts:324-327`: 120 × 20 = **2.400 $/s je Körper** (bbtrain sagt 2.400).
- Die gemessenen **~73.000 $/s** sind KEIN Widerspruch zur Formel – sie sind der Nachholbetrieb der Sleeves (Befund 1): 2 × 15 × 2.400 + 2.400 = **74.400 $/s**.

Live-Spielstand (17:07 Uhr, via `sleeves.mjs` über die Brücke): Spieler str 72 / def 71 / dex 71 / agi 110, int 104, Geld 3,79 Mrd, Spieler im Powerhouse Gym (str). **Beide Sleeves: sync 25, shock 0, storedCycles 76.076 bzw. 75.866**, Arbeit „Mug“, Aug-Multiplikatoren 1,0.

---

### 1. Sleeves haben einen Zyklusdeckel von 15 je Engine-Takt – Rückstand wird gespeichert und mit 15-facher Geschwindigkeit nachgeholt
Schwere: KRITISCH
Beleg: `PersonObjects/Sleeve/Sleeve.ts:263-275` – `storedCycles += numCycles; if (storedCycles < 5 || !currentWork) return; cyclesUsed = min(storedCycles, 15)`. Aufgerufen je Engine-Takt (`engine.tsx:121`) und einmalig mit der gesamten Offline-Zeit (`engine.tsx:341`). Kein Reset bei `startWork` (`Sleeve.ts:181-184`), nur bei Prestige (`:252`). Live: 76.076 gespeicherte Zyklen = 15.215 s = **4,2 h Rückstand je Sleeve**. Der Spieler selbst hat keinen solchen Deckel (`Player.processWork(numCycles)`, `engine.tsx:98/282`).
Was passiert:
- **Gedrosselter Tab** (1 Engine-Takt je Minute, siehe memory „Browser-Tab-Drosselung“): der Engine-Takt bringt 300 Zyklen, der Sleeve verbraucht 15 → **5 % Geschwindigkeit**, der Rest wandert in den Rückstand. „Tagsüber kam nur 1/19 der Gym-Rate an“ (Briefing Punkt 4) ist exakt diese Signatur: Figur nicht im Gym (dann fehlen 45.400 exp/h) plus Sleeves auf 1/20.
- **Nach Freigabe** (5 Takte/s) verbraucht jeder Sleeve 75 Zyklen/s = **15-fach**. Im Gym kostet das 36.000 $/s je Sleeve, mit dem Spieler 74.400 $/s – das ist die gemessene Burn-Rate und das „Konto in 5 min auf −18,5 Mio“ (Briefing Punkt 3: 18,5 Mio / 300 s = 61.700 $/s). `GYM_MIN_GELD = 5e6` (`bbtrain.js:236`, `blade.js:1060`) deckt in diesem Zustand **67 Sekunden**, `sleeve.js` prüft gar nicht (Takt 60 s, `sleeve.js:85`). Ein Rückstand von 4,2 h im Gym kostet 36 Mio je Sleeve in 17 Minuten; ein Rückstand von 8 h (Rechner aus) 69 Mio je Sleeve in 32 Minuten. Negatives Konto blockiert jeden Kauf (Server, Portknacker, Augmentierungen).
- **Jede Ratenmessung während des Nachholens ist Bestand, nicht Rate.** Stationär liefern Spieler + 2 Sleeves 12,62 + 2 × 2,5 = **17,6 exp/s = 63.400 exp/h** (sync 25 → nur ein Viertel der Sleeve-Erfahrung kommt an, `Work.ts:22`, `Sleeve.ts:177-179`). Die gemessenen 106.000 exp/h sind nur mit teilweisem Nachholbetrieb erreichbar. `tools/tor.js:101-109` misst die Rate über ≥ 20-Minuten-Fenster und baut daraus die ETA – während des Drains zu optimistisch, während der Drosselung zu pessimistisch; der Formel-Rückfall (`tor.js:51-61`, 10 × strength_exp = 12,62/s) kennt die Sleeves gar nicht.
- Genau die Lehre vom 30.08. („Rate oder Bestand?“, „Was bei Stillstand und Nachholen?“) – hier für die Sleeves noch nicht angewendet.
Was der Bot stattdessen tun müsste: `ns.sleeve.getSleeve(i).storedCycles` lesen (offiziell exponiert, `NetscriptDefinitions.d.ts:81`, `NetscriptFunctions/Sleeve.ts:209`). Vor jedem Gym-Einsatz eines Sleeves Geld ≥ 2.400 × (storedCycles / 5 + TAKT/1000) je Sleeve verlangen, sonst den Rückstand auf einer kostenlosen Aufgabe abbauen (Shoplift/Synchronize/Recovery) und erst dann ins Gym; `bbtrain`/`blade` GYM_MIN_GELD auf die Zahl der Körper im Gym skalieren (3 Körper: 7.200 $/s → 5 Mio sind 11,6 min, nicht 35). Raten (tor.js, checkin) nur aus Fenstern rechnen, in denen storedCycles ≈ 0 war, oder Erfahrung durch verarbeitete Spielsekunden teilen statt durch Kalenderzeit.

### 2. Offline-Nacht mit Figur im Gym wird beim Laden in einem Schlag abgebucht
Schwere: MITTEL
Beleg: `engine.tsx:279-283` – `Player.processWork(numCyclesOffline)` mit der vollen Offline-Zeit; `ClassWork.tsx:105-110` – `applyWorkStats(Player, rate, cycles)`; `gainMoney` ohne Boden (bbtrain-Kommentar `bbtrain.js:222-226` belegt das schon). Gegenposten: `engine.tsx:271-276` schreibt Offline-Hacking-Einkommen gut (`moneySourceA.hacking / playtimeSinceLastAug × timeOffline × OfflineHackingIncome`).
Was passiert: Rechner 8 h aus, Figur im Powerhouse → beim Laden −69,1 Mio in einem Schritt, bevor `bbtrain` (60-s-Takt) irgendetwas prüfen kann. Bei 3,8 Mrd harmlos; unmittelbar nach einem Einbau (Konto ~0, `playtimeSinceLastAug` klein, Hacking-Einkommen noch nicht aufgebaut) landet das Konto tief im Minus und der Wiederaufbau (Portknacker, Rechner) steht, bis das Netz den Betrag wieder hereingeholt hat. Kein Bot-Skript rechnet damit.
Was der Bot stattdessen tun müsste: Beim Start (`boot.js`/`bbtrain`) nach einem langen `lastUpdate`-Sprung erst das Konto prüfen und ggf. bis zum Ausgleich auf die kostenlose Bladeburner-Trainingsaktion ausweichen; Gym nach einem Einbau erst ab einem Puffer, der die realistische Offline-Spanne deckt (Faustwert 2.400 $/s × 8 h ≈ 69 Mio), oder das Gym vor bekannten Ruhezeiten verlassen.

### 3. RANG_UNTERWEGS 73.660 ignoriert den BitNode-Multiplikator BladeburnerRank
Schwere: MITTEL
Beleg: `tools/checkin.js:46` (73.660 = Summe rankGain der Black Ops 1-20, per Skript bestätigt). `Bladeburner/Formulas.ts:24-25`: `BlackOp → action.rankGain * currentNodeMults.BladeburnerRank`; `BitNode.tsx:876` BN10 = 0,8, `:756` BN7 = 0,6, `:1031` BN13 = 0,45, `:1076` BN14 = 0,6, `:1112` BN15 = 0,2, `:790` BN8 = 0. `reqdRank 400.000` (`BlackOperations.ts:708`) wird NICHT skaliert, ebenso wenig `rankLoss` (`Formulas.ts:39-40`).
Was passiert: Der Rest netto in `checkin.js:256` ist in BN10 um **14.732** Rang zu klein (BN7/14: 29.464, BN13: 40.513, BN15: 58.928); die ETA ist um diesen Betrag geteilt durch die Rate zu optimistisch. Zweiter Ableger in `blade.js:1758-1769` (`einsatzSchwelle`): p* = rankLoss / (rankGain + rankLoss) rechnet mit dem unskalierten Gewinn – Vindictus 0,750 → korrekt 0,806, Centurion/Hyron 0,500 → 0,544, Daedalus 0,450 → 0,488 (greift nur, solange der Rangüberschuss unter rankLoss liegt). Dritter: `blade.js:2746` `feldErtrag = 0,1 / min` ohne den Faktor (`Formulas.ts:14`), verglichen mit Vertragsraten, die ihn ebenfalls nicht tragen – konsistent, also folgenlos. Und: **BN8 hat BladeburnerRank 0** – dort gibt es den Black-Ops-Weg gar nicht; `exit.js`' „ZWEITER WEG“ kann dort nie greifen.
Was der Bot stattdessen tun müsste: `RANG_UNTERWEGS` und die p*-Tabelle mit `ns.getBitNodeMultipliers().BladeburnerRank` (bzw. dem Knoten aus `data/checkin.json`) multiplizieren; in `checkin.js` den Faktor je Knoten aus einer Tabelle nehmen, wenn die API nicht erreichbar ist.

### 4. Hyperdrive-Bewertung in relNutzen ist um mindestens Faktor 2 zu hoch (BN10) und methodisch eine Obergrenze
Schwere: MITTEL
Beleg: `blade.js:785-794` – `lvlPlus = 32 * ln((a + 0,1) / a)` ohne den Levelmultiplikator; `skill.ts:13`: `level = mult × (32 ln(exp + 534,6) − 200)`, in BN10 mult = 0,4 × 1,262 = 0,505 (`BitNode.tsx:847-851`). Außerdem hebt Hyperdrive nur die Erfahrung aus Bladeburner-AKTIONEN (`Bladeburner.ts:720-731`, `ExpGain`-Mult), nicht den Bestand: Tracking bei 10 s liefert ~1,4 dex-exp/s, das Powerhouse 12,6/s.
Was passiert: Bei Stufe 7 weist die Formel 2,3 % Chancenzuwachs aus (Basis def 71), real in BN10 höchstens 1,16 % – und das nur, wenn die gesamte Erfahrung aus Bladeburner-Aktionen käme. Je Punkt (Preis 19) also ≥ 0,12 gegen 0,024 für Blade's Intuition Stufe 30 – Hyperdrive gewinnt die Sortierung um Faktor 5 und zieht Skillpunkte, die auf Chancen wirken sollten (die eigene Tabelle `blade.js:550` zeigt das: Hyperdrive 0,0388 vor Digital Observer 0,0324).
Was der Bot stattdessen tun müsste: `lvlPlus` mit dem tatsächlichen Levelmultiplikator (`ns.getPlayer().mults.defense × BitNode-DefenseLevelMultiplier`) multiplizieren und mit dem Anteil der Bladeburner-Erfahrung an der Gesamterfahrung gewichten – oder Hyperdrive schlicht hinter die Chancen-Skills deckeln, solange die Figur im Gym trainiert.

### 5. blade.js:2703 „123 Rang/min“ ist die vom Vor-Audit gemeldete Zahl – sie steht noch drin
Schwere: NIEDRIG
Beleg: `blade.js:2695-2703`. Der Kommentar rechnet 2,81 Diplomacy-Läufe = 169 s (Charisma 4) vor und schließt dann mit „252,7 Rang je 123 s“, den 112 s + 11 s der alten 309-Charisma-Rechnung. Nachgerechnet (`Bladeburner.ts:737-745`: `cha^0,045 + cha/1000`): Charisma 309 → 1,603 %, 1,87 Läufe, **123,0/min**; Charisma 4 → 1,068 %, 2,81 Läufe, 180 s, **84,5/min**.
Was passiert: Nichts – der Zweig ist laut `blade.js:2709-2712` ersatzlos gestrichen, Raid läuft über `beste()` mit Chaos-Zuschlag. Kosmetisch, aber der nächste Leser rechnet mit 123.
Was der Bot stattdessen tun müsste: Kommentar auf 84,5 korrigieren.

### 6. sleeve.js-Zahlen zum Sleeve-Beitrag: +3,25/s ist Spielerrate × sync, richtig ist Sleeverate × sync = 2,5/s
Schwere: NIEDRIG
Beleg: `sleeve.js:66-72`; `Work.ts:17-25` (`applyWorkStatsExp(Player, shockedStats, sync)` – die Rate ist die des SLEEVES, ohne Spieler-Multiplikatoren, Kommentar in `Work.ts:21`). Sleeve-Multiplikatoren im Spielstand 1,0, sync 25, shock 0 → 10 × 1,0 × 0,25 = **2,5 exp/s je Sleeve**. Synchronize (`SleeveSynchroWork.ts:13-18`): 0,0002 × intBonus(104; 0,5) = 1,034 je Zyklus → 0,00103/s → von 25 auf 100 dauert **20,1 h** je Sleeve – lohnt in dieser Phase nicht.
Was passiert: Die Restzeitschätzung „Tor 1 fällt von 21,8 auf 17,4 h“ ist um ~10 % zu optimistisch (Faktor real 12,62 → 17,62 = 0,72, nicht 0,8). Jeder Sleeve im Gym kostet dieselben 2.400 $/s wie der Spieler und bringt ein Fünftel der Erfahrung – bei 3,8 Mrd egal, nach einem Einbau nicht (siehe Befund 1).
Was der Bot stattdessen tun müsste: Sleeve-Gym nur, wenn das Konto den Preis für den ganzen Rest der Gym-Phase trägt (Rest ~627.000 exp ≈ 9,9 h → 2 Sleeves ≈ 171 Mio); sonst Sleeves auf Verbrechen (Geld) statt Gym.

---

## Was ich geprüft und für tragfähig befunden habe

**blade.js**
- `BLACKOP_DATEN` (21 Einträge, baseDifficulty, isKill/isStealth, 7 Gewichte, 7 Decays) programmatisch gegen `BlackOperations.ts` verglichen: **0 Abweichungen**. `BLACKOP_EINSATZ` rankGain/rankLoss aller 21: identisch; Summe 1-20 = 73.660, alle 21 = 113.660.
- `RANG_JE_ERFOLG` und `REWARD_FAC` (`Contracts.ts:18-19,52-53,85-86`, `Operations.ts`): alle neun Werte identisch. `calculateActionRankGain` = rankGain × rewardFac^(level−1) × BladeburnerRank (`Formulas.ts:18-24`), ±10 % Offset (`Bladeburner.ts:951,1033`).
- `blackOpChance` (`blade.js:1784-1823`): Aufbau identisch mit `Action.ts:170-197` – Skill-Multiplikatoren multiplikativ `1 + base×stufe/100` (`Bladeburner.ts:776-784`), Intelligenzbonus `1 + 0,75 × int^0,8/600` (`intelligence.ts`), Ausdauerstrafe `min(1, stamina/(0,5×max))` (`Bladeburner.ts:167-169`), Truppbonus `(team+1)^0,05` (`Operation.ts:104-106`), Operation-Skill auf Black Ops (`BlackOperation.ts:66`), Black Ops ohne Bevölkerungs- und Chaosfaktor (`BlackOperation.ts:56-62`).
- Schwellen: AUSDAUER_RUHE 0,51 / WEITER 0,56 liegen richtig über der 50-%-Kante; CHAOS_EIN 50 = `ChaosThreshold` (`data/Constants.ts:31`), Faktor `sqrt(1 + chaos − 50)` (`Action.ts:94-103`); Diplomacy-Prozent (`Bladeburner.ts:737-745`); Bevölkerungsänderungen Raid −1 %/−0,5…−1 %, SR −0,5 %, Sting −0,1 %, Assassination −1 Kopf (`Bladeburner.ts:823-859`, Prozent-Semantik `City.ts:79-87`); Nachschub 30 Verträge/h (`Bladeburner.ts:1389-1394`, growth 5-75/10 über 480 s).
- Skillkosten `round(count × BladeburnerSkillCost × (base + inc × level))` (`Skill.ts:70-75`) – Datamancer „3 + n“ stimmt für BN10 (Mult 1); in BN7/13/14 gilt 2, in BN15 3, der Bot liest den Preis aber über `getSkillUpgradeCost` (`blade.js:1158,1193`). Overclock `1/(99 − stufe)` und Cyber's-Edge-Doppelwirkung (`Bladeburner.ts:1322-1324,1334`) korrekt.
- HP-Folgen: Fehlschlag kostet `min(10 % Geld, HP × 100.000)` (`Hospital.ts:4-10`); Daedalus-Schaden 100.000 × 146,7 = 14,7 Mio HP → immer 10 % des Kontos. Die „360 Mio je Versuch“ in `blade.js:296-299` passen dazu.
- Beitrittstor ≥ 100 auf allen vier Kampfwerten (`NetscriptFunctions/Bladeburner.ts:349-354`). In BN10 (Levelmult 0,4) braucht Level 100 **252.320 exp je Wert** (BN6 mit Mult 1,262: 6.200) – Rest heute 627.000 exp ≈ 9,9 h stationär.

**bbtrain.js**
- Gym-Erfahrung: 1 exp/Zyklus × expMult 10 / 5 × 5 = 10 exp/s × strength_exp (`Work/Formulas.ts:119-127`, `ClassWork.tsx:56-71`), kein BitNode-Faktor (`ClassGymExpGain` = 1 überall). Spieler allein 12,62/s = 45.400 exp/h – das „13/s“ des Kommentars stimmt.
- Entropie-Tabelle (`bbtrain.js:122-129`): `EntropyEffect 0,98^stacks` auf ALLE Multiplikatoren inkl. `*_exp` und `bladeburner_success_chance` (`EntropyAccumulation.ts`, `Constants.ts:104`). Nachgerechnet: Level 103 → 100 (1 Stapel) → 98 (2 Stapel). Die Tabelle ist korrekt; „optimistische Obergrenze“ trifft nur insofern zu, als die Trainingsrate ebenfalls mit 0,98^n fällt.

**bn4rep.js**
- Preisfaktor 1,9 je wartendem Stück (`Constants.ts:41`, `AugmentationHelpers.ts:30-37`, SF11-Rabatt 0,96/0,94/0,93 ignoriert – harmlos, Preis kommt aus der API); Reset beim Einbau (`AugmentationHelpers.ts:110`). NFG 1,14 je Stufe auf Preis und Rep (`Constants.ts:36`, `AugmentationHelpers.ts:132-137`). Favor 150 (`Constants.ts:31`), Formel `25.000 × expm1(0,01980…× f)` exakt `favor.ts`; Rep für Favor 150 = 462.490. Spende `rep = $/1e6 × faction_rep × FactionWorkRepGain` (`donation.ts:9-11`) – `nfgGeldFuerRep` invertiert das richtig; `FACTION_REP_GAIN {2: 0,5, 4: 0,75, 13: 0,6, 14: 0,2}` deckt sich mit `BitNode.tsx:588,651,1022,1069`.
- Einbau-Moment: Beispiel BitRunners Favor 16,4 + 50.000 Rep → 61,56 Favor, Ratengewinn 1,388 ≥ Schwelle 1,25 → Einbau. Formel stimmt (`reputation.ts:8-14` `1 + favor/100`). `grobRate = 5 × hacking/975 × faction_rep × Knotenfaktor` lässt int/3, Intelligenzbonus, Favor und Share weg – bewusst konservativ.
- `WD_DIFFICULTY` gegen `BitNode.tsx` (2:5, 3:2, 4:3, 5:1,5, 6:2, 7:2, 9:2, 10:2, 11:1,5, 13:3, 14:5, 15:2, 8 = Vorgabe 1) korrekt; `zielLevel = 3000 × WD` entspricht `ServerHelpers.ts:383-385`; BN10 → 6000, so auch im Spielstand.

**bn4net.js**
- `kennzahlen` (`bn4net.js:1007-1055`): p und chance linear in (100 − hd) (`Hacking.ts:15-16,50-52`), hackTime ∝ 2,5 × req × hd + 500 (`Hacking.ts:64-70`), grow 3,2×, weaken 4× (`:81-95`), k = min(log1p(0,03/hd), 0,003494) (`grow.ts:15-19`, `Server/data/Constants.ts:8`). FORTIFY_HACK 0,002, FORTIFY_GROW 0,004 = 2 × ServerFortifyAmount (`ServerHelpers.ts:211`, `NetscriptFunctions.ts:340`), WEAKEN_POWER 0,05 (1 Kern, konservativ).
- `growthAnalyze(host, 2) = ln 2 / k` ist zulässig: `numCycleForGrowth = ln(growth) / growthLog(1 Faden)` (`ServerHelpers.ts:74-77`); der additive $1/Faden fehlt dort nur, wenn man Fäden bis moneyMax fragt – dafür nutzt der Bot `growFaeden` (`bn4net.js:2963-2985`, Newton wie `numCycleForGrowthCorrected`).
- Amortisation `amortSek = kosten / (zusatzGb × ertrag)` mit ertrag in $/GB·s (`bn4net.js:742-743`, Grenzertrag aus `grenzErtrag` `:129-…`): dimensional korrekt (s). Kaltstart-Leiter: BN10 kostet 32 GB 8,8 Mio, 16 GB 4,4, 8 GB 2,2 (Softcap 1,1 greift erst ab 128 GB) – Briefing-Befund 2, nicht wiederholt.

**sleeve.js / checkin.js**
- Sleeve-Rang geht an den Spieler (`Bladeburner.ts:951-952 changeRank`), keine Ausdauer für Sleeves, Kontrakte ohne rankLoss (`Contracts.ts`): stimmt. `KONTRAKT_MIN_KAMPF 40` → Tracking-Chance 0,185 (Kampf 40, cha 1, int 1, pop 1e9, Stufe 1); bei 14: 0,072; bei 1: 0,008 – die Schwelle ist vertretbar.
- Sleeve-Anzahl `min(3, SF10 + 1 in BN10)` → 2 im Spielstand, `MAX = 3` deckt es.
- `BLACKOPS_GESAMT 21`, `DAEDALUS_RANG 400.000` korrekt; `getAvailability` prüft `rank` (nicht maxRank) gegen reqdRank (`BlackOperation.ts:45-50`) – der `Ueberschuss`-Test in `einsatzSchwelle` misst also die richtige Größe.

**Nachmessung zu Befund 1 (17:13 Uhr):** storedCycles 76.076 → 50.120 in 371 s Spielzeit (lastUpdate 15:06:55 → 15:13:06 UTC) = 25.956 Zyklen = 5.191 Spielsekunden abgebaut in 371 Sekunden → **Faktor 14,0** (15× Verbrauch minus 1× Zulauf). Der Deckel und der Nachholbetrieb sind damit live belegt, nicht nur aus dem Quellcode gelesen. Bei „Mug“ ist das harmlos; im Gym wären es in diesen sechs Minuten 2 × 5.191 × 2.400 = **24,9 Mio** gewesen.

## Was ich nicht prüfen konnte
- Die Messung „106.000 exp/h“ selbst (Fenster, Zeitpunkt) – nur, dass sie stationär nicht erreichbar ist.
- `growFaeden` Zeile für Zeile gegen `numCycleForGrowthCorrected` (`ServerHelpers.ts:90-…`); die Struktur (Startwert, Newton in Log-Form) deckt sich.
- bn4rep in Kampfknoten: ob `lueckeZuGross` (Hacking-Rep-Rate × 45 min) für die Bladeburner-Faktion (Rep aus Rang, `Formulas.ts:44-47`, Faktor 2) überhaupt sinnvoll ist – nicht bis in den Kampfknoten-Zweig verfolgt.
- BN12-Zeile in `WD_DIFFICULTY` (12: 1 gegen `inc` = 1,02^Stufe in `BitNode.tsx:993`) – für die Roadmap erst spät relevant.
