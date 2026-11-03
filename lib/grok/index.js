import { randomUUID } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { SKILL_BODY, SKILL_DESCRIPTION, SKILL_NAME, SKILL_WHEN } from './guide.js'
import { registerMemoryTools } from './memory.js'
import { registerMoreTools } from './more.js'
import { loadLocalSession } from './session.js'

export const name = 'grok-bot'
export const inject = ['tools', 'skills']

const API = 'https://api2.cursor.sh/aiserver.v1.GrokBotService'
const objectSchema = { type: 'object', additionalProperties: true }

function loadAuth() {
  const envToken = process.env.GROK_BOT_ACCESS_TOKEN || ''
  const envMachine = process.env.GROK_BOT_MACHINE_ID || ''
  if (envToken && envMachine) {
    return {
      accessToken: envToken,
      machineId: envMachine,
      clientVersion: process.env.GROK_BOT_CLIENT_VERSION || '0.78.1',
    }
  }
  const local = loadLocalSession()
  if (local) return local
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const file = process.env.GROK_BOT_SESSION || join(home, 'grok-bot.json')
  let stored = {}
  if (file && existsSync(file)) stored = JSON.parse(readFileSync(file, 'utf8'))
  if (stored.accessToken && stored.machineId) {
    return {
      accessToken: stored.accessToken,
      machineId: stored.machineId,
      clientVersion: stored.clientVersion || process.env.GROK_BOT_CLIENT_VERSION || '0.78.1',
    }
  }
  throw new Error('还没有读到本机的 Grok Bot 登录。先打开 Grok Bot 并保持登录，然后重试。')
}

function checksum(machineId) {
  const tick = Math.floor(Date.now() / 1_000_000)
  const buf = [
    (tick / 2 ** 40) & 255,
    (tick / 2 ** 32) & 255,
    (tick / 2 ** 24) & 255,
    (tick / 2 ** 16) & 255,
    (tick / 2 ** 8) & 255,
    tick & 255,
  ]
  let mixer = 165
  for (let i = 0; i < buf.length; i++) {
    mixer = ((buf[i] ^ mixer) + (i % 256)) & 255
    buf[i] = mixer
  }
  const prefix = Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return prefix + machineId
}

