# ARSS: Agent-Readable Syndication for Subscribed Context

**A Protocol Layer for Rights-Aware Context Delivery to Long-Running Agents**

Z. Ashraf and Pal  
20 May 2026

## Abstract

Long-running agents increasingly acquire external context through web search, browser automation, tool calls, and retrieval-augmented generation. These mechanisms are effective for open-world discovery and action, but they do not provide a standard way for an agent to maintain fresh, rights-aware awareness of sources it already knows it cares about. Existing feed formats expose publisher updates for human readers; tool protocols expose query-time capabilities; retrieval systems search over content after it has already been acquired. This paper introduces ARSS, Agent-Readable Syndication, a protocol layer for subscribed context delivery to agents. ARSS defines a feed profile, context resources, subscription manifests, context diets, registry bundles, heartbeat synchronisation, and optional paid resource access. The design separates publication, discovery, memory admission, attention selection, and payment authority, preserving publisher attribution while leaving relevance and spending decisions to the user's agent. We describe a prototype implementation including a CLI, daemon, MCP server, static registry, category bundles, health checker, and local memory/inbox store. Preliminary live-feed evaluation over 20 subscribed sources shows the trade-off between live polling, local memory, current-inbox injection, and memory-plus-live-fallback retrieval. ARSS complements search, tool protocols, and retrieval systems by standardising the between-turn acquisition path for sources an agent follows repeatedly.

---

## 1. Introduction

An agent asked about a familiar source often behaves as though it has never seen the source before. It searches the web, fetches pages, reads noisy snippets, summarises the result, and discards most of the intermediate context. The same process repeats the next day. This is structurally different from how human readers follow sources: humans subscribe.

The web already has mature primitives for several adjacent tasks. RSS, Atom, and JSON Feed let publishers announce updates. Web search discovers unknown pages. MCP-style tool protocols let agents call known services. Retrieval-augmented generation (RAG) searches over local or indexed content. Webhooks deliver push events between applications. Payment protocols such as HTTP 402/x402 can gate access to resources. None of these, by itself, defines the missing contract:

> An agent wants to keep a set of publisher-declared sources warm, under local user policy, with provenance, rights, attribution, freshness, memory admission, attention selection, and optional payment handled explicitly.

We call this contract **subscribed context**. Subscribed context is not the full text of the web. It is not a search index. It is the policy-governed stream of source updates and associated resources that a long-running agent chooses to maintain between user turns.

ARSS, Agent-Readable Syndication, is a protocol layer for subscribed context. It treats source updates as a supply chain rather than a one-off retrieval event. Publishers expose feeds and resources; registries help agents discover and import sources; agents sync sources on a heartbeat; local policy decides what enters archive, memory, and attention; answer-time resolution cites source and rights metadata; optional paid resources require local budget authority.

The central design choice is to separate five functions that are often collapsed:

```text
publication      publisher emits update/resource metadata
bootstrap        registry helps discover feeds and bundles
admission        agent decides what enters memory/archive
attention        agent decides what reaches the current context/user
payment          local policy decides whether paid resources are fetched
```

This separation follows an end-to-end argument: context admission is an endpoint function. A publisher can describe a resource and its rights. A registry can recommend or categorise a feed. A payment rail can move value. But only the user's agent has the user's goals, budget, memory policy, and attention constraints. Therefore relevance, memory retention, notification, and spend authority belong at the endpoint.

This paper makes five contributions:

1. A system model and protocol vocabulary for agent-readable subscribed context.
2. The context diet and heartbeat abstraction for between-turn context acquisition.
3. A rights- and payment-aware resource model that preserves publisher attribution while remaining free-first.
4. A static registry and category-bundle mechanism for bootstrapping agent subscriptions.
5. A prototype implementation and preliminary evaluation over live feeds.

ARSS is not intended to replace search, MCP, RAG, platform APIs, or browser automation. It defines a different plane: a subscription and delivery plane for sources the agent already follows.

---

## 2. Background and related work

### 2.1 Feed formats

