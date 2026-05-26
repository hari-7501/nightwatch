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
        if (!meta.pid) return acc
        try {
          process.kill(meta.pid, 0)
          acc.push(meta)
        } catch { /* stale PID — skip */ }
      } catch { /* malformed meta — skip */ }
      return acc
    }, [])
}

function appendLog(name, line) {
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false })
  try {
    fs.appendFileSync(path.join(getSessionPath(name), 'context.log'), `[${ts}] ${line}\n`)
  } catch { /* session dismissed mid-run — ignore */ }
}

function appendSuggestion(name, content) {
  const ts = new Date().toISOString()
  try {
    fs.appendFileSync(
      path.join(getSessionPath(name), 'suggestions.md'),
      `\n---\n## ⚔ WATCHMAN REPORT — ${name} — ${ts}\n${content}\n`
    )
  } catch { /* session dismissed mid-run — ignore */ }
}

function killSession(name) {
  const metaPath = path.join(getSessionPath(name), '.meta.json')
  if (fs.existsSync(metaPath)) {
    try {
      const { pid } = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
      if (pid && pid !== process.pid) process.kill(pid, 'SIGTERM')
    } catch (e) {
      if (e.code !== 'ESRCH') throw e
    }
  }
  fs.rmSync(getSessionPath(name), { recursive: true, force: true })
}

module.exports = { createSession, getActiveSessions, appendLog, appendSuggestion, getSessionPath, killSession, ACTIVE_DIR }
