# ARSS research-paper redesign plan

Date: 2026-05-20  
Status: planning note for rewriting `docs/arss/arss-subscribed-context-paper.md`

## 1. Diagnosis

The current ARSS paper is a strong product/theory essay, not yet a research paper.

It has the right thesis:

> Long-running agents need a subscription/delivery plane for known sources, distinct from search, MCP and RAG.

But it reads like a manifesto plus implementation note. A credible protocol paper needs more structure:

- explicit design goals and their priority order;
- related work with a clear taxonomy;
- a system model;
- protocol actors, objects and state machines;
- threat model and trust assumptions;
- algorithms/pseudocode;
- invariants and safety properties;
- implementation details separated from the protocol;
- evaluation questions, methodology and reproducible metrics;
- limitations and deployment path.

## 2. Protocol-paper corpus and what to steal

### 2.1 Clark — *The Design Philosophy of the DARPA Internet Protocols*

Source reviewed: David D. Clark, SIGCOMM 1988 / CCR reprint.

What makes it good:

- Starts from one top-level goal: interconnect existing networks.
- Gives a ranked list of secondary goals.
- Explains that a different priority ordering would have produced a different architecture.
- Shows why controversial design choices follow from the goal ordering.
- Treats history and implementation pressure as part of the design, not an afterthought.

What ARSS should steal:

- A ranked design-goal table.
- An explicit statement that ARSS optimises for *known-source freshness and publisher control*, not open-world discovery.
- Show trade-offs: free-first adoption over payment-first monetisation; publisher metadata over blind crawling; local memory over central platform indexing.

ARSS design-goal ordering should be:

1. Keep long-running agents aware of changes in known sources.
2. Preserve publisher attribution, rights and provenance.
3. Minimise active-context/token cost by separating archive, memory and inbox.
4. Compose with existing web/feed infrastructure.
5. Support optional paid resources without requiring payment for discovery.
6. Permit decentralised registries and local policy.
7. Keep publisher implementation burden low.

### 2.2 Saltzer/Reed/Clark — *End-to-End Arguments in System Design*

Source reviewed: MIT paper text.

What makes it good:

- Introduces one durable design principle.
- Uses concrete examples to decide where functions belong.
- Distinguishes correctness from performance enhancement.
- Avoids magic lower-layer guarantees; pushes application-specific guarantees to the endpoints.

What ARSS should steal:

- A function-placement argument:

```text
Publisher/feed layer: exposes updates, resources, rights, attribution, freshness hints.
Agent/runtime layer: decides relevance, memory admission, payment, user notification.
Registry layer: helps discovery and bootstrap, but does not decide user policy.
Payment layer: transports value, but does not decide whether content is worth buying.
```

- Explicitly argue that relevance, spending and attention cannot be fully solved by publishers or registries. They require user/agent policy at the endpoint.

Core ARSS end-to-end claim:

> Context admission is an end-to-end function. A publisher can describe resources and rights, but only the user’s agent can decide whether an update belongs in that user’s memory or attention.

### 2.3 ActivityPub — W3C Recommendation

Source reviewed: W3C ActivityPub spec.

What makes it good:

- Starts with roles and endpoints: actors, inbox, outbox.
- Separates client-to-server and server-to-server behaviour.
- Uses examples early.
- Normative shape is implementable: objects, endpoints, delivery behaviour.
- Has implementation reports and test-suite posture.

What ARSS should steal:

- Define actors and endpoints in one page:

```text
Publisher: emits feed and resources.
Agent: subscribes, syncs, stores, cites, optionally pays.
Registry: lists sources and category bundles.
Resource server: serves canonical/chunk/archive resources.
Wallet/facilitator: handles optional paid fetch.
User: grants local policy and budget.
```

- Define ARSS endpoints/paths:

```text
/.well-known/arss.json
/arss/feed.json
/arss/resources/{id}.md
/arss/resources/{id}.chunks.jsonl
/arss/categories/{slug}.json
```

- Include example JSON objects in the main paper, not only docs.

### 2.4 AT Protocol / Bluesky paper

Sources reviewed: AT Protocol overview and Kleppmann et al. Bluesky/AT Protocol paper.

What makes it good:

- Connects technical design to user-facing goals.
- Separates roles cleanly: PDS, Relay, App View, feed generators, labelers.
- Explains why federation was chosen and where it is hidden from users.
- Uses portability and agency as design drivers.
- Separates speech/reach: data hosting is not the same as algorithmic distribution.

What ARSS should steal:

- Role separation:

```text
source publication != registry curation != memory admission != attention selection != payment execution
```

- A strong agency frame: agents should let users choose context diets, registries, ranking policies and budgets.
- A usability principle: decentralisation must not leak as complexity. “Subscribe to Frontier labs” should work without users caring about individual feed formats.

