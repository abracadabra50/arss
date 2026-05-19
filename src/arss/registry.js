import { mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync } from "fs";
import { dirname, resolve, join } from "path";
import { privateKeyToAccount } from "viem/accounts";
import { verifyMessage } from "viem";
import { normalisePayment, priceFeed, sha256Hex, stableStringify, validateArss } from "./arss.js";

export const ARSS_FEED_CLAIM_TYPE = "https://arss.dev/feed-claim/v0.2";
export const DEFAULT_ARSS_REGISTRY = "artefacts/arss/registry";

export function createFeedClaim({
    feed,
    feed_url,
    origin,
    publisher = {},
    payment = {},
    pricing = {},
    proofs = [],
    stake = {},
} = {}) {
    if (!feed_url && !feed?.feed_url) throw new Error("feed_url is required");
    const url = feed_url || feed.feed_url;
    const inferredOrigin = origin || new URL(url).origin;
    const now = new Date().toISOString();
    const claim = {
        type: ARSS_FEED_CLAIM_TYPE,
        feed_url: url,
        origin: inferredOrigin,
        publisher: {
            id: publisher.id || `did:web:${new URL(inferredOrigin).hostname}`,
            name: publisher.name || feed?.title || new URL(inferredOrigin).hostname,
            ...(publisher.url ? { url: publisher.url } : { url: inferredOrigin }),
        },
        proofs: proofs.length ? proofs : [
            { method: "well-known", url: new URL("/.well-known/arss-claim.json", inferredOrigin).toString() },
            { method: "same-origin-feed", url },
        ],
        payment: {
            preferred_protocol: payment.preferred_protocol || "x402",
            accepted: normalisePayment(payment).accepted,
            default_prices: {
                canonical_text: pricing.canonical_text || pricing.canonical || "0.001",
                chunks: pricing.chunks || "0.003",
                archive: pricing.archive || "0.01",
            },
        },
        stake: {
            mode: stake.mode || "none",
            asset: stake.asset || "ARSS",
            amount: stake.amount || "0",
            purpose: stake.purpose || "publisher_claim_anti_spam",
        },
        created_at: now,
        ...(feed ? { feed_hash: hashFeedForClaim(feed) } : {}),
    };
    claim.claim_hash = hashClaim(claim);
    return claim;
}

export async function signFeedClaim(claim, privateKey) {
    if (!privateKey) return claim;
    const account = privateKeyToAccount(privateKey);
    const unsigned = stripSignature(claim);
    const message = claimSigningMessage(unsigned);
    const signature = await account.signMessage({ message });
    return {
        ...unsigned,
        signature: {
            scheme: "eip191",
            address: account.address,
            message_hash: sha256Hex(message),
            signature,
        },
    };
}

export async function verifyFeedClaim({ claim, feed, requireSignature = false } = {}) {
    const errors = [];
    const warnings = [];
    if (!claim || typeof claim !== "object") errors.push("claim must be an object");
    if (claim?.type !== ARSS_FEED_CLAIM_TYPE) errors.push(`claim.type must be ${ARSS_FEED_CLAIM_TYPE}`);
    if (!claim?.feed_url) errors.push("claim.feed_url is required");
    if (!claim?.origin) errors.push("claim.origin is required");
    if (!claim?.publisher?.id) errors.push("claim.publisher.id is required");
    if (!claim?.publisher?.name) errors.push("claim.publisher.name is required");

    if (claim?.feed_url && claim?.origin) {
        const feedOrigin = new URL(claim.feed_url).origin;
        const claimOrigin = new URL(claim.origin).origin;
        if (feedOrigin !== claimOrigin) errors.push(`claim origin ${claimOrigin} does not match feed origin ${feedOrigin}`);
    }

    if (feed) {
        const validation = validateArss(feed);
        if (!validation.ok) errors.push(...validation.errors.map(e => `feed: ${e}`));
        if (feed.feed_url && claim?.feed_url && feed.feed_url !== claim.feed_url) warnings.push(`feed.feed_url (${feed.feed_url}) differs from claim.feed_url (${claim.feed_url})`);
        if (claim?.feed_hash && claim.feed_hash !== hashFeedForClaim(feed)) warnings.push("claim.feed_hash does not match supplied feed; claim may refer to a previous version");
    }

    if (claim?.claim_hash && claim.claim_hash !== hashClaim(stripSignature({ ...claim, claim_hash: undefined }))) {
        warnings.push("claim_hash does not match canonical claim payload; claim may have been edited after creation");
    }

    if (claim?.signature?.scheme === "eip191") {
        try {
            const unsigned = stripSignature(claim);
            const ok = await verifyMessage({ address: claim.signature.address, message: claimSigningMessage(unsigned), signature: claim.signature.signature });
            if (!ok) errors.push("claim signature verification failed");
        } catch (err) {
            errors.push(`claim signature verification error: ${err.message}`);
        }
    } else if (requireSignature) {
        errors.push("claim signature is required");
    } else {
        warnings.push("claim is unsigned; acceptable for local/bootstrap registry only");
    }

    return { ok: errors.length === 0, errors, warnings };
}

