# Die beschlossene Route (Stand 24.08.2026)

**Diese Datei ist massgeblich.** Sie ersetzt Abschnitt 6 von `ROADMAP.md` (per
Warnkasten ohnehin fuer ungueltig erklaert) und den Abschnitt "Neue
Reihenfolge" aus `ROADMAP-KORREKTUR.md` (dort ausdruecklich "Entwurf, noch
nicht beschlossen").

Sie existiert, weil ein Fremd-Audit am 24.08.2026 den entscheidenden Satz
schrieb: *"Es existiert derzeit keine beschlossene Route."* Zwei Dokumente, die
sich gegenseitig fuer ungueltig erklaeren, sind keine Planung.

Grundlage: `ROADMAP.md` (Zahlenbasis, ueberwiegend bestaetigt),
`ROADMAP-KORREKTUR.md` (Richtung richtig, Groessenordnungen falsch) und
`AUDIT-ROADMAP-2026-08-24.md` (Fremdpruefung gegen den Quellcode). Die
tragenden Befunde des Audits habe ich selbst am Quellcode nachgeschlagen; was
ich geprueft habe, steht unten mit Fundstelle.

---

## 1. Das Ziel, richtig formuliert

**Level 3 in allen 15 Knoten = 45 Laeufe.** Nicht "15 Knoten einmal".

Das klingt nach Wortklauberei und ist der wichtigste Einzelfehler der bisherigen
Planung. Jeder Beschleuniger, der einen Lauf billiger macht, wirkt auf die
*Restlaeufe*. Die alten Wiederholungs-Bescheide rechneten mit 9 bis 11
Rest-**Knoten** und kamen deshalb auf "lohnt nicht"; gegen 35 bis 40
Rest-**Laeufe** kippen dieselben Rechnungen ins klar Positive.

Daraus folgt die einzige Sortierregel, die diese Route braucht:

> **Beschleuniger zuerst, reine Pflichtlaeufe zuletzt.**

Ein Knoten wird also nicht deshalb frueh gespielt, weil er billig ist, sondern
weil das, was er freischaltet, alle folgenden Laeufe verbilligt.

---

## 2. Was ein Knotenwechsel kostet (nachgeschlagen, nicht angenommen)

Die Vermutung "ein direkter Zweitlauf ist billiger, weil Faktionen, Backdoors
und Firmenreputation teilweise ueberleben" ist **widerlegt**. `Prestige.ts`
raeumt beim Knotenwechsel restlos ab:

- `prestigeAllServers()` — alle Server neu erzeugt, alle Backdoors weg
- `faction.prestigeSourceFile()` fuer **jede** Faktion — Rep 0, Favor 0,
  Mitgliedschaft weg; dasselbe fuer jede Firma
- `homeComp.setMaxRam(...)` und `cpuCores = 1` (Prestige.ts:242-249)
- Augmentierungen, Karma, Gang, Corporation, Bladeburner: null

**Ein Zweitlauf hat null mechanischen Rabatt.** Was billiger wird, wird es
ausschliesslich ueber Source-Files. Genau deshalb ist die Sortierregel oben die
einzige, die zaehlt.

Zwei Ausnahmen, die tatsaechlich ueberleben und auf denen der Wiederanlauf
beruht: **`home.scripts`** (ServerHelpers.ts:226-239 raeumt nur Programme und
Nachrichten ab) und **Intelligence** samt Source-Files.

---

## 3. Die Route

Verfahren: **V2 (Bladeburner) als Traeger**, ausser in den milden V1-Knoten und
in BN8, wo es keinen anderen Weg gibt.

Diese Kernentscheidung der ROADMAP haelt — aber ihre urspruengliche Begruendung
war falsch. Es hiess, der Hacking-Weg "traegt in sieben Knoten gar nicht". Er
traegt, ueber NeuroFlux und Spenden ist jedes Level erreichbar. Er ist nur
teuer: je Knoten ein Sockel aus 29 Augmentierungen (NeuroFlux zaehlt als
**eine**, egal wie viele Stufen), einem Favor-150-Bootstrap ueber 462.490
kumulierte Reputation samt mindestens einem Einbau, und den NeuroFlux-Kosten
selbst. In den gedaempften Knoten macht das Faktor 3 bis 20.

