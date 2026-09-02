# Skeptiker: Anschlussstellen und Substanz (02.09.2026, 17:41)

Winkel: passen bn4rep.js, boot.js, bn4net.js, ausgang.js, route.json und die
Werkzeuge zusammen - und was fehlt. Grundlage: `git diff`, Quellcode
`reference/v301`, Live-Dateien ueber die Bruecke (nur gelesen).

Kurzfassung: **Kein KRITISCH.** Der Sprung BN10 L2 -> L3 wird so laufen. Was
nicht zusammenpasst, liegt an den Raendern: das Check-in-Werkzeug und der
/bb-Skill beschreiben noch die Welt von gestern (und wuerden einen Handsprung
anstossen, der die `braucht`-Sperre umgeht), die beiden Rueckfaelle bei
fehlender `verfahren.txt` widersprechen sich, und die `braucht`-Sperre
meldet sich erst, wenn der Knoten fertig ist.

---

## Antworten auf die sieben Fragen (Zahlen, keine Schaetzungen)

**1. bn4rep `bladeburnerTraegtHier()`.** Aufrufe je 15-s-Runde: Z. 738
(Einbausperre), Z. 941 (`kampfKnotenEinbau`), Z. 1446 (`kampfKnoten` in
der Guetezahl), dazu Z. 1304 ODER Z. 1838 ueber den Alias
`bladeSperreArbeit` - also 3-4 je Runde, jeder mit getResetInfo + fileExists
+ scp (bn4rep laeuft auf werk-10, nie auf home) + read. scp ist synchron,
`ns.disableLog("ALL")` steht in Z. 42 - kein Lograuschen, keine messbare
Zeit. **RAM: unveraendert bis gesunken.** fileExists/getHostname/scp/rm/read
standen schon in HEAD (`git show HEAD:src/bn4rep.js` Z. 317-335, liesVonHome
/ schreibNachHome / loeschAufHome). Entfernt wurden `ns.ps` (0,2) und
`ns.exec` (1,3), sonst nirgends in der Datei benutzt (`grep "\.exec(\|\.ps("`
leer) - bn4rep wird um 1,5 GB kleiner. Nichts passt "wieder nirgends".

**2. Der entfernte Ausgangsblock.** Tot ist nur `rufeMenschen` (Z. 372,
kein Aufrufer mehr; RAM-neutral, weil schreibNachHome weiter genutzt wird).
`liesVonHome` (Z. 532, 596, 714, 1283) und `loeschAufHome` (Z. 387, 598,
778, 1282, 1284) leben. Verlorene Seiteneffekte: (a) `loeschAufHome("data/
hilfe.txt")` nach geglücktem exec - bn4rep schreibt hilfe.txt nicht mehr,
bbtrain aber noch (bbtrain.js:202, :317), und boot.js raeumt sie nicht
(Befund 6). (b) Kaufsperre und 15-s-Warten sind erhalten: der neue Block
schlaeft 15 s und `continue`t. Die Schleife ist `for (;;) { try { ... }
catch { } await ns.sleep(15000); }` (Z. 440, 1938-1942); `continue` aus dem
try springt ueber das Schluss-sleep, aber der Block schlaeft selbst -
**keine enge Schleife.** Was der Block ausserdem ueberspringt (Telemetrie
`data/bn4rep.json`), tat er vorher auch (Kommentar Z. 447: "Ausgangsphase").

