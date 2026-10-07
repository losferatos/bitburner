# Labyrinth-Gewerk V1b fuer BN15 - Machbarkeit (07.10.2026)

Bauauftrag P1 aus `nodes/AUDIT-ROADMAP-PRUEFUNG-2026-10.md` Abschnitt 7 (Befund B11).
Rechnung: `nodes/labyrinth-machbarkeit-2026-10/rechnung.mjs` (liest Spielquellcode 3.0.2 und
`backups/`, schreibt nichts). Augmentierungsdaten: `augs-3.0.2.json` daneben (Ausgabe von
`tools/audit/aug-data.mjs --json`). Skeptiker-Runde (1 Agent, sonnet) eingearbeitet, siehe Abschnitt 7.

## Urteil: ABBRUCH - jetzt nicht bauen (Vorteil gegen V2 plausibel, aber nicht belegt)

- In BN15 gibt es **keinen** klassischen V1-Weg: Daedalus verkauft dort die Red Pill nicht
  (`Faction/FactionHelpers.tsx:204-207`). Die Red Pill kommt in BN15 nur aus dem EternalLab
  (`labyrinth.ts:419-422`). Ohne installierte Red Pill ist w0r1d_d43m0n unsichtbar
  (`ServerHelpers.ts:341-343`). Die einzige Achse ist also **V1b gegen V2**.
- V1b muss zwei Waende nehmen, V2 keine davon:
  1. **Hacking 6.000 bei Level-Mult 0,6** (WD-Schwierigkeit 2). Der Bot braucht dafuer einen
     Hacking-Mult von 15-17. Erreicht hat er 15 genau einmal, in BN12.2 bei Aug-Preisen von ~x1,04.
     In BN15 kosten Augs x3. Bester Verwandter ist BN5.3 (Preise x2): dort Mult 12 nach 46,8 h,
     das entspraeche in BN15 Level 3.776, also 63 % der Wand.
  2. **Charisma 2.500 und 3.000** fuer Lab 4 und 5. Das verlangt einen Charisma-Mult von 3,3-4
     (EXP selbst ist fast frei, siehe Abschnitt 3). Den hatte der Bot bisher nur am Ende von
     V1-Laeufen. Lab 4 und 5 rutschen damit ans Laufende, und jeder dieser Einbauten setzt die
     Hacking-EXP auf 0.
- Zeitbaender, beide **ungeeicht**: V1b grob **52-111 h** (Hacking-Wand 50-100 h aus der
  BN5.3-Analogie, plus 1,8-10,8 h Darknet), V2 **105-178 h** (Pruefbericht Abschnitt 4.2).
  Die Obergrenze von V1b ist nicht belegt: ob die Hacking-Wand in BN15 ueberhaupt in endlicher
  Laufzeit faellt, hat noch kein Lauf gezeigt. Der Vorteil ist **plausibel, aber nicht klar**.
  Damit greift das Abbruchkriterium.
- Dazu kommt das Risiko: Das Gewerk umfasst ~24 Raetselloeser, einen Netz-Navigator mit
  Mutationen, Stasis-Links, eine Maze-Suche und eine Deploy-Kette. **Testen laesst es sich erst im
  BN15-Lauf selbst**, denn die Labs gibt es nur in BN15 oder mit SF15 (`effects.ts:301`).

**Was die Frage entscheiden wuerde, ohne etwas zu bauen:** Erreicht der Bot in BN15 einen
Hacking-Mult von 15-17, und wann? Das ist eine Kaufplan-Rechnung mit `AugmentationMoneyCost 3`.
Faellt sie unter ~60 h aus, lohnt V1b klar und gehoert gebaut. Die Raetselloeser lassen sich dann
vorab im flachen Darknet testen, das ueberall fuer 50 Mio zu haben ist (Tiefe 5,
`labyrinth.ts:486-497`). Ob dort alle Modelle vorkommen, ist nicht geprueft.

## 1. Eichung

