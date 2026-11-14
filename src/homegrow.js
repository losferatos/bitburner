/**
 * home ausbauen - Speicher und Kerne.
 *
 * WARUM DAS EIN EIGENES SKRIPT IST (23.08.2026)
 *
 * Der Ausbau stand bis heute mitten in bn4net.js. Das hat den Bot am
 * Knotenuebergang unbrauchbar gemacht, und zwar unbemerkt:
 *
 *   `SF4Cost` (RamCostGenerator.ts:82-96) gibt den Singularity-Rabatt NUR in
 *   BitNode 4. Mit SF4 Stufe 1 kostet jeder Singularity-Aufruf ausserhalb das
 *   SECHZEHNFACHE. Die vier Aufrufe des Ausbaus (upgradeHomeRam und
 *   upgradeHomeCores je SingularityFn2 = 3 GB, die beiden Kostenabfragen je
 *   1,5 GB) sind zusammen 9 GB Grundpreis - ausserhalb von BitNode 4 also
 *   144 GB. bn4net.js waere damit von 16 auf 160 GB gesprungen.
 *
 *   home startet im neuen Knoten aber bei 32 GB (Prestige.ts:241-247, mit
 *   SF1; ohne SF1 sogar 8). boot.js haette bn4net.js zwanzig Minuten lang
 *   nicht starten koennen und dann aufgegeben - der Bot haette im neuen
 *   Knoten tot gestanden. Bei 45 geplanten Uebergaengen ist das kein
 *   Randfall, das ist der Regelfall.
 *
 * Getrennt ist die Rechnung sauber: bn4net.js kommt ohne Singularity aus und
 * bleibt bei 16 GB, passt also in jedes frische home. Dieses Skript hier ist
 * gross, wird aber erst gestartet, wenn es Platz gibt - bn4net legt es wie
 * jedes andere Werkzeug auf die Werkbank, also auf einen Mietrechner. Der
 * kostet 55.000 je GB und ist lange vor dem ersten home-Ausbau da.
 *
 * Singularity-Funktionen sind spielerweit, nicht rechnergebunden - dass das
 * Skript auf einem Mietrechner laeuft, aendert an der Wirkung nichts.
 *
 * Aufruf: laeuft dauerhaft, eine Runde alle zehn Sekunden.
 *
 * @param {NS} ns
 */

// Steuer- und Lagedateien wohnen auf home; dieses Gewerk laeuft nicht
// zwingend dort. `ns.read` liest immer LOKAL - siehe lib/hostdatei.js.
import { liesVonHome } from "lib/hostdatei.js";

// ===========================================================================
// G50 (14.11.2026, Audit Lauf 2, 4a/4b): KERNKAUF NUR MIT ERTRAGSPRUEFUNG
// ===========================================================================
//
// Bis hierher kaufte der Waechter einen Kern, sobald Preis <= 3e13 und Geld
// > 1,2 x Preis - der Hackertrag kam in der Regel nicht vor. Belegt am
// Spielstand: BN9.1 gab 63,75 Mrd fuer die Kerne 2 und 3 aus (7,5 + 56,25 Mrd,
// 1e9 * 7,5^Kerne), das waren 75 % der Augmentierungs-Ausgaben des Knotens,
// bei 0,68 Mrd Hackertrag im ganzen Knoten; BN9.3 7,5 Mrd gegen 0,41 Mrd;
// BN4.2 63,75 Mrd gegen hoechstens 19 Mrd Gewinn.
//
// Kerne wirken nur auf grow() und weaken() (NetscriptFunctions.ts:288, Bonus
// 1 + (Kerne-1)/16), also auf das Hack-Einkommen. Ausserdem wirken Kerne auf
// share() (Share.ts:22-23, getCoreBonus) und Stanek; der Bot startet
// worker/share.js im Rep-Modus auch auf home. Gerechnet (Skeptiker 14.11.2026):
// Bonus 1 + ln(Faeden x Kernbonus)/25, eine Kernstufe mehr = ln(1,0625)/25
// = +0,24 Prozentpunkte Reputation - praktisch ohne Wirkung, die Sperre bleibt.
// Zwei Pruefungen, beide
// nur SPERREN - sie erlauben nie etwas, das die alte Regel nicht schon erlaubt
// haette:
//
//  (1) KNOTEN OHNE HACKERTRAG. Faktor = ScriptHackMoney x ScriptHackMoneyGain
//      x ServerMaxMoney des Knotens (lib/bitnodes.json, fehlendes Feld = 1).
//      <= 0,01 sperrt: BN9 (0,1 x 0,01 = 0,001), BN3 (0,2 x 0,04 = 0,008),
//      BN11 (1 x 0,01 = 0,01, daher <=, nicht <) und BN8 (Gain 0). BN4 mit
//      0,0225 bleibt offen - dort faengt Pruefung (2) die 63,75 Mrd gegen
//      hoechstens 19 Mrd Gewinn ab.
//  (2) ERWARTETER ERTRAG. Der Kern meldet je Stapelziel `erwartetProS`
//      (bn4net.js: plan.geld / (4 * GAP), der geplante Dauerertrag, BitNode-
//      Faktor schon drin) in data/bn4net.json. Summe = R in $/s. Der Kauf der
//      Stufe k -> k+1 hebt den Kernbonus von f(k) = 1 + (k-1)/16 auf f(k+1),
//      also hoechstens um den Anteil (1/16) / f(k) - als OBERE Schranke fuer
//      den Mehrertrag genommen (home traegt rund 98 % der Faeden, siehe
//      unten). Gekauft wird nur, wenn R * Anteil * KERN_HORIZONT_S >= Preis.
//      Fehlt die Zahl (Stapelbetrieb noch nicht da, Datei alt) gilt die alte
//      Regel - unbekannt ist nicht null.
//
// KERN_HORIZONT_S: 12 h. Ein V1-Knoten dauert 12-35 h online, Kerne bleiben
// bis zum Knotenwechsel (nicht beim Einbau). 12 h ist die grosszuegige Seite:
// das Einkommen waechst im Knoten um Groessen, ein zu spaeter Kauf kostet
// wenig (Kern 2-4 zusammen rund 6 Sekunden Einkommen bei 85 Mrd/s), ein
// ueberfluessiger Kauf kostete in BN9.1 drei Viertel der Augs-Ausgaben.
// Unterkante bei Kern 2: R >= 7,5e9 * 16 / 43200 = 2,8 Mio/s.
export const KERN_HORIZONT_S = 12 * 3600;
export const HACKFAKTOR_MIN = 0.01;

