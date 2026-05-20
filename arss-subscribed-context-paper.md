# ARSS: Agent-Readable Syndication for the Subscribed Web

**Working paper**  
**19 May 2026**  
**Z. Ashraf and Pal**

## Abstract

The web has mature primitives for human subscription and machine querying, but it lacks a native primitive for **agent subscription**. RSS and Atom let humans subscribe to publisher-controlled streams. Search lets agents discover pages on demand. MCP lets agents call tools. RAG lets agents search local memory. Platform APIs expose structured data for specific services. None of these gives a long-running agent a standard way to say: *these are the sources I care about; keep them warm; tell me what changed; preserve rights and attribution; fetch full context only when useful; pay only when policy allows*.

We propose **ARSS** — Agent-Readable Syndication — as a subscription and delivery layer for the agent web. ARSS is not a replacement for RSS, search, MCP, RAG, browser automation or platform APIs. It is the missing layer between them: a publisher-agent contract for subscribed context. ARSS feeds carry machine-readable rights, attribution, context-resource descriptors, freshness hints, subscription policy, optional payment metadata and provenance. Agents consume ARSS through a background heartbeat into local memory and a small attention inbox, with live subscribed-source fallback on miss.

The core primitive is free-first subscribed context. Payment via HTTP 402/x402 is optional and useful for premium canonical text, chunk bundles, archives or commercial licences, but it must be explicit and local to the agent's budget policy. Public registry subscription manifests should not grant spending authority by default.

We present the design, protocol objects, registry model, category bundles, implementation, preliminary evals and open research questions. A prototype currently includes a CLI, daemon, heartbeat adapter, MCP server, local store, transcript enrichment, x402 demo rails, a static feed registry with 40 validated feeds, 8 category bundles and live/reference eval harnesses.

The central claim is narrow and strong:

> For sources an agent cares about repeatedly, subscribed context is cheaper, fresher, more controllable and more publisher-respecting than repeatedly searching or scraping the web.

---

## 1. Problem statement

Human readers solved web freshness decades ago with subscription:

```text
publisher emits feed → reader subscribes → new items arrive quietly
```

Agents are being built without the equivalent primitive. The common agent-web pattern is still:

```text
user asks question → agent searches web → agent fetches pages → agent summarises → context is discarded or inconsistently stored
```

This is wasteful and structurally wrong for long-running agents. A household, company or developer agent does not need to rediscover the same sources every time. It should keep a context diet: a curated set of feeds, docs, changelogs, papers, newsletters, videos and publisher resources that are periodically synced under explicit policy.

The missing primitive is not another browser controller. It is not a bigger context window. It is not a vector database. It is a subscription contract.

An agent needs to answer questions like:

- Which sources should I keep warm?
- What changed since my last heartbeat?
- May I summarise this item?
- May I quote it?
- May I cache it in user memory?
- Is attribution required?
- Is full text free, paid or forbidden?
- Should this update wake the user or stay quiet?
- If memory misses, can I fetch the subscribed source live?
- If the resource is paid, does local budget policy allow it?

RSS answers only the first part: where new items are. ARSS answers the agent parts.

---

## 2. Thesis

ARSS is a subscription and delivery plane for agents.

```text
MCP     = query/action plane
RAG     = memory/search plane
ARSS    = subscription/delivery plane
x402    = optional payment plane
Registry = discovery/curation plane
```

These layers compose. They do not replace each other.

A useful agent stack looks like this:

```text
feed registry
   ↓
context diet
   ↓
heartbeat sync
   ↓
local archive + ranked memory + tiny inbox
   ↓
answer with citations
   ↓
MCP/API/browser actions when required
   ↓
optional x402 fetch for paid canonical resources
```

The product intuition is simple:

```text
Do not inject everything.
Do not search everything live.
Do not crawl blindly.

Do:
  keep known sources warm,
  inject only high-signal deltas,
  search local memory first,
  fetch subscribed sources live on miss,
  use open search only for unknown-source discovery.
```

---

## 3. What ARSS is not

ARSS is easier to understand by ruling out false claims.

### 3.1 ARSS is not a replacement for search

Search remains better for unknown-source discovery. If an agent needs information from a source it has never seen, search is the right first move. ARSS begins after discovery: when the agent decides a source is worth keeping warm.

### 3.2 ARSS is not a replacement for MCP

MCP exposes tools. It lets an agent ask a known service or tool for something. ARSS exposes change over time. It lets an agent wake up already knowing what has changed. Reactive tool calls and proactive subscriptions are different primitives.

