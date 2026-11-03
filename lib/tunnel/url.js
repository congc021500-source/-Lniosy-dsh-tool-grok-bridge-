const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g
const TRY_CLOUDFLARE_URL = /https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.trycloudflare\.com(?![a-z0-9.-])/i

export function extractTryCloudflareUrl(logText) {
  if (typeof logText !== 'string' || logText.length === 0) return null
  const match = logText.replace(ANSI, '').match(TRY_CLOUDFLARE_URL)
  return match ? match[0] : null
}
