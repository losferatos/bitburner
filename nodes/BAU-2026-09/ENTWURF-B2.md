# ENTWURF B2 — Der Schnitt aus der Sicht des Kaltstarts

**Architekt B2, 04.09.2026, 02:33–03:5x Ortszeit (`date`).** Rolle laut Auftrag:
den Schnitt der NEUEN Teile festlegen (Registry, Waechter, Figur-Vergabepunkt,
Kaltstart-Kern, Motorzeit, Backup-Handshake) und je vorhandenem Modul entscheiden,
ob eine MESSUNG einen Eingriff erzwingt. Die Bauform aus `AUFTRAG-BAU-2026-09.md`
§4 bleibt; sie steht hier nicht zur Debatte.

**Leitgedanke.** Jeder Restlauf beginnt mit einem frischen `home`. Was in diesem
Zustand nicht startet, existiert nicht. Der Kaltstart ist keine Phase, sondern die
Randbedingung, aus der sich der ganze Schnitt ergibt.

**Eichung des Rechenwegs (Pflicht aus CLAUDE.md).** Jede RAM-Zahl unten stammt aus
dem Kostenbaum in `reference/v301/src/Netscript/RamCostGenerator.ts:10-53,157-225`,
als Rechnung nachgebaut und gegen **vier unabhaengig gemessene Dateien** geeicht —
alle vier auf 0,00 GB genau:

| Datei | Funktionen | gerechnet | gemessen (`doku/ram-budget.md`) |
|---|---|---:|---:|
| `sleevecrime.js` | 1,6 + sleeve 4,0 + getResetInfo 1,0 + scp 0,6 + ps 0,2 + scan 0,2 + getHostname 0,05 | 7,65 | **7,65** |
| `cdump.js` | 1,6 + getContractType 5,0 + getData 5,0 + ls 0,2 + scan 0,2 | 12,00 | **12,00** |
| `csolve.js` | 1,6 + attempt 10,0 + scp 0,6 + getHostname 0,05 | 12,25 | **12,25** |
| Waechter-Satz aus `ram-budget.md` §2.2 | 13 Funktionen + `globalThis["docu"+"ment"]` | 7,00 | **7,00** |

Damit sind die nicht messbaren Zellen unten (Kern nach Diaet, Waechter, schlanke
Gewerke) belastbar. Es wurde ausschliesslich **lesend** auf das Spiel zugegriffen
(`getSaveFile`, `/api/state`); kein `pushFile`, kein `deleteFile`, keine Aenderung
unter `src/`.

---

# 0 Sechs Korrekturen an den Vorgaben — vor jeder Planung

Diese sechs Befunde aendern die Aufgabe selbst. Sie stehen zuerst, weil jede
spaetere Zahl auf ihnen ruht.

### K1 — Der 16er-Faktor betrifft **2 von 40** Laeufen, nicht 30

Der Auftragstext an mich sagt: „30 der 40 Restlaeufe laufen mit SF4.1 oder SF4.2.
Der 16er-Fall ist NICHT der Sonderfall." Das ist eine Verwechslung von **30 Dateien
ueber 32 GB** (`ram-budget.md` §1) mit 30 Laeufen.

Simuliert ueber `src/route.json` mit dem gemessenen SF-Stand
`{1:1, 4:1, 5:1, 6:1, 10:1}` und den Regeln
`RamCostGenerator.ts:82-96` (`bitNodeN === 4` → Faktor 1; `sf4 <= 1` → ×16;
`sf4 === 2` → ×4; sonst ×1) und `RedPill.tsx:24-38` (Zerstoerung hebt SF um 1):

| Position | Knoten | home | SF4-Faktor | Sleeves | shock/sync | Hacknet-Server | Mietrechner |
|---|---|---:|---:|---:|---|---|---|
| 1 | BN10 L2 *(laeuft)* | 32 | **×16** | 2 | 25 / 25 | nein | ja |
| 2 | BN10 L3 | 32 | **×16** | 3 | 25 / 25 | nein | ja |
| 3 | BN4 L2 | 32 | ×1 | 3 | 100 / 1 | nein | ja |
| 4 | BN4 L3 | 32 | ×1 | 3 | 100 / 1 | nein | ja |
| 5 | BN9 L1 | 32 | ×1 | 3 | 100 / 1 | **ja** | **NEIN** |
| 6 | BN9 L2 | 32 | ×1 | 3 | 100 / 1 | ja | **NEIN** |
| 7 | BN9 L3 | **128** | ×1 | 3 | 100 / 1 | ja | **NEIN** |
| 8–40 | Rest | 128 | ×1 | 3 | 100 / 1 | ja | ja |

- **Kaltstarts auf 32 GB: 6** (Positionen 1–6). Ab Position 7 startet `home` mit
  **128 GB** — `Prestige.ts:246-252`: `activeSourceFileLvl(9) >= 2 → setMaxRam(128)`,
  und SF9.2 faellt nach Position 6.
- **Kaltstarts mit ×16: 2** (Positionen 1 und 2, beide BN10). Position 3 und 4
  liegen **in** BN4, wo der Faktor per Definition 1 ist; ab Position 5 steht SF4
  auf 3.
- **Kaltstarts mit ×4: null.** SF4 springt beim Verlassen von BN4 L2 auf 2, aber der
  einzige Lauf danach mit SF4=2 ist Position 4 — und der liegt in BN4. Der ×4-Fall
  tritt auf der Restroute **nie** ein. Jede Zeile, die eine SF4.2-Spalte pflegt, ist
  toter Code.

**Folge fuer die Frage „zwei Betriebsarten oder eine": eine.** Siehe §3.

### K2 — Nach jedem Sprung ist **NUKE.exe** das einzige Programm

`ServerHelpers.ts:224-234`: `homeComp.programs.length = 0`, danach wird genau
`NUKE.exe` zurueckgelegt (plus BitFlume, falls vorhanden). Alle fuenf Portknacker
sind weg. Der frisch gesprungene Bot kann **nur 0-Port-Server rooten**.

Neu beschaffen geht ueber den Darkweb-Kauf. Mit Singularity kostet das
`purchaseTor` (Fn1 = 2 GB) und `purchaseProgram` (Fn1 = 2 GB) — bei ×16 sind das
**32 GB je Funktion**, ein Skript mit beiden kaeme auf 65,6 GB und passt in
Position 2 nicht auf `home`. Mit `src/darkweb.js` kostet dasselbe **2,65 GB**
(gemessen), weil die Datei ueber `globalThis["docu"+"ment"]` das Terminal bedient
(`darkweb.js:53`). Preise: TOR 200k, BruteSSH 500k, FTPCrack 1,5 Mio, relaySMTP
5 Mio, HTTPWorm 30 Mio, SQLInject 250 Mio (`DarkWebItems.ts:6-11`,
`Constants.ts:44`).

**`darkweb.js` ist damit das wichtigste Kaltstart-Werkzeug im ×16-Fall** — und es
steht im Auftrag §1.3 mit einer um Faktor 10 zu hohen Zahl (27,65 statt 2,65) und
taucht in der Kaltstart-Rangfolge §4.4 ueberhaupt nicht auf.

### K3 — Vertraege sind ohne Root, ohne Portknacker, ohne Singularity erreichbar

`NetscriptFunctions.ts:840-858` (`ns.ls`) und
`NetscriptFunctions/CodingContract.ts:13-21` (`getCodingContract`) pruefen **keine
Adminrechte**. `ns.scan` ebenso wenig. Der Bot kann ab Minute 1 jedes `.cct` im
ganzen Netz lesen, loesen und kassieren, obwohl er nur `NUKE.exe` besitzt.

Das ist der Grund, warum §4 unten die Vertraege auf Platz 1 setzt und nicht die
Weaken-Farm: die Farm braucht geroootete Wirte, die Vertraege nicht.

### K4 — Die Sleeves sind in 34 von 36 Kaltstarts wertlos, und die Ursache ist kaufbar

`PlayerObjectGeneralMethods.ts:143-156`:

```
this.sleeves.forEach((sleeve) => sleeve.prestige());        // shock 100, sync = max(memory,1), exp 0
if (this.bitNodeN === 10) {                                  // NUR beim Eintritt in BN10
  this.sleeves[i].shock = Math.min(25, ...);
  this.sleeves[i].sync  = Math.max(25, ...);
}
```

`RedPill.tsx:66` setzt `Player.bitNodeN = newBitNode` **vor** `prestigeSourceFile()` —
gemeint ist also der **neue** Knoten. Die Gnadenregel greift nur bei den
Positionen 1 und 2.

Der Spieler bekommt von einem Sleeve `Basis-EXP × shockBonus × sync/100`
(`Sleeve/Work/Work.ts:17-25`, `Sleeve.ts:173-179`). Beide Faktoren stehen nach dem
Sprung ausserhalb BN10 auf dem Minimum. Gemessen am Live-Stand: **`memory = 1`
bei beiden Sleeves** (aus `getSaveFile` gelesen, 04.09.).

