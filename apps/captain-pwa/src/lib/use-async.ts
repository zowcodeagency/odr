import { useCallback, useEffect, useRef, useState } from "react";

export interface Async<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Load once, optionally re-poll. Every screen needs the same
 * loading / empty / error triad; this is the only place it's spelled out.
 *
 * `deps` re-runs the fetch; `pollMs` refreshes in the background without
 * flicking the screen back to its loading state.
 */
export const useAsync = <T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
  pollMs = 0,
): Async<T> => {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const ref = useRef(fn);
  ref.current = fn;

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let live = true;
    const run = (first: boolean) => {
      if (first) setLoading(true);
      ref
        .current()
        .then((d) => {
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
    const id = setInterval(() => run(false), pollMs);
    return () => {
      live = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, pollMs, tick]);

  return { data, error, loading, reload };
};
