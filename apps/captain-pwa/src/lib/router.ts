import { useEffect, useState } from "react";

/**
 * Tiny hash router. Hash routes work offline without server cooperation,
 * which fits the captain's PWA story until the SW lands (ADR `bdfce166`).
 */
export type Route =
  | { name: "login" }
  | { name: "tables" }
  | { name: "order"; orderId: string }
  | { name: "bill"; billId: string }
  | { name: "kds" }
  | { name: "settings" }
  | { name: "menu" }
  | { name: "bills" }
  | { name: "qr" }
  | { name: "branding" }
  | { name: "more" };

const ID = "[0-9a-zA-Z-]+";

const parse = (hash: string): Route => {
  // Empty hash = a fresh launch (an iOS PWA relaunches at its start URL with
  // no hash). Default to the floor, NOT login — app.tsx already swaps in the
  // login screen when there is no session, so a signed-in user stays signed in.
  const path = hash.replace(/^#/, "") || "/tables";
  if (path === "/login") return { name: "login" };
  if (path === "/tables") return { name: "tables" };
  if (path === "/kds") return { name: "kds" };
  if (path === "/settings") return { name: "settings" };
  if (path === "/menu") return { name: "menu" };
  if (path === "/bills") return { name: "bills" };
  if (path === "/qr") return { name: "qr" };
  if (path === "/branding") return { name: "branding" };
  if (path === "/more") return { name: "more" };
  const order = path.match(new RegExp(`^/order/(${ID})$`));
  if (order?.[1]) return { name: "order", orderId: order[1] };
  const bill = path.match(new RegExp(`^/bill/(${ID})$`));
  if (bill?.[1]) return { name: "bill", billId: bill[1] };
  return { name: "tables" };
};

export const href = (route: Route): string =>
  route.name === "order"
    ? `#/order/${route.orderId}`
    : route.name === "bill"
      ? `#/bill/${route.billId}`
      : `#/${route.name}`;

export const navigate = (route: Route): void => {
  window.location.hash = href(route).slice(1);
};

export const useRoute = (): Route => {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
};
