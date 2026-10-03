import { randomUUID } from "node:crypto";
import { currentUser } from "@clerk/nextjs/server";
import { EmailTemplate } from "../../../components/email-template";
import { Resend } from "resend";

export async function POST() {
  const user = await currentUser();
  const isDevelopmentTest = !user && process.env.NODE_ENV === "development";
  if (!user && !isDevelopmentTest) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const email = user
    ? user.primaryEmailAddress?.emailAddress
    : process.env.RESEND_TEST_TO;
  if (!email) {
    const status = isDevelopmentTest ? 500 : 400;
    const error = isDevelopmentTest
      ? "Set RESEND_TEST_TO to a fixed test recipient for local curl testing."
      : "Your account has no primary email address.";
    return Response.json({ error }, { status });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return Response.json({ error: "Email delivery is not configured." }, { status: 500 });
  }

  const idempotencyKey = user
    ? `react-welcome/${user.id}`
    : `react-welcome/test/${randomUUID()}`;

  let result;
  try {
    result = await new Resend(apiKey).emails.send(
      {
        from,
        to: [email],
        subject: "Thank you for joining CareBase",
        react: EmailTemplate({ firstName: user?.firstName?.trim() || "there" }),
      },
      { idempotencyKey },
    );
  } catch (error) {
    console.error(
      "Resend request failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json({ error: "Email delivery failed." }, { status: 502 });
  }

  const { data, error } = result;
  if (error) {
    console.error("Welcome email delivery failed:", error.message);
    return Response.json({ error: "Email delivery failed." }, { status: 502 });
  }

  return Response.json(data);
}