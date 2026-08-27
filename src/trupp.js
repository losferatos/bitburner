/**
 * Messung: traegt die Trupp-Regel, und wieviel ist der Bonus wirklich wert?
 *
 * `operationTeamSuccessBonus = (teamCount + 1)^0,05`
 * (`Actions/Operation.ts:96-98`) gilt fuer Operationen UND Black Ops. Die
 * Zahl steht nirgends in der Telemetrie - deshalb wird sie hier zusammen mit
 * der aktuellen Truppgroesse und den Verlusten geholt.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const b = ns.bladeburner;
  const o = {};
  try { o.trupp = b.getTeamSize(); } catch (e) { o.trupp = "FEHLER " + String(e); }
  try {
    o.bonus = Math.pow((typeof o.trupp === "number" ? o.trupp : 0) + 1, 0.05);
  } catch { /* egal */ }
  try {
    const bo = b.getBlackOpNames().find((n) => b.getActionCountRemaining("Black Operations", n) > 0);
    o.blackOp = bo ?? null;
    if (bo) {
      const c = b.getActionEstimatedSuccessChance("Black Operations", bo);
      o.blackOpChance = [Number(c[0].toFixed(4)), Number(c[1].toFixed(4))];
    }
  } catch (e) { o.blackOp = "FEHLER " + String(e); }
  try {
    const c = b.getActionEstimatedSuccessChance("Operations", "Raid");
    o.raid = [Number(c[0].toFixed(4)), Number(c[1].toFixed(4))];
    o.raidLevel = b.getActionCurrentLevel("Operations", "Raid");
  } catch (e) { o.raid = "FEHLER " + String(e); }
  try {
    o.stadt = b.getCity();
    o.comms = b.getCityCommunities(o.stadt);
    o.chaos = Number(b.getCityChaos(o.stadt).toFixed(2));
  } catch { /* egal */ }
  ns.write("data/trupp.json", JSON.stringify(o), "w");
}
