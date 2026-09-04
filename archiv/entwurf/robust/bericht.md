# Robustheit gegen den Reset — Pruefung und Umsetzung

Stand 20.08.2026. Alle Belege gegen `reference/v301` (Tag v3.0.1).
Nichts committet, nichts nach `src/` geschrieben.

Dateien in diesem Ordner, Struktur wie im Original:

| Datei | Befunde |
|---|---|
| `autopilot.js` | 4, 5, 6, 7 |
| `invest.js` | 3 |
| `xp.js` | 2 |
| `lib/calc.js` | 6, 7 |
| `nightshift/agent.js` | 1 |

`nightshift/` liegt im Original nicht unter `src/`; die Datei gehoert nach
`nightshift/agent.js`, nicht nach `src/nightshift/`.

**Kein Skript braucht mehr RAM als vorher.** Es wurde keine einzige neue
ns-Funktion eingefuehrt (geprueft per Diff ueber alle `ns.*`-Aufrufe);
`lib/calc.js` ruft weiterhin gar keine und kostet 0 GB.

---

## BEFUND 1 — Lebenswache erkennt fehlendes `bot-2` nicht · **bestaetigt, schlimmer als gemeldet**

`Terminal/commands/connect.ts:18` gibt bei unbekanntem Rechner
`Invalid hostname: '<host>'` aus. Der Text enthaelt den gesuchten Namen, also
war `/bot-2/.test(...)` genau dann wahr, wenn er falsch sein musste. Es gibt
zwei weitere Absagen mit demselben Muster: `Cannot directly connect to <host>`
(`connect.ts:46`) und, beim naechsten Schritt, `Invalid destination server:
<host>` (`commands/scp.ts:18`).

Die Diagnose des Pruefers stimmt vollstaendig: `connect` scheitert, das
Terminal bleibt auf home, `run xp.js` startet die Muehle auf dem Heimrechner.

Zwei Dinge, die er nicht erwaehnt hat:

1. **Dieselbe Luecke steckte im Verwalter-Zweig** (`new RegExp(this.verwalterHost).test(dort)`,
   vorher Zeile 600). Nach einem Reset steht dort `foodnstuff`, das existiert
   immer — deshalb faellt es seltener auf, aber die Pruefung war ebenso falsch.
2. Der zweite Vorschlag des Pruefers, auf `!/Invalid hostname/` zu pruefen,
   greift zu kurz: er faengt nur eine der drei Absagen.

**Umgesetzt.** Kein Textabgleich mehr, sondern ein Standortbeweis. Das Spiel
schreibt jede Eingabe als `[hostname /pfad]> befehl` mit
(`Terminal/ui/TerminalInput.tsx:245`) — das ist die einzige verlaessliche
Auskunft ueber den Standort. Drei neue Helfer:

- `currentHost()` — liest den letzten Prompt und gibt den Rechnernamen zurueck.
- `lastOutput()` — die Ausgabe **nur** des zuletzt abgesetzten Befehls, ohne
  die Prompt-Zeile. Das alte `lines().slice(-8)` nahm die Prompt-Zeile mit,
  in der der gesuchte Name als Argument steht — daran ist die Pruefung
  gescheitert.
- `gehe(host)` — setzt `home`, `connect <host>`, `ps` ab und liefert
  `{ok, host, out}`. **Wichtig:** der Prompt wird VOR der Ausfuehrung
  gedruckt, nach `connect x` steht dort also noch der alte Rechner. Deshalb
  das `ps` hinterher: erst dessen Prompt zeigt den neuen Standort.

`keepAlive` und der Wiederaufbau benutzen jetzt `gehe`. Ohne Standortbeweis
wird nichts gestartet; die Muehle bleibt lieber aus, als auf home zu landen.
Der Zielrechner der Muehle steht als `muehleHost` im Zustand (statt fest im
Code) und wird beim Reset auf `bot-2` zurueckgesetzt.

Nebenbei mitgenommen: Der Portknacker-Einkauf las `ls` per
`lines().slice(-6)`. home hat nach dem Wiederaufbau mehr als sechs Dateien —
ein bereits gekaufter Knacker rutschte aus dem Fenster, der Dienst haette ihn
in jeder Runde erneut zu kaufen versucht und waere nie weitergekommen. Jetzt
`lastOutput()`.

