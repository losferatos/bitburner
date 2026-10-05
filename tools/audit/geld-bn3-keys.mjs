// Hilfsskript (Audit geldwert BN3, 05.10.2026): Struktur eines Spielstands anzeigen. Nur lesen.
import {loadSave} from "./player-save.mjs";
const {save,player:p}=loadSave(process.argv[2]);
console.log(Object.keys(save.data));
console.log(Object.keys(p).join(" "));
const bb=p.bladeburner; console.log(bb? Object.keys(bb.data||bb).join(" "):"no bb in player");
