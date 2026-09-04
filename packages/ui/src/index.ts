// lib
export { cn } from "./lib/cn.ts";
export { formatMinor, currencySymbol, type Currency, type FormatOptions } from "./lib/money.ts";

// primitives
export { Button, type ButtonProps } from "./primitives/button.tsx";
export { Input } from "./primitives/input.tsx";
export { Card, CardHeader, CardBody, CardFooter } from "./primitives/card.tsx";
export { Badge, type BadgeProps } from "./primitives/badge.tsx";
export { Separator } from "./primitives/separator.tsx";
export { IconButton, type IconButtonProps } from "./primitives/icon-button.tsx";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./primitives/tabs.tsx";
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./primitives/dialog.tsx";
export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "./primitives/sheet.tsx";

// components
export { Money, type MoneyProps } from "./components/money.tsx";
export { StatusPill, type OrderStatus, type StatusPillProps } from "./components/status-pill.tsx";
export { NetworkPill, type NetworkState } from "./components/network-pill.tsx";
export { VegMark } from "./components/veg-mark.tsx";
export { QtyStepper, type QtyStepperProps } from "./components/qty-stepper.tsx";
export { TableTile, type TableTileProps } from "./components/table-tile.tsx";
export { MenuItemCard, type MenuItemCardProps } from "./components/menu-item-card.tsx";
export { CartLine, type CartLineProps } from "./components/cart-line.tsx";
export {
  KotTicket,
  type KotTicketProps,
  type KotItem,
} from "./components/kot-ticket.tsx";
export {
  Receipt,
  type ReceiptProps,
  type ReceiptLine,
  type TaxBreakdownRow,
} from "./components/receipt.tsx";
export { ThemeToggle, type Theme } from "./components/theme-toggle.tsx";
