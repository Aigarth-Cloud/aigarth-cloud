import { pgTable, index, foreignKey, uuid, text, bigint, boolean, timestamp, uniqueIndex, jsonb, integer, numeric, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const annDeploymentStatus = pgEnum("ann_deployment_status", ['pending', 'deploying', 'running', 'stopped', 'failed'])
export const annLicenseGrantStatus = pgEnum("ann_license_grant_status", ['active', 'revoked', 'expired'])
export const annLicenseKind = pgEnum("ann_license_kind", ['open', 'commercial', 'restricted', 'custom'])
export const annStatus = pgEnum("ann_status", ['draft', 'published', 'deprecated', 'suspended'])
export const annVisibility = pgEnum("ann_visibility", ['public', 'unlisted', 'private'])
export const apiKeyStatus = pgEnum("api_key_status", ['active', 'rotated', 'revoked'])
export const auditAction = pgEnum("audit_action", ['user.created', 'user.email_verified', 'user.password_changed', 'user.suspended', 'user.deleted', 'session.created', 'session.revoked', 'org.created', 'org.member_added', 'org.member_removed', 'org.role_changed', 'api_key.created', 'api_key.rotated', 'api_key.revoked', 'wallet.linked', 'wallet.unlinked', 'mfa.enrolled', 'mfa.removed', 'login.succeeded', 'login.failed'])
export const billingCouponKind = pgEnum("billing_coupon_kind", ['percent_off', 'amount_off', 'free_period'])
export const billingCouponStatus = pgEnum("billing_coupon_status", ['active', 'exhausted', 'expired', 'disabled'])
export const billingCreditKind = pgEnum("billing_credit_kind", ['promo', 'grant', 'referral', 'refund', 'earned'])
export const billingCreditStatus = pgEnum("billing_credit_status", ['active', 'exhausted', 'expired', 'void'])
export const billingInvoiceStatus = pgEnum("billing_invoice_status", ['draft', 'open', 'paid', 'void', 'uncollectible', 'overdue'])
export const billingPaymentMethod = pgEnum("billing_payment_method", ['qubic', 'credits', 'fiat'])
export const billingPaymentStatus = pgEnum("billing_payment_status", ['pending', 'succeeded', 'failed', 'refunded'])
export const billingPlanTier = pgEnum("billing_plan_tier", ['free', 'pro', 'team', 'enterprise'])
export const billingSubscriptionStatus = pgEnum("billing_subscription_status", ['trialing', 'active', 'past_due', 'cancelled', 'expired'])
export const clusterMemberStatus = pgEnum("cluster_member_status", ['active', 'draining', 'removed'])
export const deploymentStatus = pgEnum("deployment_status", ['active', 'draining', 'offline'])
export const economyBundleListingKind = pgEnum("economy_bundle_listing_kind", ['collection', 'starter_pack', 'curated'])
export const economyContributorRole = pgEnum("economy_contributor_role", ['creator', 'co_creator', 'data_provider', 'curator', 'reviewer'])
export const economyLockStatus = pgEnum("economy_lock_status", ['observed', 'active', 'unlocking', 'ended', 'expired', 'failed'])
export const economyPayoutRecipientStatus = pgEnum("economy_payout_recipient_status", ['pending', 'broadcast', 'confirmed', 'failed', 'skipped'])
export const economyPayoutRunStatus = pgEnum("economy_payout_run_status", ['draft', 'pending', 'settling', 'settled', 'partial', 'failed', 'cancelled'])
export const gatewayApiKeyStatus = pgEnum("gateway_api_key_status", ['active', 'revoked'])
export const jobStatus = pgEnum("job_status", ['queued', 'submitted', 'running', 'completed', 'failed', 'cancelled'])
export const jobType = pgEnum("job_type", ['contract_call', 'training', 'inference', 'general'])
export const membershipRole = pgEnum("membership_role", ['owner', 'admin', 'member', 'viewer'])
export const mfaType = pgEnum("mfa_type", ['totp', 'webauthn'])
export const mktAuctionKind = pgEnum("mkt_auction_kind", ['dutch', 'english', 'sealed_bid'])
export const mktAuctionStatus = pgEnum("mkt_auction_status", ['scheduled', 'live', 'ended', 'settled', 'cancelled'])
export const mktBidStatus = pgEnum("mkt_bid_status", ['active', 'winning', 'outbid', 'won', 'lost', 'refunded'])
export const mktCapacityKind = pgEnum("mkt_capacity_kind", ['spot', 'reserved', 'futures'])
export const mktListingStatus = pgEnum("mkt_listing_status", ['draft', 'active', 'paused', 'sold_out', 'closed'])
export const mktListingVisibility = pgEnum("mkt_listing_visibility", ['public', 'unlisted'])
export const mktOfferStatus = pgEnum("mkt_offer_status", ['pending', 'accepted', 'rejected', 'cancelled', 'expired'])
export const mktPurchaseStatus = pgEnum("mkt_purchase_status", ['pending', 'completed', 'refunded', 'cancelled'])
export const mktReviewTarget = pgEnum("mkt_review_target", ['listing', 'auction', 'user'])
export const mktTissueAccess = pgEnum("mkt_tissue_access", ['open', 'licensed'])
export const modelStatus = pgEnum("model_status", ['active', 'deprecated', 'preview', 'offline'])
export const modelType = pgEnum("model_type", ['chat', 'embedding', 'image', 'audio', 'video'])
export const network = pgEnum("network", ['mainnet', 'testnet'])
export const reservationStatus = pgEnum("reservation_status", ['active', 'released', 'expired', 'cancelled'])
export const rewardStatus = pgEnum("reward_status", ['accruing', 'claimable', 'claimed', 'forfeited'])
export const stakeStatus = pgEnum("stake_status", ['pending_signature', 'pending_broadcast', 'broadcast', 'confirming', 'active', 'unstaking', 'released', 'failed', 'cancelled'])
export const tissueMemberRole = pgEnum("tissue_member_role", ['voting', 'veto', 'advisory'])
export const tissueStatus = pgEnum("tissue_status", ['draft', 'active', 'paused', 'deprecated'])
export const tissueVisibility = pgEnum("tissue_visibility", ['public', 'unlisted', 'private'])
export const transactionDirection = pgEnum("transaction_direction", ['inbound', 'outbound', 'internal'])
export const transactionStatus = pgEnum("transaction_status", ['queued', 'broadcast', 'confirmed', 'finalized', 'failed', 'dropped'])
export const treasuryMovementKind = pgEnum("treasury_movement_kind", ['stake_fee', 'unstake_payout', 'reward_payout', 'deposit', 'withdrawal'])
export const userStatus = pgEnum("user_status", ['active', 'suspended', 'pending_verification', 'deleted'])


export const mktBids = pgTable("mkt_bids", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	auctionId: uuid("auction_id").notNull(),
	bidderUserId: uuid("bidder_user_id").notNull(),
	bidderOrgId: uuid("bidder_org_id"),
	bidderName: text("bidder_name").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amountQubic: bigint("amount_qubic", { mode: "number" }).notNull(),
	status: mktBidStatus().default('active').notNull(),
	isWinning: boolean("is_winning").default(false).notNull(),
	sealedAt: timestamp("sealed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("mkt_bids_auction_idx").using("btree", table.auctionId.asc().nullsLast().op("uuid_ops")),
	index("mkt_bids_bidder_idx").using("btree", table.bidderUserId.asc().nullsLast().op("uuid_ops")),
	index("mkt_bids_winning_idx").using("btree", table.auctionId.asc().nullsLast().op("uuid_ops"), table.isWinning.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.auctionId],
			foreignColumns: [mktAuctions.id],
			name: "mkt_bids_auction_id_mkt_auctions_id_fk"
		}).onDelete("cascade"),
]);

