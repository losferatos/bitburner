// Attrappe des Spielers. totalPlaytime saet den Zufall der Gegner-KI
// (goAI.ts getMove: new WHRNG(Player.totalPlaytime)); play.mjs setzt sie je Zug.
export const Player = {
  get totalPlaytime() { return 1 + Math.floor(Math.random() * 1e12); },
  bitNodeN: 14, entropy: 0, factions: [],
  hasAugmentation: () => false, activeSourceFileLvl: () => 0,
  applyEntropy() {}, giveAchievement() {},
};
