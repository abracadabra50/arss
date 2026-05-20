#!/usr/bin/env node
import { createRequire } from "module";
import { spawnSync } from "child_process";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve, join } from "path";
import { fileURLToPath } from "url";
import { Command } from "commander";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { buildArssFromMarkdownDir, canPayForResource, createArssFeed, createPaymentReceipt, createSubscriptionManifest, discoveryCandidates, feedChunksJsonl, listResources, parseMaybeArss, priceFeed, sha256Hex, validateArss } from "../src/arss/arss.js";
import { DEFAULT_ARSS_STORE, installSubscription, searchStore, syncSubscription } from "../src/arss/store.js";
import { DEFAULT_ARSS_REGISTRY, addClaimToRegistry, applyFeedClaim, createFeedClaim, listRegistryClaims, signFeedClaim, verifyFeedClaim } from "../src/arss/registry.js";

const require = createRequire(import.meta.url);
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const DEFAULT_PUBLIC_REGISTRY = "https://raw.githubusercontent.com/abracadabra50/arss/main/registry/feeds.json";
const DEFAULT_AGENT_DIR = ".arss";
const DEFAULT_AGENT_DIET = `${DEFAULT_AGENT_DIR}/context-diet.json`;
const DEFAULT_AGENT_INBOX = `${DEFAULT_AGENT_DIR}/agent-inbox.json`;
const DEFAULT_AGENT_MEMORY = `${DEFAULT_AGENT_DIR}/context-memory.jsonl`;
const DEFAULT_AGENT_SUMMARY = `${DEFAULT_AGENT_DIR}/context-diet-summary.json`;
const DEFAULT_AGENT_STATE = `${DEFAULT_AGENT_DIR}/context-diet-state.json`;
try { require("dotenv").config({ path: resolve(".env.local") }); require("dotenv").config(); } catch {}

const program = new Command();
program.name("arss").description("ARSS: agent-readable syndication for subscribed context").version("0.3.0");

program.command("validate")
    .argument("<file>", "ARSS JSON feed file")
    .action(file => {
        const feed = JSON.parse(readFileSync(resolve(file), "utf8"));
        const result = validateArss(feed);
        printValidation(result);
        process.exit(result.ok ? 0 : 1);
    });

program.command("convert-rss")
    .argument("<source>", "RSS URL or local XML file")
    .requiredOption("--out <file>", "output ARSS JSON file")
    .option("--recipient <address>", "default x402 recipient wallet")
    .option("--network <caip2>", "payment network", "eip155:8453")
    .option("--asset <asset>", "payment asset", "USDC")
    .action(async (source, opts) => {
        const xml = await readSource(source);
        const feed = parseMaybeArss(xml, { sourceUrl: source.startsWith("http") ? source : undefined }).feed;
        feed._agent.payment = feed._agent.payment || { accepted: [] };
        writeJson(opts.out, feed);
        console.log(`Wrote ${opts.out}`);
    });

program.command("build")
    .argument("<dir>", "directory of markdown/text files")
    .requiredOption("--out <file>", "output ARSS JSON file")
    .requiredOption("--title <title>", "feed title")
    .option("--home <url>", "publisher home page URL")
    .option("--feed-url <url>", "public feed URL")
    .option("--recipient <address>", "default x402 recipient wallet")
    .option("--network <caip2>", "payment network", "eip155:8453")
    .option("--asset <asset>", "payment asset", "USDC")
    .action((dir, opts) => {
        const feed = buildArssFromMarkdownDir(resolve(dir), {
            title: opts.title,
            home_page_url: opts.home,
            feed_url: opts.feedUrl,
            payment: opts,
        });
        writeJson(opts.out, feed);
        console.log(`Wrote ${opts.out}`);
    });

program.command("price")
    .argument("<file>", "ARSS JSON feed file")
    .requiredOption("--out <file>", "output priced ARSS JSON file")
    .option("--canonical <amount>", "canonical markdown price in USDC", "0.001")
    .option("--chunks <amount>", "chunk manifest price in USDC", "0.003")
    .option("--recipient <address>", "x402 recipient wallet")
    .option("--network <caip2>", "payment network", "eip155:8453")
    .option("--asset <asset>", "payment asset", "USDC")
    .option("--facilitator <url>", "x402 facilitator", "https://facilitator.x402.org")
    .action((file, opts) => {
        const feed = JSON.parse(readFileSync(resolve(file), "utf8"));
        const priced = priceFeed(feed, opts);
        writeJson(opts.out, priced);
        console.log(`Wrote ${opts.out}`);
    });

