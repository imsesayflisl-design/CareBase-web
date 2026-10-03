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
