param(
  [Parameter(Mandatory = $true)]
  [int]$WaitForProcessId,
  [string]$PrerequisiteManifest = ".zgr-migrations\archive-02-amir.json",
  [string]$MeriemManifest = ".zgr-migrations\archive-06-meriem.json",
  [string]$AyaManifest = ".zgr-migrations\archive-07-aya-khoussa.json",
  [string]$ExpectedDriveRoot = "12ZWlrOkzQUlW52F1QCU0FaZjxzxwK_Qj",
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

function Get-ManifestData([string]$ManifestPath) {
  return Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
}

function Get-RemainingConfirmedClients([string]$ManifestPath) {
  $data = Get-ManifestData $ManifestPath
  return @($data.clients | Where-Object {
      $_.dateConfirmed -eq $true -and
      $_.eligibility -ne "excluded" -and
      $_.status -ne "excluded" -and
      $_.status -ne "completed"
    })
}

function Set-ActiveManifest([string]$ManifestPath) {
  [System.IO.File]::WriteAllText(
    $activeManifestFile,
    "$ManifestPath`n",
    [System.Text.UTF8Encoding]::new($false)
  )
}

function Invoke-ArchiveBatch(
  [string]$Label,
  [string]$ManifestPath,
  [string]$Actor
) {
  Set-ActiveManifest $ManifestPath
  Write-Output "Démarrage contrôlé du lot $Label — attribution : $Actor."

  for ($pass = 1; $pass -le $MaxPasses; $pass += 1) {
    Write-Output "Passage $Label $pass/$MaxPasses"
    & node scripts/migrate-onedrive-archives.mjs migrate `
      --manifest $ManifestPath `
      --execute `
      --only-confirmed `
      --actor $Actor `
      --continue-on-error `
      --expected-drive-root $ExpectedDriveRoot `
      --upload-concurrency 4
    if ($LASTEXITCODE -ne 0) {
      throw "Le passage $Label $pass a échoué avec le code $LASTEXITCODE."
    }

    $remaining = Get-RemainingConfirmedClients $ManifestPath
    if ($remaining.Count -eq 0) {
      $data = Get-ManifestData $ManifestPath
      $deferred = @($data.clients | Where-Object {
          $_.eligibility -ne "excluded" -and
          $_.status -ne "excluded" -and
          $_.dateConfirmed -ne $true
        }).Count
      Write-Output "Lot $Label terminé pour toutes les dates confirmées. Dates à vérifier ultérieurement : $deferred."
      return
    }

    $errorCount = @($remaining | Where-Object { $_.status -eq "error" }).Count
    Write-Output "$($remaining.Count) dossier(s) $Label restant(s), dont $errorCount erreur(s) à reprendre."
    if ($pass -lt $MaxPasses) { Start-Sleep -Seconds $RetryDelaySeconds }
  }

  throw "Migration $Label incomplète après $MaxPasses passages."
}

Wait-Process -Id $WaitForProcessId -ErrorAction SilentlyContinue

$prerequisiteRemaining = Get-RemainingConfirmedClients $PrerequisiteManifest
if ($prerequisiteRemaining.Count -gt 0) {
  throw "Le lot AMIR conserve $($prerequisiteRemaining.Count) dossier(s) confirmé(s) non terminé(s). Les lots des rédactrices restent en attente."
}

Invoke-ArchiveBatch "06 - MERIEM" $MeriemManifest "Meriem (rédactrice)"
Invoke-ArchiveBatch "07 - AYA KHOUSSA" $AyaManifest "Aya Khoussa (rédactrice)"

Write-Output "File des rédactrices terminée pour toutes les dates confirmées."
