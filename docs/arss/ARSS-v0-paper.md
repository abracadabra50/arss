# ARSS v0 — Agent RSS for the context web

## Abstract

RSS let humans subscribe to websites. The agent layer needs the same primitive, but the unit of consumption is no longer a web page opened by a person; it is context retrieved, cached, reasoned over, cited, paid for and forgotten by software agents.

ARSS is a backwards-compatible fork of RSS/Atom/JSON Feed for agent-readable content subscriptions. It adds machine-usable rights, provenance, freshness, chunking, payments and receipts while preserving the original web distribution model: publishers publish feeds, subscribers poll or receive updates, and intermediaries can index without owning the relationship.

## Problem

Publishers are exposed by the agent web:

- Agents answer without sending human clicks.
- Search and social traffic decline as assistants mediate discovery.
- Scrapers treat content as raw model context, ignoring attribution and rights.
- Robots.txt is binary and crawler-centric: it cannot express cache TTLs, quote limits, agent-use permissions or paid access.
- Paywalls are human-session products, not machine-consumable protocols.
- llms.txt helps agents discover documentation, but it is not a subscription, rights or payment layer.

Users also have a problem:

- Their agents need durable context from trusted sources.
- Current agents depend on search/scrape at query time, which is stale, noisy and rights-blind.
- Users cannot say “keep my agent current on these sources and respect the publisher’s rules.”

ARSS restores the direct publisher-subscriber relationship for agents.

## Non-goals

- ARSS is not a new social network.
- ARSS is not a generic task marketplace.
- ARSS is not a replacement for RSS, Atom, ActivityPub, MCP, A2A, robots.txt, llms.txt or x402.
- ARSS is a small feed extension that composes with those protocols.

## Core idea

A publisher exposes an agent feed. An agent subscribes. Each item carries:

- canonical content metadata
- machine-readable summary and chunks
- rights and cache rules
- provenance/signature
- payment terms for full text, archives or premium streams
- optional receipt requirements

The agent stores a local context index with TTLs and source attribution. When answering, it can cite and comply with the feed’s rights.

## Discovery

Publishers SHOULD expose:

```text
/.well-known/arss.json
/arss.xml
/arss.json
```

Existing RSS/Atom feeds MAY advertise ARSS via an XML namespace:

```xml
<rss version="2.0" xmlns:arss="https://arss.dev/ns/1.0">
```

HTML pages MAY include:

```html
<link rel="alternate" type="application/arss+json" href="/arss.json">
<link rel="alternate" type="application/rss+xml" href="/rss.xml">
```

## Feed shape

```json
{
  "version": "https://arss.dev/spec/0.1",
  "title": "Example Publisher",
  "home_url": "https://example.com",
  "feed_url": "https://example.com/arss.json",
  "publisher": {
    "name": "Example Media Ltd",
    "id": "did:web:example.com",
    "public_key": "did:web:example.com#arss-key-1"
  },
  "rights_default": {
    "agent_read": true,
    "cache_ttl_seconds": 604800,
    "quote_limit_chars": 500,
    "training_allowed": false,
    "requires_attribution": true
  },
  "payment": {
    "protocols": ["x402"],
    "summary": "free",
    "full_text": "x402:$0.01",
    "subscription": "x402:$5/month"
  },
  "items": []
}
```

## Item shape

```json
{
  "id": "tag:example.com,2026:article-123",
  "url": "https://example.com/article-123",
  "canonical_url": "https://example.com/article-123",
  "title": "Why agent feeds matter",
  "summary": "A concise summary safe for agent indexing.",
  "published_at": "2026-05-18T12:00:00Z",
  "updated_at": "2026-05-18T13:00:00Z",
  "expires_at": "2026-06-18T00:00:00Z",
  "topics": ["agents", "publishing", "protocols"],
  "content": {
    "format": "markdown",
    "summary_inline": true,
    "full_text_url": "https://example.com/arss/items/article-123/full",
    "chunks_url": "https://example.com/arss/items/article-123/chunks",
    "embedding_hints_url": "https://example.com/arss/items/article-123/hints"
  },
  "rights": {
    "agent_read": true,
    "cache_ttl_seconds": 604800,
    "quote_limit_chars": 500,
    "training_allowed": false,
    "requires_attribution": true,
    "allowed_uses": ["answering", "summarisation", "personal_context"],
    "disallowed_uses": ["model_training", "republishing_full_text"]
  },
  "payment": {
    "summary": "free",
    "full_text": {
      "protocol": "x402",
      "price": "$0.01",
      "asset": "USDC",
      "resource": "https://example.com/arss/items/article-123/full"
    }
  },
  "provenance": {
    "content_hash": "0x...",
    "signature": "0x...",
    "signature_alg": "ed25519"
  },
  "receipts": {
    "required_for_full_text": false,
    "accepted": ["arss.receipt.v0"]
  }
}
```

