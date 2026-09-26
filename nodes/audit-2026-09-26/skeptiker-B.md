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

---

## Fix-Stand (26.09.2026, zweiter Durchgang: umgesetzt statt nur gemeldet)

Commits auf `cloud-skeptiker-b`:
- `82910e5` Skeptiker B 4: bitnodes-tabelle.js verliert kein Feld mehr still
- `4500041` Skeptiker B 1-3, 5-8, 10: Ofen mit Frist, Zielwahl mit Vorbereitung und Hysterese

Gerechnet mit denselben Wegwerfskripten wie oben (Nachbau Hacking.ts,
NetscriptFunctions.ts, calculateSkill). Die Nachspielung der Zielwahl ruft
DIREKT `targetMetrics/targetRank/selectMoneyTargets` aus `src/lib/calc.js`
auf, also den Code, den der Kern ausfuehrt.

Einspielen nur zusammen: `bn4net.js`, `lib/calc.js`, `worker/expfarm.js`,
`ausgang.js`, `lib/bitnodes.json`. bn4net importiert neue Exporte aus calc;
ein altes calc im Spiel liesse den Kern beim Import sterben.

### B-1 (BLOCKER, B2) - behoben, `4500041`

Bauform: **Frist statt Kill.** `worker/expfarm.js [ziel, frist, runde]` macht
den ersten weaken immer und jeden weiteren nur, wenn er nach der GEMESSENEN
Dauer des vorigen vor der Frist endet. Danach endet der Faden selbst. Die
Frist ist die naechste Speicherzaehlung des Kerns (gemessener Takt zwischen
zwei Zaehlungen, gedeckelt auf 2-120 s, minus 250 ms). bn4net toetet den Ofen
nicht mehr.

- Lange Aktion: genau die alte Einwegwelle.
- Kurze Aktion: Dauerlaeufer, dessen Speicher zur naechsten Zaehlung frei ist,
  ohne verworfenen Aufruf.
- Die Dauer wird gemessen statt mit `ns.getWeakenTime` erfragt. Damit bleibt
  der Faden bei 1,75 GB; 0,05 GB mehr waeren bei 63.000 Faeden ~3 % des Ofens.

Warum nicht die anderen Bauformen:
- Kill (Stand vorher) liefert bei Aktion > Runde null.
- Die Einwegwelle verschenkt bei hohem Level 90 % der Rundenzeit.
- Ein reiner Umschalter an einer Schwelle muesste die Rundendauer schaetzen
  und verliert an der Schwelle.

Die Frist deckt beide Enden mit einer Regel.

Simulation (5-ms-Raster, Wartungswelle eingerechnet, Rundendauer 10,02 s):

| Lage | alt (Einweg) | Kill (vorher) | Frist (neu) |
|---|---|---|---|
| nach Einbau, 19:04-Mults, 110.844 GB, Level 10 -> 2800 | 50,9 s | 53,4 s | 50,9 s |
| nach Einbau, Level nach 120 s | 3423 | 4277 | 4282 |
| Mitte Zyklus 18:04, 42.907 GB, Level 3895 | 1,03e5 exp/s | 1,49e6 exp/s | 1,45e6 exp/s (x14,1) |
| nach Knotenwechsel BN5.3 (Mult 1,4336), 1000 GB, Level nach 5/15/30 min | 156/237/274 | 28/78/117 | 157/238/275 |
| dito 100 GB | 67/131/172 | 28/78/117 | 67/132/173 |

Nach dem Knotenwechsel ist die Frist nie schlechter als die Einwegwelle: sie
braucht 1,75 statt 1,80 GB je Faden, also +2,9 % Faeden. Bei hohem Level ist
sie x14 gegen die Einwegwelle und -3 % gegen den Kill (Rand 250 ms plus
ganzzahlige Abschluesse).

Rot/Gruen `tools/test-b2-expfarm-dauerlaeufer.js` (echter Worker mit
vorgetaeuschter Uhr, T = 0,72 / 41,2 / 138,1 s; echter Kern im Mock):
- vor dem Fix **11 rot**, u. a. "0 Abschluesse, vom Kern getoetet" bei 41,2 s
  und 138,1 s, 15 Kills in 6 Runden, keine Frist;
- danach **20 gruen, 0 rot**.

### S-1 (B2, weaken vs grow; Erfahrungsziel nicht ruinieren) - behoben, `4500041`

- Die Kommentare in bn4net.js, der Kopf von expfarm.js, test-b2 und der
  Commit sagen einheitlich weaken, mit Begruendung.
- Die Wartungswelle (bis 180 Faeden) auf dem eigenen Erfahrungsziel macht
  jetzt **nur weaken**. Der hack/grow/weaken-Ternaer gilt nur noch im
  Ein-Ziel-Fall, in dem das Erfahrungsziel zugleich Geldziel ist. Sonst ist
  das Erfahrungsziel nie Geldziel (das war schon getrennt).
