# Gegenpruefung G06 - INFRA-3 / HACK-4 (Amortisationsdeckel 600 s und Zielwahl-Horizont in V2)

Winkel: Substanz und Betrieb. Stand 2026-10-04 13:30 (Systemzeit). Streng lesend:
`src/` unveraendert, Spiel nicht angefasst, nichts committet. Bot master `f1bee88`,
Spielquelle 3.0.2. Neu gegenueber den Befundberichten: die Staende BN2.1 Zyklus 2
und 3 (19:17 03.10. bis 10:38 04.10.), BN2.2 (11:17, 12:15, 12:17, 13:17) und der
Bot-Stand nach P0/P1/P2c/P2d.

Rechner (nur lesen, alle unter `tools/audit/`):

| Datei | Was |
|---|---|
| `verify-g06-series.mjs` | Zeitreihe je BN2-Stand: Park, home, Hack-Einnahme, wartend, kampfZuFrueh, Bot-Kurve |
| `verify-g06-reserve.mjs` | Konto gegen Aug-Ruecklage (`data/geldbedarf.txt`) je Stand |
| `verify-g06-scan.mjs` | alle 202 Staende: jede "Ausbau wartet"- und "bestellt ... amortisiert"-Zeile |
| `verify-g06-deckel.mjs` | Bot-Regel (kleinsten Rechner verdoppeln bis Deckel) je Stand, Deckel 600 gegen 1800 |
| `verify-g06-deckel3.mjs`, `verify-g06-bn.mjs` | dasselbe mit Preisen von BN6/7/13/14/15/3/11, Deckel bis 7200 |
| `verify-g06-model.mjs`, `verify-g06-park.mjs`, `verify-g06-hub.mjs` | Segmentmodell (calc.js) gegen 13 Staende geeicht; Wert von RAM und von the-hub |
| `verify-g06-prep.mjs`, `verify-g06-ziele.mjs`, `verify-g06-anlauf.mjs` | prepSec/Rang der drei Ziele, Zustand der Ziele, Anlauf-Abbrueche |
| `verify-g06-eich.mjs` | Eichungen E1-E3 |

## Urteil

**TEILWEISE - der Mechanismus stimmt, der behauptete Schaden gilt im laufenden
Betrieb nicht.** Zwei Befunde, EIN Hebel: INFRA-3 und HACK-4(a) nennen dieselben
+3,7 Mrd $/h (Park 25x512 gegen 25x256) und duerfen nicht addiert werden.

- **Haelt (Code):** `bn4net.js:1502-1515` setzt 600 s bei `wartend >= 2`; in V2 ist der
  Einbau mindestens 12 h gesperrt (`lib/endspurt.js:322-333`, Einbauabstand gemessen
  12,07 h). `ZIELWAHL` (`bn4net.js:1695`) ist fuer 20-97-min-Zyklen kalibriert.
- **Haelt nicht (INFRA-3 in BN2.2/BN2.3):** seit P1/P2c ist `wartend` im BN2-Kampfknoten
  0 (Stand 12:17 und 13:17 BN2.2; ganzer Zyklus 3 von BN2.1) - der Deckel steht dort
  schon auf 1800 s. Die Aenderung waere eine Nulloperation. Der Bericht entstand vor P1.
- **Haelt nicht (Wirkung ueberhaupt):** In 202 Staenden (alle Knoten seit Ende August)
  gibt es keinen einzigen Fall, in dem der Deckel einen Ausbau mit endlicher Amortisation
  bei freiem Geld abgelehnt haette. Hoechste je GEKAUFTE Amortisation 1418 s (03.10. 19:09, 10 min
  nach dem Einbau: wartend 0, Deckel 1800 aktiv). Der Park wuchs in jedem Zyklus im Takt von genau einem Schritt je 10 min
  (INFRA-1), nie bis zum Deckel.
- **Haelt unter Bedingungen (Zukunft):** In Kampfknoten OHNE Gang (BN6, BN7, BN13) bindet
  der Deckel bei den hoeheren Cloud-Preisen (CSS 1,6-2) schon bei 25x256/25x512 - gerechnet
  +1,4 bis +5,8 Mrd $/h real, aber erst NACH INFRA-1, nur wenn die Aug-Ruecklage Geld
  freilaesst, und mit BN2-Kurven (UNGEEICHT).
