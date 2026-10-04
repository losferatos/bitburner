/**
 * Die Gang - in BN2 eine Kampfgang gruenden und fuehren (Audit 03.10.2026,
 * GANG-1; Betriebsgegenpruefung `nodes/audit-2026-10-03/verify-g01-betrieb.md`,
 * Paket 2).
 *
 * ===========================================================================
 * WARUM ES DIESE DATEI GIBT
 * ===========================================================================
 *
 * In BN2 ist Ruf der Engpass, nicht Geld: Passivruf 0, Arbeitsruf x0,5
 * (`BitNode.tsx` case 2), und im V2 gibt es keine Faktionsarbeit. Die Gang ist
 * der einzige Rufkanal ohne Spielerzeit: `Gang/Gang.ts:144-155` schreibt
 * `faction_rep * respekt * (1 + favor/100) / 75` auf die Gang-Faktion, und die
 * verkauft in BN2 alle 36 nicht-speziellen Kampf-Augs
 * (`Faction/FactionHelpers.tsx:172-200`), die der Bot im V2 sonst nie
 * erreicht. Der Zugang ist in BN2 frei von der Karmaschwelle
 * (`PersonObjects/Player/PlayerObjectGangMethods.ts:16-17`).
 *
 * Gerechnet ist die Rufkurve in `tools/audit/gang-sim.mjs` (Einzelformeln
 * 86.360-fach gegen den Originalquelltext, Dynamik damals UNGEEICHT - es gab in
 * keinem Backup eine echte Gang; seit 04.10.2026 ist sie an der echten Gang
 * geeicht, siehe OFFENE PUNKTE): Kampfgang mit diesem Regler erreicht
 * 1,25 Mio Faktionsruf nach 8,6 h, 2,5 Mio nach 11,7 h. Gegenprobe der
 * Reglerwahl (03.10.2026, `gang-sim.mjs --trainset "Train Combat"`): nur
 * 'Train Combat' statt der gierigen Wahl aus drei Trainingsaufgaben liegt bei
 * 8,55 h gegen 8,59 h bis 1,25 Mio - gleichwertig, deshalb die einfache
 * Fassung.
 *
 * ===========================================================================
 * WAS DIESE DATEI NICHT TUT (und warum)
 * ===========================================================================
 *
 * - NIE `setTerritoryWarfare(true)`. Ohne Warfare bleibt `territoryClashChance`
 *   0 (`Gang/Gang.ts:210-216`), die eigene Gang wird in keinem Clash gezogen,
 *   und Mitglieder sterben nur in der Aufgabe "Territory Warfare"
 *   (`Gang.ts:281-303`). Die Sim-Annahme "Territorium fest 1/7" ist damit
 *   exakt. Tote Mitglieder kosten 5 % des Gesamtrespekts plus ihren eigenen.
 *   Territorium bleibt AUS, und zwar nicht mehr aus Vorsicht, sondern aus
 *   Rechnung (verify-p2b-gang.md Abschnitt 5, S2): Territorium vervielfacht das
 *   Gang-GELD (x2 bis x3,3), aber der Wert der Torrunde saettigt am Preisfaktor
 *   1,9 je wartendem Stueck - "G noetig" sinkt von 1,08 (Geld + Ausruestung) nur
 *   auf 0,92, und eine Verdopplung des Budgets bringt ab ~12 Stuecken noch ~10 %
 *   Competence. Dagegen stehen eine Kriegsabteilung, die den ganzen Tag nichts
 *   verdient, `getChanceToWinClash` (4 GB), Abbruchregeln und im Schlimmsten Fall
 *   ein toter Kaempfer (5 % des Gesamtrespekts). Nicht bauen; erst nach dem
 *   Geldmodus und nur, wenn sich "G noetig" als zu klein erweist.
 * - KEINE Ausruestung AUSSER im Geldmodus (siehe DER GELDMODUS). Hier stand
 *   "sie kostet Geld, das die Spieler-Augs brauchen (Befund GANG-1)". Das ist
 *   durch verify-p2b-gang.md widerlegt: der volle Satz Waffen/Ruestung/Fahrzeuge/
 *   Rootkits fuer alle zwoelf kostet 2,08 Mrd (Rabatt 5,6 bei 22 Mio Respekt), hebt
 *   das Gang-Geld um x1,81 bis x1,83 und amortisiert sich in 9-15 min. Mitglieder-
 *   Augmentierungen (Typ Augmentation) werden NIE gekauft: 306 Mrd Ausgabe fuer
 *   +0,14 ln Competence.
 * - KEIN Kauf von Spieler-Augs und keine Einbau-Entscheidung. Das ist
 *   Sache von bn4rep.js (Paket 0 UND Paket 1): erst wenn dort die TRP-Falle
 *   geschlossen ist (Paket 0, GANG-2) UND der Kauf bis zum Tor aufgeschoben
 *   wird (Paket 1, AUG-4), darf die Gang gegruendet werden. Beides prueft
 *   gang.js MASCHINELL vor `createGang` (Abschnitt DIE VORAUSSETZUNGSSPERRE).
 *
 * ===========================================================================
 * DER SCHALTER
 * ===========================================================================
 *
 * `data/gang-an.txt` liegt NICHT im Repo. Die Registry fuehrt ihn als
 * Vorbedingung (`requiresFile`), der Kern startet gang.js also nur, wenn er
 * auf home liegt. Zusaetzlich prueft gang.js ihn in JEDER Runde selbst: der
 * Kern beendet ein laufendes Werkzeug nicht, wenn die Vorbedingung nachtraeglich
 * wegfaellt, und "Datei loeschen = Gang-Steuerung aus" soll auch fuer eine
 * laufende Instanz gelten. Die Gang selbst laeuft danach mit den zuletzt
 * gesetzten Aufgaben weiter (Wanted waechst dann unkontrolliert - der Schalter
 * ist eine Notbremse fuer die Steuerung, kein Gang-Stopp).
 *
 * Der Schalter allein genuegt NICHT als Schutz: er haengt an einem Handgriff,
 * und die Gruendung (wie jeder spaetere TRP-Kauf) ist bis zum Knotenende nicht
 * rueckgaengig zu machen. Deshalb die Sperre darunter.
 *
 * ===========================================================================
 * DIE VORAUSSETZUNGSSPERRE (Skeptiker-Auflage 1, 03.10.2026)
 * ===========================================================================
 *
 * Ohne Paket 1 kauft die Kaufschleife von bn4rep.js jedes Gang-Stueck sofort,
 * sobald sein Ruf erreicht ist (Neurotrainer I bei 1.000 Ruf, Wired Reflexes
 * bei 1.250 ...), und jedes Stueck macht die folgenden um den Faktor 1,9
 * teurer: Zyklus 1 bringt dann x1,24 statt x2,6 bis x3,9
 * (verify-g01-betrieb.md Abschnitt 2). Ohne Paket 0 kauft sie in der Runde, in
 * der der Gang-Ruf 2,5 Mio erreicht, The Red Pill - nicht umkehrbar und mit
 * Dauersperre jedes weiteren Einbaus. Die harte Reihenfolge "P0 und P1 vor P2"
 * stand bisher nur auf Papier; jetzt prueft gang.js sie selbst.
 *
 * Vor JEDEM `createGang` liest foundGang() `data/bn4rep.json` (Telemetrie von
 * bn4rep.js) und gruendet nur, wenn ALLES zutrifft (`checkPrereq`, rein und
 * getestet):
 *
 *   1. die Datei ist lesbar und juenger als PREREQ_MAX_AGE_MS (30 min = die
 *      Frist des bn4rep-Eintrags in der Registry): bn4rep.js lebt;
 *   2. sie gehoert zu DIESEM Knoteneintritt: `knoten` UND `nodeReset` gleich
 *      `getResetInfo().currentNode/lastNodeReset` (die Nummer allein trennt
 *      Level 1 von Level 2 desselben Knotens nicht);
 *   3. PAKET 0 live: das Feld `v1Positiv` (PREREQ_P0_FIELD) ist ein Boolean
 *      UND false. Das Feld schreibt nur die neue bn4rep.js - ein noch
 *      laufender alter Prozess schreibt es nicht, auch wenn die Datei auf der
 *      Platte schon neu ist. `true` hiesse "The Red Pill ist hier Kaufkandidat"
 *      (die Marke nennt V1 fuer diesen Knoten): dann ist die Falle offen;
 *   4. PAKET 1 live: das Feld `gateBuy` (PREREQ_P1_FIELD) ist true.
 *
 * VERTRAG MIT bn4rep.js: Paket 0 liefert `v1Positiv` (so gebaut am 03.10.2026,
 * Worktree bb-p0-bau: Boolean im Telemetrieblock am Rundenende, beim Warten am
 * Tor aus dem Block der letzten Runde uebernommen). Paket 1 MUSS `gateBuy:
 * true` in denselben Block schreiben, sobald die Kaufsperre bis zum Tor im Code
 * ist. Heisst das Feld bei der Uebernahme anders, ist es EINE Zeile hier
 * (PREREQ_P1_FIELD) und der Satz in ARCHITEKTUR.md - bis dahin gruendet gang.js
 * NICHT (fail closed, blockedReason "prereq_missing", Einzelheiten in
 * `prereq.missing` der Telemetrie und als eine Logzeile je Aenderung).
 * tools/test-gang.js (Abschnitt S13) prueft, sobald die Felder in bn4rep.js
 * stehen, dass sie wirklich im Telemetrieblock liegen.
 *
 * Fehlt etwas, wird NICHT gegruendet und der Versuch NICHT gezaehlt (keine
 * 10-Minuten-Pause): sobald die Voraussetzung da ist, geht es im naechsten
 * 30-s-Takt los. Wer schon in einer Gang ist (von Hand gegruendet, frueherer
 * Lauf), wird von der Sperre nicht beruehrt - sie schuetzt allein den
 * unumkehrbaren Schritt.
 *
 * ===========================================================================
 * SO WIRD EINGESCHALTET (Reihenfolge, Skeptiker-Auflage 2)
 * ===========================================================================
 *
 *   1. Paket 0 und Paket 1 sind im Spiel (Hash im Spiel = Repo) und
 *      `data/bn4rep.json` zeigt `v1Positiv: false` und `gateBuy: true`.
 *   2. src/registry.json mit dem gang.js-Eintrag ist im Spiel, UND der Kern
 *      wurde DANACH neu gestartet. bn4net.js liest registry.json genau EINMAL
 *      beim Start (`bn4net.js:95-108`, die Schleife beginnt erst bei :888);
 *      ein laufender Kern kennt gang.js nicht, und der Schalter bliebe bis zum
 *      naechsten Kernneustart (im heutigen BN2.1 der Einbau ~So 07:04, also
 *      ~7 h Gang-Zeit) wirkungslos. Neustart: `node tools/neustart.js
 *      bn4net.js` (waehlt selbst den Kanal `SELBST bn4net.js` und belegt den
 *      Neustart per PID-Vergleich; ein `tools/hand.js reload` gibt es nicht,
 *      siehe Kopf von tools/neustart.js).
 *   3. Im bn4net-Log steht `gang.js wartet: wartet auf data/gang-an.txt.`
 *      (alle 30 Runden, also hoechstens alle 5 min). Steht es nicht, kennt der
 *      Kern den Eintrag nicht - dann Schritt 2 wiederholen, NICHT den
 *      Schalter legen.
 *   4. ERST JETZT `data/gang-an.txt` legen.
 *
 * ===========================================================================
 * DER GELDMODUS (P2d, 04.10.2026)
 * ===========================================================================
 *
 * Gerechnet in nodes/audit-2026-10-03/verify-p2b-gang.md (S0-S4) und
 * gegengeprueft in verify-p2b-substanz.md / -praemisse.md / -geldwert.md. Die
 * Kurzfassung: der heutige Regler (Terrorism fuer alle Arbeitenden) erzeugt
 * Respekt und damit Faktionsruf, der nach dem Bedarf der naechsten Torrunde
 * niemandem mehr nuetzt (~17 Mio Ruf bei Tor gegen 1,66 Mio Bedarf) - 10 von
 * 11 Stunden Gang-Kapazitaet liegen brach. Human Trafficking dagegen bringt
 * 301 Mrd Gang-Geld bis zum Tor (S1), mit der Ausruestung 519 Mrd (S3). Das
 * Geld ist wegen des Preisfaktors 1,9 je Stueck nicht unbegrenzt viel wert
 * (x4,81 -> x7,42 -> x8,41 Competence der Runde), aber es kostet nur eine
 * andere Aufgabe und vier Funktionen.
 *
 * ZWEI MODI, JE RUNDE ZUSTANDSLOS ABGELEITET (kein Merker, ein Neustart verliert
 * nichts):
 *
 *   RESPECT  die Arbeitenden machen Terrorism (das bisherige Verhalten).
 *   MONEY    die Arbeitenden machen Human Trafficking (`TASK_MONEY`).
 *
 *   rep  = getFactionRep(Gang-Faktion)
 *   need = torRunde.repNeed aus data/bn4rep.json (bn4rep.js, Block 1c, P2d):
 *          1,02 x der hoechste Rufbedarf der Stuecke, die der Planer bei vier
 *          mal dem heutigen Geld in der Gang-Faktion kaufen wuerde
 *   MONEY, wenn need eine endliche Zahl > 0 ist UND rep >= need.
 *   Zurueck auf RESPECT erst bei rep < need / 1,02 (HYSTERESE): arbeiten schon
 *   Mitglieder auf der Geldaufgabe, gilt die untere Schwelle. Der Merker steht
 *   in den gesetzten Aufgaben, nicht in einer Variablen.
 *
 *   VERTRAG MIT bn4rep.js (beide Richtungen): bn4rep.js schreibt torRunde.repNeed
 *   und torRunde.repNeedFaction (Block 1c); gang.js schreibt inGang, faction und
 *   ts in data/gang.json, und bn4rep.js entnimmt dort die Faktion der Gang - ohne
 *   den Aufruf ns.gang.getGangInformation (2 GB mehr in einem 68-GB-Gewerk).
 *   Laeuft gang.js nicht, ist data/gang.json nach 10 min alt und bn4rep.js rechnet
 *   keinen Bedarf (null): das ist genau der Fall, in dem es keinen Modus braucht.
 *
 *   need fehlt, ist null, ist veraltet (> 30 min, dieselbe Frist und derselbe
 *   Knoteneintritt wie die Voraussetzungssperre) oder gehoert zu einer anderen
 *   Faktion -> RESPECT. Das ist der sichere Rueckfall: genau das Verhalten von
 *   gang-2. Nach einem Einbau ist der Faktionsruf 0 (Prestige) -> rep < need ->
 *   RESPECT, ein neuer Zyklus beginnt von selbst mit Terrorism.
 *
 * WAS SICH IM MONEY-MODUS AENDERT - UND WAS NICHT:
 *   - Arbeitende: Human Trafficking statt Terrorism.
 *   - Trainingsphase (Train Combat bis 500), Aufstieg (1,3 im Training, 2 in der
 *     Arbeit, gewichtet nach den Terrorism-Gewichten) und der Wanted-Regler
 *     (Vigilante bei wanted > 1 und Strafe < 0,95) sind UNVERAENDERT. Der Regler
 *     rechnet mit dem wantedGain der jeweils gesetzten Arbeitsaufgabe: Human
 *     Trafficking hat Basis 1,25 statt 6, der Wanted waechst dort langsamer.
 *   - Ausruestung (naechster Absatz).
 *
 * AUSRUESTUNG, NUR IM MONEY-MODUS. Typen Weapon, Armor, Vehicle, Rootkit
 * (`EQUIP_TYPES`, ueber getEquipmentType; NIE Augmentation). Je Runde hoechstens
 * EQUIP_MAX_BUYS Kaeufe (harte Grenze), billigstes Stueck zuerst; gekauft wird
 * nur, wenn `getServerMoneyAvailable("home") - geldbedarf >= Preis`. geldbedarf
 * ist die Ruecklage aus data/geldbedarf.txt, die bn4rep.js fuer die Torrunde
 * meldet und die die anderen sechs Ausgeber abziehen (verify-p2b-praemisse.md
 * E7); FEHLT oder ist sie unlesbar, wird NICHTS gekauft (die anderen Ausgeber
 * lesen sie dann als 0 - hier ist der Fehlerfall teurer, weil jede Runde neu
 * kaufen koennte). Nach einem Aufstieg ist die Ausruestung des Mitglieds weg
 * (`GangMember.ts:308-319`); in der Aufstiegsrunde ist der Stand veraltet, die
 * NAECHSTE Runde liest ihn neu und kauft neu. Fehler werden gezaehlt
 * (errors.byCall), nie ein Abbruch.
 *
 * ===========================================================================
 * ABNAHME DES GELDMODUS (live, nach dem ersten Umschalten)
 * ===========================================================================
 *
 * Die Geldterme (`baseMoney`, Gebietsfaktor) liefen in der echten Gang noch nie;
 * Respekt und Wanted sind auf 0,07 % geeicht, Geld nur gegen die Quelle
 * (verify-p2b-substanz.md Abschnitt 1a, 86.360 Vergleiche). Deshalb:
 *
 *   1. moneyGainRate (data/gang.json) gegen `node tools/audit/gang-p2b-gegen.mjs
 *      --live` (nur lesend, rechnet Human Trafficking aus den Mitgliedern des
 *      Spielstands) auf demselben Spielstand: Abweichung <= 5 %. Der Wert ist je
 *      ZYKLUS (x5 = $/s). Mitglieder im Training oder auf Vigilante druecken den
 *      Ist-Wert: verglichen wird nur ueber die Mitglieder, die zur selben Zeit
 *      wirklich auf Human Trafficking stehen. Bei mehr als 5 %: die Geldformel
 *      pruefen, und bis dahin gang-2 (Stand vor P2d) einspielen - die Gang
 *      behaelt Mitglieder und Respekt, der alte Regler setzt im naechsten Takt
 *      wieder Terrorism. (Einen eigenen Schalter nur fuer den Geldmodus gibt es
 *      nicht; data/gang-an.txt zu entfernen liesse die Mitglieder auf Human
 *      Trafficking stehen.)
 *   2. penalty >= 0,95 (der Regler haelt sie dort; kurze Ausreisser darunter
 *      holt Vigilante zurueck).
 *   3. errors.total 0, lastError null.
 *   4. Kein Ausruestungskauf unter die Ruecklage: Konto nach dem Kauf >=
 *      data/geldbedarf.txt; equipmentSpent waechst nur im MONEY-Modus.
 *   5. mode "money" erst, wenn factionRep >= repNeed (beide in data/gang.json).
 *
 * ===========================================================================
 * ABLAUF
 * ===========================================================================
 *
 * 1. `ns.gang.inGang()` (0 GB) zuerst - jede andere Gang-Funktion wirft sonst.
 * 2. Keine Gang: unter den BEIGETRETENEN Kampf-Gang-Faktionen (Slum Snakes,
 *    Tetrads, The Syndicate, Speakers for the Dead, The Dark Army - NIE
 *    NiteSec/The Black Hand, das waeren Hacking-Gangs mit 8.114/872 Rep Verlust
 *    und 13,1 h statt 8,6 h bis 1,25 Mio) die mit dem kleinsten Ruf waehlen.
 *    Die Gruendung setzt den Ruf dieser Faktion auf 0
 *    (`PlayerObjectGangMethods.ts:67`) - bei Ruf 0 geht also nichts verloren
 *    (live 03.10. 21:17: Slum Snakes 0, Tetrads 0, The Syndicate 2.082).
 *    `createGang` wird je Versuch genau EINMAL gerufen; schlaegt es fehl, folgt
 *    eine Pause von 10 Minuten (Wanduhr: die Pause soll das Haemmern bremsen,
 *    nicht Spielzeit messen). Die Pause ueberlebt einen Neustart, weil
 *    `lastCreateAt` in der Telemetrie steht. Ohne beigetretene Kampf-Faktion
 *    wird gar nicht gegruendet.
 * 3. Die Schleife haengt am Gang-Takt `await ns.gang.nextUpdate()`. Das ist
 *    keine Stilfrage: die Gang holt Offline-Zeit mit bis zu 25 Zyklen je Takt
 *    nach (`Gang/data/Constants.ts:28-31`, `Gang.ts:99-121`), also 250 s
 *    Gang-Zeit je 10 s Echtzeit. Ein Regler auf `ns.sleep` saehe davon nichts,
 *    und der Wanted-Level liefe ihm davon. Gegen ein Spiel, das den Takt
 *    anhaelt (gedrosselter Tab, Pause), steht ein Rueckfall daneben:
 *    `Promise.race` mit `ns.asleep` (laeuft nebenher und blockiert keinen
 *    weiteren ns-Aufruf, `NetscriptHelpers.tsx:455` nimmt `asleep` aus der
 *    Nebenlaeufigkeitspruefung aus).
 * 4. Rekrutieren, solange `canRecruitMember()` (12 Mitglieder, ab dem 4. kostet
 *    jedes 5^n Respekt).
 * 5. Aufgaben je Mitglied (Regler wie die Sim "bester Regler"):
 *      - 'Train Combat', bis die mit den Terrorism-Gewichten gewichtete Stufe
 *        500 erreicht (Phase ist zustandslos aus den Stufen abgeleitet - ein
 *        Neustart verliert nichts);
 *      - danach die Arbeitsaufgabe des Modus: im Modus RESPECT 'Terrorism' (Respekt),
 *        im Modus MONEY 'Human Trafficking' (Geld) - siehe DER GELDMODUS;
 *      - 'Vigilante Justice' fuer die Arbeitenden mit dem kleinsten
 *        Beitrag, solange wantedLevel > 1 und wantedPenalty < 0,95 und
 *        die gerechnete Wanted-Summe (der jeweiligen Arbeitsaufgabe) positiv ist.
 * 6. Aufstieg (`ascendMember`), wenn der Faktor aus `getAscensionResult`
 *    (gewichtetes geometrisches Mittel ueber die Stat-Gewichte der
 *    Respektaufgabe Terrorism) in der Trainingsphase >= 1,3 und in der
 *    Arbeitsphase >= 2 ist. Die Gewichte sind die der Sim; ein Faktor nur ueber
 *    die vier Kampfwerte lag in der Sim bei gleicher Schwelle schlechter
 *    (9,3 h statt 8,6 h bis 1,25 Mio, `gang-sim.mjs --combatonly`). Auch im
 *    Modus MONEY gelten dieselben Gewichte und Schwellen (gerechnet: die
 *    Schwellen sind fuer den Wert der Torrunde egal, verify-p2b-gang.md S4).
 * 7. Im Modus MONEY: Ausruestung kaufen (nur Weapon/Armor/Vehicle/Rootkit, nur
 *    ueber der Ruecklage, hoechstens EQUIP_MAX_BUYS je Runde).
 *
 * ===========================================================================
 * FEHLER WERDEN GEZAEHLT, NICHT GESCHLUCKT
 * ===========================================================================
 *
 * Am 03.10.2026 lagen vier Black-Op-Aufrufe in blade.js seit Wochen tot, weil
 * ein try/catch den Fehler verschluckte. Deshalb: jeder Aufruf, der werfen
 * kann, laeuft ueber `tryCall()`, zaehlt in `errors.total`/`errors.byCall`,
 * setzt `lastError` und landet im Log. Eine Ausnahme der Rundenfunktion oder
 * des Wartens erhoeht `errStreak`; nach MAX_ERR_STREAK Runden in Folge beendet
 * sich das Werkzeug mit state "blocked" (der Kern startet es neu), statt
 * endlos weiterzufehlern.
 *
 * ===========================================================================
 * SCHLEIFENGRENZEN
 * ===========================================================================
 *
 * Am 03.10.2026 fror eine unbegrenzte `while`-Schleife den Spiel-Tab ein.
 * Hier hat jede Schleife eine feste Obergrenze: die Hauptschleife MAX_ROUNDS
 * (danach beendet sich das Werkzeug, der Kern startet es neu, die Gang bleibt
 * unberuehrt), das Rekrutieren MAX_MEMBERS, die Namenssuche 2 x MAX_MEMBERS.
 *
 * ===========================================================================
 * ABBRUCHKRITERIEN FUER DEN LIVEBETRIEB (verify-g01-betrieb.md, Paket 2)
 * ===========================================================================
 *
 *   vor dem Zuenden  Paket 0 (TRP-Falle) UND Paket 1 (Kauf am Tor) im Spiel,
 *                    Tests S1-S3 (P0) und S4-S6 (P1) in
 *                    tools/test-bn4rep-ebene2.js gruen, der Kern kennt
 *                    gang.js (Log "gang.js wartet: wartet auf
 *                    data/gang-an.txt", siehe SO WIRD EINGESCHALTET)
 *                    -> sonst KEIN data/gang-an.txt. Ein zu frueh gelegter
 *                    Schalter richtet nichts an (Sperre), aber er taeuscht
 *                    ueber den Stand.
 *   +10 min          data/gang.json frisch, inGang true, 3 Mitglieder,
 *                    createGang 1x im Log (data/gang-log.txt)
 *                    -> fehlt data/gang.json ganz: der Kern kennt gang.js
 *                       nicht, Kern neu starten (NICHT den Schalter wegnehmen);
 *                    -> blockedReason "prereq_missing": `prereq.missing` nennt
 *                       die fehlende Voraussetzung, Schalter bleibt liegen;
 *                    -> sonst Schalter weg, Log lesen.
 *   +2 h             >= 6 Mitglieder, Respekt steigt, penalty >= 0,9,
 *                    errors.total 0
 *                    -> penalty < 0,5 ueber 30 min oder errors.total > 0:
 *                       Schalter weg.
 *   bis zum Tor      bn4rep-Log ohne "GEKAUFT" bei aktiver Sperre
 *                    -> Kauf trotz Sperre: Paket 1 zurueck.
 *   am Tor           TRP nie in der Warteschlange; erstes Stueck = Planstueck;
 *                    Kosten <= Konto; Einbau binnen 2 Runden
 *                    -> TRP in der Schlange: sofort melden (nicht entfernbar).
 *   nach dem Einbau  gang.js binnen 5 min neu gestartet, Favor Slum Snakes > 0
 *                    -> Registry/Prioritaet pruefen.
 *
 * ===========================================================================
 * TELEMETRIE `data/gang.json`
 * ===========================================================================
 *
 * Pflichtfelder wie ARCHITEKTUR 4.1 (ts/wall, round, okRound, errStreak,
 * lastError, host, version, state, blockedReason) plus: inGang, faction,
 * isHacking, members, respect, factionRep, wanted, penalty, territory,
 * warfare, taskCounts, ascensions, recruits, errors {total, byCall},
 * createAttempts, lastCreateAt, lastCreate, updates, timeouts, prereq {ok,
 * missing[], at} (Ergebnis der letzten Voraussetzungspruefung; null, solange
 * nie geprueft wurde, etwa weil schon eine Gang da war). Seit gang-3 (Geldmodus):
 * mode ("respect"|"money"|null ausserhalb der Fuehrung), repNeed (Zahl oder null)
 * und repNeedWhy (warum null), moneyGainRate (getGangInformation, je Zyklus),
 * equipmentBought / equipmentSpent (Summen seit Start dieses Prozesses) und
 * equipmentBlock (warum in der letzten Runde nichts gekauft wurde, sonst null). Der Kern
 * erschlaegt ein Werkzeug, dessen Telemetrie aelter als freshnessMs ist - sie
 * wird deshalb auch in den Warte- und Pausenzustaenden geschrieben (Rundentakt
 * hoechstens IDLE_SLEEP_MS bzw. UPDATE_TIMEOUT_MS). Leser: tools/checkin.js
 * ueber tools/lib/gangzeile.js (eine Zeile "GANG: ...").
 *
 * Feldnamen sind englisch (Projektregel). Die Namen aus der Bauvorgabe vom
 * 03.10.2026 heissen hier: zeit = ts/wall, mitglieder = members, faktionsRuf =
 * factionRep, aufgabenVerteilung = taskCounts, aufstiege = ascensions,
 * fehler = errors, gruendungVersuche = createAttempts, faktion = faction,
 * respekt = respect; inGang, wanted und penalty heissen unveraendert so.
 *
 * ===========================================================================
 * OFFENE PUNKTE (bewusst nicht entschieden, Skeptiker 03.10.2026)
 * ===========================================================================
 *
 * - GELOEST in gang-3: der Mittelweg "Respekt bis zum Rufbedarf der geplanten
 *   Runde, danach Geldaufgaben" (verify-g01-betrieb.md Abschnitt 6) ist gerechnet
 *   (verify-p2b-gang.md S1) und der Geldmodus (siehe oben). Er erreicht die
 *   TRP-Schwelle (2,5 Mio Ruf) nebenbei spaeter. Offen bleibt: der Geld-Absolutwert
 *   ist nur gegen die Quelle geeicht, nicht gegen die echte Gang (ABNAHME).
 * - Die Gang-Dynamik (Respekt, Ruf, Wanted, Aufstiege) ist seit 04.10.2026 an der
 *   echten Gang geeicht (tools/audit/gang-p2b-calib.mjs, 0,00-0,04 %); die
 *   Gruendung, der Regler und die Rekrutierung laufen live seit 04.10. 01:01.
 * - Der Rufbedarf ist ein Planer-Ergebnis bei dem Vierfachen des heutigen Geldes
 *   (REP_NEED_BUDGET_FACTOR in lib/einbau.js, ein grober Hebel). Mit sehr wenig
 *   Geld und billigen Fruehstuecken kann `need` klein sein (1.000-1.250 Ruf); die
 *   Gang schaltet dann kurz auf MONEY und, waechst das Geld, die Hysterese und der
 *   Plan holen sie zurueck. Nicht gemessen, wie oft das im Zyklus 1 passiert.
 * - Nach einem Augmentierungs-Einbau sinken die Aufstiegspunkte auf 95 %
 *   (`Prestige.ts:130-143`), die Stufen also leicht: ein Arbeiter knapp ueber
 *   TRAIN_UNTIL kann kurz in die Trainingsphase zurueckfallen. Folgenlos, aber
 *   nicht gemessen.
 * - Der Leser fuer data/gang.json ist tools/lib/gangzeile.js (eine Zeile in
 *   tools/checkin.js, also in /bb); es gibt keinen weiteren Leser, etwa im
 *   Dashboard.
 *
 * @param {NS} ns
 */