program.command("init")
    .description("initialise an agent context workspace, or create a publisher feed when --title and --out are supplied")
    .option("--dir <dir>", "agent workspace directory", DEFAULT_AGENT_DIR)
    .option("--registry <url>", "default feed registry", DEFAULT_PUBLIC_REGISTRY)
    .option("--title <title>", "publisher feed title")
    .option("--out <file>", "publisher feed output file")
    .option("--home <url>", "publisher home page URL")
    .option("--feed-url <url>", "public feed URL")
    .option("--recipient <address>", "x402 recipient wallet")
    .action(opts => {
        if (opts.title || opts.out) {
            if (!opts.title || !opts.out) throw new Error("Publisher feed init requires both --title and --out. For agent init, run `arss init` with no title/out.");
            const feed = createArssFeed({ title: opts.title, home_page_url: opts.home, feed_url: opts.feedUrl, payment: opts, items: [] });
            writeJson(opts.out, feed);
            console.log(`Wrote ${opts.out}`);
            return;
        }
        const dir = resolve(opts.dir);
        mkdirSync(dir, { recursive: true });
        const dietFile = join(dir, "context-diet.json");
        if (!existsFile(dietFile)) writeJson(dietFile, {
            type: "https://arss.dev/context-diet/v0.1",
            name: "local-agent",
            title: "Local agent context diet",
            description: "Sources this agent keeps warm via ARSS.",
            registry: opts.registry,
            default_policy: {
                poll: "PT6H",
                relevance_threshold: 0,
                high_signal_threshold: 0,
                permissions: { summarise: true, quote: "limited", embed: true, store_user_memory: true, train_model: false },
            },
            interests: ["AI", "agents", "models", "research", "developer tooling"],
            sources: [],
        });
        writeJson(join(dir, "config.json"), {
            type: "https://arss.dev/local-config/v0.1",
            registry: opts.registry,
            diet: dietFile,
            inbox: join(dir, "agent-inbox.json"),
            memory: join(dir, "context-memory.jsonl"),
            created_at: new Date().toISOString(),
        });
        console.log(JSON.stringify({ initialised: dir, diet: dietFile, registry: opts.registry, next: [
            `arss subscribe --category "Frontier labs"`,
            `arss heartbeat`,
            `arss inbox`,
            `arss ask "what changed in AI labs?"`,
        ] }, null, 2));
    });

program.command("discover")
    .argument("<url>", "site or feed URL")
    .option("--out <file>", "write discovered/converted ARSS feed")
    .action(async (url, opts) => {
        const result = await discover(url);
        console.log(`Discovered ${result.kind}: ${result.url}`);
        console.log(`Title: ${result.feed.title}`);
        console.log(`Items: ${result.feed.items.length}`);
        if (opts.out) {
            writeJson(opts.out, result.feed);
            console.log(`Wrote ${opts.out}`);
        }
    });

program.command("subscribe")
    .argument("[feed-url]", "feed URL to add to local diet, or subscription manifest feed URL when --out is supplied")
    .option("--category <name-or-id>", "subscribe to every feed in a registry category")
    .option("--all", "subscribe to every feed in the registry")
    .option("--registry <url-or-file>", "feed registry", DEFAULT_PUBLIC_REGISTRY)
    .option("--diet <file>", "context diet JSON file", DEFAULT_AGENT_DIET)
    .option("--sync-now", "run heartbeat after subscribing")
    .option("--out <file>", "legacy: write a subscription manifest instead of adding to local diet")
    .option("--subscriber <did>", "subscriber DID/wallet DID")
    .option("--agent-id <id>", "agent identifier", "did:web:local.agent")
    .option("--agent-name <name>", "agent name", "Local Agent")
    .option("--max-item <amount>", "max USDC per item", "0.005")
    .option("--max-day <amount>", "max USDC per day", "0.10")
    .option("--max-month <amount>", "max USDC per month", "2.00")
    .option("--poll <duration>", "poll interval", "PT15M")
    .action(async (feedUrl, opts) => {
        if (opts.out) {
            if (!feedUrl) throw new Error("Writing a subscription manifest requires a feed URL.");
            const sub = createSubscriptionManifest({
                feed_url: feedUrl,
                subscriber: opts.subscriber,
                agent: { id: opts.agentId, name: opts.agentName },
                budget: { max_per_item_usdc: opts.maxItem, max_per_day_usdc: opts.maxDay, max_per_month_usdc: opts.maxMonth },
                sync: { poll: opts.poll, push: "none" },
            });
            writeJson(opts.out, sub);
            console.log(`Wrote ${opts.out}`);
            return;
        }
        ensureAgentDiet(opts.diet, opts.registry);
        if (opts.category || opts.all) {
            const registry = await readJsonSource(opts.registry);
            const selected = selectRegistryFeeds(registry, { category: opts.category, all: opts.all });
            if (!selected.length) throw new Error(`No feeds matched ${opts.category || "--all"}`);
            const result = importSourcesIntoDiet({ dietPath: opts.diet, feeds: selected, update: true });
            if (opts.syncNow) result.sync = runHeartbeatNow(opts.diet);
            console.log(JSON.stringify({ ...result, mode: opts.all ? "all" : "category", registry: opts.registry }, null, 2));
            return;
        }
        if (!feedUrl) throw new Error("Provide a feed URL, --category <name>, or --all.");
        const result = await addUrlToDiet({ url: feedUrl, dietPath: opts.diet, update: true });
        if (opts.syncNow) result.sync = runHeartbeatNow(opts.diet);
        console.log(JSON.stringify(result, null, 2));
    });

