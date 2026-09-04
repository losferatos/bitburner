/**
 * entwurf/augs/buyaugs.js — Augmentations optimal einkaufen, ohne Hand am Knopf.
 *
 * AUFRUF (der Autopilot sucht sich einen Rechner mit genug Speicher):
 *
 *   node tools/task.js buyaugs.js --dry
 *   node tools/task.js buyaugs.js --max 3
 *   node tools/task.js buyaugs.js --reserve 45e9 --max 2
 *
 * Der Bericht landet zeilenweise in data/augs.txt auf home.
 *
 * ============================================================================
 * 1. DIE ZIELFUNKTION — UND WARUM SIE SO AUSSIEHT
 * ============================================================================
 *
 * Beim Installieren faellt das Guthaben auf 1000 + CONSTANTS.Donations = 1262
 * (PlayerObjectGeneralMethods.ts:102, Constants.ts:107); dazu kommt nur noch
 * das startingMoney installierter Augs (Prestige.ts:84-91). Gekaufte Server
 * werden geloescht (Prestige.ts:74 prestigeAllServers). Was ueberlebt, sind
 * die installierten Augmentations, der home-Rechner mit RAM und Kernen
 * (ServerHelpers.ts:226-260 fasst weder maxRam noch cpuCores an) und die
 * Faktions-Reputation. Alles andere Geld ist beim Reset verbrannt.
 *
 * Damit ist dieser Automat NICHT der einzige Anwaerter auf das Guthaben. Es
 * gibt weitere Senken, die den Reset ueberleben und die er selbst nicht
 * kaufen kann:
 *   - home-RAM (PlayerObjectServerMethods.ts:30-40) und home-Kerne (:42-44),
 *   - der Boersenzugang: hasWseAccount, hasTixApiAccess und has4SData werden
 *     nur in prestigeSourceFile zurueckgesetzt, nicht beim Augmentieren
 *     (PlayerObjectGeneralMethods.ts:163-166).
 * Was dagegen mitstirbt und beim Vergleich oft vergessen wird: alle Programme
 * auf home ausser NUKE (ServerHelpers.ts:229-236), damit auch der TOR-Anschluss
 * (serversOnNetwork wird geleert, :230), die Hacknet-Knoten
 * (PlayerObjectGeneralMethods.ts:130) und jede Faktionsmitgliedschaft (:111) —
 * die REPUTATION und der Favor bleiben aber.
 *
 * Dieser Automat bewertet ausdruecklich NUR Augmentations gegeneinander. Damit
 * der Vergleich nach aussen trotzdem moeglich ist, gibt er zu jedem geplanten
 * Kauf den Nutzen JE MILLIARDE aus und vergleicht ihn mit einem Massstab
 * (YARDSTICK unten). Faellt der Plan darunter, sagt er das laut. Wer Geld
 * fuer home-RAM freihalten will, benutzt --reserve.
 *
 * Bewertet wird jeder moegliche Kauf mit
 *
 *   score(aug) = DISTINCT_BONUS * [aug ist eine NEUE verschiedene Aug]
 *              + Summe_k  w_k * ln(mult_k)
 *
 * Drei Entscheidungen stecken darin, und jede hat einen Grund:
 *
 * (a) LOGARITHMUS auf den Multiplikatoren. Augmentations multiplizieren
 *     (mergeMultipliers, AugmentationHelpers.ts:43). Zwei Kaeufe hintereinander
 *     ergeben das Produkt ihrer Faktoren; im Logarithmus wird daraus eine
 *     Summe. Nur so darf man Kaeufe ueberhaupt addieren — und nur so ist eine
 *     NeuroFlux-Stufe (+1% auf zwanzig Felder) mit einer grossen Aug
 *     (+15% auf drei Felder) auf derselben Skala vergleichbar.
 *
 * (b) GEWICHTE w_k. Nicht jeder Multiplikator ist gleich viel wert. Der Bot
 *     lebt von HWGW-Batches, also wiegen hacking_money und hacking_speed am
 *     schwersten; faction_rep wiegt schwer, weil Reputation das eigentliche
 *     Nadeloehr fuer alle weiteren Augs ist; Kampfwerte und Hacknet wiegen
 *     fast nichts, weil sie in BN1 fuer diesen Bot nichts tun. Die Gewichte
 *     stehen unten in WEIGHTS und sind ueber --weight aenderbar.
 *
 * (c) DISTINCT_BONUS. Daedalus verlangt 30 Augmentations
 *     (FactionJoinCondition.ts:116-131: `p.augmentations.length >= n`), und
 *     dort zaehlt NeuroFlux Governor GENAU EINMAL, egal wie viele Stufen —
 *     applyAugmentation setzt bei einem schon vorhandenen NFG nur die Stufe
 *     hoch und kehrt zurueck, ohne einen zweiten Eintrag anzulegen
 *     (AugmentationHelpers.ts:55-59). Daedalus fuehrt ueber The Red Pill zum
 *     Ausgang aus dem BitNode; das ist mehr wert als jeder Multiplikator.
 *     Erreichbar ist es aber erst in einigen Durchlaeufen, deshalb wird die
 *     Aussicht abgezinst: DISTINCT_BONUS = 0.15 entspricht ungefaehr dem
 *     Multiplikatorwert einer durchschnittlichen guten Hacking-Aug
 *     (+12% hacking, +10% hacking_exp ~ 0.19). Eine verschiedene Aug ist
 *     damit ungefaehr doppelt so viel wert wie ihre nackten Zahlen — genug,
 *     damit sie eine gleich teure NeuroFlux-Stufe schlaegt, aber nicht so
 *     viel, dass eine wertlose Aug eine starke verdraengt.
 *
 * Das Ziel ist ausdruecklich NICHT "moeglichst viele Kaeufe". Die
 * Nebenbedingung ist das Guthaben, und der Preis eines Kaufs haengt davon ab,
 * wie viele Kaeufe vor ihm liegen — siehe naechster Abschnitt.
 *
 * ============================================================================
 * 2. WARUM DIE REIHENFOLGE UEBER ALLES ENTSCHEIDET
 * ============================================================================
 *
 * getGenericAugmentationPriceMultiplier() = 1.9 ^ (Anzahl wartender
 * Nicht-SoA-Augs) (AugmentationHelpers.ts:29-37, Constants.ts:41
 * MultipleAugMultiplier = 1.9; der Basisfaktor waere ohne Source File 11
 * exakt 1.9, weil `[1, 0.96, 0.94, 0.93][0]` = 1 ist). Der Faktor gilt fuer
 * das GELD, nicht fuer die Reputation: getAugCost setzt repCost ausser bei
 * NeuroFlux und den SoA-Augs allein aus baseRepRequirement mal
 * currentNodeMults.AugmentationRepCost zusammen (AugmentationHelpers.ts:157-158,
 * in BN1 ist der Faktor 1 — BitNodeMultipliers.ts:16). Nachgeprueft, es
 * stimmt: Reputation wird durch Kaufen nicht teurer.
 *
 * Zwei Ausnahmen von dieser Regel, beide hier nicht wirksam: NeuroFlux zieht
 * die Reputation mit 1.14^Stufe hoch (AugmentationHelpers.ts:135), und die
 * SoA-Augs skalieren ihre Reputation mit 1.3^(bereits besessene SoA-Augs) und
 * ignorieren AugmentationRepCost ganz (:150-152). SoA-Augs kauft dieser
 * Automat nicht, siehe SOA_AUGS.
 *
 * Daraus folgt die Reihenfolgeregel. Kauft man eine feste Auswahl von k Augs,
 * kostet die Aug an Rang i genau  base_i * g * 1.9^i  mit g = Faktor zu
 * Beginn. Die Summe  Sum base_(sigma(i)) * 1.9^i  ist nach der
 * Umordnungsungleichung minimal, wenn die groesste Grundzahl auf den
 * kleinsten Faktor 1.9^0 trifft: TEUERSTE ZUERST. Der Planer unten sortiert
 * deshalb absteigend nach Grundpreis und rechnet die Raenge exakt so.
 *
 * NeuroFlux Governor ist der Sonderfall. Sein Preis ist
 * base * 1.14^Stufe * genericMultiplier (AugmentationHelpers.ts:133-138,
 * Constants.ts:36 NeuroFluxGovernorLevelMult = 1.14), und weil er selbst als
 * wartende Nicht-SoA-Aug zaehlt, hebt jeder NFG-Kauf den generischen Faktor
 * mit an. Jede weitere Stufe kostet also das 1.9 * 1.14 = 2.166-fache der
 * vorigen. Dafuer gibt es pro Stufe nur +1.000262% je Multiplikator
 * (Augmentations.ts:1170-1195 `1.01 + donationBonus`, donationBonus =
 * CONSTANTS.Donations/1e6/100 = 2.62e-6) — NICHT +14%, die 1.14 sind der
 * PREIS. Der Planer behandelt jede erreichbare NFG-Stufe als eigenen
 * Kandidaten mit eigener Grundzahl und sortiert sie mit ein.
 *
 * Genau hier lag der Fehler des bisherigen Verwalters: achtmal NeuroFlux
 * hintereinander ist der teuerstmoegliche Weg zu einem einzigen zusaetzlichen
 * Eintrag in Player.augmentations.
 *
 * Voraussetzungen (prereqs) muessen vor der abhaengigen Aug in der
 * Warteschlange stehen, aber nur GEKAUFT, nicht installiert:
 * hasAugmentationPrereqs prueft Player.hasAugmentation(req)
 * (FactionHelpers.tsx:56-58), und das zaehlt wartende Augs mit
 * (Person.ts:233-241, ignoreQueued ist standardmaessig false). Weil eine
 * Voraussetzung fast immer billiger ist als ihre Folgeaug, kollidiert das mit
 * "teuerste zuerst" — CyberSec ist das Lehrbuchbeispiel: Cranial Signal
 * Processors Gen I ($70 Mio) muss vor Gen II ($125 Mio) stehen.
 *
 * Dieselbe Kollision gibt es bei NeuroFlux: die Grundzahlen der Stufen
 * STEIGEN mit der Stufe, gekauft werden muessen sie aber aufsteigend. Die
 * Umordnungsungleichung gilt also nur unter diesen beiden Zwaengen. Der
 * Planer waehlt deshalb erst die MENGE (dabei rechnet er mit der
 * unbeschraenkten absteigenden Reihenfolge, was die Kosten nie ueberschaetzt),
 * bringt sie dann durch eine stabile topologische Reparatur in eine
 * zulaessige Reihenfolge und rechnet die Summe danach EXAKT nach. Passt sie
 * nicht mehr ins Budget, wird die naechstbeste Auswahl genommen. Das kann in
 * seltenen Faellen unter dem Optimum bleiben; dafuer ist jede ausgegebene
 * Reihenfolge zulaessig und ihr Preis wirklich gerechnet, nicht geschaetzt.
 *
 * ============================================================================
 * 3. WARUM DER KAUF UEBER DIE OBERFLAECHE GEHT
 * ============================================================================
 *
 * ns.singularity.purchaseAugmentation braucht Source File 4 — haben wir
 * nicht. Der Weg ueber die Oberflaeche ist offen: der Kauf-Knopf prueft die
 * Echtheit des Klicks NICHT. Im ganzen Quelltext gibt es genau 14 Stellen mit
 * isTrusted, und keine davon liegt in Augmentation/ui/ oder in
 * Faction/ui/AugmentationsPage.tsx. Vollstaendig sind das:
 * Arcade/ui/BBCabinet.tsx:17, Casino/Blackjack.tsx:143, :160 und :241,
 * Casino/utils.ts:5, Exploits/Unclickable.tsx:11,
 * Faction/ui/FactionsRoot.tsx:89 (Join!), Infiltration/ui/InfiltrationRoot.tsx:74,
 * Locations/ui/CompanyLocation.tsx:62 und :71, Locations/ui/HospitalLocation.tsx:23,
 * Locations/ui/SlumsLocation.tsx:25, Programs/ui/ProgramsRoot.tsx:96 und :108.
 * (Ein 15. Treffer steht in Documentation/doc/en/changelog-v0.md:510 und ist
 * blosser Fliesstext.) Ein gewoehnlicher .click() genuegt hier also — anders
 * als beim Beitritt (siehe entwurf/join/join.js), der den Handler direkt
 * aufrufen muss.
 *
 * Der Kauf laeuft ueber zwei Knoepfe:
 *   1. "Buy" in der Zeile (PurchasableAugmentations.tsx:194-201). Er ist
 *      disabled, wenn canPurchase falsch ist — und canPurchase prueft
 *      Voraussetzungen, Reputation UND Geld (AugmentationsPage.tsx:240-248).
 *      Ein disabled-Knopf tut bei .click() nichts. Das ist unser bester
 *      Waechter: DAS SPIEL SELBST sagt uns, ob der Kauf gerade moeglich ist.
 *   2. Falls Settings.SuppressBuyAugmentationConfirmation aus ist, oeffnet
 *      sich erst ein Fenster mit dem Knopf "Purchase"
 *      (PurchaseAugmentationModal.tsx:38-47); dieser ruft
 *      purchaseAugmentation(faction, aug) auf. Ist die Einstellung an, kauft
 *      schon der erste Klick (AugmentationsPage.tsx:249-254).
 *   3. DANACH steht — bei derselben Einstellung — noch eine Meldung im Weg:
 *      purchaseAugmentation ruft nach dem gelungenen Kauf dialogBoxCreate
 *      auf ("You purchased ...", FactionHelpers.tsx:122-128). Die haengt als
 *      MUI-Modal mit Hintergrundschleier ueber der Seite. Sie kostet keinen
 *      Kauf, aber sie bleibt stehen und sammelt sich ueber mehrere Kaeufe an,
 *      und im naechsten Durchgang stuende ihr Text — mit dem Aug-Namen darin —
 *      mitten in unserer Fenstersuche. Deshalb wird nach JEDEM Kaufversuch
 *      aufgeraeumt: jedes Modal traegt oben rechts einen IconButton, dessen
 *      onClick unbedingt schliesst (Modal.tsx:95). Der Weg ueber die
 *      Esc-Taste ginge auch (AlertManager.tsx:39-48 prueft die Echtheit
 *      nicht), leert aber die GANZE Warteschlange an Meldungen — auch die,
 *      die ein Mensch noch lesen wollte.
 * Alle drei Schritte werden bedient, und der Erfolg wird am Zustand geprueft.
 *
 * ============================================================================
 * 4. WIE DER ERFOLG GEPRUEFT WIRD — NIE AM BILDSCHIRMTEXT
 * ============================================================================
 *
 * Das ist hier schwieriger als beim Beitritt, denn in v3.0.1 liefert
 * ns.getPlayer() WEDER augmentations NOCH queuedAugmentations
 * (NetscriptFunctions.ts:1371-1390 — die Rueckgabe ist abschliessend
 * aufgezaehlt). ns.getResetInfo().ownedAugs (:1444) liefert nur die
 * INSTALLIERTEN Augs samt Stufe, nicht die wartenden. Es gibt ohne SF4 also
 * keine ns-Funktion, die die Warteschlange sieht.
 *
 * Die Warteschlange selbst steht trotzdem offen — nur nicht ueber ns, sondern
 * ueber die Augmentierungsseite: PurchasedAugmentations.tsx laeuft ueber
 * Player.queuedAugmentations und legt je Eintrag ein
 * <ListItemText primary={name}> an (:56). Gelesen wird die React-Prop
 * `primary`, nicht der dargestellte Text. Das ist die einzige vollstaendige
 * Quelle: der DarkNet-Irrgarten legt Augs in die Warteschlange, die auf keiner
 * Faktionsseite stehen (DarkNet/effects/cacheFiles.ts ruft queueAugmentation
 * direkt auf, und die sechs Belohnungen haben `factions: []`), und wer die
 * Warteschlange aus den Faktionsseiten zusammenzaehlt, uebersieht sie.
 *
 * Der Zustand wird also aus drei unabhaengigen Quellen gelesen, von denen
 * keine ein Meldungstext ist:
 *
 *   (A) React-Props der Zeile. React 17 (package.json:42) legt die Props
 *       eines Host-Elements als gewoehnliche Eigenschaft "__reactProps$..."
 *       auf dem DOM-Knoten ab und aktualisiert sie bei jedem commitUpdate
 *       (react-dom 17.0.2, ReactDOMComponentTree.js updateFiberProps). Ueber
 *       den Fiber-Baum kommt man von jedem Kauf-Knopf zur Komponente
 *       PurchasableAugmentation und damit an ihre Props {parent, augName,
 *       owned} (PurchasableAugmentations.tsx:145-151). `owned` wird in
 *       AugmentationsPage.tsx:137-142 direkt aus Player.augmentations UND
 *       Player.queuedAugmentations berechnet — das ist ein Blick in die
 *       Warteschlange, nur ueber React statt ueber ns. `parent.rep` ist
 *       faction.playerReputation im Original (AugmentationsPage.tsx:257), also die exakte Zahl und
 *       nicht die gerundete Anzeige.
 *   (B) Die React-Props der Warteschlangenliste auf der Augmentierungsseite
 *       (siehe oben). Sie liefern q, und q geht als 1.9^q in jeden Preis ein.
 *   (C) ns.getServerMoneyAvailable("home") gibt exakt Player.money zurueck
 *       (NetscriptFunctions.ts:947-953). Ein Kauf senkt das Guthaben um genau
 *       den vorhergesagten Betrag.
 *
 * (A) und (B) beschreiben teilweise dasselbe und werden gegeneinander
 * geprueft: zeigt eine Faktionsseite eine Aug als gekauft, die weder
 * installiert ist noch in der Warteschlange steht, wird nicht gekauft.
 *
 * Ein Kauf gilt nur dann als geglueckt, wenn (A) umspringt UND (C) um den
 * vorhergesagten Betrag faellt — ZWEISEITIG geprueft. Die untere Schranke
 * (95% minus gemessenem Ertrag) faengt ein zu grosses q ab, die obere (150%)
 * ein zu kleines; die obere liegt unter 1.9, damit ein einziger uebersehener
 * Warteschlangeneintrag sicher auffaellt. Bei NeuroFlux springt (A) nicht um
 * (NFG bleibt immer kaufbar); dort tritt an seine Stelle, dass die Stufe in
 * der NFG-Zeile um genau 1 steigt. Diese Zahl steht als blosse Ganzzahl im
 * Titel (PurchasableAugmentations.tsx:230 `Level ${augLevel + 1}`), ohne
 * Zahlenformatierer und ohne Waehrung, und ist damit unabhaengig von
 * Settings.Locale und Settings.CurrencySymbol.
 *
 * Zweimal keine Wirkung -> Abbruch mit Grund. Eine Schleife, die stur
 * weiterklickt, hat diesem Projekt schon fuenf Stunden Stillstand gekostet.
 * Getrennt davon gezaehlt wird der Fall, dass die Seite waehrend der Pruefung
 * wegwandert (Nachtdienst, Mensch am Rechner): der Ausgang ist dann UNBEKANNT,
 * nicht gescheitert — die naechste Runde liest den Zustand neu. Auch das
 * bricht nach zweimal ab.
 *
 * ============================================================================
 * 5. WAS DIESER AUTOMAT NICHT TUT
 * ============================================================================
 *
 * - Er installiert NICHT und setzt NICHT zurueck. Er klickt grundsaetzlich
 *   keinen Knopf an, dessen Beschriftung "Install" enthaelt; der Reset ist
 *   Erics Entscheidung.
 * - Er glaubt keinem Bildschirmtext, um Erfolg festzustellen (siehe 4).
 * - Er raet nicht. Laesst sich der Zustand nicht eindeutig lesen, bricht er
 *   ab und sagt, was fehlte.
 * - --dry aendert keinen Spielzustand: kein Buy, kein Purchase, kein
 *   Entfokussieren laufender Arbeit. Er wechselt lediglich die angezeigte
 *   Seite, um Reputation und Angebot ueberhaupt lesen zu koennen, und kehrt
 *   danach zum Terminal zurueck.
 *
 * Der Bezeichner `document` kommt ausserhalb von main() nicht vor — er kostet
 * pauschal 25 GB (RamCostGenerator.ts:12) und der RAM-Rechner bucht rein
 * namensbasiert (RamCalculations.ts:185-192). Das Dokument wird ueberall als
 * Parameter `doc` hereingereicht, genau wie in entwurf/join/join.js.
 *
 * Speicherbedarf, aufgeschluesselt (RamCostGenerator.ts):
 *   1.6 Grundpreis + 25 document + 0.5 getPlayer (SingularityFn1/4, :661)
 *   + 1 getResetInfo (:664) + 0.1 getServerMoneyAvailable (:618)
 *   + 0.6 scp (:607) = rund 28.8 GB.
 * Auf home (aktuell 8 GB nach dem Reset, davor mehr) laeuft das nicht; deshalb
 * der Weg ueber `node tools/task.js`, der einen Rechner mit genug Platz sucht.
 */

