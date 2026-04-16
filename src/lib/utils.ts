import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(" ");
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function generatePaymentMemo(date: Date, name: string): string {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const namePart = name.split(" ")[0].toUpperCase();
  return `BOBO-${dateStr}-${namePart}`;
}

const PLACEHOLDER_EMAIL_SUFFIX = "@placeholder.local";

/** True for system-generated placeholder emails (proxy-booked or imported). */
export function isPlaceholderEmail(email?: string | null): boolean {
  return !!email && email.endsWith(PLACEHOLDER_EMAIL_SUFFIX);
}

/**
 * User-facing display name for a customer.
 * Falls back to email-prefix for real emails. For placeholders, returns
 * phone (if available) or a localized "Unnamed guest" stand-in to avoid
 * leaking ugly `temp-XXX` strings into the UI.
 */
export function getCustomerDisplayName(user: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}): string {
  if (user.name) return user.name;
  if (user.email && !isPlaceholderEmail(user.email)) {
    return user.email.split("@")[0];
  }
  if (user.phone) return user.phone;
  return "(unnamed)";
}

