# Data Model

**Product:** Aigarth Cloud
**Status:** Active
**Owner:** Engineering
**Last updated:** 2026-07-27
**Source docs:** [`ROADMAP.md`](../../../ROADMAP.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md)

---

## 1. Modeling principles

- **Domain objects have a single owning service.** The owning service is the source of truth. Other services get a typed client, never direct DB access.
- **Schema is intentionally minimal.** Sub-objects that vary by use case (e.g. ANN capability flags) live in JSONB columns, not normalized tables, until a pattern emerges.
- **Soft delete by default.** Hard delete is reserved for compliance (GDPR, audit) and is logged.
- **All objects get `id`, `createdAt`, `updatedAt`, `deletedAt`.** These are the only universal columns.
- **All objects have an `ownerId`.** This is the user, organisation, or service that can authorize reads/writes.

## 2. Identity & Access (Phase 1)

Owned by: **Identity service**

```ts
User {
  id: UUID
  email: string
  emailVerifiedAt: DateTime?
  displayName: string
  avatarUrl: string?
  status: 'active' | 'suspended' | 'pending'
  mfaEnabled: boolean
  createdAt, updatedAt, deletedAt
}

Wallet {
  id: UUID
  userId: UUID
  chain: 'qubic'
  address: string               // unique
  verifiedAt: DateTime?
  primary: boolean              // one primary per user
  createdAt, updatedAt, deletedAt
}

Organisation {
  id: UUID
  slug: string                   // unique, URL-safe
  name: string
  billingEmail: string
  plan: 'explorer' | 'builder' | 'startup' | 'business' | 'enterprise'
  status: 'active' | 'suspended' | 'archived'
  createdAt, updatedAt, deletedAt
}

Membership {
  id: UUID
  userId: UUID
  organisationId: UUID
  role: 'owner' | 'admin' | 'member' | 'guest'
  createdAt, updatedAt, deletedAt
  // Unique on (userId, organisationId)
}

Team {
  id: UUID
  organisationId: UUID
  name: string
  createdAt, updatedAt, deletedAt
}

TeamMember {
  id: UUID
  teamId: UUID
  userId: UUID
  role: 'lead' | 'contributor' | 'viewer'
  createdAt, updatedAt, deletedAt
}

Role {
  id: UUID
  organisationId: UUID | null    // null = system role
  name: string
  scopes: string[]                // e.g. ['compute:read', 'compute:write', 'ann:publish']
  createdAt, updatedAt
}

APIKey {
  id: UUID
  ownerId: UUID                   // user or org
  ownerType: 'user' | 'org'
  name: string
  prefix: string                  // sk-aigarth-
  hash: string                    // bcrypt
  scopes: string[]
  environment: 'live' | 'test'
  lastUsedAt: DateTime?
  expiresAt: DateTime?
  createdAt, updatedAt, deletedAt
}

Session {
  id: UUID
  userId: UUID
  tokenHash: string
  ipAddress: string
  userAgent: string
  mfaVerified: boolean
  expiresAt: DateTime
  createdAt
}

AuditEvent {
  id: UUID
  actorId: UUID                   // user or service
  actorType: 'user' | 'service' | 'system'
  organisationId: UUID?
  action: string                  // 'api_key.created', 'org.member.added'
  targetType: string
  targetId: UUID
  metadata: JSONB
  ipAddress: string?
  createdAt
}
```

## 3. Aigarth Core (Phase 2)

Owned by: **Core service**

