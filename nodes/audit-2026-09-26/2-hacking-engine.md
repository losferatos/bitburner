# Audit 2 - Hacking-Motor (bn4net.js & Co.) gegen Spielquellcode 3.0.2

Stand der Daten: Spielstaende `~/bitburner-backups/LIVE_..._BN5L2_2026-09-26T16-04_hourly`,
`...T17-04_hourly` und `...T17-19_pre-install` (BN5.2, V1). Darin die Telemetrie des Bots
(`data/bn4net.json`, `data/bn4net-log.txt` auf home) und der echte Server-/Prozesszustand.
Alle Rechnungen als Node-Skripte im Ordner `scratchpad/audit/` (`expmodel.mjs`, `eich.mjs`,
`vis.mjs`, `batchmodel.mjs`, `margin.mjs`).

**Eichung vor jeder Aussage:**
- Levelformel nachgebaut: aus exp 1,4237e8 und Mult 7,166 kommt Level 2871 heraus, Spielstand 2871.
- Stapelmodell nachgebaut (stapelPlan, F_LEITER, kalenderPlaetze): phantasy 647 GB / 186.596.482 $/s,
  Bot-Telemetrie 647 / 186.594.160; the-hub 503 / 791.921.044 gegen 503 / 791.886.917;
  max-hardware 597 / 77.869.902 gegen 597 / 77.869.134. Abweichung < 0,01 %.
- Modellsumme 1,056e9 $/s gegen gemessene Hacking-Einnahme 1,034e9 $/s
  (`moneySourceA.hacking` 17:04 -> 17:19, 900 s Spielzeit) = 98 %.
- Serverpreis 1024 GB nachgerechnet 116,8 Mio, Log "1024 GB fuer 116.79m".
- Gemessene Erfahrungsrate 17:04 -> 17:19 (derselbe Einbauzyklus, 900 s Spielzeit):
  1,0619e8 exp -> **117.979 exp/s**. Rundendauer gemessen 10,025 s (Runde 42 -> 132).

---

## Befunde (wirkungsstaerkster zuerst)

### 1. Der Erfahrungsofen laeuft im V1-Knoten immer noch als Einwegwelle - 5 bis 10 % Auslastung auf der Haelfte des Netzes

- **Bot:** `src/bn4net.js:1938-1944` (pickScript-Ternaer), `:3159-3168` (Ueberschuss als EINE
  Einwegwelle je Runde), `:4911` (`await ns.sleep(10000)`), `src/worker/hack.js:47-49`
  (Einweg). `src/worker/expfarm.js` liegt fertig und ist nirgends verdrahtet
  (`nodes/BAUSTELLEN.md:2384-2400`: "Vor dem naechsten V1-Knoten wieder hochstufen" - ist nicht
  passiert, wir sind im V1-Knoten).
- **Spiel:** grow schreibt Erfahrung bedingungslos gut `NetscriptFunctions.ts:291,300`, weaken
  `:365,374`; grow erhoeht die Sicherheit nur, wenn sich das Geld aendert
  `Server/ServerHelpers.ts:209-214`; hack gibt bei `moneyDrained === 0` nur ein Viertel
  `Netscript/NetscriptHelpers.tsx:618-641`; Erfahrung je Faden `Hacking.ts:30-38`;
  Dauer je Aufruf `NetscriptHelpers.tsx:598,615`.
- **Was falsch ist:** Der Ueberschuss (17:04: 56.641 GB, 17:19: 42.907 GB = 47-65 % des
  91,9-TB-Netzes) geht einmal je 10-s-Runde als Welle auf foodnstuff. Die Aktion dauert dort bei
  Level 2871 0,28 s (hack) / 0,90 s (grow) / 1,12 s (weaken); danach liegt der Speicher bis zur
  naechsten Runde tot. Im Spielstand 17:19 sind 42.062 von 91.896 GB belegt, auf foodnstuff laeuft
  **kein einziger** Faden (`expStandGb: 0`). Zusaetzlich steht im Kommentar `bn4net.js:3153-3157`
  "ein leergehacktes Ziel liefert genauso viel wie ein volles" - fuer den hack-Zweig des Ternaers
  ist das seit 3.0.x falsch (Viertel-Erfahrung, `NetscriptHelpers.tsx:639-641`).
