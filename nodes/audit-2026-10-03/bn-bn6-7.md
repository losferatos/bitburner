# Audit "vollstaendig" 03.10.2026 - BitNode-Gruppe BN6-7

Pruefer BN6-7 (Fortsetzung nach Abbruch am Nutzungslimit), Systemzeit 17:35.
Streng lesend: `src/` unveraendert, Spiel nicht angefasst, nichts committet.
Grundlage: Spielquellcode 3.0.2 (`reference/bitburner-src/src/`), Bot-Stand
master, Spielstaende `backups/` (alle V2-Laeufe BN4L2/L3, BN9L1-3, BN10L2/L3,
BN2L1 bis 17:17).

Rechner (unter `tools/audit/`):

| Datei | Zweck | Eichung |
|---|---|---|
| `bn67-mults.mjs` (neu) | Multiplikatoren BN6/BN7 aus `BitNode.tsx` gegen `src/lib/bitnodes.json`; SF6/SF7 je Stufe; `calculateSkill` und V1-Erfahrungsbedarf | Skill-Formel gegen 3 Spielstaende exakt, darunter BN10 mit derselben `HackingLevelMultiplier` 0,35 |
| `bn67-zeit.mjs` (neu) | Black-Op-Summen, Zaehlwerk-Faktor je V2-Knoten, Fenster 20k->400k aus Spielstaenden, Skillbudget BN7 im BN2L1-Stand, Reihenfolge BN6/BN7, Daedalus-Fuellstueck, Hash-Rang | nutzt `blade-formeln.mjs` (geeicht in `blade-eichung.mjs`, s.min auf 0,0005, Zeit/Ausdauer exakt) |
| `bn67-kurven.mjs` (aus dem ersten Lauf, wiederverwendet) | Rangkurven aller V2-Laeufe | Spielstandwerte direkt |

## Kurzurteil

- **Der Bot behandelt BN6 und BN7 richtig.** `src/lib/bitnodes.json` stimmt fuer
  beide Knoten Feld fuer Feld mit 3.0.2 ueberein (0 Abweichungen in 54
  Standardfeldern, 20 BN6- und 25 BN7-Feldern; BN6/7 sind zwischen 3.0.1 und
  3.0.2 unveraendert). `BladeburnerRank` 0,6 geht in `blade.js` an den drei
  Stellen ein, an denen Gewinn und Verlust verschieden skaliert sind;
  `BladeburnerSkillCost` 2 kommt ueber `getSkillUpgradeCost` live an. Keine
  Knotennummer 6/7 mehr im Code, Route und Ausgang sind knotenneutral.
- **V2 ist in BN6/7 alternativlos** (gerechnet, geeicht): w0r1d_d43m0n
  verlangt 6.000 Hacking; mit `HackingLevelMultiplier` 0,35 braucht selbst der
  V1-Spitzenspieler aus BN5.3 (mults.hacking 11,97) 1,4e22 Erfahrung = 2,4e11 h.
- **BN7 ist ein langer Knoten.** Gleiches Spielerbild, gleiche Zeit: Typhoon-
  Chance x0,555, Raid-Rang je Sekunde x0,331 gegen BN6 (geeichte Formeln,
  BN2L1-Stand). Die Rangschwelle 400.000 ist fest, die Black Ops tragen nur noch
  44.196 statt 73.660 bei: BN7 braucht 1,82x (reines Zaehlwerk) bis 3,63x (voller
  Skillpunkte-Rueckkopplung) die Rangarbeit von BN6. Die Planzahl "33-44 h je
  BN7-Lauf" (`nodes/AUDIT-ROADMAP-2026-08-24.md:92`) ist nicht haltbar.
- **Der Routengrund fuer BN7 vor BN14/13/15 ist das Simulacrum aus SF7.3** -
  und genau das nutzt der Bot nicht (AUG-3, BLADE-6). Ohne Nutzung ist die
  Reihenfolge BN6.2/6.3 -> BN7 gegen BN7 -> BN6.2/6.3 ein Unentschieden
  (+-2 h ueber fuenf Laeufe). Einziger neuer Befund mit Gewicht: BN67-1.

---

## Tabelle 1 - BN6 "Bladeburners" (`BitNode.tsx:688-721`, Stufe 2 und 3 auf der Route)