| # | Laeufe | Weg | Warum an dieser Stelle |
|---|---|---|---|
| 1 | **BN5 L1** (laeuft) | V1 | Nur noch abschliessen |
| 2 | **BN6 L1** | V2 | Schaltet Bladeburner fuer 12 Knoten x 3 Laeufe frei. **Zugleich der Pruefstein dieser ganzen Route** — siehe Abschnitt 4 |
| 3-5 | **BN10 L1+L2+L3** | V2 | Je Stufe ein dauerhafter Sleeve: `min(3, sourceFileLvl(10) + (bitNodeN===10 ? 1 : 0)) + gekaufte` (SleeveCovenantPurchases.tsx:63). Ein Sleeve hebt die haerteste Grenze des Spiels auf — der Spieler hat genau EINE laufende Handlung. Drei statt einem Sleeve auf ~35 Restlaeufen schlaegt die Mehrkosten um ein Vielfaches |
| 6-7 | **BN4 L2+L3** | V2 | SF4.2/4.3 teilen die Singularity-RAM-Kosten durch 4 bzw. 16. Konkret: `b1tflum3` faellt von 257,6 GB auf 65,6 bzw. 17,6, `destroyW0r1dD43m0n` von 512 GB auf 128 bzw. 32 (`SF4Cost(16)`/`SF4Cost(32)`, RamCostGenerator.ts:219-220). Das entscheidet, ob der Wiederanlauf auf ein frisches home passt |
| 8-10 | **BN9 L1-L3** | V2 | SF9.2 gibt jedem frischen home **128 GB statt 32** (Prestige.ts:242-243) — der teuerste Engpass jedes Knotenstarts. SF9.3 legt je Reset Gratis-Hacknet-Server nach |
| 11-12 | **BN1 L2+L3** | V1 | SF1 gibt 16/8/4 % auf **alle** Multiplikatoren, Level 3 also x1,28 (applySourceFile.ts:14-48). Breit, aber nach der Infrastruktur, weil es V2-Laeufe nur ueber Kampfwerte beruehrt |
| 13-14 | **BN5 L2+L3** | V1 | SF5 gibt 8/4/2 %, Level 3 also **x1,14** — nicht x1,24. Der Bonus halbiert sich je Stufe (`mult += 8 / Math.pow(2, i)`, applySourceFile.ts:82). Dazu 300 Intelligence-EXP je Abschluss |
| 15-17 | **BN12 L1-L3** | V1/V2 | Billigste Pflichtlaeufe; die Schwelle waechst nur mit 1,02^Stufe |
| 18-23 | **BN2, BN3 L1-L3** | V2 | Pflichtbloecke beim besten Rangfaktor. In BN2 nebenbei den Gang-V1-Weg als Rueckfall dokumentieren: nur dort ist `GangUniqueAugs` = 1, das Sortiment also vollstaendig |
| 24-26 | **BN11 L1-L3** | V2 | SF11.3 senkt die Chargenbasis auf 1,767 — erst Level 3, nicht schon Level 1 |
| 27-29 | **BN6 L2+L3** + Puffer | V2 | SF6.2/6.3 bringen nur +4/+2 % Kampf. Reine Pflicht, also dann, wenn Laeufe am billigsten sind |
| 30-32 | **BN7 L1-L3** | V2 | Vor BN13/14/15, weil SF7.3 das **Blades Simulacrum** schenkt (PlayerObjectBladeburnerMethods.ts:14-19): Bladeburner-Aktion und normale Arbeit gleichzeitig. Das beschleunigt genau die teuren Spaetlaeufe |
| 33-35 | **BN14 L1-L3** | V2 | V1 dort doppelt gesperrt: hohe Schwelle UND `FactionWorkRepGain` 0,2, was jeden Favor-Bootstrap verfuenffacht |
| 36-38 | **BN13 L1-L3** | V2 | Hoechster NeuroFlux-Bedarf. Stanek nur hier mitnehmen — der Kirchenbeitritt ist ausserhalb gesperrt, sobald andere Augs installiert sind |
| 39-41 | **BN15 L1-L3** | V2 oder **V1b** | Schlechtester V2-Knoten. Vorher das Darknet-Labyrinth antesten (Abschnitt 5): in BN15 fuehrt Daedalus The Red Pill **gar nicht**, das Labor ist dort der einzige V1-Weg |
| 42-44 | **BN8 L1-L3, ganz am Ende** | V1, alternativlos | Kein Bladeburner, keine Gang, keine Corporation, kein Skript-Hackgeld, kein Darknet-TRP. Dafuer wirken dort alle bis dahin gesammelten Beschleuniger, und Spenden gehen ab Favor 0 — Reputation ist eine reine Geldfrage. **Braucht einen Boersen-Bot, den es noch nicht gibt** |

Grobsumme: rund 41 Restlaeufe, geschaetzt 1.100 bis 1.900 Stunden.

---

## 4. Der Pruefstein: BN6