- **Folge, gerechnet (`expmodel.mjs`, Stand 17:19, foodnstuff E = (3+0,3x20) x 6,961 x 0,5 = 31,33 exp/Faden):**
  - Ofen heute: 42.907/1,8 x 31,33 / 10,025 s = **74.488 exp/s** (Rest der gemessenen 117.979 kommt
    aus den Stapelfaeden, ~37k, und der offenen Mischung - das Modell trifft die Messung).
  - grow-Dauerlaeufer (1,75 GB, 0,897 s je Zyklus, Ziel voll, also keine Sicherheit):
    42.907/1,75 x 31,33 / 0,897 = **856.373 exp/s** = Ofen x11,5, gesamt ~900k = **x7,6**.
  - weaken-Dauerlaeufer (die fertige expfarm.js): 685.099 exp/s. **grow ist 25 % besser als
    weaken** (3,2 statt 4 hackTime je Faden, und auf einem vollen Ziel ohne jede Sicherheitsfolge).
  - Level 4500 (w0r1d_d43m0n, 3000 x 1,5) braucht bei Mult 7,166 **1,728e11 exp**. Mit 117.979 exp/s
    sind das **406,8 h**, mit grow-Dauerlaeufer 53,3 h, mit hack-Ofen (unten) 18,7 h.
  - Ausbaustufe hack-Ofen (plausibel, nicht belegt): hack je Faden in 1 hackTime, Chance auf
    foodnstuff bleibt bis Sicherheit ~65 bei 1; je hack-Faden 0,16 weaken-Slots gegen die
    Sicherheit; Aufrufe <= 1/p = 234 Faeden, damit das Geld nie exakt 0 wird (sonst Viertel), dazu
    wenige grow-Faeden gegen Gleitkomma-Unterlauf. 42.907/1,98 x 31,33 x 1,04 / 0,2803 s =
    **2,52e6 exp/s** (Ofen x33,8).
- **Konfidenz:** belegt (Einwegzustand im Spielstand gesehen, Modell trifft Messung auf 95 %).
- **Fix:** Ofen als Dauerlaeufer verdrahten wie in BAUSTELLEN beschrieben (Budget aus den Bedarfen
  derselben Runde, Raeumen nach share-Muster, Lease), aber mit **`ns.grow` statt `ns.weaken`** in
  expfarm.js auf einem vollen Ziel; hack-Ofen als zweite Stufe messen.

### 2. 46 von 63 Geldservern (99,84 % des gesamten moneyMax) sind fuer die Zielwahl unsichtbar

- **Bot:** `src/bn4net.js:1727-1733` (p, chance aus dem IST-Zustand), `:1755-1757`
  (`sauber = 1`, wenn `100 - hdIst == 0`), `:1773` (`brauchbar = p > 0 && ...`), `:1782`
  (`steadyEff: brauchbar ? ... : null`), **`:1809`** (`if (kz && kz.steadyEff > 0)` -
  `null > 0` ist false). `src/lib/calc.js:136,153` (`sec >= 100 -> 0`).
- **Spiel:** `Server/Server.ts:79-83`: `hackDifficulty = min(base x ServerStartingSecurity, 100)`,
  `minDifficulty = round(real/3)`; BN5 hat ServerStartingSecurity 2 (`BitNode.tsx:659`). Jeder
  Server mit Grundsicherheit >= 50 startet also auf exakt 100, und bei 100 liefern
  `Hacking.ts:13` (Chance) und `:46` (Beuteanteil) 0. Nach jedem Einbau wird der Server neu
  erzeugt, also wieder 100.
