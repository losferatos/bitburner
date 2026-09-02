# Skeptiker C/D: hashes.js, Zahlenkorrekturen, Auftragskanal (02.09.2026, 18:28-18:52)

Alle Zahlen sind aus reference/v301/src nachgerechnet (node -e), nicht geschaetzt.
Live gelesen: data/hashes.json (server 0, aktiv false; laeuft auf werk-0 in BN10 L2).

### 1. bn4net legt Arbeiter auf den Hacknet-Server und drueckt die Hash-Rate auf null
Schwere: KRITISCH
Beleg: PlayerObjectServerMethods.ts:57-59 haengt `hacknet-server-N` mit adminRights an
home.serversOnNetwork - scan sieht ihn, hasRootAccess ist true. bn4net.js:387
`hosts = scanAll()`; das Wort "hacknet" kommt in bn4net.js nur in Kommentaren vor
(Z. 278-279) - kein Filter, weder bei der Arbeiterverteilung noch bei der
Werkbankwahl. HacknetServers.ts:14 `ramRatio = 1 - ramUsed/maxRam`,
HacknetServer.ts:116-119 rechnet die Rate bei jeder RAM-Belegung neu.
Was passiert: Mit 1 GB passt kein Arbeiter. hashes.js kauft in BN9 aber als
ERSTES RAM (Befund 4: Level 101 = 6,89 Mrd, Kern 11 = 51,6 Mio, RAM 1->2 GB = 200k,
die 2-%-Regel trifft also nur RAM) - nach 143 s 2 GB, binnen einer Stunde 8-16 GB.
Ab 2 GB passt ein Arbeiter, bn4net fuellt den Server. Gerechnet fuer den
exit.js-Fall: 1024 GB, 1000 GB belegt -> 3.227 $/s statt 137.701 $/s (Faktor 43).
Die einzige Geldquelle des Knotens bricht weg, und der fuer exit.js gekaufte
Platz ist von Arbeitern belegt (ausgang.js raeumt nur im Sprungmoment, Z. 300-306).
Fix: In bn4net Hosts mit Praefix `hacknet-server-` von Arbeitern, Werkbank und
Ausbau ausnehmen (eine Zeile im scanAll-Filter). Erst dann darf hashes.js RAM kaufen.

