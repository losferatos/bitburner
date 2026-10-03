# Gegenpruefung G01 (Gang in BN2) - Winkel BETRIEB

Stand 2026-10-03 22:29 (Systemzeit). Streng lesend: `src/` unveraendert, Spiel
nicht angefasst, nichts committet. Spielquelle 3.0.2 `reference/bitburner-src/src/`.
Rechner: **`tools/audit/verify-g01-betrieb.mjs`** (8 Abschnitte, `ABSCHNITT=n`
fuer einen), nutzt `gang-sim.mjs`, `gang-round.mjs`, `gang-augs.mjs` und
`kampfknotenNuetzlich` direkt aus `src/lib/hackaugs.js`.
Spielstaende: `backups/LIVE_197f4d61481686_BN2L1_2026-10-03T{09-59,17-17,19-01,20-17,21-17}*`.

Auftrag dieses Winkels: verhaelt sich der Bot wirklich so, ist der Fall im
Alltag erreichbar, und was bricht die Loesung, wenn niemand hinsieht.

## Urteil (Statusliste)

| Befund | Urteil | Was haelt | Was nicht haelt |
|---|---|---|---|
| GANG-2 (TRP-Falle) | **BESTAETIGT, mit drei Korrekturen** | Kauf, Zwangseinbau, Dauersperre Zeile fuer Zeile belegt | "erzwingt den Einbau" heisst: am naechsten freien Tor; der vorgeschlagene Fix (TRP nur im V1 zulassen) hat ein Loch, wenn `data/verfahren.txt` fehlt; TRP laesst sich nie wieder aus der Warteschlange holen -> harte Reihenfolge im Bau |
| GANG-1 (Gang als V2-Hebel) | **TEILWEISE** | Zugang ohne Karma, Angebot, Rufkurve betrieblich plausibel (Territorium bleibt ohne Warfare fest, Offline wird nachgeholt) | Matrixzeile 16 "Bewertung und Kauf waeren bereit" ist **falsch**: mit der heutigen Kaufschleife bringt Zyklus 1 Competence **x1,24 statt x3,92**. Der Ertrag setzt einen Kaufplaner voraus, den es nicht gibt (AUG-4 wird P1-Voraussetzung). BN2.1-Anteil "10-15 h" nur bei Bau heute Nacht |
| BN2-3 (kein ruffreier Kanal) | **TEILWEISE** | Diagnose bestaetigt: Vertragsruf geht nur an Faktionen mit Hacking-Arbeit (`PlayerObjectGeneralMethods.ts:515-535`), Slum Snakes hat keine; Passivruf 0 | Ertrag 10-25 h erbt den Vorbehalt von GANG-1 |
| Nebenbefund Offline | Korrektur | Offline-Zeit geht nicht verloren | Die Gang holt **25-fach** nach, nicht 2,5-fach (`Gang/data/Constants.ts:28-31`, `Gang.ts:99-121`) |

## 1. Was der Bot wirklich tut (GANG-2)

Geprueft im Quelltext, nicht aus dem Bericht uebernommen:

1. **Kandidat:** `src/bn4rep.js:668-678` sammelt aus `spieler.factions` jede Faktion,
   also auch die Gang-Faktion. Filter `:672` laesst durch, was
   `kampfknotenNuetzlich` durchlaesst; `src/lib/hackaugs.js:347` gibt fuer
   `"The Red Pill"` immer `true`.
2. **Angebot:** `Faction/FactionHelpers.tsx:172-183` - mit Gang in BN2 haengt das
   Spiel TRP an die Gang-Liste an. `NetscriptFunctions/Singularity.ts:128-133`
   liefert genau diese Liste an `getAugmentationsFromFaction`.
3. **Kauf:** Preis 0 (`verify-g01-augs.mjs`: repCost 2.500.000, moneyCost 0), also
   kauft die Schleife `:1737-1745` TRP in der Runde, in der der Ruf 2,5 Mio
   erreicht. TRP zaehlt in `1,9^q` (`Augmentation/AugmentationHelpers.ts:32-37`,
   nicht SoA) - jedes folgende Stueck kostet x1,9.
