#!/usr/bin/env bash
# Ship a new SideQuest release end-to-end:
#   bump version → build APK → commit → tag vX.Y.Z → push → GitHub release with the APK.
# The phone app auto-detects the new release and offers to install it.
# Usage: bash scripts/release.sh [major|minor|patch]   (default: patch)
set -e
cd "$(dirname "$0")/.."

LEVEL="${1:-patch}"
bash scripts/bump-version.sh "$LEVEL"

V=$(node -p "require('./package.json').version")

echo "==> Building APK (npm run apk)"
npm run apk

echo "==> Committing and tagging v$V"
git add -A
git commit -m "Release v$V

Automated release build.
Generated with Codebuff 🤖
Co-Authored-By: Codebuff <noreply@codebuff.com>"
git tag "v$V"

echo "==> Pushing to GitHub"
git push origin main --tags

echo "==> Creating GitHub release"
# Build the release notes from the commits since the previous tag, so the in-app
# 'What's new' sheet shows real changes instead of a bare changelog link.
PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
if [ -n "$PREV_TAG" ]; then
  NOTES=$(git log --pretty=format:'- %s' "$PREV_TAG..HEAD" | sed "s/Generated with Codebuff.*//" | sed '/^- $/d')
else
  NOTES=$(git log --pretty=format:'- %s' | sed "s/Generated with Codebuff.*//" | sed '/^- $/d')
fi
gh release create "v$V" SideQuest-debug.apk \
  --title "SideQuest v$V" \
  --notes "$NOTES"

echo ""
echo "✅ Released v$V — https://github.com/JacyFleisie/sidequest/releases/tag/v$V"
echo "   The Android app will offer this update automatically on next launch."
