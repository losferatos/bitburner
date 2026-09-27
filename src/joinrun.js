/**
 * Mitgliedschaften beschaffen - der eigentliche Engpass der 30er-Schwelle.
 *
 * 48 Augmentierungen liegen unter 25.000 Rep, aber fast alle bei Faktionen,
 * in denen der Bot nicht ist. Karma (-277) und Geld (92 Mrd) reichen laengst;
 * was fehlt, sind Kampfwerte und der richtige Aufenthaltsort.
 *
 *   Slum Snakes : Karma -9,  alle Kampfwerte 30
 *   Tetrads     : Karma -18, alle Kampfwerte 75, Stadt Chongqing/NewTokyo/Ishima
 *   Tian Di Hui : Geld 1m, Hacking 50, dieselben drei Staedte
 *
 * Ein Trainingslauf auf 80 deckt beide Kampfschwellen ab, eine Reise nach
 * Ishima beide Stadtbedingungen. Tetrads bringt dabei den Power Recirculation
 * Core (x1,05), der im Abschlussplan als fehlender Sockelposten steht.
 *
 * Der Lauf pausiert die Faktionsarbeit - das ist der Preis. Er bringt dafuer
 * drei Mitgliedschaften mit zusammen fuenf Augmentierungen unter 22.500 Rep.
 *
 * Aufruf: node tools/task.js joinrun.js [zielwert]
 *
 * @param {NS} ns
 */
import { beantrage as figBeantrage, darf as figDarf } from "lib/figurns.js";
import { PRIO as FIG_PRIO } from "lib/figur.js";

/** Dieselbe Marke, die bn4life.js vor dem Start von joinrun.js prueft. */
const BEITRITT_MARKE = "data/beitritt-erledigt.txt";

