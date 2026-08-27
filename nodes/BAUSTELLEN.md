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
  **Seit dem 27.08.2026, 05:00 ohne Ausnahme.** Eric hat den Vorbehalt fuer
  `src/bn4net.js` und `src/boot.js` aufgehoben - mit der Auflage, dort **jede
  Aenderung einzeln zu committen**, damit sie sich einzeln zurueckdrehen
  laesst. Sein Ziel: "Ich will das Projekt hier nahezu vollstaendig durch
  Loops laufen und entscheiden lassen, so dass ich eigentlich nicht noetig
  bin."
  **Die Reihenfolge der BitNodes bleibt unangetastet** - nicht als Vorbehalt,
  sondern weil sie feststeht (Fables Analyse,
  `nodes/AUDIT-ROADMAP-2026-08-24.md`). Auch Eric will dort nicht mehr
  dazwischenfunken.
  *Anlass: Der Raid-Befund vom 26.08. stand vier Laeufe lang auf "Wartet bis
  Eric entscheidet", obwohl jede Zahl dafuer gemessen war. Das kostete den
  groessten offenen Hebel des Knotens einen halben Nachmittag.*

---

## Sofort

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

### Nach einem Einbau starten die Werkzeuge nicht nach (Freigabe seit 27.08., 05:00)

**Der Titel hiess bis 05:58 "Wartet bis Eric bn4net freigibt".** Die Freigabe
ist da; der Punkt ist damit normale Arbeit und wird nicht mehr uebersprungen.

**Untersucht 27.08., 05:50 bis 05:58 - Ursache noch nicht belegt, aber der
Suchraum ist kleiner.** Die gesamte Nachstart-Logik steckt in
`if (werkbank) { ... }` (`bn4net.js:2575`). Die Werkbank ist der groesste
gekaufte Rechner ueber 20 GB - und nach einem Einbau gibt es keinen
(`"Keine gekauften Rechner"`, gemessen 04:21).

**Dieser Fall ist aber bereits abgefangen** (`bn4net.js:770-778`): Faellt die
Werkbank aus, wird home genommen, sofern das kleinste Werkzeug dort passt.
home hatte 2048 GB. Die Bedingung war also erfuellt, und trotzdem lief
`bbtrain.js` von 03:48 bis 04:18 nicht.

**Was als Naechstes zu tun ist, konkret:** `bn4net` protokolliert seine
Entscheidungen ueber `sag()` ins Spiel-Log. Beim naechsten Einbau gehoert
dieses Log gelesen, statt weiter im Quelltext zu suchen - dort steht, ob der
Block ueberhaupt lief und woran der Start scheiterte. Nach der
Zehn-Minuten-Regel hier abgebrochen, statt zu raten.

**Ein Nebenbefund, der stehen bleiben soll:** Der Kommentar bei :770 spricht
vom "kleinsten noch nicht laufenden Werkzeug", der Code nimmt aber das
kleinste aus der GESAMTEN Werkzeugliste. Das ist grosszuegiger als
beschrieben, also ungefaehrlich - aber es ist nicht dasselbe.

**Messung 27.08., 04:50 - der Fall ist wieder eingetreten, und diesmal traf er
den Traeger selbst.** Eine Stunde nach dem Einbau von 03:48 liefen `blade`,
`bn4life`, `bn4net`, `contracts`, `joinrun`, `popups`, `sonde` und `wakelock`
- aber **`bbtrain.js` nicht**. Das ist genau das Werkzeug, das in der
Wiederaufbauphase den Traeger hebt.

Sichtbar war es an den Kampfwerten: **str 169, def 1, dex 2, agi 1** nach 27
Minuten. `joinrun.js` trainiert nur str; die anderen drei standen still, und
der Traeger - der Tiefstand - blieb auf 1. Der Pruefer meldete SPUR, weil die
Toleranz 75 Minuten betraegt; er haette erst um 05:03 angeschlagen.

**Eingriff 04:50:** `bbtrain.js` ueber den Auftragskanal gestartet.
*Verifiziert 04:52:* Es laeuft, und def steht bereits bei **42** statt 1 -
die Arbeit ist auf "def @ Powerhouse Gym" gewechselt.

**Was das fuer die Freigabe heisst:** Der Nachstart greift, aber zu langsam
und in der falschen Reihenfolge. `bbtrain.js` steht in `bn4net.js:264` an
zweiter Stelle der Werkzeugliste - trotzdem war es nach einer Stunde nicht da,
waehrend spaetere Werkzeuge liefen. Das ist der Punkt, der Erics Freigabe
braucht.

**Messung 26.08., Einbau 16:31: teilweise behoben.** Um 16:36 liefen nur
`bn4net`, `bn4life`, `joinrun`, `popups`, `contracts` - `blade.js` fehlte und
wurde um 16:38 von Hand nachgestartet. Um 17:14 lagen dann `blade`, `bbtrain`,
`homegrow`, `wakelock`, `bn4door` von selbst auf `werk-0`, `sonde` auf home.
Die Nachstart-Logik greift also, sobald wieder Rechner mit Speicher da sind
(Netz 13/70 um 16:36 gegen 66/95 um 17:07) - sie ist nur langsamer als der
Motor des Knotens. **Offen bleibt genau das:** `blade.js` traegt den Knoten und
sollte nicht auf den Netzausbau warten muessen.
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

