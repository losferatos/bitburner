# Bau-Protokoll — Der perfekte Bot, September 2026

Jede Phase endet hier mit Systemzeit, Belegen und offenen Punkten.
Auftrag: `nodes/AUFTRAG-BAU-2026-09.md` (354 Zeilen, verbindlich).

---

## Phase 0 — Boden legen

**Beginn:** Fr 04.09.2026 01:04:23 (Systemzeit, `date`)
**Modell:** Fable 5.1, Modus ultracode
**HEAD bei Beginn:** `355d06c113f18b6e45408993932f5386e8c23ef4`
— „[skeptiker] Auftragstext fuer den Bau des neuen Bots: 14 Abschnitte, 110 Befunde eingearbeitet"
**`git status`:** sauber (keine unversionierten Änderungen in `src/`)
**Zweige:** `master`, `remotes/origin/master` — kein `bau-2026-09` (bestätigt Auftrag 4, `-b` ist Pflicht)

### Budget-Stand

`/usage` ist in dieser Sitzung (Claude-Desktop-App, Code-Tab) **nicht als Werkzeug
abrufbar** — es ist ein Terminal-Dialog-Befehl. Nach Auftrag 13 wird das einmal als
Befund vermerkt (→ `BEFUNDE.md` B.1) und ersatzweise am Fortschritt geplant:
Stufe A ist vor **So 06.09.2026 13:00** zu terminieren.

**Wochentag gegengeprüft** (Auftrag 13 verlangt das): `date -d 2026-09-06 +%A` → **Sunday**.
Der 03.09.2026 war ein Donnerstag, der 04.09. ist Freitag. Die Terminplanung des
Auftrags ist damit bestätigt.

### Zustand der Brücke bei Beginn

- **Sie lebt.** PID 12472, gestartet 03.09.2026 15:28:32, Kommandozeile
  `node sync/bridge.js` (ohne Flags — also mit `pushAll` und `watchScripts` aktiv).