EXP an den Spieler je Sleeve (Gym-Basis 10 exp/s, Sleeve auf Shock-Recovery):

| memory | 0 h | 1 h | 3 h | 6 h | 12 h | 18 h |
|---:|---:|---:|---:|---:|---:|---:|
| 1 (heute) | 0 | 0,01 | 0,02 | 0,03 | 0,07 | 0,10 |
| 25 | 0 | 0,14 | 0,41 | 0,81 | 1,63 | 2,44 |
| 100 | 0 | 0,54 | 1,63 | 3,25 | 6,50 | 9,76 |

Shock 100 → 25 dauert auf Recovery **13,8 h**, → 0 **18,4 h**
(`Sleeve.ts:269-272` 0,0001/Zyklus Grundabbau + `SleeveRecoveryWork.ts:13-17`
0,0002/Zyklus). Sync 1 → 25 per Synchronize dauert **6,4 h**, → 100 **26,6 h**
(`SleeveSynchroWork.ts:14-17`, Spieler-Intelligenz 106 gemessen).

**Damit ist Auftrag §3.3 falsch kalibriert.** Die dortigen „mit 3 Sleeves 13,9 h"
fuer `t_gate` unterstellen shock 0 und sync 25 — einen Zustand, den ein frischer
Knoten ausserhalb BN10 erst nach ueber 13 h Spielzeit erreicht, und mit `memory = 1`
gar nicht. Der belastbare Kaltstart-Wert ausserhalb BN10 ist **die Figur allein,
45.400 exp/h**.

**Was das kostbar macht:** `sleeve.memory` ueberlebt jeden Sprung (es steht in
keiner Reset-Liste) und setzt per `sync = Math.max(memory, 1)` den Sync-Boden jedes
kuenftigen Knotens. Kaufbar ist es **nur in BN10 und nur als Mitglied von
The Covenant** (`SleeveCovenantPurchases.tsx:86-98`). Kosten
(`Sleeve.ts:198-212`, `1e12 × Σ 1,02^k`):

| Ziel | je Sleeve | ×3 |
|---|---:|---:|
| memory 25 | 30,4 Bio $ | 91,3 Bio $ |
| memory 50 | 81,9 Bio $ | 245,8 Bio $ |
| memory 100 | 305,1 Bio $ | 915,4 Bio $ |

Dazu: ein Covenant-Sleeve kostet `10^k × 10 Bio`, maximal 5
(`SleeveCovenantPurchases.tsx:13-27`), und `sleevesFromCovenant` ueberlebt
ebenfalls jeden Sprung — er addiert sich **auf** die `min(3, SF10 + …)`-Zahl
(`:58-72`). Kontostand 04.09.: **17,25 Bio $**. Der erste Covenant-Sleeve ist heute
bezahlbar und gilt fuer alle 38 Restlaeufe.

**Die Tuer schliesst am Ende von Position 2.** Danach kommt der Bot nie wieder nach
BN10. Das ist der einzige Posten im ganzen Plan mit einer unwiderruflichen Frist.

### K5 — Hashes sind vor Position 5 keine Kaltstart-Geldquelle

Auftrag §4.4 fuehrt in der Rangfolge auf Platz 4 „Geldquellen (Hashes,
Sleeve-Verbrechen, Weaken-Farm)". Hashes setzen Hacknet-**Server** voraus:
`HacknetHelpers.tsx:34-36` — `canAccessBitNodeFeature(9)`, also SF9 ≥ 1 **oder**
BN9. In den Positionen 2, 3 und 4 ist beides falsch. `hashes.js` (5,95 GB) laeuft
dort ins Leere.

Ab Position 5 dagegen legt `Prestige.ts:338-345` in Minute 0 einen fertigen
Gratis-Server hin (level 100, cores 10, cache 5). Hashrate nach
`Hacknet/formulas/HacknetServers.ts:4-17`:
`0,001 × 100 × 1,07^log2(1) × (1 + 9/5) × 1 × HacknetNodeMoney` = **0,28 Hash/s**
bei Faktor 1 — bei 4 Hashes je Mio $ sind das **70.000 $/s ab Minute 0**. Das
reproduziert die Zahl aus Auftrag §3.3 exakt und ist damit der fuenfte Eichpunkt
dieses Entwurfs.

### K6 — BN9 hat keine Mietrechner, und es sind drei Laeufe hintereinander

`BitNode.tsx` (extrahiert in `nodes/BAU-2026-09/bitnodes.json`): BN9 hat
`CloudServerLimit 0`, `HomeComputerRamCost 5`, `ServerMaxMoney 0,01`,
`ScriptHackMoney 0,1`, `HackExpGain 0,05`.

Damit fallen in den Positionen 5, 6 und 7 gleichzeitig aus: der Rechnerkauf, die
Kaltstart-Leiter (`bn4net.js:733-749`), die Werkbank-Beschaffung, die
Raeumkette fuer den `exit.js`-Wirt (§4.4 Schritt 3) und die Hacking-Geldquelle
(0,1 × 0,01 = ein Tausendstel des Normalen). Der `home`-Ausbau kostet 5×
(32 → 64 GB = 50,41 Mio $; 32 → 128 GB = 209,7 Mio $).

Heute hat der Bot fuer keinen dieser Faelle einen Zweig. Positionen 5–7 sind vier
Laeufe entfernt.

---

# 1 Die Kaltstart-Rechnung

## 1.1 Antwort auf den offenen Punkt A.4

Auftrag §4.4 nennt drei Schwellen: `resident nur Kern und Waechter, <= 20 GB`,
`resident <= 26` und `Kern + Waechter + boot.js <= 28`. Der heutige Stand reisst
die 20 um 5,75 GB.

**Mein Urteil: die Schwelle wird nicht korrigiert. Der Kern wird kleiner. Und der
Waechter muss nicht geteilt werden.**

Gerechnet, mit dem geeichten Kostenbaum:

| Variante | Kern | Waechter | resident | ≤ 20? | + boot 5,50 | ≤ 28? | frei fuer Gewerke |
|---|---:|---:|---:|---|---:|---|---:|
| **A** heute | 17,75 | 8,00 | 25,75 | **reisst um 5,75** | 31,25 | **reisst um 3,25** | 6,25 |
| **B** Diaet + voller Waechter | 11,05 | 7,00 | 18,05 | haelt (1,95 Luft) | 23,55 | haelt | 13,95 |
| **C** Diaet + schlanker Waechter | **11,05** | **5,80** | **16,85** | **haelt (3,15 Luft)** | 22,35 | **haelt** | **15,15** |

Variante C ist die Empfehlung, und der Grund ist nicht Aesthetik, sondern eine
Rechnung: **unter Variante B passen Wakelock und die Vertragskette nicht
gleichzeitig.** 18,05 + 2,25 (Wakelock repariert) = 20,30, frei bleiben 11,70 —
`cdump.js` braucht 12,00, `csolve.js` 12,25. Beide reissen um 0,30 bzw. 0,55 GB.
Der Bot muesste zwischen Drosselungsschutz und seiner einzigen Geldquelle waehlen.
Unter Variante C: 16,85 + 2,25 = 19,10, frei 12,90 — `csolve.js` passt mit 0,65 GB
Rest. **0,55 GB entscheiden ueber den Kalenderfaktor 1,8–4,4 aus §4.7.**

Woraus die 5,80 des Waechters bestehen (und was gegenueber dem in `ram-budget.md`
§2.2 gemessenen 7,00-Satz wegfaellt):

```
Base 1,60 + getPlayer 0,50 + ps 0,20 + kill 0,50 + exec 1,30
          + scp 0,60 + getServerMaxRam 0,05 + getServerUsedRam 0,05   = 5,80
weg: run 1,00 (exec deckt es), getResetInfo 1,00 (der Kern veroeffentlicht
     nodeReset in einer Datei, ns.read kostet 0), fileExists 0,10 und
     isRunning 0,10 (ps beantwortet beides)
globalThis["docu"+"ment"] fuer S4: 0 GB (RamCalculations.ts:183-192)
globalThis["location"].reload() fuer Sprosse 4a: 0 GB (gemessen, ram-budget.md §2.2)
```

Ohne `scriptKill` (Sprosse 1/3 killt per `ps` + `kill(pid)`) sind es **4,80 GB**.
Der Endwert ist nach dem Bau zu messen; 5,80 ist die Planungszahl.

## 1.2 Wer nimmt ab, und worauf verzichtet er

**`bn4net.js` 17,75 → 11,05 GB.** Die Kostenaufstellung des Kerns
(`ram-budget.md` §3.3b, gegengerechnet):

