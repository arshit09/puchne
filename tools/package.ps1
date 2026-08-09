<#
.SYNOPSIS
    Builds the Chrome Web Store zip for Puchne.

.DESCRIPTION
    The repo root holds more than the extension: promo/ is a Remotion project
    whose node_modules runs to hundreds of megabytes, docs/ is screenshots for
    the README, and _metadata/ is written by Chrome itself when the folder is
    loaded unpacked. Zipping the root would ship all of it.

    This script copies only what manifest.json actually references into a
    staging folder, zips that, then re-opens the zip and fails if anything
    excluded made it in — so a mistake in $include cannot quietly ship.

    Note that this script lives in tools/ rather than scripts/: the latter is
    part of the extension (background service worker, content scripts) and
    everything in it gets packaged.

.PARAMETER OutDir
    Where to write the zip, relative to the repo root. Defaults to dist/.

.EXAMPLE
    pwsh tools/package.ps1
#>
[CmdletBinding()]
param(
    [string] $OutDir = 'dist'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot

# Everything manifest.json points at, plus the licence. Adding a top-level
# folder to the extension? Add it here too, or it will not ship.
$include = @(
    'manifest.json'
    'icons'        # action icons + web_accessible_resources
    'pages'        # side_panel, options_ui, grid view
    'scripts'      # background service worker + content scripts
    'styles'       # panel/overlay sheets, also web accessible
    'rules'        # declarative_net_request rule resources
    'LICENSE'
)

# Path segments that must never appear in the package.
$forbidden = @('promo', 'website', 'node_modules', 'docs', '_metadata', '.claude', '.git', 'newicon')

$missing = $include | Where-Object { -not (Test-Path (Join-Path $root $_)) }
if ($missing) {
    throw "Not found in the repo, so cannot be packaged: $($missing -join ', ')"
}

$version = (Get-Content (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json).version
$outPath = Join-Path $root $OutDir
$zipPath = Join-Path $outPath "puchne-$version.zip"

New-Item -ItemType Directory -Force -Path $outPath | Out-Null

$stage = Join-Path ([System.IO.Path]::GetTempPath()) "puchne-package-$([guid]::NewGuid())"
New-Item -ItemType Directory -Force -Path $stage | Out-Null

try {
    foreach ($item in $include) {
        Copy-Item -Path (Join-Path $root $item) -Destination $stage -Recurse -Force
    }

    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zipPath -CompressionLevel Optimal

    # ── The guard ───────────────────────────────────────────────
    # Read the finished zip back rather than trusting the copy above.
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        $entries = @($archive.Entries | ForEach-Object { $_.FullName })
    } finally {
        $archive.Dispose()
    }

    $leaked = $entries | Where-Object {
        ($_ -split '/') | Where-Object { $forbidden -contains $_ }
    }
    if ($leaked) {
        Remove-Item $zipPath -Force
        throw "Excluded content reached the package: $($leaked -join ', ')"
    }

    # The store rejects a zip whose manifest is inside a wrapper folder.
    if ($entries -notcontains 'manifest.json') {
        Remove-Item $zipPath -Force
        throw 'manifest.json is not at the root of the zip.'
    }

    $size = '{0:N2} MB' -f ((Get-Item $zipPath).Length / 1MB)
    # ASCII only in console output — the legacy Windows console mangles the rest.
    Write-Host "Packaged Puchne $version - $($entries.Count) entries, $size"
    Write-Host "  $zipPath"
    Write-Host "  included: $($include -join ', ')"
} finally {
    Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
}