| Multiplikator | Wert | Wirkung | Bot beruecksichtigt? (Datei:Zeile) |
|---|---|---|---|
| HackingLevelMultiplier | 0,35 | Hacking-Level x0,35 (`Person.ts:60-62`) | implizit: Level live, Zielwahl `bn4net.js:1857-1859`; V1 unerreichbar (Rechnung 1) |
| ServerMaxMoney | 0,2 | Beute je Server x0,2 | live ueber `ns.getServer` (`bn4net.js:1160`); Hackertrag BN6 = 1,60 x BN2 (`inventar-hack.md` 4.5) |
| ServerStartingMoney | 0,5 | Startfuellung 10 % von moneyMax | live; Vorbereitung mit Kosten (B1, `lib/calc.js`) |
| ServerStartingSecurity | 1,5 | Startsicherheit x1,5 | live; B1 (Audit 26.09.) |
| CloudServerSoftcap | 2 | Mietrechner ab 64 GB steil teurer | live `shop.js:156, 251` (`ns.cloud.getServerCost/UpgradeCost`) |
| CompanyWorkMoney | 0,5 | Firmenlohn | NICHT ANWENDBAR (keine Firmenarbeit im V2) |
| CrimeMoney | 0,75 | Verbrechensgeld | NICHT ANWENDBAR (V2 lebt nicht von Verbrechen) |
| HacknetNodeMoney | 0,2 | Hashrate x0,2 | richtig: Ausbau nur in BN9 (`hacknet.js:150-154`); Gratisserver bringt 200-400 Rang je Erstzyklus (Rechnung 6) |
| ScriptHackMoney | 0,75 | Beuteanteil je Faden | `bn4net.js:130-150` aus `lib/bitnodes.json`, Wert 0,75 geprueft |
| HackExpGain | 0,25 | Hacking-Exp | implizit; Exp hat in V2 fast keinen Wert (`inventar-hack.md` 4.6) |
| InfiltrationMoney | 0,75 | - | NICHT ANWENDBAR (keine Infiltration, `AUFTRAG-BAU-2026-09.md:346`) |
| CorporationValuation / Softcap / Divisions | 0,2 / 0,9 / 0,8 | Corp schwach | NICHT ANWENDBAR (`inventar-corp.md`: BN6/7 selbstfinanziert -115 Mrd) |
| GangSoftcap / GangUniqueAugs | 0,7 / 0,2 | Gang schwach, Sortiment beschnitten | NICHT ANWENDBAR (`inventar-gang.md`: "neutral bis negativ", GANG-3) |
| DaedalusAugsRequirement | 35 | Daedalus-Einladung | live `lib/einbau.js:69-75`; im V2 nur das Fuellstueck (AUG-6, Rechnung 5) |
| StaneksGiftPowerMultiplier / ExtraSize | 0,5 / +2 | - | NICHT ANWENDBAR (Stanek erst mit SF13, `CotMG/Helper.tsx:60`) |
| WorldDaemonDifficulty | 2 | w0r1d_d43m0n 6.000 | live (`exit.js:148-151`, `servers.ts:1553`, `ServerHelpers.ts:422-424`) |
| BladeburnerRank / SkillCost | 1 / 1 (Standard) | - | `blade.js:802-804` liest live |

## Tabelle 2 - BN7 "Bladeburners 2079" (`BitNode.tsx:722-763`, Stufe 1-3)

Alle BN6-Zeilen gelten, ausser `ScriptHackMoney` 0,5 und Stanek 0,9 / -1. Dazu:

| Multiplikator | Wert | Wirkung | Bot beruecksichtigt? (Datei:Zeile) |
|---|---|---|---|
| **BladeburnerRank** | **0,6** | Rang aus Vertraegen, Operationen, Black Ops und Field Analysis x0,6 (`Formulas.ts:13, 22, 25`); **nicht** auf `rankLoss` (`:29-42`), **nicht** auf den Hash-Tausch (`HacknetHelpers.tsx:539-545`, `changeRank` direkt); Faktionsruf der Bladeburners folgt dem skalierten Rang (`Bladeburner.ts:1275-1279`) | ja: `blade.js:2281` (`stern` mit Faktor nur im Gewinn), `:3393-3396` (Verlust / BB_RANK_MULT, gleiche Einheit wie `RANG_JE_ERFOLG` `:3092-3096`), `:3637-3647` (Field Analysis ohne Faktor, kuerzt sich gegen Vertraege) - alle drei richtig |
| **BladeburnerSkillCost** | **2** | jede Skillstufe x2 (`Skill.ts:76-80`) | ja: `getSkillUpgradeCost` live (`blade.js:1543, 1578`); Kaufreihenfolge nach Nutzen/Preis, Faktor kuerzt sich |
| ScriptHackMoney | 0,5 | Beuteanteil | `bn4net.js:130-150`, Wert 0,5 geprueft |
| AugmentationMoneyCost | 3 | Aug-Preise x3, Graft nicht (`inventar-aug.md` AUG-1) | Preis live (`bn4rep.js:676, 1568, 1667`); Strategie siehe AUG-1 |
| FourSigmaMarketData(Api)Cost | 2 / 2 | 4S teurer | NICHT ANWENDBAR (keine Boerse im V2) |

## Tabelle 3 - Sonderregeln ausser Multiplikatoren

| Regel | Quellcode | Bot | Urteil |
|---|---|---|---|
| Division im Knoten ohne SF zugaenglich | `BitNodeUtils.ts:17-19`, `NetscriptFunctions/Bladeburner.ts:35, 331` | SF6.1 vorhanden; Beitritt `bbtrain.js:350` | OPTIMAL |
| NSA-Dialog beim Knotenstart | `Prestige.ts:285-290` (`delayedDialog`) | `popups.js:51-60` raeumt MUI-Dialoge; BN10/BN13 haben dieselbe Art (`Prestige.ts:302-316`), BN10-Laeufe liefen | OPTIMAL |
| Black Ops: reqdRank fest, Gewinn skaliert, Verlust nicht | `BlackOperations.ts:11-708` (2.500 ... 400.000), `Actions/BlackOperation.ts:47`, `Formulas.ts:24-25, 39-40` | `imEndspiel` mit `getBlackOpRank` live (`blade.js:2289-2292`); Schwellen `:2305-2316` | OPTIMAL; in BN7 Vindictus stern 0,625 + 0,25 = 0,875 < 0,90, also greift vor dem Endspiel weiter 0,90 (ENTSCHIEDEN) |
| V2-Ausgang knotenunabhaengig | `Singularity.ts:1154-1161` (`numBlackOpsComplete >= 21`, ODER mit Hacking) | `ausgang.js:250-278`, `exit.js:81`, `lib/route.js:44-80`; `node tools/test-route.js` gruen, Folge 11->6->6->7->7->7->14 | OPTIMAL |
| SF6: Kampf-Level und -Exp x1,08/1,12/1,14 | `applySourceFile.ts:93-108` | Werte live | OPTIMAL |
| SF7: bladeburner_success_chance, max_stamina, stamina_gain, analysis x1,08/1,12/1,14 | `applySourceFile.ts:109-122` | `blade.js:2358` liest `mults.bladeburner_success_chance` live; Ausdauer live | OPTIMAL |
| SF7.3: Simulacrum beim Beitritt installiert | `PlayerObjectBladeburnerMethods.ts:13-19` | Kauf/Nutzung fehlt (AUG-3, BLADE-6) | NICHT GENUTZT -> BN67-1 |
| SF7.3 sperrt Stanek (Nicht-NFG-Aug installiert) | `CotMG/Helper.tsx:59-74` | kein Stanek im Bot | NICHT ANWENDBAR in BN6/7 (BN13/15: STGO-2) |
| "Automatisierung" durch SF7 | 3.0.2: API-Zugang schon mit SF6 (`NetscriptFunctions/Bladeburner.ts:35`) | - | gibt es nicht mehr als eigenen SF7-Effekt |

**Abdeckung (34 Punkte = 25 BN7-Felder, BN6 ist Teilmenge, + 9 Sonderregeln):**
OPTIMAL 18 (12 Felder + 6 Regeln), SUBOPTIMAL 1 (Daedalus-Fuellstueck, AUG-6),
NICHT GENUTZT 1 (Simulacrum aus SF7.3), TOT 0, NICHT ANWENDBAR 14 (12 Felder:
Firma, Corp x3, Verbrechen, 4S x2, Gang x2, Infiltration, Stanek x2; 2 Regeln:
Stanek-Sperre, "Automatisierung").

