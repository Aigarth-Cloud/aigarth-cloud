/**
 * Billing service types — plans, subscriptions, invoices, payments, credits, coupons.
 */

export type PlanTier = "free" | "pro" | "team" | "enterprise";

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  tier: PlanTier;
  monthly_price_qubic: string;
  included_tokens: string;
  overage_rate_qubic_per_1k: string;
  signup_credits_qubic: string;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled" | "expired";
export type PaymentMethod = "qubic" | "fiat" | "credits";

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  payment_method: PaymentMethod;
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  qubic_wallet_id: string | null;
  started_at: string;
}

export type InvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible" | "failed";

export interface Invoice {
  id: string;
  number: string;
  subscription_id: string | null;
  period_index: number;
  period_start: string;
  period_end: string;
  status: InvoiceStatus;
  subtotal_qubic: string;
  credit_applied_qubic: string;
  tax_qubic: string;
  total_qubic: string;
  paid_qubic: string;
  due_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  kind: string;
  description: string;
  quantity: string;
  unit_price_qubic: string;
  amount_qubic: string;
  metadata: Record<string, unknown> | null;
}

export interface InvoiceDetail extends Invoice {
  line_items: InvoiceItem[];
}

export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

export interface PaymentResult {
  payment_id: string;
  status: PaymentStatus;
  amount_qubic: string;
  tx_hash: string | null;
  invoice_paid: boolean;
}

export type CreditKind = "signup" | "coupon" | "refund" | "promo" | "manual";
export type CreditStatus = "active" | "exhausted" | "expired" | "void";

export interface Credit {
  id: string;
  kind: CreditKind;
  amount_qubic: string;
  used_qubic: string;
  remaining_qubic: string;
  source: string;
  coupon_id: string | null;
  status: CreditStatus;
  expires_at: string | null;
  created_at: string;
}

export interface CreditListResponse {
  active_total_qubic: string;
  data: Credit[];
}

export type CouponKind = "fixed_amount" | "percent_off";
export type CouponStatus = "active" | "exhausted" | "expired" | "disabled";

export interface Coupon {
  code: string;
  name: string;
  kind: CouponKind;
  value: number;
  max_redemptions: number | null;
  per_user_limit: number;
  valid_until: string | null;
  status: CouponStatus;
}