- Warum, in Zahlen:
  - Der hack-Anteil je Faden auf foodnstuff betraegt 0,648 % (18:04) bis
    0,716 % (19:04). x180 = 117-129 %, also leer (18:04: 0,0 % Geld).
  - grow von 0 auf 5e7 braucht 9.420 Zyklen = +37,7 Sicherheit (16:57/17:19:
    44 statt 7). Die weaken-Dauer steigt dadurch um den Faktor 1,18.
  - Mit weaken allein bleibt die Sicherheit am Minimum (der Ofen weakent
    selbst) und das Guthaben unberuehrt. Die 1,45e6 exp/s oben gelten fuer
    Sicherheit 7.
- Rot/Gruen: test-b2 A2 "Wartungswelle auf expziel ist ausschliesslich
  weaken.js" war vorher rot (`worker/hack.js`) und ist jetzt gruen.

### S-2 (B1, Vorbereitung und Hysterese) - behoben, `4500041`

- `kennzahlen` ist jetzt eine duenne Huelle um `targetMetrics` (lib/calc.js).
  Das liefert zusaetzlich `prepSec`: weaken bei IST-Sicherheit (in so vielen
  Wellen, wie 30 % des Netzes fassen), dazu grow/weaken bei min, wenn das
  Guthaben unter 75 % liegt.
- `targetRank`:
  - neues Ziel: steadyEff x (1 - prep/1800 s); Rang 0 bei mehr als 1200 s
    Vorbereitung;
  - amtierendes Ziel: steadyEff x Bonus x (1 - Rest/1800 s), wobei Rest =
    Eintrittsschaetzung minus vergangene Zeit;
  - Bonus 1,3 fuer Stapelziele, 1,05 fuer offene. Mit einem gemeinsamen Bonus
    hob sich die Huerde auf, sobald ein Herausforderer eine Runde lang offenes
    Ziel war; im Nachspielen verdraengte so ein 1,1-facher Ertrag zwei
    Stapelziele.
- `selectMoneyTargets`: unvorbereitete Ziele (> 60 s) bekommen hoechstens
  max(8, 25 - vorbereitete) Plaetze - nach einem Einbau also alle.
- Die Anlauffrist betraegt beim Anlaufbeginn max(20 min, 1,5 x Vorbereitung).

Nachgespielt mit echten Spielstaenden (vorher = Stand
origin/worktree-agent-a693114a22f784410):

| Lage | vorher | nachher |
|---|---|---|
| Einspielen 18:04: Geldziele, die schon arbeiten (von 25) | 1 (Summe steadyEff 2,37e5) | 17 (1,97e6) |
| Einspielen 19:03: dito | 3 (8,50e5) | 17 (2,27e6) |
| nach Einbau (19:04, Portprogramme einzeln): Stapelwechsel | 5 | 4, jeder mit >= 1,6-fachem 30-min-Ertrag nach Vorbereitung (der 1,1-fache entfaellt) |
| nach Knotenwechsel (19:04-Server, Mult 1,4336, 2.340 GB, Level 50-2000): Geldziele mit > 20 min Vorbereitung | bis 22 (bis 202 min) | 0 |

Der Stapel wechselt um 18:04 weiterhin sofort auf 4sigma/ecorp/clarkinc
(471-636 s Vorbereitung). Das ist gewollt: deren 30-min-Ertrag ist nach Abzug
der Vorbereitung das 10- bis 13-fache. Neu ist, dass die 17 arbeitenden Ziele
dabei Geldziele bleiben.

Rot/Gruen `tools/test-b1-security100.js`:
- vor dem Fix **4 rot**: Export fehlt; Arbeiter auf dem 61-min-Ziel;
  vorbereitete Ziele ohne hack-Faeden; Stapel wechselt fuer +15 %;
- danach **20 gruen, 0 rot**.

### M-1 (B6, Kommentar mit Komma) - behoben, `82910e5`

- Kommentare werden vor dem Zerlegen entfernt.
- Neuer Riegel: verschwindet gegenueber der bisherigen Tabelle ein Knoten oder
  Feld, bricht der Generator ab (gewollt nur mit `--wegfall-erlaubt`).
- Regeneriert: BN12 ServerStartingSecurity 1.5 ist wieder da (flach und in
  allen drei Stufen), BN1 wieder als leerer Eintrag.
- Zeilenweise Gegenprobe gegen die echte BitNode.tsx: 299 Literale,
  0 Abweichungen. Diff zur master-Tabelle: kein Feld verloren, BN5
  unveraendert.

### M-2 (B6, BN12 Stufe 2/3 zur Laufzeit) - behoben, `4500041`

- bn4net nimmt `knotenLevel[n][min(SF+1, hoechste Stufe)]`. Das SF-Level
  kommt aus `getResetInfo().ownedSF` (1 GB, schon bezahlt);
  `getBitNodeMultipliers` haette 4 GB gekostet.
- Stufe und Werte gehen als `bnWerte` in die Telemetrie.
- BN12.3: 0,9423 statt 0,9804; BN5 unveraendert 0,15.

Rot/Gruen `tools/test-b6-bitnodes-tabelle.js`. Der Test laeuft jetzt auch
gegen die echte reference/bitburner-src (mit Meldung UEBERSPRUNGEN, wenn sie
fehlt), immer gegen die eingecheckte Tabelle, und faehrt den Laufzeitleser im
Mock in BN12.3, BN12.1 und BN5:
- vor dem Fix **6 rot**;
- danach **24 gruen, 0 rot**.

