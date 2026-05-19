#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { createSubscriptionManifest, parseMaybeArss, sha256Hex } from "../src/arss/arss.js";

const args = parseArgs(process.argv.slice(2));
const dietPath = resolve(args.diet || "docs/arss/context-diets/agent-web.json");
const statePath = resolve(args.state || "artefacts/arss/context-diet-state.json");
const memoryPath = resolve(args.memory || "artefacts/arss/context-memory.jsonl");
const summaryPath = resolve(args.summary || "artefacts/arss/context-diet-summary.json");
const maxItemsPerSource = Number(args.maxItems || 12);
const dryRun = args.dryRun === true || args.dryRun === "true";

const diet = JSON.parse(readFileSync(dietPath, "utf8"));
const state = readJson(statePath, { seen: {}, subscriptions: {} });
const run = { diet: diet.name, started_at: new Date().toISOString(), sources: [], new_items: [], errors: [] };

for (const source of diet.sources || []) {
    try {
        const text = await fetchText(source.url);
        const parsed = parseMaybeArss(text, { sourceUrl: source.url });
        const feed = parsed.feed;
        const sub = state.subscriptions[source.id] || createSubscriptionManifest({
            feed_url: source.url,
            agent: { id: "did:web:pal.local", name: "Pal" },
            budget: diet.default_policy?.budget || {},
            permissions: diet.default_policy?.permissions || {},
            sync: { poll: diet.default_policy?.poll || "PT6H", push: "none" },
        });
        state.subscriptions[source.id] = sub;
        let newCount = 0;
        const relevant = [];
        for (const item of (feed.items || []).slice(0, maxItemsPerSource)) {
            const key = sha256Hex(`${source.id}:${item.id}:${item.date_modified || item.date_published || ""}`);
            if (state.seen[key]) continue;
            const score = relevanceScore(item, diet, source);
            const record = {
                type: "https://arss.dev/context-memory/v0.1",
                source_id: source.id,
                source_title: source.title,
                feed_url: source.url,
                item_id: item.id,
                url: item.url,
                title: item.title,
                summary: item.summary || item.content_text || item._agent?.summary || "",
                published_at: item.date_published,
                modified_at: item.date_modified,
                relevance: score,
                matched_terms: matchedTerms(item, diet, source),
                rights: {
                    license: item._agent?.license || "summarise_with_attribution",
                    attribution_required: item._agent?.attribution?.required !== false,
                    allowed: item._agent?.allowed || [],
                    denied: item._agent?.denied || [],
                },
                ingested_at: new Date().toISOString(),
                hash: key,
            };
            state.seen[key] = { source_id: source.id, item_id: item.id, seen_at: record.ingested_at, relevance: score };
            newCount++;
            if (score >= Number(diet.default_policy?.relevance_threshold ?? 0.18)) {
                relevant.push(record);
                run.new_items.push(record);
                if (!dryRun) appendJsonl(memoryPath, record);
            }
        }
        run.sources.push({ id: source.id, title: source.title, kind: parsed.kind, feed_title: feed.title, items_seen: feed.items?.length || 0, new_seen: newCount, relevant: relevant.length });
    } catch (err) {
        run.errors.push({ source_id: source.id, title: source.title, url: source.url, error: err.message });
    }
}

run.finished_at = new Date().toISOString();
run.high_signal = run.new_items.filter(item => item.relevance >= Number(diet.default_policy?.high_signal_threshold ?? 0.42));
if (!dryRun) {
    writeJson(statePath, state);
    writeJson(summaryPath, run);
}
console.log(JSON.stringify(run, null, 2));

async function fetchText(url) {
    const res = await fetch(url, { headers: { "user-agent": "ARSS-Pay prototype/0.2 (+https://arss.dev)" }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
    return await res.text();
}
function itemText(item) {
    return [item.title, item.summary, item.content_text, item.url].filter(Boolean).join("\n").toLowerCase();
}
function matchedTerms(item, diet, source) {
    const text = itemText(item);
    const terms = [...(diet.interests || []), ...(source.topics || [])];
    return Array.from(new Set(terms.filter(term => text.includes(String(term).toLowerCase()))));
}
function relevanceScore(item, diet, source) {
    const matches = matchedTerms(item, diet, source);
    const topicBoost = (source.topics || []).filter(t => matches.includes(t)).length * 0.06;
    const matchScore = Math.min(0.9, matches.length * 0.08 + topicBoost);
    const recencyBoost = isRecent(item.date_published || item.date_modified) ? 0.08 : 0;
    return Number(Math.min(1, matchScore + recencyBoost).toFixed(3));
}
function isRecent(dateValue) {
    if (!dateValue) return false;
    const t = new Date(dateValue).valueOf();
    return Number.isFinite(t) && Date.now() - t < 14 * 24 * 60 * 60 * 1000;
}
function appendJsonl(file, value) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(value)}\n`, { flag: "a" });
}
function writeJson(file, value) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
function readJson(file, fallback) {
    if (!existsSync(file)) return fallback;
    return JSON.parse(readFileSync(file, "utf8"));
}
function parseArgs(argv) {
    const parsed = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith("--")) continue;
        const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        const next = argv[i + 1];
        if (!next || next.startsWith("--")) parsed[key] = true;
        else { parsed[key] = next; i++; }
    }
    return parsed;
}