**Messung 26.08., 16:31: JA.** Der Einbau kam um 16:31:42, und
`tools/strategie-check.js` meldete unmittelbar `URTEIL: RESET` mit der Phase
"Wiederaufbau nach Einbau" und dem Traeger "Kampfwert-Tiefstand = 1 von 100".
Um 17:07 stand die Phase wieder auf "Black Operations". Der Punkt ist damit
beantwortet, bleibt aber bis zum naechsten Einbau stehen - eine einzelne
Beobachtung ist noch kein Nachweis, dass die Erkennung stabil ist.
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

### bn4rep optimiert auf den Hacking-Ausgang - in einem Knoten, der ihn vierfach daempft

**Dringlichkeit: hoch.** Der Reputationsmotor arbeitet seit Knotenbeginn auf ein
Ziel hin, das in BitNode 6 der teurere von zwei Wegen ist.

**Gemessen 27.08., 02:25.** Die Guetezahl, nach der `bn4rep.js` Faktion und
Augmentierung waehlt, ist (`bn4rep.js:1178-1181`):

    einzelWert = (aug === "The Red Pill" ? 10 : 0)
               + zaehlplatzWert
               + levelNutzen(aug, mults.hacking, zielLevel)

Alle drei Summanden zielen auf den **Hacking-Ausgang**: The Red Pill haengt
w0r1d_d43m0n ans Netz, `levelNutzen` bewertet den Hacking-Multiplikator, und
der Zaehlplatz zaehlt Richtung Daedalus. Eine Kampfwert-Augmentierung wie
**SPTN-97** (x1,75 auf alle vier Werte) bekommt damit `0 + 1 + 0 = 1` - genau
so viel wie ein voellig wertloses Stueck.

**Was BitNode 6 dazu sagt** (`BitNode/BitNode.tsx:694-720`):

    HackingLevelMultiplier   0,35     <- Level wird auf ein Drittel gestaucht
    HackExpGain              0,25     <- Erfahrung geviertelt
    DaedalusAugsRequirement  35       <- statt 30, wir haben 14

Der Hacking-Weg verlangt hier Hacking **6000** fuer den Backdoor auf
w0r1d_d43m0n (aus `tools/save.js`) bei einem Multiplikator von 0,35 und
gevierteltem Erfahrungsgewinn. Aktuell steht Hacking bei **155**.

Der Bladeburner-Weg dagegen laeuft: Rang 1658 von 2500 fuer die erste Black Op,
Rate rund 1,4 je Minute.

**Vorbedingung 1 ist geklaert (27.08., 02:48): Der Hacking-Weg ist in diesem
Knoten chancenlos, der Bladeburner-Weg braucht EINEN Einbau-Zyklus.**

Gemessen aus dem Spielstand:

    effektiver Hacking-Mult   0,559   (mults.hacking 1,605 x BN-Daempfung 0,35)
    effektiver Dex-Mult       1,827   (ungedaempft - BN6 daempft nur Hacking)

Was der Hacking-Ausgang bei diesem Multiplikator kostet
(`exp = e^((lvl/mult + 200)/32) - 534,6`):

    Hacking 1000   9,85 x 10^26  Erfahrung
    Hacking 3000   3,56 x 10^75
    Hacking 6000   2,44 x 10^148   <- der Backdoor auf w0r1d_d43m0n

Der Bestand liegt bei 3,55 Millionen. Das sind **146 Groessenordnungen**, und
sie lassen sich nur ueber den Multiplikator schliessen: fuer Hacking 6000
braeuchte es einen effektiven Mult um 25 bis 30, also `mults.hacking` bei 50
bis 90 - mit Hack-Augmentierungen von x1,05 bis x1,3 sind das Dutzende
Einbau-Zyklen.

**Der Bladeburner-Weg dagegen ist eine Frage von einem Zyklus.** Ein
Typhoon-Versuch lohnt sich, sobald der Erwartungswert positiv ist:
`chance * 50 - (1 - chance) * 10 > 0`, also ab **Chance 0,167** - nicht ab 50
Prozent, wie der Eintrag von 01:05 unterstellte. Von 0,037 auf 0,167 ist
Faktor 4,5 in der Kompetenz, wegen des Exponenten 0,9 also **Faktor 5,63 in
den Kampfwerten**: dex von 240 auf rund 1.350, der Multiplikator von 1,83 auf
10,3.

Die zehn staerksten Kampfwert-Augmentierungen zusammen ergeben **x6,91**
(SPTN-97 1,75; CordiARC 1,35; Photosynthetic Cells 1,40; nextSENS und
Xanipher je 1,20; Bionic Spine 1,15; HemoRecirculator 1,08; Golem Serum 1,07;
Power Recirculator 1,05; BladeArmor 1,04). Auf den heutigen 1,827 sind das
**12,6** - mehr als die noetigen 10,3.

**Damit ist die Richtung entschieden, und zwar durch die Zahlen:** Der
Reputationsmotor gehoert in den Kampfknoten auf Kampfwert-Augmentierungen
umgestellt. Bleiben Vorbedingung 2 (die Liste fehlt) und 3 (der Umbau
beruehrt Firmenphase, Einbaukriterium und Daedalus-Logik).

