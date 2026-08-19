# Pruefbericht Bitburner-Autopilot

**Stand:** 19.08.2026, ca. 20:05
**Geprueft gegen:** `reference\v301` (Tag v3.0.1, `src/Constants.ts` VersionString "3.0.1").
Der dev-Branch unter `reference\bitburner-src` wurde nicht als Massstab benutzt.

**Am Code wurde nichts geaendert.** Der Bot laeuft live.

## Vorbemerkung: der Pruefgegenstand hat sich waehrend der Pruefung zweimal geaendert

`autopilot.js` wurde waehrend dieser Pruefung um 20:00 und um 20:01 neu geschrieben. Zwischen
meinem ersten und meinem letzten Blick sind mehrere Befunde von selbst verschwunden - unter
anderem die fehlende Buchhaltung ueber laufende Wellen, die Level-Pruefung in `tryCrack`, die
wirkungslose `closeTail`-Schleife beim Start und der doppelt gezaehlte `HOME_RESERVE`. Ich habe
alles Folgende deshalb gegen einen **festen Schnappschuss** geprueft:

| Datei | Groesse | Geaendert | MD5 |
|---|---|---|---|
| `src/autopilot.js` | 27273 | 19.08.2026 20:01:30 | `473e50cde9cc761585cfcb076041db3b` |
| `src/invest.js` | 5709 | 19.08.2026 19:32:15 | `3636fc998e7e66a14196dbfda8a5a47d` |
| `src/lib/calc.js` | 10174 | 19.08.2026 18:58:31 | `b4bf10453e41b1ad484dc9a88cb6bb05` |
| `sync/bridge.js` | 13327 | 19.08.2026 18:43:47 | `b244ed77a8933f1cc703bf3b31b2c620` |

Weicht die Datei bei der Lektuere ab, gelten die Zeilenangaben nicht mehr; der Sachverhalt in
der Begruendung bleibt jeweils pruefbar.

**Ein Befund, den ich zwischenzeitlich hatte und wieder zurueckziehe**, weil er falsch war:
`ns.getTotalScriptIncome()` misst NICHT an unseren Ein-Weg-Arbeitern vorbei.
`src/NetscriptWorker.ts:160-166` uebertraegt die Einnahmen eines sterbenden Skripts an seinen
ELTERNPROZESS, und `runScriptFromScript` setzt `runningScript.parent = workerScript.pid`, also
den Autopiloten. Die Zahl stimmt. Der laufende Bot zeigt $2.783/s, was das bestaetigt. (Der
Autopilot ist inzwischen ohnehin auf Element `[1]` umgestellt - beides waere richtig gewesen,
`[1]` ist nur stabiler ueber Neustarts hinweg.)

**Lagebild aus dem laufenden Bot** (ueber `http://localhost:8795/api/state`, Runde 88):
95 Server im Netz, davon 38 gerootet, 500 GB Gesamtspeicher (475 belegt), Hacking-Level 132,
25 gekaufte Server, `busy = {hack: 6, grow: 240, weaken: 15}`. Ich beziehe mich an mehreren
Stellen darauf.

---

## Befundtabelle

Sortiert nach Schwere. Die Nummer ist eine Kennung, keine Rangfolge.
`C` = Code, `D` = Dokumentation.

| # | Schwere | Fundstelle | Befund | Sicherheit |
|---|---|---|---|---|
| C1 | KRITISCH | `calc.js:232-276`, `autopilot.js:216-219` | `expectedYield` ist fuer fast alle Ziele exakt 0, weil `prepSeconds` explodiert. Die Zielsortierung faellt auf die Scan-Reihenfolge zurueck. Im laufenden Bot nachweisbar. | sehr sicher (nachgerechnet + live) |
| D1 | KRITISCH | `strategie.md:144` | Empfiehlt `ns.stock.hasWSEAccount()` und `has4SDataTIXAPI()` - beide in 3.0.0 ENTFERNT. Widerspricht `strategie.md:687`, wo dieselben Felder richtig stehen. | sehr sicher |
| C2 | WICHTIG | `autopilot.js:163-166` | `ns.kill(laeuft.pid)` gibt den frei gewordenen Speicher nicht an `s.ramFree` zurueck. Folge: der Einkaeufer findet keinen Platz und raeumt per `ns.killall` einen fremden Rechner leer. Live beobachtet. | sehr sicher (live) |
| C3 | WICHTIG | `autopilot.js:311-319`, `:331-337` | Der ausgleichende weaken wird weiterhin NACH grow/hack verteilt und bekommt nur die Reste. Live: 240 grow gegen 15 weaken, noetig waeren 20. | sicher |
| C4 | WICHTIG | `autopilot.js:82`, `:403`, `:405` | Das neue `try/catch` faengt auch `ScriptDeath`. Dass `ns.exit()` trotzdem wirkt, haengt allein daran, dass `await ns.sleep(1000)` ausserhalb des `try` steht. Wer das verschiebt, friert das Spiel ein. | sehr sicher |
| C5 | WICHTIG | `autopilot.js:47` gegen `:286-289` | `PREP_TARGETS = 4`, der Kommentar direkt darueber begruendet ausfuehrlich, warum nur EIN Ziel vorbereitet wird. Zwei Kommentare derselben Datei widersprechen einander. | sehr sicher |
| C6 | WICHTIG | `autopilot.js:290-292` | Ziele, die aus der Auswahl fallen, werden nicht gestoppt. Ihre hack-Threads laufen weiter, ohne dass jemand nachwachsen laesst. | sicher |
| C7 | WICHTIG | `invest.js:97-107` **und** `formeln-wirtschaft.md:414-416` | "$74 166 in Server-RAM → 1.34 GB, d. h. rund 13 `hack()`-Threads": 1,34 GB sind 0,79 Threads. Faktor ~17. Derselbe Fehler steht in Doku und Code. | sehr sicher |
| C8 | WICHTIG | `autopilot.js` gesamt | Der Autopilot kostet rund 7,15 GB. Auf einem 8-GB-home bleiben 0,85 GB Luft. Eine weitere teure NS-Funktion macht ihn unstartbar - und `invest.js:48` wertet den Fehlschlag nicht aus. | sicher |
| D2 | WICHTIG | `formeln-wirtschaft.md:135-137` | "ab ca. 64 GB Heim-RAM ist gekauftes RAM billiger" - der Kreuzungspunkt liegt bei 2,3 GB. Das Dokument widerlegt sich zwei Zeilen spaeter selbst; `strategie.md:422-425` hat es richtig. | sehr sicher |
| D3 | WICHTIG | `formeln-wirtschaft.md:412` | "bis ungefaehr Node 6-7 ... ($21 670 bzw. $74 166)": $74.166 ist Node **8**, Node 7 kostet $40.089. Die 1-Stunden-Schwelle reisst schon bei Node 4. Widerspricht der eigenen Tabelle `:232-233`. | sehr sicher |
| D4 | WICHTIG | `formeln-wirtschaft.md:628` | "$26 Mrd sind in unter vier Stunden drin" bei $300M/h. Mit Zinseszins sind es 12,6 h. `strategie.md:772-774` rechnet es bereits richtig vor. | sehr sicher |
| D5 | WICHTIG | `api-aenderungen-v3.md:52-54` | Die Liste der Unter-APIs mit Streichungen nennt `stock` nicht (drei 3.0.0-Streichungen) und `sleeve` nicht. Genau diese Luecke hat D1 verursacht. | sehr sicher |
| D6 | WICHTIG | `oberflaeche.md:40` | `CompanyLocation.tsx:62` ist `startInfiltration`, nicht "Job annehmen"; die Job-Bewerbung ist gar nicht `isTrusted`-geschuetzt. `strategie.md:830/838` hat es richtig. | sehr sicher |
| D7 | WICHTIG | `strategie.md:623-629` | Die Spalte L=2500 der Reset-Beschleunigungstabelle ist durchgehend falsch (m=1,30: 2,5e8 statt 6,8e7). L=500 und L=1000 stimmen. | sicher |
| C9 | KLEINIGKEIT | `calc.js:169-176` | Rundungskorrektur in `growThreads` weicht vom Original ab. Hoechstens ein Thread Unterschied. | sicher |
| C10 | KLEINIGKEIT | `calc.js:185-188` | `weakenThreads` kennt `ServerWeakenRate` nicht (BN1 = 1) und wird ueberall mit `cores = 1` gerufen. | sehr sicher |
| C11 | KLEINIGKEIT | `calc.js:215` | Der Faktor 400 in `targetScore` hat keine Entsprechung im Spielcode. | sehr sicher |
| C12 | KLEINIGKEIT | `calc.js:105-108` | `expPerThread` ist toter Code; `playerFacts` liefert kein `multExp`. | sehr sicher |
| C13 | KLEINIGKEIT | `autopilot.js:548-556` | `tryCrack` zaehlt `open++` auch im `catch`. Die Portknacker werfen gar nicht, sie geben `false` zurueck. | sehr sicher |
| C14 | KLEINIGKEIT | `worker/hack.js:9-11`, `autopilot.js:594` | Der Kommentar verspricht exakte Landezeitpunkte ueber `additionalMsec`. `deploy` uebergibt immer 0. | sehr sicher |
| C15 | KLEINIGKEIT | `autopilot.js:362` | "Verdient" ist der Kontostand-Delta und enthaelt die Ausgaben von invest.js. | sehr sicher |
| C16 | KLEINIGKEIT | `autopilot.js:632-641` | `writeBrain` verdrahtet `threads: 0` und `backdoored: 0` fest; `action` bekommt nur das eine `target`. | sehr sicher |
| C17 | KLEINIGKEIT | `invest.js:28-32`, `:85-88` | Die Selbstaktualisierung von invest.js ist toter Code, seit der Autopilot den Verwalter in Runde 1 abschiesst. Der Kommentar behauptet weiterhin, sie funktioniere. | sehr sicher |
| C18 | KLEINIGKEIT | `invest.js:131` | Hacknet-Zugewinn ohne `mults.hacknet_node_money` und ohne BitNode-Multiplikator. | sehr sicher |
| C19 | KLEINIGKEIT | `telemetry.js:17`, `:43` | Verwaist: schreibt in dieselbe Datei wie `writeBrain`, liest `data/brain.txt`, das niemand schreibt. | sehr sicher |
| C20 | KLEINIGKEIT | `bridge.js:255` | `purchasedCount` zaehlt home mit - im Spiel ist `home.purchasedByPlayer === true`. Live zeigt das Dashboard 26 statt 25. | sehr sicher (live) |
| C21 | KLEINIGKEIT | `bridge.js:185-214` | Mehrere gleichzeitig geaenderte Dateien werden einzeln geschoben; der Autopilot kann neu starten, bevor `lib/calc.js` da ist. | mittel |
| C22 | KLEINIGKEIT | `bridge.js:343`, `:354` | RFA und Dashboard binden auf allen Schnittstellen; `/api/rpc` reicht beliebige RFA-Methoden durch, darunter `getSaveFile` und `deleteFile`. | sicher |
| D8 | KLEINIGKEIT | diverse | Ein Dutzend Zeilennummern-Abweichungen und kleinere Rechenfehler in den Formelsammlungen - Sammelabschnitt. | sicher |

