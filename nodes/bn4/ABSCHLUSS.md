# BN4 — Abschlussplan (22.08.2026, Fassung 2)

> **Fassung 2** arbeitet sieben Befunde eines Bauagenten ein, der den
> Firmenfaktions-Pfad gebaut und die Rate **gemessen** hat. Sechs davon halten
> der Quelltextpruefung stand und aendern den Plan; einer (die Behauptung, meine
> Kampfwert-Rechnung sei zu pessimistisch) haelt in der Sache, aber nicht im
> Ergebnis. **Was sich geaendert hat, steht in Abschnitt 7.** Die Gesamtzeit
> bleibt bei rund 71-132 h — aber der dominierende Posten ist ein anderer als in
> Fassung 1: nicht die Firmenarbeit, sondern die **Reputationsbeschaffung**.

Eine Rechnung und eine Reihenfolge. Kein Umbauvorschlag, keine Bewertung der
bisherigen Arbeit. Alle Zahlen entweder **[gemessen]** am laufenden Spielstand
ueber die Bruecke auf Port 8795, **[belegt]** aus `reference/bitburner-src/src/`
(meldet v3.0.2) mit Datei:Zeile, oder **[gerechnet]** aus belegten Formeln mit
genannten Annahmen.

Der Messrahmen: **962 s Spielzeit am 22.08.2026, 08:28-08:44 Uhr**,
`playtimeSinceLastBitnode` 63.913 -> 64.875 s, 16 Proben im Minutenabstand ueber
`getSaveFile`. Waehrend des Fensters hat der Bot **keine** Server gekauft, die
Netzgroesse war konstant — die Raten sind also sauber.

---

## 0. Der Befund in einem Satz

Der Engpass ist **nicht** das Hackinglevel und **nicht** das Geld, sondern der
**Levelmultiplikator `mults.hacking`** — und der kommt ausschliesslich aus
**eingebauten** Augmentierungen, die ihrerseits an **Faktionsreputation**
haengen. Rund **5,7 Millionen Reputation ueber sechs Faktionen** plus ein
**Favor-150-Vorlauf von 1,85 Millionen** sind der teuerste Posten des Knotens
(3.4, 5.1). Alles andere ist nachgelagert.

**Stand Fassung 2:** Der harte Stopper der Fassung 1 — `src/bn4rep.js` verlangte
`data/install-frei.txt`, die kein Skript je geschrieben hat, womit der Einbau
dauerhaft gesperrt war — **ist behoben**. Das Schloss ist umgedreht: es sperrt
jetzt eine Datei (`data/install-sperre.txt`), statt freizugeben
(`src/bn4rep.js:296-310`). Der erste Einbau steht damit unmittelbar bevor
(6 Stuecke in der Warteschlange, Level 518, $16,8 Mrd) [gemessen, 22.08. 13:30].

---

## 1. Bestandsaufnahme (A)

### 1.1 Der Spielstand

| Groesse | Wert | Herkunft |
|---|---|---|
| BitNode | 4, seit **18,0 h** (`playtimeSinceLastBitnode` 64.875 s) | [gemessen] |
| seit letztem Aug-Einbau | **6,9 h** (`playtimeSinceLastAug` 24,78e6 ms zu Messbeginn) | [gemessen] |
| Hackinglevel | **460** (Erfahrung 1,667e7) | [gemessen] |
| `mults.hacking` | **1,38536** | [gemessen] |
| `mults.hacking_exp` | 1,54540 · `faction_rep` 1,16348 · `hacking_money` 1,16348 | [gemessen] |
| Guthaben | $3,10 Mrd (steigt, siehe 1.2) | [gemessen] |
| Augmentierungen | **9 installiert, 3 in der Warteschlange** | [gemessen] |
| Faktionen | The Black Hand, NiteSec, Aevum, Sector-12, CyberSec | [gemessen] |
| Rechnerpark | 25 gemietete Rechner (11x 4.096 GB, 14x 2.048 GB) = **73.728 GB** | [gemessen] |
| Netz gesamt | **79.276 GB** gerootet inkl. `home` 1.024 GB | [gemessen] |
| Boerse | kein Zugang (WSE/TIX/4S alle false) | [gemessen] |
| Source-Files | nur SF1.1 | [gemessen] |
| Karma | -277,8 | [gemessen] |
| Kampfwerte | str 1, def 1, dex 42, agi 38 | [gemessen] |

**Nachtrag, 22.08. 13:30 [gemessen]** — der Stand hat sich waehrend der
Auswertung bewegt: Hacking **518**, Guthaben **$16,8 Mrd**, `home` **2.048 GB**,
Netz **129.452 GB**, **6** Augmentierungen in der Warteschlange (weiterhin 9
installiert), **BitRunners beigetreten** (2.479 Rep), NiteSec 51.939 Rep. Die
Raten in 1.2 bleiben als Messanker gueltig; die Absolutwerte in 1.1 sind der
Stand von 08:44 Uhr.

Die 9 installierten: Neurotrainer I/II, Synaptic Enhancement, BitWire, Wired
Reflexes, Cranial Signal Processors Gen I, Artificial Synaptic Potentiation,
Embedded Netburner Module, Augmented Targeting I. Davon tragen drei einen
`hacking`-Multiplikator: BitWire 1,05 · CSP-G1 1,05 · ENM 1,08 = **1,1907**.
Mal SF1.1 (`applySourceFile.ts:20-26`, `incMult = 1 + mult/100`) ergibt das
1,1907 x 1,16348 = **1,38536** — der gemessene Wert reproduziert sich exakt.
[belegt/gerechnet]

### 1.2 Die Raten (962-s-Fenster, konstantes Netz)

| Groesse | Rate | Bezug |
|---|---|---|
| **Hacking-Erfahrung** | **4.622 exp/s** (Anfang 3.771, Ende ~4.900 — steigt mit dem Level) | 1,667e7 gesamt |
| **Geld netto** | **$2,567 Mio/s = $9,24 Mrd/h** | ohne Serverkauf im Fenster |
| **Faktionsreputation NiteSec** (Arbeitsfaktion) | **3,40 rep/s** | 26.783 -> 30.054 |
| Reputation passiv (CyberSec, Favor 44,8) | **0,19 rep/s** | 24.438 -> 24.622 |
| Reputation passiv (Aevum, Favor 14,8) | 0,067 rep/s | |

Die Erfahrungsrate ist **4,6-fach ueber dem Arbeitsband der ROADMAP**
(1e2-1e3 exp/s). Grund: dort standen 6.508 GB Netz, heute sind es 79.276 GB.
Die ROADMAP-Zahl ist damit ueberholt, nicht falsch.

### 1.3 Die Einnahmequellen seit BitNode-Start (18,0 h) [gemessen, `moneySourceB`]

| Quelle | Betrag | pro Stunde |
|---|---|---|
| Hacking | **+$15,73 Mrd** | $886 Mio/h |
| Codingvertraege | **+$1,003 Mrd** | $56,5 Mio/h |
| Verbrechen | +$9,2 Mio | vernachlaessigbar |
| Server (Ausgabe) | **-$13,07 Mrd** | |
| Augmentierungen | -$2,46 Mrd | |
| Programme/TOR | -$0,37 Mrd | |
| **netto** | **+$0,84 Mrd** | |

Seit dem letzten Einbau (6,9 h) allein: Hacking +$14,48 Mrd, Vertraege
+$0,50 Mrd, Server -$12,65 Mrd. **Praktisch das gesamte Hackingeinkommen ist in
den Rechnerpark geflossen** — und genau deshalb steht die Erfahrungsrate heute
bei 4.622 statt bei 500 exp/s.

### 1.4 Die vier Posten des Abschlusswegs

`Singularity.ts:1124-1176` und `FactionInfo.tsx:138-149` [belegt], BN4-Werte
aus `BitNode.tsx:627-655` nachgeprueft: **`DaedalusAugsRequirement` steht in
case 4 nicht drin**, gilt also mit dem Vorgabewert **30**
(`BitNodeMultipliers.ts:61`). Bladeburner scheidet aus (`canAccessBitNodeFeature(6/7)`).

| # | Posten | Ist | Soll | Rate heute | Restzeit bei heutiger Rate |
|---|---|---|---|---|---|
| 1 | Augmentierungen **installiert** | **9** (+6 wartend) | **30** | Schloss seit 22.08. offen, erster Einbau steht an | 2-3 Zyklen, s. 4.1 |
| 2 | Guthaben | $3,1 Mrd | $100 Mrd | $9,24 Mrd/h | ~10,5 h (aber der Park frisst es) |
| 3 | Hacking (Daedalus-Tor) | 460 | **2.500** | 4.622 exp/s | **unerreichbar bei m=1,385** (1,4e18 exp noetig) |
| 4 | Daedalus-Reputation | 0 | 2.500.000 | — (nicht Mitglied) | s. Abschnitt 3 |
| 5 | Hacking (Endkampf) | 460 | **9.000** | | **8,05e90 exp bei m=1,385** |