import { liesVonHome, haengeAnHome } from "lib/hostdatei.js";

// --- Dateien und Namen --------------------------------------------------------
export const SWITCH_FILE = "data/gang-an.txt";
export const TELEMETRY_FILE = "data/gang.json";
export const LOG_FILE = "data/gang-log.txt";
const LOG_MAX_LINES = 300;

// --- Voraussetzungssperre (siehe Kopf: DIE VORAUSSETZUNGSSPERRE) ---------------
export const BN4REP_FILE = "data/bn4rep.json";
// 30 min = freshnessMs des bn4rep-Eintrags in der Registry: aelter gilt der
// Kern selbst bn4rep.js als tot.
export const PREREQ_MAX_AGE_MS = 30 * 60000;
// Felder, die NUR die neuen Fassungen von bn4rep.js in ihre Telemetrie schreiben.
export const PREREQ_P0_FIELD = "v1Positiv";   // Paket 0: Boolean, MUSS false sein
export const PREREQ_P1_FIELD = "gateBuy";     // Paket 1: Boolean, MUSS true sein
const VERSION = "gang-3";

/**
 * Kampf-Gang-Faktionen in Tie-Break-Reihenfolge (`Gang/data/Constants.ts:20-27`,
 * ohne NiteSec und The Black Hand - die gruenden Hacking-Gangs).
 */
