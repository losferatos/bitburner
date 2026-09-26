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

export async function main(ns) {
  ns.disableLog("ALL");
  const s = ns.singularity;
  const ZIEL = Number(ns.args[0] || 80);
  const FRIST_MS = 45 * 60 * 1000;
  const start = Date.now();
  const z = [];
  let figSeq = null;
  let figGrundLetzt = null;

  const sag = (t) => {
    z.push(`${new Date().toTimeString().slice(0, 8)} ${t}`);
    ns.write("data/joinrun.txt", z.join("\n"), "w");
    if (ns.getHostname() !== "home") ns.scp("data/joinrun.txt", "home", ns.getHostname());
  };

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

    sag(`Start. Werte ${JSON.stringify(werte())}, Ziel ${ZIEL}, Stadt ${ns.getPlayer().city}`);

    // Sector-12 hat mit "Powerhouse Gym" das beste Studio. Von Aevum aus ist
    // die Reise billig, und Sector-12 ist ohnehin schon Heimatfaktion.
    if (ns.getPlayer().city !== "Sector-12") {
      if (s.travelToCity("Sector-12")) sag("Nach Sector-12 gereist.");
      else sag("Reise nach Sector-12 fehlgeschlagen.");
    }

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
      if (!offen.length) { sag(`Alle Kampfwerte >= ${ZIEL}: ${JSON.stringify(w)}`); break; }
      const naechst = offen.sort((a, b) => w[a.feld] - w[b.feld])[0];
      const arbeit = s.getCurrentWork();
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
      const trainiertSchon = arbeit && arbeit.type === "CLASS";
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
        figBeantrage(ns, "joinrun.js", FIG_PRIO.gym, "gym",
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
        if (!s.gymWorkout("Powerhouse Gym", naechst.kurz, true)) sag(`gymWorkout(${naechst.kurz}) abgelehnt.`);
        else sag(`Training ${naechst.feld} (${w[naechst.feld]} von ${ZIEL}).`);
      }
      await ns.sleep(15000);
    }

    const w = werte();
    sag(`Training beendet: ${JSON.stringify(w)}`);

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
