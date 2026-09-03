# R2b – Audit-Befunde und Zahlen (Stand der Dateien: 03.09.2026, gelesen ohne Eingriff)

Quellenlage: Synthese `nodes/AUDIT-AUTONOMIE-2026-09-02.md` (18,5 KB, Abschnitte A–J), Teilberichte unter `nodes/audit-2026-09-02/` (praemisse/uebergaenge/betrieb/knoten/zahlen/briefing plus sieben `skeptiker-*.md`), `nodes/BAUSTELLEN.md` `## Sofort` (Zeile 119 ff., Stand 02.09. 18:55), Commits `9160c75` und `1302cd6` (beide `[skeptiker]`), Stichproben im Spielquellcode `reference/v301/src/`. Bau-Stand laut `git log --since=2026-09-02`: I.1 (`9160c75`) und I.2–I.7 (`1302cd6`) sind committet; `src/ausgang.js` (18.705 B, 02.09. 18:38) und `src/route.json` (2.838 B, 02.09. 17:52) liegen im Repo. `data/route.json` und `data/verfahren.txt` existieren lokal NICHT – die Route liegt unter `src/route.json` und wird von der Brücke ins Spiel geschoben; `verfahren.txt` entsteht nur im Spiel.

---

## 1. Kernbefunde des Autonomie-Audits (02.09.2026), Abschnitte A–J

**Kernaussage** (`AUDIT-AUTONOMIE:20-36`): Der Bot war am 02.09. „in keinem einzigen Übergang autonom“ – er spielt einen Knoten gut, aber jeder der ~41 Knotenwechsel und ein Teil der Einbauten enden im Stillstand, weil Zielwahl, Ausgangserkennung und Selbstsprung-Schutz auf einen Menschen gebaut sind. Dazu drei Knoten ohne Gewerk (BN8, BN9, BN15) und ein fehlender Geldboden. Die Bauform (große Skripte je Aufgabe, `WERKZEUGE`-Liste, boot.js als Rückruf, feste Route) wird ausdrücklich als tragfähig bewertet.

**A – Was jeden Übergang stoppt (Befunde 1–5, KRITISCH)** (`:38-86`). Der Zielknoten kam nur aus `data/exit-ziel.txt`, das kein Skript schrieb (`bn4rep.js:906` einziger Leser); der Guard `bn4rep.js:907-908` verbot `ziel === eigenerKnoten` und `ziel > 13` – damit waren 27 der 40 Restsprünge verboten (25 in denselben Knoten, 6 nach BN14/15). Der Ausgang saß in `bn4rep.js:891` (nur `The Red Pill`), das Skript braucht außerhalb BN4 848 GB und lief in BN10 L2 26 h gar nicht; `exec` von `exit.js` war fest auf `home` (`:929`), exit.js kostet mit SF4.1 519 GB. Die Knotenrolle stand als `BLADE_KNOTEN = [6,7,10]` (`bn4rep.js:70`), die Route fährt Bladeburner aber in 22 der 41 Restläufe. Fünf `rufeMenschen`/`hilfe.txt`-Stellen plus 20-Minuten-Abbruch in `boot.js:88-126` waren Endlosschleifen ohne Hörer.
**Stand: GEBAUT (I.1, Commit `9160c75`).** `ausgang.js` (singularityfrei, 8,15 GB gemessen, Position 1 der Werkzeugliste) liest `route.json` + `ns.getResetInfo()`, wählt den ersten offenen Routeneintrag, schreibt `data/verfahren.txt` (V1/V2), prüft `getNextBlackOp() === null` ODER Hacking+Root, startet exit.js über den Auftragskanal auf dem Wirt mit Platz. Raus: exit-ziel.txt, Guard, Obergrenze 13, BLADE_KNOTEN, Home-only-exec, rufeMenschen. Drei Skeptiker-Läufe (Logik, Betrieb, Anschluss). Live 17:54 verifiziert: `verfahren.txt 'V2 10 2'`. **Nicht verifiziert: ein echter Sprung über ausgang.js** – der Sprung vom 01.09. lief noch über `tools/task.js` (`uebergaenge.md:89-115`).

**B – Was den Kaltstart stoppt (Befunde 6–11)** (`:88-129`). Kein Geldboden: `sleeve.js:316` und `joinrun.js:91` schicken Körper ohne Geldprüfung ins Powerhouse (2.400 $/s je Körper), das Spiel bucht ins Minus, negatives Konto lässt purchaseServer/purchaseProgram/upgradeHomeRam/travelToCity `false` zurückgeben → Deadlock (gemessen 02.09. 06:00: −18,5 Mio in 5 min). Sleeves holen mit Faktor 15 nach (`Sleeve.ts:263-275`), Spielerarbeit wird beim Laden als Klumpen gutgeschrieben (`engine.tsx:280-282`, 10 h Gym auf einen Wert). Kaltstart-Leiter rechnete mit BN6-Preisen (BN10 `CloudServerCost 5` → 13,5 h Stillstand, BN3 ~87 h). Bis zum ersten Mietrechner läuft nur bn4net; contracts.js fehlt um 1,9 GB, wakelock (34 GB) fehlt ganz. Kein Autoexec im Spiel.
**Stand: I.2 (Geldboden) und I.3 (Kaltstart-Leiter Faktor 1,0, passender Rechner) GEBAUT (`1302cd6`).** sleeve.js: Gym nur, wenn Konto den 15×-Nachholbetrieb aller Körper trägt (+20 Mio Reserve), sonst Shoplift (<40) / Mug; Sleeve i trainiert den (i+1)-niedrigsten Wert. joinrun 5-Mio-Boden. **OFFEN:** bn4net-Verschlankung für contracts.js, wakelock <15 GB, Autoexec-Handgriff (`BAUSTELLEN.md:137-143`).

