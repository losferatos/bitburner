/**
 * Die entscheidungstragenden Formeln des Bots - als Code, nicht als Kopfrechnung.
 *
 * ===========================================================================
 * WARUM DIESE DATEI EXISTIERT
 * ===========================================================================
 *
 * Am 30.08.2026 waren an einem Tag VIER von vier eigenen Rechnungen falsch.
 * Jede einzeln plausibel, jede im Kopf gemacht, jede mit einer anderen Ursache:
 *
 *  1. Sequenzielle Mutation uebersehen. Zwei aufeinanderfolgende Aufrufe sahen
 *     aus wie eine Formel; der zweite las aber den vom ersten schon veraenderten
 *     Zustand.
 *  2. Additivitaet nicht geprueft. Zwei Abbauraten wurden als Alternativen
 *     gelesen, waren aber kumulativ - Faktor 3 statt 2.
 *  3. Aehnliche Feldnamen verwechselt. `strength_exp` geht linear in die Rate,
 *     `mults.strength` exponentiell in den Bedarf.
 *  4. Umgebungsmultiplikator vergessen. Rohe Basiskosten ohne die Faktoren des
 *     laufenden Knotens - Faktor 2 auf Reputation, 5 auf Geld.
 *
 * Die Lehre war nicht "sorgfaeltiger rechnen", sondern: **wer eine Formel aus
 * fremdem Quellcode anwendet, baut sie als ausfuehrbaren Code nach und eicht sie
 * gegen einen unabhaengig bekannten Wert.** Erst dann wird mit ihr argumentiert.
 *
 * Jede Funktion hier hat deshalb in tools/test-formeln.js einen Eichpunkt mit
 * einem Wert, der NICHT aus derselben Formel stammt. Ein Eichpunkt, der nicht
 * trifft, ist ein Befund - kein Rundungsfehler.
 *
 * Beim Bau des Kerns wandert diese Datei nach src/lib/. Bis dahin liegt sie
 * unter tools/, weil alles unter src/ binnen 400 ms ins laufende Spiel geht.
 */

// ---------------------------------------------------------------------------
// Fertigkeiten
// ---------------------------------------------------------------------------

/**
 * Stufe aus Erfahrung. `reference/v301/src/PersonObjects/formulas/skill.ts`
 *
 * Der Multiplikator ist das Produkt aus dem Aug-Multiplikator des Spielers und
 * dem LevelMultiplier des BitNode - beide, nicht einer. Genau hier entstand am
 * 30.08. der Fehler "Umgebungsmultiplikator vergessen".
 */
export function stufeAusExp(exp, mult = 1) {
  return Math.max(1, Math.floor(mult * (32 * Math.log(exp + 534.6) - 200)));
}

/** Die Umkehrung: wie viel Erfahrung kostet eine Stufe? */
export function expFuerStufe(stufe, mult = 1) {
  return Math.max(0, Math.exp((stufe / mult + 200) / 32) - 534.6);
}

/**
 * Fehlende Erfahrung bis zu einer Zielstufe - die Groesse, an der das
 * Bladeburner-Beitrittstor haengt (viermal Stufe 100).
 */
export function expLuecke(zielStufe, aktuelleExp, mult = 1) {
  return Math.max(0, expFuerStufe(zielStufe, mult) - aktuelleExp);
}

// ---------------------------------------------------------------------------
// Mietrechner
// ---------------------------------------------------------------------------

/**
 * Preis eines gekauften Servers.
 * `reference/v301/src/Server/ServerPurchases.ts`
 *
 * Der Softcap ist der Teil, den eine Kopfrechnung regelmaessig verliert: ab
 * 64 GB (2^6) waechst der Preis ueberproportional.
 */
export function serverPreis(ram, cloudServerCost = 1, softcap = 1) {
  const potenz = Math.max(0, Math.log2(ram) - 6);
  return ram * 55000 * cloudServerCost * Math.pow(softcap, potenz);
}

/**
 * Preis fuer home-RAM. `reference/v301/src/Server/ServerPurchases.ts`
 * Die Basis ist die ZAHL DER VERDOPPLUNGEN ab 8 GB, nicht die RAM-Menge.
 */
