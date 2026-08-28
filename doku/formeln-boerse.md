# Der Aktienmarkt, aus dem Quellcode

**Wozu diese Datei.** `nodes/BAUSTELLEN.md` fuehrt den Boersen-Bot als
"die einzige Voraussetzung auf der ganzen Route, die noch gar nicht existiert"
(Punkt 3). BitNode 8 hat weder Bladeburner noch Gang noch Corporation noch
Skript-Hackgeld - dort ist Reputation eine reine Geldfrage, und Geld kommt nur
vom Markt. Bevor jemand einen Bot schreibt, gehoert die Mechanik gelesen statt
geraten; alles hier stammt aus `reference/bitburner-src/src/StockMarket/`
(v3.0.2), nichts aus Beobachtung.

Stand: 29.08.2026, 01:50. Der Bot selbst existiert noch nicht.

---

## 1. Was der Zugang kostet

`StockMarket/data/Constants.ts`:

    WseAccountCost            200e6     Konto - Handel ueber die Oberflaeche
    TixApiCost                  5e9     `ns.stock.*` - ohne das kein Bot
    MarketData4SCost            1e9     Forecast und Volatilitaet sichtbar (UI)
    MarketDataTixApi4SCost     25e9     Forecast und Volatilitaet per API
    StockMarketCommission     100e3     je Kauf UND je Verkauf

Der Spielstand am 29.08. um 01:43: `hasWseAccount false`, `hasTixApiAccess
false`, `has4SData false`. In BitNode 10 gibt es keine Multiplikatoren auf
diese Preise (`BitNode.tsx`, case 10 nennt weder `FourSigmaMarketDataCost` noch
`FourSigmaMarketDataApiCost`), sie gelten also unveraendert.

**Die Provision ist die harte Untergrenze fuer die Positionsgroesse.** 100.000
je Richtung, also 200.000 je Runde. Ein Trade muss mehr als das einbringen,
sonst ist er ein Verlust - bei einem erwarteten Gewinn von einem Prozent
braucht es also mindestens 20 Mio Einsatz, um ueberhaupt die Gebuehr zu decken.

## 2. Wie sich ein Kurs bewegt

`processStockPrices` (`StockMarket.ts:239-330`), einmal je **6 Sekunden**
(`msPerStockUpdate: 6e3`, Untergrenze 4 s):

    v  = Math.random()                  // EINMAL je Tick, fuer ALLE Aktien
    av = v * stock.mv / 100             // Schrittweite, mv = Volatilitaet
    chc = stock.b ? (50 + otlkMag)/100  // Wahrscheinlichkeit fuer "hoch"
                  : (50 - otlkMag)/100
    c = Math.random()                   // je Aktie
    c < chc  ->  price *= (1 + av)
    sonst    ->  price /= (1 + av)

Drei Dinge, die man daran uebersieht:

1. **`v` ist fuer alle Aktien dasselbe.** Die Schrittweite eines Ticks ist
   marktweit korreliert, nur die Richtung wuerfelt je Aktie. Wer Positionen
   ueber mehrere Symbole streut, streut damit weniger Risiko weg als es
   aussieht.
2. **Auf und Ab sind nicht symmetrisch:** `*(1+av)` gegen `/(1+av)`. Bei
   gleicher Wahrscheinlichkeit ist der Erwartungswert des Logarithmus null,
   der des Preises aber positiv - eine Aktie mit `chc = 0,5` driftet im Mittel
   leicht nach oben.
3. **Preisdeckel:** Ab `price >= cap` faellt `chc` auf 0,1 und `b` auf false.
   Eine Aktie am Deckel ist ein Short-Kandidat, kein Long.

## 3. Der Zyklus - und warum er die Fensterlaenge bestimmt

`stockMarketCycle` (`:223-236`) laeuft alle **75 Ticks**
(`TicksPerCycle: 75`), also alle **7,5 Minuten**. Dabei kippt jede Aktie mit
**45 Prozent** Wahrscheinlichkeit ihre Richtung (`stock.b = !stock.b`).