**Zu klaeren, bevor umgebaut wird:**
2. ~~Die Liste fehlt.~~ **Erledigt 27.08., 03:25.** `src/lib/combataugs.js`
   ist angelegt: **60 Augmentierungen** mit Kampfwert- oder
   Bladeburner-Multiplikatoren, maschinell aus `Augmentations.ts` gezogen,
   Anzeigenamen aus `Augmentation/Enums.ts` aufgeloest. Dazu `combatNutzen()`
   nach derselben Bauart wie `levelNutzen`: Ein Faktor f auf einen Kampfwert
   hebt dessen Beitrag um `f^0,9` (nicht um f - bei x1,75 sind das 6 Prozent
   Unterschied), Gewicht 0,25 je Wert nach den Typhoon-Gewichten,
   `bladeburner_success_chance` ungedaempft, Erfahrungs- und
   Ausdauermultiplikatoren mit halbem Gewicht ueber den Logarithmus.

   *Verifiziert 03:25*, die acht besten Stuecke:

       0,655  SPTN-97 Gene Modification
       0,527  Graphene Bionic Spine Upgrade
       0,460  CordiARC Fusion Reactor
       0,382  Hydroflame Left Arm
       0,370  Graphene Bionic Arms Upgrade
       0,320  Graphene Bionic Legs Upgrade
       0,306  Graphene Bone Lacings
       0,265  Photosynthetic Cells

   Die Datei aendert noch **nichts** am Verhalten - sie wird von niemandem
   importiert. Das ist Absicht: Der Umbau von `einzelWert` ist der naechste
   Schritt und gehoert in einen eigenen Lauf mit Nachmessung.
3. **`bn4rep.js` ist gross und traegt den ganzen Reputationszyklus.** Ein
   Umbau der Guetezahl beruehrt auch die Firmenphase, das Einbaukriterium und
   die Daedalus-Logik. Das ist kein Einzeiler und braucht einen eigenen Lauf
   mit Nachmessung.


### Operation Typhoon ist mit Rang 2500 erreichbar, aber nicht fahrbar

**Alle drei Messauftraege sind erledigt (27.08., 01:20) - und die Antwort ist
beruhigender als der Befund klang.**

**1. Kampfwerte aus Bladeburner-Arbeit: 0,159 dex je Minute.** Gemessen aus
den Pruefausgaben, 20:07 (dex 181) gegen 01:15 (dex 230), 308 Minuten. Fuer
dex 4.400 waeren das **434 Stunden** - auf diesem Weg unerreichbar.

**2. Gym scheidet ebenfalls aus, und zwar rechnerisch.** Die Erfahrungskurve
ist `exp = e^((lvl/mult + 200)/32) - 534,6`
(`PersonObjects/formulas/skill.ts:17-19`). Bei `mults.dexterity` = 1,834
braeuchte dex 4.400 einen Exponenten von rund `(2.399+200)/32 = 81` - eine
Zahl jenseits jeder Spielzeit.

**3. Der Fehlschlag-Versuch ist strikt defizitaer** (schon 01:05 gerechnet):
`rankLoss` 10 gegen `rankGain` 50, bei 3,7 Prozent Chance im Mittel 27
Versuche je Erfolg - also 270 Rang Verlust gegen 50 Gewinn.

**Der Ausweg stand die ganze Zeit im Multiplikator.** `calculateSkill` ist
`floor(mult * (32*ln(exp + 534,6) - 200))` - der Multiplikator wirkt **direkt
auf das Ergebnis**, nicht auf die Erfahrung. Gemessen 01:15: `mults.dexterity`
steht bei **1,834**, str und def bei 1,260, agi bei 1,389, bei 14
installierten Augmentierungen. Die Basis hinter dex 230 ist also 125 - mit
einem Multiplikator von 20 waeren daraus 2.508, mit 35 rund 4.390.

**Damit ist die Route richtig und nur die Erwartung war falsch.** Rang 2500 ist
kein Ausgang, sondern ein Zwischenschritt; die Black Ops kommen nach mehreren
Augmentierungs-Zyklen im selben Knoten. Genau das tut der Bot bereits -
`bn4rep` sammelt Reputation, `bn4net` baut aus, und um 16:31 lief der erste
Einbau dieses Laufs.

**Was daraus folgt, ohne Umbau:** Die Bladeburner-Augmentierungen selbst sind
schwach (`bladeburner_success_chance` 1,02 bis 1,06,
`Augmentation/Augmentations.ts:203,215,228`; nur eine gibt x2). Der Hebel sind
die **Kampfwert-Multiplikatoren**.

**Und genau die sieht der Bot nicht (geprueft 27.08., 01:50).** `bn4rep.js`
waehlt Faktion und Zielaugmentierung ueber `levelNutzen`/`hackNutzen` aus
`lib/hackaugs.js` - und dessen Kopfkommentar sagt es selbst: die Liste enthaelt
"alle Augmentierungen, die mindestens einen **Hacking- oder
Reputations-Multiplikator** setzen". Kampfwert-Augmentierungen kommen darin
**gar nicht vor**. In einem Knoten, dessen Traeger der Bladeburner-Rang ist und
dessen Ausgang an den Kampfwerten haengt, priorisiert der Reputationsmotor also
ausschliesslich nach Hacking.

Was dabei liegen bleibt, aus `Augmentations.ts` gezaehlt - 17 Augmentierungen
setzen mindestens drei Kampfwerte, die staerksten:

    Augmentierung          Produkt   repCost   je Wert
    SPTN-97                   9,38   1,25e6    1,75
    CordiARC Reactor          3,32   1,125e6   1,35
    Photosynthetic Cells      2,74   5,625e5   1,40 (str/def/agi)
    nextSENS / Xanipher       2,07   4,375e5   1,20
    Bionic Spine              1,75   4,5e4     1,15

