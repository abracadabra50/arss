#!/usr/bin/env node
import { createRequire } from "module";
import { spawnSync } from "child_process";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { Command } from "commander";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { buildArssFromMarkdownDir, canPayForResource, createArssFeed, createPaymentReceipt, createSubscriptionManifest, discoveryCandidates, feedChunksJsonl, listResources, parseMaybeArss, priceFeed, sha256Hex, validateArss } from "../src/arss/arss.js";
import { DEFAULT_ARSS_STORE, installSubscription, searchStore, syncSubscription } from "../src/arss/store.js";
import { DEFAULT_ARSS_REGISTRY, addClaimToRegistry, applyFeedClaim, createFeedClaim, listRegistryClaims, signFeedClaim, verifyFeedClaim } from "../src/arss/registry.js";

const require = createRequire(import.meta.url);
try { require("dotenv").config({ path: resolve(".env.local") }); require("dotenv").config(); } catch {}

const program = new Command();
program.name("arss").description("ARSS-Pay publisher CLI").version("0.2.0");

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
    .requiredOption("--title <title>", "feed title")
    .requiredOption("--out <file>", "output feed file")
    .option("--home <url>", "publisher home page URL")
    .option("--feed-url <url>", "public feed URL")
    .option("--recipient <address>", "x402 recipient wallet")
    .action(opts => {
        const feed = createArssFeed({ title: opts.title, home_page_url: opts.home, feed_url: opts.feedUrl, payment: opts, items: [] });
        writeJson(opts.out, feed);
        console.log(`Wrote ${opts.out}`);
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
    .argument("<feed-url>", "ARSS feed URL")
    .requiredOption("--out <file>", "subscription manifest file")
    .option("--subscriber <did>", "subscriber DID/wallet DID")
    .option("--agent-id <id>", "agent identifier", "did:web:local.agent")
    .option("--agent-name <name>", "agent name", "Local Agent")
    .option("--max-item <amount>", "max USDC per item", "0.005")
    .option("--max-day <amount>", "max USDC per day", "0.10")
    .option("--max-month <amount>", "max USDC per month", "2.00")
    .option("--poll <duration>", "poll interval", "PT15M")
    .action((feedUrl, opts) => {
        const sub = createSubscriptionManifest({
            feed_url: feedUrl,
            subscriber: opts.subscriber,
            agent: { id: opts.agentId, name: opts.agentName },
            budget: { max_per_item_usdc: opts.maxItem, max_per_day_usdc: opts.maxDay, max_per_month_usdc: opts.maxMonth },
            sync: { poll: opts.poll, push: "none" },
        });
        writeJson(opts.out, sub);
        console.log(`Wrote ${opts.out}`);
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

function normaliseUrl(value) {
    try { return new URL(value).toString(); } catch { return value; }
}

function runHeartbeatNow(dietPath) {
    const result = spawnSync("npm", ["run", "--silent", "arss:heartbeat", "--", "--diet", dietPath, "--format", "json", "--force", "--limit", "8"], { cwd: resolve("."), encoding: "utf8" });
    return { status: result.status, stdout: result.stdout ? JSON.parse(result.stdout) : null, stderr: result.stderr || undefined };
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
