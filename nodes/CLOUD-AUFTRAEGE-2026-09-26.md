# Cloud-Auftraege 26.09.2026 (zum Einfuegen in claude.ai/code)

Je Auftrag eine neue Cloud-Sitzung auf dem Repo `losferatos/bitburner`
starten und den Block unter der Ueberschrift einfuegen. Modell: Opus fuer A und
B (Urteil), Sonnet fuer C (Bau). Alle drei schreiben nur auf eigene Branches.

---

## Auftrag A - Skeptiker Paket A (bn4rep)

You are a skeptic reviewing changes to the progression brain (src/bn4rep.js) of an autonomous Bitburner bot BEFORE they go live and run unattended. Find what is wrong; agreement is worthless.

Setup:
1. `git fetch origin`. Changes: branch `worktree-agent-a835831a3142b1944` (3 commits on master); diff `git diff origin/master...origin/worktree-agent-a835831a3142b1944`. Inputs: `git checkout origin/cloud-audit-input -- audit-input` (don't commit them), read audit-input/README.md.
2. Game source v3.0.2: `git clone --depth 1 --branch v3.0.2 https://github.com/bitburner-official/bitburner-src reference/bitburner-src` (fallback: default branch, check package.json version).
3. Background: nodes/audit-2026-09-26/3-progression.md (primary, measured incidents), 1-bitnode-regeln.md, 6-orchestrierung.md, nodes/AUDIT-PERFEKT-2026-09-26.md (package A, section PAUSE). Real saves in audit-input/backups (gzip JSON; save.data.PlayerSave is a JSON string whose .data is the player; AllServersSave similarly, with in-game logs bn4rep-log.txt, einbau.json, rep-ziel.txt as files on home). Models in audit-input/modelle (fix absolute Windows paths).
4. Tests: `node tools/test-alles.js --schnell`, tools/test-bn4rep-einbau.js.

Commits: A2+A3 live FactionWorkRepGain and DaedalusAugsRequirement via ns.getBitNodeMultipliers(), count installed augs only. A1 each round: if faction work runs, not focused, no NMI -> ns.singularity.setFocus(true). A4-A7: donation right due + empty queue buys one NFG; Red Pill bought-not-installed forces install; "next piece unaffordable" judged against balance + 10-min income horizon, only valuable pieces, suspended 2 rounds after own donation; favorLohnt only for factions below donation threshold with a valuable unowned piece.

Attack hardest:
1. A1: setFocus switches the UI to the work screen. Which scripts drive the DOM (grep src for document., click, dispatchEvent, keyboard, navigate: popups.js, punish.js, darkweb.js, figwatch.js, export.js, killui.js, backdoor.js, travel.js, shop.js, bn4door.js ...)? Does setFocus every ~15 s break or race them? Only for bn4rep's own faction work? Singularity.ts setFocus semantics.
2. A6: always right? ausgang.js / einbauErlaubt still block installs when the exit is open? Could it install Red Pill while valuable affordable pieces would have joined? Install loop with A4?
3. A5: could the trigger NEVER fire when money truly is the bottleneck (early node, low income) -> stall? Replay BN5.2 16:57 and BN1.3 00:23 AND an early-cycle case (19:03/19:04 saves) with real numbers.
4. A3: NeuroFlux counted once like FactionJoinCondition.ts? Remaining hardcoded 30 / alleAugs for Daedalus?
5. A4: one NFG when donation right due always worth it (1.9^q)? Money reservations for Red Pill respected?
6. Tests tautological or real code paths? What is untested?
7. Companion defect not in branch: bn4rep.js ~1396 `return` in main on handshake failure ends the process - confirm, give exact patch.

Output: German report, numbered objections BLOCKER / SHOULD-FIX / MINOR with evidence (file:line, numbers) and a concrete fix each, then "gehalten". Save as nodes/audit-2026-09-26/skeptiker-A.md on NEW branch `cloud-skeptiker-a` from origin/worktree-agent-a835831a3142b1944, commit (message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), push that branch. Never push to master, never force-push.

---

## Auftrag B - Skeptiker Paket B (bn4net)

You are a skeptic reviewing changes to the hacking engine (src/bn4net.js) of an autonomous Bitburner bot BEFORE they go live and run unattended. Find what is wrong; agreement is worthless.

Setup:
1. `git fetch origin`. Changes: branch `worktree-agent-a693114a22f784410` (4 commits on master); diff `git diff origin/master...origin/worktree-agent-a693114a22f784410`. Inputs: `git checkout origin/cloud-audit-input -- audit-input` (don't commit them), read audit-input/README.md.
2. Game source v3.0.2: `git clone --depth 1 --branch v3.0.2 https://github.com/bitburner-official/bitburner-src reference/bitburner-src`.
3. Background: nodes/audit-2026-09-26/2-hacking-engine.md (primary), 6-orchestrierung.md, nodes/AUDIT-PERFEKT-2026-09-26.md (package B, section PAUSE). Real saves audit-input/backups (incl. running scripts, server states). Calibrated models audit-input/modelle (batchmodel.mjs, expmodel.mjs, decode.mjs).
4. Tests: `node tools/test-alles.js --schnell`, tools/test-b1-*.js, test-b2-*.js, test-b3-*.js, test-b6-*.js, test-motor-ebene2.js.

Commits: B1 kennzahlen computes p/chance/k at minDifficulty so security-100 servers (BN5 doubles starting security) become visible targets. B2 leftover RAM runs worker/expfarm.js (for(;;) ns.grow) continuously; bn4net KILLS ALL expfarm workers at the top of every ~10 s round and relaunches them at the end. B3 darkweb.js only started when bn4life is not alive. B6 bitnodes table generator fixed for BN12 inc/dec and negatives; src/lib/bitnodes.json regenerated.

Attack hardest (compute with real numbers, never estimate):
1. B2: grow yields exp only on COMPLETION. Compute grow time on the exp target with the game formula (Hacking.ts, BN5 multipliers, real player stats, server security) for the fresh-after-install save (19:03 pre-install -> 19:04 hourly), mid-cycle (18:04), and level 1-100 right after a jump. If grow time > round length the oven yields ZERO exp - quantify vs. the old one-shot wave. Does grow raise security below moneyMax; does maintenance keep the target full? Exp awarded per thread at completion (NetscriptFunctions grow)? Propose the right design.
2. B1: is prep cost (weaken 100 -> min, ~517 s at level 2871, longer after install) charged in ranking? Could the engine switch to an unprepped 100-security server after every install and create a null-income window worse than today, or thrash? Hysteresis/prep-awareness, other callers of kennzahlen.
3. B3: after install/jump, is bn4life alive quickly? Focus consequence bounded?
4. B6: does any runtime reader of src/lib/bitnodes.json change behaviour for node 5 or 12? Schema backwards compatible (grep)?
5. Tests real or tautological? Kill/relaunch timing vs grow time exercised?

Output: German report, BLOCKER / SHOULD-FIX / MINOR with evidence and fix, then "gehalten". Save as nodes/audit-2026-09-26/skeptiker-B.md on NEW branch `cloud-skeptiker-b` from origin/worktree-agent-a693114a22f784410, commit (ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), push that branch. Never master, never force.

---

## Auftrag C - Paket C fertigstellen

You finish a package of fixes for an autonomous Bitburner bot.

Setup: `git fetch origin`; check out branch `worktree-agent-a39c89a13692a6bc8` (commits C1-C5 plus an interrupted WIP commit 963b6a7 "WIP C2-Nacharbeit ... UNGEPRUEFT" - review it first, keep what is right). Game source v3.0.2: `git clone --depth 1 --branch v3.0.2 https://github.com/bitburner-official/bitburner-src reference/bitburner-src` (some tests need it). Background: nodes/AUDIT-PERFEKT-2026-09-26.md (package C, section PAUSE). Conventions: new identifiers English; comments German WITHOUT umlauts explaining WHY. src/registry.json is generated from nodes/BAU-2026-09/ARCHITEKTUR.md section 3.3 via `node tools/registry-bauen.js`; RAM must match tools/ram.js.

Rework (new commits on top; never rewrite history, never force-push, never touch master; do NOT edit src/bn4rep.js or src/bn4net.js):
1. C2 BLOCKER: joinrun requested the figure with PRIO.gym=40; bn4rep's faktion=30 always preempts it (lib/figur.js: lower wins). Add `PRIO.beitritt = 25`, joinrun uses it. Ebene-2 test with a concurrent priority-30 request: joinrun must get and keep the figure; RED with 40, GREEN with 25.
2. C2 RAM: bn4life.js back to master RAM (no getBitNodeMultipliers / getOwnedAugmentations there). Daedalus gate INTO joinrun.js: at start exit (and set the marker bn4life honours) when installed augs >= DaedalusAugsRequirement. Count via `ns.getResetInfo().ownedAugs.size` if equivalent to FactionJoinCondition.ts:116-130 (verify, state it). Requirement via `ns.getBitNodeMultipliers().DaedalusAugsRequirement` (needs SF5 or BN5, not Formulas.exe). Tests 29/30/31, BN12=31, call throws (fail open). If the gate also blocks netburn.js or the Tetrads join, keep those independent.
3. C5: revert commit for guard.js cold-start threshold (core and guard must share one definition later).
4. C3 extra: outside BN9 with 0 hacknet capacity, hacknet.js and hashes.js exit cleanly (marker `data/keine-hacknet.txt`, see bn4net.js ~3440/3548), only after the SF9.3 free server is gone (exists after a jump, vanishes at first install); no restart loops or guard S1 alarms; test.
5. tools/test-ram.js: changed files into VERALTET_ERLAUBT (~line 161) with 2026-09-26 and "live-Nachmessung nach Einspielen".
6. tools/test-verbote.js lint: also catch `const { gymWorkout } = ns.singularity` and `ns["singularity"]`.

Commit messages German with WHY, ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; push the branch. Finish with a summary: commits, per item change + red/green evidence, RAM changes, full `node tools/test-alles.js --schnell` result, open points.
