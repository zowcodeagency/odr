export type Role = "owner" | "manager" | "captain" | "cashier" | "kitchen";

export type Permission =
  | "menu:read" | "menu:write"
  | "order:read" | "order:create" | "order:fire-kot" | "order:void"
  | "billing:read" | "billing:settle" | "billing:refund"
  | "outlet:read" | "outlet:write"
  | "user:read" | "user:write";

const matrix: Record<Role, ReadonlySet<Permission>> = {
  owner:   new Set<Permission>(["menu:read","menu:write","order:read","order:create","order:fire-kot","order:void","billing:read","billing:settle","billing:refund","outlet:read","outlet:write","user:read","user:write"]),
  manager: new Set<Permission>(["menu:read","menu:write","order:read","order:create","order:fire-kot","order:void","billing:read","billing:settle","billing:refund","outlet:read","outlet:write","user:read"]),
  cashier: new Set<Permission>(["menu:read","order:read","order:create","order:fire-kot","billing:read","billing:settle"]),
  captain: new Set<Permission>(["menu:read","order:read","order:create","order:fire-kot"]),
  kitchen: new Set<Permission>(["menu:read","order:read"]),
};

export const can = (role: Role, perm: Permission): boolean => matrix[role].has(perm);
