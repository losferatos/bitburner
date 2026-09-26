# Audit 6 - Orchestrierung, Zeit, Robustheit

Stand 26.09.2026 18:14, BN5 Stufe 2 (V1). Streng lesend. Belege aus den
Spielstaenden in `backups/` (27 BN5-Staende, dekodiert mit
`scratchpad/audit/dec.mjs`, Rechnungen in `scratchpad/audit/rech.js`), aus
`data/bridge.log` und dem Spielquellcode 3.0.2. Uhrzeiten in Spiel-Logs und
Dateinamen sind Ortszeit, `bridge.log` ist UTC.

---

## 1. darkweb.js schaltet den Fokus ab - Faktionsarbeit laeuft stundenlang mit 80 %

- **Bot:** `src/darkweb.js:93-94` klickt "Do something else simultaneously",
  `:106` (alt+w, Stadtkarte) und `:219` (alt+t, Terminal) navigieren weg.
  Gestartet von `src/bn4net.js:3384-3405` alle 5 min (`NACHHOL_ABSTAND_MS =
  300000`), solange EIN Portprogramm fehlt - auch wenn das Geld fuer das
  naechste gar nicht reicht. Niemand gibt den Fokus zurueck: `bn4rep.js:2095`
  ruft `workForFaction(..., true)` nur, wenn `!arbeitetSchon` (:2021-2022);
  `isFocused`/`setFocus` kommt im ganzen `src/` nicht vor.
- **Spiel:** Unfocus-Knopf = `Router.toPage(...)` (`ui/WorkInProgressRoot.tsx:302-304`),
  jeder Seitenwechsel weg von Work ruft `Player.stopFocusing()`
  (`ui/GameRoot.tsx:271-272`). `focusPenalty()` = 0,8 ohne Fokus und ohne
  Neuroreceptor Management Implant (`PersonObjects/Player/PlayerObjectGeneralMethods.ts:622-628`),
  wirkt auf Rep und Erfahrung der Faktionsarbeit (`Work/FactionWork.tsx:38-45`).
- **Beleg (Kausalkette in zwei Zyklen):**
  - 10:26:48 bn4rep startet BitRunners (Fokus an), 10:26:51 darkweb.js laeuft
    ("ABBRUCH: Alpha Enterprises nicht auf der Stadtkarte") -> Fokus aus bis
    zum Einbau 12:53: **146,2 von 172,0 min = 85,0 %** des Zyklus ohne Fokus
    (Spielstaende 11:04, 12:04, 12:53: `focus:false`, FactionWork).
  - 15:15:55 bn4rep startet BitRunners, 15:17:51 darkweb.js -> Fokus aus bis
    16:37: **79,2 von 85,0 min = 93,1 %**.
  - Gegenprobe 16:57-Zyklus: darkweb lief 16:57:48, bn4rep startete die
    Arbeit erst 16:59:56 -> danach `focus:true`.
  - Ueber alle 25 BN5-Staende mit Faktionsarbeit: 14 ohne Fokus.
- **Folge (gerechnet):** Anteil 14/25 = 0,56 -> effektive Rep-Rate
  1 - 0,2 x 0,56 = 0,888 -> jede reputationsbegrenzte Phase dauert
  1/0,888 = **+12,6 %**. Im 10:01-Zyklus entspricht der Verlust 146,2 x 0,2 =
  29,2 min Faktionsarbeit, im 15:12-Zyklus 15,8 min. Dazu 0,8x Hacking-Exp aus
  der Faktionsarbeit.
