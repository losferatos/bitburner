# Audit der BitNode-Route (24.08.2026, 20:52)

Externe Pruefung von `nodes/ROADMAP.md` (Fassung 4) und `nodes/ROADMAP-KORREKTUR.md`
durch ein anderes Modell (Fable), gegen den Quellcode `reference/bitburner-src/`
(meldet sich als v3.0.2) und die Telemetrie unter `data/`. Auftrag: Zahlen-Audit,
Reihenfolge-Kritik, Abgleich mit der Messung. Nur gelesen, nichts veraendert.

---

## 1. Fehlertabelle

**Vorab der Gesamtbefund: Die Zahlenbasis der ROADMAP ist weit besser als ihr
Ruf** — die komplette 4.1-Tabelle (WDD, HackingLevelMultiplier, HackExpGain, alle
EXP-Werte), die Cloud-Preistabelle 7.4, die RAM-Tabelle 7.3, Overclock 5.877 SP,
BladesIntuition 4.844 SP, der Daedalus-Sockel, die Abschlussmechanik (2.1/2.2)
und die Ueberlebens-Tabelle (Abschnitt 5) wurden nachgerechnet und stimmen
**alle**. Die Fehler liegen woanders:

| Fundstelle im Plan | behauptet | richtig | Fundstelle im Quellcode | Auswirkung auf die Route |
|---|---|---|---|---|
| ROADMAP §1 Zielfunktion vs. Auftrag/KORREKTUR | "Minimiere Zeit bis alle 15 Knoten **einmal** abgeschlossen" | Ziel ist **Level 3 ueberall = 45 Laeufe** (KORREKTUR §"Neue Reihenfolge", Auftragstext) | — | **Strukturfehler Nr. 1.** Alle Wiederholungs-Bescheide der ROADMAP (6.2, 8.2) rechnen mit 9-11 "Restknoten" statt ~35-40 **Restlaeufen** und kippen: SF10.2/10.3 (4 h bzw. 3 h Ersparnis x ~35 Laeufe ≈ 100-150 h gegen ~30-50 h Kosten) und SF4.2 (1-3 h x ~35 Laeufe gegen ~55 h) sind auf der 45-Laeufe-Route **klar positiv**, nicht "Wash" |
| ROADMAP §4.1 "Rohwert 43,49 (31 Bloecke)" / §8.6 "ohne NFG 43,06" | 43,49 / 43,06 | **50,87 / 50,36**. Ursache: StaneksGift2 = x1,0556 und Gift3 = x1,0526 (Aufhol-Faktoren), nicht x0,95/x1,0 | Augmentations.ts, Bloecke StaneksGift2/3 (per Klammer-Parser: 30 numerische + NFG); Kontrolle: 50,36 x 0,9 x 0,95 = 43,06 | Keine — die tragenden Endwerte stimmen exakt: **Gang-Satz 25 Stueck, Produkt 22,89** OK, ohne QLink/SPTN-97 **11,375** OK (KORREKTUR OK), `hacking_exp` **15,32** OK |
| ROADMAP §4.3, §6.3 | "Eine Gang-Fraktion bietet die Augmentierungen **aller** Fraktionen an (Filter nur `isSpecial`)" | Es gibt einen **zweiten Filter**: fraktionseinzigartige Augs ueberleben nur mit Wahrscheinlichkeit `GangUniqueAugs` (BN3/4/5: 0,5 · BN6/7: 0,2 · BN9/10: 0,25 · BN13: 0,1 · BN14: 0,4 · BN15: 0,3 · BN8: 0; nur BN1/BN2 = 1). 12 der 25 Hacking-Augs sind Ein-Faktion-Augs (u. a. QLink, SPTN-97, CSP-G5, Neurolink, NeuralAccelerator, Xanipher, nextSENS) | FactionHelpers.tsx:185-199 (`uniqueFilter`, seed-basiert); BitNode.tsx je case | Der "V3-Gang"-Rueckfall (6.3) und die KORREKTUR-Idee "Gang macht Favor-Grind ueberfluessig" gelten **uneingeschraenkt nur in BN2**; ausserhalb ist das Gang-Sortiment zufaellig beschnitten |
| ROADMAP §6 Zeile 13 (BN15) | "Milderung: DaedalusAugsRequirement 20 → V1 erneut zu pruefen" | **Daedalus verkauft TRP in BN15 gar nicht**; TRP liegt dort im 4. Darknet-Labor (EternalLab) | FactionHelpers.tsx:204-207; DarkNet/effects/labyrinth.ts:419-421, 449-455 | Die BN15-Rueckfallueberlegung ist falsch fundiert; der V1-Weg in BN15 ist der Labyrinth-Weg, nicht Daedalus |
| ROADMAP §2.1 (ganzer Sockel), beide Dokumente | V1 fuehrt zwingend ueber Daedalus (30 Augs, $100 Mrd, 2,5M Rep) | In **13 von 15 Knoten** (alle ausser BN8, BN12) gibt das **6. Darknet-Labor The Red Pill** — am kompletten Daedalus-Sockel vorbei | BitNodeMultipliers.ts:64 (`DarknetLabyrinthRewardsTheRedPill` Default 1); BitNode.tsx:786 (BN8: 0), :954 (BN12: 0); labyrinth.ts:424-427 | Ein dritter Abschlussweg (V1b), den **beide** Dokumente komplett ignorieren; Aufwand/Skriptbarkeit ungeklaert (s. Abschnitt 3) |
| ROADMAP §6.3 | "`b1tflum3` … kostet nichts ausser dem versenkten Fortschritt" | b1tflum3 = `SF4Cost(16)` → mit SF4.1 ausserhalb BN4 **257,6 GB** je Skript; fehlt in RAM-Tabelle 7.3 | RamCostGenerator.ts:219 | Der "eigentliche Rueckfall" der sieben V2-Pflichtknoten braucht einen 512-GB-Rechner oder home-Ausbau, den die Wiederanlaufkette nicht vorsieht (SF4.2: 65,6 GB — ein Grund mehr fuer SF4.2, s. u.) |
| ROADMAP §6 Zeile 3 (BN10) | "Grafting … das Werkzeug fuer BN8" | TRP ist `isSpecial` und damit **nicht graftbar**; Grafting kostet Echtzeit ((1 h·log2(Summe mults)+30 min)/2 ≈ 0,3-1,8 h je Aug, ~22 h fuer 30 Augs seriell) — in BN8 dominiert der Spendenweg (FavorToDonateToFaction 0: spenden ab Favor 0, Rep = reine Geldfrage) | GraftingHelpers.ts:13-15; GraftableAugmentation.ts:20-30; Constants.ts:96-97; BitNode.tsx:776 | BN10s Platz begruendet sich ueber Sleeves (der traegt, s. Reihenfolge), nicht ueber Grafting-fuer-BN8 |
| KORREKTUR §"Der Fehler" | "Dieselbe Farm leistet rund **3,1e8 EXP/s**" (Faktor 300-3.000) | Die Rechnung nutzt `hacking_speed` 3,63 — **QLink allein traegt davon x2**, und die eigene Gegenkorrektur schliesst QLink/SPTN-97 aus. Realer Satz: `hacking_exp` 15,32 (bleibt), `hacking_speed` **1,82** → Faktor halbiert. **Gemessen** heute: 1,4-2,2e6 eff. EXP/s bei 1-PB-home (Level 3746→4967 in 51 min, `wache-zustand.json` 24.08. 19:57-20:48, Rueckrechnung ueber skill.ts:13) — **x100 unter der Modellzahl** | Augmentations.ts:1477 (QLink hacking_speed 2); eigener Parser-Lauf; skill.ts:13/19 | Richtung der KORREKTUR stimmt (kein Knoten "aussichtslos"), die Groessenordnung nicht: reale Bot-Leistung ist ~2e6, nicht 3e8 |
| KORREKTUR §"Was daraus folgt" | "BN2 1,7 h · BN6/7 1,9 h · BN10 1,7 h · BN13/14 1,7/1,8 h" | Das sind reine **Levelaufbau**-Zeiten. Es fehlen je Knoten: (a) **29 weitere Augs** fuer die Daedalus-Einladung — NFG zaehlt als **eine** Augmentierung, egal wie viele Level (applyAugmentation erhoeht nur `level`, kein neuer Eintrag; `haveAugmentations` zaehlt `p.augmentations.length`); (b) **Favor-150-Bootstrap** fuers Spenden: **462.490 kumulierte Rep + mindestens ein Einbau** (Favor wird erst bei `prestigeAugmentation` gutgeschrieben); (c) die **NFG-Kosten selbst**: Level 125 = kumulativ 4,6e10 Rep ≈ $10^15-10^16 Spende + ~$3,8e15 Kaufpreis (Charge 10) — bei gemessenen $5e9-7,4e10/s allein 10-100+ h; (d) Hacking 2500. Realistisch BN13 ueber NFG mit heutiger Bot-Leistung: **~300-1.300 h** (Optimum ueber NFG-Anzahl gerechnet), nicht 1,7 h | AugmentationHelpers.ts:54-59, 133-139; FactionJoinCondition.ts:116-131; FactionInfo.tsx:141-145; favor.ts:12-19; Faction.ts:68-85; Constants.ts:31, 33, 36, 41; Messraten: wache-zustand.json, INVENTUR-ERGEBNIS.md:101 | **Strukturfehler Nr. 2.** Die Entthronung der V2-Route steht auf Zeiten, die den Sockel weglassen. In den gedaempften Knoten (BN2, 6, 7, 9, 10, 13, 14, 15) bleibt V2 um Faktor 3-20 vorn — die ROADMAP-Kernentscheidung "Bladeburner als Traeger" war **richtig**, nur ihre Begruendung (EXP-Unerreichbarkeit) war falsch |
| KORREKTUR §"Neue Reihenfolge" | "BN11 … senkt die Chargenbasis von 1,9 auf 1,767" | 1,767 erst mit SF11 **Level 3** ([1; 0,96; 0,94; 0,93]); der erste Lauf gibt 1,824 | AugmentationHelpers.ts:29-31 | "BN11 frueh" wird schwaecher; auf einer V2-Route wirkt die Chargenbasis ohnehin nur auf die V1-Anteile |
| KORREKTUR §"Neue Reihenfolge" | "SF5 gibt +8 % **je Stufe**" | 8 % / 4 % / 2 % (Halbierung je Stufe; SF5.3 kumuliert x1,1424). Dito SF1: 16/8/4 → x1,28 bei Level 3 OK | applySourceFile.ts:78-91, 14-48 | Der Ertrag von BN5- und BN1-Wiederholungen ist halb so gross wie suggeriert — bleibt positiv, rueckt aber hinter die Sleeve-/Infrastruktur-SFs |
| KORREKTUR §"Was daraus folgt" (BN9) | NFG-Bedarf "28 → 6 nach SF1.3+SF5.3"; BN6/7/10 "54", BN13 "125", BN14 "120" | Nachrechnung mit realem Satz (11,375x1,16): BN6/7/10 **55-104**, BN13 **129-178**, BN14 **133-182**, BN9 **0-68** — je nach erreichbarer EXP-Menge (1e13…1e9). Die Planwerte entsprechen der optimistischsten Annahme | skill.ts:13; eigene Rechnung (Formeln aus Hacking.ts:30-38, BitNode.tsx) | NFG-Bedarf ist kein fester Wert, sondern ein Geld↔Level-Optimierungsproblem; die Bedarfe der KORREKTUR sind untere Kanten |
| These "Level 2/3 mitnehmen ist billiger, weil Faktionen, Backdoors und Firmenreputation teilweise ueberleben" | teilweises Ueberleben | **Widerlegt.** Beim BitNode-Wechsel: Favor 0, Rep 0, Mitgliedschaft weg (jede Faktion und Firma), Karma 0, Gang/Corp/Bladeburner null, alle Server neu erzeugt (Backdoors weg), Augs weg | Faction.ts:68-75; PlayerObjectGeneralMethods.ts:143-175; Prestige.ts:221, 236, 251-253 | Ein direkter Zweitlauf hat **null mechanischen Rabatt**. Fuer "wann wiederkommen" zaehlt allein: Beschleuniger-SFs frueh, Pflichtlaeufe spaet (s. Reihenfolge) |
| ROADMAP §6.1 | "BN4-Sockel 60-120 h" | **Gemessen ~46-48 h**: BN1-Ende 21.08. 17:07 (tick-last.json), BN4-Ausgang 23.08. ~17-18 Uhr (KORREKTUR: 16:53 "Hacking 8310 von 9000") | data/tick-last.json (`t:1787324859373`); ROADMAP-KORREKTUR §Uebergang | Schaetzung zu pessimistisch — die V1-Sockelkosten sinken mit eingespieltem Bot |
| ROADMAP §4.1 Arbeitsband | "1e2-1e3 EXP/s beim heutigen Netz; 1e5-1e6 bei ausgebauter Farm" | **Gemessen in BN5: 1,4-2,2e6 eff. EXP/s** bei home = 1 PB (wache-zustand.json). BN5 komplett (Reset → Level 4967 > 4500, TRP-Rep 1,23M/2,5M mit Spendenrecht) in **~27-30 h** | wache-zustand.json (verlauf 24.08. 19:57-20:48, homeRam 1.048.576); Messung 24.08. 20:20 | **Messbefund des Auftrags-Teils 3:** Der eigene BN5-Lauf widerlegt die pessimistische Ratenbasis der ROADMAP (x2-20) UND die 3,1e8 der KORREKTUR (x100+). Kalibrierte V1-Knotenzeit in milden Knoten: **~30 h** |
| ROADMAP §4.1 Sockel | "10-24 h allein Daedalus-Rep" | Mit Favor > 150 ist die Rest-Rep eine Geldfrage: 2,5M Rep ≈ $667 Mrd ≈ **Sekunden** Einkommen (eigener Befund A24) | BEFUNDE.md A24; favor.ts; Constants.ts:33 | Der Sockel-Posten ist in Wahrheit ein Favor-Bootstrap-Problem (462k Rep + 1 Einbau), danach trivial |
| KORREKTUR §Uebergang (Kalibrierfehler) | "ScriptHackMoney BN5 = 0,75" (urspruenglich) | 0,15 (BN5); 0,75 gehoert zu BN6 — **in der Datei selbst schon korrigiert** (Notiz 17:05) OK | BitNode.tsx:666, :701 | erledigt; keine weitere Verwechslung dieser Klasse gefunden — die BN4→BN5-Tabelle stimmt vollstaendig (WDD 1,5 OK :685, Ziel 4500 OK, FactionWorkRepGain 1 OK, HackExpGain 0,5 OK :668, AugmentationMoneyCost 2 OK :670) |

