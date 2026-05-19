# ARSS Feed Registry

A starter directory of agent-readable feeds and feed-like sources.

Machine-readable registry: `feeds.json`. Per-feed manifests live in `subscriptions/*.subscription.json`.

| Feed | Category | Kind | URL | Topics | Subscribe |
| --- | --- | --- | --- | --- | --- |
| Simon Willison — everything feed | Agent protocols | atom | https://simonwillison.net/atom/everything/ | AI agents, llms.txt, web, developer tooling | `npx arss feed-registry-import registry/feeds.json --feed simon-willison --sync-now` |
| GitHub Changelog | Developer tooling | rss | https://github.blog/changelog/feed/ | developer tooling, AI agents, agent workflows | `npx arss feed-registry-import registry/feeds.json --feed github-changelog --sync-now` |
| Model Context Protocol specification commits | Agent protocols | atom | https://github.com/modelcontextprotocol/modelcontextprotocol/commits/main.atom | MCP, agent protocols | `npx arss feed-registry-import registry/feeds.json --feed mcp-spec-commits --sync-now` |
| x402 repository commits | Payments | atom | https://github.com/coinbase/x402/commits/main.atom | x402, HTTP 402, agent payments | `npx arss feed-registry-import registry/feeds.json --feed x402-commits --sync-now` |
| ERC-8004 contracts commits | Agent protocols | atom | https://github.com/erc-8004/erc-8004-contracts/commits/master.atom | ERC-8004, agent identity, agent reputation | `npx arss feed-registry-import registry/feeds.json --feed erc8004-contracts --sync-now` |
| JSON Feed spec updates | Agent protocols | atom | https://github.com/brentsimmons/JSONFeed/commits/master.atom | feeds, JSON Feed, syndication | `npx arss feed-registry-import registry/feeds.json --feed json-feed --sync-now` |
| W3C WebSub commits | Agent protocols | atom | https://github.com/w3c/websub/commits/master.atom | push subscription, WebSub, syndication | `npx arss feed-registry-import registry/feeds.json --feed w3c-websub --sync-now` |
| Cloudflare Blog | Infrastructure | rss | https://blog.cloudflare.com/rss/ | AI agents, publisher infrastructure, web, internet payments | `npx arss feed-registry-import registry/feeds.json --feed cloudflare-blog --sync-now` |
| Platformer | Media | substack | https://www.platformer.news/rss/ | substack, newsletter, platforms, ai, tech-policy | `npx arss feed-registry-import registry/feeds.json --feed platformer --sync-now` |
| Fireship | Media | youtube | https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA | youtube, developer-tools, ai, software | `npx arss feed-registry-import registry/feeds.json --feed fireship --sync-now` |
| Lex Fridman Podcast | Research | rss | https://lexfridman.com/feed/podcast/ | podcast, ai, research, founders | `npx arss feed-registry-import registry/feeds.json --feed lex-fridman-podcast --sync-now` |
| Daring Fireball | Industry | json-feed | https://daringfireball.net/feeds/json | json-feed, apple, web, technology | `npx arss feed-registry-import registry/feeds.json --feed daring-fireball --sync-now` |
| OpenClaw | Agent protocols | llms.txt | https://docs.openclaw.ai/llms.txt | llms.txt, docs, openclaw, agents, heartbeat | `npx arss feed-registry-import registry/feeds.json --feed openclaw --sync-now` |
| Release notes from servers | Agent protocols | atom | https://github.com/modelcontextprotocol/servers/releases.atom | github, releases, mcp, servers, agents | `npx arss feed-registry-import registry/feeds.json --feed release-notes-from-servers --sync-now` |
| Hacker News: Front Page | Industry | rss | https://hnrss.org/frontpage | hacker-news, community, startups, ai, software | `npx arss feed-registry-import registry/feeds.json --feed hacker-news-front-page --sync-now` |
| cs.AI updates on arXiv.org | Research | rss | https://export.arxiv.org/rss/cs.AI | arxiv, papers, ai, research, agents | `npx arss feed-registry-import registry/feeds.json --feed cs-ai-updates-on-arxiv-org --sync-now` |
| OpenAI News | Frontier labs | rss | https://openai.com/news/rss.xml | frontier-labs, ai, agents, models | `npx arss feed-registry-import registry/feeds.json --feed openai-news --sync-now` |
| Google DeepMind Blog | Frontier labs | rss | https://deepmind.google/blog/rss.xml | frontier-labs, ai, research | `npx arss feed-registry-import registry/feeds.json --feed google-deepmind-blog --sync-now` |
| Hugging Face Blog | Developer tooling | rss | https://huggingface.co/blog/feed.xml | open-source-ai, models, developer-tools | `npx arss feed-registry-import registry/feeds.json --feed hugging-face-blog --sync-now` |
| Latent Space | Media | substack | https://www.latent.space/feed | newsletter, ai-engineering, agents | `npx arss feed-registry-import registry/feeds.json --feed latent-space --sync-now` |
| Interconnects | Research | substack | https://www.interconnects.ai/feed | newsletter, ai-research, policy | `npx arss feed-registry-import registry/feeds.json --feed interconnects --sync-now` |
| The Gradient | Research | rss | https://thegradient.pub/rss/ | ai-research, essays, society | `npx arss feed-registry-import registry/feeds.json --feed the-gradient --sync-now` |
| LangChain Changelog | Developer tooling | rss | https://changelog.langchain.com/feed.xml | agents, developer-tools, changelog | `npx arss feed-registry-import registry/feeds.json --feed langchain-changelog --sync-now` |
| GitHub Copilot Changelog | Developer tooling | rss | https://github.blog/changelog/label/copilot/feed/ | developer-tools, ai-coding, copilot | `npx arss feed-registry-import registry/feeds.json --feed github-copilot-changelog --sync-now` |
| Ethereum Magicians | Agent protocols | rss | https://ethereum-magicians.org/latest.rss | ethereum, standards, agents | `npx arss feed-registry-import registry/feeds.json --feed ethereum-magicians --sync-now` |
| Lil'Log — Lilian Weng | Research | rss | https://lilianweng.github.io/index.xml | ai-research, agents, rag | `npx arss feed-registry-import registry/feeds.json --feed lilian-weng --sync-now` |
| TechCrunch AI | Industry | rss | https://techcrunch.com/category/artificial-intelligence/feed/ | ai-news, startups, industry | `npx arss feed-registry-import registry/feeds.json --feed techcrunch-ai --sync-now` |
| MIT Technology Review AI | Research | rss | https://www.technologyreview.com/topic/artificial-intelligence/feed | ai-news, research, society | `npx arss feed-registry-import registry/feeds.json --feed mit-tech-review-ai --sync-now` |
| Google Research Blog | Frontier labs | rss | https://research.google/blog/rss/ | research, ai, frontier-labs | `npx arss feed-registry-import registry/feeds.json --feed google-research-blog --sync-now` |
| Microsoft Research Blog | Frontier labs | rss | https://www.microsoft.com/en-us/research/feed/ | research, ai, frontier-labs | `npx arss feed-registry-import registry/feeds.json --feed microsoft-research-blog --sync-now` |
| AWS Machine Learning Blog | Infrastructure | rss | https://aws.amazon.com/blogs/machine-learning/feed/ | ai-infrastructure, cloud, ml | `npx arss feed-registry-import registry/feeds.json --feed aws-machine-learning-blog --sync-now` |
| Stripe Blog | Payments | rss | https://stripe.com/blog/feed.rss | payments, internet-business, x402-adjacent | `npx arss feed-registry-import registry/feeds.json --feed stripe-blog --sync-now` |
| OpenAI Cookbook commits | Frontier labs | atom | https://github.com/openai/openai-cookbook/commits/main.atom | openai, developer-tools, agents | `npx arss feed-registry-import registry/feeds.json --feed openai-cookbook-commits --sync-now` |
| Anthropic Cookbook commits | Frontier labs | atom | https://github.com/anthropics/anthropic-cookbook/commits/main.atom | anthropic, developer-tools, agents | `npx arss feed-registry-import registry/feeds.json --feed anthropic-cookbook-commits --sync-now` |
| Vercel AI SDK commits | Developer tooling | atom | https://github.com/vercel/ai/commits/main.atom | ai-sdk, developer-tools, agents | `npx arss feed-registry-import registry/feeds.json --feed vercel-ai-sdk-commits --sync-now` |
| OpenAI Agents Python commits | Frontier labs | atom | https://github.com/openai/openai-agents-python/commits/main.atom | agents, openai, developer-tools | `npx arss feed-registry-import registry/feeds.json --feed openai-agents-python-commits --sync-now` |
| LangChain releases | Developer tooling | atom | https://github.com/langchain-ai/langchain/releases.atom | agents, langchain, developer-tools | `npx arss feed-registry-import registry/feeds.json --feed langchain-releases --sync-now` |
| browser-use commits | Developer tooling | atom | https://github.com/browser-use/browser-use/commits/main.atom | browser-agents, automation, agents | `npx arss feed-registry-import registry/feeds.json --feed browser-use-commits --sync-now` |
| cs.CL updates on arXiv.org | Research | rss | https://export.arxiv.org/rss/cs.CL | arxiv, nlp, llms, research | `npx arss feed-registry-import registry/feeds.json --feed arxiv-cs-cl --sync-now` |
| cs.LG updates on arXiv.org | Research | rss | https://export.arxiv.org/rss/cs.LG | arxiv, machine-learning, research | `npx arss feed-registry-import registry/feeds.json --feed arxiv-cs-lg --sync-now` |