export const mktAuctions = pgTable("mkt_auctions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	title: text().notNull(),
	description: text(),
	icon: text(),
	tags: jsonb().default([]).notNull(),
	sellerUserId: uuid("seller_user_id").notNull(),
	sellerOrgId: uuid("seller_org_id"),
	sellerName: text("seller_name").notNull(),
	regionId: uuid("region_id"),
	clusterId: uuid("cluster_id"),
	kind: mktAuctionKind().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	capacityAmountQubic: bigint("capacity_amount_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	startPriceQubic: bigint("start_price_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	minPriceQubic: bigint("min_price_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	decrementPerTickQubic: bigint("decrement_per_tick_qubic", { mode: "number" }),
	tickIntervalSeconds: integer("tick_interval_seconds"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	reservePriceQubic: bigint("reserve_price_qubic", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	currentPriceQubic: bigint("current_price_qubic", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	currentWinningBidQubic: bigint("current_winning_bid_qubic", { mode: "number" }),
	status: mktAuctionStatus().default('scheduled').notNull(),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }).notNull(),
	endsAt: timestamp("ends_at", { withTimezone: true, mode: 'string' }).notNull(),
	settledAt: timestamp("settled_at", { withTimezone: true, mode: 'string' }),
	winnerUserId: uuid("winner_user_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	winningBidQubic: bigint("winning_bid_qubic", { mode: "number" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("mkt_auctions_ends_idx").using("btree", table.endsAt.asc().nullsLast().op("timestamptz_ops")),
	index("mkt_auctions_kind_idx").using("btree", table.kind.asc().nullsLast().op("enum_ops")),
	index("mkt_auctions_seller_idx").using("btree", table.sellerUserId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("mkt_auctions_slug_idx").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	index("mkt_auctions_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
]);

export const organizations = pgTable("organizations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	isPersonal: boolean("is_personal").default(false).notNull(),
	avatarUrl: text("avatar_url"),
	billingEmail: text("billing_email"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	uniqueIndex("organizations_slug_lower_idx").using("btree", sql`lower(slug)`),
]);

export const apiKeys = pgTable("api_keys", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orgId: uuid("org_id").notNull(),
	createdByUserId: uuid("created_by_user_id").notNull(),
	prefix: text().notNull(),
	secretHash: text("secret_hash").notNull(),
	name: text().notNull(),
	scopes: jsonb().default([]).notNull(),
	status: apiKeyStatus().default('active').notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	rotatedToId: uuid("rotated_to_id"),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	revokedReason: text("revoked_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("api_keys_org_idx").using("btree", table.orgId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("api_keys_prefix_idx").using("btree", table.prefix.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "api_keys_org_id_organizations_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByUserId],
			foreignColumns: [users.id],
			name: "api_keys_created_by_user_id_users_id_fk"
		}),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, mode: 'string' }),
	name: text().notNull(),
	avatarUrl: text("avatar_url"),
	status: userStatus().default('pending_verification').notNull(),
	locale: text().default('en').notNull(),
	timezone: text().default('UTC').notNull(),
	signupIpHash: text("signup_ip_hash"),
	lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	uniqueIndex("users_email_lower_idx").using("btree", sql`lower(email)`),
	index("users_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
]);

export const auditLogs = pgTable("audit_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	actorUserId: uuid("actor_user_id"),
	orgId: uuid("org_id"),
	action: auditAction().notNull(),
	targetType: text("target_type"),
	targetId: text("target_id"),
	metadata: jsonb().default({}).notNull(),
	ipHash: text("ip_hash"),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("audit_logs_action_idx").using("btree", table.action.asc().nullsLast().op("enum_ops")),
	index("audit_logs_actor_idx").using("btree", table.actorUserId.asc().nullsLast().op("uuid_ops")),
	index("audit_logs_created_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("audit_logs_org_idx").using("btree", table.orgId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.actorUserId],
			foreignColumns: [users.id],
			name: "audit_logs_actor_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "audit_logs_org_id_organizations_id_fk"
		}),
]);

