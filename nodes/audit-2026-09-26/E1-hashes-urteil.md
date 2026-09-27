# E1 - Hash-Verwendung in V1 (Nachpruefung von Audit-Fund 5#1)

Stand: 2026-09-27, geeicht gegen `backups/LIVE_197f4d61481686_BN5L3_2026-09-27T12-08_hourly.json.gz`
(BN5, Loop 3, 6,5 h Motorzeit seit dem letzten Einbau um 11:13). Rechenskripte
in `C:\Users\erche\AppData\Local\Temp\claude\...\scratchpad\e1\` (hn2.js,
sim_a.js) - Formeln byte-fuer-byte gegen `reference/v301/src/Hacknet/formulas/
HacknetServers.ts` verglichen und gegen den Live-Spielstand geeicht: die
nachgebaute `rate()` reproduziert `hacknet-server-0`s `hashRate` im Save
(0.0006364127537966887 bei Level 2) auf 0 Abweichung in voller Fliesskomma-
genauigkeit.

## Wichtigste Korrektur gegenueber Audit-Fund 5#1

**"Increase Maximum Money" faellt bei JEDEM Einbau weg, nicht erst beim
Knotenwechsel** - das steht so im Spieltext (`HashUpgradesMetadata.tsx:54-57`:
"persists until you install augmentations, since servers are reset at that
time") und ist im Code bestaetigt: sowohl `prestigeAugmentation()` als auch
`prestigeSourceFile()` in `Prestige.ts` rufen `prestigeAllServers()` (loescht
alle Server ausser home) VOR `initForeignServers()` (baut das Netz neu auf).
Das ist derselbe Trigger, der auch den SF9.3-Gratis-Server killt
(`PlayerObjectGeneralMethods.ts:130`, `this.hacknetNodes.length = 0`, ohne
Neuvergabe ausserhalb eines Knotenwechsels). Die Aufgabenstellung hatte das
mit "von Sprung bis zum ERSTEN Einbau" schon richtig gerahmt - ich bestaetige
hier nur, dass dieses Fenster (nicht "bis zum Knotenwechsel") das relevante
ist, und rechne mit den echten, heute beobachteten Zykluslaengen (0,3-3,4 h,
aus backups/INDEX.tsv und den heutigen BN5L3-Installs 07:47/11:13).

## (a) Gratis-Server allein, BN5.3 (heute)

Kalibrierung aus dem Save:
- `Player.mults.hacknet_node_money` = 1.5910318844917217 (heute; die alte
  Audit-Notiz vom 26.09. mit `mult=2.515` ist veraltet - Augmentierungen
  aendern das je Einbau).
- `BitNodeMultipliers.HacknetNodeMoney` (BN5, case 5, `BitNode.tsx:671`) = 0.2.
- SF9.3-Gratis-Server L100/C10/Cache5/1GB (`Prestige.ts:339-344`) -> Hashrate
  heute **0,089098 H/s** (nicht 0,28 H/s wie in der alten Audit-Notiz - andere
  mults).
- Echte Stapelziele aus `data/bn4net.json` (12:08-Save): phantasy
  7.469.510 $/s, max-hardware 3.052.719 $/s, harakiri-sushi 1.241.343 $/s.
  **Das ist 100x kleiner als die alte Audit-Rechnung (792 Mio $/s
  "the-hub")** - dieser Lauf ist ein frischer BN5-Loop (Level 3, Hacking-Skill
  501, 6,5 h alt), keine reife Wirtschaft. Genau das war der Fehler, den ich
  vermeiden sollte: alte Zahlen sind KEINE gueltige Eichung fuer heute.

Simulation (Restzeit T bis zum naechsten Einbau, Gratis-Server allein, keine
Investition):

| T (h) | Sell for Money | MoneyMax auf phantasy allein | MoneyMax gierig auf 3 Ziele |
|---|---|---|---|
| 0,3 | 24,1 Mio $ | 77,5 Mio $ (Stufe 1) | 77,5 Mio $ |
| 1,0 | 80,2 Mio $ | 782,3 Mio $ (Stufe 3) | 774,0 Mio $ |
| 1,73 (Mittel aus 9 echten Zyklen) | 138,7 Mio $ | 2.081,6 Mio $ (Stufe 4) | 1.965,8 Mio $ |
| 2,0 | 160,4 Mio $ | 2.680,1 Mio $ (Stufe 4) | 2.500,2 Mio $ |
| 3,0 | 240,6 Mio $ | 5.282,1 Mio $ (Stufe 5) | 4.940,1 Mio $ |

**Ergebnis: "Increase Maximum Money" auf das ertragsstaerkste Stapelziel
schlaegt "Sell for Money" bei JEDER realistischen Zykluslaenge (0,3-3 h), mit
wachsendem Vorsprung (3x bei 18 min, 22x bei 3 h) - trotz 100x kleinerer
Einnahmen als in der alten Rechnung.** Die Begruendung aus Fund 5#1 haelt
strukturell: `geld = echt * moneyMax * chanceMin` in `bn4net.js:2898`, die
Fadenzahlen (`hackT`, `growT`, `w1`, `w2`) haengen nicht von `moneyMax` ab
(pMin/chanceMin sind Sicherheits-/Skill-Groessen), der RAM-Bedarf des Ziels
aendert sich durch die 2 % also nicht - der Ertrag ist praktisch geschenkt.
Konzentration auf EIN Ziel schlaegt das Verteilen auf alle drei leicht (5.282
gegen 4.940 Mio bei 3 h), weil der Vorteil multiplikativ auf der bereits
hoechsten Basis compoundet - und ist einfacher zu bauen (ein `upgTarget`
reicht).

**"Exchange for Coding Contract" habe ich NICHT zu Ende gerechnet** (Sitzung
wurde durch ein API-Limit unterbrochen, bevor ich die Schwierigkeitswerte je
Contract-Typ aus `ContractTypes.ts` und die Belohnungsverteilung sauber
verifiziert hatte - vier Belohnungsarten, nur eine davon Geld, drei Rep, mit
Dollarwert nur via Spendenkurs vergleichbar). Ein grober erster Ansatz
deutete auf eine moegliche Konkurrenzfaehigkeit bei sehr kurzen Zyklen (0,3 h)
hin, war aber auf falschen Annahmen aufgebaut (angenommene Schwierigkeit 1-31
gemittelt, tatsaechlich vermutlich kleine feste Werte je Typ) und wird hier
NICHT als Befund gewertet. Der alte Audit-Fund 5#1 hatte diese Option bereits
verworfen ("verliert klar gegen Befund 1") - ich habe keinen belastbaren
Gegenbeweis, uebernehme also die alte Einschaetzung mit dem Hinweis, dass sie
nicht neu verifiziert wurde.

## BitNode 8: beide Fragen sind gegenstandslos

Aus `BitNode.tsx:770-799` (case 8): `HacknetNodeMoney: 0` (keine Hashes, egal
was gebaut wird) UND **`ScriptHackMoneyGain: 0`** - der Spieler bekommt aus
Hack/Grow/Weaken-Batches in BN8 UEBERHAUPT KEIN GELD, unabhaengig von
`moneyMax`. `0 * (1,02^L - 1) = 0` fuer jedes L. Der aktuelle Code
(`hashes.js:138`, `hacknet.js:94-112`) sperrt BN8 bereits korrekt und
vollstaendig - hier ist nichts zu aendern, in keine Richtung.

## BitNode 12: keine echte Eichung moeglich, Richtung angebbar

Kein Spielstand vorhanden (`backups/` hat nur BN5L2/BN5L3; `bn12-bericht.md`
im selben Ordner bestaetigt: BN12 wurde noch nicht betreten). `BitNode.tsx:
924-959` (case 12) ersetzt die festen BN5-Werte (`ScriptHackMoney 0,15`,
`HacknetNodeMoney 0,2`) durch `dec = 1/1,02^lvl` fuer BEIDE Groessen
gleichzeitig - bei niedrigem `lvl` (erster Durchlauf) ist `dec` nahe 1, also
5-7x guenstiger als BN5s feste Werte fuer BEIDE Seiten (Hashrate UND
Zielertrag) gleichzeitig. Die Kaufpreise fuer Hacknet-Ausbau haengen dagegen
NICHT von einem BitNode-Multiplikator ab (`Hacknet.ts:144-175` nutzt nur
`Player.mults.hacknet_node_*_cost`, keine BN-Groesse), bleiben also gleich
teuer. Damit sollte BN12 bei niedrigem `lvl` das Ergebnis von BN5.3
mindestens bestaetigen, eher verstaerken (mehr Hashes UND groesserer
Zielertrag bei gleichem $-Kaufpreis) - bei hohem `lvl` naehert sich `dec` BN5s
0,2 an und faellt irgendwann darunter. Ohne echten Spielstand bleibt das eine
begruendete Richtung, keine Zahl.

## (b) Hacknet-Server kaufen (Einsatz) - NICHT abgeschlossen

Diese Sitzung wurde durch ein API-Nutzungslimit unterbrochen, bevor ich die
Kauf-/Ausbau-Simulation (Server kaufen, Cache/RAM/Kerne zuteilen, Netto nach
Einsatz gegen die 1,73-h-Zykluslaenge) mit den HEUTIGEN kalibrierten Werten
neu gerechnet hatte. Zwei belastbare Vorab-Befunde dazu:

- Die alte Audit-Tabelle (7-24 Stufen, +276 bis +2.116 Mrd $ netto) basiert
  auf `mult*bn = 0,503` und Kostenmultiplikator `cm = 0,380` (26.09., altes
  Save). Heute (27.09., frisches BN5L3) misst das Save `mult*bn = 0,318`
  (37 % weniger Hashrate je $) UND `cm = 0,601` (58 % teurerer Ausbau) -
  **beide Richtungen verschlechtern die Rechnung gegenueber der alten
  Tabelle gleichzeitig.** Die alte Tabelle ist damit als Entscheidungsgrundlage
  fuer HEUTE ungueltig (genau das Eichungsproblem, das die Grundregel
  verbietet).
- Im aktuellen Save stehen bereits 5 Hacknet-Server in BN5 (Level 1-2, Cache 1,
  1 GB, Gesamtrate 0,0019 H/s) - **nicht durch den Bot**: `data/hacknet.txt`
  zeigt, dass `hacknet.js` sich um 11:13:11 (direkt nach dem Einbau) korrekt
  wegen "kein Hacknet-Server mehr, nur BN9 kauft neu" selbst beendet hat, C3
  greift also nachweislich. Die 5 Server muessen manuell oder vor C3 entstanden
  sein; sie sind fuer die Bewertung irrelevant, aber ein Beleg dass C3 nicht
  gebrochen ist.

**Verdikt zu (b): offen, nicht neu bewertet.** Ich empfehle, das in einem
eigenen, kurzen Nachlauf mit den oben genannten heutigen Kalibrierwerten
(mult*bn=0,318, cm=0,601) zu Ende zu rechnen, BEVOR daran etwas gebaut wird.

## Entscheidung dieser Sitzung: NICHTS im Code geaendert

(a) zeigt einen klaren, mit echten heutigen Zahlen belegten Nettogewinn fuer
"Increase Maximum Money auf das beste Stapelziel" gegenueber "Sell for
Money" auf dem Gratis-Server, in JEDEM realistischen Zyklusfenster. Trotzdem
wird in dieser Sitzung NICHTS an `hashes.js`/`hacknet.js` geaendert:

1. (b) ist nicht zu Ende gerechnet - eine Aenderung an `hashes.js` sollte
   beide Befunde zusammen umsetzen (der Code muesste sonst kurz danach
   nochmal angefasst werden).
2. Eric Regel vom 30.08.2026 ("Skeptiker ist Pflicht, wenn der geaenderte Code
   weiterlaeuft, ohne dass jemand hinsieht") gilt fuer JEDE Aenderung an einem
   autonom laufenden Gewerk wie `hashes.js` - dafuer ist in dieser
   unterbrochenen Sitzung kein Budget mehr da.
3. `test-alles.js --schnell`, RAM-Abgleich (`tools/ram.js`) und die
   RED-alt/GREEN-neu-Tests fuer eine neue Zielwahl-Logik in `hashes.js`
   brauchen mehr Zeit, als nach der Unterbrechung sinnvoll uebrig ist.

**Empfehlung fuer den naechsten Auftrag:** (b) mit den heutigen Kalibrierwerten
zu Ende rechnen, dann `hashes.js` in V1-Knoten (nicht BN8, nicht BN9 - dort
bleibt GYM/RANG) auf "Increase Maximum Money" fuer das Ziel mit der hoechsten
`erwartetProS` aus `data/bn4net.json` umstellen (Verkauf nur als Ruecklage
weiter, solange kein Ziel im Batch-Betrieb steht), mit Pflicht-Skeptiker vor
dem Einspielen.

Branch dieser Sitzung: `e1-hashes-verdict` (nur dieses Ergebnis-Dokument,
kein Codewechsel).
