import { SignUp } from "@clerk/nextjs";

import { authAppearance } from "../../clerk-appearance";

export default function Page() {
  return <SignUp signInUrl="/sign-in" appearance={authAppearance} />;
}