export const emailVerifications = pgTable("email_verifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	email: text().notNull(),
	tokenHash: text("token_hash").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	usedAt: timestamp("used_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "email_verifications_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const memberships = pgTable("memberships", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	orgId: uuid("org_id").notNull(),
	role: membershipRole().default('member').notNull(),
	scopes: jsonb().default([]).notNull(),
	invitedBy: uuid("invited_by"),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("memberships_org_idx").using("btree", table.orgId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("memberships_user_org_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.orgId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "memberships_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "memberships_org_id_organizations_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.invitedBy],
			foreignColumns: [users.id],
			name: "memberships_invited_by_users_id_fk"
		}),
]);

export const mfaCredentials = pgTable("mfa_credentials", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	type: mfaType().notNull(),
	label: text().notNull(),
	totpSecret: text("totp_secret"),
	webauthnCredentialId: text("webauthn_credential_id"),
	webauthnPublicKey: text("webauthn_public_key"),
	webauthnCounter: integer("webauthn_counter").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("mfa_credentials_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "mfa_credentials_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const passwordResets = pgTable("password_resets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	tokenHash: text("token_hash").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	usedAt: timestamp("used_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "password_resets_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const sessions = pgTable("sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	jti: text().notNull(),
	apiKeyId: uuid("api_key_id"),
	userAgent: text("user_agent"),
	ipHash: text("ip_hash"),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	revokedReason: text("revoked_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("sessions_jti_idx").using("btree", table.jti.asc().nullsLast().op("text_ops")),
	index("sessions_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "sessions_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const teams = pgTable("teams", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orgId: uuid("org_id").notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("teams_org_slug_idx").using("btree", table.orgId.asc().nullsLast().op("text_ops"), table.slug.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "teams_org_id_organizations_id_fk"
		}).onDelete("cascade"),
]);

export const userCredentials = pgTable("user_credentials", {
	userId: uuid("user_id").primaryKey().notNull(),
	passwordHash: text("password_hash").notNull(),
	hashParams: jsonb("hash_params").notNull(),
	changedAt: timestamp("changed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	mustChange: boolean("must_change").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_credentials_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const walletLinks = pgTable("wallet_links", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	qubicAddress: text("qubic_address").notNull(),
	lastNonce: text("last_nonce"),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("wallet_links_addr_idx").using("btree", table.qubicAddress.asc().nullsLast().op("text_ops")),
	uniqueIndex("wallet_links_user_addr_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.qubicAddress.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "wallet_links_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const qubicAuditLogs = pgTable("qubic_audit_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	actorUserId: uuid("actor_user_id"),
	orgId: uuid("org_id"),
	action: text().notNull(),
	targetType: text("target_type"),
	targetId: text("target_id"),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("qubic_audit_logs_action_idx").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("qubic_audit_logs_actor_idx").using("btree", table.actorUserId.asc().nullsLast().op("uuid_ops")),
	index("qubic_audit_logs_created_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
]);

export const computeJobs = pgTable("compute_jobs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	orgId: uuid("org_id"),
	clusterId: uuid("cluster_id"),
	regionId: uuid("region_id"),
	type: jobType().default('general').notNull(),
	contractIndex: integer("contract_index"),
	functionIndex: integer("function_index"),
	payload: jsonb().default({}).notNull(),
	priority: integer().default(5).notNull(),
	status: jobStatus().default('queued').notNull(),
	txHash: text("tx_hash"),
	submittedTick: integer("submitted_tick"),
	startedTick: integer("started_tick"),
	completedTick: integer("completed_tick"),
	result: jsonb(),
	errorMessage: text("error_message"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	creditUsedQubic: bigint("credit_used_qubic", { mode: "number" }),
	reservationId: uuid("reservation_id"),
	submittedAt: timestamp("submitted_at", { withTimezone: true, mode: 'string' }),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	deadlineAt: timestamp("deadline_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("compute_jobs_cluster_idx").using("btree", table.clusterId.asc().nullsLast().op("uuid_ops")),
	index("compute_jobs_region_idx").using("btree", table.regionId.asc().nullsLast().op("uuid_ops")),
	index("compute_jobs_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("compute_jobs_tx_hash_idx").using("btree", table.txHash.asc().nullsLast().op("text_ops")),
	index("compute_jobs_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.clusterId],
			foreignColumns: [computeClusters.id],
			name: "compute_jobs_cluster_id_compute_clusters_id_fk"
		}),
	foreignKey({
			columns: [table.regionId],
			foreignColumns: [computeRegions.id],
			name: "compute_jobs_region_id_compute_regions_id_fk"
		}),
]);

export const computeClusterMembers = pgTable("compute_cluster_members", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	clusterId: uuid("cluster_id").notNull(),
	computorIndex: integer("computor_index").notNull(),
	status: clusterMemberStatus().default('active').notNull(),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("compute_cluster_members_cluster_computor_idx").using("btree", table.clusterId.asc().nullsLast().op("int4_ops"), table.computorIndex.asc().nullsLast().op("int4_ops")),
	index("compute_cluster_members_computor_idx").using("btree", table.computorIndex.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.clusterId],
			foreignColumns: [computeClusters.id],
			name: "compute_cluster_members_cluster_id_compute_clusters_id_fk"
		}).onDelete("cascade"),
]);

export const computeClusters = pgTable("compute_clusters", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	regionId: uuid("region_id").notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	purpose: text().default('general').notNull(),
	minComputors: integer("min_computors").default(3).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("compute_clusters_region_idx").using("btree", table.regionId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("compute_clusters_region_slug_idx").using("btree", table.regionId.asc().nullsLast().op("text_ops"), table.slug.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.regionId],
			foreignColumns: [computeRegions.id],
			name: "compute_clusters_region_id_compute_regions_id_fk"
		}).onDelete("cascade"),
]);

export const validators = pgTable("validators", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	computorIndex: integer("computor_index").notNull(),
	qubicAddress: text("qubic_address").notNull(),
	alias: text(),
	isActive: boolean("is_active").default(true).notNull(),
	performanceScore: integer("performance_score"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	stakeQubic: bigint("stake_qubic", { mode: "number" }).notNull(),
	lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("validators_addr_idx").using("btree", table.qubicAddress.asc().nullsLast().op("text_ops")),
	uniqueIndex("validators_computor_idx").using("btree", table.computorIndex.asc().nullsLast().op("int4_ops")),
]);

export const gatewayRequests = pgTable("gateway_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	orgId: uuid("org_id"),
	apiKeyId: uuid("api_key_id"),
	model: text().notNull(),
	endpoint: text().notNull(),
	statusCode: integer("status_code").notNull(),
	durationMs: integer("duration_ms").notNull(),
	promptTokens: integer("prompt_tokens").default(0).notNull(),
	completionTokens: integer("completion_tokens").default(0).notNull(),
	totalTokens: integer("total_tokens").default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	costQubic: bigint("cost_qubic", { mode: "number" }).notNull(),
	ip: text(),
	userAgent: text("user_agent"),
	requestBody: jsonb("request_body"),
	responseBody: jsonb("response_body"),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("gateway_requests_created_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("gateway_requests_endpoint_idx").using("btree", table.endpoint.asc().nullsLast().op("text_ops")),
	index("gateway_requests_key_idx").using("btree", table.apiKeyId.asc().nullsLast().op("uuid_ops")),
	index("gateway_requests_model_idx").using("btree", table.model.asc().nullsLast().op("text_ops")),
	index("gateway_requests_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.apiKeyId],
			foreignColumns: [gatewayApiKeys.id],
			name: "gateway_requests_api_key_id_gateway_api_keys_id_fk"
		}).onDelete("set null"),
]);

export const billingPlans = pgTable("billing_plans", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	tier: billingPlanTier().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	monthlyPriceQubic: bigint("monthly_price_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	includedTokens: bigint("included_tokens", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	overageRateQubicPer1K: bigint("overage_rate_qubic_per_1k", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	signupCreditsQubic: bigint("signup_credits_qubic", { mode: "number" }).notNull(),
	features: jsonb().default([]).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	sortOrder: integer("sort_order").default(100).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("billing_plans_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("billing_plans_tier_idx").using("btree", table.tier.asc().nullsLast().op("enum_ops")),
]);

export const mktPurchases = pgTable("mkt_purchases", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	listingId: uuid("listing_id"),
	offerId: uuid("offer_id"),
	buyerUserId: uuid("buyer_user_id").notNull(),
	buyerOrgId: uuid("buyer_org_id"),
	sellerUserId: uuid("seller_user_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amountQubic: bigint("amount_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalPriceQubic: bigint("total_price_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	platformFeeQubic: bigint("platform_fee_qubic", { mode: "number" }).notNull(),
	status: mktPurchaseStatus().default('pending').notNull(),
	invoiceId: uuid("invoice_id"),
	computeJobId: uuid("compute_job_id"),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("mkt_purchases_buyer_idx").using("btree", table.buyerUserId.asc().nullsLast().op("uuid_ops")),
	index("mkt_purchases_listing_idx").using("btree", table.listingId.asc().nullsLast().op("uuid_ops")),
	index("mkt_purchases_seller_idx").using("btree", table.sellerUserId.asc().nullsLast().op("uuid_ops")),
	index("mkt_purchases_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.offerId],
			foreignColumns: [mktOffers.id],
			name: "mkt_purchases_offer_id_mkt_offers_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.listingId],
			foreignColumns: [mktListings.id],
			name: "mkt_purchases_listing_id_mkt_listings_id_fk"
		}).onDelete("set null"),
]);

export const mktListings = pgTable("mkt_listings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	title: text().notNull(),
	description: text(),
	icon: text(),
	tags: jsonb().default([]).notNull(),
	sellerUserId: uuid("seller_user_id").notNull(),
	sellerOrgId: uuid("seller_org_id"),
	sellerName: text("seller_name").notNull(),
	regionId: uuid("region_id"),
	clusterId: uuid("cluster_id"),
	kind: mktCapacityKind().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	capacityAmountQubic: bigint("capacity_amount_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	capacityRemainingQubic: bigint("capacity_remaining_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	pricePerUnitQubic: bigint("price_per_unit_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	durationSeconds: bigint("duration_seconds", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	minPurchaseQubic: bigint("min_purchase_qubic", { mode: "number" }).notNull(),
	status: mktListingStatus().default('draft').notNull(),
	visibility: mktListingVisibility().default('public').notNull(),
	totalOffers: integer("total_offers").default(0).notNull(),
	totalPurchases: integer("total_purchases").default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalRevenueQubic: bigint("total_revenue_qubic", { mode: "number" }).notNull(),
	ratingAverage: text("rating_average"),
	ratingCount: integer("rating_count").default(0).notNull(),
	unlocksAt: timestamp("unlocks_at", { withTimezone: true, mode: 'string' }),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("mkt_listings_kind_idx").using("btree", table.kind.asc().nullsLast().op("enum_ops")),
	index("mkt_listings_seller_idx").using("btree", table.sellerUserId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("mkt_listings_slug_idx").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	index("mkt_listings_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("mkt_listings_visibility_idx").using("btree", table.visibility.asc().nullsLast().op("enum_ops")),
]);

export const stakes = pgTable("stakes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	walletId: uuid("wallet_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	principalQubic: bigint("principal_qubic", { mode: "number" }).notNull(),
	startEpoch: integer("start_epoch").notNull(),
	epochsLocked: integer("epochs_locked").default(1).notNull(),
	status: stakeStatus().default('pending_signature').notNull(),
	signedTick: integer("signed_tick"),
	confirmedTick: integer("confirmed_tick"),
	intentHash: text("intent_hash"),
	txHash: text("tx_hash"),
	failureReason: text("failure_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	releasedAt: timestamp("released_at", { withTimezone: true, mode: 'string' }),
	receiverAddress: text("receiver_address").notNull(),
}, (table) => [
	index("stakes_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("stakes_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("stakes_wallet_idx").using("btree", table.walletId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.walletId],
			foreignColumns: [qubicWallets.id],
			name: "stakes_wallet_id_qubic_wallets_id_fk"
		}),
]);

export const transactions = pgTable("transactions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	refType: text("ref_type"),
	refId: text("ref_id"),
	txHash: text("tx_hash"),
	fromAddress: text("from_address"),
	toAddress: text("to_address"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amountQubic: bigint("amount_qubic", { mode: "number" }).notNull(),
	direction: transactionDirection().notNull(),
	status: transactionStatus().default('queued').notNull(),
	tickNumber: integer("tick_number"),
	rawPayload: jsonb("raw_payload"),
	failureReason: text("failure_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("transactions_from_idx").using("btree", table.fromAddress.asc().nullsLast().op("text_ops")),
	index("transactions_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("transactions_to_idx").using("btree", table.toAddress.asc().nullsLast().op("text_ops")),
	uniqueIndex("transactions_tx_hash_idx").using("btree", table.txHash.asc().nullsLast().op("text_ops")),
]);

export const rewards = pgTable("rewards", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	stakeId: uuid("stake_id").notNull(),
	userId: uuid("user_id").notNull(),
	epoch: integer().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amountQubic: bigint("amount_qubic", { mode: "number" }).notNull(),
	status: rewardStatus().default('accruing').notNull(),
	claimedAt: timestamp("claimed_at", { withTimezone: true, mode: 'string' }),
	claimTxHash: text("claim_tx_hash"),
}, (table) => [
	uniqueIndex("rewards_stake_epoch_idx").using("btree", table.stakeId.asc().nullsLast().op("int4_ops"), table.epoch.asc().nullsLast().op("int4_ops")),
	index("rewards_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.stakeId],
			foreignColumns: [stakes.id],
			name: "rewards_stake_id_stakes_id_fk"
		}).onDelete("cascade"),
]);

export const epochSnapshots = pgTable("epoch_snapshots", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	epoch: integer().notNull(),
	network: network().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalStakedQubic: bigint("total_staked_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalRewardsQubic: bigint("total_rewards_qubic", { mode: "number" }).notNull(),
	activeStakers: integer("active_stakers").default(0).notNull(),
	capturedAt: timestamp("captured_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("epoch_snapshots_epoch_idx").using("btree", table.epoch.asc().nullsLast().op("int4_ops"), table.network.asc().nullsLast().op("int4_ops")),
]);

export const gatewayRateLimits = pgTable("gateway_rate_limits", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	apiKeyId: uuid("api_key_id").notNull(),
	window: text().notNull(),
	requestCount: integer("request_count").default(0).notNull(),
	tokenCount: integer("token_count").default(0).notNull(),
}, (table) => [
	uniqueIndex("gateway_rate_limits_key_window_idx").using("btree", table.apiKeyId.asc().nullsLast().op("text_ops"), table.window.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.apiKeyId],
			foreignColumns: [gatewayApiKeys.id],
			name: "gateway_rate_limits_api_key_id_gateway_api_keys_id_fk"
		}).onDelete("cascade"),
]);

export const gatewayApiKeys = pgTable("gateway_api_keys", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	orgId: uuid("org_id"),
	name: text().notNull(),
	prefix: text().notNull(),
	secretHash: text("secret_hash").notNull(),
	secretLast4: text("secret_last4").notNull(),
	scopes: jsonb().default([]).notNull(),
	status: gatewayApiKeyStatus().default('active').notNull(),
	rateLimitRpm: integer("rate_limit_rpm"),
	rateLimitTpm: integer("rate_limit_tpm"),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	revokedReason: text("revoked_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("gateway_api_keys_prefix_idx").using("btree", table.prefix.asc().nullsLast().op("text_ops")),
	index("gateway_api_keys_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("gateway_api_keys_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
]);

export const treasuryMovements = pgTable("treasury_movements", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	kind: treasuryMovementKind().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amountQubic: bigint("amount_qubic", { mode: "number" }).notNull(),
	counterparty: text(),
	signersApproved: integer("signers_approved").default(0).notNull(),
	signersRequired: integer("signers_required").default(1).notNull(),
	txHash: text("tx_hash"),
	payload: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	executedAt: timestamp("executed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("treasury_movements_kind_idx").using("btree", table.kind.asc().nullsLast().op("enum_ops")),
]);

export const qubicBalances = pgTable("qubic_balances", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	walletId: uuid("wallet_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	balanceQubic: bigint("balance_qubic", { mode: "number" }).notNull(),
	tickNumber: integer("tick_number").default(0).notNull(),
	refreshedAt: timestamp("refreshed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("qubic_balances_wallet_idx").using("btree", table.walletId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.walletId],
			foreignColumns: [qubicWallets.id],
			name: "qubic_balances_wallet_id_qubic_wallets_id_fk"
		}).onDelete("cascade"),
]);

export const qubicWallets = pgTable("qubic_wallets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	qubicAddress: text("qubic_address").notNull(),
	identityLinkId: uuid("identity_link_id").notNull(),
	network: network().default('testnet').notNull(),
	stakeAuthorized: boolean("stake_authorized").default(false).notNull(),
	stakeAuthorizationExpiresAt: timestamp("stake_authorization_expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("qubic_wallets_addr_idx").using("btree", table.qubicAddress.asc().nullsLast().op("text_ops")),
	uniqueIndex("qubic_wallets_user_addr_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.qubicAddress.asc().nullsLast().op("text_ops")),
]);

export const computeReservations = pgTable("compute_reservations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	orgId: uuid("org_id"),
	qubicWalletId: uuid("qubic_wallet_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	principalQubic: bigint("principal_qubic", { mode: "number" }).notNull(),
	feeBps: integer("fee_bps").default(50).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	creditQubic: bigint("credit_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usedQubic: bigint("used_qubic", { mode: "number" }).notNull(),
	epochs: integer().notNull(),
	startEpoch: integer("start_epoch").notNull(),
	endEpoch: integer("end_epoch").notNull(),
	status: reservationStatus().default('active').notNull(),
	txHash: text("tx_hash"),
	releasedAt: timestamp("released_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("compute_reservations_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("compute_reservations_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
]);

export const computeRegions = pgTable("compute_regions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	description: text(),
	computorCount: integer("computor_count").default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("compute_regions_slug_idx").using("btree", table.slug.asc().nullsLast().op("text_ops")),
]);

export const computeAuditLogs = pgTable("compute_audit_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	actorUserId: uuid("actor_user_id"),
	orgId: uuid("org_id"),
	action: text().notNull(),
	targetType: text("target_type"),
	targetId: text("target_id"),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("compute_audit_logs_action_idx").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("compute_audit_logs_actor_idx").using("btree", table.actorUserId.asc().nullsLast().op("uuid_ops")),
	index("compute_audit_logs_created_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
]);

export const gatewayDeployments = pgTable("gateway_deployments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	modelId: text("model_id").notNull(),
	region: text().default('global').notNull(),
	clusterHint: text("cluster_hint"),
	status: deploymentStatus().default('active').notNull(),
	priority: integer().default(5).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("gateway_deployments_model_idx").using("btree", table.modelId.asc().nullsLast().op("text_ops")),
	index("gateway_deployments_region_idx").using("btree", table.region.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.modelId],
			foreignColumns: [gatewayModels.id],
			name: "gateway_deployments_model_id_gateway_models_id_fk"
		}).onDelete("cascade"),
]);

export const gatewayModels = pgTable("gateway_models", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	family: text().notNull(),
	type: modelType().notNull(),
	description: text(),
	contextWindow: integer("context_window").default(8192).notNull(),
	maxOutputTokens: integer("max_output_tokens").default(4096).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	inputCostQubic: bigint("input_cost_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	outputCostQubic: bigint("output_cost_qubic", { mode: "number" }).notNull(),
	status: modelStatus().default('active').notNull(),
	ownedBy: text("owned_by").default('aigarth').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("gateway_models_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("gateway_models_type_idx").using("btree", table.type.asc().nullsLast().op("enum_ops")),
]);

export const gatewayAuditLogs = pgTable("gateway_audit_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	actorUserId: uuid("actor_user_id"),
	orgId: uuid("org_id"),
	action: text().notNull(),
	targetType: text("target_type"),
	targetId: text("target_id"),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("gateway_audit_logs_action_idx").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("gateway_audit_logs_actor_idx").using("btree", table.actorUserId.asc().nullsLast().op("uuid_ops")),
	index("gateway_audit_logs_created_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
]);

export const billingPayments = pgTable("billing_payments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	orgId: uuid("org_id"),
	invoiceId: uuid("invoice_id"),
	method: billingPaymentMethod().notNull(),
	status: billingPaymentStatus().default('pending').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amountQubic: bigint("amount_qubic", { mode: "number" }).notNull(),
	txHash: text("tx_hash"),
	creditId: uuid("credit_id"),
	externalId: text("external_id"),
	failureReason: text("failure_reason"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	refundedAmountQubic: bigint("refunded_amount_qubic", { mode: "number" }).notNull(),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("billing_payments_invoice_idx").using("btree", table.invoiceId.asc().nullsLast().op("uuid_ops")),
	index("billing_payments_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("billing_payments_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [billingInvoices.id],
			name: "billing_payments_invoice_id_billing_invoices_id_fk"
		}).onDelete("set null"),
]);

export const billingInvoiceItems = pgTable("billing_invoice_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	invoiceId: uuid("invoice_id").notNull(),
	kind: text().notNull(),
	description: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	quantity: bigint({ mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	unitPriceQubic: bigint("unit_price_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amountQubic: bigint("amount_qubic", { mode: "number" }).notNull(),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("billing_invoice_items_invoice_idx").using("btree", table.invoiceId.asc().nullsLast().op("uuid_ops")),
	index("billing_invoice_items_kind_idx").using("btree", table.kind.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [billingInvoices.id],
			name: "billing_invoice_items_invoice_id_billing_invoices_id_fk"
		}).onDelete("cascade"),
]);

export const billingInvoices = pgTable("billing_invoices", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	orgId: uuid("org_id"),
	subscriptionId: uuid("subscription_id"),
	periodIndex: integer("period_index").notNull(),
	periodStart: timestamp("period_start", { withTimezone: true, mode: 'string' }).notNull(),
	periodEnd: timestamp("period_end", { withTimezone: true, mode: 'string' }).notNull(),
	status: billingInvoiceStatus().default('open').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	subtotalQubic: bigint("subtotal_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	creditAppliedQubic: bigint("credit_applied_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	taxQubic: bigint("tax_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalQubic: bigint("total_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	paidQubic: bigint("paid_qubic", { mode: "number" }).notNull(),
	dueAt: timestamp("due_at", { withTimezone: true, mode: 'string' }),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	voidedAt: timestamp("voided_at", { withTimezone: true, mode: 'string' }),
	number: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("billing_invoices_number_idx").using("btree", table.number.asc().nullsLast().op("text_ops")),
	index("billing_invoices_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("billing_invoices_sub_idx").using("btree", table.subscriptionId.asc().nullsLast().op("uuid_ops")),
	index("billing_invoices_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [billingSubscriptions.id],
			name: "billing_invoices_subscription_id_billing_subscriptions_id_fk"
		}).onDelete("set null"),
]);

export const billingSubscriptions = pgTable("billing_subscriptions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	orgId: uuid("org_id"),
	planId: text("plan_id").notNull(),
	status: billingSubscriptionStatus().default('active').notNull(),
	paymentMethod: billingPaymentMethod("payment_method").default('qubic').notNull(),
	trialEndsAt: timestamp("trial_ends_at", { withTimezone: true, mode: 'string' }),
	currentPeriodStart: timestamp("current_period_start", { withTimezone: true, mode: 'string' }).notNull(),
	currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: 'string' }).notNull(),
	cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
	cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: 'string' }),
	qubicWalletId: uuid("qubic_wallet_id"),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("billing_subscriptions_plan_idx").using("btree", table.planId.asc().nullsLast().op("text_ops")),
	index("billing_subscriptions_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("billing_subscriptions_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [billingPlans.id],
			name: "billing_subscriptions_plan_id_billing_plans_id_fk"
		}),
]);

