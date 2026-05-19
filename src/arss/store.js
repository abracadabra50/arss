import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, appendFileSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { createSubscriptionManifest, feedChunksJsonl, listResources, parseMaybeArss, sha256Hex, validateArss } from "./arss.js";

export const DEFAULT_ARSS_STORE = "artefacts/arss/store";

export function subscriptionSlug(feedUrl) {
    const raw = String(feedUrl || "feed").replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
    return raw.slice(0, 90) || "feed";
}

export async function installSubscription({
    feed_url,
    store_dir = DEFAULT_ARSS_STORE,
    subscriber,
    agent = {},
    budget = {},
    sync = {},
} = {}) {
    if (!feed_url) throw new Error("feed_url is required");
    const slug = subscriptionSlug(feed_url);
    const dir = resolve(store_dir, slug);
    mkdirSync(dir, { recursive: true });
    const subscription = createSubscriptionManifest({ feed_url, subscriber, agent, budget, sync });
    const path = join(dir, "subscription.json");
    writeJson(path, subscription);
    return { slug, dir, path, subscription };
}

export async function syncSubscription({
    subscription_file,
    feed_source,
    store_dir = DEFAULT_ARSS_STORE,
    fetch_paid = false,
    max_chars = 1200,
} = {}) {
    if (!subscription_file) throw new Error("subscription_file is required");
    const subscription = JSON.parse(readFileSync(resolve(subscription_file), "utf8"));
    const source = feed_source || subscription.feed_url;
    const { feed, source_url, kind } = await loadFeed(source);
    const validation = validateArss(feed);
    if (!validation.ok) {
        const err = new Error(`ARSS validation failed: ${validation.errors.join("; ")}`);
        err.validation = validation;
        throw err;
    }

    const slug = subscriptionSlug(subscription.feed_url);
    const dir = resolve(store_dir, slug);
    mkdirSync(dir, { recursive: true });

    const freeResources = listResources(feed, { access: "free" });
    const paidResources = listResources(feed, { access: "paid" });
    const resourceChunks = [];
    const receipts = [];

    for (const { item, resource } of freeResources) {
        if (!["summary", "canonical_text", "chunks"].includes(resource.kind)) continue;
        if (isLocalSource(source) && /^https?:\/\//.test(resource.url) && process.env.ARSS_ALLOW_EXTERNAL_RESOURCE_FETCH !== "true") {
            receipts.push(createConsumptionReceipt({ subscription, feed, item, resource, action: "skipped_external_resource_for_local_feed" }));
            continue;
        }
        try {
            const body = await readResource(resource.url);
            if (resource.kind === "chunks") {
                for (const line of body.split(/\r?\n/).filter(Boolean)) {
                    try { resourceChunks.push(JSON.parse(line)); }
                    catch { resourceChunks.push(chunkFromText({ feed, item, resource, text: line, ordinal: resourceChunks.length })); }
                }
            } else {
                resourceChunks.push(chunkFromText({ feed, item, resource, text: body, ordinal: resourceChunks.length, max_chars }));
            }
            receipts.push(createConsumptionReceipt({ subscription, feed, item, resource, action: "fetched_free_resource", body }));
        } catch (err) {
            receipts.push(createConsumptionReceipt({ subscription, feed, item, resource, action: "fetch_failed", error: err.message }));
        }
    }

    // Inline feed chunks are always indexed; external free resources enrich them.
    const inlineJsonl = feedChunksJsonl(feed, { maxChars: max_chars });
    const inlineChunks = inlineJsonl.trim() ? inlineJsonl.trim().split(/\n/).map(line => JSON.parse(line)) : [];
    const chunks = dedupeChunks([...inlineChunks, ...resourceChunks.flatMap(chunk => Array.isArray(chunk) ? chunk : [chunk])]);

    writeJson(join(dir, "feed.json"), feed);
    writeText(join(dir, "chunks.jsonl"), chunks.map(chunk => JSON.stringify(chunk)).join("\n") + (chunks.length ? "\n" : ""));
    writeJson(join(dir, "sync.json"), {
        synced_at: new Date().toISOString(),
        source_url,
        source_kind: kind,
        feed_title: feed.title,
        items: feed.items?.length || 0,
        chunks: chunks.length,
        free_resources: freeResources.length,
        paid_resources: paidResources.length,
        paid_fetch_enabled: fetch_paid,
        validation,
    });
    for (const receipt of receipts) appendFileSync(join(dir, "receipts.jsonl"), `${JSON.stringify(receipt)}\n`);

    return { dir, subscription, feed, chunks, receipts, paid_resources: paidResources.map(({ item, resource }) => ({ item_id: item.id, kind: resource.kind, url: resource.url, price: resource.price })) };
}

