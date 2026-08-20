# Reset-Plan, Stand 20.08.2026 nachmittags

Festgehalten, weil er sonst nur in einer Unterhaltung steht, die enden kann.

## Ausgangslage

| | |
|---|---|
| Hacking | 533 |
| Ertrag | $141 Mio/s |
| Netz | 23.661 TB (25 Server, 17 davon am Maximum von 1.048.576 GB) |
| Share-Bonus | x1,6104 bei 4,24 Mio Faeden |
| home | 65.536 GB, 3 Kerne |
| Installiert | Cranial Signal Processors G1+G2, Synaptic Enhancement, Neurotrainer I, NeuroFlux x22 |
| Multiplikatoren | hacking 1,399 · hacking_chance 1,307 · faction_rep 1,245 |

Faktionen und Reputation, dazu die gemessene Rate (20.08., ueber eine Minute):

| Faktion | Rep | Favor | Rate |
|---|---|---|---|
| Tian Di Hui | 38.982 | 36,3 | **5,959 Rep/s** (hier wird gearbeitet) |
| CyberSec | 3.787 | 63,4 | 0,655 Rep/s |
| NiteSec | 643 | 9,0 | 0,113 Rep/s |
| Netburners | 202 | 7,1 | 0,100 Rep/s |
| The Black Hand | 536 | 6,1 | 0,093 Rep/s |

Die Raten der vier anderen stammen fast vollstaendig aus Coding Contracts, nicht aus Arbeit.

## Warum Tian Di Hui, obwohl CyberSec mehr Favor hat

Die Rep-Rate haengt an `(1 + favor/100)`. CyberSec liegt mit Favor 63,4 bei x1,634 gegen
x1,363 bei Tian Di Hui - dort waere die Arbeit **20 % schneller**. Trotzdem ist Tian Di Hui
richtig, weil bei CyberSec nichts mehr zu holen ist: Neurotrainer I, Synaptic Enhancement und
beide Cranial Signal Processors sind laengst installiert, und BitWire (3.750 Rep) waere die
einzige offene Zeile. Reputation ohne Ziel ist wertlos.

## Das Ziel und was es wirklich tut

**NeuroreceptorManager**, Tian Di Hui, 75.000 Rep, $0,55 Mrd.

Die Aug hat **keinen einzigen Hacking-Multiplikator**. Was sie tut, steht in
`PersonObjects/Player/PlayerObjectGeneralMethods.ts:622-628`: sie hebt die Fokus-Strafe
dauerhaft auf. Ohne sie arbeitet man ohne Fokus mit Faktor 0,8, und der Fokus kommt von
selbst nie zurueck - es gibt im ganzen Spiel keinen Pfad, der ihn im laufenden Betrieb wieder
anschaltet. Der Tonanker gegen die Browser-Drosselung, der Fokus-Waechter in keepalive.js und
die halbe Fehlersuche der letzten zwei Tage haengen an diesem einen Faktor. Mit der Aug ist
das Thema fuer alle kommenden Runden erledigt.

Das ist eine Betriebsverbesserung, keine Kraftsteigerung. Sie rechtfertigt das Ziel trotzdem,
weil sie eine dauerhafte Fehlerquelle schliesst.

## Vor dem Reset zu kaufen

Augmentations wirken erst NACH der Installation. Ein Kauf jetzt braechte fuer die laufende
Runde nichts. Ausserdem steigt der Preis mit `1,9^(Warteschlange)`
(`AugmentationHelpers.ts:29-37`) - deshalb alles in EINEM Zug und die teuerste zuerst.

Von acht Tian-Di-Hui-Augmentations geben **fuenf nur `company_rep`** - den Multiplikator fuer
Firmenarbeit, die wir nie machen. Wertlos. Wertvoll sind:

| Aug | Faktion | Rep | $ | Wirkung |
|---|---|---|---|---|
| NeuroreceptorManager | Tian Di Hui | 75.000 | 0,55 Mrd | Fokus-Strafe faellt weg |
| SNA | Tian Di Hui | 6.250 | 0,03 Mrd | **faction_rep x1,15** |
| ADR-V1 Pheromone | Tian Di Hui | 3.750 | 0,02 Mrd | **faction_rep x1,10** |
| BitWire | CyberSec | 3.750 | 0,01 Mrd | hacking x1,05 |
| NeuroFlux Governor | beliebig | steigend | steigend | +1 % auf fast alles, je Stufe |

Die beiden `faction_rep`-Augs zusammen ergeben **x1,265 auf jeden kuenftigen
Reputationsgewinn** - und Reputation ist unser Engpass, nicht Geld. Fuer 50 Millionen bei
141 Mio $/s ist das ein Drittel einer Sekunde Einkommen.

NeuroFlux zaehlt fuer die 30-Augmentations-Bedingung von Daedalus nur EINMAL
(`FactionJoinCondition.ts:130`), egal wie viele Stufen. Als Multiplikatorquelle bleibt es
trotzdem die billigste Zeile.

## Was den Reset NICHT ueberlebt

- Gekaufte Server samt RAM (23.661 TB) - `prestigeAllServers()`
- Alle Programme inklusive **Formulas.exe** - `Prestige.ts:93` gibt es nur mit Source-File 5 zurueck
- TOR-Zugang, Boersenzugang, Faktionsmitgliedschaften, Hacking-Level

Was bleibt: home-RAM und -Kerne, Skriptdateien, installierte Augs, **Favor**.

Daraus folgt: Server-RAM, das kurz vor dem Reset gekauft wird, ist verbrannt. Der Ausbau
laeuft ohnehin aus - 17 von 25 Servern stehen am Maximum, mehr als 26.214 TB sind nicht
moeglich.