export const billingCredits = pgTable("billing_credits", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	orgId: uuid("org_id"),
	kind: billingCreditKind().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amountQubic: bigint("amount_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usedQubic: bigint("used_qubic", { mode: "number" }).notNull(),
	source: text().notNull(),
	couponId: uuid("coupon_id"),
	status: billingCreditStatus().default('active').notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("billing_credits_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("billing_credits_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
]);

export const billingCouponRedemptions = pgTable("billing_coupon_redemptions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	couponId: uuid("coupon_id").notNull(),
	userId: uuid("user_id").notNull(),
	creditId: uuid("credit_id"),
	redeemedAt: timestamp("redeemed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("billing_coupon_redemptions_coupon_idx").using("btree", table.couponId.asc().nullsLast().op("uuid_ops")),
	index("billing_coupon_redemptions_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.couponId],
			foreignColumns: [billingCoupons.id],
			name: "billing_coupon_redemptions_coupon_id_billing_coupons_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.creditId],
			foreignColumns: [billingCredits.id],
			name: "billing_coupon_redemptions_credit_id_billing_credits_id_fk"
		}).onDelete("set null"),
]);

export const billingCoupons = pgTable("billing_coupons", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: text().notNull(),
	name: text().notNull(),
	description: text(),
	kind: billingCouponKind().notNull(),
	value: integer().notNull(),
	maxRedemptions: integer("max_redemptions").default(0).notNull(),
	currentRedemptions: integer("current_redemptions").default(0).notNull(),
	perUserLimit: integer("per_user_limit").default(1).notNull(),
	validFrom: timestamp("valid_from", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	validUntil: timestamp("valid_until", { withTimezone: true, mode: 'string' }),
	status: billingCouponStatus().default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("billing_coupons_code_idx").using("btree", table.code.asc().nullsLast().op("text_ops")),
	index("billing_coupons_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
]);

export const billingAuditLogs = pgTable("billing_audit_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	actorUserId: uuid("actor_user_id"),
	orgId: uuid("org_id"),
	action: text().notNull(),
	targetType: text("target_type"),
	targetId: text("target_id"),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("billing_audit_logs_action_idx").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("billing_audit_logs_actor_idx").using("btree", table.actorUserId.asc().nullsLast().op("uuid_ops")),
	index("billing_audit_logs_created_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
]);

export const annLicensesGranted = pgTable("ann_licenses_granted", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	annId: uuid("ann_id").notNull(),
	licenseId: uuid("license_id").notNull(),
	userId: uuid("user_id").notNull(),
	orgId: uuid("org_id"),
	status: annLicenseGrantStatus().default('active').notNull(),
	grantedAt: timestamp("granted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	callCount: bigint("call_count", { mode: "number" }).notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	revokedReason: text("revoked_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ann_licenses_granted_ann_idx").using("btree", table.annId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("ann_licenses_granted_ann_user_idx").using("btree", table.annId.asc().nullsLast().op("uuid_ops"), table.userId.asc().nullsLast().op("uuid_ops")),
	index("ann_licenses_granted_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("ann_licenses_granted_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.annId],
			foreignColumns: [anns.id],
			name: "ann_licenses_granted_ann_id_anns_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.licenseId],
			foreignColumns: [annLicenses.id],
			name: "ann_licenses_granted_license_id_ann_licenses_id_fk"
		}).onDelete("restrict"),
]);

