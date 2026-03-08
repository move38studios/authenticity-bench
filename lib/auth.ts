import { betterAuth } from "better-auth";
import { admin, emailOTP } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/services/email";
import { isEmailAllowed } from "@/lib/services/whitelist";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: false,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/email-otp/send-verification-otp") {
        const email = ctx.body?.email;
        if (email) {
          const allowed = await isEmailAllowed(email);
          if (!allowed) {
            throw new APIError("FORBIDDEN", {
              message: "This email is not authorized to sign in.",
            });
          }
        }
      }
    }),
  },
  plugins: [
    admin({
      defaultRole: "user",
    }),
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      async sendVerificationOTP({ email, otp, type }) {
        if (type === "sign-in") {
          await sendEmail({
            to: email,
            subject: `Your sign-in code: ${otp}`,
            html: `
              <div style="font-family: 'Georgia', serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
                <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 24px;">Authenticity Bench</h2>
                <p style="color: #374151; margin-bottom: 16px;">Your sign-in code is:</p>
                <p style="font-size: 32px; font-weight: 700; letter-spacing: 4px; margin: 24px 0;">${otp}</p>
                <p style="color: #6b7280; font-size: 14px;">This code expires in 5 minutes.</p>
              </div>
            `,
          });
        }
      },
    }),
  ],
});
