import { randomBytes } from "node:crypto";
import type { Response } from "express";

type StreamToken = { userId: string; expiresAt: number };
type StreamClient = { id: string; userId: string; response: Response; connectedAt: number };
type SafeLogger = Pick<Console, "warn">;

export type LiveUpdates = {
  createStreamToken(userId: string): string;
  consumeStreamToken(token?: string | null): string | null;
  subscribe(response: Response, userId: string): string | null;
  broadcastChange(): number;
  shutdown(): void;
};

export type SseHubOptions = {
  tokenTtlMs?: number;
  heartbeatMs?: number;
  maxConnectionsPerUser?: number;
  now?: () => number;
  logger?: SafeLogger;
};

export class SseHub implements LiveUpdates {
  private readonly tokens = new Map<string, StreamToken>();
  private readonly clients = new Map<string, StreamClient>();
  private readonly tokenTtlMs: number;
  private readonly heartbeatMs: number;
  private readonly maxConnectionsPerUser: number;
  private readonly now: () => number;
  private readonly logger: SafeLogger;
  private readonly maintenanceTimer: NodeJS.Timeout;
  private stopped = false;

  constructor(options: SseHubOptions = {}) {
    this.tokenTtlMs = options.tokenTtlMs ?? 30_000;
    this.heartbeatMs = options.heartbeatMs ?? 20_000;
    this.maxConnectionsPerUser = options.maxConnectionsPerUser ?? 3;
    this.now = options.now ?? Date.now;
    this.logger = options.logger ?? console;
    this.maintenanceTimer = setInterval(() => this.maintain(), this.heartbeatMs);
    this.maintenanceTimer.unref();
  }

  createStreamToken(userId: string) {
    if (this.stopped) throw new Error("Live updates are shutting down");
    this.removeExpiredTokens();
    const token = randomBytes(32).toString("base64url");
    this.tokens.set(token, { userId, expiresAt: this.now() + this.tokenTtlMs });
    return token;
  }

  consumeStreamToken(token?: string | null) {
    if (!token || this.stopped) return null;
    const record = this.tokens.get(token);
    this.tokens.delete(token);
    if (!record || record.expiresAt <= this.now()) return null;
    return record.userId;
  }

  subscribe(response: Response, userId: string) {
    if (this.stopped || this.connectionCount(userId) >= this.maxConnectionsPerUser) return null;
    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-store, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders?.();

    const id = randomBytes(12).toString("hex");
    this.clients.set(id, { id, userId, response, connectedAt: this.now() });
    const cleanup = () => { this.clients.delete(id); };
    response.once("close", cleanup);
    response.once("finish", cleanup);
    if (!this.safeWrite(response, ": connected\n\n", "initial-write")) cleanup();
    return this.clients.has(id) ? id : null;
  }

  broadcastChange() {
    if (this.stopped) return 0;
    const message = "event: business.changed\ndata: {}\n\n";
    let delivered = 0;
    for (const client of [...this.clients.values()]) {
      if (this.safeWrite(client.response, message, "broadcast-write")) delivered += 1;
      else this.clients.delete(client.id);
    }
    return delivered;
  }

  shutdown() {
    if (this.stopped) return;
    this.stopped = true;
    clearInterval(this.maintenanceTimer);
    this.tokens.clear();
    for (const client of [...this.clients.values()]) {
      this.clients.delete(client.id);
      try {
        client.response.end();
      } catch (error) {
        this.logFailure("shutdown-close", error);
      }
    }
  }

  getStats() {
    return { clients: this.clients.size, tokens: this.tokens.size, stopped: this.stopped };
  }

  private maintain() {
    if (this.stopped) return;
    this.removeExpiredTokens();
    for (const client of [...this.clients.values()]) {
      if (!this.safeWrite(client.response, ": heartbeat\n\n", "heartbeat-write")) this.clients.delete(client.id);
    }
  }

  private removeExpiredTokens() {
    const currentTime = this.now();
    for (const [token, record] of this.tokens) {
      if (record.expiresAt <= currentTime) this.tokens.delete(token);
    }
  }

  private connectionCount(userId: string) {
    let count = 0;
    for (const client of this.clients.values()) if (client.userId === userId) count += 1;
    return count;
  }

  private safeWrite(response: Response, message: string, phase: string) {
    try {
      response.write(message);
      return true;
    } catch (error) {
      this.logFailure(phase, error);
      try {
        response.end();
      } catch (closeError) {
        this.logFailure(`${phase}-close`, closeError);
      }
      return false;
    }
  }

  private logFailure(phase: string, error: unknown) {
    this.logger.warn("Live updates transport failure", {
      phase,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

export const liveUpdatesHub = new SseHub();