**Widerspruch, den keine der beiden Dateien aufloest:** ROADMAP §6 ist per
Warnkasten fuer ungueltig erklaert, die "Neue Reihenfolge" der KORREKTUR ist
ausdruecklich "Entwurf, noch nicht beschlossen" (BEFUNDE A21 haelt das ebenfalls
offen). **Es existiert derzeit keine beschlossene Route.** Zusaetzlich nutzt die
KORREKTUR intern ihre eigene Gegenkorrektur nicht (11,375er-Satz vs.
3,63er-Speed, s. o.).

**Ausdruecklich bestaetigt (Stichproben mit Fundstelle):** SF4Cost x16/x4/x1 und
BN4-Ausnahme (RamCostGenerator.ts:82-96) OK · alle 15 case-Bloecke exakt an den
zitierten Zeilen 566…1085 OK · destroyW0r1dD43m0n-ODER-Pruefung
(Singularity.ts:1124-1176) OK · 21 Black Ops, Daedalus-Op Rang 400.000, erster
Op 2.500 (BlackOperations.ts:11/708/735) OK · TRP-Netzkante nur bei
installiertem TRP, `ns.nuke` wirft vorher (Prestige.ts:173-181;
NetscriptHelpers.tsx:554-570; ServerHelpers.ts:340-343) OK · Bladeburner
ueberlebt Einbau vollstaendig (Bladeburner.ts:259-263) OK · BN8 hat keinerlei
V2/Gang/Corp-Weg (BitNode.tsx:764-793; Formulas.ts:9-28) OK · Bonuszeit max
5 s/Tick (Bladeburner.ts:1374-1378) — Bladeburner verkraftet die
16x-Tab-Drosselung strukturell besser als Echtzeit-HWGW OK · Ausgang B ohne
`isTrusted` (BlackOpPage.tsx:39-52; PortalModal.tsx:117-131; kein Treffer in
beiden Dateien) OK · RAM-Tabelle 7.3 bis auf die Kommastelle aus den Konstanten
reproduzierbar OK · Cloud-Preisformel und alle 15 Zeilen der 7.4-Tabelle OK
(ServerPurchases.ts:22-41, Basis 55.000, Limit 25, MaxRam 2^20) · Hacknet
1→64 GB = $53,4 Mio OK (HacknetServers.ts:40-65, RamBaseCost 200e3,
UpgradeRamMult 1,4) · BN9/SF9.3-Gratis-Hacknet-Server Level 100
(Prestige.ts:329-339) OK · **SF9.2: jedes frische home hat 128 GB**
(Prestige.ts:242-243) — im Plan erwaehnt, aber nie als Routenargument genutzt ·
keepalive.js-Zitate (Zeilen 183-186, 286) OK.

