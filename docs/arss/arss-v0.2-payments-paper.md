# ARSS-Pay: Agent-Native Syndication with First-Class HTTP Micropayments

\[
\textbf{Draft v0.2} \quad | \quad 18 May 2026 \quad | \quad Z. Ashraf and Pal
\]

## Abstract

RSS made it possible for humans to subscribe to publisher-controlled streams without joining a platform. The emerging agent web needs the same primitive, but agents do not merely read. They retrieve, summarise, cite, embed, store, refresh, and sometimes pay. Existing feed formats describe content items; they do not describe agent rights, context packaging, budgets, payment requirements, attribution obligations, or subscription capabilities.

We propose **ARSS-Pay**, a payments-first extension profile for Agent Really Simple Syndication (ARSS). ARSS-Pay treats payment as a first-class property of syndicated content rather than an afterthought bolted onto a paywall. Feeds remain openly discoverable, while individual resources — canonical markdown, chunk manifests, archives, high-frequency updates, embeddings, or commercial-use licences — may be priced via HTTP-native payment schemes such as x402.

The central claim is simple: if agents become the dominant readers of the web, publishers need an agent-readable subscription and monetisation protocol before platforms define one for them.

---

## 1. Introduction

RSS answered the question:

\[
\text{How does a human subscribe to updates from a publisher?}
\]

ARSS answers a different question:

\[
\text{How does an agent subscribe to context from a publisher under explicit rights, prices, and freshness constraints?}
\]

This distinction matters. A human reader can interpret a page, infer whether it is worth paying for, remember relevant details, and cite it informally. An agent requires machine-readable instructions:

- May I ingest this item?
- May I store it in long-term memory?
- May I summarise it to my user?
- Is attribution required?
- Is the full canonical text free or paid?
- What is the maximum price?
- Which payment rail is supported?
- What changed since my last sync?
- When does this context expire?

ARSS-Pay makes those questions part of the feed itself.

---

## 2. Design Thesis

\[
\boxed{\text{ARSS is not a feed reader. ARSS is a publisher-agent contract.}}
\]

A publisher exposes:

1. a feed of agent-ingestable items;
2. rights and attribution rules;
3. free and paid context resources;
4. payment requirements;
5. signatures and provenance;
6. expiry and update semantics.

An agent consumes:

1. feed metadata;
2. only content allowed by policy;
3. paid resources when user budget permits;
4. citations and receipts;
5. local memory updates.

The protocol is deliberately layered:

\[
\begin{array}{lll}
\textbf{Layer} & \textbf{Role} & \textbf{Implementation} \\
\hline
\text{Feed} & \text{Publisher-owned content stream} & \text{RSS/Atom/JSON Feed profile} \\
\text{Rights} & \text{Agent usage constraints} & \text{ARSS vocabulary} \\
\text{Payments} & \text{Per-resource or subscription monetisation} & \text{x402 / HTTP 402} \\
\text{Access} & \text{Long-lived subscription capabilities} & \text{Signed tokens / account / wallet auth} \\
\text{Consumption} & \text{Agent interface} & \text{MCP server + CLI + skills} \\
\text{Trust} & \text{Discovery, curation, reputation} & \text{Optional registry/token layer}
\end{array}
\]

---

## 3. System Architecture

```text
                         ┌─────────────────────────────┐
                         │        Publisher Site        │
                         │                             │
                         │  /.well-known/arss.json     │
                         │  /arss.xml                  │
                         │  /arss/items/123.md         │
                         │  /arss/chunks/123.jsonl     │
                         └──────────────┬──────────────┘
                                        │
                          free feed     │     paid resources
                          discovery     │     via x402 / caps
                                        ▼
┌──────────────┐      ┌──────────────────────────────┐      ┌──────────────┐
│ Human User   │─────▶│        User's Agent           │─────▶│ x402 Wallet  │
│              │      │                              │      │ / Facilitator │
│ interests,   │      │ ARSS MCP Server              │      └──────┬───────┘
│ budget,      │      │ - discover                   │             │
│ policies     │      │ - subscribe                  │             │ payment
└──────────────┘      │ - sync                       │             │ proof
                      │ - pay_and_fetch              │             │
                      │ - cite                       │◀────────────┘
                      └──────────────┬───────────────┘
                                     │
                                     ▼
                         ┌──────────────────────┐
                         │ Agent Memory / Index │
                         │ - source hashes      │
                         │ - rights metadata    │
                         │ - citations          │
                         │ - payment receipts   │
                         └──────────────────────┘
```