// ===========================================================================
// Katalog
// ===========================================================================
//
// Aus reference/bitburner-src/src/Augmentation/Augmentations.ts und
// Augmentation/Enums.ts erzeugt. ACHTUNG: der Referenzquelltext im Projekt
// traegt v3.0.2-dev (package.json:4), das laufende Spiel ist v3.0.1 — fuer
// die hier benutzten Formeln und Preise deckungsgleich, aber die Annahme
// "Quelltext = laufende Fassung" traegt nicht blind. Reihenfolge der Felder:
//   [Name, Grund-Reputation, Grund-Geldpreis, Faktionen, Voraussetzungen, Multiplikatoren]
// Infinity bedeutet: ueber den normalen Kauf nicht erreichbar (Grafting bzw.
// Sonderaugs). Diese Eintraege scheiden im Planer aus.
//
// Der Katalog ist eine Kopie und kann veralten. Er wird deshalb bei jedem
// Lauf gegen die Oberflaeche geprueft: jede Aug, die das Spiel anbietet und
// die hier fehlt, wird gemeldet; und vor jedem Kauf muss der Knopf des
// Spiels freigegeben sein, sonst bricht der Automat ab.
//
// WICHTIG: welche Faktion welche Aug anbietet, wird NICHT aus dieser Tabelle
// genommen, sondern aus dem, was die Seite zeigt. Das Feld "Faktionen" dient
// nur der Nachvollziehbarkeit. Der Grund ist getFactionAugmentationsFiltered
// (FactionHelpers.tsx:172-210): wer eine Gang bei einer Faktion hat, bekommt
// dort fast ALLE Augs angeboten, ausgewuerfelt aus dem BitNode-Seed. Eine
// feste Zuordnung waere in dem Fall falsch — die Oberflaeche nicht.
const AUG_TABLE = [
  ["ADR-V1 Pheromone Gene",3750,17500000,"Tian Di Hui|The Syndicate|NWO|MegaCorp|Four Sigma","",{company_rep:1.1,faction_rep:1.1,charisma_exp:1.05}],
  ["ADR-V2 Pheromone Gene",62500,550000000,"Silhouette|Four Sigma|Bachman & Associates|Clarke Incorporated","",{company_rep:1.2,faction_rep:1.2,charisma:1.1}],
  ["Artificial Bio-neural Network Implant",275000,3000000000,"BitRunners|Fulcrum Secret Technologies","",{hacking_speed:1.03,hacking_money:1.15,hacking:1.12}],
  ["Artificial Synaptic Potentiation",6250,80000000,"The Black Hand|NiteSec","",{hacking_speed:1.02,hacking_chance:1.05,hacking_exp:1.05}],
  ["SoA - Beauty of Aphrodite",10000,1000000,"Shadows of Anarchy","",{charisma:1.1}],
  ["BigD's Big ... Brain",Infinity,Infinity,"","",{hacking:2,strength:2,defense:2,dexterity:2,agility:2,charisma:2,hacking_exp:2,strength_exp:2,defense_exp:2,dexterity_exp:2,agility_exp:2,charisma_exp:2,hacking_chance:2,hacking_speed:2,hacking_money:2,hacking_grow:2,company_rep:2,faction_rep:2,crime_money:2,crime_success:2,work_money:2,hacknet_node_money:2,hacknet_node_purchase_cost:0.5,hacknet_node_ram_cost:0.5,hacknet_node_core_cost:0.5,hacknet_node_level_cost:0.5,bladeburner_max_stamina:2,bladeburner_stamina_gain:2,bladeburner_analysis:2,bladeburner_success_chance:2}],
  ["Bionic Arms",62500,275000000,"Tetrads","",{strength:1.3,dexterity:1.3}],
  ["Bionic Legs",150000,375000000,"Speakers for the Dead|The Syndicate|KuaiGong International|OmniTek Incorporated|Blade Industries","",{agility:1.6}],
  ["Bionic Spine",45000,125000000,"Speakers for the Dead|The Syndicate|KuaiGong International|OmniTek Incorporated|Blade Industries","",{strength:1.15,defense:1.15,agility:1.15,dexterity:1.15}],
  ["BitWire",3750,10000000,"CyberSec|NiteSec","",{hacking:1.05}],
  ["BLADE-51b Tesla Armor",12500,1375000000,"Bladeburners","",{strength:1.04,defense:1.04,dexterity:1.04,agility:1.04,bladeburner_stamina_gain:1.02,bladeburner_success_chance:1.03}],
  ["BLADE-51b Tesla Armor: Energy Shielding Upgrade",21250,5500000000,"Bladeburners","BLADE-51b Tesla Armor",{defense:1.05,bladeburner_success_chance:1.06}],
  ["BLADE-51b Tesla Armor: IPU Upgrade",15000,1100000000,"Bladeburners","BLADE-51b Tesla Armor",{bladeburner_analysis:1.15,bladeburner_success_chance:1.02}],
  ["BLADE-51b Tesla Armor: Omnibeam Upgrade",62500,27500000000,"Bladeburners","BLADE-51b Tesla Armor: Unibeam Upgrade",{bladeburner_success_chance:1.1}],
  ["BLADE-51b Tesla Armor: Power Cells Upgrade",18750,2750000000,"Bladeburners","BLADE-51b Tesla Armor",{bladeburner_success_chance:1.05,bladeburner_stamina_gain:1.02,bladeburner_max_stamina:1.05}],
  ["BLADE-51b Tesla Armor: Unibeam Upgrade",31250,16500000000,"Bladeburners","BLADE-51b Tesla Armor",{bladeburner_success_chance:1.08}],
  ["Blade's Runners",20000,8250000000,"Bladeburners","",{agility:1.05,bladeburner_max_stamina:1.05,bladeburner_stamina_gain:1.05}],
  ["The Blade's Simulacrum",1250,150000000000,"Bladeburners","",{}],
  ["BrachiBlades",12500,90000000,"The Syndicate","",{strength:1.15,defense:1.15,crime_success:1.1,crime_money:1.15}],
  ["CRTX42-AA Gene Modification",45000,225000000,"NiteSec","",{hacking:1.08,hacking_exp:1.15}],
  ["CashRoot Starter Kit",12500,125000000,"Sector-12","",{}],
  ["SoA - Chaos of Dionysus",10000,1000000,"Shadows of Anarchy","",{}],
  ["Combat Rib I",7500,23750000,"Slum Snakes|The Dark Army|The Syndicate|Volhaven|Ishima|OmniTek Incorporated|KuaiGong International|Blade Industries","",{strength:1.1,defense:1.1}],
  ["Combat Rib II",18750,65000000,"The Dark Army|The Syndicate|Volhaven|OmniTek Incorporated|KuaiGong International|Blade Industries","Combat Rib I",{strength:1.14,defense:1.14}],
  ["Combat Rib III",35000,120000000,"The Dark Army|The Syndicate|OmniTek Incorporated|KuaiGong International|Blade Industries|The Covenant","Combat Rib II|Combat Rib I",{strength:1.18,defense:1.18}],
  ["violet Congruity Implant",Infinity,50000000000000,"","",{}],
  ["CordiARC Fusion Reactor",1125000,5000000000,"MegaCorp","",{strength:1.35,defense:1.35,dexterity:1.35,agility:1.35,strength_exp:1.35,defense_exp:1.35,dexterity_exp:1.35,agility_exp:1.35}],
  ["Cranial Signal Processors - Gen I",10000,70000000,"CyberSec|NiteSec","",{hacking_speed:1.01,hacking:1.05}],
  ["Cranial Signal Processors - Gen II",18750,125000000,"CyberSec|NiteSec","Cranial Signal Processors - Gen I",{hacking_speed:1.02,hacking_chance:1.05,hacking:1.07}],
  ["Cranial Signal Processors - Gen III",50000,550000000,"NiteSec|The Black Hand|BitRunners","Cranial Signal Processors - Gen II|Cranial Signal Processors - Gen I",{hacking_speed:1.02,hacking_money:1.15,hacking:1.09}],
  ["Cranial Signal Processors - Gen IV",125000,1100000000,"The Black Hand|BitRunners","Cranial Signal Processors - Gen III|Cranial Signal Processors - Gen II|Cranial Signal Processors - Gen I",{hacking_speed:1.02,hacking_money:1.2,hacking_grow:1.25}],
  ["Cranial Signal Processors - Gen V",250000,2250000000,"BitRunners","Cranial Signal Processors - Gen IV|Cranial Signal Processors - Gen III|Cranial Signal Processors - Gen II|Cranial Signal Processors - Gen I",{hacking:1.3,hacking_money:1.25,hacking_grow:1.75}],
  ["DataJack",112500,450000000,"BitRunners|The Black Hand|NiteSec|Chongqing|New Tokyo","",{hacking_money:1.25}],
  ["DermaForce Particle Barrier",15000,50000000,"Volhaven","",{defense:1.4,charisma:1.03}],
  ["Eloquence Module",25000,250000000,"Speakers for the Dead","",{charisma:1.05,crime_success:1.1,work_money:1.2}],
  ["EMS-4 Recombination",2500,275000000,"Bladeburners","",{bladeburner_success_chance:1.03,bladeburner_analysis:1.05,bladeburner_stamina_gain:1.02}],
  ["Embedded Netburner Module",15000,250000000,"BitRunners|The Black Hand|NiteSec|ECorp|MegaCorp|Fulcrum Secret Technologies|NWO|Blade Industries","",{hacking:1.08}],
  ["Embedded Netburner Module Analyze Engine",625000,6000000000,"ECorp|MegaCorp|Fulcrum Secret Technologies|NWO|Daedalus|The Covenant|Illuminati","Embedded Netburner Module",{hacking_speed:1.1}],
  ["Embedded Netburner Module Core Implant",175000,2500000000,"BitRunners|The Black Hand|ECorp|MegaCorp|Fulcrum Secret Technologies|NWO|Blade Industries","Embedded Netburner Module",{hacking_speed:1.03,hacking_money:1.1,hacking_chance:1.03,hacking_exp:1.07,hacking:1.07}],
  ["Embedded Netburner Module Core V2 Upgrade",1000000,4500000000,"BitRunners|ECorp|MegaCorp|Fulcrum Secret Technologies|NWO|Blade Industries|OmniTek Incorporated|KuaiGong International","Embedded Netburner Module Core Implant|Embedded Netburner Module",{hacking_speed:1.05,hacking_money:1.3,hacking_chance:1.05,hacking_exp:1.15,hacking:1.08}],
  ["Embedded Netburner Module Core V3 Upgrade",1750000,7500000000,"ECorp|MegaCorp|Fulcrum Secret Technologies|NWO|Daedalus|The Covenant|Illuminati","Embedded Netburner Module Core V2 Upgrade|Embedded Netburner Module Core Implant|Embedded Netburner Module",{hacking_speed:1.05,hacking_money:1.4,hacking_chance:1.1,hacking_exp:1.25,hacking:1.1}],
  ["Embedded Netburner Module Direct Memory Access Upgrade",1000000,7000000000,"ECorp|MegaCorp|Fulcrum Secret Technologies|NWO|Daedalus|The Covenant|Illuminati","Embedded Netburner Module",{hacking_money:1.4,hacking_chance:1.2}],
  ["Enhanced Myelin Sheathing",100000,1375000000,"Fulcrum Secret Technologies|BitRunners|The Black Hand","",{hacking_speed:1.03,hacking_exp:1.1,hacking:1.08}],
  ["Enhanced Social Interaction Implant",375000,1375000000,"Bachman & Associates|NWO|Clarke Incorporated|OmniTek Incorporated|Four Sigma","",{charisma:1.6,charisma_exp:1.6}],
  ["EsperTech Bladeburner Eyewear",1250,165000000,"Bladeburners","",{bladeburner_success_chance:1.03,dexterity:1.05}],
  ["SoA - Flood of Poseidon",10000,1000000,"Shadows of Anarchy","",{}],
  ["FocusWire",75000,900000000,"Bachman & Associates|Clarke Incorporated|Four Sigma|KuaiGong International","",{hacking_exp:1.05,strength_exp:1.05,defense_exp:1.05,dexterity_exp:1.05,agility_exp:1.05,charisma_exp:1.05,company_rep:1.1,work_money:1.2}],
  ["Glibness Enhancement",40500,2500000000,"Tetrads|Bladeburners","",{charisma_exp:1.2,company_rep:1.1}],
  ["Golden Tongue Module",125000,125000000,"Speakers for the Dead","",{charisma:1.1,charisma_exp:1.3}],
  ["GOLEM Serum",31250,11000000000,"Bladeburners","",{strength:1.07,defense:1.07,dexterity:1.07,agility:1.07,bladeburner_stamina_gain:1.05}],
  ["Graphene Bionic Arms Upgrade",500000,3750000000,"The Dark Army","Bionic Arms",{strength:1.85,dexterity:1.85}],
  ["Graphene Bionic Legs Upgrade",750000,4500000000,"MegaCorp|ECorp|Fulcrum Secret Technologies","Bionic Legs",{agility:2.5}],
  ["Graphene Bionic Spine Upgrade",1625000,6000000000,"Fulcrum Secret Technologies|ECorp","Bionic Spine",{strength:1.6,defense:1.6,agility:1.6,dexterity:1.6}],
  ["Graphene Bone Lacings",1125000,4250000000,"Fulcrum Secret Technologies|The Covenant","",{strength:1.7,defense:1.7}],
  ["Graphene BrachiBlades Upgrade",225000,2500000000,"Speakers for the Dead","BrachiBlades",{strength:1.4,defense:1.4,crime_success:1.1,crime_money:1.3}],
  ["Hacknet Node CPU Architecture Neural-Upload",3750,11000000,"Netburners","",{hacknet_node_money:1.15,hacknet_node_purchase_cost:0.85}],
  ["Hacknet Node Cache Architecture Neural-Upload",2500,5500000,"Netburners","",{hacknet_node_money:1.1,hacknet_node_level_cost:0.85}],
  ["Hacknet Node Core Direct-Neural Interface",12500,60000000,"Netburners","",{hacknet_node_money:1.45}],
  ["Hacknet Node Kernel Direct-Neural Interface",7500,40000000,"Netburners","",{hacknet_node_money:1.25}],
  ["Hacknet Node NIC Architecture Neural-Upload",1875,4500000,"Netburners","",{hacknet_node_money:1.1,hacknet_node_purchase_cost:0.9}],
  ["HemoRecirculator",10000,45000000,"Tetrads|The Dark Army|The Syndicate","",{strength:1.08,defense:1.08,agility:1.08,dexterity:1.08,charisma:1.08}],
  ["ECorp HVMind Implant",1500000,5500000000,"ECorp","",{hacking_grow:3}],
  ["SoA - Hunt of Artemis",10000,1000000,"Shadows of Anarchy","",{}],
  ["Hydroflame Left Arm",1250000,2500000000000,"NWO","",{strength:2.8}],
  ["Hyperion Plasma Cannon V1",12500,2750000000,"Bladeburners","",{bladeburner_success_chance:1.06}],
  ["Hyperion Plasma Cannon V2",25000,5500000000,"Bladeburners","Hyperion Plasma Cannon V1",{bladeburner_success_chance:1.08}],
  ["HyperSight Corneal Implant",150000,2750000000,"Blade Industries|KuaiGong International","",{dexterity:1.4,hacking_speed:1.03,hacking_money:1.1,charisma:1.03}],
  ["INFRARET Enhancement",7500,30000000,"Ishima","",{crime_success:1.25,crime_money:1.1,dexterity:1.1}],
  ["I.N.T.E.R.L.I.N.K.E.D",25000,5500000000,"Bladeburners","",{strength_exp:1.05,defense_exp:1.05,dexterity_exp:1.05,agility_exp:1.05,bladeburner_max_stamina:1.1}],
  ["SoA - Knowledge of Apollo",10000,1000000,"Shadows of Anarchy","",{}],
  ["LuminCloaking-V1 Skin Implant",1500,5000000,"Slum Snakes|Tetrads","",{agility:1.05,charisma:1.03,crime_money:1.1}],
  ["LuminCloaking-V2 Skin Implant",5000,30000000,"Slum Snakes|Tetrads","LuminCloaking-V1 Skin Implant",{agility:1.1,defense:1.1,charisma_exp:1.1,crime_money:1.25}],
  ["Magnetism Amplifier",15000,250000000,"The Black Hand|The Dark Army","",{charisma:1.05,company_rep:1.1}],
  ["SoA - Might of Ares",10000,1000000,"Shadows of Anarchy","",{}],
  ["Nanofiber Weave",37500,125000000,"The Dark Army|The Syndicate|OmniTek Incorporated|Blade Industries|Tian Di Hui|Speakers for the Dead|Fulcrum Secret Technologies","",{strength:1.2,defense:1.2,charisma:1.05}],
  ["Neotra",562500,2875000000,"Blade Industries","",{strength:1.55,defense:1.55,charisma:1.55}],
  ["Neural Accelerator",200000,1750000000,"BitRunners","",{hacking:1.1,hacking_exp:1.15,hacking_money:1.2}],
  ["Neural-Retention Enhancement",20000,250000000,"NiteSec","",{hacking_exp:1.25}],
  ["Neuralstimulator",50000,3000000000,"The Black Hand|Chongqing|Sector-12|New Tokyo|Aevum|Ishima|Volhaven|Bachman & Associates|Clarke Incorporated|Four Sigma","",{hacking_speed:1.02,hacking_chance:1.1,hacking_exp:1.12}],
  ["Neuregen Gene Modification",37500,375000000,"Chongqing","",{hacking_exp:1.4}],
  ["NeuroFlux Governor",500,750000,"Illuminati|Daedalus|The Covenant|ECorp|MegaCorp|Bachman & Associates|Blade Industries|NWO|Clarke Incorporated|OmniTek Incorporated|Four Sigma|KuaiGong International|Fulcrum Secret Technologies|BitRunners|The Black Hand|NiteSec|Aevum|Chongqing|Ishima|New Tokyo|Sector-12|Volhaven|Speakers for the Dead|The Dark Army|The Syndicate|Silhouette|Tetrads|Slum Snakes|Netburners|Tian Di Hui|CyberSec","",{hacking_chance:1.01000262,hacking_speed:1.01000262,hacking_money:1.01000262,hacking_grow:1.01000262,hacking:1.01000262,strength:1.01000262,defense:1.01000262,dexterity:1.01000262,agility:1.01000262,charisma:1.01000262,hacking_exp:1.01000262,strength_exp:1.01000262,defense_exp:1.01000262,dexterity_exp:1.01000262,agility_exp:1.01000262,charisma_exp:1.01000262,company_rep:1.01000262,faction_rep:1.01000262,crime_money:1.01000262,crime_success:1.01000262,dnet_money:1.01000262,hacknet_node_money:1.01000262,work_money:1.01000262,hacknet_node_purchase_cost:0.99009644,hacknet_node_ram_cost:0.99009644,hacknet_node_core_cost:0.99009644,hacknet_node_level_cost:0.99009644}],
  ["BitRunners Neurolink",875000,4375000000,"BitRunners","",{hacking:1.15,hacking_exp:1.2,hacking_chance:1.1,hacking_speed:1.05}],
  ["Neuronal Densification",187500,1375000000,"Clarke Incorporated","",{hacking:1.15,hacking_exp:1.1,hacking_speed:1.03}],
  ["Neuroreceptor Management Implant",75000,550000000,"Tian Di Hui","",{}],
  ["Neurotrainer I",1000,4000000,"CyberSec|Aevum","",{hacking_exp:1.1,strength_exp:1.1,defense_exp:1.1,dexterity_exp:1.1,agility_exp:1.1,charisma_exp:1.1}],
  ["Neurotrainer II",10000,45000000,"BitRunners|NiteSec","",{hacking_exp:1.15,strength_exp:1.15,defense_exp:1.15,dexterity_exp:1.15,agility_exp:1.15,charisma_exp:1.15}],
  ["Neurotrainer III",25000,130000000,"NWO|Four Sigma","",{hacking_exp:1.2,strength_exp:1.2,defense_exp:1.2,dexterity_exp:1.2,agility_exp:1.2,charisma_exp:1.2}],
  ["Nuoptimal Nootropic Injector Implant",5000,20000000,"Tian Di Hui|Volhaven|New Tokyo|Chongqing|Clarke Incorporated|Four Sigma|Bachman & Associates","",{company_rep:1.2,charisma:1.03}],
  ["NutriGen Implant",6250,2500000,"New Tokyo","",{strength_exp:1.2,defense_exp:1.2,dexterity_exp:1.2,agility_exp:1.2}],
  ["nextSENS Gene Modification",437500,1925000000,"Clarke Incorporated","",{hacking:1.2,strength:1.2,defense:1.2,dexterity:1.2,agility:1.2,charisma:1.2}],
  ["OmniTek InfoLoad",625000,2875000000,"OmniTek Incorporated","",{hacking:1.2,hacking_exp:1.25}],
  ["ORION-MKIV Shoulder",6250,550000000,"Bladeburners","",{defense:1.05,strength:1.05,dexterity:1.05,bladeburner_success_chance:1.04}],
  ["PC Direct-Neural Interface",375000,3750000000,"Four Sigma|OmniTek Incorporated|ECorp|Blade Industries","",{company_rep:1.3,hacking:1.08}],
  ["PC Direct-Neural Interface NeuroNet Injector",1500000,7500000000,"Fulcrum Secret Technologies","PC Direct-Neural Interface",{company_rep:2,hacking:1.1,hacking_speed:1.05}],
  ["PC Direct-Neural Interface Optimization Submodule",500000,4500000000,"Fulcrum Secret Technologies|ECorp|Blade Industries","PC Direct-Neural Interface",{company_rep:1.75,hacking:1.1}],
  ["PCMatrix",100000,2000000000,"Aevum","",{charisma:1.0777,charisma_exp:1.0777,work_money:1.777,faction_rep:1.0777,company_rep:1.0777,crime_success:1.0777,crime_money:1.0777}],
  ["Photosynthetic Cells",562500,2750000000,"KuaiGong International","",{strength:1.4,defense:1.4,agility:1.4,charisma:1.2}],
  ["Power Recirculation Core",25000,180000000,"Tetrads|The Dark Army|The Syndicate|NWO","",{hacking:1.05,strength:1.05,defense:1.05,dexterity:1.05,agility:1.05,charisma:1.05,hacking_exp:1.1,strength_exp:1.1,defense_exp:1.1,dexterity_exp:1.1,agility_exp:1.1,charisma_exp:1.1}],
  ["The Illustrated Primer",187500,3375000000,"The Dark Army|The Syndicate","",{charisma:1.05,charisma_exp:1.2}],
  ["QLink",1875000,25000000000000,"Illuminati","",{hacking:1.75,hacking_speed:2,hacking_chance:2.5,hacking_money:4}],
  ["Social Negotiation Assistant (S.N.A)",6250,30000000,"Tian Di Hui","",{charisma_exp:1.15,work_money:1.1,company_rep:1.15,faction_rep:1.15}],
  ["Social Dynamics Processor",225000,1200000000,"MegaCorp|ECorp|OmniTek Incorporated","",{charisma:1.1,company_rep:1.3}],
  ["SPTN-97 Gene Modification",1250000,4875000000,"The Covenant","",{strength:1.75,defense:1.75,dexterity:1.75,agility:1.75,hacking:1.15}],
  ["The Shadow's Simulacrum",37500,400000000,"The Syndicate|The Dark Army|Speakers for the Dead","",{company_rep:1.15,faction_rep:1.15}],
  ["SmartJaw",375000,2750000000,"Bachman & Associates","",{charisma:1.5,charisma_exp:1.5,company_rep:1.25,faction_rep:1.25}],
  ["SmartSonar Implant",22500,75000000,"Slum Snakes","",{dexterity:1.1,dexterity_exp:1.15,crime_money:1.25}],
  ["Speech Enhancement",2500,12500000,"Tian Di Hui|Speakers for the Dead|Four Sigma|KuaiGong International|Clarke Incorporated|Bachman & Associates","",{company_rep:1.1,charisma:1.05}],
  ["Speech Processor Implant",7500,50000000,"Tian Di Hui|Chongqing|Sector-12|New Tokyo|Aevum|Ishima|Volhaven|Silhouette","",{charisma:1.1}],
  ["Stanek's Gift - Genesis",0,0,"Church of the Machine God","",{hacking_chance:0.9,hacking_speed:0.9,hacking_money:0.9,hacking_grow:0.9,hacking:0.9,strength:0.9,defense:0.9,dexterity:0.9,agility:0.9,charisma:0.9,hacking_exp:0.9,strength_exp:0.9,defense_exp:0.9,dexterity_exp:0.9,agility_exp:0.9,charisma_exp:0.9,company_rep:0.9,faction_rep:0.9,crime_money:0.9,crime_success:0.9,hacknet_node_money:0.9,hacknet_node_purchase_cost:1.1,hacknet_node_ram_cost:1.1,hacknet_node_core_cost:1.1,hacknet_node_level_cost:1.1,work_money:0.9}],
  ["Stanek's Gift - Awakening",1000000,0,"Church of the Machine God","Stanek's Gift - Genesis",{}],
  ["Stanek's Gift - Serenity",100000000,0,"Church of the Machine God","Stanek's Gift - Awakening|Stanek's Gift - Genesis",{}],
  ["NEMEAN Subdermal Weave",875000,3250000000,"The Syndicate|Fulcrum Secret Technologies|Illuminati|Daedalus|The Covenant","",{defense:2.2}],
  ["Synaptic Enhancement Implant",2000,7500000,"CyberSec|Aevum","",{hacking_speed:1.03}],
  ["Synfibril Muscle",437500,1125000000,"KuaiGong International|Fulcrum Secret Technologies|Speakers for the Dead|NWO|The Covenant|Daedalus|Illuminati|Blade Industries","",{strength:1.3,defense:1.3}],
  ["Synthetic Heart",750000,2875000000,"KuaiGong International|Fulcrum Secret Technologies|Speakers for the Dead|NWO|The Covenant|Daedalus|Illuminati","",{agility:1.5,strength:1.5,charisma:1.15}],
  ["TITN-41 Gene-Modification Injection",25000,190000000,"Silhouette","",{charisma:1.15,charisma_exp:1.15}],
  ["Augmented Targeting I",5000,15000000,"Slum Snakes|The Dark Army|The Syndicate|Sector-12|Ishima|OmniTek Incorporated|KuaiGong International|Blade Industries","",{dexterity:1.1}],
  ["Augmented Targeting II",8750,42500000,"The Dark Army|The Syndicate|Sector-12|OmniTek Incorporated|KuaiGong International|Blade Industries","Augmented Targeting I",{dexterity:1.2}],
  ["Augmented Targeting III",27500,115000000,"The Dark Army|The Syndicate|OmniTek Incorporated|KuaiGong International|Blade Industries|The Covenant","Augmented Targeting II|Augmented Targeting I",{dexterity:1.3}],
  ["The Black Hand",100000,550000000,"The Black Hand","",{strength:1.15,dexterity:1.15,hacking:1.1,hacking_speed:1.02,hacking_money:1.1}],
  ["The W1ngs of Icarus",10000,1000000,"","",{charisma:1.05,agility:1.1,dnet_money:1.3}],
  ["The B00ts of Perseus",10000,1000000,"","The W1ngs of Icarus",{charisma:1.06,dexterity:1.06}],
  ["The H4mmer of Daedalus",10000,1000000,"","The B00ts of Perseus",{charisma:1.07,strength:1.1,dnet_money:1.1}],
  ["The St4ff of Asclepius",10000,1000000,"","The H4mmer of Daedalus",{charisma_exp:1.1,defense:1.1,dnet_money:1.1}],
  ["The L4w of Bayes",10000,1000000,"","The St4ff of Asclepius",{charisma:1.09,company_rep:1.05,dnet_money:1.15}],
  ["The B1ade of Solomonoff",10000,1000000,"","The L4w of Bayes",{charisma:1.1,hacking:1.1,company_rep:1.1,dnet_money:1.1}],
  ["The Red Pill",2500000,0,"Daedalus","",{}],
  ["SoA - Trickery of Hermes",10000,1000000,"Shadows of Anarchy","",{}],
  ["Vangelis Virus",18750,2750000000,"Bladeburners","",{dexterity_exp:1.1,charisma_exp:1.1,bladeburner_analysis:1.1,bladeburner_success_chance:1.04}],
  ["Vangelis Virus 3.0",37500,11000000000,"Bladeburners","Vangelis Virus",{defense_exp:1.1,dexterity_exp:1.1,charisma_exp:1.1,bladeburner_analysis:1.15,bladeburner_success_chance:1.05}],
  ["SoA - phyzical WKS harmonizer",10000,1000000,"Shadows of Anarchy","",{}],
  ["Wired Reflexes",1250,2500000,"Tian Di Hui|Slum Snakes|Sector-12|Volhaven|Aevum|Ishima|The Syndicate|The Dark Army|Speakers for the Dead","",{agility:1.05,dexterity:1.05}],
  ["SoA - Wisdom of Athena",10000,1000000,"Shadows of Anarchy","",{}],
  ["Neural Wit Amplifier",5000,10000000,"Slum Snakes|BitRunners","",{charisma:1.03,charisma_exp:1.05,company_rep:1.05}],
  ["Xanipher",875000,4250000000,"NWO","",{hacking:1.2,strength:1.2,defense:1.2,dexterity:1.2,agility:1.2,charisma:1.2,hacking_exp:1.15,strength_exp:1.15,defense_exp:1.15,dexterity_exp:1.15,agility_exp:1.15,charisma_exp:1.15}],
  ["Z.O.Ë.",Infinity,1000000000000,"","",{}]
];