Die gesamte Reihenfolge ab Platz 3 steht auf V2-Zeiten aus einer
**ereignisgesteuerten Simulation, die nie gegen einen echten Lauf geprueft
wurde**. Es gibt bis heute keinen einzigen gemessenen Bladeburner-Lauf. Das
Audit sagt das selbst und haelt seine Empfehlung fuer robust, "solange die
Simulation nicht um mehr als Faktor 3 bis 5 zu optimistisch ist".

Das ist eine ehrliche, aber ungedeckte Aussage. Deshalb gilt:

> **Beschlossen sind Platz 1 und 2. Alles ab Platz 3 ist vorlaeufig.**

Der Kontrollpunkt aus der ROADMAP wird uebernommen und ist bindend: **Rang nach
zwei Stunden in BN6 mindestens 6.000 mit Raid, mindestens 3.500 ohne.** Wird er
verfehlt, ist nicht der BN6-Lauf gescheitert, sondern die Simulation — und die
Reihenfolge ab Platz 3 muss neu gerechnet werden, bevor sie gefahren wird.

Diese Messung ist damit das wertvollste Einzelergebnis der naechsten Tage.

---

### Das Ergebnis vom 25.08.2026, 18:30 Uhr

**Gemessener Rang nach zwei Stunden: 29.** Schwelle waren 3.500 ohne Raid.
Verfehlt um Faktor 120.

**Die Messung ist als Test der Route unbrauchbar.** Von den 125 Minuten seit dem
Beitritt (zwischen 16:20 und 16:29) lief hoechstens eine knappe halbe Stunde
ungestoert:

| Zeitraum | Stoerung |
|---|---|
| 16:25-17:05 | bn4life und bn4rep brachen die Bladeburner-Aktionen sekuendlich ab (Verbrechen, Faktionsarbeit) |
| bis 17:20 | Der Faehigkeitenkauf nahm das Billigste statt des Wichtigsten - Overclock und Blade's Intuition standen auf null |
| bis 17:47 | Der Browsertab lief fuenffach gedrosselt (1 Motorrunde/min statt 4-6) |
| 17:58-18:20 | sauber, nach einem Klick in den Tab |
| 18:03-18:13 | Rueckfall auf General/Training, weil der Tracking-Vorrat leer war |
| ab 18:20 | wieder gedrosselt |

**Was sich trotzdem sagen laesst - und das ist der eigentliche Befund:** Die
Stoerungen erklaeren zusammen etwa Faktor fuenf. Die Luecke betraegt Faktor 120.
Selbst ein vollstaendig ungestoerter Lauf haette bei der sauber gemessenen Rate
von rund 0,3 Rang je Minute nach zwei Stunden bei etwa 36 gelegen, nicht bei
3.500.

Hochgerechnet auf die erste Black Operation (Operation Typhoon, Rang 2.500)
waeren das rund 140 Stunden - fuer **einen** von 45 Laeufen.

**Der Verdacht richtet sich damit gegen die Simulation, nicht gegen den Bot.**
Bewiesen ist er nicht: Bladeburner waechst exponentiell, die Rangertraege
steigen mit dem Aktionslevel, und der Sprung kommt erst mit Raid (rankGain 55
gegen 0,6 bei Retirement). Moeglich bleibt, dass die Simulation den Anlauf
richtig, aber die Anlaufdauer falsch modelliert hat.

**Was daraus folgt:** Die Reihenfolge ab Platz 3 bleibt vorlaeufig, wie in
Abschnitt 4 festgelegt. Vor einer Neuberechnung braucht es eine **zweite
Messung unter sauberen Bedingungen** - ein durchgehend ungestoerter
Vier-Stunden-Lauf mit funktionierendem wakelock. Erst wenn auch der bei einer
Rate unter einem Rang je Minute bleibt, ist V2 als Traeger widerlegt und die
Route muss neu gerechnet werden. Diese Entscheidung trifft Eric.


---

## 5. Der Darknet-Weg (V1b) - kein Abkuerzer, aber der Weg durch BN15

Beide Vorgaengerdokumente kennen nur zwei Wege zu `w0r1d_d43m0n`: Hacking-Level
(V1, ueber The Red Pill von Daedalus) und 21 Black Ops (V2). Es gibt einen
dritten: `labyrinth.ts:424-427` legt The Red Pill ins sechste Darknet-Labor.

**Die erste Fassung dieses Abschnitts nannte das eine "Daedalus-Umgehung in 13
von 15 Knoten". Das war falsch**, und die Fremdpruefung hat den Fehler in einem
Nachtrag selbst zurueckgenommen. Nachgeschlagen:

```
hasFullDarknetAccess = Player.bitNodeN === 15 || Player.activeSourceFileLvl(15) > 0
```
(effects.ts:301). Ohne vollen Zugang liefert `labData` `lab: null` und ein
flaches Netz der Tiefe 5 (labyrinth.ts:486-497). **Die Labore existieren nur in
BitNode 15 oder nach dem ersten BN15-Abschluss.** Die `dnet`-API selbst ist zwar
ueberall fuer $50 Mio kaufbar - die Labore sind es nicht.

Der zweite Kostentreiber wiegt noch schwerer: `prestigeDarknetState(false)`
steht in `Prestige.ts:76`, also im **Augmentierungs**-Einbau. Jeder Einbau
wuerfelt Netz, Sitzungen und Irrgarten neu. Die Laborbelohnung ist eine
vorgemerkte Augmentierung, und das naechste Labor erscheint erst, wenn die
vorige eingebaut ist. **Je Labor also ein voller Einbauzyklus, und je Zyklus
wird das Netz von Ebene 0 neu geknackt** - fuenf Zyklen bis The Red Pill in
BN15, sieben ueberall sonst.

**Bewertung:**

- **In BN15 ist es der Weg.** Daedalus fuehrt The Red Pill dort gar nicht
  (FactionHelpers.tsx:204-207), das Labor ist der einzige V1-Zugang. Geschaetzt
  10-35 h gegen 94 h aus der V2-Simulation.
- **Ausserhalb BN15 gestrichen.** Erst ab SF15.1, dann sieben Einbauzyklen,
  Tiefe 36, Charisma 4.000 - das verliert gegen Daedalus mit Spendenrecht
  (ein bis zwei Zyklen) praktisch immer.

**Skriptbar ist der Weg vollstaendig** (geprueft: kein `isTrusted` im ganzen
DarkNet-Ordner, `ns.dnet.labreport()` liefert die Nachbarschaft maschinenlesbar,
die rund 24 Servertypen sind deterministische Textraetsel ueber den
`authenticate`-Antwortkanal). Der Preis ist kein Zeitproblem, sondern ein
**neues Gewerk**: rund 24 Raetsel-Loeser, ein Netznavigator, der mit Mutation
und Zeitueberschreitungen umgeht, eine Tiefensuche durch den Irrgarten und eine
Deploy-Kette auf Darknet-Rechner.

Charisma ist dabei die Waehrung und wirkt exponentiell ueber den Multiplikator:
bei cha-mult 6 kostet Charisma 3.000 unerreichbare 7,6e8 Erfahrung, bei
mult 12 nur 6,3e5. Charisma-Augmentierungen sind also Pflichtkaeufe, keine
Nebensache.

**Plan:** BN15-Lauf 1 als Labyrinth-V1 einplanen, die Laeufe 2 und 3 nach dem
gemessenen Ergebnis. Das Gewerk vorher in einem billigen Knoten gegen das
flache Netz testen - die API ist ueberall kaufbar, nur die Labore nicht.

## 6. Was aus der Fremdpruefung NICHT uebernommen wird

- **"Die Wiederanlaufkette ist real nie ueber einen BitNode-Wechsel gelaufen."**
  Ueberholt. Am 24.08. um 17:18 lief der Uebergang BN4 → BN5, und der Park hat
  sich ohne Zutun wieder aufgebaut; ein zweiter Wiederaufbau nach dem
  Augmentierungs-Einbau um 05:52 desselben Tages ebenfalls. Die Kette ist
  zweimal im Ernstfall gelaufen.
- **"SF5.3 kumuliert x1,1424."** Nachgerechnet sind es **x1,14** (8+4+2 = 14,
  dann `1 + mult/100`). Folgenlos, aber die Zahl wird nicht weitergetragen.

---

## 7. Offene Baustellen, nach Dringlichkeit

1. **Boersen-Bot fuer BN8.** Der einzige Knoten ohne Alternative, und das
   Werkzeug dafuer existiert nicht. Steht am Ende der Route, also viel Zeit —
   aber es ist die einzige echte Neuentwicklung, die diese Route verlangt.
2. **Das Labyrinth-Gewerk bauen** (Abschnitt 5) - rund 24 Raetsel-Loeser,
   Netznavigator, Irrgarten-Tiefensuche, Deploy-Kette. Wird erst fuer BN15
   gebraucht, also spaet, aber es ist nach dem Boersen-Bot die zweite echte
   Neuentwicklung dieser Route. Vorher im flachen Netz testbar.
3. **V2 ueberhaupt einmal messen** (Abschnitt 4). Passiert automatisch in BN6.
4. **Der NeuroFlux-Bedarf ist kein fester Wert**, sondern ein
   Geld-gegen-Level-Optimierungsproblem. Die Zahlen in
   `ROADMAP-KORREKTUR.md` (54/125/120) sind untere Kanten, keine Planwerte.