- `connected: true` seit `2026-09-03T13:28:35.822Z` (= 15:28:35 Ortszeit).
- Der Sonderweg aus Auftrag Phase 0 („ist die Brücke tot, wird sie schreibfrei
  gestartet") **entfällt damit**. Stattdessen gilt: solange keine Datei in `src/`
  angefasst wird, schiebt sie nichts. In Phase 0 wurde keine `src/`-Datei angefasst.

### Nullpunkt (gemessen 04.09.2026 01:08:00 per `getSaveFile`, lesend)

| Größe | Wert | Auftrag 1.2 (03.09. 23:58) | Abweichung |
|---|---|---|---|
| identifier | `197f4d61481686` | gleich | — |
| BitNode / Lauf | 10 / 2 | gleich | — |
| SourceFiles | {1:1, 4:1, 5:1, 6:1, 10:1} | gleich | — |
| Hacking | 339 → 340 | 336 | +3 |
| Konto | 10,33 Bio $ | 10,46 Bio | −0,13 |
| `totalPlaytime` | 366,55 h | 365,4 h | +1,15 h |
| im Knoten | 57,15 h | 56,0 h | +1,15 h |
| seit letztem Aug-Einbau | 9,77 h | — | **neu** |
| Augs installiert | 15 | 15 | — |
| **Augs wartend** | **2** | **1** | **+1** ⚠ |
| Sleeves | 2 | 2 | — |
| `BladeburnerRank` | **639,1** | 596 | +43 |
| `numBlackOpsComplete` | 0 | — | neu |
| Roh-Gzip | 659.560 B | 655.870 B | +3.690 |
| `getSaveFile`-Dauer | 251 ms | 410 ms | — |

Settings (alle vier Vorbedingungen der Sprosse 4a **erfüllt**):
`AutosaveInterval 60`, `ExcludeRunningScriptsFromSave false`,
`RemoteFileApiPort 12525`, `AutoexecScript "boot.js"`,
`RemoteFileApiReconnectionDelay 5`, `SuppressFactionInvites false`.

Die zwei wartenden Augmentierungen heißen **Augmented Targeting II** und
**CashRoot Starter Kit**. Sie verfallen beim Knotenwechsel ersatzlos
(`queued_augs_at_jump` soll 0 sein) — siehe Befund L.12.

### Motorzustand (aus `data/bn4net.json` auf home, Runde 3555)

- Werkbank `werk-0`, Netz 85 gerootet von 85, home 131.072 GB / 2.076 GB frei
- Beitrittstor V2 **erreicht**: Kampfwerte str 100 / def 100 / dex 109 / agi 107,
  Faktion `Bladeburners` ist beigetreten
- `vertraege: 0` — kein Vertragsbestand, der eine Kaltstartrechnung verfälschen würde
- `brachAnteil: 0,8127`

### Gate 0 — Belege

| Punkt | Zustand | Beleg |
|---|---|---|
| Backup grün | ✅ | `LIVE_197f4d61481686_BN10L2_2026-09-04T01-13_manual.json.gz`, 660.057 B, Exit 0 |
| Brücke verbunden | ✅ | `/api/state` `connected:true`, PID 12472 |
| Befundliste existiert | ✅ | `nodes/BAU-2026-09/BEFUNDE.md` |
| `doku/spielstand-schutz.md` | ✅ | siehe dort |
| RAM `exit.js` gegen Park | ✅ | siehe unten |

### RAM-Messung `exit.js` gegen den Park (Gate 0, Pflichtmessung)

`exit.js` = **519,25 GB** — per `calculateRam` im **Live**-Spiel gemessen
(04.09.2026 01:15), nicht gerechnet. Der Auftrag führte den Wert als „nur gerechnet";
er ist damit bestätigt.

Freier RAM je Wirt, gerechnet aus `runningScripts` (`ramUsage × threads`) des
Spielstands vom 01:13 — `ramUsed` selbst wird **nicht serialisiert** (Befund L.2):

| Wirt | max GB | belegt GB | frei GB |
|---|---|---|---|
| werk-9 | 524.288 | 670 | 523.618 |
| werk-10 | 524.288 | 693 | 523.595 |
| werk-5 | 524.288 | 708 | 523.580 |
| home | 131.072 | 128.996 | 2.076 |

**Wirte mit ≥ 545,21 GB frei (519,25 + 5 %): 16 von 86.**
Netz frei 6,65 Mio GB von 8,00 Mio GB.

**Urteil: `wirtFehlt` kann heute nicht auftreten.** Die Handlungskette „Ausbauzweig
sofort live umbauen", die auf dem falschen Inventar beruhte, entfällt bestätigt.
Der Ausbauzweig gehört nach Phase C.

---

### Offene Punkte am Ende von Phase 0

Siehe `BEFUNDE.md`. Kein Punkt blockiert den Übergang nach Phase A2.

---

## Phase A2 — Prüfstand (Pflicht-Gate vor dem ersten Modul)

**Abgeschlossen:** Fr 04.09.2026 02:30

| Bauteil | Zustand | Beleg |
|---|---|---|
| v3.0.1 production | gebaut | `reference/v301`, webpack 278 s, Titel im Browser: `Bitburner v3.0.1 (3162fd2)` |
| v3.0.1 development | gebaut | `reference/v301-dev`, mit Dev-Menü für die Fixtures |
| `serve.js` parametriert | ja | 8799 prod / 8798 dev, Brücken-Ports gesperrt (Exit 3 auf 8795) |
| Zweite Brücke | läuft | `--instance TEST --rfa-port 12526 --dash-port 8796 --data-dir pruefstand/data` |
| Klon mit gepatchtem Port | ja | `tools/klon.js`, Prüfung eingebaut, Klon wird bei roter Prüfung gelöscht |
| CDP-Client | neu | `pruefstand/cdp.js`, drei Riegel, Selbsttest 5 von 5 |
| Prüfstand-Browser | läuft | Chrome 152, Debug-Port 9333, Profil unter `pruefstand/browser`, 4 Kerne |

### Der Wachhund-Beweis

Ein Klon des Live-Spielstands (Port auf 12526 gepatcht) wurde über den CDP-Client
in die IndexedDB von `localhost:8799` geschrieben und die Seite neu geladen.

| Prüfung | Erwartet | Gemessen |
|---|---|---|
| Testinstanz verbindet auf | 12526 (TEST) | **12526** |
| Zweite Verbindung im LIVE-Log | keine | **keine** |
| Alarm auf der LIVE-Seite | keiner | **`alarm: null`** |
| TEST-Brücke verifiziert | ja | in 193 ms, BN10 L2 |
| Live-Motor läuft weiter | ja | Runde 3987 → 4009 |

**Gate A2 ist damit bestanden.** Ab hier sind Eingriffe in `src/` zulässig,
sofern die Checkliste aus Auftrag 9 vollständig durchlaufen wird.

### Was der Lauf nebenbei bewies

Der Hash-Vergleich vor jedem Schub fing im Echtbetrieb **113 Dateien** ab, die
der Dateibeobachter ohne jede Inhaltsänderung schieben wollte — dazu ein zweites
Mal 115. Das ist derselbe Vorgang, der am 03.09. dreimal ungefiltert ins laufende
Spiel ging. Die Ursache des Watcher-Feuerns bleibt ungeklärt; der Inhaltsvergleich
macht sie gleichgültig.

### Zwei Fehler, die erst dieser Lauf zeigte

1. **Die TEST-Instanz schrieb in Erics Arbeitsliste.** Zwei Meldungen, beide für
   die Kopie sachlich richtig, landeten in `nodes/BAUSTELLEN.md ## Sofort`. Eine
   Liste mit Testlaufmeldungen wird nach dem dritten Mal nicht mehr gelesen —
   damit wäre der einzige Kanal vom Spiel zu Eric unbrauchbar geworden, und zwar
   durch die Bauarbeit, die ihn schützen soll. Behoben: nur die LIVE-Rolle
   erreicht die Liste, TEST schreibt nach `pruefstand/data/sofort-test.md`.
2. **Das Urteil „Autosave steht" feuerte sofort nach dem Laden.** Eine frisch
   geladene Instanz trägt das `lastSave` aus ihrem Spielstand, beim Klon 56
   Minuten alt; das Spiel speichert aber binnen 60 Sekunden von selbst. Behoben:
   die Brücke urteilt erst, wenn die Verbindung zehn Minuten steht. In einer
   Reload-Schleife wäre daraus sonst Dauerfeuer geworden.

---

## Phase B — Architektur mit Judge-Panel

**Abgeschlossen:** Fr 04.09.2026 03:34 · `nodes/BAU-2026-09/ARCHITEKTUR.md`, 1.260 Zeilen

Zwei Architekten unabhängig (Registry-getrieben, Kaltstart-getrieben), zwei
Richter, einer davon adversarial mit Nachprüfpflicht, dann Synthese.

**Elf Entscheidungen, jede mit verworfener Alternative.** Die drei wichtigsten:

- **A.4 entschieden: die 20-GB-Schwelle bleibt, der Kern wird kleiner.**
  Kern 10,75, Wächter 6,10, resident 16,85 mit 3,15 GB Luft. Mit `boot.js`
  steht die Spitze bei 22,35 und damit unter 28.
- **Der Wächter ist bei allem autark, was einen toten Kern betrifft.** Sprossen
  0, 1, 3 und 4a laufen ohne ihn; nur Sprosse 2 geht als Auftrag an den Kern,
  mit Reißleine: führt er sie nicht in drei Minuten aus, geht der Wächter direkt
  auf Sprosse 3.
- **Die Wirtreserve wird vor der Endspurt-Regel abgezogen.** Ohne das
  widersprechen sich zwei Auftragsregeln direkt: die Endspurt-Regel gibt bei
  `eta_min < 60` das Geld aus, mit dem der Wirt für `exit.js` bezahlt werden
  muss. Ein Deadlock, den Abschnitt 5.3 ausdrücklich nicht eskaliert.

**Vier Befunde, die kein Entwurf und kein Richter allein hatte:**

1. **Die Covenant-Sache ist kein Bauposten.** Zusätzliche Sleeves sind nur in
   BitNode 10 kaufbar, also nur bis zum nächsten Sprung. Aber das Tor verlangt
   20 Augmentierungen, 75 Mrd Dollar, Hacking 850 und alle vier Kampfwerte auf
   850. Live: 15 Augs, Hacking 345, Kampf 100 bis 112. Jetzt offener Punkt mit
   benannter Messung, nicht Bauposition.
2. `figure-cold.js` bestätigt tot: `prestigeSourceFile` setzt `bladeburner` auf
   null, der Wiedereintritt verlangt wieder vier Werte auf 100.
3. Eine Registry-Bedingung `requiresSF: {"9":1}` hätte `hashes.js` in
   Routenposition 5 ausgesperrt — die Freischaltung prüft Knoten **oder** SF.
4. **`location.reload()` kostet 0 GB.** Der offene Punkt aus Auftrag 1.6 ist
   damit geschlossen, Sprosse 4a bleibt beim Wächter.

**Die Baureihenfolge ist fristgetrieben, nicht ertragsgetrieben.** Die
Wirtreserve steht vor der Registry, weil die nächste Tür in 28 bis 50 Stunden
aufgeht. „Eine These, die einer Frist im Weg steht, weicht."

**Gate B bestanden:** neun offene Punkte, keiner blockiert den Bau.

---

## Phase C — Bau in Gewerken

### C.2 — `wakelock.js`: minus 32 GB · ABGESCHLOSSEN 04.09. 03:41

Der erste Live-Eingriff nach der Checkliste aus Auftrag 9, bewusst am kleinsten
möglichen Fall erprobt.

**Ursache:** Der RAM-Rechner des Spiels läuft über den AST und nimmt bei einer
Objektzugriffs-Ausdrucksform den Eigenschaftsnamen. Er unterscheidet damit nicht
zwischen der Netscript-Funktion `connect` und dem Web-Audio-Aufruf gleichen
Namens — und `connect` ist eine Singularity-Funktion, also 2 GB mal Faktor 16.
Die Datei kostete 34,25 GB für 32 GB, die mit dem Spiel nichts zu tun haben.

Vor dem Schreiben des erklärenden Kommentars wurde geprüft, dass der Rechner
einen AST liest und keinen Text. Sonst hätte der Kommentar, der das Wort
zwangsläufig enthält, dieselben 32 GB gekostet.

**Die Checkliste, wie sie lief:**

| Schritt | Ergebnis |
|---|---|
| (1) Zeit, `/api/state` | LIVE, verbunden, verifiziert |
| (2) Spielstand | identifier korrekt, BN10 L2, Rang 725 |
| (3) `pre-hotswap` | grün |
| (4) Ausgang / Prozesse | `offen: false`, kein `exit.js`, Datei läuft nicht |
| (5) Kanarienvogel | RAM TEST 2,25 gegen LIVE 34,25; Datei startet über den Auftragskanal; Tonanker bei 19.500 Hz |
| (6) Einspielung | eine Datei |
| (7) Beobachtung | RAM live 2,25, Motor läuft, kein Alarm, keine Strafen, Urteil unverändert |

**Die Brücke hat sich zum ersten Mal im Ernstfall bewährt:** sie sicherte vor
dem Schieben und schob genau eine Datei, nicht 115.

### C.1 — Motorzeit · Teil 1 fertig, Einbau offen

`src/lib/motorzeit.js` im Worktree, 30 Ebene-0-Prüfungen grün. Die drei
Pflichtproben aus Auftrag 3.1 sind erfüllt: acht Stunden gedrosselt zählen als
acht Stunden, acht Stunden Rechner aus zählen null, ein Nachholklumpen zählt
null.

Der Deckel liegt bei zwölf Takten, nicht bei zwei. Mit zwei Takten zählte eine
gedrosselte Stunde nur zwanzig Minuten, und der Nachtbetrieb sähe im Bericht
besser aus als der wache Tag.

Offen: der Einbau in den Motor. Er berührt `bn4net.js` und braucht die volle
Checkliste mit zwanzigminütigem Kanarienvogel.
