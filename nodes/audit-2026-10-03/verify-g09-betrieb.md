# Gegenpruefung G09 (Sleeves: Infiltrate/Diplomacy in V2) - Winkel BETRIEB

Pruefer: Gegenpruefer BETRIEB, Systemzeit 2026-10-04 13:36. Streng lesend: `src/` unveraendert, Spiel nicht
angefasst, nichts committet. Stand der Daten: Spielstaende bis `BN2L2_2026-10-04T13-17_hourly` (BN2.2, Knoten 2,65 h).
Befunde: SLEEVE-1, SLEEVE-2, BLADE-3, SLEEVE-3 (`inventar-sleeve.md`, `inventar-blade.md`).

## Urteil in sechs Zeilen

- **Gruppe: TEILWEISE.** Was der Bot tut, beschreiben die Berichte richtig (Datei:Zeile stimmt, ich habe jede Stelle gelesen). Der
  Ertrag ist kleiner und anders verteilt als behauptet, und die vorgeschlagene Loesung bricht an vier Stellen im Dauerbetrieb.
- **SLEEVE-2 / BLADE-3 (Kampfwert-40-Tor vor Infiltrate): TEILWEISE.** Hungerfenster in BN2.1 war 1,5-1,7 h (nicht 2,2 h), ein Infiltrate-
  Sleeve genuegt (+115-123 Rang/h; 2 Sleeves bringen NICHTS dazu), und das Fenster gibt es nur in 18-55 % der BN2-Knoten. **BN2.2 hat
  keines** (live, geeicht). Erwartung je Knoten 20-125 Rang statt 300-400.
- **SLEEVE-1 (D5 vor laufendem Vertrag): WIDERLEGT als Fehler, Fix-Richtung falsch.** Im echten Op-Betrieb (BN2.1 19:17-07:05) gab es keinen
  Mangel; die Behauptung "alle drei auf Vertraegen" trat nicht ein. Die Fix-Richtung widerspricht dem eigenen LP (1 Infiltrate + 2 Vertraege
  schlaegt 3 Infiltrate). Der echte Hebel ist das Gegenteil: D5 schickt ALLE freien Sleeves auf Infiltrate (zu viele) und laesst sie dort kleben.
- **SLEEVE-3 (Diplomacy per Sleeve): im Kern BESTAETIGT, groesster Hebel der Gruppe.** Im echten Verlauf (BN2.1, Knoten 14,0-18,2 h) hat der
  Spieler 22 % seiner Zeit auf Diplomacy verbracht (bis 42 % in den Raid-Zyklen). Aber: gilt nur im Chaos-Regime (nicht dauerhaft), und der
  Bau hat eine Falle (Diplomacy wird von `laeuftSchon` nicht erkannt).
- **Neu gefunden:** (a) die Schwelle 400 in D5 ist auf Assassination geeicht und feuert fuer Raid IMMER - der Bot setzt BN2.2 ab Kampfwert 40
  (~14:45) auf 3x Infiltrate (pruefbare Vorhersage unten); (b) der ns-Mock bildet Infiltrate falsch ab, ein Klebrigkeits-Test ist heute nicht
  schreibbar; (c) Infiltrate klebt ohne Freigabe (8 h 3x Infiltrate bei Vorrat 340-1000).
- **Bauvorgabe unten (Abschnitt 5)**: eine Regel, ein Paket: Rollen-Quote (Diplomacy <= 2, Infiltrate <= 1) mit Hysterese, Freigabe, Mock-Fix,
  Referenz-Entscheider mit 20 gruenen Szenarien (`tools/audit/verify-g09-betrieb-entscheider.mjs`).

## 0. Rechner und Eichung (alle unter `tools/audit/`, nur lesend)

| Datei | Zweck | Eichung Soll / Ist |
|---|---|---|
| `verify-g09-betrieb-zeitreihe.mjs` | Sleeve-Belegung, Kampfwerte, Vorraete, Chaos aus allen BN2-Staenden | Tabelle Abschnitt 2 |
| `verify-g09-betrieb-vorrat.mjs` | Raid-Vorrat: Anfang + g*dt - Versuche + Infiltrate (Versuche = Zaehler im Spielstand, exakt) | 8 Intervalle, siehe unten |
| `verify-g09-betrieb-hunger.mjs` | Monte Carlo: Hungerstunden je Knotenklasse (Anfangsvorrat gleichverteilt 1..150) | BN2.1 Modell 1,68 h gegen gemessen 1,5-1,7 h |
| `verify-g09-betrieb-lp.mjs` | LP des Audits nachgebaut, neue Konfigurationen "k Infiltrate, Rest im Gym" | Spieler allein 137/143/167 (Audit 124/134/166, Ist Hunger 129) |
| `verify-g09-betrieb-signal.mjs` | Zeitanteile (Operation, Diplomacy, Kammer) je Fenster aus `data/aktionen.txt` | direkt Messung |
| `verify-g09-betrieb-entscheider.mjs` | `aktuell()` = sleeve.js:726-852 nachgebaut, `vorschlag()` = Bauvorgabe, 13 Szenarien, Flatterprobe | `aktuell()` trifft 2 von 2 echten Belegungen |
| `verify-g09-betrieb-mock.mjs` | Beleg der Mock-Luecke (Infiltrate wird in jeder Runde neu gesetzt) | 4 Setzungen je Sleeve statt 1 |
| `verify-g09-betrieb-stadt.mjs` | Stadt und Chaos aller sechs Staedte je Stundenstand | Ishima 48,7 -> Volhaven 0,2 zwischen 22:17 und 23:17 |
| `verify-g09-betrieb-abschnitte.mjs`, `-aktionen.mjs`, `-raw.mjs` | Hilfen: rohe Abschnitte, Stundenraster, currentWork | - |

