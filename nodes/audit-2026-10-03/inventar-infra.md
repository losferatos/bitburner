# Audit 03.10.2026 - Bereich INFRA (Cloud-Server, home RAM/Kerne, Programme/Darkweb/TOR)

Stand: Spielstand BN2.1 03.10.2026 09:59 (5,3 h im Knoten), Spielquelle 3.0.2
(`reference/bitburner-src/src/`), Bot `src/` auf master. Rechner unter
`tools/audit/infra-*.mjs`, alle Kostenformeln gegen Spielstandwerte geeicht
(Abweichung 0). Nichts am Bot oder am Spiel geaendert.

Kurzfassung:

- **INFRA-1 (FEHLER, P1):** Nach JEDEM Cloud-Ausbau blockiert eine
  Doppelbestellung die Ausbau-Pipeline fuer 600 s. In BN2.1 lagen zwischen
  zwei Ausbauten im Median 631 s (29 Ausbauten in 5 h statt in ~20 min).
  Geeichter Verlust in den ersten 5,3 h BN2.1: mindestens 3,8 Mrd $ (Band
  2,8-4,0), mit der vom Bot selbst freigegebenen Fortsetzung 12,7 Mrd $ =
  +2,4 Mrd $/h bei 4,6 Mrd $/h Ist-Mittel. Trifft jeden Knoten nach jedem
  Einbau.
- **INFRA-2 (SUBOPTIMAL, P1):** homegrow kauft home-Kerne, deren Bonus
  bn4net nie einplant (Faeden mit cores = 1). Kern 2 kostete in BN2.1 um
  08:36 7,50 Mrd $ = 31 % aller bisherigen Hacking-Einnahmen, Ertrag
  praktisch 0. Naechster Kern 56,3 Mrd $ sobald 67,5 Mrd auf dem Konto
  liegen.
- **INFRA-3 (SUBOPTIMAL, P1, bedingt auf INFRA-1):** Der 600-s-Amortisations-
  deckel gilt bei `wartend >= 2` - in Kampfknoten ist der Einbau dann aber
  gesperrt (`kampfZuFrueh: true` im Spielstand). Mit 1800 s: +3,7 Mrd $/h
  (geeicht) bis +7,1 Mrd $/h (Bot-Kurve) fuer 1,1-2,2 Mrd einmalig.
- **INFRA-4 (SUBOPTIMAL, P2):** home-RAM wird ohne Preis- und
  Amortisationsvergleich zur Cloud gekauft: 9-18x teurer je GB in BN2, in
  BN14/15 bei jeder Groesse. home 512->1024 (2,6 h Amortisation) wurde
  gekauft, der Cloud-Schritt 256->512 (12 min) waere am Deckel gescheitert.
- **INFRA-5 (RISIKO, P3, BN8):** homegrow und Cloud-Leiter haben keine
  BN8-Sperre und wuerden Boersenkapital in Kerne/RAM stecken (zu C6).
- **INFRA-6 (TOT, P3):** Altskripte mit eigener Kauflogik (homeram.js,
  bn4start.js, invest.js, wbgrow.js, kerne.js) liegen ungenutzt in `src/`.

---

## 1. Feature-Inventar aus dem Spielquellcode

Pfade relativ zu `reference/bitburner-src/src/`. Verfuegbarkeit: Singularity
braucht SF4 (vorhanden, 4.3 = RAM-Faktor 1); alle Route-Knoten erlauben
Cloud-Server (nur BN9 Limit 0, BN10 0,6 - beide erledigt).

