import { useCallback, useEffect, useRef, useState } from "react";

export interface Async<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/*
 * Stale-while-revalidate. Routes unmount on every navigation, so without this
 * tables → order → tables blanked the floor to "Loading…" for data three
 * seconds old. Keyed on the call site's source plus its deps: two screens
 * that key on the same outletId must not share a cache slot.
 * ponytail: module Map, lives for the tab. Persist to IndexedDB when a cold
 * start also needs to paint from cache.
 */
const cache = new Map<string, unknown>();

/**
 * Load once, optionally re-poll. Every screen needs the same
 * loading / empty / error triad; this is the only place it's spelled out.
 *
 * `deps` re-runs the fetch; `pollMs` refreshes in the background without
 * flicking the screen back to its loading state. Polling pauses while the
 * tab is hidden or offline and refreshes the moment it is looked at again.
 */
export const useAsync = <T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
  pollMs = 0,
): Async<T> => {
  const key = `${fn.toString()}|${JSON.stringify(deps)}`;
  const cached = cache.get(key) as T | undefined;
  const [data, setData] = useState<T | null>(cached ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(cached === undefined);
  const [tick, setTick] = useState(0);
  const ref = useRef(fn);
  ref.current = fn;

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let live = true;
    const hit = cache.get(key) as T | undefined;
    // Deps changed to something we have seen: paint it now, refresh behind it.
    if (hit !== undefined) setData(hit);
    const run = (first: boolean) => {
      if (first && hit === undefined) setLoading(true);
      ref
        .current()
        .then((d) => {
          cache.set(key, d);
          if (!live) return;
          setData(d);
          setError(null);
        })
        .catch((e: unknown) => {
          if (live) setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    };
    run(true);
    if (!pollMs) return () => {
      live = false;
    };
    const poll = () => {
      if (document.hidden || !navigator.onLine) return;
      run(false);
    };
    const id = setInterval(poll, pollMs);
    const onVisible = () => {
      if (!document.hidden) run(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pollMs, tick]);

  return { data, error, loading, reload };
};
