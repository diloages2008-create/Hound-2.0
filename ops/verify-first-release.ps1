param(
  [Parameter(Mandatory = $true)][string]$ApiBase,
  [string]$ApiKey = "",
  [Parameter(Mandatory = $true)][string]$StudioEmail,
  [Parameter(Mandatory = $true)][string]$StudioPassword,
  [Parameter(Mandatory = $true)][string]$ListenerEmail,
  [Parameter(Mandatory = $true)][string]$ListenerPassword,
  [Parameter(Mandatory = $true)][string]$AudioFilePath,
  [string]$CoverFilePath = "",
  [string]$ReleaseTitle = "Codex Verification Release",
  [int]$PublishTimeoutSec = 600,
  [int]$PollIntervalSec = 8
)

$ErrorActionPreference = "Stop"

function New-JsonHeaders([string]$Token = "") {
  $headers = @{ "Content-Type" = "application/json" }
  if ($ApiKey) {
    $headers["apikey"] = $ApiKey
  }
  if ($Token) {
    $headers["Authorization"] = "Bearer $Token"
  }
  return $headers
}

function Invoke-ApiJson {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Url,
    [hashtable]$Headers = $null,
    [object]$Body = $null
  )

  $invokeParams = @{
    Method = $Method
    Uri = $Url
    ErrorAction = "Stop"
  }

  if ($Headers) { $invokeParams["Headers"] = $Headers }
  if ($Body -ne $null) { $invokeParams["Body"] = ($Body | ConvertTo-Json -Depth 10) }

  try {
    return Invoke-RestMethod @invokeParams
  } catch {
    if ($_.Exception.Response) {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $bodyText = $reader.ReadToEnd()
      throw "API failed: $Method $Url`n$bodyText"
    }
    throw
  }
}

function Get-ContentTypeFromPath([string]$Path) {
  $ext = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
  switch ($ext) {
    ".wav" { "audio/wav"; break }
    ".mp3" { "audio/mpeg"; break }
    ".flac" { "audio/flac"; break }
    ".m4a" { "audio/mp4"; break }
    ".aac" { "audio/aac"; break }
    ".ogg" { "audio/ogg"; break }
    ".opus" { "audio/opus"; break }
    ".jpg" { "image/jpeg"; break }
    ".jpeg" { "image/jpeg"; break }
    ".png" { "image/png"; break }
    default { "application/octet-stream" }
  }
}

function Upload-FileToSignedUrl {
  param(
    [Parameter(Mandatory = $true)][string]$UploadUrl,
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string]$ContentType
  )

  if (-not ($UploadUrl -match "^https?://")) {
    throw "Upload URL is not absolute: $UploadUrl"
  }

  $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
  if ($curl) {
    & curl.exe -sS -X PUT -H "Content-Type: $ContentType" --upload-file $FilePath $UploadUrl | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "curl upload failed with exit code $LASTEXITCODE"
    }
    return
  }

  Invoke-RestMethod -Method Put -Uri $UploadUrl -InFile $FilePath -ContentType $ContentType -ErrorAction Stop | Out-Null
}

if (-not (Test-Path $AudioFilePath)) {
  throw "Audio file not found: $AudioFilePath"
}
if ($CoverFilePath -and -not (Test-Path $CoverFilePath)) {
  throw "Cover file not found: $CoverFilePath"
}

$ApiBase = $ApiBase.TrimEnd("/")
$trackId = [guid]::NewGuid().ToString()

Write-Host "1/9 Studio auth..."
$studioLogin = $null
try {
  $studioLogin = Invoke-ApiJson -Method "POST" -Url "$ApiBase/v1/auth/artist/login" -Headers (New-JsonHeaders) -Body @{
    email = $StudioEmail
    password = $StudioPassword
  }
} catch {
  Write-Host "Artist login failed, attempting signup..."
  $studioLogin = Invoke-ApiJson -Method "POST" -Url "$ApiBase/v1/auth/artist/signup" -Headers (New-JsonHeaders) -Body @{
    email = $StudioEmail
    password = $StudioPassword
    stageName = "Codex Artist"
    ownsMasters = $true
    rightsStatement = "I own rights for verification upload."
  }
}
$artistToken = $studioLogin.accessToken
if (-not $artistToken) { throw "Missing artist access token." }

Write-Host "2/9 Create release draft..."
$createdRelease = Invoke-ApiJson -Method "POST" -Url "$ApiBase/v1/studio/releases" -Headers (New-JsonHeaders $artistToken) -Body @{
  title = $ReleaseTitle
  genre = "Indie"
  moodTags = @("verification", "v0.1")
  releaseType = "single"
  about = "Automated end-to-end verification release."
}
$releaseId = $createdRelease.releaseId
if (-not $releaseId) { throw "Release creation did not return releaseId." }

Write-Host "3/9 Request/upload master..."
$audioName = [System.IO.Path]::GetFileName($AudioFilePath)
$audioType = Get-ContentTypeFromPath -Path $AudioFilePath
$masterIntent = Invoke-ApiJson -Method "POST" -Url "$ApiBase/v1/studio/releases/$releaseId/uploads/master-intent" -Headers (New-JsonHeaders $artistToken) -Body @{
  fileName = $audioName
  contentType = $audioType
}
Upload-FileToSignedUrl -UploadUrl $masterIntent.uploadUrl -FilePath $AudioFilePath -ContentType $audioType
$masterLength = (Get-Item $AudioFilePath).Length
Invoke-ApiJson -Method "POST" -Url "$ApiBase/v1/studio/uploads/$($masterIntent.assetId)/complete" -Headers (New-JsonHeaders $artistToken) -Body @{
  byteSize = $masterLength
} | Out-Null

