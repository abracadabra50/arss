import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { buildArssFromMarkdownDir, canPayForResource, createPaymentReceipt, createSubscriptionManifest, discoveryCandidates, feedChunksJsonl, listResources, parseMaybeArss, priceFeed, validateArss } from "../src/arss/arss.js";

const rss = `<?xml version="1.0"?><rss version="2.0"><channel><title>Test Feed</title><link>https://example.com</link><description>Testing</description><item><title>Hello agents</title><link>https://example.com/hello</link><guid>hello-1</guid><pubDate>Mon, 18 May 2026 15:00:00 GMT</pubDate><description><![CDATA[Agent-readable context]]></description></item></channel></rss>`;

const feed = parseMaybeArss(rss, { sourceUrl: "https://example.com/rss.xml" }).feed;
assert(feed.title === "Test Feed", "rss title converted");
assert(feed.items.length === 1, "rss item converted");
assert(validateArss(feed).ok, "converted feed validates");

const priced = priceFeed(feed, { canonical: "0.001", chunks: "0.003", recipient: "0x0000000000000000000000000000000000000000" });
const paid = priced.items[0]._agent.resources.filter(r => r.access === "paid");
assert(paid.length === 2, "canonical and chunks priced");
assert(paid.every(r => r.price.protocol === "x402"), "paid resources use x402");
assert(validateArss(priced).ok, "priced feed validates");

const dir = join(tmpdir(), `arss-test-${Date.now()}`);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "one.md"), "# One\n\nThis is a markdown item for agents.\n");
const built = buildArssFromMarkdownDir(dir, { title: "Markdown Feed", home_page_url: "https://example.com/docs/" });
assert(built.items.length === 1, "markdown feed item built");
assert(built.items[0]._agent.canonical_text.hash.startsWith("sha256:"), "canonical hash present");
rmSync(dir, { recursive: true, force: true });

const sub = createSubscriptionManifest({ feed_url: "https://example.com/arss.json", budget: { max_per_item_usdc: "0.002", max_per_day_usdc: "0.01" } });
assert(sub.type === "https://arss.dev/subscription/v0.2", "subscription type set");
const paidResource = listResources(priced, { access: "paid" })[0].resource;
assert(canPayForResource({ resource: paidResource, subscription: sub, relevance: 0.9 }).allow, "budget allows cheap relevant item");
assert(!canPayForResource({ resource: paidResource, subscription: sub, relevance: 0.1 }).allow, "budget denies irrelevant item");
const receipt = createPaymentReceipt({ feed_url: sub.feed_url, item_id: priced.items[0].id, resource_url: paidResource.url, price: paidResource.price, tx_hash: "0x123" });
assert(receipt.type === "https://arss.dev/payment-receipt/v0.2", "receipt type set");
assert(discoveryCandidates("https://example.com/blog/post").includes("https://example.com/.well-known/arss.json"), "discovery candidates include well-known path");
const jsonl = feedChunksJsonl(priced);
const firstChunk = JSON.parse(jsonl.trim().split("\n")[0]);
assert(firstChunk.type !== "", "chunk JSONL generated");
assert(firstChunk.item_id === priced.items[0].id, "chunk item_id set");

console.log("✅ arss tests passed");

function assert(condition, message) {
    if (!condition) throw new Error(message);
}