program.command("sync")
    .argument("<subscription-file>", "subscription manifest")
    .option("--feed <file-or-url>", "feed file or URL override")
    .option("--period-spend <amount>", "already spent this period", "0")
    .option("--relevance <score>", "mock relevance score", "1")
    .action(async (subscriptionFile, opts) => {
        const sub = JSON.parse(readFileSync(resolve(subscriptionFile), "utf8"));
        const feedSource = opts.feed || sub.feed_url;
        const feed = /^https?:\/\//.test(feedSource) ? (await discover(feedSource)).feed : JSON.parse(readFileSync(resolve(feedSource), "utf8"));
        const validation = validateArss(feed);
        if (!validation.ok) {
            printValidation(validation);
            process.exit(1);
        }
        const paid = listResources(feed, { access: "paid" }).map(({ item, resource }) => ({
            item_id: item.id,
            resource: resource.url,
            kind: resource.kind,
            price: resource.price?.amount,
            decision: canPayForResource({ resource, subscription: sub, periodSpend: opts.periodSpend, relevance: Number(opts.relevance) }),
        }));
        const freeCount = listResources(feed, { access: "free" }).length;
        console.log(JSON.stringify({ feed: feed.title, items: feed.items.length, free_resources: freeCount, paid_resources: paid }, null, 2));
    });

program.command("install")
    .argument("<feed-url>", "ARSS/RSS/JSON feed URL")
    .option("--store <dir>", "local ARSS store directory", DEFAULT_ARSS_STORE)
    .option("--subscriber <did>", "subscriber DID/wallet DID")
    .option("--agent-id <id>", "agent identifier", "did:web:local.agent")
    .option("--agent-name <name>", "agent name", "Local Agent")
    .option("--max-item <amount>", "max USDC per item", "0.005")
    .option("--max-day <amount>", "max USDC per day", "0.10")
    .option("--max-month <amount>", "max USDC per month", "2.00")
    .action(async (feedUrl, opts) => {
        const result = await installSubscription({
            feed_url: feedUrl,
            store_dir: opts.store,
            subscriber: opts.subscriber,
            agent: { id: opts.agentId, name: opts.agentName },
            budget: { max_per_item_usdc: opts.maxItem, max_per_day_usdc: opts.maxDay, max_per_month_usdc: opts.maxMonth },
        });
        console.log(JSON.stringify({ installed: result.path, slug: result.slug, store: result.dir }, null, 2));
    });

program.command("pull")
    .argument("<subscription-file>", "subscription manifest")
    .option("--feed <file-or-url>", "feed file or URL override")
    .option("--store <dir>", "local ARSS store directory", DEFAULT_ARSS_STORE)
    .option("--max-chars <n>", "max characters per chunk", "1200")
    .action(async (subscriptionFile, opts) => {
        const result = await syncSubscription({
            subscription_file: subscriptionFile,
            feed_source: opts.feed,
            store_dir: opts.store,
            max_chars: Number(opts.maxChars),
        });
        console.log(JSON.stringify({
            store: result.dir,
            feed: result.feed.title,
            items: result.feed.items.length,
            chunks: result.chunks.length,
            receipts: result.receipts.length,
            paid_resources: result.paid_resources,
        }, null, 2));
    });

program.command("search")
    .argument("<query>", "query local subscribed ARSS context")
    .option("--store <dir>", "local ARSS store directory", DEFAULT_ARSS_STORE)
    .option("--limit <n>", "max results", "10")
    .action((query, opts) => {
        const results = searchStore({ store_dir: opts.store, query, limit: Number(opts.limit) });
        console.log(JSON.stringify(results.map(result => ({
            score: result.score,
            feed: result.feed,
            item_id: result.chunk.item_id,
            title: result.chunk.source?.title,
            url: result.chunk.source?.url,
            publisher: result.chunk.source?.publisher,
            rights: result.chunk.rights,
            text: String(result.chunk.text || "").slice(0, 500),
        })), null, 2));
    });

program.command("heartbeat")
    .description("sync the local context diet into memory/inbox")
    .option("--diet <file>", "context diet JSON file", DEFAULT_AGENT_DIET)
    .option("--state <file>", "sync state file", DEFAULT_AGENT_STATE)
    .option("--memory <file>", "memory JSONL file", DEFAULT_AGENT_MEMORY)
    .option("--summary <file>", "summary JSON file", DEFAULT_AGENT_SUMMARY)
    .option("--inbox <file>", "inbox JSON file", DEFAULT_AGENT_INBOX)
    .option("--force", "sync even if recently run")
    .option("--format <format>", "json or text", "text")
    .action(opts => {
        ensureAgentDiet(opts.diet);
        const args = [join(SCRIPT_DIR, "arss-heartbeat.js"), "--diet", resolve(opts.diet), "--state", resolve(opts.state), "--memory", resolve(opts.memory), "--summary", resolve(opts.summary), "--inbox", resolve(opts.inbox), "--format", opts.format];
        if (opts.force) args.push("--force");
        const result = spawnSync(process.execPath, args, { cwd: REPO_ROOT, encoding: "utf8", stdio: "inherit" });
        process.exit(result.status || 0);
    });

