# Research Audit: v0.2 PEP External References

**Audited:** 2026-08-12 21:44 ET (2026-08-13 01:44 UTC)
**Auditor:** Wave 1 Research stream (general-purpose agent)
**Source:** `docs/proposals/aigarth-cloud-evolution-pep-v0.2.md` (Appendix A, dated 2026-08-11)
**Method:** `web_search` + `web_fetch` against primary sources; quotes verified against live pages.
**Hard rules respected:** v0.1 and v0.2 untouched. No service code touched. No `pnpm dev`.

---

## 1. Verdict Table

Each row is a v0.2 Appendix A claim, the live source as of 2026-08-12, and a verdict (✅ / ⚠️ / ❌).

| # | v0.2 Claim (Appendix A or §4) | Verdict | Live Source (URL + Date) | Direct Quote / Evidence |
|---|---|---|---|---|
| 1a | "Qubic All-Hands Recap (July 23, 2026)" is the most recent All-Hands recap | ⚠️ | A NEW recap exists: <https://qubic.org/blog-detail/qubic-all-hands-recap-august-6-2026> (published 2026-08-11T10:08:40Z, modified 2026-08-12T19:23:51Z per JSON-LD; surfaced on the Qubic blog grid dated "Aug 13, 2026") | "**Qubic All-Hands Recap: August 6, 2026** … Two systems went live on Qubic mainnet in a single fortnight: Outsourced Computing and the BPP-9000 mining algorithm." The v0.2 reference is no longer the most recent. |
| 1b | "BPP-9000 activates at Epoch 224" (Appendix A) / "BPP-9000 is the current uPoW (Epoch 224, late July 2026)" (§1) | ⚠️ → now ✅ | <https://qubic.org/blog-detail/qubic-all-hands-recap-august-6-2026> (modified 2026-08-12T19:23:51Z) | "**BPP-9000 mining** … **Live on mainnet**" (table row); also "BPP 9,000, the new Qubic mining algorithm, is now live on mainnet as of epoch 224" (Qubic LinkedIn, 2026-08-06, <https://www.linkedin.com/posts/qubicnetwork_bpp-9000-the-new-qubic-mining-algorithm-activity-7490739259809718272-7xGq>). The activation happened, but the *state* is now "live", not "activating". |
| 1c | "Outsourced Computations shipped its first code to mainnet in Epoch 223. Full production is targeted for early-to-mid August." | ⚠️ → now ✅ | <https://qubic.org/blog-detail/qubic-all-hands-recap-august-6-2026> (modified 2026-08-12T19:23:51Z) | "**Outsourced Computing** … **Live on mainnet (2026-07-29)**" (table row). The full production target has been hit. |
| 1d | OM traffic numbers (§3 + §4 reference; v0.2 §16 cites "Oracle Machines production" linked to April 30, 2026 recap) | ✅ unchanged | <https://qubic.org/blog-detail/qubic-all-hands-recap-april-30-2026> (2026-04-30) | "Oracle Machines reached full production, powering DOGE share validation at scale and processing over 600,000 queries in Epoch 210 alone." "Oracle queries hit an all-time record of 608,548 in the same epoch, up from a pre-DOGE baseline of ~15,000. That is a 40x increase." The Aug 6, 2026 recap does not quote a fresh OM traffic number — no new drift to surface on OM specifically. |
| 1e | Roadmap updates from the Qubic side | ⚠️ | <https://qubic.org/blog-detail/qubic-all-hands-recap-august-6-2026> | New roadmap items v0.2 did not capture: (a) "Ant colony mining algorithm — EP228" (the next uPoW after BPP-9000); (b) "BPP-9000 scoring tuned for scale — this quarter"; (c) "More Outsourced Computing interfaces — this quarter"; (d) "Oracle-machine smart-contract auto-merge — this quarter"; (e) "Penalty system for misbehaving computers — this quarter"; (f) "Final two security actions — end of September"; (g) "QUBIC halving (Epoch 227) — 19 August 2026". |
| 2 | "Neuraxon 2.0 open-sourced: github.com/DavidVivancos/Neuraxon … latest commit May 28, 2026" (§4) | ⚠️ | Atom feed: <https://github.com/DavidVivancos/Neuraxon/commits/main.atom> (fetched 2026-08-12 21:44 ET) | Most recent commit is **2026-08-12T13:42:56Z** (`1085cd75…` "Delete GameOfLife/NxonLive/nohup.out"). The next three are also 2026-08-12 (cf0d078, 9f1ce5e, 94862b9). The "May 28, 2026" stamp is the README's "Latest commit" of the README file (94d46d2), not the repo HEAD. Active commits continue through 2026-08-02, 2026-07-11, 2026-06-24, 2026-06-19, 2026-06-11, 2026-06-05, 2026-05-30. The repo is not in a quiet period. |
| 3 | "Neuraxon 2.0 ARC-AGI-3 score: 0.21% (July 22, 2026, doubled from 0.13%)" (§4 + Appendix A) | ⚠️ | <https://qubic.org/blog-detail/qubic-all-hands-recap-august-6-2026> (modified 2026-08-12T19:23:51Z) | "On ARC-AGI-3, one of the toughest reasoning tests in AI, Qubic's models roughly doubled their score to **0.25**. This is the strict offline Kaggle version of the test, run with no internet access, so the result reflects genuine reasoning rather than lookup." v0.2's 0.21% is stale; the cumulative framing is "doubled" from the 0.13% baseline, with the latest absolute number being ~0.25%. |
| 4 | "Neuraxon 2.0 paper accepted at AGI-26" (§4 + Appendix A) | ✅ | <https://qubic.org/blog-detail/qubic-all-hands-recap-august-6-2026>; <https://qubic.org/blog-detail/qubic-all-hands-recap-june-11-2026> | "In San Francisco, the 19th International Conference on Artificial General Intelligence (July 27–30, 2026) accepted Qubic's Multi-Neuraxon work, now **published in Springer's AGI proceedings**. Multi-Neuraxon links many of these artificial neurons into a proto-brain with separate regions for tasks like vision and sound." The AGI-26 conference dates (July 27–30, 2026) are in the past as of audit; the work has moved from "accepted" to "accepted + presented + Springer-published". Also: a *second* paper, "The Neutral Buffer State", won Best Oral Presentation at AMLDS 2026 in Osaka (July 21–23, 2026) — its "second best-paper award this year" per the Aug 6 recap. |
| 5 | "cuNxon CUDA library (May 2026)" (Appendix A) | ✅ | Atom feed (cuNxon subfolder): <https://github.com/DavidVivancos/Neuraxon/commits/main/cuNxon.atom> (fetched 2026-08-12 21:44 ET) | The cuNxon subfolder has only 2 commits: 2026-05-14T14:34:47Z (`10bad911…` "Update README for clarity and correctness") and 2026-05-13T08:08:14Z (`b4f6db85…` "First Multi Neuraxon Cuda Kernels and Nvidia Cuda Library to deploy MultiNxon 2.0"). No newer cuNxon-specific version. The May 2026 release is the latest. |
| 6 | "Qubic OC shipped to mainnet (Epoch 223). Full production target July 29 / early-mid August." (Appendix A + §1) | ⚠️ → now ✅ (with proof of life) | <https://qubic.org/blog-detail/qubic-all-hands-recap-august-6-2026>; <https://ocmock.qubic.org/> (referenced in recap) | "Outsourced Computing is best understood as the bridge between a Qubic app and everything outside Qubic … Operators are setting up and testing their environments now, and anyone can watch what the network triggers in the test setup at ocmock.qubic.org." Mainnet live since 2026-07-29 (as per the table row in the same page). The July 29 target was hit on schedule. |
| 7 | "BPP-9000 activates at Epoch 224" (Appendix A + §1) | ⚠️ → now ✅ | <https://qubic.org/blog-detail/qubic-all-hands-recap-august-6-2026> | "BPP-9000 changes what mining rewards … Miners used to be paid for producing the most answers. Now they are paid for producing the best one, and lower error scores win. That single change pushes every miner toward quality, which is exactly what the research behind Qubic's AI needs." Status row: "**Live on mainnet**". Epoch 224 activation was on schedule (late July 2026). |

