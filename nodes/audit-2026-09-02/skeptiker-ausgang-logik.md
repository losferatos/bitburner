# Skeptiker: Logik und Praemisse von planeRoute / ausgang.js (02.09.2026, 17:31-17:45)

Winkel: die Rechnung in `planeRoute` und die Ausgangsbedingung, gegen den
Spielquellcode v3.0.1 und gegen den Live-Stand (BN10 L2, ausgang.js auf
werk-10, `ausgang.json.zeit` = 17:40:46 bei Abfrage 17:41:03 - der Prozess
lebt). `node tools/test-route.js` ist gruen (39 Spruenge).

Kurzfassung: Die Kernrechnung (Stufe des verlassenen Knotens +1, Ziel =
erster offener Eintrag, Selbstsprung) stimmt gegen `RedPill.tsx`. Was nicht
stimmt, sitzt daneben: die V1-Bedingung prueft nicht, was `destroyW0r1dD43m0n`
wirklich verlangt, der Neustart von exit.js hat keine Bremse und raeumt bei
jedem Versuch Arbeiter, und `braucht` ist ein Stillstand ohne Ruf - also
genau die Fehlerklasse, die der Umbau abschaffen sollte.

---

### 1. V1-Bedingung prueft Hacking, das Spiel verlangt Hacking UND Root - und der Fehlschlag ist unsichtbar und wiederholt sich im Minutentakt mit Arbeiter-Kill
Schwere: HOCH
Beleg:
- `Singularity.ts:1170-1175`: `hackingRequirements = hacking >= wd.requiredHackingSkill && wd.hasAdminRights`; bei Nichterfuellung `helpers.log(...); return;` - **kein Wurf, stille Rueckkehr** (`:1183-1186`).
- `NetscriptFunctions.ts:541-544`: `nuke` bei zu wenig Ports: `log; return false` - **kein Wurf**.
- `src/exit.js:118`: `try { ns.nuke(WD); sag("Root auf " + WD + " geholt."); }` - Rueckgabewert wird nicht gelesen, die Protokollzeile luegt bei `false`.
- `src/ausgang.js:166`: `ueberHacking = level >= noetig` - Root und `numOpenPortsRequired` (5, `servers.ts:1535`) fehlen.
- `src/ausgang.js:222-230`: vor jedem `exec` werden auf dem Wirt Arbeiter gekillt; `:235` setzt `letzteMeldung = ""`; es gibt keinen Rueckhalt, wenn exit.js ohne Sprung endet.
Was passiert: Hacking >= Soll, TRP eingebaut, aber ein Portknacker fehlt (oder irgendein anderer Grund, aus dem destroy still zurueckkehrt) -> exit.js oeffnet 4 Ports, `nuke` gibt false, exit.txt sagt "Root geholt", `destroyW0r1dD43m0n` kehrt still zurueck, exit.js endet nach ~1 s. Naechste Runde: exit.js laeuft nirgends -> groesster Wirt gewaehlt -> `frei < 519 GB` -> **alle vier Arbeitertypen dort gekillt** -> exec -> exit.js scheitert erneut. Das wiederholt sich jede Minute, endlos, ohne Meldung, die den Grund nennt (exit.txt zeigt "Root geholt"), und der groesste Hackwirt liefert nichts mehr. Eintrittswahrscheinlichkeit gering (wer TRP hat, hatte 100 Mrd; darkweb.js kauft die Programme), aber der Ausschluss ist mit dem vorhandenen Werkzeug nicht pruefbar - genau der Fall "Werkzeug kann den Fehler nicht anzeigen".
Fix (drei Zeilen):
- ausgang.js:166: `const s = ns.getServer(WD); const progs = ["BruteSSH.exe","FTPCrack.exe","relaySMTP.exe","HTTPWorm.exe","SQLInject.exe"].filter(p => ns.fileExists(p, "home")).length; ueberHacking = level >= s.requiredHackingSkill && (s.hasAdminRights || progs >= s.numOpenPortsRequired);` und `progs` in `status` ausgeben.
- exit.js:118: `if (!ns.nuke(WD)) { sag("nuke: zu wenig Ports offen"); return; }`.
- ausgang.js Schritt 7: wenn `letzterStart > 0` und exit.js nicht mehr laeuft und wir noch im selben Knoten sind, erst nach z. B. 15 min neu starten und die letzte Zeile aus data/exit.txt ins Protokoll kopieren (`sag("exit.js endete ohne Sprung: " + letzteZeile)`).

