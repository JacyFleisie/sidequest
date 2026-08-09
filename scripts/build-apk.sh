#!/usr/bin/env bash
# Builds the SideQuest Android APK (debug) and copies it to the project root.
# Uses the JDK bundled with Android Studio so no separate Java install is needed.
set -e
cd "$(dirname "$0")/.."

npm run build
npx cap sync android
cd android
export JAVA_HOME="${JAVA_HOME:-C:/Program Files/Android/Android Studio/jbr}"
./gradlew assembleDebug --no-daemon
cd ..
cp android/app/build/outputs/apk/debug/app-debug.apk SideQuest-debug.apk
echo ""
echo "APK ready: SideQuest-debug.apk ($(du -h SideQuest-debug.apk | cut -f1))"
echo "Install on your phone: enable 'Install unknown apps', then open this file from the phone."