export const COMBAT_FACTIONS = [
  "Slum Snakes",
  "Tetrads",
  "The Syndicate",
  "Speakers for the Dead",
  "The Dark Army",
];

export const TASK_TRAIN = "Train Combat";
export const TASK_WORK = "Terrorism";
export const TASK_JUSTICE = "Vigilante Justice";
export const TASK_MONEY = "Human Trafficking";   // Geldaufgabe des Modus MONEY (P2d)

// --- Modi des Reglers (P2d, siehe Kopf: DER GELDMODUS) --------------------------
export const MODE_RESPECT = "respect";   // Arbeitende machen Terrorism (gang-2)
export const MODE_MONEY = "money";       // Arbeitende machen Human Trafficking + Ausruestung
// Sicherheitszuschlag des Rufbedarfs; MUSS zu lib/einbau.js REP_NEED_MARGIN passen
// (test-gang.js S15 prueft die Gleichheit). gang.js importiert lib/einbau.js nicht:
// der Kern loest Importe nicht transitiv auf (bn4net.js:3795-3803), und ein zweites
// needsLibs fuer eine Zahl waere mehr Last als die Pruefung im Test.
export const REP_NEED_MARGIN = 1.02;

// --- Ausruestung im Modus MONEY -----------------------------------------------
// Nur diese Typen (getEquipmentType). "Augmentation" fehlt mit Absicht: Mitglieder-
// Augmentierungen kosten 306 Mrd fuer +0,14 ln Competence (verify-p2b-gang.md S3g),
// bleiben nach einem Aufstieg erhalten und sind nicht Teil dieses Auftrags.
export const EQUIP_TYPES = ["Weapon", "Armor", "Vehicle", "Rootkit"];
// Harte Obergrenze der Kaeufe je Runde. Der volle Satz sind 21 Stuecke (8 Waffen,
// 4 Ruestungen, 4 Fahrzeuge, 5 Rootkits, upgrades.ts); fehlt er allen zwoelf, sind
// das 252 Kaeufe und gut zehn Runden - ein Stapel nach dem Umschalten, kein
// Dauerzustand. Zugleich die Grenze der Kaufschleife.
export const EQUIP_MAX_BUYS = 24;
// Die Ruecklage, die bn4rep.js fuer die Torrunde meldet und die alle Ausgeber abziehen.
export const MONEY_NEED_FILE = "data/geldbedarf.txt";

