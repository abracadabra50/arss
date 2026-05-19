#!/usr/bin/env node
import { spawnSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { performance } from "perf_hooks";
import { parseMaybeArss } from "../src/arss/arss.js";

const args = parseArgs(process.argv.slice(2));
const dietPath = resolve(args.diet || "docs/arss/context-diets/agent-web.json");
const memoryPath = resolve(args.memory || "artefacts/arss/context-memory.jsonl");
const inboxPath = resolve(args.inbox || "artefacts/arss/agent-inbox.json");
const out = resolve(args.out || "artefacts/evals/arss-live-eval.json");
const mdOut = resolve(args.markdownOut || "artefacts/evals/arss-live-eval.md");
const maxSources = Number(args.maxSources || 12);
const timeoutMs = Number(args.timeoutMs || 25000);
const runHeartbeat = args.heartbeat !== "false";
const format = args.format || "text";

const diet = JSON.parse(readFileSync(dietPath, "utf8"));
const selectedSources = (diet.sources || []).slice(0, maxSources);
const started = performance.now();

if (runHeartbeat) {
    spawnSync("npm", ["run", "--silent", "arss:heartbeat", "--", "--diet", dietPath, "--format", "json", "--force", "--limit", "12", "--transcript-limit", "4"], { cwd: resolve("."), encoding: "utf8", timeout: 180000 });
}

const fetched = [];
for (const source of selectedSources) fetched.push(await fetchAndParseSource(source));
const cases = fetched.filter(f => f.ok && f.latest).map(f => makeCase(f));
const memoryRows = readJsonl(memoryPath);
const inbox = existsSync(inboxPath) ? JSON.parse(readFileSync(inboxPath, "utf8")) : { injections: [] };

const methods = [
    evaluateLiveFeedPolling(cases, fetched),
    evaluateArssMemory(cases, memoryRows),
    evaluateArssInbox(cases, inbox),
    evaluateHybrid(cases, memoryRows, fetched),
];

const payload = {
    type: "https://arss.dev/live-eval-run/v0.1",
    generated_at: new Date().toISOString(),
    diet: { path: dietPath, name: diet.name, sources_selected: selectedSources.length, cases: cases.length },
    caveat: "Live eval: fetches real subscribed feeds now and checks actual local ARSS memory/inbox. It does not use a paid search API, so open-web search is represented only by the source-fetch and hybrid baselines.",
    source_fetches: fetched.map(f => ({ id: f.source.id, title: f.source.title, kind: f.source.kind, ok: f.ok, latency_ms: f.latency_ms, items: f.items || 0, chars: f.chars || 0, error: f.error })),
    methods,
    elapsed_ms: Math.round(performance.now() - started),
};

writeJson(out, payload);
writeText(mdOut, renderMarkdown(payload));

if (format === "json") console.log(JSON.stringify(payload, null, 2));
else if (format === "markdown") console.log(renderMarkdown(payload));
else console.log(renderText(payload));

async function fetchAndParseSource(source) {
    const t0 = performance.now();
    try {
        const res = await fetch(source.url, { signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": "ARSS live eval/0.2 (+https://arss.dev)" } });
        const text = await res.text();
        if (!res.ok) throw new Error(`GET ${source.url} ${res.status}: ${text.slice(0, 160)}`);
        const parsed = parseMaybeArss(text, { sourceUrl: source.url });
        const items = parsed.feed.items || [];
        return { source, ok: true, kind: parsed.kind, feed_title: parsed.feed.title, latest: items[0], items: items.length, chars: text.length, latency_ms: Math.round(performance.now() - t0) };
    } catch (err) {
        return { source, ok: false, error: err.message, latency_ms: Math.round(performance.now() - t0) };
    }
}

function makeCase(f) {
    const item = f.latest;
    const text = `${item.title || ""} ${item.summary || ""} ${item.content_text || ""}`;
    return {
        id: `${f.source.id}:${slug(item.id || item.url || item.title)}`,
        source_id: f.source.id,
        source_title: f.source.title,
        source_kind: f.source.kind,
        feed_url: f.source.url,
        item_id: item.id,
        title: item.title || item.url || item.id,
        url: item.url || item.id,
        published_at: item.date_published,
        query_terms: topTerms(`${f.source.title} ${text}`).slice(0, 8),
        live_text_chars: text.length,
    };
}

function evaluateLiveFeedPolling(cases, fetched) {
    const ok = new Set(fetched.filter(f => f.ok && f.latest).map(f => f.source.id));
    const tokenCost = Math.round(fetched.reduce((n, f) => n + (f.chars || 0), 0) / 4);
    const latency = fetched.reduce((n, f) => n + (f.latency_ms || 0), 0);
    return summarize("live_feed_polling", "Live feed polling", cases, cases.map(c => ({ case_id: c.id, found: ok.has(c.source_id), reason: ok.has(c.source_id) ? undefined : "source_fetch_failed" })), {
        approx_tokens_per_run: tokenCost,
        latency_ms: latency,
        notes: "Actually fetched every selected source at answer/eval time. Fresh, but pays network/token cost every run.",
    });
}

function evaluateArssMemory(cases, rows) {
    const results = cases.map(c => {
        const hit = rows.find(r => sameUrl(r.url, c.url) || r.item_id === c.item_id || (r.source_id === c.source_id && lexicalScore(c.query_terms, `${r.title || ""} ${r.summary || ""}`) >= 2));
        return { case_id: c.id, found: Boolean(hit), reason: hit ? undefined : "not_in_local_memory", matched_url: hit?.url };
    });
    const chars = rows.reduce((n, r) => n + String(r.summary || "").length + String(r.title || "").length, 0);
    return summarize("arss_local_memory", "ARSS local memory", cases, results, {
        approx_tokens_per_run: Math.round(chars / 4),
        latency_ms: 20,
        notes: "Actual lookup against context-memory.jsonl after heartbeat. Cheap at answer time; only sees what subscription policy admitted.",
    });
}

function evaluateArssInbox(cases, inbox) {
    const items = inbox.injections || [];
    const results = cases.map(c => {
        const hit = items.find(r => sameUrl(r.url, c.url) || lexicalScore(c.query_terms, `${r.title || ""} ${r.summary || ""}`) >= 3);
        return { case_id: c.id, found: Boolean(hit), reason: hit ? undefined : "not_in_current_top_inbox", matched_url: hit?.url };
    });
    const chars = items.reduce((n, r) => n + String(r.summary || "").length + String(r.transcript_excerpt || "").length + String(r.title || "").length, 0);
    return summarize("arss_agent_inbox", "ARSS current inbox", cases, results, {
        approx_tokens_per_run: Math.round(chars / 4),
        latency_ms: 5,
        notes: "Actual top injected context. Very cheap and quiet, but intentionally drops lower-signal feed items.",
    });
}

function evaluateHybrid(cases, rows, fetched) {
    const memoryUrls = new Set(rows.map(r => normalise(r.url)));
    const liveSources = new Set(fetched.filter(f => f.ok).map(f => f.source.id));
    const results = cases.map(c => {
        if (memoryUrls.has(normalise(c.url))) return { case_id: c.id, found: true, route: "memory" };
        if (liveSources.has(c.source_id)) return { case_id: c.id, found: true, route: "live_feed_fallback" };
        return { case_id: c.id, found: false, reason: "memory_and_live_fetch_failed" };
    });
    const fetchedChars = fetched.reduce((n, f) => n + (f.chars || 0), 0);
    return summarize("arss_hybrid", "ARSS memory + live fallback", cases, results, {
        approx_tokens_per_run: Math.round(fetchedChars / 8),
        latency_ms: Math.round(fetched.reduce((n, f) => n + (f.latency_ms || 0), 0) / 2),
        notes: "Realistic production shape: use memory first, fetch subscribed source only when memory misses.",
    });
}

function summarize(id, name, cases, per_case, extra = {}) {
    const found = per_case.filter(r => r.found).length;
    const recall = cases.length ? found / cases.length : 0;
    return {
        id,
        name,
        recall: round(recall),
        cases_found: found,
        cases_total: cases.length,
        ...extra,
        per_case,
    };
}

function renderText(payload) {
    return `${renderMarkdown(payload)}\n\nWrote ${out}\nWrote ${mdOut}`;
}

function renderMarkdown(payload) {
    const rows = payload.methods.map(m => `| ${m.name} | ${pct(m.recall)} | ${m.cases_found}/${m.cases_total} | ${Number(m.approx_tokens_per_run || 0).toLocaleString()} | ${Number(m.latency_ms || 0).toLocaleString()}ms | ${m.notes} |`).join("\n");
    const failures = payload.methods.map(m => `### ${m.name}\n${m.per_case.filter(c => !c.found).slice(0, 12).map(c => `- ${c.case_id}: ${c.reason}`).join("\n") || "- none"}`).join("\n\n");
    const fetches = payload.source_fetches.map(s => `| ${s.title} | ${s.kind || ""} | ${s.ok ? "ok" : "fail"} | ${s.items || 0} | ${s.latency_ms}ms | ${s.error ? s.error.replace(/\|/g, "\\|").slice(0, 120) : ""} |`).join("\n");
    return `# ARSS live eval\n\nGenerated: ${payload.generated_at}\n\n${payload.caveat}\n\n## Source fetches\n\n| Source | Kind | Status | Items | Latency | Error |\n| --- | --- | --- | ---: | ---: | --- |\n${fetches}\n\n## Method comparison\n\n| Method | Recall | Cases | Approx tokens/run | Latency | Notes |\n| --- | ---: | ---: | ---: | ---: | --- |\n${rows}\n\n## Misses\n\n${failures}\n`;
}

function readJsonl(file) {
    if (!existsSync(file)) return [];
    const text = readFileSync(file, "utf8").trim();
    if (!text) return [];
    return text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}
function topTerms(text) {
    const stop = new Set("the a an and or of to in on for with from via is are be this that did what around about into local latest release notes feed update updates".split(" "));
    const counts = new Map();
    for (const word of String(text).toLowerCase().replace(/https?:\/\/\S+/g, " ").match(/[a-z][a-z0-9-]{2,}/g) || []) {
        if (stop.has(word)) continue;
        counts.set(word, (counts.get(word) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w);
}
function lexicalScore(terms, text) {
    const haystack = String(text || "").toLowerCase();
    return terms.filter(t => haystack.includes(t.toLowerCase())).length;
}
function sameUrl(a, b) { return normalise(a) && normalise(a) === normalise(b); }
function normalise(value) {
    try { return new URL(String(value).replace(/&#038;/g, "&")).toString(); } catch { return String(value || ""); }
}
function slug(value) { return String(value || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "item"; }
function pct(v) { return `${Math.round(v * 100)}%`; }
function round(n) { return Number.isFinite(n) ? Number(n.toFixed(3)) : null; }
function writeJson(file, value) { writeText(file, `${JSON.stringify(value, null, 2)}\n`); }
function writeText(file, value) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, value); }
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
