import { redirect } from "next/navigation";

/**
 * The pool used to live here as a single page. It is a set of tabs under /dashboard now, and this
 * path is kept because it is written into the README, the recorded walkthrough and anything
 * already shared.
 */
export default function AppRedirect() {
  redirect("/dashboard");
}
