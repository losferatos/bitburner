export const meta = {
  name: 'bb-audit-inventar',
  description: 'Bitburner-Bot: Feature-Inventar aus dem Quellcode, Abdeckungsmatrix, BitNode-Gruppen, Robustheit, Vollstaendigkeitskritik',
  phases: [
    { title: 'Sweep', detail: '14 Bereiche + 5 BitNode-Gruppen + 3 Robustheitspruefer parallel' },
    { title: 'Critic', detail: 'Inventar-Vollstaendigkeit: was fehlt?' },
    { title: 'Nachtrag', detail: 'Luecken aus der Kritik abdecken' },
  ],
}

const ROOT = 'C:\\Users\\erche\\Desktop\\claude_projecto\\bitburner'
const OUT = 'nodes/audit-2026-10-03'

const COMMON = `Du bist Pruefer im Vollstaendigkeits-Audit des Bitburner-Bots. Projektwurzel ${ROOT}.
ZUERST ${OUT}/BRIEFING.md vollstaendig lesen - dort stehen Pfade, aktueller Spielstand (BN2.1, SF-Liste), Restroute, Arbeitsregeln (src/ NICHT aendern, Spiel NICHT anfassen, eigene Dateien nur unter ${OUT}/ und tools/audit/) und Kategorien.
Dann die relevanten Teile des letzten Audits (nodes/AUDIT-PERFEKT-2026-09-26.md und den passenden Bericht in nodes/audit-2026-09-26/) und den Abschnitt "ENTSCHIEDEN" in nodes/BAUSTELLEN.md (Zeilen 8-45) lesen, damit du nichts wiederholst und nichts Entschiedenes ohne neue Fundstelle/Messung neu aufmachst. Bei Bedarf in nodes/BAUSTELLEN.md und nodes/ERLEDIGT.md nach deinem Thema greppen.
Belege immer mit Datei:Zeile - im Bot (src/...) UND im Spielquellcode (reference/bitburner-src/src/...). Nichts aus dem Gedaechtnis behaupten, was nicht im Quellcode steht.
Ertrag ABSOLUT gegen die beste Alternative schaetzen (Rang/h, Rep/h, $/h, h bis Knotenende) und angeben, ob GERECHNET_GEEICHT (Formel als Code nachgebaut in tools/audit/*.mjs UND gegen echten Spielstandwert geeicht), GERECHNET_UNGEEICHT oder GESCHAETZT. Wo es mit vertretbarem Aufwand geht: rechnen und eichen. Wo nicht: needs_calc=true und calc_spec genau beschreiben (welche Formel aus welcher Datei, gegen welchen Spielstandwert eichen).
Befunde NUR fuer echte Luecken/Fehler: NICHT_GENUTZT (Feature mit Ertrag, Bot nutzt es nicht), SUBOPTIMAL (genutzt, Entscheidungsregel schlechter als die beste Alternative), TOT (Code erreicht nie oder wirft verschluckt), FEHLER (falsches Verhalten), RISIKO (schlummernde Falle in einem kommenden Knoten). Bekannte offene Punkte aus dem letzten Audit nur, wenn du NEUE Belege oder eine andere Bewertung hast (dann known_before ausfuellen).
Deine Antwort ist strukturiert (Schema). Den ausfuehrlichen Bericht schreibst du als Markdown-Datei (Pfad unten).`

const FAILED = new Set(['SING', 'BOERSE', 'NETZ', 'PLAYER', 'BN2', 'BN3-11', 'BN6-7', 'BN14-13', 'BN15-8', 'SCOPE', 'FLUSS', 'VERSION'])
const RESUME_HINT = `

FORTSETZUNG: Ein erster Lauf dieses Pruefers brach am Nutzungslimit ab. Vorarbeiten koennen in tools/audit/ liegen (z.B. bn2-verlauf.mjs, bn1413-runs.mjs, bn67-kurven.mjs, boerse-*.mjs, netz-*.mjs, player-save.mjs, sing-save.mjs) - pruefen, wiederverwenden, nicht doppelt bauen. Die fertigen Bereichsberichte nodes/audit-2026-10-03/inventar-{hack,infra,hash,fakt,aug,blade,sleeve,gang,corp,stgo}.md liegen vor: lesen, wo sie dein Thema beruehren, und nicht wiederholen, sondern ergaenzen oder begruendet widersprechen.`

const FINDING = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Bereichskuerzel-Nummer, z.B. GANG-1' },
    title: { type: 'string' },
    category: { type: 'string', enum: ['NICHT_GENUTZT', 'SUBOPTIMAL', 'TOT', 'FEHLER', 'RISIKO'] },
    bot_ref: { type: 'string', description: 'src-Datei:Zeile oder "fehlt"' },
    source_ref: { type: 'string', description: 'reference/bitburner-src/src/...:Zeile' },
    affected_bns: { type: 'string', description: 'z.B. "BN2.1-2.3" oder "alle V2" oder "BN3,BN11"' },
    gain: { type: 'string', description: 'absoluter Ertrag gegen beste Alternative, mit Einheit' },
    gain_basis: { type: 'string', enum: ['GERECHNET_GEEICHT', 'GERECHNET_UNGEEICHT', 'GESCHAETZT'] },
    effort: { type: 'string', enum: ['S', 'M', 'L', 'XL'] },
    priority: { type: 'string', enum: ['P1', 'P2', 'P3'] },
    needs_calc: { type: 'boolean' },
    calc_spec: { type: 'string' },
    known_before: { type: 'string', description: 'Verweis auf frueheres Audit/BAUSTELLEN oder leer' },
  },
  required: ['id', 'title', 'category', 'bot_ref', 'source_ref', 'affected_bns', 'gain', 'gain_basis', 'effort', 'priority', 'needs_calc'],
}

