#!/usr/bin/env node
import express from "express";
import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve } from "path";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { feedChunksJsonl } from "../src/arss/arss.js";

const require = createRequire(import.meta.url);
try { require("dotenv").config({ path: resolve(".env.local") }); require("dotenv").config(); } catch {}

const app = express();
const feedPath = resolve(process.env.ARSS_DEMO_FEED || "docs/arss/examples/example-arss.json");
const feed = JSON.parse(readFileSync(feedPath, "utf8"));
const requirePayment = process.env.ARSS_REQUIRE_PAYMENT === "true";

app.get("/health", (_req, res) => res.json({ ok: true, service: "arss-demo", require_payment: requirePayment }));
app.get("/.well-known/arss.json", (req, res) => res.json(localiseFeed(req)));
app.get("/arss.json", (req, res) => res.json(localiseFeed(req)));

if (requirePayment) app.use(createPaymentMiddleware());

app.get("/arss/agents-need-feeds.summary.md", (_req, res) => {
    res.type("text/markdown").send("# Agents need feeds\n\nAgents need publisher-controlled streams with rights, attribution and payment metadata.\n");
});
app.get("/arss/agents-need-feeds.md", (_req, res) => {
    res.type("text/markdown").send(`# Agents need feeds\n\nRSS let humans subscribe to publisher updates. ARSS lets agents subscribe to context under rights, attribution, budget and payment policy.\n\nThe important primitive is not a feed reader. It is a publisher-agent contract.\n`);
});
app.get("/arss/agents-need-feeds.chunks.jsonl", (_req, res) => {
    res.type("application/x-ndjson").send(feedChunksJsonl(feed));
});

app.use((err, _req, res, _next) => {
    if (err.statusCode === 402) {
        res.setHeader("payment-required", err.paymentRequiredHeader);
        return res.status(402).json(err.paymentRequired);
    }
    res.status(500).json({ error: err.message });
});

const port = Number(process.env.ARSS_PORT || 8797);
app.listen(port, () => console.log(`ARSS demo publisher listening on http://127.0.0.1:${port}`));

function localiseFeed(req) {
    const base = `${req.protocol}://${req.get("host")}`;
    const clone = structuredClone(feed);
    clone.feed_url = `${base}/.well-known/arss.json`;
    clone.home_page_url = base;
    clone.items = clone.items.map(item => ({
        ...item,
        url: `${base}/research/agents-need-feeds`,
        _agent: {
            ...item._agent,
            resources: (item._agent?.resources || []).map(resource => ({
                ...resource,
                url: resource.url.replace("https://example.com", base),
            })),
        },
    }));
    return clone;
}

function createPaymentMiddleware() {
    const network = process.env.ARSS_X402_NETWORK || "eip155:84532";
    const payTo = process.env.ARSS_RECEIVER_ADDRESS || process.env."0x7669edF8E1e395aB78Fb69d4A962cBE7d02973b2";
    const facilitator = new HTTPFacilitatorClient({ url: process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator" });
    const server = new x402ResourceServer(facilitator).register(network, new ExactEvmScheme());
    const accepts = [{ scheme: "exact", price: "$0.001", network, payTo }];
    return paymentMiddleware({
        "GET /arss/agents-need-feeds.md": { accepts, description: "ARSS canonical markdown", mimeType: "text/markdown" },
        "GET /arss/agents-need-feeds.chunks.jsonl": { accepts: [{ ...accepts[0], price: "$0.003" }], description: "ARSS retrieval chunks", mimeType: "application/x-ndjson" },
    }, server);
}
