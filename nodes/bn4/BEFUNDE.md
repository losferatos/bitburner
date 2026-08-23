# Befundliste - jeder Befund mit Status, nichts faellt raus

**Wozu diese Datei.** Am 23.08.2026 haben drei von sechs Inventur-Agenten
unabhaengig voneinander denselben Befund gemeldet (share-Deckel, +6,3 %
Reputationsrate). Er wurde trotzdem nicht umgesetzt - nicht weil er
uebersehen wurde, sondern weil er in einem Fliesstext-Bericht stand und beim
Abarbeiten der "wichtigeren" Punkte herausfiel. Aufgefallen ist es erst, als
Eric danach fragte.

Die Lehre ist nicht "mehr Kritiker" oder "gruendlicher analysieren" - beides
hat funktioniert. Die Lehre ist **Buchfuehrung**: Befunde gehoeren in eine
Liste mit Status, nicht in Prosa.

**Regel:** Jeder Befund aus jeder Pruefrunde kommt hier rein, mit Status.
OFFEN wird nur durch UMGESETZT oder VERWORFEN (mit Begruendung) ersetzt,
nie durch Stillschweigen. Vor jedem Stundenbericht wird diese Liste
durchgesehen.

Status: UMGESETZT | VERWORFEN | OFFEN | LAEUFT

## Aus der Formel-Inventur (23.08.2026, sechs Agenten)

| # | Befund | Wirkung | Status |
|---|---|---|---|
| I1 | Portprogramme werden bei JEDEM Einbau geloescht | Gelddecke Faktor 22 | UMGESETZT |
| I2 | reserveHome sperrte 262.144 GB fuer 126 GB Bedarf | +24,9 % Netz | UMGESETZT |
| I3 | geldFuerRep ohne FactionWorkRepGain | Spenden 33 % zu billig | UMGESETZT |
| I4 | Spende ging ueber den ganzen Bestand | bei <1 % Bedarf | UMGESETZT |
| I5 | Guetefunktion rechnete in Rep statt Zeit; The Red Pill Wert null | Daedalus 2,1 statt 11,6 h | UMGESETZT |
| I6 | share-Deckel 4.000 gegen ein 40x kleineres Netz kalibriert | +6,3 % Reputation | UMGESETZT UND GEMESSEN - erster Anlauf lieferte nur 19 % der Wirkung, weil der Deckel aus dem Gesamt-RAM gerechnet wurde (home = 97,7 %), die Zuteilung home aber ausschloss |
| I7 | NeuroFlux seit Stufe 59 blockiert, Reputation nicht zukaufbar | x1,15 je Zyklus | UMGESETZT |
| I8 | hackNutzen gewichtet hacking_money wie hacking | ECorp HVMind 2,00 -> 0 | UMGESETZT |
| I9 | home-RAM-Ausbau ohne Amortisationspruefung | 167 Mio je GB gegen 409k beim Mietrechner | UMGESETZT (= A7) |
| I10 | GAP_MS 400: Netz nimmt nur 8.951 GB von 1,07 PB auf | 71,7 % brach | **OFFEN** |
| I11 | Erfahrungsofen laeuft auf weaken statt hack | Faktor 4,1 je GB-Sekunde, +9 % Reputation | **OFFEN** |
| I12 | Vier weitere Firmenfaktionen (NWO, ECorp, Blade Industries, **Fulcrum Secret Technologies** - nicht Four Sigma, das war ein Uebertragungsfehler: Four Sigma traegt fast nur charisma und company_rep, Fulcrum die ENM-Kette mit echten hacking-Multiplikatoren) | zusammen ~x1,45 | **OFFEN** |
| I13 | IPvGO: ein Sieg gegen w0r1d_d43m0n = x1,197 auf mults.hacking | entspricht nextSENS (437.500 Rep) | **OFFEN** - braucht Go-Spielskript, erst nach Red Pill |
| I14 | home hat 1 Kern; upgradeHomeCores wird nie aufgerufen | +30,8 % auf home fuer grow/weaken | **OFFEN** |
| I15 | Intelligence in BN4 hart null (SF5 noetig) | - | VERWORFEN - Faehrte tot |
| I16 | hacking_chance wird auf 1,0 geklemmt | 3,02 ist tote Investition | VERWORFEN - nur bei ungepreppten Zielen wirksam |
| I17 | Export-Bonus (+1 Favor je Faktion je 24 h) | ~2 Minuten Arbeit je Tag | VERWORFEN - oeffnet Download-Dialog im Produktivbrowser |
| I18 | Aktienmarkt | Geld ist nicht der Engpass | VERWORFEN |
| I19 | Hacknet ueber die Netburners-Schwelle hinaus | HacknetNodeMoney 0,05; Augs ohne Hacking-Multiplikator | VERWORFEN - Zweck (30er-Huerde) erfuellt |

