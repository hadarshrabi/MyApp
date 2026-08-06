import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes, randomUUID } from "node:crypto";

export type AuthUser = { userId: string; role: "ADMIN" | "EMPLOYEE"; employeeId: string | null; stationId: number | null };

const issuer = process.env.JWT_ISSUER ?? "linoy-designs-api";
const audience = process.env.JWT_AUDIENCE ?? "linoy-designs-app";
const accessTtlSeconds = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900);
const refreshTtlDays = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30);

function secret() {
  const value = process.env.JWT_ACCESS_SECRET;
  if (!value || value.length < 32) throw new Error("JWT_ACCESS_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(value);
}

export async function hashPassword(password: string) { return bcrypt.hash(password, 12); }
export async function verifyPassword(password: string, hash: string) { return bcrypt.compare(password, hash); }
export function hashRefreshToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function newRefreshToken() { return randomBytes(48).toString("base64url"); }
export function refreshExpiry() { return new Date(Date.now() + refreshTtlDays * 86400000); }
export function newTokenFamily() { return randomUUID(); }

export async function createAccessToken(user: AuthUser) {
  return new SignJWT({ role: user.role, employeeId: user.employeeId, stationId: user.stationId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" }).setSubject(user.userId).setIssuer(issuer).setAudience(audience)
    .setIssuedAt().setExpirationTime(`${accessTtlSeconds}s`).setJti(randomUUID()).sign(secret());
}

export async function verifyAccessToken(token: string): Promise<AuthUser> {
  const { payload } = await jwtVerify(token, secret(), { issuer, audience, algorithms: ["HS256"] });
  if (!payload.sub || !["ADMIN", "EMPLOYEE"].includes(String(payload.role))) throw new Error("Invalid token claims");
  return { userId: payload.sub, role: payload.role as AuthUser["role"], employeeId: typeof payload.employeeId === "string" ? payload.employeeId : null, stationId: typeof payload.stationId === "number" ? payload.stationId : null };
}

export const refreshCookie = {
  name: "__Host-linoy_refresh",
  options: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge: refreshTtlDays * 86400000 },
};
