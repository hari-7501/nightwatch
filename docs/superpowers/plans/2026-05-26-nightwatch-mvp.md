# Nightwatch MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working AI observability sidecar — `nightwatch post -- <cmd>` streams logs + AI analysis, `nightwatch tower` opens a live dashboard with chat.

**Architecture:** Two independent processes communicate only via files in `~/.devwatch/`. `nightwatch post` spawns the target service, pipes its stdout/stderr to `context.log`, and runs the AI engine in the same process. `nightwatch tower` runs an Express server that tails those files over SSE and serves a vanilla JS dashboard.

**Tech Stack:** Node.js 18+, CommonJS, commander, chokidar v3, express, open. Native `fetch` for OpenRouter. No build step — single `public/index.html` served as static file.

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies, bin entry point |
| `src/config.js` | Read/write `~/.devwatch/config.json`, prompt for API key on first run |
| `src/session.js` | Create/read/kill `~/.devwatch/active/<name>/` sessions |
| `src/engine.js` | Watch `context.log`, evaluate triggers, call OpenRouter, append to `suggestions.md` |
| `src/dashboard.js` | Express server — static files, `/api/services`, SSE tails, chat POST |
| `public/index.html` | Full dashboard UI — vanilla JS, GOT dark theme, tabbed layout |
| `bin/nightwatch.js` | CLI entry — commander wiring `post`, `tower`, `dismiss`, `roster` |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `bin/nightwatch.js` (empty stub)
- Create: `src/config.js`, `src/session.js`, `src/engine.js`, `src/dashboard.js` (empty stubs)
- Create: `public/index.html` (empty stub)
- Create: `tests/config.test.js`, `tests/session.test.js`, `tests/engine.test.js`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p bin src public tests
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "nightwatch",
  "version": "0.1.0",
  "description": "AI observability sidecar for local development",
  "bin": {
    "nightwatch": "./bin/nightwatch.js"
  },
  "scripts": {
    "test": "node --test tests/"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "chokidar": "^3.6.0",
    "express": "^4.19.0",
    "open": "^9.1.0"
  }
}
```

Note: `open` v9 is the last CommonJS-compatible version. chokidar v3 is CommonJS-compatible.

- [ ] **Step 3: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, 4 packages installed.

- [ ] **Step 4: Create empty stubs for all source files**

`bin/nightwatch.js` — first line only:
```js
#!/usr/bin/env node
```

`src/config.js`, `src/session.js`, `src/engine.js`, `src/dashboard.js` — each:
```js
// stub
```

`public/index.html` — stub:
```html
<!DOCTYPE html><html><body>stub</body></html>
```

- [ ] **Step 5: Make bin executable and verify**

```bash
chmod +x bin/nightwatch.js
node bin/nightwatch.js
```

Expected: no output, exits 0.

- [ ] **Step 6: Create .gitignore**

```
node_modules/
.devwatch/
.superpowers/
*.log
```

Save as `.gitignore` in project root.

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "feat: project scaffold — nightwatch MVP"
```

---

## Task 2: config.js

**Files:**
- Write: `src/config.js`
- Write: `tests/config.test.js`

- [ ] **Step 1: Write failing tests**

`tests/config.test.js`:
```js
const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

// Override home dir for tests
const TEST_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-test-'))
process.env.DEVWATCH_DIR_OVERRIDE = path.join(TEST_HOME, '.devwatch')

const { getConfig, saveConfig } = require('../src/config')

test('getConfig returns defaults when no file exists', () => {
  const config = getConfig()
  assert.strictEqual(config.model, 'anthropic/claude-sonnet-4-6')
  assert.strictEqual(config.sweep_interval, 60)
  assert.strictEqual(config.severity_threshold, 6)
  assert.strictEqual(config.dashboard_port, 4000)
})

test('saveConfig and getConfig round-trip', () => {
  saveConfig({ openrouter_key: 'sk-test-123' })
  const config = getConfig()
  assert.strictEqual(config.openrouter_key, 'sk-test-123')
  assert.strictEqual(config.model, 'anthropic/claude-sonnet-4-6') // default preserved
})

test('saveConfig merges without losing existing keys', () => {
  saveConfig({ openrouter_key: 'sk-test-123' })
  saveConfig({ dashboard_port: 5000 })
  const config = getConfig()
  assert.strictEqual(config.openrouter_key, 'sk-test-123')
  assert.strictEqual(config.dashboard_port, 5000)
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
node --test tests/config.test.js
```

Expected: error — `getConfig` not a function (module is stub)

- [ ] **Step 3: Write src/config.js**

