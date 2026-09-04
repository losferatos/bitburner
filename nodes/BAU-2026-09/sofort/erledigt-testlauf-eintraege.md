### Autosave steht

**Eintrag der TEST-Instanz, nicht des Live-Spiels. Behoben 04.09.2026 02:32.**

Beim Gate-A2-Nachweis wurde eine Testkopie des Spielstands in die Pruefinstanz
auf `localhost:8799` geladen. Deren Bruecke schrieb zwei Meldungen - beide in der
Sache richtig FUER DIE KOPIE - und trug sie in diese Liste ein, also in die
Liste, an der Eric seine echte Arbeit ablesen soll.

Zwei Ursachen, beide behoben:

1. **Die TEST-Rolle durfte ueberhaupt in `## Sofort` schreiben.** Jetzt schreibt
   nur noch die LIVE-Rolle dorthin; TEST legt seine Meldungen unter
   `pruefstand/data/sofort-test.md` ab. Eine Liste, in der Testlaufmeldungen
   stehen, wird nach dem dritten Mal nicht mehr gelesen - damit waere der einzige
   Kanal vom Spiel zu Eric unbrauchbar, und zwar durch die Bauarbeit selbst, die
   ihn schuetzen soll.

2. **Das Urteil "Autosave steht" feuerte sofort nach dem Laden.** Eine frisch
   geladene Instanz traegt das `lastSave` aus ihrem Spielstand, beim Klon 56
   Minuten alt. Das Spiel speichert aber binnen 60 Sekunden von selbst. Jetzt
   urteilt die Bruecke erst, wenn die Verbindung zehn Minuten steht - in einer
   Reload-Schleife waere daraus sonst Dauerfeuer geworden.

Der Live-Spielstand war zu keinem Zeitpunkt betroffen. Die Live-Bruecke zeigte
waehrend des gesamten Vorgangs keine zweite Verbindung und keinen Alarm.
