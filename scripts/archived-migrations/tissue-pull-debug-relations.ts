import { relations } from "drizzle-orm/relations";
import { mktAuctions, mktBids, organizations, apiKeys, users, auditLogs, emailVerifications, memberships, mfaCredentials, passwordResets, sessions, teams, userCredentials, walletLinks, computeClusters, computeJobs, computeRegions, computeClusterMembers, gatewayApiKeys, gatewayRequests, mktOffers, mktPurchases, mktListings, qubicWallets, stakes, rewards, gatewayRateLimits, qubicBalances, gatewayModels, gatewayDeployments, billingInvoices, billingPayments, billingInvoiceItems, billingSubscriptions, billingPlans, billingCoupons, billingCouponRedemptions, billingCredits, anns, annLicensesGranted, annLicenses, annBenchmarks, annVersions, annRatings, tissues, tissueMembers, tissueDecisions, annDeployments, annCategories, economyPayoutRuns, economyPayoutRecipients, teamMembers } from "./schema";

export const mktBidsRelations = relations(mktBids, ({one}) => ({
	mktAuction: one(mktAuctions, {
		fields: [mktBids.auctionId],
		references: [mktAuctions.id]
	}),
}));

export const mktAuctionsRelations = relations(mktAuctions, ({many}) => ({
	mktBids: many(mktBids),
}));

export const apiKeysRelations = relations(apiKeys, ({one}) => ({
	organization: one(organizations, {
		fields: [apiKeys.orgId],
		references: [organizations.id]
	}),
	user: one(users, {
		fields: [apiKeys.createdByUserId],
		references: [users.id]
	}),
}));

export const organizationsRelations = relations(organizations, ({many}) => ({
	apiKeys: many(apiKeys),
	auditLogs: many(auditLogs),
	memberships: many(memberships),
	teams: many(teams),
}));

export const usersRelations = relations(users, ({many}) => ({
	apiKeys: many(apiKeys),
	auditLogs: many(auditLogs),
	emailVerifications: many(emailVerifications),
	memberships_userId: many(memberships, {
		relationName: "memberships_userId_users_id"
	}),
	memberships_invitedBy: many(memberships, {
		relationName: "memberships_invitedBy_users_id"
	}),
	mfaCredentials: many(mfaCredentials),
	passwordResets: many(passwordResets),
	sessions: many(sessions),
	userCredentials: many(userCredentials),
	walletLinks: many(walletLinks),
}));

export const auditLogsRelations = relations(auditLogs, ({one}) => ({
	user: one(users, {
		fields: [auditLogs.actorUserId],
		references: [users.id]
	}),
	organization: one(organizations, {
		fields: [auditLogs.orgId],
		references: [organizations.id]
	}),
}));

export const emailVerificationsRelations = relations(emailVerifications, ({one}) => ({
	user: one(users, {
		fields: [emailVerifications.userId],
		references: [users.id]
	}),
}));

export const membershipsRelations = relations(memberships, ({one, many}) => ({
	user_userId: one(users, {
		fields: [memberships.userId],
		references: [users.id],
		relationName: "memberships_userId_users_id"
	}),
	organization: one(organizations, {
		fields: [memberships.orgId],
		references: [organizations.id]
	}),
	user_invitedBy: one(users, {
		fields: [memberships.invitedBy],
		references: [users.id],
		relationName: "memberships_invitedBy_users_id"
	}),
	teamMembers: many(teamMembers),
}));

export const mfaCredentialsRelations = relations(mfaCredentials, ({one}) => ({
	user: one(users, {
		fields: [mfaCredentials.userId],
		references: [users.id]
	}),
}));

export const passwordResetsRelations = relations(passwordResets, ({one}) => ({
	user: one(users, {
		fields: [passwordResets.userId],
		references: [users.id]
	}),
}));

export const sessionsRelations = relations(sessions, ({one}) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	}),
}));

export const teamsRelations = relations(teams, ({one, many}) => ({
	organization: one(organizations, {
		fields: [teams.orgId],
		references: [organizations.id]
	}),
	teamMembers: many(teamMembers),
}));

export const userCredentialsRelations = relations(userCredentials, ({one}) => ({
	user: one(users, {
		fields: [userCredentials.userId],
		references: [users.id]
	}),
}));

export const walletLinksRelations = relations(walletLinks, ({one}) => ({
	user: one(users, {
		fields: [walletLinks.userId],
		references: [users.id]
	}),
}));