**Messen:** Nach dem naechsten Reset im Journal des Nachtdienstes nachsehen.
Erwartet: `Muehlen-Rechner bot-2 existiert nicht (steht auf home) - Muehle
bleibt aus`, und **kein** `xp.js` in `ps` auf home. Gegenprobe im laufenden
Betrieb: `ps` auf home darf `autopilot.js` zeigen, nie `xp.js`.

---

## BEFUND 2 — Muehle nimmt 70 % unabhaengig von der Lage · **bestaetigt**

`ANTEIL = 0.7` bezog sich auf die Gesamtgroesse jedes Rechners und kannte
keine Bedingung. Auf foodnstuff (16 GB) blieben 4.8 GB — `invest.js` mit
10.75 GB passt dort nie. Der Kommentar oben in der Datei sprach von der
Haelfte des **freien** Speichers; der Code tat etwas anderes.

**Umgesetzt.** Zwei Regeln statt einer Zahl:

1. Der Anteil leitet sich aus dem Leerlauf des ganzen Netzes ab:
   `anteil = clamp(0, 0.7, ramIdle/ramTotal - 0.1)`. Ist alles ausgelastet
   (Lage nach jedem Reset), nimmt die Muehle **nichts** und meldet das auch:
   `Muehle pausiert: nur X% Leerlauf im Netz`.
2. Auf jedem Rechner bleibt ein Mindestfreiraum: 12 GB (bemessen am Verwalter
   mit rund 11 GB), auf home 16 GB. Damit findet der Verwalter immer einen
   Platz und der Autopilot muss keinen Rechner mehr per `killall` freiraeumen.

Bei 153 von 168 TB Leerlauf ergibt das 0.7 wie bisher — die alte Ausbaustufe
verhaelt sich also unveraendert.

Bekannte Nebenwirkung, bewusst in Kauf genommen: Rechner unter 12 GB nutzt die
Muehle gar nicht mehr. Das sind bei grossem Netz ein paar GB von hunderten TB.

Zweite Nebenwirkung: Der Anteil schwingt. Fuellt die Muehle das Netz, faellt
`ramIdle` und damit der Anteil auf 0; laufen die weaken aus, steigt er wieder.
Die Periode ist eine weaken-Laufzeit. Das ist harmlos (die Muehle fuellt in
Schueben statt konstant), aber es faellt beim Zusehen auf.

**Messen:** Im Muehlenfenster steht jetzt `Anteil X% bei Y% Leerlauf`.
Erwartet: direkt nach einem Reset dauerhaft `Muehle pausiert`, mit wachsendem
Netz Anteil > 0. Gegenprobe: `free` auf foodnstuff muss dauerhaft mindestens
12 GB frei zeigen.

---

## BEFUND 3 — Puffer 2 und 4 multiplikativ · **bestaetigt; der Vorschlag selbst aber falsch herum**

Bestaetigt: `PUFFER = 4` im Hacknet verlangt fuer den 1000-Dollar-Knoten
4000 Dollar. Nach dem Reset sind 1262 da. Der Knoten ist die einzige
Anschaffung, die in dieser Lage ueberhaupt bezahlbar waere — der billigste
gekaufte Server kostet ein Vielfaches. Der Verwalter war also strukturell
handlungsunfaehig, obwohl sich der Knoten in elf Minuten bezahlt haette
(`Hacknet/data/Constants.ts`: `BaseCost: 1000`, `MoneyGainPerLevel: 1.5`).

**Der konkrete Vorschlag haette das aber verschlimmert.** `kosten +
Math.max(200e3, einkommenProSekunde * 60)` verlangt fuer denselben Knoten
201.000 Dollar — der Rueckhalt fuer TOR blockiert genau die Anschaffung, die
das Geld fuer TOR heranschafft. Umgesetzt ist deshalb eine getrennte Fassung:

**a) Rueckhalt in `invest.js` — additiv und relativ, ohne festen Sockel:**

```
hold  = max(cash * 0.1, incomePerSec * 60)
money = max(0, cash - reserve - hold)
```

Bei 1262 Dollar sind das 126 Dollar Rueckhalt, der Knoten bleibt bezahlbar.
Im Spaetspiel dominiert die Minute Einkommen. Das Einkommen misst der
Verwalter selbst (exponentiell geglaettet ueber die Guthabendifferenz, eigene
Ausgaben zurueckgerechnet) — das kostet kein RAM, weil das Guthaben ohnehin
jede Runde gelesen wird, und erfasst im Gegensatz zu
`getTotalScriptIncome` auch das Hacknet.

