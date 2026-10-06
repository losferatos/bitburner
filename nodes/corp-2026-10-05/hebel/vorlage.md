# Entscheidungsvorlage H1/H2/H3 (Corp-Geld in BN3)

Stand 06.10.2026 18:49 (Systemzeit). Nur gelesen: `src/` unveraendert, keine Commits, Live-Daten nur ueber
`getSaveFile` (Bruecke, lesend). Rechner in diesem Ordner, je < 1 s, 1 Kern.

## 0. Kernbefund: BN3.1 ist vor der Zuendung vorbei

| Zeit | Rang | Black Ops | Daedalus-Chance | Bonus-Vorrat |
|---|---|---|---|---|
| 17:17 (nach Einbau) | 13.514 | 0 | 0,003 | 7,4 BB-h |
| 18:10 | 43.565 | 1 | 0,011 | 3,8 BB-h |
| 18:32 | 109.332 | 7 | 0,037 | 2,4 BB-h |
| 18:41 | 165.474 | 10 | 0,075 | 1,8 BB-h |
| 18:49 | 235.569 | 12 | 0,136 | 1,3 BB-h |

- Chancen GERECHNET mit der Spielformel aus `src/blade.js` blackOpChance (`chance.mjs`); geeicht: reproduziert `data/blade.json` boChancen 18:32 exakt (Red Dragon 0,8494, K 0,7079, Daedalus 0,037).
- **Bladeburner laeuft gerade 5-fach**: gespeicherte Zyklen aus der Offline-Zeit, max. 5 Ticks je Sekunde (`Bladeburner.ts:1377-1380`). Der Vorrat ist gegen 19:05 leer, danach 1-fach. Die 140-380k Rang/h der letzten Stunde sind Bonuszeit; echt sind 84-108k Rang je Bladeburner-Stunde.
- Bindend ist **nicht Rang 400k**, sondern die Daedalus-Chance: ab Rang 400k feuert der Bot die letzten Ops ab 0,35 (`blade.js` SICHER_BLACKOP, Endspiel). Davor gilt 0,90.
- Daedalus-Chance waechst mit Rang^1,0-1,7 (gemessen 1,2 / 1,6 / 1,7 / 1,7). Ursache sind die Skillpunkte: Blade's Intuition, Digital Observer, Reaper und Evasive steigen mit dem Rang.

**Ausgang BN3.1 (GESCHAETZT, `bn31.mjs`): 19:40-20:50, Median ~20:05.** Mit Reibung (Fehlschlaege, Black-Op-Dauer) spaetestens ~23:00. Corp-Geld kommt fruehestens ~02:00 (Zuendung bei 9,5-11 Corp-h, dazu Boersengang und Verkauf); die naechste Einbausperre endet ~05:30.
→ **In BN3.1 sparen H1, H2 und H3 je 0 h.** Die Corp verfaellt mit dem Ausgang (`prestigeSourceFile`). Auf sie zu warten waere falsch.

**Stolperdraht:** Steht BN3.1 um 00:00 noch, mit Daedalus < 0,3, gilt der Rueckfallplan (Abschnitt 4).

## 1. H1 Grafting mit Corp-Geld

**Empfehlung BN3.1: Zuender AUS.** Gesparte Zeit 0 h. Angeschaltet waere es nur ein Risiko:
- `graftplan.json` enthaelt **kein Simulacrum**.
- Die Liste beginnt mit SPTN-97 (14,6 Mrd, mit Puffer 29 Mrd).
- Ohne Simulacrum haelt `blade.js` waehrend jedes Grafts still (Riegel `data/simulacrum.txt`). Das waeren 2,0 h Stillstand mitten im Endspurt.

**Empfehlung BN3.2/3.3: bedingt AN, Prioritaet 3.** Erst nach H2-light und H3, und erst nach den Code-Aenderungen unten. Gespart werden **0-0,5 h** (mit Syndicate, K ~4) bzw. **0,5-1,4 h** (ohne Syndicate, K ~2). Begruendung: Die Phase nach dem Corp-Einbau dauert nur 2-4 h. Grafts liefern ihren k erst nach Stunden: x1,5 nach 2,1 h, x2,1 nach 2,9 h, x3,0 nach 4,4 h (`lauf.mjs` GRAFT).

