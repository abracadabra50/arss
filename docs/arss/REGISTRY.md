# ARSS Registry and Publisher Claims v0.2

ARSS starts local and boring: a feed URL, a subscription manifest, an MCP server. The registry layer is what lets publishers claim feeds, add payment terms, and later stake reputation without making users think about tokens.

## User experience

For a user:

```text
“Subscribe Pal to The Example Feed.”
```

The agent should do this:

1. discover ARSS/RSS feed;
2. check whether the feed has a publisher claim;
3. show a plain-English trust/payment line;
4. create a local subscription manifest;
5. sync free context;
6. ask/pay only when paid full text is useful and budget policy allows.

No token prompts. No staking prompts. No wallet ceremony unless the user explicitly opts into paid content.

## Publisher experience

For a publisher:

```bash
# 1. Generate an ARSS feed from existing content
npm run arss -- build ./content \
  --title "Example Research" \
  --home https://example.com \
  --feed-url https://example.com/.well-known/arss.json \
  --out arss.json

# 2. Create a publisher claim with payment defaults
npm run arss -- claim-template arss.json \
  --publisher-name "Example Research" \
  --origin https://example.com \
  --recipient 0xPublisherWallet \
  --canonical 0.001 \
  --chunks 0.003 \
  --out arss-claim.json

# 3. Publish these files
# https://example.com/.well-known/arss.json
# https://example.com/.well-known/arss-claim.json

# 4. Apply claim/payment terms to the feed
npm run arss -- claim-apply arss.json arss-claim.json --out arss.claimed.json
```

The claim file proves the publisher controls the origin and declares payment defaults. In v0 this is a signed or unsigned JSON object served from the same origin. Later it can be backed by DNS, DID and registry stake.

## Claim object

```json
{
  "type": "https://arss.dev/feed-claim/v0.2",
  "feed_url": "https://example.com/.well-known/arss.json",
  "origin": "https://example.com",
  "publisher": {
    "id": "did:web:example.com",
    "name": "Example Research",
    "url": "https://example.com"
  },
  "proofs": [
    { "method": "well-known", "url": "https://example.com/.well-known/arss-claim.json" },
    { "method": "same-origin-feed", "url": "https://example.com/.well-known/arss.json" }
  ],
  "payment": {
    "preferred_protocol": "x402",
    "accepted": [{ "protocol": "x402", "network": "eip155:8453", "asset": "USDC", "recipient": "0x..." }],
    "default_prices": { "canonical_text": "0.001", "chunks": "0.003" }
  },
  "stake": {
    "mode": "none",
    "asset": "ARSS",
    "amount": "0",
    "purpose": "publisher_claim_anti_spam"
  },
  "claim_hash": "sha256:..."
}
```

## Decentralised path

The registry should not become another central directory wearing a protocol hat. The decentralised path is:

```text
Publisher origin claim       → free, same-origin, no token
Signed wallet/DID claim      → portable identity
Optional registry record     → discoverability + reputation
Optional stake               → anti-spam + slashing for fraud
Curator/indexer stake        → ranked directories and mirrors
x402 stablecoin payments     → content access
ARSS token, if any           → trust collateral, not content currency
```

## Token design constraint

The token must be invisible to normal users.

Good token uses:

- publisher anti-spam bonds for public registry listing;
- indexer bonds for serving untampered chunks;
- curator bonds for topic lists and recommendations;
- slashing for impersonation, malicious claims, poisoned summaries or stale mirrors;
- rewards for useful mirrors, validators and challengers.

Bad token uses:

- forcing users to buy a token to read articles;
- replacing x402/USDC payments;
- making publishers understand staking before publishing a feed;
- making the first product feel like a casino in a trench coat.

## v0 commands

```bash
npm run arss -- claim-template <feed.json> --out <claim.json> --recipient <wallet>
npm run arss -- claim-verify <claim.json> --feed <feed.json>
npm run arss -- claim-apply <feed.json> <claim.json> --out <feed.claimed.json>
npm run arss -- registry-add <claim.json> --feed <feed.json>
npm run arss -- registry-list
```

## Implementation files

- `src/arss/registry.js`
- `docs/arss/schemas/arss-feed-claim-v0.2.schema.json`
- `docs/arss/REGISTRY.md`
