# Uebernahme des HWGW-Stapelbetriebs

Stand 20.08.2026, 06:00. Gilt fuer den **korrigierten** Entwurf in diesem
Ordner, nicht fuer die Fassung, die `batching-bericht.md` beschreibt.

---

## 1. Ausgangslage, gemessen statt geschaetzt

Aus `http://localhost:8795/api/state`, 05:49:

```
Hacking-Level      219
Netz               45 von 95 Rechnern offen, 26 gekaufte
Speicher           506 GB gesamt, 414 belegt, 92 frei
Guthaben           $2.34m
Ertrag             $373/s   (Schnitt seit dem Reset)
Ziele              n00dles       81.9 %   sec 1.09 / 1
                   harakiri-sushi 67.8 %   sec 5 / 5     ($2.06k/s)
Zustand            0 Ziele werden abgeschoepft, 2 vorbereitet
```

Das Netz ist seit deiner Angabe (25/82, 280 GB) weitergewachsen. Wichtiger als
die Zahlen selbst ist, was sie bedeuten: **kein einziges Ziel erntet gerade.**
Der ganze Speicher steckt in grow-Faeden. Die $373/s sind der Schnitt seit dem
Reset, nicht die aktuelle Rate - die aktuelle Rate ist naeher an null.

---

## 2. Was am Entwurf geaendert wurde

Der Entwurf hat alle vier Korrekturen vom 20.08. **rueckgaengig gemacht**.
Drei davon sind wieder eingebaut, die vierte ist gegenstandslos geworden.

| Korrektur | Im Entwurf | Jetzt |
|---|---|---|
| 1. `MAX_TARGETS`/`PREP_TARGETS` aus `ramTotal` | fest 60 / 40 | Obergrenzen; wirksam sind `floor(ramTotal/2000)` bzw. `floor(ramTotal/4000)`, mindestens 2 / 1 |
| 2. grow-Bestellung gedeckelt | ungedeckelt | auf 85 % des freien Speichers |
| 3. Ausgleich fuer TATSAECHLICH gestartete Faeden, nach ihnen | fuer die GEPLANTEN, vor ihnen | drei Durchgaenge: echter Ueberschuss, grow, Ausgleich |
| 4. `HACK_FRACTION` zurueck auf 0.1 | entfaellt | entfaellt zu Recht - `chooseFraction` waehlt den Anteil aus dem Speicherbudget und landet bei 116 GB von selbst bei 0.01 |

### Und eine fuenfte Aenderung, die keine Korrektur war, sondern ein Befund

**Der Stapelbetrieb ist bei kleinem Netz schlechter als der Wellenbetrieb -
auch mit allen Korrekturen.** Das steht so in keinem Teil des Berichts.

Der Grund ist strukturell: jeder der vier Auftraege eines Stapels belegt
seinen Speicher vom Start bis zu SEINER Landung, also praktisch eine ganze
weaken-Zeit - auch der hack, der fuer sich nur ein Viertel so lange braucht.
Solange Speicher der Engpass ist, kostet das den Faktor 4 auf der teuersten
Ressource. (Der Bericht verwirft JIT in Abschnitt 2 aus genau diesem Grund
und nimmt damit die Speicherbindung bewusst in Kauf - richtig bei 21 TB,
falsch bei 116 GB.)

Nachgerechnet, `harakiri-sushi`, Level 219, ein Ziel, 90 Minuten:

| Speicher | Wellen | Stapel | Faktor |
|---:|---:|---:|---:|
| 64 GB | $47k/s | $19k/s | **0.40** |
| 116 GB | $85k/s | $51k/s | **0.60** |
| 200 GB | $126k/s | $83k/s | **0.66** |
| 300 GB | $152k/s | $137k/s | 0.90 |
| 400 GB | $152k/s | $181k/s | 1.19 |
| 506 GB | $154k/s | $234k/s | 1.52 |
| 1000 GB | $155k/s | $402k/s | 2.60 |

Die Wellen saettigen je Ziel bei rund $155k/s und lassen alles weitere
brachliegen - das ist der Befund des Berichts, und er stimmt. Aber erst
oberhalb von rund 350 GB.

Deshalb: **`BATCH_MIN_RAM = 400`.** Unter 400 GB Gesamtspeicher erntet der
Autopilot in Wellen wie bisher (mit `HACK_FRACTION = 0.1` und der alten
Schwelle 90 % / +3 Sicherheit), darueber in Stapeln. Der Uebergang findet je
Durchgang genau zweimal statt, denn der Speicher waechst nur und faellt allein
beim Reset.

Damit ueberlebt die Datei den naechsten Reset, ohne dass jemand nachts
zurueckrollen muss.