| Graft (Int 155) | Kosten | Dauer fokussiert / ohne Fokus | Faktion (bestechlich?) |
|---|---|---|---|
| The Blade's Simulacrum | 450 Mrd | 0,23 / 0,29 h | BB (nein) |
| Neuroreceptor Management Implant | 1,65 Mrd | 0,23 / 0,29 h | Tian Di Hui |
| SPTN-97 | 14,6 Mrd | 1,61 / 2,01 h | Covenant (nein) |
| Graphene Bionic Legs (braucht Bionic Legs) | 13,5 Mrd | 0,83 / 1,04 h | MegaCorp/ECorp/Fulcrum (nein) |
| Graphene Bionic Spine (braucht Bionic Spine) | 18,0 Mrd | 1,45 / 1,82 h | Fulcrum/ECorp (nein) |
| Photosynthetic Cells | 8,3 Mrd | 1,34 / 1,68 h | KuaiGong (nein) |
| CordiARC | 15,0 Mrd | 1,80 / 2,25 h | MegaCorp (nein) |

Graftdauer GERECHNET (`graftzeit.mjs`, `GraftableAugmentation.ts`), geeicht gegen 3 Werte der Spiel-API:
- AT III: exakt.
- Graphene Legs: Abweichung 0,07 %.
- Synthetic Heart: -2 %. Die Datenquelle 3.0.2 fehlt den Charisma-Mult; mit den API-Mults stimmt es auf 0,02 %.

Antworten auf die Fragen:
- **Simulacrum zuerst: ja, immer.** Nur mit ihm laeuft Bladeburner neben dem Graft (`Bladeburner.ts:178-180, 1356`).
- **Grafts sperren den Einbau:** `bn4rep.js` baut waehrend eines Grafts nicht ein. Ein Einbau wuerde den Graft ohne Erstattung toeten (`PlayerObjectGeneralMethods.ts:137`, `finishWork(true,true)`).
  - **Falle Einbau-Verhungern:** `graftauto` startet den naechsten Graft binnen 60 s. Eine Graftkette kann den Corp-Einbau stundenlang blockieren.
- **Graft-Augs bleiben ueber den Einbau** (`applyAugmentation` sofort, in `augmentations`), ebenso die Entropie. Beides faellt erst beim Knotenwechsel weg (`:144`).
- **Kaufschleife/Ruecklage:** `graftauto` gibt nur Konto minus `data/geldbedarf.txt` aus. Corp-Etappe e3c hebt `geldbedarf` nach jedem Verkauf um den Erloes an. Damit bekommt Grafting **nie** Corp-Geld. Ein `graftGeld` gibt es in `src/` nicht, es steht nur in `bau/STAND.md`. Dazu kommt `PUFFER_FAKTOR` 2.
- **Fokus-Strafe x0,8:** Live gilt `focus` = false. Jede Seitennavigation des Bots weg von Page.Work beendet den Fokus (`GameRoot.tsx:273-275`). Deshalb Neuroreceptor als 2. Graft: 0,29 h, danach dauerhaft ohne Strafe (`PlayerObjectGeneralMethods.ts:622-628`).
- **Vorzug Congruity (150 Bio):** Mit Corp-Geld wird er bezahlbar und waere dann ZUERST dran. Das ist harmlos (0,23 h, loescht die Entropie), aber nach dem Simulacrum einordnen.

Noetige Aenderungen (grob):
1. `tools/graftplan-bauen.js` / `nodes/GRAFTPLAN.md`: BN3-Reihenfolge Simulacrum, Neuroreceptor, (Congruity), SPTN-97, Graphene Legs, Graphene Spine, Photosynthetic, CordiARC. Was die Bestechungsrunde ohnehin kauft, wird uebersprungen.
2. `src/lib/graftwahl.js`: kein Graft ausser dem Simulacrum, solange es fehlt. Graft-Budget getrennt von der Aug-Ruecklage.
3. `src/graftauto.js`: keinen Graft starten, wenn eine Torrunde oder ein Einbau ansteht (`data/einbau.json`, `data/torrunde-corpwait.json`) und Graftdauer > Zeit bis Einbau. Geld nur bei corpSignal.deliverable.
4. `src/corp.js` / `src/lib/corpgeld.js`: den Graftbedarf in die Anforderung `data/corp-geld.txt` aufnehmen.
5. Zuender: `data/nicht-schieben.txt` / Registry-Vorbedingung. Laut Datei Erics Entscheidung, jetzt an dich delegiert.

## 2. H2 Kriminelle Faktionen (Sleeves auf Homicide)

