# Pruefbericht Bitburner-Autopilot

**Stand:** 19.08.2026
**Geprueft gegen:** `reference\v301` (Tag v3.0.1, `src/Constants.ts` VersionString "3.0.1").
Der dev-Branch unter `reference\bitburner-src` wurde bewusst nicht als Massstab benutzt.

**Geprueft wurde:** `src/lib/calc.js`, `src/autopilot.js`, `src/invest.js`, `src/worker/*.js`,
`src/telemetry.js`, `src/scan.js`, `sync/bridge.js` sowie die Dokumente in `doku/`.

**Am Code wurde nichts geaendert.** Der Bot laeuft live.

---

## Befundtabelle

Sortiert nach Schwere. Die Nummer ist eine feste Kennung und verweist auf den gleichnamigen
Abschnitt weiter unten - sie ist keine Rangfolge.

| # | Schwere | Datei : Zeile | Befund | Sicherheit |
|---|---|---|---|---|
| 1 | KRITISCH | `autopilot.js:223-257`, `506-527` | Jede Sekunde wird eine volle neue Welle losgeschickt, ohne zu wissen, was noch fliegt. Ueberernte, Ueberweaken, Ziele werden leergeraeumt. | sehr sicher |
| 2 | KRITISCH | `autopilot.js:249-251`, `234-237` | Die ausgleichenden weaken-Threads werden NACH hack/grow verteilt und verhungern systematisch, weil hack/grow den Speicher vorher aufbrauchen. | sehr sicher |
| 3 | KRITISCH | `invest.js:32`, `85` | `ns.read("invest.js")` liest vom AUSFUEHRENDEN Rechner, nicht von home. invest.js kann eine neue Fassung darum nie erkennen. Die Selbstaktualisierung des Verwalters ist tot. | sehr sicher |
| 4 | KRITISCH | `autopilot.js:120-122` | Arbeiter werden nur kopiert, wenn `worker/weaken.js` auf dem Ziel FEHLT. Geaenderter Arbeitercode erreicht die Flotte nie. | sehr sicher |
| 8 | KRITISCH | `calc.js:270-276`, `autopilot.js:189` | `expectedYield` ist bis rund 1 TB Netzspeicher fuer alle Ziele ausser n00dles exakt 0. Die Zielauswahl faellt damit auf die Scan-Reihenfolge zurueck - nachgemessen. | sehr sicher (nachgerechnet) |
| 5 | WICHTIG | `autopilot.js:25` | Der Aufraeum-Loop ist wirkungslos (`ns.ui.closeTail` greift bei toten Skripten nicht) und laeuft `ns.pid`-mal - nach Stunden Laufzeit sind das Hunderttausende NS-Aufrufe beim Start. | sehr sicher |
| 6 | WICHTIG | `autopilot.js:486` | `tryCrack` verlangt zusaetzlich das Hacking-Level. `ns.nuke` verlangt das NICHT. Rechner mit Speicher bleiben unnoetig lange ungenutzt. | sehr sicher |
| 7 | WICHTIG | `autopilot.js:313`, `telemetry.js:70` | `getTotalScriptIncome()[0]` misst nur LAUFENDE Skripte. Unsere Ein-Weg-Arbeiter buchen ihr Geld in der letzten Millisekunde ihres Lebens. Die Anzeige steht strukturell nahe null. Dasselbe gilt fuer `getTotalScriptExpGain()`. | sehr sicher |
| 9 | WICHTIG | `calc.js:239`, `254` | `prepSeconds` rechnet je Ziel mit dem GESAMTEN Netzspeicher, obwohl bis zu 8 Ziele parallel bedient werden. Vorbereitungszeit bis zu 8x zu optimistisch. | sicher |
| 10 | WICHTIG | `autopilot.js:281-299`, `137-142` | Zweimal `ns.ps()` ueber jeden Rechner pro Sekunde. Bei tausenden Arbeitern ist das eine spuerbare Dauerlast fuer das Spiel. | sicher |
| 11 | WICHTIG | `autopilot.js:70-340` | Keine Fehlerbehandlung um die Hauptschleife. Ein einziger werfender Host (Hacknet-Server, verschwundener Rechner) toetet den Autopiloten; invest.js startet ihn alle 5 s neu - Dauerschleife. | sicher (Ausloeser BitNode-abhaengig) |
| 12 | WICHTIG | `autopilot.js:209-215` | Abgewaehlte Ziele werden nie gestoppt. Faellt ein Ziel aus den Top 8, laufen seine hack-Threads weiter, waehrend niemand mehr nachwaechst. | sicher |
| 13 | WICHTIG | `autopilot.js:33-34`, `107` | `HOME_RESERVE` wird zusaetzlich zum bereits belegten Speicher abgezogen - der Autopilot ist damit doppelt eingerechnet. Wirkt sich aus, sobald home aufgeruestet wird. | sehr sicher |
| 14 | WICHTIG | `invest.js:97-107` | Der Kommentar rechnet $74.166 in "rund 13 hack-Threads" um. Richtig sind rund 0,8 Threads. Faktor ~17 daneben; die Begruendung der Hacknet-Regel steht auf einer falschen Zahl. | sehr sicher |
| 15 | KLEINIGKEIT | `calc.js:169-176` | Die Rundungskorrektur in `growThreads` weicht vom Original ab (Original prueft den Abwaertsschritt nur im Grenzfall). Abweichung hoechstens 1 Thread. | sicher |
| 16 | KLEINIGKEIT | `calc.js:185-188` | `weakenThreads` kennt `currentNodeMults.ServerWeakenRate` nicht (in BN1 = 1) und wird ueberall mit `cores = 1` aufgerufen, obwohl viele Rechner mehr Kerne haben. | sehr sicher |
| 17 | KLEINIGKEIT | `autopilot.js:487-492` | `tryCrack` wertet den Rueckgabewert von `ns.nuke` nicht aus. `ns.nuke` wirft nicht, es gibt `false` zurueck. | sehr sicher |
| 18 | KLEINIGKEIT | `worker/hack.js:9-11`, `autopilot.js:519` | Der Kommentar verspricht exakte Landezeitpunkte ueber `additionalMsec`. `deploy` uebergibt immer 0. Es gibt kein Timing. | sehr sicher |
| 19 | KLEINIGKEIT | `telemetry.js:17`, `43` | `telemetry.js` ist verwaist: schreibt in dieselbe Datei wie `writeBrain` und liest `data/brain.txt`, das niemand schreibt. | sehr sicher |
| 20 | KLEINIGKEIT | `autopilot.js:276` | "Verdient" ist der Kontostand-Delta und enthaelt die Ausgaben von invest.js. Nach einem Serverkauf steht dort ein Minus. | sehr sicher |
| 21 | KLEINIGKEIT | `autopilot.js:554-566` | `writeBrain` verdrahtet `threads: 0` und `backdoored: 0` fest; `action` bekommt nur das eine `target`. | sehr sicher |
| 22 | KLEINIGKEIT | `invest.js:131` | Der Hacknet-Zugewinn laesst `mults.hacknet_node_money` und den BitNode-Multiplikator weg. | sehr sicher |
| 23 | KLEINIGKEIT | `calc.js:105-108` | `expPerThread` ist toter Code; `playerFacts` liefert gar kein `multExp`. | sehr sicher |
| 24 | KLEINIGKEIT | `bridge.js:185-214` | Aenderungen an mehreren Dateien werden einzeln mit 150 ms Entprellung geschoben. Der Autopilot kann sich neu starten, bevor die uebrigen Dateien angekommen sind. | mittel |
| 25 | KLEINIGKEIT | `bridge.js:354`, `343` | RFA-Server und Dashboard binden auf allen Netzwerkschnittstellen; `/api/rpc` erlaubt beliebige RFA-Methoden von aussen. | sicher |

---

## 1. KRITISCH - Keine Buchhaltung ueber laufende Auftraege