## Was die SF dieser Knoten der Restroute bringen

| SF | Stufe nach | Wirkung | Wer profitiert |
|---|---|---|---|
| SF6.2 | BN6.2 | Kampf x1,12 statt 1,08 (+3,7 %) | BN6.3, BN7.1-3, BN14, BN13, BN15 (V2) |
| SF6.3 | BN6.3 | x1,14 (+1,8 %); Typhoon-Chance gesamt 6.1->6.3 x1,049 (Rechnung 4) | wie oben |
| SF7.1-7.3 | BN7.1/2/3 | Bladeburner-Mults x1,08/1,12/1,14 (direkt auf jede Chance) | BN7.2, BN7.3, dann 9 V2-Laeufe BN14/13/15 |
| SF7.3 | BN7.3 | Simulacrum beim Beitritt | BN14.1-15.3 (9 Laeufe) - **nur wenn der Bot es nutzt** |
| - | - | BN8 (V1): `BladeburnerRank` 0, SF6/7 dort ohne Wirkung | - |

## Phasenpruefung BN6/BN7

- **Sprung hinein:** Route `src/route.json:29-33`, `planeRoute` waehlt BN6 Stufe 2 bei
  SF6.1; `verfahren.txt` = V2 -> `bladeburnerTraegtHier` (`bn4rep.js:97-135`),
  Einbausperre vor dem Beitritt (`bn4rep.js:930-945`, ENTSCHIEDEN).
- **Kaltstart:** Hackertrag BN6 1,60 / BN7 1,51 x BN2 - also kein Geldengpass fuer
  Gym/Beitritt (BN2.1 hatte Kampf 119 nach 0,8 h bei schlechterem Geld); keine
  Kampf-LevelMultiplier in BN6/7, Beitritt wie BN2.
- **Aufbau:** Rangbewertung mit Knotenfaktor korrekt (Tabelle 2). Faktion
  Bladeburners ab Rang 25 (`FactionInfo.tsx:708`), `bn4life.js:271-291` nimmt an.
- **Einbauzyklus:** Preise live (x3 in BN7); Wiederaufbau nach Einbau in BN6/7
  19 min (AUG-3-Rechnung). Daedalus-Fuellstueck siehe Rechnung 5.
- **Endspiel:** `imEndspiel` live, Schwellen knotenrichtig (Tabelle 3).
- **Sprung hinaus:** BN6.3 -> BN7, BN7.3 -> BN14, test-route gruen.

---

## Rechnungen

### 1. Multiplikatortabelle und V1-Ausschluss (`node tools/audit/bn67-mults.mjs`)

Soll = `BitNode.tsx`/`BitNodeMultipliers.ts` 3.0.2, Ist = `src/lib/bitnodes.json`:

    Standard-Abweichungen: 0 (54 Felder)
    BN6 (BitNode.tsx:688, 20 gesetzte Felder): Abweichungen 0
    BN7 (BitNode.tsx:722, 25 gesetzte Felder): Abweichungen 0

Eichung `calculateSkill` (`skill.ts:7-15`) - Soll Spielstand / Ist Formel:

| Spielstand | HackingLevelMult | hacking Soll / Ist | strength Soll / Ist |
|---|---|---|---|
| BN10L3 09-10 08:17 | 0,35 | 216 / 216 | 193 / 193 (StrengthLevelMult 0,4) |
| BN2L1 10-03 17:17 | 0,8 | 408 / 408 | 198 / 198 |
| BN5L3 09-28 19:21 | 1 | 6224 / 6224 | 9 / 9 |

Erfahrung fuer 6.000 in BN6/7 (Rate: BN5L2-Spitze 3,27e7 exp/s x 0,25/0,5 = 1,6e7):

| mults.hacking | Erfahrung | Zeit |
|---|---|---|
| 1,514 (BN2L1 heute) | 2,4e156 | 4e145 h |
| 11,968 (BN5L3, voller V1-Ausbau) | 1,4e22 | 2,4e11 h |
| 20 (hypothetisch) | 2,2e14 | 3.780 h |