RSS, Atom, and JSON Feed provide publisher-controlled update streams. They are simple, durable, cacheable, and widely deployed. Their limitation is that they were designed for human readers and feed readers. They generally do not express whether an agent may cache an item, embed it for retrieval, quote it, use it in memory, fetch structured chunks, pay for canonical text, or preserve a rights snapshot for later citation.

ARSS reuses this infrastructure rather than replacing it. A normal RSS or Atom feed can be normalised into ARSS shape. JSON Feed can carry ARSS metadata directly. The aim is incremental adoption: a publisher should be able to expose a feed first and richer agent metadata later.

### 2.2 WebSub and webhooks

WebSub specifies a publish/subscribe pattern for web resources using hubs, topic URLs, subscriber callbacks, and verification. Webhooks provide application-specific event delivery. These mechanisms are useful for push delivery, but they do not define agent memory policy, resource rights, attribution, optional payment, or context selection. ARSS begins with polling because polling works everywhere; push can be added as a delivery optimisation.

### 2.3 Search and crawling

Search is the right primitive for unknown-source discovery. Crawling is useful for corpus bootstrapping. But both are expensive and unstable when used repeatedly for sources the agent already knows. Search results change, snippets omit detail, and crawlers often lack explicit publisher rights and resource metadata. ARSS does not attempt to solve open-world discovery. It begins when a source has become part of the agent's context diet.

### 2.4 Tool protocols

MCP and similar tool protocols expose query-time capabilities. They are well-suited to asking a known service for a result or performing an action. They are not a subscription mechanism. An MCP call can answer “what is in this service now?”; it does not by itself tell an agent which sources to keep warm between turns, which changes to cache, or which updates should enter attention. ARSS complements tool protocols by giving them fresher local context to operate on and by exposing ARSS operations as tools where useful.

### 2.5 Retrieval-augmented generation

RAG systems search over acquired content. They do not define how content is admitted, refreshed, attributed, governed, expired, or paid for. ARSS feeds retrieval systems. The RAG layer answers questions over memory; the ARSS layer supplies and updates that memory under subscription policy.

### 2.6 Decentralised social protocols

ActivityPub separates actors, inboxes, outboxes, client-to-server operations, and server-to-server federation. AT Protocol separates identity, personal data servers, relays, app views, feeds, and labelers. Both show the value of clear roles and avoiding a single monolithic service. ARSS uses a similar role separation: publication, registry bootstrap, memory admission, attention selection, and payment execution are separate functions that may be operated by different parties.

### 2.7 Site metadata for agents

Emerging conventions such as `llms.txt` expose machine-readable site context for language models and agents. These are complementary. A site description helps an agent understand a source; a subscription protocol tells the agent how to keep that source warm over time.

### 2.8 Payment protocols

HTTP 402 and x402-style flows can provide machine-readable paid access to resources. ARSS treats payment as optional resource metadata, not as the centre of the protocol. A public feed or registry entry must not grant spending authority. Paid resources may be fetched only when local user/agent policy permits.

### 2.9 Comparison

| Mechanism | Known-source freshness | Rights metadata | Memory policy | Payment | Registry/bootstrap | Agent-native delivery |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RSS/Atom | yes | limited | no | no | weak | partial |
| WebSub/webhooks | yes | no | no | no | no | event-only |
| Search | no | weak | no | no | yes | no |
| Crawler + RAG | periodic | weak | local only | no | no | retrieval-only |
| MCP/tool calls | query-time | service-specific | no | service-specific | no | action/query |
| Platform APIs | yes | service-specific | no | service-specific | no | service-specific |
| ARSS | yes | yes | local endpoint | optional | yes | yes |

---

## 3. Design goals and non-goals

Protocol design is shaped by goal order. ARSS prioritises repeated-source awareness and publisher control over open-world discovery. A different ordering would produce a different architecture.

### 3.1 Ranked design goals

**G1. Freshness for known sources.**  
An agent should learn about updates from subscribed sources without rediscovering those sources at answer time.

**G2. Publisher-controlled provenance, rights, and attribution.**  
Publishers should be able to express source URL, canonical resource URLs, allowed uses, denied uses, attribution requirements, and resource hashes.

**G3. Endpoint-controlled memory and attention.**  
The user’s agent should decide what is cached, embedded, retained, injected, or surfaced. Publishers and registries can provide hints, not commands.