`autopilot.js:223-257` schickt in JEDER Runde (`await ns.sleep(1000)`, Zeile 339) eine
vollstaendige Welle los. `deploy()` (Zeile 506) fragt nur den freien Speicher ab, nie was
bereits fliegt. Der `busy`-Zaehler (Zeile 281-299) wird erst NACH dem Verteilen gebildet und
dient ausschliesslich der Anzeige.

**Warum das falsch ist.** Die Laufzeiten stehen fest: `hack` dauert `hackTime`, `grow`
`3.2 * hackTime`, `weaken` `4 * hackTime` (`src/Hacking.ts:60`, `:84`, `:91`). Ein Auftrag
wirkt also erst Sekunden bis Minuten spaeter. Bis dahin sieht der Autopilot unveraenderte
Werte und schickt dieselbe Welle noch einmal - so oft, wie Speicher da ist.

**Auswirkung im Spiel, drei Formen:**

*Ueberernte.* Zeile 248 bemisst `wanted = floor(0.5 / perThread)`, also genau eine halbe
Abschoepfung. Dauert `hackTime` zum Beispiel 10 Sekunden und reicht der Speicher, werden
10 solche Wellen gestartet, bevor die erste landet. Abgeschoepft wird dann nicht die
Haelfte, sondern `1 - 0.5^10 = 99,9 %`. Der Server ist leer. Das ist exakt der Zustand, den
der Kommentar in Zeile 42-45 ausdruecklich vermeiden will. Je mehr Speicher der Bot besitzt,
desto schlimmer wird es - das Problem waechst mit dem Erfolg.

*Ueberweaken.* Zeile 227 bemisst `weakenThreads(t.sec - t.secMin)`, also die volle Korrektur.
Die weaken-Welle braucht `4 * hackTime`. In der Zwischenzeit werden bis zu 4*hackTime weitere
volle Korrekturen gestartet. `Server.capDifficulty()` (`src/Server/Server.ts:91`) deckelt bei
`minDifficulty`, es entsteht also kein Schaden - aber praktisch der gesamte Speicher wird in
sinnlose weaken-Threads gesteckt, waehrend die anderen sieben Ziele leer ausgehen.

*Ueberwachsen.* Zeile 233 bemisst jedes Mal die Threads bis `moneyMax`. Grow-Ueberschuss ist
immerhin gratis: `processSingleServerGrowth` (`src/Server/ServerHelpers.ts:202-212`) erhoeht
die Security nur, wenn sich das Guthaben tatsaechlich geaendert hat, und deckelt die
gezaehlten Zyklen auf `numCycleForGrowthCorrected`. Es bleibt aber Speicherverschwendung.

**Wie es richtig waere.** Entweder ein Ledger der offenen Auftraege je Ziel (Startzeit +
Landezeit + Threads, aus `ns.ps` rekonstruierbar) und nur die Differenz nachbestellen; oder
echtes Batching mit `additionalMsec`, das ohnehin schon in den Arbeitern vorgesehen ist
(HWGW), mit einer Sperre je Ziel bis zum Landen des letzten Auftrags.

**Sicherheit:** sehr sicher. Der Ablauf ist im Code eindeutig, die Laufzeiten sind belegt.

---

## 2. KRITISCH - Der ausgleichende weaken verhungert systematisch

```js
const hStarted = deploy(ns, workforce, "worker/hack.js", wanted, t.host);      // 249
const wNeed = calc.weakenThreads(hStarted * calc.SERVER_FORTIFY_AMOUNT);       // 250
const wStarted = deploy(ns, workforce, "worker/weaken.js", wNeed, t.host);     // 251
```

Dasselbe Muster in der grow-Zweig (Zeile 234-237).

**Warum das falsch ist.** `deploy` verteilt so viel, wie hineinpasst, und zieht den Speicher
sofort von `s.ramFree` ab (Zeile 520). Der zweite `deploy`-Aufruf bekommt nur, was der erste
uebrig gelassen hat.

Fair betrachtet: solange der freie Speicher deutlich groesser ist als die angeforderte Welle,
geht es gut - `wanted` liegt bei einem gut praeparierten Ziel bei rund `0.5 / (1/240) = 120`
hack-Threads (204 GB), der Ausgleich braucht davon nur `ceil(120/25) = 5` Threads (8,75 GB).
Der Fehler beisst in zwei Lagen, und beide sind der Normalfall:

1. **Wenn die angeforderte Welle allein schon den Speicher fuellt.** Im grow-Zweig ist genau
   das die Regel: `growThreads` bemisst die Threads bis `moneyMax`, und bei einem halb
   geleerten grossen Ziel sind das tausende. Dann ist `gStarted` = alles, was da war, und
   `wNeed` bekommt nichts.
2. **Ab der zweiten Runde immer** - wegen Befund 1. Die erste Runde fuellt den Speicher mit
   hack- oder grow-Threads; ab der zweiten Sekunde ist nichts mehr frei, und der jeweils
   zuletzt angeforderte Ausgleich geht leer aus.

**Auswirkung.** Die Security des Ziels steigt bei hack um `0.002 * threads`
(`server.fortify(ServerConstants.ServerFortifyAmount * Math.min(threads, maxThreadNeeded))`,
`src/Netscript/NetscriptHelpers.tsx`, hack-Erfolgszweig), bei grow um
`2 * 0.002 * usedCycles` (`src/Server/ServerHelpers.ts:211`). Bei einer grow-Welle mit ein paar
tausend wirksamen Threads sind das zweistellige Security-Spruenge auf einen Schlag, mehrfach
hintereinander, ohne Gegenwehr - bis `capDifficulty()` (`src/Server/Server.ts:91-107`) bei 100
deckelt. Bei Security 100 sind `hackPercent` und `hackChance` per Definition exakt 0
(`src/Hacking.ts:13`, `:46`).

Das Ziel ist dadurch nicht dauerhaft verloren: `targetScore` bewertet bewusst im praeparierten
Zustand (`sec: s.secMin`, `calc.js:205`) und bleibt darum positiv, das Ziel faellt also nicht
aus `active` heraus und wird in der naechsten Runde beruhigt. Aber der Bot verbringt einen
grossen Teil seiner Zeit damit, selbstverursachte Security wieder abzubauen, statt zu ernten.

Nebenwirkung auf die Bewertung: `prepSeconds` rechnet mit der AKTUELLEN Security
(`calc.js:233`, `:237`), das Ziel rutscht also gleichzeitig in `expectedYield` nach hinten -
und damit unter Umstaenden aus den ersten acht heraus, wo es dann laut Befund 12 auch nicht
mehr aufgeraeumt wird.

**Wie es richtig waere.** Den Bedarf VOR dem Verteilen komplett ausrechnen (`wanted` und
`ceil(wanted/25)` fuer hack, `gNeed` und `ceil(gNeed/12.5)` fuer grow), dann den verfuegbaren
Speicher im richtigen Verhaeltnis aufteilen, oder `wanted` von vornherein um den
weaken-Anteil kuerzen.

**Die Faktoren selbst stimmen.** `SERVER_FORTIFY_AMOUNT = 0.002` und `SERVER_WEAKEN_AMOUNT
= 0.05` decken sich mit `src/Server/data/Constants.ts:9-10`. hack erhoeht um `0.002 * threads`,
grow um `2 * 0.002 * threads` (`src/Server/ServerHelpers.ts:211`, `src/NetscriptFunctions.ts:340`).
Ein weaken je 25 hack-Threads und ein weaken je 12,5 grow-Threads sind damit korrekt.
Der Ausgleich ist sogar leicht zu grosszuegig, weil hack die Security bei einem Fehlversuch
gar nicht erhoeht - `server.fortify` steht nur im Erfolgszweig.

**Sicherheit:** sehr sicher.

---