### 2. `braucht` ist ein Stillstand ohne Ruf - und er ist klebrig fuer die ganze Route
Schwere: HOCH (Praemisse)
Beleg:
- `src/route.json` Position 5-7: `braucht: "hashes.js"`; `ls src/` zeigt **keine hashes.js** (nur invest.js/netburner.js beruehren die Hacknet-API, kein `spendHashes`). Position 38-40: `braucht: "boerse.js"` - existiert nicht; das vorhandene `stocks.js` ist der 4S-Haendler (Kopfkommentar), nicht das gemeinte Gewerk.
- `src/ausgang.js:187-191`: bei fehlender Datei `sleep; continue` - jede Minute, fuer immer.
- `planeRoute` (`:65-66`) kennt `braucht` nicht: `ziel` bleibt BN9 L1, egal wo der Bot steht. Beispiel: Eric springt von Hand nach BN1 -> dort ist `ziel` wieder BN9 L1 -> nach BN1 L2 derselbe Stillstand.
- Audit Abschnitt A.5 (Notruf = Stillstand) und I.6 (Hash-Verkaeufer "vor Position 8", d. h. nach drei Laeufen ~1-2 Wochen).
Was passiert: BN4 L3 faellt, Ausgang offen, hashes.js fehlt -> der Bot sitzt in einem fertigen Knoten, Bladeburner/Hacking laufen weiter und erwirtschaften nichts, was den naechsten Lauf beschleunigt. Kein Ruf (ntfy aus), keine Datei in BAUSTELLEN.md, nur eine Zeile in data/ausgang.txt, die niemand liest. Das ist der Zustand "Ruf ohne Empfaenger" mit anderem Namen. Der Test sieht es nicht, weil `braucht` ausserhalb der reinen Funktion liegt.
Fix: `braucht` in `planeRoute` ziehen: `planeRoute(route, cur, sf, vorhanden = () => true)` und `ziel = eintraege.find(e => nachDiesemLauf(e.node) < e.level && (!e.braucht || vorhanden(e.braucht)))`; in main `planeRoute(route, cur, info.ownedSF, (d) => ns.fileExists(d, "home"))`. Uebersprungene Eintraege einmal protokollieren ("BN9 uebersprungen: hashes.js fehlt"). Die Reihenfolge bleibt erhalten: BN9 ist weiter der erste offene Eintrag und wird gewaehlt, sobald die Datei liegt. Testfaelle: ohne hashes.js muss das Ziel nach BN4 L3 BN1 L2 sein; mit hashes.js BN9 L1. Wer die strenge Reihenfolge will, muss das als bewussten Stillstand in `nodes/BAUSTELLEN.md` unter `## Sofort` fuehren - dann ist es wenigstens ein Ruf mit Empfaenger. Meine Einschaetzung: ueberspringen. Eine verschenkte Woche wiegt mehr als SF9-Boni beim Kaltstart spaeterer Knoten.

### 3. Der Ausgang ist strenger als das Spiel: nur das erklaerte Verfahren zaehlt
Schwere: MITTEL
Beleg: `Singularity.ts:1183`: `if (!hackingRequirements() && !bladeburnerRequirements()) return;` - **ODER**. `src/ausgang.js:171-173`: `offen = V2 ? ueberBlackOps : V1 ? ueberHacking : (beides)`.
Was passiert: Der Sprung ist derselbe, egal ueber welchen Weg (`enterBitNode` gibt die SF gleich, `RedPill.tsx:60-66`). Strenge bringt nichts, kostet aber: bleibt der erklaerte Weg stecken (V2-Knoten: Beitritt scheitert an Kampfwerten oder Rang-Multiplikator; BN15 mit Rang 0,2 = 94 h, waehrend eine TRP aus dem Labor ignoriert wuerde; V1-Knoten: Daedalus-Einladung bleibt aus), wartet der Bot, obwohl die andere Tuer offen ist. In BN12 (WD 3060/3121/3184 nach `3000 * 1,02^(SF12+1)`, `BitNode.tsx:925,993,1134`) ist Hacking sicher der schnellere Weg, in BN2/14 (Faktor 5 = 15.000) sicher nicht - die Rechnung soll das Werkzeug steuern, nicht die Tuer.
Fix: `const offen = ueberBlackOps || ueberHacking;` (mit Fix 1 fuer ueberHacking). `verfahren` bleibt nur fuer verfahren.txt.

