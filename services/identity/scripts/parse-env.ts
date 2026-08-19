const fs = require("node:fs");
const env = fs.readFileSync(process.argv[2], "utf8");
const line = env.split("\n").find((l) => l.startsWith("TREASURY_SIGNERS="));
if (!line) { console.log("not found"); process.exit(0); }
const val = line.replace("TREASURY_SIGNERS=", "").trim();
console.log("value length:", val.length);
const signers = val.split(",").map((s) => s.trim());
console.log("num signers:", signers.length);
signers.forEach((s, i) => {
  console.log(`signer ${i}: length=${s.length} valid=${/^[A-Z]{60}$/.test(s)} value=${s}`);
});
