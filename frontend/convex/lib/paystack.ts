import { requirePaystackSecretKey } from "./paystackMode";

const BASE_URL = "https://api.paystack.co";

export interface PaystackTransactionData {
  id: number;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  email?: string;
  authorization_url?: string;
  access_code?: string;
  metadata?: Record<string, unknown> | null;
}

export interface PaystackTransferRecipient {
  id: number;
  type: string;
  name: string;
  account_number: string;
  bank_code: string;
  recipient_code: string;
}

export interface PaystackTransfer {
  id: number;
  reference: string;
  status: string;
  amount: number;
  recipient: number;
  reason?: string;
}

function secretKey(): string {
  return requirePaystackSecretKey(
    process.env.PAYSTACK_SECRET_KEY,
    process.env.CONVEX_DEPLOYMENT ?? ""
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: T;
  };

  if (!response.ok || payload.status === false) {
    throw new Error(payload.message ?? `Paystack request failed (${response.status})`);
  }

  return payload.data as T;
}

export async function initializeTransaction(args: {
  email: string;
  /** Amount in pesewas. */
  amount: number;
  currency: string;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackTransactionData> {
  return request<PaystackTransactionData>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: args.email,
      amount: args.amount,
      currency: args.currency,
      reference: args.reference,
      callback_url: args.callbackUrl,
      metadata: args.metadata,
    }),
  });
}

export async function verifyTransaction(reference: string): Promise<PaystackTransactionData> {
  return request<PaystackTransactionData>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

export async function createTransferRecipient(args: {
  type: "mobile_money" | "bank";
  name: string;
  accountNumber: string;
  bankCode: string;
  currency?: string;
}): Promise<PaystackTransferRecipient> {
  return request<PaystackTransferRecipient>("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type: args.type,
      name: args.name,
      account_number: args.accountNumber,
      bank_code: args.bankCode,
      currency: args.currency ?? "GHS",
    }),
  });
}

export async function sendTransfer(args: {
  /** Amount in pesewas. */
  amount: number;
  recipient: string;
  reason?: string;
}): Promise<PaystackTransfer> {
  return request<PaystackTransfer>("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: args.amount,
      recipient: args.recipient,
      reason: args.reason,
    }),
  });
}

export async function getBalance(currency = "GHS"): Promise<{ balance: number; currency: string }> {
  return request<{ balance: number; currency: string }>(`/balance/${currency}`);
}
