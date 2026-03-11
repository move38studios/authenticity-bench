import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { allowedEmail, user } from "../lib/db/schema";
import { randomUUID } from "crypto";

async function seed() {
  const email = process.env.SEED_ADMIN_EMAIL;
  if (!email) {
    console.error("SEED_ADMIN_EMAIL is not set in .env.local");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle({ client: sql });

  // Ensure email is whitelisted
  const existingAllowed = await db
    .select()
    .from(allowedEmail)
    .where(eq(allowedEmail.email, email))
    .limit(1);

  if (existingAllowed.length === 0) {
    await db.insert(allowedEmail).values({ id: randomUUID(), email });
    console.log(`Whitelisted ${email}.`);
  } else {
    console.log(`${email} already whitelisted.`);
  }

  // Promote to admin if user row exists (i.e. they've signed in before)
  const existingUser = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    if (existingUser[0].role === "admin") {
      console.log(`${email} is already admin.`);
    } else {
      await db
        .update(user)
        .set({ role: "admin" })
        .where(eq(user.email, email));
      console.log(`Promoted ${email} to admin.`);
    }
  } else {
    console.log(`User hasn't signed in yet. Run this script again after first sign-in to set admin role.`);
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
