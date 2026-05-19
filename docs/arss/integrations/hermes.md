# ARSS + Hermes integration

Hermes has two useful surfaces for ARSS:

1. cron/no-agent jobs for background ingestion;
2. plugin hooks for pre-LLM context injection.

Source docs read:

- `https://hermes-agent.nousresearch.com/docs/user-guide/features/overview`
- `https://hermes-agent.nousresearch.com/docs/user-guide/features/cron`
- `https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks`
- `https://hermes-agent.nousresearch.com/docs/user-guide/features/plugins`

## Relevant Hermes facts

Cron:

- Hermes cron is handled by the gateway daemon.
- Scheduler ticks every 60 seconds.
- Jobs can be recurring or one-shot.
- Jobs can run in `no-agent` mode: script only, stdout delivered verbatim, no LLM.
- Empty stdout means silent tick.
- Non-zero exit or timeout delivers an error alert.
- Cron can deliver to local files, origin chat, or platforms.
- Cron jobs can attach skills, but ARSS ingestion usually should be no-agent.

Hooks/plugins:

- Hermes plugins live under `~/.hermes/plugins/<name>/` with `plugin.yaml` and `__init__.py`.
- Plugins are opt-in via `plugins.enabled`.
- `pre_llm_call` fires once per turn before the tool-calling loop and can return `{"context": "..."}` to prepend context.
- `on_session_start` exists for first-turn setup.
- Gateway hooks can fire on `gateway:startup`, `session:start`, `agent:start`, etc., but plugin hooks are better for CLI + Gateway.

## Best ARSS shape

Hermes should use two layers:

### 1. no-agent cron for ingestion

This keeps content warm without spending LLM tokens.

```bash
hermes cron create "every 1h" \
  --no-agent \
  --script arss-heartbeat.sh \
  --deliver local \
  --name "arss-context-sync"
```

The script should write ARSS memory/inbox and print nothing unless something breaks or high-signal content appears.

### 2. plugin `pre_llm_call` for context injection

A small plugin reads `agent-inbox.json` and injects only the top few relevant items into the next model turn.

This is the key distinction:

```text
cron/no-agent = background ingestion
pre_llm_call = small just-in-time context injection
MCP = explicit search/fetch/pay tools
```

## Product implication

For Hermes, ARSS should ship as:

1. `arss-heartbeat.sh` script;
2. Hermes plugin `arss-context` using `pre_llm_call`;
3. optional MCP server config;
4. one command installer that writes files into `~/.hermes/plugins/` and `~/.hermes/scripts/`.

Do not make Hermes run a full model turn just to poll feeds. That is wasteful and misses the point.
