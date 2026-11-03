import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('package.json names the bridge plugin and points at this repository', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.name, 'dsh-tool-grok-bridge')
  assert.equal(pkg.version, '0.1.0')
  assert.equal(pkg.type, 'module')
  assert.equal(pkg.license, 'MIT')
  assert.equal(pkg.engines.node, '>=22')
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.deepEqual(pkg.dsh.client.inject, [
    '@deepseek-ai/dsh-client-ui-settings',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-web-react',
  ])
  assert.equal(pkg.exports['.'], './lib/grok/index.js')
  assert.equal(pkg.exports['./grok'], './lib/grok/index.js')
  assert.equal(pkg.exports['./bridge'], './lib/bridge/index.js')
  assert.equal(pkg.exports['./cordis.patch.yml'], './cordis.patch.yml')
  assert.equal(pkg.peerDependencies['@deepseek-ai/dsh-tools'], '^0.2.1-rc.5')
  assert.equal(pkg.peerDependencies['@deepseek-ai/cordis'], '^4.0.1')
  assert.equal(
    pkg.repository.url,
    'git+https://github.com/congc021500-source/-Lniosy-dsh-tool-grok-bridge-.git',
  )
  assert.equal(typeof pkg.scripts.test, 'string')
  assert.equal(typeof pkg.scripts.check, 'string')
})

test('cordis patch registers both directions and leaves the bridge disabled', () => {
  const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
  assert.match(patch, /id: grok-bot/)
  assert.match(patch, /name: dsh-tool-grok-bridge\/grok/)
  assert.match(patch, /id: mcp-bridge/)
  assert.match(patch, /name: dsh-tool-grok-bridge\/bridge/)
  assert.match(patch, /host: 127\.0\.0\.1/)
  assert.match(patch, /port: 8931/)
  assert.match(patch, /basePath: \/mcp/)
  assert.match(patch, /serverName: dsh-bridge/)
  assert.match(patch, /controlPath: \/dsh-bridge\/control/)
  assert.match(patch, /defaultCwd: DSH_TOOL_GROK_BRIDGE_DEFAULT_CWD/)
  assert.match(patch, /workspaceRoots:/)
  assert.doesNotMatch(patch, /enabled:\s*true/)
  assert.doesNotMatch(patch, /https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
})