**Erbauer-Zahl "k 2,2 -> 7,5" geprueft: die Basis ist veraltet.** Live gilt:
- **The Syndicate ist schon Mitglied.**
- Der Bladeburners-Ruf liegt bei 367k (gerechnet hat der Erbauer mit 60k). Damit sind alle BB-Stuecke offen; das teuerste braucht 187,5k.

Echte Rundenwahl (`kfak.mjs`, Bestechung, unbegrenzter BB-Ruf):

| Faktionen | Budget 1e14 | 1e15 | unbegrenzt |
|---|---|---|---|
| heute beigetreten inkl. Syndicate | k 4,13 | 4,92 | 5,51 |
| + Speakers | 5,44 | 6,83 | 8,85 |
| + Speakers + Dark Army | 6,07 | 8,19 | 11,46 |

Der Grenzwert von H2 liegt also bei **x1,5-2,1, nicht x3,4**. Er gilt nur, wenn danach noch ein Einbau kommt.

**Kosten: vernachlaessigbar.**
- Homicide dauert 3 s. Ein Sleeve trifft mit p ~0,43 (Stufen ~83).
- Kills zaehlen fuer den Spieler, **unabhaengig von der Synchronisation** (`SleeveCrimeWork.ts:47`). Karma wird mit sync skaliert; sync ist live 1 %, Karma kommt von Sleeves also praktisch nicht.
- 30 Kills mit 3 Sleeves: ~70 s. Die Sleeves machen heute Recruitment und die Contracts Bounty Hunter / Tracking; 2 min Ausfall kosten nichts Messbares.

**Bedingungen** (`FactionInfo.tsx`):
- Speakers: Kampfwerte 300 (alle vier), Hacking 100, 30 Kills, Karma -45.
- Dark Army: Kampfwerte 300, Hacking 300, 5 Kills, Karma -45, Spieler in **Chongqing**.
- Syndicate: Spieler in **Aevum/Sector-12**, Kampfwerte 200, Hacking 200, 10 Mio $, Karma -90.

**Was der Einbau zuruecksetzt** (`PlayerObjectGeneralMethods.ts`):
- Kills (`:83`) und alle Mitgliedschaften (`:111`) sind danach weg, ebenso die Stadt (Sector-12, `:104`).
- Karma bleibt (live -2058).

**Stadtwechsel:** Die Bladeburner-Stadt ist ein eigenes Feld (`Bladeburner.city`, live Ishima gegen Spieler in Aevum); der Wechsel kostet also nichts. Er kollidiert aber mit dem Graft-Start (nur in New Tokyo, `Grafting.ts:60`). Reihenfolge: Syndicate, dann Chongqing, dann New Tokyo.

**Falle:** Homicide durch den Spieler (fuer Karma) toetet einen laufenden Graft. Kills deshalb nur ueber Sleeves.

**Empfehlung BN3.1:** aus, 0 h (kein Einbau mehr vor dem Ausgang).

**Empfehlung BN3.2/3.3:**
- **"H2-light" AN: Prioritaet 1, gespart 1,5-2,2 h.** Inhalt: Syndicate VOR dem ersten Corp-Einbau.
  - Ohne Syndicate: k 2,0-2,5. Mit Syndicate: k 3,5-4,3 (BB-Ruf 54-82k in Zyklus 1, `h3.mjs`).
  - In Zyklus 1 stand der Spieler bisher in Ishima (`joinrun.js` reist dorthin). Die Syndicate-Einladung kam in BN3.1 nur zufaellig, weil der Einbau den Spieler nach Sector-12 setzte.
  - Karma -90 kommt aus den Kill-Ops (-1 je Erfolg, `Bladeburner.ts:971`; BN2.3: -71 bei 7,8 h, -234 bei 12,4 h). Fehlt es, reichen 1-2 min Homicide durch den Spieler.
- **Speakers/Dark Army: AUS fuer den ersten Einbau, 0 h.** Kampfwerte 300 werden in Zyklus 1 nicht erreicht (BN2.3: 251-267 bei 12,4 h; BN3.1: 236-241 bei 19,6 h). Ein zweiter Einbau kommt nicht mehr, der Ausgang liegt 2-4 h nach dem ersten.