program.command("inbox")
    .description("show the current high-signal ARSS inbox")
    .option("--inbox <file>", "inbox JSON file", DEFAULT_AGENT_INBOX)
    .option("--format <format>", "text or json", "text")
    .action(opts => {
        const payload = readJsonMaybe(opts.inbox, { injections: [] });
        if (opts.format === "json") { console.log(JSON.stringify(payload, null, 2)); return; }
        if (!payload.injections?.length) { console.log("ARSS inbox is empty. Run `arss heartbeat --force` after subscribing."); return; }
        console.log(payload.injections.map((item, idx) => `${idx + 1}. ${item.title}\n   ${item.source || item.source_id}\n   ${item.url}\n   ${String(item.summary || "").replace(/\s+/g, " ").slice(0, 360)}`).join("\n\n"));
    });

program.command("ask")
    .argument("<query>", "question to answer from local subscribed context")
    .option("--memory <file>", "memory JSONL file", DEFAULT_AGENT_MEMORY)
    .option("--inbox <file>", "inbox JSON file", DEFAULT_AGENT_INBOX)
    .option("--limit <n>", "max cited items", "5")
    .action((query, opts) => {
        const rows = readJsonl(opts.memory).concat(readJsonMaybe(opts.inbox, { injections: [] }).injections || []);
        const terms = tokenise(query);
        const hits = rows.map(row => ({ row, score: scoreText(`${row.title || ""} ${row.summary || ""} ${row.content_text || ""} ${row.source || ""} ${row.source_title || ""}`, terms) }))
            .filter(hit => hit.score > 0)
            .sort((a, b) => b.score - a.score || new Date(b.row.ingested_at || 0).valueOf() - new Date(a.row.ingested_at || 0).valueOf())
            .slice(0, Number(opts.limit));
        if (!hits.length) { console.log("No local subscribed-context hit. Run `arss heartbeat --force`, subscribe to more sources, or use live search for unknown sources."); return; }
        console.log(`From local subscribed context, the relevant changes are:\n`);
        for (const [idx, hit] of hits.entries()) {
            const r = hit.row;
            console.log(`${idx + 1}. ${r.title}\n   Source: ${r.source_title || r.source || r.source_id || "unknown"}\n   URL: ${r.url}\n   ${String(r.summary || r.content_text || "").replace(/\s+/g, " ").slice(0, 520)}\n`);
        }
    });

program.command("chunks")
    .argument("<feed-file>", "ARSS feed JSON file")
    .requiredOption("--out <file>", "output JSONL chunk file")
    .option("--max-chars <n>", "max characters per chunk", "1200")
    .action((feedFile, opts) => {
        const feed = JSON.parse(readFileSync(resolve(feedFile), "utf8"));
        const jsonl = feedChunksJsonl(feed, { maxChars: Number(opts.maxChars) });
        writeText(opts.out, jsonl);
        console.log(`Wrote ${opts.out}`);
    });

program.command("diet-add")
    .argument("<url>", "source URL to subscribe to: ARSS/RSS/Atom/JSON Feed, Substack, YouTube channel, docs site, etc.")
    .option("--diet <file>", "context diet JSON file", "docs/arss/context-diets/agent-web.json")
    .option("--id <id>", "source id override")
    .option("--title <title>", "source title override")
    .option("--topics <csv>", "comma-separated topic hints")
    .option("--kind <kind>", "source kind override")
    .option("--update", "update existing source with same id/url instead of failing")
    .option("--dry-run", "discover and print without writing")
    .option("--sync-now", "run arss:heartbeat once after adding")
    .action(async (url, opts) => {
        const dietPath = resolve(opts.diet);
        const diet = JSON.parse(readFileSync(dietPath, "utf8"));
        const discovered = await discoverDietSource(url);
        const baseId = opts.id || slugify(discovered.feed.title || new URL(discovered.url).hostname);
        const source = {
            id: opts.update ? baseId : uniqueSourceId(diet, baseId),
            title: opts.title || discovered.feed.title || discovered.url,
            url: discovered.url,
            kind: opts.kind || kindForDiet(discovered.kind, discovered.url),
            topics: csv(opts.topics),
        };
        const existingIndex = (diet.sources || []).findIndex(s => s.id === source.id || normaliseUrl(s.url) === normaliseUrl(source.url));
        if (existingIndex >= 0 && !opts.update && !opts.dryRun) throw new Error(`Source already exists: ${diet.sources[existingIndex].id} (${diet.sources[existingIndex].url}). Use --update.`);
        if (opts.dryRun) {
            console.log(JSON.stringify({ would_add: source, discovered: { kind: discovered.kind, feed_title: discovered.feed.title, items: discovered.feed.items?.length || 0 } }, null, 2));
            return;
        }
        diet.sources = diet.sources || [];
        if (existingIndex >= 0) diet.sources[existingIndex] = { ...diet.sources[existingIndex], ...source, topics: source.topics.length ? source.topics : diet.sources[existingIndex].topics || [] };
        else diet.sources.push(source);
        writeJson(dietPath, diet);
        const result = { added: existingIndex < 0, updated: existingIndex >= 0, source, diet: dietPath, feed: { title: discovered.feed.title, items: discovered.feed.items?.length || 0, kind: discovered.kind } };
        if (opts.syncNow) result.sync = runHeartbeatNow(opts.diet);
        console.log(JSON.stringify(result, null, 2));
    });

