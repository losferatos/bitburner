# P2d Skeptiker: Geldmodus + Ausruestung (gang-3) gegen Vorgabe und Spielquelle

Stand 2026-10-04 11:17 (Systemzeit). Rolle: Skeptiker (Betrieb + Substanz). Geprueft: Diff
`p2c-aufschub..HEAD` (9755548, bcea340, 29a586d) im Worktree `p2d-geldmodus`. Spielquelle nur gelesen
(`reference/bitburner-src/src`), Live-Spiel nur gelesen (`getFile` bn4rep.json, gang.json,
geldbedarf.txt). Nichts in `src/` geaendert. Rechner im Scratchpad (`need-frisch.mjs`,
`fixpunkt.mjs`, `zyklus2.mjs`, `zeit.mjs`), alle mit dem ECHTEN Code des Worktrees
(`waehleTorRunde`, `repNeedKandidaten`, `gangRepNeed`) auf den Eingaben von `gang-p2b-lib.mjs`
(Spielstand BN2.1 03.10. 19:01, Analogon erstes Tor, wie verify-p2b-praemisse.md).

Lage live 10:54: **BN2.2 laeuft seit 10:38** (nodeReset 1791103117425), Konto 11,75 Mio, noch keine
Gang (gang.json `no_faction`, gangHold true). P2d wirkt also ab jetzt im frischen Knoten.

## Urteil: EINSPIELEN MIT FIX

Der Code trifft die Vorgabe Punkt fuer Punkt, die Substanz stimmt mit der Quelle, alle Tests gruen
(selbst gefahren). Kein hoher Befund. Zwei mittlere Befunde betreffen nicht gang.js selbst, sondern
Sichtbarkeit und Einspielen; sie sind vor bzw. beim Einspielen zu erledigen.

## Befunde (Statusliste)

| # | Schwere | Befund | Status |
|---|---|---|---|
| B1 | mittel | /bb sieht den Geldmodus nicht | Fix vor dem Einspielen |
| B2 | mittel | Einspiel-Reihenfolge: bn4rep.js ohne neue lib/einbau.js startet nicht; Registry muss mit | Fix beim Einspielen |
| B3 | niedrig | Hysterese wirkt auf den Ruf, Wechsel kommen aber aus need(4 x Konto) | bleibt, gerechnet unschaedlich |
| B4 | niedrig | Fruehes MONEY nach jedem Einbau (Zyklus 2+) - jetzt beziffert | bleibt, Kopftext ersetzen |
| B5 | niedrig | Ausruestung frisst den Ueberschuss, auch fuer Trainierende | bleibt |
| B6 | niedrig | Kopf begruendet mit BN2.1-Zahlen, wirkt aber in BN2.2/2.3 | Text tauschen |
| B7 | niedrig | Abnahme Punkt 5 schlaegt im Hysterese-Band falsch an; "mode null ausserhalb der Fuehrung" stimmt nicht | Text/1 Zeile |
| B8 | niedrig | Abnahme-Werkzeug gang-p2b-gegen.mjs: "Slum Snakes" fest verdrahtet, liegt nur auf master | vor der Abnahme |
| B9 | niedrig | Vertragstest bn4rep -> gang.js repNeedOf fehlt (Wegwerfprobe hier gruen) | als Z2 aufnehmen |
| B10 | niedrig | Kein Schalter nur fuer den Geldmodus | bewusst offen |
| B11 | info | test-ram rot ist CRLF-Testumgebung, nur die gang.js-Zeile ist echt veraltet | nach Einspielen messen |

### B1 [mittel] Der Geldmodus ist in /bb unsichtbar
- `tools/lib/gangzeile.js` (die /bb-Zeile) zeigt Faktion, Mitglieder, Respekt, Ruf, Strafe, Aufstiege,
  Fehler - nicht `mode`, `repNeed`, `repNeedWhy`, `moneyGainRate`, `equipmentBought/Spent/Block`.
  `gate-round-status.js` zeigt `torRunde.repNeed*` ebenfalls nicht.
