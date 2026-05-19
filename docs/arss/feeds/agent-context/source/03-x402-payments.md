# x402 payments for agent feeds

Payments are first-class in ARSS. A feed item can expose a free summary and paid resources such as canonical markdown, retrieval chunks, archives, high-frequency updates or commercial licences.

The payment flow is web-native. The agent requests a resource URL. The publisher returns HTTP 402 with x402 payment requirements. The agent's local ARSS daemon checks user budget policy, pays in USDC if allowed, retries the request with payment proof, and stores the returned content with the publisher's rights envelope.

The token, if one exists later, should not be the content currency. Stablecoin pays publishers. A network token can secure directories, indexers, curators and challenge markets.
