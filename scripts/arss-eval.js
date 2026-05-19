#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { performance } from "perf_hooks";

const args = parseArgs(process.argv.slice(2));
const out = resolve(args.out || "artefacts/evals/arss-eval.json");
const mdOut = resolve(args.markdownOut || "artefacts/evals/arss-eval.md");
const format = args.format || "text";
const pollIntervalMin = Number(args.pollIntervalMin || 60);

const fixture = createFixture();
const methods = createMethods({ pollIntervalMin });
const started = performance.now();
const results = methods.map(method => evaluateMethod(method, fixture));
const elapsedMs = performance.now() - started;
const payload = {
    type: "https://arss.dev/eval-run/v0.1",
    generated_at: new Date().toISOString(),
    fixture: {
        cases: fixture.cases.length,
        subscribed_sources: Array.from(new Set(fixture.cases.map(c => c.source_type))),
        poll_interval_min: pollIntervalMin,
    },
    caveat: "Deterministic reference eval. It measures the subscription-delivery shape against modelled baselines, not live search engine quality.",
    results,
    elapsed_ms: Number(elapsedMs.toFixed(2)),
};

writeJson(out, payload);
writeText(mdOut, renderMarkdown(payload));

if (format === "json") console.log(JSON.stringify(payload, null, 2));
else if (format === "markdown") console.log(renderMarkdown(payload));
else console.log(renderText(payload));

function createFixture() {
    const cases = [
        {
            id: "agentwall-runtime-safety",
            question: "What changed around runtime safety for local AI agents?",
            source_type: "arxiv",
            published_min: 0,
            asked_min: 180,
            relevant_terms: ["agent", "runtime", "safety", "shell", "api"],
            needs_transcript: false,
            requires_paid: false,
        },
        {
            id: "mcp-server-release",
            question: "Did MCP servers ship any relevant releases?",
            source_type: "github-release",
            published_min: 12,
            asked_min: 95,
            relevant_terms: ["mcp", "server", "release"],
            needs_transcript: false,
            requires_paid: false,
        },
        {
            id: "openclaw-doc-change",
            question: "Did OpenClaw docs change anything agents should know?",
            source_type: "llms.txt",
            published_min: 21,
            asked_min: 100,
            relevant_terms: ["openclaw", "docs", "agent"],
            needs_transcript: false,
            requires_paid: false,
        },
        {
            id: "youtube-subtitle-detail",
            question: "What was the point of that developer video, beyond the title?",
            source_type: "youtube",
            published_min: 30,
            asked_min: 125,
            relevant_terms: ["developer", "video", "operating system"],
            needs_transcript: true,
            requires_paid: false,
        },
        {
            id: "podcast-transcript-detail",
            question: "What did the podcast guest say about agents and scaling laws?",
            source_type: "podcast",
            published_min: 40,
            asked_min: 155,
            relevant_terms: ["podcast", "agents", "scaling"],
            needs_transcript: true,
            requires_paid: false,
        },
        {
            id: "publisher-paid-canonical",
            question: "Is there a paid canonical article worth buying for this agent protocol topic?",
            source_type: "native-arss-paid",
            published_min: 55,
            asked_min: 150,
            relevant_terms: ["agent", "protocol", "payment"],
            needs_transcript: false,
            requires_paid: true,
        },
        {
            id: "substack-platform-shift",
            question: "Did the newsletter add anything about AI platforms this morning?",
            source_type: "substack",
            published_min: 70,
            asked_min: 130,
            relevant_terms: ["ai", "platform", "newsletter"],
            needs_transcript: false,
            requires_paid: false,
        },
        {
            id: "unknown-open-world",
            question: "Find brand-new sources about an unrelated company we do not subscribe to.",
            source_type: "unknown-open-web",
            published_min: 20,
            asked_min: 140,
            relevant_terms: ["unknown", "open", "web"],
            needs_transcript: false,
            requires_paid: false,
        },
    ];
    const noise = [
        { id: "noise-hn", source_type: "forum", relevance: 0.11 },
        { id: "noise-changelog", source_type: "product-blog", relevance: 0.14 },
        { id: "noise-old-release", source_type: "github-release", relevance: 0.09 },
    ];
    return { cases, noise };
}

