# ARCHITEKTUR — Grundlage von Phase C

**Synthetiker, 04.09.2026, 03:18–04:0x Ortszeit** (`date`, Systemzeit). Grundlage:
`nodes/AUFTRAG-BAU-2026-09.md` §1.3–1.6, §3, §4, §5; die RAM-Messung vom 04.09.
(`doku/ram-messung-2026-09-04.json`, 114 Dateien, live gegen lokal 0,00 GB); die
Entwürfe B1 und B2 und die beiden Richtersprüche; und **eigene Prüfungen im
Quellcode und am Live-Zustand**, deren Ergebnisse hier gelten, auch wo sie
Entwurf, Richter oder Auftragstext widersprechen.

Dieses Dokument ist ohne die Entwürfe lesbar. Wo es „verifiziert" sagt, ist die
Prüfung in dieser Sitzung selbst gelaufen; die Fundstelle steht dabei. Wo es
„offen" sagt, steht in §10 die Messung, die es entscheidet.

Live gelesen 03:22 (`/api/state`, nur lesend): `instance LIVE`, `verified true`,
BN10 Lauf 2, `motorRound 4318`, home 131.072 GB, 85 von 86 gerootet, Konto
**19,77 Bio $**, Hacking 345, Kampf str 100 / def 100 / dex 112 / agi 109,
`backupAgeMin 35,7`, Sicherung grün.

---

# 1 ENTSCHEIDUNGEN

Elf Entscheidungen. Je Entscheidung: was gilt, warum, was verworfen wurde.

## E1 — Der Kern wird kleiner, die 20-GB-Schwelle bleibt stehen (offener Punkt A.4)

**Es gilt:** Auftrag §4.4 „resident nur Kern und Wächter, ≤ 20 GB" wird **nicht
korrigiert, sondern erfüllt**. Der Kern fällt von 17,75 auf **10,75 GB**, der
Wächter kostet **6,10 GB**, resident sind **16,85 GB** — 3,15 GB unter der
Schwelle. Mit `boot.js` (5,50) steht die Spitze bei **22,35 ≤ 28**, resident
allein bei 16,85 ≤ 26. Beide Ebene-1-Tore halten.

**Warum die 20 und die 26/28 nicht dieselbe Zahl sind:** die 20 ist das
Entwurfsziel des Kaltstarts, die 26/28 sind das Abnahmetor der Ebene 1, das auch
in dem Moment halten muss, in dem `boot.js` noch resident ist. Ein Entwurfsziel,
das beim ersten Widerstand hochgesetzt wird, ist keines — und hier ist es ohne
Verrenkung erreichbar.

**Die Rechnung, verifiziert.** `bn4net.js` misst 17,75 GB (Live = lokal, 0,00 GB
Abweichung). Zwei Blöcke lösen sich mechanisch heraus:

    ns.cloud.getServerLimit 0,05 + getRamLimit 0,05 + getServerCost 0,25
          + getServerUpgradeCost 0,10 + getServerNames 1,05
          + upgradeServer 0,25 + purchaseServer 2,25                    = 4,00
    ns.hackAnalyze 1,00 + hackAnalyzeChance 1,00 + growthAnalyze 1,00    = 3,00
    ---------------------------------------------------------------------------
    17,75 - 4,00 - 3,00                                                 = 10,75

Kostenwerte aus `RamCostGenerator.ts:224-234` (cloud-Block) und `:10-53,563`
(`hackAnalyzeChance: RamCostConstants.HackAnalyze` = 1). Die sieben cloud-Namen
sind in `bn4net.js` per Grep vollständig belegt; `deleteServer` (2,25) kommt dort
**nicht** vor und wandert deshalb erst mit dem neuen `shop.js` hinzu.

**Verworfen: B2s 11,05 GB.** B2 schlägt auf die korrekt zerlegten 17,75 noch
„neu: `getScriptRam` 0,10 + `getServerMaxRam` 0,05 + `getServerUsedRam` 0,05 +
`isRunning` 0,10" auf. Verifiziert per Grep in `src/bn4net.js`: diese Funktionen
kommen dort bereits **17 / 18 / 9 / 2 mal** vor und stecken in den gemessenen
17,75. Das ist die Fehlerklasse „Additivität nicht geprüft" vom 30.08. Richtig
ist B1s Zahl.

**Verworfen: die Auftragszeile `boot.js ≤ 4,0`.** Gemessen sind **5,50**; die
„4,0 geeicht" aus §1.3 ist überholt. Mit dem 10,75er Kern liegt die Ebene-1-Summe
bei 22,35 und damit 5,65 GB unter dem Tor. 1,5 GB aus dem einzigen Skript zu
schneiden, dessen Rückruf live bewiesen ist (01.09.), kauft nichts und riskiert
das Fundament. Die Zeile entfällt ersatzlos.

**Verworfen: der geteilte Wächter aus §4.4** (2,3-GB-Fühler + Ausführung im
Kern). Er wird nicht gebraucht (siehe E2) und verliert Sprosse 3, weil der Kern
sich nicht selbst neu starten kann.

## E2 — Der Wächter kostet 6,10 GB und ist bei allem autark, was einen toten Kern betrifft

**Es gilt:** `src/guard.js`, **6,10 GB**, singularityfrei, SF4-invariant:

    Base                      1,60
    getPlayer                 0,50   (SingularityFn1/4, KEIN SF4Cost - :650)
    getResetInfo              1,00   (:653, kein SF4Cost)
    ps                        0,20   (Scan - :599)
    scriptKill                1,00   (ArbScript - :635)
    kill                      0,50   (:593)
    exec                      1,30   (:590)
    read / write / sleep      0,00   (:623,625,564)
    globalThis["docu"+"ment"] 0,00   (RamCalculations.ts:185-192 kennt als
    globalThis["loca"+"tion"] 0,00    DOM-Sonderfall NUR document und window)
    -----------------------------------------------------------------------
                              6,10   Budget §4.4: <= 8, also 1,90 GB Luft

Damit führt der Wächter **allein** aus: Sprosse 0 (Umgebung), Sprosse 1
(Werkzeug neu — auch auf einem fremden Wirt, denn `scriptKill(datei, wirt)` und
`exec(datei, wirt)` arbeiten remote und der Wirtsname steht im Pflichtfeld `host`
der Telemetrie, Lesekosten 0), Sprosse 3 (`ps()` ohne Argument zählt home auf,
`kill(pid)` räumt, `exec("boot.js","home")`) und Sprosse 4a (DOM, 0 GB).

**Delegiert wird genau zweierlei, und beides hat eine eigene Reißleine:**
- **Sprosse 2** (anderer Wirt) braucht `scp` (0,60), eine Wirtsliste (`scan`
  0,20) und die RAM-Arithmetik (`getServerMaxRam`/`getServerUsedRam`/
  `getScriptRam`, 0,20) — zusammen 1,00 GB. Sprosse 2 feuert per Definition erst,
  wenn Sprosse 1 zweimal wirkungslos war, also in einem Zustand, in dem **S1 das
  Signal ist und nicht S3a** — der Kern lebt also. Der Wächter schreibt den
  Auftrag nach `data/watchdog.json.orders[]`, der Kern führt aus (er hat alle
  fünf Funktionen ohnehin). **Führt der Kern den Auftrag nicht binnen seiner
  Karenz aus, ist das selbst ein Kernbefund und geht direkt auf Sprosse 3** — und
  die macht der Wächter allein.
- **Sprosse 5** (Einbau) kostet `installAugmentations` = `SingularityFn3` 5 GB
  → **80 GB bei SF4.1**. Das sprengt jeden 8-GB-Wächter. Der Wächter beauftragt,
  der Kern validiert die acht Vorbedingungen aus §5.3 **erneut** (zwischen
  Auftrag und Ausführung kann sich `ausgang.json.offen` geändert haben) und
  startet `src/punish.js`.

