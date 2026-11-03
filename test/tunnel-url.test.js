import assert from 'node:assert/strict'
import test from 'node:test'
import { extractTryCloudflareUrl } from '../lib/tunnel/url.js'

const sampleLog = [
  'INF Requesting new quick Tunnel on trycloudflare.com...',
  'INF +--------------------------------------------------------------------------------------------+',
  'INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |',
  'INF |  https://placeholder-subdomain.trycloudflare.com                                            |',
  'INF +--------------------------------------------------------------------------------------------+',
  'INF cloudflared will proxy http://127.0.0.1:8931',
].join('\n')

test('extracts the https trycloudflare origin from a cloudflared log', () => {
  assert.equal(
    extractTryCloudflareUrl(sampleLog),
    'https://placeholder-subdomain.trycloudflare.com',
  )
})

test('extracts a url wrapped in ansi color codes', () => {
  const colored = 'INF \u001b[1;32mhttps://placeholder-subdomain.trycloudflare.com\u001b[0m'
  assert.equal(
    extractTryCloudflareUrl(colored),
    'https://placeholder-subdomain.trycloudflare.com',
  )
})

test('returns null when the log has no quick tunnel url', () => {
  assert.equal(extractTryCloudflareUrl('cloudflared started\nno hostname yet'), null)
  assert.equal(extractTryCloudflareUrl(''), null)
  assert.equal(extractTryCloudflareUrl('http://127.0.0.1:8931'), null)
  assert.equal(extractTryCloudflareUrl('https://example.com/mcp'), null)
  assert.equal(extractTryCloudflareUrl(null), null)
})