### 4. Der Test prueft die Datei gegen sich selbst; die Faelle, die heute brechen koennten, fehlen
Schwere: MITTEL
Beleg: `tools/test-route.js:66`: `erwartet = route.slice(1).map(...)` - die Soll-Folge wird aus route.json abgeleitet, "Folge stimmt" ist damit tautologisch; tragend sind nur die Pruefungen "Stufe > 3", "Ziel = vorhandene Stufe + 1" und "alle enden auf 3". Nicht getestet:
- `braucht` (siehe 2) - liegt ausserhalb von `planeRoute`.
- Startstand hoeher als der erste Routeneintrag des Knotens (z. B. SF4 = 2 heute): `ziel` muss dann {4,3} sein - `find` liefert das, ist aber nicht belegt.
- `lauf === null` mit vorhandenem `ziel` (r2 prueft nur `lauf`), und was main daraus macht (verfahren.txt "? 9 ?", `offen` = beides).
- Kaputte Eintraege: `level` fehlt -> `stufe < undefined` ist false -> Eintrag wird **still uebersprungen**, Route wird kuerzer, planeRoute meldet nichts (nur `node` wird geprueft, `:69`). `verfahren`-Tippfehler ("v2") -> main faellt in den permissiven Zweig, ohne Meldung.
- Overrides (siehe 5).
- Format-Vertrag von verfahren.txt gegen die Leser (`bn4net.js:2648-2650`, `bn4rep.js:85-87` lesen `teile[1] === currentNode`) - stimmt heute, ist aber nirgends festgehalten.
Fix: (a) die ersten fuenf Spruenge als Literal pruefen (`"10->10 10->4 4->4 4->9 9->9"`), (b) Fall "hashes.js fehlt" und "SF4=2", (c) `planeRoute` validiert `level`/`verfahren` und liefert `grund` statt still zu ueberspringen, (d) ein Test, der `"V2 10 2".split(/\s+/)` genau so parst wie bn4net/bn4rep.

### 5. `ownedSF` ist der Override-Stand, nicht der Besitzstand
Schwere: NIEDRIG
Beleg: `NetscriptFunctions.ts:1491-1495`: `ownedSF = activeSourceFiles gefiltert auf Stufe > 0`; `PlayerObject.ts:93-95`: `activeSourceFiles = new JSONMap([...sourceFiles, ...bitNodeOptions.sourceFileOverrides])` - ein Override ersetzt die echte Stufe, Override 0 laesst den Knoten ganz verschwinden. `giveSourceFile` (`RedPill.tsx:24-38`) rechnet dagegen mit `sourceFileLvl` = echt. Es gibt keine NS-Funktion fuer den echten Stand (`getOwnedSourceFiles`, `Singularity.ts:94`, liest ebenfalls `activeSourceFiles`).
Was passiert: Nur relevant, wenn ein Mensch ueber das Portal mit Overrides einsteigt - der Bot uebergibt keine Optionen, `validateBitNodeOptions(undefined)` liefert Standard (`NetscriptHelpers.tsx:871-874`), also sind Overrides nach jedem Bot-Sprung weg. Schlimmster Fall: Override versteckt Stufe 3 -> planeRoute waehlt den Knoten erneut -> ein verschenkter Lauf, danach heilt es sich.
Fix: einmalig protokollieren, wenn `info.bitNodeOptions.sourceFileOverrides.size > 0`: "Overrides aktiv - Stufen koennen tiefer erscheinen als besessen".

### 6. `lauf === null` erzeugt ein Verfahren "?", das die Leser verschieden deuten
Schwere: NIEDRIG
Beleg: `ausgang.js:130`: `verfahrenZeile = "? " + cur + " ?"`. `bn4net.js:2649-2650`: "?" ist nicht V1 -> blade.js/bbtrain.js werden gestartet (V2-Geruest). `bn4rep.js:86-87`: "?" passt auf nichts -> Rueckfall `BLADE_KNOTEN = [6,7,10]` -> in BN1/5/12/4/9/... verhaelt sich bn4rep als V1 (Faktionsarbeit unterbricht Bladeburner), waehrend bn4net V2-Werkzeuge laufen laesst.
Was passiert: Nur im ohnehin verschenkten Lauf (Knoten hat schon Stufe 3 oder steht nicht in der Route) - dort will man so schnell wie moeglich raus, und beide Tueren sind erlaubt (`:173`). Widerspruechliche Werkzeuge verlangsamen genau das.
Fix: bei `lauf === null` das Verfahren des letzten Routeneintrags dieses Knotens schreiben, sonst "V2".

---

## Tragfaehig (gegen Quellcode geprueft)

