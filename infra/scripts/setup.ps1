$ErrorActionPreference = 'Stop'
$studioRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location -LiteralPath $studioRoot
if (-not (Test-Path -LiteralPath '.tools/python/python.exe')) {
    node infra/scripts/bootstrap-python.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Python download failed' }
    Expand-Archive -LiteralPath '.tools/python.zip' -DestinationPath '.tools/python'
}
Set-Content -LiteralPath '.tools/python/python312._pth' -Value @('python312.zip', '.', $studioRoot, 'import site') -Encoding ASCII
if (-not (Test-Path -LiteralPath '.tools/python/Lib/site-packages/pip')) {
    & .tools/python/python.exe .tools/get-pip.py 'pip==26.2.2' --disable-pip-version-check --no-warn-script-location
    if ($LASTEXITCODE -ne 0) { throw 'pip bootstrap failed' }
}
& .tools/python/python.exe -m pip install --require-hashes -r apps/api/requirements.windows.lock --no-warn-script-location --report .tools/python-install-last.json
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed' }
if (-not (Test-Path -LiteralPath '.tools/python-install.json')) {
    Copy-Item -LiteralPath '.tools/python-install-last.json' -Destination '.tools/python-install.json'
}
npm.cmd ci --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm dependency installation failed' }
npm.cmd run build:web
if ($LASTEXITCODE -ne 0) { throw 'Web build failed' }
Write-Output 'Setup complete. Run npm.cmd start, then open http://127.0.0.1:8000'
