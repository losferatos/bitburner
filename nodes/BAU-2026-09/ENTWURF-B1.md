# ENTWURF B1 — Registry und Waechter als tragende Teile

**Architekt B1, 04.09.2026, 02:33–03:1x Ortszeit** (`date`, Systemzeit des
Rechners). Grundlage: `nodes/AUFTRAG-BAU-2026-09.md` §1.3–1.5, §3, §4, §5;
Messwerte aus `doku/ram-budget.md` und `doku/ram-messung-2026-09-04.json`;
Live-Zustand ueber `http://127.0.0.1:8795/api/state` (lesend, 02:35:31:
`instance LIVE`, `verified true`, BN10 L2, `motorRound 4035`, `backupAgeMin 6,5`).

**Leitgedanke.** Der Bot faellt nicht aus, weil einzelne Gewerke schlecht sind.
Er faellt aus, weil an keiner Stelle steht, **was** laufen soll, **wo** es laufen
soll und **wer** merkt, wenn es nicht laeuft. Diese drei Fragen beantworten
heute: eine handgepflegte Liste in einem 3273-Zeilen-Skript
(`bn4net.js:257-347`), eine zweite handgepflegte Liste mit fuenf von vierzehn
Eintraegen (`bn4net.js:61-67`) und niemand. Solange das so ist, ist jede
Verbesserung an einem Gewerk eine Verbesserung an etwas, das unbemerkt sterben
kann. Deshalb: **Registry zuerst, Waechter zweitens, alles andere danach.**

Der Entwurf haelt sich an §4: die Bauform bleibt. Er schlaegt **keinen Neubau
eines vorhandenen Moduls vor**, fuer den nicht eine Messung angefuehrt ist.
Abschnitt 5 fuehrt je Modul genau diese Messung — oder das Wort BLEIBT.

---

# 0 Eichung des Rechenwegs (Pflicht aus CLAUDE.md)

Jede RAM-Zahl in diesem Entwurf ist entweder eine der 114 Live-Messungen vom
04.09. oder mit dem geeichten Nachbau des Spiel-RAM-Rechners gerechnet
(`…/scratchpad/ramcalc.js`, 114/114 identisch zur Live-Messung, Abweichung
0,00 GB — `doku/ram-budget.md`).

**Neu geeicht fuer diesen Entwurf** (das Zwei-Zahlen-Modell aus §1.1):

    ram(SF-Stufe) = ramBaseGb + ramSingGb x f
    f = (knoten === 4) ? 1 : (sf4 <= 1) ? 16 : (sf4 === 2) ? 4 : 1

Gegen **alle 114 Dateien x 3 SF-Stufen = 342 Werte** gerechnet:
**342 von 342 exakt, Abweichungen: 0.** Damit ist das Modell kein Ansatz,
sondern die Formel des Spiels (`RamCostGenerator.ts:81-95`, `SF4Cost`).

**Neu gemessene Groessen** (mit demselben Rechner, SF4.1 und SF4.3 getrennt):

| Baustein | SF4.1 | SF4.3 | Bemerkung |
|---|---:|---:|---|
| Waechter, voller Satz | **7,35** | 7,35 | SF4-invariant, singularityfrei |
| Waechter ohne `getHostname` | **7,30** | 7,30 | gewaehlte Fassung |
| Waechter-Fuehler (Base+`getPlayer`+`ps`) | **2,30** | 2,30 | Rueckfallebene §4.4 |
| Figur-Vergabepunkt, voll | **228,55** | 33,55 | Werkbank-Gewerk |
| Figur-Kaltstart (nur Bladeburner) | **6,60** | 6,60 | siehe §4.3 |
| Kaufskript `cloud.js` | **7,60** | 7,60 | Auslagerung aus dem Kern |
| Sprosse-5-Vollstrecker, mit Aug-Zaehlung | **162,60** | 12,60 | |
| Sprosse-5-Vollstrecker, Zaehlung aus Datei | **82,60** | 7,60 | empfohlen |

**Befund, der §5.3 korrigiert.** Der Auftrag schreibt, `queuedAugmentations` sei
„nur per DOM lesbar (`install.js:82-93`)". Das stimmt nicht:
`ns.singularity.getOwnedAugmentations(true)` enthaelt die eingebauten **und** die
wartenden (`NetscriptFunctions/Singularity.ts:79-91`), `(false)` nur die
eingebauten; die Differenz **ist** die Warteschlange. Kosten: `SingularityFn3`
= 5 GB, mit SF4.1 also 80 GB — beide Aufrufe zusammen 80 GB, weil derselbe Name
nur einmal zaehlt. Der Vollstrecker kaeme also auf 162,60 GB. **Billiger und
richtiger**: `bn4rep.js` weiss beim Kauf, was es gekauft hat, und schreibt
`data/aug-queue.json`; der Vollstrecker liest die Datei (0 GB) und kostet 82,60.
Ab SF4.3 und in BN4 sind es 7,60.

**Frei zu haben, ohne SF4-Aufschlag** (`RamCostGenerator.ts`, Block `bladeburner`
und `sleeve`): die gesamte Bladeburner-API kostet `BladeburnerApiBase` = 4 GB je
Funktion und die Sleeve-API `SleeveBase` = 4 GB — **beide laufen nicht durch
`SF4Cost`**. Das ist der Grund, warum es einen 6,60-GB-Figurentreiber fuer den
Kaltstart ueberhaupt geben kann (§4.3).

**Ebenfalls frei**: `ns.getResetInfo()` (1 GB, kein SF4-Faktor) liefert
`currentNode`, `lastNodeReset`, `lastAugReset`, `ownedAugs` (Map, also die Zahl
der **eingebauten** Augmentierungen umsonst) und `ownedSF` (Map, also die
SF4-Stufe umsonst). `ns.singularity.getOwnedSourceFiles` mit 80 GB wird nirgends
gebraucht. Das ist die technische Voraussetzung dafuer, dass die Registry ihre
SF-Spalte zur Laufzeit selbst waehlen kann (§1.3).

---

# 1 REGISTRY-SCHEMA

## 1.1 Was an §4.2 nicht reicht, und warum

§4.2 nennt: `name, args, ramGb (gemessen, Datum, je SF4-Stufe), verfahren,
knoten, phase, telemetryFile, freshnessMs, taktMs, hostRule, priority,
needsFigure, needsLibs, singularity, restartPolicy`.

Sieben Ergaenzungen, jede mit dem Grund, an dem sie haengt:

1. **`ramBaseGb` / `ramSingGb` statt „ramGb je SF4-Stufe".** Vier Spalten sind
   vier Gelegenheiten zu widersprechen. Es gibt aber nur **einen** Freiheitsgrad:
   den Singularity-Anteil. Zwei Zahlen, eine Formel, 342/342 geeicht (§0). Eine
   Zeile kann dann nicht mehr in sich falsch sein, und `sf4Sensitive` ist kein
   Feld, sondern `ramSingGb > 0`.
2. **`ramMeasuredAt` + Laufzeit-Gegenprobe.** `doku/ram-budget.md` beantwortet
   die Verifikationsfrage „Stillstand und Nachholen?" mit: die Zahl aendert sich,
   **sobald jemand die Datei anfasst**. Eine Registry ohne Gegenprobe ist deshalb
   nach der ersten Codeaenderung eine Luege. Der Kern hat `ns.getScriptRam` (0,1
   GB) ohnehin im Budget; er vergleicht beim ersten Start je Lauf und schreibt
   bei Abweichung > 0,05 GB ein Ereignis, uebernimmt den Spielwert nach
   `data/registry-state.json` und plant ab da mit dem Spielwert. **Die Registry
   ist der Planwert, das Spiel ist die Wahrheit.**
3. **`precondition`** (`requiresFile`, `forbidsFile`, `requiresSF`,
   `minHostRamGb`, `minHomeRamGb`). Ohne dieses Feld bleiben die Marker
   (`keine-sleeves`, `keine-hacknet`, `bn4-stop`, `install-sperre`,
   `rep-modus`, `geldbedarf`) als `if`-Zweige im Kern stehen — genau die
   Sonderfaelle, die §4.2 abschaffen will. `requiresSF` ist der Ersatz fuer
   „hashes.js wartet halt, wenn es keinen Hacknet-Server gibt": aus einem
   stillen Leerlauf wird ein benannter Zustand.
4. **`evictRank` neben `priority`.** Das sind zwei verschiedene Ordnungen.
   `priority` ist die **Startreihenfolge** (§4.4 Rangfolge 1–7). `evictRank` ist,
   **wen der Kern beendet**, wenn ein hoeher priorisiertes Werkzeug Platz
   braucht. Ohne die zweite Ordnung ist `werkzeugWartetGb` (`bn4net.js:3013`) ein
   Wert ohne Adressaten.
