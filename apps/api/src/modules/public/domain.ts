import { Money } from "@odr/shared";

export type MenuItemPrice = { itemName: string; unitPriceMinor: bigint; taxClass: string };

/**
 * Server-side price resolution. Whatever the diner's browser sent is thrown
 * away — only itemId, qty and note survive. Unknown ids are dropped by the
 * caller (null return) rather than priced at zero.
 */
export const resolveLine = (
  item: { name: string; basePrice: string; taxClass: string; isActive: boolean } | undefined,
): MenuItemPrice | null =>
  item && item.isActive
    ? { itemName: item.name, unitPriceMinor: Money.of(item.basePrice, "INR").minor, taxClass: item.taxClass }
    : null;