---

## 2. Empfohlene Reihenfolge

Verfahren: **V2 (Bladeburner) als Traeger ueberall ausser in den vier milden
V1-Knoten und BN8** — die ROADMAP-Kernentscheidung haelt, die
KORREKTUR-Entthronung nicht (Rechnung in Tabelle 1, Zeile "1,7 h"). Prinzip
fuers Level-3-Ziel: **Lauf-Kosten sinken monoton mit Beschleuniger-SFs →
Beschleuniger zuerst, reine Pflichtlaeufe ans Ende.** V2-Zeiten sind die
(unverifizierte) Plan-Simulation inkl. Raid-freier Obergrenze; V1-Zeiten sind an
BN4/BN5 gemessen kalibriert.

| # | Knoten (Laeufe) | Verfahren | Nachrechenbare Begruendung |
|---|---|---|---|
| 1 | **BN5 → L1** (laeuft) | V1 | Gemessen ~27-30 h; Level 4967 > 4500 bereits erreicht, TRP-Rest = Geldfrage (Favor 255,9 > 150; 1,27M Rep ≈ $270 Mrd bei faction_rep 4,7 ≈ Sekunden bei $5e9/s). Nur abschliessen |
| 2 | **BN6 → L1** | V2 (nativ im Knoten, Faktor 1,0) | Schaltet V2 fuer 12 weitere Knoten x 3 Laeufe frei; 48-84 h (Sim). Kontrollpunkt aus Plan uebernehmen: Rang nach 2 h >= 6.000 (mit Raid) bzw. >= 3.500 (ohne) |
| 3-5 | **BN10 → L1+L2+L3 sofort** | V2 (0,8) | **Wichtigste Abweichung von beiden Plaenen.** Je Level +1 dauerhafter Sleeve (SleeveCovenantPurchases.tsx:63: `min(3, SF10-Level)`; in BN10 +1 gratis obendrauf, Schock <= 25, PlayerObjectGeneralMethods.ts:150-155). Laeufe ≈ 35/30/26 h (Sim-Spalte 0,8 mit 1/2/3 Sleeves). Ertrag: Restlaeufe mit 3 statt 1 Sleeve = −4 bis −7 h je Lauf x ~35 Laeufe ≈ **150-250 h** gegen ~56 h Mehrkosten. Die ROADMAP-Ablehnung (36 h Ersparnis) rechnete mit 9 Rest-**Knoten** statt ~35 Rest-**Laeufen** |
| 6-7 | **BN4 → L2+L3** | V2 (1,0; ≈ 25-29 h je Lauf mit 3 Sleeves) | SF4.2/4.3: Singularity-RAM ÷4/÷16 — die gesamte sing/-Kette passt auf ein frisches 32-GB-home (Tabelle 7.3, rechte Spalten), b1tflum3 faellt von 257,6 auf 65,6/17,6 GB. Ersparnis 1-3 h Wiederanlauf + Ausfallrisiko x ~33 Restlaeufe >= 33-100 h > ~55 h Kosten. Die 8.2-Ablehnung kippt beim 45-Laeufe-Ziel |
| 8-10 | **BN9 → L1+L2+L3** | V2 (0,9, Skill 1,2; ≈ 30 h je Lauf) | SF9.2: **jedes frische home startet mit 128 GB** (Prestige.ts:242-243) — deckt die 97,6-GB-join-Skripte ohne Mietrechner; SF9.3: Gratis-Hacknet-Server Level 100/10 Kerne je Reset (Prestige.ts:329-339) — die Stufe-0-Zeit ("15 min-12 h" je Knoten, ROADMAP 7.5) faellt fuer ~28 Restlaeufe auf ~0. In BN9 selbst macht V2 die Geldnot irrelevant (blade.js 27,6 GB, kein Mietrechner noetig) |
| 11-12 | **BN1 → L2+L3** | V1 (eff. 3000; ≈ 15-25 h je Lauf, BN5-kalibriert) | SF1: +8 %/+4 % auf alle 26 Player-Multiplikatoren (applySourceFile.ts:14-48). Wirkt v. a. auf die V1-Anteile (Wiederanlaeufe, BN8x3); auf V2-Laeufe nur ueber Kampfwerte — deshalb NACH der Infrastruktur, nicht davor |
| 13-14 | **BN5 → L2+L3** | V1 (≈ 25-30 h, gemessen) | SF5.2/5.3: +4 %/+2 % auf die hacking-Familie; 300 Int-EXP je Abschluss + persistente Intelligence waechst weiter (Person.ts:149-190) |
| 15-17 | **BN12 → L1+L2+L3** | V1 oder V2 (eff. 3121-3319; ≈ 20-30 h) | Billigste Pflichtlaeufe; WDD waechst nur 1,02^lvl (lvl = SF-Level+1, BitNode.tsx:919/1126). SF12.1-3 = NFG-Startlevel je spaeterem Reset (Prestige.ts:255-261) — klein, aber gratis mitgenommen |
| 18-23 | **BN2, BN3 → je L1-L3** | V2 (1,0; ≈ 22-29 h je Lauf) | Reine Pflichtbloecke beim besten Faktor. In BN2 nebenbei: Gang nativ, `GangUniqueAugs` 1, Gang-Fraktion fuehrt TRP (FactionHelpers.tsx:180-183) — dort einmal den Gang-V1-Weg als getesteten Rueckfall dokumentieren. Corporation bleibt draussen (Startkapital $150 Mrd ausserhalb BN3; API 10/20 GB je Aufruf, RamCostGenerator.ts:13-14) |
| 24-26 | **BN11 → L1-L3** | V2 (1,0) | Pflichtblock; SF11.3 senkt die Chargenbasis auf 1,767 (AugmentationHelpers.ts:29-31) fuer alle spaeteren Aug-/NFG-Kaeufe (BN8-Laeufe!) |
| 27-29 | **BN6 → L2+L3** + Puffer | V2 (1,0; ≈ 22 h) | SF6.2/6.3 bringen nur +4 %/+2 % Kampf — reine Pflicht, darum erst jetzt, wo Laeufe am billigsten sind |
| 30-32 | **BN7 → L1-L3** | V2 (0,6, Skill x2; ≈ 33-44 h) | Vor BN13/14/15, weil SF7.3 das **Blades Simulacrum** schenkt (PlayerObjectBladeburnerMethods.ts:14-19): BB-Aktion + normale Arbeit gleichzeitig — beschleunigt genau die teuren Spaetlaeufe |
| 33-35 | **BN14 → L1-L3** | V2 (0,6, Skill x2; ≈ 33-44 h) | V1 dort doppelt gesperrt: eff. Schwelle 37.500 UND FactionWorkRepGain 0,2 (BitNode.tsx:1065) macht jeden Rep-/Favor-Bootstrap x5 teurer. Go-API ist voll skriptbar (RamCostGenerator go-Block) — GoPower 4 als Bonus mitnehmen, kein Pflichtteil |
| 36-38 | **BN13 → L1-L3** | V2 (0,45, Skill x2; ≈ 40-54 h) | NFG-Gegenrechnung: ~300-1.300 h (Tabelle 1). Stanek nur hier mitnehmen (Kirchen-Beitritt ausserhalb BN13 gesperrt, sobald andere Augs installiert, Prestige.ts:184-190) |
| 39-41 | **BN15 → L1-L3** | V2 (0,2, Skill x3; ≈ 94 h Sim) — **mit Labyrinth-Option** | Schlechtester V2-Knoten. Vorher (in einem billigen Block) das Darknet-Labyrinth per dnet-API antesten: In BN15 liegt TRP im **4. Lab** (labyrinth.ts:449-455), Daedalus fuehrt es nicht. Ist das Labyrinth skriptbar < ~40 h, ersetzt V1b hier alle drei V2-Laeufe. SF15.3 gibt Charisma-Bonus auf Faction-Rep (reputation.ts:54-58) |
| 42-44 | **BN8 → L1+L2+L3, ganz am Ende** | V1, ohne Alternative | BladeburnerRank 0, GangSoftcap 0, CorpSoftcap 0, ScriptHackMoneyGain 0, kein Darknet-TRP (BitNode.tsx:764-793). Dafuer: $250 Mio Start (Prestige.ts:38/294), WSE+TIX gratis, **Spenden ab Favor 0** → Rep = Geldfrage, eff. Schwelle 3.000, alle Beschleuniger-SFs wirken. Shorts sind in BN8 nativ, SF8.2/8.3 (Shorts/Limit-Orders "in other BitNodes", BitNode.tsx:303-305) verbessern die Laeufe untereinander nicht — Reihenfolge innerhalb BN8 egal. **Voraussetzung: ein Boersen-Bot existiert noch nicht** (BEFUNDE I18 verwarf die Boerse) — das ist die eine neue Baustelle dieser Route |
| — | **Nicht wiederholen:** | — | BN1 ueber L3 hinaus gibt es nicht; SF12-Farmen bleibt abgelehnt (NFG-Start +1/Lauf gegen ~25 h je Lauf — ROADMAP-Bescheid 6.2 haelt auch beim 45-Laeufe-Ziel) |

