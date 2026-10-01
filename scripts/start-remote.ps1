$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskConfig = Join-Path $taskRoot '.local/tunnel.yml'
if (!(Test-Path -LiteralPath (Join-Path $taskRoot 'dist/index.html'))) { throw 'Build the app first: npm run build' }
if (!(Test-Path -LiteralPath $taskConfig)) { throw 'Local tunnel configuration is missing. See README.' }
$taskNode = (Get-Command node).Source
$taskCloudflared = (Get-Command cloudflared).Source
$taskOriginRunning = $false
try { $taskOriginRunning = (Invoke-WebRequest 'http://127.0.0.1:4180/' -TimeoutSec 3).StatusCode -eq 200 } catch {}
if (!$taskOriginRunning) {
  Start-Process -FilePath $taskNode -ArgumentList 'scripts/serve.mjs' -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRoot '.local/server.log') -RedirectStandardError (Join-Path $taskRoot '.local/server-error.log')
}
$taskConnectors = Get-CimInstance Win32_Process -Filter "name = 'cloudflared.exe'" | Where-Object { $_.CommandLine -match 'run[\s"]+latitude-explorer' }
if (!$taskConnectors) {
  Start-Process -FilePath $taskCloudflared -ArgumentList 'tunnel','--config','.local/tunnel.yml','run','latitude-explorer' -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRoot '.local/tunnel.log') -RedirectStandardError (Join-Path $taskRoot '.local/tunnel-error.log')
}
Write-Output 'LatitudeExplorer remote access started: https://latitude.pixelwood.co (keep this PC awake).'