Zusaetzlich neu: **`PREP_RESERVE = 0.25`.** Der Entwurf hatte die Vorbereitung
bewusst VOR die Stapel gestellt, mit dem Argument, ihr Bedarf sei endlich und
der der Stapel unbegrenzt. Das Argument ist richtig, aber es hat genau in die
Nacht zum 20.08. gefuehrt. Jetzt kommen die Stapel zuerst (sie zahlen sofort),
und die Vorbereitung bekommt dafuer ein Viertel des freien Speichers
reserviert, damit sie nicht verhungert. Der Anteil ist null, sobald nichts
mehr vorzubereiten ist.

### Der Beleg, warum das noetig war

Nachgerechnet mit den Spielformeln aus `reference/v301`, Ziel `harakiri-sushi`
(moneyMax $100m, secMin 5, growth 40, Wachstumsdeckel greift), Netz 116 GB,
Runde = 1 s, Landungen exakt nach Laufzeit:

| Startzustand | Entwurf wie geliefert | korrigiert |
|---|---|---|
| 4 % Guthaben, sec 5 | **nach 90 min immer noch 4.0 %** | fertig nach 46 min |
| 4 % Guthaben, sec 15 | **nach 90 min immer noch 4.0 %** | fertig nach 50 min |
| 67.8 % Guthaben, sec 5 | fertig nach 6 min | fertig nach 6 min |

(Dieselbe Rechnung bei 506 GB, von 67.8 % aus: 2 Minuten.)

Der Mechanismus im ersten Fall: von 4 % auf 100 % braucht das Ziel 2303
grow-Faeden. Deren Sicherheitsausgleich sind 184 weaken-Faeden = **322 GB** -
mehr als das ganze Netz. Der Entwurf bestellt diesen Ausgleich VOR dem grow,
also fuellen 62 weaken-Faeden den gesamten Speicher, grow kommt nie dran, und
nach der Landung beginnt dasselbe. Das ist Zeile fuer Zeile der Ausfall, der
fuenf Stunden gekostet hat.

Bei den heutigen 506 GB waere derselbe Fehler nicht toedlich, sondern nur
teuer (der Ausgleich frisst zwei Drittel des Netzes, ein Drittel bleibt fuer
grow). Er wuerde also **beim naechsten Reset zuschlagen, nicht heute** - und
damit genau dann, wenn niemand hinsieht.

Was NICHT geaendert wurde: `lib/batch.js` und die drei Arbeiter sind
unveraendert. Die Terminrechnung, der Landekalender aus `ns.ps`, die
Alles-oder-nichts-Platzierung und `GAP_MS = 400` bleiben so, wie sie im
Bericht beschrieben und begruendet sind.

---

## 2a. Achtung: es gibt einen zweiten Entwurf fuer dieselbe Datei

Waehrend dieser Pruefung ist in `entwurf/robust/` ein **zweiter** Entwurf von
`autopilot.js` entstanden (dazu `invest.js`, `xp.js`, `lib/`, `nightshift/`,
Bericht in `entwurf/robust/bericht.md`, Zeitstempel 05:51 bis 06:03). Er geht
vom aktuellen `src/` aus - die vier Korrekturen sind darin enthalten - und
aendert 165 Zeilen gegenueber `src/autopilot.js`.

**Beide Entwuerfe beanspruchen dieselbe Datei.** Wer den einen uebernimmt,
verliert den anderen. Sie sind hier NICHT zusammengefuehrt worden; dieser
Entwurf enthaelt nichts aus `entwurf/robust/`.

Vorschlag: erst `entwurf/robust/` lesen und entscheiden, was davon bleibt.
Wenn dessen Aenderungen an `autopilot.js` gewollt sind, gehoeren sie in den
Stapel-Entwurf eingearbeitet, bevor irgendetwas nach `src/` geht - nicht
danach.

## 3. Uebernahme, Schritt fuer Schritt

Voraussetzung: Bruecke laeuft (`node sync/bridge.js`), Spiel verbunden,
Dashboard erreichbar. **Die Reihenfolge ist nicht Geschmackssache** - die
Bruecke buendelt Aenderungen mit 400 ms Verzoegerung, und wenn `autopilot.js`
vor `lib/batch.js` im Spiel ankommt, laesst sich der Autopilot nicht mehr
auswerten ("Cannot calculate RAM usage of an invalid script"). Der Verwalter
faengt das nach 5 s ab, aber unnoetig ist es trotzdem.

### Schritt 0 - Messung des Ist-Zustands (5 Minuten)

Damit hinterher ueberhaupt vergleichbar ist, was besser wurde:

```powershell
node tools/reserve.js 1e12          # Verwalter kauft nichts mehr - sonst
                                    # misst man Ausgaben statt Ertrag
```
Dann fuenf Minuten warten und zweimal den Kontostand ablesen:
```powershell
(Invoke-RestMethod http://localhost:8795/api/state).telemetry.player.money
```
Differenz durch 300 = **Basisrate in $/s**. Notieren. Erwartung nach der
aktuellen Lage: irgendwo zwischen $0/s und $5k/s, je nachdem, ob
`harakiri-sushi` in diesen fuenf Minuten die 90-%-Schwelle reisst.

### Schritt 1 - Arbeiter (unkritisch)

```powershell
Copy-Item entwurf\worker\*.js src\worker\ -Force
```

Warten: **10 Sekunden.** Die neuen Arbeiter sind abwaertskompatibel (fehlt
`args[2]`, greift `args[1]`), der alte Autopilot arbeitet unveraendert weiter.
Auf die Flotte kommen sie erst beim Neustart des Autopiloten in Schritt 3 -
dieser Schritt legt sie nur auf `home` ab.

Pruefen: im Dashboard-Protokoll steht "3 Dateien zusammen nachgeschoben".

### Schritt 2 - Stapelplanung

```powershell
Copy-Item entwurf\lib\batch.js src\lib\ -Force
```

Warten: **10 Sekunden.** Pruefen, dass die Datei wirklich im Spiel liegt:

```powershell
Invoke-RestMethod "http://localhost:8795/api/rpc?method=getFile&filename=lib/batch.js&server=home" | Select-Object -First 1
```

Kommt hier ein Fehler, **nicht weitergehen**. Ohne `lib/batch.js` ist der neue
Autopilot nicht startbar.

### Schritt 3 - Autopilot

```powershell
Copy-Item entwurf\autopilot.js src\autopilot.js -Force
```

Ab hier laeuft die Uhr. Der alte Autopilot erkennt die neue Fassung binnen
einer Runde, beendet sich, und der Verwalter startet die neue binnen 5 s.

**Was in den ersten Minuten normal ist:** Alle Ziele beginnen in `prep`. Der
Stapelbetrieb setzt EXAKT 100 % Guthaben und Mindestsicherheit voraus, nicht
"90 % und drei Punkte Toleranz". `harakiri-sushi` steht bei 67.8 %; die
Nachrechnung sagt **rund 2 Minuten** bis zum Vollzustand bei 506 GB. In dieser
Zeit ist der Ertrag null. Das ist kein Fehler.

### Schritt 4 - Sperrkasse wieder freigeben

Erst **nach** der 30-Minuten-Messung aus Abschnitt 4:

```powershell
node tools/reserve.js 0
```

---

## 4. Was nach Schritt 3 zu messen ist

| Zeitpunkt | Was pruefen | Sollwert |
|---|---|---|
| +60 s | `telemetry.cycle` steigt, `telemetry.events` ohne "Fehler in Runde" | Runden laufen |
| +3 min | `telemetry.events` enthaelt "ist vorbereitet - Stapelbetrieb beginnt" | mindestens ein Ziel im Stapel |
| +5 min | `telemetry.batching.expectedPerSec` | > 0, Groessenordnung $50k/s bis $250k/s |
| +10 min | Kontostand-Differenz / 600 | mindestens Basisrate aus Schritt 0 |
| +30 min | Kontostand-Differenz / 1800 | Rechnung sagt $150k/s bis $250k/s bei 506 GB |
| +30 min | Kontostand-Differenz / 1800 gegen `batching.expectedPerSec` | die beiden duerfen sich um Faktor 1.5 unterscheiden, nicht um Faktor 3 |
| +30 min | Sicherheitsspalte der Stapelziele im Spielfenster | gruen, `sec` gleich `secMin` |

Alles in einem Aufruf:

```powershell
node tools/status.js
(Invoke-RestMethod http://localhost:8795/api/state).telemetry |
  Select-Object cycle, phase, reason, @{n="erwartet";e={$_.batching.expectedPerSec}}, @{n="geld";e={$_.player.money}}
```

Die Groesse, auf die es ankommt, ist **`batching.expectedPerSec` gegen den
tatsaechlichen Kontozuwachs.** Klaffen die dauerhaft um mehr als Faktor 1.5
auseinander, landen Stapel in der falschen Reihenfolge (Abschnitt 5.1 des
Berichts) - und das ist der eine Fehler, der ein Ziel leerraeumt, statt nur
langsamer zu sein.

---

## 5. Abbruchkriterien

Jede Zeile fuer sich genuegt. Nicht diskutieren, zurueckrollen.

