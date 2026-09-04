import { useEffect, useState } from "react";

/**
 * One-line transient message. Module-level setter instead of a context —
 * there is exactly one Toaster, mounted by App.
 */
let emit: ((m: string) => void) | null = null;

export const toast = (message: string): void => emit?.(message);

export const Toaster = () => {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    emit = (m) => {
      setMsg(m);
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 4000);
    };
    return () => {
      emit = null;
      clearTimeout(timer);
    };
  }, []);

  if (msg === null) return null;
  return (
    <div
      role="status"
      data-print="hide"
      className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-[calc(var(--bottom-nav-h,0px)_+_16px)] md:bottom-[max(20px,env(safe-area-inset-bottom))]
                 max-w-[calc(100vw-32px)] px-4 py-2.5
                 rounded-[var(--radius-2)] bg-[var(--bg-surface-3)]
                 ring-1 ring-[var(--line-strong)] shadow-[var(--shadow-3)]
                 text-[13px] text-[var(--fg-primary)]"
    >
      {msg}
    </div>
  );
};