**Eichung Raid-Vorrat** (Modell: g = 2,1/480 je Spielsekunde = 15,75/h, Versuche exakt aus den Raid-Zaehlern, Infiltrate N^-0,5/2 je 61 s):

| Intervall | Versuche | Anfang | Soll | Ist | Abw. |
|---|---|---|---|---|---|
| BN2.1 05:33 -> 06:33 | 37 | 39,3 | 18,0 | 17,8 | -0,2 |
| 06:33 -> 07:33 | 33 | 17,8 | 0,6 | 0,7 | +0,2 |
| 07:33 -> 08:33 | 16 | 0,7 | 0,5 | 0,7 | +0,2 |
| 09:19 -> 09:33 | 9 | 2,1 | 3,4 | 3,7 | +0,3 |
| 09:33 -> 09:46 | 10 | 3,7 | 5,4 | 4,0 | -1,4 |
| 09:46 -> 09:59 | 8 | 4,0 | 8,3 | 9,6 | +1,3 |
| BN2.2 11:17 -> 12:17 | 9 | 124,5 | 131,2 | 131,3 | +0,1 |
| BN2.2 12:17 -> 13:17 | 40 | 131,3 | 107,0 | 107,1 | +0,1 |

Ausnahme 08:33 -> 09:19 (Soll 13,0, Ist 2,1): der Infiltrate-Start liegt innerhalb des Intervalls und ist unbekannt; ohne Infiltrate waere der
Vorrat negativ geworden (16 Versuche gegen 12,8 Zufluss), Infiltrate muss also >= 5,3 Einheiten geliefert haben - mit dem Spielstand vereinbar.
Verbrauch gemessen 37/h (BN2.1) und 40/h (BN2.2); Netto-Abfluss 21,5/h und 24,2/h.

**Eichung `aktuell()`** (reine Nachbildung der Entscheidung in sleeve.js, Eingabe = Spielstand vor dem Einbau, Sleeves als RECOVERY):
- 04.10. 07:05 -> 07:17: Soll Tracking / Retirement / Bounty Hunter (Spielstand), Ist `aktuell()` identisch (Vorraete 820/753/629 nach Vorrat sortiert, Raid-Vorrat 1039 > 400).
- 03.10. 19:01 -> 19:17: Soll 3x Infiltrate (Spielstand), Ist `aktuell()` identisch (Raid-Vorrat 244 < 400, istAktion Operations/Raid, D5).

## 1. Verhaelt sich der Bot so? (Datei:Zeile, Live-Belege)

| Behauptung | Befund | Beleg |
|---|---|---|
| D5 greift nur bei freien Sleeves | BESTAETIGT | `src/sleeve.js:726-733` (Vertrag => `laeuftSchon`), `:749-751` (Infiltrate => `laeuftSchon`), `:768` (`!laeuftSchon && ... >= 40`) |
| D5 steht hinter Kampfwert 40 | BESTAETIGT | `src/sleeve.js:626, 768`; BN2.1 05:33-08:33 und BN2.2 11:17-13:17 alle Sleeves im Gym |
| Signal `istAktion` flackert / ist im Mangel aus | **WIDERLEGT als Hindernis** | Anteil Operation im Hungerfenster (Knoten 3,5-4,85 h) **54 %**, nicht 25 %: D5 fuer einen freien Sleeve feuert nach ~2 Takten (`verify-g09-betrieb-signal.mjs`). Zwei Momentaufnahmen mit Contracts/Retirement (07:33, 08:33) waren Zufall |
| Sleeves trainieren 4-8 h bei 2-7 % Tempo | BESTAETIGT | Schock 98,4 -> 92,9, Kampf 3 -> 38 in 3 h (BN2.1); BN2.2 2 -> 24 in 2 h; Gym-Dauer bis 40: 3,9 / 5,6 / 8,4 h (LevelMult 1 / 0,7 / 0,5) rechnerisch bestaetigt (Exp fuer Stufe 40: 1273 je Stat bei Mult 1) |
| Vertrag klebt (09:33 Bounty Hunter + Tracking bei Raid-Vorrat 3,7) | BESTAETIGT als Zustand, **aber optimal** | 09:33 war I1 + V2 = die LP-optimale Belegung (397 gegen 328 fuer 3x Infiltrate, Abschnitt 3). Sleeve 0 blieb Bounty Hunter von ~08:40 bis zum Nachholschub 18:39-18:45 (Bounty-Hunter-Vorrat 76,8 -> 6,4, Rang 2191 -> 2652), erst dort fiel er auf Infiltrate |
| Diplomacy per Sleeve ungenutzt | BESTAETIGT | `grep -i diplomacy src/sleeve.js` = 0 Treffer |