4. **Zwangseinbau:** `:1272` `redPillWartet` umgeht in `:1370-1376` die
   Mindestwarteschlange und die Einbaugruende, **nicht** aber `gesperrt`
   (`kampfEinbauSperre`, 12 h), `wiederaufbauHilfe` und das Tor `einbauErlaubt`
   (`:1426-1440`). Korrektur: Einbau am naechsten freien Tor, nicht sofort.
5. **Dauersperre:** `:1207` `ausgangSteht = eingebaut(TRP)`, `:1370`
   `if (!ausgangSteht && ...)` ist das einzige Einbautor. `:1229` laesst nur bei
   Hacking >= 15.000 schlafen - in BN2 nie. Die Kaufschleife `:1737` laeuft
   weiter: der Bot kauft danach den Rest des Knotens Augs, die nie eingebaut
   werden, und haelt dafuer ueber `data/geldbedarf.txt` Geld zurueck
   (`lib/endspurt.js:354-359`, sechs Leser).
6. **Wann es zuschnappt** (Abschnitt 5, Sim ungeeicht): bester Regler 2,5 Mio nach
   11,7 h, also noch **in Zyklus 1** vor dem 12-h-Tor; einfacher Regler in Zyklus 2
   nach 4,3 h (Favor 204 hebt die Rate x3,04). Ohne Fix gibt es je Lauf
   hoechstens **eine** Gang-Runde, und die enthaelt TRP.

**Loch im vorgeschlagenen Fix** ("TRP nur im Verfahren V1 als Kandidat"):
`nurKampfStuecke` (`:661-665`) faellt bei unlesbarer `data/verfahren.txt` per
`catch { return false; }` auf **false** - dann ist der ganze V2-Filter aus, und TRP
kaeme trotz geaendertem `hackaugs.js` wieder durch. Der Schutz muss einen
**positiven V1-Nachweis** verlangen (Zweifel = kein TRP), umgekehrt zur
Vorsichtsregel von `bladeburnerTraegtHier()` (`:122-144`). Begruendung der
Asymmetrie: ein fehlender TRP-Kauf im V1 kostet eine Runde (ausgang.js schreibt die
Marke alle 30 s neu), ein falscher TRP-Kauf in BN2 kostet den Rest des Knotens.

**Nicht umkehrbar:** Eine gekaufte Aug laesst sich nur durch Einbau aus der
Warteschlange holen (`AugmentationHelpers.ts:69-103`, kein Entfernen). Ein einziger
TRP-Kauf vor dem Fix ist also endgueltig. Daraus folgt die harte Reihenfolge in
Abschnitt 5.

Ausserhalb einer Gang ist der Fall heute nicht erreichbar (Slum Snakes, Tetrads,
The Syndicate sind Mitglied, aber ohne Gang kein TRP; Daedalus braucht Hacking 2.500
oder Kampf 1.500). Er wird erreichbar, sobald `createGang` laeuft - auch von Hand.

## 2. Was die Gang im HEUTIGEN Bot bringen wuerde (GANG-1, Kernbefund dieses Winkels)

Matrixzeile 16 sagt "Bewertung und Kauf waeren bereit". Das stimmt fuer die
Bewertung, nicht fuer den Kauf. Die Kaufschleife `src/bn4rep.js:1737-1745` kauft
**jedes verdiente und bezahlbare Stueck sofort**, absteigend nur innerhalb einer
15-s-Runde. Der Gang-Ruf waechst von 0 aus; zuerst verdient sind die billigsten
Stuecke (Neurotrainer I 1.000 Ruf, Wired Reflexes 1.250, LuminCloaking, Hacknet NIC
1.875 ...). Nach zehn Stueck kostet alles x1,9^10 = 613 - SPTN-97 (4,875 Mrd) dann
3 Bio.

Abschnitt 4 (BN2.2, Zyklus 1, q0 = 0, Geld = 4,09 Mrd/h brutto, also zu Gunsten des
Bots; andere Faktionen nicht mitgerechnet, was den Bot zusaetzlich schlechter
stellt):

| T bis Einbau | Ruf (bester Regler) | Bot heute | Bot mit HASH-4/GANG-2-Filter | Optimal (Bericht) |
|---|---|---|---|---|
| 8 h | 1,04 Mio | 11 Augs, x1,13 | 10 Augs, x1,24 | 10 Augs, x2,82 |
| 12 h | 2,65 Mio | 12 Augs, x1,13 **+TRP** | 10 Augs, x1,24 | 11 Augs, x3,92 |
| 16 h | 5,24 Mio | 12 Augs, x1,13 +TRP | 11 Augs, x1,24 | 11 Augs, x4,54 |

