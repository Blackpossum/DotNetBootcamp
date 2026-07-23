# Generates app.ico (multi-resolution, PNG-compressed entries) for .NET Bootcamp.
# Run:  powershell -ExecutionPolicy Bypass -File build\make-icon.ps1
Add-Type -AssemblyName System.Drawing

$outPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'app.ico'
$sizes = 16, 24, 32, 48, 64, 128, 256
$streams = @()

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.InterpolationMode = 'HighQualityBicubic'
    $g.TextRenderingHint = 'AntiAliasGridFit'
    $g.Clear([System.Drawing.Color]::Transparent)

    # rounded-rect background with the course's purple gradient
    $pad = [Math]::Max(1, [int]($size * 0.06))
    $rect = New-Object System.Drawing.Rectangle($pad, $pad, ($size - 2 * $pad), ($size - 2 * $pad))
    $radius = [int]($size * 0.22)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    if ($radius -lt 2) {
        $path.AddRectangle($rect)
    } else {
        $d = $radius * 2
        $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
        $path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
        $path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
        $path.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
        $path.CloseFigure()
    }

    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 124, 92, 255),
        [System.Drawing.Color]::FromArgb(255, 176, 76, 255),
        45.0)
    $g.FillPath($brush, $path)

    # glyph: ".NET" when there is room, otherwise a single N
    $text = if ($size -ge 48) { '.NET' } else { 'N' }
    $fontSize = if ($size -ge 48) { $size * 0.30 } else { $size * 0.60 }
    $font = New-Object System.Drawing.Font('Segoe UI', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = 'Center'
    $fmt.LineAlignment = 'Center'
    $layout = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.DrawString($text, $font, $white, $layout, $fmt)

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $streams += , $ms.ToArray()

    $white.Dispose(); $font.Dispose(); $fmt.Dispose(); $brush.Dispose(); $path.Dispose(); $g.Dispose(); $bmp.Dispose(); $ms.Dispose()
}

# assemble the .ico container (ICONDIR + ICONDIRENTRY[] + PNG payloads)
$fs = [System.IO.File]::Create($outPath)
$bw = New-Object System.IO.BinaryWriter($fs)
$bw.Write([UInt16]0)                 # reserved
$bw.Write([UInt16]1)                 # type: icon
$bw.Write([UInt16]$sizes.Count)

$offset = 6 + (16 * $sizes.Count)
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $s = $sizes[$i]
    $bw.Write([Byte]($(if ($s -ge 256) { 0 } else { $s })))   # width  (0 means 256)
    $bw.Write([Byte]($(if ($s -ge 256) { 0 } else { $s })))   # height
    $bw.Write([Byte]0)               # palette colours
    $bw.Write([Byte]0)               # reserved
    $bw.Write([UInt16]1)             # colour planes
    $bw.Write([UInt16]32)            # bits per pixel
    $bw.Write([UInt32]$streams[$i].Length)
    $bw.Write([UInt32]$offset)
    $offset += $streams[$i].Length
}
foreach ($data in $streams) { $bw.Write($data) }
$bw.Flush(); $bw.Close(); $fs.Close()

Write-Output "icon written: $outPath ($((Get-Item $outPath).Length) bytes, $($sizes.Count) sizes)"
