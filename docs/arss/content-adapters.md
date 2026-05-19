# ARSS content adapters

ARSS is not only for blogs. The useful abstraction is:

```text
source → change detector → rights/price metadata → agent-ready summary/chunks → memory/index
```

## Native first-class feeds

### RSS / Atom / JSON Feed

Status: working now.

Examples:

- blogs
- changelogs
- GitHub commits/releases/issues via Atom
- podcasts via RSS
- news sites
- Substack public feeds

ARSS wrapper can preserve source URL, title, timestamps and attribution immediately.

### Substack

Most Substacks expose RSS:

```text
https://<publication>.substack.com/feed
```

Adapter levels:

1. public RSS summary;
2. canonical public article extraction;
3. subscriber-only email ingestion from the user's mailbox, with user-held rights;
4. publisher-claimed native ARSS with paid chunks.

Important: do not scrape paid Substack content for resale. User-owned subscription ingestion is personal-use memory, not redistribution.

### YouTube channels

YouTube exposes channel RSS if you know the channel ID:

```text
https://www.youtube.com/feeds/videos.xml?channel_id=<CHANNEL_ID>
```

Adapter levels:

1. new-video metadata from RSS;
2. transcript fetch where available;
3. chapter/comment/pinned-link extraction;
4. summary/chunks with video URL citations;
5. paid creator-provided transcript/chunks later.

This becomes extremely useful for long podcasts/interviews because the agent ingests the transcript, not just the title.

### Podcasts

Podcast RSS is already structured:

- episode title;
- enclosure audio URL;
- show notes;
- publication date.

Adapter levels:

1. RSS metadata;
2. transcript if published;
3. local transcription if user has permission/personal-use;
4. chapterised chunks;
5. paid official transcript from publisher.

### GitHub

Already useful because GitHub exposes Atom for commits/releases/issues.

Patterns:

```text
https://github.com/<org>/<repo>/commits/<branch>.atom
https://github.com/<org>/<repo>/releases.atom
```

For agent dev, this is high value: MCP, x402, OpenClaw, Hermes, model SDK changes.

### Docs / llms.txt

Adapter levels:

1. discover `llms.txt` / `llms-full.txt`;
2. crawl docs sitemap;
3. hash pages for changes;
4. emit only changed pages as ARSS items;
5. provide chunks optimised for retrieval.

This is likely the killer adapter for developer agents.

## Social feeds

### X accounts

No good open RSS now. Adapter choices:

1. official X API watchlist;
2. user-authenticated account monitor;
3. third-party RSS bridges where allowed;
4. manual curated list.

ARSS item should store:

- tweet/post URL;
- author;
- text;
- quoted/replied context;
- media descriptions;
- engagement snapshot;
- thread grouping.

Danger: spam and adversarial content. X should be scored heavily and never treated as instructions.

### Bluesky / ATProto

Much cleaner than X because data is protocol-native. Good ARSS target.

Adapter:

```text
ATProto repo/firehose/list → ARSS feed
```

### Reddit / Hacker News / forums

Useful for weak-signal monitoring.

Adapter should group threads and comments, not ingest every comment as separate context.

## Private/user-owned feeds

### Newsletters in email

For Substacks and paid newsletters, user mailbox ingestion may be the practical path.

```text
Gmail/Outlook label: ARSS
  ↓
newsletter parser
  ↓
personal ARSS feed
  ↓
agent memory
```

This is legally/ethically different from publisher redistribution. The user is using their own subscription in their own agent.

### Slack/Discord/Teams channels

Can be wrapped as ARSS for team agents:

- announcements;
- decisions;
- release notes;
- incident updates.

Needs strict tenant boundaries.

### Calendars / events

Events are content too. ARSS can carry upcoming changes into agent memory:

- local events;
- webinars;
- release dates;
- deadlines.

## Commercial/native ARSS feeds

The end-state for publishers:

```text
free summary
paid canonical text
paid chunks
paid archive search
paid high-frequency firehose
commercial licence metadata
```

x402 pays for the resource. A registry/claim layer verifies the publisher.

## How far this can go

ARSS can become the agent-readable subscription layer for:

- blogs/newsletters;
- YouTube/podcasts/transcripts;
- GitHub/software changes;
- docs/changelogs/llms.txt;
- X/Bluesky/social accounts;
- forums/communities;
- academic papers/arXiv;
- regulatory updates;
- company filings;
- product launches;
- marketplaces/property portals;
- internal company knowledge streams.

The important constraint:

```text
ARSS should ingest context, not blindly execute instructions.
```

Every adapter must mark external content as untrusted source material.