Kaufreihenfolge heute: Neurotrainer I, Wired Reflexes, LuminCloaking-V1, Hacknet
NIC, Cache, CPU, LuminCloaking-V2, Augmented Targeting I, NutriGen, Combat Rib I,
INFRARET, The Red Pill. Optimal: SPTN-97, Graphene Bone Lacings, Neotra, Bionic Arms,
Bionic Spine, Nanofiber Weave, DermaForce, HemoRecirculator, ...

Ueber drei Zyklen (Abschnitt 6, Favor aus `favor.ts:12-24`):

| Kaufregel | nach Z1 | nach Z2 | nach Z3 |
|---|---|---|---|
| heute (sofort) | x1,24 | x2,02 | x2,61-2,92 |
| am Tor, absteigend nach Preis | x2,60-3,12 | x6,28-6,81 | x12,9-15,4 |
| optimal (Competence je Dollar) | x3,92-4,21 | x13,3-15,5 | x28,6-33,0 |

Lesart: Mit der heutigen Schleife kommen die starken Stuecke erst nach zwei bis drei
Zyklen (24-36 h) - in BN2.1 nie, in BN2.2/2.3 erst im letzten Drittel. Die einfache
Regel "erst am Tor kaufen" holt in Zyklus 1 zwei Drittel des Optimums; die volle
Auswahl nach Competence je Dollar den Rest. **AUG-4** (`inventar-aug.md`, dort P2
"bis ~+7 % je Zyklus") ist mit Gang keine Feinarbeit mehr, sondern die Bedingung,
ob GANG-1 traegt. Dieselbe Treppe trifft die Bladeburners-Stuecke, die waehrend des
Zyklus verdient werden: der Bericht selbst zeigt q0 = 4 -> x1,43 statt x2,87.

## 3. Erreichbarkeit im Alltag - Live-Lage BN2.1

Der Stand im Auftrag (18:43, "11 Augs wartend, Einbau steht bevor") ist ueberholt.
Spielstaende:

| Zeit | Knoten h | effektiv h | Rang | Augs inst./wartend | Typhoon | Daedalus |
|---|---|---|---|---|---|---|
| 19:01 pre-install | 14,32 | 7,60 | 3.884 | 1 / 11 | 0,145 | 0,0022 |
| 19:17 | 14,58 | - | 4.667 | 12 / 0 | 0,147 | 0,0021 |
| 21:17 | 16,59 | 16,58 | 6.743 | 12 / 0 | 0,268 | 0,0037 |

Naechstes Einbautor (Abschnitt 7, aus `data/einbau-uhr.json` im Spielstand und der
Regel `lib/endspurt.js:322-332`): Aufbau nach dem 19:01-Einbau dauerte 3,2 min,
Tor = fertig + 12 h = totalPlaytime 1.092,495 h, Stand 21:17 1.082,707 h ->
**So 04.10. ~07:04 MESZ** (Spielzeit laeuft offline mit), Knotenzeit 26,4 h.
`data/einbau.json` 21:17 sagt passend `kampfZuFrueh: true`.

Knotenende per Analogie (bn-bn2.md, geschaetzt): 41,9-49,6 h effektiv, Wanduhr
So 22:35 bis Mo 06:17 MESZ.

| Bau | Gruendung bei Knotenzeit | Gang-Zeit bis Ende | Was in BN2.1 drin ist |
|---|---|---|---|
| heute Nacht, Gruendung Sa 23:30 | 18,8 h | 23-31 h | Runde am Tor h26,4 mit 7,6 h Gang-Zeit (Ruf 0,62-0,91 Mio): optimal x2,5-3,0, am Tor absteigend x2,0 (Abschnitt 8); evtl. zweite Runde ~h38 |
| nach Wochenreset, Gruendung So 16:00 | 35,3 h | 6,6-14,3 h | Das Tor h26,4 ist ohne Gang verbraucht, das naechste liegt bei ~h38-39 - hoechstens eine Runde kurz vor Knotenende |

