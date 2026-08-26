# Offene Baustellen

**Diese Datei ist die Arbeitsliste des Vorankommens-Loops.** Sie existiert, weil
Befunde sonst in Prosa verschwinden: Am 24.08.2026 sind drei von fuenf
Pruefbefunden untergegangen, weil sie in einem Fliesstext standen statt in einer
Liste, die man abhaken kann.

Regeln:
- **Ein Arbeitspunkt ist eine Zeile, die mit `### ` beginnt.** Nur solche Zeilen
  zaehlen. Steht unter einer Ueberschrift keine `### `-Zeile, ist der Abschnitt
  leer - Erklaerungen und Fliesstext sind keine Arbeit.
- **`## Sofort` hat Vorrang vor `## Offen`**, ohne Abwaegung. Dort tragen der
  Reportloop und die Wache ein, was sie kaputt vorfinden aber nicht selbst
  beheben. Abgeraeumtes wandert nach "Erledigt".
- **Die Reihenfolge in der Datei IST die Rangfolge.** Nicht neu bewerten, nicht
  umsortieren. Ein Punkt, dessen Ueberschrift mit "Wartet bis <Uhrzeit>"
  beginnt, wird uebersprungen statt angefangen.
- Ein Punkt je Lauf. Wer fuenf Punkte gleichzeitig anfaengt, schliesst keinen.
- Erledigtes wird nach unten verschoben, nicht geloescht - der Verlauf ist die
  Begruendung fuer das, was heute steht.
- Was hier nicht steht, wird nicht bearbeitet. Neue Befunde kommen zuerst hierher.
- **Die Loops entscheiden selbst. "Wartet bis Eric" ist kein Ablageort fuer
  unbequeme Entscheidungen** (Eric, 26.08.2026, 16:05). Aus einer belegten
  Erkenntnis wird ein **unmittelbarer Arbeitsauftrag**, nicht ein Wartestatus.
  Wer eine Zahl gemessen hat, die eine Aenderung rechtfertigt, setzt sie um und
  misst nach - und nimmt sie zurueck, wenn sie nicht traegt.
  Vorgelegt wird nur, was Eric sich ausdruecklich vorbehalten hat:
  **Aenderungen an `src/bn4net.js` und `src/boot.js`** sowie **die Reihenfolge
  der BitNodes**. Alles andere ist Sache der Loops.
  *Anlass: Der Raid-Befund vom 26.08. stand vier Laeufe lang auf "Wartet bis
  Eric entscheidet", obwohl jede Zahl dafuer gemessen war. Das kostete den
  groessten offenen Hebel des Knotens einen halben Nachmittag.*

---

## Sofort

### Raid einbauen - dreifache Zyklusrate, Guthabengrenze als Notbremse (16:05)

**Geaendert 16:15 und 16:50, Wirkung noch nicht gemessen.** Der Einbau steht
(`src/blade.js`, Commit 3240793 und der folgende), gemessen ist er nicht - um
16:31 kam ein Augmentierungs-Einbau dazwischen, das Guthaben liegt seither bei
-281.147 Dollar und `RAID_GELD_MIN = 2e9` greift damit gar nicht. Die
30-Minuten-Messung aus Punkt 2 faellt fruehestens an, wenn die Kampfwerte
wieder bei 100 stehen und das Guthaben zwei Milliarden erreicht hat.

**Die Abnahmeschwelle aus Punkt 2 ist falsch und wird hiermit korrigiert
(16:50).** Dort steht "erwartet wird eine Zyklusrate ueber 2,5". Diese Zahl
rechnet die Chaos-Gegenkraft nicht mit, und wer spaeter danach misst, dreht
eine funktionierende Aenderung an einer unerreichbaren Zahl zurueck.

Raid erzeugt selbst das Chaos, das ihn ausbremst:
`city.changeChaosByPercentage(getRandomIntInclusive(1, 5))` je Durchlauf,
unabhaengig von Erfolg (`Bladeburner.ts:846`). Im Mittel 3 Prozent auf 56
Sekunden Laufzeit, also **+3,21 Prozent je Minute**. Dagegen haelt nur
Diplomacy: 60 Sekunden, keine Ausdauer, **keine Erfahrung**
(`data/GeneralActions.ts:37-44`), senkt das Chaos um
`charisma^0,045 + charisma/1000` Prozent (`Bladeburner.ts:737-745`,
`:1188-1189`). Beide Groessen sind prozentual, das Verhaeltnis ist damit
chaos-unabhaengig, und der Raid-Anteil im Gleichgewicht betraegt
`D / (D + 3,21)` mit D = Diplomacy-Prozent je Minute.

D haengt allein am Charisma, und der lineare Term regiert:

    Charisma    D/min   Raid-Anteil   effektive Zyklusrate (3,791 x Anteil)
         100     1,33         29,3%                            1,11
       1.200     2,58         44,5%                            1,69
       5.000     6,47         66,8%                            2,53

Tracking liefert 1,115. **Bei niedrigem Charisma ist Raid nicht besser** - er
kostet nur zusaetzlich rund 37 Millionen je Minute an Krankenhausrechnungen.
Der Gleichstand liegt bei D = 1,337, also knapp ueber Charisma 100; ein
Vorsprung von 50 Prozent erst bei rund 1.150.

**Umgesetzt (16:50):** `RAID_CHARISMA_MIN = 1200` in `src/blade.js`, als
fuenfte Bedingung neben Guthaben, Chaos, Chance und Vorrat. blade.js wurde
ueber `data/reload.txt` neu gestartet.

**Neue Abnahmeschwelle:** Zyklusrate ueber **1,60** bei Charisma um 1.200,
gemessen ueber 30 Minuten aus `data/aktionen.txt`. Traegt sie nicht, oder
faellt das Guthaben schneller als 15 Millionen je Minute: `RAID_AN = false`.

**Offen geblieben:** Charisma ist damit ein Hebel, den niemand bedient - es
waechst nicht durch Bladeburner-Arbeit. Ob sich gezieltes Charisma-Training
rechnet, steht als eigener Punkt unter `## Offen`.

**Nicht mehr blockiert.** Der Punkt stand vier Laeufe lang auf "Wartet bis Eric
entscheidet". Eric hat das am 26.08. um 16:05 zurueckgewiesen: **Die Loops
entscheiden selbst, und aus einer belegten Erkenntnis wird ein unmittelbarer
Arbeitsauftrag.** Alles Messbare ist gemessen (Punkte 1, 2 und 2b unten sind
abgehakt), also wird gebaut und nachgemessen - nicht gewartet.

**Auftrag, konkret:**
1. `SICHER_OPERATION` (`src/blade.js:48`) nicht pauschal senken. Stattdessen
   Raid einzeln zulassen, wenn zwei Bedingungen zugleich gelten:
   **Guthaben ueber 2 Mrd** (Notbremse - bei 25,7 Mio je Minute Einkommen und
   37 Mio je Minute Kosten bleiben von dort aus rund drei Stunden Puffer, und
   der Deckel `Geld * 0,1` senkt die Kosten mit) **und Chaos der Arbeitsstadt
   unter 50** (sonst ist die Chance halbiert und der Erwartungswert kippt).
2. Nach dem Einbau **mindestens 30 Minuten messen**: Rangrate aus
   `data/aktionen.txt`, Guthabenverlauf aus `geld.js`, Kammeranteil.
   Erwartet wird eine Zyklusrate ueber 2,5 (gegen 1,12 bei Tracking) und ein
   Guthabenrueckgang von hoechstens 15 Mio je Minute.
3. Traegt es nicht, oder faellt das Guthaben schneller: **zurueckdrehen** und
   das Ergebnis hier eintragen. Eine widerlegte Zahl ist ein Ergebnis.

**Dritte Korrektur dieses Punktes, und diesmal mit der richtigen Kennzahl
(13:22).** 12:55 stand hier "das Siebenfache" (Bruttoertrag, falsch), 13:05
"anderthalbfach" (netto je Minute, richtig gerechnet aber die falsche Groesse).
Beide Male fehlte die Ausdauer.

**Der Ausdauerverlust faellt JE AKTION an** (`Bladeburner.ts:921`), nicht je
Zeit. Eine lange Aktion verteilt denselben Verlust auf mehr Minuten und
braucht deshalb weniger Kammerzeit. Das kehrt die Rangfolge um. Gemessen im
Spiel um 13:22 ueber `data/bbspann.json`, das die Rechnung jetzt selbst fuehrt:

    Aktion                  Stufe  Chance  netto/min  Aus/min  Arbeit  Zyklus
    Raid                        1   0,107      3,891     2,36   97,4%   3,791
    Bounty Hunter              13   0,362      1,859     3,65   63,1%   1,173
    Tracking                   29   0,725      2,513     5,18   44,4%   1,115   <- gefahren
    Retirement                 16   0,450      1,895     4,25   54,1%   1,025
    Undercover Operation        1   0,233      1,231     3,16   72,8%   0,896
    Investigation               1   0,280      1,013     3,30   69,7%   0,706
    Sting Operation             1   0,147      0,500     2,65   86,7%   0,434
    Stealth Retirement          1   0,090      0,140     2,07  100,0%   0,140
    Assassination               1   0,057     -0,717     1,65  100,0%  -0,717

Raid verbraucht **2,36 Ausdauer je Minute** - knapp unter der Regeneration von
2,3, gemessen am 26.08. um 12:21. Der Arbeitsanteil steigt damit von 44 auf
97 Prozent: **Raid braucht praktisch keine Kammerzeit.** Faktor 3,4 gegen die
gefahrene Aktion.

**Der HP-Schaden ist KEIN Blocker** (geklaert 13:15). `hospitalize()` setzt HP
auf max, zieht Geld ab und feuert `PlayerEventType.Hospitalized`
(`PlayerObjectGeneralMethods.ts:281-290`). Auf dieses Ereignis hoert im ganzen
Spiel **nur die Infiltration** (`Infiltration/Infiltration.ts:83`) - die
laufende Bladeburner-Aktion wird nicht abgebrochen. Ein Raid-Misserfolg kostet
also Geld, aber keine Zeit. Nebeneffekt: Nach der Heilung sind die
Trefferpunkte voll, die HP-Ruhe entfaellt bei Raid vollstaendig.

**Der Blocker ist das Guthaben.** Raids Schaden ist
`50 * difficultyMultiplier` = 50 * (800^0,28 + 800/650) = **397 Trefferpunkte**
je Misserfolg. Die Krankenhauskosten sind
`min(Geld * 0,1, (max - current) * 100.000)` (`Hospital.ts:4-10`), und weil
`current` auf -372 faellt, sind das 39,7 Millionen je Misserfolg - **unabhaengig
von den maximalen Trefferpunkten**, solange diese unter 397 liegen. Bei 0,93
Misserfolgen je Minute macht das **rund 37 Millionen je Minute**.

Dagegen steht das gemessene Einkommen: 6.667m um 12:16, 8.188m um 13:00, also
**34,6 Millionen je Minute**. Raid waere um rund 2,4 Millionen je Minute
defizitaer.

