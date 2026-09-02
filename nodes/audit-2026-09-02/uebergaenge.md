# Audit: Die Übergänge (Knotenwechsel + Augmentierungs-Einbau)

Stand 02.09.2026, 17:15. Nur gelesen. Live-Zustand: BN10 Lauf 2, `home` 512 GB,
`data/exit-ziel.txt` = `10`, `data/simulacrum.txt` = 1788120181574 (30.08. 22:03).
RAM-Zahlen unten stammen aus einem eigenen statischen Rechner
(`scratchpad/ramcalc.js`, Kostentabelle aus `Netscript/RamCostGenerator.ts`,
SF4Cost-Regel aus `:82-96`), geeicht gegen sieben im Spiel gemessene Werte:
darkweb.js 2,65 (ramcheck 28.08.), bn4life.js 293,8 (boot.txt 01.09.),
bn4rep.js 848,25 (BAUSTELLEN 02.09.), bbtrain 94,75 / homegrow 148,5 /
bn4door 99,85 (ERLEDIGT 25.08.), boot.js 4,0 - alle sieben auf die zweite
Nachkommastelle getroffen. Einzige Abweichung: wakelock.js 27,25 gerechnet gegen
34,25 gemessen am 25.08. (Datei seither geändert, nicht nachgemessen).

---

### 1. Der Zielknoten kommt ausschließlich vom Menschen, und die Datei überlebt jeden Sprung
Schwere: KRITISCH
Beleg: `src/bn4rep.js:906` liest `data/exit-ziel.txt`; kein Skript in `src/`
oder `tools/` schreibt diese Datei (`grep -rn exit-ziel src/ tools/` trifft nur
die Lesestelle und Kommentare). `src/boot.js:73-77` löscht sechs Dateien beim
Wiederanlauf - `exit-ziel.txt` ist nicht darunter. `bn4rep.js:908-909` weist
`zielRoh === eigenerKnoten` ab. Live: Datei enthält `10`, Knoten ist 10.
`nodes/AUDIT-ROADMAP-2026-08-24.md:79-97` verlangt denselben Knoten in Folge
elfmal (BN10 L2->L3, BN4 L2->L3, BN9 x3, BN1, BN5, BN12 x3, BN2 x3, BN3 x3,
BN11 x3, BN6, BN7 x3, BN14 x3, BN13 x3, BN15 x3, BN8 x3).
Was passiert: Nach jedem Sprung steht in der Datei der Knoten, den der Bot
gerade betreten hat. Am Ende dieses Laufs greift der Selbstsprung-Riegel,
`rufeMenschen` schreibt `data/hilfe.txt` - das seit dem 31.08. (Abschaffung
von `tools/wache.js`) niemand mehr liest -, und die Schleife hängt bei
`await ns.sleep(15000); continue;` (`:915-916`), also auch kein Kaufen/Einbauen
mehr. Wechselt ein Mensch die Datei nicht, kommt der Bot aus KEINEM der ~43
Übergänge allein heraus. Trägt die Datei dagegen zufällig einen anderen Knoten
als den eigenen (etwa `10` am Ende von BN4 L2), springt der Bot in den falschen
Knoten - ohne Meldung, denn aus Sicht des Codes ist der Übergang geglückt
(genau das Szenario des Kommentars `:892-905`, nur umgekehrt). Kosten: pro
Übergang unbegrenzt bzw. ein ganzer Lauf (25-50 h) bei Fehlsprung.
Was der Bot stattdessen tun müsste: Das Ziel selbst herleiten statt lesen.
`ns.getResetInfo()` (1 GB) liefert `currentNode` und `ownedSF` (Map SF -> Stufe,
`src/NetscriptDefinitions.d.ts:86-100`). Regel: Stufe des aktuellen Knotens
NACH dem Sprung = `ownedSF.get(cur)+1` (giveSourceFile läuft erst in
`enterBitNode`, `RedPill.tsx:62-63`); ist sie < 3, Ziel = eigener Knoten; sonst
der erste Knoten der festen Roadmap-Reihenfolge `[10,4,9,1,5,12,2,3,11,6,7,14,13,15,8]`
mit `ownedSF < 3`. Der Selbstsprung-Riegel wird damit zur Konsistenzprüfung
(Ziel == eigener Knoten nur zulässig, wenn die Stufe danach < 3 ist) statt zum
Stopp. `data/exit-ziel.txt` bleibt als optionale Übersteuerung, muss dann aber
einen Stempel `knoten|nodeReset` tragen und verfällt bei Nichtübereinstimmung
mit `getResetInfo().lastNodeReset`. Jede `rufeMenschen`-Stelle im Ausgangsblock
ist unter der neuen Prämisse ein Handlungszweig, kein Ruf.

