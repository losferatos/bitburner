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

// Steuer- und Lagedateien wohnen auf home; dieses Gewerk laeuft nicht
// zwingend dort. `ns.read` liest immer LOKAL - siehe lib/hostdatei.js.
import { liesVonHome } from "lib/hostdatei.js";

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
  // an den Erfahrungsmultiplikatoren. Die Rate ist die des SLEEVES (10 exp/s
  // im Powerhouse ohne Spielermultiplikatoren, `Work.ts:21`) mal sync: bei
  // sync 25 also **+2,5/s je Sleeve** - nicht 3,25, das war die Spielerrate
  // mal sync (Zahlen-Skeptiker 02.09.). Zwei Sleeves heben 12,6/s auf 17,6/s.
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

  // IN HACKINGKNOTEN KEIN GYM (02.09.2026, Skeptiker zum Ausgang-Umbau).
  //
  // ausgang.js legt data/verfahren.txt auf home ab ("V1 5 2" = Hackingweg,
  // Knoten 5, Stufe 2). In V1-Knoten (1, 5, 12, 8) tritt niemand der Division
  // bei; Kampfwerte der Sleeves sind dort wertlos, das Gym kostet trotzdem
  // 2.400 $/s je Koerper - in BitNode 8 ohne Hackgeld die Minus-Spirale vom
  // 02.09., 06:00. Dort: Verbrechen (bringt Geld), kein Gym.
  //
  // KORREKTUR 27.09.2026: "Verbrechen bringt Geld" stimmt in BitNode 8 NICHT.
  // `BitNode.tsx:769` setzt dort `CrimeMoney: 0` - ein Sleeve-Verbrechen
  // bringt in BN8 exakt null Dollar. Das Gym-Verbot bleibt richtig (es
  // KOSTET), aber der Ersatz ist seitdem Faktionsarbeit, siehe
  // "HACKINGKNOTEN: FAKTIONSARBEIT" weiter unten.
  const hackingweg = () => {
    try {
      if (!ns.fileExists("data/verfahren.txt", "home")) return false;
      if (ns.getHostname() !== "home") ns.scp("data/verfahren.txt", ns.getHostname(), "home");
      const teile = liesVonHome(ns, "data/verfahren.txt").trim().split(/\s+/);
      return Number(teile[1]) === ns.getResetInfo().currentNode
        && (teile[0] === "V1" || teile[0] === "V1b");
    } catch { return false; }
  };

  // WELCHES VERBRECHEN - GERECHNET WIE IM SPIEL (27.09.2026).
  //
  // Hier stand `sleeveMin < 40 ? "Shoplift" : "Mug"`, mit sleeveMin = Minimum
  // ALLER VIER Kampfwerte. Shoplift trainiert aber nur dex und agi
  // (`Crime/Crimes.ts`, dexterity_exp/agility_exp 2) - str und def bleiben
  // bei 1, sleeveMin also auch, und der Sleeve kommt nie aus Shoplift heraus.
  // Genau so stand es im BN5-Lauf 3: drei Sleeves mit dex/agi 102, str/def 1,
  // zwanzig Stunden Shoplift.
  //
  // Die Chance ist `successRate` (`Crime/Crime.ts:120-136`):
  //     (Summe gewicht*wert + 0,025*int) / 975 / difficulty * intBonus(int)
  // gedeckelt bei 1 (crime_success eines Sleeves ohne Augs ist 1,
  // CrimeSuccessRate in allen V1-Knoten 1). Mug wichtet str 1,5 / def 0,5 /
  // dex 1,5 / agi 0,5 bei difficulty 1/5, Shoplift dex 1 / agi 1 bei 1/20.
  // Mit dex/agi 102 und str/def 1 ist Mug SCHON SICHER (Summe 206 / 975 /
  // 0,2 = 1,06) - die alte Schwelle hat also 20 % Ertrag verschenkt (Mug
  // 36.000 je 4 s = 9.000/s gegen Shoplift 15.000 je 2 s = 7.500/s, beide mal
  // CrimeMoney). Verglichen wird der Erwartungswert je Sekunde; der
  // CrimeMoney-Faktor ist fuer beide gleich und faellt heraus.
  const besteVerbrechen = (sk) => {
    const s = sk || {};
    const w = (x) => (Number.isFinite(x) ? x : 1);
    const int = Number.isFinite(s.intelligence) ? s.intelligence : 0;
    const ib = 1 + Math.pow(int, 0.8) / 600;
    const chance = (summe, schwer) => Math.min(1, (summe + 0.025 * int) / 975 / schwer * ib);
    const shoplift = chance(w(s.dexterity) + w(s.agility), 1 / 20) * 15000 / 2;
    const mug = chance(1.5 * w(s.strength) + 0.5 * w(s.defense)
      + 1.5 * w(s.dexterity) + 0.5 * w(s.agility), 1 / 5) * 36000 / 4;
    return mug > shoplift ? "Mug" : "Shoplift";
  };

  // HACKINGKNOTEN: FAKTIONSARBEIT STATT VERBRECHEN (27.09.2026).
  //
  // GERECHNET: tools/sleeve-rechnung.js baut SleeveFactionWork,
  // getHackingWorkRepGain, calculateFactionExp, applySleeveGains (inkl.
  // sync-Teilung), den Schockabbau aus Sleeve.process/SleeveRecoveryWork und
  // die BN-Multiplikatoren fuer BN1, 5, 8 und 12 nach.
  //
  // WAS DARAN GEEICHT IST UND WAS NICHT (Skeptiker 27.09.): Gegen die
  // BN5L3-Backups geeicht sind nur (1) die Stufenformel aus Exp (Spieler
  // hack 759, Sleeve dex 102 exakt), (2) der GRUND-Schockabbau 0,0001 *
  // intBonus(int, 0,75) je Zyklus (alle drei Sleeves ergeben dieselbe ganze
  // Zyklenzahl, 7205 und 10810, auf 1e-10) und (3) der Share-Bonus 1,27-1,29
  // aus der Spieler-Rep-Rate (36.977 rep/h BitRunners), gegengeprueft an
  // security fuer Slum Snakes. Die Recovery-ZUSATZrate und die
  // Sleeve-Rep-Formel selbst sind NUR aus dem Quellcode gelesen - kein
  // Sleeve hat im Messzeitraum Faktionsarbeit oder Recovery gemacht.
  //
  // Ergebnis je Sleeve (BN5, Stand 16:08: Schock 64, dex/agi 102, hack 1,
  // Favor 0 - mit dem echten Favor 53-81 der Zielfaktionen liegt alles um
  // den Faktor 1,5-2 hoeher, z.B. hacking bei Favor 53: 1.041/2.047/3.121):
  //
  //     Aufgabe                    3 h        12 h        24 h
  //     Shoplift                   0 rep/h    0           0        13,5 Mio $/h
  //     Mug                        0          0           0        16,2 Mio $/h
  //     Faktion hacking            679        1.336       2.036    rep/h
  //     Faktion security           591        1.016       1.518
  //     Uni Rothman 1 h, hacking   723        1.437       2.117
  //     Uni ZB 3 h, hacking        0          1.535       2.302    (+Reise)
  //     Recovery 2 h, hacking      197        1.329       2.189
  //     Recovery 4 h, hacking      0          1.214       2.278
  //     Synchronize 3 h, hacking   0          1.024       1.876
  //
  // Drei Sleeves auf Faktionsarbeit sind 5-15 % der Spielerrate (36.977
  // rep/h) - klein, aber die 40 Mio $/h aus Verbrechen sind bei $19 Mrd auf
  // dem Konto gar nichts. In BN8 bringt Verbrechen ohnehin null Dollar
  // (CrimeMoney 0), in BN1/12 gilt dasselbe Bild wie in BN5 (BN12 -4 %).
  //
  // WARUM HACKING VOR SECURITY, obwohl security fuer DIESEN Sleeve im ersten
  // Moment mehr bringt (dex/agi 102 aus dem Shoplift-Erbe gegen hack 1):
  // Hacking-Exp startet bei null und die Stufe waechst logarithmisch
  // (32*ln(exp+534,6)-200) - nach einer Stunde liegt hack bei ~60, und ab da
  // ueberholt die hacking-Rate. "Jetzt die beste Art" liegt ueber 24 h 23 %
  // unter "immer hacking" (1.567 gegen 2.036). Security nur dort, wo die
  // Faktion kein hacking anbietet (Slum Snakes, Tetrads) - dann liefert
  // setToFactionWork `false` (`Sleeve.ts:418-434`), und die naechste Art wird
  // versucht.
  //
  // WARUM KEINE UNI: Das ZB Institute (Volhaven, expMult 4) braechte je
  // Sleeve +9 bis +16 % ueber 24/12 h, absolut rund 200 rep/h. Verworfen
  // wegen RAM: setToUniversityCourse und die Reise (ns.sleeve.travel) kosten
  // zusammen 8 GB, und sleeve.js steht schon bei 31,85. Nicht wegen des
  // Ertrags.
  //
  // SCHOCK. Das Spiel setzt die Sleeves bei jedem Einbau selbst auf Shock
  // Recovery, solange Schock > 0 (`PlayerObjectGeneralMethods.ts:118`); beim
  // Knotenwechsel setzt `Sleeve.prestige` zusaetzlich Schock auf 100
  // (`Sleeve.ts:251`). Recovery baut dreimal so schnell ab (0,0003 statt
  // 0,0001 je Zyklus mal intBonus(int, 0,75)). Rep ~ Schockbonus * Stufe,
  // und die Stufe waechst selbst mit Schockbonus-gewichteter Exp - deshalb
  // lohnt die Erholung bei hohem Schock:
  //
  //     vom Knotenstart (100)       12 h: rep/h   24 h: rep/h
  //     Recovery gar nicht              200            611
  //     bis 65                          411          1.194
  //     bis 50                          243          1.271
  //     vom Stand 64 aus
  //     gar nicht                     1.334          2.034
  //     bis 50                        1.306          2.217  (+9 %)
  //     bis 40                        1.180          2.284  (+12 %)
  //
  // SCHOCK_ZIEL = 50 (Skeptiker): Der Knoten dauert in V1 12-24 h, und das
  // Spiel setzt die Recovery nach JEDEM Einbau gratis neu - also wird auf
  // den laengeren Horizont optimiert. Neu SETZEN kann dieses Skript sie
  // nicht (setToShockRecovery waeren 4 GB mehr); es laesst sie nur stehen.
  //
  // EHRLICH: DAS GREIFT SELTEN. sleevecrime.js (gestartet von bn4net.js:548)
  // ueberschreibt nach Knotenwechsel UND Einbau die Recovery sofort mit
  // Shoplift - danach steht keine Recovery mehr, die man stehenlassen
  // koennte. Der Verlust vom Knotenstart (~200 statt ~411 rep/h je Sleeve
  // ueber 12 h) ist bewusst hingenommen: kein zusaetzliches RAM dafuer,
  // weder hier noch in sleevecrime.js (Entscheidung 27.09.).
  //
  // AUG-EINBAU SETZT DIE SLEEVES NICHT ZURUECK (Quellcode und Backup):
  // prestigeAugmentation aendert nur die Aufgabe; Exp, Schock und sync
  // bleiben (Backup 15:32 pre-install Schock 65,06, 16:08 danach 63,96).
  // Der Horizont ist also der ganze Knoten (12-24 h in V1), nicht der
  // Einbauzyklus (2-3,4 h laut backups/INDEX.tsv).
  //
  // GELDBODEN MIT HYSTERESE: Nach jedem Einbau steht das Konto bei 1.000 $,
  // und dann traegt ein Verbrechen (Mug bei dex/agi 102: 4.500 $/s je Sleeve
  // in BN5) tatsaechlich etwas bei. Unter GELD_KNAPP also Verbrechen, und
  // zurueck zur Faktion erst ueber GELD_FREI - sonst flattert der Sleeve an
  // der Schwelle zwischen beidem hin und her. Ausser in BN8, wo Verbrechen
  // nichts bringt, und ausser waehrend einer noch stehenden Schockerholung.
  //
  // KARMA: Sleeve-Verbrechen senken das Karma des Spielers nur mal syncBonus
  // (`SleeveCrimeWork.ts`, `Player.karma -= crime.karma * syncBonus`), bei
  // sync 1 % also praktisch gar nicht. Der Wegfall von Shoplift kostet kein
  // Karma.
  const SCHOCK_ZIEL = 50;
  const GELD_KNAPP = 10e6;
  const GELD_FREI = 20e6;
  const REP_MODUS_FRISCH_MS = 5 * 60000;
  const OHNE_VERBRECHENSGELD = [8];   // BitNode.tsx:769 CrimeMoney 0
  const FAKTION_ARTEN = ["hacking", "security", "field"];
  let geldKnappMerker = false;        // Hysterese-Zustand, lebt ueber die Takte

  // Wofuer arbeiten? Nur Faktionen, in denen der Spieler JETZT Mitglied ist
  // (ns.getPlayer().factions, 0 GB mehr - getPlayer ist geladen; nach einem
  // Einbau ist die Liste leer, bis neu beigetreten wird), und nur solche mit
  // noch unverdienten Stuecken (bn4rep.json `offenJeFaktion`). Reihenfolge:
  //   1. rep-modus.txt - woran der Spieler gerade arbeitet, aber nur, wenn der
  //      Stempel juenger als 5 min ist (sonst ist die Datei ein Rest).
  //      Steht dort eine Firma, faellt sie durch den Mitgliedsfilter - AUSSER
  //      es gibt eine gleichnamige Faktion (Clarke Incorporated, OmniTek, ...),
  //      in der der Spieler Mitglied ist: dann arbeitet der Sleeve fuer diese
  //      Faktion, und das ist in Ordnung, solange sie Offenes hat.
  //   2. zielFaktion und Rangliste aus bn4rep.json.
  //   3. alle uebrigen Faktionen mit Offenem, groesster Rep-Bedarf zuerst.
  // Faktionen OHNE Offenes binden keinen Sleeve (CyberSec im BN5L3: alles
  // eingebaut, Favor 102 - die alte Favor-Sortierung setzte genau dort einen
  // Sleeve hin). Fehlt `offenJeFaktion` (bn4rep.js aelter als dieser
  // Umbau), gelten nur Punkt 1 und 2.
  // Zwei Sleeves duerfen nicht fuer dieselbe Faktion arbeiten
  // (`NetscriptFunctions/Sleeve.ts:152-164`), der Spieler und ein Sleeve
  // schon - das Spiel prueft es nicht.
  const faktionsKandidaten = () => {
    let mitglied = null;
    try { mitglied = new Set(ns.getPlayer().factions || []); } catch { mitglied = null; }
    const liste = [];
    try {
      const [f, stempel] = String(liesVonHome(ns, "data/rep-modus.txt") || "").split("|");
      const alter = Date.now() - Number(stempel);
      if (f && f.trim() && Number.isFinite(alter) && alter >= 0 && alter < REP_MODUS_FRISCH_MS) {
        liste.push(f.trim());
      }
    } catch { /* keine Datei - dann nur bn4rep.json */ }
    let offen = null;
    try {
      const j = JSON.parse(liesVonHome(ns, "data/bn4rep.json") || "null");
      if (j) {
        if (typeof j.zielFaktion === "string") liste.push(j.zielFaktion);
        for (const r of (Array.isArray(j.rangliste) ? j.rangliste : [])) {
          if (r && typeof r.faktion === "string") liste.push(r.faktion);
        }
        if (j.offenJeFaktion && typeof j.offenJeFaktion === "object") {
          offen = j.offenJeFaktion;
          const rest = Object.keys(offen)
            .sort((a, b) => (Number(offen[b].fehlt) || 0) - (Number(offen[a].fehlt) || 0));
          liste.push(...rest);
        }
      }
    } catch { /* kaputtes JSON - dann eben weniger Kandidaten */ }
    return [...new Set(liste.filter((x) => typeof x === "string" && x))]
      .filter((f) => !mitglied || mitglied.has(f))
      .filter((f) => !offen || (offen[f] && Number(offen[f].anzahl) > 0));
  };

  // Teilt ALLE Sleeves eines Takts auf einmal zu - einzeln ginge es nicht,
  // weil die Eindeutigkeit der Faktion ueber alle Sleeves gilt.
  // Rueckgabe je Sleeve: { ok, was, v1, faktion } oder ok=false (dann
  // entscheidet der Verbrechenszweig im Hauptteil).
  const teileHackingwegZu = (anzahl) => {
    const erg = [];
    const tasks = [], schock = [];
    for (let j = 0; j < anzahl; j++) {
      let t = null, s = 0;
      try { t = ns.sleeve.getTask(j); } catch { t = null; }
      try { s = Number(ns.sleeve.getSleeve(j).shock) || 0; } catch { s = 0; }
      tasks.push(t); schock.push(s);
      erg.push({ ok: false, was: "", v1: "rueckfall", faktion: null });
    }
    let knoten = 0, geld = Infinity;
    try { knoten = ns.getResetInfo().currentNode; } catch { knoten = 0; }
    try { geld = ns.getPlayer().money; } catch { geld = Infinity; }
    if (OHNE_VERBRECHENSGELD.includes(knoten)) geldKnappMerker = false;
    else if (geld < GELD_KNAPP) geldKnappMerker = true;
    else if (geld > GELD_FREI) geldKnappMerker = false;
    // 1. Laufende Schockerholung stehenlassen, solange ueber dem Ziel.
    for (let j = 0; j < anzahl; j++) {
      if (tasks[j] && tasks[j].type === "RECOVERY" && schock[j] > SCHOCK_ZIEL) {
        erg[j] = { ok: true, was: "recovery", v1: "recovery", faktion: null };
      }
    }
    // 2. Geld knapp: Verbrechen (der Hauptteil waehlt welches).
    if (geldKnappMerker) {
      for (let j = 0; j < anzahl; j++) if (!erg[j].ok) erg[j].v1 = "geld-knapp";
      return erg;
    }
    // 3. Faktionsarbeit. Wer schon auf einer der obersten Faktionen arbeitet,
    //    bleibt dort (kein neues startWork, keine Konflikte beim Tauschen);
    //    die uebrigen bekommen die naechste freie. `oben` wird ERST NACH dem
    //    Mitglieds- und Offen-Filter gebildet, sonst belegten Faktionen, die
    //    gleich wieder herausfallen, die vorderen Plaetze.
    const kandidaten = faktionsKandidaten();
    const oben = kandidaten.slice(0, anzahl);
    const vergeben = new Set();
    for (let j = 0; j < anzahl; j++) {
      const t = tasks[j];
      if (erg[j].ok || !t || t.type !== "FACTION") continue;
      if (!oben.includes(t.factionName) || vergeben.has(t.factionName)) continue;
      vergeben.add(t.factionName);
      erg[j] = { ok: true, was: "faction:" + t.factionName + "/" + t.factionWorkType,
        v1: "faktion", faktion: t.factionName };
    }
    for (let j = 0; j < anzahl; j++) {
      if (erg[j].ok) continue;
      for (const f of kandidaten) {
        if (vergeben.has(f)) continue;
        // Arbeitet dieser Sleeve schon dort, nicht neu setzen.
        const t = tasks[j];
        if (t && t.type === "FACTION" && t.factionName === f) {
          vergeben.add(f);
          erg[j] = { ok: true, was: "faction:" + f + "/" + t.factionWorkType, v1: "faktion", faktion: f };
          break;
        }
        let gesetzt = null;
        for (const art of FAKTION_ARTEN) {
          // false = Art nicht angeboten -> naechste Art. Wurf = kein Mitglied,
          // unbekannter Name, anderer Sleeve schon dort -> naechste Faktion.
          let r = false;
          try { r = ns.sleeve.setToFactionWork(j, f, art); } catch { break; }
          if (r) { gesetzt = art; break; }
        }
        if (gesetzt) {
          vergeben.add(f);
          erg[j] = { ok: true, was: "faction:" + f + "/" + gesetzt, v1: "faktion", faktion: f };
          break;
        }
      }
    }
    return erg;
  };

  for (;;) {
    const stand = [];
    const keinGym = hackingweg();
    // Wie viele Sleeves gibt es wirklich? MAX ist nur die Schleifengrenze;
    // der Geldboden unten rechnet mit den Koerpern, die zahlen.
    let anzahl = 0;
    for (let j = 0; j < MAX; j++) { try { ns.sleeve.getSleeve(j); anzahl++; } catch { break; } }
    // Im Hackingweg alle Sleeves vorab zuteilen (Eindeutigkeit der Faktion).
    let v1 = null;
    if (keinGym) { try { v1 = teileHackingwegZu(anzahl); } catch { v1 = null; } }
    for (let i = 0; i < anzahl; i++) {
      let ok = false, was = "gym";
      // Rueckstand und Werte je Sleeve: Telemetrie (tools/checkin.js wertet
      // waehrend des Nachholbetriebs keine Rate) und Verbrechenswahl.
      let storedCycles = 0, sleeveSk = null, sleeveShock = null;
      try {
        const sl = ns.sleeve.getSleeve(i);
        storedCycles = Number(sl.storedCycles) || 0;
        sleeveSk = sl.skills;
        sleeveShock = Number.isFinite(sl.shock) ? Math.round(sl.shock * 100) / 100 : null;
      } catch { break; }
      const v1i = v1 && v1[i] ? v1[i] : null;
      if (v1i && v1i.ok) { ok = true; was = v1i.was; }
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
      // weil derselbe Zustand nach jedem KNOTENWECHSEL ohnehin eintritt.
      // KORREKTUR 27.09.2026: Hier stand "nach jedem Augmentierungs-Einbau
      // des Spielers". Das ist falsch - `prestigeAugmentation`
      // (`PlayerObjectGeneralMethods.ts:118`) setzt nur die AUFGABE der
      // Sleeves; Exp, Schock und sync bleiben (Backup BN5L3 15:32 -> 16:08
      // ueber einen Einbau: dex-Exp 11.430 -> 12.176). Genullt wird erst in
      // `prestigeSourceFile` -> `Sleeve.prestige()` (`Sleeve.ts:228-256`).
      const KONTRAKT_MIN_KAMPF = 40;
      let sleeveKampf = 0, sleeveSkills = null;
      if (inDivision) {
        try {
          const sk = ns.sleeve.getSleeve(i).skills;
          sleeveSkills = sk;
          sleeveKampf = Math.min(sk.strength, sk.defense, sk.dexterity, sk.agility);
        } catch { sleeveKampf = 0; }
      }
      // LAEUFT SCHON EINE KONTRAKTAKTION? DANN NICHT NEU SETZEN (30.08., 06:20).
      //
      // `Sleeve.bladeburner()` ruft ausnahmslos
      // `startWork(new SleeveBladeburnerWork(...))` (`Sleeve.ts:488-540`) - die
      // Arbeit wird also NEU angelegt und `cyclesWorked` faellt auf 0. Bei
      // TAKT = 60000 und `cyclesNeeded` von 70 Zyklen setzt dieses Skript den
      // Sleeve damit zurueck, bevor er fertig wird, sobald der Tab gedrosselt
      // ist und Setzen und Verarbeiten in derselben Nachhol-Runde landen.
      //
      // Gemessen am 30.08. um 06:15 per `ns.sleeve.getTask(0)`:
      //   cyclesWorked 15 von 70, **tasksCompleted 0**, Aktion Tracking,
      //   Vorrat Tracking 3,2 / Bounty Hunter 8,2 / Retirement 96,3.
      // Der Sleeve stand also nicht still, er kam nur nie ans Ziel. Die
      // Rangrate fiel dadurch von 14,4/h (29.08., gemessen ueber 2,16 h) auf
      // 4,4/h ueber die Nacht - Rang 65 auf 99 in 7,7 h Spielzeit.
      //
      // Die 4 GB fuer `getTask` sind der Preis dafuer. Der Verzicht im
      // Dateikopf war eine RAM-Entscheidung aus einer Zeit ohne Werkbank; er
      // ist fuer Verbrechen harmlos (kurze Aktionen) und fuer
      // Bladeburner-Kontrakte toedlich.
      // WAEHREND BLADE.JS AUFRAEUMT, KEIN CHAOS NACHLEGEN (22.09.2026,
      // BAUSTELLEN "Sleeves arbeiten gegen das Aufraeumen"). Bounty Hunter
      // legt je Erfolg +0,02 Chaos nach, Retirement +0,04 - in der Stadt, in
      // der gerade aufgeraeumt wird (Bladeburner.ts:878-885). Tracking legt
      // keines nach. Solange blade.json `aufraeumen` meldet, bleibt also nur
      // Tracking erlaubt; zwei Sleeves duerfen denselben Vertrag nicht fahren,
      // die uebrigen gehen auf Infiltrate (fuellt den Vorrat, kein Chaos).
      let chaosRunde = false;
      try {
        const bj = JSON.parse(liesVonHome(ns, "data/blade.json") || "null");
        chaosRunde = !!bj && bj.aufraeumen === true
          && Number.isFinite(bj.zeit) && Date.now() - bj.zeit < 10 * 60000;
      } catch { chaosRunde = false; }
      const erlaubteKontrakte = chaosRunde ? ["Tracking"] : KONTRAKTE;

      // SKEPTIKER-AUDIT 26.09.2026, FUND 5 (audit-2026-09-26/4-bladeburner.md#5):
      // in der Op-Phase faehrt der Spieler eine OPERATION (z. B.
      // Assassination), keine Vertraege - deren Vorrat waechst also nur, und
      // dieser Block liess Sleeves bis heute IMMER auf Vertraegen bleiben,
      // obwohl `Infiltrate Synthoids` genauso auf JEDE Operation wirkt
      // (`Bladeburner.ts:1251-1263 infiltrateSynthoidCommunities`,
      // `amt = infilSleeves^-0,5/2` je 61 s auf jede Vertrags- UND
      // Operationsart).
      //
      // GERECHNET, nicht geraten: natuerliches Wachstum von Assassination
      // 7,9/h (`data/Operations.ts`, Mittel 1,05 je 480 s). Spielerverbrauch
      // gemessen 160-200/h (1.412 Rang/min bei 424-530 Rang je Lauf, Stufe
      // 20). Infiltrate-Ertrag je Stunde bei N Sleeves: `amt` faellt N mal je
      // 61 s an, `amt = N^-0,5/2`, macht ueber 3600/61 Vollzyklen ungefaehr
      // `59*N*amt = 29,5*sqrt(N)` je Stunde - bei N=3 also 51/h, bei N=8 (mehr
      // als ohne Covenant-Kaeufe erreichbar) 83/h. GEGEN 160-200/h Bedarf
      // deckt das den Verbrauch bei KEINER erreichbaren Sleeve-Zahl - der
      // Befund "160-200/h Bedarf gegen 7,9/h Nachwuchs" bleibt bestehen.
      //
      // Aber: Infiltrate SENKT die Nettoabflussrate um bis zu ein Drittel
      // (N=3: 152-192/h Nettoverlust ohne Hilfe -> 101-141/h mit) und
      // verlaengert damit proportional das Zeitfenster, bevor der Vorrat auf
      // 0 faellt und der Bot auf eine schlechtere Aktion zurueckfaellt
      // (beobachtet 01.09. 04:05: Undercover Operation direkt nach dem
      // letzten Assassination-Lauf). Der Tausch kostet die
      // Sleeve-Vertragsrate (~43 Rang/min ALLER Sleeves zusammen, gemessen
      // 31.08. waehrend Recruitment) gegen ein laengeres Fenster auf
      // 1.412 Rang/min Spielerrate - selbst ein Drittel mehr Laufzeit auf der
      // hohen Rate wiegt die 43 Rang/min um Groessenordnungen auf.
      //
      // DESHALB NICHT DAUERHAFT, NUR BEI ECHTER KNAPPHEIT: Ein staendiger
      // Umstieg wuerde die 43 Rang/min verschenken, solange noch Vorrat da
      // ist - das waere derselbe Fehler wie der feste 0,85-Schwellwert in
      // blade.js (Fund 4). Die Schwelle ist deshalb an die Operation
      // gekoppelt, die der SPIELER gerade tatsaechlich faehrt (`blade.json`
      // `istAktion`, nicht `aktion` - das ist nur der Wunsch, siehe blade.js
      // Kommentar "Was die Figur WIRKLICH tut"): faellt ihr Vorrat unter das
      // Produkt aus der (konservativ oberen) Verbrauchsschaetzung und einer
      // Vorlaufzeit von zwei Stunden, geht JEDER Sleeve auf Infiltrate, auch
      // wenn Vertraege selbst noch reichlich Vorrat haetten.
      const OP_VERBRAUCH_STUENDLICH = 200;   // konservativ, obere Audit-Grenze
      const OP_RUNWAY_STUNDEN = 2;
      let knappeOperation = null;
      try {
        const bj = JSON.parse(liesVonHome(ns, "data/blade.json") || "null");
        const ist = bj && typeof bj.istAktion === "string" ? bj.istAktion : null;
        if (ist && ist.startsWith("Operations/")) {
          const opName = ist.slice("Operations/".length);
          // Dieselbe Funktion wie oben fuer Contracts - kostet keine
          // zusaetzlichen 4 GB (Bitburner zaehlt je FunktionsNAME einmal).
          const rest = ns.bladeburner.getActionCountRemaining("Operations", opName);
          if (Number.isFinite(rest) && rest < OP_VERBRAUCH_STUENDLICH * OP_RUNWAY_STUNDEN) {
            knappeOperation = opName;
          }
        }
      } catch { knappeOperation = null; }
      let laeuftSchon = false;
      if (inDivision) {
        try {
          const t = ns.sleeve.getTask(i);
          if (t && t.type === "BLADEBURNER" && t.actionType === "Contracts"
              && erlaubteKontrakte.includes(t.actionName)) {
            laeuftSchon = true; ok = true; was = "contract:" + t.actionName;
          }
          // INFILTRATE GEHOERT HIER MIT REIN (30.08.2026, 12:55, nach einem
          // Skeptiker-Lauf) - sonst schliesst der Rueckfall von 10:00 NIE ab.
          //
          // `SleeveInfiltrateWork` verlangt `cyclesWorked > 300` - strikt
          // groesser (`Work/SleeveInfiltrateWork.ts:23`, `infiltrateCycles =
          // 60000/200`). `Sleeve.process` schreibt 5 Zyklen je Sekunde
          // (`Sleeve.ts:263-274`), der Abschluss faellt also bei **61,0 s**.
          // `TAKT` ist 60000 ms, und weil dieser Block Infiltrate nicht
          // erkannte, setzte das Skript bei 60,0 s neu - `startWork` wirft
          // `cyclesWorked` auf 0 (`Sleeve.ts:526-528`). Verfehlt um eine
          // Sekunde, jedes Mal, unendlich oft: null Nachschub.
          //
          // Das ist woertlich derselbe Fehler wie am 30.08. um 06:20 bei den
          // Kontrakten - dort war die Ursache das blinde Neusetzen einer
          // laufenden Aktion, hier dieselbe Luecke eine Aktionsart weiter.
          if (t && t.type === "INFILTRATE") {
            laeuftSchon = true; ok = true; was = "infiltrate";
          }
        } catch { /* alte Fassung: dann wie bisher jedes Mal neu setzen */ }
      }
      if (!laeuftSchon && inDivision && sleeveKampf >= KONTRAKT_MIN_KAMPF) {
        if (knappeOperation) {
          // FUND 5: die Operation, die der Spieler faehrt, ist knapp - dann
          // NICHT erst Vertraege versuchen (die haetten ohnehin Vorrat, siehe
          // oben), sondern direkt unten in den Infiltrate-Zweig durchfallen.
          // (Kein eigenes Log hier - sleeve.js hat keinen `sag`/`ns.print`-Kanal,
          // der Zustand steht wie ueberall sonst in data/sleeve.json.)
        } else {
        // NACH VORRAT SORTIEREN, NICHT NACH LISTENPLATZ (30.08., 06:35).
        //
        // Die feste Reihenfolge nahm die erste Art mit Vorrat >= 1. Gemessen
        // um 06:22: Tracking 3,2 - Bounty Hunter 8,2 - Retirement 96,3. Der
        // Sleeve bekam also Tracking, verbrauchte die letzten drei und wurde
        // vom Spiel gestoppt (`SleeveBladeburnerWork.ts:44-47`), bis dieses
        // Skript 60 Sekunden spaeter neu setzte. Zwischen den Takten stand er.
        //
        // Nachschub sind rund 30 Stueck je Stunde und Art
        // (`Bladeburner.ts:1387`, `count += seconds*growthFunction()/480`);
        // ein Sleeve verbraucht bei 14 s je Aktion bis zu 257. Die knappste
        // Art ist damit immer knapp - genommen wird die ergiebigste.
        const nachVorrat = erlaubteKontrakte.map((art) => {
          let v = 0;
          try { v = ns.bladeburner.getActionCountRemaining("Contracts", art); } catch { v = 1; }
          return { art, v };
        }).sort((a, b) => b.v - a.v);
        for (let n = 0; n < nachVorrat.length && !ok; n++) {
          const art = nachVorrat[n].art;
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
            // SCHWELLE 2, NICHT 1 (30.08.2026, 10:00). Bei 1,93 offenen
            // Auftraegen liess die alte Pruefung durch - der Sleeve schloss
            // einen ab, der Stand fiel auf 0,93, und `process` stoppte ihn
            // im selben Takt (`SleeveBladeburnerWork.ts:44-47`). Genau so
            // stand er um 09:53 auf Idle, waehrend `sleeve.json` brav
            // `contract:Retirement` meldete. Die Schwelle muss einen
            // Abschluss ueberleben, sonst ist jedes Setzen sofort tot.
            if (vorrat < 2) continue;
            ok = ns.sleeve.setToBladeburnerAction(i, "Take on contracts", art);
            if (ok) was = "contract:" + art;
          } catch { ok = false; }
        }
        }

        // KEIN KONTRAKT DA? NACHFUELLEN STATT STILLSTEHEN (30.08., 10:00).
        //
        // In der Wiederaufbauphase nach einem Einbau faehrt der Spieler Gym
        // (`blade.js` weicht bbtrain aus, `grund: "weicht bbtrain,
        // Kampfwerte 1"`) und damit auch kein Incite Violence. **Niemand
        // fuellt den Vorrat nach**, waehrend der Sleeve ihn aufbraucht -
        // danach steht er die ganzen zehn Stunden still.
        //
        // `Infiltrate Synthoids` ist der Ausweg: Es legt
        // `Math.pow(infilSleeves, -0.5) / 2` auf JEDE Kontraktart und JEDE
        // Operation (`Bladeburner.ts`, `infiltrateSynthoidCommunities`), bei
        // einem Sleeve also 0,5 je 60 Sekunden - nach zwei Minuten ist jede
        // Art wieder ueber der Schwelle. Selbstbegrenzend: Sobald Vorrat da
        // ist, greift oben wieder der Kontraktzweig.
        //
        // Besser als der Gym-Rueckfall darunter, weil der Sleeve mit
        // 45/45/57/48 laengst ueber `KONTRAKT_MIN_KAMPF` liegt - Training
        // braucht er nicht, und der Vorrat fuellt sich davon auch nicht.
        if (!ok) try {
          ok = ns.sleeve.setToBladeburnerAction(i, "Infiltrate Synthoids");
          if (ok) was = "infiltrate";
        } catch { ok = false; }
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
      // GELDBODEN UND NACHHOLBETRIEB (02.09.2026, Audit "volle Autonomie").
      //
      // Sleeves haben einen Zyklusdeckel von 15 je Takt (Sleeve.ts:263-275)
      // und holen einen Rueckstand mit 15-facher Geschwindigkeit nach - im
      // Powerhouse sind das 36.000 $/s je Sleeve. Am 02.09. um 06:00 stand
      // das Konto nach fuenf Minuten bei -18,5 Mio; mit negativem Konto kauft
      // der Bot weder Rechner noch Portknacker. Deshalb: Gym nur, wenn das
      // Konto die Nachholphase ALLER Koerper plus einen Takt traegt, und
      // darueber eine Reserve bleibt. Sonst Verbrechen - das bringt Geld.
      //
      // Und nicht denselben Wert wie die Figur: Ein ausgeschalteter Rechner
      // schreibt beim Laden die zuletzt laufende Arbeit als Klumpen auf EINEN
      // Wert (engine.tsx:280-282). Figur nimmt den niedrigsten, Sleeve i den
      // (i+1)-niedrigsten - dann verteilt sich der Klumpen.
      let gymGeldReicht = false;
      if (!ok && !keinGym) try {
        const stored = Number((ns.sleeve.getSleeve(i) || {}).storedCycles) || 0;
        const geld = ns.getPlayer().money;
        const sekunden = stored / 5 + TAKT / 1000;
        const koerper = anzahl + 1;   // Sleeves plus die Figur im Gym
        gymGeldReicht = geld >= 2400 * sekunden * koerper + 20e6;
        if (!gymGeldReicht && was === "gym") was = "arm";
      } catch { gymGeldReicht = false; }
      if (!ok && !keinGym && gymGeldReicht) try {
        const sk = (inDivision && sleeveSkills) ? sleeveSkills : ns.getPlayer().skills;
        const paare = [["str", sk.strength], ["def", sk.defense],
          ["dex", sk.dexterity], ["agi", sk.agility]];
        paare.sort((a, b) => a[1] - b[1]);
        const platz = inDivision ? 0 : Math.min(i + 1, paare.length - 1);
        was = paare[platz][0];
        ok = ns.sleeve.setToGymWorkout(i, GYM, was);
      } catch { ok = false; }
      if (!ok && keinGym) {
        // HACKINGWEG (Geld knapp oder keine Faktion zu haben): welches
        // Verbrechen, rechnet besteVerbrechen wie das Spiel (oben). Laeuft
        // dasselbe schon, wird es NICHT neu gesetzt - setToCommitCrime legt
        // eine neue SleeveCrimeWork an und wirft den angefangenen Versuch weg
        // (Mug 4 s von 60 s Takt = 7 %). getTask ist ohnehin geladen.
        was = sleeveSk ? besteVerbrechen(sleeveSk) : VERBRECHEN;
        let laeuft = false;
        try {
          const t = ns.sleeve.getTask(i);
          laeuft = !!t && t.type === "CRIME" && t.crimeType === was;
        } catch { laeuft = false; }
        if (laeuft) ok = true;
        else {
          try { ok = ns.sleeve.setToCommitCrime(i, was); }
          catch { break; }   // ab hier gibt es keinen Sleeve mehr
        }
      }
      if (!ok) {
        // AUSSERHALB DES HACKINGWEGS UNVERAENDERT (Skeptiker 27.09.): bei
        // knappem Konto unter Kampfwert 40 Shoplift, darueber Mug; faellt nur
        // das Gym aus, VERBRECHEN. Dort trainiert das Gym alle vier Werte,
        // die Shoplift-Klemme des Hackingwegs tritt so nicht auf - und V2 ist
        // nicht Gegenstand dieses Umbaus.
        const sleeveMin = sleeveSk
          ? Math.min(sleeveSk.strength, sleeveSk.defense, sleeveSk.dexterity, sleeveSk.agility) : 0;
        was = !gymGeldReicht ? (sleeveMin < 40 ? "Shoplift" : "Mug") : VERBRECHEN;
        try { ok = ns.sleeve.setToCommitCrime(i, was); }
        catch { break; }   // ab hier gibt es keinen Sleeve mehr
      }
      // `v1` sagt, WARUM im Hackingweg diese Aufgabe: faktion | recovery |
      // geld-knapp | rueckfall (keine Faktion ging). `grund` bleibt wie bisher.
      stand.push({ nr: i, gesetzt: ok, aufgabe: was, stored: storedCycles,
        grund: keinGym ? "hackingweg" : (!gymGeldReicht && was !== "gym" ? "arm" : ""),
        ...(keinGym ? { v1: v1i ? v1i.v1 : "rueckfall", faktion: v1i ? v1i.faktion : null,
          schock: sleeveShock } : {}) });
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