**Das ist weniger schlimm, als es klingt, und es ist selbstbegrenzend.** Bei
8 Milliarden Guthaben reicht der Puffer rechnerisch 55 Stunden, und in dieser
Zeit brachte Raid rund 12.500 Rang - das Fuenffache dessen, was die erste
Black Op verlangt. Faellt das Guthaben, greift der Deckel `Geld * 0,1`: Bei
100 Millionen kostet eine Heilung nur noch 10 Millionen. Das System pendelt
sich ein, statt zu kollabieren.

**Die Bilanz ist jetzt gemessen, nicht geschaetzt (13:48).** Die 34,6 Millionen
je Minute oben waren eine Guthabendifferenz - und die untertreibt das
Bruttoeinkommen nicht, sie UEBERTREIBT es hier: Das Fenster 12:16 bis 13:00
enthielt keine groesseren Ausgaben. Mit `src/geld.js` (neu) ueber
`ns.getMoneySources()` gemessen, vier Minuten am Stueck:

    hacking             +25,17 Mio/min
    bladeburner          +0,55
    hospitalization      -0,30      (der bestehende Hebel von 06:55)
    ---
    gesamt              +25,41 Mio/min

**Damit ist das Defizit groesser als angenommen: 11,3 statt 2,4 Millionen je
Minute.** Aber die Rechnung dahinter faellt trotzdem zugunsten von Raid aus:

- Bei 9,2 Milliarden Guthaben reicht der Puffer **13,6 Stunden**, und in
  dieser Zeit bringt Raid **rund 3.100 Rang** - von 645 auf 3.700, also weit
  ueber die 2.500 der ersten Black Op.
- Danach kollabiert nichts. Der Deckel `Geld * 0,1` greift und senkt die
  Kosten mit dem Guthaben. Das Gleichgewicht, wo Kosten und Einkommen sich
  treffen, liegt bei **rund 276 Millionen** - dort kostet eine Heilung 27,6
  Millionen, also genau die 25,7 Millionen je Minute, die hereinkommen.

**Die Abwaegung lautet also nicht "riskant oder nicht", sondern: 8,9
Milliarden Guthaben gegen Faktor 3,4 auf den Traeger.** Was das Geld in
BitNode 6 noch wert ist, haengt an den Augmentierungen - und die heben die
Kampfwerte und damit die Erfolgschancen, die ihrerseits Raid billiger machen.
Das ist ein Kreis, kein einfacher Tausch, und deshalb Erics Entscheidung.

**Zu tun - und das ist bewusst KEIN Nebenbei-Eingriff:**
1. ~~Klaeren, ob eine Hospitalisierung die Aktion abbricht.~~ **Erledigt
   13:15: nein.**
2. ~~Den Ausdauerverbrauch je Operation messen.~~ **Erledigt 13:22**, die
   Rechnung steht jetzt dauerhaft in `src/bbspann.js`.
2b. ~~Das Einkommen messen statt schaetzen.~~ **Erledigt 13:48** mit
   `src/geld.js`: 25,7 Millionen je Minute brutto, davon 25,17 aus Hacking.
3. Offen: Die Umstellung selbst. Sie ersetzt die feste Schwelle
   `SICHER_OPERATION = 0.85` (`src/blade.js:48`) durch dieselbe
   Ertragsrechnung, die blade.js fuer Vertraege schon fuehrt - erweitert um
   den Arbeitsanteil. **Vorschlag zur Stufung:** Raid nur fahren, solange das
   Guthaben ueber einer Grenze liegt (etwa 2 Milliarden), darunter zurueck auf
   Vertraege. Damit ist der Geldpuffer die Regelgroesse und nicht das Risiko.

**Warum es hier steht und nicht schon umgesetzt ist:** Der Umbau greift in den
Kern der Aktionsauswahl und tauscht Geld gegen Rang - eine Abwaegung, die die
Augmentierungen und den Serverkauf betrifft. Das gehoert vorgelegt, nicht
nebenbei entschieden.

**Dringlichkeit:** hoch. Faktor 3,4 auf den Traeger des Knotens ist der
groesste belegte Hebel, der derzeit offen liegt.



### Wartet bis zum naechsten Einbau: Das Guthaben war negativ, -1,58 Millionen (22:18)
Gemessen: `data/bn4net.json` meldet `geld -1576559.02`, der Strategiepruefer
zeigt "Geld -2m". Netz 13 von 70 gerootet, der Wiederaufbau nach dem Einbau
laeuft also noch.
Erwartet: Nie unter null. Ein negatives Guthaben blockiert in Bitburner jeden
weiteren Kauf - Portprogramme, Server, Augmentierungen -, und genau die
braucht der Wiederaufbau.
Ursache **gefunden 22:46**: Es trainierten ZWEI Skripte gleichzeitig im
Powerhouse Gym. Neben `bbtrain.js` (Ziel 100) lief `joinrun.js` (Ziel 80) mit
derselben Aufgabe und einer anderen Reihenfolge. joinrun prueft zwar, ob
bereits trainiert wird - aber nur auf GENAU die Uebung, die es selbst will.
Trainierte die Figur "agi" und joinrun wollte "str", startete es trotzdem,
bbtrain schaltete zurueck, und jeder Wechsel kostete Gym-Gebuehren.
Dazu passt der Stadtstreit: joinrun reist absichtlich nach Ishima (Zeile 87,
Stadtbedingung fuer Tetrads und Tian Di Hui), bn4life nach Aevum
(`bn4life.js:208`), bbtrain zurueck nach Sector-12 - jede Reise kostet 200.000.
Das erklaert den Befund von 21:47 und 22:43 gleich mit; beide Eintraege sind
hier aufgegangen.
**Geaendert 22:46 in `src/joinrun.js`, Wirkung noch nicht gemessen:** Laeuft
irgendein Kurs, laesst joinrun die Finger davon und wartet, bis die Werte da
sind. Nachzumessen beim naechsten Augmentierungs-Einbau - nur dann laufen
beide Skripte gleichzeitig. Zu pruefen ist dann: Bleibt das Guthaben ueber
null, und steigen die Kampfwerte ohne Ruckeln?
Offen bleibt die Frage, ob ein Training bei leerem Konto ueberhaupt starten
darf. Bladeburner-Training ist gratis (Bladeburner.ts:1091-1105) und hebt die
Kampfwerte ebenfalls - langsamer, aber ohne Schulden.

### Wartet bis Eric bn4net freigibt: Nach einem Einbau starten die Werkzeuge nicht nach (22:03)
Gemessen 22:01, kurz nach einem Einbau (Kampfwerte auf 1, Netz 13/70, Geld 1m):
`data/ps.json` fuehrt nur bn4net, bn4life, joinrun, popups und contracts.
**Es fehlen blade.js, bbtrain.js, wakelock.js, homegrow.js, bn4rep.js und
bn4door.js** - darunter der Motor des Knotens und der Tonanker.
Erwartet: bn4net startet fehlende Werkzeuge in seiner Runde selbst nach.
Es liegt NICHT am Platz: `data/werkbank.json` meldet um 22:03 auf home
1024 GB gesamt, **253,1 GB frei**, 339,7 nach Raeumung. blade braucht 47,75,
bbtrain 94,75, wakelock 34,25 - alle drei zusammen passen.
Verdacht: Die Nachstart-Logik in `src/bn4net.js` (die `fehlend`-Liste um
Zeile 2576). Sie hat in den zwanzig Minuten nach dem Einbau nichts gestartet.
Der Reload-Kanal hilft hier nicht: `WERKZEUG <name>` **killt nur** (bn4net.js
:532-545) und verlaesst sich aufs Nachstarten - laeuft das Werkzeug gar nicht,
trifft der Befehl ins Leere.
Eingriff 22:05: wakelock, bbtrain und blade einzeln ueber den Auftragskanal
gestartet (`["wakelock.js"]` in data/task.txt). Danach laufen alle drei.
Zu tun: Entweder die Nachstart-Logik reparieren (bn4net, braucht Erics
Freigabe) oder dem Reload-Kanal ein "starte, falls nicht laufend" geben.
Dies ist der vierte stille Fehlschlag des Wiederanlaufs an einem Tag.

**Nachtrag 23:16 - die Folge ist abgefangen, die Ursache nicht.**
`tools/wache.js` startet jetzt selbst nach. Der residente Waechter war bisher
reine Beobachtung; er meldet aufs Handy und konnte nichts tun. Genau das hat
heute vier Mal Stunden gekostet, und nachts haette es bis zum Morgen gedauert.

Geprueft werden die beiden Werkzeuge, deren Telemetrie ihr Lebenszeichen ist:
`blade.js` ueber `data/blade.json` (der Motor des Knotens - seit 22:16 schreibt
er in JEDEM Zweig) und `wakelock.js` ueber `data/wakelock.txt` (der Tonanker;
ohne ihn drosselt der Browser auf ein Timer-Aufwachen je Minute). Aelter als
zehn Minuten heisst: laeuft nicht mehr. Dann schickt der Waechter
`["<name>"]` in den Auftragskanal - vorher pruefend, ob der frei ist, denn er
hat genau einen Leser und gehoert sonst einem Loop. Hoechstens ein Versuch je
Werkzeug und Viertelstunde.

**Verifiziert 23:15:** `data/wakelock.txt` von Hand auf einen 15 Minuten alten
Zeitstempel gesetzt, danach `node tools/wache.js --einmal`. Ergebnis:
"Nachgestartet: wakelock.js (Telemetrie war 15 min alt)", und um 23:15:08
meldete das Werkzeug seinen Start. Der Folgelauf ist wieder still.

Nicht geprueft wird `bbtrain.js` - es schreibt nur bei Ereignissen, ein Alter
sagt dort nichts. Und die URSACHE bleibt offen: Warum bn4net nach einem Einbau
zwanzig Minuten lang nichts nachstartet, obwohl Platz da ist, steht weiter
oben und braucht Erics Freigabe fuer eine Aenderung am Motor.

**Nachtrag 22:16 - der Reload-Kanal ist derzeit eine Falle.** Ein
`WERKZEUG blade.js` um 22:15 hat blade.js beendet, und nichts hat es
zurueckgeholt: Um 22:16 fehlte es in `data/ps.json`. Wer den Kanal benutzt,
legt das Werkzeug also still, statt es neu zu starten. Bis das behoben ist,
gilt: **Werkzeuge ueber den Auftragskanal starten** (`["blade.js"]` in
data/task.txt), nicht ueber den Reload-Kanal. Das gehoert auch in die
Loop-Prompts, die den Reload-Kanal bisher als Standardweg nennen.