Der Vorrang des Serverkaufs vor dem Hacknet steckt jetzt in der Reihenfolge
statt in einem zweiten, groesseren Faktor: wurde in dieser Runde Speicher
gekauft, ruht das Hacknet.

**b) TOR und Portknacker im Autopiloten, nicht im Verwalter.** Der Rueckhalt
allein reicht nicht: bei 100 Dollar/s waeren es 6000 Dollar Rueckhalt, das
Guthaben erreicht die 200.000 fuer TOR nie, weil der Verwalter alles darueber
sofort in Speicher umsetzt. Der Autopilot haelt deshalb den Preis des
naechsten fehlenden Darkweb-Programms zurueck und meldet ihn ueber den
vorhandenen Sperrkassen-Port mit:

```
BruteSSH 500k · FTPCrack 1.5m · relaySMTP 5m · HTTPWorm 30m · SQLInject 250m
```

(geprueft gegen `DarkWeb/DarkWebItems.ts:6-10`; der Faktor 1.5 entspricht der
Kaufschwelle des Nachtdienstes). Zurueckgehalten wird erst ab 40 % des
Preises, sonst wuerde SQLInject mit 375 Millionen schon in der ersten Stunde
jeden Serverkauf blockieren.

TOR (200.000, `Constants.ts:44`) braucht keinen eigenen Eintrag: es ist
Voraussetzung fuer BruteSSH und wird auf dem Weg zu dessen Schwelle von
750.000 ohnehin mitfinanziert — der Nachtdienst kauft es bei 260.000.

Erkannt wird der Bestand ueber `ns.ls("home")`, das bereits jede Runde
aufgerufen wird. `ns.ls` listet `server.programs` mit
(`NetscriptFunctions.ts:851`), und `prestigeHomeComputer` setzt
`programs.length = 0` (`Server/ServerHelpers.ts:227`) — nach dem Reset sind
die Knacker also korrekt als fehlend erkannt.

**Messen:** Im ersten Stueck nach dem naechsten Reset muss `data/invest.txt`
binnen Minuten einen Hacknet-Kauf zeigen (frueher: stundenlang leer).
Anschliessend muss das Guthaben ueber 260.000 steigen, ohne dass der Verwalter
dazwischen Server kauft — im Log liegt zwischen dem letzten Hacknet-Eintrag
und dem ersten `bot-N gekauft` eine sichtbare Pause.

---

## BEFUND 4 — Sperrkasse ueberlebt den Reset · **bestaetigt, mit Quellbeleg**

`prestigeHomeComputer` (`Server/ServerHelpers.ts:224-237`) leert `programs`
und `messages`, fasst `scripts` und `textFiles` aber **nicht** an.
`data/reserve.txt` ist eine Textdatei auf home und ueberlebt den Reset also
tatsaechlich. Eine Milliardenschwelle wird mit 1262 Dollar nie wieder
unterschritten.

**Umgesetzt**, an der vom Pruefer vermuteten Stelle. Der Block ist hinter die
`ls`-Schleife gewandert, weil er jetzt auch den Dateibestand von home braucht
(Befund 3b). Die Zeile lautet:

```js
if (reserve > cash * 0.5) { … reserve = cash * 0.5; }
```

mit einem einmaligen Hinweis im Verlauf. Begruendung im Code: eine Sperre
oberhalb des halben Guthabens ist keine Sperre mehr, sondern ein Kaufverbot.

Der Nachtdienst loescht die Datei nach einem Reset ohnehin; der Deckel ist die
zweite Sicherung fuer den Fall, dass der Nachtdienst nicht laeuft.

**Messen:** Testweise `echo 1e12 > data/reserve.txt` schreiben. Erwartet: ein
Eintrag `Sperrkasse $1.00t uebersteigt das halbe Guthaben - auf … gedeckelt`
und ein Verwalter, der weiter einkauft.

---

## BEFUND 5 — `SEC_TOLERANCE = 3` absolut · **bestaetigt**

