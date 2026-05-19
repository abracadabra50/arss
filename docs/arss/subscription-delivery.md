# ARSS subscription delivery

MCP is the query plane, not the delivery plane.

If an agent only sees ARSS through MCP, context enters only when the agent asks. That is useful for interactive retrieval but not enough for subscription. Real subscription needs a background delivery loop that keeps context warm before the user asks.

## Planes

```text
Discovery plane
  Find ARSS/RSS/Atom/JSON Feed/llms.txt sources.

Subscription plane
  Store user intent: feed, interests, permissions, budget, cadence.

Delivery plane
  Background sync/push writes relevant context into the agent's memory/index.

Query plane
  MCP tools let the agent inspect, search, cite and fetch on demand.

Payment plane
  x402 pays for gated resources when policy allows.

Claim/registry plane
  Publishers claim wrapped feeds, sign them, add paid resources, and later decentralised curation/reputation secures discovery.
```

## Why MCP alone is insufficient

MCP is pull-based from the model/client side:

```text
model wants info → calls tool → MCP server returns info
```

A subscription is push/poll-based from the source side:

```text
source changes → subscriber runtime notices → context enters memory/index → agent has it later
```

So ARSS needs both:

```text
MCP = hands
subscriber daemon = bloodstream
```

## Delivery modes

### 1. Local poller

Best first implementation.

```text
cron/systemd/Pal schedule → arss sync-diet → memory.jsonl/vector store/wiki
```

Pros: simple, private, decentralised enough for v0, no hosted dependency.

### 2. WebSub/webhook push

For publishers that support push.

```text
publisher → hub → subscriber callback → local ARSS inbox → memory/index
```

Pros: lower latency. Cons: needs reachable callback or relay.

### 3. Hosted relay / inbox

For agents that cannot expose a callback.

```text
publisher/hub → arss relay inbox → agent pulls inbox
```

Pros: works for consumer agents. Cons: introduces service trust.

### 4. Decentralised feed/index network

Later.

```text
indexers mirror feed metadata
publishers sign claims
curators stake attention
agents pull from many gateways
```

Pros: censorship-resistant discovery, no central ARSS directory. Cons: not v0.

## Publisher claim flow

Wrapped feeds come first. Publisher claims later.

```text
1. ARSS proxy wraps https://publisher.com/rss.xml
2. Agents subscribe and usage appears
3. Publisher proves domain control via /.well-known/arss-claim.json
4. Publisher gets claimed feed admin
5. Publisher adds canonical markdown/chunks/prices/signatures
6. Agents prefer claimed feed over wrapper
```

Claim file:

```json
{
  "type": "https://arss.dev/feed-claim/v0.1",
  "feed": "https://arss.dev/wrap?url=https://publisher.com/rss.xml",
  "canonical_arss": "https://publisher.com/.well-known/arss.json",
  "publisher": "did:web:publisher.com",
  "signed_at": "2026-05-19T09:00:00Z",
  "signature": "..."
}
```

## Coin layer, if any

Must be invisible to normal users and not used for content payment.

```text
x402/USDC = pays publishers for content
ARSS token = secures feed discovery, curation, claims and anti-spam
```

Token jobs:

- stake to operate indexers;
- stake to claim/verify feeds;
- slash fake mirrors and malicious metadata;
- reward useful curators/directories;
- reputation for compliant agents and honest publishers.

The user experience must remain:

```text
subscribe to this source, budget 10c/day
```

Not:

```text
bridge tokens, stake manually, join Discord, suffer
```

The chain layer should be boring plumbing under the registry.
