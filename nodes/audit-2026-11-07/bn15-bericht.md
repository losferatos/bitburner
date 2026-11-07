# Audit "ungenutzte Spielmechaniken" BN15 - Bericht 07.11.2026 (nur lesend)

Rechenskripte: `...\scratchpad\audit\bn15\chance.js` (Chancenformel nachgebaut, Action.ts:169-196), `rd.js` (Spielstand lesen).
Spielstand: `LIVE_..._BN15L2_2026-11-07T17-45_pre-hotswap`. Live-Telemetrie 17:58.

## Gesamturteil vorweg
Ich habe KEINEN grossen, bisher ungenutzten Hebel gefunden. Die Bladeburner-Schicht (Skills, Overclock, Incite, Infiltrate, Diplomacy, Kammer, Stadtwahl)
ist im Code schon tief begruendet, die Nebengewerke (Hashes, Stanek, Darknet, Gang, Corp) sind belegt abgelehnt oder in BN15 gar nicht moeglich.
Neu und wichtig: **Die Annahme "Kampfwerte sind in V2 kaum der Engpass" (Stanek-Bericht 27.10., nodes/bau-2026-10-27-stanek/BERICHT.md Z.55) gilt fuer BN13/14,
NICHT fuer BN15.** Hier ist die Chance nicht gesaettigt (siehe Eichung), deshalb ist Go in BN15 wertvoller als in BN13 und andere Kampfwert-Hebel
(Gym parallel) sind einen Blick wert.

## Eichung (Rechnen heisst rechnen)
Chancenformel (competence = Summe w*eff^decay * intBonus * Ausdauer * Bevoelkerung * Skill-Mults * Aug-Mult / difficulty*1,045^(L-1)) gegen den Spielstand:
- Raid L6, Ishima, echte Pop: **0,326** berechnet; gemessen aus Spielstand 29 Erfolge/105 Versuche = 0,276 (Mischung aus niedrigeren Stufen), blade.json "chance" 0,573 gilt fuer Retirement (Schaetzbevoelkerung). Groessenordnung stimmt, Eichung NICHT auf 1 % genau (Bevoelkerungsschaetzung, Stufenverlauf unbekannt).
- Typhoon-Schwelle: blade.json boChancen 0,0933 - die Formel liefert mit Black-Op-Difficulty 2000 dieselbe Groessenordnung (Hand: ~5-9 %).
- Go-Bonus-Formel: n=74.000 -> +90,4 % gegen live BN13 +90,6 % (go.json 02.11.). Stimmt.
- BN15-Rangfaktor 0,2 wirkt NUR auf Gewinne (Formulas.ts:13,22,25), Verluste nicht (Formulas.ts:30-42). Folge: Raid-Fehlschlag kostet 2,5*1,1^5 = 4,0 Rang (Log: 3,77/4,21), Erfolg bringt 17,7; Break-even-Chance 18 %. Black Ops: Typhoon +10/-10, Daedalus +8.000/-10.000 - ein Fehlschlag kostet dort MEHR als ein Erfolg bringt.
- Skillpunkt-Kosten x3 (Skill.ts:78), Skills linear: mult = 1 + wert*stufe/100 (Bladeburner.ts:776-786).

## 1. BN15-Multiplikatoren (BitNode.tsx case 15) - wer ist verstaerkt/abgeschwaecht
| Mult | Wert | Nutzt der Bot es richtig? |
|---|---|---|
| Hacking Level/Speed | 0,6 | Hacking ist kein Ausgangsweg; ok |
| Str/Def/Dex/Agi Level | 0,7 | **Kampfwerte 245-332 sind der Engpass der Chance** (Raid 33 %). Hebel: Go, Gym, Augs |
| Charisma Level | 1,1 | Charisma 344, Diplomacy ok |
| BladeburnerRank | 0,2 (nur Gewinne) | bekannt (HASH-RANG-Notiz, blade.js) |
| BladeburnerSkillCost | 3 | bekannt |
| AugmentationMoneyCost | 3 | Geld ist kein Engpass (255 Mrd) |
| Stanek Power 0,7 / Groesse -2 | | abgelehnt, siehe unten |
| GangUniqueAugs 0,3 | | Gang unmoeglich (Karma) |
| CorporationValuation 0,2 / Softcap 0,4 | | Corp ohne Zweck (Geld-Ueberschuss) |
| WorldDaemonDifficulty 2 | | irrelevant (V2) |

## BEFUNDE (sortiert nach geschaetztem Zeitgewinn fuer BN15.2+15.3)

