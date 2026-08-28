import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../lib/cn.ts";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full px-3 text-[14px]",
        "bg-[var(--bg-surface)] text-[var(--fg-primary)]",
        "rounded-[var(--radius-2)] ring-1 ring-[var(--line-default)]",
        "placeholder:text-[var(--fg-muted)]",
        "transition-shadow duration-[var(--dur-quick)]",
        "focus:outline-none focus:ring-2 focus:ring-[var(--accent)]",
        "disabled:opacity-40",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