---

# Teil A - Code

## C1 (KRITISCH) - `expectedYield` ist fuer fast alle Ziele exakt 0

```js
export function expectedYield(s, p, ramFree, horizon = 900) {
  const rate = targetScore(s, p);
  if (rate <= 0) return 0;
  const prep = prepSeconds(s, p, ramFree);
  const harvestTime = Math.max(0, horizon - prep);
  return rate * harvestTime;
}
```
(`calc.js:270-276`, benutzt in `autopilot.js:216`, sortiert in `:219`)

Sobald `prepSeconds >= 900`, ist das Ergebnis 0 - fuer jedes betroffene Ziel gleichermassen.
`Array.prototype.sort` ist stabil, die Reihenfolge unter lauter Nullen bleibt also die von
`scanAll` (eine Tiefensuche mit `queue.pop()`).

**Nachgerechnet.** Ich habe `calc.js` unveraendert in node geladen, mit Startwerten aus
`src/Server/data/servers.ts` (`moneyMax = 25 * moneyAvailable`) und Level 50:

| Netz-RAM | n00dles | foodnstuff | joesguns | harakiri-sushi |
|---|---|---|---|---|
| 64 GB | prep 101 s, **yield 54.893** | prep 54.075 s, yield 0 | prep 14.400 s, yield 0 | prep 28.000 s, yield 0 |
| 128 GB | prep 101 s, **yield 54.893** | prep 26.670 s, yield 0 | prep 7.200 s, yield 0 | prep 14.000 s, yield 0 |
| 512 GB | prep 101 s, **yield 54.893** | prep 6.720 s, yield 0 | prep 1.800 s, yield 0 | prep 3.600 s, yield 0 |
| 2048 GB | prep 101 s, yield 54.893 | prep 1.785 s, yield 0 | prep 600 s, **yield 130.349** | prep 1.200 s, yield 0 |

Bis rund 1 TB Netzspeicher hat genau ein Ziel einen Wert ungleich 0: n00dles, weil es mit
`serverGrowth = 3000` (`src/Server/data/servers.ts:1171`) als einziges schnell genug auffuellt.

**Und so sieht es im laufenden Bot aus** (Runde 88, `ramTotal` 500 GB). Die Reihenfolge ist die
nach `yield` sortierte Kandidatenliste, `v/s` ist `targetScore`:

| Rang | Ziel | valuePerSec |
|---|---|---|
| 1 | harakiri-sushi | 729,5 |
| 2 | n00dles | 127,2 |
| 3 | joesguns | 674,9 |
| 4 | foodnstuff | 231,1 |
| 5 | sigma-cosmetics | 449,2 |

Die Reihenfolge ist in keiner Weise monoton im Ertrag. joesguns mit 675 $/s steht hinter
n00dles mit 127 $/s. Das ist keine Theorie - das ist der Zustand, in dem der Bot gerade
arbeitet. Frueher im selben Lauf stand im Verlauf sogar "Bestes Ziel ist jetzt n00dles
($125.2/s)".