**C – Was nach zwei Tagen bricht (Befunde 12–17)** (`:131-168`). Entdopplung `bn4net.js:2555-2573` behielt die älteste PID – jeder Neustart eines hängenden Werkzeugs starb binnen 10 s (wache.log: 17 wirkungslose wakelock-Neustarts in 4 h; sleeve.json 11 h alt bei Status „laufend“). `Bitburner-Aufsicht.cmd` im Windows-Autostart startete die am 31.08. beendeten Außenwerkzeuge neu. Sechs Skripte greifen ohne Rangordnung nach der Figur (Ping-Pong bbtrain↔joinrun). boot.js gab nach 240×5 s auf und räumte task.txt nicht. Logs sind Speicherlisten mit „w“ (200 Zeilen ≈ 30 min). task.txt ist Ein-Platz-Kanal ohne Wiederholung.
**Stand: I.4 teilweise GEBAUT** – Stillstandserkennung über Telemetriealter (blade/sleeve/bn4life/ausgang/bbtrain) im Motor, Entdopplung behält die jüngste Instanz, Herzschläge in bbtrain/blade, boot.js „nie aufgeben, alle 5 min home räumen“, Auftragskanal mit Wiederholung, bbtrain ohne Notruf; Live 18:14-18:50 keine Fehl-Kills über 35 min, Telemetrien <1 min. **OFFEN:** Figur-Vergabepunkt (C.14), Logs anhängen (C.16), Autostart-Eintrag (I.5, Erics Handgriff).

**D – Knoten, die der Bot nicht kann** (`:170-181`, Tabelle). BN9 ×3: `CloudServerLimit 0`, `bn4net.js:616` betritt die Leiter nie, Hacking 0,35–3,5 $/s, kein `spendHashes` in src/ → Totalstillstand. BN8 ×3: einzige Geldquelle Börse, `stocks.js` in keiner Liste, verweigert ohne 4S (26 Mrd); Leiter verbrennt 211 von 250 Mio Startkapital in 50 min; Bladeburner-Beitritt unmöglich (Rank 0). BN15 ×3: V1 über Daedalus existiert dort nicht (TRP nur im 4. Darknet-Labor), V2 bei Faktor 0,2 ≈ 94 h je Lauf, Labyrinth-Code null Zeilen. BN13/14/7: blade.js kannte keinen Knotenfaktor. BN3: Kaltstart 2–4 Tage. BN4 L2/L3: fuhr V1 (46 h) statt V2 (25–29 h).
**Stand:** BN9-Gewerk GEBAUT (I.6: `hashes.js` 5 GB verkauft/tauscht Hashes, `hacknet.js` kauft ersten Server nach Einbau und Wirt für exit.js, Hacknet-Server tragen keine Arbeiter; `bb.md`-Commit `17a2f9d`: „GEWERK FEHLT nur noch für BN8“). BN4-Verfahren über route.json erledigt. **OFFEN: BN8-Börsenbot, BN15-Labyrinth, Bladeburner-Aufbauphase bei SkillCost 2/3 nicht simuliert (J).**

**E – Zahlen, falsch/bestätigt** (`:183-210`, Details `zahlen.md:35-60`). Falsch: `checkin.js:46` `RANG_UNTERWEGS 73.660` ohne `BladeburnerRank` (BN10 um 14.732 zu klein, BN15 um 58.928); gleicher Fehler in `blade.js:1758-1769` (Vindictus p* 0,750 → korrekt 0,806); Hyperdrive-Nutzen `blade.js:785-794` ohne Levelmultiplikator (≥ Faktor 2 zu hoch, gewinnt Skillsortierung um Faktor 5); `blade.js:2703` „123 Rang/min“ statt 84,5; `sleeve.js:66-72` 3,25/s statt 2,5/s; `bn4rep.js:113` `WD_DIFFICULTY[12] = 1` statt 1,02^Stufe. Die eigene Messung „106.000 exp/h“ war Nachholbetrieb, stationär 63.400 exp/h. Bestätigt (programmatisch gegen Quellcode): alle 21 Black Ops, Erfolgsformel, Skillkosten, Gym-Exp/-Kosten, Entropie-Tabelle, Aug-Preise, NFG, Favor, WD-Ziel, Hack/Grow/Weaken-Kennzahlen, Amortisation.
**Stand: I.7 GEBAUT** (Rangfaktor je Knoten in checkin/blade, Hyperdrive, Sleeve-Rate, WD-Ziel aus Multiplikatoren; `1302cd6`).