Noetige Aenderungen (grob):
1. `src/joinrun.js` (oder `bn4life.js`): in BN3/V2 ab Karma <= -90, Kampfwerte >= 200, Hacking >= 200 und Geld >= 10 Mio nach Sector-12/Aevum reisen, bis die Syndicate-Einladung kommt. `popups.js` nimmt sie an; Syndicate hat keine Feinde.
2. Fehlt nach ~9 h das Karma: kurzer Homicide-Antrag ueber die Figur-Vergabe (`lib/figurns.js`), nie waehrend eines Grafts.
3. Nur fuer einen zweiten Einbau: in `src/sleeve.js` Homicide bis Kills >= 30, dazu die Reise nach Chongqing.

## 3. H3 Einbausperre 6 h statt 12 h im Corp-Modus

**Pruefung der Erbauer-Rechnung "nie schlechter, bis -1,5 h" (`bot/rechnung/einbauzeit.mjs`):**
- Ausgang = Rang 400k: falsch, bindend ist die Daedalus-Chance.
- Die Rangrate stammt aus BN2.3 Zyklus 1, ohne Skillpunkt-Rueckkopplung und ohne Bonuszeit. Das Modell setzt Rang 400k erst ~14 h nach dem Einbau an (07:00); live stand der Rang 1,6 h nach dem Einbau bei 236k.
- BB-Ruf 2,9 je Rang. Live sind es **3,96**: faction_rep 1,341 x (1 + Favor 47,7/100) x 2. Der Favor-Faktor betraegt also x1,48. Fuer H3 spielt das in BN3.1 keine Rolle, weil der BB-Ruf ohnehin alle BB-Stuecke deckt.
- Das "-1,5 h" haengt an einem Zeitbild, das nicht eintritt. **In BN3.1: 0 h.**

**BN3.2/3.3 (`h3.mjs`, GESCHAETZT):**
- Die erste Sperre endet ~12,5 h nach Knotenstart: 12 h ab Ende des Aufbaus, `endspurt.js:323`.
- Corp-Geld plus Bestechung bei T_m + ~1 h.
- Ein frueher Einbau hat weniger BB-Ruf, also weniger BB-Stuecke. Er gewinnt trotzdem:

| Einbau | mit Syndicate: Ausgang | ohne Syndicate: Ausgang |
|---|---|---|
| 10,8 h (BB-Ruf 54k) | 13,6-14,5 h | 15,4-17,0 h |
| 12,5 h (heutige Sperre, 82k) | 14,8-15,5 h | 16,1-17,4 h |

→ **Gespart 0,5-1,2 h, nur wenn die Corp bis ~11,5 h nach Knotenstart liefert.** Das setzt einen Corp-Start in der ersten Stunde voraus (RAM nach dem Knotenwechsel pruefen). Liefert sie spaeter, ist der Gewinn 0.

**Risiko:** Die 12-h-Sperre schuetzt vor Einbau-Kreiseln im Aufbau. Deshalb nur fuer die Corp-Torrunde lockern, also bei corpSignal.deliverable und Rundengewinn >= CORP_WAIT_MIN_GAIN, nicht pauschal.

**Empfehlung: AN in BN3.2/3.3, Prioritaet 2.** Aenderung:
- `src/lib/endspurt.js` kampfEinbauSperre: Parameter corpModus → 6 h, oder die erste Corp-Runde von der Sperre ausnehmen.
- Aufruf in `src/bn4rep.js` mit corpSignal.
- Test in `tools/test-endspurt.js`.

**Nachtrag Bau H3 (06.10.2026 abends, Rechner `h3sperre.mjs`, Skeptiker-Nachmessung):**
- In BN3.2 wurde die Corp bei Knotenstunde ~0,07 gegruendet (19:23, Knoten seit ~19:20). Corp-Geld kommt realistisch bei Tc = Zuendung 9,5-11 h + erster Verkauf, also **~10,5-12,5 h**.
- Damit spart H3 **~0-1 h, meist 0,3-0,5 h mit Syndicate** (H2-light wird gebaut); ohne Syndicate um 0, im schlechtesten Band -0,2 h (Tc 11,5 h: der fruehe Einbau verpasst die naechste Stufe Bladeburners-Ruf). Die 0,5-1,2 h oben gelten nur fuer Tc um 10,8 h mit Syndicate.
- Gebaut nur fuer die **erste** Corp-Runde des Knotens (Merker `data/corp-first-round.json`, jeder Einbau nach der Zuendung verbraucht sie): eine zweite Corp-Runde mit 6 h fiele in 5 von 54 Baendern ins Endspiel mit Black Ops.

