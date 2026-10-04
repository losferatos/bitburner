# Datenfluss-Tabelle (erzeugt von tools/audit/datenfluss.mjs)

Stand 2026-10-04T11:32:50.005Z. 141 Spiel-Dateien (src/), 70 Host-Dateien (sync/, tools/), 72 Wrapper-Eintraege, 752 Spiel-Sites, 394 Host-Sites.
Eichung gegen den Spielstand LIVE_197f4d61481686_BN2L2_2026-10-04T13-17_hourly.json.gz (173 Textdateien auf home).

Lesehilfe: Schreiber/Leser stehen als `Datei:Zeile [Weg]`. `~name` heisst: ueber ein Namensmuster mit {?} getroffen. R = ns.read / getFile, X = fileExists (Flagdatei), `wrapper:` = ueber lib/hostdatei.js oder eine lokale Huelle. `Spiel` = Eintrag im Spielstand (Bytes).

## Geschrieben, nie gelesen (95)

| Datei | Schreiber Datei:Zeile | Leser Datei:Zeile | Spiel | Betrieb |
|---|---|---|---|---|
| `data/astufe.json` | astufe.js:12 [direkt:write] | - | 183 B | Handwerkzeug |
| `data/audiocheck.txt` | audiocheck.js:15 [direkt:write] | - | 122 B | Handwerkzeug |
| `data/augcheck.json` | augcheck.js:33 [direkt:write]<br>augcheck.js:41 [direkt:write] | - | 195 B | Handwerkzeug |
| `data/augcount.json` | augcount.js:97 [direkt:write] | - | 5173 B | Handwerkzeug |
| `data/augcount.txt` | augcount.js:98 [direkt:write] | - | 1453 B | Handwerkzeug |
| `data/augs.txt` | buyaugs.js:1631 [direkt:write] | - | 14453 B | Handwerkzeug |
| `data/backdoor.txt` | backdoor.js:27 [direkt:write] | - | 122 B | Handwerkzeug |
| `data/bbjoin.txt` | bbtrain.js:352 [direkt:write] | - | 13 B | LIVE |
| `data/bbtick.json` | bbtick.js:47 [direkt:write] | - | 307 B | Handwerkzeug |
| `data/bitverse.txt` | bitverse.js:21 [direkt:write] | - | nicht im Spiel | Handwerkzeug |
| `data/blackops.json` | blackops.js:15 [direkt:write]<br>blackops.js:33 [direkt:write] | - | 2380 B | Handwerkzeug |
| `data/bn4door-log.txt` | bn4door.js:80 [direkt:write] | - | 318 B | LIVE |
| `data/bn4life-log.txt` | bn4life.js:89 [direkt:write] | - | 1345 B | LIVE |
| `data/bn4net-log.txt` | bn4net.js:843 [direkt:write] | - | 18415 B | LIVE |
| `data/bn4rep-log.txt` | bn4rep.js:94 [direkt:write] | - | 1780 B | LIVE |
| `data/bodauer.json` | bodauer.js:20 [direkt:write] | - | 195 B | Handwerkzeug |
| `data/boerse-log.txt` | boerse.js:112 [direkt:write] | - | nicht im Spiel | LIVE |
| `data/boot.txt` | boot.js:49 [direkt:write] | - | 856 B | LIVE |
| `data/boprobe.json` | boprobe.js:22 [direkt:write] | - | nicht im Spiel | Handwerkzeug |
| `data/brcheck.txt` | brcheck.js:27 [direkt:write] | - | 107 B | Handwerkzeug |
| `data/buyone.txt` | buyone.js:24 [direkt:write] | - | 63 B | Handwerkzeug |
| `data/calccheck.txt` | calccheck.js:23 [direkt:write] | - | 1915 B | Handwerkzeug |
| `data/cdump-log.txt` | cdump.js:202 [direkt:write] | - | 72 B | LIVE |
| `data/cdump.json` | cdump.js:165 [direkt:write] | - | 120 B | LIVE |
| `data/chance.json` | chance.js:42 [direkt:write]<br>chance.js:120 [direkt:write] | - | 407 B | Handwerkzeug |
| `data/cheap.txt` | cheap.js:77 [direkt:write] | - | 3474 B | Handwerkzeug |
| `data/csolve.txt` | csolve.js:135 [direkt:write] | - | 117 B | LIVE |
| `data/daedalus.txt` | daedalus.js:62 [direkt:write] | - | 775 B | Handwerkzeug |
| `data/darkweb.txt` | darkweb.js:58 [direkt:write] | - | 274 B | LIVE |
| `data/donate.txt` | donate.js:60 [direkt:write] | - | 66 B | Handwerkzeug |
| `data/echoargs.txt` | echoargs.js:5 [direkt:write] | - | 36 B | Handwerkzeug |
| `data/exploit2.json` | exploit2.js:73 [direkt:write]<br>exploit2.js:117 [direkt:write] | - | nicht im Spiel | Handwerkzeug |
| `data/exploit3.json` | exploit3.js:54 [direkt:write] | - | nicht im Spiel | Handwerkzeug |
| `data/export.txt` | exportbonus.js:34 [direkt:write] | - | 240 B | Handwerkzeug |
| `data/favorweg.txt` | favorweg.js:74 [direkt:write] | - | 1001 B | Handwerkzeug |
| `data/fertig.txt` | ausgang.js:235 [wrapper:nachHome] | - | nicht im Spiel | LIVE |
| `data/figwatch-log.txt` | figwatch.js:47 [direkt:write] | - | 124 B | LIVE |
| `data/formcheck.txt` | formcheck.js:30 [direkt:write] | - | 1505 B | Handwerkzeug |
| `data/gang-log.txt` | gang.js:1023 [wrapper:haengeAnHome] | - | 4861 B | LIVE |
| `data/geld.json` | geld.js:51 [direkt:write] | - | 182 B | Handwerkzeug |
| `data/graftauto-log.txt` | graftauto.js:82 [direkt:write] | - | nicht im Spiel | LIVE |
| `data/guard-log.txt` | guard.js:67 [direkt:write] | - | 165 B | LIVE |
| `data/hacknet.txt` | hacknet.js:45 [direkt:write] | - | 44 B | LIVE |
| `data/hacktimer.json` | hacktimer.js:67 [direkt:write] | - | 152 B | Handwerkzeug |
| `data/hashgym.txt` | hashgym.js:17 [direkt:write] | - | 140 B | Handwerkzeug |
| `data/homegrow.txt` | homegrow.js:66 [direkt:write] | - | 147 B | LIVE |
| `data/install.txt` | install.js:47 [direkt:write] | - | 208 B | Handwerkzeug |
| `data/join-probe.txt` | probe.js:216 [direkt:write] | - | nicht im Spiel | Handwerkzeug |
| `data/joinfac.txt` | joinfac.js:32 [direkt:write] | - | 133 B | Handwerkzeug |
| `data/joinplan.txt` | joinplan.js:44 [direkt:write] | - | 748 B | Handwerkzeug |
| `data/joinrun.txt` | joinrun.js:53 [direkt:write] | - | 1040 B | LIVE |
| `data/kampfaugs.txt` | kampfaugs.js:115 [direkt:write] | - | 714 B | Handwerkzeug |
| `data/kanaltest.txt` | kanaltest.js:11 [direkt:write] | - | 5 B | Handwerkzeug |
| `data/kaufplan.txt` | kaufplan.js:88 [direkt:write] | - | 1197 B | Handwerkzeug |
| `data/keepalive.txt` | keepalive.js:84 [direkt:write] | - | 211 B | Handwerkzeug |
| `data/kerne.txt` | kerne.js:46 [direkt:write] | - | 737 B | Handwerkzeug |
| `data/kill.txt` | kill.js:27 [direkt:write] | - | 52 B | Handwerkzeug |
| `data/killrep.txt` | killrep.js:22 [direkt:write] | - | 37 B | Handwerkzeug |
| `data/killui.txt` | killui.js:53 [direkt:write] | - | 52 B | Handwerkzeug |
| `data/lage.json` | lage.js:29 [direkt:write] | - | 1103 B | Handwerkzeug |
| `data/netburn.txt` | netburn.js:92 [direkt:write] | - | 468 B | LIVE |
| `data/network.txt` | scan.js:50 [direkt:write] | - | 19618 B | Handwerkzeug |
| `data/netz.json` | netz.js:19 [direkt:write] | - | 6549 B | Handwerkzeug |
| `data/popups-beitritt.txt` | popups.js:221 [direkt:write] | - | 14218 B | LIVE |
| `data/popups-halt.txt` | popups.js:293 [direkt:write]<br>popups.js:310 [direkt:write] | - | 44 B | LIVE |
| `data/popups-wache.txt` | popups.js:178 [direkt:write]<br>popups.js:182 [direkt:write] | - | 482 B | LIVE |
| `data/preis.json` | preis.js:10 [direkt:write] | - | 102 B | Handwerkzeug |
| `data/probe2.txt` | probe2.js:16 [direkt:write] | - | 963 B | Handwerkzeug |
| `data/probe3.txt` | probe3.js:17 [direkt:write] | - | 262 B | Handwerkzeug |
| `data/punish.json` | punish.js:99 [direkt:write] | - | nicht im Spiel | LIVE |
| `data/ramcheck.json` | ramcheck.js:7 [direkt:write] | - | 54 B | Handwerkzeug |
| `data/reboot.txt` | reboot.js:33 [direkt:write] | - | 45 B | Handwerkzeug |
| `data/rep-ziel.txt` | bn4rep.js:2951 [wrapper:schreibNachHome] | - | 755 B | LIVE |
| `data/restart.txt` | restart.js:23 [direkt:write] | - | 82 B | Handwerkzeug |
| `data/shop-log.txt` | shop.js:93 [direkt:write] | - | 204 B | LIVE |
| `data/skillcheck.json` | skillcheck.js:79 [direkt:write] | - | 777 B | Handwerkzeug |
| `data/sleevediag.json` | sleevediag.js:13 [direkt:write] | - | 435 B | Handwerkzeug |
| `data/sonde.json` | sonde.js:45 [direkt:write]<br>sonde.js:58 [direkt:write]<br>sonde.js:143 [direkt:write] | - | 344 B | Handwerkzeug |
| `data/sr.json` | sr.js:29 [direkt:write] | - | 350 B | Handwerkzeug |
| `data/srtest.json` | srtest.js:12 [direkt:write] | - | 102 B | Handwerkzeug |
| `data/stat.json` | stat.js:19 [direkt:write] | - | 622 B | Handwerkzeug |
| `data/stock.txt` | stockaccess.js:42 [direkt:write] | - | 251 B | Handwerkzeug |
| `data/stocks.txt` | stocks.js:54 [direkt:write] | - | 224 B | Handwerkzeug |
| `data/stopnight.txt` | stopnight.js:33 [direkt:write] | - | 47 B | Handwerkzeug |
| `data/stopwork.txt` | stopwork.js:27 [direkt:write] | - | 65 B | Handwerkzeug |
| `data/stufentest.json` | stufentest.js:30 [direkt:write] | - | 225 B | Handwerkzeug |
| `data/telemetry.txt` | autopilot.js:1945 [direkt:write]<br>telemetry.js:78 [direkt:write] | - | 3876 B | Handwerkzeug |
| `data/timerzwang.json` | timerzwang.js:27 [direkt:write] | - | nicht im Spiel | Handwerkzeug |
| `data/torprobe.txt` | torprobe.js:17 [direkt:write] | - | nicht im Spiel | Handwerkzeug |
| `data/trupp.json` | trupp.js:36 [direkt:write] | - | 176 B | Handwerkzeug |
| `data/vorrat.json` | vorrat.js:22 [direkt:write] | - | 131 B | Handwerkzeug |
| `data/wakelock.txt` | wakelock.js:67 [direkt:write]<br>wakelock.js:161 [direkt:write] | - | 27 B | LIVE |
| `data/wbgrow.txt` | wbgrow.js:30 [direkt:write] | - | 80 B | Handwerkzeug |
| `data/werkbank.json` | werkbank.js:53 [direkt:write] | - | 1635 B | Handwerkzeug |
| `data/work.txt` | work.js:45 [direkt:write] | - | 179 B | Handwerkzeug |

