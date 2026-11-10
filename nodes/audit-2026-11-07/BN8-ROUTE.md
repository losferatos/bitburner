# BN8-Route: was den Knoten begrenzt und wie er am schnellsten faellt (10.11.2026)

Auftrag (Eric, 10.11.): "Nur noch die 3 Level des BN8 offen: optimiere was das
Zeug haelt." Diese Datei haelt die Rechnung fest - fuer die drei Stufen jetzt,
fuer den Gesamtreview danach und fuer Lauf 2 (2027).

Rechner: `node tools/audit/bn8-route.mjs` (laufende Stufe) bzw. `--frisch`
(neue Stufe ab 250 Mio). Er benutzt `src/lib/bn8plan.js` - denselben Code, mit
dem der Bot plant - und die Vermoegenskurven aus `tools/audit/boerse-kurve.mjs`
(Handelsregel `src/lib/handel.js` gegen das Marktmodell `boerse-sim.mjs`).

## Was BN8 ausmacht (Spielquellcode, reference/v301/src)

| Tatsache | Beleg | Folge |
|---|---|---|
| Nur die Boerse verdient | BitNode.tsx:770-798 | Vermoegen waechst exponentiell: mit 4S 250 Mio -> 1 Bio in 8,7 h (Median), ohne 4S 15 h |
| Spende ab Favor 0 (`FavorToDonateToFaction: 0`) | BitNode.tsx:782, donation.ts:8-30 | Ruf ist kaeuflich: 1 Ruf = 1e6 / faction_rep Dollar (750.000 $ bei Mult 1,33) |
| Level = floor(m*(32*ln(exp+534,6)-200)) | skill.ts:5-13 | Der MULTIPLIKATOR traegt: Level 2500 braucht bei m 1,52 Exp 1e25, bei m 5 nur 1e10 |
| Einbau setzt Exp, Geld (250 Mio), Faktionen, Backdoors, gekaufte Rechner zurueck | Prestige.ts:56-199 | Jede Runde kostet Stunden; home-RAM und 4S-API bleiben |
| Aug-Preis x (1,9 * 0,93) je wartendem Stueck (SF11.3) | AugmentationHelpers.ts:127-162 | 30 Stueck in einer Runde unbezahlbar (1,77^29), 2 x 15 nicht |
| Daedalus: 30 INSTALLIERTE Stuecke, Hacking 2500, 100 Mrd bar | FactionInfo.tsx:138-146 | Mindestens zwei Einbaurunden vor Daedalus |
| The Red Pill: 2,5 Mio Ruf, Preis 0 | Augmentations.ts:1947 | 1,4-1,9 Bio Spende, je nach Ruf-Mult |
| w0r1d_d43m0n: Hacking 3000, Red Pill installiert | servers.ts:1531, ServerHelpers.ts:314 | Dritte Einbaurunde, danach noch einmal Exp von null |
| Exp je Thread (3+0,3*baseDifficulty)*hacking_exp, grow/weaken immer voll | Hacking.ts:30-40 | joesguns; grow gibt je GB-s 25 % mehr als weaken |
| home R->2R: R*32000*1,58^log2(R) | ServerPurchases.ts:169-185 | 128 -> 32768 GB: 463 Mrd, ueberlebt jeden Einbau |

Erreichbarer Hacking-Mult ohne Megakonzerne/Kampffaktionen: 1,52 (SF + 3 NFG)
x 1,91 (CyberSec, NiteSec, The Black Hand) x 1,99 (BitRunners) = 5,8; mit
Daedalus (Core V3) und NeuroFlux rund 7.

## Die Route (467 Varianten gerechnet, die besten liegen 0,5 h auseinander)

Stand der Rechnung nach der Skeptiker-Runde (die 2 schon wartenden Stuecke sind
eingepreist, Rechner und Bot nutzen dieselben Gewichte): Optimum 30,1 h
(Runde 1 bei 100 Mrd, Runde 2 bei 1,5 Bio); die im Bot festgelegten Schwellen
300 Mrd / 1 Bio liegen bei 30,5 h. Das Optimum ist flach - die Tabelle zeigt
die Bot-Schwellen.

