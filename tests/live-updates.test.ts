import test from "node:test";
import assert from "node:assert/strict";
import { createLiveUpdatesClient, type EventSourceLike } from "../src/services/liveUpdates";

class FakeEventSource extends EventTarget implements EventSourceLike {
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;
  constructor(readonly url: string) { super(); }
  close() { this.closed = true; }
  open() { this.onopen?.(new Event("open")); }
  fail() { this.onerror?.(new Event("error")); }
  change() { this.dispatchEvent(new Event("business.changed")); }
}

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

test("one EventSource debounces nearby events into one refresh", async () => {
  const sources: FakeEventSource[] = [];
  let refreshes = 0;
  const client = createLiveUpdatesClient({
    getToken: async () => "single-use-token",
    refresh: async () => { refreshes += 1; },
    createEventSource: url => { const source = new FakeEventSource(url); sources.push(source); return source; },
    debounceMs: 10,
  });
  client.start();
  client.start();
  await wait(0);
  assert.equal(sources.length, 1);
  sources[0].change(); sources[0].change(); sources[0].change();
  await wait(25);
  assert.equal(refreshes, 1);
  client.stop();
});

test("refreshes never overlap and one queued refresh covers events received in flight", async () => {
  const sources: FakeEventSource[] = [];
  let refreshes = 0;
  let concurrent = 0;
  let maxConcurrent = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const client = createLiveUpdatesClient({
    getToken: async () => "token",
    refresh: async () => {
      refreshes += 1; concurrent += 1; maxConcurrent = Math.max(maxConcurrent, concurrent);
      if (refreshes === 1) await gate;
      concurrent -= 1;
    },
    createEventSource: url => { const source = new FakeEventSource(url); sources.push(source); return source; },
    debounceMs: 5,
  });
  client.start(); await wait(0);
  sources[0].change(); await wait(10);
  sources[0].change(); sources[0].change(); await wait(10);
  release(); await wait(20);
  assert.equal(refreshes, 2);
  assert.equal(maxConcurrent, 1);
  client.stop();
});

test("reconnect uses backoff, requests a new token, and cleanup prevents reconnect", async () => {
  const sources: FakeEventSource[] = [];
  let tokenRequests = 0;
  const client = createLiveUpdatesClient({
    getToken: async () => `token-${++tokenRequests}`,
    refresh: async () => {},
    createEventSource: url => { const source = new FakeEventSource(url); sources.push(source); return source; },
    baseReconnectMs: 5,
    maxReconnectMs: 20,
    random: () => 0.5,
  });
  client.start(); await wait(0);
  sources[0].fail(); await wait(10);
  assert.equal(sources.length, 2);
  assert.equal(tokenRequests, 2);
  assert.notEqual(sources[0].url, sources[1].url);
  sources[1].fail();
  client.stop();
  await wait(25);
  assert.equal(sources.length, 2);
  assert.equal(sources[1].closed, true);
});

test("replacing a user closes the previous connection before opening another", async () => {
  const sources: FakeEventSource[] = [];
  const makeClient = (user: string) => createLiveUpdatesClient({
    getToken: async () => `${user}-token`, refresh: async () => {},
    createEventSource: url => { const source = new FakeEventSource(url); sources.push(source); return source; },
  });
  const first = makeClient("first"); first.start(); await wait(0);
  first.stop();
  const second = makeClient("second"); second.start(); await wait(0);
  assert.equal(sources[0].closed, true);
  assert.equal(sources[1].closed, false);
  second.stop();
});
