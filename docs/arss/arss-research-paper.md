# ARSS: Agent-Readable Syndication for Subscribed Context

Zishan Ashraf  
Preprint, May 2026

## Abstract

Agents increasingly use web search, browser automation, tool calls, and retrieval-augmented generation to obtain external context. These mechanisms work for open-ended discovery and task execution, but they are a poor fit for a common recurring case: an agent repeatedly needs fresh information from sources it already follows. Existing feed formats expose updates for human readers; tool protocols expose query-time capabilities; retrieval systems search over content after it has been acquired. None defines a publisher-controlled, rights-aware, policy-governed subscription layer for long-running agents. This paper presents ARSS, Agent-Readable Syndication for subscribed context. ARSS defines feed metadata, context resources, subscription manifests, context diets, registries, heartbeat synchronisation, and receipts. Its central design principle is that context admission is an end-to-end function: publishers describe resources and rights, registries assist discovery, but agents apply local policy for memory, attention, and payment. We describe a prototype implementation and evaluate it over live feeds. The results show the intended trade-off: local memory greatly reduces answer-time cost, a small inbox provides bounded attention, and live subscribed-source fallback recovers recall without returning to open-ended rediscovery.

**Keywords:** agent protocols, web syndication, RSS, retrieval-augmented generation, MCP, context engineering, HTTP 402, x402.

---

## 1. Introduction

A long-running agent has two different context problems. The first is discovery: finding sources that may answer a new question. The second is continuity: staying aware of sources already known to matter. Current agent systems often collapse these problems. When asked about a source they have used before, they search again, fetch again, parse again, and spend context again. That is acceptable for one-off discovery. It is inefficient and brittle for sources an agent follows repeatedly.

Human information systems solved the continuity problem with subscription. A reader does not search the web every morning to determine whether a journal, blog, changelog, or standards body has published. The reader subscribes. Agents need an analogous primitive, but the human feed-reader model is insufficient. Agents must decide whether they may cache content, embed it for retrieval, quote it, surface it to the user, purchase richer resources, or retain it in memory. They also need provenance and receipts because context supplied today may support an answer days later.

ARSS is a protocol layer for this continuity problem. It does not replace search, tool calls, browser automation, platform APIs, or retrieval systems. Instead, it defines the acquisition and delivery plane that precedes them for recurring sources. A publisher exposes updates and resources. A registry helps bootstrap subscriptions. An agent synchronises a context diet on a heartbeat. Local policy determines what enters archive, memory, and the current inbox. Answer-time retrieval uses local memory first, falls back to subscribed live fetches when necessary, and uses open-world search only beyond the subscription boundary.

The paper's main design claim is an end-to-end one: **context admission belongs at the agent endpoint**. Publishers can state permissions and attribution requirements. Registries can curate feeds. Payment rails can execute a paid fetch. But only the user's agent has the user's task, budget, memory policy, and attention constraints. ARSS therefore separates five functions that are often conflated:

| Function | Deciding party | Protocol role |
| --- | --- | --- |
| Publication | Publisher | Declare updates, resources, provenance, rights. |
| Bootstrap | Registry | List feeds and bundles for import. |
| Admission | Agent/user policy | Decide archive and memory retention. |
| Attention | Agent/user policy | Decide what reaches the active inbox. |
| Payment | Agent/user policy | Decide whether to fetch paid resources. |

This separation is deliberately conservative. A public registry entry must not create spending authority. Feed content must not become an instruction. Publisher metadata may permit uses, but it cannot force memory retention or user attention.

This paper contributes:

1. a system model for subscribed context in agent runtimes;
2. a protocol vocabulary for feeds, resources, subscriptions, context diets, registries, and receipts;
3. heartbeat and answer-resolution algorithms that separate archive, memory, and inbox;
4. a rights and payment model that is publisher-declared but endpoint-enforced;
5. a prototype implementation and preliminary live-feed evaluation.

The narrow claim is the strong claim: for recurring sources, subscription should dominate rediscovery.

---

## 2. Design requirements

ARSS follows the protocol-design lesson that priorities matter. Optimising for open-world discovery would produce a search engine. Optimising for application actions would produce a tool protocol. ARSS instead optimises for recurring-source freshness under local policy.

**R1. Known-source freshness.** An agent should learn that a subscribed source changed without waiting for a user question.

**R2. Publisher-declared provenance and rights.** Source URL, canonical resource URL, attribution requirements, allowed uses, denied uses, hashes, and prices should be machine-readable.

**R3. Endpoint-controlled admission.** The agent, under user or tenant policy, decides whether content is archived, embedded, retained, injected, surfaced, or purchased.