$coverAssetId = $null
if ($CoverFilePath) {
  Write-Host "4/9 Request/upload cover..."
  $coverName = [System.IO.Path]::GetFileName($CoverFilePath)
  $coverType = Get-ContentTypeFromPath -Path $CoverFilePath
  $coverIntent = Invoke-ApiJson -Method "POST" -Url "$ApiBase/v1/studio/releases/$releaseId/uploads/cover-intent" -Headers (New-JsonHeaders $artistToken) -Body @{
    fileName = $coverName
    contentType = $coverType
  }
  Upload-FileToSignedUrl -UploadUrl $coverIntent.uploadUrl -FilePath $CoverFilePath -ContentType $coverType
  $coverLength = (Get-Item $CoverFilePath).Length
  Invoke-ApiJson -Method "POST" -Url "$ApiBase/v1/studio/uploads/$($coverIntent.assetId)/complete" -Headers (New-JsonHeaders $artistToken) -Body @{
    byteSize = $coverLength
  } | Out-Null
  $coverAssetId = $coverIntent.assetId
}

Write-Host "5/9 Submit release (queue transcode job)..."
$submitBody = @{
  coverAssetId = $coverAssetId
  tracks = @(
    @{
      trackId = $trackId
      title = "Verification Track"
      trackNumber = 1
      masterAssetId = $masterIntent.assetId
      credits = @(
        @{ personName = "Codex"; role = "producer" }
      )
    }
  )
}
Invoke-ApiJson -Method "POST" -Url "$ApiBase/v1/studio/releases/$releaseId/submit" -Headers (New-JsonHeaders $artistToken) -Body $submitBody | Out-Null

Write-Host "6/9 Wait for transcode worker readiness and publish..."
$publishSucceeded = $false
$start = Get-Date
do {
  Start-Sleep -Seconds $PollIntervalSec
  try {
    $publishResult = Invoke-ApiJson -Method "POST" -Url "$ApiBase/v1/studio/releases/$releaseId/publish" -Headers (New-JsonHeaders $artistToken)
    if ($publishResult.status -eq "live") {
      $publishSucceeded = $true
      break
    }
  } catch {
    Write-Host "Publish not ready yet; retrying..."
  }
  $elapsed = ((Get-Date) - $start).TotalSeconds
} while ($elapsed -lt $PublishTimeoutSec)

if (-not $publishSucceeded) {
  throw "Publish did not succeed before timeout (${PublishTimeoutSec}s). Check worker logs and transcode_jobs."
}

Write-Host "7/9 Listener auth..."
$listenerLogin = $null
try {
  $listenerLogin = Invoke-ApiJson -Method "POST" -Url "$ApiBase/v1/auth/listener/login" -Headers (New-JsonHeaders) -Body @{
    email = $ListenerEmail
    password = $ListenerPassword
  }
} catch {
  Write-Host "Listener login failed, attempting signup..."
  $listenerLogin = Invoke-ApiJson -Method "POST" -Url "$ApiBase/v1/auth/listener/signup" -Headers (New-JsonHeaders) -Body @{
    email = $ListenerEmail
    password = $ListenerPassword
  }
}
$listenerToken = $listenerLogin.accessToken
if (-not $listenerToken) { throw "Missing listener access token." }

Write-Host "8/9 Verify catalog + stream URL..."
$album = Invoke-ApiJson -Method "GET" -Url "$ApiBase/v1/listener/albums/$releaseId" -Headers (New-JsonHeaders $listenerToken)
$albumTrack = $album.tracks | Select-Object -First 1
if (-not $albumTrack.trackId) { throw "No track found in released album." }
$stream = Invoke-ApiJson -Method "GET" -Url "$ApiBase/v1/listener/tracks/$($albumTrack.trackId)/stream" -Headers (New-JsonHeaders $listenerToken)
if (-not $stream.manifestUrl) { throw "Stream endpoint did not return manifestUrl." }

Write-Host "9/9 Post cloud telemetry verification events..."
$eventId = [guid]::NewGuid().ToString()
Invoke-ApiJson -Method "POST" -Url "$ApiBase/v1/listener/telemetry/plays" -Headers (New-JsonHeaders $listenerToken) -Body @{
  events = @(
    @{
      eventId = $eventId
      trackId = $albumTrack.trackId
      playStartTime = (Get-Date).ToUniversalTime().ToString("o")
      playEndTime = (Get-Date).ToUniversalTime().ToString("o")
      percentListened = 100
      skippedEarly = $false
      replayedSameSession = 0
      completedPlay = $true
      manualSkip = $false
      autoAdvance = $true
    }
  )
} | Out-Null

Write-Host ""
Write-Host "SUCCESS"
Write-Host "releaseId: $releaseId"
Write-Host "trackId:   $($albumTrack.trackId)"
Write-Host "manifest:  $($stream.manifestUrl)"
Write-Host "eventId:   $eventId"
