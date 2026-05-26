# 🏰 NIGHTWATCH
### *"The night is dark and full of bugs."*

> A local AI observability sidecar that watches your dev services in real time, analyzes logs, captures HTTP traffic, and lets you chat with an AI about everything happening in your stack — without changing a single line of your app.

---

## What It Is

Nightwatch is a **language-agnostic AI sidecar** for local development. You wrap any service — Node, Python, Rails, Go, anything — with one command. It:

- Creates a session folder with 3 files per service
- Streams all logs into a context file in real time
- Runs AI analysis in the background and writes insights to a suggestions file
- Lets you open a chat with the AI using the full session as context
- Archives everything when a service stops
- Shows a unified dashboard at `localhost:4000`

No changes to your app. No cloud dependency. No database.

---

## Problem Statement

### The Real Pain

A developer on a modern team runs 3-6 services locally at once — backend API, frontend dev server, database, cache, workers, maybe a third-party mock. Each service spits logs into its own terminal window. Nobody is watching all of them simultaneously. Nobody can.

**The result:**

- A page loads in 80ms so you ship it. You never saw the 23 SQL queries that ran to build it. That N+1 query ships to production and costs you 4x database load at scale.
- A 500 error fires in a background service. You're focused on another window. You find out 20 minutes later when a QA ticket comes in.
- The same bug appears every Tuesday. You fix it every Tuesday. Nobody connects the dots because there's no memory across sessions.
- A new developer joins. They get a cryptic error. They paste it into Slack and wait 20 minutes for a senior to say "oh that's the missing env variable thing."

**The core problem isn't that logs are hard to read. It's that nobody is reading them.**

Developers are focused on building. Watching logs is a context switch they can't afford. So they don't — until something breaks badly enough to demand attention.

### What's Missing

| Gap | Current Reality |
|---|---|
| Passive watching | You have to actively look at logs |
| Multi-service visibility | One terminal window per service, no unified view |
| AI diagnosis | You see the error, not the cause or fix |
| Cross-session memory | Every session starts with zero context |
| HTTP traffic visibility | Logs show outcomes, not full request/response |
| Persistent archive | Terminal history is gone when you close the window |

### Who This Is For

Backend and fullstack developers who:
- Run 3+ local services simultaneously during development
- Have recurring bugs that keep appearing sprint after sprint
- Onboard new developers who get lost in cryptic errors
- Want to catch performance issues before they reach staging

---

## How We Leverage AI

Nightwatch uses AI in three distinct and compounding ways:

### 1. Passive Background Analysis (The Guard)
The AI engine runs as a background daemon, watching every service's context file. It never waits to be asked. It triggers on:
- **Anomalies** — errors, crashes, 5xx responses, connection failures → immediate analysis
- **Patterns** — repeated queries, slow response trends, warning spikes → pattern analysis
- **Scheduled sweeps** — every 60 seconds regardless, a general health check

The AI receives a compressed window of recent logs and diagnoses them like a senior engineer who never sleeps. It writes findings to `suggestions.md` — a permanent, timestamped record of everything it noticed.

**This is the core AI leverage: turning passive log streams into active intelligence without any developer effort.**

### 2. Contextual Chat (The Counsel)
When a developer opens the chat for any service, the AI has full context — every log line, every HTTP request/response, every previous AI insight, the entire chat history — all from the session files. No copy-pasting. No "here's my error, help me."

The developer can ask:
- *"Why is /posts slow?"* → AI sees the 23 SELECT queries in context.log
- *"What caused that crash at 10:44?"* → AI sees the full sequence of events leading to it
- *"Has this error happened before?"* → AI searches the archive across past sessions

**This is AI as a knowledgeable colleague who was watching the whole time — not an assistant you have to bring up to speed.**

### 3. Cross-Session Pattern Memory (The Scribe)
Because every session is archived as plain files, the AI can search across time. When it detects an error, it can check: *"Did this appear in any archived session?"* If yes, it says so — with when, how often, and what fixed it last time.

Over weeks of use, Nightwatch accumulates an institutional memory of your specific codebase's failure patterns. The AI gets more useful the longer you use it, not because the model improves but because the context deepens.

