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
  let pendingAnalysis = null
  const COOLDOWN_MS = 10_000
  const contextPath = path.join(getSessionPath(name), 'context.log')

  function runAnalysis() {
    if (pendingAnalysis) return
    const now = Date.now()
    if (now - lastTriggerTime < COOLDOWN_MS || !buffer.length) return
    lastTriggerTime = now
    pendingAnalysis = (async () => {
      try {
        const response = await callOpenRouter(config, buildMessages(name, buffer))
        if (!response || response.includes('All quiet on the wall')) return
        const severity = parseSeverity(response)
        if (severity > 0 && severity < config.severity_threshold) return
        appendSuggestion(name, response)
      } catch (e) {
        appendSuggestion(name, `⚠️ Watchman error: ${e.message}`)
      } finally {
        pendingAnalysis = null
      }
    })()
  }

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

  return async () => {
    watcher.close()
    clearInterval(sweepTimer)
    if (pendingAnalysis) await pendingAnalysis
  }
}

module.exports = { startEngine, TRIGGERS, extractMaxMs, parseSeverity }