| Posten | GB | bleibt? |
|---|---:|---|
| Base | 1,60 | ja |
| `cloud.getServerNames/purchaseServer/upgradeServer/getServerCost/getServerUpgradeCost/getServerLimit/getRamLimit` | **4,00** | **nein** |
| `hackAnalyze` + `hackAnalyzeChance` + `growthAnalyze` | **3,00** | **nein** |
| `getServer` | 2,00 | ja |
| `exec` 1,3 · `scriptKill` 1,0 · `getResetInfo` 1,0 · `scp` 0,6 · `kill` 0,5 · `getPlayer` 0,5 | 4,90 | ja |
| Portknacker (5 × 0,05) · `nuke` · `scan` · `ps` · `ls` · Rest | 2,25 | ja |
| **neu** `getScriptRam` 0,1 · `getServerMaxRam` 0,05 · `getServerUsedRam` 0,05 · `isRunning` 0,10 | +0,30 | ja |

= **11,05 GB**. Zielwert §4.4 ist 12; es bleibt 0,95 GB Luft fuer den
Registry-Starter und die Motorzeit (beide kosten keine neuen ns-Funktionen).

**Die Funktionen, die wegfallen, und was sie mitnehmen:**

1. **`ns.cloud.*` (4,00 GB) → `shop.js`, 7,60 GB, vom Kern gestartet und beendet.**
   Der Kern verliert die *Ausfuehrung* von Rechnerkauf, Rechnerausbau und der
   Kaltstart-Leiter, behaelt die *Entscheidung*: er schreibt `data/buy-request.json`
   (`{ram, maxPrice, grund, nodeReset}`), startet `shop.js`, wartet auf
   `data/park.json` und beendet es. In BN9 (Positionen 5–7) wird `shop.js` nie
   gestartet — `CloudServerLimit 0`.
   *Verlust ohne Ersatz:* keiner. Der erste Mietrechner ist Rangfolgeplatz 6, nicht 1.
   *Was ersetzt werden muss:* „welche Rechner gehoeren mir" kam aus
   `cloud.getServerNames`. Ersatz: `ns.scan("home")` + `ns.getServer(h).purchasedByPlayer`
   — beide bereits bezahlt, 0 GB zusaetzlich.
2. **`hackAnalyze` + `hackAnalyzeChance` (2,00 GB) → inline.** Beide Werte sind aus
   `ns.getServer()` + `ns.getPlayer()` rechenbar, und beide Aufrufe bleiben im Kern.
   Das ist eine Reimplementierung, kein Faehigkeitsverlust. `lib/calc.js` darf dabei
   **nicht** importiert werden (`bn4net.js:3228-3234`) — der Import zoege die Kosten
   zurueck.
3. **`growthAnalyze` (1,00 GB) → ersatzlos.** Es ist unbrauchbar
   (`ServerHelpers.ts:69`), und `growFaeden()` rechnet ohnehin per Newton
   (`bn4net.js:3195-3216`).

**`boot.js` bleibt bei 5,50 GB.** Die §4.4-Forderung „≤ 4,0" ist entbehrlich: mit
der Kerndiaet steht die Spitze bei 22,35 ≤ 28. Die 4,0 im Auftrag ist ohnehin
falsch gemessen (`ram-budget.md` §2.1).

**`wakelock.js` 34,25 → 2,25 GB, Aufwand zwei Zeichen.** `wakelock.js:91` lautet
`osc.connect(gain).connect(ctx.destination)`. Das ist Web Audio; der RAM-Rechner
loest nur den nackten Namen auf (`RamCalculations.ts:216-243`), findet
`singularity.connect` (Fn1 = 2 GB) und stellt bei ×16 **32 GB** in Rechnung. Mit
`osc["con"+"nect"](gain)["con"+"nect"](ctx.destination)` faellt die Datei auf 2,25.
Heute ist sie **groesser als das ganze `home`** und im Kaltstart nicht startbar.

## 1.3 Was laeuft in Minute 1, in Minute 10, ab der ersten Werkbank

**Minute 1** (`home` 32 GB, 1 Kern, 1.262 $ — `PlayerObjectGeneralMethods.ts:102`
plus `Constants.ts:107` Donations 262):

| | GB | kumuliert | frei |
|---|---:|---:|---:|
| `boot.js` (Autoexec) | 5,50 | 5,50 | 26,50 |
| → startet `guard.js` | 5,80 | 11,30 | 20,70 |
| → startet `core.js` | 11,05 | 22,35 | 9,65 |
| `boot.js` gibt frei, sobald der Kern laeuft (`boot.js:163-168`) | −5,50 | **16,85** | **15,15** |

Der Kern rootet in derselben Runde alle 0-Port-Server mit `NUKE.exe` (K2) und
setzt `worker/weaken.js` (1,80) in den Rest. Er startet **`darkweb.js` (2,65)**,
sobald 200k auf dem Konto sind — TOR und BruteSSH oeffnen die naechste
Server-Klasse.

**Minute 1 bis 10** — Rotation, kein Nebeneinander. Frei sind 15,15 GB:

| Slot | Inhalt | GB | Rest von 15,15 |
|---|---|---:|---:|
| dauerhaft | `wakelock.js` (repariert) | 2,25 | 12,90 |
| Takt A | `cdump.js` — scannt das ganze Netz nach `.cct`, schreibt `data/contracts.json`, endet | 12,00 | 0,90 |
| Takt B | `csolve.js` — loest und kassiert, endet | 12,25 | 0,65 |
| Takt C | `sleevecrime.js` schlank (6,60) + `popups.js` (3,30) + `darkweb.js` (2,65) | 12,55 | 0,35 |

`cdump` und `csolve` laufen **nacheinander**, nie gleichzeitig (24,25 zusammen
passen nirgends). Das ist kein Notbehelf: die beiden Haelften existieren bereits
und sind laut Auftrag §1.3 ungenutzt.

**Minute 10 bis erste Werkbank:** dazu `shop.js` (7,60) sobald die Kaltstart-Leiter
feuert, und `sleevecrime.js` durchgehend. `ausgang.js` (8,15) laeuft im Kaltstart
**nicht** dauerhaft — der Kern prueft die billigen Tuerbedingungen selbst (Verfahren
aus `data/verfahren.txt`, Rang bzw. Hacking-Level aus `getPlayer`, Wirt aus
`getServer`) und startet es erst, wenn die Tuer in Reichweite ist.

**Ab der erste Werkbank** kippt das Bild vollstaendig: `home` bleibt bei 32 GB
(resident + eine Rotation), alles RAM-Teure zieht auf die Werkbank —
`blade.js` (174,35 bzw. 99,35), `contracts.js` (17,65 statt der Haelften),
`sleeve.js` (27,85), `hacknet.js` (9,45), spaeter `graft.js` (145,45 / 32,95) und
`bn4rep.js` (850,75 / 63,25). Der Kern bleibt auf `home`, weil er den Park
verwaltet; der Waechter darf mit auf die Werkbank, sobald es zwei Wirte gibt
(Sprosse 2 wird erst dann ueberhaupt ausfuehrbar).

---

# 2 Modulschnitt aus der RAM-Sicht

**Kriterium: was muss IMMER laufen, damit der Bot nicht stirbt?** Der Bot stirbt an
genau vier Dingen, und nur die ersten beiden rechtfertigen Residenz.

| Todesart | Beleg | Wer verhindert sie |
|---|---|---|
| Kein Skript laeuft mehr — von aussen kann niemand eines starten | §4.5 „kein run/exec/kill"; C.12 | **resident: `boot.js` → `guard.js` → `core.js`** |
| Der Kern zaehlt, wirft aber jede Runde (`errStreak`) | `bn4net.js:391-392,3167-3170`; S6 | **resident: `guard.js`** |
| Konto < 0 — jeder Kauf liefert `false` | Auftrag §3.2 `negative_balance_min` | Gewerk (nur die Sleeves koennen im ×16-Kaltstart ueberhaupt Geld ausgeben) |
| Tuer offen, kein Wirt fuer `exit.js` | `ausgang.js:333-346` | Kern (Entscheidung) + `shop.js` (Ausfuehrung) |

## 2.1 Der residente Kern — was hineingehoert

- **Rundenfunktion `round(ns, state)`** als reine Funktion, getrennt von der
  Schleife (§4.1). Zwei Zustaende, nicht zwei Zweige: `kaltstart` (kein eigener
  Rechner) und `normal`.
- **Rooten und Arbeiterplatzierung.** Portknacker sind 0,05 GB je Stueck; ohne sie
  gibt es keine Wirte, und ohne Wirte nichts.
- **Registry-Starter.** Start, Stopp, Platzierung, Budgettest, Marker-Pruefung und
  Stillstand aus genau einer Tabelle (`registry.json`).
- **Herzschlag und Motorzeit.** Der Waechter liest sie; ohne sie ist S1 und S3a
  blind.
- **Entdopplung** (juengste PID gewinnt, `bn4net.js:2741-2760`) — muss immer laufen,
  weil jeder Neustart eine Doppelinstanz erzeugen kann.
- **Figur-Vergabepunkt: nur die ENTSCHEIDUNG.** Der Kern liest
  `data/figure-request-<tool>.json`, wendet die Rangfolge Graft > Bladeburner >
  Faktionsarbeit > Gym > Verbrechen an und schreibt `data/figure.txt`. Das kostet
  0 GB (`ns.read`/`ns.write` sind kostenlos). Die **Ausfuehrung** liegt beim
  Besitzer und ist ausnahmslos Singularity — `gymWorkout` Fn1 = 32 GB bei ×16,
  `commitCrime` Fn3 = **80 GB**, `workForFaction` Fn2 = 48 GB. Der Kern darf keine
  davon anfassen, sonst ist er im ×16-Kaltstart nicht startbar.
