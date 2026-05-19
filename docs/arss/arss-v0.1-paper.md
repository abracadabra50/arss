# ARSS: Agent Really Simple Syndication

*A fork of RSS for agent-native context, provenance and publisher survival*

Version: 0.1 draft  
Date: 2026-05-18

## Abstract

RSS solved subscription for human readers: a publisher emitted a chronological feed, and a reader subscribed without needing a platform intermediary. The agent web needs the same primitive, but the consuming party is no longer a person scanning headlines. It is a persistent agent maintaining context on behalf of a user, team or organisation.

Current web publishing formats are not enough. RSS and Atom distribute articles, but do not express whether an agent may ingest, summarise, store, cite, transform, pay for, or refresh content. `llms.txt` helps websites expose curated context to language models, but it is mostly site-level documentation, not a dynamic subscription protocol. Robots.txt controls crawler access, not durable agent context. Sitemaps enumerate pages, not usage rights or machine-consumable context packages.

ARSS — Agent Really Simple Syndication — extends the feed model for agents. It preserves the core insight of RSS: a simple, decentralised, pull-based stream controlled by the publisher. It adds agent-native metadata: licensing, attribution, canonical text, chunk manifests, update semantics, pricing, trust signatures, embedding hints and context expiry.

The goal is not to replace RSS. The goal is to fork its spirit: simple syndication, rebuilt for agents.

## 1. Motivation

The web is entering a second disintermediation cycle.

The first cycle was platform aggregation. Publishers produced content; platforms captured distribution, identity and advertising.

The second cycle is agent mediation. Users will increasingly ask agents to monitor topics, summarise sources, answer questions, brief them and act. In that world, the user's agent may consume publisher content without the user ever visiting the publisher's page.

This creates three problems.

### 1.1 Agents need durable context, not one-off pages

A human reader can browse, skim and decide what matters. An agent needs structured answers to different questions:

- What changed since the last pull?
- What is canonical versus derivative?
- May I store this in memory?
- May I summarise it to my user?
- What citation or attribution is required?
- Is this item still valid?
- Which chunks should I retrieve for long-context ingestion?
- Is there a paid/full version?
- Has the publisher signed this feed?

RSS does not answer these because RSS was designed for human-facing feed readers.

### 1.2 Publishers need a way to be read by agents without surrendering value

If agents become the default interface to information, publishers need a machine-readable distribution layer that preserves:

- provenance,
- attribution,
- licensing,
- pricing,
- freshness,
- analytics,
- and trust.

Without this, the fallback is scraping. Scraping is adversarial, brittle and economically ugly. Publishers block bots; agents route around blocks; users get stale or unattributed summaries. Nobody wins except the middleware cockroaches.

### 1.3 Existing standards are close but incomplete

RSS is simple and widely understood. Atom is more formal and extensible. JSON Feed makes feeds easier for modern developers. `llms.txt` gives websites an LLM-friendly map. These are useful foundations, not sufficient answers.

ARSS should therefore be an extension/fork, not a greenfield cathedral.

## 2. Design principles

1. **Fork the feed, not the web.** ARSS should work as an RSS namespace, Atom extension and JSON Feed profile.
2. **Publisher-owned.** The publisher emits the feed from their own domain.
3. **Agent-readable by default.** Fields should express the decisions agents actually need to make.
4. **Licensing is data, not vibes.** Agents should know what they may do before ingesting.
5. **Payment is optional.** Free feeds must work. Premium context should be easy to price.
6. **Attribution is first-class.** Citation rules should be explicit and machine-readable.
7. **Freshness matters.** Agents need expiry and invalidation semantics, not just publish dates.
8. **Trust is composable.** Signatures, hashes and registries should be optional layers, not mandatory ceremony.
9. **Human-readable where possible.** Debugging a feed should not require a priesthood.
10. **No token in the base protocol.** The protocol should be open. Tokens belong in registries, markets and incentive layers.

## 3. ARSS feed model

An ARSS feed is a subscription stream for agent context. It may be expressed as:

- RSS 2.0 with an `agent:` namespace,
- Atom with `agent:` extension elements,
- JSON Feed 1.1 with an `_agent` extension object.

The feed contains normal feed metadata plus agent-specific channel and item metadata.

### 3.1 Channel-level fields

Example RSS namespace declaration:

```xml
<rss version="2.0" xmlns:agent="https://arss.dev/ns/0.1">
```

Recommended channel fields:

```xml
<agent:profile version="0.1" />
<agent:publisher id="did:web:example.com" name="Example Publisher" />
<agent:policy url="https://example.com/arss-policy.json" />
<agent:license default="summarise_with_attribution" />
<agent:pricing protocol="x402" currency="USDC" defaultAmount="0" />
<agent:attribution required="true" format="name_url" />
<agent:signature alg="ed25519" keyId="did:web:example.com#feed" value="..." />
<agent:topics>ai,markets,policy</agent:topics>
<agent:context ttl="PT24H" memory="allowed" />
```

### 3.2 Item-level fields

```xml
<item>
  <title>Agents need feeds</title>
  <link>https://example.com/agents-need-feeds</link>
  <guid>https://example.com/agents-need-feeds</guid>
  <pubDate>Mon, 18 May 2026 15:00:00 GMT</pubDate>
  <description>A short human-readable summary.</description>

  <agent:summary>Canonical short summary for agent briefings.</agent:summary>
  <agent:canonicalText url="https://example.com/agents-need-feeds.md" hash="sha256:..." />
  <agent:chunks url="https://example.com/agents-need-feeds.chunks.jsonl" format="jsonl" hash="sha256:..." />
  <agent:license value="summarise_with_attribution" />
  <agent:allowed uses="summarise,quote,embed,store_user_memory" />
  <agent:denied uses="train_foundation_model,resell_fulltext" />
  <agent:attribution required="true" text="Example Publisher" url="https://example.com" />
  <agent:price protocol="x402" currency="USDC" amount="0.001" />
  <agent:expires>2026-05-25T15:00:00Z</agent:expires>
  <agent:importance score="0.82" reason="major policy change" />
  <agent:signature alg="ed25519" keyId="did:web:example.com#feed" value="..." />
</item>
```

### 3.3 JSON Feed profile

```json
{
  "version": "https://jsonfeed.org/version/1.1",
  "title": "Example Publisher",
  "feed_url": "https://example.com/arss.json",
  "_agent": {
    "profile": "https://arss.dev/profile/0.1",
    "publisher": { "id": "did:web:example.com", "name": "Example Publisher" },
    "license": { "default": "summarise_with_attribution" },
    "pricing": { "protocol": "x402", "currency": "USDC", "default_amount": "0" },
    "attribution": { "required": true, "format": "name_url" },
    "context": { "ttl": "PT24H", "memory": "allowed" }
  },
  "items": [
    {
      "id": "https://example.com/agents-need-feeds",
      "url": "https://example.com/agents-need-feeds",
      "title": "Agents need feeds",
      "summary": "A short human-readable summary.",
      "_agent": {
        "summary": "Canonical short summary for agent briefings.",
        "canonical_text": { "url": "https://example.com/agents-need-feeds.md", "hash": "sha256:..." },
        "chunks": { "url": "https://example.com/agents-need-feeds.chunks.jsonl", "format": "jsonl", "hash": "sha256:..." },
        "license": "summarise_with_attribution",
        "allowed": ["summarise", "quote", "embed", "store_user_memory"],
        "denied": ["train_foundation_model", "resell_fulltext"],
        "price": { "protocol": "x402", "currency": "USDC", "amount": "0.001" },
        "expires": "2026-05-25T15:00:00Z"
      }
    }
  ]
}
```

## 4. Licensing vocabulary

ARSS should begin with a deliberately small licensing vocabulary:

- `read_only` — agent may read transiently, no storage.
- `summarise_with_attribution` — agent may summarise to a user with attribution.
- `quote_limited` — agent may quote within publisher-defined limits.
- `embed_for_retrieval` — agent may embed/chunk for retrieval in user memory.
- `store_user_memory` — agent may store derived notes in a user-controlled memory store.
- `commercial_use_allowed` — agent may use content in paid workflows.
- `no_training` — content must not be used for model training.
- `paid_context` — full context requires payment.

This is not a replacement for law. It is an interoperability layer for software. Agents can make better choices when publishers state intent in a parseable way.

## 5. Payments

Payment should not be mandatory. The open web dies if every paragraph becomes a toll road.

But premium agent context needs a native path. ARSS can reference payment schemes without owning them:

```xml
<agent:price protocol="x402" currency="USDC" amount="0.001" />
```

The likely early pattern:

- free summary and metadata,
- paid canonical markdown,
- paid chunk file,
- paid high-frequency updates,
- paid archive access,
- paid commercial-use licence.

x402 is attractive because it maps naturally onto HTTP. An agent requests a premium resource, receives `402 Payment Required`, pays, retries, and ingests.

## 6. Trust and provenance

Agents need to distinguish canonical publisher feeds from scraped mirrors and spam.

ARSS should support:

- feed signatures,
- item signatures,
- canonical URL hashes,
- publisher keys via DID/Web PKI,
- optional registry attestations,
- update/revocation events.

A minimal trust object:

```json
{
  "alg": "ed25519",
  "key_id": "did:web:example.com#feed",
  "signed_fields": ["id", "url", "canonical_text.hash", "date_published"],
  "signature": "base64..."
}
```

The base protocol should not require onchain registration. A later registry layer can add staking, discovery and reputation.

## 7. Agent consumption semantics

An ARSS-aware agent should:

1. Subscribe to feeds selected by the user or organisation.
2. Poll or receive hub notifications.
3. Validate feed structure and signatures where present.
4. Check licence and payment requirements before retrieval.
5. Retrieve canonical text or chunks only when needed.
6. Store content according to declared memory rights and user policy.
7. Preserve attribution metadata in summaries and answers.
8. Honour expiry/revocation where feasible.
9. Maintain a local context index with source hashes.
10. Expose receipts: what was ingested, when, from whom, under what licence.

This gives users better agents and gives publishers a cleaner relationship with machine readers.

## 8. Registry and token layer

The ARSS protocol should not require a token. But a tokenised network may be useful above it.

The coordination problem is not payment. USDC can handle payment. The coordination problem is feed trust and attention.

A token layer could support:

- staking to register publisher feeds,
- slashing fraudulent/misleading feed operators,
- rewarding indexers that maintain topic directories,
- curator markets for high-quality feeds,
- agent-side reputation for compliant consumption,
- dispute resolution over licence violations,
- governance over shared vocabularies.

In short:

```text
Protocol: open syndication.
Token: trust, curation and discovery market.
```

This is a cleaner token thesis than tokenising raw compute. Compute tokens are crowded. Agent-readable publisher distribution is underbuilt.

## 9. Relationship to existing standards

### RSS

RSS is the spiritual parent. It is simple, decentralised and publisher-controlled. ARSS should remain compatible where possible by using namespaces and optional elements.

### Atom

Atom already formalises extensibility, authorship, links and signatures/encryption considerations. ARSS should define an Atom extension profile.

### JSON Feed

JSON Feed is developer-friendly and extension-friendly. ARSS should provide a first-class JSON profile because agents and modern apps will prefer JSON over XML.

### llms.txt

`llms.txt` is site-level orientation for language models. ARSS is dynamic subscription. The two should complement each other:

- `/llms.txt` says: here is the site and its important docs.
- `/arss.xml` or `/arss.json` says: here is the ongoing stream of agent-ingestable context.

### robots.txt and sitemaps

Robots controls crawler behaviour. Sitemaps enumerate pages. ARSS expresses subscribed agent context, rights and provenance.

## 10. MVP

The fastest useful implementation:

1. `arss.xml` namespace draft.
2. `arss.json` JSON Feed profile.
3. CLI validator.
4. RSS/Atom/JSON Feed to ARSS converter.
5. Markdown/chunk manifest generator.
6. Agent subscriber that writes to a local memory/index.
7. Publisher landing page: “Make your content agent-readable.”

Dogfood feeds:

- crypto markets and token launches,
- confidential compute and TEE research,
- AI agent standards,
- Shopify commerce AI,
- local household context,
- Milards/property operations.

## 11. Open questions

- Should `agent:allowed` use a fixed enum, ODRL, Creative Commons-style URIs, or all three?
- How should agents prove compliance with attribution and memory rights?
- Should paid context use x402 only, or should the spec remain protocol-neutral?
- How should revocation work for already-ingested content?
- How should publishers distinguish inference-time use from training-time use?
- Can registries avoid becoming spam directories?
- What is the minimum signature scheme that web publishers will actually use?
- Should ARSS define chunk schema or only link to chunk manifests?

## 12. Conclusion

Agents need subscriptions. Publishers need agent-readable distribution that does not collapse into scraping. RSS gave the web a simple, decentralised content stream for humans. ARSS proposes the same primitive for agents: a feed that carries not only content, but rights, context, provenance, freshness and optional payment.

The opportunity is not to build another feed reader. It is to define the publisher-agent contract before platforms define it for everyone.

If agents are going to read the web, the web should get a say in how it is read.

## References

- RSS Advisory Board, RSS 2.0 Specification, https://www.rssboard.org/rss-specification
- Nottingham and Sayre, RFC 4287: The Atom Syndication Format, https://www.rfc-editor.org/rfc/rfc4287
- Brent Simmons and Manton Reece, JSON Feed 1.1, https://www.jsonfeed.org/version/1.1/
- Jeremy Howard et al., llms.txt proposal, https://llmstxt.org/
