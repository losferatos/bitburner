# Geldwert in BN3: Was spart zusaetzliches Spielergeld an Laufzeit?

Stand 05.10.2026 23:06 (Systemzeit). Streng lesend: `src/` unveraendert, nichts committet, keine Live-Abfrage
(nur Spielstaende aus `backups/`). Beantwortet die offenen Fragen 1, 2 und 5 aus
`nodes/audit-2026-10-03/inventar-corp.md:320-335`.

Rechner (neu, alle `tools/audit/geld-bn3-*.mjs`, je < 1 s):

| Datei | Inhalt |
|---|---|
| `geld-bn3-verlauf.mjs <bn> <lauf>` | Laufverlauf aus `backups/INDEX.tsv`: Rang, Black Ops, Geld, Warteschlange, Mults, Bladeburners-Ruf |
| `geld-bn3-fakt.mjs <stand>` | Faktionen, Ruf, Favor, Warteschlange, Sleeves, moneySourceB |
| `geld-bn3-augs.mjs` | alle `COMBAT_AUGS` des Bots mit Ruf/Preis roh und BN3 (x3/x3) |
| `geld-bn3-kist.mjs <stand...>` | k = Competence-Faktor der tatsaechlichen Einbauten (Zielgroesse der Bot-Rundenwahl) |
| `geld-bn3-zyklus.mjs [--detail] [--bb=f]` | BN3 Zyklus 1: was die Kaufschleife des Bots mit/ohne Zusatzgeld kauft, k; dazu Torrunden-Optimum |
| `geld-bn3-kmax.mjs` | k-Obergrenzen je Ruf, Graft-Reihe mit Kosten/Dauer |
| `geld-bn3-zeit.mjs` | Rangmodell, Eichung auf BN2.3, Gegenprobe BN2.1 |
| `geld-bn3-lauf.mjs [--log] [--frueh1]` | Laufzeit je Szenario (Tore, Einbau-Regeln, Grafts, Simulacrum) |
| `geld-bn3-simcheck.mjs` | Gegenprobe mit `tools/bbrank/sim.mjs` bei kleinem Rang |

## Ergebnis in einem Satz

Mit dem heutigen Bot ist Zusatzgeld in BN3 wenig wert (100 Mrd ~1-2 h, selbst unbegrenzt 6-12 h), weil der
**Ruf** den Kauf deckelt; der grosse Hebel ist **Grafting** (ruffrei, ohne BN-Aufschlag, ohne 1,9-Kette, wirkt
sofort) - damit sind ~80 Mrd ab frueh 5-14 h wert und "unbegrenzt ab 6 h" mit Simulacrum 12-20 h. Grafting ist im
Bot gebaut, aber abgeschaltet (Erics Entscheidung, `data/nicht-schieben.txt:11-28`).

## Tabelle: gesparte Stunden je BN3-Lauf (GESCHAETZT, Modell geeicht auf BN2.3)

Basis (heutiger Bot, ohne Zusatzgeld): Ausgang nach **26-34 h** (Band a = 0,7 / 0,5). Werte: gespart gegen die
Basis, Band ueber den Modellexponenten (a = 0,7 ... 0,5), Mitte a = 0,6. `node tools/audit/geld-bn3-lauf.mjs`.

| Geld | heutiger Bot | + Torrunde ohne Gang (Aenderung B) | + Grafting an (Aenderung A) |
|---|---|---|---|
| +100 Mrd nach 0,5 h | **1,2-2,3 h** (Mitte 1,6) | 4,1-7,9 h (5,7) | **5,2-13,8 h (9,0)**, 8 Grafts, Rang ruht 12,5 h |
| +450 Mrd nach 3 h | **3,0-5,9 h** (4,2) | 5,4-10,3 h (7,5) | 5,2-13,8 h (9,0) nur Grafts; **mit Simulacrum zuerst 0 h** (450 Mrd gehen ganz ins Simulacrum) |
| +1 Bio nach 12 h | **1,9-3,8 h** (2,7) - schlechter als +450 nach 3 h, Schleife kauft in falscher Reihenfolge | 5,8-11,1 h (8,1) | Simulacrum zuerst **7,4-14,8 h (10,6)**; nur Grafts 0,4-8,9 h |
| unbegrenzt ab 6 h | **6,1-11,6 h** (8,5), Ruf-Deckel k = 1,755 | wie links (Ruf-Deckel) | Simulacrum zuerst **11,7-19,7 h (15,2)** -> Ausgang ~14,5 h; nur Grafts 5,9-14,5 h |