**This is AI as organizational memory — the thing that leaves when your senior engineer quits.**

### What Makes This AI Usage Genuinely Novel
Most AI dev tools are **reactive** — you ask, they answer. Nightwatch is **proactive** — it watches, it notices, it tells you. The distinction is:

- Cursor/ChatGPT: *"Here's my error, what's wrong?"*
- Nightwatch: *"You have a problem. Here's what it is. Here's the fix."*

The AI runs whether you're looking or not. That's the point.

---

## Core Problem It Solves

- Devs run many services locally simultaneously with no unified view
- Logs are scattered across terminal windows nobody is actively watching
- Performance issues (N+1 queries, slow requests) go unnoticed during dev because pages still load fast enough
- No AI context across sessions — institutional knowledge lives in senior engineers' heads
- No single place to see all services, their health, and chat with an AI that has full context

---

## Name & Theme

**Name:** Nightwatch  
**Theme:** Game of Thrones — medieval night guard meets terminal hacker aesthetic  
**Tagline:** *"The night is dark and full of bugs."*

### Terminology Map

| Technical Term | Nightwatch Term |
|---|---|
| Service | Guard Post |
| Start watching | Take the post |
| Stop watching | Dismiss |
| context.log | Ravens log |
| suggestions.md | Watchman's scroll |
| chat.jsonl | The counsel |
| Archive | The crypt |
| Dashboard | The tower |
| AI insight | Watchman's report |
| Critical alert | The wall is breached |
| All clear | All quiet on the wall |
| Config | Standing orders |
| HTTP proxy | The gate |

### Color Palette

```
Background:   #0a0e1a   deep midnight navy
Surface:      #0f1629   panel background
Border:       #1e2d4a   subtle lines
Accent:       #f97316   torch orange (primary)
Text:         #e2e8f0   cool white
Muted:        #64748b   slate grey
Success:      #22c55e   green (all clear)
Warning:      #f59e0b   amber
Danger:       #ef4444   red (critical)
AI response:  #818cf8   soft indigo
```

---

## CLI Commands

```bash
nightwatch post --name backend -- node server.js      # start watching a service
nightwatch patrol --name nginx --file /var/log/...    # attach to existing log file
nightwatch tower                                       # open dashboard
nightwatch roster                                      # list all active watches
nightwatch dismiss --name backend                      # stop watching
nightwatch speak --name backend                        # open chat in terminal
nightwatch scrolls                                     # view archived sessions
nightwatch orders                                      # open config
```

---

## File Structure

```
~/.devwatch/
├── active/
│   ├── backend/
│   │   ├── context.log        ← all raw logs appended here
│   │   ├── suggestions.md     ← AI insights appended here
│   │   └── chat.jsonl         ← chat history
│   ├── frontend/
│   │   ├── context.log
│   │   ├── suggestions.md
│   │   └── chat.jsonl
│   └── redis/
│       └── ...
├── archive/
│   └── backend_2026-05-27_09-23-14/   ← timestamped on archive
│       ├── context.log
│       ├── suggestions.md
│       └── chat.jsonl
└── config.json                         ← standing orders
```

### File Format Decisions

| File | Extension | Reason |
|---|---|---|
| context | `.log` | Plain text, universal, grep-able, tail-able |
| suggestions | `.md` | AI output is naturally markdown (headers, bullets, code blocks) |
| chat | `.jsonl` | Structured, append-friendly, one JSON object per line |

### What Goes in Each File

**context.log** — raw append-only stream
```
[10:42:01] [stdout] GET /posts 200 847ms
[10:42:01] [stderr] Warning: deprecated API used
[10:42:05] [http:req] POST /api/login {"email":"test@x.com"}
[10:42:05] [http:res] 200 {"token":"...","user":{...}} 124ms
[10:42:10] [file:/var/log/nginx/access.log] 127.0.0.1 GET /posts
```

**suggestions.md** — AI insights
```markdown
## ⚠️ N+1 Query Detected — Severity 7
**Time:** 10:42:30

You ran 23 identical SELECT queries on the users table.

**Fix:**
Use eager loading — include the association in the initial query.
```