- **Was falsch ist:** Die Kennzahlen werden vom IST-Wert auf minDifficulty hochgerechnet. Bei
  Sicherheit 100 ist der IST-Wert 0, und 0 x Faktor bleibt 0. Der Kommentar `:1769-1772` will
  genau diesen Fall durchlassen ("Unbekannt heisst: durchlassen"), aber der Kandidatenfilter
  `:1809` wirft null weg. Kein anderer Pfad (Anlauf, Stapel-Vorbereitung, Ofen) fasst diese Server
  an - also bleiben sie den ganzen Knoten auf 100. Belegt in zwei Spielstaenden: 16:04 (52 min
  nach dem Einbau) 44 von 63 auf 100, 17:19 46 von 63; alle 46 gerootet und unter dem Level.
  Die Telemetrie `zieleAnzahl: 13` = genau die 16 sichtbaren Server minus foodnstuff minus drei
  Stapelziele.
- **Folge, gerechnet (`vis.mjs`, Level 2871, bei minDifficulty, mit den Formeln des Bots):**
  - steadyEff (die Groesse, nach der der Bot sortiert): clarkinc 2.471.853, 4sigma 2.077.749,
    ecorp 2.005.661 $/GB*s - bestes sichtbares Ziel phantasy 131.898. **Faktor 19.**
  - Stapelguete bei f=0,5: clarkinc 1.020.669 $/GB*s gegen phantasy 56.805 (x18).
  - Heute 1,03e9 $/s gemessen. Die 42.907 GB, die heute in den Einwegofen gehen, braechten als
    clarkinc-Stapel rund 42.907 x 1,02e6 = **4,4e10 $/s (x42)**; ecorp allein faesst bei f=0,5
    492 TB und gaebe 3,26e11 $/s.
  - Preis: Vorbereitung. weaken von 100 auf 35 dauert fuer clarkinc bei Level 2871 517 s, bei
    Level 1500 974 s (die Dauer wird beim Aufruf festgelegt), danach grow + weaken ~3 min. Bei der
    heutigen Einbaufrequenz (16:37, 16:57, 17:19) bleiben je Zyklus nur ~5-10 min Ernte - der
    volle Gewinn gilt fuer lange Zyklen und fuer die Schlussphase nach der Red Pill.
  - Folgeschaden: Die Serveraufruestung (Befund 3) und der Grenzertrag sehen nur die kleinen
    Ziele und halten mehr Speicher deshalb fuer wertlos.
- **Konfidenz:** belegt (Mechanik im Code und Spielcode, Zustand in zwei Spielstaenden).
- **Fix:** In `kennzahlen` pMin/chanceMin/kMin direkt mit `calcHackPercent/calcHackChance/
  calcGrowthLog` bei `sec = s.minDifficulty` rechnen statt vom IST-Wert hochzuskalieren; die
  vorhandene Anlauf-/Vorbereitungslogik weakent dann von selbst (weaken/grow brauchen nur Root,
  `Hacking/netscriptCanHack.ts:49-55`, also schon vor Erreichen des Levels moeglich - wobei eine
  spaete weaken-Welle bei hoeherem Level frueher landet als eine fruehe).

### 3. Der Motor kennt keinen Wert fuer Erfahrung - und bremst deshalb jeden Speicherausbau im V1-Knoten

- **Bot:** `src/bn4net.js:1407-1417` (Ausbau nur in Dollar bewertet; `ueberschuss > 5 %` ->
  `ertrag = 0` -> Amortisation Infinity), `:1256-1257` (Kaltstart-Leiter endet bei 1024 GB),
  `src/homegrow.js` (home-RAM gesperrt ab `brachAnteil >= 0.34`), `bn4net.js:1787-1798`
  (Erfahrung nur als Rangzahl fuer EIN Ziel; exp/s wird nirgends gerechnet, nirgends gemeldet).
- **Spiel:** Preis `Server/ServerPurchases.ts:22-40` (r x 55000 x 1,2^(log2 r - 6) in BN5);
  Erfahrung skaliert linear mit Faeden `Hacking.ts:30-38`.
