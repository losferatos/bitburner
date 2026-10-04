# Audit 03./04.10.2026 - Robustheit VERSION: Konstanten-Drift und Versionsstand 3.0.1 -> 3.0.2

Pruefer VERSION, Stand 04.10.2026 13:56 (Systemzeit). Fortsetzung eines am Nutzungslimit
abgebrochenen ersten Laufs (dessen Werkzeuge `tools/audit/version-*.mjs` wurden geprueft, neu
gelaufen und erweitert, nicht doppelt gebaut). Bot `src/` auf master (f1bee88), nur gelesen,
Spiel nicht angefasst, nichts committet. Neue Dateien: dieser Bericht und sieben Rechner unter
`tools/audit/` (`version-liste`, `version-live4`, `version-konst2`, `version-zitat-hunks`,
`version-rechner`, `version-cha`, `version-apibreak`).

## 0. Kurzfassung

1. **Das LAUFENDE Spiel ist v3.0.1, nicht 3.0.2.** Drei unabhaengige Merkmale in 202-203
   Spielstaenden plus eine Eichung an 23 Staendepaaren (Abschnitt 2). `VersionSave` ist 51 in
   beiden Fassungen und trennt nicht. Es gibt gar kein Release 3.0.2: `git tag` endet bei `v3.0.1`.
2. **`reference/bitburner-src` ist der dev-Zweig**: Kopf `79e5cd8` (13.08.2026), 171 Commits nach
   dem Tag `v3.0.1` (`3162fd2`, 17.05.2026), `package.json:4` und `Constants.ts:7` sagen "3.0.2".
   Entstanden ist das Etikett am 26.09.: der Cloud-Auftrag klonte `--branch v3.0.2`, der Tag
   existiert nicht, der Rueckfall war der Default-Zweig (`nodes/CLOUD-AUFTRAEGE-2026-09-26.md:15`).
   Seitdem steht "Spielquelle 3.0.2" in jedem Bericht, im Briefing (`BRIEFING.md:22-25`, dort ist
   `reference/v301` sogar als "die alte" bezeichnet - es ist die laufende) und in
   `tools/bitnodes-tabelle.js:14-17` ("das Spiel laeuft auf 3.0.2").
3. **Wie viel haengt daran? Erstaunlich wenig.** Von 220 gemeinsamen Dateien, die sich nach
   Entfernen von Kommentaren und Leerraum unterscheiden, sind 134 Oberflaeche, Terminal, Doku,
   DevMenu (ausserdem 6 Dateien nur in v301, 17 nur in dev). Von den 86 uebrigen aendern **nur vier
   Stellen etwas, das der Bot rechnet oder voraussetzt oder bald bauen wird**: fuenf
   Charisma-Augmentierungen, zwei BitNode-Felder, die Corporation (Produktionslimit-NaN, nur
   live), das Infiltration-Minispiel `WireCutting`. Alles andere ist Umbenennung, Text, neue API
   (die der Bot nicht ruft) oder intern.
4. **Konstanten: 0 rote Zeilen.** 23 Einzelwerte (`version-konst`), 19 Tabellen x 2 Fassungen = 38
   Pruefungen (`version-konst2`), 136+56+60 Augmentierungseintraege, 544 BitNode-Felder - jeweils
   gegen v301 UND dev. Abweichungen gegen live: nur die unter Punkt 3 (Abschnitt 4).
5. **Gang, Hacking, Sleeves, Hacknet, Faktionsruf, Boerse, Black Ops, Skills, Reise, Hashes,
   Contracts, RFA-Bruecke, Speicherformat, Oberflaechentexte: textgleich oder zahlengleich in beiden
   Fassungen.** Was am 03./04.10. auf dev-Formeln gebaut wurde (Gang, Torrunde, Kaufaufschub),
   gilt unveraendert fuer das laufende Spiel (alle Gang-Dateien byte-gleich).
6. **Der Bot weiss nicht, welche Fassung laeuft.** `ns.ui.getGameInfo()` kostet 0 GB und liefert
   `version`, `versionNumber`, `commit` (`v301 UserInterface.ts:179-186`, `RamCostGenerator.ts:452`);
   `src/` ruft es nirgends. Die Frage "welche Fassung" kostete zwei Audit-Laeufe (VERS-5).
7. **Wechsel auf 3.0.2 (Cutover): unkritisch fuer das, was heute laeuft** (Abschnitt 6): die
   API-Bruch-Migration findet in 647 Skripten 0 Treffer, die ns-Oberflaeche des Bots ist in beiden
   `.d.ts` gleich typisiert, RFA-Format und Speicherschluessel gleich. Zu pruefen bleiben zwei
   noch ungebaute Gewerke (Corporation, Infiltration) und die Charisma-Tabelle.

Befunde (Details Abschnitt 7): VERS-1 Referenz-Etikett (P2), VERS-4 Corporation-NaN-Falle live (P2),
VERS-5 Fassungserkennung fehlt (P2), VERS-6 Typpruefung nur gegen dev-`.d.ts` (P2), VERS-2
Charisma-Tabelle (P3), VERS-3 WireCutting (P3), VERS-7 `bitnodes.json` aus dev (P3), VERS-8 Inventare
nennen dev-only API (P3), VERS-9 zwei tote Diagnoseaufrufe (P3).

Nicht angefasst (Begruendung Abschnitt 9): Bladeburner-Schwellen, Gang-Aufbau, Reihenfolge der
BitNodes, `ENTSCHIEDEN`-Liste (`BAUSTELLEN.md:8-45`) - keine neue Messung, keine neue Fundstelle
zu diesen Punkten.

## 1. Rechner und Eichung

Alle unter `tools/audit/`, alle lesend. Jeder hat eine Selbstprobe oder Eichung, die ihn bei Blindheit
rot macht. Aufruf jeweils `node tools/audit/<name>.mjs`.

