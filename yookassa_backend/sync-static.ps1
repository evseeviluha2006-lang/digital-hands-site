# Синхронизирует HTML из корня проекта в static/ (VPS) и public/ (Vercel).
# Запускать после каждого изменения страниц:
#   powershell -ExecutionPolicy Bypass -File .\yookassa_backend\sync-static.ps1
$root = Split-Path -Parent $PSScriptRoot
$targets = @(
    (Join-Path $PSScriptRoot 'static'),
    (Join-Path $root 'public')
)

foreach ($dest in $targets) {
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    'uslugi-digital.html', 'offer.html', 'privacy.html' | ForEach-Object {
        Copy-Item -Path (Join-Path $root $_) -Destination (Join-Path $dest $_) -Force
    }
    Copy-Item -Path (Join-Path $root 'uslugi-digital.html') -Destination (Join-Path $dest 'index.html') -Force
}

Write-Host "Done: static/ and public/ synced from project root."
