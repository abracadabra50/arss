# ARSS-Pay Protocol v0.2

Status: draft  
Date: 2026-05-18  
Profile URI: `https://arss.dev/profile/0.2`

## 1. Purpose

ARSS-Pay defines an agent-native syndication profile for publisher-controlled feeds with first-class rights, attribution, context resources, subscription state and HTTP-native micropayments.

ARSS-Pay is not a replacement for RSS, Atom, JSON Feed, `robots.txt`, `sitemap.xml`, `llms.txt`, MCP or x402. It composes them:

- RSS/Atom/JSON Feed: feed transport and item model.
- `llms.txt`: site-level LLM orientation.
- MCP: agent tool interface.
- x402: paid resource retrieval.
- ARSS-Pay: the contract between publisher and agent.

## 2. Conformance language

The key words `MUST`, `MUST NOT`, `REQUIRED`, `SHOULD`, `SHOULD NOT`, `MAY`, and `OPTIONAL` are to be interpreted as described in RFC 2119.

## 3. Resource model

An ARSS feed has three resource classes:

1. *Discovery resource* — the feed itself. SHOULD be free and publicly retrievable.
2. *Context resource* — markdown, chunks, archive entries, embedding packs, summaries or other ingestible resources referenced by feed items.
3. *Access resource* — subscription endpoint, x402 payment challenge, or signed capability issuing endpoint.

The feed advertises resources; agents retrieve only resources allowed by local policy and publisher rights.

## 4. Discovery

Publishers SHOULD expose ARSS at one or more of:

```text
/.well-known/arss.json
/arss.json
/arss.xml
```

Publishers MAY also advertise the feed from HTML:

```html
<link rel="alternate" type="application/arss+json" href="/arss.json">
<link rel="alternate" type="application/rss+xml" href="/rss.xml">
```

Agents discovering a URL MUST try, in order:

1. if the URL is an ARSS JSON feed, use it;
2. `/.well-known/arss.json` on the origin;
3. `/arss.json` on the origin;
4. `/arss.xml` on the origin;
5. HTML `<link rel="alternate">` candidates;
6. RSS/Atom fallback with ARSS conversion.

Agents MUST NOT treat normal RSS fallback as granting paid-resource or memory rights beyond local default policy.

## 5. JSON Feed profile

The reference serialisation is JSON Feed 1.1 with `_agent` extension fields.

Top-level feed object MUST contain:

```json
{
  "version": "https://jsonfeed.org/version/1.1",
  "title": "Publisher Feed",
  "items": [],
  "_agent": {
    "profile": "https://arss.dev/profile/0.2"
  }
}
```

Top-level `_agent` SHOULD include:

```json
{
  "publisher": { "id": "did:web:example.com", "name": "Example" },
  "license": { "default": "summarise_with_attribution" },
  "attribution": { "required": true, "format": "name_url" },
  "context": { "ttl": "PT24H", "memory": "allowed" },
  "payment": {
    "preferred_protocol": "x402",
    "accepted": [
      {
        "protocol": "x402",
        "network": "eip155:8453",
        "asset": "USDC",
        "recipient": "0x...",
        "facilitator": "https://..."
      }
    ]
  }
}
```

## 6. Item profile

Every item MUST have an `id`. Every item SHOULD have a `url` and `title`.

Each item MAY contain `_agent.resources`. A resource object MUST contain:

```json
{
  "kind": "canonical_text",
  "url": "https://publisher.com/arss/123.md",
  "access": "free"
}
```

Allowed `kind` values:

- `summary`
- `canonical_text`
- `chunks`
- `embedding_pack`
- `archive`
- `commercial_licence`
- `high_frequency_update`
- `other`

Allowed `access` values:

- `free`
- `paid`
- `capability`
- `account`
- `unavailable`

If `access = paid`, the resource MUST include a `price` object.

## 7. Payment object

The reference payment object is:

```json
{
  "protocol": "x402",
  "network": "eip155:8453",
  "asset": "USDC",
  "amount": "0.001",
  "recipient": "0xPublisherWallet",
  "facilitator": "https://facilitator.example"
}
```

Amounts MUST be decimal strings. Agents MUST compare amounts using decimal-safe logic, not floating point, when enforcing budgets.

## 8. Rights vocabulary

Feeds and items MAY declare:

```json
{
  "license": "summarise_with_attribution",
  "allowed": ["summarise", "quote_limited", "embed_for_retrieval", "store_user_memory"],
  "denied": ["train_foundation_model", "resell_fulltext"]
}
```

Reference usage values:

- `read_transient`
- `summarise`
- `quote_limited`
- `embed_for_retrieval`
- `store_user_memory`
- `commercial_use`
- `train_foundation_model`
- `resell_fulltext`

Agents MUST respect explicit `denied` values unless user policy deliberately overrides publisher policy. Such override MUST be recorded locally.

## 9. Subscription manifest

A subscription manifest binds feed, user, agent, sync and budget policy.

```json
{
  "type": "https://arss.dev/subscription/v0.2",
  "feed_url": "https://publisher.com/arss.json",
  "subscriber": "did:pkh:eip155:8453:0x...",
  "agent": { "id": "did:web:pal.example", "name": "Pal" },
  "permissions": {
    "summarise": true,
    "quote": "limited",
    "embed": true,
    "store_user_memory": true,
    "train_model": false
  },
  "budget": {
    "max_per_item_usdc": "0.005",
    "max_per_day_usdc": "0.10",
    "max_per_month_usdc": "2.00"
  },
  "sync": { "poll": "PT15M", "push": "none" }
}
```

