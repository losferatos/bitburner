# Loop 3: Kurzreport

*Alles ab der nächsten Zeile ist der Prompt und wird wörtlich an CronCreate übergeben.*

BITBURNER-REPORT (Loop 3 von 3). Arbeitsverzeichnis C:\Users\erche\Desktop\claude_projecto\bitburner.

Der Halbstundenbericht für Eric. Er ist das einzige, was regelmäßig im Chat landet — Loop 1 schweigt bei „alles gut", Loop 2 meldet nur seine Arbeit.

Ablauf:

1. Systemzeit holen: `date`. Nie schätzen.
2. Lage messen: `cd /c/Users/erche/Desktop/claude_projecto/bitburner && node tools/strategie-check.js`
3. Die Ziele der letzten halben Stunde lesen: `cat data/ziele.md` (fehlt die Datei, ist dies der erste Report — dann entfällt die Reflexion).

Dann **genau dieses Format** ausgeben, nichts davor, nichts danach:

```
**HH:MM — BitNode <n>, <Phase>**

Rückblick
- <je ein Stichpunkt pro Ziel der letzten halben Stunde: erreicht / verfehlt / überholt, mit der Zahl die es belegt>

Lage
- <Träger>: <Wert> (<Delta seit dem letzten Report>)
- <die zwei bis drei Zahlen, die gerade zählen — nicht alle, die es gibt>

Nächste 30 Minuten
1. <Ziel>
2. <Ziel>
3. <Ziel>
```

Harte Regeln für das Format:
- **Höchstens 10 Zeilen insgesamt.** Eric hat am 25.08.2026 wörtlich gesagt: „Ich will morgen früh nicht zig hundert Zeilen wall of text haben."
- Keine Tabellen, keine Vorrede, keine Erklärung der Mechanik. Er kennt das Spiel.
- Die Reflexion ist **ehrlich**. Ein verfehltes Ziel wird als verfehlt benannt, mit der Zahl daneben. Ein Ziel, das sich als falsch herausgestellt hat, wird als falsch benannt — nicht stillschweigend durch ein neues ersetzt.
- Ziele sind **überprüfbar**, nicht Absichten. „Kampfwert-Tiefstand über 100" ist ein Ziel, „am Training weiterarbeiten" ist keines.

4. Danach die neuen Ziele nach `data/ziele.md` schreiben, damit der nächste Report sie prüfen kann — ohne diese Datei kann er nicht reflektieren, denn seine Sitzung erinnert sich nicht:

```bash
cat > data/ziele.md <<'ZIELE'
# Ziele, gesetzt <HH:MM> am <TT.MM.JJJJ>
1. <Ziel> | Messung: <woran man es abliest>
2. <Ziel> | Messung: <...>
3. <Ziel> | Messung: <...>
ZIELE
```

5. Diese Datei nicht committen — sie ist ein Zwischenstand, kein Ergebnis. Steht sie noch nicht in `.gitignore`, dort eintragen.

6. **Jeder kaputte Befund wird zum Auftrag, nicht zum Stichpunkt.** Fällt etwas auf, das nicht stimmt — eine Zahl, die stehenbleibt, ein Werkzeug, das nichts liefert, ein Dialog, der sich wiederholt —, dann trag es SOFORT oben in `nodes/BAUSTELLEN.md` unter `## Sofort` ein, in genau dieser Form:

```
### <Kurzer Befund in einem Satz> (<HH:MM>)
Gemessen: <die Zahl, die den Befund belegt, mit ihrer Quelle>
Erwartet: <was stattdessen dastehen müsste>
Verdacht: <Fundstelle im Code, wenn es eine gibt - sonst "offen">
```

Ersetze dabei das Wort `keine`, falls es dort noch allein steht. Im Chat bekommt der Befund den Zusatz **„→ Auftrag"**, damit Eric sieht, dass er nicht im Bericht versandet. Der Vorankommens-Loop nimmt ihn sieben Minuten später als Erstes.

Ein Befund, der nur im Chat steht, ist verloren: Der nächste Report erinnert sich nicht an ihn, und Eric soll ihn nicht nachhalten müssen. Genau deshalb gibt es diesen Schritt.

Weitere Regeln: Keine Augmentierungen von Hand kaufen. NIEMALS einen zweiten Tab auf bitburner-official.github.io öffnen. Kein b1tflum3, kein Destroy-Knopf. In diesem Loop wird **nicht am Bot herumrepariert** — er misst, berichtet und schreibt Aufträge. Die Reparatur ist Sache von Loop 1 und 2.
