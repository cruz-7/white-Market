import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import type { EmailConfig } from "@convex-dev/auth/server";
import { generateReferralCode } from "./lib/ids";

/**
 * Transactional email for password resets and email verification codes.
 *
 * With `RESEND_API_KEY` set the email is delivered by Resend. Without it the
 * verification link is written to the Convex function log instead, which keeps
 * local development usable without a mail provider.
 */
const emailProvider = {
  id: "resend",
  type: "email" as const,
  name: "Email",
  from: process.env.AUTH_EMAIL_FROM ?? "White Market <noreply@whitemarket.gh>",
  maxAge: 10 * 60,
  async sendVerificationRequest({
    identifier,
    url,
  }: {
    identifier: string;
    url: string;
  }): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      if (
        process.env.NODE_ENV === "production" ||
        process.env.REQUIRE_AUTH_EMAIL_PROVIDER === "true"
      ) {
        throw new Error("RESEND_API_KEY must be configured for production password reset emails");
      }
      console.log(`[auth] verification link for ${identifier}: ${url}`);
      return;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.AUTH_EMAIL_FROM ?? "White Market <noreply@whitemarket.gh>",
        to: [identifier],
        subject: "Your White Market verification link",
        html: `<p>Use the link below to continue. It expires in 10 minutes.</p><p><a href="${url}">Continue</a></p>`,
      }),
    });

    if (!response.ok) {
      console.error("[auth] failed to send verification email", response.status, await response.text());
    }
  },
} satisfies Partial<EmailConfig>;

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      /**
       * Runs for every password flow. It is the single place where the
       * White Market profile row is seeded, so the `users` document always
       * exists with a role, a referral code and a wallet.
       */
      profile: (params) => {
        const email = typeof params.email === "string" ? params.email.trim().toLowerCase() : "";
        const fullName = typeof params.full_name === "string"
          ? params.full_name
          : typeof params.name === "string"
            ? params.name
            : undefined;
        const role = params.role === "seller" ? "seller" : "user";
        return {
          email,
          ...(fullName ? { name: fullName, full_name: fullName } : {}),
          role,
          referral_code: generateReferralCode(),
          platform_credit: 0,
          referral_earnings: 0,
          total_referral_credits: 0,
          qualified_buyer_referrals: 0,
          qualified_seller_referrals: 0,
          total_referrals: 0,
          referral_level: 0,
          account_weight: 0.3,
          verified: false,
          verification_status: "none",
          is_payout_frozen: false,
          fraud_flags: [],
        };
      },

      validatePasswordRequirements: (password) => {
        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters long");
        }
        if (!/[A-Z]/.test(password)) {
          throw new Error("Password must contain an uppercase letter");
        }
        if (!/[a-z]/.test(password)) {
          throw new Error("Password must contain a lowercase letter");
        }
        if (!/[0-9]/.test(password)) {
          throw new Error("Password must contain a number");
        }
      },

      /**
       * Enables the password-reset flow. Email verification on sign-up is
       * intentionally left off so campus users can sign up and trade
       * immediately; verification is instead handled by the student
       * verification flow (see `convex/functions/verification.ts`).
       */
      reset: emailProvider,
    }),
  ],
});
