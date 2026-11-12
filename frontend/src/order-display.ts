import { CreditCard, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type PaymentInfo = {
  icon?: LucideIcon;
  label: string;
  color: string;
};

export function getPaymentInfo(method?: string): PaymentInfo {
  switch (method) {
    case "card":
      return { icon: CreditCard, label: "Card payment", color: "text-blue-600" };
    case "wallet":
      return { icon: Shield, label: "Wallet payment", color: "text-purple-600" };
    default:
      return { label: "Payment method not recorded", color: "text-gray-500" };
  }
}