**Aggregate:** 4 ✅ (still accurate), 5 ⚠️ (changed but not breaking), 0 ❌ (no longer true). No claim is fully invalidated. The headline drift is: (a) the *recap* v0.2 cited is no longer the most recent, and (b) every "is happening soon" item is now "is live".

---

## 2. Drift Log

Items that have moved since 2026-08-11 (the v0.2 "verified" date) and that should influence downstream design or document work.

### D-1 — A new Qubic All-Hands Recap exists (Aug 6, 2026, published 2026-08-11)
- **Source:** <https://qubic.org/blog-detail/qubic-all-hands-recap-august-6-2026>
- **JSON-LD `datePublished`:** 2026-08-11T10:08:40.151Z; **`dateModified`:** 2026-08-12T19:23:51.731Z. The page was live as of audit time.
- **Impact:** v0.2 Appendix A does not list it. v0.2 §3, §4, §16, §17 are based on the July 23 recap. A v0.3 should swap Appendix A's source list, or add a v0.2.1 addendum pointing here.

### D-2 — Both OC and BPP-9000 went live in the same fortnight
- **Source:** Aug 6, 2026 recap (above). Table excerpt: "Outsourced Computing — Live on mainnet (2026-07-29)" and "BPP-9000 mining — Live on mainnet".
- **Impact:** v0.2 §1 calls OC "third pillar" and BPP-9000 the "current uPoW". Both descriptions remain valid, but the operational status moved from "shipping" to "shipping + operators on-net". The OC mock at <https://ocmock.qubic.org/> is now the public test surface.