**F – Eigene Werkzeuge als Teil des Problems** (`:212-227`). `engine.tsx:344-350` schreibt Offline-Zeit VOLL auf `totalPlaytime`; checkin.js/rueckstand.js nahmen sie als „das Spiel lief“ – „Tempo 1,0 über 11,5 h“ war Offline-Gutschrift. checkin meldete 13 h Stillstand als `ANLAUF`. tor.js liest veraltete Telemetrie, kennt Sleeves nicht. `skills/bb.md` behielt drei Entscheidungen dem Menschen vor.
**Stand: TEILWEISE.** checkin liest `ausgang.json` und meldet SPRINGT/SPRUNG KLEMMT/GEWERK FEHLT (9160c75); `662421d` begrenzt Raten/ETA auf denselben Lauf. **OFFEN (I.8):** Offline-Erkennung über `lastUpdate`-Sprünge, Spielanteil/Kalender-ETA (`BAUSTELLEN.md:151-153`), tor.js.

**G – Betriebsmodell** (`:229-245`, `praemisse.md:142-173`). Skripte laufen offline NICHT (nur `offlineHackingIncome` × 0,75, `Engine.tsx:270-277`); Bladeburner holt max. 5 Spielsekunden je Realsekunde nach, Sleeves 15 Zyklen je Takt, Spielerarbeit als Klumpen. Gleichgewicht 4,8 h Vordergrund-Tab je Tag (`tools/rueckstand.js:5-25`); BN10 L1: 94,9 h Kalender für ~52 h Spielzeit (Faktor 1,8); 1.100–1.900 h Spielzeit → 3–5 Monate Kalender, bei schlechter Tab-Disziplin ein Jahr. „Autonom“ heißt heute: 5,5 von 24 h. Hebel außerhalb des Codes: Electron-Fassung mit `backgroundThrottling: false` (`reference/v301/electron/gameWindow.js:26,63`), Rechnung dann 46–79 Tage; Kosten: Spielstand-Umzug, `tools/save.js` verliert die IndexedDB-Abkürzung.
**Stand: OFFEN (I.10, Erics Entscheidung).** Für den „perfekten Bot“ ist das der größte einzelne Zeitfaktor – Faktor 1,8 bis 4,4 auf die Kalenderzeit, den kein Skript ausgleichen kann.

**H – Was NICHT geändert wird** – siehe Abschnitt 4.

**I – Reihenfolge der Umbauten** (`:269-306`): I.1 Ausgang+Route, I.2 Geldboden, I.3 Kaltstart, I.4 Selbstheilung, I.5 Autostart-Eintrag, I.6 BN9-Gewerk, I.7 Zahlen, I.8 Werkzeuge, I.9 BN15/BN8, I.10 Betriebsmodell. Regel: Skeptiker-Lauf vor jedem Einbau, `[skeptiker]` im Commit. **Stand: I.1–I.7 committet; I.5 Handgriff; I.8 teilweise; I.9/I.10 offen.** Hinweis: `BAUSTELLEN.md:137-140` (18:55) führt Autoexec und Autostart noch als offene Handgriffe; ein späterer Vollzug ist in den gelesenen Dateien nicht belegt und muss in der Bausitzung über `tools/save.js` (`Settings.AutoexecScript`) und den Autostart-Ordner nachgeprüft werden.

**J – Nicht geprüft** (`:308-320`): exit.js-RAM im Spiel (519 GB nur gerechnet); Electron nicht ausprobiert; Kaltstart-Raten außerhalb BN10 sind Modell (BN6-Kontrolle Faktor 2 zu pessimistisch); `getServerLimit()` in BN9 nur aus Quellcode; Bladeburner-Aufbau bei SkillCost 2/3 nicht simuliert; ob bn4net wirklich 2 GB abgibt; bn4rep-Kampfknoten-Zweig (`lueckeZuGross`) nicht verfolgt.

**Weitere Teilbefunde, die in der Synthese nur indirekt stehen** (nur Überschriften gelesen): `praemisse.md:174` M1 „Die Brücke schreibt zurück, was in src/ liegt – und macht Eingriffe im Spiel still rückgängig“; `uebergaenge.md:173` `simulacrum.txt` veraltet, Löschregel in einem Skript, das kein Automat startet; `:193` Zustandsdateien ohne Knotenstempel; `:236` exit.js alle 15 s neu gestartet, ohne dass jemand den Grund liest; `betrieb.md:97` gegenseitige Wache prüft nur home; `:135` `WERKZEUG <name>` ohne Werkbank tötet und startet nicht nach.

---

## 2. Gemessene Zahlen mit Quelle

### 2.1 Singularity-RAM (SF4) und Skriptgrößen