| Rechner | Was | Eichung (Soll) | Ist |
|---|---|---|---|
| `version-live3` | Fassungsmerkmale in allen Staenden (`scriptKey`, `EnableSaveDataBackupReminder`) | Merkmal steht in v301-Quelle, fehlt in dev (`RunningScript.ts:71` / `Settings.ts:73`) | beide trennen v301 von dev |
| `version-live4` (neu) | drittes Merkmal: zehn "entdeckbare" NPC-Skripte (nur dev) | Namen aus dev-Quelltext (10), im Bot 0, synthetischer Treffer wird gefunden | 10 / 0 / ja |
| `version-augs` | Augmentierungs-Tabellen gegen Spielstaende (Charisma-Produkt) | 82 Kontrollpaare ohne betroffene Aug | 6,66e-16 beide Fassungen |
| `version-bitnodes` | Generator `bitnodes-tabelle.js` einmal gegen v301, einmal gegen dev | dev-Lauf reproduziert die eingecheckte Tabelle | 0 von 544 Feldern weichen ab |
| `version-konst` | 23 Einzelwerte + Preise + Hash + Favor | zwei absichtlich falsche Zeilen muessen auffallen | beide erkannt, 0 rote |
| `version-konst2` (neu) | 19 Tabellen (Black Ops, Skills, Reise, Gang, Contracts, RAM, Boerse, Hash) x 2 Fassungen | Vindictus `rankLoss` verfaelscht 20000 -> 20001 | genau 1 Abweichung gemeldet; danach 38/38 OK |
| `version-konstliste` | alle 157 Modul-Literalkonstanten in `src/` | acorn-Zaehlung gegen Regex-Zaehlung | 96 = 96 (0,0 %) |
| `version-liste` (neu) | alle Dateien, die sich nach Normalisierung unterscheiden | `Augmentations.ts` drin, `Hacking.ts` nicht | ok |
| `version-nsdiff` | ns-Funktionen Rumpf fuer Rumpf (Wrapper-Umstellung `(ctx)=>(a)=>` -> `(ctx,a)=>` herausgerechnet) | alte/neue Wrapperform gleich, geaendertes Literal erkannt | ok |
| `version-semdiff` | Klassen/Funktionen/Objekteintraege je Datei | Umformatierung gleich, geaenderte Zahl erkannt | ok |
| `version-zahlen` | geaenderte Zahlenliterale je Datei | Kommentar/String egal, Zahl erkannt, Augmentations.ts drin | ok |
| `version-zitate` + `version-zitat-hunks` (neu) | 1479 Fundstellen `Datei.ts:Zeile` im Bot gegen die Diff-Hunks | bekannte geaenderte Stelle erkannt, unveraenderte nicht | 68 Gruppen, alle mit treffendem Hunk |
| `version-ui` | UI-Literale der DOM-treibenden Dateien gegen beide Quellen | "Opened SSH Port(22)!" nur live, "(22)" nur dev | ok |
| `version-tsc` | Bot gegen v301-`.d.ts` und dev-`.d.ts` typgeprueft | erfundener dev-only Aufruf muss live rot, dev gruen sein | 7 Diagnosen live / 0 dev |
| `version-rechner` (neu) | welche Spieldateien die Audit-Rechner lesen, und ob sie sich unterscheiden | Augmentations.ts betroffen, Hacking.ts nicht | ok |
| `version-cha` (neu) | `netz-lab.mjs` (NETZ-4) mit v301-Katalog | dev-Lauf muss 22,51 und 3,8e30/4,5e16/4,8e9/8,4e3 reproduzieren; Skill-Formel 6/6 am Spielstand | ok / 6 von 6 exakt |
| `version-apibreak` (neu) | trifft die 3.0.2-Migration Skripte im Spielstand? | synthetischer Treffer 1, ohne 0; echte Skriptform: 600 Skripte mit `main` sichtbar | ok |

## 2. Welche Fassung laeuft LIVE

`VersionSave` steht in allen 203 Staenden auf **51** (`SaveObject.ts` beider Baeume; `Constants.ts:10`
beider Baeume: 51). Es trennt v3.0.1 und dev nicht. Getrennt wird ueber Merkmale, die nur eine
Fassung schreibt:

| # | Merkmal | v3.0.1 (live) | dev | Befund in den Staenden |
|---|---|---|---|---|
| 1 | `RunningScript.scriptKey` im Spielstand | Feld vorhanden (`RunningScript.ts:71,95,169`) | Feld entfernt (Commit `b0ef5098`, 13.06.; `RunningScript.ts` dev ohne `scriptKey`) | alle **132.728** RunningScripts tragen es, 201 Staende (2 ohne RunningScripts) |
| 2 | `SettingsSave.EnableSaveDataBackupReminder` | fehlt | `Settings.ts:73` (Commit `864e9ca5`, 18.07.) | **0 von 203** Staenden |
| 3 | zehn entdeckbare NPC-Skripte (`guessing_game.wip.js` u. a.) auf `n00dles`, `helios`, `lexo-corp`, ... | gibt es nicht | `ServerHelpers.ts:411-420`, `servers.ts:275,300,318,388,669,842,1180,1488` (Commit `b48eb628`, 16.07.) | **0 von 202** Staenden |
| 4 | Charisma-Multiplikatoren von fuenf Augmentierungen (Eichung) | 1,3 / 1,2 / 1,1 / 1,1 / 1,05 | 1,15 / 1,1 / 1,05 / 1,05 / 1,03 | 23 Staendepaare mit zugekaufter Aug: Ist = Soll(v301) auf **5,55e-16**, Soll(dev) bis **1,43e-1** daneben |

Zeitraum der Staende 03.09. 23:13 bis 04.10.2026 11:17 UTC. Merkmale 1-3 koennen nur dann
gleichzeitig falsch liegen, wenn der Bot die Dateien/Einstellungen entfernt: Der Bot kennt die
Namen aus Merkmal 3 nicht (0 Treffer in `src/`), und seine `ns.rm`-Aufrufe treffen nur Dateien
unter `data/`.