export const annLicenses = pgTable("ann_licenses", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	description: text(),
	kind: annLicenseKind().notNull(),
	terms: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	pricePerCallQubic: bigint("price_per_call_qubic", { mode: "number" }).notNull(),
	revenueShareBps: integer("revenue_share_bps").default(0).notNull(),
	allowsModification: boolean("allows_modification").default(false).notNull(),
	allowsCommercialUse: boolean("allows_commercial_use").default(false).notNull(),
	allowsRedistribution: boolean("allows_redistribution").default(false).notNull(),
	requiresAttribution: boolean("requires_attribution").default(true).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ann_licenses_kind_idx").using("btree", table.kind.asc().nullsLast().op("enum_ops")),
	uniqueIndex("ann_licenses_slug_idx").using("btree", table.slug.asc().nullsLast().op("text_ops")),
]);

export const annBenchmarks = pgTable("ann_benchmarks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	annId: uuid("ann_id").notNull(),
	versionId: uuid("version_id"),
	benchmarkName: text("benchmark_name").notNull(),
	score: numeric({ precision: 5, scale:  2 }).notNull(),
	datasetHash: text("dataset_hash"),
	runner: text().default('internal').notNull(),
	metadata: jsonb().default({}).notNull(),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ann_benchmarks_ann_idx").using("btree", table.annId.asc().nullsLast().op("uuid_ops")),
	index("ann_benchmarks_name_idx").using("btree", table.benchmarkName.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.annId],
			foreignColumns: [anns.id],
			name: "ann_benchmarks_ann_id_anns_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.versionId],
			foreignColumns: [annVersions.id],
			name: "ann_benchmarks_version_id_ann_versions_id_fk"
		}).onDelete("set null"),
]);