| Runde | Wann | Was | Danach |
|---|---|---|---|
| 1 | 300 Mrd Vermoegen (laufende Stufe: 11,5 h ab jetzt; die 4S-API bei 45 Mrd liegt auf dem Weg) | 15 Stuecke: Hacker-Faktionen ohne BitRunners, dazu S.N.A und ADR-V1 von Tian Di Hui (Ruf-Mult 1,33 -> 1,72) | Hacking-Mult 2,76 |
| 2 | 1 Bio (8,7 h) | 15 Stuecke mit BitRunners (Gen V, Neural Accelerator, Bio-neural), home-RAM bis 32768 GB | 33 Stuecke, Mult 4,9 |
| 3 | Hacking 2500 (4,6 h) -> Daedalus (100 Mrd bar) -> 2,3 Bio (10,2 h) | Spende fuer The Red Pill, Core V2, Neurolink, NeuroFlux | Mult 6,9 |
| Schluss | Hacking 3000 | w0r1d_d43m0n | 0,2 h |

Summe laufende Stufe: **30,5 h Spielzeit ab dem 10.11. 17 Uhr**. Runde 3 ist
vom Geld begrenzt (Red Pill), nicht von der Erfahrung.

Gewichte des Plans (`GEWICHTE` in lib/bn8plan.js): fuer die Zeit bis Level L
gilt d ln t = -(L/(32 m)) d ln m - d ln exp - d ln speed; L/(32 m) liegt bei
L = 2500, m = 5 um 15. Ein Prozent Hacking-Mult ist also fuenfzehnmal so viel
wert wie ein Prozent Exp-Mult.

## Was der Bot dafuer koennen muss

| Hebel | Stand |
|---|---|
| Handelsregel, 4S nach Vermoegen, Bargeld auf Abruf | gebaut 10.11. (1277d5b, 6d0b3e6) |
| Kein Kauf/Einbau im Lauf, Einbau nach Plan | lib/bn8plan.js + bn4rep.js: 2f8fc67, ef8888c, a7099c6 (drei Skeptiker, Mock-Test gegen ein nachgestelltes BN8) |
| Tian Di Hui nach jedem Einbau | be2b34a |
| Reiner XP-Modus (alles RAM an den Ofen), RAM-Kauf nach Budget | 1218a3b, ef8888c (bn4net, homegrow, lib/xpkauf.js); vorher gemessen 0,07 Exp/GB-s, moeglich 0,3-0,5 - Nachmessung im Spiel steht aus |
| home-RAM in Runde 2 und 3 | in der Einbaurunde (bn4rep, bis 32768 GB), dazu laufend aus dem Betriebsgeld (homegrow) |

## Offen / Ideen fuer Stufe 2, 3 und Lauf 2

- **Phase ohne 4S: Kursfilter gebaut (10.11. abends).** Statt Aufwaertsticks im
  30er-Fenster zu zaehlen, fuehrt `lib/handel.js` je Aktie eine Verteilung
  ueber die Vorhersage (Kippen 0,45/75 je Tick, Streuung, Bernoulli-Update).
  Sim, Median bis 45 Mrd ab 250 Mio: 9,6 h statt 12,0 h (48 Seeds); der
  Skeptiker mass mit 96 anderen Seeds 8,4 statt 10,0 h. Verlustrisiko nicht
  schlechter (boerse-ruin), weniger Trades je Stunde. Route mit Bot-Schwellen
  damit 28,9 h statt 30,5 h. Der Gewinn kommt aus der Genauigkeit (halber
  Schaetzfehler), nicht aus schnellerem Drehen. Nicht gebaut, weil ohne
  messbaren Zusatznutzen: Zyklusphase mitschaetzen, Startwerte als Prior.
  Ungetestet: engerer Prior (|s| <= 0,2). Im Spiel noch zu messen.
- **grow statt weaken** im XP-Ofen (25 % mehr Exp je GB-s). Fund beim Bau: grow
  auf einem VOLLEN Ziel hebt die Sicherheit gar nicht (ServerHelpers.ts,
  processSingleServerGrowth: fortify nur, wenn sich das Geld aendert), und in
  BN8 hackt niemand das Ziel leer. Braucht ein neues Arbeiterskript.
- **Fallstrick RAM nach Namen:** ein Feld namens `hack` in einem Modul kostet
  jedes importierende Skript 0,1 GB (tools/test-ram-namen.js faengt es).
- **Darknet promoteStock** (Volatilitaet x2-4, Audit 07.11.): -8 bis -12 h je
  Stufe gerechnet, Aufwand hoch.
- **Kampffaktionen** (The Covenant: SPTN-97 hack x1,15; Illuminati: QLink
  x1,75 fuer 25 Bio) sind in BN8 nicht sinnvoll erreichbar.
- Annahmen der Rechnung, die im Spiel noch zu messen sind: Exp-Rate im reinen
  XP-Modus; Vermoegenskurve mit 4S (Sim: 8,7 h bis 1 Bio).
