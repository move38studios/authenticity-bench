import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { allowedEmail } from "../lib/db/schema";
import { randomUUID } from "crypto";

async function seed() {
  const email = process.env.SEED_ADMIN_EMAIL;
  if (!email) {
    console.error("SEED_ADMIN_EMAIL is not set in .env.local");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle({ client: sql });

  const existing = await db
    .select()
    .from(allowedEmail)
    .where(eq(allowedEmail.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.log(`${email} is already whitelisted.`);
    return;
  }

  await db.insert(allowedEmail).values({
    id: randomUUID(),
    email,
  });

  console.log(`Whitelisted ${email} as seed admin.`);
  console.log(
    "Sign in with this email — you'll need to manually set role='admin' on the user row after first sign-in,",
    "or run: UPDATE \"user\" SET role='admin' WHERE email='${email}'"
  );
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