## 3. KRITISCH - invest.js kann seine eigene neue Fassung nie sehen

```js
const ownSource = ns.read("invest.js");            // invest.js:32
...
if (ns.read("invest.js") !== ownSource) { ... }    // invest.js:85
```

`ns.read` liest vom Rechner, auf dem das Skript LAEUFT:
`const server = ctx.workerScript.getServer(); return server.getContentFile(path)?.content ?? "";`
(`src/NetscriptFunctions.ts:1120-1139`).

invest.js laeuft absichtlich nicht auf home (Zeile 5-7), sondern auf einem fremden Rechner.
Dorthin gelangt die Datei nur durch `ns.scp` in `autopilot.js:164` - und das passiert
ausschliesslich dann, wenn invest.js gerade NICHT laeuft (Zeile 143). Die Bruecke schiebt
neue Fassungen nach home (`bridge.js:161`, `server: "home"`), nie auf den Arbeitsrechner.

**Auswirkung.** Der Vergleich in Zeile 85 vergleicht die lokale Kopie mit sich selbst und ist
immer gleich. Eine neue Fassung von invest.js wird nie uebernommen, solange der alte Prozess
laeuft - und der laeuft, bis ihn jemand von Hand abschiesst. Der Kommentar in Zeile 28-31
("trifft eine neue Fassung ein, macht dieser Prozess Platz") beschreibt etwas, das nicht
stattfindet.

**Wie es richtig waere.** Entweder invest.js liest den Vergleichstext ueber eine Textdatei,
die der Autopilot von home aus nachschiebt, oder der Autopilot vergleicht selbst
`ns.read("invest.js")` (auf home) mit einer Pruefsumme, die invest.js beim Start ablegt, und
beendet den Verwalter bei Abweichung per `ns.kill`.

**Sicherheit:** sehr sicher. Semantik von `ns.read` im Quellcode nachgelesen.

---

## 4. KRITISCH - Arbeiter werden nie aktualisiert

```js
if (s.host !== "home" && !ns.fileExists("worker/weaken.js", s.host)) {
  ns.scp(WORKERS, s.host, "home");
}
```
(`autopilot.js:120-122`)

Kopiert wird nur, wenn `worker/weaken.js` FEHLT. Ist die Datei einmal da, bleibt die alte
Fassung auf dem Rechner - fuer immer.

**Auswirkung.** Zwei Ebenen.

Erstens: Aenderungen an `worker/hack.js`, `worker/grow.js`, `worker/weaken.js` erreichen die
Flotte nicht. Nur home bekommt die neue Fassung von der Bruecke, und dort laufen keine
Arbeiter (siehe Befund 13). Man aendert also den Arbeitercode und misst danach unveraendertes
Verhalten - ein Fehlersuchfallenstrick erster Guete.

Zweitens, schlimmer: `deploy` rechnet die Speicherkosten aus der Kopie auf HOME aus
(`ns.getScriptRam(script, "home")`, Zeile 508), startet den Prozess aber auf `s.host`. Weichen
die Fassungen ab, weicht auch der Speicherbedarf ab. Wird der neue Arbeiter teurer, schlagen
`ns.exec`-Aufrufe fehl, ohne dass die Anzeige es erklaeren kann; wird er billiger, bleibt
Speicher liegen.

Dritter Punkt, gleiches Muster: `lib/calc.js`. Der laufende Autopilot hat das Modul beim Start
importiert. `script.content = code` (`src/Server/BaseServer.ts:260`) verwirft nur den
zwischengespeicherten Modulbau fuer den NAECHSTEN Start. Eine geaenderte Formel wirkt also
erst, wenn der Autopilot aus einem anderen Grund neu startet - und der einzige Ausloeser dafuer
ist eine Aenderung an `autopilot.js` selbst (Zeile 332). **Von fuenf Dateien im Spiel
aktualisiert sich also genau eine selbst.**

**Wie es richtig waere.** Beim Verteilen immer `ns.scp` aufrufen (das ist billig und
idempotent), oder eine Versionsnummer in einer Textdatei je Rechner ablegen und vergleichen.
Fuer `lib/calc.js`: den Selbsttest in Zeile 332 auf alle importierten Module ausdehnen.

**Sicherheit:** sehr sicher.

---

## 5. WICHTIG - Der Aufraeum-Loop beim Start ist wirkungslos und teuer

```js
for (let pid = 1; pid < ns.pid; pid++) ns.ui.closeTail(pid);   // autopilot.js:25
```

`ns.ui.closeTail` schlaegt den Prozess erst nach:
```ts
const runningScriptObj = helpers.getRunningScript(ctx, pid);
if (runningScriptObj == null) { helpers.log(...); return; }
LogBoxCloserEvents.emit(pid);
```
(`src/NetscriptFunctions/UserInterface.ts:69-80`). `getRunningScript` schaut in
`workerScripts` nach (`src/Script/ScriptHelpers.ts:105-109`), und dort stehen nur LEBENDE
Skripte. Fuer ein beendetes Skript passiert also nichts.

**Das steht sogar in der eigenen Dokumentation:** `doku/api-aenderungen-v3.md:58` -
"`ns.ui.closeTail(pid)` wirkt **nicht** auf bereits beendete Skripte." Der Kommentar in
`autopilot.js:22-24` behauptet das Gegenteil und begruendet damit die Schleife.

**Zweite Wirkung: Kosten.** `pidCounter` in `src/Netscript/Pid.ts:3` laeuft ueber die ganze
Sitzung monoton hoch. Der Bot startet pro Sekunde etliche Arbeiter; nach ein paar Stunden ist
`ns.pid` sechsstellig. Die Schleife macht dann Hunderttausende NS-Aufrufe am Stueck, ohne
`await` - der Spielhauptthread steht so lange. Bei einer Neustartschleife (Befund 11)
multipliziert sich das.

**Wie es richtig waere.** Ersatzlos streichen. Wer die toten Fenster wirklich weg haben will,
muss sie vor dem Beenden schliessen (das tut Zeile 335 fuer das eigene bereits richtig).

**Sicherheit:** sehr sicher.

---

## 6. WICHTIG - `tryCrack` verlangt ein Hacking-Level, das `nuke` gar nicht verlangt

```js
if (open >= ns.getServerNumPortsRequired(host) && ns.getServerRequiredHackingLevel(host) <= ns.getHackingLevel()) {
```
(`autopilot.js:486`)

`ns.nuke` prueft genau zwei Dinge: ob NUKE.exe vorhanden ist und ob genug Anschluesse offen
sind (`src/NetscriptFunctions.ts:531-548`). Das Hacking-Level kommt darin nicht vor. Auch
`grow` und `weaken` verlangen kein Level - `netscriptCanGrow`/`netscriptCanWeaken` rufen nur
`baseCheck` (Root-Zugriff) auf; das Level prueft ausschliesslich `netscriptCanHack`
(`src/Hacking/netscriptCanHack.ts:32-55`).

**Auswirkung.** Rechner wie `phantasy`, `omega-net` oder `the-hub` haben 32-128 GB Speicher
und ein hohes `requiredHackingSkill`. Sie waeren als ARBEITSPFERDE sofort verfuegbar, sobald
die Anschluesse offen sind - der Bot laesst sie liegen, bis sein Level passt. Genau in der
Phase, in der Speicher der Engpass ist, verschenkt er den groessten Teil davon.

**Wie es richtig waere.** Die Level-Bedingung aus `tryCrack` streichen. Das Level gehoert
allein in den Zielfilter (`autopilot.js:185`), wo es schon steht.

**Sicherheit:** sehr sicher.

---

## 7. WICHTIG - Einkommens- und Erfahrungsanzeige messen strukturell fast nichts

`autopilot.js:313` und `telemetry.js:70` verwenden `ns.getTotalScriptIncome()[0]`,
`autopilot.js:314` und `telemetry.js:71` `ns.getTotalScriptExpGain()`.