function createMethods({ pollIntervalMin }) {
    return [
        {
            id: "model_only",
            name: "Model only",
            description: "No retrieval. Whatever the model already knows.",
            query_tokens: 900,
            background_tokens_per_day: 0,
            latency_ms: 250,
            noise_items: 0,
            citation_accuracy: 0,
            rights_compliance: 0,
            payment_policy: 0,
            evaluate: c => miss(c, "no_fresh_context"),
        },
        {
            id: "live_web_search",
            name: "Live web search",
            description: "Search/fetch pages at answer time.",
            query_tokens: 24000,
            background_tokens_per_day: 0,
            latency_ms: 4200,
            noise_items: 7,
            citation_accuracy: 0.78,
            rights_compliance: 0.28,
            payment_policy: 0.05,
            evaluate: c => {
                const indexDelay = c.source_type === "unknown-open-web" ? 20 : 180;
                const available = c.asked_min >= c.published_min + indexDelay;
                if (!available) return miss(c, "search_index_lag");
                if (c.needs_transcript && c.source_type === "youtube") return hit(c, indexDelay, 0.52, "title_or_snippet_only");
                if (c.requires_paid) return miss(c, "no_payment_policy");
                return hit(c, indexDelay, c.source_type === "unknown-open-web" ? 0.86 : 0.74);
            },
        },
        {
            id: "mcp_on_demand",
            name: "MCP on demand",
            description: "Agent calls a known tool/source only after the user asks.",
            query_tokens: 6200,
            background_tokens_per_day: 0,
            latency_ms: 1800,
            noise_items: 2,
            citation_accuracy: 0.82,
            rights_compliance: 0.45,
            payment_policy: 0.2,
            evaluate: c => {
                const known = ["github-release", "llms.txt", "youtube", "podcast", "arxiv"].includes(c.source_type);
                if (!known) return miss(c, "no_known_tool_or_source");
                if (c.needs_transcript && c.source_type === "youtube") return hit(c, 0, 0.68, "requires_extra_transcript_tool");
                if (c.requires_paid) return miss(c, "no_budget_manifest");
                return hit(c, 0, 0.76);
            },
        },
        {
            id: "crawler_rag",
            name: "Crawler + vector RAG",
            description: "Periodic crawl, chunk, embed and search.",
            query_tokens: 3600,
            background_tokens_per_day: 120000,
            latency_ms: 950,
            noise_items: 4,
            citation_accuracy: 0.72,
            rights_compliance: 0.22,
            payment_policy: 0.1,
            evaluate: c => {
                if (["github-release", "unknown-open-web", "native-arss-paid"].includes(c.source_type)) return miss(c, "not_in_crawl_scope");
                const crawlInterval = 24 * 60;
                const lag = Math.min(c.asked_min - c.published_min, crawlInterval / 2);
                const available = c.asked_min - c.published_min >= 60;
                if (!available) return miss(c, "crawl_not_run_yet");
                if (c.needs_transcript) return hit(c, lag, 0.58, "transcript_unreliable");
                return hit(c, lag, 0.7);
            },
        },
        {
            id: "platform_api",
            name: "Platform APIs",
            description: "Bespoke official APIs for each platform.",
            query_tokens: 2600,
            background_tokens_per_day: 5000,
            latency_ms: 700,
            noise_items: 1,
            citation_accuracy: 0.9,
            rights_compliance: 0.65,
            payment_policy: 0.15,
            evaluate: c => {
                const covered = ["github-release", "youtube", "podcast", "arxiv"].includes(c.source_type);
                if (!covered) return miss(c, "no_bespoke_integration");
                if (c.needs_transcript && c.source_type === "podcast") return hit(c, 15, 0.62, "transcript_depends_on_publisher_api");
                return hit(c, 5, 0.84);
            },
        },
        {
            id: "arss_heartbeat",
            name: "ARSS heartbeat",
            description: "Subscribed source diet, background poll, rights-aware memory/inbox.",
            query_tokens: 1800,
            background_tokens_per_day: 0,
            latency_ms: 320,
            noise_items: 1,
            citation_accuracy: 0.94,
            rights_compliance: 0.95,
            payment_policy: 0.9,
            evaluate: c => {
                if (c.source_type === "unknown-open-web") return miss(c, "not_subscribed_use_search_for_discovery");
                const lag = nextPollLag(c.published_min, pollIntervalMin);
                const available = c.asked_min >= c.published_min + lag;
                if (!available) return miss(c, "next_poll_not_run_yet");
                if (c.needs_transcript) return hit(c, lag, 0.7, "summary_plus_transcript_pointer");
                if (c.requires_paid) return hit(c, lag, 0.86, "budget_checked_x402_receipt_available");
                return hit(c, lag, 0.88);
            },
        },
        {
            id: "arss_transcripts",
            name: "ARSS + transcripts",
            description: "ARSS heartbeat plus cached YouTube/podcast transcript enrichment.",
            query_tokens: 2200,
            background_tokens_per_day: 0,
            latency_ms: 360,
            noise_items: 1,
            citation_accuracy: 0.95,
            rights_compliance: 0.95,
            payment_policy: 0.9,
            evaluate: c => {
                if (c.source_type === "unknown-open-web") return miss(c, "not_subscribed_use_search_for_discovery");
                const lag = nextPollLag(c.published_min, pollIntervalMin) + (c.needs_transcript ? 3 : 0);
                const available = c.asked_min >= c.published_min + lag;
                if (!available) return miss(c, "next_poll_not_run_yet");
                if (c.requires_paid) return hit(c, lag, 0.88, "budget_checked_x402_receipt_available");
                return hit(c, lag, c.needs_transcript ? 0.92 : 0.89);
            },
        },
    ];
}

