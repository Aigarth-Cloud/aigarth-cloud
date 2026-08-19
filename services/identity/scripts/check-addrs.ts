// Check exact length of env signers
const v = "BB" + "A".repeat(58);
console.log("test signer length:", v.length, "matches:", /^[A-Z]{60}$/.test(v));