ARSS analogue to speech/reach:

```text
publication layer = publishers emit update/resource metadata
attention layer   = agents decide what reaches the user
```

This is a clean conceptual contribution.

### 2.5 Kademlia / Chord / IPFS-style papers

Sources considered from protocol canon; use for structure in the rewrite.

What makes them good:

- Formalise the system model.
- Define node/resource identity.
- Specify algorithms precisely.
- Evaluate with latency, hops, churn, storage and failure behaviour.

What ARSS should steal:

- Formal definitions:

```text
Feed F = (url, publisher, items, default_policy, provenance)
Item I = (id, url, timestamps, summary, resources, rights)
Resource R = (kind, url, access, media_type, hash, price?)
Subscription S = (feed, agent, permissions, sync_policy, budget_policy)
ContextDiet D = set<Sources, interests, default_policy>
Heartbeat H_t = sync(D, state_t) -> (archive_delta, memory_delta, inbox_delta, receipts)
```

- Algorithms:

```text
Discover(source_url)
Subscribe(registry, feed_or_category, diet)
Heartbeat(diet, previous_state)
AdmitToMemory(item, rights, relevance_policy)
SelectInbox(memory_delta, attention_policy)
ResolveQuestion(query, memory, diet)
PayAndFetch(resource, budget_policy)
```

- Evaluation should measure the actual protocol promises, not general answer quality.

### 2.6 Bitcoin whitepaper / BitTorrent economics-style papers

Use as pattern, not direct analogy.

What makes them good:

- Compact problem statement.
- Clear adversary/economic assumptions.
- Mechanism design tied to incentives.
- Receipts/proofs matter.

What ARSS should steal:

- Treat receipts as first-class:

```text
sync receipt
cache receipt
citation receipt
payment receipt
rights snapshot
```

- Payment section should discuss abuse and incentives:

```text
No auto-pay from public manifests.
Payment requires local budget + relevance threshold + receipt.
Paid resource discovery must remain visible before spend.
```

### 2.7 WebSub / feed protocol specs

Use as deployment pattern.

What makes them good:

- Uses ordinary HTTP.
- Defines hub/subscriber/content publisher roles.
- Handles verification and callback intent explicitly.
- Allows incremental adoption from existing feeds.

What ARSS should steal:

- Be aggressively HTTP-native.
- Define polling first; push/webhook later.
- Treat category bundles and registry manifests as ordinary JSON resources.
- Do not require new infrastructure for a publisher to adopt v1.

## 3. Distilled protocol-paper template for ARSS

The updated ARSS paper should follow this structure.

### Title

**ARSS: Agent-Readable Syndication for Subscribed Context**

Subtitle if needed:

**A Protocol Layer for Rights-Aware, Fresh, Publisher-Controlled Context Delivery to Long-Running Agents**

### Abstract

Needs to be 180–230 words, academic, no manifesto tone.

Must include:

- Problem: agents repeatedly search/scrape despite stable source preferences.
- Gap: RSS lacks agent rights/memory/payment semantics; MCP lacks subscription; RAG lacks admission/freshness policy.
- Contribution: ARSS protocol objects, context diet, heartbeat, memory/inbox separation, registry/category bundles, optional paid resources.
- Implementation: CLI/daemon/MCP/registry with 40 feeds.
- Evaluation: live eval over 20 sources showing memory/inbox/fallback trade-offs.
- Claim: subscribed context complements search and tool calls for repeated-source awareness.

### 1. Introduction

Research-paper shape:

1. Open with a concrete failure mode: an agent answers by web search although the source is already known/subscribed.
2. State that long-running agents need *between-turn acquisition*.
3. Define subscribed context.
4. Contributions list.
5. Non-goal: not replacing search/MCP/RAG.

Contributions should be explicit:

```text
C1. A system model and protocol vocabulary for agent-readable syndicated context.
C2. The context diet + heartbeat abstraction for between-turn context acquisition.
C3. A rights/payment-aware resource model that preserves publisher control while remaining free-first.
C4. A static registry/category-bundle mechanism for bootstrapping agent subscriptions.
C5. A prototype implementation and preliminary evaluation over live feeds.
```

### 2. Background and related work

Use taxonomy, not vibes.

Subsections:

- RSS/Atom/JSON Feed: update discovery for humans.
- WebSub/webhooks: push delivery.
- MCP/tool protocols: query/action plane.
- RAG/crawling: local retrieval after acquisition.
- ActivityPub/ATProto: decentralised protocol role separation.
- `llms.txt`/AI site metadata: source description, not subscription delivery.
- Payment protocols/x402: optional resource access.

Need a comparison table with columns:

```text
Known-source freshness | Rights metadata | Memory policy | Payment | Registry/bootstrap | Agent-native delivery
```