export function homeRamPreis(neuesRam, homeComputerRamCost = 1) {
  const stufen = Math.log2(neuesRam / 8);
  return 3.2e4 * Math.pow(1.58, stufen) * homeComputerRamCost;
}

// ---------------------------------------------------------------------------
// Sleeves und Gym
// ---------------------------------------------------------------------------

/**
 * Kosten des Gyms je Spielsekunde, mit Nachholbetrieb.
 *
 * DIE FALLE: Sleeves bauen einen Rueckstand mit 15-facher Geschwindigkeit ab
 * (`Sleeve.ts`), die Figur mit einfacher. Wer die Kosten als Rate rechnet,
 * unterschaetzt sie nach einer Offline-Nacht um genau diesen Faktor.
 * Acht Stunden verdeckter Tab sind 69,1 Mio je Koerper auf einen Schlag - die
 * alte Schwelle von 5 Mio deckte davon 67 Sekunden.
 */
export function gymKostenProSekunde(sleeves = 0, nachholFaktor = 1, preisProSekunde = 2400) {
  return preisProSekunde * (1 + sleeves * nachholFaktor);
}

/**
 * Erfahrungsrate im Gym, stationaer, in exp je Stunde.
 *
 * Der Spieler bekommt 10 exp/s mal seinem `strength_exp`-Multiplikator, jeder
 * Sleeve 2,5 exp/s bei Synchronisation 25.
 *
 * DIE FALLE (Auftrag 1.6): Eine Formulierung wie "63.400 ohne Sleeves" ist
 * rechnerisch unmoeglich - sie unterstellt dem Spieler gleichzeitig den
 * Multiplikator 1,262 und 1,0. Und jede Ableitung aus den kolportierten
 * "106.000 exp/h" ist ein Befund: dieser Wert war Nachholbetrieb, kein
 * stationaerer Zustand.
 */
export function gymRateProStunde(expMult = 1, sleeves = 0, hashGymStufen = 0) {
  const proSekunde = 10 * expMult + sleeves * 2.5;
  return proSekunde * 3600 * (1 + 0.2 * hashGymStufen);
}

/**
 * Zeit bis zum Bladeburner-Beitrittstor: vier Kampfwerte auf Stufe 100.
 * Gibt Stunden zurueck.
 */
export function torZeitStunden(expJeWert, expMult = 1, sleeves = 0, hashGymStufen = 0) {
  const rate = gymRateProStunde(expMult, sleeves, hashGymStufen);
  return (4 * expJeWert) / rate;
}

// ---------------------------------------------------------------------------
// Augmentierungen
// ---------------------------------------------------------------------------

/**
 * Preis der k-ten in derselben Runde gekauften Augmentierung.
 * `reference/v301/src/Augmentation/AugmentationHelpers.ts`
 *
 * DIE FALLE: Der PREIS skaliert mit 1,9^k, die REPUTATIONSHUERDE NICHT.
 * Wer beide skaliert, kauft in der falschen Reihenfolge.
 */
export function augPreis(basisPreis, k, augMoneyCost = 1) {
  return basisPreis * Math.pow(1.9, k) * augMoneyCost;
}

// ---------------------------------------------------------------------------
// Faktionen
// ---------------------------------------------------------------------------

/**
 * Kumulierte Reputation fuer einen Favor-Wert.
 * `reference/v301/src/Faction/formulas/favor.ts`
 */
export function repFuerFavor(favor) {
  // favor waechst mit 1,02^n; die Umkehrung der Reihe.
  const BASIS = 500;
  const RATE = 1.02;
  return (BASIS * (Math.pow(RATE, favor) - 1)) / (RATE - 1);
}

/**
 * Reputation aus einer Spende.
 * `reference/v301/src/Faction/formulas/donation.ts`
 */
export function repAusSpende(betrag, faction_rep_mult = 1, factionWorkRepGain = 1) {
  return (betrag / 1e6) * faction_rep_mult * factionWorkRepGain;
}

