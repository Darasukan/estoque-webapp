param([string]$TaskName = 'Estoque Webapp')

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$envFile = Join-Path $root '.env.prod'
if (-not (Test-Path -LiteralPath $envFile)) {
  throw 'Arquivo .env.prod nao encontrado. Crie e revise antes de instalar a inicializacao automatica.'
}

$runner = Join-Path $PSScriptRoot 'runWindowsTask.ps1'
$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`"" `
  -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description 'Inicia o Estoque Webapp no logon do usuario.' `
  -Force | Out-Null

Write-Host "Tarefa '$TaskName' instalada. Ela iniciara no proximo logon."
Write-Host "Log: $(Join-Path $root 'logs\estoque-server.log')"
