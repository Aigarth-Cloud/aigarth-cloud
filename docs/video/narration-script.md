# Trinary Intelligence — Video Narration Script

**Total runtime:** ~90 seconds
**Voice:** `male-qn-qingse` (calm, authoritative, conversational)
**Music:** subtle ambient synth pad underneath
**Format:** 6 segments, one per architecture diagram

---

## Segment 1 — Hero (0:00–0:08)

> Aigarth ANNs used to give you a best-guess answer. Today, every
> network decision is **trinary**: proceed, observe, or block.
>
> This is the Trinary Intelligence Layer. Three states. One signed
> envelope. Six minutes from now you'll know how it works.

## Segment 2 — The Envelope (0:08–0:24)

> Every /decide call returns the same shape — an **IntentEnvelope**.
> State, confidence, authority, reasoning, reversibility, time
> horizon, supporting signals, and a cryptographic signature.
>
> Same shape whether the answer is +1, 0, or -1. Same signature
> scheme. You can store it, replay it, audit it. The model said
> something isn't good enough anymore. You get a decision and a
> signature.

## Segment 3 — The Tissue (0:24–0:46)

> A **tissue** is a composition of ANNs. Pick a consensus policy,
> add members, publish.
>
> Here's a risk review: sales, risk, and finance each cast a
> vote. The risk ANN has veto power — if it returns -1, the whole
> tissue blocks, regardless of how the others voted.
>
> The same IntentEnvelope comes out as from a single ANN. Downstream
> consumers can't tell the difference. The decision is signed,
> the audit trail is append-only, and the override is recorded.

## Segment 4 — The /decide Flow (0:46–1:06)

> Here's what happens when a caller asks the tissue to decide.
>
> Step 1: access check — owner always, or licensed-mode requires
> an explicit grant.
>
> Step 2: parallel fanout. Every member ANN is called at the same
> time, with a per-call timeout.
>
> Step 3: combine. The policy turns three envelopes into one.
>
> Step 4: sign and persist. The decision lands in the append-only
> log. The caller gets the signed envelope back. Member failures
> never block the decision — they're recorded as ignored.

## Segment 5 — The Stack (1:06–1:24)

> Five layers, one wire contract.
>
> At the bottom: the trinary protocol itself — the signed envelope
> shape every service speaks.
>
> Above that: the ANN service, where each network registers its
> intelligence and signs its envelopes.
>
> The tissue service sits in the middle, running the consensus
> algebra, enforcing access control, and firing the billing and
> marketplace hooks.
>
> The gateway exposes this through the OpenAI-compatible chat
> completions API, with an opt-in `aigarth_intent: trinary` flag.
>
> At the top: the SDK, with `client.tissues.decide` and
> `client.marketplace.tissueListings`.

## Segment 6 — Monetization (1:24–1:30)

> And the product surface ties it all together. Wrap a tissue in a
> marketplace listing with a per-decision price. The billing
> service meters every call, rolls it into the next invoice as an
> `overage_tissue` line item. Same fee for +1, 0, and -1 — no
> perverse incentive to avoid the hard answers.
>
> Welcome to the Trinary Intelligence Layer. The protocol is
> live. The Studio is open. Go build a tissue.

---

## Per-segment timing

| Segment | Image | Words | Target seconds |
|---------|-------|-------|----------------|
| 1. Hero | 01_hero.png | 38 | 8s |
| 2. Envelope | 02_envelope.png | 65 | 16s |
| 3. Tissue | 03_tissue.png | 86 | 22s |
| 4. /decide flow | 04_decide_flow.png | 76 | 20s |
| 5. Stack | 05_stack.png | 73 | 18s |
| 6. Monetization | 06_monetization.png | 56 | 14s (slight pause for music) |

## Generation command (per segment)

```bash
synthesize_speech(
  text=<segment script>,
  output_file_path=docs/video/assets/seg{N}_narration.mp3,
  voice_id="male-qn-qingse",
  speed=1.0,
  emotion="neutral",
)
```