Zum Vergleich: `mults.dexterity` steht heute bei **1,834**. Allein SPTN-97
wuerde ihn auf 3,21 heben - dex 230 wuerde damit zu rund 402, und die
Typhoon-Chance von 0,037 auf grob 0,075 steigen.

**Auftrag, eigener Lauf:** Eine Kampfwert-Liste analog zu `lib/hackaugs.js`
anlegen und `bn4rep.js` in den Kampfknoten (6 und 7) danach priorisieren
lassen. Zwei Dateien, deshalb nicht in diesem Lauf. **Vorher zu klaeren:** ob
`bn4rep` ueberhaupt kauft oder nur freischaltet, und wie die Nachtsteuerung
(`nacht.cmd`) die Auswahl trifft - sonst wird an der falschen Stelle
umgebaut.

**Dringlichkeit: hoch.** Es ist die Frage, ob der Knoten ueberhaupt auf dem
eingeschlagenen Weg endet.

Gemessen 27.08., 00:57: Die Erfolgschance von Operation Typhoon liegt bei
**0,035 bis 0,038** - unveraendert gegenueber 15:46 (0,035 bis 0,042), obwohl
sich der Rang von 745 auf 1528 verdoppelt hat. Der Grund steht in HEBEL.md
(01:05): **Der Rang geht nicht in die Chance ein.** Black Ops ignorieren
Stadtwerte und Chaos, ihre Schwierigkeit ist die feste `baseDifficulty` 2000,
und die Chance ist `competence / 2000` mit
`competence = SUMME weights[stat] * effSkill^0,9`.

Fuer 50 Prozent braucht es **Faktor 19,6 in den Kampfwerten** - dex von 224
auf rund 4.400. Ueber Faehigkeiten ist das nicht zu holen (Reaper 2 Prozent je
Stufe, Evasive System 4 auf dex/agi; Stufe 50 in beiden braechte x3,5).

**Zu messen, bevor irgendetwas entschieden wird:**
1. Wie schnell wachsen die Kampfwerte aus Bladeburner-Arbeit? Aus
   `data/aktionen.txt` laesst sich das nicht ablesen - es braucht zwei
   Messpunkte der Kampfwerte mit Zeitstempel. Der Strategiepruefer schreibt
   sie bereits in `data/verlauf-strategie.json`.
2. Was kostet dieselbe Steigerung im Gym? Powerhouse Gym kostet 2.400 Dollar
   je Sekunde, das Guthaben liegt bei 18,7 Milliarden - Geld ist hier nicht
   der Engpass, Zeit ist es.
3. Was bringt ein Fehlschlag-Versuch? `rankLoss` 10, `hpLoss` 100
   (`data/BlackOperations.ts:12-14`). Bei 3,7 Prozent Chance kostet ein
   Erfolg im Mittel 27 Versuche, also 270 Rang und 2.700 HP-Schaden - gegen
   `rankGain` 50. **Das ist strikt defizitaer**, Typhoon auf gut Glueck zu
   versuchen scheidet damit aus.

**Erst danach ist die Route zu bewerten** - und eine Aenderung an der
Reihenfolge der BitNodes waere Erics Entscheidung, kein Loop-Beschluss.


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

### bn4rep fand keinen Platz, weil home pauschal ausgeschlossen war (27.08., 06:12)

**Verifiziert: `bn4rep.js` laeuft auf home um 06:12**, alle zwoelf Werkzeuge
stehen. Erste Aenderung an `bn4net.js` nach der Freigabe.

Der Waechter meldete um 06:00 per Push "bn4rep.js hat keinen Platz" - die neue
Meldung mit Grund, die seit 20:50 im Waechter steht. Sie hat funktioniert wie
gedacht: Eric sah den Grund, nicht nur den Ausfall.

**Der Grund war eine veraltete Begruendung im Code.** `ausweichwirt()` in
`bn4net.js` schloss home aus, "ein 768-GB-Werkzeug haette dort ohnehin nie
Platz". Das stimmte, als home 64 GB hatte. Heute hat es **2048**.

Gemessen um 06:05: Werkbank ist `millenium-fitness` mit **256 GB**, bn4rep
braucht 768,3. Ein Ausbau auf 1024 GB kostet **897,6 Milliarden** gegen 1,9
Milliarden Guthaben - `CloudServerSoftcap: 2` (`BitNode.tsx:702`) macht
Serverplatz in diesem Knoten unbezahlbar. **Ueber Server war der Platz nicht
zu bekommen**, ueber home schon: 2048 GB, davon 512 Reserve.

**Geaendert:** Statt des Tabus eine Rechnung - freier Platz plus raeumbare
Arbeiter minus `reserveHome()`. Reicht es nicht, faellt home wie jeder andere
Rechner durch die Pruefung, aus Mangel statt aus Prinzip.

**Die Lehre, und sie betrifft mehr als diese Zeile:** Der Ausschluss war
einmal richtig und ist mit dem Ausbau von home falsch geworden, ohne dass
irgendetwas kaputtging - er hat nur still ein Werkzeug ausgesperrt. **Eine
Begruendung, die eine Zahl nennt, gehoert nachgerechnet, wenn sich die Zahl
aendert.** Genau dasselbe Muster steckte in der 84,5-Millionen-Rechnung von
17:55 und in der Pauschale 1,7 des Pruefers.

