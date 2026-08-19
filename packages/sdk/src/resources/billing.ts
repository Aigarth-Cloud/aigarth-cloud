import { BaseResource, toQueryString } from "./_base.js";
import type {
  Plan,
  PlanTier,
  Subscription,
  SubscriptionStatus,
  PaymentMethod,
  Invoice,
  InvoiceDetail,
  PaymentResult,
  Credit,
  CreditListResponse,
  Coupon,
  CreditKind,
  CreditStatus,
  CouponKind,
} from "../types/billing.js";

/**
 * /v1/* — billing service.
 *
 *   const plans = await client.billing.plans.list();
 *   const sub = await client.billing.subscriptions.create({ plan_id: plans[0].id });
 *   const invoice = await client.billing.invoices.preview({ subscriptionId: sub.id });
 *   const result = await client.billing.invoices.pay(invoice.id, { method: "credits" });
 *
 * Billing follows a Stripe-style model:
 *  - buildPreview does NOT apply credits at generation
 *  - credits are consumed only at pay time
 *  - all amounts are QUBIC strings (smallest unit = 1)
 */
export class BillingResource extends BaseResource {
  // ============================================================================
  // Plans (public)
  // ============================================================================

  readonly plans = {
    list: (params?: { tier?: PlanTier }): Promise<{ data: Plan[] }> => {
      const query = params?.tier ? `?tier=${params.tier}` : "";
      return this.request<{ data: Plan[] }>(`/v1/plans${query}`, { method: "GET" });
    },

    retrieve: (id: string): Promise<Plan> =>
      this.request<Plan>(`/v1/plans/${encodeURIComponent(id)}`, { method: "GET" }),
  };

  // ============================================================================
  // Subscriptions
  // ============================================================================

  readonly subscriptions = {
    create: (params: {
      planId: string;
      paymentMethod?: PaymentMethod;
      qubicWalletId?: string;
      trial?: boolean;
    }): Promise<Subscription> =>
      this.request<Subscription>("/v1/subscriptions", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    list: (params?: { status?: SubscriptionStatus }): Promise<{ data: Subscription[] }> => {
      const query = toQueryString(params ?? {});
      return this.request<{ data: Subscription[] }>(`/v1/subscriptions${query}`, {
        method: "GET",
      });
    },

    retrieve: (id: string): Promise<Subscription> =>
      this.request<Subscription>(`/v1/subscriptions/${encodeURIComponent(id)}`, {
        method: "GET",
      }),

    changePlan: (id: string, params: { planId: string }): Promise<Subscription> =>
      this.request<Subscription>(`/v1/subscriptions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(params),
      }),

    cancel: (id: string): Promise<Subscription> =>
      this.request<Subscription>(`/v1/subscriptions/${encodeURIComponent(id)}/cancel`, {
        method: "POST",
      }),

    cancelAtPeriodEnd: (id: string): Promise<Subscription> =>
      this.request<Subscription>(
        `/v1/subscriptions/${encodeURIComponent(id)}/cancel-at-period-end`,
        { method: "POST" },
      ),
  };

  // ============================================================================
  // Invoices
  // ============================================================================

  readonly invoices = {
    list: (): Promise<{ data: Invoice[] }> =>
      this.request<{ data: Invoice[] }>("/v1/invoices", { method: "GET" }),

    retrieve: (id: string): Promise<InvoiceDetail> =>
      this.request<InvoiceDetail>(`/v1/invoices/${encodeURIComponent(id)}`, { method: "GET" }),

    /** Preview the next invoice (does NOT generate, does NOT apply credits). */
    preview: (params: { subscriptionId: string }): Promise<{
      subscription_id: string;
      period_index: number;
      period_start: string;
      period_end: string;
      subtotal_qubic: string;
      credit_available_qubic: string;
      credit_will_be_applied_qubic: string;
      tax_qubic: string;
      total_qubic: string;
      line_items: { kind: string; description: string; quantity: string; unit_price_qubic: string; amount_qubic: string }[];
    }> =>
      this.request(`/v1/invoices/preview?subscriptionId=${encodeURIComponent(params.subscriptionId)}`, {
        method: "GET",
      }),

    /** Generate the actual invoice for a subscription (admin / one-off). */
    generate: (params: { subscriptionId: string }): Promise<InvoiceDetail> =>
      this.request<InvoiceDetail>("/v1/invoices/generate", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    /** Pay an invoice. method: "credits" is the only path that consumes credits. */
    pay: (id: string, params: { method: PaymentMethod; tx_hash?: string }): Promise<PaymentResult> =>
      this.request<PaymentResult>(`/v1/invoices/${encodeURIComponent(id)}/pay`, {
        method: "POST",
        body: JSON.stringify(params),
      }),
  };

  // ============================================================================
  // Credits
  // ============================================================================

  readonly credits = {
    list: (): Promise<CreditListResponse> =>
      this.request<CreditListResponse>("/v1/credits", { method: "GET" }),

    redeemCoupon: (code: string): Promise<Credit> =>
      this.request<Credit>("/v1/credits/redeem", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),

    validateCoupon: (code: string): Promise<Coupon> =>
      this.request<Coupon>(
        `/v1/coupons/validate?code=${encodeURIComponent(code)}`,
        { method: "GET" },
      ),
  };

  // ============================================================================
  // Admin: coupons
  // ============================================================================

  readonly coupons = {
    create: (params: {
      code: string;
      name: string;
      kind: CouponKind;
      value: number;
      max_redemptions?: number;
      per_user_limit?: number;
      valid_until?: string;
    }): Promise<Coupon> =>
      this.request<Coupon>("/v1/admin/coupons", {
        method: "POST",
        body: JSON.stringify(params),
      }),
  };
}

// Re-export common types for convenience
export type {
  Plan,
  Subscription,
  Invoice,
  PaymentResult,
  Credit,
  CreditKind,
  CreditStatus,
  Coupon,
  SubscriptionStatus,
  PaymentMethod,
};
