# Monta a release do Zenith Code:
#   release\ZenithCode-<versao>-Setup.exe     instalador (instala por usuario, sem administrador)
#   release\ZenithCode-<versao>-portable.zip  versao portatil (dados ficam em .\data)
# Requisitos: Node.js 22+ (o node.exe usado aqui vai junto no pacote) e Windows com .NET Framework 4.x.
param([string]$Version = "1.0.0")
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$release = Join-Path $root "release"
$stage = Join-Path $release "stage"
$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) { throw "csc.exe do .NET Framework nao encontrado." }
$refs = "/r:System.Windows.Forms.dll", "/r:System.Drawing.dll", "/r:System.IO.Compression.dll", "/r:System.IO.Compression.FileSystem.dll", "/r:Microsoft.CSharp.dll", "/r:System.Core.dll"

Write-Output "1/7 Compilando a interface e o servidor"
npm run build | Out-Null
if ($LASTEXITCODE -ne 0) { throw "npm run build falhou" }
node scripts/build-server.mjs
if ($LASTEXITCODE -ne 0) { throw "build do servidor falhou" }

Write-Output "2/7 Montando a pasta do programa"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force "$stage\runtime", "$stage\app" | Out-Null
$nodeExe = (Get-Command node).Source
Copy-Item $nodeExe "$stage\runtime\node.exe"
$nodeLicense = Join-Path (Split-Path $nodeExe) "LICENSE"
if (Test-Path $nodeLicense) { Copy-Item $nodeLicense "$stage\runtime\LICENSE-node.txt" }
Copy-Item dist, dist-server, skills -Destination "$stage\app" -Recurse
Copy-Item LICENSE, README.md -Destination $stage
$llamaVersion = (Get-Content package.json -Raw | ConvertFrom-Json).dependencies.'node-llama-cpp'
@{ name = "zenith-code-app"; version = $Version; private = $true; type = "module"; dependencies = @{ "node-llama-cpp" = $llamaVersion } } |
  ConvertTo-Json | Set-Content "$stage\app\package.json" -Encoding ascii

Write-Output "3/7 Instalando o runtime do modelo local (node-llama-cpp $llamaVersion)"
Push-Location "$stage\app"
$env:NODE_LLAMA_CPP_SKIP_DOWNLOAD = "true"
npm install --omit=dev --no-audit --no-fund --loglevel=error | Out-Null
$code = $LASTEXITCODE
Remove-Item Env:NODE_LLAMA_CPP_SKIP_DOWNLOAD
Pop-Location
if ($code -ne 0) { throw "npm install falhou" }
Remove-Item "$stage\app\package-lock.json" -ErrorAction SilentlyContinue

Write-Output "4/7 Gerando icone e compilando Zenith Code.exe e Uninstall.exe"
& "$PSScriptRoot\make-icon.ps1" | Out-Null
& $csc /nologo /codepage:65001 /target:winexe /optimize+ "/win32icon:$PSScriptRoot\zenith.ico" $refs "/out:$stage\Zenith Code.exe" "$PSScriptRoot\ZenithLauncher.cs"
if ($LASTEXITCODE -ne 0) { throw "falha ao compilar o lancador" }
& $csc /nologo /codepage:65001 /target:winexe /optimize+ "/win32icon:$PSScriptRoot\zenith.ico" $refs "/out:$stage\Uninstall.exe" "$PSScriptRoot\ZenithUninstall.cs"
if ($LASTEXITCODE -ne 0) { throw "falha ao compilar o desinstalador" }

Write-Output "5/7 Compactando o pacote"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$payload = Join-Path $release "payload.zip"
if (Test-Path $payload) { Remove-Item $payload }
[System.IO.Compression.ZipFile]::CreateFromDirectory($stage, $payload, [System.IO.Compression.CompressionLevel]::Optimal, $false)

Write-Output "6/7 Montando o instalador"
$stub = Join-Path $release "setup-stub.exe"
& $csc /nologo /codepage:65001 /target:winexe /optimize+ "/win32icon:$PSScriptRoot\zenith.ico" $refs "/out:$stub" "$PSScriptRoot\ZenithSetup.cs"
if ($LASTEXITCODE -ne 0) { throw "falha ao compilar o instalador" }
$setup = Join-Path $release "ZenithCode-$Version-Setup.exe"
$out = [System.IO.File]::Create($setup)
$stubBytes = [System.IO.File]::ReadAllBytes($stub)
$out.Write($stubBytes, 0, $stubBytes.Length)
$zin = [System.IO.File]::OpenRead($payload); $zin.CopyTo($out); $zin.Close()
$tail = [BitConverter]::GetBytes([long]$stubBytes.Length) + [System.Text.Encoding]::ASCII.GetBytes("ZENITHPK")
$out.Write($tail, 0, $tail.Length)
$out.Close()
Remove-Item $stub, $payload

Write-Output "7/7 Montando a versao portatil"
$portableDir = Join-Path $release "portable\Zenith Code"
if (Test-Path (Split-Path $portableDir)) { Remove-Item (Split-Path $portableDir) -Recurse -Force }
New-Item -ItemType Directory -Force (Split-Path $portableDir) | Out-Null
Move-Item $stage $portableDir
"Com este arquivo ao lado do Zenith Code.exe, os dados ficam na pasta data." | Set-Content "$portableDir\portable.txt" -Encoding ascii
Remove-Item "$portableDir\Uninstall.exe"
$zipPortable = Join-Path $release "ZenithCode-$Version-portable.zip"
if (Test-Path $zipPortable) { Remove-Item $zipPortable }
[System.IO.Compression.ZipFile]::CreateFromDirectory($portableDir, $zipPortable, [System.IO.Compression.CompressionLevel]::Optimal, $true)
Remove-Item (Split-Path $portableDir) -Recurse -Force

Get-ChildItem $release -File | ForEach-Object { "{0}  {1:N0} MB" -f $_.Name, ($_.Length / 1MB) }