### Ein Server-Ausbau kurz vor einem Einbau verbrennt das Geld doppelt (27.08., 04:50)

Gemessen: Um 04:06 habe ich `werk-0` von 1024 auf 2048 GB ausgebaut, fuer
**2,703 Milliarden**. Um 04:08 meldete der Pruefer `URTEIL: RESET` - ein
Augmentierungs-Einbau, Kampfwerte auf 1, Netz 13/70, Guthaben 1 Million.
**Gekaufte Rechner ueberleben einen Einbau nicht** (`Prestige.ts:73`, steht so
schon im Kommentar von `bn4net.js:530`). Der Ausbau war damit zwei Minuten
lang nuetzlich.

Erwartet: Vor einem Kauf in Milliardenhoehe gehoert geprueft, ob ein Einbau
ansteht. Die Anzeichen waren da - 28,9 Milliarden Guthaben und ein
Reputationsmotor, der seit Stunden sammelt.

Verdacht: keine Codestelle, ein Verfahrensfehler von mir.

**Geaendert 27.08., 04:20, Wirkung noch nicht gemessen.** `src/wbgrow.js`
summiert jetzt vor dem Ausbau die Preise aller Augmentierungen, deren
Reputationsschwelle bereits erreicht ist, und lehnt ab, wenn diese Summe die
Ausbaukosten uebersteigt. Der Grund wird in `data/wbgrow.txt` geschrieben,
statt still zu scheitern.

**Der Testlauf um 04:21 lief ins Leere und bestaetigt dabei den Befund:**
`"Keine gekauften Rechner."` - der Einbau von 03:48 hat sie alle geloescht.
Die 2,703 Milliarden von 03:46 sind damit belegt verloren.

**Zweiter Test um 04:47, mit 16 wieder gekauften Servern - und er foerdert
etwas Groesseres zutage.** Die neue Augmentierungspruefung wurde erneut nicht
erreicht, weil der Fuenftel-Test davor blockiert:

    Ziel 1024 GB   897.600m gegen 14.340m Guthaben
    Ziel  128 GB    10.560m gegen 14.340m Guthaben

**Ein Ausbau von 64 auf 128 GB kostet 10,56 Milliarden.** Der Grund steht in
`BitNode.tsx:702`: `CloudServerSoftcap: 2`. Serverkosten sind in BitNode 6
quadratisch gedaempft, und der Park ist damit praktisch unbezahlbar.

**Damit ist mein Vorwurf an `bn4net` vom 17:55 endgueltig unbegruendet** - er
lautete, der Motor kaufe Arbeiterserver, lasse die Werkbank aber auf
Startgroesse stehen. Der Motor rechnet richtig; die Werkbank auszubauen kostet
in diesem Knoten mehr, als sie einbringt. Das war schon die erste Korrektur um
20:30 (84,5 Millionen waren eine BitNode-1-Rechnung), aber die Groessenordnung
war auch dann noch zu klein.

**Die Vorpruefung bleibt drin und ist richtig platziert.** Mein Fehler von
03:46 kam nicht durch den Fuenftel-Test - 2,703 Milliarden lagen unter einem
Fuenftel von 28,9 Milliarden. Genau diese Luecke schliesst sie. Dass sie in
BitNode 6 nie zum Zuge kommt, liegt am Softcap, nicht an ihr.

**Der Punkt wandert damit nach Erledigt** - nicht weil die Pruefung gemessen
waere, sondern weil die Ursache eine andere ist als gedacht und der Auftrag
damit beantwortet.


### Die Gegenmittel gegen leere Vertragsvorraete sind eingebaut (27.08., 00:50)

**Verifiziert: kein einziger Training-Abschnitt in 483 gemessenen Abschnitten
ueber 464 Minuten** (`tools/ratencheck.js`, 00:48). Genau das war das Symptom,
das den Punkt ausgeloest hat - zweimal am 25.08. fiel der Motor auf
"General/Training" durch, weil keine Aktion ueber der Schwelle lag.

Beide geforderten Werkzeuge stehen in `blade.js`:
- **Diplomacy** seit 26.08., 15:26 (`SPIEL_CHAOS_AN`, `CHAOS_EIN 50`,
  `blade.js:93-95,692`) - schaltet ein, sobald das Chaos die Schwelle des
  Spiels ueberschreitet, ab der alle Chancen mit `sqrt(1 + chaos - 50)`
  faellt.
- **Incite Violence** seit 26.08., 10:49 (`blade.js:872`, Grund
  "Vertragsvorrat leer").

**Der ehrliche Rest: Incite Violence hat nie ausgeloest** und ist am 26.08. um
18:55 in HEBEL.md als heute schaedlich eingetragen worden - der Block greift
nur unter Chaos 25, und Incite selbst hebt das Chaos um 10 plus
`chaos/log10(chaos)`. Er bleibt stehen, weil er in einem Knoten mit niedrigem
Chaos richtig ist.

**Warum das Symptom trotzdem verschwunden ist:** Nicht durch die Gegenmittel,
sondern weil die Chancen gestiegen sind. Gemessen 00:47: Tracking ist mit 0,6
offenen Auftraegen weiterhin leergespielt, aber Bounty Hunter hat **686,5** und
Retirement **493,0**, und ihre Chancen liegen bei 0,462 und 0,546 - beide ueber
`SICHER_VERTRAG` 0,45. Der Faehigkeitsumbau vom 18:52 hat den Punkt praktisch
miterledigt.