| # | Feature | Wo im Quellcode | Wirkt in welchen BN | Ertrag/Hebel |
|---|---|---|---|---|
| 1 | `cloud.purchaseServer` | NetscriptFunctions/Cloud.ts:35-93; Preis Server/ServerPurchases.ts:22-41 | alle Route-BN, 25 Plaetze | Skript-RAM (1 Kern), Preis r*55000*CSC*CSS^max(0,log2 r-6) |
| 2 | `cloud.upgradeServer` | Cloud.ts:104-114; ServerPurchases.ts:43-62 | alle | Ausbau kostet exakt die Preisdifferenz - schrittweiser Ausbau ohne Aufschlag |
| 3 | `cloud.getServerCost` / `getServerUpgradeCost` | Cloud.ts:20-34, 94-103 (Fehler -> `-1`, kein Wurf) | alle | Preisauskunft |
| 4 | `cloud.getServerLimit` / `getRamLimit` | Cloud.ts:205-210; ServerPurchases.ts:92-101 | alle | 25*CSL, 2^20*CSMR (Route: 25 / 2^20) |
| 5 | `cloud.getServerNames` | Cloud.ts:195-204 | alle | Parkliste |
| 6 | `cloud.deleteServer` | Cloud.ts:127-194 | alle | Platz frei, keine Erstattung |
| 7 | `cloud.renameServer` | Cloud.ts:115-125; ServerPurchases.ts:64-90 | alle | kosmetisch |
| 8 | Park-Verlust bei Einbau und Sprung | PersonObjects/Player/PlayerObjectGeneralMethods.ts:109; Prestige.ts:74, 221 | alle | Park muss je Zyklus neu gekauft werden |
| 9 | Cloud-Server haben 1 Kern | Server/BaseServer.ts:50; Cloud.ts:75-83 (kein cpuCores) | alle | kein Kernbonus ausser auf home |
| 10 | home-RAM-Ausbau (Singularity) | Singularity.ts:599-627; Preis PlayerObjectServerMethods.ts:30-40 | alle; HCRC 1,5 in BN3 (BitNode.tsx:601) | R*32000*1,58^log2 R*HCRC; bis 2^30 |
| 11 | home-RAM-Ausbau (Oberflaeche) | Server/ServerPurchases.ts:164-182 | alle | dasselbe ohne SF4 |
| 12 | `getUpgradeHomeRamCost` | Singularity.ts:628-632 | alle | Preisauskunft |
| 13 | home-Kerne (Singularity) | Singularity.ts:568-593; Preis PlayerObjectServerMethods.ts:42-44 | alle, **ohne BN-Faktor** | 1e9*7,5^k, max 8 |
| 14 | `getUpgradeHomeCoresCost` | Singularity.ts:594-598 | alle | Preisauskunft |
| 15 | Kernbonus | Server/ServerHelpers.ts:315-323; formulas/grow.ts:25-28; NetworkShare/Share.ts:22-25; NetscriptFunctions.ts:288, 359, 388; Stanek.ts:47 | alle | 1+(k-1)/16 auf grow, weaken, share, Stanek - nur fuer Skripte AUF dem Wirt |
| 16 | home ueberlebt Einbau, Reset beim Sprung | ServerHelpers.ts:226-236 (nur Programme); Prestige.ts:241-249 | alle | Sprung: 128 GB (SF9>=2), 1 Kern |
| 17 | Int-Erfahrung aus Kaeufen | Singularity.ts:413, 450, 586, 616 | alle | +3 je home-Ausbau, sonst Bruchteile - vernachlaessigbar |
| 18 | `purchaseTor` | Singularity.ts:397-415; Constants.ts:44 (200k) | alle | Darkweb-Zugang |
| 19 | Portknacker kaufen (`purchaseProgram`) | Singularity.ts:416-459; DarkWeb/DarkWebItems.ts:6-10 | alle | 0,5/1,5/5/30/250 Mio = 287 Mio, oeffnet Ports |
| 20 | Nicht-Port-Programme | DarkWebItems.ts:11-14; Programs/Programs.ts | alle | ServerProfiler, DeepscanV1/V2, AutoLink: nur Terminal-Komfort |
| 21 | DarkscapeNavigator -> DarkNet | DarkWebItems.ts:15-19 (50 Mio); Singularity.ts:453-455; DarkNet/effects/labyrinth.ts:403-430 | alle; frei mit SF15/BN15 (Prestige.ts:100-102) | eigenes System (Caches, Labyrinth-Augs, Red Pill aus dem Labyrinth ausser BN8/BN12) |
| 22 | Formulas.exe | DarkWebItems.ts:20 (5 Mrd); Prestige.ts:92-94, 236-238 | mit SF5 nach jedem Einbau/Sprung gratis | ns.formulas |
| 23 | `getDarkwebPrograms` / `getDarkwebProgramCost` | Singularity.ts:1064-1102 | alle | Preisauskunft |
| 24 | `createProgram` | Programs/Programs.ts:48-245 (Stufe 50-1000, 10 min-8 h) | alle | Programme schreiben statt kaufen, bindet die Figur |
| 25 | Augs mit Programmen | Augmentation/Augmentations.ts:325 (CashRoot), 1215 (Neurolink), 1420 (PCMatrix) | alle | Programme nach Einbau ohne Kauf |
| 26 | Programme/TOR weg bei jedem Einbau | Server/ServerHelpers.ts:229-230; PlayerObjectServerMethods.ts:14-16 | alle | Neukauf je Zyklus (287,2 Mio) |
| 27 | BN-Faktoren Infrastruktur | BitNode/BitNode.tsx:577 (BN2 CSS 1,3), 601-604 (BN3 HCRC 1,5, CSC 2, CSS 1,3), 696/730 (BN6/7 CSS 2), 766 (BN8 CSS 4), 892 (BN11 CSS 2), 1000 (BN13 CSS 1,6); BN14/15 ohne | Route | siehe Tabelle 3 |
| 28 | BN8: Geld bei jedem Einbau auf 250 Mio | Prestige.ts:38, 158-160, 293-295 | BN8 | home-Ausbau ist dort die einzige Geld-Bruecke ueber den Einbau |
| 29 | `restrictHomePCUpgrade` | BitNode/BitNodeUtils.ts:34; Singularity.ts:573, 605 | nur Challenge-Option | - |
| 30 | Hacknet-Server als Skriptwirt, SF9.3-Startserver mit 10 Kernen | Hacknet/HacknetServer.ts:100; Prestige.ts:330-334 | mit SF9 | RAM fuer Skripte (Bereich Hacknet) |
| 31 | Obergrenzen | Server/data/Constants.ts:6, 12-13; Singularity.ts:573 | alle | home 2^30 GB, Kerne 8, Park 25 x 2^20 |

