# Archivkandidaten — Stand 2026-09-04 15:27

Erzeugt aus `node tools/test-verbote.js --liste` (Positivliste = Handliste + registry.json).
Spalten: Datei | Zeilen | liegt im Spiel | Aufrufstellen in src/tools/sync (exec/run/import)

```
audiocheck.js	35	JA	KEIN-AUFRUF
augcheck.js	53	JA	KEIN-AUFRUF
augcount.js	103	JA	KEIN-AUFRUF
autopilot.js	1956	JA	src/invest.js:92:      if (ns.exec("autopilot.js", "home")) merken("Autopilot neu gestartet"); src/restart.js:55:  const pid = ns.exec("autopilot.js", "home", 1); 
backdoor.js	102	JA	KEIN-AUFRUF
bbtick.js	73	JA	KEIN-AUFRUF
blackops.js	35	JA	KEIN-AUFRUF
bn4start.js	121	JA	KEIN-AUFRUF
boprobe.js	24	JA	KEIN-AUFRUF
brcheck.js	30	JA	KEIN-AUFRUF
buyaugs.js	1931	JA	KEIN-AUFRUF
buyone.js	111	JA	KEIN-AUFRUF
calccheck.js	133	JA	KEIN-AUFRUF
cheap.js	80	JA	KEIN-AUFRUF
daedalus.js	65	JA	KEIN-AUFRUF
donate.js	142	JA	KEIN-AUFRUF
echoargs.js	7	JA	KEIN-AUFRUF
exploit.js	38	JA	KEIN-AUFRUF
exploit2.js	118	JA	KEIN-AUFRUF
exploit3.js	124	JA	KEIN-AUFRUF
exportbonus.js	67	JA	KEIN-AUFRUF
favorweg.js	77	JA	KEIN-AUFRUF
formcheck.js	138	JA	KEIN-AUFRUF
graftplan.json	51	nein	KEIN-AUFRUF
hand.js	229	JA	src/autopilot.js:836:          if (ns.exec("hand.js", platz.host)) { 
homeram.js	1178	JA	KEIN-AUFRUF
install.js	118	JA	KEIN-AUFRUF
invest.js	216	JA	src/autopilot.js:761:        if (ns.exec("invest.js", wirt.host)) { 
joinfac.js	61	JA	KEIN-AUFRUF
joinplan.js	47	JA	KEIN-AUFRUF
kanaltest.js	15	JA	KEIN-AUFRUF
kaufplan.js	91	JA	KEIN-AUFRUF
keepalive.js	290	JA	KEIN-AUFRUF
kerne.js	49	JA	KEIN-AUFRUF
kill.js	60	JA	KEIN-AUFRUF
killrep.js	24	JA	KEIN-AUFRUF
killui.js	55	JA	KEIN-AUFRUF
lib/bitnodes.json	381	nein	KEIN-AUFRUF
lib/blackops.json	92	JA	KEIN-AUFRUF
netburner.js	91	JA	KEIN-AUFRUF
netz.js	21	JA	KEIN-AUFRUF
path.js	50	JA	KEIN-AUFRUF
preis.js	12	JA	KEIN-AUFRUF
probe.js	219	JA	tools/registry-bauen.js:19:import { schreiberprobe, SCHREIBER } from "./lib/schreiberprobe.js"; tools/test-sleeve-ebene2.js:37:import { ohneKommentare } from "./lib/schreiberprobe.js";
probe2.js	53	JA	KEIN-AUFRUF
probe3.js	87	JA	KEIN-AUFRUF
punish.js	408	nein	src/bn4net.js:4136:            ? ns.exec("punish.js", wirt, 1, "scharf") src/bn4net.js:4137:            : ns.exec("punish.js", wirt, 1); 
ramcheck.js	11	JA	KEIN-AUFRUF
reboot.js	36	JA	KEIN-AUFRUF
restart.js	58	JA	KEIN-AUFRUF
scan.js	63	JA	KEIN-AUFRUF
sleevediag.js	14	JA	KEIN-AUFRUF
srtest.js	13	JA	KEIN-AUFRUF
stat.js	30	JA	KEIN-AUFRUF
stockaccess.js	130	JA	KEIN-AUFRUF
stocks.js	208	JA	KEIN-AUFRUF
stopnight.js	44	JA	KEIN-AUFRUF
stopwork.js	55	JA	KEIN-AUFRUF
stufentest.js	31	JA	KEIN-AUFRUF
telemetry.js	100	JA	KEIN-AUFRUF
timerzwang.js	31	JA	KEIN-AUFRUF
torprobe.js	71	JA	KEIN-AUFRUF
travel.js	1672	JA	KEIN-AUFRUF
trupp.js	37	JA	KEIN-AUFRUF
vorrat.js	23	JA	KEIN-AUFRUF
wbgrow.js	116	JA	KEIN-AUFRUF
xp.js	141	JA	KEIN-AUFRUF
```