**chat.jsonl** — conversation history
```json
{"ts":"10:44:01","role":"user","text":"why is /posts slow?"}
{"ts":"10:44:02","role":"ai","text":"Based on your context logs..."}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  nightwatch CLI                      │
│  nightwatch post --name backend -- node server.js    │
└────────┬──────────────────┬───────────────────────┘
         │ spawns            │ watches file
         ▼                   ▼
┌─────────────────┐  ┌──────────────────┐
│  Child Process  │  │   File Watcher   │
│  stdout/stderr  │  │   tail -f mode   │
└────────┬────────┘  └────────┬─────────┘
         └──────────┬─────────┘
                    │ appended to
                    ▼
         ┌──────────────────┐
         │   context.log    │  ← single source of truth per service
         └──────────┬───────┘
                    │ tailed by
         ┌──────────▼───────┐
         │   AI Engine      │  ← background daemon
         │  rolling buffer  │
         │  smart triggers  │
         │  OpenRouter call │
         └──────────┬───────┘
                    │ appends to
         ┌──────────▼───────┐
         │ suggestions.md   │
         └──────────────────┘

         ┌──────────────────┐
         │   chat.jsonl     │  ← written by dashboard server
         └──────────────────┘

         ┌──────────────────────────────────┐
         │   Dashboard  localhost:4000      │
         │  context  │ suggestions │ chat   │
         │  SSE live tail for all 3         │
         └──────────────────────────────────┘
```

---

## HTTP Request/Response Capture

### Decision: Two-mode approach

**Mode 1 — Local Proxy (default, zero integration)**
Run a proxy on port 8888. Dev points their app/client at it.
```
client → localhost:8888 (nightwatch gate) → localhost:3000 (real service)
```
Captures full req/res bodies, appends to context.log. One config change for dev.

**Mode 2 — Middleware snippet (optional, more detail)**
Tiny copy-paste per language:
```javascript
app.use(require('nightwatch-middleware')({ service: 'backend' }))
```
Available for Express, FastAPI, Rails, Django.

### Auto-redaction (critical trust feature)
Before writing to context.log, scan and redact:
- JWT tokens
- API keys (`sk-`, `pk_`, `Bearer `)
- Passwords in request bodies
- Credit card patterns

Replace with `[REDACTED]`. Non-negotiable.

---

## AI Engine

### Smart Triggering (don't send every line)

```javascript
const TRIGGERS = {
  immediate: [                          // fire NOW
    /error|exception|traceback|fatal/i,
    /5\d\d\s/,                         // 5xx HTTP status
    /ECONNREFUSED/,                     // connection failures
    /out of memory/i,
  ],
  pattern: [                            // fire if pattern in window
    lines => countMatches(lines, /SELECT/) > 8,   // N+1 smell
    lines => extractMs(lines) > 3000,              // slow request
    lines => countMatches(lines, /WARN/) > 5,      // warning spike
  ],
  scheduled: 60_000                     // sweep every 60s regardless
}
```

### AI Prompt Structure
```
You are a senior engineer watching live dev logs for service "backend".
Be concise. Only flag real issues. Rate severity 1-10.
If all clear, say "✅ All quiet on the wall." and stop.

=== LAST 30 SECONDS ===
[logs here]
=== END ===
```

### Watchman Report Format

**Healthy:**
```
⚔  WATCHMAN REPORT — backend — 10:42:30
All quiet on the wall. 12 requests, avg 45ms.
```

**Warning:**
```
🔥 WATCHMAN REPORT — backend — 10:43:15
Something stirs. N+1 query on /posts — 23 riders sent for
the same man. Send one raven instead.
Severity: 7/10
```

**Critical:**
```
🚨 THE WALL HAS BEEN BREACHED — backend — 10:44:01
Service crashed. Exit code 1.
ECONNREFUSED 127.0.0.1:5432
Your database is not answering.
Severity: 10/10
```

---

## API & Config