```js
const fs = require('fs')
const path = require('path')
const os = require('os')
const readline = require('readline')

const DEVWATCH_DIR = process.env.DEVWATCH_DIR_OVERRIDE || path.join(os.homedir(), '.devwatch')
const CONFIG_PATH = path.join(DEVWATCH_DIR, 'config.json')

const DEFAULTS = {
  model: 'anthropic/claude-sonnet-4-6',
  sweep_interval: 60,
  severity_threshold: 6,
  dashboard_port: 4000,
}

function getConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return { ...DEFAULTS }
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) }
  } catch {
    return { ...DEFAULTS }
  }
}

function saveConfig(partial) {
  fs.mkdirSync(DEVWATCH_DIR, { recursive: true })
  const current = getConfig()
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ ...current, ...partial }, null, 2))
}

async function ensureApiKey() {
  const config = getConfig()
  if (config.openrouter_key) return config
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question('\n🏰 Enter your OpenRouter API key: ', key => {
      rl.close()
      saveConfig({ openrouter_key: key.trim() })
      resolve(getConfig())
    })
  })
}

module.exports = { getConfig, saveConfig, ensureApiKey, DEVWATCH_DIR }
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
node --test tests/config.test.js
```

Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/config.js tests/config.test.js
git commit -m "feat: config module — read/write ~/.devwatch/config.json"
```

---

## Task 3: session.js

**Files:**
- Write: `src/session.js`
- Write: `tests/session.test.js`

- [ ] **Step 1: Write failing tests**

`tests/session.test.js`:
```js
const { test } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')

const TEST_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-sess-'))
process.env.DEVWATCH_DIR_OVERRIDE = path.join(TEST_HOME, '.devwatch')

const { createSession, getActiveSessions, appendLog, appendSuggestion, getSessionPath, killSession } = require('../src/session')

test('createSession creates directory and files', () => {
  createSession('test-svc', 'node server.js')
  const dir = getSessionPath('test-svc')
  assert.ok(fs.existsSync(path.join(dir, 'context.log')))
  assert.ok(fs.existsSync(path.join(dir, 'suggestions.md')))
  assert.ok(fs.existsSync(path.join(dir, 'chat.jsonl')))
  const meta = JSON.parse(fs.readFileSync(path.join(dir, '.meta.json'), 'utf8'))
  assert.strictEqual(meta.name, 'test-svc')
  assert.strictEqual(meta.command, 'node server.js')
})

test('appendLog writes timestamped line to context.log', () => {
  appendLog('test-svc', '[stdout] Hello world')
  const content = fs.readFileSync(path.join(getSessionPath('test-svc'), 'context.log'), 'utf8')
  assert.ok(content.includes('[stdout] Hello world'))
})

test('appendSuggestion writes markdown block to suggestions.md', () => {
  appendSuggestion('test-svc', 'N+1 query detected. Severity: 7/10')
  const content = fs.readFileSync(path.join(getSessionPath('test-svc'), 'suggestions.md'), 'utf8')
  assert.ok(content.includes('WATCHMAN REPORT'))
  assert.ok(content.includes('N+1 query detected'))
})

test('getActiveSessions returns sessions with live PIDs', () => {
  // Current process PID is always live
  const dir = getSessionPath('test-svc')
  const meta = JSON.parse(fs.readFileSync(path.join(dir, '.meta.json'), 'utf8'))
  meta.pid = process.pid
  fs.writeFileSync(path.join(dir, '.meta.json'), JSON.stringify(meta))

  const sessions = getActiveSessions()
  assert.ok(sessions.some(s => s.name === 'test-svc'))
})

test('getActiveSessions skips stale PIDs', () => {
  createSession('stale-svc', 'node dead.js')
  const dir = getSessionPath('stale-svc')
  const meta = JSON.parse(fs.readFileSync(path.join(dir, '.meta.json'), 'utf8'))
  meta.pid = 999999999 // guaranteed non-existent
  fs.writeFileSync(path.join(dir, '.meta.json'), JSON.stringify(meta))

  const sessions = getActiveSessions()
  assert.ok(!sessions.some(s => s.name === 'stale-svc'))
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
node --test tests/session.test.js
```

Expected: error — module is stub.

- [ ] **Step 3: Write src/session.js**

```js
const fs = require('fs')
const path = require('path')
const { DEVWATCH_DIR } = require('./config')

const ACTIVE_DIR = path.join(DEVWATCH_DIR, 'active')

function getSessionPath(name) {
  return path.join(ACTIVE_DIR, name)
}

function createSession(name, command) {
  const dir = getSessionPath(name)
  fs.mkdirSync(dir, { recursive: true })
  for (const f of ['context.log', 'suggestions.md', 'chat.jsonl']) {
    const fp = path.join(dir, f)
    if (!fs.existsSync(fp)) fs.writeFileSync(fp, '')
  }
  fs.writeFileSync(path.join(dir, '.meta.json'), JSON.stringify({
    name,
    command,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  }, null, 2))
}

function getActiveSessions() {
  if (!fs.existsSync(ACTIVE_DIR)) return []
  return fs.readdirSync(ACTIVE_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .reduce((acc, d) => {
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(ACTIVE_DIR, d.name, '.meta.json'), 'utf8'))
        try {
          process.kill(meta.pid, 0) // throws if PID is dead
          acc.push(meta)
        } catch { /* stale PID — skip, cleanup is V1.1 */ }
      } catch { /* malformed meta — skip */ }
      return acc
    }, [])
}