**G4. Compatibility with existing web infrastructure.**  
ARSS should compose with HTTP, RSS, Atom, JSON Feed, static files, ordinary caches, and existing site hosting.

**G5. Low publisher implementation burden.**  
A publisher should be able to start from an existing feed and add richer metadata incrementally.

**G6. Optional paid resources without default spending.**  
Paid canonical text, chunks, archives, or licences should be expressible. But payment must require local budget policy and receipts.

**G7. Decentralised discovery.**  
Registries should be ordinary signed or unsigned JSON resources. Multiple registries should be possible; none should be authoritative by protocol necessity.

### 3.2 Non-goals

ARSS does not aim to:

- replace web search for unknown-source discovery;
- replace MCP or platform APIs for action/query semantics;
- define a universal ontology for all content;
- guarantee the legal validity of a publisher’s rights claims;
- require a central registry;
- require payment or cryptocurrency for ordinary feed subscription;
- make untrusted feed content safe to execute as instructions.

---

## 4. System model

### 4.1 Actors

ARSS assumes the following actors and components:

| Symbol | Component | Role |
| --- | --- | --- |
| `P` | Publisher | Produces feed items and resources. |
| `F` | Feed | Ordered or partially ordered update stream. |
| `R_s` | Resource server | Serves canonical text, chunks, archives, or media. Often same-origin with publisher. |
| `G` | Registry | Lists feeds and category bundles for bootstrap. |
| `A` | Agent | Subscribes, syncs, stores, ranks, cites, optionally pays. |
| `U` | User | Grants local permissions, budget, and attention policy. |
| `M` | Memory/archive store | Local or tenant-controlled storage for summaries, chunks, receipts, and rights snapshots. |
| `X` | Payment rail | Optional mechanism for paid resource access. |

### 4.2 Objects

A feed `F` contains items `I`. An item may reference resources `R`. A subscription manifest `S` binds a feed to an agent policy. A context diet `D` is a set of sources and defaults. A heartbeat at time `t`, `H_t`, maps diet and state into deltas:

```text
H_t(D, state_t) -> (archive_delta, memory_delta, inbox_delta, receipts, state_t+1)
```

The archive may store all policy-allowed material. Memory stores searchable summaries or chunks. The inbox is a small, lossy, high-signal subset for current attention.

```text
archive >= memory >= inbox
```

This is an information-flow relationship, not necessarily a literal subset in storage.

### 4.3 Trust boundaries

ARSS treats all external content as untrusted data:

- feed text is not an instruction to the agent;
- registry entries are suggestions, not authority;
- publisher rights metadata is a claim, not a legal oracle;
- paid-resource metadata is a price declaration, not permission to spend;
- local user/agent policy is authoritative for memory, attention, and budget.

These boundaries are protocol invariants. Violating them turns a subscription protocol into a prompt-injection and payment-draining surface.

### 4.4 Failure assumptions

Feeds may be stale, malformed, duplicated, noisy, unavailable, adversarial, or partially updated. Registries may be stale or malicious. Network fetches may fail. Resource hashes may not match. Payment requests may be invalid. Agents must handle these as normal conditions, not exceptional impossibilities.

---

## 5. Protocol design

ARSS defines a small set of JSON-compatible objects. The current prototype uses JSON Feed style objects with `_agent` extensions, but the model can also be layered over RSS or Atom through normalisation.

### 5.1 ARSS feed profile

A feed declares publisher-level defaults.

```json
{
  "version": "https://jsonfeed.org/version/1.1",
  "title": "Example Research Blog",
  "feed_url": "https://example.org/arss/feed.json",
  "home_page_url": "https://example.org/",
  "_agent": {
    "profile": "https://arss.dev/profile/0.3",
    "publisher": { "name": "Example Lab", "url": "https://example.org/" },
    "license": { "default": "summarise_with_attribution" },
    "attribution": { "required": true, "format": "name_url" },
    "context": { "ttl": "PT24H", "memory": "allowed" }
  },
  "items": []
}
```