- Folge im Betrieb: "Geldmodus springt nie an" (repNeed dauerhaft null - Faktion/Frische von
  gang.json, torRunde null, Plan ohne Gang-Stueck) sieht genau aus wie "Ruf noch unter Bedarf". Der
  sichere Rueckfall ist still. Die Abnahme im Kopf (Punkte 1-5) haengt am Handlesen von data/gang.json.
  Nach der Regel "ein Ausschluss gilt nur, wenn das Werkzeug den Fall anzeigen kann" waere ein
  "/bb sieht gut aus" hier kein Beleg.
- Fix: gangZeile um `Modus <mode> (Ruf x / Bedarf y | Grund)`, `Geld <moneyGainRate x5> $/s`,
  `Ausruestung n Stk / $ (Block: ...)` erweitern; Befund, wenn inGang und repNeed laenger als 30 min null
  ist (mit repNeedWhy). Reine tools-Aenderung, kein Spielskript.

### B2 [mittel] Einspielen: Reihenfolge und Registry
- `src/bn4rep.js` importiert vier NEUE Exporte aus `lib/einbau.js` (REP_NEED_BUDGET_FACTOR,
  repNeedKandidaten, gangRepNeed, gangFactionFromTelemetry). Liegt auf home die alte lib/einbau.js,
  scheitert das Modul-Linking ("does not provide an export named ...") - bn4rep startet nicht, der
  Waechter startet es im Kreis neu, Torrunde und Kaufaufschub (P1/P2c) sind tot. In einem frischen
  Knoten mit gangHold ist das der teuerste denkbare Ausfall.
- gang.js braucht 29,95 GB statt 21,85 GB (SF4.3). Ohne registry.json + Neustart von bn4net plant der
  Kern mit dem alten Wert.
- Fix (Ablauf): EIN einspielen-Schritt mit lib/einbau.js, bn4rep.js, gang.js, registry.json; danach
  neustart bn4net (Registry), bn4rep, gang.js; PID-Beleg, Host von gang.js mit >= 30 GB frei, in
  bn4rep.json `torRunde.repNeedWhy` (vor der Gruendung "meldet keine Gang") und in gang.json
  `version: gang-3`, `mode` pruefen.

### B3 [niedrig] Hysterese auf der falschen Groesse - gerechnet unschaedlich
- Der Faktionsruf steigt im Zyklus nur (faellt allein beim Einbau). Wechsel entstehen daher nur, wenn
  `need` springt - und need(4 x Konto) springt in Stufen, die das 2-%-Band nie abfaengt:
  frischer Knoten (Budget -> need): 4 Mio 1.275 | 10 Mio 1.530 | 50 Mio 7.650 | 0,1 Mrd 10.200 |
  0,5-1 Mrd 45.900 | 2 Mrd 63.750 | 4 Mrd 153.000 | **8-1.000 Mrd 1.275.000** | 2.000 Mrd 1.657.500.
  Zyklus 2 (Besitz = Runde 1 bei 210 Mrd, 14 Stuecke), Konto -> need: 10 Mio 5.100 | 50 Mio 8.925 |
  0,1-0,5 Mrd 38.250 (Nanofiber Weave) | 1 Mrd 446.250 (Synfibril Muscle) | 2-3 Mrd 510.000 (Graphene
  Bionic Arms Upgrade) | **>= 5 Mrd 1.657.500** (Graphene Bionic Spine Upgrade).