The feed is open by default. Payment attaches to resources, not discovery. This avoids recreating closed platform silos while still letting publishers monetise high-value context.

---

## 4. Core Objects

### 4.1 Feed

Let a feed be:

\[
F = (u, P, I, R, S)
\]

where:

- \(u\) is the feed URL;
- \(P\) is publisher metadata;
- \(I = \{i_1, ..., i_n\}\) is the item set;
- \(R\) is the default rights policy;
- \(S\) is optional signature/provenance metadata.

### 4.2 Item

An item is:

\[
i = (id, url, t, C, R_i, A_i, M_i)
\]

where:

- \(id\) is stable item identity;
- \(url\) is the human canonical page;
- \(t\) is publication/update time;
- \(C\) is context resources;
- \(R_i\) is item-specific rights;
- \(A_i\) is attribution requirement;
- \(M_i\) is monetisation metadata.

### 4.3 Context Resource

A context resource is anything the agent may retrieve:

\[
c = (kind, url, hash, format, access, price)
\]

Examples:

- `summary`
- `canonical_text`
- `chunk_manifest`
- `embedding_pack`
- `archive_page`
- `high_frequency_update`
- `commercial_licence`

### 4.4 Subscription

An ARSS subscription is not merely “poll this URL”. It is a policy-bound authorisation:

\[
Sub = (F, user, agent, scope, budget, sync, credentials, receipts)
\]

It says:

> This agent may keep this feed in this user's context diet, under these rights and spending limits.

---

## 5. Subscription Modes

ARSS-Pay defines four subscription modes.

### 5.1 Mode A: Free Polling

The RSS-native baseline.

```text
Agent → Publisher: GET /arss.json
Publisher → Agent: 200 OK, ETag: "abc"
Agent → Publisher: GET /arss.json, If-None-Match: "abc"
Publisher → Agent: 304 Not Modified
```

Use case: public blogs, docs, changelogs, open newsletters.

### 5.2 Mode B: Free Feed, Paid Item

The feed is public; premium resources are paid.

```text
Agent syncs feed
  ↓
Sees item with paid canonical_text
  ↓
Checks local budget and user policy
  ↓
Requests resource
  ↓
Receives 402 Payment Required
  ↓
Pays via x402
  ↓
Retries with payment proof
  ↓
Receives markdown/chunks
  ↓
Stores source hash + payment receipt
```

This is the default ARSS-Pay pattern.

### 5.3 Mode C: Capability Subscription

For ongoing access, the user or agent purchases a time-bounded capability.

```json
{
  "type": "https://arss.dev/capability/v0.2",
  "issuer": "did:web:publisher.com",
  "subscriber": "did:pkh:eip155:8453:0xabc...",
  "agent": "did:web:pal.example",
  "feed_url": "https://publisher.com/arss.json",
  "scope": ["read", "summarise", "embed_for_user_memory"],
  "commercial_use": false,
  "expires": "2026-06-18T00:00:00Z",
  "rate_limit": {
    "items_per_month": 1000,
    "premium_fetches_per_month": 200
  },
  "attribution_required": true,
  "signature": "..."
}
```

The agent includes it:

```text
Authorization: ARSS-Capability eyJ...
```

This is the subscription model for paid research, newsletters, databases, and live feeds.

### 5.4 Mode D: Budgeted Autopay