/** Name -> Katalogeintrag als Objekt. */
const CATALOG = new Map(
  AUG_TABLE.map(([name, repCost, moneyCost, factions, prereqs, mults]) => [
    name,
    {
      name,
      repCost,
      moneyCost,
      factions: factions ? factions.split("|") : [],
      prereqs: prereqs ? prereqs.split("|") : [],
      mults,
    },
  ]),
);

const NFG = "NeuroFlux Governor";
/** Constants.ts:41 — ohne Source File 11 ist der Basisfaktor exakt 1.9. */
const QUEUE_MULT = 1.9;
/** Constants.ts:36 — Preisfaktor je NeuroFlux-Stufe, NICHT seine Wirkung. */
const NFG_LEVEL_MULT = 1.14;
/**
 * Die neun SoA-Augs zaehlen NICHT in den generischen Preisfaktor und haben
 * eine eigene Preisformel (AugmentationHelpers.ts:18-27 und :140-153). Der
 * Automat kauft sie nicht, muss sie aber beim Zaehlen der Warteschlange
 * ueberspringen, sonst rechnet er alle Preise zu hoch.
 */
const SOA_AUGS = new Set(
  AUG_TABLE.filter(([, , , factions]) => (factions || "").split("|").includes("Shadows of Anarchy")).map(([n]) => n),
);