**Warum `getResetInfo` (1,00 GB) drin bleibt, obwohl B2 es streicht.** Es trägt
zwei Urteile, die der Wächter nicht vom Kern beziehen darf: die
Wirkungsprüfung von Sprosse 5 („`lastAugReset` gesprungen", §5.2) und die
`nodeReset`/`augReset`-Stempel in `penalties.json` (§5.4 verlangt sie wörtlich).
Läse der Wächter beides aus einer Datei des Kerns, hinge die Bestätigung der
teuersten Sprosse an genau dem Kern, dessen Ausfall sie beheben sollte. Der
Auftrag sagt denselben Satz für die Uhren („die Motorzeit des Kerns … nie eine
Wächterfrist"); er gilt für den Reset-Zustand genauso.

**Verworfen: B1s 7,30 GB.** B1 kauft `scp`, `scan`, `getScriptRam`,
`getServerMaxRam`, `getServerUsedRam`, `fileExists`, `isRunning` — 1,20 GB für
Sprosse 2, die nur mit lebendem Kern feuert. Der Preis ist gemessen: bei 7,30
steht resident bei 18,05, nach Wakelock bleiben **11,70 GB** frei, und die
billigere Vertragshälfte `cdump.js` kostet **12,00**. B1s Kaltstart hätte
**keine Geldquelle** (§7). `fileExists` und `isRunning` sind neben `ps`
überflüssig.

**Verworfen: B2s 5,80 GB.** Die acht abgedruckten Posten addieren sich auf 4,80,
nicht 5,80 — die Herleitung ist nicht reproduzierbar. Inhaltlich fehlt B2 jede
Möglichkeit, auf einem fremden Wirt zu handeln, und `getResetInfo` (siehe oben).

## E3 — Registry: zwei RAM-Zahlen, eine Formel, und der Spielwert schlägt den Planwert

**Es gilt:** `src/registry.json` führt je Eintrag `ramBaseGb` und `ramSingGb`
statt vier SF-Spalten. Der Wert zur Laufzeit:

    ram = ramBaseGb + ramSingGb * f
    f   = (bitNodeN === 4) ? 1 : (sf4 <= 1) ? 16 : (sf4 === 2) ? 4 : 1

**Verifiziert:** `RamCostGenerator.ts:82-96` ist wörtlich diese Fallunterscheidung,
und die Messdatei trägt die Zerlegung selbst — `bn4rep.js` hat `singKosten41: 840`
bei `lokal41: 850,75`, also `ramSingGb = 840/16 = 52,50` und `ramBaseGb = 10,75`;
`lokal43` = 63,25 = 10,75 + 52,50. Über alle 114 Dateien trägt die Messung diese
zwei Zahlen; vier Spalten wären vier Gelegenheiten zu widersprechen.

**Und:** die Registry ist der **Planwert**, `ns.getScriptRam` (0,10 GB, im
Kernbudget) ist die **Wahrheit**. Weicht sie um mehr als 0,05 GB ab, geht der
Eintrag auf `state: "degraded"`, läuft mit dem Spielwert weiter, erzeugt ein
Ereignis und einmal je Knoten eine Zeile nach `## Sofort`. `doku/ram-budget.md`
beantwortet seine eigene Verifikationsfrage damit, dass die Zahl sich ändert,
sobald jemand die Datei anfasst — ohne Gegenprobe ist die Registry nach der
ersten Codeänderung eine Lüge, und `exec` = 0 ist nach §5.1 ausdrücklich **kein
Hänger**: der Bot startete etwas nie und niemand erführe es.

**Verworfen:** eine gepflegte SF4.2-Spalte. Sie ist toter Code — siehe E4.
**Verworfen:** B1s Feld `precondition.minHostRamGb` als gespeicherte Konstante.
Es ist eine Verdopplung von `ramBaseGb + ramSingGb × f` und driftet gegen sie.
Der Wirt wird gerechnet, nicht abgeschrieben.

## E4 — Der Faktor 16 betrifft **einen** kommenden Kaltstart, der Faktor 4 keinen

**Es gilt:** Auf der Restroute gibt es **6 Kaltstarts auf 32 GB** (Positionen
1–6), davon **einen künftigen mit ×16** (Position 2, BN10 L3). Der ×4-Fall tritt
**nie** ein. Ab Position 7 startet `home` mit **128 GB**.

**Verifiziert** an `src/route.json` (Positionen 1–7: BN10 L2, BN10 L3, BN4 L2,
BN4 L3, BN9 L1–L3), `RedPill.tsx:16-38,66` (`giveSourceFile`, `lvl++`, Deckel 3;
`Player.bitNodeN = newBitNode` **vor** `prestigeSourceFile`), `RamCostGenerator.ts:82-96`
(`bitNodeN === 4` → Faktor 1) und `Prestige.ts:246-252` (`activeSourceFileLvl(9)
>= 2 → setMaxRam(128)`):

| Pos | Knoten | home | SF4 beim Start | Faktor | Bemerkung |
|---:|---|---:|---:|---:|---|
| 1 | BN10 L2 | 32 | 1 | ×16 | läuft, Kaltstart vorbei |
| 2 | BN10 L3 | 32 | 1 | **×16** | der einzige künftige ×16-Kaltstart |
| 3 | BN4 L2 | 32 | 1 | 1 | in BN4 per Definition |
| 4 | BN4 L3 | 32 | 2 | 1 | in BN4 per Definition |
| 5 | BN9 L1 | 32 | 3 | 1 | keine Mietrechner |
| 6 | BN9 L2 | 32 | 3 | 1 | keine Mietrechner |
| 7 | BN9 L3 | **128** | 3 | 1 | SF9.2 nach Position 6 |
| 8–40 | Rest | 128 | 3 | 1 | |

**Konsequenz:** der Auftragstext an die Architekten („30 der 40 Restläufe mit
SF4.1 oder SF4.2") verwechselt *30 Dateien über 32 GB* mit *30 Läufen*. Es gibt
**eine** Betriebsart, nicht zwei: der Kaltstart-Kern ist per §4.1 singularityfrei
und vom Faktor per Konstruktion unberührt; der Unterschied liegt allein in den
Gewerken, und dort ist er in der Registry eine **Zahl**, kein Zweig.

**Verworfen:** ein zweiter, handoptimierter ×16-Betriebsmodus. Er würde für einen
Lauf gebaut und 38 Läufe mitgeschleppt.

## E5 — Der Figur-Vergabepunkt entscheidet im Kern (0 GB), erzwungen wird er vom Grep

**Es gilt:** die Vergabe ist eine reine Datei-Entscheidung — Anträge lesen,
Rangfolge anwenden, `data/figure.txt` schreiben. `ns.read`/`ns.write` kosten
0 GB, also liegt sie im Kern. Die **Kontrolle** (vergebene gegen tatsächlich
laufende Handlung) kostet Singularity und liegt in einem eigenen Gewerk auf der
Werkbank. Details in §6.

**Verworfen: B1s `figure.js` mit 228,55 GB** für eine Entscheidung, die nichts
kostet.

**Verworfen und widerlegt: B1s `figure-cold.js` (6,60 GB).** Die *Zahl* stimmt
(Bladeburner-Block in `RamCostGenerator.ts` läuft nicht durch `SF4Cost`), die
*Funktion* gibt es im Zielzustand nicht. Verifiziert:
`PlayerObjectGeneralMethods.ts:143-160` setzt in `prestigeSourceFile()`
**`this.bladeburner = null`** und nullt zuvor alle Kampf-Erfahrung; der
Wiedereintritt verlangt `strength/defense/dexterity/agility ≥ 100`
(`NetscriptFunctions/Bladeburner.ts:349-360`). Im frischen Knoten hat ein
Bladeburner-Treiber **nichts zu starten**. B1 nennt den Platzkonflikt zwischen
`figure-cold.js` (6,60) und `sleevecrime.js` (7,65) sogar als Beweis, wozu die
Registry da ist — der Konflikt existiert nicht, weil die eine Hälfte tot ist.

**Was stattdessen gilt:** im ×16-Kaltstart liegt die **Figur still**, bis die
Werkbank steht. Gym (`SingularityFn1` ×16 = 32 GB), Verbrechen (`Fn3` ×16 =
80 GB) und Faktionsarbeit (`Fn2` ×16 = 48 GB) passen auf 32 GB `home` nicht neben
den Kern. Das Tor 4×100 tragen die **Sleeves**: die gesamte Sleeve-API kostet
`SleeveBase` = 4 GB **flach ohne SF4-Faktor** (`RamCostGenerator.ts:396-419`,
verifiziert), und der Spieler bekommt `Basiswerte × shockBonus × syncBonus` der
arbeitenden Hülle (`Sleeve/Work/Work.ts:26-33`, verifiziert:
`applyWorkStatsExp(Player, shockedStats, mult * sync)`).

## E6 — Eine fehlende Datei speist die Strafleiter nie

**Es gilt:** vier abgeleitete Zustände je Registry-Eintrag, und nur einer davon
kann strafbar werden:

| `state` | Bedingung | Folge |
|---|---|---|
| `unbuilt` | `ramBaseGb === null`, Datei nie gebaut | **inert.** Kein Start, kein S1, keine Sprosse. Zählt in `kpi.json.registry_unbuilt[]`. |
| `absent` | gebaut, aber nicht auf `home` | kein Start, **kein S1**, ein Ereignis je `nodeReset` |
| `vanished` | war schon einmal da, jetzt weg | Befund + einmal je Knoten nach `## Sofort` |
| `degraded` | da, aber `getScriptRam` weicht > 0,05 GB ab | läuft mit Spielwert weiter, Ereignis, einmal `## Sofort` |
| `running` | läuft, Telemetrie frisch | einziger Zustand, in dem S1 gelten kann |

**Warum das nicht theoretisch ist:** `src/route.json` führt für die Positionen
38–40 wörtlich `"braucht": "boerse.js"`, und die Datei existiert nicht. Ohne
diese Regel triebe ein nicht gebautes Gewerk Δ Träger auf 0, S2 liefe durch 45
Minuten und 6 Stunden, und **Sprosse 5 antwortete mit einem Augmentierungs-Einbau
auf eine Datei, die es nie gab.** §5.1 sagt „`exec` 0 ist kein Hänger"; das hier
ist derselbe Satz eine Ebene früher.

## E7 — `hashes.js` hängt an `node === 9 ODER SF9 ≥ 1`, nicht an SF9 ≥ 1

**Es gilt:** das Registry-Feld heißt `requiresFeature: 9` mit der Semantik von
`canAccessBitNodeFeature` (`BitNodeUtils.ts:17-19`, verifiziert):
`Player.bitNodeN === 9 || Player.activeSourceFileLvl(9) > 0`.

**Verworfen: B1s `precondition: { "requiresSF": { "9": 1 } }`.** In Route-Position
5 (BN9 L1) steht SF9 auf 0 und der Bot ist **in** BN9. B1s Vorbedingung sperrt
`hashes.js` genau in dem Lauf aus, den `route.json` mit `"braucht": "hashes.js"`
markiert — und in dem `Prestige.ts:338-345` (verifiziert:
`activeSourceFileLvl(9) >= 3 || bitNodeN === 9`) ab Minute 0 einen fertigen
Gratis-Hacknet-Server mit Level 100 und 10 Kernen hinstellt. Das ist die
Fehlerklasse „ähnliche Feldnamen verwechselt" vom 30.08., und sie steht
ausgerechnet in dem Artefakt, das die Schematauglichkeit belegen soll.

## E8 — Der Verbotsgrep sucht Property-Namen, nicht `ns.`-Präfixe

**Es gilt:** die Figur-Regel und die Zahlenliteral-Regel des Verbotsgreps (§6.1)
lösen wie der RAM-Rechner des Spiels auf: **nach dem Namen des Members**, egal
über welchen Bezeichner er erreicht wird.

**Verifiziert am eigenen Bestand:** `src/joinrun.js:25` lautet
`const s = ns.singularity;` und ruft danach `s.travelToCity(...)`,
`s.gymWorkout(...)`, `s.joinFaction(...)`. Ein Grep auf
`ns\.singularity\.travelToCity` findet die Datei **nicht**; der RAM-Rechner
berechnet sie trotzdem, weil `RamCalculations.ts:216-243` rekursiv über alle
Namensräume nach dem Property-Namen sucht. Ein Grep, der das nicht nachbildet,
ist eine Durchsetzung, die genau an der Datei versagt, die heute daliegt.
Dieselbe Auflösung ist der Grund, warum `wakelock.js:91` mit `osc.connect(...)`
32 GB kostet (E9).

## E9 — Die Reihenfolge nach Ertrag im Kaltstart ist gemessen, nicht angenommen

**Es gilt:** in den Positionen 1–4 sind **Verträge** die Geldquelle, **Hashes
sind dort exakt null**, die Hack-Farm ist Rauschen. Ab Position 5 kippt es:
dort schlagen Hashes die Verträge.

**Warum das eine Änderung an §4.4 ist:** die dortige Rangfolge nennt auf Platz 4
„Geldquellen (Hashes, Sleeve-Verbrechen, Weaken-Farm)" und die Verträge erst auf
Platz 5. Für die Positionen 2–4 ist das nachweislich umgekehrt: `hasHacknetServers()`
verlangt `canAccessBitNodeFeature(9)` (E7), und in den Positionen 2, 3 und 4 ist
weder `bitNodeN === 9` noch SF9 > 0 — `hashes.js` läuft dort ins Leere. Verträge
dagegen sind **ohne Root, ohne Portknacker und ohne Singularity** erreichbar:
`ns.ls` (`NetscriptFunctions.ts:840-858`) und `getCodingContract`
(`NetscriptFunctions/CodingContract.ts:13-21`) prüfen keine Adminrechte.

**Deshalb lautet die Kaltstart-Rangfolge:** (1) Kern, (2) Wächter, (3) Wakelock,
(4) **Verträge**, (5) Sleeve-Verbrechen und `darkweb.js`, (6) Hashes **nur bei
`requiresFeature: 9`**, (7) erster Mietrechner → Werkbank, (8) `ausgang.js`.
Zahlen in §7.

## E10 — Die Wirtreserve für `exit.js` wird vor der Endspurt-Regel abgezogen

**Es gilt:** sobald `ausgang.js` `eta_min < 120` meldet, ist der Betrag für den
`exit.js`-Wirt eine **gesperrte Reserve**. Die Endspurt-Regel aus §4.3 („unter
`eta_min < 60` ist Geld eine verderbliche Ware und wird ausgegeben") greift
**auf das Konto abzüglich dieser Reserve**.

**Warum das eine Fehlerbehebung ist und keine Verbesserung:** ohne den Abzug
widersprechen sich zwei Auftragsregeln direkt und stabilisieren einen Deadlock.
`exit.js` misst 519,25 GB bei SF4.1 (live bestätigt, `singKosten41: 512`,
`ramBaseGb` 7,25 + `ramSingGb` 32,00). Mit der 5-%-Regel braucht der Wirt
545,21 GB, die Kaufregel `2^ceil(log2(519,25))` ergibt **1024 GB**, Preis in BN10
`1024 × 55.000 × CloudServerCost 5 × CloudServerSoftcap 1,1^4` = **412,29 Mio $**
(`ServerPurchases.ts:34-41`, `Server/data/Constants.ts:4` = 55.000,
`BitNode.tsx:854-857` = 5 und 1,1 — alle verifiziert). Ist der Wirt nicht
gesichert und fällt `eta_min` unter 60, verbrennt die Endspurt-Regel genau dieses
Geld; `ausgang.js:333-346` meldet `wirtFehlt`; §5.3 stuft den offenen Ausgang
ausdrücklich als `NOT_EXECUTABLE(5)` **ohne Eskalation** ein. Nichts bricht die
Schleife, und nach 12 h geht ein Befund an `## Sofort`, den niemand liest.

## E11 — Die Covenant-Sache ist ein offener Punkt, kein Bauposten

**Es gilt:** der Kauf zusätzlicher Sleeves und die `memory`-Aufwertung sind
**nur in BN10** möglich, also nur bis zum Sprung aus Position 2 — das ist die
einzige unwiderrufliche Frist des ganzen Plans. Aber der Weg dorthin ist heute
**versperrt**, und ob er sich öffnen lässt, ist eine Messung (§10, O2).

**Verifiziert, und es korrigiert B2 und Richter 1 gleichermaßen.**
`SleeveCovenantPurchases.tsx:29-56` und `:83-98`: **beide** Käufe verlangen
`Player.bitNodeN === 10` **und** `Factions[TheCovenant].isMember`. Die
Beitrittsbedingung steht in `FactionInfo.tsx:167`:

    inviteReqs: [ haveAugmentations(20), haveMoney(75e9),
                  haveSkill("hacking", 850), haveCombatSkills(850) ]

Live gemessen 04.09. 03:22: **15 Augs, Hacking 345, Kampf 100/100/112/109**,
Konto 19,77 Bio. Nur die Geldbedingung ist erfüllt. B2 und Richter 1 rechnen
beide den *Preis* (10 Bio für den ersten Sleeve, 30,42 Bio für `memory` 1→25)
und übersehen das *Tor* — die Fehlerklasse „Umgebungsmultiplikator vergessen"
vom 30.08., angewandt auf eine Zugangsbedingung.

**Der Wert bleibt echt:** `sleevesFromCovenant` und `memory` überleben jeden
Sprung (`Sleeve.ts:253`: `this.sync = Math.max(this.memory, 1)`;
`recalculateNumberOfOwnedSleeves` benutzt bewusst `sourceFileLvl`, nicht
`activeSourceFileLvl`), und `sync` geht linear in die Erfahrung ein, die der
Spieler von seinen Hüllen bekommt (E5). `memory` 25 statt 1 wäre Faktor 25 auf
den Sleeve-Anteil des Tors in **allen 38 Restläufen**. Und `ns.sleeve.purchaseSleeve`
und `ns.sleeve.upgradeMemory` kosten je 4 GB flach — ausführbar ohne DOM und
ohne Singularity-Aufschlag.

**Deshalb:** kein Bauposten, sondern eine Rechnung mit Termin. Sie blockiert den
Bau nicht (§10, O2).

---

# 2 MODULSCHNITT

`RAM 41` = SF4.1 (Faktor 16), `RAM 43` = SF4.3 bzw. in BN4 (Faktor 1). Alle Werte
außer den mit **P** markierten sind Messungen vom 04.09.; **P** ist eine
Planungszahl, die vor der Abnahme an der gebauten Datei gemessen wird.

## 2.1 Resident auf `home`

| Modul | Zweck | RAM 41 | RAM 43 | Abhängigkeiten | Test |
|---|---|---:|---:|---|---|
| `src/boot.js` | Rückrufziel von `exit.js` und Autoexec; räumt `home` und startet Wächter und Kern, gibt sich dann frei | 5,50 | 5,50 | `registry.json` (Schonliste + Kernname) | Ebene 0: Schonliste greift; Ebene 3: echter Kaltstart |
| `src/bn4net.js` (Kern) | Rooten, HWGW, Kauf/Ausbau, Werkbank, Registry-Starter, Motorzeit, Entdopplung, Figur-Vergabe, Auftragsausführung für Sprosse 2 und 5 | **10,75 P** | 10,75 P | `registry.json`, `lib/reg.js` | Ebene 0: `round()` als reine Funktion; Ebene 2: ns-Mock; Ebene 3: Kaltstart |
| `src/guard.js` | Signale S1–S6, Zustandsautomat, Sprossen 0/1/3/4a, Aufträge für 2 und 5 | **6,10 P** | 6,10 P | `data/registry.json`, Telemetrien, `data/bridge.json` | Ebene 0: `step(state, signals)` rein; Ebene 2: Mock protokolliert `kill`/`exec`; Ebene 3: verdeckte Nacht |

Resident **16,85**, mit `boot.js` **22,35**.

## 2.2 Neu, gestartet vom Kern

| Modul | Zweck | RAM 41 | RAM 43 | Abhängigkeiten | Test |
|---|---|---:|---:|---|---|
| `src/lib/reg.js` | reiner Registry-Leser, berührt kein `ns` | **0,00 P** | 0,00 | — | Ebene 0: Importeur wird durch den Import nicht teurer (die `lib/calc.js`-Lehre, `bn4net.js:3228-3234`, als Test statt als Kommentar) |
| `src/shop.js` | `ns.cloud.*` — Rechnerkauf, Ausbau, Kaltstart-Leiter, `deleteServer` für die `exit.js`-Räumkette | **7,00 G** | 7,00 G | — (bedingungslos: er ist der Preislieferant) | Ebene 2: Preisformel gegen `ServerPurchases.ts`; Ebene 3: echter Kauf im Klon |
| `src/punish.js` | Vollstrecker der Sprosse 5; liest `data/aug-queue.json` statt 80 GB für `getOwnedAugmentations` auszugeben | **82,60 P** | 7,60 P | `data/penalty-order.json`, `aug-queue.json` | Ebene 2: alle acht Vorbedingungen; Ebene 3: Trockenlauf im Klon |
| `src/figwatch.js` | Vergleicht die vergebene mit der laufenden Handlung, meldet `figure_conflict` | **35,15 P** | 5,15 P | `data/figure.txt` | Ebene 2: Mock mit abweichender Handlung |
| `src/boerse.js` | BN8-Gewerk | — | — | `route.json` Positionen 38–40 | Ebene 3 mit gesetztem Knoten |

## 2.3 Vorhanden, gestartet vom Kern (Auszug; vollständige Liste in §8)

| Modul | RAM 41 | RAM 43 | resident? | Wirt |
|---|---:|---:|---|---|
| `src/wakelock.js` (nach Fix) | **2,25 P** | 2,25 P | nein, Rang 3 | home |
| `src/cdump.js` | 12,00 | 12,00 | nein, Rotation | home |
| `src/csolve.js` | 12,25 | 12,25 | nein, Rotation | home |
| `src/darkweb.js` | 2,65 | 2,65 | nein | home |
| `src/popups.js` | 3,30 | 3,30 | nein | home |
| `src/sleevecrime.js` | 7,65 | 7,65 | nein | any, `scp` nach home |
| `src/hashes.js` | 5,95 | 5,95 | nein | not-hacknet |
| `src/ausgang.js` | 8,15 | 8,15 | nein | any |
| `src/contracts.js` | 17,65 | 17,65 | nein | werkbank |
| `src/blade.js` | 174,35 | 99,35 | nein | werkbank |
| `src/bn4rep.js` | 850,75 | 63,25 | nein | werkbank |
| `src/graft.js` | 145,45 | 32,95 | nein | werkbank |
| `src/exit.js` | 519,25 | 39,25 | nein | eigener Wirt (E10) |
| `src/worker/{hack,grow,weaken,share}.js` | 1,75/1,80/1,80/4,00 | gleich | nein | not-hacknet |

---

# 3 REGISTRY-SCHEMA

## 3.1 Feldsatz

Pflicht: `name`, `args`, `ramBaseGb`, `ramSingGb`, `ramMeasuredAt`, `verfahren`
(`V1|V2|alle`), `knoten` (`alle` oder Zahlenmenge), `phase`
(`kaltstart|normal|beide`), `telemetryFile`, `scpToHome`, `freshnessMs`,
`taktMs`, `hostRule` (`home|werkbank|any|not-hacknet`), `priority`, `evictRank`,
`needsFigure` (`none|request|owner`), `needsLibs`, `singularity`,
`restartPolicy` (`always|oneshot|until-done|never`), `maxInstances`, `killSafe`,
`precondition`.

Die sieben Felder über §4.2 hinaus, je mit dem Grund:

- **`ramBaseGb`/`ramSingGb`** statt „`ramGb` je SF4-Stufe" — E3.
- **`ramMeasuredAt`** — die Zahl gilt nur für den Dateistand des Datums; die
  Laufzeit-Gegenprobe (E3) hängt daran.
- **`evictRank`** neben `priority` — zwei verschiedene Ordnungen. `priority` ist
  die Startreihenfolge (§4.4), `evictRank` ist, wen der Kern beendet, wenn ein
  höher priorisiertes Werkzeug Platz braucht. Ohne die zweite Ordnung hat
  `werkzeugWartetGb` (`bn4net.js:3013`) keinen Adressaten.
- **`maxInstances`** (Vorgabe 1, Arbeiter `null`) — die Entdopplung
  (`bn4net.js:2741-2760`) braucht eine Zahl, gegen die sie prüft, sonst kann sie
  Arbeiter nicht von Gewerken unterscheiden.
- **`killSafe`** — Sprosse 3 killt „Kern, Registry-Werkzeuge und Arbeiter". Ohne
  dieses Feld killt sie den Wächter, der sie gerade ausführt. `guard.js` und
  `boot.js`: `false`.
- **`scpToHome`** — §5.1 nennt die Falle wörtlich („Werkbank-Schreiber ohne
  `scp` → Dauerkill"); `sleevecrime.js` hat sie heute. Das Feld macht sie in
  Ebene 0 prüfbar statt im Betrieb.
- **`precondition`** mit `requiresFile`, `forbidsFile`, `requiresFeature` (E7),
  `minHomeRamGb` — der Ersatz für die Marker-Sonderfälle
  (`keine-sleeves`, `keine-hacknet`, `bn4-stop`, `install-sperre`, `rep-modus`,
  `geldbedarf`) im Kern. **Kein** `minHostRamGb`: der Wirtbedarf wird gerechnet
  (E3).

`state` ist **abgeleitet**, nicht gepflegt (E6), und steht in
`data/registry-state.json`, nicht in `registry.json`.

## 3.2 Der Rollen-Riegel — ohne ihn ist die Registry gefährlicher als die heutige Liste

Ein Eintrag gilt, wenn

    passtKnoten && passtVerfahren && passtPhase && passtFeature && preconditionOk

Knoten und SF-Stand kommen aus `ns.getResetInfo()` (1 GB, `currentNode`,
`ownedSF`, `ownedAugs` — `getOwnedSourceFiles` mit 80 GB wird nirgends
gebraucht), die Rolle aus `data/verfahren.txt` (`"V2 10 2"`).

**Der Riegel:** `verfahren.txt` wird von `boot.js` absichtlich **nicht** gelöscht
(`boot.js:94-99`, mit Begründung). Nach einem Knotensprung steht dort also einige
Sekunden lang die Rolle des **alten** Knotens. Der Kern hält deshalb die
Knotennummer in der Datei gegen `getResetInfo().currentNode`:

    if (rolle.node !== ri.currentNode)  ->  Rolle "unbekannt";
    es starten NUR Eintraege mit verfahren === "alle".

Die Registry macht diesen Fehler **häufiger** als die heutige Liste, weil sie
mehr Einträge gleichzeitig bewertet — also gehört der Riegel in die Gate-Funktion,
nicht in einen Kommentar.

## 3.3 `src/registry.json` — 22 Einträge

```json
{
  "schema": 1,
  "stand": "2026-09-04",
  "ramQuelle": "doku/ram-messung-2026-09-04.json (114 Dateien, live gegen lokal 0,00 GB)",
  "ramFormel": "ramBaseGb + ramSingGb * (node===4 ? 1 : sf4<=1 ? 16 : sf4===2 ? 4 : 1)",
  "eintraege": [
    {
      "name": "bn4net.js",
      "args": [],
      "ramBaseGb": 10.8,
      "ramSingGb": 0,
      "ramMeasuredAt": "GEMESSEN-2026-09-04",
      "ramHeuteGb": 17.75,
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "beide",
      "telemetryFile": "data/bn4net.json",
      "scpToHome": false,
      "freshnessMs": 600000,
      "taktMs": 10000,
      "hostRule": "home",
      "priority": 1,
      "evictRank": 99,
      "needsFigure": "owner",
      "needsLibs": [
        "lib/reg.js"
      ],
      "singularity": false,
      "restartPolicy": "always",
      "maxInstances": 1,
      "killSafe": false,
      "precondition": {}
    },
    {
      "name": "guard.js",
      "args": [],
      "ramBaseGb": 6.1,
      "ramSingGb": 0,
      "ramMeasuredAt": "GERECHNET-2026-09-04 (tools/ram.js, mit Sprossen C.9/C.10)",
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "beide",
      "telemetryFile": "data/watchdog.json",
      "scpToHome": false,
      "freshnessMs": 600000,
      "taktMs": 10000,
      "hostRule": "home",
      "priority": 2,
      "evictRank": 99,
      "needsFigure": "none",
      "needsLibs": [],
      "singularity": false,
      "restartPolicy": "always",
      "maxInstances": 1,
      "killSafe": false,
      "precondition": {}
    },
    {
      "name": "wakelock.js",
      "args": [],
      "ramBaseGb": 2.25,
      "ramSingGb": 0,
      "ramMeasuredAt": "PLAN-nach-connect-Fix",
      "ramHeuteGb": 34.25,
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "beide",
      "telemetryFile": null,
      "scpToHome": true,
      "freshnessMs": 600000,
      "taktMs": 60000,
      "hostRule": "home",
      "priority": 3,
      "evictRank": 1,
      "needsFigure": "none",
      "needsLibs": [],
      "singularity": false,
      "restartPolicy": "always",
      "maxInstances": 1,
      "killSafe": true,
      "precondition": {}
    },
    {
      "name": "cdump.js",
      "args": [],
      "ramBaseGb": 12.65,
      "ramSingGb": 0,
      "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "kaltstart",
      "telemetryFile": "data/cdump-stand.json",
      "scpToHome": true,
      "freshnessMs": 1800000,
      "taktMs": 300000,
      "hostRule": "home",
      "priority": 4,
      "evictRank": 9,
      "needsFigure": "none",
      "needsLibs": [],
      "singularity": false,
      "restartPolicy": "until-done",
      "maxInstances": 1,
      "killSafe": true,
      "precondition": {
        "forbidsFile": "data/cantwort.json"
      }
    },
    {
      "name": "csolve.js",
      "args": [],
      "ramBaseGb": 12.85,
      "ramSingGb": 0,
      "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "kaltstart",
      "telemetryFile": "data/csolve.json",
      "scpToHome": true,
      "freshnessMs": 1800000,
      "taktMs": 300000,
      "hostRule": "home",
      "priority": 4,
      "evictRank": 8,
      "needsFigure": "none",
      "needsLibs": [],
      "singularity": false,
      "restartPolicy": "until-done",
      "maxInstances": 1,
      "killSafe": true,
      "precondition": {
        "requiresFile": "data/cantwort.json"
      }
    },
    {
      "name": "darkweb.js",
      "args": [],
      "ramBaseGb": 2.65,
      "ramSingGb": 0,
      "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "kaltstart",
      "telemetryFile": null,
      "scpToHome": true,
      "freshnessMs": 1800000,
      "taktMs": 120000,
      "hostRule": "home",
      "priority": 5,
      "evictRank": 6,
      "needsFigure": "none",
      "needsLibs": [],
      "singularity": false,
      "restartPolicy": "until-done",
      "maxInstances": 1,
      "killSafe": true,
      "precondition": {
        "forbidsFile": "data/portknacker-komplett.txt"
      }
    },
    {
      "name": "sleevecrime.js",
      "args": [],
      "ramBaseGb": 7.65,
      "ramSingGb": 0,
      "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "kaltstart",
      "telemetryFile": null,
      "scpToHome": true,
      "freshnessMs": 900000,
      "taktMs": 60000,
      "hostRule": "any",
      "priority": 5,
      "evictRank": 5,
      "needsFigure": "none",
      "needsLibs": [],
      "singularity": false,
      "restartPolicy": "always",
      "maxInstances": 1,
      "killSafe": true,
      "precondition": {
        "forbidsFile": "data/keine-sleeves.txt"
      }
    },
    {
      "name": "hashes.js",
      "args": [],
      "ramBaseGb": 5.95,
      "ramSingGb": 0,
      "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "beide",
      "telemetryFile": "data/hashes.json",
      "scpToHome": true,
      "freshnessMs": 900000,
      "taktMs": 60000,
      "hostRule": "not-hacknet",
      "priority": 6,
      "evictRank": 7,
      "needsFigure": "none",
      "needsLibs": [],
      "singularity": false,
      "restartPolicy": "always",
      "maxInstances": 1,
      "killSafe": true,
      "precondition": {
        "requiresFeature": 9,
        "forbidsFile": "data/keine-hacknet.txt"
      }
    },
    {
      "name": "shop.js",
      "args": [],
      "ramBaseGb": 7.0,
      "ramSingGb": 0,
      "ramMeasuredAt": "GEMESSEN-2026-09-04",
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "beide",
      "telemetryFile": "data/shop.json",
      "scpToHome": true,
      "freshnessMs": 600000,
      "taktMs": 30000,
      "hostRule": "home",
      "priority": 7,
      "evictRank": 4,
      "needsFigure": "none",
      "needsLibs": [],
      "singularity": false,
      "restartPolicy": "until-done",
      "maxInstances": 1,
      "killSafe": true,
      "precondition": {}
    },
    {
      "name": "ausgang.js",
      "args": [],
      "ramBaseGb": 8.15,
      "ramSingGb": 0,
      "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "beide",
      "telemetryFile": "data/ausgang.json",
      "scpToHome": false,
      "freshnessMs": 600000,
      "taktMs": 30000,
      "hostRule": "any",
      "priority": 8,
      "evictRank": 3,
      "needsFigure": "none",
      "needsLibs": [
       "lib/route.js",
       "lib/eta.js",
       "lib/events.js"
      ],
      "singularity": false,
      "restartPolicy": "always",
      "maxInstances": 1,
      "killSafe": true,
      "precondition": {}
    },
    {
      "name": "blade.js",
      "args": [],
      "ramBaseGb": 94.35,
      "ramSingGb": 5.0,
      "ramMeasuredAt": "2026-09-04",
      "verfahren": "V2",
      "knoten": "alle",
      "phase": "normal",
      "telemetryFile": "data/blade.json",
      "scpToHome": true,
      "freshnessMs": 600000,
      "taktMs": 30000,
      "hostRule": "werkbank",
      "priority": 10,
      "evictRank": 20,
      "needsFigure": "request",
      "needsLibs": [
       "lib/figurns.js",
       "lib/figur.js"
      ],
      "singularity": true,
      "restartPolicy": "always",
      "maxInstances": 1,
      "killSafe": true,
      "precondition": {
        "forbidsFile": "data/bn4-stop.txt"
      }
    },
    {
      "name": "worker/weaken.js",
      "args": [],
      "ramBaseGb": 1.8,
      "ramSingGb": 0,
      "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "beide",
      "telemetryFile": null,
      "scpToHome": false,
      "freshnessMs": null,
      "taktMs": null,
      "hostRule": "not-hacknet",
      "priority": 9,
      "evictRank": 2,
      "needsFigure": "none",
      "needsLibs": [],
      "singularity": false,
      "restartPolicy": "never",
      "maxInstances": null,
      "killSafe": true,
      "precondition": {}
    },
    {
      "name": "boerse.js",
      "args": [],
      "ramBaseGb": 21,
      "ramSingGb": 0,
      "ramMeasuredAt": "GERECHNET-2026-09-04 (tools/ram.js)",
      "verfahren": "V1",
      "knoten": [
        8
      ],
      "phase": "beide",
      "telemetryFile": "data/boerse.json",
      "scpToHome": true,
      "freshnessMs": 600000,
      "taktMs": 6000,
      "hostRule": "werkbank",
      "priority": 9,
      "evictRank": 15,
      "needsFigure": "none",
      "needsLibs": [],
      "singularity": false,
      "restartPolicy": "always",
      "maxInstances": 1,
      "killSafe": true,
      "precondition": {}
    },
    {
      "name": "graftauto.js",
      "args": [],
      "ramBaseGb": 16.75,
      "ramSingGb": 0.5,
      "ramMeasuredAt": "GERECHNET-2026-09-04 (tools/ram.js)",
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "normal",
      "telemetryFile": "data/graftauto.json",
      "scpToHome": true,
      "freshnessMs": 900000,
      "taktMs": 60000,
      "hostRule": "werkbank",
      "priority": 11,
      "evictRank": 11,
      "needsFigure": "none",
      "needsLibs": [
       "lib/graftwahl.js",
       "lib/figurns.js",
       "lib/figur.js"
      ],
      "singularity": true,
      "restartPolicy": "always",
      "maxInstances": 1,
      "killSafe": true,
      "precondition": {
        "requiresFile": "graftplan.json"
      }
    },
    {
      "name": "figwatch.js",
      "args": [],
      "ramBaseGb": 4.85,
      "ramSingGb": 0.5,
      "ramMeasuredAt": "GERECHNET-2026-09-04 (tools/ram.js)",
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "normal",
      "telemetryFile": "data/figwatch.json",
      "scpToHome": true,
      "freshnessMs": 600000,
      "taktMs": 15000,
      "hostRule": "werkbank",
      "priority": 14,
      "evictRank": 18,
      "needsFigure": "none",
      "needsLibs": [
       "lib/figur.js"
      ],
      "singularity": true,
      "restartPolicy": "always",
      "maxInstances": 1,
      "killSafe": true,
      "precondition": {}
    },
    {
      "name": "bbtrain.js",
      "args": [],
      "ramBaseGb": 6.85,
      "ramSingGb": 5.5,
      "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "normal",
      "telemetryFile": "data/bbtrain.json",
      "scpToHome": true,
      "freshnessMs": 600000,
      "taktMs": 60000,
      "hostRule": "werkbank",
      "priority": 11,
      "evictRank": 12,
      "needsFigure": "owner",
      "needsLibs": [
       "lib/figurns.js",
       "lib/figur.js"
      ],
      "singularity": true,
      "restartPolicy": "always",
      "maxInstances": 1,
      "killSafe": true,
      "precondition": {}
    },
    {
      "name": "sleeve.js",
      "args": [],
      "ramBaseGb": 27.85,
      "ramSingGb": 0.0,
      "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "beide",
      "telemetryFile": "data/sleeve.json",
      "scpToHome": true,
      "freshnessMs": 600000,
      "taktMs": 30000,
      "hostRule": "any",
      "priority": 11,
      "evictRank": 11,
      "needsFigure": "none",
      "needsLibs": [],
      "singularity": false,
      "restartPolicy": "always",
      "maxInstances": 1,
      "killSafe": true,
      "precondition": {}
    },
    {
      "name": "hacknet.js",
      "args": [],
      "ramBaseGb": 9.45,
      "ramSingGb": 0.0,
      "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "beide",
      "telemetryFile": null,
      "scpToHome": true,
      "freshnessMs": 1800000,
      "taktMs": 120000,
      "hostRule": "not-hacknet",
      "priority": 12,
      "evictRank": 10,
      "needsFigure": "none",
      "needsLibs": [],
      "singularity": false,
      "restartPolicy": "always",
      "maxInstances": 1,
      "killSafe": true,
      "precondition": {}
    },
    {
      "name": "bn4life.js",
      "args": [],
      "ramBaseGb": 5.85,
      "ramSingGb": 18.0,
      "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "normal",
      "telemetryFile": "data/bn4life.json",
      "scpToHome": true,
      "freshnessMs": 600000,
      "taktMs": 15000,
      "hostRule": "werkbank",
      "priority": 12,
      "evictRank": 13,
      "needsFigure": "owner",
      "needsLibs": [
       "lib/figurns.js",
       "lib/figur.js"
      ],
      "singularity": true,
      "restartPolicy": "always",
      "maxInstances": 1,
      "killSafe": true,
      "precondition": {}
    },
    {
      "name": "homegrow.js",
      "args": [],
      "ramBaseGb": 4.5,
      "ramSingGb": 9.0,
      "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "beide",
      "telemetryFile": null,
      "scpToHome": true,
      "freshnessMs": 1800000,
      "taktMs": 300000,
      "hostRule": "werkbank",
      "priority": 13,
      "evictRank": 7,
      "needsFigure": "none",
      "needsLibs": [],
      "singularity": true,
      "restartPolicy": "always",
      "maxInstances": 1,
      "killSafe": true,
      "precondition": {}
    },
    {
      "name": "contracts.js",
      "args": [],
      "ramBaseGb": 17.65,
      "ramSingGb": 0.0,
      "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "normal",
      "telemetryFile": "data/contracts.json",
      "scpToHome": true,
      "freshnessMs": 1800000,
      "taktMs": 300000,
      "hostRule": "werkbank",
      "priority": 13,
      "evictRank": 9,
      "needsFigure": "none",
      "needsLibs": [
       "lib/loeser.js"
      ],
      "singularity": false,
      "restartPolicy": "always",
      "maxInstances": 1,
      "killSafe": true,
      "precondition": {}
    },
    {
      "name": "popups.js",
      "args": [],
      "ramBaseGb": 3.3,
      "ramSingGb": 0.0,
      "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "normal",
      "telemetryFile": null,
      "scpToHome": false,
      "freshnessMs": 600000,
      "taktMs": 10000,
      "hostRule": "home",
      "priority": 3,
      "evictRank": 2,
      "needsFigure": "none",
      "needsLibs": [],
      "singularity": false,
      "restartPolicy": "always",
      "maxInstances": 1,
      "killSafe": true,
      "precondition": {}
    },
    {
      "name": "bn4rep.js",
      "args": [],
      "ramBaseGb": 10.75,
      "ramSingGb": 52.5,
      "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "normal",
      "telemetryFile": "data/bn4rep.json",
      "scpToHome": true,
      "freshnessMs": 1800000,
      "taktMs": 60000,
      "hostRule": "werkbank",
      "priority": 14,
      "evictRank": 14,
      "needsFigure": "owner",
      "needsLibs": [
       "lib/endspurt.js",
       "lib/figurns.js",
       "lib/figur.js"
      ],
      "singularity": true,
      "restartPolicy": "always",
      "maxInstances": 1,
      "killSafe": true,
      "precondition": {}
    },
    {
      "name": "bn4door.js",
      "args": [],
      "ramBaseGb": 3.85,
      "ramSingGb": 6.0,
      "ramMeasuredAt": "2026-09-04",
      "verfahren": "alle",
      "knoten": "alle",
      "phase": "normal",
      "telemetryFile": "data/bn4door.json",
      "scpToHome": true,
      "freshnessMs": 1800000,
      "taktMs": 300000,
      "hostRule": "werkbank",
      "priority": 14,
      "evictRank": 5,
      "needsFigure": "none",
      "needsLibs": [],
      "singularity": true,
      "restartPolicy": "always",
      "maxInstances": 1,
      "killSafe": true,
      "precondition": {}
    }
  ],
  "hinweis_portiert": "Die letzten 9 Eintraege sind am 04.09.2026 nachgetragen worden: sie laufen heute ueber die WERKZEUGE-Liste in bn4net.js, standen aber nicht in 3.3. Ohne sie haette der Umstieg auf die Registry (C.5) neun laufende Werkzeuge stillgelegt. ramBaseGb und ramSingGb sind aus doku/ram-messung-2026-09-04.json gerechnet: sing = (SF4.1 - SF4.3)/15, basis = SF4.3 - sing."
}
```

`worker/weaken.js` steht bewusst darin: `telemetryFile: null` +
`restartPolicy: "never"` + `maxInstances: null` ist die maschinenlesbare Aussage
„das ist ein Arbeiter — nicht überwachen, nicht neu starten, beliebig viele".
Heute steckt genau diese Unterscheidung in Kommentaren und einer Sonderbehandlung
im Wasserfall. `boerse.js` steht mit `ramBaseGb: null` darin und ist damit
`unbuilt` und inert (E6).

`knoten: [8]` ist zulässig: §4.1 verbietet Knotennummern **im Code**;
`registry.json` ist Daten, wie `route.json`, das Knotennummern ebenfalls führt.

---

# 4 TELEMETRIE- UND KENNZAHLEN-SCHEMA

Auftrag §8 Phase C verlangt das **als Erstes, vor jedem Gewerk** — ohne diese
Felder kann der Wächter nichts entscheiden und keine Abnahme etwas messen.

## 4.1 Pflichtfelder in jedem Telemetrieblock

| Feld | Einheit | Uhr | Bedeutung |
|---|---|---|---|
| `ts` / `wall` | ms seit Epoche | Wanduhr | Schreibzeitpunkt; `wall` ist der ausdrücklich benannte Zweitwert |
| `playtime` | ms | Engine (`totalPlaytime`) | Zweitwert |
| `motorTimeMs` | ms | **Motorzeit des Kerns** | vom Kern veröffentlicht, vom Schreiber gestempelt; **trägt S1** |
| `round` | Zahl | — | Schleifendurchläufe |
| `okRound` | Zahl | — | **vollständig** durchlaufene Runden |
| `errStreak` | Zahl | — | aufeinanderfolgende Ausnahmen der Rundenfunktion |
| `lastError` | `{cls,msg,at}\|null` | Wanduhr | `msg` auf 200 Zeichen gekürzt |
| `nodeReset` / `augReset` | ms | Wanduhr | aus `getResetInfo()` |
| `host` | Name | — | auf welchem Rechner geschrieben |
| `version` | Zeichenkette | — | Wirkungsbeleg beim Hot-Swap (§9(6) des Auftrags) |
| `state` | `work\|wait\|blocked\|done` | — | siehe unten |
| `blockedReason` | `null\|no_space\|no_role\|no_money\|not_in_division\|…` | — | |

**Ein Block ohne `errStreak` und `lastError` ist ungültig und gilt als
veraltet** (§4.2 wörtlich). Das ist zugleich die Migration: ein alter Schreiber
besteht die Frischeprüfung nicht mehr, statt still weiterzulaufen.

**Warum `okRound` und `state` dazugehören.** Die ganze Kernrunde liegt in einem
`try` (`bn4net.js:391-392,3167-3170`). Ein Motor, der **jede** Runde wirft,
zählt weiter, schreibt Telemetrie und ist nach S1 (frisch), S3a (frisch) und S3b
(Engine tickt) in jeder Hinsicht gesund; erst S2 schlüge nach 45 min an, und
dessen einziger Sprossenausgang ist Sprosse 5 — ein Codefehler mit einem
Augmentierungs-Einbau beantwortet. `errStreak` (→ S6 → direkt Sprosse 3) und
`okRound` schließen das: die Wirkungsprüfung der Sprosse 3 verlangt „`round`
wächst UND `errStreak == 0`" — mit `okRound` ist das **prüfbar** statt nur
gefordert. `state: "wait"` schließt den dritten, leisesten Fall: das Werkzeug
läuft, wirft nicht, tut aber nichts. Es hält S1 ruhig **und** schließt den
Eintrag zugleich aus der S2-Trägerrechnung aus — ein wartendes Werkzeug kann
keinen Fortschritt belegen und wird auch nicht dafür bestraft, keinen zu haben.
`blade.js:609-617` schreibt dafür heute von Hand einen Minimal-Herzschlag mit
`wartend: true`; im Schema ist es ein Feld statt eines Sonderfalls in einer Datei.

## 4.2 `data/kpi.json` — vollständige Feldliste

```
version: 2                  Schemaversion (Migrationsregel unten)
nodeReset, augReset         ms, Wanduhr - Zuordnung zum Lauf
node, level, verfahren      aus verfahren.txt, gegen getResetInfo geriegelt (3.2)
motorTimeSinceNodeMs        ms, Motorzeit   - Laufuhr
motorTimeSinceAugMs         ms, Motorzeit
```

**Autonomie (§3.2), Ziel null bzw. unter Schwelle:**

| Feld | Einheit | Uhr | Soll |
|---|---|---|---|
| `manual_actions` | Zahl je Lauf | — | 0 |
| `jump_latency_min` | min | Wanduhr | ≤ 2, **abzüglich `backup_wait_min`** |
| `backup_wait_min` | min | Wanduhr | getrennt geführt, Kennzahl der Brücke, kein Fehler |
| `wirt_fehlt_count` | Zahl | — | 0 (der zu zählende Fehler, `ausgang.js:333-346`) |
| `boot_latency_min` | min | Wanduhr | ≤ 5 |
| `workbench_wait_h` | h | Motorzeit | ≤ 2 × Bestwert |
| `negative_balance_min` | min | Wächter-Eigenzeit | 0 |
| `false_kill_count` | Zahl | — | 0 |
| `false_penalty_count` | Zahl | — | 0 |
| `ladder_rungs_ge3_per_week` | Zahl | Wanduhr | 0, jede ist ein Befund |
| `bridge_restarts` | Zahl | Wanduhr | Neustart binnen 10 s |
| `backup_age_h` | h | Wanduhr | ≤ 1 |
| `queued_augs_at_jump` | Zahl | — | 0 |
| `graft_aborted` | Zahl | — | 0 |
| `skipped_route_entries` | Zahl | — | 0 (heute 3) |
| `route_state` | `open\|done\|blocked` | — | §4.1 |
| `blocked_dialog` | `null\|Text` | — | §5.3 Schutzliste |
| `wasted_money_at_jump` | $ | — | > 10 % Knotenumsatz = Befund |
| `registry` | `{gilt,running,absent,unbuilt,vanished,degraded,wartetGb}` | — | E6 |
| `exhausted` | `null\|{since,lastRung,signal}` | Wächter-Eigenzeit | erste Zeile von `checkin.js` |

**Effizienz je Phase (§3.3):**

| Feld | Einheit | Uhr | Bemerkung |
|---|---|---|---|
| `t_workbench` | h | **Motorzeit** | Bestwert = Knotenpreis / Kaltstart-Einkommen |
| `contract_stock_usd` | $ | Bestand | liegengebliebene Verträge sind **kein Zufluss** |
| `t_gate` | h | **Motorzeit** | zur Laufzeit aus dem Zustand gerechnet, nie Konstante |
| `idle_ram_pct` | % | Motorzeit | < 20 % über 10 min |
| `throttle_rounds_per_min` | 1/min | Wanduhr | ohne Patch = 1 (belegt) |
| `mult_product` | — | — | V1, gegen Obergrenze 23,1 |
| `favor_target_pct` | % | — | gegen 462.490 Rep |
| `graft_busy_pct` | % | Motorzeit | → 100 %; Reisezeit zählt mit |
| `t_rebuild_h` | h | Motorzeit | gemessen 3,1 h; > 30 % Abweichung = Figur-Konflikt |
| `T2_h` | h | **Δ`getBonusTime()`**, nicht Motorzeit | Verdopplungszeit des Rangs |
| `work_share` | — | — | 1 − Kammeranteil |
| `vorrat_deckung` | h je Aktionsart | Δ`getBonusTime()` | Alarm < 0,5 h |
| `rang_je_vorratseinheit` | Rang/Auftrag | — | < halbe beste Art = Vorrat wird verbrannt |
| `comms_rest` | Zahl je Stadt | — | Raid-Deckel |
| `next_blackop_chance` | 0–1 | — | ≥ 0,35 |
| `hp_max`, `hp_loss_fail` | HP | — | Verhältnis ≥ 2 |
| `chaos_city` | — | — | < 50 |
| `exp_rate_eff` | EXP/s | Motorzeit | V1; gemessen 1,4–2,2e6 |
| `v1_stage` | 1–6 | — | **S2 nimmt je Stufe einen anderen Träger** |
| `bn8_phase` | 1\|2 | — | Trägerwechsel Depot → Hacking-Level |
| `traeger` | `{name, wert, motorTimeMs}` | Motorzeit | vom Kern gerechnet, vom Wächter nur gelesen |
| `bestwertStatus` | `geeicht\|ungeeicht` | — | ungeeicht erzeugt **kein** E1 |

**Regel, die an `traeger` hängt:** der Wächter rechnet den Träger **nicht selbst**.
Täte er es, kostete allein `ns.bladeburner.getRank` 4 GB und jede `ns.stock.*`
2 GB — der 8-GB-Deckel wäre weg. Erwünschte Nebenwirkung: **hängt der Kern, läuft
S2 nicht mehr** — und genau dann greifen S3a und S6, die den Kern meinen.

**Regel, die an `T2_h` und `vorrat_deckung` hängt:** sie laufen **nicht** in
Motorzeit. §3.1 sagt es wörtlich — gedrosselt bekommt Bladeburner 25 von 300
Zyklen, Sleeves 15 von 300. Ein Nenner, der nicht messbar ist, führt zum
**Verwerfen des Fensters**, nie zum Schätzen.

## 4.3 Versionsfeld und Migrationsregel

`kpi.json`, `registry-state.json`, `watchdog.json` und `penalties.json` tragen
`version`. Beim Laden gilt:

1. `version` fehlt oder ist kleiner → **Wanderung** durch benannte Schritte
   (`v1→v2` usw.), jeder Schritt in Ebene 0 getestet.
2. Ein Feld, das die Wanderung nicht kennt, wird mit dem **Nullwert** angelegt —
   **nie aus einer Vorlage gefüllt**. Das ist die NEONBREAK-Lehre (`lauf.saat` →
   `lauf.seed`, 19.08.): eine Ergänzung aus der Vorlage hätte einem laufenden
   Stand mitten im Spiel neue Werte gegeben.
3. `nodeReset` passt nicht → alle laufbezogenen Felder auf 0, Karenz 10 min.
4. `version` ist **größer** als die des lesenden Codes → die Datei wird nicht
   geschrieben, ein Befund geht nach `## Sofort`. Das ist der Rollback-Fall.

## 4.4 Ein Block je Klasse

**Kern (`data/bn4net.json`):**

```json
{ "ts": 1788484955307, "wall": 1788484955307, "playtime": 1324440000,
  "motorTimeMs": 201600000, "round": 4318, "okRound": 4318,
  "errStreak": 0, "lastError": null,
  "nodeReset": 1788271154961, "augReset": 1788271154961,
  "host": "home", "version": "2026-09-04a", "state": "work", "blockedReason": null,
  "rolle": { "verfahren": "V2", "node": 10, "level": 2, "quelleAktuell": true },
  "phase": "normal", "sf4": 1, "sf4Faktor": 16,
  "registry": { "gilt": 11, "running": 9, "absent": 0, "unbuilt": 1,
                "vanished": 0, "degraded": 0, "wartetGb": 0 },
  "traeger": { "name": "BladeburnerRank", "wert": 596.0, "motorTimeMs": 201600000 },
  "netz": { "gerootet": 85, "brachAnteil": 0.00077, "werkbank": "werk-0" } }
```

**Werkbank-Gewerk (`data/blade.json`)** — identische Pflichtfelder,
`scpToHome: true`, also `host !== "home"`:

```json
{ "ts": 1788484950000, "wall": 1788484950000, "playtime": 1324436000,
  "motorTimeMs": 201597000, "round": 812, "okRound": 811,
  "errStreak": 1, "lastError": { "cls": "TypeError", "msg": "chaos of undefined", "at": 1788484950000 },
  "nodeReset": 1788271154961, "augReset": 1788271154961,
  "host": "werk-0", "version": "2026-09-04a", "state": "work", "blockedReason": null,
  "figur": { "besitzer": "blade.js", "seit": 1788481000000, "leaseBis": 1788482400000 },
  "aktion": { "typ": "Operation", "name": "Undercover Operation", "chance": 0.71 },
  "vorrat": { "Operation": 4.2, "Contract": 11.8 } }
```

`errStreak: 1` bei `okRound = round − 1` ist der sichtbare Beleg dafür, dass die
beiden Zähler unabhängig sind — genau das, was ein einzelner `round` verdeckt.

**Arbeiter schreiben nichts.** `telemetryFile: null` ist die Aussage; ohne sie
versuchte der Wächter, 2.741 Arbeiterinstanzen einzeln zu überwachen.

---

# 5 WÄCHTER UND STRAFLEITER

`src/guard.js`, 6,10 GB (E2), Takt **10 s**, von `boot.js` gestartet, auf dessen
Schonliste, bewacht den Kern und wird vom Kern bewacht.

## 5.1 Signale

Jedes mit `Date.now()`, `totalPlaytime` und `round`.

| Sig | Bedingung | Quelle |
|---|---|---|
| **S1** | Telemetriealter eines Eintrags > `freshnessMs` **in Motorzeit** UND Karenz ab UND `nodeReset` aktuell UND `state === "running"` UND Eintrag nicht in `wait` | `ns.read(telemetryFile)`, Feld `motorTimeMs` gegen `data/bn4net.json.motorTimeMs` |
| **S2** | Δ Träger ≤ 0 über ≥ 45 min **Motorzeit** in einer Phase, die Fortschritt verlangt | `data/kpi.json.traeger` — **gelesen, nie gerechnet** |
| **S3a** | Kern-Herzschlag > 10 min | `data/bn4net.json` |
| **S3b** | Engine-Puls `Δ totalPlaytime / Δwall` < 0,2 über ≥ 3 min | `getPlayer().totalPlaytime` + `Date.now()` |
| **S4** | `visibilityState !== "visible"` ODER eigene Rundenrate < 2/min bei tickender Engine | `globalThis["docu"+"ment"]` (0 GB) — **selbst gelesen**, weil im Kaltstart niemand `sonde.json` schreibt |
| **S5** | aus `data/bridge.json` (Rückkanal, 60 s) | `lastTelemetryAt`, `lastSaveAt`, `settings` |
| **S6** | `errStreak ≥ 5` bei tickender Engine und frischem Herzschlag | `data/bn4net.json` |

S2 ist **stumm**, solange `kpi.json.route_state !== "open"` ist (§4.1: ein
fertiger Bot ist kein Hänger) und solange `bestwertStatus === "ungeeicht"`.

## 5.2 Zustandsautomat

    HEALTHY --Signal--> SUSPECT(k) --Karenz ab--> EXECUTED(k) --> VERIFY(k)
      VERIFY gruen  -> HEALTHY, Zaehler des Ziels auf 0
      VERIFY rot    -> SUSPECT(k+1)
      nicht ausfuehrbar -> NOT_EXECUTABLE(k)    [Handlung, KEINE Eskalation]
      k = 5 und rot / alle Deckel gezogen -> EXHAUSTED

`EXHAUSTED`: keine weitere Sprosse, keine Wiederholung, Kern und Werkzeuge laufen
**unverändert weiter**. `data/watchdog.json.exhausted = {since, lastRung,
signal}`, eine Zeile nach `## Sofort` über `data/sofort.json`, danach höchstens
eine je 6 h. Endet, wenn S2 über 60 min Motorzeit Fortschritt zeigt oder
`lastNodeReset`/`lastAugReset` springt. Dieselbe 12-h-Frist für einen
unveränderten `NOT_EXECUTABLE`-Grund.

`data/watchdog.json` hält den Zustand über einen eigenen Neustart hinweg (Feld
`nodeReset`; passt es nicht, fängt der Wächter bei 0 an). Ohne das verliert jede
Sprossenzählung ihren Sinn, sobald der Wächter selbst einmal neu gestartet wird —
und `restartPolicy: "always"` sorgt dafür, dass das passiert.

## 5.3 Die drei Uhren — Entscheidung je Frist

    guardTimeMs  = Sigma Delta_wall ueber eigene Runden, sofern Delta_wall <= 120000
                   UND Delta totalPlaytime <= Delta_wall + 60000   (persistent)
    engineTimeMs = Delta totalPlaytime                             (Delta, nicht Summe)
    motorTimeMs  = vom Kern veroeffentlicht                        (gelesen, nie gerechnet)

| Frist | Uhr | Begründung |
|---|---|---|
| Karenz 10 min nach `lastAugReset`/`lastNodeReset`/eigenem Start | **guard** | Der Kern kann in diesem Fenster gar nicht laufen; seine Motorzeit stünde |
| Karenz nach Zeitsprung (Δwall > 12 × Takt) | **guard** | ebenso |
| S1 `freshnessMs` | **motor** | §5.1 wörtlich. Fällt der Kern aus, fällt S1 mit ihm aus — dafür gibt es S3a |
| S2 45 min / 6 h | **motor** | §5.2 wörtlich. S2 misst Spielfortschritt |
| S3a 10 min | **guard** | Der Kern hängt — seine Uhr steht. Eine Frist in Motorzeit liefe hier **nie** ab |
| S3b 3-min-Fenster | **engine** + guard | Der Puls **ist** das Verhältnis der beiden |
| S6 `errStreak ≥ 5` | keine | Ein Bestand, keine Rate |
| Sprossen 0–3: Karenz, Wirkungsprüfung, Backoff-Fälligkeit | **guard** | §5.2 wörtlich |
| Sprosse 4a Auslösung (S3b ≥ 5 min) und Wirkung (Puls > 0,9 über 3 min) | **engine** | §5.2 wörtlich; der Erfolg ist „Engine tickt wieder" |
| Sprosse 5 Auslösung (S2 ≥ 6 h) | **motor** | §5.3 wörtlich |
| Sprosse 5 Wirkung (`lastAugReset` gesprungen, Konto > 0, 10 min) | **guard** | Nach einem Einbau gibt es noch keinen laufenden Motor |
| Deckel: 1/2 6× je 6 h; 3 2× je 6 h; 4a 1×/6 h + 3×/24 h | **guard** | §5.3 („alle in benannter Uhr") |
| Backoff-**Dauer** 5/15/30 min, 10/20/40 min, 2 h | **Wanduhr** | §5.2 wörtlich; ein Backoff soll reale Zeit verstreichen lassen |
| `blockedHosts` 60 min | **guard** | |
| `EXHAUSTED` / `NOT_EXECUTABLE` 12 h | **guard** | §5.2 wörtlich |

**Der Fehler, den diese Tabelle verhindert:** die Motorzeit des Kerns darf keine
einzige Wächterfrist tragen. Sobald der Kern hängt, steht sie — und jede in ihr
gemessene Frist liefe genau in dem Fall nie ab, für den sie gebaut wurde. Der
Bezeichner trägt die Uhr (`waitWatchdogMs`, `waitEngineMs`, `waitMotorMs`), und
ein Ebene-0-Lint prüft, dass keine `waitMotorMs`-Frist in Sprosse 0–3 vorkommt.

**Deckel 12 × Takt, nicht 2 ×.** Der verdeckte Tab liefert belegt genau 1 Runde
je 60 s. Bei 2 × Takt (20 s) überschritte jede Nachtrunde den Deckel, zählte 0
und löste eine Zeitsprung-Karenz aus: **die Leiter wäre nachts nie scharf** — und
Stufe B verlangt ausdrücklich eine Nacht mit verdecktem Tab. Umgekehrt zählte
eine gedrosselte Spielstunde nur 20 min und jede daraus abgeleitete Rate wäre um
Faktor 3 zu gut. Beide Fehler zeigen in dieselbe Richtung; der zu enge Deckel ist
die schlimmere Hälfte.

**S4 schaltet nichts ab.** Es lässt ruhen: die Wanduhr-Backoffs und die
rundenratenbasierten Wirkungsprüfungen, und verlängert die Wirkungsprüfung auf
mindestens 3 volle Eigenzeit-Runden. Alle Fristen laufen in Eigenzeit weiter.
Andernfalls wäre „Sprossen ≥ 2: 0" in Stufe B trivial erfüllt.

## 5.4 Sprossen

- **0 Umgebung** (S4/S5, keine Strafe): Timer-Patch nachziehen, Protokoll nach
  `data/events.json`. Popup-Behandlung bleibt bei `popups.js`, aber mit der
  **Schutzliste**: Dialoge mit `Cannot save game`, `REMOVED FUNCTION`,
  `Recovery` oder `Delete` werden **nicht** geschlossen, sondern mit den ersten
  120 Zeichen protokolliert, `kpi.json.blocked_dialog` gesetzt, Sicherungstakt
  auf 5 min. **Geld-Deadlock** (Konto < 0): alle `startWork`-Quellen mit
  laufenden Kosten beenden, Figur und Sleeves auf Verbrechen (Einnahmen sind bei
  negativem Konto nicht gesperrt), Käufe erst über einem Puffer freigeben; der
  Wächter stellt dafür einen Figur-Antrag mit `prio: 0` — er **gewinnt** die
  Figur über die Rangfolge, statt sie jemandem zu entreißen. Wirkung: Konto > 0
  binnen 30 min Eigenzeit; bleibt es 2 h negativ → Befund, keine Sprosse.
- **1 Werkzeug neu** (S1 + Engine tickt + kein Nachholfenster + Karenz):
  `scriptKill(datei, wirt)` auf allen bekannten Wirten des Werkzeugs, `laufend`
  bereinigen, `exec` in derselben Runde. **Der Wächter macht das allein**, auch
  remote (E2). Backoff 5 min Wanduhr.
- **2 Anderer Wirt** (1 zweimal verifiziert wirkungslos): **Auftrag an den Kern**
  über `data/watchdog.json.orders[]` mit `blockedHosts`. Der Kern wählt den Wirt
  mit meistem freien RAM **abzüglich der Sperrliste**, räumt Arbeiter
  (share → weaken → grow → hack), `scp` + Libs, `exec`. Ohne die Sperrliste ist
  „Wirt mit meistem freien RAM" nach dem Räumen genau der kaputte — das war das
  Muster der 17 wirkungslosen `wakelock`-Neustarts in 4 h (C.12). Bleibt kein
  Wirt → `NOT_EXECUTABLE(2)`, `reason: "no_space"` (zählt **nicht** auf den
  Deckel), Handlung `werkzeugWartetGb` + Ausbau. **Führt der Kern den Auftrag
  nicht binnen 3 min Eigenzeit aus, geht der Wächter direkt auf Sprosse 3** —
  das ist die Reißleine der Delegation.
- **3 Alles killen, `boot.js`** (S3a + Engine tickt + Karenz; ODER S6 sofort):
  `ps()` auf home, `kill(pid)` für alles mit `killSafe: true` plus Arbeiter,
  `reload.txt`/`task.txt` leeren, `exec("boot.js","home")`. **Nicht den Kern
  direkt starten** — nur `boot.js` weiß, wie `home` freigeräumt wird. Der Wächter
  trägt sich vorher in `watchdog.json` ein und prüft nach 6 min, ob er selbst
  noch läuft. Backoff 30 min. Engine steht → 4a.
- **4a Reload von innen** (S3b ≥ 5 min; 3 zweimal wirkungslos; **nicht bei
  Recovery**): nur über den benannten React-Prop `save` des
  CharacterOverview-Knotens (`GameRoot.tsx:536-541`), „Game Saved!" abwarten,
  `onbeforeunload = null`, `globalThis["loca"+"tion"].reload()`. **Der offene
  Punkt aus §1.6 ist entschieden: `location` kostet 0 GB** —
  `RamCalculations.ts:185-192` kennt als DOM-Sonderfall ausschließlich `document`
  und `window`, `location` steht in keinem Kostenbaum (verifiziert; dieselbe
  Auflösung erklärt, warum `darkweb.js` 2,65 statt 27,65 GB misst). Alle vier
  Riegel aus §5.3 gelten, einschließlich der Einstellungsprüfung aus
  `bridge.json.settings`. **Gebaut wird 4a nur, wenn Ebene 3 zeigt, dass ein
  skriptausgelöster Reload keinen `beforeunload`-Dialog stehen lässt** — sonst
  endet die Leiter bei 3. Das ist kein Verhandlungspunkt.
- **5 Soft-Reset durch Einbau**: der Wächter **führt nicht aus**, er beauftragt
  (E2). Der Kern prüft alle acht Vorbedingungen erneut und startet `punish.js`.
  `ns.singularity.softReset` wird **nicht** gebaut.
  **`punish.js` kostet 82,60 statt 162,60 GB, weil `queuedAugmentations` nicht
  per DOM gelesen wird.** Auftrag §5.3 sagt „nur per DOM lesbar
  (`install.js:82-93`)"; das ist widerlegt: `NetscriptFunctions/Singularity.ts:79-91`
  hängt bei `getOwnedAugmentations(true)` `Player.queuedAugmentations` an, bei
  `(false)` nicht — die Differenz **ist** die Warteschlange. Billiger und
  richtiger bleibt trotzdem: `bn4rep.js` weiß beim Kauf, was es gekauft hat, und
  schreibt `data/aug-queue.json`; `punish.js` liest sie für 0 GB.

**Der Wächter irrt in Richtung Untätigkeit** und schreibt jeden Verdacht.
`data/penalties.json`, Ringpuffer 200, nicht in den Räumlisten:
`{rung, target, reason, wall, playtime, motorTime, guardTime, round, node,
nodeReset, augReset, result, verifiedAt}`.

**Urteil von außen, das nur die Brücke fällen kann:** ist `data/watchdog.json`
älter als 15 min, während `data/bn4net.json` frisch ist, schreibt die Brücke nach
`## Sofort`. Im Spiel sieht dann niemand mehr hin — das ist der einzige Weg, den
Ausfall des Wächters selbst zu bemerken.

---

# 6 FIGUR-VERGABEPUNKT

## 6.1 Wer entscheidet, wer ausführt

**Die Entscheidung liegt im Kern** (Registry-Eintrag `bn4net.js` mit
`needsFigure: "owner"`): Anträge lesen, Rangfolge anwenden, `data/figure.txt`
schreiben — Kosten 0 GB. **Die Ausführung liegt beim Besitzer** und ist
ausnahmslos Singularity oder Bladeburner; der Kern fasst keine davon an, sonst
wäre er im ×16-Kaltstart nicht startbar (`commitCrime` allein wäre 80 GB).
**Die Kontrolle** liegt in `src/figwatch.js` auf der Werkbank
(`getCurrentWork` + `bladeburner.getCurrentAction`, 35,15 GB bei SF4.1 / 5,15
ab SF4.3) und meldet `figure_conflict` nach `events.json`.

## 6.2 Dateiformat

**Antrag** `data/figure-request-<tool>.json`, vom Gewerk geschrieben, mit TTL:

```json
{ "tool": "graft.js", "prio": 10, "action": "graft",
  "detail": { "aug": "Violet Congruity Implant", "restMs": 846000 },
  "reason": "graftplan Position 1, Entropie loeschen",
  "wall": 1788482100000, "motorTimeMs": 201599000,
  "nodeReset": 1788271154961, "ttlMs": 60000 }
```

**Vergabe** `data/figure.txt`, eine Zeile JSON, nur vom Kern geschrieben:

```json
{ "owner": "graft.js", "action": "graft", "since": 1788482101000,
  "leaseMs": 900000, "leaseBis": 1788483001000,
  "wall": 1788482101000, "nodeReset": 1788271154961, "seq": 4711 }
```

Rangfolge (§4.2): **Graft > Bladeburner-Aktion > Faktionsarbeit > Gym >
Verbrechen** als `prio` 10 / 20 / 30 / 40 / 50, kleiner gewinnt; der
Geld-Deadlock der Sprosse 0 nimmt `prio: 0`. Mit `data/simulacrum.txt` laufen
Graft und Bladeburner parallel — dann wird `owner` eine Liste mit höchstens
einem Nicht-Graft-Eintrag.

**Drei Eigenschaften, ohne die eine Datei nichts regelt:**

1. **Lease statt Besitz.** `leaseBis` läuft ab. Ein toter Besitzer hielte die
   Figur sonst bis zum nächsten Reset. Verlängert wird durch einen neuen Antrag;
   läuft die Lease ab, fällt die Figur an die Rangfolge zurück und der Vorfall
   geht nach `events.json`.
2. **`seq` monoton.** Wer `figure.txt` liest und eine kleinere `seq` sieht als
   beim letzten Mal, liest eine veraltete Datei (Werkbank/`home`-Rennen) und
   handelt **nicht**.
3. **`nodeReset` gestempelt.** Nach einem Sprung ist jede Vergabe ungültig.
   `figure.txt` steht **nicht** in den Räumlisten von `boot.js`; der Stempel
   ersetzt das Löschen und überlebt den Einbau, nach dem genau ein Skript ins Gym
   will.

## 6.3 Die Inventur und ihre Durchsetzung

Per Grep über `src/*.js` nach den Property-Namen (E8), nicht nach `ns.`-Präfixen:

| Datei | Fundstellen | RAM 41 | Zukunft |
|---|---|---:|---|
| `src/blade.js` | `:1098` travelToCity, `:1099` stopBladeburnerAction, `:1100` gymWorkout, `:3232` stopBladeburnerAction, `:3439` startAction | 174,35 | `needsFigure: "request"` |
| `src/graft.js` | `:143` travelToCity, `:173` stopBladeburnerAction, `:177` graftAugmentation | 145,45 | `needsFigure: "request"` |
| `src/bbtrain.js` | `:204` travelToCity, `:272` stopAction, `:303` gymWorkout, `:320` stopAction | 94,75 | `needsFigure: "request"` |
| `src/bn4life.js` | `:211` travelToCity, `:384` commitCrime | 293,85 | `needsFigure: "request"` |
| `src/bn4rep.js` | `:1854` workForFaction | 850,75 | `needsFigure: "request"` |
| `src/kampfaugs.js` | `:186` workForFaction | 387,85 | `needsFigure: "request"` |
| `src/joinrun.js` | `:56/:101/:111` über den Alias `const s = ns.singularity` (`:25`) | 371,35 | **ARCHIV** (§1.5 nennt `join*.js` namentlich als tot; C.14 nennt sein Gym als zweiten Teilnehmer am Ping-Pong) |

`src/bn4net.js:2691` und `:2822` sind **Kommentare**, keine Aufrufe — der Kern
fasst die Figur nicht an, und das bleibt so.

**Drei Schichten, weil eine Datei allein nichts erzwingt:**

1. **Code** (5–15 Zeilen je Datei, **+0,00 GB**): vor jedem figurberührenden
   Aufruf Antrag schreiben, `figure.txt` lesen, bei fremdem Besitzer
   **zurückkehren**. `ns.read`/`ns.write` kosten 0 GB — das ist für `bn4rep.js`
   (850,75) und `kampfaugs.js` (387,85) der Unterschied zwischen „geht" und
   „geht nicht".
2. **Verbotsgrep in Ebene 0, auf dem Worktree, BEVOR eine Datei live geht.** Ein
   figurberührender Name darf nur in einer Datei stehen, deren Registry-Eintrag
   `needsFigure` auf `request` oder `owner` setzt, **und** innerhalb von fünf
   Zeilen unter einem `hasFigure(`-Aufruf. Der Grep löst nach Property-Namen auf
   (E8) und liest die Namensliste aus **einer** Datei neben der Registry, nicht
   aus dem Grep-Aufruf — damit ein neuer API-Name in einer künftigen
   Spielversion an einer Stelle nachgetragen wird.
3. **Laufzeiterkennung** in `figwatch.js`: vergebene gegen tatsächliche Handlung,
   je Runde. §3.3 hat den Symptomwert bereits: `t_rebuild_h` weicht > 30 % ab.

**Warum das Ping-Pong damit endet.** C.14 beschreibt: `bbtrain` ruft
`stopAction()` bei Konto < 5 Mio → `joinrun` meldet „kein Kurs" → Gym → `bbtrain`
stoppt wieder. Danach: `joinrun` ist archiviert; `bbtrain` hält die Figur nur mit
gültiger Lease und gibt sie mit Begründung zurück, statt sie wegzuziehen; und der
Geld-Deadlock, der `bbtrain` überhaupt erst stoppen ließ, ist Sprosse 0 mit
`prio: 0`.

## 6.4 Was im ×16-Kaltstart mit der Figur geschieht

**Nichts, und das ist richtig.** Gym 32 GB, Verbrechen 80 GB, Faktionsarbeit
48 GB, `travelToCity` 32 GB — keines passt neben resident 16,85 auf 32 GB. Der
Vergabepunkt entsteht mit der Werkbank, nicht vorher; bis dahin gibt es keinen
Antragsteller, weil kein Gewerk mit Figurzugriff läuft. Das Tor 4×100 tragen die
Sleeves (E5). In Position 2 (BN10) hilft dabei die Gnadenregel
(`PlayerObjectGeneralMethods.ts:150-156`: **nur** `if (this.bitNodeN === 10)`,
und `RedPill.tsx:66` setzt `bitNodeN` auf den **neuen** Knoten **vor**
`prestigeSourceFile`): shock ≤ 25, sync ≥ 25. In den Positionen 3–7 gilt sie
nicht — dort steht shock auf 100 und sync auf `max(memory, 1)` = 1. Genau daran
hängt O2 in §10.

---

# 7 KALTSTART: DIE RANGFOLGE IN GB, MIT RECHNUNG

Frisches `home` 32 GB, 1 Kern, 1.262 $ (`PlayerObjectGeneralMethods.ts:102` +
`Constants.ts:107`), Position 2 = BN10 L3 mit SF4.1.

**Nach jedem Sprung existiert nur `NUKE.exe`** — verifiziert,
`ServerHelpers.ts:224-234`: `homeComp.programs.length = 0`, danach wird genau
`nuke` (plus BitFlume, falls vorhanden) zurückgelegt. Alle fünf Portknacker sind
weg, der Bot kann nur 0-Port-Server rooten. Der einzige bezahlbare Weg zurück ist
`src/darkweb.js` mit **2,65 GB** (Terminal über `globalThis["docu"+"ment"]`,
`darkweb.js:53`); mit Singularity kostete dasselbe `purchaseTor` + `purchaseProgram`
= 2 × `Fn1` × 16 = 64 GB plus Base und wäre nicht startbar. **Deshalb steht
`darkweb.js` in der Kaltstart-Registry — im Auftrag §4.4 fehlt es, und §1.3 nennt
es mit 27,65 GB, also um exakt ein DOM-Literal zu hoch.**

## 7.1 Die Rangfolge

| Rang | Was | GB | kumuliert | frei von 32 |
|---:|---|---:|---:|---:|
| — | `boot.js` (Autoexec, transient) | 5,50 | 5,50 | 26,50 |
| 2 | → startet `guard.js` | 6,10 | 11,60 | 20,40 |
| 1 | → startet den Kern | 10,75 | 22,35 | 9,65 |
| — | `boot.js` gibt frei, sobald der Kern läuft (`:163-168`) | −5,50 | **16,85** | **15,15** |
| 3 | `wakelock.js` (repariert) | 2,25 | 19,10 | **12,90** |
| 4 | **Rotationsplatz** — genau eines davon: | | | |
| | `cdump.js` (scannt `.cct`, schreibt `contracts.json`, endet) | 12,00 | 31,10 | 0,90 |
| | `csolve.js` (löst und kassiert, endet) | 12,25 | 31,35 | 0,65 |
| | `sleevecrime.js` + `darkweb.js` | 10,30 | 29,40 | 2,60 |
| | `sleevecrime.js` + `popups.js` | 10,95 | 30,05 | 1,95 |
| | `hashes.js` + `popups.js` + `darkweb.js` (nur BN9/SF9) | 11,90 | 31,00 | 1,90 |
| 5 | `worker/weaken.js`, so viele wie der Rest trägt | 1,80 je Faden | | |
| 7 | `shop.js`, sobald die Kaltstart-Leiter feuert (nicht in BN9) | 7,60 | | passt neben Rang 3 |
| 8 | `ausgang.js`, erst wenn die Tür in Reichweite ist | 8,15 | | |

`cdump` und `csolve` laufen **nacheinander, nie gleichzeitig** — zusammen 24,25
passen nirgends. Das ist kein Notbehelf: die beiden Hälften existieren und sind
laut §1.3 ungenutzt. Der Grund, warum die Rotation den vollen `contracts.js`
(17,65) schlägt, liegt in einer Funktion: `codingcontract.getContract` kostet 15,
`getContractType` + `getData` zusammen 10 (`RamCostGenerator.ts:384-392`).
`contracts.js` benutzt die teure, `cdump.js` die billige.

## 7.2 Die Gegenrechnung: was heute passierte

Ohne die beiden Diäten, mit dem heutigen Kern (17,75) und einem 8-GB-Wächter:

    resident 25,75, frei 6,25
    wakelock.js heute 34,25   -> groesser als das ganze home, NICHT startbar
    cdump.js     12,00        -> passt nicht
    csolve.js    12,25        -> passt nicht
    sleevecrime.js 7,65       -> passt nicht
    hashes.js     5,95        -> passt (aber in Position 2 wirkungslos, E7/E9)
    darkweb.js    2,65 + popups.js 3,30 = 5,95  -> passt

Der heutige Bot hätte in Position 2 **keine Geldquelle und keinen
Drosselungsschutz**. Das ist der gemessene Abstand zwischen „geplant" und
„gehofft", und er ist der Grund, warum E1 (Kerndiät) und der `wakelock`-Fix vor
allem anderen stehen.

## 7.3 Warum der `wakelock`-Fix zwei Zeichen kostet und 32 GB bringt

`wakelock.js:91` lautet `osc.connect(gain).connect(ctx.destination)`. Das ist Web
Audio. Der RAM-Rechner löst nur den nackten Property-Namen auf
(`RamCalculations.ts:216-243`), findet `singularity.connect` (`Fn1` = 2 GB) und
stellt bei ×16 **32 GB** in Rechnung. Die Messdatei bestätigt es unabhängig:
`wakelock.js` hat `singKosten41: 32` bei `lokal41: 34,25`. Mit
`osc["con"+"nect"](gain)["con"+"nect"](ctx.destination)` fällt die Datei auf
**2,25 GB in jedem Knoten und jeder SF-Stufe**.

Dieselbe Auflösung erklärt die Leichen in §1.5, die deshalb nicht repariert,
sondern als Lehrstücke vermerkt werden: `keepalive.js` (32 GB für `connect`),
`travel.js`, `probe.js`, `joinfac.js` (je 48 GB für einen eigenen Bezeichner
`joinFaction`). Daraus die **Namensregel**: kein Bezeichner im neuen Code heißt
wie eine Netscript-Funktion; der Verbotsgrep prüft es.

---

# 8 PORTIERUNGSLISTE

**Regel: ohne Messung kein Ändern.** Eine Messung ist A1 (RAM über Budget), A5
(Block läuft im Zielzustand nicht), 8.1 (Eichpunkt verfehlt) oder ein datierter
Vorfall. Ein Argument ist keine Messung. Eine fehlende Messung ist kein Freibrief
zum Archivieren.

| Modul | Urteil | Die Messung, die es erzwingt |
|---|---|---|
| `src/wakelock.js` | **ÄNDERN** (Rang 1) | 34,25 GB gemessen, davon 32,00 aus der Namensgleichheit. 34,25 > 32 → im Kaltstart **nicht startbar**. Zwei Zeichen, 32 GB (§7.3). |
| `src/bn4net.js` | **ÄNDERN, chirurgisch** | A1: resident 17,75 + 8,00 = 25,75 reißt die 20 um 5,75, mit `boot.js` 31,25 die 28 um 3,25. Diät auf 10,75 (E1). Zusätzlich: die Kaltstart-Leiter `:733-749` rechnete am 02.09. mit BN6-Preisen und kostete 13,5 h Stillstand — der Preis kommt jetzt aus `shop.js`. Sonst nichts. **Der Dateiname bleibt** (§9, R2). |
| `src/boot.js` | **ÄNDERN, minimal** | Nicht wegen RAM (5,50 statt 4,0; mit der Kerndiät hält die Summe bei 22,35). Erzwingend ist die **Schonliste**: `boot.js:119-129` beendet alles auf `home` außer sich selbst, solange der Kern nicht läuft — also auch `guard.js`. Ausnahme für `guard.js` und `ausgang.js` plus Nachstart, Namen aus `registry.json`, kein Literal. C.15 („gibt nach 20 min auf") ist ausweislich `:110-121` erledigt. |
| `src/sleevecrime.js` | **ÄNDERN** | §1.4: „Marker landet auf dem Mietrechner statt `home`". §5.1 nennt die Folge wörtlich: Werkbank-Schreiber ohne `scp` → **Dauerkill**. `scp` nach `home`, danach neu messen. Selbstauskunft `:2` sagt 5,6, real 7,65. |
| `src/sleeve.js` | **ÄNDERN** | Datierter Vorfall 02.09.: Konto **−18,5 Mio in 5 min**. Der Geldboden wird die Rückstandsrechnung aus §4.3 (`money ≥ 2.400 × (storedCycles/5 + TAKT/1000)`), nicht eine Rate: 8 h verdeckter Tab = 69,1 Mio je Körper, die alte 5-Mio-Schwelle deckte 67 s. Dazu: die Statverteilung ist im frischen Knoten außerhalb BN10 wirkungslos, solange shock 100 ist — dort gehören die Hüllen aufs Verbrechen, nicht ins Gym (E5, O2). Die RAM-Abweichung (27,85 statt 14,75) allein erzwänge nichts. |
| `src/popups.js` | **ÄNDERN** | Nicht wegen 3,30 statt 1,6. Erzwingend ist die Schutzliste aus §5.3: ein Escape-Handler ohne sie macht aus `Cannot save game` (`SaveObject.ts:245-251` — das Spiel läuft weiter, **ohne zu speichern**) einen stillen Fehler. |
| `src/ausgang.js` | **ÄNDERN** | 8,15 gemessen, Budget 8,5 — kein RAM-Grund. Erzwingend: §4.1 verlangt `route_state` (`route-fertig`/`blocked`) als Zustand und §4.3 `eta_min` für die Endspurt-Regel; die Datei liefert heute beides nicht, und ohne `eta_min` gibt es keine Wirtreserve (E10). Dazu der Backup-Handschlag spielseitig. |
| `src/exit.js` | **ÄNDERN, +0,00 GB** | 519,25 GB live bestätigt — §1.6 kann „nur gerechnet" streichen. Die Zielvalidierung (Ziel == nächster offener Routeneintrag) ist `ns.read("route.json")` + `JSON.parse`, beides **0 GB**. Die Wirtregel `2^ceil(log2(519,25))` = **1024 GB**, nicht die in §1.4 genannten 540. |
| `src/cdump.js` / `src/csolve.js` | **ÄNDERN, klein** | 16,85 + 24,25 = 41,10 > 32 → Rotation statt Nebeneinander (§7.1). Ergänzung: je gelöstem Vertrag `{ts,host,file,type,difficulty,rewardType,payout}` nach `data/events.json` — das eicht den offenen Vertragsertrag (O4) nebenbei und kostet nichts. |
| `tools/checkin.js` | **ÄNDERN** | Messung 04.09.: lineare Hochrechnung ergibt **430 Tage**, die Rangkurve von Lauf 1 (`tools/lib/rangkurve.js`) ergibt **28–50 h** Spielzeit. Faktor ~200. Träger ist die Aktionsstufe über `rewardFac^(level-1)`, nicht der Spielerrang — §3.3 begründet das falsch. Die letzte Zeile jedes Berichts ist Erics ausdrückliche Forderung; eine um Faktor 200 falsche Zahl dort ist der teuerste Einzelfehler im Werkzeugkasten. |
| `src/blade.js` | **BLEIBT** (+ Figurwache, +0,00 GB) | **174,35 / 99,35 gemessen.** §1.6 sagt, „die kolportierte 174 steht nirgends" — sie ist der Messwert; keine der drei Auftragszahlen (162,25 / 94,85 / 27,6) trifft. Das ist eine **Dokumentationskorrektur**, keine Codeänderung. Ob ein Aufteilen den Aktionsmotor unter ~40 GB brächte, ist **nicht gemessen** und wird nicht vorab entschieden (O5). |
| `src/darkweb.js` | **BLEIBT** | 2,65 gemessen — §1.3 („27,65") lag um exakt ein DOM-Literal daneben. Der `globalThis`-Trick wirkt. Nur die Doku wird korrigiert; die Datei bekommt einen Registry-Eintrag und wird damit zum Kaltstart-Pflichtwerkzeug (§7). |
| `src/contracts.js` | **BLEIBT** | 17,65 bestätigt. 16,85 + 17,65 = 34,50 > 32 → nicht kaltstartfähig, ab Werkbank aber die bessere Wahl. Kein Grund, die Datei anzufassen; die Registry entscheidet, wann sie läuft. |
| `src/bn4rep.js` | **BLEIBT** (+ Figurwache, + `aug-queue.json`) | 850,75 gemessen; lief in BN10 L2 **26 h nicht** (§1.4) — Ursache ist der Wirt (893,29 GB nötig), nicht der Code. Ab SF4.3 sind es 63,25 und die Datei läuft auf jeder Werkbank. Neu: schreibt beim Kauf `data/aug-queue.json` (§5.4). |
| `src/graft.js` | **BLEIBT** (+ Figurwache) | 145,45 gemessen. Die Grafting-**Automatik** (`graftplan.json`, Reihenfolge, Budgetregel, Violet Congruity früh) ist ein **neues** Gewerk, kein Umbau; `tools/graftnext.js` wandert als Treiber nach innen. |
| `src/hashes.js`, `src/hacknet.js` | **BLEIBT** | 5,95 / 9,45 bestätigt. „Nie in BN9 gelaufen" ist eine **fehlende** Messung, keine. Registry-Einträge mit `requiresFeature: 9` (E7); Ebene 3 prüft sie mit gesetztem Knoten. Nur ein roter Test erzwingt eine Änderung. |
| `src/bn4life.js`, `homegrow.js`, `bn4door.js`, `bbtrain.js`, `kampfaugs.js` | **BLEIBT** (+ Figurwache bei bbtrain/bn4life/kampfaugs) | 293,85 / 148,50 / 99,85 / 94,75 / 387,85 bestätigt. Der Faktor 16 ist real, aber keine Messung sagt, dass sie sich falsch verhalten. Sie werden **verwaltet** (Wirtregel, gerechneter Wirtbedarf), nicht umgebaut. Ohne Registry-Eintrag startet keines — das reicht als Riegel. |
| `src/worker/{hack,grow,weaken,share}.js` | **BLEIBT, unberührt** | 1,75 / 1,80 / 1,80 / 4,00 bestätigt, passen überall. |
| `src/route.json` | **UNBERÜHRT** | §2.1: die Reihenfolge ändert niemand. |
| `src/joinrun.js` | **ARCHIV** | §1.5 nennt `join*.js` namentlich als tot; C.14 nennt sein Gym unabhängig als zweiten Teilnehmer am Figur-Ping-Pong (§6.3). |
| §1.5-Liste gesamt (16 tote Dateien + die 47 ohne Aufrufer) | **ARCHIV, vor Stufe A, eigener Commit** | `exploit3.js` enthält `bitburnerSave`, sechs tote Dateien enthalten `while (true)` — der Verbotsgrep aus §6.1 ist rot, solange sie liegen, und Stufe A wäre unerreichbar. Leichen im Spiel per `deleteFile`. |
| `sync/bridge.js` + Handschlag, `tools/backup*.js`, `klon.js`, `test-*.js`, `rangkurve.js`, `pruefstand/*` | **BLEIBT** | Abgenommen (Gate 0, Gate A2). |
| `tools/task.js` | **UNBERÜHRT** | Auftragsverbot. |

**Neu zu bauen** (keine Portierung): `registry.json`, `src/lib/reg.js`,
`src/guard.js`, `src/shop.js`, `src/punish.js`, `src/figwatch.js`, Motorzeit im
Kern, `kpi.json`/`events.json`/`penalties.json`/`sofort.json`, Kaltstart-Gewerk,
Grafting-Automatik, `boerse.js`, BN9-Gewerk, BN15-Tor.

---

# 9 BAUREIHENFOLGE FÜR PHASE C

Sortiert nach **Frist**, nicht nach Ertrag — die nächste Tür geht in 28–50 h
Spielzeit auf, und was bis dahin nicht steht, wird für einen ganzen Lauf
nachgeholt. Ertrag entscheidet nur zwischen fristgleichen Positionen.

| # | Position | Frist | Ertrag / Begründung | Einzeln live? | Einzeln abnehmbar? |
|---:|---|---|---|---|---|
| **C.1** | `kpi.json` + `events.json` + Motorzeit im Kern + Herzschlag v2 (`errStreak`, `lastError`, `okRound`, `motorTimeMs`, `state`, `blockedReason`) | zuerst | Auftrag §8 Phase C verlangt es wörtlich als Erstes: ohne diese Felder kann der Wächter nichts entscheiden und keine Abnahme etwas messen | **Ja**, je Schreiber eine Datei | Ja, **Ebene 0**: 8 h gedrosselt = 8 h Motorzeit; 8 h Rechner aus = 0; Nachholklumpen = 0 |
| **C.2** | `wakelock.js`: `osc["con"+"nect"]` | vor dem nächsten Kaltstart | **−32,00 GB für zwei Zeichen.** Bestes Verhältnis im ganzen Plan; entriegelt Rang 3, der heute reißt | **Ja**, eine Datei | Ja: `calculateRam` = 2,25 über die Brücke; Tonanker hält (`sonde.json` unverändert) |
| **C.3** | `ausgang.js`: `eta_min`, `route_state`; `exit.js`-Zielvalidierung; **Wirtreserve E10 und die Räumkette L1–L5** (§9.1); `checkin.js`-ETA | **vor dem Sprung aus Position 1 — 28–50 h** | Behebt einen sich selbst stabilisierenden Deadlock (E10) und macht den beobachteten Sprung (Abnahmestufe C) überhaupt bewertbar | Ja, je Datei | Ja: `jump_latency_min ≤ 2` abzüglich `backup_wait_min`; ETA gegen die Rangkurve statt linear |
| **C.4** | `registry.json` + `src/lib/reg.js` (Leser, 0 GB) | vor C.5 | Der Plan wird lesbar, bevor ihn jemand befolgt | **Ja** — beide inert, solange kein Leser läuft | Ja, **Ebene 0**: der Leser reproduziert für BN10/V2 exakt die heutige `WERKZEUGE`-Liste (`bn4net.js:257-347`) **und** die `TELEMETRIE`-Tabelle (`:61-67`). Das ist der Migrationsbeweis |
| **C.5** | Kern liest Registry statt der zwei Arrays | vor C.6 | Ein Ort für „was und wo" | Ja | Ja: 12 h live, gestartete Einträge identisch zur Vorwoche, `false_kill_count` = 0 |
| **C.6** | `guard.js` im **Beobachtungsmodus** (`modus: "observe"`) **plus `boot.js`-Schonliste, im selben Commit** | vor C.7 | **Die wichtigste Position.** Alle Signale, alle Übergänge, `penalties.json` mit `result: "would-execute"` — keine Ausführung. Die Schonliste muss mit, sonst räumt `boot.js` den Wächter weg, den es überwachen soll | **Nein, gebündelt** (zwei Dateien, ein Commit) | Ja: eine Nacht verdeckter Tab, `false_penalty_count` = 0, **bevor** die Leiter scharf wird. Ohne diesen Schritt ist die erste scharfe Nacht der Test |
| **C.7** | Kaltstart-Kern: `cloud.*` → `shop.js`, `hackAnalyze`-Familie inline, Kaltstart-Leiter mit echtem Preis | **vor dem Kaltstart der Position 2** | Ohne diese Position steht die Rangfolge bei Rang 3 und der Kaltstart hat keine Geldquelle (§7.2) | Ja, aber nur zusammen mit C.2 | **Nur Ebene 3**: echter Kaltstart auf 32 GB, SF4.1, `t_workbench` gegen den Knotenpreis. „Im Zielzustand testen" ist die Lehre vom 20.08. |
| **C.8** | Kaltstart-Geldkette: `cdump`/`csolve`-Rotation mit `payout`, `darkweb.js` in die Registry, `sleevecrime.js` mit `scp` | mit C.7 | Die einzige Geldquelle der Positionen 2–4 (E9); eicht O4 nebenbei | Ja, je Datei | Ja, Ebene 3 im Kaltstart-Klon: erster Vertrag gelöst und kassiert vor Minute 20 |
| **C.9** | Sprossen 0–2 scharf | nach C.6 | Werkzeug-Hänger heilen sich | Ja, Flag je Sprosse | Ja: je Sprosse ein provozierter Hänger in Ebene 3; `blockedHosts` greift; die Reißleine der Sprosse-2-Delegation feuert |
| **C.10** | Sprosse 3 scharf | nach C.9 | Kern-Hänger heilen sich | Ja | Ja, **Pflichttest §5.2**: Kern-Motorzeit eingefroren, Engine tickt → eskaliert in ihrer Karenz |
| **C.11** | Figur-Vergabepunkt: Entscheidung im Kern, `figwatch.js`, Wachen in 6 Dateien, Verbotsgrep-Regel | vor dem ersten Graft | Beendet C.14 und schützt laufende Grafts ($14,63 Mrd Einzelrisiko) | **Nein, gebündelt**: Vergabepunkt und Wachen müssen zusammen live, sonst gewinnt ein ungebändigtes Skript. Je Datei einzeln eingespielt, Vergabepunkt zuletzt | Ja: `figure_conflict` = 0 über 12 h; `t_rebuild_h` nach dem nächsten Einbau innerhalb 30 % von 3,1 h |
| **C.12** | Sprosse 4a (nur nach Prüfstandsbeleg) und Sprosse 5 (`punish.js`) | nach C.10 | Die letzten zwei Sprossen | Ja | 4a: `save`-Prop und ausbleibender `beforeunload`-Dialog in Ebene 3 belegt — **sonst wird 4a nicht gebaut**. 5: alle acht Vorbedingungen, Trockenlauf im Klon |
| **C.13** | **BN9-Gewerk**: kein `shop.js`, Werkbank = größter gerooteter Fremdrechner, `home`-Ausbau ×5, `hashes.js` ab Minute 0, Räumkette L1 | **vor Position 5 — vier Läufe** | Drei Läufe hintereinander ohne Mietrechner (`CloudServerLimit 0`, verifiziert `BitNode.tsx:816`), und die ertragreichste Geldquelle der Route. Ohne das Gewerk hängt der Bot dort in `NOT_EXECUTABLE`, meldet es nur nach `## Sofort`, und niemand liest es | Ja | Nur **Ebene 3** mit per Dev-Menü gesetztem Knoten |
| **C.14** | Grafting-Automatik | nach C.11 | Größter Posten nach der Route: Faktor 10–20 auf den Rangweg | Ja (neues Gewerk) | Ja: `graft_busy_pct` → 100 %, `graft_aborted` = 0 |
| **C.15** | `boerse.js` (BN8), BN15-Tor | Position 35 ff. | Löscht `skipped_route_entries` = 3 | Ja, je Gewerk | Nur Ebene 3 mit gesetztem Knoten |

**Warum C.3 vor C.4 steht, obwohl die Registry das tragende Teil ist.** Die
Registry macht den Bot dauerhaft besser; die Wirtreserve entscheidet über den
Sprung, der in 28–50 h fällig ist. Eine These, die einer Frist im Weg steht,
weicht.

**Warum C.6 vor C.9 steht.** Ein Wächter, der zuerst beobachtet, kostet eine
Nacht. Ein Wächter, der zuerst zuschlägt, kostet im schlechtesten Fall einen
Lauf — und §3.2 verlangt `false_penalty_count` = 0, eine Zahl, die nur vor dem
Scharfstellen günstig zu bekommen ist.

## 9.1 Die `exit.js`-Räumkette, vollständig

§4.4 nennt drei Schritte; fünf Lücken werden hier geschlossen:

| # | Lücke | Ergänzung |
|---|---|---|
| **L1** | Schritt 3 ist in BN9 unmöglich (`CloudServerLimit 0`, Positionen 5–7) | Zweig: Wirt = größter gerooteter Fremdrechner ≥ RAM + 5 %; sonst `home` ausbauen (`HomeComputerRamCost 5`); sonst `NOT_EXECUTABLE` mit Befund |
| **L2** | Keine Geldstufe — die Kette endet bei „Preis gegen Kontostand" ohne Zweig für „reicht nicht", und die Endspurt-Regel verbrennt genau dieses Geld | **Die Wirtreserve wird vor der Endspurt-Regel abgezogen** (E10). Ohne diese Ergänzung widersprechen sich zwei Auftragsregeln direkt |
| **L3** | `deleteServer` tötet, was darauf läuft | Ausschlussliste: nie der Wirt des Kerns, nie der des Wächters, nie der mit dem jüngsten `figure.txt`-Besitzer |
| **L4** | Eine verdrahtete 1024 verbrennt ab SF4.3 in jedem Lauf 412 Mio für nichts (519,25 gegen 39,25 ist Faktor 13) | `ns.getScriptRam("exit.js")` zur Laufzeit (0,10 GB, im Kern eingeplant) |
| **L5** | Schritt 2 („Gewerke dort beenden, Kern und Wächter zuletzt, nie beide") hat keine Reihenfolge | `evictRank` aus `registry.json`, aufsteigend; für Arbeiter share → weaken → grow → hack |

---

# 10 OFFENE PUNKTE

Gate B ist bestanden, wenn kein Punkt mit **JA** offen ist.

| # | Punkt | Blockiert Bau | Die Messung, die ihn entscheidet |
|---|---|---|---|
| **O1** | `guard.js` = 6,10 GB und Kern = 10,75 GB sind **gerechnet**, nicht gemessen — die Dateien gibt es so noch nicht | **NEIN** | Nach dem Bau `calculateRam` über die Brücke gegen das laufende Spiel, vor der Freigabe der jeweiligen Position. Verfehlt der Kern 12,0 oder der Wächter 8,0, ist das ein Befund und keine Nachverhandlung der Schwelle. Der Rechenweg ist an 114 Dateien auf 0,00 GB geeicht |
| **O2** | **Covenant-Frist.** Zusätzliche Sleeves und `memory` sind nur in BN10 kaufbar (Frist: Sprung aus Position 2), das Tor verlangt aber 20 Augs + $75 Mrd + Hacking 850 + **alle vier Kampfwerte 850**; live sind es 15 / 19,77 Bio / 345 / 100–112 | **NEIN** | Aus dem Live-Spielstand rechnen: (a) Hacking-EXP-Rate der laufenden HWGW-Flotte → Stunden bis 850; (b) Kampf-EXP-Rate aus Bladeburner → Stunden bis 850; (c) Augs bis 20 über `bn4rep`-Kaufliste. Liegt die Summe unter dem Ertrag von `memory` 25 auf 38 Restläufe, wird ein Covenant-Zweig gebaut; sonst wird der Punkt **geschlossen** in `BEFUNDE.md` geführt. Entscheidung spätestens vor dem Sprung aus Position 2 |
| **O3** | Sprosse 4a: ob ein skriptausgelöster Reload einen `beforeunload`-Dialog stehen lässt, ist **vermutet** | **NEIN** — die Leiter endet bis dahin bei 3 | Ebene 3, `pruefstand/serve.js` mit Klon: Existenz des `save`-Props (`GameRoot.tsx:536-541`), „Game Saved!", und ob nach `onbeforeunload = null` ein Dialog bleibt. §5.3 macht den Bau von 4a von genau diesem Beleg abhängig |
| **O4** | Geld je Vertrag: Modell und Feldwert (24 Stück = 86 Mio am 02.09.) liegen um Faktor ~6,6 auseinander | **NEIN** — die Rangfolge aus E9 hält auch mit dem Feldwert als Untergrenze (365 gegen 64 $/(s·GB) für Sleeve-Verbrechen) | `csolve.js` schreibt je gelöstem Vertrag `payout` nach `events.json` (Position C.8, kostet nichts). Eine Nacht entscheidet. Betrifft die **Zeitplanung** (`t_workbench`), nicht die Reihenfolge |
| **O5** | Ist `blade.js` (174,35 / 99,35) in Aktionsmotor, Skillplan und Spannenrechner teilbar, sodass der Motor unter ~40 GB fällt? | **NEIN** | Gemessen ist nur, dass 174,35 GB die Werkbank in Position 2 auf 256 GB (85,18 Mio $) zwingt. Die Teilbarkeit ist **nicht gemessen**. Der Auftragswert 27,6 ist strukturell unmöglich — allein die Bladeburner-Funktionen von `blade.js` liegen darüber. Erst messen, dann entscheiden |
| **O6** | Wirkung des Worker-Timer-Patches (`hacktimer.js` ist nie gelaufen) | **NEIN** | §3.3 führt sie als **Beobachtungsgröße, nicht als Sollwert**. Ebene 3 mit verdecktem Tab misst `throttle_rounds_per_min` mit und ohne Patch |
| **O7** | Zahl der Sleeves nach dem Sprung: `min(3, sourceFileLvl(10) + (BN10?1:0)) + sleevesFromCovenant` ergibt heute 2 und für Position 2 rechnerisch 3 | **NEIN** | §3.3 verlangt es wörtlich: `ns.sleeve.getNumSleeves()` zur Laufzeit lesen, nie annehmen; im Klon gegenprüfen, nicht unterstellen |
| **O8** | Stanek (BN13): ob die Gabe nach SF7.3 überhaupt noch erreichbar ist | **NEIN** — Phase D | Eine Stunde im Klon mit per Dev-Menü gesetztem SF7.3. Ist der Ausschluss bestätigt, entfällt Stanek ersatzlos und wird als **geschlossener** Punkt geführt |
| **O9** | Go (BN14) und BN15-Labyrinth | **NEIN** — Entscheidungstore vor Position 29 bzw. 35 | BN14: gemessener Anteil der Beitrittsphase an den BN7-Läufen (Positionen 26–28). BN15: Lauf 1 als V2-Messlauf mit paralleler `ns.dnet`-Erkundung |

**Kein offener Punkt blockiert den Bau. Gate B ist damit aus Sicht dieses Plans
bestanden.**

---

## Anhang — was aus den Entwürfen NICHT übernommen wurde

Aus **B1**: `figure-cold.js` (im Zielzustand funktionslos, E5); `figure.js` mit
228,55 GB (die Entscheidung kostet 0 GB, E5); `requiresSF: {"9":1}` (sperrt
`hashes.js` in BN9 aus, E7); `precondition.minHostRamGb` (Verdopplung einer
rechenbaren Größe, E3); der Wächter mit 7,30 GB (kauft Sprosse-2-Funktionen, die
nur mit lebendem Kern gebraucht werden, und kostet dafür die Kaltstart-Geldquelle,
E2); die ertragsgetriebene Baureihenfolge (durch die fristgetriebene ersetzt, §9);
die implizite Pflege einer SF4.2-Spalte (der Fall tritt nie ein, E4).

Aus **B2**: der Kern mit 11,05 GB (0,30 GB doppelt gezählt, E1); der Wächter mit
5,80 GB (Addenden ergeben 4,80; ohne Mittel, auf einem fremden Wirt zu handeln;
ohne `getResetInfo`, E2); die Umbenennung des Kerns nach `core.js` (B2 belegt in
seinem eigenen R2, dass `boot.js:166` hart auf `bn4net.js` prüft und der Bot
danach still stirbt — der Name bleibt, §8); die Regel „kein Gewerk ruft
`getResetInfo`" als pauschale Änderung an *jedem* vorhandenen Gewerk (das ist
Ändern ohne Messung; sie gilt nur für neu gebaute Module); die Darstellung der
Covenant-Sache als Bauposten mit gesicherter Finanzierung (das Tor ist zu, E11/O2);
die Versöhnungsrechnung zum Vertragsertrag („Faktor 4 von 6,6 durch Faktionen") —
der Faktionseffekt ist rund 1,78, der Rest bleibt offen (O4), der daraus gezogene
Schluss bleibt aber richtig.

Aus dem **Auftragstext** korrigiert: `boot.js ≤ 4,0` (gemessen 5,50, Forderung
entfällt, E1); `blade.js` 162,25 / 94,85 / 27,6 (gemessen 174,35 / 99,35);
`darkweb.js` 27,65 (gemessen 2,65); `sleeve.js` 14,75 (gemessen 27,85);
`sleevecrime.js` 5,7 (gemessen 7,65); `popups.js` 1,6 (gemessen 3,30);
`bn4rep.js` 846,8 (gemessen 850,75); `exit.js`-Wirt „≥ 540 GB" (richtig 1024);
Wächter „gerechnet 5,6 / 7,6 GB" (gerechnet 6,10 für den vollen Satz);
`queuedAugmentations` „nur per DOM lesbar" (widerlegt, §5.4); RAM von
`globalThis["location"].reload()` „0 gegen 25" (entschieden: **0**, §5.4);
Kaltstart-Rangfolge Hashes vor Verträgen (in den Positionen 2–4 umgekehrt, E9);
`hashes.js` an SF9 gebunden (richtig: `node === 9` **oder** SF9 ≥ 1, E7).
