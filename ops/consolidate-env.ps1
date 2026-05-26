param(
  [string]$RepoRoot = "",
  [string]$PublicEnvPath = "",
  [string]$MasterSecretsPath = "",
  [switch]$WriteAppEnvFiles,
  [switch]$ArchiveOriginalEnvFiles,
  [switch]$PreviewOnly,
  [switch]$ShowMergedContent
)

$ErrorActionPreference = "Stop"

function Normalize-Path([string]$Path) {
  return [System.IO.Path]::GetFullPath($Path)
}

function Read-EnvMap([string]$Path) {
  $map = @{}
  if (-not (Test-Path $Path)) { return $map }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    if ($line.StartsWith("export ")) { $line = $line.Substring(7).Trim() }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { return }
    $key = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1)
    if ($key -match '^[A-Za-z_][A-Za-z0-9_]*$') {
      $map[$key] = $value
    }
  }
  return $map
}

function Write-EnvFile([string]$Path, [hashtable]$Map, [string]$Header = "") {
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  $lines = @()
  if ($Header) {
    $lines += "# $Header"
    $lines += ""
  }
  foreach ($k in ($Map.Keys | Sort-Object)) {
    $lines += "$k=$($Map[$k])"
  }
  Set-Content -Path $Path -Value $lines -Encoding UTF8
}

function Get-EnvEntryCount([string]$Path) {
  $count = 0
  if (-not (Test-Path $Path)) { return 0 }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    if ($line.StartsWith("export ")) { $line = $line.Substring(7).Trim() }
    $eq = $line.IndexOf("=")
    if ($eq -ge 1) { $count += 1 }
  }
  return $count
}

function Get-ReferencedEnvKeys([string]$Root) {
  $keys = @{}
  $scanFiles = Get-ChildItem -Path $Root -Recurse -File -Include "*.env", "*.env.*", "*.js", "*.jsx", "*.ts", "*.tsx", "*.mjs", "*.cjs", "*.ps1", "*.sh" |
    Where-Object {
      $_.FullName -notmatch "\\node_modules\\" -and
      $_.FullName -notmatch "\\.git\\" -and
      $_.FullName -notmatch "\\dist\\" -and
      $_.FullName -notmatch "\\backups\\"
    }

  foreach ($file in $scanFiles) {
    $content = Get-Content $file.FullName -Raw

    foreach ($m in [regex]::Matches($content, 'process\.env\.([A-Z][A-Z0-9_]*)')) {
      $keys[$m.Groups[1].Value] = $true
    }
    foreach ($m in [regex]::Matches($content, 'import\.meta\.env\.([A-Z][A-Z0-9_]*)')) {
      $keys[$m.Groups[1].Value] = $true
    }
    foreach ($m in [regex]::Matches($content, 'Deno\.env\.get\(["'']([A-Z][A-Z0-9_]*)["'']\)')) {
      $keys[$m.Groups[1].Value] = $true
    }
    foreach ($m in [regex]::Matches($content, '(?m)^\s*([A-Z][A-Z0-9_]*)\s*=')) {
      $keys[$m.Groups[1].Value] = $true
    }
  }

  return @($keys.Keys)
}

if (-not $RepoRoot) {
  $RepoRoot = Normalize-Path (Join-Path $PSScriptRoot "..")
} else {
  $RepoRoot = Normalize-Path $RepoRoot
}

if (-not (Test-Path $RepoRoot)) {
  throw "RepoRoot not found: $RepoRoot"
}

if (-not $PublicEnvPath) {
  $PublicEnvPath = Join-Path $RepoRoot ".env.public"
}
$publicPath = Normalize-Path $PublicEnvPath

if (-not $MasterSecretsPath) {
  $MasterSecretsPath = Join-Path $HOME ".hound-secrets/Hound.env"
}
$masterPath = Normalize-Path $MasterSecretsPath

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $RepoRoot "backups/env-consolidation-$timestamp"

Write-Host "RepoRoot: $RepoRoot"
Write-Host "Public env file: $publicPath"
Write-Host "Master secrets file: $masterPath"
Write-Host "Backup folder: $backupRoot"

$envFiles = Get-ChildItem -Path $RepoRoot -Recurse -File -Include ".env", ".env.*" |
  Where-Object {
    $_.FullName -notmatch "\\node_modules\\" -and
    $_.FullName -notmatch "\\.git\\" -and
    $_.FullName -notmatch "\\dist\\" -and
    $_.FullName -ne $publicPath -and
    $_.FullName -ne $masterPath
  }

$orderedFiles = @()
if (Test-Path $masterPath) { $orderedFiles += (Get-Item $masterPath) }
$orderedFiles += ($envFiles | Sort-Object FullName)