## 2. Abdeckungsmatrix

| # | Feature | Bot Datei:Zeile | BN/Phasen aktiv | Kategorie | Urteil |
|---|---|---|---|---|---|
| 1 | Cloud-Kauf | bn4net.js:1280-1340 (Leiter, Kaltstart 32 GB x1,0, sonst x4), Ausfuehrung shop.js:190-241 | alle BN, Kaltstart + nach jedem Einbau | OPTIMAL | BN2.1: erster Rechner +30 s, 25 Plaetze nach 16 min. Doppelte Kaufauftraege kaufen nur einen weiteren Platz (harmlos) |
| 2 | Cloud-Ausbau | bn4net.js:1446-1540, shop.js:242-267 | alle BN, Aufbau | GENUTZT-SUBOPTIMAL | **INFRA-1** (10-min-Sperre), **INFRA-3** (Deckel in Kampfknoten). Kleinster-zuerst ist richtig (Preis je GB steigt mit r bei CSS >= 1) |
| 3 | Preisauskunft | shop.js:149-174 -> data/preise.json | alle | OPTIMAL | live gefragt, deckt alle BN-Faktoren ab (Eichung 1: 19 Groessen exakt) |
| 4 | Limits | shop.js:150-151, bn4net.js:3840-3870 | alle | OPTIMAL | BN9-Fall (Limit 0) abgefangen |
| 5 | Parkliste | shop.js:149, 163 | alle | OPTIMAL (mit Falle) | die Liste wird VOR der Ausfuehrung geschrieben -> Ursache von INFRA-1 |
| 6 | deleteServer | - | - | NICHT ANWENDBAR | Ausbau = Preisdifferenz, Loeschen bringt nichts |
| 7 | renameServer | - | - | NICHT ANWENDBAR | kosmetisch |
| 8 | Park-Verlust | bn4net.js:175-215 (parkLage: harter Schnitt am Reset) | alle | OPTIMAL | |
| 9 | 1 Kern auf Cloud | bn4net.js:2395-2409 | alle | NICHT ANWENDBAR | Tatsache, richtig beruecksichtigt |
| 10 | home-RAM | homegrow.js:116-124 | alle BN, Werkbank | GENUTZT-SUBOPTIMAL | **INFRA-4** |
| 11 | home-RAM per Oberflaeche | homeram.js (1178 Z.), nicht in registry.json | nie | GENUTZT-TOT | **INFRA-6** |
| 12 | getUpgradeHomeRamCost | homegrow.js:116 | alle | OPTIMAL | live, BN3-Faktor 1,5 automatisch |
| 13 | home-Kerne | homegrow.js:88-98 (Deckel 3e13, Puffer 1,2) | alle BN | GENUTZT-SUBOPTIMAL | **INFRA-2** |
| 14 | getUpgradeHomeCoresCost | homegrow.js:90 | alle | OPTIMAL | |
| 15 | Kernbonus | bn4net.js:2395-2409 (plant cores = 1), lib/calc.js:123, 209, 296 (koennte Kerne) | - | GENUTZT-SUBOPTIMAL | bekannt 2-hacking-engine.md#5; hier nur als Ursache von INFRA-2 |
| 16 | home-Reset beim Sprung | bn4net.js:1325-1340 (Kaltstart-Leiter), homegrow.js | Sprung | OPTIMAL | BN2.1: home 128 -> 256 nach 61 min, 1024 nach 2 h |
| 17 | Int-Exp | - | - | NICHT ANWENDBAR | 3 exp je Kauf bei ~840 exp bis Int 154 |
| 18 | TOR | bn4life.js:314-316; darkweb.js (DOM, nur ohne bn4life, bn4net.js:3755-3780) | alle, sofort nach Reset | OPTIMAL | BN2.1: TOR nach 20 s |
| 19 | Portknacker | bn4life.js:97, 337-357 (aufsteigend, Ruecklage, Deckung 1,05) | alle, nach jedem Einbau | OPTIMAL | BN2.1: Brute/FTP +40 s, relay +80 s, HTTP +19 min, SQL < 1,9 h |
| 20 | Nicht-Port-Programme | - | - | NICHT ANWENDBAR | ns.scan/getServer liefern alles |
| 21 | DarkscapeNavigator/DarkNet | - (grep `dnet`/`darknet` in src: 0) | - | NICHT GENUTZT | Bewertung gehoert zum DarkNet-Bereich, siehe Offene Fragen |
| 22 | Formulas.exe | lib/calc.js (0 GB Nachbau); calccheck.js nur Pruefwerkzeug | alle (SF5) | OPTIMAL | gratis vorhanden, ns.formulas waere nur RAM-Kosten |
| 23 | getDarkwebProgramCost | bn4life.js:352 | alle | OPTIMAL | |
| 24 | createProgram | - | - | NICHT ANWENDBAR | Kauf kostet 287 Mio, Schreiben bindet die Figur bis 8 h |
| 25 | Augs mit Programmen | - | - | NICHT ANWENDBAR | kommt automatisch |
| 26 | Programme/TOR nach Einbau | bn4life.js:316-357 | alle | OPTIMAL | 287,8 Mio je Zyklus (moneySourceB "other") |
| 27 | BN-Faktoren | shop.js (Preise live), homegrow.js (Preis live) | Route | OPTIMAL | keine fest verdrahteten Faktoren |
| 28 | BN8-Geldreset | - (homegrow/shop ohne BN8-Bezug) | BN8 | NICHT ANWENDBAR bis BN8 | **INFRA-5** |
| 29 | restrictHomePCUpgrade | - | - | NICHT ANWENDBAR | Challenge |
| 30 | Hacknet als Wirt | bn4net hostRule "not-hacknet" | SF9 | NICHT GENUTZT | Bereich Hacknet; 2 GB RAM, praktisch ohne Wert |
| 31 | Obergrenzen | homegrow.js:89 (Kerne < 8), bn4net.js:1456 (2^20) | alle | OPTIMAL | |

