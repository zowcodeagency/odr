import type { MenuMode } from "@odr/db/schema";

export type Address = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
};

export type Outlet = {
  id: string;
  name: string;
  code: string;
  gstin: string | null;
  address: Address;
  invoicePrefix: string;
  paperWidth: number;
  printerIp: string | null;
  printerPort: number;
  publicToken: string | null;
  upiId: string | null;
  isActive: boolean;
  menuMode: MenuMode;
};

export type Table = { id: string; label: string };

/** Everything the owner may change from the app. Printing plus the outlet's identity. */
export type OutletSettings = {
  paperWidth?: number;
  printerIp?: string | null;
  printerPort?: number;
  name?: string;
  gstin?: string | null;
  address?: Address;
  invoicePrefix?: string;
  upiId?: string | null;
};

/** A UPI ID (VPA) looks like shop@okaxis or 9845012345@ybl. */
const UPI_RE = /^[a-z0-9._-]{2,64}@[a-z][a-z0-9]{1,30}$/i;
export const isValidUpiId = (s: string): boolean => UPI_RE.test(s);

/** Thermal rolls come in two sizes; anything else is a typo. */
export const PAPER_WIDTHS = [58, 80] as const;
export const isValidPaperWidth = (n: number): boolean => (PAPER_WIDTHS as readonly number[]).includes(n);

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const isValidGstin = (s: string): boolean => GSTIN_RE.test(s);