const RESULT = {
  type: 'object',
  properties: {
    report_path: { type: 'string' },
    inventory_count: { type: 'number' },
    coverage_counts: { type: 'object', properties: {
      nicht_genutzt: { type: 'number' }, suboptimal: { type: 'number' }, tot: { type: 'number' }, optimal: { type: 'number' }, nicht_anwendbar: { type: 'number' } } },
    findings: { type: 'array', items: FINDING },
    calculators: { type: 'array', items: { type: 'string' }, description: 'angelegte tools/audit/*.mjs mit Eichergebnis' },
    open_questions: { type: 'array', items: { type: 'string' } },
  },
  required: ['report_path', 'inventory_count', 'findings'],
}

const AREA_TASK = (a) => `${COMMON}

BEREICH ${a.key}: ${a.title}
Spielquellcode (Startpunkte, nicht abschliessend - selbst weitergraben): ${a.src}
Netscript-Namespaces/Funktionen in diesem Bereich: ${a.ns}
Bot-Dateien (Startpunkte, per grep ergaenzen): ${a.bot}
Besonderes Augenmerk: ${a.focus}

VORGEHEN
1. Feature-Inventar AUS DEM QUELLCODE (nicht aus dem Gedaechtnis, und zuerst OHNE auf den Bot zu schauen): jede Mechanik, jede ns-Funktion, jedes Upgrade/jede Aktion/jede Option mit Ertrag in diesem Bereich. Je Feature: Fundstelle, in welchen BN verfuegbar (BitNode/BitNode.tsx, canAccessBitNodeFeature, SF-Voraussetzungen), Ertrag/Hebel, welche BN-Multiplikatoren es auf- oder abwerten (fuer die Restroute BN2,3,11,6,7,14,13,15,8).
2. Abdeckungsmatrix: je Feature, welches Bot-Skript es nutzt (Datei:Zeile), in welchen BN/Phasen es aktiv ist (Kaltstart, Aufbau, Einbauzyklus, Endspiel, Sprung), Kategorie (NICHT GENUTZT / GENUTZT-SUBOPTIMAL / GENUTZT-TOT / OPTIMAL / NICHT ANWENDBAR) und Urteil zur Entscheidungsregel.
3. Fuer jede nicht-triviale Entscheidungsregel: ist sie optimal? Wo moeglich rechnen und gegen Spielstand eichen (tools/audit/${a.key.toLowerCase()}-*.mjs).
4. Bericht schreiben nach ${OUT}/inventar-${a.key.toLowerCase()}.md mit: Tabelle "Feature | Wo im Quellcode | Wirkt in welchen BN | Ertrag/Hebel", Tabelle "Feature | Bot Datei:Zeile | BN/Phasen aktiv | Kategorie | Urteil", Befundliste, Rechnungen mit Eichung.${FAILED.has(a.key) ? RESUME_HINT : ''}`

