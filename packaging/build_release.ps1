# Build the portable Windows student edition.
# Run from anywhere. Requires the repository .venv, Node.js, and npm.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$Python = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    throw "Missing $Python"
}

$Version = "0.1.0"
$Match = Select-String -Path (Join-Path $Root "backend\app\__init__.py") -Pattern '__version__ = "([^"]+)"'
if ($Match) {
    $Version = $Match.Matches[0].Groups[1].Value
}

Write-Output "Building frontend $Version"
Push-Location (Join-Path $Root "frontend")
npm run build
Pop-Location

& $Python -m pip install "pyinstaller>=6.11,<7"
$Dist = Join-Path $Root "release\pyinstaller"
$Work = Join-Path $Root "release\pyi-work"
if (Test-Path $Dist) { Remove-Item -Recurse -Force $Dist }
& $Python -m PyInstaller --noconfirm --clean --distpath $Dist --workpath $Work (Join-Path $Root "packaging\hdl-maker.spec")

$App = Join-Path $Dist "HDL-Maker"
if (-not (Test-Path (Join-Path $App "HDL-Maker.exe"))) {
    throw "HDL-Maker.exe was not produced"
}
Copy-Item (Join-Path $Root "packaging\STUDENT.txt") (Join-Path $App "README.txt") -Force

$Forbidden = Get-ChildItem $App -Recurse -File | Where-Object {
    $_.FullName -match '\\libs\\|\\workspace\\'
}
if ($Forbidden) {
    throw "The package contains libs or workspace files."
}

$Stage = Join-Path $Root "release\stage"
if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Path (Join-Path $Stage "HDL-Maker") | Out-Null
& robocopy $App (Join-Path $Stage "HDL-Maker") /E /NFL /NDL /NJH /NJS /R:8 /W:2
if ($LASTEXITCODE -ge 8) {
    throw "Could not copy the build into the ZIP staging folder."
}
$Zip = Join-Path $Root "release\HDL-Maker-$Version-win64.zip"
$Packed = $false
foreach ($Attempt in 1..8) {
    if (Test-Path $Zip) { Remove-Item -Force $Zip }
    try {
        Compress-Archive -Path (Join-Path $Stage "HDL-Maker") -DestinationPath $Zip -ErrorAction Stop
        $Packed = $true
        break
    } catch {
        Start-Sleep -Seconds 2
    }
}
if (-not $Packed) {
    throw "Could not write $Zip"
}
$Hash = Get-FileHash -Algorithm SHA256 $Zip
$Sums = Join-Path $Root "release\SHA256SUMS.txt"
Set-Content -Path $Sums -Encoding ascii -Value "$($Hash.Hash)  $(Split-Path -Leaf $Zip)"
Write-Output "Wrote $Zip"
Write-Output $Hash.Hash
