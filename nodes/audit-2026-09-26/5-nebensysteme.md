# Audit 5 – Nebensysteme (Sleeves, Hacknet/Hashes, Kontrakte, Graft, Boerse, Darkweb, Share, RAM)

Stand: Spielstand `LIVE_197f4d61481686_BN5L2_2026-09-26T17-19_pre-install` (BN5.2, V1, 22 min nach dem letzten Einbau, 16,7 h im Knoten).
Rechenskripte (alle gegen den Spielstand geeicht) liegen in diesem Ordner: `hn.js` (Hacknet-Formeln, reproduziert `hashRate` beider Server bis auf die letzte Stelle: 0.001076360294750541 / 0.0005029721003507202), `hsim.js` (Hash-Verwendung), `sl.js` (Sleeve-Verbrechen und Ruf; Verbrechensgeld 3 × 3.750 $/s gegen gemessen 14.355.000 $ / 1.318,6 s = 10.887 $/s → 96,8 %, Rest = Neusetzen alle 60 s), `stk.js` (Boersen-Obergrenze).

Lage, auf der alles aufbaut (gemessen im Spielstand):
- Einkommen Hacking seit Einbau: 1.017 Mrd in 1.318,6 s = **771 Mio $/s**; bn4net erwartet 792 Mio/s allein aus `the-hub` (fraction 0,3), 187 Mio/s phantasy, 78 Mio/s max-hardware.
- Netz-RAM 91.892 GB, davon belegt 42.062 → **54 % frei**, 46.542 GB frei allein auf home (5 Kerne). bn4net meldet `brachAnteil` 0,467.
- Engpass des Knotens: Red Pill = 2,5 Mio Daedalus-Ruf; Daedalus-Ruf 1.529, Favor 0. Spieler-Hackingarbeit gerechnet 57,16 Ruf/s (share-Bonus 1,3324) → **12,1 h** reine Arbeit. w0r1d_d43m0n verlangt 4.500 (BN5 WorldDaemonDifficulty 1,5), Spieler steht bei 2.871.
- Einbauzyklen in BN5 (backups/INDEX.tsv, pre-install): 3,0 h / 2,4 h / 2,1 h / 0,8 h / 2,9 h / 2,3 h / 1,4 h / 0,3 h / 0,4 h.
- Sleeves: 3 Stueck, Schock 69,3–69,5, **Sync 1**, Werte hack 1 / str 1 / def 1 / dex 91 / agi 91 / cha 1, alle auf Shoplift (`grund: hackingweg`).
- Hacknet: 3 Server (L2/L2/L1, 1 Kern, 1–2 GB), zusammen 0,0026 Hashes/s, Verkauf = 650 $/s. Hash-Upgrades seit Einbau: alle 0.

---

## 1. Hashes gehen im V1-Knoten in "Sell for Money" statt in "Increase Maximum Money" des Stapelziels – und deshalb wird Hacknet ausserhalb BN9 gar nicht ausgebaut

**Bot:** `src/hashes.js:93` und `:233` (ausserhalb V2 immer `VERKAUF`); `src/hacknet.js:102-107` (Ausbau nur `knoten === 9`, Begruendung "anderswo bringt Hacking das Tausendfache, und die Stufen zahlen sich nie zurueck").
**Spiel:** `Hacknet/data/HashUpgradesMetadata.tsx:49-60` (Increase Maximum Money: +2 % moneyMax je Stufe, costPerLevel 50), `Hacknet/HashUpgrade.ts:80-81` (Stufe L kostet 50·(L+1)), `Hacknet/HacknetHelpers.tsx:500-519` → `Server/Server.ts:126-134` (`moneyMax *= 1.02`, Softcap erst ueber 10e12), `Hacknet/formulas/HacknetServers.ts:4-17,19-...` (Rate/Kosten), `PersonObjects/Player/PlayerObjectGeneralMethods.ts:130-131` (Server und Upgrades fallen beim Einbau).

