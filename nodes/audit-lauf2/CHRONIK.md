# Teil 1 - Chronik: wohin sind die Stunden gegangen?

Stand 12.11.2026. Ergebnis von Teil 1 des Plans `nodes/AUDIT-LAUF2-2026-11.md`.
Zusammengefuehrt aus vier Berichten in diesem Ordner: `1a-zeitleiste.md` +
`chronik.json` (Zeitleiste), `1b-verluste.md` (Vorfaelle V01-V50),
`1c-skeptiker-zahlen.md` (Zahlen/Methode), `1d-skeptiker-vollstaendigkeit.md`
(V51-V64, Urteile). Wo 1c/1d den Pruefern widersprechen, gilt hier der
Skeptiker-Wert; die Ursprungsdateien sind nicht nachkorrigiert.

## 1. Kernzahlen

- **Ausgangslage:** Spielstand am 19.08.2026 16:35 UTC neu angelegt, BitNode 1,
  keine Source-Files (Achievement-Zeitstempel, erste Sicherung, README).
- **Gesamt:** 2.043 h Wanduhr (85 Tage) fuer 44 Laeufe, BN1.1 bis BN8.2.
  Gefahren wurde ab BN10.2 exakt `src/route.json` (39 Laeufe, 0 Abweichungen).
- **Online** (messbar erst ab 03.09.): Mitte rund 1.090 h von 1.676 h Wanduhr,
  Spanne 1.041-1.150 h. Die Methode (Luecke in den Stundensicherungen = offline)
  unterschaetzt online nur, ueberschaetzt nie: die unabhaengige Motoruhr zeigt
  2,8 % der Luecken als "Spiel lief, Bruecke tot".
- **`totalPlaytime` ist Wanduhr**, nicht Spielzeit (alle 1.539 Indexzeilen).
  Wer kuenftig "Spielstunden" sagt, muss sagen, welche Uhr.

## 2. Welche Uhr zaehlt - je Verfahren eine andere

Aus dem Spielcode (`engine.tsx:257-350`), am Verlauf plausibilisiert:

| Verfahren | Was offline passiert | Folge fuer die Planung |
|---|---|---|
| V1 Hacking (BN1, 5, 12, 8) | Erfahrung nur fuer Skripte, die beim Speichern liefen, mit `confidence = min(1, Laufzeit/4 h)` (`ScriptHelpers.ts:27-60`). Kurzlebige Stapel-Arbeiter bekommen fast nichts. Gemessen: BN8.1 0-40 % | Fortschritt folgt der **Online-Zeit**. BN1/5/12 brauchten je Stufe fast konstant 12-20 h online bei 13-49 h Wanduhr |
| V2 Bladeburner | `storedCycles` ohne Obergrenze, Abbau mit Faktor 5, aber nur fuer die zuletzt laufende Aktion; Black Ops werden nicht wiederholt | Grob **50 % gutgeschrieben** (8 Luecken, Streuung 0-100 %). Rechnen mit Wanduhr und Abschlag |
| Boerse (BN8) | Kursschritte werden gespeichert und online im Zeitraffer nachgeholt | Offline-Zeit geht nicht verloren; der Bot handelt den Zeitraffer mit 4S nach |

## 3. Zeit je Knoten (Wanduhr / online, je Stufe)

| Knoten | Verf. | Summe W | Summe online | Stufe 1 / 2 / 3 (W/online) |
|---|---|---:|---:|---|
| BN10 | V2 | 309 | >= 48 | 95/? - 117/? - 97/48 |
| BN9 | V2 | 239 | 131 | 104/34 - 82/50 - 54/47 |
| BN7 | V2 | 205 | 168 | 75/53 - 62/47 - 67/67 |
| BN15 | V2 | 177 | 105 | 101/35 - 42/36 - 34/34 |
| BN6 | V2 | 161 | >= 23 | 92/? - 36/9 - 34/14 |
| BN4 | V1/V2 | 148 | >= 68 | 49/? - 47/34 - 52/34 |
| BN13 | V2 | 139 | 107 | 49/41 - 61/37 - 29/29 |
| BN12 | V1 | 105 | 38 | 49/12 - 24/12 - 32/14 |
| BN5 | V1 | 95 | >= 39 | 28/? - 20/20 - 47/19 |
| BN14 | V2 | 87 | 74 | 37/31 - 28/21 - 22/22 |
| BN11 | V2 | 84 | 64 | 29/18 - 24/24 - 32/23 |
| BN3 | V2 | 80 | 39 | 22/7 - 23/13 - 36/19 |
| BN1 | V1 | 78 | >= 25 | 46/? - 20/12 - 13/13 |
| BN8 | V1 | 70 | 40 | 61/32 - 9/9 (laeuft) |
| BN2 | V2 | 65 | 53 | 30/23 - 20/15 - 15/15 |