**R4. Web compatibility.** The protocol should compose with HTTP, static hosting, RSS, Atom, JSON Feed, caches, and ordinary URLs.

**R5. Low publisher burden.** A publisher should be able to start with an existing feed and add ARSS metadata incrementally.

**R6. Free-first adoption.** Public feeds and registry starter manifests should require no payment. Paid resources are optional and resource-scoped.

**R7. Decentralised bootstrap.** Registries are ordinary documents that can be mirrored, forked, signed, curated, or kept private. No central registry is required by the protocol.

These requirements imply non-goals. ARSS does not perform unknown-source discovery, define a universal ontology, replace platform APIs, settle legal questions about copyright, or make untrusted content safe to execute.

---

## 3. System model

### 3.1 Actors and stores

ARSS models subscribed context as a flow across independent roles.

| Symbol | Component | Description |
| --- | --- | --- |
| `P` | Publisher | Origin of feed items and resources. |
| `F` | Feed | Publisher-declared update stream. |
| `R` | Resource | Canonical text, chunk bundle, media, archive, or licence. |
| `G` | Registry | Bootstrap document listing feeds and bundles. |
| `A` | Agent | Runtime that subscribes, synchronises, retrieves, cites, and optionally pays. |
| `U` | User/policy authority | Entity controlling memory, attention, and budget policy. |
| `M` | Memory store | Local or tenant-controlled searchable context. |
| `I` | Inbox | Bounded high-signal context for current attention. |
| `X` | Payment rail | Optional mechanism for paid resource access. |

A source `σ` is identified by a feed URL plus publisher metadata. A feed item `u` is an update. A resource `r` is a retrievable object associated with an item. A subscription `s` binds a source to local policy. A context diet `D` is the set of sources that an agent keeps warm.

A heartbeat at time `t` is a state transition:

```text
H_t(D, S_t) -> (Δarchive, Δmemory, Δinbox, receipts, S_{t+1})
```

Archive, memory, and inbox are separate surfaces. Archive is the durable record permitted by policy. Memory is the retrieval substrate. Inbox is the small active-context surface. Good ARSS implementations should make the inbox lossy by design.

### 3.2 Trust assumptions

ARSS assumes all external material is untrusted:

- feeds, resources, registry descriptions, and transcripts are data, not instructions;
- registries suggest sources but do not authorise actions;
- publisher rights metadata is a claim to preserve and enforce locally, not a legal oracle;
- paid-resource metadata is not permission to spend;
- local user or tenant policy is authoritative for memory, attention, and payment.

This trust boundary is not an implementation detail. It is part of the protocol model. Without it, a subscription feed becomes an instruction-injection and payment-draining channel.

---

## 4. Protocol objects

ARSS is intentionally small. It defines object types rather than a new transport. Objects may be served as JSON, embedded in JSON Feed, or derived from RSS/Atom through normalisation.

### 4.1 Feed descriptor

A feed descriptor names the publisher, declares defaults, and lists items. Agent metadata includes default licence, attribution, cache lifetime, and resource policy. A minimal publisher may omit most of this and rely on conservative defaults.

### 4.2 Item descriptor

An item descriptor represents one update. It includes a stable identifier, source URL, title, timestamp, summary or content reference, item-level rights, and optional resources. Item-level metadata overrides feed defaults.

### 4.3 Context resource

A resource is a retrievable representation associated with an item. Typical kinds are canonical text, chunk bundles, transcripts, structured data, archives, and commercial licences. A resource has a URL, media type, access mode, optional hash, and optional price.

### 4.4 Subscription manifest

A subscription manifest records the local policy under which an agent follows a feed: permissions, polling cadence, storage policy, and payment policy. Starter manifests distributed by registries should be free-only. Local configuration may add budget authority, but that authority is not portable by default.

### 4.5 Context diet

A context diet is a local set of subscribed sources plus defaults for relevance, polling, storage, and attention. It is analogous to a reading list, not a context window. The diet says what should be kept warm; the inbox says what deserves attention now.

### 4.6 Registry and category bundle

A registry lists feeds. A category bundle lists feed IDs that can be imported together. Registries are ordinary documents. Their job is bootstrap and curation, not enforcement.

### 4.7 Receipts

Receipts record what happened: fetches, parse failures, cache decisions, rights snapshots, citations, paid fetches, and hash validation. They are the audit trail connecting a later answer to the source update that entered memory.

---

## 5. Protocol flows

### 5.1 Discovery

Discovery resolves a site or registry entry to a normalised feed.