const AREAS = [
  { key: 'HACK', title: 'Hacking-Engine: hack/grow/weaken/share, Batching (HWGW), Vorbereitung, Zielwahl, Erfahrungsfarm, Formulas-API, Ports, Skript-RAM',
    src: 'Hacking.ts, Hacking/, Server/ (ServerHelpers.ts, formulas/), NetscriptFunctions.ts (hack/grow/weaken/share/hackAnalyze*/growthAnalyze*/weakenAnalyze/getServer*/exec/scp/ports), NetworkShare/, NetscriptFunctions/Formulas.ts, Constants.ts, Script/RamCostGenerator.ts',
    ns: 'ns.* Basisfunktionen (Hacking, Server, Skripte, Ports), ns.formulas.hacking, ns.share, ns.getSharePower',
    bot: 'src/bn4net.js, src/lib/batch.js, src/lib/calc.js, src/homegrow.js, src/share.js, src/netz.js, src/worker/, src/wbgrow.js, src/hacktimer.js, src/xp.js, src/netburner.js',
    focus: 'Die Hacking-Maschine laeuft in V1 UND in V2-Knoten (Geld). Pruefe die Wirkung der BN-Multiplikatoren der Restroute (BN2 ServerMaxMoney 0,08, BN3 0,04 usw.) auf die Zielwahl; backdoor-Effekte; stock-Option bei hack/grow; Kerne/home; share-Formel; Erfahrung.' },
  { key: 'INFRA', title: 'Server-Infrastruktur: Cloud-Server (gekaufte Server), home RAM/Kerne, Programme/Darkweb/TOR',
    src: 'NetscriptFunctions/Cloud.ts, Server/ServerPurchases.ts, Server/formulas/, Programs/, DarkWeb/, NetscriptFunctions/Singularity.ts (upgradeHomeRam/Cores, purchaseTor, purchaseProgram, getDarkwebPrograms), Constants.ts',
    ns: 'ns.cloud.*, ns.singularity.upgradeHomeRam/upgradeHomeCores/getUpgradeHomeRamCost/getUpgradeHomeCoresCost/purchaseTor/purchaseProgram/getDarkwebPrograms/getDarkwebProgramCost, ns.purchaseProgram etc.',
    bot: 'src/homeram.js, src/kerne.js, src/darkweb.js, src/bn4life.js, src/bn4net.js (Park), src/bn4start.js, src/guard.js',
    focus: 'Kaufreihenfolge (home RAM vs Kerne vs Cloud vs Augs), Kosten-Multiplikatoren je BN (HomeComputerRamCost, CloudServerCost/Softcap/MaxRam), Programme (Formulas.exe, AutoLink, DeepscanV2, ServerProfiler - Nutzen?), Kaltstart-Leiter nach dem Sprung.' },
  { key: 'HASH', title: 'Hacknet-Server und Hashes (alle Hash-Upgrades)',
    src: 'Hacknet/ (HashUpgrades.ts, data/HashUpgradesMetadata.tsx, HacknetServer.ts, HashManager.ts, formulas/), NetscriptFunctions/Hacknet.ts, BitNode-Multiplikatoren HacknetNodeMoney',
    ns: 'ns.hacknet.* (purchaseNode, upgrade*, spendHashes, hashCost, numHashes, getHashUpgrades, getHashUpgradeLevel, getStudyMult, getTrainingMult)',
    bot: 'src/hacknet.js, src/hashes.js, src/hashgym.js, src/netburn.js',
    focus: 'JEDES Hash-Upgrade einzeln bewerten: Bladeburner Rank, Bladeburner SP, Improve Gym Training/Studying, Reduce Minimum Security, Increase Maximum Money, Sell for Money, Generate Coding Contract, Company Favor, Corporation-Upgrades (BN3!). Hash-Kauf in V2-Knoten (Bladeburner Rank/SP) gegen Rangrate rechnen. Frueheres E1-Urteil nodes/audit-2026-09-26/E1-hashes-urteil.md beachten. SF9.3 vorhanden: Gratis-Hacknet-Server nach Sprung.' },
  { key: 'FAKT', title: 'Faktionen und Firmen: Einladungen, Arbeit, Spenden, Favor, Feindschaften, Firmenarbeit/Positionen/Firmenfaktionen',
    src: 'Faction/ (FactionInfo.tsx, FactionHelpers.tsx, formulas/, Factions.ts), Company/ (Companies.ts, CompanyPositions, data/), Work/ (FactionWork.ts, CompanyWork.ts, formulas/), Constants.ts (Favor-Schwellen), NetscriptFunctions/Singularity.ts',
    ns: 'ns.singularity.joinFaction/checkFactionInvitations/workForFaction/donateToFaction/getFactionRep/getFactionFavor/getFactionFavorGain/getFactionEnemies/applyToCompany/workForCompany/quitJob/getCompanyRep/getCompanyFavor, ns.formulas.reputation/work',
    bot: 'src/join.js, src/joinrun.js, src/joinplan.js, src/joinfac.js, src/bn4rep.js, src/donate.js, src/work.js, src/favorweg.js, tools/firma.js, src/backdoor.js, src/bn4door.js, src/lib/figur.js',
    focus: 'Welche Faktion/Firma zu welchem Zeitpunkt, Arbeitsart (hacking/field/security) nach Rep-Formel, Spenden ab Favor, Favor-Akkumulation ueber Resets, Firmenfaktionen (Bachman, ECorp, MegaCorp, Fulcrum ...) als Augquelle, Feindschaften (Sector-12 vs Chongqing usw.) und ob der Bot dadurch Augs verliert. BN2: FactionPassiveRepGain 0, FactionWorkRepGain 0,5.' },
  { key: 'AUG', title: 'Augmentierungen, NeuroFlux, Einbau, Grafting, Prestige/Reset-Wirkung',
    src: 'Augmentation/ (Augmentations.ts, data/, AugmentationHelpers.ts, Enums), Faction/FactionHelpers.tsx (Kaufpreis-Steigerung), Prestige.ts, NetscriptFunctions/Grafting.ts, PersonObjects/Grafting/, NetscriptFunctions/Singularity.ts (purchaseAugmentation, installAugmentations, softReset, getAugmentation*)',
    ns: 'ns.singularity.purchaseAugmentation/installAugmentations/softReset/getAugmentationsFromFaction/getAugmentationPrereq/getAugmentationPrice/getAugmentationRepReq/getAugmentationStats/getOwnedAugmentations, ns.grafting.*',
    bot: 'src/buyaugs.js, src/bn4rep.js (Kaufschleife), src/lib/einbau.js, src/lib/endspurt.js, src/graft.js, src/graftauto.js, src/lib/graftwahl.js, src/graftplan.json, src/kampfaugs.js, src/lib/hackaugs.js, src/install.js, src/kaufplan.js',
    focus: 'Kaufreihenfolge (Preisfaktor 1,9 je Kauf, teuerste zuerst global?), NFG, Vorbedingungen, welche Augs fuer V2 (Kampf/Bladeburner) zaehlen, Einbauzeitpunkt, Grafting-Wert, was Prestige zuruecksetzt. Offen aus dem letzten Audit: A8, A9, E7, E8.' },
  { key: 'SLEEVE', title: 'Sleeves: alle Aufgaben, Sleeve-Augs, Shock/Sync/Memory, Covenant-Kaeufe',
    src: 'PersonObjects/Sleeve/ (Sleeve.ts, Work/*, SleeveCovenantPurchases, ui/), NetscriptFunctions/Sleeve.ts, Constants (SleeveCost...), SourceFile-Effekte SF10',
    ns: 'ns.sleeve.* (setToShockRecovery, setToSynchronize, setToCommitCrime, setToFactionWork, setToCompanyWork, setToUniversityCourse, setToGymWorkout, setToBladeburnerAction, travel, purchaseSleeveAug, getSleevePurchasableAugs, getSleeveAugmentations, getTask, getSleeve)',
    bot: 'src/sleeve.js, src/sleevecrime.js, src/sleevediag.js, src/trupp.js',
    focus: 'SF10.3 vorhanden: wie viele Sleeves moeglich, Memory-Kauf (Covenant), Sleeve-Augs ab Shock 0. Aufgabenwahl je Phase und BN (Bladeburner-Aktionen fuer Sleeves: Infiltrate synthoids, Field Analysis, Diplomacy, Support main sleeve, Contracts, Recruitment), Kriminalitaet fuer Karma (BN2!), Faktionsarbeit parallel zum Spieler.' },
  { key: 'BLADE', title: 'Bladeburner: alle Aktionen, Skills, Staedte/Chaos/Bevoelkerung, Black Ops, Trupps, Ausdauer',
    src: 'Bladeburner/ (Bladeburner.ts, Actions/, data/ (Contracts, Operations, BlackOperations, GeneralActions, Skills), formulas/), NetscriptFunctions/Bladeburner.ts, BitNode-Multiplikatoren Bladeburner*',
    ns: 'ns.bladeburner.* vollstaendig',
    bot: 'src/blade.js (4593 Zeilen), src/bbtrain.js, src/bbspann.js, src/blackops.js, src/bbtick.js, src/bblage.js, src/bodauer.js, src/boprobe.js, src/lib/blackops.json, src/kampfaugs.js',
    focus: 'V2 ist der Ausgang fuer fast die ganze Restroute. Paket D (D1-D6) wurde am 27.09. gebaut, Black-Op-Totcode am 03.10. repariert - schau, was DANACH noch fehlt oder tot ist: Skill-Kaufreihenfolge, Stadtwahl/Chaos, Incite Violence, Hyperbolic Regeneration, Field Analysis, Ausdauer-Management, Bonuszeit, Aktionswahl nach Rang/min. Jeden ns.bladeburner-Aufruf auf Erreichbarkeit pruefen (Scope!).' },
  { key: 'GANG', title: 'Gang: Gruendung, Mitglieder, Aufgaben, Ausruestung, Aufstieg (Ascension), Territorium/Kriegsfuehrung, Gang-Faktion als Augquelle',
    src: 'Gang/ (Gang.ts, GangMember.ts, data/tasks, data/upgrades, formulas/, Constants.ts, AllGangs.ts), NetscriptFunctions/Gang.ts, PersonObjects/Player/PlayerObjectGangMethods.ts, Faction/ (Gang-Faktion: welche Augs bietet sie an?), SourceFile-Effekte SF2, BitNode-Multiplikatoren GangSoftcap/GangUniqueAugs',
    ns: 'ns.gang.* vollstaendig',
    bot: 'KEINE Datei nutzt ns.gang (verifizieren mit grep in src/)',
    focus: 'WIR SIND JETZT IN BN2.1 (danach 2.2, 2.3). In BN2 gibt canAccessGang ohne Karma-Schwelle success zurueck. Rechne: was bringt eine Gang in BN2 fuer den V2-Ausgang (Geld -> Augs, Gang-Faktions-Rep -> Augs ohne Faktionsarbeit, Respekt), Zeit bis zur Wirkung, gegen den heutigen Weg. Welche Gang-Faktion (Hacking- vs Kampfgang; Slum Snakes/Black Hand/NiteSec sind beigetreten). Ab SF2: Gang ausserhalb BN2 nur mit Karma <= -54000 - lohnt Karma-Farm in spaeteren Knoten? Welche Augs bietet die Gang-Faktion (GangUniqueAugs)? Auch: blockiert die Gang-Faktion etwas (Faktionsarbeit dort nicht moeglich)?' },
  { key: 'CORP', title: 'Corporation: Gruendung, Divisionen, Produkte, Forschung, Investoren/Dividenden, Hash-Verbindung',
    src: 'Corporation/ (Corporation.ts, Division.ts, Actions.ts, data/, helpers.ts), NetscriptFunctions/Corporation.ts, canAccessBitNodeFeature(3), BitNode-Multiplikatoren Corporation*',
    ns: 'ns.corporation.* vollstaendig',
    bot: 'KEINE Datei (verifizieren)',
    focus: 'BN3.1-3.3 kommt direkt nach BN2 auf der Route (V2). Rechne: bringt eine Corporation in BN3 (und spaeter mit SF3 ueberall) genug Geld/Zeitgewinn fuer den V2-Ausgang, um den Bauaufwand zu rechtfertigen? Selbstfinanzierung 150 Mrd ausserhalb BN3, Seed in BN3. Welche Corp-Strategie ist automatisierbar (Agriculture->Tobacco o.ae.)? Ab wann zahlt sie sich aus (h)?' },
  { key: 'STGO', title: "Stanek's Gift (CotMG) und IPvGO",
    src: 'CotMG/ (StaneksGift.ts, Fragment.ts, data/Fragments, formulas/), NetscriptFunctions/Stanek.ts, Go/ (Go.ts, effects/, boardAnalysis/, Constants.ts), NetscriptFunctions/Go.ts, BitNode-Multiplikatoren StaneksGift*, GoPower',
    ns: 'ns.stanek.*, ns.go.* (inkl. ns.go.analysis, ns.go.cheat)',
    bot: 'KEINE Datei (verifizieren)',
    focus: 'IPvGO: in welchen BN verfuegbar (pruefe Zugangsbedingung!), welche Boni je Gegnerfaktion (effects/), wie gross bei unserem Spielniveau, kosten sie RAM/Zeit, bleiben sie ueber Resets? Lohnt ein einfacher Go-Spieler fuer Kampf-/Bladeburner-relevante Boni in V2-Knoten? Stanek: ab BN13/SF13 - fuer die Route nur BN13 selbst; Ertrag fuer V2 (Kampf-/Bladeburner-Fragmente).' },
  { key: 'BOERSE', title: 'Boerse: WSE, TIX-API, 4S-Daten, Leerverkauf/Limit (SF8), Kursbeeinflussung per hack/grow',
    src: 'StockMarket/ (StockMarket.ts, Stock.ts, StockMarketHelpers.ts, data/, BuyingAndSelling.ts), NetscriptFunctions/StockMarket.ts, BitNode-Multiplikatoren FourSigma*, BN8-Besonderheiten',
    ns: 'ns.stock.* vollstaendig',
    bot: 'src/stocks.js, src/boerse.js, src/invest.js, src/stockaccess.js',
    focus: 'Lohnt Boerse in V2-Knoten als Geldquelle (4S-Kosten vs Ertrag bei unserem Kapital)? BN8 ist Routenende (V1, ScriptHackMoneyGain 0) - ist boerse.js bereit? Offen E3, C6 aus letztem Audit.' },
  { key: 'NETZ', title: 'DarkNet/Labyrinth, Coding Contracts, Infiltration',
    src: 'DarkNet/ (Constants.ts, controllers/, models/, effects/), NetscriptFunctions/Darknet.ts, CodingContract/ (ContractTypes, Contract.ts, Generator, Rewards), NetscriptFunctions/CodingContract.ts, Infiltration/ (formulas/, Infiltration.ts), NetscriptFunctions/Infiltration.ts',
    ns: 'ns.dnet.*, ns.codingcontract.*, ns.infiltration.*',
    bot: 'src/contracts.js, src/csolve.js, src/lib/loeser.js, src/cdump.js, grep "dnet|darknet|infiltrat" in src/',
    focus: 'Coding Contracts: welche Vertragstypen loest lib/loeser.js NICHT (Liste gegen ContractTypes)? Belohnungswahl (Geld vs Faktions-/Firmen-Rep). DarkNet: was bringt es ausserhalb BN15 (Belohnungen, Red Pill V1b), wie weit ist der Bot? Infiltration: Ertrag (Geld/Rep, BN2 InfiltrationMoney 3) und ob automatisierbar (DOM/Tastatur) - als Rep-Quelle fuer Augs in V2?' },
  { key: 'PLAYER', title: 'Spielermechanik: Kriminalitaet, Karma, Intelligenz, Gym/Uni, Reisen, Krankenhaus, Exploits, Export-Bonus, Achievements, Casino, Meilensteine',
    src: 'Crime/ (Crimes.ts, CrimeHelpers), PersonObjects/ (Person*, formulas/, intelligence), Locations/ (Gym, Uni, Hospital, Casino, Travel), Exploits/ (Exploit.ts, applyExploits.ts), ExportBonus.tsx, Achievements/ (Spielwirkung?), Casino/, Milestones/, NetscriptFunctions/Extra.ts, NetscriptFunctions/Singularity.ts (commitCrime, gymWorkout, universityCourse, travelToCity, hospitalize, exportGameBonus)',
    ns: 'ns.singularity.commitCrime/getCrimeChance/getCrimeStats/gymWorkout/universityCourse/travelToCity/hospitalize/exportGame/exportGameBonus, ns.formulas.work.*, Extra-Funktionen (exploit/bypass/alterReality/rainbow/iKnowWhatImDoing)',
    bot: 'src/sleevecrime.js, src/bbtrain.js, src/travel.js, src/exploit*.js, src/export.js, src/exportbonus.js, src/xp.js, src/werkbank.js, src/punish.js',
    focus: 'Welche Exploits fehlen noch (7 von wie vielen)? Export-Bonus taeglich genutzt? Intelligenz: Quellen und Wirkung (Int 153). Karma: braucht der Bot es (Gang ausserhalb BN2, Faktionen mit Karma-Bedingung wie Speakers for the Dead/The Syndicate/The Dark Army)? Kriminalitaet als Geld-/Erfahrungsquelle in BN2 (CrimeMoney 3)? Casino als Fruehgeld (Kickout-Grenze).' },
  { key: 'SING', title: 'Singularity-Rest, Base-API-Rest, RAM-Kosten/SF4, Orchestrierung, Sprung (destroyW0r1dD43m0n), Ausgang',
    src: 'NetscriptFunctions/Singularity.ts (alles, was die anderen Bereiche nicht abdecken: getCurrentWork, setFocus, isBusy, stopAction, connect, manualHack, installBackdoor, getOwnedSourceFiles, destroyW0r1dD43m0n, getCurrentServer ...), Script/RamCostGenerator.ts (SF4-Rabatt), NetscriptFunctions.ts (getResetInfo, getBitNodeMultipliers, getMoneySources, getRunningScript ...), RedPill.tsx, BitNode/',
    ns: 'ns.singularity.* Rest, ns.getResetInfo, ns.getBitNodeMultipliers, ns.getMoneySources, ns.getPlayer, ns.ramOverride, ns.flags, ns.ui',
    bot: 'src/autopilot.js, src/ausgang.js, src/exit.js (VERBOTEN von Hand zu starten), src/boot.js, src/guard.js, src/install.js, src/lib/route.js, src/lib/leiter.js, src/lib/herzschlag.js, src/lib/handschlag.js',
    focus: 'manualHack/connect als Int-Quelle? getMoneySources fuer Telemetrie? Sprungablauf je V1/V2 (destroyW0r1dD43m0n mit Folgeknoten und callbackScript), Kaltstart nach dem Sprung in den kommenden Knoten. NICHT anfassen: b1tflum3, Destroy-Knopf.' },
]

