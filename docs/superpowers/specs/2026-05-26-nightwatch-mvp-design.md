# Nightwatch MVP — Design Spec

## Overview

Nightwatch is a language-agnostic AI observability sidecar for local development. You prefix any service command with `nightwatch post --` and it streams all logs to a file, runs AI analysis in the background, and serves a live dashboard at localhost:4000. No changes to your app.

**MVP scope:** Core loop only — spawn + log capture → AI engine → dashboard with live tail + chat.

---

## CLI Commands

```bash
nightwatch post -- <command>           # name defaults to basename(cwd)
nightwatch post --name <n> -- <cmd>    # explicit name override
nightwatch tower                       # start dashboard on :4000, open browser
nightwatch dismiss                     # stop service in current dir (name from cwd)
nightwatch dismiss --name <n>          # explicit
nightwatch roster                      # list active services in terminal
```

Name resolution: `--name` flag → `path.basename(process.cwd())`. No other inference.

---

## Architecture

Two independent long-running processes. No IPC. They communicate only through files on disk.

```
Process 1: nightwatch post
  ├── Spawns child process (inherits env, streams stdio)
  ├── Pipes stdout + stderr → ~/.devwatch/active/<name>/context.log
  └── AI Engine (same process)
        ├── chokidar watches context.log
        ├── Rolling buffer: last 50 lines
        ├── Triggers → OpenRouter call
        └── Appends watchman report → suggestions.md

Process 2: nightwatch tower
  └── Express :4000
        ├── GET /              → public/index.html
        ├── GET /api/services  → active session list
        ├── GET /sse/:n/context     → SSE tail of context.log
        ├── GET /sse/:n/suggestions → SSE tail of suggestions.md
        ├── GET /api/chat/:n   → chat history from chat.jsonl
        └── POST /api/chat/:n  → OpenRouter stream → chat.jsonl + SSE response
```

---

## File Structure

**Runtime data:**
```
~/.devwatch/
├── config.json                          # openrouter_key, model, settings
└── active/
    └── <name>/
        ├── context.log                  # append-only raw log stream
        ├── suggestions.md               # AI watchman reports
        ├── chat.jsonl                   # {ts, role, text} per line
        └── .meta.json                   # {pid, name, command, startedAt}
```

**Source:**
```
nightwatch/
├── bin/nightwatch.js       # CLI entry — commander, delegates to modules
├── src/
│   ├── config.js           # getConfig() / saveConfig()
│   ├── session.js          # createSession() / getActiveSessions() / appendLog() / appendSuggestion()
│   ├── engine.js           # startEngine(name, config)
│   └── dashboard.js        # startDashboard(config)
├── public/
│   └── index.html          # full dashboard UI — vanilla JS + inline CSS
└── package.json
```

---

## Module Contracts

### src/config.js
- `getConfig()` → reads `~/.devwatch/config.json`, returns object with defaults
- `saveConfig(partial)` → merges and writes
- On first run with missing `openrouter_key`: prompt user via readline, save, continue

### src/session.js
- `createSession(name, command)` → mkdir + create empty files + write `.meta.json`
- `getActiveSessions()` → read `~/.devwatch/active/`, parse each `.meta.json`, validate PID liveness with `process.kill(pid, 0)` — skip stale entries (process dead) without deleting them; stale cleanup is V1.1
- `appendLog(name, line)` → `fs.appendFileSync` to `context.log` with timestamp prefix
- `appendSuggestion(name, content)` → append markdown block to `suggestions.md`
- `getSessionPath(name)` → returns `~/.devwatch/active/<name>/`
- `killSession(name)` → read `pid` from `.meta.json`, send `SIGTERM`, catch `ESRCH` if process already dead, remove `~/.devwatch/active/<name>/` directory

### src/engine.js
- `startEngine(name, config)` → starts chokidar watcher on `context.log`, returns `stopFn`
- Rolling buffer: array of last 50 lines, updated on every file change
- Trigger evaluation runs on every new line appended
- 10s cooldown between any two AI calls (prevent spam on error floods)
- On trigger: compress buffer (deduplicate consecutive identical lines) → build prompt → fetch OpenRouter → check severity in response against `config.severity_threshold` → skip `appendSuggestion()` if below threshold

