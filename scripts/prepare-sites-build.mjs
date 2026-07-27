import { mkdir, copyFile, cp } from "node:fs/promises";

await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
await copyFile("server/worker.mjs", "dist/server/index.js");
await copyFile("server/api-core.mjs", "dist/server/api-core.mjs");
await copyFile("server/d1-repository.mjs", "dist/server/d1-repository.mjs");
await cp("drizzle", "dist/.openai/drizzle", { recursive: true });