const BN_GROUPS = [
  { key: 'BN2', nodes: 'BN2 (aktuell BN2.1, danach 2.2, 2.3)', extra: 'Hoechste Dringlichkeit, wir sind JETZT drin. Lies auch die aktuelle Telemetrie in data/ und den neuesten Spielstand (backups/LIVE_*_BN2L1_*.json.gz): was tut der Bot gerade, womit verbringt er die Zeit, wo steht er? Gang ohne Karma-Schwelle; FactionPassiveRepGain 0; FactionWorkRepGain 0,5; CrimeMoney 3; InfiltrationMoney 3; ServerMaxMoney 0,08; WorldDaemonDifficulty 5. Was ist in BN2 der schnellste Weg zum Knotenende (V2 Black Ops gegen Alternativen) und was fehlt dem Bot dafuer? Was bringt SF2 nach dem Abschluss fuer die Folgeknoten?' },
  { key: 'BN3-11', nodes: 'BN3 (3.1-3.3) und BN11 (11.1-11.3)', extra: 'BN3 = Corporation-Knoten, viele harte Malusse (ServerMaxMoney 0,04, ScriptHackMoney 0,2, HomeComputerRamCost 1,5, CrimeMoney 0,25, HacknetNodeMoney 0,25 ...). BN11 = Wirtschaftsknoten. Kaltstart nach dem Sprung: hat der Bot ueberhaupt Geld/Rang-Quellen, die dort nicht entwertet sind? Was bringen SF3/SF11?' },
  { key: 'BN6-7', nodes: 'BN6 (6.2-6.3) und BN7 (7.1-7.3)', extra: 'Bladeburner-Knoten. BN7 = Bladeburners 2079 (eigene Multiplikatoren, Bladeburner-Augs? SF7-Effekte: Blade Simulacrum ab SF7.3, Automatisierung). Passt blade.js zu den BN7-Multiplikatoren (BladeburnerRank, BladeburnerSkillCost, ...)? Black-Op-Anforderungen dort?' },
  { key: 'BN14-13', nodes: 'BN14 (14.1-14.3) und BN13 (13.1-13.3)', extra: 'BN14 = IPvGO-Knoten (GoPower-Multiplikator, Go-Pflicht?), BN13 = Stanek-Knoten (Stanek-Gift Pflicht fuer Fortschritt? Multiplikatoren). Der Bot hat weder Go noch Stanek - was bedeutet das fuer V2 dort? Was bringen SF13/SF14 fuer spaeter?' },
  { key: 'BN15-8', nodes: 'BN15 (15.1-15.3) und BN8 (8.1-8.3)', extra: 'BN15 = DarkNet-Knoten (route.json: V2 mit V1b-Hinweis - ist V2 dort ueberhaupt moeglich, was verlangt der Knoten?). BN8 = Ghost of Wall Street (ScriptHackMoneyGain 0, Boerse einzige Geldquelle, V1 mit boerse.js). Ist der Bot fuer beide bereit, was fehlt (offen C6 aus letztem Audit)?' },
]

