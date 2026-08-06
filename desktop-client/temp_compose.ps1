
[void][System.Reflection.Assembly]::LoadWithPartialName('System.Drawing')

function Load-ImageSafely($path) {
    if (!(Test-Path $path) -or (Get-Item $path).Length -eq 0) { return $null }
    try {
        Add-Type -AssemblyName PresentationCore -ErrorAction SilentlyContinue
        $uri = New-Object System.Uri($path)
        $decoder = [System.Windows.Media.Imaging.BitmapDecoder]::Create($uri, [System.Windows.Media.Imaging.BitmapCreateOptions]::None, [System.Windows.Media.Imaging.BitmapCacheOption]::Default)
        $frame = $decoder.Frames[0]
        $encoder = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
        $encoder.Frames.Add($frame)
        $tempPng = $path + '.wic.png'
        $stream = New-Object System.IO.FileStream($tempPng, [System.IO.FileMode]::Create)
        $encoder.Save($stream)
        $stream.Close()
        $stream.Dispose()
        
        $img = [System.Drawing.Image]::FromFile($tempPng)
        $img.Tag = $tempPng
        return $img
    } catch {
        try {
            return [System.Drawing.Image]::FromFile($path)
        } catch {
            return $null
        }
    }
}

if ('photo_s' -eq 'photo_s') {
    $canvas = New-Object System.Drawing.Bitmap(384, 150)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.Clear([System.Drawing.Color]::White)
    
    # Caneta de borda com espessura de 8px (2x mais grossa) e Inset por 4px para evitar cortes
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 8)
    $g.DrawRectangle($pen, 4, 4, 375, 141)

    $img = Load-ImageSafely 'E:\\tiktok-live\\desktop-client\\temp\\gift_1786002535624.png'
    if ($img -ne $null) {
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        
        # Efeito de foto redonda (circular clip)
        $clipPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $clipPath.AddEllipse(20, 15, 120, 120)
        $oldClip = $g.Clip
        $g.SetClip($clipPath)
        $g.DrawImage($img, 20, 15, 120, 120)
        $g.Clip = $oldClip
        $clipPath.Dispose()
        
        $tempPng = $img.Tag
        $img.Dispose()
        if ($tempPng -and (Test-Path $tempPng)) { Remove-Item $tempPng -Force -ErrorAction SilentlyContinue }
    }

    $font = New-Object System.Drawing.Font('Arial', 14, [System.Drawing.FontStyle]::Bold)
    $brush = [System.Drawing.Brushes]::Black
    $usernameStr = '@valerynusa27'
    $textSize = $g.MeasureString($usernameStr, $font)
    $textX = 160
    $textY = (150 - $textSize.Height) / 2
    $g.DrawString($usernameStr, $font, $brush, $textX, $textY)
    $canvas.Save('E:\\tiktok-live\\desktop-client\\temp\\composed_1786002535641.png', [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Dispose()
    $g.Dispose()
    $pen.Dispose()
    $font.Dispose()
} else {
    $imgWidth = 200
    $imgHeight = 200
    if ('photo_s' -eq 'photo_xl') {
        $imgWidth = 300
        $imgHeight = 300
    }
    $canvasHeight = if ('photo_s' -eq 'photo_xl') { 380 } else { 280 }
    $imgX = [Math]::Round((384 - $imgWidth) / 2)
    $imgY = 60

    $canvas = New-Object System.Drawing.Bitmap(384, $canvasHeight)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.Clear([System.Drawing.Color]::White)
    
    # Caneta de borda com espessura de 8px (2x mais grossa) e Inset por 4px para evitar cortes
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 8)
    $g.DrawRectangle($pen, 4, 4, 375, $canvasHeight - 9)

    $font = New-Object System.Drawing.Font('Arial', 16, [System.Drawing.FontStyle]::Bold)
    $brush = [System.Drawing.Brushes]::Black
    $usernameStr = '@valerynusa27'
    $textSize = $g.MeasureString($usernameStr, $font)
    $textX = (384 - $textSize.Width) / 2
    $g.DrawString($usernameStr, $font, $brush, $textX, 20)

    $img = Load-ImageSafely 'E:\\tiktok-live\\desktop-client\\temp\\gift_1786002535624.png'
    if ($img -ne $null) {
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        
        # Efeito de foto redonda (circular clip)
        $clipPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $clipPath.AddEllipse($imgX, $imgY, $imgWidth, $imgHeight)
        $oldClip = $g.Clip
        $g.SetClip($clipPath)
        $g.DrawImage($img, $imgX, $imgY, $imgWidth, $imgHeight)
        $g.Clip = $oldClip
        $clipPath.Dispose()
        
        $tempPng = $img.Tag
        $img.Dispose()
        if ($tempPng -and (Test-Path $tempPng)) { Remove-Item $tempPng -Force -ErrorAction SilentlyContinue }
    }
    $canvas.Save('E:\\tiktok-live\\desktop-client\\temp\\composed_1786002535641.png', [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Dispose()
    $g.Dispose()
    $pen.Dispose()
    $font.Dispose()
}