**Neue Befunde zum Ist-Verhalten (nicht in den Berichten):**

1. **D5-Schwelle 400 feuert fuer Raid immer.** `OP_VERBRAUCH_STUENDLICH = 200` und `OP_RUNWAY_STUNDEN = 2` (`sleeve.js:710-711`) sind auf
   Assassination geeicht (gemessen ~105-120/h). Raid verbraucht 37-40/h, sein Anfangsvorrat ist <= 150 (`LevelableAction.ts:24, 68`). Also ist
   `rest < 400` in der Raid-Phase **in jedem Knoten und zu jedem Zeitpunkt wahr**. Folge im Live-Betrieb: Sobald die BN2.2-Sleeves Kampfwert 40
   erreichen (Kampf 24 bei 2,65 h, +13/h -> 3,9-4,1 h, also ~14:35-14:50) und die Abtastung Raid trifft, gehen **alle drei auf Infiltrate** (`aktuell()`
   Szenario S3). Das Tor, das heute das Gym schuetzt, ist die einzige Sperre; nimmt man es ohne Aenderung der Schwelle weg, verlassen die Sleeves
   das Gym schon bei Raid-Start (BN2.2: 1,5 h, Kampf ~10), obwohl es dort nie einen Mangel gibt.
2. **Infiltrate ist klebrig und hat keine Freigabe.** `t.type === "INFILTRATE"` => `laeuftSchon` (`:749-751`), keine Abbruchbedingung. Live:
   BN2.1 03.10. 19:17 bis 04.10. 03:17 (8 Stundenstaende) 3x Infiltrate bei Raid-Vorrat 339-768 und Assassination-Vorrat 494-925 - also waehrend
   reichlich Vorrat (reine Verschwendung, 3 Sleeves ohne Rang) und waehrend Chaos 47-49 (siehe Befund SLEEVE-3).
3. **Der ns-Mock bildet Infiltrate falsch ab** (`tools/mock/ns.js:731-760`): `{type:"BLADEBURNER", actionType:"Infiltrate Synthoids"}` statt
   `{type:"INFILTRATE"}` (Spiel: `Work.ts:49`, `SleeveInfiltrateWork.ts:APICopy`). `verify-g09-betrieb-mock.mjs`: 4 Runden => **4 Setzungen je Sleeve statt 1**.
   Der Schutz `sleeve.js:749-751` (Fehler vom 30.08., "eine Sekunde daneben") ist im Testlauf unsichtbar. Ohne Mock-Fix ist kein Test fuer
   Klebrigkeit, Freigabe oder Diplomacy-Neusetzen schreibbar.
4. **`grund: "arm"` ist Fehlanzeige** (SLEEVE-5 bestaetigt): in den Staenden 09:17-10:38 stehen alle drei Sleeves auf `arm` bei 16-28 Mrd $.
5. **Sleeve 0 war in BN2.1 am Ende idle**: Stand 10:12-10:38 `currentWork = null`, `storedCycles` 15.136, `sleeve.json` meldet `contract:Retirement`
   (`gesetzt: true`). Vertragsvorrat 2,4 / 3,9 / 2,0: ein Setzen bei Vorrat >= 2 endet nach einem Abschluss (`SleeveBladeburnerWork.ts:44-47`),
   der Sleeve steht den Rest des Taktes. Klein (30 Rang/h von 25.000), aber derselbe Fehlerfall wie 30.08. 10:00 (Schwelle 2 ueberlebt nur EINEN Abschluss).

## 2. Ist der Fall im Alltag erreichbar?

**Sleeves und Vorraete im echten Verlauf (BN2.1 / BN2.2, Stundenstaende):**

| Knoten-h | Lokalzeit | Raid | Chaos | Kampf | Sleeves (alt) |
|---|---|---|---|---|---|
| 0,85 | 05:33 | 39 | 1 | 3 | Gym x3 |
| 2,85 | 07:33 | 0,7 | 6 | 26 | Gym x3 |
| 3,85 | 08:33 | 0,7 | 11 | 38 | Gym x3 |
| 4,62 | 09:19 | 2 | 23 | 40 | BH / Infiltrate / Tracking (= I1V2) |
| 5,3 | 09:59 | 10 | 49 | 40 | BH / Infiltrate / Infiltrate |
| 14,6 | 19:17 | 339 | 49 | 40 | Infiltrate x3 |
| 17,6 | 22:17 | 616 | 49 | 40 | Infiltrate x3 |
| 21,6 | 02:17 | 768 | 0 | 40 | Infiltrate x3 |
| 26,6 | 07:17 (04.10.) | 959 | 23 | 42 | Tracking / Retirement / BH (nach Einbau 07:05, Vorrat 959 > 400) |
| BN2.2 2,65 | 13:17 | 107 | 0 | 24 | Gym x3 |