**Was falsch ist.** Die Begruendung in hacknet.js stimmt nur fuer den Verkauf: 4 Hashes = 1 Mio. Mit Verkauf zahlt sich Hacknet in BN5 tatsaechlich nie im Zyklus zurueck (gerechnet, `hn.js`: 1 Mrd Einsatz → 0,49 H/s → Amortisation 7.864 s; 10 Mrd → 28.725 s). Die Alternative "Increase Maximum Money" auf das Stapelziel wurde nie gerechnet: +2 % moneyMax heisst bei diesem Batcher +2 % Ertrag dieses Ziels, weil
- die Beute je Stapel `echt * s.moneyMax * chanceMin` ist (bn4net.js:2721) und moneyMax jede Runde frisch gelesen wird,
- die Grow-Faeden relativ sind (gleicher RAM) und mit `GROW_MARGIN = 1.15` (bn4net.js:2541) ueberdimensioniert – ein 2-%-Sprung wird im naechsten Stapel aufgefuellt,
- die Drain-Schwelle `max(0.05,(1-f)*0.5)` (bn4net.js:2618) bei f = 0,3 bei 35 % liegt; ein 2-%-Loch loest keinen Neuaufbau aus,
- RAM nicht der Engpass ist (54 % frei).
"Reduce Minimum Security" bringt hier praktisch nichts: bei freiem RAM aendert hoeheres pMin nur die Fadenzahl, nicht die Beute; kuerzere Laufzeiten aendern den Takt (1 Stapel je 4·GAP) nicht.

**Rechnung** (`hsim.js`, Ziel the-hub mit 792 Mio/s, Hacknet gierig nach Hashrate je $ gekauft, Stufen sofort gekauft, Kostenmultiplikator 0,380 und Hacknet-Mult 2,515·0,2 aus dem Spielstand):

| Einsatz | Hashrate | Restzeit 1 h: Stufen / Netto | Restzeit 2 h: Stufen / Netto | Verkauf netto (2 h) |
|---|---|---|---|---|
| 1 Mrd | 0,49 H/s | 7 / +276 Mrd | 11 / +854 Mrd | −0,1 Mrd |
| 10 Mrd | 1,38 H/s | 13 / +515 Mrd | 19 / +1.595 Mrd | −7,4 Mrd |
| 30 Mrd | 2,20 H/s | 17 / +668 Mrd | 24 / +2.116 Mrd | −26 Mrd |

Gegen das Zykluseinkommen (~1,06 Mrd/s erwartet): 1 h Rest mit 10 Mrd Einsatz = +515 Mrd auf ~3,8 Bio = **+13,5 %**; 2 h Rest mit 30 Mrd = +2,1 Bio auf ~7,6 Bio = **+28 %**. Bei nur 200 Mio/s Zielertrag (Szenario "anderes Hauptziel") bleiben es 1 h/10 Mrd → +123 Mrd. Zum Vergleich: 10 Mrd sind 13 s Einkommen; bei 22 min nach dem Einbau lagen 116 Mrd auf dem Konto.

**Einschraenkungen, ehrlich:** (a) Der Wert haengt am Ziel: wechselt bn4net im Zyklus das Hauptziel, sind die Stufen auf dem alten verloren (die Stufenkosten laufen global weiter). (b) Speicher: Stufe L braucht 50·(L+1) Hashes am Stueck; ein Server mit Cache 1 fasst 64 – Cache-Ausbau (10 Mio · 1,85^(c−1), ohne Kostenmultiplikator) muss mit, kostet aber < 0,2 Mrd je Server bis Cache 5. (c) Geld ist in BN5 nicht linear Fortschritt: es kauft Augs (×2 in BN5), NeuroFlux-Stufen (Hacking-Mult Richtung 4.500) und erst ab Daedalus-Favor 150 Spenden-Ruf. (d) `erwartetProS` ist die Modellrate von bn4net; die gemessene Gesamtrate 771 Mio/s (mit Anlauf) passt dazu.

**Konfidenz:** Mechanik belegt (Formeln + Batcher-Code), Groessenordnung plausibel.
**Fix:** In V1-Knoten hashes.js auf "Increase Maximum Money" fuer das Ziel mit der hoechsten `erwartetProS` aus data/bn4net.json umstellen (Verkauf nur, solange das Konto die ersten Rechner/Programme braucht), und hacknet.js den Ausbau ausserhalb BN8 mit dieser Bewertung erlauben (Grenzertrag je $ gegen Restzeit bis zum erwarteten Einbau, Cache mitziehen).

---

## 2. share-Deckel 12 % des Netz-RAM, obwohl 54 % brachliegen – Ruf ist der Engpass

**Bot:** `src/bn4net.js:2058-2061` (`SHARE_ANTEIL = 0.12`), Arbeiter `src/worker/share.js` / `src/share.js`.
**Spiel:** `NetworkShare/Share.ts:21-24,41-47` (Leistung = Faeden · intBonus(int,2) · Kernbonus; Bonus = 1 + ln(Leistung)/25), `Server/ServerHelpers.ts:315-318` (Kernbonus 1+(k−1)/16), `PersonObjects/formulas/reputation.ts:16-24`.