### Wartet bis zum naechsten Einbau: Erkennt der Pruefer ihn jetzt? (22:01)
Gemessen: URTEIL SPUR bei Kampfwerten 1/1/1/1, Netz 13/70 und 1m Guthaben -
alles Zeichen eines frischen Einbaus.
Erwartet: RESET. Danach gehoert der Wiederanlauf geprueft, und genau der ist
diesmal wieder stillgeschwiegen gescheitert (siehe Punkt darueber).
Verdacht: `tools/strategie-check.js` erkennt RESET am Rueckgang des TRAEGERS.
In BitNode 6 ist der Traeger der Bladeburner-Rang - und der ueberlebt einen
Augmentierungs-Einbau, er faellt nur beim BitNode-Wechsel. Der Einbau ist
deshalb fuer diesen Pruefer unsichtbar.
**Geaendert 23:47, Wirkung noch nicht gemessen:** Der Pruefer meldet RESET,
wenn die Phase von etwas anderem auf "Wiederaufbau nach Einbau" wechselt. Das
tritt genau einmal je Einbau auf, und danach betritt die Wache ihren
RESET-Zweig und prueft den Wiederanlauf - genau das, was um 22:01 gefehlt hat.

Eine Falle steckte im ersten Entwurf: Als Vergleich diente `frueher`, und das
ist nach TRAEGER gefiltert. Nach einem Einbau enthaelt die Liste nur Punkte
aus der VORIGEN Wiederaufbauphase, deren Phase dieselbe ist - der Wechsel
waere unsichtbar geblieben. Verglichen wird jetzt mit dem letzten Messpunkt
des Knotens, unabhaengig vom Traeger.

Nachzumessen beim naechsten Augmentierungs-Einbau: Kommt genau ein
`URTEIL: RESET`, und bleibt es danach bei SPUR? Ein Versuch, den Fall mit
praeparierten Kampfwerten in `data/bblage.json` herbeizufuehren, ist
gescheitert - `frischerSteckbrief()` erneuert die Datei selbst, sobald sie alt
wirkt, und ueberschreibt die Praeparation.

---

## Offen, nach Dringlichkeit

### Charisma ist ein unbedienter Hebel auf die Raid-Zyklusrate

Aus der Chaos-Rechnung im Sofort-Punkt folgt: Der Raid-Anteil im Gleichgewicht
ist `D / (D + 3,21)` mit `D = charisma^0,045 + charisma/1000`. Von Charisma
1.200 auf 5.000 steigt die effektive Zyklusrate von 1,69 auf 2,53 - **plus 50
Prozent auf den Traeger des Knotens**, allein aus einem Wert, den bisher kein
Werkzeug ansteuert.

Charisma waechst nicht durch Bladeburner-Arbeit: Diplomacy hat keine
Erfahrungsfelder (`data/GeneralActions.ts:37-44`), und die Kampfaktionen geben
nur Kampferfahrung. Es kaeme aus Uni-Kursen (Leadership), Firmenarbeit oder
Verbrechen.

**Zu messen, bevor irgendetwas gebaut wird:** Was kostet Charisma 1.200 -> 5.000
an Zeit und Geld, gegen die 50 Prozent Zyklusrate, die es bringt? Die
Uni-Kurse ignorieren die Fokus-Strafe vollstaendig (`Work/ClassWork.tsx` kennt
`focusPenalty` nicht), kosten aber Geld und pruefen den Kontostand nicht.
Gegenrechnung: Dieselbe Zeit in Kampfwert-Training gesteckt hebt die
Erfolgschance und damit `netto/min` direkt.

Gefunden 26.08.2026, 16:50, beim Einbau der Charisma-Schwelle.

### Der Kammeranteil steht bei 52 Prozent - und die Rechnung erklaert nur zwei Drittel davon