- **Was falsch ist:** Im V1-Knoten ist das Level die Leitgroesse, der Motor behandelt Erfahrung
  aber als Abfall ("Erfahrung ist keine Rechtfertigung fuer eine Ausgabe", `:1407-1409`). Weil
  Befund 1 und 2 staendig einen Ueberschuss erzeugen, blockiert die 5-%-Bremse den Ausbau fast
  immer. Belegt: `bn4net-log` 15:42:42 "Ausbau wartet: werk-0 -> 128 GB kostet 4.9m, amortisiert
  in ? s (Deckel 1800), frei 187957m" - ein 4,9-Mio-Ausbau bei 188 Mrd freiem Geld abgelehnt.
  Park um 16:04 (52 min in den Zyklus, 644 Mrd auf der Hand): 9x1024, 3x512, 9x256, 4x128 GB.
  Dasselbe fuer share: SHARE_ANTEIL 12 % (11 TB) ist heute billig, weil der Speicher sonst
  ohnehin brach laege - nach Befund 1 kosten die zweiten 5,5 TB share rund 110.000 exp/s fuer
  ln(2)/25 = 2,8 Prozentpunkte Reputationsbonus.
- **Folge, gerechnet:** 25 x 65.536 GB kosten 25 x 2,232e10 = **5,58e11** (16:04 lagen 6,44e11
  auf dem Konto). Mit grow-Dauerlaeufer auf foodnstuff (19,9 exp/GB*s bei Level 2871) waeren das
  3,27e7 exp/s -> Level 4500 bei Mult 7,166 in **1,47 h statt 407 h**. Ob das Geld dort besser
  steht als in Augmentierungen/Spenden, ist eine echte Abwaegung - der Punkt ist, dass der Motor
  sie gar nicht fuehrt.
- **Konfidenz:** Mechanik belegt (Code + Log); die optimale Aufteilung Geld/Erfahrung plausibel,
  nicht berechnet.
- **Fix:** Im V1-Verfahren eine Erfahrungsbewertung einfuehren (exp/s je GB aus dem Ofen als
  Grenznutzen neben $/GB*s), exp/s in `data/bn4net.json` melden, und die 5-%-Bremse sowie die
  homegrow-Sperre auf "Speicher liegt WIRKLICH brach" (ps-Messung) statt auf "ging an den Ofen"
  umstellen.

### 4. Stapelziele werden nach offener Mischguete gewaehlt, nicht nach Stapeldurchsatz (B5 vom 24.08. weiter offen, neu beziffert)

- **Bot:** `src/bn4net.js:1813` (Sortierung nach steadyEff), `:1902-1905` (Top 3 werden
  Stapelziele), `:2706` (`kalenderPlaetze = floor(tWeaken/(4 x 400 ms))`), `:2564`
  (F_LEITER endet bei 0,5), `:2513` (GAP_MS 400).
- **Spiel:** Laufzeit `Hacking.ts:60-93`; der Stapeldurchsatz ist kalendergedeckelt auf einen
  Stapel je 1,6 s und Ziel.
- **Was falsch ist:** Bei Level 2871 hat phantasy tWeaken 8,1 s (5 Plaetze), max-hardware 5,4 s
  (3 Plaetze) - beide kleben am Leiterende f=0,5 und bringen 187 bzw. 78 Mio $/s. Unter den
  SICHTBAREN Zielen haetten johnson-ortho (24 Plaetze) 646 Mio und omega-net (17 Plaetze)
  536 Mio $/s bei demselben f, Speicherbedarf 18 bzw. 15 TB (vorhanden).
- **Folge:** 265 Mio -> 1,18 Mrd $/s aus diesen zwei Plaetzen, also rund **+0,9 Mrd $/s, fast
  eine Verdopplung** der heutigen Einnahme (Modell geeicht, s. oben). Mit Befund 2 behoben wird
  der Punkt kleiner, das Kriterium bleibt aber falsch.
- **Konfidenz:** belegt (Modell), Wirkung plausibel.
- **Fix:** Stapelziele nach erreichbarem Stapelertrag `min(Kalender, RAM-Anteil) x f x moneyMax x
  chance / Zeit` waehlen, mit Hysterese gegen Zielwechsel (B4).