program.command("diet-list")
    .option("--diet <file>", "context diet JSON file", "docs/arss/context-diets/agent-web.json")
    .action(opts => {
        const diet = JSON.parse(readFileSync(resolve(opts.diet), "utf8"));
        console.log(JSON.stringify((diet.sources || []).map(source => ({ id: source.id, title: source.title, url: source.url, kind: source.kind, topics: source.topics || [] })), null, 2));
    });

program.command("feed-registry-list")
    .argument("<registry>", "feed registry JSON URL or file")
    .action(async registrySource => {
        const registry = await readJsonSource(registrySource);
        console.log(JSON.stringify((registry.feeds || []).map(feed => ({ id: feed.id, title: feed.title, url: feed.url, kind: feed.kind, topics: feed.topics || [], subscription_url: feed.subscription_url })), null, 2));
    });

program.command("feed-registry-import")
    .argument("<registry>", "feed registry JSON URL or file")
    .option("--feed <id-or-url>", "single feed id, title, or URL from registry")
    .option("--category <name-or-id>", "import every feed in a registry category")
    .option("--all", "import every feed in the registry")
    .option("--diet <file>", "context diet JSON file", "docs/arss/context-diets/agent-web.json")
    .option("--update", "update existing sources with same id/url instead of failing")
    .option("--sync-now", "run arss:heartbeat once after importing")
    .action(async (registrySource, opts) => {
        const registry = await readJsonSource(registrySource);
        const selected = selectRegistryFeeds(registry, opts);
        if (!selected.length) throw new Error("No feeds selected. Use --feed <id>, --category <name>, or --all.");
        const dietPath = resolve(opts.diet);
        const diet = JSON.parse(readFileSync(dietPath, "utf8"));
        diet.sources = diet.sources || [];
        const imported = [];
        const skipped = [];
        for (const feed of selected) {
            const source = { id: feed.id || slugify(feed.title || feed.url), title: feed.title || feed.url, url: feed.url, kind: feed.kind || "feed", topics: feed.topics || [] };
            const existingIndex = diet.sources.findIndex(s => s.id === source.id || normaliseUrl(s.url) === normaliseUrl(source.url));
            if (existingIndex >= 0 && !opts.update) { skipped.push({ id: source.id, reason: "already_exists" }); continue; }
            if (existingIndex >= 0) diet.sources[existingIndex] = { ...diet.sources[existingIndex], ...source };
            else diet.sources.push(source);
            imported.push(source);
        }
        writeJson(dietPath, diet);
        const result = { imported, skipped, count: imported.length, registry: registrySource, diet: dietPath, mode: opts.all ? "all" : opts.category ? "category" : "feed" };
        if (opts.syncNow && imported.length) result.sync = runHeartbeatNow(opts.diet);
        console.log(JSON.stringify(result, null, 2));
    });

program.command("claim-template")
    .argument("<feed-file>", "ARSS feed JSON file to claim")
    .requiredOption("--out <file>", "output claim JSON file")
    .option("--origin <url>", "publisher origin; defaults to feed_url origin")
    .option("--publisher-id <id>", "publisher DID/id")
    .option("--publisher-name <name>", "publisher display name")
    .option("--publisher-url <url>", "publisher home URL")
    .option("--recipient <address>", "x402 recipient wallet")
    .option("--network <caip2>", "payment network", "eip155:8453")
    .option("--asset <asset>", "payment asset", "USDC")
    .option("--facilitator <url>", "x402 facilitator", "https://facilitator.x402.org")
    .option("--canonical <amount>", "canonical markdown price in USDC", "0.001")
    .option("--chunks <amount>", "chunk manifest price in USDC", "0.003")
    .option("--stake-amount <amount>", "optional future registry stake amount", "0")
    .option("--stake-asset <asset>", "optional future registry stake asset", "ARSS")
    .option("--sign-private-key <hex>", "optional EIP-191 signing private key")
    .action(async (feedFile, opts) => {
        const feed = JSON.parse(readFileSync(resolve(feedFile), "utf8"));
        const claim = createFeedClaim({
            feed,
            origin: opts.origin,
            publisher: { id: opts.publisherId, name: opts.publisherName, url: opts.publisherUrl },
            payment: { recipient: opts.recipient || "", network: opts.network, asset: opts.asset, facilitator: opts.facilitator },
            pricing: { canonical_text: opts.canonical, chunks: opts.chunks },
            stake: { amount: opts.stakeAmount, asset: opts.stakeAsset, mode: opts.stakeAmount === "0" ? "none" : "declared" },
        });
        const signed = await signFeedClaim(claim, opts.signPrivateKey);
        writeJson(opts.out, signed);
        console.log(`Wrote ${opts.out}`);
    });

program.command("claim-verify")
    .argument("<claim-file>", "ARSS feed claim JSON file")
    .option("--feed <file>", "feed file to verify against")
    .option("--require-signature", "fail if claim is unsigned")
    .action(async (claimFile, opts) => {
        const claim = JSON.parse(readFileSync(resolve(claimFile), "utf8"));
        const feed = opts.feed ? JSON.parse(readFileSync(resolve(opts.feed), "utf8")) : undefined;
        const result = await verifyFeedClaim({ claim, feed, requireSignature: Boolean(opts.requireSignature) });
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.ok ? 0 : 1);
    });

