import * as RadixTabs from "@radix-ui/react-tabs";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "../lib/cn.ts";

export const Tabs = RadixTabs.Root;

export const TabsList = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixTabs.List>
>(({ className, ...props }, ref) => (
  <RadixTabs.List
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1 p-1",
      "bg-[var(--bg-surface)] ring-1 ring-[var(--line-subtle)]",
      "rounded-[var(--radius-3)]",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof RadixTabs.Trigger>
>(({ className, ...props }, ref) => (
  <RadixTabs.Trigger
    ref={ref}
    className={cn(
      "px-3 h-9 text-[13px] font-medium tracking-tight",
      "text-[var(--fg-tertiary)] rounded-[var(--radius-2)]",
      "data-[state=active]:bg-[var(--bg-surface-3)] data-[state=active]:text-[var(--fg-primary)]",
      "transition-colors duration-[var(--dur-quick)]",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = RadixTabs.Content;