```ts
getTotalScriptIncome: () => () => {
  // First element is total income of all currently running scripts
  let total = 0;
  for (const script of workerScripts.values()) {
    total += script.scriptRef.onlineMoneyMade / script.scriptRef.onlineRunningTime;
  }
  let incomeFromScriptsSinceLastAug = Player.scriptProdSinceLastAug / (Player.playtimeSinceLastAug / 1000);
  ...
  return [total, incomeFromScriptsSinceLastAug];
}
```
(`src/NetscriptFunctions.ts:1278-1290`)

**Warum das hier falsch ist.** Element 0 summiert nur ueber `workerScripts`, also ueber
LAUFENDE Skripte. Unsere Arbeiter sind Ein-Weg-Skripte: `worker/hack.js` bucht sein Geld in
`ws.scriptRef.onlineMoneyMade` unmittelbar bevor `main` zurueckkehrt und der Prozess stirbt.
Zwischen Buchung und Tod liegt ein Mikrotask. Die Wahrscheinlichkeit, dass die Sekundenabfrage
genau dort hinfaellt, ist praktisch null. Element 0 zeigt darum dauerhaft nahe 0 an, obwohl
der Bot verdient. Dasselbe gilt fuer `getTotalScriptExpGain` (`:1302-1308`), das ueber
dieselbe Menge laeuft.

**Auswirkung.** Die `$x/s`-Zahl im Skriptfenster, das `exp/s` daneben und `income.scriptIncome`
im Dashboard sind unbrauchbar. Wer nach ihnen balanciert, balanciert nach Rauschen.

**Wie es richtig waere.** Element 1 nehmen (`Player.scriptProdSinceLastAug` geteilt durch die
Spielzeit seit dem letzten Aug-Reset) - das ist genau der Langzeitschnitt, den man hier will.
Oder selbst messen: Kontostand-Delta pro Zeit, um die Ausgaben von invest.js bereinigt.

**Sicherheit:** sehr sicher.

---

## 8. KRITISCH - `expectedYield` ist fuer fast alle Ziele exakt 0

```js
export function expectedYield(s, p, ramFree, horizon = 900) {
  const rate = targetScore(s, p);
  if (rate <= 0) return 0;
  const prep = prepSeconds(s, p, ramFree);
  const harvestTime = Math.max(0, horizon - prep);
  return rate * harvestTime;
}
```
(`calc.js:270-276`)

Sobald `prepSeconds >= 900`, ist das Ergebnis 0 - und zwar fuer jedes Ziel gleichermassen.
Danach ist `candidates.sort((a, b) => b.yield - a.yield)` (`autopilot.js:192`) ein
Vergleich lauter Nullen; `Array.prototype.sort` ist stabil, die Reihenfolge bleibt also die
von `scanAll` - also die Tiefensuchreihenfolge des Netzes.

**Nachgemessen, nicht geschaetzt.** Ich habe `calc.js` unveraendert in node geladen und mit
Startwerten aus `src/Server/data/servers.ts` (`moneyMax = 25 * moneyAvailable`) und
Hacking-Level 50 durchgerechnet:

| Netz-RAM | n00dles | foodnstuff | joesguns | harakiri-sushi |
|---|---|---|---|---|
| 64 GB | prep 101 s, **yield 54.893** | prep 54.075 s, yield 0 | prep 14.400 s, yield 0 | prep 28.000 s, yield 0 |
| 128 GB | prep 101 s, **yield 54.893** | prep 26.670 s, yield 0 | prep 7.200 s, yield 0 | prep 14.000 s, yield 0 |
| 512 GB | prep 101 s, **yield 54.893** | prep 6.720 s, yield 0 | prep 1.800 s, yield 0 | prep 3.600 s, yield 0 |
| 2048 GB | prep 101 s, yield 54.893 | prep 1.785 s, yield 0 | prep 600 s, **yield 130.349** | prep 1.200 s, yield 0 |

Bis rund 1 TB Netzspeicher hat **genau ein einziges Ziel** einen Wert ungleich 0 - n00dles,
weil es mit `serverGrowth = 3000` (`src/Server/data/servers.ts:1171`) als einziges schnell
genug auffuellt. Alle anderen liegen exakt gleichauf bei 0, und die Reihenfolge unter ihnen
entscheidet allein `scanAll`. joesguns hat dabei mit `score = 434` den mehr als sechsfachen
Dauerertrag von n00dles (`score = 69`) - der Bot sieht davon nichts, bis das Netz ueber
1 TB waechst.

Der Grund ist strukturell: die Server starten bei `moneyAvailable`, ihr Maximum ist
`25 * moneyAvailable` (`src/Server/Server.ts`, Konstruktor). Das erste Auffuellen ist also
immer eine Verfuenfundzwanzigfachung, und die kostet in `prepSeconds` viele Wellen zu je
`4 * hackTime`.

**Auswirkung.** Genau in der Phase, in der die Zielwahl am meisten zaehlt, waehlt der Bot
faktisch nach Scan-Reihenfolge. Die Anzeige "Bestes Ziel ist jetzt X" (Zeile 197) ist dann
irrefuehrend. Immerhin: `active` sortiert danach noch einmal nach `score` (Zeile 212-215),
die Arbeit innerhalb der Auswahl bleibt also sinnvoll - aber WELCHE acht Ziele in die Auswahl
kommen, ist Zufall.

**Wie es richtig waere.** Statt hart abzuschneiden den erwarteten Ertrag als
`rate * horizon / (1 + prep/horizon)` oder schlicht `rate / (1 + prep/horizon)` bewerten -
monoton, nie exakt 0, und mit derselben Aussage.

**Sicherheit:** sehr sicher - mit dem echten `calc.js` nachgerechnet.

---

## 9. WICHTIG - `prepSeconds` unterschaetzt die Vorbereitung um bis zu Faktor 8

```js
const perWave = Math.max(1, Math.floor(ramFree / 1.75));
```
(`calc.js:239` und `:254`)

Aufgerufen wird mit `ramTotal`, dem Speicher des GESAMTEN Netzes (`autopilot.js:183`, `190`).
Der Autopilot bedient aber `MAX_TARGETS = 8` Ziele gleichzeitig (Zeile 41, 211). Jedes Ziel
bekommt also hoechstens einen Bruchteil.