- **Stufenvergabe und `nachDiesemLauf`:** `destroyW0r1dD43m0n` -> `enterBitNode(false, alt, neu, opts)` -> `giveSourceFile(alt)` **vor** `Player.bitNodeN = neu` (`RedPill.tsx:60-66`). Waehrend des Laufs zeigt `ownedSF` fuer den eigenen Knoten die alte Stufe, im naechsten Knoten schon die neue. `stufe(cur) + 1` ist damit korrekt; bei Stufe >= 3 (ausser BN12) gibt es nichts (`RedPill.tsx:27`), und `nachDiesemLauf = 4` schliesst jeden weiteren Eintrag aus - der Riegel gegen verschenkte Laeufe ist konstruktiv, nicht per Verbot.
- **Selbstsprung:** `destroyW0r1dD43m0n` prueft nur `validBitNodes.includes(nextBN)` (`Singularity.ts:1156`), kein Verbot des eigenen Knotens. BN10 L2 -> SF10.2 -> `getBitNodeLevel = min(2+1, 3) = 3` (`BitNodeUtils.ts:102-104`). Sleeves: `min(3, sourceFileLvl(10) + (bitNodeN === 10 ? 1 : 0)) + sleevesFromCovenant` (`SleeveCovenantPurchases.tsx:63`) -> im Lauf 3 drei Basis-Sleeves plus gekaufte.
- **V2-Bedingung:** `getNextBlackOp()` gibt `null` genau bei `numBlackOpsComplete >= numberOfBlackOperations` (`NetscriptFunctions/Bladeburner.ts:88-93`), dieselbe Zahl wie `bladeburnerRequirements` in destroy (`Singularity.ts:1176-1181`); `numberOfBlackOperations` = 21 (Enum gezaehlt). BN8: `BladeburnerRank: 0` (`BitNode.tsx:790`) -> V2 dort unmoeglich, `DarknetLabyrinthRewardsTheRedPill: 0` (`:792`) -> V1b unmoeglich; Route sagt V1 - stimmig. API-Zugang: SF6.1 vorhanden -> `canAccessBitNodeFeature(6)` ueberall wahr.
- **V1-Vorpruefung (bis auf Root, Befund 1):** `serverExists(WD)` = `serversOnNetwork.length > 0` (`NetscriptFunctions.ts:1051-1055`); WD wird nur bei eingebauter TRP verbunden (`Prestige.ts:174-181`). Davor wirft `getServer` "Invalid host" (`NetscriptHelpers.tsx:504-516`) - ausgang.js prueft `serverExists` vorher und faengt ab. `requiredHackingSkill` enthaelt `WorldDaemonDifficulty` (`ServerHelpers.ts:383-384`): BN1/8 3000, BN12 3060/3121/3184, BN5 4500, BN2/14 15.000.
- **`lauf`/`ziel` bei nicht zusammenhaengenden Bloecken:** beide `find`s sind reihenfolgeunabhaengig, solange die Stufen je Knoten aufsteigen (der Test erzwingt das). BN5 L1 fehlt in der Route und ist besessen -> {5,2} ist korrekt der erste offene Eintrag.
- **Overrides raeumt der Bot selbst** (siehe 5).
- **Uhr:** alle Bedingungen sind Zustaende, keine Raten; Drosselung oder Offline-Nacht verschieben nur die Erkennung um Minuten.
- **route.json auf home:** `.json` ist Textendung (`TextFilePath.ts:8`), lesbar und scp-faehig; live bewiesen ("Dieser Lauf: BitNode 10 Stufe 2").
- **Rueckruf:** `runAfterReset` startet `boot.js` aus `home.scripts` (`Singularity.ts:59-76`), unabhaengig davon, dass exit.js auf werk-10 laeuft; ausgang.js prueft boot.js auf home.

## Nicht geprueft

- Speicher: exit.js 519 GB auf dem Wirt, boot.js gegen home 32/128 GB nach dem Reset (`Prestige.ts:246-252`).
- Ob darkweb.js in jedem V1-Knoten alle fuenf Programme vor der TRP kauft (Eintrittswahrscheinlichkeit von Befund 1).
- BN15-Behauptung "keine TRP ueber Daedalus" (Audit D), Kaltstart BN9 ohne hashes.js, Bladeburner-Beitritt in V2-Knoten.
- Der alte bn4net-Prozess mit alter Werkzeugliste (Briefing) - ob ausgang.js nach dem naechsten Sprung von selbst startet.
- Ob nach Black Op 21 die BitVerse-Seite Skripte anhaelt (live am 02.09. 15:59 widerlegt, nicht im Code gesucht).
