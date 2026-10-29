import { build } from "esbuild";
import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  copyFile,
} from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
await mkdir("public/assets", { recursive: true });
await mkdir("public/vendor/litert", { recursive: true });
for (const name of ["local-ai", "pet-worker"])
  await build({
    entryPoints: [`browser/${name}.js`],
    outfile: `public/assets/${name}.js`,
    bundle: true,
    format: name === "pet-worker" ? "iife" : "esm",
    platform: "browser",
    target: "es2022",
    minify: true,
    legalComments: "linked",
  });
const directory = path.join(root, "node_modules/@litert-lm/core/wasm"),
  parts = {};
for (const name of await readdir(directory)) {
  if (!/\.(js|wasm)$/.test(name)) continue;
  if (name.endsWith(".js"))
    await copyFile(
      path.join(directory, name),
      path.join(root, "public/vendor/litert", name),
    );
  else {
    const bytes = await readFile(path.join(directory, name)),
      names = [];
    for (
      let offset = 0, index = 0;
      offset < bytes.length;
      offset += 8 * 1024 * 1024, index++
    ) {
      const segment = name + ".part" + index;
      await writeFile(
        path.join(root, "public/vendor/litert", segment),
        bytes.subarray(offset, offset + 8 * 1024 * 1024),
      );
      names.push("/vendor/litert/" + segment);
    }
    parts["/vendor/litert/" + name] = names;
  }
}
await writeFile("public/wasm-parts.json", JSON.stringify(parts));
const assets = [
  "/assets/local-ai.js",
  "/assets/pet-worker.js",
  "/wasm-parts.json",
  "/runtime-assets.json",
  "/manifest.webmanifest",
  "/icons/ninho-192.png",
  "/icons/ninho-512.png",
];
for (const name of await readdir("public/vendor/litert"))
  assets.push("/vendor/litert/" + name);
await writeFile("public/runtime-assets.json", JSON.stringify(assets));
console.log(
  "Runtime local preparado; arquivos grandes divididos para hospedagem.",
);
