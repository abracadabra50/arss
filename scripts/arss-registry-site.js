#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

const args = parseArgs(process.argv.slice(2));
const dietPath = resolve(args.diet || "docs/arss/context-diets/agent-web.json");
const outDir = resolve(args.outDir || "registry");
const baseUrl = args.baseUrl || "";
const diet = JSON.parse(readFileSync(dietPath, "utf8"));
const registryUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}/feeds.json` : "registry/feeds.json";
const cliCommand = args.cliCommand || "npx arss";

const feeds = (diet.sources || []).map(source => {
    const id = source.id;
    const topics = source.topics || [];
    const category = source.category || categoryFor({ ...source, topics });
    const subscriptionPath = `subscriptions/${id}.subscription.json`;
    return {
        id,
        title: source.title,
        url: source.url,
        kind: source.kind || "feed",
        category,
        topics,
        arss_url: source.kind === "arss" ? source.url : null,
        subscription_url: subscriptionPath,
        subscribe_command: `${cliCommand} feed-registry-import ${registryUrl} --feed ${id} --sync-now`,
        direct_command: `${cliCommand} diet-add ${source.url} --id ${id}${topics.length ? ` --topics "${topics.join(",")}"` : ""} --sync-now`,
        added_via: "context-diet",
    };
});

const categories = buildCategories(feeds, registryUrl, cliCommand);
const registry = {
    type: "https://arss.dev/feed-registry/v0.1",
    title: args.title || "ARSS Feed Registry",
    description: args.description || "A starter directory of agent-readable feeds and feed-like sources.",
    generated_at: new Date().toISOString(),
    payment_posture: "free-first: listed feeds are free/public unless a publisher explicitly declares paid ARSS resources",
    feeds,
    categories,
};

writeJson(`${outDir}/feeds.json`, registry);
for (const feed of feeds) writeJson(`${outDir}/${feed.subscription_url}`, createFreeSubscriptionManifest(feed));
for (const category of categories) writeJson(`${outDir}/${category.path}`, category);
writeText(`${outDir}/index.html`, renderHtml(registry, baseUrl));
writeText(`${outDir}/README.md`, renderMarkdown(registry));
console.log(JSON.stringify({ wrote: [`${outDir}/index.html`, `${outDir}/feeds.json`, `${outDir}/README.md`, `${outDir}/subscriptions/*.subscription.json`, `${outDir}/categories/*.json`], feeds: feeds.length, categories: categories.length }, null, 2));

function renderHtml(registry, baseUrl) {
    const kinds = [...new Set(registry.feeds.map(f => f.kind))].sort();
    const categoryNames = [...new Set(registry.feeds.map(f => f.category))].sort();
    const topicCount = new Set(registry.feeds.flatMap(f => f.topics)).size;
    const featured = registry.feeds.filter(f => ["native ARSS", "Agent protocols", "Frontier labs", "Developer tooling"].includes(f.category)).slice(0, 6);
    const cards = registry.feeds.map(feed => renderCard(feed)).join("\n");
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(registry.title)}</title>
<link rel="alternate" type="application/json" title="ARSS feed registry" href="${baseUrl}/feeds.json">
<style>
:root {
  color-scheme: light;
  --ink:#101525; --muted:#647084; --soft:#8d99aa; --line:#e6e8ee; --bg:#f7f4ef; --card:#fffaf4;
  --navy:#17223d; --navy2:#253351; --orange:#f0523d; --yellow:#ffcf6d; --green:#1f6b5b; --blue:#4b67c8;
  --shadow:0 24px 70px rgba(23,34,61,.12); --radius:28px;
}
* { box-sizing:border-box; }
html { scroll-behavior:smooth; }
body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:radial-gradient(circle at 10% 0%, rgba(240,82,61,.16), transparent 28%), radial-gradient(circle at 90% 8%, rgba(37,51,81,.18), transparent 32%), linear-gradient(180deg,#fffdf8,var(--bg)); }
a { color:inherit; }
header { max-width:1180px; margin:0 auto; padding:44px 22px 24px; }
.nav { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:48px; }
.logo { display:flex; align-items:center; gap:10px; font-weight:900; letter-spacing:-.04em; }
.mark { width:38px; height:38px; border-radius:14px; background:linear-gradient(135deg,var(--navy),var(--orange)); box-shadow:0 12px 30px rgba(240,82,61,.25); }
.navlinks { display:flex; gap:10px; flex-wrap:wrap; }
.navlinks a { text-decoration:none; color:var(--muted); font-size:14px; font-weight:750; padding:9px 12px; border:1px solid rgba(230,232,238,.7); border-radius:999px; background:rgba(255,255,255,.6); backdrop-filter: blur(12px); }
.hero { display:grid; grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr); gap:28px; align-items:stretch; }
.eyebrow { display:inline-flex; align-items:center; gap:8px; padding:8px 12px; border-radius:999px; color:var(--navy2); background:#fff; border:1px solid var(--line); font-weight:850; font-size:13px; box-shadow:0 8px 30px rgba(23,34,61,.06); }
.dot { width:8px; height:8px; border-radius:50%; background:var(--green); box-shadow:0 0 0 5px rgba(31,107,91,.12); }
h1 { margin:22px 0 0; max-width:820px; font-size:clamp(48px,9vw,112px); line-height:.86; letter-spacing:-.075em; color:var(--navy); }
.lede { margin:26px 0 0; max-width:690px; font-size:21px; line-height:1.5; color:var(--muted); }
.hero-actions { display:flex; gap:12px; flex-wrap:wrap; margin-top:30px; }
.btn, button, .mini { border:0; background:var(--navy); color:white; padding:12px 16px; border-radius:16px; text-decoration:none; cursor:pointer; font-weight:850; box-shadow:0 12px 28px rgba(23,34,61,.16); }
.btn.secondary, .mini { background:white; color:var(--navy); border:1px solid var(--line); box-shadow:none; }
.panel { background:rgba(255,250,244,.86); border:1px solid rgba(230,232,238,.78); border-radius:var(--radius); box-shadow:var(--shadow); padding:20px; backdrop-filter: blur(18px); }
.terminal { background:#09111f; color:#d6f3ff; border-radius:22px; padding:18px; min-height:100%; display:flex; flex-direction:column; gap:14px; }
.terminal-top { display:flex; gap:7px; }
.terminal-top i { width:11px; height:11px; border-radius:50%; background:#ff5f57; } .terminal-top i:nth-child(2){background:#ffbd2e;} .terminal-top i:nth-child(3){background:#28c840;}
.terminal pre { margin:0; white-space:pre-wrap; font-size:13px; line-height:1.55; color:#dbeafe; }
.stats { max-width:1180px; margin:18px auto 0; padding:0 22px; display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
.stat { background:rgba(255,255,255,.76); border:1px solid var(--line); border-radius:22px; padding:18px; }
.stat strong { display:block; font-size:30px; letter-spacing:-.05em; color:var(--navy); } .stat span { color:var(--muted); font-weight:700; font-size:13px; }
main { max-width:1180px; margin:0 auto; padding:24px 22px 76px; }
.section-head { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; margin:34px 0 16px; }
.section-head h2 { margin:0; font-size:34px; letter-spacing:-.055em; color:var(--navy); }
.section-head p { margin:0; color:var(--muted); max-width:560px; line-height:1.5; }
.featured { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:22px; }
.bundles { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin:0 0 24px; }
.bundle { background:rgba(255,255,255,.9); border:1px solid var(--line); border-radius:24px; padding:18px; box-shadow:0 16px 42px rgba(23,34,61,.07); }
.bundle b { color:var(--orange); font-size:12px; text-transform:uppercase; letter-spacing:.08em; } .bundle h3 { margin:10px 0 6px; color:var(--navy); letter-spacing:-.04em; } .bundle p { color:var(--muted); min-height:42px; line-height:1.45; } .bundle pre { white-space:pre-wrap; word-break:break-word; background:#0b1020; color:#e5e7eb; border-radius:16px; padding:12px; font-size:12px; line-height:1.45; }
.feature { border-radius:24px; padding:18px; background:linear-gradient(135deg,#17223d,#253351); color:white; min-height:150px; position:relative; overflow:hidden; }
.feature:after { content:""; position:absolute; inset:auto -40px -60px auto; width:140px; height:140px; background:rgba(240,82,61,.35); border-radius:50%; }
.feature b { display:block; font-size:12px; color:#ffcf6d; text-transform:uppercase; letter-spacing:.08em; } .feature h3 { margin:12px 0 8px; font-size:22px; letter-spacing:-.04em; } .feature p { margin:0; color:#cbd5e1; font-size:13px; }
.toolbar { position:sticky; top:10px; z-index:5; display:grid; grid-template-columns:1fr 180px 180px; gap:10px; margin:18px 0; padding:10px; border:1px solid rgba(230,232,238,.8); background:rgba(255,255,255,.82); backdrop-filter: blur(18px); border-radius:24px; box-shadow:0 16px 42px rgba(23,34,61,.08); }
input, select { width:100%; padding:14px 15px; border:1px solid var(--line); border-radius:16px; font:inherit; background:white; color:var(--ink); }
.grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
.card { background:rgba(255,255,255,.88); border:1px solid var(--line); border-radius:26px; padding:18px; box-shadow:0 16px 42px rgba(23,34,61,.07); display:flex; flex-direction:column; min-height:348px; transition:transform .18s ease, box-shadow .18s ease; }
.card:hover { transform:translateY(-3px); box-shadow:0 22px 60px rgba(23,34,61,.12); }
.card-top { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.kind { display:inline-flex; padding:7px 10px; border-radius:999px; background:#eef2ff; color:var(--navy2); font-size:11px; font-weight:900; text-transform:uppercase; letter-spacing:.08em; }
.category { color:var(--soft); font-size:12px; font-weight:850; }
.health { display:inline-flex; align-self:flex-start; margin-top:10px; padding:6px 9px; border-radius:999px; background:#f3f4f6; color:#647084; font-size:12px; font-weight:850; }
.health.ok { background:#ecfdf5; color:#166534; } .health.fail { background:#fef2f2; color:#991b1b; }
.card h3 { margin:15px 0 8px; font-size:22px; line-height:1.05; letter-spacing:-.045em; color:var(--navy); }
.url { display:block; min-height:38px; word-break:break-all; color:var(--orange); text-decoration:none; font-size:13px; line-height:1.4; }
.tags { margin:14px 0; min-height:58px; } .tags span { display:inline-flex; margin:0 6px 6px 0; padding:5px 8px; border-radius:999px; background:#f2f4f7; color:#536174; font-size:12px; font-weight:700; }
.card pre { margin:auto 0 12px; white-space:pre-wrap; word-break:break-word; background:#0b1020; color:#e5e7eb; border-radius:16px; padding:12px; font-size:12px; line-height:1.45; }
.card code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.button-row { display:grid; grid-template-columns:1fr auto auto; gap:9px; align-items:center; }
.button-row button { border-radius:14px; padding:11px 12px; }
.button-row .mini { display:flex; align-items:center; justify-content:center; margin:0; padding:11px 12px; border-radius:14px; font-size:13px; }
.how { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-top:18px; }
.step { background:#fff; border:1px solid var(--line); border-radius:24px; padding:18px; } .step b { color:var(--orange); } .step h3 { margin:12px 0 6px; color:var(--navy); letter-spacing:-.035em; } .step p { margin:0; color:var(--muted); line-height:1.45; }
footer { max-width:1180px; margin:0 auto 58px; padding:0 22px; color:var(--muted); text-align:center; }
@media (max-width: 900px) { .hero,.featured,.bundles,.grid,.how { grid-template-columns:1fr; } .stats { grid-template-columns:repeat(2,1fr); } .toolbar { grid-template-columns:1fr; position:static; } }
</style>
</head>
<body>
<header>
  <nav class="nav"><div class="logo"><div class="mark"></div><span>ARSS Registry</span></div><div class="navlinks"><a href="feeds.json">feeds.json</a><a href="README.md">README</a><a href="#feeds">Browse feeds</a></div></nav>
  <section class="hero">
    <div>
      <span class="eyebrow"><span class="dot"></span> Feed discovery for agents</span>
      <h1>Feeds agents can subscribe to.</h1>
      <p class="lede">A curated registry of agent-relevant feeds: frontier labs, protocol repos, changelogs, research, podcasts, newsletters and developer signals. Humans browse it. Agents ingest the JSON.</p>
      <div class="hero-actions"><a class="btn" href="#feeds">Browse ${registry.feeds.length} feeds</a><a class="btn secondary" href="feeds.json">Open machine registry</a></div>
    </div>
    <aside class="panel"><div class="terminal"><div class="terminal-top"><i></i><i></i><i></i></div><pre>$ npx arss feed-registry-list ${escapeHtml(registryUrl)}
${registry.feeds.length} feeds discovered

$ npx arss feed-registry-import ${escapeHtml(registryUrl)} --feed simon-willison --sync-now
subscribed → heartbeat → memory/inbox</pre></div></aside>
  </section>
</header>
<section class="stats"><div class="stat"><strong>${registry.feeds.length}</strong><span>feeds</span></div><div class="stat"><strong>${categoryNames.length}</strong><span>categories</span></div><div class="stat"><strong>${kinds.length}</strong><span>feed kinds</span></div><div class="stat"><strong>${topicCount}</strong><span>topics</span></div></section>
<main>
  <div class="section-head"><div><h2>Featured signals</h2><p>High-leverage feeds for agents that care about protocols, tools, AI systems and the publisher-agent web.</p></div></div>
  <section class="featured">${featured.map(f => `<article class="feature"><b>${escapeHtml(f.category)}</b><h3>${escapeHtml(f.title)}</h3><p>${escapeHtml(f.topics.slice(0,4).join(" · "))}</p></article>`).join("")}</section>

  <div class="section-head" id="bundles"><div><h2>Starter bundles</h2><p>Subscribe an agent to a whole lane at once. This is the useful bit: “all frontier labs”, “all agent protocols”, “all research”.</p></div></div>
  <section class="bundles">${registry.categories.map(c => `<article class="bundle"><b>${escapeHtml(c.feed_ids.length)} feeds</b><h3>${escapeHtml(c.title)}</h3><p>${escapeHtml(c.description)}</p><pre><code>${escapeHtml(c.subscribe_command)}</code></pre><div class="button-row"><button data-copy="${escapeHtml(c.subscribe_command)}">Copy bundle command</button><a class="mini" href="${escapeHtml(c.path)}">JSON</a></div></article>`).join("")}</section>

  <div class="section-head" id="feeds"><div><h2>Browse registry</h2><p>Copy a subscribe command, open the original feed, or hand an agent the machine-readable registry.</p></div></div>
  <div class="toolbar"><input id="q" placeholder="Search feeds, topics, URLs…"><select id="category"><option value="">All categories</option>${categoryNames.map(k=>`<option>${escapeHtml(k)}</option>`).join("")}</select><select id="kind"><option value="">All kinds</option>${kinds.map(k=>`<option>${escapeHtml(k)}</option>`).join("")}</select></div>
  <section class="grid" id="grid">${cards}</section>

  <div class="section-head"><div><h2>How agents use it</h2><p>The registry is only useful if it ends in subscription. Discovery is the start, not the product.</p></div></div>
  <section class="how"><article class="step"><b>01</b><h3>Discover</h3><p>Human or agent browses known feeds by topic, kind or category.</p></article><article class="step"><b>02</b><h3>Subscribe</h3><p>Copy the command or consume a subscription manifest.</p></article><article class="step"><b>03</b><h3>Heartbeat</h3><p>Background sync keeps memory and inbox warm without chat spam.</p></article><article class="step"><b>04</b><h3>Answer</h3><p>The agent cites source URLs, respects rights and fetches live only on miss.</p></article></section>
</main>
<footer>Search discovers. ARSS subscribes. Memory remembers. MCP acts. x402 pays.</footer>
<script>
const q=document.querySelector('#q'), kind=document.querySelector('#kind'), category=document.querySelector('#category'), cards=[...document.querySelectorAll('.card')];
function apply(){const needle=q.value.toLowerCase(), k=kind.value, cat=category.value; for(const c of cards){const text=c.innerText.toLowerCase(); c.style.display=(!k||c.dataset.kind===k)&&(!cat||c.dataset.category===cat)&&(!needle||text.includes(needle))?'':'none';}}
q.addEventListener('input',apply); kind.addEventListener('change',apply); category.addEventListener('change',apply);
document.addEventListener('click', async e=>{const b=e.target.closest('button[data-copy]'); if(!b) return; const old=b.textContent; await navigator.clipboard.writeText(b.dataset.copy); b.textContent='Copied'; setTimeout(()=>b.textContent=old,1200);});
fetch('health.json').then(r=>r.ok?r.json():null).then(h=>{ if(!h) return; const byId=new Map((h.feeds||[]).map(x=>[x.id,x])); for(const c of cards){ const x=byId.get(c.dataset.id); const el=c.querySelector('[data-health]'); if(!x||!el) continue; el.classList.remove('ok','fail'); el.classList.add(x.ok?'ok':'fail'); const date=x.last_item_at?new Date(x.last_item_at).toLocaleDateString():''; el.textContent=x.ok?('OK · '+x.items+' items'+(date?' · '+date:'')):'Fetch failed'; el.title=x.error||('Checked '+x.checked_at); }}).catch(()=>{});
</script>
</body>
</html>`;
}

function renderCard(feed) {
    return `<article class="card" data-id="${escapeHtml(feed.id)}" data-kind="${escapeHtml(feed.kind)}" data-category="${escapeHtml(feed.category)}" data-topics="${escapeHtml(feed.topics.join(" "))}">
  <div class="card-top"><span class="kind">${escapeHtml(feed.kind)}</span><span class="category">${escapeHtml(feed.category)}</span></div><div class="health" data-health>Health pending</div>
  <h3>${escapeHtml(feed.title)}</h3>
  <a class="url" href="${escapeHtml(feed.url)}">${escapeHtml(feed.url)}</a>
  <div class="tags">${feed.topics.slice(0, 7).map(t => `<span>${escapeHtml(t)}</span>`).join(" ")}</div>
  <pre><code>${escapeHtml(feed.subscribe_command)}</code></pre>
  <div class="button-row"><button data-copy="${escapeHtml(feed.subscribe_command)}">Copy subscribe</button><a class="mini" href="${escapeHtml(feed.url)}">Feed</a><a class="mini" href="${escapeHtml(feed.subscription_url)}">Manifest</a></div>
</article>`;
}

function renderMarkdown(registry) {
    return `# ${registry.title}\n\n${registry.description}\n\nMachine-readable registry: \`feeds.json\`. Per-feed manifests live in \`subscriptions/*.subscription.json\`. Category bundles live in \`categories/*.json\`. Starter manifests are free-only by default; they do not grant a payment budget.\n\n| Feed | Category | Kind | URL | Topics | Subscribe |\n| --- | --- | --- | --- | --- | --- |\n${registry.feeds.map(f => `| ${f.title.replace(/\|/g, "\\|")} | ${f.category} | ${f.kind} | ${f.url} | ${f.topics.join(", ")} | \`${f.subscribe_command.replace(/`/g, "")}\` |`).join("\n")}\n`;
}

function createFreeSubscriptionManifest(feed) {
    const now = new Date().toISOString();
    return {
        type: "https://arss.dev/subscription/v0.2",
        feed_url: feed.url,
        agent: { id: "did:web:local.agent", name: "Local Agent" },
        permissions: { summarise: true, quote: "limited", embed: true, store_user_memory: true, train_model: false },
        payment_policy: { mode: "free_only", note: "No payment budget is granted by this starter manifest. Paid resources require an explicit local budget." },
        sync: { poll: "PT1H", push: "none" },
        created_at: now,
        updated_at: now,
    };
}

function buildCategories(feeds, registryUrl, cliCommand) {
    const descriptions = {
        "Agent protocols": "MCP, ARSS-adjacent standards, WebSub, JSON Feed, Ethereum agent identity and protocol signals.",
        "Frontier labs": "Official lab and cookbook feeds from OpenAI, Anthropic, Google DeepMind, Google Research and Microsoft Research.",
        "Research": "arXiv, research blogs and long-form technical essays.",
        "Developer tooling": "Changelogs and repositories that affect agent builders and AI engineers.",
        "Infrastructure": "Cloud, compute and publisher infrastructure feeds relevant to agent systems.",
        "Payments": "Payment rails, x402-adjacent sources and internet money plumbing.",
        "Media": "Podcasts, newsletters and video feeds with useful agent/web context.",
        "Industry": "Market, startup, policy and industry signals. Higher noise, useful for context."
    };
    return [...new Set(feeds.map(f => f.category))].sort().map(title => {
        const id = slug(title);
        const feed_ids = feeds.filter(f => f.category === title).map(f => f.id);
        return {
            type: "https://arss.dev/feed-category/v0.1",
            id,
            title,
            description: descriptions[title] || `${title} feeds`,
            feed_ids,
            path: `categories/${id}.json`,
            subscribe_command: `${cliCommand} feed-registry-import ${registryUrl} --category ${quoteArg(title)} --sync-now`,
        };
    });
}

function quoteArg(value) {
    return /\s/.test(value) ? `"${String(value).replace(/"/g, '\\"')}"` : String(value);
}

function slug(value) {
    return String(value || "category").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "category";
}

function categoryFor(feed) {
    const topics = (feed.topics || []).map(t => t.toLowerCase());
    const hay = `${feed.kind || ""} ${topics.join(" ")} ${feed.title || ""}`.toLowerCase();
    if (/arss|mcp|erc-8004|websub|syndication|json feed|standards|ethereum|llms\.txt|openclaw/.test(hay)) return "Agent protocols";
    if (/infrastructure|cloud|compute|publisher infrastructure|aws|cloudflare/.test(hay)) return "Infrastructure";
    if (/x402|payments|stripe|base|coinbase|internet-business/.test(hay)) return "Payments";
    if (/frontier-labs|openai|anthropic|deepmind|google research|microsoft research/.test(hay)) return "Frontier labs";
    if (/arxiv|research|papers|nlp|machine-learning|lilian|gradient/.test(hay)) return "Research";
    if (/youtube|podcast|newsletter|substack|fireship|lex|platformer|interconnects/.test(hay)) return "Media";
    if (/github|commits|releases|changelog|developer-tools|developer tooling|ai-sdk|copilot|browser-agents|langchain|hugging face/.test(hay)) return "Developer tooling";
    if (/hacker-news|techcrunch|industry|startups|society|policy|daring fireball/.test(hay)) return "Industry";
    return "Feeds";
}
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c])); }
function writeJson(file, value) { writeText(file, `${JSON.stringify(value, null, 2)}\n`); }
function writeText(file, value) { const path=resolve(file); mkdirSync(dirname(path), { recursive:true }); writeFileSync(path, value); }
function parseArgs(argv) { const out={}; for(let i=0;i<argv.length;i++){ const a=argv[i]; if(!a.startsWith('--')) continue; const k=a.slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()); const n=argv[i+1]; if(!n||n.startsWith('--')) out[k]=true; else { out[k]=n; i++; }} return out; }
