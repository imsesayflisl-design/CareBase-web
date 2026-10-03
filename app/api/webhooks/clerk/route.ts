import type { SMSWebhookEvent, UserWebhookEvent } from "@clerk/nextjs/server";
import { Resend } from "resend";
import { Webhook } from "svix";

type ClerkWebhookEvent = SMSWebhookEvent | UserWebhookEvent;

export async function POST(request: Request) {
  const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!signingSecret) {
    return Response.json({ error: "Webhook is not configured." }, { status: 500 });
  }

  const webhook = new Webhook(signingSecret);
  const payload = await request.text();
  let event: ClerkWebhookEvent;

  try {
    webhook.verify(payload, {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    });
    event = JSON.parse(payload) as ClerkWebhookEvent;
  } catch {
    return Response.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (event.type === "sms.created") {
    const username = process.env.AFRICASTALKING_USERNAME;
    const apiKey = process.env.AFRICASTALKING_API_KEY;
    const environment = process.env.AFRICASTALKING_ENV ?? "sandbox";
    if (!username || !apiKey) {
      return Response.json({ error: "SMS delivery is not configured." }, { status: 500 });
    }
    if (environment !== "sandbox" && environment !== "production") {
      return Response.json({ error: "Invalid SMS environment." }, { status: 500 });
    }

    const { to_phone_number: recipient, message } = event.data;
    if (!/^\+[1-9]\d{7,14}$/.test(recipient)) {
      return Response.json({ error: "Recipient must be an E.164 phone number." }, { status: 400 });
    }

    const sms = new URLSearchParams({ username, to: recipient, message });
    const senderId = process.env.AFRICASTALKING_SENDER_ID;
    if (senderId) sms.set("from", senderId);

    const apiUrl =
      environment === "production"
        ? "https://api.africastalking.com/version1/messaging"
        : "https://api.sandbox.africastalking.com/version1/messaging";
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        apiKey,
      },
      body: sms,
    });

    const delivery = (await response.json()) as {
      SMSMessageData?: { Recipients?: { statusCode?: number }[] };
    };
    const statusCode = delivery.SMSMessageData?.Recipients?.[0]?.statusCode;
    if (!response.ok || ![100, 101, 102].includes(statusCode ?? 0)) {
      console.error("Africa's Talking SMS request failed:", response.status);
      return Response.json({ error: "SMS delivery failed." }, { status: 502 });
    }

    return Response.json({ received: true });
  }

  if (event.type === "user.created") {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
      return Response.json({ error: "Email delivery is not configured." }, { status: 500 });
    }

    const user = event.data;
    const email = user.email_addresses.find(
      (address) => address.id === user.primary_email_address_id,
    )?.email_address;
    if (!email) return Response.json({ received: true, emailSkipped: true });

    const firstName = user.first_name?.trim();
    const greeting = firstName ? `Hello ${firstName},` : "Hello,";
    const result = await new Resend(apiKey).emails.send(
      {
        from,
        to: email,
        subject: "Thank you for joining CareBase",
        text: `${greeting}\n\nThank you for creating your CareBase account. We're glad you're here.\n\nThe CareBase team`,
        html: "<p>Hello,</p><p>Thank you for creating your CareBase account. We're glad you're here.</p><p>The CareBase team</p>",
      },
      { idempotencyKey: `welcome-user/${user.id}` },
    );

    if (result.error) {
      console.error("Welcome email delivery failed:", result.error.message);
      return Response.json({ error: "Email delivery failed." }, { status: 502 });
    }
  }

  return Response.json({ received: true });
}