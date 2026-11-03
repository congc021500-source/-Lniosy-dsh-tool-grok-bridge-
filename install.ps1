#Requires -Version 5.1
<#
.SYNOPSIS
  Install dsh-tool-grok-bridge beside DeepSeek Harness.

.DESCRIPTION
  Copies this package into the DSH plugins directory, records the profile
  dependency and bundle, and writes a marked cordis patch. The MCP bridge
  stays disabled until Settings -> General -> Codex Bridge is turned on.
  Warns when dsh-tool-grok-bot or dsh-mcp-bridge is already present.

.PARAMETER DshRoot
  DeepSeek Harness installation directory. Required.

.PARAMETER DefaultCwd
  Workspace directory bridge tasks may use. Required. Stored as defaultCwd
  and the only workspace root.

.PARAMETER DshHome
  DSH data directory. Defaults to DSH_HOME or %USERPROFILE%\.dsh.

.PARAMETER SkipCloudflared
  Skip the optional cloudflared.exe download into %USERPROFILE%\.dsh\tools.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$DshRoot,
  [Parameter(Mandatory = $true)]
  [string]$DefaultCwd,
  [string]$DshHome,
  [switch]$SkipCloudflared
)

$ErrorActionPreference = 'Stop'
$PluginName = 'dsh-tool-grok-bridge'
$OldPlugins = @('dsh-tool-grok-bot', 'dsh-mcp-bridge')
$Source = $PSScriptRoot
$Editor = Join-Path $Source 'scripts\profile-package.mjs'

function Assert-Directory([string]$Path, [string]$Label) {
  if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
    throw "$Label does not exist or is not a directory: $Path"
  }
}

function Get-NodeExe {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $cmd) { throw 'node is required on PATH to update the DSH profile.' }
  return $cmd.Source
}

function Get-DshHomePath {
  if ($DshHome) { return $DshHome }
  if ($env:DSH_HOME) { return $env:DSH_HOME }
  return (Join-Path $env:USERPROFILE '.dsh')
}