**Was suboptimal ist.** Laufend: 2.756 share-Faeden auf home (10,8 TB). Frei: 46,5 TB auf home. Der Deckel ist ein fester Anteil vom Gesamt-RAM statt "was die Ziele nicht aufnehmen". Der Kommentar bei bn4net.js:2037-2052 argumentiert selbst, dass brachliegender RAM "an niemanden" verschenkt wird – dann aber mit 12 % statt dem tatsaechlich Freien.

**Rechnung** (Intelligenz 146, home 5 Kerne): Bonus heute 1,3324. +10.000 Faeden (39 TB, passt in den freien home-RAM) → 1,3937 = **+4,6 % auf jeden Ruf**. Red Pill bei 57,16 Ruf/s: 12,14 h → 11,58 h, also **−34 min** reine Arbeitszeit am Engpass des Knotens.

**Konfidenz:** plausibel (Formel belegt; ob der RAM ueber den ganzen Zyklus frei bleibt, ist eine Momentaufnahme 22 min nach Einbau).
**Fix:** Den share-Deckel an `ueberschussGb` koppeln (freier RAM minus Reserve, abzueglich dessen, was die Stapelziele laut `kapGesamtGb` noch aufnehmen) statt an 12 % von ramTotal; bn4net raeumt share ohnehin je Runde neu.

---

## 3. Sleeves im V1-Knoten: kein Hebel – Shoplift ist nicht das Beste, aber nichts ist relevant

**Bot:** `src/sleeve.js:105-117` (`hackingweg()` → kein Gym), `:396` (`sleeveMin < 40 ? "Shoplift" : "Mug"`, sleeveMin = min(str,def,dex,agi) aus `:130`), `:397` (Verbrechen jede Runde neu gesetzt).
**Spiel:** `PersonObjects/Sleeve/Work/Work.ts:17-25` (Spieler bekommt Erfahrung × sync/100), `SleeveCrimeWork.ts:91-116` (Geld NICHT schockskaliert, `scaleWorkStats(...,false)`, Erfahrung schon), `SleeveFactionWork.ts:179-181` (Ruf × shockBonus), `Sleeve.ts:263-275` (passiver Schockabbau 0,0001·intBonus je Zyklus), `SleeveRecoveryWork.ts:9-13`, `Crime/Crime.ts:120-136`, `Crimes.ts`.

**Gerechnet fuer den Ist-Zustand** (`sl.js`, Sleeve int 24/37/31, Schock 69,4, Sync 1):

| Taetigkeit je Sleeve | Ertrag | Anteil am Spieler |
|---|---|---|
| Mug (Chance 0,967–0,977) | 4.350–4.395 $/s | 0,0006 % von 771 Mio/s |
| Shoplift (Chance 1,0) | 3.750 $/s | 0,0005 % |
| Rob Store / Larceny | 3.333 / 2.557 $/s | – |
| Daedalus Field Work | 0,057–0,063 Ruf/s | 0,1 % von 57,16 Ruf/s |
| Daedalus Hacking Work | 0,019–0,029 Ruf/s | 0,05 % |
| Schock-Erholung 69 → 0 | 12,6 h (passiv 37,8 h) | danach Ruf ×3,3 → immer noch 0,33 % |

Was falsch ist: Die Schwelle nimmt das Minimum ueber Staerke/Verteidigung, obwohl Mug zu 75 % aus str/dex gewichtet und dex 91 die Chance schon auf 0,97 hebt. Mug bringt jetzt **+16 %** (4.350 gegen 3.750 $/s). Zusaetzlich bricht das Neusetzen alle 60 s das laufende Verbrechen ab (gemessen −3,2 %). **In absoluten Zahlen: +1.800 $/s fuer alle drei Sleeves – bedeutungslos.** Auch jede andere Belegung (Ruf, Sync, Schock) bleibt unter 0,4 % des Spielerbeitrags, und nichts davon ueberlebt den Knotenwechsel ausser `memory` (1e12 $ je Punkt, `Sleeve.ts:197-211`).

