const HEX = "0123456789ABCDEF";

export function randomHex(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) {
    out += HEX[byte % HEX.length];
  }
  return out;
}

/** Referral codes look like `WM-A1B2C3`. */
export function generateReferralCode(): string {
  return `WM-${randomHex(6)}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Paystack references must be unique and URL safe. */
export function generatePaymentReference(orderId: string): string {
  return `wm_${orderId.replace(/-/g, "").slice(0, 12)}_${Date.now()}`;
}

export function monthKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function dayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${monthKey(timestamp)}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function weekKey(timestamp: number): string {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - ((day + 6) % 7)));
  return monthKey(monday.getTime());
}