export const annCategories = pgTable("ann_categories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	description: text(),
	icon: text(),
	sortOrder: integer("sort_order").default(100).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("ann_categories_slug_idx").using("btree", table.slug.asc().nullsLast().op("text_ops")),
]);

export const annRatings = pgTable("ann_ratings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	annId: uuid("ann_id").notNull(),
	userId: uuid("user_id").notNull(),
	rating: integer().notNull(),
	review: text(),
	verifiedUse: boolean("verified_use").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ann_ratings_ann_idx").using("btree", table.annId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("ann_ratings_ann_user_idx").using("btree", table.annId.asc().nullsLast().op("uuid_ops"), table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.annId],
			foreignColumns: [anns.id],
			name: "ann_ratings_ann_id_anns_id_fk"
		}).onDelete("cascade"),
]);

export const tissueMembers = pgTable("tissue_members", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tissueId: uuid("tissue_id").notNull(),
	annSlug: text("ann_slug").notNull(),
	annId: uuid("ann_id"),
	role: tissueMemberRole().default('voting').notNull(),
	authorityWeight: numeric("authority_weight", { precision: 4, scale:  3 }).default('0.5').notNull(),
	position: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("tissue_members_ann_slug_idx").using("btree", table.annSlug.asc().nullsLast().op("text_ops")),
	uniqueIndex("tissue_members_tissue_ann_idx").using("btree", table.tissueId.asc().nullsLast().op("text_ops"), table.annSlug.asc().nullsLast().op("text_ops")),
	index("tissue_members_tissue_idx").using("btree", table.tissueId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.tissueId],
			foreignColumns: [tissues.id],
			name: "tissue_members_tissue_id_tissues_id_fk"
		}).onDelete("cascade"),
]);

export const tissueDecisions = pgTable("tissue_decisions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tissueId: uuid("tissue_id").notNull(),
	tissueVersion: text("tissue_version").notNull(),
	requestId: text("request_id").notNull(),
	callerUserId: uuid("caller_user_id"),
	callerOrgId: uuid("caller_org_id"),
	state: integer().notNull(),
	confidence: numeric({ precision: 4, scale:  3 }).notNull(),
	authority: numeric({ precision: 4, scale:  3 }).notNull(),
	reasoning: text().notNull(),
	reversibility: text().notNull(),
	timeHorizon: text("time_horizon").notNull(),
	contributors: jsonb().notNull(),
	ignored: jsonb().default([]).notNull(),
	envelope: jsonb().notNull(),
	signature: text().notNull(),
	issuedAt: timestamp("issued_at", { withTimezone: true, mode: 'string' }).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	latencyMs: integer("latency_ms").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("tissue_decisions_request_idx").using("btree", table.requestId.asc().nullsLast().op("text_ops")),
	index("tissue_decisions_state_idx").using("btree", table.tissueId.asc().nullsLast().op("uuid_ops"), table.state.asc().nullsLast().op("int4_ops")),
	index("tissue_decisions_tissue_idx").using("btree", table.tissueId.asc().nullsLast().op("uuid_ops")),
	index("tissue_decisions_tissue_issued_idx").using("btree", table.tissueId.asc().nullsLast().op("uuid_ops"), table.issuedAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.tissueId],
			foreignColumns: [tissues.id],
			name: "tissue_decisions_tissue_id_tissues_id_fk"
		}).onDelete("cascade"),
]);

export const annDeployments = pgTable("ann_deployments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	annId: uuid("ann_id").notNull(),
	versionId: uuid("version_id").notNull(),
	regionId: uuid("region_id"),
	clusterId: uuid("cluster_id"),
	computeJobId: uuid("compute_job_id"),
	status: annDeploymentStatus().default('pending').notNull(),
	endpointUrl: text("endpoint_url"),
	replicas: integer().default(1).notNull(),
	ownerUserId: uuid("owner_user_id").notNull(),
	ownerOrgId: uuid("owner_org_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	costPerCallQubic: bigint("cost_per_call_qubic", { mode: "number" }).notNull(),
	deployedAt: timestamp("deployed_at", { withTimezone: true, mode: 'string' }),
	stoppedAt: timestamp("stopped_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ann_deployments_ann_idx").using("btree", table.annId.asc().nullsLast().op("uuid_ops")),
	index("ann_deployments_owner_idx").using("btree", table.ownerUserId.asc().nullsLast().op("uuid_ops")),
	index("ann_deployments_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("ann_deployments_version_idx").using("btree", table.versionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.annId],
			foreignColumns: [anns.id],
			name: "ann_deployments_ann_id_anns_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.versionId],
			foreignColumns: [annVersions.id],
			name: "ann_deployments_version_id_ann_versions_id_fk"
		}).onDelete("restrict"),
]);