**Trigger array (pluggable):**
```js
const TRIGGERS = [
  { type: 'immediate', pattern: /error|exception|fatal|traceback/i },
  { type: 'immediate', pattern: /5\d\d\s/ },
  { type: 'immediate', pattern: /ECONNREFUSED|ETIMEDOUT/ },
  { type: 'pattern',   check: lines => lines.filter(l => /SELECT/i.test(l)).length > 8 },
  { type: 'pattern',   check: lines => extractMaxMs(lines) > 3000 },
  { type: 'scheduled', intervalMs: null },  // set from config.sweep_interval at startup
]
```

Adding a trigger = push to array. No other changes needed.

Severity filtering: AI response is expected to include `Severity: N/10`. Engine parses this with `/severity:\s*(\d+)/i`. If parsed severity < `config.severity_threshold`, the report is discarded. "All quiet" responses are always discarded (no append).

### src/dashboard.js
- `startDashboard(config)` → starts Express on `config.dashboard_port` (default 4000)
- SSE tail mechanism: on connect, read entire file and emit each line; record file size as `offset`; on `fs.watch` change event, open file, read from `offset` to EOF, split on `\n`, emit each non-empty line as `data: <line>\n\n`, update `offset` to new file size
- Chat POST: build context from last 100 lines of `context.log` + full `suggestions.md` + full `chat.jsonl`; total capped at ~8000 tokens (truncate oldest context.log lines first); stream OpenRouter response; append `{ts, role:'user', text}` and `{ts, role:'ai', text}` to `chat.jsonl`

---

## API Contracts

These are stable — frontend can be replaced with React without changing these.

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/services` | `[{name, startedAt, command}]` |
| GET | `/sse/:name/context` | SSE — existing lines then live tail |
| GET | `/sse/:name/suggestions` | SSE — existing lines then live tail |
| GET | `/api/chat/:name` | `[{ts, role, text}]` |
| POST | `/api/chat/:name` | SSE stream — AI response chunks |

---

## Dashboard UI (public/index.html)

Single HTML file, vanilla JS, inline CSS with GOT dark theme.

**Layout:**
```
┌─────────────┬──────────────────────────────────────┐
│  Sidebar    │  [Ravens Log] [Scrolls] [Counsel]    │
│             ├──────────────────────────────────────┤
│  ● backend  │  <tab content — live tail or chat>   │
│  ● frontend │                                      │
│             │                                      │
│             ├──────────────────────────────────────┤
│             │  [chat input]              [⚔ SEND]  │
└─────────────┴──────────────────────────────────────┘
```

- Sidebar polls `/api/services` every 3s, clicking a service selects it
- Active tab drives which SSE stream is connected
- Chat input always visible; send via button or Enter key
- New log lines auto-scroll to bottom
- GOT color palette: `#0a0e1a` bg, `#f97316` accent, `#818cf8` AI responses

---

## AI Prompt Structure

```
You are a senior engineer watching live dev logs for service "<name>".
Be concise. Only flag real issues. Rate severity 1-10.
If all clear, say "✅ All quiet on the wall." and stop.

=== RECENT LOGS ===
<compressed buffer>
=== END ===
```

**Watchman report format appended to suggestions.md:**
```
---
## ⚔ WATCHMAN REPORT — <name> — <timestamp>
<AI response>
```

---

## Config Schema

```json
{
  "openrouter_key": "sk-or-...",
  "model": "anthropic/claude-sonnet-4-6",
  "sweep_interval": 60,
  "severity_threshold": 6,
  "dashboard_port": 4000
}
```

---

## Dependencies

```json
{
  "commander": "CLI argument parsing",
  "chokidar": "Reliable cross-platform file watching",
  "express": "Dashboard HTTP server",
  "open": "Open browser on nightwatch tower"
}
```

Node 18+ required (native `fetch` for OpenRouter calls).

---

## Out of Scope (MVP)

- `nightwatch patrol` (attach to existing log file) — V1.1, ~30 mins
- Archive on service stop — V1.1, ~30 mins
- Search — V2
- HTTP proxy (the gate) — V3
- Smart redaction — V2
- Middleware snippets — V3

---

## Scalability Notes

- **API contracts are stable** — React frontend replaces `public/index.html` without touching backend
- **Trigger array is pluggable** — new trigger types require no engine refactoring
- **Session module is pure functions** — easy to extend for archive, patrol, team mode
- **File-first design** — plain text, grep-able, works offline, no database migration ever
- **Config is additive** — new fields merge cleanly with `getConfig()` defaults
