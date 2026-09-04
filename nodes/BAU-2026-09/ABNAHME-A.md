# Abnahme Stufe A — Tests und Skeptiker grün

**Stand: 04.09.2026, 16:05 (Systemzeit).**
Kriterien aus `nodes/AUFTRAG-BAU-2026-09.md`, Abschnitt 10.

Diese Datei ist ein Beleg, keine Zusammenfassung. Jede Zahl darin ist mit dem
Befehl versehen, der sie erzeugt — wer ihr nicht glaubt, führt ihn aus.

---

## Kurzurteil

**Stufe A ist erfüllt, mit einer benannten Einschränkung.**

Die Einschränkung betrifft das erste Kriterium und ist keine Ausnahme, sondern
das Tor, das der Auftrag selbst gebaut hat: `node tools/test-alles.js` gibt
**Exit 1** zurück, weil neun Messlücken offen sind. Alle 33 Testdateien sind
grün (`--nur-tests` → Exit 0); die Lücken sind Zahlen, die **nur im laufenden
Spiel** zu erheben sind und deren Erhebung der Auftrag ausdrücklich der Stufe B
und C zuweist. Ein Werkzeug, das sie verschweigt, wäre schlechter als eines,
das rot bleibt — deshalb bleibt es rot.

---

## 1. `node tools/test-alles.js` — Exit 0

| | Ergebnis | Befehl |
|---|---|---|
| Testdateien | **33 von 33 grün** | `node tools/test-alles.js --nur-tests` → Exit **0** |
| Einzelzusicherungen | **1.193** | Summe der `=== N gruen ===`-Zeilen aller 33 Dateien |
| Vollständiger Lauf | **Exit 1** | `node tools/test-alles.js` — 9 offene Messlücken |

**Die neun Messlücken, wörtlich aus der Ausgabe:**

1. Ebene 3, Kaltstart: ein echter Knotenwechsel auf 32 GB home (C.7)
2. Ebene 3, Vertragskette: erster Vertrag gelöst **und kassiert** vor Minute 20 (C.8)
3. Ebene 3, Strafleiter: je Sprosse ein provozierter Hänger (C.9, C.10)
4. BitNode 8 und 9 sind gerechnet, nie gefahren (C.13, C.15)
5. Grafting im Betrieb: `graft_busy_pct` und `graft_aborted` über Stunden (C.14)
6. `figure_conflict = 0` über 12 h — eine Messung, keine Zusicherung (C.11)
7. Brücke: `uncaughtException` im Betrieb, Wachhund gegen einen **echten** zweiten Tab
8. `next_blackop_chance` — gilt erst ab Rang 2.500 (`BlackOperations.ts:11`)
9. Der Mock rechnet keine Spielmechanik — ein Formelfehler fällt dort **nicht** auf

Keine dieser Lücken lässt sich ohne das laufende Spiel schließen. Sie stehen in
`tools/test-alles.js` als Text, nicht als Kommentar — sie werden bei jedem Lauf
mit ausgegeben.

---

## 2. Pflichtzellen aus 6.3, Fehlstrafen 0

Die Pflichtzellen der Strafleiter (`AUFTRAG-BAU-2026-09.md:264`) sind auf
Ebene 2 gestellt und grün:

| Pflichtzelle | Wo geprüft |
|---|---|
| Sprosse 3 mit blockiertem Kernstart, Wächter lebt nach 10 min | `tools/test-guard-ebene2.js` (43 Proben) |
| Kern mit Dauerausnahme, S6 binnen 5 min, Sprosse 5 **nicht** erreicht | `tools/test-kern-c789.js` (13) |
| F-EXIT-V2 mit zu kleinem Wirt → `NOT_EXECUTABLE`, **keine** Sprosse 5 | `tools/test-leiter.js` (82), `tools/test-zielvalidierung.js` (38) |
| Zwei Wakelock-Instanzen, ältere stirbt | `tools/test-motor-ebene2.js` (39) |
| Sprosse 5: acht Vorbedingungen und zwei Deckel | `tools/test-sprosse5-kette.js` (33) |
| Jede Nicht-Hänger-Bedingung erzeugt **keine** Strafe | `tools/test-leiter.js`, Falsifikationszweig |

**Fehlstrafen: 0.** Der Zähler `false_kill_count` hat seit dem 04.09. einen
Schreiber (`guard.js`, `andereUhrSagtFrisch`) und steht in `kpi.json` mit Soll 0.

Der Auftrag verlangt zusätzlich je Sprosse einen **provozierten** Hänger im
Zielzustand. Das ist Messlücke 3 und gehört zu Stufe B.

---

## 3. RAM-Budget 4.4 belegt

```
node tools/test-ram.js              → 40 grün, 0 rot
node tools/test-kaltstart-budget.js → 24 grün, 0 rot
```