Vor dem 03.09. ("?") gibt es keine Online-Messung.

**Lesart:** Die Zeit steckt in der Dauer der Knoten, nicht in Fehlern.
BN10 + BN9 + BN7 + BN15 = 930 h, fast die Haelfte. BN7 ist Spielmechanik
(Rangfaktor 0,6, Skillkosten x2, Augs x3; 1,6-2,3-fach gegen BN6.2) und lag
sogar unter der geeichten Erwartung des Audits vom 03.10. (83-163 h je Lauf).
Die fruehere Erwartung "22-34 h" war ein ungeeichtes Modell und ist widerrufen.

## 4. Was Fehler gekostet haben

- **Belegte Bot-Fehler: rund 33 h** (2-3 % der Wanduhr), plus Spannen von
  5-50 h. Zwei der vermeintlich groessten Stillstaende (V30 BN10.3 "10,5 h",
  V32 BN4.2 "10 h") waren Nachtluecken - real 0,5-1 h bzw. rund 1,8 h.
- **Offline in V1-Knoten: hoechstens 132 h Wanduhr** (BN12 67, BN8.1 30,
  BN5.3 28, BN1.2 8). Obergrenze, weil Skripte und Faktionsarbeit offline
  teilweise weiterlaufen.
- **Offline in V2-Knoten: grob 240 h** von 488 h Luecken nicht eingeloest
  (50-%-Schaetzung, keine Eichung).
- **Rahmenwerte, keine Verlustzahlen** (enthalten SF-Gewinne der Folgestufe):
  BN6.1 hoechstens 56 h Lernkurve; BN10.2 21,5 h Kaltstart und volles home;
  BN15.1 ohne Graft und Go: online 35 h gegen 36/34 h in Stufe 2/3, die
  Differenz in Wanduhr (58 h) ist fast nur Offline-Luecke - **als Verlust
  nicht belegt**.

## 5. Erics Vermutung: "anfangs nicht optimal, Mechaniken nicht ausgeschoepft"

**Haelt - aber an anderer Stelle als vermutet.**

- **Die Route war schnell richtig.** Bladeburner als Traeger 12 von 12
  bestaetigt, die falsche Hacking-Praemisse binnen 48 h korrigiert, die
  Reihenfolge exakt gefahren. Die Pruefung vom 07.10. rechnete aber nur EINE
  Alternative, und ihre Zahlen lagen im Rauschen (Modelle ungeeicht, real
  Faktor 2-4 langsamer).
- **Die Mechanik-Nutzung wurde frueh falsch abgewogen und nie neu bewertet:**

| Gewerk | Verfuegbar | Wirksam | Verzoegerung | Nutzen belegt? |
|---|---|---|---|---|
| Boerse | 20.08. | 10.11. (nur BN8) | 82 Tage, in V2 nie | BN2 -17,5 h gerechnet, ungeeicht |
| Grafting-Zuender (V2) | 30.08. | 07.11. | 64 Tage Haltefrist (Entscheidung 04.09., spaeter als Fehler eingestuft) | nein |
| Infiltration | 20.08. | nie | am 03.10. freigegeben, liegen geblieben (Audit abgebrochen) | x73-80 Vertragsruf geschaetzt, ungeeicht |
| Hashes | 14.09. | 19.09. | 2 Laeufe ohne Wirkung | - |
| Gang | 03.10. | 04.10. | 70 % von BN2.1; ausserhalb BN2 nie bewertet | BN2 30 -> 21 -> 15 h |
| Corporation | 05.10. | 06.10. | ein Lauf | kein messbarer Nutzen |
| IPvGO | 24.10. | 07.10. gebaut | rechtzeitig, nur BN15.1 vergessen | - |
| Casino, Int-Exp, Hash->Contracts | frueh | nie | - | nur gerechnet |

- **Die gemessenen Bot-Fehler liegen ueberwiegend frueh:** 86 % der belegten
  Fehlerstunden vor dem 03.10.; 26 von 50 Vorfaellen im August.
- **Die teuerste offene Frage ist nie gemessen:** BN10 x3 und BN9 x3 kosteten
  548 h. Ihr Nutzen (SF10: Sleeves, Grafting; SF9: Hacknet-Start) wurde am
  24.08. mit 150-250 h gerechnet, gegen Kosten von 56 h - real kosteten
  BN10.2+10.3 aber 214 h (Faktor 3,8). Unter dem Ziel "alles auf Stufe 3" sind
  die Laeufe Pflicht; offen ist nur, **ob sie so frueh kommen mussten**, als
  der Bot noch am unreifsten war.