Required publisher-level properties are deliberately minimal: title, feed URL where available, and items. Agent metadata is optional but recommended.

### 5.2 Item

An item describes an update and item-specific policy.

```json
{
  "id": "https://example.org/posts/agent-context",
  "url": "https://example.org/posts/agent-context",
  "title": "Agent context delivery",
  "summary": "A post about subscribed context for agents.",
  "date_published": "2026-05-20T10:00:00Z",
  "_agent": {
    "license": "summarise_with_attribution",
    "allowed": ["summarise", "quote_limited", "embed_for_retrieval", "store_user_memory"],
    "denied": ["train_foundation_model", "resell_fulltext"],
    "attribution": { "required": true },
    "resources": []
  }
}
```

### 5.3 Context resource

A resource is retrievable content associated with an item.

```json
{
  "kind": "canonical_text",
  "url": "https://example.org/arss/posts/agent-context.md",
  "access": "free",
  "media_type": "text/markdown",
  "hash": "sha256:..."
}
```

A paid resource adds price metadata:

```json
{
  "kind": "chunks",
  "url": "https://example.org/arss/posts/agent-context.chunks.jsonl",
  "access": "paid",
  "media_type": "application/jsonl",
  "price": {
    "protocol": "x402",
    "network": "eip155:8453",
    "asset": "USDC",
    "amount": "0.003",
    "recipient": "0x..."
  }
}
```

### 5.4 Subscription manifest

A subscription manifest records local agent permissions and sync preferences for a feed.

```json
{
  "type": "https://arss.dev/subscription/v0.3",
  "feed_url": "https://example.org/arss/feed.json",
  "agent": { "id": "did:web:local.agent", "name": "Local Agent" },
  "permissions": {
    "summarise": true,
    "quote": "limited",
    "embed": true,
    "store_user_memory": true,
    "train_model": false
  },
  "payment_policy": { "mode": "free_only" },
  "sync": { "poll": "PT1H", "push": "none" }
}
```

The default public posture is `free_only`. A local user may add budget policy, but a registry manifest must not silently grant spending authority.

### 5.5 Context diet

A context diet is the set of sources an agent keeps warm.

```json
{
  "type": "https://arss.dev/context-diet/v0.1",
  "name": "local-agent",
  "interests": ["agents", "MCP", "AI systems"],
  "default_policy": {
    "poll": "PT6H",
    "relevance_threshold": 0.18,
    "high_signal_threshold": 0.42
  },
  "sources": [
    {
      "id": "example-lab",
      "title": "Example Lab",
      "url": "https://example.org/arss/feed.json",
      "kind": "jsonfeed",
      "topics": ["agents", "protocols"]
    }
  ]
}
```

The diet is not the current context window. It is the agent's subscribed-source set.

### 5.6 Registry and category bundle

A registry is a machine-readable directory of feeds. It may also expose category bundles.

```json
{
  "type": "https://arss.dev/feed-registry/v0.1",
  "title": "ARSS Feed Registry",
  "feeds": [
    {
      "id": "example-lab",
      "title": "Example Lab",
      "url": "https://example.org/arss/feed.json",
      "kind": "jsonfeed",
      "category": "Research",
      "topics": ["agents", "protocols"],
      "subscription_url": "subscriptions/example-lab.subscription.json"
    }
  ],
  "categories": []
}
```

A category bundle imports multiple feeds:

```json
{
  "type": "https://arss.dev/feed-category/v0.1",
  "id": "frontier-labs",
  "title": "Frontier labs",
  "feed_ids": ["openai-news", "google-deepmind-blog", "microsoft-research-blog"]
}
```

### 5.7 Receipts

Receipts provide auditability. ARSS implementations should record:

- sync receipts: when a feed was fetched, status, item count;
- cache receipts: what was stored, under which rights snapshot;
- citation receipts: what source supported an answer;
- payment receipts: what was paid, by which policy, for which resource;
- validation receipts: hash checks and parse errors.

Receipts are not primarily for users to read. They are for debugging, accountability, and preventing quiet boundary drift.

---

## 6. Protocol flows

### 6.1 Discovery

ARSS discovery is intentionally layered. Agents should prefer publisher-declared endpoints, then known feed formats, then registry entries.