**SLEEVE-2 / BLADE-3 (Hungerfenster).** Hunger = Raid-Vorrat < 1 BEVOR der erste Sleeve Kampfwert 40 hat. Modell (geeicht oben): Vorrat(t) = S0 + 15,75 t - Versuche,
S0 gleichverteilt 1..150, Verbrauch 37-40/h, Gym-Ende 4,1 h (BN2.1 gemessen: 38 bei 3,85 h, 40/41/40 bei 4,6 h; BN2.2 extrapoliert: 24 bei 2,65 h, +13/h => ~3,9 h):

| Knotenklasse | Gym-Ende | Raid-Start 0,3 h | Raid-Start 1,5 h |
|---|---|---|---|
| BN2/3/11/6/7 (Mult 1) | 4,1 h | P(Hunger) 47-55 %, E 0,9-1,1 h | 18-23 %, E 0,16-0,22 h |
| BN13/15 (0,7) | 5,8 h | 72-82 %, E 2,0-2,3 h | 42-50 %, E 0,74-0,91 h |
| BN14 (0,5) | 8,7 h | 100 %, E 4,7-5,2 h | 83-97 %, E 2,7-3,2 h |

- BN2.1: Modell 1,68 h gegen gemessen (Vorrat 0,7 ab ~2,5-2,7 h, Gym-Ende ~4,1 h) 1,4-1,6 h. Der Audit rechnete 2,2 h (ab 06:50, da stand der Vorrat noch bei 17,8 und der
  Spieler war nicht gedrosselt).
- **BN2.2 (live): Vorrat 107 bei 2,65 h, Abfluss 24,2/h => leer erst bei ~7,1 h, Gym-Ende ~4,0 h => Hunger 0 h.** Das ist keine Ausnahme, sondern die Haelfte der
  Faelle (S0 war ~114 von maximal 150).
- Messbeleg fuer den Hunger-Ertrag: Knoten 3,5-4,85 h, Spieler allein: Rang 1267,7 -> 1440 = **129 Rang/h** (Soll LP 137-143; die Aktionslog-Summe 319 Rang in 90 min = 213/h
  enthaelt Raid-Glueck); mit Vorrat davor (2,0-3,5 h) 619/h.

**SLEEVE-3 (Chaos-Regime).** Erreicht und teuer: `verify-g09-betrieb-signal.mjs`, Knoten 14,0-18,2 h (265 protokollierte Minuten): **Spieler-Diplomacy 22 %**
(58 min), Rang 5.812; im Teilfenster 17,3-18,1 h wechseln Raid (2,6-5,1 min) und Diplomacy (5-7 min) fast 1:1 (Chaos 50,1-51,0 vor jedem Lauf). Danach (18,2 h: Stadtwechsel Ishima
(Chaos 48,7) -> Volhaven (Chaos 0,2) zwischen den Staenden 22:17 und 23:17, `blade.js:2819`, `verify-g09-betrieb-stadt.mjs`) 0 % Diplomacy und 3.027 Rang in 49 min.
Das Regime endet also durch den Stadtwechsel des Spielers, nicht durch Aufraeumen - Diplomacy-Sleeves machen den Wechsel nicht ueberfluessig, nur billiger. Ausserhalb dieses Fensters 0 % (Hunger-Fenster, Op-Phase 19,2-26 h). Ganzer Knoten: Diplomacy 5 %.
Einschraenkung: Chaos waechst multiplikativ (`City.ts:31-33`), aus 0 bleibt es 0. BN2.2 steht bei Chaos 0 (13:17) ohne Saat (Incite oder Retirement-Erfolge) -
das Regime kommt dort spaeter oder gar nicht. Das ist der Grund, warum die Rolle nicht dauerhaft belegt werden darf.

**SLEEVE-1 (Op-Phase).** Nicht eingetreten. BN2.1 Op-Phase (19,2-26 h): Assassination-Vorrat 494 -> 1039, Raid 339 -> 959; nach dem Einbau 07:05 gingen die Sleeves
korrekt auf Vertraege (`aktuell()` Soll/Ist identisch), Assassination-Vorrat am Ende 794 bei einem gemessenen Verbrauch von ~105-120/h (nicht 160-200/h). Das Werkzeug
(Stundenstaende der Zaehler) haette einen Mangel gezeigt (Schwelle < 50), tat es nie; Einschraenkung: die Abtastung ist stuendlich, ein Mangel von < 1 h waere unsichtbar -
darum zusaetzlich das Aktionslog: kein Fallback auf Notaktionen in 19,2-26 h.

## 3. Was bricht die vorgeschlagene Loesung im unbeaufsichtigten Betrieb

