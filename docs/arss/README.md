# ARSS

ARSS is agent-readable syndication: RSS/Atom/JSON Feed plus agent rights, attribution, context resources, subscription manifests, registry discovery, memory delivery and optional x402 payment rails.

Core loop:

```text
Discover → Subscribe → Heartbeat → Remember → Inject narrowly → Fetch live on miss → Cite
```

Payment is optional and explicit:

```text
Free public feeds first.
Paid resources only when a publisher declares them and the local agent/user grants budget.
```

## Papers

- `arss-v0.3-subscribed-context-paper.md` — current paper: subscribed context, registry, evals, free-first payment posture.
- `arss-v0.2-payments-paper.md` — earlier payments-first ARSS-Pay draft.
- `arss-v0.1-paper.md` — earlier protocol draft.
- `ARSS-v0-paper.md` — short original concept note.

## Specs and design docs

- `spec-v0.2.md` — normative draft protocol spec.
- `PROTOCOL.md` — protocol notes.
- `SUBSCRIPTIONS.md` — subscription model.
- `REGISTRY.md` — registry and publisher claims.
- `ROADMAP.md` — next implementation/product work.
- `heartbeat-integration.md` — background heartbeat delivery.
- `subscription-delivery.md` — delivery model.
- `content-adapters.md` — adapters for RSS, YouTube, podcasts, docs and other sources.
- `schemas/` — JSON schemas for feed, subscription, capability, payment receipt and registry objects.
- `examples/` — example feed and subscription manifests.

## Registry

Build the static registry:

```bash
npm run registry:build
```

Outputs:

```text
registry/index.html                         human browsable registry
registry/feeds.json                         machine-readable registry
registry/README.md                          table export
registry/subscriptions/*.subscription.json  free-only per-feed manifests
registry/categories/*.json                  category bundles
```

Import a single feed:

```bash
npm run arss -- feed-registry-import registry/feeds.json --feed simon-willison --sync-now
```

Import a whole category:

```bash
npm run arss -- feed-registry-import registry/feeds.json --category "Frontier labs" --sync-now
```

Import everything:

```bash
npm run arss -- feed-registry-import registry/feeds.json --all --sync-now
```

## CLI

```bash
npm run arss -- init --title "My Feed" --out public/.well-known/arss.json
npm run arss -- build ./content --title "My Feed" --home https://example.com --out public/arss.json
npm run arss -- convert-rss https://example.com/rss.xml --out arss.json
npm run arss -- validate arss.json
npm run arss -- subscribe https://example.com/arss.json --out subscriptions/example.json
npm run arss -- pull subscriptions/example.json --store artefacts/arss/store
npm run arss -- search "agent subscriptions" --store artefacts/arss/store
npm run arss -- diet-add https://example.com --topics agents,payments
npm run arss -- diet-list
npm run arss -- feed-registry-list registry/feeds.json
npm run arss -- pay-fetch subscriptions/example.json arss.paid.json --item https://example.com/post/1 --kind canonical_text --out item.md --dry-run
```

## Evals

Reference eval:

```bash
npm run eval
```

Live subscribed-source eval:

```bash
npm run eval:live
```

## MCP server

```bash
npm run arss:mcp
```

## Demo publisher

```bash
npm run arss:demo-server
# optional x402 gate for paid resources:
ARSS_REQUIRE_PAYMENT=true npm run arss:demo-server
```

## Current implementation status

Done:

- JSON Feed `_agent` profile.
- RSS/Atom/JSON Feed conversion.
- `llms.txt`-style source ingestion.
- Markdown directory feed generation.
- Subscription manifests and local store.
- Free-only public registry manifests.
- Registry category bundles.
- Feed registry generator with human UI and machine JSON.
- Context diets.
- Heartbeat sync.
- Transcript cache/enrichment.
- CLI.
- Daemon.
- MCP SDK stdio server.
- Schemas and examples.
- Chunk JSONL schema and generator.
- x402 price annotation and `pay-fetch`.
- Local demo publisher with optional x402-gated resources.
- Reference and live eval harnesses.

Next:

- Stable hosted registry URL.
- Package for real `npx arss` use.
- Feed health checks.
- Publisher claim badges.
- Feed submission flow.
- Eval history.
- End-to-end x402 paid-content demo.
- Better private newsletter/transcript adapters.
