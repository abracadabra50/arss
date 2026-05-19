#!/usr/bin/env node
import { createHash } from "crypto";
import { spawnSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "fs";
import { dirname, join, resolve } from "path";

const args = parseArgs(process.argv.slice(2));
const diet = resolve(args.diet || "docs/arss/context-diets/agent-web.json");
const state = resolve(args.state || "artefacts/arss/context-diet-state.json");
const memory = resolve(args.memory || "artefacts/arss/context-memory.jsonl");
const summary = resolve(args.summary || "artefacts/arss/context-diet-summary.json");
const inbox = resolve(args.inbox || "artefacts/arss/agent-inbox.json");
const transcriptDir = resolve(args.transcriptDir || "artefacts/arss/transcripts");
const transcriptMemory = resolve(args.transcriptMemory || "artefacts/arss/transcript-memory.jsonl");
const minIntervalMin = Number(args.minIntervalMin || 60);
const maxItems = Number(args.maxItems || 12);
const format = args.format || "json";
const transcriptMode = args.transcripts !== "false" && args.noTranscripts !== true;

const last = readJson(summary, null);
const due = !last?.finished_at || Date.now() - new Date(last.finished_at).valueOf() >= minIntervalMin * 60 * 1000;
let run = last;
let syncError = null;

if (due || args.force) {
    const result = spawnSync(process.execPath, [
        "scripts/arss-sync-diet.js",
        "--diet", diet,
        "--state", state,
        "--memory", memory,
        "--summary", summary,
        "--max-items", String(maxItems),
    ], { cwd: resolve("."), encoding: "utf8" });
    if (result.status !== 0) syncError = { status: result.status, stderr: result.stderr, stdout: result.stdout };
    else {
        try { run = JSON.parse(result.stdout); }
        catch { run = readJson(summary, last); }
    }
}

const transcriptCandidates = transcriptMode ? selectTranscriptCandidates(memory, Number(args.transcriptLimit || 4)) : [];
const transcripts = transcriptMode ? enrichTranscriptCandidates(transcriptCandidates, { transcriptDir, transcriptMemory }) : [];
const injections = attachTranscriptExcerpts(selectInjections(memory, Number(args.limit || 6)), transcripts);
const payload = {
    type: "https://arss.dev/heartbeat/v0.1",
    due,
    ran: Boolean((due || args.force) && !syncError),
    error: syncError,
    transcripts,
    summary: run ? {
        diet: run.diet,
        finished_at: run.finished_at,
        sources: run.sources?.length || 0,
        new_items: run.new_items?.length || 0,
        high_signal: run.high_signal?.length || 0,
        errors: run.errors || [],
    } : null,
    injections,
};

writeJson(inbox, payload);

if (format === "text") {
    console.log(renderText(payload));
} else {
    console.log(JSON.stringify(payload, null, 2));
}

function selectInjections(file, limit) {
    if (!existsSync(file)) return [];
    const lines = readFileSync(file, "utf8").trim().split("\n").filter(Boolean);
    return lines.slice(-Math.max(1, limit * 4)).map(line => JSON.parse(line))
        .sort((a, b) => (b.relevance || 0) - (a.relevance || 0) || new Date(b.ingested_at).valueOf() - new Date(a.ingested_at).valueOf())
        .slice(0, limit)
        .map(item => ({
            source_id: item.source_id,
            source: item.source_title,
            feed_url: item.feed_url,
            title: item.title,
            url: item.url,
            relevance: item.relevance,
            summary: String(item.summary || "").slice(0, 700),
            matched_terms: item.matched_terms || [],
            ingested_at: item.ingested_at,
        }));
}

function selectTranscriptCandidates(file, limit) {
    if (!existsSync(file)) return [];
    const lines = readFileSync(file, "utf8").trim().split("\n").filter(Boolean);
    const perSource = new Map();
    const candidates = lines.slice(-350).map(line => JSON.parse(line))
        .filter(item => isTranscriptCandidate(item))
        .sort((a, b) => new Date(b.ingested_at).valueOf() - new Date(a.ingested_at).valueOf())
        .filter(item => {
            const key = item.source_id || item.source_title || "unknown";
            const count = perSource.get(key) || 0;
            if (count >= 2) return false;
            perSource.set(key, count + 1);
            return true;
        })
        .slice(0, limit);
    return candidates.map(item => ({
            source_id: item.source_id,
            source: item.source_title,
            title: item.title,
            url: item.url,
            summary: String(item.summary || ""),
            relevance: item.relevance,
            ingested_at: item.ingested_at,
        }));
}

function isTranscriptCandidate(item) {
    const url = String(item.url || "");
    const summary = String(item.summary || "");
    return /youtube\.com\/watch\?v=|youtu\.be\//i.test(url) || /Transcript:\s*https?:\/\//i.test(summary) || /-transcript\b/i.test(summary);
}

function renderText(payload) {
    if (!payload.injections.length) return "ARSS heartbeat: no relevant context ready.";
    const header = payload.ran
        ? `ARSS heartbeat: synced ${payload.summary?.sources || 0} sources; ${payload.summary?.new_items || 0} new relevant items.`
        : "ARSS heartbeat: not due; using warm context.";
    const items = payload.injections.map((item, idx) => `${idx + 1}. ${item.title}\n   Source: ${item.source}\n   Relevance: ${item.relevance}\n   URL: ${item.url}\n   ${item.summary.replace(/\s+/g, " ").trim()}${item.transcript_excerpt ? `\n   Transcript excerpt: ${item.transcript_excerpt.replace(/\s+/g, " ").trim()}` : ""}`).join("\n\n");
    const transcriptLine = payload.transcripts?.length ? `\n\nTranscript enrichment: ${payload.transcripts.filter(t => t.status === "created" || t.status === "cached").length}/${payload.transcripts.length} media items cached.` : "";
    return `${header}${transcriptLine}\n\nRelevant context to keep in mind:\n\n${items}`;
}

function enrichTranscriptCandidates(items, { transcriptDir, transcriptMemory }) {
    if (!items.length) return [];
    mkdirSync(transcriptDir, { recursive: true });
    const out = [];
    for (const item of items) {
        const cacheFile = join(transcriptDir, `${hash(item.url)}.txt`);
        const metaFile = join(transcriptDir, `${hash(item.url)}.json`);
        if (existsSync(cacheFile)) {
            const text = readFileSync(cacheFile, "utf8");
            out.push({ ...baseTranscriptMeta(item, cacheFile), status: "cached", chars: text.length, excerpt: text.slice(0, 1200) });
            continue;
        }
        const fetched = fetchTranscript(item);
        if (!fetched.ok) {
            out.push({ ...baseTranscriptMeta(item, cacheFile), status: "miss", reason: fetched.reason });
            continue;
        }
        writeFileSync(cacheFile, fetched.text);
        const meta = { ...baseTranscriptMeta(item, cacheFile), status: "created", method: fetched.method, chars: fetched.text.length, created_at: new Date().toISOString(), excerpt: fetched.text.slice(0, 1200) };
        writeJson(metaFile, meta);
        appendJsonl(transcriptMemory, {
            type: "https://arss.dev/transcript-memory/v0.1",
            source_id: item.source_id,
            source_title: item.source,
            item_url: item.url,
            title: item.title,
            relevance: item.relevance,
            transcript_path: cacheFile,
            transcript_excerpt: fetched.text.slice(0, 3000),
            transcript_chars: fetched.text.length,
            ingested_at: new Date().toISOString(),
        });
        out.push(meta);
    }
    return out;
}

function fetchTranscript(item) {
    if (/youtube\.com\/watch\?v=|youtu\.be\//i.test(item.url)) return fetchYoutubeTranscript(item.url);
    const transcriptUrl = String(item.summary || "").match(/Transcript:\s*(https?:\/\/[^\s<]+)/i)?.[1]?.replace(/&#038;/g, "&");
    if (transcriptUrl) return fetchHtmlTranscript(transcriptUrl);
    return { ok: false, reason: "no_transcript_adapter" };
}

function fetchYoutubeTranscript(url) {
    const tmp = join(transcriptDir, `.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    mkdirSync(tmp, { recursive: true });
    try {
        const result = spawnSync("yt-dlp", ["--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", "en.*", "--sub-format", "vtt", "--output", `${tmp}/%(id)s.%(ext)s`, url], { encoding: "utf8", timeout: 90000 });
        if (result.status !== 0) return { ok: false, reason: `yt-dlp_failed:${String(result.stderr || result.stdout).slice(0, 240)}` };
        const file = readdirSync(tmp).find(name => name.endsWith(".vtt"));
        if (!file) return { ok: false, reason: "no_vtt_subtitle" };
        const text = parseVtt(readFileSync(join(tmp, file), "utf8"));
        if (text.length < 80) return { ok: false, reason: "empty_transcript" };
        return { ok: true, method: "yt-dlp-vtt", text };
    } finally {
        try { rmSync(tmp, { recursive: true, force: true }); } catch {}
    }
}

function fetchHtmlTranscript(url) {
    const result = spawnSync(process.execPath, ["-e", `const url=${JSON.stringify(url)}; const res=await fetch(url,{headers:{'user-agent':'ARSS-Pay prototype/0.2 (+https://arss.dev)'}}); if(!res.ok) throw new Error('GET '+url+' '+res.status); const html=await res.text(); const text=html.replace(/<script[\\s\\S]*?<\\/script>/gi,' ').replace(/<style[\\s\\S]*?<\\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#038;/g,'&').replace(/&#8211;/g,'–').replace(/&#8217;/g,"'").replace(/&#8220;/g,'“').replace(/&#8221;/g,'”').replace(/\\s+/g,' ').trim(); console.log(text);`], { encoding: "utf8", timeout: 45000, maxBuffer: 5 * 1024 * 1024 });
    if (result.status !== 0) return { ok: false, reason: `html_fetch_failed:${String(result.stderr).slice(0, 240)}` };
    const text = result.stdout.trim();
    if (text.length < 200) return { ok: false, reason: "empty_html_transcript" };
    return { ok: true, method: "html-transcript", text };
}

function parseVtt(vtt) {
    const seen = new Set();
    const parts = [];
    for (const raw of vtt.split(/\r?\n/)) {
        let line = raw.trim();
        if (!line || line === "WEBVTT" || /^Kind:|^Language:/.test(line) || /-->/.test(line) || /^\d+$/.test(line)) continue;
        line = line.replace(/<\d\d:\d\d:\d\d\.\d+><c>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
        if (!line || seen.has(line)) continue;
        seen.add(line);
        parts.push(line);
    }
    return parts.join(" ").replace(/\s+/g, " ").trim();
}

function attachTranscriptExcerpts(injections, transcripts) {
    const byUrl = new Map(transcripts.filter(t => t.excerpt).map(t => [t.url, t]));
    return injections.map(item => byUrl.has(item.url) ? { ...item, transcript_path: byUrl.get(item.url).path, transcript_excerpt: byUrl.get(item.url).excerpt.slice(0, 700) } : item);
}

function baseTranscriptMeta(item, path) {
    return { source_id: item.source_id, source: item.source, title: item.title, url: item.url, path };
}

function appendJsonl(file, value) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(value)}\n`, { flag: "a" });
}

function hash(value) {
    return createHash("sha256").update(String(value)).digest("hex").slice(0, 24);
}
function readJson(file, fallback) {
    if (!existsSync(file)) return fallback;
    try { return JSON.parse(readFileSync(file, "utf8")); } catch { return fallback; }
}
function writeJson(file, value) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
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