- **Doppelt ueberfluessig:** bn4life.js kauft dieselben Programme per
  Singularity (`bn4life.js:285-296`, mit SF4.3 23,85 GB, laeuft ab boot). Der
  Kommentar der Nachholer-Begruendung ("einzige kaltstartfaehige
  Knackerquelle", bn4life 293 GB) gilt seit SF4.3 nicht mehr.
- **Konfidenz:** belegt.
- **Fix:** Nachholer in bn4net nur starten, wenn bn4life.js nirgends laeuft
  (und Geld fuer das naechste fehlende Programm da ist); zusaetzlich in
  bn4rep je Runde `if (!isFocused()) setFocus(true)` bei laufender Arbeit
  (Achtung: `setFocus` holt die Work-Seite nach vorn) - oder Neuroreceptor
  Management Implant (Tian Di Hui, 75k Rep) hoeher gewichten, der die Strafe
  dauerhaft abschafft.

## 2. Nach jedem Reset 11-25 min ohne jeden Hack-Ertrag

- **Bot:** `src/bn4net.js:1867-1904` (3 Stapelziele werden der offenen
  Steuerung entzogen und bei 2 % Geld vorbereitet), `:2908-2911` (Anlauf je
  Ziel 15 %, gesamt 30 % eines ohnehin kleinen Budgets, Frist 20 min, danach
  30 min Sperre), `:3054-3059`.
- **Beleg (`moneySourceA.hacking` / `playtimeSinceLastAug`):**
  | Fenster | Dauer | Hack-Ertrag |
  |---|---|---|
  | BN-Start 00:39:42 -> 01:04 | 25,0 min | 0 $ |
  | Einbau 01:45 -> 02:04 | 19,0 min | 0 $ |
  | Einbau 04:48 -> 05:04 | 16,0 min | 207.000 $ (216 $/s) |
  | Einbau 12:53 -> 13:04 | 11,0 min | 1,87e7 $ (28.419 $/s) |

  Zustand 01:04 (`data/bn4net.json`): `mischung.hack 0, grow 2, weaken 3`,
  `budgetGb 34`, `expStandGb 117`, alle drei Stapelziele `phase: prep,
  moneyFrac 0.02, secOver 17`. Log: "00:59:44 n00dles: Anlauf nach 20 min ohne
  Erfolg abgebrochen, 30 min gesperrt", 01:02:14 dasselbe fuer joesguns - die
  einzigen sofort erntbaren Ziele werden im Kaltstart fuer 30 min gesperrt.
- **Folge:** 12:53-Zyklus: Folgerate (1,85e11 - 1,87e7)/(4258 - 658 s) =
  5,14e7 $/s; Obergrenze des Verlusts 658 s x 5,14e7 = 3,38e10 $ = **4,2 %**
  des Zyklusertrags (8,07e11). Im fruehen Knoten (Zyklen 1-3) ist der Anteil
  kleiner in Dollar, aber das Geld fehlt genau dann, wenn es in Rechner und
  home-RAM zinst. Mit 64 TB home (16:57-Zyklus: 206 M$/s schon nach 7 min)
  verschwindet der Effekt. Hinweis: ueberschneidet sich mit dem
  Batching-Audit; hier nur als Reset-Latenz gemessen.
- **Konfidenz:** Nullfenster belegt; Ursachenzuordnung plausibel.
- **Fix:** Solange `playtimeSinceLastAug` < ~15 min oder Hack-Ertrag 0: Stapelvorbereitung
  deckeln und das Anlaufbudget an die leicht vorbereitbaren Ziele geben;
  Anlaufsperre fuer Ziele mit `requiredHackingSkill` weit unter dem Level nicht
  verhaengen.

## 3. Figur-Vergabe: arbeitende Besitzer erneuern ihren Antrag nicht - Lease verfaellt, Aktion bleibt veraltet, Log und Ereignisstrom laufen voll

- **Bot:** `bn4rep.js:2025/2093` und `:1536-1540` beantragen nur, wenn die
  Arbeit NICHT schon laeuft; ebenso `bn4life.js:519-528`. `lib/figur.js:185-190`
  verlaengert eine Lease mit `...bisher` - `action` wird nie aktualisiert.
  `bn4net.js:4150-4153` loggt jede Runde, solange keine Lease gilt.
- **Beleg:**
  - `data/figure.txt` 17:04: `owner bn4rep.js, action "arbeit"`, `since`
    16:39:09 (Vor-Zyklus!), waehrend `figure-request-bn4rep.js.json` und die
    Figur `faktion` tun.
  - Ereignisstrom 11:39-15:04: nach jedem Boot 17 min "vergeben fuer arbeit,
    tatsaechlich faktion" (35 Eintraege), danach bis zum naechsten Einbau
    "niemand hat die Figur, sie tut aber faktion" (187 bzw. 128 Eintraege).
    **397 von 400** Eintraegen sind Figur-Vermerke, das Fenster deckt nur noch
    **3,42 h** - `boot`, `error`, `blocked` fallen nach gut 3 h heraus.
  - `data/bn4net-log.txt` (16:37): **155 von 200 Zeilen** "Figur: frei (kein
    geltender Antrag)", das Log reicht nur **25,7 min** zurueck.
