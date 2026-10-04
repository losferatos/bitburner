# P2b Praemissen-Skeptiker: Ist "Geld am Tor" die richtige Frage?

Stand 2026-10-04 09:50 (Systemzeit). Pruefer: Skeptiker PRAEMISSE zu `verify-p2b-gang.md` (A) und
`verify-p2b-geldwert.md` (B). Streng lesend: `src/` unveraendert, im Spiel nur `getFile` (Bruecke 8795,
`instance=LIVE`), nichts committet. Rechner: `tools/audit/gang-p2b-praemisse.mjs` (baut auf
`gang-p2b-lib.mjs` auf, also auf der ECHTEN `waehleTorRunde` aus `src/lib/einbau.js`, die B in 1c auf den
Dollar gegen die Live-Telemetrie geeicht hat). Aufruf: `node tools/audit/gang-p2b-praemisse.mjs [--abschnitt 1..4]`
(Abschnitt 1 liest live; unter 1 min).

## Urteil: TEILWEISE

A und B rechnen sauber, aber auf einer zu engen Frage. Was haelt, was faellt:

| # | Einwand | Schwere | Status |
|---|---|---|---|
| E1 | A baut fuer ein BN2.1-Tor (19:13), das nie kommt: Ausgang 11-13 Uhr, schlimmster gerechneter Fall 14:50 | hoch | gegen A, B bestaetigt |
| E2 | Gegenspieler Vorkauf: im frischen Knoten kauft bn4rep VOR der Gang-Gruendung (q0 >= 2) - kostet mehr, als S1 am ersten Tor bringt; zeitkritisch vor dem BN2.1-Ausgang | hoch | neu (B nannte es "nicht nachgemessen") |
| E3 | A's R-Formel (1,6575 Mio) ist im frischen Knoten falsch; die geplante Runde braucht bis ~1000 Mrd nur 1,25 Mio | mittel | gegen A |
| E4 | Gang-Alter am ersten Tor ist 10,7-12 h, nicht 13 h: S1 bringt am ersten Tor +23-52 statt +63 Mrd | mittel | gegen B (und A's Uebertrag) |
| E5 | Der groessere Hebel ist die Torfrequenz (Preisfaktor 1,9^i beginnt nach jedem Einbau neu), nicht das Geld je Tor | mittel (Pruefauftrag) | Praemisse beider |
| E6 | A's "G noetig" misst gegen Schwelle 0,90; blade.js feuert ab Rang 400k bei 0,50/0,75/0,45 | mittel | gegen A (B: 0,40 statt 0,50/0,75) |
| E7 | Ausruestungskauf nach A-Vorgabe ignoriert `data/geldbedarf.txt` (siebter Ausgeber) | niedrig | gegen A |
| E8 | Ruecklage = Planrunde laesst 1-24 % frei; in BN2 ohne Abnehmer - A's "unkritisch" haelt | niedrig | A bestaetigt, mit Beleg |
| E9 | Abnahme "Faktor 2" ist zu grob fuer eine Formel, deren Geldterme nie live liefen | niedrig | gegen A |

Nicht angegriffen (haelt nach meiner Pruefung): S2 Territorium nicht bauen, S3g nicht bauen, S4 Reglerwerte egal,
"Tote = 0 ohne Warfare" (Gang.ts:210-216, 281-303), Wanduhr = Spielzeit im ungedrosselten Lauf, Rufrate kein
Bestandsabbau (Gang.ts:144-155 schreibt Ruf aus der laufenden Respektrate).

## E1 - BN2.1: der Ausgang kommt Stunden vor dem Tor (hoch)

**Behauptung A:** "Bauen: S1 plus S3 ... Landet der Bau nach 09:11, schaltet der erste Lauf sofort um"; alle Zahlen
(x7,42, G noetig 1,22, 388 Mrd Kasse) beziehen sich auf "Tor 1 19:13". A raeumt in "open" 3 ein, den Ausgang
nicht nachgerechnet zu haben.

**Gemessen (Abschnitt 1, live 09:45/09:47):** Rang 225.159 -> 231.493, 16 von 21 Black Ops (Annihilus erledigt,
Ultron 0,98 > 0,90). Rangrate aus `data/aktionen.txt` 76.374/h (2 h), 75.656/h (1 h); Assassination-Bloecke
steigen 85k -> 101k -> 124k Rang je Aktionsstunde; 09:29 -> 09:47 +48.700 (~160k/h inkl. Annihilus).
Eichung: die Rate 07:45-08:45 linear fortgeschrieben trifft den Rang 09:45 auf -0,7 %.

| Groesse | Wert |
|---|---|
| Rang bis 400.000 (Daedalus-Schranke, BlackOperations.ts:704-710) | 174.841 (09:45) |
| Rang 400k bei 2-h-Rate / 1-h-Rate / 30-min-Rate | 12:02 / 12:04 / 12:31 |
| Schwellen ab Rang 400k (blade.js:2349-2360, einsatz = rankLoss/(rankGain+rankLoss)+0,25, :2275, :2320-2327) | Centurion 0,50, Vindictus 0,75, Daedalus 0,45 |
| Chance jetzt (Bot) | 0,293 / 0,273 / 0,256 -> Faktor 1,71 / 2,75 / 1,76 noetig |
| Chancenwachstum bis 400k bei gemessener Steigung (1,17 ln je 100k Rang) / halber Steigung | x7,8 / x2,8 |
| Eichung Chancensteigung (08:24-09:17 auf 09:45 fortgeschrieben) | sagt 0,317 voraus, Bot 0,256: -19 % -> deshalb das Band "halbe Steigung" |
| **Schlimmster gerechneter Fall** (halbe Rangrate, halbe Chancensteigung, +30 min fuer die letzten drei Ops) | **Ausgang 14:50**, Tor 19:13 |
| Kritische Rangrate (Ausgang genau am Tor) | 19.491/h = 26 % der gemessenen 2-h-Rate |

Folgen: (a) In BN2.1 ist jedes Gang-Geld 0 h wert - B hat recht, A's Bauempfehlung hat fuer BN2.1 keinen Ertrag.
(b) Selbst wenn der Ausgang wider Erwarten nah am Tor laege, sperrt `einbauErlaubt` (lib/endspurt.js:249-288) bei
offenem Ausgang oder sicherer Restzeit < 186 min. (c) Ein Einspielen von gang.js jetzt ist Arbeit und Risiko im
Endspiel ohne Ertrag - einziger Nutzen waere eine Live-Messung von `moneyGainRate` (siehe E9), und die konkurriert
um dieselben 2-5 Stunden mit E2.

Nebenbefund B: B rechnet "danach 0,40" (5A); real sind es 0,50/0,75/0,45. B's Ausgangszeiten (10:23-12:33) sind
damit leicht optimistisch; an der Aussage "vor dem Tor" aendert das nichts.

## E2 - Gegenspieler: Vorkaeufe vor der Gang-Gruendung im frischen Knoten (hoch, zeitkritisch)

**Behauptung B (7.2):** "Kaufaufschub ... ist gebaut; zu pruefen bleibt, dass im frischen Knoten zwischen Knotenstart
und createGang nichts gekauft wird ... in den ersten Minuten noch keinen Ruf, also kaum Anlass - nicht nachgemessen."
A rechnet alle frischen Knoten mit q0 = 0.

**Code:** Der Kaufaufschub (Block 1c) greift nur mit Gang: `bn4rep.js:1611-1614` (`if (nurKampfStuecke)` ...
`if (inGangNow)`), die alte Kaufschleife `bn4rep.js:2204` (`for (const k of inGangNow ? [] : kandidaten...)`) kauft
sonst jedes verdiente, bezahlbare Stueck. Der Kampffilter laesst die billigen Fruehstuecke durch:
`lib/hackaugs.js:269` Wired Reflexes, `:252` Neurotrainer I, `:232` EsperTech Bladeburner Eyewear,
`kampfknotenNuetzlich` `:399-403`. gang.js gruendet erst, wenn eine Kampf-Gang-Faktion beigetreten ist; Slum Snakes
verlangt Karma -9, Kampfwerte 30, 1 Mio $ (`Faction/FactionInfo.tsx:665`), und ein neuer Knoten setzt Karma auf 0
(`PlayerObjectGeneralMethods.ts:146`) und die Gang auf null (`:157`).

**Gemessen (BN2.1 Zyklus 1, Backups):**

| Knotenzeit | Karma | Slum Snakes | Warteschlange |
|---|---|---|---|
| 0,85 h | -6,2 | nicht beigetreten | Wired Reflexes, Neurotrainer I |
| 1,85 h | -9,2 | beigetreten | dieselben 2 |
| 2,85 h | -22,2 | beigetreten | + EsperTech Bladeburner Eyewear |

Im frischen Knoten liegen also bei der Gruendung **q0 >= 2** Stuecke in der Warteschlange, und jedes Stueck der
ersten Torrunde kostet x1,9^q0 (`AugmentationHelpers.ts:30`, Preisformel von B 1a auf 1e-14 geeicht).

**Gerechnet (Abschnitt 2, echte Rundenwahl, Analogon B 2C, Ruf 1,275 Mio, Competence inkl. der Vorkaeufe):**

| Geld am Tor | q0 = 0 | q0 = 1 | q0 = 2 | q0 = 3 |
|---|---|---|---|---|
| 36 Mrd (B-Basis) | x3,21 | x2,66 | **x2,35** | x1,69 |
| 63 Mrd | x3,84 | x3,21 | x2,61 | x2,37 |
| 100 Mrd | x4,71 | x3,84 | x3,04 | x2,59 |

Zwei Fruehstuecke fuer zusammen 6,5 Mio $ kosten bei 36 Mrd ln 0,31 - mehr als S1 am ersten Tor bringt
(36 -> 58-88 Mrd: ln 0,18-0,35, E4). Mit q0 = 2 schrumpft der S1-Gewinn von x3,21 -> x3,84 auf x2,35 -> x2,61
(ln 0,10). Nach B's Stundenmodell 5D (+-50 %) liegen zwischen x2,35 und x3,21 rund 2 h je Knoten.

**Zeitkritisch:** BN2.2 beginnt mit dem BN2.1-Ausgang (E1: heute 11-15 Uhr). Die Aenderung wirkt nur ohne Gang, laesst
den laufenden BN2.1 also unberuehrt; beim Knotenwechsel starten alle Skripte neu und laden die Datei von home - sie
muss nur VOR dem Sprung auf home liegen, ein Neustart von bn4rep in BN2.1 ist nicht noetig.

Randnotiz: Der Effekt ist nicht gang-spezifisch. In jedem V2-Knoten, in dem das Tor ohnehin erst nach 12 h kommt,
verteuert jeder Kauf vor dem Tor die Runde um x1,9 (B 2B: Faktor 1,40 in BN2.1 Zyklus 2). Nicht gerechnet.

## E3 - A's Ruf-Ziel R fuer andere Knoten ist im frischen Knoten zu hoch (mittel)

**Behauptung A (Abschnitt 8.1):** R = 1,02 x max(repReq) der unbesessenen Kampfstuecke ohne TRP und ohne
Stuecke > 100 Mrd Grundpreis. Im frischen Knoten ergibt das **1.657.500** (Graphene Bionic Spine Upgrade 1,625 Mio).

**Gerechnet (Abschnitt 2):** Der hoechste Rufbedarf der GEPLANTEN Runde (echte `waehleTorRunde`, Ruf unbegrenzt) ist
bei jedem Budget von 20 bis 1.000 Mrd **1,25 Mio** (SPTN-97), erst bei 2.000 Mrd 1,625 Mio - fuer Typhoon-,
RedDragon- und Daedalus-Gewichte gleich. A's eigene Tabelle (Abschnitt 3, frischer Knoten) zeigt dasselbe bis 150 Mrd.
Mit R 1,275 Mio und 1,6575 Mio ist die Competence bis 1.000 Mrd identisch; der hoehere Wert kostet nur Zeit:

| Rufkurve fortgeschrieben (g = Zuwachs der Rufrate je Stunde) | R 1,275 Mio erreicht | R 1,6575 Mio erreicht | weniger Human Trafficking | weniger Geld am Tor | ln Competence (Tor 12 h) |
|---|---|---|---|---|---|
| g = 0 | 9,44 h | 11,14 h | 1,69 h | 24,7 Mrd | 0,070 |
| g = 40.000/h^2 (B) | 8,79 h | 9,86 h | 1,07 h | 15,6 Mrd | 0,073 |
| g = 80.000/h^2 | 8,44 h | 9,29 h | 0,85 h | 12,4 Mrd | 0,118 |

Rufkurve gemessen (Backups, Favor 0, faction_rep 1,3683): 12.583 (2,26 h), 56.446 (3,26 h), 140.621 (4,26 h),
328.909 (5,26 h), 509.596 (6,06 h); Rate zuletzt 188k/h und 226k/h. Im frischen Knoten liegt faction_rep ~3 %
tiefer (NFG 6 -> 3 Stufen aus SF12.3, `Prestige.ts:255`), die Zeiten also eher spaeter.

Ab Zyklus 2 (SPTN-97 besessen) braucht die Runde tatsaechlich 1,625 Mio (Abschnitt 3: "Rufbedarf Runde 2 ohne
Deckel 1,625 Mio") - die richtige Regel ist also nicht "max ueber alle Unbesessenen", sondern
**R = 1,02 x max(repReq der Runde, die `waehleTorRunde` mit Ruf unbegrenzt beim erwarteten Torbudget plant)**.

## E4 - Das erste Tor kommt bei Gang-Alter 10,7-12 h, nicht 13 h (mittel)

**Behauptung B (5E/5G):** "erstes Tor ~13 h nach Knotenstart", "Respekt bis 1,25 Mio (~8,7 h), danach 4,3 h Human
Trafficking: +63 Mrd am Tor, +1,0 bis +1,9 h je Knoten". Die Rechnung setzt Gruendung = Knotenstart.

**Beleg:** Das Tor oeffnet `einbau-uhr.fertig + max(12 h, 2 x Wiederaufbau)` (`lib/endspurt.js:322-331`); im
frischen Knoten waren die Kampfwerte schon bei 0,85 h ueber 100 (Backup 03.10. 05:33: 119/119/120/120), also
Tor bei ~12,5-12,9 h Knotenzeit. Die Gang entsteht erst mit Slum Snakes (zwischen 0,85 und 1,85 h, Tabelle E2).
Gang-Alter am Tor: **10,7-12,0 h**.

| Tor nach Gruendung | Geld am Tor mit S1 (R 1,275 Mio; g 0 / 40k / 80k) | Competence | ohne Gang-Geld |
|---|---|---|---|
| 11 h | 58,7 / 68,3 / 73,3 Mrd | x3,84 / x4,05 / x4,05 | 36 Mrd, x3,21 |
| 12 h | 73,3 / 82,9 / 87,9 Mrd | x4,05 / x4,36 / x4,56 | |
| 13 h (B) | 87,9 / 97,5 / 102,5 Mrd | x4,56 / x4,71 / x4,71 | |

B's +63 Mrd ist der obere Rand; realistisch +23 bis +52 Mrd am ersten Tor (alles mit q0 = 0 - mit q0 = 2 siehe E2).
Der groessere S1-Anteil faellt in Zyklus 2 (Favor aus Zyklus 1 ~200 -> Ruf x3, R nach ~1,5 h, ~10 h Geldphase) -
aber nur, wenn der Ausgang nicht schon in Zyklus 2 liegt. Das hat keiner der beiden Berichte gerechnet.

## E5 - Praemisse: die Torfrequenz, nicht das Geld je Tor (mittel, als Pruefauftrag)

Beide Berichte finden denselben Mechanismus und ziehen die Folgerung nicht: Der Preisfaktor 1,9^i macht Geld an EINEM
Tor schnell wertlos (B: Grenzertrag 0,067 ln/Mrd bei 5-10 Mrd, 0,0004 bei 600-1.200 Mrd; A: "Takt des Tors ist die
eigentliche Bremse"). Nach jedem Einbau beginnt i wieder bei 0. Und Gang-Geld ueberlebt jeden Einbau (nur das
Spielerkonto wird zurueckgesetzt), Gang-Respekt ebenfalls.

**Gerechnet (Abschnitt 3, echte Rundenwahl, gleiches Gesamtgeld, nur Competence):**

| Geld M | 1 Runde | 2 x M/2 (Ruf unbegrenzt) | 2 x M/2, Runde 2 nur 0,25 / 0,5 Mio Ruf | 1 Runde braeuchte fuer 2 x M/2 |
|---|---|---|---|---|
| 36 Mrd | x3,21 | x5,66 | x4,22 / x5,11 | 172 Mrd |
| 75 Mrd | x4,05 | x9,01 | x5,45 / x7,39 | 674 Mrd |
| 100 Mrd | x4,71 | x13,30 | x6,95 / x9,22 | 1.868 Mrd |

Kontrolle: `total()` der Einzelrunde = `gain` der Planung (4,0530 / 4,0530).

Das ist **kein Bauauftrag**: nicht gerechnet sind die Kosten eines Einbaus - Wiederaufbau (frischer Knoten Zyklus 1
3,1 h, BN2.1 Zyklus 3 486 s), Kampfwerte-Delle (A: Competence-Proxy x2,68 -> x2,30 nach 12 min, x6,85 nach 1,2 h),
Faktionsruf auf 0 (Favor steigt dafuer), Gang-Aufstiegspunkte x0,95 je Einbau (`GangMember.ts:287-296`,
`Gang/data/Constants.ts:16`), Hacking- und Parkneuaufbau. Die 12-h-Regel (`KAMPF_EINBAU_MIN_MS`, eingefuehrt
22.09. in becb0d8 fuer BN9 mit 5-20 h Wiederaufbau) wurde nie gegen kurze Wiederaufbauten gerechnet. Solange diese
Rechnung fehlt, ist "mehr Geld am festen 12-h-Tor" nicht als der Hebel belegt.

## E6 - A's "G noetig" misst gegen die falsche Schwelle (mittel)

A (Abschnitt 2 und 7): "G noetig = max ueber offene Ops von 0,9 / (Chance x Verhaeltnis)". blade.js feuert ab Rang
400.000 bei max(0,40, einsatzSchwelle) = Centurion 0,50, Vindictus 0,75, Daedalus 0,45 (`blade.js:2333-2360`), und
Rang 400k kommt vor jedem Tor (E1). Fuer die drei entscheidenden Ops ist A's Bedarf um den Faktor 1,2 (Vindictus) bis
2,0 (Daedalus) zu hoch - die Sicherheitsaussage "S1/S3 senken G noetig von 1,87 auf 1,22/1,08" ueberzeichnet den
Bedarf auch dort, wo ein Tor vor dem Ausgang liegt.

## E7 - Ausruestung nach A-Vorgabe kauft aus der Ruecklage (niedrig)

A 8.3: "kaufen, sobald `ns.getServerMoneyAvailable("home") >= getEquipmentCost`". Die sechs anderen Ausgeber ziehen
`data/geldbedarf.txt` ab (bn4net.js:1272, homegrow.js:77, graftauto.js:333, hacknet.js:135, hashes.js:215,
bn4life.js:344). gang.js waere der siebte ohne Abzug. Groesse: A rechnet 4,37 Mrd ueber 10 h, eine volle
Neuausstattung nach einem Aufstieg ~2 Mrd (Rabatt 5,6 bei 22 Mio Respekt, `Gang.ts:407-416`). Am frischen Tor (36-100
Mrd) sind das 2-5 % des Rundenbudgets; trifft ein Aufstieg die Torrunde, bricht sie mit "drift"/Geld weg ab und plant
neu. Vorgabe: `geldFrei = Konto - geldbedarf` wie die anderen.

## E8 - Ruecklage: Luecke ja, Abnehmer nein (niedrig, A haelt)

`bedarf = gateBedarf` (`bn4rep.js:2288-2291`) ist die Planrunde P(M) <= Konto M. Abschnitt 4: frei 1-24 % von M
(36 Mrd: 4,4; 150 Mrd: 23,9; 600 Mrd: 62,1), P(P(M)) = P(M) an allen 11 Stuetzstellen (kein Abwaertssog). Abnehmer in
BN2 fehlen: Server-Ausgaben Zyklus 2 nur 1,09 Mrd bei bis zu 63 Mrd Konto, Zyklus 3 bisher 0,16 Mrd; bn4net
`kapFreiGb` 19.767 von 19.959 GB (09:33, keine RAM-Nachfrage); home-Kerne seit Tagen 2 (Preisdeckel). A's
"unkritisch" haelt in BN2 - gilt aber nicht automatisch fuer Knoten mit RAM-Hunger.

## E9 - Abnahme zu grob (niedrig)

A 8.5: "liegt der Wert um mehr als Faktor 2 darunter, ist die Geldformel falsch". Respekt ist auf 0,07 % geeicht, die
Geldterme (`baseMoney`, Territoriumsfaktor) liefen nie. Ein Fehler von 40 % in einem Geldterm fiele durch. Vorschlag:
Soll aus `gang-formulas.mjs` mit den Live-Mitgliederwerten zur selben Minute, Toleranz +-5 %.

## Korrigierte Empfehlung (Reihenfolge)

1. **BN2.1: kein Gang-Umbau fuer Ertrag**, kein Plan um ein Tor 19:13. Rang 400k gegen 12:00-12:30, Ausgang danach;
   schlimmster gerechneter Fall 14:50. Pruefen: Rangrate faellt unter ~20.000/h -> neu rechnen (Abschnitt 1).
2. **Vor dem BN2.1-Ausgang (zeitkritisch): Kaufaufschub ab Knotenstart**, wenn die Gang geplant ist (BN2 und
   `data/gang-an.txt` vorhanden): die Schleife `bn4rep.js:2204` kauft dann auch ohne `inGangNow` nichts. Nur auf home
   legen, kein Neustart in BN2.1 noetig. Wert: q0 2 -> 0 = x2,35 -> x3,21 am ersten Tor (36 Mrd), groesser als S1.
   Mit Skeptiker (Ausloeser "laeuft weiter, wenn niemand hinsieht").
3. **S1 fuer BN2.2/2.3 ja, aber mit R aus der Planrunde** (1,02 x max repReq von `waehleTorRunde` bei Ruf unbegrenzt und
   erwartetem Torbudget; Zyklus 1: 1,275 Mio, nicht 1,6575 Mio). Erwartung realistisch: +23-52 Mrd am ersten Tor,
   der groessere Teil in Zyklus 2.
4. **S3 ja, mit Abzug der Ruecklage** (E7).
5. **Vor jeder weiteren Geldoptimierung: Torfrequenz rechnen** (E5) - eine Runde gegen zwei halbe mit allen
   Einbaukosten, frischer Knoten und Spaetzyklus getrennt.
6. S2, S3g, S4 nicht bauen (wie A). Abnahme mit +-5 % gegen die Formel (E9).

## Was ich nicht rechnen konnte

- Den Stundenwert der Korrekturen: B's Stundenmodell (5D, +-50 %, ungeeicht) habe ich nur zitiert, nicht neu aufgelegt.
- Die Einbaukosten fuer E5 (Wiederaufbaudauer als Funktion der Augs, Rangdelle, Hacking-Neuaufbau).
- Ob BN2.2 in Zyklus 2 oder 3 endet - davon haengt ab, ob S1-Geld am zweiten Tor zaehlt.
- Den Effekt von Vorkaeufen in Nicht-Gang-V2-Knoten (E2 Randnotiz).
- Die Chancen in Abschnitt 1 sind die Schaetzung des Bots (`boChancen`), nicht der Spielwert; die Steigung ist an zwei
  Punkten geeicht (-19 % Ueberschaetzung), darum das Band mit halber Steigung.