program.command("claim-apply")
    .argument("<feed-file>", "ARSS feed JSON file")
    .argument("<claim-file>", "ARSS feed claim JSON file")
    .requiredOption("--out <file>", "output claimed/priced ARSS feed")
    .option("--no-price", "do not convert canonical_text/chunks resources to paid")
    .action((feedFile, claimFile, opts) => {
        const feed = JSON.parse(readFileSync(resolve(feedFile), "utf8"));
        const claim = JSON.parse(readFileSync(resolve(claimFile), "utf8"));
        const out = applyFeedClaim(feed, claim, { price: opts.price !== false });
        writeJson(opts.out, out);
        console.log(`Wrote ${opts.out}`);
    });

program.command("registry-add")
    .argument("<claim-file>", "ARSS feed claim JSON file")
    .option("--feed <file>", "feed file to verify against")
    .option("--registry <dir>", "registry directory", DEFAULT_ARSS_REGISTRY)
    .action(async (claimFile, opts) => {
        const claim = JSON.parse(readFileSync(resolve(claimFile), "utf8"));
        const feed = opts.feed ? JSON.parse(readFileSync(resolve(opts.feed), "utf8")) : undefined;
        const record = await addClaimToRegistry({ claim, feed, registry_dir: opts.registry });
        console.log(JSON.stringify({ added: record.claim.feed_url, claim_hash: record.claim.claim_hash, warnings: record.verification.warnings }, null, 2));
    });

program.command("registry-list")
    .option("--registry <dir>", "registry directory", DEFAULT_ARSS_REGISTRY)
    .action(opts => {
        console.log(JSON.stringify(listRegistryClaims({ registry_dir: opts.registry }).map(record => ({
            feed_url: record.claim.feed_url,
            publisher: record.claim.publisher,
            claim_hash: record.claim.claim_hash,
            signature: record.claim.signature?.address,
            stake: record.claim.stake,
            added_at: record.added_at,
        })), null, 2));
    });

program.command("pay-fetch")
    .argument("<subscription-file>", "subscription manifest")
    .argument("<feed-file>", "ARSS feed JSON file")
    .requiredOption("--item <id>", "item id")
    .requiredOption("--kind <kind>", "resource kind to fetch")
    .requiredOption("--out <file>", "output resource body")
    .option("--receipt-out <file>", "output payment receipt JSON")
    .option("--period-spend <amount>", "already spent this period", "0")
    .option("--relevance <score>", "relevance score", "1")
    .option("--private-key <hex>", "payer private key; defaults to env")
    .option("--dry-run", "plan only; do not fetch/pay")
    .action(async (subscriptionFile, feedFile, opts) => {
        const sub = JSON.parse(readFileSync(resolve(subscriptionFile), "utf8"));
        const feed = JSON.parse(readFileSync(resolve(feedFile), "utf8"));
        const pair = listResources(feed).find(({ item, resource }) => item.id === opts.item && resource.kind === opts.kind);
        if (!pair) throw new Error(`No resource found for item=${opts.item} kind=${opts.kind}`);
        const decision = pair.resource.access === "paid" ? canPayForResource({ resource: pair.resource, subscription: sub, periodSpend: opts.periodSpend, relevance: Number(opts.relevance) }) : { allow: true, reason: "free_resource" };
        if (opts.dryRun) return console.log(JSON.stringify({ resource: pair.resource, decision }, null, 2));
        if (!decision.allow) throw new Error(`Budget policy denied fetch: ${decision.reason}`);
        const { body, settlement } = await fetchResource(pair.resource.url, { privateKey: opts.privateKey, paid: pair.resource.access === "paid" });
        writeText(opts.out, body);
        const receipt = createPaymentReceipt({
            feed_url: feed.feed_url || sub.feed_url,
            item_id: pair.item.id,
            resource_url: pair.resource.url,
            price: pair.resource.price || { amount: "0", protocol: "x402" },
            payer: settlement?.payer,
            tx_hash: settlement?.transaction || settlement?.txHash || settlement?.tx_hash,
            resource_hash: sha256Hex(body),
            rights_snapshot_hash: sha256Hex(pair.item._agent || {}),
        });
        if (opts.receiptOut) writeJson(opts.receiptOut, receipt);
        console.log(JSON.stringify({ wrote: opts.out, receipt: opts.receiptOut || null, settlement: settlement || null }, null, 2));
    });

program.parse(process.argv);

async function readSource(source) {
    if (/^https?:\/\//.test(source)) {
        const res = await fetch(source, { signal: AbortSignal.timeout(30000) });
        if (!res.ok) throw new Error(`GET ${source} failed: ${res.status}`);
        return await res.text();
    }
    return readFileSync(resolve(source), "utf8");
}

async function readJsonSource(source) {
    return JSON.parse(await readSource(source));
}

async function discover(url) {
    const errors = [];
    for (const candidate of discoveryCandidates(url)) {
        try {
            const text = await readSource(candidate);
            const parsed = parseMaybeArss(text, { sourceUrl: candidate });
            return { url: candidate, ...parsed };
        } catch (err) {
            errors.push(`${candidate}: ${err.message}`);
        }
    }
    throw new Error(`No ARSS/RSS/JSON feed discovered. Tried:\n${errors.join("\n")}`);
}