**Was das fuer den naechsten Einbau heisst:** Fallen die Kampfwerte wieder auf
1, rutschen die Chancen unter die Schwelle, und dann traegt allein der
Notvertrag-Zweig ("Vertrag unter Schwelle, lohnt trotzdem"). Der ist seit dem
25.08. drin und hat am 26.08. gehalten - der Motor fuhr Bounty Hunter mit 0,308
statt in Training zu fallen.

### Die Erwartungswerte des Pruefers rechnen jetzt mit rankGain und Dauer (27.08., 00:20)

**Verifiziert: `URTEIL: SPUR` unveraendert nach dem Umbau um 00:20**, und die
Formel trifft die Messung. Retirement, Stufe 21, Chance 0,647, Dauer 26 s:
`0,6 * 1,065^20 * 0,647 / 0,4333 min` = **3,19** gegen gemessene **2,938** -
eine Abweichung von 8 Prozent, gedeckt durch Rangverluste bei Misserfolgen und
die Zufallsstreuung `addOffset(gain, 10)`.

Der Punkt lief seit dem 25.08. und hatte zwei Fehlalarme zur Ursache. Er ist in
mehreren Schritten abgearbeitet worden; die letzten beiden:

**1. Die Pauschale 1,7 war zufaellig Bounty Hunter.** Gegen 406 gemessene
Abschnitte (`ratencheck.js`, 26.08. 23:18):

    Aktion                    gemessen   Pauschale   rankGain/Dauer
    Contracts/Tracking           3,438       5,45           3,21
    Contracts/Retirement         2,938       3,91           3,19
    Contracts/Bounty Hunter      2,279       2,50           2,48

`rankGain` ist 0,3 / 0,9 / 0,6 (`data/Contracts.ts:19,53,86`), die Dauer
18 / 32 / 26 Sekunden. 1,7 entspricht ungefaehr `0,9 / 0,53 min` - genau
Bounty Hunter, und bei Tracking 59 Prozent daneben.

**2. Umgesetzt in zwei Laeufen, eine Datei je Lauf.** Erst meldet `blade.js`
die Aktionsdauer aus `getActionTime` mit (26.08., 23:30; verifiziert
`"stufe":21,"dauer":26000`), dann rechnet `sollRate()` damit
(27.08., 00:20). Fehlt die Dauer - aeltere `blade.js` -, bleibt die Pauschale
als Rueckfall stehen, damit ein Versionsunterschied keinen Fehlalarm ausloest.
Operationen sind mitgenommen: rankGain 2,2 bis 55 aus `data/Operations.ts`.

**Was offen bleibt und anderswo steht:** Der urspruengliche Plan - die Raten
selbstkalibrierend aus dem eigenen Verlauf ableiten - ist am 26.08. um 02:15
widerlegt worden (die Aufloesung des Messverlaufs ordnet den Zuwachs der
Aktion zu, die zufaellig zum Messpunkt lief). Stattdessen ist die Formel jetzt
richtig, und `ratencheck.js` liefert die Gegenprobe aus echten Abschnitten.

### Das Springen zwischen Vertraegen ist kein Fehler - Hysterese widerlegt (26.08., 23:50)

**Verifiziert: 1,58 Rang je Minute gegen 1,76 vorher**, gemessen ueber 48
Minuten aus `data/wache-zustand.json` (1364 um 22:55 auf 1440 um 23:45).
Erwartet waren gut 6 Prozent mehr; gemessen sind **10 Prozent weniger**. Die
Aenderung ist um 23:50 zurueckgenommen.

Der Punkt kam aus der Messung vom 14:44: 43 Wechsel zwischen Vertraegen
verwerfen 160 von 1.983 Sekunden, weil jeder Wechsel `actionTimeCurrent` auf
0 setzt (`Bladeburner.ts:187`). Das Vormessen um 22:45 bestaetigte auch den
Grund fuer das Springen - der Abstand zwischen den beiden besten Vertraegen
liegt bei 11 Prozent, die Schaetzunsicherheit bei Bounty Hunter dagegen bei
41 Prozent relativ (min 0,508, max 0,862).

Eingebaut war daraufhin eine Hysterese auf der ZEIT: Ein Durchlauf, der zu
mehr als einem Viertel gelaufen war, wurde zu Ende gefahren.

**Der Denkfehler - und er ist der eigentliche Ertrag dieses Punktes:** Der
Ertragsunterschied zwischen den Aktionen ist groesser als die verworfene
Zeit. Gemessen ueber 406 Abschnitte (`ratencheck.js`, 23:18) bringt Tracking
**3,438** Rang je Arbeitsminute, Bounty Hunter **2,279** - **51 Prozent**
Unterschied. Wer einen Wechsel um bis zu drei Viertel eines Durchlaufs
aufschiebt, sitzt genau so lange auf der schlechteren Aktion. Die 8 Prozent
verworfene Zeit sind billiger als das.

**Damit ist das Springen als richtig erwiesen**, nicht nur als hinnehmbar: Es
ist die Antwort auf schwankende Schaetzungen, und jede Verzoegerung kostet
mehr, als sie spart. Der Kommentarblock in `blade.js` haelt das fest, damit
niemand dieselbe Hysterese ein zweites Mal einbaut.

### Der Kammeranteil ist geklaert - er ist Zyklusgeometrie (26.08., 22:15)