### OpenRouter (decided)
One API key, access to Claude, GPT-4, Gemini, Llama through one endpoint.

```javascript
fetch('https://openrouter.ai/api/v1/chat/completions', {
  headers: { 'Authorization': `Bearer ${config.openrouter_key}` },
  body: JSON.stringify({ model: 'anthropic/claude-sonnet-4-6', ... })
})
```

### config.json (standing orders)
```json
{
  "openrouter_key": "sk-or-...",
  "model": "anthropic/claude-sonnet-4-6",
  "sweep_interval": 60,
  "severity_threshold": 6,
  "auto_redact": ["password", "token", "secret", "key"],
  "dashboard_port": 4000,
  "proxy_port": 8888
}
```

---

## Tech Stack

**Backend & CLI: Node.js** (decided — best for process spawning, file watching, SSE, cross-platform, npm distribution)

**Dashboard Frontend: React + Vite + Tailwind** (decided — component model fits sidebar/log/chat panels naturally; Vite builds to static files Express serves; Tailwind perfect for GOT dark theme via utility classes; no Electron — browser tab at localhost:4000 is sufficient and avoids 400MB bundle)

**Notifications: node-notifier** (desktop alerts when critical issues detected — replaces any need for Electron)

```json
{
  "dependencies": {
    "commander": "CLI argument parsing",
    "chokidar": "Reliable file watching",
    "http-proxy": "HTTP capture proxy",
    "express": "Dashboard server"
  }
}
```

Minimal dependencies by design. Dashboard is built with Vite and served as static files — users never interact with the build step.

### Project Structure
```
nightwatch/
├── bin/
│   └── nightwatch.js      ← CLI entry point
├── src/
│   ├── session.js         ← folder/file management
│   ├── engine.js          ← AI analysis loop
│   ├── proxy.js           ← HTTP capture proxy
│   ├── dashboard.js       ← Express + SSE
│   └── config.js          ← read/write config
├── public/
│   └── dist/               ← Vite build output (served by Express)
├── dashboard/             ← React + Vite + Tailwind source
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Sidebar.jsx      ← service list (active + crypt)
│   │   │   ├── LogPanel.jsx     ← live context.log via SSE
│   │   │   ├── SuggestPanel.jsx ← live suggestions.md via SSE
│   │   │   └── ChatPanel.jsx    ← chat with streaming responses
│   │   └── main.jsx
│   └── vite.config.js
└── package.json
```

---

## Dashboard — The Tower

```
┌─────────────────────────────────────────────────────────┐
│  🏰 NIGHTWATCH                          THE TOWER       │
├──────────────┬──────────────────────────────────────────┤
│  ON THE WALL │  backend                    ● WATCHING   │
│  ● backend   ├──────────────────────────────────────── │
│  ● frontend  │  RAVENS (context) │ SCROLLS (suggest)   │
│  ● redis     │                   │                     │
│              │  GET /posts 200   │ ⚠️ N+1 detected     │
│  IN THE CRYPT│  SELECT users 1   │ 23 queries...       │
│  ○ backend   │  SELECT users 2   │                     │
│    May 26    │                   │ ✅ All quiet         │
│              │      SPEAK TO THE WATCHMAN              │
│              │  You: why is /posts slow?               │
│              │  👁  Because you're waking 23 men...   │
│              │  [send raven...]             ⚔  SEND   │
└──────────────┴──────────────────────────────────────────┘
```

Real-time updates via **SSE (Server-Sent Events)** — no websockets needed.

---


---

## Search — The Seeking Glass

Search is a first-class feature, not an afterthought. Every log line, AI insight, and chat message ever written is searchable.

### Scope Levels

```
Global Search     → ALL services, ALL files, active + archive
Per-Service       → one service's 3 files only
Per-File          → just context.log OR suggestions.md OR chat.jsonl
Active Only       → currently running services
Archive Only      → all past sessions
```

### Query Syntax

```
"ECONNREFUSED"                              plain text, global
service:backend "SELECT *"                  scoped to service
in:suggestions "N+1"                        scoped to file type
severity:8                                  AI insight severity
after:10:30 before:11:00                    time range
date:2026-05-26 "crash"                     specific date
service:backend in:context after:10:00 "error"   combined
```