Das ist die wichtigste Zahl fuer einen Bot ohne 4S-Daten: Eine aus der
Kurshistorie geschaetzte Richtung ist **hoechstens 7,5 Minuten** gueltig, und
danach mit 45 Prozent falsch herum. Ein Schaetzfenster, das laenger ist als ein
Zyklus, mittelt ueber einen Richtungswechsel und liefert systematisch 50
Prozent - also gar keine Information.

Zwischen den Zyklen wandert `otlkMag` ausserdem langsam
(`cycleForecast(otlkMag * av)`, mit einem Anhebungsschritt unter 5), das
Vorzeichen bleibt dabei aber erhalten.

## 4. Ohne 4S: was ueberhaupt messbar ist

Ohne `has4SData` liefert die API weder `getForecast` noch `getVolatility`. Was
bleibt, ist die Kurshistorie - und aus ihr genau eine Groesse:

    Anteil der Aufwaertsticks in einem Fenster  ->  Schaetzer fuer chc

Mit `chc = (50 ± otlkMag)/100` und `otlkMag` typisch zwischen 1 und 10 liegt
die Abweichung vom Muenzwurf bei 1 bis 10 Prozentpunkten. Der Standardfehler
eines Anteils aus n Ticks ist `0,5/sqrt(n)`, also braucht ein Signal von 5
Prozentpunkten rund `n = 100` Ticks fuer ein Verhaeltnis von 1 zu 1 zwischen
Signal und Rauschen - **und 100 Ticks sind 10 Minuten, mehr als ein Zyklus.**

**Das ist der Kern der Sache: Ohne 4S-Daten ist die Richtung einer einzelnen
Aktie im Rauschen kaum von null zu unterscheiden.** Ein Bot ohne 4S muss
deshalb entweder auf starke Kandidaten warten (`otlkMag` nahe 10, das gibt bei
50 Ticks schon ein brauchbares Verhaeltnis) oder ueber viele Symbole gleichzeitig
setzen und die Provision durch Positionsgroesse erdruecken.

**Fuer BitNode 8 ist das die Kaufentscheidung:** 25 Mrd fuer die 4S-API sind
kein Luxus, sondern der Unterschied zwischen Rechnen und Raten. Wieviel Geld
bis dahin noetig ist und woher es kommt, gehoert in die BN8-Vorbereitung -
dort ist Skript-Hackgeld auf 0 gesetzt, der Markt finanziert sich also selbst
oder gar nicht.

## 5. Spread und Provision zusammen

`Stock.getAskPrice()` (`Stock.ts:224-227`): `price * (1 + spreadPerc/100)`,
der Verkauf entsprechend darunter. Eine Runde kostet also

    2 * Kommission (200.000)  +  Spread (2 * spreadPerc/2 auf den Einsatz)

Beides ist fix je Runde beziehungsweise proportional zum Einsatz - die
Provision spricht fuer wenige grosse Positionen, der Spread ist von der Groesse
unabhaengig. Ein Bot, der oft umschichtet, verliert an der Provision, einer der
selten umschichtet, verpasst den 7,5-Minuten-Zyklus. Die Positionsdauer sollte
also nahe an einem Zyklus liegen und die Positionsgroesse so gross, dass 200.000
Provision unter einem Zehntel des erwarteten Gewinns bleiben.

## 6. Was hier noch fehlt

- `PlayerInfluencing.ts`: Eigene Hack- und Grow-Aufrufe verschieben den
  Forecast der zugehoerigen Aktie (`shareTxUntilMovement`). In einem Knoten mit
  laufendem Hacknetz ist das ein Hebel, der nichts kostet - ungelesen.
- `getDarknetVolatilityMult`: In `processStockPrices` steht ein
  Darknet-Multiplikator auf die Volatilitaet. Woher er kommt und ob er
  steuerbar ist, ist ungeprueft.
- Limit- und Stop-Orders (`OrderProcessing.tsx`) werden bei jedem Tick
  abgearbeitet. Ob sie einem Bot etwas bringen, das er nicht auch mit
  Marktorders erreicht, ist ungeprueft.