- **HACK-4(b) "drei Ziele dauerhaft Rang 0":** TEILWEISE. Nur the-hub (und in BN2.2
  johnson-ortho) kostet etwas; crush-fitness scheitert ohnehin am Nutzen-Gate. Nicht
  "dauerhaft": the-hub trat in Zyklus 2 nach 4,3 h, in Zyklus 3 sofort ein, weil mit dem
  Netz auch die Vorbereitungszeit sinkt. Wert +0,4 bis +1,1 Mrd $/h waehrend der Sperre,
  Sperre 0 bis 11,5 h je Zyklus.

## 0. Eichung (Soll aus dem Spiel/Spielstand, Ist eigene Rechnung)

| # | Groesse | Soll | Ist | |
|---|---|---|---|---|
| E1 | 20 Cloud-Preise BN2 (CSS 1,3), `data/preise.json` BN2.2 12:17 (vom Spiel ueber `ns.cloud.getServerCost`) | 3,52e6 ... 2,27e12 | `r*55000*1,3^max(0,log2 r-6)` | max. rel. Abweichung **0** |
| E2 | Stufenkosten im Bot-Log "fuer rund ..." | 5.6m / 14.6m / 38.1m | 5,632 / 14,64 / 38,07 Mio | OK |
| E2b | Park 25x128 auf 25x256 / 25x512 | 0,37 / 1,32 Mrd (Befundberichte) | 0,366 / 1,318 Mrd | OK |
| E3 | Ertrag, den der Bot im Log benutzt (`kosten/(zusatzGb*amort)`) gegen `mischung.grenz[0]` desselben Stands | 537 / 331 / 590 | 539 / 324 / 583 (Verhaeltnis 0,98-1,00) | Deckel rechnet mit grenz[0] am Rand der Kurve - **Ausnahme BN2.2 12:07: 242 gegen 402 (0,60)** |
| E4 | Reproduktion INFRA-3 (`infra-deckel.mjs`, Park 4x256+21x128, Kurve [338,295,193], kapFrei 17854) | +3968 GB / 4,22 und +16256 GB / 11,31 Mrd/h | identisch | OK - meine Band-Simulation ist dieselbe Rechnung |
| E5 | Segmentmodell x r gegen gemessene Hack-Einnahme, 13 Staende BN2.1 Zyklus 2 (19:17 bis 07:05) | gemessen 1,07 bis 4,09 M$/s | r = 0,75 / 0,63 / 0,57 / 0,60 / 0,61 / 0,69 / 0,76 / 0,78 / 0,77 / 0,79 / 0,79 / 0,80 / 0,79 | r **driftet** mit dem Zyklusalter (frueh 0,6, spaet 0,79); eine einzige Quote (0,653 in HACK) trifft nur einen Zeitpunkt |
| E6 | Zuwachs 01:17 -> 07:05 (6,3 -> 12,1 h): gemessen +1863k $/s | Modell x r(0,78) | +1764k $/s | -5 % (Level +31 steckt in beiden) |
| E7 | gemessenes Grenzmass, Zyklus 2 (Staende 01:17 und 06:17, Park +4864 GB, Level +27) | +1616k $/s = **332 $/GB*s** | Bot-Kurve grenz[0] 508-549 | real/Bot = 0,6-0,65 |
| E8 | prepSec-Regel gegen beobachteten Eintritt: the-hub Zyklus 2 | prepSec 1233 s (22:17) -> 1200 s (23:17), Log "vorbereitet" 23:44:34 | Rang 0 -> 226 genau am Schwellwert 1200 s | OK (Eintritt ~23:15) |
| E8b | johnson-ortho Zyklus 2 | prepSec 1174 s (20:17), Log "vorbereitet" 20:40:23 | Rang 113 | OK |

## 1. Der Mechanismus - bestaetigt, mit Einschraenkung

