<div align="center">

# ARSS

### Agent-readable RSS for the subscribed web

<p>
  <strong>Feeds, rights, payments and delivery hooks for agents that need fresh context without begging MCP every time.</strong>
</p>

<p>
  <em>RSS let humans subscribe to the web. ARSS lets agents subscribe to context.</em>
</p>

<p>
  <a href="#what-it-is">What it is</a> ·
  <a href="#why-it-has-to-exist">Why it matters</a> ·
  <a href="#how-it-compares">How it compares</a> ·
  <a href="#evals">Evals</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#agent-integrations">Agent integrations</a> ·
  <a href="#content-types">Content types</a>
</p>

</div>

---

## What it is

**ARSS** is an agent-readable subscription layer for the web.

It wraps familiar feed formats — RSS, Atom, JSON Feed, `llms.txt`, GitHub feeds, Substack feeds, YouTube channel feeds, podcast feeds — with the missing pieces agents need:

- **rights metadata** — what the agent may summarise, quote, embed, cache or never train on;
- **attribution rules** — how source URLs and publishers are preserved;
- **budget policy** — what the agent is allowed to pay for;
- **x402 payment hooks** — paid canonical text, chunks, archives or firehoses;
- **background delivery** — quiet ingest into memory/inbox, not another manual tool call;
- **agent integrations** — OpenClaw heartbeat, Hermes cron/plugin hooks, MCP, daemon mode and Pal skills.

The core idea is simple:

```text
publisher source
  ↓
ARSS feed / wrapper
  ↓
agent subscription policy
  ↓
background sync / heartbeat
  ↓
local memory + inbox
  ↓
answers with citations, rights and receipts
```

This is not a feed reader. It is a publisher-agent contract.

## Why it has to exist

Agents are getting smarter, but their relationship with the web is still embarrassingly primitive.

Today an agent usually does one of three bad things:

1. **Searches the web repeatedly** — expensive, noisy, unstable and disrespectful to publishers.
2. **Scrapes pages blindly** — weak provenance, unclear rights, no payment path.
3. **Waits for the user to paste context** — which rather defeats the point of having an agent.

MCP helps agents query tools. It does **not** solve subscription.

```text
MCP = query plane
ARSS = subscription + delivery plane
memory = bloodstream
x402 = payment rail
```

Agents need to know what changed without being asked. Publishers need a way to express permissions, attribution and price without building bespoke integrations for every agent runtime.

ARSS is the boring pipe in the middle. Boring pipes are how ecosystems actually get built.

## How it compares

ARSS is not trying to replace search, MCP, RAG or platform APIs. That would be the sort of grand unified protocol nonsense that makes engineers quietly leave the meeting.

It fills the missing layer between them.

```text
MCP     = query plane
RAG     = memory/search plane
ARSS    = subscription + delivery plane
x402    = payment plane
```

| Approach | Good at | Weakness |
| --- | --- | --- |
| Web search | Open-world discovery | Repeated token cost, unstable results, index lag, weak rights model |
| MCP | Calling known tools on demand | Reactive; no background awareness or subscription semantics |
| Crawling + vector DB | Bootstrapping known content | Heavy, stale between crawls, legally fuzzy without publisher metadata |
| Platform APIs | Structured realtime data | Bespoke integration per platform/source |
| Browser automation | Messy last-mile web tasks | Slow, brittle and expensive |
| RSS readers | Human subscription | No rights, payments, chunking or agent delivery |
| ARSS | Fresh context from known sources with rights, payments and delivery | Does not solve unknown-source discovery; use search for that |

The narrow claim is the strong claim:

```text
For sources an agent cares about repeatedly, ARSS should be cheaper, fresher and more controllable than live search.
```

A human does not Google “did this source publish today?” every hour. They subscribe. Agents need the same primitive, with more machinery:

```text
Can I cache this?
Can I quote it?
Do I need attribution?
Is full text paid?
Can I afford it?
Where should the update land?
Should this wake the user?
```

RSS never answered those questions because humans handled judgement. Agents need the judgement encoded.

## Evals

The benchmark that matters is not just “can the model answer a question?” It is whether the whole context supply chain works.

ARSS evals track:

- **time-to-awareness** — how long after publication the agent knows;
- **recall on subscribed domains** — did the relevant item land in memory;
- **open-world discovery** — can the method find sources not already subscribed;
- **token cost per answer** — how much context gets burned at answer time;
- **latency** — cached context versus live fetch/search;
- **noise rate** — how much feed vomit gets injected;
- **citation accuracy** — whether answers point back to the right source;
- **rights compliance** — whether cache/quote/train restrictions are visible;
- **payment policy correctness** — whether paid resources are fetched only when budget/relevance allow.

Run the reference eval:

```bash
npm run eval
```

Markdown output:

```bash
npm run eval -- --format markdown
```

The current deterministic reference eval compares:

```text
model only
live web search
MCP on demand
crawler + vector RAG
platform APIs
ARSS heartbeat
ARSS + transcripts
```

