# Skeptiker: ausgang.js im Betrieb (zwei Wochen, ohne Menschen)

Stand 02.09.2026, 17:34-17:52 (Systemzeit). Zeilenangaben fuer ausgang.js
und exit.js beziehen sich auf den Stand 17:47:42 (die Dateien wurden
waehrend der Pruefung geaendert; boot.js, bn4net.js, bn4rep.js: 17:27:42).
Gelesen: src/ausgang.js komplett, src/exit.js, src/boot.js, src/bn4rep.js
(60-100, 855-905, 1150-1180), src/bn4net.js (241-320, 372-412, 430-500,
528-575, 622-700, 800-845, 2505-2830), src/blade.js 2950-2980, src/graft.js,
sync/bridge.js (SYNCABLE), git diff. Spielquellcode: Prestige.ts,
RedPill.tsx, Singularity.ts (59-85, 1153-1195), Bladeburner.ts (30-93),
NetscriptFunctions.ts (scp 766-826, exec 634-651, ps 865-877),
NetscriptWorker.ts (218-264, 314-345), Netscript/killWorkerScript.ts,
Netscript/RamCostGenerator.ts, BitNode.tsx (BN9), Server/data/servers.ts.
Live gelesen: data/ausgang.txt, ausgang.json (17:31:46 und 17:33:46),
verfahren.txt, bn4net.json (Runde 535, Werkbank werk-10, home 1024 GB,
14,9 TB Netz), bn4life.json (9 s alt), bn4rep.json und blade.json (beide
25,7 h alt - aus dem Lauf VOR dem Sprung am 01.09.).

## Befunde

### 1. boot.js loescht data/verfahren.txt auch nach jedem Augmentierungs-Einbau - bn4net startet in V1-Knoten blade.js und bbtrain.js nach jedem Einbau trotzdem
Schwere: KRITISCH
Beleg: boot.js ist nicht nur der Rueckruf des Knotenwechsels, sondern auch
der von `installAugmentations` (bn4rep.js:1173
`ns.singularity.installAugmentations("boot.js")`). boot.js:80-87 loescht
verfahren.txt bedingungslos (Stand 17:5x: Liste um data/hilfe.txt
ergaenzt, verfahren.txt steht weiterhin in Zeile 84). Der Werkzeugstarter in bn4net.js (2645-2652
`verfahrenV1`, Startschleife 2785-2830) enthaelt kein `await` (gezaehlt: 0
zwischen Zeile 2505 und 2830); `fehlend` wird einmal je Runde berechnet,
dann werden alle Eintraege in Listenreihenfolge synchron per `ns.exec`
gestartet. ausgang.js schreibt verfahren.txt erst, wenn sein Modul laeuft
(ausgang.js:176-178) - also NACH dem Ende dieser synchronen bn4net-Runde.
Was passiert: Einbau in BN1/5/12/8 (V1-Knoten der Route, 10 Laeufe) ->
boot.js loescht verfahren.txt -> boot startet bn4net -> erste Runde mit
Werkbank = home (Mietrechner sind weg, home behaelt seinen Speicher, heute
1024 GB, Reserve 256) -> `verfahrenV1` findet keine Datei -> false ->
fehlend = ausgang, blade, bbtrain, sleeve, ... -> alle in derselben Runde
gestartet; verfahren.txt kommt Sekunden spaeter. bn4net beendet
blade/bbtrain danach nie (der Filter wirkt nur auf `fehlend`, nicht auf
Laufendes). Folge im V1-Knoten: bbtrain stellt die Figur ins Gym, blade.js
tritt der Division bei (SF6.1 erlaubt das ausser in BN8), und
`Bladeburner.startAction` bricht ohne Simulacrum jede Spielerarbeit ab
(Bladeburner.ts:177-180, so in graft.js:31-35 dokumentiert), waehrend bn4rep
fuer Daedalus Faktionsarbeit braucht - das Ping-Pong vom 25.08. In BN8
ruft bbtrain stattdessen alle 30 s stopAction() (Audit A.4). Der Hackingweg
kommt nach dem ersten Einbau nicht mehr voran, und niemand meldet es.
Beim Knotenwechsel selbst tritt das nicht auf: home hat dort 32 GB,
blade.js (41 GB) passt nicht, und bis ein Wirt da ist, steht die Datei.
Fix (beides):
  a) boot.js:84: `"data/verfahren.txt"` aus der Loeschliste streichen.
     Die Loeschung hat keinen Nutzen: alle drei Leser (bn4rep.js:83,
     bn4net.js:2648, ausgang.js:177) vergleichen den Knoten in der Datei,
     und ausgang.js ueberschreibt sie in seiner ersten Runde - auch beim
     Sprung in denselben Knoten ("V2 10 2" -> "V2 10 3").
  b) bn4net.js nach Zeile 2652: wenn `verfahrenV1`, laufende blade.js und
     bbtrain.js netzweit beenden (`orte` aus 2530-2545 hat host+pid):
       if (verfahrenV1) for (const d of ["blade.js", "bbtrain.js"])
         for (const w of orte.get(d) || []) { ns.kill(w.pid); sag(d + " im V1-Knoten beendet (" + w.host + ")."); }
     Das heilt auch Handstarts und den Fall "Datei kurz gefehlt".
  Nebenbefund derselben Loeschliste: `data/task.txt` verfaellt nach jedem
  Einbau - ein per tools/task.js abgelegter Auftrag aus der Minute vor dem
  Einbau geht still verloren. Soll boot.js Einbau und Knotenwechsel
  unterscheiden: `ns.getResetInfo()` (1 GB) und
  `Date.now() - info.lastNodeReset < 60000` als Bedingung fuer die
  knotengebundenen Loeschungen.