## Gelesen, nie geschrieben (10)

| Datei | Schreiber Datei:Zeile | Leser Datei:Zeile | Spiel | Betrieb |
|---|---|---|---|---|
| `data/batch-ziele.txt` | - | R bn4net.js:1968 [direkt:read] | 0 B | Handwerkzeug |
| `data/bn4-stop.txt` | - | X bn4life.js:130 [direkt:fileExists]<br>X bn4life.js:224 [direkt:fileExists]<br>X bn4net.js:979 [direkt:fileExists]<br>X bn4net.js:1017 [direkt:fileExists]<br>X boot.js:57 [direkt:fileExists]<br>... (+2) | nicht im Spiel | Handwerkzeug |
| `data/boerse-schliessen.txt` | - | X boerse.js:161 [direkt:fileExists] | nicht im Spiel | Handwerkzeug |
| `data/brain.txt` | - | R telemetry.js:45 [direkt:read]<br>X telemetry.js:43 [direkt:fileExists] | nicht im Spiel | Handwerkzeug |
| `data/exit-ziel.txt` | - | X boot.js:169 [direkt:fileExists] | nicht im Spiel | Handwerkzeug |
| `data/gang-an.txt` | - | X bn4rep.js:2287 [direkt:fileExists]<br>X gang.js:1055 [direkt:fileExists]<br>X registry.json:0 [requiresFile von gang.js (lib/reg.js:171)] | 131 B | Handwerkzeug |
| `data/gang-geld-aus.txt` | - | X gang.js:1249 [direkt:fileExists] | nicht im Spiel | Handwerkzeug |
| `data/guard-observe.txt` | - | X boot.js:251 [direkt:fileExists]<br>X guard.js:295 [direkt:fileExists] | nicht im Spiel | Handwerkzeug |
| `data/hilfe.txt` | - | R tools/checkin.js:159 [wrapper:hole]<br>R tools/strategie-check.js:444 [direkt:rpc]<br>R tools/wache.js:735 [wrapper:spieldatei]<br>X boot.js:139 [direkt:fileExists] | nicht im Spiel | Handwerkzeug |
| `data/punish-scharf.txt` | - | X bn4net.js:4599 [direkt:fileExists] | nicht im Spiel | Handwerkzeug |

