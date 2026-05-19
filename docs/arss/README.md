# ARSS-Pay

ARSS-Pay is an agent-native syndication protocol: RSS/JSON Feed plus rights, attribution, context resources, subscriptions and x402 micropayments.

Core loop:

```text
Subscribe → Budget → Pay → Ingest → Cite → Remember
```

## Files

- `spec-v0.2.md` — normative draft protocol spec.
- `arss-pay-v0.2.tex` — LaTeX paper source.
- `arss-pay-v0.2.pdf` — rendered PDF.
- `schemas/` — JSON schemas for feed, subscription, capability and payment receipts.
- `examples/` — example feed and subscription manifests.

## CLI

```bash
npm run arss -- init --title "My Feed" --out public/.well-known/arss.json
npm run arss -- build ./content --title "My Feed" --home https://example.com --out public/arss.json
npm run arss -- convert-rss https://example.com/rss.xml --out arss.json
npm run arss -- price arss.json --canonical 0.001 --chunks 0.003 --recipient 0x... --out arss.paid.json
npm run arss -- validate arss.paid.json
npm run arss -- subscribe https://example.com/arss.json --out subscriptions/example.json --max-day 0.10
npm run arss -- sync subscriptions/example.json --feed arss.paid.json
npm run arss -- chunks arss.paid.json --out chunks.jsonl
npm run arss -- diet-add https://example.com --topics agents,payments
npm run arss -- diet-list
npm run arss -- pay-fetch subscriptions/example.json arss.paid.json --item https://example.com/post/1 --kind canonical_text --out item.md --dry-run
```

## MCP server

MCP SDK stdio server:

```bash
npm run arss:mcp
```

Tools:

- `arss_validate`
- `arss_subscribe`
- `arss_plan_sync`

## Demo publisher

```bash
npm run arss:demo-server
# optional x402 gate for paid resources:
ARSS_REQUIRE_PAYMENT=true npm run arss:demo-server
```

## Reference JSON resource

```json
{
  "kind": "canonical_text",
  "url": "https://publisher.com/arss/123.md",
  "access": "paid",
  "price": {
    "protocol": "x402",
    "network": "eip155:8453",
    "asset": "USDC",
    "amount": "0.001"
  }
}
```

## Current implementation status

Done:

- JSON Feed `_agent` profile.
- RSS/XML feed conversion.
- Markdown directory feed generation.
- x402 price annotation.
- Subscription manifests.
- Budget decision helper.
- Payment receipt object.
- CLI.
- MCP SDK stdio server.
- Schemas and examples.
- Chunk JSONL schema and generator.
- `pay-fetch` command with x402 buyer integration.
- Local demo publisher with optional x402-gated resources.

Next:

- Signature/JWS support.
- Local vector/memory adapter.
- Hosted public demo publisher.
- Registry/curation prototype.
