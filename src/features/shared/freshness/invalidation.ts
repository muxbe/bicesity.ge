import type { CriticalInvalidationTag } from "@/features/shared/freshness/critical-field-registry";

const INVALIDATION_STORAGE_KEY = "__velohub_invalidation__";

type InvalidationPayload = {
  tag: CriticalInvalidationTag;
  at: string;
};

let channel: BroadcastChannel | null = null;
const localListeners = new Set<(payload: InvalidationPayload) => void>();

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!channel) {
    channel = new BroadcastChannel("velohub-invalidation");
  }
  return channel;
}

function parsePayload(raw: string | null): InvalidationPayload | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as InvalidationPayload;
    if (!parsed.tag || !parsed.at) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function publishInvalidation(tag: CriticalInvalidationTag) {
  if (typeof window === "undefined") {
    return;
  }
  const payload: InvalidationPayload = {
    tag,
    at: new Date().toISOString(),
  };
  const raw = JSON.stringify(payload);
  window.localStorage.setItem(INVALIDATION_STORAGE_KEY, raw);
  const broadcastChannel = getChannel();
  if (broadcastChannel) {
    broadcastChannel.postMessage(payload);
  }
  localListeners.forEach((listener) => listener(payload));
}

export function subscribeInvalidation(listener: (payload: InvalidationPayload) => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  localListeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== INVALIDATION_STORAGE_KEY) {
      return;
    }
    const payload = parsePayload(event.newValue);
    if (payload) {
      listener(payload);
    }
  };

  window.addEventListener("storage", onStorage);

  const broadcastChannel = getChannel();
  const onMessage = (event: MessageEvent<InvalidationPayload>) => {
    const payload = event.data;
    if (payload?.tag && payload?.at) {
      listener(payload);
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener("message", onMessage);
  }

  return () => {
    localListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
    if (broadcastChannel) {
      broadcastChannel.removeEventListener("message", onMessage);
    }
  };
}
