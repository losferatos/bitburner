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