### 2. In BitNode 9 gibt es fuer exit.js (519,25 GB) in 3 von 5 Wuerfen keinen Wirt
Schwere: HOCH
Beleg: BitNode.tsx (BN9-Block): `CloudServerLimit: 0`,
`HomeComputerRamCost: 5`. Fremdrechner (Server/data/servers.ts, maxRam =
2^Exponent, Exponent je Prestige gewuerfelt, ServerHelpers.ts:364):
fulcrumtech 7-11 (128-2048 GB), blade 5-9 (max 512), omnitek 7-9 (max
512), BitRunners 5-9 (max 512), alle uebrigen <= 256. ausgang.js:266-279
sucht netzweit `frei + Arbeiter >= 519,25`.
Was passiert: In BN9 (Route Position 5-7, drei Laeufe) sind Mietrechner
verboten; der einzige Fremdrechner, der je 520 GB haben kann, ist
fulcrumtech mit Exponent 10 oder 11 - zwei von fuenf Werten. home muesste
auf 1024 GB (mindestens 519,25 + 2 + bn4net 17,75 + ausgang 10,9 +
wakelock 34,25 > 512) bei fuenffachem Preis. Hacknet-Server waeren der
natuerliche Wirt (bis 8 TB), aber hashes.js gibt es noch nicht, und ob sie
in `ns.scan("home")` auftauchen, habe ich nicht geprueft. Ohne Vorsorge:
21 Black Ops gefallen, ausgang.txt sagt einmal "passt nirgends (bester Wirt
fulcrumtech mit 512 GB)", und der Bot steht bis zum naechsten Besuch - bis
zu dreimal. Die neue Ueberspringlogik (ausgang.js:84-88) haelt den Bot nur
VOR BN9 fern, solange hashes.js fehlt; sobald es liegt, ist der Wirt das
naechste Loch.
Fix: Pflichtpunkt im BN9-Gewerk (Audit I.6): hashes.js muss einen
Hacknet-Server auf >= 640 GB bringen ODER homegrow zielt in BN9 auf 1024
GB. Zusaetzlich in ausgang.js:276 den Fall als eigenes Feld in
data/ausgang.json fuehren (`wirtFehlt: true`, bester Wirt, Luecke), damit
tools/checkin.js ihn zeigt und nicht nur der 60-Zeilen-Ringpuffer.

