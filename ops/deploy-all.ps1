param(
  [string]$SecretsFile = "$HOME/.hound-secrets/Hound.env",
  [switch]$SkipSupabase,
  [switch]$SkipVercel,
  [switch]$SkipRender,
  [string]$SupabaseProjectRef,
  [string]$EdgeSupabaseUrl,
  [string]$EdgeServiceRoleKey,
  [string]$StorageBucketMasters = "hound-masters",
  [string]$StorageBucketCovers = "hound-covers",
  [string]$StorageBucketStreams = "hound-streams",
  [string]$VercelToken,
  [string]$ListenerUiDir = "apps/hound-listener/ui",
  [string]$StudioDir = "apps/hound-studio",
  [switch]$SkipListenerUi,
  [switch]$SkipStudio,
  [string]$RenderApiKey,
  [string]$RenderApiBase = "https://api.render.com/v1",
  [string]$RenderServiceIds = "",
  [string]$ApiBase = "",
  [string]$ListenerUrl = "",
  [string]$StudioUrl = ""
)

$ErrorActionPreference = "Stop"

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

function Coalesce([string[]]$Values) {
  foreach ($v in $Values) {
    if ($v -and $v.Trim().Length -gt 0) { return $v.Trim() }
  }
  return ""
}

function Test-HttpGet([string]$Url) {
  if (-not $Url) { return }
  try {
    $res = Invoke-WebRequest -UseBasicParsing -Method GET -Uri $Url -TimeoutSec 20
    Write-Host ("HEALTH OK {0} ({1})" -f $Url, [int]$res.StatusCode)
  } catch {
    $response = $_.Exception.Response
    if ($response) {
      try {
        $code = [int]$response.StatusCode
        Write-Host ("HEALTH REACHABLE {0} ({1})" -f $Url, $code) -ForegroundColor Yellow
      } catch {
        Write-Host ("HEALTH FAIL {0} ({1})" -f $Url, $_.Exception.Message) -ForegroundColor Yellow
      }
      return
    }
    Write-Host ("HEALTH FAIL {0} ({1})" -f $Url, $_.Exception.Message) -ForegroundColor Yellow
  }
}

$secrets = Read-EnvFile $SecretsFile
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

$SupabaseProjectRef = Coalesce @(
  $SupabaseProjectRef,
  $env:SUPABASE_PROJECT_REF,
  $secrets["SUPABASE_PROJECT_REF"]
)
$EdgeSupabaseUrl = Coalesce @(
  $EdgeSupabaseUrl,
  $env:EDGE_SUPABASE_URL,
  $secrets["EDGE_SUPABASE_URL"],
  $secrets["SUPABASE_URL"]
)
$EdgeServiceRoleKey = Coalesce @(
  $EdgeServiceRoleKey,
  $env:EDGE_SERVICE_ROLE_KEY,
  $secrets["EDGE_SERVICE_ROLE_KEY"],
  $secrets["SERVICE_ROLE_KEY"]
)
$VercelToken = Coalesce @(
  $VercelToken,
  $env:VERCEL_TOKEN,
  $secrets["VERCEL_TOKEN"]
)
$RenderApiKey = Coalesce @(
  $RenderApiKey,
  $env:RENDER_API_KEY,
  $secrets["RENDER_API_KEY"]
)
$RenderServiceIds = Coalesce @(
  $RenderServiceIds,
  $env:RENDER_SERVICE_IDS,
  $secrets["RENDER_SERVICE_IDS"]
)

if (-not $ApiBase -and $SupabaseProjectRef) {
  $ApiBase = "https://$SupabaseProjectRef.supabase.co/functions/v1/api-v1"
}

Write-Host "=== Deploy All ==="
Write-Host "repo: $repoRoot"

if (-not $SkipSupabase) {
  if (-not $SupabaseProjectRef -or -not $EdgeSupabaseUrl -or -not $EdgeServiceRoleKey) {
    Write-Host "Supabase: skipped (missing SupabaseProjectRef / EdgeSupabaseUrl / EdgeServiceRoleKey)" -ForegroundColor Yellow
  } else {
    Write-Host "Supabase: deploying api-v1 + secrets + migrations..."
    $deployScript = Join-Path $repoRoot "ops/deploy-v01.ps1"
    & powershell -ExecutionPolicy Bypass -File $deployScript `
      -SupabaseProjectRef $SupabaseProjectRef `
      -EdgeSupabaseUrl $EdgeSupabaseUrl `
      -EdgeServiceRoleKey $EdgeServiceRoleKey `
      -StorageBucketMasters $StorageBucketMasters `
      -StorageBucketCovers $StorageBucketCovers `
      -StorageBucketStreams $StorageBucketStreams `
      -SecretsFile $SecretsFile
  }
}

if (-not $SkipVercel) {
  if (-not $VercelToken) {
    Write-Host "Vercel: skipped (missing VERCEL_TOKEN)" -ForegroundColor Yellow
  } else {
    if (-not $SkipListenerUi) {
      $listenerPath = Join-Path $repoRoot $ListenerUiDir
      if (Test-Path $listenerPath) {
        Push-Location $listenerPath
        try {
          Write-Host "Vercel: deploying listener UI from $ListenerUiDir ..."
          & npx vercel --prod --yes --token $VercelToken | Out-Host
        } finally {
          Pop-Location
        }
      } else {
        Write-Host "Vercel: listener UI dir not found: $listenerPath" -ForegroundColor Yellow
      }
    }
    if (-not $SkipStudio) {
      $studioPath = Join-Path $repoRoot $StudioDir
      if (Test-Path $studioPath) {
        # Deploy studio from repo root to avoid duplicating a Vercel rootDirectory
        # like apps/hound-studio/apps/hound-studio in workspace-linked projects.
        Push-Location $repoRoot
        try {
          Write-Host "Vercel: deploying studio from $StudioDir ..."
          & npx vercel --prod --yes --token $VercelToken | Out-Host
        } finally {
          Pop-Location
        }
      } else {
        Write-Host "Vercel: studio dir not found: $studioPath" -ForegroundColor Yellow
      }
    }
  }
}

if (-not $SkipRender) {
  if (-not $RenderApiKey -or -not $RenderServiceIds) {
    Write-Host "Render: skipped (missing RENDER_API_KEY or RENDER_SERVICE_IDS)" -ForegroundColor Yellow
  } else {
    $ids = $RenderServiceIds.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    foreach ($id in $ids) {
      $url = "$RenderApiBase/services/$id/deploys"
      Write-Host "Render: triggering deploy for service $id ..."
      try {
        $res = Invoke-RestMethod -Method Post -Uri $url -Headers @{
          "Authorization" = "Bearer $RenderApiKey"
          "Accept" = "application/json"
        }
        if ($res.id) {
          Write-Host "Render deploy accepted: service=$id deployId=$($res.id)"
        } else {
          Write-Host "Render deploy accepted: service=$id"
        }
      } catch {
        Write-Host ("Render deploy failed for {0}: {1}" -f $id, $_.Exception.Message) -ForegroundColor Yellow
      }
    }
  }
}

Write-Host ""
Write-Host "=== Health Checks ==="
if ($ApiBase) {
  Test-HttpGet "$ApiBase/v1/listener/home"
}
if ($ListenerUrl) {
  Test-HttpGet $ListenerUrl
}
if ($StudioUrl) {
  Test-HttpGet $StudioUrl
}

Write-Host "Done."
