import { mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { buildArssFromMarkdownDir, validateArss } from "../src/arss/arss.js";
import { installSubscription, searchStore, syncSubscription } from "../src/arss/store.js";

const root = join(tmpdir(), `arss-store-test-${Date.now()}`);
const source = join(root, "source");
const store = join(root, "store");
mkdirSync(source, { recursive: true });
writeFileSync(join(source, "publisher-risk.md"), `# Publisher risk in the agent web\n\nAgents need licensed context feeds with attribution, payment rules and cache TTLs.\n`);
writeFileSync(join(source, "x402.md"), `# x402 as content payment\n\nx402 lets agents pay for full text resources without creating publisher accounts.\n`);

const feed = buildArssFromMarkdownDir(source, { title: "ARSS Starter Feed", feed_url: "https://example.com/.well-known/arss.json" });
assert(validateArss(feed).ok, "starter feed validates");
const feedPath = join(root, "arss.json");
writeFileSync(feedPath, `${JSON.stringify(feed, null, 2)}\n`);

const installed = await installSubscription({ feed_url: "https://example.com/.well-known/arss.json", store_dir: store, agent: { name: "Test Agent" } });
const synced = await syncSubscription({ subscription_file: installed.path, feed_source: feedPath, store_dir: store });
assert(synced.feed.title === "ARSS Starter Feed", "feed synced");
assert(synced.chunks.length >= 2, "chunks indexed");

const results = searchStore({ store_dir: store, query: "licensed context attribution", limit: 3 });
assert(results.length > 0, "search returns results");
assert(results[0].chunk.rights.attribution_required, "rights preserved on chunks");

rmSync(root, { recursive: true, force: true });
console.log("✅ arss store tests passed");

function assert(condition, message) {
    if (!condition) throw new Error(message);
}