## 4. Rueckfallplan, falls BN3.1 bei der Zuendung noch laeuft (unwahrscheinlich)

Das heisst: die Chancen sind stehen geblieben (Rangrate eingebrochen). Dann kommt das Geld ~02:00, und es gilt:
1. Simulacrum graften. Kein Einbau noetig, keine Sperre, Bladeburner laeuft weiter.
2. Mit H3 einbauen, mit Syndicate (schon Mitglied) und, wenn erreichbar, Speakers und Dark Army. Die Kampfwerte liegen live bei 290 und steigen.
   - k 4,1-5,5 bzw. 6,1-11,5, dann Ausgang ~2-3 h nach dem Einbau.
   - Ohne H3 erst ab 05:30.
3. Gewinn gegen "warten bis 05:30": ~2-3 h (GESCHAETZT, ohne eigenes Modell fuer den Stillstand).

## 5. BN3.2/3.3: Was traegt ab Stunde 0?

Basis BN3.2 ohne Corp (`lauf.mjs`): Einbau ~12,5-14 h, danach 8,7-12,9 h, Ausgang **~21-27 h**. Der Corp-Einbau mit Bestechung (gebaut, 12-h-Sperre, ohne Syndicate) bringt **~16,1-17,4 h**.

| Rang | Hebel | gespart je BN3.x-Lauf | ab wann |
|---|---|---|---|
| 1 | H2-light: Syndicate vor dem 1. Corp-Einbau | 1,5-2,2 h | Vorbereitung ab Stunde 0 (Stadt, Karma), wirksam am Corp-Einbau |
| 2 | H3: Corp-Einbau sobald Geld da | 0,5-1,2 h (0 bei spaeter Corp) | ab Zuendung |
| 3 | H1: Simulacrum + Grafts nach dem Einbau | 0-0,5 h (0,5-1,4 h ohne Syndicate) | ab Zuendung |
| - | H2 voll (Speakers/Dark Army) | 0 h (Kampfwerte 300 fehlen in Zyklus 1) | - |

Vor der Zuendung (~10 h) traegt **kein** Hebel, denn alle brauchen Corp-Geld. Ab Stunde 0 vorbereiten laesst sich nur H2-light: Mitgliedschaftsbedingungen und Stadt. Beste Kombination BN3.2: **~14 h** statt ~16,8 h (Corp ohne Hebel) bzw. ~23,5 h (ohne Corp).

Groesster Unsicherheitsposten, nicht Teil der Hebel: Wann startet die Corp nach dem Knotenwechsel? In BN3.1 geschah das erst bei Knoten-Stunde 18,6.

## 6. GERECHNET / GESCHAETZT

**GERECHNET** (Spielcode nachgebaut und geeicht):
- Black-Op-Chancen (`chance.mjs` = `blade.js`, exakt gegen `blade.json`).
- Graftdauer und -kosten (`graftzeit.mjs`, 3 API-Werte).
- k je Faktionsmenge (echte `waehleTorRunde`).
- Bonuszeit (5 Ticks), Faktionsbedingungen, was der Einbau zuruecksetzt, Kill-/Karma-Buchung.
- BB-Ruf je Rang live 3,96.

**GESCHAETZT**, alle Stunden (`lauf.mjs`, `bn31.mjs`, `h3.mjs`). Modell:
- Rangrate c·K^beta·R^e: geeicht 84k/h bei 152k, Pruefung 108k bei 200k (Modell 117k).
- Chance ~ R^b, b 1,0-1,7 gemessen.
- Anlauf 5,0 h·K^-1,4 aus 2 Punkten.
- Bandbreiten: e 1,0-1,4, beta 0,65-0,8, Anlauf x0,7-1,3.
- Gegenprobe BN2.3: gemessen Einbau → Ausgang 2,13 h, Modell 1,9-2,7 h.

Nicht modelliert: Fehlschlag-Pech, HP/Krankenhaus, Ausdauer, Black-Op-Zaehler, Bot-Eigenheiten. BN3.2-Zyklus 1 ist als BN2.3-artig angenommen (BN3.1-Zyklus 1 war mit aelterem Bot 19,6 h).

Dateien: `live.mjs` (Spielstand ueber die Bruecke), `chance.mjs`, `ops.mjs`, `graftzeit.mjs`, `kfak.mjs`, `lauf.mjs`, `bn31.mjs`, `h3.mjs`.