- **Folge:** C.11 schuetzt laufende Faktionsarbeit nur 15 min nach dem Start;
  danach haelt nur noch `rep-modus.txt` bn4life ab, jeder andere Antragsteller
  (bbtrain prio 40 in Kampfknoten) bekaeme die "freie" Figur und wuerde die
  Arbeit abbrechen -> bn4rep holt sie per prio 30 zurueck -> Ping-Pong im
  15-min-Takt. Die Diagnosewerkzeuge (Log, Strom, `figure_conflict`) sind
  durch Rauschen praktisch blind.
- **Konfidenz:** belegt (Zustand und Code); Ping-Pong in V2 plausibel.
- **Fix:** figFrei/Antrag in JEDER Runde stellen, in der die eigene Arbeit
  laeuft (nur `workFor...` bedingt lassen); in `vergib()` bei Verlaengerung
  `action`/`detail` aus dem eigenen Antrag uebernehmen; "Figur: frei" nur bei
  Wechsel loggen.

## 4. joinrun.js umgeht die Figur-Vergabe, kaempft mit bn4life um die Stadt und passt nicht zu 20-min-Einbauzyklen

- **Bot:** `bn4life.js:163-185` startet `joinrun.js` nach JEDEM Einbau (>= 2
  der vier Faktionen fehlen - nach jedem Einbau der Fall). `joinrun.js:28,101`
  ruft `s.gymWorkout(...)` ohne `lib/figurns.js`. Der Lint
  `tools/test-verbote.js:295` sucht `ns\.singularity\.gymWorkout` und uebersieht
  den Alias `const s = ns.singularity` (einzige solche Datei im Baum). Parallel
  reist `bn4life.js:239-248` nach Aevum, joinrun braucht Sector-12
  (`joinrun.js:55-57`); `Singularity.ts:336-340` lehnt ab, wenn die Stadt nicht
  passt.
- **Beleg:** 12:53-Zyklus: Wechsel im 15-s-Takt (bn4rep-Log 13:04:15/13:04:31
  "Arbeite fuer The Black Hand", joinrun 13:04:02/:17/:32 "Training ..."),
  Spielstand 13:04 zeigt `ClassWork str` statt Faktionsarbeit; 20 Trainings,
  115 "abgelehnt". 15:12-Zyklus: 2 Trainings, 167 abgelehnt. 16:57- und
  17:19-Zyklus (20/22 min): joinrun wird vom naechsten Einbau beendet, bevor es
  nach 45 min (`FRIST_MS`) ueberhaupt zur Beitrittsphase kommt -> null Nutzen.
- **Folge:** Obergrenze der verdraengten Faktionsarbeit 20 x 15 s = 300 s von
  8.340 s = 3,6 % im 12:53-Zyklus; der Nutzen (Tetrads/Slum Snakes/Tian Di Hui)
  entsteht nur in Zyklen > 45 min. Hauptschaden ist der Regelbruch: ein
  Figur-Akteur ausserhalb der Vergabe, den der Lint nicht sieht.
- **Konfidenz:** belegt.
- **Fix:** joinrun ueber `figBeantrage/figDarf` (prio gym) fuehren und den
  Lint auf `\.(gymWorkout|workForFaction|...)\(` ohne `ns.singularity`-Praefix
  erweitern; Reise nach Aevum aussetzen, solange joinrun laeuft; bei
  erwarteter Zykluslaenge < 45 min joinrun nicht starten.

