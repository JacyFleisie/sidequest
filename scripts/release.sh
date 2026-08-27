#!/usr/bin/env bash
# Ship a new SideQuest release end-to-end:
#   bump version → build APK → commit → tag vX.Y.Z → push → GitHub release with the APK.
# The phone app auto-detects the new release and offers to install it.
# Usage: bash scripts/release.sh [major|minor|patch] ["commit message"] [--silent]   (default: patch)
#
# --silent: reuse the previous release's notes as the release body, so the
# in-app 'What's new' keeps showing the previous update's notes (for quiet
# bugfix/hotfix releases). Without it, RELEASE_NOTES.md becomes the release
# body — which is exactly what the in-app 'What's new' sheet shows on the
# phone. Replace its contents before each release so the notes describe this
# version. Without the file, notes are auto-generated from the commits since
# the previous tag.
set -e
cd "$(dirname "$0")/.."

LEVEL="patch"
COMMIT_MSG=""
SILENT=0
for arg in "$@"; do
  case "$arg" in
    major|minor|patch) LEVEL="$arg" ;;
    --silent) SILENT=1 ;;
    *) COMMIT_MSG="$arg" ;;
  esac
done

bash scripts/bump-version.sh "$LEVEL"

V=$(node -p "require('./package.json').version")
COMMIT_MSG="${COMMIT_MSG:-Release v$V}"

echo "==> Building APK (npm run apk)"
npm run apk

# ── APK integrity pin ───────────────────────────────────────────────────────
# Compute the released APK's SHA-256 and write it into src/lib/apk-hashes.ts so
# the app can verify the download before installing. Falls back gracefully if
# no hash tool is available (the updater then skips the check and warns).
APK="SideQuest.apk"
if [ -f "$APK" ]; then
  if command -v sha256sum >/dev/null 2>&1; then
    HASH=$(sha256sum "$APK" | awk '{print $1}')
  elif command -v shasum >/dev/null 2>&1; then
    HASH=$(shasum -a 256 "$APK" | awk '{print $1}')
  else
    HASH=""
  fi
  if [ -n "$HASH" ]; then
    echo "==> Pinning APK SHA-256 for v$V: $HASH"
    node -e "
      const fs = require('fs');
      const v = process.argv[1], h = process.argv[2];
      const file = 'src/lib/apk-hashes.ts';
      const date = new Date().toISOString().slice(0,10);
      const block = \"  '\" + v + \"': {\n    sha256: '\" + h + \"',\n    generatedAt: '\" + date + \"',\n  },\";
      let src = fs.readFileSync(file, 'utf8');
      src = src.replace(/\nexport const APK_HASHES[\s\S]*?\n}/, '');
      src = src.replace(/(\/\/ ─+\n\n)/, \"\$1\" + block + \"\n\");
      fs.writeFileSync(file, src);
    " "$V" "$HASH"
    git add src/lib/apk-hashes.ts
  else
    echo "==> WARNING: no sha256 tool found — APK hash left unpinned for v$V."
  fi
fi

echo "==> Committing and tagging v$V"
git add -A
git commit -m "$COMMIT_MSG

🤖 Generated with Codebuff
Co-Authored-By: Codebuff <noreply@codebuff.com>"
git tag "v$V"

echo "==> Pushing to GitHub"
git push origin main --tags

echo "==> Creating GitHub release"
if [ "$SILENT" = "1" ]; then
  # Silent update: carry the previous release's notes forward so the in-app
  # 'What's new' keeps showing the previous update instead of a fresh one.
  PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
  if [ -n "$PREV_TAG" ] && gh release view "$PREV_TAG" --json body --jq .body > /tmp/sidequest-prev-notes.md 2>/dev/null && [ -s /tmp/sidequest-prev-notes.md ]; then
    echo "   Silent update — reusing $PREV_TAG's notes as the release body."
    gh release create "v$V" SideQuest.apk \
      --title "SideQuest v$V" \
      --notes-file /tmp/sidequest-prev-notes.md
  else
    echo "   No previous notes found — falling back to RELEASE_NOTES.md."
    gh release create "v$V" SideQuest.apk \
      --title "SideQuest v$V" \
      --notes-file RELEASE_NOTES.md
  fi
elif [ -f RELEASE_NOTES.md ]; then
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
