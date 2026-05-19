# ARSS Feed Registry

A starter directory of agent-readable feeds and feed-like sources.

Machine-readable registry: `feeds.json`. Per-feed manifests live in `subscriptions/*.subscription.json`.

| Feed | Kind | URL | Topics | Subscribe |
| --- | --- | --- | --- | --- |
| Simon Willison — everything feed | atom | https://simonwillison.net/atom/everything/ | AI agents, llms.txt, web, developer tooling | `npx arss feed-registry-import registry/feeds.json --feed simon-willison --sync-now` |
| GitHub Changelog | rss | https://github.blog/changelog/feed/ | developer tooling, AI agents, agent workflows | `npx arss feed-registry-import registry/feeds.json --feed github-changelog --sync-now` |
| Model Context Protocol specification commits | atom | https://github.com/modelcontextprotocol/modelcontextprotocol/commits/main.atom | MCP, agent protocols | `npx arss feed-registry-import registry/feeds.json --feed mcp-spec-commits --sync-now` |
| x402 repository commits | atom | https://github.com/coinbase/x402/commits/main.atom | x402, HTTP 402, agent payments | `npx arss feed-registry-import registry/feeds.json --feed x402-commits --sync-now` |
| ERC-8004 contracts commits | atom | https://github.com/erc-8004/erc-8004-contracts/commits/master.atom | ERC-8004, agent identity, agent reputation | `npx arss feed-registry-import registry/feeds.json --feed erc8004-contracts --sync-now` |
| JSON Feed spec updates | atom | https://github.com/brentsimmons/JSONFeed/commits/master.atom | feeds, JSON Feed, syndication | `npx arss feed-registry-import registry/feeds.json --feed json-feed --sync-now` |
| W3C WebSub commits | atom | https://github.com/w3c/websub/commits/master.atom | push subscription, WebSub, syndication | `npx arss feed-registry-import registry/feeds.json --feed w3c-websub --sync-now` |
| Cloudflare Blog | rss | https://blog.cloudflare.com/rss/ | AI agents, publisher infrastructure, web, internet payments | `npx arss feed-registry-import registry/feeds.json --feed cloudflare-blog --sync-now` |
| Platformer | substack | https://www.platformer.news/rss/ | substack, newsletter, platforms, ai, tech-policy | `npx arss feed-registry-import registry/feeds.json --feed platformer --sync-now` |
| Fireship | youtube | https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA | youtube, developer-tools, ai, software | `npx arss feed-registry-import registry/feeds.json --feed fireship --sync-now` |
| Lex Fridman Podcast | rss | https://lexfridman.com/feed/podcast/ | podcast, ai, research, founders | `npx arss feed-registry-import registry/feeds.json --feed lex-fridman-podcast --sync-now` |
| Daring Fireball | json-feed | https://daringfireball.net/feeds/json | json-feed, apple, web, technology | `npx arss feed-registry-import registry/feeds.json --feed daring-fireball --sync-now` |
| OpenClaw | llms.txt | https://docs.openclaw.ai/llms.txt | llms.txt, docs, openclaw, agents, heartbeat | `npx arss feed-registry-import registry/feeds.json --feed openclaw --sync-now` |
| Release notes from servers | atom | https://github.com/modelcontextprotocol/servers/releases.atom | github, releases, mcp, servers, agents | `npx arss feed-registry-import registry/feeds.json --feed release-notes-from-servers --sync-now` |
| Hacker News: Front Page | rss | https://hnrss.org/frontpage | hacker-news, community, startups, ai, software | `npx arss feed-registry-import registry/feeds.json --feed hacker-news-front-page --sync-now` |
| cs.AI updates on arXiv.org | rss | https://export.arxiv.org/rss/cs.AI | arxiv, papers, ai, research, agents | `npx arss feed-registry-import registry/feeds.json --feed cs-ai-updates-on-arxiv-org --sync-now` |