### Search UI

**Global search bar** — always visible at top of dashboard

```
🔍 [Search all scrolls...              ] [⚔ SEEK]
   [All Services ▾] [All Files ▾] [Date ▾] [Severity ▾]
```

**Results — grouped by service → file → line**

```
┌──────────────────────────────────────────────────────────┐
│ 🔍 "ECONNREFUSED"              23 results, 4 sessions    │
├──────────────────────────────────────────────────────────┤
│ ● backend (active)                            3 matches  │
│   context.log  10:42:01  ECONNREFUSED 127.0.0.1:5432    │
│   context.log  10:44:15  ECONNREFUSED 127.0.0.1:5432    │
│   suggestions  10:44:16  ⚠️ Database unreachable...      │
│                                                          │
│ ○ backend_2026-05-26_09-23 (archive)          8 matches  │
│   context.log  09:31:02  ECONNREFUSED 127.0.0.1:5432    │
│   chat.jsonl   09:35:11  You: why is postgres down?      │
│                09:35:12  AI: Check if the service...     │
└──────────────────────────────────────────────────────────┘
```

Click any result → jump to that line in full context with surrounding lines highlighted.

**Per-service search** — small bar inside each service view, searches only that service's 3 files. Live highlight as you type.

### Technical Implementation

**Line-by-line streaming** — files can be large (50-100MB for a busy day). Never load the whole file into memory.

```javascript
async function* searchFile(filePath, query) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath)
  })
  let lineNum = 0
  for await (const line of rl) {
    lineNum++
    if (matchesQuery(line, query)) {
      yield { line, lineNum, filePath }
    }
  }
}
```

**Archive index** — built when a session is archived. Speeds up global search across large history.

```
archive/backend_2026-05-26/
├── context.log
├── suggestions.md
├── chat.jsonl
└── .index.json     ← built at archive time
```

```json
{
  "errors": [142, 891, 1205],
  "severities": { "8": [203], "9": [891], "10": [1205] },
  "timestamps": { "10:42": 140, "10:43": 890 },
  "terms": { "ECONNREFUSED": [142, 891], "SELECT": [45, 46, 47] }
}
```

Global search checks the index first — only streams the actual file if that session has matches.

### UX Additions

**Recent searches** — last 10 queries in dropdown on focus  
**Saved searches** — star a query, name it: ⭐ "postgres failures"

**Keyboard shortcuts:**
```
Cmd+K      → open global search from anywhere in dashboard
Cmd+F      → search within current service view
Escape     → clear search, return to live view
Tab        → cycle through results
Enter      → jump to first result
```

### What Search Unlocks

- *"Has this error happened before?"* → global search, instant answer across all archives
- *"What did the AI say about N+1 last week?"* → `service:backend in:suggestions "N+1" date:2026-05-20`
- *"Find every time postgres went down this month"* → `ECONNREFUSED` global → shows pattern across time
- *"What did I ask the AI about auth?"* → `in:chat "auth"` → full conversation history searchable

## Features to Build (Prioritized)

### MVP (Ship First)
- [ ] `nightwatch post` — spawn process, create session folder, pipe stdout/stderr to context.log
- [ ] `nightwatch patrol` — attach to existing log file
- [ ] Service stop → archive folder with timestamp
- [ ] AI engine — tail context.log, rolling buffer, smart triggers, OpenRouter call → suggestions.md
- [ ] Dashboard — service list, live tail of context + suggestions via SSE, chat box
- [ ] **Search (MVP)** — global text search across active services, per-service search, results grouped by file

### V2 (Makes It Sticky)
- [ ] **Pattern Memory** — search archives for recurring errors, surface them: "This error appeared 3 times this week"
- [ ] **Archive Search + Indexing** — `.index.json` built at archive time, global search across all past sessions
- [ ] **Saved Searches** — star queries, name them, reuse them
- [ ] **Search syntax** — `service:`, `in:`, `severity:`, `date:`, `after:`, `before:` filters
- [ ] **Morning Brief** — `nightwatch tower` shows yesterday's summary before dashboard loads
- [ ] **Anomaly Timeline** — visual dot-timeline, click any dot to see what happened
- [ ] **Smart Redaction** — auto-redact secrets before writing to context.log
- [ ] **Nightwatch Rules** — user-defined triggers in config (no code required)