- `src/bn4net.js:1502-1515`: `wartend` aus `data/bn4rep.json` (frisch < 300 s, sonst 99), `amortDeckel = wartend >= 2 ? 600 : 1800`. Bedingung `:1518` `kosten > 0 && amortSek <= amortDeckel && kosten * 2 <= geldFrei`.
- `src/lib/endspurt.js:322-333`: `KAMPF_EINBAU_MIN_MS = 12 h`, `kampfEinbauSperre`: gesperrt, solange Wiederaufbau laeuft (`kampfAufbau`) oder seit seinem Ende weniger als max(12 h, 2 x Dauer) vergangen sind. Gemessen: Einbau 03.10. 19:01 und 04.10. 07:05 = 12,07 h Abstand.
- Die Annahme "wartend >= 2 heisst Einbau steht bevor" ist in V2 also falsch - **sofern** wartend >= 2 vorkommt. Das ist der Punkt.

## 2. Seit P1/P2c ist wartend im BN2-Kampfknoten 0 (neu, nach dem Bericht)

- `src/bn4rep.js:1617-1891` (Block 1c): Kampfknoten MIT Gang kauft aus keiner Faktion, bis das Tor offen ist; `:2276-2298` (P2c): vor der Gruendung kauft die alte Schleife ebenfalls nichts (`gangHoldBeforeFounding`, `lib/einbau.js:1065-1070`, nur `knoten === 2`, Frist 6 h).
- Beleg `data/bn4rep.json`/`data/einbau.json` im Stand BN2.2 12:17: `wartend 0, kampfZuFrueh true, gangHold true`; 13:17 (Gang seit 13:06): `wartend 0, gangHold false, torRunde locked`. Reihe `verify-g06-series.mjs`: **wartend = 0 in allen 6 Staenden von BN2.1 Zyklus 3 (07:17-10:38) und in allen 4 von BN2.2 (11:17, 12:15, 12:17, 13:17)**. In Zyklus 2 stand es 3,3 h auf 0 (Deckel 1800), dann 4-5.
- Folge: `amortDeckel` ist in BN2.2/BN2.3 praktisch immer 1800. Die vorgeschlagene Aenderung ("in Kampfknoten mit kampfZuFrueh 1800") aendert dort nichts.
- Wo `wartend >= 2` weiter gilt: Kampfknoten OHNE Gang (BN3, BN6, BN7, BN11, BN13, BN14, BN15; die Gang ist nur in BN2 ohne Karmaschwelle erreichbar, `gang.js` Kopf, `GANG_HOLD_NODE = 2`) - dort kauft die alte Schleife alles Verdiente sofort.

## 3. Der Deckel hat in keinem Zyklus gebunden - der Park hing an INFRA-1

**Beleg 1 (Scan, `verify-g06-scan.mjs`):** 202 Staende, 596 eindeutige gekaufte Ausbauten, 85 + 69 "Ausbau wartet"-Zeilen.
- Alle 85 Geld-Blockaden hatten `frei < 0` (Ruecklage groesser als Konto, z. B. BN9L3 "frei -2566126m", BN2.1 00:17 -66 Mrd): Geld bzw. Ruecklage, nicht der Deckel.
- Alle 69 Blockaden bei freiem Geld hatten **unendliche** Amortisation (Grenzertrag 0 durch fehlenden Abnehmer): BN1, BN5, BN12 (Hackingknoten, V1). **Null Faelle** mit endlicher Amortisation ueber dem Deckel.
- Hoechste Amortisation eines gekauften Ausbaus: 1418 s (BN2.1 03.10. 19:09, 10 min nach dem Einbau), 1342 s (04.10. 07:15), 1005-1042 s (BN2.1 05:08, BN2.2 10:54) - jeweils in den ersten Minuten eines Zyklus, wenn 32->64 / 64->128 noch wenig Ertrag haben. Immer war wartend < 2 (direkt nach dem Einbau ist es 0), der Deckel also 1800; ein Deckel 600 haette genau diese Anfangsschritte gesperrt - das tut er nur nicht, weil wartend dann 0 ist.

**Beleg 2 (Takt):** Park in Zyklus 2: 2048 / 2432 / 2752 / 3136 / 3584 / 3840 / 4608 / 5248 / 6016 / 7168 / 8704 / 9728 GB nach 1,3 / 2,3 / ... / 12,1 h - die Spruenge sind exakt 6 Schritte je Stunde (z. B. 7168 -> 8704 = 6 x 256). Das ist INFRA-1 (`shop.js:149-174` schreibt `preise.json` vor dem Auftrag, `:251-264` haelt die Doppelbestellung als "warte auf Geld" offen); der Bot-Log zeigt es unveraendert auch in BN2.2: `12:07:48 werk-7: 64 -> 128 bestellt` / `12:08:19` dieselbe Zeile / naechste echte erst 12:18, `shop-log 12:12:49 "Ausbau werk-7 auf 128 GB kostet -0.0m - warte auf Geld"`. Der Park erreichte nie die Stelle, an der ein Deckel beissen koennte.