Vorgeschlagen war: "Infiltrate (und Diplomacy) ab Beitritt ohne Kampfwert-Schwelle, Ausloeser an Vorrat der besten Operation, Infiltrate vor `laeuftSchon`".

| # | Bruch | Schwere | Beleg / Rechnung |
|---|---|---|---|
| R1 | **Klebrigkeit ohne Freigabe.** Tor weg + `INFILTRATE => laeuftSchon` = Sleeve bleibt bis zum naechsten Einbau/Sprung Infiltrate; Kampf bleibt ~10; Vertragsfaehigkeit weg | hoch | BN2.1 8 h 3x Infiltrate bei Vorrat 340-1000 (live); `aktuell()` S10 klebt |
| R2 | **Schwelle 400 ist Assassination-geeicht.** Ohne neue Schwelle verlassen die Sleeves in JEDEM Knoten das Gym bei Raid-Start, auch ohne Mangel (BN2.2: Vorrat 107-131) | hoch | S1 (Gym bleibt) ist heute gruen, mit naivem Fix rot; Schwelle fuer Raid: 1,5 h x 45/h = 67, Freigabe bei 3x = 202 |
| R3 | **Diplomacy wird nicht als "laeuft schon" erkannt.** `laeuftSchon` kennt nur Vertrag und Infiltrate (`:726-753`); Diplomacy dauert genau 60 s = 300 Zyklen, Abschluss bei `>=` (`SleeveBladeburnerWork.ts:49`), TAKT = 60.000 ms: Rennen um eine Sekunde, derselbe Fehler wie 30.08. (Infiltrate, 301 Zyklen) | hoch | `GeneralActions.ts:37-39` (60 s); `Sleeve.ts:526-528` (Neusetzen nullt `cyclesWorked`); Abhilfe wie `istRekrutierung` (`sleeve.js:124`) |
| R4 | **Mock-Luecke** (Abschnitt 1, Nr. 3): kein Test kann R1/R3 rot zeigen | hoch | `verify-g09-betrieb-mock.mjs` |
| R5 | **Mehr Infiltrate ohne Diplomacy ist schaedlich** im Chaos-Regime (LP 176 fuer 3x Infiltrate gegen 270 fuer 3 Vertraege, Audit Rechnung 11); live: BN2.1 14-18 h 3x Infiltrate + 22 % Spieler-Diplomacy | mittel | SLEEVE-1/2 und SLEEVE-3 sind EIN Paket; Infiltrate-Quote ohne Diplomacy-Rolle nicht freigeben |
| R6 | **Zu viele Infiltrate.** LP (`verify-g09-betrieb-lp.mjs`): 1 / 2 / 3 Infiltrate = 252 / 252 / 252 (07:33), 266 / 266 / 266 (08:33), 328 / 328 / 328 (09:19) - der Zufluss 45,3/h uebersteigt das Raid-Maximum 41-46/h schon bei einem Sleeve | mittel | der zweite und dritte Infiltrate-Sleeve verlieren Gym/Vertrag fuer nichts |
| R7 | **Rekrutierer-Vorrang** (`waehleRekrutierer`, Truppanfrage) muss vor den neuen Rollen entscheiden; sonst nehmen Rollen den Rekrutierer weg und `blade.json.truppZeit` laeuft ab (5 min) | mittel | S11 |
| R8 | **RAM:** keine neue ns-Funktion noetig (`setToBladeburnerAction`, `getActionCountRemaining`, `getTask`, `getSleeve` sind geladen). `getCityChaos`/`getCurrentAction` waeren +4 GB und kippen `ramBaseGb` 31,85 (`registry.json:453`). Chaos kommt aus `blade.json.chaos` (`blade.js:1789`, je Schleife frisch: `nextUpdate()`) | niedrig, aber hart | `tools/test-ram.js` muss gruen bleiben |
| R9 | **Offline-Nachholen / gedrosselter Tab.** Sleeves mit `storedCycles` arbeiten Diplomacy/Infiltrate mit 15x nach (`Sleeve.ts:263-275`): Chaos faellt in Spruengen, Vorrat springt hoch - harmlos, solange die Hysterese-Baender breit genug sind (32/16 und 67/202). Rueckfall bei veralteter `blade.json` (> 10 min Wanduhr, `sleeve.js:665` Muster): keine Chaosrolle, altes Verhalten | niedrig | S13 |
| R10 | **Einbau:** Spiel setzt die Sleeves auf Recovery (`PlayerObjectGeneralMethods.ts:118-120`); die Entscheidung kommt zustandslos aus Vorrat/Chaos/Aufgabe der Sleeves, kein Zustand geht verloren. **Sprung:** Skripte sterben, Modulgedaechtnis (Operation der letzten 10 min) ist leer; `blade.json.nodeReset` pruefen | niedrig | Entscheider ist zustandslos |
| R11 | **Figur-Vergabe (`lib/figur.js`)**: `sleeve.js` hat `needsFigure: "none"` (`registry.json:466`), `figur.js` kennt keinen Sleeve. Nicht betroffen | - | `grep -i sleeve src/lib/figur.js` = 0 |
| R12 | **blade.js-Wechselwirkungen:** Incite Violence (`blade.js:3797-3803`) feuert nur bei Chaos < 8 und leeren Vertraegen; Diplomacy-Sleeves halten Chaos 16-45, Incite wird dann nicht mehr ausgeloest - gewollt, Nachschub kommt aus Infiltrate. Stadtwechsel-Wert `pop / sqrt(1+chaos-50)` (`:2800-2830`) unveraendert. S2-Stillstandsruhe bei `aufraeumen` (`lib/leiter.js:547`) unveraendert | niedrig | kein Eingriff in blade.js |
| R13 | **ENTSCHIEDEN-Liste:** kein Eintrag beruehrt (Sleeve-Sync, Gym/Bladeburner parallel, Beitritt bei 100, Einbau vor Beitritt gelten fuer Spieler/Sync). Nach dem Bau neue Zeilen mit Messbeleg: "max. 1 Infiltrate", "Diplomacy-Baender 32/16" | - | - |
| R14 | **Telemetrie:** `grund:"arm"` (SLEEVE-5) liest `tools/checkin.js:166`; sobald Sleeves nicht mehr im Gym stehen, wird "arm" auf Infiltrate/Diplomacy noch irrefuehrender. Im selben Paket auf `""` setzen, neue Felder additiv (`rollen`) | niedrig | - |

