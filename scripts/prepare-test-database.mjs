import "dotenv/config";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import pg from "pg";

const productionUrl = process.env.DATABASE_URL;
if (!productionUrl) throw new Error("DATABASE_URL is required");

const testUrl = new URL(productionUrl);
const productionDatabase = testUrl.pathname.slice(1);
if (!productionDatabase || productionDatabase.endsWith("_test")) {
  throw new Error("DATABASE_URL must point to the production database before deriving the test database");
}

const testDatabase = `${productionDatabase}_test`;
testUrl.pathname = `/${testDatabase}`;
const adminUrl = new URL(productionUrl);
adminUrl.pathname = "/postgres";

const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();
const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [testDatabase]);
if (existing.rowCount === 0) {
  const quotedName = `"${testDatabase.replaceAll('"', '""')}"`;
  await admin.query(`CREATE DATABASE ${quotedName}`);
}
await admin.end();

const environment = {
  ...process.env,
  DATABASE_URL: testUrl.toString(),
  NODE_ENV: "test",
};

const prismaCli = join(process.cwd(), "node_modules", "prisma", "build", "index.js");
execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], { env: environment, stdio: "inherit" });
execFileSync(process.execPath, [prismaCli, "db", "seed"], { env: environment, stdio: "inherit" });

console.log(`Test database ready: ${testDatabase}`);