**3. bn4net und der frische 32-GB-home.** `ns.getResetInfo()` stand schon in
HEAD (Z. 2910/2911, Telemetrie), `ns.read` ebenso (Z. 394 u. a.) - der
V1-Filter kostet 0 GB. Rechnung: boot.js (4,0 GB = 1,6 + fileExists 0,1 +
rm 0,6 + getServerMaxRam 0,05 + getServerUsedRam 0,05 + ps 0,2 +
getScriptRam 0,1 + exec 1,3) beendet sich in derselben Runde, in der
bn4net laeuft (boot.js:127-131) - es belegt also nichts mehr, wenn bn4net
seine erste Runde faehrt. Frei: **32 - 17,75 = 14,25 GB; nach ausgang.js
(10,9, nachgerechnet: 1,6 + getHostname 0,05 + scp 0,6 + fileExists 0,1 +
scan 0,2 + MaxRam 0,05 + UsedRam 0,05 + getResetInfo 1 + getNextBlackOp 2 +
serverExists 0,1 + getServer 2 + getPlayer 0,5 + ps 0,2 + hasRootAccess 0,05
+ getScriptRam 0,1 + scriptKill 1,0 + exec 1,3 = 10,9) bleiben 3,35 GB.**
Der Starter kommt auch dran: Werkbank = home, weil `kleinstes` = popups.js
1,6 GB <= 14,25 (bn4net.js:825-831). In Runde 1 fuellen die Arbeiter home
zwar bis auf reserveHome() = min(16, 12,5, 7,125) = 7,1 GB, aber der
Raeumblock (Z. 2705-2725) killt Arbeiterarten auf der Werkbank, bis 10,9
frei sind, dann exec. Ab Runde 2 legt der Verteiler auf home nichts mehr
nach (frei 3,35 < Reserve 7,1). darkweb.js (27,65 GB, DOM) blockiert nichts
davor, es passt auf home ohnehin nicht. Siehe aber Befund 4 (Kante).

**4. Fenster ohne verfahren.txt.** boot.js loescht sie bei t=0; bn4net
startet ~5 s spaeter, ausgang.js in bn4nets Runde 1, und ausgang.js
schreibt die Datei in seiner ersten Iteration (`liesVonHome(...) !==
verfahrenZeile` ist nach dem Loeschen immer wahr, ausgang.js:136-138).
**Fenster ~5-15 s.** bn4rep laeuft in dieser Zeit nie: 848 GB mit SF4.1
ausserhalb BN4, ~53 GB in BN4 - bei 3,35 GB frei auf home braucht es
mindestens den ersten 64-GB-Rechner. Der Rueckfall `BLADE_KNOTEN` wird also
nur wirksam, wenn ausgang.js **gar nicht** laeuft (Befund 2).

**5. Wer verfahren.txt nicht liest, es aber sollte.** sleeve.js (Befund 5:
in V1-Knoten trainiert es Kampfwerte fuer einen Beitritt, der nie kommt,
gegen Gymgeld). tools/checkin.js und skills/bb.md (Befund 1). tools/
strategie-check.js:487 und tools/wache.js:855 tragen noch `[6, 7, 10]`
(Befund 8). blade.js und bbtrain.js brauchen es nicht selbst - bn4net
startet sie in V1-Knoten nicht; bn4life.js haengt korrekt an
`inBladeburner()` (Z. 367). tools/tor.js ist reine Anzeige (Gym-ETA), in
V1-Knoten sinnlos, aber harmlos.

**6. checkin.js / bb.md** - konkrete Liste in Befund 1.

**7. route.json gegen Roadmap Abschnitt 2.** Reihenfolge identisch (BN10 L2
L3, BN4 L2 L3, BN9 x3, BN1 L2 L3, BN5 L2 L3, BN12 x3, BN2 x3, BN3 x3,
BN11 x3, BN6 L2 L3, BN7 x3, BN14 x3, BN13 x3, BN15 x3, BN8 x3 = 40).
Verfahren je Eintrag stimmen mit der Tabelle: BN12 V1 ist von "V1 oder V2"
gedeckt; BN15 V2 entspricht der Tabellenzeile ("V2 mit Labyrinth-Option"),
weicht aber vom Nachtrag D ab (Befund 10). BN4 L2/L3 V2 stimmt. Fehlende
Gewerke: hashes.js (BN9, in `braucht`), boerse.js (BN8, in `braucht`),
Labyrinth (BN15, optional, NICHT in `braucht` - richtig so, sonst staende
der Bot). Weitere Knoten brauchen nichts, was nicht existiert: Gang (BN2),
Corporation (BN3), Stanek (BN13), Go (BN14) sind laut Roadmap Bonus, nicht
Pflicht. `ownedSF` ist im Spiel eine `Map<number, number>`
(NetscriptFunctions.ts:1491) - planeRoute behandelt Map und Objekt.