| Größe | Wert | Quelle |
|---|---|---|
| SF4-Faktor außerhalb BN4 | SF4.1 ×16, SF4.2 ×4, SF4.3 ×1; in BN4 immer ×1 | `praemisse.md:113-127` (`RamCostGenerator.ts` SF4Cost Z. 82-96) |
| Basiskosten Singularity Fn1/Fn2/Fn3 | 2 / 3 / 5 GB (nicht 1/2/3) | `praemisse.md:120-121` (`RamCostConstants` Z. 55-57) |
| Kleinstes Skript mit EINEM Aufruf (SF4.1) | Fn1 33,60 / Fn2 49,60 / Fn3 81,60 GB; SF4.2: 9,60/13,60/21,60; SF4.3: 3,60/4,60/6,60 | `praemisse.md:251-263` (Tabelle, `ramcalc.js` auf zwei Messwerte geeicht) |
| `destroyW0r1dD43m0n` | SF4Cost(32) = 512 GB mit SF4.1 | `uebergaenge.md:89-95` (`RamCostGenerator.ts:219`) |
| exit.js | 519,25 GB (SF4.1) / 135,25 (SF4.2) / 39,25 (SF4.3) – **gerechnet, nicht gemessen** (J) | `uebergaenge.md:92-95`, `AUDIT-AUTONOMIE:310` |
| bn4rep.js | 848 GB (Synthese), 848,25 (uebergaenge), **846,8 gemessen 18:00** | `AUDIT-AUTONOMIE:52`, `uebergaenge.md:108`, `BAUSTELLEN.md` STAND 18:02 |
| bn4life.js | 293,8 GB (boot.txt); ~73 GB mit SF4.2; 23,8 mit SF4.3 | `knoten.md` Tabelle BN4/BN9, `uebergaenge.md:137` |
| blade.js | 94,85 GB (SF4.3, BN9-Rechnung); 27,6 GB (ROADMAP-Stand 24.08.) | `uebergaenge.md:137`, `AUDIT-ROADMAP:2` Zeile 8-10. **Die Angabe „174 GB“ aus dem Auftrag steht in keiner gelesenen Audit-Datei** – im Spiel per `getScriptRam` nachmessen |
| bn4net.js | **16,25 GB** (Synthese/praemisse) vs. **17,75 GB** (BAUSTELLEN, Skeptiker) – Widerspruch; `skeptiker-ausgang-anschluss.md:324`: „aus Briefing/Audit übernommen, nicht selbst gemessen“ | `praemisse.md:129`, `BAUSTELLEN.md:141`, `skeptiker-ausgang-anschluss.md:49,190,324` |
| contracts.js | 17,65 GB; fehlt um 1,9 GB neben bn4net auf 32 GB | `praemisse.md:129-130` |
| wakelock.js | 34 GB (DOM-Zugriff 25 GB) | `AUDIT-AUTONOMIE:118-120` |
| ausgang.js | 10,75 gerechnet → 10,9 im Spiel gemessen → **8,15 GB nach Verschlankung** (im Spiel gemessen 02.09.) | `AUDIT-AUTONOMIE:73`, `skeptiker-ausgang-briefing.md:15`, `src/ausgang.js:14`, Commit `9160c75` |
| hashes.js / sleevecrime.js | 5 GB / 5,7 GB | Commit `1302cd6` |
| frisches home | 32 GB (mit SF1), 128 ab SF9.2, sonst 8 GB | `praemisse.md:118-119` (`Prestige.ts:246-252`) |
| Freier Platz auf home im Betrieb | Reserve `max/4` (home 512 → 128,75 frei) | `uebergaenge.md:95-97` (`data/bn4net.json`) |
| BN10 L2 live 18:00 | Park 15/15 (`CloudServerLimit 0,6`), größter Rechner 512 GB, home 1024 GB; 2048 GB kosten 907 Mio | `BAUSTELLEN.md` STAND 18:02 |

Restlaufplan der 16×-Phase: nur noch **ein** 16×-Kaltstart (BN10 L3) und zwei 16×-Ausgänge (BN10 L2, L3); ab Route-Position 8 (SF4.3) überall ×1 (`praemisse.md:122-125`).

### 2.2 Serverpreise und Rechnerlimits (im Quellcode nachgelesen)

- Formel `ServerPurchases.ts:34-41` (selbst geprüft): `Preis = ram × BaseCostFor1GBOfRamServer × CloudServerCost × CloudServerSoftcap^max(0, log2(ram) − 6)`; `BaseCostFor1GBOfRamServer = 55.000` (`Server/data/Constants.ts:4`), `BaseCostFor1GBOfRamHome = 32.000` (`:3`), `CloudServerMaxRam = 2^20` (`:13`).
- Eichung: 32 GB in BN10 = 55.000 × 32 × 5 × 1,1^0 = **8,80 Mio**, gemessen 8,8 Mio (`zahlen.md:9`). Softcap 1,1 greift erst ab 128 GB (`zahlen.md:88`).
- Rechnerlimit `round(25 × CloudServerLimit)` (`ServerPurchases.ts:96`): BN9 → 0, BN10 → 15.
- home 32→64 GB in BN9: 50,4 Mio (`HomeComputerRamCost 5`); ×3-Regel aus `homegrow.js:113` (`knoten.md` Tabelle).
- Kaltstart-Leiter je Knoten (Modellrate aus BN10 175 $/s, Schwelle Preis × 1,25): BN3 32 GB 3,52 Mio (`CloudServerCost 2`), 14 $/s → **87 h** (44 h bei Faktor 2); BN14 39 h (`HackingSpeed 0,3`); BN11 17 h; BN13 12 h; BN10 real 13,5 h; über 12 Läufe 300–600 h Leerlauf (`knoten.md:59-64`).

