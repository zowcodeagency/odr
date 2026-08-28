export type Currency = "INR" | "SAR" | "AED" | "USD";

export class Money {
  private constructor(public readonly minor: bigint, public readonly currency: Currency) {}

  static of(major: number | string, currency: Currency): Money {
    const n = typeof major === "string" ? Number(major) : major;
    if (!Number.isFinite(n)) throw new Error(`invalid amount: ${major}`);
    return new Money(BigInt(Math.round(n * 100)), currency);
  }

  static fromMinor(minor: bigint | number, currency: Currency): Money {
    return new Money(typeof minor === "number" ? BigInt(minor) : minor, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minor + other.minor, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minor - other.minor, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(BigInt(Math.round(Number(this.minor) * factor)), this.currency);
  }

  toMajor(): string {
    const sign = this.minor < 0n ? "-" : "";
    const abs = this.minor < 0n ? -this.minor : this.minor;
    const major = abs / 100n;
    const minor = abs % 100n;
    return `${sign}${major}.${minor.toString().padStart(2, "0")}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}
