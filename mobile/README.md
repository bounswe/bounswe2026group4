# Local History Story Map Mobile

React Native + Expo skeleton for the Local History Story Map project.

## Install dependencies
```bash
cd mobile
npm install
```

## Run Expo
```bash
npm run start
```

## First-time setup

1. Copy the mobile env file:
```bash
cp .env.example .env
```

2. If you are using the shared remote backend, the default `.env.example` values are enough.

3. If you are using a local backend instead, update `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env`:
```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:8000/api
```

4. Restart Expo after every `.env` change so the new values are picked up.

## Expo Go with local backend

1. Copy the example env file:
```bash
cp .env.example .env
```

2. Update `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env`:
```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:8000/api
```

3. Start Django so Expo Go can reach it from your phone:
```bash
cd ../backend
python manage.py runserver 0.0.0.0:8000
```

4. Make sure your phone and computer are on the same Wi-Fi, then run:
```bash
cd ../mobile
npm run start
```

## PowerShell quick start

```powershell
cd .\bounswe2026group4\mobile
Copy-Item .env.example .env
npm run start
```

## Local Android APK build

Use this flow if you want to build an Android APK on your own machine instead of using GitHub Actions.

### Requirements

- Android Studio installed
- Android SDK and platform tools installed
- A JDK available through Android Studio (`jbr`) or `JAVA_HOME`

### Generate native Android files

```bash
cd mobile
npx expo prebuild --platform android
```

This creates the `mobile/android` directory. If you only want to test with Expo Go, you do not need this step.

### Build a debug APK

```bash
cd android
./gradlew assembleDebug
```

Output:

```text
mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

### Build a release APK

```bash
cd android
./gradlew assembleRelease
```

Output:

```text
mobile/android/app/build/outputs/apk/release/app-release.apk
```

## Install APK on a phone or emulator

If `adb` is available in your PATH:

```bash
adb install -r path/to/app-release.apk
```

If `adb` is not in PATH on Windows, use the full platform-tools path:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r ".\android\app\build\outputs\apk\release\app-release.apk"
```

To uninstall an existing app first:

```bash
adb uninstall <package.name>
```

Current Android package name:

```text
com.bounswe2026group4.localhistorystorymap
```

## Notes

- Restart Expo after every `.env` change
- If Expo Go cannot reach your backend, make sure the phone and backend are reachable on the same network
- Local APK builds can be sensitive to Windows path, OneDrive, and SDK/JDK configuration issues; GitHub Actions remains the most stable release build path

## APK build for MVP

The repository now includes a GitHub Action at `.github/workflows/mobile-apk.yml` that builds an Android `.apk` when:

- code is pushed to `main`
- a GitHub release is published
- the workflow is started manually from the Actions tab

Before the workflow is used, set these GitHub repository settings:

1. Add a repository variable named `EXPO_PUBLIC_API_BASE_URL`.
   Example value:
```text
https://164.90.177.21.sslip.io/api
```

The workflow creates a standalone release APK, so it can be installed on a phone without Metro running. The built file is uploaded as a workflow artifact, and published GitHub releases also get the APK attached automatically.