export const computeJobsRelations = relations(computeJobs, ({one}) => ({
	computeCluster: one(computeClusters, {
		fields: [computeJobs.clusterId],
		references: [computeClusters.id]
	}),
	computeRegion: one(computeRegions, {
		fields: [computeJobs.regionId],
		references: [computeRegions.id]
	}),
}));

export const computeClustersRelations = relations(computeClusters, ({one, many}) => ({
	computeJobs: many(computeJobs),
	computeClusterMembers: many(computeClusterMembers),
	computeRegion: one(computeRegions, {
		fields: [computeClusters.regionId],
		references: [computeRegions.id]
	}),
}));

export const computeRegionsRelations = relations(computeRegions, ({many}) => ({
	computeJobs: many(computeJobs),
	computeClusters: many(computeClusters),
}));

export const computeClusterMembersRelations = relations(computeClusterMembers, ({one}) => ({
	computeCluster: one(computeClusters, {
		fields: [computeClusterMembers.clusterId],
		references: [computeClusters.id]
	}),
}));

export const gatewayRequestsRelations = relations(gatewayRequests, ({one}) => ({
	gatewayApiKey: one(gatewayApiKeys, {
		fields: [gatewayRequests.apiKeyId],
		references: [gatewayApiKeys.id]
	}),
}));

export const gatewayApiKeysRelations = relations(gatewayApiKeys, ({many}) => ({
	gatewayRequests: many(gatewayRequests),
	gatewayRateLimits: many(gatewayRateLimits),
}));

export const mktPurchasesRelations = relations(mktPurchases, ({one}) => ({
	mktOffer: one(mktOffers, {
		fields: [mktPurchases.offerId],
		references: [mktOffers.id]
	}),
	mktListing: one(mktListings, {
		fields: [mktPurchases.listingId],
		references: [mktListings.id]
	}),
}));

export const mktOffersRelations = relations(mktOffers, ({one, many}) => ({
	mktPurchases: many(mktPurchases),
	mktListing: one(mktListings, {
		fields: [mktOffers.listingId],
		references: [mktListings.id]
	}),
}));

export const mktListingsRelations = relations(mktListings, ({many}) => ({
	mktPurchases: many(mktPurchases),
	mktOffers: many(mktOffers),
}));

export const stakesRelations = relations(stakes, ({one, many}) => ({
	qubicWallet: one(qubicWallets, {
		fields: [stakes.walletId],
		references: [qubicWallets.id]
	}),
	rewards: many(rewards),
}));

export const qubicWalletsRelations = relations(qubicWallets, ({many}) => ({
	stakes: many(stakes),
	qubicBalances: many(qubicBalances),
}));

export const rewardsRelations = relations(rewards, ({one}) => ({
	stake: one(stakes, {
		fields: [rewards.stakeId],
		references: [stakes.id]
	}),
}));

export const gatewayRateLimitsRelations = relations(gatewayRateLimits, ({one}) => ({
	gatewayApiKey: one(gatewayApiKeys, {
		fields: [gatewayRateLimits.apiKeyId],
		references: [gatewayApiKeys.id]
	}),
}));

export const qubicBalancesRelations = relations(qubicBalances, ({one}) => ({
	qubicWallet: one(qubicWallets, {
		fields: [qubicBalances.walletId],
		references: [qubicWallets.id]
	}),
}));

export const gatewayDeploymentsRelations = relations(gatewayDeployments, ({one}) => ({
	gatewayModel: one(gatewayModels, {
		fields: [gatewayDeployments.modelId],
		references: [gatewayModels.id]
	}),
}));

export const gatewayModelsRelations = relations(gatewayModels, ({many}) => ({
	gatewayDeployments: many(gatewayDeployments),
}));

export const billingPaymentsRelations = relations(billingPayments, ({one}) => ({
	billingInvoice: one(billingInvoices, {
		fields: [billingPayments.invoiceId],
		references: [billingInvoices.id]
	}),
}));

export const billingInvoicesRelations = relations(billingInvoices, ({one, many}) => ({
	billingPayments: many(billingPayments),
	billingInvoiceItems: many(billingInvoiceItems),
	billingSubscription: one(billingSubscriptions, {
		fields: [billingInvoices.subscriptionId],
		references: [billingSubscriptions.id]
	}),
}));

export const billingInvoiceItemsRelations = relations(billingInvoiceItems, ({one}) => ({
	billingInvoice: one(billingInvoices, {
		fields: [billingInvoiceItems.invoiceId],
		references: [billingInvoices.id]
	}),
}));

