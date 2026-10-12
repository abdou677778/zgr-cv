param(
  [string]$Manifest = ".zgr-migrations\\archive-06-meriem.json",
  [string]$ExpectedDriveRoot = "12ZWlrOkzQUlW52F1QCU0FaZjxzxwK_Qj",
  [ValidateRange(1, 12)]
  [int]$MaxPasses = 8,
  [ValidateRange(120, 900)]
  [int]$RetryDelaySeconds = 150
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if ([string]::IsNullOrWhiteSpace($env:ZGR_ARCHIVE_ADMIN_TOKEN)) {
  throw "ZGR_ARCHIVE_ADMIN_TOKEN est absent. Définissez-le uniquement dans cette fenêtre avant de lancer la reprise."
}

$active = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -match "^node(\.exe)?$" -and $_.CommandLine -match "migrate-onedrive-archives"
})
if ($active.Count -gt 0) {
  throw "Une migration est déjà active (PID : $($active.ProcessId -join ', ')). La reprise parallèle est volontairement refusée."
}

Write-Host "Précontrôle sans écriture…" -ForegroundColor Cyan
& node scripts/migrate-onedrive-archives.mjs migrate `
  --manifest $Manifest `
  --only-confirmed `
  --expected-drive-root $ExpectedDriveRoot `
  --upload-concurrency 1
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

for ($pass = 1; $pass -le $MaxPasses; $pass += 1) {
  Write-Host "`nReprise prudente $pass/$MaxPasses : un seul fichier et une seule synchronisation Drive." -ForegroundColor Yellow
  & node scripts/migrate-onedrive-archives.mjs migrate `
    --manifest $Manifest `
    --execute `
    --only-confirmed `
    --actor "admin-migration-archive" `
    --continue-on-error `
    --expected-drive-root $ExpectedDriveRoot `
    --upload-concurrency 1
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  $data = Get-Content -Raw -LiteralPath $Manifest | ConvertFrom-Json
  $remaining = @($data.clients | Where-Object {
    $_.eligibility -ne "excluded" -and $_.status -ne "excluded" -and $_.dateConfirmed -eq $true -and $_.status -ne "completed"
  })
  if ($remaining.Count -eq 0) {
    Write-Host "Migration terminée : tous les dossiers avec date confirmée sont synchronisés." -ForegroundColor Green
    exit 0
  }

  Write-Host "$($remaining.Count) dossier(s) confirmé(s) restent à reprendre. Attente de $RetryDelaySeconds secondes pour libérer le verrou Drive/Worker." -ForegroundColor Yellow
  if ($pass -lt $MaxPasses) { Start-Sleep -Seconds $RetryDelaySeconds }
}

Write-Error "Reprise arrêtée après $MaxPasses passages. Le suivi contient les erreurs restantes, sans suppression de fichier source."
exit 2
