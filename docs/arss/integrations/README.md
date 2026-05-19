# ARSS agent integrations

ARSS should not depend on agents remembering to call an MCP server.

The integration pattern is:

```text
native scheduler/heartbeat/cron → ARSS heartbeat adapter → native memory/inbox
native pre-LLM/session hook → inject top relevant context
MCP → explicit query/fetch/pay/cite tools
```

## OpenClaw

Use `HEARTBEAT.md tasks:` because OpenClaw natively supports due-only heartbeat tasks.

Files:

- `docs/arss/integrations/openclaw.md`
- `examples/arss-integrations/openclaw/HEARTBEAT.md`

Best install shape:

```text
copy HEARTBEAT.md snippet into workspace
configure heartbeat target none/lightContext/isolatedSession
run ARSS CLI from heartbeat task
```

## Hermes

Use no-agent cron for polling and a plugin `pre_llm_call` hook for injection.

Files:

- `docs/arss/integrations/hermes.md`
- `examples/arss-integrations/hermes-plugin/`

Best install shape:

```text
~/.hermes/scripts/arss-heartbeat.sh       # no-agent cron ingestion
~/.hermes/plugins/arss-context/           # pre_llm_call context injection
optional ARSS MCP server                  # query/fetch/pay/cite
```

## Why not MCP only?

MCP is pull. Subscriptions are push/poll. Automatic ingest needs a runtime loop outside the model request path.
