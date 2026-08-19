/**
 * Seeds the tracker with:
 *   - All 16 phases from ROADMAP.md
 *   - Initial tasks per phase
 *   - All 17 documents in docs/
 *
 * Idempotent: re-running clears tasks and re-seeds.
 */

import path from "node:path";
import fs from "node:fs";
import { getDb, nowIso, logActivity } from "../src/lib/db";
import {
  upsertDoc,
  listDocs,
} from "../src/lib/repo";

const PHASES = [
  {
    id: "phase-0",
    number: 0,
    name: "Foundation",
    description: "Monorepo, SDK skeleton, design system extraction, CI/CD, local stack.",
    owner: "Eng lead + AI agents",
    ord: 0,
  },
  {
    id: "phase-1",
    number: 1,
    name: "Identity & Access",
    description: "Users, orgs, teams, roles, API keys, sessions, wallet auth, audit logs.",
    owner: "Eng lead",
    ord: 1,
  },
  {
    id: "phase-2",
    number: 2,
    name: "Aigarth Core",
    description: "Compute reservation engine, capacity allocator, queue, scheduler, region mgmt.",
    owner: "Core lead",
    ord: 2,
  },
  {
    id: "phase-3",
    number: 3,
    name: "Qubic Integration",
    description: "Wallet, staking, transaction monitor, rewards, treasury.",
    owner: "Qubic lead",
    ord: 3,
  },
  {
    id: "phase-4",
    number: 4,
    name: "Billing",
    description: "Subscriptions, usage billing, invoices, payments, credits.",
    owner: "Billing lead",
    ord: 4,
  },
  {
    id: "phase-5",
    number: 5,
    name: "ANN Platform",
    description: "Registry, builder, versioning, marketplace, licensing, analytics.",
    owner: "ANN lead",
    ord: 5,
  },
  {
    id: "phase-6",
    number: 6,
    name: "Marketplace",
    description: "ANN + compute marketplace, auctions, reviews, search.",
    owner: "Marketplace lead",
    ord: 6,
  },
  {
    id: "phase-7",
    number: 7,
    name: "AI Gateway",
    description: "OpenAI-compatible API surface for all inference.",
    owner: "Gateway lead",
    ord: 7,
  },
  {
    id: "phase-8",
    number: 8,
    name: "Developer Platform",
    description: "SDKs (6 langs), CLI, docs, playground, samples.",
    owner: "DevRel",
    ord: 8,
  },
  {
    id: "phase-9",
    number: 9,
    name: "Dashboard",
    description: "Portfolio, compute, models, ANNs, billing, settings.",
    owner: "Front-end lead",
    ord: 9,
  },
  {
    id: "phase-10",
    number: 10,
    name: "Genesis / IPO",
    description: "Capital formation, participation flow, allocation, governance onboarding.",
    owner: "Founders",
    ord: 10,
  },
  {
    id: "phase-11",
    number: 11,
    name: "Hardware",
    description: "Catalogue, reservations, device management, firmware.",
    owner: "Hardware lead",
    ord: 11,
  },
  {
    id: "phase-12",
    number: 12,
    name: "Enterprise",
    description: "Multi-tenancy, SSO, compliance, SLAs, dedicated clusters.",
    owner: "Enterprise lead",
    ord: 12,
  },
  {
    id: "phase-13",
    number: 13,
    name: "Observability",
    description: "Metrics, tracing, logs, alerts, status page, incidents.",
    owner: "SRE",
    ord: 13,
  },
  {
    id: "phase-14",
    number: 14,
    name: "Governance",
    description: "Proposals, voting, treasury, grants.",
    owner: "Founders",
    ord: 14,
  },
  {
    id: "phase-15",
    number: 15,
    name: "Knowledge",
    description: "Docs CMS, blog, tutorials, academy, certifications.",
    owner: "DevRel",
    ord: 15,
  },
];

