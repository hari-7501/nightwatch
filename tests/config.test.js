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
