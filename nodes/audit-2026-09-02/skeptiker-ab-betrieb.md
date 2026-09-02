# Skeptiker B1-B4: Fehlermodi im unbeaufsichtigten Betrieb

Stand 02.09.2026, 18:18-18:40. Gelesen: git diff (uncommitted, Stand 18:27 -
bn4net.js und blade.js wurden waehrend der Pruefung noch veraendert), bn4net.js
(Rundenaufbau 2593-2680, Starter 2740-2960, Auftragsblock, Werkbankwahl),
blade.js (Hauptschleife 2933-3473, meldeLage 1234-1330), sleeve.js, bbtrain.js,
boot.js, bn4life.js, ausgang.js (komplett), tools/wache.js (Neustartlogik),
Spielquellcode (ServerPurchases.ts, killWorkerScript.ts, Person.ts,
PlayerObjectGeneralMethods.ts, Singularity.ts), Live-Telemetrie ueber die
Bruecke (18:28) und data/bn4net-log.txt (18:18 und 18:28).

Hoechste Schwere zuerst.

---

### 1. bn4life.js kopiert seine Telemetrie nie nach home - B1 killt es alle 5 min, sobald es auf einem Mietrechner laeuft
Schwere: HOCH
Beleg: `src/bn4life.js:383-393` schreibt `data/bn4life.json` mit `ns.write`
und OHNE `scp`; der einzige `scp` der Datei ist `:291` (Auftraege). B1 liest
`ns.fileExists(telemetrie, "home")` + `ns.read` auf home (`bn4net.js:2650-2655`).
`bn4life.js` steht in WERKZEUGE (`bn4net.js:255`) und wird in jedem frischen
Knoten auf der Werkbank gestartet, weil es ausserhalb BitNode 4 293,8 GB
braucht und home 32 GB hat (`boot.js:29-32, 156-158`). sleeve/bbtrain/blade/
ausgang kopieren alle nach home (`sleeve.js:375-377`, `bbtrain.js:83`,
`blade.js:1326-1328`, `ausgang.js nachHome`) - bn4life ist die Ausnahme.
Was passiert: Frischer Knoten -> bn4life auf werk-N -> bn4life.json auf home
fehlt oder traegt den Stempel aus dem alten Knoten -> `alter` = jetzt-seit
bzw. jetzt-alter Stempel -> nach 5 min alle Instanzen gekillt -> Folgerunde:
Abschnitt 0 versucht home (exec gibt still 0), Starter setzt es wieder auf
werk-N -> 5 min -> Kill. Dauerzyklus, bis home ~300 GB frei hat (in BN10 L2
erst bei 1024 GB home; in Knoten mit teurem home-Ausbau Stunden bis Tage).
Kosten: `data/bn4life-log.txt` wird bei jedem Neustart auf eine Zeile
zurueckgesetzt (Audit-Befund 16 verschaerft: kein Post-mortem mehr), das
200-Zeilen-bn4net-log fuellt sich mit Kill/Start/Entdopplungs-Zeilen,
`lifeFrisch` im Auftragsblock von bn4net bleibt dauerhaft false (bn4net und
bn4life bedienen task.txt dann beide), und die Stillstandserkennung ist fuer
bn4life leer: ein wirklich haengendes bn4life sieht genauso aus wie ein
gesundes. Live NICHT sichtbar, weil bn4life gerade auf home laeuft
(bn4life.json 18:28 nur 9 s alt) - der Fehler wartet auf den naechsten
Knotenwechsel.
Fix: in `bn4life.js` Abschnitt 4 nach dem write
`if (ns.getHostname() !== "home") ns.scp("data/bn4life.json", "home", ns.getHostname());`
(wie sleeve.js). Zusaetzlich Befund 2.