**Beleg 3 (dritter Begrenzer, neu):** Seit P1 meldet `data/geldbedarf.txt` die Kosten der geplanten Torrunde (`bn4rep.js:2382-2385`, `waehleTorRunde(..., geldJetzt, ...)` `:1688`). Der Plan kauft, was das Konto hergibt - die Ruecklage folgt dem Konto:

| Stand BN2.1 Zyklus 3 | 08:17 | 09:17 | 10:12 | 10:17 | 10:38 |
|---|---|---|---|---|---|
| Konto Mrd | 6,08 | 16,29 | 23,60 | 24,45 | 28,25 |
| Ruecklage Mrd | 6,02 | 15,93 | 22,17 | 22,17 | 28,21 |
| frei (bn4net) | 0,06 | 0,36 | 1,43 | 2,28 | 0,04 |

bn4net verlangt `kosten * 2 <= geldFrei` (`:1518`): der Schritt 256->512 (38 Mio) braucht 76 Mio frei, 512->1024 (99 Mio) 198 Mio. In Zyklus 2 (Gang jung, wenige verdiente Stuecke) lag die Ruecklage dagegen bei 17-43 Mrd gegen 29-63 Mrd Konto (frei 6-20 Mrd). **Fuer BN2.2 gilt zunaechst Zyklus-2-Verhalten; ab dem ersten Einbau (Zyklus 3) kann die Ruecklage die teuren Parkstufen ausbremsen.** Das ist ein eigener Befund, der INFRA-3-Gewinne ueberlagert (offen, siehe 9).

## 4. Wo der Deckel binden WUERDE (Bot-Modell, Eichung E4)

Band-Simulation (`verify-g06-deckel.mjs`): Kurve des Stands = `mischung.grenz` (Mittel der naechsten 1024/4096/16384 GB), Position = bereits zugekaufte GB, Entscheidung mit der unskalierten Bot-Kurve, Park aus dem Stand. Auszug (Deckel 600 gegen 1800, zusaetzliche GB, Differenz in Bot-Einheiten / real mit q = 0,6):

| Stand | Kurve | 600 s | 1800 s | Diff Mrd $/h |
|---|---|---|---|---|
| BN2.1 Zyklus 1, 09:59 | [338,295,193] | +3968 | +16256 | 7,09 / 4,25 (= Bericht) |
| BN2.1 Zyklus 2, 22:17 | [470,363,208] | +4160 | +16192 | 6,77 / 4,06 |
| BN2.1 Zyklus 2, 07:05 | [554,480,295] | +4096 | +15872 | 9,89 / 5,94 |
| BN2.1 Zyklus 3, 10:38 | [590,476,233] | +4032 | +16064 | 6,65 / 3,99 |
| BN2.2, 12:17 | [402,231,101] | +1088 | +4160 | 1,90 / 1,14 |
| BN2.2, 13:17 | [434,245,111] | +1088 | +4160 | 1,99 / 1,19 |

Das Modell sagt also: **waere der Park nicht an INFRA-1 gehangen, haette Deckel 600 ihn bei rund "Ist + 4096 GB" gestoppt.** Der Befundbericht hat in dieser Modellwelt recht (Eichung reproduziert seine Zahlen exakt). Aber:

1. Die Differenz entsteht nur dort, wo `wartend >= 2` UND INFRA-1 behoben UND die Ruecklage frei ist - drei Bedingungen, keine davon in BN2.2/2.3 erfuellt (wartend 0; INFRA-1 offen; Ruecklage siehe 3).
2. "+3,7 geeicht" skaliert im Befundbericht Entscheidung UND Einkommen mit 0,615 (`infra-deckel.mjs`) - der Bot entscheidet aber unskaliert. 208 $/GB*s ist ein Mittel je Netz-GB, kein Grenzwert; gemessen ist 330 $/GB*s Grenz im reifen Zyklus (E7), das Verhaeltnis real/Bot schwankt 0,6-1,08 (c1: 1,08, c2 frueh 0,58, c2 spaet 0,78). Die Spanne 3,7-7,1 ist ein Band, kein geeichter Punkt.
3. Wert des Parks selbst (`verify-g06-park.mjs`, +6400 GB = 25x512 gegen 25x256, real): c1 09:59 **0,61** (Kapazitaet der laufenden Ziele erschoepft, 5355 GB unbelegt), c2 22:17 2,45, c2 03:17 5,45, c2 07:05 **5,94**, c3 10:38 2,48, BN2.2 13:17 2,30. HACK-4(a) "+3,7" liegt in der Mitte; frueh im Zyklus (<4 h) 0,6-2,5, spaet 5,5-5,9. Mehr RAM gilt nur, solange die Ziele ihn aufnehmen (`capSum`).

### Andere Knoten (`verify-g06-bn.mjs`, `verify-g06-deckel3.mjs`; BN2-Kurven, Faktor Hackertrag BN6 1,60 / BN7 1,51 / BN13 0,82, Startpark 25x128, real q = 0,6)

| BN | Deckel 600 | 1800 | 3600 | Diff 1800-600 (Mrd $/h) | Kosten 1800 |
|---|---|---|---|---|---|
| BN2 (CSS 1,3) | 25x256 | 25x512 | 25x512 | 4,3-6,1 | 2,6 Mrd |
| BN6 (CSS 2) | 25x128..256 | 25x256..512 | 25x512..1024 | 4,1 (c1) / 5,8 (c2-Ende) | 1,6-5,3 Mrd |
| BN7 (CSS 2) | 25x128..256 | 25x256 | 25x512 | 3,8 / 1,4 | 1,6-1,7 Mrd |
| BN13 (CSS 1,6) | 25x128..256 | 25x256..512 | 25x512..1024 | 2,2 / 3,0 | 0,9-2,6 Mrd |
| BN14, BN15 (CSS 1) | 25x512 | 25x512 | 25x512 | **0,0-0,1** | - |
| BN3, BN11 (Hackertrag 0,17/0,05) | 25x128 | 25x128 | 25x128 | **0** | - |

In BN2 bringt 3600 gegen 1800 nichts (Kapazitaet kapFrei ~16-21k GB begrenzt zuerst). In BN6/7/13 liegt der sinnvolle Deckel hoeher (3600-7200), weil CSS 2 die Stufen 3-5x teurer macht. GERECHNET_UNGEEICHT: die Kurven stammen aus BN2.

## 5. HACK-4(b): the-hub, johnson-ortho, crush-fitness

Code: `bn4net.js:1695` `ZIELWAHL = { horizonSec: 1800, prepMaxSec: 1200 }`, `lib/calc.js:561-568` `targetRank` (Rang 0 bei `prepSec > prepMaxSec` fuer neue Ziele). Reproduktion von `hack-prep.mjs` BN2.1 09:59: the-hub eff 427 / prep 1653, johnson 216 / 1440, crush 155 / 1204 - identisch.

**Nicht "drei Ziele":**
- crush-fitness (eff 126-226) liegt in JEDEM Stand unter dem Flottenmittel (Log "Anlauf fuer crush-fitness uebersprungen: 169 $/GB*s im Gleichgewicht, Flotte laeuft mit 339", `bn4net.js` Nutzen-Gate vor dem Anlauf): kein Verlust, auch mit grossem prepMax.
- johnson-ortho scheitert in Zyklus 1 und 3 ebenfalls am Gate (eff 216 < Flotte 227+), in Zyklus 2 kam es nach 1,3 h von selbst (prep 1174 s -> Log "vorbereitet" 20:40:23). In BN2.2 jetzt: eff 309 / prep 1386 / Gate ok - blockiert nur durch prepMax (+0,2 Mrd $/h).
- Bleibt the-hub.

**Nicht "dauerhaft", nicht "bis Level 530":** Die Rechnung "prepSec ~ 1/(Level+50)" haelt das Netz konstant. `prepRamGb = 0,3 x Netz` (`calc.js:473-497`, bn4net reicht 30 % des Netzes) waechst aber mit dem Park. Beobachtet:

| Zyklus | the-hub erstmals hackbar | Eintritt | Sperre durch prepMax (ohne Gate-Zeit) |
|---|---|---|---|
| 1 (BN2.1, req 304, Netz 8,9k) | L304 (~1,5 h) | **nie**: prep 1798 (07:33) ... 1653 (09:59) ... 1212 s (17:16), Einbau 19:01 | **~11,5 h** |
| 2 (req 321, Netz 9,2-10,3k) | L321 (~1 h) | 23:15 (prep 1200), "vorbereitet" 23:44:34 | ~2 h (21:17-23:15; davor Gate bei 20:17: eff 268 < 285) |
| 3 (req 287) | L287 | sofort, 08:17 schon Stapelziel | 0 h |
| BN2.2 (req 304, jetzt L324) | ~12:30 | offen: prep 1644 s bei Netz 5868 | laufend, voraussichtlich 2-3 h |

Die Server-Kennwerte (req, minDifficulty) werden bei jedem Einbau neu gewuerfelt - die Sperrdauer ist Zufall, nicht Struktur.

**Wert** (`verify-g06-hub.mjs`, Segmentmodell, Differenz mit/ohne Ziel bei gleichem Geldarbeiter-RAM, x r):

| Stand | the-hub (+ johnson) | Mrd $/h |
|---|---|---|
| c1 07:33 (Netz klein, bessere Ziele frei) | 0 | 0,00 |
| c1 08:33 | the-hub | 0,19 |
| c1 09:59 | the-hub | 0,39 |
| c1 17:16 | the-hub | 0,96 |
| c2 22:17 | the-hub | 1,13 |
| BN2.2 13:17 | the-hub + johnson | 0,73 |

Im Befund: +0,33-0,71 Mrd $/h - liegt im Band, ist aber ein Zeitverlauf (0 bis 1,1), kein fester Wert; the-hub bringt erst etwas, wenn der RAM die effizienteren Segmente uebersteigt. Je Zyklus: c1 ~0,5 Mrd/h x 11,5 h = **~6 Mrd**, c2 ~1,0 x 2 h = **~2 Mrd**, c3 0, BN2.2 ~0,7 x 2-3 h = **~1,5-2 Mrd** (Zyklus-Einnahme 20-96 Mrd).

**Nicht additiv zu (a):** Wachsender Park senkt `prepSec` von selbst (E8). Wer INFRA-1 repariert, verkuerzt die the-hub-Sperre.

**Anlauf-Risiko eines hoeheren prepMax:** Verhaeltnis reale Vorbereitung zu prepSec 1,2-1,4 (E8, E8b; Eintrittszeit nur stundengenau); die Frist ist `max(20 min, 1,5 x prepSec)` (`bn4net.js:3332`, Kommentar `:1682` ist veraltet: er nennt die feste Frist). Bei prep 1653 s bleiben 41 min Frist gegen ~38 min erwartet. Anlauf-Bilanz aus den Logs (`verify-g06-anlauf.mjs`): BN2.1 31 "vorbereitet" gegen 24 "abgebrochen" (BN4/BN5/BN1 sogar mehr Abbrueche als Erfolge), die meisten in den ersten 1-2 h nach einem Einbau, wenn das Netz klein ist und 30 % Gesamtanteil / 15 % je Ziel (`:3156-3157, 3241-3242`) die Vorbereitung strecken. Mehr Kandidaten durch hoeheres prepMax = mehr Abbrueche in genau dieser Phase.

## 6. Fehlermodi der vorgeschlagenen Loesung im unbeaufsichtigten Betrieb

Vorschlag des Berichts: Deckel aus `data/einbau.json` ableiten, 1800 bei `kampfZuFrueh || kampfAufbau || !wiederaufbauHilfe`.