**Verifiziert: Kammeranteil 67 Prozent, gerechnet und im Spiel bestaetigt um
21:45.** Fuenf Stichproben im 15-Sekunden-Takt zeigten den vollstaendigen
Zyklus: zwei Kammerproben bei 37 und 38 von 68, dann drei Arbeitsproben bei
39, 38, 37.

Der Punkt lief seit dem 26.08. frueh unter dem Titel "die Rechnung erklaert
nur zwei Drittel davon". Sie erklaert jetzt alles:

- Das Ruheband ist `AUSDAUER_RUHE 0,51` bis `AUSDAUER_WEITER 0,56`
  (`blade.js:150`), bei Hoechstausdauer 68 also **3,4 Punkte breit**.
- Eine Vertragsaktion kostet rund 1,4 Ausdauer - **zwei bis drei Aktionen**,
  dann ist das Band durchlaufen.
- Regeneration 2,3 je Minute: **1,5 Minuten Auffuellen gegen 45 Sekunden
  Arbeit** = 67 Prozent Kammeranteil.

Damit ist auch die "Luecke" zwischen gerechneter Zyklusrate und gemessener
Rangrate erklaert - `bbspann` unterstellt einen hoeheren Arbeitsanteil.

**Drei Griffe sind geprueft und verworfen**, jeder mit Zahl:
1. *Bandbreite aendern* - am 07:46 versucht, widerlegt: Die Spanne ist
   symmetrisch, der Kammeranteil stieg von 50,1 auf 60,7 Prozent (HEBEL.md).
2. *Chancenschaetzung als Ursache* - widerlegt um 17:50: `popEst/pop` liegt
   bei 0,835, die Schaetzung ist pessimistisch, nicht optimistisch.
3. *Tab-Drosselung* - widerlegt um 17:50: Wanduhr 1.789.027 ms gegen
   Spielzeit 1.789.000 ms.

**Der bleibende Satz:** Der Kammeranteil ist **strukturell**. Er faellt nur
ueber das Verhaeltnis Regeneration zu Verbrauch je Minute, nicht ueber
Umsortieren, Schwellen oder Auswahllogik. Der wirksame Weg fuehrt am
Kammeranteil vorbei - **Ertrag JE Aktion heben**, und genau das tut der
Faehigkeitsplan seit 18:52.

Der einzige noch behebbare Rest - die Wechsel zwischen Vertraegen - steht als
eigener Punkt unter `## Offen`.

### Der Waechter meldet fehlenden Speicher als Ausfall (26.08., 20:50)

**Verifiziert: Waechter laeuft mit der neuen Pruefung seit 20:47:22** (PID
14576, Sperrdatei des Vorgaengers uebernommen, erste Runde ohne Fehler).

Ausgeloest von einem Fehlalarm um 17:45:33: Stufe 2, "bn4rep.js meldet sich
seit 63 min nicht mehr". Der Grund war Speicher, nicht Absturz - die Werkbank
`werk-0` hatte 512 GB, `bn4rep.js` braucht 768,3.

**Die Ursache war ein Test am falschen Rechner.** `tools/wache.js:462` prueft
`homeRam <= 128` - der Kaltstart-Test aus der Zeit, als die Werkbank noch home
war. Er greift heute nie, weil home 2048 GB hat, waehrend die Werkbank ein
gekaufter Rechner ist.

**Nicht stumm geschaltet, sondern unterschieden** - nach Erics Einwand vom
26.08., 17:52: *"kann Letzteres nicht auch ein Fehler sein?"* Er hat recht:
Kein Platz IST ein Fehler, wenn Geld fuer einen Ausbau da ist. Deshalb:

- Neue Funktion `groessterRechnerGb()` liest den groessten Rechner ausser home
  aus dem Spielstand - **nur im Verdachtsfall**, denn der Save ist mehrere
  Megabyte gross und der Waechter laeuft alle drei Minuten.
- Die Meldung nennt jetzt den Grund: "bn4rep.js hat keinen Platz: groesste
  Maschine 512 GB, gebraucht 768,3 GB. Guthaben 6713m - Ausbau pruefen."
- Sie **eskaliert nicht** (`keineEskalation`): einmal melden, dann Ruhe. Ein
  Alarm, der sich alle zwanzig Minuten wiederholt, entwertet den Kanal.

**Die zwei Nebenbaustellen dieses Punktes sind ebenfalls erledigt:** Der
Sync-Verdacht war ein eigener Lesefehler (im Spiel fehlt das `src/`-Praefix),
und `wbgrow.js` startete nicht, weil drei ns-Funktionen in Bitburner 3.0.0
entfernt sind. Beides steht in eigenen Eintraegen weiter unten.

### Der Faehigkeitsplan kaufte die teuerste Stufe im Feld statt der billigsten Wirkung (26.08., 18:52)

**Verifiziert: Bounty-Hunter-Chance 0,322 -> 0,348 um 18:52**, nach einem
einzigen Kauf fuer 2 Punkte. Tracer stieg von Stufe 0 auf 1, die offenen
Punkte fielen von 21 auf 1.

Eingetragen um 18:37 als "21 Faehigkeitspunkte liegen ungenutzt herum". Der
Verdacht lautete "SKILL_PLAN haengt an einem Deckel" - falsch. Der Motor
sparte voellig korrekt, nur auf das Falscheste im Feld.

