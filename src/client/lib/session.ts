import { checkSession, onUnauthorized } from "./api";

export type AuthState = "checking" | "login" | "authed";

/**
 * Boot-time session probe: resolves to the initial auth state for the app
 * shell. Any later 401 from a gated call flips the app back to the login
 * screen via the onUnauthorized hook.
 */
export async function bootSession(onExpired: () => void): Promise<AuthState> {
  onUnauthorized(onExpired);
  try {
    return (await checkSession()) ? "authed" : "login";
  } catch {
    // Network failure — assume logged out; login will surface real errors.
    return "login";
  }
}