### 2.3 Bladeburner: Rangmultiplikatoren, Black Ops

- `BladeburnerRank` je Knoten (`BitNode.tsx`, Zeilen aus `zahlen.md:37` und eigenem grep): BN10 **0,8** (:876 ✓), BN9 **0,9** (:830 ✓), BN7 0,6 (:756), BN13 0,45 (:1031), BN14 0,6 (:1076), BN15 0,2 (:1112), BN8 **0** (:790), BN12 0,98/0,96/0,94 je Stufe (`knoten.md` Tabelle). `BladeburnerSkillCost`: BN9 1,2 (:831 ✓), BN7/13/14 2, BN15 3.
- Wirkung: `rankGain × BladeburnerRank` (`Bladeburner/Formulas.ts:24-25`); **`reqdRank 400.000` (`BlackOperations.ts:708`) und `rankLoss` (`Formulas.ts:39-40`) skalieren NICHT.** Rangzeit BN7/14 ×1,33, BN13 ×1,78, BN15 ×4,0.
- Summe rankGain Black Ops 1–20 = 73.660, alle 21 = 113.660 (`zahlen.md:63`). Netto-Restweg BN6 am 27.08.: 317.257 (`KURS.md` 27.08.).
- Skillkosten `round(count × SkillCost × (base + inc × level))` (`Skill.ts:70-75`); `skillPoints = floor(maxRank/3)` → Rate `dR/dt ~ R^a`, ETA BN6 71–148 h (`KURS.md` 27.08.).
- Beitrittstor: alle vier Kampfwerte ≥ 100 (`NetscriptFunctions/Bladeburner.ts:349-354`); in BN10 (Levelmult 0,4) **252.320 exp je Wert**, BN6 (1,262) 6.200 (`zahlen.md:76`); BN9 126.565, BN14 72.776, BN13/15 17.275 (`knoten.md` Tabelle).
- Fehlschlag kostet `min(10 % Geld, HP × 100.000)` (`Hospital.ts:4-10`); Daedalus-Schaden 14,7 Mio HP → immer 10 % des Kontos (`zahlen.md:75`).
- Nachschub 30 Verträge/h (`Bladeburner.ts:1389-1394`); Chaos-Schwelle 50 (`Constants.ts:31`), Faktor `sqrt(1 + chaos − 50)` (`Action.ts:94-103`).
- Diplomacy: Charisma 4 → 84,5 Rang/min, Charisma 309 → 123,0 (`zahlen.md:47-51`, `Bladeburner.ts:737-745`).

### 2.4 World Daemon / Hacking-Ausgang

- `zielLevel = requiredHackingSkill 3000 × WorldDaemonDifficulty` (`ServerHelpers.ts:383-385`); bn4rep-Tabelle gegen `BitNode.tsx` bestätigt: 2:5, 3:2, 4:3, 5:1,5, 6:2, 7:2, 9:2 (:841 ✓), 10:2, 11:1,5, 13:3, 14:5, 15:2; BN12 = 1,02^Stufe (`BitNode.tsx:993`, im Bot fälschlich 1, nur Rangfolge); BN8 Vorgabe 1 (`zahlen.md:83`). BN10 → 6000.
- BN6-Zweitweg verworfen: `HackingLevelMultiplier 0,35` verlangt exp e^184 (`KURS.md` 27.08.).
- Levelformel `skill.ts:13`: `level = mult × (32 ln(exp + 534,6) − 200)`; Eichung exp 28.841, mult 0,4 × 1,262 → 65 (gemessen 65) (`zahlen.md:8`).
- Effektive V1-Schwellen je Knoten (`knoten.md` Tabelle): BN1 3.000, BN12 3.121–3.378, BN5 4.500, BN4 9.000 (46 h bewiesen), BN9 12.000, BN2 18.750, BN13 36.000, BN14 37.500; BN15 V1 existiert nicht (TRP im 4. Darknet-Labor, `FactionHelpers.tsx:204-207`).

### 2.5 BN9- und BN10-Multiplikatoren (`reference/v301/src/BitNode/BitNode.tsx`, selbst gegrept)

- **BN9:** HackingLevelMultiplier 0,5 (:803), ServerMaxMoney 0,01 (:810), ServerStartingMoney 0,1 (:811), HomeComputerRamCost 5 (:814), **CloudServerLimit 0** (:816), ScriptHackMoney 0,1 (:819), HackExpGain 0,05 (:821), BladeburnerRank 0,9 (:830), BladeburnerSkillCost 1,2 (:831), WorldDaemonDifficulty 2 (:841). Hacking-Einkommen Modell 0,35–3,5 $/s (`knoten.md:37`).
- **BN10:** HackingLevelMultiplier 0,35 (:846), HomeComputerRamCost 1,5 (:853), **CloudServerCost 5** (:855), CloudServerLimit 0,6 (:857), ScriptHackMoney 0,5 (:864), CodingContractMoney 0,5 (:865), BladeburnerRank 0,8 (:876). Sleeves `min(3, SF10 + 1)` → 2 in Lauf 2 (`zahlen.md:90`).
- Sonstige aus `knoten.md` Tabelle: BN3 CloudServerCost 2, ScriptHackMoney 0,2 × StartingMoney 0,2; BN14 HackingSpeed 0,3, FactionWorkRepGain 0,2; BN8 250 Mio Startkapital, ScriptHackMoneyGain 0; BN11 CrimeMoney 3, AugmentationMoneyCost (BN7) 3.

