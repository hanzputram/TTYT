# install.ps1
$CurrentDir = Get-Location
$Path = [Environment]::GetEnvironmentVariable("Path", "User")

if ($Path -like "*$CurrentDir*") {
    Write-Host "Directory already in PATH." -ForegroundColor Cyan
} else {
    Write-Host "Adding $CurrentDir to User PATH..." -ForegroundColor Yellow
    [Environment]::SetEnvironmentVariable("Path", $Path + ";" + $CurrentDir, "User")
    Write-Host "Done! Please restart your terminal to use 'ttyt'." -ForegroundColor Green
}
