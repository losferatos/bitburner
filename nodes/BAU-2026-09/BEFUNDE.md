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