// --- Regler-Parameter (Sim "bester Regler", gang-sim.mjs) ----------------------
export const TRAIN_UNTIL = 500;      // gewichtete Stufe, ab der gearbeitet wird
export const ASC_TRAIN = 1.3;        // Aufstiegsschwelle in der Trainingsphase
export const ASC_WORK = 2;           // Aufstiegsschwelle in der Arbeitsphase
export const WANTED_FLOOR = 0.95;    // darunter hilft Vigilante

// --- Takte und Grenzen ----------------------------------------------------------
export const CREATE_PAUSE_MS = 10 * 60000;  // Pause nach einem Gruendungsversuch (Wanduhr)
const IDLE_SLEEP_MS = 30000;         // Takt ohne Gang
const UPDATE_TIMEOUT_MS = 20000;     // Rueckfall, wenn nextUpdate nicht kommt
const ERROR_BACKOFF_MS = 5000;       // Pause nach einem Fehler beim Warten
const TELEMETRY_EVERY_MS = 10000;
export const MAX_ROUNDS = 20000;
export const MAX_ERR_STREAK = 30;
export const MAX_MEMBERS = 12;       // Gang/data/Constants.ts:12

export const STATS = ["hack", "str", "def", "dex", "agi", "cha"];

// --- Aufgabendaten (Gang/data/tasks.ts, Parameter wortgleich) ------------------
// w = Gewichte in Prozent. Nur die drei Aufgaben, die dieses Werkzeug setzt.
export const TASKS = {
  [TASK_TRAIN]: {
    baseRespect: 0, baseWanted: 0, difficulty: 100,
    w: { hack: 0, str: 25, def: 25, dex: 25, agi: 25, cha: 0 },
    territory: { respect: 1, wanted: 1 },
  },
  [TASK_WORK]: {
    baseRespect: 0.01, baseWanted: 6, difficulty: 36,
    w: { hack: 20, str: 20, def: 20, dex: 20, agi: 0, cha: 20 },
    territory: { respect: 2, wanted: 2 },
  },
  [TASK_JUSTICE]: {
    baseRespect: 0, baseWanted: -0.001, difficulty: 1,
    w: { hack: 20, str: 20, def: 20, dex: 20, agi: 20, cha: 0 },
    territory: { respect: 1, wanted: 0.9 },
  },
  // Die Geldaufgabe (P2d): Gang/data/tasks.ts "Human Trafficking" - baseRespect
  // 0.004, baseWanted 1.25, baseMoney 360, Gewichte hack 30 / str 5 / def 5 /
  // dex 30 / cha 30 (agi 0), difficulty 36, Gebietsfaktoren money 1.5 / respect
  // 1.5 / wanted 1.6. baseMoney und territory.money braucht dieses Werkzeug fuer
  // seine eigenen Rechnungen nicht (das Spiel rechnet das Geld), sie stehen hier,
  // damit der Eintrag wortgleich zur Quelle bleibt (test-gang.js P4).
  [TASK_MONEY]: {
    baseRespect: 0.004, baseWanted: 1.25, baseMoney: 360, difficulty: 36,
    w: { hack: 30, str: 5, def: 5, dex: 30, agi: 0, cha: 30 },
    territory: { money: 1.5, respect: 1.5, wanted: 1.6 },
  },
};

// ===========================================================================
// REINE FUNKTIONEN (ohne ns - testbar)
// ===========================================================================

/** Gewichtete Stufe nach den Gewichten einer Aufgabe. `lvl` = {hack, str, ...}. */
export function weightedLevel(task, lvl) {
  let sum = 0;
  for (const s of STATS) sum += (task.w[s] / 100) * (lvl[s] || 0);
  return sum;
}

/**
 * Trainings- oder Arbeitsphase, rein aus den Stufen (zustandslos).
 *
 * In der Sim ist `phase` ein Merker am Mitglied, der bei Erreichen der Stufe
 * auf "work" springt und nach einem Aufstieg zurueck auf "train". Der Merker
 * ist aus den Stufen ableitbar: Stufen sinken nur durch einen Aufstieg (die
 * Erfahrung wird geleert, die Stufe faellt auf ~den Aufstiegsmultiplikator),
 * und genau dann soll die Phase wieder "train" sein. Ableiten statt merken
 * heisst: ein Neustart von gang.js oder ein Handgriff im Spiel verliert nichts.
 */
export function phaseOf(lvl) {
  return weightedLevel(TASKS[TASK_WORK], lvl) >= TRAIN_UNTIL ? "work" : "train";
}

/**
 * Faktor des Aufstiegs: gewichtetes geometrisches Mittel der Einzelfaktoren
 * aus `getAscensionResult` ueber die Stat-Gewichte der Respektaufgabe
 * (gang-sim.mjs:56-59). Ungueltige Werte ergeben NaN - und NaN >= Schwelle
 * ist falsch, es wird also nicht aufgestiegen.
 */
export function ascensionFactor(result) {
  if (!result || typeof result !== "object") return NaN;
  const w = TASKS[TASK_WORK].w;
  let logSum = 0;
  let weightSum = 0;
  for (const s of STATS) {
    if (!(w[s] > 0)) continue;
    const r = Number(result[s]);
    if (!(r > 0) || !Number.isFinite(r)) return NaN;
    logSum += w[s] * Math.log(r);
    weightSum += w[s];
  }
  return weightSum > 0 ? Math.exp(logSum / weightSum) : NaN;
}

/** Soll aufgestiegen werden? Schwelle je Phase. */
export function shouldAscend(phase, result) {
  const factor = ascensionFactor(result);
  const threshold = phase === "train" ? ASC_TRAIN : ASC_WORK;
  return factor >= threshold;
}

/**
 * Respektgewinn je Zyklus (`Gang/formulas/formulas.ts:15-31`). `g` = {respect,
 * wantedLevel, territory}. Der Softcap des Knotens (BN2: 1) bleibt aussen vor:
 * er ist ein Exponent auf alle Mitglieder gleichermassen und aendert die
 * RANGFOLGE nicht, die hier allein gebraucht wird.
 */
export function respectGain(task, lvl, g) {
  if (task.baseRespect === 0) return 0;
  const sw = weightedLevel(task, lvl) - 4 * task.difficulty;
  if (sw <= 0) return 0;
  const territoryMult = Math.max(0.005, Math.pow(g.territory * 100, task.territory.respect) / 100);
  const penalty = g.respect / (g.respect + g.wantedLevel);
  const exponent = 0.2 * g.territory + 0.8;
  return Math.pow(11 * task.baseRespect * sw * territoryMult * penalty, exponent);
}

/** Wanted-Gewinn je Zyklus (`Gang/formulas/formulas.ts:33-54`). */
export function wantedGain(task, lvl, g) {
  if (task.baseWanted === 0) return 0;
  const sw = weightedLevel(task, lvl) - 3.5 * task.difficulty;
  if (sw <= 0) return 0;
  const territoryMult = Math.max(0.005, Math.pow(g.territory * 100, task.territory.wanted) / 100);
  if (!(territoryMult > 0)) return 0;
  if (task.baseWanted < 0) return 0.4 * task.baseWanted * sw * territoryMult;
  const calc = (7 * task.baseWanted) / Math.pow(3 * sw * territoryMult, 0.8);
  return Math.min(100, calc);
}

/**
 * Welche Faktion gruendet die Gang?
 *
 * @param {string[]} joined beigetretene Faktionen (`getPlayer().factions`)
 * @param {Object<string, number|null>} reps Ruf je Faktion; null/NaN = nicht lesbar
 * @returns {{faction: string|null, reason: string, candidates: string[]}}
 *   reason: "ok" | "no_faction" | "rep_unreadable"
 */