### 3.3 ARSS is not a vector database

A vector database answers questions over stored content. It does not define how content gets admitted, refreshed, attributed, governed, paid for, or expired. ARSS feeds memory; RAG searches memory.

### 3.4 ARSS is not blind crawling

Crawling is a unilateral act by the consumer. ARSS is a bilateral contract: the publisher exposes machine-readable metadata and the agent respects it.

### 3.5 ARSS is not “everything should cost money”

ARSS is free-first. Public feeds and starter manifests should carry no payment budget by default. Payment belongs on explicit resources and should require local agent/user budget policy.

---

## 4. Comparison to existing approaches

| Approach | Strength | Weakness |
| --- | --- | --- |
| RSS/Atom | Human subscription to publisher streams | No agent rights, memory policy, chunking, payment, registry semantics |
| Web search | Unknown-source discovery | Repeated token cost, unstable results, index lag, weak publisher contract |
| MCP | Tool invocation and structured actions | Reactive; no subscription heartbeat or freshness model |
| Crawler + vector DB | First-time corpus bootstrap | Heavy, stale between crawls, weak rights/provenance unless layered on |
| Platform API | Fresh structured data for one service | Bespoke integration and auth per source |
| Browser automation | Last-mile access to messy sites | Slow, brittle, expensive, often hostile to publishers |
| Webhooks | Push-based event delivery | Requires publisher integration and receiver infrastructure |
| ARSS | Repeated-source freshness, policy, attribution, registry and optional payment | Does not solve unknown-source discovery by itself |

The distinctive ARSS claim is not that it can fetch content. Everything can fetch content. The distinctive claim is that it standardises **subscribed context delivery** for long-running agents.

---

## 5. Core design concepts

### 5.1 Context diet

A context diet is a curated list of sources an agent keeps warm.

```json
{
  "type": "https://arss.dev/context-diet/v0.1",
  "name": "agent-web",
  "interests": ["MCP", "x402", "AI agents", "llms.txt"],
  "sources": [
    {
      "id": "openai-news",
      "title": "OpenAI News",
      "url": "https://openai.com/news/rss.xml",
      "kind": "rss",
      "topics": ["frontier-labs", "ai", "agents", "models"]
    }
  ]
}
```

The diet is not the inbox. It is the subscription surface. It can include far more sources than should ever be injected into a chat turn.

### 5.2 Heartbeat

A heartbeat is a background sync event:

```text
for each source in diet:
  fetch feed
  parse/normalise into ARSS shape
  score against interests
  cache summary/chunks/transcripts when allowed
  update memory/archive
  emit only high-signal items to inbox
```

Heartbeats should usually be no-agent or low-agent-cost jobs. Most feed fetches do not require model inference.

### 5.3 Local memory and archive

ARSS separates archive from attention.

```text
archive:      everything policy allows us to store
memory:       searchable summaries/chunks/receipts
inbox:        tiny ranked slice worth injecting or notifying
```

This separation matters. Without it, agents either miss too much or flood context.

### 5.4 Current inbox

The inbox is deliberately lossy. It is an editorial surface, not a database. It should contain only the few items likely to matter now.

### 5.5 Live subscribed fallback

If a question misses local memory but belongs to a subscribed source, the agent should fetch that source live before falling back to open web search.

```text
answer question
  ↓
search local ARSS memory
  ↓ miss
fetch subscribed source/feed/resource live
  ↓ miss
use open search
```

This is the practical bridge between low-token memory and high-recall freshness.

### 5.6 Rights metadata

Each feed/item/resource may specify whether the agent may:

- summarise;
- quote;
- embed for retrieval;
- store in user memory;
- train a foundation model;
- resell or redistribute full text.

The prototype uses simple allowed/denied fields and attribution flags. Future work should align this with emerging publisher rights vocabularies if a credible standard appears.

### 5.7 Payment metadata

Paid resources are explicit resources, not a property of the whole feed.

Examples:

```text
summary              free
canonical_text       paid via x402
chunks.jsonl         paid via x402
archive.zip          paid via x402
commercial_licence   paid/offline contract
```

Public registry manifests should be free-only:

```json
{
  "payment_policy": {
    "mode": "free_only",
    "note": "No payment budget is granted by this starter manifest. Paid resources require an explicit local budget."
  }
}
```

This avoids the bad UX where every feed appears to have a price.

---

## 6. Feed registry

Discovery needs a place to happen. Randomly probing `/feed`, `/rss.xml`, `/atom.xml`, `/.well-known/arss.json` and `llms.txt` forever is not a product.