export function searchStore({ store_dir = DEFAULT_ARSS_STORE, query, limit = 10 } = {}) {
    if (!query) throw new Error("query is required");
    const root = resolve(store_dir);
    if (!existsSync(root)) return [];
    const terms = tokenise(query);
    const chunks = [];
    for (const feedDir of readdirSync(root).map(name => join(root, name)).filter(path => statSync(path).isDirectory())) {
        const chunkFile = join(feedDir, "chunks.jsonl");
        if (!existsSync(chunkFile)) continue;
        for (const line of readFileSync(chunkFile, "utf8").split(/\r?\n/).filter(Boolean)) {
            try {
                const chunk = JSON.parse(line);
                const text = `${chunk.source?.title || ""} ${chunk.summary || ""} ${chunk.text || ""}`;
                const score = scoreText(text, terms);
                if (score > 0) chunks.push({ score, feed: basename(feedDir), chunk });
            } catch {}
        }
    }
    return chunks.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function loadFeed(source) {
    const text = await readResource(source);
    const parsed = parseMaybeArss(text, { sourceUrl: /^https?:\/\//.test(source) ? source : undefined });
    return { ...parsed, source_url: source };
}

function isLocalSource(source) {
    return !/^https?:\/\//.test(String(source || ""));
}

async function readResource(source) {
    if (/^https?:\/\//.test(source)) {
        const res = await fetch(source, { signal: AbortSignal.timeout(30000) });
        const text = await res.text();
        if (!res.ok) throw new Error(`GET ${source} failed: ${res.status} ${text.slice(0, 160)}`);
        return text;
    }
    if (source.startsWith("file://")) return readFileSync(new URL(source), "utf8");
    return readFileSync(resolve(source), "utf8");
}

function chunkFromText({ feed, item, resource, text, ordinal = 0, max_chars = 1200 }) {
    const trimmed = String(text || "").trim();
    const parts = splitText(trimmed, max_chars);
    return parts.map((part, idx) => ({
        id: `${item.id}#${resource.kind}-${idx}`,
        item_id: item.id,
        ordinal: ordinal + idx,
        text: part,
        summary: item.summary || item._agent?.summary,
        source: {
            url: item.url || item.id,
            title: item.title,
            publisher: feed._agent?.publisher?.name || feed.title,
            published_at: item.date_published,
            hash: sha256Hex(part),
            resource_url: resource.url,
            resource_kind: resource.kind,
        },
        rights: {
            license: item._agent?.license || feed._agent?.license?.default || "summarise_with_attribution",
            allowed: item._agent?.allowed || [],
            denied: item._agent?.denied || [],
            attribution_required: item._agent?.attribution?.required ?? feed._agent?.attribution?.required ?? true,
        },
    }));
}

function createConsumptionReceipt({ subscription, feed, item, resource, action, body, error }) {
    return {
        type: "https://arss.dev/consumption-receipt/v0.2",
        feed_url: feed.feed_url || subscription.feed_url,
        feed_title: feed.title,
        item_id: item.id,
        resource_url: resource.url,
        resource_kind: resource.kind,
        agent: subscription.agent,
        action,
        ...(body ? { resource_hash: sha256Hex(body) } : {}),
        ...(error ? { error } : {}),
        created_at: new Date().toISOString(),
    };
}

function dedupeChunks(chunks) {
    const seen = new Set();
    const out = [];
    for (const chunk of chunks) {
        const key = chunk.source?.hash || sha256Hex(chunk.text || "");
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(chunk);
    }
    return out;
}

function splitText(text, maxChars) {
    const out = [];
    let remaining = String(text || "").trim();
    while (remaining.length > maxChars) {
        const cut = Math.max(remaining.lastIndexOf("\n\n", maxChars), remaining.lastIndexOf(". ", maxChars), Math.floor(maxChars * 0.8));
        out.push(remaining.slice(0, cut + 1).trim());
        remaining = remaining.slice(cut + 1).trim();
    }
    if (remaining) out.push(remaining);
    return out;
}

function tokenise(value) {
    return String(value || "").toLowerCase().match(/[a-z0-9]{2,}/g) || [];
}

function scoreText(text, terms) {
    const haystack = String(text || "").toLowerCase();
    return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function writeJson(path, value) { writeText(path, `${JSON.stringify(value, null, 2)}\n`); }
function writeText(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); }
