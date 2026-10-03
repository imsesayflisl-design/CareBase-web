# Show “CareBase” (not “Clerk”) on the Google sign-in screen

When a user clicks **Continue with Google**, Google shows its own account-chooser
screen: “Choose an account — to continue to **Clerk**” with the Clerk logo.

That name and logo are **not rendered by this app**, so they cannot be changed in
code. Google draws that screen from the **OAuth client** that performs the
Google sign-in. Because this Clerk instance still uses Clerk's preconfigured
**shared OAuth credentials**
(`devoted-bonefish-958.accounts.dev`, a development instance), the OAuth client
belongs to Clerk — so Google labels it “Clerk”.

## What was changed in code

`app/layout.tsx` now passes CareBase branding to every Clerk-rendered surface:

```tsx
<ClerkProvider
  afterSignOutUrl="/"
  appearance={{
    baseTheme: shadcn,
    layout: {
      logoImageUrl: "/carebase-logo.png",
      logoLinkUrl: "/",
      unsafe_disableDevelopmentModeWarnings: true,
    },
  }}
>
```

This makes the CareBase logo (already stored at `public/carebase-logo.png` and
used across the site) the logo for the sign-in / sign-up cards, user profile and
account pages. It does **not** change Google's account-chooser screen.

## How to change “to continue to Clerk” → “to continue to CareBase”

Do this once in the Clerk Dashboard (+ Google Cloud Console). ≈15 minutes.

### Part A — Clerk Dashboard: application name

1. Open the [Clerk Dashboard](https://dashboard.clerk.com) and select the
   **CareBase** application.
2. Go to **Customize** (left sidebar).
3. Set the **Application name** to `CareBase`.
4. Upload the logo (`public/carebase-logo.png`) as the **Logo** and set the
   **Home URL** to your site URL.
5. Save. This updates Clerk's own pages, invitation e-mails and the “Secured by
   Clerk” attribution context.

### Part B — Google: show “CareBase” and its logo in the account chooser

Per the [Clerk Google guide](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google),
development instances may use shared credentials, but a custom app name/logo on
Google's screen requires **your own Google OAuth client**:

1. Open the [Google Cloud Console](https://console.cloud.google.com) and create
   (or select) a project, e.g. `CareBase`.
2. **APIs & Services → OAuth consent screen**:
   - User type: **External**
   - **App name:** `CareBase`
   - Upload the CareBase logo as the **App logo**
   - Support e-mail, developer contact, authorized domains, scopes
     (`openid`, `email`, `profile`), test users as needed.
   - For real users, publish the app (**In production** — Google verifies the
     name/logo/scopes first).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   (type: **Web application**).
4. In the Clerk Dashboard, go to **SSO connections → Add connection →
   For all users → Google**, toggle **Use custom credentials** **on**, and
   copy the **Authorized Redirect URI** Clerk shows you…
5. …then paste that URI into the Google client's **Authorized redirect URIs**,
   save, and copy the Google **Client ID** and **Client secret** back into
   Clerk. Save.

From then on, Google's chooser reads “to continue to **CareBase**” with the
CareBase logo — in development and in production. In production instances Clerk
requires custom credentials anyway, so this step also unblocks going live.

### Verify

1. Open the app's sign-in page in an incognito window.
2. Click **Continue with Google** → the chooser should read
   “to continue to **CareBase**” with the CareBase logo.
3. If it still says “Clerk”, the active Clerk instance is still on shared
   credentials — double-check that **Use custom credentials** is saved for the
   Google connection in the same Clerk application whose keys are in
   `.env.local` (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`).
