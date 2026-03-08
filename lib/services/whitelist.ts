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