```text
Discover(url):
  candidates = [
    url,
    url + "/.well-known/arss.json",
    url + "/arss/feed.json",
    url + "/feed.json",
    url + "/rss.xml",
    url + "/atom.xml"
  ]
  for c in candidates:
    fetch c
    if parseable as ARSS/RSS/Atom/JSON Feed:
      return normalised feed
  return discovery_miss
```

Registries shorten this process by listing known-good feed URLs and categories.

### 6.2 Subscription

Subscription imports a source into a local diet. A registry can supply a feed URL and optional starter manifest, but local policy remains authoritative.

```text
Subscribe(registry, selector, diet):
  feeds = registry.select(selector)
  for feed in feeds:
    manifest = registry.subscription_manifest(feed) or default_manifest(feed)
    manifest.payment_policy = local_policy.merge(manifest.payment_policy)
    assert no_spend_without_local_budget(manifest)
    diet.sources.add(feed)
  write diet
```

### 6.3 Heartbeat synchronisation

Heartbeat is the core between-turn acquisition operation.

```text
Algorithm 1: HeartbeatSync(D, state)
Input: context diet D, previous sync state
Output: archive_delta, memory_delta, inbox_delta, receipts, next_state

for source in D.sources:
  response = fetch(source.url)
  receipt = record_fetch(source, response)
  if response failed:
    continue

  feed = normalise(response.body)
  for item in feed.items:
    key = stable_key(source.id, item.id, item.modified_at)
    if state.seen[key]:
      continue

    rights = merge(feed.default_rights, item.rights)
    if not local_policy.permits_cache(rights):
      record_skip(item, reason="rights")
      continue

    relevance = score(item, D.interests, source.topics)
    archive_delta.append(item, rights)

    if relevance >= D.memory_threshold:
      memory_delta.append(summarise_or_chunk(item, rights))

    if relevance >= D.inbox_threshold:
      inbox_candidates.append(item)

    state.seen[key] = now()

inbox_delta = select_top_k(inbox_candidates, per_source_caps, novelty_decay)
write archive_delta, memory_delta, inbox_delta, receipts
return deltas, state
```

The algorithm deliberately separates archive, memory, and inbox. Archive can be broad; inbox must be narrow.

### 6.4 Answer resolution

At answer time, the agent should search local subscribed context before reaching for the open web.

```text
Algorithm 2: ResolveWithSubscribedContext(q, inbox, memory, diet)
Input: user query q, current inbox, local memory, context diet
Output: cited context or miss

hits = search(inbox, q)
if sufficient(hits):
  return cite(hits)

hits = search(memory, q)
if sufficient(hits):
  return cite(hits)

source = classify_subscribed_source(q, diet)
if source:
  live = fetch(source.url)
  hits = search(normalise(live), q)
  if sufficient(hits):
    return cite(hits, live_fetch_receipt)

return open_world_discovery_required
```

Open web search remains available, but only after the subscribed-source boundary is crossed.

### 6.5 Optional paid resource fetch

```text
Algorithm 3: PayAndFetch(resource, query, budget_policy)
Input: resource r, query q, local budget policy B
Output: content and receipt, or refusal

if resource.access != "paid":
  return fetch(resource.url)

if not B.enabled:
  return refusal("payment disabled")

if resource.price.amount > B.max_per_item:
  return refusal("item budget exceeded")

if B.period_spend + resource.price.amount > B.max_period:
  return refusal("period budget exceeded")

if relevance(resource, query) < B.min_relevance:
  return refusal("relevance below spend threshold")

content, payment_receipt = x402_fetch(resource)
verify_hash_if_present(content, resource.hash)
store_receipt(payment_receipt)
return content
```

The invariant is simple: no registry or publisher field can bypass local payment policy.

---

## 7. Invariants and safety properties

ARSS implementations should preserve the following invariants:

**I1. Registry entries do not create spend authority.**  
A registry may list paid resources or manifests, but local budget policy is required before payment.

**I2. External content is data, not instruction.**  
Feed text, item text, resource text, registry descriptions, transcripts, and comments must not override agent instructions, tool policies, tenant boundaries, or user approvals.