### V3 (Makes It Viral)
- [ ] **Postmortem Export** — `nightwatch scrolls backend --export-incident 10:42 10:45` → markdown postmortem
- [ ] **HTTP Proxy (The Gate)** — full req/res capture with zero app changes
- [ ] **Middleware snippets** — Express, FastAPI, Rails, Django
- [ ] **npm publish** as `nightwatch-dev`
- [ ] **Team Mode** — shared folder, multiple devs watch each other's services

---

## Nightwatch Rules (User Config)
```json
{
  "rules": [
    { "if": "query_count > 10", "severity": 8 },
    { "if": "response_time > 2000", "severity": 7 },
    { "if": "text contains 'password'", "action": "redact" },
    { "if": "status >= 500", "severity": 10, "alert": "immediate" }
  ]
}
```

---

## Competitive Landscape

| | Datadog/Splunk | Warp Terminal | **Nightwatch** |
|---|---|---|---|
| Local dev focused | ❌ | ✅ | ✅ |
| Any language/framework | ✅ | ✅ | ✅ |
| Multi-service dashboard | ✅ | ❌ | ✅ |
| Session files + archive | ❌ | ❌ | ✅ |
| Chat with your logs | ❌ | partial | ✅ |
| HTTP req/res capture | ✅ | ❌ | ✅ |
| Free, local, no cloud | ❌ | ❌ | ✅ |
| Zero app changes needed | ❌ | ❌ | ✅ |

**The gap:** Enterprise tools are cloud-based and expensive. Warp requires using Warp as your terminal. Nightwatch wraps *anything*, runs *locally*, costs *nothing* except API calls, and keeps a *permanent searchable archive* of every dev session.

---

## Key Design Principles

1. **Zero coupling** — your app never knows Nightwatch exists
2. **File-first** — plain text files, no database, grep-able forever
3. **Fire and forget** — AI analysis never blocks your app's response
4. **Dev only** — gate everything behind `NODE_ENV=development`
5. **Trust through redaction** — auto-redact secrets, devs adopt what they trust
6. **Minimal dependencies** — 4 npm packages total for the core
7. **One command install** — `npm install -g nightwatch-dev`

---

## Teammate Challenges & Answers

Every question a skeptical engineer will ask — answered.

### 🔴 Fundamental "Why Build This" Attacks

**"Just use Cursor / Claude / ChatGPT — paste your logs there"**
Cursor is reactive — you ask it things manually. Nightwatch is passive — it watches without being asked. You don't paste 4 services worth of logs manually while debugging at 2am. Also Cursor has no memory across sessions and no multi-service view.

**"Datadog / Grafana / Splunk already does this"**
Those are cloud tools costing $500+/month built for production infra teams. Nightwatch is free, local, zero setup, built for the individual developer during active development — before code ever hits staging. Different problem, different audience, different price.

**"I can just tail -f my logs and grep"**
You can. But you can't `grep` across 4 services simultaneously, get AI diagnosis of what you're seeing, or ask it questions. grep tells you what happened. Nightwatch tells you why and what to do.

**"Warp terminal already does AI on logs"**
Warp requires replacing your entire terminal. Nightwatch wraps any terminal, any IDE, any existing workflow. Also Warp is one terminal session — Nightwatch is multi-service with persistent archive and chat context.

**"Nobody will change how they run their services"**
The change is one word — prefix your existing command with `nightwatch post --name backend --`. That's it. Your service runs identically. Nothing about your app changes.

---

### 🟡 Technical Challenges

**"Log noise will make AI useless — too many tokens, too much cost"**
Smart triggering means AI only fires on anomalies or every 60s sweep — not every line. Rolling window compression deduplicates repeated lines before sending. Estimated cost: ~$0.01-0.05 per hour of active development.