export function chooseFounder(joined, reps) {
  const joinedSet = new Set(Array.isArray(joined) ? joined : []);
  const candidates = COMBAT_FACTIONS.filter((f) => joinedSet.has(f));
  if (!candidates.length) return { faction: null, reason: "no_faction", candidates };
  let best = null;
  for (const f of candidates) {
    const rep = reps ? reps[f] : null;
    // Unlesbarer Ruf zaehlt NICHT als 0: eine Gruendung ist unumkehrbar, und
    // sie nullt den Ruf der gewaehlten Faktion. Im Zweifel nicht gruenden -
    // und zwar auch dann nicht, wenn ein ANDERER Kandidat lesbar ist: die
    // unlesbare Faktion koennte die mit dem kleinsten Ruf sein, und die
    // lesbare koennte viel Ruf haben, der mit der Gruendung verfaellt
    // (Skeptiker 03.10.2026: Kommentar und Code sagten Verschiedenes, der
    // Code uebersprang nur die betroffene Faktion).
    if (typeof rep !== "number" || !Number.isFinite(rep)) {
      return { faction: null, reason: "rep_unreadable", candidates, unreadable: f };
    }
    if (best === null || rep < best.rep) best = { f, rep };
  }
  return { faction: best.f, reason: "ok", candidates };
}

/**
 * Sind Paket 0 (TRP-Falle zu) und Paket 1 (Kauf bis zum Tor aufgeschoben) im
 * Spiel LIVE? Die maschinelle Sperre vor `createGang` (siehe Kopf).
 *
 * Reine Funktion: alles Gelesene kommt als Argument, damit sie ohne ns testbar
 * ist. Sie sammelt ALLE Maengel in `missing` (nicht beim ersten Halt), damit die
 * Telemetrie dem Menschen auf einen Blick sagt, was fehlt.
 *
 * @param {object|null} tel geparste data/bn4rep.json; null = fehlt/unlesbar
 * @param {number} nowMs Wanduhr (Date.now)
 * @param {{currentNode:number, lastNodeReset:number}|null} reset getResetInfo
 * @returns {{ok:boolean, missing:string[]}}
 */
export function checkPrereq(tel, nowMs, reset) {
  if (!tel || typeof tel !== "object" || Array.isArray(tel)) {
    return { ok: false, missing: [BN4REP_FILE + " fehlt oder ist unlesbar (bn4rep.js laeuft nicht?)"] };
  }
  const missing = [];

  // 1. Frische. Dieselbe Zeitfeld-Reihenfolge wie der Kern (bn4net.js, Zaehlwerk
  //    der Registry): bn4rep.js schreibt `zeit`, Herzschlagbloecke `ts`/`wall`.
  const at = [tel.zeit, tel.ts, tel.wall].find((x) => Number.isFinite(x));
  if (at === undefined) {
    missing.push(BN4REP_FILE + " ohne Zeitstempel");
  } else {
    const age = nowMs - at;
    if (age < -60000) missing.push(BN4REP_FILE + " stammt aus der Zukunft (" + Math.round(-age / 1000) + " s) - Uhrensprung?");
    else if (age > PREREQ_MAX_AGE_MS) missing.push(BN4REP_FILE + " veraltet (" + Math.round(age / 60000) + " min, Grenze "
      + Math.round(PREREQ_MAX_AGE_MS / 60000) + ") - bn4rep.js laeuft nicht");
  }

  // 2. Gehoert die Datei zu DIESEM Knoteneintritt? Die Knotennummer allein
  //    reicht nicht (Level 2 desselben Knotens), `nodeReset` trennt die Eintritte.
  if (!reset || !Number.isFinite(reset.currentNode) || !Number.isFinite(reset.lastNodeReset)) {
    missing.push("getResetInfo nicht lesbar - Knoteneintritt nicht pruefbar");
  } else if (tel.knoten !== reset.currentNode || tel.nodeReset !== reset.lastNodeReset) {
    missing.push(BN4REP_FILE + " gehoert nicht zu diesem Knoteneintritt (knoten " + String(tel.knoten)
      + " gegen " + reset.currentNode + ", nodeReset " + String(tel.nodeReset) + " gegen " + reset.lastNodeReset + ")");
  }

  // 3. Paket 0. Ein fehlendes Feld heisst: die alte bn4rep.js laeuft noch.
  const p0 = tel[PREREQ_P0_FIELD];
  if (typeof p0 !== "boolean") {
    missing.push("Paket 0 nicht live: Feld " + PREREQ_P0_FIELD + " fehlt in " + BN4REP_FILE);
  } else if (p0 === true) {
    missing.push("Paket 0 greift hier nicht: " + PREREQ_P0_FIELD + " ist true (The Red Pill waere Kaufkandidat)");
  }

  // 4. Paket 1.
  if (tel[PREREQ_P1_FIELD] !== true) {
    missing.push("Paket 1 nicht live: Feld " + PREREQ_P1_FIELD + " fehlt oder ist nicht true in " + BN4REP_FILE);
  }

  return { ok: missing.length === 0, missing };
}

/**
 * Uhrzeit in ORTSZEIT (HH:MM:SS) fuer die Logzeilen. Hier stand
 * `toISOString().slice(11, 19)` - das ist UTC und weicht in Erics Zeitzone um
 * zwei Stunden von der Uhr ab, nach der er das Log liest.
 */
export function localStamp(d) {
  const p = (n) => String(n).padStart(2, "0");
  return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
}

/**
 * Die Aufgabenwahl einer Runde.
 *
 * @param {{respect:number, wantedLevel:number, wantedPenalty:number, territory:number}} g
 * @param {{name:string, task:string, lvl:object, ascended?:boolean}[]} members
 *   `ascended`: in dieser Runde aufgestiegen - die Stufen sind veraltet, die
 *   Phase ist "train" (Stufe nach Aufstieg ~ Aufstiegsmultiplikator)
 * @param {"respect"|"money"} [mode] Modus der Runde (siehe DER GELDMODUS): bestimmt
 *   die Arbeitsaufgabe der Arbeitsphase - MODE_RESPECT 'Terrorism' (Vorgabe, wie
 *   gang-2), MODE_MONEY 'Human Trafficking'. Alles andere gilt als MODE_RESPECT.
 * @returns {{assign: Object<string,string>, phases: Object<string,string>,
 *            counts: Object<string,number>, justice: number, wantedSum: number}}
 */
export function planTasks(g, members, mode = MODE_RESPECT) {
  const workName = mode === MODE_MONEY ? TASK_MONEY : TASK_WORK;
  const workTask = TASKS[workName];
  const assign = {};
  const phases = {};
  for (const m of members) {
    const phase = m.ascended ? "train" : phaseOf(m.lvl);
    phases[m.name] = phase;
    assign[m.name] = phase === "train" ? TASK_TRAIN : workName;
  }

  // Wanted-Regler (gang-sim.mjs:84-97). Bei wanted == 1 senkt Vigilante nichts
  // (Gang.ts:157-166), und bei respect ~ 1 ist die Strafe von Haus aus 0,5 -
  // ohne die Bedingung wantedLevel > 1 liefe der Regler im Anlauf Amok.
  //
  // Der Regler rechnet mit der Arbeitsaufgabe, die die Mitglieder WIRKLICH
  // haben (workTask): Human Trafficking hat baseWanted 1,25 statt 6, die Summe
  // waechst langsamer, und Vigilante wird seltener gebraucht. Die Reihenfolge
  // "kleinster Beitrag zuerst" gilt weiter: Respekt und Geld einer Aufgabe haengen
  // am selben gewichteten Stufenwert, die Rangfolge der Mitglieder ist dieselbe.
  let justice = 0;
  let wantedSum = 0;
  if (g.wantedLevel > 1 && g.wantedPenalty < WANTED_FLOOR) {
    const working = members.filter((m) => assign[m.name] === workName);
    for (const m of working) wantedSum += wantedGain(workTask, m.lvl, g);
    // Die mit dem kleinsten Beitrag zuerst - sie kosten am wenigsten.
    working.sort((a, b) => {
      const d = respectGain(workTask, a.lvl, g) - respectGain(workTask, b.lvl, g);
      return d !== 0 ? d : (a.name < b.name ? -1 : 1);
    });
    for (const m of working) {
      if (!(wantedSum > 0)) break;
      wantedSum -= wantedGain(workTask, m.lvl, g);
      wantedSum += wantedGain(TASKS[TASK_JUSTICE], m.lvl, g);
      assign[m.name] = TASK_JUSTICE;
      justice++;
    }
  }

  const counts = {};
  for (const m of members) counts[assign[m.name]] = (counts[assign[m.name]] || 0) + 1;
  return { assign, phases, counts, justice, wantedSum };
}

/** Der erste freie Name G01..G24 (hoechstens 2 x MAX_MEMBERS Versuche). */
export function freeName(taken) {
  const set = new Set(taken);
  for (let i = 1; i <= 2 * MAX_MEMBERS; i++) {
    const name = "G" + String(i).padStart(2, "0");
    if (!set.has(name)) return name;
  }
  return null;
}

/**
 * Der Rufbedarf fuer den Geldmodus aus data/bn4rep.json (Telemetrie von
 * bn4rep.js, Feld `torRunde.repNeed`). Reine Funktion; sie gibt nur eine Zahl
 * zurueck, wenn ALLES stimmt - sonst null mit Grund, und der Modus bleibt RESPECT:
 *
 *   - die Datei ist lesbar, juenger als PREREQ_MAX_AGE_MS (30 min, dieselbe Frist
 *     wie die Voraussetzungssperre) und nicht aus der Zukunft (> 60 s);
 *   - sie gehoert zu DIESEM Knoteneintritt (`knoten` UND `nodeReset`);
 *   - `torRunde` ist ein Objekt und `repNeed` eine endliche Zahl > 0;
 *   - `repNeedFaction` ist die Faktion DIESER Gang: der Bedarf gilt fuer den Ruf
 *     einer Faktion, ein Wert fuer eine andere sagt hier nichts.
 *
 * Die Frische- und Eintrittspruefung steht bewusst eigenstaendig hier und nicht
 * in checkPrereq: die Sperre vor createGang verlangt zusaetzlich Paket 0 und 1,
 * dies hier nicht - und checkPrereq bleibt unangetastet.
 *
 * @param {object|null} tel geparste data/bn4rep.json
 * @param {number} nowMs Date.now()
 * @param {{currentNode:number, lastNodeReset:number}|null} reset getResetInfo
 * @param {string} faction die Faktion der Gang
 * @returns {{need: number|null, why: string}}
 */
