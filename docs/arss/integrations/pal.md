# ARSS + Pal integration

Pal's first ARSS integration is local and boring on purpose.

## Goal

```text
Zish says "subscribe me to this kind of context"
  ↓
Pal stores the source in a context diet
  ↓
A no-agent scheduled job syncs feeds hourly
  ↓
Relevant items land in local ARSS memory
  ↓
Pal checks that memory when answering related questions
```

## Current files

```text
docs/arss/context-diets/agent-web.json
artefacts/arss/context-memory.jsonl
artefacts/arss/context-diet-state.json
artefacts/arss/context-diet-summary.json
artefacts/arss/agent-inbox.json
```

## Current schedule

Event:

```text
<scheduler-events>/pal-arss-context-sync.json
```

Runs hourly at minute 17:

```bash
npm run --silent arss:heartbeat -- --format json --min-interval-min 60 --limit 8
```

This is no-agent. It does not burn tokens. It writes the memory/inbox artefacts. `arss:heartbeat` now also enriches recent media items with transcripts by default:

- YouTube: uses local `yt-dlp` to fetch human/auto VTT subtitles where available.
- Podcasts/newsletters with explicit `Transcript:` links: fetches the transcript page and strips it to text.

Transcript artefacts:

```text
artefacts/arss/transcripts/*.txt
artefacts/arss/transcript-memory.jsonl
```

## Current first diet

`agent-web` follows:

- Simon Willison;
- GitHub Changelog;
- MCP spec commits;
- x402 commits;
- ERC-8004 commits;
- JSON Feed commits;
- W3C WebSub commits;
- Cloudflare Blog.

## Add a source

Pal can add a source to the diet with:

```bash
npm run arss -- diet-add <url> --topics agents,payments --sync-now
```

Examples:

```bash
npm run arss -- diet-add https://simonwillison.net/atom/everything/ --topics ai-agents,llms
npm run arss -- diet-add https://some-publication.substack.com --topics strategy,ai
npm run arss -- diet-add https://www.youtube.com/@somechannel --topics ai,founders
```

List current sources:

```bash
npm run arss -- diet-list
```

Discovery currently handles:

- native ARSS JSON;
- RSS;
- Atom;
- JSON Feed;
- HTML `<link rel="alternate" ...>` feed discovery;
- Substack `/feed` convention;
- YouTube channel RSS when channel ID is discoverable.

## Next Pal-specific work

1. Add a small retrieval helper so Pal can search `context-memory.jsonl` by topic/relevance/date.
2. Add user commands:
   - `what did my feeds pick up?`;
   - `show high-signal ARSS items this week`;
   - `mute this source`;
   - `raise/lower threshold`.
3. Add deeper source adapters for paid Substack/newsletter mailbox ingestion, YouTube transcripts and X watchlists.
4. Add receipts for paid x402 fetches.
5. Add a compact daily digest only when high-signal items exist.

## Design rule

Pal should not spam Slack with every item. The ingestion path is quiet. The chat path is editorial.

```text
quiet ingest, sharp surfacing
```