**Der alte Titel ("drei Viertel") ist ueberholt.** Gemessen 26.08. um 14:44
ueber `data/aktionen.txt`, gestaffelt nach den Hebeln des Tages:

    gesamter Verlauf      682,7 min   0,699 Rang/min   Kammer 60,5 %
    ab 10:00              238,4 min   0,789            Kammer 52,7 %
    ab 12:21 (Cyber's E.) 122,2 min   0,842            Kammer 51,3 %
    ab 13:33 (CE Stufe 5)  69,7 min   0,841            Kammer 52,6 %

Von 72,5 Prozent (06:47) auf 52 - der Krankenhaus-Hebel und Cyber's Edge
zusammen. **Die Ruhe ist inzwischen zu 100 Prozent Ausdauer-Ruhe**; kein
einziger HP-Grund mehr in 69,7 Minuten. Ansatz 1 des alten Eintrags (mehr
Trefferpunkte) ist damit endgueltig erledigt.

**Was jetzt offen ist: Die gerechnete Rate liegt ein Drittel ueber der
gemessenen.**

    gerechnet (bbspann, Tracking)   2,513 Rang je Arbeitsminute
    gemessen  (Aktionsmix)          1,77

Der Mix erklaert die Luecke nicht - nachgerechnet stimmt er auf drei
Nachkommastellen: 52,6 % Kammer, und die Arbeitsphase bringt
(17,4*2,086 + 9,3*1,896 + 6,4*0,739) / 33,1 = 1,77, mal 0,474 = **0,839**
gegen gemessene 0,841.

**Ein Teil ist gefunden: verworfener Aktionsfortschritt.** Jeder Wechsel setzt
`actionTimeCurrent` auf 0 (`Bladeburner.ts:187`), der angefangene Durchlauf ist
weg. Gemessen ueber die Abschnittsdauern modulo Aktionsdauer, seit 13:33:

    Contracts/Tracking        31 Abschnitte    35 s verworfen   ( 6 %)
    Contracts/Retirement      22 Abschnitte   183 s            (18 %)
    Contracts/Bounty Hunter    8 Abschnitte    58 s            (15 %)
    ---
    gesamt                                    276 s von 1.983 s = 13,9 %

Davon entfallen **160 Sekunden auf 43 Wechsel Arbeit->Arbeit** - der Motor
springt zwischen Vertraegen hin und her, weil `waehle()` bei jedem Durchlauf
neu entscheidet und die Erfolgsschaetzungen schwanken. Die restlichen 114
Sekunden sind 17 Wechsel Arbeit->Kammer, die man nicht aufschieben darf: Die
Ruheschwelle liegt bei 51 Prozent, die Strafgrenze bei 50
(`Bladeburner.ts:167-169`), da ist kein Puffer fuer 22 Sekunden Aufschub.

**Warum daraus KEIN Acht-Prozent-Hebel folgt - und das ist der Punkt:**
Ein abgebrochener Durchlauf kostet **keine Ausdauer**. Der Abzug passiert erst
beim Abschluss (`Bladeburner.ts:921`, innerhalb von `completeAction`). Wer die
Abbrueche vermeidet, bekommt also mehr vollstaendige Aktionen je Arbeitsminute
- und damit mehr Verbrauch je Minute, also mehr Kammerzeit. Solange die
Ausdauer der Engpass ist, hebt sich das weitgehend auf.

Es hebt sich nur **weitgehend** auf, nicht vollstaendig: Waehrend der Arbeit
regeneriert die Ausdauer passiv mit rund 1,2 je Minute, in der Kammer mit 2,31
(gemessen 14:20). Verworfene Arbeitszeit ist deshalb schlechter als Kammerzeit
- aber der Gewinn liegt bei wenigen Prozent, nicht bei acht.

**Zu tun:**
1. Den Restfaktor klaeren. Nach Abzug der 13,9 Prozent bleiben 2,06 gegen 2,51
   gerechnet - rund 20 Prozent unerklaert. Verdaechtig ist
   `getActionEstimatedSuccessChance`: Die Zahl ist eine SCHAETZUNG auf Basis
   der geschaetzten Population, und `bbspann` nimmt die untere Grenze. Liegt
   auch die noch ueber der Wahrheit, sind alle Ertragsrechnungen zu optimistisch
   - **einschliesslich der Raid-Bilanz.** Das ist der Grund, warum dieser Punkt
   nicht kosmetisch ist.
2. Erst danach ueber das Aufschieben von Arbeit->Arbeit-Wechseln entscheiden,
   und dann mit einer Erwartung in Prozent, die diese Rechnung beruecksichtigt.

**Dringlichkeit:** mittel. Der Kammeranteil selbst ist kein Notfall mehr; die
Frage nach der Verlaesslichkeit der Ertragsrechnung schon, weil an ihr die
Raid-Entscheidung haengt.


### Die Erwartungswerte des Pruefers sind geschaetzt, nicht gemessen

Zweimal an einem Nachmittag hat `sollRate()` in `tools/strategie-check.js` einen
Fehlalarm erzeugt, beide Male aus derselben Wurzel: Die Zahlen stammen aus einer
Ueberschlagsrechnung am Spielquellcode, nicht aus dem eigenen Messverlauf.
- 17:00: eine feste Rate von 29 je Minute, aus einem Zwei-Stunden-Ziel geteilt
- 18:21: Bruttoertraege ohne die Erfolgswahrscheinlichkeit

Beide Male wurde die Formel nachgebessert. Beide Male blieb sie eine Schaetzung.

`data/verlauf-strategie.json` enthaelt inzwischen zu jedem Messpunkt Zeit, Wert,
Aktion und Urteil - damit liesse sich die tatsaechliche Rate je Aktionsart aus
dem eigenen Lauf ableiten, statt sie zu raten. Ein gleitender Median ueber die
letzten Stunden je Aktion waere selbstkalibrierend und ginge nicht mehr daneben,
wenn sich Aktionslevel oder Faehigkeiten aendern.

**Stand 26.08., 02:15: Der geplante Umbau ist widerlegt, bevor er begann.**
`tools/ratencheck.js` (neu) rechnet die tatsaechlichen Raten je Aktion aus dem
Verlauf. Ergebnis ueber 73 Messpunkte:

    Aktion                                  n   median      max   Null%
    General/Hyperbolic Regeneration Chamber 16    0.072    1.032      50
    Contracts/Retirement                     6    0.000    0.308      67
    General/Training                         2    0.151    0.200       0

Contracts/Retirement zeigt einen Median von **null** - waehrend der Rang im
selben Zeitraum nachweislich um rund 0,5 je Minute gestiegen ist. Die Zahlen
sind also nicht die Wahrheit, gegen die man die Formel haelt, sondern selbst
ein Artefakt.

Der Grund ist die Aufloesung: Ein Verlaufspunkt traegt die Aktion, die im
MOMENT der Messung lief; der Zuwachs davor stammt aus zwanzig Minuten, in
denen der Motor mehrfach gewechselt hat. Die Rate landet bei der Aktion, die
zufaellig zum Messpunkt lief - und das ist zur Haelfte die Kammer, die
naturgemaess null bringt.

**Zu tun, in dieser Reihenfolge:**
1. ~~`blade.js` protokolliert bei JEDEM Aktionswechsel Rang und Zeit.~~
   **Erledigt 26.08., 03:01.** Beim Wechsel wird der abgeschlossene Abschnitt
   nach `data/aktionen.txt` geschrieben: von, bis, Aktion, Grund, Rang davor
   und danach - mit dem UNGERUNDETEN Rang, anders als im Messverlauf.
   Abschnitte unter zehn Sekunden gelten als Umschaltzucken und entfallen.
   *Verifiziert 03:01:*

       Contracts/Tracking        42 s   Rang 221,855 -> 222,530   (0,96/min)
       Contracts/Bounty Hunter   22 s   Rang 222,530 -> 222,530   (Misserfolg)

   Die Endung ist `.txt`, nicht `.jsonl`: Bitburner laesst nur wenige
   Dateiendungen zu und weist alles andere mit "Invalid file extension" ab.
2. ~~`tools/ratencheck.js` gegen diese Datei laufen lassen.~~
   **Erledigt 26.08., 05:47.** Das Werkzeug holt die Datei ueber die Bruecke
   und rechnet gewichtet (Summe Rang durch Summe Zeit), nicht als Median
   einzelner Abschnitte. Die Erfolgsquote faellt dabei gratis ab: Der Anteil
   der Abschnitte mit Rangzuwachs ist die GEZAEHLTE Erfolgswahrscheinlichkeit.
   Ergebnis ueber 84 Abschnitte (164 Minuten):

       Aktion                                    n     min  Rang/min  Erfolg
       Contracts/Tracking                       31    19,9     1,994     84%
       Contracts/Retirement                      2     1,3     1,547     50%
       Contracts/Bounty Hunter                  28    21,2     1,469     64%
       General/Hyperbolic Regeneration Chamber  23   122,0     0,000      0%

3. **Die Formel liegt um Faktor 5 bis 6 daneben - und der Grund ist gefunden.**
   Der Pruefer rechnet `rankGain * Chance / Dauer`, fuer Tracking also
   0,3 * 0,73 / 0,63 min = **0,35** je Minute. Gemessen sind es **1,994**.
   Es fehlt der Levelfaktor: `Bladeburner.ts:917` multipliziert den Ertrag mit
   `Math.pow(action.rewardFac, action.level - 1)`, und `rewardFac` ist
   standardmaessig 1,02 (`Actions/LevelableAction.ts:20`). Tracking stand am
   25.08. auf Stufe 14 - allein das erklaert einen Teil; die Faehigkeiten
   (Blade's Intuition, Overclock) kommen dazu.
   **Geaendert 26.08., 06:16, Wirkung noch nicht gemessen:**
   `blade.js` schreibt die Stufe der laufenden Aktion nach `data/blade.json`
   (`getActionCurrentLevel`, nur fuer Contracts und Operations - General-
   Aktionen haben keine). `sollRate()` multipliziert die Erwartung mit
   `rewardFac^(stufe-1)`; die Faktoren stehen je Aktion im Quellcode
   (Contracts.ts:18, 52, 85 - Tracking 1,041, Bounty Hunter 1,085,
   Retirement 1,065; Operations.ts:18, 52, 88, 123, 163, 201).
   Nachzumessen ist das erst, wenn der Motor wieder an einem Vertrag steht -
   bei der Messung um 06:16 ruhte er (`stufe: null`, Kammer).

   **Der Restfaktor ist erklaert (26.08., 06:45) - er war ein
   Auswertungsfehler, kein Spielgeheimnis.**
   Gemessen mit echtem Wert: `Contracts/Tracking`, **Stufe 24** (nicht 14),
   Chance 0,737. Damit rechnet die Formel
   0,3 * 1,041^23 = 0,756 Rang je Erfolg, mal 0,737 durch die AKTIONSdauer
   von 13 Sekunden = **2,57 Rang je Minute**. Gemessen sind 1,984 - eine
   Abweichung von 1,3, die durch Rangverluste bei Misserfolgen, die
   Zufallsstreuung (`addOffset(gain, 10)`) und die veraltete Dauermessung
   vollstaendig gedeckt ist.

   Der scheinbare Faktor 3,4 entstand, weil in der Rechnung die
   ABSCHNITTSdauer (36 s) statt der Aktionsdauer (13 s) stand. Ein Abschnitt
   laeuft, bis blade.js die Aktion wechselt, und enthaelt in der Regel
   mehrere Durchlaeufe - die "Erfolgsquote" in `ratencheck.js` ist deshalb der
   Anteil der Abschnitte mit Zuwachs, nicht die Erfolgschance je Versuch.
   Beides steht jetzt als Warnung im Werkzeug und in seiner Ausgabe.

4. **Der eigentliche Engpass steht daneben und ist groesser als alles andere:**
   Der Motor verbringt **122 von 164 Minuten - 74 Prozent - in der
   Regenerationskammer**. Die Arbeitszeit bringt 1,5 bis 2 Rang je Minute,
   ueber alles sind es 0,443. Faellt die Kammerzeit von 74 auf 30 Prozent,
   verdreifacht sich die Rate. Das gehoert in den Optimierungs-Loop, nicht
   hierher - siehe nodes/HEBEL.md.

Bis dahin bleibt die Formel die bessere Schaetzung: Sie ist wenigstens nicht
durch die Messmethode verfaelscht.

**Dringlichkeit:** mittel. Ein Fehlalarm ist teurer als er aussieht - er schickt
die Wache in ihre Diagnosebranche und stumpft ihre Meldungen ab.


### blade.js hat kein Gegenmittel gegen leere Vertragsvorraete

Zweimal an einem Nachmittag ist der Motor in "General/Training" gelandet, beide
Male mit demselben Muster: keine Aktion ueber der Schwelle, also Rueckfall auf
etwas, das keinen Rang bringt. Um 17:00 war die Schwelle zu hoch (0,80), um
18:12 war der Vorrat leer (Tracking offen 0,4 bei Stufe 10). Beide Male wurde
die Schwelle gesenkt - das ist Symptombehandlung.

Die Ursache liegt tiefer: Vertraege und Operationen haben endliche Zahlen und
wachsen nur langsam nach (Bladeburner.ts:1387-1390), waehrend Chaos mit jedem
Einsatz steigt und passiv fast nicht faellt (0,0001/s, Bladeburner.ts:1397).
Das Spiel hat dafuer zwei Werkzeuge, die `blade.js` nicht kennt:
- **Incite Violence** fuellt die Vorraete sprunghaft auf (Bladeburner.ts:1221-1224)
- **Diplomacy** senkt das Chaos (Bladeburner.ts:1185-1195)

Ohne beide bleibt jede Schwellensenkung ein Aufschub: Irgendwann ist auch der
letzte Vertrag leer, und dann faellt der Motor wieder in Training. Zu tun: beide
Aktionen in die Auswahl aufnehmen - Incite Violence, wenn die Summe der offenen
Vertragszahlen unter einen Schwellwert faellt, Diplomacy, wenn das Chaos der
Arbeitsstadt eine Grenze ueberschreitet.

**Dringlichkeit:** hoch. Es ist die Ursache hinter zwei bereits behobenen
Symptomen, und sie tritt garantiert wieder auf.


### 1. Der V2-Kontrollpunkt ist nie gemessen worden

`nodes/ROUTE.md` Abschnitt 4 erklaert ihn fuer bindend: **Rang nach zwei Stunden
in BitNode 6 mindestens 6.000 mit Raid, mindestens 3.500 ohne.** Die gesamte
Reihenfolge ab Platz 3 steht auf einer Simulation, die nie gegen einen echten
Lauf geprueft wurde.

**Der Beitritt steht seit dem 25.08.2026 zwischen 16:20 und 16:29** (um 16:19:55
war der Kampfwert-Tiefstand noch 98, um 16:29:23 meldete `bblage.json`
`inBladeburner: true` bei Rang 0). Genauer laesst er sich nicht mehr eingrenzen:
bbtrain schrieb `data/bbjoin.txt` lokal auf die Werkbank statt nach home - das
ist inzwischen behoben, half aber fuer diesen Beitritt nicht mehr.

**Der Kontrollpunkt faellt damit auf 18:30 Uhr.** Zu messen ist dann der Rang
aus `data/blade.json` gegen die Schwelle aus ROUTE.md: mindestens 6.000 mit
Raid, mindestens 3.500 ohne. Das Ergebnis gehoert nach ROUTE.md.

Zwischenstand 16:29: Rang 0, Ausdauer 41/41, Aktion "Field Analysis" (die
Erfolgsschaetzungen sind noch zu unscharf fuer einen Vertrag), naechste Black Op
"Operation Typhoon" ab Rang 2.500.

**Dringlichkeit:** hoch. Es ist das wertvollste Einzelergebnis der naechsten
Tage - an ihm haengt die gesamte Reihenfolge ab Platz 3.

### 2. Der Erfahrungsofen (Befund B1 aus dem Bot-Audit)

Der Umbau wurde am 25.08. per `git checkout` zurueckgenommen, weil die
Skeptiker-Runde vier Konstruktionsfehler fand: Das "Ventil" mass Fragmentierung
statt Bedarf, hebelte die Kaufbremse aus, vertrat den Stapelbetrieb gar nicht
und hatte eine katastrophale Kill-Granularitaet.

`src/worker/expfarm.js` liegt fertig und unverdrahtet im Baum (1,75 GB je Faden
statt 1,80 beim Einwegarbeiter). Was fehlt, ist die Zuteilung:
- Ofenbudget aus den Bedarfen DERSELBEN Runde ableiten, nicht aus der vorigen
- Raeumen nach dem share-Muster (bn4net.js:1565)
- Lease im Arbeiter gegen Waisen
- `ramJeSkript` um `worker/expfarm.js` ergaenzen
- danach den Einweg-Pfad (bn4net.js ~1596-1622) streichen

**Dringlichkeit:** niedrig in BitNode 6 - der Ofen beschleunigt den
Hacking-Weg, und der traegt diesen Knoten nicht. Vor dem naechsten V1-Knoten
wieder hochstufen.

### 3. Boersen-Bot fuer BitNode 8

BitNode 8 steht ganz am Ende der Route (Platz 42-44) und ist der einzige Knoten
ohne Bladeburner, Gang, Corporation und Skript-Hackgeld. Reputation ist dort
eine reine Geldfrage - und Geld kommt nur aus dem Aktienmarkt. Den Bot gibt es
noch nicht.

**Dringlichkeit:** niedrig, aber nicht null: Er ist die einzige Voraussetzung
auf der ganzen Route, die noch gar nicht existiert.

### 4. Darknet-Labyrinth-Gewerk (V1b)

`labyrinth.ts:424-427` legt The Red Pill ins sechste Darknet-Labor, aber nur bei
`hasFullDarknetAccess()` - also in BitNode 15 oder mit SF15. Jeder
Augmentierungs-Einbau wuerfelt das Darknet neu (Prestige.ts:76), es braucht also
je Labor einen Einbauzyklus und rund 24 Raetselloeser.

**Dringlichkeit:** niedrig. Erst vor BitNode 15 relevant.

---

## Erledigt

### Der Stadtwechsel-Hebel ist geprueft und verworfen (26.08., 15:55)

Eingetragen um 15:28 mit **hoher** Dringlichkeit und der Zahl "Faktor 2,35".
Gemessen 27 Minuten spaeter: **Der Hebel existiert praktisch nicht.**

Um die Staedte ueberhaupt vergleichen zu koennen, misst `src/bbspann.js` jetzt
alle sechs durch. Das geht, weil `switchCity` nur `bladeburner.city` setzt
(`NetscriptFunctions/Bladeburner.ts:314-319`) und Netscript zwischen zwei
`await` synchron laeuft: Die Schleife enthaelt keines, der Rundgang ist damit
atomar, und am Ende steht die Division wieder in ihrer Stadt.

    Stadt        Chaos  Guete   Tracking   Raid     Operation Typhoon
    Chongqing    27,36  1,415   0,7712     0,1148   0,0331
    Volhaven     43,29  1,375   0,8539     0,1271   0,0349
    New Tokyo    25,91  1,348   0,8368     0,1245   0,0349
    Sector-12    46,91  1,331   0,8265     0,1230   0,0349   <- Arbeitsstadt
    Ishima       39,61  0,863   0,5359     0,0798   0,0349
    Aevum        37,38  0,816   0,5068     0,0754   0,0349

**Drei Befunde, jeder fuer sich das Gegenteil der Erwartung:**

1. **Die Black Op ist in allen Staedten gleich** (0,0349, Chongqing 0,0331).
   Fuer die Aktion, an der der Ausgang des Knotens haengt, ist die Stadtwahl
   ohne Wirkung.
2. **Bei Raid liegt Volhaven 3 Prozent vor Sector-12**, Chongqing sogar
   darunter. Kein Hebel, sondern Rauschen.
3. **Die Guete-Formel ist widerlegt.** Chongqing hat die hoechste Guete
   (1,415) und die niedrigste Tracking-Chance der vier guten Staedte. Der
   Grund ist `popEst` gegen `pop`: Die Formel rechnet mit der Schaetzung, die
   Chance mit der Wahrheit. Die Zahl bleibt in `bbspann.json` stehen, aber mit
   einer Warnung im Code - **wer die Stadt waehlt, waehlt nach `proben`.**

**Warum der Faktor 2,35 trotzdem richtig gemessen war:** Er galt um 14:49, als
Sector-12 bei Chaos 53,89 stand. Diplomacy hat das seit 15:26 auf 46,9
gedrueckt, und damit ist der Faktor `sqrt(1 + chaos - 50)` auf exakt 1
zurueckgefallen. **Der Stadtwechsel waere ein Ausweichen vor einem Problem
gewesen, das inzwischen an der Wurzel behoben ist.**

Die Befuerchtung aus dem Auftrag - in einer fremden Stadt sei die Schaetzung
so unscharf, dass der Motor in Field Analysis landet - ist ebenfalls
widerlegt: Die Tracking-Spannen liegen in den vier guten Staedten zwischen
0,107 und 0,174, Chongqing hat sogar die schmalste.

**Was bleibt:** Die Messung selbst. Sollte das Chaos einer Stadt je wieder
davonlaufen, waehrend Diplomacy nicht hinterherkommt, steht die Grundlage fuer
einen Wechsel jetzt in `data/bbspann.json` - je Stadt, je Aktion, mit Spanne.


### Chaos ueber 50 halbierte alle Erfolgschancen - Diplomacy fehlte (26.08., 15:26)

Gemessen 14:49: Sector-12 stand bei Chaos **53,89**, und die Erfolgschancen
waren gegenueber 13:22 auf die Haelfte gefallen - Tracking 0,778 auf 0,357,
Retirement 0,468 auf 0,219, Bounty Hunter 0,388 auf 0,182. Die Rangrate fiel
von 0,841 auf 0,625 je Minute.

Ursache am Quellcode belegt: `Actions/Action.ts:94-101`. Ueber
`ChaosThreshold` (50) wird die SCHWIERIGKEIT mit `sqrt(1 + (chaos - 50))`
multipliziert, hier `sqrt(4,89) = 2,21`. Der gemessene Faktor war 2,18. Unter
50 ist der Faktor exakt 1 - der Schaden setzt schlagartig ein und verschwindet
ebenso schlagartig.

**Das war eine Vorhersage, kein Rueckschluss.** Der Faktor 2,21 stand in
`nodes/BAUSTELLEN.md`, bevor die Gegenmassnahme lief; die Messung danach hat
ihn bestaetigt.

Behoben in `src/blade.js`: Steigt das Chaos der Arbeitsstadt ueber 50, faehrt
der Motor `Diplomacy`, bis es unter 47 liegt. Die Pruefung steht **vor** der
Aktionswahl - der Wert, den `beste()` vergleicht, ist bei hohem Chaos bereits
verdorben, wer erst waehlt und dann aufraeumt, waehlt auf Basis halbierter
Zahlen.

Diplomacy senkt das Chaos prozentual um `charisma^0,045 + charisma/1000`
(`Bladeburner.ts:735-743`), dauert 60 Sekunden und kostet **keine Ausdauer**
(`data/GeneralActions.ts:37-44`). Die Hysterese ist knapp (ein ab 50, aus bei
47), weil die Senkung prozentual und damit langsam ist - von 50 auf 40 waeren
es siebzehn Durchlaeufe.

**Verifiziert 15:26, durchgehend beobachtet:**

    15:16:23   Chaos 53,8   General/Diplomacy startet
    15:21:14   Chaos 50,0
    15:25:47   Chaos 47,3
    15:26:07   Contracts/Tracking, **chance 0,801**

Zehn Minuten Diplomacy, danach **Tracking-Chance 0,801 gegen 0,357** - Faktor
2,24 gegen den vorhergesagten 2,21. Gemessene Senkung rund 0,76 Chaospunkte je
Durchlauf, also 1,4 Prozent.

Damit ist zugleich der Diplomacy-Teil des Offen-Punkts "blade.js hat kein
Gegenmittel gegen leere Vertragsvorraete" erledigt. Dort stand er als
nachrangig, weil "Chaos unter 50 nutzlos" ist - genau diese Bedingung war
gekippt, und niemand hat den Eintrag daraufhin noch einmal angesehen. Die
Lehre steht als eigener Punkt nicht da, gehoert aber hierher: **Eine
Verwerfung mit Bedingung muss die Bedingung mitpruefen.**


### Die Zyklusrate rechnete mit einer festen Regeneration (26.08., 14:20)

`src/bbspann.js` teilte durch R = 2,3 - eine feste Zahl aus der Messung vom
12:21. Genau die veraltet: Cyber's Edge hebt `getSkillMult(Stamina)`, und der
steckt in `calculateStaminaGainPerSecond` (`Bladeburner.ts:1317-1325`).
Gemessen ueber die Kammerphasen in `data/aktionen.txt`:

    vor 12:21, Cyber's Edge Stufe 0   R = 2,068   (53 Phasen, 108 min)
    ab  13:33, Cyber's Edge Stufe 5   R = 2,313   (11 Phasen,  23 min)

Das sind **11,8 Prozent mehr Regeneration** - fuenf Stufen zu je zwei Prozent
plus das Wachstum der Agility. Damit ist der Cyber's-Edge-Hebel von 12:22 zum
zweiten Mal belegt, diesmal an der Groesse, auf die er wirkt.

Ein fester Wert haette die Zyklusrate ab jetzt systematisch zu niedrig
gerechnet, und zwar **zugunsten der langen Aktionen** - also in die Richtung,
in die die Auswertung ohnehin schon zeigt. Das ist der gefaehrliche Fall: ein
Messfehler, der die eigene These stuetzt.

Behoben: `bbspann.js` liest die juengsten Kammerphasen aus `data/aktionen.txt`
und leitet R daraus ab. Die Kammer ist die einzige Aktion, in der die Ausdauer
nur steigt, also ist die Differenz je Minute genau R. Rueckwaerts gelesen, bis
20 Minuten zusammen sind, Phasen unter 30 Sekunden verworfen (die gemeldete
Ausdauer ist gerundet, bei kurzen Phasen ist der Rundungsfehler groesser als
das Signal). Die Datei fuehrt `regeneration` und `regenerationQuelle` mit.

**Verifiziert 14:20:** `R = 2.312 (gemessen ueber 10 Kammerphasen, 20.6 min)` -
deckt sich mit der unabhaengigen Rechnung ausserhalb des Spiels (2,313).


### Der Faehigkeitsplan hatte den zweiten Platz falsch besetzt (26.08., 13:18)

**Der Eintrag von 12:22 hatte die Praemisse verkehrt herum, gemessen 12:47.**
Dort stand die Sorge, `Blade's Intuition` mit Deckel `Infinity` koenne Punkte
lautlos verschlingen, sobald seine Erfolgschance bei 1,0 klemmt. Gemessen ist
das Gegenteil: **Operation Typhoon, die naechste Black Op, steht bei einer
Erfolgschance von 0,025.** Die Chancen-Faehigkeiten wirken laut
`Actions/Action.ts:184-187` auch auf Black Ops - Blade's Intuition ist also
von "ausgereizt" so weit entfernt wie moeglich, und `Infinity` ist dort richtig.

Dafuer stand ein echter Fehler daneben: **Overclock auf Stufe 14, Blade's
Intuition auf Stufe 0.** Die vierzehn Stufen haben kumulativ rund 169 Punkte
gekostet (`Summe(3 + 1,4*i)`, i = 0..13), in eine Faehigkeit, deren Wirkung im
Ausdauer-Engpass mit 0,4444 gegen 0,4445 beziffert ist. Auf Platz 2 haette
Overclock sich das sofort zurueckgeholt, sobald Cyber's Edge am Deckel steht -
naechste Stufe 23 Punkte gegen 3 Punkte fuer Blade's Intuition Stufe 1.

**Geaendert 12:48 in `src/blade.js`, Wirkung noch nicht gemessen:** Overclock
steht jetzt als letzter Eintrag im `SKILL_PLAN`, die Chancen-Faehigkeiten
davor. Der Deckel 90 bleibt - faellt der Ausdauerengpass je weg, ist die
Faehigkeit wieder etwas wert.

**Verifiziert 13:18: Blade's Intuition Stufe 1 um 13:18.** Cyber's Edge steht
auf Stufe 5 (Deckel), Hoechstausdauer 78. Der erste Kauf nach dem Deckel war
Blade's Intuition, **nicht** Overclock (das unveraendert auf Stufe 14 steht,
naechste Stufe 23 Punkte). Damit ist die Umsortierung wirksam und der Punkt
kann nach Erledigt.

**Urspruenglich nachzumessen, sobald Cyber's Edge Stufe 5 erreicht** (Deckel; naechste Stufe
kostet 13 Punkte, um 12:54 lagen 10 bereit): Der naechste Kauf muss
**Blade's Intuition Stufe 1** sein, nicht Overclock Stufe 15. Beobachtbar ist
das erst dann - solange Cyber's Edge unter seinem Deckel steht, bleibt der Plan
ohnehin dort stehen, und die Umsortierung dahinter ist von aussen unsichtbar.

