// Attrappe des Spielers. totalPlaytime saet den Zufall der Gegner-KI
// (goAI.ts getMove: new WHRNG(Player.totalPlaytime)); play.mjs setzt sie je Zug.
//
// Cheat-API (27.10.2026): GO_SF14 setzt die Stufe von Source-File 14 (Standard 0,
// Verhalten wie bisher), GO_CRIME den Multiplikator crime_success (Standard 1).
// netscriptGoImplementation.ts cheatSuccessChance liest beides ueber diese Attrappe.
const SF14 = Number(process.env.GO_SF14) || 0;
export const Player = {
  get totalPlaytime() { return 1 + Math.floor(Math.random() * 1e12); },
  bitNodeN: 14, entropy: 0, factions: [],
  sf14: SF14,
  mults: { crime_success: Number(process.env.GO_CRIME) || 1 },
  hasAugmentation: () => false,
  activeSourceFileLvl: (n) => (n === 14 ? Player.sf14 : 0),
  applyEntropy() {}, giveAchievement() {},
};