The ARSS registry is a static, machine-readable directory of known subscribable sources:

```json
{
  "type": "https://arss.dev/feed-registry/v0.1",
  "title": "ARSS Feed Registry",
  "payment_posture": "free-first: listed feeds are free/public unless a publisher explicitly declares paid ARSS resources",
  "feeds": [...],
  "categories": [...]
}
```

It serves two audiences:

1. humans browsing feeds and starter bundles;
2. agents importing feeds or categories into a context diet.

The current prototype generates:

```text
registry/index.html                         human page
registry/feeds.json                         machine registry
registry/README.md                          table export
registry/subscriptions/*.subscription.json  free-only per-feed manifests
registry/categories/*.json                  category bundles
```

### 6.1 Category bundles

Single-feed subscription is too granular for many users. Agents should be able to subscribe to whole lanes:

```bash
npx arss feed-registry-import registry/feeds.json --category "Frontier labs" --sync-now
```

A category bundle is itself machine-readable:

```json
{
  "type": "https://arss.dev/feed-category/v0.1",
  "id": "frontier-labs",
  "title": "Frontier labs",
  "description": "Official lab and cookbook feeds from OpenAI, Anthropic, Google DeepMind, Google Research and Microsoft Research.",
  "feed_ids": [
    "openai-news",
    "google-deepmind-blog",
    "google-research-blog",
    "microsoft-research-blog",
    "openai-cookbook-commits",
    "anthropic-cookbook-commits",
    "openai-agents-python-commits"
  ]
}
```

The current starter registry contains 40 validated feeds across 8 categories:

| Category | Feeds |
| --- | ---: |
| Agent protocols | 8 |
| Developer tooling | 7 |
| Frontier labs | 7 |
| Research | 8 |
| Industry | 3 |
| Infrastructure | 2 |
| Media | 3 |
| Payments | 2 |

Feed kinds currently include RSS, Atom, Substack-style feeds, YouTube channel feeds, JSON Feed and `llms.txt`.

### 6.2 Why static first

The registry should start as static HTML and JSON. Static registries are cheap, cacheable, inspectable and agent-readable. A database-backed registry can come later if submissions, trust scoring and health checks demand it.

---

## 7. Protocol objects

### 7.1 Feed

An ARSS feed is usually JSON Feed 1.1 plus `_agent` metadata, or a normal RSS/Atom feed normalised into that shape.

```json
{
  "version": "https://jsonfeed.org/version/1.1",
  "title": "Example Feed",
  "feed_url": "https://example.com/arss.json",
  "_agent": {
    "profile": "https://arss.dev/profile/0.2",
    "publisher": { "name": "Example" },
    "license": { "default": "summarise_with_attribution" },
    "attribution": { "required": true, "format": "name_url" },
    "context": { "ttl": "PT24H", "memory": "allowed" }
  },
  "items": []
}
```

### 7.2 Item

An item has normal feed fields plus agent policy:

```json
{
  "id": "https://example.com/post/1",
  "url": "https://example.com/post/1",
  "title": "Post title",
  "summary": "Short summary",
  "date_published": "2026-05-19T12:00:00Z",
  "_agent": {
    "license": "summarise_with_attribution",
    "allowed": ["summarise", "quote_limited", "embed_for_retrieval", "store_user_memory"],
    "denied": ["train_foundation_model", "resell_fulltext"],
    "attribution": { "required": true },
    "resources": []
  }
}
```

### 7.3 Resource

A resource is content the agent may retrieve.

```json
{
  "kind": "canonical_text",
  "url": "https://example.com/arss/post-1.md",
  "access": "free",
  "format": "text/markdown",
  "hash": "sha256:..."
}
```

For paid resources:

```json
{
  "kind": "chunks",
  "url": "https://example.com/arss/post-1.chunks.jsonl",
  "access": "paid",
  "price": {
    "protocol": "x402",
    "network": "eip155:8453",
    "asset": "USDC",
    "amount": "0.003",
    "recipient": "0x..."
  }
}
```

### 7.4 Subscription manifest

A subscription manifest authorises an agent to keep a feed warm.

Free-first public starter manifest:

```json
{
  "type": "https://arss.dev/subscription/v0.2",
  "feed_url": "https://openai.com/news/rss.xml",
  "agent": { "id": "did:web:local.agent", "name": "Local Agent" },
  "permissions": {
    "summarise": true,
    "quote": "limited",
    "embed": true,
    "store_user_memory": true,
    "train_model": false
  },
  "payment_policy": {
    "mode": "free_only"
  },
  "sync": { "poll": "PT1H", "push": "none" }
}
```

