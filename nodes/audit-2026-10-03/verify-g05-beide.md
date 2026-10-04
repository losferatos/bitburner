# Gegenpruefung G05 (Winkel Substanz und Betrieb): home-Kerne, home-RAM, Preisvergleich

Befunde: INFRA-2, HACK-5, INFRA-4. Stand 04.10.2026 13:30 (Systemzeit). Pruefer: Subagent G05.
Streng lesend: `src/` unveraendert, nichts committet, im Spiel nichts angefasst (nur `backups/`
gelesen). Geschrieben nur `tools/audit/verify-g05-*.mjs` und diese Datei.

## Kurzurteil

**TEILWEISE.** Die Richtung von INFRA-2 stimmt (der Kern ist ein Verlustgeschaeft), aber Betrag und
Prioritaet sind deutlich kleiner als behauptet. HACK-5 ist eine Doppelzaehlung von INFRA-2 und INFRA-4.
INFRA-4 stimmt in den Preisen, aber seine Wirkung ist ohne INFRA-1/INFRA-3 **umgekehrt**: allein
gebaut wuerde der Fix BN2.1 um 45 bis 104 Mrd Hackeinnahmen aermer machen (Gewinn 14 Mrd Ersparnis).

| Befund | Urteil | Eigener Ertrag (absolut) | Basis |
|---|---|---|---|
| INFRA-2 Kerne ohne Nutzen | TEILWEISE | **+6,1 bis +10,4 Mrd je Kampfknoten**, am Tor ca. **0,09-0,35 h**; BN2.1 selbst 0 h. Nicht "31 %" und nicht "1,17 h Einnahmen". Prioritaet P3 statt P1 | Mrd GERECHNET_GEEICHT, Stunden aus P2b geliehen |
| HACK-5 Kerne + RAM ohne Preisvergleich | TEILWEISE | **0 zusaetzlich**: Kern = INFRA-2, RAM = INFRA-4; Szenario F (+7,9 Mrd/h) gehoert dem Park-Rueckstau (INFRA-1/HACK-2), nicht der Umwidmung | GERECHNET_GEEICHT |
| INFRA-4 home-RAM ohne Vergleich | TEILWEISE | **isoliert -45 bis -104 Mrd** (Verlust); erst nach INFRA-1/3 **+10 bis +11 Mrd je Knoten (0,15-0,37 h)** | GESCHAETZT |

## 0. Eichung (Soll = Spielstandwert, Ist = eigener Rechner aus dem Quellcode)

Rechner `tools/audit/verify-g05-preise.mjs`: Formeln direkt aus `reference/bitburner-src/src/`
(`PlayerObjectServerMethods.ts:30-44`, `Server/ServerPurchases.ts:24-54`, Konstanten `Server/data/Constants.ts:3-4`,
BN-Faktoren `BitNode/BitNode.tsx`), nicht aus den Audit-Werkzeugen uebernommen.

