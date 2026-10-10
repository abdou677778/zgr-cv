param(
  [Parameter(Mandatory = $true)]
  [int]$WaitForProcessId,
  [string]$Manifest = ".zgr-migrations\archive-01-abdou.json",
  [string]$Decisions = ".zgr-migrations\archive-01-abdou.low-date-decisions.json"
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

& node scripts/migrate-onedrive-archives.mjs migrate `
  --manifest $Manifest `
  --execute `
  --only-confirmed `
  --actor "admin-migration-archive" `
  --continue-on-error
exit $LASTEXITCODE
