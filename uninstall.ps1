#Requires -Version 5.1
<#
.SYNOPSIS
  Remove dsh-tool-grok-bridge profile markers and its installed package.

.DESCRIPTION
  Deletes only this plugin's marked cordis block, dependency, bundle entry,
  junctions, and plugin directory. Other plugins, cloudflared, and unrelated
  profile settings are left in place.

.PARAMETER DshRoot
  DeepSeek Harness installation directory. Required.

.PARAMETER DshHome
  DSH data directory. Defaults to DSH_HOME or %USERPROFILE%\.dsh.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$DshRoot,
  [string]$DshHome
)

$ErrorActionPreference = 'Stop'
$PluginName = 'dsh-tool-grok-bridge'

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
    $dirs += @(Get-ChildItem -LiteralPath $root -Directory | ForEach-Object { $_.FullName })
  }
  return @($dirs | Select-Object -Unique)
}

function Remove-OurJunction([string]$LinkPath, [string]$PluginDest) {
  if (-not (Test-Path -LiteralPath $LinkPath)) { return }
  $item = Get-Item -LiteralPath $LinkPath -Force
  $isLink = [bool]($item.Attributes -band [IO.FileAttributes]::ReparsePoint)
  if (-not $isLink) {
    Write-Warning "Skipping $LinkPath because it is not a junction."
    return
  }
  $expected = [IO.Path]::GetFullPath($PluginDest).TrimEnd('\')
  $matched = $false
  foreach ($target in @($item.Target)) {
    if (-not $target) { continue }
    $full = [IO.Path]::GetFullPath([string]$target).TrimEnd('\')
    if ($full -eq $expected) { $matched = $true }
  }
  if (-not $matched) {
    Write-Warning "Skipping junction $LinkPath because it does not point at this plugin."
    return
  }
  cmd.exe /c rmdir "$LinkPath" | Out-Null
  Write-Host "Removed junction $LinkPath"
}

if (-not (Test-Path -LiteralPath $DshRoot -PathType Container)) {
  throw "DshRoot does not exist or is not a directory: $DshRoot"
}

$node = Get-NodeExe
$editor = Join-Path $PSScriptRoot 'scripts\profile-package.mjs'
if (-not (Test-Path -LiteralPath $editor)) { throw "Missing $editor" }
$home = Get-DshHomePath
$dest = Join-Path $home "plugins\$PluginName"

foreach ($profile in (Get-ProfileDirs $home)) {
  $packagePath = Join-Path $profile 'package.json'
  if (Test-Path -LiteralPath $packagePath) {
    & $node $editor remove $packagePath
    if ($LASTEXITCODE -ne 0) { throw "Failed to update $packagePath" }
    Write-Host "Removed $PluginName from $packagePath"
  }
  $patch = Join-Path $profile 'cordis.yml'
  if (Test-Path -LiteralPath $patch) {
    & $node $editor clear-patch $patch
    if ($LASTEXITCODE -ne 0) { throw "Failed to clear markers in $patch" }
    Write-Host "Cleared $PluginName markers in $patch"
  }
  Remove-OurJunction (Join-Path $profile "node_modules\$PluginName") $dest
}

foreach ($modules in @(
  (Join-Path $DshRoot 'resources\app\node_modules'),
  (Join-Path $DshRoot 'resources\app.asar.unpacked\node_modules'),
  (Join-Path $DshRoot 'node_modules')
)) {
  Remove-OurJunction (Join-Path $modules $PluginName) $dest
}

if (Test-Path -LiteralPath $dest) {
  Remove-Item -LiteralPath $dest -Recurse -Force
  Write-Host "Removed $dest"
}

Write-Host "Uninstall finished. Other plugins and cloudflared were left in place."
Write-Host "Quit DeepSeek Harness and open it again so the profile reloads."