### 2.6 Gym, Sleeves, Geld

- Powerhouse Gym: 120 $/s × costMult 20 = **2.400 $/s je Körper** (`Work/Formulas.ts:110-127`, `LocationsMetadata.ts:324-327`); 3 Körper 7.200 $/s = 26 Mio/h (`knoten.md:73`). Gym-Exp: 10 exp/s × `strength_exp`-Mult, Spieler 12,62/s = 45.400 exp/h; `ClassGymExpGain` wird nirgends angewendet (`zahlen.md:70-71`).
- Sleeve-Exp: Sleeverate × sync/100 → 10 × 1,0 × 0,25 = **2,5 exp/s je Sleeve** bei sync 25 (`Work.ts:17-25`); Synchronize 25→100 dauert 20,1 h (`zahlen.md:55-58`). Stationär Spieler + 2 Sleeves = 17,6 exp/s = **63.400 exp/h**; Rest zum Tor 627.000 exp ≈ 9,9 h, nicht 6,2.
- Nachholbetrieb im Gym: 15 × 2.400 = 36.000 $/s je Sleeve; 2 × 36.000 + 2.400 = **74.400 $/s** – gemessen ~73.000 $/s, −18,5 Mio in 5 min (`zahlen.md:11-12,22`). `GYM_MIN_GELD = 5e6` (`bbtrain.js:236`, `blade.js:1060`) deckt dann **67 s**. Rückstand 4,2 h im Gym = 36 Mio je Sleeve in 17 min; 8 h = 69 Mio in 32 min.
- Sleeve-Tracking-Chance 72/72/69/71 → 0,308 (`Action.ts:170-197`); `KONTRAKT_MIN_KAMPF 40` → 0,185 (`zahlen.md:10,89`).
- Kaltstart-Geld: nach `installAugmentations` **1.000 $** (`betrieb.md:45`); TOR-Kauf verlangt >600 k (`bn4life.js:218`), BruteSSH 500 k; Hackrate im Kaltstart ~350 $/s = 1,26 Mio/h gegen ~6 Mio/h aus Verträgen; 24 liegengebliebene Verträge = **+86 Mio** bei `CodingContractMoney 0,5` (`praemisse.md:130-135`); Verträge entstehen 3 Versuche je 10 min, auch offline (`Engine.tsx:267`). BN8: 250 Mio Start, Leiter kauft 5×128 + 20×64 GB = 211 Mio (`knoten.md` Tabelle).
- Augmentierungen: Preisfaktor 1,9 je wartendem Stück (`Constants.ts:41`), NFG 1,14 je Stufe, Favor 150 = 462.490 Rep, Spende `rep = $/1e6 × faction_rep × FactionWorkRepGain` (`zahlen.md:79-81`). Einbau kostet ~6,6 h Wiederaufbau (`AUDIT-AUTONOMIE:63`, gemessen 29.08.).

### 2.7 Hashraten (BN9-Gewerk)

- Gratis-Hacknet-Server (BN9 nativ / SF9.3): Level 100, 10 Kerne (`Prestige.ts:338-347`); `HacknetServers.ts:11-16`: `0,001 × 100 × 1 × (1 + 9/5)` = **0,28 Hashes/s**; 4 Hashes = 1 Mio $ (`HashUpgradesMetadata.tsx:10-23`) → **70.000 $/s ≈ 250 Mio/h**, 200× das gesamte Hacking-Netz in BN9 (`knoten.md:37`). `ramRatio = 1 − ramUsed/maxRam` halbiert die Hashrate, sobald Skripte darauf laufen (`HacknetServers.ts:14`) – deshalb „Hacknet-Server tragen keine Arbeiter“ (`1302cd6`).

### 2.8 Offline-/Nachholgrenzen (im Quellcode selbst nachgelesen)

