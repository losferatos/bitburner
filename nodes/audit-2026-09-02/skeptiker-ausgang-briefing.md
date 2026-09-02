# Skeptiker-Briefing: ausgang.js + route.json (02.09.2026, 17:31)

Du bist ein SKEPTIKER. Finde, was bricht. Zustimmung ist wertlos. Wenn dein
Winkel nichts Belastbares hergibt, sag das in drei Zeilen.

Arbeitsverzeichnis: `C:\Users\erche\Desktop\claude_projecto\bitburner`
(Git Bash: `/c/Users/erche/Desktop/claude_projecto/bitburner`).
Hintergrund: `nodes/AUDIT-AUTONOMIE-2026-09-02.md` Abschnitt A und I.1 -
lies ihn zuerst. Kurz: Der Bot soll 45 BitNode-Laeufe ohne Menschen
schaffen; bisher kam der Zielknoten aus einer von Hand geschriebenen Datei,
und `bn4rep.js` verbot 27 der 40 verbleibenden Spruenge.

## Was heute gebaut wurde (uncommitted, `git diff` zeigt es)

- NEU `src/ausgang.js` (im Spiel 10,9 GB gemessen, singularityfrei):
  liest `route.json` auf home, `ns.getResetInfo()` (currentNode, ownedSF),
  bestimmt DIESEN Lauf und das ZIEL (`planeRoute`, reine Funktion),
  schreibt `data/verfahren.txt` ("V2 10 2" = Verfahren Knoten Stufe) und
  `data/ausgang.json`, prueft je Verfahren die Ausgangsbedingung (V2:
  inBladeburner && getNextBlackOp()===null; V1/V1b: w0r1d_d43m0n am Netz
  && Hacking >= requiredHackingSkill) und startet dann `exit.js` auf dem
  Wirt mit dem meisten Platz (Arbeiter werden geraeumt). Kein Menschenruf.
  `braucht` in der Route (BN9: hashes.js, BN8: boerse.js) blockiert den
  Sprung, wenn die Datei auf home fehlt.
- NEU `src/route.json`: 40 Eintraege in Roadmap-Reihenfolge, je
  {node, level, verfahren, braucht?}. Die Reihenfolge ist NICHT Gegenstand.
- NEU `tools/test-route.js`: simuliert alle 39 Spruenge ab dem heutigen
  Stand (ownedSF {1:1,4:1,5:1,6:1,10:1}, Knoten 10). `node tools/test-route.js`
  ist gruen.
- GEAENDERT `src/bn4rep.js`: `bladeburnerTraegtHier()` liest zuerst
  `data/verfahren.txt` (Knoten muss stimmen), Rueckfall `BLADE_KNOTEN`.
  Der Ausgangsblock (exit-ziel.txt, Guard, exec auf home) ist durch einen
  Kommentar + `sleep; continue` ersetzt.
- GEAENDERT `src/boot.js`: raeumt zusaetzlich data/task.txt,
  data/exit-ziel.txt, data/verfahren.txt, data/simulacrum.txt.
- GEAENDERT `src/bn4net.js`: `["ausgang.js", []]` ganz oben in WERKZEUGE;
  in V1-Knoten (laut verfahren.txt) werden blade.js und bbtrain.js nicht
  gestartet.

Live-Beweis (17:28, BN10 Lauf 2): `data/ausgang.txt` = "Dieser Lauf:
BitNode 10 Stufe 2, Verfahren V2. / Ziel BitNode 10 Stufe 3 - warte: keine
Division; w0r1d_d43m0n nicht am Netz". `exit.js` misst 519,25 GB (SF4.1).

Das laufende `bn4net.js` im Spiel ist noch der ALTE Prozess (die Bruecke
hat die Datei geschoben, der Prozess laeuft mit der alten Werkzeugliste);
ausgang.js wurde von Hand per `tools/task.js` gestartet und laeuft auf
`werk-10`.

## Spiel-Quellcode zum Gegenpruefen
`reference/v301/src/` - u. a. `NetscriptFunctions/Singularity.ts`
(destroyW0r1dD43m0n), `NetscriptFunctions/Bladeburner.ts` (getNextBlackOp,
inBladeburner), `NetscriptFunctions.ts` (getResetInfo - was steht in
ownedSF, wann wird die Stufe vergeben: `Prestige.ts`, `RedPill.tsx`,
`BitNode/BitNodeUtils.ts`), `Netscript/RamCostGenerator.ts`. Immer mit
`timeout 60` und gezielt suchen.

Live lesen (NUR LESEN):
    curl -s -m 8 -G "http://localhost:8795/api/rpc" --data-urlencode "method=getFile" --data-urlencode "filename=data/ausgang.txt" --data-urlencode "server=home"

## Verbote
Nichts aendern, nichts ins Spiel schieben, kein git, keine Subagenten,
keine Push-Nachrichten. Zahlen nachrechnen, nicht schaetzen.

## Ausgabe
Markdown in die Datei aus deinem Auftrag. Je Befund:
    ### <Titel>
    Schwere: KRITISCH | HOCH | MITTEL | NIEDRIG
    Beleg: <Datei:Zeile / Quellcode / Messung>
    Was passiert: <Zustand -> Fehlverhalten -> Kosten>
    Fix: <konkret, mit Codezeile, wenn moeglich>
Hoechstens 10 Befunde, KRITISCH zuerst; danach "Tragfaehig" und "Nicht
geprueft". Abbruch nach spaetestens 25 Minuten. Antworte am Ende nur mit
Dateipfad und Anzahl je Schwere.
