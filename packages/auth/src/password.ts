// PBKDF2-SHA256 via WebCrypto — native on Cloudflare Workers, Bun, and Node.
// Format: pbkdf2$<iterations>$<salt b64>$<hash b64>
// Cloudflare Workers rejects PBKDF2 above 100k iterations — that cap is the
// ceiling, not a choice. The count is embedded per-hash, so raising it later
// only affects new hashes.
const ITERATIONS = 100_000;

const b64 = (buf: ArrayBuffer | Uint8Array) => Buffer.from(buf as Uint8Array).toString("base64");
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

async function derive(plain: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(plain), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export const hashPassword = async (plain: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(plain, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
};

export const verifyPassword = async (plain: string, stored: string): Promise<boolean> => {
  if (!stored.startsWith("pbkdf2$")) {
    // Legacy argon2id hash from before the Workers migration — only verifiable on Bun (local dev).
    return typeof Bun !== "undefined" ? Bun.password.verify(plain, stored) : false;
  }
  const [, iters, salt, expected] = stored.split("$");
  const actual = await derive(plain, unb64(salt!), Number(iters));
  const exp = unb64(expected!);
  if (actual.length !== exp.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ exp[i]!;
  return diff === 0;
};