-> V2 ist in BN6/7 die einzige Tuer (GERECHNET_GEEICHT). Der Route-Eintrag V2 ist richtig.

### 2. BN7 gegen BN6: Rangarbeit (`node tools/audit/bn67-zeit.mjs`, Abschnitte 1-3)

Black Ops: 21 Stueck, rankGain gesamt 113.660, ohne Daedalus 73.660 (wie
ENTSCHIEDEN). Zaehlwerk = Rang, den Vertraege/Operationen bis 400.000 liefern
muessen, in Basiseinheiten (Rang/BladeburnerRank):

| Knoten | Rang / Skill | BO-Rang bis Daedalus | Zaehlwerk | Faktor gegen BN6 | Klammer mit Skillkosten |
|---|---|---|---|---|---|
| BN6 (und 2/3/4/11) | 1 / 1 | 73.660 | 326.340 | 1,00 | 1,00 |
| BN9 | 0,9 / 1,2 | 66.294 | 370.784 | 1,14 | 1,14-1,36 |
| BN10 | 0,8 / 1 | 58.928 | 426.340 | 1,31 | 1,31 |
| **BN7** (= BN14) | **0,6 / 2** | **44.196** | **593.007** | **1,82** | **1,82-3,63** |
| BN13 | 0,45 / 2 | 33.147 | 815.229 | 2,50 | 2,50-5,00 |
| BN15 | 0,2 / 3 | 14.732 | 1.926.340 | 5,90 | 5,90-17,71 |

Untere Grenze: Rate je Aktionsminute unveraendert (Vorrat-/Zeit-gebunden).
Obere Grenze: die Rate haengt nur am Skillbudget, und das Budget bei Rang R ist
in BN7 das von BN6 bei R/2 - auf einem exponentiellen Kurvenstueck gibt das
genau den Faktor c.

Plausibilitaet gegen die Spielstaende (Fenster 20.000 -> 400.000 maxRank,
exponentiell zwischen Stuetzpunkten interpoliert):

| Lauf | m / c | Fenster | Verhaeltnis zu BN4L2 | Klammer | Stuetzabstand |
|---|---|---|---|---|---|
| BN4L2 | 1 / 1 | 10,0 h (35,7 -> 45,7 h) | 1,00 | 1,00 | 16,0 / 2,4 h |
| BN9L3 | 0,9 / 1,2 | 12,0 h (39,9 -> 51,9 h) | 1,20 | 1,14-1,36 | 14,0 / 12,1 h |
| BN9L2 | 0,9 / 1,2 | 18,4 h | 1,84 | 1,14-1,36 | 30,9 / 8,0 h |
| BN9L1 | 0,9 / 1,2 | 20,4 h | 2,04 | 1,14-1,36 | 27,4 / 27,4 h |
| BN4L3, BN10L2/L3 | - | nicht bestimmbar (Lauf vor 400k zu Ende gespeichert) | - | - | - |

Nur BN9L3 (gleiche Bot-Generation wie heute) liegt sauber in der Klammer;
BN9L1/L2 lagen vor den grossen Umbauten (Stuetzabstaende bis 31 h). Die
Klammer ist damit **plausibel, nicht geeicht**.

Skillbudget im BN2L1-Stand 17:17 (Skills DO11 Tr11 SC9 BI9 Dm12 Hy5 CE5 ES5 R5 Cl5,
tsp 731), geeichte Formeln, je Skill derselbe Budgetanteil:

| Fall | Skills | Typhoon | Raid L6 | Raid-Rang je s |
|---|---|---|---|---|
| BN6 (heute) | wie oben | 0,1019 | 0,2587 | 1 |
| BN7, gleicher Rang (Kosten x2) | DO7 Tr7 SC6 BI6 Dm7 ... | 0,0711 (x0,698) | 0,1815 | x0,421 |
| BN7, gleiche Zeit (SP x0,6, Kosten x2) | DO5 Tr5 SC4 BI4 Dm5 ... | 0,0565 (x0,555) | 0,1447 | **x0,331** |