Lesart: "Grafting an" heisst `graftplan.json` ins Spiel (Zuender) plus die unten genannten Regeln. Die Spalten sind
nicht additiv mit der Torrunde gerechnet.

## 1. Engpass: Geld oder Ruf? (GERECHNET)

**Woher der Ruf kommt (Bot-Code):**
- Der Spieler arbeitet in V2 nie fuer Faktionen: `bladeSperreArbeit = bladeburnerTraegtHier` (`src/bn4rep.js:620`), Zweig `:3041-3060`.
- Sleeves arbeiten in V2 nicht fuer Faktionen (nur im Hackingweg, `src/sleeve.js:224-232`); heute Shoplift/Infiltrate.
- Keine Gang: ausserhalb BN2 Karma <= -54.000 noetig (`reference/v301/src/PersonObjects/Player/PlayerObjectGangMethods.ts:22`), Karma jetzt -26.
- Bleibt: **Bladeburners-Ruf aus Rang** = 2 x Rangzuwachs x faction_rep x (1 + Favor/100) (`Bladeburner/Formulas.ts:46-49`) und Zufallsruf aus Coding Contracts.
- Gemessen im Analogon BN2.3 Zyklus 1 (gleicher Bot, gleiche Mults 1,43): Bladeburners **79.031** am Tor (12,4 h), Aevum 21k, Sector-12 18k, CyberSec 12k, Tetrads 0 (`geld-bn3-fakt.mjs` auf `BN2L3_2026-10-05T19-26_pre-install`). BN3 bei 1,3 h: Rang 62 (BN2.3 bei 1,8 h: 130) - gleiches Tempo.

**Spenden (Geld -> Ruf) fallen in BN3 aus:**
- Schwelle floor(150 x 0,5) = 75 Favor (`Faction/formulas/donation.ts:16-18`, `BitNode.tsx:617`); der Bot liest sie live (`src/bn4rep.js:1294, 2963`).
- Bladeburners nimmt keine Spenden: keine Arbeit (`Faction/FactionInfo.tsx:711-713`) -> `Singularity.ts:938-941` lehnt ab.
- Favor 75 braucht 85.396 Ruf vor einem Einbau (`Faction/formulas/favor.ts`). Mit 21k Ruf je Zyklus (bester Nicht-BB-Wert) erreicht Aevum Favor 75 erst nach dem **5. Einbau** (31,0 / 50,1 / 63,9 / 74,8 / 83,7) - also nie im Lauf.

**Kaufmenge im Zyklus 1** (`geld-bn3-zyklus.mjs`; Preise x3 `BitNode.tsx:619`, Ruf x3 `:620`, Kette x1,9):

| Geld bis Tor 1 | Kaufschleife des Bots: Stuecke, ausgegeben, k | Torrunde gleiches Geld: Stuecke, k |
|---|---|---|
| 5 Mrd (Basis) | 4, 2,1 Mrd, k 1,094 | 4, k 1,167 |
| 10 Mrd | 5, 8,1 Mrd, k 1,127 | 5, k 1,239 |
| +100 Mrd nach 0,5 h | 6, 30 Mrd, k 1,202 | 8, k 1,460 |
| +450 Mrd nach 3 h | 8, 431 Mrd, k 1,352 | 10, k 1,636 |
| +1 Bio nach 12 h | 8, 991 Mrd, k 1,257 | 11, k 1,701 |
| unbegrenzt | 15, 275 Bio (!), k **1,755** | 13, 2,15 Bio, k **1,755** |