### M-3 (ausgang.js) - behoben, `4500041`

`worker/expfarm.js` steht in `WORKER` direkt hinter share (zweitbilligster
Verlust: ein angefangener weaken ohne Kette). Damit zaehlt er bei der
Wirtswahl als rueckgewinnbar und wird von `raeume(h, false)` und vom
Nachraeumen vor dem exec erfasst. test-route, test-endspurt und test-punish
sind gruen.

### M-4 (Fremdstarter) - behoben, `4500041`

- 64 GB Freiraum auf dem groessten Rechner (hoechstens 10 % des
  Ueberschusses), aber nur, wenn die Ofenaktion kuerzer als die Runde ist.
- Bei langer Aktion arbeitet der Ofen als Einwegwelle und haelt den Speicher
  wie vor B2. Ein Freiraum kostete dort nach einem Knotenwechsel 6,4 %
  Erfahrung, ohne dass sich fuer die Fremdstarter etwas aendert.
- Um 19:04 sind 64 GB 0,06 % des Ueberschusses.
- Der Auftragslaeufer in bn4net raeumt `worker/expfarm.js` vor den anderen
  Arbeitern.
- test-b2 "auf home bleiben >= 64 GB frei" war vorher rot ([1,0,0,...]) und
  ist jetzt gruen.

### M-5 (B3, alte Telemetrie) - behoben, `4500041`

Ein bn4life-Prozess, den der Kern zum ersten Mal sieht (je pid), gilt 2 min
lang als "kauft selbst". Danach greift der Notnagel wieder (haengender Prozess
wie am 25.08.2026).

Rot/Gruen `tools/test-b3-darkweb-fokus.js`:
- vorher 1 rot (darkweb.js in Runde 1 gestartet);
- jetzt 4 gruen, inklusive der Gegenprobe "nach 160 s ohne Telemetrie startet
  darkweb.js doch".

### M-6 (Programmkauf ueber die Reservierung) - bewusst NICHT geaendert

- `bn4life.js` rechnet mit `Geld - reserviert`, damit eine von bn4rep schon
  erarbeitete Augmentierung nicht von Einkaeufen ueberholt wird (23.08.2026,
  bewusst so gebaut).
- Portprogramme davon auszunehmen hiesse, diese Reihenfolge umzudrehen. Das
  ist eine Abwaegung zwischen Einbau-Zeitpunkt und Einkommensrampe, die eine
  Messung im Spiel braucht, und sie liegt in bn4life.js, nicht im
  Hacking-Motor.
- Mit S-2 ist die Wirkung ausserdem kleiner: die neuen Ziele werden erst
  gewaehlt, wenn sie gerootet sind, und bis dahin arbeiten die vorbereiteten
  weiter.

### Tests (Einwand 10)

| Datei | vor dem Fix (Stand a693114a) | nach dem Fix |
|---|---|---|
| test-b1-security100.js | 5 gruen, 4 rot | 20 gruen, 0 rot |
| test-b2-expfarm-dauerlaeufer.js | 9 gruen, 11 rot | 20 gruen, 0 rot |
| test-b3-darkweb-fokus.js | 3 gruen, 1 rot | 4 gruen, 0 rot |
| test-b6-bitnodes-tabelle.js | 18 gruen, 6 rot | 24 gruen, 0 rot |
| test-motor-ebene2.js | 56/56 | 56/56 |
| test-alles.js --schnell | 30 gruen, 1 rot (test-ram) | 30 gruen, 1 rot (test-ram) |

"vor dem Fix" heisst: die neuen Tests gegen `git archive
origin/worktree-agent-a693114a22f784410`.

- test-ram.js ist dort genauso rot: 32 veraltete Eichzeilen fremder Dateien,
  Eichung unter 100 Zeilen.
- Die vier hier geaenderten Dateien stehen jetzt in `VERALTET_ERLAUBT`.
  tools/ram.js rechnet unveraendert: bn4net.js 10,80 GB, expfarm.js 1,75 GB,
  lib/calc.js 0.
- `node tools/registry-bauen.js --pruefen`: registry.json stimmt mit
  ARCHITEKTUR.md 3.3 ueberein (25 Eintraege).
- Ausserhalb von --schnell zusaetzlich gruen: test-kern-c789,
  test-sprosse5-kette, test-kernwache, test-verbote, test-matrix-ebene2
  (117/117), test-guard-ebene2, test-analyse-eichung, test-endspurt,
  test-punish, test-reserve-eta, test-v1kurve.
- test-bruecke bricht in der Cloud mit ERR_MODULE_NOT_FOUND ab, auf dem Stand
  a693114a genauso (Umgebung).

Offen bleibt, was nur das Spiel zeigen kann:
- die Rundendauer im verdeckten Tab (die Frist folgt dem gemessenen Takt,
  gedeckelt bei 120 s);
- die Messung von bn4net.js und expfarm.js mit calculateRam.