- **Vetos.** Geldboden, `bn4-stop`, Endspurt-Reserve: der Kern setzt Flags, andere
  fuehren aus.

## 2.2 Was ein Gewerk ist — und die Regel, die 1 GB je Gewerk spart

Alles andere. Der Kern startet und beendet es. Zwei Regeln, beide gerechnet:

> **R1 — Kein Gewerk ruft `ns.getResetInfo()`.** Der Kern veroeffentlicht
> `nodeReset`, `augReset` und `motorTimeMs` in `data/pulse.json`; Gewerke lesen sie
> (`ns.read` = 0 GB). Ersparnis: **1,00 GB je Gewerk**. Bei sechs Kaltstart-Gewerken
> sind das 6 GB — mehr als der ganze Waechter.

> **R2 — Kein Bezeichner im neuen Bot heisst wie eine Netscript-Funktion.**
> Die 64 Singularity-Namen kosten bei SF4.1 zwischen 1,6 und 512 GB, ohne dass ein
> `ns`-Aufruf im Spiel ist (`RamCalculations.ts:216-243`). Belegte Opfer:
> `wakelock.js` und `keepalive.js` (`connect`, je 32 GB), `travel.js`, `probe.js`,
> `joinfac.js` (`joinFaction`, je 48 GB). Das gehoert als Grep-Verbot in den
> Pruefstand aus §6.1.

## 2.3 Die Gewerkeliste des Kaltstarts, nach Prioritaet

| Prio | Gewerk | GB | ab Position | Bemerkung |
|---:|---|---:|---|---|
| 1 | `wakelock.js` (repariert) | 2,25 | 1 | Drosselungsschutz; kein Lebensretter, aber der groesste Zeithebel |
| 2 | `cdump.js` / `csolve.js` (Rotation) | 12,25 | 1 | einzige nennenswerte Geldquelle der Positionen 1–4 |
| 3 | `darkweb.js` | 2,65 | 1 | einziger bezahlbarer Weg zu den Portknackern bei ×16 |
| 4 | `sleevecrime.js` schlank | 6,60 | 1 | 7,65 minus `getResetInfo` nach R1 |
| 5 | `popups.js` | 3,30 | 1 | Dialoge, Einladungen; muss vor dem Schliessen den Text lesen (§5.3) |
| 6 | `hashes.js` | 5,95 | **5** | vorher wirkungslos (K5) |
| 7 | `shop.js` (neu, `cloud.*`) | 7,60 | 1, nicht in BN9 | Kaltstart-Leiter und Werkbankkauf |
| 8 | `werkbank.js` | 2,90 | 1 | |
| 9 | `ausgang.js` | 8,15 | 1 | nur wenn die Tuer in Reichweite ist |
| 10 | `worker/weaken.js` u. a. | 1,80 je Faden | 1 | EXP, kein Geld |

---

# 3 Der 16er-Faktor: **eine** Betriebsart, nicht zwei

**Entscheidung: eine.** Begruendung in drei Schritten, jeder gerechnet.

**Schritt 1 — der Faktor betrifft 2 Laeufe, nicht 30 (K1).** Nach Position 2 ist er
fuer immer weg. Zwei Betriebsarten fuer zwei Laeufe zu bauen und dann 38 Laeufe lang
mitzuschleppen, waere schon oekonomisch falsch.

**Schritt 2 — der Kaltstart-Kern ist per Auftrag §4.1 singularityfrei.** Damit ist
er vom Faktor **per Konstruktion** unberuehrt. Der einzige Unterschied zwischen
×16 und ×1 liegt in den Gewerken, und der ist in `registry.json` eine **Zahl**, kein
Zweig: das Feld `ramGb` traegt je SF4-Stufe einen gemessenen Wert, der Budgettest
des Kerns vergleicht `ns.getScriptRam(name)` (0,1 GB, zur Laufzeit) gegen den freien
Platz. Ein Werkzeug, das nicht passt, wird nicht gestartet — daraus wird
`werkzeugWartetGb` (`bn4net.js:3013`) und ein Ausbauwunsch, kein Hänger.

**Schritt 3 — SF4.3 loest das Kaltstart-Problem ohnehin nicht.** Die drei Dateien,
die den Kaltstart blockieren, tragen **null** Singularity-Kosten
(`ram-budget.md` §4.3, §5): `bn4net.js` 17,75 → 17,75, `contracts.js` 17,65 → 17,65,
`sleeve.js` 27,85 → 27,85. Und `blade.js` faellt nur von 174,35 auf 99,35 — auch
das ist dreimal ein frisches `home`. **Wer auf SF4.3 wartet, wartet auf die falsche
Sache.**

**Was das kostet.** Eine Betriebsart heisst: der Bot behandelt Position 2 nicht als
Sonderfall, sondern faehrt dort dieselbe Rangfolge mit anderen Zahlen. Der Preis
ist, dass die zwei ×16-Laeufe **langsamer** sind, als ein handoptimierter
Sonderpfad sie machen koennte:

| Nachteil in Position 2 | Ausmass | Ersatz in der einen Betriebsart |
|---|---|---|
| Figur kann weder ins Gym (32 GB) noch aufs Verbrechen (80 GB) noch in eine Faktion (48 GB) | die gesamte `t_gate`-Phase liegt still, bis die Werkbank steht | Sleeves uebernehmen das Verbrechen (Sleeve-API 4 GB **flat, nicht SF4-skaliert** — `RamCostGenerator.ts:396-419`) |
| Kein `installBackdoor`, kein `connect` (je 32 GB) | Faktionsserver-Backdoors erst ab Werkbank | `popups.js` fuer Einladungen; Backdoors sind in V2 nicht auf dem kritischen Pfad |
| Kein `upgradeHomeRam` (48 GB) | `home` bleibt 32 GB bis zur Werkbank | Mietrechner ueber `shop.js` (kein Singularity) |
| `exit.js` 519,25 statt 39,25 | 1024-GB-Wirt fuer 412,29 Mio $ statt 64 GB fuer 3,52 Mio | §5 |

Diese Nachteile sind **nicht wegcodierbar** — sie sind der Faktor. Ein zweiter
Betriebsmodus koennte sie nicht aufheben, nur anders verwalten. Deshalb: eine
Betriebsart, und die zwei ×16-Laeufe zahlen den Preis in Zeit.

---

# 4 Was im Kaltstart Geld bringt — Ertrag je GB, gerechnet

## 4.1 Die Rechnung

**Vertraege.** Belohnung
`75e6 × difficulty × CodingContractMoney × (rewardScaling/3)`
(`PlayerObjectGeneralMethods.ts:558-562`). Vier Belohnungstypen zu je 25 %
(`ContractGenerator.ts:178-188`, Enum-Reihenfolge geprueft in `Contract.ts:12-17`).
Im frischen Knoten sind `Player.factions` und `Player.jobs` leer
(`PlayerObjectGeneralMethods.ts:107,111`), also faellt **jeder** Typ auf Geld
zurueck — aber je Rueckfallstufe mit einer weiteren Drittelung, weil der rekursive
Aufruf `adjustedScaling` als neues `rewardScaling` uebergibt (`:511,517,538`):

```
Erwarteter Anteil = 1/4·(1/3) + 2/4·(1/9) + 1/4·(1/27) = 0,148148
Schwierigkeitsmittel ueber alle 30 Typen d = 4,2333   (maxDif = 2·SumSF+1 = 13, deckt alle)
Geld je Vertrag = 75e6 × 4,2333 × 0,148148 × CodingContractMoney = 47,04 Mio × CCM
Rate = 3 Versuche je 10 min × p 0,25 = 4,5 Vertraege/h Spielzeit
       (engine.tsx:210-213, ContractGenerator.ts:16-45)
```

**Sleeve-Verbrechen.** Frischer Sleeve: alle Werte 1, `mults` 1
(`Sleeve.ts:227-256`). Erfolgschance `Crime.ts:120-136`, Geld
`Work/Formulas.ts:58-78` — und **Geld wird nicht vom Shock gedaempft**
(`scaleWorkStats(..., shockBonus, false)`, `WorkStats.ts:49-62`). Ueber alle
12 Verbrechen gerechnet gewinnt bei Werten 1 eindeutig **Shoplift**:

| Verbrechen | p | $/s je Sleeve (BN10) |
|---|---:|---:|
| shoplift | 4,33 % | **162,4** |
| mug | 2,11 % | 95,1 |
| robStore | 1,86 % | 61,8 |
| homicide | 0,53 % | 39,4 |

## 4.2 Die Rangfolge