// Initial seed tasks per phase. These are starting points, not exhaustive.
const SEED_TASKS: Array<{
  phaseId: string;
  title: string;
  description: string;
  status: "backlog" | "todo" | "in_progress" | "review" | "done";
  priority: "p0" | "p1" | "p2" | "p3";
  owner: string;
  storyPoints: number;
  tags: string;
}> = [
  // Phase 0
  { phaseId: "phase-0", title: "Initialize monorepo (Turborepo + pnpm workspaces)", description: "Set up the workspace, root scripts, task graph.", status: "todo", priority: "p0", owner: "Eng lead", storyPoints: 3, tags: "infra,monorepo" },
  { phaseId: "phase-0", title: "Extract design tokens to shared package", description: "Move globals.css and tailwind tokens into @aigarth/ui.", status: "todo", priority: "p0", owner: "Designer + eng", storyPoints: 3, tags: "design-system" },
  { phaseId: "phase-0", title: "Extract UI components to @aigarth/ui", description: "Move the shadcn primitives and custom components into a shared package.", status: "todo", priority: "p0", owner: "Designer + eng", storyPoints: 8, tags: "design-system" },
  { phaseId: "phase-0", title: "Scaffold @aigarth/sdk", description: "Typed client for the OpenAI-compatible gateway.", status: "todo", priority: "p0", owner: "Eng lead", storyPoints: 5, tags: "sdk" },
  { phaseId: "phase-0", title: "docker-compose for local stack", description: "Postgres, Redis, NATS, MinIO, MailHog.", status: "todo", priority: "p0", owner: "DevOps", storyPoints: 3, tags: "infra,local" },
  { phaseId: "phase-0", title: "CI pipelines (lint, type-check, test, build)", description: "GitHub Actions for every service + monorepo root.", status: "backlog", priority: "p1", owner: "Eng lead", storyPoints: 3, tags: "ci" },
  { phaseId: "phase-0", title: "Project tracker dashboard (this app)", description: "Operational Kanban + phase tracker for the whole build.", status: "done", priority: "p0", owner: "Eng lead", storyPoints: 5, tags: "meta,tooling" },
  { phaseId: "phase-0", title: "Write all foundational documents", description: "PRD, BRD, architecture, data model, API spec, security, sprint plan, risk register, team, governance, glossary, brand voice, contributing, dev guide, index.", status: "done", priority: "p0", owner: "Founders + agents", storyPoints: 8, tags: "docs,foundation" },
];

