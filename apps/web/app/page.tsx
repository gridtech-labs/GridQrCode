import { redirect } from "next/navigation";

/**
 * Root route — always redirect.
 * Middleware handles the real auth-based routing,
 * but this is a safe fallback.
 */
export default function RootPage() {
  redirect("/login");
}
