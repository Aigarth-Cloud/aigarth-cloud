/**
 * Seed a development admin user.
 *
 *   ADMIN_EMAIL=admin@aigarth.local ADMIN_PASSWORD=changeme pnpm db:seed
 *
 * For local development only. In production, use a real signup flow.
 */

import { sql } from "drizzle-orm";
import { getDb, closeDb } from "./index.js";
import { users, userCredentials, organizations, memberships } from "./schema.js";
import { hashPassword } from "../lib/password.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";

const adminEmail = (process.env["ADMIN_EMAIL"] ?? "admin@aigarth.local").toLowerCase();
const adminPassword = process.env["ADMIN_PASSWORD"] ?? "changeme";
const adminName = process.env["ADMIN_NAME"] ?? "Admin";

if (adminPassword === "changeme") {
  // eslint-disable-next-line no-console
  console.warn("[identity] using default password 'changeme' — set ADMIN_PASSWORD in production");
}

const db = getDb();

// eslint-disable-next-line no-console
console.log(`[identity] seeding admin: ${adminEmail}`);

const existingRows = await db
  .select()
  .from(users)
  .where(sql`lower(${users.email}) = ${adminEmail}`)
  .limit(1);
const existing = existingRows[0];

let userId: string;
if (existing) {
  // eslint-disable-next-line no-console
  console.log(`  user already exists: ${existing.id}`);
  userId = existing.id;
} else {
  userId = uid();
  await db.insert(users).values({
    id: userId,
    email: adminEmail,
    name: adminName,
    emailVerifiedAt: new Date(),
    status: "active",
  });

  const passwordHash = await hashPassword(adminPassword);
  await db.insert(userCredentials).values({
    userId,
    passwordHash: passwordHash.hash,
    hashParams: passwordHash.params,
  });

  const orgId = uid();
  const slug = `admin-${userId.slice(0, 8)}`;
  await db.insert(organizations).values({
    id: orgId,
    slug,
    name: `${adminName}'s Workspace`,
    isPersonal: true,
    billingEmail: adminEmail,
  });

  await db.insert(memberships).values({
    id: uid(),
    userId,
    orgId,
    role: "owner",
  });

  await logActivity(db, {
    action: "user.created",
    actorUserId: userId,
    targetType: "user",
    targetId: userId,
    metadata: { source: "seed" },
  });
  await logActivity(db, {
    action: "org.created",
    actorUserId: userId,
    orgId,
    targetType: "org",
    targetId: orgId,
    metadata: { source: "seed", isPersonal: true },
  });

  // eslint-disable-next-line no-console
  console.log(`  created user ${userId} with personal org ${orgId}`);
}

await closeDb();
// eslint-disable-next-line no-console
console.log("[identity] seed complete");