The user grants an agent a bounded budget.

```json
{
  "feed_url": "https://researcher.com/arss.json",
  "budget": {
    "max_per_item_usdc": "0.005",
    "max_per_day_usdc": "0.10",
    "max_per_month_usdc": "2.00"
  },
  "payment": {
    "protocol": "x402",
    "network": "eip155:8453",
    "asset": "USDC"
  }
}
```

This is the most agent-native mode:

> “Follow this source. Spend up to 10 cents a day if something is relevant.”

---

## 6. x402 as a First-Class ARSS Primitive

x402 revives HTTP `402 Payment Required` for programmatic stablecoin payments. In ARSS-Pay, x402 is not a plugin. It is the reference payment rail.

### 6.1 x402 Resource Flow

```text
┌───────┐                         ┌───────────┐                    ┌─────────────┐
│ Agent │                         │ Publisher │                    │ Facilitator │
└───┬───┘                         └─────┬─────┘                    └──────┬──────┘
    │ GET /arss/items/123.md             │                                 │
    │───────────────────────────────────▶│                                 │
    │                                    │                                 │
    │ 402 Payment Required               │                                 │
    │ PAYMENT-REQUIRED: {amount,...}     │                                 │
    │◀───────────────────────────────────│                                 │
    │                                    │                                 │
    │ construct payment signature        │                                 │
    │─────────────────────────────────────────────────────────────────────▶│
    │                                    │             verify/settle        │
    │                                    │◀────────────────────────────────│
    │ GET /arss/items/123.md             │                                 │
    │ PAYMENT-SIGNATURE: ...             │                                 │
    │───────────────────────────────────▶│                                 │
    │                                    │                                 │
    │ 200 OK markdown                    │                                 │
    │ X-ARSS-Payment-Receipt: ...        │                                 │
    │◀───────────────────────────────────│                                 │
```

### 6.2 Feed-Level Payment Declaration

```json
{
  "_agent": {
    "payment": {
      "preferred_protocol": "x402",
      "accepted": [
        {
          "protocol": "x402",
          "network": "eip155:8453",
          "asset": "USDC",
          "recipient": "0xPublisherWallet",
          "facilitator": "https://facilitator.example"
        }
      ]
    }
  }
}
```

### 6.3 Item-Level Price Declaration

```json
{
  "id": "https://publisher.com/post/123",
  "title": "Private markets update",
  "_agent": {
    "resources": [
      {
        "kind": "summary",
        "url": "https://publisher.com/arss/123.summary.md",
        "access": "free"
      },
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
      },
      {
        "kind": "chunks",
        "url": "https://publisher.com/arss/123.chunks.jsonl",
        "access": "paid",
        "price": {
          "protocol": "x402",
          "network": "eip155:8453",
          "asset": "USDC",
          "amount": "0.003"
        }
      }
    ]
  }
}
```

### 6.4 Payment Receipt