Zaehlung: OPTIMAL 14, GENUTZT-SUBOPTIMAL 4, GENUTZT-TOT 1, NICHT GENUTZT 2,
NICHT ANWENDBAR 10 (31 Features).

### Tabelle 3: Preis je GB auf der Restroute (`infra-costs.mjs`)

home: Preis der naechsten Verdopplung je neuem GB ab Groesse R. Cloud: Preis
des Schritts r -> 2r je neuem GB.

| BN | home @128 / 1 TB / 8 TB / 64 TB / 512 TB | Cloud @64 / 256 / 1k / 8k / 64k / 512k |
|---|---|---|
| 2 | 7,9e5 / 3,1e6 / 1,2e7 / 4,8e7 / 1,9e8 | 8,8e4 / 1,5e5 / 2,5e5 / 5,5e5 / 1,2e6 / 2,7e6 |
| 3 | 1,2e6 / 4,7e6 / 1,8e7 / 7,2e7 / 2,9e8 | 1,8e5 / 3,0e5 / 5,0e5 / 1,1e6 / 2,4e6 / 5,3e6 |
| 6, 7, 11 | 7,9e5 / 3,1e6 / 1,2e7 / 4,8e7 / 1,9e8 | 1,7e5 / 6,6e5 / 2,6e6 / 2,1e7 / 1,7e8 / 1,4e9 |
| 13 | wie BN2 | 1,2e5 / 3,1e5 / 7,9e5 / 3,3e6 / 1,3e7 / 5,5e7 |
| 14, 15 | wie BN2 | 5,5e4 auf jeder Stufe |
| 8 | wie BN2 | 3,9e5 / 6,2e6 / 9,9e7 / 6,3e9 / 4,0e11 / 2,6e13 |

