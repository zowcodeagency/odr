import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn.ts";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg";
  label: string;
}

const sizeMap: Record<NonNullable<IconButtonProps["size"]>, string> = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-14 w-14",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = "md", className, label, children, ...props }, ref) => (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center",
        sizeMap[size],
        "rounded-[var(--radius-2)] text-[var(--fg-secondary)]",
        "hover:bg-[var(--bg-surface-2)] hover:text-[var(--fg-primary)]",
        "transition-colors duration-[var(--dur-quick)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
IconButton.displayName = "IconButton";
