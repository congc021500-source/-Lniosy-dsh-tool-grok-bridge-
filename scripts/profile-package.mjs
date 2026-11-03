import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const PLUGIN_NAME = 'dsh-tool-grok-bridge'
export const BEGIN = '# dsh-tool-grok-bridge begin'
export const END = '# dsh-tool-grok-bridge end'
const CWD_TOKEN = 'DSH_TOOL_GROK_BRIDGE_DEFAULT_CWD'

export function quoteYamlSingle(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

export function addPlugin(pkg, { name, dependency }) {
  const next = structuredClone(pkg ?? {})
  next.dependencies = { ...(next.dependencies ?? {}), [name]: dependency }
  next.dsh = { ...(next.dsh ?? {}) }
  next.dsh.profile = { ...(next.dsh.profile ?? {}) }
  const bundles = Array.isArray(next.dsh.profile.bundles) ? next.dsh.profile.bundles.slice() : []
  if (!bundles.includes(name)) bundles.push(name)
  next.dsh.profile.bundles = bundles
  return next
}

export function removePlugin(pkg, { name }) {
  const next = structuredClone(pkg ?? {})
  if (next.dependencies && Object.prototype.hasOwnProperty.call(next.dependencies, name)) {
    delete next.dependencies[name]
  }
  if (Array.isArray(next.dsh?.profile?.bundles)) {
    next.dsh.profile.bundles = next.dsh.profile.bundles.filter((item) => item !== name)
  }
  return next
}

export function renderProfilePatch(defaultCwd) {
  const quoted = quoteYamlSingle(defaultCwd)
  return `${BEGIN}
- insert:
    - id: grok-bot
      name: dsh-tool-grok-bridge/grok
    - id: mcp-bridge
      name: dsh-tool-grok-bridge/bridge
      config:
        host: 127.0.0.1
        port: 8931
        basePath: /mcp
        serverName: dsh-bridge
        controlPath: /dsh-bridge/control
        authToken: ''
        defaultProvider: fork
        defaultAgentPreset: standard
        defaultCwd: ${quoted}
        workspaceRoots:
          - ${quoted}
        maxDepth: 2
        taskTimeoutMs: 0
${END}
`
}

function markerPattern() {
  return new RegExp(`${BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`)
}

export function upsertMarkedBlock(existing, block) {
  const normalized = block.endsWith('\n') ? block : `${block}\n`
  if (existing && existing.includes(BEGIN)) return existing.replace(markerPattern(), normalized)
  if (!existing) return normalized
  return `${existing.replace(/\s*$/, '\n')}${normalized}`
}

export function clearMarkedBlock(existing) {
  if (!existing || !existing.includes(BEGIN)) return existing || ''
  return existing.replace(markerPattern(), '')
}

export function fillDefaultCwd(template, defaultCwd) {
  if (!String(template).includes(CWD_TOKEN)) {
    throw new Error(`cordis patch is missing ${CWD_TOKEN}`)
  }
  return String(template).replaceAll(CWD_TOKEN, quoteYamlSingle(defaultCwd))
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function writeJson(file, value) {
  const backup = `${file}.bak-${Date.now()}`
  copyFileSync(file, backup)
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
  console.log(`backup ${backup}`)
}

function main() {
  const [cmd, file, extra] = process.argv.slice(2)
  if (!cmd || !file) {
    console.error('usage: profile-package.mjs <add|remove|write-patch|clear-patch|fill-template> <file> [value]')
    process.exit(2)
  }
  if (cmd === 'add') {
    if (!extra) throw new Error('add requires a dependency spec')
    const next = addPlugin(readJson(file), { name: PLUGIN_NAME, dependency: extra })
    writeJson(file, next)
    return
  }
  if (cmd === 'remove') {
    const current = readJson(file)
    const next = removePlugin(current, { name: PLUGIN_NAME })
    const changed = JSON.stringify(current.dependencies?.[PLUGIN_NAME] ?? null) !== JSON.stringify(next.dependencies?.[PLUGIN_NAME] ?? null)
      || JSON.stringify(current.dsh?.profile?.bundles ?? null) !== JSON.stringify(next.dsh?.profile?.bundles ?? null)
    if (!changed) {
      console.log(`no ${PLUGIN_NAME} entry in ${file}`)
      return
    }
    writeJson(file, next)
    return
  }
  if (cmd === 'replace-patch') {
    if (!extra) throw new Error('replace-patch requires DefaultCwd')
    writeFileSync(file, renderProfilePatch(extra))
    return
  }
  if (cmd === 'write-patch') {
    if (!extra) throw new Error('write-patch requires DefaultCwd')
    const existing = existsSync(file) ? readFileSync(file, 'utf8') : ''
    writeFileSync(file, upsertMarkedBlock(existing, renderProfilePatch(extra)))
    return
  }
  if (cmd === 'clear-patch') {
    if (!existsSync(file)) return
    writeFileSync(file, clearMarkedBlock(readFileSync(file, 'utf8')))
    return
  }
  if (cmd === 'fill-template') {
    if (!extra) throw new Error('fill-template requires DefaultCwd')
    writeFileSync(file, fillDefaultCwd(readFileSync(file, 'utf8'), extra))
    return
  }
  throw new Error(`unknown command ${cmd}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
