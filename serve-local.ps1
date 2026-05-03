param(
    [string]$HostName = "localhost",
    [int]$Port = 8080,
    [int]$PortAttempts = 20
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = [System.IO.Path]::GetFullPath($root)

if ($PortAttempts -lt 1) {
    throw "PortAttempts doit etre superieur ou egal a 1."
}

Add-Type -AssemblyName System.Web

$mimeTypes = @{
    ".css"  = "text/css"
    ".gif"  = "image/gif"
    ".htm"  = "text/html"
    ".html" = "text/html"
    ".ico"  = "image/x-icon"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".js"   = "application/javascript"
    ".json" = "application/json"
    ".png"  = "image/png"
    ".svg"  = "image/svg+xml"
    ".txt"  = "text/plain"
    ".webp" = "image/webp"
    ".woff" = "font/woff"
    ".woff2" = "font/woff2"
}

$listener = $null
$prefix = $null
$lastError = $null

for ($attempt = 0; $attempt -lt $PortAttempts; $attempt++) {
    $candidatePort = $Port + $attempt
    $candidatePrefix = "http://${HostName}:$candidatePort/"
    $candidateListener = [System.Net.HttpListener]::new()
    $candidateListener.Prefixes.Add($candidatePrefix)

    try {
        $candidateListener.Start()
        $listener = $candidateListener
        $prefix = $candidatePrefix
        break
    }
    catch {
        $lastError = $_
        $candidateListener.Close()
    }
}

if (-not $listener) {
    throw "Impossible de demarrer le serveur sur http://${HostName}:$Port/ apres $PortAttempts tentative(s). Derniere erreur: $($lastError.Exception.Message)"
}

Write-Host "Serveur local actif sur $prefix"
Write-Host "Racine: $root"
Write-Host "Depuis cet ordinateur: $prefix"
Write-Host "Depuis un appareil du Wi-Fi: relancer avec -HostName <IP locale>, par exemple .\serve-local.ps1 -HostName 192.168.1.21"
Write-Host "Arreter avec Ctrl+C"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            $requestPath = [System.Web.HttpUtility]::UrlDecode($request.Url.AbsolutePath)

            if ([string]::IsNullOrWhiteSpace($requestPath) -or $requestPath -eq "/") {
                $requestPath = "/index.html"
            }

            $relativePath = $requestPath.TrimStart("/").Replace("/", "\")
            $targetPath = Join-Path $root $relativePath
            $fullPath = [System.IO.Path]::GetFullPath($targetPath)

            $rootWithSeparator = $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar

            if (-not $fullPath.StartsWith($rootWithSeparator, [System.StringComparison]::OrdinalIgnoreCase) -and -not $fullPath.Equals($root, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw "Chemin refuse."
            }

            if ((Test-Path $fullPath) -and (Get-Item $fullPath).PSIsContainer) {
                $fullPath = Join-Path $fullPath "index.html"
            }

            if (-not (Test-Path $fullPath)) {
                $response.StatusCode = 404
                $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 - Not Found")
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                continue
            }

            $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
            $contentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { "application/octet-stream" }
            $bytes = [System.IO.File]::ReadAllBytes($fullPath)

            $response.StatusCode = 200
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        }
        catch {
            if ($response.OutputStream.CanWrite) {
                $response.StatusCode = 500
                $buffer = [System.Text.Encoding]::UTF8.GetBytes("500 - Server Error")
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            }
        }
        finally {
            $response.OutputStream.Close()
        }
    }
}
finally {
    $listener.Stop()
    $listener.Close()
}
