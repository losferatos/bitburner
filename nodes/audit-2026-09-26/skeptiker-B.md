# Skeptiker Paket B (bn4net) - Pruefung vor dem Einspielen

Stand 26.09.2026, Cloud-Sitzung ohne Spiel. Geprueft: Zweig
`worktree-agent-a693114a22f784410` (B1 51ad022, B2 c143bd2, B3 62bf7c0, B6 b320024)
gegen `origin/master`.

Grundlagen:
- Spielquelle: Tag `v3.0.2` gibt es upstream nicht (nur v3.0.0, v3.0.1). Genommen wurde der
  Standardbranch `dev` (package.json 3.0.2) plus Tag v3.0.1 zum Vergleich. `Hacking.ts` ist in
  beiden identisch (diff leer), `NetscriptFunctions.ts` grow/weaken unterscheiden sich nur in der
  Signatur, nicht in Dauer oder Erfahrung.
- Spielstaende: `audit-input/backups` BN5L2 15:12, 16:57, 17:19, 18:04, 19:03 (vor Einbau),
  19:04 (59,4 s nach Einbau). Dekodiert mit `modelle/decode.mjs`.
- Alle Zahlen unten sind mit Skripten gerechnet (Nachbau `Hacking.ts` calculateHackingTime /
  calculateHackingExpGain, `NetscriptFunctions.ts:282-300` grow und `:354-374` weaken,
  `PlayerObject` calculateSkill, BN5-Multiplikatoren aus `BitNode.tsx:656-686`), nicht geschaetzt.
  Die Skripte liegen nicht im Repo (Wegwerf), die Formeln stehen jeweils dabei.
- Eichung des Ofenmodells: Simulation "alt" (Einwegwelle, 110.844 GB Ueberschuss laut
  `data/bn4net.json` 19:04, Rundendauer 10,02 s aus `expmodel.mjs`) ergibt Level 2980 nach 60 s;
  der Spielstand 19:04 zeigt Level 3012 bei 59,4 s Spielzeit seit Einbau. Modell trifft.

---

## BLOCKER

### B-1 (B2) Der Ofen liefert NULL Erfahrung, sobald eine weaken-Aktion laenger dauert als eine Runde - und das ist nach jedem Knotenwechsel stundenlang der Fall

**Mechanik.** Erfahrung gibt es nur im `.then` nach `netscriptDelay`
(`NetscriptFunctions.ts:354-374` weaken, `:282-300` grow). `ns.scriptKill` loest
`delayReject(new ScriptDeath)` aus (`Netscript/killWorkerScript.ts:62-63`) - ein abgebrochener
Aufruf bringt nichts. bn4net beendet ALLE `worker/expfarm.js` einmal je Runde (bn4net.js, Raeum-
Schleife vor Durchgang 1) und startet sie am Rundenende neu; zwischen Neustart und naechstem Kill
liegen `ns.sleep(10000)` + Rundenarbeit = gemessen 10,02 s. Die Dauer eines Aufrufs wird beim
Aufruf fest (`calculateWeakenTime` = 4 x hackTime). Ist `4 x hackTime(foodnstuff) > ~10 s`,
wird jeder Aufruf vor dem Abschluss getoetet: Ertrag exakt 0. Die alte Einwegwelle wurde NICHT
getoetet und lieferte auch bei langen Aktionen (sie belegte den Speicher bis zum Abschluss).

**Gerechnet, drei Lagen:**

1. *Frisch nach Einbau (Mults aus 19:04: hacking 9,98, speed 4,087, exp 10,51, Int 146; exp = 0
   nach `prestigeAugmentation`, also Level 10; foodnstuff Sicherheit 20, min 7):*
   weaken bei Level 10 = 41,2 s > 10 s. Der Ofen (63.339 Faeden) liefert die ersten ~41 s nichts;
   nur die 180-Faden-Wartungswelle (Einweg, wird nicht getoetet) landet und hebt das Level auf
   ~900, danach weaken 2,6 s. Ergebnis Level 2800: alt 50,9 s, neu 53,4 s. **Hier harmlos
   (+2,5 s)** - aber nur, weil die Wartungswelle als Einweg-Zuender funktioniert.
2. *Mitte des Zyklus (18:04, Level 3895):* weaken 0,72 s, 13 Abschluesse je Leben, Nutzung
   92,9 %. Neu 1.362.463 exp/s gegen alt 101.894 (x13,4). **Hier ein grosser Gewinn.**
