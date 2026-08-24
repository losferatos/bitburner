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

## 5. Der dritte Abschlussweg (V1b), bisher uebersehen

Beide Vorgaengerdokumente kennen nur zwei Wege zu `w0r1d_d43m0n`: Hacking-Level
(V1, ueber The Red Pill von Daedalus) und 21 Black Ops (V2).

Es gibt einen dritten. `labyrinth.ts:424-427`:

```
// On BNs that allow TRP in Lab, the sixth lab has the red pill
if (!nextAug && allowTRP) return AugmentationName.TheRedPill;
```

`allowTRP` haengt an `DarknetLabyrinthRewardsTheRedPill`, Vorgabewert 1
(BitNodeMultipliers.ts:64); nur BN8 (BitNode.tsx:786) und BN12 (:954) setzen ihn
auf 0. **In 13 von 15 Knoten liefert das sechste Darknet-Labor The Red Pill —
komplett am Daedalus-Sockel vorbei.** Kein 30-Augmentierungs-Sockel, keine
2,5 Mio Reputation, kein Favor-Bootstrap.

Belegt ist die Existenz, die Laborreihenfolge und eine umfangreiche
`ns.dnet`-API (RamCostGenerator.ts:238-263). **Nicht belegt** ist, ob der Weg
vollstaendig skriptbar ist und was die sechs Labor-Augmentierungen an Zeit und
Einbauzyklen kosten.

**Aufgabe:** In einem billigen Knoten einmal antesten und messen. Faellt der Weg
unter etwa 40 Stunden, ersetzt er in BN15 alle drei V2-Laeufe — und ist
womoeglich in weiteren Knoten der kuerzere Weg.

---

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
2. **Darknet-Labyrinth vermessen** (Abschnitt 5). Kann die Route an mehreren
   Stellen verkuerzen.
3. **V2 ueberhaupt einmal messen** (Abschnitt 4). Passiert automatisch in BN6.
4. **Der NeuroFlux-Bedarf ist kein fester Wert**, sondern ein
   Geld-gegen-Level-Optimierungsproblem. Die Zahlen in
   `ROADMAP-KORREKTUR.md` (54/125/120) sind untere Kanten, keine Planwerte.
