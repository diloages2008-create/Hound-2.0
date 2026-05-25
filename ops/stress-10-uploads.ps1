param(
  [Parameter(Mandatory = $true)][string]$ApiBase,
  [string]$ApiKey = "",
  [Parameter(Mandatory = $true)][string]$StudioEmail,
  [Parameter(Mandatory = $true)][string]$StudioPassword,
  [Parameter(Mandatory = $true)][string]$ListenerEmail,
  [Parameter(Mandatory = $true)][string]$ListenerPassword,
  [Parameter(Mandatory = $true)][string]$AudioFilePath,
  [string]$CoverFilePath = "",
  [int]$Runs = 10,
  [int]$PublishTimeoutSec = 600,
  [int]$PollIntervalSec = 8
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $AudioFilePath)) {
  throw "Audio file not found: $AudioFilePath"
}
if ($CoverFilePath -and -not (Test-Path $CoverFilePath)) {
  throw "Cover file not found: $CoverFilePath"
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$verifyScript = Join-Path $PSScriptRoot "verify-first-release.ps1"
if (-not (Test-Path $verifyScript)) {
  throw "Missing verify script: $verifyScript"
}

$ApiBase = $ApiBase.TrimEnd("/")

function New-JsonHeaders([string]$Token = "") {
  $headers = @{ "Content-Type" = "application/json" }
  if ($ApiKey) { $headers["apikey"] = $ApiKey }
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  return $headers
}

function Invoke-ApiJson {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Url,
    [hashtable]$Headers = $null,
    [object]$Body = $null
  )

  $params = @{
    Method = $Method
    Uri = $Url
    ErrorAction = "Stop"
  }
  if ($Headers) { $params["Headers"] = $Headers }
  if ($Body -ne $null) { $params["Body"] = ($Body | ConvertTo-Json -Depth 10) }

  try {
    return Invoke-RestMethod @params
  } catch {
    if ($_.Exception.Response) {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $bodyText = $reader.ReadToEnd()
      throw "API failed: $Method $Url`n$bodyText"
    }
    throw
  }
}

Write-Host "Authenticating operator view (artist login)..."
$studioLogin = Invoke-ApiJson -Method "POST" -Url "$ApiBase/v1/auth/artist/login" -Headers (New-JsonHeaders) -Body @{
  email = $StudioEmail
  password = $StudioPassword
}
$artistToken = $studioLogin.accessToken
if (-not $artistToken) {
  throw "Could not obtain artist token for operator metrics."
}

$results = @()
$startedAt = Get-Date
Write-Host "Starting stress loop: $Runs uploads"

for ($i = 1; $i -le $Runs; $i++) {
  $releaseTitle = "Stress Run $i $(Get-Date -Format 'yyyyMMdd-HHmmss')"
  $runStart = Get-Date
  $ok = $true
  $errorMessage = ""

  Write-Host ""
  Write-Host "=== Run $i / $Runs ==="
  Write-Host "Release title: $releaseTitle"

  try {
    & powershell -ExecutionPolicy Bypass -File $verifyScript `
      -ApiBase $ApiBase `
      -ApiKey $ApiKey `
      -StudioEmail $StudioEmail `
      -StudioPassword $StudioPassword `
      -ListenerEmail $ListenerEmail `
      -ListenerPassword $ListenerPassword `
      -AudioFilePath $AudioFilePath `
      -CoverFilePath $CoverFilePath `
      -ReleaseTitle $releaseTitle `
      -PublishTimeoutSec $PublishTimeoutSec `
      -PollIntervalSec $PollIntervalSec
    if ($LASTEXITCODE -ne 0) {
      throw "verify-first-release exited with code $LASTEXITCODE"
    }
  } catch {
    $ok = $false
    $errorMessage = $_.Exception.Message
    Write-Host "Run failed: $errorMessage" -ForegroundColor Red
  }

  $metrics = $null
  try {
    $overview = Invoke-ApiJson -Method "GET" -Url "$ApiBase/v1/operator/overview" -Headers (New-JsonHeaders $artistToken)
    $metrics = $overview.metrics
    Write-Host "Operator metrics snapshot:"
    Write-Host ("  uploadsToday={0} queued={1} failed24h={2} oldestJobAgeMinutes={3} playAttempts24h={4} playFailures24h={5}" -f `
      $metrics.uploadsToday, $metrics.transcodeQueued, $metrics.transcodeFailed24h, $metrics.oldestJobAgeMinutes, $metrics.playAttempts24h, $metrics.playFailures24h)
  } catch {
    Write-Host "Could not fetch operator metrics after run ${i}: $($_.Exception.Message)" -ForegroundColor Yellow
  }

  $elapsedSec = [int](((Get-Date) - $runStart).TotalSeconds)
  $results += [pscustomobject]@{
    run = $i
    ok = $ok
    elapsedSec = $elapsedSec
    error = $errorMessage
    uploadsToday = if ($metrics) { $metrics.uploadsToday } else { $null }
    transcodeQueued = if ($metrics) { $metrics.transcodeQueued } else { $null }
    transcodeFailed24h = if ($metrics) { $metrics.transcodeFailed24h } else { $null }
    oldestJobAgeMinutes = if ($metrics) { $metrics.oldestJobAgeMinutes } else { $null }
    playAttempts24h = if ($metrics) { $metrics.playAttempts24h } else { $null }
    playFailures24h = if ($metrics) { $metrics.playFailures24h } else { $null }
  }
}

$totalSec = [int](((Get-Date) - $startedAt).TotalSeconds)
$successCount = ($results | Where-Object { $_.ok }).Count
$failCount = $Runs - $successCount

Write-Host ""
Write-Host "=== Stress Summary ==="
Write-Host ("runs={0} success={1} failed={2} totalSec={3}" -f $Runs, $successCount, $failCount, $totalSec)
$results | Format-Table -AutoSize

$outDir = Join-Path $root "ops"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outFile = Join-Path $outDir "stress-10-uploads-$timestamp.json"
$results | ConvertTo-Json -Depth 5 | Set-Content -Path $outFile -Encoding UTF8
Write-Host "Saved run log: $outFile"

if ($failCount -gt 0) {
  throw "Stress test completed with failures ($failCount/$Runs). Check summary and operator metrics snapshots."
}
