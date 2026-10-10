param(
  [Parameter(Mandatory = $true)]
  [int]$FirstSupervisorProcessId,
  [string]$FirstManifest = ".zgr-migrations\archive-01-abdou.json",
  [string]$SecondManifest = ".zgr-migrations\archive-02-amir.json",
  [ValidateRange(1, 20)]
  [int]$MaxPasses = 10,
  [ValidateRange(10, 600)]
  [int]$RetryDelaySeconds = 60
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$activeManifestFile = Join-Path $projectRoot ".zgr-migrations\active-manifest.txt"

if (-not $env:ZGR_ARCHIVE_ADMIN_TOKEN) {
  throw "ZGR_ARCHIVE_ADMIN_TOKEN absent de la session d’enchaînement."
}

function Get-RemainingClients([string]$ManifestPath) {
  $data = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
  return @($data.clients | Where-Object {
      $_.dateConfirmed -eq $true -and
      $_.eligibility -ne "excluded" -and
      $_.status -ne "excluded" -and
      $_.status -ne "completed"
    })
}

Wait-Process -Id $FirstSupervisorProcessId -ErrorAction SilentlyContinue

$firstRemaining = Get-RemainingClients $FirstManifest
if ($firstRemaining.Count -gt 0) {
  throw "Le lot ABDOU conserve $($firstRemaining.Count) dossier(s) non terminé(s). AMIR ne sera pas lancé."
}

[System.IO.File]::WriteAllText(
  (Resolve-Path -LiteralPath (Split-Path -Parent $activeManifestFile)).Path + "\active-manifest.txt",
  ".zgr-migrations\archive-02-amir.json`n",
  [System.Text.UTF8Encoding]::new($false)
)
Write-Output "Lot ABDOU terminé. Démarrage contrôlé du lot AMIR."

for ($pass = 1; $pass -le $MaxPasses; $pass += 1) {
  Write-Output "Passage AMIR $pass/$MaxPasses"
  & node scripts/migrate-onedrive-archives.mjs migrate `
    --manifest $SecondManifest `
    --execute `
    --only-confirmed `
    --actor "admin-migration-archive" `
    --continue-on-error `
    --upload-concurrency 4
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  $remaining = Get-RemainingClients $SecondManifest
  if ($remaining.Count -eq 0) {
    Write-Output "Migration terminée : ABDOU et AMIR sont entièrement synchronisés."
    exit 0
  }

  $errorCount = @($remaining | Where-Object { $_.status -eq "error" }).Count
  Write-Output "$($remaining.Count) dossier(s) AMIR restant(s), dont $errorCount erreur(s) à reprendre."
  if ($pass -lt $MaxPasses) { Start-Sleep -Seconds $RetryDelaySeconds }
}

Write-Error "Migration AMIR incomplète après $MaxPasses passages."
exit 2