Zum Vergleich der tatsaechliche Einbau BN2.3 (13 Stuecke aus der Gang-Faktion, 1,4 Mio Ruf): **k 4,782**
(`geld-bn3-kist.mjs`). **Urteil: bis ~10 Mrd begrenzt Geld, ab ~100-400 Mrd der Ruf.** Erreichbar sind nur
Bladeburner-Stuecke (Ruf <= 79k x3-Bedarf) und Kleinkram (Wired Reflexes, Augmented Targeting I, Neurotrainer I);
Bionic Arms (187,5k), DermaForce (45k Volhaven), alles Graphene/SPTN bleibt zu. Selbst mit unbegrenztem Ruf fuer
ALLE Bladeburner-Stuecke waere k <= **2,305** (`geld-bn3-kmax.mjs`; 19 Stuecke, 48,5 Bio Torrunde). Empfindlichkeit:
BB-Ruf x0,5 am Tor -> Deckel 1,352; x1,5 -> 2,095.

**Wie der Bot heute kauft:** Ohne Gang keine Torrunde (`gateBuyMode`, `src/lib/einbau.js:1024-1028`), sondern
"alles sofort, teuerste zuerst" (`src/bn4rep.js:2298-2305`). In BN3 kostet das viel: Zusatzgeld wird in der
Reihenfolge der Ruf-Freischaltung verbraten (Beispiel +1 Bio nach 12 h: Blade's Runners 322 Mrd, Vangelis 388 Mrd
an Kettenposition 5-6). Einbau braucht >= 3 wartende Stuecke (`src/bn4rep.js:371`) und 12 h Sperre ab
Wiederaufbau-Ende (`src/lib/endspurt.js:323`); in Zyklus 2 kauft die Basis mit ~10 Mrd keine 3 Stuecke mehr
(Modell-Log: "Tor 2 kein Einbau") - der Lauf endet mit k ~1,13.

## 2. Rangrate als Funktion von K, geeicht (GERECHNET/GESCHAETZT getrennt)

Modell `dR/dt = A x (R/24000)^a x K^beta` (`geld-bn3-zeit.mjs`, `geld-bn3-lauf.mjs`):

| Eichung | Soll | Ist | Art |
|---|---|---|---|
| BN2.3 Zyklus 1, K = 1, Rang 6,8 -> 12,4 h | 6.051 / 9.899 / 15.512 / 19.053 / 23.399 / 28.767 | 6.894 / 9.947 / 13.838 / 18.688 / 24.618 / 28.747 (a = 0,7, A = 6400; RMS 7,4 %) | GEEICHT |
| BN2.3 nach Einbau, K = 4,782 (k aus der echten Rundenwahl-Zielfunktion) | Rang 400k bei 14,43 h | beta = 1,44 (a 0,7) / 1,61 (0,6) / 1,77 (0,5) | GEEICHT (1 Punkt) |
| Gegenprobe BN2.1 Endspurt, K = 2,39 ab 50k | 400k bei ~29,7 h | 30,6 h | passt |
| Gegenprobe BN2.1 Zyklus 2, K = 1,19 | Rang 49.994 bei 26,4 h | 177.000 | **FAELLT, Faktor 3,5** |

Die Gegenprobe im Kleines-K-Bereich faellt durch. BN2.1 lief mit einem aelteren Bot (auch sein Zyklus 1 war halb so
schnell wie BN2.3), BN4.3 ebenso (K ~1,5-1,9 kumulativ, 51,7 h fuer 17 Black Ops). Das Modell kennt keine
Black-Op-Chancen; bei kleinem K koennen sie den Ausgang zusaetzlich bremsen. **Folge: Die Basis 26-34 h ist eher zu
kurz.** Das macht die gesparten Stunden der Szenarien mit grossem K (Grafting) eher zu klein, nicht zu gross.

