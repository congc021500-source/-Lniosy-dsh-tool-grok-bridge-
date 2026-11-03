import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addPlugin,
  clearMarkedBlock,
  fillDefaultCwd,
  removePlugin,
  renderProfilePatch,
  upsertMarkedBlock,
} from '../scripts/profile-package.mjs'

test('addPlugin creates a profile bundle on an empty package', () => {
  const next = addPlugin({}, {
    name: 'dsh-tool-grok-bridge',
    dependency: 'file:../../plugins/dsh-tool-grok-bridge',
  })
  assert.deepEqual(next.dsh.profile.bundles, ['dsh-tool-grok-bridge'])
  assert.equal(next.dependencies['dsh-tool-grok-bridge'], 'file:../../plugins/dsh-tool-grok-bridge')
})

test('addPlugin records the file dependency and bundle once', () => {
  const first = addPlugin({
    dependencies: { '@deepseek-ai/dsh-base': '1.0.0' },
    dsh: { profile: { bundles: ['@deepseek-ai/dsh-base'] } },
  }, {
    name: 'dsh-tool-grok-bridge',
    dependency: 'file:../../plugins/dsh-tool-grok-bridge',
  })
  assert.equal(first.dependencies['@deepseek-ai/dsh-base'], '1.0.0')
  assert.equal(first.dependencies['dsh-tool-grok-bridge'], 'file:../../plugins/dsh-tool-grok-bridge')
  assert.deepEqual(first.dsh.profile.bundles, ['@deepseek-ai/dsh-base', 'dsh-tool-grok-bridge'])
  const second = addPlugin(first, {
    name: 'dsh-tool-grok-bridge',
    dependency: 'file:../../plugins/dsh-tool-grok-bridge',
  })
  assert.deepEqual(second.dsh.profile.bundles, ['@deepseek-ai/dsh-base', 'dsh-tool-grok-bridge'])
  assert.equal(JSON.stringify(second).includes('"enabled"'), false)
})

test('removePlugin drops only this package', () => {
  const removed = removePlugin({
    dependencies: {
      '@deepseek-ai/dsh-base': '1.0.0',
      'dsh-tool-grok-bridge': 'file:../../plugins/dsh-tool-grok-bridge',
      'dsh-tool-grok-bot': 'file:../../plugins/dsh-tool-grok-bot',
    },
    dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', 'dsh-tool-grok-bridge', 'dsh-mcp-bridge'] } },
  }, { name: 'dsh-tool-grok-bridge' })
  assert.equal(removed.dependencies['dsh-tool-grok-bridge'], undefined)
  assert.equal(removed.dependencies['dsh-tool-grok-bot'], 'file:../../plugins/dsh-tool-grok-bot')
  assert.deepEqual(removed.dsh.profile.bundles, ['@deepseek-ai/dsh-base', 'dsh-mcp-bridge'])
})

test('profile patch quotes DefaultCwd and stays disabled', () => {
  const block = renderProfilePatch("C:\\work\\o'clock")
  assert.match(block, /# dsh-tool-grok-bridge begin/)
  assert.match(block, /# dsh-tool-grok-bridge end/)
  assert.match(block, /serverName: dsh-bridge/)
  assert.match(block, /host: 127\.0\.0\.1/)
  assert.match(block, /port: 8931/)
  assert.match(block, /defaultCwd: 'C:\\work\\o''clock'/)
  assert.doesNotMatch(block, /enabled:\s*true/)
  const updated = upsertMarkedBlock('other: true\n', block)
  const again = upsertMarkedBlock(updated, renderProfilePatch('D:\\agent'))
  assert.equal(again.match(/# dsh-tool-grok-bridge begin/g).length, 1)
  assert.match(again, /defaultCwd: 'D:\\agent'/)
  assert.match(again, /^other: true/m)
  assert.equal(clearMarkedBlock(again).includes('dsh-tool-grok-bridge'), false)
  assert.match(clearMarkedBlock(again), /other: true/)
})

test('fillDefaultCwd replaces the install token in the package patch', () => {
  const filled = fillDefaultCwd([
    'defaultCwd: DSH_TOOL_GROK_BRIDGE_DEFAULT_CWD',
    'workspaceRoots:',
    '  - DSH_TOOL_GROK_BRIDGE_DEFAULT_CWD',
  ].join('\n'), 'C:\\ws')
  assert.equal(filled.includes('DSH_TOOL_GROK_BRIDGE_DEFAULT_CWD'), false)
  assert.match(filled, /defaultCwd: 'C:\\ws'/)
  assert.match(filled, /- 'C:\\ws'/)
})
