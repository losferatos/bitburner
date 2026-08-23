# Formel-Inventur BitNode 4 - Auftragstexte fuer die Subagents

Vorbereitet am 23.08.2026 um 12:50, Start um 13:01 nach dem Kontingent-Reset.
Jeder Block unten ist der vollstaendige Prompt fuer EINEN Agenten. Sie sehen
die Unterhaltung nicht, deshalb steht der Kontext in jedem Block erneut.

## Gemeinsamer Kontext (steht in jedem Auftrag)

Arbeitsverzeichnis: `C:\Users\erche\Desktop\claude_projecto\bitburner`
Bitburner-Quelltext v3.0.1: `reference/v301/src/` (massgeblich)
Bot-Quelltext: `src/*.js`, Bibliotheken `src/lib/`, Werkzeuge `tools/*.js`

Spielstand am 23.08.2026, 12:50 (BitNode 4, erster Durchlauf):
- Hacking 3831, Geld $301,7 Bio, Stadt Aevum
- Multiplikatoren: hacking 7,938 | faction_rep 2,853 | hacking_money 9,797 | hacking_chance 3,020
- 43 Augmentierungen installiert, davon NeuroFlux x59
- Faktionen: Daedalus 3.137 Rep (Favor 0), Clarke Inc 147.915 (Favor 0),
  BitRunners 100.276 (Favor 216, spendenberechtigt), The Black Hand ~43.000
  (Favor 116), NiteSec ~43.000 (Favor 114), Aevum ~41.000 (Favor 106),
  Sector-12 ~33.000 (Favor 81), CyberSec ~42.000 (Favor 107)
- Netz: 96 von 96 Rechnern gerootet, rund 5.300 TB Speicher, ~$1,4 Mrd/s
- Ziel des Knotens: `w0r1d_d43m0n` verlangt Hacking 9000
  (WorldDaemonDifficulty 3, BitNode.tsx:660) UND den Einbau von The Red Pill
  (2,5 Mio Rep bei Daedalus), weil der Server sonst gar nicht am Netz haengt.

**Uebergeordnetes Ziel:** alle 15 BitNodes bis Level 3, in moeglichst kurzer
Zeit. Der Bot laeuft autonom.

## WARUM ES DIESE INVENTUR GIBT - bitte lesen