Grobsumme: ~41 Restlaeufe x Ø 25-50 h ≈ **1.100-1.900 h**. Vor dem ersten
Knotenwechsel gilt weiter ROADMAP 7.8: T1/T2 (DOM-Ausgang am Portal) sind
Pflicht — bis dahin Ausgang A; und die dringendste Baustelle bleibt die von der
KORREKTUR benannte: die Wiederanlaufkette ist real nie ueber einen
BitNode-Wechsel gelaufen.

---

## 3. Was ich NICHT belegen konnte

1. **Die V2-Zeiten (29-94 h je Knoten) selbst.** Die ereignisgesteuerte
   Simulation der ROADMAP habe ich nicht reproduziert; verifiziert sind nur ihre
   Eingaben (Rang-Formeln, count-Wachstum, Incite Violence, Sleeve-Infiltration,
   Overclock, statFac — alle korrekt). Es gibt weiterhin **keinen einzigen
   gemessenen V2-Lauf**; der 2-h-Anker in BN6 ist der erste echte Pruefstein.
   Meine Reihenfolge-Empfehlung ist gegen diese Unsicherheit robust, solange die
   Simulation nicht um mehr als Faktor ~3-5 zu optimistisch ist.
2. **Der Aufwand des Darknet-Labyrinths** (V1b-Weg zu TRP). Belegt: Existenz,
   Lab-Reihenfolge, TRP im 6. bzw. 4. Lab, eine umfangreiche `ns.dnet`-API
   (RamCostGenerator.ts:238-263) und ein Charisma-Gate
   (`getServerRequiredCharismaLevel`). Nicht belegt: ob der Weg vollstaendig
   skriptbar ist und wie viele Stunden bzw. Install-Zyklen die sechs Labor-Augs
   kosten. Vor BN15 klaeren.