In BN2, BN3, BN14, BN15 ist der GANZE Cloud-Park je GB billiger als home ab
1-2 TB (BN14/15: ab 128 GB). Kerne haben keinen BN-Faktor: 7,5e9 / 5,6e10 /
4,2e11 / 3,2e12 / 2,4e13 fuer Kern 2-6.

---

## 3. Befunde

### INFRA-1 (FEHLER, P1) - Nach jedem Cloud-Ausbau 10 Minuten Stillstand der Ausbau-Pipeline

- **Bot:** `src/shop.js:149-174` schreibt `data/preise.json` samt Park am
  RUNDENANFANG, also bevor der Auftrag in `:176-267` ausgefuehrt wird.
  `src/bn4net.js:254-272` (`auftragOffen`) gibt den Weg frei, sobald das
  Ergebnis da ist; `:1274-1280` liest im selben Zug den alten Park und
  `:1452-1455` waehlt denselben, gerade ausgebauten Rechner erneut als
  kleinsten. `shop.js:251` bekommt fuer diese Doppelbestellung
  `getServerUpgradeCost = -1`, `:253` scheitert an `kosten > 0`, `:259-264`
  haelt den Auftrag als "warte auf Geld" offen - fuer immer. bn4net wartet
  daraufhin die vollen 600 s (`:261`, `:270`), bevor es neu bestellt.
- **Spiel:** `NetscriptFunctions/Cloud.ts:94-103` faengt den Fehler
  "must be bigger than its current ram" (`Server/ServerPurchases.ts:50-51`)
  und gibt `-1` zurueck.
- **Beleg (Spielstand-Logs BN2.1, `tools/audit/infra-files.mjs`):** Jede
  Ausbauzeile kommt doppelt, die zweite im selben Atemzug wie "erledigt",
  die naechste echte genau 10 min spaeter:
  `09:47:07 werk-2: 128 -> 256 bestellt` / `09:47:27 erledigt (werk-2)` /
  `09:47:27 werk-2: 128 -> 256 bestellt` / `09:57:29 werk-3: ...`.
  shop-log: `07:30:06 Ausbau werk-13 auf 128 GB kostet -0.0m - warte auf Geld`.
  Dasselbe Muster in BN12.3 (`00:16:08` / `00:28:09`, "amortisiert in 2 s").
- **Folge:** 29 Ausbauten in 5 h, Abstand min 621 s, Median 631 s
  (`infra-throttle.mjs`). Jeder dieser Schritte amortisierte sich laut Bot
  in 268-1042 s; Geld lag reichlich da (2,4 Mrd um 06:33 bei 5,6 Mio je
  Schritt). Der Park stand um 09:59 bei 3.712 GB; `kapFreiGb` der Geldziele
  lag ganztaegig bei ~17.000 GB, `brachAnteil` 0 - RAM war der Engpass.
- **Rechnung (geeicht):** Gegenlauf mit denselben 29 Ausbauten im 40-s-Takt
  (eine Kern- plus eine shop-Runde) und Geldregel `kosten*2 <= Geld` auf der
  echten Geldkurve: letzter Ausbau 05:25 statt 09:58, 1,83e7 GB*s Vorsprung.
  Ertrag 208 $/GB*s (gemessen, siehe Rechnungen) -> **3,81 Mrd $** (Band
  2,75-4,03). Mit der Fortsetzung, die die Bot-Regel selbst freigibt
  (21 x 128->256; Schwelle 191 $/GB*s beim 600-s-Deckel): +8,93 Mrd $.
  Summe **12,7 Mrd $ in 5,3 h = +2,4 Mrd $/h** gegen 24,5 Mrd $ Ist
  (4,6 Mrd $/h). Nach jedem Einbau wiederholt sich der Rueckstand; in BN14/15
  (CSS 1) braeuchte ein voller Park 350 Ausbauten = 61 h statt 3,9 h.
- **Fix (S):** in `shop.js` einen Ausbau, dessen Ziel schon
  `getServerMaxRam(ziel) >= gb` hat, als erledigt melden (Ergebnis "schon")
  und nach jeder Ausfuehrung `preise.json` mit dem neuen Park neu schreiben;
  zusaetzlich in bn4net nach einem erfolgreichen Ergebnis `parkRam` lokal
  nachfuehren. Laeuft unbeaufsichtigt -> Skeptiker.

### INFRA-2 (SUBOPTIMAL, P1) - home-Kerne werden gekauft, ihr Bonus wird nie eingeplant

