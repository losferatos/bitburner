/**
 * Haelt die Sleeves beschaeftigt. Sonst stehen sie herum.
 *
 * WARUM (28.08.2026, 17:50)
 *
 * BitNode 10 gibt ab der ersten Sekunde einen Sleeve
 * (`SleeveCovenantPurchases.tsx:62-63`: `min(3, SF10-Level + (bitNodeN === 10
 * ? 1 : 0))`), und er startet dort brauchbar statt bei null -
 * `prestigeSourceFile` setzt in BitNode 10 `shock <= 25` und `sync >= 25`
 * (`PlayerObjectGeneralMethods.ts:150-155`). Bis heute gab es im ganzen Repo
 * kein einziges Sleeve-Skript; der Sleeve stand seit 17:05 still.
 *
 * WAS DER SPIELER DAVON HAT (`Sleeve/Work/Work.ts:17-25`)
 *
 *     Player.gainMoney(shockedStats.money)          Geld, voll
 *     applyWorkStatsExp(Player, stats, sync)        Erfahrung, mal sync/100
 *     Player.karma -= crime.karma * syncBonus       Karma, mal sync/100
 *
 * Der Sleeve ist also kein zweiter Rechner, sondern ein zweiter Koerper: Er
 * kann keine Skripte laufen lassen (das Netz hackt ohnehin ohne ihn), aber er
 * verdient Geld und Erfahrung parallel zum Spieler.
 *
 * WARUM SHOPLIFT UND NICHT MUG (`Crime/Crimes.ts:6-62`)
 *
 *     Verbrechen    Dauer     Geld    Schwierigkeit   Geld je Sekunde
 *     Shoplift      2,0 s   15.000        0,05             7.500
 *     Mug           4,0 s   36.000        0,20             9.000
 *     Rob Store    60,0 s  400.000        0,20             6.667
 *
 * Mug sieht besser aus, ist aber VIERMAL so schwer, und ein frischer Sleeve
 * hat Kampfwerte um 1. Der Bruttoertrag zaehlt nur, wenn die Aktion gelingt -
 * dieselbe Lehre wie bei den Black Ops am 25.08. Shoplift ist deshalb der
 * Einstieg; die stufenweise Auswahl nach Kampfwerten braucht
 * `ns.sleeve.getSleeve` und damit 4 GB mehr, als hier gerade frei sind.
 *
 * SPEICHER: Jede Sleeve-Funktion kostet 4 GB (`RamCostGenerator.ts:51,
 * 398-421`), und Bitburner summiert je VERSCHIEDENER Funktion. Die erste
 * Fassung benutzte drei (getNumSleeves, getTask, setToCommitCrime) und kam
 * damit auf rund 13,6 GB - **sie ist um 17:52 nicht gestartet**, weil auf home
 * nur 9,2 GB frei waren und die gerooteten Server in dieser Phase noch
 * kleiner sind.
 *
 * Deshalb bleibt genau EINE Sleeve-Funktion uebrig: `setToCommitCrime`. Das
 * kostet den Verzicht auf `getTask`, also wird das Verbrechen bei jedem Takt
 * neu gesetzt - und `setToCommitCrime` legt eine neue SleeveCrimeWork an,
 * bricht das laufende Verbrechen also ab. Bei Shoplift sind das hoechstens
 * zwei Sekunden je Takt; bei 60 s Takt sind das unter vier Prozent. Sobald
 * ein Rechner mit mehr Speicher da ist, kommt getTask zurueck.
 *
 * Aufruf:  node tools/task.js sleeve.js
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");

  // VON SHOPLIFT AUF FAKTIONSARBEIT - UND VON DORT INS GYM (28.08.2026, 20:50)
  //
  // Schritt 1 war richtig: Geld ist kein Engpass mehr (1,4 Milliarden bei 85
  // Rechnern), die Shoplifts mit 7.500 je Stueck waren es einmal.
  //
  // Schritt 2 war es nicht. Faktionsarbeit schreibt die Reputation zwar direkt
  // dem Spieler gut (`Sleeve/Work/SleeveFactionWork.ts:51`), aber **gemessen
  // 20:48 bis 20:49 waren es 3 Reputation je Minute** fuer Sector-12. Bis zu
  // den 10.000 fuer Augmented Targeting I fehlen 4.835 - das waeren 27
  // Stunden. Der Sleeve ist frisch aus dem Prestige und hat Stufe 1; seine
  // Faktionsarbeit ist deshalb fast wertlos.
  //
  // Was traegt, ist das Gym. Die Erfahrung eines Sleeves geht mit `sync/100`
  // an den Spieler (`Sleeve/Work/Work.ts:22`), in BitNode 10 mindestens 25
  // Prozent, und die Gym-Rate haengt nicht an den Stufen, sondern am Gym und
  // an den Erfahrungsmultiplikatoren. Bei gemessenen 13 Erfahrung je Sekunde
  // beim Spieler sind das rund **+3,25/s**, also gut ein Viertel mehr - Tor 1
  // faellt damit von 21,8 auf etwa 17,4 Stunden.
  // ZWEITER PARAMETER IST DER GYMNAME, NICHT DIE STADT, und die Statangabe
  // heisst "str"/"def"/"dex"/"agi" (`Work/Enums.ts:17-22`, GymType). Beides
  // um 20:53 falsch geraten - der Aufruf wurde abgelehnt und fiel still auf
  // Shoplift zurueck. Powerhouse Gym steht in Sector-12 und ist das beste.
  const GYM = "Powerhouse Gym";
  // Je Sleeve ein eigener Kontrakt: zwei Sleeves duerfen denselben nicht
  // fahren (`NetscriptFunctions/Sleeve.ts:283-293`, wirft sonst). Tracking
  // steht vorn, weil es den hoechsten Vorrat hat und stealth ist.
  const KONTRAKTE = ["Tracking", "Bounty Hunter", "Retirement"];
  const VERBRECHEN = "Shoplift";   // Rueckfall, wenn das Gym nicht geht
  const TAKT = 60000;
  // Ohne getNumSleeves (4 GB) blind bis zur Obergrenze durchzaehlen. Mehr als
  // drei kann es ohne Covenant-Kaeufe nicht geben
  // (`SleeveCovenantPurchases.tsx:62-63`), und ein Index, den es nicht gibt,
  // wirft nur.
  const MAX = 3;

  for (;;) {
    const stand = [];
    for (let i = 0; i < MAX; i++) {
      let ok = false, was = "gym";
      // NACH DEM BEITRITT FAEHRT DER SLEEVE KONTRAKTE (29.08.2026, 13:00).
      //
      // Gerechnet, nicht vermutet. `SleeveBladeburnerWork.ts:54` ruft
      // `completeAction(sleeve, actionId, false)`, und
      // `Bladeburner.ts:948-950` vergibt dabei `changeRank(person, gain)` -
      // das erhoeht `this.rank`, den SPIELER-Rang. Der Ausdauerabzug steht
      // dagegen hinter `if (isPlayer)` (`:921`): der Sleeve verbraucht
      // keine Ausdauer und arbeitet deshalb durchgehend, waehrend der
      // Spieler nach dem Beitritt nur 18 Prozent der Zeit arbeitet.
      //
      // Mit den Werten vom 29.08., 12:50 (Sleeve 72/72/69/71, Spieler
      // 91/91/91/90) und Tracking auf Stufe 1:
      //
      //     Spieler  Chance 0,445  Dauer 10,5 s  Anteil 18 %   6,6 Rang/h
      //     Sleeve   Chance 0,310  Dauer 10,6 s  Anteil 100 % 25,2 Rang/h
      //
      // Faktor 3,8 - und ein Fehlschlag kostet nichts, weil Vertraege gar
      // keinen `rankLoss` haben (`data/Contracts.ts`, kein Treffer).
      // Gedaempft wird beides von `calculateStaminaPenalty()` (`:167`),
      // das an der SPIELER-Ausdauer haengt und auch die Sleeve-Chance
      // senkt, solange sie unter der Haelfte steht.
      //
      // Faellt der Aufruf durch, bleibt es beim Gym - der Sleeve steht
      // also nie still, auch wenn der Kontrakt gerade ausverkauft ist
      // oder ein anderer Sleeve ihn schon faehrt.
      let inDivision = false;
      try { inDivision = ns.bladeburner.inBladeburner(); } catch { /* 0 GB */ }
      // ALLE DREI ARTEN DURCHPROBIEREN, NICHT NUR EINE (29.08.2026, 16:25).
      //
      // Hier stand `KONTRAKTE[i % KONTRAKTE.length]` - bei einem Sleeve also
      // immer nur `Tracking`. Ist der ausverkauft, fiel der Sleeve ins Gym,
      // und das bringt nach dem Beitritt **null Rang**.
      //
      // Ausverkauft ist der Regelfall, nicht die Ausnahme: Der Nachschub
      // betraegt 30 Stueck je Stunde und Art (`Bladeburner.ts:1387`,
      // `Constants.ts:39`, growthFunction im Mittel 4,0 geteilt durch 480 s),
      // der Verbrauch von Spieler und Sleeve zusammen rund 400.
      //
      // Die Reihenfolge ist nach gerechnetem Rang je Sekunde sortiert, mit
      // den Spielerwerten von 16:15 (str/def/dex/agi 97, hacking 163,
      // charisma 1, intelligence 94):
      //
      //     Tracking       chance 47,1 %   10,4 s   0,0135 Rang/s
      //     Retirement     chance 30,1 %   16,7 s   0,0108
      //     BountyHunter   chance 24,1 %   20,9 s   0,0104
      //
      // Der Versatz `i` bleibt drin, damit zwei Sleeves nicht auf derselben
      // Art beginnen - das Spiel verbietet das (`Sleeve.ts:282-292`).
      // ERST AB BRAUCHBAREN KAMPFWERTEN (29.08.2026, 17:45).
      //
      // Die Erfolgschance ist `min(1, competence/difficulty)` (`Action.ts:195`),
      // und competence ist bei Tracking zu 70 Prozent aus dex und agi gebaut
      // (`data/Contracts.ts:22-30`). Mit Kampfwerten um 1 liegt sie unter zwei
      // Prozent - der Sleeve wuerde die Kontrakte leerfahren, ohne Rang zu
      // bringen, und dem Spieler dabei den Vorrat wegnehmen. Im Gym baut er
      // stattdessen die Werte auf, die er fuer die Kontrakte braucht.
      //
      // Anlass war ein selbst verursachter Schaden: Ein Aug-Kauf um 17:35 hat
      // den Sleeve von 74/75/70/77 auf 14/1/1/11 zurueckgesetzt.
      // `Sleeve.ts:215-225` nullt bei **jeder** Installation saemtliche
      // Erfahrungswerte - das stand im Quellcode und wurde vor dem Kauf nicht
      // gelesen. Der Kauf-Block ist zurueckgenommen; diese Schwelle bleibt,
      // weil derselbe Zustand nach jedem Augmentierungs-Einbau des Spielers
      // ohnehin eintritt.
      const KONTRAKT_MIN_KAMPF = 40;
      let sleeveKampf = 0, sleeveSkills = null;
      if (inDivision) {
        try {
          const sk = ns.sleeve.getSleeve(i).skills;
          sleeveSkills = sk;
          sleeveKampf = Math.min(sk.strength, sk.defense, sk.dexterity, sk.agility);
        } catch { sleeveKampf = 0; }
      }
      if (inDivision && sleeveKampf >= KONTRAKT_MIN_KAMPF) {
        for (let n = 0; n < KONTRAKTE.length && !ok; n++) {
          const art = KONTRAKTE[(i + n) % KONTRAKTE.length];
          try {
            // VORRAT PRUEFEN, SONST STEHT DER SLEEVE STILL (29.08.2026, 22:30).
            //
            // `SleeveBladeburnerWork.process` bricht bei leerem Vorrat sofort
            // ab: `if (action.count < 1) return sleeve.stopWork()`
            // (`Sleeve/Work/SleeveBladeburnerWork.ts:44-47`). Der Sleeve steht
            // dann auf Idle - aber `setToBladeburnerAction` hat trotzdem
            // `true` zurueckgegeben, also setzt dieser Block im naechsten Takt
            // denselben leeren Kontrakt wieder. Endlosschleife auf Idle, und
            // die Telemetrie meldet weiter `contract:<art>`, weil sie den
            // eigenen Merker schreibt statt `getTask` (RAM-Verzicht, Dateikopf).
            //
            // Eric hat es um 22:28 im Spiel gesehen, die Zahl bestaetigt es:
            // Rang stand von 22:21 bis 22:28 unveraendert bei 65, waehrend der
            // Sleeve zu dem Zeitpunkt den GESAMTEN Rang liefern sollte.
            //
            // Die 4 GB fuer `getActionCountRemaining` sind der Preis dafuer,
            // dass die Rueckfallkette ueberhaupt greift - ohne sie bricht sie
            // beim ersten `true` ab, das nichts bedeutet.
            let vorrat = 1;
            try { vorrat = ns.bladeburner.getActionCountRemaining("Contracts", art); }
            catch { /* alte Fassung: dann wie bisher blind setzen */ }
            if (vorrat < 1) continue;
            ok = ns.sleeve.setToBladeburnerAction(i, "Take on contracts", art);
            if (ok) was = "contract:" + art;
          } catch { ok = false; }
        }
      }
      // WESSEN TIEFSTAND? DAS HAENGT AM BEITRITT (29.08.2026, 17:50).
      //
      // **Vor** dem Beitritt zaehlt der Spieler: Das Tor verlangt alle vier
      // seiner Kampfwerte ueber 100, der Sleeve traegt ueber `sync` anteilig
      // dazu bei (`Sleeve/Work/Work.ts:17-25`).
      //
      // **Nach** dem Beitritt ist das falsch. Der Spieler steht dann bei 100
      // und bewegt sich nicht mehr; wer jetzt zaehlt, ist der Sleeve - er
      // braucht Kampfwert 40, um ueberhaupt Kontrakte fahren zu duerfen
      // (`KONTRAKT_MIN_KAMPF` oben). Mit dem Spieler-Tiefstand als Wahl
      // traeniert er einen beliebigen Wert statt seines schwaechsten und
      // braucht ein Vielfaches der Zeit bis zur Schwelle.
      //
      // Akut wurde das durch den Aug-Reset von 17:35: Der Sleeve steht bei
      // 14/1/1/11 und muss vier Werte gleichzeitig hochziehen.
      if (!ok) try {
        const sk = (inDivision && sleeveSkills) ? sleeveSkills : ns.getPlayer().skills;
        const paare = [["str", sk.strength], ["def", sk.defense],
          ["dex", sk.dexterity], ["agi", sk.agility]];
        paare.sort((a, b) => a[1] - b[1]);
        was = paare[0][0];
        ok = ns.sleeve.setToGymWorkout(i, GYM, was);
      } catch { ok = false; }
      if (!ok) {
        was = VERBRECHEN;
        try { ok = ns.sleeve.setToCommitCrime(i, VERBRECHEN); }
        catch { break; }   // ab hier gibt es keinen Sleeve mehr
      }
      stand.push({ nr: i, gesetzt: ok, aufgabe: was });
    }
    ns.write("data/sleeve.json", JSON.stringify({
      zeit: Date.now(), gym: GYM, anzahl: stand.length,
      sleeves: stand,
    }), "w");
    // Der Auftragslaeufer sucht den Wirt mit dem meisten freien Speicher -
    // das ist selten home. Ohne scp findet die Datei niemand.
    if (ns.getHostname() !== "home") {
      ns.scp("data/sleeve.json", "home", ns.getHostname());
    }
    await ns.sleep(TAKT);
  }
}