### B1. Go in BN15 (heute gebaut) - bestaetigt, hoechster Einzelhebel
- Mechanik | Go/effects/effect.ts:16-22, 84-88 (Tetrads: strength/defense/dexterity/agility *= effect; bonusPower 0,7, SF14 x2, GoPower 1 in BN15).
- Bot | src/registry.json go.js knoten [14,13,15]; live seit 17:51: **8 Partien, 8 Siege, +15,4 %** in ~7 min (data/go.json 17:58, knoten 15).
- Gewinn | Bonus ueber n: 2.000 -> +21 %, 5.000 -> +31 %, 10.000 -> +41 %, 20.000 -> +54 %, 74.000 -> +90 %. Wiederaufbau in BN13: 430 Partien in ~4,3 h (Install 10:08 -> Sprung 14:24). Bei ~12-h-Einbautakt in BN15 (Backups: 03:39/16:43/05:01/19:38/07:39/19:41 = 12-14 h) Durchschnittsbonus ueber den Zyklus grob +60-75 %.
  Wirkung auf die Chance (chance.js): Stat-Mult x1,9 -> Raid L6 0,326 -> 0,508 (x1,56), L12 0,25 -> 0,39, L30 0,11 -> 0,18; bei x1,5 etwa x1,33. Wert je Raid-Versuch (17,7*p - 4,0*(1-p)): p 0,33 -> 3,1 Rang; p 0,51 -> 7,0 Rang (x2,3). Erfolge treiben zugleich die Stufe (2,5 Erfolge je Stufe, LevelableAction.ts:57), also exponentieller Zusatz.
  Grobe Schaetzung Zeit bis Rang 400k (BN15.1 ~100 h): **-15 bis -30 h je Lauf**, NICHT mit dem Rangmodell (tools/bbrank) gerechnet (darf ich nicht ausfuehren) - Sicherheit niedrig-mittel. Empfehlung: nach BN15.2 gegen BN15.1-Rangkurve messen.
- Aufwand/Risiko | erledigt.

### B2. Gym PARALLEL zu Bladeburner (Simulacrum) - ungenutzt, Upside gross aber an Rep-Arbeit gekoppelt
- Quellcode | Bladeburner.ts:178-180 (mit Simulacrum wird Work nicht beendet), PlayerObjectWorkMethods.ts:5-10 startWork beendet nur die alte Work; Gym ClassWork.tsx:56-71 (1 Exp/s) * Ortsmult 10 (Powerhouse, LocationsMetadata) * strength_exp ~1,98 = ~20 Exp/s auf EINEN Wert.
  Live-Beweis der Parallelitaet: currentWork = FactionWork The Syndicate, waehrend Raid laeuft.
- Bot | blade.js:1517-1556 gymGreifen + :4887-4910: Gym nur als TAUSCH (stoppt Bladeburner) und nur wenn "nichts ueber Schwelle"; sonst belegt bn4rep den Arbeitskanal mit Faktionsarbeit (The Syndicate, hacking, 41.878/45.000 Rep fuer Bionic Spine).
- Rechnung | Aktuell ~164k Exp je Kampfwert nach 23 h = ~7k Exp/h/Wert aus Aktionen. Gym 71k/h auf einen Wert, rotiert auf 4 Werte = ~18k/h/Wert zusaetzlich. Level = mult*(32 ln(exp+534,5)-200): nach 12 h Exp 85k -> 299k, = +58 Stufen auf ~237 (+24 %), Chance ~+19 % (Exponent 0,8). Exp wird bei jedem Einbau zurueckgesetzt (12-h-Takt), der Gewinn bleibt je Zyklus begrenzt. Geld: 2.400 $/s = 8,6 Mio/h, bei 255 Mrd irrelevant.
- Gewinn | nur als Zusatz zu Go (Log-Sattigung): Rangrate je Zyklus +10-20 %, **ca. 5-10 h je Lauf IF die Faktionsarbeit gleichzeitig entfaellt**; Kosten: Rep-Rate fuer Syndicate-Augs sinkt (Rep fehlt dort 833k, Bladeburners 59k). Nettogewinn unklar.
- Aufwand/Risiko | mittel-hoch (Figur-Wache, Konflikt mit bn4rep, Graft-Schutz). Sicherheit niedrig. Vorher Rep-Bedarf gegen Gym-Nutzen mit dem Kalibrierwerkzeug (kalib.mjs/zeit2.mjs des Stanek-Baus, auf BN15-Backups geeicht) rechnen. Nicht blind bauen.