export const billingSubscriptionsRelations = relations(billingSubscriptions, ({one, many}) => ({
	billingInvoices: many(billingInvoices),
	billingPlan: one(billingPlans, {
		fields: [billingSubscriptions.planId],
		references: [billingPlans.id]
	}),
}));

export const billingPlansRelations = relations(billingPlans, ({many}) => ({
	billingSubscriptions: many(billingSubscriptions),
}));

export const billingCouponRedemptionsRelations = relations(billingCouponRedemptions, ({one}) => ({
	billingCoupon: one(billingCoupons, {
		fields: [billingCouponRedemptions.couponId],
		references: [billingCoupons.id]
	}),
	billingCredit: one(billingCredits, {
		fields: [billingCouponRedemptions.creditId],
		references: [billingCredits.id]
	}),
}));

export const billingCouponsRelations = relations(billingCoupons, ({many}) => ({
	billingCouponRedemptions: many(billingCouponRedemptions),
}));

export const billingCreditsRelations = relations(billingCredits, ({many}) => ({
	billingCouponRedemptions: many(billingCouponRedemptions),
}));

export const annLicensesGrantedRelations = relations(annLicensesGranted, ({one}) => ({
	ann: one(anns, {
		fields: [annLicensesGranted.annId],
		references: [anns.id]
	}),
	annLicense: one(annLicenses, {
		fields: [annLicensesGranted.licenseId],
		references: [annLicenses.id]
	}),
}));

export const annsRelations = relations(anns, ({one, many}) => ({
	annLicensesGranteds: many(annLicensesGranted),
	annBenchmarks: many(annBenchmarks),
	annRatings: many(annRatings),
	annDeployments: many(annDeployments),
	annVersions: many(annVersions),
	annCategory: one(annCategories, {
		fields: [anns.categoryId],
		references: [annCategories.id]
	}),
	annLicense: one(annLicenses, {
		fields: [anns.licenseId],
		references: [annLicenses.id]
	}),
}));

export const annLicensesRelations = relations(annLicenses, ({many}) => ({
	annLicensesGranteds: many(annLicensesGranted),
	anns: many(anns),
}));

export const annBenchmarksRelations = relations(annBenchmarks, ({one}) => ({
	ann: one(anns, {
		fields: [annBenchmarks.annId],
		references: [anns.id]
	}),
	annVersion: one(annVersions, {
		fields: [annBenchmarks.versionId],
		references: [annVersions.id]
	}),
}));

export const annVersionsRelations = relations(annVersions, ({one, many}) => ({
	annBenchmarks: many(annBenchmarks),
	annDeployments: many(annDeployments),
	ann: one(anns, {
		fields: [annVersions.annId],
		references: [anns.id]
	}),
}));

export const annRatingsRelations = relations(annRatings, ({one}) => ({
	ann: one(anns, {
		fields: [annRatings.annId],
		references: [anns.id]
	}),
}));

export const tissueMembersRelations = relations(tissueMembers, ({one}) => ({
	tissue: one(tissues, {
		fields: [tissueMembers.tissueId],
		references: [tissues.id]
	}),
}));

export const tissuesRelations = relations(tissues, ({many}) => ({
	tissueMembers: many(tissueMembers),
	tissueDecisions: many(tissueDecisions),
}));

export const tissueDecisionsRelations = relations(tissueDecisions, ({one}) => ({
	tissue: one(tissues, {
		fields: [tissueDecisions.tissueId],
		references: [tissues.id]
	}),
}));

export const annDeploymentsRelations = relations(annDeployments, ({one}) => ({
	ann: one(anns, {
		fields: [annDeployments.annId],
		references: [anns.id]
	}),
	annVersion: one(annVersions, {
		fields: [annDeployments.versionId],
		references: [annVersions.id]
	}),
}));

export const annCategoriesRelations = relations(annCategories, ({many}) => ({
	anns: many(anns),
}));

export const economyPayoutRecipientsRelations = relations(economyPayoutRecipients, ({one}) => ({
	economyPayoutRun: one(economyPayoutRuns, {
		fields: [economyPayoutRecipients.payoutRunId],
		references: [economyPayoutRuns.id]
	}),
}));

export const economyPayoutRunsRelations = relations(economyPayoutRuns, ({many}) => ({
	economyPayoutRecipients: many(economyPayoutRecipients),
}));

export const teamMembersRelations = relations(teamMembers, ({one}) => ({
	team: one(teams, {
		fields: [teamMembers.teamId],
		references: [teams.id]
	}),
	membership: one(memberships, {
		fields: [teamMembers.membershipId],
		references: [memberships.id]
	}),
}));