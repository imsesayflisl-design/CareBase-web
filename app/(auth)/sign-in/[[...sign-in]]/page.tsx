import { SignIn } from "@clerk/nextjs";

import { authAppearance } from "../../clerk-appearance";

export default function Page() {
  return <SignIn signUpUrl="/sign-up" appearance={authAppearance} />;
}