### 3. Das laufende (alte) bn4net kennt ausgang.js nicht - bis zum naechsten Einbau laeuft der Ausgang ohne Wache
Schwere: MITTEL
Beleg: bn4net.json Runde 535 bei 10 s Takt = Start ~16:11, deckungsgleich
mit dem Bridge-Reconnect 16:11:00 (Neuladen); die Werkzeugliste im Prozess
ist die alte. ausgang.js laeuft von Hand auf werk-10 (ausgang.txt 17:28:46).
bn4rep.json/blade.json sind 25,7 h alt - der alte Ausgangsblock in bn4rep
laeuft ohnehin nicht; ausgang.js ist der EINZIGE Ausgang fuer BN10 L2.
Was passiert: Stirbt ausgang.js vor dem naechsten Einbau (Neuladen mit
einem Spielstand von vor 17:28, Handfehler, Kill), startet es niemand neu.
Der Knoten wird fertig, und der Bot arbeitet weiter, bis Eric /bb macht.
Zu Frage 8 (Neustart jetzt?): `SELBST bn4net.js` in data/reload.txt
(bn4net.js:402-408) leert die Datei VOR dem Exit, und bn4life.js:92-95
startet bn4net auf home neu, sobald `ns.isRunning` false ist (Takt 1 s).
Voraussetzungen JETZT erfuellt: bn4life.json 9 s alt, homeFrei 256,4 GB
>= 17,75. Der Vorfall vom 25.08. betraf den WERKZEUG-Kanal nach einem
Einbau (reload.txt nicht geleert, bn4life tot) - beides trifft hier nicht
zu, und der WERKZEUG-Kanal lehnt bn4net.js seit 25.08. ab (bn4net.js:
556-561). Kosten: HWGW-Kalender und Merker im Speicher gehen verloren,
einige Minuten Ertragsdelle. Danach sieht die Entdopplung ausgang.js auf
werk-10 in `laufend` (netzweit, 2530-2545): kein Zweitstart, kein Kill,
Zustand konsistent.
Fix: Neustart jetzt per `SELBST bn4net.js`; unmittelbar davor
bn4life.json-Alter < 60 s pruefen, danach im bn4net-Log die
"fehlend:"-Zeile kontrollieren, dass ausgang.js als laufend gefuehrt wird.

### 4. Protokoll: im V1-Knoten verdraengt der Hacking-Stand jede Minute die Kopfzeile
Schwere: NIEDRIG
Beleg: ausgang.js:208-214 setzt `status` mit dem aktuellen Level; :228-229
vergleicht die ganze Zeichenkette mit `letzteMeldung`; :105 haelt 60
Zeilen.
Was passiert: Im Hackingweg aendert sich das Level fast jede Minute ->
jede Runde eine neue "warte"-Zeile -> nach einer Stunde sind "laeuft auf",
"Dieser Lauf: ..." und die Uebersprungen-Zeilen aus data/ausgang.txt
verschwunden. Dazu `letzterStart = 0` nach jedem Neustart: laeuft exit.js
gerade, rechnet :251 "laeuft seit 29,8 Mio min"; :249 und :261 zeigen die
letzte Zeile einer data/exit.txt aus dem VORLAUF (heute: vom 01.09., die
Datei wird von boot.js nicht geraeumt).
Fix: Level fuer den Vergleich auf Zehntel des Bedarfs runden
(`Math.floor(level / wd.requiredHackingSkill * 10)`), Kopfzeilen
ausserhalb des Ringpuffers halten, `letzterStart === 0` als "unbekannt"
ausgeben, data/exit.txt in boot.js mit loeschen.

