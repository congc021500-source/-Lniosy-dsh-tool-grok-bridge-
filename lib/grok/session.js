import { execFileSync } from 'node:child_process'
import { createDecipheriv, pbkdf2Sync } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'

const DEFAULT_VERSION = '0.78.1'
let cached = null

export function loadLocalSession() {
  if (cached) return cached
  const session = readLocal()
  if (session) cached = session
  return session
}

function readLocal() {
  const os = platform()
  const secretsPath = os === 'win32'
    ? join(process.env.APPDATA || '', 'Grok Bot', 'sand-secrets.json')
    : os === 'darwin'
      ? join(homedir(), 'Library/Application Support/Grok Bot/sand-secrets.json')
      : ''
  if (!secretsPath || !existsSync(secretsPath)) return null
  const stored = JSON.parse(readFileSync(secretsPath, 'utf8'))
  const accounts = JSON.parse(stored['cursor-accounts'] || '{}')
  const record = (accounts.accounts || {})[accounts.active] || {}
  const tokenBlob = record['cursor-access-token']
  const machineBlob = stored['cursor-machine-id']
  if (!tokenBlob || !machineBlob) return null
  const accessToken = decryptSecret(tokenBlob)
  const machineId = decryptSecret(machineBlob)
  if (!accessToken || !machineId) return null
  return {
    accessToken,
    machineId,
    clientVersion: appVersion(os) || DEFAULT_VERSION,
  }
}

function decryptSecret(blob) {
  try {
    if (platform() === 'win32') return decryptWindows(blob)
    if (platform() === 'darwin') return decryptMac(blob)
  } catch {
    return ''
  }
  return ''
}

let macPassword = ''

function decryptMac(blob) {
  const raw = Buffer.from(blob, 'base64')
  if (raw.subarray(0, 3).toString() !== 'v10') return ''
  if (!macPassword) {
    macPassword = execFileSync('/usr/bin/security', [
      'find-generic-password', '-s', 'Grok Bot Safe Storage', '-a', 'Grok Bot Key', '-w',
    ], { encoding: 'utf8' }).trim()
  }
  const password = macPassword
  const key = pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1')
  const decipher = createDecipheriv('aes-128-cbc', key, Buffer.alloc(16, 0x20))
  decipher.setAutoPadding(false)
  const plain = Buffer.concat([decipher.update(raw.subarray(3)), decipher.final()])
  const pad = plain[plain.length - 1]
  if (pad < 1 || pad > 16 || !plain.subarray(-pad).equals(Buffer.alloc(pad, pad))) return ''
  return plain.subarray(0, plain.length - pad).toString('utf8')
}

function decryptWindows(blob) {
  let raw = Buffer.from(blob, 'base64')
  if (raw.subarray(0, 3).toString() === 'v10') raw = raw.subarray(3)
  const key = chromeKey()
  if (key && key.length === 32 && raw.length > 28) {
    const opened = openGcm(key, raw)
    if (opened) return opened
  }
  const plain = dpapi(raw)
  return plain ? plain.toString('utf8') : ''
}

function chromeKey() {
  const path = join(process.env.APPDATA || '', 'Grok Bot', 'Local State')
  if (!existsSync(path)) return null
  const doc = JSON.parse(readFileSync(path, 'utf8'))
  const encoded = doc?.os_crypt?.encrypted_key
  if (!encoded) return null
  const raw = Buffer.from(encoded, 'base64')
  if (raw.subarray(0, 5).toString() !== 'DPAPI') return null
  return dpapi(raw.subarray(5))
}

function openGcm(key, payload) {
  try {
    const nonce = payload.subarray(0, 12)
    const tag = payload.subarray(payload.length - 16)
    const data = payload.subarray(12, payload.length - 16)
    const decipher = createDecipheriv('aes-256-gcm', key, nonce)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  } catch {
    return ''
  }
}

function dpapi(data) {
  if (!data.length) return null
  const script = [
    "$ErrorActionPreference = 'Stop'",
    'Add-Type -AssemblyName System.Security',
    '$in = [Convert]::FromBase64String($env:GROK_DPAPI_IN)',
    "$out = [System.Security.Cryptography.ProtectedData]::Unprotect($in, $null, 'CurrentUser')",
    '[Console]::Out.Write([Convert]::ToBase64String($out))',
  ].join('; ')
  const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    timeout: 20000,
    windowsHide: true,
    env: { ...process.env, GROK_DPAPI_IN: data.toString('base64') },
  }).trim()
  return out ? Buffer.from(out, 'base64') : null
}

function appVersion(os) {
  if (os === 'darwin') {
    for (const app of ['/Applications/Grok Bot.app', join(homedir(), 'Applications/Grok Bot.app')]) {
      const plist = join(app, 'Contents/Info.plist')
      if (!existsSync(plist)) continue
      try {
        const version = execFileSync('/usr/bin/plutil', ['-extract', 'CFBundleShortVersionString', 'raw', plist], { encoding: 'utf8' }).trim()
        if (version) return version
      } catch {
        return ''
      }
    }
  }
  if (os === 'win32') {
    const roots = [
      join(process.env.LOCALAPPDATA || '', 'Programs', 'Grok Bot'),
      join(process.env.ProgramFiles || '', 'Grok Bot'),
      join(process.env['ProgramFiles(x86)'] || '', 'Grok Bot'),
    ]
    for (const root of roots) {
      const yml = join(root, 'resources', 'app-update.yml')
      if (!existsSync(yml)) continue
      const matched = readFileSync(yml, 'utf8').match(/^version:\s*(\S+)/m)
      if (matched) return matched[1]
    }
  }
  return ''
}