```ts
Region {
  id: UUID
  code: string                    // 'us-east-1', 'eu-west-1'
  name: string
  country: string
  status: 'active' | 'degraded' | 'offline'
  capacityGpuHrPerDay: number
  createdAt, updatedAt
}

ComputeNode {
  id: UUID
  regionId: UUID
  operatorId: UUID                // user
  hardware: 'H100' | 'A100' | 'MI300X' | ...
  count: number
  status: 'joining' | 'active' | 'draining' | 'offline'
  attestation: JSONB              // hardware attestation report
  lastHeartbeatAt: DateTime
  createdAt, updatedAt, deletedAt
}

Cluster {
  id: UUID
  organisationId: UUID
  regionId: UUID
  name: string
  hardware: string
  gpuCount: number
  status: 'provisioning' | 'ready' | 'draining' | 'retired'
  createdAt, updatedAt, deletedAt
}

Reservation {
  id: UUID
  organisationId: UUID
  regionId: UUID
  computePoolId: UUID
  gpuHrPerDay: number
  validFrom: DateTime
  validUntil: DateTime
  source: 'stake' | 'reserved' | 'spot' | 'gift'
  createdAt, updatedAt
}

ComputePool {
  id: UUID
  organisationId: UUID
  tierId: string                  // 'explorer' | 'builder' | ...
  gpuHrPerDay: number
  usedGpuHr: number               // rolling 24h
  routingPolicy: 'priority' | 'cheapest' | 'lowest-latency'
}

Job {
  id: UUID
  reservationId: UUID?
  ownerId: UUID
  type: 'inference' | 'embedding' | 'image' | 'video' | 'audio' | 'training' | 'batch'
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  modelId: string
  inputTokens: number?
  outputTokens: number?
  startedAt: DateTime?
  completedAt: DateTime?
  error: string?
  costMicroUsd: number            // 1e-6 USD
  createdAt, updatedAt
}
```

## 4. Qubic Integration (Phase 3)

Owned by: **Qubic service**

```ts
Stake {
  id: UUID
  organisationId: UUID
  amount: number                  // in QUBIC, bigint
  poolId: UUID                    // StakePool
  status: 'active' | 'cooling_down' | 'withdrawn'
  coolDownUntil: DateTime?
  rewardsClaimed: number
  startedAt: DateTime
  endedAt: DateTime?
}

StakePool {
  id: UUID
  totalStaked: number
  apy: number                     // rolling 30d
  reserveAddress: string
  status: 'open' | 'paused' | 'closed'
}

Transaction {
  id: UUID
  hash: string                    // unique
  type: 'stake' | 'unstake' | 'claim' | 'transfer'
  amount: number
  fromAddress: string
  toAddress: string
  status: 'pending' | 'confirmed' | 'finalized' | 'failed'
  blockNumber: number?
  confirmations: number
  createdAt
}

Reward {
  id: UUID
  stakeId: UUID
  amount: number
  period: 'hourly' | 'daily' | 'epoch'
  claimedAt: DateTime?
}

Validator {
  id: UUID
  address: string
  alias: string?
  status: 'active' | 'jailed' | 'slashed'
  uptime: number                  // rolling 30d
  slashCount: number
}

Treasury {
  id: UUID
  balance: number
  inflow24h: number
  outflow24h: number
  policy: JSONB                   // spending rules
}
```

## 5. Billing (Phase 4)

Owned by: **Billing service**

```ts
Customer {
  id: UUID
  organisationId: UUID
  stripeCustomerId: string?
  paymentMethodIds: string[]
  creditBalance: number
  status: 'active' | 'past_due' | 'canceled'
}

Subscription {
  id: UUID
  organisationId: UUID
  plan: 'explorer' | 'builder' | 'startup' | 'business' | 'enterprise'
  status: 'active' | 'past_due' | 'canceled' | 'incomplete'
  currentPeriodStart: DateTime
  currentPeriodEnd: DateTime
  cancelAt: DateTime?
}

Invoice {
  id: UUID
  organisationId: UUID
  number: string                  // 'INV-2026-0001'
  amount: number
  currency: 'USD' | 'QUBIC' | 'USDC'
  status: 'draft' | 'open' | 'paid' | 'void'
  lineItems: JSONB
  dueAt: DateTime
  paidAt: DateTime?
  pdfUrl: string?
}

Payment {
  id: UUID
  invoiceId: UUID
  amount: number
  currency: string
  method: 'card' | 'ach' | 'sepa' | 'stablecoin' | 'qubic'
  externalId: string              // Stripe payment intent id
  status: 'pending' | 'succeeded' | 'failed' | 'refunded'
}

UsageRecord {
  id: UUID
  organisationId: UUID
  product: 'inference' | 'embedding' | 'image' | 'voice' | 'compute' | 'oracle'
  quantity: number
  unit: 'tokens' | 'images' | 'seconds' | 'gpu_hr' | 'requests'
  costMicroUsd: number
  jobId: UUID?
  periodStart: DateTime
  periodEnd: DateTime
}

Plan {
  id: string                      // 'builder'
  name: string
  monthlyPrice: number             // USD or QUBIC
  includedGpuHr: number
  includedRequests: number
  overagePricing: JSONB
  features: string[]
}

Credit {
  id: UUID
  organisationId: UUID
  amount: number
  source: 'promo' | 'grant' | 'referral' | 'refund'
  expiresAt: DateTime?
  usedAmount: number
}
```