### 3. Design goals and non-goals

Use Clark style: ranked goals and consequences.

Goals:

1. Freshness for known sources.
2. Publisher-controlled metadata and attribution.
3. Endpoint-controlled memory/attention policy.
4. Compatibility with existing web infrastructure.
5. Low publisher burden.
6. Optional payment, no default spending.
7. Decentralised discovery/registry.

Non-goals:

- Open-world discovery.
- Universal semantic ontology.
- Replacing APIs or MCP.
- Guaranteeing legal validity of rights claims.
- Central registry authority.

### 4. System model

Define actors:

```text
Publisher P
Feed F
Resource server R_s
Registry G
Agent A
User U
Memory store M
Payment rail X
```

Define assumptions:

- Feeds are untrusted content.
- Agent has local policy.
- Registry can be stale or malicious.
- Publisher can be honest, stale, noisy, hostile, or paid.
- Network fetches fail.
- Payment is opt-in.

Define trust boundaries:

```text
External content cannot instruct the agent.
Registry can suggest, not authorise spend.
Publisher can declare rights, not force attention.
Agent/user policy is authoritative locally.
```

### 5. Protocol objects

Normative-looking, with JSON examples.

Objects:

- ARSS feed profile.
- Item.
- Context resource.
- Subscription manifest.
- Context diet.
- Registry feed entry.
- Category bundle.
- Receipts.

Each object should have:

```text
Purpose
Required fields
Optional fields
Example
Invariants
```

### 6. Protocol flows

Use diagrams and pseudocode.

Flows:

1. Discovery:

```text
/.well-known/arss.json → feed_url/resources/rights
fallback to RSS/Atom/JSON Feed
registry lookup
```

2. Subscribe:

```text
user/agent imports feed or category
agent writes local diet
no payment budget granted by registry
```

3. Heartbeat:

```text
fetch feeds
normalise items
dedupe by stable id/hash
evaluate rights
score relevance
append archive/memory
select inbox
write receipts
```

4. Answer:

```text
search current inbox
search memory
fetch subscribed source live on miss
open web search only outside subscription boundary
cite source + rights snapshot
```

5. Optional paid fetch:

```text
resource declares price
agent checks budget/relevance/user policy
fetch via x402
store payment receipt
cache under rights policy
```

### 7. Safety, rights and security

Research-paper threat model.

Threats:

- prompt injection in feed content;
- malicious registry entries;
- payment draining;
- attribution stripping;
- stale/poisoned feed items;
- attention spam;
- private-interest leakage through subscriptions.

Mitigations:

- external content is data only;
- signed publisher claims later;
- local allowlists/budgets;
- no public-manifest spend;
- per-source caps;
- receipts/audit log;
- private registries and proxy fetches.

### 8. Implementation

Keep concise and factual.

Current implementation:

- Node CLI.
- Registry generator and hosted registry.
- 40-feed registry, 8 bundles.
- Health checker, 40/40 OK at last run.
- Heartbeat, inbox, ask loop.
- Local memory JSONL.
- MCP server.
- x402 demo rails.

Do not over-sell. Say prototype.

### 9. Evaluation

Make this the biggest upgrade.

Research questions:

```text
RQ1: For known sources, how much does ARSS reduce answer-time retrieval cost versus live polling/search?
RQ2: How much recall is retained by memory-only and inbox-only modes?
RQ3: Does live subscribed fallback recover recall while reducing cost versus polling all sources every turn?
RQ4: What noise does the inbox inject under different thresholds?
RQ5: Are rights/payment policies preserved in generated citations and receipts?
```

Metrics:

```text
recall on subscribed domains
latency
token-ish input bytes/chars
new-item detection delay
inbox precision/noise
citation accuracy
payment-policy violations
source health
```

Baselines:

- model only;
- live web search;
- live feed polling;
- crawler+RAG;
- MCP-on-demand;
- ARSS memory;
- ARSS inbox;
- ARSS memory + live subscribed fallback.

Report current numbers as preliminary, clearly labelled.

### 10. Discussion and limitations

Be honest:

- Current evals are small.
- Registry is curated and not adversarial.
- Rights semantics are declarative, not legal guarantees.
- Relevance scoring is simple.
- Payment demo is not production commerce.
- Private/authenticated feeds need more work.
- Hosted registry is centralised for now.

### 11. Conclusion

Short. No hype.

End with the crisp primitive:

```text
RSS lets humans subscribe to updates.
ARSS lets agents subscribe to rights-aware context.
```

## 4. Updated paper design decisions

### 4.1 Reframe the title

Current title says “subscribed web”, which is good but broad. Use:

```text
ARSS: Agent-Readable Syndication for Subscribed Context
```

This puts the technical object first: subscribed context.