| Was | Soll (Spiel) | Ist (Rechner) | Abweichung |
|---|---|---|---|
| E1 20 Cloud-Preise `data/preise.json` BN2.2 (vom Spiel, Softcap 1,3) | Tabelle | `cloudCost` | max 0 |
| E2a `moneySourceB.servers` 03.10. 06:33 -> 07:33 (home 512 -> 1024 + Park) | 1,0335 Mrd | 1,0335 Mrd | 0 |
| E2b dto. 08:33 -> 09:19 (Kern 1 -> 2 + Park) | 7,5225 Mrd | 7,5225 Mrd | 0 |
| E2c dto. zwischen Staenden home 2048 -> 4096 | 10,0394 Mrd | 10,0394 Mrd | 1,9e-16 |
| E3 Kernkauf-Zeit: Log `home-Kerne auf 2` 08:36:52 gegen Konto 08:33 = 8,63 Mrd (+0,1 Mrd/min) | Schwelle 1,2 x 7,5 = 9,0 Mrd | erreicht ca. 08:37 | passt |
| E4 Dienst-RAM: Summe der Prozesse ausser worker/* im Spielstand | 348,4 GB (BN2.1 10:17) / 364,8 GB (BN2.2 12:17) | - | direkt gemessen |

Die Preise sind damit auf Maschinengenauigkeit geeicht; alles Folgende rechnet mit ihnen.

## 1. Wirken home-Kerne irgendwo? (Spielquelle, vollstaendig)

`grep cpuCores/getCoreBonus` ueber `reference/bitburner-src/src/`: der Kernbonus `1 + (c-1)/16`
(`Server/ServerHelpers.ts:315-318`) wirkt auf **genau fuenf** Stellen:

1. `grow` (`NetscriptFunctions.ts:288`), 2. `weaken` (`:359`), 3. `share` (`NetworkShare/Share.ts:22-25`),
4. Stanek-`chargeFragment` (`NetscriptFunctions/Stanek.ts:47-53`), 5. Offline-Fortschritt von Skripten
(`Script/ScriptHelpers.ts:52, 89`). `hack` hat keinen Kernbonus. Dazu +3 Int-Erfahrung je Kauf
(`Singularity.ts:586`, `IntelligenceSingFnBaseExpGain 1,5 x 2`) - gegen ca. 840 Erfahrung bis zur naechsten Stufe.

Im Bot: `lib/calc.js:437, 442` (die Kennzahlen von bn4net) rechnen hart mit `cores = 1`; `lib/batch.js:94, 107-108`
und `autopilot.js` rufen `growThreads/weakenThreads` ohne Kerne; `grep cpuCores` in `src/` findet nur
`homegrow.js`, `homeram.js` (Altskript, nicht in `registry.json`) und die Anzeige `kerne.js`. Kein Stanek,
kein Skript, das den Bonus verbraucht. **Bestaetigt: der Bot plant nirgends mit Kernen.**

Was der Kern in BN2.1 tatsaechlich bewirkte (`verify-g05-zeitreihe.mjs`, `verify-g05-szenario.mjs`):

- Auf home liefen bei 1024 GB (nach dem Kern) **672 GB share und 5 GB grow/weaken** (09:59). Der Kern hob
  also zuerst nur den share-Bonus: Faktor `1 + ln(275,5/265)/25 - 1 = +0,16 %` Fraktionsruf - und in BN2
  hat share ohnehin keinen Abnehmer (HACK-1, nicht von mir geprueft; ohne HACK-1 bleiben es 0,16 %).
- Nach dem Sprung auf 4096 GB trug home 1100-2600 GB grow/weaken. **Obergrenze des Rueckflusses**, wenn bn4net die
  gesparten Faeden (`homeGw x (1 - 1/1,0625)`) voll mit y Dollar je GB und Sekunde verwertet haette:
  **1,28 Mrd (y=208), 1,48 (y=242), 2,42 (y=395)** bis Knotenende, plus hoechstens 0,3 Mrd fuer die Luecke
  ohne Spielstaende. Gegen 7,5 Mrd Kaufpreis. Auch bei voller Verwertung also ein Verlust von mindestens 4,8 Mrd.
- "Ueberschuss ist wirkungslos" (INFRA-2) ist leicht uebertrieben: die Rueckkopplung der Mischung
  (`bn4net.js:2475-2500`) und die Anlaufphase (state-basiert, `:2440-2473`) setzen einen Teil des Ueberschusses
  in schnellere Saeuberung um. Das ist in der Obergrenze oben schon enthalten und aendert das Urteil nicht.

## 2. INFRA-2 / HACK-5: die Zahlen nachgerechnet

**"31 % der Hackeinnahmen" ist ein Zeitpunktwert.** 7,5 / 24,47 Mrd (kumulierte `moneySourceB.hacking` um 09:59,
5,29 h im Knoten) = 30,6 %. Ueber den ganzen Knoten: 7,5 / 178,09 Mrd = **4,2 %** der Hackeinnahmen, aber
7,5 / 23,76 = **31,6 % der Serverausgaben** (Kern 7,5 + home-Leiter 14,64 + Park ca. 1,6). "1,17 h Einnahmen"
rechnet mit der Rate zum Kaufzeitpunkt (6,39 Mrd/h); die Rate am Zyklusende war 14,72 Mrd/h (0,51 h).

**Der Kern hat einen Folgeschaden, den der Befund nicht nennt (Sequenz).** `homegrow.js:88-98` prueft Kerne
VOR dem Speicher. Um 08:36:52 stand das Konto bei ca. 9,0 Mrd: Kernschwelle 1,2 x 7,5 = 9,0 Mrd, RAM-Schwelle
fuer 1024 -> 2048 aber 3 x 3,177 = 9,53 Mrd (nur ca. 5 Minuten spaeter). Der Kern kam zuerst und raeumte das
Konto; die 2048-Verdopplung folgte laut Log erst um 10:01:00 = **1,40 h spaeter**. 1024 GB x 1,32 h x y
(216/300/395) = **1,05 / 1,46 / 1,93 Mrd** entgangene Hackeinnahmen.

**Netto des Kernkaufs** (Verlust gegen "nicht kaufen"): 7,5 + (1,05 bis 1,93) - (0 bis 2,42 Rueckfluss) =
**6,1 bis 10,4 Mrd**. In Stunden am Tor (P2b-Geldwert, 2C: +47 Mrd bringen +1,6 h aus 36 Mrd, +0,7 h aus
75 Mrd = 0,034 / 0,0149 h je Mrd): **0,09 bis 0,35 h je Kampfknoten**, in dem der Kauf vor dem Tor
ausloest. Die Stundenumrechnung ist ein Fremdwert (Modell des P2b-Pruefers), nicht von mir geeicht.
In BN2.1 selbst 0 h: der Ausgang kam vor Tor 2 (P2b-Geldwert).

**HACK-5-Detail "Amortisation > 200 h":** gilt fuer den Zustand 1024 GB (35 GB x 208). Bei home 4096 GB
(`homeGw` im Mittel ca. 1800 GB, eingeplant gespart 106 GB) sind es 94 h (y=208) bis 50 h (y=395) - weiterhin
laenger als der Knoten (29,9 h) und als der Rest nach dem Kauf, die Schlussfolgerung haelt, die Zahl nicht.
Der Break-even-Wert "18,9 TB home" (INFRA-2) rechnet mit `f_gw = 0,9` (Anteil grow/weaken am home-RAM);
gemessen sind 0,35-0,63 (und 0 solange home share traegt) - der echte Break-even liegt hoeher.

**HACK-5 "dieselbe Summe haette den Park auf 25x1024 gebracht (Szenario F +7,9 Mrd/h)":** der Preis stimmt
(25 x 160,86 Mio - Bestand = 3,73 Mrd), der Ertrag nicht als Folge der Umwidmung. Der Park wuchs in BN2.1 nicht
am Geld, sondern am 10-Minuten-Takt: +384 GB/h in den ersten Stunden = ein Schritt je 10 min (Reihe), Geld lag
dabei ungenutzt (63 Mrd um 06:17). Mehr Geld kauft keinen schnelleren Park (INFRA-1).

## 3. Wechselwirkung mit P1/P2c/P2d (live seit 04.10.): schwaecher als vermutet

Der Befund (BN2.1, 03.10.) liegt vor dem Kaufaufschub. `homegrow.js:78-79` zieht nur `data/geldbedarf.txt`
ab (`bn4rep.js:2382-2386`: im Gang-Betrieb = `gateBedarf = plan.cost`, die Kosten der Runde, die mit dem
Geld **von jetzt** und dem Ruf **von jetzt** gekauft wuerde). Gemessen im Tor-Zyklus (`verify-g05-ruecklage.mjs`,
Konto minus Bedarf; Kernschwelle 9,0 Mrd bei 1 Kern, 67,5 bei 2):

| Stand 04.10. | Konto | Bedarf | frei | Kern (bei 1 Kern) |
|---|---|---|---|---|
| 02:17 | 20,51 | 0,00 (Plan leer, cost 0) | 20,51 | **wuerde kaufen** |
| 04:17 | 39,75 | 33,36 | 6,38 | nein |
| 06:17 | 63,19 | 43,36 | **19,83** | **wuerde kaufen** |
| 07:05 | 4,34 | 70,20 | -65,9 | nein |
| 08:17 | 6,08 | 6,02 | 0,06 | nein |
| 09:17 | 16,29 | 15,93 | 0,36 | nein |
| BN2.2 12:17 | 1,48 | 0,01 | 1,47 | noch nicht (Schwelle 9,0) |

Die Ruecklage ist **ruf-begrenzt**: um 06:17 plante die Runde 43,4 Mrd, am Tor 48 min spaeter waren es
70,2 Mrd - die "freien" 19,8 Mrd wurden am Tor gebraucht. Ein Leser, der nur die aktuelle Ruecklage abzieht,
unterschaetzt den Torbedarf systematisch, solange der Ruf waechst. **P1 sperrt den Kernkauf also nicht**; in
2 von 7 Stichproben unter P1 (02:17, 06:17; die Probe 00:17 liegt vor P1 und zaehlt nicht) haette er (bei 1 Kern) ausgeloest, und das Konto in BN2.2 (1,47 Mrd frei bei 1,65 h
Knotenzeit) laeuft auf die 9,0-Mrd-Schwelle zu. Der Befund bleibt fuer BN2.2/2.3 gueltig. Er konkurriert dort
direkt mit dem Torgeld (gleicher Topf) und mit der Ausruestung von `gang.js` (P2d, "aus Geld ueber der Ruecklage").

## 4. INFRA-4: die home-RAM-Leiter

**Preise (nachgerechnet, Tabelle `verify-g05-preise.mjs`):** BN2: home 7,9e5 / 1,2e6 / 2,0e6 / 3,1e6 / 4,9e6 $/GB
bei 128 / 256 / 512 / 1024 / 2048 GB (Verdopplung ab dieser Groesse), Cloud-Schritt r -> 2r 8,8e4 (r=64) bis 3,3e5
(r=2048). Der Befund-Faktor 9-22 (7,9e5 gegen 8,8e4 und 2,0e6 gegen 8,8e4) stimmt. **Er ist aber BN-abhaengig und
nicht konstant:** bei gleicher Gesamtkapazitaet (home 1/2/4 TB gegen Park 25 x 256/512/1024) ist home in BN2
21-31 x, BN3 16-23 x, BN13 10 x, BN14/15 56-141 x teurer - in **BN6/BN7/BN11 (Softcap 2) nur 4,7 / 3,7 / 2,9 x**,
und ab 2 TB je Cloud-Server (5,3e6 $/GB) ist der Park dort **teurer** als home (4,9e6). Eine fest verdrahtete
Regel "home nie ueber 512" waere in diesen drei Route-Knoten falsch; nur der Livevergleich traegt.

**Der Befund-Ertrag ("dasselbe Geld haette 8-10 x mehr Cloud-RAM gekauft") ist so nicht erzielbar.** Beleg:

- Der Park war nicht am Geld, sondern am Takt begrenzt (INFRA-1: ein Auftrag je Runde, 600 s Wartezeit;
  Code `bn4net.js:244-272, 1499-1518`, `shop.js` unveraendert seit dem Audit). Reihe: Park nach Einbau 1 von 1664
  auf 9728 GB in 12 h, +384 GB/h am Anfang. Geld lag dabei brach (Konto 63 Mrd um 06:17).
- Der Park geht bei **jedem Einbau** auf null, home bleibt (`Prestige.ts:73-80`, nur Programme zurueckgesetzt).
  Direkt nach Einbau 1 war home 4096 GB von 6988 GB Netz = **59 %**.
- Die home-Verdopplung 2048 -> 4096 (10,04 Mrd) hat einen **realisierten** Ertrag: +2048 GB x y (116-395
  $/GB*s; Durchschnitt 116 in der Aufbauphase bis 242 am Ende, Regression Grenzertrag 395) = 0,86-2,9 Mrd/h,
  Amortisation 3,5-11,7 h, bei 16,5 h Restlaufzeit also brutto 14-48 Mrd gegen 10,04 Mrd Kosten. Der Befund
  nennt selbst "2,6 h" fuer 512 -> 1024 - das ist ebenfalls eine Amortisation, kein Verlust.

**Szenario R (INFRA-4 allein umgesetzt, home gedeckelt bei 512 GB, Cloud weiter gedrosselt):**
`verify-g05-szenario.mjs` ueber die Spielstand-Reihe: Verlust an Hackeinnahmen in BN2.1
**45,2 Mrd (proportional, Untergrenze) bis 104,3 Mrd (Grenzertrag 395)**, gespart nur 14,22 Mrd (home 512 ->
4096). Das sind 25-58 % der Hackeinnahmen des Knotens (178 Mrd). Caveat: die Reihe hat zwischen 09:59 und 17:16
(03.10.) eine Luecke von 7,28 h ohne Spielstand (Ausfall unbekannt); dort steht nur die Differenz zweier
Staende (Spielzeit == Wanduhr laut `playtimeSinceLastBitnode`), kein Stundenwert.

**Szenario F (INFRA-1 und INFRA-3 behoben, Park baut in ca. 50 min wieder auf, home bei 512):** Ersparnis 14,22 Mrd
minus Cloud-Ausgleich 3584 GB je Zyklus (0,53-0,69 Mrd, dreimal, weil der Park jeden Einbau verliert) minus
Wiederaufbaufenster (0,62-1,05 Mrd je Einbau, zweimal) = **+10,0 bis +11,4 Mrd**; am Tor 0,15-0,37 h je Knoten
wie BN2.1. Annahmen, die nicht gemessen sind: Wiederaufbauzeit 50 min (aus INFRA-1 uebernommen), Zahl der
Einbauten je Knoten (BN2.1 hatte 2; der offene Pruefauftrag Torfrequenz kann sie aendern - mehr Einbauten
machen home wertvoller), Kapazitaetsgrenze `kapFreiGb` 17,9-20,8 TB (gemessen) wird nicht ueberschritten.

Asymmetrie: **-45 bis -104 Mrd** (wenn gebaut ohne INFRA-1/3) gegen **+10 Mrd** (wenn danach). INFRA-4 ist
daher kein eigener Bauauftrag, sondern haengt hinter INFRA-1/3 und hinter der Torfrequenz.

## 5. Braucht der Bot home-RAM fuer Steuerskripte?

Gemessen (`verify-g05-dienste.mjs`): alle Dienste zusammen 348-365 GB (blade.js 100,3, bn4rep 68,5, sleeve 31,9,
bn4life 23,9, gang 21,9, contracts 17,6, homegrow 13,5, bbtrain 12,3, bn4net 10,8, bn4door 10,5, ausgang 8,2,
shop 7,0, ...). Mit home 4096 GB (BN2.1) liefen alle 17 auf home; mit home 512 GB (BN2.2 12:17) nur **122 GB**
auf home (sleeve, bn4life, bbtrain, bn4net, ausgang, shop, guard, hashes, figwatch, export, popups, wakelock), der
Rest auf `netlink`, `werk-0/1`, `silver-helix`, `sigma-cosmetics`, `joesguns`, `foodnstuff` (die Werkbank ist der
groesste gerootete Fremdrechner, `bn4net.js:1559-1566`, notfalls home `:1580-1594`). Das ist der Bedarf:
**512 GB reichen** (Pflichtteil auf home ca. 122 GB, alles zusammen 365 GB); `exit.js` (ausgang.js Stufe 2)
sucht nur irgendeinen Wirt mit genug Platz. Ueber 512 GB ist home reine Arbeiterkapazitaet und steht im
Wettbewerb mit der Cloud - der Steuerbedarf ist **kein** Argument fuer die Leiter, und der Befund (Cloud billiger,
aber Takt-begrenzt) bleibt das einzige.

## 6. Fehlermodi im unbeaufsichtigten Betrieb

Zu Fix A (Kerne aus, unten): wenig Risiko. (1) Aus dem Schalter wird bei kernbewusster Planung (spaeter) ein
vergessener Verzicht - der Break-even liegt im besten Fall bei ca. 10 TB home (y=395, f_gw 0,5), also weit ausserhalb
dessen, was V2-Knoten erreichen; Wiedereinschalten nur mit eigener Rechnung. (2) Entfernt man die Aufrufe statt
nur die Bedingung zu sperren, aendert sich der RAM von `homegrow.js` (13,5 GB); die Eichdateien muessten neu
gemessen werden (`VERALTET_ERLAUBT`). Deshalb nur die Konstante auf 0.

Zu Fix B (home-Regel, INFRA-4), falls er je gebaut wird: (1) ohne INFRA-1/3 Verlust (Szenario R). (2) BN-Flip:
Regel muss den Livevergleich nutzen, nicht den Faktor; in BN6/7/11 kippt er bei 2 TB je Cloud-Server. (3) Die
Zahl der Einbauten je Knoten (Torfrequenz-Auftrag) steuert den Wert von home direkt. (4) Nach Neustart/Offline:
`data/preise.json` kann alt sein (INFRA-1 schreibt sie am Rundenanfang); die Regel braeuchte einen Frischecheck.

Allgemein, **neu und schon heute wirksam:** `homegrow.js:78-79` prueft die Frische von `geldbedarf.txt` nicht
(`bn4net.js` prueft sie fuer `brachAnteil`, `homegrow.js:107-113`, aber nicht fuer die Ruecklage). Faellt `bn4rep.js`
aus (Neustart, Absturz) oder laeuft nach einer Offline-Pause erst nach dem Spiel an, steht dort der letzte Wert, im
Extremfall 0, waehrend das Konto (Offline-Nachholen) sprunghaft gewachsen ist. In dem Fenster koennte
`homegrow` den Kern kaufen und, bei Konto > 67,5 Mrd + Ruecklage, den **zweiten** (56,25 Mrd; um 06:17 am 04.10. stand
das Konto bei 63,2 Mrd, also 4 Mrd darunter). Fix A beseitigt den groessten Teil dieses Schwanzrisikos mit.

## 7. Bauvorgabe

**G05-A (S, empfohlen, aber niedrige Prioritaet P3):** in `src/homegrow.js` `KERN_PREIS_DECKEL = 3e13` (Z. 53)
auf `0` setzen und den Kommentar Z. 43-53 durch den Grund ersetzen ("Kerne aus: kein Skript plant mit Kernen,
`lib/calc.js:437, 442` cores = 1; Wiedereinschalten erst, wenn bn4net Kerne einplant und der Break-even
`homeRam x f_gw(gemessen) x (1 - b(k)/b(k+1)) x y x Resthorizont > 1,2 x Preis` erfuellt ist"). Die Aufrufe
`getUpgradeHomeCoresCost`/`upgradeHomeCores` bleiben stehen (kein RAM-Wechsel, keine Neueichung). Ein einmaliger
Logeintrag beim Start ("Kerne aus (Audit G05)") macht den Zustand sichtbar.
Skeptiker: Pflicht (laeuft ohne Aufsicht weiter); Commit mit `[skeptiker]`. Abnahme: im naechsten Knoten
`data/homegrow.txt` ohne Zeile "home-Kerne auf"; `moneySourceB.servers` am Tor = nur RAM-Leiter + Park.
Ertrag erst am Tor sichtbar (0,09-0,35 h).

**G05-B (INFRA-4): nicht bauen**, bis (1) INFRA-1 und INFRA-3 live sind, (2) der Park nach einem Einbau in unter
einer Stunde wieder auf Kapazitaet ist (messen), (3) das Ergebnis der Torfrequenz-Pruefung (Einbauten je Knoten)
vorliegt. Danach, falls der Gewinn von 10 Mrd/Knoten die Komplexitaet rechtfertigt: home-Verdopplung nur oberhalb
512 GB und nur wenn `(Preis_home/R) / (Restzyklen + 1) <= naechster Cloud-Schritt je GB` (live aus
`getCloudServerUpgradeCost`/`getUpgradeHomeRamCost`) und der Park nicht gedrosselt ist.

**G05-C (HACK-5):** kein eigener Bau; in INFRA-2 und INFRA-4 aufgegangen. Den Gewinn nicht zu den beiden addieren.

## 8. Wo mein Werkzeug den Fall nicht zeigen konnte

- **Live-Verhalten von BN2.2 nach 12:17:** keine Spielstaende danach, die Bruecke wurde nicht angefasst. Die
  Vorhersage "Kern 2 faellt bei freiem Geld > 9,0 Mrd" ist eine Folgerung aus Code und BN2.1-Reihe, nicht beobachtet.
- **Einnahmen in der Luecke 03.10. 09:59-17:16:** nur die Differenz, kein Stundenwert (Offline/Ausfall unbekannt).
- **y als Grenzertrag:** 395 $/GB*s ist eine Regression ueber 12 Punkte mit Level-Konfundierung (Obergrenze);
  208/242 sind Durchschnitte. Alle Spannen oben tragen beides.
- **Stundenwert des Geldes** (0,015-0,034 h je Mrd) ist aus `verify-p2b-geldwert.md` uebernommen, nicht von mir geeicht.
- **Wiederaufbauzeit 50 min des Parks nach INFRA-1-Fix** ist eine Annahme.
- BN9.3/BN10.2-Belege des Befunds (Kern 5 -> 6, 7,5 Mrd bei 9 wartenden Augs) liegen ausserhalb der Route; nicht geprueft.

## 9. Rechner (alle in `tools/audit/`)

| Datei | Zweck |
|---|---|
| `verify-g05-preise.mjs` | Preisformeln home-RAM/Kern/Cloud aus dem Quellcode, Eichung E1/E2, Preistabelle je BN der Route |
| `verify-g05-zeitreihe.mjs` | stuendliche Spielstaende eines Knotens: home, Park, Einnahmen, GB je Skriptart |
| `verify-g05-szenario.mjs` | Szenarien K (Kern), Sequenzkosten, R (RAM gesperrt, gedrosselt), F (nach INFRA-1/3) |
| `verify-g05-ruecklage.mjs` | Konto minus `geldbedarf.txt` gegen die Kauf-Schwellen von homegrow |
| `verify-g05-dienste.mjs` | Steuerdienste je Wirt mit RAM |
| `verify-g05-home.mjs`, `-files.mjs`, `-bn4net.mjs` | Hilfen: home-Prozesse, Textdateien, `data/bn4net.json` |
