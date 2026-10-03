import type { Appearance } from "@clerk/types";

/**
 * Shared appearance for the sign-in and sign-up cards so both pages render the
 * same clean, card-less form used across CareBase. The CareBase wordmark lives
 * in the brand panel (`app/(auth)/layout.tsx`), so Clerk's own logo is hidden
 * here to avoid showing it twice.
 */
export const authAppearance: Appearance = {
  layout: {
    // CareBase logo shown above the "Welcome Back" / "Create your account"
    // headings on both cards.
    logoPlacement: "outside",
    logoImageUrl: "/carebase-logo.png",
    logoLinkUrl: "/",
    socialButtonsVariant: "blockButton",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full !border-0 !shadow-none !ring-0 !outline-none",
    card: "w-full !border-0 !bg-transparent !p-0 !shadow-none !ring-0",
    logoBox: "mb-5 flex justify-center",
    logoImage: "h-24 w-auto object-contain",
    header: "mb-6 text-center",
    headerTitle: "text-[26px] font-semibold tracking-[-0.02em] text-slate-900",
    headerSubtitle: "mt-1.5 text-sm text-slate-500",
    main: "w-full gap-5",
    form: "w-full gap-4",
    socialButtonsBlockButton:
      "h-11 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-none hover:bg-slate-50",
    socialButtonsBlockButtonText: "text-sm font-medium",
    socialButtonsProviderIcon: "size-[18px]",
    dividerLine: "bg-slate-200",
    dividerText: "text-[11px] font-medium uppercase tracking-wide text-slate-400",
    formFieldLabel: "text-[13px] font-medium text-slate-700",
    formFieldInput:
      "h-11 rounded-lg border border-slate-200 bg-slate-50/70 text-sm text-slate-900 shadow-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]",
    formFieldInputShowPasswordButton: "text-slate-400 hover:text-slate-600",
    formFieldAction: "text-xs font-semibold text-[#2563eb] hover:text-[#1d4ed8]",
    formButtonPrimary:
      "h-11 w-full rounded-lg bg-[#2563eb] text-sm font-semibold text-white shadow-none hover:bg-[#1d4ed8] focus:ring-[#2563eb]",
    identityPreviewText: "text-sm text-slate-700",
    identityPreviewEditButton: "text-xs font-semibold text-[#2563eb]",
    formResendCodeLink: "text-[#2563eb] hover:text-[#1d4ed8]",
    otpCodeFieldInput: "border border-slate-200",
    alertText: "text-sm text-slate-600",
    footer: "mt-6",
    footerActionText: "text-xs text-slate-500",
    footerActionLink: "text-xs font-semibold text-[#2563eb] hover:text-[#1d4ed8]",
  },
};