| Formel | Quelle | Eichung |
|---|---|---|
| `calculateSkill(exp, mult)` | `PersonObjects/formulas/skill.ts:7-15`, Aufruf `Person.ts:60-145` (mult x LevelMultiplier des Knotens) | **196/196 Level exakt** (hacking + charisma aus 133 Spielstaenden pre-install/pre-jump, alle Knoten ausser BN12), groesste Abweichung 0 |
| Bitnode-Multiplikatoren | `BitNode/BitNode.tsx` per Regex gelesen, nicht abgeschrieben | indirekt ueber die Eichung oben |
| Auth-Zeit, Cha-EXP je Versuch, Cache-Geld | `DarkNet/effects/effects.ts:42, 60-132`, `cacheFiles.ts` getMoneyReward | **nicht geeicht**, denn im Spielstand steht kein Darknet-Wert. Fliesst nur in die Darknet-Zeit und die Farmrate ein |
| Hacking-Wand BN15 | Analogie BN5.3 (EXP x1,2 fuer HackExpGain 1 statt 0,5 und HackingSpeed 0,6) | nicht geeicht, nur Analogie |

## 2. Die Kette in BN15 (Quellcode)

Die Lab-Belohnung ist eine **gequeuete** Aug (`cacheFiles.ts:197-207`). Das naechste Lab erscheint
erst, wenn die Vorgaenger-Aug **installiert** ist (`labyrinth.ts:432-473`). Jeder Einbau wuerfelt
das Darknet neu (`Prestige.ts:76`).

| Zyklus | Lab | Tiefe | Cha-Tor (hart, `labyrinth.ts:243`) | Belohnung |
|---|---|---|---|---|
| 1 | NormalLab | 7 | 300 | The Broken Wings (cha x1,05) |
| 2 | CruelLab | 12 | 600 | The Boots (cha x1,06, Auth x0,8) |
| 3 | MercilessLab | 19 | 1.500 | The Hammer (cha x1,07) |
| 4 | UberLab | 23 | 2.500 | The Staff (cha_exp x1,1) |
| 5 | EternalLab | 29 | 3.000 | **The Red Pill** (BN15-Sonderfall `labyrinth.ts:420`) |

Nach dem fuenften Einbau braucht w0r1d_d43m0n **6.000** Hacking (`servers.ts:1553`,
`ServerHelpers.ts:423`, WorldDaemonDifficulty 2) bei HackingLevelMultiplier 0,6. Hacking-EXP
liefert das Darknet nicht, nur Charisma-EXP und Geld.

**Skriptbarkeit:** Alles geht ueber `ns.dnet` ohne UI.
- `authenticate` kostet 0,4 GB und braucht eine direkte Verbindung.
- Rueckmeldungen der Raetsel kommen nur ueber `heartbleed`-Logs. Fuer Server ausserhalb der Labs
  meldet `authenticate` nur "Unauthorized" (`Darknet.ts:171-175`).
- Die Antwort auf einen Labyrinth-Zug kommt direkt zurueck (`Darknet.ts:162-169`).
- `labreport` und `labradar` kosten 0 GB.
- Verteilt wird per `scp`/`exec` mit Session (`NetscriptFunctions.ts:605-616, 726-733`).
- Startet ein Server neu, sterben seine Skripte (`NetworkMovement.ts:302-314`).

## 3. Charisma-Tor

Noetiger **Spieler**-Charisma-Mult, abhaengig von der gesammelten EXP
(Level = 1,1 x mult x (32 ln EXP - 200)):

| Lab | Tor | 1e9 | 1e10 | 1e11 | 1e12 | 1e13 | 1e14 |
|---|---|---|---|---|---|---|---|
| MercilessLab | 1.500 | 2,94 | 2,54 | 2,23 | 1,99 | 1,80 | 1,64 |
| UberLab | 2.500 | 4,91 | 4,23 | 3,72 | 3,32 | 3,00 | 2,73 |
| EternalLab | 3.000 | 5,89 | 5,08 | 4,47 | **3,99** | 3,60 | 3,28 |

- **Die EXP sind kaum der Engpass.** `authenticate("darkweb", "")` von home aus bringt je Versuch
  0,7 x Threads x cha_exp, und die Dauer faellt mit 1/(1+0,2(t-1)) (`effects.ts:74, 121-132`).
  Mit 32-256 TB home und 4 ms Timer-Boden sind das 5,7e6-4,6e7 EXP/s, also 1e12 in 6-48 h.
  Ungeeicht; bei 50 ms Boden zwoelfmal langsamer.
- **Das Tor ist der Multiplikator.** In V2-Laeufen hatte der Bot 1,6-3,3, in V1-Laeufen am Ende
  4,8-7,0 (BN1/5/12, 39-59 Augs). Mit allen Charisma-Augs bis 125k Ruf und den Lab-Augs waeren
  rund 6,2 erreichbar. Lab 4 und 5 gehen also nur spaet im Lauf.