## Schreiber und Leser vorhanden (82)

| Datei | Schreiber Datei:Zeile | Leser Datei:Zeile | Spiel | Betrieb |
|---|---|---|---|---|
| `{?}/../nodes/BAU-2026-09/sofort/{?}-{?}.md` | sync/bridge.js:1571 [wrapper:pushFile] | R sync/bridge.js:1314 [direkt:rpc] | nicht im Spiel | Host |
| `{?}figure-request-{?}` | lib/figurns.js:111 [direkt:write] ~data/figure-request-{?}.json | R bn4net.js:4499 [direkt:read] | 184 B, 205 B | lib |
| `data/aktionen.txt` | blade.js:1887 [wrapper:haengeAnHome] | R bbspann.js:71 [direkt:read]<br>R blade.js:2001 [wrapper:liesVonHome]<br>R tools/ratencheck.js:92 [wrapper:spieldatei]<br>X bbspann.js:70 [direkt:fileExists] | 189430 B | LIVE |
| `data/ausgang.json` | ausgang.js:199 [wrapper:nachHome]<br>ausgang.js:236 [wrapper:nachHome]<br>ausgang.js:242 [wrapper:nachHome]<br>ausgang.js:375 [wrapper:nachHome]<br>ausgang.js:713 [wrapper:nachHome]<br>... (+1) | R ausgang.js:185 [wrapper:liesVonHome]<br>R ausgang.js:654 [wrapper:liesVonHome]<br>R bn4net.js:5028 [direkt:read]<br>R graftauto.js:165 [wrapper:liesVonHome]<br>R guard.js:453 [wrapper:liesJson]<br>... (+6) | 560 B | LIVE |
| `data/ausgang.txt` | ausgang.js:121 [direkt:write] | R tools/checkin.js:175 [wrapper:hole] | 283 B | LIVE |
| `data/backup-ok.txt` | sync/bridge.js:1949 [wrapper:schreibeInsSpiel] | R lib/handschlag.js:157 [wrapper:liesVonHome]<br>R sync/bridge.js:1914 [direkt:rpc]<br>X boot.js:139 [direkt:fileExists] | nicht im Spiel | Host |
| `data/backup-request.txt` | lib/handschlag.js:118 [wrapper:nachHome] | R sync/bridge.js:1895 [direkt:rpc]<br>X boot.js:139 [direkt:fileExists] | nicht im Spiel | LIVE |
| `data/bbgraft.json` | bbgraft.js:56 [direkt:write] | R tools/graftnext.js:88 [wrapper:datei] | 63284 B | Handwerkzeug |
| `data/bblage.json` | bblage.js:24 [direkt:write] | R tools/checkin.js:157 [wrapper:holeJson]<br>R tools/strategie-check.js:105 [wrapper:liesJson]<br>R tools/strategie-check.js:113 [wrapper:liesJson]<br>R tools/strategie-check.js:116 [wrapper:liesJson]<br>R tools/wache.js:882 [wrapper:spielJson] | 265 B | Handwerkzeug |
| `data/bbspann.json` | bbspann.js:13 [direkt:write]<br>bbspann.js:396 [direkt:write] | R tools/spann.js:44 [direkt:rpc] | 6107 B | Handwerkzeug |
| `data/bbtrain.json` | bbtrain.js:91 [direkt:write] | R punish.js:247 [wrapper:liesJson]<br>R registry.json:0 [telemetryFile von bbtrain.js (guard.js:417, bn4net.js:5112)] | 36 B | LIVE |
| `data/beitritt-erledigt.txt` | bn4life.js:245 [wrapper:nachHome]<br>joinrun.js:306 [direkt:write] | R bn4life.js:190 [wrapper:liesVonHome]<br>X boot.js:139 [direkt:fileExists] | 13 B | LIVE |
| `data/blade.json` | blade.js:855 [direkt:write]<br>blade.js:1758 [direkt:write] | R ausgang.js:357 [wrapper:liesVonHome]<br>R blade.js:809 [direkt:read]<br>R bn4net.js:4862 [direkt:read]<br>R bn4rep.js:561 [wrapper:liesVonHome]<br>R hashes.js:170 [wrapper:liesVonHome]<br>... (+10) | 1259 B | LIVE |
| `data/bladeoffen.txt` | blade.js:1919 [wrapper:nachHome]<br>blade.js:1939 [wrapper:nachHome]<br>blade.js:1967 [wrapper:nachHome] | R blade.js:1948 [wrapper:liesVonHome] | 160 B | LIVE |
| `data/blocked-hosts.json` | guard.js:1447 [direkt:write] | R bn4net.js:4086 [direkt:read]<br>X bn4net.js:4085 [direkt:fileExists]<br>X boot.js:139 [direkt:fileExists] | nicht im Spiel | LIVE |
| `data/bn4door.json` | bn4door.js:151 [direkt:write] | R tools/bn4.js:85 [wrapper:liesVon]<br>R tools/bn4.js:85 [wrapper:lies]<br>R registry.json:0 [telemetryFile von bn4door.js (guard.js:417, bn4net.js:5112)] | 175 B | LIVE |
| `data/bn4job.json` | bn4rep.js:2494 [direkt:write] | R tools/firma.js:42 [direkt:rpc]<br>R tools/wache.js:525 [wrapper:spielJson] | 211 B | LIVE |
| `data/bn4life.json` | bn4life.js:619 [direkt:write] | R bn4net.js:1064 [direkt:read]<br>R tools/bn4.js:46 [wrapper:lies]<br>R tools/bn4watch.js:132 [wrapper:readJsonFile]<br>R registry.json:0 [telemetryFile von bn4life.js (guard.js:417, bn4net.js:5112)] | 434 B | LIVE |
| `data/bn4net.json` | bn4net.js:4348 [direkt:write] | R graftauto.js:161 [wrapper:liesVonHome]<br>R guard.js:354 [wrapper:liesJson]<br>R homegrow.js:108 [wrapper:liesVonHome]<br>R lib/figurns.js:67 [wrapper:liesVonHome]<br>R punish.js:191 [wrapper:liesJson]<br>... (+8) | 1699 B | LIVE |
| `data/bn4rep.json` | bn4rep.js:1993 [direkt:write]<br>bn4rep.js:3237 [direkt:write] | R bn4net.js:1505 [direkt:read]<br>R gang.js:1147 [wrapper:liesVonHome]<br>R gang.js:1238 [wrapper:liesVonHome]<br>R sleeve.js:404 [wrapper:liesVonHome]<br>R tools/bn4.js:84 [wrapper:liesVon]<br>... (+7) | 2334 B | LIVE |
| `data/boerse.json` | boerse.js:130 [wrapper:nachHome]<br>boerse.js:163 [wrapper:nachHome]<br>boerse.js:284 [wrapper:nachHome] | R punish.js:314 [wrapper:liesJson]<br>R registry.json:0 [telemetryFile von boerse.js (guard.js:417, bn4net.js:5112)] | nicht im Spiel | LIVE |
| `data/bridge.json` | sync/bridge.js:2069 [wrapper:schreibeInsSpiel] | R bn4net.js:5092 [direkt:read]<br>R export.js:126 [wrapper:lies]<br>R guard.js:356 [wrapper:liesJson]<br>R lib/handschlag.js:208 [wrapper:liesVonHome] | 545 B | Host |
| `data/cantwort.json` | cdump.js:174 [direkt:write] | R csolve.js:60 [direkt:read]<br>X registry.json:0 [forbidsFile von cdump.js (lib/reg.js:174)]<br>X registry.json:0 [requiresFile von csolve.js (lib/reg.js:171)] | 98 B | LIVE |
| `data/cdump-stand.json` | cdump.js:258 [direkt:write] | R bn4net.js:5195 [direkt:read]<br>R cdump.js:253 [direkt:read]<br>X bn4net.js:5194 [direkt:fileExists]<br>X boot.js:139 [direkt:fileExists] | nicht im Spiel | LIVE |
| `data/cmd-out.txt` | hand.js:49 [direkt:write] | R tools/hand.js:66 [direkt:rpc] | 91 B | Handwerkzeug |
| `data/cmd.txt` | tools/hand.js:94 [direkt:rpc] | R hand.js:120 [direkt:read]<br>X hand.js:113 [direkt:fileExists] | 24 B | Host |
| `data/company-order.txt` | tools/firma.js:85 [direkt:rpc] | R bn4rep.js:856 [wrapper:liesVonHome]<br>R tools/firma.js:40 [direkt:rpc]<br>X boot.js:139 [direkt:fileExists] | nicht im Spiel | Host |
| `data/contracts-halt.txt` | contracts.js:443 [direkt:write] | R contracts.js:200 [direkt:read] | nicht im Spiel | LIVE |
| `data/contracts.json` | contracts.js:486 [direkt:write] | R bn4net.js:5195 [direkt:read]<br>R contracts.js:272 [direkt:read]<br>X bn4net.js:5194 [direkt:fileExists]<br>X boot.js:139 [direkt:fileExists] | 179 B | LIVE |
| `data/contracts.txt` | contracts.js:183 [direkt:write]<br>contracts.js:190 [direkt:write] | R contracts.js:180 [direkt:read] | 125536 B | LIVE |
| `data/csolve.json` | csolve.js:122 [direkt:write] | R registry.json:0 [telemetryFile von csolve.js (guard.js:417, bn4net.js:5112)] | 323 B | LIVE |
| `data/einbau-uhr.json` | bn4rep.js:1197 [wrapper:schreibNachHome] | R bn4rep.js:1185 [wrapper:liesVonHome] | 68 B | LIVE |
| `data/einbau.json` | bn4rep.js:1536 [wrapper:schreibNachHome] | R ausgang.js:792 [wrapper:liesVonHome]<br>R punish.js:221 [wrapper:liesJson] | 397 B | LIVE |
| `data/events.json` | ausgang.js:674 [wrapper:nachHome]<br>ausgang.js:803 [wrapper:nachHome]<br>ausgang.js:834 [wrapper:nachHome]<br>bn4net.js:4724 [direkt:write]<br>boerse.js:417 [wrapper:nachHome]<br>... (+6) | R ausgang.js:661 [wrapper:liesVonHome]<br>R ausgang.js:765 [wrapper:liesVonHome]<br>R ausgang.js:829 [wrapper:liesVonHome]<br>R bn4net.js:4718 [direkt:read]<br>R bn4net.js:4757 [direkt:read]<br>... (+12) | 125637 B | LIVE |
| `data/exit.txt` | exit.js:42 [direkt:write] | R ausgang.js:412 [wrapper:liesVonHome]<br>R ausgang.js:423 [wrapper:liesVonHome]<br>X boot.js:169 [direkt:fileExists] | nicht im Spiel | LIVE |
| `data/export.json` | export.js:283 [wrapper:nachHome] | R export.js:194 [wrapper:lies]<br>R registry.json:0 [telemetryFile von export.js (guard.js:417, bn4net.js:5112)] | 193 B | LIVE |
| `data/fehlend.json` | guard.js:437 [direkt:write] | R guard.js:427 [direkt:read]<br>R tools/checkin.js:741 [wrapper:holeJson] | 2 B | LIVE |
| `data/figure-request-{?}.json` | lib/figurns.js:111 [direkt:write] | R bn4net.js:4499 [direkt:read] ~{?}figure-request-{?} | 184 B, 205 B | lib |
| `data/figure.txt` | bn4net.js:4534 [direkt:write] | R bn4net.js:4507 [direkt:read]<br>R figwatch.js:90 [wrapper:liesVonHome]<br>R lib/figurns.js:142 [direkt:read]<br>X bn4net.js:4506 [direkt:fileExists]<br>X lib/figurns.js:136 [direkt:fileExists] | 176 B | LIVE |
| `data/figwatch.json` | figwatch.js:166 [wrapper:nachHome] | R registry.json:0 [telemetryFile von figwatch.js (guard.js:417, bn4net.js:5112)] | 535 B | LIVE |
| `data/gang.json` | gang.js:1099 [direkt:write] | R bn4rep.js:1820 [wrapper:liesVonHome]<br>R gang.js:1111 [wrapper:liesVonHome]<br>R tools/checkin.js:759 [wrapper:holeJson]<br>R tools/checkin.js:868 [wrapper:holeJson]<br>R registry.json:0 [telemetryFile von gang.js (guard.js:417, bn4net.js:5112)] | 864 B | LIVE |
| `data/geldbedarf.txt` | bn4rep.js:2385 [direkt:write] | R bn4life.js:345 [wrapper:liesVonHome]<br>R bn4net.js:1273 [direkt:read]<br>R gang.js:1325 [wrapper:liesVonHome]<br>R graftauto.js:337 [wrapper:liesVonHome]<br>R hacknet.js:135 [wrapper:liesVonHome]<br>... (+8) | 9 B | LIVE |
| `data/graft.json` | graft.js:229 [direkt:write] | R graftauto.js:299 [wrapper:liesVonHome]<br>R punish.js:326 [wrapper:liesJson]<br>R tools/graftnext.js:56 [wrapper:datei] | 207 B | LIVE |
| `data/graftauto.json` | graftauto.js:111 [wrapper:nachHome]<br>graftauto.js:182 [wrapper:nachHome]<br>graftauto.js:375 [wrapper:nachHome] | R punish.js:325 [wrapper:liesJson]<br>R tools/hotswap.js:207 [wrapper:spielJson]<br>R registry.json:0 [telemetryFile von graftauto.js (guard.js:417, bn4net.js:5112)] | nicht im Spiel | LIVE |
| `data/guard-modus.txt` | boot.js:255 [direkt:write] | R boot.js:253 [direkt:read]<br>R guard.js:298 [wrapper:liesVonHome]<br>X boot.js:252 [direkt:fileExists] | 7 B | LIVE |
| `data/hand-puls.txt` | hand.js:76 [direkt:write] | R autopilot.js:850 [direkt:read]<br>X autopilot.js:849 [direkt:fileExists] | 13 B | Handwerkzeug |
| `data/hashes.json` | hashes.js:129 [direkt:write] | R bn4net.js:4944 [direkt:read]<br>R hacknet.js:178 [wrapper:liesVonHome]<br>R registry.json:0 [telemetryFile von hashes.js (guard.js:417, bn4net.js:5112)] | 264 B | LIVE |
| `data/hb-rep.txt` | bn4rep.js:689 [wrapper:schreibNachHome] | R tools/wache.js:526 [wrapper:spieldatei] | 13 B | LIVE |
| `data/install-sperre.txt` | bn4rep.js:2049 [wrapper:schreibNachHome]<br>bn4rep.js:2473 [wrapper:schreibNachHome]<br>lib/handschlag.js:304 [wrapper:nachHome] | R bn4rep.js:926 [wrapper:liesVonHome]<br>R bn4rep.js:1085 [wrapper:liesVonHome]<br>R bn4rep.js:2459 [wrapper:liesVonHome]<br>R tools/hotswap.js:217 [wrapper:spielJson]<br>X boot.js:139 [direkt:fileExists] | nicht im Spiel | LIVE |
| `data/invest.txt` | invest.js:62 [direkt:write] | R tools/status.js:99 [direkt:rpc] | 77 B | Handwerkzeug |
| `data/kaufauftrag.json` | bn4net.js:247 [direkt:write] | R shop.js:179 [wrapper:liesVonHome]<br>X boot.js:139 [direkt:fileExists] | 120 B | LIVE |
| `data/kaufergebnis.json` | shop.js:341 [wrapper:nachHome] | R bn4net.js:263 [direkt:read]<br>R shop.js:122 [wrapper:liesVonHome]<br>X bn4net.js:257 [direkt:fileExists]<br>X boot.js:139 [direkt:fileExists] | 122 B | LIVE |
| `data/keine-hacknet.txt` | hacknet.js:66 [direkt:write]<br>hashes.js:122 [direkt:write] | R bn4net.js:3814 [wrapper:markerGilt]<br>R tools/strategie-check.js:737 [wrapper:liesDatei]<br>X boot.js:169 [direkt:fileExists]<br>X registry.json:0 [forbidsFile von hashes.js (lib/reg.js:174)] | nicht im Spiel | LIVE |
| `data/keine-sleeves.txt` | sleevecrime.js:55 [direkt:write] | R bn4net.js:3815 [wrapper:markerGilt]<br>X boot.js:169 [direkt:fileExists]<br>X registry.json:0 [forbidsFile von sleevecrime.js (lib/reg.js:174)] | nicht im Spiel | LIVE |
| `data/knoten.json` | bn4rep.js:711 [wrapper:schreibNachHome]<br>knoten.js:34 [direkt:write] | R tools/strategie-check.js:760 [wrapper:liesJson]<br>R tools/wache.js:604 [wrapper:spielJson] | 84 B | LIVE |
| `data/kpi.json` | bn4net.js:5232 [direkt:write] | R bn4net.js:4797 [direkt:read]<br>R guard.js:355 [wrapper:liesJson]<br>R tools/checkin.js:471 [wrapper:holeJson]<br>R tools/checkin.js:703 [wrapper:holeJson]<br>R tools/strategie-check.js:544 [wrapper:liesJson]<br>... (+1) | 1364 B | LIVE |
| `data/motorzeit.json` | bn4net.js:5273 [direkt:write] | R bn4net.js:876 [direkt:read]<br>X bn4net.js:876 [direkt:fileExists] | 276 B | LIVE |
| `data/penalties.json` | guard.js:997 [wrapper:schreib] | R guard.js:92 [wrapper:liesJson]<br>R punish.js:353 [wrapper:liesJson]<br>R tools/checkin.js:704 [wrapper:holeJson] | 47232 B | LIVE |
| `data/penalty-order.json` | guard.js:1391 [direkt:write] | R punish.js:149 [wrapper:liesJson] | nicht im Spiel | LIVE |
| `data/popups.txt` | popups.js:348 [direkt:write] | R tools/strategie-check.js:1129 [direkt:rpc] | 19 B | LIVE |
| `data/portknacker-komplett.txt` | darkweb.js:276 [direkt:write] | X boot.js:139 [direkt:fileExists]<br>X registry.json:0 [forbidsFile von darkweb.js (lib/reg.js:174)] | nicht im Spiel | LIVE |
| `data/preise.json` | shop.js:165 [wrapper:nachHome] | R bn4net.js:180 [direkt:read]<br>X bn4net.js:179 [direkt:fileExists]<br>X boot.js:139 [direkt:fileExists] | 1212 B | LIVE |
| `data/ps.json` | ps.js:21 [direkt:write] | R tools/libverteilen.js:95 [direkt:rpc]<br>R tools/neustart.js:155 [direkt:rpc]<br>R tools/strategie-check.js:497 [wrapper:liesJson] | 1203 B | Handwerkzeug |
| `data/reload.txt` | bn4life.js:267 [wrapper:nachHome]<br>bn4net.js:1025 [direkt:write]<br>bn4net.js:1215 [direkt:write]<br>bn4net.js:1219 [direkt:write]<br>tools/neustart.js:190 [direkt:rpc] | R bn4life.js:264 [wrapper:liesVonHome]<br>R bn4net.js:1000 [direkt:read]<br>R bn4net.js:1184 [direkt:read]<br>R tools/neustart.js:211 [direkt:rpc]<br>X bn4net.js:999 [direkt:fileExists]<br>... (+2) | 0 B | LIVE |
| `data/rep-modus.txt` | bn4rep.js:2465 [wrapper:schreibNachHome]<br>bn4rep.js:2997 [direkt:write]<br>bn4rep.js:3012 [direkt:write]<br>joinrun.js:98 [direkt:write] | R bn4life.js:557 [wrapper:liesVonHome]<br>R bn4net.js:2169 [direkt:read]<br>R sleeve.js:396 [wrapper:liesVonHome]<br>X bn4life.js:556 [direkt:fileExists]<br>X bn4net.js:2168 [direkt:fileExists]<br>... (+2) | 25 B | LIVE |
| `data/reserve.txt` | tools/reserve.js:57 [direkt:rpc] | R autopilot.js:395 [direkt:read]<br>R stocks.js:129 [direkt:read]<br>R tools/reserve.js:43 [direkt:rpc]<br>X autopilot.js:394 [direkt:fileExists]<br>X stocks.js:128 [direkt:fileExists] | 1 B | Host |
| `data/shop.json` | shop.js:271 [wrapper:nachHome]<br>shop.js:311 [wrapper:nachHome] | R registry.json:0 [telemetryFile von shop.js (guard.js:417, bn4net.js:5112)] | 262 B | LIVE |
| `data/simulacrum.txt` | graft.js:58 [direkt:write] | X blade.js:3979 [direkt:fileExists]<br>X boot.js:169 [direkt:fileExists]<br>X graft.js:57 [direkt:fileExists]<br>X graft.js:85 [direkt:fileExists] | nicht im Spiel | LIVE |
| `data/sleeve.json` | sleeve.js:938 [direkt:write] | R tools/checkin.js:168 [wrapper:holeJson]<br>R registry.json:0 [telemetryFile von sleeve.js (guard.js:417, bn4net.js:5112)] | 296 B | LIVE |
| `data/sofort.json` | ausgang.js:675 [wrapper:nachHome]<br>export.js:279 [wrapper:nachHome]<br>sync/bridge.js:2235 [wrapper:schreibeInsSpiel] | R ausgang.js:677 [wrapper:liesVonHome]<br>R export.js:248 [wrapper:lies]<br>R sync/bridge.js:2177 [direkt:rpc] | 9180 B | LIVE |
| `data/startdiag.json` | startdiag.js:109 [direkt:write] | R tools/eichung-messen.js:126 [direkt:rpc]<br>R tools/libverteilen.js:91 [direkt:rpc] | 859 B | Handwerkzeug |
| `data/task.txt` | autopilot.js:460 [direkt:write]<br>autopilot.js:917 [direkt:write]<br>bn4life.js:370 [wrapper:nachHome]<br>bn4life.js:512 [direkt:write]<br>bn4net.js:1074 [direkt:write]<br>... (+10) | R autopilot.js:427 [direkt:read]<br>R autopilot.js:899 [direkt:read]<br>R bn4life.js:369 [wrapper:liesVonHome]<br>R bn4net.js:1073 [direkt:read]<br>R tools/graftnext.js:126 [wrapper:datei]<br>... (+8) | 0 B | LIVE |
| `data/torrunde-wait.json` | bn4rep.js:1708 [wrapper:schreibNachHome] | R bn4rep.js:1629 [wrapper:liesVonHome] | nicht im Spiel | LIVE |
| `data/verfahren.txt` | ausgang.js:228 [wrapper:nachHome] | R ausgang.js:227 [wrapper:liesVonHome]<br>R bn4net.js:675 [direkt:read]<br>R bn4net.js:3799 [direkt:read]<br>R bn4rep.js:150 [wrapper:liesVonHome]<br>R bn4rep.js:796 [wrapper:liesVonHome]<br>... (+11) | 6 B | LIVE |
| `data/watchdog-uhren.json` | guard.js:996 [wrapper:schreib] | R guard.js:90 [wrapper:liesVonHome] | 3257 B | LIVE |
| `data/watchdog.json` | guard.js:998 [wrapper:schreib] | R bn4net.js:4566 [direkt:read]<br>R bn4net.js:5058 [direkt:read]<br>R guard.js:91 [wrapper:liesVonHome]<br>R tools/checkin.js:705 [wrapper:holeJson]<br>R registry.json:0 [telemetryFile von guard.js (guard.js:417, bn4net.js:5112)]<br>... (+1) | 689 B | LIVE |
| `data/workfaction.txt` | tools/nightshift.js:507 [direkt:rpc]<br>tools/nightshift.js:545 [direkt:rpc] | R autopilot.js:584 [direkt:read]<br>X autopilot.js:583 [direkt:fileExists] | 8 B | Host |
| `graftplan.json` | src/graftplan.json:0 [pushFile (statisch)] | R graftauto.js:106 [wrapper:liesVonHome]<br>X registry.json:0 [requiresFile von graftauto.js (lib/reg.js:171)] | nicht im Spiel | Handwerkzeug |
| `lib/bitnodes.json` | src/lib/bitnodes.json:0 [pushFile (statisch)] | R bn4net.js:130 [direkt:read]<br>X bn4net.js:130 [direkt:fileExists] | 19765 B | Handwerkzeug |
| `lib/blackops.json` | src/lib/blackops.json:0 [pushFile (statisch)] | R ausgang.js:178 [wrapper:liesVonHome]<br>R bn4rep.js:554 [wrapper:liesVonHome] | 9227 B | Handwerkzeug |
| `registry.json` | src/registry.json:0 [pushFile (statisch)] | R bn4net.js:98 [direkt:read]<br>R boot.js:200 [direkt:read]<br>R guard.js:359 [wrapper:liesVonHome]<br>R guard.js:1260 [direkt:read]<br>X bn4net.js:98 [direkt:fileExists]<br>... (+2) | 17478 B | Handwerkzeug |
| `route.json` | src/route.json:0 [pushFile (statisch)] | R ausgang.js:196 [wrapper:liesVonHome]<br>R exit.js:79 [direkt:read]<br>X exit.js:71 [direkt:fileExists]<br>X exit.js:71 [direkt:fileExists]<br>X exit.js:76 [direkt:fileExists] | 2838 B | Handwerkzeug |

