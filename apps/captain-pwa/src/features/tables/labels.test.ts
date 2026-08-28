import { expect, test } from "bun:test";
import { parseLabels } from "./labels.ts";

test("expands a prefixed range", () => {
  expect(parseLabels("T-1 to T-4")).toEqual(["T-1", "T-2", "T-3", "T-4"]);
});

test("expands a bare number range", () => {
  expect(parseLabels("1 to 3")).toEqual(["1", "2", "3"]);
});

test("splits a comma list and drops duplicates", () => {
  expect(parseLabels("Bar-1, Bar-2 , Bar-1")).toEqual(["Bar-1", "Bar-2"]);
});

test("a single label is not a range", () => {
  expect(parseLabels("T-12")).toEqual(["T-12"]);
});

test("a backwards or absurd range falls back to the literal text", () => {
  expect(parseLabels("T-9 to T-2")).toEqual(["T-9 to T-2"]);
  expect(parseLabels("1 to 9999")).toEqual(["1 to 9999"]);
});
