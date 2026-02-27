param(
  [Parameter(Mandatory = $true)][string]$SupabaseProjectRef,
  [Parameter(Mandatory = $true)][string]$EdgeSupabaseUrl,
  [Parameter(Mandatory = $true)][string]$EdgeServiceRoleKey,
  [string]$StorageBucketMasters = "hound-masters",
  [string]$StorageBucketCovers = "hound-covers",
  [string]$StorageBucketStreams = "hound-streams"
)

$ErrorActionPreference = "Stop"

Write-Host "Linking Supabase project..."
supabase link --project-ref $SupabaseProjectRef

Write-Host "Pushing DB migrations..."
supabase db push

Write-Host "Setting edge function secrets..."
supabase secrets set `
  EDGE_SUPABASE_URL=$EdgeSupabaseUrl `
  EDGE_SERVICE_ROLE_KEY=$EdgeServiceRoleKey `
  STORAGE_BUCKET_MASTERS=$StorageBucketMasters `
  STORAGE_BUCKET_COVERS=$StorageBucketCovers `
  STORAGE_BUCKET_STREAMS=$StorageBucketStreams

Write-Host "Deploying api-v1 function..."
supabase functions deploy api-v1 --no-verify-jwt

Write-Host "Deploy complete."