function appendLog(name, line) {
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false })
  fs.appendFileSync(path.join(getSessionPath(name), 'context.log'), `[${ts}] ${line}\n`)
}

function appendSuggestion(name, content) {
  const ts = new Date().toISOString()
  fs.appendFileSync(
    path.join(getSessionPath(name), 'suggestions.md'),
    `\n---\n## ⚔ WATCHMAN REPORT — ${name} — ${ts}\n${content}\n`
  )
}

function killSession(name) {
  const metaPath = path.join(getSessionPath(name), '.meta.json')
  if (fs.existsSync(metaPath)) {
    try {
      const { pid } = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
      process.kill(pid, 'SIGTERM')
    } catch (e) {
      if (e.code !== 'ESRCH') throw e
    }
  }
  fs.rmSync(getSessionPath(name), { recursive: true, force: true })
}

module.exports = { createSession, getActiveSessions, appendLog, appendSuggestion, getSessionPath, killSession, ACTIVE_DIR }
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
node --test tests/session.test.js
```

Expected: 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/session.js tests/session.test.js
git commit -m "feat: session module — manage ~/.devwatch/active/ sessions"
```

---

## Task 4: engine.js

**Files:**
- Write: `src/engine.js`
- Write: `tests/engine.test.js`

- [ ] **Step 1: Write failing tests for trigger logic**

`tests/engine.test.js`:
```js
const { test } = require('node:test')
const assert = require('node:assert')

// Test trigger matching in isolation — import only the helpers
const { TRIGGERS, extractMaxMs, parseSeverity } = require('../src/engine')

test('extractMaxMs parses milliseconds from log lines', () => {
  const lines = ['GET /posts 200 847ms', 'GET /users 200 45ms', 'normal log line']
  assert.strictEqual(extractMaxMs(lines), 847)
})

test('extractMaxMs returns 0 when no ms values', () => {
  assert.strictEqual(extractMaxMs(['no timing here']), 0)
})

test('parseSeverity extracts number from AI response', () => {
  assert.strictEqual(parseSeverity('This is bad. Severity: 8/10'), 8)
  assert.strictEqual(parseSeverity('severity: 3'), 3)
  assert.strictEqual(parseSeverity('All quiet on the wall.'), 0)
})

test('immediate triggers match error patterns', () => {
  const errorTrigger = TRIGGERS.find(t => t.type === 'immediate' && t.pattern?.source.includes('error'))
  assert.ok(errorTrigger.pattern.test('Error: something went wrong'))
  assert.ok(errorTrigger.pattern.test('FATAL: out of memory'))
  assert.ok(!errorTrigger.pattern.test('GET /posts 200 45ms'))
})

test('pattern trigger fires on N+1 query smell', () => {
  const n1Trigger = TRIGGERS.find(t => t.type === 'pattern' && t.check)
  const lines = Array(9).fill('SELECT * FROM users WHERE id = 1')
  assert.ok(n1Trigger.check(lines))
  assert.ok(!n1Trigger.check(['SELECT * FROM users']))
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
node --test tests/engine.test.js
```

Expected: error — module is stub.

- [ ] **Step 3: Write src/engine.js**

