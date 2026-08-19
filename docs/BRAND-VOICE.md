# Brand & Voice

**Product:** Aigarth Cloud
**Status:** Active
**Owner:** Design / Marketing
**Last updated:** 2026-07-27

---

## 1. Brand essence

Aigarth Cloud is what Apple designing AWS for decentralized AI would feel like. The brand sits at the intersection of:

- **Apple** — premium, minimal, considered
- **Anthropic** — calm, technical, research-grade
- **Stripe** — confident, polished, developer-loved
- **Cloudflare** — trustworthy, infrastructure-grade
- **Linear** — fast, opinionated, beautifully crafted

It is **not** crypto. It is not Web3. It does not use neon overload, meme culture, or abstract jargon. It is a cloud platform that happens to be powered by Qubic.

## 1b. Mark (updated 2026-08-16)

The Aigarth mark is a clean, geometric capital **A** in a soft forest-to-mint gradient (`#5eaaa8` to `#2E7D32`). The crossbar is a horizontal lens shape, evoking a leaf. A small leaf accent sits in the negative space above the crossbar. The garden hook is preserved, but the mark is now a confident letterform, not a literal branching network. The mark reads at every size, from 16px favicon to 240px OG card.

Files:
- `apps/web/components/brand/logo.tsx` — React component (Logo, LogoMark, LogoFull)
- `apps/web/public/brand/aigarth-mark.svg` — public SVG mark
- `apps/web/public/brand/aigarth-wordmark.svg` — public SVG wordmark (A + "Aigarth" + "Cloud" stacked)
- `apps/web/app/icon.svg` — favicon SVG (mark on soft tinted square)
- `apps/web/app/icon.tsx` — PNG favicon fallback (32x32)
- `apps/web/app/apple-icon.tsx` — Apple touch icon (180x180)
- `apps/web/app/favicon.ico` — multi-resolution ICO (16/32/48)
- `apps/web/app/opengraph-image.tsx` — 1200x630 social card
- `apps/web/scripts/build-favicon-ico.cjs` — build-time favicon regen

Use `LogoMark` for the A alone. Use `Logo` for nav headers. Use `LogoFull` for splash, sign-in, and the brand page. Use the public SVG assets for non-React surfaces (emails, PDFs, the brand asset kit).

## 2. Voice principles

| Principle | What it means | What it doesn't mean |
|---|---|---|
| **Calm** | We don't shout. We don't beg for attention. | Cold, distant, or detached |
| **Precise** | We say what we mean, exactly. No hedging, no fluff. | Dry, technical-only, or robotic |
| **Generous** | We explain complex things clearly. We respect the reader's time. | Preachy, oversimplified, or condescending |
| **Confident** | We know what we're building. We don't hedge. | Arrogant, dismissive, or oversold |
| **Human** | We write like a thoughtful person, not a brand machine. | Casual, sloppy, or unprofessional |

## 3. Vocabulary

### Use
- "Stake to reserve compute"
- "Useful Proof of Work"
- "OpenAI-compatible"
- "Cryptographically verifiable"
- "Earn on idle"
- "Build, deploy, monetize"
- "AI infrastructure"
- "Decentralized AI cloud"
- "ANN marketplace"
- "Production-grade"
- "First-class citizen"
- "Drop-in replacement"

