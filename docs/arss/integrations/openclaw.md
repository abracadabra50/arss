# ARSS + OpenClaw heartbeat integration

OpenClaw is the cleanest fit for ARSS subscriptions because its heartbeat is already a periodic main-session turn.

Source docs read:

- `https://docs.openclaw.ai/gateway/heartbeat`
- `https://docs.openclaw.ai/automation`

## Relevant OpenClaw facts

- Heartbeat runs periodic agent turns in the main session.
- Default cadence is `30m`, or `1h` when Anthropic OAuth/token auth is detected.
- The default heartbeat prompt tells the agent to read `HEARTBEAT.md` if it exists.
- If nothing needs attention, reply `HEARTBEAT_OK`.
- Tool-capable heartbeat runs may use `heartbeat_respond` with `notify: false` or `notify: true`.
- `HEARTBEAT.md` can include structured `tasks:` blocks with independent intervals.
- Only due tasks are included in the heartbeat prompt.
- If no tasks are due, OpenClaw skips the heartbeat run as `reason=no-tasks-due`.
- `lightContext: true` keeps only `HEARTBEAT.md` from bootstrap files.
- `isolatedSession: true` uses a fresh session for cheaper heartbeat runs.
- `target: none` still runs the heartbeat but does not deliver externally.
- Heartbeats defer while cron work is active/queued; `skipWhenBusy` can also defer on subagent/nested lanes.

## Best ARSS shape

Use OpenClaw's `HEARTBEAT.md tasks:` block to trigger ARSS ingestion.

```yaml
tasks:

- name: arss-context-sync
  interval: 1h
  prompt: |
    Run the ARSS heartbeat adapter for my context diet.
    Command:
      npm run arss:heartbeat -- --format text --min-interval-min 60 --limit 5

    Ingest the returned relevant context into your memory or working notes.
    If it returns no relevant context and nothing else needs attention, reply HEARTBEAT_OK.

# Additional instructions

- Do not notify me for routine ARSS ingestion.
- Notify only if ARSS finds genuinely high-signal context or if the sync is broken.
- Preserve citations/source URLs when you later use ARSS context.
```

This gives OpenClaw native due-task handling and avoids paying for every heartbeat tick.

## Recommended OpenClaw config

```js
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        target: "none",
        lightContext: true,
        isolatedSession: true,
        skipWhenBusy: true,
        prompt: "Read HEARTBEAT.md if it exists. Follow it strictly. Do not infer old tasks. If nothing needs attention, reply HEARTBEAT_OK."
      }
    }
  }
}
```

Use `target: "last"` only if you want heartbeat alerts delivered to the last chat. For ARSS, default should be `none` because the goal is automatic ingestion, not notifications.

## Manual wake

OpenClaw supports:

```bash
openclaw system event --text "Run ARSS context sync now" --mode now
```

That can be mapped to an ARSS "sync now" button later.

## Product implication

For OpenClaw, ARSS should ship as:

1. a CLI/daemon: `arss heartbeat`;
2. a `HEARTBEAT.md` snippet;
3. an optional MCP server for search/fetch/pay/cite;
4. later, a ClawHub package that installs the snippet and MCP config.

OpenClaw users already understand heartbeat. Do not sell them another scheduler.
