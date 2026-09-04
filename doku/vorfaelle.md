# Vorfälle

Was schiefging, warum, und woran man es beim nächsten Mal erkennt. Die
Einträge stammen aus den Begründungskommentaren im Code — dieses Dokument
sammelt sie, damit man sie lesen kann, ohne den Motor zu lesen.

Jeder Eintrag nennt die **Fehlerklasse**, nicht nur den Fehler. Ein einzelner
behobener Bug ist Geschichte; eine Fehlerklasse wiederholt sich.

---

## Die Datei, die niemand schreibt

**Fehlerklasse: ein Kanal ohne Schreiber sieht aus wie ein Kanal.**

Mehrfach aufgetreten, zuletzt am 04.09.2026 gleich vierfach:

- `shop.js` verlangte als Vorbedingung `data/buy-request.json`. Niemand schrieb
  sie. Der Serverkauf war vollständig tot — in einem Bot, dessen erste
  Kaufentscheidung über Stunden entscheidet.
- Acht Registry-Einträge nannten eine `telemetryFile`, die ihr Gewerk nie
  schrieb. Der Kern beendet ein Werkzeug, dessen Telemetrie zu alt ist, und ohne
  Schreiber gilt „seit dem Start" als Alter: er wäre zum Totengräber seiner
  eigenen Werkzeuge geworden, im Takt der Frischefrist.
- `data/guard-modus.txt` hatte keinen Schreiber. Der Wächter fiel in jeder Runde
  auf `observe` zurück — die ganze Strafleiter protokollierte nur, während der
  Commit-Betreff „die Strafleiter ist scharf" lautete.
- Die Ereignisarten `jump`, `install`, `boot` und `penalty` schrieb niemand.
  Drei Abnahmekennzahlen waren damit nicht „noch nicht gemessen", sondern
  **unmessbar** — sie sind Abstände zwischen Ereignissen und aus Telemetrie
  prinzipiell nicht rekonstruierbar.

**Woran man es erkennt:** `grep` über beide Bäume nach dem Dateinamen. Kommt er
nur an einer Stelle vor, ist entweder der Schreiber oder der Leser nicht da.

**Was daraus gebaut wurde:** `tools/registry-bauen.js` lehnt eine Registry ab,
deren `telemetryFile` im Quelltext des Gewerks nicht geschrieben wird, deren
Vorbedingung keine geschriebene Datei nennt, deren `needsLibs` die Importe nicht
deckt, oder die ein Feld enthält, das weder als steuernd (mit benanntem Leser)
noch als beschreibend eingeordnet ist.

---

## Das Feld, das niemand liest

**Fehlerklasse: Dokumentation, die aussieht wie Steuerung.**

Sechs Registry-Felder hatten keinen Leser: `hostRule`, `scpToHome`,
`restartPolicy`, `maxInstances`, `evictRank`, `needsFigure`. Wer `hostRule:
"home"` einträgt, glaubt danach, das Gewerk laufe auf home — gemessen lief
`darkweb.js` auf `joesguns` und `foodnstuff`.

`needsLibs` war der teuerste davon: der Kern kopierte auf einen Fremdrechner nur
`lib/hackaugs.js`. `graftauto.js` braucht `lib/graftwahl.js` und
`lib/figurns.js`, `contracts.js` braucht `lib/loeser.js`. Auf einem frisch
gekauften Rechner liegt nichts davon, und `ns.exec` gibt bei nicht
übersetzbarem Skript **still 0** zurück.

**Was daraus gebaut wurde:** jedes Feld ist jetzt entweder STEUERND (mit
benanntem Leser, dessen Vorhandensein der Generator prüft) oder BESCHREIBEND
(mit Begründung, warum kein Leser nötig ist). Ein Feld ohne Zuordnung ist ein
Fehler.

---

## Die Uhr, in der die Frist nie abläuft

**Fehlerklasse: eine Frist in der Uhr des Dings, das sie überwachen soll.**

