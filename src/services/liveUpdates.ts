export type EventSourceLike = {
  onopen: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  close(): void;
};

type LiveUpdatesLogger = Pick<Console, "warn">;

export type LiveUpdatesClientOptions = {
  getToken: () => Promise<string>;
  refresh: () => Promise<void>;
  createEventSource?: (url: string) => EventSourceLike;
  debounceMs?: number;
  baseReconnectMs?: number;
  maxReconnectMs?: number;
  random?: () => number;
  logger?: LiveUpdatesLogger;
};

export function createLiveUpdatesClient(options: LiveUpdatesClientOptions) {
  const createEventSource = options.createEventSource ?? (url => new EventSource(url));
  const debounceMs = options.debounceMs ?? 800;
  const baseReconnectMs = options.baseReconnectMs ?? 1_000;
  const maxReconnectMs = options.maxReconnectMs ?? 30_000;
  const random = options.random ?? Math.random;
  const logger = options.logger ?? console;
  let source: EventSourceLike | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let connecting = false;
  let stopped = true;
  let generation = 0;
  let reconnectAttempt = 0;
  let refreshInFlight = false;
  let refreshQueued = false;

  const logFailure = (phase: string, error: unknown) => {
    logger.warn("Live updates client failure", {
      phase,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  };

  const clearTimer = (timer: ReturnType<typeof setTimeout> | null) => {
    if (timer) clearTimeout(timer);
  };

  const detachSource = () => {
    if (!source) return;
    source.removeEventListener("business.changed", onBusinessChanged);
    source.onopen = null;
    source.onerror = null;
    source.close();
    source = null;
  };

  const runRefresh = async () => {
    if (stopped) return;
    if (refreshInFlight) {
      refreshQueued = true;
      return;
    }
    refreshInFlight = true;
    try {
      await options.refresh();
    } catch (error) {
      logFailure("refresh", error);
    } finally {
      refreshInFlight = false;
      if (refreshQueued && !stopped) {
        refreshQueued = false;
        scheduleRefresh();
      }
    }
  };

  const scheduleRefresh = () => {
    clearTimer(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void runRefresh();
    }, debounceMs);
  };

  function onBusinessChanged() {
    scheduleRefresh();
  }

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer) return;
    const exponentialDelay = Math.min(maxReconnectMs, baseReconnectMs * (2 ** Math.min(reconnectAttempt, 6)));
    const jitteredDelay = Math.round(exponentialDelay * (0.8 + random() * 0.4));
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, jitteredDelay);
  };

  const connect = async () => {
    if (stopped || source || connecting) return;
    connecting = true;
    const connectionGeneration = generation;
    try {
      const token = await options.getToken();
      if (stopped || connectionGeneration !== generation) return;
      const nextSource = createEventSource(`/api/stream?token=${encodeURIComponent(token)}`);
      source = nextSource;
      nextSource.addEventListener("business.changed", onBusinessChanged);
      nextSource.onopen = () => { reconnectAttempt = 0; };
      nextSource.onerror = () => {
        if (source !== nextSource) return;
        detachSource();
        scheduleReconnect();
      };
    } catch (error) {
      if (!stopped && connectionGeneration === generation) {
        logFailure("connect", error);
        scheduleReconnect();
      }
    } finally {
      connecting = false;
    }
  };

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      generation += 1;
      void connect();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      generation += 1;
      clearTimer(debounceTimer);
      clearTimer(reconnectTimer);
      debounceTimer = null;
      reconnectTimer = null;
      refreshQueued = false;
      detachSource();
    },
    getState() {
      return { connected: source !== null, connecting, stopped, refreshInFlight, refreshQueued, reconnectAttempt };
    },
  };
}