`inventar-corp.md:193` nimmt "Rangrate ~ Kampfwert^0,92" (`hebel.mjs` Teil C, feste Aktionsstufen). Der gemessene
Lauf BN2.3 verlangt beta 1,4-1,8 auf die Competence: Stufen und Skillpunkte verstaerken sich. Mit 0,92 wuerde man den
Geldwert unterschaetzen.

## 3. Weitere Geldsenken mit Zeitwert

| Senke | Nutzt der Bot? | Zeitwert in BN3 | Art |
|---|---|---|---|
| **Grafting** | gebaut (`src/graftauto.js`, `src/lib/graftwahl.js`), **laeuft nicht**: Zuender `graftplan.json` steht in `data/nicht-schieben.txt:11-28` | **der Hebel**: Preis Grundpreis x3 ohne BN-Aufschlag und ohne 1,9-Kette (`GraftableAugmentation.ts:20-21`, Konstante `Constants.ts:96`), kein Ruf, wirkt sofort ohne Einbau (`Work/GraftingWork.tsx:48-51`). Die ersten 8 Plan-Eintraege (SPTN-97 ... CordiARC) kosten **79,5 Mrd**, dauern **12,5 h** und bringen **k ~6,9** (Entropie x0,98 je Graft, `GraftingWork.tsx:62-63`) - mehr als BN2.3 (4,78) und dreimal der Kauf-Deckel (2,3) | GERECHNET (k, Kosten, Dauer); Stunden GESCHAETZT |
| The Blade's Simulacrum | nein | Graft 450 Mrd, 0,29 h. Ohne ihn bricht jeder Bladeburner-Start die Spielerarbeit ab (`Bladeburner.ts:177-180`) - der Rang ruht waehrend jedes Grafts. Lohnt erst ab ~530 Mrd frei (Simulacrum + 8 Grafts); mit genau 450 Mrd: 0 h | GERECHNET |
| home-RAM, Mietserver | ja (`src/homegrow.js:88-124`, `src/bn4net.js`) | ~0: Hackgeld BN3 x0,04 x 0,2, Server x2 (`BitNode.tsx:605-612`) | Code-Lesung |
| Sleeve-Augs | nein | Preis = Grundpreis ohne BN-Aufschlag (`Sleeve.ts:372-397`), Sleeve-Vertraege geben Rang (`SleeveBladeburnerWork.ts:54`), aber nur 7-19 % des Rangs (`verify-g11-beide.md:114`) und Kauf erst bei Schock 0 | nicht gerechnet, klein |
| Spenden | ja, ab Favor 75 (`src/bn4rep.js:2963-2989`) | 0 im Lauf (siehe 1.) | GERECHNET |
| Bladeburner-Geldhebel | - | keiner (Skills kosten Skillpunkte, `src/blade.js:1592-1613`) | - |
| NFG vor dem Einbau | ja | klein (Ruf x3, Kette) | nicht gerechnet |

## 4. Praemisse: Waere V1 mit viel Geld schneller? (Schranke, GERECHNET)

Nein. w0r1d_d43m0n braucht in BN3 Hacking **6000** (3000 x WorldDaemonDifficulty 2, `Server/data/servers.ts:1536`,
`ServerHelpers.ts:383-385`), dazu The Red Pill mit **7,5 Mio Ruf** (2,5 Mio x3, `Augmentations.ts:1947`) bei Daedalus
(30 eingebaute Augs, 100 Mrd, `FactionInfo.tsx:136-145`). Stufenformel geeicht: BN1.2 Ende 12,26 x (32 ln(2,725e8 +
534,6) - 200) = 5.167 (Spielstand 5.169); BN12.2 8.498 exakt. Fuer 6000 bei HackingLevelMultiplier 0,8 braucht es den
Hacking-Mult **12,7** (mit der Erfahrung von BN12.2 nach 24,2 h) bzw. **17,8** (BN1.2 nach 19,5 h). Genau diese Mults
(12,3 / 15,0) hatten die V1-Laeufe erst nach 47-53 eingebauten Augs, bei Preisen und Ruf x1. In BN3 kosten diese
Augs x3 Ruf (Spenden erst ab Favor 75) und ihr Graften 1-2 h je Stueck. Untere Schranke V1 BN3 ~20-24 h auch mit
unbegrenztem Geld; realistisch deutlich mehr. V2 mit Grafting und Geld: ~14-21 h. **V1 ist keine Alternative.**

