# Signup SMS and Welcome Email

The signup flow keeps Clerk responsible for generating and verifying phone codes. When Clerk delivery is disabled for an SMS template, Clerk sends the `sms.created` event to the app webhook, which forwards the E.164 number and Clerk-generated message through Africa's Talking.

## Environment variables

Add these to the local environment and deployment environment. Do not commit their values.

```env
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
AFRICASTALKING_USERNAME=...
AFRICASTALKING_API_KEY=...
AFRICASTALKING_SENDER_ID=...
AFRICASTALKING_ENV=sandbox
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=CareBase <hello@your-verified-domain.example>
RESEND_TEST_TO=your-test-address@example.com
```

`RESEND_TEST_TO` is used only by the development-only unauthenticated `POST /api/send` test route. It is a fixed server-side recipient; the route never accepts arbitrary recipients. Production requests still require an authenticated Clerk user and go to that user's primary email.

`AFRICASTALKING_SENDER_ID` is optional if the Africa's Talking account is configured to send without one. Set `AFRICASTALKING_ENV=production` only after the live account and Sierra Leone routes are enabled; it defaults to `sandbox`. The sender/domain must be enabled by the provider.

## Clerk webhook

Create a Clerk webhook endpoint at `https://<your-domain>/api/webhooks/clerk`, subscribe it to `sms.created` and `user.created`, and set its signing secret as `CLERK_WEBHOOK_SIGNING_SECRET`. For local testing, expose the development server through a secure tunnel and use that public URL.

In Clerk Dashboard, open the SMS verification template and turn **Delivered by Clerk** off. This is per template; only disable it after the webhook is deployed and tested, or users will not receive verification codes. Keep Clerk's phone-code verification enabled so Clerk still validates the code.

## Provider setup

The Africa's Talking account must have SMS delivery enabled for Sierra Leone and any required sender ID approved. Provider account coverage, route availability, and destination carrier support determine whether a number can receive a message; the application accepts international numbers in E.164 format but cannot override carrier restrictions.

Verify the sender domain in Resend and configure it as `RESEND_FROM_EMAIL`. The `user.created` webhook sends one thank-you email to the new user's primary email address. Accounts created without an email address are skipped.

To test the React email route locally, set `RESEND_TEST_TO` and `RESEND_FROM_EMAIL`, restart the dev server, then run `curl -X POST http://localhost:3000/api/send`. The route sends only to the configured test recipient in development.