| Knoten | Quelle | GB | $/s | **$/(s·GB)** |
|---|---|---:|---:|---:|
| **BN10** (Pos. 1–2) | Vertraege `cdump`+`csolve` | 12,25 | 29.398 | **2.400** |
| | Vertraege `contracts.js` | 17,65 | 29.398 | 1.666 |
| | Figur-Verbrechen (nicht startbar bei ×16) | 80,0 | 162 | 2 |
| | Sleeve-Verbrechen ×3 | 7,65 | 487 | 64 |
| | Hack-Farm `home`, 6 Faeden (Modell) | 10,50 | 175 | 17 |
| | Hashes | 5,95 | **0** | **0** |
| **BN4** (Pos. 3–4) | Vertraege `cdump`+`csolve` | 12,25 | 58.796 | **4.800** |
| | Sleeve-Verbrechen ×3 | 7,65 | 195 | 25 |
| | Hack-Farm (ScriptHackMoney 0,2 · ServerMaxMoney 0,1125) | 10,50 | 8 | 1 |
| | Hashes | 5,95 | **0** | **0** |
| **BN9** (Pos. 5–6) | **Hashes (Gratis-Server ab Minute 0)** | 5,95 | 70.000 | **11.765** |
| | Vertraege `cdump`+`csolve` | 12,25 | 58.796 | 4.800 |
| | Sleeve-Verbrechen ×3 | 7,65 | 487 | 64 |
| | Hack-Farm (0,1 · 0,01) | 10,50 | ~0 | ~0 |

**Ergebnis, gegen den Auftragstext gehalten.** §4.4 nennt auf Rang 4 „Hashes,
Sleeve-Verbrechen, Weaken-Farm" und die Vertraege erst auf Rang 5. Gerechnet ist
die Reihenfolge in den Positionen 1–4 **genau umgekehrt**: Vertraege sind
zwischen 38× und 190× ertragreicher je GB als alles andere, Hashes sind dort
schlicht null, und die Hack-Farm ist in BN4 mit 1 $/(s·GB) Rauschen. Ab Position 5
kippt es: dort schlagen Hashes die Vertraege um Faktor 2,5, und sie kosten die
Haelfte.

**Zur `contracts.js`-Frage aus dem Auftrag:** ja, 17,65 passt neben den Kern nicht
(16,85 + 17,65 = 34,50). Die Haelften passen — aber **nur einzeln**: 12,00 + 12,25 =
24,25, mit dem Kern 41,10. Der Ertrag je GB ist bei der Rotation trotzdem hoeher
(2.400 gegen 1.666), weil derselbe Durchsatz mit weniger Spitzen-RAM erkauft wird.
Der Grund liegt in einer einzigen Funktion: `codingcontract.getContract` kostet
**15 GB**, `getContractType` + `getData` zusammen nur 10
(`RamCostGenerator.ts:384-392`). `contracts.js` benutzt die teure,
`cdump.js` die billige.

## 4.3 Der Eichpunkt, der diese Rangfolge traegt — und was ihn erledigt

