import { expect, test } from "bun:test";
import { daysRemaining, isExpired } from "./session.ts";

const iso = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

test("the end date itself is still a working day", () => {
  // Matches the API's isExpired (end < today) — the shop must not lock out
  // on the morning of the day it paid for.
  expect(isExpired(iso(0))).toBe(false);
  expect(isExpired(iso(1))).toBe(false);
  expect(isExpired(iso(-1))).toBe(true);
});

test("no end date means unenforced", () => {
  expect(isExpired(null)).toBe(false);
  expect(daysRemaining(null)).toBe(null);
});

test("days remaining counts whole days", () => {
  expect(daysRemaining(iso(0))).toBe(0);
  expect(daysRemaining(iso(5))).toBe(5);
});
