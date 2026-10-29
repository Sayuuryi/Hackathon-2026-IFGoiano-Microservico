import fs from "node:fs/promises";
import { createHash } from "node:crypto";
const source = await fs.readFile("dist/index.html");
await fs.writeFile(
  "dist/build.json",
  JSON.stringify({
    revision: "2026-10-28-r4",
    sourceHash: createHash("sha256").update(source).digest("hex"),
  }) + "\n",
);