export function applyFeedClaim(feed, claim, { price = true } = {}) {
    const out = structuredClone(feed);
    out.feed_url = claim.feed_url || out.feed_url;
    out.home_page_url = out.home_page_url || claim.origin;
    out._agent = out._agent || {};
    out._agent.publisher = claim.publisher;
    out._agent.claim = {
        type: claim.type,
        claim_hash: claim.claim_hash || hashClaim(claim),
        origin: claim.origin,
        proofs: claim.proofs || [],
        ...(claim.signature ? { signature: claim.signature } : {}),
    };
    out._agent.payment = {
        preferred_protocol: claim.payment?.preferred_protocol || "x402",
        accepted: claim.payment?.accepted || [],
    };
    if (!price) return out;
    const accepted = out._agent.payment.accepted?.[0] || {};
    return priceFeed(out, {
        canonical: claim.payment?.default_prices?.canonical_text || "0.001",
        chunks: claim.payment?.default_prices?.chunks || "0.003",
        network: accepted.network || "eip155:8453",
        asset: accepted.asset || "USDC",
        recipient: accepted.recipient || "",
        facilitator: accepted.facilitator || "https://facilitator.x402.org",
    });
}

export async function addClaimToRegistry({ claim, registry_dir = DEFAULT_ARSS_REGISTRY, feed } = {}) {
    const verification = await verifyFeedClaim({ claim, feed });
    if (!verification.ok) {
        const err = new Error(`claim verification failed: ${verification.errors.join("; ")}`);
        err.verification = verification;
        throw err;
    }
    mkdirSync(resolve(registry_dir), { recursive: true });
    const record = { claim, verification, added_at: new Date().toISOString() };
    appendFileSync(join(resolve(registry_dir), "claims.jsonl"), `${JSON.stringify(record)}\n`);
    writeJson(join(resolve(registry_dir), `${safeClaimName(claim)}.json`), record);
    return record;
}

export function listRegistryClaims({ registry_dir = DEFAULT_ARSS_REGISTRY } = {}) {
    const file = join(resolve(registry_dir), "claims.jsonl");
    if (!existsSync(file)) return [];
    return readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}

export function hashFeedForClaim(feed) {
    const clone = structuredClone(feed);
    delete clone._agent?.claim;
    return sha256Hex(stableStringify(clone));
}

export function hashClaim(claim) {
    const clone = stripSignature(claim);
    delete clone.claim_hash;
    return sha256Hex(stableStringify(clone));
}

export function claimSigningMessage(claim) {
    return `ARSS feed claim\n${hashClaim(claim)}\n${claim.feed_url || ""}\n${claim.origin || ""}`;
}

function stripSignature(claim) {
    const clone = structuredClone(claim || {});
    delete clone.signature;
    return clone;
}

function safeClaimName(claim) {
    return String(claim.feed_url || claim.claim_hash || "claim").replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 90) || "claim";
}

function writeJson(path, value) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