## Host-Dateien (data/ im Projekt, von sync/ und tools/ geschrieben und gelesen)

| Datei | Schreiber | Leser | Vorhanden |
|---|---|---|---|
| `{?}` | - | sync/backup.js:364<br>sync/backup.js:387<br>sync/backup.js:451<br>sync/backup.js:509 |  |
| `{?}-{?}.md` | sync/bridge.js:2153 | sync/bridge.js:1307<br>sync/bridge.js:1571 |  |
| `{?}-nightshift.log` | tools/nightshift.js:133 | - |  |
| `{?}-wiederherstellung.md` | tools/wiederherstellung.js:332 | - |  |
| `{?}.json` | tools/meter.js:123 | tools/meter.js:118 |  |
| `{?}.tmp` | tools/liste.js:95<br>tools/liste.js:116 | tools/liste.js:98 |  |
| `{?}{?}{?}_{?}{?}{?}_{?}-b64.json` | sync/backup.js:462 | - |  |
| `{?}{?}{?}_{?}{?}{?}_{?}-b64.json.gz` | sync/backup.js:462 | - |  |
| `{?}{?}{?}_{?}{?}{?}_{?}.json` | sync/backup.js:462 | - |  |
| `{?}{?}{?}_{?}{?}{?}_{?}.json.gz` | sync/backup.js:462 | - |  |
| `{?}{?}{?}_{?}{?}{?}{?}{?}_{?}-b64.json` | sync/backup.js:462 | - |  |
| `{?}{?}{?}_{?}{?}{?}{?}{?}_{?}-b64.json.gz` | sync/backup.js:462 | - |  |
| `{?}{?}{?}_{?}{?}{?}{?}{?}_{?}.json` | sync/backup.js:462 | - |  |
| `{?}{?}{?}_{?}{?}{?}{?}{?}_{?}.json.gz` | sync/backup.js:462 | - |  |
| `ARCHITEKTUR.md` | - | tools/registry-bauen.js:26<br>tools/registry-bauen.js:39 | ja |
| `aufsicht.log` | tools/aufsicht.js:354 | - | ja |
| `AUFTRAG-BAU-2026-09.md` | - | tools/archivliste.js:75 | ja |
| `BAUSTELLEN.md` | - | tools/liste.js:133 | ja |
| `bitnodes.json` | tools/bitnodes-tabelle.js:287 | tools/bitnodes-tabelle.js:271<br>tools/bitnodes-tabelle.js:273 | ja |
| `blackops.json` | tools/blackops-tabelle.js:136 | - | nein |
| `bridge-alarm.json` | sync/bridge.js:864 | - | ja |
| `bridge-heartbeat.json` | sync/bridge.js:2046 | sync/bridge.js:1606 | ja |
| `bridge.log` | sync/bridge.js:837<br>sync/bridge.js:841 | sync/bridge.js:836<br>tools/checkin.js:414<br>tools/lib/v1kurve.js:163<br>tools/rueckstand.js:153 | ja |
| `bridge.pid` | sync/bridge.js:2842 | - | ja |
| `checkin.json` | tools/checkin.js:993 | tools/checkin.js:147<br>tools/rangkurve-bauen.js:58<br>tools/rangkurve-bauen.js:59<br>tools/rangkurve-bauen.js:118 | ja |
| `ERLEDIGT.md` | - | tools/liste.js:235 | ja |
| `graftplan.json` | tools/graftplan-bauen.js:252 | - | nein |
| `GRAFTPLAN.md` | - | tools/graftnext.js:43<br>tools/graftplan-bauen.js:38<br>tools/graftplan-bauen.js:43 | ja |
| `hotswap-freigabe.txt` | sync/bridge.js:758<br>tools/hotswap.js:404 | sync/bridge.js:724<br>sync/bridge.js:735 | nein |
| `loop-wache.md` | - | tools/aufsicht.js:178 | nein |
| `manual-actions.json` | sync/bridge.js:815 | sync/bridge.js:798<br>tools/checkin.js:835<br>tools/checkin.js:836 | ja |
| `nicht-schieben.txt` | - | sync/bridge.js:460 | ja |
| `notnagel.json` | tools/aufsicht.js:164<br>tools/aufsicht.js:197 | tools/aufsicht.js:155 | ja |
| `ram-messung-2026-09-04.json` | tools/eichung-messen.js:210<br>tools/eichung-stempeln.js:114 | tools/eichung-messen.js:143<br>tools/eichung-stempeln.js:63<br>tools/ram.js:391<br>tools/ram.js:398 | ja |
| `rangkurve-bn{?}.json` | - | tools/lib/rangkurve.js:89 |  |
| `registry.json` | tools/registry-bauen.js:407 | tools/ram.js:424<br>tools/registry-bauen.js:395<br>tools/registry-bauen.js:399<br>tools/strategie-check.js:543 | nein |
| `rueckstand.json` | tools/rueckstand.js:132 | tools/rueckstand.js:58 | ja |
| `schub-frei.txt` | tools/hotswap.js:430 | sync/bridge.js:573 | nein |
| `schub-offen.json` | sync/bridge.js:766 | sync/bridge.js:780 | nein |
| `sofort-test.md` | sync/bridge.js:2137 | - | nein |
| `STATUS.json` | - | tools/fortschritt.js:50<br>tools/fortschritt.js:54 | ja |
| `tick-last.json` | tools/tick.js:262 | tools/tick.js:258 | ja |
| `tor-verlauf.json` | tools/tor.js:352 | tools/tor.js:167 | ja |
| `tor.json` | tools/tor.js:343 | - | ja |
| `v1kurve-BN{?}.json` | tools/lib/v1kurve.js:178 | tools/checkin.js:400 |  |
| `verlauf-strategie.json` | tools/strategie-check.js:129 | tools/aufsicht.js:151<br>tools/rangkurve-bauen.js:47<br>tools/rangkurve-bauen.js:48<br>tools/rangkurve-bauen.js:110 | ja |
| `wache-zustand.json` | tools/wache.js:338 | tools/aufsicht.js:229<br>tools/wache.js:317 | ja |
| `wache.pid` | tools/wache.js:1190 | tools/wache.js:1175 | ja |
| `watch-verlauf.json` | tools/bn4watch.js:61 | tools/bn4watch.js:49 | ja |
| `watchdog.json` | - | sync/bridge.js:2390 | nein |
| `zweittab-alarm.json` | - | sync/bridge.js:519 | nein |
| `zweittab-alarm.json.tmp` | sync/bridge.js:546<br>sync/bridge.js:551 | - | nein |