### 5. Kerne und Sicherheitsaufschlaege: 14-20 % Stapelspeicher zu viel - sobald Speicher knapp wird

- **Bot:** `src/bn4net.js:2215-2228` (Kerne bewusst ignoriert), `:2529` (WEAKEN_MARGIN 1,5),
  `:2541` (GROW_MARGIN 1,15).
- **Spiel:** Kernbonus auf grow und weaken `Server/ServerHelpers.ts:315-323`,
  `Server/formulas/grow.ts:25-28`; home hat 5 Kerne (x1,25) und 65.536 von 91.896 GB (71 %).
- **Was:** Heute folgenlos, weil der Speicher nicht der Engpass ist. Nach Befund 1/2 ist er es
  (ein Konzernziel faesst 115-540 TB). GROW_MARGIN deckt die p-Drift durch steigendes Level:
  bei Level 2871 und 0,35 Level/s sind das ueber tWeaken+14 s fuer clarkinc 1,18 %, fuer the-hub
  0,09 % - nicht 15 %.
- **Folge (`margin.mjs`):** clarkinc f=0,3: 567 GB je Stapel; mit 5 Kernen fuer grow/weaken auf
  home -11,5 %, mit Aufschlaegen 1,03/1,1 -7,4 %, beides -16,9 %. the-hub f=0,3: -20,1 %.
- **Konfidenz:** belegt (Rechnung), Wirkung erst nach 1/2 relevant.
- **Fix:** Faedenzahl je Platzierung mit den Kernen des Wirts rechnen (grow/weaken, die auf home
  landen); GROW_MARGIN aus der erwarteten Levelzunahme bis zur Landung ableiten statt fest.

### 6. `lib/bitnodes.json` ist fuer BitNode 12 falsch - der Generator verwirft alle Ausdrucksfelder

- **Bot:** `tools/bitnodes-tabelle.js` (Regex `(\w+)\s*:\s*([\d.]+)\s*,` erfasst nur
  Zahlenliterale); Ergebnis `src/lib/bitnodes.json` Knoten 12 =
  `{"ServerStartingSecurity":1.5,"CorporationSoftcap":0.8,"CorporationDivisions":0.5,"GangSoftcap":0.8}`.
  `src/bn4net.js:113-124` liest daraus ScriptHackMoney und ServerGrowthRate. ServerWeakenRate
  wird nirgends beruecksichtigt (`bn4net.js:1687`, `WEAKEN_POWER = 0.05`).
- **Spiel:** `BitNode/BitNode.tsx:918-989`: BN12 setzt ScriptHackMoney, ServerGrowthRate,
  ServerWeakenRate, ServerMaxMoney, HackExpGain u. a. auf `dec = 1/1,02^Stufe`; weaken
  `ServerHelpers.ts:320-323` multipliziert ServerWeakenRate; BN11 hat ServerWeakenRate 2 (`:890`).
- **Folge:** BN12.1: p und k je 2 % zu hoch, weaken 2 % zu schwach; BN12.3: je 5,8 %. Im Stapel
  fangen die Aufschlaege (1,15/1,5) das ab, in der offenen Mischung regelt secErr nach - also
  geringe Wirkung, aber eine stille Tabelle, die "erzeugt, nicht abgeschrieben" verspricht und
  fuer den naechsten V1-Knoten nach BN5.3 falsch ist.
- **Konfidenz:** belegt (Datei gelesen), Wirkung plausibel gering.
- **Fix:** Generator soll bei Nicht-Literal-Feldern laut abbrechen und BN12 je Stufe auswerten;
  ServerWeakenRate in WEAKEN_POWER einrechnen.

### 7. Kleinere Punkte

- **Anlauf-Gate (B6 vom 24.08., offen):** `bn4net.js:3038` - Log 17:02:40 ueberspringt
  sigma-cosmetics, zer0, iron-gym, crush-fitness, neo-net (20-35k $/GB*s), waehrend 57 TB in den
  Einwegofen gehen. Die Alternative des Speichers ist heute ~0 $, nicht der Flottenschnitt.
  Geringer Betrag (kleine Server).