## 6. Muster - als Bauanforderung fuer Lauf 2

Die Zaehlungen ueberlappen (ein Vorfall kann mehreren Mustern angehoeren).

1. **Stille Sperre ohne Alarm** (mind. 12): Einbausperren, volles home,
   Riegel ohne Neustart, Bruecke stirbt still. -> Jede Sperre braucht Ablauf
   und Meldung.
2. **Kaltstart/Knotenwechsel nie im Zielzustand getestet** (mind. 10). Die
   Lehre stand ab 20.08. im Commit, ein Test kam erst am 04.09.
3. **Gebaut, aber nicht angeschlossen** (mind. 9): Trupp 5 Wochen wirkungslos,
   Hashes-Registry, Erfahrungsofen, Graft-Automatik.
4. **Uhr falsch** (mind. 9): Echtzeit gegen Spielzeit, Nachtluecke als
   Stillstand gezaehlt - auch in diesem Audit (V30/V32).
5. **Pruefinstrument prueft nicht das Gebaute** (mind. 8): Test gegen alten
   Baum 42 h, Waechter liest Nebenproduktdatei, RAM-Test gegen alten Stempel.
6. **Konstante aus einem anderen Knoten** (6): `k !== 6 && k !== 7` an sieben
   Stellen.
7. **Entscheidung "vor dem Knoten" zurueckgestellt und vergessen** (5):
   Graft, Go in BN15, BN8-Block, Boerse in V2, Gang.
8. **Lehre nur in einer Notiz, nicht im Code** (5).
9. **Gleiche Fehlerklasse an einer Stelle behoben, an der naechsten
   wiederholt** (Chaos-Kreis, Kaltstart, Einbau vor Beitritt).

## 7. Weitergabe an die naechsten Teile

| Nr | Befund | geht an | Status |
|---|---|---|---|
| C1 | Reihenfolge-Frage: lange V2-Knoten (BN10, BN9) frueh mit unreifem Bot gegen spaeter mit reifem; fairer Massstab in 1d Abschn. 3c | Teil 3 | offen |
| C2 | SF10.2/10.3- und SF9-Nutzen messen statt rechnen (Laufzeiten vor/nach Sleeve 2/3 ab 06./09.09.) | Teil 3 | offen |
| C3 | Je Verfahren eigene Uhr in jedem Modell (V1 online, V2 Wanduhr mit Abschlag) | Teil 3 | offen |
| C4 | V1-Offline-Hebel: langlebige Erfahrungs-Arbeiter (ab 4 h Laufzeit volle Offline-Erfahrung, `ScriptHelpers.ts:27-60`) statt kurzlebiger Stapel. Betrifft 9 V1-Laeufe, bis 132 h Wanduhr. In BN8 nachrangig (Geld traegt, Boerse holt nach) | Teil 4 | offen |
| C5 | V2-Offline-Gutschrift pflegen: Aktion vor der Nacht so waehlen, dass Vorrat und Stamina reichen; Black-Op-Phase verliert offline fast alles | Teil 4 | offen |
| C6 | Infiltration, Boerse in V2, Gang ausserhalb BN2, Casino, Int-Exp, Hash->Contracts: nie geeicht - erst messen, dann entscheiden | Teil 2 | offen |
| C7 | Grafting ab dem ersten V2-Lauf mit SF10, Go in jedem Knoten, in dem es lohnt | Teil 2/4 | offen |
| C8 | Muster 1-9 als Bauanforderungen (Sperren mit Ablauf, Kaltstart-Test im Zielzustand, Anschlusspruefung, Uhrpruefung) | Teil 5 | offen |
| C9 | Lauf-2-Kaltstart: Bot war bis 02.09. in keinem Uebergang autonom; Neubau am laufenden Knoten | Teil 5 | offen |
| C10 | Offen: BN7.3 (67 h online gegen 53/47 h trotz mehr SF), BN3.3, BN13.2 | Teil 4 | offen |

## 8. Grenzen

- `ERLEDIGT.md` (400 KB) ist ueber alle Ueberschriften und alle Zeilen mit
  Zeit- oder Stillstandsangabe gelesen, aber nicht vollstaendig im Volltext.
  Fehlende Vorfaelle waeren eher Minuten- als Stundenposten.
- Vor dem 03.09. (366 h, BN1.1-BN10.1) keine Online-Messung.
- Die 50-%-Gutschrift in V2 ist ein Plausibilitaetstest an 8 Luecken, keine
  Eichung.