export async function main(ns) {
  ns.disableLog("ALL");
  const s = ns.singularity;
  const ZIEL = Number(ns.args[0] || 80);
  const FRIST_MS = 45 * 60 * 1000;
  // KEIN HAEMMERN MEHR (27.09.2026, Audit G2): laengstens alle 2 min erneut
  // versuchen, statt stur alle 15 s. Beleg aus der Sicherung von heute
  // (Backup 11:08, data/joinrun.txt): 10:08:39 bis 10:29:24, 84 mal
  // "gymWorkout(dex) abgelehnt." im 15-Sekunden-Takt (21 Minuten), waehrend
  // die Figur-Vergabe laut Protokoll die ganze Zeit bei joinrun.js lag.
  const RUECKZUG_DECKEL_MS = 2 * 60 * 1000;
  const start = Date.now();
  const z = [];
  let figSeq = null;
  let figGrundLetzt = null;
  // Laeuft der Kurs, den joinrun selbst gestartet hat? Nur dann wird der
  // Figur-Antrag waehrend des Trainings erneuert (Begruendung in der Schleife).
  let eigenesTraining = false;
  // Aufeinanderfolgende Ablehnungen (Reise oder gymWorkout) TROTZ gehaltener
  // Lease - siehe RUECKZUG_DECKEL_MS.
  let ablehnungenInFolge = 0;

  const sag = (t) => {
    z.push(`${new Date().toTimeString().slice(0, 8)} ${t}`);
    ns.write("data/joinrun.txt", z.join("\n"), "w");
    if (ns.getHostname() !== "home") ns.scp("data/joinrun.txt", "home", ns.getHostname());
  };

  // DIE DAEDALUS-SCHWELLE LEBT HIER, NICHT IN bn4life.js (26.09.2026,
  // Skeptiker-Rework nach Paket C.2).
  //
  // Der erste Durchgang hatte den Blick in bn4life.js gebaut - einem
  // Dauerlaeufer, der direkt nach jedem Einbau auf einem knappen home steht
  // (der Skeptiker mass dort +4 GB fuer getBitNodeMultipliers und +5 GB fuer
  // getOwnedAugmentations). joinrun.js zahlt die Singularity-Familie ohnehin
  // (293+ GB bei SF4.1) und laeuft nur kurz - hier kostet derselbe Blick
  // nichts, das ins Gewicht faellt.
  //
  // ownedAugs STATT getOwnedAugmentations: `ns.getResetInfo().ownedAugs` ist
  // eine Map ueber `Player.augmentations` (NetscriptFunctions.ts:1444), also
  // die INSTALLIERTEN Stuecke, dedupliziert nach Namen - NeuroFlux Governor
  // erhoeht bei jeder weiteren Installation nur sein `level`-Feld statt einen
  // zweiten Eintrag anzulegen (`AugmentationHelpers.ts` applyAugmentation:
  // "ownedNfg.level = aug.level; return" statt push). `.size` ist damit
  // exakt `p.augmentations.length` - und GENAU DAS liest
  // `FactionJoinCondition.ts:116-130` (haveAugmentations) fuer die
  // Daedalus-Bedingung (`p.augmentations.length >= n`). Verifiziert: die
  // beiden Zaehlweisen sind aequivalent. `getResetInfo` kostet 1 GB
  // (RamCostConstants) statt der Singularity-Familie - deutlich billiger als
  // `getOwnedAugmentations`.
  //
  // `getBitNodeMultipliers()` braucht SF5 ODER BitNode 5 - NetscriptFunctions
  // .ts wirft dort woertlich "Requires Source-File 5 to run.". NICHT
  // Formulas.exe: das ist ein anderer Schalter (ns.formulas.*) und hat mit
  // dieser Funktion nichts zu tun - eine fruehere Fassung dieses Kommentars
  // nannte das faelschlich. Ohne SF5/BN5 bleibt die Schwelle unbekannt, und
  // dann wird NICHT blockiert - die alte, unkritische Seite.
  let daedalusOffen = true;
  try {
    const installiert = ns.getResetInfo().ownedAugs.size;
    const schwelle = Number(ns.getBitNodeMultipliers().DaedalusAugsRequirement);
    if (Number.isFinite(schwelle)) daedalusOffen = installiert < schwelle;
  } catch { /* kein SF5/BN5 - dann nicht blockieren */ }

  try {
    // Die Bremse fuer bn4life setzen, sonst schiebt es Verbrechen dazwischen
    // und das Training bricht jede Sekunde ab. Gleiches Muster wie in
    // bn4rep.js, dort steht die Begruendung ausfuehrlich.
    const bremse = () => {
      ns.write("data/rep-modus.txt", "JOINRUN|" + Date.now(), "w");
      if (ns.getHostname() !== "home") ns.scp("data/rep-modus.txt", "home", ns.getHostname());
    };

    const werte = () => {
      const k = ns.getPlayer().skills;
      return { strength: k.strength, defense: k.defense, dexterity: k.dexterity, agility: k.agility };
    };

    sag(`Start. Werte ${JSON.stringify(werte())}, Ziel ${ZIEL}, Stadt ${ns.getPlayer().city}`
      + (daedalusOffen ? "" : " - Daedalus-Schwelle erreicht, kein Training noetig."));

    // DAS TRAINING LAEUFT NUR, SOLANGE DAEDALUS ES NOCH BRAUCHT. Die
    // Einladungspruefung und der Beitritt weiter unten laufen dagegen IMMER -
    // sie kosten nur Singularity-Sekunden, keine Figurenzeit, und bringen
    // eigene Augmentierungen (Power Recirculation Core aus Tetrads), die mit
    // Daedalus nichts zu tun haben. Ein Vollausstieg hier haette sie
    // mitgerissen (Skeptiker-Fund).
    if (daedalusOffen) {
      // DIE STADT WIRD JETZT UNTER DER LEASE NACHGEZOGEN, NICHT MEHR HIER
      // EINMALIG (27.09.2026, Audit G2/6#4).
      //
      // Hier stand die Reise nur an dieser Stelle, vor der Schleife. Zieht
      // bn4life.js die Figur spaeter nach Aevum (Abschnitt "1b" dort, ohne
      // Lease-Pruefung - Reisen laeuft dort bewusst ausserhalb der
      // Figur-Wache), driftet joinrun.js mit ab und holt die Reise nie nach.
      // Beleg aus der Sicherung von heute (Backup 11:08, data/joinrun.txt):
      // 10:08:39 bis 10:29:24, 84 mal "gymWorkout(dex) abgelehnt." im
      // 15-Sekunden-Takt (21 Minuten), OHNE ein weiteres "Figur nicht frei"
      // dazwischen - die Lease lag laut Protokoll die ganze Zeit bei
      // joinrun.js. `gymWorkout` prueft die Stadt VOR jeder Wirkung
      // (Singularity.ts:302-336: bei falscher Stadt nur ein Log und
      // `return false`, `Player.currentWork` bleibt unberuehrt) - lehnte
      // hier also 21 Minuten denselben Aufruf ab, ohne dass etwas die Stadt
      // korrigiert haette. Jetzt steht die Reise weiter unten, direkt vor dem
      // Trainingsstart, unter der bereits gehaltenen Lease.

      // gymWorkout erwartet die Kurzform ("str"/"def"/"dex"/"agi"), der
      // Spielerdatensatz nennt die Werte ausgeschrieben. Deshalb beides.
      const REIHE = [
        { feld: "strength", kurz: "str" },
        { feld: "defense", kurz: "def" },
        { feld: "dexterity", kurz: "dex" },
        { feld: "agility", kurz: "agi" },
      ];
      while (Date.now() - start < FRIST_MS) {
        bremse();
        const w = werte();
        const offen = REIHE.filter((k) => w[k.feld] < ZIEL);
        const arbeit = s.getCurrentWork();
        const trainiertSchonVorab = arbeit && arbeit.type === "CLASS";

        // UEBERSCHIESSEN AKTIV STOPPEN (27.09.2026, Audit G-Ueberschiessen).
        //
        // Hier fehlte der aktive Stopp: die Schleife hat nur `offen.length`
        // beim naechsten Durchlauf geprueft, aber `gymWorkout` laeuft im
        // Spiel WEITER, bis etwas anderes die Figur uebernimmt -
        // `Player.currentWork` ist an kein Skript gebunden und ueberlebt
        // sogar das Ende von joinrun.js selbst. Belegt an der Sicherung von
        // heute (08:08/09:08/11:08-Backups): ein Lauf trainierte 45 Minuten
        // reine Staerke (1 -> 199 statt Ziel 80), waehrend Verteidigung bei 1
        // stehen blieb - `naechst` wechselt nie, solange `trainiertSchon`
        // true bleibt, und nichts hat das eigene Training je aktiv beendet.
        // Ein spaeterer Lauf trieb Verteidigung ebenso auf 166-197. Jetzt
        // wird das EIGENE Training aktiv gestoppt, sobald sein Wert das Ziel
        // erreicht hat - der naechste Durchlauf (ohne Wartezeit) entscheidet
        // dann ueber den naechsten Wert oder das Ende.
        if (eigenesTraining && trainiertSchonVorab && arbeit.classType
            && !offen.some((k) => k.kurz === arbeit.classType)) {
          s.stopAction();
          sag(`${arbeit.classType} erreicht ${ZIEL} - Kurs beendet: ${JSON.stringify(w)}.`);
          eigenesTraining = false;
          continue;
        }

        if (!offen.length) { sag(`Alle Kampfwerte >= ${ZIEL}: ${JSON.stringify(w)}`); break; }
        const naechst = offen.sort((a, b) => w[a.feld] - w[b.feld])[0];
        // ZWEI TRAINER SIND EINER ZU VIEL (25.08.2026, 22:46).
        //
        // Hier stand eine Pruefung auf GENAU diese Kurzform: Trainierte die
        // Figur gerade "agi" und joinrun wollte "str", startete es trotzdem.
        // Neben joinrun laeuft aber bbtrain.js mit derselben Aufgabe und einer
        // anderen Reihenfolge - die beiden haben sich das Training gegenseitig
        // aus der Hand geschlagen, und jeder Wechsel kostet Gym-Gebuehren.
        //
        // Gemessen am 25.08. um 22:18, kurz nach einem Einbau: Guthaben
        // -1.576.559, waehrend beide Skripte gleichzeitig im Powerhouse Gym
        // standen. Nach einem Einbau ist das Konto bei null, und Gym-Training
        // laeuft weiter, bis es ins Minus geht.
        //
        // Jetzt: Laeuft IRGENDEIN Kurs, laesst joinrun die Finger davon. Die
        // Werte steigen ohnehin - bbtrain zieht sie auf 100, joinruns Ziel ist
        // 80. Es wartet einfach, bis sie da sind.
        // (aus dem Ueberschiessen-Check oben uebernommen, `arbeit` hat sich
        // seither nicht veraendert)
        const trainiertSchon = trainiertSchonVorab;
        // DAS EIGENE TRAINING HAELT DIE FIGUR (27.09.2026, Integrationspruefung).
        //
        // Der Antrag wurde nur gestellt, solange KEIN Kurs lief. Lief das
        // eigene Training, verfiel er nach ANTRAG_TTL_MS (150 s), die Lease
        // nach LEASE_MS (15 min) - dann bekam bn4rep (faktion, 30) die Figur,
        // workForFaction beendete das Gym, und joinrun holte sie sich 15 s
        // spaeter mit 25 zurueck: Ping-Pong im 15-Minuten-Takt mit
        // Kursneustart (tools/test-joinrun-ebene2.js, Abschnitt 5). Ein
        // FREMDER Kurs (bbtrain.js, gym 40) wird bewusst nicht beantragt -
        // sonst nahme joinrun ihm die Figur weg, ohne selbst etwas zu tun.
        if (trainiertSchon && eigenesTraining) {
          figBeantrage(ns, "joinrun.js", FIG_PRIO.beitritt, "gym",
            arbeit.classType || naechst.kurz, "Kampfwerte fuer Slum Snakes/Tetrads/Tian Di Hui");
        }
        if (!trainiertSchon) eigenesTraining = false;
        // Geldboden wie in bbtrain.js (02.09.2026): unter 5 Mio kein Gym, sonst
        // zieht das Powerhouse (2.400 $/s) das Konto ins Minus - und dann kauft
        // niemand mehr Portknacker oder Rechner.
        if (!trainiertSchon && ns.getPlayer().money < 5e6) {
          sag("Konto unter 5 Mio - kein Gym, warte.");
          await ns.sleep(60000);
          continue;
        }
        if (!trainiertSchon) {
          // DIE FIGUR-WACHE (26.09.2026, Audit-Fund 3#6/6#4, Paket C.2).
          //
          // Hier stand `s.gymWorkout(...)` ohne jede Ruecksicht auf die
          // Figur-Vergabe (lib/figur.js). Der Alias `const s = ns.singularity`
          // liess den Lint in tools/test-verbote.js daran vorbei - er kannte
          // nur den woertlichen Praefix `ns.singularity.gymWorkout(`. Ein
          // laufendes Graft wird durch gymWorkout beendet und NICHT erstattet
          // (`GraftingWork.tsx:75-83`), beim Simulacrum 450 Mrd. bbtrain.js
          // (:318-320) fragt schon so, hier fehlte es ganz.
          //
          // PRIO.beitritt (25), NICHT PRIO.gym (40) - Skeptiker-Fund nach dem
          // ersten Durchgang: mit 40 verliert joinrun IMMER gegen laufende
          // Faktionsarbeit (`faktion`, 30), die bn4rep in einem V1-Knoten
          // praktisch pausenlos anfragt - joinrun ist dort der einzige
          // Gym-Trainer und haette nie trainiert. 25 gewinnt gegen 30, verliert
          // weiterhin gegen graft (10) und bladeburner (20). Begruendung der
          // Rangfolge in lib/figur.js bei PRIO.
          figBeantrage(ns, "joinrun.js", FIG_PRIO.beitritt, "gym",
            naechst.kurz, "Kampfwerte fuer Slum Snakes/Tetrads/Tian Di Hui");
          const figW = figDarf(ns, "joinrun.js", figSeq);
          if (figW.seq !== null) figSeq = figW.seq;
          if (!figW.darf) {
            if (figGrundLetzt !== figW.grund) {
              sag("Figur nicht frei: " + figW.grund + " - warte.");
              figGrundLetzt = figW.grund;
            }
            await ns.sleep(15000);
            continue;
          }
          figGrundLetzt = null;

          // STADT UNTER DER LEASE NACHZIEHEN (27.09.2026, Audit G2/6#4).
          // Begruendung oben am Schleifenanfang - frueher stand die Reise nur
          // einmal, vor der Schleife, und driftete unbemerkt weg.
          if (ns.getPlayer().city !== "Sector-12" && !s.travelToCity("Sector-12")) {
            sag("Reise nach Sector-12 fehlgeschlagen - warte.");
            ablehnungenInFolge++;
            await ns.sleep(Math.min(15000 * 2 ** ablehnungenInFolge, RUECKZUG_DECKEL_MS));
            continue;
          }

          if (!s.gymWorkout("Powerhouse Gym", naechst.kurz, true)) {
            sag(`gymWorkout(${naechst.kurz}) abgelehnt.`);
            ablehnungenInFolge++;
            await ns.sleep(Math.min(15000 * 2 ** ablehnungenInFolge, RUECKZUG_DECKEL_MS));
            continue;
          }
          ablehnungenInFolge = 0;
          eigenesTraining = true;
          sag(`Training ${naechst.feld} (${w[naechst.feld]} von ${ZIEL}).`);
        }
        await ns.sleep(15000);
      }

      // FRIST ABGELAUFEN WAEHREND NOCH TRAINIERT WURDE: eigenen Kurs beenden
      // statt ihn der Figur-Wache zu ueberlassen (27.09.2026, Audit
      // G-Ueberschiessen) - derselbe Grund wie beim aktiven Stopp oben, nur
      // fuer den Ausstieg ueber FRIST_MS statt ueber "Ziel erreicht".
      if (eigenesTraining) { s.stopAction(); eigenesTraining = false; }
      const w = werte();
      sag(`Training beendet: ${JSON.stringify(w)}`);
    } else {
      // DAEDALUS BRAUCHT DIESE AUGS NICHT MEHR (26.09.2026, Paket C.2).
      //
      // Dieselbe Marke, die bn4life.js selbst schon kennt (BEITRITT_MARKE):
      // sie traegt den Zeitpunkt des Einbaus, gegen den sie gilt. bn4life.js
      // prueft sie vor dem naechsten Start und startet joinrun.js dann nicht
      // erneut in diesem Zyklus - der Grund fuer den Start war "Faktionen
      // fehlen", nicht "Daedalus braucht noch Augs", und der bleibt bestehen,
      // aber das Training selbst ist hier zu Ende.
      sag("Installierte Augs >= DaedalusAugsRequirement - kein Training noetig.");
      try {
        const letzterEinbau = ns.getResetInfo().lastAugReset;
        ns.write(BEITRITT_MARKE, String(letzterEinbau), "w");
        if (ns.getHostname() !== "home") ns.scp(BEITRITT_MARKE, "home", ns.getHostname());
      } catch { /* Marke ist eine Optimierung, kein Muss - weiter geht es so oder so */ }
    }

    // Ishima erfuellt die Stadtbedingung fuer Tetrads UND Tian Di Hui.
    if (s.travelToCity("Ishima")) sag("Nach Ishima gereist.");

    // Auf Einladungen warten. Die Pruefung laeuft im Spiel im Sekundentakt.
    const wunsch = ["Slum Snakes", "Tetrads", "Tian Di Hui"];
    for (let i = 0; i < 40; i++) {
      const drin = ns.getPlayer().factions;
      const fehlt = wunsch.filter((f) => !drin.includes(f));
      if (!fehlt.length) break;
      for (const f of s.checkFactionInvitations()) {
        if (wunsch.includes(f) && s.joinFaction(f)) sag("BEIGETRETEN: " + f);
      }
      await ns.sleep(3000);
    }

    const drin = ns.getPlayer().factions;
    sag("Faktionen: " + drin.join(", "));
    const eigen = new Set(s.getOwnedAugmentations(true));
    let neu = 0;
    for (const f of wunsch) {
      if (!drin.includes(f)) { sag(`${f}: NICHT drin.`); continue; }
      for (const a of s.getAugmentationsFromFaction(f)) {
        if (eigen.has(a)) continue;
        neu++;
        sag(`  ${f}: ${a} | Rep ${ns.format.number(s.getAugmentationRepReq(a))}`);
      }
    }
    sag(`Neu erreichbar: ${neu} Augmentierungen.`);
  } catch (e) {
    sag("FEHLER: " + String(e && e.message ? e.message : e));
  } finally {
    // Bremse loesen, damit bn4rep die Faktionsarbeit zurueckbekommt.
    try { ns.rm("data/rep-modus.txt", "home"); } catch { /* lag nie dort */ }
  }
}
