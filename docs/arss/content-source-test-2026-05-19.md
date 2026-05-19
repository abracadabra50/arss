# ARSS content-source coverage test — 2026-05-19

Added representative sources to Pal's `agent-web` context diet and forced a sync.

## Sources added

| Type | Source | URL | Status |
| --- | --- | --- | --- |
| Substack/newsletter | Platformer | `https://www.platformer.news/rss/` | subscribed |
| YouTube channel | Fireship | `https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA` | subscribed |
| Podcast | Lex Fridman Podcast | `https://lexfridman.com/feed/podcast/` | subscribed |
| JSON Feed | Daring Fireball | `https://daringfireball.net/feeds/json` | subscribed |
| Docs/llms.txt | OpenClaw docs | `https://docs.openclaw.ai/llms.txt` | subscribed |
| GitHub releases | MCP servers releases | `https://github.com/modelcontextprotocol/servers/releases.atom` | subscribed |
| Community/forum | Hacker News front page | `https://hnrss.org/frontpage` | subscribed |
| Academic papers | arXiv cs.AI RSS | `https://export.arxiv.org/rss/cs.AI` | subscribed |

Existing diet already covered:

- Atom blogs;
- RSS blogs;
- GitHub commit feeds;
- product/company blogs;
- protocol repos.

## Sync result

Forced sync after additions:

```text
sources: 16
new relevant items: 66
high-signal items: 22
errors: 0
```

Top items included:

- `AgentWall: A Runtime Safety Layer for Local AI Agents` — arXiv;
- `Sustainable Intelligence for the Wild... Edge Expert Agents` — arXiv;
- MCP server release notes;
- OpenClaw docs entries;
- Platformer/Fireship/Lex/HN items.

## Transcript enrichment test

Added transcript enrichment to `arss:heartbeat`.

Current adapters:

- YouTube videos: `yt-dlp` subtitle/VTT extraction.
- Podcast/newsletter items with explicit `Transcript:` links: HTML transcript fetch and text stripping.

Smoke result:

```text
Lex Fridman transcript pages cached: 10+
Fireship YouTube subtitles cached: 2
```

Transcript outputs:

```text
artefacts/arss/transcripts/*.txt
artefacts/arss/transcript-memory.jsonl
```

This is now baked into the Pal heartbeat path, not a separate manual step.

## X account test

Attempted public X bridge via Nitter RSS:

```text
https://nitter.net/OpenAI/rss
https://nitter.poast.org/OpenAI/rss
```

Result: unreliable under Node fetch / browser verification / empty response. Do not rely on Nitter bridges for ARSS production.

Next adapter for X should use:

```text
official X API watchlist → ARSS feed → context memory
```

or a user-authenticated local exporter. Treat X content as hostile/untrusted source material.

## Code changes made during test

- Added `llms.txt` parsing to `parseMaybeArss`.
- `diet-add` can now subscribe directly to docs `llms.txt` indexes.
- Platformer source tagged as `substack` for coverage even though it resolves to `/rss/`.
