# BN4-Planerabstimmung — Befund und Massnahmen

Ausgelagert aus `nodes/ROADMAP.md` (Fassung 3). Begruendung: der Inhalt gilt
fuer **einen** Knoten und eine Handvoll Stunden, die Roadmap soll 350-700 h
ueberdauern. Sie verweist hierher.

**Quellstand.** Alle Aussagen zum Botcode beziehen sich auf die **laufende
Spielinstanz** (ueber die Bruecke auf Port 8795 gelesen), nicht auf
`nodes/bn4/bn4net.js` im Repo — das ist ein aelterer Abzug. **Deshalb stehen
hier keine Zeilennummern, sondern Beschreibungen der Stellen.** Wer sie sucht,
sucht nach dem beschriebenen Ausdruck.

**Achtung:** an genau diesen Stellen wird parallel gearbeitet. Die Befunde
unten sind der Zustand **vor** dieser Aenderung.

---

## 1. Der Faktor 7 zwischen Modell und Messung

Ein Reviewer hatte ueber ein Fenster von 627 s $34,7k/s gemessen, wo das
Modell des bot-eigenen naiven Verfahrens $261k/s vorhersagte. Der Faktor ist
aufgeklaert.

**Was es nicht ist** (alles einzeln geprueft):

- **Ausgaben.** Kein Rechnerkauf, kein home-Ausbau im Fenster; die beiden
  Programmkaeufe (HTTPWorm, SQLInject) und die eine Augmentierung lagen
  ausserhalb. Brutto = Netto.
- **Tab-Drosselung.** Die Rundenprotokolle ergeben 10,01 s je Runde bei einem
  `sleep` von 10.000 ms.
- **Hack-Chance.** Gemessen 0,71 bis 1,0, gewichtet ~0,9. Hoechstens Faktor
  1,1.
- **Zu wenige Ziele.** Der Planer meldet `zieleAnzahl: 10` plus ein
  Erfahrungsziel. Die Behauptung "der Planer bedient nur zwei Server" stammt
  aus einem Dateistand, der vor dem Messfenster ersetzt wurde.

**Was es ist — die RAM-Sekunden der laufenden Auftraege:**

| Aktion | kGB*s | Anteil |
|---|---|---|
| `hack` | 16 | **6,6 %** |
| `grow` | 138 | 56,9 % |
| `weaken` | 90 | 36,5 % |

Ein koordinierter Stapel liegt bei rund 47 % Hack-Anteil. **6,6 % gegen 47 %
ist Faktor 7,1** und deckt den beobachteten Faktor praktisch vollstaendig.

Die beiden erzeugenden Stellen in `src/bn4net.js`:

1. **Die Beuteschwelle.** Der Ausdruck, der `moneyAvailable` gegen
   `moneyMax * 0.9` prueft, bevor auf `hack` umgeschaltet wird. Er deckelt die
   Entnahme je Zyklus auf hoechstens 10 % des Zielguthabens; darauf folgt ein
   voller `grow`-Durchlauf, und `grow` dauert das 3,2-Fache eines `hack`
   (`Hacking.ts:81-85`).
2. **Die Zuteilung.** Der Ausdruck `anteil = freiFuerSkript / restZiele`
   verteilt nach **freiem Speicher**, nicht nach **Bedarf**. Gemessen: 20
   Hack-Faeden auf `phantasy`, wo 1.602 noetig gewesen waeren (Entnahme
   1,25 %), gleichzeitig 191 `grow`-Faeden auf `omega-net`, wo ein Bruchteil
   genuegt haette.

Dazu RAM, das Geld nie anfasst: die Werkbank (`fulcrumtech`, 1.928 GB,
29,7 % des Netzes) komplett gesperrt, `worker/share.js` 992 GB (15,3 %),
Erfahrungsziel `joesguns` 315 GB (4,9 %).

---

## 2. Ein echter Fehler im Share-Deckel