---

## Befunde

### 1. /bb und checkin.js widersprechen dem neuen Ausgang - und der Skill wuerde einen Handsprung anstossen, der `braucht` umgeht
Schwere: HOCH
Beleg: skills/bb.md:66-108 (Abschnitt 3: "Der Bot loest ihn nicht selbst
aus", Schritt 3 `node tools/task.js exit.js <zielknoten>`), tools/checkin.js
:185-215 (`RESET BEREIT` allein aus blade.json), :238-250 (kein Rang ->
`ANLAUF`), :104-107 (liest blade/bblage/bn4net/hilfe, NICHT ausgang.json).
Was passiert: (a) In jedem V1-Knoten (BN1 L2/L3, BN5 L2/L3, BN12 x3, BN8 x3
= 10 Laeufe, ~200-300 h) gibt es keinen Bladeburner-Rang; checkin meldet die
gesamte Laufzeit `ANLAUF: kein Bladeburner-Rang messbar - der Knoten ist
frisch, die Division noch nicht offen` und verweist auf tor.js. Eric sieht
weder Fortschritt noch Stillstand. (b) In V2-Knoten meldet checkin bei
`naechsteBlackOp === null` `RESET BEREIT` und der Skill verlangt eine
Rueckfrage plus `task.js exit.js` - waehrend ausgang.js binnen 60 s selbst
springt. Kommt der Handsprung vorher durch, ist er ein exit.js ohne die
`braucht`-Pruefung: am Ende von BN4 L3 wuerde /bb den Bot nach BN9 schicken,
obwohl hashes.js fehlt - genau der Stillstand, den route.json verhindert.
(c) Die Stillstandsfaelle des neuen Ausgangs (Gewerk fehlt, exit.js passt
nirgends, exec gab 0) sieht niemand: sie stehen nur in data/ausgang.txt.
Fix (Liste, kein Code):
- checkin.js liest `data/ausgang.json` (Alter wie bei den anderen Quellen
  pruefen) und `data/verfahren.txt`; Kopfzeile wird "BitNode 10 Lauf 2 (V2),
  Ziel BN10 L3".
- Urteil `RESET BEREIT` ersetzen: `offen === true` und `letzterStart === 0`
  laenger als 2-3 min -> `SPRUNG KLEMMT` mit der letzten Zeile aus
  data/ausgang.txt; `offen === true` und `letzterStart > 0` -> `SPRINGT`
  (exit.js laeuft seit x min, data/exit.txt zeigen); Knotenwechsel gegen den
  letzten Check-in-Punkt erkennen ("BN10 L2 -> L3 geglueckt").
- Enthaelt die letzte ausgang.txt-Zeile "fehlt auf home" -> Urteil
  `GEWERK FEHLT` (Exit-Code 1, Dateiname nennen).
- V1-Zweig: statt Rang die Hackingschaetzung aus `ausgang.json.status`
  ("Hacking 2500/3000") und `data/bn4rep.json` (redPill, zielLevel,
  hacking); der Rang-Zweig nur bei Verfahren V2.
- Exit-Code-Liste um die neuen Urteile ergaenzen.
- bb.md Abschnitt 3 komplett neu: kein Handsprung, keine Rueckfrage; bei
  `SPRINGT` eine Minute spaeter erneut messen; bei `SPRUNG KLEMMT` /
  `GEWERK FEHLT` Eric sagen, was fehlt. Verweise auf `bn4rep.js:891/:907`,
  den Sofort-Punkt vom 31.08. und "Zielknoten aus AUDIT-ROADMAP holen"
  streichen - die Route ist `src/route.json` (die Bruecke synchronisiert
  .json, bridge.js:135), Aenderungen daran nur mit gruenem
  `node tools/test-route.js`.
- bb.md Tabelle in Abschnitt 2 und Ausgabe in Abschnitt 5 (Punkt 1 um
  Lauf/Verfahren/Ziel) anpassen; "tools/tor.js rechnet diese Phase aus"
  nur fuer V2.
- nodes/BAUSTELLEN.md: Eintrag "Der Bot erkennt den Black-Ops-Ausgang
  nicht (31.08.)" und den Sofort-Kopf als erledigt (mit Datum) markieren.

### 2. Die beiden Rueckfaelle bei fehlender verfahren.txt widersprechen sich
Schwere: MITTEL
Beleg: bn4net.js:2646-2653 (`verfahrenV1` = false, wenn Datei fehlt ->
blade.js und bbtrain.js werden gestartet = "V2"); bn4rep.js:79-93
(Rueckfall `BLADE_KNOTEN = [6, 7, 10]` = "V1" fuer 12 von 15 Knoten).
Was passiert: Laeuft ausgang.js nicht (Startfehler auf dem 32-GB-home,
Befund 4; Absturz; Doppel-Kill), dann in BN4/9/2/3/11/13/14/15: bn4net
startet bbtrain (Gym, Beitritt) und blade.js, bn4rep haelt den Knoten fuer
einen Hackingknoten - Faktionsarbeit gegen Bladeburner-Aktion im
Sekundentakt, Einbau ohne Beitrittssperre. Das ist der Vorfall vom 25.08.
(ERLEDIGT.md:7446), nur in acht neuen Knoten. Umgekehrt in BN1/5/12: bn4net
startet bbtrain, die Figur geht ~10 h ins Gym und tritt der Division bei
(SF6.1 erlaubt das), waehrend bn4rep Faktionsarbeit will.
Fix: Einen Rueckfall, nicht zwei. Vorschlag: bn4net startet blade.js und
bbtrain.js NUR, wenn verfahren.txt fuer diesen Knoten "V2" sagt
(`verfahrenBekannt && !verfahrenV1` statt `!verfahrenV1`); bn4rep behandelt
"Datei fehlt" wie V2 (Einbausperre an, keine Faktionsarbeit) statt ueber
BLADE_KNOTEN zu raten. Dann ist ein fehlendes ausgang.js ein sichtbarer
Stillstand (bn4rep meldet "Divisionsbeitritt steht aus") statt eines
Konflikts. `BLADE_KNOTEN` kann weg.

### 3. Die `braucht`-Sperre meldet sich erst, wenn der Knoten fertig ist
Schwere: MITTEL
Beleg: ausgang.js:186-191 (Pruefung erst nach `offen`), route.json:10
(BN9 braucht hashes.js), AUDIT-AUTONOMIE I.6 ("BN9-Gewerk ... rund 3 Laeufe
Zeit"), src/ enthaelt weder hashes.js noch boerse.js.
Was passiert: Der Bot faehrt BN10 L3, BN4 L2, BN4 L3 (~80 h) und stellt am
Ende von BN4 L3 fest, dass hashes.js fehlt. Ab da steht er - in einem
fertigen Knoten, ohne dass irgendein Werkzeug es meldet (Befund 1c). Die
Warnung kaeme drei Laeufe frueher, wenn sie beim Eintritt stuende.
Fix: In Schritt 3 ("Dieser Lauf") zusaetzlich `ziel.braucht` pruefen und
bei Fehlen sofort schreiben: "Naechstes Ziel BN9 braucht hashes.js - fehlt
auf home; bis Ende dieses Laufs bauen." Dazu ein Feld `gewerkFehlt` in
ausgang.json, das checkin.js als Hinweiszeile ausgibt. Die Sperre selbst
bleibt (ein Sprung in einen Knoten ohne Gewerk waere schlimmer als Warten).

### 4. ausgang.js sitzt auf einer 3,35-GB-Kante - und kollidiert mit Umbau I.3
Schwere: MITTEL
Beleg: Rechnung oben (Frage 3); AUDIT-AUTONOMIE I.3 ("bn4net um 2 GB
verschlanken, damit contracts.js ab Sekunde 1 auf home laeuft; wakelock
unter 15 GB und an Position 1").
Was passiert: Waechst bn4net um mehr als 3,35 GB (jede neue ns-Funktion
zaehlt), startet ausgang.js auf einem frischen home nicht mehr, und
verfahren.txt wird in der Anlaufphase nie geschrieben - Befund 2 wird
scharf. Und Umbau I.3 ist damit unerreichbar: contracts.js (17,65) oder
wakelock (<15) neben bn4net (17,75) UND ausgang.js (10,9) passen nie in 32
GB. Das Werkzeug fuer das ENDE des Laufs belegt den knappsten Speicher am
ANFANG.
Fix: ausgang.js um 2,85 GB verschlanken, ohne Verhalten zu aendern:
`ns.getServer(WD).requiredHackingSkill` -> `ns.getServerRequiredHackingLevel
(WD)` (2,0 -> 0,1), `ns.getPlayer().skills.hacking` ->
`ns.getHackingLevel()` (0,5 -> 0,05), `ns.scriptKill(w, wirt)` -> `ns.kill
(pid)` je Prozess (1,0 -> 0,5). Ergebnis 8,05 GB, Kante 6,2 GB. Alternativ
im Starter: ausgang.js erst starten, wenn verfahren.txt fuer diesen Knoten
fehlt ODER home >= 64 GB - dann schreibt es die Datei einmal, und der Platz
bleibt bis zum Ausbau frei (braucht aber eine Ausnahme von der Endlos-
Neustartlogik, wie bei bbtrain diskutiert).

### 5. sleeve.js schickt in Hackingknoten alle Sleeves ins Gym - fuer nichts
Schwere: MITTEL
Beleg: sleeve.js:121-122 (`inDivision = inBladeburner()`), :311-320 (sonst
Gym, Rueckfall Shoplift); BAUSTELLEN.md:140-161 (Gym ohne Geldpruefung,
-73.000 $/s bei zwei Sleeves).
Was passiert: In BN1/5/12/8 (10 Laeufe) tritt niemand der Division bei;
die Sleeves trainieren trotzdem dauerhaft Kampfwerte (Gymkosten je
Koerper, Erfahrung fliesst per Sync an die Figur - deren Kampfwerte sind
im Hackingweg wertlos). Der Ertrag ist null, die Kosten laufen den ganzen
Lauf; am Kaltstart (BN8: $250 Mio Start, kein Hackgeld) ist das genau die
Minus-Spirale vom 02.09., 06:00.
Fix: sleeve.js liest verfahren.txt (wie bn4net, 0 GB); bei V1/V1b kein
Gym, sondern `setToCommitCrime` (Mug/Homicide: Geld) oder Faktionsarbeit
fuer das aktuelle bn4rep-Ziel. Der Geldboden (I.2) bleibt zusaetzlich
noetig.

### 6. boot.js raeumt data/hilfe.txt nicht - ein alter Notruf ueberlebt den Sprung
Schwere: NIEDRIG
Beleg: boot.js:80-86 (Liste ohne hilfe.txt); bbtrain.js:202, :317
(schreibt sie); bn4rep.js:387 loescht sie erst bei SEINEM Start (Stunden
nach dem Sprung); checkin.js:153-157, :310 (`HILFE` schlaegt alles).
Was passiert: Schreibt bbtrain im alten Knoten einen Notruf (Beitritt
abgelehnt, Gym-Stadt unbekannt), meldet /bb im neuen Knoten `HILFE` mit
einem Text, der zum alten Knoten gehoert - bis bn4rep laeuft. Vorher
raeumte der alte Ausgangsblock die Datei beim exec (Z. 942 HEAD).
Fix: `"data/hilfe.txt"` in die boot.js-Liste Z. 80-84.

### 7. `rufeMenschen` ist toter Code, und der Kommentar darueber verspricht eine Leitung, die es nicht mehr gibt
Schwere: NIEDRIG
Beleg: bn4rep.js:360-374 (Definition + Kommentar "jede Zeile hier klingelt
bei Eric"), kein Aufrufer (`grep rufeMenschen src/bn4rep.js` = nur Z. 372).
Was passiert: Nichts im Betrieb. Wer die Datei liest, glaubt an einen
Notrufkanal.
Fix: Funktion und Kommentarblock entfernen (RAM-neutral); bbtrain's zwei
hilfe.txt-Schreiber sind der Rest von Audit-Befund A5 und gehoeren in
Umbau I.4.

### 8. strategie-check.js und wache.js tragen noch `BLADE_KNOTEN = [6, 7, 10]`
Schwere: NIEDRIG
Beleg: tools/strategie-check.js:487-488, :599; tools/wache.js:855-856
(abgeschaltet seit 31.08.); bb.md:123 empfiehlt strategie-check in
Abschnitt 4.
Was passiert: In BN4 L2 (V2) haelt strategie-check den Knoten fuer einen
Hackingknoten und prueft die falschen Groessen - genau dann, wenn /bb ihn
bei `ZAEH`/`STEHT` zurate zieht.
Fix: beide lesen `data/verfahren.txt` ueber die Bruecke (Knoten pruefen,
wie bn4rep); die Listen weg.

### 9. ausgang.js raeumt beim Sprung nur Arbeiter, nie Werkzeuge - exit.js kann auf einem vollen Park nirgends passen
Schwere: NIEDRIG
Beleg: ausgang.js:210-221 (`moeglich = frei + arbeiter`), :222-228 (kill nur
WORKER); exit.js 519 GB mit SF4.1 (bis BN4 L2 abgeschlossen; danach ~130,
dann ~33 GB).
Was passiert: Ist home klein (Wechsel vor dem Ausbau, z. B. nach einem
spaeten Einbau) und der groesste Rechner mit bn4rep 848 + bn4life 294 +
homegrow 148 + bbtrain 95 + bn4door 100 belegt, liegt `frei + arbeiter`
unter 519 und der Bot meldet jede Minute "passt nirgends" - im fertigen
Knoten. Am 02.09. (home 1024, 256 frei + ~700 Arbeiter) passt es; die
Konstellation ist selten, aber ein Stillstand am teuersten Punkt.
Fix: Wenn kein Wirt reicht, auf dem groessten Wirt zusaetzlich alles ausser
bn4net.js und ausgang.js selbst beenden (`ns.kill(pid)`) - der Knoten ist
fertig, es geht nichts verloren.

### 10. BN15 steht mit 3x V2 in der Route, der Nachtrag D empfiehlt Lauf 1 als Labyrinth
Schwere: NIEDRIG
Beleg: route.json:40-42; AUDIT-ROADMAP Nachtrag D ("BN15-Lauf 1 als
Labyrinth-V1 planen ... Laeufe 2-3 je nach Messwert"); Tabelle Zeile 39-41
("V2 mit Labyrinth-Option"); 94 h V2-Simulation je Lauf gegen 10-35 h
Labyrinth-Rechnung.
Was passiert: Nichts Falsches - ohne Gewerk ist V2 der einzige fahrbare
Weg, und `braucht` fuer ein optionales Gewerk waere ein Stillstand. Aber
bis zu ~180-250 h Unterschied haengen an einer Entscheidung (Audit I.9),
die vor Position 39 faellt; die Route muss dann geaendert werden, und
`V1b` hat in ausgang.js dieselbe Ausgangsbedingung wie V1 (WD am Netz +
Level) - das stimmt fuer die Labor-Pille.
Fix: kein Code. In route.json `hinweis` ergaenzen: "BN15 vor Eintritt
pruefen (Audit I.9); V1b braucht ein Labyrinth-Gewerk."

---

## Tragfaehig (geprueft, kein Einwand)

- **Sprungkette** ausgang.js -> `ns.exec("exit.js", wirt, 1, ziel.node)` ->
  exit.js prueft Black Ops ODER Hacking (exit.js:66-90, :101-136) ->
  `destroyW0r1dD43m0n(ziel, "boot.js")` (Singularity.ts:1153-1193: ODER-
  Bedingung, `runAfterReset` nach 500 ms) -> boot.js loescht und startet
  bn4net -> bn4net startet ausgang.js (Position 1) -> verfahren.txt neu.
  exit.js und boot.js haben keine Imports; `ns.scp(["exit.js", "lib/
  hackaugs.js"])` reicht.
- **V1-Bedingung** `serverExists(WD)`: ist erst nach Einbau von The Red
  Pill wahr (`serversOnNetwork.length > 0`, NetscriptFunctions.ts:1051-1054;
  ServerHelpers.ts:314) - deckungsgleich mit bn4reps Endspiel-Riegel
  (`!ausgangSteht` blockiert Einbau, Z. 1037). Kein Einbau kann den
  erreichten Level mehr zuruecksetzen.
- **V2-Bedingung** `getNextBlackOp() === null` <=> `numBlackOpsComplete >=
  21` (NetscriptFunctions/Bladeburner.ts:88-93), dieselbe Zahl wie in
  destroyW0r1dD43m0n:1180. Das Spiel beendet nach Daedalus keine Skripte
  (Bladeburner.ts:1030 zaehlt nur hoch; am 01.09. lief der Bot nach 21/21
  weiter, data/exit.txt 15:59).
- **bn4reps WD_DIFFICULTY-Tabelle** (Z. 128-129) gegen BitNode.tsx:
  14 von 15 exakt; BN12 steht mit 1 statt 1,02^lvl (3000 statt 3060-3184)
  - die sichere Richtung, bn4rep hoert frueher auf zu kaufen, ausgang.js
  wartet auf den echten Wert aus `getServer(WD)`.
- **boot.js-Loeschliste**: exit-ziel.txt hat keinen Leser mehr (nur
  Kommentare); task.txt wird von tools/task.js per pushFile geschrieben
  und von bn4net nach dem Lesen geleert; simulacrum.txt legt graft.js aus
  `getOwnedAugmentations` neu an und loescht es bei Fehlen selbst
  (graft.js:40-77) - auch mit SF7.3 (Gratis-Simulacrum) korrekt.
- **route.json erreicht home**: bridge.js:135 `SYNCABLE = /\.(js|jsx|ts|
  tsx|txt|json|script)$/`; live liegt die Datei auf home.
- **Live-Stand 17:28-17:40**: verfahren.txt "V2 10 2", ausgang.json
  `offen:false`, Status "keine Division; w0r1d_d43m0n nicht am Netz" -
  konsistent mit BN10 L2 vor dem Beitritt.
- **Doppel-Instanzen**: bn4net zaehlt `laufend` netzweit (Z. 2527-2532);
  das von Hand gestartete ausgang.js auf werk-10 wird vom neuen bn4net als
  laufend erkannt, nicht doppelt gestartet.
- **test-route.js** deckt Reihenfolge, Stufenaufstieg, Selbstsprung und
  Randfaelle; `braucht` ist bewusst nicht Teil von planeRoute.

## Nicht geprueft

- bn4net-RAM 17,75 GB ist aus Briefing/Audit uebernommen, nicht selbst
  nachgerechnet (die Bruecke hat kein getScriptRam).
- exit.js-RAM 519 GB: aus dem Audit, im Spiel nicht gemessen (Audit J
  sagt dasselbe).
- Verhalten von blade.js nach 21/21, bis exit.js greift (BAUSTELLEN:657
  `blackOpArbeit`) - hoechstens 60 s, nicht verfolgt.
- Ob `ns.kill(pid)` auf einem fremden Wirt die Entdopplung von bn4net
  stoert, wenn Befund 9 umgesetzt wird.
- BN9 ohne Mietrechner (`getServerLimit() = 0`): ob bn4nets Werkbank-
  und Ausbaulogik dort ueberhaupt eine Werkbank findet - anderer Winkel.
