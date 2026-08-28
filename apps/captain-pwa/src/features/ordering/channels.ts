import type { Channel } from "../../lib/api.ts";

export const CHANNEL_LABEL: Record<Channel, string> = {
  dine_in: "Dine-in",
  parcel: "Parcel",
  zomato: "Zomato",
  swiggy: "Swiggy",
  other: "Other",
  qr: "QR",
};

/** Badge tone per channel — matches the @odr/ui Badge variants. */
export const CHANNEL_TONE: Record<Channel, "neutral" | "accent" | "info" | "warn"> = {
  dine_in: "neutral",
  parcel: "neutral",
  zomato: "warn",
  swiggy: "warn",
  other: "neutral",
  qr: "accent",
};

/** Off-table = anything the floor plan can't show as a table. */
export const isOffTable = (c: Channel): boolean => c !== "dine_in" && c !== "qr";

export const OFF_TABLE_CHANNELS: Channel[] = ["parcel", "zomato", "swiggy", "other"];

export const minutesSince = (iso: string): number =>
  Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));

/** Local midnight, N days back. Bills are read in the restaurant's own day. */
export const midnight = (daysAgo = 0): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
};