- **Bot:** `src/homegrow.js:43-53, 88-98` kauft Kerne zuerst, bis 3e13, sobald
  Geld > 1,2 x Preis - mit der Begruendung, der Bonus "wirke praktisch auf das
  ganze Netz". `src/bn4net.js:2395-2409` plant grow/weaken aber mit
  `cores = 1`: "Der Kernbonus kommt als ungeplanter Ueberschuss an". Ein
  Ueberschuss an grow fuellt ein ohnehin volles Guthaben, ein Ueberschuss an
  weaken drueckt unter das Minimum - beides wirkungslos.
- **Spiel:** `Server/ServerHelpers.ts:315-323`, `formulas/grow.ts:25-28`
  (Bonus nur fuer Skripte auf dem Wirt); Preis
  `PlayerObjectServerMethods.ts:42-44` ohne BN-Faktor.
- **Beleg:** `data/homegrow.txt` im Spielstand: `08:36:52 home-Kerne auf 2`.
  moneySourceB.servers springt 08:33 -> 09:19 von 1,625 auf 9,147 Mrd
  (Eichung 2: 7,5e9 exakt). Gleiches Muster BN9.3 (7,5 Mrd bei 14,3 Mrd
  Aug-Ausgaben bis dahin, 9 Augs wartend), BN10.2 (Kern 6 fuer 2,37e13 -
  mehr als alle Aug-Ausgaben des Knotens, 2,28e13).
- **Rechnung (`infra-kerne.mjs`):** Ertrag heute: Geld 0; share auf home
  hoechstens Ruf x1,0019; Int +3 exp. Selbst EINGEPLANT spart Kern 2 bei
  1 TB home nur ~54 GB -> 185 h Amortisation bei 208 $/GB*s; lohnend (10 h)
  erst ab 18,9 TB home (Kern 3: 150 TB, Kern 4: 1,2 PB). 
- **Ertrag gegen beste Alternative:** 7,50 Mrd $ in BN2.1 = 1,17 h
  Hacking-Einnahmen zur letzten Rate; das Geld ist in BN2 bindend
  (Blade's Simulacrum verdient, aber 1,95e12 wegen 1,9^4, siehe Offene
  Fragen). Naechster Kern 56,3 Mrd = 8,8 h Einnahmen. Je Kampfknoten bis
  2,77e13 fuer Kern 2-6.
- **Fix (S):** Kerne nur kaufen, wenn bn4net die home-Kerne in die
  Faedenplanung einrechnet UND `homeRam * 0,9 * (1 - b(k)/b(k+1)) * Ertrag
  * Resthorizont > Preis`; bis dahin Kerne ganz aus. Alternativ (M) bn4net
  plant grow/weaken auf home mit `coreBonus(home.cpuCores)` (lib/calc.js
  kann es bereits) - lohnt erst ab ~19 TB home.

### INFRA-3 (SUBOPTIMAL, P1, wirkt erst mit INFRA-1) - Amortisationsdeckel 600 s, obwohl der Einbau gesperrt ist

- **Bot:** `src/bn4net.js:1499-1515` setzt den Deckel auf 600 s, sobald
  `wartend >= 2` (aus `data/bn4rep.json`) - Annahme "Einbau steht bevor".
  In Kampfknoten sperrt `bn4rep.js:1240-1259, 1357-1375` den Einbau aber
  ueber `kampfAufbau`/`kampfZuFrueh`/`wiederaufbauHilfe`.
- **Beleg:** `data/einbau.json` im Spielstand 09:59: `wartend 4,
  kampfknoten true, kampfZuFrueh true` - seit Knotenstart (5,3 h) kein
  Einbau; der Deckel stand trotzdem durchgehend auf 600 s.
- **Rechnung (`infra-deckel.mjs`, Bot-Grenzertragskurve aus
  `data/bn4net.json` mischung.grenz = [338, 295, 193] $/GB*s, kapFreiGb
  17.854):** Deckel 600 s erlaubt +3.968 GB, 1800 s +16.256 GB. Differenz
  **+7,1 Mrd $/h fuer 2,15 Mrd einmalig**; auf den gemessenen
  Durchschnittsertrag 208 $/GB*s heruntergeskaliert **+3,7 Mrd $/h fuer
  1,14 Mrd**, Amortisation 18-19 min. Ist-Einnahmen: 6,4 Mrd $/h.
- **Unsicherheit:** Der Grenzertrag jenseits von 9 TB ist Modell, nicht
  gemessen (needs_calc). Gemessen ist nur, dass der Durchschnitt zwischen
  3,5 und 8,9 TB flach blieb (201-222 $/GB*s).