3. **Die KORREKTUR-Zahlen "BN9: 9,5 d Geldbeschaffung" und die exakten
   NFG-Bedarfe (54/125/120/28→6)** — Annahmen (EXP-Menge, Ausbeute) sind nicht
   dokumentiert; meine Nachrechnung liefert nur Bandbreiten (s. Tabelle 1).
4. **Meine eigene NFG-Gesamtzeitrechnung fuer BN13 (~300-1.300 h)** stuetzt sich
   auf die Extrapolation der gemessenen BN5-Raten (2,2e6 EXP/s, $5e9-7,4e10/s)
   in einen gedaempften Knoten und eine faction_rep-Annahme (~17 im Vollausbau).
   Die Groessenordnung halte ich fuer belastbar, die Zahl nicht.
5. **Home-RAM-Preisspalte der 7.4-Tabelle ($1,47 Mrd fuer 32→1024)** — als
   [gemessen] markiert; die Relationen ueber den
   `HomeComputerRamCost`-Multiplikator stimmen, den Absolutwert habe ich nicht
   aus einer Formel reproduziert.
6. **domclick.js 27,6 GB**: Aus den Konstanten komme ich auf 26,6 (Base 1,6 +
   Dom 25); die gemessene 1-GB-Differenz konnte ich nicht zuordnen. Folgenlos
   (< 32 GB bleibt wahr).