- **20.08.2026, fünf Stunden Stillstand.** Ein Rückfall verfehlte seine
  Abschlussbedingung um **eine Sekunde**, jedes Mal, unendlich oft — der eigene
  Takt stand auf 60 s, die fremde Bedingung griff bei 61 s.
- **04.09.2026.** Signal S1 maß `motorTimeMs`, und die schreibt nur der Kern.
  Für jedes andere Werkzeug war das Alter „seit dem Start" — S1 hätte für alle
  gefeuert, für immer.
- **04.09.2026.** S4 (verdeckter Tab) und S5 (Brücke weg) speisten die Leiter.
  Ein verdeckter Tab liefert belegt genau einen Timer-Aufruf je Minute; jede
  Nacht wäre damit ein garantierter EXHAUSTED-Zustand gewesen — und
  Abnahmestufe B verlangt ausdrücklich eine Nacht mit verdecktem Tab.

**Woran man es erkennt:** Vor jeder Frist die Frage „welche Uhr, und läuft sie
noch, wenn das Überwachte hängt?". Der Bezeichner trägt die Uhr:
`waitWatchdogMs`, `waitEngineMs`, `waitMotorMs`.

---

## Der Zustand, der einen Reset überlebt

**Fehlerklasse: Textdateien auf home überleben beides, der Spielzustand nicht.**

`prestigeHomeComputer` leert die Programmliste und legt nur NUKE zurück
(`Server/ServerHelpers.ts:224-234`), und es wird von **beiden** Prestiges
gerufen. `prestigeAugmentation` löscht zusätzlich alle gekauften Rechner
(`Prestige.ts:55-75`, `PlayerObjectGeneralMethods.ts:109`). Textdateien auf home
überleben dagegen alles.

Daraus vier Vorfälle:

- `data/portknacker-komplett.txt` überlebte, die Portknacker nicht. `darkweb.js`
  wäre nach dem ersten vollständigen Satz in **allen rund vierzig Restläufen**
  nie wieder gelaufen — und es ist die einzige kaltstartfähige Knackerquelle.
  Genau dieser Zirkel hat am 25.08. dreizehneinhalb Stunden gekostet.
- `data/preise.json` beschrieb einen Rechnerpark, den es nach dem Einbau nicht
  mehr gab: vier bis fünf Minuten Geisterpark, in denen der Kern die
  Kaltstart-Leiter übersprang.
- Ein auf Geld wartender Kaufauftrag überlebte den Einbau und wurde danach
  ausgeführt — mit dem Geld der neuen Startlage (nach `installAugmentations`
  sind es 1.262 Dollar).
- Eine Wirtsperre auf `werk-0` hätte im neuen Lauf einen **anderen** Rechner
  desselben Namens getroffen, und zwar den einzigen, den es dort gibt.

**Woran man es erkennt:** Bei jeder neuen Datei unter `data/` die Frage „gilt
sie nach einem Reset noch?". Wenn nein, gehört sie in eine Räumliste in
`boot.js` — und die Unterscheidung zwischen „nach jedem Reset" und „nur nach
einem Knotenwechsel" ist eine eigene Entscheidung.

---

## Der Fernbefehl aus der Zeit davor

**25.08.2026, 05:59.** `boot.js` startete den Kern, der Kern las in seiner
ersten Runde einen zehn Minuten alten Befehl `WERKZEUG bn4net.js` aus
`data/reload.txt`, beendete sich selbst und war wieder weg. Aus dem Protokoll
sah der Start erfolgreich aus.

**Fehlerklasse: ein Befehl ohne Verfallszeit.** Jeder Fernbefehl aus der Zeit
vor dem Wiederanlauf ist veraltet. Deshalb hat auch der Wächterauftrag für
Sprosse 5 einen Verfall von 15 Minuten.

---

## Die stille Ausnahme

**Fehlerklasse: `catch { }` verbirgt einen Fehler, der nie auffällt.**

Am 04.09.2026 im frisch gebauten Abschnitt 9c des Kerns: `freiAuf` war außerhalb
seines Blocks benutzt, das `try/catch` um den Abschnitt schluckte den
ReferenceError, und der ganze Zweig lief nie — ohne eine Zeile irgendwo.
Gefunden hat es der Test, der genau für diesen Abschnitt geschrieben wurde,
nicht das Lesen.