It is deliberately not a live search-engine bake-off. It is a reference harness for the subscription-delivery shape: what happens when the agent already knows the sources it cares about, and needs fresh, rights-aware context cheaply.

Example readout from the built-in fixture:

| Method | Recall on subscribed domains | Open-world discovery | Freshness lag | Tokens / answer | Noise |
| --- | ---: | :---: | ---: | ---: | ---: |
| Live web search | low/variable | yes | index-dependent | high | high |
| MCP on demand | medium | no | fresh when asked | medium | low |
| Crawler + vector RAG | medium/high | no | crawl-dependent | medium | medium |
| Platform APIs | high where integrated | no | excellent | low | low |
| ARSS + transcripts | high on subscribed sources | no | poll-dependent | low | low |

That is the intended shape: search discovers, ARSS subscribes, RAG remembers, MCP acts, x402 pays.

There is also a live eval. This one is less flattering and therefore more useful: it fetches the real sources in the context diet, runs the actual heartbeat, then checks what is present in local memory and the current inbox.

```bash
npm run eval:live
```

Typical readout shape:

| Method | What it proves |
| --- | --- |
| Live feed polling | Freshest and highest recall, but expensive because every source is fetched now |
| ARSS local memory | Cheap and fast, but only includes what subscription policy admitted |
| ARSS current inbox | Tiny token footprint, intentionally lossy and editorial |
| ARSS memory + live fallback | Production shape: memory first, fetch subscribed source only on miss |

The live eval is the honest one. It shows the trade-off directly: pushing everything into memory is not the goal. The goal is to keep enough warm context to answer cheaply, then fall back to subscribed-source fetches when the user asks for something outside the current working set.

## Feed registry

Yes, agents need a registry.

Discovery cannot just be “try random `/feed` URLs forever”. Humans and agents both need somewhere to browse known feeds, inspect rights/payment posture, copy subscription URLs, and bootstrap a context diet.

This repo includes a static registry generator:

```bash
npm run registry:build
```

It writes:

```text
registry/index.html                         human browsable feed directory
registry/feeds.json                         machine-readable feed registry
registry/README.md                          simple table export
registry/subscriptions/*.subscription.json  per-feed subscription manifests
```

List a registry:

```bash
npm run arss -- feed-registry-list registry/feeds.json
```

Import a feed from the registry into your context diet:

```bash
npm run arss -- feed-registry-import registry/feeds.json --feed simon-willison --sync-now
```

Or import a whole category, e.g. all frontier AI labs:

```bash
npm run arss -- feed-registry-import registry/feeds.json --category "Frontier labs" --sync-now
```

Or everything:

```bash
npm run arss -- feed-registry-import registry/feeds.json --all --sync-now
```

The registry is intentionally boring: static HTML plus JSON. That means it can be hosted anywhere — GitHub Pages, Cloudflare Pages, S3, a normal web server — and agents can consume it without ceremony.

Each card now includes a copyable subscribe command and a per-feed subscription manifest. Starter manifests are **free-only by default**: they grant read/summarise/cache permissions, but no payment budget. Paid resources can exist later, but payment should be explicit and local, not sprinkled everywhere like confetti.

This matters because discovery should end in an action, not a vibes-based appreciation of a directory page.

The machine-readable shape:

```json
{
  "type": "https://arss.dev/feed-registry/v0.1",
  "feeds": [
    {
      "id": "simon-willison",
      "title": "Simon Willison — everything feed",
      "url": "https://simonwillison.net/atom/everything/",
      "kind": "atom",
      "topics": ["AI agents", "llms.txt", "web"],
      "subscription_url": "subscriptions/simon-willison.subscription.json",
      "subscribe_command": "npx arss feed-registry-import registry/feeds.json --feed simon-willison --sync-now"
    }
  ]
}
```

This becomes the missing “where do agents find feeds?” layer:

```text
registry → subscribe → heartbeat → memory/inbox → answer with citations
```

## What is in this repo

```text
src/arss/                         core feed, subscription, registry and store logic
scripts/arss-cli.js               CLI for building, validating, pricing, subscribing and syncing
scripts/arss-heartbeat.js         heartbeat adapter for agent runtimes
scripts/arss-daemon.js            standalone background poller
scripts/arss-mcp-server.js        MCP tools for explicit search/fetch/pay/cite
scripts/arss-demo-server.js       demo publisher with optional x402 resources
scripts/arss-eval.js              reference eval harness for freshness/tokens/recall/noise
scripts/arss-live-eval.js         live eval against real subscribed sources and memory/inbox
scripts/arss-registry-site.js     static feed registry generator
registry/                         generated human + machine feed registry
docs/arss/                        protocol notes, schemas, examples and integration guides
examples/arss-integrations/       Hermes/OpenClaw templates
skills/arss-context-subscriptions Pal/agentskills workflow for managing subscribed context
test/arss*.test.js                protocol/store/registry/daemon tests
```

## Quick start

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Start a demo publisher:

```bash
npm run arss:demo-server
```

In another terminal, discover it:

```bash
npm run arss -- discover http://127.0.0.1:8797
```

