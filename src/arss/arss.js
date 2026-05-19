import { createHash } from "crypto";
import { readFileSync, readdirSync, statSync } from "fs";
import { basename, extname, join } from "path";

export const ARSS_PROFILE = "https://arss.dev/profile/0.2";
export const ARSS_SUBSCRIPTION_TYPE = "https://arss.dev/subscription/v0.2";
export const ARSS_CAPABILITY_TYPE = "https://arss.dev/capability/v0.2";
export const ARSS_PAYMENT_RECEIPT_TYPE = "https://arss.dev/payment-receipt/v0.2";
export const DEFAULT_PERMISSIONS = {
    summarise: true,
    quote: "limited",
    embed: true,
    store_user_memory: true,
    train_model: false,
};
export const DEFAULT_BUDGET = {
    max_per_item_usdc: "0.005",
    max_per_day_usdc: "0.10",
    max_per_month_usdc: "2.00",
};

export function sha256Hex(value) {
    const input = typeof value === "string" ? value : stableStringify(value);
    return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}

export function stableStringify(value) {
    return JSON.stringify(sortValue(value));
}

function sortValue(value) {
    if (Array.isArray(value)) return value.map(sortValue);
    if (value && typeof value === "object" && value.constructor === Object) {
        return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sortValue(v)]));
    }
    return value;
}

export function createArssFeed({ title, home_page_url, feed_url, description, publisher = {}, payment = {}, items = [] } = {}) {
    if (!title) throw new Error("title is required");
    return {
        version: "https://jsonfeed.org/version/1.1",
        title,
        ...(home_page_url ? { home_page_url } : {}),
        ...(feed_url ? { feed_url } : {}),
        ...(description ? { description } : {}),
        _agent: {
            profile: ARSS_PROFILE,
            publisher: {
                id: publisher.id || (home_page_url ? `did:web:${new URL(home_page_url).hostname}` : undefined),
                name: publisher.name || title,
            },
            license: { default: "summarise_with_attribution" },
            attribution: { required: true, format: "name_url" },
            context: { ttl: "PT24H", memory: "allowed" },
            payment: normalisePayment(payment),
        },
        items,
    };
}

export function normalisePayment(payment = {}) {
    return {
        preferred_protocol: payment.preferred_protocol || "x402",
        accepted: payment.accepted || [{
            protocol: "x402",
            network: payment.network || "eip155:8453",
            asset: payment.asset || "USDC",
            recipient: payment.recipient || "",
            facilitator: payment.facilitator || "https://facilitator.x402.org",
        }],
    };
}

export function validateArss(feed) {
    const errors = [];
    const warnings = [];
    if (!feed || typeof feed !== "object") errors.push("feed must be an object");
    if (feed?.version !== "https://jsonfeed.org/version/1.1") warnings.push("version should be JSON Feed 1.1");
    if (!feed?.title) errors.push("title is required");
    if (!Array.isArray(feed?.items)) errors.push("items array is required");
    if (feed?._agent?.profile !== ARSS_PROFILE) errors.push(`_agent.profile must be ${ARSS_PROFILE}`);
    for (const [idx, item] of (feed?.items || []).entries()) {
        const prefix = `items[${idx}]`;
        if (!item.id) errors.push(`${prefix}.id is required`);
        if (!item.url) warnings.push(`${prefix}.url is recommended`);
        if (!item.content_text && !item.content_html && !item.summary) warnings.push(`${prefix} should include content_text, content_html, or summary`);
        const resources = item._agent?.resources || [];
        if (!Array.isArray(resources)) errors.push(`${prefix}._agent.resources must be an array when present`);
        for (const [ridx, resource] of resources.entries()) {
            const rprefix = `${prefix}._agent.resources[${ridx}]`;
            if (!resource.kind) errors.push(`${rprefix}.kind is required`);
            if (!resource.url) errors.push(`${rprefix}.url is required`);
            if (resource.access === "paid" && !resource.price) errors.push(`${rprefix}.price is required for paid resources`);
            if (resource.price && resource.price.protocol !== "x402") warnings.push(`${rprefix}.price.protocol is not x402; supported but non-reference`);
        }
    }
    return { ok: errors.length === 0, errors, warnings };
}