## Waisen im Spielstand (Datei liegt auf home, kein Schreiber und kein Leser in src/ oder tools/) (20)

`data/homeram.txt` (719 B), `data/travel.txt` (1205 B), `data/bn4life.txt` (81 B), `data/install-frei.txt` (15 B), `data/ramcheck.txt` (181 B), `data/coreprobe.txt` (80 B), `data/rammess.txt` (104 B), `data/rpdiag.txt` (701 B), `data/psdiag.txt` (360 B), `data/spieler.txt` (271 B), `data/wachestat.json` (1047 B), `data/ramtest.txt` (164 B), `data/skilltest.txt` (101 B), `data/sleeveinfo.txt` (557 B), `data/augtest.txt` (111 B), `data/unkick.txt` (44 B), `data/sfprobe.txt` (379 B), `data/ramprobe.txt` (142 B), `data/parkprobe.txt` (393 B), `data/hashes.txt` (113 B)

## Felder ohne Leser (JSON-Dateien)

Ein Feld gilt als "NUR im Schreiber", wenn sein Name in keiner anderen Datei als Eigenschaftszugriff oder Schluessel vorkommt (src/, sync/, tools/, dashboard). Das schliesst Zugriffe ueber berechnete Schluessel und Objekte aus, die als Ganzes ausgegeben werden (Anzeige fuer Menschen).

