import * as RadixDialog from "@radix-ui/react-dialog";
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "../lib/cn.ts";

/**
 * Bottom sheet — for thumb reach on phones and tablets. Slides up from the
 * bottom edge; from `sm` it floats as a rounded card above the safe area.
 * Radix Dialog underneath for focus trap + a11y.
 */
export const Sheet = RadixDialog.Root;
export const SheetTrigger = RadixDialog.Trigger;
export const SheetClose = RadixDialog.Close;

export const SheetContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixDialog.Content> & { children: ReactNode }
>(({ className, children, ...props }, ref) => (
  <RadixDialog.Portal>
    <RadixDialog.Overlay
      className={cn(
        "fixed inset-0 z-40 bg-[var(--bg-overlay)] backdrop-blur-[2px]",
        "data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
      )}
    />
    <RadixDialog.Content
      ref={ref}
      className={cn(
        "fixed z-50 inset-x-0 bottom-0 flex flex-col",
        "sm:inset-x-4 sm:bottom-4 sm:mx-auto sm:w-[min(560px,calc(100vw-32px))]",
        "bg-[var(--bg-surface)] text-[var(--fg-primary)]",
        "rounded-t-[var(--radius-4)] sm:rounded-[var(--radius-4)]",
        "ring-1 ring-[var(--line-default)] shadow-[var(--shadow-3)]",
        "max-h-[88dvh] overflow-hidden",
        "px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] sm:p-6 sm:pt-3",
        "data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out",
        className,
      )}
      {...props}
    >
      <div aria-hidden className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-[var(--line-strong)]" />
      {children}
    </RadixDialog.Content>
  </RadixDialog.Portal>
));
SheetContent.displayName = "SheetContent";

export const SheetTitle = ({ className, ...props }: ComponentPropsWithoutRef<typeof RadixDialog.Title>) => (
  <RadixDialog.Title className={cn("text-[17px] font-semibold tracking-tight", className)} {...props} />
);
export const SheetDescription = ({ className, ...props }: ComponentPropsWithoutRef<typeof RadixDialog.Description>) => (
  <RadixDialog.Description className={cn("text-[13px] text-[var(--fg-tertiary)] mt-0.5", className)} {...props} />
);
