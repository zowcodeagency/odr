import { test, expect } from "bun:test";
import { runWithContext } from "@odr/tenancy";
import { asTenantId, asUserId } from "@odr/shared";
import { makeIdentityService } from "./service.ts";
import type { IdentityRepo } from "./ports.ts";

const TENANT = "11111111-1111-1111-1111-111111111111";
const OWNER = "22222222-2222-2222-2222-222222222222";
const OWNER2 = "33333333-3333-3333-3333-333333333333";
const WAITER = "44444444-4444-4444-4444-444444444444";

/** Only the staff surface is exercised here; the rest throws if touched. */
const repoWith = (staff: { id: string; role: string }[]) => {
  const removed: string[] = [];
  const repo = {
    listStaff: async () =>
      staff.map((s) => ({ ...s, email: `${s.id}@x.dev`, fullName: s.id })) as never,
    removeMembership: async (_t: string, userId: string) => {
      removed.push(userId);
    },
  } as unknown as IdentityRepo;
  return { repo, removed };
};

const asOwner = <T>(repo: IdentityRepo, fn: (svc: ReturnType<typeof makeIdentityService>) => Promise<T>) =>
  runWithContext(
    { tenantId: asTenantId(TENANT), userId: asUserId(OWNER), role: "owner" as const },
    () => fn(makeIdentityService({ repo, jwtSecret: "test" })),
  );

test("an owner can remove a waiter", async () => {
  const { repo, removed } = repoWith([{ id: OWNER, role: "owner" }, { id: WAITER, role: "captain" }]);
  await asOwner(repo, (svc) => svc.removeStaff(WAITER));
  expect(removed).toEqual([WAITER]);
});

test("you cannot remove yourself — that is an instant lock-out", async () => {
  const { repo, removed } = repoWith([{ id: OWNER, role: "owner" }, { id: WAITER, role: "captain" }]);
  await asOwner(repo, async (svc) => {
    await expect(svc.removeStaff(OWNER)).rejects.toThrow(/yourself/);
  });
  expect(removed).toEqual([]);
});

test("the last owner cannot be removed", async () => {
  const { repo, removed } = repoWith([{ id: OWNER, role: "owner" }, { id: OWNER2, role: "owner" }]);
  // Two owners: removing one is fine.
  await asOwner(repo, (svc) => svc.removeStaff(OWNER2));
  expect(removed).toEqual([OWNER2]);

  const solo = repoWith([{ id: OWNER2, role: "owner" }, { id: WAITER, role: "captain" }]);
  await asOwner(solo.repo, async (svc) => {
    await expect(svc.removeStaff(OWNER2)).rejects.toThrow(/last owner/);
  });
  expect(solo.removed).toEqual([]);
});

test("a manager cannot remove staff — user:write is owner-only", async () => {
  const { repo } = repoWith([{ id: OWNER, role: "owner" }, { id: WAITER, role: "captain" }]);
  await runWithContext(
    { tenantId: asTenantId(TENANT), userId: asUserId(OWNER2), role: "manager" as const },
    async () => {
      const svc = makeIdentityService({ repo, jwtSecret: "test" });
      await expect(svc.removeStaff(WAITER)).rejects.toThrow(/cannot write staff/);
    },
  );
});

const OUTLET = "55555555-5555-5555-5555-555555555555";

const repoForCreate = () => {
  const added: { userId: string; role: string; outletId: string | null }[] = [];
  const repo = {
    findUserByEmail: async () => null,
    createUser: async (i: { email: string; fullName: string }) => ({ id: "new-user", email: i.email, fullName: i.fullName }),
    listMemberships: async () => [],
    outletExists: async (_t: string, id: string) => id === OUTLET,
    addMembership: async (_t: string, userId: string, role: string, outletId: string | null) => {
      added.push({ userId, role, outletId });
    },
  } as unknown as IdentityRepo;
  return { repo, added };
};

test("a captain must be pinned to an outlet; a manager is never pinned", async () => {
  const { repo, added } = repoForCreate();
  await asOwner(repo, async (svc) => {
    await expect(
      svc.createStaff({ email: "c@x.dev", password: "password1", fullName: "C", role: "captain" }),
    ).rejects.toThrow(/outlet/);
    await expect(
      svc.createStaff({ email: "c@x.dev", password: "password1", fullName: "C", role: "captain", outletId: "not-here" }),
    ).rejects.toThrow(/outlet/);
    await svc.createStaff({ email: "c@x.dev", password: "password1", fullName: "C", role: "captain", outletId: OUTLET });
    await svc.createStaff({ email: "m@x.dev", password: "password1", fullName: "M", role: "manager", outletId: OUTLET });
  });
  expect(added).toEqual([
    { userId: "new-user", role: "captain", outletId: OUTLET },
    { userId: "new-user", role: "manager", outletId: null },
  ]);
});