Der Berichtswert "BN2.1 eher 10-15 h" ist nur mit Bau heute Nacht UND Kaufplaner
erreichbar. Mit Bau nach dem Reset ist der BN2.1-Anteil nahe 0, der Hauptertrag
liegt dann in BN2.2/2.3.

Ein weiterer Live-Punkt: Bis zum Tor wird Bladeburners-Ruf (21:17: 9.505) neue
BB-Stuecke freischalten, die die heutige Schleife sofort kauft. Jedes davon
verteuert die Gang-Runde am Tor um x1,9. Ohne Kaufaufschub fuer ALLE Faktionen ist
die BN2.1-Runde auch mit Gang-Planer teilweise weg.

## 4. Was die Loesung im unbeaufsichtigten Betrieb bricht

| Feld | Befund | Beleg | Folge fuer den Bau |
|---|---|---|---|
| Figur (`lib/figur.js`) | Kein Konflikt. Gang braucht die Figur nie; `startGang` beendet nur Faktionsarbeit fuer DIESE Faktion (`PlayerObjectGangMethods.ts:56-59`), im V2 nie aktiv | Quelle | `needsFigure: "none"` |
| RAM | Minimalregler 1,6 + createGang 1 + getMemberNames 1 + getGangInformation 2 + getMemberInformation 2 + canRecruitMember 1 + recruitMember 2 + setMemberTask 2 + getAscensionResult 2 + ascendMember 4 = **18,6 GB**; nextUpdate, getBonusTime, inGang, formulas.gang je 0 (`RamCostGenerator.ts:274-301,725-731`). home 21:17: 4.096 GB, davon 872 GB share.js | Spielstand 21:17 | Kein Engpass ab ~h2; im Kaltstart (home 128 GB mit SF9) Prioritaet hinter blade/bn4rep |
| Geld | Regler ohne Ausruestung braucht keins. Aber der Kaufplaner haelt Geld bis zum Tor: `augRuecklage` summiert jedes verdiente Stueck einzeln bis 10x Konto - mit ~40 verdienten Gang-Stuecken sperrt das bn4net, homegrow, hashes, hacknet fuer den ganzen Zyklus | `lib/endspurt.js:335-359`, `bn4rep.js:1817-1819` | Ruecklage = Kosten der geplanten Runde (mit 1,9^i), nicht Summe aller verdienten |
| bn4rep Spenden | Spende an die Gang-Faktion wirft nicht, gibt false (`Singularity.ts:903-906`); `:1677`, `:1788` -> `continue`, `:2414` faellt durch. Aber Zielwahl `:2129-2160` und `:2398` halten die Gang-Faktion ab Favor 150 fuer spendenfaehig, und `spendenFaktion` `:1157-1167` zaehlt sie einmal als Spendenrecht-Grund | Quelle | Gang-Faktion aus "spendenfaehig" nehmen (klein, im V2 nur Anzeige/Ausloeser) |
| sleeve.js | `setToFactionWork` zur Gang-Faktion wirft (`NetscriptFunctions/Sleeve.ts:166-170`), `src/sleeve.js:486` faengt mit `break` und nimmt die naechste Faktion | Quelle | nichts |
| Einbau | Gang bleibt, Faktion wird neu beigetreten, Ruf 0 + Favor, Aufstiegspunkte x0,95 (`Prestige.ts:130-143`); Mitglieder behalten ihre Aufgaben, die Luecke bis zum Neustart von gang.js kostet nichts | Quelle | gang.js in die Registry, damit der Kern ihn nach `boot.js` startet |
| Sprung | Gang weg (`PlayerObjectGeneralMethods.ts:157`); in BN3 scheitert `createGang` (SF2.1 da, Karma > -54.000) | Quelle | Gate per Registry `knoten: [2]` (Daten) und `createGang`-Rueckgabe, keine 2 im Code (ENTSCHIEDEN "Kampfknoten-Bedingung") |
| Offline | Gang holt **25-fach** nach (10 Zyklen normal je 10 Takte, 25 je Takt mit Vorrat), Bladeburner 5-fach. 6,73 h offline = 17 min Gang, 101 min BB | Abschnitt 2 | **Neues Risiko:** Das Tor oeffnet nach einer Offline-Nacht typischerweise direkt nach dem Laden (BN2-2; BN2.1: Laden 17:16, Einbau 19:01). Kauft der Planer sofort, fehlt der Ruf aus dem noch nicht nachgeholten Gang-Vorrat. Vor dem Torkauf `ns.gang.getBonusTime()` (0 GB) < 60 s abwarten |
| Gedrosselter Tab | Ein Takt je Minute (`engine.tsx:411-437`) -> Gang verarbeitet 25 von 300 Zyklen, BB 5 von 60 s: beide 1/12, Rest wird Vorrat | Quelle, Memory browser-tab-drosselung | Kein neues Risiko gegenueber BB. Regler mit `await ns.gang.nextUpdate()` statt `ns.sleep`, sonst sieht er im Nachholen 250 s Gang-Zeit je 10 s |
| Territorium | Ohne `setTerritoryWarfare(true)` bleibt `territoryClashChance` 0 (`Gang.ts:84-85,210-216`), die eigene Gang wird in keinem Clash gezogen, Tod nur bei Aufgabe "Territory Warfare" (`:281-303`). Die Sim-Annahme 1/7 fest ist damit exakt | Quelle | Warfare im ersten Bau nie einschalten |
| Spielstand-Migration | Keine umbenannten Felder; der Planer sollte zustandslos je Runde rechnen | - | nichts |
| ENTSCHIEDEN | Keine Zeile beruehrt. "Augmentierungsrunde vor Tor 1 verworfen" bleibt (Gruendung frueheste h~2, Runde nach 8+ h, Tor 1 bei < 0,85 h). "Nie eine Nummer im Code" gilt fuer gang.js | `BAUSTELLEN.md:20-33` | siehe Sprung |
| Fruehere Entscheidung | `AUFTRAG-BAU-2026-09.md:346` "Nicht bauen: Gang ... kein Ertrag fuer den Ausgang". Die neue Fundstelle (Kampf-Augs der Gang-Faktion heben die Black-Op-Competence) widerlegt genau diese Begruendung; Eric hat am 03.10. 18:15 bedingt freigegeben (STAND.md) | - | tragfaehig, aber nur zusammen mit dem Kaufplaner |