### B3. Sleeves: Retirement-Vertraege mit ~0 % Erfolg verbrennen geteilte Vorraete
- Quellcode | SleeveBladeburnerWork.ts:40-62 (Sleeve arbeitet gegen denselben action.count), Bladeburner.ts:~1004 (--count auch bei Fehlschlag), Sleeve-Skills 40 (Spielstand), Chance nach chance.js ~12 % bei Retirement L41.
- Bot | sleeve.js waehlt Vertraege (data/sleeve.json: Sleeve 0 Bounty Hunter, 2 Tracking, 1 Infiltrate). Log 17:25-17:45: Sleeve Retirement 13 Versuche, 0 Rang (alle gescheitert), Tracking 20/Bounty Hunter 11 mit zusammen 3,6 Rang gegen Spieler 44 Rang. Sleeves haben Sync 1, Shock ~100 (Sleeve.ts:68-78; Shock wirkt nur auf Exp/Rep, nicht auf die Chance).
- Gewinn | Retirement-Zaehler waere dem Spieler (Erfolg ~0,6-0,9, +1,5 Rang) erhalten: Retirement 7 Spielerversuche je 20 min; Vorrat Retirement 4,1. Hoechstens +0,2 Rang/min ~ <1 % der Rangrate. **<1-2 h je Lauf**, Sicherheit niedrig (kein Modelllauf; sleeve.js nutzt moeglicherweise die Erfolge fuer Stufenaufbau bewusst, Z.212 ff.).
- Aufwand | klein, aber Fremdpruefung noetig.

### B4. Bladeburner-Fraktionsaugs (14 offen, 59.414 Rep fehlen)
- Quellcode | Augmentations.ts: bladeburner_success_chance 1,03/1,06/1,02/1,1/1,05/1,08/1,06/1,04/1,05 ...; Rep aus Rang: Bladeburner.ts:1275-1277 + Formulas.ts:48-51 (2*Rangzuwachs*faction_rep*(1+Favor/100)). Aktueller Aug-Mult 1,1742.
- Bot | data/bn4rep.json: Bladeburners offen 14, fehlt 59.414; Ziel Bionic Spine (Syndicate), 8 Augs queued. Rep steigt automatisch mit Rang; nichts Ungenutztes erkennbar.
- Gewinn | nicht bezifferbar (<2 h), nur Hinweis: Reihenfolge Chance-Augs vor Syndicate-Kampfaugs pruefen. Sicherheit niedrig.

## GEPRUEFT, LOHNT NICHT (je ein Satz, mit Beleg)
- **Stanek's Gift**: Power 0,7 statt 2 (BN13), Groesse -2; BN13-Modell +13 % bei H16 -> hier ~+4 %, dagegen Genesis -10 % auf alle Kampfwerte (Bericht 27.10.): netto negativ.
- **Gang (SF2.3)**: Karma -1.186, Gruendung braucht -54.000 (Spielstand karma), Kills 0; GangUniqueAugs 0,3; unmoeglich/wertlos in BN15.
- **Corporation (SF3.3)**: Geld ist kein Engpass (255,7 Mrd, bn4rep.json "geld"), Valuation 0,2/Softcap 0,4 - kein Zweck; Registry knoten [3] zu Recht.
- **Hacknet-Hashes -> Rang/SP (SF9.3)**: hashes.js laeuft (Registry requiresFeature 9, upgrades: Rank 1x gekauft), HASH-RANG-2026-10.md rechnet 1.000 Rang = 4-63 h ungeeicht; nach erstem Einbau nur 0,03 H/s - klein, kein Neuaufbau.
- **Overclock-Skill (Stufe 0 live)**: blade.js:684-732, 1311-1370 begruendet es (Ausdauer ist Engpass, Overclock bewegt "ein Zehntausendstel"); nicht neu aufrollen.
- **Geld in Rang umsetzen / Spende**: Favor 150 noetig (spendenSchwelle), beste Faktion Tian Di Hui 76,9; Bladeburners-Favor 3,5 - nicht erreichbar.
- **Intelligence 170**: intBonus 1,076; +1 Stufe ~ +0,04 % Chance - ohne Hebel.
- **Grafting**: graftauto laeuft nur mit graftplan.json; jeder Graft bucht 2 % Entropie auf alle Mults (EntropyAccumulation.ts:7); ohne Plan kein Nutzen.
- **Hyperbolic Regeneration Chamber / Incite Violence / Diplomacy / Stadtwahl**: im Code bereits genutzt (blade.js:638-651, 4340-4433, 3268; Bot steht in Ishima, Chaos 41,5 < 50 Schwelle).
- **Share (Rep)**: laeuft (69 worker/share.js in der Prozessliste), repModus bn4net.js:2234.
- **Darknet-Nebengewerk**: bereits entschieden (nodes/DARKNET-NEBENGEWERK-2026-11-02.md), nicht angefasst.