**Zweite, unabhaengige Ursache derselben Zahl** (`calc.js:239` und `:254`):
```js
const perWave = Math.max(1, Math.floor(ramFree / 1.75));
```
Aufgerufen wird mit `ramTotal`, dem Speicher des GESAMTEN Netzes. Der Autopilot bedient aber
bis zu `MAX_TARGETS + PREP_TARGETS = 12` Ziele gleichzeitig. Der Kommentar in `calc.js:222-225`
("Gerechnet wird mit dem Speicher, der TATSAECHLICH zur Verfuegung steht - nicht mit
Wunschdenken") beschreibt das Gegenteil dessen, was der Code tut. Richtig gerechnet waeren die
Prep-Zeiten oben nochmal um Faktor 4 bis 12 groesser - dann waere auch n00dles bei 0 und die
Sortierung vollstaendig zufaellig.

**Warum das strukturell so ist.** Server starten bei `moneyAvailable`, ihr Maximum ist
`25 * moneyAvailable` (`src/Server/Server.ts`, Konstruktor). Das erste Auffuellen ist immer eine
Verfuenfundzwanzigfachung, und `prepSeconds` bewertet jede Welle mit `4 * hackTime`.

**Wie es richtig waere.** Nicht hart abschneiden, sondern daempfen: `rate / (1 + prep/horizon)`
oder `rate * horizon / (horizon + prep)`. Monoton, nie exakt 0, gleiche Aussage. Und
`prepSeconds` den Speicher **pro Ziel** uebergeben, nicht den des ganzen Netzes.

**Sicherheit:** sehr sicher - nachgerechnet und am laufenden Bot bestaetigt.

---

## C2 (WICHTIG) - Der `kill` des Verwalters gibt seinen Speicher nicht zurueck

```js
for (const s of workforce) {
  const laeuft = ns.ps(s.host).find((p) => p.filename === "invest.js");
  if (!laeuft) continue;
  if (round === 1) {
    ns.kill(laeuft.pid);      // <-- s.ramFree bleibt unveraendert
    continue;
  }
  ...
}
if (!investLives && investRam > 0) {
  let wirt = workforce.filter((s) => s.host !== "home" && s.ramFree >= investRam)...
  if (!wirt) {
    wirt = ...;  ns.killall(wirt.host);   // Notfallweg
  }
}
```
(`autopilot.js:156-197`)

`s.ramFree` wird zu Rundenbeginn aus `ns.getServerUsedRam` gebildet (`:118`) und enthaelt zu
diesem Zeitpunkt noch die 10,75 GB von invest.js. Nach `ns.kill` ist der Speicher im Spiel frei
(`src/Netscript/killWorkerScript.ts:124` schreibt `server.updateRamUsed(...)` sofort), aber
unsere Kopie weiss davon nichts.

**Auswirkung, live beobachtet.** Das Netz ist zu 95 % belegt (475 von 500 GB). Nach dem `kill`
findet die Filterzeile keinen einzigen Rechner mit `ramFree >= 10.75`, also greift der
Notfallweg und raeumt mit `ns.killall` einen ganzen Rechner leer. Im Ereignisprotokoll des
laufenden Bots steht genau das:

> `Platz fuer den Einkaeufer geschaffen auf foodnstuff`
> `Einkaeufer laeuft jetzt auf foodnstuff`

foodnstuff hat 16 GB, das sind rund neun vernichtete Arbeiter - **bei jedem einzelnen Neustart
des Autopiloten**, und der startet bei jeder Codeaenderung neu. Der frei geraeumte Rechner war
ausserdem gar nicht noetig: der Rechner, auf dem der Verwalter gerade gestorben ist, haette
gereicht.

**Wie es richtig waere.** In der `kill`-Zeile den Speicher mitschreiben, etwa
`s.ramFree += investRam`. Eine Zeile.

**Sicherheit:** sehr sicher - Mechanismus im Quellcode nachgelesen, Wirkung im laufenden Bot im
Protokoll sichtbar.

---

## C3 (WICHTIG) - Der ausgleichende weaken bekommt weiterhin nur die Reste

```js
const gStarted = deploy(ns, workforce, "worker/grow.js", need, t.host);
const wNeed = Math.max(0, calc.weakenThreads((t.busy.grow + gStarted) * calc.GROW_FORTIFY_AMOUNT) - t.busy.weaken);
const wStarted = deploy(ns, workforce, "worker/weaken.js", wNeed, t.host);
```
(`autopilot.js:313-319`, gleiches Muster im hack-Zweig `:332-337`)

Die Mengen sind seit dem Umbau Differenzen statt Vollbestellungen - das entschaerft das Problem
erheblich, beseitigt es aber nicht. `deploy` schreibt `s.ramFree` sofort herunter (`:596`), der
zweite Aufruf bekommt nur, was der erste uebrig laesst. Und im grow-Zweig ist `need`
regelmaessig groesser als der freie Speicher: `growThreads` bemisst die Threads bis `moneyMax`,
und bei einem zu 4 % gefuellten Ziel sind das tausende.

**Live nachweisbar.** Der Bot fuehrt gerade 240 grow-Threads und 15 weaken-Threads. Der korrekte
Ausgleich fuer 240 grow-Threads sind `ceil(240 * 0.004 / 0.05) = 20`. Es fehlt ein Viertel - bei
einem Netz, das zu 95 % belegt ist und laut eigener Anzeige "3 Auftrag/Auftraege warten auf
Platz" meldet. Die Sicherheitsstufen passen dazu: sigma-cosmetics steht bei 10,00 gegen ein
Minimum von 3,00, foodnstuff bei 9,45 gegen 3,00.

**Die Faktoren selbst stimmen.** `SERVER_FORTIFY_AMOUNT = 0.002` und `SERVER_WEAKEN_AMOUNT =
0.05` decken sich mit `src/Server/data/Constants.ts:9-10`; hack erhoeht um `0.002 * threads`
(nur im Erfolgsfall), grow um `2 * 0.002 * usedCycles` (`src/Server/ServerHelpers.ts:211`). Ein
weaken je 25 hack-Threads und ein weaken je 12,5 grow-Threads sind damit korrekt hergeleitet.

**Ein zweiter, kleinerer Rechenfehler an derselben Stelle:** im grow-Zweig deckt `wNeed` nur den
eingehenden grow-Aufwuchs ab, nicht die bereits vorhandene Ueberschuss-Sicherheit von bis zu
`SEC_TOLERANCE = 3`. Die bleibt dauerhaft stehen, weil der weaken-Zweig erst oberhalb der
Toleranz greift.

**Wie es richtig waere.** Den Gesamtbedarf beider Auftragsarten VOR dem Verteilen bilden und den
freien Speicher im Verhaeltnis 12,5 zu 1 beziehungsweise 25 zu 1 aufteilen - dann schrumpfen
beide gemeinsam, statt dass einer alles bekommt.

**Sicherheit:** sicher.

---

## C4 (WICHTIG) - Das neue `try/catch` faengt auch `ScriptDeath`

```js
while (true) {
  round++;
  try {
    ...
    if (ns.read("autopilot.js") !== ownSource) {
      ...
      ns.exit();                    // :403
    }
  } catch (err) {                   // :405
    note("Fehler in Runde " + round + ": " + ...);
  }

  await ns.sleep(1000);             // :412 - AUSSERHALB des try
}
```

`ns.exit()` ist kein `return`:
```ts
exit: (ctx) => () => {
  helpers.log(ctx, () => "Exiting...");
  killWorkerScript(ctx.workerScript);
  throw new ScriptDeath(ctx.workerScript);
},
```
(`src/NetscriptFunctions.ts:761-765`)

Der geworfene `ScriptDeath` landet also im eigenen `catch` und wird verschluckt. Dass der
Autopilot sich trotzdem beendet, liegt einzig daran, dass `await ns.sleep(1000)` **ausserhalb**
des `try` steht: `killWorkerScript` hat `ws.env.stopFlag` gesetzt, und jeder weitere NS-Aufruf
laeuft in `checkEnvFlags` (`src/Netscript/NetscriptHelpers.tsx`) und wirft erneut - diesmal
ungefangen.

**Was daran gefaehrlich ist.** Der Mechanismus haelt aus Versehen. Zoege jemand das `sleep` in
den `try` - eine voellig naheliegende Aufraeumaktion -, saehe die Schleife so aus: NS-Aufruf
wirft `ScriptDeath`, `catch` verschluckt, naechste Runde, wirft sofort wieder. Ein `try/catch`
um eine `while(true)`-Schleife **ohne** funktionierendes `await` ist eine enge Endlosschleife
ohne Yield - der Spiel-Hauptthread steht, und das Spiel laesst sich nur ueber einen
Tab-Neustart retten. Denselben Effekt hat jeder externe `kill` des Autopiloten.

Nebenwirkung heute schon: die Notiz "Fehler in Runde N: NS instance has already been killed
(...)" wird bei jedem geplanten Neustart erzeugt. Sie erscheint nur nicht, weil `draw()` danach
nicht mehr laeuft.

**Wie es richtig waere.** Im `catch` `ScriptDeath` durchreichen:
`if (err?.name === "ScriptDeath") throw err;` - der Name ist ausdruecklich dafuer vorgesehen
(`src/Netscript/ScriptDeath.ts`, Kommentar: "users with error handling ... can more easily
detect this error type"). Und den Versionsvergleich samt `ns.exit()` besser ganz aus dem `try`
herausnehmen.

**Sicherheit:** sehr sicher.

---

## C5 (WICHTIG) - Zwei Kommentare derselben Datei widersprechen einander

`autopilot.js:42-47`:
> So viele Ziele gleichzeitig VORBEREITEN. Ein einziges laesst den Speicher brachliegen ...
> Acht dagegen verzetteln alles.
> `const PREP_TARGETS = 4;`

`autopilot.js:284-289`:
> Alle erntereifen Ziele bedienen ... Vorbereitet wird dagegen **immer nur EINES**. Sieben Ziele
> gleichzeitig aufzupaeppeln heisst, dass keines fertig wird: jedes bekommt ein Achtel des
> Speichers und braucht das Achtfache der Zeit ... Konzentration schlaegt Breite.
> `const naechstes = sortiert.filter((c) => !ready(c)).slice(0, PREP_TARGETS);`

Der zweite Kommentar argumentiert ueber sechs Zeilen fuer genau ein Vorbereitungsziel, und die
Codezeile direkt darunter nimmt vier. Der laufende Bot meldet dementsprechend "0 Ziel(e) werden
abgeschoepft, 4 vorbereitet" - und bei vier gleichzeitigen Vorbereitungen auf 500 GB Netz gilt
das Argument des Kommentars ("jedes bekommt ein Viertel und braucht das Vierfache der Zeit")
tatsaechlich. Es ist nicht zu erkennen, welche der beiden Aussagen die gewollte ist.

**Sicherheit:** sehr sicher.

---

## C6 (WICHTIG) - Abgewaehlte Ziele werden nicht gestoppt

`erntereif` und `naechstes` werden jede Runde neu gebildet (`autopilot.js:290-292`). Faellt ein
Ziel heraus, hoert der Bot einfach auf, es zu bedienen; die schon laufenden hack-Threads landen
aber noch ihren Schlag, und danach laesst niemand mehr nachwachsen.

Der Kommentar in `:144-148` begruendet ausdruecklich, warum beim START nicht aufgeraeumt wird -
fuer den laufenden Betrieb ist die Frage nie gestellt worden. Der Effekt verstaerkt sich selbst:
das zurueckgelassene Ziel hat danach wenig Geld und hohe Sicherheit, schneidet in `prepSeconds`
noch schlechter ab und kommt darum nicht zurueck in die Auswahl. Im laufenden Bot sind gerade 6
hack-Threads unterwegs, waehrend alle fuenf angezeigten Ziele im Vorbereitungszustand sind - die
gehoeren also zu einem Ziel, das niemand mehr betreut.

**Sicherheit:** sicher.

---

## C7 (WICHTIG) - Derselbe Rechenfehler in Doku und Code

`invest.js:97-101`:
> Node 1 hat sich nach 11 Minuten bezahlt, Node 8 kostet schon $74.166 fuer dieselben 1.50 $/s -
> und dasselbe Geld in Server-RAM sind rund 13 hack-Threads.

`formeln-wirtschaft.md:414-416`:
> - $74 166 in Hacknet-Node #8 → +1.5 $/s
> - $74 166 in Server-RAM → **1.34 GB**, d. h. rund **13** `hack()`-Threads.

Das Dokument rechnet die Gigabyte selbst korrekt aus und zieht dann die falsche Folgerung.
`BaseCostFor1GBOfRamServer: 55000` (`src/Server/data/Constants.ts:4`), unterhalb von 64 GB
greift der Softcap nicht (`upg = max(0, log2(ram) - 6)`, `src/Server/ServerPurchases.ts:34`).
$74.166 / $55.000 = 1,349 GB. Ein hack-Arbeiter kostet 1,70 GB (1,60 Grundlast + 0,10 fuer
`hack`). Das sind **0,79 Threads**, nicht 13.

Die uebrigen Zahlen der Passage stimmen: `calculateNodeCost(n) = 1000 * 1.85^(n-1)`
(`src/Hacknet/formulas/HacknetNodes.ts:87-92`) ergibt $1.000 fuer Node 1 (→ 667 s = 11,1 min bei
1,50 $/s) und $74.166 fuer Node 8; ein neuer Node produziert
`1 * 1.5 * 1.035^0 * (1+5)/6 = 1,50 $/s` (`:4-11`).

**Warum das zaehlt.** Auf dieser Zahl steht die Begruendung fuer die harte Hacknet-Regel in
`invest.js`. Richtig gerechnet faellt der Vergleich **freundlicher** fuer Hacknet aus, nicht
strenger. Die Regel mag trotzdem gut sein - aber wer sie spaeter nachjustiert, rechnet auf einer
kaputten Grundlage weiter. Und weil der Fehler in beiden Dateien steht, faellt er beim
Gegenlesen nicht auf.

**Sicherheit:** sehr sicher.

---

## C8 (WICHTIG) - Der Autopilot sitzt bei 7,15 von 8 GB

Aufsummiert aus `src/Netscript/RamCostGenerator.ts` ueber die tatsaechlich benutzten Funktionen:

| Posten | GB |
|---|---|
| Grundlast | 1,60 |
| `exec` | 1,30 |
| `scp` | 0,60 |
| `getPlayer` | 0,50 |
| `kill` | 0,50 |
| `killall` | 0,50 |
| `ls` + `ps` + `scan` | 0,60 |
| acht `getServer*`-Abfragen | 0,70 |
| `getServerMaxRam` + `getServerUsedRam` + `hasRootAccess` | 0,15 |
| fuenf Portknacker + `nuke` | 0,30 |
| `getScriptRam` + `fileExists` + `getTotalScriptIncome` + `getTotalScriptExpGain` | 0,40 |
| `ns.ui.*`, `read`, `write`, `print`, `clearLog`, `disableLog`, `sleep`, `exit`, `heart.break` | 0,00 |
| **Summe** | **7,15** |

Auf dem Start-home mit 8 GB bleiben 0,85 GB. Fuegt jemand `ns.getServer` (2 GB),
`ns.hackAnalyze` (1 GB) oder auch nur `ns.getRunningScript` (0,3 GB) hinzu, passt der Autopilot
nicht mehr auf home - und dann kann ihn auch invest.js nicht mehr starten:
`ns.exec("autopilot.js", "home")` gibt einfach 0 zurueck, und `invest.js:48` wertet das nicht
aus. Der Bot waere ohne sichtbare Fehlermeldung tot.

`HOME_RESERVE` steht inzwischen richtig auf 2 (der Kommentar in `:31-33` benennt den frueheren
Doppelzaehl-Fehler ausdruecklich). Damit ist `ramFree` auf home `max(0, 8 - 7,15 - 2) = 0` -
home traegt heute also ohnehin keine Arbeiter, obwohl es wegen seiner mehreren Kerne
(`coreBonus = 1 + (cores-1)/16`, `src/Server/ServerHelpers.ts:287`) fuer grow und weaken der
wertvollste Rechner im Netz waere.

**Wie es richtig waere.** Den Speicherbedarf als Pruefpunkt festhalten - die Bruecke kann ihn
ueber die RFA-Methode `calculateRam` jederzeit abfragen
(`src/RemoteFileAPI/MessageHandlers.ts:193`) - und in `invest.js:48` den Rueckgabewert von
`ns.exec` protokollieren.

**Sicherheit:** sicher (Handrechnung; die Summe kann um 0,05 GB abweichen, die Enge nicht).

---

## C9 bis C22 - Kleinigkeiten im Code

**C9 - `growThreads`-Rundung** (`calc.js:169-176`). Das Original
(`src/Server/ServerHelpers.ts:177-198`) prueft den Abwaertsschritt nur im Grenzfall
(`ccycle - x > 0.999999`) und kennt einen Schnellweg ueber `|diff|`. Unsere Fassung prueft immer
abwaerts. Mathematisch nie zu wenig - wir dekrementieren nur, wenn
`(o+t-1)*exp(k*(t-1)) >= n` wirklich gilt -, aber das Ergebnis kann um einen Thread von
`ns.formulas.hacking.growThreads` abweichen. Alles davor ist identisch: Eingabeklemmung,
Startwert `(n-o)/(1 + (n/16 + 15o/16)*k)`, Iterationsschritt `(x - ox*log(ox/n))/(1 + ox*k)`,
Abbruch bei `|diff| <= 1`.

**C10 - `weakenThreads`** (`calc.js:185-188`). Das Original hat einen Faktor mehr:
`ServerWeakenAmount * threads * coreBonus * currentNodeMults.ServerWeakenRate`
(`src/Server/ServerHelpers.ts:292-295`). In BN1 ist der 1, aber anders als `hackChance`,
`hackPercent` und `hackTime` hat diese Funktion nicht einmal einen Parameter dafuer - beim
BitNode-Wechsel faellt es nicht auf. Ausserdem rechnen alle vier Aufrufstellen mit `cores = 1`,
obwohl fremde Server per `cpuCores = getRandomIntInclusive(ceil(layer/2), layer)`
(`src/Server/ServerHelpers.ts:376`) durchaus mehrere Kerne haben. Der Bedarf wird dadurch zu
hoch angesetzt - ungefaehrliche Richtung, kostet aber Threads.

**C11 - der Faktor 400** (`calc.js:215`).
`growCost = 1 / Math.max(0.05, growthLogPerThread(...) * 400)` hat keine Entsprechung im
Spielcode. Als Naeherung gekennzeichnet und nicht falsch, aber niemand kann sagen, warum 400 und
nicht 200 oder 800. Bei `serverGrowth = 50` teilt er den Ertrag durch 2,4, bei
`serverGrowth = 5` durch 15,3 - ein starker Hebel fuer eine frei gewaehlte Zahl.

**C12 - `expPerThread` ist toter Code** (`calc.js:105-108`). Bildet `calculateHackingExpGain`
korrekt nach (`3 + 0.3 * baseDifficulty`, mal `mults.hacking_exp`, mal `HackExpGain`,
`src/Hacking.ts:30-38`), wird aber nirgends gerufen, und `playerFacts` liefert gar kein
`multExp`. Fuer die Fruehphase waere die Erfahrungsausbeute ein sinnvolles zweites
Bewertungskriterium - der Baustein liegt fertig da und ist nicht angeschlossen.

**C13 - `tryCrack` zaehlt blind** (`autopilot.js:548-556`).
`try { fn(host); open++ } catch { open++ }` - die Portknacker werfen gar nicht, sie geben
`false` zurueck, wenn das Programm fehlt (`src/NetscriptFunctions.ts:549-563`). Da `fileExists`
vorher prueft, stimmt das Ergebnis; die Konstruktion verdeckt aber echte Ausnahmen (etwa auf
einem Hacknet-Server). Der `nuke`-Teil ist inzwischen richtig (`return ns.nuke(host) !== false`),
und die Level-Pruefung ist mit einer korrekten Quellenangabe entfernt worden.

**C14 - `additionalMsec` ist immer 0** (`worker/hack.js:9-11`, `autopilot.js:594`). Der
Kommentar im Arbeiter erklaert, warum die Verzoegerung INNERHALB der Aktion liegt ("nur so ist
der Landezeitpunkt exakt") - `deploy` uebergibt an dieser Stelle die feste 0. Es gibt keinerlei
Landezeitsteuerung. Der Mechanismus stimmt (`validateHGWOptions` addiert `additionalMsec/1000`),
er wird nur nicht benutzt.

**C15 - "Verdient" mischt** (`autopilot.js:362`). `ns.getServerMoneyAvailable("home")` liefert
das Spielerguthaben (Sonderfall in `src/NetscriptFunctions.ts:991-995`), und invest.js kauft
davon Server und Nodes. Nach jedem Kauf steht in der goldenen Zahl ein Minus.

**C16 - `writeBrain`-Platzhalter** (`autopilot.js:632-641`). `backdoored: 0` und `threads: 0`
sind fest verdrahtet, `action` bekommt nur `v.target`. Der Autopilot weiss ueber `t.doing` und
`c.busy` genau, was jedes Ziel tut - das Dashboard erfaehrt es nicht.

**C17 - tote Selbstaktualisierung in invest.js** (`invest.js:28-32`, `:85-88`).
`ns.read("invest.js")` liest vom AUSFUEHRENDEN Rechner
(`src/NetscriptFunctions.ts:1120-1139`: `const server = ctx.workerScript.getServer()`), nicht
von home - der Vergleich vergleicht die lokale Kopie mit sich selbst und schlaegt nie an. Der
Autopilot loest das inzwischen richtig, indem er den Verwalter in Runde 1 abschiesst und den
Grund im Kommentar (`autopilot.js:159-162`) korrekt benennt. In `invest.js` steht der alte
Mechanismus samt Kommentar aber noch, und der Kommentar behauptet weiterhin, er funktioniere.

**C18 - Hacknet-Zugewinn ohne Multiplikatoren** (`invest.js:131`).
`1.5 * Math.pow(1.035, node.ram - 1) * ((node.cores + 5) / 6)` gegen das Original
`levelMult * ramMult * coresMult * mult * currentNodeMults.HacknetNodeMoney`
(`src/Hacknet/formulas/HacknetNodes.ts:4-11`). Ohne Hacknet-Augmentierungen in BN1 identisch,
mit ihnen zu pessimistisch.

**C19 - `telemetry.js` ist verwaist** (`telemetry.js:17`, `:43`). Schreibt nach
`data/telemetry.txt` - genau die Datei, die `writeBrain` (`autopilot.js:643`) jede Sekunde
ueberschreibt und die die Bruecke abholt (`bridge.js:31`, `:224`). Liefen beide, wuerden sie
sich gegenseitig ueberschreiben. Ausserdem liest sie `data/brain.txt`, das im ganzen Projekt
niemand schreibt. Gestartet wird sie von nichts, ins Spiel geschoben aber weiterhin
(`bridge.js:135-157` nimmt alles unter `src/`).

**C20 - `purchasedCount` zaehlt home mit** (`bridge.js:255`). Im Spiel ist
`home.purchasedByPlayer === true` - `src/Server/ServerHelpers.ts:297-303` weist ausdruecklich
darauf hin. Das Dashboard zeigt darum gerade 26 gekaufte Server, obwohl das Limit 25 ist
(`ServerConstants.CloudServerLimit`). Wer danach entscheidet, ob noch ein Platz frei ist, irrt.

**C21 - Einzelschuss-Uebertragung** (`bridge.js:185-214`). Je Dateiname 150 ms entprellt, dann
einzeln geschoben. Wer `autopilot.js` und `lib/calc.js` zusammen aendert, riskiert, dass sich
der Autopilot (Pruefung einmal pro Sekunde, `:399`) beendet, bevor die neue `calc.js` da ist -
und mit der alten Formelbibliothek wieder hochkommt. Heilt sich beim naechsten Neustart, ist
aber genau die Art Wackelkontakt, die eine Messreihe unbrauchbar macht.

**C22 - offene Bindung** (`bridge.js:343`, `:354`). `WebSocketServer({ port })` und
`server.listen(port)` binden auf 0.0.0.0. `/api/rpc` (`:306-326`) reicht beliebige RFA-Methoden
durch, darunter `getSaveFile` und `deleteFile` (`src/RemoteFileAPI/MessageHandlers.ts:135`,
`:223`). `listen(PORT, "127.0.0.1")` kostet nichts.

---

# Teil B - Dokumentation

Die Formelsammlungen sind ueberwiegend sehr genau (siehe "Wo ich nichts gefunden habe"). Was
standhaelt:

## D1 (KRITISCH) - `strategie.md` empfiehlt entfernte Funktionen

`strategie.md:144`, in der Tabelle "Skriptpruefbar":
> `| Boersenzugang | ns.stock.hasWSEAccount() / has4SDataTIXAPI() | — |`

Beide Namen sind seit 3.0.0 weg (`src/NetscriptFunctions/StockMarket.ts:348-352`):
```ts
setRemovedFunctions(stockFunctions, {
  hasWSEAccount:   { version: "3.0.0", replacement: "stock.hasWseAccount()" },
  hasTIXAPIAccess: { version: "3.0.0", replacement: "stock.hasTixApiAccess()" },
  has4SDataTIXAPI: { version: "3.0.0", replacement: "stock.has4SDataTixApi()" },
});
```
Richtig sind `hasWseAccount()`, `hasTixApiAccess()`, `has4SData()`, `has4SDataTixApi()`.

Das ist die schwerste Art von Doku-Fehler, die dieses Projekt haben kann: Genau dieser
Fehlertyp - `REMOVED FUNCTION ERROR` durch eine 2.x-Schreibweise - hat am selben Tag
`api-aenderungen-v3.md` ueberhaupt erst ausgeloest. **`strategie.md:687` schreibt dieselben vier
Felder korrekt.** Dasselbe Dokument widerspricht sich also selbst.

## D5 (WICHTIG) - Die Ursache dafuer steht in `api-aenderungen-v3.md:52-54`

> Weitere Streichungen gibt es in den Unter-APIs `corporation`, `gang`, `singularity` und
> `formulas.work` - jeweils per `setRemovedFunctions` in der zugehoerigen Datei.

`setRemovedFunctions` steht darueber hinaus in `src/NetscriptFunctions/StockMarket.ts:348`
(drei 3.0.0-Streichungen) und in `src/NetscriptFunctions/Sleeve.ts:337` (`getSleeveStats`,
`getInformation`, 2.2.0). Ausgerechnet `stock` fehlt - und ausgerechnet dort ist D1 entstanden.
Wer die Liste als vollstaendig liest, prueft `ns.stock.*` gar nicht erst nach.

## D2 (WICHTIG) - Der Heim-RAM-Kreuzungspunkt in `formeln-wirtschaft.md:135`

> ab ca. 64 GB Heim-RAM ist gekauftes RAM billiger pro GB

Der Grenzpreis fuer Heim-RAM ist `32.000 * ram^0,6601`
(`src/PersonObjects/Player/PlayerObjectServerMethods.ts:30-40`); er erreicht die $55.000 des
gekauften RAM bei ram ≈ **2,27 GB**, also unterhalb des Startwerts von 8 GB. Gekauftes RAM ist
ab dem allerersten Upgrade billiger, nicht erst ab 64 GB.

Das Dokument widerlegt sich zwei Zeilen spaeter selbst (`:137`: "Ab dem Sprung 64→128 GB ist
gekauftes RAM also rund 9x guenstiger" - Faktor 9 heisst, der Kreuzungspunkt lag laengst
dahinter), und `strategie.md:422-425` benennt den Fehler bereits ausdruecklich und rechnet 2,3
GB vor. Zu korrigieren ist `formeln-wirtschaft.md`, nicht `strategie.md`.

## D3 (WICHTIG) - Hacknet-Abbruchpunkt in `formeln-wirtschaft.md:412`

> ... das ist bis ungefaehr **Node 6-7** der Fall ($21 670 bzw. $74 166)

Drei Fehler in einem Satz. `calculateNodeCost(n) = 1000 * 1.85^(n-1)`
(`src/Hacknet/formulas/HacknetNodes.ts:87-92`):
- Node 6 = $21.670 (stimmt), **Node 7 = $40.089**. $74.166 ist Node **8** - was dasselbe
  Dokument zwei Zeilen weiter (`:414`) und in seiner Tabelle (`:233`) selbst so schreibt.
- Eine Stunde Rueckzahldauer bei 1,50 $/s bedeutet $5.400, also hoechstens **Node 4** ($6.331 →
  1,17 h).
- Die eigene Tabelle (`:232-233`) nennt fuer Node 5 bereits 2,2 h und fuer Node 8 13,7 h.

`invest.js` setzt die Regel uebrigens richtig um (`AMORTISATION_MAX = 3600` gegen den
tatsaechlichen Preis, was bei Node 4 abbricht) - der Code ist hier besser als die Doku.

## D4 (WICHTIG) - 4S-Amortisation in `formeln-wirtschaft.md:628`

> Bei einer Kapitalbasis von $1 Mrd ... sind das $300M/h - die $26 Mrd sind in unter vier
> Stunden drin.

4 h × $300M = $1,2 Mrd, nicht $26 Mrd. Selbst mit Zinseszins (1,3x/h ab $1 Mrd) braucht man
`ln(27)/ln(1,3)` ≈ **12,6 Stunden**. `strategie.md:772-774` weist den Fehler bereits nach;
`formeln-wirtschaft.md` ist unkorrigiert geblieben.

## D6 (WICHTIG) - Falsche `isTrusted`-Zuordnung in `oberflaeche.md:40`

Dort steht "`Locations/ui/CompanyLocation.tsx:62, 71` | Job annehmen / arbeiten". Im Code ist
`:62` der Anfang von `startInfiltration` (Infiltrate Company) und `:71` der von `work`; die
Job-**Bewerbung** ist ueberhaupt nicht `isTrusted`-geschuetzt. `strategie.md:830` (":62
Infiltrate Company") und `:838` ("Nicht geschuetzt: ... Job-Bewerbung") haben es richtig.

Das ist praktisch relevant: `oberflaeche.md` ist die Anleitung dafuer, was ein Agent per Browser
klicken kann. Wer glaubt, die Bewerbung sei gesperrt, laesst einen offenen Weg liegen.

## D7 (WICHTIG) - Reset-Beschleunigungstabelle, Spalte L=2500 (`strategie.md:623-629`)

Faktor = `exp(L/32 * (1 - 1/m))`. Die Spalten L=500 und L=1000 stimmen exakt, L=2500 nicht:

| m | Doku | nachgerechnet |
|---|---|---|
| 1,20 | 6,3e5x | 4,5e5x |
| 1,30 | 2,5e8x | 6,8e7x |
| 1,50 | 3,1e11x | 2,0e11x |
| 2,00 | 3,5e16x | 9,2e16x (Doku zu **niedrig**) |

Die qualitative Aussage haelt, die Zahlen nicht - und dass der Fehler in beide Richtungen geht,
schliesst einen systematischen Rundungsgrund aus.

## D8 - Sammelposten Kleinigkeiten in der Doku

Rechnerisch:
- `formeln-wirtschaft.md:270` - "12 Maximalnodes bei ~$5,7 Mrd": mit dem eigenen Vollausbaupreis
  sind es $4,90 Mrd. Der Fehler ist nach `strategie.md:1099` durchgereicht.
- `formeln-wirtschaft.md:748` - "heist, sobald die Stats ueber ~350 liegen": aus den eigenen
  Zahlen liegt die Kreuzung bei X ≈ 219, und die eigene Tabelle `:728-729` zeigt das schon.
- `formeln-progression.md:856`, `strategie.md:589` und `:1121` - "bei acht Augs kostet die letzte
  das 170-fache": Off-by-one, bei acht Augs ist k=7 → 89,4x. 169,84x ist die neunte (steht so in
  `formeln-progression.md:166`).
- `strategie.md:345` - `e^((5000/6+200)/32)` ist 1,06e14, nicht 1,6e14.
- `formeln-progression.md:91` - "`hacking: 1.2` ist ungefaehr `hacking_exp` mal 1000": gilt erst
  ab Level ~1100; bei Level 500 entspricht es Faktor 22,8.
- `strategie.md:902` - Ishima verlangt $30 Mio, nicht $20 Mio (`FactionInfo.tsx:521`).
  `formeln-progression.md:611` hat es richtig.
- `oberflaeche.md:319` - das Knopfbeispiel nennt "$1.032m"; `getUpgradeHomeRamCost` bei 8 GB
  ergibt $1.009.744. `formeln-wirtschaft.md:123` und `strategie.md:413` haben es richtig.

Sachlich:
- `strategie.md:706`/`:1132` - `initStockMarket()` wird in `prestigeAugmentation` NICHT
  unbedingt gerufen, sondern in `if (canAccessStockMarket())` (`src/Prestige.ts:170-172`). Die
  praktische Folgerung (vor dem Install verkaufen) bleibt richtig.
- `strategie.md:3` - "18 von 80 Servern gerootet": die statische Liste hat 70 Eintraege.
  Vermutlich eine Live-Zaehlung inklusive home, darkweb und gekaufter Server - das gehoert
  dazugeschrieben, sonst liest es sich als Widerspruch zu `bitnode-und-server.md`.

Zeilendrift (Sachaussage jeweils richtig, Anker daneben): `strategie.md:1206-1208` (SF15-Zweig
ist `:100-102`, nicht `:97-99`), `formeln-progression.md:338` (Red-Pill-Verknuepfung `:174-182`,
nicht `:172-180` - `bitnode-und-server.md:528` und `strategie.md:377` haben es richtig),
`rfa-protokoll.md:363`/`:504` (`Remote.ts:128`, nicht `:129`), `bitnode-und-server.md:178`
(`BitNode.tsx:1129`, nicht `:1126`), `bitnode-und-server.md:886` (`servers.ts:54`, nicht `:63`),
`bitnode-und-server.md:922-925` (vier Anker um 1-4 Zeilen verrutscht).

Konvention: `formeln-hacking.md:1068ff` verankert Servereintraege auf der `hostname:`-Zeile,
`bitnode-und-server.md:1040ff` auf der oeffnenden Klammer. Beides trifft denselben Eintrag, aber
"The-Cave :1518" gegen ":1520" sieht wie ein Widerspruch aus.

---

# Wo ich nichts gefunden habe

Damit klar ist, was ueberhaupt angesehen wurde.

## `lib/calc.js` - jede Formel Zeile fuer Zeile gegen den Quellcode gelegt

- `intBonus` (`:31`) - identisch mit `calculateIntelligenceBonus`
  (`src/PersonObjects/formulas/intelligence.ts:1`); Gewicht 1 ist im gesamten Hacking-System
  korrekt, der `?? 0`-Schutz eine sinnvolle Ergaenzung.
- `coreBonus` (`:40`) - identisch mit `getCoreBonus` (`src/Server/ServerHelpers.ts:287`).
- `hackChance` (`:52`) - vollstaendig identisch mit `calculateHackingChance`
  (`src/Hacking.ts:9-24`): beide Abbruchbedingungen (`!hasAdminRights`, `hackDifficulty >= 100`),
  `clampNumber(1.75 * skill, 1)` als `Math.max(..., 1)`, Klemmung auf [0,1]. Ein BitNode-Faktor
  gehoert hier korrekterweise **nicht** hinein.
- `hackPercent` (`:69`) - identisch mit `calculatePercentMoneyHacked` (`src/Hacking.ts:44-57`),
  einschliesslich `balanceFactor = 240` und `skillMult = (skill - (reqSkill - 1)) / skill`. Kein
  Intelligence-Bonus - korrekt, den gibt es hier wirklich nicht.
- `hackTime` (`:84`) - identisch mit `calculateHackingTime` (`src/Hacking.ts:60-80`), Ergebnis in
  Sekunden wie im Original.
- `GROW_TIME_FACTOR = 3.2`, `WEAKEN_TIME_FACTOR = 4` (`:24-25`) - `src/Hacking.ts:84`, `:91`.
- Alle vier Konstanten in `:14-17` stimmen mit `src/Server/data/Constants.ts:7-10`.
  `SERVER_MAX_GROWTH_LOG = 0.00349388925425578` ist wirklich `log1p(0.0035)`, und die
  Kommentarbehauptung "der Deckel greift ab sec <= 8.5714" ist nachgerechnet richtig
  (`0.03 / 0.0035 = 8,5714`).
- `GROW_FORTIFY_AMOUNT = 2 * SERVER_FORTIFY_AMOUNT` (`:20`) - `src/Server/ServerHelpers.ts:211`
  und `src/NetscriptFunctions.ts:340`.
- `growthLogPerThread` (`:120`) - identisch mit `calculateServerGrowthLog`
  (`src/Server/formulas/grow.ts:8-29`) fuer `threads = 1`, einschliesslich `-Infinity` bei
  `serverGrowth = 0`, `log1p`, Deckel und Faktorenreihenfolge.
- `growThreads` (`:147`) - Newton-Raphson identisch bis auf die Rundung (C9).
- `expPerThread` (`:105`) - formal korrekt (nur ungenutzt, C12).

## Autopilot-Logik, ausdruecklich geprueft und fuer richtig befunden

- **Die Buchhaltung ueber laufende Auftraege ist inzwischen richtig** und war der schwerste
  Befund der ersten Fassung. `busy`/`busyPerTarget` wird VOR der Verteilung aus `ns.ps` gebildet
  (`:238-255`), und alle drei Zweige bestellen nur die Differenz
  (`need = Vollbedarf - t.busy.X`). Beim Ernten ergibt das sogar ein sauberes
  Fliessgleichgewicht: es steht dauerhaft ein Vorrat von `floor(HACK_FRACTION/perThread)`
  hack-Threads in der Luft, die mit `voll/hackTime` Threads je Sekunde landen - macht
  `HACK_FRACTION` je `hackTime`, also genau die beabsichtigte Abschoepfungsrate.
- Beim grow ist das Abziehen von `t.busy.grow` **exakt** richtig und nicht nur ungefaehr: der
  Wachstumsexponent `k` je Thread haengt nicht vom Guthaben ab, die noetige Threadzahl ist also
  in Logarithmen additiv.
- Die Arbeiter werden in Runde 1 stumpf neu ausgeliefert (`:136-141`) - das schliesst die
  Luecke, dass geaenderter Arbeitercode die Flotte nie erreicht. Der Kommentar `:126-132`
  begruendet es richtig, auch die Feststellung, dass `ns.read` keinen Host-Parameter hat.
- `tryCrack` verzichtet inzwischen korrekt auf die Hacking-Level-Pruefung und begruendet das mit
  der richtigen Quelle: `ns.nuke` prueft nur NUKE.exe und offene Anschluesse
  (`src/NetscriptFunctions.ts:531-548`), `netscriptCanGrow`/`netscriptCanWeaken` nur Root
  (`src/Hacking/netscriptCanHack.ts:49-55`). Der Rueckgabewert von `ns.nuke` wird ausgewertet.
- Die frueher vorhandene `for (let pid = 1; pid < ns.pid; pid++) ns.ui.closeTail(pid)`-Schleife
  ist verschwunden. Sie war wirkungslos (`closeTail` greift bei toten Skripten nicht,
  `src/NetscriptFunctions/UserInterface.ts:69-80` - genau wie `api-aenderungen-v3.md:58` es
  bereits festhielt) und waere mit der Sitzungsdauer gewachsen.
- Die Speicherbuchhaltung innerhalb einer Runde ist sauber: `s.ramFree` wird bei jedem
  erfolgreichen `exec` heruntergeschrieben und zu Rundenbeginn aus `ns.getServerUsedRam` neu
  gebildet. Arbeiter aus frueheren Runden sind korrekt eingerechnet, es gibt keine
  Doppelvergabe. Einzige Ausnahme: C2.
- **Fragmentierung ist kein Fehler.** `deploy` (`:588-601`) laeuft absteigend ueber ALLE Rechner
  und ueberspringt nur, wo kein ganzer Thread mehr passt. Reste unter 1,75 GB sind physikalisch
  unbrauchbar, und die Anzeige benennt den Zustand korrekt ("in zu kleinen Resten verteilt").
  Dass grosse Rechner zuerst gefuellt werden, ist hier zusaetzlich richtig: eine ueber viele
  Rechner verstreute Erntewelle wirkt multiplikativ statt additiv
  (`moneyDrained = moneyAvailable * percentHacked * threads` je einzelnem `ns.hack`-Aufruf) und
  schoepft dadurch weniger ab als beabsichtigt.
- Die Rangfolge `score / rest` fuer noch nicht erntereife Ziele (`:277-283`) ist konzeptionell
  richtig: Ertrag je investiertem Thread statt Ertrag allein.
- Der Selbstbeendigungsweg schliesst das eigene Fenster VOR `ns.exit()` - in dieser Reihenfolge,
  weil `closeTail` auf tote Skripte nicht mehr wirkt.
- `invest.js` gibt nie das ganze Guthaben aus (`PUFFER = 2`, Hacknet `PUFFER = 4`), und die
  Annahme "Aufruesten kostet nur die Differenz" ist korrekt:
  `getCloudServerUpgradeCost = getCloudServerCost(neu) - getCloudServerCost(alt)`
  (`src/Server/ServerPurchases.ts:53`).

## NS-Schnittstelle - jeder Aufruf gegen v3.0.1 geprueft

- Kein einziger Aufruf aus `setRemovedFunctions` (`src/NetscriptFunctions.ts:1531-1613`) ist im
  Code uebrig. Die `grep`-Treffer auf `ns.purchaseServer` und `ns.getServer` stehen samt und
  sonders in Kommentaren.
- `ns.cloud` ist in `invest.js` vollstaendig und mit richtigen Signaturen umgesetzt:
  `getServerNames()`, `getServerLimit()`, `getRamLimit()`, `getServerCost(ram)`,
  `purchaseServer(hostname, ram)` (gibt `""` bei Misserfolg - wird geprueft),
  `getServerUpgradeCost(host, ram)` (gibt `-1` bei Fehler - wird geprueft),
  `upgradeServer(host, ram)` (`boolean`). Gegen `src/NetscriptFunctions/Cloud.ts` geprueft.
- `ns.ui.*` inklusive des neuen `setTailMinimized` existieren mit den benutzten Signaturen
  (`src/NetscriptFunctions/UserInterface.ts:16-119`) und kosten alle 0 GB.
- `ns.scp(files, destination, source)`, `ns.exec(script, host, threads, ...args)`,
  `ns.kill(pid)`, `ns.killall(host)`, `ns.ps(host)`, `ns.heart.break()` - alle vorhanden, alle
  mit passender Signatur. `preventDuplicates` ist standardmaessig aus
  (`src/NetscriptWorker.ts:328`), das eindeutige dritte `exec`-Argument ist also unnoetig, aber
  harmlos.
- `ns.getPlayer()` liefert `skills` und `mults` wie angenommen; `skills.intelligence` kann
  fehlen, `?? 0` faengt das.
- `import * as calc from "lib/calc"` ohne Endung funktioniert: die Modulaufloesung haengt die
  Endung des importierenden Skripts an (`src/utils/ScriptTransformer.ts:129-153`).
- `ns.scan` liefert keine Darknet-Server (`src/NetscriptFunctions.ts:184`), und `darkweb` ist in
  v3.0.1 selbst ein `DarknetServer`. Der frueher uebliche Absturz auf `darkweb` kann hier also
  nicht auftreten. Hacknet-**Server** (BN9) wuerden dagegen weiterhin durch
  `helpers.getNormalServer` fliegen - das faengt jetzt aber das `try/catch` ab.
- **RAM nachgerechnet:** `autopilot.js` ~7,15 GB, `invest.js` ~10,75 GB (davon 3,50 GB fuer
  sieben hacknet-Funktionen und 2,25 GB fuer `cloud.purchaseServer`), `telemetry.js` 2,75 GB,
  `scan.js` 2,65 GB, Arbeiter 1,70 / 1,75 / 1,75 GB. Die Angaben in den Kopfkommentaren der
  Arbeiter stimmen alle. Die Behauptung in `scan.js:9-10` ("Einzelabfragen kosten 0,85 GB statt
  2 GB fuer `ns.getServer`") stimmt exakt: `getServer: 2` steht in `RamCostGenerator.ts:608`,
  und die zehn Einzelabfragen summieren sich auf genau 0,85 GB. Dass `invest.js` mit 10,75 GB
  einen 16-GB-Rechner braucht, ist mit `foodnstuff` (16 GB, 0 Anschluesse,
  `requiredHackingSkill` 1) ab der ersten Minute erfuellbar.

## Bruecke

Protokollrahmen (`jsonrpc`, `id`, `method`, `params`), die benutzten Methoden `pushFile`,
`getFile`, `getAllServers` und deren Antwortformen decken sich mit
`src/RemoteFileAPI/MessageHandlers.ts`. Zeitueberschreitungen werden aufgeraeumt, das Protokoll
ist gedeckelt, der Wechsel auf eine zweite Spielverbindung ist richtig behandelt (die alte
`close`-Behandlung setzt den Zustand nicht faelschlich zurueck), und der Pfaddurchgriff im
Dashboard-Server ist wirksam abgesichert.

## Dokumentation - was nachgeprueft und bestaetigt wurde

Der weit ueberwiegende Teil ist exakt. Ausdruecklich nachgeschlagen und bestaetigt:

- **`api-aenderungen-v3.md`**: alle 21 Eintraege von `setRemovedFunctions(ns, {...})`
  (`src/NetscriptFunctions.ts:1531-1613`) stimmen wortgenau, inklusive Zeilenangabe und
  Ersatznamen. Einzige Luecke ist D5.
- **`formeln-hacking.md`**: saemtliche Konstanten und Zeilen in `src/Hacking.ts`; die
  `ServerConstants` byte-genau; `grow.ts` inklusive des additiven `+threads`; die komplette
  RAM-Kostentabelle; `getWeakenEffect`, `getCoreBonus`, `numCycleForGrowth*`,
  `processSingleServerGrowth`; die Formulas-API-Tabelle mit allen zehn Hacking-Funktionen; der
  Serverauszug.
- **`formeln-progression.md`**: Skill-/Exp-Formeln inklusive der kompletten nachgerechneten
  Exp-Tabelle; `favorToRep`/`repToFavor` inklusive `log1point02` und `MaxFavor = 35331`;
  `getAugCost` mit NFG- und SoA-Sonderpfad; die NFG-Tabelle; alle stichprobenartig geprueften
  Augmentation-Zeilennummern und -Werte; Spendenformel; Reset-Geld $1.262.
- **`formeln-wirtschaft.md`** (ausser D2, D3, D4 und den Sammelposten): Serverpreistabelle;
  Heim-RAM- und Kern-Kostentabellen; alle Hacknet-Konstanten und -Formeln; Hash-Upgrade-Preise;
  saemtliche Stock-Konstanten inklusive 45-Prozent-Zyklus und Volatilitaetstabelle; die
  komplette Verbrechenstabelle mit allen zwoelf Eintraegen; Sleeve-, Gang-, Corporation- und
  Bladeburner-Konstanten; die DarkNet-Formeln inklusive der Intelligenz-Multiplikation.
- **`bitnode-und-server.md`**: die vollstaendige BN1-Multiplikatorliste - alle 54 Felder mit
  richtigen Zeilennummern, inklusive der beiden Abweichler `DaedalusAugsRequirement = 30` und
  `StaneksGiftExtraSize = 0`; alle 15 `case n:`-Zeilen; die 64 Singularity-RAM-Eintraege mit
  jeder einzelnen Zeilennummer; SF1/SF4/SF5/SF9/SF10 inklusive der Feinheit
  `decMult = 1/incMult` gegen `1 - mult/100`; Serverzahl 70, davon 7 ohne Geld.
- **`rfa-protokoll.md`**: alle elf Methoden mit Zeilenbereichen, die Settings-Zeilen, die
  Dateiendungslisten, die `handleMessageEvent`-Logik.
- **`oberflaeche.md`** (ausser D6 und dem Preisbeispiel): alle `isTrusted`-Fundstellen
  vollstaendig, alle acht TechVendor mit RAM-Spannen, die Knopftexte und Sperrbedingungen, die
  Darkweb-Preisliste.
- **`strategie.md`** (ausser D1, D7 und den Sammelposten): alle Programm-Level; die
  `CreateProgramWork`-Zeitformel; alle Rep-Schwellen; die Multiplikatorprodukte; die
  Daedalus-Rep-Tabelle; der CyberSec-Kaufreihenfolgevergleich; `maxDif = 2*totalSFs+1`; alle
  Serverleiter-Preise.

## Nicht geprueft

`dashboard/index.html` und `tools/ui.js` (Oberflaechen-Fahrplaene, kein NS-Code) sowie die
Vollstaendigkeit der Formelsammlungen - dort wurde stichprobenartig, aber breit geprueft, nicht
erschoepfend.
