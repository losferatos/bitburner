# Befunde — Bau des perfekten Bots, September 2026

Status je Befund: **OFFEN** / **UMGESETZT** (mit Datum) / **VERWORFEN** (mit Begründung).
Ein OFFEN wird nie durch Schweigen ersetzt.

Kennung: `M.n` eigene Messung dieser Sitzung · `L.n` aus Auftrag 1.4/1.6 ·
`A.n`–`J.n` aus `nodes/AUDIT-AUTONOMIE-2026-09-02.md` · `S.n` aus `BAUSTELLEN.md ## Sofort` ·
`B.n` Bau-Sitzung selbst.

---

## M — Eigene Messungen, Phase 0 (04.09.2026)

### M.1 — `getAllServers` liefert kein `maxRam` · OFFEN
Die RFA-Methode gibt je Server nur `{hostname, hasAdminRights, purchasedByPlayer}` zurück
(gemessen 04.09. 01:15, 86 Einträge). Der Auftrag verlangt in Phase 0 „`exit.js` … gegen
`getAllServers` halten" — **das ist mit dieser Methode nicht möglich**.
Ersatzquelle: `AllServersSave` aus `getSaveFile` oder `data/bn4net.json` des Motors.
**Folge für den Bau:** Die Wirtplanung aus 4.4 darf sich nicht auf `getAllServers` stützen;
im Spiel gilt ohnehin `ns.getServerMaxRam`.

### M.2 — `ramUsed` wird im Spielstand nicht serialisiert · OFFEN
Ein Serverobjekt in `AllServersSave` hat 31 Felder, `ramUsed` ist keines davon
(geprüft an `werk-0`). Das Spiel lässt Default-Werte beim Serialisieren weg — derselbe
Mechanismus, der am 30.08. `playerReputation` verschwinden ließ.
Freier RAM ist aus einer Sicherung **nur rechnerisch** zu ermitteln:
`frei = maxRam − Σ(ramUsage × threads)` über `runningScripts`. So gemessen, siehe PROTOKOLL.
**Falle:** Eine naive Prüfung `s.maxRam - s.ramUsed` ergibt `NaN` und damit „kein Wirt frei" —
ein Ausschluss, den das Werkzeug gar nicht messen konnte. Genau der Fehlertyp aus 2.3.

### M.3 — `boot.js` ist 5,5 GB, nicht 4,0 · OFFEN — **Budgetverletzung**
Gemessen per `calculateRam` im Live-Spiel (SF4.1), 04.09. 01:15: **5,5 GB**.
Der Auftrag führt „`boot.js` 4,0 GB geeicht" (1.3) und setzt in 4.4 das Budget
`boot.js <= 4,0`. Ebene 1 soll rot werden, wenn „Kern + Wächter + `boot.js` > 28 GB".
**Folge:** Entweder wird `boot.js` um 1,5 GB abgespeckt, oder die Grenze in 4.4 wird auf
den gemessenen Wert korrigiert. Nicht beides schweigend stehen lassen.
Zu klären: Ob die 4,0 je stimmten oder ob `boot.js` seither gewachsen ist
(`git log --follow src/boot.js`).

### M.4 — `blade.js` ist 174,35 GB · OFFEN
Der Auftrag nennt drei Werte (162,25 / 94,85 / 27,6) und schreibt ausdrücklich:
„die kolportierte 174 steht nirgends" (1.6). **Sie steht jetzt: gemessen 174,35 GB**
bei SF4.1 im Live-Spiel. Keiner der drei Auftragswerte trifft.
Die 94,85 sind vermutlich der Wert ab SF4.3 (Singularity ×1) — das ist im Klon zu prüfen,
nicht zu unterstellen.

### M.5 — `darkweb.js` ist 2,65 GB, nicht 27,65 · OFFEN
Faktor 10 Abweichung vom Auftragstext (1.3). Da `darkweb.js` über
`globalThis["docu"+"ment"]` arbeitet (0 GB statt 25 GB DOM-Literal), ist der kleine Wert
plausibel — der Auftragswert dürfte aus einer Fassung vor diesem Kniff stammen.
**Folge:** Positiv für das Kaltstart-Budget; TOR und Portknacker sind billiger erreichbar
als geplant.

### M.6 — Weitere RAM-Abweichungen · OFFEN
Alle per `calculateRam` live gemessen 04.09. 01:15, SF4.1:

| Datei | Auftrag | gemessen | Δ |
|---|---|---|---|
| `popups.js` | 1,6 | **3,3** | ×2,1 |
| `sleeve.js` | 14,75 | **27,85** | ×1,9 |
| `sleevecrime.js` | 5,7 | **7,65** | +1,95 |
| `bn4rep.js` | 846,8 | **850,75** | +3,95 |
| `graft.js` | — | 145,45 | neu |
| `sonde.js` | — | 27,25 | neu |
| `bn4net.js` | 16,25/17,75/19,65 | **17,75** | die mittlere trifft |
| `ausgang.js` | 8,15 | 8,15 | ✅ |
| `contracts.js` | 17,65 | 17,65 | ✅ |
| `wakelock.js` | 34,25 | 34,25 | ✅ |
| `bn4life.js` | 293,8 | 293,85 | ✅ |
| `homegrow.js` | 148,5 | 148,5 | ✅ |
| `bn4door.js` | 99,85 | 99,85 | ✅ |
| `bbtrain.js` | 94,75 | 94,75 | ✅ |
| `exit.js` | 519,25 (gerechnet) | **519,25 (gemessen)** | ✅ bestätigt |
| `cdump.js` / `csolve.js` | < 15 | 12 / 12,25 | ✅ |

`popups.js` ist der wichtigste Posten dieser Liste: es ist im Kaltstart-Budget als
billige Wache eingeplant und kostet doppelt so viel wie angenommen.

### M.7 — home hat 131.072 GB, nicht 65.536 · OFFEN
`data/bn4net.json` (Runde 3555) meldet `homeRam: 131072`. Der Auftrag 1.2 nennt
65.536 GB. Der Auftrag hatte bereits korrigiert, dass die früher kolportierten
„1024 GB" um Faktor 64 zu klein waren — die Korrektur selbst ist nun um Faktor 2 zu klein.
**Lehre, nicht Detail:** Ein Inventarwert, der zweimal hintereinander falsch war,
gehört zur Laufzeit gelesen und nirgends notiert (Auftrag 4.1 verlangt das ohnehin).

### M.8 — Bladeburner liegt im `PlayerSave`, nicht in einem eigenen Save-Schlüssel · OFFEN
`save.data` hat 15 Schlüssel (`PlayerSave`, `AllServersSave`, `CompaniesSave`,
`FactionsSave`, `AliasesSave`, `GlobalAliasesSave`, `StockMarketSave`, `SettingsSave`,
`VersionSave`, `AllGangsSave`, `LastExportBonus`, `StaneksGiftSave`, `GoSave`,
`DarknetSave`, `InfiltrationsSave`). **Kein `BladeburnerSave`.**
Der Rang steht in `PlayerSave.data.bladeburner.data.rank`.
Ein Werkzeug, das `save.data.BladeburnerSave` liest, bekommt `undefined` und meldet
stumm „kein Bladeburner" — in einem Knoten, dessen einziger Ausgang die Division ist.
In `sync/backup.js` bereits korrekt umgesetzt.