| # | Wenn ... | ... dann |
|---|---|---|
| A | nach **2 Minuten** `telemetry.cycle` nicht steigt oder in `events` wiederholt "Fehler in Runde" steht | sofort zurueck |
| B | nach **15 Minuten** kein Ziel den Stapelbetrieb erreicht hat UND kein `moneyPct` um mindestens 10 Punkte gestiegen ist | zurueck - das ist die Stillstandssignatur |
| C | nach **30 Minuten** der gemessene Kontozuwachs unter dem **1.2-fachen** der Basisrate aus Schritt 0 liegt | zurueck - die Rechnung sagt bei 506 GB Faktor 1.5; wer 1.2 nicht schafft, hat den Umbau nicht verdient |
| D | ein Ziel im Stapelbetrieb steht laenger als **2 Minuten** bei `sec > secMin + 1`, und das wiederholt sich nach der automatischen Neuvorbereitung ein zweites Mal | zurueck - die Termindisziplin haelt nicht |
| E | `moneyPct` eines Stapelziels faellt unter **30 %** und bleibt dort ueber 5 Minuten | zurueck - das Ziel blutet aus |

Fuer B, C und D gilt: die Drifterkennung im Autopiloten faengt Einzelfaelle
selbst ab (`drain` -> `prep`). Erst die **Wiederholung** ist das Signal.

---

## 6. Zurueckrollen

Die alte Fassung liegt vollstaendig unter `entwurf/rollback/` (Kopie von
`src/` vom 20.08., byte-identisch).

```powershell
Copy-Item entwurf\rollback\autopilot.js src\autopilot.js -Force
```

Das genuegt. Warum: die neuen Arbeiter sind abwaertskompatibel, der alte
Autopilot kann sie weiterbenutzen. `src/lib/batch.js` darf liegen bleiben, es
kostet 0 GB und wird von der alten Fassung nicht importiert.

Nach **60 Sekunden** pruefen, dass die alte Fassung laeuft:

```powershell
(Invoke-RestMethod http://localhost:8795/api/state).telemetry.reason
```

Steht dort wieder "Ziel(e) werden abgeschoepft, ... vorbereitet", ist der alte
Stand zurueck. Steht dort nichts oder aendert sich `cycle` nicht, im
Spielterminal `run autopilot.js` von Hand.

Wer auch die Arbeiter zuruecknehmen will (nicht noetig, aber sauber):

```powershell
Copy-Item entwurf\rollback\worker\*.js src\worker\ -Force
```

Danach beendet sich der Autopilot erneut und liefert die alten Arbeiter in
Runde 1 an die ganze Flotte aus.

---

## 7. Was auch nach der Uebernahme offen bleibt

1. **`chooseFraction` waehlt bei kleinem Netz den kleinsten Anteil (0.01).**
   Nachgerechnet fuer `harakiri-sushi` bei Level 219: f=0.01 bringt
   494 $/GB/s, f=0.05 brachte 564 $/GB/s. Es bleiben also rund 12 % liegen.
   Kein Grund, heute daran zu drehen - aber wenn nach zwei Stunden alles
   stabil laeuft, ist `FRACTION_MIN = 0.03` einen Versuch wert.
2. **`GAP_MS = 400` ist nie im Spiel gemessen worden**, nur in der Simulation.
   Die Streuung der Landungen haengt am Browser. Nicht senken, bevor sie
   gemessen ist - unterhalb der echten Streuung kippt der Ertrag, er faellt
   nicht sanft ab.
3. **Die Ertragszahlen des Berichts (Faktor 10 bis 20) stammen aus einem Netz
   mit 21 TB**, in dem die alte Fassung neun Zehntel des Speichers brachliegen
   liess. Bei 506 GB ist der Speicher voll belegt; der ehrliche erwartete
   Faktor ist hier **1.5 bis 3**, nicht 10 bis 20.
4. **Das Netz steht heute bei 506 GB, die Schwelle bei 400 GB.** Der
   Stapelbetrieb laeuft also gerade eben an - im flachsten Teil seiner Kurve.
   Faellt das Netz je wieder darunter (nur beim Reset), schaltet der Autopilot
   selbsttaetig auf Wellen zurueck; in der Anzeige steht dann "Wellenbetrieb
   (Netz unter 400 GB)".
5. **Die Schwelle 400 GB ist an EINEM Ziel gerechnet** (`harakiri-sushi`,
   Level 219). Mit mehreren gleichzeitigen Zielen verschiebt sie sich nach
   oben, weil die Wellen dann mehr Speicher auslasten. Wer sie genauer haben
   will, misst nach dem Reset beide Betriebsarten je eine halbe Stunde.