export function convertRssToArss(xml, { feedUrl, payment = {} } = {}) {
    const channel = between(xml, "channel") || xml;
    const title = textOf(channel, "title") || "Untitled feed";
    const home = textOf(channel, "link") || undefined;
    const description = textOf(channel, "description") || undefined;
    const items = [...channel.matchAll(/<item[\s\S]*?<\/item>/gi)].map((match, idx) => rssItemToArss(match[0], idx, payment));
    return createArssFeed({ title, home_page_url: home, feed_url: feedUrl, description, payment, items });
}

function rssItemToArss(xml, idx, payment = {}) {
    const url = textOf(xml, "link") || textOf(xml, "guid") || `urn:arss:item:${idx}`;
    const summary = stripTags(textOf(xml, "description") || "");
    const content = stripTags(textOf(xml, "content:encoded") || textOf(xml, "encoded") || "");
    return {
        id: textOf(xml, "guid") || url,
        url,
        title: textOf(xml, "title") || url,
        summary: summary || undefined,
        content_text: content || summary || undefined,
        date_published: normaliseDate(textOf(xml, "pubDate")),
        _agent: {
            summary: summary || undefined,
            license: "summarise_with_attribution",
            allowed: ["summarise", "quote_limited", "embed_for_retrieval", "store_user_memory"],
            denied: ["train_foundation_model", "resell_fulltext"],
            attribution: { required: true },
            resources: buildDefaultResources(url, payment),
        },
    };
}