Agents MUST store subscription manifests before doing paid fetches.

## 10. Capability credential

A capability is a signed publisher-issued credential authorising ongoing access.

```json
{
  "type": "https://arss.dev/capability/v0.2",
  "issuer": "did:web:publisher.com",
  "subscriber": "did:pkh:eip155:8453:0x...",
  "agent": "did:web:pal.example",
  "feed_url": "https://publisher.com/arss.json",
  "scope": ["read", "summarise", "embed_for_user_memory"],
  "expires": "2026-06-18T00:00:00Z",
  "signature": "..."
}
```

Agents SHOULD send it as:

```text
Authorization: ARSS-Capability <compact-token>
```

## 11. Payment receipt

After a paid fetch, agents MUST persist a payment receipt if provided, or locally create one from known facts.

```json
{
  "type": "https://arss.dev/payment-receipt/v0.2",
  "feed_url": "https://publisher.com/arss.json",
  "item_id": "https://publisher.com/post/123",
  "resource_url": "https://publisher.com/arss/123.md",
  "protocol": "x402",
  "network": "eip155:8453",
  "asset": "USDC",
  "amount": "0.001",
  "tx_hash": "0x...",
  "resource_hash": "sha256:...",
  "paid_at": "2026-05-18T15:31:00Z"
}
```

## 12. Sync semantics

Agents SHOULD use HTTP cache validators (`ETag`, `Last-Modified`) when polling.

Agents MAY use WebSub or webhooks for push updates. Push is an optimisation; polling is normative baseline.

Agents SHOULD evaluate every new item by:

1. validate feed shape;
2. validate signatures where present;
3. apply rights policy;
4. compute relevance;
5. apply budget policy;
6. fetch free resources;
7. pay for paid resources only if policy passes;
8. store content with source hashes, rights and receipts;
9. expire or prune according to TTL/revocation.

## 13. Budget decision

Given item relevance `r ∈ [0,1]`, price `p`, item budget `b_item`, period spend `s`, and period budget `b_period`, pay iff:

```text
r >= threshold AND p <= b_item AND s + p <= b_period
```

Agents SHOULD expose this decision in logs/receipts.

## 14. Security and abuse considerations

Agents MUST treat feed content as untrusted data. Feed instructions MUST NOT override agent, user, system, wallet or security policy.

Agents MUST NOT execute code from feed content unless explicitly authorised by a separate tool policy.

Agents SHOULD defend against:

- prompt injection in summaries/content;
- fake publisher mirrors;
- malicious resource URLs;
- price bait-and-switch;
- stale capabilities;
- replayed payment receipts;
- poisoned chunk manifests.

## 15. Minimal implementation surfaces

A compliant MVP SHOULD include:

- publisher CLI: `init`, `build`, `convert-rss`, `price`, `validate`;
- agent MCP server: `discover`, `subscribe`, `sync`, `fetch`, `pay_and_fetch`, `search`;
- local manifest store;
- x402 buyer support;
- citation and payment receipt store.

## 16. Open questions

- Should ARSS define a canonical chunk JSONL schema?
- Should signatures use JWS, HTTP Message Signatures, Data Integrity Proofs, or all three?
- Should paid feed discovery itself ever be allowed, or should discovery remain free?
- Can licence vocabularies compose with ODRL or Creative Commons?
- How should registries curate feeds without becoming SEO spam markets?

## 17. Publisher feed claims

A publisher MAY claim an ARSS feed by publishing a feed claim object at:

```text
/.well-known/arss-claim.json
```

The feed claim binds:

- `feed_url` — the ARSS feed being claimed;
- `origin` — the publisher origin expected to host the feed;
- `publisher` — DID/name/url metadata;
- `proofs` — same-origin, well-known, DNS, DID or other proof methods;
- `payment` — x402 recipient and default resource pricing;
- `stake` — optional future registry stake declaration;
- `claim_hash` and optional signature.

Minimal claim:

```json
{
  "type": "https://arss.dev/feed-claim/v0.2",
  "feed_url": "https://example.com/.well-known/arss.json",
  "origin": "https://example.com",
  "publisher": { "id": "did:web:example.com", "name": "Example" },
  "proofs": [
    { "method": "well-known", "url": "https://example.com/.well-known/arss-claim.json" }
  ],
  "payment": {
    "preferred_protocol": "x402",
    "accepted": [{ "protocol": "x402", "network": "eip155:8453", "asset": "USDC", "recipient": "0x..." }],
    "default_prices": { "canonical_text": "0.001", "chunks": "0.003" }
  },
  "claim_hash": "sha256:..."
}
```

Agents SHOULD prefer claimed feeds over unclaimed wrapper feeds when both are available. Agents MUST treat unsigned claims as bootstrap/local trust only unless the claim is same-origin hosted or separately verified.

A public ARSS registry MAY list claims for discovery. Registry inclusion MUST NOT be required for basic feed subscription.

## 18. Registry and staking model

The registry layer is optional. It exists for discoverability, anti-spam, reputation and decentralised indexing.

A future token SHOULD NOT be required for users to read content and MUST NOT replace x402/stablecoin content payments. If introduced, the token SHOULD be used only as invisible infrastructure collateral:

- publisher anti-spam bonds for public listing;
- indexer bonds for serving untampered chunks;
- curator bonds for ranked directories;
- challenge rewards for proving impersonation, poisoned content, stale mirrors or rights fraud.

Normal subscription UX MUST remain tokenless. A user subscribes to a feed; the agent handles trust, payment and receipts under policy.