## Nachtrag: beim ersten Durchgang selbst uebersehen (23.08.2026, 14:40)

Eric fragte nach, ob noch etwas aus den Berichten fehle. Es fehlten sieben
Punkte - die Liste war schon beim Anlegen unvollstaendig, aus genau dem
Grund, den sie beheben soll. Deshalb stehen sie hier eigens, nicht
eingemischt.

| # | Befund | Wirkung | Status |
|---|---|---|---|
| N1 | Charisma-Break-even im Code ist um Faktor 760 falsch. Der Kommentar (bn4rep.js) rechnet mit `mults.charisma` 1,163 und 14,5 h Training; gemessen sind es 4,059 und **69 Sekunden**. IT Manager gaebe +12,9 %, Systems Administrator +21,8 % Firmenreputation | Ergebnis stimmt zufaellig, Begruendung ist falsch - und eine falsche Begruendung sperrt beim naechsten Zustandswechsel das Falsche | **OFFEN** |
| N2 | Die Firmenwahl ignoriert den Firmenfavor. `COMPANIES` (bn4rep.js) ist eine feste Liste; `(1 + Firmenfavor/100)` geht aber direkt in die Rate ein (Work/Formulas.ts:131,156). Clarke stand auf Favor 132,3, OmniTek auf 0 | x2,32 auf die Firmenphase | **OFFEN** |
| N3 | `lib/hackaugs.js` wertet `faction_rep` mit halbem Gewicht (Wurzel). Der Multiplikator wirkt aber dreifach: auf Arbeit, auf Passivrate UND auf den Spendenkurs | volles Gewicht waere richtig | **OFFEN** |
| N4 | `buyaugs.js` gewichtet `hacking_money` mit 1,5 ueber `hacking` mit 1,0 - derselbe Fehler wie in bn4rep, aber in einer zweiten Datei, die beim levelNutzen-Umbau nicht mitgezogen wurde | falsche Kaufreihenfolge, wenn buyaugs benutzt wird | **OFFEN** |
| N5 | `MINDEST_WARTESCHLANGE = 3` und `LUECKE_ZU_GROSS = 15000` (bn4rep.js) sind auf "~40 rep/**min**" kalibriert. Tatsaechlich sind es 40 bis 190 rep/**s** - die Konstanten sind um Faktor 63 veraltet. 15.000 Reputation sind heute sechs Minuten, nicht sechs Stunden | Einbau-Ausloeser war praktisch dauerhaft scharf: 15.000 Rep entsprachen 3,7 Minuten statt sechs Stunden | UMGESETZT - Schwelle jetzt in Zeit (45 min) |
| N6 | `kandidaten` prueft keine `prereqs`. Die ENM-Kette bei Daedalus haengt aneinander; fehlt ein Vorlaeufer, rankt der Bot dauerhaft ein unkaufbares Stueck | heute unkritisch, alle Vorlaeufer vorhanden | **OFFEN** |
| N7 | Exploits: 3 von 11 eingesammelt (`src/exploit.js`). Jeder gibt 1,001 auf `hacking`, `hacking_exp`, `faction_rep` und ein Dutzend weitere - und **ueberlebt jeden BitNode** | +0,8 % auf alles, dauerhaft ueber alle 15 Knoten | **OFFEN** |
| N8 | `lib/calc.js` hat einen `cores`-Parameter (Zeilen 123, 203, 230, 268), aber kein Aufrufer uebergibt je etwas anderes als den Vorgabewert 1 | gehoert zu I14 | **OFFEN** |

## Aus der Kritikerrunde (23.08.2026, drei Kritiker)

| # | Befund | Wirkung | Status |
|---|---|---|---|
| K1 | Einbau-Karussell durch die Spendenschwelle | Knotenausgang waere unerreichbar | UMGESETZT |
| K2 | reserveHome gab nach Knotenwechsel 8 GB statt 64 | schlechter als vorher | UMGESETZT |
| K3 | Nach BitNode-Wechsel laeuft gar nichts | 45 Totalausfaelle | UMGESETZT (boot.js, exit.js) |
| K4 | repPerSecond unterstellt allen Faktionen Hacking-Arbeit | Faktor 6 bei Kampf-Faktionen | UMGESETZT |
| K5 | Entdopplung deckt bn4life/bn4net selbst nicht ab | zwei Steuerungen zugleich | UMGESETZT |
| K6 | Programmkauf umgeht data/geldbedarf.txt | ueberholt verdiente Augs | UMGESETZT |
| K7 | Telemetrie zeigt beim Schwellenziel eine erfundene Huerde | Nachtaufsicht unmoeglich | UMGESETZT |
| K8 | beitritt-erledigt.txt ueberlebt jeden Reset | 4 Faktionen, 19 Augs draussen | UMGESETZT |
| K9 | Zeitspalte der Inventur Faktor 338 zu optimistisch | Schwelle mult 16-17 statt 14 | UMGESETZT (Dokument korrigiert) |
| K10 | "4,41 von 22,89" vermischt Aug-Produkt und mults.hacking | realistisch x2,61 offen, nicht x5,19 | UMGESETZT (Dokument korrigiert) |
| K11 | levelNutzen-Naeherung ln(f) ueberschaetzt | bei QLink 30,6 % | UMGESETZT |
| K12 | Die Route steht auf einem Rechenfehler (Praemissen-Kritiker) | BN6 nicht auf Platz 2 | UMGESETZT (ROADMAP-KORREKTUR.md) |
| K13 | Mietpark seit dem Einbau nicht wieder aufgebaut | Netz zu 97,7 % home | siehe I10 - kein eigener Fehler, Folge des Aufnahmedeckels |

## Aus dem Audit der Befundliste (23.08.2026, 15:00)

Eric fragte nach, ob noch etwas fehle. Ein Auditor prueft seither die Liste
gegen den Code. Ergebnis: **die Liste selbst hat durchrutschen lassen** -
darunter ein Show-Stopper.

| # | Befund | Wirkung | Status |
|---|---|---|---|
| A1 | Der Endspiel-Riegel aus K1 war ein DEADLOCK: geprueft wurde `besitz` (enthaelt gekaufte Stuecke in der Warteschlange), The Red Pill kostet null Dollar und wird sofort gekauft - danach war der einzige installAugmentations-Aufruf gesperrt | **Knoten waere dauerhaft unverlassbar gewesen**, das Log haette "eingebaut" gemeldet | UMGESETZT |
| A2 | exit.js und boot.js hatten keinen Aufrufer - gebaut ist nicht verdrahtet | Ausgang haette nie stattgefunden | UMGESETZT |
| A3 | boot.js loeschte `data/install-lock.txt`, die Datei heisst `data/install-sperre.txt` | Einbausperre haette jeden Knotenwechsel ueberlebt | UMGESETZT |
| A4 | reserveHome lieferte 24 GB statt 64; bn4life.js fehlte im Bedarf | Wiederanlauf auf kleinem home gefaehrdet | UMGESETZT |
| A5 | Der Firmenphasen-Filter entschied weiter mit hackNutzen | ECorp HVMind haette die Phase blockiert | UMGESETZT |
| A6 | field wurde vor security gewaehlt (Nenner 5,5 statt 4,5) | 22 % bei Kampf-Faktionen | UMGESETZT |
| A7 | home-Ausbau ohne Amortisationspruefung (= I9) | 167 Mio je GB gegen 409.000 beim Mietrechner | UMGESETZT |
| A8 | Der Stillstandsalarm der Nachtaufsicht nannte bei Schwellenzielen eine Augmentierung | genau der Anwendungsfall von K7 | UMGESETZT |
| A9 | data/geldbedarf.txt ueberlebt den Einbau und wurde von boot.js nicht geraeumt | blockierte den Portprogramm-Kauf genau im Wiederaufbau-Fenster | UMGESETZT |
| A10 | Zeilennummern in dieser Datei zeigten 34 bis 66 Zeilen daneben; PLANER.md verbietet sie ausdruecklich | ein Befund, den man nicht findet, faellt wieder raus | UMGESETZT - Zeilennummern entfernt |
| A11 | I12 nannte "Four Sigma" statt "Fulcrum Secret Technologies" | die genannte Faktion traegt nichts bei, die gemeinte die ENM-Kette | UMGESETZT |
| A12 | ROADMAP.md, ABSCHLUSS.md und der Kopf von INVENTUR-ERGEBNIS.md trugen widerlegte Zahlen unmarkiert weiter | wer sie oeffnet, liest die falsche Fassung ohne Warnung | UMGESETZT - Warnhinweise gesetzt |
| A13 | Doc-Block behauptete "additiv ueber mehrere Stuecke" - galt fuer ln(f), nicht fuer (1-1/f) | fuer Rangfolgen unerheblich, fuer Buendel nicht | UMGESETZT |
| A14 | WD_DIFFICULTY setzte fuer BitNode 8 den Wert 2, richtig ist 1 (BitNode.tsx setzt dort nichts); BitNode 12 ebenso | Schwelle 3000 statt 6000 | UMGESETZT |
| A15 | NUTZEN_GEWICHT und EXIT_KEY_VALUE sind gegen mult 9 kalibriert; levelNutzen skaliert mit zielLevel/(32*mult) - bei mult 1,7 liefert nextSENS 27 statt 5 | trifft die Fruehphase nach einem Knotenwechsel | **OFFEN** |
| A16 | Die Entdopplung hing an `if (werkbank)` - ohne Werkbank keine Entdopplung | genau nach einem Knotenwechsel | UMGESETZT |
| A17 | Drei weitere Kaufstellen lesen data/geldbedarf.txt nicht (Tor-Kauf, darkweb.js) | koennen verdiente Augmentierungen ueberholen | **OFFEN** |
| A18 | Die Wiederanlaufkette ist UNGETESTET - K3 stand auf UMGESETZT, gebaut ist nicht getestet | 45 Knotenuebergaenge haengen daran | **OFFEN** |
| A19 | Kampfwerttraining als Weg zu QLink (x1,75) und SPTN-97 (x1,15) - weder verworfen noch offen gefuehrt | x2 auf den Multiplikator, Kampfwert steht seit dem Beitrittslauf bei 167 statt 2 | **OFFEN** |
| A20 | Bladeburner-Fortschritt ueberlebt den Einbau vollstaendig - die stehende Gegenrechnung zur Routenkorrektur | koennte die Route wieder kippen | **OFFEN** |
| A21 | Die neue BitNode-Reihenfolge ist Entwurf, nicht beschlossen | K12 laesst sie entschieden aussehen | **OFFEN** |
| A22 | Der Spendenweg war bis zum NFG-Zukauf toter Code (nur BitRunners berechtigt, dort alles gekauft) | bewertet I3 und I4 nachtraeglich | zur Kenntnis |
| A23 | Geldrate 7,4e10 statt 3,4e10 $/s - Spendenvorteil Faktor 1017 statt 390 | Faktor 2,2 in jeder Spendenrechnung | zur Kenntnis |

## Eigene Fehler beim Umsetzen (zur Erinnerung, nicht zur Selbstkasteiung)

- **Passivertrag als Zielkriterium**: durch den Passivanteil geteilt statt
  (1 - Anteil) gerechnet - Faktoren 6 statt 10 Prozent, und in die falsche
  Richtung. Zurueckgenommen.
- **TDZ zweimal**: `nfgSpendenSchwelle` rechtzeitig abgefangen, `EXIT_KEY`
  nicht - zwei Minuten Rundenfehler. Regel: Bei jeder neuen Konstante pruefen,
  wo sie zuerst BENUTZT wird, nicht wo sie hingehoert.
- **reserveHome**: Math.min(max/4, Math.max(64, ...)) deckelt die
  Untergrenze weg. Reihenfolge von min und max pruefen.
