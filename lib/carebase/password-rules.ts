/**
 * Shared password rules for the invite onboarding password-setup step.
 *
 * Deliberately free of `server-only` so the client form can import the exact
 * same rules it validates against, keeping client and server behavior aligned.
 */

export const PASSWORD_MIN_LENGTH = 8;

export type PasswordRuleId = "length" | "letter" | "number";

export const PASSWORD_RULES: { id: PasswordRuleId; label: string }[] = [
  { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters` },
  { id: "letter", label: "Contains a letter" },
  { id: "number", label: "Contains a number" },
];

/** Live pass/fail state for rendering the rule checklist while typing. */
export function passwordRuleState(password: string): Record<PasswordRuleId, boolean> {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    letter: /[a-zA-Z]/.test(password),
    number: /[0-9]/.test(password),
  };
}

/** Returns a user-friendly error for the password field, or null when valid. */
export function validatePassword(password: string): string | null {
  if (!password) return "Enter a password.";
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[a-zA-Z]/.test(password)) return "Include at least one letter.";
  if (!/[0-9]/.test(password)) return "Include at least one number.";
  return null;
}

export function validatePasswordConfirmation(
  password: string,
  confirmPassword: string,
): string | null {
  if (!confirmPassword) return "Re-enter your password.";
  if (password !== confirmPassword) return "Passwords do not match.";
  return null;
}
