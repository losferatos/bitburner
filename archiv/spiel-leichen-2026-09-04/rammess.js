export async function main(ns) {
  const z = [];
  for (const f of ["bn4net.js","bn4life.js","boot.js","homegrow.js","bn4rep.js"]) {
    z.push(f + " = " + ns.getScriptRam(f, "home").toFixed(2) + " GB");
  }
  ns.write("data/rammess.txt", z.join("\n"), "w");
}
