/**
 * Der Bladeburner-Motor.
 *
 * WOZU
 *
 * In BitNode 6 und 7 fuehrt der Weg zu w0r1d_d43m0n nicht ueber das
 * Hackniveau, sondern ueber 21 Black Operations: `destroyW0r1dD43m0n`
 * akzeptiert beides (Singularity.ts:1124-1176). Der Hacking-Weg ist hier
 * versperrt - WorldDaemonDifficulty 2 hebt das Ziel auf Level 6.000, waehrend
 * HackExpGain 0,25 jede Erfahrung viertelt.
 *
 * Vorbedingung ist der Beitritt zur Division, und der verlangt alle vier
 * Kampfwerte auf 100 (NetscriptFunctions/Bladeburner.ts:356). Darum kuemmert
 * sich bbtrain.js; dieses Skript wartet, bis es soweit ist.
 *
 * DIE ENTSCHEIDUNGSREGEL
 *
 * Bladeburner ist ein Spiel gegen die Ausfallwahrscheinlichkeit. Jede Aktion
 * hat eine geschaetzte Erfolgsspanne, und der Bot bekommt sie als Paar
 * [min, max] geliefert (getSuccessRange, Bladeburner.ts:142). Zwei Dinge
 * folgen daraus:
 *
 *   - Gerechnet wird mit dem MINIMUM, nie mit dem Mittelwert. Die Spanne ist
 *     Ausdruck der Unkenntnis ueber die Synthoid-Population; wer mit ihrer
 *     Mitte plant, plant mit einer Zahl, die das Spiel nie zugesagt hat.
 *   - Ist die Spanne breit, ist nicht die Aktion schlecht, sondern die
 *     Schaetzung. Dann hilft Field Analysis, nicht ein Versuch auf gut Glueck.
 *
 * Ein misslungener Vertrag kostet Rang und Zeit, eine misslungene Black Op
 * kostet zusaetzlich den Versuch selbst - deshalb steigt die geforderte
 * Sicherheit mit dem Einsatz: 0,80 fuer Vertraege, 0,85 fuer Operationen,
 * 0,99 fuer Black Ops.
 *
 * WARUM KEIN SCHLAF, SONDERN nextUpdate
 *
 * ns.bladeburner.nextUpdate() kostet 0 GB (RamCostGenerator.ts:378,
 * CycleTiming) und weckt genau dann, wenn die Division ihren Zustand
 * fortgeschrieben hat. Ein fester Schlaf waere entweder zu langsam (verpasste
 * Ticks) oder zu schnell (Leerlaufaufrufe, die je 4 GB kosten).
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");

  const V = "Contracts", O = "Operations", B = "Black Operations", G = "General";

  // Schwellen. Siehe Kopf - je teurer der Fehlschlag, desto hoeher.
  // GEMESSEN, NICHT GERATEN (25.08.2026, 16:45, Rang 0,7 nach 15 Minuten).
  //
  // Hier stand 0,80. Das hat den Motor in eine Sackgasse gefuehrt, die von
  // aussen wie Arbeit aussah: Die Schaetzungen waren laengst scharf (Spanne
  // 0,076 bei Tracking), also griff die Field-Analysis-Regel nicht mehr -
  // aber kein einziger Vertrag kam ueber 0,80, also fiel der Motor auf
  // "Training" durch und blieb dort. Training gibt KEINEN Rang. Nach einer
  // Viertelstunde in der Division stand der Rang bei 0,7 von 3.500.
  //
  // Die gemessenen Erfolgschancen beim Eintritt:
  //   Tracking       0,628 - 0,703
  //   Retirement     0,397 - 0,445
  //   Bounty Hunter  0,318 - 0,356
  //
  // 0,80 ist fuer Vertraege die falsche Groesse. Ein misslungener Vertrag
  // kostet etwas Rang und etwas Chaos - er wirft nicht den Lauf weg wie eine
  // misslungene Black Op. Was zaehlt, ist der Erwartungswert, und der ist ab
  // etwa der Haelfte klar positiv. Dazu kommt: Vertraege geben Kampferfahrung
  // UND Rang UND Geld, Training nur Erfahrung. Ein spielbarer Vertrag schlaegt
  // Training immer.
  //
  // Fuer Operationen und Black Ops bleibt es bei den hohen Schwellen: Dort ist
  // der Fehlschlag teuer, und dort wartet man zu Recht.
  // NACHGESCHAERFT AM 25.08. UM 18:12, nachdem der Motor erneut in Training fiel.
  //
  // Gemessen in diesem Moment:
  //   Tracking       min 0,678  offen 0,4   Stufe 10  <- leergespielt
  //   Retirement     min 0,493  offen 116,6 Stufe 1
  //   Bounty Hunter  min 0,398  offen 171,8 Stufe 1
  //   Chaos 0, Overclock bereits auf Stufe 2
  //
  // Der Vorrat an Tracking war aufgebraucht (Vertraege haben endliche Zahlen und
  // wachsen nur langsam nach, Bladeburner.ts:1387-1390). Damit blieb nur
  // Retirement mit 0,493 - sieben Tausendstel unter der Schwelle. Der Motor
  // wartete also auf nichts und fuhr stattdessen Training, das keinen Rang gibt.
  //
  // 0,45 statt 0,50: Ein misslungener Vertrag kostet Zeit und ein wenig Chaos,
  // aber keinen Rang. Verglichen wird nicht mit einem besseren Vertrag, sondern
  // mit Training - und das liefert garantiert null. Bei knapp der Haelfte
  // Erfolgswahrscheinlichkeit und dem doppelten Rangertrag von Tracking
  // (rankGain 0,6 gegen 0,3) ist die Rechnung eindeutig.
  const SICHER_VERTRAG = 0.45;
  // Chaos-Aufraeumen. Die Grenze 50 ist `ChaosThreshold` aus dem Spiel
  // (`data/Constants.ts`), nicht gewaehlt; 47 ist der Ausschaltpunkt.
  const CHAOS_EIN = 50;
  const CHAOS_AUS = 47;
  // Untergrenze der Stadtbevoelkerung, ab der Stealth Retirement als
  // Chaos-Senker abgeschaltet wird. 0,8e9 laesst `(pop/1e9)^0,7` auf 0,86
  // fallen - Raid stuende dann bei rund 0,77 statt 0,90 und bliebe fahrbar.
  const SR_POP_MIN = 0.8e9;
  // 0,70 und nicht 0,95: Die Chaos-Senkung von Stealth Retirement steht im
  // Quellcode **ausserhalb** der Erfolgspruefung (`Bladeburner.ts:846-854` -
  // nur `changePopulationByPercentage` haengt an `if (success)`,
  // `changeChaosByPercentage` nicht). Ein Fehlschlag senkt das Chaos also
  // genauso und kostet nur `rankLoss` 2 x 1,11^4 = 3,0 Rang. Der
  // Break-even gegen Diplomacy liegt damit bei p > 0,083 - alles darueber
  // ist ein Gewinn. 0,70 ist die Grenze fuer den HP-Verlust, nicht fuer den
  // Rang: Fehlschlaege kosten Leben und damit Kammerzeit.
  //
  // Gemessen 20:44 nach dem Stadtwechsel: In Chongqing steht die Spanne bei
  // 0,909 bis 1,000 - die alte 0,95er Grenze auf die UNTERgrenze hat die
  // Regel dort stillgelegt, obwohl der Erwartungswert bei 0,95 lag.
  const SR_CHANCE_MIN = 0.70;
  const SPIEL_CHAOS_AN = true;
  // RAID IST WIEDER AN (27.08.2026, 19:54) - die Ablehnung von 26.08. stand
  // auf einer Groesse, die Raid gar nicht beruehrt.
  //
  // Damals verworfen mit: "Bei Charisma 27 liegt die effektive Zyklusrate bei
  // 1,02 gegen 1,34 fuer Tracking, Gleichstand erst bei Charisma 440." Zwei
  // Dinge daran stimmen heute nicht mehr:
  //
  //  1. **Charisma ist 264, nicht 27** (Spielstand, 27.08. 19:50). Die alte
  //     Rechnung ging von einem Stand aus, der einen Monat zurueckliegt.
  //  2. **Charisma wirkt auf Raid ueberhaupt nicht.** `data/Operations.ts:120`
  //     sagt woertlich "Unaffected by Charisma", und in den `weights` steht
  //     kein charisma. Der Zusammenhang lief nur ueber die Truppkosten: Raid
  //     verbraucht Mitglieder, und Rekrutierung haengt an Charisma. Bei 264
  //     kostet ein Mann 206 Sekunden bei Erfolgschance 1,00 - das ist kein
  //     Argument mehr.
  //
  // Gemessen am 27.08. um 19:52 (`data/bbspann.json`, Sector-12):
  //
  //     Raid            80,01 Rang/min   Chance 0,919   794 Laeufe offen
  //     Bounty Hunter    8,90            Arbeitsanteil 1,00
  //     laufende Rate   18 bis 32 Rang/min ueber 45 Minuten
  //
  // Also **Faktor 2,5 bis 4,4 auf die Leitgroesse**. Der Arbeitsanteil von 1
  // heisst: 2,2 Ausdauer je Minute gegen 3,07 Regeneration - Raid laesst sich
  // durchgehend fahren, ohne Kammerpausen.
  //
  // DER PREIS, DER IN DER RECHNUNG BLEIBEN MUSS: Raid senkt die
  // Synthoid-Bevoelkerung und hebt das Chaos, beides prozentual
  // (`data/Operations.ts:119`). Die Bevoelkerung steckt in
  // `getPopulationSuccessFactor = (pop/1e9)^0,7` (`Actions/Action.ts:88-92`)
  // und wirkt damit auf JEDE Aktion ausser Black Ops - Sector-12 steht bei
  // popEst 1,109e9, also Faktor 1,075. Faellt die Bevoelkerung unter 1e9,
  // dreht der Hebel ins Minus. Deshalb bleibt `RAID_CHAOS_MAX` scharf, und
  // die Nachmessung in `nodes/HEBEL.md` prueft ausdruecklich popEst mit.
  const RAID_AN = true;
  const RAID_GELD_MIN = 2e9;
  const RAID_CHAOS_MAX = 50;
  const RAID_CHANCE_MIN = 0.08;
  const RAID_VORRAT_MIN = 3;
  // Charisma-Riegel entschaerft: Er sollte die Truppkosten abbilden, nicht
  // Raid selbst. Bei 264 steht die Rekrutierungschance auf 1,00 (die Formel
  // klemmt erst ab zwoelf Mitgliedern), also ist die Bedingung erfuellt,
  // sobald ueberhaupt rekrutiert werden kann.
  const RAID_CHARISMA_MIN = 200;
  // Ab wieviel Gemeinden sich ein Stadtwechsel lohnt. Zehn sind rund 970 Rang
  // bei Raid-Stufe 7 - genug, um die Diplomacy-Phase zu bezahlen, die der
  // Wechsel nach sich zieht.
  const RUNDREISE_MIN_COMMS = 10;
  const STAEDTE = ["Sector-12", "Aevum", "Volhaven", "Chongqing",
    "New Tokyo", "Ishima"];
  let chaosAufraeumen = false;
  const chaosLage = () => {
    try { return ns.bladeburner.getCityChaos(ns.bladeburner.getCity()); }
    catch { return 0; }
  };
  const SICHER_OPERATION = 0.85;
  // Stufenaufbau von Assassination - siehe den Block bei "2c." weiter unten.
  const ASSASSIN_AUFBAU = true;
  const ASSASSIN_ZIEL_STUFE = 12;
  // SCHWELLE FUER BLACK OPS: 0,80 STATT 0,99 (27.08.2026, 06:56).
  //
  // 0,99 war nie gerechnet, sondern vorsichtig gesetzt. Bei 21 Black Ops mit
  // steigender Schwierigkeit heisst das aber unter Umstaenden: nie.
  //
  // Die Rechnung fuer Operation Typhoon (`data/BlackOperations.ts:10-14`:
  // baseDifficulty 2000, rankGain 50, rankLoss 10, hpLoss 100):
  //
  //   statFac  = 0,5 * (agi^0,04 + dex^0,035 + agi/1e4 + dex/1e4) = 1,234
  //              bei agi 161, dex 209 (`Actions/Action.ts:105-120`)
  //   Dauer    = 2000/10 * 0,86 (Overclock 14) / 1,234 * 1,5 = **209 s**
  //              (`getActionTimePenalty` gibt fuer Black Ops 1,5)
  //   Ertrag/min = (chance*50 - (1-chance)*10) / 3,49
  //
  // Gegen die derzeit beste Alternative - Bounty Hunter mit Zyklusrate rund
  // 2,0 - liegt der Gleichstand bei **chance 0,283**. Alles darueber ist
  // besser als weiterzufahren wie bisher.
  //
  // Trotzdem nicht 0,283, sondern 0,80. Der Grund ist der HP-Verlust: 100
  // gegen eine Hoechstgrenze um 23 heisst Krankenhaus bei JEDEM Fehlschlag,
  // und das kostet `min(Geld * 0,1, ...)` (`Hospital.ts:4-10`) - bei 3,6
  // Milliarden also 360 Millionen je Versuch. Bei 0,80 ist jeder fuenfte
  // Versuch ein Fehlschlag statt jeder dritte, der Ertrag liegt bei
  // (48-2)/3,49 = **13,2 Rang je Minute** gegen 2,0.
  //
  // Wer die Schwelle spaeter weiter senken will, hat mit 0,283 die harte
  // Untergrenze und mit dem Guthaben den Grund - nicht mit dem Bauchgefuehl.
  // Von 0,80 auf 0,40 am 27.08. um 12:49: die alte Begruendung uebersah den
  // zweiten Term der Krankenhauskosten. Rechnung in nodes/HEBEL.md.
  // BLACK OPS ERST BEI HOHER CHANCE FAHREN (27.08.2026, 21:55).
  //
  // Die Schwelle stand auf 0,40, und das war aus einer falschen Frage
  // abgeleitet: "ab wann ist ein Versuch nicht mehr verschwenderisch?"
  // Richtig ist "wann ist es billiger als die Alternative?" - und die
  // Alternative ist Raid.
  //
  // GEMESSEN 21:52 (`src/bodauer.js`), Rang 13.209:
  //
  //     Operation Ares         469 s   Chance 0,405 - 0,637
  //     Operation Archangel    703 s          0,289 - 0,455
  //     Operation Juggernaut   938 s          0,202 - 0,318
  //     Operation Red Dragon  1172 s          0,154 - 0,242
  //     Raid                    72 s   118 Rang  =  98,3 Rang/min
  //
  // Eine Black Op kostet erwartet `Dauer / p` Sekunden. Fuer Ares bei
  // p = 0,52 sind das 902 s = 15,0 Minuten fuer `rankGain` 125
  // (`data/BlackOperations.ts:152`). In derselben Zeit brachte Raid 1.475
  // Rang. **Nettokosten: 1.350 Rang.** Bei p = 0,95 waeren es 494 s und
  // damit nur 681 - **669 Rang gespart, allein bei dieser einen.**
  //
  // Fuer Red Dragon ist der Unterschied dramatisch: 5.860 s bei p = 0,20
  // gegen 1.234 s bei p = 0,95 - **7.577 Rang.**
  //
  // WARUM WARTEN NICHTS KOSTET: Der Engpass ist der Rang (400.000 fuer
  // Daedalus), nicht die Zahl der abgehakten Black Ops. Ihre 73.660 Rang
  // zaehlen zum selben Ziel, egal wann sie anfallen. Und p steigt von allein:
  // `skillPoints = floor(maxRank/3)` (`Bladeburner.ts`) bei linear
  // steigenden Faehigkeitskosten (`Skill.ts:37-41`) - wer Rang sammelt,
  // sammelt Chance mit.
  //
  // Die Gesamtzeit ist `(400.000 - 73.660)/Raidrate + Summe(Dauer_i / p_i)`.
  // Der erste Term haengt nicht davon ab, WANN die Black Ops fallen; der
  // zweite wird kleiner, je hoeher p ist. Also: so spaet wie moeglich.
  //
  // 0,90 statt 0,99, weil die letzten Prozentpunkte lange brauchen und der
  // Gewinn dort flach wird (bei p = 0,90 gegen 0,95 sind es fuer Ares 60
  // Rang).
  //
  // OFFENE FLANKE, als Baustelle eingetragen: Geht der Raid-Vorrat in allen
  // sechs Staedten zur Neige (384 Gemeinden, rund 45.000 Rang), ist Raid
  // nicht mehr die Alternative - dann gehoert die Schwelle zurueck auf 0,40.
  // Solange Raid die Alternative ist, wird gewartet (0,90). Ist der Vorrat
  // aufgebraucht, ist Warten sinnlos - dann faellt die Schwelle zurueck auf
  // die alte 0,40. Siehe `blackOpSchwelle()` weiter unten.
  const SICHER_BLACKOP = 0.90;
  const SICHER_BLACKOP_OHNE_RAID = 0.40;
  // Ab wieviel Gemeinden ueber ALLE Staedte sich das Warten noch lohnt. 20
  // sind bei Stufe 9 rund 2.360 Rang - genug, um die Wartezeit auf eine
  // bessere Black-Op-Chance zu ueberbruecken.
  const RAID_VORRAT_GESAMT_MIN = 20;
  // Zielgroesse des Trupps. Sechs, weil der Bonus mit Exponent 0,05 waechst
  // und der Grenznutzen danach um Faktor drei einbricht - Rechnung im Block
  // "2b. Den Trupp auffuellen" weiter unten. 0 schaltet die Regel ab.
  const TRUPP_ZIEL = 6;
  // Ab dieser Spannenbreite ist die Schaetzung das Problem, nicht die Aktion.
  const SPANNE_ZU_BREIT = 0.10;
  // Ausdauer. Die Strafe ist min(1, stamina/(0,5*max)) (Bladeburner.ts:167-169)
  // und wirkt an genau einer Stelle: competence *= staminaPenalty
  // (Action.ts:176). OBERHALB VON 50 PROZENT IST SIE EXAKT 1 - jede Ausdauer
  // darueber ist wertlos.
  //
  // Bis zum 25.08.2026 stand hier 55 / 90 Prozent. Der Bot ruhte damit ab
  // einem Punkt, an dem er noch volle Leistung hatte, und ruhte dann bis zu
  // einem Wert, der ihm nichts brachte. Gemessen zwischen 19:40 und 19:59:
  // neunzehn Minuten Regenerationskammer bei unveraendertem Rang 73, waehrend
  // die Ausdauer bei 29 von 53 stand - 54,7 Prozent, Strafe 1,0, also keine.
  //
  // Jetzt: ruhen erst unter 52 Prozent, weiterarbeiten ab 60. Der schmale
  // Streifen ist Absicht - er haelt den Bot dicht ueber der Strafgrenze,
  // statt ihn eine Reserve aufbauen zu lassen, die keine Wirkung hat.
  // Ausdauer regeneriert ohnehin passiv weiter, auch waehrend der Arbeit
  // (Bladeburner.ts:1382), die Kammer verdoppelt das nur.
  // DIE RUHESPANNE WAR DOPPELT SO BREIT WIE NOETIG (26.08.2026, 07:46).
  //
  // Nach dem Krankenhaus-Hebel von 06:55 ist die Ausdauer der letzte Grund,
  // aus dem der Motor noch ruht - gemessen 33,5 Prozent der Zeit. Die Spanne
  // von 52 auf 60 Prozent sind acht Prozent der Hoechstausdauer, bei 64 also
  // gut fuenf Punkte. Die Regeneration betraegt rund 1,2 je Minute
  // (Bladeburner.ts:1317-1325), macht vier Minuten Ruhe je Zyklus.
  //
  // Die Haelfte davon ist geschenkt: Die Strafe beginnt erst UNTER 50 Prozent
  // (`min(1, stamina/(0,5*max))`, Bladeburner.ts:167-169). Alles zwischen 50
  // und 100 Prozent ist gleich gut. Eine Spanne von 51 auf 56 haelt denselben
  // Sicherheitsabstand zur Strafgrenze und halbiert die Ruhezeit.
  //
  // Erwartung: Der Kammeranteil faellt von 33,5 auf unter 25 Prozent, die
  // Rangrate steigt entsprechend um rund ein Zehntel.
  const AUSDAUER_RUHE = 0.51;
  const AUSDAUER_WEITER = 0.56;
  // Trefferpunkte. Die Kammer heilt nebenbei 2 HP je Durchlauf
  // (Bladeburner.ts:1198). Solange lange geruht wurde, geschah das von selbst;
  // bei der kurzen Ruhe oben nicht mehr. Ohne eigene Schwelle liefe der Bot
  // sonst mit sinkenden HP weiter, bis ihn ein Einsatz ins Krankenhaus bringt.
  const HP_RUHE = 0.50;
  // 0,95 WAR EINE FALLE (25.08.2026, 20:47).
  //
  // Die erste Fassung ruhte, bis die Trefferpunkte fast voll waren. Gemessen
  // um 20:46: 14 von 22, also 64 Prozent. Da jeder Vertrag neuen Schaden
  // macht, ist die 95-Prozent-Marke im laufenden Betrieb kaum je erreichbar -
  // einmal in der Ruhe, blieb der Motor dort haengen, und zwar unsichtbar,
  // weil dieser Zweig keine Telemetrie schrieb.
  //
  // 0,75 ist erreichbar (die Kammer heilt 2 HP je Durchlauf) und laesst
  // trotzdem Puffer: Unter 50 Prozent wird geruht, ab 75 wieder gearbeitet.
  const HP_WEITER = 0.75;

  // Reihenfolge der Faehigkeiten.
  //
  // OVERCLOCK STAND HIER AUF PLATZ 1 UND IST DORT WERTLOS (26.08.2026, 12:20).
  //
  // Die alte Begruendung lautete: Overclock senkt die Dauer JEDER Aktion und
  // wirkt damit auf alles andere. Das stimmt, solange die ZEIT der Engpass
  // ist. Sie ist es nicht: Der Motor steht rund die Haelfte der Zeit in der
  // Regenerationskammer und wartet auf Ausdauer.
  //
  // Der Ausdauerverlust faellt JE AKTION an, nicht je Zeit
  // (`Bladeburner.ts:921`: `stamina -= BaseStaminaLoss * difficultyMultiplier`,
  // BaseStaminaLoss 0,285). Eine um ein Prozent kuerzere Aktion heisst also ein
  // Prozent mehr Aktionen je Minute UND ein Prozent mehr Verbrauch je Minute.
  // Nachgerechnet mit Verbrauch V = 2,7 und Regeneration R = 1,2 je Minute:
  //
  //     ohne Overclock   Arbeit S/1,5000   Ruhe S/1,2   Rate 0,4444 * g/T
  //     mit  Overclock   Arbeit S/1,5273   Ruhe S/1,2   Rate 0,4445 * g/T
  //
  // Der Gewinn ist ein Zehntausendstel. Overclock zahlt sich erst aus, wenn
  // die Ausdauer nicht mehr klemmt - deshalb steht es jetzt hinter dem, was
  // genau diesen Engpass hebt, und behaelt seinen Deckel bei Stufe 90.
  //
  // CYBER'S EDGE steht dafuer auf Platz 1. Es hebt `getSkillMult(Stamina)` um
  // 2 Prozent je Stufe, und der Multiplikator steckt in BEIDEN Formeln:
  // `calculateMaxStamina` (`Bladeburner.ts:1327-1343`) und
  // `calculateStaminaGainPerSecond` (`:1317-1325`). Die Ruhezeit S/R bleibt
  // damit gleich, die Arbeitszeit S/(V-R) waechst ueberproportional, weil V
  // fest bleibt und nur R steigt. Fuenf Stufen (+10 Prozent) bringen rund
  // zehn Prozent Rangrate.
  //
  // Der Deckel 5 ist Absicht: Die Kosten sind `1 + 3 * Stufe` und damit
  // quadratisch kumulativ (5 Stufen = 35 Punkte, 8 Stufen = 92), der Nutzen
  // dagegen linear. Ohne Deckel fraesse die Faehigkeit jeden weiteren Punkt.
  //
  // NACHTRAG 12:52 - OVERCLOCK GEHOERT ANS ENDE, NICHT AUF PLATZ 2.
  //
  // Gemessen ueber `data/bbspann.json`: Overclock stand auf **Stufe 14**,
  // Blade's Intuition auf **Stufe 0**. Die vierzehn Stufen haben kumulativ
  // rund 169 Punkte gekostet (`Summe(3 + 1,4*i)`, i = 0..13) - in eine
  // Faehigkeit, deren Wirkung im Ausdauer-Engpass oben mit 0,4444 gegen
  // 0,4445 beziffert ist. Auf Platz 2 haette sie sich das sofort wiedergeholt,
  // sobald Cyber's Edge am Deckel steht.
  //
  // Entscheidend ist eine andere Zahl: **Operation Typhoon, die naechste
  // Black Operation, hat eine Erfolgschance von 0,025.** Der Rang 2.500 ist
  // nur die Eintrittskarte - danach sind 21 Black Ops zu bestehen, und bei
  // zweieinhalb Prozent ist das aussichtslos. Die Erfolgschance ist die
  // eigentliche Ausgangsbedingung dieses Knotens, nicht der Rang.
  //
  // Die Chancen-Faehigkeiten wirken laut `Actions/Action.ts:184-187` auf
  // Contracts, Operations UND Black Ops. Blade's Intuition kostet in der
  // ersten Stufe **3 Punkte** und hebt die Chance jeder Aktion um 3 Prozent;
  // Overclock kostet in Stufe 15 **23 Punkte** und bewegt nichts. Damit
  // steht die Reihenfolge fest.
  // REIHENFOLGE NACH NUTZEN JE PUNKT (26.08.2026, 18:50).
  //
  // Die Kosten sind LINEAR, nicht exponentiell:
  // `(baseCost + level * costInc) * mult` (`Bladeburner/Skill.ts:37-41`). Das
  // aendert alles - eine Faehigkeit wird mit jeder Stufe nur langsam teurer,
  // und die billigen Stufe-0-Kaeufe sind konkurrenzlos.
  //
  // Gemessen 18:45 aus `data/bbspann.json`, Nutzen je Punkt bei der jeweils
  // aktuellen Stufe:
  //
  //   Faehigkeit          Stufe  Preis  Wirkung           je Punkt
  //   Short-Circuit           0      2  +5,5% Retirement     2,75
  //   Tracer                  0      2  +4%   Contracts      2,00
  //   Evasive System          0      2  +4%   dex/agi        2,00
  //   Reaper                  0      2  +2%   Kampfwerte     1,00
  //   Digital Observer        1      4  +4%   Operations     0,98
  //   Blade's Intuition      10     24  +3%   alles          0,125  <- gekauft
  //
  // Der alte Plan hatte Blade's Intuition auf Platz 2 mit `Infinity`. Es
  // frass damit jeden Punkt, waehrend sechs Faehigkeiten auf Stufe 0 standen,
  // die je Punkt das **Sechzehn- bis Zweiundzwanzigfache** liefern. Am 26.08.
  // um 18:37 lagen deshalb 21 Punkte eine Stunde lang ungenutzt herum - der
  // Motor sparte auf die teuerste Stufe im Feld.
  //
  // Die Deckel sind der Gleichstandspunkt, nicht geraten: Blade's Intuition
  // liefert bei Stufe n `3/(3+2,1n)`, Tracer bei Stufe m `4/(2+2,1m)`. Gleich
  // sind sie bei `m = (6 + 8,4n)/6,3`, fuer n=10 also **m = 14,3**. Tracer
  // gehoert damit auf Stufe 14, bevor Blade's Intuition seine elfte kauft.
  //
  // Der Aktionsmix entscheidet die Reihenfolge innerhalb der billigen: Der
  // Motor faehrt derzeit fast nur Vertraege (Tracking, Bounty Hunter,
  // Retirement), deshalb Tracer vor Short-Circuit vor den Kampfwerten.
  // Digital Observer und Cloak stehen hinten, weil Operationen und
  // Stealth-Vertraege kaum vorkommen.
  // DECKEL NUR NOCH FUER DAS, WAS NICHT SORTIERT WIRD (27.08.2026, 20:33).
  //
  // Bis hierher hatten sechs Faehigkeiten feste Deckel, obwohl vier davon in
  // `DYNAMISCH` stehen und damit ohnehin nach Nutzen je Punkt geordnet werden.
  // Ein Deckel neben einer Sortierung ist kein zweites Sicherheitsnetz - er
  // hebelt sie aus. Gemessen um 20:33 (`src/skillcheck.js`):
  //
  //     Faehigkeit         Stufe  Preis  Nutzen   Wert je Punkt
  //     Hyperdrive             7     19   0,738   0,0388  <- gedeckelt
  //     Digital Observer      15     34   1,100   0,0324     wird gekauft
  //     Evasive System        17     38   1,035   0,0272  <- gedeckelt
  //     Reaper                16     36   0,944   0,0262  <- gedeckelt
  //     Blade's Intuition     30     66   1,579   0,0239     wird gekauft
  //     Short-Circuit         30     65   1,142   0,0176  <- gedeckelt
  //
  // **Hyperdrive haette den besten Wert von allen** und stand still. Das ist
  // an einem Tag der fuenfte Fall derselben Art: 12:52 Hyperdrive, 13:19
  // Short-Circuit, 15:53 Reaper und Evasive System, 18:55 Digital Observer -
  // jedes Mal lag die bessere Option gedeckelt daneben, und jedes Mal wurde
  // der Deckel einzeln hochgesetzt. Das Muster ist der Fehler, nicht die
  // einzelne Zahl.
  //
  // Deshalb: Wer in `DYNAMISCH` steht, bekommt `Infinity`. Die Sortierung
  // entscheidet, und sie rechnet den Grenznutzen bei der aktuellen Stufe -
  // genau das, was ein Deckel grob nachbilden sollte. Deckel bleiben nur, wo
  // nicht sortiert wird:
  //
  //   Cyber's Edge  5  - wirkt ueber die Ausdauer auf den Arbeitsanteil, und
  //                      der ist bei 1,00 angekommen. Mehr bringt dort nichts.
  //   Tracer       14  - SuccessChanceContract, und Vertraege stehen bei 0,92
  //                      bis 1,00. Die Chance klemmt, der Nutzen ist null.
  //   Overclock    90  - das Maximum des Spiels; die Zahl ist keine Wahl.
  const SKILL_PLAN = [
    // Die sechs dynamischen zuerst - ihre Reihenfolge hier ist ohne Belang,
    // `faehigkeitenKaufen()` sortiert sie bei jedem Kauf neu.
    ["Hyperdrive", Infinity],
    ["Short-Circuit", Infinity],
    ["Digital Observer", Infinity],
    ["Cloak", Infinity],
    ["Reaper", Infinity],
    ["Evasive System", Infinity],
    // Ab hier statisch, mit begruendetem Deckel.
    ["Cyber's Edge", Infinity],
    ["Tracer", 14],
    ["Blade's Intuition", Infinity],
    ["Overclock", 90],
  ];

  const sag = (t) => ns.print(t);
  // Damit die Sparmeldung nicht bei jedem Bladeburner-Tick erneut im Log steht.
  let letzterSparziel = "";

  // --- Warten, bis der Beitritt steht --------------------------------------
  while (!ns.bladeburner.inBladeburner()) {
    sag("Noch nicht in der Division - warte (bbtrain.js trainiert).");
    await ns.sleep(30000);
  }
  sag("In der Division. Motor laeuft.");

  const VERTRAEGE = ns.bladeburner.getContractNames();
  const OPERATIONEN = ns.bladeburner.getOperationNames();
  const SKILLS = new Set(ns.bladeburner.getSkillNames());

  // Erfolgsspanne einer Aktion als {min, max}. Das Spiel liefert ein Paar;
  // aeltere Fassungen lieferten eine einzelne Zahl - beides wird angenommen,
  // damit ein Versionswechsel den Motor nicht stillegt.
  const spanne = (typ, name) => {
    try {
      const r = ns.bladeburner.getActionEstimatedSuccessChance(typ, name);
      if (Array.isArray(r)) return { min: r[0], max: r[1] };
      return { min: r, max: r };
    } catch { return { min: 0, max: 0 }; }
  };

  const offen = (typ, name) => {
    try { return ns.bladeburner.getActionCountRemaining(typ, name); }
    catch { return 0; }
  };

  // --- Faehigkeiten kaufen -------------------------------------------------
  // Punkte liegen zu lassen ist immer falsch: Sie verfallen nicht, aber jede
  // Runde ohne den Bonus ist verloren. Gekauft wird strikt nach Plan, nicht
  // nach Preis - der billigste Kauf ist selten der wirksamste.
  // DREI FAEHIGKEITEN WERDEN DYNAMISCH SORTIERT (27.08.2026, 13:49).
  //
  // Ein fester Rang veraltet zwangslaeufig: Die Kosten steigen linear mit der
  // Stufe (`Bladeburner/Skill.ts:37-41`), der Nutzen je Stufe bleibt gleich -
  // also faellt der Nutzen je Punkt monoton, und die beste Faehigkeit wandert.
  // Am 27.08. lag deswegen zweimal eine viel bessere Option gedeckelt daneben
  // (Hyperdrive 1,451 und Short-Circuit 0,122 gegen Blade's Intuition 0,031).
  //
  // Sortiert werden NUR diese drei - die einzigen, deren Wirkung auf die
  // Black-Op-Chance gerechnet ist. Digital Observer trifft nur Operations,
  // Cloak nur Stealth, Hands of Midas nur Geld; ein blinder Vergleich ueber
  // alle zwoelf kaufte Unsinn. Der Rest des Plans behaelt seine feste Folge.
  //
  // Verglichen wird der RELATIVE Zuwachs: Die Multiplikatoren verrechnen sich
  // multiplikativ, ein Prozentpunkt auf 1,66 ist mehr wert als auf 2,65.
  // DIE ABDECKUNG GEHOERT IN DIE RECHNUNG (27.08.2026, 18:55).
  //
  // Bis hierher verglich `relNutzen` nur die Multiplikatoren. Das
  // benachteiligt Digital Observer schwer: Er stand nach einem ganzen Tag auf
  // **Stufe 1**, weil er zwar im Plan steht, aber hinter
  // `["Blade's Intuition", Infinity]` - und ein Infinity-Deckel wird nie
  // erreicht. Er kam also nie an die Reihe.
  //
  // Dabei ist er die mit Abstand billigste Chance-Faehigkeit, die auf Black
  // Ops wirkt: `BlackOperation.getActionTypeSkillSuccessBonus =
  // operationSkillSuccessBonus` (`Actions/BlackOperation.ts:69`), und das ist
  // `getSkillMult(SuccessChanceOperation)` (`Actions/Operation.ts:92-94`).
  // Er trifft damit **21 von 21** Black Ops, waehrend Short-Circuit (isKill)
  // 15 davon trifft und Cloak (isStealth) drei.
  //
  // Gerechnet auf den Stand von 18:53, Preise nach
  // `(baseCost + stufe*costInc)` (`Bladeburner/Skill.ts:37-41`):
  //
  //     Digital Observer   St. 1  Preis  4  0,962 % je Punkt  x 0,44 = 0,423
  //     Blade's Intuition  St.25  Preis 56  0,031 % je Punkt  x 1,00 = 0,031
  //     Short-Circuit      St.28  Preis 61  0,036 % je Punkt  x 0,55 = 0,020
  //
  // Faktor **13,8** gegen Blade's Intuition, **21,7** gegen Short-Circuit -
  // und das mit der vorsichtigen Abdeckung.
  //
  // Die Abdeckung ist der Anteil der Zeit, in dem die Faehigkeit ueberhaupt
  // wirkt, gemessen an der Aktionsmischung von 16:06 bis 17:17
  // (`data/aktionen.txt`, 70,6 Minuten): Operationen 43,9 Prozent, Kill-
  // Aktionen rund 55, alle Aktionen 100. Black Ops sind darin nicht enthalten -
  // sie kommen bei Digital Observer und Short-Circuit noch obendrauf, also
  // sind beide Werte eher zu niedrig als zu hoch.
  const CHANCE_SKILLS = {
    "Blade's Intuition": { proz: 3, abdeckung: 1.0 },     // SuccessChanceAll
    "Short-Circuit": { proz: 5.5, abdeckung: 0.55 },      // isKill
    "Digital Observer": { proz: 4, abdeckung: 0.44 },     // Operations + alle Black Ops
    // Cloak dazu (27.08., 19:52): Es stand auf Stufe 0, weil im Plan hinter
    // zwei Infinity-Deckeln - und dann fiel Typhoon, und die naechste Black Op
    // ist `isStealth`. Die Abdeckung ist niedrig (3 von 21 Black Ops plus die
    // Stealth-Vertraege und -Operationen), aber bei Stufe 0 und Preis 2 ist
    // der Nutzen je Punkt trotzdem hoch - genau die Lage, in der Digital
    // Observer heute Faktor 17 brachte.
    "Cloak": { proz: 5.5, abdeckung: 0.2 },               // isStealth
  };
  const relNutzen = (name) => {
    const stufe = ns.bladeburner.getSkillLevel(name);
    if (name === "Hyperdrive") {
      // +10 Prozent Erfahrung je Stufe geben ueber die Erfahrungskurve
      // `lvl = mult * (32*ln(exp+534,6) - 200)` einen festen Levelzuwachs,
      // und der wirkt mit Exponent 0,9 auf die competence.
      const a = 1 + stufe * 0.1;
      const lvlPlus = 32 * Math.log((a + 0.1) / a);
      let basis = 1;
      try { basis = Math.max(1, ns.getPlayer().skills.defense); } catch { /* egal */ }
      return 100 * (Math.pow((basis + lvlPlus) / basis, 0.9) - 1);
    }
    if (name === "Reaper" || name === "Evasive System") {
      // Diese beiden heben nicht die Chance, sondern den EFFEKTIVEN Kampfwert
      // (`data/Skills.ts:54-72`, Reaper 2 Prozent auf alle vier, Evasive
      // System 4 auf dex und agi). Der wirkt ueber
      // `competence += weights * effSkill^decay` (`Actions/Action.ts:173`),
      // bei Black Ops mit Gewicht 0,2 und Decay 0,8 je Kampfwert - also
      // gedaempft und von den aktuellen Werten abhaengig.
      const sk = ns.getPlayer().skills;
      const r = ns.bladeburner.getSkillLevel("Reaper");
      const e = ns.bladeburner.getSkillLevel("Evasive System");
      const comp = (rr, ee) => {
        const a = 1 + rr * 0.02, b = 1 + rr * 0.02 + ee * 0.04;
        return Math.pow(sk.strength * a, 0.8) + Math.pow(sk.defense * a, 0.8)
          + Math.pow(sk.dexterity * b, 0.8) + Math.pow(sk.agility * b, 0.8);
      };
      const jetzt = comp(r, e);
      if (!(jetzt > 0)) return 0;
      const danach = name === "Reaper" ? comp(r + 1, e) : comp(r, e + 1);
      return 100 * (danach / jetzt - 1);
    }
    if (name === "Cyber's Edge") {
      // DAS GEGENSTUECK ZU OVERCLOCK (28.08.2026, 05:40).
      //
      // `mults: { Stamina: 2 }` - zwei Prozent mehr maximale Ausdauer je
      // Stufe (`data/Skills.ts:84-90`). Der Multiplikator wirkt **doppelt**:
      // `calculateMaxStamina` nimmt ihn, und `calculateStaminaGainPerSecond`
      // nimmt ihn ein zweites Mal (`Bladeburner.ts:1322`) - dort steht
      // ausserdem `maxStamina / 70000` im Summanden, den er gerade gehoben
      // hat.
      //
      // **Wert hat das nur, wenn die Ausdauer bindet.** Steht sie voll, ist
      // mehr Vorrat und mehr Nachschub gleich viel wert wie nichts - dieselbe
      // Logik wie bei den Chance-Faehigkeiten, deren Chance bei 1,00 klemmt.
      // Deshalb ist der Nutzen hier **umgekehrt** an die Ausdauer gekoppelt
      // wie bei Overclock: Was den einen daempft, weckt den anderen.
      //
      // Der relative Zuwachs des Multiplikators ist `2 / (100 + 2*stufe)` -
      // bei Stufe 5 also 1,82 Prozent fuer 16 Punkte = 0,114 je Punkt. Zum
      // Vergleich, gemessen 04:37: Blade's Intuition auf Stufe 45 kommt mit
      // dem Klemmfaktor auf 0,0066 je Punkt. **Faktor 17** - aber eben erst,
      // wenn die Ausdauer wirklich knapp wird.
      //
      // Damit regelt sich das Paar selbst: Overclock treibt die Aktionen
      // schneller, bis die Ausdauer knapp wird; dann faellt sein Nutzen und
      // der von Cyber's Edge steigt, bis wieder Luft da ist.
      return (100 * 2 / (100 + 2 * stufe)) * (1 - ausdauerLuft());
    }
    if (name === "Overclock") {
      // OVERCLOCK IST KEINE CHANCE-, SONDERN EINE ZEITFAEHIGKEIT
      // (28.08.2026, 00:58).
      //
      // `mults: { ActionTime: -1 }` (`data/Skills.ts:44-53`), und
      // `getSkillMult` bildet daraus `1 - stufe/100`. Die Dauer jeder
      // Aktion wird damit direkt multipliziert (`Action.ts:108,119`:
      // `baseTime * skillFac`, im Quellcode als "Always < 1" kommentiert).
      //
      // Der Ertrag je Aktion bleibt gleich, die Dauer sinkt - die Rangrate
      // steigt also um `1/(99 - stufe)` je Stufe, und das gilt fuer
      // **Vertraege, Operationen UND Black Ops** gleichermassen. Keine andere
      // Faehigkeit wirkt so breit.
      //
      // Bei Stufe 14 sind das 1,18 Prozent fuer 23 Punkte = **0,0511 je
      // Punkt**. Zum Vergleich, gemessen 00:53 auf demselben Stand:
      //
      //     Blade's Intuition  Stufe 44   Nutzen 1,293   Preis 95  ->  0,0136
      //     Hyperdrive         Stufe 13          0,452         34  ->  0,0133
      //     Overclock          Stufe 14          1,176         23  ->  0,0511
      //
      // **Faktor 3,8 gegenueber dem bisher Besten** - und es stand
      // ausserhalb von `DYNAMISCH`, wurde also nie mit den anderen
      // verglichen. Derselbe Fehler wie bei den Deckeln am 27.08. um 20:33,
      // nur andersherum: Damals hing eine gute Faehigkeit an einem Deckel,
      // hier hing sie ganz ausserhalb der Sortierung.
      //
      // DER ZWEITE GRUND, WARUM ES JETZT GILT: Die Chance-Faehigkeiten sind
      // heute weitgehend wertlos, weil die Operationschancen bei **1,00**
      // klemmen (Raid 1,0 bis 1,0 gemessen 21:40, Assassination 1,000).
      // `relNutzen` rechnet ihren competence-Zuwachs trotzdem voll an. Das
      // ist ein eigener Befund und steht als Baustelle - hier zaehlt nur,
      // dass Overclock davon unberuehrt ist: Zeit wirkt immer.
      //
      // ABER NUR, SOLANGE DIE AUSDAUER NICHT BINDET (28.08.2026, 04:11).
      //
      // Der Ausdauerverlust faellt je **Aktion** an, die Regeneration je
      // **Sekunde**:
      //
      //     stamina -= BaseStaminaLoss * difficultyMultiplier   (:921, :1019)
      //     stamina += calculateStaminaGainPerSecond() * seconds (:1382)
      //
      // Overclock halbiert die Dauer und verdoppelt damit den Verbrauch je
      // Minute, waehrend der Gewinn gleich bleibt. **Rang je Ausdauerpunkt
      // ist konstant** - beides haengt an der Aktion, nicht an der Zeit.
      // Sobald die Ausdauer der Engpass ist, kuerzt Overclock sich also
      // vollstaendig heraus: Die Rangrate ist dann
      // `(Rang je Aktion / Verlust je Aktion) x Regeneration`, und darin
      // kommt die Dauer nicht mehr vor.
      //
      // Gerechnet fuer Assassination auf Stufe 13 um 04:08
      // (`difficulty` = 1500 x 1,06^12 = 3.018,
      // `diffMult = difficulty^0,28 + difficulty/650` = 9,42 + 4,64 = 14,06,
      // `Constants.ts:5,15,16`):
      //
      //     Verlust je Aktion          0,285 x 14,06  =  4,01
      //     Dauer bei Overclock 69     57 s           ->  4,22 je Minute
      //     Dauer bei Overclock 90     18,4 s         -> 13,1 je Minute
      //
      // Die Regeneration lag zur selben Zeit bei rund 4,4 je Minute
      // (`(0,0085 + maxStamina/70000) x effAgility^0,17` mal Faehigkeits-
      // und Augmentierungsmultiplikator, `:1317-1325`). **Der Bot faehrt
      // also genau am Gleichgewicht** - Ausdauer 237 von 247, Kammeranteil
      // null in der letzten Stunde. Jede weitere Stufe kippt ihn darueber.
      //
      // Deshalb der Daempfer: Faellt der Fuellstand unter 90 Prozent, sinkt
      // der ausgewiesene Nutzen linear gegen null. Er misst damit genau die
      // Groesse, die kippt, statt eine Stufe zu raten - und er gibt den
      // Nutzen von allein zurueck, wenn spaetere Augmentierungen die
      // Regeneration heben.
      const stufe2 = Math.min(stufe, 98);
      return (100 / (99 - stufe2)) * ausdauerLuft();
    }
    const c = CHANCE_SKILLS[name];
    if (!c) return 0;
    const a = 1 + stufe * c.proz / 100;
    return 100 * ((a + c.proz / 100) / a - 1) * c.abdeckung * klemmFaktor();
  };

  // WAS NICHT MEHR STEIGEN KANN, IST NICHTS MEHR WERT (28.08.2026, 01:10).
  //
  // `getSuccessChance` klemmt bei 1,00 (`Actions/Action.ts`). Steht eine
  // Aktion dort, verpufft jeder weitere competence-Zuwachs - und mit ihm der
  // Nutzen jeder Chance-Faehigkeit, die auf sie wirkt. `relNutzen` hat das
  // bis hierher nicht gewusst: Es rechnete den prozentualen Zuwachs, ohne zu
  // pruefen, ob er ankommt.
  //
  // Gemessen 00:53, und deshalb steht diese Funktion hier: Raid 1,0 bis 1,0
  // (21:40), Assassination 1,000 - und trotzdem wurde Blade's Intuition fuer
  // **95 Punkte** auf Stufe 45 gekauft, mit einem ausgewiesenen Nutzen von
  // 1,293 Prozent. Der wahre Nutzen war null.
  //
  // ABER NICHT IMMER NULL: Bei Black Ops klemmt es nicht. Operation Ares
  // stand um 00:53 bei 0,758 bis 1,000, und dort wirkt jede dieser
  // Faehigkeiten voll. Ein pauschales Abschalten waere also falsch - es
  // wuerde genau die Faehigkeiten verhungern lassen, die den Knotenausgang
  // tragen.
  //
  // Deshalb wird GEMESSEN statt geraten: zwei Sonden, die zusammen abdecken,
  // wo die Chance-Faehigkeiten ueberhaupt wirken koennen - die naechste
  // Black Op und die beste laufende Operation. Der Faktor ist der Anteil der
  // Sonden, die noch Luft haben. Bei Ares offen und Assassination geklemmt
  // sind das 0,5.
  //
  // Die 0,999 statt 1,0 als Grenze: Die geschaetzte Chance schwankt im
  // letzten Promille mit der Bevoelkerungsschaetzung der Stadt, und ein
  // Nutzen, der an dieser Stelle kippt, waere Rauschen.
  // Wieviel Luft hat die Ausdauer? 1 = voll, 0 = am Anschlag. Zwei
  // Faehigkeiten haengen daran, und zwar gegenlaeufig: Overclock verliert
  // seinen Wert, wenn die Luft ausgeht, Cyber's Edge gewinnt ihn dann.
  const ausdauerLuft = () => {
    try {
      const [jetzt, max] = ns.bladeburner.getStamina();
      if (max > 0) return Math.max(0, Math.min(1, (jetzt / max - 0.5) / 0.4));
    } catch { /* ohne Messung: volle Luft annehmen */ }
    return 1;
  };

  // DAS GYM ALS ERSATZ, NICHT ALS PARALLELBETRIEB (28.08.2026, 08:40).
  //
  // Vorgeschichte in zwei Schritten, beide gemessen:
  //
  //  07:00  Gym-Hebel eingebaut mit der Begruendung, der Arbeitskanal laufe
  //         parallel zur Bladeburner-Aktion. **Falsch.**
  //         `Bladeburner.ts:178-180` ruft in `startAction()` ein
  //         `Player.finishWork(true)`, und `process()` bricht umgekehrt die
  //         Bladeburner-Aktion ab, sobald `currentWork` gesetzt ist
  //         (`:1353-1360`) - beides nur ohne `The Blade's Simulacrum`.
  //         Zurueckgenommen um 07:34, kein Messwert hatte sich bewegt.
  //
  //  08:33  Nachgemessen im Zustand nach dem Einbau: `blade.js` faehrt
  //         `General/Training` ("zu schwach"), die Rangrate steht bei
  //         **0,1 je Minute** ueber 44 Minuten. Bladeburner-Training gibt 30
  //         Erfahrung je 30 Sekunden auf alle vier Werte
  //         (`Bladeburner.ts:1091-1105`), Ortsmultiplikator **1**; das
  //         Powerhouse Gym in Sector-12 hat **10**
  //         (`LocationsMetadata.ts`).
  //
  // Damit dreht sich die Rechnung: Solange nichts ueber seiner Schwelle
  // liegt, ist die Bladeburner-Aktion 0,1 Rang je Minute wert. Dafuer den
  // zehnfachen Erfahrungssatz aufzugeben, waere teuer - andersherum ist es
  // billig. Das Gym ist hier kein Parallelbetrieb, sondern ein **Tausch**,
  // und der lohnt.
  //
  // NICHT ueber bbtrain: Das waere wieder eine Uebergabe zwischen zwei
  // Skripten, und genau daran ist es zweimal gescheitert - am 28.08. um 01:33
  // haben sich beide die Figur im Minutentakt weggenommen, um 07:49 hat
  // keines von beiden gearbeitet. Wer weicht, muss wissen, dass jemand
  // uebernimmt; am sichersten weiss man das, wenn man selbst uebernimmt.
  //
  // Drei Bedingungen, jede aus einem frueheren Schaden:
  //   - Konto ueber GYM_MIN_GELD. Das Powerhouse kostet 2.400 je Sekunde und
  //     prueft den Kontostand nicht (`Work/ClassWork.tsx`,
  //     `PlayerObjectGeneralMethods.ts` - `gainMoney` hat keinen Boden). Am
  //     27.08. stand das Konto deshalb bei -3 Millionen.
  //   - Fremde Arbeit hat Vorrang. Laeuft etwas anderes als unsere
  //     Gym-Einheit im Arbeitskanal - bn4rep laesst die Figur fuer Faktionen
  //     arbeiten -, wird nichts angefasst. Ruf ist die Waehrung fuer
  //     Augmentierungen.
  //   - Der niedrigste Wert wird trainiert. Die Schwellen haengen an allen
  //     vier, wer den hoechsten weitertreibt, kommt nicht naeher.
  const GYM_STADT = "Sector-12";
  const GYM_NAME = "Powerhouse Gym";
  const GYM_MIN_GELD = 5e6;
  const GYM_WERTE = [["strength", "str"], ["defense", "def"],
    ["dexterity", "dex"], ["agility", "agi"]];
  const gymGreifen = () => {
    try {
      const p = ns.getPlayer();
      if (p.money < GYM_MIN_GELD) return null;
      let kurz = null, tief = Infinity;
      for (const [lang, k] of GYM_WERTE) {
        if (p.skills[lang] < tief) { tief = p.skills[lang]; kurz = k; }
      }
      const laeuft = ns.singularity.getCurrentWork();
      if (laeuft && laeuft.type === "CLASS"
          && laeuft.classType === kurz
          && (!laeuft.location || laeuft.location === GYM_NAME)) {
        return kurz;   // laeuft schon richtig, nicht neu starten
      }
      if (laeuft && laeuft.type !== "CLASS") return null;   // fremde Arbeit
      if (p.city !== GYM_STADT && !ns.singularity.travelToCity(GYM_STADT)) return null;
      try { ns.bladeburner.stopBladeburnerAction(); } catch { /* nichts lief */ }
      return ns.singularity.gymWorkout(GYM_NAME, kurz, false) ? kurz : null;
    } catch { return null; }
  };

  const klemmFaktor = () => {
    const sonden = [];
    try {
      const bo = ns.bladeburner.getNextBlackOp();
      if (bo) sonden.push(ns.bladeburner.getActionEstimatedSuccessChance(B, bo.name)[0]);
    } catch { /* keine Black Op mehr: dann zaehlt nur die Operation */ }
    for (const n of ["Assassination", "Raid", "Stealth Retirement Operation"]) {
      try {
        if (offen(O, n) < 1) continue;
        sonden.push(ns.bladeburner.getActionEstimatedSuccessChance(O, n)[0]);
        break;
      } catch { /* naechste */ }
    }
    if (!sonden.length) return 1;
    const offenAnteil = sonden.filter((x) => x < 0.999).length / sonden.length;
    // Nie ganz auf null: Faellt eine schwere Black Op an, muessen die
    // Faehigkeiten wieder anziehen koennen, und dafuer brauchen sie einen
    // Rest an Gewicht in der Sortierung. Ein Zwanzigstel genuegt - es
    // verliert gegen Overclock, gewinnt aber gegen gar nichts.
    return Math.max(0.05, offenAnteil);
  };
  // Reaper und Evasive System kamen am 27.08. um 15:53 dazu. Gerechnet auf dem
  // damaligen Stand (str 172, def 143, dex 325, agi 168): Reaper Stufe 9 gab
  // 0,059 je Punkt und Evasive System Stufe 13 gab 0,047 - beide besser als
  // Blade's Intuition Stufe 26 mit 0,031, und beide standen gedeckelt.
  const DYNAMISCH = ["Hyperdrive", "Short-Circuit", "Blade's Intuition",
    "Reaper", "Evasive System", "Digital Observer", "Cloak", "Overclock", "Cyber's Edge"];

  const faehigkeitenKaufen = () => {
    let punkte = ns.bladeburner.getSkillPoints();
    if (punkte <= 0) return;

    // Die drei dynamischen Eintraege an ihren Planplaetzen neu ordnen: Der
    // beste Nutzen je Punkt kommt auf den obersten der drei Plaetze. Alle
    // anderen Eintraege und alle Deckel bleiben unangetastet.
    const plaetze = [];
    for (let i = 0; i < SKILL_PLAN.length; i++) {
      if (DYNAMISCH.includes(SKILL_PLAN[i][0])) plaetze.push(i);
    }
    if (plaetze.length === DYNAMISCH.length) {
      const eintraege = plaetze.map((i) => SKILL_PLAN[i]);
      eintraege.sort((a, b) => {
        const wert = (e) => {
          const stufe = ns.bladeburner.getSkillLevel(e[0]);
          if (stufe >= e[1]) return -1;                 // am Deckel: ganz nach hinten
          const preis = ns.bladeburner.getSkillUpgradeCost(e[0], 1);
          return preis > 0 ? relNutzen(e[0]) / preis : -1;
        };
        return wert(b) - wert(a);
      });
      plaetze.forEach((i, n) => { SKILL_PLAN[i] = eintraege[n]; });
    }
    // SPAREN STATT AUSWEICHEN (25.08.2026).
    //
    // Hier stand eine Schleife, die bei "zu teuer" mit `break` aus dem
    // aktuellen Skill aussteigt - und danach mit dem NAECHSTEN weitermacht.
    // Der Kommentar darueber versprach "strikt nach Plan, nicht nach Preis";
    // der Code tat genau das Gegenteil. Wer den teuersten Eintrag nicht
    // bezahlen kann, kauft eben den billigsten weiter unten.
    //
    // Gemessen um 17:15, eine Dreiviertelstunde nach dem Beitritt:
    //   Overclock          Stufe 0   (Plan-Platz 1, kostet 3)
    //   Blade's Intuition  Stufe 0   (Plan-Platz 2, kostet 3)
    //   Digital Observer   Stufe 1   (Plan-Platz 3)
    // Gekauft wurde also ausgerechnet der Eintrag, der zufaellig dran war, als
    // ein Punkt anfiel. Die beiden Faehigkeiten, die auf JEDE Aktion wirken -
    // Overclock senkt die Dauer, Blade's Intuition hebt die Erfolgschance -
    // standen weiter auf null, und der Rang wuchs mit 0,24 je Minute.
    //
    // Punkte fallen hier einzeln an. Eine Kaufregel, die nie wartet, kann
    // deshalb systematisch nur das Billigste kaufen. Richtig ist: beim ersten
    // Eintrag stehenbleiben, der noch nicht am Deckel ist, und sparen bis er
    // bezahlbar ist. Ein Punkt, der eine Runde liegen bleibt, ist billiger als
    // ein Punkt, der im falschen Skill steckt - Faehigkeiten lassen sich nicht
    // zurueckgeben.
    for (const [name, deckel] of SKILL_PLAN) {
      if (!SKILLS.has(name)) continue;
      const stufe = ns.bladeburner.getSkillLevel(name);
      // Am Deckel: weiterruecken, hier ist nichts mehr zu holen.
      if (stufe >= deckel) continue;
      const preis = ns.bladeburner.getSkillUpgradeCost(name, 1);
      if (!(preis > 0)) continue;
      if (preis > punkte) {
        // NICHT weitergehen. Das ist der ganze Punkt dieser Aenderung.
        if (name !== letzterSparziel) {
          sag("Spare auf " + name + " (" + preis + " Punkte, habe " + punkte + ").");
          letzterSparziel = name;
        }
        return;
      }
      if (!ns.bladeburner.upgradeSkill(name, 1)) return;
      punkte -= preis;
      letzterSparziel = "";
      sag("Faehigkeit " + name + " auf " + (stufe + 1) + " (" + preis + " Punkte).");
      // Nach einem Kauf wieder von vorn: Vielleicht reicht der Rest schon fuer
      // die naechste Stufe desselben Eintrags.
      return faehigkeitenKaufen();
    }
  };

  // EINE STELLE FUER DIE TELEMETRIE (25.08.2026, 22:15).
  //
  // Zweimal an einem Abend ist derselbe Fehler an verschiedenen Stellen
  // aufgetreten: Ein Zweig der Hauptschleife machte `continue`, ohne etwas zu
  // schreiben. Erst der Ruhe-Zweig - das kostete 23 Minuten Blindflug, weil
  // niemand einen Haenger von ruhigem Ruhen unterscheiden konnte. Dann der
  // Weichen-Zweig, der einen Fehlalarm ueber eine angeblich stehende
  // Spielengine ausloeste, waehrend sie nachweislich lief. Beide Male wurde
  // der Einzelfall geflickt.
  //
  // Die Ursache ist die Duplikation selbst. Diese Funktion holt sich alles,
  // was jeder Zustand gemeinsam hat, selbst - ein neuer Zweig kann damit
  // nichts mehr vergessen ausser dem Aufruf. Und der faellt beim Lesen auf.
  const meldeLage = (aktion, grund, chance) => {
    let ausdauer = "?", hp = null, spielzeit = null, rang = null, punkte = null;
    try {
      const [a, amax] = ns.bladeburner.getStamina();
      ausdauer = Math.round(a) + "/" + Math.round(amax);
    } catch { /* nicht in der Division */ }
    try {
      const p = ns.getPlayer();
      spielzeit = p.totalPlaytime;
      if (p.hp && p.hp.max > 0) {
        hp = Math.round(p.hp.current) + "/" + Math.round(p.hp.max);
      }
    } catch { /* egal */ }
    try { rang = Math.round(ns.bladeburner.getRank()); } catch { /* egal */ }
    try { punkte = ns.bladeburner.getSkillPoints(); } catch { /* egal */ }
    let bo = null;
    try { bo = ns.bladeburner.getNextBlackOp(); } catch { /* egal */ }
    // DAS AKTIONSLEVEL GEHOERT NACH DRAUSSEN (26.08.2026, 06:15).
    //
    // Der Strategiepruefer erwartete fuer Contracts/Tracking 0,35 Rang je
    // Minute, gemessen waren 1,994 - Faktor 6. Der Grund steht in
    // Formulas.ts:9-23: Der Ertrag ist nicht `rankGain`, sondern
    // `rankGain * rewardFac^(level-1) * BitNode-Multiplikator`. Jede Aktion
    // hat einen eigenen rewardFac (Tracking 1,041, Bounty Hunter 1,085,
    // Retirement 1,065), und die Stufe steigt mit jedem zehnten Erfolg.
    // Ohne sie unterschaetzt der Pruefer systematisch und meldet STAGNATION,
    // wo der Motor genau das Richtige tut.
    let stufe = null;
    // DIE AKTIONSDAUER GEHOERT DAZU (26.08.2026, 23:30).
    //
    // Der Pruefer rechnet fuer Vertraege pauschal `1,7 * chance * levelFaktor`
    // (`strategie-check.js:245`). Die 1,7 ist ein Rang-je-Minute-Schaetzwert
    // fuer ALLE Vertraege - aber weder der Ertrag noch die Dauer sind gleich:
    // rankGain ist 0,3 bei Tracking, 0,9 bei Bounty Hunter und 0,6 bei
    // Retirement (`data/Contracts.ts:19,53,86`), die Dauer 18, 32 und 26
    // Sekunden.
    //
    // Gegen die Messung aus 406 Abschnitten (`tools/ratencheck.js`, 23:18)
    // faellt das auf: Fuer Bounty Hunter trifft die Pauschale gut (2,50
    // erwartet gegen 2,279 gemessen), fuer Tracking liegt sie **59 Prozent zu
    // hoch** (5,45 gegen 3,438). Mit `rankGain / dauer` statt der Pauschale
    // kaeme 3,21 heraus - und das trifft.
    //
    // Die Dauer haengt an dex und agi (`Actions/Action.ts:104-120`) und
    // aendert sich mit jedem Trainingsfortschritt; sie gehoert deshalb
    // gemessen und nicht in eine Tabelle im Pruefer.
    let dauer = null;
    try {
      const teile = String(aktion).split("/");
      if (teile.length === 2 && teile[0] !== "General") {
        stufe = ns.bladeburner.getActionCurrentLevel(teile[0], teile[1]);
      }
      if (teile.length === 2) {
        dauer = Math.round(ns.bladeburner.getActionTime(teile[0], teile[1]));
      }
    } catch { /* General-Aktionen haben keine Stufe */ }
    ns.write("data/blade.json", JSON.stringify({
      zeit: Date.now(),
      chance: Number.isFinite(chance) ? +chance.toFixed(3) : null,
      rang, punkte, ausdauer, hp,
      // Der Puls der Spielengine. Netscript und die Engine sind zwei
      // Schleifen; totalPlaytime waechst nur in updateGame. Steht die Zahl
      // zwischen zwei Messungen still, ist die Engine tot, und dann hilft
      // kein Neustart eines Werkzeugs, sondern nur ein Neuladen des Tabs.
      spielzeit,
      aktion, grund,
      stufe, dauer,
      naechsteBlackOp: bo ? bo.name : null,
      blackOpRang: bo ? bo.rank : null,
    }), "w");
    if (ns.getHostname() !== "home") {
      try { ns.scp("data/blade.json", "home", ns.getHostname()); } catch { /* egal */ }
    }
  };

  // DER ABSCHNITTSSCHREIBER (26.08.2026, 02:45).
  //
  // Der Strategiepruefer rechnet seine Erwartungswerte aus dem Quellcode:
  // rankGain mal Erfolgschance durch Aktionsdauer. Ob das stimmt, liess sich
  // bisher nicht sagen - `tools/ratencheck.js` hat am 26.08. um 02:15 gezeigt,
  // warum: Der Messverlauf haelt alle zwanzig Minuten fest, welche Aktion
  // GERADE laeuft, und schreibt ihr den ganzen Zuwachs der Zwischenzeit zu.
  // In zwanzig Minuten wechselt der Motor aber mehrfach. Contracts/Retirement
  // kam so auf einen Median von null, waehrend der Rang nachweislich stieg.
  //
  // Hier entsteht die saubere Grundlage: Bei JEDEM Aktionswechsel wird der
  // abgeschlossene Abschnitt weggeschrieben - von wann bis wann, welche
  // Aktion, wie viel Rang dazwischen. Daraus laesst sich die Rate je Aktion
  // ohne Vermischung ableiten.
  //
  // Die Endung ist .txt und nicht .jsonl: Bitburner laesst nur eine kurze
  // Liste von Dateiendungen zu und weist alles andere mit "Invalid file
  // extension" ab. Der Inhalt ist trotzdem JSON, eine Zeile je Abschnitt.
  let abschnitt = null;
  // DER AUSDAUERVERBRAUCH IST DER LETZTE UNGEMESSENE POSTEN (26.08., 09:15).
  //
  // Nach dem Krankenhaus-Hebel bleibt die Ausdauer der einzige Grund zu ruhen,
  // und sie kostet weiter 58 Prozent der Zeit (gemessen 09:14 ueber 59
  // Minuten). Zwei Ansaetze dagegen sind schon widerlegt: die Hysteresespanne
  // (symmetrisch) und die Hoechstausdauer (Regeneration waechst mit).
  //
  // Uebrig bleibt der Verbrauch selbst: `BaseStaminaLoss * difficultyMultiplier`
  // (Bladeburner.ts:921), und die Schwierigkeit steigt mit dem AKTIONSLEVEL
  // (`difficultyFac^(level-1)`). Tracking steht auf Stufe 24 und ist damit
  // teuer geworden - moeglicherweise teurer, als sein Ertrag von 2,2 Rang je
  // Minute wert ist. Ohne den Verbrauch je Aktion laesst sich das nicht
  // entscheiden, also wird er ab jetzt mitgeschrieben.
  const holeAusdauer = () => {
    try { return +ns.bladeburner.getStamina()[0].toFixed(3); } catch { return null; }
  };
  const schliesseAbschnitt = (jetztRang) => {
    if (!abschnitt) return;
    const dauer = Date.now() - abschnitt.von;
    // Abschnitte unter zehn Sekunden sind Umschaltzucken, keine Arbeit.
    if (dauer >= 10_000) {
      const zeile = JSON.stringify({
        von: abschnitt.von, bis: Date.now(), aktion: abschnitt.aktion,
        grund: abschnitt.grund, rangVon: abschnitt.rang, rangBis: jetztRang,
        ausdauerVon: abschnitt.ausdauer, ausdauerBis: holeAusdauer(),
      }) + String.fromCharCode(10);
      try {
        ns.write("data/aktionen.txt", zeile, "a");
        if (ns.getHostname() !== "home") {
          ns.scp("data/aktionen.txt", "home", ns.getHostname());
        }
      } catch (e) { /* Protokoll ist Beiwerk, nie ein Grund zum Abbruch */ }
    }
    abschnitt = null;
  };

  // WAS EINE AKTION AN AUSDAUER KOSTET - AUS DEM EIGENEN PROTOKOLL
  // (26.08.2026, 09:52).
  //
  // Seit dem Krankenhaus-Hebel ist die Ausdauer der einzige Grund zu ruhen,
  // und sie kostet 55 Prozent der Zeit. Damit zaehlt nicht mehr Rang je
  // MINUTE, sondern Rang je AUSDAUERPUNKT - die Minuten sind reichlich da,
  // die Ausdauer ist knapp.
  //
  // Gemessen 09:45 ueber 295 Abschnitte (tools/ratencheck.js):
  //   Tracking        2,180 Rang/min   0,533 je Ausdauer   1,17 je Lauf
  //   Bounty Hunter   1,710 Rang/min   0,989 je Ausdauer   1,78 je Lauf
  // Die beiden Kennzahlen widersprechen sich, und ueber den vollen Zyklus aus
  // Arbeit und Ruhe gewinnt Bounty Hunter um Faktor 1,44.
  //
  // Die Kosten werden NICHT geschaetzt, sondern aus data/aktionen.txt
  // gerechnet - derselben Datei, die dieses Skript selbst fuellt. Damit
  // kalibriert sich die Auswahl mit jedem Aktionslevel neu, statt auf einer
  // Tabelle von heute stehen zu bleiben.
  let kostenStand = 0;
  let kosten = new Map();
  let kostenSchnitt = null;
  const kostenAktualisieren = () => {
    // Alle fuenf Minuten reicht: Die Werte aendern sich mit dem Aktionslevel,
    // und das steigt mit jedem zehnten Erfolg.
    if (Date.now() - kostenStand < 5 * 60_000) return;
    kostenStand = Date.now();
    try {
      const roh = ns.read("data/aktionen.txt");
      if (!roh) return;
      const zeilen = roh.split(String.fromCharCode(10)).filter((z) => z.trim());
      const neu = new Map();
      // Nur die juengsten dreihundert Abschnitte: Aeltere stammen aus einer
      // Zeit mit anderen Aktionsleveln und verfaelschen den Schnitt.
      for (const z of zeilen.slice(-300)) {
        let d;
        try { d = JSON.parse(z); } catch { continue; }
        if (!Number.isFinite(d.ausdauerVon) || !Number.isFinite(d.ausdauerBis)) continue;
        if (d.ausdauerBis >= d.ausdauerVon) continue;   // Ruhephase, kein Verbrauch
        const e = neu.get(d.aktion) || { aus: 0, n: 0 };
        e.aus += d.ausdauerVon - d.ausdauerBis;
        e.n++;
        neu.set(d.aktion, e);
      }
      const fertig = new Map();
      for (const [name, e] of neu) {
        // Unter fuenf Abschnitten ist der Schnitt Rauschen.
        if (e.n >= 5) fertig.set(name, e.aus / e.n);
      }
      kosten = fertig;
      const werte = [...fertig.values()];
      kostenSchnitt = werte.length
        ? werte.reduce((n, v) => n + v, 0) / werte.length : null;
    } catch (e) { /* Protokoll fehlt: dann eben nach Zeit */ }
  };

  // --- Die naechste Aktion waehlen -----------------------------------------
  const waehle = () => {
    // 1. Ausdauer. Alles andere ist wertlos, wenn die Chance gedrueckt ist.
    const [jetzt, max] = ns.bladeburner.getStamina();
    if (max > 0 && jetzt < max * AUSDAUER_RUHE) {
      return { typ: G, name: "Hyperbolic Regeneration Chamber", grund: "Ausdauer" };
    }
    const hp = ns.getPlayer().hp;
    if (hp && hp.max > 0 && hp.current < hp.max * HP_RUHE) {
      return { typ: G, name: "Hyperbolic Regeneration Chamber", grund: "HP" };
    }

    // DIE BLACK-OP-CHANCE WIRD GERECHNET, NICHT GESCHAETZT (27.08.2026, 18:22).
    //
    // `getActionEstimatedSuccessChance` liefert ein Paar [min, max], und bis
    // heute entschied hier `min`. Bei Black Ops ist diese Spanne aber ein
    // ARTEFAKT: `Actions/BlackOperation.ts:55-61` gibt fuer
    // `getPopulationSuccessFactor()` und `getChaosSuccessFactor()` fest 1
    // zurueck, also ist in `getSuccessRange` (`Actions/Action.ts:144-167`)
    // `est === real` und `diff = 0` - und trotzdem wird danach `low *= r`
    // mit `r = city.pop/city.popEst` gerechnet. Die Bevoelkerungsschaetzung
    // wirkt auf Black Ops gar nicht, verzerrt aber die Anzeige.
    //
    // Verifiziert im Spiel um 18:19 (`src/chance.js`, `data/chance.json`):
    //     API-Paar   min 0,2955   max 0,3064
    //     gerechnet             0,3064   <- deckungsgleich mit max
    // Der Motor entschied auf 0,2955, wahr waren 0,3064. Heute sind das
    // 3,7 Prozent; um 17:41 waren es 11, und `popEst` kann bis zum
    // Anderthalbfachen danebenliegen (`City.ts:23`), also bis zu 33.
    //
    // Nachbau von `Action.getSuccessChance` (`Actions/Action.ts:169-196`).
    // Gibt `null` zurueck, wenn die Aktionsdaten fehlen - dann faellt die
    // Entscheidung wie bisher auf `min`, also auf die vorsichtige Seite.
    // ALLE 21 BLACK OPS, AUS DEM QUELLCODE ERZEUGT (27.08.2026, 19:52).
    //
    // Bis hierher stand nur Typhoon drin, und fuer alles andere fiel die
    // Entscheidung auf `s.min` zurueck - also auf die Zahl, die bei Black
    // Ops reines Bevoelkerungsrauschen ist. Typhoon fiel um 19:51, damit war
    // der Rueckfall ab sofort der Normalfall gewesen.
    //
    // Erzeugt aus `reference/bitburner-src/src/Bladeburner/data/
    // BlackOperations.ts`, nicht abgetippt: 21 Aktionen mit je sieben
    // Gewichten und sieben Decays sind 294 Zahlen, und eine falsche davon
    // faellt nie auf.
    //
    // Beim Extrahieren aufgefallen und sofort wichtig: **Operation Zero ist
    // `isStealth`, nicht `isKill`.** Short-Circuit (Stufe 30) wirkt darauf
    // GAR NICHT, Cloak dagegen schon - und Cloak stand auf Stufe 0. Von den
    // 21 Black Ops sind 15 isKill, 3 isStealth und 3 keins von beidem.
    const BLACKOP_DATEN = {
      "Operation Typhoon": {
        baseDifficulty: 2000, isKill: true, isStealth: false,
        weights: { hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2, intelligence: 0.1 },
        decays: { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 },
      },
      "Operation Zero": {
        baseDifficulty: 2500, isKill: false, isStealth: true,
        weights: { hacking: 0.2, strength: 0.15, defense: 0.15, dexterity: 0.2, agility: 0.2, intelligence: 0.1 },
        decays: { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 },
      },
      "Operation X": {
        baseDifficulty: 3000, isKill: true, isStealth: false,
        weights: { hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2, intelligence: 0.1 },
        decays: { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 },
      },
      "Operation Titan": {
        baseDifficulty: 4000, isKill: true, isStealth: false,
        weights: { hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2, intelligence: 0.1 },
        decays: { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 },
      },
      "Operation Ares": {
        baseDifficulty: 5000, isKill: true, isStealth: false,
        weights: { strength: 0.25, defense: 0.25, dexterity: 0.25, agility: 0.25 },
        decays: { strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 },
      },
      "Operation Archangel": {
        baseDifficulty: 7500, isKill: true, isStealth: false,
        weights: { strength: 0.2, defense: 0.2, dexterity: 0.3, agility: 0.3 },
        decays: { strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 },
      },
      "Operation Juggernaut": {
        baseDifficulty: 10000, isKill: true, isStealth: false,
        weights: { strength: 0.25, defense: 0.25, dexterity: 0.25, agility: 0.25 },
        decays: { strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 },
      },
      "Operation Red Dragon": {
        baseDifficulty: 12500, isKill: true, isStealth: false,
        weights: { hacking: 0.05, strength: 0.2, defense: 0.2, dexterity: 0.25, agility: 0.25, intelligence: 0.05 },
        decays: { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 },
      },
      "Operation K": {
        baseDifficulty: 15000, isKill: true, isStealth: false,
        weights: { hacking: 0.05, strength: 0.2, defense: 0.2, dexterity: 0.25, agility: 0.25, intelligence: 0.05 },
        decays: { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 },
      },
      "Operation Deckard": {
        baseDifficulty: 20000, isKill: true, isStealth: false,
        weights: { strength: 0.24, defense: 0.24, dexterity: 0.24, agility: 0.24, intelligence: 0.04 },
        decays: { strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 },
      },
      "Operation Tyrell": {
        baseDifficulty: 25000, isKill: true, isStealth: false,
        weights: { hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2, intelligence: 0.1 },
        decays: { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 },
      },
      "Operation Wallace": {
        baseDifficulty: 30000, isKill: true, isStealth: false,
        weights: { strength: 0.24, defense: 0.24, dexterity: 0.24, agility: 0.24, intelligence: 0.04 },
        decays: { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 },
      },
      "Operation Shoulder of Orion": {
        baseDifficulty: 35000, isKill: false, isStealth: true,
        weights: { hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2, intelligence: 0.1 },
        decays: { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 },
      },
      "Operation Hyron": {
        baseDifficulty: 40000, isKill: true, isStealth: false,
        weights: { hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2, intelligence: 0.1 },
        decays: { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 },
      },
      "Operation Morpheus": {
        baseDifficulty: 45000, isKill: false, isStealth: true,
        weights: { hacking: 0.05, strength: 0.15, defense: 0.15, dexterity: 0.3, agility: 0.3, intelligence: 0.05 },
        decays: { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 },
      },
      "Operation Ion Storm": {
        baseDifficulty: 50000, isKill: true, isStealth: false,
        weights: { strength: 0.24, defense: 0.24, dexterity: 0.24, agility: 0.24, intelligence: 0.04 },
        decays: { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 },
      },
      "Operation Annihilus": {
        baseDifficulty: 55000, isKill: true, isStealth: false,
        weights: { strength: 0.24, defense: 0.24, dexterity: 0.24, agility: 0.24, intelligence: 0.04 },
        decays: { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 },
      },
      "Operation Ultron": {
        baseDifficulty: 60000, isKill: true, isStealth: false,
        weights: { hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2, intelligence: 0.1 },
        decays: { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 },
      },
      "Operation Centurion": {
        baseDifficulty: 70000, isKill: false, isStealth: false,
        weights: { hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2, intelligence: 0.1 },
        decays: { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 },
      },
      "Operation Vindictus": {
        baseDifficulty: 75000, isKill: false, isStealth: false,
        weights: { hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2, intelligence: 0.1 },
        decays: { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 },
      },
      "Operation Daedalus": {
        baseDifficulty: 80000, isKill: false, isStealth: false,
        weights: { hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2, intelligence: 0.1 },
        decays: { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, intelligence: 0.75 },
      },
    };

    // `mult = 1 + baseMult*stufe/100`, multiplikativ (`Bladeburner.ts:778-783`)
    const SKILL_WIRKUNG = {
      "Blade's Intuition": { SuccessChanceAll: 3 },
      "Short-Circuit": { SuccessChanceKill: 5.5 },
      "Cloak": { SuccessChanceStealth: 5.5 },
      "Digital Observer": { SuccessChanceOperation: 4 },
      "Reaper": { EffStr: 2, EffDef: 2, EffDex: 2, EffAgi: 2 },
      "Evasive System": { EffDex: 4, EffAgi: 4 },
    };
    // DIE BLACK-OP-SCHWELLE HAENGT AM RAID-VORRAT (27.08.2026, 22:10).
  //
  // Die 0,90 von 21:55 ruhen auf einer Annahme: dass Raid mit 98,3 Rang je
  // Minute die bessere Verwendung der Zeit ist. Das gilt nur, solange es
  // Gemeinden gibt - `Operation.getSuccessChance` gibt **0** zurueck, sobald
  // `comms <= 0` (`Actions/Operation.ts:63-68`), und jeder Erfolg
  // verbraucht eine (`Bladeburner.ts:836`). Ueber alle sechs Staedte sind es
  // 384, also rund 45.000 Rang.
  //
  // Ohne diese Regel waere der Bot nach dem letzten Raid in eine Falle
  // gelaufen: Er haette auf eine Chance gewartet, die er sich ohne Raid nur
  // noch aus Vertraegen erarbeiten kann - bei 8,7 Rang je Minute statt 98.
  // Das ist kein hypothetischer Fall, sondern der sichere Endzustand dieses
  // Knotens.
  //
  // Gezaehlt wird ueber alle Staedte, nicht nur die aktuelle: Die
  // Rundreise-Regel in Block 2a wechselt selbsttaetig dorthin, wo noch etwas
  // liegt.
  // DIE SCHWELLE FOLGT DEM EINSATZ, NICHT NUR DEM RAID-VORRAT (28.08.2026, 07:52).
  //
  // Bis hierher gab es zwei feste Werte, und gewaehlt wurde zwischen ihnen
  // nach dem Raid-Vorrat: Ist genug da, wird vorsichtig gefeuert (0,90), ist
  // wenig da, lohnt das Risiko (0,40), weil die Alternative schwach ist.
  //
  // Das ist fuer die fruehen Operationen richtig und fuer die spaeten falsch,
  // denn `rankLoss` waechst schneller als `rankGain`
  // (`Bladeburner/data/BlackOperations.ts`):
  //
  //     Nr  Operation      rankGain   rankLoss   Break-even p*
  //      8  Red Dragon          500         50       0,091
  //     18  Ultron           10.000      2.000       0,167
  //     19  Centurion        15.000      5.000       0,250
  //     20  Vindictus        20.000     20.000       0,500   <- Verlust = Gewinn
  //     21  Daedalus         40.000     10.000       0,200
  //
  // **Bei Vindictus kostet ein Fehlschlag genau so viel Rang wie ein Erfolg
  // einbringt.** Mit Schwelle 0,40 waere der Rang-Erwartungswert dort negativ
  // (0,4 x 20.000 - 0,6 x 20.000 = -4.000 je Versuch), und der Bot wuerde sich
  // in einer Schleife selbst zurueckwerfen - bei der Rate von 226 Rang je
  // Minute sind 4.000 Rang rund achtzehn Minuten je Fehlversuch.
  //
  // Die untere Grenze ist deshalb `p* + Sicherheitsabstand`, mit
  // `p* = rankLoss / (rankGain + rankLoss)` - dem Punkt, an dem der
  // Erwartungswert null wird. Der Abstand von 0,25 ist nicht gegriffen: Er
  // deckt den zweiten Posten ab, den die reine Rangrechnung uebersieht - die
  // ZEIT. Ein Fehlversuch kostet die volle Aktionsdauer, und Black Ops haben
  // `getActionTimePenalty()` 1,5 (`Actions/BlackOperation.ts:51-53`).
  //
  // Die Tabelle ist aus `BlackOperations.ts` ERZEUGT, nicht abgetippt.
  const BLACKOP_EINSATZ = {
      "Operation Typhoon": { rankGain: 50, rankLoss: 10 }, // p* = 0.167
      "Operation Zero": { rankGain: 60, rankLoss: 15 }, // p* = 0.200
      "Operation X": { rankGain: 75, rankLoss: 15 },    // p* = 0.167
      "Operation Titan": { rankGain: 100, rankLoss: 20 }, // p* = 0.167
      "Operation Ares": { rankGain: 125, rankLoss: 20 }, // p* = 0.138
      "Operation Archangel": { rankGain: 200, rankLoss: 20 }, // p* = 0.091
      "Operation Juggernaut": { rankGain: 300, rankLoss: 40 }, // p* = 0.118
      "Operation Red Dragon": { rankGain: 500, rankLoss: 50 }, // p* = 0.091
      "Operation K": { rankGain: 750, rankLoss: 60 },   // p* = 0.074
      "Operation Deckard": { rankGain: 1000, rankLoss: 75 }, // p* = 0.070
      "Operation Tyrell": { rankGain: 1500, rankLoss: 100 }, // p* = 0.063
      "Operation Wallace": { rankGain: 2000, rankLoss: 150 }, // p* = 0.070
      "Operation Shoulder of Orion": { rankGain: 2500, rankLoss: 500 }, // p* = 0.167
      "Operation Hyron": { rankGain: 3000, rankLoss: 1000 }, // p* = 0.250
      "Operation Morpheus": { rankGain: 4000, rankLoss: 1000 }, // p* = 0.200
      "Operation Ion Storm": { rankGain: 5000, rankLoss: 1000 }, // p* = 0.167
      "Operation Annihilus": { rankGain: 7500, rankLoss: 1000 }, // p* = 0.118
      "Operation Ultron": { rankGain: 10000, rankLoss: 2000 }, // p* = 0.167
      "Operation Centurion": { rankGain: 15000, rankLoss: 5000 }, // p* = 0.250
      "Operation Vindictus": { rankGain: 20000, rankLoss: 20000 }, // p* = 0.500
      "Operation Daedalus": { rankGain: 40000, rankLoss: 10000 }, // p* = 0.200
  };
  const EINSATZ_ABSTAND = 0.25;
  const einsatzSchwelle = (name) => {
    const e = BLACKOP_EINSATZ[name];
    // Unbekannter Name: auf die vorsichtige Seite, nicht auf die billige.
    if (!e) return SICHER_BLACKOP;
    const stern = e.rankLoss / (e.rankGain + e.rankLoss);
    return Math.min(0.95, stern + EINSATZ_ABSTAND);
  };

  const blackOpSchwelle = (name) => {
    if (!RAID_AN) return Math.max(SICHER_BLACKOP_OHNE_RAID, einsatzSchwelle(name));
    let gesamt = 0;
    try {
      for (const stadt of STAEDTE) {
        try { gesamt += ns.bladeburner.getCityCommunities(stadt); } catch { /* Stadt unbekannt */ }
      }
    } catch { return SICHER_BLACKOP; }
    const vorrat = gesamt >= RAID_VORRAT_GESAMT_MIN
      ? SICHER_BLACKOP : SICHER_BLACKOP_OHNE_RAID;
    return Math.max(vorrat, einsatzSchwelle(name));
  };

  const blackOpChance = (name) => {
      const a = BLACKOP_DATEN[name];
      if (!a) return null;
      try {
        const mult = {};
        for (const [skill, wirkungen] of Object.entries(SKILL_WIRKUNG)) {
          const stufe = ns.bladeburner.getSkillLevel(skill);
          if (!stufe) continue;
          for (const [was, basis] of Object.entries(wirkungen)) {
            mult[was] = (mult[was] ?? 1) * (1 + (basis * stufe) / 100);
          }
        }
        const m = (was) => mult[was] ?? 1;
        const sp = ns.getPlayer();
        const sk = sp.skills;
        const [aus, ausMax] = ns.bladeburner.getStamina();
        let team = 0;
        try { team = ns.bladeburner.getTeamSize(B, name); } catch { /* kein Trupp */ }
        const eff = {
          hacking: sk.hacking,
          strength: sk.strength * m("EffStr"),
          defense: sk.defense * m("EffDef"),
          dexterity: sk.dexterity * m("EffDex"),
          agility: sk.agility * m("EffAgi"),
          charisma: sk.charisma * m("EffCha"),
          intelligence: sk.intelligence,
        };
        let c = 0;
        for (const stat of Object.keys(a.weights)) {
          if (!a.weights[stat]) continue;
          c += a.weights[stat] * Math.pow(eff[stat], a.decays[stat]);
        }
        c *= 1 + (0.75 * Math.pow(sk.intelligence, 0.8)) / 600;   // Intelligenz
        c *= Math.min(1, aus / (0.5 * ausMax));                   // Ausdauerstrafe
        c *= Math.pow(team + 1, 0.05);                            // Truppbonus
        c *= m("SuccessChanceAll");
        c *= m("SuccessChanceOperation");   // Black Ops zaehlen als Operation
        if (a.isStealth) c *= m("SuccessChanceStealth");
        if (a.isKill) c *= m("SuccessChanceKill");
        c *= sp.mults.bladeburner_success_chance ?? 1;
        const wert = Math.min(1, c / a.baseDifficulty);
        return Number.isFinite(wert) ? wert : null;
      } catch { return null; }
    };

    // 2. Die naechste Black Op, wenn Rang und Sicherheit reichen. Sie sind
    //    der eigentliche Zweck: 21 Stueck, dann ist der Knoten offen.
    const bo = ns.bladeburner.getNextBlackOp();
    if (bo) {
      if (ns.bladeburner.getRank() >= bo.rank) {
        const s = spanne(B, bo.name);
        const gerechnet = blackOpChance(bo.name);
        // Die gerechnete Zahl schlaegt die geschaetzte. Fehlen die Daten,
        // bleibt es bei `min` - lieber zu spaet feuern als zu frueh.
        const chance = gerechnet !== null ? gerechnet : s.min;
        const schwelle = blackOpSchwelle(bo.name);
        if (chance >= schwelle) {
          return { typ: B, name: bo.name,
            grund: "Black Op (Chance " + chance.toFixed(3)
              + (gerechnet !== null ? " gerechnet" : " geschaetzt")
              + ", Schwelle " + schwelle.toFixed(2) + ")" };
        }
        // WENN NUR DIE SCHAETZUNG IM WEG STEHT, IST SIE DAS ZIEL
        // (27.08.2026, 09:19).
        //
        // Gemessen um 09:11: Die Vertragsspanne war um 08:11 noch **0**
        // (Tracking 1,0/1,0) und stand eine Stunde spaeter bei **0,197**
        // (0,803/1,0); die Operationen bis 0,249, die Black Op 0,086/0,107.
        // Alle Aktionen gehen GLEICHZEITIG auf - das ist keine schwankende
        // Chance, das ist die verrottende Bevoelkerungsschaetzung der Stadt.
        //
        // Field Analysis dagegen einzustreuen lohnt im Normalbetrieb NICHT:
        // sie bringt 0,2 Rang je Minute gegen 8,7 bei Bounty Hunter, also
        // Faktor 43. Genau ein Fall rechtfertigt sie - wenn die Obergrenze
        // ueber der Schwelle liegt und nur die Unschaerfe den Versuch
        // verhindert. Dann kauft eine Minute Field Analysis den Knotenausgang
        // frueher, statt nur Rang zu kosten.
        //
        // Solange max unter der Schwelle liegt, ist die Regel wirkungslos -
        // sie kostet dann nichts und wartet auf ihren Moment.
        // ABGESCHALTET, SOBALD DIE CHANCE GERECHNET WIRD (27.08.2026, 18:22).
        //
        // Die Regel oben stammt von 09:19 und ruht auf derselben Fehlannahme:
        // dass die Spanne einer Black Op eine echte Unschaerfe ihrer Chance
        // sei, die Field Analysis schliessen kann. Fuer Vertraege und
        // Operationen stimmt das - fuer Black Ops nicht, dort wirkt die
        // Bevoelkerung gar nicht mit. Field Analysis kauft dann nur die
        // bessere ANZEIGE, zum Preis von 0,2 Rang je Minute gegen 8,7.
        // Wo gerechnet wird, ist sie ueberfluessig.
        if (gerechnet === null && s.max >= schwelle && s.min < schwelle) {
          return { typ: G, name: "Field Analysis",
            grund: "nur die Schaetzung fehlt zur Black Op" };
        }
        // Rang reicht, Sicherheit nicht: Das ist der Normalfall und kein
        // Grund zu warten - unten wird weiter Rang und Erfahrung gesammelt,
        // bis die Chance steht.
      }
    }

    // 2a. DIE RUNDREISE: comms SIND EIN ENDLICHER VORRAT JE STADT
    //     (27.08.2026, 20:40).
    //
    // Raid ist kein Dauerlaeufer. Jeder Erfolg senkt `city.comms` um eins
    // (`Bladeburner.ts:836`), und `Operation.getSuccessChance` gibt **0**
    // zurueck, sobald `comms <= 0` (`Actions/Operation.ts:63-68`). Der Bot hat
    // bis heute nie die Stadt gewechselt und deshalb nur die 15 Gemeinden von
    // Sector-12 gesehen - ueber alle sechs Staedte sind es 384.
    //
    // Gemessen am 27.08. um 20:29 (`node tools/staedte.js`), Raid Stufe 7 mit
    // 97 Rang je Lauf:
    //
    //     Stadt        comms  chaos  Diplomacy  Ertrag Rang  Rang/Diplo-Min
    //     Sector-12       15   48,8      keine        1.462          sofort
    //     Chongqing      138   66,5     20 min       13.446             672
    //     New Tokyo      123   73,8     27 min       11.985             444
    //     Aevum           49   86,4     37 min        4.774             129
    //     Ishima          42  109,3     51 min        4.092              80
    //     Volhaven        17  132,9     64 min        1.656              26
    //
    // Zusammen **37.415 Rang fuer 199 Minuten Diplomacy** - gut ein Zehntel
    // des Restwegs von 317.000. `switchCity` ist ein reines Feldsetzen und
    // kostet null Sekunden.
    //
    // WAS HIER NICHT PASSIERT: Das Chaos der Zielstadt wird NICHT hier
    // gesenkt. Dafuer gibt es die bestehende Hysterese weiter unten
    // (`CHAOS_EIN`/`CHAOS_AUS`) - sie sieht nach dem Wechsel einfach eine
    // Stadt mit zu hohem Chaos und faehrt Diplomacy, bis es passt. Zwei
    // Stellen, die dasselbe tun wollen, waeren ein Flatterrisiko.
    //
    // GEWECHSELT WIRD NUR NACH UNTEN-OBEN, NIE ZURUECK: Bedingung ist, dass
    // die aktuelle Stadt leer ist UND das Ziel deutlich mehr hat. Ohne die
    // zweite Haelfte koennte der Motor zwischen zwei fast leeren Staedten
    // pendeln und dabei jedes Mal die Chaos-Hysterese neu ausloesen.
    if (RAID_AN) {
      try {
        const hier = ns.bladeburner.getCity();
        const commsHier = ns.bladeburner.getCityCommunities(hier);
        if (commsHier < RAID_VORRAT_MIN) {
          let beste = null, besteComms = 0;
          for (const stadt of STAEDTE) {
            if (stadt === hier) continue;
            let c = 0;
            try { c = ns.bladeburner.getCityCommunities(stadt); } catch { continue; }
            if (c > besteComms) { besteComms = c; beste = stadt; }
          }
          // Die Schwelle ist bewusst hoch: Ein Wechsel zieht eine
          // Diplomacy-Phase nach sich, und die lohnt erst ab einem Vorrat,
          // der sie bezahlt. Zehn Gemeinden sind rund 970 Rang.
          if (beste && besteComms >= RUNDREISE_MIN_COMMS) {
            if (ns.bladeburner.switchCity(beste)) {
              sag("Stadtwechsel nach " + beste + ": " + hier + " hat nur noch "
                + commsHier + " Gemeinden, dort sind es " + besteComms + ".");
            }
          }
        }
      } catch { /* alte API-Fassung: dann bleibt es bei einer Stadt */ }
    }

    // 2c. ASSASSINATION AUF STUFE BRINGEN, SOLANGE RAID NOCH TRAEGT
    //     (27.08.2026, 23:42).
    //
    // Raid ist die beste Aktion, die dieser Knoten hat - aber sie ist
    // **endlich**: 361 Gemeinden ueber alle sechs Staedte, jeder Erfolg
    // verbraucht eine (`Bladeburner.ts:836`), und Nachschub gibt es nur
    // alle 140 Minuten (`randomEvent`, 5 Prozent von einem Ereignis alle
    // 240 bis 600 Sekunden). Bei einem Zyklus von 190 Sekunden ist der
    // Vorrat in **19 Stunden** aufgebraucht. Danach faellt der Motor auf
    // Stealth Retirement mit 25,4 Rang je Minute - und der Restweg von rund
    // 250.000 Rang dauert dann 163 Stunden.
    //
    // Assassination ist der einzige Ausweg, und der Grund steht in zwei
    // Konstanten (`data/Operations.ts`):
    //
    //     Aktion         rewardFac  difficultyFac  netto je Stufe
    //     Raid                1,10          1,045          1,0526
    //     Stealth Ret.        1,11          1,050          1,0571
    //     Assassination       1,14          1,060          1,0755
    //
    // **Warum netto:** Die Dauer ist LINEAR in der Schwierigkeit
    // (`Action.ts:105-121`, `baseTime = difficulty / DifficultyToTimeFactor`),
    // und die Schwierigkeit waechst mit `difficultyFac^(level-1)`. Der
    // Ertrag je Minute waechst also nur mit dem Quotienten. Assassination
    // gewinnt dort mit 7,55 Prozent je Stufe.
    //
    // KORREKTUR ZU MEINER EIGENEN RECHNUNG VON 23:12: Dort stand, Stufe 9
    // brachte "125 Rang je 96 Sekunden = 78,5 je Minute". Falsch - bei
    // Stufe 9 ist die Dauer auf 153 Sekunden gestiegen, macht **49,2**.
    // Das liegt UNTER dem Raid-Zyklus. Die Dauersteigerung war vergessen.
    //
    // Gerechnet mit der Basisrate 27,5 Rang/min (Stufe 1, gemessen 20:41:
    // 44 Rang, 96 s, Chance 0,999):
    //
    //     Stufe 11   27,5 x 1,0755^10 = 56,9   ->  schlaegt den Raid-Zyklus
    //     Stufe 12                      61,2
    //     Stufe 15                      76,4
    //     Stufe 20                     110,0   ->  und weiter, unbegrenzt
    //
    // Der Aufbau bis Stufe 12 kostet 96 Erfolge
    // (`ceil(0,5 x n x (2 x 2,5 + n - 1))`, `LevelableAction.ts:54-56`) bei
    // im Mittel rund 130 Sekunden - **3,5 Stunden**. Dabei entsteht selbst
    // Rang (im Mittel 42 je Minute gegen 53,4 des Raid-Zyklus), die
    // Nettokosten sind also nur rund **2.700 Rang**. Gegen 163 Stunden
    // Stealth Retirement ist das nichts.
    //
    // WARUM DER MOTOR ES NICHT VON ALLEIN TUT: `beste()` rechnet den Ertrag
    // bei der AKTUELLEN Stufe. Eine Aktion mit Aufbaukosten gewinnt in einer
    // Momentaufnahme nie - sie braucht eine Regel, die den Aufbau als
    // Investition behandelt.
    //
    // ABBRUCH: Faellt die geschaetzte Chance unter `SICHER_OPERATION`,
    // greift die Regel nicht mehr - dann uebernimmt die normale Auswahl.
    // Bei Stufe 12 ist die Schwierigkeit auf das 2,01fache gestiegen; wo die
    // Chance kippt, ist der Aufbau zu Ende.
    if (ASSASSIN_AUFBAU) {
      try {
        const stufe = ns.bladeburner.getActionMaxLevel(O, "Assassination");
        if (stufe < ASSASSIN_ZIEL_STUFE && offen(O, "Assassination") >= 1) {
          const s = spanne(O, "Assassination");
          if (s.min >= SICHER_OPERATION) {
            return { typ: O, name: "Assassination",
              grund: "Stufenaufbau " + stufe + "/" + ASSASSIN_ZIEL_STUFE
                + " (Chance " + s.min.toFixed(3) + ")" };
          }
        }
      } catch { /* alte API-Fassung: dann bleibt es bei der normalen Auswahl */ }
    }

    // 2b. DEN TRUPP AUFFUELLEN, SOLANGE ER BILLIG IST (27.08.2026, 19:52).
    //
    // `operationTeamSuccessBonus = (teamCount + 1)^0,05`
    // (`Actions/Operation.ts:96-98`) gilt fuer Operationen UND Black Ops -
    // multiplikativ auf die competence, also auf die ganze Reststrecke. Der
    // Bot hat trotzdem nie einen Mann rekrutiert: `teamCount` stand am
    // 27.08. um 18:19 auf 0, und in `src/` gab es keinen einzigen Aufruf von
    // `Recruitment`.
    //
    // Warum genau SECHS und nicht zwanzig: Der Exponent 0,05 ist extrem
    // flach, und die Rekrutierungschance ist
    // `charisma^0,45/(teamSize - sleeveSize + 1)`
    // (`data/GeneralActions.ts:29-31`). Bei Charisma 264 ist
    // `charisma^0,45 = 12,29`, die Chance steht also **bis elf Mitglieder auf
    // 1,00** - jeder Versuch sitzt. Die Dauer betraegt
    // `max(10, 300 - (cha^0,81 + cha/90))` = **206 Sekunden**. Gerechnet:
    //
    //     bis  5 Mitglieder   0,29 h   Bonus  +9,4 %    32,8 %/h
    //     bis 11              0,63 h         +13,2 %    11,2 %/h
    //     bis 20              1,32 h         +16,4 %     3,7 %/h
    //     bis 30              2,46 h         +18,7 %     1,7 %/h
    //
    // Der Grenznutzen bricht nach fuenf um Faktor drei ein. Die ersten
    // siebzehn Minuten bringen 9,4 Prozent, die naechsten zwei Stunden
    // zusammen nur noch 9,3.
    //
    // Und es haelt sich selbst: `BlackOperation.getMinimumCasualties()` gibt
    // 1 zurueck (`Actions/BlackOperation.ts:63-65`), aber solange die Chance
    // auf 1,00 steht, kostet jeder Ersatz genau einen Lauf.
    //
    // NICHT waehrend einer Black Op und nicht bei knapper Ausdauer - der
    // Block steht deshalb NACH der Black-Op-Pruefung. Recruitment selbst
    // verbraucht keine Ausdauer (`data/GeneralActions.ts:33-34`).
    if (TRUPP_ZIEL > 0) {
      let trupp = -1;
      try { trupp = ns.bladeburner.getTeamSize(); } catch { /* alte Fassung */ }
      if (trupp >= 0 && trupp < TRUPP_ZIEL) {
        return { typ: G, name: "Recruitment",
          grund: "Trupp auffuellen (" + trupp + "/" + TRUPP_ZIEL + ")" };
      }
    }

    {
      {
      }
    }

    // 3. Operationen, danach Vertraege. Innerhalb einer Gruppe gewinnt die
    //    Aktion mit dem hoechsten RANGERTRAG JE MINUTE - nicht die mit der
    //    hoechsten Erfolgschance.
    //
    // DIE SICHERSTE AKTION IST NICHT DIE BESTE (25.08.2026, 21:57).
    //
    // Bis hierher gewann `s.min`, also die Erfolgswahrscheinlichkeit allein.
    // Das optimiert die falsche Zahl: Was zaehlt, ist Ertrag mal Chance
    // geteilt durch Dauer. Gemessen um 21:56 (`data/bbspann.json`):
    //
    //   Bounty Hunter   0,457 Chance · 0,9 Rang · 21 s  ->  1,176 Rang/min
    //   Retirement      0,449 Chance · 0,6 Rang · 21 s  ->  0,770 Rang/min
    //
    // Beide Vertraege sind gleich lang und praktisch gleich sicher, aber der
    // eine bringt die Haelfte mehr. Die alte Regel hat trotzdem Retirement
    // gewaehlt, sobald dessen Schaetzung einen Hauch hoeher lag.
    //
    // Die Sicherheitsschwelle bleibt als FILTER erhalten - sie entscheidet,
    // was ueberhaupt in Frage kommt. Nur die Rangfolge darunter aendert sich.
    //
    // rankGain-Werte aus reference/bitburner-src/src/Bladeburner/data/.
    const RANG_JE_ERFOLG = {
      "Tracking": 0.3, "Bounty Hunter": 0.9, "Retirement": 0.6,
      "Investigation": 2.2, "Undercover Operation": 4.4, "Sting Operation": 5.5,
      "Stealth Retirement Operation": 22, "Assassination": 44, "Raid": 55,
    };
    const beste = (liste, typ, schwelle) => {
      let treffer = null;
      for (const name of liste) {
        if (offen(typ, name) < 1) continue;
        const s = spanne(typ, name);
        if (s.min < schwelle) continue;
        // DIE STUFE GEHOERT IN DEN ERTRAG (27.08.2026, 14:19).
        //
        // `RANG_JE_ERFOLG` sind die BASISwerte. Der tatsaechliche Gewinn
        // waechst mit der Aktionsstufe: `rankGain * rewardFac^(level-1)`
        // (`Bladeburner.ts:1029-1034` ueber `calculateActionRankGain`). Weil
        // die Basiswerte ungefaehr proportional zur Dauer sind, kommen ohne
        // diesen Faktor ALLE Vertraege auf denselben Ertrag je Minute - der
        // Vergleich entscheidet dann nach Rauschen.
        //
        // Gemessen 14:17 (`data/bbspann.json`, das rechnet es bereits richtig):
        //
        //     Tracking        Stufe 39   1,041^38 = 4,62   ->  4,63 je Minute
        //     Retirement      Stufe 30   1,065^29 = 6,08   ->  6,26
        //     Bounty Hunter   Stufe 28   1,085^27 = 8,90   ->  8,90
        //
        // Bounty Hunter ist fast doppelt so gut wie Tracking - und verbraucht
        // dabei 2,46 Ausdauer je Minute gegen 4,92. Bei einer Regeneration von
        // 3,113 je Minute heisst das: Mit Bounty Hunter braucht es fast keine
        // Kammer, mit Tracking laeuft die Ausdauer leer. Im Fenster
        // 13:40-14:10 lief Tracking 25,1 Prozent und die Kammer 31,1.
        const REWARD_FAC = {
          "Tracking": 1.041, "Bounty Hunter": 1.085, "Retirement": 1.065,
          "Investigation": 1.07, "Undercover Operation": 1.09,
          "Sting Operation": 1.095, "Raid": 1.1,
          "Stealth Retirement Operation": 1.11, "Assassination": 1.14,
        };
        let stufe = 1;
        try { stufe = ns.bladeburner.getActionCurrentLevel(typ, name); } catch { /* dann Basis */ }
        const fac = REWARD_FAC[name] || 1;
        const rang = RANG_JE_ERFOLG[name] * Math.pow(fac, Math.max(0, stufe - 1));
        let dauer = 0;
        try { dauer = ns.bladeburner.getActionTime(typ, name); } catch {}
        // DIE CHAOS-FOLGEKOSTEN GEHOEREN IN DIE DAUER (28.08.2026, 03:42).
        //
        // Drei Aktionen veraendern das Chaos ihrer Stadt
        // (`Bladeburner.ts:836-859`), und zwar prozentual:
        //
        //     Raid                        +1 bis +5 %   (Mittel +3)
        //     Stealth Retirement          -1 bis -3 %   (Mittel -2)
        //     Assassination               -5 bis +5 %   (Mittel  0)
        //
        // Ueber Chaos 50 schlaegt das mit `sqrt(1+chaos-50)` auf die
        // Schwierigkeit JEDER Aktion (`Action.ts:94-100`). Ein Raid dort
        // erzwingt also Diplomacy-Laeufe, die selbst nichts einbringen - und
        // `beste()` hat sie bis hierher nicht gesehen. Es verglich die
        // nackte Dauer und waehlte damit systematisch die Aktion, deren
        // Rechnung ausgelagert ist.
        //
        // GEMESSEN in der Nacht, zwei Fenster von je 40 bis 49 Minuten
        // (`data/verlauf-strategie.json`):
        //
        //     02:04 - 02:53   nur Assassination      **86,4 Rang/min**
        //     02:53 - 03:33   Raid und Diplomacy     **35,4**
        //
        // Der Wechsel kam, als Assassination Stufe 12 erreichte und die
        // Anlaufregel abschaltete: `beste()` rechnete Raid auf Stufe 12 mit
        // 157 Rang je 59 Sekunden = 159 je Minute, Assassination mit 186 je
        // 108 Sekunden = 103 - und waehlte Raid. Mit den zwei
        // Diplomacy-Laeufen, die jeder Raid nach sich zieht, sind es real
        // aber nur 52,6 gegen 103.
        //
        // Der Zuschlag rechnet genau das: Wieviele Diplomacy-Laeufe kostet
        // der Chaos-Anstieg dieser Aktion? Ein Lauf dauert fest 60 Sekunden
        // (`data/GeneralActions.ts:39`) und senkt um
        // `charisma^0,045 + charisma/1000` Prozent (`Bladeburner.ts:735-743`).
        //
        // Unterhalb von `CHAOS_AUS` ist der Zuschlag null - dort ist Platz
        // nach oben, und ein Raid kostet nichts.
        const CHAOS_JE_LAUF = { "Raid": 3, "Stealth Retirement Operation": -2, "Assassination": 0 };
        const chaosDelta = CHAOS_JE_LAUF[name] || 0;
        if (chaosDelta > 0 && dauer > 0) {
          try {
            const c = chaosLage();
            if (c > CHAOS_AUS) {
              const cha = ns.getPlayer().skills.charisma;
              const senkungProz = Math.pow(cha, 0.045) + cha / 1000;
              // Beide Richtungen sind prozentual, das Niveau kuerzt sich
              // heraus - das Verhaeltnis ist die Zahl der noetigen Laeufe.
              const laeufe = chaosDelta / senkungProz;
              dauer += laeufe * 60000;
            }
          } catch { /* ohne Charisma-Wert bleibt es bei der nackten Dauer */ }
        }
        // Fehlt eine der beiden Zahlen, faellt die Aktion auf die alte
        // Bewertung zurueck: besser eine grobe Rangfolge als gar keine.
        // Rang je AUSDAUERPUNKT, sobald ueberhaupt etwas gemessen ist.
        //
        // ZWEI EINHEITEN IM SELBEN VERGLEICH SIND KEIN VERGLEICH
        // (26.08.2026, 09:55). Der erste Entwurf liess Aktionen ohne Messung
        // auf "Rang je Minute" zurueckfallen - und die Zahlen liegen auf
        // voellig verschiedenen Skalen: 0,19 gegen 0,77. Der Rueckfall gewann
        // dadurch IMMER, und um 09:54 fuhr der Motor prompt Retirement, die
        // einzige Aktion ohne Messwert.
        //
        // Jetzt bekommt eine ungemessene Aktion den Durchschnitt der
        // gemessenen als Schaetzwert. Damit steht sie auf derselben Skala,
        // kommt trotzdem an die Reihe und liefert dabei ihre eigene Messung.
        // ZURUECKGEDREHT (26.08.2026, 10:15) - die Messung hat die Rechnung
        // widerlegt. Ausgewaehlt wird wieder nach Rang je MINUTE.
        //
        // Von 09:57 bis 10:14 lief die Auswahl nach Rang je Ausdauerpunkt:
        //   vorher (09:19-09:45)   55,5 % Kammer   0,926 Rang/min
        //   danach (09:57-10:14)   62,3 % Kammer   0,606 Rang/min
        // Erwartet waren mindestens 1,15. Selbst auf siebzehn Minuten
        // Messstrecke ist ein Drittel Verlust kein Rauschen.
        //
        // Die Zyklusrechnung von 09:46 hat etwas uebersehen - vermutlich, dass
        // Bounty Hunter mit 44 Prozent Erfolgschance unter der Sicherheits-
        // schwelle liegt und ueber den Notvertrag-Zweig laeuft: Jeder
        // Fehlschlag kostet volle Ausdauer und bringt null Rang, und das
        // trifft mehr als die Haelfte der Versuche.
        //
        // Die MESSUNG bleibt (kostenAktualisieren oben): Sie kostet nichts,
        // liefert weiter Daten, und die naechste Hypothese kann darauf
        // aufbauen, statt wieder bei null anzufangen.
        const proLauf = kosten.get(typ + "/" + name) ?? kostenSchnitt;
        const ertrag = (rang && dauer) ? rang * s.min / (dauer / 60000) : s.min;
        // proMinute wird MITGEFUEHRT, auch wenn nach Ausdauer ausgewaehlt
        // wird: Der Vergleich mit General-Aktionen (Field Analysis, Training)
        // geht nur ueber die Zeit, denn die kosten gar keine Ausdauer. Ohne
        // diese zweite Zahl vergleicht man Aepfel mit Birnen - genau das ist
        // um 09:55 passiert, und der Motor landete prompt auf Field Analysis.
        const proMinute = (rang && dauer) ? rang * s.min / (dauer / 60000) : s.min;
        if (!treffer || ertrag > treffer.ertrag) {
          treffer = { name, min: s.min, ertrag, proMinute };
        }
      }
      return treffer;
    };

    // CHAOS UEBER 50 HALBIERT ALLE ERFOLGSCHANCEN (26.08.2026, 15:20).
    //
    // Gemessen um 14:49: Sector-12 stand bei Chaos 53,89, und die Chancen
    // waren gegenueber 13:22 auf die Haelfte gefallen - Tracking 0,778 auf
    // 0,357, Retirement 0,468 auf 0,219, Bounty Hunter 0,388 auf 0,182. Die
    // Rangrate fiel von 0,841 auf 0,625 je Minute.
    //
    // Der Grund steht in `Actions/Action.ts:94-101`: Ueber `ChaosThreshold`
    // (50) wird die SCHWIERIGKEIT mit `sqrt(1 + (chaos - 50))` multipliziert,
    // hier `sqrt(4,89) = 2,21`. Das deckt sich mit dem gemessenen Faktor 2,18.
    // Unter 50 ist der Faktor exakt 1 - der Schaden setzt schlagartig ein und
    // verschwindet ebenso schlagartig.
    //
    // Diplomacy senkt das Chaos PROZENTUAL um `charisma^0,045 + charisma/1000`
    // (`Bladeburner.ts:735-743`, `:1185-1187`), dauert 60 Sekunden und kostet
    // **keine Ausdauer** (`data/GeneralActions.ts:37-44`). Bei niedrigem
    // Charisma sind das gut ein Prozent je Durchlauf - von 53,89 auf unter 50
    // also rund sieben Minuten. Danach arbeitet jede Aktion wieder mit der
    // doppelten Chance, und zwar dauerhaft.
    //
    // Die Hysterese ist knapp gewaehlt (ein ab 50, aus bei 47), weil die
    // Senkung prozentual und damit langsam ist: Von 50 auf 40 waeren es
    // siebzehn Durchlaeufe. Drei Prozentpunkte Abstand halten die Schwelle
    // sicher unterschritten, ohne die Arbeit lange zu unterbrechen.
    //
    // WARUM VOR DER AKTIONSWAHL: Der Wert, den `beste()` vergleicht, ist
    // bereits durch das Chaos verdorben. Wer erst waehlt und dann aufraeumt,
    // waehlt auf Basis halbierter Zahlen.
    if (SPIEL_CHAOS_AN) {
      if (chaosLage() > CHAOS_EIN) chaosAufraeumen = true;
      if (chaosLage() < CHAOS_AUS) chaosAufraeumen = false;
      if (chaosAufraeumen) {
        // STEALTH RETIREMENT STATT DIPLOMACY (27.08.2026, 20:42).
        //
        // Beide senken das Chaos **prozentual** - Diplomacy um
        // `charisma^0,045 + charisma/1000` (`Bladeburner.ts:1185-1187`),
        // Stealth Retirement um 1 bis 3 Prozent (`Bladeburner.ts:853`).
        // Nur eines von beiden gibt dabei Rang. Gemessen 20:41 im Spiel
        // (`src/sr.js`), Charisma 287, Chaos 50,8:
        //
        //     Raid       lvl 9  Chance 0,900  73 s  118 Rang  Chaos +3 %
        //     Stealth R. lvl 5  Chance 0,999  78 s   33 Rang  Chaos -2 %
        //     Diplomacy                       60 s    0 Rang  Chaos -1,58 %
        //
        // Ein Raid hebt bei Chaos 50 um 1,5 Punkte. Zum Ausgleich braucht es
        // 1,5 Stealth Retirements (je -1,0) oder 1,9 Diplomacy-Laeufe
        // (je -0,79):
        //
        //     Raid + 1,5 SR    190 s fuer 156 Rang  =  49,3 Rang/min
        //     Raid + 1,9 Dipl. 187 s fuer 106 Rang  =  34,0 Rang/min
        //
        // **Plus 45 Prozent.** Diplomacy ist strikt dominiert, solange die
        // SR-Chance hoch ist.
        //
        // DIE GRENZE IST DIE BEVOELKERUNG, nicht die Chance: SR senkt sie um
        // 0,5 Prozent je Erfolg (`Bladeburner.ts:848`), und sie wirkt ueber
        // `(pop/1e9)^0,7` auf die Erfolgschance jeder Operation
        // (`Action.ts`, `getPopulationSuccessFactor`). Unter 0,8e9 faellt
        // Raid unter seine Schwelle - dann wieder Diplomacy, die nichts
        // verbraucht.
        let srTauglich = false;
        try {
          const stadt = ns.bladeburner.getCity();
          const pop = ns.bladeburner.getCityEstimatedPopulation(stadt);
          const ch = ns.bladeburner.getActionEstimatedSuccessChance(
            "Operations", "Stealth Retirement Operation");
          srTauglich = pop >= SR_POP_MIN && ch[0] >= SR_CHANCE_MIN;
        } catch { srTauglich = false; }
        if (srTauglich) {
          return { typ: O, name: "Stealth Retirement Operation",
            grund: "Chaos " + chaosLage().toFixed(1) + " (senkt und gibt Rang)" };
        }
        return { typ: G, name: "Diplomacy",
          grund: "Chaos " + chaosLage().toFixed(1) };
      }
    }

    // RAID - DIE EINZIGE OPERATION, DIE SICH RECHNET (26.08.2026, 16:20).
    //
    // `SICHER_OPERATION` steht auf 0,85 und schliesst damit die gesamte
    // Aktionsklasse aus: Alle sechs Operationen liegen zwischen 0,04 und 0,19.
    // Fuer fuenf von ihnen ist das richtig - Assassination hat bei diesen
    // Chancen einen NEGATIVEN Erwartungswert (-0,72 je Minute), Stealth
    // Retirement einen von null. Raid ist die Ausnahme, und zwar deutlich.
    //
    // Gemessen 16:14 ueber `data/bbspann.json`:
    //
    //     Raid       Chance 0,123   55 Rang   56 s   Zyklusrate 4,86
    //     Tracking   Chance 0,725    0,3      15 s   Zyklusrate 1,20
    //
    // Der Grund liegt nicht im Rangertrag allein, sondern in der DAUER: Der
    // Ausdauerverlust faellt je AKTION an (`Bladeburner.ts:921`), und Raid
    // verteilt seine 2,20 Punkte auf 56 Sekunden. Das sind 2,36 je Minute
    // gegen eine Regeneration von 2,31 - der Arbeitsanteil steigt von 44 auf
    // 99 Prozent. Tracking verbraucht 5,18 je Minute und muss mehr als die
    // Haelfte der Zeit ruhen.
    //
    // DREI BEDINGUNGEN, UND JEDE HAT EINE GEMESSENE ZAHL DAHINTER:
    //
    // *Guthaben.* Raids Schaden ist `50 * difficultyMultiplier` = 397
    // Trefferpunkte, das Maximum liegt bei 25 - also Krankenhaus bei jedem
    // Fehlschlag. Die Kosten sind `min(Geld * 0,1, (max - current) * 100.000)`
    // (`Hospital.ts:4-10`), hier 39,7 Millionen je Misserfolg, rund 37 je
    // Minute. Gemessen mit `geld.js` kommen 25,7 Millionen je Minute herein.
    // Das Defizit ist selbstbegrenzend - faellt das Guthaben, greift der
    // Deckel `Geld * 0,1` -, aber unterhalb von zwei Milliarden soll der Bot
    // wieder Vertraege fahren koennen, ohne dass ein Portprogramm oder eine
    // Serveraufruestung daran scheitert.
    //
    // *Chaos.* Ueber 50 wird die Schwierigkeit mit `sqrt(1 + chaos - 50)`
    // multipliziert (`Actions/Action.ts:94-101`). Bei halbierter Chance kippt
    // Raids Erwartungswert schnell - siehe die naechste Bedingung.
    //
    // *Erfolgschance.* Der Erwartungswert je Versuch ist
    // `p * 55 - (1 - p) * 2,5` und wird bei **p = 0,0435** negativ. Die
    // Grenze 0,08 haelt den doppelten Abstand dazu.
    //
    // ES WIRD BEWUSST NICHT MIT DEM BESTEN VERTRAG VERGLICHEN. `beste()`
    // rechnet einen BRUTTOertrag ohne Levelfaktor und ohne Rangverlust; ein
    // Vergleich auf dieser Grundlage haette Raid mit 7,25 gegen 0,87
    // bewertet statt mit 4,90 gegen 2,51 und damit aus dem falschen Grund
    // das richtige Ergebnis geliefert. Genau dieser Fehler hat am 26.08. um
    // 12:55 einen falschen Auftrag erzeugt. Solange `beste()` brutto rechnet,
    // entscheiden hier feste Grenzen - das ist ehrlicher.
    // WARUM EINE CHARISMA-SCHWELLE (26.08.2026, 16:50)
    //
    // Raid erzeugt selbst das Chaos, das ihn ausbremst:
    // `city.changeChaosByPercentage(getRandomIntInclusive(1, 5))` je Durchlauf,
    // unabhaengig von Erfolg (`Bladeburner.ts:846`). Im Mittel 3 Prozent auf
    // 56 Sekunden Laufzeit, also **+3,21 Prozent je Minute**.
    //
    // Dagegen haelt nur Diplomacy: 60 Sekunden, keine Ausdauer, keine
    // Erfahrung, senkt das Chaos um `charisma^0,045 + charisma/1000` Prozent
    // (`Bladeburner.ts:737-745`, `:1188-1189`). Beide Groessen sind prozentual,
    // das Verhaeltnis ist damit chaos-unabhaengig, und der Raid-Anteil im
    // Gleichgewicht ist `D / (D + 3,21)` mit D = Diplomacy-Prozent je Minute.
    //
    // D haengt allein am Charisma, und der lineare Term regiert:
    //
    // GEMESSEN am 26.08. um 17:15 aus dem Spielstand: **Charisma 27**, 409
    // Erfahrung, `mults.charisma` 1,557. Damit sieht die Tabelle so aus, und
    // die Erfahrungsspalte ist die eigentliche Antwort
    // (`exp = e^((lvl/mult + 200)/32) - 534,6`, `formulas/skill.ts:17-19`):
    //
    //   Charisma   noetige Exp   D/min   Anteil   effektive Zyklusrate
    //         27      3,6 x 10^2   1,187    27,0%                  1,02  <- ist
    //        100      3,3 x 10^3   1,330    29,3%                  1,11
    //        300      2,1 x 10^5   1,593    33,2%                  1,26
    //        440      3,5 x 10^6   1,755    35,3%                  1,34  <- gleichstand
    //      1.200      1,5 x 10^13  2,576    44,5%                  1,69
    //
    // Tracking liefert 1,339 (`data/bbspann.json`, 15:46). Raid holt den
    // Gleichstand erst bei Charisma 440 ein - und dorthin fehlen dem Spieler
    // 3,5 Millionen Erfahrung, das rund 8.700-fache des vorhandenen Standes.
    // Bei geschaetzten 20 Erfahrung je Sekunde am Leadership-Kurs waeren das
    // rund 49 Stunden, in denen der Rang gar nicht waechst; dieselben 49
    // Stunden Tracking bringen rund 3.900 Rang - mehr als die 1.592, die bis
    // Operation Typhoon fehlen. Charisma-Training ist damit strikt schlechter,
    // und Raid ist in diesem Knoten kein Hebel. Die Schwelle 1.200 bleibt
    // stehen, weil sie in einem Knoten mit hohem Startcharisma greifen wuerde.
    //
    // Die alte Erwartung "Faktor 3,4" (BAUSTELLEN.md, 13:22) galt fuer einen
    // Raid-Anteil von 97 Prozent und hat die Chaos-Gegenkraft nicht gerechnet.
    if (RAID_AN) {
      const rc = spanne(O, "Raid");
      const raidSpieler = ns.getPlayer();
      const raidGeld = raidSpieler.money;
      if (raidGeld > RAID_GELD_MIN
        && raidSpieler.skills.charisma > RAID_CHARISMA_MIN
        && chaosLage() < RAID_CHAOS_MAX
        && rc.min > RAID_CHANCE_MIN
        && offen(O, "Raid") > RAID_VORRAT_MIN) {
        return { typ: O, name: "Raid",
          grund: "Raid, Chance " + rc.min.toFixed(3) };
      }
    }

    const op = beste(OPERATIONEN, O, SICHER_OPERATION);
    if (op) return { typ: O, name: op.name, grund: "Operation" };

    const vt = beste(VERTRAEGE, V, SICHER_VERTRAG);
    if (vt) return { typ: V, name: vt.name, grund: "Vertrag" };

    // EIN UNSICHERER VERTRAG SCHLAEGT FIELD ANALYSIS UM LAENGEN
    // (26.08.2026, 00:55).
    //
    // Faellt keine Aktion ueber ihre Sicherheitsschwelle, landete der Motor
    // bisher bei Field Analysis - und die bringt rankGain 0,1, also rund 0,2
    // Rang je Minute. Gemessen am 26.08. zwischen 22:43 und 00:51: 28 Rang in
    // 128 Minuten, 0,22 je Minute. Genau dieser Wert.
    //
    // Dabei lagen die Vertraege nur knapp darunter: Bounty Hunter 0,381 gegen
    // eine Schwelle von 0,45. Sein Ertrag betraegt trotzdem 0,98 Rang je
    // Minute - das FUENFFACHE von Field Analysis. Die Schwelle vergleicht die
    // Chance mit einer festen Zahl, statt den Ertrag mit der Alternative.
    //
    // Bei Vertraegen ist ein Misserfolg billig: etwas Ausdauer, etwas Chaos,
    // kein Rangverlust und kein Toter. Deshalb gilt hier der Ertragsvergleich.
    // Operationen (Teamverluste) und Black Ops (Tod) behalten ihre
    // Sicherheitsschwellen unangetastet.
    let feldErtrag = 0.2;
    try {
      const t = ns.bladeburner.getActionTime(G, "Field Analysis");
      if (t > 0) feldErtrag = 0.1 / (t / 60000);
    } catch { /* Schaetzwert bleibt */ }
    const notvertrag = beste(VERTRAEGE, V, 0);
    // Der Faktor 1,5 ist Absicht: Ein knapper Vorsprung waere die Unschaerfe
    // nicht wert, die Field Analysis ausraeumen wuerde.
    if (notvertrag && notvertrag.proMinute > feldErtrag * 1.5) {
      return { typ: V, name: notvertrag.name,
        grund: "Vertrag unter Schwelle, lohnt trotzdem" };
    }

    // 3b. SIND DIE VORRAETE LEER? DANN NACHFUELLEN (26.08.2026, 10:48).
    //
    // Gemessen 10:45: Tracking hat nur noch **1,0** offene Vertraege, und
    // seine Erfolgschance ist von 0,74 auf 0,525 gefallen. Bounty Hunter und
    // Retirement stehen bei 0,273 und 0,324 - beide unter der Schwelle. Der
    // Motor faellt deshalb auf schlechte Aktionen zurueck, und die Rangrate
    // ist von 0,926 auf 0,60 je Minute eingebrochen.
    //
    // `Incite Violence` fuellt ALLE Vertraege und Operationen auf einen
    // Schlag: Es rechnet 180 Wachstumsschritte auf einmal gut
    // (`Bladeburner.ts:1219-1225`, `60 * 3 * growthFunction()`). Es dauert
    // 60 Sekunden und kostet **keine Ausdauer**
    // (`data/GeneralActions.ts:52-58`) - genau richtig, wenn die Ausdauer
    // ohnehin der Engpass ist.
    //
    // Der Preis ist Chaos: +10 plus chaos/log10(chaos) in JEDER Stadt. Erst
    // ueber 50 macht Chaos die Aktionen schwerer
    // (`ChaosThreshold`, `Actions/Action.ts:94-101`), und aktuell steht
    // Sector-12 bei 13. Ein Durchlauf bringt es auf etwa 35, ein zweiter
    // darueber - deshalb die Grenze bei 25.
    const chaosJetzt = (() => {
      try { return ns.bladeburner.getCityChaos(ns.bladeburner.getCity()); }
      catch { return 999; }
    })();
    // `some`, nicht `every` (korrigiert 10:49): Leer sein muss nur EIN
    // Vertrag - und zwar der beste. Um 10:47 stand Tracking bei 1,0 offenen
    // Auftraegen, waehrend Bounty Hunter noch 487 hatte; mit `every` haette
    // der Block nie gegriffen, obwohl genau dieser Fall gemeint ist.
    //
    // Die Rechnung dahinter: Eine Minute Incite Violence kostet den Ertrag
    // des Notvertrags (Bounty Hunter, 0,567 Rang je Minute). Danach ist
    // Tracking wieder da und bringt 2,2 - der Verlust ist nach gut dreissig
    // Sekunden wieder eingespielt.
    const vorratLeer = VERTRAEGE.some((name) => offen(V, name) < 3);
    if (vorratLeer && chaosJetzt < 25) {
      return { typ: G, name: "Incite Violence", grund: "Vertragsvorrat leer" };
    }

    // 4. Nichts sicher genug. Liegt das an der Schaetzung oder an uns?
    //
    // FIELD ANALYSIS NUR, WENN SIE ETWAS AUFSCHLIESST (28.08.2026, 08:09).
    //
    // Hier stand `s.max - s.min > SPANNE_ZU_BREIT` - eine breite Spanne
    // genuegte. Das ist zu wenig verlangt: Eine unscharfe Schaetzung ist nur
    // dann ein Problem, wenn das Schaerfen eine Aktion FREIGIBT. Liegt die
    // Obergrenze schon unter der Schwelle, aendert genaueres Wissen nichts
    // an der Entscheidung - die Aktion bleibt zu riskant, und Field Analysis
    // kauft dann nur die bessere Anzeige.
    //
    // Was das gekostet hat, gemessen am 28.08.: `data/blade.json` stand von
    // 07:52 bis 08:08 auf "General/Field Analysis", **16 Minuten**. Der Rang
    // bewegte sich dabei von 82.293 auf 82.297 - vier Punkte, 0,25 je Minute.
    // Die geglaettete 45-Minuten-Rate fiel auf 12,0/min, gegen 218,6 im
    // Vier-Stunden-Mittel. Field Analysis hat `rankGain` 0,1 und gibt
    // **keine** Kampferfahrung, half also gegen den Wiederaufbau doppelt
    // nicht.
    //
    // Genau dieselbe Einsicht steht seit dem 27.08., 09:19 im Black-Op-Zweig
    // ("Genau ein Fall rechtfertigt sie - wenn die Obergrenze ueber der
    // Schwelle liegt und nur die Unschaerfe den Versuch verhindert"). Sie war
    // dort richtig und ist hier nie angekommen.
    //
    // Der Test konvergiert in beide Richtungen: Field Analysis verengt die
    // Spanne, also steigt `s.min` ueber die Schwelle (dann laeuft die Aktion)
    // oder `s.max` faellt darunter (dann greift die Regel nicht mehr). Ein
    // Dauerzustand wie heute frueh ist damit ausgeschlossen.
    for (const name of [...OPERATIONEN, ...VERTRAEGE]) {
      const istOp = OPERATIONEN.includes(name);
      const s = spanne(istOp ? O : V, name);
      const schwelle = istOp ? SICHER_OPERATION : SICHER_VERTRAG;
      if (s.max >= schwelle && s.min < schwelle) {
        const jetztMs = Date.now();
        if (jetztMs < feldanalyseGesperrtBis) break;   // gesperrt -> Training
        if (feldanalyseSeit && jetztMs - feldanalyseSeit >= FELDANALYSE_MAX_MS) {
          feldanalyseGesperrtBis = jetztMs + FELDANALYSE_SPERRE_MS;
          break;
        }
        return { typ: G, name: "Field Analysis",
          grund: "Schaetzung verdeckt " + name
            + " (" + s.min.toFixed(2) + "-" + s.max.toFixed(2)
            + " gegen " + schwelle.toFixed(2) + ")" };
      }
    }

    // 5. Die Schaetzung ist scharf und trotzdem zu niedrig: Dann sind wir zu
    //    schwach. Training hebt Kampfwerte UND Hoechstausdauer.
    return { typ: G, name: "Training", grund: "zu schwach" };
  };

  // --- Hauptschleife -------------------------------------------------------
  // HARTE GRENZE FUER FIELD ANALYSIS (28.08.2026, 08:14).
  //
  // Die Freigabe-Bedingung allein reicht nicht. Bei einer wirklich schlechten
  // Bevoelkerungsschaetzung liefert `getSuccessRange` fuer JEDE Aktion
  // [0,00 - 1,00] (`Actions/Action.ts`: `low = real - diff`, und `diff`
  // uebersteigt `real`, also klemmt `low` auf 0). Damit ist "die Obergrenze
  // liegt ueber der Schwelle, die Untergrenze darunter" immer wahr, und die
  // Regel bindet sich selbst nicht.
  //
  // Und sie schliesst langsam: `improvePopulationEstimateByPercentage` bekommt
  // `eff = 0,04*hacking^0,3 + 0,04*int^0,9 + 0,02*cha^0,3`
  // (`Bladeburner.ts:1122-1131`) - in BitNode 6 mit
  // `HackingLevelMultiplier` 0,35 ist der Hacking-Summand klein, es bleiben
  // ein bis zwei Prozent je Durchlauf. Gemessen am 28.08.: 17 Minuten Field
  // Analysis, vier Punkte Rang.
  //
  // Also ein Deckel NACH DER UHR, nicht nach Durchlaeufen: `waehle()` wird
  // je Aktualisierung gerufen, nicht je Aktionsdurchlauf - ein Zaehler wuerde
  // die Schleifenfrequenz messen und nicht die Zeit. Zehn Minuten am Stueck
  // reichen, um eine brauchbare Schaetzung zu holen; danach ist Training die
  // ehrlichere Antwort, denn es hebt die Kampfwerte, und die sind im
  // Wiederaufbau der eigentliche Engpass.
  //
  // Dazu eine Sperre von dreissig Minuten. Ohne sie pendelt der Motor: Der
  // Deckel greift, Training wird gewaehlt, damit faellt `feldanalyseSeit` auf
  // null - und im naechsten Durchlauf waere Field Analysis wieder frei.
  const FELDANALYSE_MAX_MS = 10 * 60 * 1000;
  const FELDANALYSE_SPERRE_MS = 30 * 60 * 1000;
  let feldanalyseSeit = 0;
  let feldanalyseGesperrtBis = 0;
  let letzte = "";
  let ruhend = false;
  let gewichen = false;
  for (;;) {
    try {
      // WER ZU SCHWACH IST, MACHT PLATZ (25.08.2026).
      //
      // Nach einem Augmentierungs-Einbau stehen alle Kampfwerte auf 1. In
      // diesem Zustand kommt keine Aktion ueber ihre Schwelle, und der Motor
      // faellt auf Bladeburner-Training durch - das baut die Werte auf, aber
      // ohne den Ortsmultiplikator des Powerhouse Gym (Faktor 10).
      //
      // bbtrain.js kann das zehnmal schneller, braucht dafuer aber die Figur:
      // gymWorkout ist eine normale Arbeit und wuerde jede laufende
      // Bladeburner-Aktion abbrechen. Zwei Skripte, die sich gegenseitig
      // unterbrechen, erzeugen genau die Dialogflut, die an diesem Nachmittag
      // zweimal aufgetreten ist.
      //
      // Also tritt der Motor zurueck, solange das Tor zu ist. Er verliert dabei
      // nichts: Ohne Kampfwerte gaebe es ohnehin keinen Rang.
      // DIE SCHWELLE 100 WAR ZU NIEDRIG (28.08.2026, 01:52).
      //
      // Sie stammt aus dem Fall "Kampfwerte auf 1" und trifft den heutigen
      // nicht mehr. Nach dem Einbau um 01:25 stand der Tiefstand binnen
      // Minuten wieder bei 101 - der Motor uebernahm also die Figur zurueck,
      // waehrend die Chancen noch am Boden lagen. Gemessen 01:39
      // (`src/astufe.js`):
      //
      //     Assassination  Stufe  9   Chance 0,354
      //     Raid           Stufe 12          0,230
      //     Stealth Ret.   Stufe 10          0,561
      //
      // Alle drei liegen unter `SICHER_OPERATION` = 0,85. Was blieb, war
      // **Diplomacy**: null Rang, null Erfahrung - und dabei blockierte es
      // das Gym, das mit `expMult` 10 (`bbtrain.js:50`) den Tiefstand
      // zehnmal schneller hebt als Bladeburner-Training (30 exp je 30 s auf
      // alle vier, `Bladeburner.ts:1092-1103`).
      //
      // Um 01:33 stand "Arbeit dex @ Powerhouse Gym", um 01:37 "Diplomacy",
      // um 01:41 wieder Diplomacy - die beiden Skripte haben sich die Figur
      // gegenseitig weggenommen. Genau die Dialogflut, gegen die diese Regel
      // urspruenglich gebaut wurde, nur eine Etage hoeher.
      //
      // Der richtige Test ist nicht der Kampfwert, sondern die Frage, ob es
      // ueberhaupt etwas zu verdienen gibt: Liegt **keine** Operation und
      // **kein** Vertrag ueber seiner Schwelle, ist Weichen strikt besser als
      // jede Aktion, die dann noch bliebe.
      const kw = ns.getPlayer().skills;
      const tiefstand = Math.min(kw.strength, kw.defense, kw.dexterity, kw.agility);
      let lohntSich = false;
      try {
        for (const n of OPERATIONEN) {
          if (offen(O, n) < 1) continue;
          if (ns.bladeburner.getActionEstimatedSuccessChance(O, n)[0] >= SICHER_OPERATION) {
            lohntSich = true; break;
          }
        }
        if (!lohntSich) {
          for (const n of VERTRAEGE) {
            if (offen(V, n) < 1) continue;
            if (ns.bladeburner.getActionEstimatedSuccessChance(V, n)[0] >= SICHER_VERTRAG) {
              lohntSich = true; break;
            }
          }
        }
      } catch { lohntSich = true; }   // im Zweifel weiterarbeiten
      // GEWICHEN WIRD NUR, WENN JEMAND UEBERNIMMT (28.08.2026, 07:53).
      //
      // Hier stand `tiefstand < 100 || !lohntSich`, mit der Begruendung, der
      // richtige Test sei nicht der Kampfwert, sondern ob es ueberhaupt etwas
      // zu verdienen gibt. Der Gedanke stimmt - die Folgerung nicht, denn er
      // unterstellt, dass bbtrain dann uebernimmt. **Das tut es nicht.**
      //
      // `bbtrain.js` ist ein Beitrittstor: Es trainiert, bis der niedrigste
      // Kampfwert `ZIEL` erreicht (Vorgabe 100, `bbtrain.js:45`), und parkt
      // danach in seiner Warteschleife. Der Zweig `!lohntSich` hat also gar
      // keine Gegenstelle - er trifft genau dann zu, wenn der Wiederaufbau
      // nach einem Einbau laeuft und die Kampfwerte laengst ueber 100 stehen.
      //
      // Gemessen am 28.08. um 07:49, 1 h 56 min nach dem Einbau von 05:53:
      //     data/blade.json  "General/keine", Grund "weicht bbtrain,
      //                      Kampfwerte 223, nichts ueber Schwelle"
      //     bbtrain.js       parkt (Tiefstand 223 >= ZIEL 100)
      //     Rangrate         25/min gegen 226,5 im Vier-Stunden-Mittel
      // **Niemand hat gearbeitet.** Zwei Skripte, die einander die Figur
      // ueberlassen, und die Figur stand still.
      //
      // Gewichen wird deshalb nur noch, wenn bbtrain wirklich uebernimmt.
      // Faellt der `!lohntSich`-Fall weg, laeuft `waehle()` normal durch und
      // greift auf Bladeburner-Training zurueck - gratis
      // (`Bladeburner.ts:1091-1105`), hebt alle vier Kampfwerte und belegt
      // den Arbeitskanal NICHT, kann sich also mit nichts in die Quere kommen.
      const BBTRAIN_ZIEL = 100;
      // Der `!lohntSich`-Zweig ist zurueck (28.08., 08:40) - aber jetzt mit
      // einem Uebernehmer: Nicht bbtrain bekommt die Figur, sondern blade.js
      // fuehrt das Gym selbst (`gymGreifen()` oben). Damit kann der Fall von
      // 07:49 nicht wiederkehren, in dem beide Skripte gewichen sind.
      if (tiefstand >= BBTRAIN_ZIEL && !lohntSich) {
        const wert = gymGreifen();
        if (wert) {
          gewichen = false;
          meldeLage("Gym/" + wert, "nichts ueber Schwelle, Powerhouse statt"
            + " Bladeburner-Training (Tiefstand " + tiefstand + ")");
          await ns.sleep(30000);
          continue;
        }
        // Kein Gym moeglich (Konto leer, fremde Arbeit, Reise misslungen):
        // dann eben weiter im Bladeburner - `waehle()` faellt auf Training
        // zurueck. Besser langsam als gar nicht.
      }
      if (tiefstand < BBTRAIN_ZIEL) {
        if (!gewichen) {
          sag("Kampfwerte bei " + tiefstand
            + (lohntSich ? "" : ", keine Aktion ueber ihrer Schwelle")
            + " - ueberlasse die Figur bbtrain.js.");
          gewichen = true;
          try { ns.bladeburner.stopBladeburnerAction(); } catch {}
        }
        meldeLage("General/keine", "weicht bbtrain, Kampfwerte " + tiefstand
          + (lohntSich ? "" : ", nichts ueber Schwelle"));
        await ns.sleep(30000);
        continue;
      }
      gewichen = false;

      faehigkeitenKaufen();
      kostenAktualisieren();

      const [jetzt, max] = ns.bladeburner.getStamina();
      let hp = ns.getPlayer().hp;

      // DAS KRANKENHAUS SCHLAEGT DIE KAMMER UM LAENGEN (26.08.2026, 06:55).
      //
      // Gemessen ueber 222 Minuten: Der Motor stand 161 davon - 72,5 Prozent -
      // in der Regenerationskammer, und der Grund waren fast immer die
      // Trefferpunkte, nicht die Ausdauer. Kein Wunder: Das Maximum ist
      // floor(10 + defense/10), also 23 (Person.ts:97), und die Kammer heilt
      // 2 je Durchlauf (Bladeburner.ts:1198). Von 11 auf 17 sind das drei
      // Durchlaeufe - Minuten, in denen kein Rang entsteht.
      //
      // `ns.singularity.hospitalize()` setzt hp.current in EINEM Aufruf auf
      // das Maximum (PlayerObjectGeneralMethods.ts:281-290). Es kostet Geld
      // und sonst nichts: keine Zeit, keine Aktionsunterbrechung. Auf das
      // Ereignis hoert nur die Infiltration (Infiltration.ts:83), und die
      // fahren wir nicht.
      //
      // Kosten: min(Guthaben * 0,1, fehlendeHP * 100.000). Bei zwoelf
      // fehlenden Punkten sind das 1,2 Millionen - gegen ein Guthaben von
      // siebeneinhalb Milliarden ist das nichts. Die Untergrenze von zehn
      // Millionen schuetzt den Wiederaufbau nach einem Einbau: Dort zaehlt
      // jeder Euro fuer Server und Programme, und die Kammer tut es auch.
      if (hp && hp.max > 0 && hp.current < hp.max * HP_WEITER) {
        try {
          if (ns.getPlayer().money > 10e6) {
            ns.singularity.hospitalize();
            hp = ns.getPlayer().hp;
          }
        } catch (e) { /* ohne Singularity bleibt die Kammer */ }
      }

      // Hysterese: Einmal in der Ruhe, wird bis zur Weiter-Schwelle geruht -
      // sonst pendelt der Bot bei jedem Aktionsschritt zwischen beidem.
      const ausdauerKnapp = max > 0 && jetzt < max * AUSDAUER_WEITER;
      const hpKnapp = hp && hp.max > 0 && hp.current < hp.max * HP_WEITER;
      if (ruhend && (ausdauerKnapp || hpKnapp)) {
        // Telemetrie auch im Ruhen - gerade hier. Eine lange Ruhephase ist
        // der Zustand, in dem ein Haenger am laengsten unentdeckt bliebe.
        meldeLage("General/Hyperbolic Regeneration Chamber",
          ausdauerKnapp ? "ruht bis Ausdauer " + Math.round(max * AUSDAUER_WEITER)
            : "ruht bis HP " + Math.round(hp.max * HP_WEITER));
        await ns.bladeburner.nextUpdate();
        continue;
      }
      ruhend = false;

      const wahl = waehle();
      // Der Deckel oben misst eine ZUSAMMENHAENGENDE Strecke: Der Zeitstempel
      // wird beim ersten Field-Analysis-Durchlauf gesetzt und faellt weg,
      // sobald etwas anderes gewaehlt wird.
      if (wahl.typ === G && wahl.name === "Field Analysis") {
        if (!feldanalyseSeit) feldanalyseSeit = Date.now();
      } else {
        feldanalyseSeit = 0;
      }
      if (wahl.grund === "Ausdauer" || wahl.grund === "HP") ruhend = true;

      const laeuft = ns.bladeburner.getCurrentAction();
      const gleich = laeuft && laeuft.type === wahl.typ && laeuft.name === wahl.name;

      // ZURUECKGENOMMEN am 26.08.2026, 23:50. Hier stand von 22:55 bis 23:50
      // eine Zeit-Hysterese: Ein Durchlauf, der zu mehr als einem Viertel
      // gelaufen war, wurde zu Ende gefahren, statt zu wechseln. Erwartet
      // waren gut 6 Prozent mehr Rangrate aus den 160 Sekunden, die die 43
      // Wechsel je Messstrecke verwerfen.
      //
      // Gemessen ueber 48 Minuten (`data/wache-zustand.json`): **1,58 gegen
      // 1,76 vorher** - zehn Prozent SCHLECHTER statt sechs besser.
      //
      // Der Denkfehler: Der Ertragsunterschied zwischen den Aktionen ist
      // groesser als die verworfene Zeit. Gemessen ueber 406 Abschnitte
      // bringt Tracking 3,438 Rang je Arbeitsminute, Bounty Hunter 2,279 -
      // ein Unterschied von 51 Prozent. Wer den Wechsel um bis zu drei
      // Viertel eines Durchlaufs aufschiebt, sitzt genau so lange auf der
      // schlechteren Aktion. Die 8 Prozent verworfene Zeit sind billiger als
      // das.
      //
      // Der Eintrag bleibt als Warnung stehen: Das Springen zwischen
      // Vertraegen ist kein Fehler, sondern die Antwort auf schwankende
      // Schaetzungen - und es ist billiger als jede Verzoegerung.
      if (!gleich) {
        if (ns.bladeburner.startAction(wahl.typ, wahl.name)) {
          let r = null;
          try { r = ns.bladeburner.getRank(); } catch { /* egal */ }
          schliesseAbschnitt(r);
          abschnitt = { von: Date.now(), aktion: wahl.typ + "/" + wahl.name,
            grund: wahl.grund, rang: r, ausdauer: holeAusdauer() };
          const kennung = wahl.typ + "/" + wahl.name;
          if (kennung !== letzte) {
            sag(kennung + "  (" + wahl.grund + ")");
            letzte = kennung;
          }
        } else {
          sag("startAction abgelehnt: " + wahl.typ + "/" + wahl.name);
          await ns.sleep(5000);
        }
      }

      // Telemetrie nach draussen. Rang ist die Zahl, an der dieser ganze
      // Knoten gemessen wird - der Kontrollpunkt aus nodes/ROUTE.md verlangt
      // nach zwei Stunden mindestens 3.500.
      const bo = ns.bladeburner.getNextBlackOp();
      // Die Erfolgschance der laufenden Aktion gehoert nach draussen.
      //
      // Ohne sie rechnet der Strategiepruefer mit dem Bruttoertrag aus dem
      // Quellcode und haelt jeden Motor fuer zu langsam, der einen Vertrag mit
      // maessiger Chance faehrt. Gemessen am 25.08. um 18:21: Retirement gibt
      // rankGain 0,6, gelingt aber nur in 49 Prozent der Faelle - effektiv
      // rund 0,3 je Durchlauf. Der Pruefer erwartete 1,7 und meldete
      // STAGNATION, obwohl blade.js genau das Richtige tat.
      const s = spanne(wahl.typ, wahl.name);
      // Die Erfolgschance der laufenden Aktion gehoert nach draussen: Ohne sie
      // rechnet der Strategiepruefer mit dem Bruttoertrag aus dem Quellcode
      // und haelt jeden Motor fuer zu langsam, der einen Vertrag mit maessiger
      // Chance faehrt. Gemessen am 25.08. um 18:21: Retirement gibt rankGain
      // 0,6, gelingt aber nur in 49 Prozent der Faelle - effektiv rund 0,3 je
      // Durchlauf. Der Pruefer erwartete 1,7 und meldete STAGNATION, obwohl
      // blade.js genau das Richtige tat.
      meldeLage(wahl.typ + "/" + wahl.name, wahl.grund, s.min);

      await ns.bladeburner.nextUpdate();
    } catch (e) {
      sag("FEHLER: " + String(e && e.message ? e.message : e));
      await ns.sleep(10000);
    }
  }
}
