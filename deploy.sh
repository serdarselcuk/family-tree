#!/bin/bash
set -e

echo "🚀 Deploying to GitHub Pages..."

# Ensure we're on master branch
git checkout master

# Ensure public folder exists with latest assets
echo "📁 Preparing public assets..."
mkdir -p public
cp -r fotograf public/ 2>/dev/null || true
cp -r css public/ 2>/dev/null || true
cp favicon.ico public/ 2>/dev/null || true

# Build the project
echo "🔨 Building project..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
  echo "❌ Build failed - dist folder not found"
  exit 1
fi

# Switch to gh-pages branch
echo "📤 Deploying to gh-pages branch..."
git checkout gh-pages

# SAFETY CHECK: Verify we're actually on gh-pages
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "gh-pages" ]; then
  echo "❌ ERROR: Not on gh-pages branch! Aborting to prevent data loss."
  echo "Current branch: $CURRENT_BRANCH"
  git checkout master
  exit 1
fi

echo "⚠️  About to delete all files in gh-pages branch (except .git)"
echo "This is normal for deployment, but please confirm:"
read -p "Continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
  echo "Deployment cancelled"
  git checkout master
  exit 0
fi

# Remove old files but keep .git
echo "🗑️  Removing old build files..."
find . -maxdepth 1 ! -name '.git' ! -name '.' ! -name '..' -exec rm -rf {} +

# Copy new build files
cp -r dist/* .

# Add all files
git add -A

# Commit
git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S')" || echo "No changes to commit"

# Push to GitHub
echo "⬆️  Pushing to GitHub..."
git push origin gh-pages

# Switch back to master
git checkout master

echo "✅ Deployment complete!"
echo "🌐 Your site will be available at: https://camakoglu.github.io/aile/"
