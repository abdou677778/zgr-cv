param(
  [Parameter(Mandatory = $true)]
  [int]$WaitForProcessId,
  [string]$Manifest = ".zgr-migrations\archive-01-abdou.json",
  [string]$Decisions = ".zgr-migrations\archive-01-abdou.low-date-decisions.json",
  [ValidateRange(1, 20)]
  [int]$MaxPasses = 6,
  [ValidateRange(10, 600)]
  [int]$RetryDelaySeconds = 45
)

$ErrorActionPreference = "Stop"

if (-not $env:ZGR_ARCHIVE_ADMIN_TOKEN) {
  throw "ZGR_ARCHIVE_ADMIN_TOKEN absent de la session de continuation."
}

Wait-Process -Id $WaitForProcessId -ErrorAction SilentlyContinue

& node scripts/migrate-onedrive-archives.mjs apply-date-decisions `
  --manifest $Manifest `
  --decisions $Decisions
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

for ($pass = 1; $pass -le $MaxPasses; $pass += 1) {
  Write-Output "Passage de migration $pass/$MaxPasses"
  & node scripts/migrate-onedrive-archives.mjs migrate `
    --manifest $Manifest `
    --execute `
    --only-confirmed `
    --actor "admin-migration-archive" `
    --continue-on-error
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  $manifestData = Get-Content -Raw -LiteralPath $Manifest | ConvertFrom-Json
  $remaining = @($manifestData.clients | Where-Object {
      $_.dateConfirmed -eq $true -and
      $_.eligibility -ne "excluded" -and
      $_.status -ne "excluded" -and
      $_.status -ne "completed"
    })
  if ($remaining.Count -eq 0) {
    Write-Output "Migration terminée : tous les dossiers confirmés sont synchronisés."
    exit 0
  }

  $errorCount = @($remaining | Where-Object { $_.status -eq "error" }).Count
  Write-Output "$($remaining.Count) dossier(s) restant(s), dont $errorCount erreur(s) à reprendre."
  if ($pass -lt $MaxPasses) {
    Write-Output "Nouvelle tentative dans $RetryDelaySeconds seconde(s)."
    Start-Sleep -Seconds $RetryDelaySeconds
  }
}

Write-Error "Migration incomplète après $MaxPasses passages. Consultez le moniteur et les journaux."
exit 2
