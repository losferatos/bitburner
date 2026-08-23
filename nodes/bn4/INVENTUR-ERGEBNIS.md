# Formel-Inventur BitNode 4 - Ergebnis vom 23.08.2026

Sechs Agenten, gestartet 13:01 nach dem Kontingent-Reset. Auftragstexte in
`INVENTUR-AUFTRAEGE.md`. Was hier steht, ist geprueft und - wo umgesetzt -
mit Commit belegt.

## Der zentrale Befund: der Multiplikator entscheidet alles

`w0r1d_d43m0n` verlangt Hacking 9000 (`WorldDaemonDifficulty: 3`,
BitNode.tsx:660). Das Level ist `floor(mult * (32*ln(exp+534,6) - 200))`.

| Hacking-Multiplikator | noetige Erfahrung | Zeit mit vollem Netz |
|---|---|---|
| **7,94 (Stand 13:00)** | 1,26e18 | ~98 Jahre |
| 10 | 8,49e14 | Tage |
| 12 | 7,82e12 | 5,4 h |
| 14 | 2,75e11 | 11 min |
| 16 | 2,23e10 | ~1 min |
| 18,56 | 1,97e9 | bereits auf dem Konto |

Unterhalb von mult 11 ist der Knoten NICHT abschliessbar, oberhalb von 14
ist er fast geschenkt. Es gibt keinen Zustand, in dem Weitersammeln bei 7,94
richtig ist. Von 25 erhaeltlichen Hacking-Augmentierungen sind 4,41 von 22,89
moeglichen Multiplikatorpunkten geholt - Faktor 5,19 liegt offen.

## Umgesetzt am 23.08.2026

| Befund | Wirkung | Commit |
|---|---|---|
| Portprogramme werden bei JEDEM Einbau geloescht (ServerHelpers.ts:227), nicht nur beim Knotenwechsel. 0 von 30 Fuenf-Port-Servern gerootet, die 95,6 % des moneyMax halten | Gelddecke 11 statt 248 Mrd/s - **Faktor 22** | 2755894 |
| `reserveHome` war maxRam/4 - 262.144 GB gesperrt fuer 126 GB Werkzeugbedarf | +24,9 % nutzbares Netz | 2755894 |
| `geldFuerRep` unterschlug `FactionWorkRepGain` (0,75 in BN4) | Spenden waren 33 % zu billig gerechnet, Kaeufe schlugen fehl | f253119 |
| Gespendet wurde der ganze Bestand statt des Bedarfs | bei $300 Bio und <1 % Bedarf | f253119 |
| Guetefunktion rechnete in roher Reputation statt in Zeit; The Red Pill hatte Wert null; Spendenschwelle war Zuschlag statt Ziel | Daedalus 458.135 statt 2.499.193 Rep = **2,1 statt 11,6 h** | (Guetefunktion) |
| Doppelt laufende Steuerungen wurden nicht geraeumt | Ursache des Stillstands vom 22.08. | 29143c0 |

## Tote Faehrten - nicht noch einmal pruefen

- **Intelligence**: waechst nur mit SF5 oder in BitNode 5 (`Person.ts:185`).
  Ohne SF5 ist int = 0 und `calculateIntelligenceBonus` konstant 1. Alle vier
  Int-Terme der Reputationsformeln sind in diesem Knoten tot. Damit ist auch
  die Faehrte "share mit doppeltem Int-Gewicht" erledigt.
- **`hacking_chance`**: auf joesguns liegt `skillChance * difficultyMult` bei
  0,949; der vorhandene Multiplikator 3,02 treibt das auf 2,86, und
  `clampNumber(...,0,1)` schneidet auf 1,00. Der ganze Wert ist tote
  Investition - fuer Geldrate wie Erfahrung.
- **`getCoreBonus` auf home**: home hat 1 Kern. Kerne 2-6 waeren billiger als
  aequivalentes RAM (+30,8 % auf home), aber `ns.singularity.upgradeHomeCores`
  wird nie aufgerufen. Fremdrechner sind mit 2.652 GB irrelevant (0,25 % von
  home). Mittelgrosser, noch offener Hebel.
- **SF-gesperrt in BN4** (nur SF1.1 vorhanden): Gang (SF2), Corporation (SF3),
  Bladeburner (SF6/7), Hacknet-Server (SF9), Sleeves und Grafting (SF10),
  Stanek (SF13), Go-Cheats (SF14), Darknet-Labyrinth (SF15/BN15).