## 4. Korrigierte Ertraege

Umrechnung Rang -> Knotenzeit: **GESCHAETZT** (Zeit, um die ein Rangvorsprung die Bahn nach vorn schiebt; Bahn nicht autonom in R: Hunger-Rate 129-213/h gegen 619/h mit Vorrat).
Ansatz: Nettogewinn an Spielerzeit, nicht Rang / Rate. Rate-gegen-Bestand beachtet (Vorrat ist Bestand, Verbrauch 37-40/h Rate).

| Befund | Behauptet | Korrigiert | Basis |
|---|---|---|---|
| SLEEVE-1 | +0,6-1,8 h je Einbau (Op-Phase) | **~0**. Op-Phase live ohne Mangel. Der echte Hebel (1 statt 3 Infiltrate) +15-35 Rang/h in der Raid-Phase ohne Chaos (LP-Differenz 58-69, davon ~halb abziehen: Vertragsvorrat traegt nur ~37 Rang/h gemeinsam, nicht 2 x 34) = <= 0,3 h je Knoten | GERECHNET_UNGEEICHT |
| SLEEVE-2 | +130-190 Rang/h, 300-400 Rang je Knoten, ~1 h | **+115-123 Rang/h mit EINEM Infiltrate-Sleeve** (+161 bei 09:19), Fenster 1,5-1,7 h; **Erwartung je Knoten: BN2-Klasse 20-125 Rang (0,05-0,5 h), BN13/15 85-280 Rang, BN14 310-640 Rang**; BN2.2: 0. Route (21 Knotenlaeufe) ~6-15 h von ~660 h | GERECHNET_GEEICHT (Vorrat/Hunger), Zeitumrechnung GESCHAETZT |
| BLADE-3 | +170 Rang/h, ~430 Rang, 2,5 h | wie SLEEVE-2 (Doppelbefund). 2,5 h Fenster stimmt nicht (1,5-1,7 h); 170/h erfordert 2 Infiltrate + Kammer (Kammer-Code existiert nicht); Infiltrate allein +115-123 | GERECHNET_GEEICHT |
| SLEEVE-3 | +117 Rang/h (+55 %) gegen heutige Belegung | **Im Regime real**, aber nur dort: BN2.1 3,8 h (14,0-18,2 h) mit 22 % Spieler-Diplomacy = 58 min; netto zurueckgewonnen (Stamina-Regeneration der Diplomacy braucht 40-60 % Kammer-Ersatz) 23-35 min => **0,4-1,0 h Knotenzeit** im Regime-Knoten. P(Regime) je Raid-Knoten 0,5-0,8 (BN2.2 noch ohne Saat) => 0,2-0,8 h je Knoten, Route 4-17 h | Regime GERECHNET_GEEICHT (Log), Gewinn GESCHAETZT |

## 5. Bauvorgabe

**Ein Paket, eine Datei im Spiel (`src/sleeve.js`), vorher Mock und Test.** Nicht anfassen: `src/blade.js`, `src/lib/figur.js`, `registry.json` (RAM bleibt).

### 5.1 Reihenfolge

1. **Mock-Fix** `tools/mock/ns.js:731-760`: "Infiltrate Synthoids" => `aufgabe = {type:"INFILTRATE", cyclesWorked:0, cyclesNeeded:300}`; "Support main sleeve" => `{type:"SUPPORT"}`;
   je Sleeve einen Zaehler `setzungen` (Aufrufe von `setTo*`). Danach `node tools/audit/verify-g09-betrieb-mock.mjs` muss "Mock bildet Infiltrate korrekt ab" melden.
