# Builds a standalone setup.exe installer for VoronConstruct360
# Embeds the add-in files into a single Windows executable.
# No user or machine-specific info is baked in; paths are resolved dynamically at runtime.

$ErrorActionPreference = "Stop"
$ProgressPreference = 'SilentlyContinue'

$repoRoot = Split-Path -Parent $PSScriptRoot
$stage = Join-Path $PSScriptRoot "_stage"
$bundleZip = Join-Path $PSScriptRoot "_bundle.zip"
$installerCs = Join-Path $PSScriptRoot "Installer.cs"
$outputExe = Join-Path $repoRoot "setup.exe"
$faviconIco = Join-Path $repoRoot "public\favicon.ico"

Write-Host "=== Building VoronConstruct360 Setup.exe ===" -ForegroundColor Cyan

# 1. Prepare staging directory
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Path $stage | Out-Null

Write-Host "Staging plugin files..."
Copy-Item -Path (Join-Path $repoRoot "plugin\*") -Destination $stage -Recurse -Force

# Include python dependencies if present
$userLib = "$env:APPDATA\Autodesk\Autodesk Fusion 360\API\AddIns\Construct\lib"
$repoLib = Join-Path $repoRoot "plugin\lib"
if (Test-Path $repoLib) {
    Copy-Item -Path $repoLib -Destination (Join-Path $stage "lib") -Recurse -Force
} elseif (Test-Path $userLib) {
    Copy-Item -Path $userLib -Destination (Join-Path $stage "lib") -Recurse -Force
}

# Include compiled frontend UI if available
$distSpa = Join-Path $repoRoot "dist\spa"
if (Test-Path $distSpa) {
    Write-Host "Bundling compiled frontend UI..."
    Copy-Item -Path $distSpa -Destination (Join-Path $stage "ui") -Recurse -Force
}

# Remove any unnecessary pycache, sqlite, or pyc
Get-ChildItem -Path $stage -Include "__pycache__", "db.sqlite3", "*.pyc" -Recurse -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force

# 2. Create compressed bundle
Write-Host "Compressing add-in bundle..."
if (Test-Path $bundleZip) { Remove-Item -Force $bundleZip }
Compress-Archive -Path "$stage\*" -DestinationPath $bundleZip -CompressionLevel Optimal
Remove-Item -Recurse -Force $stage

# 3. Locate csc.exe compiler
$cscCandidates = @(
    "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
    "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)
$csc = $cscCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $csc) {
    $cscCmd = Get-Command "csc.exe" -ErrorAction SilentlyContinue
    if ($cscCmd) { $csc = $cscCmd.Source }
}
if (-not $csc) {
    throw "Visual C# Compiler (csc.exe) not found."
}

Write-Host "Compiling setup.exe using $csc..."
$cscArgs = @(
    "/target:winexe",
    "/out:$outputExe",
    "/optimize+",
    "/r:System.IO.Compression.FileSystem.dll",
    "/r:System.IO.Compression.dll",
    "/r:System.Windows.Forms.dll",
    "/r:System.Drawing.dll",
    "/resource:$bundleZip,PluginZip",
    "/win32icon:$faviconIco",
    $installerCs
)

& $csc $cscArgs

Remove-Item -Force $bundleZip

$sizeKb = [math]::Round((Get-Item $outputExe).Length / 1KB, 1)
Write-Host "`nSUCCESS: Standalone installer generated:" -ForegroundColor Green
Write-Host "  $outputExe ($sizeKb KB)" -ForegroundColor Yellow
Write-Host "Ready to run on any Windows PC!`n"