- Dauerflattern (Gang-Geld hebt need, Ausgeber senken das Konto, need faellt) habe ich als Fixpunkt
  gerechnet: Konto = Ruecklage (echter Plan, nur verdiente Stuecke) nach einem Abfluss. Ergebnis:
  stabil RESPECT, sobald das Konto vor dem Abfluss >= 5 Mrd ist (Z1 und Z2); MONEY vor R nur bei
  Gesamtkonto <= ~2 Mrd UND Ruf >= 64k (Z1) bzw. Konto <= 3 Mrd und Ruf >= 510k (Z2). Ein Dauer-
  flattern braucht ein Konto, das wiederholt UNTER die Ruecklage faellt - in BN2 gibt es dafuer keinen
  Abnehmer (praemisse E8).
- Kein Fix noetig. Wer es glatt will: bn4rep haelt repNeed je augReset monoton (Maximum).

### B4 [niedrig] Fruehes MONEY nach jedem Einbau - beziffert statt "nicht gemessen"
- Zyklus 1 (frisch): unerreichbar. MONEY vor R braucht Konto <= ~2 Mrd bei Ruf >= 64k. BN2.1 Zyklus 1
  (Backups): Konto 2,4 / 4,8 / 8,6 Mrd bei Knoten 1,85 / 2,85 / 3,85 h; Ruf 64k erst bei Gang-Alter
  ~3,3 h (Rufkurve 12.583 / 56.446 / 140.621 bei 2,26 / 3,26 / 4,26 h).
- Zyklus 2+: erreichbar und gewollt harmlos. Nach dem Einbau Konto ~0, Ruf mit Favor ~190/s (BN2.1
  07:32). need 5.100-38.250 bei Konto <= 0,5 Mrd -> MONEY nach Minuten; zwei kurze Fenster (bis Konto
  ~0,5-1 Mrd, und bei Ruf >= 510k bis Konto 5 Mrd), dann RESPECT bis 1.657.500. HT bringt 11-12 % des
  Terrorism-Respekts (gang-p2b-gegen.mjs, 07:17/08:17/09:17: 394/3.527, 578/4.883, 654/5.459), R
  verschiebt sich also um ~die Fensterdauer. Fensterdauer GESCHAETZT 10-20 min (Konto-Rampe nach dem
  Einbau nicht simuliert); Gegenwert fruehes Geld und Ausruestung fuer Aufgestiegene.
- Fix: den Satz "Nicht gemessen, wie oft das im Zyklus 1 passiert" im Kopf durch diese Zahlen ersetzen.

### B5 [niedrig] Ausruestung frisst den Ueberschuss - auch fuer Trainierende
- Gekauft wird alles ueber der Ruecklage; die Ruecklage ist die Planrunde P(M) mit P(P(M)) = P(M)
  (praemisse E8). Solange Ausruestung fehlt, bleibt das Konto auf der Ruecklage und der echte Plan
  waechst nicht. Groesse: Vollausstattung 3,34 / 1,99 / 1,21 Mrd (Rabatt 3,50 / 5,89 / 9,65,
  BN2.1 07:17/08:17/09:17) gegen HT 10-16 Mrd/h -> 5-20 min Verzug, danach nur Nachkaeufe nach
  Aufstiegen. Akzeptabel.
- Mitglieder in der Trainingsphase werden ausgestattet (ausgenommen nur `ascended` dieser Runde). Bei
  Schwelle 1,3 und neuen Mitgliedern verliert jede Ausstattung beim naechsten Aufstieg alles
  (GangMember.ts:308-309) - und die Ausstattung selbst bringt den Aufstieg frueher (expMult, siehe
  Tabelle unten). Im vorgesehenen Fenster (nach R: 12 Mitglieder, 0-1 Aufstiege/h) klein.
  Kein Fix; Option fuer spaeter: nur Phase "work" ausstatten.

### B6 [niedrig] Kopf begruendet mit BN2.1-Zahlen
- "301 / 519 Mrd", "x4,81 -> x7,42 -> x8,41", "~17 Mio Ruf bei Tor gegen 1,66 Mio", "10 von 11 Stunden"
  gehoeren zum Tor 19:13 in BN2.1, das nie kam (substanz S1). P2d wirkt in BN2.2/2.3: S0 x3,21,
  S1 x5,13-5,83, S3 x5,96-6,51 (substanz S2/3), realistisch +23-52 Mrd am ersten Tor, der groessere
  Teil in Zyklus 2 (praemisse E4). Fix: diese Zahlen in DER GELDMODUS.