export function repNeedOf(tel, nowMs, reset, faction) {
  const none = (why) => ({ need: null, why });
  if (!tel || typeof tel !== "object" || Array.isArray(tel)) return none(BN4REP_FILE + " fehlt oder ist unlesbar");
  const at = [tel.zeit, tel.ts, tel.wall].find((x) => Number.isFinite(x));
  if (at === undefined) return none(BN4REP_FILE + " ohne Zeitstempel");
  const age = nowMs - at;
  if (age < -60000) return none(BN4REP_FILE + " stammt aus der Zukunft");
  if (age > PREREQ_MAX_AGE_MS) return none(BN4REP_FILE + " veraltet (" + Math.round(age / 60000) + " min)");
  if (!reset || !Number.isFinite(reset.currentNode) || !Number.isFinite(reset.lastNodeReset)) {
    return none("getResetInfo nicht lesbar");
  }
  if (tel.knoten !== reset.currentNode || tel.nodeReset !== reset.lastNodeReset) {
    return none(BN4REP_FILE + " gehoert nicht zu diesem Knoteneintritt");
  }
  const tr = tel.torRunde;
  if (!tr || typeof tr !== "object" || Array.isArray(tr)) return none("kein torRunde-Block in " + BN4REP_FILE);
  const need = tr.repNeed;
  if (typeof need !== "number" || !Number.isFinite(need) || !(need > 0)) {
    return none("torRunde.repNeed fehlt oder ist null" + (tr.repNeedWhy ? " (" + String(tr.repNeedWhy).slice(0, 80) + ")" : ""));
  }
  if (typeof faction !== "string" || !faction || tr.repNeedFaction !== faction) {
    return none("repNeed gilt fuer " + String(tr.repNeedFaction) + ", die Gang ist bei " + String(faction));
  }
  return { need, why: "" };
}

/**
 * Welcher Modus gilt in dieser Runde? Rein und zustandslos.
 *
 * MONEY, wenn `need` eine endliche Zahl > 0 ist UND `rep` mindestens so gross.
 * Zurueck auf RESPECT erst, wenn `rep` unter need / REP_NEED_MARGIN faellt - die
 * Hysterese gilt, wenn schon Mitglieder auf der Geldaufgabe arbeiten (`onMoney`,
 * aus den gesetzten Aufgaben abgeleitet, nicht aus einem Merker). `need` ist
 * REP_NEED_MARGIN x hoechster Rufbedarf, die untere Schwelle also dieser
 * Rufbedarf selbst.
 *
 * Verglichen wird als `rep * REP_NEED_MARGIN >= need`, nicht als `rep >= need /
 * REP_NEED_MARGIN`: bn4rep.js rechnet need als repReq * 1,02, und genau diese
 * Multiplikation steht hier wieder - bei rep == repReq ist das Ergebnis dieselbe
 * Gleitkommazahl, die Division dagegen kann um ein Ulp daneben liegen.
 *
 * Unlesbares rep (NaN, fehlt) oder fehlendes need: RESPECT, das Verhalten von gang-2.
 *
 * @param {{rep:number, need:number|null, onMoney:boolean}} p
 * @returns {"respect"|"money"}
 */
export function chooseMode({ rep, need, onMoney }) {
  if (typeof need !== "number" || !Number.isFinite(need) || !(need > 0)) return MODE_RESPECT;
  if (typeof rep !== "number" || !Number.isFinite(rep)) return MODE_RESPECT;
  if (onMoney === true) return rep * REP_NEED_MARGIN >= need ? MODE_MONEY : MODE_RESPECT;
  return rep >= need ? MODE_MONEY : MODE_RESPECT;
}

/**
 * Die Kaufliste der Ausruestung: alle (Mitglied, Stueck)-Paare, die fehlen,
 * billigstes Stueck zuerst (bei gleichem Preis nach Stueck- und Mitgliedsname,
 * damit die Reihenfolge deterministisch ist).
 *
 * Ein Mitglied mit unbekanntem Besitz (`upgrades` keine Liste) wird uebersprungen:
 * im Zweifel nicht kaufen - ein Doppelkauf schlaegt zwar im Spiel fehl, kostet
 * aber einen gezaehlten Fehler und beendet die Kaufrunde.
 *
 * @param {{name:string, upgrades:string[]|null}[]} members
 * @param {{name:string, cost:number}[]} items nur erlaubte Typen mit gueltigem Preis
 * @returns {{member:string, item:string, cost:number}[]}
 */
export function equipmentWishlist(members, items) {
  const out = [];
  for (const m of Array.isArray(members) ? members : []) {
    if (!m || !Array.isArray(m.upgrades)) continue;
    const have = new Set(m.upgrades);
    for (const it of Array.isArray(items) ? items : []) {
      if (!have.has(it.name)) out.push({ member: m.name, item: it.name, cost: it.cost });
    }
  }
  out.sort((a, b) => (a.cost - b.cost)
    || (a.item < b.item ? -1 : a.item > b.item ? 1 : 0)
    || (a.member < b.member ? -1 : a.member > b.member ? 1 : 0));
  return out;
}

// ===========================================================================
// DAS WERKZEUG
// ===========================================================================