2. **Test zuerst** `tools/test-sleeve-belegung.js` (in `tools/test-alles.js` eintragen), rot gegen den heutigen Code:
   - S2 Hunger (Raid-Vorrat 0,7, Kampf 26): 1 Infiltrate + 2 Gym. **rot heute** (alle Gym).
   - S3 Kampf 40, Raid-Vorrat 65: 1 Infiltrate + 2 Vertrag. **rot heute** (3x Infiltrate).
   - S4 Chaos 36, Vorrat 339: 2 Diplomacy + 1 Vertrag. **rot heute** (keine Diplomacy).
   - S5 Chaos 48, Vorrat 40: 2 Diplomacy + 1 Infiltrate. **rot heute**.
   - S10 Infiltrate im Amt, Vorrat 260 (> 202): Freigabe (Gym bei Kampf 20). **rot heute** (klebt).
   - S11 Rekrutierer 0 mit Chaos 48: Rekrutierer + 2 Diplomacy. **rot heute**.
   - Setzzaehler: ueber 5 Runden hoechstens 1 Setzung Infiltrate und 1 Setzung Diplomacy je Sleeve. **rot heute** (Diplomacy gar nicht, Infiltrate 4-5 mit altem Mock).
   - **gruen vorher und nachher (Schutz):** S1 BN2.2-Lage bleibt Gym; S9 Hysterese Vorrat 120; S12 Op-Phase Assassination 794 => Vertraege wie bisher; S13 `blade.json` veraltet => keine Diplomacy.
   - Flatterprobe: Zufallsgang um beide Schwellen, <= 12 Rollenwechsel je Sleeve in 10 h (Referenz: 1/1/0).
3. **Code** in `src/sleeve.js`:
   - `blade.json` EINMAL je Takt lesen (heute 7 Lesungen je Takt, `:526, :664, :714` in der Sleeve-Schleife); Felder `istAktion`, `chaos`, `aufraeumen`, `zeit` (frisch <= 10 min).
   - Modulgedaechtnis `letzteOp = {name, zeit}`: setzen, wenn `istAktion` mit "Operations/" beginnt; gueltig 10 min. Ersetzt die Einzelabtastung (D5-Signal 54 % an im Hunger, bei 40-Minuten-Plateaus ohne Operation sonst aus).
   - Exportierte reine Funktion `waehleBelegung(lage)` = `vorschlag()` aus `tools/audit/verify-g09-betrieb-entscheider.mjs` (Konstanten dort in `P`), analog zu `waehleRekrutierer`.
   - `istDiplomacy(t)` neben `istRekrutierung` (`type BLADEBURNER`, `actionType General`, `actionName Diplomacy`); Diplomacy und Infiltrate zaehlen nur dann als `laeuftSchon`, wenn die Rolle in diesem Takt vergeben ist. Sonst Freigabe = die normale Kette (Vertrag ab Kampf 40, sonst Gym).
   - Rangfolge je Takt: Rekrutierer (unveraendert) > Diplomacy (<= 2, nur bei frischem Chaos) > Infiltrate (<= 1, nur bei knapper Operation) > bisheriger Zweig (Vertraege ab Kampf 40, Rueckfall Infiltrate bei leeren Vertraegen, Gym). Rollen gehen an die Sleeves mit dem NIEDRIGSTEN Kampfwert (Amtsinhaber zuerst, ohne Neusetzen).
   - Gym-Pflicht der uebrigen Sleeves bleibt (`:883-900`); das Kampfwert-Tor `:768` bleibt fuer Vertraege.
   - Telemetrie: `grund` nur "arm", wenn Gym gewollt war und Geld fehlte; neues Feld `rollen:{diplomacy:n, infiltrate:n, rekrutierer:nr}`.
4. **Konstanten** (Herleitung): `CHAOS_EIN 32 / AUS 16` (Raid +1,23 ln/h bei 41 Raids/h => 32 -> 50 in 21 min; veraltete `blade.json` bis 2 min und 1 Takt), `N_DIPLO 2` (LP I1D2 328, I0D3 167), `N_INFIL 1`
   (LP 1 = 2 = 3), Raid-Verbrauch 45/h (Maximum 3600/77 = 46,8; gemessen 37-40), Laufzeit 1,5 h => EIN 67, Freigabe 3 x = 202 (Zufluss 1 Sleeve netto +5/h, die Freigabe kommt in der Praxis erst, wenn der Spieler nicht mehr Raid faehrt; gewollt). Andere Operationen: bisher 200/h, 2 h.
5. **Nicht bauen:** SLEEVE-1 in der vorgeschlagenen Form (Infiltrate vor laufendem Vertrag); den Kammer-Sleeve (+37-43 Rang/h im Hunger, neuer Codepfad) erst nach Abnahme des Pakets.

### 5.2 Abnahme und Abbruch (unbeaufsichtigt, ohne Eric)