### Avoid
- "Token" (use "stake" or "QUBIC" instead)
- "Moon", "lambo", "wagmi" (and any crypto bro vocabulary)
- "Web3" (we are not positioning as Web3)
- "Decentralized" used as a buzzword (always explain what's decentralized and why)
- "Disrupting" / "revolutionary" / "game-changing"
- "Synergy", "leverage", "unlock" (corporate jargon)
- "Empower", "transform" (used as filler)
- "AI-powered" (we ARE AI — don't describe it as a feature)
- "Cutting-edge" (overused, says nothing)
- Abstract nouns ("Intelligence", "Innovation") without grounding
- "Stake rewards" (use "earn" or "yield", not "rewards" which is generic)

## 4. Tone by context

| Context | Tone |
|---|---|
| Marketing site | Confident, aspirational, specific |
| Dashboard | Direct, factual, helpful |
| Documentation | Precise, example-driven, no filler |
| API errors | Specific, actionable, never blaming the user |
| Sales outreach | Warm, specific, value-led (not feature-led) |
| Press | Substantive, quotable, never promotional |
| Social | Conversational, never cringe |
| Internal | Direct, written, decision-oriented |

## 5. Microcopy rules

- Buttons say what they do, not what they are: "Reserve compute" not "Submit"
- Errors say what happened and what to do: "Your API key is invalid. Generate a new one." not "Error 401."
- Empty states invite action: "No ANNs yet. Browse the marketplace." not "Nothing here."
- Numbers are specific: "1,247 ANNs published" not "Thousands of ANNs"
- Time references are concrete: "in 14 days" not "soon"
- We avoid hedge words: "very", "really", "just", "simply"

## 6. The "so what" test

For every sentence in copy, ask: *so what?* If the answer isn't immediately clear, the sentence needs to go.

Example, before:
> "Aigarth Cloud leverages the unique capabilities of Qubic's Useful Proof of Work consensus mechanism to provide a decentralized AI infrastructure platform that empowers developers and enterprises to build, deploy, and monetize AI applications."

After:
> "Stake QUBIC. Reserve compute. Build AI products. Earn when you're not using it."

## 7. Visual identity

### Colors

- **Primary:** Garden Green `#2E7D32` (default brand) or Qubic Cyan `#25CAD9` (Qubic-themed). Switchable via the floating theme selector.
- **Neutrals:** Warm white, graphite, stone, soft charcoal
- **Accents:** Sage, moss, mint, emerald (default); cream gold (Qubic)
- **Avoid:** Pure black, pure white, neon green, anything that screams "crypto"

### Typography

- **Display:** Space Grotesk (geometric, modern — the Qubic-inspired choice)
- **Body:** Inter (workhorse, readable)
- **Code:** JetBrains Mono
- **Italic accent (Garden brand):** Instrument Serif
- **Avoid:** Overly decorative or "futuristic" fonts

### Motion

- Subtle, never distracting
- Smooth page transitions
- Animated diagrams (the ecosystem visualization, the timeline)
- Live counters and sparklines
- Soft shadows, gentle gradients
- Particle effects for the network visualization
- Never: coin flips, "to the moon" rockets, gratuitous explosions

## 8. Writing examples

### Headline (marketing)
- **Good:** "Grow your AI infrastructure."
- **Bad:** "Revolutionize AI with decentralized compute!"

### CTA
- **Good:** "Reserve compute" / "Start building" / "Open the console"
- **Bad:** "Get started now!" / "Join the revolution" / "Unlock the future"

### Subheadline
- **Good:** "Stake QUBIC to reserve intelligent compute, launch AI products, and monetize infrastructure through Useful Proof of Work."
- **Bad:** "Leverage the power of next-generation AI infrastructure powered by cutting-edge blockchain technology!"

### Error
- **Good:** "We couldn't find that ANN. It may have been unpublished, or the link is wrong."
- **Bad:** "Oops! Something went wrong. Please try again later."

### Empty state
- **Good:** "No API keys yet. Generate one to start making calls."
- **Bad:** "Nothing here yet!"

## 9. What we never say

- "We're excited to announce..." (cliché)
- "Stay tuned!" (we're not a YouTube channel)
- "Don't miss out!" (we don't FOMO)
- "Limited time offer" (this isn't a sale)
- "As seen on" (we don't need borrowed credibility)
- "Trusted by 10,000+ companies" (we say actual numbers when we have them)

## 10. Linked documents

- [`PRD.md`](./PRD.md)
- The existing front-end's design system in `app/globals.css` and `tailwind.config.ts`
