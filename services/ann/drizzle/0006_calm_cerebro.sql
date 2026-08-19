CREATE TYPE "public"."organism_status" AS ENUM('draft', 'active', 'paused', 'deprecated', 'extinct');--> statement-breakpoint
CREATE TYPE "public"."organism_visibility" AS ENUM('public', 'unlisted', 'private');--> statement-breakpoint
CREATE TYPE "public"."ann_proposal_kind" AS ENUM('general', 'treasury-spend', 'ecosystem-grant', 'parameter-change');--> statement-breakpoint
CREATE TYPE "public"."ann_proposal_status" AS ENUM('open', 'passed', 'rejected', 'expired', 'executed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ann_vote_choice" AS ENUM('yes', 'no', 'abstain');--> statement-breakpoint
CREATE TABLE "organism_fitness_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organism_id" uuid NOT NULL,
	"generation" integer NOT NULL,
	"fitness" double precision NOT NULL,
	"components" jsonb NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organism_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organism_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"written_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "organism_memories_kind_check" CHECK (kind IN ('short_term','long_term','episodic'))
);
--> statement-breakpoint
CREATE TABLE "organisms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"creator_id" uuid NOT NULL,
	"visibility" "organism_visibility" NOT NULL,
	"status" "organism_status" DEFAULT 'draft' NOT NULL,
	"kind" text NOT NULL,
	"genome" jsonb NOT NULL,
	"environment" jsonb NOT NULL,
	"objective" jsonb NOT NULL,
	"fitness" double precision,
	"parent_id" uuid,
	"root_id" uuid NOT NULL,
	"generation" integer DEFAULT 0 NOT NULL,
	"compute_consumed" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"birth_at" timestamp with time zone,
	"death_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "organisms_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ann_proposal_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"voter_user_id" uuid NOT NULL,
	"weight_qubic" bigint NOT NULL,
	"choice" "ann_vote_choice" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ann_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "ann_proposal_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"proposer_user_id" uuid NOT NULL,
	"proposer_stake_qubic" bigint NOT NULL,
	"destination_address" text,
	"amount_qubic" bigint,
	"parameter_change" jsonb,
	"voting_deadline_at" timestamp with time zone NOT NULL,
	"status" "ann_proposal_status" DEFAULT 'open' NOT NULL,
	"yes_weight_qubic" bigint NOT NULL,
	"no_weight_qubic" bigint NOT NULL,
	"abstain_weight_qubic" bigint NOT NULL,
	"quorum_qubic" bigint NOT NULL,
	"execution_nonce" integer,
	"finalised_at" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organism_fitness_history" ADD CONSTRAINT "organism_fitness_history_organism_id_organisms_id_fk" FOREIGN KEY ("organism_id") REFERENCES "public"."organisms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organism_memories" ADD CONSTRAINT "organism_memories_organism_id_organisms_id_fk" FOREIGN KEY ("organism_id") REFERENCES "public"."organisms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisms" ADD CONSTRAINT "organisms_parent_id_organisms_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."organisms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisms" ADD CONSTRAINT "organisms_root_id_organisms_id_fk" FOREIGN KEY ("root_id") REFERENCES "public"."organisms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ann_proposal_votes" ADD CONSTRAINT "ann_proposal_votes_proposal_id_ann_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."ann_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organism_fitness_history_organism_idx" ON "organism_fitness_history" USING btree ("organism_id","generation");--> statement-breakpoint
CREATE INDEX "organism_memories_organism_kind_idx" ON "organism_memories" USING btree ("organism_id","kind");--> statement-breakpoint
CREATE INDEX "organisms_creator_idx" ON "organisms" USING btree ("creator_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "organisms_parent_idx" ON "organisms" USING btree ("parent_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "organisms_root_idx" ON "organisms" USING btree ("root_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "organisms_status_idx" ON "organisms" USING btree ("status") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "ann_proposal_votes_proposal_idx" ON "ann_proposal_votes" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "ann_proposal_votes_voter_idx" ON "ann_proposal_votes" USING btree ("voter_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ann_proposal_votes_unique_idx" ON "ann_proposal_votes" USING btree ("proposal_id","voter_user_id");--> statement-breakpoint
CREATE INDEX "ann_proposals_kind_idx" ON "ann_proposals" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "ann_proposals_status_idx" ON "ann_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ann_proposals_proposer_idx" ON "ann_proposals" USING btree ("proposer_user_id");--> statement-breakpoint
CREATE INDEX "ann_proposals_deadline_idx" ON "ann_proposals" USING btree ("voting_deadline_at");