- **Fix (S):** Deckel aus `data/einbau.json` ableiten: in Kampfknoten mit
  `kampfZuFrueh || kampfAufbau || !wiederaufbauHilfe` 1800 s (oder
  erwartete Zeit bis zum Einbau), sonst wie bisher.

### INFRA-4 (SUBOPTIMAL, P2) - home-RAM ohne Preis- und Amortisationsvergleich zur Cloud

- **Bot:** `src/homegrow.js:116-124`: Kauf bei `geld > 3 x Preis` und
  `brachAnteil < 0,34`. Keine Amortisation, kein Blick auf `preise.json`.
  Der Cloud-Ausbau dagegen verlangt Ueberschuss <= 5 % (`bn4net.js:1493`)
  und Amortisation <= 600/1800 s.
- **Beleg:** BN2.1 05:43-06:43 home 128 -> 1024 fuer 1,42 Mrd (896 GB,
  7,9e5-2,0e6 $/GB), waehrend Cloud-Schritte 64->128 bei 8,8e4 $/GB standen
  (Faktor 9-22). Der home-Schritt 512->1024 amortisiert bei 208 $/GB*s in
  2,6 h; der Cloud-Schritt 256->512 (1,49e5 $/GB) in 12 min - und wuerde am
  600-s-Deckel abgelehnt. In BN14/15 ist Cloud auf JEDER Groesse 14x
  billiger als home ab 128 GB.
- **Abwaegung:** home ueberlebt den Einbau, Cloud nicht; home traegt die
  Steuerung und den Wiederanlauf. In Kampfknoten sind Einbauten aber
  stundenlang gesperrt (INFRA-3), die Lebensdauer der Cloud ist dort lang.
- **Ertrag:** GESCHAETZT - in BN2 haette dasselbe Geld 8-10x mehr Cloud-RAM
  gekauft; die Wirkung ueberschneidet sich mit INFRA-1/3 und ist erst nach
  deren Fix eigenstaendig.
- **Fix (M):** home-Verdopplung nur, wenn ihr Preis je GB, geteilt durch die
  erwartete Zahl verbleibender Einbauzyklen + 1, unter dem naechsten
  Cloud-Schritt liegt, oder der Park am Deckel steht; dazu dieselbe
  Amortisationsrechnung wie in bn4net (Ertrag aus `mischung.grenz`).

### INFRA-5 (RISIKO, P3, BN8) - homegrow und Cloud-Leiter ohne BN8-Sperre

