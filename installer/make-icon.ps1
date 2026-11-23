# Gera installer/zenith.ico (16 a 256 px) com a marca do Zenith: estrela de quatro pontas sobre fundo escuro.
param([string]$Out = "$PSScriptRoot\zenith.ico")
Add-Type -AssemblyName System.Drawing

function New-ZenithPng([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $s = $size / 32.0
  # Fundo: quadrado arredondado escuro
  $r = 7 * $s
  $bg = New-Object System.Drawing.Drawing2D.GraphicsPath
  $w = $size - 1
  $bg.AddArc(0, 0, 2 * $r, 2 * $r, 180, 90); $bg.AddArc($w - 2 * $r, 0, 2 * $r, 2 * $r, 270, 90)
  $bg.AddArc($w - 2 * $r, $w - 2 * $r, 2 * $r, 2 * $r, 0, 90); $bg.AddArc(0, $w - 2 * $r, 2 * $r, 2 * $r, 90, 90); $bg.CloseFigure()
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 38, 38, 36))), $bg)
  # Estrela (mesmo desenho do ZenithMark da interface), com margem
  $m = 3 * $s; $k = ($size - 2 * $m) / 32.0
  function P([double]$x, [double]$y) { New-Object System.Drawing.PointF ([single]($m + $x * $k)), ([single]($m + $y * $k)) }
  $star = New-Object System.Drawing.Drawing2D.GraphicsPath
  $star.AddBezier((P 16 2), (P 17 9), (P 19.5 13), (P 30 16))
  $star.AddBezier((P 30 16), (P 19.5 19), (P 17 23), (P 16 30))
  $star.AddBezier((P 16 30), (P 15 23), (P 12.5 19), (P 2 16))
  $star.AddBezier((P 2 16), (P 12.5 13), (P 15 9), (P 16 2))
  $star.CloseFigure()
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 217, 119, 87))), $star)
  if ($size -ge 32) {
    $c = 2.4 * $k
    $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 38, 38, 36))), [single]($m + 16 * $k - $c), [single]($m + 16 * $k - $c), [single](2 * $c), [single](2 * $c))
  }
  $g.Dispose()
  $ms = New-Object System.IO.MemoryStream
  if ($size -ge 256) {
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  } else {
    # Entrada DIB classica: BITMAPINFOHEADER + pixels BGRA de baixo para cima + mascara AND.
    $bw2 = New-Object System.IO.BinaryWriter $ms
    $bw2.Write([uint32]40); $bw2.Write([int32]$size); $bw2.Write([int32]($size * 2)); $bw2.Write([uint16]1); $bw2.Write([uint16]32)
    $bw2.Write([uint32]0); $bw2.Write([uint32]0); $bw2.Write([int32]0); $bw2.Write([int32]0); $bw2.Write([uint32]0); $bw2.Write([uint32]0)
    for ($y = $size - 1; $y -ge 0; $y--) { for ($x = 0; $x -lt $size; $x++) { $c = $bmp.GetPixel($x, $y); $bw2.Write([byte]$c.B); $bw2.Write([byte]$c.G); $bw2.Write([byte]$c.R); $bw2.Write([byte]$c.A) } }
    $maskRow = [int]([math]::Ceiling($size / 32.0) * 4)
    $bw2.Write((New-Object byte[] ($maskRow * $size)))
    $bw2.Flush()
  }
  $bmp.Dispose()
  return ,$ms.ToArray()
}

$sizes = 16, 24, 32, 48, 64, 128, 256
$pngs = foreach ($sz in $sizes) { ,(New-ZenithPng $sz) }
$fs = [System.IO.File]::Create($Out)
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $sz = $sizes[$i]; $len = $pngs[$i].Length
  $bw.Write([byte]($(if ($sz -ge 256) { 0 } else { $sz }))); $bw.Write([byte]($(if ($sz -ge 256) { 0 } else { $sz })))
  $bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([uint16]1); $bw.Write([uint16]32)
  $bw.Write([uint32]$len); $bw.Write([uint32]$offset); $offset += $len
}
foreach ($p in $pngs) { $bw.Write($p) }
$bw.Close()
Write-Output "Icone gerado: $Out"