Die Typhoon-Kurve liegt in BN7 bei g = 0,115/h (`src/sleeve.js:108`, gemessen) um
**5,1 h** spaeter; die Rangrate zur gleichen Zeit ist ein Drittel. Beides spricht
fuer die obere Haelfte der Klammer.

**Folgerung (GESCHAETZT):** BN6-Lauf mit heutigem Bot etwa wie BN4L2/BN9L3
(46-54 h Knotenzeit, davon ~10-12 h Fenster 20k->400k, der Rest Anlauf bis 20k).
BN7: Anlauf bis 20k 36-40 h (BN4L2 35,7, BN9L3 39,9) x1,8-3 (rangbegrenzt,
Rate zur gleichen Zeit x0,33) = 65-120 h; Fenster 10-12 h x1,8-3,6 = 18-43 h;
zusammen 83-163 h, **Mitte rund 120 h je BN7-Lauf**, drei Laeufe 270-450 h.
Die Roadmap rechnete 33-44 h (`AUDIT-ROADMAP-2026-08-24.md:92`). Gleiches gilt
fuer BN14 (0,6/2, dazu Kampf x0,5).

### 3. Reihenfolge BN6.2/6.3 -> BN7 (Route A) gegen BN7 -> BN6.2/6.3 (B)

Nur die Differenzen: A gibt den drei BN7-Laeufen SF6.3 statt SF6.1, B gibt den
zwei BN6-Laeufen SF7.3 (x1,14 Chance, x1,14 Ausdauer, Simulacrum).

    Kampfwerte BN2L1 198/186/186/186 -> mit SF6.3 statt 6.1 212/199/199/199
    Typhoon x1,0493 (A)  gegen  x1,14 (B)
    g in BN7 0,115/h: A spart 3 x 0,42 = 1,25 h   B spart 2 x 1,14 = 2,28 h
    g in BN7 0,060/h: A spart 3 x 0,80 = 2,40 h   B spart 2,28 h
    g in BN7 0,035/h: A spart 3 x 1,37 = 4,12 h   B spart 2,28 h

Ohne Simulacrum-Nutzung ist das ein Unentschieden innerhalb von +-2 h ueber fuenf
Laeufe (die Ausdauer +14 % in B liegt in derselben Groessenordnung). Erst mit
genutztem Simulacrum (AUG-3: +6-16 % Rang/h) kippt es zu B - dann aber auch nur
um die zwei BN6-Laeufe. **Kein Grund, die ENTSCHIEDENE Reihenfolge anzufassen.**
Der Wert der Route-Position haengt an BN67-1, nicht an der Reihenfolge.

### 4. Daedalus-Fuellstueck in BN6/7 (Schwelle 35, `bn4rep.js:1552-1608`)

Alle V2-Einbauten aus `*_pre-install`-Staenden, gezaehlt wie
`lib/einbau.js:120-123` (installiert -> installiert + wartend, NFG einmal):

    BN10L2 29->36  36->42  42->45
    BN10L3 19->23  23->26  26->29
    BN4L2  8->16  16->22  22->29  29->32  32->35  35->38
    BN4L3  11->16  16->19  19->22  22->25  25->28  28->32  32->35  41->45
    BN9L1  12->20  20->23  29->32
    BN9L2  17->20  27->30  30->33  33->35
    BN9L3  0->9  9->12  12->22  22->27
    Schwelle 35: genau 34 nach dem Einbau: 0 von 4 Einbauten, die 34 erreichen oder ueberspringen
    Schwelle 20: genau 19 nach dem Einbau: 1 von 5 (BN4L3)

Die Lage ist in BN6/7 erreichbar (V2-Laeufe enden mit 27-45 installierten
Stuecken), getroffen wurde sie bisher nie; in BN15 (Schwelle 20) einmal in fuenf.
Daedalus selbst ist in BN6/7 unerreichbar (Hacking 2.500 bei LevelMult 0,35 oder
Kampf 1.500, `FactionInfo.tsx:141-145`). Das bestaetigt AUG-6 und seinen Fix
(Fuellblock nur ausserhalb V2); fuer BN6/7 kein eigener Befund (Erwartung unter
einem Treffer je fuenf Laeufe, Wirkung ~-1 % Kampfwerte in einem Zyklus).

### 5. Hash-Rang aus dem SF9.3-Gratisserver in BN6/7

