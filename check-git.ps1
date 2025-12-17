Write-Host "=== Checking Git Status ===" -ForegroundColor Cyan
git status

Write-Host "`n=== Checking Git Remotes ===" -ForegroundColor Cyan
git remote -v

Write-Host "`n=== Recent Commits ===" -ForegroundColor Cyan
git log --oneline -5

Write-Host "`n=== Uncommitted Changes ===" -ForegroundColor Cyan
git diff --name-only

Write-Host "`n=== Staged Changes ===" -ForegroundColor Cyan
git diff --cached --name-only
