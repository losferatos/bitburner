# Schlupfloecher, Fallen und Exploits im Spielcode

**Stand:** 20.08.2026
**Geprueft gegen:** `reference/v301/src` (Tag v3.0.1, `Constants.ts:7` VersionString `"3.0.1"`) — das ist die
Fassung, die tatsaechlich laeuft.
**Am Spiel wurde nichts geaendert, nichts committet, kein Spielstand angefasst.**

---

## 0. Vorbemerkung zur Quelle — bitte zuerst lesen

Der Auftrag nannte `reference/bitburner-src/src/` als Quelle. **Das ist der falsche Baum.**
`reference/bitburner-src/src/Constants.ts:7` traegt `VersionString: "3.0.2"` (Dev-Zweig),
`reference/v301/src/Constants.ts:7` traegt `"3.0.1"`. Ein `diff -rq` ueber beide Baeume zeigt
mehrere hundert abweichende Dateien.

Fuer die Befunde hier relevante Unterschiede, die ich einzeln geprueft habe:

| Datei | Unterschied | Wirkung auf die Befunde |
|---|---|---|
| `NetscriptFunctions/Extra.ts` | 3.0.1 nutzt die doppelte Pfeilform `(ctx) => (arg) => …`, 3.0.2 die einfache | keine, nur Zeilenversatz |
| `Exploits/applyExploits.ts` | 3.0.2 hat zusaetzlich `dnet_money` | keine |
| `Netscript/RamCostGenerator.ts` | 3.0.2 hat ein paar neue Eintraege (`isFullPort`, `renderPage`, …) | keine fuer die zitierten Kosten |
| `Prestige.ts` | 3.0.2 hat `Terminal.prestige()` statt `finishAction`+`clear`, und `deleteStockMarket()` | keine |
| `CodingContract/ContractGenerator.ts` | Kleinigkeiten | Zeilennummern unten sind aus v301 |
| `Exploits/Exploit.ts`, `loops.ts`, `Unclickable.tsx`, `Script/RamCalculations.ts`, `Augmentation/AugmentationHelpers.ts`, `Faction/*`, `Go/*`, `NetworkShare/Share.ts` | **identisch** | — |

**Alle Zeilenangaben unten beziehen sich auf `reference/v301/src`**, ausser wo ausdruecklich
`(3.0.2)` dabeisteht. Wo ein Befund aus einer Datei stammt, die ich nicht selbst gegen v301
gegengelesen habe, steht das dabei.

---

## 0.1 Was hier wirklich neu ist — und was nicht

Ich habe nach dem Schreiben gegen die vorhandenen Unterlagen abgeglichen. Ein erheblicher Teil
stand schon da. Damit du nicht zweimal dasselbe liest, hier die ehrliche Trennung:

**Neu und handlungsrelevant:**

| Fund | Warum neu |
|---|---|
| **A0** — der **Spendenweg** ab Favor 150 | Kommt in keiner Unterlage als Ziel vor. **Faktor 36,7** gegenueber Faktionsarbeit, und der Knopf hat keine `isTrusted`-Pruefung |
| **Abschnitt 3** — der Exploit-Bonus wirkt **im Exponenten** | `auffaellige-werte.md:664-667` hat das System als "gibt keinen Hebel" abgehakt. Ueber `calculateExp(L,m)` sind drei Exploits **12,7 Stunden** weniger Muehle. Dazu das geknackte `ns.rainbow`-Passwort |
| **A2** — die Daedalus-Zahl in `auffaellige-werte.md:650` ist **um Faktor 2,5 zu klein** | +24,1 % statt +9,7 % bei nodePower 5.000. Diese Zahl war der Grund, die Go-Schiene zu verwerfen. Und der Zweck fehlte dort: 21,6 % des Weges zu Favor 150 |
| **A4** — die `__reactProps`-Technik gilt fuer die **zwoelf Klick-Sperren**, nicht nur fuer Join | `doku/join-problem.md:19-23` beschraenkt sie ausdruecklich auf den Join-Knopf. Praktischer Nutzen aber begrenzt, siehe A4 |
| **A3** — die offene Frage aus `strategie.md:1281-1284` ist beantwortet | Es sind **150 Rep/h**, nicht 30. Die dortige Schlussfolgerung "vernachlaessigbar" trifft heute aber zu (190 Rep/h) — sie wird erst mit hohem Favor falsch |
| **A9** — Reload gibt dauerhaften Focus (+25 %) | `auffaellige-werte.md:714-715` plant "Fokus-Terminplanung" von Hand. Der Reload-Weg macht das ueberfluessig. **Ungemessen** |
| **V14, V15** — `startWork` vernichtet Crime-Teilfortschritt; Programmbau ueber 99,995 % blockiert sich dauerhaft selbst | In keiner Unterlage gefunden |
| **V16** — `buy -a` bricht beim ersten unbezahlbaren Posten ab, und SQLInject steht vor den billigen | In keiner Unterlage gefunden |
| **A10c** — Firmen-Backdoor senkt die geforderte Rep auf 75 % | In keiner Unterlage gefunden |
| **A1 (Teilbefund)** — der DarkNet-Pfad umgeht den Schwierigkeitsdeckel | `DarkNet/effects/cacheFiles.ts:85` erzeugt Contracts aller 30 Typen, bis 125 Mio. $ je Stueck |

**Stand schon da, ich baue nur darauf auf:** `#terminal-input` und die 42 Terminal-Befehle
(`oberflaeche.md:18`, `oberflaeche-ablaeufe.md:1045`), die `__reactProps$`-Technik selbst
(`join-problem.md`), der ungeschuetzte Join im Einladungs-Modal (`join-problem.md:99-101`), die
Formelsammlungen (`formeln-*.md`).