## URTEIL ZUR GO-AENDERUNG (Commit 5309b8a) - Skeptiker
Ergebnis: **behalten, kein Schaden gefunden**, drei kleine Auflagen.
1. RAM: go.js 20,25 GB (Registry) gegen 19,5 TB Gesamt (home 8 TB + 24 Werkbank-Server a 256/512 GB, Spielstand) - 0,1 %. priority 17 (niedrigste), evictRank 21 (hoechste = zuerst verdraengbar), needsFigure none, singularity false: keine Figur-Wache, keine Singularity-Kosten. Kein Konflikt mit blade.js (evictRank 20) oder bn4rep (14).
2. Gegner: Tetrads ist fuer BN15 richtig. effect.ts:76-96: Daedalus -> company_rep/faction_rep (Bladeburner-Rep laeuft ueber faction_rep, hilft nur dem Augkauf, nicht dem Rang - Rep fehlt nur 59k bei Bladeburners, 833k bei Syndicate: ein faction_rep-Bonus von 1,1-Power-Kurve waere nur fuer die Syndicate-Schiene nuetzlich und kein Kampfwert), Illuminati -> hacking_speed, w0r1d_d43m0n -> hacking, Netburners/BlackHand/SlumSnakes irrelevant. Kampfwerte ziehen die Chance (Exponent 0,8) und die Aktionszeit (statFac, schwach). Tetrads ist die einzige Kette mit direktem Bezug zum Rang.
3. Wiederaufbau nach Einbau: Go.ts prestigeAugmentation setzt nodePower, wins und winStreak auf 0 (Go.ts:34-44) - der Bonus faellt nach JEDEM Einbau auf 0 und baut sich neu auf. Messung live: 8 Partien/7 min, +15 %; BN13: 100 Partien/h, 4,3 h bis +90 %. Anlauf 0 -> +50 % in rund 1-2 h (Serienfaktor startet bei 1, daher am Anfang langsamer), voll nach ~4-6 h. Bei 12-14-h-Einbautakt ist das akzeptabel, aber ein Teil des Zyklus laeuft mit schwachem Bonus. Dauerhafter Hebel waere, Einbauten seltener zu machen - nicht meine Aufgabe, nur Befund.
4. Tab-Last: ownMsPerMove BN13 197 ms, BN15 jetzt 310 ms (visitsPerMove ~3.100). 310 ms Suche je eigenem Zug blockiert den Hauptfaden des Spiels; Bladeburner-Takt (200-ms-Zyklen, storedCycles 6) holt nach, solange der Tab nicht gedrosselt ist. Nicht gemessen: ob Aktionsabschluesse oder blade.js-Takt (30 s) in BN15 Zyklen verlieren. **Kontrollmessung empfohlen**: Rangrate/Raid-Dauer vor/nach Go-Start vergleichen (blade.json "dauer" 52 s Retirement, Raid ~60 s) und storedCycles beobachten (steigt der Wert dauerhaft ueber ~100, ist Go zu schwer).
5. Skeptiker-Fragen offen: (a) go.js schreibt knoten 15, die Telemetrie zeigt 7 min nach Hotswap korrekt Tetrads/7x7 - ok. (b) Test-Lage laut Commit: 39/39, aber der Test beweist nur das Gating, nicht die Wirkung im laufenden BN15-Spiel. (c) `[skeptiker]` im Commit fehlt - dieser Bericht ersetzt den Lauf nicht vollstaendig, da ich kein Rangmodell fahren durfte.

## Nicht geprueft / Grenzen
- Kein Modelllauf (tools/bbrank, kalib.mjs, zeit2.mjs verboten): alle Zeitgewinne sind Schaetzungen, B1 niedrig-mittel, B2-B4 niedrig.
- Skill-Kaufreihenfolge (faehigkeitenKaufen blade.js:1600) und Aktionswahl (beste(), 3654 ff.) wurden NICHT gegen die Formeln nachgerechnet; der Code ist dort sehr begruendungsreich, ich habe keinen Fehler gesehen, aber auch nicht gesucht.
- Black-Op-Chancen 0,2-9 % stehen in blade.json (boChancen); wie sie bis Rang 400k steigen (Skillpunkte ~133k bei Rang 400k, Blade's Intuition +3 %/Stufe linear) hat der Bot im Modell - nicht neu bewertet.