3. *Nach einem Knotenwechsel (naechster Routeneintrag BN5.3; Mults nur aus SF1.3 x SF5.2 =
   1,28 x 1,12 = 1,4336 fuer hacking, speed und exp; exp = 0, Level 1):*
   weaken auf foodnstuff = 7040/(L+50) s bei Sicherheit 20, 6624/(L+50) s bei min 7.
   **Unter Level 612-654 dauert jede weaken-Aktion laenger als 10 s -> Ofen = 0.**
   Level 612 heisst bei Mult 1,4336 rund 3,2e8 exp. Simulation (nur foodnstuff-Quellen, Wartung
   33 Faeden = 20 % von ~300 GB):

   | Ueberschuss | Level nach 5 min alt/neu | nach 15 min | nach 60 min |
   |---|---|---|---|
   | 100 GB  | 67 / 28  | 131 / 78  | 214 / 158 |
   | 1000 GB | 156 / 28 | 237 / 78  | 317 / 158 |

   Neu ist unabhaengig vom Ueberschuss (der Ofen traegt nichts bei), alt skaliert mit ihm.

**Warum BLOCKER:** Der Ausfall ist still. `ueberschussGb` und `brachAnteil` zaehlen den
vergebenen Speicher, nicht die Abschluesse; `expStandGb` zaehlt nur `WORKER` (ohne expfarm) -
keine Kennzahl zeigt, dass ein ganzer Netzanteil ueber Stunden null leistet. Der Bot laeuft
unbeaufsichtigt ueber Knotenwechsel, und die Fruehphase eines Knotens ist genau die, in der
Hacking-Level alles andere freischaltet. Der Test (B-T1 unten) kann den Fall nicht sehen.

**Fix (klein, einer von zwei Wegen):**
- (a) *Lease statt Kill* - so stand es auch im Audit-Fix 2#1 ("Lease"): expfarm.js bekommt eine
  Frist `args[1] = Date.now() + Rundendauer - Rand` und ruft `ns.weaken` nur, solange
  `Date.now() + ns.getWeakenTime(ziel) <= frist`; sonst endet es von selbst. Braucht es fuer den
  ersten Aufruf laenger als die Frist, macht es genau EINEN Aufruf und endet danach (= alte
  Einwegwelle). bn4net toetet dann nichts mehr und zaehlt expfarm wie einen Einwegfaden in der
  Belegung. Kosten: +0,05 GB (getWeakenTime), keine abgebrochene Arbeit mehr, auch nicht der
  angebrochene letzte Zyklus (heute 1,5-10,5 % je Runde, siehe Nutzung oben).
- (b) *Umschalter*: `if (4 * hackTime(expTarget) >= 0,8 * Rundendauer)` die alte Einwegwelle
  (`expScript`, ohne Kill), sonst den Dauerlaeufer. Minimal, aber die Rundendauer ist im
  verdeckten Tab ~60 s (bn4net.js:4964 ff.), also die Schwelle aus der gemessenen Rundendauer
  nehmen, nicht aus 10 s.

---

## SHOULD-FIX

### S-1 (B2) Kommentar, Commit und Test behaupten `ns.grow`, der Arbeiter macht `ns.weaken` - und die grow-Praemisse ist durch die Spielstaende widerlegt

- `src/worker/expfarm.js` (unveraendert seit 809813e, 24.08.) ruft `await ns.weaken(ziel)`.
  bn4net.js (Ueberschuss-Zweig: "Der Ofen unten nutzt deshalb bewusst NUR grow", Raeum-Schritt:
  "ruft ns.grow wieder und wieder"), der Commit c143bd2 ("worker/expfarm.js (ns.grow in einer
  Endlosschleife)", Modellzahl 856.373 exp/s) und der Kopf von `test-b2-...js` sagen grow.
- Die Commit-Zahl 856.373 exp/s ist exakt "grow ohne Kill" (17:19, Sicherheit min). Wie gebaut
  (weaken + Kill je Runde) sind es 613.226 exp/s = **-28 %** (x8,2 statt x11,5 gegen alt 74.524).