Der Deckel steht auf 100 Faeden, gemessen laufen **248**. Die Summierung
zaehlt nur die **bereits laufenden** share-Faeden (`shareGesamt +=
shareLaeuft`), nicht die in derselben Runde neu gestarteten. In der ersten
Runde nach dem Umschalten in den Reputationsmodus ist `shareLaeuft` ueberall
0 — jeder der 95 Rechner darf dann bis zu 100 Faeden starten.

Richtig waere `shareGesamt += shareLaeuft + shareFaeden`. Einzeiler, gibt rund
590 GB frei.

Nebenbei: `ns.share` bringt ohnehin nur `1 + ln(threads)/25`
(`NetworkShare/Share.ts:43`). Eine Verdopplung der Faeden bringt 2,8
Prozentpunkte. Der Deckel darf also klein sein.

---

## 3. Sicherheitstoleranz ist absolut statt relativ

Die Umschaltbedingung auf `weaken` vergleicht `hackDifficulty` gegen
`minDifficulty + 5`. Bei Zielen mit `minDifficulty` 3 bis 10 laeuft die
Sicherheit damit bis auf das 2,5-Fache hoch, ohne dass je ein `weaken`
ausgeloest wird. Alle drei Laufzeiten sind linear in `hackDifficulty`
(`Hacking.ts:59-78`) — das verdoppelt jede Aktion.

Richtig: `hackDifficulty > minDifficulty * 1.2 + 1`.

---

## 4. Kontrollmessung — und warum sie als Saettigungsbeweis nicht taugt

Um 06:24:26 kaufte `bn4life` SQLInject.exe, drei Sekunden spaeter rootete
`bn4net` 29 weitere Rechner. Danach gemessen (06:26:46 bis 06:29:49, ohne
Ausgaben, ohne Vertragsgeld): **$23,04 Mio in 183 s = $125,9k/s** gegen
$34,7k/s vorher.

**Der Beleg ist konfundiert und wird nicht als Saettigungsbeweis gefuehrt.**
Mit den 29 gerooteten Rechnern kamen **RAM und Ziele gleichzeitig** hinzu
(der Planer filtert auf `hasRootAccess`). Netz-RAM stieg 3.260 -> 6.508 GB,
also **x2,00**, das Einkommen x3,63 — aber ein Teil davon sind neue, wertvollere
Ziele, nicht mehr Speicher. Nach `Hacking.ts` ist eine ueberlineare Reaktion
auf RAM allein nicht moeglich.

Was die Messung **doch** belegt: die Behauptung "das naive Verfahren ist bei
diesem RAM bereits gesaettigt, mehr Speicher bringt +10 %" ist falsch — sonst
haette sich das Einkommen nicht mehr als verdreifachen koennen. Ein sauberer
Saettigungstest waere: RAM ohne neue Ziele verdoppeln (Aufruestung
vorhandener Mietrechner) und die Rate ueber 30 Minuten gegen den Median der
sechs vorangegangenen Fenster messen. Der steht aus.

---

## 5. Massnahmen in Reihenfolge

**Stufe 0 — Planer, kostenlos, groesster Hebel** (erwartet x3 bis x7):

1. `grow`-Faeden nach **Bedarf** zuteilen statt nach freiem Speicher.
   `src/lib/calc.js#growThreads` liegt fertig da. Zielgroesse: `grow`-Anteil
   von 56,9 % auf unter 15 %.
2. Beuteanteil je Zyklus anheben: Schwelle von 0,9 auf 0,5, Hack-Faeden nach
   `fraction / hackPercent` bemessen statt nach freiem Speicher.
3. Share-Deckel-Fehler beheben (Abschnitt 2).
4. Werkbank nicht auf den groessten Rechner legen. Die Werkzeuge brauchen
   ~120 GB; den 2.048-GB-Rechner dafuer zu sperren kostet 29,7 % des Netzes.
   Kleinsten Rechner >= 150 GB waehlen.
5. Sicherheitstoleranz relativ machen (Abschnitt 3).