A local user may later add a budget:

```json
{
  "budget": {
    "max_per_item_usdc": "0.005",
    "max_per_day_usdc": "0.10",
    "max_per_month_usdc": "2.00"
  }
}
```

The important rule: public registry manifests should not silently grant spend.

---

## 8. Reference implementation

The current prototype includes:

| Component | Status |
| --- | --- |
| Feed parser/normaliser | RSS, Atom, JSON Feed, `llms.txt`-style source support |
| CLI | build, validate, convert, subscribe, pull, search, diet-add, registry import, pay-fetch |
| Daemon | periodic subscription polling |
| Heartbeat adapter | context diet sync into memory/inbox |
| MCP server | explicit ARSS tools for agent runtimes |
| Local store | feed JSON, chunks JSONL, receipts, searchable summaries |
| Transcript enrichment | YouTube/podcast transcript cache where available |
| Registry generator | static human page + machine JSON + categories + manifests |
| x402 demo rails | optional paid resource fetch and receipts |
| Eval harnesses | deterministic reference eval and live subscribed-source eval |

The CLI supports:

```bash
npm run arss -- feed-registry-list registry/feeds.json
npm run arss -- feed-registry-import registry/feeds.json --feed simon-willison --sync-now
npm run arss -- feed-registry-import registry/feeds.json --category "Frontier labs" --sync-now
npm run arss -- feed-registry-import registry/feeds.json --all --sync-now
```

---

## 9. Evaluation methodology

ARSS should not be evaluated only by answer quality. The relevant unit is the context supply chain.

We track:

- **time-to-awareness**: how long after publication the agent knows;
- **recall on subscribed domains**: whether the agent surfaces relevant subscribed-source items;
- **open-world discovery**: whether a method can find unknown sources;
- **token cost per answer/run**;
- **latency**;
- **noise injected into active context**;
- **citation accuracy**;
- **rights compliance**;
- **payment policy correctness**.

### 9.1 Deterministic reference eval

The reference eval models common approaches across synthetic cases: model-only, live web search, MCP on demand, crawler+RAG, platform APIs, ARSS heartbeat and ARSS+transcripts.

Representative current output:

| Method | Recall on subscribed domains | Open-world discovery | Tokens/answer | Latency | Noise |
| --- | ---: | :---: | ---: | ---: | ---: |
| Model only | 0% | no | 900 | 250ms | 0 |
| Live web search | 14% | yes | 24,000 | 4200ms | 7 |
| MCP on demand | 71% | no | 6,200 | 1800ms | 2 |
| Crawler + vector RAG | 71% | no | 3,600 | 950ms | 4 |
| Platform APIs | 57% | no | 2,600 | 700ms | 1 |
| ARSS heartbeat | 100% | no | 1,800 | 320ms | 1 |
| ARSS + transcripts | 100% | no | 2,200 | 360ms | 1 |

This eval is not a live search-engine benchmark. It is a reference harness for the expected shape of subscribed context.

### 9.2 Live subscribed-source eval

The live eval fetches real feeds from the context diet, runs heartbeat, then checks actual ARSS memory and inbox.

Current run over 20 real subscribed sources:

| Method | Recall | Cases | Approx token-ish cost/run | Latency |
| --- | ---: | ---: | ---: | ---: |
| Live feed polling | 100% | 20/20 | 1,802,524 | 5.9s |
| ARSS local memory | 60% | 12/20 | 76,653 | 20ms |
| ARSS current inbox | 25% | 5/20 | 2,118 | 5ms |
| ARSS memory + live fallback | 100% | 20/20 | 901,262 | 3.0s |

The live eval is more important than the flattering reference eval. It shows the actual trade-off:

```text
live polling everything = high recall, high cost
memory only             = cheap, partial recall
current inbox           = extremely cheap, intentionally lossy
memory + live fallback  = high recall when needed
```

This supports the product architecture:

```text
archive broadly,
rank into memory,
inject narrowly,
fall back to live subscribed fetch,
use search only beyond the subscription boundary.
```

---

## 10. Novelty

The novelty is not any single technical component. Feeds exist. Registries exist. Payments exist. Memory stores exist. The novelty is the combination around the agent lifecycle.

### 10.1 Subscribed context as a first-class agent primitive

Most agent stacks optimise query-time retrieval. ARSS optimises *between-turn context acquisition*. That is different. A long-running agent should become aware of relevant changes before the user asks.

