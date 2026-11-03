#Requires -Version 5.1
<#
.SYNOPSIS
  Start a Cloudflare quick tunnel to the local DSH MCP bridge.

.DESCRIPTION
  Proxies http://127.0.0.1:8931 and prints TUNNEL_URL=https://<subdomain>.trycloudflare.com.
  Append /mcp in Grok Bot. The hostname changes every time this tunnel restarts.
  This script does not edit the Grok Bot account.
  The URL pattern matches lib/tunnel/url.js.
#>
[CmdletBinding()]
param(
  [string]$Target = 'http://127.0.0.1:8931'
)

$ErrorActionPreference = 'Stop'
$ToolsDir = Join-Path $env:USERPROFILE '.dsh\tools'
$LocalExe = Join-Path $ToolsDir 'cloudflared.exe'

function Get-CloudflaredExe {
  if (Test-Path -LiteralPath $LocalExe) { return $LocalExe }
  $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null
  $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'amd64' }
  $download = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-$arch.exe"
  Write-Host "Downloading cloudflared to $LocalExe"
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $download -OutFile $LocalExe -UseBasicParsing
  return $LocalExe
}

function Strip-Ansi([string]$Text) {
  return ($Text -replace "$([char]27)\[[0-9;]*[A-Za-z]", '')
}

$exe = Get-CloudflaredExe
Write-Host "Starting quick tunnel to $Target"
Write-Host "Bridge default MCP path is /mcp. Add the printed URL manually in Grok Bot. This script does not change the Grok Bot account."
Write-Host "Quick tunnel hostnames change when cloudflared restarts. Update the connector after each restart."

$script:printed = $false
& $exe tunnel --url $Target --no-autoupdate 2>&1 | ForEach-Object {
  $line = Strip-Ansi ([string]$_)
  Write-Host $line
  if ($script:printed) { return }
  if ($line -match 'https://[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.trycloudflare\.com') {
    $url = $Matches[0]
    $script:printed = $true
    Write-Host "TUNNEL_URL=$url"
    Write-Host "MCP connector URL: $url/mcp"
    Write-Host "In Grok Bot, add an MCP connector by hand with that URL."
  }
}

if (-not $script:printed) {
  Write-Warning "cloudflared exited without printing a trycloudflare URL."
  exit 1
}