1. **`!wiederaufbauHilfe` ist ein falscher Ausloeser.** Das Feld (`bn4rep.js:1501-1520`) heisst nur "die Warteschlange enthaelt kein Stueck, das den Wiederaufbau verkuerzt" und kippt auf `true`, sobald ein solches Stueck gekauft wird - in Minuten, nicht in Stunden. Mit `wartend >= 3` und `!hilfe` kann der Einbau unmittelbar bevorstehen. Nur `kampfAufbau` und `kampfZuFrueh` tragen eine Restsperre von Stunden.
2. **Restzeit fehlt.** `einbau.json` hat kein Feld fuer die Restsperre (`noetigMs - seitAufbauMs`, steht in `data/einbau-uhr.json` und in `kampfEinbauSperre`). Ein fester 1800 s Deckel ist in den letzten 30 min vor dem Tor falsch (Kauf mit 25 min Restlebensdauer). Klein (ein Schritt je 10 min, hoechstens 0,1-0,5 Mrd verloren), aber unnoetig.
3. **Uhr:** Die Sperre zaehlt in `totalPlaytime` und damit Offline-Zeit mit (`endspurt.js` Kommentar). Eine Nacht offline verbraucht die Restsperre, bringt dem Park aber nicht dieselben Einnahmen. Eine aus der Restsperre abgeleitete Deckelgroesse ueberschaetzt dann die Lebensdauer. Obergrenze setzen.
4. **Veraltete Datei:** `einbau.json` hat `zeit`; ohne Frischepruefung (< 5 min) entscheidet eine Leiche. Rueckfall muss die heutige Regel sein (wartend 99 -> 600), nicht 1800.
5. **Tor offen, Einbau nicht ausgefuehrt** (Bonuszeit-Warten bis 30 min, Handschlag, Endspurt-Sperre): `kampfZuFrueh` ist false, `wartend` evtl. 0 -> Deckel 1800 -> Kaeufe kurz vor dem Einbau. Betrag klein; Torzeit-Block `gateInstallWait` koennte als zweites Signal dienen.
6. **Sprung:** Der Park stirbt auch beim BN-Wechsel; weder Deckel noch Rueckfall kennen ihn.
7. **Ruecklage (Abschnitt 3)** macht die Aenderung in Gang-Knoten ab Zyklus 3 wirkungslos oder zufaellig (frei 0,04-2,3 Mrd).
8. **Zielwahl:** Ein 12-h-Horizont in `targetRank` aendert nur die Raenge UNVORBEREITETER Ziele (vorbereitete haben `prepSec = 0`); Flattern prepared-gegen-prepared ist ausgeschlossen. Dagegen verteilt `prepDiscount(prepWahl, horizonSec)` (`bn4net.js:2037-2055`) die Stapelplaetze - dort wuerde ein unvorbereitetes Ziel mit 0,96 statt 0,52 punkten und koennte ein vorbereitetes Stapelziel verdraengen (NICHT nachgespielt).

## 7. Was bleibt gueltig / was nicht

| Aussage | Urteil |
|---|---|
| Deckel 600 bei wartend >= 2 steht in `bn4net.js:1515`; Einbau in V2 >= 12 h gesperrt | BESTAETIGT |
| "In Kampfknoten stand der Deckel in BN2.1 durchgehend auf 600 s" | falsch zu Beginn (Zyklus 1: erste ~50 min wartend < 2), in Zyklus 2 erst nach ~3,3 h; in Zyklus 3 und BN2.2 nie |
| "+3,7 Mrd $/h (geeicht) bis +7,1 fuer 1,1-2,2 Mrd" | rechnerisch REPRODUZIERT (E4), aber nicht geeicht (Skala nur im Einkommen oder in beidem, q schwankt 0,58-1,08) und fuer BN2.2/2.3 nicht anwendbar |
| "Der Deckel kostet Ertrag" | NICHT BELEGT: kein einziger Fall in 202 Staenden |
| "wirkt erst mit INFRA-1" | BESTAETIGT (Beleg 2) - und damit ist INFRA-1 der Hebel, nicht der Deckel |
| "Park 25x512 statt 25x256 brachte +3,7 Mrd $/h" | RAM-Wert 0,6-5,9 je Zyklusalter; "brachte" falsch: der Park wurde nie so gebaut; Zuschreibung an den Deckel falsch |
| "drei Ziele dauerhaft Rang 0", "the-hub bis Level ~530" | WIDERLEGT (1 Ziel; Sperre 0-11,5 h; RAM-abhaengig) |
| "the-hub +0,33-0,71 Mrd $/h" | im Band (0,2-1,1), Zeitverlauf |

## 8. Bauvorgabe