$merged = @{}
foreach ($file in $orderedFiles) {
  $data = Read-EnvMap $file.FullName
  foreach ($k in $data.Keys) {
    $v = $data[$k]
    if (-not $merged.ContainsKey($k)) {
      $merged[$k] = $v
      continue
    }
    $existing = $merged[$k]
    $newHasValue = $v -and $v.Trim().Length -gt 0
    $existingHasValue = $existing -and $existing.Trim().Length -gt 0
    if ($newHasValue -or (-not $existingHasValue)) {
      $merged[$k] = $v
    }
  }
}

# Prefer currently-exported shell secrets if present.
$priorityKeys = @(
  "SUPABASE_PROJECT_REF",
  "EDGE_SUPABASE_URL",
  "EDGE_SERVICE_ROLE_KEY",
  "SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VERCEL_TOKEN",
  "RENDER_API_KEY",
  "RENDER_SERVICE_IDS"
)
foreach ($k in $priorityKeys) {
  $v = [Environment]::GetEnvironmentVariable($k, "Process")
  if ($v -and $v.Trim().Length -gt 0) {
    $merged[$k] = $v
  }
}

# Build public env map (browser-safe keys only).
$publicMap = @{}
foreach ($k in $merged.Keys) {
  if ($k -like "VITE_*") {
    $publicMap[$k] = $merged[$k]
  }
}

$totalEntries = 0
foreach ($f in $envFiles) {
  $totalEntries += Get-EnvEntryCount $f.FullName
}
$detectedKeys = Get-ReferencedEnvKeys $RepoRoot
foreach ($k in $detectedKeys) {
  if (-not $merged.ContainsKey($k)) {
    $merged[$k] = ""
  }
}

Write-Host ""
Write-Host "Discovered env files: $($envFiles.Count)"
foreach ($f in ($envFiles | Sort-Object FullName)) {
  Write-Host (" - " + $f.FullName)
}
Write-Host "Total KEY=value rows across discovered files: $totalEntries"
Write-Host "Detected keys across source/env files: $($detectedKeys.Count)"
Write-Host "Unique merged keys: $($merged.Keys.Count)"
Write-Host "Public keys (VITE_*): $($publicMap.Keys.Count)"

if ($ShowMergedContent) {
  Write-Host ""
  Write-Host "Merged private content preview (alphabetical):"
  foreach ($k in ($merged.Keys | Sort-Object)) {
    Write-Host ("{0}={1}" -f $k, $merged[$k])
  }
}

if ($PreviewOnly) {
  Write-Host ""
  Write-Host "PreviewOnly enabled: no files were written."
  return
}

$listenerEnvPath = Join-Path $RepoRoot "apps/hound-listener/ui/.env.local"
$studioEnvPath = Join-Path $RepoRoot "apps/hound-studio/.env.local"

if ($ArchiveOriginalEnvFiles) {
  New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
  foreach ($file in $envFiles) {
    if ($file.FullName -eq $publicPath -or $file.FullName -eq $masterPath) { continue }
    $relative = $file.FullName.Substring($RepoRoot.Length).TrimStart("\")
    $dest = Join-Path $backupRoot $relative
    $destDir = Split-Path -Parent $dest
    if (-not (Test-Path $destDir)) {
      New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    }
    Move-Item -Path $file.FullName -Destination $dest -Force
  }
  Write-Host "Archived original env files to: $backupRoot"
} else {
  Write-Host "ArchiveOriginalEnvFiles not set: original env files left in place."
}

Write-EnvFile -Path $publicPath -Map $publicMap -Header "Hound public env (safe for frontend/runtime)"
Write-EnvFile -Path $masterPath -Map $merged -Header "Hound private master env (all keys)"

if ($WriteAppEnvFiles) {
  Write-EnvFile -Path $listenerEnvPath -Map $publicMap -Header "Listener web runtime env"
  Write-EnvFile -Path $studioEnvPath -Map $publicMap -Header "Studio web runtime env"
}

Write-Host ""
Write-Host "Wrote files:"
Write-Host " - $publicPath"
Write-Host " - $masterPath"
if ($WriteAppEnvFiles) {
  Write-Host " - $listenerEnvPath"
  Write-Host " - $studioEnvPath"
}

Write-Host ""
Write-Host "Presence check (true means non-empty):"
foreach ($k in @(
  "SUPABASE_PROJECT_REF",
  "EDGE_SUPABASE_URL",
  "EDGE_SERVICE_ROLE_KEY",
  "VERCEL_TOKEN",
  "RENDER_API_KEY",
  "RENDER_SERVICE_IDS"
)) {
  $present = $merged.ContainsKey($k) -and $merged[$k] -and $merged[$k].Trim().Length -gt 0
  Write-Host ("{0}={1}" -f $k, [bool]$present)
}

Write-Host ""
Write-Host "Done."