Am 22.08. liefen mehrere Skeptikerrunden ueber diese Strategie. Alle haben
BEHAUPTUNGEN geprueft ("stimmt diese Zahl?"). Keine hat nach STELLSCHRAUBEN
gesucht ("welche Variablen gehen ueberhaupt ein, und welche davon nutzen wir
nicht?"). Deshalb sind danach noch fundamentale Luecken aufgetaucht, und der
Auftraggeber ist zu Recht skeptisch geworden.

**Dein Auftrag ist ausdruecklich die zweite Art.** Bestaetigung ist wertlos.
Gesucht ist, was FEHLT. Miss gegen den theoretisch moeglichen Bestwert, nicht
gegen den jetzigen Zustand.

**Pflicht-Ausgabeformat** - eine Tabelle, eine Zeile je Variable:

| Variable | Fundstelle (Datei:Zeile) | geht wie ein | nutzen wir? | Hebel |

"nutzen wir?" ist JA / TEILWEISE / NEIN / NICHT ANWENDBAR.
"Hebel" nur bei TEILWEISE und NEIN: geschaetzter Faktor auf die Zielgroesse
und was konkret zu tun waere. Keine Prosa ausserhalb der Tabelle ausser einem
Schlussabschnitt "Die drei groessten ungenutzten Hebel".

---

## Agent 1 - Reputationsrate

Zielgroesse: Reputation je Sekunde, bei Faktionen wie bei Firmen.
Startpunkte: `Work/Formulas.ts`, `PersonObjects/formulas/reputation.ts`,
`Company/CompanyPosition.ts`, `Faction/formulas/favor.ts`,
`Faction/formulas/donation.ts`, `BitNode/BitNode.tsx` (case 4).
Im Bot: `src/bn4rep.js`.

Beantworte zusaetzlich: Welche Faktoren der Rep-Formel haengen an Werten, die
der Bot gar nicht trainiert (Charisma, Intelligence)? Rechne den Break-even
aus, nicht nur die Richtung.

## Agent 2 - Erfahrungsrate und Hacking-Level

Zielgroesse: Hacking-Level, konkret der Weg von 3831 auf 9000.
Startpunkte: `PersonObjects/formulas/skill.ts`, `Hacking.ts`,
`Server/formulas/*`, `Augmentation/*`, `BitNode/BitNode.tsx` (case 4).
Im Bot: `src/bn4net.js`.

Das Level ist `floor(mult * (32*ln(exp+534,6) - 200))`. Rechne konkret aus,
welche Kombination aus Multiplikator und Erfahrung 9000 am schnellsten
erreicht, und welche Erfahrungsquellen der Bot heute NICHT anzapft.

## Agent 3 - Geldrate

Zielgroesse: Dollar je Sekunde.
Startpunkte: `Server/formulas/grow.ts`, `Hacking.ts`, `Server/ServerHelpers.ts`
(besonders `getCoreBonus`, Zeile 315-323), `NetworkShare/Share.ts`,
`Hacknet/*`, `StockMarket/*`, `Corporation/*`.
Im Bot: `src/bn4net.js`, `src/worker/*.js`.

**Offene Faehrte, ausdruecklich pruefen:** `getCoreBonus(cores) = 1 + (cores-1)/16`
wirkt auf grow, weaken und share. Gekaufte Server haben immer 1 Kern, home
mehr. Der Bot hat das nie ausgewertet - `src/kerne.js` wurde gebaut und nie
gelesen. Was ist der reale Hebel?

## Agent 4 - Augmentierungspreise und Reset-Oekonomie

Zielgroesse: Multiplikator-Zuwachs je investierter Stunde.
Startpunkte: `Augmentation/Augmentation.ts` (besonders 238-246, die
Preissteigerung je Eintrag in `queuedAugmentations`), `Augmentation/
Augmentations.ts`, `Faction/formulas/favor.ts`, `Prestige.ts`.
Im Bot: `src/bn4rep.js`, dort besonders die Funktion `guete`.

Beantworte: Wann lohnt ein Einbau, wann lohnt Warten? Wieviele NeuroFlux-
Stufen sind optimal (aktuell 59, jede verteuert JEDEN weiteren Kauf)? Ist die
Reihenfolge, in der der Bot Faktionen abarbeitet, die beste?

## Agent 5 - Was wir ueberhaupt nicht anfassen

Kein enger Zielgroessen-Auftrag, sondern die Gegenprobe: Welche Systeme des
Spiels sind in BitNode 4 verfuegbar und werden vom Bot NICHT genutzt?

Zu pruefen mindestens: Intelligence (`calculateIntelligenceBonus(int, weight)
= 1 + weight*int^0.8/600`, bei share mit doppeltem Gewicht - nie betrachtet),
Stanek's Gift, Sleeves (in BN4 ueber Singularity erreichbar?), Gang,
Corporation, Bladeburner, Aktienmarkt, Hacknet-Server, Darknet-Programme,
Codingvertraege, Go, Karma/Verbrechen.

Je System: verfuegbar in BN4 ja/nein (mit Fundstelle), Aufwand zum
Erschliessen, geschaetzter Ertrag. Sortiert nach Ertrag je Aufwand.

## Agent 6 - Umbau der Guetefunktion (Entwurf, kein Eingriff)

Dies ist der einzige Agent mit konkretem Umbauauftrag. **Nichts aendern, nur
entwerfen** - die Guetefunktion traegt die gesamte Zielwahl des Bots.

Befund vom 23.08., den du pruefen und praezisieren sollst:

`src/bn4rep.js`, Funktion `guete` (~Zeile 810). Sie bewertet ein Ziel als
Ertrag geteilt durch Reputationsluecke, mit einem Zuschlag `favorNaehe`, der
hoechstens Faktor 2 betraegt. Erreicht eine Faktion aber Favor 150, wird ihr
GESAMTER Bestand von einer Zeitfrage zu einer Geldfrage (Spendenrecht,
`rep = betrag/1e6 * mults.faction_rep`). Das ist ein Schwelleneffekt, den ein
Faktor 2 nicht abbildet.

Konkret bei Daedalus: Favor-150-Schwelle liegt bei 462.490 kumulierter
Reputation (`favorToRep(150)`), das billigste nuetzliche Daedalus-Stueck
(ENM Analyze Engine) bei 625.000, The Red Pill bei 2,5 Mio. Gegen eine
NiteSec-Luecke von 7.000 Rep verliert Daedalus um Faktor 89 - Faktor 2 gleicht
das nie aus. Der Bot geht Daedalus also erst an, wenn alles Billigere
erschoepft ist, statt dann, wenn es sich rechnet.

Liefere: (a) ist der Befund korrekt, oder uebersehe ich etwas? (b) ein
konkreter Formelvorschlag als Diff-faehiger Codeblock, (c) welche
Nebenwirkungen er auf die uebrigen Faktionen hat, (d) ein Testfall, mit dem
sich die Wirkung am laufenden Spiel nachweisen laesst.
