import type { NextFunction, Request, Response } from "express";
import { errors as joseErrors } from "jose";
import { verifyAccessToken, type AuthUser } from "../auth";
import type { PostgresRepository } from "../postgres-repository";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  try {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return response.status(401).json({ error: "נדרשת התחברות למערכת" });
    request.auth = await verifyAccessToken(header.slice(7));
    next();
  } catch (error) {
    const expired = error instanceof joseErrors.JWTExpired;
    response.status(401).json({ error: expired ? "פג תוקף ההתחברות" : "אסימון ההתחברות אינו תקין" });
  }
}

export function requireActiveUser(repository: PostgresRepository) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const currentUser = await repository.findUserById(request.auth!.userId);
      if (!currentUser) return response.status(401).json({ error: "המשתמש אינו פעיל" });
      request.auth = {
        userId: currentUser.id,
        role: currentUser.systemRole,
        employeeId: currentUser.employee?.id ?? null,
        stationId: currentUser.employee?.assignedStationId ?? null,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAdmin(request: Request, response: Response, next: NextFunction) {
  if (request.auth?.role !== "ADMIN") return response.status(403).json({ error: "אין הרשאת מנהל לביצוע פעולה זו" });
  next();
}