### 5. Kaltstart: ausgang.js belegt 10,9 der 32 GB frisches home, davon sind 1,95 GB vermeidbar
Schwere: NIEDRIG
Beleg: RamCostGenerator.ts: getServer 2 GB (:608),
getServerRequiredHackingLevel 0,1 (:613), getServerNumPortsRequired
0,1, getPlayer 0,5 (:650), getHackingLevel 0,05 (:604). ausgang.js:208-211
nutzt die teuren Varianten (getServer fuer requiredHackingSkill,
hasAdminRights, numOpenPortsRequired; getPlayer fuer das Level). bn4net
17,75 + ausgang 10,9 = 28,65 von 32 GB; vorher blieben 14,25 GB fuer
Arbeiter und popups.
Was passiert: In den ersten Stunden eines Knotens fehlen home rund 11 GB
Arbeiter (etwa 6 hack-Faeden). Der Ertrag dort ist beim Kaltstart klein
(Verbrechen tragen), deshalb nur NIEDRIG - aber Audit B nennt genau
dieses Fenster als kritisch.
Fix: `ns.getServerRequiredHackingLevel(WD)`, `ns.getServerNumPortsRequired(WD)`,
`ns.hasRootAccess(WD)` (0,05) und `ns.getHackingLevel()` statt getServer +
getPlayer: rund 8,9 GB.

## Tragfaehig (geprueft, haelt)

- Spiegelung nach home: `sag`/`nachHome` schreiben lokal und scp'en in
  try/catch (ausgang.js:103-116); `liesVonHome` vergleicht gegen home, ein
  fehlgeschlagener scp wird in der naechsten Runde wiederholt. Live: die
  Zeit in data/ausgang.json auf home stieg 17:31:46 -> 17:33:46, waehrend
  das Skript auf werk-10 lief.
- Einbau: Mietrechner und alle Skripte sterben (Prestige.ts:55-80,
  prestigeWorkerScripts + prestigeAllServers); Textdateien auf home
  bleiben. boot.js startet bn4net (runAfterReset prueft nur home-RAM,
  Singularity.ts:59-76); ausgang.js steht ganz oben in WERKZEUGE und passt
  neben bn4net auf 32 GB (17,75 + 10,9 = 28,65). bn4rep braucht ausserhalb
  BN4 848 GB und kommt Stunden spaeter - bis dahin steht verfahren.txt
  laengst (Einschraenkung: Befund 1 fuer blade/bbtrain, die in derselben
  Runde starten).
- Wirt fuer 519 GB in BN10: live 14,9 TB im Netz nach 26 h Laufzeit,
  werk-10 haelt 1694 GB Werkzeugreserve. Fremdrechner fulcrumtech bis
  2048 GB. Rechnung home 512: 512 - 2 - 17,75 - 10,9 - 1,6 - 34,25 = 445,5
  < 519,25 - home faellt korrekt durch, ein anderer Wirt gewinnt.
- scp mit fehlender Bibliothek wirft nicht: NetscriptFunctions.ts:803-808
  loggt "does not exist" und kopiert die uebrigen Dateien (`continue`).
  exit.js importiert nichts; lib/hackaugs.js ist fuer exit.js bedeutungslos.
- Raeumen und exec im selben Tick sind sauber: ns.scriptKill ->
  stopAndCleanUpWorkerScript -> removeWorkerScript -> `updateRamUsed`
  synchron (killWorkerScript.ts:90-124). `frei(wirt)` nach dem Kill ist
  aktuell; exec liefert bei Mangel 0 statt einer Ausnahme
  (NetscriptWorker.ts:324-326, NetscriptFunctions.ts:643-649).
- ns.ps ueber 85 Hosts: reine Map-Iteration (NetscriptFunctions.ts:865-877),
  ebenso `netz()` mit 85 ns.scan - Millisekunden, kein Takt-Problem.
- Doppelstart: exit.js hat ausser ausgang.js keinen Aufrufer mehr (grep in
  src/ und tools/: nur Kommentare bn4rep.js:902-910, boot.js:16). Zwei
  gleichzeitige destroy-Aufrufe sind gefahrlos: der erste toetet im selben
  synchronen Aufruf alle Skripte (RedPill.tsx:60), der zweite kommt nie zur
  Ausfuehrung; der Rueckruf wird einmal gesetzt.