**Konfidenz:** belegt (geeicht auf 96,8 % gegen die Geldquelle "sleeves").
**Fix:** Keinen Aufwand treiben. Falls die Zeile ohnehin angefasst wird: Wahl nach `successRate × money / time` statt nach `min(str,def,dex,agi)`, und im Verbrechenszweig wie bei den Kontrakten `getTask` pruefen, bevor neu gesetzt wird.

---

## 4. Boerse im V1-Knoten ungenutzt – moeglicher, aber unkalibrierter Nebenertrag

**Bot:** `src/registry.json` Eintrag `boerse.js` (`knoten: [8]`); `invest.js` hat keinen Registry-Eintrag (tot).
**Spiel:** `StockMarket/StockMarket.ts:239-316` (Tick alle 6 s, Kurs ×(1±av), av bis mv %), `StockMarketHelpers.ts:6,70-109` (Kauf senkt nur den Ausblick, 0,006 je shareTxForMovement, keine Kursbewegung), `Prestige.ts:166-170` (Markt wird bei JEDEM Einbau neu angelegt – Depot vorher verkaufen), `PlayerObjectGeneralMethods.ts:163-166` (Zugaenge fallen erst beim Knotenwechsel), `StockMarketCosts.ts` (BN5 ohne 4S-Aufschlag).

**Rechnung** (`stk.js`, InitStockMetadata): Die ideale Long-Rendite ueber alle 33 Aktien bei vollem Bestand (5,4 Bio Kapital) waere 4,77 Mrd je Tick = 2,86 Bio/h. Beste Einzelaktie (ECorp, mv 0,45 %, Ausblick 69 %): 0,086 % je Tick. Mit dem mitten im Zyklus liegenden Kapital (~100 Mrd bei 22 min) waeren das grob 30–50 Mrd/h = **1–1,5 % des Hacking-Einkommens**, Zugang einmalig ~31 Mrd je Knoten. Nicht eingerechnet: Spread (0,1–0,5 %), Ausblickwechsel, Leerverkauf fehlt (kein SF8).

**Konfidenz:** plausibel, Groesse unkalibriert. Klar kleiner als Befund 1.
**Fix:** Erst messen: boerse.js im Trockenmodus in BN5 mitlaufen lassen (Buchgewinn auf das freie Konto), vor jedem Einbau zwingend verkaufen; nur bei > 2 % Mehrertrag scharf schalten.

---

## 5. Grafting: im V1-Knoten weder bewertet noch abgesichert

**Bot:** `src/graftplan.json` (39 Eintraege, ausschliesslich Kampf/Bladeburner), Registry `graftauto.js` (`verfahren: "alle"`, `knoten: "alle"`, einzige Sperre `requiresFile: graftplan.json`); die Datei steht in `data/nicht-schieben.txt` und liegt derzeit nicht auf home.
**Spiel:** `PersonObjects/Grafting/GraftableAugmentation.ts:21-31` (Preis = baseCost × 3, OHNE BN-Kostenmultiplikator und OHNE 1,9^n-Warteschlange; Zeit = (1 h·log2(Summe Mults) + 30 min)/2), `Constants.ts:96,104` (Entropie 0,98 je Graft).

**Was offen ist.** (a) Sobald jemand graftplan.json von Hand ins Spiel schiebt, graftet graftauto auch im V1-Knoten Kampf-Augs – ohne Nutzen, mit Entropie −2 % auf alle Multiplikatoren je Stueck, und die Figur steht waehrend des Grafts nicht fuer Faktionsarbeit zur Verfuegung (bei 57 Ruf/s rund 170.000 Daedalus-Ruf je 50-min-Graft). (b) Umgekehrt ist Grafting als V1-Hebel nie gerechnet: In BN5 kostet ein gekauftes Aug baseCost × 2 × 1,9^k, ein gegraftetes baseCost × 3 ohne Rufbedarf und ohne die Warteschlange zu verteuern; ab dem zweiten Aug in der Warteschlange ist Graften billiger. Dem steht Figurenzeit am Engpass Ruf gegenueber.

**Konfidenz:** (a) belegt (Registry + Plan), (b) plausibel, nicht gerechnet.
**Fix:** graftauto in der Registry auf `verfahren: "V2"` setzen, solange der Plan nur Kampf-Augs kennt; die V1-Frage (Hacking-Augs graften gegen Warteschlange 1,9^k gegen Figurenzeit) als eigene Rechnung.

---

## 6. hacknet.js kauft im V1-Knoten nach jedem Einbau einen wertlosen Server und laeuft danach leer