## 6. ANN Platform (Phase 5)

Owned by: **ANN service**

```ts
ANN {
  id: UUID
  slug: string
  name: string
  creatorId: UUID
  description: string
  categoryId: UUID
  license: 'open' | 'commercial' | 'restricted'
  visibility: 'public' | 'unlisted' | 'private'
  status: 'draft' | 'published' | 'deprecated' | 'taken_down'
  createdAt, updatedAt, deletedAt
}

ANNVersion {
  id: UUID
  annId: UUID
  version: string                 // semver
  baseModelId: string
  weightsHash: string
  manifest: JSONB                // training data hashes, hyperparams
  benchmarkId: UUID?
  publishedAt: DateTime?
  createdAt
}

ANNDeployment {
  id: UUID
  annVersionId: UUID
  ownerId: UUID
  regionId: UUID
  status: 'provisioning' | 'live' | 'paused' | 'terminated'
  callsPerDay: number
  latencyP95: number
  costPerCall: number
  createdAt, updatedAt
}

Category {
  id: UUID
  slug: string                    // 'medical', 'legal', 'finance'
  name: string
  parentId: UUID?
  description: string
}

License {
  id: UUID
  annId: UUID
  type: 'open' | 'commercial' | 'restricted' | 'custom'
  pricePerCall: number
  pricePerMonth: number
  terms: JSONB
  revocable: boolean
  geoRestrictions: string[]       // ISO country codes
}

Benchmark {
  id: UUID
  annVersionId: UUID
  metric: 'accuracy' | 'latency' | 'throughput' | 'bleu' | 'rouge'
  value: number
  datasetId: string
  evaluator: string               // who ran the benchmark
  runAt: DateTime
}

Rating {
  id: UUID
  annId: UUID
  userId: UUID
  score: number                   // 1–5
  review: string?
  createdAt
}

UsageStats {
  annId: UUID
  date: Date
  calls: number
  uniqueCallers: number
  revenue: number
}
```

## 7. Marketplace (Phase 6)

Owned by: **Marketplace service**

```ts
Listing {
  id: UUID
  type: 'ann' | 'compute'
  refId: UUID                     // ANN.id or ComputePool.id
  sellerId: UUID
  price: number
  currency: 'QUBIC' | 'USDC'
  status: 'active' | 'paused' | 'sold_out'
  createdAt, updatedAt
}

Offer {
  id: UUID
  listingId: UUID
  buyerId: UUID
  price: number
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
  createdAt
}

Purchase {
  id: UUID
  listingId: UUID
  buyerId: UUID
  sellerId: UUID
  price: number
  txHash: string?                 // on-chain settlement
  status: 'pending' | 'settled' | 'refunded' | 'disputed'
  createdAt
}

Auction {
  id: UUID
  type: 'english' | 'dutch' | 'sealed_bid'
  resourceType: 'compute_pool' | 'reserved_capacity'
  resourceId: UUID
  reservePrice: number
  currentPrice: number
  startsAt: DateTime
  endsAt: DateTime
  status: 'pending' | 'live' | 'ended' | 'canceled'
}

Bid {
  id: UUID
  auctionId: UUID
  bidderId: UUID
  amount: number
  status: 'leading' | 'outbid' | 'won' | 'lost'
  createdAt
}

Review {
  id: UUID
  targetType: 'ann' | 'cluster' | 'operator'
  targetId: UUID
  reviewerId: UUID
  rating: number
  text: string
  createdAt
}
```

## 8. AI Gateway (Phase 7)

Owned by: **Gateway service**