Mein Modell sagt 23,52 Mio $ je Vertrag in BN10. Der einzige Feldwert im Projekt
sagt 3,58 Mio (Auftrag §3.3: „24 Stueck = 86 Mio am 02.09."). Faktor 6,6
auseinander. Ein Teil erklaert sich (der 02.09.-Stand hatte Faktionen, also zahlten
drei der vier Belohnungstypen Reputation statt Geld — das erklaert Faktor 4 von 6,6),
der Rest nicht.

**Die Rangfolge haelt trotzdem.** Mit dem Feldwert als Untergrenze:
4,5/h × 3,58 Mio = 4.475 $/s → 365 $/(s·GB). Das ist immer noch **5,7×** die
Sleeve-Verbrechen und **21×** die Hack-Farm. Die Reihenfolge ist gegen einen
Fehler um Faktor 6,6 robust; die *Zeitplanung* ist es nicht.

**Was ihn erledigt, und es kostet nichts:** `csolve.js` schreibt je geloestem
Vertrag `{ts, host, file, type, difficulty, rewardType, payout, nodeReset}` nach
`data/events.json`. Eine Nacht entscheidet. Das ist als Registry-Pflicht in
`telemetryFile` ohnehin vorgesehen — es muss nur das Feld `payout` enthalten.

## 4.4 t_workbench, mit diesen Zahlen

„Erster Rechner ≥ groesstes Pflichtwerkzeug" (§3.3). Das groesste Pflichtwerkzeug
ist in allen sechs Kaltstarts `blade.js` (V2 in Positionen 1–6).

| Position | braucht | Rechner | Preis (`ServerPurchases.ts:34-41`) | Einkommen | **t_workbench** | konservativ (Feldwert) |
|---|---|---|---:|---:|---:|---:|
| 2 (BN10 L3) | 174,35 GB | 256 GB | 85,18 Mio | 29.885 $/s | **0,79 h** | 5,29 h |
| 3 (BN4 L2) | 99,35 GB | 128 GB | 8,45 Mio | 58.991 $/s | **0,04 h** | 0,26 h |
| 5 (BN9 L1) | 99,35 GB | **kein Kauf moeglich** | — | 128.796 $/s | Fremdrechner: sofort | — |

Fuer Position 5/6 gilt: die Werkbank ist der groesste gerootete **Fremd**rechner
(`bn4net.js:945-951`); reicht keiner, kostet `home` 32 → 128 GB **209,7 Mio $**
(HomeComputerRamCost 5) — bei 128.796 $/s sind das 0,45 h. Beide Wege sind
gangbar, aber **keiner davon steht heute im Code**.

---

# 5 Wirt fuer `exit.js` — die Raeumkette ist unvollstaendig

**Die Zahlen.** 519,25 GB bei SF4.1 (live gemessen), 39,25 ab SF4.3. Mit der
5-%-Regel aus §4.4: 545,21 bzw. 41,21 GB. Die Kaufregel `2^ceil(log2(RAM))` ergibt
**1024 GB** bzw. **64 GB** — nicht die in §1.4 genannten 540.

**Wann er beschafft wird.** §4.4 sagt „geplant, BEVOR die Tuer offen ist", nennt
aber keinen Ausloeser. Mein Vorschlag benutzt ein Signal, das der Auftrag bereits
definiert: `ausgang.js` veroeffentlicht `eta_min` (§4.3 Endspurt-Regel). **Regel:
faellt `eta_min` unter 120, ist die Wirtbeschaffung ein Pflichtposten mit
Vorrang vor jedem anderen Kauf.** 120 statt 60, weil der Kauf in BN10 412,29 Mio $
kostet und die Vertragsrate im Endspurt bereits durch Faktionsreputation gedaempft
ist.

**Woher das Geld kommt.** 1024 GB in BN10 = **412,29 Mio $**
(`1024 × 55.000 × CloudServerCost 5 × CloudServerSoftcap 1,1^4`). Ab SF4.3 sind es
64 GB = 3,52 Mio in BN4 — die ganze Planung wird dann trivial. Die 412 Mio sind
also ein Problem von **genau zwei Ausgaengen** (Positionen 1 und 2), und beide
liegen in BN10, wo `blade.js` laeuft und der Bladeburner die Hauptgeldquelle ist.

**Die Raeumkette aus §4.4, geprueft — fuenf Luecken:**

| # | Luecke | Beleg | Ergaenzung |
|---|---|---|---|
| L1 | **Schritt 3 ist in BN9 unmoeglich.** „bei vollem Park den kleinsten Parkrechner `deleteServer`, einen mit 2^ceil(…) kaufen" — BN9 hat `CloudServerLimit 0`. Positionen 5, 6, 7. | `BitNode.tsx`, K6 | Zweig: Wirt = groesster gerooteter Fremdrechner ≥ RAM+5 %; sonst `home` ausbauen (5× Preis); sonst `NOT_EXECUTABLE` mit Befund. |
| L2 | **Keine Geldstufe.** Die Kette endet bei „Preis gegen den Kontostand" ohne Zweig fuer „reicht nicht". | §4.4 | Reicht das Konto nicht, wird der Betrag zur **Endspurt-Reserve**: §4.3 sagt „unter `eta_min` < 60 ist Geld verderbliche Ware und wird ausgegeben". Diese Regel wuerde genau das Geld verbrennen, das den Wirt bezahlt. **Die Wirtreserve wird vor der Endspurt-Regel abgezogen.** Ohne diese Ergaenzung widersprechen sich zwei Auftragsregeln direkt. |
| L3 | **`deleteServer` toetet, was darauf laeuft.** Ist der kleinste Parkrechner die Werkbank, sterben Kern-Gewerke. | — | Ausschlussliste: nie der Wirt des Kerns, nie der Wirt des Waechters, nie der Wirt mit dem juengsten `figure.txt`-Besitzer. |
| L4 | **Die RAM-Zahl darf keine Konstante sein.** 519,25 gegen 39,25 ist Faktor 13. Eine verdrahtete 1024 verbrennt ab SF4.3 in jedem Lauf 412 Mio fuer nichts. | `ram-budget.md` §4.2 | `ns.getScriptRam("exit.js")` zur Laufzeit (`GetScript` 0,1 GB, im Kern bereits eingeplant). |
| L5 | **Schritt 2 „Gewerke dort beenden (Kern und Waechter zuletzt, nie beide)" hat keine Reihenfolge.** | §4.4 | Reihenfolge aus `registry.json` `priority`, aufsteigend; `share` → `weaken` → `grow` → `hack` bleibt fuer die Arbeiter. |

**Was passiert, wenn die Tuer aufgeht, bevor der Wirt da ist.** `ausgang.js:333-346`
meldet `wirtFehlt`. Die Strafleiter eskaliert **nicht** — §5.3 Sprosse 5 fuehrt den
offenen Ausgang ausdruecklich als `NOT_EXECUTABLE(5)` mit der Handlung „Wirt fuer
exit.js beschaffen". Der Lauf laeuft weiter und **verbrennt Zeit als
`jump_latency_min`**. Genau in diesem Zustand greift ohne L2 die Endspurt-Regel und
gibt das Geld aus, mit dem der Wirt bezahlt werden muesste — ein Deadlock, der sich
selbst stabilisiert. Nach 12 h Waechter-Eigenzeit geht `NOT_EXECUTABLE` als Befund
nach `## Sofort` (§5.2), aber niemand ist da, der ihn liest. **L2 ist deshalb keine
Verbesserung, sondern eine Fehlerbehebung.**

---

# 6 Motorzeit

**Wie gemessen.** Je Motorrunde `Δwall = Date.now() − lastWall`. Gezaehlt wird
`Δwall`, wenn **beide** Bedingungen gelten:

```
Δwall <= 12 × Takt                    (120 s bei 10-s-Takt)
Δ totalPlaytime <= Δwall + 60 s       (getPlayer().totalPlaytime, 0,5 GB, im Kern bezahlt)
```

Sonst zaehlt die Runde **0** und loest die Zeitsprung-Karenz aus §5.4 aus.

**Wo gespeichert.** `data/pulse.json` auf `home`, geschrieben vom Kern in jeder
Runde (`ns.write` = 0 GB):

```
{ nodeReset, augReset, motorTimeSinceNodeMs, motorTimeSinceAugMs,
  lastWall, lastPlaytime, round, errStreak, lastError, host, version }
```

Diese eine Datei traegt gleichzeitig den Herzschlag aus §4.2 und Regel **R1** aus
§2.2 — jedes Gewerk liest `nodeReset` und `motorTimeMs` von hier, statt
`getResetInfo` (1,00 GB) selbst aufzurufen.

**Wie sie Einbau und Knotenwechsel ueberlebt.** `data/pulse.json` steht **nicht** in
den Raeumlisten von `boot.js` (`:77-81` einbaugebunden, `:104-108` knotengebunden).
Beim Laden vergleicht der Kern das gespeicherte `nodeReset` mit
`ns.getResetInfo().lastNodeReset`:

- gleich → weiterzaehlen;
- verschieden → `motorTimeSinceNodeMs = 0`, `lastWall = Date.now()`,
  `lastPlaytime = totalPlaytime`, und 10 Minuten Karenz, in der nur gemessen und
  nicht gehandelt wird (§5.4).
- Dasselbe fuer `augReset` und `motorTimeSinceAugMs`.

Umbenennungen sind hier gefaehrlich: `pulse.json` ist eine **gespeicherte** Datei,
also braucht jede Feldumbenennung eine Wanderung beim Laden — die Falle aus
CLAUDE.md (NEONBREAK `lauf.saat` → `lauf.seed`). Fehlt ein Feld, wird es mit 0
angelegt und die Karenz laeuft; es wird **nie** aus einer Vorlage gefuellt.

**Offline-Nacht.** `Δwall` ist dann Stunden, verletzt die erste Bedingung → zaehlt
0. Zusaetzlich bucht die Engine die Abwesenheit in einem Klumpen
(`engine.tsx:280-282`), also springt `totalPlaytime` und verletzt auch die zweite
Bedingung. Beide Wege fuehren zu 0 — das ist die Ebene-0-Gegenprobe aus §3.1
(„8 h Rechner aus = 0; Nachholklumpen = 0"). Danach greift die Zeitsprung-Karenz:
alle S1/S2-Fenster werden verworfen, Wanduhr-Backoffs ruhen 10 Minuten.

**Warum der Deckel 12 × Takt ist und nicht 2 ×.** Zwei unabhaengige Gruende, beide
gemessen:

1. **Der verdeckte Tab liefert genau 1 Runde je 60 s** (Memory
   „Browser-Tab-Drosselung": 1 Timer-Wake/min als Deckel; in §3.3 als
   `throttle_rounds_per_min = 1` bestaetigt). Bei 10-s-Takt waeren 2 × Takt = 20 s.
   Jede einzelne Nachtrunde ueberschritte den Deckel, zaehlte 0 und loeste eine
   Zeitsprung-Karenz aus. Ergebnis: **Motorzeit steht nachts still, die Strafleiter
   ist nie scharf, S2 erreicht sein 45-Minuten-Fenster nie** — und Erics
   „drakonischste Strafen fuer Haenger" gaelten genau dann nicht, wenn niemand
   hinsieht. 12 × Takt = 120 s laesst eine **verpasste** Aufwachrunde zu und
   schliesst trotzdem jede Offline-Phase aus.
2. **Die Richtung des Fehlers.** §3.1 nennt den anderen Grund: mit 2 × Takt
   zaehlte eine gedrosselte Spielstunde nur 20 Minuten, jede daraus abgeleitete
   Rate waere um Faktor 3 zu gut. Ein zu grosszuegiger Deckel verfaelscht Raten;
   ein zu enger schaltet die Aufsicht ab. Der zu enge ist die schlimmere Haelfte.

**Welche Uhr traegt was** — die drei Uhren duerfen nie vertauscht werden:

| Uhr | Definition | traegt |
|---|---|---|
| **Motorzeit des Kerns** | oben | S2, alle Kennzahlen aus §3.3, Werkzeugalter |
| **Waechter-Eigenzeit** | dasselbe Verfahren, aber ueber die Runden des Waechters, in `data/watchdog.json` | Karenzen, Fristen und Backoff der Sprossen 0–3 |
| **Engine-Zeit** (Δ`totalPlaytime`) | — | Sprosse 4a, Engine-Puls |

Der Grund fuer die zweite Uhr ist zwingend: **die Motorzeit des Kerns bleibt stehen,
sobald der Kern haengt.** Eine Waechterfrist in Motorzeit liefe dann genau im
Zielfall nie ab. Das ist die Ebene-0-Pflichtpruefung aus §5.2 („Kern-Motorzeit
eingefroren, Engine tickt — Sprosse 3 eskaliert trotzdem").

**Und was die Motorzeit NICHT tragen darf:** fremde Mechaniken. Gedrosselt bekommt
Bladeburner 25 von 300 Zyklen, Sleeves 15 von 300
(`Bladeburner.ts:1375-1380`, `Sleeve.ts:263-275`). Rangraten gehen gegen
Δ`getBonusTime()`, Sleeve-Raten gegen Δ`storedCycles`. Ist der Nenner nicht
messbar, wird das Fenster verworfen, nicht geschaetzt.

---

# 7 Portierungsliste

Regel: **BLEIBT**, solange keine Messung einen Eingriff erzwingt. Jede Zeile
`AENDERN` nennt die Messung.

## 7.1 Kern und Ruecklaufkette

| Modul | Urteil | Messung, die es erzwingt |
|---|---|---|
| `bn4net.js` 17,75 | **AENDERN** | A1: resident 17,75 + 8,00 = 25,75 reisst die 20-GB-Schwelle um 5,75; mit `boot.js` 31,25 reisst die 28er um 3,25. Diaet auf 11,05 (§1.2). **Dateiname bleibt** (Risiko R2). |
| `boot.js` 5,50 | **AENDERN** | Nicht wegen RAM (mit der Kerndiaet haelt die Summe bei 22,35). Wegen `boot.js:119-127`: die 5-Minuten-Raeumung laesst nur sich selbst stehen und wuerde `guard.js` und `ausgang.js` alle 5 min entfernen. Schonliste aus `registry.json`, kein Literal. |
| `guard.js` | **NEU**, 5,80 GB | existiert nicht |
| `shop.js` (`cloud.*`) | **NEU**, 7,60 GB | Folge der Kerndiaet |
| `registry.json` | **NEU** | ersetzt `WERKZEUGE` (`bn4net.js:257-347`), `verfahrenV1`/`markerGilt`, `TELEMETRIE` |
| `exit.js` 519,25 / 39,25 | **BLEIBT** | 32 GB × SF4-Faktor sind die untere Schranke von `destroyW0r1dD43m0n`; nicht senkbar. Nur die Wirtplanung aendert sich (§5). |
| `ausgang.js` 8,15 | **AENDERN** | §4.1 verlangt `route-fertig`/`blocked` als Zustand und `eta_min` fuer die Endspurt-Regel; heute liefert die Datei beides nicht. Kein RAM-Grund. |
| `route.json` | **BLEIBT** | Reihenfolge unveraenderlich (§2.1) |
| `worker/{hack,grow,weaken}.js`, `share.js` | **BLEIBT** | 1,75/1,80/1,80/4,00 — passen ueberall |

## 7.2 Kaltstart-Gewerke

| Modul | Urteil | Messung |
|---|---|---|
| `wakelock.js` 34,25 | **AENDERN** (hoechste Prioritaet) | 34,25 > 32 → im Kaltstart **nicht startbar**. Ursache `osc.connect` = `singularity.connect` (`wakelock.js:91`, `RamCalculations.ts:216-243`). Reparatur `osc["con"+"nect"]` → 2,25 GB. |
| `cdump.js` 12,00 / `csolve.js` 12,25 | **AENDERN** (klein) | 16,85 + 24,25 = 41,10 → Rotation statt Nebeneinander. Ergaenzung: `payout` in `data/events.json` (§4.3), `nodeReset` per R1 statt `getResetInfo`. |
| `contracts.js` 17,65 | **BLEIBT** | 16,85 + 17,65 = 34,50 > 32 → nicht kaltstartfaehig, aber ab Werkbank die bessere Wahl. Keine Aenderung noetig. |
| `sleevecrime.js` 7,65 | **AENDERN** | Zwei Messungen: (a) Selbstauskunft `:2` sagt 5,6, real 7,65; (b) §1.4 „Marker landet auf dem Mietrechner statt home". Dazu R1: ohne `getResetInfo` 6,60. |
| `darkweb.js` 2,65 | **BLEIBT** | Gemessen 2,65 statt der im Auftrag genannten 27,65 — das Skript ist kaltstartfaehig und **muss** in die Registry (K2). Nur die falsche Zahl in §1.3 korrigieren. |
| `popups.js` 3,30 | **AENDERN** | §5.3: Dialoge mit `Cannot save game` / `REMOVED FUNCTION` / `Recovery` / `Delete` duerfen nicht geschlossen werden; heute schliesst die Wache blind. Kein RAM-Grund (3,30 statt 1,6 aendert nichts). |
| `hashes.js` 5,95 | **AENDERN** (klein) | Selbstauskunft „rund 5", real 5,95. Dazu: Registry-Feld `knoten` muss `SF9>=1 oder BN9` abbilden, sonst laeuft es in den Positionen 2–4 wirkungslos (K5). |
| `werkbank.js` 2,90 | **BLEIBT** | |

## 7.3 Werkbank-Gewerke

| Modul | Urteil | Messung |
|---|---|---|
| `blade.js` 174,35 / 99,35 | **AENDERN-KANDIDAT, Messung fehlt** | Gemessen ist nur, dass 174,35 GB die Werkbank auf 256 GB (85,18 Mio $) zwingt und der Bladeburner bis dahin steht. Ob ein Aufteilen in Aktionsmotor / Skillplan / Spannenrechner den Motor unter ~40 GB bringt, ist **nicht gemessen**. Der Auftragswert 27,6 ist strukturell unmoeglich (24 Bladeburner-Funktionen = 87 GB, SF4-unabhaengig). **Zu messen, bevor entschieden wird**, nicht vorher zu bauen. |
| `sleeve.js` 27,85 | **AENDERN** | Zwei Messungen: (a) 16,85 + 27,85 = 44,70 → nie kaltstartfaehig; (b) §1.4 „02.09.: Konto −18,5 Mio in 5 min". Geldboden als Rueckstandsrechnung (§4.3). Dazu K4: die Statverteilung ist im frischen Knoten sinnlos, solange shock 100 ist — die Sleeves gehoeren dort auf Verbrechen, nicht ins Gym. |
| `bn4rep.js` 850,75 / 63,25 | **BLEIBT bis Position 8** | 850,75 GB ist in Positionen 1–7 nirgends startbar, wird dort aber auch nicht gebraucht (alle V2). Ab Position 8 gilt SF4.3 → 63,25 GB, und die Datei laeuft auf jeder Werkbank. Erst dann neu messen. |
| `graft.js` 145,45 / 32,95 | **BLEIBT** | 32,95 auch bei Faktor 1 knapp ueber `home` — irrelevant, Grafting kommt nach der Werkbank. |
| `hacknet.js` 9,45 | **BLEIBT** | |
| `bn4door.js` 99,85 / 9,85 · `homegrow.js` 148,5 / 13,5 · `bbtrain.js` 94,75 / 12,25 · `bn4life.js` 293,85 / 23,85 | **BLEIBT** | Alle vier sind ab SF4.3 werkbanktauglich und im Kaltstart nicht auf dem kritischen Pfad. |

## 7.4 Archiv

**ARCHIV, vor Stufe A per eigenem Commit nach `archiv/`** (§1.5): alle 16
namentlich toten Dateien plus die 47 ohne Aufrufer aus `ram-budget.md` §1.
Zwei davon mit Nachdruck, weil sie den Verbotsgrep aus §6.1 ab dem ersten Lauf rot
faerben: `exploit3.js` (enthaelt `bitburnerSave`) und die sechs Dateien mit
`while (true)`. Leichen im Spiel per `deleteFile`.

Zusaetzlich als Lehrstuecke fuer Regel R2 vermerken, nicht reparieren:
`keepalive.js` (32 GB fuer `connect`), `travel.js` / `probe.js` / `joinfac.js`
(je 48 GB fuer einen eigenen Bezeichner `joinFaction`).

---

# 8 Baureihenfolge

Sortiert nach Ertrag, mit den Fristen, die nicht verschiebbar sind.

| # | Schritt | Ertrag | Frist |
|---:|---|---|---|
| **1** | `wakelock.js`: `osc["con"+"nect"]` | **−32,00 GB fuer zwei Zeichen.** Macht Rangfolgeplatz 3 ueberhaupt startbar und schuetzt ab Minute 1 gegen den Kalenderfaktor 1,8–4,4 (§4.7). Bestes Verhaeltnis im ganzen Plan. | — |
| **2** | Kerndiaet: `cloud.*` → `shop.js`, `hackAnalyze`-Familie inline | 17,75 → 11,05. **Ohne diesen Schritt haelt keine der drei Schwellen aus §4.4 und keine Rotation aus §1.3.** Alles Weitere haengt daran. | — |
| **3** | `registry.json` + Registry-Starter + `data/pulse.json` (Herzschlag, Motorzeit) | Ohne Registry gibt es kein S1, keinen Budgettest und keine Schonliste. Voraussetzung von 4. | — |
| **4** | `guard.js` (5,80) + `penalties.json` + `boot.js`-Schonliste | Die Strafleiter. **`boot.js` und `guard.js` muessen im selben Commit**, sonst raeumt `boot.js` den Waechter alle 5 min weg (R2). | — |
| **5** | Kaltstart-Geldkette: `cdump`/`csolve`-Rotation mit `payout`-Protokoll, `darkweb.js` in die Registry, `sleevecrime.js` schlank | Die einzige Geldquelle der Positionen 1–4 (§4.2), und der Eichpunkt aus §4.3 faellt nebenbei ab. | — |
| **6** | **Sleeve-Memory und Covenant-Kauf** | Faktor 10–100 auf jeden der 38 folgenden Kaltstarts (K4). Der erste Covenant-Sleeve kostet 10 Bio bei 17,25 Bio Kontostand. | **Ende Position 2.** Danach nie wieder. Einziger unwiderruflicher Posten. |
| **7** | Figur-Vergabepunkt (Entscheidung im Kern, Ausfuehrung beim Besitzer) | C.14; verhindert, dass ein `startWork` ein laufendes Graft ohne Erstattung toetet (`GraftingWork.tsx:75-83`). | vor dem ersten Graft |
| **8** | `exit.js`-Wirtplanung mit L1–L5 (§5) | Behebt einen sich selbst stabilisierenden Deadlock (L2). | vor dem Ausgang aus Position 2 |
| **9** | `ausgang.js`: `eta_min`, `route-fertig`/`blocked` | Endspurt-Regel und Routenende als Zustand (§4.1). | mit 8 |
| **10** | **BN9-Gewerk**: kein `shop.js`, Werkbank = Fremdrechner, `home`-Ausbau 5×, `hashes.js` ab Minute 0 | Drei Laeufe hintereinander (K6), und die ertragreichste Geldquelle der ganzen Route (11.765 $/(s·GB)). | **vor Position 5**, also vier Laeufe |
| **11** | `blade.js` messen, dann entscheiden (7.3) | offen | vor Position 3 |
| **12** | Grafting-Automatik, `boerse.js` (BN8), BN15-Tor | Route-Ende bzw. eigenes Projekt | Position 35 ff. |

Die Reihenfolge 1–5 ist eine Kette: jeder Schritt macht den naechsten erst moeglich.
Ab 6 laufen die Straenge parallel, aber 6 hat als einziger eine Frist, die der Bot
nicht nachholen kann.

---

# 9 Risiken

### R1 — Die Kerndiaet gelingt nicht

**Das geht schief, wenn** sich `hackAnalyze` und `hackAnalyzeChance` nicht inline
nachbauen lassen, ohne `lib/calc.js` zu importieren (`bn4net.js:3228-3234` verbietet
es, weil der Import die Kosten zurueckholt) — oder wenn beim Herausloesen von
`cloud.*` eine weitere Funktion im Kern haengen bleibt.

**Dann** steht resident bei 25,75 statt 16,85. Frei bleiben 6,25 GB. Damit passt
weder `cdump.js` (12,00) noch `csolve.js` (12,25) noch `sleevecrime.js` (6,60)
noch `ausgang.js` (8,15) — es passen nur noch `wakelock` (2,25), `hashes` (5,95),
`werkbank` (2,90), `darkweb` (2,65) und `popups` (3,30), also **keine einzige
Geldquelle der Positionen 1–4**. `t_workbench` in Position 2 waere nicht mehr
0,79 h, sondern unbestimmt.

**Gegenmittel, bevor gebaut wird:** die Inline-Formel gegen `ns.hackAnalyze` und
`ns.hackAnalyzeChance` am **laufenden** Spiel messen (lesend, ueber die Bruecke),
auf drei Servern, und erst bei Uebereinstimmung < 1 % den Kern anfassen. Das ist
dieselbe Eichpflicht, an der am 30.08. vier von vier Kopfrechnungen scheiterten.

### R2 — `boot.js` raeumt den neuen Kern oder den Waechter weg

**Das geht schief, wenn** der Kern umbenannt wird (`bn4net.js` → `core.js`) oder
der Waechter unter einem Namen laeuft, den `boot.js` nicht kennt. `boot.js:119-127`
raeumt alle 5 Minuten **alles auf `home` ausser sich selbst**, und `:163-168` kehrt
erst zurueck, wenn es `bn4net.js` laufen sieht. Ein umbenannter Kern heisst: `boot.js`
kehrt nie zurueck, belegt dauerhaft 5,50 GB, und killt alle 5 Minuten den Kern, den
es starten soll.

**Dann** ist der Bot tot, und zwar **still** — der Waechter ist mitgeraeumt, es gibt
keine Telemetrie, keine Sprosse und keinen Eintrag nach `## Sofort`. Der Ausfall
faellt erst beim naechsten `/bb` auf.

**Gegenmittel:** (a) der Kern behaelt vorerst den Dateinamen `bn4net.js`;
(b) Schonliste und Kernname kommen aus `registry.json`, nicht aus einem Literal;
(c) `boot.js` und `guard.js` gehen im **selben** Commit live, mit der
Einzeldatei-Prozedur aus §9(6) und einem Wirkungsbeleg (neue `version` in der
Telemetrie) vor der naechsten Datei. Das ist genau die Klasse Aenderung, die laut
CLAUDE.md nicht ohne Skeptiker fertig wird: sechs Zeilen, und der Bot laeuft danach
unbeaufsichtigt weiter.

### R3 — BN9 kommt, bevor das BN9-Gewerk steht

**Das geht schief, wenn** die Positionen 3 und 4 (BN4, `t_workbench` 0,04 h,
also sehr schnell) durchlaufen, bevor jemand bemerkt, dass BN9 keine Mietrechner
hat. Dann trifft der Bot auf `CloudServerLimit 0` mit einer Kaltstart-Leiter, die
`purchaseServer` aufruft, einer Werkbank-Logik, die einen Park erwartet, und einer
`exit.js`-Raeumkette, deren Schritt 3 nicht existiert.

**Dann** haengt er in `NOT_EXECUTABLE` — nicht in einer Eskalation, das ist die gute
Nachricht (§5.2 verhindert die Fehlstrafe korrekt). Die schlechte: er haengt dort
**drei Laeufe lang** (Positionen 5, 6, 7), und er meldet es nur nach `## Sofort`,
also frueher nirgends, weil ntfy seit 31.08. aus ist. Nach der Roadmap sind das
66–87 Motor-Stunden, die als „Bot laeuft" gezaehlt werden, waehrend er steht.

**Gegenmittel:** Schritt 10 der Baureihenfolge hat eine harte Frist, und der
`route.json`-Mechanismus kann sie durchsetzen: der BN9-Eintrag bekommt ein
`"braucht": "hashes.js"` — es steht bereits dort. Der Zweig `blocked` aus §4.1
haelt den Bot dann im letzten erreichten Knoten, statt in einen Knoten zu springen,
den er nicht bedienen kann. **Das ist heute schon so gebaut und muss nur getestet
werden** (Ebene 0, `route.json` mit fehlendem `braucht`).

---

## Anhang A — Was ich NICHT gemessen habe

Diese Punkte tragen Aussagen im Text und sind ausdruecklich **ungeeicht**:

1. **Geld je Vertrag.** Modell 47,04 Mio × CCM gegen Feldwert 3,58 Mio (§4.3).
   Faktor 6,6 offen. Die Rangfolge haelt, die Zeitplanung nicht. Erledigt sich mit
   dem `payout`-Feld in `events.json`.
2. **Kaltstart-Hackrate 175 $/s.** Aus dem Auftrag uebernommen (§3.3, „Modell BN10,
   Unsicherheit ≤ Faktor 2"), nicht nachgerechnet. Sie steht in §4.2 nur auf dem
   letzten Platz und traegt keine Entscheidung.
3. **`4 Hashes = 1 Mio $`.** Aus Auftrag §4.3 uebernommen. Meine unabhaengig
   gerechnete Hashrate (0,28 Hash/s) reproduziert damit die dort genannten
   70.000 $/s exakt — zwei zueinander konsistente Angaben, aber keine eigene
   Messung des Wechselkurses.
4. **`guard.js` = 5,80 GB.** Aus dem Kostenbaum gerechnet, nicht gemessen — die
   Datei existiert nicht. Nach dem Bau per `calculateRam` gegen das laufende Spiel
   zu pruefen; der Rechenweg ist an vier Dateien auf 0,00 GB geeicht.
5. **`blade.js` teilbar?** Nicht gemessen. Deshalb in 7.3 als Kandidat, nicht als
   Entscheidung.
6. **Sleeve-Zahl nach dem Sprung.** `min(3, sourceFileLvl(10) + (BN10?1:0)) + sleevesFromCovenant`
   (`SleeveCovenantPurchases.tsx:58-72`) ergibt heute 2 und stimmt mit dem
   Live-Spielstand ueberein. Fuer Position 2 sagt die Formel 3 — **im Klon zu
   pruefen, nicht zu unterstellen** (§3.3 verlangt genau das).

## Anhang B — Belege und Werkzeuge

- Kaltstart- und Ertragsrechnung: `…/scratchpad/kaltstart-b2.mjs`
- Routen-, Leiter- und Werkbankrechnung: `…/scratchpad/route-kaltstart.mjs`
- Sleeve-Zustand aus dem Live-Spielstand (nur lesend): `…/scratchpad/sleeve-lesen.mjs`
- RAM-Grundlage: `doku/ram-budget.md`, Rohdaten `doku/ram-messung-2026-09-04.json`
- BitNode-Multiplikatoren: `nodes/BAU-2026-09/bitnodes.json`
- Quellcode-Belege (alle `reference/v301/src/`):
  `Netscript/RamCostGenerator.ts:10-53,82-96,157-225,384-419`,
  `Script/RamCalculations.ts:183-192,216-243`,
  `Prestige.ts:203-260,338-345`,
  `PersonObjects/Player/PlayerObjectGeneralMethods.ts:100-160,505-570`,
  `PersonObjects/Sleeve/Sleeve.ts:173-179,197-256,263-275`,
  `PersonObjects/Sleeve/SleeveCovenantPurchases.tsx:13-27,58-98`,
  `PersonObjects/Sleeve/Work/{Work.ts:17-25,SleeveRecoveryWork.ts:13-17,SleeveSynchroWork.ts:13-19}`,
  `Work/{Formulas.ts:58-79,WorkStats.ts:49-62,102-114}`,
  `Crime/{Crime.ts:70-136,Crimes.ts}`,
  `CodingContract/{Contract.ts:12-17,59-103,ContractGenerator.ts:16-95,115-190}`,
  `NetscriptFunctions.ts:840-858`, `NetscriptFunctions/CodingContract.ts:13-48`,
  `Server/{ServerHelpers.ts:224-244,ServerPurchases.ts:28-42,data/Constants.ts:3-12}`,
  `PersonObjects/Player/PlayerObjectServerMethods.ts:30-44`,
  `Hacknet/{HacknetHelpers.tsx:34-36,HacknetServer.ts:121-135,formulas/HacknetServers.ts:4-17,data/Constants.ts:32-49}`,
  `DarkWeb/DarkWebItems.ts:6-21`, `Constants.ts:16,44,50,89-93,107`,
  `RedPill.tsx:24-38,52-90`, `engine.tsx:207-213,263-282`

Kein `pushFile`, kein `deleteFile`, keine Aenderung unter `src/`, kein Browser,
kein Neustart der Bruecke.