const BN_TASK = (g) => `${COMMON}

BITNODE-GRUPPE ${g.key}: ${g.nodes}
${g.extra}

VORGEHEN
1. Aus reference/bitburner-src/src/BitNode/BitNode.tsx (und BitNodeMultipliers.ts, BitNodeUtils.ts, SourceFile/, Prestige.ts) ALLE Multiplikatoren und Sonderregeln dieser Knoten auslesen. Fuer jeden Knoten: welche Features freigeschaltet, welche entwertet (Faktor < 1), welche aufgewertet (Faktor > 1), welche gesperrt. Was bringen die SF dieser Knoten nach Abschluss fuer die restliche Route?
2. Pruefen, ob der Bot diese Knoten richtig behandelt: src/lib/bitnodes.json (stimmen die Werte mit dem Quellcode 3.0.2 ueberein?), Knotenbedingungen im Code (BLADE_KNOTEN, Knotennummern), ausgang.js/route.json (Ausgangsverfahren), Kaltstart-Leiter nach dem Sprung, jede Phase (Kaltstart, Aufbau, Einbauzyklus, Endspiel, Sprung). Ein Feature, das im aktuellen Knoten bedeutungslos ist, kann hier der Hebel sein.
3. Konkret rechnen, wo es um die Wahl des Wegs geht (h bis Knotenende mit/ohne Feature), gegen echte Spielstandwerte geeicht, wo es Spielstaende gibt (z.B. Rang-Raten aus BN10/BN4/BN9-Laeufen in backups/).
4. Bericht nach ${OUT}/bn-${g.key.toLowerCase()}.md: Tabelle je Knoten "Multiplikator | Wert | Wirkung | Bot beruecksichtigt? (Datei:Zeile)", Befundliste, Rechnungen.${FAILED.has(g.key) ? RESUME_HINT : ''}`

