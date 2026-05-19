# ARSS heartbeat integration

Goal: automatic ingestion. Not “agent remembers to call a feed tool”.

Most agents already have some loop: heartbeat, cron, scheduler, task runner, session start hook, memory compaction pass, or background job. ARSS should piggyback on that.

## Mental model

```text
MCP = query plane
Daemon/heartbeat = delivery plane
Memory/index = bloodstream
```

An agent should use ARSS in two ways:

1. **Background ingestion** — heartbeat/daemon syncs subscriptions into memory before the user asks.
2. **Interactive retrieval** — MCP/CLI lets the model inspect, fetch, pay, cite on demand.

If you only ship MCP, you have not shipped subscription. You have shipped a nicer search box. Very enterprise. Very dead.

## Universal adapter

Any agent can run:

```bash
npm run arss:heartbeat -- --format text
```

It will:

1. check whether the context diet is due;
2. sync feeds if due;
3. write relevant items to `artefacts/arss/context-memory.jsonl`;
4. write a current inbox to `artefacts/arss/agent-inbox.json`;
5. return a small injection block the agent can add to its working context.

JSON mode:

```bash
npm run arss:heartbeat
```

Text mode for prompt injection into agents:

```bash
npm run arss:heartbeat -- --format text --limit 5
```

## Integration patterns

### Hermes / OpenClaw style autonomous agents

Add to heartbeat loop:

```bash
arss heartbeat --format json > .arss/inbox.json
```

Then ingest `.arss/inbox.json` into the agent's native memory store.

If the agent supports a “before reasoning” hook, inject the text form:

```bash
arss heartbeat --format text --min-interval-min 60
```

### Claude Desktop / MCP clients

Claude does not continuously run by itself. Use a companion process:

```bash
while true; do
  npm run arss:heartbeat -- --min-interval-min 60
  sleep 300
 done
```

Claude then queries via MCP when needed, but the inbox is already warm.

### Claude Code / Codex-style coding agents

Use session-start hook:

```bash
npm run arss:heartbeat -- --format text --limit 3
```

For long-running agents, call it at task boundaries or compaction checkpoints.

### Pal

Pal can run ARSS as a scheduled no-agent job or internal event. The output writes to local memory, and Pal retrieval reads `context-memory.jsonl`.

## Delivery options

### Poll

Best v0. Simple and robust.

```text
agent heartbeat → arss sync → memory
```

### Push

Later, for native publishers.

```text
publisher/WebSub hub → ARSS inbox endpoint → agent memory
```

### Relay

For agents without public callbacks.

```text
publisher → ARSS relay → local heartbeat pulls relay inbox
```

## Publisher claim flow

We bootstrap with wrappers, not committees.

```text
existing RSS/Atom feed
  ↓
ARSS wrapper
  ↓
agents subscribe
  ↓
publisher claims feed
  ↓
publisher adds canonical chunks + x402 prices + signatures
```

The claim layer can later become decentralised. Users should not see it.

## Coin layer rule

If there is a token, it must not sit in the user path.

```text
User sees: subscribe, budget, cite.
Publisher sees: claim feed, set prices, get paid.
Network sees: stake, curate, index, slash spam.
```

Content payment stays x402/USDC. Token secures registry/curation/discovery behind the curtain.