## 5. Handschlag-Fehlschlag beendet bn4rep, die Sperre landet auf dem falschen Rechner

- **Bot:** `bn4rep.js:1393-1397` - bei `!hs.darf` steht `return` direkt in
  `main` (Schleife ab :495, keine innere Funktion) -> der Prozess endet.
  `lib/handschlag.js:298` schreibt `install-sperre.txt` per `ns.write` lokal;
  bn4rep liest sie von home (`:797`). Die Lesart ist seit Paket A (22.09.)
  JSON-faehig, der Grund fuer das bewusste lokale Schreiben (Kommentar
  :282-297) ist damit entfallen.
- **Folge:** Bruecke tot und letzte gruene Sicherung > 6 h (Nacht 24./25.09.:
  Bruecke 23:35-06:03 UTC weg, 6,5 h) und bn4rep auf der Werkbank: je Zyklus
  NFG-Kaeufe, 90 s Warten (`WARTE_MAX_MS`), Prozessende, Neustart durch den
  Kern, von vorn - ca. alle 100 s, die 1-h-Sperre wirkt nie. bn4rep erledigt
  in der Zeit nichts anderes (kein Zielwechsel, keine Spende). Faellt bn4rep
  auf home (wie in BN5 derzeit, 63 GB passen nur dort), greift die Sperre.
- **Konfidenz:** belegt (Code), im Betrieb nicht beobachtet.
- **Fix:** `continue`/Schlaf statt `return`; Sperre per `nachHome` im
  JSON-Format schreiben.

## 6. boot.js raeumt auch bei jedem Neuladen der Seite Laufzustand weg

- **Bot:** `boot.js:114-139` loescht unbedingt u. a. `install-sperre.txt`,
  `preise.json`, `kaufauftrag.json`, `kaufergebnis.json`, `blocked-hosts.json`,
  `cdump-stand.json`, `contracts.json`, `rep-modus.txt`. Der Kopfkommentar
  begruendet jede Zeile mit einem Prestige.
- **Spiel:** `AutoexecScript = "boot.js"` (Spielstand-Settings) wird bei JEDEM
  Laden vorn in die Startliste gelegt (`NetscriptWorker.ts:250-255`), ohne
  Prestige; die geretteten Skripte laufen weiter.
- **Folge:** Nach einem Browser-Neustart/Absturz verliert ein laufender Lauf
  Einbausperre, Wirtsperren des Waechters und offene Kaufauftraege; bn4net
  sieht einen "Park ohne Preise" bis shop.js neu schreibt. Einzeln klein,
  aber genau die Klasse "Befehl/Zustand ohne passenden Anlass".
- **Konfidenz:** belegt (Code), Folgen plausibel.
- **Fix:** Unbedingte Liste nur, wenn `lastAugReset` oder `lastNodeReset`
  juenger als ~5 min ist (dasselbe Muster wie `nachKnotenwechsel`).

## 7. Die Kaltstartphase ist mit SF9 >= 2 unerreichbar

- **Bot:** `bn4net.js:571-577` `HOME_KALTSTART_GB = 64`; `guard.js:388-389`
  dieselbe Schwelle. **Spiel:** `Prestige.ts:241-242` setzt home nach dem Sprung
  auf 128 GB bei SF9 >= 2 (Eric: SF9.3).
- **Beleg:** BN5-Start 00:39:42 "Rolle unbekannt ... normal", Lage
  "5|V1|normal" ab Runde 2. Um 01:04 belegen die Werkzeuge **117,0 von 128 GB
  home (91,4 %)** plus 96,95 GB auf Netzrechnern = 213,95 GB = **16,0 %** des
  1.341-GB-Netzes - das **6,3-fache** des Geldziel-Budgets (34 GB).
  `cdump/csolve/sleevecrime` (Phase kaltstart) laufen nie; die "normal"-Menge
  kommt sofort (figwatch, contracts, export, popups, bn4rep, bn4door =
  105,05 GB, abzgl. cdump 12,65 = 92,40 GB mehr).