// ===========================================================================
// Bewertung
// ===========================================================================

/**
 * Gewichte je Multiplikator, siehe Kopf (1b). Sie beschreiben diesen Bot in
 * BitNode 1: er verdient ausschliesslich durch HWGW-Batches und braucht
 * Reputation, um ueberhaupt an weitere Augs zu kommen. Wer den Bot umbaut,
 * muss diese Tabelle mitziehen — sonst optimiert der Planer weiter auf das
 * alte Spiel.
 */
const WEIGHTS = {
  hacking_money: 1.5, // direkt der Ertrag je Hack
  hacking_speed: 1.2, // Durchsatz der Batches
  hacking: 1.0, // Fertigkeit: Chance, Dauer, Anteil — und Tor zu Faktionen
  hacking_exp: 0.8, // nach dem Reset ist der Wiederaufstieg das Nadeloehr
  faction_rep: 1.0, // Reputation ist das Nadeloehr fuer alle weiteren Augs
  hacking_grow: 0.6,
  hacking_chance: 0.4, // bei hohem Level ohnehin nahe 1
  company_rep: 0.15,
  work_money: 0.1,
  crime_money: 0.1,
  crime_success: 0.1,
  dnet_money: 0.1,
  strength: 0.05,
  defense: 0.05,
  dexterity: 0.05,
  agility: 0.05,
  charisma: 0.05,
  strength_exp: 0.05,
  defense_exp: 0.05,
  dexterity_exp: 0.05,
  agility_exp: 0.05,
  charisma_exp: 0.05,
  hacknet_node_money: 0.05,
  hacknet_node_purchase_cost: 0.02,
  hacknet_node_ram_cost: 0.02,
  hacknet_node_core_cost: 0.02,
  hacknet_node_level_cost: 0.02,
  // bladeburner_*: 0 — in BN1 ohne Zugang, also wertlos.
};

/** Standardgewicht einer neuen VERSCHIEDENEN Augmentation, siehe Kopf (1c). */
const DEFAULT_DISTINCT_BONUS = 0.15;

/**
 * Massstab: wie viel Nutzen je Milliarde bekommt man ausserhalb des
 * Aug-Marktes?
 *
 * Hergeleitet an der einzigen anderen grossen Senke, die den Reset ueberlebt:
 * eine Verdopplung des home-Speichers. Sie kostet
 * ram * 32000 * 1.58^log2(ram) (PlayerObjectServerMethods.ts:30-40) und
 * verdoppelt grob die Zahl gleichzeitiger HWGW-Batches, also grob den Ertrag.
 * In den Einheiten dieser Datei ist "Ertrag mal zwei" dasselbe wie
 * hacking_money mal zwei, also 1.5 * ln(2) = 1.04 Nutzen. Bei 8192 GB kostet
 * der naechste Schritt 8192*32000*1.58^13 = 100.2 Mrd, macht rund
 * 0.0104 Nutzen je Milliarde.
 *
 * Die Zahl ist eine Groessenordnung, keine Praezision — und genau so wird sie
 * benutzt: nicht als Sperre, sondern als Warnzeile. Wer den Bot umbaut oder in
 * einem anderen BitNode spielt, rechnet sie neu.
 */
const YARDSTICK = 0.0104;

/**
 * Multiplikatorwert einer Aug in log-Einheiten.
 *
 * Felder auf `_cost` sind Kostensenker: dort ist ein Wert UNTER 1 gut, also
 * geht ln(1/v) ein. Unbekannte Felder zaehlen null — lieber unterschaetzen
 * als eine Aug wegen eines Feldes kaufen, dessen Nutzen niemand geprueft hat.
 */
function multScore(mults) {
  let sum = 0;
  for (const key of Object.keys(mults || {})) {
    const w = WEIGHTS[key];
    if (!w) continue;
    const v = mults[key];
    if (!(v > 0)) continue;
    sum += w * Math.log(key.endsWith("_cost") ? 1 / v : v);
  }
  return sum;
}

// ===========================================================================
// Planer
// ===========================================================================

/**
 * Baut die Kandidatenliste aus dem gelesenen Zustand.
 *
 * @param {object} state
 * @param {Map<string,{owned:boolean,disabled:boolean,factions:Set<string>}>} state.rows
 *        was die Oberflaeche je Aug zeigt, ueber alle Mitgliedsfaktionen
 * @param {Map<string,number>} state.rep        Faktion -> exakte Reputation
 * @param {Set<string>} state.installed         installierte Augs (getResetInfo)
 * @param {number} state.nfgLevel               NFG-Stufe installiert + wartend
 * @param {number} state.distinctBonus
 * @param {number} state.nfgDepth               wie viele NFG-Stufen betrachtet werden
 */
function buildCandidates(state) {
  const out = [];
  const notes = [];

  for (const [name, row] of state.rows) {
    if (name === NFG) continue;
    if (row.owned) continue; // schon gekauft oder installiert
    const entry = CATALOG.get(name);
    if (!entry) {
      notes.push(`Aug "${name}" steht nicht im Katalog — uebergangen (Katalog veraltet?)`);
      continue;
    }
    if (!Number.isFinite(entry.moneyCost) || !Number.isFinite(entry.repCost)) {
      notes.push(`Aug "${name}" hat keinen normalen Preis (Grafting/Sonderaug) — uebergangen`);
      continue;
    }
    if (SOA_AUGS.has(name)) {
      notes.push(`Aug "${name}" ist eine SoA-Aug mit eigener Preisformel — uebergangen`);
      continue;
    }
    // Voraussetzungen: sie muessen GEKAUFT sein, nicht installiert
    // (FactionHelpers.tsx:56-58 ueber Person.ts:233-241). Alles, was die
    // Oberflaeche als owned zeigt, ist gekauft oder installiert.
    const missing = entry.prereqs.filter((p) => !(state.rows.get(p)?.owned || state.installed.has(p)));
    // Faktion mit ausreichender Reputation suchen.
    const from = [...row.factions].filter((f) => (state.rep.get(f) ?? -1) >= entry.repCost);
    if (!from.length) {
      const best = Math.max(...[...row.factions].map((f) => state.rep.get(f) ?? 0), 0);
      notes.push(
        `Aug "${name}": Reputation reicht nicht (${fmtNum(best)} von ${fmtNum(entry.repCost)}) — uebergangen`,
      );
      continue;
    }
    // SONDERFALL: Wirkungen, die kein Multiplikator sind.
    //
    // Die Bewertung oben kennt nur Multiplikatoren und den Distinct-Bonus.
    // Augmentierungen, die etwas anderes tun, faellt sie damit auf den blossen
    // Distinct-Bonus zurueck - und kauft sie folgerichtig nie, solange
    // irgendeine Zeile mit drei Prozentpunkten daneben steht.
    //
    // Am 20.08. hat sie deshalb den Neuroreceptor Management Implant liegen
    // lassen, fuer den zwei Stunden Faktionsarbeit gelaufen waren, und
    // stattdessen zwei reine company_rep-Augs gekauft, die wir nie brauchen
    // werden, weil wir nicht fuer Firmen arbeiten.
    //
    // Was die Aug wirklich tut, steht in
    // PersonObjects/Player/PlayerObjectGeneralMethods.ts:622-628: sie hebt die
    // Fokus-Strafe auf. Ohne Fokus rechnet das Spiel mit 0,8, mit Fokus mit
    // 1,0 - und der Fokus geht im laufenden Betrieb staendig verloren, weil
    // jede Navigation stopFocusing() ruft (GameRoot.tsx:271-272). Fuer einen
    // Automaten, der die Oberflaeche staendig bedienen muss, ist das ein
    // dauerhafter Faktor 1/0,8 auf JEDE Faktionsarbeit.
    //
    // ln(1,25) = 0,2231 - auf derselben logarithmischen Skala wie die
    // Multiplikatoren, und gewichtet wie faction_rep, weil es genau dort
    // wirkt.
    const SONDERWIRKUNG = {
      "Neuroreceptor Management Implant": Math.log(1 / 0.8) * (WEIGHTS.faction_rep ?? 1),
    };
    out.push({
      name,
      base: entry.moneyCost,
      faction: from[0],
      score: state.distinctBonus + multScore(entry.mults) + (SONDERWIRKUNG[name] || 0),
      prereqs: missing,
      isNfg: false,
    });
  }

  // NeuroFlux: jede erreichbare Stufe ist ein eigener Kandidat.
  const nfgRow = state.rows.get(NFG);
  const nfgEntry = CATALOG.get(NFG);
  if (nfgRow && nfgEntry) {
    const nfgScore = multScore(nfgEntry.mults);
    for (let j = 0; j < state.nfgDepth; j++) {
      const level = state.nfgLevel + j; // getLevel() zum Zeitpunkt dieses Kaufs
      const repNeed = nfgEntry.repCost * Math.pow(NFG_LEVEL_MULT, level);
      const from = [...nfgRow.factions].filter((f) => (state.rep.get(f) ?? -1) >= repNeed);
      if (!from.length) {
        if (j === 0) notes.push(`NeuroFlux Stufe ${level + 1}: Reputation reicht nirgends (${fmtNum(repNeed)} noetig)`);
        break; // hoehere Stufen brauchen noch mehr Reputation
      }
      out.push({
        name: `${NFG} Stufe ${level + 1}`,
        base: nfgEntry.moneyCost * Math.pow(NFG_LEVEL_MULT, level),
        faction: from[0],
        // Die erste NFG-Stufe ueberhaupt legt einen neuen Eintrag in
        // Player.augmentations an und zaehlt damit fuer Daedalus mit
        // (AugmentationHelpers.ts:55-65). Jede weitere zaehlt nicht.
        score: nfgScore + (state.nfgLevel === 0 && j === 0 ? state.distinctBonus : 0),
        prereqs: [],
        isNfg: true,
        nfgIndex: j,
        clickName: NFG,
      });
    }
  }

  return { candidates: out, notes };
}

/**
 * Kosten einer festen Kaufreihenfolge, exakt nachgerechnet.
 *
 * Der Preis an Rang i ist base_i * g * 1.9^i. Bei NeuroFlux steckt der Faktor
 * 1.14^Stufe schon in base — aber nur, wenn die Stufen in der richtigen
 * Reihenfolge stehen; deshalb wird hier gegengeprueft statt geglaubt.
 */
function sequenceCost(seq, g) {
  const costs = [];
  let total = 0;
  let seenNfg = 0;
  for (let i = 0; i < seq.length; i++) {
    const c = seq[i];
    if (c.isNfg && c.nfgIndex !== seenNfg++) return null; // Stufen nicht lueckenlos
    const cost = c.base * g * Math.pow(QUEUE_MULT, i);
    costs.push(cost);
    total += cost;
  }
  return { costs, total };
}