Die Sicherung, die im Eintrag von 12:22 gefordert wurde - beim Sparziel
pruefen, ob die Faehigkeit ueberhaupt noch etwas bewegt - ist **bewusst nicht
gebaut worden.** Sie wuerde bei den heutigen Zahlen nie ausloesen und liesse
sich deshalb auch nicht pruefen; ungetesteter Code, der nie laeuft, ist eine
Last und keine Absicherung. Wieder aufnehmen, wenn eine Chance tatsaechlich
1,0 erreicht.



### Der Faehigkeitsplan kaufte Overclock, das im Ausdauer-Engpass nichts bringt (26.08., 12:22)

Gemessen 11:45: 14 Faehigkeitspunkte lagen da, `Overclock` stand auf Platz 1 des
`SKILL_PLAN` und `Cyber's Edge` stand ueberhaupt nicht darin - die urspruengliche
Notiz sprach von "Platz 10", tatsaechlich hatte der Plan nur acht Eintraege.

**Die Verwerfung von Overclock ist schaerfer ausgefallen als der Befund
annahm.** Dort stand "rund 1 Prozent". Nachgerechnet am Quellcode ist es
naeher an null: Der Ausdauerverlust faellt **je Aktion** an, nicht je Zeit
(`Bladeburner.ts:921`, `BaseStaminaLoss * difficultyMultiplier`). Eine um ein
Prozent kuerzere Aktion heisst also ein Prozent mehr Durchlaeufe je Minute UND
ein Prozent mehr Verbrauch je Minute - der Ausdauerengpass zieht den Gewinn
sofort wieder ein. Mit V = 2,7 und R = 1,2 je Minute:

    ohne Overclock   Arbeit S/1,5000   Ruhe S/1,2   Rate 0,4444 * g/T
    mit  Overclock   Arbeit S/1,5273   Ruhe S/1,2   Rate 0,4445 * g/T