/**
 * Hackertragsfaktor eines Knotens aus der Tabelle lib/bitnodes.json.
 * @param {object|null} tabelle geparste Datei ({knoten, knotenLevel})
 * @param {number} knoten BitNode-Nummer
 * @param {number} stufe Knotenstufe (nur wo knotenLevel sie fuehrt, BN12)
 * @returns {number|null} null = Knoten unbekannt (dann keine Knotensperre)
 */
export function knotenHackFaktor(tabelle, knoten, stufe) {
  if (!tabelle || typeof tabelle !== "object" || !Number.isFinite(knoten) || knoten < 1) return null;
  let k = tabelle.knoten ? tabelle.knoten[String(knoten)] : null;
  const stufen = tabelle.knotenLevel ? tabelle.knotenLevel[String(knoten)] : null;
  if (stufen) {
    const vorhanden = Object.keys(stufen).map(Number).filter(Number.isFinite);
    if (vorhanden.length) {
      const s = Math.min(Number.isFinite(stufe) && stufe >= 1 ? stufe : 1, Math.max(...vorhanden));
      if (stufen[String(s)]) k = stufen[String(s)];
    }
  }
  if (!k) {
    // Knoten 1 steht nicht in der Tabelle (alle Werte 1): bekannt, Faktor 1.
    return tabelle.knoten && Object.keys(tabelle.knoten).length ? 1 : null;
  }
  const f = (name) => (Number.isFinite(k[name]) ? k[name] : 1);
  return f("ScriptHackMoney") * f("ScriptHackMoneyGain") * f("ServerMaxMoney");
}

/**
 * Erwarteter Hackertrag in $/s aus dem Stapelblock von data/bn4net.json.
 * @param {object|null} stapel Feld `stapel` ({gap, ziele:[{erwartetProS}]})
 * @returns {number|null} null = keine Zahl vorhanden (dann alte Regel)
 */
export function erwarteterHackertrag(stapel) {
  if (!stapel || !Array.isArray(stapel.ziele)) return null;
  let summe = 0, n = 0;
  for (const z of stapel.ziele) {
    if (z && Number.isFinite(z.erwartetProS) && z.erwartetProS >= 0) { summe += z.erwartetProS; n++; }
  }
  return n > 0 ? summe : null;
}

/**
 * Darf der naechste Kern gekauft werden? Nur zusaetzliche Sperren, die alte
 * Preis-/Geldregel prueft der Aufrufer vorher.
 * @param {{kerne:number, kernKosten:number, knotenFaktor:(number|null), ertragProSek:(number|null)}} a
 * @returns {{erlaubt:boolean, grund:string}}
 */