const ROBUST = [
  { key: 'SCOPE', title: 'Verschluckte Fehler und Funktionen ausserhalb ihres Scopes',
    task: `tools/lib/scope-tot.js und tools/test-scope-tot.js lesen (der Pruefer fand am 03.10. vier tote Black-Op-Aufrufe in blade.js). Einen Pruefer tools/audit/scope-alle.mjs bauen, der den Scope-Test auf ALLE Dateien in src/ und src/lib/ ausweitet (Aufrufe von Funktionen, die im Aufruf-Scope nicht definiert/importiert sind; Importe aus lib/, die dort nicht exportiert werden; ns-Funktionen, die es in 3.0.2 laut NetscriptDefinitions.d.ts nicht gibt oder die anders heissen, z.B. ns.purchaseServer -> ns.cloud.*). Dann alle try/catch-Bloecke in src/ inventarisieren, die Fehler verschlucken (leerer catch, catch ohne Log, catch der nur einen Default zurueckgibt), und fuer jeden entscheiden, ob dahinter ein ReferenceError/TypeError/Spiel-Fehler unsichtbar werden kann, der Funktion kostet. Jeden Treffer mit Datei:Zeile und Beleg melden (welcher Aufruf wirft, warum).` },
  { key: 'FLUSS', title: 'Datenfluss: geschriebene, nie gelesene Dateien/Felder und umgekehrt',
    task: `Alle Dateien/Ports, die src/ schreibt (ns.write, ns.writePort, ns.scp, Datei-Pfade in Strings) und liest (ns.read, ns.fileExists, ns.readPort, peek), sowie was sync/ (Bruecke), tools/ und dashboard/ lesen und schreiben, als Tabelle "Datei | Schreiber Datei:Zeile | Leser Datei:Zeile" aufstellen. Melden: geschrieben aber nie gelesen (toter Kanal wie truppAnfrage vom 27.09.), gelesen aber nie geschrieben (Leser wartet ewig, Default greift still), Telemetrie-Felder (src/telemetry.js, src/export.js, src/lib/kpi.js, data/*.json) ohne Leser, Formatbrueche (Schreiber schreibt anderes Feld/Format als Leser erwartet). Ein Pruefskript tools/audit/datenfluss.mjs bauen, das die Tabelle erzeugt.` },
  { key: 'VERSION', title: 'Veraltete Konstanten und Versionsdrift 3.0.1 -> 3.0.2',
    task: `Alle hart kodierten Spielkonstanten in src/ und src/lib/ (Zahlen mit Spielbezug: Kosten, Schwellen, Multiplikatoren, RAM-Kosten, Favor-Schwellen, Aktionsdauern, Black-Op-Raenge, BitNode-Werte in src/lib/bitnodes.json, src/lib/blackops.json, src/registry.json) gegen reference/bitburner-src/src (3.0.2) pruefen. Zusaetzlich: diff zwischen reference/v301/src und reference/bitburner-src/src fuer alle Dateien bilden, die Spielmechanik enthalten, und jede Aenderung melden, die der Bot nutzt oder nutzen sollte. Welche Spielversion laeuft LIVE (Spielstand VersionSave in backups/*.json.gz lesen)? Abweichungen mit Datei:Zeile beider Seiten melden.` },
]

