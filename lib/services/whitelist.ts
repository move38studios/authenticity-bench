import { db } from "@/lib/db";
import { allowedEmail } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";

export async function isEmailAllowed(email: string): Promise<boolean> {
  const domain = email.split("@")[1];

  const matches = await db
    .select()
    .from(allowedEmail)
    .where(or(eq(allowedEmail.email, email), eq(allowedEmail.domain, domain)))
    .limit(1);

  return matches.length > 0;
}

export async function shouldMakeAdmin(email: string): Promise<boolean> {
  const match = await db
    .select({ makeAdmin: allowedEmail.makeAdmin })
    .from(allowedEmail)
    .where(eq(allowedEmail.email, email))
    .limit(1);

  return match.length > 0 && match[0].makeAdmin;
}