### 2. Gedrosselter Tab: bn4life schreibt nur alle ~10 min, erlaubt sind 5 - Dauerkill auch auf home
Schwere: HOCH
Beleg: `bn4life.js:381` `if (runde % 10 === 0)` mit `:399 await ns.sleep(1000)`;
verdeckter Tab = 1 Timer-Wake je Minute (Memory "Browser-Tab-Drosselung";
Audit B.10 "Faktor 6 auf jede Runde"); TELEMETRIE-Grenze 5 min
(`bn4net.js:63`).
Rechnung: Runde 10 faellt nach 9 Wakes = ~9 min. bn4net (selbst auf 60 s
je Runde gedrosselt) sieht die neue Instanz bei T0+<=60 s, prueft ab
seit+300 s = T0+330..390 s; der letzte Stempel stammt von der VORIGEN
Instanz (<= T0) -> alter > 300 s -> Kill. Neustart eine Runde spaeter,
wieder 5 min, wieder Kill: Zyklus 6-7 min, Runde 10 wird nie erreicht,
bn4life.json wird im Drosselbetrieb NIE mehr geschrieben.
Der Drosselfall ist kein Randfall: im Kaltstart jedes Knotens laeuft
wakelock.js (34 GB) nicht (Audit B.10), und wakelock haengt an einem
AudioContext, der nach einem Neuladen ohne Nutzergeste suspended bleiben
kann (`wakelock.js:110`). Im Betriebsmodell "Rechner aus, Check-in alle
paar Tage" ist der Tab die meiste Zeit verdeckt.
Was passiert: dieselbe Kill-Schleife wie in 1, jetzt unabhaengig vom Wirt.
Der Kommentar zu TELEMETRIE ("grosszuegig, weil ein gedrosselter Tab die
Schreibtakte streckt") gilt fuer blade (nextUpdate je Engine-Tick), sleeve/
bbtrain/ausgang (60-s-Takte, max. ~2 min je Runde) - fuer bn4life nicht.
Fix: Telemetrie nach Wanduhr statt Rundenzahl:
`if (Date.now() - letzteTelemetrie >= 10000) { ...; letzteTelemetrie = Date.now(); }`
- dann schreibt bn4life in jedem Wake. Alternativ Grenze auf 15 min, das
laesst aber echte Haenger 15 min laufen.

### 3. "Neustart in dieser Runde" stimmt nicht - der Starter fuehrt das gekillte Werkzeug noch als laufend
Schwere: NIEDRIG
Beleg: `laufend` wird `bn4net.js:2593-2598` VOR dem B1-Kill gebaut; der Kill
(`:2656-2658`) raeumt nur `orte` und `werkzeugSeit`; der Starter filtert
`!laufend.includes(d)` (`:2759`). Fuer bn4life gibt es im Starter ohnehin
nur den Umweg ueber Abschnitt 0 (naechste Runde, nur home) und WERKZEUGE.
Was passiert: Neustart erst in der Folgerunde (10 s, gedrosselt 60 s).
Kosten gering; aber die Logzeile ist eine Zusage, die beim naechsten
Post-mortem in die Irre fuehrt ("Kill 18:40:10, Start 18:40:20 - warum
nicht dieselbe Runde?"). `werkzeugSeit` beginnt danach korrekt neu (Runde
nach dem Kill: nicht in orte -> nichts; Runde nach dem Start: seit=jetzt).
Fix: nach dem Kill `laufend` bereinigen
(`for (let i = laufend.length - 1; i >= 0; i--) if (laufend[i] === datei) laufend.splice(i, 1);`)
- dann stimmt die Zusage; oder die Meldung auf "Neustart in der naechsten
Runde" aendern.

### 4. boot.js-Endlosschleife: data/boot.txt waechst unbegrenzt und wird alle 5 s komplett neu geschrieben
Schwere: MITTEL
Beleg: `boot.js:42-46` `log.push` ohne Deckel, `ns.write(..., log.join, "w")`
bei jedem `sag`; im Zweig "getScriptRam gibt 0, warte" (`:133`) eine Zeile
je Runde und Datei, Runde = 5 s. Vorher endete das nach 240 Runden, jetzt nie
(`:115`). bn4life.js:49-56 hat fuer genau dieses Muster einen 200-Zeilen-
Deckel.
Was passiert: bn4net.js nicht uebersetzbar (fehlerhafter Push ueber die
Bruecke, nachts) -> 17.280 Zeilen/Tag, nach drei Tagen ~3 MB, alle 5 s neu
in den Spielstand (IndexedDB, gzip) geschrieben, O(n^2). Der Bot steht in
dem Fall ohnehin - aber der Spielstand waechst bis zum naechsten Check-in
weiter, und der ist im neuen Betriebsmodell Tage entfernt.
Fix: `if (log.length > 200) log = log.slice(-200);` in `sag`, und den
"gibt 0"-Zweig wie den Speicherzweig auf `runde % 12` drosseln.

### 5. Dauerfehler in ausgang.js/blade.js wird zur 10-min-Kill-Schleife ohne Diagnose
Schwere: NIEDRIG
Beleg: `ausgang.js` catch-Zweig (`sag("Fehler in der Runde")`, kein
ausgang.json) und `blade.js:3468-3471` (catch: sleep 10 s, kein meldeLage);
TELEMETRIE 10 min.
Was passiert: Ein persistenter Fehler (planeRoute wirft bei kaputter
route.json-Struktur; Bladeburner-API-Ausnahme) -> alle 10 min Kill + Neustart
mit derselben Ausnahme. ausgang verliert dabei `letzterStart`, also die
15-min-Sperre nach einem exit.js-Fehlschlag: exit.js wird nach jedem
Neustart sofort wieder gestartet statt alle 15 min. Vorher: haengende
Instanz, jetzt: Schleife - kein Rueckschritt, aber das Log zeigt nur
"lebt, schreibt aber", nicht den Fehler.
Fix: im catch-Zweig Telemetrie mit `fehler: String(e)` schreiben (der
route-Zweig tut das seit heute); `letzterStart` in ausgang.json steht
schon drin - beim Start daraus zuruecklesen.

### 6. boot.js: Reihenfolgefalle nach dem einmaligen Kill (nur BitNode 4)
Schwere: NIEDRIG
Beleg: `boot.js:116-123` killt genau in Runde 60; `:126` startet bn4net vor
bn4life, aber bei "getScriptRam gibt 0" (`:133`) geht es mit `continue`
weiter und startet bn4life (BN4: 19,85 GB) auf home.
Was passiert: Wird bn4net.js nach mehr als 5 min repariert (Push), fehlen
ihm 16,25 GB neben bn4life auf 32 GB -> "warte auf Speicher" fuer immer,
der Kill von Runde 60 ist verbraucht. Nur BN4 (nur dort passt bn4life auf
home), nur nach spaeter Reparatur. Ausserhalb: bn4life passt nie auf 32 GB,
der Fall tritt nicht ein.
Fix: Kill-Zweig auf `runde % 60 === 0` (alle 5 min, solange bn4net fehlt)
oder bn4life nicht starten, solange bn4net nicht laeuft.

---

## Tragfaehig (geprueft, kein Befund)

**B1 Falsch-Positive je Werkzeug (Normalbetrieb).**
- blade.js: JEDER Austrittspunkt der Hauptschleife (2999, 3185, 3240,
  3290, 3467) steht hinter meldeLage; laengster Schlaf 30 s;
  `nextUpdate` loest je Bladeburner-Tick, gedrosselt einmal je Minute.
  Wartezweig vor dem Beitritt schreibt alle 30 s (`:607`). Black Ops und
  lange Aktionen: die Schleife wartet je Tick, nicht je Aktion - kein
  Schreibloch. blade.json traegt `zeit: Date.now()` (`:1302`).
- sleeve.js: `break` (`:118`, `:368`) verlaesst nur die innere for-Schleife,
  der write `:372-377` folgt in jeder Runde, Takt 60 s. Neue getSleeve-
  Zeile am Kopf: `catch { break; }` - gleiches Muster.
- bbtrain.js: Herzschlag am Kopf beider Schleifen, kein Schlaf > 60 s;
  nach beiden Beitrittszweigen kehrt `runde()` zurueck, `main` schlaeft
  30 s und ruft neu (`:36-39`) -> Herzschlag.
- ausgang.js: alle vier fruehen `continue`-Zweige schreiben jetzt; ab
  `plan.ziel` schreibt die Runde vor dem `offen`-Test, der wirtFehlt-Zweig
  noch einmal. Takt 60 s.
- Nach Neuladen: `werkzeugSeit` leer, Runde 1 setzt `seit`, Pruefung erst
  nach maxAlter; jedes Werkzeug (ausser bn4life gedrosselt, Befund 2)
  schreibt bis dahin. Alte Stempel aus der Zeit vor dem Ausschalten sind
  dadurch unschaedlich.
- scp nach home schlaegt fehl: `ns.scp` einer vorhandenen Textdatei nach
  home wirft nicht; der realistische "kein Kopieren"-Fall ist Befund 1.
- Zeitbasis: Telemetrie und Pruefung benutzen beide `Date.now()`, keine
  Spielzeit. Der Fall "Rechner aus" produziert keine falschen Alter, weil
  nach dem Laden alle Skripte neu starten und `seit` neu beginnt.
- Off-home-bn4net (ns.read liest lokal -> alle Telemetrien "nie
  geschrieben"): nur ueber Handstart per task.txt erreichbar und
  transient, weil Abschnitt 0 von bn4life sofort eine home-Instanz startet
  und die Entdopplung home behaelt.

**Kill-Folge.** `ns.kill(pid)` wirkt hostuebergreifend und synchron
(`killWorkerScript.ts:27-36, 63-70`); `orte.delete` + `werkzeugSeit.delete`
konsistent; Aufraeumschleife `:2664-2666` loescht `seit` fuer Werkzeuge, die
eine Runde lang fehlen. Einzige Unschaerfe ist Befund 3.

**Entdopplung "juengste bleibt".**
- Doppelte entstehen nur ueber Auftragskanal (bn4life/bn4net starten auf
  dem Wirt mit meistem freien Speicher), Wache draussen (blade/wakelock/
  sonde bei Telemetrie > 10 min, bbtrain bei falscher Statwahl, je 15-min-
  Sperre; `wache.js:857-975`) und Handstart. Der Starter selbst startet nie
  neben einer lebenden Instanz (`laufend`-Filter).
- blade.js mitten in einer Black Op: der Kill der alten Instanz bricht die
  Aktion NICHT ab - die Bladeburner-Aktion ist Spielerzustand, kein
  Skriptzustand. Die neue Instanz waehlt neu; bei gleicher Wahl greift
  `gleich` (`:3306-3307`) und nichts passiert; bei anderer Wahl bricht
  `startAction` die laufende Black Op ab (Fortschritt weg, Rang nicht).
  Abschnitts-Buchhaltung: `merkeOffen` sichert je Runde -> hoechstens ein
  Durchlauf verloren. Kosten klein.
- Steuerhaelften: home gewinnt weiterhin; nur ohne home-Instanz jetzt die
  juengste statt der aeltesten. Im relevanten Fall unveraendert.
- Ping-Pong mit der Wache: B1 (10-s-Takt) und Wache (3-min-Poll,
  `wache.js:39`) teilen die 10-min-Schwelle; B1 kommt praktisch immer
  zuerst. Faellt der Wache-Neustart obendrauf, entstehen zwei frische
  Instanzen, die Entdopplung behaelt die juengere - konsistent, ein
  verschenkter Start, kein Ping-Pong. bbtrain-Neustarts der Wache bei
  "arm"/Graft: die neue Instanz verhaelt sich identisch; harmlos.

**B3 boot.js.** Der Kill in Runde 60 feuert genau einmal; in derselben
Runde startet boot bn4life sofort wieder (`:126-144`). Nach Einbau oder
Knotenwechsel laeuft ausser boot nichts (prestigeWorkerScripts), also trifft
der Kill hoechstens boot-eigene Starts. Handstart bei laufendem bn4net:
return in Runde 0 (`:159-163`), keine Endlosschleife. installAugmentations
killt vorher alles, "bn4net laeuft schon" gibt es dort nicht.

**B4 bbtrain ohne Notruf.**
- "warte auf Reisegeld": erreichbar nur, wenn die Figur in Chongqing/New
  Tokyo/Ishima steht (graft.js:143 New Tokyo, joinrun.js:111 Ishima,
  exploit3.js) UND Konto <= 1 Mio. Nach einem Einbau steht sie in Sector-12
  (`PlayerObjectGeneralMethods.ts:104`). Geld bringt das Netz (Hackertrag
  haengt nicht an der Figur) und bn4life (Verbrechen, wenn keine fremde
  Arbeit). Schoenheitsfehler: Gym-Arbeit aus Sector-12 laeuft nach einer
  Reise weiter (`Person.ts:243-251` aendert nur `city`; ClassWork prueft
  keinen Ort) und wird in diesem Zweig nicht gestoppt (Geldpruefung `:251`
  kommt erst danach) - 2.400 $/s gegen Mio/s Hackertrag, unerheblich;
  im Kaltstart ohne Netz gibt es kein Gym (5-Mio-Schwelle).
- Beitritt abgelehnt: `runde()` endet (`:330-336`), `main` schlaeft 30 s,
  neue Runde: Schleife 1 `break` (nicht drin), Schleife 2 `break`
  (Tiefstand >= ZIEL), `stopAction()` (`:320`) + join -> alle 30 s ein
  stopAction, das laufende Faktions-/Verbrechensarbeit toetet. Tritt nur
  bei BladeburnerRank 0 (BN8, dort V1 -> nicht gestartet) oder ohne
  SF7-Zugang ein. Tragfaehig, solange route.json BN8 als V1 fuehrt.
- Reise waehrend Graft (Schleife 2 reist VOR der Graft-Pruefung): `travel`
  ruft kein finishWork, das Graft ueberlebt. Kein Befund.

**A1 x B1 / Wache.** `upgradeCloudServer` setzt nur `server.maxRam`
(`ServerPurchases.ts:59-65`), laufende Skripte bleiben. Werkbank = groesster
Mietrechner (`bn4net.js:876-882`), A1 vergroessert genau diesen -> kein
Werkzeugumzug, kein Doppelstart.

**Log seit 18:14.** Die Zeilen "sleeve.js/bbtrain.js/blade.js/ausgang.js:
1 Instanz(en) beendet, startet gleich neu" (18:14:31-18:15:42) stammen aus
dem WERKZEUG-Kanal (`bn4net.js:616`, Neustart nach dem Push), nicht aus B1.
Kein "lebt, schreibt aber", keine "Doppelte Instanz". bn4net selbst wurde
18:25:23 neu gestartet (Log auf 7 Zeilen zurueckgesetzt - Befund 16 des
Audits, hier ohne neue Erkenntnis). Alle fuenf Telemetrien 18:28 unter
30 s alt.

## Beobachtet, nicht mein Winkel
- Konto 18:14 > 5 Mrd, 18:27 laut bn4life.json 980 Mio: die
  Amortisationsleiter hat in einer Minute 14 Rechner ueber drei Stufen
  gezogen (~8,8 Mrd inkl. A1-Schritt 224,9m). A1 selbst war ein Schritt;
  ob die Leiter danach so aggressiv sein darf, gehoert zum Substanz-Winkel.
- tools/wache.js laeuft (pid 23128, Autostart 16:04, Audit-Befund 13 offen)
  und protokolliert 18:14:13 "PUSH: bn4rep.js arbeitet wieder" - pruefen,
  dass `~/.claude/notify-aus` das wirklich abfaengt.

## Nicht geprueft
- joinrun.js (A2), Zahlen des Geldbodens in sleeve.js, tools/checkin.js.
- hashes.js (neu in WERKZEUGE, ohne Telemetrie) und die ungedeckten
  Werkzeuge (contracts, popups, bn4door, homegrow, wakelock).
- Ob der AudioContext von wakelock.js nach einem Neuladen ohne Nutzergeste
  wieder anlaeuft (bestimmt, wie oft Befund 2 zuschlaegt).
- Die Drosselannahme "1 Wake je Minute auch fuer die 1-s-Kette von bn4life"
  stammt aus Memory und Audit B.10, nicht aus einer eigenen Messung heute.
