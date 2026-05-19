#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { createSubscriptionManifest } from "../src/arss/arss.js";

const args = parseArgs(process.argv.slice(2));
const dietPath = resolve(args.diet || "docs/arss/context-diets/agent-web.json");
const outDir = resolve(args.outDir || "registry");
const baseUrl = args.baseUrl || "";
const diet = JSON.parse(readFileSync(dietPath, "utf8"));
const feeds = (diet.sources || []).map(source => {
    const id = source.id;
    const subscriptionPath = `subscriptions/${id}.subscription.json`;
    const topics = source.topics || [];
    return {
        id,
        title: source.title,
        url: source.url,
        kind: source.kind || "feed",
        topics,
        arss_url: source.kind === "arss" ? source.url : null,
        subscription_url: subscriptionPath,
        subscribe_command: `npx arss feed-registry-import ${baseUrl ? `${baseUrl.replace(/\/$/, "")}/feeds.json` : "registry/feeds.json"} --feed ${id} --sync-now`,
        direct_command: `npx arss diet-add ${source.url} --id ${id}${topics.length ? ` --topics "${topics.join(",")}"` : ""} --sync-now`,
        added_via: "context-diet",
    };
});
const registry = {
    type: "https://arss.dev/feed-registry/v0.1",
    title: args.title || "ARSS Feed Registry",
    description: args.description || "A starter directory of agent-readable feeds and feed-like sources.",
    generated_at: new Date().toISOString(),
    default_budget: {
        max_per_item_usdc: args.maxItem || "0.005",
        max_per_day_usdc: args.maxDay || "0.10",
        max_per_month_usdc: args.maxMonth || "2.00",
    },
    feeds,
};

writeJson(`${outDir}/feeds.json`, registry);
for (const feed of feeds) {
    writeJson(`${outDir}/${feed.subscription_url}`, createSubscriptionManifest({
        feed_url: feed.url,
        agent: { id: "did:web:local.agent", name: "Local Agent" },
        budget: registry.default_budget,
        sync: { poll: "PT1H", push: "none" },
    }));
}
writeText(`${outDir}/index.html`, renderHtml(registry, baseUrl));
writeText(`${outDir}/README.md`, renderMarkdown(registry));
console.log(JSON.stringify({ wrote: [`${outDir}/index.html`, `${outDir}/feeds.json`, `${outDir}/README.md`, `${outDir}/subscriptions/*.subscription.json`], feeds: feeds.length }, null, 2));

