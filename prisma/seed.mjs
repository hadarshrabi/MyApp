import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import prismaClient from "@prisma/client";

const { PrismaClient } = prismaClient;

const databaseUrl = process.env.DATABASE_URL;
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
const employeePassword = process.env.SEED_EMPLOYEE_PASSWORD;
const seedStationLatitude = Number(process.env.SEED_STATION_LATITUDE);
const seedStationLongitude = Number(process.env.SEED_STATION_LONGITUDE);
if (!databaseUrl || !adminPassword || !employeePassword || !Number.isFinite(seedStationLatitude) || !Number.isFinite(seedStationLongitude)) {
  throw new Error("DATABASE_URL, seed passwords and SEED_STATION_LATITUDE/SEED_STATION_LONGITUDE are required for seeding");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const [adminHash, employeeHash] = await Promise.all([bcrypt.hash(adminPassword, 12), bcrypt.hash(employeePassword, 12)]);

await prisma.user.upsert({
  where: { email: "owner@linoy-designs.example" },
  update: { passwordHash: adminHash, displayName: "לינוי רז", systemRole: "ADMIN", active: true },
  create: { id: "user-admin", email: "owner@linoy-designs.example", displayName: "לינוי רז", systemRole: "ADMIN", passwordHash: adminHash },
});
const employeeUser = await prisma.user.upsert({
  where: { email: "maya@linoy-designs.example" },
  update: { passwordHash: employeeHash, displayName: "מיה אדרי", systemRole: "EMPLOYEE", active: true },
  create: { id: "user-employee-1", email: "maya@linoy-designs.example", displayName: "מיה אדרי", systemRole: "EMPLOYEE", passwordHash: employeeHash },
});

const seedStation = {
  id: 1,
  name: process.env.SEED_STATION_NAME ?? "עמדת פיתוח",
  address: process.env.SEED_STATION_ADDRESS ?? "",
  locationDescription: process.env.SEED_STATION_DESCRIPTION ?? "עמדה לצורכי פיתוח מקומי",
  latitude: seedStationLatitude,
  longitude: seedStationLongitude,
  active: true,
};
await prisma.station.upsert({ where: { id: seedStation.id }, update: seedStation, create: seedStation });
await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Station"', 'id'), COALESCE((SELECT MAX("id") FROM "Station"), 1), (SELECT COUNT(*) > 0 FROM "Station"))`);

await prisma.employee.upsert({
  where: { userId: employeeUser.id },
  update: { jobPosition: "מוכרת", hourlyRateCents: 4200, assignedStationId: 1 },
  create: { id: "emp-1", userId: employeeUser.id, jobPosition: "מוכרת", hourlyRateCents: 4200, assignedStationId: 1 },
});

const products = [
  { id: "product-white-roses", name: "זר ורדים לבנים", currentPriceCents: 18900, quantity: 20 },
  { id: "product-pink", name: "זר ורוד", currentPriceCents: 14900, quantity: 15 },
  { id: "product-small", name: "זר קטן", currentPriceCents: 8900, quantity: 10 },
];
for (const product of products) {
  await prisma.product.upsert({ where: { id: product.id }, update: { name: product.name, currentPriceCents: product.currentPriceCents }, create: { id: product.id, name: product.name, currentPriceCents: product.currentPriceCents } });
  await prisma.stationInventory.upsert({ where: { stationId_productId: { stationId: 1, productId: product.id } }, update: {}, create: { stationId: 1, productId: product.id, quantity: product.quantity } });
}

await prisma.$disconnect();