Overclock ist damit nicht "schwaecher als Cyber's Edge", sondern in diesem
Regime wirkungslos. Es zahlt sich erst aus, wenn die Ausdauer nicht mehr klemmt.

Geaendert in `src/blade.js`: `Cyber's Edge` auf Platz 1 mit **Deckel 5**,
Overclock auf Platz 2 mit unveraendertem Deckel 90. Der Deckel ist Absicht -
die Kosten sind `1 + 3 * Stufe` und damit kumulativ quadratisch (5 Stufen = 35
Punkte, 8 Stufen = 92), der Nutzen linear.

Bestaetigt am Quellcode, weil die Wirkung an genau einer Stelle haengt:
`getSkillMult(Stamina)` steckt in **beiden** Formeln - `calculateMaxStamina`
(`Bladeburner.ts:1327-1343`) und `calculateStaminaGainPerSecond`
(`:1317-1325`). Die Ruhezeit S/R bleibt deshalb gleich, die Arbeitszeit
S/(V-R) waechst ueberproportional.

**Verifiziert 12:21, drei Messungen:**
- **Hoechstausdauer 70 -> 74** (+5,7 Prozent). Drei Stufen zu je 2 Prozent
  ergeben 6 Prozent - das ist die Wirkung selbst, nicht ihre Ankuendigung.
- **Punkte 21 -> 9**, also 12 ausgegeben: genau `1 + 4 + 7` fuer die Stufen 1
  bis 3. Die vierte kostet 10 und wird angespart.
- **Regeneration in der Kammer 2,3 je Minute** (37 -> 41 Ausdauer in 104 s);
  vorher gemessen waren 2,04.

Baseline fuer die Rangrate, gemessen 12:18 ueber `tools/ratencheck.js` vor der
Aenderung: **0,649 Rang je Minute** ueber 541 Minuten, davon 340,1 Minuten
(62,9 Prozent) in der Regenerationskammer. Der Vergleichswert gehoert in den
naechsten Optimierungslauf - erwartet werden rund sechs Prozent mehr, und das
ist wenig genug, dass es eine ordentliche Messdauer braucht.

Nebenbefund: `General/Incite Violence` steht mit **2 Abschnitten** im
Ratencheck. Die Aktion hat also inzwischen ausgeloest - der Vermerk "hat noch
nie ausgeloest" beim Vorratspunkt ist ueberholt.


### Sieben Milliarden auf einen Schlag - kein Leck, ein Kauf (26.08., 08:50)
Gemessen im Verlauf: 07:55 noch 8,98 Mrd, 08:15 nur 1,87 Mrd - **7,11
Milliarden in einem Schritt.** Danach stieg das Guthaben sofort wieder normal
(+0,38 Mrd in zwanzig Minuten). Ein einmaliger Kauf also, kein laufendes Leck.

**Damit ist der Krankenhaus-Hebel von 06:55 entlastet.** Er kostet
`min(Guthaben * 0,1, fehlendeHP * 100.000)`, bei 23 Trefferpunkten hoechstens
2,3 Millionen je Heilung - und er wuerde KONTINUIERLICH kosten, nicht in einem
Sprung. Das Guthaben waechst seither ungestoert.

Nicht der Grund waren auch die vier gekauften Server `werk-1` bis `werk-4`
(`data/werkbank.json`, je 128 GB): Bei rund 55.000 je GB sind das etwa 28
Millionen zusammen.

Gemessen mit dem neuen `src/augcheck.js` (liest `getOwnedAugmentations`):
elf eingebaute Augmentierungen, **eine wartende** (Cranial Signal Processors -
Gen II, Grundpreis 0,12 Mrd). Der bezahlte Preis liegt hoeher - jede weitere
Augmentierung im selben Zyklus kostet das 1,9-fache -, aber Faktor 58 waere
viel. Der wahrscheinlichste Rest ist eine **Spende an eine Faktion**:
`bn4rep.js` fuehrt eine `spendenSchwelle` und kauft Reputation gegen Geld,
und Spenden tauchen in keinem Inventar auf.

**Restunsicherheit bleibt.** Endgueltig bewiesen ist es nicht - `bn4rep.json`
stand seit gestern 17:05 still, und das ist KEIN Defekt: Das Skript steigt an
mehreren Stellen aus der Runde aus, bevor es seine Telemetrie schreibt (der
Kommentar bei `bn4rep.js:357-363` sagt es selbst). Wer die Frage abschliessend
klaeren will, muss bn4rep an diesen Ausstiegen protokollieren lassen.


### Ein haengender Hintergrundtask legte die Loops zwei Stunden still (26.08., 06:02)

Gemessen: Von 03:02 bis 05:10 feuerte kein einziger der vier Cron-Loops. Die
Jobs existierten unveraendert (CronList um 05:10, Original-IDs), die Sitzung
lebte, es gab keinen Compact und keinen Standby - der residente Waechter
loggte luekenlos alle drei Minuten weiter, und der Bot lief durch (Rang 143
auf 296).

**Ursache, experimentell belegt** (drei Versuche in einer Fremdsitzung):
Ein schwebender Hintergrundtask blockiert ALLE Cron-Jobs der Sitzung bis zu
seinem Ende. Verpasste Feuerungen verfallen ersatzlos. Das `timeout`-Argument
gilt fuer Hintergrund-Bash **nicht** - dort gibt es keine Obergrenze; ein Test
mit `timeout: 15000` lief die vollen 45 Sekunden durch. Auch ein laufender
Monitor blockiert; `persistent: true` waere neben Cron-Loops fatal.

Ausloeser war eine eigene `until`-Warteschleife von 02:45, die auf
`data/aktionen.jsonl` wartete - eine Datei, die es nie geben konnte, weil
Bitburner die Endung ablehnt. Zwei bash-Prozesse liefen 2h56m.

**Im eigenen Transcript nachgeprueft, die Vorhersage trifft:**

    05:12:46  letzte Spur des manuellen /bb-loops
       -      Wache 05:13 faellig: nichts. 05:33: nichts. Report 05:30: nichts.
    05:41:05  Kill der haengenden Prozesse
    05:41:50  erste Cron-Feuerung, 45 Sekunden spaeter

**Behoben in drei Schritten:**
1. Die Regel steht in allen vier Loop-Prompts (`loops/loop-*.md`):
   Warteschleifen nur mit harter Grenze (`for i in $(seq 1 20)` statt
   `until`), Monitor nur mit knappem `timeout_ms` und nie `persistent`, lange
   Wartearbeit abgekoppelt starten.
2. Der Totmannschalter im Waechter greift ab **35 statt 60 Minuten** - der
   haeufigste Loop laeuft alle zwanzig. In der Nacht dauerte es 119 Minuten.
3. Die Meldung nennt jetzt die wahrscheinliche Ursache: alte bash-Prozesse mit
   PID und Alter. Sie taugen NICHT als eigener Alarm - die persistente
   Arbeits-Shell des Bash-Werkzeugs laeuft ebenfalls stundenlang und blockiert
   nichts -, zusammen mit einer stehenden Loop-Kette sind sie aber der
   entscheidende Hinweis.

**Verifiziert 06:03** gegen eine 40 Minuten alte Verlaufsdatei: "Die
Ueberwachungs-Loops melden sich seit 40 min nicht mehr ... Verdacht: 1 alte(r)
bash-Prozess(e), aeltester PID 23092 seit 848 min." Im Normalbetrieb still.


### Worker-Timer-Ersatz gegen die Drosselung (26.08., 01:45)
Gebaut als `src/hacktimer.js`, dazu `src/timerzwang.js` als Schalter. Er
haengt `window.setTimeout` an einen Web Worker, dessen Timer nicht gedrosselt
werden (der Codepfad haengt an `BlinkSchedulerWorkerThrottling`,
standardmaessig aus). Bitburner greift `window.setTimeout` bei jedem Aufruf
dynamisch ab, ein Patch wirkt also sofort auf Engine und alle ns-Wartezeiten.

**Er faehrt bewusst NICHT mit.** Am 25.08. hat er die gesamte Spielengine 52
Minuten angehalten: Er haengte sich beim Verstecken des Tabs ein und starb
kurz darauf, ohne `window.setTimeout` zurueckzugeben. Seit 21:19 raeumt
`ns.atExit` beim Skriptende auf, und eingehaengt wird nur mit `--scharf`.

**Gebraucht wird er nicht.** Verifiziert 01:45 ueber `data/sonde.json` bei
verstecktem Fenster: `sichtbarkeit hidden`, `haupt.median 5 ms`,
`worker.median 5 ms`, `stufe keine`. Der Tonanker traegt seit dem Pegelfix -
der Haupt-Thread laeuft so schnell wie der Worker.

Die Wirkung des Patches selbst bleibt ungemessen und wird es bleiben, solange
keine Drosselung mehr auftritt. Das ist der richtige Zustand: Er ist die
Rueckfallebene, nicht das Tagesgeschaeft. Bricht die Rundenrate wieder ein,
steht in `doku/drosselung.md` Abschnitt 5, was zu tun ist.

