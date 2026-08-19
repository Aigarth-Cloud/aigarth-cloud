// Quick sanity check
const prefix = "COMP" + "000";
const tail = "A".repeat(60 - prefix.length);
const addr = (prefix + tail).slice(0, 60);
console.log("prefix len:", prefix.length);
console.log("tail len:", tail.length);
console.log("addr len:", addr.length);
console.log("addr:", addr);
