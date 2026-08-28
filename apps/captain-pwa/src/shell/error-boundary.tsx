import { Component, type ErrorInfo, type ReactNode } from "react";
import { clearSession } from "../lib/session.ts";
import { Logo } from "./logo.tsx";

/*
 * A render crash on a waiter's phone must not be a white screen in the middle
 * of service. React only exposes this as a class — there is no hook for it.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { message: string | null }
> {
  override state = { message: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("captain crashed:", error, info.componentStack);
  }

  override render() {
    if (this.state.message === null) return this.props.children;
    return (
      <div className="h-full grid place-items-center px-6 bg-[var(--bg-canvas)] text-center">
        <div>
          <Logo size={36} className="justify-center" />
          <h1 className="mt-6 text-[20px] font-semibold tracking-[-0.02em]">
            Something broke on this screen
          </h1>
          <p className="mt-2 text-[14px] text-[var(--fg-tertiary)]">
            Your orders are saved on the server. Reload and carry on.
          </p>
          <p className="mt-3 font-mono text-[12px] text-[var(--fg-muted)] break-words max-w-[420px]">
            {this.state.message}
          </p>
          <div className="mt-7 flex justify-center gap-2">
            <button
              onClick={() => {
                window.location.hash = "/tables";
                window.location.reload();
              }}
              className="min-h-11 px-5 text-[14px] font-medium rounded-[var(--radius-2)]
                         bg-[var(--accent)] text-[var(--fg-on-accent)]"
            >
              Reload
            </button>
            {/* If the stored session is what's broken, reloading just loops. */}
            <button
              onClick={() => {
                clearSession();
                window.location.hash = "/login";
                window.location.reload();
              }}
              className="min-h-11 px-5 text-[14px] rounded-[var(--radius-2)]
                         ring-1 ring-[var(--line-default)] hover:bg-[var(--bg-surface-2)]"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }
}
