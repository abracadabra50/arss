#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { canPayForResource, createSubscriptionManifest, listResources, validateArss } from "../src/arss/arss.js";
import { DEFAULT_ARSS_STORE, installSubscription, searchStore, syncSubscription } from "../src/arss/store.js";

const storePath = resolve(process.env.ARSS_STORE || "artefacts/arss/subscriptions.json");

const server = new McpServer({ name: "arss", version: "0.2.0" });

server.registerTool("arss_validate", {
    title: "Validate ARSS feed",
    description: "Validate an ARSS JSON Feed profile document.",
    inputSchema: { feed: z.record(z.string(), z.any()) },
}, async ({ feed }) => text(validateArss(feed)));

server.registerTool("arss_subscribe", {
    title: "Subscribe to ARSS feed",
    description: "Create and persist an ARSS subscription manifest with budget policy.",
    inputSchema: {
        feed_url: z.string().url(),
        subscriber: z.string().optional(),
        max_per_item_usdc: z.string().optional(),
        max_per_day_usdc: z.string().optional(),
        max_per_month_usdc: z.string().optional(),
        agent_id: z.string().optional(),
        agent_name: z.string().optional(),
    },
}, async args => {
    const sub = createSubscriptionManifest({
        feed_url: args.feed_url,
        subscriber: args.subscriber,
        agent: { id: args.agent_id || "did:web:local.agent", name: args.agent_name || "Local Agent" },
        budget: {
            ...(args.max_per_item_usdc ? { max_per_item_usdc: args.max_per_item_usdc } : {}),
            ...(args.max_per_day_usdc ? { max_per_day_usdc: args.max_per_day_usdc } : {}),
            ...(args.max_per_month_usdc ? { max_per_month_usdc: args.max_per_month_usdc } : {}),
        },
    });
    const store = readStore();
    store.subscriptions.push(sub);
    writeStore(store);
    return text(sub);
});

server.registerTool("arss_plan_sync", {
    title: "Plan ARSS sync",
    description: "Plan free/paid resource fetches for a feed under a subscription budget.",
    inputSchema: {
        feed: z.record(z.string(), z.any()),
        subscription: z.record(z.string(), z.any()),
        relevance: z.number().optional(),
        period_spend: z.string().optional(),
    },
}, async ({ feed, subscription, relevance = 1, period_spend = "0" }) => {
    const validation = validateArss(feed);
    if (!validation.ok) return text({ ok: false, validation });
    return text({
        ok: true,
        free: listResources(feed, { access: "free" }).map(({ item, resource }) => ({ item_id: item.id, kind: resource.kind, url: resource.url })),
        paid: listResources(feed, { access: "paid" }).map(({ item, resource }) => ({
            item_id: item.id,
            kind: resource.kind,
            url: resource.url,
            price: resource.price,
            decision: canPayForResource({ resource, subscription, relevance, periodSpend: period_spend }),
        })),
    });
});

server.registerTool("arss_install", {
    title: "Install ARSS subscription locally",
    description: "Persist a subscription manifest in the local ARSS store.",
    inputSchema: {
        feed_url: z.string(),
        store_dir: z.string().optional(),
        subscriber: z.string().optional(),
        agent_id: z.string().optional(),
        agent_name: z.string().optional(),
        max_per_item_usdc: z.string().optional(),
        max_per_day_usdc: z.string().optional(),
        max_per_month_usdc: z.string().optional(),
    },
}, async args => text(await installSubscription({
    feed_url: args.feed_url,
    store_dir: args.store_dir || DEFAULT_ARSS_STORE,
    subscriber: args.subscriber,
    agent: { id: args.agent_id || "did:web:local.agent", name: args.agent_name || "Local Agent" },
    budget: {
        ...(args.max_per_item_usdc ? { max_per_item_usdc: args.max_per_item_usdc } : {}),
        ...(args.max_per_day_usdc ? { max_per_day_usdc: args.max_per_day_usdc } : {}),
        ...(args.max_per_month_usdc ? { max_per_month_usdc: args.max_per_month_usdc } : {}),
    },
})));

server.registerTool("arss_pull", {
    title: "Pull ARSS subscription into local context",
    description: "Fetch a subscribed feed, index free/inline chunks, and record receipts.",
    inputSchema: {
        subscription_file: z.string(),
        feed_source: z.string().optional(),
        store_dir: z.string().optional(),
        max_chars: z.number().optional(),
    },
}, async args => {
    const result = await syncSubscription({
        subscription_file: args.subscription_file,
        feed_source: args.feed_source,
        store_dir: args.store_dir || DEFAULT_ARSS_STORE,
        max_chars: args.max_chars || 1200,
    });
    return text({ store: result.dir, feed: result.feed.title, items: result.feed.items.length, chunks: result.chunks.length, paid_resources: result.paid_resources });
});

server.registerTool("arss_search", {
    title: "Search subscribed ARSS context",
    description: "Search the local ARSS store and return rights-aware chunks with citations.",
    inputSchema: {
        query: z.string(),
        store_dir: z.string().optional(),
        limit: z.number().optional(),
    },
}, async args => text(searchStore({ store_dir: args.store_dir || DEFAULT_ARSS_STORE, query: args.query, limit: args.limit || 10 })));

await server.connect(new StdioServerTransport());

function text(value) {
    return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}
function readStore() {
    if (!existsSync(storePath)) return { subscriptions: [] };
    return JSON.parse(readFileSync(storePath, "utf8"));
}
function writeStore(store) {
    mkdirSync(dirname(storePath), { recursive: true });
    writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`);
}
