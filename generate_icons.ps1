param (
    [string]$IconPath = "icon.png",
    [string]$AndroidRes = "android/app/src/main/res",
    [string]$IOSPath = "ios/CRMApp/Images.xcassets/AppIcon.appiconset"
)

Add-Type -AssemblyName System.Drawing

function Create-Icon {
    param($src, $dest, $size)
    $img = [System.Drawing.Image]::FromFile((Resolve-Path $src))
    $newImg = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($newImg)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, 0, 0, $size, $size)
    
    $destDir = [System.IO.Path]::GetDirectoryName($dest)
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force }
    
    $newImg.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $newImg.Dispose()
    $img.Dispose()
}

$androidSizes = @{
    "mipmap-mdpi"    = 48
    "mipmap-hdpi"    = 72
    "mipmap-xhdpi"   = 96
    "mipmap-xxhdpi"  = 144
    "mipmap-xxxhdpi" = 192
}

Write-Host "Generating Android icons..."
foreach ($dir in $androidSizes.Keys) {
    $size = $androidSizes[$dir]
    Create-Icon -src $IconPath -dest "$AndroidRes/$dir/ic_launcher.png" -size $size
    Create-Icon -src $IconPath -dest "$AndroidRes/$dir/ic_launcher_round.png" -size $size
    Write-Host "- Created $dir ($size x $size)"
}

Write-Host "`nGenerating iOS icons..."
$iosSizes = @(
    @{ size = 40;  name = "icon-20@2x.png" }
    @{ size = 60;  name = "icon-20@3x.png" }
    @{ size = 29;  name = "icon-29.png" }
    @{ size = 58;  name = "icon-29@2x.png" }
    @{ size = 87;  name = "icon-29@3x.png" }
    @{ size = 80;  name = "icon-40@2x.png" }
    @{ size = 120; name = "icon-40@3x.png" }
    @{ size = 120; name = "icon-60@2x.png" }
    @{ size = 180; name = "icon-60@3x.png" }
    @{ size = 1024; name = "icon-1024.png" }
)

foreach ($item in $iosSizes) {
    Create-Icon -src $IconPath -dest "$IOSPath/$($item.name)" -size $item.size
    Write-Host "- Created $($item.name) ($($item.size) x $($item.size))"
}
