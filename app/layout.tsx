import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/themes";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { RevealBootstrap } from "@/components/reveal-bootstrap";
import { ScrollProgress } from "@/components/scroll-progress";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "CareBase | Hospital workspace",
  description: "The connected operating system for hospital care teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClerkProvider
          afterSignOutUrl="/"
          appearance={{
            baseTheme: shadcn,
            variables: {
              // @clerk/themes' shadcn theme passes the raw shadcn variables
              // (e.g. `--card: 0 0% 100%`) straight into color properties.
              // CSS rejects those as invalid colors, which makes every Clerk
              // surface (account popover, modals, …) render transparent.
              // Wrap them in `hsl()` to match how tailwind.config.ts consumes
              // the same variables.
              colorBackground: "hsl(var(--card))",
              colorText: "hsl(var(--card-foreground))",
              colorTextSecondary: "hsl(var(--muted-foreground))",
              colorNeutral: "hsl(var(--foreground))",
              colorPrimary: "hsl(var(--primary))",
              colorTextOnPrimaryBackground: "hsl(var(--primary-foreground))",
              colorDanger: "hsl(var(--destructive))",
              colorInputBackground: "hsl(var(--card))",
              colorInputText: "hsl(var(--card-foreground))",
            },
            elements: {
              // The shadcn theme points the scrim at `var(--color-black)`,
              // which is undefined here — so modal backdrops were see-through.
              modalBackdrop: "bg-slate-900/55",
              // Solid white account card with a soft gradient and elevation so
              // the profile details stay fully readable over any page content.
              userButtonPopoverCard:
                "bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] border-slate-200 shadow-xl shadow-slate-900/10",
              userButtonPopoverMain: "bg-transparent",
              userButtonPopoverActions: "bg-transparent",
              userButtonPopoverActionButton:
                "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
              userButtonPopoverFooter: "bg-transparent border-slate-200/80",
              userPreviewMainIdentifier: "text-slate-900",
              userPreviewSecondaryIdentifier: "text-slate-500",
            },
            layout: {
              // CareBase branding for every Clerk-rendered surface
              // (sign-in / sign-up cards, user profile, account portal, …).
              logoImageUrl: "/carebase-logo.png",
              logoLinkUrl: "/",
              unsafe_disableDevelopmentModeWarnings: true,
            },
          }}
          localization={{
            signIn: {
              start: {
                title: "Welcome Back",
                subtitle: "Please enter your details to continue",
              },
            },
            signUp: {
              start: {
                title: "Create your account",
                subtitle: "Start managing hospital care in minutes",
              },
            },
          }}
        >
          <RevealBootstrap />
          <ScrollProgress />
          {children}
          <Toaster richColors position="top-center" />
        </ClerkProvider>
      </body>
    </html>
  );
}
