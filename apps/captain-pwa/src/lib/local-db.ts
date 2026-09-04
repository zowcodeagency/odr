/*
 * Bills kept on this device (hold-to-settle). IndexedDB, not localStorage:
 * async, structured, indexed, and it scales to a restaurant's year of bills.
 * ponytail: one hand-rolled store, no Dexie — add it when a second store needs
 * migrations or live queries.
 */
import type { Bill } from "./api.ts";

export interface LocalBill extends Bill {
  /** Set once the cloud has accepted this bill. */
  syncedAt?: string;
  /** Last sync attempt failed with this — shown in Settings. */
  syncError?: string;
}

const DB = "odr-local";
const STORE = "bills";
const META = "meta";

let opening: Promise<IDBDatabase> | null = null;
const open = (): Promise<IDBDatabase> =>
  (opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const bills = req.result.createObjectStore(STORE, { keyPath: "id" });
      bills.createIndex("outlet_settled", ["outletId", "settledAt"]);
      req.result.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error ?? new Error("IndexedDB unavailable"));
    };
  }));

const done = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const tx = async (mode: IDBTransactionMode, stores: string[] = [STORE]) => (await open()).transaction(stores, mode);

export const localBills = {
  async put(bill: LocalBill): Promise<void> {
    await done((await tx("readwrite")).objectStore(STORE).put(bill));
  },

  async get(id: string): Promise<LocalBill | null> {
    return (await done((await tx("readonly")).objectStore(STORE).get(id))) ?? null;
  },

  /** Newest first. `from` is an ISO instant; omit for everything. */
  async list(outletId: string, from = ""): Promise<LocalBill[]> {
    const range = IDBKeyRange.bound([outletId, from], [outletId, "￿"]);
    const rows: LocalBill[] = await done((await tx("readonly")).objectStore(STORE).index("outlet_settled").getAll(range));
    return rows.sort((a, b) => b.settledAt.localeCompare(a.settledAt));
  },

  async all(): Promise<LocalBill[]> {
    return done((await tx("readonly")).objectStore(STORE).getAll());
  },

  async clear(): Promise<void> {
    await done((await tx("readwrite")).objectStore(STORE).clear());
  },

  /**
   * Next device-local invoice number: PREFIX/FY/L<device>-<seq>. The "L" plus a
   * per-device code keeps it out of the cloud's own sequence, so a later sync
   * can store the number the customer already holds.
   * ponytail: 2-char device code = 1296 codes; the DB unique index catches the rest.
   */
  async nextInvoiceNumber(prefix: string, fiscalYear: string): Promise<string> {
    const t = await tx("readwrite", [META]);
    const meta = t.objectStore(META);
    let device: string | undefined = await done(meta.get("device"));
    if (!device) {
      device = Math.random().toString(36).slice(2, 4).toUpperCase();
      meta.put(device, "device");
    }
    const key = `seq:${fiscalYear}`;
    const seq = ((await done<number | undefined>(meta.get(key))) ?? 0) + 1;
    meta.put(seq, key);
    return `${prefix}/${fiscalYear}/L${device}-${String(seq).padStart(5, "0")}`;
  },
};

/** Bytes the bills take as JSON — what the owner sees as "space used". */
export const bytesOf = (bills: LocalBill[]): number =>
  bills.reduce((n, b) => n + JSON.stringify(b).length, 0);

export const formatBytes = (n: number): string =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