function evaluateMethod(method, fixture) {
    const perCase = fixture.cases.map(c => ({ case_id: c.id, question: c.question, ...method.evaluate(c) }));
    const hits = perCase.filter(r => r.found);
    const knownCases = fixture.cases.filter(c => c.source_type !== "unknown-open-web");
    const knownHits = perCase.filter((r, idx) => fixture.cases[idx].source_type !== "unknown-open-web" && r.found);
    const openWorld = perCase.find((r, idx) => fixture.cases[idx].source_type === "unknown-open-web");
    const avg = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    const confidence = avg(hits.map(h => h.confidence)) || 0;
    return {
        id: method.id,
        name: method.name,
        description: method.description,
        recall_all: round(hits.length / fixture.cases.length),
        recall_subscribed_domains: round(knownHits.length / knownCases.length),
        open_world_discovery: Boolean(openWorld?.found),
        avg_freshness_lag_min: round(avg(hits.map(h => h.freshness_lag_min)) ?? Infinity),
        approx_tokens_per_answer: method.query_tokens,
        background_tokens_per_day: method.background_tokens_per_day,
        latency_ms: method.latency_ms,
        noise_items_injected: method.noise_items,
        citation_accuracy: method.citation_accuracy,
        rights_compliance: method.rights_compliance,
        payment_policy_correctness: method.payment_policy,
        answer_confidence: round(confidence),
        per_case: perCase,
    };
}

function nextPollLag(publishedMin, interval) {
    const next = Math.ceil(publishedMin / interval) * interval;
    return Math.max(0, next - publishedMin);
}
function hit(c, lag, confidence, note = "") { return { found: true, freshness_lag_min: lag, confidence: round(confidence), note }; }
function miss(_c, reason) { return { found: false, freshness_lag_min: null, confidence: 0, reason }; }
function round(n) { return Number.isFinite(n) ? Number(n.toFixed(3)) : null; }

function renderText(payload) {
    return `${renderMarkdown(payload)}\n\nWrote ${out}\nWrote ${mdOut}`;
}

function renderMarkdown(payload) {
    const rows = payload.results.map(r => `| ${r.name} | ${pct(r.recall_subscribed_domains)} | ${r.open_world_discovery ? "yes" : "no"} | ${mins(r.avg_freshness_lag_min)} | ${r.approx_tokens_per_answer.toLocaleString()} | ${r.latency_ms}ms | ${r.noise_items_injected} | ${pct(r.citation_accuracy)} | ${pct(r.rights_compliance)} | ${pct(r.payment_policy_correctness)} |`);
    const winner = payload.results.find(r => r.id === "arss_transcripts");
    return `# ARSS eval — subscription delivery vs alternatives\n\nGenerated: ${payload.generated_at}\n\n${payload.caveat}\n\n## Summary\n\n| Method | Recall on subscribed domains | Open-world discovery | Freshness lag | Tokens / answer | Latency | Noise items | Citation accuracy | Rights compliance | Payment policy |\n| --- | ---: | :---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n${rows.join("\n")}\n\n## Readout\n\nARSS is strongest when the agent already knows the sources it cares about. It wins on freshness, token cost, citation stability, rights metadata and payment policy. It deliberately does not win open-world discovery; that remains search/API territory.\n\nWith transcripts enabled, the eval's reference ARSS path reaches ${pct(winner.recall_subscribed_domains)} recall on subscribed domains with about ${winner.approx_tokens_per_answer.toLocaleString()} tokens per answer and ${mins(winner.avg_freshness_lag_min)} average freshness lag at a ${payload.fixture.poll_interval_min} minute poll interval.\n\n## Per-case failures worth noticing\n\n${payload.results.map(r => `### ${r.name}\n${r.per_case.filter(c => !c.found).map(c => `- ${c.case_id}: ${c.reason}`).join("\n") || "- none"}`).join("\n\n")}\n`;
}

function pct(v) { return `${Math.round(v * 100)}%`; }
function mins(v) { return v === null ? "—" : `${Math.round(v)}m`; }
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