**Auswirkung.** Die Vorbereitungszeit wird systematisch zu klein gerechnet, und zwar fuer
teure Ziele staerker als fuer billige - genau die Ziele werden dadurch bevorzugt, die die
Rechnung eigentlich bestrafen soll. Der Kommentar in Zeile 222-225 ("Gerechnet wird mit dem
Speicher, der TATSAECHLICH zur Verfuegung steht - nicht mit Wunschdenken") beschreibt das
Gegenteil dessen, was der Code tut.

**Wie es richtig waere.** `ramTotal / MAX_TARGETS` uebergeben, oder die Zahl der aktiven Ziele
als Parameter mitgeben.

**Nebenbei, kein Fehler:** dass Zeile 255 den Wachstumsteil mit `tW` statt mit
`growTime = 3.2 * hackTime` bewertet, ist laut Kommentar Absicht (der Sicherheitsaufwuchs muss
mit abgebaut werden) und liegt mit 25 % Aufschlag im vertretbaren Rahmen.

**Sicherheit:** sicher.

---

## 10. WICHTIG - Zweimal `ns.ps()` ueber das ganze Netz, jede Sekunde

`autopilot.js:137-142` durchsucht alle Arbeitsrechner nach invest.js, `autopilot.js:290-299`
durchsucht dieselben Rechner noch einmal fuer die Beschaeftigungsanzeige.

Bei 50-75 erreichbaren Rechnern und tausenden laufenden Ein-Weg-Arbeitern werden pro Sekunde
zweimal alle Prozesslisten aufgebaut und in neue Objekte kopiert. Das ist dauerhafte Last auf
dem Spiel-Hauptthread und verlangsamt die Simulation, die der Bot gleichzeitig ausnutzen will.

**Wie es richtig waere.** Eine einzige Runde `ns.ps` je Rechner, aus deren Ergebnis beide
Fragen beantwortet werden; und die Beschaeftigungsanzeige nicht jede Sekunde, sondern
beispielsweise alle fuenf Runden neu bilden.

**Sicherheit:** sicher (Groessenordnung haengt vom Netz ab, das Muster nicht).

---

## 11. WICHTIG - Keine Fehlerbehandlung; ein werfender Host reisst alles mit

Die Hauptschleife (`autopilot.js:70-340`) hat kein `try/catch`. Die Lageaufnahme in
Zeile 99-115 ruft fuer JEDEN Host aus `scanAll` unter anderem `ns.getServerMaxMoney`,
`ns.getServerGrowth` und `ns.getServerSecurityLevel` auf. Diese Funktionen gehen ueber
`helpers.getNormalServer`, und das wirft, sobald der Host kein normaler `Server` ist:

```ts
if (!(server instanceof Server)) { ... throw helpers.errorMessage(ctx, errorMessage); }
```
(`src/Netscript/NetscriptHelpers.tsx`, `getNormalServer`)

Betroffen sind Hacknet-SERVER (BitNode 9 beziehungsweise nach dem entsprechenden Kauf) - die
stehen im Netz und kommen aus `ns.scan` zurueck. Darknet-Server sind ausgenommen, `ns.scan`
filtert `DarknetServer` explizit heraus (`src/NetscriptFunctions.ts:184`); `darkweb` ist in
v3.0.1 selbst ein `DarknetServer` geworden und faellt damit ebenfalls weg. In BN1 ohne
Hacknet-Server ist die Lage also heute ruhig - der Bot haelt aber keinerlei Reserve vor.

**Auswirkung, falls es doch eintritt.** Der Autopilot stirbt. invest.js startet ihn nach
spaetestens 5 s neu (`invest.js:47-49`). Der neue Prozess stirbt an derselben Stelle. Ergebnis:
eine Neustartschleife, bei der jeder Durchlauf zusaetzlich die `ns.pid`-Schleife aus Befund 5
abarbeitet. Das ist die vom Auftrag vermutete "Dauerschleife" - sie existiert, nur nicht ueber
den Quelltextvergleich, sondern ueber Ausnahmen.

**Der umgekehrte Fall - beide tot - ist ebenfalls moeglich:** die beiden halten sich nur
gegenseitig am Leben. Stirbt invest.js in einem Moment, in dem auch der Autopilot gerade
beendet ist (zum Beispiel weil `ns.exec("autopilot.js", "home")` mangels Speicher 0
zurueckgibt, `invest.js:48` prueft das nicht), holt niemand mehr jemanden zurueck.

**Wie es richtig waere.** `try/catch` um den Rundenkoerper mit Protokollierung und
`await ns.sleep(...)`, ausserdem die Lageaufnahme je Host absichern; und in `invest.js:48` den
Rueckgabewert von `ns.exec` auswerten und bei 0 protokollieren.

**Sicherheit:** sicher, was den fehlenden Schutz angeht; der konkrete Ausloeser ist
BitNode-abhaengig.

---

## 12. WICHTIG - Abgewaehlte Ziele werden nicht gestoppt

`active` wird jede Runde neu gebildet (`autopilot.js:209-215`). Faellt ein Ziel aus den ersten
acht heraus, hoert der Bot einfach auf, es zu bedienen. Die bereits laufenden hack-Threads auf
diesem Ziel laufen aber weiter und landen ihren Schlag - nur wachsen laesst das Guthaben
niemand mehr nach. Der Kommentar in Zeile 125-129 begruendet ausdruecklich, warum beim Start
nicht aufgeraeumt wird; fuer den laufenden Betrieb ist die Frage nie gestellt worden.

**Auswirkung.** Bei jedem Zielwechsel bleibt mindestens ein halb geleerter Server zurueck, der
danach mit hoher Security und wenig Geld dasteht - und damit in der naechsten Bewertung noch
schlechter abschneidet, also nicht zurueck in die Auswahl kommt. Ein sich selbst verstaerkender
Effekt.

**Wie es richtig waere.** Beim Zielwechsel die hack-Arbeiter des abgewaehlten Ziels gezielt
beenden (`ns.ps` liefert Dateiname und `args[0]`), oder das Ziel so lange in der Liste halten,
bis es wieder aufgefuellt ist.

**Sicherheit:** sicher.

---

## 13. WICHTIG - `HOME_RESERVE` wird doppelt gezaehlt

```js
ramFree: Math.max(0, ram - ns.getServerUsedRam(host) - (host === "home" ? HOME_RESERVE : 0)),
```
(`autopilot.js:107`, Konstante in Zeile 34)

`ns.getServerUsedRam("home")` enthaelt bereits den Autopiloten selbst. Der Kommentar in
Zeile 33 ("Auf home muss Platz fuer den Autopiloten selbst bleiben") beschreibt genau das, was
schon passiert ist. Der Reservewert wird also zusaetzlich abgezogen.

Nach `src/Netscript/RamCostGenerator.ts` kostet `autopilot.js` rund 6,70 GB
(1,60 Grundlast + `exec` 1,30 + `scp` 0,60 + `getPlayer` 0,50 + `killall` 0,50 +
`ls`/`ps`/`scan` je 0,20 + acht Server-Abfragen + fuenf Portknacker + `nuke` + `fileExists` +
`getScriptRam` + `getHackingLevel` + `getTotalScript*`). Auf dem Start-home mit 8 GB bleiben
damit ohnehin nur 1,3 GB uebrig - weniger als ein Arbeiter (1,70 GB). Heute macht der Fehler
also nichts.

**Auswirkung, sobald home aufgeruestet wird.** Bei 64 GB home liegen dauerhaft 7 GB brach, die
vier Arbeiter tragen koennten - und home ist wegen seiner mehreren Kerne fuer grow und weaken
der WERTVOLLSTE Rechner im Netz (`coreBonus = 1 + (cores-1)/16`, `src/Server/ServerHelpers.ts:287`).

**Wie es richtig waere.** Entweder `ramFree = ram - used` und den Reservewert weglassen, oder
den Reservewert auf einen bewussten Sicherheitszuschlag (etwa 2 GB) setzen und den Kommentar
korrigieren.

**Sicherheit:** sehr sicher.

---

## 14. WICHTIG - Die Rechnung in der Hacknet-Begruendung ist um Faktor ~17 falsch

```
 * Node 1 hat sich nach 11 Minuten bezahlt, Node 8 kostet schon $74.166 fuer dieselben 1.50 $/s -
 * und dasselbe Geld in Server-RAM sind rund 13 hack-Threads.
```
(`invest.js:97-101`)

Die ersten beiden Zahlen stimmen. `calculateNodeCost(n) = 1000 * 1.85^(n-1)`
(`src/Hacknet/formulas/HacknetNodes.ts:87-92`), also Node 1 = $1.000 und
$1.000 / 1,50 = 667 s = 11,1 min; Node 8 = 1000 * 1,85^7 = $74.166. Ein neuer Node liefert
`1 * 1.5 * 1.035^0 * (1+5)/6 = 1,50 $/s` (`:4-11`). Alles korrekt.

**Die dritte Zahl nicht.** `BaseCostFor1GBOfRamServer: 55000` (`src/Server/data/Constants.ts:4`),
und unterhalb von 64 GB greift der Softcap nicht (`upg = max(0, log2(ram) - 6)`,
`src/Server/ServerPurchases.ts:34`). $74.166 kaufen also 1,35 GB - das sind **0,79
hack-Threads** (1,70 GB je Thread), nicht 13. Selbst mit dem home-Preis von $32.000/GB kaeme
man nur auf 1,4 Threads.

**Auswirkung.** Die Zahl steht als Begruendung fuer die harte Regel "Nodes nur, solange sie
sich binnen einer Stunde bezahlt machen". Korrekt gerechnet faellt der Vergleich sogar
FREUNDLICHER fuer Hacknet aus, nicht strenger. Die Regel mag trotzdem richtig sein - aber sie
ist derzeit falsch begruendet, und wer die Politik spaeter nachjustiert, rechnet auf einer
kaputten Grundlage weiter.

**Sicherheit:** sehr sicher (nachgerechnet aus zwei Konstanten des Quellcodes).

---

## 15. KLEINIGKEIT - Rundungskorrektur in `growThreads` weicht vom Original ab

Original (`src/Server/ServerHelpers.ts:177-198`):
```ts
const ccycle = Math.ceil(x);
if (ccycle - x > 0.999999) { /* nur im Grenzfall abwaerts pruefen */ }
if (ccycle >= x + (|diff| + 0.000001)) return ccycle;   // Schnellweg
if (targetMoney <= (startMoney + ccycle) * Math.exp(k * ccycle)) return ccycle;
return ccycle + 1;
```

Unsere Fassung (`calc.js:169-176`) prueft den Abwaertsschritt IMMER und kennt weder den
Grenzfall-Vorbehalt (`ccycle - x > 0.999999`) noch den Schnellweg. Mathematisch ist unser
Ergebnis nicht zu klein - wir dekrementieren nur, wenn `(o+t-1)*exp(k*(t-1)) >= n` tatsaechlich
gilt. Die Abweichung zum Spielwert betraegt hoechstens einen Thread.

Alles davor ist Zeile fuer Zeile identisch: Eingabeklemmung (`:100-102` gegen `:151-153`),
Startwert `(n-o)/(1 + (n/16 + 15o/16)*k)` (`:161` gegen `:159`), Iterationsschritt
`(x - ox*log(ox/n)) / (1 + ox*k)` (`:168` gegen `:164`), Abbruch bei `|diff| <= 1` (`:171`
gegen `:162`). Der zusaetzliche `guard < 60` in unserer Fassung ist eine reine
Sicherheitsleine; das Verfahren konvergiert laut Kommentar im Original in hoechstens drei
Schritten.

**Wie es richtig waere.** Wenn Bit-Gleichheit mit `ns.formulas.hacking.growThreads` gewuenscht
ist: die Originalreihenfolge uebernehmen. Fuer den Betrieb ist es egal.

**Sicherheit:** sicher.

---

## 16. KLEINIGKEIT - `weakenThreads`: fehlender BitNode-Faktor, immer `cores = 1`

```js
export function weakenThreads(secDelta, cores = 1) {
  if (secDelta <= 0) return 0;
  return Math.ceil(secDelta / (SERVER_WEAKEN_AMOUNT * coreBonus(cores)));
}
```
(`calc.js:185-188`)

Das Original hat einen Faktor mehr:
```ts
export function getWeakenEffect(threads: number, cores: number): number {
  return ServerConstants.ServerWeakenAmount * threads * coreBonus * currentNodeMults.ServerWeakenRate;
}
```
(`src/Server/ServerHelpers.ts:292-295`)

`ServerWeakenRate` ist in BN1 gleich 1, deshalb heute folgenlos. Anders als `hackChance`,
`hackPercent` und `hackTime`, die alle einen `bn...`-Parameter haben, fehlt hier aber sogar die
Moeglichkeit, ihn zu setzen - beim BitNode-Wechsel faellt das nicht auf.

Zweiter Punkt: alle drei Aufrufstellen (`autopilot.js:227`, `:236`, `:250`, `calc.js:237`)
rechnen mit `cores = 1`. Fremde Server bekommen bei der Netzerzeugung
`cpuCores = getRandomIntInclusive(ceil(layer/2), layer)` (`src/Server/ServerHelpers.ts:376`),
haben also durchaus mehrere Kerne; home ebenfalls. Der Bedarf wird dadurch systematisch zu
hoch angesetzt - die Richtung ist ungefaehrlich, aber es kostet Threads.

**Sicherheit:** sehr sicher.

---

## 17. KLEINIGKEIT - `ns.nuke` wirft nicht, es gibt `false` zurueck

```js
if (open >= ... ) {
  try { ns.nuke(host); return true; } catch { return false; }
}
```
(`autopilot.js:487-492`)

`ns.nuke` gibt bei fehlendem NUKE.exe oder zu wenigen offenen Anschluessen `false` zurueck und
protokolliert nur (`src/NetscriptFunctions.ts:531-548`). Unsere Fassung meldet in diesen
Faellen trotzdem Erfolg, `cracked.push(host)` und die Verlaufsmeldung "Zugriff auf X erlangt"
laufen los. Weil `hasRootAccess` in der naechsten Runde erneut geprueft wird, entsteht kein
Folgeschaden - aber der Verlauf luegt.

Dasselbe Muster eine Zeile hoeher: `try { fn(host); open++ } catch { open++ }` (`:475-485`)
zaehlt auch dann hoch, wenn der Aufruf aus einem ganz anderen Grund gescheitert ist. Die
Portknacker geben ebenfalls `false` zurueck statt zu werfen (`:549-563`).

**Wie es richtig waere.** `if (ns.nuke(host)) return true; return false;` und bei den
Portknackern den Rueckgabewert zaehlen statt den Aufruf.

**Sicherheit:** sehr sicher.

---

## 18. KLEINIGKEIT - Der Kommentar verspricht Timing, das es nicht gibt

`worker/hack.js:9-11`:
> Die Verzoegerung liegt bewusst INNERHALB der Aktion (additionalMsec) statt in einem sleep
> davor: nur so ist der Landezeitpunkt exakt.

Der Mechanismus stimmt (`validateHGWOptions` addiert `additionalMsec/1000` auf die Laufzeit,
`src/Netscript/NetscriptHelpers.tsx`), aber `deploy` uebergibt an dieser Stelle immer die feste
0:
```js
const pid = ns.exec(script, s.host, n, target, 0, Date.now() + "-" + started);
```
(`autopilot.js:519`). Es gibt also keinerlei Landezeitsteuerung. Wer den Kommentar liest,
haelt den Bot fuer einen Batcher, der er nicht ist. (Das ist zugleich die Zutat, die fuer
Befund 1 fehlt.)

**Sicherheit:** sehr sicher.

---

## 19. KLEINIGKEIT - `telemetry.js` ist verwaist und kollidiert mit `writeBrain`

`telemetry.js:17` schreibt nach `data/telemetry.txt` - genau die Datei, die auch
`writeBrain` (`autopilot.js:568`) jede Sekunde ueberschreibt und die die Bruecke abholt
(`bridge.js:31`, `:224`). Liefen beide, wuerden sie sich gegenseitig ueberschreiben.

Zusaetzlich liest `telemetry.js:43-45` `data/brain.txt`, eine Datei, die im gesamten Projekt
niemand schreibt. Die Felder `phase`, `action` und `reason` faenden also nie einen Wert.

`telemetry.js` wird von nichts gestartet - aber die Bruecke schiebt es weiterhin ins Spiel
(`bridge.js:135-157` nimmt alles unter `src/`). Es ist Altlast, die beim naechsten Lesen
Verwirrung stiftet.

**Sicherheit:** sehr sicher.

---

## 20. KLEINIGKEIT - "Verdient" mischt Einnahmen und Ausgaben

```js
earned = ns.getServerMoneyAvailable("home") - moneyAtStart;
```
(`autopilot.js:276`, Startwert Zeile 60)

`ns.getServerMoneyAvailable("home")` liefert das Spielerguthaben (Sonderfall in
`src/NetscriptFunctions.ts:991-995`). invest.js kauft davon Server und Hacknet-Nodes. Nach
einem Serverkauf zeigt die goldene "Verdient"-Zahl also ein Minus, obwohl gerade das
Erwuenschte passiert ist.

**Sicherheit:** sehr sicher.

---

## 21. KLEINIGKEIT - `writeBrain` liefert dem Dashboard Platzhalter

`autopilot.js:554-566`: `backdoored: 0` ist fest verdrahtet (der Bot setzt ohnehin keine
Backdoors, dafuer braeuchte er Source File 4), `threads: 0` bei jedem Ziel ebenso, und
`action` bekommt nur das eine `v.target` - die uebrigen sieben aktiven Ziele erscheinen im
Dashboard ohne Taetigkeit, obwohl der Autopilot in seinem eigenen Fenster sehr wohl weiss, was
sie tun (`t.doing`, `c.busy`).

**Sicherheit:** sehr sicher.

---

## 22. KLEINIGKEIT - Hacknet-Zugewinn ohne Spieler- und BitNode-Multiplikator

```js
const zugewinn = 1.5 * Math.pow(1.035, node.ram - 1) * ((node.cores + 5) / 6);
```
(`invest.js:131`)

Original: `levelMult * ramMult * coresMult * mult * currentNodeMults.HacknetNodeMoney`
(`src/Hacknet/formulas/HacknetNodes.ts:4-11`), wobei `mult` der Spielermultiplikator
`hacknet_node_money` ist. Ohne Augmentierungen und in BN1 sind beide 1. Mit den
Hacknet-Augmentierungen (oder in BN-Varianten mit `HacknetNodeMoney != 1`) faellt die
Amortisationsrechnung falsch aus - zu pessimistisch bei guten Multiplikatoren, zu optimistisch
bei schlechten.

**Sicherheit:** sehr sicher.

---

## 23. KLEINIGKEIT - `expPerThread` ist toter Code

`calc.js:105-108` bildet `calculateHackingExpGain` korrekt nach
(`3 + 0.3 * baseDifficulty`, mal `mults.hacking_exp`, mal `HackExpGain`,
`src/Hacking.ts:30-38`) - wird aber nirgends aufgerufen. `playerFacts`
(`autopilot.js:433-444`) liefert auch gar kein `multExp`, das man hineingeben koennte. Wer die
Erfahrungsausbeute in die Zielbewertung aufnehmen will (fuer den Levelaufbau in der Fruehphase
durchaus sinnvoll), muss beides ergaenzen.

**Sicherheit:** sehr sicher.

---

## 24. KLEINIGKEIT - Die Bruecke schiebt Dateien einzeln nach

`bridge.js:185-214` entprellt je Dateiname 150 ms und schiebt dann einzeln. Aendert man
`autopilot.js` und `lib/calc.js` in einem Zug, koennen beide Uebertragungen einige hundert
Millisekunden auseinanderliegen. Der Autopilot prueft seinen Quelltext einmal pro Sekunde
(`autopilot.js:332`) und kann sich also beenden, bevor die neue `calc.js` angekommen ist -
invest.js startet ihn dann mit der alten Formelbibliothek. Der Fehler heilt sich beim naechsten
Neustart, ist aber genau die Art von Wackelkontakt, die bei einer Messreihe Stunden kostet.

**Wie es richtig waere.** Alle Aenderungen einer Entprellungsrunde sammeln und gemeinsam
schieben, danach erst freigeben.

**Sicherheit:** mittel - Zeitfenster klein, aber real.

---

## 25. KLEINIGKEIT - Bruecke und Dashboard lauschen auf allen Schnittstellen

`new WebSocketServer({ port: RFA_PORT })` (`bridge.js:354`) und
`server.listen(DASHBOARD_PORT, ...)` (`bridge.js:343`) binden ohne Host-Angabe, also auf
0.0.0.0. Der Endpunkt `/api/rpc` (`bridge.js:306-326`) reicht beliebige RFA-Methoden
durch - darunter `getSaveFile` und `deleteFile`. Im Heimnetz ist das kein akutes Problem, aber
`listen(PORT, "127.0.0.1")` kostet nichts.

**Sicherheit:** sicher.

---

## Wo ich nichts gefunden habe

Damit klar ist, was tatsaechlich angesehen wurde:

**`lib/calc.js` - Formeln, Zeile fuer Zeile gegen den Quellcode gelegt:**

- `intBonus` (`:31`) - identisch mit `calculateIntelligenceBonus`
  (`src/PersonObjects/formulas/intelligence.ts:1`), Gewicht 1 ist im gesamten Hacking-System
  korrekt. Der `?? 0`-Schutz gegen fehlende Intelligence ist eine sinnvolle Ergaenzung.
- `coreBonus` (`:40`) - identisch mit `getCoreBonus` (`src/Server/ServerHelpers.ts:287`).
- `hackChance` (`:52`) - vollstaendig identisch mit `calculateHackingChance`
  (`src/Hacking.ts:9-24`), einschliesslich beider Abbruchbedingungen (`!hasAdminRights`,
  `hackDifficulty >= 100`), `clampNumber(1.75 * skill, 1)` als `Math.max(..., 1)` und der
  Klemmung auf [0,1]. Ein BitNode-Faktor gehoert hier korrekterweise NICHT hinein.
- `hackPercent` (`:69`) - identisch mit `calculatePercentMoneyHacked` (`src/Hacking.ts:44-57`),
  einschliesslich `balanceFactor = 240`, `skillMult = (skill - (reqSkill - 1)) / skill` und
  `ScriptHackMoney`. Kein Intelligence-Bonus - korrekt, den gibt es hier tatsaechlich nicht.
- `hackTime` (`:84`) - identisch mit `calculateHackingTime` (`src/Hacking.ts:60-80`):
  `(2.5 * reqSkill * sec + 500) / (skill + 50)`, mal 5, geteilt durch
  `hacking_speed * HackingSpeedMultiplier * intBonus`. Ergebnis in Sekunden, wie im Original.
- `GROW_TIME_FACTOR = 3.2` und `WEAKEN_TIME_FACTOR = 4` (`:24-25`) - belegt in
  `src/Hacking.ts:84` und `:91`.
- Alle vier Konstanten in `:14-17` stimmen mit `src/Server/data/Constants.ts:7-10`.
  `SERVER_MAX_GROWTH_LOG = 0.00349388925425578` ist tatsaechlich `log1p(0.0035)`, und die
  Kommentarbehauptung "der Deckel greift ab sec <= 8.5714" ist nachgerechnet richtig
  (`0.03 / 0.0035 = 8,5714`).
- `GROW_FORTIFY_AMOUNT = 2 * SERVER_FORTIFY_AMOUNT` (`:20`) - belegt in
  `src/Server/ServerHelpers.ts:211` und `src/NetscriptFunctions.ts:340`.
- `growthLogPerThread` (`:120`) - identisch mit `calculateServerGrowthLog`
  (`src/Server/formulas/grow.ts:8-29`) fuer `threads = 1`, einschliesslich `-Infinity` bei
  `serverGrowth = 0`, `log1p`, Deckel und Faktorenreihenfolge.
- `growThreads` (`:147`) - Newton-Raphson identisch bis auf die Rundungskorrektur, siehe
  Befund 15. Startwert, Iterationsschritt und Abbruchbedingung stimmen exakt.
- `expPerThread` (`:105`) - formal korrekt, siehe Befund 23 (nur ungenutzt).
- `targetScore` (`:201`) und `prepSeconds` (`:232`) sind eigene Heuristiken, keine
  Spielformeln - dort ist nur zu pruefen, ob die verwendeten Bausteine richtig eingesetzt
  werden. Der Faktor 400 in `:215` hat keine Entsprechung im Quellcode; das ist aber
  ausdruecklich als Naeherung gekennzeichnet und nicht falsch, nur willkuerlich.

**NS-Schnittstelle - jeder Aufruf gegen v3.0.1 geprueft:**

- Kein einziger Aufruf aus `setRemovedFunctions` (`src/NetscriptFunctions.ts:1531-1610`) ist
  im Code uebrig. Die Treffer von `grep` auf `ns.purchaseServer` in `autopilot.js:136` und
  `invest.js:10` stehen beide in Kommentaren. `ns.getServer` in `scan.js:9` ebenfalls.
- Der Umzug nach `ns.cloud` ist in `invest.js` vollstaendig und mit korrekten Signaturen
  vollzogen: `getServerNames()`, `getServerLimit()`, `getRamLimit()`, `getServerCost(ram)`,
  `purchaseServer(hostname, ram)` (gibt `""` bei Misserfolg, wird richtig geprueft),
  `getServerUpgradeCost(host, ram)` (gibt `-1` bei Fehler, wird richtig geprueft),
  `upgradeServer(host, ram)` (gibt `boolean`). Alles gegen
  `src/NetscriptFunctions/Cloud.ts` geprueft.
- Der Umzug nach `ns.ui` ist vollzogen: `openTail`, `moveTail`, `resizeTail`, `closeTail`,
  `setTailTitle` existieren alle mit den benutzten Signaturen
  (`src/NetscriptFunctions/UserInterface.ts:16-119`), und alle kosten 0 GB
  (`src/Netscript/RamCostGenerator.ts`, Block `const ui`).
- `ns.scp(files, destination, source)` - Reihenfolge korrekt. `ns.exec(script, host, threads,
  ...args)` - korrekt; `preventDuplicates` ist standardmaessig aus
  (`src/NetscriptWorker.ts:328`), das eindeutige dritte Argument in `autopilot.js:519` ist
  also unnoetig, aber harmlos.
- `ns.getPlayer()` liefert `skills` und `mults` wie in `playerFacts` angenommen;
  `p.skills.intelligence` kann fehlen, der `?? 0` faengt das.
- `ns.heart.break()` existiert (`src/NetscriptFunctions.ts:1526`) und kostet 0.
- Der Import `import * as calc from "lib/calc"` ohne Endung funktioniert: die Modulaufloesung
  haengt die Endung des importierenden Skripts an
  (`src/utils/ScriptTransformer.ts:129-153`, `resolveScriptFilePath(moduleName, baseModule,
  extension)`).
- **RAM nachgerechnet** gegen `src/Netscript/RamCostGenerator.ts`:
  `autopilot.js` ~6,70 GB, `invest.js` ~10,75 GB (davon 3,50 GB allein fuer sieben
  hacknet-Funktionen und 2,25 GB fuer `cloud.purchaseServer`), `telemetry.js` 2,75 GB,
  `scan.js` 2,65 GB, Arbeiter 1,70 / 1,75 / 1,75 GB. Alle Angaben in den Kopfkommentaren der
  Arbeiter stimmen; die Behauptung in `autopilot.js:541-543` ("ein eigener Telemetrie-Prozess
  haette 2.75 GB gefressen") stimmt ebenfalls; die Behauptung in `scan.js:9-10`
  ("Einzelabfragen kosten 0.85 GB statt 2 GB fuer `ns.getServer`") stimmt exakt -
  `getServer: 2` steht in `RamCostGenerator.ts:608`, die zehn Einzelabfragen summieren sich auf
  genau 0,85 GB. Dass `invest.js` mit 10,75 GB einen 16-GB-Rechner braucht, ist mit
  `foodnstuff` (16 GB, 0 Anschluesse, `requiredHackingSkill` 1) ab der ersten Minute erfuellbar.
- `ns.scan` liefert keine Darknet-Server (`src/NetscriptFunctions.ts:184`), und `darkweb` ist
  in v3.0.1 selbst ein `DarknetServer` - der frueher uebliche Absturz auf `darkweb` kann hier
  also nicht auftreten.

**Autopilot-Logik, ausdruecklich geprueft und fuer richtig befunden:**

- Die Sicherheitsrechnung selbst (Befund 2, zweiter Teil): 1 weaken je 25 hack-Threads, 1
  weaken je 12,5 grow-Threads - beides korrekt aus den Konstanten abgeleitet.
- Die Reihenfolge innerhalb der Runde (erst knacken, dann Lage, dann Arbeiter ausliefern, dann
  Einkaeufer sichern, dann verteilen) ist richtig gewaehlt: der Einkaeufer bekommt seinen
  Speicher, BEVOR die Arbeiter alles belegen.
- Die Speicherbuchhaltung INNERHALB einer Runde ist sauber: `s.ramFree` wird bei jedem
  erfolgreichen `exec` heruntergeschrieben (`:520`), und `ramFree` wird zu Rundenbeginn aus
  `ns.getServerUsedRam` neu gebildet - Arbeiter aus frueheren Runden sind also korrekt
  eingerechnet. Es gibt hier KEINE Doppelvergabe.
- **Fragmentierung ist kein Fehler.** `deploy` (`:513-524`) laeuft ueber ALLE Rechner absteigend
  nach freiem Speicher und ueberspringt nur solche, auf die kein ganzer Thread mehr passt
  (`fits < 1`). Reste unterhalb 1,75 GB sind physikalisch unbrauchbar, nicht verschenkt. Die
  Anzeige benennt den Zustand sogar korrekt ("in zu kleinen Resten verteilt", `:272`). Dass
  grosse Rechner zuerst gefuellt werden, ist hier zusaetzlich das Richtige: verteilt man eine
  Erntewelle auf viele Rechner, wirken die Teilschlaege multiplikativ statt additiv
  (`moneyDrained = moneyAvailable * percentHacked * threads` je `ns.hack`-Aufruf) und die
  Gesamtabschoepfung faellt geringer aus als beabsichtigt.
- Der Notfallweg fuer den Einkaeufer (`:152-161`, `ns.killall` auf dem kleinsten passenden
  Rechner) kann invest.js nicht selbst treffen - er wird nur betreten, wenn invest.js
  nachweislich nirgends laeuft.
- Der Selbstbeendigungsweg (`:332-337`) schliesst korrekt zuerst das eigene Fenster und
  beendet dann - in dieser Reihenfolge, weil `closeTail` auf tote Skripte nicht mehr wirkt.
  Das ist die einzige Stelle, an der die Erkenntnis aus `doku/api-aenderungen-v3.md:58` richtig
  angewandt wird.
- Der Wachhund in `invest.js:47-49` prueft `ns.ps("home")` auf den Dateinamen - das ist der
  richtige Weg, `ns.isRunning` waere teurer und braeuchte die Argumente.
- `invest.js` gibt nie das ganze Guthaben aus (`PUFFER = 2`, Hacknet `PUFFER = 4`), und die
  Annahme "Aufruesten kostet nur die Differenz" ist korrekt:
  `getCloudServerUpgradeCost = getCloudServerCost(neu) - getCloudServerCost(alt)`
  (`src/Server/ServerPurchases.ts:53`).

**Bruecke:** Protokollrahmen (`jsonrpc`, `id`, `method`, `params`), die benutzten Methoden
`pushFile`, `getFile`, `getAllServers` und deren Antwortformen stimmen mit
`src/RemoteFileAPI/MessageHandlers.ts` ueberein. Zeitueberschreitungen werden aufgeraeumt,
das Protokoll ist gedeckelt, der Wechsel auf eine zweite Spielverbindung ist korrekt behandelt
(die alte `close`-Behandlung setzt den Zustand nicht faelschlich zurueck), und der
Pfaddurchgriff im Dashboard-Server ist wirksam abgesichert.

**Nicht geprueft:** die Inhalte von `dashboard/index.html` und `tools/ui.js` (Oberflaechen-
Fahrplaene, kein NS-Code), sowie die Vollstaendigkeit der grossen Formelsammlungen in `doku/` -
dazu siehe den folgenden Abschnitt.