7. **"Corporation-Voll-API ~960 GB"** (8.7) — Konstanten 10/20 GB je Aufruf sind
   belegt, die Summe habe ich nicht nachgezaehlt.
8. **Die 0-Port-Serverliste in 7.5** und die Stufe-0-Zeitschaetzungen je
   Knoten — Stichproben plausibel, nicht einzeln verifiziert.
9. **Sleeve-Karma fuer den Gang-Zugang**: Homicide = 3 s / 3 Karma ist belegt
   (Crimes.ts:139-146 → 15 h solo fuer −54.000); dass Sleeve-Verbrechen das
   Spieler-Karma anteilig fuellen, habe ich nicht im Code nachgewiesen.
10. **Wie schnell die 3,1e8-Obergrenze mit perfekter Auslastung real erreichbar
    waere** — der Abstand x100 zwischen Modell und Messung besteht heute
    (I10/I11: 71,7 % RAM brach, Ofen auf weaken); wie viel davon behebbar ist,
    entscheidet, ob die milden Knoten unter 20 h fallen.

---

## Nachtrag (24.08.2026, 21:20): Das Darknet-Labyrinth, vermessen

Antwort auf die Rueckfrage der Planungs-Session. Alles Quellcode, nichts
simuliert; die Zeitbandbreiten sind aus den Formeln gerechnet.

### A. Skriptbarkeit: JA, vollstaendig — an jedem Glied belegt

1. **Kein UI-Zwang.** Das `manual`-Flag der ersten zwei Labs steuert nur die
   manuelle UI-Ansicht (LabyrinthSummary.tsx:61-84, PasswordPrompt.tsx:30);
   kein einziger API-Pfad prueft es. Die grossen Labs sind sogar NUR per
   Skript spielbar. Kein `isTrusted` im gesamten DarkNet-Ordner.
2. **Maze-Navigation per API.** `ns.dnet.authenticate(lab, "go north")` bewegt
   (Bewegungen laufen als Passwortversuche, labyrinth.ts:236-332, Kommandos
   n/e/s/w/north/... :348-362); `ns.dnet.labreport()` (0 GB RAM!) liefert
   maschinenlesbar `{coords, north, east, south, west}`
   (Darknet.ts:642-671, labyrinth.ts:217-234); `labradar()` zeigt ein
   7x7-Fenster inklusive Zielmarkierung "X" (Darknet.ts:672-705,
   `getSurroundingsVisualized(..., showEnd=true)`). Das Maze ist statisch je
   Lauf (DarknetState.labyrinth, generiert bei erstem Zugriff) — klassisches
   DFS mit Kartenaufbau reicht.