```js
const fs = require('fs')
const path = require('path')
const chokidar = require('chokidar')
const { appendSuggestion, getSessionPath } = require('./session')

function extractMaxMs(lines) {
  let max = 0
  for (const line of lines) {
    const m = line.match(/(\d+)ms/)
    if (m && parseInt(m[1]) > max) max = parseInt(m[1])
  }
  return max
}

function parseSeverity(text) {
  const m = text.match(/severity:\s*(\d+)/i)
  return m ? parseInt(m[1]) : 0
}

const TRIGGERS = [
  { type: 'immediate', pattern: /error|exception|fatal|traceback/i },
  { type: 'immediate', pattern: /5\d\d\s/ },
  { type: 'immediate', pattern: /ECONNREFUSED|ETIMEDOUT/ },
  { type: 'pattern',   check: lines => lines.filter(l => /SELECT/i.test(l)).length > 8 },
  { type: 'pattern',   check: lines => extractMaxMs(lines) > 3000 },
  { type: 'scheduled', intervalMs: null }, // set from config.sweep_interval at startup
]

async function callOpenRouter(config, messages) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.openrouter_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: config.model, messages }),
  })
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

function buildMessages(name, buffer) {
  const compressed = buffer.reduce((acc, line) => {
    if (!acc.length || acc[acc.length - 1] !== line) acc.push(line)
    return acc
  }, []).join('\n')
  return [
    {
      role: 'system',
      content: `You are a senior engineer watching live dev logs for service "${name}". Be concise. Only flag real issues. Rate severity 1-10 like "Severity: 7/10". If all clear, say "✅ All quiet on the wall." and stop.`,
    },
    { role: 'user', content: `=== RECENT LOGS ===\n${compressed}\n=== END ===` },
  ]
}

function startEngine(name, config) {
  const buffer = []
  let offset = 0
  let lastTriggerTime = 0
  const COOLDOWN_MS = 10_000
  const contextPath = path.join(getSessionPath(name), 'context.log')

  async function runAnalysis() {
    const now = Date.now()
    if (now - lastTriggerTime < COOLDOWN_MS || !buffer.length) return
    lastTriggerTime = now
    try {
      const response = await callOpenRouter(config, buildMessages(name, buffer))
      if (!response || response.includes('All quiet on the wall')) return
      const severity = parseSeverity(response)
      if (severity > 0 && severity < config.severity_threshold) return
      appendSuggestion(name, response)
    } catch (e) {
      appendSuggestion(name, `⚠️ Watchman error: ${e.message}`)
    }
  }

  // Initialize offset from current file size
  try { offset = fs.statSync(contextPath).size } catch { offset = 0 }

  const watcher = chokidar.watch(contextPath, { persistent: true, ignoreInitial: true })

  watcher.on('change', () => {
    try {
      const stat = fs.statSync(contextPath)
      if (stat.size <= offset) return
      const fd = fs.openSync(contextPath, 'r')
      const buf = Buffer.alloc(stat.size - offset)
      fs.readSync(fd, buf, 0, buf.length, offset)
      fs.closeSync(fd)
      offset = stat.size

      const newLines = buf.toString().split('\n').filter(Boolean)
      for (const line of newLines) {
        buffer.push(line)
        if (buffer.length > 50) buffer.shift()

        for (const t of TRIGGERS) {
          if (t.type === 'immediate' && t.pattern.test(line)) {
            runAnalysis()
            return
          }
        }
      }

      for (const t of TRIGGERS) {
        if (t.type === 'pattern' && t.check(buffer)) {
          runAnalysis()
          return
        }
      }
    } catch { /* file read error — ignore */ }
  })

  const intervalMs = (config.sweep_interval || 60) * 1000
  const sweepTimer = setInterval(runAnalysis, intervalMs)

  return () => {
    watcher.close()
    clearInterval(sweepTimer)
  }
}

module.exports = { startEngine, TRIGGERS, extractMaxMs, parseSeverity }
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
node --test tests/engine.test.js
```

Expected: 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine.js tests/engine.test.js
git commit -m "feat: engine module — AI trigger loop with OpenRouter"
```

---

## Task 5: dashboard.js

**Files:**
- Write: `src/dashboard.js`

No unit tests here — this is an Express server. Smoke-tested in Task 8.

- [ ] **Step 1: Write src/dashboard.js**

```js
const express = require('express')
const fs = require('fs')
const path = require('path')
const { getActiveSessions, getSessionPath } = require('./session')

function tailFile(filePath, res) {
  let offset = 0
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    for (const line of content.split('\n').filter(Boolean)) {
      res.write(`data: ${JSON.stringify(line)}\n\n`)
    }
    offset = fs.statSync(filePath).size
  } catch { /* file may not exist yet */ }

  const watcher = fs.watch(filePath, () => {
    try {
      const stat = fs.statSync(filePath)
      if (stat.size <= offset) return
      const fd = fs.openSync(filePath, 'r')
      const buf = Buffer.alloc(stat.size - offset)
      fs.readSync(fd, buf, 0, buf.length, offset)
      fs.closeSync(fd)
      offset = stat.size
      for (const line of buf.toString().split('\n').filter(Boolean)) {
        res.write(`data: ${JSON.stringify(line)}\n\n`)
      }
    } catch { /* ignore */ }
  })

  res.on('close', () => { try { watcher.close() } catch { } })
}

async function streamOpenRouter(config, messages, onChunk) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.openrouter_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: config.model, messages, stream: true }),
  })
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    for (const line of decoder.decode(value).split('\n')) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
      try {
        const text = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content || ''
        if (text) { full += text; onChunk(text) }
      } catch { /* malformed chunk */ }
    }
  }
  return full
}

