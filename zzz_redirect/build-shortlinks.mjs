import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const linksSource = fs.readFileSync(path.join(root, "links.js"), "utf8");
const template = fs.readFileSync(path.join(here, "template.html"), "utf8");
const context = { window: {} };
vm.runInNewContext(linksSource, context, { filename: "links.js" });

const paths = new Set();
for (const entry of Object.values(context.window.KAZVT_LINKS || {})) {
  for (const field of ["shortPath", "liveShortPath"]) {
    const clean = String(entry?.[field] || "").trim().replace(/^\/+|\/+$/g, "").toLowerCase();
    if (!clean) continue;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(clean)) {
      throw new Error(`Invalid ${field}: ${clean}`);
    }
    paths.add(clean);
  }
}

for (const shortPath of paths) {
  const dir = path.join(root, shortPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), template);
}

console.log(`generated ${paths.size} clean shortlink folder(s)`);
