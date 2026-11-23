# Monta a release do Zenith Code (app de desktop com Electron):
#   release\ZenithCode-<versao>-Setup.exe     instalador (por usuario, sem administrador)
#   release\ZenithCode-<versao>-portable.zip  versao portatil (dados ficam em .\data)
# Requisitos: Node.js 22+, dependencias instaladas (npm install) e Windows com .NET Framework 4.x.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$pkg = [IO.File]::ReadAllText("$root\package.json") | ConvertFrom-Json
$Version = $pkg.version
$release = Join-Path $root "release"
$stage = Join-Path $release "stage"
$appDir = Join-Path $stage "resources\app"
$electronDist = Join-Path $root "node_modules\electron\dist"
$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) { throw "csc.exe do .NET Framework nao encontrado." }
if (-not (Test-Path "$electronDist\electron.exe")) { throw "Electron nao encontrado. Rode: npm install e node node_modules/electron/install.js" }
$refs = "/r:System.Windows.Forms.dll", "/r:System.Drawing.dll", "/r:System.IO.Compression.dll", "/r:System.IO.Compression.FileSystem.dll", "/r:Microsoft.CSharp.dll", "/r:System.Core.dll"
$tools = Join-Path $release "tools"
New-Item -ItemType Directory -Force $release, $tools | Out-Null
"static class BuildInfo { public const string Version = `"$Version`"; }" | Set-Content "$tools\BuildInfo.cs" -Encoding ascii

Write-Output "Zenith Code $Version"
Write-Output "1/7 Compilando a interface e o servidor"
npm run build | Out-Null
if ($LASTEXITCODE -ne 0) { throw "npm run build falhou" }
node scripts/build-server.mjs
if ($LASTEXITCODE -ne 0) { throw "build do servidor falhou" }

Write-Output "2/7 Copiando o Electron"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item "$electronDist\*" $stage -Recurse
Rename-Item "$stage\electron.exe" "Zenith Code.exe"
Remove-Item "$stage\resources\default_app.asar" -ErrorAction SilentlyContinue
# Mantem so os idiomas usados (portugues e ingles); os outros so ocupam espaco.
Get-ChildItem "$stage\locales" -Filter *.pak | Where-Object { $_.Name -notin @("pt-BR.pak", "en-US.pak") } | Remove-Item

Write-Output "3/7 Copiando o Zenith"
New-Item -ItemType Directory -Force $appDir | Out-Null
Copy-Item electron, dist, dist-server, skills -Destination $appDir -Recurse
Copy-Item LICENSE, README.md -Destination $stage
@{ name = "zenith-code"; productName = "Zenith Code"; version = $Version; private = $true; type = "module"; main = "electron/main.mjs";
   dependencies = @{ "node-llama-cpp" = $pkg.dependencies.'node-llama-cpp' } } | ConvertTo-Json | Set-Content "$appDir\package.json" -Encoding ascii

Write-Output "4/7 Instalando o motor do modelo local (node-llama-cpp)"
Push-Location $appDir
$env:NODE_LLAMA_CPP_SKIP_DOWNLOAD = "true"
npm install --omit=dev --no-audit --no-fund --loglevel=error | Out-Null
$code = $LASTEXITCODE
Remove-Item Env:NODE_LLAMA_CPP_SKIP_DOWNLOAD
Pop-Location
if ($code -ne 0) { throw "npm install falhou" }
Remove-Item "$appDir\package-lock.json" -ErrorAction SilentlyContinue

Write-Output "5/7 Icone, desinstalador e instalador"
& "$PSScriptRoot\make-icon.ps1" -Out "$tools\zenith.ico" | Out-Null
& $csc /nologo /codepage:65001 "/out:$tools\SetIcon.exe" "$PSScriptRoot\SetIcon.cs"
if ($LASTEXITCODE -ne 0) { throw "falha ao compilar SetIcon" }
& "$tools\SetIcon.exe" "$stage\Zenith Code.exe" "$tools\zenith.ico" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "falha ao aplicar o icone" }
& $csc /nologo /codepage:65001 /target:winexe /optimize+ "/win32icon:$tools\zenith.ico" $refs "/out:$stage\Uninstall.exe" "$PSScriptRoot\ZenithUninstall.cs"
if ($LASTEXITCODE -ne 0) { throw "falha ao compilar o desinstalador" }
$stub = Join-Path $tools "setup-stub.exe"
& $csc /nologo /codepage:65001 /target:winexe /optimize+ "/win32icon:$tools\zenith.ico" $refs "/out:$stub" "$PSScriptRoot\ZenithSetup.cs" "$tools\BuildInfo.cs"
if ($LASTEXITCODE -ne 0) { throw "falha ao compilar o instalador" }

Write-Output "6/7 Compactando e montando o instalador"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$payload = Join-Path $tools "payload.zip"
if (Test-Path $payload) { Remove-Item $payload }
[System.IO.Compression.ZipFile]::CreateFromDirectory($stage, $payload, [System.IO.Compression.CompressionLevel]::Optimal, $false)
Get-ChildItem $release -Filter "ZenithCode-*" | Remove-Item
$setup = Join-Path $release "ZenithCode-$Version-Setup.exe"
$out = [System.IO.File]::Create($setup)
$stubBytes = [System.IO.File]::ReadAllBytes($stub)
$out.Write($stubBytes, 0, $stubBytes.Length)
$zin = [System.IO.File]::OpenRead($payload); $zin.CopyTo($out); $zin.Close()
$tail = [BitConverter]::GetBytes([long]$stubBytes.Length) + [System.Text.Encoding]::ASCII.GetBytes("ZENITHPK")
$out.Write($tail, 0, $tail.Length)
$out.Close()

Write-Output "7/7 Montando a versao portatil"
$portableRoot = Join-Path $release "portable"
if (Test-Path $portableRoot) { Remove-Item $portableRoot -Recurse -Force }
$portableDir = Join-Path $portableRoot "Zenith Code"
New-Item -ItemType Directory -Force $portableRoot | Out-Null
Move-Item $stage $portableDir
"Com este arquivo ao lado do Zenith Code.exe, os dados ficam na pasta data." | Set-Content "$portableDir\portable.txt" -Encoding ascii
Remove-Item "$portableDir\Uninstall.exe"
[System.IO.Compression.ZipFile]::CreateFromDirectory($portableDir, (Join-Path $release "ZenithCode-$Version-portable.zip"), [System.IO.Compression.CompressionLevel]::Optimal, $true)
Remove-Item $portableRoot, $tools -Recurse -Force

Get-ChildItem $release -File | ForEach-Object { "{0}  {1:N0} MB" -f $_.Name, ($_.Length / 1MB) }
