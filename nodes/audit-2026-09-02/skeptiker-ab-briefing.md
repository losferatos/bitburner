# Skeptiker-Briefing: Umbau-Gruppe A+B (02.09.2026, ab 18:30)

Du bist ein SKEPTIKER. Finde, was bricht. Zustimmung ist wertlos. Wenn dein
Winkel nichts Belastbares hergibt, sag das in drei Zeilen.

Arbeitsverzeichnis: `C:\Users\erche\Desktop\claude_projecto\bitburner`
(Git Bash: `/c/Users/erche/Desktop/claude_projecto/bitburner`). Hintergrund:
`nodes/AUDIT-AUTONOMIE-2026-09-02.md` (Abschnitte B, C, I.2-I.4). Praemisse:
Der Bot soll 45 BitNode-Laeufe ohne Menschen schaffen. `git diff` zeigt die
heutigen, noch nicht committeten Aenderungen; `git log -3` die Vorgeschichte
(ausgang.js + route.json sind bereits committet und live).

## Was gebaut wurde (uncommitted)

**A1 bn4net.js - Ausbau fuer wartende Werkzeuge.** Modulvariable
`werkzeugWartetGb`: der Starter (2c) setzt sie, wenn ein Werkzeug nirgends
passt; der Ausbauzweig (1a2, vor der "kleinster Rechner"-Schleife) verdoppelt
dann den GROESSTEN eigenen Rechner, bis `werkzeugWartetGb + belegt ohne
Arbeiter + 4` passt - ohne Amortisationsdeckel, mit "kosten*2 <= geldFrei".
Anlass: bn4rep.js (847 GB) lief in BN10 L2 26 h nicht (Park voll 15/15, max
512 GB).

**A2 Geldboden.** `sleeve.js`: Gym nur, wenn `geld >= 2400 * (storedCycles/5
+ 60) * (MAX+1) + 20e6` (Nachholbetrieb 15x, Sleeve.ts:263-275); sonst
Verbrechen "Mug". Sleeve i trainiert den (i+1)-niedrigsten Wert statt
desselben wie die Figur (Offline-Klumpen, engine.tsx:280-282); in der
Division wie bisher den niedrigsten. `joinrun.js`: unter 5 Mio kein Gym.

**A3 bn4net.js Kaltstart-Leiter:** Faktor 1,0 statt 1,25, solange kein
eigener Rechner steht.

**B1 bn4net.js Stillstandserkennung:** Tabelle `TELEMETRIE` (blade.json,
sleeve.json, bn4life.json, ausgang.json, bbtrain.json mit erlaubtem Alter
5-10 min) und `werkzeugSeit` (erstes Sehen). Ist das Werkzeug laenger als
das erlaubte Alter bekannt UND seine Telemetrie aelter -> alle Instanzen
`ns.kill`, Starter holt es in derselben Runde zurueck. Entdopplung behaelt
jetzt die JUENGSTE Instanz (vorher die aelteste).

**B2 Herzschlaege:** blade.js schreibt im Wartezweig vor dem Beitritt ein
Minimal-`blade.json` ({zeit, wartend}); bbtrain.js schreibt `bbtrain.json`
am Kopf beider Schleifen; ausgang.js schreibt `ausgang.json` auch in den
fruehen `continue`-Zweigen.

**B3 boot.js:** Endlosschleife statt 240 Runden; nach 5 Minuten ohne bn4net
werden alle Prozesse auf home ausser boot.js beendet.

**B4 bbtrain.js:** beide `hilfe.txt`-Notrufe durch Warten + Protokollzeile
ersetzt.

## Live-Stand
BN10 Lauf 2, vor dem Bladeburner-Beitritt (Kampfwerte ~80/80/80/110),
Konto > 5 Mrd, home 1024 GB, 15 Mietrechner (max 512 GB). Lies ueber die
Bruecke (NUR LESEN):
    curl -s -m 8 -G "http://localhost:8795/api/rpc" --data-urlencode "method=getFile" --data-urlencode "filename=data/bn4net-log.txt" --data-urlencode "server=home"
Ebenso data/sleeve.json, data/bbtrain.json, data/blade.json, data/bn4net.json.
Spielquellcode: `reference/v301/src/` (mit `timeout 60` und gezielt suchen).

## Verbote
Nichts aendern, nichts ins Spiel schieben, kein git, keine Subagenten, keine
Push-Nachrichten. Zahlen nachrechnen, nicht schaetzen.

## Ausgabe
Markdown in die Datei aus deinem Auftrag. Je Befund:
    ### <Titel>
    Schwere: KRITISCH | HOCH | MITTEL | NIEDRIG
    Beleg: <Datei:Zeile / Quellcode / Messung>
    Was passiert: <Zustand -> Fehlverhalten -> Kosten>
    Fix: <konkret>
Hoechstens 10 Befunde, KRITISCH zuerst; danach "Tragfaehig" und "Nicht
geprueft". Abbruch nach spaetestens 25 Minuten. Antworte am Ende nur mit
Dateipfad und Anzahl je Schwere.