export function buildArssFromMarkdownDir(dir, { title = basename(dir), home_page_url, feed_url, payment = {} } = {}) {
    const files = walk(dir).filter(file => [".md", ".markdown", ".txt"].includes(extname(file).toLowerCase()));
    const items = files.map(file => {
        const raw = readFileSync(file, "utf8");
        const itemTitle = extractTitle(raw) || basename(file, extname(file));
        const rel = file.slice(dir.length).replace(/^\//, "");
        const url = home_page_url ? new URL(rel.replace(/\.(markdown|md|txt)$/i, ".html"), ensureSlash(home_page_url)).toString() : `file://${file}`;
        return {
            id: url,
            url,
            title: itemTitle,
            content_text: raw,
            summary: firstParagraph(raw),
            date_modified: new Date(statSync(file).mtimeMs).toISOString(),
            _agent: {
                summary: firstParagraph(raw),
                canonical_text: { url: home_page_url ? new URL(rel, ensureSlash(home_page_url)).toString() : `file://${file}`, hash: sha256Hex(raw) },
                license: "summarise_with_attribution",
                allowed: ["summarise", "quote_limited", "embed_for_retrieval", "store_user_memory"],
                denied: ["train_foundation_model", "resell_fulltext"],
                resources: buildDefaultResources(url, payment, { textHash: sha256Hex(raw) }),
            },
        };
    });
    return createArssFeed({ title, home_page_url, feed_url, payment, items });
}

export function priceFeed(feed, { canonical = "0.001", chunks = "0.003", network = "eip155:8453", asset = "USDC", recipient = "", facilitator = "https://facilitator.x402.org" } = {}) {
    const priced = structuredClone(feed);
    priced._agent = priced._agent || {};
    priced._agent.payment = normalisePayment({ network, asset, recipient, facilitator });
    priced.items = (priced.items || []).map(item => {
        const resources = item._agent?.resources?.length ? item._agent.resources : buildDefaultResources(item.url || item.id, {});
        return {
            ...item,
            _agent: {
                ...(item._agent || {}),
                resources: resources.map(resource => {
                    if (!["canonical_text", "chunks"].includes(resource.kind)) return resource;
                    const amount = resource.kind === "canonical_text" ? canonical : chunks;
                    return {
                        ...resource,
                        access: "paid",
                        price: { protocol: "x402", network, asset, amount, recipient, facilitator },
                    };
                }),
            },
        };
    });
    return priced;
}

export function createSubscriptionManifest({ feed_url, subscriber, agent = {}, permissions = {}, budget = {}, sync = {} } = {}) {
    if (!feed_url) throw new Error("feed_url is required");
    const now = new Date().toISOString();
    return {
        type: ARSS_SUBSCRIPTION_TYPE,
        feed_url,
        ...(subscriber ? { subscriber } : {}),
        agent: {
            id: agent.id || "did:web:local.agent",
            name: agent.name || "Local Agent",
        },
        permissions: { ...DEFAULT_PERMISSIONS, ...permissions },
        budget: { ...DEFAULT_BUDGET, ...budget },
        sync: { poll: sync.poll || "PT15M", push: sync.push || "none" },
        created_at: now,
        updated_at: now,
    };
}

export function createCapability({ issuer, subscriber, agent, feed_url, scope = ["read", "summarise"], expires, rate_limit, attribution_required = true, signature } = {}) {
    if (!issuer) throw new Error("issuer is required");
    if (!agent) throw new Error("agent is required");
    if (!feed_url) throw new Error("feed_url is required");
    return {
        type: ARSS_CAPABILITY_TYPE,
        issuer,
        ...(subscriber ? { subscriber } : {}),
        agent,
        feed_url,
        scope,
        expires: expires || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        ...(rate_limit ? { rate_limit } : {}),
        attribution_required,
        ...(signature ? { signature } : {}),
    };
}

export function createPaymentReceipt({ feed_url, item_id, resource_url, price = {}, payer, recipient, tx_hash, resource_hash, rights_snapshot_hash } = {}) {
    if (!feed_url) throw new Error("feed_url is required");
    if (!item_id) throw new Error("item_id is required");
    if (!resource_url) throw new Error("resource_url is required");
    return {
        type: ARSS_PAYMENT_RECEIPT_TYPE,
        feed_url,
        item_id,
        resource_url,
        protocol: price.protocol || "x402",
        network: price.network || "eip155:8453",
        asset: price.asset || "USDC",
        amount: price.amount || "0",
        ...(payer ? { payer } : {}),
        recipient: recipient || price.recipient || "",
        ...(tx_hash ? { tx_hash } : {}),
        ...(resource_hash ? { resource_hash } : {}),
        ...(rights_snapshot_hash ? { rights_snapshot_hash } : {}),
        paid_at: new Date().toISOString(),
    };
}

export function listResources(feed, { access, kind } = {}) {
    return (feed.items || []).flatMap(item => (item._agent?.resources || []).map(resource => ({ item, resource })))
        .filter(({ resource }) => !access || resource.access === access)
        .filter(({ resource }) => !kind || resource.kind === kind);
}

export function canPayForResource({ resource, subscription, periodSpend = "0", relevance = 1, threshold = 0.74 } = {}) {
    if (!resource || resource.access !== "paid") return { allow: false, reason: "resource_not_paid" };
    if (!resource.price?.amount) return { allow: false, reason: "missing_price" };
    if (relevance < threshold) return { allow: false, reason: "below_relevance_threshold", relevance, threshold };
    const budget = subscription?.budget || DEFAULT_BUDGET;
    const price = decimalToMicros(resource.price.amount);
    const maxItem = decimalToMicros(budget.max_per_item_usdc || DEFAULT_BUDGET.max_per_item_usdc);
    const maxDay = decimalToMicros(budget.max_per_day_usdc || DEFAULT_BUDGET.max_per_day_usdc);
    const spent = decimalToMicros(periodSpend);
    if (price > maxItem) return { allow: false, reason: "price_exceeds_item_budget", price: resource.price.amount, max: budget.max_per_item_usdc };
    if (spent + price > maxDay) return { allow: false, reason: "price_exceeds_period_budget", price: resource.price.amount, spent: periodSpend, max: budget.max_per_day_usdc };
    return { allow: true, reason: "budget_policy_passed", price: resource.price.amount, relevance, threshold };
}

export function discoveryCandidates(inputUrl) {
    const url = new URL(inputUrl);
    const origin = url.origin;
    return Array.from(new Set([
        inputUrl,
        `${origin}/.well-known/arss.json`,
        `${origin}/arss.json`,
        `${origin}/arss.xml`,
        `${origin}/rss.xml`,
        `${origin}/feed.xml`,
    ]));
}

export function chunkItem(item, { maxChars = 1200, publisher } = {}) {
    const text = item.content_text || item.summary || item._agent?.summary || "";
    const chunks = splitText(text, maxChars);
    return chunks.map((chunk, ordinal) => ({
        id: `${item.id}#chunk-${ordinal}`,
        item_id: item.id,
        ordinal,
        text: chunk,
        summary: item.summary || item._agent?.summary,
        source: {
            url: item.url || item.id,
            title: item.title,
            publisher,
            published_at: item.date_published,
            hash: sha256Hex(chunk),
        },
        rights: {
            license: item._agent?.license || "summarise_with_attribution",
            allowed: item._agent?.allowed || [],
            denied: item._agent?.denied || [],
            attribution_required: item._agent?.attribution?.required !== false,
        },
    }));
}

export function feedChunksJsonl(feed, options = {}) {
    const publisher = options.publisher || feed._agent?.publisher?.name || feed.title;
    return (feed.items || []).flatMap(item => chunkItem(item, { ...options, publisher })).map(chunk => JSON.stringify(chunk)).join("\n") + "\n";
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

export function parseMaybeArss(text, { sourceUrl } = {}) {
    const trimmed = text.trim();
    if (trimmed.startsWith("{")) {
        const json = JSON.parse(trimmed);
        if (json._agent?.profile === ARSS_PROFILE) return { kind: "arss-json", feed: json };
        if (json.version === "https://jsonfeed.org/version/1.1") return { kind: "json-feed", feed: { ...json, _agent: json._agent || createArssFeed({ title: json.title || "JSON Feed", feed_url: sourceUrl })._agent } };
    }
    if (/<rss[\s>]/i.test(trimmed)) return { kind: "rss-feed", feed: convertRssToArss(trimmed, { feedUrl: sourceUrl }) };
    if (/<feed[\s>]/i.test(trimmed)) return { kind: "atom-feed", feed: convertAtomToArss(trimmed, { feedUrl: sourceUrl }) };
    if (looksLikeLlmsTxt(trimmed)) return { kind: "llms-txt", feed: convertLlmsTxtToArss(trimmed, { feedUrl: sourceUrl }) };
    throw new Error("Unsupported ARSS discovery response");
}

export function convertLlmsTxtToArss(markdown, { feedUrl, payment = {} } = {}) {
    const title = extractTitle(markdown) || (feedUrl ? `${new URL(feedUrl).hostname} llms.txt` : "llms.txt");
    const home = feedUrl ? new URL(feedUrl).origin : undefined;
    const links = extractMarkdownLinks(markdown, feedUrl).slice(0, 200);
    const items = links.map((link, idx) => ({
        id: link.url,
        url: link.url,
        title: link.title || link.url,
        summary: link.context || `Documentation link from ${title}`,
        content_text: link.context || link.title || link.url,
        _agent: {
            summary: link.context || undefined,
            license: "summarise_with_attribution",
            allowed: ["summarise", "quote_limited", "embed_for_retrieval", "store_user_memory"],
            denied: ["train_foundation_model", "resell_fulltext"],
            attribution: { required: true },
            resources: buildDefaultResources(link.url, payment),
        },
    }));
    return createArssFeed({ title, home_page_url: home, feed_url: feedUrl, description: firstParagraph(markdown), payment, items });
}

function looksLikeLlmsTxt(text) {
    return /^#\s+/.test(text) && (/https?:\/\//.test(text) || /\[[^\]]+\]\([^)]+\)/.test(text));
}

function extractMarkdownLinks(markdown, baseUrl) {
    const links = [];
    const seen = new Set();
    const lines = markdown.split(/\r?\n/);
    for (const line of lines) {
        for (const match of line.matchAll(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) addLink(match[2], match[1], line);
        for (const match of line.matchAll(/(?<!\()https?:\/\/[^\s)]+/g)) addLink(match[0], match[0], line);
    }
    function addLink(href, title, context) {
        try {
            const url = baseUrl ? new URL(href, baseUrl).toString() : href;
            if (seen.has(url)) return;
            seen.add(url);
            links.push({ url, title: decodeXml(title).trim(), context: stripTags(context.replace(/^[\s*-]+/, "")).slice(0, 800) });
        } catch {}
    }
    return links;
}

export function convertAtomToArss(xml, { feedUrl, payment = {} } = {}) {
    const title = textOf(xml, "title") || "Untitled Atom feed";
    const home = attrOf(xml, "link", "href") || undefined;
    const description = textOf(xml, "subtitle") || undefined;
    const items = [...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi)].map((match, idx) => atomEntryToArss(match[0], idx));
    return createArssFeed({ title, home_page_url: home, feed_url: feedUrl, description, payment, items });
}

function atomEntryToArss(xml, idx) {
    const url = attrOf(xml, "link", "href") || textOf(xml, "id") || `urn:arss:atom:${idx}`;
    const summary = stripTags(textOf(xml, "summary") || textOf(xml, "content") || "");
    return {
        id: textOf(xml, "id") || url,
        url,
        title: textOf(xml, "title") || url,
        summary: summary || undefined,
        content_text: summary || undefined,
        date_published: normaliseDate(textOf(xml, "published") || textOf(xml, "updated")),
        date_modified: normaliseDate(textOf(xml, "updated")),
        _agent: {
            summary: summary || undefined,
            license: "summarise_with_attribution",
            allowed: ["summarise", "quote_limited", "embed_for_retrieval", "store_user_memory"],
            denied: ["train_foundation_model", "resell_fulltext"],
            attribution: { required: true },
            resources: buildDefaultResources(url, {}),
        },
    };
}

function decimalToMicros(value) {
    const [whole, frac = ""] = String(value || "0").split(".");
    return BigInt(whole || "0") * 1000000n + BigInt((frac + "000000").slice(0, 6));
}

function buildDefaultResources(url, payment = {}, { textHash } = {}) {
    if (!url) return [];
    const base = url.replace(/\/$/, "");
    return [
        { kind: "summary", url: `${base}.summary.md`, access: "free" },
        { kind: "canonical_text", url: `${base}.md`, access: "free", ...(textHash ? { hash: textHash } : {}) },
        { kind: "chunks", url: `${base}.chunks.jsonl`, format: "jsonl", access: "free" },
    ].map(resource => resource.access === "paid" ? { ...resource, price: payment } : resource);
}

function walk(dir) {
    return readdirSync(dir).flatMap(name => {
        const file = join(dir, name);
        return statSync(file).isDirectory() ? walk(file) : [file];
    });
}

function ensureSlash(url) { return url.endsWith("/") ? url : `${url}/`; }
function extractTitle(text) { return text.match(/^#\s+(.+)$/m)?.[1]?.trim(); }
function firstParagraph(text) { return text.replace(/^#.*$/gm, "").split(/\n\s*\n/).map(s => s.trim()).find(Boolean)?.slice(0, 500); }
function normaliseDate(value) { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.valueOf()) ? date.toISOString() : undefined; }
function between(xml, tag) { return xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1]; }
function attrOf(xml, tag, attr) {
    const open = xml.match(new RegExp(`<${tag}\\b([^>]*)>`, "i"))?.[1] || "";
    return decodeXml(open.match(new RegExp(`${attr}=["']([^"']+)["']`, "i"))?.[1] || "").trim();
}
function textOf(xml, tag) { return decodeXml(between(xml, tag) || "").trim(); }
function stripTags(value) { return decodeXml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim(); }
function decodeXml(value) {
    return value
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}