### D-3 — Multi-Neuraxon is published in Springer's AGI proceedings (not merely accepted)
- **Source:** Aug 6, 2026 recap; <https://qubic.org/blog-detail/qubic-all-hands-recap-june-11-2026>
- **Impact:** v0.2 §4 says "accepted at AGI-26". It is now also presented and published. Cite the Springer venue for any peer-review claim going forward.

### D-4 — A *second* Neuraxon paper won Best Oral at AMLDS 2026 Osaka
- **Source:** Aug 6, 2026 recap: "The team's paper on this idea, 'The Neutral Buffer State,' won Best Oral Presentation at the AMLDS 2026 conference in Osaka (July 21–23, 2026), its second best-paper award this year."
- **Impact:** v0.2 §4 lists only one peer-reviewed venue (ICMLT Berlin). There are now two 2026 Neuraxon best-paper awards (ICMLT Berlin + AMLDS Osaka) plus the AGI-26 Springer publication. v0.2 §4 should be updated.

### D-5 — ARC-AGI-3 score moved 0.21% → 0.25% (Kaggle offline)
- **Source:** Aug 6, 2026 recap.
- **Impact:** Marginal absolute change (+0.04 pp) but the recap describes it as "doubled" because the baseline was 0.13% (June). The narrative frame is "continued, steady, small" rather than "breakthrough". v0.2's "doubled to 0.21%" wording is now stale; the 0.25% number should replace it.

### D-6 — 44-day Game of Life run with ~1000 community Neuraxons, inheritance experimentally observed
- **Source:** Aug 6, 2026 recap: "the team's evolutionary 'Game of Life' ran nonstop for 44 days with about a thousand community-built Neuraxons competing. The standout finding was inheritance: offspring carried traits from their parents, a result now feeding the next round of papers. That dataset publishes on Hugging Face next week."
- **Impact:** This is the single most relevant external finding for the Aigarth evolution thesis. v0.2 §4 and §6 (Organism) build their adaptation/evolution argument on the conceptual possibility of mutation + selection. The 44-day run provides a *public empirical anchor*: 1000 Neuraxons, 44 days, inheritance is real. The full dataset (publishing on Hugging Face the week of 2026-08-11) is the closest external proxy for what an Aigarth Organism would have to produce.

### D-7 — Neuraxon GitHub repo is *active* (4 commits today, 2026-08-12)
- **Source:** Atom feed <https://github.com/DavidVivancos/Neuraxon/commits/main.atom>. Most recent: `1085cd75` 2026-08-12T13:42:56Z. Also: 2026-08-02, 2026-07-11, 2026-06-24, 2026-06-19, 2026-06-11, 2026-06-05, 2026-05-30.
- **Impact:** v0.2 §4 says "latest commit May 28, 2026" — this is the README's most-recent commit, not the repo HEAD. The repo is in motion. Anyone planning a Phase 31 (Neuraxon integration) work block should not assume the code is "frozen" since May.

### D-8 — cuNxon: no new release
- **Source:** <https://github.com/DavidVivancos/Neuraxon/commits/main/cuNxon.atom>
- **Impact:** v0.2's "May 2026" cuNxon claim is still accurate. No drift.