3. **Alle ~24 Servertypen sind deterministische TEXT-Raetsel** ueber den
   authenticate-Antwortkanal (authentication.ts:33-149): Mastermind
   (exakt/verschoben-Zaehler), GuessNumber/RomanNumeral (binaere Suche),
   Yesn_t und SpiceLevel (positionsweises Feedback → zeichenweise),
   TimingAttack (der Mismatch-Index steht IM KLARTEXT in der Antwort, :96-98),
   BufferOverflow (mit einem einzigen 2xLaenge-Versuch aus gleichen Zeichen
   loesbar, :101-118), divisibilityTest/tripleModulo (Zahlentheorie/CRT),
   globalMaxima (1D-Hill-Climbing mit Altitude-Feedback), SortedEchoVuln
   (RMSD-Feedback), packetSniffer/Woerterbuecher (heartbleed-Logs + Hints).
   Geknackte Server droppen zudem Passwort-Hinweise fuer Nachbarn als
   Textdateien (addClue, effects.ts:134-206).
4. **Deploy-Kette noetig:** `authenticate` verlangt, dass das Skript auf einem
   DIREKT verbundenen Darknet-Server laeuft (requireDirectConnection,
   Darknet.ts:113-115); labreport/openCache muessen AUF einem Darknet-Server
   laufen. Darknet-Server haben RAM (maxRam minus blockedRam;
   `memoryReallocation` schaufelt frei, ~8 s je Aufruf, Darknet.ts:517-567);
   das Lab selbst hat 128 GB frei (NetworkGenerator.ts:237). Standard-scp/exec
   funktionieren (DarknetServer ist Server-Subklasse; die
   getServer-Sichtbarkeitsausnahme steht in NetscriptHelpers.tsx:559-560).

### B. Die zwei Kostentreiber, die vorher nicht im Audit standen

1. **SF15-Gate — Korrektur meiner eigenen Fehlertabelle.** Die Labs existieren
   nur bei `hasFullDarknetAccess()` = **BN15 oder SF15 > 0**
   (effects.ts:301, labyrinth.ts:486-497). Die dnet-API selbst ist ueberall
   fuer $50 Mio kaufbar (darkscape, darknetAuthUtils.ts:6-8,
   Constants.ts), aber die "Daedalus-Umgehung in 13 Knoten" aus Tabelle 1
   schaltet sich erst nach dem ersten BN15-Abschluss frei. Vorher ist der
   Labyrinth-Weg NUR in BN15 selbst begehbar.
2. **Jeder Aug-Einbau wuerfelt das Darknet komplett neu.**
   `prestigeDarknetState` wird auch beim Aug-Einbau gerufen
   (Prestige.ts:76) und leert Netz, Sessions, Maze und Positionen
   (DarknetState.ts:84-101); die Serverobjekte selbst fallen mit
   `prestigeAllServers` (Prestige.ts:74). Und die Lab-Belohnung ist eine
   **gequeuete** Augmentierung (`Player.queueAugmentation`,
   cacheFiles.ts:197-207), waehrend das naechste Lab erst bei INSTALLIERTER
   Vorgaenger-Aug erscheint (getCurrentLabName prueft Player.augmentations,
   labyrinth.ts:432-473). **Folge: je Lab ein voller Einbau-Zyklus, und je
   Zyklus wird das Netz von Ebene 0 neu geknackt** (neue Passwoerter, neue
   Topologie). TRP kostet damit in BN15 **5 Zyklen** (BrokenWings → Boots →
   Hammer → Staff → TRP im EternalLab; labyrinth.ts:449-455), in allen
   anderen erlaubten Knoten **7 Zyklen** (6 Vor-Augs, TRP im FinalLab,
   :462-470).

### C. Zahlengeruest (aus den Formeln, mit Fundstelle)

| Phase (aktuelles Lab) | Netztiefe | Server im Netz (~Tiefe x 8 x 0,6) | cha-Anforderung Netz-Boden (=(d/labDepth)^1.5 x labCha x 0.85) | Lab-Gate (cha) | Maze | Zuege (DFS) |
|---|---|---|---|---|---|---|
| NormalLab | 7 | ~34 | ~255 | 300 | 20x14 | ~70-140 |
| CruelLab | 12 | ~58 | ~510 | 600 | 30x20 | ~150-300 |
| MercilessLab | 19 | ~91 | ~1.275 | 1.500 | 40x26 | ~260-520 |
| UberLab | 23 | ~110 | ~2.125 | 2.500 | 60x40 | ~600-1.200 |
| **EternalLab (TRP in BN15)** | 29 | ~139 | ~2.550 | **3.000** | 60x40 | ~600-1.200 |
| EndlessLab | 31 | ~149 | ~2.975 | 3.500 | 60x40 | ~600-1.200 |
| **FinalLab (TRP ausserhalb BN15)** | 36 | ~173 | ~3.400 | **4.000** | 60x40 | ~600-1.200 |

Fundstellen: labData (labyrinth.ts:37-110), Netzgroesse
NET_WIDTH 8 / SERVER_DENSITY 0,6 (Enums.ts:7-9, NetworkGenerator.ts:101),
cha-Skalierung DarknetServerOptions.ts:67-72.

- **Zeit je authenticate-Versuch** (effects.ts:60-98): `850 ms x
  (5 x chaReq + (diff+1) x 100)/(cha+150) x Faktoren`; Threads senken auf
  `1/(1+0,2(t-1))`, TheBoots x0,8, SF15.2 x0,8, Intelligence-Bonus.
  Gerechnet: EternalLab bei cha 3.200 mit 1 Thread ~4,1 s je Zug, mit 16
  Threads + Boots ~0,8 s. Wer unter der cha-Anforderung liegt, zahlt x2,5-4
  (underleveledFactor) — Charisma zuerst.