### 4.2 Replace manifesto sections with formal sections

Remove/soften phrases like:

- “not another feed format”
- “that is the primitive”
- “grim fate” style language
- “tool calls vs bloodstream” metaphors

Keep one memorable sentence at the end, not throughout.

### 4.3 Put “free-first” in design goals, not abstract drama

The paper should not sound like it is apologising for payment. State:

```text
Payment is modelled as an optional property of resources. Registry manifests do not grant spend authority.
```

### 4.4 Make the diagrams more protocol-like

Current architecture diagram is fine for a blog. Need two formal diagrams:

1. Component diagram.
2. State/flow diagram for heartbeat and answer path.

### 4.5 Add pseudocode

At minimum:

```text
Algorithm 1: HeartbeatSync(D, S_t)
Algorithm 2: ResolveWithSubscribedContext(q, M, I, D)
Algorithm 3: PayAndFetch(r, B, P)
```

### 4.6 Add invariants

Examples:

```text
I1. A registry entry MUST NOT create local spend authority.
I2. Paid resources MUST NOT be fetched unless local budget policy permits.
I3. External feed content MUST NOT be interpreted as agent instructions.
I4. Cached records SHOULD retain source URL, publisher and rights snapshot.
I5. Inbox selection MUST be lossy; archive retention MUST be policy-bound.
```

### 4.7 Separate spec from paper

The paper should motivate and evaluate. Normative details belong in `spec-v0.2.md` / future `spec-v0.3.md`.

Paper references the spec, but does not drown in field lists.

## 5. Concrete rewrite plan

### Pass 1 — skeleton rewrite

Create:

```text
docs/arss/arss-research-paper.md
```

Sections:

1. Abstract
2. Introduction
3. Background and Related Work
4. Design Goals
5. System Model
6. Protocol Design
7. Security and Rights Model
8. Implementation
9. Evaluation
10. Discussion
11. Conclusion

### Pass 2 — insert protocol formality

Add:

- notation table;
- object definitions;
- algorithms;
- invariants;
- sequence diagrams.

### Pass 3 — strengthen related work

Cite:

- Clark 1988, Internet design philosophy.
- Saltzer/Reed/Clark 1984, end-to-end arguments.
- RSS/Atom/JSON Feed.
- WebSub.
- ActivityPub.
- AT Protocol/Bluesky paper.
- MCP.
- `llms.txt`.
- x402.
- RAG/crawling literature where needed.

### Pass 4 — evaluation polish

Add tables from current harnesses:

- reference eval;
- live eval;
- feed health;
- demo command transcript.

Also add methodology caveats.

### Pass 5 — PDF polish

Render with a proper academic template, not Chrome print.

Options:

- ACM-ish two-column if submission-shaped;
- single-column arXiv-style if public preprint;
- include references and appendix.

Recommendation: single-column preprint first. Easier to read, less cosplay.

## 6. Proposed final abstract draft

> Long-running agents increasingly rely on web search, browser automation, tool calls, and local retrieval systems to acquire external context. These mechanisms are effective for open-world discovery and action, but they do not provide a standard way for an agent to maintain fresh, rights-aware awareness of sources it already knows it cares about. Existing feed formats expose publisher updates for human readers, while tool protocols such as MCP expose query-time capabilities, and retrieval-augmented generation systems search over content after it has already been acquired. This paper introduces ARSS, Agent-Readable Syndication, a protocol layer for subscribed context delivery to agents. ARSS defines a feed profile, context resources, subscription manifests, context diets, registry bundles, heartbeat synchronisation, and optional paid resource access. The design separates publication, discovery, memory admission, attention selection, and payment authority, preserving publisher attribution while leaving relevance and spending decisions to the user’s agent. We describe a prototype implementation including a CLI, daemon, MCP server, static registry, category bundles, health checker, and local memory/inbox store. Preliminary live-feed evaluation over 20 subscribed sources shows the trade-off between live polling, local memory, current-inbox injection, and memory-plus-live-fallback retrieval. ARSS complements search, MCP and RAG by standardising the between-turn acquisition path for sources an agent follows repeatedly.

## 7. Proposed one-paragraph contribution claim

> ARSS contributes a subscription/delivery plane for agent context. Unlike RSS, it carries rights, resources, memory and payment metadata. Unlike MCP, it is proactive rather than query-time. Unlike crawler-based RAG, it is publisher-declared and continuously refreshed. Unlike web search, it is scoped to sources the agent already follows. The protocol’s main design choice is to keep acquisition broad, memory policy local, and attention narrow.

## 8. Immediate next action

Write `docs/arss/arss-research-paper.md` from this plan, then regenerate PDF.

Do not edit the existing canonical essay in place. Keep it as the public explainer; create the research-paper version separately.