Die Rechnung des Pruefers stimmt. Dazu kommt der von ihm genannte Punkt: ein
als bereit geltendes Ziel bekommt im `ernten`-Zweig zwar einen weaken auf den
echten Ueberschuss, faellt aber nie in den `beruhigen`-Zweig — es bleibt
dauerhaft oberhalb des Minimums. Sicherheit geht doppelt ein: in
`hackPercent` ueber `(100 - sec)/100` und in `hackTime` ueber
`2.5 * reqSkill * sec` (`lib/calc.js:71` und `:85`, aus `src/Hacking.ts`).

**Umgesetzt** wie vorgeschlagen, als Funktion auf Modulebene:

```js
const secTolerance = (s) => Math.max(1, s.secMin * 0.1);
```

Das absolute Minimum von 1 ist noetig, damit ein erntendes Ziel nicht durch
die Sicherheit seiner eigenen hack-Welle (0.002 je Faden, 500 Faden = +1.0)
sofort wieder aus der Erntereife faellt und zwischen `ernten` und `beruhigen`
pendelt.

Die Funktion steht bewusst auf Modulebene, damit die **Anzeige dieselbe
Schwelle benutzt**: in `draw()` stand eine zweite, fest verdrahtete 3, die
gruen gemeldet haette, was der Bot laengst anders behandelt.

**Messen:** In der Zielliste die Spalte `sec/secMin`. Erwartet: Ziele mit
hohem `secMin` bleiben laenger gruen als vorher, Ziele mit `secMin` 1 bis 3
liegen dauerhaft naeher am Minimum. Wenn ein Ziel sichtbar zwischen `ernten`
und `beruhigen` springt, ist die 1 zu klein.

---

## BEFUND 6 — Arbeiterkosten hart im Code · **bestaetigt**

`Math.floor(ramFree / 1.75)` an zwei Stellen in `prepSeconds`.

**Umgesetzt.** `prepSeconds` und `expectedYield` nehmen jetzt
`costs = {hack, grow, weaken}` entgegen; Vorgabewert ist die exportierte
Konstante `calc.WORKER_RAM` (1.7 / 1.75 / 1.75 = 1.60 GB Grundlast aus
`Netscript/RamCostGenerator.ts:11` plus 0.10 hack bzw. 0.15 grow/weaken).
Der Autopilot reicht die echten Werte aus `ns.getScriptRam` durch — die
Funktion war dort ohnehin schon im Einsatz, das kostet also kein zusaetzliches
RAM.

**Messen:** Nicht direkt sichtbar. Gegenprobe: einem Arbeiter versuchsweise
eine ns-Funktion hinzufuegen; die Spalte `Wert/s` und die Zielreihenfolge
muessen sich daraufhin aendern. Vorher taten sie das nicht.

---

## BEFUND 7 — `HACK_FRACTION` je Ziel bestimmen · **traegt, mit einer Einschraenkung**

Nachgerechnet mit den echten Serverdaten aus `Server/data/servers.ts`
(joesguns: `moneyAvailable` 2.5m, `serverGrowth` 20, `hackDifficulty` 15 →
`minDifficulty` 5 nach `Server/Server.ts:83`) und den Formeln aus
`lib/calc.js`. Kosten je Faden 1.7/1.75/1.75.

| Lage | Budget je Ziel | gewaehltes f | Zyklus | f = 0.1 haette gekostet |
|---|---|---|---|---|
| nach Reset, 116 GB / 3 Ziele | 39 GB | **0.02** | 66 GB | 335 GB |
| 10 TB / 10 Ziele | 1000 GB | **0.2** | 699 GB | 335 GB |
| 274 TB / 60 Ziele | 4567 GB | **0.4** | 1568 GB | 335 GB |

Die Vorhersage des Pruefers trifft zu: nach einem Reset faellt der Wert von
selbst auf 0.02, mit dem Netz steigt er. Die feste 0.1 brauchte 335 GB je Ziel
— bei 39 GB Budget war das Nachwachsen schlicht nicht bezahlbar, der Bot
schoepfte ab und bekam das Ziel nie wieder voll.

**Einschraenkung, die der Pruefer nicht genannt hat.** Der Ertrag **je GB**
sinkt mit f, weil grow multiplikativ zurueckholen muss:

| f | 0.02 | 0.05 | 0.1 | 0.2 | 0.4 |
|---|---|---|---|---|---|
| Ertrag je GB | 755 | 755 | 747 | 715 | 638 |

