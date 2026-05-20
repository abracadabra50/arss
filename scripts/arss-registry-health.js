#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { performance } from "perf_hooks";
import { parseMaybeArss } from "../src/arss/arss.js";

const args = parseArgs(process.argv.slice(2));
const registryPath = resolve(args.registry || "registry/feeds.json");
const out = resolve(args.out || "registry/health.json");
const timeoutMs = Number(args.timeoutMs || 15000);
const concurrency = Number(args.concurrency || 6);
const registry = JSON.parse(readFileSync(registryPath, "utf8"));
const feeds = registry.feeds || [];
const checked_at = new Date().toISOString();
const results = [];

for (let i = 0; i < feeds.length; i += concurrency) {
    const batch = feeds.slice(i, i + concurrency);
    results.push(...await Promise.all(batch.map(feed => checkFeed(feed))));
}

const payload = {
    type: "https://arss.dev/feed-health/v0.1",
    checked_at,
    total: results.length,
    ok: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    feeds: results,
};
writeJson(out, payload);
if (args.format === "json") console.log(JSON.stringify(payload, null, 2));
else console.log(`Checked ${payload.total} feeds: ${payload.ok} ok, ${payload.failed} failed. Wrote ${out}`);

async function checkFeed(feed) {
    const t0 = performance.now();
    try {
        const res = await fetch(feed.url, { signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": "ARSS registry health/0.3 (+https://arss.dev)" } });
        const text = await res.text();
        if (!res.ok) throw new Error(`GET ${feed.url} ${res.status}: ${text.slice(0, 160)}`);
        const parsed = parseMaybeArss(text, { sourceUrl: feed.url });
        const items = parsed.feed.items || [];
        const dates = items.map(item => item.date_published || item.date_modified).filter(Boolean).map(d => new Date(d).valueOf()).filter(Number.isFinite);
        const last = dates.length ? new Date(Math.max(...dates)).toISOString() : undefined;
        return { id: feed.id, title: feed.title, url: feed.url, ok: true, status: res.status, kind: parsed.kind, feed_title: parsed.feed.title, items: items.length, last_item_at: last, latency_ms: Math.round(performance.now() - t0), checked_at };
    } catch (err) {
        return { id: feed.id, title: feed.title, url: feed.url, ok: false, error: err.message, latency_ms: Math.round(performance.now() - t0), checked_at };
    }
}
function writeJson(file, value) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function parseArgs(argv) { const out={}; for(let i=0;i<argv.length;i++){ const a=argv[i]; if(!a.startsWith('--')) continue; const k=a.slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()); const n=argv[i+1]; if(!n||n.startsWith('--')) out[k]=true; else { out[k]=n; i++; }} return out; }