**War schon bekannt oder sogar schon gebaut, zaehlt nicht als Fund:**
**A1** (Coding Contracts — `auffaellige-werte.md:450-472` hat den `maxDif`-Deckel, die fuenf
Typen, den Doppel-Divisions-Fehler und die Bewertung; **`src/contracts.js` loest bereits alle
30 Typen**), **A11.6** (`ns.share`, laut `auffaellige-werte.md:677-684` bereits bei Bonus
1,5373 und ausgereizt), **A4 im Kern** (`auffaellige-werte.md` Punkt 4: "Tian Di Hui wurde heute
genau so beigetreten").

**Was ich uebersehen habe und was `doku/auffaellige-werte.md` besser hat:** die Backdoor-Regel
als Fraktionsschluessel (Punkt 4/6 dort: `avmnite-02h` **2,1 s**, `I.I.I.I` **2,9 s**, danach
erzwungene Einladungspruefung) hat das beste Verhaeltnis von Wirkung zu Aufwand auf dem ganzen
Brett — fuenf Sekunden Spielzeit fuer zwei Fraktionen und elf Augmentations. Das taucht bei mir
nur als Fussnote A11.7 auf. Es gehoert in jede Prioritaetenliste vor alles hier Genannte.

---

# 1. Was uns SCHADET — vermeiden

Nach Wirkung sortiert. Die ersten fuenf sind die, die einen Nachtlauf tatsaechlich toeten.

---

### V1 — Selbstmord ohne `return` friert den ganzen Browser-Tab ein

**Beobachtung.** `ns.kill` auf die eigene PID, `ns.killall(host, false)` und `ns.scriptKill` auf den
eigenen Dateinamen setzen nur `stopFlag`, rufen `atExit` und geben das RAM buchhalterisch frei —
**der JavaScript-Code laeuft weiter.** Er stirbt erst beim naechsten ns-Aufruf, wo `checkEnvFlags`
`ScriptDeath` wirft. Eine Schleife ohne ns-Aufruf laeuft danach ewig, ist nicht mehr toetbar,
belegt kein RAM mehr, und blockiert den Hauptthread — das Spiel steht.

**Beleg.** `Netscript/killWorkerScript.ts:63-92` (`stopAndCleanUpWorkerScript`: `delayReject` bei `:70`, `stopFlag = true` erst bei `:90`, `removeWorkerScript` bei `:91`, RAM-Freigabe bei `:124`),
`Netscript/NetscriptHelpers.tsx:399-403` (`checkEnvFlags` wirft `ScriptDeath`, sobald `stopFlag` steht),
`NetscriptFunctions.ts:742-765` (`killall` mit `_safetyGuard`, Standard `true`, ueberspringt die eigene PID — bei `false` nicht), `NetscriptFunctions.ts:1198` (`scriptKill` hat **keinen** Safety Guard), `Netscript/killWorkerScript.ts:72-90` (`atExit` laeuft vor `stopFlag = true`). Der Parser warnt beim Speichern vor `while(true)` ohne `await`
(`Script/RamCalculations.ts:262-302`), verhindert es aber nicht.

**Wirkung.** Totalausfall des Laufs. Nur ein Reload hilft, und den kann der Automat nicht selbst
ausloesen.

**Aufwand zur Vermeidung.** Eine Zeile: nach jedem Selbstmordpfad sofort `return`.

**Urteil.** Die mit Abstand gefaehrlichste Stelle. In `src/` gegenpruefen, ob nach `ns.kill`/
`killall(host,false)`/`scriptKill` irgendwo weiterlaeuft.

---

### V2 — Nach einem Install steht der Bot, bis die Seite neu geladen wird

**Beobachtung.** `installAugmentations` ruft als Erstes `prestigeWorkerScripts()`, das **alle**
Skripte toetet und alle Ports leert. `prestigeAugmentation` startet **nichts** wieder — es gibt
keinen `loadAllRunningScripts`-Aufruf. Der einzige Wiederanlauf ohne SF4 waere
`ns.singularity.installAugmentations(cbScript)`, und das ist gesperrt.

**Beleg.** `Augmentation/AugmentationHelpers.ts:76`, `Prestige.ts:55-199` (kein Neustart),
`NetscriptWorker.ts:218-264` (`loadAllRunningScripts` laeuft nur in `Engine.load`),
`NetscriptWorker.ts:251-257` (auf `home` wird das Autoexec-Skript **vorne** einsortiert und
bekommt das RAM zuerst), `Settings/Settings.ts` `AutoexecScript` (Standard `""`).

**Wirkung.** Ohne gesetztes Autoexec-Skript steht nach jedem Install alles — und ein Install ist
der Kern der Strategie (`doku/strategie.md`, Phase P6/P7).

**Aufwand.** Autoexec-Skript in den Optionen setzen (einmalig, per DOM), Seite nach dem Install
neu laden lassen.

**Urteil.** Pflicht. Ohne das ist jede Install-Runde ein Handeingriff.

---

### V3 — Aktienpositionen sind beim Install ersatzlos weg

**Beobachtung.** `prestigeAugmentation` ruft `initStockMarket()`, das alle `Stock`-Objekte neu
erzeugt. `playerShares` wird 0, **ohne Auszahlung**. Der WSE-/TIX-/4S-Zugang selbst ueberlebt
den Install und stirbt erst beim BitNode-Wechsel.

**Beleg.** `Prestige.ts:171` (`initStockMarket()`), `StockMarket/StockMarket.ts:187-210`,
`PersonObjects/Player/PlayerObjectGeneralMethods.ts:162-166` (Zugaenge erst bei `prestigeSourceFile`).

**Wirkung.** Beziffert: alles, was im Depot liegt. Bei einer sinnvollen Depotgroesse in der
Spendenphase sind das leicht zweistellige Milliarden.

**Aufwand.** Eine Verkaufsroutine vor dem Install.

**Urteil.** Muss in die Install-Prozedur, hart als Vorbedingung.

---

### V4 — Ein einziger synthetischer Tastendruck waehrend einer Infiltration hospitalisiert sofort

**Beobachtung.** Der Tastatur-Listener der Infiltrationsseite haengt an `document` und prueft
`event.isTrusted`. Faellt ein Ereignis durch, ruft er `onFailure({automated: true})` — und dieser
Zweig setzt den Schaden auf `Player.hp.current`, also **sofortiger Tod**, mit dem Hinweis
"Do not try to automate infiltration!".

**Beleg.** `Infiltration/ui/InfiltrationRoot.tsx:73-77`, `Infiltration/Infiltration.ts:139-151`.
Krankenhauskosten: `min(Player.money * 0.1, fehlendeHP * 100e3)`
(`Hospital/Hospital.ts:9`, `Constants.ts:47`).

**Wirkung — kleiner als ich zuerst geschrieben hatte.** `getHospitalizationCost()`
(`Hospital/Hospital.ts:4-10`) ist `min(Player.money * 0.1, (hp.max - hp.current) * 100e3)`
(`Constants.ts:47` `HospitalCostPerHp: 100e3`), und `hp.max = floor(10 + defense/10)`
(`PersonObjects/Person.ts:229`). Mit Kampfwert 1 ist `hp.max` **10**, der zweite Term also
hoechstens **1 Mio. $**. Der 10-%-Zweig bindet nur unterhalb von rund 10 Mio. $ Vermoegen —
also genau dann **nicht**, wenn der Bot laeuft. Realistisch: ein bis zwei Millionen je Vorfall,
nicht 10 % des Vermoegens. Der Schaden ist trotzdem: **die laufende Arbeit bricht ab** und der
Spieler landet im Krankenhaus.

**Aufwand.** Zwei Zeilen Wache: nie synthetische Tastenereignisse abfeuern, solange die
Infiltrationsseite gemountet ist.

**Urteil.** Klassische Falle fuer einen Automaten, der "einfach mal Enter drueckt". Der Listener
haengt an `document`, nicht am Minispiel — er faengt also auch Tastendruecke, die gar nicht der
Infiltration galten.

Zweite Falle am selben Ort: eine Infiltration an einem Ort mit `startingDifficulty >= 3.5`
starten gibt sofort vollen HP-Schaden, ohne dass ein Minispiel laeuft
(`Infiltration/Infiltration.ts:97-108`).

---

### V5 — `ns.prompt` und `ns.nextPortWrite` haengen ewig

**Beobachtung.** Beide geben ein Promise zurueck, das nur von aussen aufgeloest wird
(`prompt`: durch einen Menschen am Dialog; `nextPortWrite`: durch einen Schreiber auf dem Port).
Es wird kein `delayReject` registriert — das Skript wird beim Toeten also nicht befreit und
haengt bis zum Reload.

**Beleg.** `NetscriptFunctions.ts:1337-1370` (`prompt`), `NetscriptPort.ts:86-90` (`nextWrite`, erreicht ueber `NetscriptFunctions.ts:1112-1115`) — dort steht ein nacktes `new Promise`, dessen Resolver nur ein Schreiber auf demselben Port aufruft.
Zum Vergleich: `netscriptDelay` registriert `delayReject` (`Netscript/NetscriptHelpers.tsx:429`),
das beim Toeten aufgerufen wird (`Netscript/killWorkerScript.ts:70`) — genau deshalb wird
`ns.sleep` sauber abgebrochen und `ns.prompt` nicht.

**Wirkung.** Ein haengendes Skript belegt RAM dauerhaft.

**Urteil.** Beide Funktionen im unbeaufsichtigten Lauf verboten. Statt `nextPortWrite` eine
Schleife mit `ns.sleep` und `readPort`.

---

### V6 — Die RAM-Rechnung ist namensbasiert: eigene Bezeichner koennen teuer werden

**Beobachtung.** Die statische RAM-Berechnung sammelt **jeden Identifier im AST** und sucht ihn
dann **rekursiv im gesamten `RamCosts`-Baum** — Namespace-Pfad egal, Aufruf nicht noetig.
Auch `MemberExpression`-Properties werden begangen. Eine lokale Funktion `function research(){}`
kostet damit 20 GB. Eine Variable `let share = 1` kostet 2,4 GB.

**Beleg.** `Script/RamCalculations.ts:407-411` (Identifier-Besucher), `:436-439`
(MemberExpression begeht **object und property**), `:335-343` (`addRef` fuegt den nackten Namen
hinzu, Kommentar `// For builtins like hack.`), `:225-244` (`findFunc` sucht rekursiv im ganzen
Baum). Ausgenommen sind nur `Object.prototype`-Namen (`:346`, `:408-410`).

**Die teuersten Kollisionsgefahren** (aus dem Kostenbaum): `research`, `bribe`, `buyTea`,
`throwParty`, `hireEmployee`, `makeProduct`, `sellShares` je **20 GB**; `getChains`,
`getLiberties`, `getControlledEmptyNodes` je **16**; `getContract`, `getInfiltration` je **15**;
`attempt`, `getOffice`, `getProduct`, `getMaterial`, `getCorporation`, `getDivision`,
`hasUnlock`, `getWarehouse` je **10**; `getValidMoves`, `destroyNode`, `removeRouter` je **8**;
`getData`, `getDescription`, `placeFragment` je **5**; `getTask`, `travel`, `getSleeve`,
`getRank`, `getCity`, `getStamina` je **4**; `share` 2,4; `getServer` 2; `spawn` 2; `exec` 1,3;
`run` 1,0; `kill`/`killall` 0,5; `scan`/`ls`/`ps` 0,2.

Zwei Verschaerfungen: **im Hauptskript zaehlt toter Code immer** (die Startmenge sind *alle*
Schluessel des Einstiegsmoduls, `:165`), und **`import * as lib` zieht das komplette Modul**
(`:476-481`, Praefix-Aufloesung `:196-205`).

**Wirkung.** Still. Das Skript laeuft, es kostet nur unerwartet viel. Auf 25 Servern mit vielen
Threads summiert sich das erheblich.

**Aufwand.** `mem <skript>` im Terminal listet jeden Posten einzeln auf
(`Terminal/commands/mem.ts:36-40`).

**Urteil — meine Vermutung ist widerlegt.** Ich hatte geschrieben, der Bot heisse intern
vermutlich irgendwo `getTask`, `attempt` oder `share`. Ein Abgleich aller 26 teuren Bezeichner
gegen `src/*.js`, `src/lib/*.js` und `src/worker/*.js` liefert **null Treffer**. Der einzige
Beinahe-Treffer ist `shareRam` in `src/autopilot.js` — ein anderer Bezeichner — plus das
String-Literal `"share.js"`, das die RAM-Analyse nie ansieht. Bei 8.192 GB auf `home` waere
selbst eine 20-GB-Kollision ohne Belang.
**Der Mechanismus bleibt trotzdem dokumentierenswert**, weil er beim naechsten Umbenennen
zuschlaegt und die Fehlermeldung nichts davon verraet.

---

### V7 — The Red Pill kostet $0 und verteuert trotzdem alles danach um Faktor 1,9

**Beobachtung.** Der Warteschlangen-Multiplikator ist `1.9^(Anzahl queued Augs ohne SoA)`.
The Red Pill ist eine ganz normale Aug in diesem Filter — sie hat nur `moneyCost: 0`. Sie zahlt
also voll in den Multiplikator ein, ohne selbst etwas zu kosten.

**Beleg.** `Augmentation/AugmentationHelpers.ts:29-37` (Multiplikator, `CONSTANTS.MultipleAugMultiplier = 1.9`,
`Constants.ts:41`), `:17-27` (SoA-Ausnahmeliste — Red Pill steht nicht drin),
`Augmentations.ts:1946-1952` (`repCost: 2.5e6`, `moneyCost: 0`).

**Wirkung.** Faktor 1,9 auf jede danach gekaufte Aug. `1.9^10 = 613`, `1.9^20 = 3,8e5`.

**Aufwand.** Kaufreihenfolge: Red Pill **zuletzt**.

**Urteil.** Genau die Art Reihenfolgefehler, die man einmal macht und teuer bezahlt.

---

### V8 — Coding Contracts: der letzte Fehlversuch loescht den Contract, und ein Install loescht alle Fremdserver-Contracts

**Beobachtung, drei Teile.**

1. Beim Erreichen der Versuchsgrenze entfernt sich der Contract selbst. In BN1 haben vier der
   fuenf moeglichen Typen 10 Versuche — **Algorithmic Stock Trader I hat nur 5**.
2. Ein **formal ungueltiges** Antwortformat kostet dagegen *keinen* Versuch: `attempt` wirft
   vorher eine Exception. Nur inhaltlich falsche, formal gueltige Antworten zaehlen.
3. `prestigeAllServers()` erzeugt alle Fremdserver neu — alle Contracts dort sind weg.
   **Ausnahme: `home`.** `prestigeHomeComputer` fasst `contracts` nicht an.

**Beleg.** `NetscriptFunctions/CodingContract.ts:63-70` (Selbstloeschung), `:33-36`
(Formatpruefung vor dem Zaehler), `CodingContract/Contract.ts:105-107` (`numTries ?? 10`),
`CodingContract/contracts/AlgorithmicStockTrader.ts:35` (`numTries: 5`),
`Prestige.ts:74` (`prestigeAllServers()`), `Server/ServerHelpers.ts` `prestigeHomeComputer`
(leert `programs`, `serversOnNetwork`, `messages`, `ramUsed` — nicht `contracts`).
Verschieben geht nicht: `ns.scp` nimmt keine `.cct`-Dateien (`NetscriptFunctions.ts:766`).

**Wirkung.** Ein verbrannter oder verlorener Geld-Contract sind **25 Mio. $** (Rechnung siehe A1).

**Aufwand.** `getNumTriesRemaining()` (2 GB) pruefen und ab 2 Restversuchen nicht mehr raten;
vor jedem Install alle offenen Contracts abarbeiten.

**Urteil.** Beides gehoert in die Install-Checkliste.

---

### V9 — `ns.rm` auf eine `.exe` ist endgueltig

**Beobachtung.** `removeFile` behandelt Programme mit; es gibt keinen Papierkorb und keine
Rueckfrage. Laufende Skripte sind geschuetzt, Programme nicht.

**Beleg.** `Server/BaseServer.ts:187-193` (Skripte sind geschuetzt: `"Cannot delete a script that is
currently running!"`) gegenueber `:195-200` (Programme: `programs.splice(...)`, **keine** Pruefung,
keine Rueckfrage).

**Wirkung.** `Formulas.exe` kostet 5 Mrd. im Darkweb bzw. 4 Stunden Schreibzeit,
Portknacker entsprechend weniger.

**Urteil.** `ns.rm` im Bot auf eine Positivliste von Dateiendungen einschraenken.

---

### V10 — Tab offen lassen, waehrend der Rechner schlaeft, ist der schlechteste aller Faelle

**Beobachtung.** Offline-Hacking-Einkommen wird **ausschliesslich in `Engine.load()`** berechnet.
Beim Aufwachen aus dem Schlaf laeuft dagegen `Engine.start()`, das die Zyklen nachholt und
`Player.lastUpdate` auf jetzt setzt. Ergebnis: fuer die Schlafphase gibt es **null**
Skripteinkommen, und ein nachtraeglicher Reload hilft nicht mehr, weil das Zeitfenster
verbraucht ist.

**Beleg.** `engine.tsx:270-275` (Offline-Einkommen, nur in `load`), `engine.tsx:414-430`
(`start`: `diff` wird nachgeholt, `_lastUpdate`/`Player.lastUpdate` neu gesetzt; `diff < 0` wird
auf 0 geklemmt).

**Wirkung.** Bei 8 Stunden und einem Einkommen von z.B. 3.000 $/s sind das 86 Mio. $, die
schlicht verschwinden — gegenueber ca. 65 Mio. (0,75 x Durchschnitt), die es bei geschlossenem
Tab gegeben haette.

**Urteil.** Fuer laengere Pausen ist **Tab schliessen objektiv besser** als offen lassen. Die
Zyklen-Nachholrate der Subsysteme (Gang 25, Sleeve 15, Corp 10, Bladeburner 5 Zyklen je Aufruf)
ist in BN1 ohne SF ohnehin irrelevant. *(Diese Zahlen stammen aus dem 3.0.2-Baum und sind fuer
BN1 ohne Source Files gegenstandslos — nicht gegen v301 nachgeprueft.)*

---

### V11 — Zwei offene Tabs sind ein Save-Rennen

**Beobachtung.** Beide Tabs laufen mit eigener Engine und eigenem Autosave auf denselben
IndexedDB-Schluessel. Es gibt keine Sperre; der letzte Schreiber gewinnt. Beide bekommen beim
Laden je eigenen Offline-Fortschritt fuer denselben Zeitraum.

**Beleg.** `db.ts:28,36,120` (Datenbank `bitburnerSave`, Objektspeicher `savestring`,
Schluessel `save`), `db.ts:45-49,135` (`onblocked` greift nur bei Versionswechsel/Loeschen).

**Urteil.** Der Werkstatt-Leitstand muss sicherstellen, dass nur ein Tab offen ist.

---

### V12 — Veralteter RAM-Zwischenspeicher nach `scp` oder Bibliotheksaenderung

**Beobachtung.** `Script.ramUsage` wird gecacht und nur ueber den `content`-Setter bzw.
`removeFile` invalidiert. Die Weitergabe an abhaengige Skripte laeuft ueber `Script.dependents`,
und diese Menge wird **erst beim Kompilieren** gefuellt. Ein Hauptskript, das seine RAM-Zahl
schon kennt (durch `mem` oder `ns.getScriptRam`), aber noch nie **gelaufen** ist, behaelt sie,
wenn danach `lib.js` geaendert oder per `scp` ueberschrieben wird. Es startet dann mit zu
kleiner Zuteilung und stirbt beim ersten teuren Aufruf.

**Beleg.** `Script/Script.ts:69-71` (Zwischenspeicher: `if (this.ramUsage) return this.ramUsage;`),
`:41` und `:52-61` (`invalidateModule` reicht die Entwertung ueber `dependents` weiter),
`NetscriptJSEvaluator.ts:62-73` (`dependents` wird **erst beim Kompilieren** gefuellt),
`Server/BaseServer.ts:190-191` (die zweite und letzte Entwertungsstelle: `removeFile`).
In v301 gegengelesen.

**Urteil.** Nach jedem Bibliotheks-Update die abhaengigen Skripte anfassen (Inhalt neu
schreiben) oder das Spiel neu laden. Betrifft den Sync-Pfad ueber die RFA-Bruecke direkt.

---

### V13 — Ports: stiller Ueberlauf, keine Persistenz

**Beobachtung.** `write` schiebt bei voller Warteschlange das **aelteste** Element heraus und
gibt es zurueck — kein Fehler, kein Log. Die Kapazitaet ist eine **Spielereinstellung**
(`Settings.MaxPortCapacity`, Standard 50), also nicht verlaesslich. Ports existieren nur im
Speicher und werden nirgends gespeichert; nach einem Reload sind alle leer.

**Beleg.** `NetscriptPort.ts:54-60` (`write` verdraengt das aelteste Element und gibt es zurueck), `:63-69` (`tryWrite` gibt stattdessen `false`), `:7` (`"NULL PORT DATA"`), `NetscriptWorker.ts:38` (nur im Speicher),
`NetscriptWorker.ts:45` (beim Prestige geleert), `NetscriptPort.ts:31-38` (`structuredClone` wirft bei Funktionen/Promises/ns).
**Zurueckgezogen:** Ich hatte hier ein Speicherleck behauptet ("wer auf viele verschiedene
Portnummern schreibt, leckt Speicher, weil die Map nur beim Prestige geleert wird"). **Das ist
falsch.** `NetscriptPort.ts:75` entfernt einen Port sofort aus der Map, sobald er leergelesen ist:
`if (!port.data.length && !port.resolver) NetscriptPorts.delete(this.n);`. Ein Leck entsteht nur
bei Ports, die beschrieben und **nie gelesen** werden. (`CONSTANTS.NumNetscriptPorts =
Number.MAX_SAFE_INTEGER`, `Constants.ts:38`, stimmt weiterhin.)

**Urteil.** `tryWritePort` statt `writePort`, und Portzustand nie ueber einen Reload hinweg
annehmen.

---

### V14 — `startWork` bricht laufende Arbeit still ab und vernichtet Teilfortschritt

**Beobachtung.** Jeder Start einer neuen Arbeit ruft zuerst `this.currentWork.finish(true)` —
ohne Warnung, ohne Rueckgabewert. Bei **Crime** und **Grafting** ist der aufgelaufene
Teilfortschritt danach ersatzlos weg: `CrimeWork` ueberschreibt `finish` gar nicht, es gibt also
keine anteilige Gutschrift.

**Beleg.** `PersonObjects/Player/PlayerObjectWorkMethods.ts:6-8` (`startWork`),
`Work/CrimeWork.ts` (kein `finish`-Override; Belohnung nur im Erfolgszweig bei vollendetem
Verbrechen, `:56-86`), `Work/GraftingWork.tsx:75-82` (Geld **und** Fortschritt weg).
Faction-, Company- und Class-Arbeit sind dagegen unkritisch — dort wird zyklusweise
gutgeschrieben, es gibt keinen Schwellwert.

**Wirkung.** Ein Automat, der "sicherheitshalber" alle paar Minuten die Arbeit neu startet,
vernichtet bei jedem Durchlauf die angefangene Tat. Bei einem Heist (600 s) sind das bis zu
10 Minuten.

**Urteil.** Vor jedem `startWork` pruefen, ob gerade eine Crime laeuft.

---

### V15 — Programmbau ueber 99,995 % abbrechen zerstoert den Fortschritt DAUERHAFT

**Beobachtung.** Beim Abbruch wird der Stand als Datei `NAME-xx.xx%-INC` auf `home` abgelegt,
mit `toFixed(2)`. Ab 99,995 % rundet das auf `"100.00"`. Beim naechsten Start lehnt der
Konstruktor `percComplete >= 100` ab — und zwar mit **`break`, nicht `continue`**. Die
Muell-Datei bleibt liegen und **blockiert danach jede weitere Wiederherstellung fuer dasselbe
Programm**: der Automat faengt still immer wieder bei 0 % an.

**Beleg.** `Work/CreateProgramWork.ts:92-95` (`toFixed(2)`, Dateiname),
`:33-45` (Einlesen: `if (isNaN(percComplete) || percComplete < 0 || percComplete >= 100) break;`
— und der `break` verlaesst die ganze Schleife, die Datei wird nur im Erfolgsfall gespliced).

**Wirkung.** Bei `SQLInject.exe` sind das bis zu 8 Stunden, und es wiederholt sich.

**Aufwand.** Zwei Wachen: (a) einen fast fertigen Programmbau nicht abbrechen,
(b) beim Start pruefen, ob eine `*-100.00%-INC`-Datei auf `home` liegt, und sie per `ns.rm`
loeschen.

**Urteil.** Ein echter Fehler im Spiel, und einer der wenigen, die sich **selbst verstetigen**.

---

### V16 bis V25 — kuerzer

| # | Beobachtung | Beleg | Urteil |
|---|---|---|---|
| **V16** | **`buy -a` im Terminal bricht beim ersten unbezahlbaren Posten ab** — `return` statt `continue`. Und die Reihenfolge in `DarkWebItems` stellt **SQLInject (250 Mio.) vor ServerProfiler (500k), DeepscanV1 (500k) und AutoLink (1 Mio.)** | `DarkWeb/DarkWeb.tsx:99-103`, `DarkWeb/DarkWebItems.ts:6-21` | Mit z.B. 40 Mio. kauft `buy -a` vier Programme und laesst die drei billigen liegen. **Der Automat muss einzeln kaufen** |
| **V17** | **Studieren und Trainieren treiben das Geld ins Negative** — weder die UI noch `applyWorkStats` noch `gainMoney` pruefen den Kontostand | `Work/ClassWork.tsx:22-73` (Kosten sind negatives `money`), `PersonObjects/Player/PlayerObjectGeneralMethods.ts:216-224` (`gainMoney` hat keinen Boden) | Powerhouse Gym kostet 2.400 $/s. Ueber Nacht unbeaufsichtigt ist das ein Loch |
| **V18** | **Focus geht bei JEDEM Seitenwechsel weg von der Work-Seite verloren** — dauerhaft 20 % weniger auf Faction-Rep, Firmen-Rep/Geld, Programmiertempo, Crime-Rate und Karma | `ui/GameRoot.tsx:273-275`, `PlayerObjectGeneralMethods.ts:622-628` (`focusPenalty` = 0,8 ohne Focus, 1 mit) | Ein DOM-Automat, der zwischen Seiten navigiert, verliert das dauernd. Ausweg: A9 (Reload-Focus) oder die Aug *NeuroreceptorManager* |
| **V19** | **Hacknet-Nodes verfallen beim Install ersatzlos.** `this.hacknetNodes.length = 0` | `PlayerObjectGeneralMethods.ts:130` | Kurz vor einem Install nichts mehr in Hacknet stecken. In BN1 lohnt Hacknet ohnehin nicht (4.9) |
| **V20** | **Stadtfraktionen sperren sich gegenseitig** — `joinFaction` setzt sofort alle Feinde auf `isBanned`. Betrifft nur die sechs Stadtfraktionen. **Die Sperre ueberlebt den Install nicht** (`Faction.prestigeAugmentation` setzt `isBanned = false`) | `Faction/FactionHelpers.tsx:44-47`, `Faction/Faction.ts:77-85` | Pro Install-Zyklus entscheiden, nicht "fuer immer". `doku/strategie.md` P3 ("Keine Stadtfaktion beitreten") ist damit strenger als noetig |
| **V21** | **Zwei gleichzeitig laufende Go-Skripte legen sich gegenseitig lahm.** `validateTurn` wirft, wenn `previousPlayer` die eigene Farbe ist; die Fehlermeldung nennt genau diese Ursache | `Go/effects/netscriptGoImplementation.ts:127-140` | Genau ein Go-Skript, mit Sperre ueber einen Port oder eine Datei |
| **V22** | **`purchase4SMarketData` (1 Mrd.) bringt der Skript-API nichts** — es schaltet nur die UI-Anzeige frei. Fuer `ns.stock.getForecast` braucht es `purchase4SMarketDataTixApi` (25 Mrd.) | `NetscriptFunctions/StockMarket.ts:249-274`, `StockMarket/data/Constants.ts:3-12` | 1 Mrd. sind fuer einen Automaten rausgeworfen |
| **V23** | **`ns.stock.*` wirft hart** ohne WSE/TIX bzw. ohne 4S — kein `false`, sondern eine Exception, die das Skript toetet | `NetscriptFunctions/StockMarket.ts:41-45, 227-247` | Vorher `hasTixApiAccess()` / `has4SDataTixApi()` (je 0,05 GB) |
| **V24** | **Ein Aug-Kauf ist endgueltig.** Das Geld ist sofort weg, es gibt keinen Storno, keinen Teil-Install und keine Moeglichkeit, eine einzelne Aug aus der Warteschlange zu nehmen. `installAugmentations` installiert immer alles | `Faction/FactionHelpers.tsx:118-120`, `Augmentation/AugmentationHelpers.ts:69-103` | Kaufliste vorher vollstaendig planen |
| **V25** | **`SuppressFactionInvites` NICHT einschalten.** Sonst faellt das Einladungs-Modal weg — der Beitrittsweg ohne `isTrusted`-Sperre (`doku/join-problem.md:99-101`, dort *Weg A*) | `Faction/FactionHelpers.tsx:30`, `Settings/Settings.ts` | Sinnvoll zu unterdruecken sind dagegen: `SuppressBuyAugmentationConfirmation`, `SuppressTravelConfirmation`, `SuppressTIXPopup`, `SuppressMessages`, `SuppressSavedGameToast`, `SuppressErrorModals` |

Kleiner Notausgang am Rande: **Escape leert alle offenen Alert-Dialoge auf einen Schlag**, ohne
`isTrusted`-Pruefung (`ui/React/AlertManager.tsx:41-46`, 3.0.2-Zeilen). Gehoert in die
Stillstandswache.

---

# 2. Was wir AUSNUTZEN koennen

## Rangfolge — und warum die Nummerierung sie NICHT abbildet

Ich hatte die Liste zuerst nach absoluter Groesse des Effekts sortiert. Das war falsch, und ich
korrigiere es hier statt die Nummern umzuwerfen: **`doku/auffaellige-werte.md:136-137` misst am
laufenden Bot 164,8 Mio. $/s Einnahmen** — also rund 593 Mrd. $ pro Stunde. Und
`doku/strategie.md` nennt Geld ausdruecklich den **schwaechsten** der drei Engpaesse.

Damit ist jeder Geldfund in diesem Bericht praktisch wertlos, sobald der Bot laeuft.

**`doku/strategie.md:16-40` nennt Engpass 1 den Hacking-Level-Multiplikator**, Engpass 2 die
Reputation. Der zaehlt doppelt, weil er im **Exponenten** steht: `calculateExp(L, m) =
e^((L/m + 200)/32) − 534,6` (`PersonObjects/formulas/skill.ts:17`). Ein Multiplikator, der um
0,5 % steigt, senkt den Erfahrungsbedarf fuer Level 2500 um **8,3 %** — nicht um 0,5 %.

**Nach Engpass sortiert sieht die Liste so aus:**

| Rang | Fund | Trifft | Groessenordnung | Aufwand |
|---:|---|---|---|---|
| **1** | **Abschnitt 3.2 (a)(b)(c)** — `ns.exploit()`, `ns.rainbow("noodles")`, `ns.bypass(…)` | **Engpass 1**, der Hacking-Multiplikator | 3 Exploits = `1,001^3` auf `mults.hacking` = **−5,1 % Erfahrungsbedarf** fuer Level 2500 bei m=4,5. Ueberlebt jeden Reset | **5 Minuten** |
| **2** | **A0** — Spendenweg, sobald Favor 150 steht | **Engpass 2**, Reputation | **1.093,7 Rep je Mrd. $** = 180 Rep/s beim heutigen Einkommen, gegen 4,91 Rep/s aus Arbeit → **Faktor 36,7**. Knopf ist ohne `isTrusted` klickbar | mittel |
| **3** | **A9** — Reload-Focus | alle Rep-Arten | +25 %, praktisch null Aufwand — aber **ungemessen** | klein |
| **4** | **A5** — Rep-Anforderung skaliert nicht mit der Warteschlange | Planung | verschiebt die Kaufstrategie | klein |
| **5** | **A2** — IPvGO, **nur gegen Daedalus / Black Hand** | Favor bei genau den Fraktionen, die man braucht | +81,27 Favor = **21,6 % des Weges zu Favor 150** und damit zu A0 | **hoch** (Go-Engine gegen "Mid AI") |
| 6 | **A3** — passive Rep in allen Fraktionen | Fraktions-Rep | heute +190 Rep/h (1,1 %), erst mit Favor 90 nennenswert | keiner, aber lange Vorleistung |
| 7 | **A4** — `__reactProps` fuer die zwoelf Klicksperren | Firmen-Rep, Verbrechen | **im Kern schon bewiesen und gebaut**; neu ist nur Firmenarbeit/Verbrechen, und beide sind in BN1 der falsche Weg | — |
| **vor allem** | **nicht aus diesem Bericht:** die Backdoor-Regel aus `doku/auffaellige-werte.md` Punkt 4/6 | Fraktionszugang | `avmnite-02h` 2,1 s, `I.I.I.I` 2,9 s → zwei Fraktionen und elf Augmentations fuer fuenf Sekunden Spielzeit | winzig |
| 8 | A7, A10, A11.5 | Kleinkram mit echtem Nutzen | — | — |
| — | **A11.6** `ns.share` | — | **schon ausgereizt** (Bonus 1,5373) | — |
| — | **A1** Coding Contracts | — | **schon gebaut** (`src/contracts.js`, 54 KB) und Geld ist irrelevant | — |
| **streichen** | **A6** (SoA), **A8** (Casino), **A11.3** (globalThis) | — | Aufwand ohne Ertrag, Begruendung jeweils am Eintrag | — |

Die Ausnahme fuer die Geldfunde: **direkt nach jedem Install hat der Spieler $1.262**
(`PersonObjects/Player/PlayerObjectGeneralMethods.ts:102`, `Constants.ts:107` `Donations: 262`).
In der ersten halben Stunde jeder neuen Runde ist Geld sehr wohl knapp. Danach nicht mehr.

Die Nummerierung unten folgt der urspruenglichen Reihenfolge; lies sie mit der Tabelle oben.

---

### A0 — Der Spendenweg: ab Favor 150 kauft Geld Reputation zum 36,7-fachen der Arbeitsrate

**Das ist die groesste Luecke meiner ersten Fassung.** Ich hatte Spenden nur in Abschnitt 4.4
behandelt — und dort nur als Exploit-Frage ("kann man die Favor-Schranke umgehen?", Antwort:
nein). Die eigentliche Frage ist eine andere: **was ist der Weg wert, wenn man ihn regulaer
geht?**

**Beobachtung.** `Faction/formulas/donation.ts:8-10`:
```js
repFromDonation(amt, person) =
  (amt / CONSTANTS.DonateMoneyToRepDivisor) * person.mults.faction_rep * currentNodeMults.FactionWorkRepGain;
```
`DonateMoneyToRepDivisor = 1e6` (`Constants.ts:33`), `FactionWorkRepGain = 1` in BN1.

**Wirkung, an den gemessenen Werten.** Mit `mults.faction_rep = 1,0937`
(`doku/auffaellige-werte.md`) sind das **1.093,7 Rep je Milliarde Dollar**. Beim gemessenen
Einkommen von 164,8 Mio. $/s (`doku/auffaellige-werte.md:136`) entspricht das
**180,2 Rep/s** — gegen **4,91 Rep/s** aus fokussierter Faktionsarbeit. **Faktor 36,7.**

Konkret: The Red Pill braucht 2,5 Mio. Daedalus-Rep. Das sind
**2,286 Bio. $ = 3,85 Stunden** heutiges Einkommen — statt **141 Stunden** Arbeit.

**Die Schranke.** Favor 150 (`Constants.ts:31` `BaseFavorToDonate: 150`,
`Faction/formulas/donation.ts:16-18`), das entspricht **462.490 kumulierter Rep** je Fraktion
(`favorToRep(150) = 25000 * (e^(0.019802627 * 150) − 1)`, `Faction/formulas/favor.ts:12-14`).
Einmalig — **Favor ueberlebt jeden Install** (`Faction/Faction.ts:77-85`).

**Und der Knopf ist offen.** `Faction/ui/DonateOption.tsx:31-42` — `onDonate()` nimmt **gar kein
Ereignis entgegen**, es gibt also nichts zu pruefen. Der einzige `isTrusted`-Treffer in ganz
`Faction/` ist `FactionsRoot.tsx:89`. Ein gewoehnliches `.click()` genuegt; die
`__reactProps`-Technik aus A4 braucht man hier nicht einmal.

**Urteil.** Das ist der Punkt, an dem der Bot aufhoert, Zeit gegen Reputation zu tauschen, und
anfaengt, Geld gegen Reputation zu tauschen — und Geld hat er im Ueberfluss
(`doku/auffaellige-werte.md:123-137`: 99 % des Einkommens fliessen heute in zu 60 %
leerstehenden Speicher). **Alles, was den Weg zu Favor 150 verkuerzt, ist damit doppelt wertvoll**
— das ist der eigentliche Zweck von A2 (Go-Favor), A11.5 (Export-Bonus) und A3 (passive Rep).

`doku/auffaellige-werte.md:725-728` hat den Aktienmarkt "ab Favor 150" schon als Punkt 10 auf
der Liste. Was dort fehlt, ist die Umkehrung: **Favor 150 ist das Ziel, nicht der Ausloeser.**

---

---

### A1 — Coding Contracts: fuenf Typen, und ein Doppel-Divisions-Fehler — **war schon bekannt**

> **Vorweg, ehrlich: dieser Abschnitt bringt fast nichts Neues — und der Loeser ist schon gebaut.**
> `src/contracts.js` existiert (54.487 Bytes, 20.08.2026 11:48) und loest **alle 30** Typen als
> woertliche Uebertragungen von `getAnswer` aus `reference/v301/src/CodingContract/contracts/*.ts`,
> jeweils mit eigenem `verify` vor dem Absenden. Der Kopfkommentar dort nennt denselben
> RAM-Trick, den ich unten als Erkenntnis fuehre, und rechnet ihn genauer (17,65 GB statt meiner
> 16,8 GB — `scp` 0,6 und `getHostname` 0,05 fehlen bei mir). Was tatsaechlich noch fehlt, ist
> eine Zeile Terminplanung: `grep -rn contracts src/autopilot.js` liefert nichts, der Loeser
> haengt nicht am Autopiloten.
>
> `doku/auffaellige-werte.md:450-472` (Punkt 7) hat den `maxDif = 2*SF+1`-Deckel, die fuenf
> Typen, den Doppel-Divisions-Fehler in den Rueckfallzweigen und die Bewertung "Geld ist bei
> 164,8 Mio $/s irrelevant" bereits vollstaendig. Dort steht sogar der bessere Massstab:
> Erwartungswert **486 Rep je Contract**, 48 offene Contracts = 23.300 Rep = **82 Minuten
> Faktionsarbeit**.
> Ich lasse den Abschnitt stehen, weil die Herleitung hier vollstaendiger ist (Rate, alle vier
> Belohnungsformeln, Versuchszahlen, RAM des Solvers) — aber als *Fund* zaehlt er nicht.
> Neu ist daran nur ein Detail: der Doppel-Divisions-Fehler trifft **nicht nur** den
> Company-Zweig ohne Job, sondern genauso den Faction-Zweig ohne Fraktion — und bei
> Company-ohne-Job-ohne-Fraktion greift er sogar dreifach (75e6/27 = 2,78 Mio.).



**Beobachtung.** Die Schwierigkeit neuer Contracts ist gedeckelt auf `2 * Summe aller
SourceFile-Level + 1`. **Ohne Source Files ist das exakt 1.** Es koennen also nur die fuenf
Typen mit `difficulty: 1` entstehen.

**Beleg.**
```
ContractGenerator.ts:83   const totalSFs = [...Player.sourceFiles].reduce(...)
ContractGenerator.ts:84   const maxDif = 2 * totalSFs + 1;
ContractGenerator.ts:86   const problemType = getRandomProblemType(maxDif);
ContractGenerator.ts:173  ...filter((x) => CodingContractTypes[x].difficulty <= maxDif)
```
Die fuenf Typen (jeweils `difficulty: 1`):

| Typ | Datei:Zeile | Versuche |
|---|---|---|
| Algorithmic Stock Trader I | `contracts/AlgorithmicStockTrader.ts:24` | **5** (`:35`) |
| Encryption I: Caesar Cipher | `contracts/Encryption.ts:22` | 10 |
| Find Largest Prime Factor | `contracts/FindLargestPrimeFactor.ts:12` | 10 |
| Subarray with Maximum Sum | `contracts/SubarrayWithMaximumSum.ts:15` | 10 |
| Total Ways to Sum | `contracts/TotalWaysToSum.ts:21` | 10 |

**ABER: es gibt einen zweiten Erzeugungspfad, und der kennt den Deckel nicht.**
`DarkNet/effects/cacheFiles.ts:76-88` (`getCCTReward`) ruft
```js
generateContract({ server: server.hostname, rewardScaling: 1 / 2 });
```
**ohne `problemType`** — damit greift `getRandomProblemType()` mit dem Standardwert
`maxDif = 10` (`ContractGenerator.ts:172`), und es koennen **alle 30 Typen** entstehen, bis zu
drei je Auszahlung. Geldwert dort: `75e6 * dif * (1/2) / 3 = 12,5 Mio. * dif`, bei
Schwierigkeit 10 also **125 Mio. $** je Contract.
DarkNet ist in BN1 ueber `darkscape.exe` (50 Mio. $ im Darkweb,
`DarkWeb/DarkWebItems.ts:15-19`) freischaltbar — **der Fuenf-Typen-Schluss gilt also nur,
solange der Bot DarkNet nicht anfasst.** Das hatte ich uebersehen.

**Wirkung.** Solange kein DarkNet im Spiel ist, braucht ein vollstaendiger Contract-Solver fuer
BN1 **fuenf Algorithmen** statt dreissig — Kadane, Caesar, Faktorisierung, Partitionen, bestes
Ein-Kauf-Ein-Verkauf-Paar. (`src/contracts.js` loest ohnehin alle 30, siehe Urteil.)

**Der Ertrag, sauber gerechnet.** Der Skalierer ist `rewardScaling / 3`
(`PlayerObjectGeneralMethods.ts:511`, Kommentar: "a third of the reward size of the previous"):

| Typ | Formel | Wert bei difficulty 1 |
|---|---|---|
| Money | `75e6 * dif * CodingContractMoney * (1/3)` (`:558-561`, `Constants.ts:93`) | **25.000.000 $** |
| FactionReputation | `2500 * dif * (1/3)` (`:520`, `Constants.ts:91`) | 833 Rep bei einer zufaelligen Hacking-Fraktion |
| FactionReputationAll | `floor(2500 * dif * (1/3) / N)` (`:530-531`) | 833/N Rep je Fraktion |
| CompanyReputation | `4000 * dif * (1/3)` (`:554`, `Constants.ts:92`) | 1.333 Firmen-Rep |

**Und hier ein echter Fehler im Spiel, zu unseren Ungunsten:** die Rueckfallzweige geben
`adjustedScaling` als neuen `rewardScaling` weiter — der Wert wird also **ein zweites Mal durch
3 geteilt** (`:517`, `:527`, `:543-551`). Wer in **keiner** Hacking-Fraktion ist, bekommt fuer
einen Faction-Rep-Contract also nicht 25 Mio., sondern `75e6/9 = 8,33 Mio.`. Wer zusaetzlich
keinen Job hat, bekommt fuer einen Company-Rep-Contract `75e6/27 = 2,78 Mio.`

**Rate.** `tryGeneratingRandomContract(3)` alle 3000 Zyklen = **alle 10 Minuten drei Versuche**
(`engine.tsx:210-213`, `Constants.ts:19` `MilliPerCycle: 200`). Trefferwahrscheinlichkeit je
Versuch bei wenigen offenen Contracts ~0,25 (`ContractGenerator.ts:64`). Also
**~4,5 Contracts pro Stunde**, gleichverteilt auf die vier Belohnungstypen
(`ContractGenerator.ts:186-190`). Offline gilt exakt dieselbe Rate
(`engine.tsx:267`: `(timeOffline*3)/600000`) — **Neuladen bringt nichts.**

Erwartungswert pro Stunde mit mindestens einer Hacking-Fraktion und ohne Job:
`4,5 * (0,25 * 25 Mio.)` = **~28 Mio. $/h** plus ~940 Fraktions-Rep/h.
Ohne jede Fraktion faellt das auf ~9 Mio. $/h.

**Aufwand.** Fuenf Algorithmen. RAM: `getContract` (15 GB) liefert ein Objekt mit `.submit()`
und `.numTriesRemaining()`, und **diese Methoden sind keine ns-Funktionen und zaehlen im
RAM-Check nicht** (`NetscriptFunctions/CodingContract.ts:105-123`). Ein Solver kostet damit
`1,6 + 15 + 0,2 (ls) = 16,8 GB` statt 21,8 GB ueber `getContractType`+`getData`+`attempt`.

**Urteil — ich revidiere meine erste Einschaetzung zweimal.**

Erstens war die Geldrechnung als Verkaufsargument falsch: `doku/auffaellige-werte.md:136` misst
am laufenden Bot **164,8 Mio. $/s**. Die 28 Mio. $ **pro Stunde** aus Contracts sind davon
**0,005 %**. Als Einnahmequelle wertlos.

Zweitens war der Fund weder neu noch offen: `src/contracts.js` loest bereits alle 30 Typen
(Kasten oben). Drittens gilt der `maxDif=1`-Deckel gar nicht unbedingt (DarkNet-Pfad oben).

Was uebrig bleibt:
1. **Eine harte Regel aus dem Doppel-Divisions-Fehler:** in mindestens einer Hacking-Fraktion
   sein und einen Job haben, sonst fallen Contracts auf ein Drittel bzw. ein Neuntel ihres
   Werts (`PlayerObjectGeneralMethods.ts:517, 527, 541-552`).
2. **Der Restaufwand ist eine Zeile Terminplanung**, nicht ein Loeser: `contracts.js` haengt
   nicht am Autopiloten.
3. **In der ersten halben Stunde nach jedem Install ist Geld tatsaechlich knapp** — der Spieler
   startet mit $1.262 (`PlayerObjectGeneralMethods.ts:102`). Danach nicht mehr; `home.maxRam`
   ueberlebt den Install, der gemessene Wiederaufbau dauerte 5,58 h.
4. **Der DarkNet-Pfad ist der einzige Weg zu Contracts oberhalb Schwierigkeit 1** — falls
   `darkscape.exe` ohnehin gekauft wird, sind das bis zu 125 Mio. $ je Contract.

**Der bessere Massstab steht in `doku/auffaellige-werte.md` Punkt 7 und ich uebernehme ihn:**
Erwartungswert 486 Rep je Contract, 4,5 Contracts/h = **2.190 Rep/h**, gegen 17.676 Rep/h aus
fokussierter Arbeit — also **12 % eines Arbeitsstroms**, unlenkbar. Dort steht woertlich
"Rang 7, nicht Rang 3". Das ist richtig, und meine erste Fassung hat es ignoriert, obwohl sie
dasselbe Dokument an anderer Stelle zitiert.

---

### A2 — IPvGO: +81,27 Favor bei der bespielten Gegner-Faktion, plus Multiplikatoren je Runde

> **Einordnung.** `doku/auffaellige-werte.md:643-654` hat den Mechanismus schon: die Formel,
> die Faktionsboni, die 400 Siege, und dass `nodePower` beim Install geloescht wird. Zwei Dinge
> ergaenze ich, und eines davon ist eine **Korrektur**:
>
> 1. **Die dortige Daedalus-Zahl ist um Faktor 2,5 zu klein.** `auffaellige-werte.md:649-651`
>    sagt "+43,8 % gegen `w0r1d_d43m0n` (Staerke 2), aber nur **+9,7 %** gegen Daedalus
>    (Staerke 1,1)" bei 5.000 nodePower. Der Effekt ist in der Staerke **linear**
>    (`Go/effects/effect.ts:16-22`), also muss sich +43,8 % mit `1,1/2,0` skalieren:
>    `0,4385 * 0,55 = 0,2412`, also **+24,1 %**. Die 43,8 % fuer w0r1d_d43m0n stimmen; die
>    9,7 % nicht. **Und genau diese falsche Zahl war der Grund, die Daedalus-Schiene zu
>    verwerfen.**
> 2. Der **Zweck** des Go-Favors fehlt dort: 100.000 Rep-Aequivalent sind **21,6 % des Weges zu
>    Favor 150** und damit zum Spendenweg (A0), dem staerksten Rep-Hebel im Spiel. Ohne diesen
>    Bezug sieht der Posten kleiner aus, als er ist.
>
> Die dortige Einschaetzung *"Eine KI zu bauen, die gegen die Spiel-KI zuverlaessig gewinnt, ist
> ein eigenes Vorhaben"* habe ich zunaechst bestritten und ziehe das zurueck — siehe die
> Korrektur weiter unten.

**Beobachtung.** Das Go-Minispiel ist die einzige grosse Mechanik in BN1, die **ohne jedes
Source File** offensteht, vollstaendig ueber `ns.go.*` steuerbar ist und Multiplikatoren
vergibt, die direkt auf den staerksten Engpass wirken.

**Zwei getrennte Belohnungen.**

**(a) `nodePower` → Multiplikatoren, gelten nur innerhalb eines Durchgangs.**
```
CalculateEffect(nodePower, faction)
  = 1 + ln(nodePower+1) * (nodePower+1)^0.3 * 0.002 * bonusPower * GoPower * sfBonus
```
`Go/effects/effect.ts:16-22`. In BN1 ist `GoPower = 1` (`BitNode/BitNodeMultipliers.ts:97`) und
`sfBonus = 1`. Keine Obergrenze.

| Gegner | bonusPower | wirkt auf |
|---|---|---|
| Netburners | 1,3 | `hacknet_node_money` |
| Slum Snakes | 1,2 | `crime_success` |
| The Black Hand | 0,9 | `hacking_money` |
| Tetrads | 0,7 | `strength/defense/dexterity/agility` |
| **Daedalus** | **1,1** | **`company_rep` UND `faction_rep`** |
| Illuminati | 0,7 | `hacking_speed` |
| w0r1d_d43m0n | 2,0 | `hacking` (braucht The Red Pill) |

(`Go/Constants.ts:5-69`, `Go/effects/effect.ts:68-101`.)

Gerechnet fuer Daedalus (`bonusPower = 1,1`, `Go/Constants.ts:46-53`; wirkt auf `faction_rep`
UND `company_rep`, also direkt auf Engpass 2 aus `doku/strategie.md`):

| nodePower | `1 + ln(np+1) * (np+1)^0.3 * 0.002 * 1.1` |
|---:|---|
| 5.000 | **+24,1 %** |
| 20.000 | **+42,5 %** |
| 100.000 | **+80,1 %** |
| 1.000.000 | +191,8 % |

`nodePower`-Zuwachs pro Partie (`Go/boardAnalysis/scoring.ts:85-88`):
`blackScore.sum * getDifficultyMultiplier(komi, boardSize) * getWinstreakMultiplier(...)`.
Daedalus hat `getDifficultyMultiplier = 1,5`, der Siegesserien-Faktor ist im Normalfall bei 3,0 gedeckelt (`effect.ts:129`), steigt beim
Brechen einer Pechserie aber auf bis zu **5,0** (`effect.ts:124-127`). **Auch Niederlagen geben nodePower** (Faktor 0,5), Aufgeben per
`resetBoardState` dagegen nicht.

**(b) Favor → dauerhaft, ueberlebt den Install.**
```js
// Go/boardAnalysis/scoring.ts:67-79
if (factionName && statusToUpdate.winStreak % 2 === 0 &&
    Player.factions.includes(factionName) && statusToUpdate.rep < getMaxRep()) {
  const repToAdd = getMaxRep() / 200;              // = 500 in BN1
  Factions[factionName].setFavor(addRepToFavor(currentFavor, repToAdd));
  statusToUpdate.rep += repToAdd;
}
```
`getMaxRep()` = **100.000** in BN1 (`Go/effects/effect.ts:30-44`). Also 500 Rep-Aequivalent alle
zwei Siege, hoechstens 200 Auszahlungen, also **400 Siege je Faktion**, und nur bei Faktionen,
in denen man Mitglied ist. Umgerechnet ueber `addRepToFavor`
(`Faction/formulas/favor.ts:22-24`) sind 100.000 Rep aus Favor 0 heraus **+81,3 Favor** — das
ist Faktor **1,81** auf alle Fraktions-Rep-Gewinne (`PersonObjects/formulas/reputation.ts`).

**Warum das den Install ueberlebt.** `Go.prestigeAugmentation()` nullt `wins`, `losses`, `nodes`,
`nodePower`, `winStreak` — **aber ausdruecklich nicht `stats.rep`** (`Go/Go.ts:34-47`, mit
Kommentar). Und der einmal gutgeschriebene Favor haengt am `Faction`-Objekt und ueberlebt
Installs ohnehin (`Faction/Faction.ts:77-85`).

**Tempo.** Die KI wartet 200 ms je `waitCycle` (`Go/boardAnalysis/goAI.ts:877-883`), mehrere
davon pro Zug. Netburners umgeht die teuren Pfade meistens → typisch 0,4-0,8 s pro KI-Zug,
5x5-Partie in **8-15 s**.

**KORREKTUR meiner ersten Fassung.** Ich hatte geschrieben, fuers Favor-Farmen zaehle nur die
Siegzahl, also sei "5x5 gegen Netburners strikt optimal". **Das ist falsch, und zwar am
entscheidenden Punkt.** Der Favor geht an
```js
const factionName = getEnumHelper("FactionName").getMember(boardState.ai);
```
(`Go/boardAnalysis/scoring.ts:67`) — also an **die Faktion des besiegten Gegners**, nicht an eine
frei waehlbare. 400 Siege gegen Netburners geben +81 Favor **bei den Netburners**, deren teuerste
Augmentation 12.500 Rep kostet. Dort braucht niemand Favor, und schon gar keine Spendenschwelle.

**Richtig ist:** Go-Favor ist nur bei Gegnern etwas wert, deren Faktion man (a) beitreten kann
und (b) braucht. Das sind in BN1 im Wesentlichen **Daedalus** (2,5 Mio. Rep fuer The Red Pill)
und **The Black Hand** (175.000 Rep). Beide sind keine "Easy AI": `isSmart()` gibt nur fuer
Netburners `false` zurueck (`Go/boardAnalysis/goAI.ts:247-250`), Black Hand ist "Aggro AI",
Daedalus "Mid AI".

Zwei weitere Korrekturen an derselben Stelle:
- **Die Auszahlung ist unregelmaessiger als "alle zwei Siege".** Sie haengt an
  `winStreak % 2 === 0`, und **eine Niederlage setzt die Serie zurueck**
  (`scoring.ts:56` → `resetWinstreak(boardState.ai, true)`). Wer abwechselnd gewinnt und
  verliert, steht dauerhaft bei `winStreak = 1` und bekommt **null** Favor. Bei 60 % Siegquote
  ist die Ausbeute deutlich schlechter als die halbe Siegzahl.
- **Fuer `nodePower` war meine Empfehlung ebenfalls die schlechteste moegliche:**
  `getDifficultyMultiplier = (komi + 0,5) * 0,25` (`Go/effects/effect.ts:132-134`), Netburners
  komi 1,5 → Faktor **0,5**, der niedrigste im Spiel. Der eigentliche nodePower-Hebel ist ein
  hartkodierter Sonderfall, den ich uebersehen hatte: **5x5 gegen Illuminati gibt Faktor 8**
  statt 2 (`effect.ts:133`, `isTinyBoardVsIlluminati`). Zusammen mit dem 3x-Siegesserien-Deckel
  sind das bis zu `25 * 8 * 3 = 600` nodePower je Partie auf dem kleinsten und schnellsten
  Brett — der mit Abstand beste nodePower-pro-Zeit-Wert. Er zahlt allerdings auf
  `hacking_speed`, nicht auf Reputation.

**RAM.** `makeMove` 4, `getBoardState` 4, `analysis.getValidMoves` 8; **`resetBoardState`,
`passTurn`, `opponentNextTurn`, `getGameState`, `getCurrentPlayer`, `analysis.getStats` kosten
alle 0** (`Netscript/RamCostGenerator.ts:301-330`). Ein Bot mit allen dreien liegt bei
`1,6 + 4 + 4 + 8 = ` **17,6 GB**; wer auf `getValidMoves` verzichtet und die Zuege aus
`getBoardState` selbst prueft, kommt auf **9,6 GB**. (Meine erste Fassung nannte 13,6 GB — das
war `getBoardState` vergessen.) Laeuft auf einem frischen `home`.

**Zwei nuetzliche Details.** `ns.go.analysis.getStats()` kostet 0 GB und liefert `rep` — der Bot
sieht also exakt, wie viel vom 100k-Budget je Faktion noch offen ist. Und ein **frisches Brett
kann man beliebig oft kostenlos neu wuerfeln**, solange noch kein Zug gemacht wurde
(`netscriptGoImplementation.ts:363-366`: `resetWinstreak` nur bei gefuellten `previousBoards`).

**Zur Einschaetzung "eine KI bauen ist ein eigenes Vorhaben"** (`auffaellige-werte.md:653-654`):
Ich hatte dagegengehalten, Netburners auf 5x5 sei ein Nachmittag (`isSmart() === false`,
`goAI.ts:247-250`; zu 20 % ein starker Zug, zu 15 % ein zufaelliger, zu 25 % gar kein
Prioritaetszug, `goAI.ts:264-276`). Nach der Korrektur oben faellt dieses Argument weg —
Netburners-Favor ist wertlos. **`auffaellige-werte.md` behaelt in diesem Punkt recht:** die
Gegner, auf die es ankommt, muss man wirklich schlagen, und zwar 400 Mal.

**Urteil, revidiert.** Der Fund bleibt gueltig, ist aber schwaecher und teurer als in meiner
ersten Fassung:

- **Was traegt:** Die Daedalus-Zahl in `auffaellige-werte.md:650` ist um Faktor 2,5 zu klein
  (+24,1 % statt +9,7 % bei nodePower 5.000). Und vor allem: **+81,27 Favor decken 21,6 % des
  Weges zu Favor 150** ab (`favorToRep(150) = 462.490`, davon 100.000 aus dem Go-Budget) — also
  21,6 % des Weges zu **A0**, dem staerksten Rep-Hebel im Spiel. Das ist der einzige Grund, Go
  ueberhaupt zu bauen, und er ist ein guter.
- **Was nicht traegt:** die billige Variante. Es braucht eine Go-Engine, die "Mid AI"
  beziehungsweise "Aggro AI" zuverlaessig schlaegt, und die **Entwicklungszeit dafuer kann ich
  nicht serioes beziffern**. Genau deshalb steht der Fund auf Rang 5 und nicht auf Rang 2.
- Der `nodePower`-Teil (+42,5 % `faction_rep` bei nodePower 20.000) verfaellt bei jedem Install
  und faellt gegen die 400 Siege kaum ins Gewicht.

**Achtung:** die urspruengliche Skeptiker-Behauptung ("Favor bis 100.000 je Faktion, staerkster
Hebel im Spiel") ist so **falsch** — siehe Abschnitt 4, Punkt 4.1.

---

### A3 — Passive Faktions-Rep: die offene Frage aus `strategie.md` ist beantwortet, und die Schlussfolgerung dort ist falsch

> **Einordnung.** Der Mechanismus selbst steht schon in `doku/formeln-progression.md:423-437`.
> Aber `doku/strategie.md:1281-1284` fuehrt ihn als **ungeklaert**:
> *"je nachdem, wie man `1/120` liest, sind das 30 oder 150 Rep pro Stunde. In beiden Faellen
> gegenueber aktiver Arbeit vernachlaessigbar."*
> Dieser Abschnitt beantwortet die Frage (**150**, nicht 30) und **widerspricht der
> Schlussfolgerung**. Ausserdem uebernimmt `formeln-progression.md:436` den falschen
> Code-Kommentar "1 Rep pro 2 Minuten" — das ist um Faktor 5 daneben.

**Beobachtung.** Alle fuenf Zyklen bekommt **jede** Mitgliedsfraktion passiv Rep — ausser der,
fuer die man gerade arbeitet. Die Rate ist
```js
favorMult = Math.min(0.1, faction.favor / 1000 + 0.01);
rate = Math.max(hRep * favorMult, sRep * favorMult, fRep * favorMult, 1 / 120);   // pro Zyklus
faction.playerReputation += rate * numCycles;
```

**Beleg.** `Faction/FactionHelpers.tsx:132-170`, insbesondere `:157` (`favorMult`) und `:162`
(die `Math.max`-Zeile mit dem Mindestwert `1/120`). Aufgerufen alle 5 Zyklen
(`engine.tsx:185-188`) und **auch offline** (`engine.tsx:318`).
Ausgenommen: die Fraktion, fuer die gerade gearbeitet wird (`:138-140`), `special`-Fraktionen
(`:147-149`) und die eigene Gang (`:151-153`).

**Wirkung, beziffert.**
- **Die Aufloesung der offenen Frage:** `rate` ist **je Zyklus**, und der Aufrufer uebergibt die
  Zahl der verstrichenen Zyklen (`engine.tsx:185-188`: `adjustedCycles = Math.floor(5 - counter)`,
  Zaehler danach wieder auf 5). Es sind also `1/120 * 5 = 1/24` Rep pro Sekunde =
  **150 Rep/h**, nicht 30. Der Code-Kommentar daneben (`FactionHelpers.tsx:158`,
  "minimum 1 rep / 2 minute") ist falsch — es ist 1 Rep je 24 Sekunden.
- `favorMult` ist bei Favor 0 nur 0,01 und **erreicht ab Favor 90 seinen Deckel 0,1**. Dann sind
  es 10 % der aktiven Arbeitsrate — je Fraktion, gleichzeitig, in allen. Bei Hacking-Arbeit mit
  5 Rep/s aktiv sind das **0,5 Rep/s = 1.800 Rep/h passiv, je Fraktion**.
- Mit sechs Mitgliedschaften und Favor >= 90 sind das **9.000 Rep/h passiv** — nicht 10.800:
  die Fraktion, fuer die gerade gearbeitet wird, faellt heraus (`FactionHelpers.tsx:138-140`),
  es zaehlen also fuenf. Gegenueber 18.000 Rep/h aus aktiver Arbeit in genau einer Fraktion.

**Gegen den echten Stand gerechnet** (`doku/auffaellige-werte.md:393-397`: gemessen 0,8445 Rep
je Zyklus aktiv, CyberSec-Favor 28,36):
`favorMult = min(0.1, 28.36/1000 + 0.01) = 0.0384` → passiv **0,0324 Rep/Zyklus = 583 Rep/h**
je Fraktion, gegen 15.200 Rep/h aus aktiver Arbeit in einer. Bei vier Mitgliedschaften sind das
**+2.330 Rep/h, also rund +15 %** obendrauf — heute. Mit steigendem Favor waechst der Anteil bis
auf das Maximum von 10 % der Aktivrate je Fraktion, also bei vier Fraktionen +40 %.

**Zwei Kommentare im Code sind falsch** — nicht darauf verlassen: `:161` sagt
"minimum 1 rep / 2 minute" (tatsaechlich 1 Rep je 24 s, Faktor 5 daneben), und `:154-156` sagt
"100 favor = 11%/s" (`Math.min(0.1, …)` deckelt schon bei Favor 90).

**Folgerung, die der Strategie widerspricht.** `doku/strategie.md` behandelt Fraktionen als
Stationen, die man nacheinander abarbeitet. Der Code belohnt das Gegenteil: **so frueh wie
moeglich in so viele Fraktionen wie moeglich eintreten**, auch in solche, deren Augmentations
man nicht will — jede laeuft danach dauerhaft und kostenlos mit. Und weil Favor der Hebel ist,
zahlt sich das ueber mehrere Install-Runden immer staerker aus.

**Aufwand.** Null, sobald der Beitritt automatisiert ist (A4). Nur eine Planungsaenderung.

**Urteil.** `doku/strategie.md:1284` nennt den Posten "gegenueber aktiver Arbeit
vernachlaessigbar". Das stimmt fuer **eine** Fraktion bei niedrigem Favor, und nur dort. Richtig
ist: er laeuft **in allen Fraktionen gleichzeitig**, **auch waehrend man woanders arbeitet**,
**auch offline**, und sein Anteil waechst mit dem Favor bis auf 10 % der Aktivrate je Fraktion.
Heute sind das +15 %, nach ein paar Install-Runden bis zu +40 % bei vier Fraktionen.

**Zwei Bedingungen, die ich zuerst verschwiegen hatte:**
1. **Der 10-%-Deckel kostet Vorleistung.** `favorMult` erreicht 0,1 erst bei Favor 90, und
   Favor 90 sind **123.578 kumulierte Rep** je Fraktion (`Faction/formulas/favor.ts:12-14`,
   nachgerechnet). Bei 4,91 Rep/s sind sechs Fraktionen auf Favor 90 rund **42 Stunden**
   Vorleistung. "Aufwand: Null" war also falsch — null Aufwand ist nur der *Beitritt*, nicht der
   Favor.
2. **Die Mitgliedschaft ueberlebt den Install nicht.** `Faction.prestigeAugmentation()` setzt
   `isMember = false` (`Faction/Faction.ts:77-85`) — dieselbe Zeile, die ich bei V20 fuer den
   `isBanned`-Reset zitiere. Die Empfehlung "frueh in viele Fraktionen eintreten" muss also
   **nach jedem Install komplett neu ausgefuehrt** werden. Der Favor bleibt, die Mitgliedschaft
   nicht.

Damit bleibt der Fund richtig, aber deutlich kleiner als in meiner ersten Fassung: **heute
+190 Rep/h** (Tian Di Hui bei Favor 0, waehrend fuer CyberSec gearbeitet wird), also **1,1 %**
eines Arbeitsstroms. Der eigentliche Grund, frueh in viele Fraktionen einzutreten, ist ein
anderer und steht schon in `doku/auffaellige-werte.md` Punkt 4: **die 30 verschiedenen
Augmentations fuer die Daedalus-Bedingung** (12 ohne, 40 mit den offenen Fraktionen).

---

### A4 — Die `join.js`-Technik gilt fuer alle zwoelf `isTrusted`-Klicksperren

**Beobachtung.** In `doku/join-problem.md` ist der Weg beschrieben, den `onClick`-Handler ueber
`__reactProps$…` direkt mit `{isTrusted: true}` aufzurufen. **Was dort nicht steht: von den
zwoelf Klick-Pruefstellen liest keine einzige irgendein anderes Feld des Ereignisses.** Ich habe
alle 14 Fundstellen einzeln nachgelesen; zwei davon sind keine Klicksperren (Unclickable,
BBCabinet) und fallen heraus. Fuer die zwoelf uebrigen gilt die Technik.

**Zwei Ausnahmen, die ich zuerst falsch pauschalisiert hatte:** `Infiltration/ui/InfiltrationRoot.tsx:74`
verlangt zusaetzlich `event instanceof KeyboardEvent`, und `Arcade/ui/BBCabinet.tsx:17` liest
`ev.origin` und `ev.data` — das ist aber eine `postMessage`-Herkunftspruefung, keine Klicksperre.

**Vollstaendige Fundliste (`grep -rn isTrusted` in v301):**

| Datei:Zeile | Gesperrte Aktion | liest ausser `isTrusted` |
|---|---|---|
| `Faction/ui/FactionsRoot.tsx:89` | Join! in der Faktionsliste | nichts |
| `Programs/ui/ProgramsRoot.tsx:96` | Programmbau fortsetzen | nichts |
| `Programs/ui/ProgramsRoot.tsx:108` | **Create program** | nichts |
| `Locations/ui/CompanyLocation.tsx:62` | Infiltrate Company | nichts |
| `Locations/ui/CompanyLocation.tsx:71` | **Work (Firmenarbeit)** | nichts |
| `Locations/ui/HospitalLocation.tsx:23` | Get treatment | nichts |
| `Locations/ui/SlumsLocation.tsx:25` | **alle Verbrechen** | nichts |
| `Casino/Blackjack.tsx:143, 160, 241` | Blackjack Hit/Stay/Start | nichts |
| `Casino/utils.ts:3-8` (`trusted()`) | CoinFlip, Roulette, Slots | nichts |
| `Infiltration/ui/InfiltrationRoot.tsx:74` | Tasten in der Infiltration | **`event instanceof KeyboardEvent`** |
| `Exploits/Unclickable.tsx:11` | (Belohnung, keine Sperre) | Computed Style |
| `Arcade/ui/BBCabinet.tsx:17` | (`postMessage`-Herkunft, keine Klicksperre) | **`ev.origin`, `ev.data`** |

**Wirkung — und warum der Fund trotzdem nur auf Rang 7 steht.** Neu ist nur die
Verallgemeinerung auf **Firmenarbeit** und **Verbrechen**. Beides ist in BN1 der falsche Weg:
Charisma 1 und alle vier Kampfwerte 1 machen beides zunaechst wertlos, und **beides belegt
`currentWork`** — blockiert also genau den Rep-Erwerb, um den es geht
(`doku/auffaellige-werte.md` Punkt 10). Die 300-400k Firmen-Rep aus `doku/strategie.md` P7
braucht man ausserdem gar nicht: die sieben erreichbaren Fraktionen liefern 40 verschiedene
Augmentations gegen die 30 der Daedalus-Bedingung (`doku/auffaellige-werte.md` Punkt 4).

Der Kern der Technik ist ohnehin **bereits bewiesen und gebaut** — `doku/auffaellige-werte.md`
Punkt 4: *"der Weg ueber die React-Props des Knopfes traegt in der Praxis — Tian Di Hui wurde
heute genau so beigetreten"*, und `src/join.js`, `src/travel.js`, `src/work.js`,
`src/homeram.js`, `src/buyaugs.js` fahren alle darueber.

**Was hier NICHT neu ist:** dass der Join-Knopf im Einladungs-Modal ungeschuetzt ist, steht
bereits in `doku/join-problem.md:99-101` — dort sogar mit der wichtigen Zusatzerkenntnis, dass
ein versehentliches `close()` die Einladung **endgueltig** verwirft und der Weg deshalb nicht
allein tragfaehig ist. Ein Detail ergaenze ich: ein Terminal-`backdoor` **erzwingt die
Einladungspruefung sofort** (`Terminal/Terminal.ts:390-391`:
`Engine.Counters.checkFactionInvitations = 0; Engine.checkCounters();`), man muss also nicht auf
den 10-Zyklen-Takt warten. Dasselbe tut ein erfolgreicher Terminal-`hack`
(`Terminal/Terminal.ts:278`).

Und `joinFaction` selbst prueft **nur** `if (faction.isMember) return;`
(`Faction/FactionHelpers.tsx:35-36`) — die gesamte Zugangslogik liegt in der UI und ist dort
dreimal unterschiedlich implementiert.

**Aufwand.** Die vorhandene `entwurf/join/join.js` verallgemeinern.

**Urteil.** Hoechster Hebel fuer den Klickpfad, sehr geringer Aufwand, an einem folgenlosen
Knopf sofort messbar (Krankenhaus "Get treatment": kostet Geld nur bei fehlenden HP).
**Nicht** anwendbar auf die Infiltration — dort steht `instanceof KeyboardEvent` davor, und ein
Fehlversuch hospitalisiert (V4). Ein echtes `KeyboardEvent` mit per `Object.defineProperty`
gesetztem `isTrusted` waere denkbar; ich habe es nicht geprueft und wuerde es angesichts von V4
auch nicht ausprobieren.

---

### A5 — Die Reputationsanforderung von Augmentations skaliert NICHT mit der Warteschlange

**Beobachtung.** Der `1.9^n`-Multiplikator wirkt **ausschliesslich auf `moneyCost`**. `repCost`
bleibt konstant.

**Beleg.** `Augmentation/AugmentationHelpers.ts:157` (Geld: `baseCost * genericMult * nodeMult`)
gegenueber `:158` (Rep: `baseRepRequirement * nodeMult`, **ohne** `genericMult`). Ebenso beim NFG
(`:135` Rep nur `1.14^level`, `:137` Geld zusaetzlich `* genericMult`) und bei SoA (`:152`).

**Wirkung, zwei Folgerungen.**
1. Man muss die Rep-Huerde einer Fraktion **einmal** erreichen und kann danach beliebig viele
   Augs kaufen — nur das Geld skaliert. Also: **Rep-Grinden vorziehen, Geld-Grinden nachziehen.**
2. Die Kaufreihenfolge "teuerste zuerst" folgt direkt aus der Formel, nicht aus Forenwissen:
   Gesamtkosten sind `Σ baseCost_{p(i)} * 1.9^i`, und weil die Gewichte streng steigen,
   minimiert die Umordnungsungleichung die Summe genau bei absteigender `baseCost`. Es gibt
   keinen Gegendruck von der Rep-Seite.

**Falle in der Oberflaeche:** der Sortierknopf "Sort by Cost" sortiert **aufsteigend**
(`Faction/ui/AugmentationsPage.tsx:69`), also genau falsch herum. Die Liste rendert alle 400 ms
neu, Einzeleintraege alle 600 ms — nach jedem Kauf sind die DOM-Preise binnen ~0,6 s aktuell.

**Urteil.** Kein Exploit, aber eine harte Planungsregel, die in `doku/strategie.md` P6 nur als
Halbsatz steht ("teuerste zuerst, NFG zuletzt"). Der Grund dafuer ist jetzt belegt.

---

### A6 — SoA-Augmentations umgehen die Preisskalierung — **streichen**

**Beobachtung.** Die neun Shadows-of-Anarchy-Augs sind aus dem Warteschlangen-Multiplikator
**herausgefiltert** — sie erhoehen ihn nicht und werden nicht von ihm getroffen. Sie zaehlen
aber voll in `Player.augmentations.length`, also in die Daedalus-Bedingung von 30 Augs.

**Beleg.** `Augmentation/AugmentationHelpers.ts:17-27` (Namensliste), `:33-35`
(`queuedNonSoAAugmentationList`), `:141-153` (eigene Kostenkurve `7^n` Geld / `1.3^n` Rep,
`Constants.ts:100-101`), `:62-66` (kein Sonderfall beim Einbuchen),
`Faction/FactionInfo.tsx:142` mit `DaedalusAugsRequirement = 30`
(`BitNode/BitNodeMultipliers.ts:61`).
Basispreis aller neun: 1e4 Rep / 1e6 $ (z.B. `Augmentations.ts:1996-2005`). Reihe: 1 Mio.,
7 Mio., 49 Mio., 343 Mio., 2,4 Mrd., …
`Player.hasAugmentation` zaehlt **auch die Warteschlange** (`PersonObjects/Person.ts:233-241`),
der 7er-Sprung greift also sofort beim Kauf.

**Wirkung.** Neun von dreissig Daedalus-Punkten, die ersten vier zusammen ~400 Mio. $, **ohne**
den `1.9^n`-Multiplikator anzufassen.

**Aufwand.** Der Haken: die Einladung zu Shadows of Anarchy kommt nur nach einer **erfolgreich
abgeschlossenen Infiltration** (`Infiltration/ui/Victory.tsx:89-94`), und Infiltration ist
**nicht automatisierbar** (V4). Ausserdem sind mit Startstats nur Orte mit
`startingSecurityLevel < ~3,52` ueberhaupt betretbar (New Tokyo Noodle Bar 2,5; Ishima Omega
Software 3,2; Aevum NetLink 3,29 — `Locations/data/LocationsMetadata.ts`), sonst gibt es sofort
vollen HP-Schaden (`Infiltration/Infiltration.ts:97-108`).

**Urteil: streichen.** Fuer den Bot unerreichbar (Infiltration, V4). Der behauptete Restwert —
neun der dreissig Daedalus-Plaetze — wird gar nicht gebraucht: `doku/auffaellige-werte.md`
Punkt 4 zaehlt **40 verfuegbare Augmentations gegen die 30 der Bedingung**. Der Nutzen der Augs
selbst ist ausserdem gering: acht von neun machen nur je ein Infiltrations-Minispiel leichter,
nur `WKSharmonizer` hat Substanz. Ich lasse den Abschnitt nur stehen, damit die Sackgasse
dokumentiert ist.

---

### A7 — Offline gibt es Fraktions-Rep, ohne zu arbeiten

**Beobachtung.** Beim Laden der Seite bekommt der Spieler Fraktions-Rep fuer die Offlinezeit —
**aber nur, wenn `Player.currentWork === null` ist.** Je Mitgliedsfraktion, die Arbeit anbietet:
`max(Hacking-, Security-, Field-Rate) / Anzahl aller Fraktionen * Offlinezyklen`.

**Beleg.** `engine.tsx:280-305`. Der Divisor ist `Player.factions.length` (alle Fraktionen), die
Schleife laeuft nur ueber die, die `offersWork()` haben und nicht die eigene Gang sind.

**Wirkung.** Die Summe ueber alle Fraktionen ist ungefaehr `max-Rate * Offlinezeit` — also
dasselbe Gesamtvolumen wie fokussierte Arbeit bei **einer** Fraktion, nur auf alle verteilt und
ohne einen einzigen Klick. Wer in 4 von 4 arbeitsanbietenden Fraktionen ist, bekommt in jeder
ein Viertel der vollen Rate.

Ergaenzend: **offline wird mit vollem Fokusbonus gearbeitet**, wenn eine Arbeit laeuft —
`engine.tsx:281-282` setzt `Player.focus = true` vor `processWork`. Das sind 25 % mehr als
unfokussiertes Online-Arbeiten (`Constants.ts` `BaseFocusBonus`).

**Urteil.** Wichtig fuer die Frage "Tab zu oder auf" (siehe V10) und dafuer, ob man vor dem
Schliessen eine Arbeit startet oder nicht. Kein Exploit, aber eine Mechanik, die man bewusst
waehlen sollte statt sie zu erleiden.

---

### A8 — Die Zehn-Milliarden-Grenze im Casino setzt sich bei jedem Install zurueck — **streichen**

**Beobachtung.** Das Casino-Limit prueft `Player.getCasinoWinnings() > 10e9`, und das ist
`moneySourceA.casino`. **`moneySourceA.reset()` laeuft bei jedem Augmentierungs-Install.**

**Beleg.** `Casino/Game.ts:4,13-19` (`gainLimit = 10e9`),
`PersonObjects/Player/PlayerObjectGeneralMethods.ts:600` (`getCasinoWinnings`), `:128`
(`this.moneySourceA.reset()` in `prestigeAugmentation`).

**Wirkung.** 10 Mrd. **je Install-Zyklus**, nicht je Spielstand. Bei der geplanten Anzahl von
Ausbaurunden (`doku/strategie.md` P7) sind das mehrfach 10 Mrd.

**Der Haken:** alle vier Spiele haengen an `isTrusted` (Tabelle in A4). Ueber die
`__reactProps`-Technik waere das erreichbar — aber dann bleibt die Frage, welches Spiel man
spielt. Zwei RNG-Befunde dazu:

- **Slots:** `const [rng] = useState(new WHRNG(Player.totalPlaytime))`
  (`Casino/SlotMachine.tsx:141`) — der Seed ist die **Gesamtspielzeit** und damit ueber
  `ns.getPlayer()` auslesbar; `WHRNG` setzt alle drei Zustaende auf `(seed/1000) % 30000`
  (`Casino/RNG.ts:45-51`) und ist danach vollstaendig deterministisch (1 Zahl je `play`, 5 je
  `lock`). Man kann jeden kuenftigen Spin vorausberechnen und nur dann druecken, wenn er
  gewinnt.
- **Roulette:** `new WHRNG(new Date().getTime())` beim Mount (`Casino/Roulette.tsx:110`),
  `v = (seed/1000) % 30000` (`Casino/RNG.ts:45-51`) — der Bruchteil bleibt erhalten, die
  Aufloesung ist also eine Millisekunde. **Wer den Mount selbst ausloest, kennt `Date.now()`
  und damit den Seed exakt** — es braucht nicht einmal eine Suche. Danach ist jede kuenftige
  Zahl vorausberechenbar. Das Haus wuerfelt bei Spielergewinn mit 10 % neu, also 0,9 x 36-fach auf die
  richtige Einzelzahl bei 1e7 Einsatz — **10 Mrd. in ~30 Spins.**
- **CoinFlip** ist ein LCG mit Periode 1024 (`Casino/RNG.ts:36-61`), nach ~10 Wuerfen eindeutig
  — aber bei max. 10.000 $ Einsatz und 250 ms Sperre braucht man ~70 Stunden fuer 10 Mrd.

**Urteil.** Rechnerisch der groesste Geldposten im ganzen Bericht, aber er steht und faellt mit
zwei ungeklaerten Fragen: (a) traegt die `__reactProps`-Technik am Casino, (b) will Eric das
ueberhaupt. **Empfehlung: nicht bauen.** 10 Mrd. je Install-Zyklus sind bei gemessenen
164,8 Mio. $/s (`doku/auffaellige-werte.md:136`) genau **61 Sekunden Einkommen**. Dafuer einen
RNG-Kracker plus Klick-Trickserei zu bauen, ist der schlechteste Zeit-Ertrag im ganzen Bericht.
Ich fuehre es nur auf, weil danach gefragt war — und damit es als geprueft und verworfen gilt.

---

### A9 — Ein Reload mit laufender Arbeit schenkt dauerhaften Focus (+25 %)

**Beobachtung.** Beim Laden der Seite setzt die Engine `Player.focus = true`, bevor sie die
Offline-Arbeit verrechnet — und **stellt es danach nie zurueck**. Zurueckgesetzt wird `focus`
nur an einer Stelle: wenn man die Work-Seite **verlaesst**.

**Beleg.**
```js
// engine.tsx:280-283
if (Player.currentWork !== null) {
  Player.focus = true;
  Player.processWork(numCyclesOffline);
}
```
Der einzige Ruecksetzer: `ui/GameRoot.tsx:273-275` —
`if (pageWithContext.page === Page.Work && page !== Page.Work && Player.currentWork && Player.focus) …`.
Wirkung von `focus`: `focusPenalty()` gibt 1 statt `CONSTANTS.BaseFocusBonus` = 0,8
(`PersonObjects/Player/PlayerObjectGeneralMethods.ts:622-628`).

**Wirkung.** Wer mit laufender Arbeit neu laedt und die **Work-Seite nie betritt**, arbeitet
dauerhaft mit Faktor 1,0 statt 0,8 — also **+25 %** auf Faktions-Rep, Firmen-Rep, Firmen-Geld
und -Exp, Programmiertempo, Verbrechens-Erfolgsquote und Karma
(`Work/FactionWork.tsx:38,43`, `Work/CompanyWork.tsx:36`, `Work/CreateProgramWork.ts:59,64`,
`Work/CrimeWork.ts:64,67,84`).

**Aufwand.** Praktisch keiner — der Bot laedt nach jedem Install ohnehin neu (V2). Er darf
danach nur nicht auf die Work-Seite navigieren.

**Urteil.** Hoher Nutzen bei null Aufwand, aber **aus dem Code abgeleitet und nicht gemessen**.
Vor dem Einbau einmal pruefen: nach einem Reload mit laufender Fraktionsarbeit die Rep-Rate
gegen die Formel halten. Steht in Abschnitt 5 als offene Messung.

Verwandt und ebenfalls belegt: **Offline-Arbeit hat gar keinen Abschlag** — anders als
Skripteinkommen (Faktor 0,75, `Constants.ts` `OfflineHackingIncome`) laeuft `processWork`
offline zu 100 % und mit vollem Focus (`engine.tsx:280-283`). Wegzugehen kostet bei laufender
Arbeit also nichts.

---

### A10 — Drei Wirtschaftsbefunde, die die Planung aendern

**(a) Server-Upgrades sind aufpreisfrei — klein kaufen und laufend hochruesten ist strikt besser.**
`getCloudServerUpgradeCost = getCloudServerCost(neu) - getCloudServerCost(alt)`
(`Server/ServerPurchases.ts:44-54`). Das teleskopiert exakt: `Kauf(a) + Upgrade(a→b) = Kauf(b)`.
In BN1 ist die Kostenkurve ohnehin linear — `CloudServerCost` und `CloudServerSoftcap` sind
beide 1, also **55.000 $ je GB** (`:23-42`, `Server/data/Constants.ts:4`
`BaseCostFor1GBOfRamServer = 55000`). Es gibt also **keinen Grund zu sparen**: sofort 25 kleine
Server kaufen und aus dem laufenden Einkommen hochruesten. Das bestaetigt `doku/strategie.md`
P4 und begruendet es zusaetzlich.
Grenzen: 25 Server, max. 2^20 = 1.048.576 GB (57,67 Mrd. $ fuer den Maximalserver).

**(b) Studium und Gym ignorieren die Focus-Strafe vollstaendig — und Computer Science ist gratis.**
In `Work/ClassWork.tsx` kommt `focusPenalty` **gar nicht vor** (Grep ueber die ganze Datei ohne
Treffer), im Gegensatz zu allen anderen Arbeitstypen. Der Automat kann waehrend Studium und
Training beliebig durch die Oberflaeche navigieren, ohne etwas zu verlieren.
`UniversityClassType.computerScience` hat `newWorkStats({ hackExp: 0.5, intExp: 0.01 })` —
**kein `money`-Feld, also kostenlos** (`Work/ClassWork.tsx:23-27`). Am ZB Institute in Volhaven
(`expMult` 4, `Locations/data/LocationsMetadata.ts`) sind das 2 Hacking-Exp/s gratis, dauerhaft,
ohne Focus-Zwang. Als Grundlast fuer den Automaten, wenn sonst nichts ansteht, sinnvoll.
Vorsicht: alle anderen Kurse und alle Gyms kosten Geld und pruefen den Kontostand nicht (V17).

**(c) Firmen-Rep haengt NICHT von der Firma ab.**
`gains.reputation = jobPerformance * mults.company_rep * (1 + favor/100) * CompanyWorkRepGain`
(`Work/Formulas.ts:156`) — weder `company.expMultiplier` noch `company.salaryMultiplier` gehen
ein, die skalieren nur Exp bzw. Gehalt (`:138`, `:150`). Fuer **reine Rep** nimmt man also die
Firma mit dem niedrigsten `jobStatReqOffset`, die die Position ueberhaupt anbietet — nicht die
prestigetraechtigste. Und: ein **Backdoor auf dem Firmenserver senkt die geforderte Rep fuer die
Fraktionseinladung auf 75 %** (`Constants.ts:110`, `Company/utils.ts:15-18`, angewandt in
`Faction/FactionJoinCondition.ts`). Das ist bei 400.000 Rep fuer die Megakonzern-Fraktionen ein
Sprung von 100.000 Rep.
Ausserdem: **es gibt kein Job-Limit** — `applyForJob` schreibt schlicht
`this.jobs[company.name] = pos.name` (`PlayerObjectGeneralMethods.ts:345`). Man kann bei allen
Firmen gleichzeitig angestellt sein (relevant fuer Fraktionsbedingungen), arbeitet aber immer
nur bei einer. Der Bewerbungsknopf hat **keine `isTrusted`-Pruefung**
(`Company/ui/ApplyToJobButton.tsx`), und `applyForJob` klettert automatisch bis zur hoechsten
Position hoch, fuer die man qualifiziert ist (`:325-329`) — **ein Klick genuegt**, man muss
nicht Stufe fuer Stufe bewerben. Einen automatischen Aufstieg waehrend der Arbeit gibt es
dagegen nicht; der Bot muss periodisch neu bewerben.

*(Die Zeilen in `Work/Formulas.ts`, `Company/*` und `LocationsMetadata.ts` stammen aus dem
3.0.2-Baum. `ClassWork.tsx`, `ServerPurchases.ts`, `PlayerObjectGeneralMethods.ts` und
`ApplyToJobButton.tsx` habe ich in v301 gegengelesen.)*

---

### A11 — Weitere Posten, kurz

| # | Beobachtung | Beleg | Wirkung / Urteil |
|---|---|---|---|
| **A11.1** | **`--ram-override` schaltet die statische RAM-Analyse komplett aus.** `const singleRamUsage = runOpts.ramOverride ?? script.getRamUsage(...)` — bei gesetztem Override wird die Analyse per Kurzschluss gar nicht ausgefuehrt. Untergrenze ist genau `Base` = 1,6 | `NetscriptWorker.ts:287`, `Terminal/commands/runScript.ts:43-52`, `Netscript/NetscriptHelpers.tsx:245-255` | Umgeht die 25 GB fuer `document`. NS-Funktionen fangen weiterhin die Laufzeitpruefung (`NetscriptHelpers.tsx:435-465`) |
| **A11.2** | **Syntaktisches `ns.ramOverride(<Literal>)` als erste Anweisung in `main` umgeht auch die Obergrenze** von 1024 GB, weil die Berechnung sofort abbricht | `Script/RamCalculations.ts:174-183, 352-401` | Nur bei `function main` (nicht `const main = async …`), nur Zahlenliteral, nur >= 1,6 |
| **A11.3** ~~streichen~~ | **`globalThis` als Ablage zwischen Skripten.** NS2-Skripte laufen als echte ES-Module im Seitenkontext (Blob-URL + dynamisches `import`), teilen sich also `globalThis`. Skript A kann `globalThis.__x = ns` setzen; Skript B nutzt es fuer 1,6 GB. Verrechnet wird gegen A, das schon bezahlt hat. `globalThis` kostet nichts (nur die Bezeichner `document` und `window` kosten, `RamCalculations.ts:185-192`) | `NetscriptJSEvaluator.ts` (Blob-Import), `Netscript/APIWrapper.ts:77-82` (`ctx` ist fest gebunden) | **Streichen.** Spart 1,6 GB je Skript auf einem Netz von 15,73 PB (rund 1e-8 der Kapazitaet) und bricht, sobald Skript A stirbt (`checkEnvFlags`, `NetscriptHelpers.tsx:399-403`, wirft `ScriptDeath`). Gegen die Fehlerklasse V1/V5 ist das ein Minusgeschaeft |
| **A11.4** | **Contracts auf `home` ueberleben den Install** — `prestigeHomeComputer` fasst `contracts` nicht an | `Prestige.ts:74, 80` | Kleiner Puffer; verschieben geht nicht (`ns.scp` nimmt keine `.cct`) |
| **A11.5** | **Export-Bonus: +1 Favor bei JEDER Mitgliedsfraktion, alle 24 h.** Kein Multiplikator, kein Zeitfenster — ein dauerhafter Favor-Punkt. Der Export-Knopf hat **keine** `isTrusted`-Pruefung | `ExportBonus.tsx:6-20`, `SaveObject.ts:239-251`, `ui/GameRoot.tsx:446, 465` (3.0.2-Zeilen) | Klein, aber gratis und per DOM ausloesbar. Nebenwirkung: jedes Mal landet eine `.json.gz` im Downloads-Ordner |
| **A11.6** | **`ns.share`: `1 + ln(effektiveFaeden)/25` auf Fraktions-Rep**, Kosten 2,4 GB je Faden. Faeden werden mit `calculateIntelligenceBonus` und dem Kern-Bonus des Servers multipliziert | `NetworkShare/Share.ts:22-25, 43-48`, `RamCostGenerator.ts:566` **Schon ausgereizt** — `doku/auffaellige-werte.md:677-684` misst 682.000 Faeden = Bonus 1,5373; den gesamten freien Speicher nachzulegen braechte nur noch +2,4 %. Hier ist nichts mehr zu holen |
| **A11.7** | **Terminal-`hack` setzt bei Erfolg `backdoorInstalled`** — inklusive erzwungener Einladungspruefung | `Terminal/Terminal.ts:270-280` | Kein Vorteil gegenueber `backdoor` (das dauert nur `hackTime/4` und geht immer), aber ein Rueckfallweg. Die Level-Anforderung ist bei beiden dieselbe (`Terminal/commands/hack.ts:11-15`, `backdoor.ts:27-32`) |
| **A11.8** | **`ns.formulas` braucht kein Source File**, nur `Formulas.exe` — 5 Mrd. im Darkweb oder ab Hacking 1000 selbst schreiben | `NetscriptFunctions/Formulas.ts` (Gate ist `hasProgram`), `DarkWeb/DarkWebItems.ts` | Bekannt, hier nur zur Vollstaendigkeit |
| **A11.9** | **RFA `pushFile` prueft keine Root-Rechte** — ueber die Bruecke lassen sich Dateien auf jeden Server schreiben, auch auf nicht gerootete | `RemoteFileAPI/MessageHandlers.ts:66-71, 92-101` | Nutzlos: `NetscriptWorker.ts:280` verlangt zum **Starten** `hasAdminRights`. Nur als Kuriosum notiert |

---

# 3. Das eingebaute Exploit-System (Source-File -1)

Das Spiel belohnt Regelbrueche ausdruecklich. `Exploits/Exploit.ts:1-11` sagt das im Klartext,
und `:26-28` laedt sogar dazu ein.

**Was es bringt — ich hatte es zuerst falsch bewertet.** `applyExploit()` gibt `1.001^n` auf
fast alle Multiplikatoren und `0.999^n` auf die Hacknet-Kosten
(`Exploits/applyExploits.ts:9-43`). Ich hatte daraus "0,1 % je Exploit, praktisch wertlos"
gemacht. **Das ist der falsche Massstab**, denn einer der getroffenen Multiplikatoren ist
`Player.mults.hacking` (`applyExploits.ts:16`) — und der steht im **Nenner eines Exponenten**:

```
calculateExp(L, m) = e^((L/m + 200)/32) − 534,6      (PersonObjects/formulas/skill.ts:17)
```

Am Betriebspunkt aus `doku/auffaellige-werte.md` Punkt 0 (m = 4,50, Ziel Hacking 2500,
1,80e10 Erfahrung noetig, rund 249 h bei 20k Exp/s):

| Exploits | `mults.hacking` | Exp fuer Level 2500 | Ersparnis | bei 20k Exp/s |
|---:|---|---|---|---|
| 0 | 4,5000 | 1,7955e10 | — | 249,4 h |
| **3** (a/b/c) | 4,5135 | 1,7045e10 | **−5,07 %** | **236,7 h (−12,7 h)** |
| 5 (a-e) | 4,5225 | 1,6466e10 | −8,29 % | 228,7 h (−20,7 h) |

**Und `Player.exploits` wird nirgends zurueckgesetzt** — weder in `prestigeAugmentation` noch in
`prestigeSourceFile` (`grep -rn exploits PersonObjects/Player/ Prestige.ts`: nur die Deklaration
in `PlayerObject.ts:68` und `giveExploit` in `PlayerObjectGeneralMethods.ts:582-583`). Der Bonus
ueberlebt jeden Install und jeden BitNode-Wechsel.

**Damit ist das der einzige Posten im ganzen Bericht, der Engpass 1 trifft** — den
Hacking-Level-Multiplikator, den `doku/strategie.md:22-30` als staerksten Engpass fuehrt.
Drei Zeilen Code, fuenf Minuten, dauerhaft.

*Einschraenkung, ausdruecklich:* Die Rechnung haengt am Betriebspunkt. Bei m = 5,76
(BitRunners-Augs plus NFG 25) schrumpft der Gewinn auf −4,0 % beziehungsweise gut 12 Minuten.
Der Befund traegt in der Muehlenphase, nicht am Ende. Und der Bonus wird erst in
`reapplyAllSourceFiles()` angewendet — also **erst nach dem naechsten Install oder Neuladen**.

Zwei Feinheiten:
- Der Bonus wird erst in `reapplyAllSourceFiles()` angewendet
  (`PersonObjects/Player/PlayerObjectGeneralMethods.ts:445`), also **erst nach dem naechsten
  Install oder Neuladen** — nicht sofort beim Einsammeln.
- `Player.exploits` steht **nicht** in `Player.sourceFiles`, `knowAboutBitverse()` bleibt also
  `false` (`BitNode/BitNodeUtils.ts:21-28`). Das schliesst den N00dles-Exploit aus.

## 3.1 Die elf Exploits, einzeln geprueft

| Exploit | Ausloeser | Mit unseren Mitteln? | Aufwand |
|---|---|---|---|
| **UndocumentedFunctionCall** | `ns.exploit()` | **Ja, sofort** | 1 Zeile |
| **INeedARainbow** | `ns.rainbow("noodles")` | **Ja, sofort** — Passwort geknackt, siehe unten | 1 Zeile |
| **Bypass** | `ns.bypass(document)` bei Skript-RAM von exakt 1,6 GB | **Ja, sofort** | 1 Zeile + `--ram-override 1.6` |
| **TimeCompression** | `performance.now()` fuer ~20 s verbiegen | **Ja** | ~20 s Wartezeit |
| **PrototypeTampering** | `Number.prototype.toExponential` verbiegen, ueber einen 15-Minuten-Tick hinweg | **Ja** | ~16 min Wartezeit |
| **YoureNotMeantToAccessThis** | Dev-Menue oeffnen | **Nein** — siehe 4.2 | — |
| **Unclickable** | echten Klick auf ein `display:none`-Element | **Nein** — siehe 4.3 | — |
| **N00dles** | Nudeln essen, wenn `knowAboutBitverse()` | **Nein** — braucht ein echtes Source File | — |
| **RealityAlteration** | `x` in `alterReality()` auf `true` zwingen | Nur mit Debugger-Haltepunkt | Grenzfall, siehe unten |
| **TrueRecursion** | Bitburner im Arcade-Automaten im Spiel durchspielen | Theoretisch; braucht `github.io`-Verbindung | sehr hoch |
| **EditSaveFile** | Spielstand editieren | Von Eric ausgeschlossen | — |

**Alle fuenf `ns.`-Funktionen kosten 0 GB** (`Netscript/RamCostGenerator.ts:657, 660-663`) und
brauchen kein Source File.

## 3.2 Die vier erreichbaren, konkret

**(a) `ns.exploit()`** — `NetscriptFunctions/Extra.ts:20`. Fertig.

**(b) `ns.rainbow("noodles")`** — `NetscriptFunctions/Extra.ts:53-58` prueft gegen den
bcrypt-Hash `$2a$10$aertxDEkgor8baVtQDZsLuMwwGYmkRM/ohcA6FjmmzIHQeTCsrCcO` (`:55`).
**Ich habe das Passwort ausgerechnet:** es ist `noodles` (klein geschrieben). Verfahren:
`bcryptjs` in einem Temp-Verzeichnis installiert, eine Kandidatenliste rund um "Rainbow",
Bitburner-Begriffe und uebliche Passwoerter durchprobiert, `bcrypt.compareSync` liefert einen
Treffer. Passt inhaltlich: der Hinweis "by using the power of the rainbow" ist eine
Anspielung auf Rainbow Tables, und `n00dles` ist der Running Gag des Spiels.

**(c) `ns.bypass(document)`** — `Extra.ts:21-37`. Zwei Bedingungen:
1. Das uebergebene Objekt muss das **echte** `document` sein (der Code setzt ein Wegwerf-Feld
   auf dem echten `document` und prueft, ob es beim uebergebenen Objekt ankommt, `:27-32`) —
   ein Proxy faellt durch.
2. `ctx.workerScript.scriptRef.ramUsage === RamCostConstants.Base`, also **exakt 1,6 GB**
   (`:32`, `RamCostGenerator.ts:11`).

Der einfachste Weg braucht gar keinen Trick:
```
run bypass.js --ram-override 1.6
```
weil `runOpts.ramOverride ?? script.getRamUsage(...)` kurzschliesst
(`NetscriptWorker.ts:287`) und `--ram-override` genau bis `Base` heruntergeht
(`Terminal/commands/runScript.ts:47`). Im Skript darf `document` dann woertlich stehen.

Alternativ ohne Override: die RAM-Analyse sucht **nur den exakten Bezeichner** `document`
bzw. `window` (`Script/RamCalculations.ts:185-192`) und sieht String-Literale nie an. Also
kosten `globalThis["document"]`, `globalThis["docu"+"ment"]`, `eval("document")` oder
`(()=>{}).constructor("return document")()` **nichts** — ein Skript mit nur
`ns.bypass(globalThis["document"])` kostet exakt 1,6 GB.

**(d) `TimeCompression`** — `Exploits/loops.ts:15-31`. Ein `setTimeout` alle 15 s prueft
`performance.now() - last < 500`. `performance.now` wird im ganzen Spiel nur an vier Stellen
benutzt: `loops.ts:19,21`, Infiltration (`Infiltration/Infiltration.ts:163,191`,
`Infiltration/model/SlashModel.ts:60`, `Infiltration/ui/GameTimer.tsx:20,34`) und der
Fortschrittsbalken im Terminal (`Terminal/Terminal.ts:177-180`). `utils/Protections.ts:5-9`
friert nur `window.Number`, `window.Object` und `window.String` ein — `performance` nicht.

Also: `performance.now` fuer ~20 s auf eine Konstante setzen, danach zuruecksetzen, waehrend
dieser Zeit keine Infiltration und keinen Terminal-Befehl mit Fortschrittsbalken laufen lassen.
Sehr kurzes Fenster, sehr geringes Risiko.

**(e) `PrototypeTampering`** — `Exploits/loops.ts:4-13`. Alle 15 Minuten wird geprueft, ob
`(55).toExponential() !== "5.5e+1"`. `window.Number` ist zwar nicht ueberschreibbar
(`utils/Protections.ts:6`), `Number.prototype` aber sehr wohl. Minimal-invasiv geht das so:
Original merken, Wrapper setzen, der nur beim Wert 55 und ohne Argumente etwas anderes
zurueckgibt und sonst delegiert. Das Spiel nutzt `toExponential` selbst nur in
`ui/formatNumber.ts:215` (mit Argument) und in der Corporation-Oberflaeche (in BN1 ohne SF3
nicht vorhanden). Da der Timer-Zeitpunkt unbekannt ist, muss der Wrapper mindestens 15 Minuten
stehen bleiben.

**(f) `RealityAlteration`** — `Extra.ts:38-52`. `let x = false`, `recur(2)` kippt `x` zweimal,
danach wird auf `x` geprueft. Ohne Eingriff ist das immer `false`. Erreichbar waere es ueber
einen Debugger-Haltepunkt (CDP `Debugger.setBreakpoint` + `Debugger.evaluateOnCallFrame`), der
`x` auf `true` setzt. **Das ist ein Grenzfall zu "Spielcode patchen"** — der Code selbst wird
nicht veraendert, aber es ist auch kein Mittel, das das Spiel einem Skript gibt. Ich habe es
nicht ausprobiert und wuerde es ohne deine Ansage nicht tun.

## 3.3 Urteil zum Exploit-System

**Das ist der Fund mit dem besten Verhaeltnis von Wirkung zu Aufwand im ganzen Bericht — und ich
hatte ihn in der ersten Fassung als Sammelobjekt abgetan.**

**Nimm (a), (b) und (c) sofort mit: drei Zeilen, fuenf Minuten, rund 12,7 Stunden weniger
Erfahrungsmuehle am aktuellen Betriebspunkt, dauerhaft ueber alle Resets.** (d) und (e) bringen
weitere 8 Stunden fuer 20 Sekunden bzw. 16 Minuten Wartezeit — auch die lohnen sich, sie sind
nur nicht ganz so billig. Der Rest ist nicht erreichbar.

Ein fertiges Skript sieht ungefaehr so aus (ungetestet, hier nur als Skizze):

```js
/** @param {NS} ns */
export async function main(ns) {
  ns.exploit();                        // UndocumentedFunctionCall
  ns.rainbow("noodles");               // INeedARainbow
  ns.bypass(globalThis["document"]);   // Bypass  -- Skript muss exakt 1,6 GB kosten
}
```
Danach **einmal neu laden**, sonst wirkt der Bonus nicht (`reapplyAllSourceFiles`).

Der eigentliche Wert des Abschnitts ist nicht der Bonus, sondern die Nebenerkenntnis: **Das
Spiel weiss, dass Skripte an `document` kommen, und belohnt es.** `ns.bypass` ist der Beweis,
dass der Weg ueber das DOM vom Entwicklerteam vorgesehen und nicht als Betrug gewertet wird.
Das stuetzt A4 (die `__reactProps`-Technik) moralisch wie technisch.

---

# 4. Geprueft und verworfen — damit du es nicht nochmal pruefst

### 4.1 "Der Favor aus IPvGO ueberlebt den Reset und geht bis 100.000 je Faktion"

**Stimmt teilweise, im Kern falsch.**

| Teilbehauptung | Befund | Beleg |
|---|---|---|
| Favor ueberlebt den Install | **richtig**, aber trivialerweise — Faktions-Favor tut das immer | `Faction/Faction.ts:77-85` |
| "bis 100.000 je Faktion" | **falsch als Favor.** 100.000 ist ein **Reputations**budget, das ueber `addRepToFavor` in Favor umgerechnet wird → **ca. 81 Favor** aus dem Nichts | `Go/effects/effect.ts:30-44`, `Go/boardAnalysis/scoring.ts:74-78`, `Faction/formulas/favor.ts:22-24` |
| implizit: nach jedem Install neu farmbar | **falsch.** `stats.rep` wird beim Install bewusst *nicht* zurueckgesetzt — das Budget ist einmalig pro BitNode | `Go/Go.ts:34-47` (Kommentar im Code) |
| "staerkster Reputationshebel im Spiel" | **falsch.** 400 Siege je Faktion fuer einmalig Faktor 1,81 auf die Rep-Rate | `scoring.ts:70-72` |

**Was dabei aber tatsaechlich uebersehen wurde**, ist etwas anderes: die
`nodePower`-Multiplikatoren (A2a). Die sind **nicht** dauerhaft (`Go/Go.ts:43` nullt `nodePower`
beim Install), aber sie sind gross, billig und komplett skriptbar. Der Skeptiker hatte also den
richtigen Riecher am falschen Mechanismus.

### 4.2 Das Dev-Menue ist nicht erreichbar

`Router.toPage(Page.DevMenu)` wird **nirgends** aufgerufen. `grep -rn "Page.DevMenu"` liefert
genau zwei Treffer: den Seitenleisten-Eintrag hinter `process.env.NODE_ENV === "development"`
(`Sidebar/ui/SidebarRoot.tsx:436`) und den `switch`-Zweig, der nichts ausloest
(`ui/GameRoot.tsx:399`). Kein Terminal-Befehl, kein Tastenkuerzel
(`Page.DevMenu` fehlt in `utils/KeyBindingUtils.ts`), kein URL-Parameter
(die URL wird nur an einer Stelle gelesen: `NetscriptWorker.ts` fuer `?noscript`), und `Router`
ist ein Modul-Level-`export let` (`ui/GameRoot.tsx:118`), nicht global.

**Die Falle:** `globalThis.openDevMenu` und `ns.openDevMenu()` existieren, sind aber ein
**Aprilscherz**. Beide landen bei `Apr1Events.emit()` (`engine.tsx:412` →
`Terminal/commands/apr1.ts:3-5`; `NetscriptFunctions/Extra.ts:19`), und der einzige Abonnent
oeffnet ein Modal mit ASCII-Animation (`ui/Apr1.tsx:56-70`). **Kein Dev-Menue, kein Exploit.**

Ungeprueft geblieben: ob im Produktionsbuild ein `webpackChunk…`-Array im `globalThis` liegt,
ueber das man `__webpack_require__` und damit jedes Modul bekaeme. `webpack.config.js:129-133`
setzt weder `output.library` noch `globalObject`; ob Webpack 5 dennoch ein
Chunk-Lade-Array emittiert, haengt am Bundle und ist **nur am laufenden Spiel messbar**.
Wenn es existiert, waere praktisch alles offen — inklusive 4.4.

### 4.3 Der Unclickable-Exploit ist fuer uns nicht erreichbar

`Exploits/Unclickable.tsx:11` verlangt gleichzeitig `display === "none"`, `visibility === "hidden"`
**und** `event.isTrusted`. Ein echter Mausklick kann ein `display:none`-Element nicht treffen
(es ist nicht im Layoutbaum), und die `__reactProps`-Technik hilft nicht, weil der Handler
`getComputedStyle(event.target)` auswertet — man muesste also ein Attrappen-Ereignis mit einem
`target` bauen, das genau dieses Element ist, und dann waere `isTrusted` selbst gefaelscht.
Das geht, aber nur mit derselben `{isTrusted:true}`-Attrappe wie in A4 — und dann ist der
"Exploit" ein Selbstgespraech. Ausserdem wird `getComputedStyle` beim Modul-Laden in eine
Konstante kopiert (`Unclickable.tsx:5`), lange bevor wir etwas ueberschreiben koennten.

### 4.4 Spenden **ohne** Favor 150: die Sperre liegt nur in der Oberflaeche — aber wir kommen nicht dran

**Der Befund stimmt:** `donate()` prueft ausschliesslich `amt > 0 && Player.money >= amt` —
**kein Favor-Check, keine Mitgliedschaftspruefung** (`Faction/formulas/donation.ts:20-35`).
Die 150-Favor-Schwelle existiert allein in `Faction/ui/FactionRoot.tsx:103-104`
(`canDonate = faction.favor >= favorToDonate`), von dort als `disabled` an `DonateOption`
gereicht (`:143`).

**Trotzdem nicht ausnutzbar:** `DonateOption` rendert im `disabled`-Fall gar kein Eingabefeld
und keinen Knopf, sondern nur einen Hinweistext (`Faction/ui/DonateOption.tsx:60-64`). Es gibt
also keinen DOM-Knoten mit einem `__reactProps$.onClick`, den man aufrufen koennte, und
`donate` ist ein Modul-Export ohne globale Bindung. **Ohne Modulzugriff (siehe 4.2) ist das
zu.** Ich notiere es, damit die Stelle bekannt ist, falls sich der Webpack-Weg als offen
herausstellt.

**Wichtig: das ist NICHT dasselbe wie A0.** Hier geht es um die Frage, ob man die 150-Favor-
Schranke *umgehen* kann — Antwort: nein. **A0** beschreibt, was der Weg wert ist, wenn man ihn
regulaer geht, und dort ist der Knopf offen (`Faction/ui/DonateOption.tsx:31-42`, `onDonate()`
nimmt gar kein Ereignis entgegen). Der lohnende Weg ist A0, nicht dieser hier.

### 4.5 Favor auf mehrere Installs aufteilen bringt nichts

`addRepToFavor(favor, rep) = repToFavor(favorToRep(favor) + rep)` ist **pfadunabhaengig** —
die Rep wird auf der Rep-Skala addiert, bevor umgerechnet wird
(`Faction/formulas/favor.ts:22-24`). Zwei Installs mit je 1 Mio. Rep geben exakt dasselbe wie
einer mit 2 Mio. Die Formel nutzt bewusst `expm1`/`log1p` und eine handgesetzte
`log(1.02)`-Konstante (`:9-10`); Favor wird **nicht gerundet** (`Faction/Faction.ts` `setFavor`
clampt nur). Kein Rundungsfehler, kein Drift, kein Trick.

### 4.6 Contract-Farming durch Neuladen bringt nichts

Online: 3 Versuche alle 10 Minuten (`engine.tsx:210-213`).
Offline: `(timeOffline * 3) / 600000` Versuche (`engine.tsx:267`) — **exakt dieselbe Rate.**
Die Engine-Zaehler werden beim Laden nicht zusaetzlich heruntergezaehlt, es gibt also kein
Doppelzaehlen.

### 4.7 Speichern/Laden bringt keine Zeit

`saveGame` setzt nur `Player.lastSave`; die fuer den Offline-Fortschritt massgebliche
`Player.lastUpdate` wird bei **jedem** Tick fortgeschrieben (`engine.tsx:429`). Ein Reload gibt
hoechstens die Zeit seit dem letzten Autosave als Offlinezeit zurueck — und die verliert man
gleichzeitig an echtem Online-Fortschritt. Da Offline mit 0,75 x **Durchschnittsrate** zahlt
(`engine.tsx:271`, `Constants.ts` `OfflineHackingIncome: 0.75`) und Online mit voller
**aktueller** Rate, ist das bei wachsendem Einkommen ein Verlustgeschaeft.

Die Systemuhr vorzustellen wuerde funktionieren (`timeOffline` hat keine Obergrenze,
`engine.tsx:259-265`, und `Player.lastUpdate` wird beim Laden nicht validiert), ebenso ein
kurzzeitig verbogenes `Date.prototype.getTime` (`engine.tsx:414` liest `new Date().getTime()`,
`Date` ist von `utils/Protections.ts` nicht geschuetzt). **Beides ist unzweifelhaft Cheaten am
Spiel selbst und nicht "mit den Mitteln spielen, die das Spiel einem Skript gibt".** Ich fuehre
es nur auf, damit es geprueft und abgehakt ist.

### 4.8 Am Aktienmarkt gibt es keinen risikolosen Gewinn

Drei Wege geprueft, alle drei zu:
1. **Kursvorwissen:** Der naechste Kurs haengt an `Math.random()` (`StockMarket/StockMarket.ts:288`),
   nicht an einem seedbaren PRNG. 4S liefert die **Wahrscheinlichkeit**, nicht das Ergebnis
   (`NetscriptFunctions/StockMarket.ts:244-246` gegen `StockMarket.ts:274-305`).
2. **hack/grow-Einfluss:** existiert, ist aber schwach und gedaempft — er aendert nur den
   Forecast **zweiter Ordnung** um ±0,1, und nur mit Wahrscheinlichkeit
   `gestohlenesGeld / server.moneyMax` (`StockMarket/PlayerInfluencing.ts:173-210`,
   `StockMarket/Stock.ts:235-239`).
3. **Kauf und Verkauf im selben Tick:** garantierter Verlust von
   `2 x Spread x Positionswert + 200.000 $` Kommission
   (`StockMarket/StockMarketHelpers.ts:46, 71`, `StockMarket/Stock.ts:225-232`,
   `StockMarket/data/Constants.ts:3-12`). Eigene Transaktionen schieben den Forecast ausserdem
   immer Richtung 50, also **gegen** die eigene Position (`Stock.ts:246-265`).

Shorts (SF8.2) und Limit-/Stop-Orders (SF8.3) sind in BN1 ohnehin gesperrt
(`NetscriptFunctions/StockMarket.ts:46-53`). Was bleibt: Long-Handel mit 4S-Forecast als
**positiver Erwartungswert**, nicht als sicherer Gewinn — Einstiegskosten 200e6 + 5e9 + 25e9 =
**30,2 Mrd. $**.

### 4.9 Hacknet lohnt sich in BN1 nicht

Der beste Ausbaupunkt (Level 200 + RAM 64, Cores auslassen) kostet ~36 Mio. $ je Node fuer
~2.620 $/s = 9,4 Mio./h. Das ist **ein Drittel eines einzigen Coding Contracts pro Stunde** bei
36 Mio. Kapitalbindung, die beim naechsten Install ersatzlos verfaellt (V19). Cores sind mit
~372 Mio. fuer Faktor 2,5 der schlechteste Kauf im Spiel.
Formeln: `Hacknet/formulas/HacknetNodes.ts:4-92`, Konstanten `Hacknet/data/Constants.ts:1-17`.
Hacknet **Server** (Hashes) brauchen BN9 oder SF9 und existieren in BN1 nicht.

### 4.10 Infiltration lohnt sich fuer den Bot nicht

Nicht skriptbar (V4), und der einzige mit Startstats betretbare Ort (New Tokyo Noodle Bar,
`startingSecurityLevel 2,5`, 5 Level) bringt nach `Infiltration/formulas/victory.ts:65-83`
grob **1,5 Mio. $** pro Runde von Hand — gegen 25 Mio. fuer einen Contract. Dazu ein
Marktsaettigungs-Faktor mit ~35 s Halbwertszeit, der Dauer-Infiltration ausdruecklich bestraft
(`Infiltration/formulas/game.ts:18-34`). Der Wert liegt allein bei den Fraktions-Rep und den
neun Daedalus-Punkten (A6) — und nur, wenn Eric selbst spielt.

### 4.11 `ns.hack` setzt kein Backdoor-Flag

`Netscript/NetscriptHelpers.tsx:617-621` setzt `backdoorInstalled = true`, wenn der Parameter
`manual` gesetzt ist — aber der **einzige** Aufrufer ist `NetscriptFunctions.ts:197` mit
`manual = false`. Toter Zweig. Nur der Terminal-Befehl `hack` setzt das Flag
(`Terminal/Terminal.ts:272`).

### 4.12 Terminal-`hack` ist keine Abkuerzung um die Level-Anforderung

`Terminal/commands/hack.ts:11-15` prueft `requiredHackingSkill > Player.skills.hacking` genauso
wie `Terminal/commands/backdoor.ts:27-32`. Und `calculateHackingChance` klemmt unterhalb der
Anforderung ohnehin auf 0 (`Hacking.ts:9-24`). Kein Weg, `CSEC` unter Level 55 zu knacken.

### 4.13 Singularity ist ohne SF4 wirklich zu

`Netscript/NetscriptHelpers.tsx` `checkSingularityAccess` haengt an
`canAccessBitNodeFeature(4)`, also `Player.bitNodeN === 4 || activeSourceFileLvl(4) > 0`
(`BitNode/BitNodeUtils.ts:17-19`). In den Singularity-Funktionen gibt es genau **eine** ohne
Pruefung: `getOwnedSourceFiles` — sie liefert in BN1 ein leeres Array und kostet trotzdem 80 GB
(5 x 16, `RamCostGenerator.ts` `SF4Cost`). Wertlos.
**Wichtig fuer den Bot:** der Wrapper zieht **erst das RAM ab und prueft dann**
(`Netscript/APIWrapper.ts:77-81`) — ein Singularity-Aufruf kostet also auch dann RAM, wenn er
sofort wirft. *(Diese drei Punkte stammen aus dem 3.0.2-Baum; die Pruefstelle und
`BitNodeUtils.ts` habe ich in v301 gegengelesen, die Funktionsliste nicht.)*

---

# 5. Was noch offen ist — am laufenden Spiel zu messen

Nach Wichtigkeit:

1. **Haelt der Reload-Focus?** (A9) Nach einem Reload mit laufender Fraktionsarbeit die
   tatsaechliche Rep-Rate gegen `5 * hacking/975 * faction_rep * (1+favor/100)` halten. Faktor
   1,0 statt 0,8 waere der Beweis. **Fuenf Minuten Messung fuer +25 % auf jedem Klickpfad** —
   die lohnendste offene Frage.
2. **Wie schnell laesst sich Daedalus / The Black Hand im Go schlagen?** (A2) Davon haengt
   ab, ob der Weg zu Favor 150 ueber Go abgekuerzt werden kann oder nicht. Eine Messreihe ueber
   20 Partien mit einer simplen Heuristik klaert es (`ns.go.analysis.getStats()`, 0 GB).
   Solange das offen ist, ist A2 nicht planbar.
3. **Traegt die `__reactProps`-Technik auch an den uebrigen Klicksperren?** (A4) Testknopf:
   Krankenhaus "Get treatment" — bei vollen HP kostenlos (`Hospital/Hospital.ts:4-10` gibt dann
   0 zurueck), sofort sichtbar. Fuer Join ist es laut `doku/auffaellige-werte.md` Punkt 4 bereits
   in der Praxis belegt.
4. **Erzeugt euer CDP-Klickpfad `isTrusted === true`?** Wenn ja, ist das Thema ganz erledigt.
   *(Browser-/CDP-Verhalten, steht nirgends im Spielcode — nur messbar.)*
5. **Liegt ein `webpackChunk…`-Array im `globalThis` des Produktionsbaus?** (4.2, 4.4) Eine
   Zeile in der Konsole: `Object.keys(globalThis).filter(k=>k.startsWith("webpack"))`. Falls ja,
   ist auch 4.4 offen.
6. ~~Was kosten unsere Skripte an Namenskollisionen?~~ **Erledigt** — null Treffer in `src/`
   (siehe V6).

---

## Anhang A: Was die Skeptiker-Runde gekippt hat

Zwei Pruefer haben den Bericht angegriffen — einer die Belege und Zahlen, einer die Rangfolge.
Was standgehalten hat, steht oben eingearbeitet. Was gefallen ist, hier vollstaendig, damit
nichts stillschweigend verschwindet:

**Gekippt — Behauptung faellt:**
1. **A2, "5x5 gegen Netburners ist strikt optimal fuers Favor-Farmen".** Falsch. Der Favor geht
   an die Faktion des **bespielten Gegners** (`Go/boardAnalysis/scoring.ts:67`). Netburners-Favor
   hat keinen Abnehmer.
2. **V13, "wer auf viele Portnummern schreibt, leckt Speicher".** Falsch. `NetscriptPort.ts:75`
   entfernt leergelesene Ports sofort aus der Map.
3. **V6, "der Bot heisst intern vermutlich irgendwo `getTask`, `attempt` oder `share`".**
   Widerlegt: null Treffer in `src/`.
4. **A1, "in BN1 entstehen nur FUENF Contract-Typen"** als Absolutaussage. Der DarkNet-Pfad
   (`DarkNet/effects/cacheFiles.ts:85`) erzeugt alle 30.
5. **A1 als "staerkster Einzelbefund".** Der Loeser ist seit dem 20.08.2026 11:48 gebaut
   (`src/contracts.js`), und Geld ist der schwaechste Engpass.
6. **A4 "keine einzige der 14 Stellen liest ein anderes Feld".** Zwei tun es
   (`InfiltrationRoot.tsx:74`, `BBCabinet.tsx:17`).

**Gekippt — Zahl deutlich daneben:**
7. **A2 CalculateEffect:** +31 % / +58 % waren geschaetzt, richtig sind **+24,1 % / +80,1 %**.
   Nur der mittlere Wert (+42,5 %) stimmte.
8. **A2 RAM:** 13,6 GB → **17,6 GB** (`getBoardState` vergessen).
9. **A3, "10.800 Rep/h bei sechs Fraktionen":** es sind **9.000** (die Arbeitsfraktion faellt
   heraus), und der Wert setzt Favor 90 voraus = 123.578 Rep je Fraktion = rund 42 h
   Vorleistung. Heute sind es **190 Rep/h**.
10. **V4, "bis zu 10 % des Gesamtvermoegens":** in der relevanten Vermoegensphase sind es
    **1-2 Mio. $** (`hp.max = floor(10 + defense/10)`).
11. **A2 Siegesserien-Deckel 3,0:** stimmt nur im Normalfall, beim Brechen einer Pechserie
    bis **5,0**.

**Gekippt — Rangfolge:**
12. Die urspruengliche Reihenfolge sortierte nach absoluter Effektgroesse und setzte damit einen
    **Geld**fund an die Spitze, obwohl `doku/strategie.md:16-40` Geld ausdruecklich als
    schwaechsten Engpass fuehrt und der Bot 164,8 Mio. $/s macht. Die Tabelle in Abschnitt 2
    ist die Korrektur.
13. **Der Exploit-Abschnitt war zu niedrig bewertet.** "0,1 % je Exploit" ist der falsche
    Massstab, weil `mults.hacking` im Nenner eines Exponenten steht. Drei Exploits sparen am
    aktuellen Betriebspunkt **12,7 Stunden** Erfahrungsmuehle.
14. **Der Spendenweg fehlte ganz** (jetzt A0). Faktor 36,7 gegenueber Faktionsarbeit.

**Verschwiegene Bedingungen, jetzt ergaenzt:** Fraktions-Mitgliedschaft ueberlebt den Install
nicht (A3); Go-Favor gibt es nur bei Gegnern, deren Faktion man braucht (A2).

**Nicht gekippt** (unabhaengig bestaetigt): das bcrypt-Passwort `noodles`, der
Doppel-Divisions-Fehler bei den Contract-Belohnungen, alle Zahlen in A1, der 150-Rep/h-Mindestwert
in A3, die +25 % in A9, das exakte Teleskopieren der Server-Upgrades, saemtliche Zeilenangaben in
V6, V15, V16, A4, A5, A6, 4.4, 4.5, 4.11 und 4.12, und die `--ram-override 1.6`-Route fuer
`ns.bypass`.

---

## Anhang B: was ich NICHT getan habe

- Kein Code geaendert, nichts committet, kein Spielstand angefasst.
- Das laufende Spiel nicht angefasst — alles aus dem Quelltext hergeleitet.
- Die `bcryptjs`-Suche fuer `ns.rainbow` lief in einem Temp-Verzeichnis ausserhalb des Projekts.