- **Sleeves:** `Sleeve.ts:263-275` – `storedCycles += numCycles; if (storedCycles < 5 || !currentWork) return; cyclesUsed = min(storedCycles, 15)` → höchstens 15 Zyklen je Engine-Takt, Rückstand bleibt gespeichert, kein Reset bei `startWork`. Gedrosselter Tab (1 Takt/min = 300 Zyklen) → **5 % Geschwindigkeit**; nach Freigabe **Faktor 15** (live nachgemessen Faktor 14,0: 25.956 Zyklen in 371 s, `zahlen.md:91`). Live 17:07: 76.076 Zyklen = 4,2 h Rückstand je Sleeve. `ns.sleeve.getSleeve(i).storedCycles` ist offiziell lesbar (`NetscriptDefinitions.d.ts:81`).
- **Bladeburner:** `Bladeburner.ts:1376-1380` – `seconds = min(floor(storedCycles/5), 5)` → **höchstens 5 Spielsekunden je Realsekunde**, storedCycles ohne Deckel (`Bladeburner.ts:276`). Gleichgewicht 4,8 h Vordergrund-Tab/Tag (`tools/rueckstand.js:5-25`); verdeckter Tab senkt den Abbau um Faktor 12.
- **Spieler:** `engine.tsx:279-283` – `Player.processWork(numCyclesOffline)` für die GESAMTE Abwesenheit auf einen Schlag, ungedeckelt inkl. Kosten (`ClassWork.tsx:105-110`): 10 h Rechner-aus mit Figur auf Agility → agi 474.881 exp, andere je ~28.000; beim Laden 86 Mio abgebucht (`AUDIT-AUTONOMIE:105-110`); 8 h Gym = −69,1 Mio in einem Schritt (`zahlen.md:32`).
- **Skripte:** offline nichts außer `offlineHackingIncome = Ø-Hackrate × Offlinezeit × 0,75` (`Engine.tsx:270-275`, `Constants.ts:22`).
- **Uhr:** `engine.tsx:344-350` schreibt Offline-Zeit VOLL auf `totalPlaytime` – als Maß für „das Spiel lief“ unbrauchbar (F).

### 2.9 Durchsatz- und Roadmap-Zahlen vom 24.08. (Kontext)

- Bot-Audit (`AUDIT-BOT:67-106`): Einweg-Takt als Verlustursache CONFIRMED; Loop-Worker (1,80 GB/Faden, singularityfrei) → Faktor 15–27, mit Hack-Mix bis 40–70; Rest des Faktors 100 war Modellluft.
- Route (`AUDIT-ROADMAP:69-106`): V2 als Träger überall außer BN1/5/12 (V1) und BN8; BN10 sofort ×3 wegen +1 Sleeve je Stufe (Ertrag 150–250 h gegen 56 h Kosten); BN4 L2/L3 vor allem anderen wegen SF4.2/4.3; BN9 als Position 8–10 (SF9.2: home 128 GB, SF9.3: Gratis-Hacknet-Server). Grobsumme ~41 Restläufe × Ø 25–50 h ≈ **1.100–1.900 h**. BN15 mit Labyrinth-Option (V1b), BN8 ganz am Ende mit Vorbedingung Börsenbot.

---

## 3. Was das Audit als NICHT gebaut führt (`BAUSTELLEN.md:135-153`, Stand 02.09. 18:55; `AUDIT-AUTONOMIE:269-306`)

- **BN8-Börsenbot (`boerse.js`):** einzige Geldquelle in BN8 ist die Börse, `stocks.js` weigert sich ohne 4S (26 Mrd) und steht in keiner Werkzeugliste – ein eigenes Gewerk, vor Route-Position 42 nötig (`AUDIT-AUTONOMIE:174,303`).
- **BN15-Labyrinth:** V1b über das 4. Darknet-Labor hat null Codezeilen; ohne es kosten drei V2-Läufe bei Faktor 0,2 je ≥94 h (280 h); Entscheidung vor Position 39 (`AUDIT-AUTONOMIE:175,303`; `route.json` markiert den Eintrag mit `braucht`, fehlt die Datei, wird übersprungen und gemeldet).
- **contracts.js und wakelock.js im Kaltstart:** contracts (17,65 GB) passt nicht neben bn4net (17,75) auf 32 GB – bn4net um 3,4 GB verschlanken; wakelock (34 GB, DOM) ist im Kaltstart nicht startbar, der Tab bleibt dort gedrosselt (Faktor 6 auf jede Runde) (`BAUSTELLEN.md:141-143`).
- **Figur-Vergabepunkt (C.14):** EIN Vergabepunkt mit Rangfolge Graft > Bladeburner > Faktionsarbeit > Gym > Verbrechen fehlt; joinrun/bbtrain teilen nur die 5-Mio-Schwelle, das Ping-Pong ist entschärft, nicht beseitigt (`BAUSTELLEN.md:144-146`).
- **Logs anhängen (C.16):** Logs sind weiter Speicherlisten mit „w“, jeder Neustart löscht die Vorgeschichte, Post-mortem nach unbeobachtetem Ausfall unmöglich (`BAUSTELLEN.md:147`).
- **sleevecrime-Marker:** ohne Sleeves auf einem Mietrechner landet der Marker nicht auf home (kein `scp` im 5,7-GB-Budget) → Neustart alle 10 s bis sleeve.js läuft; nur in Knoten ohne Sleeves relevant (`BAUSTELLEN.md:148-150`).
- **Spielanteil/Offline-Uhr in checkin.js:** Kalender-ETA und die Erkennung von `lastUpdate`-Sprüngen >1 h als Offline-Klumpen fehlen (I.8, `AUDIT-AUTONOMIE:212-220,299-300`).
- **Spieler-Offline-Klumpen:** 10 h Gym auf einen Wert bleibt – „dagegen hilft nur, den Rechner laufen zu lassen“ (`BAUSTELLEN.md:151-153`; Sleeves wurden auf verschiedene Werte verteilt, die Figur selbst nicht).
- **Zwei Handgriffe:** Autoexec `boot.js` (Options → System) und `Bitburner-Aufsicht.cmd` aus dem Windows-Autostart – laut BAUSTELLEN 18:55 offen, Vollzug in den gelesenen Dateien nicht belegt (`BAUSTELLEN.md:137-140`; Mechanik in `ERLEDIGT.md:5365-5399`).
- **Nicht simuliert/gemessen (J):** exit.js-RAM im Spiel, Electron-Fassung, `getServerLimit()` in BN9 live, Bladeburner-Aufbau bei SkillCost 2/3, Kaltstart-Raten außerhalb BN10.
- **Nach dem Audit neu aufgetaucht (03.09.):** die Brücke `sync/bridge.js` hat seit Entfernung des Autostart-Eintrags keinen Starter und ist der einzige Prozess außerhalb des Spiels – im Audit nur als M1 (`praemisse.md:174`, „schreibt zurück, was in src/ liegt“) behandelt, nicht als Ausfallpunkt.