```text
Discover(url):
  for candidate in well_known_and_feed_urls(url):
    response = fetch(candidate)
    if parseable(response):
      return normalise(response)
  return miss
```

Discovery is deliberately best-effort. ARSS does not require every publisher to use the same endpoint on day one.

### 5.2 Subscribe

Subscription imports sources into a local context diet.

```text
Subscribe(selector, registry, diet, local_policy):
  feeds = registry.select(selector)
  for feed in feeds:
    manifest = registry.manifest(feed) or default_manifest(feed)
    manifest = local_policy.merge(manifest)
    assert manifest.payment_policy cannot spend unless locally enabled
    diet.sources.add(feed, manifest)
  persist(diet)
```

The assertion is the important part. A registry can make subscription convenient; it cannot grant local spend authority.

### 5.3 Heartbeat

Heartbeat is the between-turn synchronisation operation.

```text
Algorithm 1: HeartbeatSync(D, S)
Input: context diet D, previous state S
Output: archive delta, memory delta, inbox delta, receipts, next state

for each source σ in D:
  response = fetch(σ.feed_url)
  record fetch receipt
  if response failed: continue

  F = normalise(response)
  for each item u in F.items:
    k = stable_key(σ, u)
    if S.seen(k): continue

    rights = merge(F.defaults, u.rights)
    if not policy.permits_storage(rights):
      record skip receipt
      continue

    score = relevance(u, D.interests, σ.topics)
    append archive delta with rights snapshot

    if score >= policy.memory_threshold:
      append memory delta

    if score >= policy.inbox_threshold:
      add u to inbox candidates

    S.mark_seen(k)

I = select_top_k(inbox candidates, source caps, novelty decay)
return deltas, receipts, S
```

The heartbeat does not decide what the language model should believe. It produces governed context surfaces that answer-time retrieval may use.

### 5.4 Answer resolution

At answer time, the agent should prefer the cheapest governed surface that can answer the query.

```text
Algorithm 2: Resolve(q, I, M, D)
if sufficient(search(I, q)):
  return cited hits from inbox

if sufficient(search(M, q)):
  return cited hits from memory

σ = infer_subscribed_source(q, D)
if σ exists:
  F = fetch_and_normalise(σ.feed_url)
  if sufficient(search(F, q)):
    return cited hits with live-fetch receipt

return open_world_discovery_required
```

This flow preserves the role of search. Search is still necessary when the answer lies outside the subscribed boundary.

### 5.5 Paid resource fetch

Paid fetch is a resource-level operation guarded by local policy.

```text
Algorithm 3: PaidFetch(r, q, B)
if r.access is free:
  return fetch(r.url)

if B.disabled: refuse
if r.price > B.max_per_item: refuse
if B.period_spend + r.price > B.max_period: refuse
if relevance(r, q) < B.min_relevance: refuse

content, payment_receipt = x402_fetch(r)
verify hash if supplied
store payment receipt
return content
```

Payment support is therefore an extension of retrieval, not a prerequisite for subscription.

---

## 6. Safety properties

ARSS implementations should preserve the following invariants.

**I1. No registry-created spend.** A registry entry or starter manifest cannot authorise payment.

**I2. Content-control separation.** External content must not be interpreted as system, developer, or policy instruction.

**I3. Provenance retention.** Cached records retain publisher, source URL, item ID, timestamp, and rights snapshot.

**I4. Local admission.** Publishers can permit or deny classes of use; agents decide local retention and attention.

**I5. Bounded inbox.** The inbox is a selected surface, not a complete mirror of subscribed sources.

**I6. Paid fetches are receipted.** Any paid retrieval records resource, price, policy basis, timestamp, and payment proof.

**I7. Ambiguity fails conservatively.** Missing or malformed rights metadata should reduce, not expand, permitted use.

---

## 7. Prototype implementation

We implemented ARSS as a Node.js prototype. The codebase includes:

- a CLI for init, subscribe, heartbeat, inbox, local query, validation, conversion, registry import, and paid fetch;
- a static registry generator and hosted registry;
- category bundles for common agent context diets;
- a feed health checker;
- a local JSONL memory and JSON inbox store;
- a daemon for periodic synchronisation;
- an MCP server for explicit runtime integration;
- x402-compatible paid-resource experiments.

The current public demo path is:

```bash
npx --yes github:abracadabra50/arss init
npx --yes github:abracadabra50/arss subscribe --category "Frontier labs" --sync-now
npx --yes github:abracadabra50/arss inbox
npx --yes github:abracadabra50/arss ask "what changed in AI labs?"
```

The hosted registry is available at:

```text
https://abracadabra50.github.io/arss/
https://abracadabra50.github.io/arss/feeds.json
```