## 5. Was der Bot aendern muesste (Reihenfolge nach Wert)

A. **Grafting einschalten - Erics Entscheidung** (Zuender, `data/nicht-schieben.txt`). Ohne das ist Zusatzgeld in BN3
   fast wertlos. Dabei pruefen:
   - `PUFFER_FAKTOR = 2` (`src/lib/graftwahl.js:62`) und die Liste blockiert am ersten unbezahlbaren Eintrag (`:122-131`): SPTN-97 braucht 29,3 Mrd frei.
   - `augRuecklage` (`src/lib/endspurt.js:354`) zieht verdiente Stuecke vom freien Geld ab; die Kaufschleife konkurriert ums selbe Geld (bei +100 Mrd gehen 30 Mrd in den Kauf, dann reicht es fuer 6-7 statt 8 Grafts).
   - Ohne Simulacrum ruht der Rang waehrend jedes Grafts: frueh (Rang klein) billig, spaet teuer. Ab ~530 Mrd frei: Simulacrum zuerst (Graft 450 Mrd, 0,29 h).
   - Fokus-Strafe 0,8 (`PlayerObjectGeneralMethods.ts:622-628`) verlaengert jeden Graft um 25 %; `verify-p2b-geldwert.md:316` (SPTN-97 1,61 h) ignoriert sie - richtig sind ~2,0 h bei Int 155.
B. **Torrunde auch ohne Gang** (`gateBuyMode` gibt ohne Gang "normal", `src/lib/einbau.js:1025`): Geld bis zum Tor
   halten und teuerste zuerst kaufen. Bringt bei gleichem Geld k 1,46 statt 1,20 (+100 Mrd) bzw. 1,70 statt 1,26
   (+1 Bio) - +2 bis +5 h. Ohne Zusatzgeld nur ~+1 h.
C. Nicht bauen: Spenden-Weg (Favor 75 erst nach 5 Einbauten), Server/RAM, V1.

## 6. GERECHNET vs. GESCHAETZT

GERECHNET: BN3-Preise/Ruf, Favor-Schwellen, Kaufmengen und k je Geldmenge (echte Zielfunktion des Bots), Ruf-Deckel
1,755 / 2,305, Graft-Kosten/-Dauer/-k, V1-Hackingschranke, k der frueheren Einbauten.

GESCHAETZT: alle Stunden. Annahmen: Rangkurve Zyklus 1 wie BN2.3; Tor 1 bei 12,4 h, 0,4 h Wiederaufbau; Grundgeld
7,5 Mrd (Zyklus 1) / 10 Mrd (spaeter); Restgeld verfaellt beim Einbau; Ausgang = Rang 400k + 0,2 h; keine
Black-Op-Chancen; Grafts nach Plan-Reihenfolge mit Puffer 1 (nicht 2). Das Modell ist an EINEM Punkt mit grossem K
geeicht (BN2.3) und scheitert an der einzigen Gegenprobe mit kleinem K mit aelterem Bot (Faktor 3,5). Die Reihenfolge der
Szenarien (heutiger Bot << Torrunde < Grafting) ist robust ueber das ganze Band; die absoluten Stunden haben
mindestens +-50 %.

Offen / nicht belegt:
- Rangverlauf von BN3.1 selbst nach 6-12 h (naechste Sicherungen pruefen: Rang 4.567 bei 6,8 h, 28.767 bei 12,4 h waere BN2.3-Tempo).
- Black-Op-Chancen bei K 1,1-1,8 nach dem Einbau - kann die Basis deutlich ueber 34 h treiben.
- Graft-k ist mit dem Einbau-beta gerechnet; Grafts setzen die Erfahrung nicht zurueck (Einbau schon), sind also eher staerker.
