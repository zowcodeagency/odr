import { cn } from "../lib/cn.ts";

export const Separator = ({
  className,
  variant = "solid",
}: {
  className?: string;
  variant?: "solid" | "dotted";
}) =>
  variant === "dotted" ? (
    <hr className={cn("divider-dotted text-current", className)} />
  ) : (
    <hr className={cn("border-0 h-px bg-[var(--line-default)]", className)} />
  );
