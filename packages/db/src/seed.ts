import { eq, and } from "drizzle-orm";
import { db } from "./index.ts";
import { tenants, users, memberships, outlets } from "./schema/index.ts";

const ownerEmail = process.argv[2] ?? process.env.SEED_OWNER_EMAIL ?? "ziad@odr.dev";

const tenantSlug = "odr-demo";
const tenantName = "Odr Demo Restaurant";

console.log(`seeding tenant=${tenantSlug} owner=${ownerEmail}`);

const owner = (await db.select().from(users).where(eq(users.email, ownerEmail)).limit(1))[0];
if (!owner) {
  console.error(`no user found for email "${ownerEmail}". Register first with POST /auth/register, then re-run.`);
  process.exit(1);
}

const existing = (await db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1))[0];
const tenant = existing
  ?? (await db.insert(tenants).values({ slug: tenantSlug, name: tenantName, country: "IN", currency: "INR" }).returning())[0]!;
console.log(`tenant id=${tenant.id} (${existing ? "existing" : "created"})`);

const member = (await db.select().from(memberships).where(eq(memberships.userId, owner.id)).limit(1))[0];
if (!member || member.tenantId !== tenant.id) {
  await db.insert(memberships).values({ tenantId: tenant.id, userId: owner.id, role: "owner" }).onConflictDoNothing();
  console.log(`membership: ${owner.email} → ${tenant.slug} as owner`);
} else {
  console.log(`membership: already owner`);
}

const outletCode = "MNG-CENTRAL";
const existingOutlet = (await db.select().from(outlets).where(eq(outlets.tenantId, tenant.id)).limit(1))[0];
const outlet = existingOutlet
  ?? (await db.insert(outlets).values({
    tenantId: tenant.id,
    name: "Mangalore Central",
    code: outletCode,
    gstin: "29ABCDE1234F1Z5",
    address: { line1: "Hampankatta", city: "Mangalore", state: "Karnataka", pincode: "575001", country: "IN" },
    invoicePrefix: "MC",
  }).returning())[0]!;
console.log(`outlet id=${outlet.id} code=${outlet.code} (${existingOutlet ? "existing" : "created"})`);

const secondCode = "MNG-AIRPORT";
const second = (await db.select().from(outlets).where(and(eq(outlets.tenantId, tenant.id), eq(outlets.code, secondCode))).limit(1))[0]
  ?? (await db.insert(outlets).values({
    tenantId: tenant.id,
    name: "Mangalore Airport",
    code: secondCode,
    address: { line1: "Kenjar", city: "Mangalore", state: "Karnataka", pincode: "574142", country: "IN" },
    invoicePrefix: "MA",
    menuMode: "shared",
  }).returning())[0]!;
console.log(`outlet id=${second.id} code=${second.code}`);

console.log("\n--- READY ---");
console.log(`Login with:`);
console.log(`  POST /auth/login { "email":"${owner.email}", "password":"<your password>", "tenantId":"${tenant.id}" }`);
console.log(`Use outletId for orders: ${outlet.id}`);
process.exit(0);
