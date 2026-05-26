#!/usr/bin/env node
const { program } = require('commander')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const { ensureApiKey } = require('../src/config')
const { createSession, appendLog, killSession, getActiveSessions, getSessionPath } = require('../src/session')
const { startEngine } = require('../src/engine')
const { startDashboard } = require('../src/dashboard')

program.name('nightwatch').description('"The night is dark and full of bugs."').version('0.1.0')

program.command('post')
  .description('Take a guard post — spawn a service and watch it')
  .option('--name <name>', 'Guard post name (defaults to current dir name)')
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
    console.log(`\n⚔  Taking the post: ${name}\n   Command: ${cmd.join(' ')}\n`)

    const child = spawn(cmd[0], cmd.slice(1), { stdio: ['inherit', 'pipe', 'pipe'], env: process.env })

    const metaPath = path.join(getSessionPath(name), '.meta.json')
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    meta.pid = child.pid
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))

    const pipe = (prefix) => (data) => {
      data.toString().split('\n').filter(Boolean).forEach(line => {
        process[prefix === '[stdout]' ? 'stdout' : 'stderr'].write(line + '\n')
        appendLog(name, `${prefix} ${line}`)
      })
    }
    child.stdout.on('data', pipe('[stdout]'))
    child.stderr.on('data', pipe('[stderr]'))

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

program.command('tower')
  .description('Open The Tower — start the dashboard')
  .action(async () => {
    const config = await ensureApiKey()
    startDashboard(config)
    const url = `http://localhost:${config.dashboard_port || 4000}`
    console.log(`\n🏰 The Tower rises at ${url}\n`)
    try { const open = require('open'); setTimeout(() => (open.default || open)(url), 800) } catch {}
  })

program.command('dismiss')
  .description('Dismiss a guard post')
  .option('--name <name>', 'Guard post name (defaults to current dir name)')
  .action((opts) => {
    const name = opts.name || path.basename(process.cwd())
    try { killSession(name); console.log(`🏰 ${name} dismissed from the wall.`) }
    catch (e) { console.error(`Failed to dismiss ${name}: ${e.message}`); process.exit(1) }
  })

program.command('roster')
  .description('List all active guard posts')
  .action(() => {
    const sessions = getActiveSessions()
    if (!sessions.length) { console.log('\n🏰 The wall is quiet. No active guards.\n'); return }
    console.log('\n⚔  ON THE WALL:\n')
    sessions.forEach(s => {
      const mins = Math.round((Date.now() - new Date(s.startedAt)) / 60000)
      console.log(`  ● ${s.name.padEnd(20)} ${s.command.slice(0, 45).padEnd(45)}  (${mins}m)`)
    })
    console.log()
  })

program.parse(process.argv)
