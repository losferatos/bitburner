# Audit 4 - Bladeburner (V2-Ausgang), gegen bitburner-src 3.0.2

Pruefer: Skeptiker-Subagent, 26.09.2026. Streng lesend, nichts an src/ geaendert.
Rechenskripte (alle geeicht, siehe jeweils "Eichung"):
`scratchpad/audit/bo_compare.js`, `spanne_entschluesseln.js`, `spanne2.js`,
`trupp.js`, `skillwert.js`, `zeitfaktor.js`, `aktionen_anteil.js`, `fenster.js`,
`aktionen_folge.js`. Datengrundlage fuer Zeitanteile:
`archiv/aktionen-2026-09-04/aktionen.txt` (1.586 Abschnitte, 30.08.-04.09.;
31.08./01.09. = Op-Phase und Endspiel BN10).

---

## 1. Recruitment frisst 35-40 % der Spielerzeit in Op-Phase und Endspiel - fuer einen Truppbonus, der nie in eine Entscheidung eingeht

- **Bot:** `src/blade.js:2688-2695` (Recruitment kehrt unbedingt zurueck, solange
  `getTeamSize() < TRUPP_ZIEL = 6`, und steht VOR Operationen/Vertraegen);
  `:4067-4072` (`setTeamSize(B, name, alleMann)` bei JEDER Black Op);
  `:2187-2188` (`blackOpChance` liest `getTeamSize(B, name)` = teamCount DIESER Op).
- **Spiel:** `Bladeburner/Actions/TeamCasualties.ts:29-62` (Black Op: mindestens 1
  Toter auch bei Erfolg, `BlackOperation.ts:63`; Erfolg 1..ceil(n/2), Fehlschlag
  1..n); `data/GeneralActions.ts:22-31` (Dauer `max(10, 300 - (cha^0,81 + cha/90))`,
  Chance `cha^0,45/(team - sleeves + 1)`); `Actions/Operation.ts:96-98` (Bonus
  `(teamCount+1)^0,05` = 1,1022 bei 6).
- **Was falsch ist:**
  1. `blackOpChance` wird VOR `setTeamSize` gerechnet. Fuer jede neue Black Op
     steht teamCount auf 0 - der Trupp geht in die Feuerentscheidung nie ein.
     Vor dem Endspiel feuert der Bot also bei p_ohneTrupp >= 0,90, der Trupp macht
     daraus nur 0,99. Nach der eigenen Praemisse (vor 400k ist der Rang der
     Engpass, Warten kostet nichts, blade.js:418-436) ist das wertlos.
  2. Der Trupp wird auch geschickt, wenn die Chance ohne ihn schon 1,000 ist -
     jeder Einsatz toetet 1..3 Mann, die danach wieder rekrutiert werden.
  3. Die Rekrutierung laeuft ueber den Spieler, obwohl Sleeves sie koennen
     (`PersonObjects/Sleeve/Sleeve.ts:505-511`, Recruitment ist eine erlaubte
     Sleeve-Aktion; Erfolg geht auf `this.teamSize`, `Bladeburner.ts:1159-1162`).
- **Folge, gemessen** (`fenster.js` ueber das Aktionsprotokoll):

      Op-Phase BN10 31.08. 14:54-18:34   183,8 min protokolliert
        Assassination          89,1 min  48,5 %   1.412 Rang/min
        General/Recruitment    64,3 min  35,0 %      43 Rang/min (nur Sleeves)
      Endspiel BN10 01.09. 03:22-03:47    25,8 min
        Assassination          10,6 min  41,0 %
        General/Recruitment    10,4 min  40,4 %       0 Rang/min

  Im Endspiel standen 6 der 7 letzten Black Ops beim ersten Blick auf
  **Chance 1,000 gerechnet** (Morpheus, Ion Storm, Annihilus, Ultron,
  Vindictus, Daedalus) - der Trupp hat dort nichts gekauft, aber jeweils 1-3
  Mann gekostet (Log: danach "Trupp auffuellen (4/6)", (5/6), (3/6) ...).
  Rechnung (`trupp.js`, geeicht: cha 264 -> 206 s, cha^0,45 = 12,29 wie
  blade.js:2670): Auffuellen 4 -> 6 kostet bei Charisma 309 **6,4 min**, bei
  Charisma 4 (nach einem Einbau) **29,2 min**, bei Charisma 1 **54,8 min** - je
  Black Op, mal 21. In der Op-Phase oben: 64,3 min x 1.412 Rang/min = **~90.800
  Rang**, bzw. bis zu 35 % kuerzere Op-Phase; im Endspiel bis zu 40 % kuerzer.
  Nutzen dagegen: Endspiel-Schwelle 0,45 -> Truppbonus spart 1 - 1/1,1022 = 9 %
  der Versuche, bei Daedalus (553 s) ~110 s je Op - weniger als eine einzige
  Nachrekrutierung.