Zu Posten 1: `haveAugmentations(n)` prueft `p.augmentations.length >= n`
(`FactionJoinCondition.ts:116-131`) — **die Warteschlange zaehlt nicht**, und
**NeuroFlux zaehlt als genau ein Eintrag**, egal auf welcher Stufe. Die drei
gekauften Augs sind fuer die 30er-Schwelle heute wertlos.

Zu Posten 3 und 5: `skill.ts:13` ergibt umgekehrt
`exp = e^((level/mult + 200)/32) - 534,6`. Der gemessene Level 460 bei
exp 1,667e7 und m=1,38536 reproduziert die Formel auf die Stelle genau.

---

## 2. Der Multiplikator (B) — was erreichbar ist und was er kostet

### 2.1 Das Auszaehlergebnis

Maschinelle Auszaehlung ueber `Augmentations.ts` (136 Bloecke, Klammer-Matching,
Skript im Scratchpad). **31 Augmentierungen tragen ein `hacking`-Feld.**
Davon nach Filter:

| Menge | Anzahl | Bemerkung |
|---|---|---|
| Rohbestand mit `hacking`-Feld | 31 | |
| `BigDsBigBrain` x2,0 | -1 | `factions: []`, keine Vergabestelle |
| `TheSword` x1,1 | -1 | `isSpecial`, nur Darknet |
| `StaneksGift1/2/3` | -3 | nur ChurchOfTheMachineGod, verlangt SF13 |
| `NeuroFluxGovernor` x1,01 | gesondert | wiederholbar, s. 2.4 |
| **ueber Faktionen kaufbar** | **25** | Produkt **22,89** |

Das deckt sich mit der ROADMAP (4.1). Neu ist die **Erreichbarkeitsstaffel in
BN4**, und die ist der eigentliche Befund:

| Stufe | Faktionsmenge | verschiedene Augs | hacking-Produkt | **m mit SF1.1** |
|---|---|---|---|---|
| **A** | jetzige 5 | 24 | 1,906 | **2,22** |
| **B** | + BitRunners | **30** | 3,792 | **4,41** |
| **C** | + Tian Di Hui, Netburners | 41 | 3,792 | 4,41 |
| **D** | + Slum Snakes, Tetrads, The Syndicate | 58 | 3,982 | 4,63 |
| **E** | + **Clarke Inc.** und **OmniTek** (Firmenfaktionen) | 66 | 7,122 | **8,29** |
| **E+** | + Daedalus (ENM Core V3 x1,1 + The Red Pill) | 72 | 7,834 | **9,11** |
| **F** | + **NWO** (Xanipher x1,2) | 75 | 9,401 | **10,94** |

(Daedalus und NWO bieten beide ENM Core V3 an; es zaehlt nur einmal.)

**Zwei Ergebnisse springen heraus:**

1. **Stufe B ergibt exakt 30 verschiedene Augmentierungen.** Ein einziger
   Backdoor auf `run4theh111z` (Hacking 508) reicht rechnerisch fuer die
   Daedalus-Schwelle. Kein Spielraum — Stufe C (Tian Di Hui: Reise +$1 Mio +
   Hacking 50; Netburners: Hacknet 8 GB / 4 Kerne / 100 Stufen) hebt auf 41 und
   ist die billige Reserve.
2. **Ohne Firmenfaktionen ist bei m=4,63 Schluss**, und das reicht nicht
   annaehernd (s. 2.3). Die Firmenfaktionen sind kein Komfort, sie sind
   Voraussetzung.

**Illuminati und The Covenant — korrigiert gegenueber Fassung 1.**

Fassung 1 hat beide gestrichen mit der Begruendung, Kampfwert 850 bzw. 1200 sei
bei Multiplikator 1,163 und `ClassGymExpGain 0.5` unerreichbar. **Diese
Begruendung war in zwei Punkten falsch, und es ist derselbe Fehler, den ich
beim Hacking selbst angeprangert habe:**

1. **`ClassGymExpGain` wird in v3.0.2 nirgends angewandt.** Der Multiplikator
   ist in `BitNodeMultipliers.ts:28` definiert und in `BitNode.tsx:639` fuer BN4
   auf 0,5 gesetzt, aber im ganzen Baum liest ihn kein Rechenpfad. Angewandt
   werden nur `CrimeExpGain` (`Work/Formulas.ts:75`), `FactionWorkExpGain`
   (`:95`), `CompanyWorkExpGain` (`:150`) und `HackExpGain` (`Hacking.ts:37`).
   **Fitnessstudio und Universitaet sind in BN4 also ungedaempft.** [belegt]
2. **Ich habe mit dem heutigen Kampfmultiplikator gerechnet statt mit dem
   erreichbaren** — genau der Methodenfehler, gegen den Abschnitt 2.3
   argumentiert. Nachgezaehlt [gerechnet, Skript im Scratchpad]:

| Faktionsmenge | str | def | dex | agi (bindend) | Kampfwert 850 je Wert |
|---|---|---|---|---|---|
| heute + BitRunners | 1,34 | 1,16 | 1,85 | **1,16** | 4,26e12 exp — unerreichbar |
| + Slum Snakes, Tetrads, The Syndicate | 4,63 | 7,50 | 4,50 | **2,94** | 4,29e6 exp = 81 h Fitnessstudio |
| + Speakers for the Dead, The Dark Army | 23,4 | 13,7 | 8,32 | **4,42** | 2,12e5 exp = **4,0 h** je Wert |

Die Kette ist auch nicht gesperrt: Slum Snakes (Kampf 30, Karma -9), Tetrads
(Kampf 75, Karma -18) und The Syndicate (Kampf 200, Karma -90) liegen bei
Karma -278 [gemessen] nur hinter ein paar Stunden Fitnessstudio; danach
oeffnen Speakers for the Dead und The Dark Army (Kampf 300, 30 bzw. 5
Toetungen). **The Covenant ist in BN4 erreichbar. Meine Aussage war falsch.**

**Trotzdem bleibt beides draussen — aus einem besseren Grund:**

- **The Covenant** bietet SPTN-97 **x1,15 fuer 1,25 Mio Reputation**. Dieselben
  x1,15 kosten ueber NeuroFlux ab Stufe 40 nur **5,95e5 Reputation** (2.4).
  **NeuroFlux ist je Reputationseinheit doppelt so gut** — und verlangt weder
  20 installierte Augmentierungen noch $75 Mrd noch Kampfwert 850 noch die
  ganze Verbrecherkette.
- **Illuminati** bietet QLink x1,75 fuer 1,875 Mio Reputation **und
  $25 Billionen** (`Augmentations.ts`, `moneyCost: 25e12`). Bei einem reifen
  Park ($176-352 Mrd/h, 4.3a) sind das **71-142 h** nur fuer diesen einen
  Kauf. Dieselben x1,75 kosten ueber NeuroFlux ab Stufe 40 rund 5,0e6
  Reputation und **$7,5 Mrd**.

**Bescheid: Der Kampfwert-Zweig ist erreichbar, aber dominiert.** Die
Obergrenze aus Faktions-Augmentierungen bleibt bei **10,94**, nicht weil mehr
unmoeglich waere, sondern weil jeder Schritt darueber teurer ist als
NeuroFlux. Das ist ein staerkeres Argument als das falsche aus Fassung 1.

### 2.2 Preise der entscheidenden Augmentierungen

`repCost` ist **nicht** vom Aug-Zaehler abhaengig, `moneyCost` schon:
`getGenericAugmentationPriceMultiplier()` = `1,9^(Anzahl wartender Augs)`
(`AugmentationHelpers.ts:29-37`, `Constants.ts:41 MultipleAugMultiplier: 1.9`;
SF11-Rabatt greift nicht, SF11 fehlt). **Folge: in einem Zyklus zuerst die
teuren, zuletzt die billigen kaufen** — sonst explodiert die Rechnung.