```ts
Model {
  id: string                      // 'aigarth-reason-1'
  family: string
  modality: ('text' | 'image' | 'audio' | 'video')[]
  contextWindow: number
  inputPricePerMTok: number
  outputPricePerMTok: number
  status: 'ga' | 'beta' | 'deprecated'
  capabilities: string[]
}

Endpoint {
  id: string                      // 'chat', 'embeddings', 'image'
  path: string                    // '/v1/chat/completions'
  modelIds: string[]
  rateLimit: JSONB
}

Request {
  id: UUID
  apiKeyId: UUID
  modelId: string
  endpointId: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  statusCode: number
  costMicroUsd: number
  createdAt
}

Deployment {
  id: UUID
  modelId: string
  regionId: UUID
  clusterId: UUID?
  status: 'provisioning' | 'live' | 'draining'
  replicas: number
  createdAt, updatedAt
}
```

## 9. Developer Platform (Phase 8)

Owned by: **Developer Platform service** (mostly a content + tooling service)

```ts
SDK {
  language: 'python' | 'typescript' | 'go' | 'rust' | 'java' | 'csharp'
  latestVersion: string
  repoUrl: string
  installCommand: string
  changelogUrl: string
}

Example {
  id: UUID
  language: string
  framework: string
  title: string
  repoUrl: string
  runnable: boolean
}

PlaygroundProject {
  id: UUID
  ownerId: UUID
  name: string
  code: string
  language: string
  lastRunAt: DateTime?
}
```

## 10. Dashboard (Phase 9)

Owned by: **Dashboard service** (mostly a derived read model)

```ts
Widget {
  id: UUID
  userId: UUID
  type: string
  position: JSONB
  config: JSONB
}

Metric {
  // Pre-aggregated, populated by workers
  organisationId: UUID
  date: Date
  metric: string                  // 'inference.calls', 'revenue.usd', 'stake.qubic'
  value: number
  dimensions: JSONB
}

Alert {
  id: UUID
  organisationId: UUID
  severity: 'info' | 'warning' | 'error' | 'critical'
  status: 'open' | 'acknowledged' | 'resolved'
  title: string
  description: string
  triggeredAt: DateTime
  resolvedAt: DateTime?
}

Notification {
  id: UUID
  userId: UUID
  type: string
  title: string
  body: string
  link: string?
  readAt: DateTime?
  createdAt
}
```

## 11. Genesis (Phase 10)

Owned by: **Genesis service**

```ts
GenesisRound {
  id: UUID
  status: 'upcoming' | 'open' | 'closed' | 'finalized'
  startsAt: DateTime
  endsAt: DateTime
  targetRaise: number
  raised: number
}

Participant {
  id: UUID
  roundId: UUID
  organisationId: UUID
  amount: number
  status: 'pending' | 'verified' | 'allocated' | 'distributed'
}

Allocation {
  id: UUID
  roundId: UUID
  participantId: UUID
  amount: number
  vesting: JSONB                  // schedule
}

VestingSchedule {
  participantId: UUID
  cliffMonths: number
  durationMonths: number
  releasedAmount: number
  remainingAmount: number
}

GovernanceEligibility {
  participantId: UUID
  votingPower: number
  proposalsAllowed: number
}
```

## 12. Hardware (Phase 11)

Owned by: **Hardware service**

```ts
Device {
  id: UUID
  productId: string               // 'aigarth-seed', 'aigarth-grove'
  serialNumber: string
  ownerId: UUID
  firmwareVersion: string
  status: 'reserved' | 'shipped' | 'active' | 'retired'
  lastSeenAt: DateTime?
  telemetry: JSONB
  createdAt, updatedAt
}

Firmware {
  productId: string
  version: string
  signedHash: string
  releaseNotes: string
  releasedAt: DateTime
}

Shipment {
  id: UUID
  reservationId: UUID
  carrier: string
  trackingNumber: string
  status: 'pending' | 'shipped' | 'delivered' | 'returned'
}
```

## 13. Enterprise (Phase 12)

Owned by: **Enterprise service** (mostly configuration + isolation primitives)

