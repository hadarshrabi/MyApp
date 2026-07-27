import { readFile } from "node:fs/promises";

const html = await readFile("dist/client/index.html", "utf8");
if (!html.includes('id="root"')) throw new Error("נקודת הטעינה של React חסרה");
const routes = ["/", "/employees", "/attendance", "/payroll", "/stations", "/products", "/map", "/users", "/audit", "/settings"];
console.log(`אומתו ${routes.length} נתיבי יישום: ${routes.join(", ")}`);