Nebenbefund, gleich mitbehoben: `sonde.js` stand seit dem Einbau um 22:01
still - dreieinhalb Stunden, ohne dass es auffiel, denn sie steht in keiner
Startliste des Spiels. Sie ist jetzt in der Nachstartliste von
`tools/wache.js`. Ausgerechnet das Messwerkzeug gegen die Drosselung war das
einzige, dessen Ausfall niemand bemerkt haette.


### Der Totmannschalter der Loops schlug nachts faelschlich an (26.08., 01:15)
Gemessen 00:45: Der Waechter meldete `loops` - "Die Ueberwachungs-Loops melden
sich seit X min nicht mehr". Nachts hat die Nachtruhe die Meldung geschluckt
("Nachtruhe - nicht gesendet: loops"), um 5:00 waere sie rausgegangen.
Ursache: Der Schalter hing am Alter von `data/ziele.md`, und die schreibt nur
der Reportloop - der planmaessig zwischen 22:30 und 5:00 pausiert. Jede Nacht
war die Datei stundenlang alt, obwohl Wache und Vorankommen weiterliefen.
Behoben: Der Schalter haengt jetzt an `data/verlauf-strategie.json`. Die
schreibt `tools/strategie-check.js` bei JEDEM Lauf, und den ruft jeder der
vier Loops als erstes auf - der haeufigste ist die Wache alle zwanzig Minuten.
Grenze deshalb 60 statt 90 Minuten: Das sind drei verpasste Laeufe und nicht
mehr mit Verspaetung zu erklaeren.
**Verifiziert 01:14 in beide Richtungen:** Mit frischer Datei meldet der
Waechter nichts mehr (vorher schlug er an). Nach `touch -d "70 minutes ago"`
meldet er "Die Ueberwachungs-Loops melden sich seit 70 min nicht mehr", und
ein einziger Prueferlauf raeumt den Befund wieder ab.


### Nichts verhinderte einen zweiten Waechterprozess (26.08., 00:45)
Gemessen 25.08. um 19:43: ZWEI `node tools/wache.js` liefen gleichzeitig
(PID 24464 und 19744). Beide schreiben `data/wache-zustand.json`, und dort
stehen die Meldesperren - wer zuletzt schreibt, gewinnt. Derselbe Alarm haette
zweimal aufs Handy gehen koennen, oder eine Entwarnung haette eine noch
bestehende Stoerung geloescht. Seit dem 25.08. greift der Waechter ausserdem
selbst ein und startet Werkzeuge nach; zwei davon wuerden sich Auftraege
ueberschreiben.
Behoben: `data/wache.pid` traegt die Prozesskennung. Beim Start prueft der
Waechter mit Signal 0, ob der dort genannte Prozess noch lebt, und beendet
sich dann selbst. Eine verwaiste Sperrdatei wird uebernommen. Die Datei steht
in `.gitignore` - reine Laufzeitinformation.
**Verifiziert 00:45:** Erster Start meldet "Waechter laeuft (PID 17372)" und
legt die Sperrdatei an; der zweite meldet "Es laeuft bereits ein Waechter
(PID 17372) - beende mich" und beendet sich.


### Der Pruefer hielt die Regenerationskammer fuer Fortschritt (26.08., 00:16)
Gemessen 20:42: URTEIL SPUR bei +4 Rang in 24 Minuten, waehrend der Motor
durchgehend in der Kammer stand.
Ursache: Eine Heuristik. Stand die Ausdauer unter 90 Prozent, galt die Kammer
als legitim - beliebig lange. Zwei Dinge stimmten daran nicht mehr: blade.js
arbeitet seit dem 25.08. schon ab 60 Prozent weiter (die 90 stammten aus der
alten Hysterese), und der Motor ruht inzwischen meist wegen der Trefferpunkte,
wobei die Ausdauer voll ist - die Ausnahme griff also ausgerechnet im
haeufigsten Fall nicht.
Behoben: Der Pruefer LIEST den Grund, statt ihn zu erraten. blade.js schreibt
ihn seit 20:46 mit ("ruht bis Ausdauer 33", "ruht bis HP 17"). Eine Ruhe mit
Grund darf 20 Minuten dauern, eine ohne weiterhin 40. Zwanzig Minuten sind
grosszuegig: Die Kammer heilt zwei Trefferpunkte je Durchlauf, die Ausdauer
regeneriert rund 1,2 je Minute passiv - beide Schwellen sind in wenigen
Minuten erreicht.
**Verifiziert 00:16** gegen einen praeparierten Verlauf mit 30 Minuten
unveraendertem Rang: `LEERLAUF: General/Hyperbolic Regeneration Chamber laeuft
(ruht bis HP 17), der Rang steht seit 30 min`, URTEIL STAGNATION. Der Grund
steht jetzt in der Meldung. Im Normalbetrieb unveraendert SPUR.


### blade.js schrieb in zwei von drei Zweigen keine Telemetrie (25.08., 22:16)

Zweimal an einem Abend derselbe Fehler an anderer Stelle: Ein Zweig der
Hauptschleife machte `continue`, ohne etwas zu schreiben.
- **Ruhe-Zweig** (20:42): kostete 23 Minuten Blindflug - von aussen war ein
  Haenger nicht von ruhigem Ruhen zu unterscheiden.
- **Weichen-Zweig** (22:13): erzeugte einen Fehlalarm ueber eine angeblich
  stehende Spielengine, waehrend sie nachweislich mit 29,2 s je halber Minute
  lief. Der Pruefer verglich zweimal dieselbe eingefrorene Datei.

Beim ersten Mal wurde der Einzelfall geflickt. Die Ursache ist die
Duplikation: Drei Zweige, drei getrennte `ns.write`-Bloecke, und jeder neue
Zweig faengt wieder bei null an.

Behoben strukturell: Eine Funktion `meldeLage(aktion, grund, chance)` holt
sich alles, was jeder Zustand gemeinsam hat - Rang, Punkte, Ausdauer,
Trefferpunkte, Spielzeit, naechste Black Op - selbst. Alle drei Zweige rufen
sie; im Code steht nur noch **ein** `ns.write("data/blade.json")`. Ein neuer
Zweig kann nichts mehr vergessen ausser dem Aufruf, und der faellt beim Lesen
auf.

**Verifiziert 22:17:** `"aktion":"General/keine","grund":"weicht bbtrain,
Kampfwerte 80","spielzeit":531709600,"hp":"18/18"` - der Zweig, der eben noch
stumm war, meldet vollstaendig.


### Die Spielengine stand 52 Minuten still (25.08., 20:27 bis 21:19)

Der groesste Ausfall des Tages, und der am schwersten zu sehende: Netscript
und die Spielengine sind ZWEI Schleifen. `updateGame` stand ab 20:27 still -
`totalPlaytime` unveraendert ueber 30 Sekunden Messdauer, Rang, Ausdauer und
Aktionsfortschritt eingefroren auf siebzehn Nachkommastellen -, waehrend
bn4net sechs Runden je Minute zaehlte und Hackgeld hereinkam. Jede vorhandene
Pruefung sah Normalbetrieb; der Strategiepruefer meldete 46 Minuten lang SPUR.

**Ursache: `src/hacktimer.js`, also eine eigene Aenderung von 20:15.** Es
haengte sich ein, sobald der Tab versteckt wurde (Eric minimierte um 20:20:48),
und starb kurz darauf, ohne `window.setTimeout` zurueckzugeben. Ein sterbendes
Netscript-Skript raeumt seine window-Patches nicht von allein auf; der
Engine-Loop plant sich per setTimeout neu, dieser eine Rueckruf ging verloren.

Zwei Verdaechtige wurden dabei ausgeschlossen: Der `startAction`-Vergleich in
`blade.js:365` stimmt (das Enum `BladeburnerActionType` traegt genau die Werte,
die blade.js verwendet), und die Tab-Drosselung war es auch nicht -
`data/sonde.json` meldete durchgehend Stufe "keine".

Behoben in drei Schritten:
1. **Neuladen des Tabs um 21:19** durch Eric. Von aussen ist das nicht
   machbar; die Push-Nachricht ging um 21:14 raus.
2. **`hacktimer.js` entschaerft** (21:19): `ns.atExit` gibt die Timer beim
   Skriptende zurueck, und eingehaengt wird nur noch mit `--scharf`. Ohne das
   Argument misst es und laesst window in Ruhe.
3. **Der Puls steht jetzt in der Telemetrie** (21:15 und 21:45): blade.js
   schreibt `spielzeit` in beiden Zweigen - auch im Ruhen, denn eine lange
   Ruhephase ist der Zustand, in dem eine stehende Engine am laengsten
   unentdeckt bliebe. `tools/strategie-check.js` wertet sie aus und meldet
   STAGNATION mit der einzigen Anweisung, die dann hilft.

**Verifiziert dreifach:**
- Engine laeuft: 21:20 Spielzeitzuwachs 34,8 s ueber 30 s Messdauer, Rang
  101,69326509516765 -> 103,23571126575352 in derselben halben Minute.
- Traeger holt auf: Rang 127 um 21:45, +25 in 26 Minuten.
- Der Pruefer erkennt den Fall: gegen einen praeparierten Verlauf mit
  gleichbleibender Spielzeit meldet er
  `DIE SPIELENGINE STEHT: Spielzeit waechst seit 6 min nur um 4.0 s statt um
  360 s ... Hilft nur ein Neuladen des Tabs (F5).` und URTEIL STAGNATION.

Damit miterledigt: der Eintrag "Die Bladeburner-Simulation ist eingefroren"
(20:49) - derselbe Vorgang, eine Ebene zu tief gesehen.

### blade.js stand 23 Minuten in der Regenerationskammer fest (25.08., 20:42)
Zwei Ursachen, beide behoben:
- `HP_WEITER` stand auf 0,95. Da jeder Vertrag Schaden macht, ist diese Marke
  im laufenden Betrieb kaum je erreichbar - einmal in der Ruhe, blieb der
  Motor haengen. Jetzt 0,75.
- Der Ruhe-Zweig schrieb keine Telemetrie. `data/blade.json` trug um 20:42
  noch den Zeitstempel 20:19, und von aussen war ein Haenger nicht von ruhigem
  Ruhen zu unterscheiden.
Ab 20:27 kam der Engine-Stillstand oben dazu, der den Rest der Zeit erklaert.
**Verifiziert 21:45:** `"hp":"10/22","spielzeit":529845400,"grund":"ruht bis
HP 17"` - die Datei altert nicht mehr, und der Ruhegrund steht dabei.
Damit miterledigt: "data/blade.json war um 20:27 acht Minuten alt".

### hacktimer.js stand in keiner Startliste (25.08., 21:19)
Der Befund von 20:28 war richtig, die Schlussfolgerung falsch: Das Werkzeug
gehoert NICHT in die Liste WERKZEUGE. Es hat wenige Minuten spaeter die
gesamte Spielengine angehalten (siehe oben). Seit 21:19 faehrt es nur noch mit
ausdruecklichem `--scharf` und raeumt beim Skriptende auf.
**Verifiziert 21:45:** Es laeuft nicht, und der Bot arbeitet - Rang 127.


