import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "../lib/cn.ts";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export const DialogContent = forwardRef<
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
        "fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
        "w-[min(560px,calc(100vw-32px))] max-h-[85dvh] overflow-auto",
        "bg-[var(--bg-surface)] text-[var(--fg-primary)]",
        "ring-1 ring-[var(--line-default)] rounded-[var(--radius-4)]",
        "shadow-[var(--shadow-3)] p-6",
        "data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
        className,
      )}
      {...props}
    >
      {children}
      <RadixDialog.Close
        aria-label="Close"
        className="absolute top-3 right-3 h-9 w-9 inline-flex items-center justify-center rounded-[var(--radius-2)] text-[var(--fg-tertiary)] hover:bg-[var(--bg-surface-2)] hover:text-[var(--fg-primary)]"
      >
        <X size={18} />
      </RadixDialog.Close>
    </RadixDialog.Content>
  </RadixDialog.Portal>
));
DialogContent.displayName = "DialogContent";

export const DialogTitle = ({ className, ...props }: ComponentPropsWithoutRef<typeof RadixDialog.Title>) => (
  <RadixDialog.Title className={cn("text-[17px] font-semibold tracking-tight", className)} {...props} />
);
export const DialogDescription = ({ className, ...props }: ComponentPropsWithoutRef<typeof RadixDialog.Description>) => (
  <RadixDialog.Description className={cn("text-[14px] text-[var(--fg-tertiary)] mt-1", className)} {...props} />
);
