/* Server-supplied runtime config. Cloud: { dinerOrigin }. Box: { dinerOrigin: "", offline: true }. */
declare global {
  interface Window {
    __ODR?: { dinerOrigin?: string; offline?: boolean };
  }
}

export const config = () => ({
  dinerOrigin: window.__ODR?.dinerOrigin ?? "",
  /** No internet on this install: hide anything that needs a customer's phone to reach us. */
  offline: window.__ODR?.offline === true,
});
