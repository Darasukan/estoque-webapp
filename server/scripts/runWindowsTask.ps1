$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
Set-Location $root

& npm.cmd start *>> (Join-Path $logDir 'estoque-server.log')
exit $LASTEXITCODE