### 2. hashes.js kauft nie den ersten Server - und nach einem Augmentierungs-Einbau gibt es in BN9 keinen
Schwere: KRITISCH
Beleg: hashes.js:69-73 `if (!(kapazitaet > 0)) { ...; continue; }` steht VOR dem
Kaufzweig Z. 112-115. Ohne Server ist hashCapacity() 0 (Hacknet.ts:183-187,
Player.hashManager.capacity = Summe der Server). Der Gratis-Server entsteht nur in
prestigeSourceFile (Prestige.ts:203, 338-347); createHacknetServer wird in
Prestige.ts an keiner anderen Stelle gerufen - prestigeAugmentation (Z. 55) legt
keinen an. bn4rep.js baut Augmentierungen ein (bn4net.js-Kommentar "Ohne bn4rep
gibt es keine Augmentierungen"; sleeve.js "Aug-Reset von 17:35").
Was passiert: Nach dem ersten Einbau in BN9 ist der Server weg, hashCapacity 0,
hashes.js schlaeft in 5-min-Takten und erreicht den Kaufzweig nie - unabhaengig
vom Kontostand. Uebrig bleibt Hacking mit 0,35-3,5 $/s (Audit D). Das ist der
echte Totalstillstand in BN9, nicht der fehlende Verkauf (Befund 3). Dasselbe gilt
mit SF9.3 in jedem Knoten nach dem ersten Einbau.
Fix: Server-Modus an `ns.hacknet.maxNumNodes() === 20` erkennen (Hacknet.ts:57-62:
20 bei Servern, Infinity bei Knoten). Bei n === 0 den ersten Server ohne 5-%-Regel
kaufen (50.000 $, calculateServerCost; Reserve klein halten). Zusaetzlich: bn4rep
in BN9 nicht einbauen, solange der Gratis-Server die einzige Einnahme ist - oder
den Rueckkauf sofort nach dem Einbau vorsehen.

### 3. Die Verkaufs-Praemisse ist falsch: Ueberlauf wird vom Spiel selbst verkauft
Schwere: MITTEL
Beleg: HacknetHelpers.tsx:419-429: `wastedHashes = storeHashes(hashes)`; wenn > 0,
`Player.gainMoney(1e6 * wastedHashes / 4, "hacknet")`. Kapazitaet des Gratis-Servers
32 * 2^5 = 1024 (HacknetServer.ts:122, cache 5), Rate 0,001*100 * 1,07^0 * 2,8 =
0,28 Hashes/s (HacknetNodeMoney in case 9 nicht gesetzt = 1) -> voll nach 3.657 s.
Was passiert: Ab Minute 61 fliessen die 70.000 $/s auch ohne hashes.js. "Kapazitaet
erreicht = Rate verloren" gilt in v3.0.1 nicht; Audit D ("kein Skript verkauft
Hashes -> Totalstillstand") begruendet den Umbau mit einer falschen Ursache. Der
Verkauf schadet nicht (Geld 61 min frueher), aber er frisst jeden Hash - fuer
"Exchange for Bladeburner Rank"/"Improve Gym Training" bleibt nichts, und der
Bladeburner ist laut Roadmap der Traeger. Der 10-s-Takt hat Faktor 360 Reserve.
Fix: Kopfkommentar und Audit D korrigieren; entscheiden, ob Hashes in V2-Knoten in
Rang statt Geld gehen. Kein Codebruch.

### 4. Ausbau-Reihenfolge und Kommentar stimmen nicht: RAM ist das Billigste, Level unbezahlbar
Schwere: MITTEL
Beleg: HacknetServers.ts:19-38 Level = 10*50k*1,1^L: Level 101 auf dem Gratis-
Server 6,89 Mrd (2-%-Regel: 345 Mrd Konto). Kern 11 = 1e6*1,55^9 = 51,6 Mio (2,6 Mrd
Konto). RAM 1->2 GB = 200k (10 Mio Konto), Ertrag +7 % = 4.900 $/s, Amortisation
41 s. Neuer Server: Level 2 = 550k, RAM 2 GB = 200k. Kommentar hashes.js:36-38
"Level ist am billigsten" ist fuer beide Faelle falsch.
Was passiert: Kein Bruch - die Schleife faellt je Server auf RAM durch und kauft
das Richtige. Aber genau die RAM-Kaeufe loesen Befund 1 aus; und die 2-%-Regel
haelt in BN9 (70k $/s) die Kernkaeufe bis 2,6 Mrd Konto = 10 h zurueck, obwohl
Kern 11 sich in 2,9 h amortisiert (+5.000 $/s). RAM-Kette 1->1024 GB fuer exit.js:
3,29 Mrd gesamt, letzte Stufe 2,12 Mrd; mit `kosten*2 <= geld` braucht es 4,2 Mrd
auf dem Konto = 9 h bei 129k $/s (Rate bei 512 GB).
Fix: Reihenfolge RAM, Kern, Level; Kommentar korrigieren; Schwelle fuer Kerne an
der Amortisation statt an 2 % ausrichten.

### 5. Mit SF9.3 in spaeteren Knoten: hashes.js zieht 17-81 % des Einkommenszuwachses in Hacknet-Stufen ohne Rueckfluss
Schwere: HOCH
Beleg: Kaufregel "eine Stufe je 10 s, wenn Preis <= 2 % Konto". Level-Preis
waechst 1,1x je Kauf, Konto faellt 2 % - naechster Kauf, sobald das Konto um
2 % + Leiterabstand gewachsen ist; Abstand = 10 %/Serverzahl. Anteil am Zuwachs
= 2/(2+Abstand): 1 Server 17 %, 5 Server 51 %, 10 Server 68 %, 20 Server 81 %
(Kerne, RAM, neue Server kommen obendrauf). Ertrag je Level bei 10 Kernen/1 GB:
0,0028 Hashes/s = 700 $/s; Level 101 kostet 6,89 Mrd -> Amortisation 114 Tage.
Was passiert: Sobald ein Server existiert (SF9.3 liefert ihn bei jedem Knoten-
eintritt, Prestige.ts:338), laeuft hashes.js in JEDEM Knoten aktiv und wandelt
einen grossen Teil des Geldwachstums in Hacknet-Level, die nie zurueckzahlen -
waehrend Hacking dort 10^6-10^9 $/s bringt und 250.000 $/Hash nichts ist. Das
laeuft unbeaufsichtigt ueber die Laeufe 11-45 der Route. Heute (BN10, kein SF9)
schlaeft es; Befund 2 (Gate) verhindert den Serverkauf dort zufaellig mit.
Fix: Ausbau nur in BitNode 9 (`ns.getResetInfo().currentNode === 9`), sonst nur
Verkauf/Wirt-Zweig; oder Ausbau an Amortisation <= Restlaufzeit binden.

### 6. bn4life-Wiederholung: "30 Runden" sind 30 Sekunden, kein Raeumen - der wakelock-Fall bleibt offen
Schwere: HOCH
Beleg: bn4life.js:408 `await ns.sleep(1000)` - Rundentakt 1 s. Block 2b (Z. 271-311)
raeumt keine Arbeiter; bn4net liest nur bei `!lifeLaeuft` (bn4net.js:463-467), also
nur wenn bn4life tot oder > 5 min ohne Telemetrie ist. Kommentar bn4net.js:520-522
verspricht "bis zu 30 Runden (5 min)".
Was passiert: Im Regelfall (bn4life lebt) wird ein Auftrag ohne Platz 30-mal im
Sekundentakt per exec versucht und nach 30 s verworfen. In 30 s aendert sich am
Netz nichts - der Auftrag geht genauso verloren wie heute wakelock.js. Die
Wiederholung wirkt nur in der Ausnahme (bn4life tot).
Fix: Zaehler zeitbasiert (z. B. 5 min ab erstem Fehlversuch) statt rundenbasiert,
und bn4life raeumt Arbeiter wie bn4net Z. 498-509 - oder bn4life laesst Auftraege
ohne Platz ausdruecklich an bn4net (task.txt liegen lassen + Markierung).

### 7. bn4net-Wiederholung raeumt 30-mal den groessten Rechner leer, wenn der Auftrag nie passt
Schwere: MITTEL
Beleg: bn4net.js:498-509 killt WORKER auf `wirt` bis frei >= braucht - bei 848 GB
(bn4rep) auf jedem Rechner < 848 GB werden ALLE Arbeiter des groessten Rechners
gekillt, exec liefert 0, Auftrag wird zurueckgeschrieben (Z. 526), bn4net legt
in derselben Runde Arbeiter nach, 10 s spaeter dasselbe. Zaehler in einer Map im
Prozess: Neustart von bn4net = weitere 30; bei abwechselnden Lesern (bn4life lebt,
Telemetrie aber > 5 min alt - gedrosselter Tab) zwei getrennte Zaehler = 60.
Was passiert: 5 min lang alle 10 s ein Voll-Reset des groessten Rechners, jeder
laufende hack/grow/weaken-Lauf dort verfaellt. Kein Netz-Stillstand, aber der
beste Rechner ist 5 min lang wertlos - je bn4net-Neustart erneut.
Doppelstart: ausgeschlossen. Lesen, Leeren, exec und Zurueckschreiben laufen ohne
`await` in einem Skriptaufruf (bn4net.js:468-528, bn4life.js:272-311); Netscript-
Skripte laufen kooperativ. Zurueckgeschrieben wird nur bei pid 0.
Fix: Vor dem Raeumen pruefen, ob `braucht` ueberhaupt auf den groessten Rechner
passt (`getServerMaxRam(wirt) - Sockel >= braucht`), sonst sofort verwerfen und
`werkzeugWartetGb` setzen - der neue Ausbauzweig (Z. 745-790) kuemmert sich dann.

### 8. getBitNodeMultipliers wirft ohne SF5 - blade.js faellt still auf 1 zurueck, checkin.js nicht
Schwere: NIEDRIG
Beleg: NetscriptFunctions.ts:916-918 `if (!canAccessBitNodeFeature(5)) throw`.
blade.js:600 faengt und setzt BN_MULT = {} -> BB_RANK_MULT 1, lvlMult 1; checkin.js
rechnet mit eigener Tabelle 0,8. bn4rep.js faellt auf WD_DIFFICULTY zurueck (ok).
Was passiert: Nur ohne SF5 - der Bot war in BN5 und hat es verlassen, SF5.1 ist
also da; die Annahme steht aber nirgends. Zusatz: blade.js waechst um 4 GB (174 ->
178), bn4rep um 4 (auf 848+).
Fix: Einmal beim Start loggen, welcher Faktor gilt; Kommentar "braucht SF5".

### 9. BN12 fehlt in BB_RANK_MULT (checkin.js)
Schwere: NIEDRIG
Beleg: BitNode.tsx:924-926, 984: BladeburnerRank = 1/1,02^Stufe (0,98 / 0,96 /
0,94). Tabelle checkin.js:53 hat keinen Eintrag -> 1.
Was passiert: Restweg in BN12 um 1.470-4.400 Rang zu klein (2-6 % von 73.660).
Fix: `12: 1/Math.pow(1.02, level)` mit der gespielten Stufe.

## Tragfaehig
- Signaturen: spendHashes(upgName, upgTarget="", count=1), hashCost(upgName,
  count=1), getNodeStats(i).ram = maxRam bei Servern (Hacknet.ts:80), .name =
  hostname, upgradeRam(i,n), getRamUpgradeCost(i,n), purchaseNode() -> -1 bei
  Fehlschlag, maxNumNodes() 20. Ohne Server: hashCapacity/numHashes 0, hashCost
  Infinity, spendHashes false - nichts wirft. getNodeStats(0) wuerde bei n = 0
  werfen (Z. 29-31), ist durch `n > 0` abgesichert. Alle Hacknet-Aufrufe 0,5 GB
  (RamCostGenerator.ts:38); hashes.js ~10 GB (15 Funktionen + scp 0,6), nicht
  4 GB wie in Audit D.
- "Sell for Money" ist konstant 4 Hashes: HashUpgrade.ts:73-75 `cost` ueberschreibt
  costPerLevel; das Level zaehlt hoch, ohne den Preis zu aendern.
- Gratis-Server: Level 100, 10 Kerne, Cache 5 (Prestige.ts:341-344) -> 0,28
  Hashes/s = 70.000 $/s, Kapazitaet 1024, voll nach 61 min. RAM-Ausbau senkt die
  Rate nicht, +7 % je Verdopplung; nur ramUsed drueckt (Befund 1). Hacknet-Server
  sind in ns.scan("home") sichtbar -> ausgang.js findet sie als Wirt.
- BB_RANK_MULT-Tabelle gegen BitNode.tsx: case 7 (728)->756 0,6; case 8 (770)->790 0;
  case 9 (801)->830 0,9; case 10 (844)->876 0,8; case 13 (996)->1031 0,45; case 14
  (1044)->1076 0,6; case 15 (1089)->1112 0,2. Stimmt (BN12: Befund 9).
- rankLoss skaliert nicht (Formulas.ts:31-42), rankGain ja (:22-26); e.rankGain
  kommt aus der statischen Tabelle blade.js:1716ff (Rohwerte) - keine
  Doppelanwendung. `stern` ist richtig; in BN8 (0) wird 0,95, harmlos.
- Hyperdrive: Person.ts:94 `mults.defense * DefenseLevelMultiplier` - lvlMult ist
  die richtige Groesse. competence gewichtet alle 7 Stats gleich mit Exponent 0,9
  (Action.ts:43-60); Hyperdrive hebt ExpGain aller Stats, die Defense-Naeherung
  ist repraesentativ, solange die Stats aehnlich hoch sind.
- sleeve.json: sleeve.js:372-376 schreibt `sleeves[].stored`; checkin.js:124-130
  liest genau das, teilt durch 5 (Sleeve.ts:264: 5 Zyklen/s). Schwelle 1800 s =
  30 min Rueckstand; Abbau 15 Zyklen je 200-ms-Tick minus 1 Zugang = 70 Zyklen/s,
  8 h Rueckstand in 34 min weg. Nicht dauerhaft: Punkt wird trotzdem geschrieben
  (checkin.js:479-482), `vorher` rueckt vor, das Nachhol-Intervall faellt raus.
  Telemetrie > 10 min alt -> 0 (Spiel zu).
- bn4rep: getBitNodeMultipliers() ohne Argumente nimmt lvl = activeSourceFileLvl+1
  (NetscriptFunctions.ts:916), identisch mit BitNode.tsx:1130 -> BN12 inc korrekt
  skaliert.
- Wettlauf im Auftragskanal: kein Doppelstart moeglich (Befund 7).

## Nicht geprueft
- Ob prestigeAugmentation das Geld auf den Startwert setzt (aus dem Gedaechtnis,
  nicht nachgelesen) - fuer Befund 2 zweitrangig, das Gate greift ohnehin.
- RAM von blade.js (178 GB) gegen die realen Werkbankgroessen - offline nicht messbar.
- joinrun.js/bbtrain.js-Geldboden (nicht mein Winkel).
- bn4net-Arbeiterverteilung im Detail (Mindest-RAM je Host) - Befund 1 stuetzt sich
  auf scanAll() ohne Filter und hasRootAccess = adminRights.
