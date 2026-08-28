import { SignJWT, jwtVerify } from "jose";

export type AccessClaims = {
  sub: string;
  tid: string;
  role: "owner" | "manager" | "captain" | "cashier" | "kitchen";
};

const enc = (s: string) => new TextEncoder().encode(s);

// ponytail: 30-day token instead of refresh-token machinery — staff devices
// stay signed in; removing a staff row still cuts access on the next request.
export const issueAccessToken = async (claims: AccessClaims, secret: string, ttlSec = 60 * 60 * 24 * 30): Promise<string> =>
  new SignJWT(claims as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("odr")
    .setAudience("odr-api")
    .setExpirationTime(`${ttlSec}s`)
    .sign(enc(secret));

export const verifyAccessToken = async (token: string, secret: string): Promise<AccessClaims> => {
  const { payload } = await jwtVerify(token, enc(secret), { issuer: "odr", audience: "odr-api" });
  return payload as unknown as AccessClaims;
};