### Der Bitburner-Tab lief gedrosselt - der Tonanker war zu leise (25.08., 20:25)

Gemessen am 17:47 und ueber Stunden: eine Motorrunde je Minute statt vier bis
sechs, sobald das Fenster verdeckt war. Zwei Verdaechtige wurden geprueft und
verworfen: der Tonanker lief nachweislich (`ctx.state === "running"`), und eine
zweite, audio-resistente Drosselung fuer verdeckte Fenster gibt es nicht.

Die Ursache lag im Pegel. Chromium entscheidet die Hoerbarkeit an der
gemessenen LEISTUNG des Stroms gegen -72,247 dBFS; fuer einen Sinus liegt die
Leistung 3 dB unter der Amplitude. Der bisherige Wert 0,0005 ergab -69,0 dBFS -
3,2 dB Reserve, ein Grenzfall, der mit Ausgabegeraet oder Mixerpfad kippt. Das
erklaert, warum derselbe Kniff am 21.08. wirkte und am 25.08. nicht.

Behoben 20:03 in `src/wakelock.js`: Verstaerkung 0,01 (-43,0 dBFS, 29 dB
Reserve), dazu wird `ctx.sampleRate` mitgeloggt.

**Verifiziert 20:23-20:25 bei MINIMIERTEM Fenster: 12 Motorrunden in 120
Sekunden, also 6,0 je Minute** - der volle Wert. `data/sonde.json` meldete
dabei `sichtbarkeit: hidden` und 0 Bilder je Sekunde, `data/wakelock.txt`
meldete `running|48000`. Vorher lag die Rate im selben Zustand bei 0,93.

Damit ist der Faktor sechs zurueck, ohne dass Eric Opera neu starten muss. Die
Flags aus `doku/drosselung.md` Abschnitt 4 bleiben die dauerhaftere Loesung -
der Ton haengt an einer Einstufung, die der Browser jederzeit anders treffen
kann.

Die vollstaendige Mechanik steht in `doku/drosselung.md`.


### tools/wache.js misst jetzt den Traeger des Knotens (25.08., 19:44)
Gemessen 17:30: Der Waechter fuehrte als Verlauf nur `hacking`, `geld` und
`homeRam`. Beide steigen in BitNode 6 durch bn4net von selbst weiter, auch wenn
die Bladeburner-Division vollstaendig stillsteht - der Waechter haette genau den
Stillstand verschwiegen, gegen den er gebaut ist. Gefunden von einem
Skeptiker-Subagenten, nicht von einem Loop.

Behoben in `tools/wache.js`: Frisches `data/blade.json` (juenger als 10 min)
gilt als Zeichen fuer einen Bladeburner-Knoten - damit braucht die Pruefung die
Knotennummer gar nicht. Der Rang wandert in den Messverlauf; steht er
45 Minuten unveraendert, faellt der neue Befund `traeger`. Ist der Tab gedrosselt,
schweigt er: Dann nennt der Tempobefund die Ursache, und zwei Nachrichten ueber
dieselbe Sache waeren Laerm.

Bewusst nicht die 2024 ausgebaute Hacking-Pruefung wiederbelebt (siehe Punkt 5
im Quelltext): Die scheiterte an "hat sich irgendetwas bewegt". Der Rang hat
genau eine Quelle - versiegt sie, ist der Knoten blockiert.

**Verifiziert um 19:44 auf zwei Wegen:** Im Normallauf meldet der Waechter
`still - Hacking 114, $2.1b, Rang 73` (der Traeger steht jetzt in der
Meldezeile), und gegen einen praeparierten Verlauf mit 50 Minuten Stillstand
faellt der Befund `Bladeburner-Rang steht seit 50 min bei 73`. Der residente
Prozess laeuft seit 19:44 mit dem neuen Code.


### Der Pruefer stuerzte beim Beenden ab, nach der Urteilszeile (25.08., 19:12)
Gemessen: `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING),
file src/win/async.c, line 94` nach `URTEIL: SPUR`, bei etwa jedem dritten Lauf.
Ursache: `process.exit()` reisst Node mitten aus der Ereignisschleife, waehrend
noch Handles offen sind.
Behoben: `process.exitCode` statt `process.exit()` - derselbe Rueckgabewert,
aber Node schliesst seine Handles selbst. Alle fetch-Aufrufe sind awaited und
ihre Timeouts im finally geloescht, es bleibt nichts haengen.
Nicht kosmetisch: Der Wache-Prompt prueft, ob die Ausgabe auf `URTEIL:` endet,
und haelt den Pruefer sonst fuer kaputt - samt Push-Nachricht, obwohl alles
laeuft. Ein Fehlalarm aus dem Alarmwerkzeug selbst ist die teuerste Sorte.
**Verifiziert: fuenf Laeufe in Folge um 19:12, jeder endet auf der Urteilszeile;
Rueckgabewert 0 bei SPUR unveraendert.**

### Die Sollrate ignorierte die Erfolgswahrscheinlichkeit (25.08., 18:42)
Gemessen 18:21: 0,15 Rang je Minute bei `Contracts/Retirement` mit 0,493
Erfolgschance. Der Pruefer erwartete 1,7 - den Bruttoertrag laut Quellcode - und
meldete STAGNATION, obwohl der Motor genau das Richtige tat. rankGain 0,6 mal
knapp der Haelfte Erfolg sind effektiv rund 0,3 je Durchlauf.
Behoben in zwei Dateien: `blade.js` schreibt die Erfolgschance der laufenden
Aktion nach `data/blade.json`, `sollRate()` multipliziert damit. Fehlt das Feld,
wird konservativ mit 0,5 gerechnet.
**Verifiziert: `chance: 0.482` in blade.json und URTEIL SPUR um 18:42** (vorher
STAGNATION bei identischer Lage).

### blade.js fiel auf General/Training zurueck, weil Tracking leer war (25.08., 18:13)
Gemessen 18:12: Tracking offen 0,4 bei Stufe 10 (leergespielt), Retirement min
0,493 - sieben Tausendstel unter der Schwelle 0,50. Der Motor wartete auf nichts
und fuhr Training, das keinen Rang gibt. Chaos war 0, Overclock bereits auf
Stufe 2 - der Faehigkeitenkauf funktioniert also, der erste Verdacht war falsch.
Behoben: Vertragsschwelle 0,50 -> 0,45. Ein misslungener Vertrag kostet Zeit und
etwas Chaos, aber keinen Rang; verglichen wird nicht mit einem besseren Vertrag,
sondern mit Training, und das liefert garantiert null.
**Verifiziert: aktion "Contracts/Retirement" um 18:13** (vorher
"General/Training").
Die Ursache dahinter - endliche Vorraete ohne Gegenmittel - steht als
struktureller Punkt unter Offen.

### Der Faehigkeitenkauf kaufte das Billigste statt des Wichtigsten (25.08., 17:20)
Gemessen um 17:15, eine Dreiviertelstunde nach dem Beitritt: Overclock Stufe 0
(Plan-Platz 1), Blade's Intuition Stufe 0 (Plan-Platz 2), Digital Observer
Stufe 1 (Plan-Platz 3). Rang wuchs mit 0,24 je Minute.

Ursache: Die Kaufschleife stieg bei "zu teuer" mit `break` aus dem aktuellen
Skill aus und machte mit dem NAECHSTEN weiter. Der Kommentar darueber versprach
"strikt nach Plan, nicht nach Preis" - der Code tat das Gegenteil. Da Punkte
einzeln anfallen, konnte so systematisch nur das Billigste gekauft werden,
waehrend die beiden Faehigkeiten mit Wirkung auf JEDE Aktion auf null blieben.

Behoben: Beim ersten Eintrag stehenbleiben, der nicht am Deckel ist, und sparen
bis er bezahlbar ist. Ein Punkt, der eine Runde liegen bleibt, ist billiger als
einer, der im falschen Skill steckt - Faehigkeiten lassen sich nicht
zurueckgeben.

Offen geblieben und bewusst nicht angefasst: Die Ausdauer-Hysterese (ruhen ab
55 %, weiterarbeiten erst ab 90 %) kostet viel Zeit - um 17:15 lief
"Hyperbolic Regeneration Chamber" bei 31,6 von 43,8. Ob 90 % zu hoch gegriffen
ist, laesst sich erst nach dem Kontrollpunkt sinnvoll beurteilen; zwei
gleichzeitige Aenderungen waeren nicht mehr auseinanderzuhalten.

### bn4rep.js lief seit dem Einbau um 05:50 nicht (25.08., behoben 16:50)
Die Werkbank war strukturell zu klein geworden. Auf werk-0 (1.024 GB) lagen
blade 41,25 + bbtrain 94,75 + bn4life 293,8 + homegrow 148,5 + wakelock 34,25 +
bn4door 99,85 = 712,4 GB; fuer bn4rep mit 768,25 GB blieben 312,25 GB. Gestartet
wurde ausschliesslich auf der Werkbank, also gab es keinen zweiten Wirt - und
die Zeile "wartet" stand nur im Spiel-Log, das von aussen niemand liest.

Platz gab es durchaus: fulcrumtech haette nach dem Raeumen seiner Arbeiter
1.021 GB gehabt. Nur hat niemand dort nachgesehen.

Behoben: Jedes fehlende Werkzeug sucht sich jetzt selbst einen Wirt - erst die
Werkbank, und wenn es dort auch nach dem Raeumen nie passen kann, den Rechner
mit dem meisten Platz nach Raeumung. Gemessen 16:50: bn4rep laeuft auf
fulcrumtech.

Dazu neu: `src/werkbank.js` beantwortet die Frage "warum startet ein Werkzeug
nicht" in einer Datei statt im Spiel-Log.

### bn4life und blade.js stritten sekuendlich um die Figur (25.08., 16:25)
Unmittelbar nach dem Beitritt zur Division erschienen im Spiel sekuendlich
Dialoge "Your Bladeburner action was cancelled because you started doing
something else". Ursache: Eine Bladeburner-Aktion ist keine Arbeit im Sinne von
`getCurrentWork()` - die Funktion gibt dabei null zurueck. bn4life las das als
"die Figur hat nichts zu tun" und schob ein Verbrechen nach, was die
Bladeburner-Aktion abbrach; blade.js startete sie neu, bn4life schob wieder
nach. Beide Seiten liefen ins Leere.
Behoben: bn4life begeht keine Verbrechen mehr, solange `inBladeburner()` true
ist (0 GB, also gratis). In einem Knoten, dessen Ausgang ueber Black Operations
fuehrt, traegt Bladeburner - Verbrechen sind Beiwerk.

### bbtrain trainierte nur str, waehrend def/dex/agi auf 1 standen (25.08.)
Behoben in 19c324d. Stadt und Studio werden jetzt in der Trainingsschleife
geprueft statt einmal davor. Wirkung nach acht Minuten: str 107, def 37, dex 43,
agi 15.