const DOCS = [
  { path: "../../docs/PRD.md", title: "Product Requirements Document", description: "Vision, users, surfaces, success metrics.", category: "Product", status: "draft" as const, readTimeMinutes: 12, order: 0 },
  { path: "../../docs/BRD.md", title: "Business Requirements Document", description: "Business model, milestones, capital formation.", category: "Business", status: "draft" as const, readTimeMinutes: 8, order: 1 },
  { path: "../../docs/ARCHITECTURE.md", title: "System Architecture", description: "Service map, data flow, deployment topology.", category: "Engineering", status: "draft" as const, readTimeMinutes: 10, order: 2 },
  { path: "../../docs/TECH-STACK.md", title: "Technology Stack", description: "Concrete tech decisions and the why behind each.", category: "Engineering", status: "draft" as const, readTimeMinutes: 8, order: 3 },
  { path: "../../docs/DATA-MODEL.md", title: "Data Model", description: "82+ domain objects and their owning services.", category: "Engineering", status: "draft" as const, readTimeMinutes: 15, order: 4 },
  { path: "../../docs/API-SPEC.md", title: "API Specification", description: "Endpoint contracts, error format, auth, rate limits.", category: "Engineering", status: "draft" as const, readTimeMinutes: 12, order: 5 },
  { path: "../../docs/SECURITY.md", title: "Security & Compliance", description: "Threat model, auth, encryption, compliance posture.", category: "Security", status: "draft" as const, readTimeMinutes: 10, order: 6 },
  { path: "../../docs/SPRINT-PLAN.md", title: "Sprint Plan", description: "Sprint-by-sprint build plan and velocity assumptions.", category: "Operations", status: "draft" as const, readTimeMinutes: 8, order: 7 },
  { path: "../../docs/RISK-REGISTER.md", title: "Risk Register", description: "Top 20 risks with likelihood/impact scoring and mitigations.", category: "Operations", status: "draft" as const, readTimeMinutes: 7, order: 8 },
  { path: "../../docs/TEAM-AND-ROLES.md", title: "Team and Roles", description: "Founders, agents, hiring plan, decision rights.", category: "Operations", status: "draft" as const, readTimeMinutes: 6, order: 9 },
  { path: "../../docs/GOVERNANCE.md", title: "Governance", description: "How decisions get made, decision log.", category: "Operations", status: "draft" as const, readTimeMinutes: 5, order: 10 },
  { path: "../../docs/GLOSSARY.md", title: "Glossary", description: "Domain terms, alphabetically.", category: "Reference", status: "draft" as const, readTimeMinutes: 4, order: 11 },
  { path: "../../docs/BRAND-VOICE.md", title: "Brand & Voice", description: "Voice principles, vocabulary rules, microcopy standards.", category: "Brand", status: "draft" as const, readTimeMinutes: 8, order: 12 },
  { path: "../../docs/CONTRIBUTING.md", title: "Contributing", description: "How to contribute, for humans and AI agents.", category: "Operations", status: "draft" as const, readTimeMinutes: 6, order: 13 },
  { path: "../../docs/DEVELOPER-GUIDE.md", title: "Developer Guide", description: "Local dev setup, commands, troubleshooting.", category: "Engineering", status: "draft" as const, readTimeMinutes: 7, order: 14 },
  { path: "../../docs/INDEX.md", title: "Documentation Index", description: "Every doc, in recommended reading order.", category: "Reference", status: "draft" as const, readTimeMinutes: 3, order: 15 },
  { path: "../../docs/ENDGAME-PROTO-PROPOSAL.md", title: "Endgame Proposal (Qubic Incubation)", description: "The submission to the Qubic CCF Incubation Program. The north star.", category: "Reference", status: "final" as const, readTimeMinutes: 15, order: 16 },
  { path: "../../docs/deliveries/phase-0-delivery.md", title: "Phase 0 — Foundation Delivery Report", description: "Acceptance criteria, what was built, verification results, decisions, and known limitations for Sprint 0.", category: "Reference", status: "final" as const, readTimeMinutes: 8, order: 17 },
  { path: "../../docs/deliveries/phase-1-delivery.md", title: "Phase 1 — Identity & Access Delivery Report", description: "Sprint 1 + 2 complete: identity service, schema, auth flow, orgs, members, teams, API keys, TOTP MFA, WebAuthn stub, Qubic wallet linking, audit log reads. All endpoints end-to-end tested.", category: "Reference", status: "final" as const, readTimeMinutes: 12, order: 18 },
  { path: "../../docs/deliveries/phase-3-delivery.md", title: "Phase 3 — Qubic Integration Delivery Report", description: "Stub-backed Qubic service: 9 tables, RPC client abstraction (stub + http + tcp-TODO), wallets, staking, treasury M-of-N multisig, TX monitor worker, 40+ assertion E2E. Ready to swap stub for real Qubic gateway.", category: "Reference", status: "final" as const, readTimeMinutes: 14, order: 19 },
  { path: "../../docs/deliveries/phase-2-delivery.md", title: "Phase 2 — Aigarth Core (Compute) Delivery Report", description: "Compute broker over Qubic's tick-based execution: 6 tables, 21 endpoints, regions/clusters/computors topology, reservations + capacity credits, full job lifecycle (queued → submitted → running → completed/failed/cancelled), NATS-driven job monitor worker. 12-section E2E green on first run.", category: "Reference", status: "final" as const, readTimeMinutes: 14, order: 20 },
  { path: "../../docs/deliveries/phase-7-delivery.md", title: "Phase 7 — AI Gateway Delivery Report", description: "OpenAI-compatible gateway surface: 6 tables, 10 endpoints, dual auth (JWT + API key), stub backends for chat (sync + SSE), embeddings, images. Sliding-window rate limit, per-call usage tracking, per-model pricing. SDK @aigarth/sdk now consumes it end-to-end.", category: "Reference", status: "final" as const, readTimeMinutes: 14, order: 21 },
  { path: "../../docs/deliveries/_TEMPLATE.md", title: "Delivery Report Template (Time-to-Ship Standard)", description: "Standard structure for every phase delivery report, including the time-to-ship section. Use this as the starting point for new phase reports.", category: "Reference", status: "final" as const, readTimeMinutes: 4, order: 19 },
  { path: "../../ROADMAP.md", title: "Engineering Roadmap", description: "16 phases, build order, architecture principles.", category: "Reference", status: "final" as const, readTimeMinutes: 8, order: 20 },
  { path: "../../docs/architecture-decisions/001-intelligence-economy-layer.md", title: "ADR 001 — Intelligence Economy Layer", description: "Architecture decision: rejected the 5-contract Intelligence Economy suite. Approved a narrow off-chain services/economy plugin. On-chain settlement deferred behind three explicit triggers. Read this before pitching per-ANN capital formation or on-chain ownership tokens.", category: "Engineering", status: "final" as const, readTimeMinutes: 15, order: 21 },
];