- **Folge:** Die Registry-Phase ist toter Code; ob die schwere Menge im
  Kaltstart richtig ist (bn4rep fuer Faktionsarbeit wohl ja, figwatch/export
  sicher nicht), entscheidet derzeit ein Schwellenwert, der nicht mehr zum
  Spiel passt. Dazu: im ersten Kernlauf (Rolle unbekannt) startet bbtrain.js
  (Figur-Akteur) und wird 10 s spaeter wieder beendet.
- **Konfidenz:** belegt.
- **Fix:** Kaltstart ueber Park/Geld/Netzgroesse statt home-RAM definieren
  (z. B. "kein Park UND Netz < 2 TB"), reine Beobachter (figwatch, export,
  ausgang vor dem Endspurt) in die Normalphase verschieben.

## 8. keepalive.js ist eine scharfe Leiche - der Seitentimer ueberlebt jeden Reset

- **Bot:** `keepalive.js:283` legt `setInterval` in den Seitenkontext; alle
  10 min: Unfocus-Klick (:176-178), Terminal, `ps --grep autopilot`, bei Fehlen
  `run autopilot.js` (:206). Nichts im Bot kennt oder stoppt ihn; die Datei
  liegt weiter in `src/` (von der Bruecke ins Spiel gespielt).
- **Beleg:** `data/keepalive.txt` im Spielstand: gestartet 22.09. 10:20.
  `terminalCommandHistory` 22.09. 19:12: 30 von 30 letzten Befehlen sind
  keepalive-Muster inkl. sechsmal `run autopilot.js`; letzte Spur 23.09. 07:25,
  danach nur noch darkweb-`buy`. Also lief am 22.09. ein zweiter
  Stapelverwalter (autopilot.js) neben bn4net - passt zu "Netz mit 2.442
  Arbeiterfaeden belegt" in BAUSTELLEN vom 22.09. Heute inaktiv (Seite wohl
  neu geladen).
- **Folge:** Ein einziger `run keepalive.js` genuegt, damit ueber alle
  Einbauten und Spruenge alle 10 min der Fokus faellt und ein konkurrierender
  Verwalter startet.
- **Konfidenz:** belegt (historisch), aktuell kein Befall.
- **Fix:** keepalive.js aus dem gespielten Baum nehmen oder `main` auf
  `--stop`-Verhalten reduzieren; bn4net sollte `autopilot.js` auf allen Wirten
  beenden, sobald es selbst laeuft.

## 9. Waechter-Blindfenster bei kurzen Einbauzyklen

- **Bot:** `guard.js:337-351` (10 min Karenz nach jedem Reset),
  `guard.js:484-497` (Vergleichspunkt wird bei jedem Einbau neu gesetzt),
  `lib/leiter.js:287` (S2 braucht 45 min Motorzeit seit dem Punkt).
- **Beleg:** Zyklen 85 / 20 / 22 min (15:12, 16:37, 16:57) -> Karenzanteil
  12 % / 50 % / 45 %. S2 kann bei Zyklen < 45 min nie feuern.
- **Folge:** Ein "Einbau-Karussell ohne Fortschritt" waere fuer S2 unsichtbar;
  sonst gering, weil bn4net Werkzeuge selbst nachstartet und der Waechter den
  Kern auch in der Karenz nachholt (`guard.js:247-276`).
- **Konfidenz:** plausibel (Mechanik belegt, Schaden nicht beobachtet).
- **Fix:** S2 ueber mehrere Einbauten messen (Traegerwert je Einbau
  normiert) statt den Punkt bei jedem Einbau zu verwerfen.

## 10. Kleinere Befunde (Bericht, nicht Steuerung)