export const annVersions = pgTable("ann_versions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	annId: uuid("ann_id").notNull(),
	version: text().notNull(),
	changelog: text(),
	artifactUrl: text("artifact_url"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	artifactSizeBytes: bigint("artifact_size_bytes", { mode: "number" }),
	artifactHash: text("artifact_hash"),
	trainingComputeJobId: uuid("training_compute_job_id"),
	trainingDatasetHash: text("training_dataset_hash"),
	hyperparameters: jsonb().default({}).notNull(),
	metrics: jsonb().default({}).notNull(),
	signature: text(),
	isLatest: boolean("is_latest").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ann_versions_ann_idx").using("btree", table.annId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("ann_versions_ann_version_idx").using("btree", table.annId.asc().nullsLast().op("text_ops"), table.version.asc().nullsLast().op("text_ops")),
	index("ann_versions_latest_idx").using("btree", table.annId.asc().nullsLast().op("bool_ops"), table.isLatest.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.annId],
			foreignColumns: [anns.id],
			name: "ann_versions_ann_id_anns_id_fk"
		}).onDelete("cascade"),
]);

export const tissueAuditLogs = pgTable("tissue_audit_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	actorUserId: uuid("actor_user_id"),
	orgId: uuid("org_id"),
	action: text().notNull(),
	targetType: text("target_type"),
	targetId: text("target_id"),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("tissue_audit_logs_action_idx").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("tissue_audit_logs_actor_idx").using("btree", table.actorUserId.asc().nullsLast().op("uuid_ops")),
	index("tissue_audit_logs_created_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
]);

export const tissues = pgTable("tissues", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	tagline: text(),
	description: text(),
	ownerUserId: uuid("owner_user_id").notNull(),
	ownerOrgId: uuid("owner_org_id"),
	visibility: tissueVisibility().default('public').notNull(),
	status: tissueStatus().default('draft').notNull(),
	version: text().default('1.0.0').notNull(),
	policy: jsonb().notNull(),
	policyKind: text("policy_kind").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalDecisions: bigint("total_decisions", { mode: "number" }).default(0).notNull(),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("tissues_owner_idx").using("btree", table.ownerUserId.asc().nullsLast().op("uuid_ops")),
	index("tissues_policy_kind_idx").using("btree", table.policyKind.asc().nullsLast().op("text_ops")),
	uniqueIndex("tissues_slug_idx").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	index("tissues_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("tissues_visibility_idx").using("btree", table.visibility.asc().nullsLast().op("enum_ops")),
]);

export const annIdempotencyKeys = pgTable("ann_idempotency_keys", {
	userId: uuid("user_id").notNull(),
	idempotencyKey: text("idempotency_key").notNull(),
	route: text().notNull(),
	responseStatus: integer("response_status").notNull(),
	responseBody: jsonb("response_body").notNull(),
	requestHash: text("request_hash").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ann_idempotency_keys_expires_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	uniqueIndex("ann_idempotency_keys_pk").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.idempotencyKey.asc().nullsLast().op("uuid_ops"), table.route.asc().nullsLast().op("uuid_ops")),
]);

export const mktReviews = pgTable("mkt_reviews", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	targetType: mktReviewTarget("target_type").notNull(),
	targetId: uuid("target_id").notNull(),
	reviewerUserId: uuid("reviewer_user_id").notNull(),
	reviewerName: text("reviewer_name").notNull(),
	rating: integer().notNull(),
	review: text(),
	verifiedPurchase: boolean("verified_purchase").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("mkt_reviews_target_idx").using("btree", table.targetType.asc().nullsLast().op("enum_ops"), table.targetId.asc().nullsLast().op("enum_ops")),
	uniqueIndex("mkt_reviews_target_user_idx").using("btree", table.targetType.asc().nullsLast().op("enum_ops"), table.targetId.asc().nullsLast().op("enum_ops"), table.reviewerUserId.asc().nullsLast().op("uuid_ops")),
]);

export const annAuditLogs = pgTable("ann_audit_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	actorUserId: uuid("actor_user_id"),
	orgId: uuid("org_id"),
	action: text().notNull(),
	targetType: text("target_type"),
	targetId: text("target_id"),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ann_audit_logs_action_idx").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("ann_audit_logs_actor_idx").using("btree", table.actorUserId.asc().nullsLast().op("uuid_ops")),
	index("ann_audit_logs_created_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
]);

export const mktAuditLogs = pgTable("mkt_audit_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	actorUserId: uuid("actor_user_id"),
	orgId: uuid("org_id"),
	action: text().notNull(),
	targetType: text("target_type"),
	targetId: text("target_id"),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("mkt_audit_logs_action_idx").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("mkt_audit_logs_actor_idx").using("btree", table.actorUserId.asc().nullsLast().op("uuid_ops")),
	index("mkt_audit_logs_created_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
]);