### 2. Die Knotenrolle (Hacking- oder Bladeburner-Weg) existiert im Bot nur als `BLADE_KNOTEN = [6, 7, 10]` - in allen anderen Knoten kämpfen die Werkzeuge um die Figur
Schwere: KRITISCH
Beleg: `src/bn4rep.js:70` `BLADE_KNOTEN = [6, 7, 10]`; `:389` `bladeSperreArbeit =
bladeburnerTraegtHier` -> nur dort keine Faktionsarbeit; `:1867-1887` sonst
`workForFaction`. `src/bbtrain.js:36-40, 137-153, 302-321`: keine
Knotenprüfung, trainiert in JEDEM Knoten auf 100 und ruft
`joinBladeburnerDivision()`; `src/blade.js:600-604` wartet nur auf
`inBladeburner()`, keine Knotenprüfung. Beitritt ist außerhalb von BN6/7 mit
SF6 erlaubt (`NetscriptFunctions/Bladeburner.ts:333-348`; SF6 L1 vorhanden),
verboten nur bei `BladeburnerRank === 0` (BN8, `BitNode.tsx:790`).
Spielmechanik: `Bladeburner.ts:178-179` - `startAction` ruft ohne Simulacrum
`Player.finishWork(true)`; `:1356-1358` - `process()` bricht die
Bladeburner-Aktion ab, sobald `Player.currentWork` steht. Vorfall genau dieses
Musters: `nodes/ERLEDIGT.md:7446-7456` (25.08., bn4life gegen blade.js,
sekündliche Dialoge). Roadmap: V2 (Bladeburner) für BN4, BN9, BN2, BN3,
BN11, BN14, BN13, BN15 - alle NICHT in `BLADE_KNOTEN`; V1 (Hacking) für BN1,
BN5, BN8, wo Bladeburner nichts trägt.
Was passiert: BN4 Lauf 2 (übernächster Knoten): bbtrain bringt die Figur auf
100, tritt bei, blade.js startet Aktionen; bn4rep hält BN4 für einen
Hackingknoten, ruft `workForFaction` -> Aktion abgebrochen; blade.js setzt sie
neu -> Faktionsarbeit abgebrochen; Zyklus im Sekundentakt, ein Dialog je
Zyklus. Bladeburner-Aktionen (30-60 s) werden praktisch nie fertig -> Rang ~0;
Faktionsarbeit läuft mit Bruchteil-Auslastung; dazu baut bn4rep frei ein
(`kampfKnotenEinbau` false, `:970-972`) und setzt jedes Mal die Kampfwerte auf 1
-> bbtrain wieder ins Gym. In BN1/BN5 (V1) dasselbe Störfeuer gegen den
einzigen Weg, der dort zählt. In BN8: Beitritt abgelehnt, `bbtrain.js:306`
ruft trotzdem alle 30 s `stopAction()` (Rundenschleife `:36-39`) - die
Faktionsarbeit wird alle 30 s abgebrochen, drei Läufe lang. Kosten: BN4 L2/L3
auf V2 verlieren die Zeitgewinne, auf denen die Roadmap-Rechnung steht
(Tabelle Zeile 6-7: 25-29 h je Lauf); BN8 x3 faktisch unspielbar.
Was der Bot stattdessen tun müsste: Eine Rollentabelle je Knoten an EINER
Stelle (die Roadmap-Spalte "Verfahren" als Datei oder Konstante in einer
gemeinsam importierten `lib/`), und alle drei Skripte lesen sie: bbtrain und
blade.js starten nur in V2-Knoten (`bn4net.js` WERKZEUGE-Filter genügt dafür),
bn4rep setzt `bladeSperreArbeit`/`kampfKnotenEinbau` aus derselben Tabelle
statt aus `[6,7,10]`. Die Lehre vom 29.08. ("BLADE_KNOTEN, nie eine Nummer im
Code") ist richtig, aber die Liste selbst ist auf den nächsten Knoten nicht
vorbereitet.

### 3. `exit.js` passt in BitNode 10 nie auf `home` - der geplante Black-Ops-Fix landet auf einer zweiten Wand
Schwere: HOCH
Beleg: `src/bn4rep.js:931` `ns.exec("exit.js", "home", 1, zielKnoten)` - fest
auf home. Gerechnet: exit.js kostet 39,25 GB in BN4/SF4.3, **519,25 GB** außerhalb
mit SF4.1 (`destroyW0r1dD43m0n` = `SF4Cost(32)`, `RamCostGenerator.ts:219`
-> 512 GB; dazu getNextBlackOp 2, getServer 2, scp 0,6, getPlayer 0,5, Rest
1,05, Basis 1,6), 135,25 GB mit SF4.2. Freier Platz auf home ist die Reserve
`max/4` (`data/bn4net.json`: homeRam 512, reserve 128, homeFrei 128,75 - die
Arbeiter füllen den Rest). Also: 519,25 > max/4 für jedes home < 4096 GB.
Der manuelle Sprung am 01.09. 15:59 lief über `tools/task.js` -> `data/task.txt`
-> Wirt mit dem meisten freien Speicher (`bn4net.js:437-489`), NICHT über
`bn4rep.js:931`.
Was passiert: Sobald jemand - wie in `nodes/BAUSTELLEN.md:289-295` vorgesehen -
`ausgangSteht` um den Black-Ops-Zweig erweitert, ruft bn4rep `exec` auf home,
bekommt 0, schreibt `rufeMenschen(...)` (`:933-934`) ins Leere und versucht es
alle 15 s neu. BN10 L3 (nächster Lauf) endet trotz Fix im Stillstand. Hinzu
kommt: bn4rep selbst braucht in BN10 848,25 GB und lief in Lauf 2 bis heute
Nachmittag gar nicht (`BAUSTELLEN.md:171-173`) - die Ausgangserkennung sitzt im
Skript, das am seltensten läuft.
Was der Bot stattdessen tun müsste: Die Erkennung dorthin, wo das Ereignis
entsteht: `blade.js` sieht `getNextBlackOp() === null` (2 GB, schon bezahlt,
`:1863`) und legt `["exit.js", ziel]` in `data/task.txt` - der vorhandene
Kanal wählt den Wirt, räumt Arbeiter und meldet den Rückgabewert (`bn4net.js:
467-489`). Für den Hackingweg dieselbe Umstellung in bn4rep (`:931` durch den
Auftragskanal ersetzen). Nach BN4 L3 (SF4.3) ist das RAM-Problem weg, die
Wirt-Wahl bleibt trotzdem richtig.

### 4. Obergrenze 13: BitNode 14 und 15 sind als Ziel gesperrt
Schwere: HOCH
Beleg: `src/bn4rep.js:908` `zielRoh < 1 || zielRoh > 13`. Spiel:
`BitNode/Constants.ts:1` `validBitNodes = [1..15]`; `src/exit.js:44` prüft
korrekt 1-15. Roadmap Zeilen 33-41: BN14 x3, BN13 x3, BN15 x3.
Was passiert: Am Ende von BN7 L3 (Ziel 14) und BN13 L3 (Ziel 15) blockiert der
Riegel mit "AUSGANG BLOCKIERT", obwohl die Datei korrekt wäre. Sechs Läufe der
Route sind ohne Codeänderung unerreichbar; je Ereignis Stillstand bis zum
Menschen.
Was der Bot stattdessen tun müsste: Grenze 15, oder besser: keine Zahl im
Code, sondern die Liste aus Befund 1.

### 5. BitNode 9 kennt keine Mietrechner - der gesamte Kaltstart des Bots hängt an einem, den es dort nicht gibt
Schwere: HOCH
Beleg: `BitNode.tsx:816` `CloudServerLimit: 0` -> `ns.cloud.getServerLimit()`
= 0; `bn4net.js:616` `eigene.length < 0` ist nie wahr, die Kaltstart-Leiter
(`:641-652`) wird nie betreten, der Aufrüstzweig bricht bei `!smallest` ab
(`:702-707`, kein Absturz). Werkbank braucht `WERKBANK_GB = 20` auf einem
gerooteten Fremdrechner (`:800-806`); Fallback home nur, wenn das kleinste
Werkzeug in `32 - 17,15 = 14,85 GB` passt (`:822-829`) - in BN9 mit SF4.3:
bbtrain 12,25 passt, danach ist home voll; blade.js 94,85, bn4life 23,8,
contracts 17,65, homegrow 13,5 passen nicht mehr. Dazu `HomeComputerRamCost 5`
(`:814`), `ScriptHackMoney 0,1`, `ServerMaxMoney 0,01` (`:810,819`).
Kein Skript in WERKZEUGE fasst Hacknet an (`grep ns\.hacknet src/` trifft nur
`netburner.js`, ein Einmalkauf für die Netburners-Faktion in BN1). Die
Roadmap (Zeile 8-10) rechnet für BN9 mit "kein Mietrechner nötig" und
Gratis-Hacknet-Servern - beides ist im Bot nicht gebaut; der Gratis-Server aus
`Prestige.ts:338-348` hat Standard-RAM 1 GB und ist keine Werkbank.
Was passiert: Drei Läufe, in denen der Bot nach dem Wechsel mit bn4net +
bbtrain (wartet auf 5 Mio Gym-Geld) auf home steht; Einkommen aus Hacking bei
1/1000 von BN1; die erste Werkbank ist iron-gym/zer0 (32 GB, 1 Port) und
braucht TOR + BruteSSH = 700 k. Wie lange das dauert, habe ich nicht gerechnet
- aber der Mechanismus "erster Mietrechner = Ausweg" (`bn4net.js:632`) fehlt
strukturell, nicht graduell.
Was der Bot stattdessen tun müsste: Vor BN9 einen Hacknet-Server-Zweig
(`ns.hacknet.*`, 4 GB je Funktion; Hashes -> Geld) in WERKZEUGE, und die
Werkbank-Wahl darf gerootete Rechner mit weniger als 20 GB als Träger für
kleine Werkzeuge nehmen. Mindestens: der Kaltstart muss erkennen, dass
`getServerLimit() === 0` ist, und die Leiter durch einen Home-Ausbau ersetzen.

### 6. BitNode 8: die einzige Geldquelle hat keinen Starter
Schwere: MITTEL
Beleg: `BitNode.tsx:774-780` CompanyWorkMoney 0, CrimeMoney 0,
HacknetNodeMoney 0, ManualHackMoney 0, ScriptHackMoneyGain 0,
CodingContractMoney 0; Start 250 Mio (`Prestige.ts:38, 302-303`). `src/stocks.js`
existiert, steht nicht in WERKZEUGE und wird nirgends per `exec` gestartet
(`grep -n "stocks.js" src/bn4net.js src/bn4life.js` leer). Dazu Befund 2
(bbtrain `stopAction()` alle 30 s, weil der Beitritt bei BladeburnerRank 0
abgelehnt wird).
Was passiert: bn4net kauft aus den 250 Mio Rechner, danach steht das Konto;
Augmentierungen (Daedalus, Red Pill) werden nie bezahlbar. Drei Läufe am Ende
der Route. Die Roadmap nennt es selbst ("ein Börsen-Bot existiert noch nicht",
Zeile 42-44) - nur ist seit dem 24.08. nichts dazugekommen.
Was der Bot stattdessen tun müsste: stocks.js in die Rollentabelle aus
Befund 2 als Pflichtwerkzeug für BN8, Geldreserve für Augmentierungen aus dem
Startkapital sperren (`data/geldbedarf.txt` existiert dafür bereits).

### 7. `data/simulacrum.txt` ist seit dem Wechsel veraltet - und die Löschregel vom 30.08. steckt in einem Skript, das kein Automat je startet
Schwere: MITTEL
Beleg: Live auf home: `1788120181574` (30.08. 22:03, Lauf 1). Augmentierungen
sind beim Knotenwechsel weg (`PlayerObjectGeneralMethods.ts:174`
`this.augmentations = []`). `src/blade.js:2967-2973`: Marker vorhanden =>
`graftRiegel` aus. Die Löschung steht in `src/graft.js:74-75`, aber graft.js
wird nur per `tools/task.js` gestartet (Kopf `:20`; `grep exec.*graft src/`
leer); `boot.js` löscht den Marker nicht. `nodes/ERLEDIGT.md:569-574` hatte
"Zwei Zeilen `ns.rm` ... beim Knotenwechsel" gefordert - umgesetzt wurde es an
der Stelle, die nur ein Mensch auslöst.
Was passiert: Unter der Prämisse "kein Mensch" gibt es in BN10 L2/L3 gar kein
Grafting (graft.js, kampfaugs.js sind Handwerkzeuge) - die im ENTSCHIEDEN-Kopf
und ERLEDIGT.md:161-163 festgelegte BN10-Strategie ("erst das Paket graften,
dann EINMAL einbauen") existiert nur, solange jemand tippt. Sobald doch ein
Graft läuft, tötet `Bladeburner.startAction` es in ~1 s (`Bladeburner.ts:178`),
Verlust bis 450 Mrd ohne Erstattung.
Was der Bot stattdessen tun müsste: Marker mit Knotenstempel und Löschung in
boot.js; graft.js mit seiner Paketlogik in die Werkzeugliste (nur V2-Knoten,
nur mit Geldprüfung) - sonst die Strategie aus der Dokumentation streichen.

### 8. Zustandsdateien tragen keinen Knotenstempel; boot.js löscht eine Handliste statt nach Regel
Schwere: MITTEL
Beleg: `boot.js:73-77` löscht sechs benannte Dateien. Nicht darunter, obwohl
gelesen und knotengebunden: `data/exit-ziel.txt` (Befund 1),
`data/simulacrum.txt` (Befund 7), `data/task.txt` (`bn4net.js:437`,
`bn4life.js:270`; ein Auftrag, der während der ~1 s zwischen Sprung und
erstem Leser liegt, wird im neuen Knoten ausgeführt - derselbe Mechanismus wie
der `reload.txt`-Vorfall vom 25.08. 05:59, `boot.js:64-72`). Auf home
überleben außerdem `bn4rep.json`, `blade.json`, `bbjoin.txt`, `einbau.json`,
`aktionen.txt`; die Leser prüfen teils Frische (`bn4net.js:752-756`, 5 min),
teils nichts (`tools/tor.js`, BAUSTELLEN:228-243).
Was passiert: Jede neue Datei wiederholt das Muster; die Liste in boot.js ist
nur so vollständig wie der letzte Vorfall. Kosten pro Fall zwischen null
(task.txt praktisch nie getroffen) und einem Knoten (exit-ziel).
Was der Bot stattdessen tun müsste: Eine Regel statt einer Liste: Zustands-
dateien in `data/` tragen `{knoten, nodeReset}` (beides aus `getResetInfo()`,
1 GB), Leser verwerfen bei Abweichung; boot.js löscht alles unter einem
Präfix (z. B. `data/st-*`), das per Namenskonvention als knotengebunden gilt.

### 9. Nach jedem Wechsel läuft bis zum ersten Mietrechner nur bn4net - Werkzeugstarter, Tonanker und Popup-Wächter sind auf 32 GB unerreichbar
Schwere: MITTEL
Beleg: home 32 GB (`Prestige.ts:246-252`, bis SF9.2), bn4net 17,15 GB
-> 14,85 frei. Kleinstes WERKZEUG: contracts.js 17,65 (in BN10 auch bbtrain
94,75, sleeve 26,75, wakelock 27,25, popups 28,3 - beide DOM-Zugriff 25 GB).
`bn4net.js:822-829`: kein Werkzeug passt -> `werkbank = null` -> der gesamte
Starterblock `:2627` entfällt. Nur darkweb.js (2,65) läuft über den Nachholer
`:2600-2620`. Nach SF4.3 ändert sich das kaum: contracts 17,65 und wakelock
27,25 sind singularityfrei und bleiben zu groß; bbtrain 12,25 passt dann,
belegt aber den Platz.
Was passiert: Ohne wakelock.js bekommt ein verdeckter Tab einen Timer je
Minute statt sechzehn je Sekunde (Kommentar `:288-291`, Memory
"Browser-Tab-Drosselung") - genau in der Phase, in der jede Runde Geld für den
ersten Rechner sammelt. Der 13,5-h-Stillstand vom 01./02.09. (BAUSTELLEN:176-193)
lief unter diesen Bedingungen; wieviel davon Drosselung war, ist nicht messbar
(kein Tempo-Log vor 05:11). Es trifft alle Läufe bis SF9.2 (Route Nr. 5-9).
Was der Bot stattdessen tun müsste: Den Starter nicht an `werkbank` binden,
sondern je Werkzeug den kleinsten passenden Wirt suchen (die `ausweichwirt`-
Logik `:2780` gibt es schon, sie wird nur unter `if (werkbank)` erreicht); und
wakelock/popups auf einen Wirt außerhalb home legen dürfen (gerootete 16-GB-
Rechner reichen nicht - 27,25 GB -, aber n00dles/foodnstuff zusammen mit einer
1,6-GB-Variante ohne DOM wären eine Prüfung wert: Ton ließe sich auch über
`ns.ui`-freie Wege nicht erzeugen, das ist offen).

### 10. exit.js wird bei Abbruch alle 15 s neu gestartet, ohne dass jemand seinen Grund liest
Schwere: NIEDRIG
Beleg: `bn4rep.js:930-944`: exec, wenn nicht laufend; `data/exit.txt` wird nie
gelesen. exit.js kehrt bei "Requirements not met" still zurück
(`Singularity.ts:1183-1186` loggt nur). `zielLevel` in bn4rep wird EINMAL beim
Start berechnet (`:110-119`), in BN12 aus der Tabelle als 3000 statt
`3000 * 1,02^(SF12+1)` (`BitNode.tsx:993`, `ServerHelpers.ts:384`).
Was passiert: In BN12 L1 startet bn4rep exit.js ab Level 3000 alle 15 s, bis
das Level 3061 erreicht - selbstheilend, aber ein blinder Fleck: bn4rep tut in
dieser Schleife nichts anderes mehr (`continue` vor dem Kauf). Bei einem
wirklichen Fehler (Wurf in `destroyW0r1dD43m0n` bei ungültiger Nummer)
entsteht alle 15 s ein Fehlerdialog.
Was der Bot stattdessen tun müsste: exit.js schreibt einen Statuscode
(`data/exit.json` mit Grund), bn4rep liest ihn und wartet bei "Level fehlt"
auf den Wert statt neu zu starten.

---

## Was ich geprüft und für tragfähig befunden habe

- **Rückrufmechanik.** `destroyW0r1dD43m0n(ziel, "boot.js")` -> `enterBitNode`
  -> `prestigeSourceFile` -> `setTimeout(runAfterReset, 500)`
  (`Singularity.ts:1153-1194`); Sprung in den EIGENEN Knoten ist zulässig
  (`RedPill.tsx:53-93`, keine Einschränkung; live bewiesen 01.09. 15:59,
  `data/exit.txt` + `data/boot.txt`). Skripte überleben beide Resets
  (`ServerHelpers.ts:224-237` löscht nur Programme/Nachrichten).
- **home nach dem Wechsel** = 32 GB solange SF1 aktiv, 128 GB ab SF9.2
  (`Prestige.ts:246-252`); `activeSourceFileLvl` ohne Overrides = Besitz
  (`PlayerObjectGeneralMethods.ts:615-620`). bn4net.js 17,15 GB passt in jedem
  Knoten, ist singularityfrei; boot.js 4,0 GB. Nach einem Einbau bleibt home
  groß, boot.js startet dann auch bn4life direkt (293,8 < 512).
- **Der SF4-Malus ist auf die nächsten zwei Läufe begrenzt.** Reihenfolge
  BN10 L2/L3 (x16) -> BN4 L2 (im Knoten x1) -> BN4 L3 -> ab dann SF4.3, x1
  überall. Die Tabelle: bn4life 293,8 -> 77,8 -> 23,8; bn4rep 848,25 ->
  218,25 -> 60,75; blade.js 169,85 -> 109,85 -> 94,85; homegrow 148,5 -> 40,5
  -> 13,5; exit.js 519,25 -> 135,25 -> 39,25.
- **boot.js löscht `reload.txt`, `geldbedarf.txt`, `install-sperre.txt`,
  `beitritt-erledigt.txt`, `rep-modus.txt`, `company-order.txt`, `bn4-stop.txt`**
  - die Lehren vom 23.08. (nur auf bn4net warten), 25.08. 05:59 (reload.txt)
  und 25.08. 05:50 (Ausweichwirt für bn4rep, `bn4net.js:2769-2805`) stehen im
  Code, nicht nur im Kommentar. Der Wiederanlauf nach Einbau ist am 30.08.
  23:02 vollständig gemessen worden (ERLEDIGT:83-92).
- **Werkzeugliste nach Einbau** deckt blade, bbtrain, sleeve, bn4life,
  homegrow, contracts, wakelock, popups, bn4rep, bn4door; darkweb über den
  Nachholer; Entdopplung netzweit (`:2518-2573`). Bladeburner-Mitgliedschaft
  und Rang überleben den Einbau (`Prestige.ts:155-158`).
- **Aufräumen der Mietrechner beim Einbau** (`Prestige.ts:74`
  `prestigeAllServers`) trifft nur Telemetrie (`sleeve.json`, `blade.json`,
  `aktionen.txt`); alles Entscheidende wird nach home gespiegelt oder frisch
  gerechnet.
- **exit.js** validiert 1-15, prüft boot.js auf home, kennt beide Wege,
  umgeht `serverExists` korrekt für den Black-Ops-Weg.

## Was ich nicht prüfen konnte

- Die tatsächliche Dauer eines BN9-Kaltstarts ohne Mietrechner (Befund 5):
  dafür bräuchte es die Hacking-Einnahmen bei ServerMaxMoney 0,01 als
  Rechnung gegen die 700 k für TOR+BruteSSH - nicht mehr in der Zeit.
- Ob der Wechsel nach BN6 (`RedPill.tsx:88-89`, `Page.BladeburnerCinematic`)
  irgendetwas an Skriptstart oder DOM-Werkzeugen (darkweb.js, homeram.js)
  stört. Zweimal auf der Route (BN6 L2, L3).
- Ob die Engine nach einem Browser-Neustart alle laufenden Skripte aus dem
  Spielstand zurückholt (ERLEDIGT:5385 sagt ja, `loadAllRunningScripts`);
  nicht selbst nachvollzogen.
- Den Anteil der Tab-Drosselung am 13,5-h-Stillstand (Befund 9); Tempo-Log
  beginnt erst 05:11.
- wakelock.js-RAM (27,25 gerechnet gegen 34,25 gemessen am 25.08.) - Datei
  seither verändert, keine frische Messung verfügbar.