```ts
EnterpriseContract {
  id: UUID
  organisationId: UUID
  signedAt: DateTime
  expiresAt: DateTime
  value: number
  sla: JSONB
  customTerms: string
}

SLA {
  id: UUID
  contractId: UUID
  metric: 'uptime' | 'p95_latency' | 'support_response'
  target: number
  measurementWindow: string        // 'monthly'
  compensation: JSONB
}

ComplianceReport {
  id: UUID
  organisationId: UUID
  framework: 'soc2' | 'iso27001' | 'hipaa' | 'gdpr' | 'fedramp'
  period: 'q1-2026' | ...
  status: 'pass' | 'fail' | 'partial'
  reportUrl: string
}
```

## 14. Observability (Phase 13)

Cross-cutting. Models owned by the **Observability service**.

```ts
Trace {
  id: UUID
  traceId: string                 // OTEL-compatible
  service: string
  operation: string
  duration: number
  startedAt: DateTime
  spans: JSONB
}

Incident {
  id: UUID
  severity: 'sev1' | 'sev2' | 'sev3' | 'sev4'
  title: string
  summary: string
  status: 'open' | 'monitoring' | 'resolved'
  startedAt: DateTime
  resolvedAt: DateTime?
  postmortemUrl: string?
}
```

## 15. Governance (Phase 14)

Owned by: **Governance service**

```ts
Proposal {
  id: UUID
  proposerId: UUID
  title: string
  body: string
  category: 'parameter' | 'treasury' | 'grant' | 'protocol'
  status: 'draft' | 'voting' | 'passed' | 'rejected' | 'executed'
  votesFor: number
  votesAgainst: number
  votesAbstain: number
  startsAt: DateTime
  endsAt: DateTime
}

Vote {
  id: UUID
  proposalId: UUID
  voterId: UUID
  weight: number
  choice: 'for' | 'against' | 'abstain'
  createdAt
}

Grant {
  id: UUID
  recipientId: UUID
  amount: number
  purpose: string
  proposalId: UUID?
  status: 'pending' | 'approved' | 'disbursed' | 'revoked'
}

TreasuryAction {
  id: UUID
  proposalId: UUID
  amount: number
  recipient: string
  txHash: string?
  executedAt: DateTime?
}
```

## 16. Knowledge (Phase 15)

Owned by: **Knowledge service**

```ts
Article {
  id: UUID
  slug: string
  title: string
  body: string                    // MDX
  category: 'doc' | 'blog' | 'tutorial' | 'academy'
  status: 'draft' | 'published' | 'archived'
  publishedAt: DateTime?
  authorId: UUID
}

Course {
  id: UUID
  slug: string
  title: string
  description: string
  level: 'beginner' | 'intermediate' | 'advanced'
  lessons: UUID[]
}

Lesson {
  id: UUID
  courseId: UUID
  slug: string
  title: string
  body: string
  order: number
  estimatedMinutes: number
}

Certification {
  id: UUID
  slug: string
  name: string
  description: string
  prerequisites: UUID[]
  examId: UUID?
}
```

## 17. Summary

| Phase | Owning service | Object count |
|---|---|---|
| 1 Identity | identity | 11 |
| 2 Core | core | 9 |
| 3 Qubic | qubic | 6 |
| 4 Billing | billing | 8 |
| 5 ANN | ann | 9 |
| 6 Marketplace | marketplace | 7 |
| 7 Gateway | gateway | 4 |
| 8 Developer Platform | devplatform | 3 |
| 9 Dashboard | dashboard | 4 |
| 10 Genesis | genesis | 5 |
| 11 Hardware | hardware | 3 |
| 12 Enterprise | enterprise | 3 |
| 13 Observability | observability | 2 |
| 14 Governance | governance | 4 |
| 15 Knowledge | knowledge | 4 |
| **Total** | **15 services** | **82 objects** |

Plus cross-cutting types (Tag, Attachment, Webhook, Event) and per-Phase service-internal helpers, this maps to the **120–180 domain objects** projected in `ROADMAP.md`.

## 18. Linked documents

- [`ROADMAP.md`](../../../ROADMAP.md)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`API-SPEC.md`](./API-SPEC.md)
- [`SPRINT-PLAN.md`](./SPRINT-PLAN.md)
