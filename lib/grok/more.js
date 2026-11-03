import { randomUUID } from 'node:crypto'

const objectSchema = { type: 'object', additionalProperties: true }

function clip(text, max = 1500) {
  const value = String(text || '').trim()
  if (value.length <= max) return value
  return `${value.slice(0, max)}…`
}

function turn(entry, entryText) {
  const text = clip(entryText(entry))
  if (!text) return null
  if (entry.kind === 'send-message') return { role: 'bot', text }
  if (entry.role === 'user' || entry.kind === 'message') return { role: 'user', text }
  return null
}

export function registerMoreTools(ctx, { loadAuth, listBots, resolveBot, sendAndWait, listTranscript, defineTool, renderJson, entryText }) {
  ctx.tools.register(defineTool({
    name: 'grok_bot_status',
    description: '先加载技能 grok-bot。检查本机 Grok Bot 登录能不能用，并数一下 Bot。动手前先调这个。',
    parameters: {},
    output: { schema: objectSchema, render: renderJson },
    async execute() {
      try {
        const bots = await listBots(loadAuth())
        return {
          ok: true,
          bots: bots.length,
          teams: bots.filter((bot) => bot.kind === 'team').length,
        }
      } catch (err) {
        return { ok: false, reason: err.message }
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'grok_bot_history',
    description: '先加载技能 grok-bot。读一个 Bot 或团队房间最近的对话，不新发消息。接着往下问之前先看这里。',
    parameters: {
      bot: { type: 'string', required: true, description: 'Bot 或团队房间的名字或 id' },
      limit: { type: 'number', description: '最多取多少条，默认 12，最多 30' },
    },
    output: { schema: objectSchema, render: renderJson },
    async execute(args) {
      const session = loadAuth()
      const bot = resolveBot(await listBots(session), args.bot)
      const limit = Math.min(Math.max(Number(args.limit) || 12, 1), 30)
      const entries = await listTranscript(session, bot.id, 100)
      const messages = entries.map((entry) => turn(entry, entryText)).filter(Boolean).slice(-limit)
      return { id: bot.id, name: bot.name, kind: bot.kind, messages }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'grok_bot_computer',
    description: '先加载技能 grok-bot。请一个 Bot 在它自己的云端电脑上做事，并把结果文字贴回聊天。文件仍留在那台电脑上，不会出现在本机。',
    parameters: {
      bot: { type: 'string', required: true, description: 'Bot 或团队房间的名字或 id' },
      task: { type: 'string', required: true, description: '要它在自己电脑上做的事' },
      timeoutSec: { type: 'number', description: '等待秒数，默认 180，最多 180' },
    },
    timeoutMs: 190000,
    output: { schema: objectSchema, render: renderJson },
    async execute(args) {
      const task = String(args.task || '').trim()
      if (!task) throw new Error('要写清让 Bot 在它自己的电脑上做什么。')
      const session = loadAuth()
      const bot = resolveBot(await listBots(session), args.bot)
      const id = randomUUID().replace(/-/g, '').slice(0, 8)
      const prompt = `[电脑任务 ${id}]
请只在你自己的云端电脑上做下面这件事。
用户这边的电脑上没有这些文件，不要假设能读到本机路径。
做完后把结果的文字贴进回复。文件留在你自己的电脑上。
如果云端电脑连不上、没有状态，或还在等登录，直接说明。
只回复 JSON：{"id":"${id}","ok":true,"text":"结果文字"}
做不到就回复 {"id":"${id}","ok":false,"reason":"原因"}。
任务：
<<<
${task}
>>>`
      const result = await sendAndWait(session, bot, prompt, args.timeoutSec || 180, (text) => text.includes(id))
      return { id: bot.id, name: bot.name, kind: bot.kind, reply: result.reply }
    },
  }))
}
