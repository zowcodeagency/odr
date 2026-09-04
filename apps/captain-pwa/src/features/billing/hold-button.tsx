import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Button } from "@odr/ui";

/**
 * Tap = onClick. Keep the finger down for `holdMs` = onHold, with a fill that
 * creeps across the button so the cashier can see it arming. The click that
 * follows a completed hold is swallowed.
 */
export const HoldButton = ({
  holdMs,
  onHold,
  onClick,
  children,
  className = "",
  disabled,
  ...rest
}: ComponentProps<typeof Button> & { holdMs: number; onHold: () => void }) => {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const fired = useRef(false);

  const stop = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  useEffect(() => stop, []);

  return (
    <Button
      {...rest}
      disabled={disabled}
      className={`relative overflow-hidden ${className}`}
      onPointerDown={(e) => {
        if (disabled || e.button !== 0) return;
        fired.current = false;
        setHolding(true);
        timer.current = window.setTimeout(() => {
          fired.current = true;
          stop();
          navigator.vibrate?.(40);
          onHold();
        }, holdMs);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (fired.current) {
          fired.current = false;
          return;
        }
        onClick?.(e);
      }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-black/20 pointer-events-none"
        style={{
          width: holding ? "100%" : "0%",
          transition: holding ? `width ${holdMs}ms linear` : "none",
        }}
      />
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </Button>
  );
};
