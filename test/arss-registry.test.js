import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { buildArssFromMarkdownDir, listResources, validateArss } from "../src/arss/arss.js";
import { addClaimToRegistry, applyFeedClaim, createFeedClaim, listRegistryClaims, signFeedClaim, verifyFeedClaim } from "../src/arss/registry.js";

const root = join(tmpdir(), `arss-registry-test-${Date.now()}`);
const source = join(root, "source");
const registry = join(root, "registry");
mkdirSync(source, { recursive: true });
writeFileSync(join(source, "one.md"), "# One\n\nClaimable publisher context for agents.\n");

const feed = buildArssFromMarkdownDir(source, {
    title: "Claimable Feed",
    home_page_url: "https://example.com/",
    feed_url: "https://example.com/.well-known/arss.json",
});
assert(validateArss(feed).ok, "feed validates before claim");

const claim = createFeedClaim({
    feed,
    publisher: { name: "Example Publisher" },
    payment: { recipient: "0x0000000000000000000000000000000000000000", network: "eip155:8453", asset: "USDC" },
    pricing: { canonical_text: "0.002", chunks: "0.004" },
});
const verified = await verifyFeedClaim({ claim, feed });
assert(verified.ok, "unsigned bootstrap claim verifies");
assert(verified.warnings.some(w => w.includes("unsigned")), "unsigned claim warning present");

const claimed = applyFeedClaim(feed, claim);
assert(claimed._agent.publisher.name === "Example Publisher", "publisher applied");
const paid = listResources(claimed, { access: "paid" });
assert(paid.length === 2, "canonical and chunks resources priced");
assert(paid[0].resource.price.protocol === "x402", "x402 price applied");
assert(validateArss(claimed).ok, "claimed feed validates");

const record = await addClaimToRegistry({ claim, feed, registry_dir: registry });
assert(record.claim.claim_hash === claim.claim_hash, "claim added to registry");
assert(listRegistryClaims({ registry_dir: registry }).length === 1, "registry lists claim");

const key = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const signed = await signFeedClaim(claim, key);
const signedVerified = await verifyFeedClaim({ claim: signed, feed, requireSignature: true });
assert(signedVerified.ok, "signed claim verifies");

rmSync(root, { recursive: true, force: true });
console.log("✅ arss registry tests passed");

function assert(condition, message) {
    if (!condition) throw new Error(message);
}
