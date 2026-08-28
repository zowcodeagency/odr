export type PublicOutlet = {
  id: string;
  tenantId: string;
  name: string;
  publicToken: string | null;
};

export interface PublicRepo {
  outletById(outletId: string): Promise<PublicOutlet | null>;
  /** Which outlet (and tenant) an order belongs to — the diner has no JWT to tell us. */
  outletForOrder(orderId: string): Promise<PublicOutlet | null>;
}
