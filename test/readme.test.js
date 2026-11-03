import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = new URL('..', import.meta.url)
const read = (name) => readFileSync(new URL(name, root), 'utf8')
const badge = 'dsh://plugin/install?id=dsh-tool-grok-bridge&name=Grok%20Bot%20%E5%8F%8C%E5%90%91%E6%A1%A5&version=0.1.0&repo=congc021500-source%2F-Lniosy-dsh-tool-grok-bridge-&permissions=%E8%AF%BB%E5%8F%96%E6%9C%AC%E6%9C%BA%E7%99%BB%E5%BD%95%2C%E8%B0%83%E7%94%A8%20Grok%20Bot%2C%E6%9A%B4%E9%9C%B2%E6%9C%AC%E6%9C%BA%20MCP&downloadUrl=https%3A%2F%2Fgithub.com%2Fcongc021500-source%2F-Lniosy-dsh-tool-grok-bridge-%2Farchive%2Frefs%2Fheads%2Fmain.zip'
const liveTunnel = /https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.trycloudflare\.com/i

function walk(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === '.git' || entry === 'node_modules') continue
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path, found)
    else if (!path.includes(`${join('test', '')}`) && !path.endsWith('.png')) found.push(path)
  }
  return found
}

test('both READMEs document the install badge and bidirectional use', () => {
  for (const name of ['README.md', 'README.en.md']) {
    const text = read(name)
    assert.match(text, /Grok Bot 双向桥/)
    assert.ok(text.includes(badge), `${name} is missing the dsh:// badge`)
    assert.match(text, /grok_bot_ask/)
    assert.match(text, /grok_bot_memory_recall/)
    assert.match(text, /dsh_run_task/)
    assert.match(text, /dsh_task_status/)
    assert.match(text, /dsh_get_task_result/)
    assert.match(text, /dsh_ping/)
    assert.match(text, /dsh_list_tasks/)
    assert.match(text, /dsh_cancel_task/)
    assert.match(text, /127\.0\.0\.1:8931/)
    assert.match(text, /serverName/)
    assert.match(text, /dsh-bridge/)
    assert.match(text, /start-tunnel\.ps1/)
    assert.match(text, /TUNNEL_URL=/)
    assert.match(text, /\/mcp/)
    assert.match(text, /install\.ps1/)
    assert.match(text, /uninstall\.ps1/)
    assert.match(text, /-DshRoot/)
    assert.match(text, /-DefaultCwd/)
    assert.match(text, /Codex Bridge/)
    assert.match(text, /congc021500-source\/-Lniosy-dsh-tool-grok-bridge-/)
    assert.doesNotMatch(text, liveTunnel)
  }
})

test('tracked text does not contain a live quick-tunnel url', () => {
  const hits = []
  for (const path of walk(new URL('..', import.meta.url).pathname)) {
    const text = readFileSync(path, 'utf8')
    if (liveTunnel.test(text)) hits.push(path)
  }
  assert.deepEqual(hits, [])
})

test('connector example is a placeholder', () => {
  const example = read('examples/mcp-connector.url.example')
  assert.match(example, /https:\/\/<subdomain>\.trycloudflare\.com\/mcp/)
  assert.doesNotMatch(example, liveTunnel)
})