5. **`maxInstances`** (Vorgabe 1, Arbeiter `null`). Die Entdopplung
   („juengste PID bleibt", `bn4net.js:2741-2760`) braucht eine Zahl, gegen die
   sie prueft, sonst kann sie Arbeiter nicht von Gewerken unterscheiden.
6. **`killSafe`.** Sprosse 3 killt „Kern, Registry-Werkzeuge und Arbeiter".
   Ohne dieses Feld killt sie den Waechter, der sie gerade ausfuehrt. `guard.js`
   und `boot.js`: `false`. Alles andere: `true`.
7. **`state` (abgeleitet, nicht gepflegt).** `unbuilt | absent | vanished |
   running | degraded | retired`. Der Unterschied traegt eine Entscheidung —
   siehe §1.4.

Zwei Klarstellungen zu vorhandenen Feldern:
- **`restartPolicy`** braucht einen Wertebereich, sonst wiederholt sich der
  `bbtrain.js`-Streit von 25.08. (Kommentar `bn4net.js:266-268` gegen
  `:288-297`): `always | oneshot | until-done | never`. `bbtrain.js` ist
  `always` — nicht weil es dauerhaft arbeitet, sondern weil ein Aug-Einbau die
  Aufgabe neu erzeugt.
- **`telemetryFile`** braucht `scpToHome: true|false`. §5.1 nennt die Falle
  selbst („Werkbank-Schreiber ohne `scp` -> Dauerkill"); `sleevecrime.js` hat
  sie heute (§1.4). Das Feld macht sie in Ebene 0 pruefbar statt im Betrieb.

## 1.2 `src/registry.json` — vollstaendiges Beispiel

Alle `ramBaseGb`/`ramSingGb` sind aus der Messung vom 04.09. abgeleitet und
gegen alle drei SF-Stufen geeicht (§0). `verfahren`/`knoten`/`phase` bilden den
heutigen Zustand ab, nicht einen Wunsch.

```json
{
  "schema": 1,
  "stand": "2026-09-04",
  "ramQuelle": "doku/ram-messung-2026-09-04.json (114 Dateien, live gegen lokal 0,00 GB)",
  "ramFormel": "ramBaseGb + ramSingGb * (node===4 ? 1 : sf4<=1 ? 16 : sf4===2 ? 4 : 1)",
  "eintraege": [

    { "name": "guard.js", "args": [],
      "ramBaseGb": 7.30, "ramSingGb": 0, "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle", "knoten": "alle", "phase": "beide",
      "telemetryFile": "data/watchdog.json", "scpToHome": false,
      "freshnessMs": 600000, "taktMs": 10000,
      "hostRule": "home", "priority": 2, "evictRank": 99,
      "needsFigure": "none", "needsLibs": [], "singularity": false,
      "restartPolicy": "always", "maxInstances": 1, "killSafe": false,
      "precondition": {} },

    { "name": "bn4net.js", "args": [],
      "ramBaseGb": 10.75, "ramSingGb": 0, "ramMeasuredAt": "PLAN-nach-Diaet",
      "ramHeuteGb": 17.75,
      "verfahren": "alle", "knoten": "alle", "phase": "beide",
      "telemetryFile": "data/bn4net.json", "scpToHome": false,
      "freshnessMs": 600000, "taktMs": 10000,
      "hostRule": "home", "priority": 1, "evictRank": 99,
      "needsFigure": "none", "needsLibs": [], "singularity": false,
      "restartPolicy": "always", "maxInstances": 1, "killSafe": false,
      "precondition": {} },

    { "name": "ausgang.js", "args": [],
      "ramBaseGb": 8.15, "ramSingGb": 0, "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle", "knoten": "alle", "phase": "beide",
      "telemetryFile": "data/ausgang.json", "scpToHome": false,
      "freshnessMs": 600000, "taktMs": 30000,
      "hostRule": "any", "priority": 7, "evictRank": 6,
      "needsFigure": "none", "needsLibs": [], "singularity": false,
      "restartPolicy": "always", "maxInstances": 1, "killSafe": true,
      "precondition": { "minHostRamGb": 8.56 } },

    { "name": "wakelock.js", "args": [],
      "ramBaseGb": 2.25, "ramSingGb": 0, "ramMeasuredAt": "PLAN-nach-connect-Fix",
      "ramHeuteGb": 34.25,
      "verfahren": "alle", "knoten": "alle", "phase": "beide",
      "telemetryFile": "data/wakelock.json", "scpToHome": true,
      "freshnessMs": 600000, "taktMs": 60000,
      "hostRule": "home", "priority": 3, "evictRank": 1,
      "needsFigure": "none", "needsLibs": [], "singularity": false,
      "restartPolicy": "always", "maxInstances": 1, "killSafe": true,
      "precondition": {} },

    { "name": "blade.js", "args": [],
      "ramBaseGb": 94.35, "ramSingGb": 5.00, "ramMeasuredAt": "2026-09-04",
      "verfahren": "V2", "knoten": "alle", "phase": "normal",
      "telemetryFile": "data/blade.json", "scpToHome": true,
      "freshnessMs": 600000, "taktMs": 30000,
      "hostRule": "werkbank", "priority": 10, "evictRank": 20,
      "needsFigure": "request", "needsLibs": [], "singularity": true,
      "restartPolicy": "always", "maxInstances": 1, "killSafe": true,
      "precondition": { "minHostRamGb": 183.07 } },

    { "name": "sleevecrime.js", "args": [],
      "ramBaseGb": 7.65, "ramSingGb": 0, "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle", "knoten": "alle", "phase": "kaltstart",
      "telemetryFile": "data/sleevecrime.json", "scpToHome": true,
      "freshnessMs": 900000, "taktMs": 60000,
      "hostRule": "any", "priority": 4, "evictRank": 4,
      "needsFigure": "none", "needsLibs": [], "singularity": false,
      "restartPolicy": "until-done", "maxInstances": 1, "killSafe": true,
      "precondition": { "forbidsFile": "data/keine-sleeves.txt" } },

    { "name": "hashes.js", "args": [],
      "ramBaseGb": 5.95, "ramSingGb": 0, "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle", "knoten": "alle", "phase": "beide",
      "telemetryFile": "data/hashes.json", "scpToHome": true,
      "freshnessMs": 900000, "taktMs": 60000,
      "hostRule": "not-hacknet", "priority": 4, "evictRank": 5,
      "needsFigure": "none", "needsLibs": [], "singularity": false,
      "restartPolicy": "always", "maxInstances": 1, "killSafe": true,
      "precondition": { "requiresSF": { "9": 1 } } },

    { "name": "contracts.js", "args": ["--loop", "300"],
      "ramBaseGb": 17.65, "ramSingGb": 0, "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle", "knoten": "alle", "phase": "normal",
      "telemetryFile": "data/contracts.json", "scpToHome": true,
      "freshnessMs": 1800000, "taktMs": 300000,
      "hostRule": "any", "priority": 5, "evictRank": 10,
      "needsFigure": "none", "needsLibs": [], "singularity": false,
      "restartPolicy": "always", "maxInstances": 1, "killSafe": true,
      "precondition": { "minHostRamGb": 18.53 } },

    { "name": "cdump.js", "args": [],
      "ramBaseGb": 12.00, "ramSingGb": 0, "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle", "knoten": "alle", "phase": "kaltstart",
      "telemetryFile": "data/cdump.json", "scpToHome": true,
      "freshnessMs": 1800000, "taktMs": 300000,
      "hostRule": "home", "priority": 5, "evictRank": 9,
      "needsFigure": "none", "needsLibs": [], "singularity": false,
      "restartPolicy": "until-done", "maxInstances": 1, "killSafe": true,
      "precondition": { "forbidsFile": "data/contracts-laeuft.txt" } },

    { "name": "bn4rep.js", "args": [],
      "ramBaseGb": 10.75, "ramSingGb": 52.50, "ramMeasuredAt": "2026-09-04",
      "verfahren": "V1", "knoten": "alle", "phase": "normal",
      "telemetryFile": "data/bn4rep.json", "scpToHome": true,
      "freshnessMs": 900000, "taktMs": 60000,
      "hostRule": "werkbank", "priority": 12, "evictRank": 30,
      "needsFigure": "request", "needsLibs": ["lib/hackaugs.js"], "singularity": true,
      "restartPolicy": "always", "maxInstances": 1, "killSafe": true,
      "precondition": { "minHostRamGb": 893.29, "forbidsFile": "data/install-sperre.txt" } },

    { "name": "figure.js", "args": [],
      "ramBaseGb": 20.55, "ramSingGb": 13.00, "ramMeasuredAt": "2026-09-04-Entwurf",
      "verfahren": "alle", "knoten": "alle", "phase": "normal",
      "telemetryFile": "data/figure.json", "scpToHome": true,
      "freshnessMs": 300000, "taktMs": 5000,
      "hostRule": "werkbank", "priority": 8, "evictRank": 25,
      "needsFigure": "owner", "needsLibs": [], "singularity": true,
      "restartPolicy": "always", "maxInstances": 1, "killSafe": true,
      "precondition": { "minHostRamGb": 239.98 } },

    { "name": "figure-cold.js", "args": [],
      "ramBaseGb": 6.60, "ramSingGb": 0, "ramMeasuredAt": "2026-09-04-Entwurf",
      "verfahren": "V2", "knoten": "alle", "phase": "kaltstart",
      "telemetryFile": "data/figure.json", "scpToHome": true,
      "freshnessMs": 300000, "taktMs": 10000,
      "hostRule": "home", "priority": 4, "evictRank": 3,
      "needsFigure": "owner", "needsLibs": [], "singularity": false,
      "restartPolicy": "always", "maxInstances": 1, "killSafe": true,
      "precondition": { "forbidsFile": "data/figure-owner-full.txt" } },

    { "name": "worker/weaken.js", "args": [],
      "ramBaseGb": 1.80, "ramSingGb": 0, "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle", "knoten": "alle", "phase": "beide",
      "telemetryFile": null, "scpToHome": false,
      "freshnessMs": null, "taktMs": null,
      "hostRule": "not-hacknet", "priority": 4, "evictRank": 2,
      "needsFigure": "none", "needsLibs": [], "singularity": false,
      "restartPolicy": "never", "maxInstances": null, "killSafe": true,
      "precondition": {} },

    { "name": "boerse.js", "args": [],
      "ramBaseGb": null, "ramSingGb": null, "ramMeasuredAt": null,
      "verfahren": "V1", "knoten": [8], "phase": "beide",
      "telemetryFile": "data/boerse.json", "scpToHome": true,
      "freshnessMs": 600000, "taktMs": 30000,
      "hostRule": "werkbank", "priority": 9, "evictRank": 15,
      "needsFigure": "none", "needsLibs": [], "singularity": false,
      "restartPolicy": "always", "maxInstances": 1, "killSafe": true,
      "state": "unbuilt",
      "precondition": {} }
  ]
}
```

`worker/weaken.js` steht bewusst darin, obwohl es kein Werkzeug ist:
`telemetryFile: null` + `restartPolicy: "never"` + `maxInstances: null` ist die
maschinenlesbare Aussage „das hier ist ein Arbeiter, nicht ueberwachen, nicht
neu starten, beliebig viele" — heute steckt genau diese Unterscheidung in
Kommentaren und in der Sonderbehandlung im Waterfall.

## 1.3 Wie erkennt der Kern, dass ein Eintrag fuer den aktuellen Knoten gilt?

Aus **zwei** Quellen, und die zweite ist die wichtige:

1. `ns.getResetInfo()` (1 GB, ohnehin im Kernbudget) liefert `currentNode` und
   `ownedSF` — daraus `knoten`-Filter, `requiresSF`-Filter **und** der
   SF4-Faktor fuer die RAM-Formel.
2. `data/verfahren.txt` (`"V2 10 2"`, geschrieben von `ausgang.js`) liefert
   `verfahren` und `level`.

Die Pruefkette:

    gilt(e) = passtKnoten(e, ri.currentNode)
           && passtVerfahren(e, rolle.verfahren)
           && passtPhase(e, kaltstartAktiv)
           && passtSF(e, ri.ownedSF)
           && preconditionOk(e)

**Der Riegel, den §4.2 nicht nennt und ohne den die Registry gefaehrlicher ist
als die heutige Liste:** `verfahren.txt` wird von `boot.js` absichtlich **nicht**
geloescht (`boot.js:94-99`, mit Begruendung). Nach einem Knotensprung steht dort
also einige Sekunden lang die Rolle des **alten** Knotens. Der Kern muss deshalb
die Knotennummer **in der Datei** gegen `ri.currentNode` halten:

    if (rolle.node !== ri.currentNode) -> Rolle "unbekannt";
    es starten NUR Eintraege mit verfahren === "alle".

Genau diesen Fall hat der Skeptiker am 02.09. gefunden (zitiert in
`boot.js:94-99`): ohne den Riegel starten `blade.js` und `bbtrain.js` in einem
Hacking-Knoten in derselben synchronen Runde, in der `ausgang.js` die Datei noch
nicht geschrieben hat. Die Registry macht diesen Fehler **haeufiger**, nicht
seltener, weil sie mehr Eintraege gleichzeitig bewertet — also gehoert der Riegel
in die Gate-Funktion, nicht in einen Kommentar.

`knoten: "alle"` ist die Vorgabe; eine Zahlenmenge (`[8]` bei `boerse.js`) ist
zugelassen, weil §4.1 „keine Knotennummer **im Code**" verlangt — `registry.json`
ist Daten, wie `route.json`, das Knotennummern ebenfalls fuehrt.

## 1.4 Was passiert mit einem Eintrag, dessen Datei fehlt?

Drei Faelle, die heute zu einem verschmelzen, und die Unterscheidung traegt eine
Entscheidung:

| `state` | Bedingung | Folge |
|---|---|---|
| `unbuilt` | `ramBaseGb === null`, Datei nie im Repo | **inert.** Kein Start, kein S1, keine Sprosse. Zaehlt in `kpi.json.registry_unbuilt[]`. Nennt ein `route.json`-Eintrag die Datei unter `braucht`, setzt `ausgang.js` `route_state: "blocked"` und nennt sie in der `## Sofort`-Zeile. |
| `absent` | Eintrag gebaut, Datei nicht auf `home` | Kein Start, **kein S1**, ein Ereignis je `nodeReset`. Ursache ist fast immer die Bruecke (Sync-Luecke) oder ein frischer Kaltstart vor `pushAll`. |
| `vanished` | `lastSeenAt` in `registry-state.json` gesetzt, Datei jetzt weg | **Befund.** Ereignis + einmal je Knoten nach `data/sofort.json`. Das ist der Fall, den heute niemand sieht. |

**Die Regel, die daran haengt: eine fehlende Datei speist die Strafleiter nie.**
Nur ein **laufendes** Werkzeug mit veraltetem Herzschlag ist S1. Ohne diese Regel
triebe ein nicht gebautes `boerse.js` die Leiter ueber S2 bis Sprosse 5 — ein
Augmentierungs-Einbau als Antwort auf eine Datei, die es nicht gibt. §5.1 sagt
bereits „`exec` 0 ist kein Haenger"; das hier ist derselbe Satz eine Ebene
frueher.

`degraded` ist der vierte Fall: Datei da, aber `ns.getScriptRam` weicht um mehr
als 0,05 GB von `ramBaseGb + ramSingGb x f` ab. Dann laeuft der Eintrag mit dem
**Spielwert** weiter (nicht anhalten — ein zu grosses Werkzeug ist kein Grund,
gar nichts zu tun), und die Abweichung geht als Ereignis und einmal nach
`## Sofort`. Das ist die Bremse gegen Risiko R1 (§8).

---

# 2 WAECHTER

## 2.1 Datei, Budget, Platz

- **Datei `src/guard.js`.** Neuer, englischer Bezeichner (CLAUDE.md).
  Nicht `wache.js` und nicht `aufsicht.js` — beide Namen sind in `tools/` durch
  die ENTSCHIEDEN-Liste belegt („nicht wieder anwerfen", Doppelstarts C.12/13),
  und ein gleichnamiges Skript in `src/` ist eine Verwechslung, die genau einmal
  passieren muss.
- **RAM 7,30 GB, gemessen, SF4-invariant.** Budget §4.4: ≤ 8. Haelt mit 0,70 GB
  Luft. Funktionssatz und Einzelkosten (`RamCostGenerator.ts:10-53, 558-658`):

      Base                     1,60
      getPlayer                0,50   (SingularityFn1/4 - KEIN SF4Cost)
      getResetInfo             1,00
      ps                       0,20   scan                     0,20
      getServerMaxRam          0,05   getServerUsedRam         0,05
      getScriptRam             0,10   fileExists               0,10
      isRunning                0,10
      scriptKill               1,00   kill                     0,50
      scp                      0,60   exec                     1,30
      read / write / sleep     0,00
      globalThis["docu"+"ment"] 0,00  globalThis["loca"+"tion"] 0,00
      -----------------------------------------------------------------
      Summe                    7,30

  `getHostname` (0,05) ist gestrichen: der Waechter ist per Registry auf `home`
  festgenagelt (`hostRule: "home"`). `document` und `window` als nackte
  Bezeichner kosten 25 GB (`RamCalculations.ts:185-192`); die
  `globalThis["…"]`-Form kostet nichts — im Live-Spiel an `darkweb.js`
  bestaetigt (2,65 statt 27,65 GB, exakt 25 GB Differenz).
- **`globalThis["location"].reload()` kostet 0 GB.** Der offene Punkt aus §1.6
  („0 gegen 25") ist entschieden: mit dem geeichten Rechner gemessen, Gesamtkosten
  eines Skripts, das nur das tut: 1,60 GB, also nur Base. `location` steht in
  keinem Kostenbaum. **Sprosse 4a bleibt beim Waechter.**
- **Was NICHT hineinpasst und delegiert wird: Sprosse 5.**
  `installAugmentations` ist `SingularityFn3` = 5 GB, mit SF4.1 also **80 GB**.
  Der Waechter schreibt `data/penalty-order.json`; der **Kern** validiert
  (Vorbedingungen aus §5.3) und startet `src/punish.js` (82,60 GB SF4.1 / 7,60 ab
  SF4.3) auf einem Wirt mit Platz. Ohne Wirt: `NOT_EXECUTABLE(5)`, protokolliert,
  keine Eskalation — so schreibt es §5.3 ohnehin vor.
- **Rueckfallebene, falls 7,30 doch irgendwo nicht passt** (§4.4 letzter Absatz):
  Fuehler `guard-probe.js` **2,30 GB gemessen** (Base + `getPlayer` + `ps`),
  schreibt `data/watchdog.json`, der Kern fuehrt aus. Sprosse 3 bleibt beim
  Waechter — dann allerdings nicht mehr im Fuehler, sondern gar nicht, weil
  der Kern sich nicht selbst neu starten kann. **Diese Aufteilung ist eine
  Notloesung, kein Entwurf**; §9 zeigt, dass sie nicht gebraucht wird.

## 2.2 Signale

Jedes Signal traegt `Date.now()`, `totalPlaytime` (`ns.getPlayer()`), `round`.

| Sig | Bedingung | Quelle im Waechter |
|---|---|---|
| **S1** | Alter der Telemetrie eines Registry-Eintrags > `freshnessMs` **in Motorzeit** UND Karenz ab UND `nodeReset` aktuell UND Eintrag `state === "running"` | `ns.read(telemetryFile)`, Feld `motorTimeMs` des Schreibers gegen `data/bn4net.json.motorTimeMs` |
| **S2** | Δ Traeger ≤ 0 ueber ≥ 45 min **Motorzeit** in einer Phase, die Fortschritt verlangt | `data/kpi.json` (Kern schreibt Traeger je Rolle) — der Waechter rechnet ihn **nicht** selbst, sonst braeuchte er Bladeburner- und Boersen-APIs |
| **S3a** | Kern-Herzschlag > 10 min | `data/bn4net.json` |
| **S3b** | Engine-Puls `Δ totalPlaytime / Δwall` < 0,2 ueber ≥ 3 min | `ns.getPlayer().totalPlaytime` + `Date.now()` |
| **S4** | `visibilityState !== "visible"` ODER eigene Rundenrate < 2/min bei tickender Engine | `globalThis["docu"+"ment"].visibilityState` (0 GB) — **selbst gelesen**, nicht aus `sonde.json`, weil im Kaltstart niemand `sonde.json` schreibt |
| **S5** | aus `data/bridge.json` (Rueckkanal der Bruecke, 60 s) | `lastTelemetryAt`, `lastSaveAt`, `settings` |
| **S6** | `errStreak ≥ 5` bei tickender Engine und frischem Herzschlag | `data/bn4net.json.errStreak` |

Zwei Praezisierungen gegenueber §5.1:

- **S2 rechnet der Kern, der Waechter liest nur.** Der Traeger ist je nach Rolle
  `BladeburnerRank`, Hacking-Level, `$/s`, Hashes oder Depotwert. Wuerde der
  Waechter ihn selbst holen, kostete allein `ns.bladeburner.getRank` 4 GB und
  `ns.stock.*` 2 GB je Funktion — der 8-GB-Deckel waere weg. Der Kern schreibt
  `kpi.json.traeger = {name, wert, motorTimeMs}`; der Waechter bildet nur die
  Differenz. Nebenwirkung, die erwuenscht ist: **haengt der Kern, laeuft S2 nicht
  mehr** — und genau dann greifen S3a/S6, die den Kern meinen.
- **S1 misst in Motorzeit, nicht in Wanduhr.** Dafuer muss der Kern `motorTimeMs`
  veroeffentlichen und **jeder Schreiber den zuletzt gelesenen Wert
  mitstempeln** (§4.2). Ein Schreiber auf der Werkbank, der `data/…json` nicht
  nach `home` `scp`t, ist per `scpToHome`-Feld in Ebene 0 erkennbar, statt im
  Betrieb als Dauerkill aufzufallen.

## 2.3 Zustandsautomat

Je Paar (Sprosse k, Ziel):

    HEALTHY --Signal--> SUSPECT(k) --Karenz ab--> EXECUTED(k) --> VERIFY(k)
      VERIFY grün  -> HEALTHY, Zaehler des Ziels auf 0
      VERIFY rot   -> SUSPECT(k+1)
      nicht ausfuehrbar -> NOT_EXECUTABLE(k)   [Handlung, KEINE Eskalation]
      k = 5 und rot / alle Deckel gezogen -> EXHAUSTED

`EXHAUSTED`: keine weitere Sprosse, keine Wiederholung, Kern und Werkzeuge laufen
**unveraendert weiter**. `data/watchdog.json.exhausted = {since, lastRung,
signal}`, eine Zeile nach `## Sofort`, danach hoechstens eine je 6 h. Endet, wenn
S2 ueber 60 min Motorzeit Fortschritt zeigt oder `lastNodeReset`/`lastAugReset`
springt. Dieselbe 12-h-Frist fuer einen unveraenderten `NOT_EXECUTABLE`-Grund.

`data/watchdog.json` haelt den Zustand ueber einen eigenen Neustart hinweg
(Feld `nodeReset`; passt es nicht, faengt der Waechter bei 0 an). Ohne das
verliert jede Sprossen-Zaehlung ihren Sinn, sobald der Waechter selbst einmal
neu gestartet wird — und `restartPolicy: "always"` sorgt dafuer, dass das
passiert.

## 2.4 Die drei Uhren — Entscheidung je Frist

**Waechter-Takt: 10 s**, gleich dem Kern. Damit ist der 12x-Deckel 120 s, und
eine gedrosselte Runde (belegt: 1 Timer-Wake je Minute, also ~60 s) zaehlt voll,
waehrend ein echtes Einfrieren (> 2 min) mit 0 zaehlt. Bei 30 s Takt waere der
Deckel 360 s und ein fuenfminuetiger Stillstand zaehlte als Arbeitszeit.

    guardTimeMs  = Σ Δwall ueber eigene Runden, sofern Δwall <= 120000
                   UND Δ totalPlaytime <= Δwall + 60000     (persistent)
    engineTimeMs = Δ totalPlaytime                          (Δ, nicht Summe)
    motorTimeMs  = vom Kern veroeffentlicht                 (gelesen, nie gerechnet)

| Frist | Uhr | Begruendung |
|---|---|---|
| Karenz 10 min nach `lastAugReset`/`lastNodeReset`/eigenem Start | **guard** | Der Kern kann in genau diesem Fenster noch gar nicht laufen; seine Motorzeit stuende. |
| Karenz nach Zeitsprung (Δwall > 12x Takt) | **guard** | ebenso |
| S1 `freshnessMs` | **motor** | Es ist das Alter, das der Kern selbst veroeffentlicht; §5.1 verlangt es woertlich. Faellt der Kern aus, faellt S1 mit ihm aus — dafuer gibt es S3a. |
| S2 45 min / 6 h | **motor** | §5.2 woertlich. S2 misst Spielfortschritt, und der entsteht nur, waehrend der Motor laeuft. |
| S3a 10 min Kern-Herzschlag | **guard** | Der Kern haengt — seine Uhr steht. Eine Frist in Motorzeit liefe hier **nie** ab, also genau im Zielfall nicht. |
| S3b 3 min Pulsfenster | **engine** + guard | Der Puls **ist** das Verhaeltnis der beiden; das Fenster misst der Waechter in Eigenzeit, der Zaehler ist `Δ totalPlaytime`. |
| S6 `errStreak ≥ 5` | keine (Zaehlerstand) | Ein Bestand, keine Rate. |
| Sprosse 0–3: Karenz, Wirkungspruefung, Backoff-Faelligkeit | **guard** | §5.2 woertlich; die Motorzeit steht im Zielfall. |
| Sprosse 4a Auslösung (S3b ≥ 5 min) | **engine** | §5.2 woertlich. |
| Sprosse 4a Wirkung (Puls > 0,9 ueber 3 min) | **engine** | Der Erfolg ist definiert als „Engine tickt wieder". |
| Sprosse 5 Auslösung (S2 ≥ 6 h) | **motor** | §5.3 woertlich. |
| Sprosse 5 Wirkung (`lastAugReset` gesprungen, Konto > 0, 10 min) | **guard** | Nach einem Einbau gibt es noch keinen laufenden Motor. |
| Deckel: 1/2 6x je 6 h; 3 2x je 6 h; 4a 1x/6 h + 3x/24 h | **guard** | §5.3 („alle in benannter Uhr"). |
| Backoff-**Dauer** 5/15/30 min, 10/20/40 min, 2 h | **Wanduhr** | §5.2 woertlich. Ein Backoff soll reale Zeit verstreichen lassen; in Eigenzeit gemessen wuerde er im gedrosselten Tab zur Sperre. |
| `blockedHosts` 60 min | **guard** | Der Wirt bleibt gesperrt, solange der Waechter Zeit erlebt. |
| `EXHAUSTED` / `NOT_EXECUTABLE` 12 h | **guard** | §5.2 woertlich. |

**Der Fehler, den diese Tabelle verhindert.** §5.2 sagt es, aber es ist die eine
Stelle, an der ein Denkfehler den ganzen Waechter wertlos macht: **die Motorzeit
des Kerns darf keine einzige Waechterfrist tragen.** Sobald der Kern haengt,
steht seine Motorzeit — und jede in ihr gemessene Frist laeuft genau in dem Fall
nie ab, fuer den sie gebaut wurde. Der Bezeichner traegt die Uhr
(`waitWatchdogMs`, `waitEngineMs`, `waitMotorMs`), und Ebene 0 grept darauf.

**Drosselung (S4) schaltet nichts ab.** Sie ruhen laesst: die Wanduhr-Backoffs
und die rundenratenbasierten Wirkungspruefungen. Alle Fristen laufen in
Eigenzeit weiter, die die Drosselung ueber `Δwall ≤ 120 s` bereits abbildet.
S4 verlaengert nur die Wirkungspruefung auf mindestens 3 volle Eigenzeit-Runden.
Andernfalls waere die Leiter jede Nacht abgeschaltet — und „Sprossen ≥ 2: 0" in
Stufe B waere trivial erfuellt.

## 2.5 Sprossen — was der Waechter tut

- **0 Umgebung** (S4/S5): Timer-Patch nachziehen, `data/events.json` schreiben.
  Popup-Behandlung bleibt bei `popups.js` (eigener Eintrag), aber mit der
  **Schutzliste** aus §5.3: Dialoge mit `Cannot save game`, `REMOVED FUNCTION`,
  `Recovery`, `Delete` werden **nicht** geschlossen, sondern mit den ersten 120
  Zeichen protokolliert, `kpi.json.blocked_dialog` gesetzt, Sicherungstakt auf
  5 min. Geld-Deadlock (Konto < 0): Auftrag an den Figur-Vergabepunkt
  (`figure-request-guard.json`, `prio: 0`), Kaeufe sperren, Wirkung Konto > 0
  binnen 30 min Eigenzeit; bleibt es 2 h negativ → Befund, keine Sprosse.
- **1 Werkzeug neu** (S1): `scriptKill` auf allen Wirten, Neustart in derselben
  Runde. Backoff 5 min Wanduhr.
- **2 Anderer Wirt** (1 zweimal wirkungslos): Wirt mit meistem freien RAM,
  **abzueglich `blockedHosts`** — der bei 1 gescheiterte Wirt ist 60 min
  Eigenzeit gesperrt, ebenso jeder, auf dem `exec` zweimal 0 lieferte. Ohne diese
  Liste ist „Wirt mit meistem freien RAM" nach dem Raeumen genau der kaputte,
  und die Kette laeuft bis 4a durch: das war das Muster der 17 wirkungslosen
  `wakelock`-Neustarts in 4 h am 02.09. (C.12). Bleibt kein Wirt →
  `NOT_EXECUTABLE(2)`, `reason: "no_space"` (zaehlt **nicht** auf den Deckel),
  Handlung `werkzeugWartetGb` + Ausbau.
- **3 Alles killen, `boot.js`** (S3a + Engine tickt; ODER S6 sofort): killt nur
  Eintraege mit `killSafe: true` plus Arbeiter, leert `reload.txt`/`task.txt`,
  `exec("boot.js")`. **Nicht den Kern direkt starten** — `boot.js` ist das
  einzige Skript, das weiss, wie `home` freigeraeumt wird. Der Waechter traegt
  sich vor dem `exec` ein und prueft nach 6 min, ob er selbst noch laeuft.
  Backoff 30 min.
- **4a Reload von innen**: nur ueber den benannten React-Prop `save` des
  CharacterOverview-Knotens (`GameRoot.tsx:536-541`), „Game Saved!" abwarten,
  `onbeforeunload = null`, `reload()` (0 GB, gemessen). Vier Riegel wie §5.3,
  einschliesslich der Einstellungspruefung aus `bridge.json.settings`
  (`autosaveInterval > 0`, `excludeRunningScriptsFromSave === false`,
  `autoexecScript === "boot.js"`, Feld ≤ 30 min alt). **Wird nur gebaut, wenn der
  Pruefstand (Ebene 3) zeigt, dass ein skriptausgeloester Reload keinen
  `beforeunload`-Dialog stehen laesst.** Sonst endet die Leiter bei 3 — so
  schreibt es §5.3 vor, und das ist kein Verhandlungspunkt.
- **5 Soft-Reset durch Einbau**: der Waechter **fuehrt nicht aus**, er beauftragt
  (§2.1). Alle acht Vorbedingungen aus §5.3 prueft der Kern erneut, weil sich
  zwischen Auftrag und Ausfuehrung `ausgang.json.offen` geaendert haben kann.
  `ns.singularity.softReset` wird nicht gebaut.

**Der Waechter irrt in Richtung Untaetigkeit** und schreibt jeden Verdacht.
`data/penalties.json` (Ringpuffer 200, nicht in den Raeumlisten):
`{rung, target, reason, wall, playtime, motorTime, guardTime, round, node,
nodeReset, augReset, result, verifiedAt}`.

---

# 3 TELEMETRIE-SCHEMA

## 3.1 Pflichtfelder, in jedem Block

    ts            Date.now() beim Schreiben
    wall          == ts (Zweitwert, ausdruecklich benannt)
    playtime      ns.getPlayer().totalPlaytime
    motorTimeMs   zuletzt vom Kern veroeffentlichte Motorzeit
    round         Zahl der Schleifendurchlaeufe
    okRound       Zahl der VOLLSTAENDIG durchlaufenen Runden
    errStreak     aufeinanderfolgende Ausnahmen der Rundenfunktion
    lastError     {cls, msg, at} | null   (msg auf 200 Zeichen gekuerzt)
    nodeReset     ns.getResetInfo().lastNodeReset
    augReset      ns.getResetInfo().lastAugReset
    host          auf welchem Rechner geschrieben
    version       Dateiversion (fuer den Wirkungsbeleg beim Hot-Swap, §9)
    state         "work" | "wait" | "blocked" | "done"
    blockedReason null | "no_space" | "no_role" | "not_in_division" | "no_money" | ...

Ein Block **ohne** `errStreak` und `lastError` gilt als **ungueltig** und damit
als veraltet (§4.2). Das ist die Migration: ein alter Schreiber besteht die
Frischepruefung nicht mehr, statt still weiterzulaufen.

## 3.2 Wie das Schema verhindert, dass ein werfender Motor als gesund gilt

Die ganze Runde des Kerns liegt in einem `try` (`bn4net.js:391-392, 3167-3170`).
Ein Motor, der **jede** Runde wirft, zaehlt trotzdem weiter, schreibt trotzdem
Telemetrie und ist nach S1 (frisch), S3a (frisch) und S3b (Engine tickt) in jeder
Hinsicht gesund. Erst S2 schlueg nach 45 min an — und dessen einziger
Sprossenausgang ist Sprosse 5. Ein Codefehler waere mit einem
Augmentierungs-Einbau beantwortet.

Drei Bauteile schliessen das:

1. **`errStreak`** wird von genau dem `catch` gesetzt, das die Ausnahme
   schluckt; eine saubere Runde setzt ihn auf 0. `≥ 5` ist **S6** und fuehrt
   **direkt auf Sprosse 3**, nicht auf 1 oder 2 — das Werkzeug ist nicht das
   Problem.
2. **`okRound` neben `round`.** `round` zaehlt Durchlaeufe, `okRound` nur
   vollstaendige. Die Wirkungspruefung von Sprosse 3 verlangt „Kern-`round`
   waechst UND `errStreak == 0`" — mit `okRound` ist das **pruefbar** statt nur
   gefordert. Ein Kern, dessen `round` steigt und dessen `okRound` steht, ist
   per Definition nicht gesund.
3. **`state` + `blockedReason`.** Der dritte Fall ist der leiseste: das Werkzeug
   laeuft, wirft nicht, tut aber nichts. `blade.js:609-617` schreibt dafuer heute
   schon von Hand einen Minimal-Herzschlag mit `wartend: true` — genau die
   richtige Idee, aber als Sonderfall in einer Datei. Im Schema ist es ein Feld:
   `state: "wait"` haelt S1 ruhig und schliesst den Eintrag zugleich aus der
   S2-Traegerrechnung aus. **Ein Werkzeug in `wait` kann keinen Fortschritt
   belegen und wird auch nicht dafuer bestraft, keinen zu haben.**

Bleibt `errStreak` nach `boot.js` bestehen, ist es kein Haenger, sondern ein
Codefehler: Rollback-Ausloeser nach §9, `## Sofort`, **keine** weitere Sprosse.

## 3.3 Ein Block je Werkzeugklasse

**Kern (`data/bn4net.json`)** — Pflichtfelder plus die Fuehrungsgroessen, aus
denen `checkin.js` und der Waechter arbeiten:

```json
{ "ts": 1788482121302, "wall": 1788482121302, "playtime": 1324440000,
  "motorTimeMs": 201600000, "round": 4035, "okRound": 4035,
  "errStreak": 0, "lastError": null,
  "nodeReset": 1788271154961, "augReset": 1788271154961,
  "host": "home", "version": "2026-09-04a", "state": "work", "blockedReason": null,
  "rolle": { "verfahren": "V2", "node": 10, "level": 2, "quelleAktuell": true },
  "phase": "normal", "sf4": 1, "sf4Faktor": 16,
  "registry": { "gilt": 11, "running": 9, "absent": 0, "unbuilt": 1,
                "vanished": 0, "degraded": 0, "wartetGb": 0 },
  "traeger": { "name": "BladeburnerRank", "wert": 596.0, "motorTimeMs": 201600000 },
  "netz": { "gerootet": 85, "brachAnteil": 0.0022, "werkbank": "werk-0" } }
```

**Gewerk auf der Werkbank (`data/blade.json`)** — identische Pflichtfelder,
`scpToHome: true`, deshalb `host !== "home"`:

```json
{ "ts": 1788482118000, "wall": 1788482118000, "playtime": 1324436000,
  "motorTimeMs": 201597000, "round": 812, "okRound": 811,
  "errStreak": 1, "lastError": { "cls": "TypeError", "msg": "chaos of undefined", "at": 1788482118000 },
  "nodeReset": 1788271154961, "augReset": 1788271154961,
  "host": "werk-0", "version": "2026-09-04a", "state": "work", "blockedReason": null,
  "figur": { "besitzer": "blade.js", "seit": 1788481000000, "leaseBis": 1788482400000 },
  "aktion": { "typ": "Operation", "name": "Undercover Operation", "chance": 0.71 },
  "vorrat": { "Operation": 4.2, "Contract": 11.8 } }
```

`errStreak: 1` bei `okRound = round − 1` ist der sichtbare Beleg dafuer, dass die
beiden Zaehler unabhaengig sind — genau das, was ein einzelner `round` verdeckt.

**Arbeiter** schreiben **nichts**. `telemetryFile: null` in der Registry ist die
Aussage; ohne sie versuchte der Waechter, 2.871 Arbeiterinstanzen einzeln zu
ueberwachen.

**Waechter (`data/watchdog.json`)** — er ist selbst ein Registry-Eintrag und
schreibt dasselbe Schema plus seinen Zustand:

```json
{ "ts": 1788482120000, "wall": 1788482120000, "playtime": 1324438000,
  "motorTimeMs": 201600000, "round": 20174, "okRound": 20174,
  "errStreak": 0, "lastError": null,
  "nodeReset": 1788271154961, "augReset": 1788271154961,
  "host": "home", "version": "2026-09-04a", "state": "work", "blockedReason": null,
  "guardTimeMs": 201660000, "taktMs": 10000, "modus": "observe",
  "signale": { "S1": [], "S2": null, "S3a": false, "S3b": false, "S4": true, "S5": null, "S6": false },
  "automat": { "wakelock.js": { "state": "HEALTHY", "seit": 1788480000000 } },
  "blockedHosts": { "wakelock.js": [ { "host": "werk-3", "bis": 1788485000000 } ] },
  "deckel": { "rung1": { "wakelock.js": 2 }, "rung3": 0, "rung4a": 0 },
  "exhausted": null }
```

**Bruecke (`data/bridge.json`, per `pushFile`)** — der einzige Block von aussen;
Pflichtfeld `lastVerifiedBackup` (§4.5) und `settings` fuer den 4a-Riegel.

---

# 4 FIGUR-VERGABEPUNKT (Audit C.14)

## 4.1 Wer entscheidet

**Genau eine Instanz**, Registry-Eintrag mit `needsFigure: "owner"`. Zwei
Fassungen, weil eine nicht reicht:

| | Datei | RAM SF4.1 | RAM SF4.3 | Wo |
|---|---|---:|---:|---|
| Normalbetrieb | `src/figure.js` | **228,55** | **33,55** | Werkbank |
| Kaltstart, V2 | `src/figure-cold.js` | **6,60** | **6,60** | `home` |

`figure.js` ist mit 228,55 GB im Kaltstart nicht startbar — §4.4 sagt es
allgemein („Keine Einzelaufruf-Singularity-Skripte, 33,6 GB Minimum bei SF4.1")
und hier ist die konkrete Zahl. **Der Ausweg ist gemessen:** die Bladeburner-API
laeuft nicht durch `SF4Cost` (`RamCostGenerator.ts`, Block `bladeburner`:
`BladeburnerApiBase` = 4). Ein Treiber, der nur `inBladeburner` (0),
`getCurrentAction` (1) und `startAction` (4) kennt, kostet **6,60 GB in jedem
Knoten und jeder SF-Stufe**. Er waehlt nicht die beste Aktion — er haelt die
Figur besetzt und faehrt eine feste Leiter, bis die Werkbank steht und
`figure.js` uebernimmt (dann setzt der Kern `data/figure-owner-full.txt`, und
die `precondition` des Kalt-Treibers wird falsch).

Im V1-Kaltstart gibt es keinen Bladeburner. Dort gibt es **keinen**
Vergabepunkt — und das ist richtig, weil dort auch kein Skript die Figur
anfassen **kann**: jeder Zugriff kostet mindestens 33,6 GB und passt nicht auf
32 GB `home`. Der Vergabepunkt entsteht mit der Werkbank, nicht vorher.

## 4.2 Dateiformat

**Antrag** `data/figure-request-<tool>.json`, geschrieben vom Gewerk, TTL:

```json
{ "tool": "graft.js", "prio": 10, "action": "graft",
  "detail": { "aug": "Violet Congruity Implant", "restMs": 846000 },
  "reason": "graftplan Position 1, Entropie loeschen",
  "wall": 1788482100000, "motorTimeMs": 201599000,
  "nodeReset": 1788271154961, "ttlMs": 60000 }
```

**Vergabe** `data/figure.txt`, eine Zeile JSON, geschrieben nur vom Besitzer:

```json
{ "owner": "graft.js", "action": "graft", "since": 1788482101000,
  "leaseMs": 900000, "leaseBis": 1788483001000,
  "wall": 1788482101000, "nodeReset": 1788271154961, "seq": 4711 }
```

Rangfolge (§4.2): **Graft > Bladeburner-Aktion > Faktionsarbeit > Gym >
Verbrechen**, als `prio` 10 / 20 / 30 / 40 / 50 (kleiner gewinnt). Mit
`data/simulacrum.txt` laufen Graft und Bladeburner parallel — dann vergibt der
Punkt **zwei** Besitze (`owner` wird zu einer Liste mit hoechstens einem
Nicht-Graft-Eintrag).

**Drei Eigenschaften, ohne die eine Datei nichts regelt:**

1. **Lease, nicht Besitz.** `leaseBis` laeuft ab. Ein toter Besitzer haelt die
   Figur sonst bis zum naechsten Reset. Der Besitzer verlaengert, indem er seinen
   Antrag neu schreibt; laeuft die Lease ab, faellt die Figur an die Rangfolge
   zurueck und der Vorfall geht als Ereignis nach `events.json`.
2. **`seq` monoton.** Wer `figure.txt` liest und eine kleinere `seq` sieht als
   beim letzten Mal, liest eine veraltete Datei (Werkbank/`home`-Rennen) und
   handelt **nicht**.
3. **`nodeReset` gestempelt.** Nach einem Sprung ist jede Vergabe ungueltig.
   `figure.txt` steht **nicht** in den Raeumlisten von `boot.js`; der Stempel
   ersetzt das Loeschen und ueberlebt den Einbau, bei dem `figure.txt` gebraucht
   wird (nach `installAugmentations` will genau ein Skript ins Gym).

## 4.3 Wie die sechs bis sieben Skripte gebaendigt werden

**Per `grep` gefunden (04.09., `src/*.js`, `singularity.{workForFaction,
gymWorkout, commitCrime, travelToCity, stopAction}`, `grafting.graftAugmentation`,
`bladeburner.{startAction, stopBladeburnerAction}`):**

| Datei | Fundstellen | RAM SF4.1 | Zukunft |
|---|---|---:|---|
| `src/bbtrain.js` | `:204` travelToCity, `:272` stopAction, `:303` gymWorkout, `:320` stopAction | 94,75 | `needsFigure: "request"` |
| `src/blade.js` | `:1098` travelToCity, `:1099` stopBladeburnerAction, `:1100` gymWorkout, `:3232` stopBladeburnerAction, `:3439` startAction | 174,35 | `needsFigure: "request"` |
| `src/bn4life.js` | `:211` travelToCity, `:384` commitCrime | 293,85 | `needsFigure: "request"` |
| `src/bn4rep.js` | `:1854` workForFaction | 850,75 | `needsFigure: "request"` |
| `src/graft.js` | `:143` travelToCity, `:173` stopBladeburnerAction, `:177` graftAugmentation | 145,45 | `needsFigure: "request"` |
| `src/joinrun.js` | `:56` travelToCity, `:101` gymWorkout, `:111` travelToCity | 371,35 | **ARCHIV** — `join*.js` steht in §1.5 („tot"); C.14 sagt zusaetzlich „joinrun verliert sein Gym ganz". Damit ist ein Konfliktteilnehmer nicht zu baendigen, sondern weg. |
| `src/kampfaugs.js` | `:186` workForFaction | 387,85 | `needsFigure: "request"` — keine Messung rechtfertigt ARCHIV, aber **ohne Registry-Eintrag startet es nie** (§4.4). |

`src/bn4net.js:2691` und `:2822` sind **Kommentare**, keine Aufrufe — der Kern
fasst die Figur nicht an, und das bleibt so. `src/bbgraft.js` erklaert sich im
Kopf (`:12`) selbst zum reinen Leser. `src/exploit3.js` ist §1.5-tot.

**Drei Schichten, weil eine Datei allein nichts erzwingt:**

1. **Code (5–15 Zeilen je Datei, +0,00 GB).** Vor jedem figurberuehrenden Aufruf:
   Antrag schreiben, `figure.txt` lesen, bei fremdem Besitzer **zurueckkehren**.
   `ns.read`/`ns.write` kosten 0 GB — die Aenderung ist damit RAM-neutral, was
   fuer `bn4rep.js` (850,75) und `kampfaugs.js` (387,85) der Unterschied
   zwischen „geht" und „geht nicht" ist.
2. **Verbotsgrep (§6.1), neue Regel, in Ebene 0.** Ein figurberuehrender Aufruf
   darf nur in einer Datei stehen, deren Registry-Eintrag `needsFigure` auf
   `"request"` oder `"owner"` setzt, **und** innerhalb von fuenf Zeilen unter
   einem `hasFigure(`-Aufruf. Das ist die eigentliche Durchsetzung: sie laeuft
   auf dem Worktree, **bevor** eine Datei live geht, und sie kann nicht vergessen
   werden.
3. **Erkennung (Vergabepunkt, je Runde).** Er vergleicht die tatsaechlich
   laufende Handlung (`getCurrentWork` / `bladeburner.getCurrentAction`) mit der
   vergebenen. Weicht sie ab, ist das `figure_conflict` in `events.json` mit dem
   verdaechtigen Antragsteller — und §3.3 hat den Symptomwert schon:
   `t_rebuild_h` weicht > 30 % ab.

**Warum das Ping-Pong damit endet.** C.14 beschreibt: `bbtrain` ruft
`stopAction()` bei Konto < 5 Mio → `joinrun` meldet „kein Kurs" → Gym → `bbtrain`
stoppt wieder. Danach: `joinrun` ist archiviert; `bbtrain` haelt die Figur nur
mit gueltiger Lease und gibt sie mit einer Begruendung zurueck, statt sie
wegzuziehen; und der Geld-Deadlock, der `bbtrain` ueberhaupt erst stoppen liess,
ist Sprosse 0 mit einem eigenen Antrag (`prio: 0`) — er **gewinnt** die Figur,
statt sie einem anderen zu entreissen.

---

# 5 PORTIERUNGSLISTE

**Regel: ohne Messung kein Aendern.** Eine Messung ist: A1 (RAM ueber Budget),
A5 (Block laeuft im Zielzustand nicht), 8.1 (Eichpunkt verfehlt) oder ein
datierter Vorfall im Protokoll. Ein Argument ist keine Messung. Eine fehlende
Messung ist kein Freibrief zum Archivieren.

| Modul | Urteil | Die Messung, die es erzwingt |
|---|---|---|
| `src/wakelock.js` | **AENDERN** | 34,25 GB gemessen; davon **32,00 GB** aus der Namensgleichheit `osc.connect(...)` mit `singularity.connect` (`wakelock.js:91`, `RamCalculations.ts:216-243`). Mit `["con"+"nect"]` fallen sie auf **2,25 GB**. Ohne den Fix reisst die Kaltstart-Rangfolge auf **Rang 3** — 34,25 GB auf einem 32-GB-`home` ist nicht „knapp", sondern nicht startbar (`ram-budget.md` §3.1). Zwei Zeichen, 32 GB. |
| `src/bn4net.js` | **AENDERN, chirurgisch** | 17,75 GB gemessen. Resident Kern+Waechter+`boot.js` = 30,55 > 28 (Ebene-1-Tor §4.4). `contracts.js` fehlen **3,4 GB**, nicht 1,9 (17,75 + 17,65 = 35,40). Zwei Ausloesungen, beide mechanisch: `cloud.*` (7 Funktionen, **4,00 GB**) nach `src/cloud.js` (gemessen 7,60 GB, nur Normalbetrieb); `hackAnalyze`-Familie (**3,00 GB**) im Kaltstart-Modus inline. Ergebnis **10,75 GB**. Zusaetzlich: die Kaltstart-Leiter `:733-749` rechnete am 02.09. mit BN6-Preisen und kostete **13,5 h Stillstand** — der Preis kommt jetzt aus `cloud.getServerCost`, also aus `cloud.js`. Sonst nichts. |
| `src/boot.js` | **AENDERN, minimal** | Nicht wegen RAM: 5,50 statt 4,0, aber mit dem 10,75-Kern ergibt sich 10,75+7,30+5,50 = **23,55 ≤ 28**. Erzwingend ist die **Schonliste** (§4.1): die Fuenf-Minuten-Raeumung (`:119-127`) beendet alles auf `home` ausser sich selbst — also auch `guard.js`. Ohne Ausnahme raeumt `boot.js` alle 5 min die Instanz weg, die es ueberwachen soll. Ausnahme fuer `guard.js` und `ausgang.js`, plus Nachstart, wenn sie fehlen. C.15 („gibt nach 20 min auf") ist **erledigt** (`:110-121`, `for (let runde = 0; ; runde++)`). |
| `src/sleeve.js` | **AENDERN** | Datierter Vorfall 02.09.: Konto **−18,5 Mio in 5 min**. Der Geldboden muss die Rueckstandsrechnung aus §4.3 werden (`money ≥ 2.400 x (storedCycles/5 + TAKT/1000)`), nicht eine Rate. 8 h verdeckter Tab = 69,1 Mio je Koerper; die alte 5-Mio-Schwelle deckte 67 s. Die RAM-Abweichung (27,85 statt 14,75) allein erzwaenge nichts. |
| `src/sleevecrime.js` | **AENDERN** | §1.4: „Marker landet auf dem Mietrechner statt `home`". §5.1 nennt die Folge woertlich: Werkbank-Schreiber ohne `scp` → **Dauerkill**. Fix ist `scp` nach `home` (+0,60 GB, danach neu messen). |
| `src/popups.js` | **AENDERN** | Nicht wegen 3,30 statt 1,6. Erzwingend: die Schutzliste aus §5.3. Ein Escape-Handler ohne sie macht aus `Cannot save game` (`SaveObject.ts:245-251` — das Spiel laeuft weiter, **ohne zu speichern**) einen stillen Fehler. Das ist der einzige unmittelbare Hinweis auf ein fehlgeschlagenes IndexedDB-Schreiben und damit ein Sicherheitspunkt aus §7. |
| `src/exit.js` | **AENDERN, +0,00 GB** | 519,25 GB **live bestaetigt** — §1.6 kann „nur gerechnet" streichen. Die Zielvalidierung (Ziel == naechster offener Routeneintrag) besteht aus `ns.read("route.json")` + `JSON.parse` — beide **0 GB**. Der Wirt braucht 519,25 x 1,05 = **545,21 GB**; die Kaufregel `2^ceil(log2(519,25))` ergibt **1024 GB**, nicht die in §1.4 genannten 540. |
| `src/ausgang.js` | **BLEIBT** (+ neue Teile) | 8,15 gemessen, Budget 8,5. Keine Messung erzwingt eine Aenderung am Vorhandenen. Neu **angebaut** (das ist Neubau, nicht Portierung): `eta_min`, `route_state: "route-fertig"/"blocked"`, der Backup-Handschlag spielseitig. |
| `src/blade.js` | **BLEIBT** (+ Figurwaechter) | 174,35 gemessen — die kolportierte „174" war richtig, §1.6 und §1.3 sind es nicht (162,25 / 94,85 / 27,6 trifft keiner). Das ist eine **Dokumentationskorrektur**, keine Codeaenderung. Einzige Aenderung: `hasFigure`-Wache an fuenf Stellen, +0,00 GB (C.14 ist ein datierter Vorfall). |
| `src/bn4rep.js` | **BLEIBT** (+ Figurwaechter, + `aug-queue.json`) | 850,75 gemessen; lief in BN10 L2 **26 h nicht** (§1.4) — die Ursache ist der Wirt (893,29 GB noetig), nicht der Code. Der Registry-Eintrag mit `minHostRamGb` macht daraus eine Planung statt eines Zufalls. Neu: schreibt beim Kauf `data/aug-queue.json`, damit `punish.js` 80 GB spart (§0). |
| `src/graft.js` | **BLEIBT** (+ Figurwaechter) | 145,45 gemessen. Die Grafting-**Automatik** (`graftplan.json`, Reihenfolge, Budgetregel, `violet Congruity` frueh) ist ein **neues** Gewerk, kein Umbau von `graft.js`. `tools/graftnext.js` wandert als Treiber nach innen. |
| `src/contracts.js`, `cdump.js`, `csolve.js` | **BLEIBT** | 17,65 / 12,00 / 12,25 bestaetigt. Das „passt nicht" loest die Registry (starten, wenn Platz ist), nicht der Editor. Die Haelften bekommen endlich Eintraege und hoeren auf, „ungenutzt" zu sein. |
| `src/darkweb.js` | **BLEIBT** | 2,65 gemessen — §1.3 („27,65") lag um exakt ein DOM-Literal daneben. Der `globalThis["docu"+"ment"]`-Trick **wirkt**. Nur die Doku wird korrigiert. |
| `src/hashes.js`, `src/hacknet.js` | **BLEIBT** | 5,95 / 9,45 bestaetigt. „Nie in BN9 gelaufen" ist eine **fehlende** Messung, keine. Registry-Eintraege mit `requiresSF: {"9": 1}`; Ebene 2/3 prueft sie. Nur ein roter Test erzwingt eine Aenderung. |
| `src/bn4life.js`, `homegrow.js`, `bn4door.js`, `bbtrain.js` | **BLEIBT** (+ Figurwaechter bei bbtrain/bn4life) | 293,85 / 148,50 / 99,85 / 94,75 bestaetigt. Der Faktor 16 ist real, aber keine Messung sagt, dass sie sich falsch verhalten. Sie werden **verwaltet** (Wirtregel, `minHostRamGb`), nicht umgebaut. |
| `src/worker/{hack,grow,weaken,share}.js` | **BLEIBT, unberuehrt** | 1,75 / 1,80 / 1,80 / 4,00 bestaetigt. |
| `src/kampfaugs.js` | **BLEIBT** (+ Figurwaechter) | 387,85 gemessen. Nicht in §1.5, also kein ARCHIV ohne Messung. Ohne Registry-Eintrag startet es nicht — das reicht als Riegel. |
| `src/joinrun.js` | **ARCHIV** | §1.5 nennt `join*.js` namentlich als tot. C.14 bestaetigt unabhaengig, dass sein Gym der zweite Teilnehmer am Ping-Pong ist. |
| §1.5-Liste gesamt | **ARCHIV, vor Stufe A** | `exploit3.js` enthaelt `bitburnerSave`, sechs tote Dateien enthalten `while (true)`; der Verbotsgrep aus §6.1 ist rot, solange sie liegen (§1.5 sagt das selbst). Eigener Commit, danach `deleteFile` im Spiel. |
| `tools/checkin.js` | **AENDERN** | Messung vom 04.09.: lineare Hochrechnung ergibt **430 Tage**, die Rangkurve von Lauf 1 (`tools/lib/rangkurve.js`) ergibt **28–50 h** Spielzeit. Faktor ~200. Traeger ist die Aktionsstufe ueber `rewardFac^(level-1)`, **nicht** der Spielerrang. Die letzte Zeile jedes Berichts ist Erics ausdrueckliche Forderung (§2.1) — eine um Faktor 200 falsche Zahl dort ist der teuerste Einzelfehler im Werkzeugkasten. |
| `sync/bridge.js` + Handschlag, `tools/backup*.js`, `klon.js`, `test-*.js`, `rangkurve.js`, `pruefstand/*` | **BLEIBT** | Abgenommen (Gate 0, Gate A2). |
| `tools/task.js` | **UNBERUEHRT** | Auftragsverbot. |

**Neu zu bauen** (nichts davon ist Portierung): `registry.json`, `src/lib/reg.js`
(reiner Leser, **0 GB**, weil er kein `ns` beruehrt — in Ebene 0 nachweisbar),
`src/guard.js`, `src/cloud.js`, `src/figure.js`, `src/figure-cold.js`,
`src/punish.js`, Motorzeit im Kern, `kpi.json`/`events.json`/`penalties.json`/
`sofort.json`, Kaltstart-Gewerk, Grafting-Automatik, `boerse.js`, BN9-Gewerk,
BN15-Tor.

---

# 6 BAUREIHENFOLGE

Begruendet aus dem Ertrag: erst was wenig kostet und viel entriegelt, dann was
den naechsten Kaltstart ueberlebbar macht, zuletzt was Routeneintraege
freischaltet. Jede Position nennt, ob sie **einzeln live einspielbar** und
**einzeln abnehmbar** ist (§9 verlangt Einzeleinspielung mit Wirkungsbeleg).

| # | Position | Ertrag | Einzeln live? | Einzeln abnehmbar? |
|---|---|---|---|---|
| **0** | `wakelock.js` `connect`-Fix | **−32,00 GB**, zwei Zeichen. Entriegelt Kaltstart-Rang 3, der heute reisst. | **Ja**, eine Datei. | Ja: `calculateRam` = 2,25 ueber die Bruecke; Tonanker haelt (`sonde.json` unveraendert). |
| **1** | `registry.json` + `src/lib/reg.js` (Leser, 0 GB) | Der Plan wird lesbar, bevor irgendwer ihn befolgt. | **Ja** — beide sind inert, solange kein Leser laeuft. | Ja, **Ebene 0**: der Leser reproduziert fuer BN10/V2 exakt die heutige `WERKZEUGE`-Liste (`bn4net.js:257-347`) **und** die `TELEMETRIE`-Tabelle (`:61-67`). Das ist der Migrationsbeweis. |
| **2** | Kern liest Registry statt der zwei Arrays | Ein Ort fuer „was und wo". | **Ja**, `bn4net.js` einzeln (ENTSCHIEDEN: jede Aenderung einzeln committen). | Ja: 12 h live, gestartete Eintraege identisch zur Vorwoche, `false_kill_count` = 0. |
| **3** | Motorzeit + Herzschlag v2 (`errStreak`, `lastError`, `okRound`, `motorTimeMs`, `state`) | Ohne diese Felder kann der Waechter nichts entscheiden; mit ihnen sind die Gegenproben moeglich. | **Ja**, je Schreiber eine Datei. | Ja, **Ebene 0**: 8 h gedrosselt = 8 h Motorzeit; 8 h Rechner aus = 0; Nachholklumpen = 0. |
| **4** | `guard.js` im **Beobachtungsmodus** (`modus: "observe"`) | **Die wichtigste Position.** Alle Signale, alle Uebergaenge, `penalties.json` mit `result: "would-execute"` — **keine Ausfuehrung**. | **Ja**. | Ja: eine Nacht verdeckter Tab, `false_penalty_count` = 0 **bevor** die Leiter scharf wird. Ohne diesen Schritt ist die erste scharfe Nacht der Test. |
| **5** | Sprossen 0–2 scharf | Werkzeug-Haenger heilen sich. | Ja, Flag je Sprosse. | Ja: je Sprosse ein provozierter Haenger in Ebene 3, `blockedHosts` greift. |
| **6** | Sprosse 3 scharf | Kern-Haenger heilen sich. | Ja. | Ja: Kern-Motorzeit eingefroren, Engine tickt → eskaliert in ihrer Karenz (Pflichttest §5.2). |
| **7** | Figur-Vergabepunkt: `figure-cold.js`, `figure.js`, Waechter in 6 Dateien, Verbotsgrep-Regel | Beendet das Ping-Pong (C.14) und schuetzt laufende Grafts ($14,63 Mrd Einzelrisiko). | **Nein, gebuendelt**: der Vergabepunkt und die Waechter muessen zusammen live, sonst gewinnt ein ungebaendigtes Skript. Aber je Datei einzeln eingespielt, Vergabepunkt zuletzt. | Ja: `figure_conflict` = 0 ueber 12 h; `t_rebuild_h` nach dem naechsten Einbau innerhalb 30 % von 3,1 h. |
| **8** | Kaltstart-Kern (`cloud.js` ausloesen, `hackAnalyze` inline, Kaltstart-Leiter mit echtem Preis) | Der naechste Sprung ist BN10 L2→L3 auf 32 GB mit SF4.1 — **der haerteste der Restroute** (§1.2). Ohne diese Position steht die Rangfolge bei Rang 3. | **Ja**, aber nur zusammen mit 0. | **Nur Ebene 3**: echter Kaltstart auf 32 GB, SF4.1, `t_workbench` gegen den Knotenpreis. „Im Zielzustand testen" (20.08., fuenf Stunden Stillstand). |
| **9** | Sprosse 4a (nach Pruefstandsbeleg) und 5 (`punish.js`) | Die letzten zwei Sprossen. | Ja. | 4a: `save`-Prop und ausbleibender `beforeunload`-Dialog in Ebene 3 belegt — **sonst wird 4a nicht gebaut** (§5.3). 5: nur mit allen acht Vorbedingungen, Trockenlauf im Klon. |
| **10** | `ausgang.js`-Handschlag, `exit.js`-Zielvalidierung, `checkin.js`-ETA | Macht den beobachteten Sprung (Abnahmestufe C) ueberhaupt bewertbar. | Ja, je Datei. | Ja: `jump_latency_min ≤ 2` abzueglich `backup_wait_min`; ETA gegen die Rangkurve statt linear. |
| **11** | Grafting-Automatik | Groesster Posten nach der Route: Faktor 10–20 auf den Rangweg. | Ja (neues Gewerk). | Ja: `graft_busy_pct` → 100 %, `graft_aborted` = 0. |
| **12** | BN9-Gewerk live, `boerse.js` (BN8), BN15-Tor | Loescht `skipped_route_entries` = 3. | Ja, je Gewerk. | Nur **Ebene 3** mit gesetztem Knoten (Dev-Menue im Klon). |

**Warum 0 vor 1.** Meine These sagt „Registry zuerst". Der Ertrag sagt fuer
**diese eine** Position etwas anderes: 32 GB fuer zwei Zeichen, und ohne sie ist
jede Kaltstart-Planung Theorie, weil die Rangfolge auf Rang 3 abbricht. Eine
These, die einer gemessenen Zahl im Weg steht, weicht.

**Warum 4 vor 5.** Ein Waechter, der zuerst beobachtet, kostet eine Nacht. Ein
Waechter, der zuerst zuschlaegt, kostet im schlechtesten Fall einen Lauf — §3.2
verlangt `false_penalty_count` = 0, und diese Zahl ist nur vor dem Scharfstellen
guenstig zu bekommen.

---

# 7 TESTBARKEIT

## Ebene 0 — ohne Spiel, reines `node`

- **Registry-Leser**: Gate-Funktion (Knoten, Verfahren, Phase, SF,
  `precondition`), Rollen-Riegel aus §1.3 (`verfahren.txt` nennt einen anderen
  Knoten → nur `verfahren: "alle"`), `state`-Ableitung (§1.4).
- **RAM-Formel**: gegen `doku/ram-messung-2026-09-04.json`. **114 Zeilen x 3
  SF-Stufen = 342 Vergleiche**, heute schon 342/342 exakt. Das ist eine echte
  Regression, keine Attrappe.
- **Motorzeit**: die drei Gegenproben aus §3.1 an einer synthetischen
  `(wall, totalPlaytime)`-Reihe.
- **Waechter-Automat** als reine Funktion `step(state, signals) → {state,
  orders}`: gedrosselte Nacht, Nachholklumpen, totes Werkzeug, werfender Kern
  (`errStreak` 5), Routenende, `EXHAUSTED`, `NOT_EXECUTABLE` 12 h,
  `blockedHosts`-Ablauf, alle Deckel.
- **Uhrenzuordnung als Lint**: jede Frist heisst `waitWatchdogMs` /
  `waitEngineMs` / `waitMotorMs` (§5.2 verlangt es woertlich) — ein `grep` prueft,
  dass keine `waitMotorMs`-Frist in Sprosse 0–3 vorkommt.
- **Figur**: Rangfolge, Lease-Ablauf, `seq`-Monotonie, `nodeReset`-Stempel.
- **Verbotsgrep** einschliesslich der neuen Figur-Regel (§4.3) und der
  Zahlenliteral-Regel neben `moneyMax`/`minDifficulty` (§4.1).
- **Routenende**: die beiden `route.json`-Varianten aus §4.1 (alle Resteintraege
  mit fehlendem `braucht`; alle Eintraege erledigt).
- **`src/lib/reg.js` kostet 0 GB**: mit dem geeichten Rechner nachweisen, dass
  ein Importeur durch den Import nicht teurer wird — die `lib/calc.js`-Lehre
  (`bn4net.js:3228-3234`) als Test statt als Kommentar.

## Ebene 2 — `ns`-Mock

Was Ebene 0 nicht kann: die **Reihenfolge** der `ns`-Aufrufe innerhalb einer
Runde.

- `round(ns, state)` von Kern und Waechter gegen einen Mock, dessen `ps`,
  `read`, `getServerMaxRam`, `getScriptRam`, `exec` skriptbar sind.
- **Sprossenausfuehrung**: der Mock protokolliert `scriptKill`/`scp`/`exec`. Der
  entscheidende Test ist das 02.09.-Muster: ein Wirt, auf dem `exec` immer 0
  liefert, darf **nicht** 17-mal gewaehlt werden.
- **Kill-in-derselben-Runde**: `scriptKill` gefolgt von `exec` im selben
  Durchlauf (`bn4net.js:2713-2736`) — hier entstehen die Doppelinstanzen.
- **Budgettest**: `home` = 32 GB, gemessene RAM-Werte, SF4.1 → entspricht die
  Startreihenfolge der §4.4-Rangfolge, und beendet `evictRank` das Richtige?
- **Telemetrie-Gueltigkeit**: ein Block ohne `errStreak` wird abgelehnt; einer
  mit `okRound` konstant und `round` steigend gilt nicht als gesund.
- **`registry-state.json`-Migration**: umbenanntes Feld → Wanderung beim Laden
  (CLAUDE.md, NEONBREAK-Fall).

## Ebene 3 — lokale Instanz (`pruefstand/serve.js`, Klon, nie die Live-Datei)

Nur hier moeglich, weil ein echter Browser und ein echter Spielstand noetig sind:

- **Sprosse 4a, ganz**: Existenz des `save`-Props (`GameRoot.tsx:536-541`), ob
  „Game Saved!" erscheint, und **ob nach `onbeforeunload = null` wirklich kein
  Dialog stehen bleibt**. §5.3 macht den Bau von 4a von genau diesem Beleg
  abhaengig.
- **Popup-Attrappe** mit allen vier geschuetzten Texten (§5.3 verlangt Ebene 3).
- **Echter Kaltstart** auf 32 GB / 1 Kern / 1.000 $ mit SF4.1: die Rangfolge,
  `t_workbench`, ob die Diaeten reichen. Das ist der einzige Test, der §9
  beantwortet, und er ist nicht ersetzbar — „im Zielzustand testen" ist die Lehre
  vom 20.08. (Parameter fuer 274 TB, Reset auf 116 GB, fuenf Stunden Stillstand).
- **Drosselung echt**: verdeckter Tab, 1 Runde/min — S4, die Eigenzeit-Deckel,
  und ob Sprosse 1 innerhalb ihrer Karenz feuert (Pflichttest §5.2).
- **Worker-Timer-Patch**: Wirkung ist unbelegt (§3.3) und bleibt bis dahin
  Beobachtungsgroesse.
- **BN9 / BN8 / BN15**: Knoten per Dev-Menue setzen. `hashes.js`, `hacknet.js`,
  `boerse.js` sind hier zum ersten Mal ueberhaupt in ihrem Knoten.
- **Stanek-Frage (BN13)**: eine Stunde im Klon mit gesetztem SF7.3 — gehoert in
  Phase D, nicht in die Zukunft.

---

# 8 RISIKEN

**R1 — Die Registry wird eine zweite Wahrheit und driftet.**
*Das geht schief, wenn ein Skript geaendert wird und niemand die RAM-Zahl in
`registry.json` nachzieht.* Dann plant der Kern mit einer Zahl, die das Spiel
nicht kennt: der Budgettest ist gruen, der `exec` scheitert an „not enough RAM",
und `exec` = 0 ist nach §5.1 ausdruecklich **kein Haenger**. Der Bot startet
etwas nie und niemand erfaehrt es. `doku/ram-budget.md` sagt es in seiner eigenen
Verifikationsfrage 2: die Zahl gilt nur fuer den Dateistand vom 04.09.
*Gegenmittel:* `ns.getScriptRam` (0,1 GB, im Kernbudget) ist die Wahrheit, die
Registry nur der Planwert; Abweichung > 0,05 GB → `state: "degraded"`, Ereignis,
einmal `## Sofort`, weiterlaufen mit dem Spielwert. Plus die 342-Zeilen-Regression
in Ebene 0. **Das Restrisiko bleibt**: fuer ein neu gebautes Skript gibt es keine
Vergleichszahl, bis es einmal lief.

**R2 — Der Waechter wird das, was haengt.**
*Das geht schief, wenn `guard.js` selbst stehen bleibt* — dann meldet niemand,
dass niemand meldet, und von aussen sieht alles gesund aus, weil der Kern
weiterlaeuft und Telemetrie schreibt. Genau dieser Zustand ist heute der
Normalfall, nur ohne Waechter. Zweite Haelfte desselben Risikos: der Waechter
killt den Kern und der Kern kommt nicht wieder.
*Gegenmittel:* gegenseitige Bewachung (Kern bewacht `guard.js` ueber die
Registry, `killSafe: false`, `restartPolicy: "always"`; Waechter bewacht Kern);
`boot.js`-Schonliste, damit die Fuenf-Minuten-Raeumung ihn nicht wegraeumt;
Sprosse 3 startet **`boot.js`**, nicht den Kern — nur `boot.js` weiss, wie `home`
freigeraeumt wird; und ein Urteil **von aussen**: die Bruecke schreibt nach
`## Sofort`, wenn `data/watchdog.json` aelter als 15 min ist, waehrend
`data/bn4net.json` frisch ist. Diesen Fall kann nur die Bruecke sehen, weil im
Spiel dann niemand mehr hinsieht.

**R3 — Der Figur-Vergabepunkt ist eine Empfehlung, und ein Skript haelt sich
nicht daran.**
*Das geht schief, wenn nach dem Umbau irgendwo ein `startWork`-Aufruf ohne
Besitzpruefung stehen bleibt.* Dann toetet er ein laufendes Graft **ohne
Erstattung** (`GraftingWork.tsx:75-83`; SPTN-97 = $14,63 Mrd), und der Schaden
ist an keiner laufenden Kennzahl sofort sichtbar — `graft_aborted` zaehlt erst
hinterher. Sieben Dateien mit vierzehn Fundstellen sind sieben Gelegenheiten,
eine zu vergessen.
*Gegenmittel:* die Durchsetzung ist **nicht die Datei**, sondern der
Verbotsgrep, der auf dem Worktree laeuft, **bevor** eine Datei live geht (§4.3
Schicht 2) — der kann nicht vergessen werden. Dazu die Laufzeiterkennung
(vergebene gegen tatsaechliche Handlung) und `joinrun.js` im Archiv, was einen
der sieben ersatzlos streicht. *Restrisiko:* der Grep kennt nur die Namen, die
er kennt; ein neuer figurberuehrender API-Aufruf in einer kuenftigen
Spielversion faellt durch. Deshalb steht die Namensliste in **einer** Datei
neben der Registry, nicht im Grep-Aufruf.

*(Vierter, kleinerer Punkt, der Erwaehnung verdient: die Leiter bestraft einen
fertigen Bot. Wenn `planeRoute` keinen offenen Eintrag mehr liefert, ist Δ Traeger
dauerhaft 0 und S2 laeuft bis Sprosse 5 — ein Augmentierungs-Einbau als Antwort
auf einen Erfolg. §4.1 loest es mit `route_state`, und der Waechter stellt S2
still. Das gehoert in Ebene 0 getestet, nicht in den Betrieb.)*

---

# 9 ANTWORT AUF DEN OFFENEN PUNKT A.4

**Die Frage.** §4.4 nennt in einem Absatz zwei Schwellen: „Resident sind nur
Kern und Waechter (**≤ 20 GB**)" und, zwei Saetze spaeter, das Ebene-1-Tor
„resident ≤ 26, mit `boot.js` ≤ 28". Der heutige Stand reisst die 20 um
**5,75 GB** (17,75 + 8,00 = 25,75).

**Die Antwort: beide Zahlen bleiben stehen. Die 20 wird nicht korrigiert,
sondern erfuellt.** Sie sind nicht dieselbe Schwelle: die 20 ist das
Entwurfsziel fuer den Kaltstart, die 26/28 sind das Abnahmetor der Ebene 1, das
auch in dem Moment halten muss, in dem `boot.js` noch resident ist. Ein
Entwurfsziel, das man beim ersten Widerstand hochsetzt, ist keines.

**Die Rechnung** (alle Zahlen gemessen, §0):

    Kern heute                                17,75
      - cloud.* (7 Funktionen)               - 4,00   -> nach src/cloud.js (7,60, Normalbetrieb)
      - hackAnalyze-Familie (3 Fn)           - 3,00   -> im Kaltstart-Modus inline
    Kern nach Diaet                           10,75

    Waechter, gemessener Funktionssatz         7,30   (Soll <= 8, SF4-invariant)
    ------------------------------------------------
    RESIDENT (Kern + Waechter)                18,05   Soll <= 20   HAELT, 1,95 GB Luft

    + boot.js (bis zum Kernstart)              5,50
    ------------------------------------------------
    Ebene-1-Summe                             23,55   Soll <= 28   HAELT, 4,45 GB Luft
    RESIDENT gegen das zweite Tor             18,05   Soll <= 26   HAELT, 7,95 GB Luft

**Drei Folgeentscheidungen, die dazugehoeren:**

1. **Die Zeile `boot.js <= 4,0` in §4.4 wird gestrichen.** `boot.js` misst
   **5,50**, nicht 4,0 (§1.3 „4,0 geeicht" ist ueberholt). Mit dem 10,75-Kern ist
   die Forderung **entbehrlich**: 23,55 liegt 4,45 GB unter dem Tor. 1,5 GB aus
   dem einzigen Skript zu schneiden, das seinen Rueckruf live bewiesen hat
   (01.09.), kauft nichts und riskiert das Fundament. **Die Kern-Diaet ist
   dagegen nicht entbehrlich** — ohne sie steht die Ebene-1-Summe bei 30,55.
2. **Der Waechter-Zielwert 8 bleibt; die Zwischenzahlen in §4.4 sind falsch.**
   Dort steht „gerechnet 5,6 GB fuer Sprosse 1+3, 7,6 GB mit Sprosse 2". Gemessen
   sind es **7,30** fuer den vollen Satz (Sprossen 0–4a) und **2,30** fuer den
   Fuehler. Der geteilte Waechter aus §4.4 wird **nicht gebraucht** und sollte
   nicht gebaut werden: er verliert Sprosse 3 ersatzlos, weil der Kern sich nicht
   selbst neu starten kann.
3. **Der Wakelock-Worker ist Startrang 3, aber nicht resident.** Repariert misst
   er **2,25 GB** (heute 34,25; 32,00 davon sind die Namensgleichheit mit
   `singularity.connect`). Resident-plus-Wakelock waere **20,30** — 0,30 GB ueber
   der 20. Statt die Schwelle um 0,30 zu verschieben, bleibt „resident" woertlich
   das, was §4.4 sagt: **Kern und Waechter.** Wakelock bekommt `priority: 3` und
   `evictRank: 1` — es startet frueh und ist das Erste, was weicht. Eine Zahl,
   die einmal nachgibt, gibt wieder nach.

**Was mit den freien 13,95 GB im Kaltstart geht** (32 − 18,05), gemessene Werte,
in Startreihenfolge:

    Wakelock (repariert)      2,25   -> frei 11,70
    dann ENTWEDER
      figure-cold.js          6,60   -> frei  5,10   (V2: haelt die Figur, Kampftor)
      worker/weaken.js        1,80   -> frei  3,30
    ODER
      sleevecrime.js          7,65   -> frei  4,05   (Geldquelle fuer die Werkbank)
      worker/weaken.js        1,80   -> frei  2,25

**Beides zusammen passt nicht** (6,60 + 7,65 = 14,25 > 11,70). Das ist ein
echter Befund und kein Rundungsproblem: **im V2-Kaltstart konkurrieren der
Figurentreiber und die Sleeve-Geldquelle um denselben Platz.** Genau dafuer ist
die Registry da — `priority`, `evictRank` und `budgetGb` machen daraus eine
Planung, die der Kern jede Runde neu trifft, statt eines `if` in einer Datei.
Zum Vergleich der Ausgangslage: **ohne** die beiden Diaeten steht die Rangfolge
nach Rang 2 bei **−28,0 GB** und der Tonanker ist nicht startbar
(`doku/ram-budget.md` §3.1). Das ist der gemessene Abstand zwischen „geplant" und
„gehofft".

**Offen und ausdruecklich nicht verschwiegen:** die 10,75 GB des Kerns sind eine
**Rechnung**, keine Messung — die Datei nach der Ausloesung gibt es noch nicht.
Sie ist mit demselben Rechner gerechnet, der 342 von 342 Werten trifft, und die
Herleitung steht postenweise in `doku/ram-budget.md` §3.3(b). Der Wert wird
**vor Phase C** an der gebauten Datei gemessen; verfehlt er 12,0, ist das ein
Befund und keine Nachverhandlung der Schwelle.