Agents should store receipts alongside ingested context.

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
  "payer": "did:pkh:eip155:8453:0xabc...",
  "recipient": "0xPublisherWallet",
  "tx_hash": "0x...",
  "resource_hash": "sha256:...",
  "rights_snapshot_hash": "sha256:...",
  "paid_at": "2026-05-18T15:31:00Z"
}
```

This gives the agent a durable answer to:

> Why do I have this content, what did I pay, and what am I allowed to do with it?

---

## 7. The ARSS Runtime Stack

ARSS should ship as three implementation surfaces, each with a separate job.

```text
┌─────────────────────────────────────────────────────────┐
│                    ARSS Protocol                         │
│ RSS namespace · Atom extension · JSON Feed profile       │
└────────────────────────┬────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌────────────────┐
│ Publisher CLI │  │  MCP Server  │  │ Agent Skill     │
│              │  │              │  │                │
│ arss init    │  │ discover     │  │ subscribe flow │
│ arss build   │  │ subscribe    │  │ scheduled sync │
│ arss sign    │  │ sync         │  │ memory ingest  │
│ arss price   │  │ pay_fetch    │  │ citations      │
│ arss validate│  │ search       │  │ budget policy  │
└──────────────┘  └──────────────┘  └────────────────┘
```

### 7.1 CLI

For publishers and developers:

```bash
arss init
arss convert-rss https://publisher.com/rss.xml
arss build ./content --out ./public/arss.json
arss price ./public/arss.json --chunks 0.003 --canonical 0.001 --network base
arss sign ./public/arss.json --key did:web:publisher.com#feed
arss validate ./public/arss.json
arss serve --x402
```

### 7.2 MCP Server

For agents:

```text
arss.discover(url) -> FeedDiscovery
arss.subscribe(feed_url, policy) -> Subscription
arss.sync(subscription_id) -> SyncResult
arss.fetch(item_id, resource_kind) -> Resource
arss.pay_and_fetch(item_id, resource_kind, budget) -> PaidResource
arss.search(subscription_id, query) -> SourceMatches
arss.citations(answer_id) -> CitationSet
```

### 7.3 Agent Skill

For Pal and similar agents:

```text
When user says “follow this source”:
1. Discover RSS/Atom/JSON Feed/ARSS/llms.txt.
2. Prefer ARSS if available.
3. Create local subscription manifest.
4. Ask once for budget/policy if paid resources exist.
5. Schedule sync.
6. Ingest summaries/free content immediately.
7. Pay for premium context only when relevance exceeds threshold.
8. Preserve citation/payment/rights receipts.
```

---

## 8. Subscription State Machine

```text
             ┌─────────────┐
             │ Discovered  │
             └──────┬──────┘
                    │ user/agent accepts
                    ▼
             ┌─────────────┐
             │ Subscribed  │
             └──────┬──────┘
                    │ sync interval / push
                    ▼
             ┌─────────────┐
             │  Syncing    │
             └──────┬──────┘
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
   ┌─────────────┐       ┌─────────────┐
   │ Free Ingest │       │ Paid Needed │
   └──────┬──────┘       └──────┬──────┘
          │                     │ check budget
          │                     ▼
          │              ┌─────────────┐
          │              │ Pay via x402│
          │              └──────┬──────┘
          │                     │
          └─────────┬───────────┘
                    ▼
             ┌─────────────┐
             │ In Memory   │
             └──────┬──────┘
                    │ expiry/revocation
                    ▼
             ┌─────────────┐
             │ Stale/Prune │
             └─────────────┘
