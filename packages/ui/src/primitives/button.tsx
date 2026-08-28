import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn.ts";

const button = cva(
  [
    "inline-flex items-center justify-center gap-2 select-none",
    "font-medium tracking-[-0.005em] whitespace-nowrap",
    "rounded-[var(--radius-2)] transition-colors duration-[var(--dur-quick)]",
    "disabled:opacity-45 disabled:pointer-events-none",
    "focus-visible:outline-2 focus-visible:outline-[color:var(--ring)] focus-visible:outline-offset-2",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-[var(--accent)] text-[var(--fg-on-accent)]",
          "hover:bg-[var(--accent-hover)]",
        ],
        secondary: [
          "bg-[var(--bg-surface)] text-[var(--fg-primary)]",
          "ring-1 ring-[var(--line-default)]",
          "hover:bg-[var(--bg-surface-2)]",
        ],
        ghost: [
          "bg-transparent text-[var(--fg-secondary)]",
          "hover:bg-[var(--bg-surface-2)] hover:text-[var(--fg-primary)]",
        ],
        outline: [
          "bg-transparent text-[var(--fg-secondary)]",
          "ring-1 ring-[var(--line-default)]",
          "hover:bg-[var(--bg-surface-2)] hover:text-[var(--fg-primary)]",
        ],
        danger: [
          "bg-[var(--status-voided)] text-white",
          "hover:brightness-110",
        ],
      },
      size: {
        sm: "h-8 px-2.5 text-[13px]",
        md: "h-9 px-3.5 text-[14px]",
        lg: "h-11 px-5 text-[15px]",
        xl: "h-12 px-6 text-[16px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(button({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";