- **install-Ereignis ohne Schreiber:** `lib/events.js` fuehrt `install` als
  bleibend, geschrieben wird es nur im Unmoeglichfall
  (`bn4net.js:4403-4406`), nicht beim echten Einbau (`bn4rep.js:1406`). Im
  Strom: 0 install-Eintraege bei 7 Einbauten in BN5. Fix: vor
  `installAugmentations` einen `install`-Eintrag schreiben. belegt.
- **popups.js beschneidet events.json selbst** auf 200 Eintraege ohne
  Ruecksicht auf `bleibt` (`popups.js` Haltezweig, `slice(-200)`) - kann
  `jump`/`penalty`/`gate` loeschen. Fix: `lib/events.js` benutzen. belegt.
- **`ramBedarf` im Zaehlwerk rechnet mit Faktor 16:** `lib/reg.js:236-238`
  liest `(lage.ownedSF||{})[4]`, die Lage des Kerns hat weder `ownedSF` noch
  `sf4` -> sf4 = 0 -> x16 statt x1 bei SF4.3; `wartetGb` in kpi.json
  ueberhoeht. belegt.
- **Serverkauf seriell:** ein Auftrag je Kernrunde ueber shop.js-Einmallauf;
  21 Rechner brauchten 16:59:29-17:04:41 = 5,2 min, jeweils 1 TB trotz
  80 Mrd Guthaben. Bei `brachAnteil 0,645` derzeit folgenlos. belegt.

---

## Geprueft, in Ordnung

- Wiederanlauf nach Einbau: Handschlag 14:57:46 UTC (= 16:57:46 Ortszeit), boot.js 16:57:48,
  guard/bn4net/bn4life in derselben Sekunde, alle Werkzeuge 16:57:49
  (`Singularity.ts:209-210` Rueckruf nach 500 ms). Nach dem Sprung ebenso
  (`Singularity.ts:1173-1174`, home 128 GB passt fuer boot + Kern).
- Rueckruf-Voraussetzung: exit.js prueft `boot.js` auf home vor
  `destroyW0r1dD43m0n` (`exit.js:129,180`); RAM-Pruefung in `runAfterReset`
  (`Singularity.ts:59-76`) wird bei 128 GB erfuellt.
- Veraltete Fernbefehle: `reload.txt`, `task.txt` (nur nach Knotenwechsel),
  Handschlagdateien werden geraeumt; Rollen-Riegel gegen alte `verfahren.txt`
  (`lib/reg.js` `pruefeRolle`).
- Uhren: Motorzeit (`lib/motorzeit.js:75-119`) und Waechterzeit
  (`lib/uhren.js`) verwerfen Nachholklumpen und Luecken > 120 s; Engine holt
  verpasste Zyklen nach (`engine.tsx:411-437`), Arbeit/Graft laufen in
  Spielzeit = Wanduhr; Lease/TTL in Wanduhr sind damit konsistent. Keine
  Frist der Sprossen 0-3 in Motorzeit (`pruefeFristen`).
- bn4net hat genau ein `await` je Runde (`bn4net.js:1969`, `:4911`) - unter
  der 1-min-Drosselung bleibt der Kernherzschlag < 10 min (S3a).
- Tote Besitzer geben die Figur sofort frei (`lib/figur.js:163-176`,
  Prozessliste ueber alle Wirte `bn4net.js:4142-4146`); Antraege aus altem
  Knoten fallen am `nodeReset`-Stempel durch.
- Doppelinstanzen werden je Runde bereinigt (`bn4net.js:3339-3358`);
  boot/guard/popups/bn4net pruefen `ps` vor jedem `exec`.
- bn4rep.json-Frische in V1: in allen BN5-Staenden <= 3,6 min alt, die
  30-min-Frist (`bn4net.js:3298-3334`) greift nicht faelschlich.
- Singularity-Kosten: `ramBedarf`-Formel entspricht `RamCostGenerator.ts:81-94`
  (nur die Eingabe fehlt, siehe 10).
- Travel bricht keine Arbeit ab (`Singularity.ts:374-395`) - Reisen von
  bn4life gefaehrden einen laufenden Graft nicht.