/**
 * Bringt eine Auswahl in die guenstigste zulaessige Reihenfolge.
 *
 * Grundregel ist absteigend nach Grundpreis (Umordnungsungleichung, siehe
 * Kopf 2). Zwei Zwaenge brechen sie auf:
 *   - eine Voraussetzung muss vor ihrer Folgeaug stehen,
 *   - NeuroFlux-Stufen muessen in aufsteigender Stufenfolge stehen.
 * Beides wird durch eine stabile topologische Reparatur erzwungen: die
 * Auswahl wird absteigend sortiert und dann so lange nach vorne umgehaengt,
 * bis alle Bedingungen erfuellt sind.
 */
function orderSelection(selection) {
  const sorted = selection.slice().sort((a, b) => b.base - a.base);
  const placed = [];
  const remaining = sorted.slice();
  let guard = remaining.length * remaining.length + 10;
  while (remaining.length && guard-- > 0) {
    const idx = remaining.findIndex((c) => {
      const prereqsDone = c.prereqs.every((p) => placed.some((x) => x.name === p));
      const nfgDone = !c.isNfg || placed.filter((x) => x.isNfg).length === c.nfgIndex;
      return prereqsDone && nfgDone;
    });
    if (idx < 0) return null; // Zyklus oder fehlende Voraussetzung in der Auswahl
    placed.push(remaining.splice(idx, 1)[0]);
  }
  return remaining.length ? null : placed;
}

/**
 * Waehlt die beste Kaufmenge unter dem Budget.
 *
 * Exakte Pareto-Auswahl ueber die absteigend nach Grundpreis sortierten
 * Kandidaten: wer in dieser Reihenfolge als j-ter gewaehlt wird, sitzt genau
 * auf Rang j, also ist der Zuschlag 1.9^j bekannt. Fuer jede Zwischenstufe
 * bleibt nur die Pareto-Front aus (Kosten, Nutzen) stehen.
 *
 * Voraussetzungen werden danach repariert, nicht vorher modelliert: fehlt
 * einer Auswahl eine Voraussetzung, wird die abhaengige Aug entfernt. Das
 * kann in seltenen Faellen unter dem Optimum bleiben; dafuer ist die
 * ausgegebene Reihenfolge immer zulaessig und ihre Summe EXAKT nachgerechnet.
 * Weil nach jedem Kauf neu geplant wird, korrigiert sich der Rest von selbst.
 */
function planPurchases(candidates, money, g, maxSteps) {
  const sorted = candidates.slice().sort((a, b) => b.base - a.base);
  let front = [{ cost: 0, value: 0, pick: [] }];
  for (const c of sorted) {
    const grown = front.slice();
    for (const st of front) {
      if (st.pick.length >= maxSteps) continue;
      const cost = st.cost + c.base * g * Math.pow(QUEUE_MULT, st.pick.length);
      if (cost > money) continue;
      grown.push({ cost, value: st.value + c.score, pick: [...st.pick, c] });
    }
    grown.sort((a, b) => a.cost - b.cost || b.value - a.value);
    const pruned = [];
    let best = -Infinity;
    for (const st of grown) {
      if (st.value > best + 1e-12) {
        pruned.push(st);
        best = st.value;
      }
    }
    front = pruned;
  }

  // Von der besten Front-Loesung abwaerts: die erste, die sich in eine
  // zulaessige Reihenfolge bringen laesst und dann noch ins Budget passt.
  const byValue = front.slice().sort((a, b) => b.value - a.value || a.cost - b.cost);
  for (const st of byValue) {
    let pick = st.pick.slice();
    // Augs mit fehlender Voraussetzung, die nicht mitgewaehlt ist, fliegen raus.
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = pick.length - 1; i >= 0; i--) {
        const missing = pick[i].prereqs.filter((p) => !pick.some((x) => x.name === p));
        if (missing.length) {
          pick.splice(i, 1);
          changed = true;
        }
      }
    }
    if (!pick.length) continue;
    const seq = orderSelection(pick);
    if (!seq) continue;
    const cost = sequenceCost(seq, g);
    if (!cost || cost.total > money) continue;
    return { seq, costs: cost.costs, total: cost.total, value: seq.reduce((a, c) => a + c.score, 0) };
  }
  return { seq: [], costs: [], total: 0, value: 0 };
}

// ===========================================================================
// Oberflaeche: React-Innereien
// ===========================================================================

/** Der Fiber-Knoten zu einem DOM-Element (React 17: "__reactFiber$..."). */
function reactFiber(node) {
  if (!node) return null;
  const key = Object.keys(node).find((k) => k.startsWith("__reactFiber$"));
  return key ? node[key] : null;
}

/**
 * Sucht von einem Knopf aus nach oben die Komponente PurchasableAugmentation
 * und liefert ihre Props.
 *
 * Erkannt wird sie an ihren Props {parent, augName, owned}
 * (PurchasableAugmentations.tsx:145-151) — nicht am Komponentennamen, denn
 * der ueberlebt das Buendeln nicht zuverlaessig.
 *
 * Die Suchtiefe ist grosszuegig: zwischen dem <button> und der Komponente
 * liegen die Verpackungen von MUI (ButtonBase, styled-Wrapper, Box) und die
 * von tss-react. Zu flach zu suchen hiesse, die Zeile gar nicht zu finden —
 * und der Automat wuerde die Seite fuer leer halten statt fuer kaputt.
 */
function rowProps(btn, maxDepth = 30) {
  return fiberPropsUp(btn, (p) => typeof p.augName === "string" && p.parent && typeof p.parent === "object", maxDepth);
}

/**
 * Steigt vom DOM-Knoten den Fiber-Baum hinauf und liefert die ersten Props,
 * auf die `test` passt.
 */
function fiberPropsUp(node, test, maxDepth = 30) {
  let fiber = reactFiber(node);
  for (let i = 0; fiber && i < maxDepth; i++) {
    const p = fiber.memoizedProps;
    if (p && test(p)) return p;
    fiber = fiber.return;
  }
  return null;
}

/** Sichtbarer Text eines Elements, robust gegen Leerraum und Symbole. */
function labelOf(el) {
  return (el.innerText || el.textContent || "").trim();
}

/**
 * Schliesst offene Meldungsfenster, die keinen Kauf-Knopf tragen.
 *
 * Nach jedem Kauf legt purchaseAugmentation eine dialogBoxCreate-Meldung
 * ueber die Seite (FactionHelpers.tsx:122-128). Bliebe sie stehen, saehe die
 * naechste Runde ein Fenster, dessen Text den Aug-Namen enthaelt, und der
 * Hintergrundschleier laege ueber allem.
 *
 * Geschlossen wird ueber den IconButton oben rechts, den JEDES Modal des
 * Spiels traegt und dessen onClick bedingungslos schliesst (Modal.tsx:95).
 * Fenster mit einem Knopf "Purchase" bleiben ausdruecklich stehen — das ist
 * unser eigenes Bestaetigungsfenster.
 *
 * @returns {number} wie viele Fenster geschlossen wurden
 */
function dismissDialogs(doc, keepPurchaseFor = null) {
  const texts = [];
  for (const m of doc.querySelectorAll(".MuiModal-root, [role='presentation']")) {
    const buttons = [...m.querySelectorAll("button")];
    // Unser eigenes Bestaetigungsfenster stehen lassen — aber nur das fuer die
    // Aug, um die es gerade geht. Ein Bestaetigungsfenster einer FRUEHEREN Aug
    // waere sonst unschliessbar und lieferte einen Schleier ueber der ganzen
    // Oberflaeche, bis zufaellig jemand hinsieht.
    if (buttons.some((b) => labelOf(b) === "Purchase")) {
      if (keepPurchaseFor && modalTitle(m) === keepPurchaseFor) continue;
      if (!keepPurchaseFor) continue;
    }
    // Der Schliessknopf traegt nur ein Symbol, also keine Beschriftung.
    const close = buttons.find((b) => b.classList.contains("MuiIconButton-root") && !labelOf(b));
    if (close) {
      // Der Text wird MITGENOMMEN, bevor er verschwindet. Er entscheidet
      // nichts — geprueft wird weiter am Zustand —, aber wenn ein Kauf
      // scheitert, steht der Grund des Spiels genau hier drin
      // (FactionHelpers.tsx:110-115: "You don't have enough money to purchase
      // X", "You already purchased X"). Ihn wegzuwerfen hiesse, jede Nacht
      // mit einem nichtssagenden "keine Zustandsaenderung" aufzuwachen.
      const t = (m.innerText || "").trim().replace(/\s+/g, " ").slice(0, 200);
      if (t) texts.push(t);
      close.click();
    }
  }
  return texts;
}

/**
 * Die Ueberschrift eines Fensters. PurchaseAugmentationModal setzt sie als
 * <Typography variant="h4">{aug.name}</Typography> (:29), MUI bildet variant
 * h4 auf das Element h4 ab.
 */
function modalTitle(m) {
  const h = m.querySelector("h4");
  return h ? labelOf(h) : "";
}

// ===========================================================================
// Oberflaeche: Seiten finden und wechseln
// ===========================================================================

/**
 * Steht die Oberflaeche auf der Arbeitsseite (Page.Work)?
 *
 * DIESE FRAGE IST DIE RICHTIGE - "ist der Fokus an?" war es nicht.
 *
 * Am 20.08. wurde diese Stelle zweimal falsch verstanden. Erst hiess sie
 * "fokussierte Arbeit laeuft", weil sie den Knopf "Do something else
 * simultaneously" als Fokus-Beweis las - den gibt es aber auch bei
 * UNfokussierter Arbeit. Dann wurde sie auf den Gegenknopf "Focus" umgestellt
 * (CharacterOverview.tsx:293), was den Fokus zwar korrekt erkennt, aber am
 * eigentlichen Problem vorbeigeht.
 *
 * Das eigentliche Problem ist die SEITE, nicht der Fokus: `Page.Work` setzt
 * `withSidebar = false` (GameRoot.tsx:325-330). Ohne Seitenleiste gibt es
 * weder den Eintrag "Augmentations" noch die Alt-Tastenkuerzel, die daran
 * haengen (SidebarRoot.tsx:303) - und zwar voellig unabhaengig davon, ob
 * fokussiert wird. Steht die Oberflaeche auf dieser Seite, kommt buyaugs.js
 * nirgendwohin.
 *
 * Der einzige Ausgang ist eben jener Knopf. Ihn zu klicken beendet die Arbeit
 * NICHT (FactionWork laeuft weiter), und seit dem Neuroreceptor-Implant kostet
 * es nicht einmal Reputation - focusPenalty() gibt dann konstant 1 zurueck.
 */
function aufArbeitsseite(doc) {
  return [...doc.querySelectorAll("button")]
    .some((b) => labelOf(b) === "Do something else simultaneously");
}

/**
 * Benennt den Spielzustand, wenn die Faktionsseite unerreichbar ist.
 * Wortgleich uebernommen aus entwurf/join/join.js — dieselben sechs Seiten
 * rendern die Seitenleiste gar nicht (GameRoot.tsx:309-334 und :492-496), und
 * dort haengt auch kein Alt+F-Handler (SidebarRoot.tsx:303).
 */
function detectBlockedPage(doc) {
  const body = (doc.body?.innerText || "").slice(0, 4000);
  const has = (s) => body.includes(s);
  if (aufArbeitsseite(doc)) {
    return "Arbeitsseite offen - ohne Seitenleiste kein Weg weiter (Page.Work)";
  }
  if (has("Recovery Mode") || has("RECOVERY MODE")) return "Recovery-Modus — der Spielstand hat ein Problem";
  if (has("Import Save") || has("Importing this save")) return "Speicherstand-Import wartet auf eine Entscheidung";
  if (has("The Bitverse") || has("Which BitNode")) return "BitVerse (Reset laeuft)";
  if (has("Infiltrating") || has("Get ready")) return "Infiltration laeuft";
  if (!doc.querySelector(".MuiDrawer-root")) return "unbekannte Sonderseite ohne Seitenleiste";
  return "";
}

const onFactionsPage = (doc) =>
  !!(doc.querySelector("span.factions-invites") || doc.querySelector("span.factions-joined"));

/** Der Eintrag "Factions" in der Seitenleiste (SidebarItem.tsx:44). */
function findSidebarItem(doc, label) {
  for (const el of doc.querySelectorAll(".MuiListItemText-root p, .MuiListItemText-root span")) {
    if ((el.textContent || "").trim() !== label) continue;
    const item = el.closest(".MuiListItem-root, .MuiListItemButton-root, [role='button']");
    if (item) return item;
  }
  return null;
}

/**
 * Bringt das Spiel auf die Uebersicht aller Faktionen.
 * Zwei Wege wie in join.js, weil beide je eine Luecke haben. Im Trockenlauf
 * wird fokussierte Arbeit NICHT unterbrochen — das waere ein Eingriff.
 */
async function goToFactionsPage(doc, sleep, log, allowUnfocus) {
  if (onFactionsPage(doc)) return "";

  // Steht die Arbeitsseite offen, MUSS sie verlassen werden - sie blendet die
  // Seitenleiste aus, und daran haengt alles Weitere. Siehe aufArbeitsseite().
  if (aufArbeitsseite(doc)) {
    if (!allowUnfocus) return "Arbeitsseite offen, Verlassen ist hier nicht erlaubt (Trockenlauf)";
    // Mehrfach versuchen und den Erfolg PRUEFEN, statt einmal zu klicken und
    // das Beste zu hoffen. Am 20.08. brach ein Kauflauf in Runde 2 genau hier
    // ab: Der Klick war erfolgt, 600 ms spaeter stand die Arbeitsseite immer
    // noch - entweder war React langsamer, oder ein anderes Skript hatte
    // inzwischen wieder dorthin navigiert. Ein einzelner Klick ohne
    // Gegenprobe ist an dieser Stelle keine Handlung, sondern eine Hoffnung.
    for (let i = 0; i < 4 && aufArbeitsseite(doc); i++) {
      const raus = [...doc.querySelectorAll("button")].find(
        (b) => labelOf(b) === "Do something else simultaneously",
      );
      if (!raus) break;
      raus.click();
      await sleep(700);
    }
    if (aufArbeitsseite(doc)) {
      return "Arbeitsseite laesst sich nicht verlassen - vermutlich navigiert"
        + " ein anderes Oberflaechenskript staendig dorthin zurueck";
    }
    log("Arbeitsseite verlassen (die Faktionsarbeit laeuft weiter).");
  }

  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "f", altKey: true, bubbles: true }));
  await sleep(1000);
  if (onFactionsPage(doc)) return "";

  const item = findSidebarItem(doc, "Factions");
  if (!item) {
    const why = detectBlockedPage(doc);
    return why ? `Faktionsseite unerreichbar: ${why}` : "kein Seitenleisteneintrag Factions gefunden";
  }
  item.click();
  await sleep(1000);
  if (onFactionsPage(doc)) return "";
  const why = detectBlockedPage(doc);
  return why ? `Faktionsseite unerreichbar: ${why}` : "Seitenwechsel blieb wirkungslos";
}

/**
 * Welche Faktion zeigt die gerade offene Augmentierungsseite?
 *
 * Nicht ueber die Ueberschrift, sondern ueber die React-Props einer Zeile:
 * parent.faction ist das echte Faction-Objekt (AugmentationsPage.tsx:258).
 * Damit ist die Seite eindeutig identifiziert, ohne dass ein Text gelesen
 * wird — und wenn keine Zeile da ist, ist es auch nicht die richtige Seite.
 */
function currentAugPageFaction(doc) {
  for (const btn of doc.querySelectorAll("button")) {
    const p = rowProps(btn);
    if (p && p.parent.faction && typeof p.parent.faction.name === "string") return p.parent.faction.name;
  }
  return null;
}

