import { build } from "esbuild";
import { mkdir } from "node:fs/promises";

await mkdir("dist/api", { recursive: true });
await build({
  entryPoints: ["server/index.ts"],
  outfile: "dist/api/index.mjs",
  bundle: true,
  platform: "node",
  packages: "external",
  format: "esm",
  target: "node22",
  sourcemap: false,
});