Dasselbe Muster, andere Stelle: `cdump.js` starb an einem BigInt, sobald ein
Square-Root-Vertrag im Netz lag (`JSON.stringify` wirft darauf, ungefangen,
mitten in `main`). Weder `cdump.json` noch `cantwort.json` wären geschrieben
worden, die Rotation rückte nie vor, und der Kern startete das Gewerk alle fünf
Minuten neu, wo es wieder starb. Die einzige Geldquelle des Kaltstarts wäre
dauerhaft tot gewesen. Die fehlende Zeile war ein Ersetzer, der beim Herauslösen
der Löser verlorenging und beim Lesen wie Kosmetik aussieht.

**Woran man es erkennt:** Ein `catch`, das gar nichts tut, braucht einen
Kommentar, der sagt, welcher Fehler hier erwartet wird. Alles andere gehört
gemeldet — und sei es nur alle zehn Runden.

---

## Die Probe, die sich selbst prüft

**Fehlerklasse: Tautologie im Prüfcode.**

Zwanzig der dreißig Vertragslöser hatten ein `verify`, das `solve(data) ===
answer` lautete. Es besteht genau dann, wenn `solve` sich selbst gleicht, und
fängt nichts. Der Kopfkommentar von `cdump.js` begründete die Autonomie aber
genau damit („jede Antwort wird gegengeprüft") — und ein Vertragsversuch ist
unwiederbringlich.

**Woran man es erkennt:** Eine Probe ist nur dann eine, wenn es eine Eingabe
gibt, bei der sie fehlschlägt. Bei Prüfcode lohnt der Blick auf den Quelltext:
ruft die Probe die Funktion auf, die sie prüfen soll?

Bemerkenswert: Beim Ersetzen der zwanzig Tautologien entstanden **fünf neue
Fehler**, und alle fünf fand derselbe Test, der sie prüfbar machte. Unter
anderem lehnte die neue Probe für „Find Largest Prime Factor" die Eingabe 512 ab
(Antwort 2 — die Faktoren müssen bis **einschließlich** der Antwort
herausdividiert werden).

---

## Die Prüfung, die ihren Gegenstand nicht sehen kann

**04.09.2026.** Das frisch gebaute `tools/hotswap.js` las den offenen Ausgang,
ein laufendes Graft und die Einbausperre aus `state.telemetry` der Brücke. Das
ist aber keine Tabelle aller Telemetriedateien, sondern der Inhalt von
`data/bn4net.json` — der Kern und sonst nichts. Alle drei Abfragen kamen immer
`null` zurück, und zwei davon schlossen daraus „in Ordnung".

**Fehlerklasse: ein Negativbefund ist nur gültig, wenn das benutzte Werkzeug den
ausgeschlossenen Fall überhaupt anzeigen könnte.** Dieselbe Klasse wie am
30.08., als ein Ausfall „ausgeschlossen" wurde, weil ein Werkzeug kein Defizit
meldete — es konnte konstruktionsbedingt keines melden.

---

## Die Prioritätsinversion

**Fehlerklasse: „passt nicht, also überspringen" verschiebt den Platz nach
hinten.**

Im Kaltstart passte `cdump.js` (12,65 GB) nicht auf das frisch zurückgesetzte
home. Es wurde übersprungen, und die billigen Hilfsgewerke dahinter belegten
den Rest. Gemessen fand **keine** der drei Geldquellen des Kaltstarts je Platz:
der Bot stand mit vollem Speicher da und verdiente nichts — in genau der Phase,
in der Geld alles ist.

**Die Lösung ist eine Reservierung mit Verfall.** Ohne Verfall wäre sie eine
Blockade: bräuchte ein Eintrag mehr, als home je hergibt, stünde der ganze Rest
für immer. Fünf Minuten Wanduhr, dann wird übersprungen und die Frist beginnt
beim nächsten Anlauf von vorn.