export async function main(ns) {
  ns.disableLog("ALL");

  const st = {
    round: 0, okRound: 0, errStreak: 0, lastError: null,
    state: "wait", blockedReason: null,
    errors: { total: 0, byCall: {} },
    roundErrors: 0,
    prereq: null, prereqSig: null,
    createAttempts: 0, lastCreateAt: 0, lastCreate: null,
    ascensions: 0, recruits: 0, updates: 0, timeouts: 0,
    inGang: false, faction: null, isHacking: false, members: 0,
    respect: 0, factionRep: null, wanted: 0, penalty: 0, territory: 0, warfare: false,
    taskCounts: {}, playtime: 0, lastWrite: 0,
    // Geldmodus (P2d): Modus der letzten Runde (null, solange nicht gefuehrt), der
    // Rufbedarf daraus (Zahl oder null) mit Grund, die Geldrate des Spiels (je
    // Zyklus), die Ausruestungssummen dieses Prozesses und der Grund, warum die
    // letzte Runde nichts gekauft hat.
    mode: null, repNeed: null, repNeedWhy: "", moneyGainRate: null,
    equipmentBought: 0, equipmentSpent: 0, equipmentBlock: null,
  };
  // Erlaubte Ausruestung (Name + Typ aus EQUIP_TYPES), einmal je Prozess gelesen.
  // null = noch nicht (oder nicht vollstaendig) gelesen; die naechste MONEY-Runde
  // versucht es erneut.
  let equipNames = null;

  const sag = (text) => {
    ns.print(text);
    // Date.now() statt "new Date()": gleiche Uhr wie alles andere hier (und im
    // Test die gestellte). Ortszeit, nicht UTC - siehe localStamp().
    const stamp = localStamp(new Date(Date.now()));
    if (!haengeAnHome(ns, LOG_FILE, stamp + "  " + text + "\n", LOG_MAX_LINES)) {
      // Kein Rueckkanal verfuegbar: nur zaehlen, nicht erneut loggen (sonst
      // Rekursion ueber noteError).
      st.errors.total++;
      st.errors.byCall.log = (st.errors.byCall.log || 0) + 1;
    }
  };

  /** Fehler zaehlen, merken, (gedrosselt) loggen. Nie still. */
  const noteError = (label, e) => {
    const msg = String(e && e.message ? e.message : e);
    st.errors.total++;
    st.errors.byCall[label] = (st.errors.byCall[label] || 0) + 1;
    st.roundErrors++;
    st.lastError = { cls: (e && e.name) || "Error",
      msg: msg.length > 200 ? msg.slice(0, 197) + "..." : msg, at: Date.now(), call: label };
    // Das erste Auftreten je Aufruf sofort, danach jedes 50.
    const n = st.errors.byCall[label];
    if (n === 1 || n % 50 === 0) sag("FEHLER " + label + " (" + n + "x): " + msg);
  };

  /** Ein Aufruf, der werfen kann: Ergebnis oder Fehlerzaehlung. */
  const tryCall = (label, fn) => {
    try {
      return { ok: true, value: fn() };
    } catch (e) {
      noteError(label, e);
      return { ok: false, value: undefined };
    }
  };

  const switchOn = () => {
    const r = tryCall("switch", () => ns.fileExists(SWITCH_FILE, "home"));
    // Nicht lesbar heisst: weiterlaufen. Ein Lesefehler ist kein Befehl zum
    // Aufhoeren, und er ist gezaehlt.
    return r.ok ? r.value === true : true;
  };

  const writeTelemetry = (force) => {
    const now = Date.now();
    if (!force && now - st.lastWrite < TELEMETRY_EVERY_MS) return;
    st.lastWrite = now;
    const p = tryCall("player", () => ns.getPlayer());
    if (p.ok && p.value && Number.isFinite(p.value.totalPlaytime)) st.playtime = p.value.totalPlaytime;
    if (st.inGang && st.faction) {
      const r = tryCall("factionRep", () => ns.singularity.getFactionRep(st.faction));
      if (r.ok) st.factionRep = r.value;
    }
    const block = {
      schema: 2, ts: now, wall: now, playtime: st.playtime, motorTimeMs: 0,
      round: st.round, okRound: st.okRound,
      errStreak: st.errStreak, lastError: st.lastError,
      host: ns.getHostname(), version: VERSION,
      state: st.state, blockedReason: st.blockedReason,
      inGang: st.inGang, faction: st.faction, isHacking: st.isHacking,
      members: st.members, respect: st.respect, factionRep: st.factionRep,
      wanted: st.wanted, penalty: st.penalty, territory: st.territory,
      warfare: st.warfare, taskCounts: st.taskCounts,
      ascensions: st.ascensions, recruits: st.recruits,
      errors: st.errors,
      createAttempts: st.createAttempts, lastCreateAt: st.lastCreateAt,
      lastCreate: st.lastCreate,
      updates: st.updates, timeouts: st.timeouts,
      prereq: st.prereq,
      mode: st.mode, repNeed: st.repNeed, repNeedWhy: st.repNeedWhy,
      moneyGainRate: st.moneyGainRate,
      equipmentBought: st.equipmentBought, equipmentSpent: st.equipmentSpent,
      equipmentBlock: st.equipmentBlock,
    };
    // Selbst geschrieben statt `nachHome()` aus lib/hostdatei.js: dessen
    // try/catch gibt bei einer Ausnahme nur false zurueck und verliert die
    // Ursache. Hier landet sie in lastError (tryCall). Das Muster ist dasselbe:
    // lokal schreiben, von einem Fremdwirt nach home kopieren (`ns.scp` WIRFT
    // nicht, wenn die Quelle fehlt - nur der Rueckgabewert sagt etwas).
    const host = ns.getHostname();
    const done = tryCall("telemetry", () => {
      ns.write(TELEMETRY_FILE, JSON.stringify(block), "w");
      return host === "home" ? true : ns.scp(TELEMETRY_FILE, "home", host) === true;
    });
    if (done.ok && done.value !== true) {
      // Die Zaehlung selbst geht in den naechsten Block ein.
      st.errors.total++;
      st.errors.byCall.telemetry = (st.errors.byCall.telemetry || 0) + 1;
    }
  };

  // --- Die Pause nach einem Gruendungsversuch ueberlebt einen Neustart ---------
  {
    const roh = liesVonHome(ns, TELEMETRY_FILE);
    if (roh) {
      try {
        const alt = JSON.parse(roh);
        const t = Number(alt && alt.lastCreateAt);
        // Ein Zeitstempel aus der Zukunft (Uhrenwechsel, Fremdschreiber) gilt nicht.
        if (Number.isFinite(t) && t > 0 && t <= Date.now()) {
          st.lastCreateAt = t;
          st.lastCreate = alt.lastCreate || null;
        }
      } catch (e) {
        noteError("telemetry_read", e);
      }
    }
  }

  sag("gang.js gestartet auf " + ns.getHostname() + " (" + VERSION + ").");

  // --- Voraussetzungssperre ----------------------------------------------------
  /**
   * Liest data/bn4rep.json und getResetInfo und fragt checkPrereq. Das Ergebnis
   * steht in st.prereq (Telemetrie). Die Logzeile kommt nur, wenn sich der
   * Befund aendert - foundGang() laeuft im 30-s-Takt, ein Dauerlog wuerde das
   * 300-Zeilen-Log in zweieinhalb Stunden fuellen.
   * @returns {boolean} true = alle Voraussetzungen da
   */
  const prereqOk = () => {
    const roh = liesVonHome(ns, BN4REP_FILE);
    let tel = null;
    if (roh) {
      // Eine nicht lesbare Datei zaehlt als Fehler (nicht still): bn4rep.js
      // schreibt sie in einem Zug, ein halber Block waere ein Befund.
      try { tel = JSON.parse(roh); } catch (e) { noteError("bn4rep_parse", e); }
    }
    const ri = tryCall("resetInfo", () => ns.getResetInfo());
    const res = checkPrereq(tel, Date.now(), ri.ok ? ri.value : null);
    st.prereq = { ok: res.ok, missing: res.missing, at: Date.now() };
    // Die Signatur ohne Ziffern: "veraltet (31 min)" wird minuetlich zu "(32
    // min)", und das ist derselbe Befund, keine neue Zeile wert.
    const sig = res.ok ? "ok" : res.missing.map((m) => m.replace(/\d+/g, "#")).join(" | ");
    if (sig !== st.prereqSig) {
      st.prereqSig = sig;
      sag(res.ok
        ? "Voraussetzungen erfuellt (Paket 0 und Paket 1 live, " + BN4REP_FILE + " frisch)."
        : "GRUENDUNG GESPERRT: " + res.missing.join(" | "));
    }
    return res.ok;
  };

  // --- Gruendung ---------------------------------------------------------------
  /** @returns {boolean} ob jetzt eine Gang da ist */
  const foundGang = () => {
    st.state = "wait";
    const now = Date.now();
    const pauseLeft = CREATE_PAUSE_MS - (now - st.lastCreateAt);
    if (st.lastCreateAt > 0 && pauseLeft > 0) {
      st.blockedReason = "create_pause";
      return false;
    }
    // DIE SPERRE VOR DEM UNUMKEHRBAREN SCHRITT. Fehlt etwas, wird weder
    // gegruendet noch ein Versuch gezaehlt: keine Pause, die Voraussetzung
    // wird im naechsten Takt wieder geprueft.
    if (!prereqOk()) {
      st.blockedReason = "prereq_missing";
      return false;
    }
    const p = tryCall("player", () => ns.getPlayer());
    if (!p.ok || !p.value) { st.blockedReason = "player_unreadable"; return false; }
    const joined = Array.isArray(p.value.factions) ? p.value.factions : [];
    const reps = {};
    for (const f of COMBAT_FACTIONS) {
      if (!joined.includes(f)) continue;
      const r = tryCall("factionRep", () => ns.singularity.getFactionRep(f));
      reps[f] = r.ok ? r.value : null;
    }
    const pick = chooseFounder(joined, reps);
    if (!pick.faction) {
      st.blockedReason = pick.reason;
      return false;
    }
    const detail = pick.candidates.map((f) => f + "=" + reps[f]).join(", ");
    // GENAU EIN Aufruf. Zaehler und Marke stehen im Speicher VOR dem Ergebnis
    // (also auch dann, wenn createGang wirft); GESCHRIEBEN werden sie erst
    // nach dem Aufruf (writeTelemetry weiter unten) - ein Kill trifft ohnehin
    // erst am naechsten ns-Aufruf, und ein wiederholtes createGang waere
    // folgenlos (mit Gang gibt es false, ohne Gang laeuft die Pruefung neu).
    st.createAttempts++;
    st.lastCreateAt = Date.now();
    const call = tryCall("createGang", () => ns.gang.createGang(pick.faction));
    const ok = call.ok && call.value === true;
    st.lastCreate = { faction: pick.faction, ok, at: st.lastCreateAt, candidates: detail };
    sag("GRUENDUNG #" + st.createAttempts + ": Kandidaten " + detail + " -> " + pick.faction
      + "; createGang -> " + (call.ok ? String(call.value) : "Fehler"));
    if (!ok) {
      st.blockedReason = "create_failed";
      writeTelemetry(true);
      return false;
    }
    st.blockedReason = null;
    writeTelemetry(true);
    return true;
  };

  // --- Geldmodus: welcher Modus gilt? ------------------------------------------
  /**
   * Faktionsruf und Rufbedarf lesen und chooseMode fragen. `onMoney`: arbeitet
   * schon ein Mitglied auf der Geldaufgabe (gesetzte Aufgaben VOR dieser Runde) -
   * dann gilt die untere Schwelle der Hysterese.
   *
   * Nichts hier wirft nach aussen: jeder Aufruf laeuft ueber tryCall, ein
   * unlesbarer Ruf oder ein fehlender/veralteter Bedarf heisst RESPECT (gang-2).
   * Die Logzeile kommt nur beim Wechsel.
   */
  const decideMode = (faction, onMoney) => {
    const repCall = tryCall("factionRep", () => ns.singularity.getFactionRep(faction));
    const rep = repCall.ok ? repCall.value : NaN;
    if (repCall.ok) st.factionRep = rep;

    const roh = liesVonHome(ns, BN4REP_FILE);
    let tel = null;
    if (roh) {
      // Eine nicht lesbare Datei zaehlt als Fehler (nicht still), wie in prereqOk.
      try { tel = JSON.parse(roh); } catch (e) { noteError("bn4rep_parse", e); }
    }
    const ri = tryCall("resetInfo", () => ns.getResetInfo());
    const res = repNeedOf(tel, Date.now(), ri.ok ? ri.value : null, faction);
    st.repNeed = res.need;
    st.repNeedWhy = res.why;

    const mode = chooseMode({ rep, need: res.need, onMoney });
    if (mode !== st.mode) {
      sag("MODUS " + (st.mode || "-") + " -> " + mode + " (Ruf " + (Number.isFinite(rep) ? Math.round(rep) : "?")
        + ", Bedarf " + (res.need === null ? "keiner: " + res.why : Math.round(res.need)) + ").");
      st.mode = mode;
    }
    return mode;
  };

  // --- Geldmodus: Ausruestung ----------------------------------------------------
  const moneyText = (n) => {
    for (const [t, k] of [[1e12, "t"], [1e9, "b"], [1e6, "m"], [1e3, "k"]]) {
      if (Math.abs(n) >= t) return "$" + (n / t).toFixed(2) + k;
    }
    return "$" + Math.round(n);
  };

  /**
   * Die erlaubten Ausruestungsstuecke (Name) einmal lesen: nur die Typen aus
   * EQUIP_TYPES, ALLES andere bleibt draussen - auch ein unbekannter Typ, auch
   * "Augmentation". Schlaegt ein Typaufruf fehl, wird die Liste nicht gemerkt
   * (die naechste Runde liest neu); das Stueck mit dem Fehler ist diese Runde
   * nicht dabei.
   */
  const readEquipNames = () => {
    const names = tryCall("getEquipmentNames", () => ns.gang.getEquipmentNames());
    if (!names.ok || !Array.isArray(names.value)) return null;
    const allowed = [];
    let complete = true;
    for (const name of names.value) {
      const type = tryCall("getEquipmentType", () => ns.gang.getEquipmentType(name));
      if (!type.ok) { complete = false; continue; }
      if (EQUIP_TYPES.includes(type.value)) allowed.push(name);
    }
    if (complete) equipNames = allowed;
    return allowed;
  };

  /**
   * Ausruestung kaufen - NUR im Modus MONEY (siehe DER GELDMODUS).
   *
   * Im Modus RESPECT wird kein einziger Equipment-Aufruf gemacht. Gekauft wird
   * nur, was nach Abzug der Ruecklage (data/geldbedarf.txt) bezahlbar ist; fehlt
   * die Datei oder ist sie unlesbar, wird nichts gekauft. Mitglieder, die in
   * dieser Runde aufgestiegen sind, kommen erst in der naechsten Runde dran (ihre
   * eingelesene Ausruestung ist veraltet: der Aufstieg hat sie geloescht).
   */
  const buyEquipment = (members, mode) => {
    st.equipmentBlock = null;
    if (mode !== MODE_MONEY) return;

    const names = equipNames || readEquipNames();
    if (!names || !names.length) { st.equipmentBlock = "keine Ausruestungsliste"; return; }

    // Wer fehlt was? Erst die billige Pruefung ohne Preisaufrufe: hat jeder alles,
    // ist hier nichts zu tun (der Dauerzustand).
    const eligible = members.filter((m) => !m.ascended && Array.isArray(m.upgrades));
    const missingNames = names.filter((n) => eligible.some((m) => !m.upgrades.includes(n)));
    if (!missingNames.length) return;

    // Die Ruecklage. Fehlt sie, ist es ein Nein (nicht "0").
    const need = liesVonHome(ns, MONEY_NEED_FILE);
    const reserve = need === "" ? NaN : Number(need);
    if (!Number.isFinite(reserve) || reserve < 0) {
      st.equipmentBlock = MONEY_NEED_FILE + " fehlt oder ist unlesbar";
      return;
    }

    const items = [];
    for (const name of missingNames) {
      const c = tryCall("getEquipmentCost", () => ns.gang.getEquipmentCost(name));
      if (!c.ok) continue;
      if (typeof c.value !== "number" || !Number.isFinite(c.value) || !(c.value > 0)) {
        noteError("getEquipmentCost", new Error("getEquipmentCost(" + name + ") gab " + String(c.value)));
        continue;
      }
      items.push({ name, cost: c.value });
    }
    const wish = equipmentWishlist(eligible, items);
    if (!wish.length) return;

    let bought = 0;
    let spent = 0;
    for (let i = 0; i < wish.length && bought < EQUIP_MAX_BUYS; i++) {
      const w = wish[i];
      const m = tryCall("money", () => ns.getServerMoneyAvailable("home"));
      const money = m.ok && typeof m.value === "number" ? m.value : NaN;
      // Billigste zuerst: ist dieses Stueck nicht bezahlbar, ist es keins der
      // folgenden (NaN faellt hier ebenfalls durch).
      if (!(money - reserve >= w.cost)) { st.equipmentBlock = "Geld unter Preis + Ruecklage"; break; }
      const buy = tryCall("purchaseEquipment", () => ns.gang.purchaseEquipment(w.member, w.item));
      if (!buy.ok) break;
      if (buy.value !== true) {
        noteError("purchaseEquipment", new Error("purchaseEquipment(" + w.member + ", " + w.item + ") gab " + String(buy.value)));
        break;
      }
      bought++;
      spent += w.cost;
    }
    if (bought) {
      st.equipmentBought += bought;
      st.equipmentSpent += spent;
      sag("AUSRUESTUNG: " + bought + " Stuecke fuer " + moneyText(spent) + " (Ruecklage " + moneyText(reserve)
        + ", gesamt " + st.equipmentBought + " Stuecke, " + moneyText(st.equipmentSpent) + ").");
    } else if (!st.equipmentBlock) {
      st.equipmentBlock = "nichts gekauft";
    }
  };

  // --- Fuehrung ----------------------------------------------------------------
  const manageGang = () => {
    const infoCall = tryCall("getGangInformation", () => ns.gang.getGangInformation());
    if (!infoCall.ok || !infoCall.value) { st.blockedReason = "info_unreadable"; return; }
    const info = infoCall.value;
    st.faction = info.faction;
    st.isHacking = info.isHacking === true;
    st.respect = info.respect;
    st.wanted = info.wantedLevel;
    st.penalty = info.wantedPenalty;
    st.territory = info.territory;
    st.warfare = info.territoryWarfareEngaged === true;
    // Die Geldrate des Spiels (je Zyklus, x5 = $/s) - die Messgroesse der Abnahme.
    st.moneyGainRate = Number.isFinite(info.moneyGainRate) ? info.moneyGainRate : null;

    // Eine Hacking-Gang kennt 'Terrorism' nicht. setMemberTask auf einen
    // unbekannten Namen setzt das Mitglied auf "Unassigned" und MELDET DABEI
    // true (`NetscriptFunctions/Gang.ts`, setMemberTask: der Zweig "Invalid
    // task" gibt das Ergebnis von assignToTask("Unassigned") zurueck) - ohne
    // diese Sperre stuenden alle Mitglieder still untaetig. Fuehrung nur fuer
    // Kampfgangs.
    if (st.isHacking) {
      st.state = "blocked";
      st.blockedReason = "hacking_gang";
      return;
    }
    st.state = "work";
    st.blockedReason = null;

    const namesCall = tryCall("getMemberNames", () => ns.gang.getMemberNames());
    if (!namesCall.ok || !Array.isArray(namesCall.value)) return;
    const names = namesCall.value.slice(0, MAX_MEMBERS);

    // Rekrutieren, solange der Respekt reicht.
    for (let i = 0; i < MAX_MEMBERS; i++) {
      if (names.length >= MAX_MEMBERS) break;
      const can = tryCall("canRecruitMember", () => ns.gang.canRecruitMember());
      if (!can.ok || can.value !== true) break;
      const name = freeName(names);
      if (!name) break;
      const rec = tryCall("recruitMember", () => ns.gang.recruitMember(name));
      if (!rec.ok) break;
      if (rec.value !== true) {
        noteError("recruitMember", new Error("recruitMember(" + name + ") gab " + String(rec.value)));
        break;
      }
      names.push(name);
      st.recruits++;
      sag("REKRUTIERT " + name + " (" + names.length + " Mitglieder, Respekt "
        + Math.round(info.respect) + ").");
    }
    st.members = names.length;

    // Mitgliederdaten lesen; ein nicht lesbares Mitglied wird diese Runde
    // uebersprungen (keine Aufgabenaenderung auf Verdacht).
    const members = [];
    for (const name of names) {
      const mi = tryCall("getMemberInformation", () => ns.gang.getMemberInformation(name));
      if (!mi.ok || !mi.value) continue;
      const lvl = {};
      for (const s of STATS) lvl[s] = mi.value[s];
      // upgrades: die gekaufte Ausruestung (Namen), fuer den Geldmodus. Keine Liste
      // heisst "unbekannt" - dann wird fuer dieses Mitglied nichts gekauft.
      members.push({ name, task: mi.value.task, lvl, ascended: false,
        upgrades: Array.isArray(mi.value.upgrades) ? mi.value.upgrades.slice() : null });
    }

    // Der Modus dieser Runde. Arbeitet schon jemand auf der Geldaufgabe (gesetzte
    // Aufgaben VOR dieser Runde), gilt die Hysterese. Abgeleitet, nie gemerkt.
    const mode = decideMode(info.faction, members.some((m) => m.task === TASK_MONEY));

    // Aufstieg. Die Phase kommt aus den Stufen VOR dem Aufstieg.
    for (const m of members) {
      const phase = phaseOf(m.lvl);
      const res = tryCall("getAscensionResult", () => ns.gang.getAscensionResult(m.name));
      if (!res.ok || !res.value) continue;       // undefined = noch nicht aufsteigbar
      if (!shouldAscend(phase, res.value)) continue;
      const asc = tryCall("ascendMember", () => ns.gang.ascendMember(m.name));
      if (!asc.ok) continue;
      m.ascended = true;
      st.ascensions++;
      sag("AUFSTIEG " + m.name + " (" + phase + ", Faktor "
        + ascensionFactor(res.value).toFixed(2) + ", #" + st.ascensions + ").");
    }

    const g = { respect: info.respect, wantedLevel: info.wantedLevel,
      wantedPenalty: info.wantedPenalty, territory: info.territory };
    const plan = planTasks(g, members, mode);
    for (const m of members) {
      const want = plan.assign[m.name];
      if (m.task === want) continue;
      const set = tryCall("setMemberTask", () => ns.gang.setMemberTask(m.name, want));
      if (set.ok && set.value !== true) {
        noteError("setMemberTask", new Error("setMemberTask(" + m.name + ", " + want + ") gab "
          + String(set.value)));
      }
    }
    st.taskCounts = plan.counts;

    // Ausruestung: nur im Modus MONEY (im Modus RESPECT ruft das keinen
    // einzigen Equipment-Befehl). Nach den Aufgaben, damit ein Fehler dort die
    // Fuehrung nicht aufhaelt.
    buyEquipment(members, mode);
  };

  // --- Warten ------------------------------------------------------------------
  const waitUpdate = async () => {
    try {
      // ns.asleep ist von der Nebenlaeufigkeitspruefung ausgenommen und setzt
      // runningFn nicht; nextUpdate setzt es ebenfalls nicht. Der Rueckfall
      // haelt die Schleife (und die Telemetrie) am Leben, wenn der Takt steht.
      const winner = await Promise.race([
        Promise.resolve(ns.gang.nextUpdate()).then(() => "update"),
        Promise.resolve(ns.asleep(UPDATE_TIMEOUT_MS)).then(() => "timeout"),
      ]);
      if (winner === "update") st.updates++; else st.timeouts++;
      return true;
    } catch (e) {
      noteError("nextUpdate", e);
      return false;
    }
  };

  // --- Hauptschleife -----------------------------------------------------------
  for (let round = 0; round < MAX_ROUNDS; round++) {
    st.round = round + 1;
    st.roundErrors = 0;

    if (!switchOn()) {
      st.state = "done";
      st.blockedReason = "switch_off";
      writeTelemetry(true);
      sag("Schalter " + SWITCH_FILE + " fehlt - beende die Steuerung (die Gang laeuft weiter).");
      return;
    }

    let threw = false;
    try {
      st.inGang = ns.gang.inGang() === true;
      if (!st.inGang) {
        st.faction = null;
        st.members = 0;
        if (foundGang()) st.inGang = ns.gang.inGang() === true;
      }
      if (st.inGang) manageGang();
    } catch (e) {
      threw = true;
      noteError("round", e);
    }

    writeTelemetry(false);

    // Warten. Mit Gang am Gang-Takt, ohne Gang im 30-s-Takt.
    let waitFailed = false;
    if (st.inGang) waitFailed = !(await waitUpdate());
    else await ns.sleep(IDLE_SLEEP_MS);

    // errStreak zaehlt Runden in Folge, in denen die Rundenfunktion ODER das
    // Warten eine Ausnahme warf. Einzelne fehlgeschlagene Aufrufe (tryCall)
    // erhoehen nur errors.* - die Steuerung laeuft mit dem Rest weiter.
    if (threw || waitFailed) st.errStreak++;
    else st.errStreak = 0;
    if (!threw && !waitFailed && st.roundErrors === 0) st.okRound++;

    if (st.errStreak >= MAX_ERR_STREAK) {
      st.state = "blocked";
      st.blockedReason = "err_streak";
      writeTelemetry(true);
      sag("ABBRUCH: " + st.errStreak + " Runden in Folge mit Ausnahme - beende mich, der Kern startet neu.");
      return;
    }
    // Nach einem fehlgeschlagenen Warten kurz atmen, statt im Fehlerfall im
    // Kreis zu rennen (nextUpdate wirft ohne Gang sofort).
    if (waitFailed) await ns.sleep(ERROR_BACKOFF_MS);
  }

  // MAX_ROUNDS erreicht: sauber beenden, der Kern startet neu.
  st.state = "done";
  st.blockedReason = "max_rounds";
  writeTelemetry(true);
  sag("MAX_ROUNDS erreicht - beende mich zum Neustart durch den Kern.");
}