export function kernKaufErlaubt(a) {
  if (a.knotenFaktor !== null && a.knotenFaktor !== undefined && a.knotenFaktor <= HACKFAKTOR_MIN + 1e-12) {
    return { erlaubt: false, grund: "Knoten ohne Hackertrag (Faktor " + a.knotenFaktor + " <= " + HACKFAKTOR_MIN + ")" };
  }
  if (a.ertragProSek !== null && a.ertragProSek !== undefined) {
    const kerne = Math.max(1, a.kerne);
    const anteil = (1 / 16) / (1 + (kerne - 1) / 16);
    const gewinn = a.ertragProSek * anteil * KERN_HORIZONT_S;
    if (!(gewinn >= a.kernKosten)) {
      return { erlaubt: false, grund: "Ertrag zu klein: erwartet " + Math.round(a.ertragProSek)
        + " $/s -> hoechstens " + Math.round(gewinn) + " in " + (KERN_HORIZONT_S / 3600) + " h, Preis "
        + Math.round(a.kernKosten) };
    }
  }
  return { erlaubt: true, grund: "" };
}

export async function main(ns) {
  ns.disableLog("ALL");

  // WIEVIELE KERNE, UND WARUM NICHT ACHT. Die Kosten sind 1e9 * 7,5^Kerne
  // (CoresButton.tsx:31), verachtfachen sich also praktisch je Stufe.
  // Gemessen an einem Einkommen von rund 85 Mrd/s kostet:
  //   Kern 2-4  zusammen   0,49 Bio  ~6 Sekunden Einkommen  -> +18,8 %
  //   Kern 5-6  zusammen     27 Bio  ~5 Minuten             -> +31,3 %
  //   Kern 7                180 Bio  ~35 Minuten
  //   Kern 8               1340 Bio  ~4,4 Stunden
  // Dieselbe Summe als Spende gibt Betrag/1e6 * faction_rep * 0,75
  // Reputation - Kern 8 entspraeche rund 4,4 Mrd Reputation. Das ist kein
  // Wettbewerb. Bei sechs Kernen ist Schluss.
  const KERN_PREIS_DECKEL = 3e13;

  // Nur 1,2-facher Puffer statt des dreifachen wie beim Speicher: bn4rep
  // raeumt das Konto laufend fuer Augmentierungen leer - gemessen fiel es
  // binnen Minuten von 39,5 Bio auf 0,99 Mrd. Eine Bedingung, die das
  // Dreifache verlangt, trifft ein solches Konto nie. Der Kauf ist einmalig
  // und dauerhaft, die Wartezeit auf ein volles Konto nicht.
  const KERN_PUFFER = 1.2;

  const log = [];
  const sag = (t) => {
    log.push(new Date().toLocaleTimeString() + "  " + t);
    while (log.length > 40) log.shift();
    ns.write("data/homegrow.txt", log.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/homegrow.txt", "home", ns.getHostname());
  };

  // G50: Knotentabelle (undefined = noch nicht gelesen, null = unlesbar) und
  // Zeitpunkt der letzten Sperrmeldung, damit der Log nicht vollaeuft.
  let knotenTabelle;
  let letzteKernSperre = 0;

  sag("Ausbauwaechter laeuft auf " + ns.getHostname() + ".");

  for (let runde = 1; ; runde++) {
    try {
      // Was bn4rep fuer bereits VERDIENTE Augmentierungen zurueckgelegt hat,
      // ist tabu. Derselbe Kanal, den auch der Serverkauf und der
      // Programmkauf lesen.
      const ruecklage = ns.fileExists("data/geldbedarf.txt", "home")
        ? Number(liesVonHome(ns, "data/geldbedarf.txt")) || 0 : 0;
      const geld = ns.getServerMoneyAvailable("home") - ruecklage;

      // Die Lage des Kerns, EINMAL gelesen. Nur frische Zahlen: eine alte
      // Datei wuerde den Kauf entweder dauerhaft sperren oder dauerhaft
      // freigeben - beides falsch.
      let brachAnteil = 0;
      // BitNode 8 (10.11.2026): xpHomeKauf = home-RAM, fuer die der Kern den
      // Kauf freigibt (bn4net.js, Abschnitt 1a0), sonst 0; null = der Kern
      // meldet keinen Erfahrungsmodus oder ist nicht frisch.
      let xpFreigabe = null;
      // G50: Knoten, Stufe und erwarteter Hackertrag aus derselben frischen
      // Lagedatei. null = unbekannt, dann gilt fuer den Kernkauf die alte Regel.
      let lageKnoten = null, lageStufe = null, ertragProSek = null;
      try {
        const j = JSON.parse(liesVonHome(ns, "data/bn4net.json") || "{}");
        if (Date.now() - (j.zeit || 0) < 120000) {
          if (typeof j.brachAnteil === "number") brachAnteil = j.brachAnteil;
          if (j.xpModus === true) xpFreigabe = Number(j.xpHomeKauf) || 0;
          if (Number.isFinite(j.knoten)) lageKnoten = j.knoten;
          if (j.bnWerte && Number.isFinite(j.bnWerte.stufe)) lageStufe = j.bnWerte.stufe;
          ertragProSek = erwarteterHackertrag(j.stapel);
        }
      } catch { /* keine oder kaputte Datei: wie unbekannt behandeln */ }

      // --- Kerne zuerst -----------------------------------------------------
      // IM ERFAHRUNGSMODUS (BN8) ENTFALLEN KERNE: sie staerken die Sicherheits-
      // senkung je weaken-Faden (NetscriptFunctions.ts:288), nicht die
      // Erfahrung - die haengt nur an Fadenzahl und Aktionsdauer.
      // grow() und weaken() lesen die Kerne des AUSFUEHRENDEN Rechners
      // (NetscriptFunctions.ts:288), nicht die des Ziels. home traegt nach dem
      // Ausbau rund 98 Prozent aller Faeden - der Kernbonus (1 + (Kerne-1)/16)
      // wirkt damit praktisch auf das ganze Netz. Und er ist um Groessen
      // billiger als die naechste Speicherverdopplung, solange Speicher
      // brachliegt.
      const kerne = ns.getServer("home").cpuCores;
      if (kerne < 8 && xpFreigabe === null) {
        const kernKosten = ns.singularity.getUpgradeHomeCoresCost();
        if (kernKosten <= KERN_PREIS_DECKEL && geld > kernKosten * KERN_PUFFER) {
          // G50: die Preisregel oben ist unveraendert, hier kommt nur eine
          // zusaetzliche Sperre dazu. Die Tabelle wird je Prozess einmal
          // gelesen (20 KB, aendert sich im Knoten nicht).
          if (knotenTabelle === undefined && lageKnoten !== null) {
            try { knotenTabelle = JSON.parse(liesVonHome(ns, "lib/bitnodes.json") || "null"); }
            catch { knotenTabelle = null; }
          }
          const urteil = kernKaufErlaubt({
            kerne, kernKosten, ertragProSek,
            knotenFaktor: knotenHackFaktor(knotenTabelle || null, lageKnoten, lageStufe),
          });
          if (!urteil.erlaubt) {
            if (Date.now() - letzteKernSperre > 600000) {
              letzteKernSperre = Date.now();
              sag("Kern " + (kerne + 1) + " nicht gekauft: " + urteil.grund + ".");
            }
          } else if (ns.singularity.upgradeHomeCores()) {
            const neu = ns.getServer("home").cpuCores;
            sag("home-Kerne auf " + neu + " (grow/weaken jetzt x"
              + (1 + (neu - 1) / 16).toFixed(3) + ").");
          }
        }
      }

      // --- dann Speicher ----------------------------------------------------
      // AMORTISATION. Die letzten beiden Verdopplungen schlugen mit rund
      // 131 Bio zu Buche, das sind 167 Mio je GB. Ein Mietrechner kostet auf
      // derselben Sprosse 409.000 je GB - Faktor 409. Deshalb wird nur
      // gekauft, wenn der Speicher auch einen Abnehmer hat: liegt mehr als
      // ein Drittel des Netzes brach, wird nicht gekauft.
      const kosten = ns.singularity.getUpgradeHomeRamCost();
      if (xpFreigabe !== null) {
        // ERFAHRUNGSMODUS (BN8): kein Dreifach-Puffer, keine Brachbremse. Der
        // Kern hat die billigste Option gewaehlt und home freigegeben; hier
        // zaehlt nur noch, ob der WIRKLICHE Preis bezahlbar ist (geld ist schon
        // um geldbedarf.txt gekuerzt) und ob die Freigabe zum jetzigen Stand
        // gehoert - nach einem Kauf stimmt die alte Zahl nicht mehr, und ein
        // zweiter Kauf aus derselben Anweisung waere ein Doppelkauf. Brach ist
        // dort nie ein Grund: RAM wird im Ofen linear zu Erfahrung.
        if (xpFreigabe > 0 && xpFreigabe === ns.getServerMaxRam("home") && geld >= kosten) {
          if (ns.singularity.upgradeHomeRam()) {
            sag("home-Speicher verdoppelt auf " + ns.getServerMaxRam("home")
              + " GB (Erfahrungsmodus, " + (kosten / 1e6).toFixed(0) + "m).");
          }
        }
      } else if (geld > kosten * 3 && brachAnteil < 0.34) {
        if (ns.singularity.upgradeHomeRam()) {
          sag("home-Speicher verdoppelt auf " + ns.getServerMaxRam("home") + " GB.");
        }
      } else if (brachAnteil >= 0.34 && runde % 60 === 0) {
        sag("Speicherausbau ausgesetzt: " + Math.round(brachAnteil * 100)
          + " Prozent des Netzes liegen brach, mehr Speicher braucht niemand.");
      }
    } catch (e) {
      // Wie in bn4net.js: eine Ausnahme darf den Waechter nicht beenden.
      sag("RUNDENFEHLER: " + String(e));
    }
    await ns.sleep(10000);
  }
}