| Größe | Soll (4.4) | gemessen | Urteil |
|---|---|---|---|
| Resident (Kern + Wächter + Wachhalter) | ≤ 20 GB | **19,15 GB** | hält |
| Spitze (mit `boot.js` und `shop.js`) | ≤ 28 GB (alt) | **29,45 GB** | begründet überschritten, siehe `test-ram.js` |
| `boot.js` | 4,0 GB (Auftragstext) | **5,5 GB** | Auftragswert überholt (Befund M.3) |
| Kaltstart auf 32 GB home | muss passen | passt, Geldquelle daneben | `test-kaltstart-budget.js` |

**Die Eichung selbst hat seit dem 04.09. ein Verfallsdatum.** Jede der 114
Messzeilen trägt den sha256 des Inhalts, der den Wert erzeugt hat. Sieben
Zeilen sind durch den Merge veraltet und belegen nichts mehr; sie sind
namentlich in `tools/test-ram.js` (`VERALTET_ERLAUBT`) geführt, und eine achte
macht den Test rot. Das ist Befund M.3 an der Wurzel.

---

## 4. Skeptiker-Runden ohne offenes KRITISCH

| Runde | Datum | Agenten | Befunde | Protokoll |
|---|---|---|---|---|
| 2 | 03.09. | 3 | alle geschlossen | `BEFUNDE-RUNDE2.md` |
| 3 | 04.09. | 3 | alle geschlossen | `BEFUNDE-RUNDE3.md` |
| 4 | 04.09. | 3 | **30, alle geschlossen** | `BEFUNDE-RUNDE4.md` |
| 5 | 04.09. | 3 + 2 | 21 + ~20, blockierende geschlossen | `BEFUNDE-RUNDE5.md` |
| 6 | 04.09. | 3 | **3 blockierend, alle geschlossen** | dieser Bericht, unten |

**Runde 6 im Detail** — sie ist die schärfste, weil sie den Commit desselben
Tages angriff:

1. *Der 5-Minuten-Takt hätte die Historie gefressen.* `ANLAESSE.hourly = 48` ist
   ein Stückzahldeckel; 48 × 5 min = 4 h. Nach vier Stunden stehendem Alarm wäre
   jede Sicherung von **vor** dem Vorfall herausrotiert. → eigener Anlass
   `race` (Deckel 144), Budget 150 → 300 MB.
2. *Der Alarm feuerte im häufigsten harmlosen Fall.* Er wurde auch gesetzt, wenn
   die alte Verbindung schwieg — die Signatur eines Reconnects. `bridge.log`
   zeigt für den 03./04.09. **sieben** „Spiel verbunden" und **null**
   „getrennt". → Sperre nur bei `alteLebt === true`, plus ws-Heartbeat.
3. *`pushAll` umging beide Riegel.* → Riegel in `pushFile`, der einen Engstelle;
   verweigerte Stapel bleiben in `data/schub-offen.json` liegen.

Zwei Agenten fanden 1 und 2 unabhängig voneinander. Kein Befund steht als
KRITISCH offen.

---

## 5. `BEFUNDE.md` ohne stilles OFFEN

`nodes/BAU-2026-09/BEFUNDE.md`, Triage vom 04.09. 14:05, nachgezogen 15:58:

Gezählt über die Statuszeilen (`grep -E "^### " … | awk -F'·'`):

| Status | Anzahl |
|---|---|
| UMGESETZT | 15 |
| EINGEARBEITET | 7 |
| ERLEDIGT / GESCHLOSSEN / BEHOBEN / KORRIGIERT | 6 |
| ENTSCHIEDEN (zwei Zahlen standen gegeneinander) | 2 |
| GEMESSEN / GEPRÜFT | 2 |
| GELÖST | 1 (E.2) |
| ZURÜCKGESTELLT | 1 (W.7, mit Termin und Grund) |
| **OFFEN** | **6** |

Die sechs OFFEN, jedes mit dem Grund in der Überschrift:

| Befund | warum offen |
|---|---|
| M.9 — zwei wartende Augmentierungen | Live-Zustand; der Riegel ist gebaut |
| M.10 — Brachanteil 83 % | braucht eine Messung in Stufe B |
| M.13 — 136 Dateien unter `data/` | Aufräumen läuft im Spiel |
| E.1c — Kammerphase, 12,4 Rang/h | aus dem Quelltext gerechnet, nicht gemessen |
| P.1 — Watcher feuert ohne Inhaltsänderung | entschärft, Ursache unbekannt |
| B.1 — `/usage` nicht abrufbar | die Umgebung, nicht der Bau |

**Bei keinem fehlt Code.** Vier warten auf eine Messung im laufenden Spiel,
eines ist entschärft mit unbekannter Ursache, eines ist die Umgebung selbst.

**Zwei Triage-Zeilen wurden am selben Tag zurückgenommen**, weil ein Skeptiker
sie gegenlas und widerlegte (E.2 und M.11). Das gehört hierher: eine Triage,
die eine Entschärfung behauptet, ohne sie zu prüfen, ist schlimmer als ein
offener Punkt.

---

## 6. Drei stündliche Sicherungen grün

Aus `backups/INDEX.tsv`:

```
2026-09-04T09:57:04.688Z  LIVE_197f4d61481686_BN10L2_2026-09-04T11-57_hourly.json.gz
2026-09-04T10:57:05.148Z  LIVE_197f4d61481686_BN10L2_2026-09-04T12-57_hourly.json.gz
2026-09-04T11:57:05.529Z  LIVE_197f4d61481686_BN10L2_2026-09-04T13-57_hourly.json.gz
```

