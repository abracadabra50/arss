# ARSS Subscriptions: getting content into the agent automatically

MCP is pull-based: the agent has to ask. That is useful for retrieval, but it is not enough for the core goal:

> My agent should automatically ingest the sources I subscribe it to.

So ARSS has two layers:

```text
Background subscriber daemon  → keeps context fresh
MCP server                    → lets the agent query that context when working
```

The daemon is the vein. MCP is the hand.

## Runtime model

```text
Publisher feed
  ↓ poll/WebSub/SSE later
ARSS daemon
  ↓ validate + rights + budget + x402 plan
Local context store
  ↓ delivery adapters
Agent inbox / memory files / MCP / webhook / command hook
  ↓
Hermes / OpenClaw / Claude / Codex / Pal
```

## What runs in the background?

`arss-daemon` scans the local subscription store, pulls each feed, indexes fresh chunks, de-duplicates previously delivered chunks, and writes an agent inbox.

```bash
npm run arss:daemon -- --once
npm run arss:daemon -- --interval 900 --verbose
```

Outputs by default:

```text
artefacts/arss/inbox/
  events.jsonl        # machine-readable delivery events
  LATEST.md           # latest summary for agents/wrappers to inject
  <timestamp-feed>.md # human/agent digest
  <timestamp-feed>.jsonl # raw chunks with rights metadata
```

## How agents consume it

Different agent runtimes have different veins. ARSS should support all of them.

### 1. Pal / long-running agents

Run the daemon as a scheduled/background job. Pal can read `artefacts/arss/inbox/LATEST.md` or search via MCP. For important feeds, the daemon can emit a chat/event notification.

### 2. Hermes / OpenClaw

These agents can use an Agent Skill plus local files. Install ARSS, run the daemon, and tell the agent skill:

```text
Before answering, check artefacts/arss/inbox/LATEST.md and use arss_search for details.
```

The daemon keeps the inbox fresh even when the agent is idle.

### 3. Claude Code / Codex-style agents

They do not have true background context injection unless wrapped. The practical adapter is a repo-local file:

```text
.agents/arss/LATEST.md
.agents/arss/events.jsonl
```

A wrapper or project instruction tells the agent to read it at session start. This is not perfect, but it works today.

### 4. MCP clients

MCP remains the query interface:

- `arss_search` for retrieval;
- `arss_pull` for manual refresh;
- `arss_plan_sync` for paid resource decisions.

But the daemon means the index is already warm before the agent asks.

### 5. Future push adapters

The protocol can add delivery sinks:

```json
{
  "delivery": {
    "sinks": [
      { "type": "inbox_jsonl", "path": "artefacts/arss/inbox/events.jsonl" },
      { "type": "digest_md", "path": "artefacts/arss/inbox/LATEST.md" },
      { "type": "webhook", "url": "http://127.0.0.1:8787/arss" },
      { "type": "command", "argv": ["agent", "memory", "ingest"] }
    ]
  }
}
```

Do not require this in v0. Files are the portable substrate. Every agent can read files. Very glamorous. Very useful.

## Example: subscribe and auto-ingest

```bash
# Subscribe
npm run arss -- install https://arss.dev/feeds/agent-context/arss.json --agent-name Pal

# For this local repo demo, pull from local feed file once
npm run arss -- pull artefacts/arss/store/arss-dev-feeds-agent-context-arss-json/subscription.json \
  --feed docs/arss/feeds/agent-context/arss.json

# Run background delivery once
npm run arss:daemon -- --once --all

# Search warmed context
npm run arss -- search "publisher risk x402"
```

## Why not only MCP?

Because MCP is a tool surface, not a clock. It does not know when publishers update. It does not poll while the agent sleeps. It does not decide what to ingest before a user asks.

A subscription protocol needs a subscriber process. RSS had feed readers. ARSS has a daemon.

## North star

A user should be able to say:

```text
Subscribe my agent to these 20 sources.
```

Then tomorrow the agent should already know what changed, with citations, rights and payment receipts attached. No paste-link ritual. No search-at-query-time lottery.