## 5. Bauvorgabe

Harte Reihenfolge: **Paket 0 live und nachgewiesen, bevor `createGang` je laufen
kann.** Paket 1 vor oder mit Paket 2. G02 (Hacknet-Stuecke, HASH-4) gehoert dazu:
die fuenf Hacknet-Stuecke (Ruf 1.875-12.500) belegen sonst die ersten
Warteschlangenplaetze.

### Paket 0 - TRP-Falle (GANG-2)

- `src/bn4rep.js` an der Kandidatensammlung (`:668-678`): eigener Schutz
  `if (aug === EXIT_KEY && !v1Positiv) continue;` mit
  `v1Positiv = Marke in data/verfahren.txt ist "V1"/"V1b" UND Knoten == currentNode`,
  im Zweifel false. Nicht nur `hackaugs.js:347` aendern (Loch bei fehlender Marke).
- `src/bn4rep.js:1207`: `ausgangSteht` nur, wenn `v1Positiv` UND TRP eingebaut. So
  sperrt ein trotzdem eingebautes TRP (Handkauf, alte Version) im V2 nicht jeden
  weiteren Einbau. `redPillWartet` (`:1272`) ebenso an `v1Positiv` binden.
- Tests (`tools/test-bn4rep-ebene2.js`, echter Hauptlauf):
  - S1 Knoten 2, `verfahren.txt` "V2 2 1", Faktion Slum Snakes bietet TRP, Ruf 3 Mio,
    inBladeburner -> **kein** `purchaseAugmentation(*, "The Red Pill")`.
    ROT gegen den heutigen Stand (`BN4REP_SRC=<alt>`), GRUEN neu.
  - S2 wie S1, aber ohne `data/verfahren.txt` -> kein TRP-Kauf. ROT heute und ROT
    mit reinem hackaugs-Fix, GRUEN neu.
  - S3 Knoten 2, V2, TRP eingebaut, Sperre offen, 3 wartende Kampfstuecke ->
    Einbau erfolgt. ROT heute, GRUEN neu.
  - Gegenprobe: die BN12-V1-Szenarien `:619-773` (Daedalus, TRP wartend) bleiben GRUEN.
  - `tools/test-kampfaugs.js:44` bleibt GRUEN, wenn hackaugs unveraendert bleibt;
    wird hackaugs mitgeaendert, ist :44 bewusst umzudrehen (es kodiert die alte
    Annahme).