// ---------------------------------------------------------------------------
// Hacknet
// ---------------------------------------------------------------------------

/**
 * Hash-Rate eines Hacknet-SERVERS.
 * `reference/v301/src/Hacknet/formulas/HacknetServers.ts:4-16`
 *
 *   baseGain      = HashesPerLevel (0,001) * level
 *   ramMultiplier = 1,07^log2(maxRam)
 *   coreMultiplier= 1 + (cores - 1) / 5
 *   ramRatio      = 1 - ramUsed / maxRam
 *   Ergebnis      = baseGain * ramMultiplier * coreMultiplier * ramRatio
 *                   * mult * HacknetNodeMoney des Knotens
 *
 * EIGENER FEHLER, GEFUNDEN VOM EICHTEST 04.09.2026: Hier stand zuerst
 * `(kerne + 5) / 6`. Das ist die Formel fuer Hacknet-NODES, nicht fuer Server -
 * zwei Mechaniken mit fast gleichen Namen und unterschiedlicher Kernformel.
 * Genau die Fehlerart "aehnliche Feldnamen verwechselt" vom 30.08.2026.
 * Bei einem Kern liefern beide zufaellig dasselbe (1,0), der Fehler waere im
 * Normalbetrieb also erst bei einem ausgebauten Server aufgefallen.
 *
 * Ein frischer Server hat level 1, maxRam 1, cores 1 (HacknetServer.ts:33-61)
 * und liefert damit 0,001 Hashes/s mal dem Knotenfaktor - nicht 0,28.
 * Die 0,28 aus Auftrag 8.1 beschreiben einen AUSGEBAUTEN Server mit Level 100
 * und 10 Kernen, nicht den Zustand nach der Freischaltung.
 */
export function hashRate(level, maxRam, cores, ramUsed = 0, mult = 1, hacknetNodeMoney = 1) {
  const baseGain = 0.001 * level;
  const ramMultiplier = Math.pow(1.07, Math.log2(maxRam));
  const coreMultiplier = 1 + (cores - 1) / 5;
  const ramRatio = 1 - ramUsed / maxRam;
  return baseGain * ramMultiplier * coreMultiplier * ramRatio * mult * hacknetNodeMoney;
}

// ---------------------------------------------------------------------------
// Bladeburner
// ---------------------------------------------------------------------------

/**
 * Ranggewinn einer Aktion.
 * `reference/v301/src/Bladeburner/Formulas.ts`
 *
 * DIE FALLE, die am 04.09.2026 eine ETA um Faktor 208 verfehlen liess:
 * Der SPIELERRANG kommt hier NICHT vor. Was skaliert, ist die AKTIONSSTUFE
 * ueber rewardFac^(level-1), und der Knotenfaktor BladeburnerRank ist eine
 * Konstante des BitNode (BN10: 0,8), kein Wachstumstreiber.
 * Deshalb waechst die Rangrate im Lauf um Faktor 5.000, und deshalb ist jede
 * lineare Fortschreibung einer im Anlauf gemessenen Rate falsch.
 */
export function rangGewinn(baseReward, level, rewardFac, bitNodeRankMult = 1) {
  return baseReward * Math.pow(rewardFac, level - 1) * bitNodeRankMult;
}

/**
 * Kosten des naechsten Bladeburner-Fertigkeitspunkts.
 * `reference/v301/src/Bladeburner/Skill.ts`
 */
export function skillKosten(baseCost, aktuellesLevel, costInc, bitNodeSkillCost = 1) {
  return Math.floor(baseCost * Math.pow(costInc, aktuellesLevel) * bitNodeSkillCost);
}

// ---------------------------------------------------------------------------
// Hacking
// ---------------------------------------------------------------------------

/**
 * Hacking-Erfahrung je Faden und Vorgang.
 * `reference/v301/src/Hacking.ts`
 */
export function hackExpProFaden(baseDifficulty, hacking_exp_mult = 1, hackExpGain = 1) {
  return (3 + 0.3 * baseDifficulty) * hacking_exp_mult * hackExpGain;
}