### D-9 — New Qubic-side roadmap items not in v0.2
- **Source:** Aug 6, 2026 recap (Q3 2026 roadmap table).
- **Items:** (a) **Ant colony mining algorithm — EP228** (the next uPoW after BPP-9000, lets tasks chain across machines); (b) BPP-9000 scoring tuned for scale — this quarter; (c) more OC interfaces — this quarter; (d) Oracle-machine smart-contract auto-merge — this quarter; (e) penalty system for misbehaving computers — this quarter; (f) final two security actions — end of September; (g) QUBIC halving at Epoch 227 — **2026-08-19** (within 7 days of audit).
- **Impact:** v0.2 §17 (BPP-9000) treats BPP-9000 as a single-algorithm precedent. The *next* Qubic mining algorithm is now announced: ant colony. For Aigarth, ant-colony-style "tasks chain across machines" is conceptually adjacent to the v0.2 §11 Work Unit's "Work items chained via evidence" framing. v0.3 should reference the EP228 target.

### D-10 — AIO Dev Kit publicly released 2026-08-04
- **Source:** Aug 6, 2026 recap table.
- **Impact:** Cheap local smart-contract testing changes the cost of building an OC processor dramatically. Aigarth's OC processor design (v0.2 §16) becomes much cheaper to prototype on the Qubic side. The barrier to "register Aigarth as an OC processor" is now mainly on the Aigarth side, not on the Qubic side.

### D-11 — QUBIC halving 2026-08-19 (Epoch 227)
- **Source:** Aug 6, 2026 recap, "Qubic Roadmap" table: "QUBIC halving (Epoch 227) — 19 August 2026".
- **Impact:** Emission drops from ~453 bQu/week to ~226 bQu/week; protocol burn rises from 55% to 77.5% (per July 23, 2026 recap). If any Aigarth tokenomics model uses QUBIC-denominated figures (v0.2 §27 Economics), the halving should be a re-baseline checkpoint.

### D-12 — BFrost trustless bridge (OC + ZK) coming in ~1.5–2 months
- **Source:** Aug 6, 2026 recap, ecosystem section.
- **Impact:** v0.2 §16 is silent on bridges. If Aigarth's work-item accounting ever needs to cross Qubic ↔ EVM, BFrost is the named cross-chain primitive. Note as adjacent infrastructure; not a v0.2 decision point.

---

## 3. Implications for the Swarm

**For the build stream:** the *temporal* structure of v0.2 is now shifted. Every "is coming soon" claim in v0.2 §1, §3, §4, §16, §17 (OC, BPP-9000, Neuraxon integration timing) is at least one step further along. v0.2 §11 (Work Runtime) and §16 (Qubic) can be treated as designing *on* a live protocol rather than against a shipping schedule. The 2026-08-19 QUBIC halving is a hard date inside the next 7 days; tokenomics in v0.2 §27 that depend on QUBIC emissions should be re-checked post-halving.

**For the design stream:** the single most important new fact is D-6 — the 44-day Neuraxon Game of Life run with inheritance is a *public empirical anchor* for the Aigarth evolution thesis. v0.2 §8 (Adaptation Equation) and §9 (Discovery) argue conceptually; D-6 supplies a published dataset that can be cited as a *precedent*, not just a hypothesis. v0.3 should reference the upcoming Hugging Face dataset by name once it is published (expected week of 2026-08-11).

**For the document stream:** v0.2 Appendix A is the single artifact that needs a one-link update (add the Aug 6, 2026 recap URL). Beyond that, v0.2 §4 needs a "+2" in the "Neuraxon Technical Assessment" maturity column to reflect the second best-paper award, the Springer publication, and the 0.25% ARC-AGI-3 number. v0.2 §17 should add a footnote for the ant-colley mining target (EP228) and the 2026-08-19 halving. None of these are *breaking* changes; v0.2 is still defensible, just dated by 1 day.

**Bottom line for the orchestrator:** the v0.2 thesis is intact. The numbers moved up and to the right. The build/design streams should *not* delay work waiting for Neuraxon or Qubic to "ship" — both have shipped. The next milestone to watch externally is the Game of Life dataset publish on Hugging Face (D-6, ETA week of 2026-08-11), and the QUBIC halving on 2026-08-19 (D-11).

---

## 4. Sources Index

Primary sources cited above, in order of first appearance:

1. <https://qubic.org/blog-detail/qubic-all-hands-recap-august-6-2026> — most recent Qubic All-Hands Recap (Aug 6, 2026; published 2026-08-11; modified 2026-08-12T19:23:51Z)
2. <https://qubic.org/blog-detail/qubic-all-hands-recap-july-23-2026> — v0.2's referenced recap
3. <https://qubic.org/blog-detail/qubic-all-hands-recap-july-9-2026> — Neuraxon scored 0.18 on ARC-AGI-3 (interim)
4. <https://qubic.org/blog-detail/qubic-all-hands-recap-june-25-2026> — Neuraxon Game of Life Live, Session 5
5. <https://qubic.org/blog-detail/qubic-all-hands-recap-june-11-2026> — AGI-26 acceptance + NxOn Live v1.0
6. <https://qubic.org/blog-detail/qubic-all-hands-recap-may-28-2026> — Neuraxon Game of Life v5 + Nxon Live
7. <https://qubic.org/blog-detail/qubic-all-hands-recap-may-14-2026> — cuNxon release + ICMLT Berlin
8. <https://qubic.org/blog-detail/qubic-all-hands-recap-april-30-2026> — OM production: 608,548 queries in Epoch 210
9. <https://qubic.org/blog-detail/qubic-outsourced-computation-tech-on-deck-ama-june-2026> — OC design AMA
10. <https://qubic.org/blog-detail/qubic-three-pillars-smart-contracts-oracle-machines-outsourced-computation> — Three Pillars framing
11. <https://github.com/DavidVivancos/Neuraxon/commits/main.atom> — canonical commit list (HEAD = 1085cd75, 2026-08-12T13:42:56Z)
12. <https://github.com/DavidVivancos/Neuraxon/commits/main/cuNxon.atom> — cuNxon subfolder (last commit 2026-05-14T14:34:47Z)
13. <https://github.com/DavidVivancos/Neuraxon> — repo landing (README references cuNxon)
14. <https://github.com/DavidVivancos/Neuraxon/releases> — "There aren't any releases here" (no formal Neuraxon 2.0 release yet)
15. <https://ocmock.qubic.org/> — public OC test setup dashboard
16. <https://x.com/_Qubic_/status/2015745696406655312> — Neuraxon Life 2.5 research release announcement
17. <https://www.linkedin.com/posts/qubicnetwork_bpp-9000-the-new-qubic-mining-algorithm-activity-7490739259809718272-7xGq> — BPP-9000 live at epoch 224
18. <https://ourcryptotalk.com/news/qubic-neuraxon-accepted-agi-26-conference> — AGI-26 acceptance (May 2026)
19. <https://www.linkedin.com/posts/qubicnetwork_neuraxon-reached-021-on-the-arc-agi-3-benchmark-activity-7486692331212152832-7GSA> — 0.21% LinkedIn post (July 2026)

---

## 5. Audit Limitations

- **OM traffic numbers:** the Aug 6, 2026 recap does not quote a fresh OM query count. Last public number is 608,548 in Epoch 210 (April 30, 2026). To re-verify "OM at scale today" requires either a Qubic dashboard fetch or a newer post-AGI-26 follow-up.
- **Neuraxon ARC-AGI-3 0.25%:** the Aug 6 recap is the only place this number appears. It is not yet on the official ARC-AGI-3 leaderboard (benchlm.ai shows Claude Opus 5 at 30.2% as the top public entry, with the 0.25% Neuraxon score sitting in a different evaluation track). Cross-track comparisons are not apples-to-apples.
- **Game of Life dataset:** "publishes on Hugging Face next week" is from the Aug 6 recap. The publish date as of this audit (2026-08-12) is not yet confirmed. Re-verify on Hugging Face by 2026-08-19.
- **Neuraxon 0.25% in §4 of v0.2:** the v0.2 PEP text (§4) does not cite the 0.21% number; only Appendix A does. So the §4 *narrative* (Maturity, CPU capability, CUDA capability) is unchanged in spirit. The 0.25% in this audit is what Appendix A should now cite.
- **Neuraxon release artifacts:** no formal GitHub releases exist (the /releases page is empty). Versioning is by Game of Life internal version numbers (v5.10, v192–v196 in changelogs) and a README, not by tagged releases.

---

*End of audit. No code, services, or PEP files were modified during this work.*