- **Infiltration und Casino**: `isTrusted`-geprueft, fuer einen Bot
  verschlossen. Infiltration verlangt zudem Kampfwerte im Tausenderbereich.
- **Export-Bonus**: +1 Favor je Faktion je 24 h. Bei Favor 100-130 sind das
  rund 30.000 Rep pro Tag - gegen 225 rep/s Arbeitsrate etwa zwei Minuten.
  Verworfen, weil er im Browser einen Download-Dialog oeffnet.

## Offen - die naechsten Hebel

1. **`hackNutzen` gewichtet falsch.** `lib/hackaugs.js:104-113` bildet das
   flache Produkt aller sechs Hacking-Multiplikatoren; `buyaugs.js:485-492`
   gewichtet `hacking_money` mit 1,5 sogar UEBER `hacking` mit 1,0. Fuer das
   Knotenziel ist die richtige Gewichtung
   `(9000/(32*mult))*ln(f_hacking) + ln(f_exp) + ln(f_speed)`, also rund
   **35:1 zugunsten von `hacking`** - und null fuer `hacking_money`,
   `hacking_grow`, `hacking_chance`. Beispiel: der Bot bewertet DataJack
   (`hacking_money` 1,25) hoeher als nextSENS (`hacking` 1,20), obwohl
   nextSENS die noetige Erfahrung um Faktor 366 senkt.
2. **NeuroFlux ist blockiert.** Stufe 60 verlangt 1.138.800 Reputation, die
   hoechste Faktion hat 147.915. BitRunners ist spendenberechtigt - die
   fehlende Reputation kostet 485 Mrd, also 0,16 % des Guthabens. Der Grund
   ist strukturell: NFG ist aus `kandidaten` ausgeschlossen (bn4rep.js:269),
   und gespendet wird nur an `ziel.faktion` aus genau dieser Liste.
3. **home-RAM ohne Amortisationspruefung** (bn4net.js:2252-2256). Die letzten
   beiden Verdopplungen kosteten 131,4 Bio fuer 786.432 GB = 167 Mio je GB;
   ein Mietrechner kostet 408.800 je GB. Fuer dasselbe Geld haette der Park
   siebenmal maximiert werden koennen - 33-mal mehr Speicher.
4. **Mehr Firmenfaktionen.** NWO (Xanipher 1,20), Fulcrum, ECorp und Blade
   (PCDNI-Optimizer und -NeuralNetwork je 1,10) haengen an derselben
   400k-Firmenreputation, die fuer Clarke und OmniTek schon laeuft. Zusammen
   rund x1,45 auf den Multiplikator.
5. **Erfahrungsofen auf hack statt weaken.** Gleiche Erfahrung je Aufruf,
   aber weaken dauert das Vierfache. Je GB-Sekunde: hack 5,35, grow 1,63,
   weaken 1,30. Nicht knotenentscheidend (Faktor 4 gegen noetige 1e8), aber
   +9,1 % Reputationsrate ueber das hoehere Level.
6. **IPvGO.** Der Go-Gegner `w0r1d_d43m0n` multipliziert `mults.hacking` mit
   bis zu x2 (`Go/effects/effect.ts:93-95`, bonusPower 2), freigeschaltet
   durch The-Red-Pill-Einbau plus SF1 - genau der Moment, in dem Hacking 9000
   ansteht. Der Gegner `Daedalus` wirkt auf `faction_rep` und schreibt
   Siegpraemien direkt als Favor gut (`scoring.ts:66-78`), gedeckelt bei
   100.000. **Falle:** `Go.prestigeAugmentation()` loescht nodePower bei
   JEDEM Einbau (Go.ts:33-46) - Go lohnt nur auf der letzten Strecke ohne
   Einbau. Braucht ein Go-Spielskript, hoher Aufwand.

## Methodischer Nachtrag

Die Skeptikerrunden vom 22.08. haben nichts davon gefunden, weil sie
Behauptungen geprueft haben statt nach Stellschrauben zu suchen. Der
Unterschied steckte in einem einzigen Absatz des Auftragstexts: "Bestaetigung
ist wertlos. Gesucht ist, was FEHLT. Miss gegen den theoretisch moeglichen
Bestwert, nicht gegen den jetzigen Zustand." Der Agent ohne Zielgroesse
(Agent 5, "was fassen wir gar nicht an") lieferte die groessten Funde.
