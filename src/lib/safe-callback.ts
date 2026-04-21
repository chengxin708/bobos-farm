/**
 * Validate a `callbackUrl` query param for a customer-facing login
 * redirect. Guards against open-redirect attacks by:
 *   - rejecting any URL that resolves off-origin
 *   - requiring the path to start with one of the customer flows we
 *     actually want to redirect into
 *
 * Unknown or unsafe values fall back to /reservations so the user still
 * lands somewhere sensible after auth.
 */
const CUSTOMER_PATH_ALLOWLIST = [
  "/booking",
  "/claim",
  "/reservations",
  "/inquiries",
] as const;

export const DEFAULT_CALLBACK = "/reservations";

export function safeCallbackUrl(
  raw: string | null | undefined,
  origin: string,
): string {
  if (!raw) return DEFAULT_CALLBACK;
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return DEFAULT_CALLBACK;

    const pathname = url.pathname;
    const matches = CUSTOMER_PATH_ALLOWLIST.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
    );
    if (!matches) return DEFAULT_CALLBACK;

    return pathname + url.search;
  } catch {
    return DEFAULT_CALLBACK;
  }
}
