import * as RadixDialog from "@radix-ui/react-dialog";
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "../lib/cn.ts";

/**
 * Bottom sheet — for tablet thumb reach. Slides up from the bottom edge.
 * Uses Radix Dialog under the hood for focus trap + a11y.
 */
export const Sheet = RadixDialog.Root;
export const SheetTrigger = RadixDialog.Trigger;
export const SheetClose = RadixDialog.Close;

export const SheetContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixDialog.Content> & { children: ReactNode }
>(({ className, children, ...props }, ref) => (
  <RadixDialog.Portal>
    <RadixDialog.Overlay className="fixed inset-0 z-40 bg-[var(--bg-overlay)] backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
    <RadixDialog.Content
      ref={ref}
      className={cn(
        "fixed z-50 left-0 right-0 bottom-0",
        "bg-[var(--bg-surface)] text-[var(--fg-primary)]",
        "rounded-t-[var(--radius-4)] ring-1 ring-[var(--line-default)]",
        "max-h-[88vh] overflow-auto p-6",
        "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom",
        "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
        className,
      )}
      {...props}
    >
      <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-[var(--line-strong)]" />
      {children}
    </RadixDialog.Content>
  </RadixDialog.Portal>
));
SheetContent.displayName = "SheetContent";

export const SheetTitle = ({ className, ...props }: ComponentPropsWithoutRef<typeof RadixDialog.Title>) => (
  <RadixDialog.Title className={cn("text-[17px] font-semibold tracking-tight", className)} {...props} />
);