/**
 * Oeffnet die Augmentierungsseite einer Faktion.
 *
 * Der Weg ist der Knopf "Augments" auf der Faktionskarte
 * (FactionsRoot.tsx:118 -> Router.toPage(Page.FactionAugmentations)). Er
 * prueft die Echtheit nicht. Die Karte wird ueber einen Spannenknoten
 * gesucht, dessen Text GENAU der Faktionsname ist (FactionsRoot.tsx:145) —
 * ein Teilstringvergleich wuerde z.B. "Sector-12" in jeder Karte finden, die
 * den Namen im Beschreibungstext fuehrt.
 */
async function openFactionAugPage(doc, sleep, factionName, log, allowUnfocus = false) {
  if (currentAugPageFaction(doc) === factionName) return "";

  const nav = await goToFactionsPage(doc, sleep, log, allowUnfocus);
  if (nav) return nav;

  // Nur innerhalb der Liste der beigetretenen Faktionen suchen
  // (FactionsRoot.tsx:280). Der Augments-Knopf steht nur dort — Nichtmitglieder
  // bekommen entweder "Join!" oder gar keinen Knopf (:117-124).
  const scope = doc.querySelector("span.factions-joined") || doc;
  let target = null;
  let ambiguous = 0;
  for (const btn of scope.querySelectorAll("button")) {
    if (labelOf(btn) !== "Augments") continue;
    const card = btn.closest(".MuiPaper-root");
    if (!card) continue;
    const exact = [...card.querySelectorAll("span")].some((s) => (s.textContent || "").trim() === factionName);
    if (!exact) continue;
    ambiguous++;
    if (!target) target = btn;
  }
  if (!target) return `kein Augments-Knopf fuer "${factionName}" gefunden (Mitgliedschaft weg?)`;
  if (ambiguous > 1) log(`WARNUNG: ${ambiguous} Karten passen auf "${factionName}" — die erste genommen.`);

  target.click();
  // Beim ersten widersprechenden Lesen NICHT aussteigen. React 17 legt die
  // Fiber einmal beim Einhaengen an; je nach Parität zeigt sie danach auf den
  // Alternate, dessen memoizedProps einen Commit alt sind. Direkt nach dem
  // Klick kann also noch der vorige Faktionsname dranstehen — ein Aussteigen
  // an dieser Stelle wuerde einen 300-ms-Lesefehler in einen Nulllauf
  // verwandeln, der wie eine begruendete Entscheidung aussieht.
  let last = null;
  for (let i = 0; i < 12; i++) {
    await sleep(300);
    last = currentAugPageFaction(doc);
    if (last === factionName) return "";
  }
  return last
    ? `Augmentierungsseite zeigt "${last}" statt "${factionName}"`
    : `Augmentierungsseite von "${factionName}" oeffnete sich nicht`;
}

/** Zurueck ans Terminal — und nachsehen, ob es geklappt hat. */
async function backToTerminal(doc, sleep, log) {
  const there = () => !!doc.getElementById("terminal-input");
  if (there()) return true;
  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "t", altKey: true, bubbles: true }));
  await sleep(800);
  if (there()) return true;
  findSidebarItem(doc, "Terminal")?.click();
  await sleep(800);
  const done = there();
  if (!done) log("ACHTUNG: Rueckkehr zum Terminal misslungen — der naechste Terminalbefehl wird scheitern.");
  return done;
}

// ===========================================================================
// Oberflaeche: Zeilen lesen
// ===========================================================================

/**
 * Liest alle Augmentierungszeilen der offenen Seite.
 *
 * Zeilen werden NICHT ueber ihre Beschriftung gefunden, sondern darueber, ob
 * am Knopf ueberhaupt React-Props mit augName haengen. Damit ist die Erkennung
 * unabhaengig von jedem sichtbaren Text.
 *
 * @returns {{rows: Array, rep: number|null, faction: string|null, nfgLevel: number|null}}
 */
function readAugPage(doc) {
  const rows = [];
  let rep = null;
  let faction = null;
  const seen = new Set();
  for (const btn of doc.querySelectorAll("button")) {
    const p = rowProps(btn);
    if (!p) continue;
    if (seen.has(p.augName)) continue; // owned- und purchasable-Liste ueberschneiden sich nicht,
    seen.add(p.augName); // aber ein Doppeltreffer waere sonst still
    rows.push({ name: p.augName, owned: !!p.owned, disabled: !!btn.disabled, btn });
    if (rep === null && typeof p.parent.rep === "number") rep = p.parent.rep;
    if (!faction && p.parent.faction && typeof p.parent.faction.name === "string") faction = p.parent.faction.name;
  }

  // Die NeuroFlux-Stufe ist die einzige Zahl, die wir aus dem Text lesen —
  // und sie steht dort als blosse Ganzzahl ohne Zahlenformatierer
  // (PurchasableAugmentations.tsx:230 `Level ${augLevel + 1}`), also
  // unabhaengig von Settings.Locale und Settings.CurrencySymbol.
  let nfgLevel = null;
  const nfgRow = rows.find((r) => r.name === NFG);
  if (nfgRow) {
    const card = nfgRow.btn.closest(".MuiPaper-root");
    const m = card && (card.innerText || "").match(/Level\s+(\d+)/);
    if (m) nfgLevel = Number(m[1]) - 1; // angezeigt wird getNextLevel()
  }
  return { rows, rep, faction, nfgLevel };
}

// ===========================================================================
// Oberflaeche: die Warteschlange direkt lesen
// ===========================================================================
//
// Das ist die wichtigste Zahl des ganzen Automaten. q — die Laenge der
// Warteschlange — geht als 1.9^q in JEDEN Preis ein; ist q um eins zu klein,
// sind alle Preise um 90% zu niedrig.
//
// Aus den Faktionsseiten allein laesst sich q NICHT vollstaendig herleiten.
// Der Grund ist der DarkNet-Irrgarten: cacheFiles.ts ruft
// Player.queueAugmentation direkt auf, und die Belohnungen (The W1ngs of
// Icarus, The B00ts of Perseus, The H4mmer of Daedalus, The St4ff of
// Asclepius, The L4w of Bayes, The B1ade of Solomonoff) haben in
// Augmentations.ts `factions: []` — sie stehen also auf KEINER Faktionsseite,
// zaehlen aber voll in getGenericAugmentationPriceMultiplier. Wer q aus den
// Faktionsseiten zaehlt, uebersieht sie und rechnet mit falschen Preisen
// weiter, ohne es zu merken.
//
// Die Augmentierungsseite zeigt die Warteschlange dagegen vollstaendig:
// PurchasedAugmentations.tsx laeuft ueber Player.queuedAugmentations und legt
// je Eintrag ein <ListItemText primary={displayName}> an (:56). NeuroFlux wird
// dabei zu EINEM Eintrag mit seiner hoechsten Stufe zusammengezogen (:14-25).
// Gelesen wird nicht der dargestellte Text, sondern die React-Prop `primary` —
// und nur PurchasedAugmentations gibt ListItemText ueberhaupt ein `primary`:
// die Seitenleiste uebergibt Kinder (SidebarItem.tsx:43-45), die Liste der
// installierten Augs benutzt ListItemButton mit Typography
// (InstalledAugmentations.tsx:88-92).
//
// ACHTUNG: auf dieser Seite steht der Knopf "Install Augmentations"
// (AugmentationsRoot.tsx:173). Hier wird NICHTS angeklickt. Nur gelesen.

/** Beschriftung, an der die Augmentierungsseite erkannt wird. */
const INSTALL_LABEL = "Install Augmentations";

const onAugmentationsPage = (doc) =>
  [...doc.querySelectorAll("button")].some((b) => labelOf(b) === INSTALL_LABEL);

/**
 * Wechselt auf die Augmentierungsseite. Ohne Klick auf irgendetwas dort.
 *
 * Fehlt der Seitenleisteneintrag, ist die Seite gesperrt — und das heisst
 * laut SidebarRoot.tsx:165-169 zwingend, dass die Warteschlange LEER ist
 * (canOpenAugmentations ist wahr, sobald queuedAugmentations.length > 0).
 * Dieser Fall ist also kein Fehler, sondern die Antwort q = 0.
 */
async function goToAugmentationsPage(doc, sleep, allowUnfocus = false) {
  if (onAugmentationsPage(doc)) return "";
  // HIER WIRD NICHT GEKLICKT - und das ist ein Befund, kein Versaeumnis.
  //
  // Der naheliegende Gedanke war, denselben Ausweg wie in goToFactionsPage
  // einzubauen: Steht die Arbeitsseite offen, fehlt die Seitenleiste und damit
  // der Eintrag "Augmentations". In der Nacht zum 21.08. wurde genau das
  // versucht - und hat das Skript zuverlaessig zum HAENGEN gebracht. Zweimal
  // hintereinander blieb buyaugs.js exakt hier stehen, jeweils ueber zehn
  // Minuten, ohne eine weitere Zeile zu schreiben; davor und danach lief
  // dieselbe Fassung ohne den Klick sauber durch.
  //
  // Woran es liegt, ist ohne Browserzugriff nicht zu klaeren - der Verdacht
  // faellt auf ein modales Fenster, das der Klick an dieser Stelle oeffnet.
  // Sicher ist nur die Wirkung, und ein Haenger ist schlimmer als ein
  // Fehlschlag: Autopilot und Nachtsteuerung warten beide, solange ein
  // Oberflaechenskript laeuft, also legt ein Haenger den ganzen Betrieb still.
  // Ein Fehlschlag kostet nur diesen einen Lauf, und der naechste Takt
  // versucht es in drei Minuten erneut.
  const item = findSidebarItem(doc, "Augmentations");
  if (!item) {
    const why = detectBlockedPage(doc);
    return why ? `Augmentierungsseite unerreichbar: ${why}` : "kein Seitenleisteneintrag Augmentations";
  }
  item.click();
  for (let i = 0; i < 12; i++) {
    await sleep(300);
    if (onAugmentationsPage(doc)) return "";
  }
  return "Augmentierungsseite oeffnete sich nicht";
}

/**
 * Liest die Warteschlange von der offenen Augmentierungsseite.
 *
 * @returns {{names: string[], nfgLevel: number|null, unknown: string[]}}
 *          names enthaelt jeden wartenden Eintrag EINMAL; NeuroFlux steht als
 *          ein Eintrag darin, seine Stufe getrennt in nfgLevel.
 */
function readQueue(doc) {
  const names = [];
  const unknown = [];
  let nfgLevel = null;
  for (const el of doc.querySelectorAll(".MuiListItemText-root")) {
    const p = fiberPropsUp(el, (x) => typeof x.primary === "string", 6);
    if (!p) continue;
    // "NeuroFlux Governor - Level 22" -> Name und Stufe. Nur diese eine Form
    // wird abgeschnitten; Namen wie "Cranial Signal Processors - Gen I"
    // enthalten ebenfalls " - " und duerfen nicht angetastet werden.
    const m = p.primary.match(/^(.*?) - Level (\d+)$/);
    const name = m ? m[1] : p.primary;
    if (!CATALOG.has(name)) {
      unknown.push(p.primary);
      continue;
    }
    if (name === NFG) nfgLevel = m ? Number(m[2]) : nfgLevel;
    if (!names.includes(name)) names.push(name);
  }
  return { names, nfgLevel, unknown };
}

// ===========================================================================
// Oberflaeche: kaufen
// ===========================================================================

/**
 * Fuehrt genau einen Kauf aus und prueft danach am Zustand nach, ob er wirkte.
 *
 * Der Ablauf ist bewusst kleinschrittig, weil jeder Schritt schiefgehen kann:
 *  1. Knopf suchen. Ist er disabled, sagt DAS SPIEL, dass der Kauf gerade
 *     nicht geht (AugmentationsPage.tsx:240-248) — dann wird nicht geklickt.
 *  2. Klicken. Danach entweder Bestaetigungsfenster oder direkter Kauf.
 *  3. Warten, bis der Zustand umspringt.
 *
 * @returns {Promise<{ok:boolean, reason:string, spent:number}>}
 */
