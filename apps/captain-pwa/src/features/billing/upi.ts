import { Money } from "@odr/shared";

/** UPI deep link every Indian payment app reads: payee, name, exact amount, note. */
export const upiPayUrl = (input: { upiId: string; payee: string; amountMinor: string; note: string }): string => {
  const q = new URLSearchParams({
    pa: input.upiId,
    pn: input.payee.slice(0, 50),
    am: Money.fromMinor(BigInt(input.amountMinor), "INR").toMajor(),
    cu: "INR",
    tn: input.note.slice(0, 50),
  });
  return `upi://pay?${q.toString()}`;
};