- **LEAD_MS 14 s auf kurzen Zielen:** `bn4net.js:2524` - belegtGb/Kalenderbedarf phantasy
  4.529/3.235 GB (x1,40), max-hardware 3.349/1.791 (x1,87). Auf Konzernzielen (tWeaken 180-470 s)
  nur 3-8 %. Kein Handlungsbedarf, solange Speicher nicht knapp ist.
- **Arbeiter-Selbstmessung kostet 0,05 GB/Faden** (hack 1,75, grow/weaken 1,80 statt 1,70/1,75,
  im Spielstand bestaetigt: 10.417,75 GB / 5.953 Faeden = 1,75): ~3 % Stapelspeicher. Bewusster
  Tausch fuer exakte Landungen - in Ordnung, nur erwaehnt.

---

## Geprueft, in Ordnung

- `calc.hackPercent/hackChance/growthLogPerThread/intBonus` identisch mit `Hacking.ts:9-57`,
  `Server/formulas/grow.ts:8-29`, `PersonObjects/formulas/intelligence.ts`; ScriptHackMoney 0,15
  fuer BN5 korrekt aus bitnodes.json uebernommen.
- `growFaeden` (`bn4net.js:4936-4957`) = `numCycleForGrowthCorrected`
  (`ServerHelpers.ts:90-200`), gleicher Startwert und Newton-Schritt, Rundungskorrektur gleichwertig.
- Hochrechnung IST -> minDifficulty fuer p, chance (inkl. Klemmung bei 1), k (inkl.
  ServerMaxGrowthLog-Deckel) und hackTime algebraisch korrekt - ausser im Grenzfall
  Sicherheit 100 (Befund 2).
- Laufzeitverhaeltnis 3,2/4 (`Hacking.ts:83-93`); Laufzeiten ueber `ns.getHackTime`, also mit
  HackingSpeedMultiplier und Intelligenz.
- Sicherheitskonstanten 0,002/0,004/0,05 (`Server/data/Constants.ts:7-10`); grow-Sicherheit nur
  auf genutzte Zyklen (`ServerHelpers.ts:209-213`); hack-Fortify auf maxThreadNeeded gedeckelt
  und nur bei Erfolg (`NetscriptHelpers.tsx:623,667`).
- Terminprotokoll der Arbeiter: additionalMsec, Dauer im selben Tick selbst gemessen,
  Wertebereich 0..1e9 eingehalten (`NetscriptHelpers.tsx:396-418, 469-482, 598`).
- Stapel: Alles-oder-nichts-Platzierung, hack zuletzt gestartet, Kalender nur vorwaerts,
  Drifterkennung mit Auslaufen - in allen drei Stapelzielen `secBoden 0`, `geldBoden 0,50/0,70/0,50`
  (= 1-f), Ketten gesund. Aufteilungsverlust bei gesplittetem hack geht in die harmlose Richtung.
- Gemessener Stapelertrag = Modell (98 %); die Kette liefert, was sie verspricht.
- 3.0.1 -> 3.0.2: keine Aenderung in `Hacking.ts`, `grow.ts`, `Server.ts`, `Share.ts`,
  `netscriptCanHack.ts`, im Rumpf von `hack()`; `netscriptDelay` nur umbenannte Felder.
  `calc.js` ("aus v3.0.1") gilt unveraendert.
- Erfahrungsziel foodnstuff ist unter allen Metriken (exp je hackTime, je GB*s fuer
  grow/weaken/hack) das beste erreichbare - die Rangzahl `bn4net.js:1793-1798` ist levelinvariant
  und hier richtig (B2 vom 24.08. ist damit erledigt).
- Rooten ohne Levelfilter korrekt (nuke prueft nur Ports).
- Kaltstart-Preisrechnung und Upgrade-Differenzpreis = `ServerPurchases.ts:22-52`.