function startDashboard(config) {
  const app = express()
  app.use(express.json())
  app.use(express.static(path.join(__dirname, '../public')))

  app.get('/api/services', (_req, res) => res.json(getActiveSessions()))

  function sseRoute(fileKey) {
    return (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders()
      tailFile(path.join(getSessionPath(req.params.name), fileKey), res)
    }
  }

  app.get('/sse/:name/context', sseRoute('context.log'))
  app.get('/sse/:name/suggestions', sseRoute('suggestions.md'))

  app.get('/api/chat/:name', (req, res) => {
    try {
      const lines = fs.readFileSync(path.join(getSessionPath(req.params.name), 'chat.jsonl'), 'utf8')
        .split('\n').filter(Boolean)
      res.json(lines.map(l => JSON.parse(l)))
    } catch { res.json([]) }
  })

  app.post('/api/chat/:name', async (req, res) => {
    const { name } = req.params
    const { text } = req.body
    const sessionPath = getSessionPath(name)
    const chatPath = path.join(sessionPath, 'chat.jsonl')

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    const readFile = (f, fallback = '') => {
      try { return fs.readFileSync(path.join(sessionPath, f), 'utf8') }
      catch { return fallback }
    }

    const contextLines = readFile('context.log').split('\n').filter(Boolean).slice(-100).join('\n')
    const suggestions = readFile('suggestions.md')
    const history = readFile('chat.jsonl').split('\n').filter(Boolean).map(l => {
      try { return JSON.parse(l) } catch { return null }
    }).filter(Boolean)

    fs.appendFileSync(chatPath, JSON.stringify({ ts: new Date().toISOString(), role: 'user', text }) + '\n')

    const messages = [
      {
        role: 'system',
        content: `You are a senior engineer helping debug service "${name}". You have full context of its logs and AI analysis.\n\n=== RECENT LOGS ===\n${contextLines}\n\n=== AI ANALYSIS ===\n${suggestions}`,
      },
      ...history.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
      { role: 'user', content: text },
    ]

    try {
      const full = await streamOpenRouter(config, messages, chunk => {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`)
      })
      fs.appendFileSync(chatPath, JSON.stringify({ ts: new Date().toISOString(), role: 'ai', text: full }) + '\n')
      res.write('data: [DONE]\n\n')
    } catch (e) {
      res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`)
    }
    res.end()
  })

  const port = config.dashboard_port || 4000
  app.listen(port, () => console.log(`🏰 The Tower is watching at http://localhost:${port}`))
}

module.exports = { startDashboard }
```

- [ ] **Step 2: Verify module loads without errors**

```bash
node -e "require('./src/dashboard')"
```

Expected: no output, exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/dashboard.js
git commit -m "feat: dashboard module — Express + SSE tails + chat API"
```

---

## Task 6: Dashboard UI (public/index.html)

**Files:**
- Write: `public/index.html`

Single self-contained HTML file. Vanilla JS. No external dependencies except fonts via CDN.

- [ ] **Step 1: Write public/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🏰 Nightwatch — The Tower</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:       #0a0e1a;
    --surface:  #0f1629;
    --border:   #1e2d4a;
    --accent:   #f97316;
    --text:     #e2e8f0;
    --muted:    #64748b;
    --success:  #22c55e;
    --warning:  #f59e0b;
    --danger:   #ef4444;
    --ai:       #818cf8;
  }
  body { background: var(--bg); color: var(--text); font-family: 'Courier New', monospace; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
  
  /* Header */
  .header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 0 1rem; height: 48px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
  .header-title { color: var(--accent); font-weight: bold; font-size: 1rem; letter-spacing: 2px; }
  .header-sub { color: var(--muted); font-size: 0.75rem; letter-spacing: 1px; }

  /* Layout */
  .main { display: flex; flex: 1; overflow: hidden; }
  
  /* Sidebar */
  .sidebar { width: 180px; background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; flex-shrink: 0; overflow-y: auto; }
  .sidebar-section { padding: 0.5rem 0; }
  .sidebar-label { padding: 0.4rem 0.75rem; color: var(--muted); font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; }
  .service-item { padding: 0.5rem 0.75rem; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; gap: 0.5rem; border-left: 2px solid transparent; transition: background 0.15s; }
  .service-item:hover { background: var(--border); }
  .service-item.active { background: rgba(249,115,22,0.1); border-left-color: var(--accent); color: var(--text); }
  .service-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--success); flex-shrink: 0; }
  .service-dot.dead { background: var(--muted); }
  .no-services { padding: 1rem 0.75rem; color: var(--muted); font-size: 0.75rem; line-height: 1.5; }

  /* Content area */
  .content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .empty-state { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 0.85rem; text-align: center; line-height: 2; }

  /* Tabs */
  .tabs { display: flex; border-bottom: 1px solid var(--border); background: var(--surface); flex-shrink: 0; }
  .tab { padding: 0.6rem 1.25rem; cursor: pointer; font-size: 0.8rem; color: var(--muted); border-bottom: 2px solid transparent; transition: color 0.15s; }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }

  /* Log panel */
  .log-panel { flex: 1; overflow-y: auto; padding: 0.75rem; font-size: 0.78rem; line-height: 1.7; word-break: break-all; }
  .log-panel .log-line { padding: 1px 0; }
  .log-panel .log-line.error { color: var(--danger); }
  .log-panel .log-line.warn  { color: var(--warning); }
  .log-panel .log-line.ai    { color: var(--ai); }

  /* Chat panel */
  .chat-messages { flex: 1; overflow-y: auto; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.75rem; }
  .chat-msg { max-width: 85%; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.82rem; line-height: 1.6; white-space: pre-wrap; }
  .chat-msg.user { background: var(--border); align-self: flex-end; }
  .chat-msg.ai   { background: rgba(129,140,248,0.1); border: 1px solid rgba(129,140,248,0.2); color: var(--ai); align-self: flex-start; }
  .chat-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 0.8rem; }

  /* Chat input */
  .chat-input-row { display: flex; gap: 0.5rem; padding: 0.75rem; border-top: 1px solid var(--border); background: var(--surface); flex-shrink: 0; }
  .chat-input { flex: 1; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 0.5rem 0.75rem; color: var(--text); font-family: inherit; font-size: 0.82rem; outline: none; resize: none; }
  .chat-input:focus { border-color: var(--accent); }
  .chat-send { padding: 0.5rem 1rem; background: var(--accent); color: var(--bg); border: none; border-radius: 4px; cursor: pointer; font-family: inherit; font-size: 0.8rem; font-weight: bold; letter-spacing: 1px; flex-shrink: 0; }
  .chat-send:hover { opacity: 0.9; }
  .chat-send:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