At the time of evaluation the registry contained 40 curated feeds across 8 categories. A health check successfully fetched and parsed all 40. This is a deployment smoke test, not evidence that arbitrary registries will remain healthy.

---

## 8. Evaluation

The evaluation asks whether ARSS provides a useful retrieval-cost and attention trade-off for recurring sources. It does not claim to benchmark general web search quality.

### 8.1 Methodology

We use two harnesses. The reference harness is deterministic and compares expected properties of retrieval strategies over synthetic cases. The live harness fetches real feeds from the current context diet and evaluates whether selected source cases are recoverable from four surfaces: live polling, local memory, current inbox, and memory plus subscribed live fallback.

Metrics are recall, approximate input volume, latency, and noise. Approximate token counts are derived from content volume and should be read as relative cost indicators.

### 8.2 Reference comparison

| Method | Subscribed-domain recall | Approx. input/answer | Latency | Noise | Rights handling |
| --- | ---: | ---: | ---: | ---: | ---: |
| Model only | 0.0 | 900 | 250 ms | 0 | 0.00 |
| Live web search | 0.143 | 24,000 | 4,200 ms | 7 | 0.28 |
| MCP on demand | 0.714 | 6,200 | 1,800 ms | 2 | 0.45 |
| Crawler + vector RAG | 0.714 | 3,600 | 950 ms | 4 | 0.22 |
| Platform API | 0.571 | 2,600 | 700 ms | 1 | 0.65 |
| ARSS heartbeat | 1.000 | 1,800 | 320 ms | 1 | 0.95 |
| ARSS + transcripts | 1.000 | 2,200 | 360 ms | 1 | 0.95 |

The reference harness mostly validates the design intent: when the relevant source is already subscribed, pre-acquisition can reduce answer-time work and preserve policy metadata.

### 8.3 Live subscribed-source evaluation

| Surface | Recall | Cases | Approx. input/run | Latency | Interpretation |
| --- | ---: | ---: | ---: | ---: | --- |
| Live feed polling | 1.00 | 20/20 | 1,565,221 | 5.37 s | Fresh but pays full fetch/context cost each run. |
| ARSS local memory | 0.75 | 15/20 | 96,850 | 20 ms | Cheap answer-time access; misses items not admitted by policy. |
| ARSS current inbox | 0.20 | 4/20 | 1,951 | 5 ms | Very small attention surface; intentionally lossy. |
| Memory + subscribed fallback | 1.00 | 20/20 | 782,610 | 2.69 s | Recovers recall without open-world rediscovery. |

The important result is not that ARSS “beats search” in all cases. It does not try to. The result is that the protocol exposes a useful continuum: archive broadly, admit selectively, inject narrowly, and fall back within the subscribed boundary before using open-world discovery.

### 8.4 Threats to validity

The live run is small and uses curated sources. The ranking function is simple. Token estimates are approximate. Feed health is easier in a curated registry than in an open ecosystem. Rights compliance is measured as metadata preservation, not legal correctness. These limitations make the results preliminary; they are sufficient to test protocol shape, not to claim production effectiveness.

---

## 9. Security and abuse analysis

### 9.1 Prompt injection

Feed content can contain hostile instructions. ARSS's defence is not to trust the content. Runtime integrations must place feed text in quoted or cited source contexts, never in control channels. This is especially important for heartbeat systems that run without direct user supervision.

### 9.2 Registry poisoning

A malicious registry can recommend spam, phishing, or prompt-injection feeds. Mitigations include signed registries, same-origin publisher claims, curation, health checks, per-source caps, private registries, and local allowlists.

### 9.3 Payment draining

Paid resources create a new abuse surface. ARSS limits this by making payment local, budgeted, relevance-gated, and receipted. No public registry should ship a default spend budget.

### 9.4 Attribution loss

Agents may summarise content without preserving source links. ARSS reduces this risk by making provenance and attribution part of stored records and answer citations. It cannot force non-conforming agents to behave well.

### 9.5 Subscription privacy

A context diet reveals interests. Private agents should support local-only diets, proxy fetches, private registries, and minimal disclosure of source lists.

---

## 10. Related work

Clark's account of the DARPA Internet protocols shows how ranked design goals explain architectural choices. ARSS adopts this style: known-source freshness and endpoint policy are higher priorities than open discovery or centralised control.

The end-to-end argument of Saltzer, Reed, and Clark is directly relevant. Functions that require endpoint knowledge should live at the endpoint, with lower layers providing performance optimisations. ARSS applies this to context admission: publishers and registries can supply metadata, but relevance, attention, and spend decisions require local user context.

