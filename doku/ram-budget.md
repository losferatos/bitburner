# RAM-Budget aller Skripte unter `src/`

**Messung:** 04.09.2026, 01:37:53–01:38:05 Ortszeit (`date`), 114 Dateien, je ein
`calculateRam`-Aufruf gegen das **laufende** Spiel über die Brücke
(`http://127.0.0.1:8795/api/rpc?method=calculateRam&filename=<datei>&server=home`),
50 ms Pause zwischen den Aufrufen. Kein Fehlschlag, keine Ausnahme.

**Zustand des Spiels zur Messung** (`/api/state`, 01:36:59 und 01:47:56):
`instance LIVE`, `connected true`, `verified true`, `identifier 197f4d61481686`,
**BitNode 10, Lauf 2**, `motorRound 3685`.

**Der Faktor 16 ist gemessen, nicht angenommen.** `SF4Cost`
(`reference/v301/src/Netscript/RamCostGenerator.ts:81-95`) liefert `cost × 16`,
solange `bitNodeN !== 4` und `activeSourceFileLvl(4) <= 1`. Beleg aus der Messung
selbst: `bn4door.js` = 99,85 GB = 1,6 (Base) + 2,25 (Rest) + **6 × 16** für
`connect` + `getCurrentServer` + `installBackdoor` (je Fn1 = 2 GB). Ein anderer
Faktor als 16 ergibt diese Zahl nicht. Dieselbe Rechnung geht bei `homegrow.js`
(4 Funktionen à Fn2/Fn2/Fn2÷2/Fn2÷2 = 9 GB × 16 = 144) und `exit.js`
(`destroyW0r1dD43m0n` 32 GB × 16 = 512) auf. **In jeder Tabellenzeile unten gilt
also SF4 Stufe 1 = Singularity × 16.**

## Eichung des Rechenwegs (Pflicht aus CLAUDE.md)

Für die SF4.2- und SF4.3-Spalten kann nicht gemessen werden — das Live-Spiel hat
SF4 Stufe 1, und ein zweiter Spielstand ist verboten. Statt zu schätzen ist der
RAM-Rechner des Spiels **als ausführbarer Code nachgebaut**
(`RamCalculations.ts:82-259` und `:307-530`, mit `acorn`/`acorn-walk` aus
`reference/v301/node_modules`, Kostenbaum textuell aus `RamCostGenerator.ts`
geparst statt abgeschrieben) und gegen die Live-Messung geeicht:

> **114 von 114 Dateien identisch, Abweichung 0,00 GB.**

Erst damit sind die abgeleiteten Spalten belastbar. Der Nachbau liegt unter
`…/scratchpad/ramcalc.js`, die Eichung unter `…/scratchpad/eichung.js`.

## Die drei Verifikationsfragen

1. **Welche Uhr?** Keine. `calculateRam` ist eine reine Funktion über den
   Quelltext und den SF4-Stand — sie hat keine Zeitkomponente. Die einzige
   Zeitabhängigkeit ist der SF4-Stand selbst; der ändert sich nur beim Verlassen
   eines BitNodes.
2. **Stillstand und Nachholen?** Ohne Belang. Ein gedrosselter oder
   eingefrorener Tab ändert keine RAM-Kosten. Wohl aber ändert sich die Zahl,
   **sobald jemand die Datei anfasst** — jeder Wert unten ist an den Dateistand
   vom 04.09.2026 gebunden und muss nach jeder Änderung neu gemessen werden.
3. **Rate oder Bestand?** Bestand. Alle Zahlen sind statische Belegungen, keine
   Raten. Die einzige Rate in diesem Zusammenhang wäre die Startfrequenz von
   Einmal-Werkzeugen; sie ist hier nicht gemessen.

---

# 1 Tabelle: alle 114 Dateien, RAM absteigend

Unter `src/` liegen 116 Dateien: 114 `.js` (hier alle gemessen),
`route.json` und `NetscriptDefinitions.d.ts`. Die beiden letzten sind keine
Skripte — `calculateRam` antwortet auf `route.json` mit
`File is not a script` (geprüft) — und stehen deshalb nicht in der Tabelle.
Die Status-Spalte ist Evidenz, keine Meinung:
*Registry-Kandidat* = im Auftrag §1.3 (bewährt) oder §1.4 (Zielliste)
**namentlich** genannt; *tot nach 1.5* = in §1.5 **namentlich** genannt;
*unklar (niemand ruft es)* = keine andere Datei unter `src/` nennt den Dateinamen
(gemessen per Namenssuche über `src/`, `tools/`, `sync/`, `loops/`, `dashboard/`);
*unklar* = wird zwar genannt, aber in §1.3–1.5 nicht aufgeführt.

Verteilung: **28 Registry-Kandidaten, 16 tot nach §1.5, 47 ohne Aufrufer, 23 unklar.**


**Korrektur 04.09.2026 02:20.** An dieser Stelle stand zunaechst die Inventur der
136 Dateien unter `data/` aus einer anderen Teilaufgabe - 138 Zeilen ueber ein
voellig anderes Thema. Ein Skeptiker fand den Tausch. Die Messung selbst war davon
nicht betroffen: sie liegt vollstaendig in `doku/ram-messung-2026-09-04.json` und
wird seither mit `node tools/ram-tabelle.js` ERZEUGT statt abgeschrieben. Eine
erzeugte Tabelle kann nicht mehr vom Thema abweichen.

**Abgleich Spielkopie gegen Plattenkopie:** Fuer alle 114 Dateien wurde der
Live-Wert (`calculateRam` gegen das laufende Spiel) gegen den lokal gerechneten
Wert gehalten. Abweichung bei **allen 114 gleich null** - der Code im Spiel und der
Code auf der Platte sind derselbe. Das war vorher nur angenommen.

| | GB |
|---|---:|
| Summe aller 114 Dateien bei SF4.1 (heute) | 7.217,4 |
| Summe bei SF4.3 (Singularity x1) | 1.884,9 |
| **Was der Faktor 16 kostet** | **5.332,5** |
| Dateien ueber 32 GB heute | 30 |
| Dateien ueber 32 GB ab SF4.3 | 8 |

Die Summe ist eine Bestandsgroesse, keine Belastung: die 114 Dateien laufen nie
gleichzeitig. Sie sagt, wie viel Luft der Faktor 16 dem gesamten Werkzeugkasten
nimmt, nicht wie viel RAM der Bot braucht.


