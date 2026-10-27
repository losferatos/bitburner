// SF-Stufe von SF13 per Umgebungsvariable (Standard 0); eich.mjs setzt sie vor dem Import.
export const Player = {
  sf13: 0,
  mults: { faction_rep: 1 },
  entropy: 0,
  sleeves: [],
  activeSourceFileLvl(n) { return n === 13 ? Player.sf13 : 0; },
  hasAugmentation() { return true; },
  applyEntropy() {},
  updateSkillLevels() {},
};
