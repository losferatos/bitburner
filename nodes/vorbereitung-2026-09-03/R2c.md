# R2c — Doku-Formeln und Route (Stand der Doku, gelesen 2026-09-03)

Quellenlage: alle Formeln stammen laut Doku aus `reference/bitburner-src` v3.0.1 (Hacking- und Server-Konstanten dort „byte-identisch" mit dev, `doku/formeln-hacking.md` §5.1/§5.2). Zeilenangaben unten beziehen sich auf die Doku-Dateien im Repo, Spielcode-Fundstellen in Klammern so, wie die Doku sie nennt.

---

## 1. Formeln und Zahlen, die einen Neubau tragen

### 1.1 Hacking (`doku/formeln-hacking.md`)

**hack() Erfolgschance** (§1.1, Z. 95-133; `src/Hacking.ts:9`):
`chance = clamp(((max(1.75·skill,1) − reqSkill)/max(1.75·skill,1)) · (100−sec)/100 · mults.hacking_chance · (1 + int^0.8/600), 0, 1)`.
Ohne Root oder bei `sec >= 100` ist chance = 0. Konstante `hackFactor = 1.75`.

**Geldanteil pro Thread** (§1.2, Z. 135-168; `Hacking.ts:44`):
`p = clamp((100−sec)/100 · (skill − (reqSkill−1))/skill · mults.hacking_money · BN.ScriptHackMoney / 240, 0, 1)`. `balanceFactor = 240`, kein Intelligence-Bonus, Root wird hier nicht geprüft. Der gestohlene Betrag ist **linear** in den Threads (nicht kompoundierend).

**Zeiten** (§1.3, Z. 170-211; §5.2 Z. 624-641): `skillFactor = (2.5·reqSkill·sec + 500)/(skill+50)`; `hackTime[s] = 5·skillFactor / (mults.hacking_speed · BN.HackingSpeedMultiplier · intBonus)`; grow = 3.2-fach, weaken = 4-fach der hack-Basis (`growTimeMultiplier 3.2`, `weakenTimeMultiplier 4`). Darknet-Server haben fest 16 s Hackzeit.

**XP pro Thread** (§1.4, Z. 213-232): `(3 + 0.3·secBase) · mults.hacking_exp · BN.HackExpGain`.

**grow()** (§2.1, Z. 310-345; `ServerHelpers.ts`): `adjGrowthLog = min(ln(1 + 0.03/sec), 0.00349388925425578)`; `k = adjGrowthLog · (g/100) · BN.ServerGrowthRate · mults.hacking_grow · coreBonus`; `growthMultiplier(threads) = exp(k·threads)`. Dazu ein additiver $1/Thread-Term (§2.2).

**Unbrauchbar: `ns.growthAnalyze`** (§2.4, Z. 418-435; §8.8 Z. 1109-1112): `threads = ln(mult)/k`, ignoriert den $1/Thread-Term und rundet nicht — der Code-Kommentar sagt das selbst (`ServerHelpers.ts:69`). Für Batches gehört `ns.formulas.hacking.growThreads` (= `numCycleForGrowthCorrected`) verwendet, oder die eigene Newton-Raphson-Nachbildung in `src/lib/calc.js:230-261` (`doku/auffaellige-werte.md` §8, Z. 530-540: Formulas.exe bringt „Genauigkeitsgewinn: null", die 5 Mrd $ dafür taugen nur als Gegenprobe).

**weaken()** (§3.1, Z. 502-518): `0.05 · threads · (1 + (cores−1)/16) · BN.ServerWeakenRate` pro Aufruf; Untergrenze `minDifficulty`.

**Security-Zuwachs** (§4, Z. 566-590): hack-Erfolg +0.002/Thread (gedeckelt auf `ceil(1/p)` Threads), hack-Fehlschlag 0, grow +0.004/Thread (gedeckelt auf benötigte Threads), weaken −0.05·coreBonus.

**Konstanten** (§5.1, Z. 604-622; `Server/data/Constants.ts`): `BaseCostFor1GBOfRamHome 32000`, `BaseCostFor1GBOfRamServer 55000`, `HomeComputerMaxRam 2^30`, `ServerFortifyAmount 0.002`, `ServerWeakenAmount 0.05`, `CloudServerLimit 25`, `CloudServerMaxRam 2^20`.

**RAM-Kosten** (`doku/formeln-wirtschaft.md` §2.4, Z. 400): hack 0.10 GB, grow 0.15, weaken 0.15, Skript-Grundlast 1.6 GB. Einzelnes Skript maximal 1024 GB (`formeln-hacking.md` §8.8).

**Fallstricke aus dem Code** (§8.8, Z. 1109-1126): `ns.grow()` gibt 0 bei `moneyMax === 0`; `ns.weaken()` gibt die tatsächliche Senkung zurück; `opts.threads` darf die Skript-Threadzahl nicht übersteigen (Exception); `additionalMsec` auf [0, 1e9] begrenzt.

**Nicht im Code** (§9, Z. 1128-1151): kein „optimaler" Geldanteil f pro Batch, keine Zielserver-Bewertungsformel (Abschnitt 8.5 ist Herleitung, kein Zitat), Offline-Konstante `OfflineHackingIncome = 0.75` nur notiert.

**Server-Kennwerte nie hart eintragen** (`doku/strategie.md` §10.16, Z. 1248-1256): `moneyMax`, `minDifficulty`, `requiredHackingSkill`, `maxRam`, `cpuCores` und die Netztopologie werden bei jedem BitNode-Start ausgewürfelt (`ServerHelpers.ts:350-380`) — immer `ns.scan()`/`ns.getServer*` benutzen.

### 1.2 Progression (`doku/formeln-progression.md`)

**Level** (§1.1/§1.2, Z. 18-41; `formulas/skill.ts:7,17`): `level = clamp(floor(mult · (32·ln(exp + 534.6) − 200)), 1)`; Umkehrung `exp = e^((level/mult + 200)/32) − 534.6`. Konstanten 534.6, 32, 200 fest. Folge (`strategie.md` Nachtrag 20.08., Z. 1298-1317): Erfahrung wirkt logarithmisch, der Multiplikator linear im Exponenten — für Hacking 2500 braucht mult 1,563 2,6e24 Exp, mult 6,0 nur 2,3e8. „Grinden ist praktisch wertlos."

**Augmentierungspreise** (§2.2/§2.3, Z. 133-241; `AugmentationHelpers.ts:29-37, 127-161`):
- `moneyCost = baseCost · 1.9^k · BN.AugmentationMoneyCost`, k = Anzahl bereits in dieser Runde gekaufter Nicht-SoA-Augs (NeuroFlux zählt mit). `MultipleAugMultiplier = 1.9`; mit SF11: 1,824 / 1,786 / 1,767.
- `repCost = baseRep · BN.AugmentationRepCost` — **skaliert nicht** mit k (auch `schlupfloecher.md` A5, Z. 953-978). Rep wird beim Kauf nicht verbraucht (`strategie.md` §6.1).
- Zähler wird bei der Installation genullt → Kaufreihenfolge **teuerste zuerst** (Umordnungsungleichung, A5). Beispiel CyberSec 5 Augs: 397,5 Mio gegen 2,163 Mrd (Faktor 5,4; `strategie.md` §6.1 Z. 585-591).
- Tabelle 1.9^k: k=5 → 24,76; k=8 → 169,84; k=13 → 4.205 (`auffaellige-werte.md` §2: 13 NeuroFlux in der Warteschlange haben genau das verursacht).

**NeuroFlux Governor** (§2.3, Z. 177-225): `repCost = 500 · 1.14^Level`, `moneyCost = 750.000 · 1.14^Level · 1.9^k`; Rep-Anforderung bekommt den 1.9^k-Faktor **nicht**, das Geld schon. Level bleibt über Installs erhalten, wird erst beim BitNode-Wechsel zurückgesetzt (SF12 setzt Startwert). Wirkung +1,000262 % pro Stufe auf fast alles. NFG zählt für Daedalus' 30 Augs als **eine** (`reset-plan.md` Z. 72-74; `FactionJoinCondition.ts:130`). Rep ist Bestand, keine Summe: für Stufe N braucht es einmal 500·1,14^(N−1) (`ROADMAP-KORREKTUR.md` Z. 26-31).

**Rep aus Arbeit** (§3.1, Z. 372-382; §3.4 Z. 407-422): Hacking Contracts `repPerCycle = ((hacking + int/3)/975) · mults.faction_rep · (1 + int^0.8/600) · (1 + favor/100) · BN.FactionWorkRepGain · shareBonus`. `shareBonus = 1 + ln(shareThreads)/25` (schon ausgereizt bei 1,5373, `schlupfloecher.md` Rangfolge). Fokus-Strafe 0,8 ohne Fokus, außer mit Neuroreceptor Management Implant (dann konstant 1; `reset-plan.md` Z. 39-49).

**Favor** (§4, Z. 468-531; `formulas/favor.ts`): `favorToRep(f) = 25000·(1.02^f − 1)`, `repToFavor(r) = ln(1 + r/25000)/ln(1.02)`; `MaxFavor 35331`. Nur beim Aug-Reset gutgeschrieben: `setFavor(repToFavor(favorToRep(favor) + rep))`, Rep dann 0. BitNode-Wechsel nullt Favor. Wirkung: Rep-Rate ·(1 + favor/100); passiv `min(0.1, favor/1000 + 0.01)`. **150 Favor = 462.490 kumulierte Rep** schaltet Spenden frei (`BaseFavorToDonate 150 · BN.FavorToDonateToFaction`; BN3 0,5, BN8 **0**, BN12 ·1,02^lvl).

**Spenden** (§5, Z. 533-564; `formulas/donation.ts`): `rep = (amt/1e6) · mults.faction_rep · BN.FactionWorkRepGain` → ohne Mults **1 Mio $ = 1 Rep**, kein Deckel. Red Pill (2,5e6 Rep) = 2,5 Bio $ bei mult 1. `schlupfloecher.md` A0 (Z. 480-524): am gemessenen Bot 1.093,7 Rep/Mrd $ = 180 Rep/s gegen 4,91 Rep/s aus Arbeit — **Faktor 36,7**; der Spendenknopf ist ohne `isTrusted` klickbar (`DonateOption.tsx:31-42`).

**Reset-Faustregel** (§9.3, Z. 867-898; `strategie.md` §6.3 Z. 608-650): Wiederaufbau bis Level L um `e^(L/32 · (1/m_alt − 1/m_neu))` schneller; resetten, sobald das Produkt neuer `hacking`-Multiplikatoren ≥ 1,30 (37× bei L=500); unter 1,15 nicht, weil Neuanlauf 30-60 min Einrichtung kostet. Ausnahmen: kurz vor Faktions-Gate, kurz vor Rep-Schwelle, Daedalus-Runde (erst Red Pill, dann Reset). `auffaellige-werte.md` §3 (Z. 242-300): Sweet Spot **2-3 Kaufrunden zu je 10-15 verschiedenen Augs** (Geld 265 Mrd statt 1,2e6 Mrd bei einer Runde), gemessene erste Runde von null bis Install: 5,58 h.

**Daedalus/Ende** (§9.3 Z. 893-896): Daedalus 30 installierte Augs + Hacking 2500 (BN6/7: 35, BN15: 20, BN12: floor(min(30+1,02^lvl, 40)) — `bitnode-und-server.md` §2), Red Pill 2,5e6 Rep, `w0r1d_d43m0n` Hacking 3000·WorldDaemonDifficulty (BN2 15000, BN4 9000, BN5 4500 laut `ROADMAP-KORREKTUR.md` Z. 112-125).

### 1.3 Wirtschaft (`doku/formeln-wirtschaft.md`)

**Gekaufte Server** (§1.1, Z. 32-75; `ServerPurchases.ts:23-41`): `Preis = ram · 55000 · BN.CloudServerCost · BN.CloudServerSoftcap^max(0, log2(ram) − 6)`; RAM muss Zweierpotenz sein, sonst `Infinity`. In BN1 linear: 25 × 2^20 GB = 1,44 Bio $. Softcap ist in fast allen anderen Knoten > 1 (BN6/11: 2, BN8: 4, BN9: **CloudServerLimit 0**, BN10: Limit 0,6, MaxRam 0,5, Cost 5) — siehe 1.7.

**Hacknet** (§2.4, Z. 392-422): Kosten wachsen mit 1,85^n (Anzahl) und 1,04^L (Level), Ertrag je Node bei ~9.171 $/s gedeckelt → BN1 ohne SF9: 5-8 Nodes als Anschub in der ersten Stunde, danach nichts mehr. Mit SF9 (Hacknet-Server) kippt das Urteil: `Increase Maximum Money`/`Reduce Minimum Security` sind dauerhafte Hebel, erster Server amortisiert in 3,3 min, ab Server ~7 Schluss. BN9 selbst: kein Cloud-RAM, alles aus home, Fremdservern und Hacknet-Servern (`bitnode-und-server.md` §2 BN9).

**Heim-RAM/-Kerne** (§9 Phase 2, Z. 1379-1388): Heim-RAM bis ~64 GB, darüber ist Cloud-RAM pro GB ~9× günstiger; Heim-Kerne 7,5 Mrd für den ersten — nicht kaufen, `hack()` profitiert nicht. Heim-RAM ist zugleich der einzige Posten, der den Install überlebt (`strategie.md` §7.4).

**DarkNet** (§8.2, Z. 1137-1156; §8.5 Z. 1238-1265): Zugang für 30 Mio $ (Chongqing „Shadowed Walkway") oder 50 Mio (DarkscapeNavigator im Darkweb, braucht TOR 200k); kein Level-/Karma-Gate. Cache-Belohnungskette deterministisch: ServerProfiler → BruteSSH → … → SQLInject → **Formulas.exe** → WSE → TIX API → 4S Data (nicht 4S TIX API; 4S Data nicht in BN8). Labyrinth und Labor-Augs existieren **nur** in BN15 oder mit SF15 ≥ 1. Ohne SF15 muss DarkscapeNavigator in jedem Lauf neu gekauft werden (`strategie.md` §7.2). Urteil (§9 Satz-Liste): „kein Geldsystem, sondern ein Freischalt-System"; `strategie.md` §10.13 rät in BN1 davon ab (22 Passwort-Minispiele, Netzmutation 1-10 s).

**Rangfolge Geldsysteme** (§9, Z. 1365-1437): Phase 1 Hacknet 5-8 Nodes + Crime; Phase 2 Cloud-Server linear; Phase 3 Aktienmarkt mit 4S (einziges System mit Zinseszins). Crime hart gedeckelt (~66.667 $/s), Gang braucht SF2 + 15 h homicide, Corporation 150 Mrd Einstieg + SF3.3, Bladeburner ~16.000 $/s „kein Geldsystem, sondern ein alternativer BitNode-Ausstieg".

**Contracts**: laut `schlupfloecher.md` Rangfolge (Z. 470) bereits gebaut (`src/contracts.js`, 54 KB), fünf Typen (A1); V8 (Z. 255-281): letzter Fehlversuch löscht den Contract, Install löscht alle Fremdserver-Contracts. Rep aus Contracts existiert (`formeln-progression.md` §3.6, nicht gelesen).

### 1.4 Börse (`doku/formeln-boerse.md`, komplett gelesen)

**Zugang** (§1; `StockMarket/data/Constants.ts`): WSE-Konto 200e6, TIX-API **5e9** (ohne das kein Bot), 4S Data 1e9 (UI), 4S TIX API **25e9**, Provision 100e3 je Kauf und je Verkauf → Positionen unter ~20 Mio $ sind bei 1 % Erwartung Verlust. Kostenmultiplikatoren: BN7 ×2, BN9 ×5/×4, BN11 ×4, BN13 ×10, BN12 ×1,02^lvl (`bitnode-und-server.md` §2). BN8: 250 Mio Startgeld, WSE+TIX ab Start, Shorts/Limit/Stop frei (`checkSFAccess` greift im Knoten nie; §8).

**Kursbewegung** (§2; `StockMarket.ts:239-330`): alle 6 s (`msPerStockUpdate 6e3`), `v = random()` **einmal für alle Aktien**, `av = v·mv/100`, `chc = (50 ± otlkMag)/100`, hoch `·(1+av)` / runter `/(1+av)` (asymmetrisch, leichte Aufwärtsdrift). Am Preisdeckel fällt chc auf 0,1.

**Zyklus** (§3): alle 75 Ticks = **7,5 min** kippt jede Aktie mit 45 % ihre Richtung → Schätzfenster länger als ein Zyklus liefert keine Information; ohne 4S braucht ein 5-Punkte-Signal ~100 Ticks = 10 min (§4).

**Forecast selbst setzen — der Weg für BN8** (§6): `grow(host, {stock:true})` hebt `otlkMagForecast` um 0,1, `hack(..., {stock:true})` senkt um 0,1, mit Wahrscheinlichkeit `moneyGrown/moneyMax`; Forecast wandert je Tick mit bis zu 95 % auf das Ziel zu. Kein WSE-Konto nötig (`validateHGWOptions`). In BN8 gilt `ScriptHackMoneyGain 0`, aber `ScriptHackMoney 0.3` → dem Server wird Geld entzogen, die Manipulation funktioniert. Grenze: der 7,5-min-Zyklus kippt auch das Ziel (`flipForecastForecast`). Eigene Trades verderben den Forecast gegen die eigene Richtung (§8, `StockMarketHelpers.ts:86,106`) → Positionsgröße an `shareTxForMovement` koppeln. Darknet-Volatilitätsmultiplikator bis ×4 (§8, `effects.ts:218-222`), wirkt nur auf Amplitude.

**Status**: `boerse.js` existiert laut `ROUTE.md` §7 (Z. 273-276) nicht; Aktienhandel in BN1 am 20.08. abgeschaltet, weil Depot 2,39 Bio band und beim Install ersatzlos verfällt (`strategie.md` Nachtrag Z. 1350-1360).

### 1.5 Drosselung im verdeckten Tab (`doku/drosselung.md`, komplett)

- Verdeckt landet der Motor bei **~1 Runde/min absolut** (16→1,0 am 21.08., 4,59→0,93 am 25.08., §1): Deckel „ein Timer-Aufwachen je Minute" (intensive Stufe), kein proportionaler Faktor. Engine holt Zyklen nach (`engine.tsx`), Netscript-Wartezeiten (`ns.sleep/hack/grow/weaken`) nicht.
- Drei Ebenen (§2): Sichtbarkeit (Sperrbildschirm macht alle Fenster OCCLUDED; ein sichtbarer Pixelstreifen reicht), Blink-Timer (Basis 1 s / intensiv 1 min; Bedingung `hidden && !audible`; WebSocket schützt seit 2021 **nicht**), Prozesspriorität (EcoQoS ab Win11 22H2).
- Tonanker (§3): Chromium misst Leistung des Stroms gegen **−72,247 dBFS**; Sinus liegt 3 dB unter Amplitude; gain 0,0005 = −69 dBFS (3,2 dB Reserve, Grenzfall), seit 25.08. gain 0,01 = −43 dBFS. Prüfstein ist das Lautsprechersymbol am Tab, nicht `ctx.state`. `ctx.sampleRate` mitloggen (16-kHz-Headsetprofil → Ton über Nyquist).
- Schalter (§4): `--disable-background-timer-throttling` (der wirksame), `--disable-backgrounding-occluded-windows`, `--disable-renderer-backgrounding`; Opera vorher komplett beenden.
- Ohne Neustart (§5): **Worker-Timer-Ersatz** ist der robusteste Weg (Worker-Drosselung standardmäßig aus; Bitburner greift `window.setTimeout` dynamisch ab, Patch wirkt sofort auf Engine und alle Netscript-Waits). Wake Lock und stummes Video nutzlos.
- Messung (§6): `src/sonde.js` → `data/sonde.json`, `haupt.median` ~4 ms / ~1.000 ms / ~60.000 ms.
- Strukturell (§7): Steam-Fassung hat `backgroundThrottling: false`; Brücke identisch, DOM/CDP-Werkzeuge bräuchten Umbau.
- Schlaf (`schlupfloecher.md` V10, Z. 298-320): Offline-Einkommen wird nur in `Engine.load()` berechnet; Aufwachen aus dem Schlaf läuft über `Engine.start()` → **null** Skripteinkommen für die Schlafphase; Tab schließen ist für lange Pausen objektiv besser. Offline-Faktions-Rep gibt es ohne laufende Arbeit für alle Fraktionen, mit laufender Arbeit mit vollem Fokusbonus (A7, Z. 1014-1037).

### 1.6 Schlupflöcher — erlaubt, genutzt, gestrichen (`doku/schlupfloecher.md`)

**Vermeiden (V-Liste):**
- **V1** (Z. 80-101): `ns.kill`/`killall(host,false)`/`scriptKill` auf sich selbst setzen nur `stopFlag`; eine Schleife ohne ns-Aufruf läuft ewig und friert den Tab ein → nach jedem Selbstmordpfad sofort `return`.
- **V2** (Z. 103-123): Install tötet alle Skripte, startet nichts neu; Wiederanlauf nur über Autoexec-Skript (Options, `NetscriptWorker.ts:251-257` sortiert es vorne ein) oder Seiten-Reload. Laut Kontext (Memory-Index) ist Autoexec=boot.js seit 02.09. gesetzt.
- **V3** (Z. 125-141): Install ruft `initStockMarket()`, Positionen weg ohne Auszahlung; Zugänge überleben bis zum BitNode-Wechsel.
- **V11** (Z. 321-331): zwei Tabs = Save-Rennen auf denselben IndexedDB-Schlüssel (`bitburnerSave/savestring/save`), letzter Schreiber gewinnt.
- **V12** (Z. 334-352): `Script.ramUsage` wird gecacht; nach `scp`/Bibliotheksänderung abhängige Skripte neu schreiben oder Spiel neu laden — betrifft den Brücken-Sync direkt.
- V4 (synthetischer Tastendruck in Infiltration hospitalisiert), V5 (`ns.prompt`/`nextPortWrite` hängen ewig), V6 (RAM-Rechnung namensbasiert), V8, V9 (`ns.rm` auf .exe endgültig), V14 (`startWork` bricht laufende Arbeit still ab), V15 (Programmbau über 99,995 % abbrechen zerstört Fortschritt) — nur Überschriften gelesen (Gliederung Z. 143-437).

**Nutzen (Rangfolge nach Engpass, Z. 441-478):**
1. Exploit-System SF−1 (§3.2/3.3, Z. 1243-1331): `ns.exploit()`, `ns.rainbow("noodles")`, `ns.bypass(document)` = 1,001³ auf `mults.hacking`, überlebt jeden Reset; danach einmal neu laden. Laut `reset-plan.md` Z. 138-142 am 20.08. eingesammelt. Weitere zwei Exploits (d)(e) für 20 s bzw. 16 min Wartezeit.
2. **A0 Spendenweg** ab Favor 150 (oben).
3. A9 Reload mit laufender Arbeit gibt dauerhaften Fokus (+25 %) — ungemessen.
4. A5 Rep skaliert nicht mit der Warteschlange (Planungsregel).
5. A2 IPvGO: +81,27 Favor bei der bespielten Gegner-Faktion — hoher Aufwand.
6. A3 passive Rep in allen Fraktionen (erst ab Favor 90 nennenswert).
7. A4 `__reactProps`-Technik für alle zwölf `isTrusted`-Klicksperren — schon gebaut (join.js).
- Backdoor-Regel aus `auffaellige-werte.md` §4/6: `avmnite-02h` 2,1 s, `I.I.I.I` 2,9 s → zwei Fraktionen für fünf Sekunden Spielzeit.
- **Gestrichen** (§4, Z. 1332-1499): A6 SoA, A8 Casino, A11.3 globalThis, Dev-Menü, Spenden ohne Favor 150, Favor-Aufteilung, Contract-Farming, Save/Load, risikoloser Aktiengewinn, Hacknet in BN1, Infiltration, Singularity ohne SF4 („wirklich zu": `checkSingularityAccess` wirft, RAM wird trotzdem berechnet, `bitnode-und-server.md` Z. 664-700).

### 1.7 Reset-Plan: was Install und BitNode-Wechsel löschen und behalten

**Aug-Install** (`formeln-progression.md` §8, Z. 789-814; `strategie.md` §7, Z. 675-726; `reset-plan.md` Z. 77-87):
- Weg: Skills auf 1, Geld auf **1.262 $**, alle gekauften Server, alle Programme außer NUKE/b1t_flum3 (Formulas.exe kommt nur mit SF5 zurück), Faktionen/Rep/Jobs/Backdoors, Stadt → Sector-12, alle Server neu erzeugt (Contracts weg), TOR, DarkscapeNavigator ohne SF15, Aktienpositionen (nicht der Zugang), `Go.nodePower`.
- Bleibt: installierte Augs, home-RAM und -Kerne, Skripte auf home, Favor (aufgestockt um ungenutzte Rep), Karma, NFG-Level, Source Files, Börsenzugänge (WSE/TIX/4S), Sleeves, Stanek, Einladungen mit `keepOnInstall` (neun Megakonzerne + Fulcrum), Startpakete aus CashRoot/PCMatrix/Neurolink. Bladeburner-Fortschritt überlebt den Install vollständig (`ROADMAP-KORREKTUR.md` Z. 60-66).
- Prozedur (`reset-plan.md` Z. 89-136): 0. Depot liquidieren, 1. warten bis nichts mehr kaufbar (`augplan.js`), 2. Nachtsteuerung stoppen, 3. Arbeit **ganz** beenden (nicht nur entfokussieren — `Page.Work` blendet die Seitenleiste aus, `GameRoot.tsx:328-330`), 4. echte Augs `--nfgdepth 0`, 5. Warteschlange prüfen, 5b. NeuroFlux **zuletzt**, 6. Install (Seite lädt nicht neu, `setInterval` überlebt, Wiederanlauf zuletzt 100 s). Merksatz Z. 155-158: „Ein steigendes Guthaben beweist nichts, ein fallendes auch nicht — der Zustand entscheidet" (drei Skripte am selben Tag an dieser Falle).

**BitNode-Wechsel** (`ROUTE.md` §2, Z. 39-59; `Prestige.ts`): zusätzlich Favor 0 für jede Faktion und Firma, home auf 32 GB (128 GB mit SF9.2, `Prestige.ts:242-243`) und 1 Kern, Augmentierungen, Karma, Gang, Corporation, Bladeburner: null; Börsenzugänge weg. **Überleben nur `home.scripts`, Intelligence, Source Files.** „Ein Zweitlauf hat null mechanischen Rabatt." Nach dem Wechsel läuft nichts, bis ein Autostart greift (`ROADMAP-KORREKTUR.md` Z. 105-110).

---

## 2. Die Route (`src/route.json`, Stand 2026-09-02) und ihre Gründe

Kopfzeile: Quelle `nodes/AUDIT-ROADMAP-2026-08-24.md` Abschnitt 2, „wird von niemandem geändert"; `ausgang.js` liest die Datei auf home; V2 = Bladeburner (21 Black Ops), V1 = Red Pill + `w0r1d_d43m0n`, V1b = Red Pill aus dem Darknet-Labor; `braucht` = Datei auf home, sonst Eintrag übersprungen und bei jedem Lauf gemeldet; BN15 vor Eintritt prüfen (Labyrinth-Gewerk fehlt); Änderungen nur mit grünem `node tools/test-route.js`.

| # | node | level | verfahren | braucht | Grund laut ROUTE.md §3 (Z. 61-95) / ROADMAP-KORREKTUR |
|---|---|---|---|---|---|
| 1-2 | 10 | 2, 3 | V2 | — | Je SF10-Stufe ein dauerhafter Sleeve (`SleeveCovenantPurchases.tsx:63`); hebt die „EINE laufende Handlung"-Grenze für ~35 Restläufe |
| 3-4 | 4 | 2, 3 | V2 | — | SF4.2/4.3 teilen Singularity-RAM durch 4 bzw. 16: `b1tflum3` 257,6→65,6→17,6 GB, `destroyW0r1dD43m0n` 512→128→32 GB (`RamCostGenerator.ts:219-220`) — entscheidet, ob Wiederanlauf auf frisches home passt |
| 5-7 | 9 | 1, 2, 3 | V2 | hashes.js | SF9.2: frisches home 128 statt 32 GB (`Prestige.ts:242-243`), SF9.3 Gratis-Hacknet-Server je Reset; BN9 hat `CloudServerLimit 0`, `HackExpGain 0.05`, `HomeComputerRamCost 5` — „einziger Knoten mit echter Geldnot" |
| 8-9 | 1 | 2, 3 | V1 | — | SF1 16/8/4 % auf alle Multiplikatoren, Level 3 = ×1,28 (`applySourceFile.ts:14-48`) |
| 10-11 | 5 | 2, 3 | V1 | — | SF5 8/4/2 %, Level 3 = **×1,14** (nicht 1,24 — halbiert je Stufe, `applySourceFile.ts:82`), 300 Int-EXP je Abschluss, Formulas.exe dauerhaft |
| 12-14 | 12 | 1, 2, 3 | V1 | — | Billigste Pflichtläufe, Schwelle wächst nur mit 1,02^Stufe (ROUTE.md nennt „V1/V2", route.json legt V1 fest) |
| 15-17 | 2 | 1, 2, 3 | V2 | — | Pflichtblock beim besten Rangfaktor; nebenbei Gang-V1-Rückfall dokumentieren (nur dort `GangUniqueAugs 1`); BN2 `ServerMaxMoney 0.08`, `w0r1d_d43m0n` 15000 |
| 18-20 | 3 | 1, 2, 3 | V2 | — | Pflichtblock; BN3 `AugmentationMoneyCost 3`, `AugmentationRepCost 3`, `ScriptHackMoney 0.2` |
| 21-23 | 11 | 1, 2, 3 | V2 | — | SF11.3 senkt Chargenbasis auf 1,767 — erst Level 3 wirkt |
| 24-25 | 6 | 2, 3 | V2 | — | SF6.2/6.3 nur +4/+2 % Kampf, reine Pflicht; BN6 `DaedalusAugsRequirement 35`, `HackingLevelMultiplier 0.35` |
| 26-28 | 7 | 1, 2, 3 | V2 | — | Vor 13/14/15, weil SF7.3 „The Blade's Simulacrum" schenkt (Bladeburner + normale Arbeit gleichzeitig); BN7 `BladeburnerRank 0.6`, `BladeburnerSkillCost 2` |
| 29-31 | 14 | 1, 2, 3 | V2 | — | V1 doppelt gesperrt: `WorldDaemonDifficulty 5` und `FactionWorkRepGain 0.2`; `HackingSpeedMultiplier 0.3`, `CrimeSuccessRate 0.4`, `BladeburnerRank 0.6` |
| 32-34 | 13 | 1, 2, 3 | V2 | — | Höchster NeuroFlux-Bedarf (Korrektur: 125); Stanek nur hier; `HackExpGain 0.1`, `BladeburnerRank 0.45`, `GangSoftcap 0.3` |
| 35-37 | 15 | 1, 2, 3 | V2 | — | Schlechtester V2-Knoten (`BladeburnerRank 0.2`, `SkillCost 3`); Daedalus führt Red Pill dort **nicht**, Labor wäre der V1b-Weg (fünf Install-Zyklen, jeder würfelt das Netz neu, ROUTE.md §5 Z. 207-232); route.json legt V2 fest, Kopfzeile verlangt Prüfung vor Eintritt |
| 38-40 | 8 | 1, 2, 3 | V1 | boerse.js | Alternativlos: `BladeburnerRank 0` (Rang steigt nie), Gang/Corp 0, `ScriptHackMoneyGain 0`, `DarknetLabyrinthRewardsTheRedPill 0`; dafür `FavorToDonateToFaction 0` → Spenden ab Favor 0, Rep ist reine Geldfrage; braucht den Börsen-Bot, der laut ROUTE.md §7 nicht existiert |

Abweichung ROUTE.md → route.json: ROUTE.md (24.08.) beginnt mit BN5 L1 (lief) und BN6 L1 als „Prüfstein" (Z. 82-83); route.json setzt nach diesen offenbar erledigten Läufen auf (BN6 am 28.08. 17:05 abgeschlossen, ROUTE.md Z. 160-165). Summe route.json: 40 Einträge; ROUTE.md Z. 97: „rund 41 Restläufe, geschätzt 1.100 bis 1.900 Stunden".

**Kernbegründungen:**
- **Sortierregel** (ROUTE.md §1, Z. 20-37): Ziel ist Level 3 in 15 Knoten = 45 Läufe; „Beschleuniger zuerst, reine Pflichtläufe zuletzt", weil ein Beschleuniger auf alle Restläufe wirkt. Gegen 35-40 Rest-Läufe kippen Wiederholungsrechnungen ins Positive, die gegen 9-11 Rest-Knoten negativ waren.
- **V2 als Träger** (ROUTE.md §3 Z. 63-73): V1 trägt überall (NeuroFlux + Spenden), ist aber je Knoten teuer — Sockel aus 29 Augs, Favor-150-Bootstrap über 462.490 Rep, NFG-Kosten; in gedämpften Knoten Faktor 3-20. Struktureller V2-Vorteil (ROADMAP-KORREKTUR Z. 56-71): Bladeburner-Fortschritt überlebt den Install, Bonuszeit bis 5× (`min(storedCycles/5, 5)`).
- **Prüfstein BN6** (ROUTE.md §4, Z. 97-205): Erste Messung 25.08. Rang 29 nach 2 h (Schwelle 3.500) — durch Störungen (bn4life/bn4rep brachen Aktionen ab, Fähigkeitenkauf billigst statt wichtigst, Drosselung 1 Runde/min, Tracking-Vorrat leer) unbrauchbar. Zweite Messung 29.08.: ganzer Knoten in 19,2 Spielstunden, Rang 13.209 → 452.411 (Faktor 34), Exponent `dR/dt ~ R^1,32` (ohne Störphase a≈1,0, **Verdopplungszeit ~3,5 Spielstunden**), alle 21 Black Ops in 52 Spielstunden ab Beitritt. „V2 trägt" — der Zweistunden-Prüfstein selbst war die falsche Modellklasse (linear statt exponentiell). Einzige Störung dieser Größe: zu hohe Feuerschwelle für Black Ops (85.453 gegen 80.304 in vier Stunden).
- **ROADMAP-KORREKTUR (23.08.)**: der ursprüngliche „Bladeburner statt Hacking"-Beschluss stand auf einem Rechenfehler (Erfahrungsrate nur über RAM extrapoliert, `hacking_exp` 15,32 und `hacking_speed` 3,63 aus demselben Aug-Satz ignoriert → Faktor 300-3.000; NeuroFlux-Rep als Summe statt Bestand). Gegenkorrektur: QLink/SPTN-97 verlangen alle vier Kampfwerte 1.200/850 (UND), realistische Mult-Obergrenze 11,375 statt 22,89. Was blieb: BN4 zuerst, BN8 zuletzt, Bladeburner-Strukturvorteil. Der „Neue Reihenfolge"-Entwurf dort (BN5/BN11/BN1/BN2 früh, BN10 gestrichen) wurde von ROUTE.md **nicht** übernommen.
- **Nicht übernommen aus der Fremdprüfung** (ROUTE.md §6): „Wiederanlaufkette nie über BitNode-Wechsel gelaufen" — überholt (BN4→BN5 am 24.08. 17:18 und Wiederaufbau nach Install 05:52); „SF5.3 = ×1,1424" — korrigiert auf ×1,14.
- **Offene Baustellen** (ROUTE.md §7, Z. 271-290): 1. Börsen-Bot für BN8 (einzige echte Neuentwicklung), 2. Labyrinth-Gewerk für BN15 (~24 Rätsel-Löser, Netznavigator, Irrgarten-Tiefensuche), 3. V2 messen (erledigt), 4. NeuroFlux-Bedarf ist Optimierungsproblem, Zahlen 54/125/120 sind untere Kanten.

---

## 3. API-Änderungen v3, die den Bot betreffen (`doku/api-aenderungen-v3.md`, komplett; `strategie.md` §10.15)

Quelle: `src/NetscriptFunctions.ts:1531` `setRemovedFunctions` — die Funktionen sind **weg**, ein Aufruf bricht mit `REMOVED FUNCTION ERROR`-Dialog ab (aufgetreten 19.08. bei `ns.getPurchasedServers()`).

| entfernt | Ersatz |
|---|---|
| `purchaseServer`, `getPurchasedServers`, `getPurchasedServerCost`, `getPurchasedServerLimit`, `getPurchasedServerMaxRam`, `getPurchasedServerUpgradeCost`, `upgradePurchasedServer`, `renamePurchasedServer`, `deleteServer` | `ns.cloud.purchaseServer / getServerNames / getServerCost / getServerLimit / getRamLimit / getServerUpgradeCost / upgradeServer / renameServer / deleteServer` |
| `tail`, `moveTail`, `resizeTail`, `closeTail`, `setTitle` | `ns.ui.openTail / moveTail / resizeTail / closeTail / setTailTitle` |
| `nFormat`, `formatNumber`, `formatRam`, `formatPercent`, `tFormat` | `ns.format.number / ram / percent / time` |
| `getServerRam` | `getServerMaxRam` + `getServerUsedRam` |
| `getTimeSinceLastAug` | `Date.now() − ns.getResetInfo().lastAugReset` |

Weitere Streichungen in `corporation`, `gang`, `singularity`, `formulas.work` (je eigenes `setRemovedFunctions` unter `src/NetscriptFunctions/`). Zusätzlich fehlen in v3.0.1 gegenüber dev **`ns.isFullPort` und `ns.isEmptyPort`** — Port-Kommunikation über `peek()` gegen `"NULL PORT DATA"` und die Rückgabe von `tryWritePort()` (`strategie.md` Z. 1243-1246). Ports: stiller Überlauf, keine Persistenz (`schlupfloecher.md` V13). Praktische Lehre: `ns.ui.closeTail(pid)` wirkt nicht auf beendete Skripte, Fenster bleiben stehen. Nur in dev, nicht in v3.0.1: NFG `dnet_money`, BN13 `CharismaLevelMultiplier 0.7` (`bitnode-und-server.md` Z. 383-386; `formeln-progression.md` §10).

---

## Für den Prompt besonders tragend (Kurzliste)

1. Level ist `floor(mult·(32·ln(exp+534.6)−200))` — der Multiplikator, nicht die Erfahrung, ist der Hebel; Reset-Regel ≥1,30 Produkt neuer Hacking-Mults, 2-3 Kaufrunden à 10-15 Augs, teuerste zuerst, NFG zuletzt.
2. Rep-Anforderung skaliert nicht mit `1.9^k`; Rep wird beim Kauf nicht verbraucht; Favor 150 = 462.490 Rep = Spenden 1 Mio $/Rep (BN8 ab Favor 0).
3. `ns.growthAnalyze` unbrauchbar für Batching; `calc.js` bildet die Formeln bereits nach.
4. Install: Depot verkaufen, Arbeit ganz beenden, Autoexec/Reload für Wiederanlauf, Zustand statt Guthaben als Erfolgsbeweis. BitNode-Wechsel: nur `home.scripts` überleben, home 32 GB (128 mit SF9.2).
5. Verdeckter Tab = 1 Wakeup/min; Worker-Timer-Ersatz oder Opera-Flags; Rechner-Schlaf bei offenem Tab = null Skripteinkommen.
6. Börse für BN8: Forecast per `grow/hack {stock:true}` selbst setzen (±0,1 je Treffer, funktioniert trotz `ScriptHackMoneyGain 0`), Haltedauer < 7,5-min-Zyklus, Provision 2×100k je Runde, Position an `shareTxForMovement` koppeln.
7. Route fest aus route.json; V2 gemessen tragfähig (Verdopplung ~3,5 Spielstunden in BN6); `hashes.js` (BN9) und `boerse.js` (BN8) sind Pflichtdateien, Labyrinth-Gewerk für BN15 fehlt.
8. Nur `ns.cloud.*`, `ns.ui.*`, `ns.format.*`; keine `isFullPort/isEmptyPort`; Selbst-kill immer mit `return`.