| Aug | x hacking | Faktion | Rep | Geld (Basis) |
|---|---|---|---|---|
| Cranial Signal Processors G5 | 1,30 | BitRunners | 250k | $2,25 Mrd |
| Xanipher | 1,20 | **NWO** | 875k | $4,25 Mrd |
| OmniTek InfoLoad | 1,20 | **OmniTek** | 625k | $2,875 Mrd |
| nextSENS | 1,20 | **Clarke Inc.** | 437,5k | $1,925 Mrd |
| Neurolink | 1,15 | BitRunners | 875k | $4,375 Mrd |
| Neuronal Densification | 1,15 | **Clarke Inc.** | 187,5k | $1,375 Mrd |
| Artificial Bio-neural Network | 1,12 | BitRunners | 275k | $3,0 Mrd |
| ENM Core V3 | 1,10 | **Daedalus**, ECorp, MegaCorp, Fulcrum, NWO | 1,75 Mio | $7,5 Mrd |
| Neural Accelerator | 1,10 | BitRunners | 200k | $1,75 Mrd |
| The Black Hand | 1,10 | The Black Hand | 100k | $550 Mio |
| CSP G3 | 1,09 | NiteSec, TBH, BitRunners | 50k | $550 Mio |
| ENM Core V2 | 1,08 | BitRunners u.a. | 1,0 Mio | $4,5 Mrd |
| PCDNI | 1,08 | **OmniTek**, ECorp, Blade, 4Sigma | 375k | $3,75 Mrd |
| CRTX42-AA / ENM / Enh. Myelin | 1,08 je | NiteSec / NiteSec / TBH | 45k/15k/100k | klein |
| ENM Core | 1,07 | The Black Hand | 175k | $2,5 Mrd |
| **The Red Pill** | — | **Daedalus** | **2,5 Mio** | **$0** |

**Geld ist bei keinem dieser Posten das Problem.** Bei $9,24 Mrd/h heute und
deutlich mehr nach Parkausbau sind selbst $7,5 Mrd eine Stunde Arbeit.
**Reputation ist das Problem** — und Reputation faellt bei jedem Einbau auf
null zurueck (`Faction.ts:77-85`).

### 2.3 Wieviel Multiplikator braucht Level 9000 wirklich?

Erfahrungsbedarf `E(9000, m)` [gerechnet aus `skill.ts:13`]:

| m | 1,385 | 5 | 10 | 12 | 13 | 14 | **15** | **16** | **17** | **18** | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E | 8,05e90 | 1,39e27 | 8,49e14 | 1,1e13 | 1,29e12 | 2,8e11 | 7,20e10 | 2,23e10 | 7,4e9 | 3,16e9 | 6,63e8 |

Die Erfahrungsrate ist **linear in der Netzgroesse und linear im Hackinglevel**:
`calculateHackingExpGain` (`Hacking.ts:30-38`) haengt nur an `baseDifficulty`
und den Multiplikatoren, aber `calculateHackingTime` (`Hacking.ts:59-79`) ist
`~ 1/(level + 50)`. Aus dem Messanker (Level 451,5, 79.276 GB, 4.505 exp/s)
folgt **`rate = 1,133e-4 x (level+50) x RAM_GB` exp/s** [gerechnet, gemessen
verankert].

Stunden vom Nullpunkt bis Level 9000, bei fester Netzgroesse [gerechnet]:

| Netz | m=13 | m=14 | **m=15** | **m=16** | **m=17** | **m=18** | m=20 |
|---|---|---|---|---|---|---|---|
| 79 TB (heute) | 4.627 | 991 | 261 | 81 | 29 | **11,6** | 2,5 |
| 205 TB | 1.789 | 383 | 101 | 31 | **11,2** | 4,5 | 0,9 |
| 410 TB | 895 | 192 | 50 | **15,7** | 5,6 | 2,2 | 0,5 |
| 819 TB | 448 | 96 | 25 | **7,9** | 2,8 | 1,1 | 0,2 |
| 1.638 TB | 224 | 48 | **12,6** | 3,9 | 1,4 | 0,6 | 0,1 |
| 3.277 TB | 112 | 24 | **6,3** | 2,0 | 0,7 | 0,3 | 0,1 |

**Der Schnitt liegt bei m = 15.** Darunter faellt der Endkampf in den Bereich
von Wochen, darueber in den Bereich von Stunden. **m = 16-18 ist das
Arbeitsziel.**

Aus Stufe F (m = 10,94) folgt damit: **die Augmentierungen allein reichen
nicht.** Es fehlt der Faktor **1,37 bis 1,65**.

### 2.4 NeuroFlux Governor — der fehlende Faktor, und er ist billig

`getAugCost` (`AugmentationHelpers.ts:133-139`): Stufe L kostet
`500 x 1,14^L` Reputation und `750.000 x 1,14^L x 1,9^wartend` Geld;
Wirkung `1,01^L` auf `hacking` (`Augmentations.ts:1159-1200`,
`Constants.ts:36 NeuroFluxGovernorLevelMult: 1.14`). Angeboten von **jeder**
Faktion ausser SoA, Bladeburners und ChurchOfTheMachineGod. Die Stufe
**ueberlebt den Einbau**, der Preis ist immer nur der der **naechsten** Stufe.

| NFG-Stufe | Faktor | Rep noetig | Geld (Basis) | m aus 10,94 (Stufe F) | m aus 9,11 (ohne NWO) |
|---|---|---|---|---|---|
| 20 | 1,220 | 6.872 | $10,3 Mio | 13,3 | 11,1 |
| 30 | 1,348 | 25.475 | $38,2 Mio | 14,7 | 12,3 |
| 40 | 1,489 | 94.442 | $141,7 Mio | **16,3** | 13,6 |
| 50 | 1,645 | 350.116 | $525,2 Mio | **18,0** | **15,0** |
| 60 | 1,817 | 1,298 Mio | $1,95 Mrd | **19,9** | **16,6** |
| 70 | 2,007 | 4,812 Mio | $7,22 Mrd | 21,9 | 18,3 |