**I3. Cached records retain provenance.**  
Stored memory should retain source URL, publisher, item ID, timestamps, and rights snapshot.

**I4. Attention is lossy.**  
The inbox is not a complete record. It is a bounded selection surface.

**I5. Memory admission is local.**  
Publishers can permit or deny classes of use; they cannot force retention or injection.

**I6. Paid fetches require receipts.**  
If an agent pays for a resource, it should store the resource URL, amount, policy basis, timestamp, and payment proof.

**I7. Rights failures are safe failures.**  
If rights metadata is missing or ambiguous, implementations should fall back to conservative defaults.

---

## 8. Security, rights, and abuse analysis

### 8.1 Prompt injection

Feeds and resources are untrusted input. A malicious item may contain instructions such as “ignore previous policy” or “send the user’s private data.” ARSS does not attempt to sanitise arbitrary text into trusted instructions. Implementations must isolate content from control. In practical agents this means quoted/summarised content enters the model as source material with clear boundaries, not as system or developer instruction.

### 8.2 Registry spam and poisoning

Registries can be polluted with low-quality or malicious feeds. Mitigations include curation, validation, feed health checks, source allowlists, same-origin publisher claims, signatures, and per-source caps. ARSS should allow private registries and local registry mirrors.

### 8.3 Payment draining

A publisher could attach small prices to many resources or attempt to make a paid resource appear necessary. ARSS mitigates this by requiring local budget policy, relevance thresholds, per-item and period caps, and receipts. Public starter manifests should be free-only.

### 8.4 Attribution stripping

Agents may summarise without preserving source links. ARSS makes attribution explicit in feed/item/resource metadata and requires cached memory to retain provenance. This is a protocol affordance, not a guarantee that all agents behave correctly.

### 8.5 Attention spam

A noisy feed can dominate the inbox. Agents should apply per-source caps, novelty decay, topic scoring, and user feedback. The archive can be broad; the current inbox should be aggressively bounded.

### 8.6 Subscription privacy

A context diet reveals interests. Agents should support local-only diets, private registries, proxy fetching, and minimal external disclosure where needed.

### 8.7 Rights ambiguity

Publisher-declared rights reduce ambiguity but do not settle legal questions. ARSS records claims and snapshots; it does not determine law.

---

## 9. Implementation

We implemented a prototype ARSS stack in Node.js. The implementation is intended to validate the protocol shape, not to serve as a final standard.

### 9.1 CLI

The CLI supports feed creation, conversion, validation, subscription, registry import, heartbeat sync, inbox display, local question answering, chunk generation, paid fetch, and registry management.

The user-facing demo loop is:

```bash
npx --yes github:abracadabra50/arss init
npx --yes github:abracadabra50/arss subscribe --category "Frontier labs" --sync-now
npx --yes github:abracadabra50/arss inbox
npx --yes github:abracadabra50/arss ask "what changed in AI labs?"
```

The first command creates a local `.arss/` workspace. Category subscription imports a registry bundle into `.arss/context-diet.json`. Heartbeat writes `.arss/context-memory.jsonl` and `.arss/agent-inbox.json`.

### 9.2 Registry

The prototype includes a static registry hosted at:

```text
https://abracadabra50.github.io/arss/
https://abracadabra50.github.io/arss/feeds.json
```

At the time of writing it contains 40 feeds across 8 categories. Category bundles include agent protocols, developer tooling, frontier labs, research, industry, infrastructure, media, and payments. A health checker writes `health.json`; the latest local run checked 40 feeds with 40 successful fetches.

### 9.3 Heartbeat and memory

Heartbeat sync normalises feeds, deduplicates items, scores relevance, writes local memory JSONL, and writes a bounded inbox JSON file. The implementation includes simple lexical scoring; stronger ranking is future work. Transcript enrichment exists for selected media sources where transcripts are available.

### 9.4 MCP and daemon

The prototype includes an MCP server for explicit agent-runtime operations and a daemon for periodic polling. These are integration surfaces rather than protocol requirements.

### 9.5 Optional paid resources