## Subscription

Subscription is deliberately boring:

1. Agent discovers feed.
2. Agent records subscription in a local manifest.
3. Agent polls with ETag/If-Modified-Since or subscribes via WebSub/SSE/webhook.
4. Agent validates signatures and hashes.
5. Agent ingests allowed fields into a local context store.
6. Agent refreshes or deletes cached chunks when TTL expires.
7. If the agent needs full text, it follows the x402 flow.

ARSS does not require a blockchain for subscription. Payments and public receipts are optional extensions.

## Client surfaces

ARSS should ship as three things:

### 1. CLI

For users and servers:

```bash
arss subscribe https://example.com/arss.json --profile local-agent
arss sync
arss search "agent publishing risk"
arss inspect article-123
```

The CLI owns local subscription state and context storage.

### 2. MCP server

For agents:

- `list_feeds`
- `search_context`
- `get_item`
- `get_citations`
- `pay_and_fetch`
- `refresh_feed`
- `explain_rights`

MCP is the agent-facing tool layer. The agent should not need to implement polling, TTLs, x402 or signature checks itself.

### 3. Agent skill

For Pal/Claude/Codex-style agents:

- when user says “subscribe to this”
- when answering with source context
- when deciding whether a paid fetch is worth it
- when respecting quote/cache/training limits

The skill is UX and policy. The CLI/MCP is infrastructure.

## x402 flow

For paid full text:

1. Agent requests `full_text_url`.
2. Publisher returns HTTP 402 with payment requirements.
3. Agent wallet/user policy decides whether to pay.
4. Agent retries with x402 payment proof.
5. Publisher returns content plus license/rights envelope.
6. Agent stores content according to TTL and allowed uses.

For subscriptions, publishers can return a bearer capability/token after recurring payment, but ARSS should keep the first version simple: per-item x402 and monthly x402 are enough.

## Receipts

ARSS receipts are not “I trained on this.” They are consumption/accounting receipts:

```json
{
  "version": "arss.receipt.v0",
  "feed_url": "https://example.com/arss.json",
  "item_id": "tag:example.com,2026:article-123",
  "agent_id": "did:key:...",
  "action": "fetched_full_text",
  "content_hash": "0x...",
  "rights_hash": "0x...",
  "payment_hash": "0x...",
  "created_at": "2026-05-18T12:00:00Z"
}
```

Receipts can stay local, be sent to publishers, or be anchored publicly if both parties need auditability.

## Token thesis, if any

Do not launch a token to read feeds. That is silly.

A token only makes sense for open-network functions:

- feed directory staking
- anti-spam bonds for publishers/indexers
- curator/indexer rewards
- slashing for malicious signed feeds
- decentralised feed availability mirrors
- reputation-weighted feed discovery

Payments should be stablecoin/x402. Token is network collateral and curation, not content currency.

## MVP

1. ARSS JSON schema.
2. RSS-to-ARSS converter.
3. Static publisher feed generator.
4. Local CLI subscriber with SQLite/FTS.
5. MCP server exposing subscribed context to agents.
6. x402 protected full-text endpoint demo.
7. Pal skill that subscribes, refreshes, cites and respects TTL.

## Why now

- Agent usage is moving from chat windows to persistent assistants.
- Publishers are losing the click as the unit of value.
- x402 gives machine-payable HTTP.
- MCP gives agents a standard tool surface.
- llms.txt legitimises agent-readable website metadata but leaves subscription/payment/rights unsolved.
- RSS nostalgia hides a real protocol gap: feeds need to become agent-native.