Gegenprobe der Gegenrichtung (Eichung "Ausschluss nur gueltig, wenn das Werkzeug den Fall zeigen
kann"): `version-live4` findet das Merkmal in einem synthetischen AllServersSave; `version-apibreak`
liest in den echten Staenden 600 Skripte mit `async function main` und 9 mit `destroyW0r1dD43m0n`
- die Skript-Traversierung sieht also echten Quelltext, und "0 Treffer" ist belastbar.

Direkt aus dem Spiel erfragen konnte ich es nicht (Regel: Spiel nicht anfassen); die direkte
Antwort lautet `ns.ui.getGameInfo().version` (VERS-5).

## 3. Was unterscheidet v3.0.1 und dev

### 3.1 Umfang

- dev-Kopf `79e5cd8` (13.08.2026) ist 171 Commits nach `3162fd2` (v3.0.1, 17.05.2026). 102 davon
  beruehren Dateien ausserhalb von Oberflaeche/Terminal/Doku/DevMenu/Themes, 69 nur Oberflaeche,
  Doku, Werkzeuge. Praefixe: UI 31, MISC 20, BUGFIX 20, API 16, DOCUMENTATION/DOCS/DOC 21, DNET 11.
- Dateien: 907 `.ts/.tsx` in dev; nach Normalisierung (ohne Kommentare, Leerraum, Schlusskommata)
  **228 verschieden oder neu**. `version-liste`: 220 gemeinsame Dateien geaendert (134
  Oberflaeche/Doku/Terminal, **86 Mechanik/API**), 6 nur in v301, 17 nur in dev. Von den 86 haben
  29 ein geaendertes Zahlenliteral (`version-zahlen`); die uebrigen sind Umbenennung, Text, Refactor.
- ns-Oberflaeche (`version-nsdiff`): 45 Eintraege mit anderem Rumpf oder anderer Parameterliste,
  0 nur in v301, 13 nur in dev. Nach Sichtung jedes Rumpfes sind acht inhaltlich anders:
  `tprint`/`tprintf` (Farberkennung, dev erkennt auch "[12:00] ERROR"), `spawn` (live bricht nur im
  Tutorial nicht ab), `getFileMetadata` (Host-Argument), `atExit` (lazy), `getCompanyPositionInfo`
  (Gehalt), `b1tflum3`/`destroyW0r1dD43m0n` (Pruefreihenfolge, optionales Ziel) und die
  Darknet-Funktionen. Die uebrigen 37 sind Wrapperform oder Umbenennung einer lokalen Variable
  (`scp`: `lits` -> `litFiles`). Keiner trifft ein Aufrufmuster des Bots (`ns.spawn(` 0 Treffer,
  `getCompanyPositionInfo` 0, `destroyW0r1dD43m0n(ziel, "boot.js")` mit gueltigem Ziel).

### 3.2 Aenderungen, die der Bot nutzt oder voraussetzt, und ob sie ihn treffen

| # | Aenderung | v3.0.1 (live) | dev | Bot-Stelle | Wirkung | Urteil |
|---|---|---|---|---|---|---|
| A1 | Charisma-Mults: DermaForce 1,05 / Primer 1,1 + exp 1,4 / Speech Enhancement 1,1 / Speech Processor 1,2 / Synthetic Heart 1,3 (Commit `0b7abbf1`) | `Augmentations.ts:520,1463-1464,1563,1580,1762` | 1,03 / 1,05 + 1,2 / 1,05 / 1,1 / 1,15: `:520,1464-1465,1564,1581,1763` | `src/buyaugs.js:339,404,412,413,420` (Tabelle aus dev) | Planer unterschaetzt Charisma-Gewinn, Gewicht 0,05 | **VERS-2**, klein |
| A2 | NeuroFlux: `dnet_money` neu (`0b7abbf1`, `ad622fc0`) | fehlt (`Augmentations.ts:1159-1195`) | `:1190` | `src/buyaugs.js:386` | Gewicht 0,1 x ln 1,01 je Stufe | unerheblich |
| A3 | BN12 `DarknetLabyrinthRewardsTheRedPill: 0` (`9aa05655`), BN13 `CharismaLevelMultiplier: 0,7` | BN12: Standardwert 1 (`BitNodeMultipliers.ts:64`); BN13: Feld fehlt (= 1) | `BitNode.tsx:954` / `:998` | `src/lib/bitnodes.json` (aus dev erzeugt); der Bot liest beide Felder nirgends | **VERS-7**, 0 Wirkung heute |
| A4 | Corporation: Produktionslimit 0 bei leerem Lager erzeugt NaN-Qualitaet (`3f971d67`) | `Division.ts:669-690` (kein Guard) | `Division.ts:656-658` (`if (outputAmount === 0) continue`) | noch kein Corp-Code (CORP-1/2 freigegeben) | Gewerk-Falle | **VERS-4** |
| A5 | Corporation: passiver Popularitaetsverlust 0,0001 je Marktzyklus (`d180d955`) | `Division.ts:196-198` | entfernt | - | 0,29 Popularitaet je 8 h, bedeutungslos | kein Befund |
| A6 | Corporation: Verkaufsformeln `eval` -> `expr-eval-fork` (`d4079446`, `44ece7bd`) | `Actions.ts:234,274,574`, `Division.ts:346,404,753` (jeweils `eval?.(...)`) | `helpers.ts:11-44` (keine Potenz, Funktionen, Vergleiche) | noch kein Corp-Code | "MAX", "MP*1.2", "PROD" gehen in beiden | Hinweis in VERS-4 |
| A7 | Infiltration `WireCuttingModel`: Farben `red/#FFC107/blue/white` -> Hex, `Question.toString()` -> `render()` (`36f7308f`) | `model/WireCuttingModel.ts:21,36,43,56-57` | `model/WireCuttingModel.tsx:25,40,47,60-63` | NETZ-1 (freigegeben, ungebaut) | Loeser, der Fragetext/Farbe liest, bricht in einer der Fassungen | **VERS-3** |
| A8 | `singularity.destroyW0r1dD43m0n(nextBN?)`: ohne Ziel in den BitVerse (`ff621348`); `b1tflum3` prueft `nextBN` (`18066d56`); Optionen frueher validiert (`9704fa07`) | `Singularity.ts:1153-1176`, `b1tflum3` :1139-1148 | `:1124-1176` | `src/exit.js:137,188`, `src/ausgang.js:260` (immer gueltiges Ziel + `"boot.js"`) | Verhalten bei gueltigen Argumenten gleich | kein Befund |
| A9 | `singularity.exportGameBonus()` -> `hasExportGameBonus()` (alte Form deprecated, `9755ade1`) | `Singularity.ts:1215` | `:1197-1204` | Bot ruft beides nie; Inventare nennen `hasExportGameBonus` | live existiert nur `exportGameBonus` | **VERS-8** |
| A10 | `getCompanyPositionInfo().salary` mit BN-Mults (`203bc078`) | `Singularity.ts:683` (`baseSalary * salaryMultiplier`) | `:656` | `src/bn4rep.js:2433` zitiert nur die Nachbarfunktion; Aufruf selbst: 0 | - | kein Befund |
| A11 | Prestige: Heim-Ports schliessen (`c1a968ba`); Boerse nach Install ohne Zugang loeschen (`a965ed94`) | `ServerHelpers.ts:226-260`, `Prestige.ts:170-172` | `:259-263`, `:169-172` | `src/buyaugs.js:21`, `src/homeram.js:56`, `src/boerse.js:52,158`, `src/punish.js:10,312` zitieren diese Stellen | der Bot behauptet nur "RAM/Kerne bleiben, Positionen weg" - in beiden wahr | kein Befund |
| A12 | `RunningScript.scriptKey` entfernt, `title` lazy (`b0ef5098`, `a0735e00`) | `RunningScript.ts:71,95,169` | entfernt | Bot liest `scriptKey` nie (0 Treffer) | nur das Speicherformat (Merkmal 1) | kein Befund |
| A13 | Terminal-Aktionen (`backdoor`, `hack`, `grow`, `weaken`) laufen in dev per `setTimeout` in Echtzeit (`Terminal.timedAction`, `Terminal.ts:176-209`), live ueber Spielzyklen (`Terminal.process`) | `Engine.process` ruft `Terminal.process(numCycles)` | entfernt (`engine.tsx` dev) | `src/backdoor.js:84-102` (wartet auf den Serverzustand, nicht auf eine Uhr) | in einem gedrosselten Hintergrundtab wuerde ein `backdoor` hoechstens ~1 Timer-Wake (60 s) laenger | kein Befund, beim Cutover beobachten |
| A14 | RFA-Nachrichtentypen (`RFAMessage` -> `RFARequest/Response`, `1d7584a4`) | `MessageDefinitions.ts:4-30` | `:4-45` | `sync/*.js`, Bruecke Port 12525 | JSON auf dem Draht gleich (nicht gesetzte Felder entfallen) | kein Befund |
| A15 | Stocks: SF8-Pruefung als Hilfsfunktion, Fehlertext ohne Spoiler (`4d7eb89b`) | `StockMarket.ts` NS :151-153 | `checkSFAccess` :46-53 | `src/stocks.js:157` | `activeSourceFileLvl(8) <= 1` == `< 2`; der Bot wertet keinen Fehlertext aus (0 Treffer) | kein Befund |

Gegenstuecke ohne Bot-Bezug (geprueft, nicht aufgefuehrt): Darknet (`DarkNet/*`, 12 Dateien, ~25
Commits), Go (`patternMatching.ts`: "horizontal mirror" entfernt), Stanek (nur Logtext), Alias-API,
Grafting-UI ausserhalb New Tokyo (die API verlangt weiterhin New Tokyo: `Grafting.ts:60` / `:58`),
Zufallsort der Coding Contracts (`ContractGenerator.ts:192` gegen `:192`), Bladeburner (Texte;
`Bladeburner.ts` nutzt `changePopulationByCount` statt `pop +=`, `City.ts:63-73` klemmt nur auf
ganze Zahlen >= 0, hier ohne Wirkung; `Skill.ts:83` verliert den Gleitkomma-Guard, relevant erst bei
Stufen > 1e15).

### 3.3 Nur in dev vorhanden (der Bot kann sie unter 3.0.1 NICHT rufen)

`ns.isFullPort`, `ns.isEmptyPort`, `ns.enums.GangTaskName`, `ns.format.money`,
`ns.singularity.hasExportGameBonus`, `ns.ui.openCodeEditor/alias/unalias/getAllAliases/renderPage/
createConnectLink`, `ns.dnet.freezeServer`, `ns.getFileMetadata(file, host)` (zweites Argument),
`destroyW0r1dD43m0n()` ohne Argument. Kein Treffer in `src/` (version-tsc: nur gegen live 0
Diagnosen). Nutzen fuer den Bot nach dem Cutover: keiner mit messbarem Ertrag (`isFullPort` spart
nichts, die Rest-API hat der Bot nicht noetig).

## 4. Konstantenpruefung `src/` und `src/lib/`

**Methode.** (a) 157 Modul-Literalkonstanten (`version-konstliste`) auf Spielbezug sortiert; (b) die
Spielbezug-Konstanten und alle abgeschriebenen Tabellen automatisch gegen beide Quelltexte
(`version-konst`, `version-konst2`, `version-augs`, `version-bitnodes`); (c) alle 1479 `Datei.ts:Zeile`-
Fundstellen im Bot (`version-zitate`); (d) Gegenrichtung: welche Spieldateien aendern sich, und
liest der Bot etwas daraus (Abschnitt 3). Aus (d) folgt, was (a)-(c) nicht einzeln sehen koennen: Eine
Konstante, die der Bot abgeschrieben hat und die in einer UNVERAENDERTEN Spieldatei steht, ist in
beiden Fassungen gleich; ob sie gegen das Spiel stimmt, ist Gegenstand der Bereichsberichte
(`inventar-*.md`), nicht dieser Pruefung.

| Gruppe | Bot-Stelle | Spielstelle | Ergebnis live / dev |
|---|---|---|---|
| Hack-/Wachstums-/Weaken-Konstanten, Zeitfaktoren, Fortify | `lib/calc.js:14-25`, `bn4net.js` FORTIFY_* | `Server/data/Constants.ts`, `Hacking.ts:72-91` | OK / OK |
| Heim-RAM-Preis, Exponent 1,58, Kerne 7,5, Maximum 2^30, 8 Kerne | `homeram.js:238-242,256-264` | `PlayerObjectServerMethods.ts:30-44` | OK / OK |
| Reise 200000, MultipleAugMultiplier 1,9, NFG 1,14, Krankenhaus | `travel.js:244`, `buyaugs.js:461-463`, `lib/einbau.js:509` | `Constants.ts:28,36,41` | OK / OK |
| Darkweb-Programme (6 Preise), Tor 200000, Netburners | `darkweb.js:102` u. a. | `DarkWebItems.ts`, `Programs` | OK / OK |
| Aktienpreise WSE 200 Mio, TIX 5 Mrd, 4S 1 Mrd, 4S-API 25 Mrd, Kommission 100000, Takt 6 s | `stockaccess.js:50-54`, `boerse.js:64,67` | `StockMarket/data/Constants.ts` | OK / OK |
| Hash: Rang 250/100, Gym 50, Verkauf 4 -> 1 Mio | `hashes.js:98-106` | `HashUpgradesMetadata.tsx` | OK / OK |
| Favor 150, Favorformel, `ZIEL_REP` 462490 (Spiel 462490,07, Differenz < 1 Rep) | `favorweg.js` | `favor.ts`, `Constants.ts:31` | OK / OK |
| Black Ops: `BLACKOP_EINSATZ` 21 x (rankGain, rankLoss), `BLACKOP_DATEN` 21 x (Schwierigkeit, Gewichte, Verfall, kill/stealth), `chance.js` Typhoon, `lib/blackops.json` 21 x (Rang, Gewichte, Verfall) | `blade.js:2086,2252`, `chance.js:73-80` | `Bladeburner/data/BlackOperations.ts` | OK / OK (nur `desc`-Texte unterscheiden sich) |
| Skills: `SKILL_WIRKUNG`, `SKILL_MULTS`, `CHANCE_SKILLS` (7), `SKILL_PLAN` (11 Namen) | `blade.js:767,1046,2195`, `chance.js:27` | `Bladeburner/data/Skills.ts` | OK / OK |
| Reise: 6 Staedte, `ENEMIES` (6 Faktionen), `INVITE_REQS` (7 Faktionen: Staedte, Geld, Hacking) | `travel.js:241-290` | `Faction/FactionInfo.tsx`, `Locations/Enums.ts` | OK / OK |
| Gang: 5 Kampf-Gangs, 12 Mitglieder, Aufgabennamen; ausserdem 24 Aufgaben-Parametersaetze, `upgrades.ts`, `formulas.ts`, `Constants.ts` | `gang.js:533-544,594` | `Gang/*` | OK / OK; **alle 8 Gang-Dateien byte-gleich** (24 Aufgaben nach Namensauflosung identisch) |
| Coding Contracts: 30 Loeser = 30 Typen | `lib/loeser.js:47ff` | `CodingContract/Enums.ts` | OK / OK |
| Worker-RAM 1,7 / 1,75 / 1,75 = Basis 1,6 + 0,1 / 0,15 / 0,15 | `lib/calc.js:44` | `RamCostGenerator.ts:11,16-20` | OK / OK |
| Tech-Vendors (8 Orte) | `homeram.js:259-268` | `LocationsMetadata.ts` | OK / OK (dev fuegt "Void" hinzu, unrelated) |
| `AUG_TABLE` (136 Eintraege: Rep, Preis, Mults) | `buyaugs.js:305-460` | `Augmentations.ts` | gegen live 63 Abw. = 6 Charisma + 1 NFG-`dnet_money` + 4 NFG-Rundung + 52 Stanek-Zeilen (Tabelle fuehrt dort bewusst leer); gegen dev 56 (Rest) -> **VERS-2** |
| `HACK_AUGS` (56), `COMBAT_AUGS` (60) | `lib/hackaugs.js:32,211` | `Augmentations.ts` | 24 Abw. in beiden gleich: NFG 1,01 statt 1,01000262 (Donations, 2,6e-6 je Stufe) und Stanek relativ (Absicht, `hackaugs.js:22-25`) |
| `bitnodes.json` (15 Knoten, 544 Felder) | `src/lib/bitnodes.json` | `BitNode.tsx`, `BitNodeMultipliers.ts` | dev reproduziert die Datei exakt; gegen v301 5 Felder anders -> **VERS-7** |
| Registry-RAM (26 Eintraege) | `registry.json` | `RamCostGenerator.ts` | gemessen am laufenden Spiel (`ramMeasuredAt`), Kostenquelle `tools/ramkosten.js` liest v301 - versionsfest |

Rote Zeilen: **0** (`version-konst`, `version-konst2`). Die einzigen Abweichungen gegen live sind
Zeile `AUG_TABLE` und `bitnodes.json`.

Fundstellen im Bot (`version-zitate`, 1479): textgleich an gleicher Stelle 854, geaenderte Datei
aber Stelle unberuehrt 198, **Zeilen verschoben 336**, Stelle von einem Hunk getroffen 91. Die 91
(68 verschiedene Orte) sind einzeln gelesen (`version-zitat-hunks`): rund 48 Orte sind reine Wrapperform
(`(ctx) => (a) =>` -> `(ctx, a) =>`) oder Textaenderung; die uebrigen rund 20 sind A2, A8-A11 und A13-A15
aus 3.2 (`NetscriptFunctions/Singularity.ts`, `Prestige.ts`, `ServerHelpers.ts`, `StockMarket.ts`,
RFA, Terminal) - keine kippt eine Aussage des Bots. A1, A4, A7 werden vom Bot (noch) nicht zitiert.
Praktisch heisst das: 29 % der Fundstellen (427) zeigen auf Zeilen, die in der LAUFENDEN Fassung
woanders stehen. Wer im Sinne der `ENTSCHIEDEN`-Regel ("neue Fundstelle") nachprueft, liest sonst
die falsche Stelle (VERS-1).

## 5. Welche Audit-Rechner vom Unterschied betroffen sind

`version-rechner`: die Rechner unter `tools/` lesen 69 Spieldateien, **23 davon unterscheiden sich**.
Inhaltlich betroffen ist nur `Augmentation/Augmentations.ts` (Charisma): `netz-lab.mjs` (NETZ-4),
`aug-mults.mjs` und ihre Verbraucher (Charisma-Terme). Neu gerechnet (`version-cha`, Eichung
reproduziert die dev-Zahlen des Berichts):

| BN15, Charisma-Erfahrung fuer EternalLab 3000 (Red Pill) | dev (Bericht NETZ-4) | v301 (laufend) |
|---|---|---|
| Produkt aller 25 kaeuflichen Charisma-Augs | x22,51 | **x31,05** (+38 %) |
| Erfahrung bei vollem kaeuflichem Satz | 8,4e3 | **3,6e3** (Faktor 2,37 weniger) |
| Aug-Mult x1 / x2 / x4 | 3,8e30 / 4,5e16 / 4,8e9 | unveraendert (die Zeilen haengen nur am Mult) |
| Augs noetig fuer 1e8 Erfahrung (Mult >= 5,27) | 5 (Produkt 5,36) | 5 (Produkt 5,80) |
| Augs noetig fuer 1e7 Erfahrung (Mult >= 6,50) | 7 | 6 |

NETZ-4 bleibt ein RISIKO (ohne gezielten Charisma-Aufbau keine V1b), aber die Hebel sind unter
v3.0.1 etwas groesser und die Zahl benoetigter Augs sinkt um 0-1. Keine Aenderung der Route.
Alle anderen Rechner (Gang, Hacking, Bladeburner, Faktion, Hash, Boerse, Sleeve) lesen nur
Dateien, die in beiden Fassungen zahlengleich sind. `aug-einbau-v2.mjs` (Einbaulohnt-Rechnung V2)
nutzt Charisma nicht fuer die Black-Op-Chance (gewichtet 0), Eichung "Stufe charisma 57 = 57"
stimmt.

## 6. Cutover auf 3.0.2 (kommt irgendwann, ohne Vorwarnung)

Die Webversion unter `bitburner-official.github.io` wird (Annahme, nicht belegt) beim naechsten
Neuladen des Tabs nach einem Release von selbst aktualisiert. Erwartete Aenderung der Zahl: `VersionNumber` 51 -> 52 (`SaveDataMigrationUtils.ts`
dev `:652-654` prueft `ver < 52`, `Constants.ts:10` steht noch auf 51 - wird zum Release angehoben).
Was dann geschieht:

| Pruefpunkt | Ergebnis |
|---|---|
| API-Bruch-Migration `showAPIBreaks("3.0.2")` (`APIBreak.ts` dev) sucht in ALLEN Skripten nach `exportGameBonus` und `getServerDetails` und zeigt bei einem Fund einen nicht wegklickbaren Dialog (`canBeDismissedEasily: false`) - auch bei `showWarning:false` | neuester Stand: 102 Server, 647 Skripte, **0 Treffer** (ebenso die zwei davor) -> kein Dialog |
| Typen: Bot gegen v301-`.d.ts` und dev-`.d.ts` | 325 Diagnosen in beiden, **0 nur live, 0 nur dev** (Basisrauschen = JS-Inferenz) |
| Neu: `Settings.EnableSaveDataBackupReminder` (Standard an) -> Toast "not backed up for over 24 hours" alle 18000 Zyklen (`engine.tsx`) | nicht blockierend (Toast 30 s), erscheint aber stuendlich, solange `LastExportBonus` > 24 h zurueckliegt; der Bot holt den Bonus nur zufaellig (17 Abholungen in 44 Tagen, `inventar-player.md` PLAYER-3) |
| RFA (Bruecke) | gleiches JSON; `calculateRam`, `getSaveFile`, `pushFile` unveraendert |
| Speicherschluessel | dieselben 15 Schluessel |
| React / MUI / `__reactFiber$`-/`__reactProps$`-Haken (`buyaugs.js:791`, `darkweb.js:195`, `homeram.js:322`) | `package.json`: react, react-dom, @mui/* in beiden Baeumen auf gleicher Version |
| DOM-Selektoren (`terminal-input`, `span.factions-invites`, `.MuiDrawer-root`, ...) | Sidebar: nur `component="div"` an den Haken-Elementen, Terminal-Eingabe unveraendert |
| UI-Texte der 26 DOM-Dateien | 360 Literale in beiden gefunden, **0 nur live**, 583 unbeurteilbar (Bot-eigene Texte) |
| Zeitverhalten Terminal (A13) | wall-clock statt Spielzyklen; `backdoor.js` wartet auf den Serverzustand |
| noch zu bauen | WireCutting (VERS-3), Corporation-Verkaufsformeln und Limit 0 (VERS-4), Charisma-Tabelle wird mit dem Release von selbst wieder richtig (VERS-2) |

Die Merkmal-Rechner `version-live3`/`version-live4` kehren sich beim Release um (`scriptKey` fehlt,
Reminder vorhanden) und taugen als Regressionsmelder.

## 7. Befunde

Felder: Kategorie, Bot-Stelle, Quelle (v301 und dev), betroffene BNs, Ertrag, Aufwand, Prioritaet.

### VERS-1 (RISIKO, P2) - Der Referenzbaum heisst "3.0.2", ist aber dev; das laufende Spiel ist v3.0.1

- **Bot/Prozess:** `nodes/audit-2026-10-03/BRIEFING.md:22-25` ("Spielquellcode 3.0.2: reference/bitburner-src ... reference/v301 ist die alte 3.0.1"); `tools/bitnodes-tabelle.js:14-17` ("QUELLE 3.0.2, NICHT v301 ... das Spiel laeuft auf 3.0.2"); die Berichte `audit-2026-09-26/*` und `audit-2026-10-03/*` ("Spielquelle 3.0.2"); 427 von 1479 Fundstellen in `src/` zeigen auf dev-Zeilen.
- **Spiel:** `reference/v301/src/Constants.ts:7` "3.0.1" (Tag `v3.0.1`, `3162fd2`) gegen `reference/bitburner-src/src/Constants.ts:7` "3.0.2" (dev-Kopf `79e5cd8`). Merkmale Abschnitt 2.
- **Ursache:** Cloud-Auftrag 26.09. (`CLOUD-AUFTRAEGE-2026-09-26.md:15`) klonte `--branch v3.0.2`; der Tag existiert nicht (`git tag` endet bei v3.0.1), Rueckfall auf den Default-Zweig `dev`. Das Projekt wusste es schon einmal: `AUFTRAG-BAU-2026-09.md:21` ("`reference/v301/` ... einzige gueltige Referenz, dev nie als Beleg"), `BAUSTELLEN.md:1395-1425` (drei Charisma-Abweichungen "reference/ ist nicht das laufende Spiel"), `pruefstand/serve.js:34-48` (Umstellung 04.09.). Am 26.09. ging es verloren ("Fix B6" schaltete den Generator wieder auf dev).
- **Wirkung gemessen:** Charisma-Tabelle in 23 von 23 betroffenen Staendepaaren falsch (bis 14 %), zwei BitNode-Felder falsch (VERS-7), ein Inventar empfiehlt eine Funktion, die es live nicht gibt (VERS-8), 29 % der Fundstellen verschoben. Die meisten Rechner sind trotzdem richtig, weil 529 von 655 gemeinsamen Nicht-UI-Dateien byte-gleich sind (81 %, `version-zahlen`) - das war Glueck der Dateiauswahl, nicht Absicht.
- **Ertrag:** kein direkter; verhindert die Fehlerklasse "Zahl aus dem falschen Baum" (Beleg: sechs falsche Charisma-Zahlen im Bot, zwei falsche BitNode-Felder, ein falscher API-Name in einer Empfehlung). GERECHNET_GEEICHT fuer die Abweichungen, Wirkung darueber hinaus GESCHAETZT.
- **Empfehlung:** (1) `BRIEFING.md` und `CLAUDE`/Memory: "Spielquelle = `reference/v301/src` (v3.0.1, laeuft); `reference/bitburner-src` = dev-Vorschau, nur fuer Cutover-Vorbereitung". (2) `tools/bitnodes-tabelle.js:63` zurueck auf `reference/v301` (BN12-Stufen kann der Generator seit Fix B6) und Kopfkommentar `:14-17` korrigieren. (3) Fundstellen kuenftig als `v301:Datei.ts:Zeile`. (4) Neue Pruefer lesen zuerst `tools/audit/version-live3.mjs`.
- **known_before:** `BAUSTELLEN.md:1395-1425`, `AUFTRAG-BAU-2026-09.md:21`; neu: Ursache, Umfang, Rueckschaltung am 26.09.

### VERS-2 (SUBOPTIMAL, P3) - Charisma-Tabelle der Bots folgt dev

- **Bot:** `src/buyaugs.js:339` (DermaForce 1,03), `:404` (Primer 1,05 / exp 1,2), `:412` (Speech Enhancement 1,05), `:413` (Speech Processor 1,1), `:420` (Synthetic Heart 1,15); `:287-291` weiss, dass die Quelle dev ist.
- **Spiel:** live 1,05 / 1,1 + 1,4 / 1,1 / 1,2 / 1,3 (`Augmentations.ts:520,1463-1464,1563,1580,1762`), dev `:520,1464-1465,1564,1581,1763`. Eichung: 23 Paare, Soll(v301) = Ist auf 5,55e-16.
- **Gerechnet:** Die Werte sind geeicht (23 Paare); der Planer-Score ist die eigene Formel des Bots (`buyaugs.js:517,636`: 0,15 Distinct-Bonus + Summe Gewicht x ln Mult, Gewicht Charisma 0,05 `:502-507`), mit den Tabellenwerten des Bots gegen die live-Werte gerechnet: Score DermaForce 0,1683 -> 0,1693 (+0,6 %), Primer 0,1616 -> 0,1716 (+6,2 %), Speech Enhancement 0,1667 -> 0,1691 (+1,4 %), Speech Processor 0,1548 -> 0,1591 (+2,8 %), Synthetic Heart 0,1975 -> 0,2037 (+3,1 %). Summe der Nutzenverschiebung 0,024 (= 2,3 Mrd$-Aequivalent bei 0,0104 je Mrd, `:536`).
- **Folge:** Die Reihenfolge nach Score/Preis kann nur bei fast gleichem Verhaeltnis kippen, die Zahl der Kaeufe nicht; nicht jede Konstellation durchgerechnet. Beim Cutover wird die dev-Zahl wieder richtig - eine Korrektur auf live-Werte waere dann falsch. **Empfehlung:** nicht als Konstante nachziehen; entweder liegen lassen (Kommentar `:287`) oder die Charisma-Eintraege zur Laufzeit aus `ns.singularity.getAugmentationStats` lesen (stimmt in beiden Fassungen, `bbgraft.js:52` macht es vor). Aufwand S. Wirkung ~0, daher P3.
- **Betroffene BNs:** alle V2-Knoten (Wirkung ~0).

### VERS-3 (RISIKO, P3) - Infiltration NETZ-1: Wire-Cutting-Modell ist in beiden Fassungen verschieden

- **Bot:** fehlt (NETZ-1 freigegeben, ungebaut).
- **Spiel:** alle anderen Minispiel-Modelle, `InfiltrationRoot.tsx`, `InfiltrationStage.ts`, `Infiltration.ts` sind byte-gleich (nicht in der Aenderungsliste). Nur `WireCuttingModel`: live `ts` mit Farben `["red","#FFC107","blue","white"]` (`:21`) und `Question.toString()` (`:36,43,56-57`); dev `tsx` mit `["#D55E00","#F0E442","#0072B2","#FFFFFF"]` (`:25`) und `Question.render()` (React-Knoten, `:40,47,60-63`). Der Modellweg aus NETZ-1 (`state.stage.onKey(...)`, Fiber-Props) bleibt gueltig; React und MUI sind in beiden Baeumen gleich versioniert.
- **Falle:** Ein Loeser, der `question.toString()` oder `wire.colors` liest, ist in genau einer Fassung kaputt (`toString()` liefert in dev `[object Object]`). **Empfehlung:** die Loesung aus `stage.wiresToCut` lesen (steht in beiden Modellen) und den Fragetext nur zur Kontrolle; Bau gegen v301, Test gegen beide Modelldateien. Aufwand S, haengt am Bau von NETZ-1.
- **Betroffene BNs:** alle V2-Knoten. Ertrag: schuetzt die NETZ-1-Schaetzung (392.000 Ruf/h bzw. 20,6 Mrd$/h in BN2, GERECHNET_UNGEEICHT, `inventar-netz.md` 4.2) vor einem Totbau. GESCHAETZT.

### VERS-4 (RISIKO, P2) - Corporation in v3.0.1: `limitMaterialProduction(..., 0)` vergiftet die Materialqualitaet mit NaN

- **Bot:** fehlt (CORP-1/CORP-4, BN3, freigegeben, ungebaut).
- **Spiel live:** `Corporation/Division.ts:669-690`: `outputAmount = min(prod*frac, Limit*10*Zyklen)`; bei Limit 0 und Lager 0 wird `quality = max(1, (q*0 + t*0)/(0+0)) = max(1, NaN) = NaN` (`:683-690`), ebenso `averagePrice`; die NaN bleibt (jede Folgerunde rechnet mit NaN), Verkaufsmengen werden NaN. dev: `:656-658` `if (outputAmount === 0) continue;` (Commit `3f971d67`). Die Limit-API: `NetscriptFunctions/Corporation.ts:427-433`; "negativer Wert hebt das Limit auf" (`NetscriptDefinitions.d.ts` v301 `:10121`).
- **Empfehlung fuer den Bau:** niemals Limit 0 setzen (Limit entfernen mit -1 oder einen positiven Mindestwert), nach jedem Limit-Aufruf `getMaterial(...).quality` auf `Number.isFinite` pruefen. Verkaufsformeln nur mit Ziffern, `+ - * / ( )` und den Token `MAX`/`MP`/`PROD`/`INV` (in live `eval`, in dev `expr-eval-fork` ohne Potenz/Funktionen/Vergleiche - `helpers.ts:11-44`). Die Boost-/Lagerplatz-Rechnung des Corp-Berichts (`Division.ts` Rest) ist in beiden Fassungen gleich: die Abweichungen sind genau die aufgefuehrten.
- **Ertrag:** schuetzt CORP-1/2 (+330 Mrd nach 3 h, +600 Mrd nach 24 h je BN3-Lauf nach `inventar-corp.md`, dort ungeeicht). GESCHAETZT. Aufwand S (Regel im Bauauftrag).

### VERS-5 (NICHT_GENUTZT, P2) - Der Bot fragt die Spielfassung nie ab

- **Bot:** fehlt (`grep getGameInfo src/` = 0).
- **Spiel:** `ns.ui.getGameInfo()` -> `{version, versionNumber, commit, platform}` (`v301 NetscriptFunctions/UserInterface.ts:179-186`), RAM-Kosten **0** (`RamCostGenerator.ts:452`).
- **Wirkung:** Die Fassung musste aus Spielstaenden erschlossen werden (drei Merkmale + Eichung, Abschnitt 2); die Fehlannahme "3.0.2" blieb eine Woche unbemerkt. Beim Cutover (Abschnitt 6) merkt der Bot nichts; sein Wartungsmodell (`reference/` + Tests) wechselt unbemerkt die Grundlage.
- **Empfehlung:** einmal je Start `data/gameinfo.json` schreiben (`version`, `versionNumber`, `commit`, `seitWann`), bei Aenderung ein Ereignis (`lib/events.js`) und eine /bb-Zeile "FASSUNG GEWECHSELT -> Cutover-Liste Abschnitt 6 durchgehen"; nicht blockieren. Aufwand S, 0 GB.
- **Ertrag:** spart die Rekonstruktion (hier zwei Laeufe) und macht den Cutover sichtbar. GESCHAETZT.

### VERS-6 (SUBOPTIMAL, P2) - Statische Pruefungen laufen gegen die dev-`.d.ts`

- **Bot:** `src/NetscriptDefinitions.d.ts` ist **byte-gleich** zu `reference/bitburner-src/src/ScriptEditor/NetscriptDefinitions.d.ts` (`cmp`: gleich; gegen v301: verschieden ab Zeichen 10350). Verbraucher: `tools/audit/scope-alle.mjs`, `tools/audit/datenfluss.mjs`, `tools/test-verbote.js`, die Scope-Pruefer.
- **Spiel:** dev-only (Abschnitt 3.3): `isFullPort`, `isEmptyPort`, `format.money`, `singularity.hasExportGameBonus`, `ui.openCodeEditor/alias/unalias/getAllAliases/renderPage/createConnectLink`, `dnet.freezeServer`, `getFileMetadata(file, host)`. Ein Aufruf davon in einem `try/catch` ist unter 3.0.1 still tot - genau die Fehlerklasse der vier toten Black-Op-Aufrufe (03.10.).
- **Heute:** `version-tsc`: 0 Diagnosen nur gegen live (auch `gang.js` und `lib/einbau.js` vom 04.10.); die Selbstprobe mit sieben erfundenen dev-only Aufrufen schlaegt gegen v301 rot an.
- **Empfehlung:** v301-`.d.ts` als `tools/lib/NetscriptDefinitions.v301.d.ts` einchecken (`reference/` ist ignoriert), `version-tsc` als `tools/test-live-api.js` in `test-alles` aufnehmen mit Fingerprint-Datei der 325 bekannten Basisdiagnosen (neue Diagnose = rot). Aufwand S. **Ertrag:** haelt die Klasse "dev-only Aufruf in live" dauerhaft aus dem Bot; zaehlt nicht in Rang/h. GESCHAETZT.

### VERS-7 (FEHLER, P3) - `bitnodes.json` stammt aus dev und weicht in fuenf Feldern vom laufenden Spiel ab

- **Bot:** `tools/bitnodes-tabelle.js:63` (`REF = reference/bitburner-src`), Datei `src/lib/bitnodes.json`: `knoten["12"]`/`knotenLevel` `DarknetLabyrinthRewardsTheRedPill: 0` (4 Felder), `knoten["13"].CharismaLevelMultiplier: 0.7`.
- **Spiel live:** BN12-Labyrinth-Red-Pill-Faktor = Standardwert **1** (`BitNodeMultipliers.ts:64`, `BitNode.tsx` v301 setzt es nur in BN8 `:792`); BN13 hat **kein** `CharismaLevelMultiplier` (= 1). dev: `BitNode.tsx:954`, `:998` (Commits `9aa05655`, `0b7abbf1`).
- **Wirkung heute 0:** `grep` in `src/` liest beide Felder nirgends (`kampfaugs.js:245` baut `<stat>LevelMultiplier` nur fuer Kampfwerte). Falle fuer die Zukunft: ein BN13-Charisma-Rechner (Diplomacy, Rekrutierung) saehe 0,7 statt 1,0 (live: Charisma 43 % leichter zu leveln).
- **Empfehlung:** Generator auf v301, Datei neu erzeugen, `test-b6-bitnodes-tabelle.js` laufen lassen. Aufwand S.
- **Betroffene BNs:** BN12 (nicht auf der Route), BN13.

### VERS-8 (FEHLER, P3) - Inventare nennen API-Namen, die es unter 3.0.1 nicht gibt

- **Stelle:** `inventar-player.md:182,194` (PLAYER-3: "`hasExportGameBonus()` sagt, ob er faellig ist (`Singularity.ts:1201-1204`)"), `inventar-sing.md:78` (S17), `:89` (B9: `ns.ui.alias`, `renderPage`).
- **Spiel live:** `ns.singularity.exportGameBonus()` (`Singularity.ts:1215`, d.ts v301 `:1943`: "Returns Backup save bonus availability"); `hasExportGameBonus`, `ui.alias`, `ui.renderPage` existieren erst in dev (`Singularity.ts:1197-1204`, `UserInterface.tsx`).
- **Folge:** Wer PLAYER-3 (P3, Aufwand S) bauen wuerde, riefe unter 3.0.1 `undefined`. **Empfehlung:** im Bauauftrag `exportGameBonus()` schreiben (unter 3.0.2 ist es deprecated, aber bis zur Entfernung nutzbar; bei Wechsel `hasExportGameBonus`).
- **Ertrag:** keiner; verhindert einen Fehlbau.

### VERS-9 (TOT, P3) - Zwei Diagnoseskripte rufen entfernte/nicht vorhandene Funktionen

- **Bot:** `src/formcheck.js:105` `ns.getFactionFavor?.(f) ?? 0` (die Funktion existiert nur als `ns.singularity.getFactionFavor`; der optionale Aufruf macht daraus still **Favor 0 fuer jede Faktion** - die Messung "Rep/s mit Favor" ist damit falsch); `src/torprobe.js:23` `ns.formatNumber(...)` (seit 3.0.0 entfernt, wirft `Function removed in 3.0.0. Please use ns.format.number() instead`).
- **Spiel:** `NetscriptFunctions.ts:1541-1544` (v301, `setRemovedFunctions`), d.ts v301 `:2441` (`Singularity.getFactionFavor`). Beide Fassungen gleich.
- **Wirkung:** nur Einmal-Diagnosen, in `registry.json` und im Autopilot nicht verdrahtet (0 Treffer ausserhalb der Dateien). Ausgabe von `formcheck.js` waere irrefuehrend. Gefunden ueber die 325 Basisdiagnosen (`version-tsc`: Typ `NS`, Eigenschaft fehlt - die einzigen zwei echten API-Namen darin; die uebrigen 323 sind JS-Typrauschen).
- **Empfehlung:** `ns.singularity.getFactionFavor`, `ns.format.number`. Aufwand S, Ertrag 0 (Diagnose).

## 8. Abdeckungsmatrix

| # | Flaeche | Kategorie | Befund |
|---|---|---|---|
| 1 | Fassungserkennung zur Laufzeit | NICHT GENUTZT | VERS-5 |
| 2 | Fassungsetikett Referenzbaum, Briefing, Generator | SUBOPTIMAL | VERS-1 |
| 3 | Fundstellen im Bot (1479, 29 % dev-Zeilen) | SUBOPTIMAL | VERS-1 |
| 4 | Hacking-/Server-Formeln und Zeitfaktoren (`calc.js`) | OPTIMAL | - |
| 5 | Heim-RAM, Kerne, Darkweb-/Reisepreise | OPTIMAL | - |
| 6 | RAM-Kosten (gemessen, `ramkosten` aus v301) | OPTIMAL | - |
| 7 | `AUG_TABLE` (136) | SUBOPTIMAL | VERS-2 |
| 8 | `HACK_AUGS`/`COMBAT_AUGS` (116) | OPTIMAL | - |
| 9 | Black-Op-Tabellen, `blackops.json`, `chance.js` | OPTIMAL | - |
| 10 | Bladeburner-Skills, Skillplan | OPTIMAL | - |
| 11 | Gang (Konstanten, Fraktionen, Aufgaben, Formeln) | OPTIMAL | alle Dateien byte-gleich |
| 12 | Hash-Upgrades | OPTIMAL | - |
| 13 | Boerse (Preise, Takt, Kommission, SF-Pruefung) | OPTIMAL | - |
| 14 | Reise-/Fraktionstabellen (`travel.js`) | OPTIMAL | - |
| 15 | Coding-Contract-Typen und Loeser | OPTIMAL | - |
| 16 | `bitnodes.json` | SUBOPTIMAL | VERS-7 |
| 17 | Favor/Spenden/Faktionsruf | OPTIMAL | - |
| 18 | Sleeves | OPTIMAL | unveraendert |
| 19 | Hacknet/Hashes | OPTIMAL | unveraendert |
| 20 | Singularity-Aufrufe (Sprung, Export, Verbinden) | OPTIMAL | A8, A9, A10 |
| 21 | Prestige/Reset (Boerse, Heim-Ports) | OPTIMAL | A11 |
| 22 | RFA-Bruecke | OPTIMAL | A14 |
| 23 | Speicherformat und Migration auf 3.0.2 | OPTIMAL | 0 API-Bruch-Treffer |
| 24 | Oberflaechentexte, Selektoren, React-Haken | OPTIMAL | 0 nur-live |
| 25 | Absicherung gegen dev-only Aufrufe | SUBOPTIMAL | VERS-6 |
| 26 | Diagnoseskripte mit entfernten Namen | TOT | VERS-9 |
| 27 | Terminal-Aktionen (backdoor) | OPTIMAL | A13 beobachten |
| 28 | Audit-Rechner (69 Spieldateien, 23 verschieden) | OPTIMAL | nur Charisma betroffen |
| 29 | Empfehlungen mit dev-only API-Namen | SUBOPTIMAL | VERS-8 |
| 30 | Corporation (geplant) | NICHT ANWENDBAR | Falle VERS-4 |
| 31 | Infiltration (geplant) | NICHT ANWENDBAR | Falle VERS-3 |
| 32 | Darknet, Go, Stanek (kein Bot-Code) | NICHT ANWENDBAR | kein Bot-Code |

Zaehlung: OPTIMAL 21, SUBOPTIMAL 6, NICHT GENUTZT 1, TOT 1, NICHT ANWENDBAR 3; zusammen 32.

## 9. Geprueft, kein Befund (und warum nicht angefasst)

- **Gang auf dev-Formeln gebaut (04.10.):** alle acht Gang-Dateien byte-gleich, 24 Aufgaben nach Namensauflosung identisch (`tasks.ts` v301 Literale gegen dev `GangTaskNameEnum`). Das P0-P2d-Paket gilt unveraendert.
- **Black-Op-Schwellen, Raid, Gym/Bladeburner (ENTSCHIEDEN):** alle zitierten Stellen (`Bladeburner.ts:1265-1290`, `BlackOperation.ts:55`, `Action.ts:195`) sind in v301 gleich; die geaenderten `Bladeburner.ts`-Stellen sind Text und `changePopulationByCount` (klemmt nur auf ganze Zahlen >= 0).
- **Home-Ports beim Prestige (dev):** der Bot ruft nie `nuke/brutessh` auf `home`.
- **Zufallsort Coding Contracts:** der 200er-Rueckfall in live ist praktisch unerreichbar bei ~25 gekauften und ~75 NPC-Servern; der Bot sucht Vertraege per Breitensuche ueber alle Server.
- **`ns.print(Error)`:** dev druckt Fehlerobjekte lesbar, live `{}`; der Bot gibt Fehler nur ueber `String(e)`/`fehlertext(e)` aus (0 Treffer fuer `ns.print(e)`).
- **Fehlertexte:** der Bot wertet keinen Spielfehlertext aus (einzige Regex `guard.js:727` auf eigenen Text).
- **Nicht gebaut/geaendert:** keine Konstante in `src/` nachgezogen, weil keine einzige mit Wirkung abweicht; VERS-2 absichtlich nicht auf live-Werte gezogen (kippt beim Cutover zurueck).

## 10. Offene Fragen

1. **Direkte Bestaetigung** der Fassung: `ns.ui.getGameInfo()` einmal im Spiel (0 GB, lesend) - sagt `version` und `commit`. Ich durfte das Spiel nicht anfassen; die vier Belege aus Abschnitt 2 genuegen, ein Probelauf waere die schlichte Gegenprobe.
2. Soll `reference/bitburner-src` weiter existieren? Ja als Cutover-Vorschau (Abschnitt 6), aber unter dem Namen `reference/dev-preview` und mit Warnhinweis in `BRIEFING.md`. Umbenennen bricht Rechner-Pfade (13 Rechner lesen den Pfad) - Eric entscheidet.
3. Release-Termin 3.0.2 unbekannt; `Constants.ts` dev meldet "Dev version last updated 17 May 2026" (Changelog-Text, nicht der Commit). Der Cutover passiert, sobald der Tab neu geladen wird, nachdem die Seite aktualisiert wurde.
