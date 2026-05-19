# ARSS Protocol v0.2

ARSS is Agent RSS: a JSON Feed/RSS-compatible protocol for agent-readable content subscriptions with first-class rights, provenance, receipts and x402 payments.

## If a user wants their agent to subscribe

Flow:

```text
1. User gives agent a site/feed URL
2. ARSS discovers /.well-known/arss.json, /arss.json, RSS, Atom or JSON Feed
3. Agent creates a local subscription manifest with budget + permissions
4. ARSS daemon pulls the feed on schedule
5. Free summaries/chunks are indexed locally with rights metadata
6. Paid resources are planned; x402 fetch happens only if budget policy allows
7. Agent searches local context through MCP
8. Answers cite source and respect quote/cache/training rules
```

Reference commands:

```bash
npm run arss -- install https://publisher.example/.well-known/arss.json \
  --agent-name Pal \
  --max-item 0.005 \
  --max-day 0.10

npm run arss -- pull artefacts/arss/store/publisher-example-well-known-arss-json/subscription.json
npm run arss -- search "what changed in AI publishing?"
```

For a local feed file:

```bash
npm run arss -- install https://arss.dev/feeds/agent-context/arss.json --agent-name Pal
npm run arss -- pull artefacts/arss/store/arss-dev-feeds-agent-context-arss-json/subscription.json \
  --feed docs/arss/feeds/agent-context/arss.json
npm run arss -- search "x402 publisher risk"
```

## Do we have to build the first feeds?

Yes, but not from scratch.

ARSS has a bootstrap path:

1. **Wrap existing RSS/Atom feeds.** The CLI can convert ordinary RSS into ARSS with conservative default rights.
2. **Generate ARSS from Markdown/docs.** Static publishers can emit ARSS from folders of Markdown.
3. **Host reference feeds.** We should run the first canonical feeds so agents have something useful to subscribe to immediately.
4. **Give publishers a generator.** WordPress/Ghost/Substack adapters come later.

The first feeds are not the moat; they are the bootloader. The moat is the subscription daemon + MCP interface + payment/rights grammar.

## Files

- Core library: `src/arss/arss.js`
- Local subscription store: `src/arss/store.js`
- CLI: `scripts/arss-cli.js`
- MCP server: `scripts/arss-mcp-server.js`
- Demo publisher with optional x402: `scripts/arss-demo-server.js`
- Schemas: `docs/arss/schemas/*.schema.json`
- First feed: `docs/arss/feeds/agent-context/arss.json`
- Paper: `docs/arss/paper/main.tex`

## Feed shape

ARSS uses JSON Feed 1.1 with an `_agent` extension:

```json
{
  "version": "https://jsonfeed.org/version/1.1",
  "title": "Publisher Feed",
  "feed_url": "https://publisher.example/.well-known/arss.json",
  "_agent": {
    "profile": "https://arss.dev/profile/0.2",
    "publisher": { "id": "did:web:publisher.example", "name": "Publisher" },
    "license": { "default": "summarise_with_attribution" },
    "attribution": { "required": true, "format": "name_url" },
    "context": { "ttl": "PT24H", "memory": "allowed" },
    "payment": {
      "preferred_protocol": "x402",
      "accepted": [{ "protocol": "x402", "network": "eip155:8453", "asset": "USDC" }]
    }
  },
  "items": []
}
```

Each item can expose resources:

```json
{
  "kind": "canonical_text",
  "url": "https://publisher.example/article.md",
  "access": "paid",
  "price": { "protocol": "x402", "network": "eip155:8453", "asset": "USDC", "amount": "0.001" }
}
```

## MCP tools

Reference MCP server tools:

- `arss_validate`
- `arss_subscribe`
- `arss_plan_sync`
- `arss_install`
- `arss_pull`
- `arss_search`

This is the agent-facing surface. The agent should not parse feeds or handle x402 directly unless it wants to.