ActivityPub demonstrates the value of explicit actors, inboxes, outboxes, and client/server versus server/server flows. AT Protocol demonstrates role separation for decentralised systems: identity, data hosting, relays, views, feeds, and moderation can be operated independently. ARSS uses the same design instinct for publication, registry bootstrap, memory admission, attention selection, and payment execution.

Distributed systems such as Kademlia and IPFS provide a different lesson: protocols benefit from crisp object identity, state transitions, and measurable behaviour. ARSS is not a peer-to-peer storage network, but it borrows the discipline of defining objects, receipts, and retrieval flows precisely.

RSS, Atom, JSON Feed, and WebSub are the closest deployment ancestors. ARSS extends their syndication model for agent runtimes while retaining the same HTTP-native deployment posture.

---

## 11. Limitations and future work

The current prototype is intentionally small. The registry is curated. Relevance scoring is lexical. Authentication, private feeds, publisher signatures, signed registries, richer rights vocabularies, and robust paid-resource handling need further work.

The most important next step is a conformance suite: feed validity, rights preservation, no-spend-by-default, prompt-injection boundary tests, receipt generation, and heartbeat determinism. A second step is a larger longitudinal evaluation comparing live search, subscribed memory, and hybrid fallback over weeks rather than one run.

The protocol also needs a cleaner separation between the paper and the specification. This paper motivates the architecture and reports early evidence. Normative field definitions, schema versions, and conformance language belong in a separate spec.

---

## 12. Conclusion

Agents need a continuity primitive. Search finds unknown sources. Tool protocols call known services. Retrieval systems search acquired memory. Feeds announce publisher updates. ARSS connects these pieces into a subscription and delivery layer for recurring agent context.

The design is intentionally modest: acquire from known sources, preserve provenance and rights, let local policy decide memory and attention, and require explicit authority for payment. That modesty is the point. Protocols that survive tend to be narrow enough to implement and useful enough to compose.

RSS lets humans subscribe to updates. ARSS lets agents subscribe to context.

---

## Appendix A. Example object fragments

A minimal feed-level metadata fragment:

```json
{
  "title": "Example Lab",
  "feed_url": "https://example.org/arss/feed.json",
  "_agent": {
    "profile": "https://arss.dev/profile",
    "publisher": { "name": "Example Lab", "url": "https://example.org/" },
    "license": { "default": "summarise_with_attribution" },
    "attribution": { "required": true }
  }
}
```

A resource descriptor:

```json
{
  "kind": "canonical_text",
  "url": "https://example.org/arss/posts/context.md",
  "access": "free",
  "media_type": "text/markdown",
  "hash": "sha256:..."
}
```

A paid chunk bundle:

```json
{
  "kind": "chunks",
  "url": "https://example.org/arss/posts/context.chunks.jsonl",
  "access": "paid",
  "media_type": "application/jsonl",
  "price": {
    "protocol": "x402",
    "network": "eip155:8453",
    "asset": "USDC",
    "amount": "0.003"
  }
}
```

A free-first subscription manifest:

```json
{
  "type": "https://arss.dev/subscription",
  "feed_url": "https://example.org/arss/feed.json",
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

## References

[1] D. D. Clark. The Design Philosophy of the DARPA Internet Protocols. SIGCOMM, 1988.

[2] J. H. Saltzer, D. P. Reed, and D. D. Clark. End-to-End Arguments in System Design. ACM Transactions on Computer Systems, 1984.

[3] W3C. ActivityPub. W3C Recommendation, 2018. https://www.w3.org/TR/activitypub/

[4] M. Kleppmann, D. Ivy, J. Johnson, B. Newbold, and J. Volpert. Bluesky and the AT Protocol: Usable Decentralized Social Media. 2024.

[5] AT Protocol. Protocol Overview. https://atproto.com/guides/overview

[6] W3C. WebSub. W3C Recommendation, 2018. https://www.w3.org/TR/websub/

[7] JSON Feed. JSON Feed Version 1.1. https://www.jsonfeed.org/version/1.1/

[8] RSS Advisory Board. RSS 2.0 Specification. https://www.rssboard.org/rss-specification

[9] IETF. The Atom Syndication Format. RFC 4287, 2005.

[10] Anthropic. Model Context Protocol. https://modelcontextprotocol.io/

[11] x402. HTTP 402 payment protocol resources. https://www.x402.org/

[12] J. Benet. IPFS - Content Addressed, Versioned, P2P File System. 2014.

[13] P. Maymounkov and D. Mazieres. Kademlia: A Peer-to-peer Information System Based on the XOR Metric. IPTPS, 2002.
