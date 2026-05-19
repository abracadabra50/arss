# ARSS roadmap

ARSS is past the “is there a shape here?” stage. The next work is about proof, packaging and distribution.

## 1. Registry becomes a product surface

- Host a stable registry URL, not a tunnel.
- Add feed health checks: last fetch, status, item count, last item date.
- Add publisher claim badges: unclaimed, same-origin claimed, signed, paid.
- Add categories, search, topic pages and “featured starter diets”.
- Add feed submission flow: URL in, discovery/validation out, human approval before listing.
- Add machine endpoints:
  - `/feeds.json`
  - `/topics/<topic>.json`
  - `/publishers/<publisher>.json`
  - `/subscriptions/<feed>.subscription.json`

## 2. Agent install path

- Package the CLI properly so `npx arss ...` works outside this repo.
- Add `arss init` for a local context diet + store.
- Add `arss subscribe <feed-or-registry-entry>` as the friendly path over `diet-add`.
- Add Claude Code / OpenClaw / Hermes templates that can be copied in one command.
- Add a daemon recipe for launchd, systemd and GitHub Actions.

## 3. Real evals, not theatre

- Keep deterministic reference evals for regression.
- Add live evals with source health and memory hit-rate over time.
- Add a paid-search baseline if available.
- Measure:
  - time-to-awareness
  - token cost per useful answer
  - source recall
  - inbox noise
  - answer citation accuracy
  - rights/payment policy compliance
- Save eval history so trends can be plotted.

## 4. Publisher claims and trust

- Let publishers claim feeds through `.well-known/arss-claim.json`.
- Verify same-origin feed ownership.
- Support optional EIP-191 signatures.
- Show claim status in the registry.
- Add anti-spam stake fields later; do not over-engineer this yet.

## 5. Paid content demo

- Host one demo ARSS publisher with:
  - free summary
  - paid canonical markdown
  - paid chunks JSONL
  - x402 settlement receipt
- Show an agent deciding whether to pay based on relevance and budget.
- This is the demo that makes the payment layer real.

## 6. Better adapters

- YouTube transcript enrichment with clearer miss reasons.
- Podcast transcript discovery beyond explicit `Transcript:` links.
- Newsletter ingestion via mailbox for private/paid subscriptions.
- GitHub releases/commits dedupe and summarisation.
- arXiv category throttling so it does not become paper soup.
- X/Twitter via official API or authenticated exporter only; public bridges are too flaky.

## 7. Memory policy

- Separate “archive everything” from “inject now”.
- Add source-level retention and quote policies.
- Track why an item was admitted or dropped.
- Add live subscribed fallback on memory miss.

## 8. Website narrative

- Build the public explainer:
  - RSS for humans.
  - MCP for tools.
  - ARSS for subscribed context.
  - x402 for paid resources.
- Include a working registry and one x402 demo.
- Keep it concrete. Protocol pages without behaviour are brochureware.