- Abnahme live: Hash von `bn4rep.js` im Spiel = Repo, `data/bn4rep.json` frisch,
  `tools/test-alles.js` gruen. Erst dann Paket 2 zuenden.

### Paket 1 - Kauf am Tor (AUG-4, begrenzt auf V2 mit Gang)

- `src/bn4rep.js:1737-1745`: Ist `nurKampfStuecke && ns.gang.inGang()` (0 GB) und
  `gesperrt` (`:945-1036`) oder `einbauErlaubt` nein, **gar nichts kaufen** - fuer
  alle Faktionen, sonst verteuern BB-Stuecke die Gang-Runde.
- Tor offen und `ns.gang.getBonusTime() < 60000`: Runde mit einer neuen reinen
  Funktion `waehleTorRunde(kandidaten, geld, besitz)` (z. B. in `lib/einbau.js`):
  gierig nach Zuwachs log(Competence) je Mehrkosten, Voraussetzungen mitnehmen,
  dann teuerste zuerst mit Vorgaenger davor (wie `tools/audit/gang-round.mjs`
  `bestRound`/`orderAndCost`). Gewichte der naechsten offenen Black Op aus
  `src/lib/blackops.json`; BB-Stuecke mit `bladeburner_success_chance` gehen
  multiplikativ ein. Danach baut die naechste Runde regulaer ein (`:1370`).
- `data/geldbedarf.txt` = Kosten der geplanten Runde mit 1,9^i, nicht die Summe
  aller verdienten Stuecke.
- Tests: Einheitstest der reinen Funktion gegen `bestRound` bei 30/48/100 Mrd
  (gleiche Menge, gleiche Reihenfolge, Kosten <= Budget). ebene2: S4 Gang, Sperre
  aktiv, Ruf 1,5 Mio, 60 Mrd -> 0 Kaeufe (ROT heute: Neurotrainer I wird gekauft).
  S5 Tor offen -> erster Kauf = erstes Planstueck (SPTN-97 bzw. NEMEAN). S6 Tor offen,
  getBonusTime 10 min -> kein Kauf. Ohne Gang: alle bestehenden Szenarien GRUEN
  (Verhalten unveraendert).

### Paket 2 - gang.js

- Neue Datei `src/gang.js`, Registry-Eintrag: `verfahren "V2"`, `knoten [2]`,
  `phase "normal"`, `needsFigure "none"`, `priority` hinter blade.js/bn4rep.js,
  `ramBaseGb` gemessen (Soll ~18,6-20), `telemetryFile "data/gang.json"`,
  `freshnessMs 600000`, `precondition.requiresFile "data/gang-an.txt"` als
  Schalter (Loeschen = Gang-Steuerung aus; die Gang selbst laeuft mit den zuletzt
  gesetzten Aufgaben weiter).
- Ablauf: `inGang()` (0 GB) zuerst, jede andere Gang-Funktion wirft sonst. Nicht
  in Gang: unter den beigetretenen Kampf-Gang-Faktionen (Slum Snakes, Tetrads,
  The Syndicate, The Dark Army, Speakers for the Dead; nie NiteSec/Black Hand) die
  mit dem kleinsten Ruf -> `createGang` genau einmal, Ergebnis loggen. Live 21:17:
  Slum Snakes 0, Tetrads 0, The Syndicate 2.082 -> Slum Snakes.
- Schleife auf `await ns.gang.nextUpdate()`. Regler wie Sim "bester Regler"
  (Training bis gewichtete Stufe 500, Aufstieg 1,3 im Training / 2 in Arbeit,
  Terrorism, Vigilante nur bei wanted > 1 und Abzug < 0,95). **Kein**
  `setTerritoryWarfare(true)`, **kein** `purchaseEquipment` im ersten Bau.
- Fehler nie still schlucken: jeder `catch` zaehlt in `data/gang.json.fehler` und
  loggt (Lehre aus den toten Black-Op-Aufrufen); `tools/lib/scope-tot.js` ueber
  gang.js.
