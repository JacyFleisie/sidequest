#!/usr/bin/env bash
# Ship a new SideQuest release end-to-end:
#   bump version → build APK → commit → tag vX.Y.Z → push → GitHub release with the APK.
# The phone app auto-detects the new release and offers to install it.
# Usage: bash scripts/release.sh [major|minor|patch] ["commit message"]   (default: patch)
#
# Release notes: if RELEASE_NOTES.md exists at the repo root it becomes the
# GitHub release body — which is exactly what the in-app 'What's new' sheet
# shows on the phone. Replace its contents before each release so the notes
# describe this version. Without the file, notes are auto-generated from the
# commits since the previous tag.
set -e
cd "$(dirname "$0")/.."

LEVEL="${1:-patch}"
bash scripts/bump-version.sh "$LEVEL"

V=$(node -p "require('./package.json').version")
COMMIT_MSG="${2:-Release v$V}"

echo "==> Building APK (npm run apk)"
npm run apk

echo "==> Committing and tagging v$V"
git add -A
git commit -m "$COMMIT_MSG

🤖 Generated with Codebuff
Co-Authored-By: Codebuff <noreply@codebuff.com>"
git tag "v$V"

echo "==> Pushing to GitHub"
git push origin main --tags

echo "==> Creating GitHub release"
if [ -f RELEASE_NOTES.md ]; then
  echo "   Using RELEASE_NOTES.md as the release body (this is the in-app 'What's new')."
  gh release create "v$V" SideQuest.apk \
    --title "SideQuest v$V" \
    --notes-file RELEASE_NOTES.md
else
  # Fallback: build the notes from the commits since the previous tag, so the
  # in-app 'What's new' sheet still shows real changes instead of nothing.
  PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
  if [ -n "$PREV_TAG" ]; then
    LOG=$(git log --pretty=format:'%s' "$PREV_TAG..HEAD")
  else
    LOG=$(git log --pretty=format:'%s')
  fi
  # Clean, human release notes: drop the auto "Release vX" commit and any
  # bot footer, then build a friendly bullet list for the What's-new sheet.
  NOTES=$(printf '%s\n' "$LOG" \
    | grep -v -i '^release v' \
    | grep -v -i 'generated with codebuff' \
    | grep -v -i 'co-authored-by' \
    | sed 's/ *🤖 *$//' \
    | grep -v '^$' \
    | awk '{print "- " $0}')
  gh release create "v$V" SideQuest.apk \
    --title "SideQuest v$V" \
    --notes "$NOTES"
fi

echo ""
echo "✅ Released v$V — https://github.com/JacyFleisie/sidequest/releases/tag/v$V"
echo "   The Android app will offer this update automatically on next launch."