**"How do you capture HTTP requests without touching the app?"**
Local proxy on port 8888. Point your client at 8888 instead of 3000. Or use the optional middleware snippet. Neither requires touching app logic.

**"Sensitive data in logs — passwords, tokens, PII"**
Auto-redaction layer before anything hits the context file. JWT tokens, API keys, passwords, credit card patterns all replaced with `[REDACTED]` before writing. Non-negotiable trust feature.

**"What if the service crashes and the session file is incomplete?"**
Append-only writes. Every line is flushed immediately to disk. Process crash doesn't corrupt previous entries. On restart, a new session file is created and old one archived with timestamp.

**"Context window limits — a busy service generates thousands of lines per minute"**
Compression pipeline before every AI call. Deduplicate repeated lines, summarize normal traffic, preserve full detail only for anomalies. Send a compressed snapshot, not raw logs.

**"AI suggestions will be wrong or irrelevant half the time"**
Severity scoring 1-10. Only surface suggestions above threshold (default 6, user-configurable). Wrong suggestions get ignored — the logs are still there and useful regardless of AI quality.

**"OpenRouter dependency — what if it's down or too slow?"**
Nightwatch degrades gracefully. If AI call fails, log the error in suggestions.md and continue. Core functionality — log collection, dashboard, file archive — works completely offline without AI.

---

### 🟠 Adoption & Practicality Challenges

**"Developers won't add another tool to their workflow"**
One `npm install -g`. One command prefix. Opens a browser tab. No accounts, no cloud, no config beyond an API key. Lowest possible adoption friction of any dev tool.

**"This only works well if everyone on the team uses it"**
Valuable for a solo developer too. Running 3+ services on your own machine is already the core use case. Team mode is a v2 feature — you get full value alone on day 1.

**"Archive files will grow huge over time"**
Configurable retention policy. Default: keep last 30 days. User can set 7 days or unlimited. Plain text files compress extremely well — a full day of busy dev logs is typically 1-5MB.

**"What about Windows developers?"**
Node.js is cross-platform. The proxy, file watcher, and dashboard all work on Windows. Path separators handled by Node's `path` module throughout.

**"How is this different from just having a good logging setup in your app?"**
Good app logging requires instrumenting your code. Nightwatch requires zero instrumentation and works across services you don't own — databases, nginx, third-party services, anything that emits stdout.

---

### 🔵 Strategic Challenges

**"Who is the target user exactly?"**
Backend and fullstack developers running 3+ services locally during active development. Most valuable for teams where the same bugs recur across sprint cycles.

**"How do you monetize this?"**
v1 is open source / free — build adoption. v2 team features (shared sessions, team dashboard, org-wide pattern memory) are the SaaS layer.

**"AI is moving fast — won't Cursor just add this natively in 6 months?"**
Possible. But Nightwatch is IDE-agnostic — it's infrastructure, not a plugin. The session archive + pattern memory is a data moat: it gets more valuable the longer you use it.

**"Why would I trust an AI reading all my app's logs?"**
Auto-redaction is built into the write layer, not optional. You can also run a local Ollama model — zero data leaves your machine at all.

---

## Build Order (4 Days to Working Prototype)

**Day 1** — Core session management
- CLI scaffold with commander
- `nightwatch post` spawns process, creates folder, pipes to context.log
- `nightwatch patrol` tails existing file
- Service exit → moves folder to archive with timestamp

**Day 2** — AI Engine
- Tail context.log with chokidar
- Rolling 30s buffer
- Smart triggers (immediate + pattern + scheduled)
- OpenRouter API call → append to suggestions.md

**Day 3** — Dashboard
- Express server
- Service list sidebar (active + archived)
- SSE live tail for context.log and suggestions.md
- Chat box → reads both files → writes to chat.jsonl → streams response

**Day 4** — HTTP Proxy + Polish
- http-proxy on port 8888
- Capture req/res, auto-redact, append to context.log
- GOT theme applied to terminal output and dashboard
- ASCII art banner on startup

---

*Built for developers who refuse to be surprised by their own code.*
