CREATE TYPE "public"."network" AS ENUM('mainnet', 'testnet');--> statement-breakpoint
CREATE TYPE "public"."reward_status" AS ENUM('accruing', 'claimable', 'claimed', 'forfeited');--> statement-breakpoint
CREATE TYPE "public"."stake_status" AS ENUM('pending_signature', 'pending_broadcast', 'broadcast', 'confirming', 'active', 'unstaking', 'released', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transaction_direction" AS ENUM('inbound', 'outbound', 'internal');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('queued', 'broadcast', 'confirmed', 'finalized', 'failed', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."treasury_movement_kind" AS ENUM('stake_fee', 'unstake_payout', 'reward_payout', 'deposit', 'withdrawal');--> statement-breakpoint
CREATE TABLE "qubic_audit_logs" (
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
CREATE TABLE "epoch_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"epoch" integer NOT NULL,
	"network" "network" NOT NULL,
	"total_staked_qubic" bigint NOT NULL,
	"total_rewards_qubic" bigint NOT NULL,
	"active_stakers" integer DEFAULT 0 NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qubic_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"balance_qubic" bigint NOT NULL,
	"tick_number" integer DEFAULT 0 NOT NULL,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qubic_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"qubic_address" text NOT NULL,
	"identity_link_id" uuid NOT NULL,
	"network" "network" DEFAULT 'testnet' NOT NULL,
	"stake_authorized" boolean DEFAULT false NOT NULL,
	"stake_authorization_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stake_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"epoch" integer NOT NULL,
	"amount_qubic" bigint NOT NULL,
	"status" "reward_status" DEFAULT 'accruing' NOT NULL,
	"claimed_at" timestamp with time zone,
	"claim_tx_hash" text
);
--> statement-breakpoint
CREATE TABLE "stakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"principal_qubic" bigint NOT NULL,
	"start_epoch" integer NOT NULL,
	"epochs_locked" integer DEFAULT 1 NOT NULL,
	"status" "stake_status" DEFAULT 'pending_signature' NOT NULL,
	"signed_tick" integer,
	"confirmed_tick" integer,
	"intent_hash" text,
	"tx_hash" text,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref_type" text,
	"ref_id" text,
	"tx_hash" text,
	"from_address" text,
	"to_address" text,
	"amount_qubic" bigint NOT NULL,
	"direction" "transaction_direction" NOT NULL,
	"status" "transaction_status" DEFAULT 'queued' NOT NULL,
	"tick_number" integer,
	"raw_payload" jsonb,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "treasury_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "treasury_movement_kind" NOT NULL,
	"amount_qubic" bigint NOT NULL,
	"counterparty" text,
	"signers_approved" integer DEFAULT 0 NOT NULL,
	"signers_required" integer DEFAULT 1 NOT NULL,
	"tx_hash" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"executed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "validators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"computor_index" integer NOT NULL,
	"qubic_address" text NOT NULL,
	"alias" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"performance_score" integer,
	"stake_qubic" bigint NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "qubic_balances" ADD CONSTRAINT "qubic_balances_wallet_id_qubic_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."qubic_wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_stake_id_stakes_id_fk" FOREIGN KEY ("stake_id") REFERENCES "public"."stakes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakes" ADD CONSTRAINT "stakes_wallet_id_qubic_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."qubic_wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "qubic_audit_logs_actor_idx" ON "qubic_audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "qubic_audit_logs_action_idx" ON "qubic_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "qubic_audit_logs_created_idx" ON "qubic_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "epoch_snapshots_epoch_idx" ON "epoch_snapshots" USING btree ("epoch","network");--> statement-breakpoint
CREATE UNIQUE INDEX "qubic_balances_wallet_idx" ON "qubic_balances" USING btree ("wallet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "qubic_wallets_user_addr_idx" ON "qubic_wallets" USING btree ("user_id","qubic_address");--> statement-breakpoint
CREATE INDEX "qubic_wallets_addr_idx" ON "qubic_wallets" USING btree ("qubic_address");--> statement-breakpoint
CREATE UNIQUE INDEX "rewards_stake_epoch_idx" ON "rewards" USING btree ("stake_id","epoch");--> statement-breakpoint
CREATE INDEX "rewards_user_idx" ON "rewards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stakes_user_idx" ON "stakes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stakes_status_idx" ON "stakes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stakes_wallet_idx" ON "stakes" USING btree ("wallet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_tx_hash_idx" ON "transactions" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "transactions_status_idx" ON "transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transactions_from_idx" ON "transactions" USING btree ("from_address");--> statement-breakpoint
CREATE INDEX "transactions_to_idx" ON "transactions" USING btree ("to_address");--> statement-breakpoint
CREATE INDEX "treasury_movements_kind_idx" ON "treasury_movements" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "validators_addr_idx" ON "validators" USING btree ("qubic_address");--> statement-breakpoint
CREATE UNIQUE INDEX "validators_computor_idx" ON "validators" USING btree ("computor_index");