import { findDeliverableCoach } from "@/lib/coaches";

export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const from =
      process.env.EMAIL_FROM || "Rolling Sparks <noreply@rollingsparks.org>";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error("Resend failed", response.status, body);
      throw new Error("Could not send email.");
    }
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(`[email] to=${to} subject=${subject}\n${text}`);
    return;
  }

  console.warn(
    `[email] RESEND_API_KEY is not set, so no email was sent. Subject: ${subject}`,
  );
}

export async function deliverToCoach({
  email,
  subject,
  text,
}: {
  email: string;
  subject: string;
  text: string;
}) {
  const coach = await findDeliverableCoach(email);
  if (!coach) {
    return;
  }
  await sendEmail({ to: coach.email, subject, text });
}