</head>
<body>

<div class="header">
  <span class="header-title">🏰 NIGHTWATCH</span>
  <span class="header-sub">THE TOWER</span>
</div>

<div class="main">
  <div class="sidebar">
    <div class="sidebar-section">
      <div class="sidebar-label">On The Wall</div>
      <div id="service-list"><div class="no-services">The wall is quiet.<br>Run nightwatch post<br>to take a post.</div></div>
    </div>
  </div>

  <div class="content" id="content">
    <div class="empty-state" id="empty-state">
      ⚔ &nbsp; Select a guard post to begin watching
    </div>

    <div id="service-view" style="display:none; flex:1; flex-direction:column; overflow:hidden;">
      <div class="tabs">
        <div class="tab active" data-tab="context">Ravens Log</div>
        <div class="tab" data-tab="suggestions">Scrolls</div>
        <div class="tab" data-tab="chat">Counsel</div>
      </div>

      <div id="tab-context" class="log-panel"></div>
      <div id="tab-suggestions" class="log-panel" style="display:none;"></div>
      <div id="tab-chat" style="display:none; flex:1; flex-direction:column; overflow:hidden;">
        <div class="chat-messages" id="chat-messages">
          <div class="chat-empty" id="chat-empty">Speak to the watchman about what stirs in the logs.</div>
        </div>
      </div>

      <div class="chat-input-row">
        <textarea class="chat-input" id="chat-input" rows="1" placeholder="Speak to the watchman..." disabled></textarea>
        <button class="chat-send" id="chat-send" disabled>⚔ SEND</button>
      </div>
    </div>
  </div>
</div>

<script>
let activeService = null
let contextSSE = null
let suggestionsSSE = null
let chatStreaming = false

// ── Service list ──────────────────────────────────────────────────────────────
async function refreshServices() {
  try {
    const services = await fetch('/api/services').then(r => r.json())
    const list = document.getElementById('service-list')
    if (!services.length) {
      list.innerHTML = '<div class="no-services">The wall is quiet.<br>Run nightwatch post<br>to take a post.</div>'
      return
    }
    list.innerHTML = services.map(s => `
      <div class="service-item ${s.name === activeService ? 'active' : ''}" onclick="selectService('${s.name}')">
        <div class="service-dot"></div>${s.name}
      </div>`).join('')
  } catch {}
}
setInterval(refreshServices, 3000)
refreshServices()

// ── Select service ────────────────────────────────────────────────────────────
async function selectService(name) {
  activeService = name

  // Disconnect old SSE streams
  if (contextSSE) { contextSSE.close(); contextSSE = null }
  if (suggestionsSSE) { suggestionsSSE.close(); suggestionsSSE = null }

  document.getElementById('empty-state').style.display = 'none'
  const view = document.getElementById('service-view')
  view.style.display = 'flex'

  document.getElementById('tab-context').innerHTML = ''
  document.getElementById('tab-suggestions').innerHTML = ''
  document.getElementById('chat-messages').innerHTML = '<div class="chat-empty" id="chat-empty">Speak to the watchman about what stirs in the logs.</div>'
  document.getElementById('chat-input').disabled = false
  document.getElementById('chat-send').disabled = false

  refreshServices()
  connectSSE(name)
  loadChatHistory(name)
}

// ── SSE tails ─────────────────────────────────────────────────────────────────
function connectSSE(name) {
  contextSSE = new EventSource(`/sse/${name}/context`)
  contextSSE.onmessage = e => appendLogLine('tab-context', JSON.parse(e.data))

  suggestionsSSE = new EventSource(`/sse/${name}/suggestions`)
  suggestionsSSE.onmessage = e => appendLogLine('tab-suggestions', JSON.parse(e.data), true)
}

function appendLogLine(panelId, text, isAI = false) {
  const panel = document.getElementById(panelId)
  const div = document.createElement('div')
  div.className = 'log-line'
  if (isAI) div.classList.add('ai')
  else if (/error|exception|fatal|ECONNREFUSED/i.test(text)) div.classList.add('error')
  else if (/warn|warning/i.test(text)) div.classList.add('warn')
  div.textContent = text
  panel.appendChild(div)
  // Auto-scroll only if already near bottom
  if (panel.scrollHeight - panel.scrollTop - panel.clientHeight < 80) {
    panel.scrollTop = panel.scrollHeight
  }
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    const active = tab.dataset.tab
    document.getElementById('tab-context').style.display = active === 'context' ? 'block' : 'none'
    document.getElementById('tab-suggestions').style.display = active === 'suggestions' ? 'block' : 'none'
    document.getElementById('tab-chat').style.display = active === 'chat' ? 'flex' : 'none'
  })
})

