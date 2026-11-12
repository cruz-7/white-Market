export function requirePaystackSecretKey(
  key: string | undefined,
  deployment: string
): string {
  if (!key) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }

  const expectedPrefix = /^(dev|local):/.test(deployment)
    ? "sk_test_"
    : /^prod:/.test(deployment)
      ? "sk_live_"
      : null;

  if (!expectedPrefix) {
    throw new Error("Cannot determine the Paystack mode for this deployment");
  }
  if (!key.startsWith(expectedPrefix)) {
    const expectedMode = expectedPrefix === "sk_test_" ? "test" : "live";
    throw new Error(`PAYSTACK_SECRET_KEY must use Paystack ${expectedMode} mode for this deployment`);
  }

  return key;
}
