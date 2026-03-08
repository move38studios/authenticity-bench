import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const fromAddress = `Authenticity Bench <${process.env.FROM_EMAIL}>`;

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  if (process.env.NODE_ENV === "development") {
    console.log(`\n--- EMAIL ---`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${html}`);
    console.log(`--- /EMAIL ---\n`);
    return;
  }

  return resend.emails.send({
    from: fromAddress,
    to,
    subject,
    html,
  });
}