Live-Pruefstand ist BN2.2/2.3. **Vorhersagen des ALTEN Codes, die den Befund belegen oder widerlegen** (vor dem Einspielen pruefen):
- 14:17-Stand (Knoten 3,65 h): Raid-Vorrat ~83 +- 8, Sleeves Gym x3, Kampf ~36.
- 15:17-Stand (Knoten 4,65 h): Sleeves **3x Infiltrate**, Raid-Vorrat ~85 (Zufluss 51 + 15,75 - 40). Weicht das ab, ist der Befund R2 falsch.

Nach dem Einspielen:
- A1 (BN2.2, Kampf >= 40): `sleeve.json` zeigt hoechstens 1 Infiltrate; zwei Sleeves auf Vertrag/Gym.
- A2: Chaos-Hoechstwert je Stundenstand < 45 im Raid-Betrieb; Spieler-Diplomacy-Anteil im `verify-g09-betrieb-signal.mjs` < 5 %.
- A3: hoechstens 2 Rollenwechsel je Sleeve und Stunde (`data/sleeve.json`-Verlauf oder Stundenstaende).
- Abbruch (git revert + einspielen): (i) ein Sleeve `currentWork = null` ueber > 2 Takte; (ii) Raid-Vorrat < 1 ueber > 20 min bei laufendem Infiltrate-Sleeve; (iii) Chaos > 50 ueber > 10 min bei 2 Diplomacy-Sleeves;
  (iv) > 6 Rollenwechsel je Sleeve und Stunde; (v) Kampf der Gym-Sleeves steigt > 2 h nicht, ohne dass eine Rolle vergeben ist; (vi) `node tools/test-alles.js` rot; (vii) `tools/test-ram.js` rot.
- Vor dem Bau ein `[skeptiker]`-Lauf (laeuft weiter, wenn niemand hinsieht): Pflicht laut globaler CLAUDE.md; Marker im Commit-Betreff.

## 6. Grenzen dieser Pruefung (was ich nicht belegen kann)

- **Kein Diplomacy-Sleeve ist je gelaufen.** Die Abbaurate (-1,0-1,03 %/min bei Charisma 1-2, `Bladeburner.ts:735-743`) ist aus dem Quellcode, nicht geeicht; die Reihe der Spieler-Diplomacy hat
  kein Endchaos im Protokoll. Abnahme A2 ist die erste Eichung.
- **Nur BN2.** BN13/14/15 und BN6/7 sind aus den Multiplikatoren hochgerechnet, nicht beobachtet. Die BN14-Zahlen (310-640 Rang) sind die unsicherste Zeile.
- **Vertragsvorrat nicht modelliert** (auch nicht im Audit-LP): zwei Vertragssleeves liefern gemeinsam ~37 Rang/h statt 2 x 34. Das verkleinert nur den Nutzen der "1 statt 3 Infiltrate"-Regel.
- Der Zeitumrechnungsfaktor 0,3-0,5 (Hunger) und 0,4-1,0 h (Chaos) ist geschaetzt; die Bahn ist nicht autonom im Rang.
- Der Op-Phase-Ausschluss (SLEEVE-1) stuetzt sich auf Stundenstaende und das Aktionslog; ein Mangel unter 1 h Dauer ohne Notaktion waere nicht sichtbar.
- Ein zweiter Gegenpruefer arbeitet an G09 (Dateien `verify-g09-*.mjs` ausser `-betrieb-*` sind nicht von mir); keine Abstimmung der Zahlen erfolgt.

## Anhang: Rechnerausgaben (Auszug)

LP (`verify-g09-betrieb-lp.mjs`), Rang/h, "gegen allein":

| Konfiguration | 07:33 | 08:33 | 09:19 |
|---|---|---|---|
| Spieler allein (Sleeves im Gym) | 137 | 143 | 167 |
| 1 Infiltrate, 2 im Gym | 252 (+115) | 266 (+123) | 328 (+161) |
| 2 Infiltrate, 1 im Gym | 252 | 266 | 328 |
| 3 Infiltrate | 252 | 266 | 328 |
| 1 Infiltrate + 1 Kammer, 1 Gym | 289 (+153) | 297 (+155) | 363 (+196) |
| 2 Infiltrate + 1 Kammer | 310 (+173) | 308 (+165) | 367 (+200) |
| 1 Infiltrate + 2 Vertrag (Gym fertig) | 295 | 324 | 397 |
| 3 Vertrag | 201 | 231 | 270 |

Entscheider-Lauf: `20 gruen, 0 rot` (Eichung 2/2, Szenarien S1-S13 inkl. Gegenprobe `aktuell()`, Flatterprobe 1/1/0 Wechsel in 10 h). Wiederholung der echten BN2.1-Reihe: bei 09:46/09:59
(Chaos 38/49) waehlt `vorschlag()` Diplomacy / Infiltrate / Diplomacy (alt: Bounty Hunter / Infiltrate / Infiltrate), bei 19:17-22:17 (Chaos 49, Vorrat 339-616) Diplomacy / Tracking / Diplomacy
(alt: 3x Infiltrate), bei 02:17 (Chaos 0) drei Vertraege (alt: 3x Infiltrate).