**BN2.2 / BN2.3: nichts am Deckel bauen.** Hebel dort: INFRA-1 (Doppelbestellung, eigene Gruppe) und - nach INFRA-1, vor dem ersten Einbau von BN2.2 - die Ruecklage der Torrunde gegen den Cloud-Ausbau abwiegen (siehe 9).

**Vor BN6.2 (erster Knoten, in dem der Deckel binden kann), nur wenn INFRA-1 behoben ist und die Messung unten es verlangt:**

1. `bn4rep.js` schreibt in `data/einbau.json` zusaetzlich `sperreRestMs` (= `max(0, noetigMs - seitAufbauMs)` aus `kampfEinbauSperre`; bei `kampfAufbau` einen festen Wert 12 h; sonst 0) - nur diese eine Zahl.
2. Reine Funktion (z. B. `lib/endspurt.js`): `amortDeckelSek({ wartend, frischMs, kampfknoten, sperreRestMs })`:
   - `frischMs > 300000` oder Feld fehlt -> **600** (heutiger Rueckfall, wartend 99);
   - `kampfknoten && sperreRestMs > 0` -> `clamp(sperreRestMs / 1000 / 12, 600, 3600)` (12 h Restsperre -> 3600; letzte Stunde -> 600; weil real/Bot = 0,6 ist 3600 Bot-Sekunden rund 6000 reale = 7 x Rueckfluss in 12 h);
   - sonst wie heute (`wartend >= 2 ? 600 : 1800`).
   Aufruf `bn4net.js:1515`. NICHT `!wiederaufbauHilfe`. In BN2 aendert die Funktion nichts (wartend 0 -> 1800 greift weiter; 3600 brauchte es dort nicht, die Kapazitaet begrenzt zuerst, Abschnitt 4).
3. Test (reine Funktion): alt/neu, Datei alt, `zeit` in der Zukunft, `sperreRestMs` negativ/NaN/Infinity, Tor offen (0), `kampfknoten` false (V1 unveraendert 1800/600), BN2 mit wartend 0.
4. Messung statt Glauben: die Zeile `"Ausbau wartet ... (Deckel N), frei X"` (`bn4net.js:1535-1540`) existiert schon. `node tools/audit/verify-g06-scan.mjs` nach jedem V2-Knoten laufen lassen: bindet der Deckel tatsaechlich (endliche Amortisation > Deckel, frei >= 2 x Kosten), erst dann bauen.

**HACK-4(b), P3:** nicht jetzt. Falls spaeter: `prepMaxSec` 1200 -> 2400 nur bei `kampfZuFrueh`, Frist `bn4net.js:3332` auf `max(20 min, 2,0 x prepSec)`, Bedingung "hoechstens ein solcher Langanlauf gleichzeitig und erst ab 60 min Knotenalter" (Abbrueche bei kleinem Netz). Messung vorher/nachher: Zeilen "Anlauf nach N min ohne Erfolg abgebrochen" je Zyklus (heute Zyklus 1: 24 Abbrueche in 55 Anlaeufen); mehr als 3 in einer Stunde -> zurueck.

## 9. Offen / nicht gerechnet

- **Ruecklage gegen Cloud (neu):** nach dem ersten Einbau in BN2.x ist `geldbedarf.txt` ~ Konto (Tabelle in 3). Ob der Planer (`waehleTorRunde`) sein Budget am Konto von HEUTE ausrichten darf, obwohl das Tor erst in Stunden kommt, ist eine eigene Frage: Geld, das 12 h in der Ruecklage liegt, bringt 0; als Cloud ausgegeben bringt es bei 15-30 min Amortisation ein Vielfaches. Nicht in G06, aber der groessere Hebel als der Deckel. Pruefen vor BN2.3: Konto, Ruecklage und `frei` stuendlich aus `verify-g06-reserve.mjs`.
- Grenzertrag jenseits ~13k Park-GB bleibt Modell (Kapazitaet der Ziele; `kapFreiGb` 15-21k); gemessen sind nur Parks bis 9,7k GB.
- Alle BN6/7/13-Zahlen aus BN2-Kurven mit Hackertrag-Faktor (`hack-knoten.mjs`, offenes Modell) - UNGEEICHT.
- Nicht nachgespielt: Zielwahl mit 12-h-Horizont im echten Kern (`prepDiscount`-Wirkung auf die Stapelwahl).