const ROBUST_TASK = (r) => `${COMMON}

ROBUSTHEITSPRUEFUNG ${r.key}: ${r.title}
${r.task}
Bericht nach ${OUT}/robust-${r.key.toLowerCase()}.md.${FAILED.has(r.key) ? RESUME_HINT : ''}`

phase('Sweep')
const thunks = [
  ...AREAS.map(a => () => agent(AREA_TASK(a), { label: `bereich:${a.key}`, phase: 'Sweep', schema: RESULT, model: 'opus' }).then(r => r && ({ kind: 'area', key: a.key, ...r }))),
  ...BN_GROUPS.map(g => () => agent(BN_TASK(g), { label: `knoten:${g.key}`, phase: 'Sweep', schema: RESULT, model: 'opus' }).then(r => r && ({ kind: 'bn', key: g.key, ...r }))),
  ...ROBUST.map(r => () => agent(ROBUST_TASK(r), { label: `robust:${r.key}`, phase: 'Sweep', schema: RESULT, model: 'sonnet' }).then(x => x && ({ kind: 'robust', key: r.key, ...x }))),
]
const sweep = (await parallel(thunks)).filter(Boolean)
log(`Sweep fertig: ${sweep.length}/${thunks.length} Berichte, ${sweep.reduce((s, r) => s + (r.findings ? r.findings.length : 0), 0)} Befunde`)