| Datei | SF4.1 live | SF4.3 | Ersparnis | passt auf 32 GB? | Singularity-Aufrufe | Zeilen |
|---|---:|---:|---:|---|---:|---:|
| `bn4rep.js` | 850,75 | 63,25 | 787,5 | **nein** | 18 | 1940 |
| `exit.js` | 519,25 | 39,25 | 480 | **nein** | 1 | 143 |
| `kampfaugs.js` | 387,85 | 27,85 | 360 | erst ab SF4.3 | 7 | 249 |
| `joinrun.js` | 371,35 | 26,35 | 345 | erst ab SF4.3 | 8 | 145 |
| `netburn.js` | 341,75 | 26,75 | 315 | erst ab SF4.3 | 6 | 96 |
| `cheap.js` | 306,75 | 21,75 | 285 | erst ab SF4.3 | 6 | 81 |
| `bn4life.js` | 293,85 | 23,85 | 270 | erst ab SF4.3 | 8 | 438 |
| `brcheck.js` | 274,75 | 19,75 | 255 | erst ab SF4.3 | 6 | 31 |
| `wbgrow.js` | 260,2 | 20,2 | 240 | erst ab SF4.3 | 5 | 117 |
| `kaufplan.js` | 258,75 | 18,75 | 240 | erst ab SF4.3 | 5 | 92 |
| `stat.js` | 258,75 | 18,75 | 240 | erst ab SF4.3 | 5 | 31 |
| `favorweg.js` | 234,85 | 17,35 | 217,5 | erst ab SF4.3 | 5 | 78 |
| `blade.js` | 174,35 | 99,35 | 75 | **nein** | 4 | 3489 |
| `augcount.js` | 162,25 | 12,25 | 150 | erst ab SF4.3 | 2 | 104 |
| `homegrow.js` | 148,5 | 13,5 | 135 | erst ab SF4.3 | 4 | 127 |
| `graft.js` | 145,45 | 32,95 | 112,5 | **nein** | 3 | 194 |
| `augcheck.js` | 122,75 | 10,25 | 112,5 | erst ab SF4.3 | 2 | 54 |
| `exploit3.js` | 114,1 | 9,1 | 105 | erst ab SF4.3 | 2 | 125 |
| `bn4door.js` | 99,85 | 9,85 | 90 | erst ab SF4.3 | 3 | 157 |
| `bbgraft.js` | 96,25 | 21,25 | 75 | erst ab SF4.3 | 1 | 63 |
| `bbtrain.js` | 94,75 | 12,25 | 82,5 | erst ab SF4.3 | 4 | 338 |
| `travel.js` | 94,75 | 49,75 | 45 | **nein** | 1 | 1673 |
| `keepalive.js` | 84,25 | 54,25 | 30 | **nein** | 1 | 291 |
| `daedalus.js` | 82,75 | 7,75 | 75 | erst ab SF4.3 | 1 | 66 |
| `bn4start.js` | 78,5 | 11 | 67,5 | erst ab SF4.3 | 2 | 122 |
| `probe.js` | 75,95 | 30,95 | 45 | erst ab SF4.3 | 1 | 220 |
| `joinfac.js` | 75,75 | 30,75 | 45 | erst ab SF4.3 | 1 | 62 |
| `bbspann.js` | 61,35 | 61,35 | 0 | **nein** | 0 | 424 |
| `wakelock.js` | 34,25 | 4,25 | 30 | erst ab SF4.3 | 1 | 154 |
| `autopilot.js` | 34,15 | 34,15 | 0 | **nein** | 0 | 1957 |
| `homeram.js` | 30,4 | 30,4 | 0 | ja | 0 | 1179 |
| `sr.js` | 29,6 | 29,6 | 0 | ja | 0 | 31 |
| `stufentest.js` | 29,6 | 29,6 | 0 | ja | 0 | 32 |
| `trupp.js` | 29,6 | 29,6 | 0 | ja | 0 | 38 |
| `backdoor.js` | 29,45 | 29,45 | 0 | ja | 0 | 103 |
| `hand.js` | 29,35 | 29,35 | 0 | ja | 0 | 230 |
| `buyaugs.js` | 28,85 | 28,85 | 0 | ja | 0 | 1932 |
| `install.js` | 28,25 | 28,25 | 0 | ja | 0 | 119 |
| `sleeve.js` | 27,85 | 27,85 | 0 | ja | 0 | 396 |
| `exportbonus.js` | 27,75 | 27,75 | 0 | ja | 0 | 68 |
| `work.js` | 27,65 | 27,65 | 0 | ja | 0 | 225 |
| `boprobe.js` | 27,6 | 27,6 | 0 | ja | 0 | 25 |
| `probe3.js` | 27,55 | 27,55 | 0 | ja | 0 | 88 |
| `donate.js` | 27,35 | 27,35 | 0 | ja | 0 | 143 |
| `stockaccess.js` | 27,35 | 27,35 | 0 | ja | 0 | 131 |
| `torprobe.js` | 27,35 | 27,35 | 0 | ja | 0 | 72 |
| `bitverse.js` | 27,25 | 27,25 | 0 | ja | 0 | 60 |
| `buyone.js` | 27,25 | 27,25 | 0 | ja | 0 | 112 |
| `hacktimer.js` | 27,25 | 27,25 | 0 | ja | 0 | 276 |
| `probe2.js` | 27,25 | 27,25 | 0 | ja | 0 | 54 |
| `sonde.js` | 27,25 | 27,25 | 0 | ja | 0 | 153 |
| `stopnight.js` | 27,25 | 27,25 | 0 | ja | 0 | 45 |
| `stopwork.js` | 27,25 | 27,25 | 0 | ja | 0 | 56 |
| `stocks.js` | 25,9 | 25,9 | 0 | ja | 0 | 209 |
| `formcheck.js` | 22,05 | 7,05 | 15 | ja | 1 | 139 |
| `chance.js` | 20,1 | 20,1 | 0 | ja | 0 | 122 |
| `bblage.js` | 19,75 | 12,25 | 7,5 | ja | 1 | 49 |
| `bn4net.js` | 17,75 | 17,75 | 0 | ja | 0 | 3274 |
| `contracts.js` | 17,65 | 17,65 | 0 | ja | 0 | 1507 |
| `astufe.js` | 17,6 | 17,6 | 0 | ja | 0 | 14 |
| `bodauer.js` | 17,6 | 17,6 | 0 | ja | 0 | 22 |
| `srtest.js` | 17,6 | 17,6 | 0 | ja | 0 | 14 |
| `bbtick.js` | 15,75 | 15,75 | 0 | ja | 0 | 74 |
| `blackops.js` | 15,6 | 15,6 | 0 | ja | 0 | 36 |
| `skillcheck.js` | 14,1 | 14,1 | 0 | ja | 0 | 85 |
| `sleevediag.js` | 13,6 | 13,6 | 0 | ja | 0 | 15 |
| `csolve.js` | 12,25 | 12,25 | 0 | ja | 0 | 41 |
| `cdump.js` | 12 | 12 | 0 | ja | 0 | 42 |
| `invest.js` | 10,75 | 10,75 | 0 | ja | 0 | 217 |
| `hacknet.js` | 9,45 | 9,45 | 0 | ja | 0 | 126 |
| `ausgang.js` | 8,15 | 8,15 | 0 | ja | 0 | 364 |
| `sleevecrime.js` | 7,65 | 7,65 | 0 | ja | 0 | 67 |
| `kerne.js` | 7,55 | 7,55 | 0 | ja | 0 | 50 |
| `lage.js` | 7 | 7 | 0 | ja | 0 | 34 |
| `hashes.js` | 5,95 | 5,95 | 0 | ja | 0 | 77 |
| `netburner.js` | 5,7 | 5,7 | 0 | ja | 0 | 92 |
| `vorrat.js` | 5,6 | 5,6 | 0 | ja | 0 | 24 |
| `boot.js` | 5,5 | 5,5 | 0 | ja | 0 | 172 |
| `calccheck.js` | 5,2 | 5,2 | 0 | ja | 0 | 134 |
| `netz.js` | 4,45 | 4,45 | 0 | ja | 0 | 22 |
| `restart.js` | 4,45 | 4,45 | 0 | ja | 0 | 59 |
| `xp.js` | 4,35 | 4,35 | 0 | ja | 0 | 142 |
| `share.js` | 4 | 4 | 0 | ja | 0 | 22 |
| `worker/share.js` | 4 | 4 | 0 | ja | 0 | 28 |
| `geld.js` | 3,75 | 3,75 | 0 | ja | 0 | 62 |
| `joinplan.js` | 3,75 | 3,75 | 0 | ja | 0 | 48 |
| `knoten.js` | 3,75 | 3,75 | 0 | ja | 0 | 60 |
| `popups.js` | 3,3 | 3,3 | 0 | ja | 0 | 234 |
| `kill.js` | 3,15 | 3,15 | 0 | ja | 0 | 61 |
| `killrep.js` | 3,15 | 3,15 | 0 | ja | 0 | 25 |
| `killui.js` | 3,15 | 3,15 | 0 | ja | 0 | 56 |
| `reboot.js` | 3,15 | 3,15 | 0 | ja | 0 | 37 |
| `werkbank.js` | 2,9 | 2,9 | 0 | ja | 0 | 61 |
| `telemetry.js` | 2,75 | 2,75 | 0 | ja | 0 | 101 |
| `darkweb.js` | 2,65 | 2,65 | 0 | ja | 0 | 256 |
| `preis.js` | 2,65 | 2,65 | 0 | ja | 0 | 13 |
| `ps.js` | 2,65 | 2,65 | 0 | ja | 0 | 26 |
| `scan.js` | 2,65 | 2,65 | 0 | ja | 0 | 64 |
| `ramcheck.js` | 2,35 | 2,35 | 0 | ja | 0 | 12 |
| `audiocheck.js` | 2,25 | 2,25 | 0 | ja | 0 | 36 |
| `echoargs.js` | 2,25 | 2,25 | 0 | ja | 0 | 8 |
| `kanaltest.js` | 2,25 | 2,25 | 0 | ja | 0 | 16 |
| `timerzwang.js` | 2,25 | 2,25 | 0 | ja | 0 | 32 |
| `path.js` | 1,8 | 1,8 | 0 | ja | 0 | 51 |
| `worker/grow.js` | 1,8 | 1,8 | 0 | ja | 0 | 30 |
| `worker/weaken.js` | 1,8 | 1,8 | 0 | ja | 0 | 32 |
| `worker/expfarm.js` | 1,75 | 1,75 | 0 | ja | 0 | 63 |
| `worker/hack.js` | 1,75 | 1,75 | 0 | ja | 0 | 75 |
| `exploit.js` | 1,6 | 1,6 | 0 | ja | 0 | 39 |
| `exploit2.js` | 1,6 | 1,6 | 0 | ja | 0 | 119 |
| `join.js` | 1,6 | 1,6 | 0 | ja | 0 | 586 |
| `lib/batch.js` | 1,6 | 1,6 | 0 | ja | 0 | 282 |
| `lib/calc.js` | 1,6 | 1,6 | 0 | ja | 0 | 370 |
| `lib/hackaugs.js` | 1,6 | 1,6 | 0 | ja | 0 | 313 |


