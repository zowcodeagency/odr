import { test, expect } from "bun:test";
import { asTenantId, asUserId } from "@odr/shared";
import { assertOutletScope, runWithContext } from "./index.ts";

const base = { tenantId: asTenantId("t-1"), userId: asUserId("u-1"), role: "captain" as const };
const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

test("unpinned staff pass for any outlet", () => {
  runWithContext({ ...base, role: "owner" }, () => {
    expect(() => assertOutletScope(A)).not.toThrow();
    expect(() => assertOutletScope(B)).not.toThrow();
  });
});

test("pinned staff pass only for their own outlet", () => {
  runWithContext({ ...base, outletId: A }, () => {
    expect(() => assertOutletScope(A)).not.toThrow();
    expect(() => assertOutletScope(B)).toThrow(/out of scope/);
  });
});