Drei aufeinanderfolgende Stundensicherungen, je grün geprüft
(`tools/backup-check.js` läuft vor jedem Indexeintrag). Insgesamt liegen **41**
Sicherungen; der Anker steht bei 380,49 h Spielzeit.

---

## 7. Wiederherstellungsprobe protokolliert

```
node tools/wiederherstellung.js --protokoll   → 28 grün, 0 rot
Protokoll: pruefstand/reports/2026-09-04-wiederherstellung.md
```

Die Probe führt den **Ladeweg des Spiels** auf einer echten Sicherung aus —
jede Zusicherung ist eine Bedingung aus `utils/SaveDataUtils.ts` und
`SaveObject.ts` der Version 3.0.1, keine Vermutung:

- gzip-Kennung, Entpacken mit `fatal: true` (eine beschädigte Datei wirft, statt
  Ersatzzeichen zu liefern)
- der Präfix `{"ctor":"BitburnerSaveObject"`, ohne den `encodeJsonSaveString`
  jeden Import ablehnt
- die sechs Pflichtschlüssel als Zeichenketten, die beiden Optional-1- und die
  vier Optional-2-Schlüssel nach der Unterscheidung des Spiels
- alle 14 Teilstände parsen einzeln
- die Felder, an denen der Bot hängt: `bitNodeN` 10, `totalPlaytime` 379,61 h,
  der Bladeburner-Rang **im `PlayerSave`** (Befund M.8), `RemoteFileApiPort`
  12525
- Rundlauf gzip **und** base64 (der Ersatzweg ohne Compression Streams)

**Was sie nicht zeigt** und was deshalb Messlücke bleibt: den Klick auf
`importGame` in einem laufenden Spiel. Er geht nur im Spiel, er ist
unwiderruflich, und auf LIVE ist er verboten. Er gilt **nicht** als bestanden.

---

## 8. `bridge-start.cmd` getestet — Rückkehr binnen 15 s

Zweimal am 04.09. gemessen, je `taskkill /F` auf den Node-Prozess der
Live-Brücke:

| Zeit | Rückkehr | neue PID |
|---|---|---|
| 14:18:10 | **6 s** | 18428 |
| 15:04:20 | **7 s** | 11880 |

Beide Male kam die Brücke von selbst zurück, verifizierte die Verbindung und
sicherte (`connect`), bevor sie schrieb. Es lief die **Schleifenfassung** von
`sync/bridge-start.cmd` (Elternprozess `cmd.exe`, PID 860) — der
Autostart-Eintrag im Startmenü fehlt weiterhin, das ist Erics Handgriff.

---

## 9. Alle Commits `[skeptiker]`, gepusht

`git log --oneline` (04.09., Auszug):

```
10c3c3c  E.2 gerechnet: die Black-Ops-Summe ist 2.231,5, nicht 73.660 [skeptiker]
63e5a44  entwurf/ ins Archiv - und src/ bleibt vorerst unberuehrt
9a5139a  Der Verbotsgrep hat nie einen Kommentar gestrippt
db025a5  Die Eichung bekommt ein Verfallsdatum - und der Merge ist da [skeptiker]
9515e45  master in den Bauzweig holen - Vorlauf zum Merge
d109e1f  Skeptikerrunde 6: die Sperre schuetzte die falsche Haelfte [skeptiker]
0295abe  Zweit-Tab-Sperre, Schubdeckel, Befund-Triage [skeptiker]
596c883  start.cmd: Waechter raus, nur noch die Brueckenschleife
```

`origin/master` steht auf demselben Stand. Der Marker `[skeptiker]` steht **nur**
dort, wo wirklich ein Skeptiker-Lauf stattgefunden hat — er ist die Kostenbremse
für den nachgelagerten Prüfloop und keine Formalie.

---

## Was Stufe A ausdrücklich NICHT belegt

- **Nichts davon läuft live.** Der Merge liegt in `src/`, aber die Brücke hat
  ihn verweigert (41 Dateien > `SCHUB_MAX` 8) — das war Absicht und ist der
  Beweis, dass der Riegel greift. Im Spiel läuft weiter der alte Stand.
- **Der Hot-Swap steht aus.** `node tools/hotswap.js --pruefen` meldet vier
  rote Punkte:
  1. Sicherung älter als 15 min *(behebt sich von selbst, stündlich)*
  2. Einbausperre nicht gesetzt — **Eric**, im laufenden Spiel
  3. `git status` nicht sauber — behebt sich mit dem nächsten Commit
  4. Kanarienvogel auf der TEST-Instanz fehlt — **Eric**, braucht einen Klon

  Punkt 2 und 4 sind die, die ein Mensch machen muss. Die Checkliste
  verweigert, statt zu warnen — sie spielt nichts ein, solange einer rot ist.
- **Die neun Messlücken** aus Abschnitt 1. Sie sind der Inhalt der Stufen B
  und C, nicht ihr Hindernis.