---

## 4. Was das Audit ausdrücklich NICHT ändern will und warum (`AUDIT-AUTONOMIE:247-267`, `praemisse.md:113-141`)

- **Keine Zerlegung in Einzelaufruf-Skripte.** Gerechnet (`ramcalc.js`, geeicht): ein Skript mit genau EINEM Singularity-Aufruf kostet mit SF4.1 33,6 GB (Fn1), 49,6 (Fn2), 81,6 (Fn3) – kein einziges passt auf ein frisches 32-GB-home, der Kaltstart hängt also ohnehin am ersten Mietrechner. Es gibt nur noch einen 16×-Kaltstart (BN10 L3); ab Position 8 (SF4.3) ist das Problem weg. Zwei Steuerskripte (bn4rep 1.972 Z., bn4life) für einen Lauf umzubauen lohnt nicht. Die einzige richtige Zerlegung ist die des Ausgangs in ein singularityfreies 8–11-GB-Skript – gebaut (I.1).
- **Die Route bleibt.** Sie ist der Grund, warum sich die RAM-Frage von selbst löst (BN4 L2/L3 vor allem anderen); `route.json:3` schreibt es fest: „die Reihenfolge steht fest und wird von niemandem geändert“, Änderungen nur mit grünem `node tools/test-route.js` (39 Sprünge geplant).
- **Die Bauform bleibt** (große Skripte je Aufgabe, `WERKZEUGE`-Liste, boot.js als Rückruf): „trägt“ (`AUDIT-AUTONOMIE:31-34`); was sie kostet, ist die Dauerbelegung (bn4rep 848 GB wartet auf 1024 GB), und das wurde über den Ausbau des größten Rechners für wartende Werkzeuge gelöst (`1302cd6`), nicht über einen Umbau.
- **`ClassGymExpGain` nicht kompensieren:** wird in v3.0.1 nirgends angewendet – BN4/BN13 (0,5) dämpfen das Gym nicht; die Roadmap-Formulierung „Skill ×2/×3“ meint `BladeburnerSkillCost`.
- **Hacknet-Server-RAM nicht als Werkbank:** `ramRatio` halbiert die Hashrate, sobald Skripte darauf laufen – erst Hashes verkaufen (jetzt `hashes.js`), dann sehen.
- **Die Wache (`tools/wache.js`) nicht wieder anwerfen:** unter der Prämisse ein Außenwerkzeug und nachweislich schädlich (Doppelstarts, Kill der frischen Instanz, Streit mit bbtrain); Stillstandserkennung gehört in bn4net – gebaut (I.4).
- **Entropie-Tabelle in bbtrain bleibt:** Vor-Audit F4 nachgerechnet und entkräftet (`EntropyEffect 0,98^stacks`, Level 103 → 100 → 98 korrekt).
- **Betriebsmodell (Electron/Zweitprofil) ist keine Code-Entscheidung**, sondern Erics; ohne sie bleibt jede Spielzeit-Rechnung eine untere Kante (Faktor 1,8–4,4 Kalender).

---

## Hinweise für den Prompt-Bau (aus dem Gelesenen, kein Zusatzmaterial)

- Drei RAM-Zahlen sind widersprüchlich oder unbelegt und müssen in der Bausitzung per `getScriptRam` gemessen werden: bn4net (16,25 vs. 17,75), blade.js („174“ nirgends belegt; 94,85/27,6 in den Notizen), exit.js (519,25 nur gerechnet).
- Der eine Test, der noch nie lief: ein Knotenwechsel über `ausgang.js` inklusive Kaltstart ohne `tools/task.js`. Alle Sprünge bis 01.09. waren Handarbeit.
- Die Abnahme-Kriterien aus dem Audit sind bereits formuliert: `[skeptiker]`-Marker im Commit, Live-Nachweis (Telemetrien <1 min, keine Fehl-Kills), und die drei Fragen „Welche Uhr? Was bei Stillstand und Nachholen? Rate oder Bestand?“ – Befund F zeigt, dass die letzte Frage am 02.09. bei der eigenen Uhr (`totalPlaytime`) nicht gestellt wurde.