## 4. Hacking-Wand (nur V1b)

Noetiger Spieler-Hacking-Mult fuer Level 6.000 bei 0,6:

| Hacking-EXP | 1e9 | 1e10 | 1e11 | 1e12 | 1e13 | 1e14 |
|---|---|---|---|---|---|---|
| Mult | 21,6 | 18,6 | 16,4 | 14,6 | 13,2 | 12,0 |

**Vergleich mit BN5.3** (bester V1-Lauf des Bots): Ende nach 46,8 h mit Mult 11,97, EXP 5,93e9
und Level 6.224. Derselbe Stand in BN15 ergaebe Level 3.776.
- Bei Mult 12 fehlt ein EXP-Faktor von 1,6e4.
- Realistisch hilft nur mehr Multiplikator: Mult 15 braucht 5,8e11 EXP, Mult 17 braucht 5,0e10.
- Die Daedalus-Augs ausser der Red Pill bleiben in BN15 kaufbar. Daedalus braucht dort nur 20
  Augs, 100 Mrd und Hacking 2.500 (`FactionInfo.tsx:142-144`).
- Das Cache-Geld im Darknet bringt je Durchgang ~1e9-2,5e10 (Abschnitt 8 der Rechnung). Gegen
  x3-Aug-Preise im Spaetspiel ist das wenig.

## 5. Darknet-Zeit (Formelband, ungeeicht)

Je Lab 0,1-3,7 h, ueber 5 Zyklen **1,8-10,8 h**. Angenommen sind 3-20 Versuche je Server plus
heartbleed, 0,5-2 Zuege je Maze-Zelle, 4 Threads und Charisma auf Torhoehe. Dazu kommt je Zyklus
der Wiederanlauf (TOR und darkscape fuer 50 Mio).

## 6. Folgen

1. **Kein Gewerk in diesem Auftrag.** Befund B11 bleibt "belegt". Der Nutzen ist "plausibel, nicht
   belegt": Die August-Rechnung (10-35 h) liess die Hacking-Wand weg.
2. **`src/route.json` bleibt unveraendert.** BN15 steht auf V2, ohne `braucht`. Damit greift das
   Ueberspring-Verhalten von `src/lib/route.js` fuer BN15 nicht. `tools/test-route.js` ist gruen
   (39 Spruenge). Bekommt BN15 spaeter V1b mit `braucht`, wuerde der Knoten heute komplett
   uebersprungen (weiter nach BN8), statt auf V2 zurueckzufallen. Fuer diesen Fall braucht die
   Route ein Rueckfallfeld, mit Test.
3. **Naechster Schritt fuer B11:** die Kaufplan-Rechnung "Hacking-Mult 15-17 in BN15, AugMoney 3",
   siehe Urteil. Erst wenn die klar unter V2 liegt, wird gebaut, und zwar in zwei Stufen:
   zuerst die Loeser, getestet im flachen Darknet, danach Navigator und Labyrinth.

## 7. Skeptiker-Runde (07.10.2026, 1 Agent sonnet, Winkel Substanz + Praemisse)

| Einwand | Status | Wirkung |
|---|---|---|
| Daedalus verkauft die Red Pill in BN15 nicht (`FactionHelpers.tsx:204-207`); der V1-Vergleich der ersten Fassung war damit gegenstandslos | **angenommen**, im Quellcode geprueft und in `rechnung.mjs` Abschnitt 7 automatisch geprueft | Begruendung neu geschrieben. Das Urteil bleibt, weil der Vorteil gegen V2 nicht belegt ist, nicht mehr, weil V1 besser waere |
| Ohne diesen Vergleich steht V1b bei 52-111 h gegen V2 bei 105-178 h | angenommen | Urteil heisst jetzt "plausibel, nicht belegt" statt "nie schneller" |
| Fuenf Einbauten bedeuten fuenf EXP-Resets; die Hacking-Wand ist zu optimistisch angesetzt | angenommen | Obergrenze von V1b als unbelegt markiert |
| Cache-Geld als Vorteil von V1b | geprueft: ~1e9-2,5e10 je Durchgang | kein Einfluss aufs Urteil |
| SF15.2/15.3 erleichtern BN15.2/15.3 (Auth x0,8, Cache-Geld x1,5) | angenommen, nicht beziffert | betrifft Lauf 2-3, nicht die Bauentscheidung fuer Lauf 1 |
