param(
  [string]$Manifest = ".zgr-migrations\\archive-06-meriem.json",
  [string]$ExpectedDriveRoot = "12ZWlrOkzQUlW52F1QCU0FaZjxzxwK_Qj",
  [ValidateRange(0, 500)]
  [int]$MaxPasses = 0,
  [ValidateRange(60, 1800)]
  [int]$BaseRetryDelaySeconds = 180
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if ([string]::IsNullOrWhiteSpace($env:ZGR_ARCHIVE_ADMIN_TOKEN)) {
  # The token is requested only in memory for this PowerShell process. It is
  # neither written to the manifest nor persisted as a Windows environment value.
  $secureToken = Read-Host "Jeton administrateur de migration" -AsSecureString
  $tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
  try {
    $env:ZGR_ARCHIVE_ADMIN_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
  }
  if ([string]::IsNullOrWhiteSpace($env:ZGR_ARCHIVE_ADMIN_TOKEN)) {
    throw "Aucun jeton n’a été saisi. La migration n’a pas été démarrée."
  }
}

$manifestPath = if ([IO.Path]::IsPathRooted($Manifest)) { $Manifest } else { Join-Path $projectRoot $Manifest }
$activeManifestFile = Join-Path $projectRoot ".zgr-migrations\\active-manifest.txt"
$logPath = Join-Path $projectRoot ".zgr-migrations\\continuation.stdout.log"
$errorPath = Join-Path $projectRoot ".zgr-migrations\\continuation.stderr.log"

function Get-RemainingConfirmed {
  $data = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
  return @($data.clients | Where-Object {
    $_.dateConfirmed -eq $true -and
    $_.eligibility -ne "excluded" -and
    $_.status -ne "excluded" -and
    $_.status -ne "completed"
  })
}

function Get-BackoffSeconds($Remaining) {
  $messages = @($Remaining | ForEach-Object { [string]$_.lastError }) -join "`n"
  if ($messages -match "Worker exceeded resource limits|Racine Google Drive refusée") { return [Math]::Max($BaseRetryDelaySeconds, 300) }
  if ($messages -match "synchronisation Google Drive est déjà en cours") { return [Math]::Max($BaseRetryDelaySeconds, 180) }
  if ($messages -match "EPERM|EACCES|EBUSY") { return 60 }
  return $BaseRetryDelaySeconds
}

[IO.File]::WriteAllText($activeManifestFile, ".zgr-migrations\\archive-06-meriem.json`n", [Text.UTF8Encoding]::new($false))
$pass = 0
while ($MaxPasses -eq 0 -or $pass -lt $MaxPasses) {
  $pass += 1
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  "[$stamp] Passage resilient $pass : reprise des dossiers confirmés non terminés." | Tee-Object -FilePath $logPath -Append

  & node scripts/migrate-onedrive-archives.mjs migrate `
    --manifest $Manifest `
    --execute `
    --only-confirmed `
    --actor "meriem-redactrice" `
    --continue-on-error `
    --expected-drive-root $ExpectedDriveRoot `
    --upload-concurrency 1 2>> $errorPath | Tee-Object -FilePath $logPath -Append
  $exitCode = $LASTEXITCODE

  $remaining = Get-RemainingConfirmed
  if ($remaining.Count -eq 0) {
    "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Terminé : tous les dossiers à date confirmée sont synchronisés." | Tee-Object -FilePath $logPath -Append
    exit 0
  }

  $delay = Get-BackoffSeconds $remaining
  "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $($remaining.Count) dossier(s) confirmé(s) restent. Code Node : $exitCode. Nouvelle tentative dans $delay secondes." | Tee-Object -FilePath $logPath -Append
  Start-Sleep -Seconds $delay
}

throw "Limite de $MaxPasses passages atteinte ; aucun fichier source n’a été supprimé."