async function buyOne(o) {
  const { doc, sleep, log, augName, faction, expectedCost, getMoney, isNfg, nfgLevelBefore } = o;
  const dialogs = [];
  // Waehrend der Pruefung laeuft der Ertrag weiter und hebt das Guthaben
  // wieder an. Bei einem Kauf ueber Milliarden faellt das nicht ins Gewicht,
  // bei einem ueber Millionen schon — dann wuerde der Abgleich unten
  // faelschlich "Preismodell passt nicht" melden. Deshalb ein Freibetrag aus
  // dem GEMESSENEN Ertrag mal der laengstmoeglichen Wartezeit.
  //
  // Gedeckelt auf ein Viertel des Preises: der Ertrag wird ueber EINE Sekunde
  // gemessen, und HWGW-Ertrag kommt in Brocken. Faellt ein grosser Batch genau
  // in diese Sekunde, waere der Freibetrag groesser als jeder Aug-Preis und
  // der Guthaben-Zeuge damit abgeschaltet — er darf gedaempft werden, aber nie
  // ausgeschaltet.
  const incomeAllowance = Math.min(Math.max(0, Number(o.incomePerSec) || 0) * 6, expectedCost * 0.25);

  // Erst aufraeumen: eine stehengebliebene Meldung aus einem frueheren Lauf
  // haette den Aug-Namen im Text und wuerde unten als Bestaetigungsfenster
  // durchgehen. Auch ein Bestaetigungsfenster einer ANDEREN Aug fliegt raus.
  const stale = dismissDialogs(doc, augName);
  if (stale.length) {
    log(`  ${stale.length} stehengebliebene Meldung(en) geschlossen.`);
    dialogs.push(...stale);
    await sleep(300);
  }

  const findRow = () => readAugPage(doc).rows.find((r) => r.name === augName);
  const row = findRow();
  if (!row) return { ok: false, reason: `Zeile fuer "${augName}" nicht auf der Seite`, spent: 0, dialogs };
  if (row.owned) return { ok: false, reason: `"${augName}" gilt bereits als gekauft`, spent: 0, dialogs };
  if (row.disabled) {
    return {
      ok: false,
      reason: `Kauf-Knopf fuer "${augName}" ist gesperrt — das Spiel haelt den Kauf gerade fuer unmoeglich`,
      spent: 0,
      dialogs,
    };
  }
  // Ohne die Stufe VOR dem Klick gaebe es bei NeuroFlux keinen Zeugen fuer den
  // Erfolg — nur das Guthaben, und das bewegt der Autopilot nebenher auch.
  if (isNfg && typeof nfgLevelBefore !== "number") {
    return { ok: false, reason: "NeuroFlux-Stufe war vor dem Klick nicht ablesbar — nicht gekauft", spent: 0, dialogs };
  }
  // Sicherung gegen den einen Klick, der alles kostet: dieser Automat
  // installiert nicht.
  if (/install/i.test(labelOf(row.btn))) {
    return { ok: false, reason: "Knopf traegt 'Install' — nicht angefasst", spent: 0, dialogs };
  }

  const moneyBefore = await getMoney();
  row.btn.click();
  log(`  Klick auf Buy: ${augName} (erwartet $${fmtMoney(expectedCost)})`);

  // Bestaetigungsfenster, falls Settings.SuppressBuyAugmentationConfirmation
  // aus ist. Es traegt die Ueberschrift mit dem Aug-Namen und einen Knopf
  // "Purchase" (PurchaseAugmentationModal.tsx:29-47).
  //
  // Verglichen wird die Ueberschrift EXAKT, nicht als Teilstring. Der Katalog
  // ist voller Praefixe — "Combat Rib I" steckt in "Combat Rib II", "Embedded
  // Netburner Module" in vier weiteren Namen. Ein Teilstringvergleich koennte
  // das Fenster einer anderen Aug erwischen und sie fuer 1.9^q kaufen. Nach
  // dem ersten Treffer wird abgebrochen, damit nicht zwei Fenster quittiert
  // werden.
  let confirmed = false;
  for (let i = 0; i < 8 && !confirmed; i++) {
    await sleep(250);
    for (const m of doc.querySelectorAll(".MuiModal-root, [role='presentation']")) {
      if (modalTitle(m) !== augName) continue;
      const ok = [...m.querySelectorAll("button")].find((b) => labelOf(b) === "Purchase");
      if (ok) {
        ok.click();
        log("  Bestaetigungsfenster mit Purchase quittiert.");
        confirmed = true;
        break;
      }
    }
  }

  // Wirkungspruefung. Zwei unabhaengige Zeugen, siehe Kopf (4).
  //
  // In jeder Runde wird die Erfolgsmeldung des Spiels weggeraeumt, sonst
  // stapeln sich ueber mehrere Kaeufe die Fenster. Das Wegraeumen ist KEINE
  // Erfolgspruefung — geprueft wird ausschliesslich unten an owned bzw. an der
  // NeuroFlux-Stufe und am Guthaben.
  for (let i = 0; i < 12; i++) {
    await sleep(350);
    dialogs.push(...dismissDialogs(doc, augName));

    // Wandert die Seite unter uns weg — der Nachtdienst schaltet im
    // 30-Sekunden-Takt, und ein Mensch am Rechner kann es auch —, dann sind
    // alle Zeugen hier blind: die Zeile ist weg, `owned` ist undefined, und
    // ein tatsaechlich getaetigter Kauf saehe aus wie ein Fehlschlag. Das ist
    // kein Fehlschlag, sondern ein unbekannter Ausgang; die naechste Runde
    // liest den Zustand neu und weiss es dann.
    if (faction && currentAugPageFaction(doc) !== faction) {
      return {
        ok: false,
        inconclusive: true,
        reason: `die Seite wechselte waehrend der Pruefung von "${faction}" weg — Ausgang unbekannt`,
        spent: Math.max(0, moneyBefore - (await getMoney())),
        dialogs,
      };
    }

    const money = await getMoney();
    const drop = moneyBefore - money;
    const page = readAugPage(doc);
    const nowRow = page.rows.find((r) => r.name === augName);
    const stateSays = isNfg ? page.nfgLevel === nfgLevelBefore + 1 : !!nowRow && nowRow.owned;
    if (!stateSays) continue;

    // Der Abgleich mit dem Guthaben ist ZWEISEITIG. Die untere Schranke faengt
    // ein zu grosses q ab (wir haben zu teuer gerechnet), die obere ein zu
    // kleines (wir haben zu billig gerechnet) — und genau das ist der
    // gefaehrlichere Fehler, denn er laesst den Automaten weiterkaufen. Die
    // obere Schranke liegt bei 1.5 und damit unter 1.9: ein einziger
    // uebersehener Warteschlangeneintrag faellt sicher auf, waehrend
    // nebenherlaufende Serverkaeufe des Autopiloten im Rahmen bleiben.
    //
    // ...aber nur, solange das Guthaben ueberhaupt noch etwas bezeugen kann.
    // Am 20.08. um 15:24 fiel der erste Kauf durch, weil das Konto waehrend
    // der zwei Sekunden Wartezeit um 1,219 Mrd STIEG - die Aug kostete 5,5
    // Mio. Der Freibetrag oben ist auf ein Viertel des Preises gedeckelt (aus
    // gutem Grund: sonst schaltet ein einzelner grosser HWGW-Brocken den
    // Zeugen ganz ab), und ein Viertel von 5,5 Mio sind 1,4 Mio gegen 1.219
    // Mio Zufluss. Der Zeuge ist an dieser Stelle nicht ungenau, er ist
    // blind.
    //
    // Wo er blind ist, darf er nicht urteilen. `stateSays` oben ist der
    // direkte Beweis aus dem Spielzustand - die Zeile steht auf "owned" bzw.
    // die NeuroFlux-Stufe ist gestiegen. Der Guthaben-Abgleich ist nur die
    // Zusatzpruefung gegen ein falsches Preismodell, und die entfaellt, wenn
    // der laufende Ertrag den erwarteten Preis ueberhaupt erreichen kann.
    // Zusaetzlich - und unabhaengig von jeder Ertragsmessung: Ein NEGATIVER
    // Rueckgang widerlegt nicht den Kauf, er widerlegt den Zeugen. Ein Kauf
    // kann ein Konto nicht erhoehen; steht es hinterher hoeher, hat der Zufluss
    // den Abfluss vollstaendig ueberdeckt, und die Differenz sagt nichts mehr.
    //
    // Diese Zeile fehlte am 20.08., und sie hat den Kauflauf gekostet: Der
    // Ertrag wurde in diesem Lauf mit $0,00/s gemessen (im Lauf davor mit
    // 70,9 Mrd/s - die Messung ist nicht verlaesslich), damit galt der Zeuge
    // als tauglich. Er meldete daraufhin zwei Fehlschlaege in Folge und brach
    // ab, obwohl BEIDE Augmentierungen sauber in der Warteschlange standen.
    // Sich auf die Ertragsmessung zu verlassen, heisst den Zeugen von einer
    // zweiten unsicheren Messung abhaengig zu machen; das Vorzeichen dagegen
    // ist ein Fakt.
    const zeugeTaugt = drop > 0 && expectedCost * 0.25 > (Number(o.incomePerSec) || 0) * 6;
    if (!zeugeTaugt) {
      log(`  (Guthaben-Abgleich uebersprungen: Ertrag uebersteigt den Preis von $${fmtMoney(expectedCost)}`
        + ` - der Zustand bezeugt den Kauf.)`);
      return { ok: true, reason: "", spent: Math.max(0, drop), dialogs };
    }
    if (drop < expectedCost * 0.95 - incomeAllowance || drop > expectedCost * 1.5) {
      return {
        ok: false,
        reason:
          `Zustand meldet Kauf, aber das Guthaben fiel um $${fmtMoney(drop)} statt $${fmtMoney(expectedCost)}` +
          ` — Preismodell passt nicht zum Spiel`,
        spent: drop,
        dialogs,
      };
    }
    return { ok: true, reason: "", spent: drop, dialogs };
  }

  dialogs.push(...dismissDialogs(doc, augName));
  const drop = moneyBefore - (await getMoney());
  return {
    ok: false,
    reason: `keine Zustandsaenderung nach dem Klick (Guthaben ${drop >= 0 ? "-" : "+"}$${fmtMoney(Math.abs(drop))})`,
    spent: Math.max(0, drop),
    dialogs,
  };
}

// ===========================================================================
// Nachtdienst
// ===========================================================================

/**
 * Nimmt den Nachtdienst aus dem Verkehr, solange hier die Seite gewechselt
 * wird — er bedient dieselbe Oberflaeche im 30-Sekunden-Takt. Gegen
 * Verschachtelung abgesichert wie in join.js: hat ihn schon jemand, wird er
 * hier nicht wieder losgelassen.
 */
function grabNightshift(doc) {
  let service = null;
  try {
    service = doc.defaultView.__nightshift;
  } catch {
    return { refresh: () => {}, release: () => {} };
  }
  if (!service || service.busy) return { refresh: () => {}, release: () => {} };
  service.busy = true;
  let timer = null;
  const arm = () => {
    try {
      if (timer !== null) doc.defaultView.clearTimeout(timer);
      timer = doc.defaultView.setTimeout(() => (service.busy = false), 600000);
    } catch {
      /* kein Fenster, auch gut */
    }
  };
  arm();
  return {
    // Der Selbstloeser ist gegen einen ABGESTUERZTEN Aufrufer gedacht, nicht
    // gegen einen langsamen. Ein Lauf mit vielen Faktionen und mehreren
    // Kaeufen kann die zehn Minuten ueberschreiten; dann liefe der Nachtdienst
    // mitten in der Kaufserie wieder an und zoege uns die Seite weg. Deshalb
    // wird der Zeitgeber zu Beginn jeder Runde neu aufgezogen.
    refresh: arm,
    release: () => {
      service.busy = false;
      try {
        if (timer !== null) doc.defaultView.clearTimeout(timer);
      } catch {
        /* egal */
      }
    },
  };
}

// ===========================================================================
// Darstellung
// ===========================================================================

function fmtMoney(n) {
  if (!Number.isFinite(n)) return String(n);
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(3) + "t";
  if (a >= 1e9) return (n / 1e9).toFixed(3) + "b";
  if (a >= 1e6) return (n / 1e6).toFixed(3) + "m";
  if (a >= 1e3) return (n / 1e3).toFixed(3) + "k";
  return n.toFixed(2);
}
function fmtNum(n) {
  if (!Number.isFinite(n)) return String(n);
  return Math.abs(n) >= 1e3 ? (n / 1e3).toFixed(3) + "k" : n.toFixed(1);
}

// ===========================================================================
// Zustand einsammeln
// ===========================================================================

/**
 * Liest den ganzen Zustand: erst die Warteschlange, dann die Faktionsseiten.
 *
 * Die Warteschlangenlaenge q wird DIREKT von der Augmentierungsseite gelesen
 * (siehe readQueue), nicht aus den Faktionsseiten hergeleitet. Die Herleitung
 * ueber die Faktionsseiten laeuft trotzdem mit — als Gegenprobe. Widersprechen
 * sich die beiden, ist etwas faul, und es wird nicht gekauft.
 */
async function collectState(o) {
  const { doc, sleep, log, factions, installedAugs, allowUnfocus } = o;
  const rows = new Map();
  const rep = new Map();
  const problems = [];
  // Faktionen, deren Seite nicht gelesen werden konnte. Sie kosten uns
  // Kandidaten und Reputationswerte — aber seit q direkt gelesen wird, nicht
  // mehr die Preise. Deshalb sind sie eine Warnung, kein Abbruchgrund.
  const unread = [];
  let contradiction = false;
  const installedNfg = installedAugs.get(NFG) ?? 0;

  // --- 1. die Warteschlange, vollstaendig --------------------------------
  let q = null;
  let queuedNfg = null;
  let queuedNames = [];
  const navQueue = await goToAugmentationsPage(doc, sleep, allowUnfocus);
  if (navQueue) {
    problems.push(navQueue);
  } else {
    const queue = readQueue(doc);
    for (const u of queue.unknown) problems.push(`unbekannter Warteschlangeneintrag "${u}" (Katalog veraltet?)`);
    queuedNames = queue.names;
    queuedNfg = queue.nfgLevel === null ? 0 : queue.nfgLevel - installedNfg;
    if (queuedNfg < 0) {
      problems.push(`NeuroFlux: Warteschlange meldet Stufe ${queue.nfgLevel}, installiert sind ${installedNfg}`);
      queuedNfg = null;
    } else {
      // NeuroFlux steht als EIN Eintrag in der Liste, vertritt dort aber alle
      // seine Stufen; SoA-Augs zaehlen gar nicht mit
      // (AugmentationHelpers.ts:31-35).
      const others = queuedNames.filter((n) => n !== NFG && !SOA_AUGS.has(n)).length;
      q = others + queuedNfg;
      log(`  Warteschlange: ${queuedNames.length} Eintraege, davon ${queuedNfg}x NeuroFlux -> q=${q}`);
    }
  }
  const nfgLevel = queuedNfg === null ? installedNfg : installedNfg + queuedNfg;

  // --- 2. die Faktionsseiten ---------------------------------------------
  for (const f of factions) {
    const err = await openFactionAugPage(doc, sleep, f, log, allowUnfocus);
    if (err) {
      problems.push(`${f}: ${err}`);
      unread.push(f);
      continue;
    }
    await sleep(250);
    const page = readAugPage(doc);
    if (page.faction && page.faction !== f) {
      problems.push(`${f}: Seite meldet "${page.faction}"`);
      unread.push(f);
      continue;
    }
    if (typeof page.rep === "number") rep.set(f, page.rep);
    else {
      problems.push(`${f}: Reputation liess sich nicht aus den React-Props lesen`);
      unread.push(f);
    }
    // Gegenprobe: die Faktionsseite zeigt in der NeuroFlux-Zeile dieselbe
    // Stufe, die auch die Warteschlange nennt. Weichen sie ab, hat eine der
    // beiden Quellen veraltete React-Props — dann wird nicht gekauft.
    if (page.nfgLevel !== null && page.nfgLevel !== nfgLevel) {
      problems.push(`NeuroFlux: Warteschlange sagt Stufe ${nfgLevel}, ${f} zeigt ${page.nfgLevel}`);
      contradiction = true;
    }
    for (const r of page.rows) {
      const prev = rows.get(r.name);
      if (prev) {
        prev.factions.add(f);
        // owned ist eine Eigenschaft des Spielers, nicht der Faktion. Sind
        // sich zwei Seiten uneins, hat eine veraltete Props — dann gilt
        // owned, denn ein Kauf laesst sich nicht zuruecknehmen.
        prev.owned = prev.owned || r.owned;
      } else {
        // `disabled` wird hier bewusst NICHT uebernommen: es haengt am
        // Guthaben zum Zeitpunkt des Lesens und waere beim Kauf laengst
        // veraltet. buyOne liest es unmittelbar vor dem Klick frisch.
        rows.set(r.name, { owned: r.owned, factions: new Set([f]) });
      }
    }
    log(`  ${f}: ${page.rows.length} Zeilen, Reputation ${fmtNum(page.rep ?? NaN)}`);
  }

  // --- 3. Gegenprobe -----------------------------------------------------
  // Jede Aug, die eine Faktionsseite als gekauft zeigt, obwohl sie weder
  // installiert ist noch in der Warteschlange steht, ist ein Widerspruch
  // zwischen zwei Quellen, die dasselbe Feld beschreiben. Dann stimmt eine
  // von beiden nicht, und q ist nicht belastbar.
  for (const [name, r] of rows) {
    if (!r.owned || name === NFG) continue;
    if (installedAugs.has(name) || queuedNames.includes(name)) continue;
    problems.push(`"${name}" gilt auf der Faktionsseite als gekauft, steht aber nicht in der Warteschlange`);
    contradiction = true;
  }

  return {
    rows,
    rep,
    q,
    queuedNfg,
    queuedNames,
    queuedNonNfg: queuedNames.filter((n) => n !== NFG && !SOA_AUGS.has(n)),
    nfgLevel,
    problems,
    unread,
    contradiction,
    // Gekauft wird nur, wenn q direkt gelesen wurde und die Gegenprobe haelt.
    // Eine ungelesene Faktion kostet uns hoechstens einen Kandidaten — sie
    // verfaelscht seit der direkten Lesung KEINEN Preis mehr und ist deshalb
    // kein Abbruchgrund, sondern eine Warnung.
    trustworthy: q !== null && !contradiction,
  };
}

// ===========================================================================
// main
// ===========================================================================