- **Maze-Zeit grosses Lab:** 600-1.200 Zuege x 0,8-4 s = **10-80 min**, plus
  labreport-Aufrufe (gleiche Zeitformel; mit Kartenaufbau ~1,5 Aktionen je
  Zug).
- **Charisma ist die Waehrung des ganzen Wegs** — und exponentiell im
  Multiplikator: cha 3.000 kostet bei mult 6 rund 7,6e8 EXP (unerreichbar),
  bei mult 12 nur 6,3e5, bei mult 24 nur 1,8e4 (skill.ts:13; BN15 hat
  CharismaLevelMultiplier 1,1, BitNode.tsx:1094). Charisma-Augs sind also
  Pflichtkaeufe des Wegs. Als Farm dient `heartbleed` selbst: 50 x
  (500+cha)/500 x charisma_exp je ~0,7-4,5 s (Darknet.ts:276), gerechnet
  ~90-2.700 XP/s je Skript — der Weg fuettert sich selbst. Beschleuniger aus
  der Progression: TheBoots x0,8 Auth-Zeit (effects.ts:79), Stasis-Limit +1 je
  BrokenWings/Hammer/Staff (:232-237), TheLaw/TheSword tragen je hacking 1,1.
- **Betriebsdynamik, einpreisbar aber nervig:** Das Netz mutiert (30 s je
  Zeile, Enums.ts:11; `nextMutation` ist abonnierbar), Server gehen offline,
  Migration/Stasis/Freeze sind API-steuerbar; zu viele Backdoors verlangsamen
  ALLE Auth-Zeiten global (1,07^Ueberschuss, effects.ts:100-107). Timeouts
  nach Instabilitaet (Darknet.ts:148) — jeder Versuch braucht Retry-Logik.

### D. Bewertung fuer die Route

- **BN15 selbst: der Labyrinth-Weg ist der einzige TRP-Weg und wohl der
  richtige.** Grobrechnung: 5 Zyklen x (Wiederanlauf 0,5-1 h + Charisma
  0-1 h + Netzpfad 0,3-2 h + Maze 0,1-1,3 h) = **5-25 h**, plus
  WD-Level (eff. 10.000; mit NFG-Leveln Stunden) und TRP-Einbau — gesamt
  grob **10-35 h** gegen 94 h V2-Simulation (Faktor 0,2, Skill x3). Selbst
  am oberen Rand schlaegt er die V2-Schaetzung. Vorbehalt: Das ist
  Formelrechnung, kein Messwert, und es braucht ein NEUES Bot-Gewerk
  (~24 Minigame-Loeser, Netz-Navigator mit Mutation-Handling, Maze-DFS,
  Deploy-Kette) — dieser Entwicklungsaufwand ist der eigentliche Preis.
- **Ausserhalb BN15: als Daedalus-Umgehung streichen.** Erst ab SF15.1
  verfuegbar, dann 7 Einbau-Zyklen, Netz bis Tiefe 36, cha-Gate 4.000 —
  gegen den Daedalus-Weg mit Spendenrecht (1-2 Zyklen, Favor-Bootstrap
  462k Rep) verliert das fast immer. Einzige denkbare Nische waeren
  rep-verkrueppelte Knoten (BN14, FactionWorkRepGain 0,2) — die faehrt die
  Route ohnehin ueber V2 ohne TRP-Bedarf.
- **Konsequenz fuer die Reihenfolge-Tabelle:** Zeilen 39-41 (BN15) werden
  konkreter: BN15-Lauf 1 als Labyrinth-V1 planen und das Gewerk VOR dem
  ersten BN15-Eintritt in einem billigen Knoten gegen die ersten zwei
  (kleinen) Labs testen — geht dort mangels SF15 nicht, also stattdessen:
  die Minigame-Loeser gegen die dnet-API im normalen Netz testen (die API
  plus flaches Netz ist ueberall fuer $50 Mio kaufbar — was genau ohne SF15
  im Netz haengt, ist der eine ungeklaerte Rest, s. u.). Laeufe 2-3 dann je
  nach Messwert Labyrinth oder V2.

### E. Was auch dieser Nachtrag nicht belegt

1. **Wie das Darknet OHNE SF15/BN15 aussieht** (nur darkscape gekauft):
   `getNetDepth` faellt auf den Default der Lab-Details zurueck (kein Lab →
   depth 5, labyrinth.ts:486-497); ob das abgespeckte Netz zum Ueben der
   Minigame-Loeser taugt, ist plausibel, aber nicht verifiziert.
2. **Die tatsaechliche Pfadlaenge durchs Netz je Zyklus** (wie viele Server
   man real knacken muss, haengt an der zufaelligen Topologie inkl.
   AIR_GAP_DEPTH 8 und den garantierten Verbindungen) — meine 0,3-2 h je
   Zyklus sind eine Formelbandbreite.
3. **Captcha-/EchoVuln-/encryptedPassword-Details**: default-Zweig liefert
   nur Hint+Daten (authentication.ts:147-148); dass jeder dieser Hints
   maschinell loesbar ist, habe ich fuer die genannten Typen aus dem Code
   belegt, fuer die restlichen Woerterbuch-/Hint-Typen nur die Mechanik
   (dictionaryData, heartbleed-Logs), nicht jede Instanz.
4. **Die Charisma-Aufbau-Kurve je Zyklus** haengt am cha-Multiplikator
   (Augs), den der Bot je Knoten erst kaufen muss — die 0-1 h gelten ab
   mult ~12.
