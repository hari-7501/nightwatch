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