- **Bot:** `homegrow.js` und `shop.js` kennen BN8 nicht (grep `=== 8`/`bn8`:
  0 Treffer); bn4net liest `ScriptHackMoneyGain` nicht (bekannt C6,
  1-bitnode-regeln.md#2).
- **Spiel:** `BitNode.tsx:764-773` (CSS 4, ScriptHackMoneyGain 0);
  `Prestige.ts:158-160` setzt das Geld in BN8 bei JEDEM Einbau auf 250 Mio.
- **Neuer Blick:** Kerne (1,2 x Preis) und home-RAM (3 x Preis) wuerden mitten
  im Zyklus aus dem Boersenkapital gekauft, obwohl Hacking dort 0 $ bringt;
  richtig waere dort umgekehrt "Restgeld unmittelbar VOR dem Einbau in home
  stecken" (bekannt E7), weil es sonst auf 250 Mio faellt.
- **Ertrag:** GESCHAETZT, haengt an boerse.js; erst vor BN8 rechnen.

### INFRA-6 (TOT, P3) - Altskripte mit eigener Kauflogik

`src/homeram.js` (DOM-Kauf, 1178 Z.), `src/bn4start.js` (BN4-Start mit
eigenem home-Kauf bei 2 x Preis), `src/invest.js` (kauft "bot-N"-Server),
`src/wbgrow.js` (Einmalreparatur), `src/kerne.js` (Diagnose) stehen nicht in
`src/registry.json` und werden von keinem Live-Skript gestartet. Einziger
Pfad: keepalive.js -> autopilot.js:796 -> invest.js (bekannt E6). Kein
Ertrag, nur Aufraeumen; die Kommentare dort widersprechen der heutigen
Logik (z. B. bn4start Faktor 2).

---

## 4. Rechnungen und Eichung

Alle Rechner lesen die Spielstaende in `backups/` (gzip -> JSON, home-
Textdateien enthalten die Bot-Logs).

| Rechner | Inhalt | Eichung Soll / Ist |
|---|---|---|
| `tools/audit/infra-save.mjs` | Infrastruktur-Kennwerte aus einem Spielstand | - (Dekoder) |
| `tools/audit/infra-files.mjs` | home-Textdateien (Logs, Telemetrie) aus einem Spielstand | - |
| `tools/audit/infra-timeline.mjs` | Zeitreihe je Lauf | - |
| `tools/audit/infra-costs.mjs` | Cloud-, home-RAM-, Kernpreise je BN | (1) 19 Cloud-Preise aus `data/preise.json` (vom Spiel) vs Formel: max. rel. Abweichung **0**. (2) BN2.1 moneySourceB.servers **9,2116e9** vs home 128->1024 1,4242e9 + Kern 7,5e9 + Park 4x256+21x128 2,8737e8 = **9,2116e9** (rel. 0). (3) BN9.3 08:45 (HCRC 5) **9,5942e9** vs home 128->512 2,0942e9 + Kern 7,5e9 = **9,5942e9** (rel. 0) |
| `tools/audit/infra-throttle.mjs` | INFRA-1 | Park-Rekonstruktion aus den Logs gegen purchasedRamTotal: 5 von 8 Spielstaenden exakt (1792, 2496, 2880, 3136, 3328), 3 um 64-128 GB zu niedrig (Logzeilen beim Neustart 09:46:55 und im Ringpuffer verloren). Ertrag je GB*s aus moneySourceB.hacking / Netz-RAM: 201, 201, 212, 219, 222, 212, 190 -> 208 |
| `tools/audit/infra-deckel.mjs` | INFRA-3 | Kurve des Bots (ungeeicht) und auf 208 $/GB*s skaliert |
| `tools/audit/infra-kerne.mjs` | INFRA-2 | Preise ueber infra-costs geeicht; Nutzen aus Code (0) bzw. Modell |

Rechenfallen geprueft: Upgrade = Preisdifferenz (kein Doppelzaehlen);
Kernpreis ohne BN-Faktor (anders als RAM); Geld der Gegenlaeufe auf der
echten Geldkurve (keine Ausgabe vor dem Zufluss); Uhr: Log-Zeiten und
Spielstand-Dateinamen sind lokale Wanduhr, beide gleich; Rate gegen Bestand:
Ertrag aus Zuwachs der Einnahmen zwischen Spielstaenden, nicht aus dem
Kontostand.

## 5. Geprueft, in Ordnung

- Preise werden ueberall live gefragt (shop.js, homegrow.js) - BN3
  (HCRC 1,5, CSC 2), BN6/7/11 (CSS 2), BN13 (1,6) sind ohne Codeaenderung
  korrekt.
- Kleinster Rechner zuerst (bn4net.js:1452-1455) ist bei CSS >= 1 immer der
  billigste GB-Schritt; in BN14/15 gleichgueltig.
- Kaltstart nach dem Sprung (BN2.1): TOR +20 s, Brute/FTP +40 s, relay +80 s,
  HTTP +19 min, SQL < 1,9 h; erster Rechner +30 s, 25 Plaetze nach 16 min;
  home 256 GB nach 61 min.
- Programme nach jedem Einbau: 287,8 Mio "other" je Zyklus - vernachlaessigbar.
- Formulas.exe: mit SF5 gratis; der Bot braucht es nicht (lib/calc.js).
- Nicht-Port-Programme, createProgram, deleteServer: kein Ertrag fuer einen
  API-Bot.

## 6. Offene Fragen und Hinweise an andere Bereiche

1. **DarkNet (nicht INFRA):** DarkscapeNavigator kostet 50 Mio
   (`DarkWebItems.ts:15-19`); das Labyrinth gibt sechs eigene Augs und in
   allen Knoten ausser BN8/BN12 die Red Pill (`labyrinth.ts:403-430`;
   BN15: schon im vierten Labyrinth, `:420-421`). Der Bot nutzt das DarkNet
   gar nicht. Wer prueft das?
2. **Progression (A8):** Blade's Simulacrum ist in BN2.1 verdient
   (Rep 1.250), kostet aber 1,95e12 statt 1,5e11, weil vorher vier billigere
   Augs gekauft wurden (1,9^4). Damit ist Geld in BN2 bindend - die
   INFRA-Gewinne in $/h werden dort zu Fortschritt.
3. **Bladeburner/Sleeves:** moneySourceB.hospitalization = -4,50 Mrd $ in
   5,3 h BN2.1 (18 % der Hacking-Einnahmen).
4. Echter Grenzertrag jenseits 9 TB (fuer INFRA-3) erst nach dem Fix von
   INFRA-1 messbar.