Rate geeicht 0,4814 Hashes/s bei HacknetNodeMoney 1 (`inventar-hash.md` R1), x0,2:

    erster Zyklus 3 h: 1040 Hashes -> 2 Stufen = 200 Rang
    erster Zyklus 5 h: 1733 Hashes -> 3 Stufen = 300 Rang
    erster Zyklus 10 h: 3466 Hashes -> 4 Stufen = 400 Rang

Der Hash-Tausch ist von `BladeburnerRank` frei (in BN7 also 1,67-mal so viel wert
wie Aktionsrang), aber 300 Rang gegen 400.000 sind 0,1 %. Kein Hebel.

---

## Befunde

### BN67-1 (NICHT_GENUTZT, P2) Die Route stellt BN7 wegen des SF7.3-Simulacrum vor BN14/13/15 - der Bot kann es nicht nutzen

- **Route:** `nodes/AUDIT-ROADMAP-2026-08-24.md:92` begruendet die Position von
  BN7.1-7.3 ausdruecklich mit dem Simulacrum ("BB-Aktion + normale Arbeit
  gleichzeitig - beschleunigt genau die teuren Spaetlaeufe"). Die Reihenfolge
  ist ENTSCHIEDEN und wird hier nicht angefochten.
- **Bot:** Simulacrum nur als Graft-Riegel (`blade.js:3889-3905`, Stand c9f707e;
  AUG-3/BLADE-6 nennen aeltere Zeilen), Gym-Zweig stoppt die Aktion
  bedingungslos (`blade.js:1450`), Faktionsarbeit im V2 immer aus
  (`bn4rep.js:496`), Figur kennt einen Besitzer (`lib/figur.js:53-61`).
- **Spiel:** `PlayerObjectBladeburnerMethods.ts:13-19` (SF7.3: installiert beim
  Beitritt), `Bladeburner.ts:178-180, 1354-1360` (nur ohne Simulacrum schliessen
  sich Aktion und Arbeit aus).
- **Neu gegenueber AUG-3/BLADE-6:** (a) Die Laeufe, in denen das Geschenk wirkt,
  sind laut Rechnung 2 die laengsten der Route (BN14 wie BN7 1,8-3,6x, BN13
  2,5-5x, BN15 5,9-17,7x BN6-Rangarbeit) - jeder Prozentpunkt Rang/h ist dort ein
  Mehrfaches an Stunden wert. (b) Ohne Nutzung ist der Routengrund fuer BN7 an
  dieser Stelle leer: Rechnung 3 zeigt fuer die Reihenfolge nur +-2 h. (c) Frist:
  das Geschenk kommt nach BN7.3, also nach geschaetzt 270-450 h BN7 plus BN6.2/6.3;
  der Umbau muss vor BN14.1 stehen, nicht vor BN2.2.
- **Ertrag:** AUG-3 rechnet +6-16 % Rang/h plus 0,3-3 h je Einbau in 9 Laeufen; bei
  den hier geschaetzten Laufzeiten (BN14 ~90-150 h je Lauf) sind 6-16 % rund
  5-24 h je Lauf. GESCHAETZT.
- **known_before:** `inventar-aug.md` AUG-3, `inventar-blade.md` BLADE-6.
- **calc_spec:** Rangmodell aus `tools/bbrank/sim.mjs` erweitern um Skillkauf
  (Nutzen/Preis wie `blade.js:1499-1595`), Vorratswachstum
  (`Bladeburner.ts:1385-1391`), Black-Op-Tor 0,90/0,35 (`blade.js:2305-2316`) und
  Einbauzyklen; Gym parallel nach `Work/Formulas.ts:108-121`. Eichen gegen
  BN4L2 (20k @35,7 h, 400k @45,7 h) und BN9L3 (20k @39,9 h, 400k @51,9 h, m 0,9 /
  c 1,2). Dann BN14-Zeit mit/ohne Parallel-Gym (BladeburnerRank 0,6, SkillCost 2,
  Kampf-LevelMult 0,5).

### BN67-2 (RISIKO, P3) Kommentar in blade.js ordnet die Rangfaktoren den falschen Knoten zu

- **Bot:** `blade.js:537-540`: "In BN7/8/9 (0,6 / 0,45 / 0,2) ist ein Fehlschlag
  relativ teurer".
- **Spiel:** BN7 0,6 (`BitNode.tsx:750`), BN8 0 = Division gesperrt (`:784`), BN9
  0,9 (`:824`), BN13 0,45 (`:1027`), BN14 0,6 (`:1072`), BN15 0,2 (`:1108`).
- **Folge:** keine im Verhalten - der Code liest den Faktor live
  (`blade.js:802-804`). Aber dieser Kommentar ist die Begruendung der
  Black-Op-Schwelle; wer daraus fuer "BN9" eine haertere Schwelle ableitet, setzt
  sie im mildesten Faktorknoten. Fix: "BN7/14 0,6, BN13 0,45, BN15 0,2; BN8 0
  (gesperrt)".
- **Ertrag:** 0 im Verhalten, verhindert eine Fehlparametrierung. GESCHAETZT.

## Ergaenzungen zu den Bereichsberichten (keine eigenen Befunde)

- **AUG-6 (Daedalus-Fuellstueck):** gilt auch in BN6/7 (Schwelle 35), dort bisher
  0 von 4 Treffern; in BN15 1 von 5 - der Befund ist dort real (Rechnung 4).
- **AUG-1 (Grafting) und BLADE-2 (Skillmix):** In BN7 fehlen zur gleichen Zeit 45 %
  Typhoon-Chance durch das Skillbudget (Rechnung 2). Graft-Kampfwerte gleichen das
  aus, ohne `AugmentationMoneyCost` 3; ein Skillmix-Gewinn x1,39 (BLADE-2) ist bei
  dem langsameren Chancenwachstum in BN7 mehr Stunden wert als in BN2.
- **STGO-2 (Stanek-Falle):** bestaetigt; die SF7.3-Sperre beginnt mit BN14.1, in
  BN6/7 selbst gibt es kein Stanek.
- **HASH (Gratisserver):** in BN6/7 richtig nicht ausgebaut (0,2), Rangtausch
  0,1 % des Wegs.

## Geprueft, in Ordnung

- `lib/bitnodes.json` BN6/BN7 = 3.0.2, 0 Abweichungen; BN6/7 unveraendert seit
  3.0.1 (Diff leer); `BlackOperations.ts` 3.0.1 -> 3.0.2 nur Texte.
- `BladeburnerRank` an allen Mischstellen richtig (Tabelle 2); Skillkosten live.
- `einsatzSchwelle` in BN7: Vindictus (Gewinn 20.000 x 0,6, Verlust 20.000) stern
  0,625 -> 0,875, unter SICHER_BLACKOP_FRUEH 0,90; im Endspiel traegt der
  Vorsprung (>= 50.000) jeden Verlust -> 0,35. Keine Verschiebung der
  ENTSCHIEDENEN Schwellen.
- Route BN11 -> 6.2 -> 6.3 -> 7.1 -> 7.2 -> 7.3 -> 14 (`tools/test-route.js` gruen).
- Kein Code mit Knotennummer 6/7 (grep); `BLADE_KNOTEN` ist durch `verfahren.txt`
  ersetzt (`bn4rep.js:97-135`).
- `blade.js:2358`: SF7-Chance wird live gelesen; `BO_CHANCE_WACHSTUM_JE_H` 0,115
  (`sleeve.js:108`) wird in BN7 zu hoch sein - verschiebt laut eigener Begruendung
  nur, wie viele Maenner rekrutiert werden, nicht ob (`sleeve.js:91-94`).

## Offene Fragen

1. BN7-/BN14-Laufzeit: 90-150 h je Lauf ist eine Klammer-Schaetzung. Das
   Rangmodell aus BN67-1 calc_spec liefert die Zahl und entscheidet, ob die
   Gesamtplanung der Restroute (Roadmap: 1.100-1.900 h) noch traegt.
2. Fuer den Praemissen-Skeptiker: BN15 mit Faktor 5,9-17,7 auf die Rangarbeit
   (0,2/3) - die V1b-Option (Labyrinth) verdient dort eine eigene Rechnung.
3. Reihenfolge A/B: erst nach Bau von AUG-3 neu rechnen; heute +-2 h.
