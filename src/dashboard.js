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