function main() {
  const db = getDb();
  console.log("Seeding tracker database...");

  // Phases
  const phaseInsert = db.prepare(
    `INSERT OR REPLACE INTO phases (id, number, name, description, status, progress, owner, started_at, target_end, notes, ord, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const p of PHASES) {
    const status = p.id === "phase-0" ? "in_progress" : "not_started";
    const progress = p.id === "phase-0" ? 15 : 0;
    phaseInsert.run(
      p.id,
      p.number,
      p.name,
      p.description,
      status,
      progress,
      p.owner,
      null,
      null,
      "",
      p.ord,
      nowIso(),
      nowIso()
    );
    console.log(`  phase ${p.number}: ${p.name}`);
  }

  // Tasks
  const taskInsert = db.prepare(
    `INSERT OR REPLACE INTO tasks (id, phase_id, title, description, status, priority, owner, story_points, tags, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  // Clear existing tasks (idempotent re-seed)
  db.prepare(`DELETE FROM tasks`).run();
  for (let i = 0; i < SEED_TASKS.length; i++) {
    const t = SEED_TASKS[i];
    if (!t) continue;
    const id = `seed-${t.phaseId}-${i}`;
    taskInsert.run(
      id,
      t.phaseId,
      t.title,
      t.description,
      t.status,
      t.priority,
      t.owner,
      t.storyPoints,
      t.tags,
      i,
      nowIso(),
      nowIso()
    );
  }
  console.log(`  ${SEED_TASKS.length} tasks seeded`);

  // Docs (resolve paths relative to dashboard cwd)
  const dashboardCwd = process.cwd();
  for (const d of DOCS) {
    // resolve doc path relative to the project root (two levels up from dashboard)
    const absPath = path.resolve(dashboardCwd, "..", d.path);
    let exists = false;
    let realSize = 0;
    try {
      const stat = fs.statSync(absPath);
      exists = true;
      realSize = stat.size;
    } catch {
      // doc file not on disk yet; still track it
    }
    upsertDoc({
      path: d.path,
      title: d.title,
      description: d.description,
      category: d.category,
      status: d.status,
      readTimeMinutes: d.readTimeMinutes,
      order: d.order,
    });
    if (exists) console.log(`  doc: ${d.path} (${realSize} bytes)`);
  }
  console.log(`  ${DOCS.length} docs tracked`);

  logActivity("note", "Tracker seeded with 16 phases, 8 starter tasks, and 18 documents");
  console.log("\nDone. Run `pnpm dev` to start the dashboard at http://localhost:4000");
}

main();