Der alte Kommentar im Code ("kleine Happen sind speicherguenstiger") hatte
also recht — er war nur nicht die ganze Wahrheit. Solange die **Zahl der
Ziele** der Engpass ist und nicht der Speicher, ist ein grosses f trotzdem
richtig: die Zykluszeit ist eine weaken-Laufzeit, unabhaengig von f. Bei
274 TB und hoechstens 60 Zielen braeuchte f = 0.02 nur rund 4 TB der 274 TB —
der Rest laege brach. Der Ertrag je Ziel steigt um das Zwanzigfache, die
Effizienz je GB sinkt um 16 %. Der Handel lohnt sich klar.

**Wenn Ziele im Ueberfluss vorhanden sind und der Speicher knapp ist, kehrt
sich das um.** Dann waere ein kleines f besser, obwohl ein grosses "passt".
Fuer den aktuellen Stand (Zielzahl begrenzt) ist die Regel richtig; wer
`MAX_TARGETS` spaeter deutlich anhebt, sollte hier noch einmal hinsehen.

**Umgesetzt** in `lib/calc.js` als `cycleCost(s, p, f, costs)` und
`pickHackFraction(s, p, ramShare, costs)`, Kandidaten
`HACK_FRACTIONS = [0.02, 0.05, 0.1, 0.2, 0.4]`. Der Autopilot bestimmt
`ramShare = ramTotal / active.length` und waehlt je Ziel. Passt nicht einmal
0.02, wird 0.02 trotzdem genommen — ein winziger Happen ist besser als
Stillstand.

Eine Abweichung vom Vorschlag: statt `G = ln(1/(1-f))/k` wird die exakte
`growThreads`-Loesung des Spiels benutzt (Newton-Verfahren aus
`Server/ServerHelpers.ts:90`), die den additiven Dollar je Faden mitrechnet.
Gegenprobe: die beiden Werte weichen ueber den ganzen Kandidatenbereich um
hoechstens einen Faden ab (bei f = 0.4: 731 gegen 732) — die Handformel
schaetzt also leicht zu hoch. Der Unterschied ist folgenlos, die exakte
Fassung kostet nichts, weil sie ohnehin im Modul liegt.

**Messen:** Der gewaehlte Anteil steht jetzt in der Zielliste hinter der
Spalte "Im Einsatz" als `f2.0%`, `f10.0%` und so weiter; ein `!` dahinter
heisst "passt nicht einmal der kleinste Zyklus". Zusaetzlich liegt er in
`data/telemetry.txt` je Ziel als `hackFraction` / `hackFractionFits` und ist
damit im Dashboard auswertbar. Erwartet: direkt nach einem Reset ueberall
`f2.0% !`, mit wachsendem Netz steigende Werte ohne `!`.

---

## Was ich nicht klaeren konnte

- **Der Ausgangswert von `ramShare`.** Ich teile den GESAMTEN Arbeitsspeicher
  durch die Zahl der aktiven Ziele, nicht den freien. Das ist bewusst dieselbe
  Groesse, mit der auch die Zielauswahl rechnet, aber es ist eine Setzung:
  wenn ein Zyklus rechnerisch passt, heisst das nicht, dass gerade Platz frei
  ist. In der Praxis entschaerft sich das, weil die grow-Phase eines Zyklus
  erst Runden nach der hack-Phase anfaellt — sicher gemessen habe ich es
  nicht.
- **Der Schwellenwert 0.4 beim Darkweb-Rueckhalt** ist geraten. Zu frueh
  bremst er den Serverausbau, zu spaet kommt der Knacker nie. Nach dem
  naechsten Reset an den Zeitstempeln in `data/invest.txt` ablesbar.
- **Die Schwingung des Muehlen-Anteils** (siehe Befund 2) habe ich nicht
  gedaempft. Ob sie im Betrieb stoert, muss man sehen.
- **Portknacker jenseits von BruteSSH.** Der Nachtdienst kauft sie der Reihe
  nach; ob der Rueckhalt fuer FTPCrack (2.25 Millionen) den Serverausbau in
  der mittleren Phase spuerbar bremst, ist ungetestet.
- **Nichts davon lief im Spiel.** Alle Dateien sind syntaktisch geprueft und
  die Formeln nachgerechnet, aber der Bot laeuft weiter auf dem alten Stand —
  wie beauftragt wurde nach `entwurf/robust/` geschrieben, nicht nach `src/`.