- Die grow-Praemisse "auf einem vollen Ziel erhoeht grow die Sicherheit gar nicht" haelt nicht:
  Die Wartungswelle (180 Faeden, pickScript -> hack bei Geld >= 90 %) nimmt je Faden
  `calculatePercentMoneyHacked` = 0,648 % (18:04) bis 0,716 % (19:04) - x180 >= 100 %: sie hackt
  foodnstuff jedes Mal LEER. Spielstand 18:04: foodnstuff 0,0 % Geld. Ein grow von 0 auf 5e7
  braucht 9.420 Zyklen (k = 9,1e-4 mit hacking_grow 5,21) -> +37,7 Sicherheit je Auffuellung.
  Genau das steht in den Spielstaenden: foodnstuff Sicherheit 44,3 (16:57), 44,5 (17:19),
  39,3 (19:03) bei min 7.
- **Fix:** weaken bleibt (es ist hier die richtige Wahl, das Audit 2#1 lag mit grow falsch);
  Kommentare in bn4net.js, Testkopf und die Modellzahl korrigieren. Wer den Arbeiter spaeter "an
  die Doku angleicht", baut sonst die Sicherheitsdrift von 7 auf ~44 (weaken-Zeit x1,2) wieder ein.

### S-2 (B1) Keine Vorbereitungskosten und keine Hysterese in der Zielwahl - jede Einbau-Rueckkehr wird zum 8-11-min-Fenster fast ohne Geldziel, und der Stapelsatz wechselt mit jedem gekauften Portprogramm

- Sortiert wird rein nach `steadyEff` bei minDifficulty (`moneyCandidates.sort`), `batchStand`
  wird geloescht, sobald ein Ziel aus den ersten drei faellt. Vorbereitungsdauer geht nirgends ein.
- *Beim Einspielen mitten im Zyklus (Stand 18:04, Level 3895):* Stapel alt phantasy/summit-uni/
  the-hub (Vorbereitung 0-96 s) -> neu ecorp/4sigma/clarkinc (471-636 s). summit-uni und the-hub
  rutschen auf Rang 26/27 und fallen aus den 25 Geldzielen ganz heraus. Von den 25 neuen
  Geldzielen stehen **1** bei Sicherheit <= min+5 (alt: 17 von 18). 19:03: 3 von 25 (alt 17/17).
- *Nach jedem Einbau (19:04-Server, Level 3012, Stufen nach gekauften Portprogrammen):*

  | Ports | alt Stapel (max. Vorbereitung) | neu Stapel (max. Vorbereitung) |
  |---|---|---|
  | 0-3 | identisch (4 / 13 / 131 / 227 s) | identisch |
  | 4 | rho, phantasy, the-hub (227 s) | rho, **nova-med, global-pharm (447 s) WECHSEL** |
  | 5 | unveraendert | **ecorp, clarkinc, 4sigma (681 s) WECHSEL** |

  Vorbereitung = weaken bei IST-Sicherheit 100 + weaken bei min (grow landet darunter). Kommen
  HTTPWorm und SQLInject weniger als 447 s auseinander, ist die Stufe-4-Vorbereitung verworfen.
- *Nach einem Knotenwechsel* verschaerft es sich: weaken bei Sicherheit 100 und req 400 dauert
  bei Level 500 (Mult 1,4336) 2.340 s = 39 min > `ANLAUF_FRIST_MS` 20 min -> das Ziel bindet
  20 min Anlaufspeicher (bis 30 % des Budgets), wird 30 min gesperrt, und kommt danach als
  Bestes wieder. Vor B1 waren diese Server unsichtbar, die Schleife gab es nicht.
- Einordnung: Der Tausch lohnt sich trotzdem fast immer (Faktor 15-25 in steadyEff; auch im
  20-min-Zyklus 16:37->16:57 bleiben ~9 min Ernte zum 20-fachen Satz gegen ~16 min zum
  einfachen). Deshalb kein BLOCKER - aber das Fenster ist real, und das Umschalten ist
  ungedaempft.
- **Fix:** (1) Rangwert `steadyEff x max(0, H - prepSek) / H` mit Horizont H (z. B. Median der
  letzten Zykluslaengen aus `data/einbau-uhr.json`, untere Schranke 20 min); `calc.prepSeconds`
  gibt es schon (autopilot.js:1126 nutzt es). (2) Hysterese: ein vorbereitetes oder in
  Vorbereitung befindliches Stapelziel wird nur ersetzt, wenn der Nachfolger >= 1,3x besser ist.
  (3) Anlauffrist an die Aktionsdauer koppeln: `max(20 min, 1,5 x weakenTime bei IST)`.

---

## MINOR

### M-1 (B6) Der neue Generator verliert still `ServerStartingSecurity: 1.5` fuer BN12
`zerlegeFelder` trennt an jedem Komma der Tiefe 0 - auch an dem im Kommentar
`//Does not scale, otherwise security might start at 300+` (BitNode.tsx, BN12). Das Stueck
`otherwise ... ServerStartingSecurity: 1.5` passt nicht zur Feldregex und faellt ohne Meldung weg.
Zeilenbasierte Gegenprobe gegen die Quelle: das ist das EINZIGE fehlende Feld in allen 15 Knoten;
master hatte es noch (1.5). Laufzeitfolge heute keine (bn4net.js:116-124 liest nur
ScriptHackMoney und ServerGrowthRate), aber es widerspricht dem Versprechen im Commit ("darf nie
schweigend luecken"). Fix: Kommentare (`//...\n` und `/*...*/`) vor dem Zerlegen entfernen und
im Test eine Kommentarzeile mit Komma vor ein Literal setzen; zusaetzlich Probe "kein Feld aus
der alten Tabelle verschwindet".

### M-2 (B6) BN12 Stufe 2/3 liest weiter den Stufe-1-Wert
Ehrlich im Commit vermerkt. Beziffert: ScriptHackMoney Tabelle 0,9804, echt 0,9612 (12.2) /
0,9423 (12.3) - Ueberschaetzung 2,0 % / 4,0 % (vorher 4,0 % / 6,1 %). Besser als vorher, nicht
richtig. Fix wie Audit 1#4: `ns.getBitNodeMultipliers()` (mit SF5 verfuegbar) statt Tabelle.

### M-3 (B2) ausgang.js kennt expfarm.js nicht
`ausgang.js:55` WORKER ohne `worker/expfarm.js`: Stufe 1 der Wirtswahl zaehlt den Ofen nicht
als rueckgewinnbar, `raeume(h, false)` (auch das Nachraeumen direkt vor `exec("exit.js")`,
`:871`) kann ihn nicht beenden. Heute ohne Folge, weil home die Reserve traegt (19:04:
246 GB frei gegen 40,25 GB exit.js), aber genau der Fall "Wirt vor dem Start wieder belegt"
(22.09., 90-s-Fenster) wird mit einem Ofen, der ALLES Freie nimmt, wahrscheinlicher. Fix:
`worker/expfarm.js` vorne in `WORKER` von ausgang.js (billigster Verlust).

### M-4 (B2) Fremdstarter sehen keinen freien Speicher mehr
Kill und Neustart laufen in derselben synchronen Runde (zwischen Zeile ~2358 und ~3240 kein
`await`); fuer andere Skripte ist der Ueberschuss nie frei. Vorher lag er bei hohem Level ~90 %
der Zeit brach (`brachAnteil` 0,84 um 19:04). Betroffen: Auftragslaeufer in bn4net (`data/
task.txt`, vor dem Kill) und bn4life.js:415 ("Wirt mit dem meisten freien Speicher") - alles,
was groesser ist als die home-Reserve, startet nicht mehr. Fix mit B-1 (a) erledigt sich das
teilweise (Lease endet vor der Runde); sonst im Auftragslaeufer expfarm wie share raeumen.

### M-5 (B3) Erste Runde nach langem Stillstand startet darkweb.js trotzdem einmal
`lifeLaeuft` verlangt Telemetrie < 300 s. bn4net startet bn4life in derselben Runde (Zeile 907)
vor der Pruefung (Zeile 995), also genuegt nach einem Einbau die Vor-Einbau-Telemetrie - gut.
Liegt zwischen letzter bn4life-Telemetrie und Neustart > 5 min (Knotenwechsel mit langem
Handschlag, Spiel offline), startet darkweb.js in Runde 1 einmal und reisst den Fokus. Begrenzt
(hoechstens einmal je 5 min, nur bis bn4life schreibt). Fix, falls gewollt: in Runde 1-3 nach
eigenem Start von bn4life nicht nachholen.

### M-6 (B3) Programmkauf haengt jetzt an `data/geldbedarf.txt`
bn4life kauft nur `verfuegbar = Geld - reserviert` (bn4life.js:283-292), darkweb.js kannte die
Reserve nicht. Gewollt, aber eine Verhaltensaenderung: legt bn4rep Geld fuer Augmentierungen
zurueck, kommen SQLInject (250 Mio) und damit die 5-Port-Server spaeter - mit S-2 genau die
Server, auf die die neue Zielwahl wartet. Im Bericht nennen, nicht verstecken.

---

## Tests - real oder tautologisch?

- **B-T1 (test-b2):** echter Kern gegen den Mock, aber der Mock kennt keine Aktionsdauer; die
  Pruefungen zaehlen Starts und Kills. Das Verhaeltnis Aktionsdauer zu Lebensdauer (B-1) wird
  nicht beruehrt. Die Probe "kein Start auf geldziel wird abgelehnt" prueft
  `abgelehnt.host === "geldziel"` - `host` ist der AUSFUEHRENDE Rechner, nicht das Ziel; sie
  prueft also Ablehnungen auf dem 8-GB-Server namens geldziel und ist fast immer gruen. Der
  Kopf behauptet `ns.grow`.
- **test-b1:** tautologisch. Baut ALT und NEU als eigene Funktionen im Test nach und vergleicht
  sie miteinander; `kennzahlen()` aus bn4net.js wird nie aufgerufen. Ein Rueckfall im Kern
  bliebe gruen. Fix: ueber den Mock-Lader einen hd-100-Server durch eine Runde fahren und
  `data/bn4net.json` (Stapelziele / zieleAnzahl) pruefen.
- **test-b3:** echter Kern, zwei Proben, richtig gerichtet. Die Reihenfolge "bn4life in derselben
  Runde gestartet" (M-5) ist nicht abgedeckt.
- **test-b6:** echter Generator, aber auf einer Nachbildung von BitNode.tsx ohne Kommentar mit
  Komma - deshalb unentdeckt M-1. Keine Probe gegen die echte Quelle oder gegen die alte Tabelle.
- `test-alles.js --schnell`: 1 rote Datei (`test-ram.js`, Eichung veraltet) - auf master genauso
  rot (gegengeprueft), nicht Paket B. (In der Cloud musste acorn/acorn-walk unter
  reference/v301/node_modules nachgelegt werden, sonst 4 rote Dateien aus Umgebungsgruenden.)
  test-motor-ebene2 56/56, test-b1 9/9, test-b2 8/8, test-b3 2/2, test-b6 13/13.

---

## Gehalten

- B1 Mechanik: `pMin/chanceMin/kMin` direkt bei minDifficulty ist algebraisch identisch zur
  alten Skalierung fuer hd < 100 und behebt hd = 100; alle anderen `kennzahlen`-Nutzer
  (planMix-Anlauf ueber IST-p = 0 -> nur weaken; Stapel-Vorbereitung und -Takt ueber kMin/pMin)
  bleiben stimmig. Belegt: 44-45 hd-100-Server unter dem Level in 18:04/19:03, steadyEff dort
  Faktor 15-25 ueber dem besten sichtbaren.
- B2 bei hohem Level: x8,2 (17:19) bis x13,4 (18:04, 19:04) gegen die Einwegwelle, gerechnet mit
  Kill-Verlust; nach Einbau kostet es nur +2,5 s bis Level 2800. weaken ist die richtige Aktion.
  `ns.scriptKill` gibt RAM synchron frei (`killWorkerScript.ts:56-86`), der Raeum-Schritt
  wirkt also in derselben Runde. RAM von bn4net.js unveraendert 10,80 GB (tools/ram.js),
  expfarm.js 1,75 GB.
- B3: bn4life ist nach einem Einbau sofort "lebend" (Start Zeile 907 vor Pruefung Zeile 995,
  Vor-Einbau-Telemetrie frisch); Notnagel greift weiter, wenn bn4life fehlt. Folge begrenzt.
- B6: Fuer BN5 aendert sich kein Wert (Diff alt/neu: nur BN1-Leereintrag weg, BN12 ergaenzt,
  StaneksGiftExtraSize negativ ergaenzt); einziger Laufzeitleser bn4net.js:116-124 behandelt
  fehlende Knoten/Felder als 1, test-analyse-eichung nutzt `|| {}` - Schema rueckwaertskompatibel.
  BN12 Stufe 1 jetzt richtig (0,9804 statt 1).
