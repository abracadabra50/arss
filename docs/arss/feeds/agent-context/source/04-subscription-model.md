# Subscription model

An ARSS subscription is local state: feed URL, subscriber identity, agent identity, budget, permissions, sync policy and local index. The publisher does not need to host a new platform account for basic usage.

The daemon discovers the feed, validates it, pulls free summaries and chunks, plans paid fetches, records receipts and exposes searchable context to the agent over MCP.

The agent asks the MCP server for context. It receives chunks with source, citation, rights and expiry metadata. This keeps protocol mechanics out of the agent prompt and makes compliance testable.