**Stufe 1 — Rechner aufruesten, erst nach Stufe 0 sinnvoll:** Alle 25
Kaufplaetze sind belegt, der Kaufblock steigt dann komplett aus — es gibt
**keinen Aufruestpfad**. `ns.cloud.upgradeServer` wird in der BN4-Kette
nirgends aufgerufen; das Vorbild steht in `src/invest.js`. Kosten der ersten
Verdopplung (23 Rechner von 64 auf 128 GB, BN4-Softcap 1,2):
`128*55.000*1,2 - 64*55.000 = $4,93 Mio` je Stueck, zusammen **$113,3 Mio**.
Ausgabendeckel: hoechstens Einkommen/h mal erwartete Stunden bis zum naechsten
Aug-Einbau.

**Stufe 2 — Portprogramme frueher kaufen, kostet nichts:** Die Kaufschwelle
in `src/bn4life.js` verlangt das Dreifache des Preises als Guthaben. Das hat
SQLInject von $250 Mio auf $750 Mio verschoben und den groessten
Faehigkeitssprung des Laufes um Stunden verzoegert. Fuer das **letzte**
fehlende Portprogramm genuegt Faktor 1,2. Stehende Regel fuer jeden kuenftigen
Knoten.

**Stufe 3 — Boerse, zurueckgestellt.** Eintritt $5,2 Mrd allein fuer WSE +
TIX-API, volle Information $31,2 Mrd (`StockMarket/data/Constants.ts:7-10`)
gegen derzeit $689 Mio Guthaben; ohne SF8 nur Long
(`NetscriptFunctions/StockMarket.ts:46-53`, `buyShort`/`sellShort` hinter
SF8.2, `placeOrder` hinter SF8.3); Provision $100k je Handel. Und der Engpass
in BN4 ist Reputation, nicht Geld. Erst anfassen, wenn Stufe 0 und 1 stehen
und das Guthaben $10 Mrd ueberschreitet.

**Stufe 4 — `lib/batch.js` anschliessen.** Die Bausteine liegen fertig da
(`batchModus: false`), das `landAt`/`dauer`-Protokoll der Arbeiter
(`additionalMsec` statt vorgelagertem `sleep`) ist der richtige Unterbau.
Aber: ein Stapel muss RAM ueber seine ganze Laufzeit **reservieren** und darf
nur starten, wenn er vollstaendig passt. Das ist ein Umbau des Zuteilers, kein
Schalter. **Erst nach den Handschlaegen aus ROADMAP 7.4** — sonst hinterlaesst
jeder Aug-Einbau leergeraeumte Ziele mit hochgezogener Sicherheit.

**Messvorschrift fuer jede Einzelmassnahme:** ein Fenster von 30 Minuten ohne
Ausgaben und ohne Vertragsgeld, Rate gegen den Median der sechs
vorangegangenen Fenster.

---

## 6. Absolute Einordnung

| Bezug | Ist | Moeglich | Erreicht |
|---|---|---|---|
| Hack-Anteil an den Arbeiter-RAM-Sekunden | 6,6 % | ~47 % | **~14 %** |
| Rechnerpark gegen das BN4-Maximum | 1.728 GB gekauft | 25 x 1.048.576 GB fuer $1,85e13 | **0,0066 %** |

Die zweite Zeile steht hier, weil "gegen den eigenen Vorzustand messen" der
Fehler ist, den dieses Projekt nicht wiederholen will.

---

## 7. Blindgaenger

`data/tick-last.json` stammt vom 21.08. 17:07 aus **BitNode 1**:
`ramMax: 5.311.204` GB, `hack: 1`, `geld: 1262` — das ist exakt das Startgeld
nach einem Prestige (`CONSTANTS.Donations = 262`). Wer die Datei fuer eine
Modellrechnung heranzieht, liegt um Faktor 800 daneben. Sie gehoert geloescht
oder mit Knotenkennung versehen.
