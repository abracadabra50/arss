import { mkdirSync, existsSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { buildArssFromMarkdownDir } from "../src/arss/arss.js";
import { runDaemonOnce } from "../src/arss/daemon.js";
import { installSubscription } from "../src/arss/store.js";

const root = join(tmpdir(), `arss-daemon-test-${Date.now()}`);
const source = join(root, "source");
const store = join(root, "store");
const inbox = join(root, "inbox");
mkdirSync(source, { recursive: true });
writeFileSync(join(source, "one.md"), "# One\n\nAutomatic agent ingestion should deliver this into the inbox.\n");
const feed = buildArssFromMarkdownDir(source, { title: "Daemon Feed", feed_url: "https://example.com/arss.json" });
const feedPath = join(root, "feed.json");
writeFileSync(feedPath, `${JSON.stringify(feed, null, 2)}\n`);

const installed = await installSubscription({ feed_url: feedPath, store_dir: store, agent: { name: "Daemon Agent" } });
const first = await runDaemonOnce({ store_dir: store, inbox_dir: inbox, since_all: true });
assert(first.subscriptions === 1, "one subscription processed");
assert(first.deliveries.length === 1, "first run delivered chunks");
assert(existsSync(first.deliveries[0].digest), "digest written");
assert(readFileSync(first.deliveries[0].digest, "utf8").includes("Automatic agent ingestion"), "digest contains content");
assert(existsSync(join(inbox, "LATEST.md")), "latest digest written");

const second = await runDaemonOnce({ store_dir: store, inbox_dir: inbox });
assert(second.deliveries.length === 0, "second run does not redeliver unchanged chunks");

void installed;
rmSync(root, { recursive: true, force: true });
console.log("✅ arss daemon tests passed");

function assert(condition, message) {
    if (!condition) throw new Error(message);
}
