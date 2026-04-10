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