- Stiller Rueckzug von exit.js ("Requirements not met", Singularity.ts:
  1183-1186, nur Log): fuer V2 ist das Praedikat identisch (Bladeburner.ts:
  90 gegen Singularity.ts:1180); fuer V1 prueft ausgang.js:210-212 jetzt
  Root bzw. fuenf Portknacker vor dem Start, exit.js:118-124 wertet den
  Rueckgabewert von nuke aus, und ausgang.js:260-265 wartet nach einem
  Start ohne Sprung 15 Minuten statt jede Minute Arbeiter zu raeumen.
  Keine Endlosschleife mit Dialogen - destroyW0r1dD43m0n wirft nicht.
- Entdopplung nach bn4net-Neustart: ausgang.js in `laufend` (netzweit) ->
  nicht `fehlend`; eine Instanz -> nichts zu killen. Verschwindet werk-10,
  sterben ohnehin alle Skripte (nur beim Prestige moeglich).
- Neuladen (F5, Tab morgens): loadAllRunningScripts stellt gespeicherte
  Skripte ALLER Server wieder her, auch Mietrechner (NetscriptWorker.ts:
  241-262); index.tsx:55 warnt nur, speichert nicht - es gehen hoechstens
  AutosaveInterval (60 s) verloren. ausgang.js haelt keinen Zustand, der
  das stoert. Heute 16:11 ist genau das passiert (Bridge-Reconnect + neue
  bn4net-Rundenzaehlung), und alles kam zurueck.
- try/catch: `n.name` nur im Nicht-null-Zweig (:200), `getServer(WD)` nur
  nach `serverExists` (:203-208), Bladeburner-Aufrufe im eigenen try
  (:196-202). Der aeussere catch loggt und die Schleife schlaeft danach
  (:294-297) - kein Haengen, keine Schleife ohne sleep. `inBladeburner`
  prueft keinen API-Zugang (Bladeburner.ts:74); `getNextBlackOp` wirft
  ohne Division -> abgefangen, Status "nicht lesbar", kein Sprung (sichere
  Richtung).
- verfahren.txt wird bei jeder Inhaltsaenderung neu geschrieben (:177);
  Knoten und Stufe aendern sich nur beim Prestige. Sprung in denselben
  Knoten: enterBitNode verbietet newBitNode === destroyedBitNode nicht
  (RedPill.tsx:53-78), giveSourceFile hebt die Stufe. validBitNodes
  enthaelt 14 und 15 (BitNode/Constants.ts:1).
- `letzteMeldung` verschluckt nichts Wichtiges: Ziel- und Verfahrenswechsel
  gibt es nur nach einem Prestige, und dann startet das Skript frisch.
  Uebersprungene Eintraege haben ihren eigenen Merker (:140, :166-172).
- Bruecke synchronisiert .json (bridge.js:135 SYNCABLE) - route.json kommt
  nach home; ein kaputtes route.json fuehrt zu "unlesbar" und Warten, nicht
  zu einem falschen Sprung.

## Nicht geprueft

- Ob Hacknet-Server in BN9 in `ns.scan("home")` erscheinen (Befund 2).
- BN10-Multiplikatoren fuer Mietrechner im Kaltstart L3 (nicht noetig:
  live 14,9 TB nach 26 h).
- Ob tools/aufsicht.js (laut Audit C.13 im Autostart) Auftraege in
  task.txt legt, die mit ausgang.js kollidieren.
- bn4rep in BN4 in den Sekunden zwischen Einbau und erstem
  verfahren.txt (dort ist bn4rep klein und startet in derselben Runde).
- Ob `toNumber(maxRamExponent)` gleichverteilt wuerfelt (fuer die 40 % in
  Befund 2 angenommen).
- Die Frische von bn4rep/blade (25,7 h alte Telemetrie) - nicht mein
  Winkel, aber in BN10 L2 laeuft derzeit weder bn4rep noch blade.js.
