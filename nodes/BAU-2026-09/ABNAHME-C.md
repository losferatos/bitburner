# Abnahme Stufe C — ein beobachteter autonomer Sprung mit Kaltstart

**Angelegt: 04.09.2026, 16:20. Noch nicht eingetreten.**
Kriterien aus `nodes/AUFTRAG-BAU-2026-09.md`, Abschnitt 10.

**Stufe C ist kein Sitzungsziel** (Auftrag 13). Der Sprung kommt, wenn
`ausgang.json.offen` wahr wird — er wird **nicht erzwungen**. Diese Datei
liegt bereit, damit die Messung im Moment des Sprungs nicht improvisiert wird;
gemessen wird BN10 Lauf 2 → Lauf 3, mit SF4.1 (Faktor ×16 auf Singularity).

---

## Der Auslöser, und warum er nicht angefasst wird

```bash
cat data/ausgang.json | python -c "import sys,json;d=json.load(sys.stdin);print(d.get('offen'), d.get('grund'))"
```

Der Ausgang aus BN10 verlangt **400.000 Bladeburner-Rang** (Operation
Daedalus, `BlackOperations.ts:708`). Gemessen 04.09. 15:04: **1.990,4**.

**Achtung, korrigiert am 04.09.:** Frühere Restzeiten zogen 73.660 Rang ab,
die unterwegs aus den Black Ops anfallen sollten. Das war ein Lesefehler um
Faktor 1000 (Befund E.2). Richtig sind **2.231,5** für die ersten zwanzig
Operationen, in BN10 mit Knotenfaktor 0,8 also **1.785**. Der Bot muss rund
71.900 Rang mehr erarbeiten als jede ETA vor diesem Datum annahm.

```bash
node tools/test-blackops-summe.js      # rechnet die Summe aus dem Quelltext
node tools/checkin.js                  # ETA mit der korrigierten Zahl
```

---

## Die Kriterien

| # | Kriterium | Soll | Messbefehl | Ergebnis |
|---|---|---|---|---|
| C1 | `jump_latency` **ohne** `backup_wait` | ≤ 2 min | `data/ausgang.json`, `data/backup-wait.txt` | |
| C2 | `backup_wait` getrennt protokolliert | — | `data/backup-wait.txt` | |
| C3 | Sicherung `pre-jump` grün | vorhanden | `grep pre-jump backups/INDEX.tsv` | |
| C4 | `wirtFehlt` | **0** | `data/ausgang.json` | |
| C5 | `boot_latency` | ≤ 5 min | `data/events.json`, Art `boot` | |
| C6 | `verfahren.txt` | `V2 10 3` | `node tools/hand.js read verfahren.txt` | |
| C7 | Kern + Wächter + Timer-Patch auf 32 GB | binnen 5 min | `data/ps.json` | |
| C8 | Geldquelle läuft | binnen 15 min | `data/bn4net.json` | |
| C9 | `ausgang.js` startet, sobald die Tür in Reichweite ist | — | `data/registry-lauf.json` | |
| C10 | `t_workbench` | ≤ 2 × Bestwert (8,8 Mio $ für 32 GB bei Faktor 1,0) | `data/events.json` | |
| C11 | Konto nie negativ | **0 min** | `negative_balance_min` in `node tools/checkin.js` | |
| C12 | `t_gate` | ≤ 1,5 × dem **zur Laufzeit gerechneten** Bestwert | Rechenweg ins Protokoll | |
| C13 | Beitritt bei 4 × 100 **ohne Einbau davor** | — | `data/events.json` | |
| C14 | Sprossen ≥ 2 | **0** | `data/penalties.json` | |
| C15 | `manual_actions` | **0** | `data/manual-actions.json` | |
| C16 | Heartbeat `node` springt, Verbindung bleibt | — | `data/bridge.log` | |

### Zu C12 — welcher Bestwert gilt

**22,2 h ohne Sleeves · 15,9 h mit 2 · 13,9 h mit 3.**

Die Körperzahl wird **gemessen, nicht angenommen** — sie steht im Spielstand
und ändert sich mit dem Knoten. Ausdrücklich **nicht** gültig sind:

- die 9,5 h aus `knoten.md:74`
- die früheren 28,0 h; sie unterschlagen den Multiplikator 1,262 und machen
  die Schwelle um 26 % zu großzügig

Der Rechenweg gehört ins Protokoll, nicht nur das Ergebnis.

---

## Der Kaltstart, und was ihn diesmal trägt

Der Sprung landet auf einem frisch zurückgesetzten `home` mit **32 GB**. Was
dort gleichzeitig laufen muss, ist gerechnet und geprüft:

```bash
node tools/test-kaltstart-budget.js    # 24 Proben
node tools/test-ram.js                 # 40 Proben, darin das Tor E1
```

| | GB |
|---|---|
| Resident: `bn4net.js` + `guard.js` + `wakelock.js` | **19,15** |
| Geldquelle daneben (`cdump.js`) | 12,65 |
| Summe | **31,80 von 32** |
| ein Arbeiter (1,80) passt daneben **nicht** | — |

**Der Kaltstart verdient an Verträgen, nicht am Hacken.** Das ist keine
Notlösung, sondern die Lage: 0,20 GB Luft.

Die Spitze (mit `boot.js` und `shop.js` gleichzeitig) liegt bei **29,45 GB**
für wenige Sekunden — begründet in `tools/test-ram.js`, nicht in einer
Fußnote.

---

## Wenn ein Kriterium fällt

**Kein Handgriff.** Beobachten bis zur Selbstheilung oder bis ein
Rollback-Auslöser nach Auftrag 9 greift:

- Sprosse ≥ 3 binnen 2 h nach dem Einspielen
- Konto < 0
- `T2` > 2 × Soll über 60 Motorminuten
- Telemetrie > 15 min alt bei tickender Engine
- eine Fehlstrafe

Danach: Befund → Code → Test. **Stufe C beim nächsten Sprung.** Es gibt
39 weitere auf der Route; keiner davon wird für eine Abnahme verbrannt.

---

## Was vor dem Sprung schon steht

Diese drei sind neu seit dem 04.09. und greifen beim nächsten Sprung zum
ersten Mal:

1. **Der Handschlag** (`src/lib/handschlag.js`): `ausgang.js` fordert vor dem
   Sprung eine Sicherung an und wartet bis zu 90 s. **Der Sprung geht auch
   ohne Sicherung weiter** — er ist unaufschiebbar. Ein *Einbau* wartet
   dagegen, denn er ist es nicht.
2. **Die dreistufige Wirtkette** in `ausgang.js`: größter Fremdrechner →
   `data/geldbedarf.txt` mit `grund: "ausgang-wirt"` → nach einer Stunde
   `NOT_EXECUTABLE` mit Ereignis und `## Sofort`-Zeile. Vorher endete die
   Kette nach der ersten Stufe und meldete endlos „nächste Runde".
3. **`NOT_EXECUTABLE` hat einen Schreiber.** Der Zustand stand seit dem ersten
   Entwurf in `lib/leiter.js` und wurde von niemandem gesetzt — eine
   Zeichenkette ohne Schreiber. Er eskaliert nie: wenn `exit.js` auf keinen
   Rechner passt, hilft kein Neustart, es fehlt Speicher.

Und einer, der **nicht** greift, solange niemand ihn scharf stellt: Sprosse 5
läuft im Trockenlauf. Der Kern hängt `scharf` nur an, wenn
`data/punish-scharf.txt` auf `home` liegt — und die legt ein Mensch.