| Datei | Felder | NUR im Schreiber | Leser-Stellen |
|---|---|---|---|
| `data/astufe.json` | 2 | overclock | keine |
| `data/augcheck.json` | 7 | anzahlEingebaut, anzahlGekauft, gekauft, grundpreisSumme | keine |
| `data/augcount.json` | 6 | installiert, jeFaktion, stufeBListe | keine |
| `data/ausgang.json` | 27 | eta_quelle, hausAusbau, ueberBlackOps, ueberHacking | ausgang.js:185, ausgang.js:654, bn4net.js:5028, graftauto.js:165, ... |
| `data/bbgraft.json` | 9 | entropie, intelligenz, zugang | tools/graftnext.js:88[roh] |
| `data/bblage.json` | 19 | - | tools/checkin.js:157[ganz], tools/strategie-check.js:105[roh], tools/strategie-check.js:113[roh], tools/strategie-check.js:116[roh], ... |
| `data/bbspann.json` | 16 | aktionDauer, aktionZeit, operationen, staedte | tools/spann.js:44[roh] |
| `data/bbtick.json` | 10 | spielzeitBis, spielzeitVon, zeiten | keine |
| `data/bbtrain.json` | 2 | - | punish.js:247 |
| `data/blade.json` | 40 | blackOpRang, boEndspiel, boSchwelle, chaosMax, fahrbar, hp, rangHoch | ausgang.js:357[roh], blade.js:809, bn4net.js:4862, bn4rep.js:561[?][roh], ... |
| `data/bn4net.json` | 45 | batchModus, bnWerte, bnWerte.scriptHackMoney, bnWerte.serverGrowthRate, bnWerte.serverWeakenRate, expZiel, mischung, motorStunden, shareFaeden, stapel, werkbankReserve, zieleAnzahl | graftauto.js:161, guard.js:354[ganz], homegrow.js:108, lib/figurns.js:67[roh], ... |
| `data/bn4rep.json` | 36 | favorBeste, favorBesteFaktion, gangHold, gateBuy, teuerstesVerdiente, v1LeseFehler, v1Positiv, warteGrund | bn4net.js:1505[ganz], gang.js:1147[roh], gang.js:1238[roh], sleeve.js:404, ... |
| `data/boerse.json` | 20 | bar, beste, erloesBeimSchliessen, hat4S | punish.js:314 |
| `data/boprobe.json` | 10 | commsGesamt, reqRang, zeitMs | keine |
| `data/cdump-stand.json` | 7 | abgelehnt, ausgelassen | bn4net.js:5195, cdump.js:253 |
| `data/chance.json` | 13 | abweichungZuMin, api, competence, wahr | keine |
| `data/contracts.json` | 10 | ablehnungen, fehlgeschlagen, gegenprobeAbgelehnt, gesperrteTypen | bn4net.js:5195, contracts.js:272 |
| `data/csolve.json` | 17 | erfolge | keine |
| `data/einbau.json` | 14 | gangHold, gesperrtOhneHilfe, kampfknoten, mindest, spendenAusnahme | ausgang.js:792, punish.js:221 |
| `data/exploit3.json` | 4 | herkunft | keine |
| `data/export.json` | 10 | bridgeAlterMs, exportiertJetzt, saeumig | export.js:194[ganz] |
| `data/figure.txt` | 6 | - | bn4net.js:4507[ganz], figwatch.js:90[roh], lib/figurns.js:142[ganz] |
| `data/figwatch.json` | 20 | besitzer, einzelheit, figure_conflict, letzterKonflikt, tatsaechlich, vergeben | keine |
| `data/gang.json` | 41 | isHacking, lastCreate, lastCreateAt, recruits, taskCounts, territory, timeouts, updates, wanted, warfare | bn4rep.js:1820[roh], gang.js:1111[roh], tools/checkin.js:759[ganz], tools/checkin.js:868[?] |
| `data/geld.json` | 5 | gesamtJeMinute, jeMinute | keine |
| `data/graft.json` | 11 | dauerMin, gereist, simulacrum | graftauto.js:299[ganz], punish.js:326, tools/graftnext.js:56[roh] |
| `data/graftauto.json` | 22 | nichtOffen, prozentNichtOffen | punish.js:325, tools/hotswap.js:207 |
| `data/hashes.json` | 2 | - | bn4net.js:4944, hacknet.js:178 |
| `data/install-sperre.txt` | 4 | - | bn4rep.js:926[roh], bn4rep.js:1085[roh], bn4rep.js:2459[roh], tools/hotswap.js:217 |
| `data/popups-halt.txt` | 3 | wort | keine |
| `data/preis.json` | 2 | limit | keine |
| `data/ps.json` | 2 | - | tools/libverteilen.js:95, tools/neustart.js:155[roh], tools/strategie-check.js:497 |
| `data/punish.json` | 8 | bedingungen, verweigert | keine |
| `data/skillcheck.json` | 3 | rangfolge | keine |
| `data/sleevediag.json` | 10 | memory, sleeveErr, taskErr, vorrat, vorratErr | keine |
| `data/sonde.json` | 10 | bilderJeSekunde, haupt, worker, workerFehler | keine |
| `data/startdiag.json` | 4 | freiHomeGb, maxHomeGb | tools/eichung-messen.js:126[ganz], tools/libverteilen.js:91 |
| `data/stat.json` | 9 | intExp, warteschlange | keine |
| `data/telemetry.txt` | 37 | batching, batching.active, batching.expectedPerSec, batching.newBatches, network.backdoored | keine |
| `data/trupp.json` | 9 | blackOp, blackOpChance, raid, raidLevel | keine |
| `data/vorrat.json` | 4 | je | keine |
| `data/watchdog.json` | 33 | letzteAusfuehrung, letzterTraegerName, letzterTraegerNodeReset, signaleJetzt, stand_down_count | bn4net.js:4566[ganz], bn4net.js:5058, guard.js:91[roh], tools/checkin.js:705 |
| `data/werkbank.json` | 4 | hosts, werkzeuge | keine |

