param(
  [string]$SupabaseProjectRef,
  [string]$EdgeSupabaseUrl,
  [string]$EdgeServiceRoleKey,
  [string]$StorageBucketMasters = "hound-masters",
  [string]$StorageBucketCovers = "hound-covers",
  [string]$StorageBucketStreams = "hound-streams",
  [string]$SecretsFile = "$HOME/.hound-secrets/Hound.env",
  [string]$SupabaseProjectDir = "apps/hound-listener"
)

$ErrorActionPreference = "Stop"

function Resolve-SupabaseCli([string]$RepoRoot) {
  $globalCmd = Get-Command supabase -ErrorAction SilentlyContinue
  if ($globalCmd) { return $globalCmd.Source }

  $localExe = Join-Path $RepoRoot ".tools/supabase/supabase.exe"
  if (Test-Path $localExe) { return $localExe }

  throw "Supabase CLI not found. Install globally or place binary at .tools/supabase/supabase.exe"
}

function Read-EnvFile([string]$Path) {
  $map = @{}
  if (-not (Test-Path $Path)) { return $map }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { return }
    $key = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim()
    if ($value.StartsWith('"') -and $value.EndsWith('"')) { $value = $value.Substring(1, $value.Length - 2) }
    if ($value.StartsWith("'") -and $value.EndsWith("'")) { $value = $value.Substring(1, $value.Length - 2) }
    $map[$key] = $value
  }
  return $map
}

$secrets = Read-EnvFile $SecretsFile

if (-not $EdgeSupabaseUrl) {
  $EdgeSupabaseUrl = $env:EDGE_SUPABASE_URL
}
if (-not $EdgeSupabaseUrl -and $secrets.ContainsKey("EDGE_SUPABASE_URL")) {
  $EdgeSupabaseUrl = $secrets["EDGE_SUPABASE_URL"]
}
if (-not $EdgeSupabaseUrl -and $secrets.ContainsKey("SUPABASE_URL")) {
  $EdgeSupabaseUrl = $secrets["SUPABASE_URL"]
}

if (-not $EdgeServiceRoleKey) {
  $EdgeServiceRoleKey = $env:EDGE_SERVICE_ROLE_KEY
}
if (-not $EdgeServiceRoleKey -and $secrets.ContainsKey("EDGE_SERVICE_ROLE_KEY")) {
  $EdgeServiceRoleKey = $secrets["EDGE_SERVICE_ROLE_KEY"]
}
if (-not $EdgeServiceRoleKey -and $secrets.ContainsKey("SERVICE_ROLE_KEY")) {
  $EdgeServiceRoleKey = $secrets["SERVICE_ROLE_KEY"]
}

if (-not $SupabaseProjectRef) {
  $SupabaseProjectRef = $env:SUPABASE_PROJECT_REF
}
if (-not $SupabaseProjectRef -and $secrets.ContainsKey("SUPABASE_PROJECT_REF")) {
  $SupabaseProjectRef = $secrets["SUPABASE_PROJECT_REF"]
}
if (-not $SupabaseProjectRef -and $EdgeSupabaseUrl -match "^https://([a-z0-9-]+)\.supabase\.co") {
  $SupabaseProjectRef = $Matches[1]
}

if (-not $SupabaseProjectRef) {
  throw "Missing SupabaseProjectRef. Pass -SupabaseProjectRef or set SUPABASE_PROJECT_REF in $SecretsFile"
}
if (-not $EdgeSupabaseUrl) {
  throw "Missing EdgeSupabaseUrl. Pass -EdgeSupabaseUrl or set EDGE_SUPABASE_URL/SUPABASE_URL in $SecretsFile"
}
if (-not $EdgeServiceRoleKey) {
  throw "Missing EdgeServiceRoleKey. Pass -EdgeServiceRoleKey or set EDGE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY in $SecretsFile"
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$supabaseCli = Resolve-SupabaseCli -RepoRoot $repoRoot
$projectDirPath = Join-Path $repoRoot $SupabaseProjectDir
if (-not (Test-Path $projectDirPath)) {
  throw "Supabase project directory not found: $projectDirPath"
}
Write-Host "Using Supabase CLI: $supabaseCli"
Write-Host "Supabase project dir: $projectDirPath"

Push-Location $projectDirPath
try {
  Write-Host "Linking Supabase project..."
  & $supabaseCli link --project-ref $SupabaseProjectRef

  Write-Host "Pushing DB migrations..."
  & $supabaseCli db push

  Write-Host "Setting edge function secrets..."
  & $supabaseCli secrets set `
    EDGE_SUPABASE_URL=$EdgeSupabaseUrl `
    EDGE_SERVICE_ROLE_KEY=$EdgeServiceRoleKey `
    STORAGE_BUCKET_MASTERS=$StorageBucketMasters `
    STORAGE_BUCKET_COVERS=$StorageBucketCovers `
    STORAGE_BUCKET_STREAMS=$StorageBucketStreams

  Write-Host "Deploying api-v1 function..."
  & $supabaseCli functions deploy api-v1 --no-verify-jwt
} finally {
  Pop-Location
}

Write-Host "Deploy complete."