**Der Fehler liegt in der Kostenformel, die niemand nachgesehen hatte.** Die
Kosten sind **linear**, nicht exponentiell:
`(baseCost + level * costInc) * mult` (`Bladeburner/Skill.ts:37-41`). Gemessen
18:45 aus `data/bbspann.json`, Nutzen je Punkt bei der jeweiligen Stufe:

    Faehigkeit          Stufe  Preis  Wirkung           je Punkt
    Short-Circuit           0      2  +5,5% Retirement     2,75
    Tracer                  0      2  +4%   Contracts      2,00
    Evasive System          0      2  +4%   dex/agi        2,00
    Reaper                  0      2  +2%   Kampfwerte     1,00
    Digital Observer        1      4  +4%   Operations     0,98
    Blade's Intuition      10     24  +3%   alles          0,125  <- wurde gekauft

Blade's Intuition stand auf Platz 2 mit `Infinity` und frass damit jeden
Punkt, waehrend sechs Faehigkeiten auf Stufe 0 lagen, die je Punkt das
**Sechzehn- bis Zweiundzwanzigfache** liefern.

**Die Deckel sind gerechnet, nicht geraten.** Blade's Intuition liefert bei
Stufe n `3/(3+2,1n)`, Tracer bei Stufe m `4/(2+2,1m)`; gleich sind sie bei
`m = (6 + 8,4n)/6,3`, fuer n=10 also m = 14,3. Neue Reihenfolge: Cyber's Edge
5, **Tracer 14, Short-Circuit 12, Evasive System 12, Reaper 8**, dann Blade's
Intuition, Digital Observer, Cloak, Overclock 90.

**Lehre: Eine Prioritaetenliste ohne Preise ist eine Vermutung.** Der Plan
wurde am 25.08. um 17:20 schon einmal repariert ("kaufte das Billigste statt
des Wichtigsten") - und dabei ins andere Extrem gedreht. Richtig ist keins von
beidem, sondern **Wirkung je Punkt**, und die haengt an der Stufe.

### Raid ist verworfen - Charisma 27 macht ihn zum Verlustgeschaeft (26.08., 17:20)

**Verifiziert: Charisma 27 um 17:15**, gemessen aus dem Spielstand
(`tools/save.js`-Ladeweg, `p.skills.charisma`), 409 Erfahrung,
`mults.charisma` 1,557.

Der Punkt stand seit 16:05 unter `## Sofort` und verlangte eine 30-Minuten-
Messung mit einer Zielrate von 2,5. Diese Messung findet nicht statt, weil die
Rechnung sie vorwegnimmt - und das ist ein Ergebnis, kein Ausweichen.

Raid erzeugt selbst das Chaos, das ihn ausbremst
(`city.changeChaosByPercentage(getRandomIntInclusive(1, 5))` je Durchlauf,
unabhaengig von Erfolg, `Bladeburner.ts:846`): im Mittel **+3,21 Prozent je
Minute**. Dagegen haelt nur Diplomacy, und deren Wirkung haengt allein am
Charisma (`charisma^0,045 + charisma/1000` Prozent je Minute,
`Bladeburner.ts:737-745`). Beides ist prozentual, das Verhaeltnis damit
chaos-unabhaengig, und der Raid-Anteil im Gleichgewicht betraegt
`D / (D + 3,21)`.

    Charisma   noetige Exp   D/min   Anteil   effektive Zyklusrate
          27    3,6 x 10^2   1,187    27,0%                  1,02  <- ist
         100    3,3 x 10^3   1,330    29,3%                  1,11
         300    2,1 x 10^5   1,593    33,2%                  1,26
         440    3,5 x 10^6   1,755    35,3%                  1,34  <- gleichstand
       1.200    1,5 x 10^13  2,576    44,5%                  1,69

Tracking liefert **1,339**. Raid liegt bei **1,02** - er ist nicht nur nicht
besser, er ist ein Drittel schlechter, und dazu kaemen rund 37 Millionen je
Minute an Krankenhausrechnungen.

**Damit ist auch der Charisma-Hebel erledigt**, der um 16:50 als eigener
Offen-Punkt eingetragen wurde. Der Gleichstand kaeme bei Charisma 440, wofuer
3,5 Millionen Erfahrung noetig sind - das 8.700-fache des Vorhandenen. Bei
geschaetzten 20 Erfahrung je Sekunde am Leadership-Kurs sind das rund 49
Stunden ohne Rangzuwachs; dieselben 49 Stunden Tracking bringen rund 3.900
Rang, mehr als die 1.592 bis Operation Typhoon. **Charisma-Training ist strikt
schlechter.** Die Erfahrungskurve `exp = e^((lvl/mult + 200)/32) - 534,6`
(`PersonObjects/formulas/skill.ts:17-19`) macht jede dreistellige Zielmarke
teuer und jede vierstellige unerreichbar.

**Geaendert:** `RAID_AN = false` in `src/blade.js`. Bedingungslogik und
Charisma-Schwelle bleiben stehen - ein spaeterer Knoten kann mit hohem
Charisma starten, dann genuegt `true`.

**Was die Episode gekostet hat:** Die Erwartung "Faktor 3,4" stand seit 13:22
in dieser Datei und hat vier Loop-Laeufe lang als groesster offener Hebel
gegolten. Sie war brutto gerechnet - ohne die Gegenkraft, die die Aktion
selbst erzeugt. **Lehre: Wenn eine Aktion einen Zustand veraendert, gehoert
die Rueckwirkung dieses Zustands in dieselbe Rechnung**, sonst misst man den
ersten Zug eines Regelkreises und haelt ihn fuer den Dauerzustand.

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