**NFG-Stufe 40 bis 50 schliesst die Luecke vollstaendig und kostet weniger
Reputation als eine einzige Firmenfaktions-Augmentierung.** Ab Stufe 60 wird es
teuer, ab 70 unbezahlbar (die Reputation uebersteigt Daedalus' TRP-Preis).

Die rechte Spalte ist die Rueckfallzeile: **faellt NWO aus** (Volhaven,
zusaetzliche Firmenanstellung), traegt NFG-Stufe 50-60 die Sache immer noch
ueber die Schwelle m=15.

### 2.5 Was ein Einbau kostet — und wieviele es sind

Beim Aug-Einbau (`Prestige.ts`, `Faction.ts:77-85`, `ServerHelpers.ts:226-264`,
`AllServers.ts:136-138`) [belegt] gehen verloren: Hackinglevel und alle
Erfahrung, Guthaben (auf $1.262), **alle 25 gemieteten Rechner**, alle
Programme ausser NUKE, TOR, alle Backdoors, alle Faktionsmitgliedschaften,
alle Faktionsreputation, alle **Firmen**reputation (`Company.ts:77-80`).

Erhalten bleiben: Augmentierungen, **Favor** (und es waechst), Karma,
`home`-RAM und -Kerne, alle Skripte und Textdateien auf `home`.

**Bemerkenswerter Nebenbefund:** `Faction.prestigeAugmentation()` setzt auch
`isBanned = false`. Die Stadtfaktionssperre (Sector-12 und Aevum verbannen
Chongqing, New Tokyo, Ishima, Volhaven, `FactionInfo.tsx:498/540/552`) ist
**nach jedem Einbau aufgehoben**. Der Bot koennte in einem spaeteren Zyklus
statt Aevum/Sector-12 eine andere Stadtkombination waehlen. Fuer den
Hacking-Multiplikator bringt das nichts (keine Stadtfaktion traegt ein
`hacking`-Feld), fuer den 30er-Zaehler schon.

**Zahl der noetigen Einbauten** [gerechnet, s. Abschnitt 4]: **4 bis 5**,
davon der letzte der TRP-Einbau selbst.

### 2.6 `keepOnInstall` — die Firmenfaktionen sind ein Einmalposten

Der wichtigste Einzelbefund der Fassung 2, am Quelltext nachgeprueft:

`prestigeAugmentation` sammelt **vor** dem Zuruecksetzen alle Faktionen aus
`[...Player.factions, ...Player.factionInvitations]`, deren `FactionInfo.keep`
gesetzt ist, und traegt sie **danach unbedingt wieder als Einladung ein**
(`Prestige.ts:61-66` und `:118-120`). `ns.singularity.joinFaction`
(`Singularity.ts:750-768`) prueft **nur** `Player.factionInvitations.includes(...)`
— **keine Beitrittsbedingung wird erneut geprueft**. [belegt]

`keepOnInstall: true` tragen genau die **zehn Firmenfaktionen** — ECorp,
MegaCorp, Bachman & Associates, Blade Industries, NWO, Clarke Incorporated,
OmniTek, Four Sigma, KuaiGong, Fulcrum Secret Technologies
(`FactionInfo.tsx:196/222/248/264/281/300/319/340/359/384`) — dazu Church of
the Machine God und Shadows of Anarchy. **NiteSec traegt ausdruecklich
`keepOnInstall: false`** (`:472`).

**Folge, und sie kippt die Reihenfolge aus Fassung 1:** Die 300.000 bis 400.000
Firmenreputation je Konzern sind **einmal fuer den ganzen Knoten** faellig, nicht
einmal je Einbauzyklus. Fassung 1 hat M4 stillschweigend als wiederkehrenden
Posten behandelt und ihn deshalb an die falsche Stelle der Route gesetzt.

**Zweite Folge:** Anstellung und Firmenreputation muessen **nur ein einziges
Mal** aufgebaut werden — und zwar in dem Zyklus, in dem das Hackinglevel am
hoechsten ist, weil die Rate linear daran haengt (3.3).

---

## 3. Die Reputationsseite (C)

### 3.1 Die vier Kanaele im direkten Vergleich

`FactionWorkRepGain = 0.75` in BN4 [belegt, `BitNode.tsx:645`]. Die
Faktionsarbeitsrate ist `((hacking + int/3)/975) x mults.faction_rep x
(1 + favor/100) x 0.75 x shareBonus` je 200-ms-Zyklus
(`PersonObjects/formulas/reputation.ts:16-24`, `Constants.ts:16 MaxSkillLevel: 975`)
— also **linear im Hackinglevel**.

| Kanal | Formel/Beleg | heute (Level 460, Favor 41,6) | bei Level 2.500, Favor 150 |
|---|---|---|---|
| **Faktionsarbeit** | `reputation.ts:16-24` | **3,40 rep/s** [gemessen] | **28,0 rep/s** [gerechnet] |
| **Passiv** (Nichtarbeitsfaktion) | `FactionHelpers.tsx:155-168`, `favorMult = min(0,1; favor/1000+0,01)` | 0,19 rep/s bei Favor 44,8 | 0,34 x Arbeitsrate, gedeckelt bei Favor 90 |
| **`ns.share`** | `Share.ts:43-48`, `bonus = 1 + ln(threads)/25` | 19.800 Faeden auf 79 TB -> **x1,40** | derselbe Faktor |
| **Codingvertraege** | `PlayerObjectGeneralMethods.ts:514-537`, `2500 x difficulty x rewardScaling/3` | ~5.700 rep/h **verteilt auf 5 Faktionen** | unveraendert (levelunabhaengig) |
| **Spenden ab Favor 150** | `donation.ts:9-11`, `rep = $ /1e6 x 1,16348 x 0,75` | **873 rep je $1 Mrd** | dito |

Die Vertragsrate aus dem Messwert hergeleitet: $1,003 Mrd Vertragsgeld in
18,0 h, Geldpreis `75e6 x difficulty / 3` (`Constants.ts:93`), vier gleich
wahrscheinliche Belohnungsarten (`ContractGenerator.ts:178-189`), davon drei
Faktionsreputation (die Firmenvariante faellt ohne Anstellung auf
Faktionsreputation zurueck, `:539-552`). Bei mittlerer Schwierigkeit 3 sind das
rund **3,0 Vertraege/h**, davon 2,3 mit Reputationslohn zu je ~2.500 —
**~5.700 rep/h gesamt, ~1.150 rep/h auf die Zielfaktion**. Das ist etwa
**9 % der Faktionsarbeit** und laeuft nebenher; als Hebel taugt es nicht, als
Gratiszugabe schon.

**`ns.share` ist der beste Sofort-Hebel**: +40 % Reputation fuer den Preis der
geopferten Faeden. Bei einem RAM-Anteil von 20 % fuer Share ergibt
`1 + ln(0,2 x 19.800)/25 = 1,335` — also **+33,5 % Reputation gegen -20 %
Erfahrung und Geld**. Das lohnt in der Reputationsphase eines Zyklus und
lohnt nicht in der Aufbauphase. (`src/bn4net.js:745-765` kann das bereits,
Deckel `SHARE_DECKEL = 100` Faeden — das ist um Groessenordnungen zu wenig.)

### 3.2 Die Spendenschwelle — wie weit ist sie und was kostet sie

`favorToRep(f) = 25.000 x (1,02^f - 1)` (`favor.ts:12-15`),
`favorNeededToDonate = 150 x FavorToDonateToFaction` (= 150 in BN4)
(`donation.ts:16-18`, `BitNodeMultipliers.ts:143`).

**Favor 150 entspricht 462.550 kumulierter Reputation.** Favor waechst nur beim
Einbau (`addRepToFavor`), nicht laufend.

| Faktion | Favor heute | rep-Aequivalent | **noch noetig bis Favor 150** | bei 3,4 rep/s | bei 28 rep/s |
|---|---|---|---|---|---|
| CyberSec | 44,82 | 34.700 | **427.850** | 35,0 h | 4,2 h |
| NiteSec | 41,64 | 32.020 | **430.530** | 35,2 h | 4,3 h |
| Sector-12 | 15,73 | 8.940 | 453.610 | 37,1 h | 4,5 h |
| Aevum | 14,78 | 8.390 | 454.160 | 37,1 h | 4,5 h |
| The Black Hand | 0 | 0 | 462.550 | 37,8 h | 4,6 h |
| Daedalus | 0 | 0 | 462.550 | — | 4,6 h |

**Die Schwelle ist heute unbezahlbar und bei Level 2.500 bezahlbar.** Das ist
der Grund, warum die Reihenfolge in Abschnitt 4 zuerst das Level und dann die
Reputation baut, nicht umgekehrt.

**Und danach ist Reputation ein Geldproblem:** $1 Mrd = 873 rep. Die
2,5 Mio Reputation fuer The Red Pill kosten **$2,86 Billionen** — bei einem
ausgebauten Park (Abschnitt 4.2, $350-700 Mrd/h) sind das **4 bis 8 Stunden**.
Ohne Spendenrecht sind dieselben 2,5 Mio bei 28 rep/s **24,8 Stunden**
Faktionsarbeit, bei der man nichts anderes tut.

**Rangfolge der Kanaele, eindeutig:**
**Spenden (ab Favor 150) >> Faktionsarbeit x Share > Passiv > Codingvertraege.**
Der Umweg ueber einen zusaetzlichen Einbau, nur um Favor 150 zu erreichen,
zahlt sich bei Daedalus aus (24,8 h Arbeit gegen 4-8 h Geld) und bei jeder
Faktion, aus der mehr als ~500.000 Reputation gezogen werden soll.

### 3.3 Der Punkt, den Fassung 1 uebersehen hat: Spenden kosten keine Zeit

Faktionsarbeit ist **exklusiv** — wer fuer eine Faktion arbeitet, arbeitet nicht
fuer eine andere und nicht fuer eine Firma. Der Rechnerpark laeuft daneben
**unabhaengig weiter**. Spendengeld entsteht also **parallel** zur Arbeit, und
die beiden Kanaele addieren sich:

| Geldrate (Parkgroesse) | Spenden-Aequivalent | + Faktionsarbeit (H 2.500, Favor 150, share 1,5) | Summe |
|---|---|---|---|
| $9,2 Mrd/h (79 TB, heute) | 2,2 rep/s | 42,0 rep/s | 44,2 |
| $44 Mrd/h (410 TB) | 10,7 rep/s | 42,0 rep/s | 52,7 |
| $88 Mrd/h (819 TB) | 21,3 rep/s | 42,0 rep/s | 63,3 |
| $176 Mrd/h (1,6 PB) | **42,7 rep/s** | 42,0 rep/s | **84,7** |
| $352 Mrd/h (3,3 PB) | **85,4 rep/s** | 42,0 rep/s | **127,4** |

**Ab etwa 1,6 PB Park uebertrifft der Spendenkanal die Faktionsarbeit.** Das
ist der Grund, warum der Parkausbau (4.3a) nicht nur die Erfahrung, sondern
auch die Reputationsbeschaffung traegt — und warum der Reputationsposten in
Abschnitt 5 eine so breite Bandbreite hat: er haengt an der Parkgroesse.

### 3.4 Die Reputationsrechnung des ganzen Knotens

Reputation ist eine **Schwelle, kein Verbrauch**: wer in einem Zyklus mehrere
Augmentierungen bei derselben Faktion kauft, braucht nur das Maximum. Der
gesamte Restbedarf, auf den getrimmten Bauplan aus 4.1:

| Faktion | teuerster Posten | Schwelle |
|---|---|---|
| **Daedalus** | The Red Pill | **2.500.000** |
| **BitRunners** | ENM Core V2 (x1,08) | **1.000.000** |
| beliebige Faktion | **NeuroFlux Stufe 57** | **874.000** |
| **OmniTek** | OmniTek InfoLoad (x1,2) | **625.000** |
| **Clarke Inc.** | nextSENS (x1,2) | **437.500** |
| The Black Hand | ENM Core (x1,07) | 175.000 |
| NiteSec | CSP-G3 (x1,09) | 50.000 |
| **Summe** | | **~5,7 Mio** |

Dazu der **Favor-150-Vorlauf**: 462.550 Reputation je Faktion, aus der gespendet
werden soll (3.2). Fuer Daedalus, BitRunners, OmniTek und Clarke sind das
1,85 Mio Reputation, die **vor** dem Spendenrecht rein durch Arbeit entstehen
muessen — bei 17-24 rep/s sind das **21-30 h**. Das ist der harte Boden des
Plans; er laesst sich nur dadurch druecken, dass ein Teil davon in den Zyklen
anfaellt, die ohnehin gefahren werden (NiteSec steht so schon bei Favor 41,6).

**Diese ~5,7 Mio Reputation sind der dominierende Posten des Knotens** — nicht
die Firmenarbeit, nicht das Level, nicht das Geld.

---

## 4. Die Reihenfolge (D)

### 4.0 Stufe 0 — der Blocker (Bauarbeit, keine Spielzeit)

Reihenfolge ist bindend.

1. ~~`data/install-frei.txt` erzeugen.~~ **Erledigt am 22.08.** Das Schloss ist
   umgedreht: `src/bn4rep.js:296-310` sperrt jetzt ueber
   `data/install-sperre.txt`, statt ueber eine Freigabedatei freizugeben. Damit
   haelt ein vergessenes Schloss den Bot nicht mehr auf. **Der Depot-Handschlag
   aus ROADMAP 7.6 ist damit aber ebenfalls weg** — solange kein Boersenzugang
   besteht (4.3b sagt: soll auch keiner kommen), ist das folgenlos; kommt je
   einer, muss der Riegel zurueck.
2. ~~Firmenanstellung und Firmenarbeit.~~ **Erledigt am 22.08.** Rate gemessen,
   s. 4.1.
3. **Kaufreihenfolge nach Preis absteigend.** Sortiert die Kette **aufsteigend**,
   ist das bei `1,9^wartend` die teuerstmoegliche Reihenfolge. Bei 8 gekauften
   Augmentierungen ist der Unterschied ein Faktor ~40 auf den teuersten Posten.
   **Vor dem ersten grossen Zyklus zu pruefen.**
4. **NeuroFlux-Kauf.** Ohne ihn endet der Multiplikator bei 10,94, und der
   Endkampf dauert Wochen (Tabelle 2.3). NFG ist der billigste
   Multiplikatorposten des ganzen Plans (2.4) und der einzige, der die
   Firmenfaktionen ersetzen koennte.
5. **`donateToFaction` scharfschalten.** Ohne Spendenkanal kostet die
   Reputationsphase 70-98 h statt 33-55 h (5.1). **Nach NFG der wirksamste
   Einzelbaustein.**
6. **Share-Deckel anheben.** `src/bn4net.js` deckelt bei 100 Faeden; wirksam
   waeren 20-50 % des Parks (x1,4 bis x1,5 auf alle Reputation, 3.1).

Danach nachziehen: Stadtreise (`travelToCity`) und Hacknet fuer die
Reservefaktionen Tian Di Hui und Netburners.

### 4.1 Die Meilensteine

**Die Reihenfolge hat sich gegenueber Fassung 1 an einer Stelle geaendert, und
sie ist die wichtigste Aenderung des Dokuments: M4 steht jetzt HINTER M5.**

| # | Meilenstein | Bedingung | geschaetzte Spielzeit |
|---|---|---|---|
| **M1** | **BitRunners** — **erledigt** | Backdoor `run4theh111z` bei Hacking 505 | — (am 22.08. eingetreten, 2.479 Rep) |
| **M2** | **Einbau 1** | 8-12 Augs gekauft (teuerste zuerst), alle billigen aus CyberSec/NiteSec/Sector-12/Aevum/TBH plus die erreichbaren BitRunners-Augs | **4-8 h** (Reputationsgrenze, nicht Geld) |
| **M3** | **30 installiert** | Einbau 2 (ggf. 3); Tian Di Hui und Netburners als Reserve (42 statt 31 Augs) | **+8-16 h** |
| **M5a** | **Hacking 2.500** | m ~4,4 nach M3; 16 h bei 79 TB, deutlich weniger mit groesserem Park | **+4-8 h** |
| **M5b** | **Backdoors** | `clarkinc` (Level 1.151), `omnitek` (Level 927) — beide 5 Ports, beide unter 2.500, liegen also auf dem Weg | **+0,5 h** |
| **M4** | **Firmenfaktionen — EINMALIG** | Anstellung bei Clarke (Aevum) und OmniTek (Volhaven), je **300.000** Firmenreputation (400.000 x 0,75 Backdoor-Rabatt); danach `keepOnInstall` (2.6) | **+10-14 h**, **nie wieder** |
| **M5c** | **Daedalus offen** | 30 Augs installiert + $100 Mrd + Hacking 2.500 | **+1-2 h** |
| **M6** | **Favor 150** | 462.550 Rep je Faktion bei Daedalus, BitRunners, OmniTek, Clarke = 1,85 Mio, dann Einbau | **+21-30 h** |
| **M7** | **TRP-Zyklus** | Alles neu beitreten (Firmenfaktionen gratis), **spenden** bis zu den Schwellen aus 3.4 (~5,7 Mio Rep), TRP + Clarke-/OmniTek-Augs + ENM Core V3 + **NFG bis Stufe 57** kaufen, **einbauen** | **+12-25 h** |
| **M8** | **Endkampf** | Park neu aufbauen, Level 9000, 5 Portknacker ($287,2 Mio) + TOR, `nuke("w0r1d_d43m0n")`, `destroyW0r1dD43m0n(6, "boot.js")` | **+3-8 h** bei m=16-18 |

**Warum M4 hinter M5a gehoert — die Rate ist linear im Hackinglevel.**
`CompanyPosition.calculateJobPerformance` (`:156-172`) ist
`repMultiplier x sum(effectiveness x skill)/975/100`, mit
`hackRatio = hackingEffectiveness x hacking / 975`. Kein Deckel.
**Messanker** (Bauagent, zwei Fenster a 1.263 s, Clarke Inc., IT Intern,
Hacking 505 -> 514): **2,4623 und 2,4714 rep/s**. Das sind
**4,842e-3 rep/s je Hackingpunkt**; die Formel reproduziert den Messwert.
Damit [gerechnet]:

| Hackinglevel | rep/s (nach Befoerderung) | 300.000 mit Backdoor | 400.000 ohne |
|---|---|---|---|
| **518 (heute)** | 2,92 | **28,5 h je Firma** | 38,0 h |
| 1.500 | 8,46 | 9,9 h | 13,1 h |
| 2.000 | 11,27 | 7,4 h | 9,9 h |
| **2.500** | **14,09** | **5,9 h je Firma** | 7,9 h |
| 3.000 | 16,91 | 4,9 h | 6,6 h |

**Fassung 1 hat M4 vor M5 gesetzt. Das haette bei Hacking ~518 rund 57 h fuer
zwei Firmen gekostet statt 12 h — ein Fehler von rund 45 Stunden.** Die
13 rep/s aus Fassung 1 waren richtig gerechnet, standen nur an der falschen
Stelle der Route.

**Zwei Rabatte, die Fassung 1 nicht kannte:**

- **Backdoor-Rabatt.** `CompanyRequiredReputationMultiplier: 0.75`
  (`Constants.ts:110`) wirkt ueber `calculateEffectiveRequiredReputation`
  (`Company/utils.ts:15-19`) sowohl auf die Faktionsbedingung
  (`FactionJoinCondition.ts:82-86`) **als auch auf die Befoerderungshuerden**
  (`GetJobRequirements.ts:15-16`). 400.000 -> **300.000**, 7.000 -> 5.250.
  `clarkinc` verlangt Level 1.151, `omnitek` 927, je 5 Ports [gemessen aus dem
  Spielstand] — beides liegt vor Hacking 2.500.
- **Firmenreputation ist in BN4 ungedaempft.** `CompanyWorkRepGain` fehlt in
  `BitNode.tsx` case 4 und steht nur in case 11 (`:1066`, dort 0,2). Gedaempft
  sind nur Lohn (`CompanyWorkMoney 0.1`) und Erfahrung
  (`CompanyWorkExpGain 0.5`) — beides fuer diesen Zweck egal. [belegt]

**NWO bleibt draussen.** Xanipher x1,2 fuer 875.000 Faktionsreputation plus
6 h Firmenarbeit ist praktisch gleichwertig zu NeuroFlux (x1,2 kostet ab
Stufe 40 rund 1,04 Mio Rep, 2.4) und kostet zusaetzlich eine dritte
Anstellung. Ohne NWO reicht **NeuroFlux Stufe 57** fuer m = 15.

**Charisma trainieren lohnt nicht** [gerechnet, Bauagent, von mir
nachvollzogen]: Universitaets-Leadership gibt 4 chaExp je Zyklus mal
`location.expMult` — Charisma 275 kostet rund 12 h und bringt ueber
`chaRatio` rund +11 % auf einen 12-h-Posten. Nettoverlust.

### 4.2 Was parallel laeuft

- **Codingvertraege** laufen immer mit (alle 30 Typen sind geloest, `src/contracts.js`)
  und bringen $56 Mio/h plus ~5.700 rep/h gratis.
- **Parkausbau** und **Levelaufbau** sind derselbe Vorgang — beide skalieren
  linear mit RAM. Sie stehen nie im Wettbewerb.
- **Share** wird nur in der Reputationsphase eines Zyklus zugeschaltet, nie in
  der Aufbauphase.
- **Firmenarbeit (M4) und Faktionsarbeit sind gegenseitig exklusiv** — beide
  belegen `currentWork`. **Spenden sind es nicht** (3.3): Geld entsteht
  nebenher. Deshalb ist die Reihenfolge innerhalb der Spaetphase: erst das
  Level hochziehen (Park), dann die exklusive Arbeit dorthin legen, wo die Rate
  am hoechsten ist, und den Geldkanal ununterbrochen mitlaufen lassen.

### 4.3 Die vier Fragen

**(a) Lohnt der Serverausbau? — Ja, uneingeschraenkt. Er ist der Plan.**

Erfahrung **und** Geld sind beide linear in der Netzgroesse; die gemessene
Konstante ist `1,133e-4 x (level+50) x RAM_GB` exp/s bzw.
`6,44e-2 x (level+50) x RAM_GB` $/s. Der beobachtete Befund "-16 % Geld bei
10-facher Erfahrung" ist kein Zielkonflikt, sondern eine **Umverteilung von
Faeden zwischen `hack` und `weaken/grow`** — die Summe haengt am RAM, nicht an
der Aufteilung. Serverpreise in BN4 (`ServerPurchases.ts:22-41`,
`CloudServerSoftcap 1.2`, Limit 25, MaxRam 1 PB) [belegt]:

| Stufe je Rechner | Preis je Rechner | 25 Rechner | Netz | Ertrag bei Level 460 |
|---|---|---|---|---|
| 4.096 GB (heute anteilig) | $0,67 Mrd | $16,8 Mrd | 102 TB | $11 Mrd/h |
| 8.192 GB | $1,61 Mrd | $40,4 Mrd | 205 TB | $22 Mrd/h |
| 16.384 GB | $3,87 Mrd | $96,9 Mrd | 410 TB | $44 Mrd/h |
| 32.768 GB | $9,30 Mrd | $232,5 Mrd | 819 TB | $88 Mrd/h |
| 65.536 GB | $22,3 Mrd | $557,9 Mrd | 1.638 TB | $176 Mrd/h |
| 131.072 GB | $53,6 Mrd | $1.339 Mrd | 3.277 TB | $352 Mrd/h |

Reinvestition ab dem heutigen Stand [gerechnet]: **102 TB nach 1,8 h · 205 TB
nach 5,5 h · 410 TB nach 9,9 h · 819 TB nach 15,1 h · 1.638 TB nach 21,5 h**.
Der Zeitgewinn beim Endkampf ist derselbe Faktor: 410 TB statt 79 TB verkuerzt
Level 9000 bei m=16 von **81 h auf 15,7 h**.

**Vorbehalt, ausdruecklich:** die Geldseite saettigt. Die Summe aller
`moneyMax` auf gerooteten Rechnern ist **$797,2 Mrd** [gemessen], und die neun
reichsten (ecorp $179 Mrd, megacorp $117 Mrd, nwo $86 Mrd, ...) verlangen
Hacking 927-1.181, sind also heute **gar nicht hackbar**. Ab etwa 1-3 PB Netz
ist nicht mehr das RAM der Engpass, sondern die Nachwachsrate der Ziele. Die
**Erfahrungs**seite saettigt nicht — `weaken` und `grow` liefern Erfahrung ohne
Geldbezug. Die Zeilen ueber 3.277 TB in Tabelle 2.3 sind daher als
Erfahrungsrechnung gueltig, als Geldrechnung nicht.

**(b) Lohnt der Boersenzugang? — Nein.**

$31,2 Mrd fuer WSE ($200 Mio) + TIX ($5 Mrd) + 4S-Daten ($1 Mrd) + 4S-API
($25 Mrd) (`StockMarket/data/Constants.ts:7-10`; in BN4 **keine**
BitNode-Multiplikatoren auf diese Preise, `StockMarketCosts.ts:4-18`). Drei
Gruende:

1. **Der Vergleichsmassstab ist $9,24 Mrd/h heute und $44-352 Mrd/h nach
   Parkausbau.** Die $31,2 Mrd sind derselbe Betrag wie ein Ausbauschritt auf
   410 TB — der verdoppelt das Einkommen *und* die Erfahrung dauerhaft. Die
   Boerse tut beim Level gar nichts.
2. **Ohne SF8 nur Long** (`NetscriptFunctions/StockMarket.ts:46-53`: `buyShort`
   und `placeOrder` verlangen SF8.2 bzw. SF8.3) — die Haelfte der Kursbewegung
   ist nicht handelbar, und `maxShares` deckelt bei 20 % der Aktien
   (`Stock.ts:149-150`).
3. **Das Depot muss vor **jedem** Einbau liquidiert werden** (`Prestige.ts:166-171`
   ruft `initStockMarket()`, `playerShares` verfaellt **ohne Auszahlung**). Bei
   4-5 geplanten Einbauten ist das viermal ein Handschlag, der schiefgehen kann,
   fuer einen Ertrag, der neben dem Park nicht ins Gewicht faellt.

**Der Zugang ist erst in BN8 interessant** (dort gratis, `Prestige.ts:161-164`,
und `ScriptHackMoneyGain 0`).

**(c) Wieviele Einbauten noch, und wann der letzte?**

**Vier bis fuenf.** Zuordnung:

| Einbau | Zweck | m danach |
|---|---|---|
| 1 (M2) | 3 wartende + 5-9 billige Augs; erster echter Multiplikatorsprung | ~2,2-2,8 |
| 2 (M3) | BitRunners-Augs (CSP-G5 x1,3, ABNN x1,12, Neural Accelerator x1,1) | ~4,0-4,4 |
| 3 (M3/M5) | Rest bis **30 installiert**; Level 2.500 wird hier erreichbar | ~4,4-4,6 |
| 4 (M6) | Daedalus-Zyklus: Favor 150 bei Daedalus (und moeglichst bei Clarke/OmniTek) einsammeln, dabei Firmenfaktions-Augs mitnehmen | ~8,3-9,1 |
| **5 (M7) — der letzte** | **The Red Pill** + ENM Core V3 (+ Xanipher, falls NWO) + NeuroFlux bis Stufe 40-60 | **16-20** |

**Der letzte Einbau ist zwingend derjenige, der The Red Pill enthaelt** — vorher
haengt `w0r1d_d43m0n` gar nicht am Netz (`Prestige.ts:173-181`), nachher waere
jeder weitere Einbau ein Ruecksetzer auf Level ~m. Nach Einbau 5 gilt: Park von
$1.262 neu aufbauen, Portknacker neu kaufen, Level 9000 erreichen, dann
`nuke` + `destroyW0r1dD43m0n`. **Zwischen Einbau 5 und dem Endkampf darf nichts
mehr eingebaut werden**, auch kein NeuroFlux.

**(d) Gibt es einen schnelleren Weg? Kampfwert 1500 statt Hacking 2500? — Nein,
aber die Begruendung aus Fassung 1 war falsch.**

`someCondition([haveSkill("hacking", 2500), haveCombatSkills(1500)])`
(`FactionInfo.tsx:141-145`) [belegt].

Fassung 1 rechnete mit dem **heutigen** Kampfmultiplikator (1,163) und mit
einer Daempfung, die es nicht gibt (`ClassGymExpGain` wird nirgends angewandt,
2.1). Richtig gerechnet, mit der Verbrecherkette Slum Snakes -> Tetrads ->
The Syndicate -> Speakers/Dark Army (bindender Wert: Agility x4,42):

| Ziel | exp je Wert bei m=4,42 | Fitnessstudio (14,7 exp/s, Powerhouse Gym) |
|---|---|---|
| Kampfwert 850 (The Covenant) | 2,12e5 | 4,0 h je Wert, **16 h fuer alle vier** |
| Kampfwert 1200 (Illuminati) | 2,52e6 | 47,6 h je Wert, 190 h |
| **Kampfwert 1500 (Daedalus)** | **2,11e7** | **398 h je Wert, 1.590 h** |

Dazu kaeme der Aufbau der Kette selbst (Kampf 30 -> 75 -> 200 -> 300, rund
8-12 h Fitnessstudio, plus 30 Toetungen fuer Speakers for the Dead).

**Kampfwert 1500 bleibt also aussichtslos** — jetzt mit richtiger Arithmetik.
Hacking 2.500 kostet bei m=4,4 rund **16 h**, bei m=8 **1,6 h** [gerechnet,
gekoppelte Simulation]. Die Hacking-Bedingung ist nicht nur schneller, sie ist
fuer Daedalus die einzige.

**Was der korrigierte Kampfzweig dagegen wirklich eroeffnet** (2.1): The
Covenant bei Kampfwert 850 ist erreichbar — nur nicht lohnend, weil NeuroFlux
denselben Multiplikator je Reputationseinheit doppelt so guenstig liefert.

Zwei kleinere Abkuerzungen, die es **gibt**:

- **Tian Di Hui und Netburners** sind fast gratis (Reise + $1 Mio; Hacknet
  8 GB/4 Kerne/100 Stufen) und heben den Augbestand von 30 auf 41. Ohne sie hat
  Stufe B **exakt** 30 — jeder Fehlkauf kostet dann einen ganzen Zyklus.
- **Clarke Incorporated sitzt in Aevum** (`LocationsMetadata.ts:33`) — dort
  steht der Bot bereits. **Clarke ist damit die billigste Firmenfaktion des
  Plans**: keine Reise, und mit nextSENS x1,2 und Neuronal Densification x1,15
  zugleich die ertragreichste je Reputationseinheit (437,5k bzw. 187,5k Rep).
  OmniTek und NWO stehen in Volhaven (`:387`, `:396`) und kosten je eine Reise
  ($200.000, `Constants.ts:28`). **Wenn nur eine Firmenfaktion gebaut wird, dann
  Clarke.**

---

## 5. Der ehrliche Gesamtwert (E)

### 5.1 Restzeit

| Posten | untere Grenze | obere Grenze | Anteil |
|---|---|---|---|
| Bauarbeit, Rest (Installer, NFG-Kauf, Spenden, Share-Deckel) | 6 h | 15 h | Entwicklung, keine Spielzeit; Firmenpfad ist gebaut |
| M2/M3 zwei bis drei Einbauzyklen bis 30 Augs installiert | 12 h | 24 h | Park- und Reputationsaufbau je Zyklus |
| M5a/b Hacking 2.500 + Backdoors `clarkinc`/`omnitek` | 4 h | 9 h | |
| **M4 Firmenfaktionen (Clarke + OmniTek), EINMALIG** | **10 h** | **14 h** | war in Fassung 1 mit 15-30 h und an falscher Stelle |
| M5c $100 Mrd + Daedalus-Beitritt | 1 h | 2 h | faellt nebenher an |
| **M6/M7 Reputationsbeschaffung (~5,7 Mio Rep, Favor-Vorlauf 1,85 Mio)** | **33 h** | **55 h** | **dominierend** |
| Kaeufe + letzter Einbau | 2 h | 5 h | |
| M8 Endkampf (Park + Level 9000 + Zerstoerung) | 3 h | 8 h | bei m=16-18 |
| **Summe Spielzeit** | **~65 h** | **~117 h** | |
| **Summe inkl. Bauarbeit** | **~71 h** | **~132 h** | |

**Der dominierende Posten ist jetzt die Reputationsbeschaffung (M6/M7), nicht
mehr M4.** Er zerfaellt in zwei Haelften mit ganz verschiedenen Eigenschaften:

- **Favor-150-Vorlauf, 1,85 Mio Reputation ueber vier Faktionen: 21-30 h.**
  Reine Arbeitszeit, nicht durch Geld ersetzbar (vor Favor 150 gibt es kein
  Spendenrecht), nicht parallelisierbar. **Das ist der harte Boden des Knotens.**
- **Kaufschwellen, ~5,7 Mio Reputation: 12-25 h.** Hier wirkt der Spendenkanal
  (3.3), und die Spanne ist fast ausschliesslich eine Frage der Parkgroesse:
  bei 819 TB 63 rep/s, bei 3,3 PB 127 rep/s.

**Was sich gegenueber Fassung 1 verschoben hat:** M4 ist um rund 12 h
geschrumpft (einmalig statt je Zyklus, Backdoor-Rabatt, richtige Stelle in der
Route). Die Reputationsposten sind um rund 25 h **gewachsen**, weil Fassung 1
nur den Daedalus-Vorlauf gezaehlt hat und nicht den fuer BitRunners, OmniTek und
Clarke. **Netto bleibt die Gesamtzeit fast gleich; die Zusammensetzung ist eine
andere, und der Plan ist an der teuersten Stelle jetzt richtig sortiert.**

Die ROADMAP nennt fuer BN4 **60-120 h**. Die Spanne haelt weiterhin. Und der
Bot steht heute bei **0 % davon**, weil er nicht einbaut (Abschnitt 0).

### 5.2 Ist der Abschluss noch die richtige Entscheidung?

Die ROADMAP sagt Ja, weil SF4 die Automatisierung aller Folgeknoten traegt.
**Mit den heutigen Zahlen haelt die Begruendung — aber knapper und aus einem
anderen Grund als dort genannt.**

**Was gegen den Abschluss spricht, gerechnet:**

Auf der V2-Route (Bladeburner) braucht man Singularity kaum. `blade.js` (voll,
50,6 GB gemessen) und `domclick.js` (27,6 GB) skalieren **nicht** mit SF4
(`BladeburnerApiBase = 4`, `RamCostGenerator.ts:61`). Der Zeitgewinn durch SF4
je Folgeknoten sind Aufbaudinge — Fitnessstudio fuer Kampfwert 100,
Stadtreise, TOR — und die sind auch ueber den DOM machbar. Grosszuegig
geschaetzt **1-3 h je Knoten x 13 Knoten = 13-39 h**. Dem stehen **60-130 h**
fuer den BN4-Abschluss gegenueber. **Nach dieser Rechnung allein ist
`b1tflum3(6, "boot.js")` klar besser.**

**Was fuer den Abschluss spricht, und es traegt:**

`checkSingularityAccess` (`NetscriptHelpers.tsx:438-446`) prueft
`canAccessBitNodeFeature(4)` = `bitNodeN === 4 || activeSourceFileLvl(4) > 0`.
Ohne SF4 ist ausserhalb von BN4 **keine** Singularity-Funktion verfuegbar —
auch `destroyW0r1dD43m0n` nicht und auch `b1tflum3` nicht. Damit gilt:

> **Ohne SF4 ist der DOM-Klick der einzige Ausgang aus jedem der 13
> verbleibenden Knoten. Es gibt keinen Rueckfall.**

Die ROADMAP bewertet genau diesen DOM-Ausgang als **argumentativ belegt, nicht
getestet** (10.5), und beschreibt seinen Fehlermodus — Spiel bleibt auf der
BitVerse-Seite stehen, kein Terminal, kein Skript, nur ein Mensch kommt da
heraus (7.2). Dreizehnmal auf einen ungetesteten Alleinausgang zu setzen ist
kein Zeitproblem, sondern ein Risikoprofil, das die Zielfunktion
("minimiere Gesamt-Wanduhrzeit") nicht abbildet.

**Aendert Fassung 2 diesen Bescheid? — Nein, und der Grund ist wichtig.**

Die Befunde des Bauagenten haben M4 um rund 12 h verkleinert. Wenn M4 der
dominierende Posten waere, muesste die Rechnung neu gemacht werden. **M4 war
aber nie der dominierende Posten** — in der korrigierten Buchfuehrung ist es
die Reputationsbeschaffung (5.1), und die ist **nicht** geschrumpft, sondern
gewachsen. Die Gesamtzeit bleibt bei 71-132 h gegen 13-39 h ersparte
Bequemlichkeit. **Die Zeitrechnung spricht unveraendert fuer den Ausstieg;
allein das Risikoargument spricht dagegen.**

**Mein Bescheid — und er weicht von der ROADMAP in der Reihenfolge ab:**

Die Entscheidung haengt nicht an den 71-132 h, sondern an **einem Test, der
1-2 h kostet**: T1/T2 aus ROADMAP 7.8, der DOM-Ausgang in einer
Spielstandkopie.

- **T2 besteht** -> die 71-132 h fuer BN4 kaufen 13-39 h Bequemlichkeit.
  Das ist ein schlechtes Geschaeft. **Dann `b1tflum3(6, "boot.js")`**, und SF4
  spaeter aus einem BN4-Wiederholungslauf holen, der nach SF6 kein V1-Lauf mehr
  ist und laut ROADMAP 8.2 nur **29 h** kostet. Das ist der eigentliche Befund
  dieses Dokuments: **BN4 spaeter zu wiederholen ist billiger, als es jetzt zu
  Ende zu spielen.**
- **T2 besteht nicht** -> BN4 zu Ende spielen, nach dem Plan oben.

Die Abbruchbedingung aus ROADMAP 6.1 ("binnen 48 h weder $5 Mrd noch 150.000
Reputation") ist ueberholt: **$5 Mrd sind heute 32 Minuten.** Sie misst die
falsche Groesse. Die richtige Abbruchbedingung lautet:

> **Sind 48 h nach Behebung des Einbau-Blockers nicht mindestens 20
> Augmentierungen installiert und `mults.hacking >= 4,0`, wird BN4 verlassen.**

Beides ist mit `tools/save.js` in einer Zeile ablesbar.

---

## 6. Wo ich unsicher bin

1. ~~Firmenreputation ist gerechnet, nicht gemessen.~~ **Erledigt in Fassung 2:**
   der Bauagent hat 2,4623 und 2,4714 rep/s bei Hacking 505-514 gemessen, die
   Formel reproduziert das. Der Posten ist jetzt der bestverankerte des Plans.
   Offen bleibt nur, ob die Befoerderungsstufen ohne Charisma-Training wirklich
   erreichbar sind (der Faktor 14,1/12,1 ist uebernommen, nicht geprueft).
1a. **Neu unsicher: die Reputationsbeschaffung (M6/M7), 33-55 h.** Sie ist der
   groesste Posten und beruht auf zwei nicht gemessenen Annahmen — dass sich
   `ns.share` in der Reputationsphase wirklich auf x1,5 bringen laesst, und dass
   der Park in dieser Phase 819 TB bis 3,3 PB erreicht. Faellt beides aus,
   verdoppelt sich der Posten auf 70-100 h.
2. **Die lineare RAM-Skalierung ist am unteren Ende verankert und oben
   extrapoliert.** Der Messanker liegt bei 79 TB; die Tabellen gehen bis
   3.277 TB. Fuer die Erfahrung halte ich das (Weaken/Grow saettigen nicht),
   fuer das Geld ausdruecklich nicht (Summe `moneyMax` = $797 Mrd, die neun
   reichsten Ziele sind unter Level 927 gar nicht hackbar).
3. **Die Zyklusdauer (M2/M3) ist eine Schaetzung aus einem einzigen
   beobachteten Zyklus** (6,9 h seit dem letzten Einbau). Ich habe keinen
   vollstaendigen Zyklus gemessen, weil der Bot in 18 h BitNode-Zeit keinen
   gefahren hat.
4. **Ob `1,9^wartend` den Kauf von 10-12 Augs in einem Zyklus wirklich traegt**,
   haengt daran, ob die Kaufreihenfolge korrigiert wird. Bei absteigender
   Sortierung und $100 Mrd Guthaben ja; bei der heutigen aufsteigenden nein.
5. **Die 13-39 h SF4-Ersparnis in 5.2 sind eine Schaetzung ohne Messung.** Wenn
   die DOM-Kette in einem der 13 Knoten haengenbleibt und einen Menschen
   braucht, ist die Rechnung sofort umgedreht. Deshalb haengt der Bescheid am
   Test, nicht an der Zahl.
6. ~~Die Zaehlung "Stufe B = genau 30 Augs" ist nicht am laufenden Spiel
   geprueft.~~ **Erledigt in Fassung 2:** der Bauagent hat sie ueber
   `ns.singularity.getAugmentationsFromFaction` nachgemessen — 24 ohne, **30
   verschiedene mit BitRunners**, plus NeuroFlux als eigener Eintrag = 31. Mit
   Tian Di Hui und Netburners 42, mit Clarke und OmniTek 67. Meine Auszaehlung
   war richtig, die Reserve betraegt **eins statt null**. Sie bleibt duenn: ein
   einziger nicht bezahlbarer Aug kostet einen ganzen Zyklus, deshalb bleiben
   Tian Di Hui und Netburners im Plan.
7. **Die Kampfwert-Kette in 2.1 ist gerechnet, nicht gefahren.** Die
   Multiplikatorprodukte stammen aus meiner Auszaehlung, die Fitnessstudio-Rate
   (14,7 exp/s) aus `ClassWork.tsx:56-71` mal `location.expMult` — ich habe
   weder die Verbrechenserfahrung als Alternative beziffert noch geprueft, ob
   `haveKilledPeople(30)` fuer Speakers for the Dead automatisierbar ist. Fuer
   den Bescheid ist das folgenlos (NeuroFlux dominiert die Kette ohnehin),
   fuer eine spaetere Neubewertung nicht.

---

## 7. Was sich gegenueber Fassung 1 geaendert hat

| Befund | Quelltextpruefung | Wirkung auf den Plan |
|---|---|---|
| **`keepOnInstall` bei allen 10 Firmenfaktionen** | **haelt** (`FactionInfo.tsx:196-384`, `Prestige.ts:61-66/118-120`, `Singularity.ts:750-768` prueft beim Beitritt **keine** Bedingung erneut) | M4 ist ein **Einmalposten**, nicht einer je Zyklus. Neu als 2.6 aufgenommen. |
| **Rate linear im Hackinglevel, M4 gehoert hinter M5** | **haelt**, und der Messanker (2,4623 / 2,4714 rep/s bei Hacking 505-514) reproduziert `CompanyPosition.ts:156-172` | **Der teuerste Einzelfehler der Fassung 1.** M4 bei Hacking 518 kostet 57 h, bei 2.500 zwoelf. Reihenfolge in 4.1 umgestellt. |
| **Backdoor senkt Firmenreputation auf 0,75** | **haelt** (`Constants.ts:110` -> `Company/utils.ts:15-19` -> `FactionJoinCondition.ts:82-86` **und** `GetJobRequirements.ts:15-16`) | 400.000 -> 300.000, Befoerderung 7.000 -> 5.250. `clarkinc` 1.151 / `omnitek` 927, beide 5 Ports — liegen vor Hacking 2.500. |
| **`CompanyWorkRepGain` in BN4 ungedaempft** | **haelt** (fehlt in `BitNode.tsx` case 4, steht nur in case 11, `:1066`) | bestaetigt die Rate; gedaempft sind nur Lohn 0,1 und Erfahrung 0,5. |
| **Stufe B = 30 Augs, am Spiel gemessen** | **haelt** | Reserve eins statt null. Tian Di Hui und Netburners bleiben als Puffer im Plan. |
| **Firmenfaktionen werden fuer den 30er-Zaehler nicht gebraucht** | **haelt** | Ihre Rolle aendert sich: **Multiplikator-Posten, kein Tor.** Sie ruecken damit hinter M3/M5, nicht davor. |
| **`ClassGymExpGain` wird nirgends angewandt** | **haelt** (im ganzen Baum kein Lesezugriff; angewandt werden nur `CrimeExpGain`, `FactionWorkExpGain`, `CompanyWorkExpGain`, `HackExpGain`) | Meine Kampfwert-Rechnung war **methodisch falsch** (heutiger statt erreichbarer Multiplikator). **The Covenant ist erreichbar.** Das Ergebnis haelt trotzdem: NeuroFlux liefert denselben Multiplikator je Reputationseinheit doppelt so guenstig, Illuminatis QLink kostet $25 Billionen. Neu begruendet in 2.1 und 4.3d. |
| **Charisma trainieren lohnt nicht** | plausibel, von mir nachvollzogen (`ClassWork.tsx:46-51`, `Formulas.ts:108-121`) | uebernommen, ohne eigene Messung. |

**Ein Punkt der Zuarbeit traegt nicht:** die Behauptung, die richtige Einordnung
mache M4 zu einem nicht mehr dominierenden Posten und erspare damit rund
65 h. Die 65 h stimmen als Differenz zwischen M4 an falscher und an richtiger
Stelle, aber **Fassung 1 hatte M4 nie mit 57 h veranschlagt, sondern mit
15-30 h** — die Zahl 13 rep/s dort war bereits die Rate bei Hacking 2.500. Die
tatsaechliche Ersparnis gegenueber dem *geschriebenen* Plan betraegt rund
**12 h**, nicht 65. Der Fehler war real, aber er stand in der Reihenfolge, nicht
in der Zahl — und er wird ueberdeckt davon, dass Fassung 1 den
Reputationsposten um rund 25 h zu niedrig angesetzt hatte.