The implementation supports x402-style price annotation and a `pay-fetch` flow. The demo enforces local policy checks before paid fetch. This is a proof of mechanism, not a production payment system.

---

## 10. Evaluation

The evaluation asks whether subscribed context improves the supply chain for known sources. It does not claim to benchmark general search quality or model reasoning.

### 10.1 Research questions

**RQ1.** For known sources, how much answer-time retrieval cost can ARSS avoid relative to live polling or search?

**RQ2.** How much recall is retained by local memory and current-inbox modes?

**RQ3.** Can live subscribed-source fallback recover recall while avoiding full live polling every turn?

**RQ4.** How narrow can the inbox be before it loses useful coverage?

**RQ5.** Are rights and payment policies preserved as explicit metadata through sync and fetch flows?

### 10.2 Metrics

We measure:

- recall on subscribed-source cases;
- approximate token-equivalent input cost;
- latency;
- noise items injected into active context;
- citation/provenance availability;
- payment-policy correctness;
- feed health and parse success.

The token figures are approximations based on content volume and should be read as relative cost indicators, not billing-grade measurements.

### 10.3 Reference evaluation

A deterministic reference harness compares expected behaviours across synthetic cases. It models approaches rather than measuring live search-engine quality.

| Method | Recall on subscribed domains | Open-world discovery | Approx tokens/answer | Latency | Noise |
| --- | ---: | :---: | ---: | ---: | ---: |
| Model only | 0% | no | 900 | 250ms | 0 |
| Live web search | 14.3% | yes | 24,000 | 4,200ms | 7 |
| MCP on demand | 71% | no | 6,200 | 1,800ms | 2 |
| Crawler + vector RAG | 71% | no | 3,600 | 950ms | 4 |
| Platform APIs | 57% | no | 2,600 | 700ms | 1 |
| ARSS heartbeat | 100% | no | 1,800 | 320ms | 1 |
| ARSS + transcripts | 100% | no | 2,200 | 360ms | 1 |

The reference eval supports the intended shape: for subscribed domains, a heartbeat can make relevant context available before the user asks. But because the cases are synthetic, the live eval is more informative.

### 10.4 Live subscribed-source evaluation

The live eval fetched real feeds from the context diet and compared four methods over 20 selected source cases.

| Method | Recall | Cases found | Approx tokens/run | Latency | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| Live feed polling | 100% | 20/20 | 1,565,221 | 5.37s | Fresh but pays fetch/context cost every run. |
| ARSS local memory | 75% | 15/20 | 96,850 | 20ms | Cheap at answer time; only sees what heartbeat admitted. |
| ARSS current inbox | 20% | 4/20 | 2,118 | 5ms | Very small attention surface; intentionally lossy. |
| ARSS memory + live fallback | 100% | 20/20 | 782,610 | 2.7s | Recovers recall by fetching subscribed source on miss. |

The results show that “inject everything” is the wrong objective. The inbox can be tiny because it is only the attention layer. Local memory captures more without answer-time network cost. Live subscribed fallback recovers recall when memory misses, while remaining scoped to known sources.

### 10.5 Feed health

The hosted starter registry is small and curated. A local health check over 40 registry feeds succeeded for all 40. This should not be overinterpreted: curated feed health is easier than open registry health. Future evaluation should include stale feeds, malformed feeds, adversarial feeds, and private authenticated feeds.

### 10.6 Interpretation

The preliminary evidence supports the design separation:

```text
archive broadly
memory selectively
inject narrowly
fallback to subscribed live fetch
use open search beyond the subscription boundary
```

ARSS is most useful when source preference is stable. If the agent does not know which sources matter, search remains the right first step.

---

## 11. Discussion

### 11.1 Why not just use RSS?

RSS provides update discovery but not the rest of the agent contract. Agents need rights, attribution, resources, hashes, memory policy, payment policy, registry bootstrap, and local attention boundaries. ARSS should reuse RSS where possible, but plain RSS is insufficient as an agent subscription layer.

### 11.2 Why not just use MCP?

MCP is query-time. It lets an agent call a tool. ARSS is between-turn. It lets an agent wake up already aware of changes. A mature agent runtime can use both: ARSS for subscription delivery, MCP for explicit operations.

