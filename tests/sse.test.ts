import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import type { Response } from "express";
import { SseHub } from "../server/sse";

class FakeResponse extends EventEmitter {
  statusCode = 0;
  headers = new Map<string, string>();
  writes: string[] = [];
  ended = false;
  status(code: number) { this.statusCode = code; return this; }
  setHeader(name: string, value: string) { this.headers.set(name.toLowerCase(), value); return this; }
  flushHeaders() {}
  write(chunk: string) { this.writes.push(chunk); return true; }
  end() { this.ended = true; this.emit("finish"); return this; }
}

const response = () => new FakeResponse() as unknown as Response;
const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

test("stream tokens are short-lived, one-time, and reject invalid or reused values", () => {
  let now = 1_000;
  const hub = new SseHub({ tokenTtlMs: 50, heartbeatMs: 60_000, now: () => now });
  const valid = hub.createStreamToken("user-a");
  assert.equal(hub.consumeStreamToken(valid), "user-a");
  assert.equal(hub.consumeStreamToken(valid), null);
  assert.equal(hub.consumeStreamToken("invalid"), null);
  const expired = hub.createStreamToken("user-a");
  now += 51;
  assert.equal(hub.consumeStreamToken(expired), null);
  hub.shutdown();
});

test("subscriptions enforce per-user limits and disconnect cleanup", () => {
  const hub = new SseHub({ maxConnectionsPerUser: 1, heartbeatMs: 60_000 });
  const first = response();
  const second = response();
  assert.ok(hub.subscribe(first, "user-a"));
  assert.equal(hub.subscribe(second, "user-a"), null);
  assert.equal(hub.getStats().clients, 1);
  first.emit("close");
  assert.equal(hub.getStats().clients, 0);
  assert.ok(hub.subscribe(second, "user-a"));
  hub.shutdown();
});

test("heartbeat and generic broadcasts contain no business data or secrets", async () => {
  const warnings: unknown[] = [];
  const hub = new SseHub({ heartbeatMs: 10, logger: { warn: (...args: unknown[]) => { warnings.push(args); } } as Console });
  const target = response();
  hub.subscribe(target, "user-secret-id");
  hub.broadcastChange();
  await wait(25);
  const body = (target as unknown as FakeResponse).writes.join("");
  assert.match(body, /business\.changed/);
  assert.match(body, /heartbeat/);
  assert.doesNotMatch(body, /user-secret-id|password|token|inventory|attendance|sale/i);
  assert.deepEqual(warnings, []);
  hub.shutdown();
});

test("graceful shutdown closes clients, clears tokens, and is idempotent", () => {
  const hub = new SseHub({ heartbeatMs: 60_000 });
  const target = response();
  hub.createStreamToken("user-a");
  hub.subscribe(target, "user-a");
  hub.shutdown();
  hub.shutdown();
  assert.deepEqual(hub.getStats(), { clients: 0, tokens: 0, stopped: true });
  assert.equal((target as unknown as FakeResponse).ended, true);
  assert.throws(() => hub.createStreamToken("user-a"), /shutting down/);
});