- **Konfidenz:** belegt (Code + Protokoll + Formel).
- **Fix:** Spieler rekrutiert nie (TRUPP_ZIEL fuer den Spieler 0); `setTeamSize(B, name, 0)`,
  wenn `blackOpChance` ohne Trupp die Schwelle schon traegt, sonst Trupp setzen
  und die Chance MIT Trupp pruefen. Wenn ueberhaupt Trupp, dann ein Sleeve auf
  "Recruitment".

---

## 2. Die Erfolgsspanne ist kein Konfidenzintervall - die wahre Chance JEDER Aktion ist aus dem API-Paar exakt rueckrechenbar

- **Bot:** Entscheidet ueberall an `spanne().min` (`src/blade.js:828-834`):
  Filter in `beste()` `:2747-2748`, Ertrag `:3023`, Gym-Zweig `lohntSich`
  `:3584-3675`, Field-Analysis-Regel `:3373-3389` (+ 45-min-Deckel `:3438`),
  `klemmFaktor` `:1336,1341`, SR-Tauglichkeit `:2575`, Assassination-Aufbau
  `:2645`, `schaetzNot`/Datamancer `:1039-1070, 1211-1226`. Leitsatz im Kopf
  `:23-27`: "wer mit ihrer Mitte plant, plant mit einer Zahl, die das Spiel nie
  zugesagt hat".
- **Spiel:** `Bladeburner/Actions/Action.ts:144-167` ist deterministisch:
  `low = real - |real-est|`, `high = real + |real-est|`, dann mit
  `r = pop/popEst` entweder `low *= r` (r < 1) oder `high *= r` (r >= 1).
  Black Ops haben Bevoelkerungsfaktor 1 (`Actions/BlackOperation.ts:55-61`),
  also `est = real` und ihr Paar ist `[real*r, real]` bzw. `[real, real*r]`.
  `real` einer Black Op rechnet der Bot bereits exakt (`blackOpChance`,
  `:2171-2214`; gegen BlackOperations.ts alle 21 geprueft, siehe unten).
- **Was falsch ist:** Die Praemisse. Aus dem Paar der naechsten Black Op und
  `blackOpChance` folgt `r` exakt (`r = low/real` bzw. `high/real`). Mit `r`
  ist fuer jeden Vertrag/jede Operation derselben Stadt die wahre Chance
  geschlossen bestimmbar:
  `x = (low/r + high)/2` fuer r < 1 (wenn low > 0), `x = (high/r + low)/2`
  fuer r > 1 (wenn high < 1); sonst ist `low` eine gueltige Untergrenze.
  `switchCity` ist ein reines Feldsetzen (`NetscriptFunctions/Bladeburner.ts:314-319`)
  - Proben in allen sechs Staedten liefern `pop = r*popEst` je Stadt ohne
  jede Field Analysis.
- **Beleg:** `spanne2.js` baut `getSuccessRange` nach und prueft 200.000
  Zufallsfaelle (pop 0,1-1,5e9, popEst 0,3-1,8 x pop, beliebige Chancen):
  **171.482 Faelle, 0 Fehler > 1e-9**, 14 % unbestimmt (nur wenn die
  Black-Op-Obergrenze bei r > 1 auf 1 klemmt - dann ist `low` = est aber
  ohnehin kein Einbruch). Der schaedliche Fall r < 1 (s.min faellt gegen 0) ist
  **immer** aufloesbar, solange eine Black Op offen ist. Der Bot hat es am
  27.08. selbst gemessen (blade.js:1868-1871: min 0,2955 / max 0,3064 /
  gerechnet 0,3064 -> r = 0,9644) und nur fuer Black Ops genutzt.