// ── Chat ──────────────────────────────────────────────────────────────────────
async function loadChatHistory(name) {
  try {
    const history = await fetch(`/api/chat/${name}`).then(r => r.json())
    history.forEach(m => addChatMessage(m.role, m.text))
  } catch {}
}

function addChatMessage(role, text) {
  const container = document.getElementById('chat-messages')
  const empty = document.getElementById('chat-empty')
  if (empty) empty.remove()
  const div = document.createElement('div')
  div.className = `chat-msg ${role}`
  div.textContent = text
  container.appendChild(div)
  container.scrollTop = container.scrollHeight
  return div
}

async function sendMessage() {
  if (!activeService || chatStreaming) return
  const input = document.getElementById('chat-input')
  const text = input.value.trim()
  if (!text) return

  chatStreaming = true
  input.value = ''
  input.disabled = true
  document.getElementById('chat-send').disabled = true

  // Switch to Counsel tab
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  document.querySelector('[data-tab="chat"]').classList.add('active')
  document.getElementById('tab-context').style.display = 'none'
  document.getElementById('tab-suggestions').style.display = 'none'
  document.getElementById('tab-chat').style.display = 'flex'

  addChatMessage('user', text)
  const aiDiv = addChatMessage('ai', '▌')

  const res = await fetch(`/api/chat/${activeService}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let aiText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    for (const line of decoder.decode(value).split('\n')) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6)
      if (raw === '[DONE]') break
      try {
        const { chunk, error } = JSON.parse(raw)
        if (error) { aiDiv.textContent = `Error: ${error}`; break }
        if (chunk) { aiText += chunk; aiDiv.textContent = aiText }
      } catch {}
    }
    document.getElementById('chat-messages').scrollTop = 999999
  }

  chatStreaming = false
  input.disabled = false
  document.getElementById('chat-send').disabled = false
  input.focus()
}

document.getElementById('chat-send').addEventListener('click', sendMessage)
document.getElementById('chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
})
</script>
</body>
</html>
```

- [ ] **Step 2: Verify file saved correctly**

```bash
wc -l public/index.html
```

Expected: ~180+ lines.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: dashboard UI — vanilla JS with GOT dark theme, tabbed layout"
```

---

## Task 7: bin/nightwatch.js (CLI)

**Files:**
- Write: `bin/nightwatch.js`

- [ ] **Step 1: Write bin/nightwatch.js**

```js
#!/usr/bin/env node
const { program } = require('commander')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const { ensureApiKey, getConfig } = require('../src/config')
const { createSession, appendLog, killSession, getActiveSessions, getSessionPath } = require('../src/session')
const { startEngine } = require('../src/engine')
const { startDashboard } = require('../src/dashboard')

program
  .name('nightwatch')
  .description('"The night is dark and full of bugs."')
  .version('0.1.0')

// ── nightwatch post -- <command> ──────────────────────────────────────────────
program.command('post')
  .description('Take a guard post — spawn a service and watch it')
  .option('--name <name>', 'Guard post name (defaults to current directory name)')
  .allowUnknownOption(true)
  .action(async (opts) => {
    const sepIdx = process.argv.indexOf('--')
    if (sepIdx === -1 || sepIdx === process.argv.length - 1) {
      console.error('Usage: nightwatch post [--name <name>] -- <command> [args...]')
      process.exit(1)
    }
    const cmd = process.argv.slice(sepIdx + 1)
    const name = opts.name || path.basename(process.cwd())
    const config = await ensureApiKey()

    createSession(name, cmd.join(' '))
    console.log(`\n⚔  Taking the post: ${name}`)
    console.log(`   Command: ${cmd.join(' ')}\n`)

    const child = spawn(cmd[0], cmd.slice(1), {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: process.env,
    })

    // Write child PID to .meta.json so dismiss can kill it
    const metaPath = path.join(getSessionPath(name), '.meta.json')
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    meta.pid = child.pid
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))

    const pipeLine = (prefix) => (data) => {
      data.toString().split('\n').filter(Boolean).forEach(line => {
        process[prefix === '[stdout]' ? 'stdout' : 'stderr'].write(line + '\n')
        appendLog(name, `${prefix} ${line}`)
      })
    }

    child.stdout.on('data', pipeLine('[stdout]'))
    child.stderr.on('data', pipeLine('[stderr]'))

    const stopEngine = startEngine(name, config)

    child.on('exit', (code) => {
      stopEngine()
      appendLog(name, `[system] Process exited with code ${code ?? 'null'}`)
      console.log(`\n🏰 ${name} has left the wall. Exit: ${code}`)
      process.exit(code ?? 0)
    })

    process.on('SIGINT', () => child.kill('SIGINT'))
    process.on('SIGTERM', () => child.kill('SIGTERM'))
  })