- Tests: `tools/test-gang.js` mit Mock `ns.gang` - nicht Mitglied -> kein
  createGang; Mitglied Slum Snakes + The Syndicate -> createGang("Slum Snakes")
  einmal; Rekrutieren bei `canRecruitMember`; kein Warfare-, kein
  Ausruestungsaufruf in 1.000 Takten; Fehlerzaehler steigt bei geworfenem Aufruf.

### Abbruchkriterien live

| Wann | Gruen | Rot -> Massnahme |
|---|---|---|
| vor dem Zuenden | Paket 0 im Spiel, S1-S3 gruen | sonst kein `data/gang-an.txt` |
| +10 min | `data/gang.json` frisch, `inGang` true, 3 Mitglieder, createGang 1x im Log | Schalter weg, Log lesen |
| +2 h | >= 6 Mitglieder, Respekt steigt, Abzug >= 0,9, Fehler 0 | Abzug < 0,5 ueber 30 min oder Fehler > 0 -> Schalter weg |
| bis zum Tor | bn4rep-Log ohne "GEKAUFT" bei aktiver Sperre | Kauf trotz Sperre -> Paket 1 zurueck |
| am Tor | TRP nie in der Warteschlange; erstes Stueck = Planstueck; Kosten <= Konto; Einbau binnen 2 Runden | TRP in der Schlange -> sofort melden (nicht entfernbar; Paket-0-Teil `ausgangSteht` haelt den Schaden klein) |
| nach dem Einbau | gang.js binnen 5 min neu gestartet, Favor Slum Snakes > 0 | Registry/Prioritaet pruefen |

## 6. Rechnungen und Eichung

Ausgabe `node tools/audit/verify-g01-betrieb.mjs` (Laufzeit ~10 s):

- **Abschnitt 1, Eichung Preisformel und Kaufreihenfolge** (`base x 1,9^i` ueber die
  Warteschlange in Speicherreihenfolge gegen `moneySourceA.augmentations`):
  17:17 q=11 **Soll 28,4048 / Ist 28,4048 Mrd**; 19:01 q=11 **Soll 20,3985 / Ist
  20,3985 Mrd**. Damit ist die Preistreppe, auf der Abschnitt 4/6/8 rechnen,
  geeicht, und die Warteschlange ist die Kaufreihenfolge.
- **Abschnitt 2**: Konstanten aus `Gang/data/Constants.ts` (10/25) gelesen, kein
  Modell.
- **Abschnitt 7**: Torzeit aus der Live-Uhr; Gegenprobe `einbau.json`
  `kampfZuFrueh: true` bei 1.082,7 < 1.092,5 h - konsistent.
- **Ungeeicht**: Rufkurve (gang-sim, Einzelformeln vom Erstpruefer 86.360-fach gegen
  den Originalcode geprueft, Dynamik ohne echte Gang) und Competence (Stufe x Mult,
  Daedalus-Gewichte). Die Verhaeltnisse heute/am Tor/optimal haengen an der Rufkurve
  kaum: beide Regler liefern dieselben Zyklus-1-Werte, weil das Geld bindet.

## 7. Was gegen meine Einwaende spricht

- Auch mit der heutigen Schleife ist die Gang nicht wertlos: x2,0 nach zwei, x2,6-2,9
  nach drei Zyklen gegen ~x1 ohne Gang. In BN2.2/2.3 (~40 h Lauf) bleibt also ein
  Ertrag, nur weit unter 10-25 h und spaet.
- Die Kaufaufschub-Regel ist billig (eine Bedingung an `:1737`) und holt in Zyklus 1
  zwei Drittel des Optimums; der volle Planer ist Feinarbeit darauf.
- Alle uebrigen Betriebsrisiken (Figur, RAM, Sleeves, Spenden, Einbau, Sprung,
  Drosselung, Territorium) sind gutartig oder mit einer Zeile abgefangen.
- Das Geld-Budget (4,09 Mrd/h) ist brutto; Server, Krankenhaus und BB-Stuecke
  verbrauchen einen Teil. Das trifft alle drei Kaufregeln, die optimale am
  wenigsten (sie waehlt nach Competence je Dollar).