### 10.2 Separation of archive, memory and attention

Large-context approaches often collapse storage and attention. ARSS treats them separately:

```text
source archive != retrieval memory != current inbox
```

This is why the live eval can show both 1.8M token live polling and a 2.1k token inbox without contradiction.

### 10.3 Publisher-agent contract

Crawling treats the publisher as terrain. ARSS treats the publisher as a counterparty. Rights, attribution, provenance and optional price are part of the interface.

### 10.4 Registry-to-subscription path

The registry is not just a directory. It emits actionable subscription commands and manifests, including category bundles. “Subscribe my agent to all frontier labs” becomes a concrete operation.

### 10.5 Free-first with optional payment

The protocol supports paid resources without making every feed look commercial. This distinction matters for adoption. Most sources should remain free/public. Premium context can become paid only where the publisher declares it and the local user grants budget.

---

## 11. Threat model and risks

### 11.1 Prompt injection

Feeds, pages, transcripts and user-generated content are untrusted. ARSS metadata cannot override agent policy, tool safety, tenant boundaries or user approvals. Agents must treat feed content as data, not instruction.

### 11.2 Registry spam

A public registry invites junk. Mitigations:

- validation before listing;
- source health checks;
- same-origin publisher claims;
- optional signatures;
- reputation/stake later, not first;
- human curation for starter registries.

### 11.3 Payment abuse

Agents must not auto-pay because a feed asks them to. Payment requires local budget policy, relevance threshold, receipt generation and user/auditor visibility. Public registry manifests should be free-only.

### 11.4 Copyright and rights ambiguity

ARSS can express rights, but cannot make a publisher's claim legally valid by magic. It reduces ambiguity; it does not eliminate law.

### 11.5 Attention poisoning

A malicious or noisy feed may dominate the inbox. Agents need per-source caps, topic scoring, decay, dedupe and user feedback.

### 11.6 Privacy leakage

Subscription choices reveal interests. Private agents should support local registries, private diets and proxy fetching where needed.

---

## 12. Open research questions

1. **Canonical rights vocabulary**  
   Should ARSS define its own minimal vocabulary or map to an existing publisher-rights standard?

2. **Feed health and freshness scoring**  
   How should agents rank stale but high-quality sources against noisy real-time ones?

3. **Attention economics**  
   What is the right objective for inbox selection: relevance, novelty, surprise, source trust, user goals, or all of them?

4. **Payment decisioning**  
   When should an agent pay for canonical text? What confidence threshold is enough?

5. **Registry governance**  
   Should registries be curated, federated, signed, staked, or all of the above?

6. **Private paid subscriptions**  
   How should agents ingest newsletters, member feeds and authenticated publisher accounts without leaking credentials?

7. **Evaluation realism**  
   How do we compare ARSS against live search without turning the benchmark into a search-engine quality contest?

8. **Protocol minimalism**  
   How much should ARSS specify versus leaving to agent runtime policy?

---

## 13. Roadmap

Near-term work:

1. Host a stable public registry URL.
2. Package CLI so `npx arss` works outside the repo.
3. Add feed health checks to the registry: status, last item, last fetch, parse errors.
4. Add publisher claim badges: unclaimed, same-origin claimed, signed, paid.
5. Add feed submission flow.
6. Add eval history and trend charts.
7. Build the x402 paid-content demo end-to-end.
8. Improve transcript and private newsletter adapters.
9. Add source-level retention and quote policy.
10. Write a concise public explainer site.

The demo worth building:

```text
agent subscribes to registry category
  ↓
heartbeat picks up a publisher update
  ↓
agent answers from local memory with citation
  ↓
user asks for deeper detail
  ↓
agent fetches subscribed source live
  ↓
if resource is paid, agent checks local budget
  ↓
agent pays via x402, stores receipt, cites resource
```

That loop demonstrates the whole thesis.

---

## 14. Conclusion

The agent web needs more than tools. It needs subscriptions.

RSS solved human freshness. MCP is solving agent tool calls. RAG solves search over known memory. x402 may solve web-native payments. ARSS connects these into a subscribed-context loop: discover feeds, subscribe an agent, sync quietly, store rights-aware memory, inject only what matters, fetch live on miss and pay only when explicitly allowed.

The point is not to make another feed format for its own sake. The point is to give long-running agents the same basic advantage humans already had: they should not have to rediscover the web every time they wake up.

```text
RSS let humans subscribe to the web.
ARSS lets agents subscribe to context.
```

That is the primitive.