// ── nightwatch tower ──────────────────────────────────────────────────────────
program.command('tower')
  .description('Open The Tower — start the dashboard')
  .action(async () => {
    const config = await ensureApiKey()
    startDashboard(config)
    const url = `http://localhost:${config.dashboard_port || 4000}`
    console.log(`\n🏰 The Tower rises at ${url}\n`)
    // Dynamically require 'open' to avoid issues if not installed
    try {
      const open = require('open')
      setTimeout(() => open(url), 800)
    } catch {}
  })

// ── nightwatch dismiss ────────────────────────────────────────────────────────
program.command('dismiss')
  .description('Dismiss a guard post — stop watching a service')
  .option('--name <name>', 'Guard post name (defaults to current directory name)')
  .action((opts) => {
    const name = opts.name || path.basename(process.cwd())
    try {
      killSession(name)
      console.log(`🏰 ${name} dismissed from the wall.`)
    } catch (e) {
      console.error(`Failed to dismiss ${name}: ${e.message}`)
      process.exit(1)
    }
  })

// ── nightwatch roster ─────────────────────────────────────────────────────────
program.command('roster')
  .description('List all active guard posts')
  .action(() => {
    const sessions = getActiveSessions()
    if (!sessions.length) {
      console.log('\n🏰 The wall is quiet. No active guards.\n')
      return
    }
    console.log('\n⚔  ON THE WALL:\n')
    sessions.forEach(s => {
      const mins = Math.round((Date.now() - new Date(s.startedAt)) / 60000)
      console.log(`  ● ${s.name.padEnd(20)} ${s.command.slice(0, 45).padEnd(45)}  (${mins}m)`)
    })
    console.log()
  })

program.parse(process.argv)
```

- [ ] **Step 2: Verify CLI parses correctly**

```bash
node bin/nightwatch.js --help
node bin/nightwatch.js post --help
node bin/nightwatch.js roster
```

Expected: help text printed, roster shows "wall is quiet".

- [ ] **Step 3: Commit**

```bash
git add bin/nightwatch.js
git commit -m "feat: CLI — post, tower, dismiss, roster commands"
```

---

## Task 8: Smoke Test (End-to-End)

Verify the full loop works: `post` → logs flow → AI analysis → dashboard shows live data → chat responds.

- [ ] **Step 1: Run all unit tests clean**

```bash
node --test tests/
```

Expected: all tests pass.

- [ ] **Step 2: Start the tower in one terminal**

```bash
node bin/nightwatch.js tower
```

Expected: `🏰 The Tower rises at http://localhost:4000`, browser opens.
Verify: dashboard loads with GOT theme, sidebar shows "wall is quiet".

- [ ] **Step 3: Start a test service in a second terminal**

```bash
# Create a simple test service that emits logs
node bin/nightwatch.js post --name demo -- node -e "
  setInterval(() => {
    const n = Math.random();
    if (n > 0.8) console.error('Error: something went wrong');
    else if (n > 0.6) console.log('GET /posts 200 ' + Math.floor(n*5000) + 'ms');
    else console.log('GET /api/users 200 45ms');
  }, 2000);
"
```

Expected: logs stream to terminal. `⚔  Taking the post: demo` printed.

- [ ] **Step 4: Verify dashboard shows the service**

Open http://localhost:4000. Verify:
- Sidebar shows `demo` with green dot
- Click `demo` → Ravens Log tab shows streaming log lines
- Lines with "Error" appear in red

- [ ] **Step 5: Verify AI engine fires**

Wait ~60 seconds (scheduled sweep) or trigger an error log. Check:
- Scrolls tab shows a Watchman Report
- `~/.devwatch/active/demo/suggestions.md` has content

```bash
cat ~/.devwatch/active/demo/suggestions.md
```

- [ ] **Step 6: Verify chat works**

In the dashboard:
- Click Counsel tab
- Type: "What's happening with this service?"
- Press Enter or click ⚔ SEND
- Verify AI streams a response with context about the logs

- [ ] **Step 7: Verify dismiss works**

```bash
node bin/nightwatch.js dismiss --name demo
```

Expected: `🏰 demo dismissed from the wall.`
Verify: `~/.devwatch/active/demo/` directory removed.

- [ ] **Step 8: Final commit**

```bash
node --test tests/
git add -A
git commit -m "feat: nightwatch MVP — core loop complete (post + engine + tower + chat)"
```

---

## Quick Reference

```bash
# Start watching a service
nightwatch post -- node server.js
nightwatch post --name api -- python app.py

# Open dashboard
nightwatch tower

# Stop a service (from service directory)
nightwatch dismiss

# List active services
nightwatch roster

# Run tests
node --test tests/
```

Config stored at `~/.devwatch/config.json`. All session data at `~/.devwatch/active/<name>/`.