function Get-FileDependency([string]$FromDir, [string]$ToDir) {
  $fromFull = [IO.Path]::GetFullPath($FromDir)
  $toFull = [IO.Path]::GetFullPath($ToDir)
  if (-not $fromFull.EndsWith('\')) { $fromFull += '\' }
  if (-not $toFull.EndsWith('\')) { $toFull += '\' }
  $rel = ([Uri]$fromFull).MakeRelativeUri([Uri]$toFull).ToString()
  $rel = [Uri]::UnescapeDataString($rel).TrimEnd('/')
  return "file:$rel"
}

function Get-ProfileDirs([string]$Home) {
  $roots = @((Join-Path $Home 'profiles'), (Join-Path $DshRoot 'profiles'))
  $dirs = @()
  foreach ($root in $roots) {
    if (-not (Test-Path -LiteralPath $root -PathType Container)) { continue }
    if ($env:DSH_PROFILE) {
      $one = Join-Path $root $env:DSH_PROFILE
      if (Test-Path -LiteralPath $one -PathType Container) { $dirs += $one }
      continue
    }
    $dirs += @(Get-ChildItem -LiteralPath $root -Directory | Where-Object {
      Test-Path -LiteralPath (Join-Path $_.FullName 'package.json')
    } | ForEach-Object { $_.FullName })
  }
  return @($dirs | Select-Object -Unique)
}

function Warn-OldPlugins([string]$Home) {
  foreach ($name in $OldPlugins) {
    $candidates = @(
      (Join-Path $Home "plugins\$name"),
      (Join-Path $DshRoot "resources\app\node_modules\$name"),
      (Join-Path $DshRoot "node_modules\$name")
    )
    foreach ($candidate in $candidates) {
      if (Test-Path -LiteralPath $candidate) {
        Write-Warning "Found old plugin $name at $candidate. Uninstall it or avoid registering the same grok_bot_* / dsh_* tools twice."
      }
    }
  }
}

function Warn-OldProfileEntries([string]$PackagePath) {
  if (-not (Test-Path -LiteralPath $PackagePath)) { return }
  $text = Get-Content -LiteralPath $PackagePath -Raw -ErrorAction SilentlyContinue
  foreach ($name in $OldPlugins) {
    if ($text -and $text.Contains('"' + $name + '"')) {
      Write-Warning "Profile package $PackagePath still references $name. Uninstall that plugin or avoid registering the same grok_bot_* / dsh_* tools twice."
    }
  }
}

function Copy-Plugin([string]$Dest) {
  $parent = Split-Path -Parent $Dest
  if (Test-Path -LiteralPath $Dest) { Remove-Item -LiteralPath $Dest -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  New-Item -ItemType Directory -Force -Path $Dest | Out-Null
  Get-ChildItem -LiteralPath $Source -Force | Where-Object {
    $_.Name -notin @('.git', 'node_modules')
  } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $Dest $_.Name) -Recurse -Force
  }
  Get-ChildItem -LiteralPath $Dest -Recurse -Force -File -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -eq '.env' -or $_.Name -like '.env.*' -or $_.Name -eq 'grok-bot.json' -or $_.Name -like 'cloudflared*' -or $_.Extension -eq '.log'
  } | Remove-Item -Force
}

function Install-Junction([string]$LinkPath, [string]$Target) {
  $parent = Split-Path -Parent $LinkPath
  if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  if (Test-Path -LiteralPath $LinkPath) {
    $item = Get-Item -LiteralPath $LinkPath -Force
    $isLink = [bool]($item.Attributes -band [IO.FileAttributes]::ReparsePoint)
    if (-not $isLink) {
      Write-Warning "Refusing to replace a real directory at $LinkPath"
      return
    }
    cmd.exe /c rmdir "$LinkPath" | Out-Null
  }
  New-Item -ItemType Junction -Path $LinkPath -Target $Target | Out-Null
  $manifest = Join-Path $LinkPath 'package.json'
  if (-not (Test-Path -LiteralPath $manifest)) {
    throw "Junction verification failed: $manifest"
  }
}

function Install-Cloudflared {
  $tools = Join-Path $env:USERPROFILE '.dsh\tools'
  $dest = Join-Path $tools 'cloudflared.exe'
  if (Test-Path -LiteralPath $dest) {
    Write-Host "cloudflared already present at $dest"
    return
  }
  New-Item -ItemType Directory -Force -Path $tools | Out-Null
  $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'amd64' }
  $download = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-$arch.exe"
  Write-Host "Downloading cloudflared to $dest"
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $download -OutFile $dest -UseBasicParsing
}

Assert-Directory $DshRoot 'DshRoot'
Assert-Directory $DefaultCwd 'DefaultCwd'
if (-not (Test-Path -LiteralPath $Editor)) { throw "Missing $Editor" }
$node = Get-NodeExe
$resolvedCwd = [IO.Path]::GetFullPath($DefaultCwd)
$home = Get-DshHomePath
$dest = Join-Path $home "plugins\$PluginName"

Warn-OldPlugins $home
Copy-Plugin $dest
& $node $Editor replace-patch (Join-Path $dest 'cordis.patch.yml') $resolvedCwd
if ($LASTEXITCODE -ne 0) { throw 'Failed to write the installed cordis patch.' }

$profiles = Get-ProfileDirs $home
if ($profiles.Count -eq 0) {
  Write-Warning "No DSH profile with package.json was found under $home or $DshRoot. The package was copied to $dest."
}

foreach ($profile in $profiles) {
  $packagePath = Join-Path $profile 'package.json'
  Warn-OldProfileEntries $packagePath
  if (Test-Path -LiteralPath $packagePath) {
    $dep = Get-FileDependency $profile $dest
    & $node $Editor add $packagePath $dep
    if ($LASTEXITCODE -ne 0) { throw "Failed to update $packagePath" }
  }
  & $node $Editor write-patch (Join-Path $profile 'cordis.yml') $resolvedCwd
  if ($LASTEXITCODE -ne 0) { throw "Failed to write cordis patch for $profile" }
  Install-Junction (Join-Path $profile "node_modules\$PluginName") $dest
  $pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
  if ($pnpm) {
    Push-Location $profile
    try {
      & pnpm install
      if ($LASTEXITCODE -ne 0) { Write-Warning "pnpm install failed in $profile. The package files and profile patch are still in place." }
    } finally {
      Pop-Location
    }
  } else {
    Write-Warning "pnpm was not found. Run pnpm install in $profile when it is available."
  }
}

foreach ($modules in @(
  (Join-Path $DshRoot 'resources\app\node_modules'),
  (Join-Path $DshRoot 'resources\app.asar.unpacked\node_modules'),
  (Join-Path $DshRoot 'node_modules')
)) {
  if (Test-Path -LiteralPath $modules -PathType Container) {
    Install-Junction (Join-Path $modules $PluginName) $dest
  }
}

if (-not $SkipCloudflared) {
  try {
    Install-Cloudflared
  } catch {
    Write-Warning "Optional cloudflared bootstrap failed: $($_.Exception.Message)"
  }
}

Write-Host "Installed $PluginName to $dest"
Write-Host "DefaultCwd: $resolvedCwd"
Write-Host "The MCP bridge is still disabled. Quit DeepSeek Harness completely, open it again, then turn on Settings -> General -> Codex Bridge."
Write-Host "Start a quick tunnel with: powershell -ExecutionPolicy Bypass -File `"$(Join-Path $dest 'scripts\start-tunnel.ps1')`""
Write-Host "Copy the printed TUNNEL_URL, append /mcp, and add that connector by hand in Grok Bot. This installer does not edit the Grok Bot account."
Write-Host "The quick tunnel hostname changes every restart. Update the Grok Bot connector when it does."
