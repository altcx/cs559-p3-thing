# GitHub Pages Setup Guide

## Step 1: Check Your Git Status

Run these commands in your terminal:

```powershell
cd c:\AAA\Code\School\577\P3Golf\cs559-p3-thing
git status
git remote -v
git log --oneline -5
```

## Step 2: Make Sure Your Changes Are Committed

If you see `js/hud.js` in the status as modified, commit it:

```powershell
git add js/hud.js
git commit -m "Add controls display HUD element with aim & shoot instructions"
```

## Step 3: Check/Add Your GitHub Remote

If `git remote -v` shows nothing, you need to add your GitHub repository:

```powershell
# Replace YOUR_USERNAME and YOUR_REPO_NAME with your actual GitHub username and repo name
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
```

Or if you're using SSH:
```powershell
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO_NAME.git
```

## Step 4: Push to GitHub

```powershell
# Push to main branch (or master if that's your default)
git push -u origin main

# If your default branch is master:
# git push -u origin master
```

## Step 5: Enable GitHub Pages

1. Go to your GitHub repository on GitHub.com
2. Click on **Settings** (top menu)
3. Scroll down to **Pages** in the left sidebar
4. Under **Source**, select:
   - **Branch**: `main` (or `master`)
   - **Folder**: `/ (root)`
5. Click **Save**

## Step 6: Your Site Will Be Available At

Your GitHub Pages site will be available at:
- `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

It may take a few minutes for the site to be published after you push.

## Troubleshooting

### If push fails:
- Make sure you're authenticated: `git config --global user.name "Your Name"` and `git config --global user.email "your.email@example.com"`
- If using HTTPS, you may need a Personal Access Token instead of password
- Check if you have the correct permissions on the repository

### If Pages doesn't work:
- Make sure `index.html` is in the root directory
- Check that the branch you selected exists and has your files
- Wait a few minutes - GitHub Pages can take 1-5 minutes to update
