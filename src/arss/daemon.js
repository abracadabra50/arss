import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, appendFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { DEFAULT_ARSS_STORE, syncSubscription } from "./store.js";
import { sha256Hex } from "./arss.js";

export const DEFAULT_ARSS_INBOX = "artefacts/arss/inbox";

export async function runDaemonOnce({
    store_dir = DEFAULT_ARSS_STORE,
    inbox_dir = DEFAULT_ARSS_INBOX,
    max_chars = 1200,
    since_all = false,
} = {}) {
    const subscriptions = findSubscriptions(store_dir);
    const deliveries = [];
    for (const subscription_file of subscriptions) {
        const feedKey = subscription_file.split("/").slice(-2, -1)[0] || "feed";
        let result;
        try {
            result = await syncSubscription({ subscription_file, store_dir, max_chars });
        } catch (err) {
            const cachedDir = dirname(subscription_file);
            const cachedFeed = join(cachedDir, "feed.json");
            if (!existsSync(cachedFeed)) {
                deliveries.push(writeErrorDelivery({ inbox_dir, feedKey, error: err }));
                continue;
            }
            result = await syncSubscription({ subscription_file, feed_source: cachedFeed, store_dir, max_chars });
            result.used_cached_feed_after_error = err.message;
        }
        const statePath = join(result.dir, "daemon-state.json");
        const state = readJson(statePath, { delivered_hashes: [], last_run_at: null });
        const delivered = new Set(since_all ? [] : state.delivered_hashes || []);
        const fresh = [];
        for (const chunk of result.chunks) {
            const hash = chunkHash(chunk);
            if (delivered.has(hash)) continue;
            delivered.add(hash);
            fresh.push({ ...chunk, arss_chunk_hash: hash, arss_feed: feedKey });
        }
        const now = new Date().toISOString();
        writeJson(statePath, { delivered_hashes: [...delivered].slice(-5000), last_run_at: now, last_chunk_count: result.chunks.length });
        if (fresh.length) {
            const delivery = writeDelivery({ inbox_dir, feedKey, feed: result.feed, chunks: fresh, paid_resources: result.paid_resources, synced_at: now });
            deliveries.push(delivery);
        }
    }
    writeCombinedDigest({ inbox_dir, deliveries });
    return { subscriptions: subscriptions.length, deliveries };
}

export async function runDaemonLoop({ interval_ms = 15 * 60 * 1000, ...opts } = {}) {
    // Intentionally tiny. Production runners should use launchd/systemd/cron around --once.
    // This keeps the protocol portable for Hermes/OpenClaw/Claude/Codex users.
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            const result = await runDaemonOnce(opts);
            if (opts.verbose) console.error(`[arss-daemon] ${new Date().toISOString()} subscriptions=${result.subscriptions} deliveries=${result.deliveries.length}`);
        } catch (err) {
            console.error(`[arss-daemon] ${new Date().toISOString()} ERROR ${err.stack || err.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, interval_ms));
    }
}

export function findSubscriptions(store_dir = DEFAULT_ARSS_STORE) {
    const root = resolve(store_dir);
    if (!existsSync(root)) return [];
    const out = [];
    for (const name of readdirSync(root)) {
        const dir = join(root, name);
        if (!statSync(dir).isDirectory()) continue;
        const file = join(dir, "subscription.json");
        if (existsSync(file)) out.push(file);
    }
    return out.sort();
}

function writeErrorDelivery({ inbox_dir, feedKey, error }) {
    const root = resolve(inbox_dir);
    mkdirSync(root, { recursive: true });
    const synced_at = new Date().toISOString();
    const safeTime = synced_at.replace(/[:.]/g, "-");
    const md = join(root, `${safeTime}-${feedKey}-error.md`);
    writeText(md, `# ARSS delivery error — ${feedKey}\n\n${error.stack || error.message}\n`);
    appendFileSync(join(root, "events.jsonl"), `${JSON.stringify({ type: "arss.delivery_error", feed_key: feedKey, error: error.message, digest: md, synced_at })}\n`);
    return { feed: feedKey, feed_key: feedKey, chunks: 0, digest: md, jsonl: null, synced_at, error: error.message };
}

function writeDelivery({ inbox_dir, feedKey, feed, chunks, paid_resources = [], synced_at }) {
    const root = resolve(inbox_dir);
    mkdirSync(root, { recursive: true });
    const safeTime = synced_at.replace(/[:.]/g, "-");
    const base = `${safeTime}-${feedKey}`;
    const jsonl = join(root, `${base}.jsonl`);
    const md = join(root, `${base}.md`);
    for (const chunk of chunks) appendFileSync(jsonl, `${JSON.stringify(chunk)}\n`);
    writeText(md, renderDigest({ feed, chunks, paid_resources, synced_at }));
    appendFileSync(join(root, "events.jsonl"), `${JSON.stringify({ type: "arss.delivery", feed: feed.title, feed_key: feedKey, chunks: chunks.length, digest: md, jsonl, synced_at })}\n`);
    return { feed: feed.title, feed_key: feedKey, chunks: chunks.length, digest: md, jsonl, synced_at };
}

function writeCombinedDigest({ inbox_dir, deliveries }) {
    const root = resolve(inbox_dir);
    mkdirSync(root, { recursive: true });
    const latest = join(root, "LATEST.md");
    const body = deliveries.length
        ? [`# ARSS latest deliveries`, ``, ...deliveries.map(d => `- ${d.synced_at} — ${d.feed}: ${d.chunks} new chunk(s). Digest: ${d.digest}`), ``].join("\n")
        : `# ARSS latest deliveries\n\nNo new ARSS context this run.\n`;
    writeText(latest, body);
}

function renderDigest({ feed, chunks, paid_resources, synced_at }) {
    const byItem = new Map();
    for (const chunk of chunks) {
        const key = chunk.item_id || chunk.source?.url || chunk.id;
        if (!byItem.has(key)) byItem.set(key, []);
        byItem.get(key).push(chunk);
    }
    const lines = [`# ARSS delivery — ${feed.title}`, ``, `Synced: ${synced_at}`, `New chunks: ${chunks.length}`, ``];
    for (const [item, itemChunks] of byItem.entries()) {
        const first = itemChunks[0];
        lines.push(`## ${first.source?.title || item}`);
        lines.push(`Source: ${first.source?.url || item}`);
        lines.push(`Rights: ${(first.rights?.allowed || []).join(", ") || "unspecified"}; denied: ${(first.rights?.denied || []).join(", ") || "none"}`);
        lines.push("");
        const text = itemChunks.map(c => c.text).join("\n\n").slice(0, 1200);
        lines.push(text);
        lines.push("");
    }
    if (paid_resources?.length) {
        lines.push("## Paid resources available");
        for (const resource of paid_resources) lines.push(`- ${resource.item_id} / ${resource.kind}: ${resource.price?.amount || "?"} ${resource.price?.asset || "USDC"}`);
        lines.push("");
    }
    return `${lines.join("\n")}\n`;
}

function chunkHash(chunk) {
    return chunk.arss_chunk_hash || chunk.source?.hash || sha256Hex(`${chunk.item_id || ""}\n${chunk.text || ""}`);
}

function readJson(path, fallback) {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) { writeText(path, `${JSON.stringify(value, null, 2)}\n`); }
function writeText(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); }
