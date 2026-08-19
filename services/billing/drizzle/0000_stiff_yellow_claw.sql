CREATE TYPE "public"."billing_coupon_kind" AS ENUM('percent_off', 'amount_off', 'free_period');--> statement-breakpoint
CREATE TYPE "public"."billing_coupon_status" AS ENUM('active', 'exhausted', 'expired', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."billing_credit_kind" AS ENUM('promo', 'grant', 'referral', 'refund', 'earned');--> statement-breakpoint
CREATE TYPE "public"."billing_credit_status" AS ENUM('active', 'exhausted', 'expired', 'void');--> statement-breakpoint
CREATE TYPE "public"."billing_invoice_status" AS ENUM('draft', 'open', 'paid', 'void', 'uncollectible', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."billing_payment_method" AS ENUM('qubic', 'credits', 'fiat');--> statement-breakpoint
CREATE TYPE "public"."billing_payment_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."billing_plan_tier" AS ENUM('free', 'pro', 'team', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."billing_subscription_status" AS ENUM('trialing', 'active', 'past_due', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "billing_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"org_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_coupon_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"credit_id" uuid,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"kind" "billing_coupon_kind" NOT NULL,
	"value" integer NOT NULL,
	"max_redemptions" integer DEFAULT 0 NOT NULL,
	"current_redemptions" integer DEFAULT 0 NOT NULL,
	"per_user_limit" integer DEFAULT 1 NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"status" "billing_coupon_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid,
	"kind" "billing_credit_kind" NOT NULL,
	"amount_qubic" bigint NOT NULL,
	"used_qubic" bigint NOT NULL,
	"source" text NOT NULL,
	"coupon_id" uuid,
	"status" "billing_credit_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"description" text NOT NULL,
	"quantity" bigint NOT NULL,
	"unit_price_qubic" bigint NOT NULL,
	"amount_qubic" bigint NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid,
	"subscription_id" uuid,
	"period_index" integer NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"status" "billing_invoice_status" DEFAULT 'open' NOT NULL,
	"subtotal_qubic" bigint NOT NULL,
	"credit_applied_qubic" bigint NOT NULL,
	"tax_qubic" bigint NOT NULL,
	"total_qubic" bigint NOT NULL,
	"paid_qubic" bigint NOT NULL,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid,
	"invoice_id" uuid,
	"method" "billing_payment_method" NOT NULL,
	"status" "billing_payment_status" DEFAULT 'pending' NOT NULL,
	"amount_qubic" bigint NOT NULL,
	"tx_hash" text,
	"credit_id" uuid,
	"external_id" text,
	"failure_reason" text,
	"refunded_amount_qubic" bigint NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"tier" "billing_plan_tier" NOT NULL,
	"monthly_price_qubic" bigint NOT NULL,
	"included_tokens" bigint NOT NULL,
	"overage_rate_qubic_per_1k" bigint NOT NULL,
	"signup_credits_qubic" bigint NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid,
	"plan_id" text NOT NULL,
	"status" "billing_subscription_status" DEFAULT 'active' NOT NULL,
	"payment_method" "billing_payment_method" DEFAULT 'qubic' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp with time zone,
	"qubic_wallet_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_coupon_redemptions" ADD CONSTRAINT "billing_coupon_redemptions_coupon_id_billing_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."billing_coupons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_coupon_redemptions" ADD CONSTRAINT "billing_coupon_redemptions_credit_id_billing_credits_id_fk" FOREIGN KEY ("credit_id") REFERENCES "public"."billing_credits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoice_items" ADD CONSTRAINT "billing_invoice_items_invoice_id_billing_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."billing_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."billing_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_invoice_id_billing_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."billing_invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_plan_id_billing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_audit_logs_actor_idx" ON "billing_audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "billing_audit_logs_action_idx" ON "billing_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "billing_audit_logs_created_idx" ON "billing_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "billing_coupon_redemptions_coupon_idx" ON "billing_coupon_redemptions" USING btree ("coupon_id");--> statement-breakpoint
CREATE INDEX "billing_coupon_redemptions_user_idx" ON "billing_coupon_redemptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_coupons_code_idx" ON "billing_coupons" USING btree ("code");--> statement-breakpoint
CREATE INDEX "billing_coupons_status_idx" ON "billing_coupons" USING btree ("status");--> statement-breakpoint
CREATE INDEX "billing_credits_user_idx" ON "billing_credits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "billing_credits_status_idx" ON "billing_credits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "billing_invoice_items_invoice_idx" ON "billing_invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "billing_invoice_items_kind_idx" ON "billing_invoice_items" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "billing_invoices_user_idx" ON "billing_invoices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "billing_invoices_status_idx" ON "billing_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "billing_invoices_sub_idx" ON "billing_invoices" USING btree ("subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_invoices_number_idx" ON "billing_invoices" USING btree ("number");--> statement-breakpoint
CREATE INDEX "billing_payments_user_idx" ON "billing_payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "billing_payments_invoice_idx" ON "billing_payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "billing_payments_status_idx" ON "billing_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "billing_plans_tier_idx" ON "billing_plans" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "billing_plans_active_idx" ON "billing_plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_user_idx" ON "billing_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_status_idx" ON "billing_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_plan_idx" ON "billing_subscriptions" USING btree ("plan_id");