```

---

## 9. Relevance-Gated Spending

Agents should not blindly pay for every premium item. ARSS-Pay should define budget policy hooks.

Let:

\[
r(i, U) \in [0,1]
\]

be item relevance to user interests \(U\), and:

\[
p(i) \in \mathbb{R}^{+}
\]

be item price.

The agent pays if:

\[
r(i, U) \geq \tau \quad \land \quad p(i) \leq b_{item} \quad \land \quad spend_{period} + p(i) \leq b_{period}
\]

In English:

> Pay only if relevant enough, cheap enough, and still inside the user's budget.

Policy example:

```json
{
  "interest_profile": ["agent standards", "x402", "TEE", "crypto markets"],
  "thresholds": {
    "pay_relevance_min": 0.74,
    "store_relevance_min": 0.55
  },
  "budget": {
    "max_per_item_usdc": "0.005",
    "max_per_day_usdc": "0.10",
    "max_per_month_usdc": "2.00"
  }
}
```

This is the missing primitive. Humans subscribe to publications. Agents subscribe to *context diets with spending policies*.

---

## 10. Publisher Economics

ARSS-Pay creates a gradient instead of a wall:

```text
Free discovery      → title, summary, topics, rights
Free lightweight    → publisher-written agent summary
Paid canonical      → clean markdown full text
Paid chunks         → retrieval-optimised JSONL chunks
Paid archive        → old items and deep research
Paid commercial     → broader usage rights
Paid high-frequency → live updates / low-latency feeds
```

This is better than classic paywalls because agents can make small, relevance-gated purchases.

A user does not need to buy a $30/month subscription to one source just because one item matters. The agent can spend $0.001 on the one item that crosses relevance threshold.

For publishers, this produces a new revenue stream:

\[
Revenue = \sum_{agents} \sum_{items} price(item) \cdot paid\_fetch(agent,item)
\]

And more importantly, it lets publishers define the canonical machine-readable version of their work instead of leaving agents to scrape HTML.

---

## 11. Registry and Token Layer

The base protocol does not require a token. However, ARSS creates a plausible token layer because discovery and trust become scarce.

Possible token-secured roles:

1. **Feed registrars** stake to list feeds.
2. **Indexers** earn for maintaining topic directories.
3. **Curators** stake on high-quality feeds.
4. **Watchers** detect spam, fake mirrors, licence lies, broken signatures.
5. **Agents** build compliance reputation by preserving attribution and respecting budgets.

The token does not buy content. x402/USDC does that.

The token secures:

\[
\text{attention} + \text{trust} + \text{curation} + \text{compliance}
\]

That is cleaner than a compute token and meaningfully different from Phala.

---

## 12. Minimal Viable Protocol

### 12.1 Publisher MVP

- `/.well-known/arss.json`
- JSON Feed 1.1 with `_agent` extension
- item-level resources
- x402 price declarations
- optional Ed25519 feed signature

### 12.2 Agent MVP

- local subscription manifest
- ETag polling
- relevance scoring
- budget-gated x402 payment
- memory ingestion with rights metadata
- citation generation

### 12.3 Developer MVP

```bash
npm install -g arss
arss convert-rss https://example.com/rss.xml --out arss.json
arss price arss.json --canonical 0.001 --chunks 0.003
arss validate arss.json
```

```bash
npx arss-mcp
```

```text
Pal, subscribe me to https://example.com/arss.json and spend up to 10c/day on relevant AI-agent posts.
```

---

## 13. Why This May Matter

Most AI-web proposals focus on crawler control, model training opt-outs, or site-level LLM documentation. Those are useful, but incomplete.

The deeper shift is that agents become subscribers.

They will maintain context over time. They will pay for premium context. They will cite, store, forget, and refresh. Publishers need a protocol that recognises this behaviour directly.

RSS did not win because it was technically glamorous. It won because it made subscription simple.

ARSS-Pay should be equally boring at the transport layer and radically useful at the agent layer.

---

## 14. Conclusion

ARSS-Pay proposes a feed protocol for the agent web where content, rights, attribution, freshness and payment travel together. It keeps feeds open, makes premium context purchasable by agents, and gives publishers a way to participate in agent-mediated consumption without surrendering everything to scraping or platforms.

The product is not a feed reader. The product is the missing contract between publishers and agents.

\[
\boxed{\text{Subscribe. Budget. Pay. Ingest. Cite. Remember.}}
\]

That is the loop ARSS should own.

---

## References

[1] RSS Advisory Board. *RSS 2.0 Specification*. https://www.rssboard.org/rss-specification

[2] Nottingham, M. and Sayre, R. *RFC 4287: The Atom Syndication Format*. https://www.rfc-editor.org/rfc/rfc4287

[3] Simmons, B. and Reece, M. *JSON Feed Version 1.1*. https://www.jsonfeed.org/version/1.1/

[4] Howard, J. et al. *llms.txt Proposal*. https://llmstxt.org/

[5] W3C. *WebSub Recommendation*. https://www.w3.org/TR/websub/

[6] Coinbase Developer Platform. *x402: HTTP-native stablecoin payments*. https://docs.cdp.coinbase.com/x402/welcome

[7] x402 Foundation. *Payment Required*. https://www.x402.org/

[8] Model Context Protocol. *Introduction*. https://modelcontextprotocol.io/introduction
