# In Bitburner 3.0.0 entfernte NS-Funktionen

Aufgetreten als echter Laufzeitfehler am 19.08.2026: `ns.getPurchasedServers()` warf
einen `REMOVED FUNCTION ERROR`. Diese Liste stammt direkt aus dem Quellcode
(`src/NetscriptFunctions.ts:1531`, `setRemovedFunctions(ns, {...})`) und gilt fuer v3.0.1.

**Wichtig:** Diese Funktionen sind nicht veraltet, sondern **weg**. Ein Aufruf bricht das
Skript mit einem Fehlerdialog ab. Aeltere Anleitungen, Wikis und Skriptsammlungen aus dem
Netz stammen fast alle aus der 2.x-Zeit und benutzen die alten Namen.

## Server kaufen: alles nach `ns.cloud` umgezogen

| alt (weg) | neu |
|---|---|
| `ns.purchaseServer(host, ram)` | `ns.cloud.purchaseServer(host, ram)` |
| `ns.getPurchasedServers()` | `ns.cloud.getServerNames()` |
| `ns.getPurchasedServerCost(ram)` | `ns.cloud.getServerCost(ram)` |
| `ns.getPurchasedServerLimit()` | `ns.cloud.getServerLimit()` |
| `ns.getPurchasedServerMaxRam()` | `ns.cloud.getRamLimit()` |
| `ns.getPurchasedServerUpgradeCost(h, ram)` | `ns.cloud.getServerUpgradeCost(h, ram)` |
| `ns.upgradePurchasedServer(h, ram)` | `ns.cloud.upgradeServer(h, ram)` |
| `ns.renamePurchasedServer(h, neu)` | `ns.cloud.renameServer(h, neu)` |
| `ns.deleteServer(h)` | `ns.cloud.deleteServer(h)` |

## Skriptfenster: alles nach `ns.ui`

| alt (weg) | neu |
|---|---|
| `ns.tail()` | `ns.ui.openTail()` |
| `ns.moveTail(x, y)` | `ns.ui.moveTail(x, y)` |
| `ns.resizeTail(b, h)` | `ns.ui.resizeTail(b, h)` |
| `ns.closeTail(pid)` | `ns.ui.closeTail(pid)` |
| `ns.setTitle(t)` | `ns.ui.setTailTitle(t)` |

## Formatierung: alles nach `ns.format`

| alt (weg) | neu |
|---|---|
| `ns.nFormat(n, f)` | `ns.format.number()`, `ns.format.ram()`, `ns.format.percent()` |
| `ns.formatNumber(n)` | `ns.format.number(n)` |
| `ns.formatRam(n)` | `ns.format.ram(n)` |
| `ns.formatPercent(n)` | `ns.format.percent(n)` |
| `ns.tFormat(ms)` | `ns.format.time(ms)` |

## Sonstiges

| alt (weg) | neu |
|---|---|
| `ns.getServerRam(h)` (seit 2.2.0) | `ns.getServerMaxRam(h)` + `ns.getServerUsedRam(h)` |
| `ns.getTimeSinceLastAug()` | `Date.now() - ns.getResetInfo().lastAugReset` |

Weitere Streichungen gibt es in den Unter-APIs `corporation`, `gang`, `singularity` und
`formulas.work` - jeweils per `setRemovedFunctions` in der zugehoerigen Datei unter
`src/NetscriptFunctions/`. Bei Bedarf dort nachsehen, das Muster ist immer dasselbe.

## Praktische Lehre

`ns.ui.closeTail(pid)` wirkt **nicht** auf bereits beendete Skripte. Das Fenster eines
gestorbenen Skripts bleibt stehen und muss von Hand weggeklickt werden. Also: Neustarts
sparsam einsetzen, statt sie als selbstverstaendlich zu behandeln.