## Wirtepruefung (35 Treffer vor manueller Sichtung)

- X-home-ohne-Holen: blade.js:3979 data/simulacrum.txt
- W-lokal-ohne-Heimkopie: bn4life.js:512 data/task.txt
- X-home-ohne-Holen: bn4rep.js:950 data/rep-modus.txt
- W-lokal-ohne-Heimkopie: invest.js:62 data/invest.txt

## Argumentvertrag exec/run/spawn gegen ns.args

- bn4net.js:2682 -> worker/weaken.js: uebergeben 5, erwartet positionell max[3] => ZU VIEL (5 statt 4, Rest wird ignoriert)
- bn4net.js:2682 -> worker/grow.js: uebergeben 5, erwartet positionell max[3] => ZU VIEL (5 statt 4, Rest wird ignoriert)
- bn4net.js:2682 -> worker/hack.js: uebergeben 5, erwartet positionell max[3] => ZU VIEL (5 statt 4, Rest wird ignoriert)
- bn4net.js:2698 -> worker/weaken.js: uebergeben 5, erwartet positionell max[3] => ZU VIEL (5 statt 4, Rest wird ignoriert)
- bn4net.js:2698 -> worker/grow.js: uebergeben 5, erwartet positionell max[3] => ZU VIEL (5 statt 4, Rest wird ignoriert)
- bn4net.js:2698 -> worker/hack.js: uebergeben 5, erwartet positionell max[3] => ZU VIEL (5 statt 4, Rest wird ignoriert)
- bn4net.js:2904 -> worker/weaken.js: uebergeben 5, erwartet positionell max[3] => ZU VIEL (5 statt 4, Rest wird ignoriert)
- bn4net.js:2920 -> worker/grow.js: uebergeben 5, erwartet positionell max[3] => ZU VIEL (5 statt 4, Rest wird ignoriert)
- bn4start.js:116 -> worker/weaken.js: uebergeben 2, erwartet positionell max[3] => ZU WENIG (2 statt >= 4)
- bn4start.js:116 -> worker/grow.js: uebergeben 2, erwartet positionell max[3] => ZU WENIG (2 statt >= 4)
- bn4start.js:116 -> worker/hack.js: uebergeben 2, erwartet positionell max[3] => ZU WENIG (2 statt >= 4)
- xp.js:140 -> worker/weaken.js: uebergeben 3, erwartet positionell max[3] => ZU WENIG (3 statt >= 4)