### B7 [niedrig] Abnahme-Text und eine Telemetrie-Behauptung
- Abnahme 5 "mode money erst, wenn factionRep >= repNeed" ist im Hysterese-Band [repNeed/1,02, repNeed)
  ein Fehlalarm (mode money ist dort richtig). Fix: "beim Umschalten nach money gilt factionRep >= repNeed".
- Kopf: "mode ... null ausserhalb der Fuehrung". `st.mode` wird nie zurueckgesetzt; steigt manageGang
  vor decideMode aus (info/names unlesbar, Hacking-Gang), steht der letzte Wert. Folgenlos (niemand liest
  mode fuer Entscheidungen). Fix: Text oder `st.mode = null` an den Ausstiegen.

### B8 [niedrig] Abnahme-Werkzeug
- `tools/audit/gang-p2b-gegen.mjs` liegt auf master, nicht im Worktree (nach dem Zusammenfuehren da) und
  nimmt "Slum Snakes" fest (Z. 145, 157, 208). chooseFounder nimmt die Kampf-Faktion mit dem KLEINSTEN
  Ruf - gruendet BN2.2 bei Tetrads o. a., wirft es oder rechnet mit falschem Territorium. Der Vergleich
  selbst ist richtig gebaut: (2) rechnet Geld/Zyklus ueber die TATSAECHLICHEN Aufgaben, also auch mit
  Trainierenden und Vigilante. Fix: Faktion aus `gang.facName`.

### B9 [niedrig] Vertragstest fehlt - Wegwerfprobe gruen
- test-bn4rep-ebene2 Z1 prueft checkPrereq auf der ECHTEN bn4rep-Telemetrie, fuer repNeedOf gibt es das
  nicht (test-gang baut bn4rep.json von Hand). Selbst gefahren als Kopie der Testdatei mit Probe Z2
  (danach geloescht, git status sauber): echte Telemetrie (Gang da, 60 Mrd) -> `repNeedOf` 1.657.500,
  `chooseMode` 1,5 Mio respect / 1,7 Mio money, andere Faktion null: **3/3 gruen, 265/265**.
  Fix: Z2 in die Datei aufnehmen.

### B10 [niedrig] Kein eigener Schalter fuer den Geldmodus
- Rueckweg ist gang-2 einspielen (Kopf sagt es). Optional `data/gang-geld-aus.txt` -> repNeed als null.

### B11 [info] test-ram
- Worktree 42 gruen / 2 rot, Grundstand bbbf9b3 mit denselben Tests 43 gueltige Zeilen / 2 rot,
  master 44/0. Ursache geprueft: `src/netburn.js`, `src/stat.js` im Haupt-Repo LF, im Worktree CRLF -
  die Stempel in doku/ram-messung passen nur auf eine Form. Echt veraltet durch P2d: gang.js
  (43 -> 42); bn4rep.js / lib/einbau.js nach dem Einspielen neu messen (eichung-messen --schreib).

## Gepruefte Angriffe ohne Befund

