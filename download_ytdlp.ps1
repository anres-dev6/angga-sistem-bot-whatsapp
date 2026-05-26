$url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
$output = "yt-dlp.exe"

Write-Host "Downloading yt-dlp.exe..."
Invoke-WebRequest -Uri $url -OutFile $output

if (Test-Path $output) {
    Write-Host "✅ yt-dlp.exe downloaded successfully!"
    Write-Host "Location: $(Get-Location)\$output"
    
    # Test it
    & ".\$output" --version
} else {
    Write-Host "❌ Download failed!"
}
