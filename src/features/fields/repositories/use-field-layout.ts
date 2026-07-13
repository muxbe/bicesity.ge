"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createDefaultFieldLayoutConfig,
  type FieldLayoutState,
} from "@/features/fields/field-layout";
import { getFieldRepository } from "@/features/fields/repositories/field-repository.factory";

let cachedState: FieldLayoutState | null = null;
let pendingState: Promise<FieldLayoutState> | null = null;
const listeners = new Set<(state: FieldLayoutState) => void>();

export function publishFieldLayoutState(state: FieldLayoutState) {
  cachedState = state;
  listeners.forEach((listener) => listener(state));
}

async function loadFieldLayoutState(force = false): Promise<FieldLayoutState> {
  if (!force && cachedState) {
    return cachedState;
  }
  if (!force && pendingState) {
    return pendingState;
  }

  const request = getFieldRepository()
    .getFieldLayout()
    .then((state) => {
      publishFieldLayoutState(state);
      return state;
    })
    .finally(() => {
      if (pendingState === request) {
        pendingState = null;
      }
    });
  pendingState = request;
  return request;
}

export function useFieldLayout(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  const fallbackState = useMemo<FieldLayoutState>(
    () => ({ config: createDefaultFieldLayoutConfig(false), storageReady: false }),
    []
  );
  const [state, setState] = useState<FieldLayoutState>(() =>
    enabled && cachedState ? cachedState : fallbackState
  );
  const [isLoading, setIsLoading] = useState(enabled && !cachedState);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      return fallbackState;
    }
    setIsLoading(true);
    setError(null);
    try {
      return await loadFieldLayoutState(true);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to load field layout.");
      return fallbackState;
    } finally {
      setIsLoading(false);
    }
  }, [enabled, fallbackState]);

  useEffect(() => {
    if (!enabled) {
      setState(fallbackState);
      setIsLoading(false);
      return;
    }

    let active = true;
    const listener = (nextState: FieldLayoutState) => {
      if (active) {
        setState(nextState);
      }
    };
    listeners.add(listener);
    void loadFieldLayoutState()
      .catch((caughtError) => {
        if (active) {
          setError(caughtError instanceof Error ? caughtError.message : "Failed to load field layout.");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, [enabled, fallbackState]);

  return {
    config: state.config,
    storageReady: state.storageReady,
    isLoading,
    error,
    reload,
  };
}