export const economyAigarthLocks = pgTable("economy_aigarth_locks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	walletAddress: text("wallet_address").notNull(),
	qearnLockId: text("qearn_lock_id").notNull(),
	lockTxHash: text("lock_tx_hash").notNull(),
	unlockTxHash: text("unlock_tx_hash"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amountQubic: bigint("amount_qubic", { mode: "number" }).notNull(),
	totalWeeks: integer("total_weeks").notNull(),
	startEpoch: integer("start_epoch").notNull(),
	startTick: integer("start_tick").notNull(),
	endTick: integer("end_tick"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	netRewardQubic: bigint("net_reward_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	penaltyBurnedQubic: bigint("penalty_burned_qubic", { mode: "number" }).notNull(),
	status: economyLockStatus().default('observed').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	computeGrantUnits: bigint("compute_grant_units", { mode: "number" }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	endedAt: timestamp("ended_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	uniqueIndex("economy_aigarth_locks_qearn_lock_idx").using("btree", table.qearnLockId.asc().nullsLast().op("text_ops")),
	index("economy_aigarth_locks_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("economy_aigarth_locks_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
]);

export const economyBundleListings = pgTable("economy_bundle_listings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	listingId: uuid("listing_id").notNull(),
	kind: economyBundleListingKind().default('collection').notNull(),
	annIds: jsonb("ann_ids").default([]).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	bundlePriceQubic: bigint("bundle_price_qubic", { mode: "number" }).notNull(),
	discountBps: integer("discount_bps").default(0).notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("economy_bundle_listings_listing_idx").using("btree", table.listingId.asc().nullsLast().op("uuid_ops")),
]);

export const anns = pgTable("anns", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	tagline: text(),
	description: text(),
	icon: text(),
	tags: jsonb().default([]).notNull(),
	categoryId: uuid("category_id"),
	licenseId: uuid("license_id"),
	creatorUserId: uuid("creator_user_id").notNull(),
	creatorOrgId: uuid("creator_org_id"),
	creatorName: text("creator_name").notNull(),
	visibility: annVisibility().default('public').notNull(),
	status: annStatus().default('draft').notNull(),
	creatorWalletAddress: text("creator_wallet_address"),
	signature: text(),
	accuracy: numeric({ precision: 5, scale:  2 }),
	latencyP50Ms: integer("latency_p50_ms"),
	latencyP99Ms: integer("latency_p99_ms"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalCalls: bigint("total_calls", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalRevenueQubic: bigint("total_revenue_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	monthlyCalls: bigint("monthly_calls", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	downloads: bigint({ mode: "number" }).notNull(),
	ratingAverage: numeric("rating_average", { precision: 3, scale:  2 }),
	ratingCount: integer("rating_count").default(0).notNull(),
	currentVersionId: uuid("current_version_id"),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	searchText: text("search_text").generatedAlwaysAs(sql`((((COALESCE(name, ''::text) || ' '::text) || COALESCE(tagline, ''::text)) || ' '::text) || COALESCE(description, ''::text))`),
}, (table) => [
	index("anns_category_idx").using("btree", table.categoryId.asc().nullsLast().op("uuid_ops")),
	index("anns_creator_idx").using("btree", table.creatorUserId.asc().nullsLast().op("uuid_ops")),
	index("anns_license_idx").using("btree", table.licenseId.asc().nullsLast().op("uuid_ops")),
	index("anns_search_text_trgm_idx").using("gin", table.searchText.asc().nullsLast().op("gin_trgm_ops")),
	uniqueIndex("anns_slug_idx").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	index("anns_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("anns_tags_trgm_idx").using("gin", sql`(tags)::text`),
	index("anns_visibility_idx").using("btree", table.visibility.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [annCategories.id],
			name: "anns_category_id_ann_categories_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.licenseId],
			foreignColumns: [annLicenses.id],
			name: "anns_license_id_ann_licenses_id_fk"
		}).onDelete("set null"),
]);

export const mktOffers = pgTable("mkt_offers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	listingId: uuid("listing_id").notNull(),
	buyerUserId: uuid("buyer_user_id").notNull(),
	buyerOrgId: uuid("buyer_org_id"),
	buyerName: text("buyer_name").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amountQubic: bigint("amount_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalPriceQubic: bigint("total_price_qubic", { mode: "number" }).notNull(),
	status: mktOfferStatus().default('pending').notNull(),
	message: text(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	respondedAt: timestamp("responded_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("mkt_offers_buyer_idx").using("btree", table.buyerUserId.asc().nullsLast().op("uuid_ops")),
	index("mkt_offers_listing_idx").using("btree", table.listingId.asc().nullsLast().op("uuid_ops")),
	index("mkt_offers_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.listingId],
			foreignColumns: [mktListings.id],
			name: "mkt_offers_listing_id_mkt_listings_id_fk"
		}).onDelete("cascade"),
]);

export const economyContributorShares = pgTable("economy_contributor_shares", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	annId: uuid("ann_id").notNull(),
	userId: uuid("user_id").notNull(),
	bps: integer().notNull(),
	role: economyContributorRole().default('co_creator').notNull(),
	label: text(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("economy_contributor_shares_ann_idx").using("btree", table.annId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("economy_contributor_shares_ann_user_idx").using("btree", table.annId.asc().nullsLast().op("uuid_ops"), table.userId.asc().nullsLast().op("uuid_ops")),
	index("economy_contributor_shares_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
]);

export const economyAuditLogs = pgTable("economy_audit_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	actorUserId: uuid("actor_user_id"),
	orgId: uuid("org_id"),
	action: text().notNull(),
	targetType: text("target_type"),
	targetId: text("target_id"),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("economy_audit_logs_action_idx").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("economy_audit_logs_actor_idx").using("btree", table.actorUserId.asc().nullsLast().op("uuid_ops")),
	index("economy_audit_logs_created_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
]);

export const economyPayoutRuns = pgTable("economy_payout_runs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	annId: uuid("ann_id").notNull(),
	periodStart: timestamp("period_start", { withTimezone: true, mode: 'string' }).notNull(),
	periodEnd: timestamp("period_end", { withTimezone: true, mode: 'string' }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalRevenueQubic: bigint("total_revenue_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	platformFeeQubic: bigint("platform_fee_qubic", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	netToContributorsQubic: bigint("net_to_contributors_qubic", { mode: "number" }).notNull(),
	platformFeeBps: integer("platform_fee_bps").notNull(),
	status: economyPayoutRunStatus().default('draft').notNull(),
	sourceUsageRecordIds: jsonb("source_usage_record_ids").default([]).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	settledAt: timestamp("settled_at", { withTimezone: true, mode: 'string' }),
	cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: 'string' }),
	failureReason: text("failure_reason"),
}, (table) => [
	index("economy_payout_runs_ann_idx").using("btree", table.annId.asc().nullsLast().op("uuid_ops")),
	index("economy_payout_runs_period_idx").using("btree", table.periodStart.asc().nullsLast().op("timestamptz_ops"), table.periodEnd.asc().nullsLast().op("timestamptz_ops")),
	index("economy_payout_runs_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
]);

export const economyPayoutRecipients = pgTable("economy_payout_recipients", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	payoutRunId: uuid("payout_run_id").notNull(),
	userId: uuid("user_id").notNull(),
	walletAddress: text("wallet_address").notNull(),
	bps: integer().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	amountQubic: bigint("amount_qubic", { mode: "number" }).notNull(),
	status: economyPayoutRecipientStatus().default('pending').notNull(),
	txHash: text("tx_hash"),
	failureReason: text("failure_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("economy_payout_recipients_run_idx").using("btree", table.payoutRunId.asc().nullsLast().op("uuid_ops")),
	index("economy_payout_recipients_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.payoutRunId],
			foreignColumns: [economyPayoutRuns.id],
			name: "economy_payout_recipients_payout_run_id_economy_payout_runs_id_"
		}).onDelete("cascade"),
]);

export const mktTissueListings = pgTable("mkt_tissue_listings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	title: text().notNull(),
	description: text(),
	icon: text(),
	tags: jsonb().default([]).notNull(),
	sellerUserId: uuid("seller_user_id").notNull(),
	sellerOrgId: uuid("seller_org_id"),
	sellerName: text("seller_name").notNull(),
	tissueSlug: text("tissue_slug").notNull(),
	tissueId: uuid("tissue_id"),
	tissueVersion: text("tissue_version").notNull(),
	tissueName: text("tissue_name").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	pricePerDecisionQubic: bigint("price_per_decision_qubic", { mode: "number" }).notNull(),
	access: mktTissueAccess().default('open').notNull(),
	status: mktListingStatus().default('draft').notNull(),
	visibility: mktListingVisibility().default('public').notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalDecisions: bigint("total_decisions", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalRevenueQubic: bigint("total_revenue_qubic", { mode: "number" }).default(0).notNull(),
	ratingAverage: text("rating_average"),
	ratingCount: integer("rating_count").default(0).notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("mkt_tissue_listings_access_idx").using("btree", table.access.asc().nullsLast().op("enum_ops")),
	index("mkt_tissue_listings_seller_idx").using("btree", table.sellerUserId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("mkt_tissue_listings_slug_idx").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	index("mkt_tissue_listings_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("mkt_tissue_listings_tissue_slug_idx").using("btree", table.tissueSlug.asc().nullsLast().op("text_ops")),
	index("mkt_tissue_listings_visibility_idx").using("btree", table.visibility.asc().nullsLast().op("enum_ops")),
]);

export const teamMembers = pgTable("team_members", {
	teamId: uuid("team_id").notNull(),
	membershipId: uuid("membership_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "team_members_team_id_teams_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.membershipId],
			foreignColumns: [memberships.id],
			name: "team_members_membership_id_memberships_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.teamId, table.membershipId], name: "team_members_team_id_membership_id_pk"}),
]);