---

# 2 ABWEICHUNGEN VOM AUFTRAGSTEXT

## 2.1 Die sieben vorgelegten Zahlen — alle sieben bestätigt

Der Auftrag legte sieben Messwerte zur Gegenprobe vor. **Alle sieben sind durch
eigene Messung bestätigt; in allen sieben Fällen liegt der Auftragstext an den
zitierten Stellen (§1.3, §1.4, §1.6, §4.4) falsch.**

| Datei | Auftrag sagt | gemessen 04.09. | Abweichung | Fundstelle der falschen Zahl |
|---|---:|---:|---:|---|
| `boot.js` | 4,0 („geeicht") | **5,5** | +1,5 | §1.3, §4.4 Zielwert `boot.js <= 4,0` |
| `blade.js` | 162,25 / 94,85 / 27,6 | **174,35** (SF4.3: 99,35) | +12,1 | §1.3 (`ERLEDIGT.md:2515`), §1.6 (`ROADMAP.md:664`) |
| `darkweb.js` | 27,65 | **2,65** | −25,0 | §1.3 |
| `popups.js` | 1,6 | **3,3** | +1,7 | §1.3 |
| `sleeve.js` | 14,75 | **27,85** | +13,1 | §1.4 |
| `sleevecrime.js` | 5,7 | **7,65** | +1,95 | §1.4, und die Datei selbst (`sleevecrime.js:2`: „5,6 GB") |
| `bn4rep.js` | 846,8 | **850,75** | +3,95 | §1.4 |

Bemerkungen zu den größeren Brocken:

- **`darkweb.js` 2,65 statt 27,65.** Die Differenz ist exakt 25 GB, also genau ein
  DOM-Literal. Der Trick `globalThis["docu"+"ment"]` (`darkweb.js:53`) **wirkt** —
  die 27,65 aus §1.3 stammen aus der Zeit davor. Der Nachbau bestätigt: kein
  `dom`-Posten in der Kostenaufstellung.
- **`blade.js`: die kolportierte „174" ist die richtige Zahl.** §1.6 schreibt
  „die kolportierte ‚174' steht nirgends" — sie steht jetzt in dieser Messung:
  **174,35 GB**. Die drei Zahlen aus §1.3/§1.6 sind alle falsch, und die 27,6 ist
  **strukturell unmöglich**: `blade.js` referenziert 24 Funktionen der
  Bladeburner-API (zusammen 87 GB) plus `getBitNodeMultipliers` (4 GB). Diese
  Kosten hängen **nicht** an SF4. Der Boden von `blade.js` liegt bei
  **99,35 GB**, egal wie hoch SF4 steht — und wäre nur durch Aufteilen der Datei
  zu unterschreiten, nicht durch Warten auf SF4.3.
- **`sleeve.js` 27,85 statt 14,75.** Auch hier ist SF4 unbeteiligt: die Datei hat
  **null** Singularity-Kosten. Die 27,85 kommen aus sechs 4-GB-Funktionen
  (`sleeve.getSleeve`, `sleeve.getTask`, `sleeve.setToBladeburnerAction`,
  `sleeve.setToGymWorkout`, `sleeve.setToCommitCrime`,
  `bladeburner.getActionCountRemaining`). Die Datei wird auch ab SF4.3 nicht
  billiger.

## 2.2 Weitere Abweichungen, die bei der Messung aufgefallen sind

| Datei / Aussage | Auftrag bzw. Quelle sagt | gemessen / gerechnet | Befund |
|---|---|---|---|
| `bn4net.js` | 16,25 (`:218`) / 17,75 (`BAUSTELLEN.md`) / **19,65 in BN4** (`:34-35`) | **17,75 — in BN10 *und* in BN4 identisch** | `bn4net.js` hat **null** Singularity-Kosten. Ein BN4-Sonderwert kann es nicht geben. Die 19,65 und die 16,25 sind Messungen an älteren Dateiständen; `BAUSTELLEN.md` hat recht. Der Kommentar `bn4net.js:34-35` ist irreführend und sollte beim Anfassen korrigiert werden. |
| `bn4life.js` | 293,8 (§1.4) | **293,85** | Rundungsfehler in §1.4. In BN4 selbst: 23,85. |
| `wakelock.js` | „34,25 (**DOM-Literal 25**)" (§1.4) | **34,25 — aber 0 GB DOM, 32 GB Singularity** | **Grund falsch.** `wakelock.js` benutzt `globalThis["window"]` (`:71`), zahlt also kein DOM-Literal. Die 32 GB kommen von einer **versehentlichen Namensgleichheit**: `osc.connect(gain).connect(ctx.destination)` (`wakelock.js:91`, Web-Audio-API). Der RAM-Rechner löst nur den **nackten Namen** auf (`RamCalculations.ts:216-243`, `findFunc`) und findet `singularity.connect` (Fn1 = 2 GB × 16). Siehe Abschnitt 4.1 — hier liegen 32 GB auf der Straße. |
| `contracts.js` „passt neben bn4net nicht auf 32 GB (**fehlen 1,9 GB**)" (§1.4) | 1,9 GB fehlen | **3,4 GB fehlen** (17,75 + 17,65 = 35,4) | Die 1,9 stammen aus der Paarung 17,65 + 16,25 = 33,9. Mit dem heutigen Kern fehlen 3,4 GB. |
| `exit.js` „519,25 **nur gerechnet**" (§1.6) | gerechnet | **519,25 gemessen** | Bestätigt auf die Nachkommastelle. §1.6 kann diesen Punkt streichen. |
| Wirt für `exit.js`: „braucht Wirt ≥ **540 GB**" (§1.4) | 540 | **545,21 GB** (519,25 × 1,05) | Ein 540-GB-Wirt reißt die eigene 5-%-Regel aus §4.4. Die dort geforderte Kaufregel `2^ceil(log2(519,25))` ergibt ohnehin **1024 GB**, nicht 540. |
| „Keine Einzelaufruf-Singularity-Skripte (**33,6 GB Minimum** bei SF4.1)" (§4.4) | 33,6 GB Minimum | **stimmt nur für Fn1** | Gemessen und mit dem geeichten Nachbau gegengeprüft: `isFocused`/`setFocus` kosten 0,1 → Skript **3,2 GB**; `getCurrentWork` 0,5 → **9,6 GB**; `cat`, `getDarkwebProgramCost`, `hospitalize`, `isBusy` je 0,5 → **9,6 GB**. Beleg im laufenden Bestand: `bblage.js` = 19,75 GB **mit** `getCurrentWork`. Die Aussage „33,6 GB Minimum" verbaut ohne Not ein ganzes Band billiger Singularity-Abfragen. |
| RAM von `globalThis["location"].reload()`: 0 GB gegen 25 GB (§1.6, offen) | offen | **0 GB — entschieden** | Mit dem geeichten Nachbau gemessen: `globalThis["location"].reload()` = 1,6 GB Gesamtkosten (nur Base), ebenso `globalThis.location.reload()`. Nur die nackten Bezeichner `document` und `window` kosten 25 GB (`RamCalculations.ts:183-192`); `location` steht in keinem Kostenbaum. **Der Wächter kann ohne RAM-Aufschlag neu laden.** |
| Wächter-Schätzung „2,3-GB-Fühler (Base + `getPlayer` + `ps`)" (§4.4) | 2,3 | **2,3 exakt** | Bestätigt (1,6 + 0,5 + 0,2). `ns.write`/`ns.read` sind kostenlos. |
| Wächter „gerechnet 5,6 GB … 7,6 GB mit Sprosse 2" (§4.4) | 5,6 / 7,6 | **7,0 für den vollen Satz** | Ein Wächter mit `getPlayer, ps, kill, exec, run, scp, getServerMaxRam, getServerUsedRam, read, write, getResetInfo, fileExists, isRunning` und `globalThis["docu"+"ment"]` kostet 7,0 GB. Plausibel im Rahmen von §4.4, aber die genaue Zahl hängt am Funktionssatz — sie ist erst nach dem Bau messbar. |
| `hashes.js` „rund 5" (§1.4) und Dateikopf „rund 5 GB" | ~5 | **5,95** | Knapp, aber die Datei behauptet über sich selbst einen zu kleinen Wert. |
| `hacknet.js` „~9" (§1.4) | ~9 | **9,45** | Bestätigt. |
| `homegrow.js` 148,5 · `bn4door.js` 99,85 · `bbtrain.js` 94,75 · `contracts.js` 17,65 · `ausgang.js` 8,15 · `cdump/csolve < 15` · Arbeiter 1,75/1,80/1,80/4,0 | wie im Auftrag | **alle bestätigt** | `cdump.js` 12,0 und `csolve.js` 12,25 — beide unter 15, wie behauptet. |

## 2.3 Zwei Zahlen, die in den Dateien selbst falsch stehen

Nicht der Auftrag, aber dieselbe Klasse Fehler — Selbstauskünfte im Quelltext, die
nie nachgemessen wurden:

- `src/sleevecrime.js:2`: „Kaltstart-Verbrechen für die Sleeves — **5,6 GB**" → **7,65 GB**.
- `src/hashes.js:1-2`: „rund **5 GB**" → **5,95 GB**.

Beide sind genau die Zahlen, mit denen §4.4 die Zeile `sleevecrime/hashes ~5-6`
begründet. Real sind es 7,65 und 5,95, zusammen **13,6 statt 10-12**.


---

# 3 KALTSTART-BUDGET

**Randbedingungen, belegt.** Frisches `home` nach einem BitNode-Sprung:
`Prestige.ts:245-252` setzt `setMaxRam(32)` (SF1 > 0, SF9 < 2 — der Live-Stand hat
SF {1,4,5,6,10}, also **32 GB**) und `cpuCores = 1`. Der nächste Sprung ist
BN10 L2 → L3, also **wieder BN10 mit SF4 Stufe 1 → Singularity × 16**.

## 3.1 Die Rangfolge aus §4.4 mit den GEMESSENEN Zahlen

| Rang | Datei | GB (SF4.1) | kumuliert | frei von 32 |
|---|---|---:|---:|---:|
| — | `boot.js` (resident bis der Kern läuft) | 5,5 | 5,5 | 26,5 |
| 1 | Kern `bn4net.js` | 17,75 | 23,25 | 8,75 |
| — | *boot.js gibt frei* (`boot.js:163-168`) | −5,5 | 17,75 | 14,25 |
| 2 | Wächter (Sollwert 8; existiert noch nicht) | 8,0 | 25,75 | 6,25 |
| 3 | Wakelock `wakelock.js` | **34,25** | **60,0** | **−28,0** |
| 4a | `hashes.js` | 5,95 | 65,95 | −33,95 |
| 4b | `sleevecrime.js` | 7,65 | 73,60 | −41,60 |
| 4c | `worker/weaken.js` | 1,80 | 75,40 | −43,40 |
| 5 | `contracts.js` | 17,65 | 93,05 | −61,05 |
| 6 | `werkbank.js` | 2,90 | 95,95 | −63,95 |
| 7 | `ausgang.js` | 8,15 | 104,10 | −72,10 |

**Die Leiter reißt auf Rang 3.** `wakelock.js` ist mit 34,25 GB größer als das
ganze `home` — es ist im Kaltstart nicht „knapp", es ist **nicht startbar**.
§1.4 sagt das richtige Ergebnis mit der falschen Begründung (siehe 2.2 und 4.1).

## 3.2 Die beiden Summen, die Ebene 1 prüfen soll

| Prüfung aus §4.4 | Soll | mit gemessenen Zahlen | Urteil |
|---|---:|---:|---|
| Kern + Wächter + `boot.js` | ≤ 28 | 17,75 + 8,0 + 5,5 = **31,25** | **reißt um 3,25 GB** |
| resident = Kern + Wächter | ≤ 26 | 17,75 + 8,0 = **25,75** | hält — mit 0,25 GB Luft |

Mit dem in 2.2 gemessenen 7,0-GB-Wächter statt des 8,0-Sollwerts: 30,25 —
**reißt immer noch um 2,25 GB**. Erst mit dem geteilten Wächter (2,3-GB-Fühler,
§4.4 letzter Absatz) hält beides: 17,75 + 2,3 + 5,5 = **25,55**.

## 3.3 Wer muss wie viel abnehmen — gerechnet

Damit die Rangfolge 1-4 überhaupt anläuft, sind drei Diäten nötig. Alle drei sind
aus der Kostenaufstellung des geeichten Nachbaus abgeleitet, nicht geschätzt.

**(a) `wakelock.js`: −32,0 GB, Aufwand zwei Zeichen.**
Die einzige Ursache ist die Namensgleichheit `connect` (siehe 4.1). Mit
`osc["con"+"nect"](gain)["con"+"nect"](ctx.destination)` fällt die Datei von
**34,25 auf 2,25 GB** — mit dem geeichten Rechner nachgerechnet. Damit ist der
§4.4-Zielwert „Wakelock-Worker ≤ 6" schon vom **heutigen** Skript erfüllt, ohne
Neubau. (Der Neubau als Worker-Timer bleibt trotzdem richtig — die
AudioContext braucht nach einem Reload einen Nutzerklick, das ist ein anderer
Grund als RAM.)

**(b) `bn4net.js`: −5,75 GB auf den Zielwert 12.** Die Kostenaufstellung des Kerns
(Summe 17,75, gegengerechnet):

| Posten | GB | im Kaltstart nötig? |
|---|---:|---|
| Base | 1,60 | ja |
| `cloud.*` (7 Funktionen: `getServerNames` 1,05, `purchaseServer` 2,25, `upgradeServer` 0,25, `getServerCost` 0,25, `getServerUpgradeCost` 0,1, `getServerLimit` 0,05, `getRamLimit` 0,05) | **4,00** | **nein** — der erste Mietrechner ist Rang 6, nicht Rang 1 |
| `hackAnalyze` + `hackAnalyzeChance` + `growthAnalyze` | **3,00** | **nein** — nur für die Aktionsmischung (`bn4net.js:34-36` nennt genau diese 3 GB) |
| `getServer` | 2,00 | ja (Zielbewertung) |
| `exec` 1,3 · `scriptKill` 1,0 · `getResetInfo` 1,0 · `scp` 0,6 · `kill` 0,5 · `getPlayer` 0,5 | 4,90 | ja |
| Portknacker (5 × 0,05) · `nuke` · `scan` · `ps` · `ls` · Rest | 2,25 | ja |

**Ergebnis: `cloud.*` und die `hackAnalyze`-Familie herauslösen → 10,75 GB.** Das
unterschreitet den Zielwert 12 mit 1,25 GB Luft. Beides sind echte
Funktionsentscheidungen, kein freies Mittagessen:
- Die `cloud.*`-Familie gehört in ein eigenes kleines Kaufskript (Base + `cloud.*`
  + `getServerMoneyAvailable` + `scp` + `exec` = **7,6 GB**), das der Kern für
  Rang 6 einmal startet und wieder beendet.
- Die `hackAnalyze`-Familie ersetzt `lib/calc.js` — aber `bn4net.js:3228-3234`
  verbietet ausdrücklich, `lib/calc.js` zu **importieren** (das zöge die Kosten
  wieder herein). Der Kaltstart-Modus muss die drei Formeln also **inline**
  tragen oder die Mischung fest verdrahten.

**(c) `boot.js`: −1,5 GB auf den Zielwert 4,0.** Ohne (b) reicht das nicht: selbst
mit `boot.js` = 4,0 stünde Kern + Wächter + boot bei 29,75, also weiter über 28.
Mit (b) hält die Summe auch beim heutigen `boot.js`: 10,75 + 8,0 + 5,5 = **24,25**.
**Die 4,0-Forderung an `boot.js` ist damit entbehrlich, die Kern-Diät nicht.**

## 3.4 Was nach den Diäten auf 32 GB zusammen passt

Resident nach (a)+(b), voller 8-GB-Wächter:

    Kern (Kaltstart-Modus)   10,75
    Waechter                  8,00
    Wakelock (repariert)      2,25
    -------------------------------
    resident                 21,00      Soll <= 26   HAELT
    + boot.js (bis Kernstart) 5,50 -> 26,50   Soll <= 28   HAELT

Frei bleiben **11,0 GB**. Damit laufen als Nächstes, nacheinander oder gemeinsam:

| passt | Summe | Rest von 32 |
|---|---:|---:|
| `sleevecrime.js` 7,65 | 28,65 | 3,35 |
| `hashes.js` 5,95 + `worker/weaken.js` 1,80 + `werkbank.js` 2,90 | 31,65 | 0,35 |
| `ausgang.js` 8,15 + `worker/weaken.js` 1,80 | 30,95 | 1,05 |
| `cdump.js` 12,0 **allein neben dem Kern** (Wächter pausiert) | 22,75 | 9,25 |

**Nicht** unterzubringen bleiben, auch nach den Diäten:
`contracts.js` 17,65 (21,0 + 17,65 = 38,65), `sleeve.js` 27,85, `hacknet.js` 9,45
neben einer zweiten Geldquelle — und alles darüber.

Die §4.4-Zeile „`contracts` 17,65 passt NICHT neben den Kern — Hälften
`cdump`/`csolve` (< 15 GB)" ist damit bestätigt, aber die Hälften passen auch nur
**einzeln und ohne Wächter**: `cdump.js` 12,0 + `csolve.js` 12,25 = 24,25 wäre
neben dem 10,75-Kern schon 35,0.

## 3.5 Der Wirt für `exit.js`

519,25 GB gemessen (nicht mehr nur gerechnet). Mit den 5 % aus §4.4:
**545,21 GB**. Die dort vorgeschriebene Kaufregel `2^ceil(log2(RAM))` ergibt
**1024 GB**, nicht die in §1.4 genannten 540. Ab SF4.3 fällt `exit.js` auf
**39,25 GB** — dann genügt fast jeder Rechner, und die ganze Wirt-Planung aus
§4.4 entfällt. Bis dahin ist sie Pflicht.


---

# 4 WAS DIE 16 KOSTET

Nicht geschätzt: die Spalten SF4.2 und SF4.3 stammen aus dem **geeichten**
Nachbau (114/114 identisch mit der Live-Messung, siehe Kopf). Die Aufstellung
sagt außerdem, **welche** Singularity-Funktionen der Rechner in jeder Datei
tatsächlich aufgelöst hat — das ist belastbarer als ein `grep` nach
`ns.singularity.`, denn der Rechner löst nur den **nackten Namen** auf
(`RamCalculations.ts:216-243`) und sieht deshalb sowohl die Alias-Form
`const s = ns.singularity; s.foo()` (17 Dateien unter `src/` benutzen sie) als
auch fremde Bezeichner mit demselben Namen. **Ein `grep` nach `ns.singularity.`
meldet in 13 Dateien null Treffer, obwohl dort zusammen 1.856 GB
Singularity-Kosten liegen** — darunter `joinrun.js` mit 368 GB, `cheap.js` mit
304 und `brcheck.js` mit 272. Der im Auftragstext vorgeschlagene Schätzweg über
die Zahl der `ns.singularity.`-Funde hätte also ausgerechnet die teuersten Fälle
mit null bewertet; deshalb hier der AST-Weg.

## 4.1 Der teuerste Einzelbefund: `wakelock.js` zahlt 32 GB für Web Audio

`wakelock.js:91` lautet `osc.connect(gain).connect(ctx.destination)`. Das ist die
Web-Audio-API, kein Netscript. Der RAM-Rechner kennt aber nur den Namen
`connect`, findet `singularity.connect` (Fn1 = 2 GB) und stellt bei SF4.1
**32 GB** in Rechnung. Die Datei enthält **kein einziges** `singularity` (per
`grep` geprüft).

| | GB |
|---|---:|
| `wakelock.js` heute | 34,25 |
| `wakelock.js` mit `osc["con"+"nect"](…)` (geeicht nachgerechnet) | **2,25** |

Dieselbe Falle steckt in `keepalive.js:274` (dieselbe Zeile, dieselben 32 GB —
Datei ist nach §1.5 tot) und, in anderer Gestalt, in `travel.js:1035`,
`probe.js:33` und `joinfac.js:24`: dort heißt eine **eigene** Funktion bzw. ein
Import `joinFaction` und kostet 48 GB, ohne dass Singularity im Spiel wäre. Alle
drei sind tot bzw. ohne Aufrufer, aber die Regel gilt für den Neubau:

> **Kein Bezeichner im neuen Bot darf so heißen wie eine Netscript-Funktion.**
> Die 64 Singularity-Namen sind bei SF4.1 zwischen 1,6 und 512 GB teuer, ohne
> dass ein `ns`-Aufruf im Spiel ist. Das gehört als Grep-Verbot in den Prüfstand
> (§6.1).

## 4.2 Wer profitiert wie stark von SF4.3

30 der 114 Dateien tragen überhaupt Singularity-Kosten; 84 sind vom Faktor
unberührt. Über alle 114 Dateien aufsummiert: **7.217,4 GB bei SF4.1 gegen
1.884,9 GB bei SF4.3** — der Faktor 16 kostet den Bestand also **5.332,5 GB**,
und die Summe schrumpft ab SF4.3 auf **26 %**. Bei den 28 Registry-Kandidaten
allein: 2.559,0 → 496,5 GB (**−2.062,5**).

| Datei | SF4.1 (×16, heute) | SF4.2 (×4) | SF4.3 (×1) | Ersparnis | Singularity-Funktionen (vom Rechner aufgeloest) |
|---|---:|---:|---:|---:|---|
| `bn4rep.js` | 850,75 | 220,75 | **63,25** | −787,5 | getOwnedAugmentations, getFactionFavor, getFactionRep, getAugmentationsFromFaction, getAugmentationRepReq, getAugmentationPrice, quitJob, getCurrentWork, getAugmentationStats, donateToFaction, purchaseAugmentation, installAugmentations, getCompanyRep, applyToCompany, workForCompany, getCompanyFavor, getFactionWorkTypes, workForFaction |
| `exit.js` | 519,25 | 135,25 | **39,25** | −480 | destroyW0r1dD43m0n |
| `kampfaugs.js` | 387,85 | 99,85 | **27,85** | −360 | getOwnedAugmentations, getFactionRep, getAugmentationsFromFaction, getAugmentationPrice, getAugmentationRepReq, purchaseAugmentation, workForFaction |
| `joinrun.js` | 371,35 | 95,35 | **26,35** | −345 | travelToCity, getCurrentWork, gymWorkout, checkFactionInvitations, joinFaction, getOwnedAugmentations, getAugmentationsFromFaction, getAugmentationRepReq |
| `netburn.js` | 341,75 | 89,75 | **26,75** | −315 | checkFactionInvitations, joinFaction, getAugmentationsFromFaction, getOwnedAugmentations, getAugmentationRepReq, getAugmentationPrice |
| `cheap.js` | 306,75 | 78,75 | **21,75** | −285 | getOwnedAugmentations, checkFactionInvitations, getFactionRep, getAugmentationsFromFaction, getAugmentationRepReq, getAugmentationPrice |
| `bn4life.js` | 293,85 | 77,85 | **23,85** | −270 | checkFactionInvitations, joinFaction, travelToCity, purchaseTor, getDarkwebProgramCost, purchaseProgram, getCurrentWork, commitCrime |
| `brcheck.js` | 274,75 | 70,75 | **19,75** | −255 | getOwnedAugmentations, getFactionRep, getFactionFavor, getAugmentationsFromFaction, getAugmentationRepReq, getAugmentationPrice |
| `wbgrow.js` | 260,2 | 68,2 | **20,2** | −240 | getOwnedAugmentations, getFactionRep, getAugmentationsFromFaction, getAugmentationRepReq, getAugmentationPrice |
| `kaufplan.js` | 258,75 | 66,75 | **18,75** | −240 | getOwnedAugmentations, getFactionRep, getAugmentationsFromFaction, getAugmentationRepReq, getAugmentationPrice |
| `stat.js` | 258,75 | 66,75 | **18,75** | −240 | getOwnedAugmentations, getFactionRep, getAugmentationsFromFaction, getAugmentationRepReq, getAugmentationPrice |
| `favorweg.js` | 234,85 | 60,85 | **17,35** | −217,5 | getFactionFavor, getFactionRep, getOwnedAugmentations, getAugmentationsFromFaction, getAugmentationRepReq |
| `blade.js` | 174,35 | 114,35 | **99,35** | −75 | getCurrentWork, travelToCity, gymWorkout, hospitalize |
| `augcount.js` | 162,25 | 42,25 | **12,25** | −150 | getOwnedAugmentations, getAugmentationsFromFaction |
| `homegrow.js` | 148,5 | 40,5 | **13,5** | −135 | getUpgradeHomeCoresCost, upgradeHomeCores, getUpgradeHomeRamCost, upgradeHomeRam |
| `graft.js` | 145,45 | 55,45 | **32,95** | −112,5 | getOwnedAugmentations, getCurrentWork, travelToCity |
| `augcheck.js` | 122,75 | 32,75 | **10,25** | −112,5 | getOwnedAugmentations, getAugmentationBasePrice |
| `exploit3.js` | 114,1 | 30,1 | **9,1** | −105 | travelToCity, goToLocation |
| `bn4door.js` | 99,85 | 27,85 | **9,85** | −90 | connect, getCurrentServer, installBackdoor |
| `bbgraft.js` | 96,25 | 36,25 | **21,25** | −75 | getAugmentationStats |
| `bbtrain.js` | 94,75 | 28,75 | **12,25** | −82,5 | getCurrentWork, travelToCity, stopAction, gymWorkout |
| `travel.js` | 94,75 | 58,75 | **49,75** | −45 | joinFaction |
| `keepalive.js` | 84,25 | 60,25 | **54,25** | −30 | connect |
| `daedalus.js` | 82,75 | 22,75 | **7,75** | −75 | getOwnedAugmentations |
| `bn4start.js` | 78,5 | 24,5 | **11** | −67,5 | getUpgradeHomeRamCost, upgradeHomeRam |
| `probe.js` | 75,95 | 39,95 | **30,95** | −45 | joinFaction |
| `joinfac.js` | 75,75 | 39,75 | **30,75** | −45 | joinFaction |
| `wakelock.js` | 34,25 | 10,25 | **4,25** | −30 | connect |
| `formcheck.js` | 22,05 | 10,05 | **7,05** | −15 | getFactionFavor |
| `bblage.js` | 19,75 | 13,75 | **12,25** | −7,5 | getCurrentWork |

## 4.3 Wer wird durch SF4.3 kaltstartfähig — und wer nicht

**Heute (SF4.1) passen 30 von 114 Dateien nicht auf ein frisches 32-GB-`home`.
Ab SF4.3 sind es nur noch 8.** Von den 22 geretteten kommen 21 allein über
den Singularity-Faktor; `wakelock.js` ist der 22. und braucht ihn gar nicht
(siehe 4.1).

**Für den Kaltstart wirklich relevant** ist aber nicht die 32-GB-Schwelle,
sondern die Nische unter ~8 GB, in der neben dem Kern noch etwas laufen kann.
Dorthin bringt SF4.3 nur drei Dateien:

| Datei | SF4.1 | SF4.3 | Bedeutung für den Kaltstart |
|---|---:|---:|---|
| `wakelock.js` | 34,25 | **4,25** | wäre kaltstartfähig — ist es mit der Namensreparatur aber schon heute (2,25) |
| `daedalus.js` | 82,75 | **7,75** | Diagnose, kein Kaltstart-Gewerk |
| `formcheck.js` | 22,05 | **7,05** | Messwerkzeug, kein Kaltstart-Gewerk |

**Befund: SF4.3 löst das Kaltstart-Problem nicht.** Die Dateien, die den
Kaltstart blockieren, sind entweder ohne Singularity-Anteil (`bn4net.js` 17,75 →
17,75; `contracts.js` 17,65 → 17,65; `sleeve.js` 27,85 → 27,85) oder haben einen
Boden, der auch bei Faktor 1 zu hoch liegt (`blade.js` 99,35). Wer auf SF4.3
wartet, wartet auf die falsche Sache.

## 4.4 Was auch bei Faktor 1 zu groß bleibt

Acht Dateien liegen ab SF4.3 weiter über 32 GB. Vier davon sind
Registry-Kandidaten und damit echte Bauaufgaben, keine Karteileichen:

| Datei | SF4.3 | Grund — und was ihn heilt |
|---|---:|---|
| `blade.js` | **99,35** | 24 Bladeburner-Funktionen = 87 GB + `getBitNodeMultipliers` 4 GB. **SF4-unabhängig.** Nur durch Aufteilen zu senken (Motor / Skillplan / Spannenrechner getrennt). Die Auftragszahl 27,6 ist unerreichbar. |
| `bn4rep.js` | **63,25** | 18 Singularity-Funktionen in einer Datei — bei Faktor 1 noch 52,5 GB. Aufteilen in Arbeits-, Spenden- und Kaufteil. |
| `travel.js` (tot §1.5) | 49,75 | eigener Bezeichner `joinFaction` (48 GB) — siehe 4.1 |
| `exit.js` | **39,25** | `destroyW0r1dD43m0n` allein 32 GB bei Faktor 1. Untere Schranke; nicht zu senken. Die Wirt-Planung wird dann aber trivial. |
| `keepalive.js` (tot §1.5) | 54,25 | 50 GB DOM (`document` **und** `window`) + `connect` |
| `bbspann.js` | 61,35 | 15 Bladeburner-Funktionen, **null Singularity** — SF4 ändert daran nichts |
| `autopilot.js` (tot §1.5) | 34,15 | 25 GB DOM-Literal |
| `graft.js` | **32,95** | knapp drüber, und Singularity ist die kleinere Hälfte: `grafting.*` 20,0 GB + `singularity.*` 7,5 + `bladeburner.stopBladeburnerAction` 2,0 |


---

# 5 Die drei Dateien, die den Kaltstart am stärksten behindern

**1. `bn4net.js` — 17,75 GB, und keine davon ist Singularity.**
Der Kern belegt allein **55 % eines frischen `home`** und ist als Einziger
dauerhaft resident. An ihm hängt jede weitere Zeile des Budgets: die beiden
Prüfsummen aus §4.4 (≤ 28 / ≤ 26) reißen oder halten je nach seiner Größe, und
alle Rangfolge-Plätze 3 bis 7 leben von dem, was er übrig lässt. SF4.3 hilft hier
**null** — der Wert ist in BN10 und in BN4 identisch 17,75. Zu senken auf
**10,75 GB**, indem die `cloud.*`-Familie (4,00) in ein eigenes Kaufskript und
die `hackAnalyze`-Familie (3,00) in eine inline-Formel wandert (Rechnung in 3.3b).
Der Auftragszielwert 12 ist damit erreichbar — aber nur durch Umbau, nicht durch
Warten.

**2. `wakelock.js` — 34,25 GB, größer als das ganze `home`.**
Rang 3 der Kaltstart-Rangfolge ist heute **nicht startbar**: 34,25 > 32. Damit
läuft der frisch gesprungene Bot ohne Drosselungsschutz, und der Kalenderfaktor
1,8-4,4 aus §4.7 trifft ihn ab der ersten Minute. Die Ursache ist kein DOM-Literal
(wie §1.4 annimmt), sondern die Namensgleichheit `connect` in
`osc.connect(gain).connect(ctx.destination)` (`wakelock.js:91`) mit
`singularity.connect`. **Von den drei Punkten ist das der einzige, der für zwei
Zeichen 32 GB zurückgibt** — auf 2,25 GB, geeicht nachgerechnet.

**3. `contracts.js` — 17,65 GB, ebenfalls ohne Singularity-Anteil.**
Die erste verlässliche Geldquelle eines frischen Knotens passt weder neben den
heutigen Kern (35,40 von 32) noch neben den abgespeckten samt Wächter und
Wakelock (38,65). Die Hälften `cdump.js` (12,00) und `csolve.js` (12,25) lösen es
nur halb: einzeln passen sie neben den 10,75-Kern, **zusammen nicht** (35,00), und
mit laufendem Wächter auch einzeln nur knapp. Auch hier ändert SF4.3 nichts —
die 15 GB stecken in `codingcontract.getContract`.

**Gemeinsamer Nenner der drei: keine hängt am Faktor 16.** Der Kaltstart wird
nicht durch Singularity teuer, sondern durch drei Dateien mit je 15-18 GB
Netscript-Grundkosten und eine versehentliche Namensgleichheit. Die im Auftrag
als „RAM-Gefangene des Faktors 16" geführten Brocken (`bn4rep.js` 850,75,
`bn4life.js` 293,85, `homegrow.js` 148,5, `bn4door.js` 99,85, `bbtrain.js` 94,75)
sind für die **ersten 32 GB** ohne Belang — sie werden erst gebraucht, wenn `home`
längst gewachsen ist oder eine Werkbank steht.

**Ehrenhalber genannt, außerhalb der ersten 32 GB:** `blade.js` (174,35 GB, ab
SF4.3 immer noch 99,35) ist der Träger der Route und in BN10 unverzichtbar. Er
blockiert nicht den Kaltstart, sondern die Zeit **danach** — bis `home` oder eine
Werkbank 176 GB trägt, steht der Bladeburner still. Und `exit.js` (519,25) braucht
einen 1024-GB-Wirt, bevor die Tür überhaupt aufgeht.

---

## Anhang: Belege und Werkzeuge

- Rohmessung (114 × `calculateRam` gegen LIVE, 04.09.2026 01:37:53-01:38:05):
  `…/scratchpad/ram-messung.json`, erzeugt von `…/scratchpad/measure-ram.js`
- Nachbau des Spiel-RAM-Rechners: `…/scratchpad/ramcalc.js`
- Eichung 114/114: `…/scratchpad/eichung.js` → `…/scratchpad/ram-final.json`
- Einzelproben (`location.reload`, Wächtergrößen, `wakelock` ohne `connect`):
  `…/scratchpad/proben.js`
- Kollisionssuche: `…/scratchpad/kollision.js`
- Kaltstart-Rechnung: `…/scratchpad/kaltstart.js`
- Quellcode-Belege: `reference/v301/src/Netscript/RamCostGenerator.ts:10-13,81-95,157-222`,
  `reference/v301/src/Script/RamCalculations.ts:162-259,307-530`,
  `reference/v301/src/Prestige.ts:245-252`

Es wurde ausschließlich lesend auf das Spiel zugegriffen (`calculateRam`,
`getFileNames`, `/api/state`, `tools/save.js`). Kein `pushFile`, kein
`deleteFile`, keine Änderung unter `src/`.