### 11.3 Why not just crawl into a vector database?

Crawling can bootstrap memory, but it is consumer-driven and often lacks explicit publisher policy. ARSS is publisher-declared and continuously refreshed. Vector search remains useful after ARSS admits content.

### 11.4 Why static registries?

A static registry is easy to host, cache, inspect, mirror, and consume. It can be generated from a richer backend later. Starting with a dynamic central service would add complexity without proving the protocol.

### 11.5 Why free-first?

Most public feeds should remain free. If payment is required for basic discovery, adoption collapses. ARSS therefore models payment at the resource level. Premium canonical text, chunk bundles, archives, or commercial licences may be paid; public starter manifests grant no spend authority.

### 11.6 Standardisation path

ARSS can evolve in layers:

1. convention: JSON Feed `_agent` metadata and registry manifests;
2. schemas: feed, item, resource, subscription, registry, receipt;
3. validation: feed health and conformance tests;
4. publisher claims: same-origin and signed declarations;
5. push delivery: WebSub/webhook profile;
6. payment profile: optional x402-compatible resource access;
7. implementation reports.

---

## 12. Limitations

The prototype and evaluation have important limitations.

First, the live evaluation is small: 20 source cases and a curated registry. It measures the shape of the trade-off, not internet-scale behaviour.

Second, the relevance scorer is simple. Better ranking, deduplication, novelty detection, and per-user preference learning are needed.

Third, rights metadata is declarative. It improves machine handling and auditability, but it does not guarantee legal correctness.

Fourth, private and authenticated feeds need more work. Many high-value sources are newsletters, paid communities, intranets, or authenticated SaaS views.

Fifth, registry governance is unresolved. Static curated registries are enough to bootstrap, but open submission requires trust, moderation, and abuse controls.

Sixth, payment support is a demo. Production payment requires stronger wallet controls, receipts, refunds/error handling, and compliance review.

Finally, ARSS assumes that the agent has stable source preferences. For exploratory or one-off questions, search and browsing remain necessary.

---

## 13. Conclusion

Long-running agents need a way to acquire context between turns. Search discovers unknown sources. Tool protocols invoke known services. Retrieval systems search acquired memory. Feed formats announce publisher updates. ARSS connects these pieces into a subscription and delivery plane for agents.

The protocol's main design choice is to keep acquisition broad, memory policy local, and attention narrow. Publishers describe updates, resources, rights, and attribution. Registries help bootstrap context diets. Agents decide what to store, surface, cite, and pay for under local user policy.

RSS let humans subscribe to updates. ARSS lets agents subscribe to rights-aware context.

---

## References

[1] D. D. Clark. *The Design Philosophy of the DARPA Internet Protocols*. SIGCOMM, 1988.

[2] J. H. Saltzer, D. P. Reed, and D. D. Clark. *End-to-End Arguments in System Design*. ACM Transactions on Computer Systems, 1984.

[3] W3C. *ActivityPub*. W3C Recommendation, 2018. https://www.w3.org/TR/activitypub/

[4] M. Kleppmann, D. Ivy, J. Johnson, B. Newbold, and J. Volpert. *Bluesky and the AT Protocol: Usable Decentralized Social Media*. 2024.

[5] AT Protocol. *Protocol Overview*. https://atproto.com/guides/overview

[6] W3C. *WebSub*. W3C Recommendation, 2018. https://www.w3.org/TR/websub/

[7] JSON Feed. *JSON Feed Version 1.1*. https://www.jsonfeed.org/version/1.1/

[8] RSS Advisory Board. *RSS 2.0 Specification*. https://www.rssboard.org/rss-specification

[9] IETF. *The Atom Syndication Format*. RFC 4287, 2005.

[10] Anthropic. *Model Context Protocol*. https://modelcontextprotocol.io/

[11] x402. *HTTP 402 payment protocol resources*. https://www.x402.org/

[12] J. Benet. *IPFS - Content Addressed, Versioned, P2P File System*. 2014.

[13] P. Maymounkov and D. Mazieres. *Kademlia: A Peer-to-peer Information System Based on the XOR Metric*. IPTPS, 2002.