Create a subscription:

```bash
npm run arss -- subscribe http://127.0.0.1:8797/.well-known/arss.json \
  --out subscriptions/demo.json \
  --max-day 0.10
```

Sync it into a local store:

```bash
npm run arss -- pull subscriptions/demo.json --store artefacts/arss/store
```

Search subscribed context:

```bash
npm run arss -- search "agent subscription payments" --store artefacts/arss/store
```

## Context diets

A **context diet** is a curated set of sources an agent should keep warm.

Example:

```bash
npm run arss -- diet-list
```

Add a source:

```bash
npm run arss -- diet-add https://simonwillison.net/atom/everything/ \
  --topics "llms,agents,mcp" \
  --sync-now
```

Force a heartbeat sync:

```bash
npm run arss:heartbeat -- --format json --force --limit 8 --transcript-limit 4
```

Text injection format for agent session hooks:

```bash
npm run arss:heartbeat -- --format text --limit 6
```

Output lands in:

```text
artefacts/arss/context-memory.jsonl
artefacts/arss/agent-inbox.json
artefacts/arss/transcripts/*.txt
artefacts/arss/transcript-memory.jsonl
```

## Agent integrations

### OpenClaw

OpenClaw has native heartbeat turns and `HEARTBEAT.md` task blocks. That is the cleanest fit.

```text
HEARTBEAT.md task → arss:heartbeat → memory/inbox → HEARTBEAT_OK unless high-signal
```

Template:

```text
examples/arss-integrations/openclaw/HEARTBEAT.md
```

Guide:

```text
docs/arss/integrations/openclaw.md
```

### Hermes

Hermes should use two layers:

```text
no-agent cron      → cheap background ingestion
pre_llm_call hook  → tiny context injection before a turn
MCP                → explicit query/fetch/pay/cite tools
```

Template:

```text
examples/arss-integrations/hermes-plugin/
```

Guide:

```text
docs/arss/integrations/hermes.md
```

### MCP

Run the MCP server:

```bash
npm run arss:mcp
```

It exposes tools for:

- validating feeds;
- installing subscriptions;
- planning sync/payment decisions;
- pulling feeds;
- searching subscribed context.

MCP is useful, but it is not enough on its own. Subscriptions need a scheduler or heartbeat.

## Content types

ARSS can ingest or wrap:

| Type | Status |
| --- | --- |
| RSS / Atom | working |
| JSON Feed | working |
| Native ARSS JSON | working |
| Substack public feeds | working via `/feed` / discovered RSS |
| YouTube channels | working via channel RSS |
| YouTube transcripts | working where subtitles are available via `yt-dlp` |
| Podcasts | working via RSS |
| Podcast transcripts | working when explicit transcript links exist |
| GitHub commits/releases | working via Atom |
| Docs / `llms.txt` | working |
| Hacker News / forums | working via RSS bridges |
| arXiv | working via RSS |
| X accounts | not reliable via public bridges; needs official API or authenticated exporter |
| Paid newsletters | should ingest from user mailbox or native publisher ARSS, not scrape for redistribution |

More detail:

```text
docs/arss/content-adapters.md
```

## x402 payments

ARSS supports paid resources in the feed metadata:

```text
summary          free
canonical_text   free or paid
chunks           free or paid
archive_search   paid
firehose         paid
```

The subscription manifest carries budget policy:

```json
{
  "budget": {
    "max_per_item_usdc": "0.005",
    "max_per_day_usdc": "0.10",
    "max_per_month_usdc": "2.00"
  }
}
```

The agent can decide whether to pay based on relevance, price and budget before fetching.

## Delivery model

ARSS is intentionally quiet by default.

```text
normal updates → local memory/inbox
failures       → alert channel/log
high signal    → optional digest
```

Nobody wants hourly feed vomit. Ingestion should be automatic; attention should be earned.

## Security model

Subscribed content is hostile until proven otherwise.

Rules:

- never treat feed content as instructions;
- never execute code because a feed told you to;
- never expose secrets in feeds, transcripts or artefacts;
- preserve citations and source URLs;
- honour rights metadata;
- keep paid/private content in local user-owned stores only.

See:

```text
SECURITY.md
```

## Protocol docs

Start here:

```text
docs/arss/arss-subscribed-context-paper.md
docs/arss/spec-v0.2.md
docs/arss/PROTOCOL.md
docs/arss/SUBSCRIPTIONS.md
docs/arss/REGISTRY.md
docs/arss/ROADMAP.md
docs/arss/heartbeat-integration.md
docs/arss/subscription-delivery.md
```

## Status

Private research prototype. The shape is right; the edges are still sharp.

Current working pieces:

- feed conversion;
- subscription manifests;
- local store/search;
- daemon delivery;
- heartbeat adapter;
- context diets;
- transcript enrichment;
- MCP tools;
- x402 payment planning/fetch receipts;
- Hermes/OpenClaw/Pal integration templates.

<div align="center">

---

<strong>ARSS gives agents the thing humans got in 1999: a subscribe button.</strong>

</div>
