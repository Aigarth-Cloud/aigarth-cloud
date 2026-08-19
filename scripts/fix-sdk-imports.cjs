const fs = require("node:fs");
const path = require("node:path");
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (ent.name.endsWith(".ts")) {
      let c = fs.readFileSync(full, "utf8");
      let changed = false;
      c = c.replace(/from\s+(['\"])(\.\.?\/[^'"]+?)\1/g, (m, q, p) => {
        // Don't add .js if already has an extension
        if (/\.(js|ts)$/.test(p)) return m;
        changed = true;
        return `from ${q}${p}.js${q}`;
      });
      if (changed) {
        fs.writeFileSync(full, c);
        console.log("updated", full);
      }
    }
  }
}
const target = process.argv[2] ?? "packages/sdk/src";
walk(target);
