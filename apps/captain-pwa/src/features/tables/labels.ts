/**
 * Turn what a restaurant owner types into table labels.
 *
 *   "T-1 to T-12"        → T-1 … T-12
 *   "Bar-1, Bar-2, Win"  → three labels
 *   "T-4"                → one label
 *
 * A range needs the word "to" — otherwise "T-1" would read as a range.
 */
const MAX_RANGE = 200;

export const parseLabels = (input: string): string[] => {
  const range = input.trim().match(/^(.*?)(\d+)\s+to\s+(?:.*?)(\d+)$/i);
  if (range) {
    const [, prefix = "", from = "", to = ""] = range;
    const a = Number(from);
    const b = Number(to);
    if (a <= b && b - a < MAX_RANGE) {
      return Array.from({ length: b - a + 1 }, (_, i) => `${prefix}${a + i}`);
    }
  }
  return [...new Set(input.split(",").map((s) => s.trim()).filter(Boolean))];
};
