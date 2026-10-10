param(
  [string]$Manifest = ".zgr-migrations\archive-01-abdou.json",
  [int]$RefreshSeconds = 5,
  [switch]$FollowActive,
  [switch]$Once
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$defaultManifestPath = if ([System.IO.Path]::IsPathRooted($Manifest)) {
  $Manifest
} else {
  Join-Path $projectRoot $Manifest
}
$activeManifestFile = Join-Path $projectRoot ".zgr-migrations\active-manifest.txt"
$migrationLog = Join-Path $projectRoot ".zgr-migrations\migration.stdout.log"
$migrationErrors = Join-Path $projectRoot ".zgr-migrations\migration.stderr.log"
$continuationLog = Join-Path $projectRoot ".zgr-migrations\continuation.stdout.log"
$continuationErrors = Join-Path $projectRoot ".zgr-migrations\continuation.stderr.log"
$batchLog = Join-Path $projectRoot ".zgr-migrations\batch.stdout.log"
$batchErrors = Join-Path $projectRoot ".zgr-migrations\batch.stderr.log"

function Get-CurrentManifestPath {
  if ($FollowActive -and (Test-Path -LiteralPath $activeManifestFile)) {
    $selected = [string](Get-Content -LiteralPath $activeManifestFile -TotalCount 1)
    if (-not [string]::IsNullOrWhiteSpace($selected)) {
      if ([System.IO.Path]::IsPathRooted($selected)) { return $selected.Trim() }
      return Join-Path $projectRoot $selected.Trim()
    }
  }
  return $defaultManifestPath
}

function Format-Size([double]$Bytes) {
  if ($Bytes -ge 1GB) { return "{0:N2} Go" -f ($Bytes / 1GB) }
  if ($Bytes -ge 1MB) { return "{0:N2} Mo" -f ($Bytes / 1MB) }
  if ($Bytes -ge 1KB) { return "{0:N2} Ko" -f ($Bytes / 1KB) }
  return "{0:N0} octets" -f $Bytes
}

function Get-Percent([double]$Current, [double]$Total) {
  if ($Total -le 0) { return 0 }
  return [Math]::Round(($Current / $Total) * 100, 1)
}

function Get-TemporaryUsage {
  $directories = @(Get-ChildItem -LiteralPath $env:TEMP -Directory -Filter "zgr-archive-*" -ErrorAction SilentlyContinue)
  $bytes = 0
  foreach ($directory in $directories) {
    $sum = (Get-ChildItem -LiteralPath $directory.FullName -File -Recurse -ErrorAction SilentlyContinue |
      Measure-Object -Property Length -Sum).Sum
    if ($null -ne $sum) { $bytes += [double]$sum }
  }
  return [PSCustomObject]@{ Directories = $directories.Count; Bytes = $bytes }
}

function Get-LastUsefulLine([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return "" }
  $line = Get-Content -LiteralPath $Path -Tail 30 -ErrorAction SilentlyContinue |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    Select-Object -Last 1
  return [string]$line
}

function Get-FriendlyError([string]$Message) {
  if ($Message -match "Worker exceeded resource limits") {
    return "Cloudflare 503 : limite temporaire du Worker, reprise programmée"
  }
  if ($Message -match "synchronisation Google Drive est déjà en cours") {
    return "Google Drive occupé : reprise programmée"
  }
  $plain = [regex]::Replace($Message, "<[^>]+>", " ")
  $plain = [regex]::Replace($plain, "\s+", " ").Trim()
  if ($plain.Length -gt 95) { return $plain.Substring(0, 95) + "..." }
  return $plain
}

function Show-MigrationStatus {
  $currentManifestPath = Get-CurrentManifestPath
  if (-not (Test-Path -LiteralPath $currentManifestPath)) {
    throw "Manifeste introuvable : $currentManifestPath"
  }

  $manifest = Get-Content -Raw -LiteralPath $currentManifestPath | ConvertFrom-Json
  $eligible = @($manifest.clients | Where-Object {
      $_.eligibility -ne "excluded" -and $_.status -ne "excluded"
    })
  $excluded = @($manifest.clients | Where-Object {
      $_.eligibility -eq "excluded" -or $_.status -eq "excluded"
    })
  $completed = @($eligible | Where-Object { $_.status -eq "completed" })
  $inProgress = @($eligible | Where-Object { $_.status -eq "created" })
  $errors = @($eligible | Where-Object { $_.status -eq "error" })
  $pending = @($eligible | Where-Object { $_.status -eq "pending" })
  $confirmed = @($eligible | Where-Object { $_.dateConfirmed -eq $true })
  $files = @($eligible | ForEach-Object { @($_.files) })
  $transferredFiles = @($files | Where-Object { $_.status -in @("uploaded", "duplicate") })
  $totalBytesValue = ($files | Measure-Object -Property sizeBytes -Sum).Sum
  $transferredBytesValue = ($transferredFiles | Measure-Object -Property sizeBytes -Sum).Sum
  $totalBytes = if ($null -eq $totalBytesValue) { 0 } else { [double]$totalBytesValue }
  $transferredBytes = if ($null -eq $transferredBytesValue) { 0 } else { [double]$transferredBytesValue }
  $clientPercent = Get-Percent $completed.Count $eligible.Count
  $filePercent = Get-Percent $transferredFiles.Count $files.Count
  $bytePercent = Get-Percent $transferredBytes $totalBytes
  $temp = Get-TemporaryUsage

  $migrationProcesses = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "^(node|node\.exe|pwsh|pwsh\.exe)$" -and $_.CommandLine -match "migrate-onedrive-archives|continue-confirmed-archive-migration|continue-archive-batches" })

  $activityFiles = @($migrationLog, $migrationErrors, $continuationLog, $continuationErrors, $batchLog, $batchErrors) |
    Where-Object { Test-Path -LiteralPath $_ } |
    ForEach-Object { Get-Item -LiteralPath $_ }
  $lastActivityAt = $activityFiles |
    Sort-Object -Property LastWriteTime -Descending |
    Select-Object -First 1 -ExpandProperty LastWriteTime
  $stalled = $migrationProcesses.Count -gt 0 -and
    $null -ne $lastActivityAt -and
    ((Get-Date) - $lastActivityAt).TotalMinutes -ge 8

  $state = if ($completed.Count -eq $eligible.Count) {
    "TERMINE"
  } elseif ($stalled) {
    "BLOQUE - REPRISE NECESSAIRE"
  } elseif ($migrationProcesses.Count -gt 0) {
    "EN COURS"
  } elseif ($errors.Count -gt 0) {
    "INTERROMPU AVEC ERREURS"
  } else {
    "EN ATTENTE"
  }

  try { Clear-Host } catch { }
  Write-Host "============================================================" -ForegroundColor DarkCyan
  Write-Host "        ZGR - SUIVI DE LA MIGRATION DES ARCHIVES" -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor DarkCyan
  Write-Host ("Lot         : {0}" -f [System.IO.Path]::GetFileNameWithoutExtension($currentManifestPath)) -ForegroundColor Cyan
  Write-Host ("Mise à jour : {0:dd/MM/yyyy HH:mm:ss}" -f (Get-Date))
  Write-Host "État        : $state" -ForegroundColor $(if ($state -eq "TERMINE") { "Green" } elseif ($state -eq "EN COURS") { "Yellow" } else { "Red" })
  if ($null -ne $lastActivityAt) {
    Write-Host ("Activité     : {0:dd/MM/yyyy HH:mm:ss} ({1:N1} min)" -f $lastActivityAt, ((Get-Date) - $lastActivityAt).TotalMinutes)
  }
  Write-Host ""
  Write-Host ("Clients     : {0}/{1} terminés ({2} %)" -f $completed.Count, $eligible.Count, $clientPercent)
  Write-Host ("Fichiers    : {0}/{1} envoyés ({2} %)" -f $transferredFiles.Count, $files.Count, $filePercent)
  Write-Host ("Volume      : {0}/{1} ({2} %)" -f (Format-Size $transferredBytes), (Format-Size $totalBytes), $bytePercent)
  Write-Host ("Dates       : {0}/{1} confirmées" -f $confirmed.Count, $eligible.Count)
  Write-Host ("En cours    : {0} | En attente : {1} | Erreurs à reprendre : {2} | Exclus : {3}" -f $inProgress.Count, $pending.Count, $errors.Count, $excluded.Count)
  Write-Host ""

  if ($inProgress.Count -gt 0) {
    Write-Host "Dossier actuellement traité :" -ForegroundColor Cyan
    $inProgress | Select-Object -First 3 | ForEach-Object { Write-Host "  - $($_.clientName)" }
  }

  if ($errors.Count -gt 0) {
    Write-Host ""
    Write-Host "Erreurs temporaires à reprendre automatiquement :" -ForegroundColor Yellow
    $errors | Select-Object -Last 5 | ForEach-Object {
      $shortError = Get-FriendlyError ([string]$_.lastError)
      Write-Host "  - $($_.clientName) : $shortError"
    }
  }

  Write-Host ""
  Write-Host ("Espace local temporaire : {0} dans {1} dossier(s)" -f (Format-Size $temp.Bytes), $temp.Directories) -ForegroundColor Green
  Write-Host "Jusqu’à 4 fichiers sont traités en parallèle, puis supprimés immédiatement." -ForegroundColor Green
  Write-Host "Aucune copie complète de l’archive n’est conservée sur ce PC." -ForegroundColor Green
  Write-Host ""
  $lastLine = Get-LastUsefulLine $migrationLog
  if ([string]::IsNullOrWhiteSpace($lastLine)) { $lastLine = Get-LastUsefulLine $continuationLog }
  if ($FollowActive -and (Test-Path -LiteralPath $batchLog)) {
    $batchLine = Get-LastUsefulLine $batchLog
    if (-not [string]::IsNullOrWhiteSpace($batchLine)) { $lastLine = $batchLine }
  }
  if (-not [string]::IsNullOrWhiteSpace($lastLine)) {
    Write-Host "Dernière opération : $lastLine"
  }
  $errorBytes = 0
  foreach ($path in @($migrationErrors, $continuationErrors, $batchErrors)) {
    if (Test-Path -LiteralPath $path) { $errorBytes += (Get-Item -LiteralPath $path).Length }
  }
  Write-Host "Journaux : $projectRoot\.zgr-migrations"
  Write-Host ("Taille des journaux d’erreurs : {0}" -f (Format-Size $errorBytes))
  if (-not $Once) {
    Write-Host ""
    Write-Host "Actualisation toutes les $RefreshSeconds secondes. Ctrl+C pour fermer ce suivi." -ForegroundColor DarkGray
  }
}

do {
  try {
    Show-MigrationStatus
  } catch {
    try { Clear-Host } catch { }
    Write-Host "Impossible de lire le suivi : $($_.Exception.Message)" -ForegroundColor Red
  }
  if (-not $Once) { Start-Sleep -Seconds ([Math]::Max(2, $RefreshSeconds)) }
} while (-not $Once)