- **Folge (aus den eigenen Aufzeichnungen):** 28.08. 07:52-09:42 **110 min**
  ohne fahrbare Aktion nach Stadtwechsel, konservativ 45 min Field Analysis =
  **10.170 Rang** (blade.js:212-217); "87 Minuten nichts verdient"
  (`:1054-1059`); 16 min Field Analysis fuer 4 Rang (`:3356-3360`); offener
  BAUSTELLEN-Punkt 11.09.: drei Staedte gesperrt bei s.min 0,113/0,253 trotz
  Chaosfaktor 1. Dazu dauerhaft: Operationen mit wahrer Chance >= 0,85 fallen
  durch den Filter (Beispiel `spanne_entschluesseln.js`: pop 1,2e9 / popEst
  1,6e9, wahr 0,80 -> s.min 0,466; wahr 0,95 -> s.min 0,675), der Gym-Zweig
  nimmt die Figur, obwohl gearbeitet werden koennte, und `klemmFaktor` liest
  eine Black Op mit wahr 1,0 als "hat Luft", wenn r < 1.
- **Konfidenz:** belegt (Mechanik geeicht, 0 Fehler); die Zeitfolge ist aus den
  Bot-eigenen Protokollen, fuer V2-Knoten nicht neu gemessen.
- **Fix:** Eine Funktion `wahreChance(typ, name)`: je Runde `r` aus
  `spanne(B, naechsteBO)` und `blackOpChance` bestimmen, dann obige Formel;
  alle `s.min`-Stellen darauf umstellen. Stadtwahl per Probewechsel mit
  demselben `r` (loest auch die BAUSTELLEN-Verbesserung "Stadtwahl nach
  Proben"). Datamancer und die Field-Analysis-Regel werden damit fast tot.

---

## 3. Reaper und Evasive System werden um Faktor 1,6-2,3 unterbewertet: additiv statt multiplikativ, und ihre Zeit- und Ausdauerwirkung fehlt ganz

- **Bot:** `relNutzen` `src/blade.js:1019-1037`: `b = 1 + 0,02*Reaper + 0,04*Evasive`
  (additiv), nur der Kampfanteil der competence, keine Wirkung auf die Dauer.
  `blackOpChance` `:2176-2182` rechnet dagegen richtig multiplikativ.
- **Spiel:** `Bladeburner.ts:774-784` - jede Faehigkeit multipliziert
  (`skillMultipliers[name] = getSkillMult(name) * (1 + base*lvl/100)`), EffDex =
  (1+0,02R)(1+0,04E). `Actions/Action.ts:105-122`: `getActionTime` teilt durch
  `statFac(effAgi, effDex)`; `Bladeburner.ts:1317-1335`: effAgi steckt in
  maxStamina (^0,8) und Regeneration (^0,17).
- **Was falsch ist:** Bei R 90 / E 93 ist der wahre Dex/Agi-Faktor 2,80 x 4,72
  = 13,22, der Bot rechnet 6,52 - jede weitere Stufe erscheint ihm nur halb so
  gross. Dazu verkuerzt jede Stufe alle Aktionen (Black Ops eingeschlossen).
- **Folge, gerechnet** (`skillwert.js`, `zeitfaktor.js`; Eichung der Kosten:
  Hyperdrive St. 219 -> 549, DO St. 43 -> 92, BI St. 65 -> 140 wie in blade.js;
  Stand BN6 28.08. 16:08 laut ERLEDIGT.md:3843, Kampfwerte str 387, dex/agi
  angenommen 450/420):

      je Punkt (competence Daedalus)   wahr        Bot
      Blade's Intuition  (211 P.)      3,58e-3     3,58e-3
      Digital Observer   (220 P.)      3,52e-3     3,52e-3
      Reaper             (191 P.)      2,95e-3     1,82e-3
      Evasive System     (197 P.)      2,68e-3     1,70e-3
      + Dauer: Evasive +1 = -0,270 %, Reaper +1 = -0,228 % auf JEDE Aktion

  Mit Dauerwirkung liegt Evasive bei ~4,06e-3 je Punkt und **vor** Blade's
  Intuition; der Bot sortiert es auf den letzten Platz. Gieriger Ausbau bis
  Daedalus 0,90: wahre Sortierung 109.479 SP, Bot-Sortierung 114.714 SP -
  **+5.235 SP = 15.705 Rang (+4,8 %)**, ohne die entgangene Zeitverkuerzung.
- **Konfidenz:** belegt (Formel); die Hoehe haengt an den angenommenen
  Kampfwerten (Absolutwert p = 0,143 statt gemessener 0,35 wegen fehlender
  Aug-/Truppfaktoren - die Rangfolge der vier aendert sich dadurch nicht, weil
  alle Chancefaktoren multiplikativ gleich wirken).
- **Fix:** `relNutzen` fuer Reaper/Evasive ueber `blackOpChance` mit
  Stufe+1 rechnen (wie das Spiel, produktweise) und `ln(statFac_neu/statFac_alt)`
  als Zeitgewinn addieren - in derselben Einheit wie Overclock (`1/(99-L)`).

---

## 4. SICHER_OPERATION 0,85 ist eine feste Zahl fuer eine Geld-gegen-Rang-Abwaegung - in der langen Vorphase bleiben Operationen fast ganz aus

- **Bot:** `src/blade.js:361` und Filter `:2748`; der fruehere Raid-Sonderzweig
  (Messung 26.08.: Raid 4,86 gegen Tracking 1,20 Rang/min, `:3046-3049`) ist
  seit 28.08. gestrichen (`:3131-3184`); der Notvertrag-Zweig `:3233` kennt nur
  Vertraege.
- **Spiel:** Fehlschlagskosten einer Operation sind `rankLoss*rewardFac^(L-1)`
  (`Formulas.ts:30-44`) und Schaden `hpLoss*diffMult` (`Bladeburner.ts:981-988`);
  der Schaden kostet ueber `hospitalize` NUR Geld,
  `min(Geld*0,1, (hpMax-hpNachher)*100.000)` (`Hospital/Hospital.ts`,
  `PlayerObjectGeneralMethods.ts:281-290`), keine Zeit - und blade.js ruft
  `hospitalize` ohnehin selbst (`:3920-3927`).
- **Was falsch ist:** Die Begruendung der 0,85 (ERLEDIGT.md 28.08. 06:47:
  "Jeder Fehlschlag bedeutet Krankenhaus") behandelt das Krankenhaus wie eine
  Sperre; es ist ein Geldposten. Ob eine Op mit p = 0,3 besser ist als Tracking,
  haengt am Guthaben, nicht an einer festen Chance.
- **Folge:** Vorphase 30.08./03.09./04.09. im Protokoll: fast nur
  Tracking/Retirement + Kammer, **4,3 Rang/min** (04.09.: 3.766 Rang in 870 min),
  Operationen 0,2 %. Beispiel mit den Bot-eigenen Zahlen: Assassination Stufe 20,
  p 0,23, 31 s: EV `0,23*531 - 0,77*48 = 85` Rang je Lauf = 164 Rang/min;
  Kosten 0,77 x 8,8 Mio (88 HP Schaden bei hpMax 27) = 13 Mio/min. Bei
  Guthaben im Milliardenbereich ist das trivial, direkt nach einem Einbau
  (Geld 1.000 $, `PlayerObjectGeneralMethods.ts:102`) nicht.
- **Konfidenz:** plausibel (Mechanik belegt; der Wert von Geld gegen Rang ist
  nicht gemessen).
- **Fix:** Operationen nach `EV_Rang/min` gegen den besten Vertrag vergleichen,
  mit Krankenhauskosten als Abzug, sobald `Geld*0,1*Fehlschlagrate` unter einer
  Schwelle (z. B. 2 % des Guthabens je Stunde) liegt; die feste 0,85 nur bei
  knapper Kasse.

---

## 5. Sleeves fahren im Op-Betrieb Vertraege, obwohl der Engpass der Vorrat der besten Operation sein kann

- **Bot:** `src/sleeve.js:267-344` - Infiltrate nur, wenn KEIN Vertrag >= 2
  offen ist oder aufgeraeumt wird. In der Op-Phase faehrt der Spieler keine
  Vertraege, ihr Vorrat waechst, also infiltriert nie jemand.
- **Spiel:** `Bladeburner.ts:1251-1263`: jede Infiltrate-Vollendung legt
  `k^-0,5/2` auf JEDE Operation (k Sleeves: sqrt(k)/2 je 61 s, 3 Sleeves =
  0,87/min). Natuerliches Wachstum Assassination `getRandomIntInclusive(1,20)/10`
  je 480 s (`data/Operations.ts`, Mittel 1,05) = **7,9/h**.
- **Folge:** Der Spieler verbraucht in der Op-Phase 2,7-3,3 Assassinations/min
  (1.412 Rang/min bei 424-530 Rang je Lauf auf Stufe 20, BN10 bzw. BN6) = 160-200/h gegen 7,9/h Nachwuchs; der
  Vorrat stammt aus den Tagen der Vorphase. Ist er leer, faellt der Bot auf
  Undercover (01.09. 04:05, direkt nach dem letzten Assassination-Lauf).
  3 Sleeves auf Infiltrate = 52 Assassinations/h, also bis zu ~370-460 Rang/min,
  gegen 43 Rang/min, die alle Sleeves zusammen mit Vertraegen lieferten
  (gemessen waehrend der Recruitment-Abschnitte 31.08.).
- **Konfidenz:** plausibel (Mechanik belegt; ob der Vorrat in den kommenden
  V2-Knoten bindet, haengt an der Laenge der Vorphase - nicht gemessen).
- **Fix:** In sleeve.js auf Infiltrate umschalten, sobald
  `getActionCountRemaining(O, "Assassination")` unter z. B. 2 h Spielerverbrauch
  faellt (blade.json kann den Verbrauch melden). Diplomacy per Sleeve
  (`Sleeve.ts:512-518`, wirkt auf die aktuelle Division-Stadt) ist der
  Nebengewinn: 3 Sleeves ~3 %/min Chaossenkung, der Spieler muesste nie mehr
  aufraeumen (SR-Chaos war 31.08. 3,7 % der Zeit).

---

## 6. Weiterhin offen und durch neue Daten bestaetigt: Regenerationskammer im Ausdauerband

- **Bot:** `src/blade.js:1845-1847`, Hysterese `:3931-3941`.
- **Spiel:** `Bladeburner.ts:1197-1202` (Kammer +1 % maxStamina je 60 s, sonst
  nichts), passive Regeneration laeuft bei jeder Aktion (`:1380-1383`).
- **Folge:** BAUSTELLEN.md 30.08. 12:55 (Field Analysis statt Kammer) ist
  unerledigt. Protokoll: Kammer **55,5 %** (30.08.), **62,6 %** (03.09.),
  **56,5 %** (04.09.) der Vorphasenzeit. Keine neue Rechnung, nur: der Punkt
  ist nicht erledigt und traegt die langsamste Phase des Knotens.
- **Konfidenz:** belegt (Anteile); Hebelhoehe siehe BAUSTELLEN.
- **Fix:** wie dort beschrieben.

---

## 7. kampfaugs.js: Kampf-Levelfaktor des Knotens hart auf "BN10 -> 0,4, sonst 1"

- **Bot:** `src/kampfaugs.js:232-236` (`KNOTENFAKTOR = knoten === 10 ? 0.4 : 1`).
- **Spiel:** `BitNode/BitNode.tsx`: Kampf-LevelMultiplier BN9 0,45 (:798-801),
  BN13 0,7 (:994-997), BN14 0,5 (:1056-1059), BN15 0,7 (:1090-1093).
- **Folge:** `expNoetig(1)` fuer Kampfwert 100 in BN14: richtig
  `e^((100/0,5+200)/32) - 534,6 = 267.800`, gerechnet 11.255 - **Faktor 23,8**
  zu optimistisch; die "EINBAU LOHNT"-Meldung ist in BN13/14/15 falsch.
  Geringe Wirkung, weil das Werkzeug nur von Hand laeuft und den Einbau nicht
  ausloest. Verstoss gegen ENTSCHIEDEN "nie eine Knotennummer im Code".
- **Konfidenz:** belegt.
- **Fix:** `ns.getBitNodeMultipliers()[stat+"LevelMultiplier"]` wie in blade.js:773.

---

## Geprueft, in Ordnung

- **BLACKOP_DATEN und BLACKOP_EINSATZ** (`blade.js:1894-2082`) gegen
  `data/BlackOperations.ts`: alle 21 Eintraege, baseDifficulty, 7 Gewichte, 7
  Decays, isKill/isStealth, rankGain/rankLoss - **exakt** (`bo_compare.js`).
  Summe rankGain 113.660, rankLoss 42.075 bestaetigt.
- **blackOpChance** gegen `Action.ts:169-196`: Intelligenzbonus
  `1 + 0,75*int^0,8/600` (`formulas/intelligence.ts`), Ausdauerstrafe,
  Truppbonus, Skill-Multiplikatoren multiplikativ je Faehigkeit, Aug-Mult,
  Pop/Chaos = 1 - korrekt.
- **rankLoss ohne BladeburnerRank** (`Formulas.ts:30-44`) in `stern` und
  `RANG_JE_FEHLSCHLAG` richtig beruecksichtigt; Field Analysis
  `0,1*BladeburnerRank` kuerzt sich gegen die Vertragswerte korrekt.
- **autoLevel:** `rewardFac/difficultyFac^2 > 1` fuer alle 9 Aktionen
  (1,0006 Tracking bis 1,0146 Assassination), auch je Ausdauerpunkt
  (Tracking 1,015/Stufe) - hoechste Stufe richtig, Befund ERLEDIGT 28.08. haelt.
- **Skillkosten** ueber `getSkillUpgradeCost` enthalten `BladeburnerSkillCost`
  (`Skill.ts:76-80`); Overclock-Deckel 90 = `maxLvl`; Kaufschleife mit Sparen
  ist greedy nach Wert/Preis.
- **Knotenfaktoren** der V2-Knoten (BladeburnerRank/SkillCost): BN2, 3, 6, 11
  je 1/1; BN7 0,6/2; BN14 0,6/2; BN13 0,45/2; BN15 0,2/3 - keiner 0, die
  Division ist ueberall erreichbar (`NetscriptFunctions/Bladeburner.ts:330-362`,
  SF6 vorhanden). blade.js liest `getBitNodeMultipliers` (`:773`).
- **Chaos:** Stufe bei 50 (`Action.ts:94-103`), Incite sequenziell
  (`Bladeburner.ts:1229-1233`), SR- und Raid-Chaos ausserhalb der
  Erfolgspruefung (`:844, :853`) - Code und Riegel (8 / 47 / 50) stimmen.
- **Beitritt:** 100 in allen vier Kampfwerten, bbtrain trainiert den
  niedrigsten im Powerhouse; Reihenfolge ist fuer die Gesamtzeit egal (eine
  Arbeit zur Zeit), Graft- und Geldriegel vorhanden.
- **Endspiel-Zeitpunkt Daedalus:** In BN10 feuerte Daedalus beim ersten Blick
  (Rang 400.163, Chance 1,000). Kein Verzug.
- **Ausdauerabzug vor dem Wurf** (`Bladeburner.ts:921/928, 1019/1026`): der
  letzte Lauf vor der Ruhe wuerfelt bei ~49 % (Tracking Stufe 24, max 45:
  Strafe 0,983 auf einen von drei Laeufen, ~0,6 %); bei Black Ops deckt die
  Regeneration waehrend der langen Dauer den Abzug. Vernachlaessigbar.
- **Sleeves in der Regenerationskammer** fuellen die SPIELER-Ausdauer
  (`Bladeburner.ts:1200-1202` ohne `isPlayer`-Riegel) - geprueft und
  verworfen: in der Vorphase bringt ein Kontrakt-Sleeve ~0,85 Rang/min, die
  Kammer ueber mehr Spielerarbeit nur ~0,3; in der Op-Phase bindet die Ausdauer
  nicht (Protokoll 31.08.: 2.201 -> 9.232 steigend).
- **Black-Op-Abbruch mitten im Lauf:** kein realistischer Pfad (Chance steigt
  waehrend des Laufs nur; Ausdauer faellt erst beim Abschluss).
- **Hyperdrive-Bewertung** (Bestand statt Zufluss): in der Op-Phase waechst
  die Erfahrung so schnell, dass die Naeherung traegt; kein Befund.