| Angriff | Ergebnis | Beleg |
|---|---|---|
| HT-Parameter wortgleich | ja | tasks.ts:292-317 (0,004 / 1,25 / 360 / 30-5-5-0-30-30 / 36 / 1,5-1,5-1,6) |
| Respekt-/Wanted-Formel | = Quelle (GangSoftcap BN2 = 1) | formulas.ts:15-54 |
| Wanted-Regler mit HT | rechnet wantedGain der gesetzten Arbeitsaufgabe; Rangfolge identisch (gleiche Gewichte), nur Gleichstand bei Respekt 0 nach Name | gang.js planTasks |
| Wanted-Spirale unter HT | nicht moeglich: HT-Wanted 1,25/(3 sw tm)^0,8 faellt mit Staerke; S1 min. Strafe 0,985 | verify-p2b-gang 4 |
| Typen / nie Augmentation | Filter ueber getEquipmentType, "" fuer Unbekannt faellt raus | GangMemberUpgrade.ts:51-66 |
| Preise / Rabatt | gang.js rechnet keine Preise, nimmt getEquipmentCost = cost/getDiscount | Gang.ts:407-434; 21 Stuecke 975 Mio roh/Mitglied, upgrades.ts |
| RAM | 29,95 GB SF4.3 (+8,1: purchaseEquipment 4, getEquipmentCost 2, getEquipmentType 2, getServerMoneyAvailable 0,1; getEquipmentNames 0); bn4rep 68,55 unveraendert | tools/ram.js, RamCostGenerator.ts:289-293 |
| Einbau | Ausruestung bleibt (Prestige.ts:130-144 setzt nur asc_points), Ruf 0 -> RESPECT | getestet in test-gang |
| Aufstieg in Schleife | nein. ACHTUNG, Ausruestung beschleunigt den exp-Gewinn: expMult = 1 + (mult - 1)/4 (str x3,51 -> x1,63); Aufstiege kommen also frueher. Aber jeder Aufstieg braucht in der Arbeit dP >= 3P (Faktor 2), geometrisch - keine Schleife. Gegenprobe: verify-p2b-gang S4, Aufstiege S1/S3 gleich (12; bei 1,3/1,5: 35/36) | GangMember.ts:141-150, 171-177, 298-330 |
| Knotenwechsel 2.2 -> 2.3 | repNeedOf prueft knoten UND nodeReset; alte gang.json -> bn4rep null nach 10 min | gang.js, lib/einbau.js |
| veraltete bn4rep.json | > 30 min -> RESPECT. Am Tor schreibt amTorWarten frische `zeit` mit altem torRunde (bn4rep.js:1993-2000): repNeed dann aus der letzten vollen Runde VOR dem Kauf, geldbedarf.txt ebenfalls (hoch) -> konservativ, danach Einbau, Ruf 0 | bn4rep.js |
| Fehler still geschluckt | nein: bn4rep gangCountError (Leser meldet gangErrors), gang.js noteError je Aufruf; errStreak zaehlt nur Ausnahmen -> Ausruestungsfehler beenden gang.js nicht | gang.js:1360-1373 |
| Bedarfsplan = gleiche Kandidaten | ja; TRP doppelt draussen (kandidaten + EXIT_KEY), fremde Faktion nur mit Ruf und zuerst | lib/einbau.js repNeedKandidaten |
| Bedarfsplan reproduziert | frischer Knoten 1.275.000 fuer 8-1.000 Mrd Budget = praemisse E3 / substanz S3 | need-frisch.mjs |
| Rechenzeit | 3,7 ms (20 Mrd) bis 9,2 ms (1e15) je Bedarfsplan | zeit.mjs |
| Telemetrie-Leser | Felder nur additiv; kein Versions-Pinning auf gang-2 in tools/ | grep |
| Tests selbst gefahren | neu: test-gang 419/0, ebene2 262/262, einbau 83/83, tor-runde 95/95, registry 91/91, test-alles 65/66 (test-ram, B11). Alt-src + neue Tests: 280/76, 245/17, 57/26 - reproduziert | |

## Was ich nicht pruefen konnte

- Die Fensterdauer in B4 (Konto-Rampe nach dem Einbau) - geschaetzt, nicht simuliert.
- Ob bn4net fuer gang.js im fruehen BN2.2 einen 30-GB-Platz findet (Platzierung in lib/reg.js nicht
  nachgelesen) - darum die Pruefung in B2.
- Geld-Absolutwert: weiter erst nach dem ersten Umschalten messbar (Abnahme 1).