function renderHtml(registry, baseUrl) {
    const cards = registry.feeds.map(feed => `<article class="card" data-kind="${escapeHtml(feed.kind)}" data-topics="${escapeHtml(feed.topics.join(" "))}">
  <div class="kind">${escapeHtml(feed.kind)}</div>
  <h2>${escapeHtml(feed.title)}</h2>
  <p>${feed.topics.map(t => `<span>${escapeHtml(t)}</span>`).join(" ")}</p>
  <a href="${escapeHtml(feed.url)}">${escapeHtml(feed.url)}</a>
  <pre><code>${escapeHtml(feed.subscribe_command)}</code></pre>
  <div class="button-row"><button data-copy="${escapeHtml(feed.subscribe_command)}">Copy subscribe command</button><a class="mini" href="${escapeHtml(feed.subscription_url)}">Manifest</a></div>
</article>`).join("\n");
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(registry.title)}</title>
<link rel="alternate" type="application/json" title="ARSS feed registry" href="${baseUrl}/feeds.json">
<style>
:root { color-scheme: light; --ink:#111827; --muted:#5b6472; --line:#e5e7eb; --bg:#f8fafc; --card:#ffffff; --accent:#253351; --hot:#f0523d; }
* { box-sizing: border-box; }
body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:linear-gradient(180deg,#fff,var(--bg)); }
header { max-width:960px; margin:0 auto; padding:72px 24px 32px; text-align:center; }
h1 { margin:0; font-size:clamp(42px,8vw,84px); letter-spacing:-0.06em; line-height:.9; }
.lede { max-width:720px; margin:22px auto 0; color:var(--muted); font-size:20px; line-height:1.5; }
.actions { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin-top:28px; }
.actions a, button { border:1px solid var(--line); background:var(--card); color:var(--accent); padding:10px 14px; border-radius:999px; text-decoration:none; cursor:pointer; font-weight:650; }
.actions a:first-child { background:var(--accent); color:white; border-color:var(--accent); }
main { max-width:1120px; margin:0 auto; padding:24px; }
.toolbar { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:20px; }
input, select { padding:12px 14px; border:1px solid var(--line); border-radius:14px; font:inherit; background:white; }
input { flex:1; min-width:240px; }
.grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:16px; }
.card { background:rgba(255,255,255,.88); border:1px solid var(--line); border-radius:24px; padding:20px; box-shadow:0 16px 40px rgba(15,23,42,.06); }
.kind { display:inline-flex; padding:6px 10px; border-radius:999px; background:#eef2ff; color:var(--accent); font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; }
h2 { margin:14px 0 10px; font-size:21px; letter-spacing:-.02em; }
.card p { min-height:34px; }
.card span { display:inline-flex; margin:0 6px 6px 0; padding:5px 8px; border-radius:999px; background:#f3f4f6; color:#4b5563; font-size:12px; }
.card a { display:block; word-break:break-all; color:var(--hot); text-decoration:none; margin:14px 0; }
pre { white-space:pre-wrap; word-break:break-word; background:#0b1020; color:#e5e7eb; border-radius:16px; padding:12px; font-size:12px; line-height:1.45; min-height:72px; }
.card button { width:100%; border-radius:14px; }
.button-row { display:grid; grid-template-columns:1fr auto; gap:10px; align-items:center; }
.button-row .mini { display:flex; align-items:center; justify-content:center; margin:0; border:1px solid var(--line); padding:10px 12px; border-radius:14px; color:var(--accent); background:white; font-weight:700; }
footer { max-width:960px; margin:24px auto 64px; padding:0 24px; color:var(--muted); text-align:center; }
code { background:#eef2ff; padding:2px 5px; border-radius:6px; }
pre code { background:transparent; padding:0; border-radius:0; }
</style>
</head>
<body>
<header>
  <h1>ARSS Feed Registry</h1>
  <p class="lede">A small directory of feeds agents can subscribe to: RSS, Atom, JSON Feed, GitHub, YouTube, podcasts, docs and native ARSS. Humans copy commands. Agents read <code>feeds.json</code> and subscription manifests.</p>
  <div class="actions"><a href="feeds.json">Machine JSON</a><a href="README.md">Registry README</a></div>
</header>
<main>
  <div class="toolbar"><input id="q" placeholder="Search feeds, topics, URLs…"><select id="kind"><option value="">All kinds</option>${[...new Set(registry.feeds.map(f=>f.kind))].sort().map(k=>`<option>${escapeHtml(k)}</option>`).join("")}</select></div>
  <section class="grid" id="grid">${cards}</section>
</main>
<footer>ARSS is the subscription layer for agent context. Search discovers; ARSS subscribes.</footer>
<script>
const q=document.querySelector('#q'), kind=document.querySelector('#kind'), cards=[...document.querySelectorAll('.card')];
function apply(){const needle=q.value.toLowerCase(), k=kind.value; for(const c of cards){const text=c.innerText.toLowerCase(); c.style.display=(!k||c.dataset.kind===k)&&(!needle||text.includes(needle))?'':'none';}}
q.addEventListener('input',apply); kind.addEventListener('change',apply);
document.addEventListener('click', async e=>{const b=e.target.closest('button[data-copy]'); if(!b) return; const old=b.textContent; await navigator.clipboard.writeText(b.dataset.copy); b.textContent='Copied'; setTimeout(()=>b.textContent=old,1200);});
</script>
</body>
</html>`;
}
function renderMarkdown(registry) {
    return `# ${registry.title}\n\n${registry.description}\n\nMachine-readable registry: \`feeds.json\`. Per-feed manifests live in \`subscriptions/*.subscription.json\`.\n\n| Feed | Kind | URL | Topics | Subscribe |\n| --- | --- | --- | --- | --- |\n${registry.feeds.map(f => `| ${f.title.replace(/\|/g, "\\|")} | ${f.kind} | ${f.url} | ${f.topics.join(", ")} | \`${f.subscribe_command.replace(/`/g, "")}\` |`).join("\n")}\n`;
}
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c])); }
function writeJson(file, value) { writeText(file, `${JSON.stringify(value, null, 2)}\n`); }
function writeText(file, value) { const path=resolve(file); mkdirSync(dirname(path), { recursive:true }); writeFileSync(path, value); }
function parseArgs(argv) { const out={}; for(let i=0;i<argv.length;i++){ const a=argv[i]; if(!a.startsWith('--')) continue; const k=a.slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()); const n=argv[i+1]; if(!n||n.startsWith('--')) out[k]=true; else { out[k]=n; i++; }} return out; }