async function rpc(auth, method, payload, timeoutMs = 40000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${API}/${method}`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        'connect-protocol-version': '1',
        authorization: `Bearer ${auth.accessToken}`,
        'x-cursor-checksum': checksum(auth.machineId),
        'x-cursor-client-type': 'sand',
        'x-cursor-client-version': auth.clientVersion,
        'x-cursor-client-os': 'linux',
        'x-cursor-client-source': 'sand-desktop',
        'x-ghost-mode': 'true',
        'user-agent': `Sand/${auth.clientVersion}`,
      },
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    let doc = null
    try { doc = text ? JSON.parse(text) : null } catch { doc = { error: text } }
    if (!res.ok) {
      const error = new Error(doc?.message || doc?.error || `Grok Bot 接口返回 ${res.status}`)
      error.status = res.status
      throw error
    }
    return doc
  } finally {
    clearTimeout(timer)
  }
}

function decodeEntry(entry) {
  const body = entry.body || ''
  const padded = body + '='.repeat((4 - (body.length % 4)) % 4)
  const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
  decoded._seq = Number(entry.seq || 0)
  return decoded
}

function entryText(entry) {
  if (entry.kind === 'send-message') {
    const content = entry.message?.content
    return typeof content === 'string' ? content : ''
  }
  if (entry.kind === 'message' && entry.role === 'user') return entry.content || ''
  return ''
}

function isProgress(text) {
  const trimmed = text.trim()
  return trimmed.length < 40 && (trimmed.includes('正在汇总') || trimmed.includes('正在拉取') || trimmed.includes('正在处理'))
}

async function listBots(auth) {
  const doc = await rpc(auth, 'ListGrokBotAgents', {})
  return (doc?.agents || []).map((agent) => {
    const kind = agent.kind || ''
    return {
      id: agent.agentId || agent.id,
      name: agent.name || agent.title || '未命名',
      kind: String(kind).endsWith('ROOM') ? 'team' : 'bot',
    }
  }).filter((bot) => bot.id)
}

function resolveBot(bots, name) {
  const wanted = String(name || '').trim()
  if (!wanted) throw new Error('要指定 Bot 的名字或 id。')
  const hit = bots.find((bot) => bot.id === wanted || bot.name === wanted)
  if (!hit) throw new Error(`没有找到「${wanted}」。先调用 grok_bot_list 看现有名字。`)
  return hit
}

async function listTranscript(auth, agentId, limit = 80) {
  const transcript = await rpc(auth, 'ListGrokBotTranscriptEntries', { agentId, limit })
  return (transcript?.entries || []).map(decodeEntry).sort((left, right) => left._seq - right._seq)
}

async function sendAndWait(auth, bot, text, timeoutSec, ready, settleMs = 3000) {
  const nonce = randomUUID()
  const doc = await rpc(auth, 'SendGrokBotUserMessage', {
    agentId: bot.id,
    messageId: nonce,
    text,
    sentAtMs: String(Date.now()),
    source: 'GROK_BOT_CLIENT_SURFACE_DESKTOP',
    initiator: 'GROK_BOT_USER_MESSAGE_INITIATOR_USER',
    sendSource: 'GROK_BOT_SEND_SOURCE_CHAT',
    isFork: false,
  })
  const delivery = doc?.delivery || ''
  if (String(delivery).includes('REFUSED') || doc?.dispatched === false) {
    throw new Error(doc?.refusal || 'Bot 拒绝了这条消息。')
  }
  const deadline = Date.now() + Math.min(Math.max(timeoutSec || 120, 15), 180) * 1000
  let last = ''
  let stableSince = 0
  while (Date.now() < deadline) {
    const entries = await listTranscript(auth, bot.id, 100)
    const user = entries.find((entry) => entry.clientNonce === nonce)
    if (user) {
      const replies = entries
        .filter((entry) => entry.kind === 'send-message' && entry._seq > user._seq)
        .map(entryText)
        .map((item) => item.trim())
        .filter((item) => item && !isProgress(item))
      const newest = (ready ? replies.findLast((item) => ready(item)) : replies.at(-1)) || ''
      if (newest) {
        if (settleMs <= 0) return { id: bot.id, name: bot.name, kind: bot.kind, reply: newest }
        if (newest === last) {
          if (Date.now() - stableSince >= settleMs) {
            return { id: bot.id, name: bot.name, kind: bot.kind, reply: newest }
          }
        } else {
          last = newest
          stableSince = Date.now()
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  if (last) return { id: bot.id, name: bot.name, kind: bot.kind, reply: last }
  throw new Error(`「${bot.name}」在时限内没有回复。可以打开 Grok Bot 看这条对话。`)
}

function renderJson(_args, value) {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

export function apply(ctx) {
  ctx.skills.register({
    name: SKILL_NAME,
    description: SKILL_DESCRIPTION,
    whenToUse: SKILL_WHEN,
    content: SKILL_BODY,
    source: 'runtime',
    invocation: { modelInvocable: true, userInvocable: true },
  })

  registerMemoryTools(ctx, { loadAuth, listBots, resolveBot, sendAndWait, rpc, defineTool, renderJson })
  registerMoreTools(ctx, { loadAuth, listBots, resolveBot, sendAndWait, listTranscript, defineTool, renderJson, entryText })

  ctx.tools.register(defineTool({
    name: 'grok_bot_list',
    description: '先加载技能 grok-bot。列出当前账号云端的 Bot，不是本机进程。kind 为 team 的是团队房间，也可以被 grok_bot_ask 点名。',
    parameters: {},
    output: { schema: objectSchema, render: renderJson },
    async execute() {
      const bots = await listBots(loadAuth())
      return { bots }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'grok_bot_ask',
    description: '先加载技能 grok-bot。把一句话发给云端的一个 Bot 或团队房间，只取回聊天回复。它在自己的电脑上干活，结果文件不在本机。回复同时出现在官方对话里。',
    parameters: {
      bot: { type: 'string', required: true, description: 'Bot 或团队房间的名字，也可以是 id' },
      text: { type: 'string', required: true, description: '要发送的原文' },
      timeoutSec: { type: 'number', description: '等待回复的秒数，默认 120，最多 180' },
    },
    timeoutMs: 190000,
    output: { schema: objectSchema, render: renderJson },
    async execute(args) {
      const auth = loadAuth()
      const bot = resolveBot(await listBots(auth), args.bot)
      return await sendAndWait(auth, bot, String(args.text || ''), args.timeoutSec)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'grok_bot_ask_team',
    description: '先加载技能 grok-bot。把同一句话分别发给几个云端 Bot，各自回复。不是发给一个团队房间；团队房间用 grok_bot_ask。最多 8 个。结果文件仍在各自的电脑上。',
    parameters: {
      bots: { type: 'array', required: true, description: 'Bot 名字或 id 的列表', items: { type: 'string' } },
      text: { type: 'string', required: true, description: '要发送的原文' },
      timeoutSec: { type: 'number', description: '每个 Bot 等待回复的秒数，默认 120' },
    },
    timeoutMs: 190000,
    output: { schema: objectSchema, render: renderJson },
    async execute(args) {
      const names = Array.isArray(args.bots) ? args.bots.map((item) => String(item).trim()).filter(Boolean) : []
      if (names.length === 0) throw new Error('bots 至少要有一个名字。')
      if (names.length > 8) throw new Error('一次最多问 8 个 Bot。')
      const auth = loadAuth()
      const known = await listBots(auth)
      const targets = names.map((name) => resolveBot(known, name))
      const replies = await Promise.all(targets.map(async (bot) => {
        try {
          return await sendAndWait(auth, bot, String(args.text || ''), args.timeoutSec)
        } catch (err) {
          return { id: bot.id, name: bot.name, kind: bot.kind, error: err.message }
        }
      }))
      return { replies }
    },
  }))
}