export async function main(ns) {
  ns.disableLog("ALL");

  // Der Bericht wird VOR ns.flags eingerichtet. ns.flags wirft bei jedem
  // Schalter, der nicht im Schema steht (NetscriptFunctions/Flags.ts,
  // permissive ist aus) — und dann stuende in data/augs.txt weiterhin der
  // Bericht des VORIGEN Laufs, der sich wie ein geglueckter Durchgang liest.
  // Der Auftragslaeufer im Autopiloten meldet nur "Auftrag laeuft" und erfaehrt
  // von dem Tod nichts (src/autopilot.js:557-582).
  let OUT = "data/augs.txt";
  const HOST = ns.getHostname();
  const lines = [];
  const flush = () => {
    try {
      ns.write(OUT, lines.join("\n") + "\n", "w");
      if (HOST !== "home") ns.scp(OUT, "home", HOST);
    } catch (e) {
      ns.print("Bericht konnte nicht geschrieben werden: " + e);
    }
  };
  // Nach JEDER Zeile schreiben: stirbt das Skript mitten im Lauf, ist der
  // Stand bis dahin trotzdem von aussen lesbar.
  const say = (s) => {
    lines.push(s);
    ns.print(s);
    flush();
  };

  say(`# buyaugs.js — ${new Date().toISOString()} auf ${HOST} — args: ${ns.args.join(" ") || "(keine)"}`);

  let flags;
  try {
    flags = ns.flags([
      ["dry", false], // nur rechnen und berichten, nichts kaufen
      ["max", 6], // hoechstens so viele Kaeufe in einem Lauf
      ["reserve", 0], // diesen Betrag nicht antasten (z.B. fuer home-RAM)
      ["distinct", DEFAULT_DISTINCT_BONUS],
      ["nfgdepth", 25], // wie viele NeuroFlux-Stufen der Planer betrachtet
      ["minvalue", 0], // Mindestnutzen je Milliarde; 0 = aus. Massstab: YARDSTICK
      ["allowunfocus", false], // laufende fokussierte Arbeit unterbrechen?
      ["out", "data/augs.txt"],
      ["help", false],
    ]);
  } catch (e) {
    say("ABBRUCH: Schalter nicht verstanden — " + (e && e.message ? e.message : String(e)));
    say("Bekannt sind: --dry --max --reserve --distinct --nfgdepth --minvalue --allowunfocus --out --help");
    return;
  }
  OUT = String(flags.out);

  if (flags.help) {
    say("Aufruf: run buyaugs.js [--dry] [--max 6] [--reserve 0] [--distinct 0.15] [--minvalue 0] [--nfgdepth 25] [--allowunfocus]");
    say("  --minvalue <Nutzen je Mrd> laesst alles liegen, was schlechter ist als der Massstab " + YARDSTICK + ".");
    say("  --dry  aendert keinen Spielzustand. Er wechselt die angezeigte Seite (Augmentierungsseite fuer die");
    say("         Warteschlange, dann je Faktion die Angebotsseite) und meldet den Plan. Auf der");
    say("         Augmentierungsseite wird NICHTS angeklickt — dort steht der Install-Knopf.");
    say("  --reserve haelt einen Betrag frei — sinnvoll, weil home-RAM den Reset UEBERLEBT und Geld nicht.");
    return;
  }

  const maxSteps = Math.max(0, Math.floor(Number(flags.max)));
  // --max 0 heisst "plane, kaufe aber nicht" — das ist genau der Trockenlauf.
  // Ohne diese Zeile liefe der Automat einmal durch und meldete am Ende
  // wahrheitswidrig "nichts ist leistbar".
  const dry = !!flags.dry || maxSteps === 0;
  const reserve = Math.max(0, Number(flags.reserve));
  const distinctBonus = Number(flags.distinct);
  // Im Trockenlauf wird fokussierte Arbeit NIE unterbrochen — das waere ein
  // Eingriff in den Spielzustand, und genau den verspricht --dry nicht zu tun.
  // Frueher musste --allowunfocus ausdruecklich gesetzt werden. Das war eine
  // Huerde ohne Gegenwert: Die Arbeitsseite zu verlassen beendet keine Arbeit
  // und kostet dank Neuroreceptor-Implant keine Reputation - ohne diesen
  // Schritt kauft buyaugs.js aber ueberhaupt nichts, sobald die Oberflaeche
  // zufaellig auf Page.Work steht. Genau daran scheiterten am 20.08. abends
  // zwei Kauflaeufe der Nachtsteuerung.
  //
  // Im Trockenlauf bleibt es verboten - der darf den Spielzustand nicht
  // anfassen, auch nicht die angezeigte Seite.
  const allowUnfocus = !dry;

  const doc = document; // einziger Ort mit diesem Bezeichner, siehe Kopf
  const sleep = (ms) => ns.sleep(ms);
  const getMoney = async () => ns.getServerMoneyAvailable("home");

  // Ertrag messen statt schaetzen — er geht als Freibetrag in die
  // Kaufpruefung ein. Faellt das Guthaben in dieser Sekunde (der Autopilot
  // kauft nebenher Server), wird 0 angenommen; dann ist die Pruefung strenger,
  // und das ist die richtige Richtung: lieber abbrechen als weiterkaufen.
  const moneyT0 = await getMoney();
  await sleep(1000);
  const incomePerSec = Math.max(0, (await getMoney()) - moneyT0);

  const player = ns.getPlayer();
  const reset = ns.getResetInfo();
  const installedAugs =
    reset.ownedAugs instanceof Map ? reset.ownedAugs : new Map(Object.entries(reset.ownedAugs || {}));
  const factions = player.factions.slice();

  say(`Guthaben $${fmtMoney(player.money)}, Reserve $${fmtMoney(reserve)}, hoechstens ${maxSteps} Kaeufe.`);
  say(`Ertrag gemessen: $${fmtMoney(incomePerSec)}/s (Freibetrag der Kaufpruefung).`);
  say(`Faktionen: ${factions.join(", ") || "keine"}`);
  say(`Installiert: ${[...installedAugs.keys()].length} verschiedene (NeuroFlux Stufe ${installedAugs.get(NFG) ?? 0}).`);
  if (dry) say("TROCKENLAUF: es wird nichts gekauft.");

  if (!factions.length) {
    say("ERGEBNIS: ohne Faktionsmitgliedschaft gibt es nichts zu kaufen.");
    return;
  }

  const nightshift = grabNightshift(doc);
  let failures = 0;  // Kaeufe ohne jede Wirkung
  let moved = 0;     // Runden, in denen uns die Oberflaeche weggewandert ist
  try {
    for (let step = 0; step < Math.max(1, maxSteps); step++) {
      // --- Zustand frisch lesen ----------------------------------------
      // Nach JEDEM Kauf komplett neu: Preise, Warteschlange und Reputation
      // haben sich geaendert, und ausserdem gibt der Autopilot nebenher Geld
      // fuer Server aus. Ein einmal gerechneter Plan waere nach dem ersten
      // Schritt schon falsch.
      nightshift.refresh();
      say(`--- Runde ${step + 1}: Zustand lesen ---`);
      const state = await collectState({ doc, sleep, log: say, factions, installedAugs, allowUnfocus });
      for (const p of state.problems) say(`  PROBLEM: ${p}`);

      if (state.q === null) {
        say("ABBRUCH: die Laenge der Warteschlange liess sich nicht bestimmen — ohne sie ist jeder Preis geraten.");
        break;
      }
      const g = Math.pow(QUEUE_MULT, state.q);
      say(
        `Warteschlange q=${state.q} (${state.queuedNfg}x NeuroFlux + ${state.queuedNonNfg.length} andere` +
          `${state.queuedNonNfg.length ? ": " + state.queuedNonNfg.join(", ") : ""}) -> Preisfaktor 1.9^${state.q} = ${g.toPrecision(6)}`,
      );
      say(`NeuroFlux steht bei Stufe ${state.nfgLevel}, die naechste waere ${state.nfgLevel + 1}.`);
      if (state.unread.length) {
        say(
          `  WARNUNG: nicht gelesen: ${state.unread.join(", ")}. Die Preise stimmen trotzdem (q kommt aus der` +
            ` Warteschlange), aber Kandidaten und Reputation dieser Faktionen fehlen im Plan.`,
        );
      }

      const money = await getMoney();
      const budget = Math.max(0, money - reserve);
      say(`Guthaben $${fmtMoney(money)}, davon einsetzbar $${fmtMoney(budget)}.`);

      const { candidates, notes } = buildCandidates({
        rows: state.rows,
        rep: state.rep,
        installed: new Set(installedAugs.keys()),
        nfgLevel: state.nfgLevel,
        distinctBonus,
        // Untergrenze 0, nicht 1. Mit der 1 war "--nfgdepth 0" wirkungslos -
        // der Planer betrachtete trotzdem eine NeuroFlux-Stufe und kaufte sie
        // auch. Genau das sollte der Schalter verhindern: Jeder Posten in der
        // Warteschlange verteuert den naechsten um 1,9, und NeuroFlux laesst
        // sich unbegrenzt stapeln - der alte Nachtdienst hat auf diesem Weg
        // "Milliarden verbrannt" und wurde deshalb stillgelegt. Wer 0 sagt,
        // meint 0.
        nfgDepth: Math.max(0, Math.floor(Number(flags.nfgdepth) || 0)),
      });
      for (const n of notes) say(`  Hinweis: ${n}`);

      // Mindestnutzen: wer unbeaufsichtigt kauft, will nicht, dass eine
      // wertlose Aug fuer Milliarden mitgenommen wird, nur weil sie den
      // Daedalus-Zaehler um eins hebt. Der Massstab steht bei YARDSTICK.
      const minValue = Math.max(0, Number(flags.minvalue));
      if (minValue > 0) {
        for (let i = candidates.length - 1; i >= 0; i--) {
          const d = (candidates[i].score / (candidates[i].base * g)) * 1e9;
          if (d < minValue) {
            say(`  unter Mindestnutzen: ${candidates[i].name} (${d.toFixed(5)}/Mrd < ${minValue})`);
            candidates.splice(i, 1);
          }
        }
      }

      if (!candidates.length) {
        say("ERGEBNIS: kein Kandidat erfuellt Reputation und Voraussetzungen. Nichts zu tun.");
        break;
      }

      candidates.sort((a, b) => b.base - a.base);
      say("Kandidaten (Grundpreis absteigend — so waere auch die guenstigste Reihenfolge):");
      for (const c of candidates.slice(0, 12)) {
        const at0 = c.base * g;
        say(
          `  ${c.name} | Grundpreis $${fmtMoney(c.base)} | an Rang 0 $${fmtMoney(at0)}` +
            ` | Nutzen ${c.score.toFixed(4)} (${((c.score / at0) * 1e9).toFixed(5)}/Mrd) | ueber ${c.faction}`,
        );
      }
      if (candidates.length > 12) say(`  ... und ${candidates.length - 12} weitere.`);

      const plan = planPurchases(candidates, budget, g, maxSteps - step);
      if (!plan.seq.length) {
        const cheapest = candidates.reduce((a, b) => (b.base < a.base ? b : a));
        say(
          `ERGEBNIS: nichts ist leistbar. Der billigste Kandidat ist ${cheapest.name} fuer` +
            ` $${fmtMoney(cheapest.base * g)}, einsetzbar sind $${fmtMoney(budget)}.`,
        );
        break;
      }

      say("GEPLANTE KAUFREIHENFOLGE:");
      let rest = budget;
      for (let i = 0; i < plan.seq.length; i++) {
        rest -= plan.costs[i];
        say(
          `  ${i + 1}. ${plan.seq[i].name} bei ${plan.seq[i].faction}: $${fmtMoney(plan.costs[i])}` +
            ` | Nutzen +${plan.seq[i].score.toFixed(4)} | danach noch $${fmtMoney(rest)}`,
        );
      }
      const density = (plan.value / plan.total) * 1e9;
      say(
        `  Summe $${fmtMoney(plan.total)}, Gesamtnutzen ${plan.value.toFixed(4)}` +
          ` = ${density.toFixed(5)} je Milliarde, unverbraucht $${fmtMoney(rest)}.`,
      );
      if (density < YARDSTICK) {
        say(
          `  WARNUNG: ${density.toFixed(5)}/Mrd liegt unter dem Massstab ${YARDSTICK.toFixed(5)}/Mrd` +
            ` (eine Verdopplung des home-Speichers). Der Preisfaktor 1.9^${state.q} macht den Aug-Markt` +
            ` gerade ${g.toPrecision(4)}-mal so teuer wie nach dem naechsten Install. Ueberleg, ob das Geld` +
            ` nicht besser in home-RAM gehoert — der ueberlebt den Reset, das Guthaben nicht.`,
        );
      }

      if (dry) {
        say("TROCKENLAUF: hier waere der erste Kauf ausgefuehrt worden. Ende.");
        break;
      }
      if (!state.trustworthy) {
        // Der Plan steht oben und darf angesehen werden — gekauft wird er
        // nicht. Ein falsches q macht jeden Preis um Faktor 1.9 je fehlender
        // Aug zu niedrig, und der Fehler faellt erst NACH dem Klick auf.
        say(
          "ABBRUCH: der Zustand widerspricht sich" +
            (state.contradiction ? " (Faktionsseite und Warteschlange sind sich uneins)" : "") +
            " — geplant, aber nicht gekauft.",
        );
        break;
      }

      // --- nur den ERSTEN Schritt ausfuehren, dann neu planen -----------
      const first = plan.seq[0];
      const err = await openFactionAugPage(doc, sleep, first.faction, say, allowUnfocus);
      if (err) {
        say(`ABBRUCH: ${err}`);
        break;
      }
      const before = readAugPage(doc);
      const res = await buyOne({
        doc,
        sleep,
        log: say,
        augName: first.isNfg ? first.clickName : first.name,
        faction: first.faction,
        expectedCost: plan.costs[0],
        getMoney,
        isNfg: first.isNfg,
        nfgLevelBefore: before.nfgLevel,
        incomePerSec,
      });
      for (const t of res.dialogs || []) say(`  Meldung des Spiels: ${t}`);
      if (res.ok) {
        failures = 0;
        say(`GEKAUFT: ${first.name} fuer $${fmtMoney(res.spent)} (vorhergesagt $${fmtMoney(plan.costs[0])}).`);
      } else if (res.inconclusive) {
        // Die Seite ist uns unter den Haenden weggewandert (Nachtdienst, Mensch
        // am Rechner). Ob der Kauf stattfand, weiss die naechste Runde besser
        // als jede Vermutung hier — also NICHT als Fehlschlag zaehlen, aber
        // auch nicht endlos wiederholen.
        moved++;
        say(`UNKLAR ${moved}/2: ${res.reason}`);
        if (moved >= 2) {
          say("ABBRUCH: die Oberflaeche wird von jemand anderem bedient.");
          break;
        }
      } else {
        failures++;
        say(`FEHLSCHLAG ${failures}/2: ${res.reason}`);
        // Zweimal keine Wirkung -> Schluss. Blindes Weiterklicken hat diesem
        // Projekt schon einen ganzen Tag gekostet.
        if (failures >= 2) {
          say("ABBRUCH: zwei Kaeufe in Folge ohne Wirkung.");
          break;
        }
      }
    }
  } catch (e) {
    // Wurde das Skript getoetet, kommt aus jedem await eine ScriptDeath
    // (Netscript/ScriptDeath.ts:21-38, erkennbar an name). Die darf NICHT
    // geschluckt werden — sonst laeuft der Rest der Funktion in eine Kette
    // weiterer Ausnahmen, und der Bericht endet mit einer irrefuehrenden
    // Meldung statt mit "gekillt".
    if (e && e.name === "ScriptDeath") {
      say("# abgebrochen: das Skript wurde beendet (kill).");
      nightshift.release();
      throw e;
    }
    // Alles andere darf nicht nach draussen: der Bericht ist der einzige
    // Kanal, ueber den ein gescheiterter Lauf ueberhaupt sichtbar wird.
    say("AUSNAHME: " + (e && e.message ? e.message : String(e)));
    if (e && e.stack) say(String(e.stack).split("\n").slice(0, 5).join(" | "));
  } finally {
    nightshift.release();
  }

  // Aufraeumen ausserhalb des finally: backToTerminal wartet, und ein await
  // im finally-Zweig wuerde eine gerade geworfene ScriptDeath verschlucken.
  try {
    await backToTerminal(doc, sleep, say);
    say(`# Ende — Guthaben $${fmtMoney(await getMoney())}`);
  } catch (e) {
    ns.print("Abschluss unvollstaendig: " + e);
  }
}