### M.9 — Zwei wartende Augmentierungen · OFFEN
`queuedAugmentations` = **2** (Augmented Targeting II, CashRoot Starter Kit),
nicht 1 wie im Auftrag 1.2. Sie verfallen beim Knotenwechsel ersatzlos.
Der Aug-Riegel aus 7.1.6 („kein Aug-Kauf bei `ausgang.json.offen === true`") ist damit
schon heute scharf zu stellen, nicht erst im Zielzustand — der Sprung BN10 L2 → L3 kann
jede Stunde fällig werden.
`playtimeSinceLastAug` 9,77 h zeigt außerdem: **der Bot hat gestern gegen 15:20 autonom
eingebaut.** Das ist der Grund, warum Checkliste 9(4) `install-sperre.txt` verlangt.

### M.10 — Brachanteil 83 % · OFFEN — größter Effizienzposten
Der Motor meldet selbst `brachAnteil: 0,8127`. Nachgerechnet aus dem Spielstand:
**6,65 Mio GB frei von 8,00 Mio GB Netz.** Die 15 Parkrechner sind praktisch leer
(werk-9: 670 von 524.288 GB belegt). Gleichzeitig steht `mischung.kapGesamtGb` auf
19.705 GB — der Motor plant mit 0,25 % seines Netzes.
**Einordnung, bevor daraus eine Handlung wird:** BN10 wird über den Bladeburner-Rang
verlassen, nicht über Geld; das Konto steht bei 10,9 Bio $. Ob die Brache den Ausgang
verzögert, ist damit **nicht belegt** — sie verzögert ihn nur, wenn Geld oder
Hacking-EXP auf dem Weg zum Rang liegen. Das ist zu messen, bevor am Motor gebaut wird.
Für V1-Knoten (BN1/5/12/8, zehn der 40 Läufe) ist derselbe Befund dagegen unmittelbar
ausgangsrelevant.
→ Kennzahl `idle_ram_pct` aus 3.3, Alarmschwelle 20 %.

### M.11 — Zwei Massenschübe am 03.09., nicht einer · OFFEN
`bridge.log` zeigt **13:40:22Z 114 Dateien** und **21:40:55Z 106 Dateien**, dazu
13:28:37Z 115 Dateien beim Verbinden. Der Auftrag kennt nur den Vorfall um 15:40 Ortszeit
(= 13:40Z). Es gab also mindestens drei Massenübertragungen an einem Tag, zwei davon
ohne vorherige Sicherung.
**Folge:** Der Wachhund aus 4.5 ist nicht gegen ein Einzelereignis gebaut, sondern gegen
ein wiederkehrendes.

### M.12 — `lastTelemetryAt`-Befund im Code bestätigt · OFFEN
`sync/bridge.js:238-241` setzt `state.lastTelemetryAt = new Date().toISOString()` bei
**jedem erfolgreichen Lesen**, unabhängig vom Alter des Inhalts. Gemessen 04.09. 01:04:
`/api/state` meldet `lastTelemetryAt` = jetzt für einen Block, dessen eigenes `t`
auf den 21.08. zeigt (`hackLevel 3184`, 444 Mrd $, 96 Server — neben dem echten Stand
BN10 / Hacking 340 / 86 Server / 10,3 Bio $).
Ein Urteil „Tab eingefroren", das auf diesem Feld aufbaut, kann per Konstruktion nie
auslösen. Behoben mit dem Brücken-Umbau in Phase 0.

### M.13 — 136 Dateien unter `data/` auf home · OFFEN
Darunter zahlreiche Einmal-Diagnosen (`probe2.txt`, `ramtest.txt`, `sfprobe.txt`,
`psdiag.txt`, `coreprobe.txt`, `skilltest.txt` …). Inventur gehört nach
`doku/kontrakte.md` (Auftrag 4.6, Phase A2).
`data/telemetry.txt` ist darunter und wird in Phase 0 per `deleteFile` entfernt.

---

## W — Wachhund, aus der Skeptiker-Runde vom 04.09.2026 01:37

Drei Skeptiker mit getrennten Angriffswinkeln (Prämisse / Alltagsfehlermodi /
Substanz) auf den Brücken-Umbau. Vier echte Fehler, zwei davon schwer.

### W.1 — Der Anker löschte sich selbst · UMGESETZT 04.09. 01:45
`state.totalPlaytime` startet als `null`, und der Heartbeat schrieb es alle 30 s
ungeprüft in die Datei. Startete die Brücke ohne hängenden Spiel-Tab — nach jeder
Nacht, jedem Reboot, jedem Absturz der Neustartschleife — stand nach 30 Sekunden
`totalPlaytime: null` im Anker, und Prüfung (2) übersprang sich **still**.
Von drei Prüfungen blieben zwei, und beide lassen den Hauptfall durch: ein
ungepatchter Klon trägt Port 12525 und denselben `identifier`.
**Behoben:** `ankerPlaytime` hält den letzten endlichen Wert, wird beim Start aus
der Datei übernommen, fällt ersatzweise auf `INDEX.tsv` zurück, und ein fehlender
Anker geht als Zeile nach `## Sofort`.

### W.2 — Die Freigabe hing an einem Boolean statt am Socket · UMGESETZT 04.09. 01:45
Verifiziert wurde Socket A, geschrieben hätte die Brücke in Socket B. Übernimmt B
während der Prüfung, findet A's Close-Handler in `gameSocket` bereits B und setzt
nichts zurück; A's grüne Verifikation gab dann `pushAll` frei.
**Behoben:** Die Freigabe ist eine Referenz auf genau den geprüften Socket.

### W.3 — Die Lebendprüfung der zweiten Verbindung lief ins Leere · UMGESETZT 04.09. 01:45
Sie fragte die bestehende Verbindung über `request()`, und `request()` weist im
unverifizierten Fenster alles außer `getSaveFile` ab. `alteLebt` war dort **immer**
false, die bestehende Verbindung wurde also immer gekillt. Der Riegel gegen den
zweiten Tab kehrte sich genau dann um, wenn er gebraucht wird.

### W.4 — Urteil „Autosave steht" feuerte garantiert falsch · UMGESETZT 04.09. 01:45
Schwelle 5 min gegen die aktuelle Uhrzeit, aber `lastSaveAt` wird nur alle 10 min
aufgefrischt. **Es ist eingetreten**, um 01:37, auf einem kerngesunden Spiel — der
Eintrag steht im Log und wurde aus `## Sofort` abgeräumt.
Derselbe Fehler wie beim alten `lastTelemetryAt`, nur spiegelverkehrt: der eine
konnte nie feuern, der andere musste immer feuern. Beide vergiften den Kanal für
echte Notfälle.

### W.5 — `execFileSync` blockierte die Event-Loop · UMGESETZT 04.09. 01:52
In `sofortZeile`, aufgerufen in einer Schleife. Während sie lief, beantwortete die
Brücke keine RFA-Nachricht, kein Dashboard und keinen Timer.

### W.6 — Zweit-Tab-Alarm löst nur zwei von vier Reaktionen aus · OFFEN
Auftrag 7.1.1 verlangt nach dem Alarm zusätzlich: Sicherungstakt sofort auf 5 min
und Sperre aller Live-Eingriffe. Beides fehlt. → Phase C, Position 1.

### W.7 — Brücken-Nonce statt `totalPlaytime` als Anker · OFFEN, guter Vorschlag
Der Skeptiker schlägt vor, statt der monotonen Uhr ein Einmal-Token in
`data/instance.txt` auf home zu führen. Die Brücke liest es **aus derselben
`getSaveFile`-Antwort**, die sie ohnehin holt, und rotiert es nach jeder grünen
Verifikation. Ein Klon trägt das Token seines Zieh-Zeitpunkts und fällt durch,
sobald das Live-Spiel weitergedreht hat.
Das ist strikt stärker als der jetzige Anker: aus einer löschbaren Uhr wird
Challenge-Response. → Phase C, Position 1.

### W.8 — Der brückenfreie Sicherungsweg fehlt · OFFEN
Auftrag 7.2 führt ihn als „Pflicht, nicht Kür": der Kern liest
`data/bridge.json.lastVerifiedBackup` und ruft bei einem Alter über 90 min selbst
`ns.singularity.exportGame()`. `grep -rn "exportGame" src/` findet nichts.
Solange er fehlt, hängt Erics einzige absolute Bedingung an einem einzelnen
Windows-Prozess. → Phase C, Position 1.

### W.9 — Das Gegenstück des Handschlags im Spiel fehlt · OFFEN
Die Brücken-Seite ist gebaut, `grep -rn "backup-request" src/` ist leer. Es gibt
keinen Anforderer, also nie einen Handschlag. → Phase C, Position 2.

---

## A — Aus Phase A (Bestandsaufnahme), 04.09.2026 02:15

### A.1 — Die RAM-Tabelle fehlte im eigenen Bericht · UMGESETZT 04.09. 02:20
In `doku/ram-budget.md` stand an der Stelle der RAM-Tabelle die Inventur der 136
`data/`-Dateien aus einer anderen Teilaufgabe: 138 Zeilen über ein völlig anderes
Thema. Die Messung selbst war einwandfrei, nur der Bericht falsch zusammengesetzt.
Ein Skeptiker fand es.
**Behoben, und zwar strukturell:** Die Rohmessung liegt jetzt als
`doku/ram-messung-2026-09-04.json` im Repo, und die Tabelle wird mit
`node tools/ram-tabelle.js` **erzeugt** statt abgeschrieben. Eine erzeugte
Tabelle kann nicht mehr vom Thema abweichen.

### A.2 — Spielkopie und Plattenkopie sind identisch · GEPRÜFT, grün
Für alle 114 Dateien wurde der Live-Wert gegen den lokal gerechneten gehalten.
Abweichung bei allen 114 gleich null. Das war vorher nur angenommen.

### A.3 — Was der Faktor 16 kostet · GEMESSEN
Summe aller 114 Dateien bei SF4.1: 7.217,4 GB. Bei SF4.3: 1.884,9 GB.
Der Singularity-Faktor kostet also **5.332,5 GB** über den Werkzeugkasten.
Heute passen 30 Dateien nicht auf ein frisches home mit 32 GB, ab SF4.3 nur noch 8.
Die Summe ist ein Bestand, keine Belastung — die Dateien laufen nie gleichzeitig.

### A.4 — Der Zielwert „resident ≤ 20 GB" wurde nie geprüft · OFFEN
Auftrag 4.4 nennt zwei Schwellen im selben Absatz: „Resident sind nur Kern und
Wächter (≤ 20 GB)" und die Ebene-1-Grenzen ≤ 26 beziehungsweise ≤ 28.
Der A1-Bericht maß nur gegen die lockereren und meldete „hält, mit 0,25 GB Luft".
Gegen die 20 reißt der heutige Stand um **5,75 GB**.
**Folge für Phase B:** Der Architekturschnitt muss die Frage entscheiden, nicht
umgehen — entweder wird der Kern kleiner oder die Schwelle wird mit Begründung
korrigiert. Beides schweigend stehen zu lassen ist die eine Möglichkeit, die es
nicht gibt.

### A.5 — Beide „Handgriffe von Eric" sind längst erledigt · GESCHLOSSEN
`BAUSTELLEN.md ## Sofort` führt seit dem 02.09. zwei offene Handgriffe.
Beide sind erledigt, mit lückenlosem Zeitnachweis:

| Punkt | Zustand | Beleg |
|---|---|---|
| Autoexec im Spiel | `"boot.js"` | `SettingsSave.AutoexecScript`, gelesen 04.09. 01:37 |
| Autostart-Ordner | leer bis auf `desktop.ini` | Verzeichnis gelistet, mtime 02.09. 19:07:46 |

Die Registry-Schlüssel wurden mitgeprüft: zwölf Autostart-Einträge, kein Bitburner.
**Warum der Irrtum überlebte:** `aufsicht.log` meldete bis 02.09. 19:05 alle zehn
Minuten „Autoexec ist leer" und bricht dann ab — der Handgriff erfolgte um 19:07.
Die Datei friert ihren letzten Irrtum ein, und wer sie liest, hält ihn für den
aktuellen Stand. Genau deshalb steht in den Regeln, dass der Zustand der Zeuge
ist und nicht der Terminaltext.

### A.6 — Der Bericht zählte Singularity-Nutzer falsch · KORRIGIERT
Behauptet waren 17 Dateien, die `ns.singularity` in Aufrufform nutzen. Es sind 7.
Kein Suchmuster ergibt 17.

---

## E — Die ETA von BitNode 10

### E.1 — Die 430 Tage waren um Faktor 208 falsch · UMGESETZT 04.09. 02:48

**Aufgelöst.** Der Beweis brauchte kein Modell: der Bot hat BitNode 10 schon
einmal gefahren, und Lauf 1 liegt vollständig auf Platte.

Rang gegen Spielzeit ab Bladeburner-Beitritt, Lauf 1:

| Spielzeit | Rang | Rate/h | Aktion |
|---:|---:|---:|---|
| 19,9 h | 655 | 39 | Heilkammer ← **hier steht Lauf 2 heute** |
| 28,4 h | 1.121 | 66 | Heilkammer |
| 31,9 h | 1.509 | **111** | erste Operation |
| 46,6 h | 4.802 | 224 | Assassination |
| 46,7 h | 5.297 | **9.186** | Assassination |
| 47,8 h | 17.594 | | |
| 69,7 h | 4.543.999 | | |

Die Rate wächst um mehr als Faktor 5.000. Träger ist **nicht** der Rang —
`calculateActionRankGain` kennt den Spielerrang gar nicht — sondern die
Aktionsstufe über `rewardFac^(level-1)` und der Wechsel von Contracts auf
Operations.

**Der Auftragstext begründet das in 3.3 falsch.** Er sagt, der Ranggewinn je
Aktion skaliere mit `BladeburnerRank`. Das ist der BitNode-Faktor, in BN10 gleich
0,8, nicht der Spielerrang. Die Superlinearität ist echt, die genannte Ursache
nicht. → Korrektur gehört in den Auftragstext.

**Derselbe Fehler stand schon einmal hier.** `nodes/ERLEDIGT.md` vom 30.08.2026,
14:20: „gemessene Rangrate 42,5/h, also 334 Tage … die lineare Fortschreibung
eines Post-Reset-Lochs auf einer Exponentialkurve". Derselbe Knoten, dieselbe
Stelle der Kurve, fünf Tage früher. Er kam zurück, weil er damals **im Bericht**
korrigiert wurde und nicht **im Werkzeug**. Das ist die eigentliche Lehre.

**Behoben:** `tools/lib/rangkurve.js` hält die gemessenen Stützpunkte. Die
Restzeit wird nachgeschlagen statt hochgerechnet, das Ergebnis ist eine Klammer
von 27,7 Stunden bis 2,1 Tagen. Zwischen dem letzten Punkt unter der Schwelle
und dem ersten darüber liegen 22 ungemessene Stunden; die Klammer gibt das zu.
Für einen Knoten ohne Kurve wird das gesagt und **nicht** ersatzweise linear
gerechnet.

Der Bericht nennt jetzt außerdem eine **falsifizierbare Vorhersage**: bis Rang
903 lief die Referenz mit 169 Rang/h.

### E.1b — Lauf 2 ist schneller als Lauf 1 · GESCHLOSSEN
Der Gleichstandsvergleich an derselben Rangstelle:

| | Lauf 1 | Lauf 2 |
|---|---:|---:|
| Beitritt bis Rang 657 | 19,99 h | **18,71 h** |
| Rate dort | 34–45/h | 32,9/h |
| Operationen bei Rang 657 | 0 | 0 |

Der Bot fährt im Bladeburner-Teil **6 % schneller** als beim letzten Mal. Die
Heilkammer bei Rang 657 ist kein Fehler, sondern derselbe Anlaufzustand.
Die Sorge „der Bot fährt seit Tagen in die falsche Richtung" ist damit widerlegt.

### E.1c — Zwei echte Verluste bleiben · OFFEN
1. **Kaltstart 13,9 h langsamer als Lauf 1** (39,11 h bis zum Beitritt gegen
   höchstens 25,23 h). Einmalig, Ursache steht schon in der Sofort-Liste: der
   erste Mietrechner kostet in BN10 das Fünffache. → Phase C, Kaltstart-Gewerk.
2. **32,9 Rang/h gegen eine eigene Decke von 45,3.** Die Kammerphase dauert
   108 Sekunden, gutgeschrieben werden nur 60. Die übrigen 48 Sekunden je Zyklus
   bringen weder Rang noch Ausdauer. Kosten: 12,4 Rang/h, also rund 298 pro Tag.
   → Phase C, `blade.js`, mittleres Risiko, Skeptiker vor dem Einbau.

Drei weitere Vorschläge wurden **widerlegt** und werden nicht gebaut: Overclock
(Ausdauer fällt je Aktion an, nicht je Sekunde), Field Analysis statt Heilkammer
(bringt 9,6 gegen 20,5 Rang/h), Raid als Hebel (jeder Erfolg kostet 1 % der
Stadtbevölkerung, und die geht mit Exponent 0,7 in jede Erfolgschance ein).

### E.1-alt — Der ursprüngliche Befund, zur Nachvollziehbarkeit
Gemessen 04.09.2026 01:47: Rang 657 von 400.000, Rate 33 Rang je Spielstunde,
Rest 340.415 netto, ETA **430,7 Tage**, Urteil „AUF KURS".

Der Auftrag veranschlagt für die **gesamte** Restroute aus 40 Läufen 1.100–1.900
Motorstunden, also 46–79 Tage. Ein einzelner Lauf mit 430 Tagen ist damit
unvereinbar. Entweder ist die Rechnung falsch, oder der Bot fährt seit Tagen in
die falsche Richtung.

Zwei Verdachtsmomente, beide noch nicht entschieden:

1. **Die Rechnung extrapoliert linear.** Der Auftrag 3.3 sagt, der Ranggewinn je
   Aktion skaliere mit `BladeburnerRank`, und nennt für BN6 eine Verdopplungszeit
   von 3,5–3,8 h. Eine lineare Hochrechnung einer exponentiell wachsenden Größe
   ist genau der Fehler „Rate oder Bestand?".
   **Dagegen spricht die eigene Messreihe:** 596 → 639 → 645 → 649 → 657 zwischen
   23:58 und 01:47 ist sauber linear bei rund 33 Rang je Stunde. Der Rang wächst
   in diesem Fenster nachweislich **nicht** exponentiell.
2. **Der Bot fährt gerade keine ranggebende Aktion.** `checkin.js` meldet
   „General/Hyperbolic Regeneration Chamber, Chance 0.0 %, Ausdauer 28/50". Das
   ist eine Heilaktion. Wie groß ihr Zeitanteil ist, ist unbekannt — und genau
   dafür verlangt der Auftrag 3.3 die drei Kennzahlen `vorrat_deckung`,
   `rang_je_vorratseinheit` und `comms_rest`, die es noch nicht gibt.

Ohne diese drei Zahlen sieht der Bot in beiden Fällen nur ein zu großes `T2_h`.
Das ist kein Nebenbefund: **die ETA ist die letzte Zeile jedes Berichts an Eric**,
also die eine Zahl, auf die er seine Planung stützt.

### E.2 — Widersprüchliche Black-Ops-Summe · OFFEN
`checkin.js` rechnet mit 58.928 Rang aus den Black Ops selbst. Auftrag 8.1 nennt
als Eichpunkt „73.660/113.660". Drei Zahlen für dieselbe Größe, keine belegt.

---

## B — Bau-Sitzung

### B.1 — `/usage` in dieser Sitzung nicht abrufbar · OFFEN
Der Auftrag 13 verlangt den Budget-Stand „mit `/usage`, nie eine Einschätzung".
Diese Sitzung läuft in der Claude-Desktop-App (Code-Tab); Terminal-Dialog-Befehle wie
`/usage` sind hier nicht verfügbar und es gibt kein Werkzeug dafür.
Nach Auftrag 13 wird das einmal als Befund vermerkt und ersatzweise am Fortschritt
geplant: **Stufe A vor So 06.09.2026 13:00** (Wochentag per `date` bestätigt).
Im Stundenbericht steht deshalb keine Prozentzahl, sondern der Fortschritt gegen diesen Termin.

---

## L — Aus Auftrag 1.4 „Fragil und lückenhaft" (Nullpunkt, alle OFFEN)

- **L.1** Die drei Blöcke vom 02.09. in `bn4net.js` (A1-Regel `:685-705`,
  Stillstandserkennung `:2713-2739`, Kaltstart-Leiter `:733-749`) sind nie im
  Zielzustand gelaufen.
- **L.2** `sleeve.js`, `sleevecrime.js`, `hashes.js`, `hacknet.js` nie in BN9 gelaufen;
  `sleeve.js` riss am 02.09. das Konto um 18,5 Mio in 5 min ins Minus.
- **L.3** RAM-Gefangene des Faktors 16 (SF4.1 außerhalb BN4) — Werte in M.6 aktualisiert.
- **L.4** Kein Supervisor außen; Brücke ohne Starter, Lock, Exit-Fang, Backup.
  → wird in Phase 0 behoben.
- **L.5** Kein Figur-Vergabepunkt; sechs bis sieben Skripte greifen ohne Rangordnung
  nach der Figur (Audit C.14).
- **L.6** Logs sind Speicherlisten (200 Zeilen), kein Post-mortem (Audit C.16).
- **L.7** Stillstandserkennung deckt 5 von 14 Werkzeugen; kein Engine-Puls;
  kein Reload-Weg von innen.
- **L.8** Kaltstart: `contracts.js` passt neben `bn4net.js` nicht auf 32 GB;
  kein Wakelock unter 15 GB; BN10 stand 13,5 h ohne Werkbank (Audit B.9).
- **L.9** Fehlende Gewerke: BN8 (`boerse.js`), BN15 (Labyrinth), BN9 nur theoretisch,
  Grafting nicht autonom; `blade.js` nur auf BN6/10 kalibriert (Audit J).
- **L.10** Kein Testgeschirr außer `test-route.js` / `test-stillstandsuhr.js`.
- **L.11** Wissen steckt in Kommentaren, teils falsch (`bn4net.js:2973` Faktor 1000 daneben).
- **L.12** `skipped_route_entries` = 3 (die drei BN8-Einträge mangels `boerse.js`).

---

## A–J — Aus dem Autonomie-Audit vom 02.09.

*Wird aus dem laufenden Erhebungs-Workflow ergänzt, bevor Phase 0 abgeschlossen wird.*

## S — Aus `BAUSTELLEN.md ## Sofort`

*Wird aus dem laufenden Erhebungs-Workflow ergänzt.*
