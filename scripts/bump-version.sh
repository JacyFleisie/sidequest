#!/usr/bin/env bash
# Bumps the SideQuest version everywhere it lives:
#   package.json, src/lib/updater.ts (APP_VERSION), android/app/build.gradle (versionName/versionCode)
# Usage: bash scripts/bump-version.sh [major|minor|patch]   (default: patch)
set -e
cd "$(dirname "$0")/.."

LEVEL="${1:-patch}"
CUR=$(node -p "require('./package.json').version")
NEW=$(node -e "
const [a, b, c] = process.argv[1].split('.').map(Number)
const l = process.argv[2]
if (l === 'major') console.log([a + 1, 0, 0].join('.'))
else if (l === 'minor') console.log([a, b + 1, 0].join('.'))
else console.log([a, b, c + 1].join('.'))
" "$CUR" "$LEVEL")

# Monotonic versionCode (seconds since epoch fits in an int and only grows).
VERCODE=$(date +%s)

echo "Bumping v$CUR -> v$NEW ($LEVEL)"

node -e "
const fs = require('fs')
const p = 'package.json'
const j = JSON.parse(fs.readFileSync(p))
j.version = '$NEW'
fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n')
"

node -e "
const fs = require('fs')
const p = 'src/lib/updater.ts'
let s = fs.readFileSync(p, 'utf8')
s = s.replace(/export const APP_VERSION = '[0-9.]+'/, \"export const APP_VERSION = '$NEW'\")
fs.writeFileSync(p, s)
"

node -e "
const fs = require('fs')
const p = 'android/app/build.gradle'
let s = fs.readFileSync(p, 'utf8')
s = s.replace(/versionCode \d+/, 'versionCode $VERCODE')
s = s.replace(/versionName \"[0-9.]+\"/, 'versionName \"$NEW\"')
fs.writeFileSync(p, s)
"

echo "Now at v$NEW · versionCode $VERCODE"