**Bot:** `src/hacknet.js:60-64` (erster Server im Server-Modus in JEDEM Knoten), dann `:107` Leerlauf; `src/hashes.js` verkauft den Ertrag.
**Spiel:** `Hacknet/formulas/HacknetServers.ts` (L1/1 GB/1 Kern = 0,0005 H/s bei Mult 2,515·0,2).

**Folge:** 19.000 $ je Einbau fuer 0,0005 H/s = 125 $/s Verkaufswert; 10,45 + 5,95 GB RAM belegt. Harmlos (RAM ist frei), aber genau dieser Pfad ist der Ansatzpunkt fuer Befund 1 – solange Befund 1 nicht gebaut ist, koennten beide Werkzeuge im V1-Knoten ganz aus.
**Konfidenz:** belegt. **Fix:** Mit Befund 1 zusammen umbauen, nicht einzeln.

---

## Geprueft, in Ordnung

- **Coding Contracts:** Protokoll im Spielstand: 277 geloest, 0 abgelehnt/fehlgeschlagen, 29 Typen tatsaechlich gesehen; `lib/loeser.js` deckt alle 30 Typen aus `CodingContract/Enums.ts` ab, inklusive Vigenère. Gegenprobe = Spiel-`solver` vor jedem Absenden. Belohnung ist nicht waehlbar: Typ wird bei der Erzeugung gewuerfelt (`ContractGenerator.ts:179-189`), Ruf geht an eine zufaellige Hacking-Faktion (`PlayerObjectGeneralMethods.ts:514-523`); ohne Job wird Firmenruf zu Faktionsruf (`:540-552`, `jobs` ist leer). Wert in V1 unbedeutend (Geld 25 Mio × Schwierigkeit, Ruf ~833 × Schwierigkeit); 5-min-Takt verliert bei 0,8–3-h-Zyklen praktisch nichts.
- **Hash-Verkaufspreis** "4 Hashes = 1 Mio, konstant" stimmt (`HashUpgradesMetadata.tsx:9-17`, fester `cost`). BN8-Sperre in hashes.js:136 richtig (HacknetNodeMoney 0).
- **"Generate Coding Contract"** (25·(L+1) Hashes) schlaegt den Verkauf nur bei den ersten Stufen und verliert klar gegen Befund 1 – nicht weiter verfolgen.
- **Programme/Darkweb:** bn4life.js:251-296 kauft alle 20 s per Singularity in aufsteigender Preisfolge, mit Aug-Ruecklage; im Spielstand sind alle fuenf Portknacker da. Formulas.exe kommt mit SF5 gratis nach jedem Einbau (`Prestige.ts:92-94`) – kein Kauf noetig. darkweb.js (DOM) ist daneben redundant, laeuft aber nur im Kaltstart mit 2,65 GB.
- **Karma:** in V1 ohne Belang (keine Gang auf der Route), wird beim Knotenwechsel ohnehin genullt (`PlayerObjectGeneralMethods.ts:145`).
- **RAM der Nebenskripte:** sleeve 27,9 + contracts 17,6 + hacknet 10,4 + hashes 6,0 + popups 4,0 GB = 66 GB bei 91,9 TB Netz und 54 % Leerstand – im Dauerbetrieb keine Opportunitaetskosten. Der Kaltstart ist ueber die Registry-Phasen (sleevecrime 7,65, cdump/csolve, darkweb) abgedeckt.
- **Sleeve-Geld nicht schockskaliert** (`SleeveCrimeWork.ts:91-93`, `WorkStats.ts scaleWorkStats(..., false)`): die Kommentare in sleeve.js/sleevecrime.js stimmen; Rechnung auf 96,8 % gegen die Geldquelle "sleeves" geeicht.
- **hacknet.js BN9-Kostenformeln** in den Kommentaren stimmen mit `HacknetServers.ts` ueberein; meine Nachbildung reproduziert die Hashraten des Spielstands exakt.
- **punish.js / popups.js:** beruehren die V1-Oekonomie nicht (Trockenmodus-Sperre, Escape nur bei offenem Dialog).

Nebenbeobachtung ausserhalb meines Winkels: `data/rep-ziel.txt` schaetzt die Red Pill auf 1.306.132 s (363 h), waehrend die Figur fuer The Black Hand arbeitet; bei ausschliesslicher Daedalus-Arbeit waeren es rechnerisch 12,1 h. Das gehoert zur Rufstrategie (bn4rep), sollte dort aber geprueft werden.