## Reihenfolge am Tag X — erprobt am 20.08.

0. **`node tools/task.js stocks.js --liquidate`** - das Aktiendepot aufloesen.

Seit dem 20.08.2026 ist der Aktienhandel abgeschaltet (siehe strategie.md),
dieser Schritt sollte also nichts mehr finden. Er bleibt trotzdem stehen: Wer
ihn ueberspringt und doch Positionen offen hat, verliert sie beim Install
ersatzlos.
   Offene Positionen sind beim Install ERSATZLOS weg (kein Erloes, keine
   Warnung). Das ist der einzige Schritt, dessen Versaeumnis echtes Geld
   kostet, und er gehoert deshalb an den Anfang.
1. **Warten, bis nichts mehr in Reichweite ist.** Das sagt
   `node tools/augplan.js`: Solange dort "KAUFBAR" steht oder eine Schwelle in
   weniger als einer Stunde faellt, lohnt Warten mehr als der Reset.

   Bis zum 20.08. stand hier "warten, bis Tian Di Hui 75.000 Rep erreicht".
   Das ist ueberholt: **Tian Di Hui und CyberSec haben keine Augmentierung
   mehr, die uns fehlt** (siehe strategie.md). Reputation dort bringt nur noch
   Favor - und Favor ist erst ab 150 etwas wert, wo Spenden moeglich werden.
   Gearbeitet wird seither dort, wo der naechste fehlende Posten am fruehesten
   faellt; nachts entscheidet das `tools/nightshift.js` selbst.
2. **Die Nachtsteuerung beenden** (Fenster von `nacht.cmd`, Strg+C). Sie
   beauftragt sonst mitten im Ablauf Kaeufe und Faktionswechsel und schreibt
   dabei in denselben Auftragsplatz. Eine Vorwarnung an Eric braucht es seit
   dem 20.08. nicht mehr.
3. `node tools/task.js stopwork.js` — die Arbeit GANZ beenden, nicht nur
   entfokussieren. Der Unterschied ist entscheidend: Entfokussieren laesst die
   angezeigte Seite auf `Page.Work`, und solange sie das ist, blendet
   `GameRoot.tsx:328-330` die Seitenleiste aus. buyaugs.js konnte in seinem
   Probelauf deshalb vier von fuenf Faktionen nicht lesen, sah nur die
   Netburners und kaufte eine Hacknet-Augmentierung, die uns nichts nuetzt.
   Kostet rund zwei Minuten Reputation - vernachlaessigbar.
4. `node tools/task.js buyaugs.js --nfgdepth 0 --max 25` — alle echten
   Augmentierungen. `--allowunfocus` braucht es seit dem 20.08. nicht mehr:
   Die Arbeitsseite zu verlassen ist im Normalbetrieb immer erlaubt (nur der
   Trockenlauf laesst es bleiben).
5. Warteschlange pruefen: `node tools/lage.js --augs`. Sie zeigt die
   Warteschlange samt Preisfaktor 1,9^n. **Erst wenn dort alles steht, was
   erreichbar war**, geht es weiter - nach dem Install ist die Gelegenheit
   vorbei, und die Reputation der Faktionen ist dann weg.
5b. **NeuroFlux ZULETZT.** `node tools/task.js buyaugs.js --nfgdepth 25 --max 25`
   erst jetzt, wenn alle echten Augmentierungen im Korb liegen. NeuroFlux
   laesst sich unbegrenzt stapeln, und jede Stufe verteuert ueber den
   Preisfaktor alles Nachfolgende - deshalb im Normalbetrieb `--nfgdepth 0`
   und nur hier, am Ende, der volle Griff.
6. `node tools/task.js install.js` — der Reset. Die Seite laedt dabei NICHT
   neu, `setInterval` ueberlebt, `keepalive.js` faengt den Wiederanlauf ab
   (zuletzt gemessen: 100 Sekunden).

## Erprobt und repariert am 20.08., vor dem Reset

- **Boersenzugang gekauft** (alle vier Posten, 31,2 Mrd). Er ueberlebt den
  Reset - die Zeilen, die ihn zuruecksetzen, stehen in `prestigeSourceFile`
  (ab 143), nicht in `prestigeAugmentation` (ab 80). Ein Handelsskript fehlt
  noch; `getForecast()` steht ab jetzt bereit.
- **Source-File -1 eingesammelt**: `UndocumentedFunctionCall`, `INeedARainbow`,
  `Bypass`. Der Bonus greift beim Reset automatisch (`Prestige.ts:123` ruft
  `reapplyAllSourceFiles`).
- **Export-Bonus abgeholt**: +1 Favor bei allen fuenf Faktionen, alle 24 h
  wiederholbar. Nebenwirkung: eine .json.gz im Downloads-Ordner.
- **buyaugs.js repariert**: Sein Erfolgstest mass das fallende Guthaben. Bei
  141 Mio $/s steigt das Konto waehrend eines Millionenkaufs, und beide Kaeufe
  wurden als Fehlschlag gewertet, obwohl sie in der Warteschlange standen.
  Nach zwei solchen "Fehlschlaegen" bricht das Skript ab - beim grossen Kauf
  waere das fatal gewesen. Der Guthaben-Abgleich entfaellt jetzt dort, wo der
  laufende Ertrag den Preis uebersteigt; `stateSays` aus der Oberflaeche ist
  der Zeuge.
- **Dieselbe Falle drei Mal an einem Tag**: im Waechter (`watch.js`), in
  `stockaccess.js` und in `buyaugs.js`. Merksatz: *Ein steigendes Guthaben
  beweist nichts, ein fallendes auch nicht - der Zustand entscheidet.*