phase('Critic')
const CRITIC_SCHEMA = {
  type: 'object',
  properties: {
    report_path: { type: 'string' },
    gaps: { type: 'array', items: { type: 'object', properties: {
      feature: { type: 'string' }, source_ref: { type: 'string' }, why_relevant: { type: 'string' }, area_hint: { type: 'string' } },
      required: ['feature', 'source_ref', 'why_relevant'] } },
  },
  required: ['report_path', 'gaps'],
}
const critic = await agent(`${COMMON}

VOLLSTAENDIGKEITSKRITIK DES INVENTARS. Die Bereichspruefer haben ihre Inventare nach ${OUT}/inventar-*.md, ${OUT}/bn-*.md und ${OUT}/robust-*.md geschrieben. Lies sie alle.
Deine einzige Frage: WAS FEHLT IM INVENTAR? Gehe systematisch gegen den Quellcode vor, unabhaengig von den Berichten:
(1) jedes Interface/jede Funktion in reference/bitburner-src/src/ScriptEditor/NetscriptDefinitions.d.ts (alle Namespaces: Basis-ns, hacknet, bladeburner, codingcontract, cloud, dnet, gang, go, sleeve, stock, formulas, stanek, infiltration, corporation, ui, singularity, grafting) - steht jede Funktion mit Ertrag in irgendeinem Inventar?
(2) jedes Verzeichnis unter reference/bitburner-src/src/ - ist jede Mechanik mit Ertrag erfasst (z.B. Literature/Messages, Milestones, Achievements, ExportBonus, Exploits, Hospital, Casino, NetworkShare, Darkweb, RedPill, Infiltration, Arcade?)?
(3) BitNode-Optionen (bitNodeOptions, sourceFileOverrides) und Source-File-Effekte (SourceFile/applySourceFile.ts) fuer SF1-SF15 inkl. Stufen.
(4) Wechselwirkungen zwischen Bereichen, die kein Einzelpruefer sieht (z.B. Sleeve-Shock und Augs, Hash-Upgrades fuer Bladeburner, Gang-Faktion als Augquelle fuer V2, Go-Boni auf Bladeburner, Firmenfaktionen).
Melde NUR echte Luecken (Feature mit moeglichem Ertrag, das in keinem Inventar steht oder dort falsch eingeordnet ist). Bericht nach ${OUT}/kritik-inventar.md.`, { label: 'kritik:inventar', phase: 'Critic', schema: CRITIC_SCHEMA, model: 'opus' })

let extra = []
if (critic && critic.gaps && critic.gaps.length) {
  phase('Nachtrag')
  log(`Kritik: ${critic.gaps.length} Luecken - Nachtrag in Gruppen`)
  const groups = []
  const per = 5
  for (let i = 0; i < critic.gaps.length; i += per) groups.push(critic.gaps.slice(i, i + per))
  extra = (await parallel(groups.map((gs, i) => () => agent(`${COMMON}

NACHTRAG ${i + 1}: Die Vollstaendigkeitskritik (${OUT}/kritik-inventar.md) hat diese Luecken im Feature-Inventar gefunden:
${gs.map((g, k) => `${k + 1}. ${g.feature} (${g.source_ref}) - ${g.why_relevant}`).join('\n')}
Fuer jede Luecke: Inventarzeile aus dem Quellcode, Abdeckungszeile gegen den Bot (Datei:Zeile, Kategorie), Ertrag absolut (rechnen/eichen wo moeglich), und nur bei echtem Ertrag/Fehler einen Befund. Bericht nach ${OUT}/nachtrag-${i + 1}.md.`, { label: `nachtrag:${i + 1}`, phase: 'Nachtrag', schema: RESULT, model: 'opus' }).then(r => r && ({ kind: 'nachtrag', key: `N${i + 1}`, ...r }))))).filter(Boolean)
}

const all = [...sweep, ...extra]
return {
  reports: all.map(r => ({ kind: r.kind, key: r.key, report_path: r.report_path, inventory_count: r.inventory_count, coverage_counts: r.coverage_counts, n_findings: (r.findings || []).length, calculators: r.calculators, open_questions: r.open_questions })),
  critic_gaps: critic ? critic.gaps.length : null,
  findings: all.flatMap(r => (r.findings || []).map(f => ({ ...f, from: `${r.kind}:${r.key}` }))),
}