async function discoverDietSource(inputUrl) {
    const errors = [];
    const candidates = await dietFeedCandidates(inputUrl);
    for (const candidate of candidates) {
        try {
            const text = await readSource(candidate);
            const parsed = parseMaybeArss(text, { sourceUrl: candidate });
            return { url: candidate, ...parsed };
        } catch (err) {
            errors.push(`${candidate}: ${err.message}`);
        }
    }
    throw new Error(`No subscribable feed discovered. Tried:\n${errors.join("\n")}`);
}

async function dietFeedCandidates(inputUrl) {
    const candidates = [...discoveryCandidates(inputUrl)];
    let url;
    try { url = new URL(inputUrl); } catch { return candidates; }
    if (/substack\.com$/i.test(url.hostname)) candidates.unshift(`${url.origin}/feed`);
    if (/youtube\.com$/i.test(url.hostname) || /youtu\.be$/i.test(url.hostname)) {
        const channelId = url.pathname.match(/\/channel\/(UC[\w-]+)/)?.[1];
        if (channelId) candidates.unshift(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
    }
    try {
        const html = await readSource(inputUrl);
        for (const href of alternateFeedLinks(html, inputUrl)) candidates.unshift(href);
        const ytChannelId = html.match(/"channelId"\s*:\s*"(UC[\w-]+)"/)?.[1] || html.match(/<meta[^>]+itemprop=["']channelId["'][^>]+content=["'](UC[\w-]+)["']/i)?.[1];
        if (ytChannelId) candidates.unshift(`https://www.youtube.com/feeds/videos.xml?channel_id=${ytChannelId}`);
    } catch {}
    return Array.from(new Set(candidates.map(normaliseUrl)));
}

function alternateFeedLinks(html, baseUrl) {
    const links = [];
    for (const match of String(html).matchAll(/<link\b[^>]*>/gi)) {
        const tag = match[0];
        const rel = attr(tag, "rel");
        const type = attr(tag, "type");
        const href = attr(tag, "href");
        if (!href) continue;
        if (/alternate/i.test(rel) && /(rss|atom|json\+feed|feed)/i.test(type)) links.push(new URL(href, baseUrl).toString());
    }
    return links;
}

function attr(tag, name) {
    return tag.match(new RegExp(`${name}=["']([^"']+)["']`, "i"))?.[1] || "";
}

function slugify(value) {
    const slug = String(value || "source").toLowerCase().replace(/https?:\/\//g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    return slug || "source";
}

function uniqueSourceId(diet, base) {
    const existing = new Set((diet.sources || []).map(source => source.id));
    if (!existing.has(base)) return base;
    let i = 2;
    while (existing.has(`${base}-${i}`)) i++;
    return `${base}-${i}`;
}

function kindForDiet(kind, url) {
    if (/youtube\.com\/feeds\/videos\.xml/i.test(url)) return "youtube";
    if (/substack\.com\/feed/i.test(url)) return "substack";
    if (kind === "arss-json") return "arss";
    if (kind === "atom-feed") return "atom";
    if (kind === "rss-feed") return "rss";
    if (kind === "json-feed") return "json-feed";
    if (kind === "llms-txt") return "llms.txt";
    return kind || "feed";
}

function csv(value) {
    return String(value || "").split(",").map(v => v.trim()).filter(Boolean);
}

function tokenise(value) {
    return String(value || "").toLowerCase().match(/[a-z0-9]{2,}/g) || [];
}

function scoreText(text, terms) {
    const haystack = String(text || "").toLowerCase();
    return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function normaliseUrl(value) {
    try { return new URL(value).toString(); } catch { return value; }
}

async function addUrlToDiet({ url, dietPath, update = true }) {
    const diet = JSON.parse(readFileSync(resolve(dietPath), "utf8"));
    const discovered = await discoverDietSource(url);
    const source = {
        id: slugify(discovered.feed.title || new URL(discovered.url).hostname),
        title: discovered.feed.title || discovered.url,
        url: discovered.url,
        kind: kindForDiet(discovered.kind, discovered.url),
        topics: [],
    };
    const result = importSourcesIntoDiet({ dietPath, feeds: [source], update });
    return { ...result, discovered: { kind: discovered.kind, feed_title: discovered.feed.title, items: discovered.feed.items?.length || 0 } };
}

function importSourcesIntoDiet({ dietPath, feeds, update = true }) {
    const path = resolve(dietPath);
    const diet = JSON.parse(readFileSync(path, "utf8"));
    diet.sources = diet.sources || [];
    const imported = [];
    const skipped = [];
    for (const feed of feeds) {
        const source = { id: feed.id || slugify(feed.title || feed.url), title: feed.title || feed.url, url: feed.url, kind: feed.kind || "feed", topics: feed.topics || [] };
        const existingIndex = diet.sources.findIndex(s => s.id === source.id || normaliseUrl(s.url) === normaliseUrl(source.url));
        if (existingIndex >= 0 && !update) { skipped.push({ id: source.id, reason: "already_exists" }); continue; }
        if (existingIndex >= 0) diet.sources[existingIndex] = { ...diet.sources[existingIndex], ...source };
        else diet.sources.push(source);
        imported.push(source);
    }
    writeJson(path, diet);
    return { imported, skipped, count: imported.length, diet: path };
}

function ensureAgentDiet(dietPath = DEFAULT_AGENT_DIET, registry = DEFAULT_PUBLIC_REGISTRY) {
    const path = resolve(dietPath);
    if (existsFile(path)) return path;
    mkdirSync(dirname(path), { recursive: true });
    writeJson(path, {
        type: "https://arss.dev/context-diet/v0.1",
        name: "local-agent",
        title: "Local agent context diet",
        description: "Sources this agent keeps warm via ARSS.",
        registry,
        default_policy: {
            poll: "PT6H",
            relevance_threshold: 0,
            high_signal_threshold: 0,
            permissions: { summarise: true, quote: "limited", embed: true, store_user_memory: true, train_model: false },
        },
        interests: ["AI", "agents", "models", "research", "developer tooling"],
        sources: [],
    });
    return path;
}

function readJsonMaybe(file, fallback) {
    try { return JSON.parse(readFileSync(resolve(file), "utf8")); } catch { return fallback; }
}

function readJsonl(file) {
    try {
        const text = readFileSync(resolve(file), "utf8").trim();
        return text ? text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)) : [];
    } catch { return []; }
}

function existsFile(file) {
    try { readFileSync(resolve(file)); return true; } catch { return false; }
}

function selectRegistryFeeds(registry, opts) {
    const feeds = registry.feeds || [];
    if (opts.all) return feeds;
    if (opts.category) {
        const wanted = String(opts.category).toLowerCase();
        const category = (registry.categories || []).find(c => [c.id, c.title].some(value => String(value || "").toLowerCase() === wanted));
        if (category?.feed_ids?.length) return feeds.filter(f => category.feed_ids.includes(f.id));
        return feeds.filter(f => String(f.category || "").toLowerCase() === wanted);
    }
    if (opts.feed) {
        const wanted = String(opts.feed).toLowerCase();
        return feeds.filter(f => [f.id, f.title, f.url].some(value => String(value || "").toLowerCase() === wanted));
    }
    return [];
}

function runHeartbeatNow(dietPath) {
    const state = dietPath === DEFAULT_AGENT_DIET ? DEFAULT_AGENT_STATE : "artefacts/arss/context-diet-state.json";
    const memory = dietPath === DEFAULT_AGENT_DIET ? DEFAULT_AGENT_MEMORY : "artefacts/arss/context-memory.jsonl";
    const summary = dietPath === DEFAULT_AGENT_DIET ? DEFAULT_AGENT_SUMMARY : "artefacts/arss/context-diet-summary.json";
    const inbox = dietPath === DEFAULT_AGENT_DIET ? DEFAULT_AGENT_INBOX : "artefacts/arss/agent-inbox.json";
    const result = spawnSync(process.execPath, [join(SCRIPT_DIR, "arss-heartbeat.js"), "--diet", resolve(dietPath), "--state", resolve(state), "--memory", resolve(memory), "--summary", resolve(summary), "--inbox", resolve(inbox), "--format", "json", "--force", "--limit", "8"], { cwd: REPO_ROOT, encoding: "utf8" });
    let stdout = null;
    try { stdout = result.stdout ? JSON.parse(result.stdout) : null; } catch { stdout = result.stdout; }
    return { status: result.status, stdout, stderr: result.stderr || undefined };
}

async function fetchResource(url, { privateKey, paid } = {}) {
    let fetcher = fetch;
    if (paid) {
        const key = privateKey || process.env.ARSS_X402_PAYER_PRIVATE_KEY || process.env.EVM_PRIVATE_KEY;
        if (!key) throw new Error("Paid resource requires payer key. Set ARSS_X402_PAYER_PRIVATE_KEY or pass --private-key.");
        const signer = privateKeyToAccount(key);
        const client = new x402Client();
        client.register("eip155:*", new ExactEvmScheme(signer));
        const httpClient = new x402HTTPClient(client);
        fetcher = wrapFetchWithPayment(fetch, httpClient);
        const res = await fetcher(url, { method: "GET" });
        const body = await res.text();
        if (!res.ok) throw new Error(`GET ${url} failed after x402 attempt: ${res.status} ${body.slice(0, 300)}`);
        let settlement = null;
        try { settlement = httpClient.getPaymentSettleResponse(name => res.headers.get(name)); } catch {}
        return { body, settlement: settlement ? { ...settlement, payer: signer.address } : { payer: signer.address } };
    }
    const res = await fetcher(url, { method: "GET" });
    const body = await res.text();
    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${body.slice(0, 300)}`);
    return { body, settlement: null };
}

function writeJson(file, value) {
    writeText(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(file, value) {
    const out = resolve(file);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, value);
}

function printValidation(result) {
    for (const error of result.errors) console.error(`ERROR ${error}`);
    for (const warning of result.warnings) console.warn(`WARN ${warning}`);
    console.log(result.ok ? "ARSS validate: PASS" : "ARSS validate: FAIL");
}
