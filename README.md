# ✉️ Forward — Smart Notes App

A cross-platform (Android & iOS) smart notes app that automatically organizes content shared from YouTube, Instagram, Twitter, and any other app into smart folders based on detected locations, topics, and themes.

## ✨ Key Features

- **Smart Auto-Organization** — Share a link about "best pizza in Bangalore" and it auto-appears in both a **Bangalore** 📍 and **Food** 🍽️ folder
- **Share from Any App** — Use the native Android/iOS share sheet to forward content to the app
- **Link Detection** — Automatically detects YouTube, Instagram, Twitter, Reddit and web links
- **Smart Folders** — Auto-created folders for locations (cities) and topics (Food, Travel, Shopping, Health, Finance, Entertainment, Work, Learning)
- **Pin Notes** — Pin important notes for quick access
- **Search** — Full-text search across all notes, tags, and content
- **Custom Folders** — Manually create folders and move notes between them
- **Themes** — Dark (default), light, or follow the system setting
- **Archive & Export** — Archive/restore notes; export all notes as JSON or Markdown to the clipboard
- **Offline-first** — Everything is stored locally on the device (AsyncStorage); there is no backend, account, or API key

## 📱 Screens

| Screen | Description |
|---|---|
| **Forward (Home)** | All notes with platform filter chips (YouTube, Instagram, Twitter…) |
| **Folders** | Grid of auto-created smart folders + create custom folders |
| **Folder Detail** | Notes scoped to a specific folder |
| **Note Detail** | Full note with link, tags, folder badges, pin/edit/delete |
| **Add Note** | Paste or type content with live smart-tag preview |
| **Search** | Global search across all notes |
| **Edit Note** | Edit title, content and color |
| **Share Received** | Shown when sharing into the app (auto-add or pick folders) |
| **Settings** | Theme, stats, JSON/Markdown export, clear data |

## 🧠 How Smart Organization Works

```
User shares: "Best pizza place in Bangalore, loved this spot"
→ Detects location: Bangalore → adds to 📍 Bangalore folder
→ Detects topic: Food (pizza) → adds to 🍽️ Food folder
→ Tags: #bangalore #food #pizza #restaurant
```

Multiple overlapping folders are supported — a "Chennai food spot" note appears in both **Chennai** and **Food** folders.

## 🛠 Tech Stack

- **React Native + Expo SDK 55**
- **React Navigation v7** (Bottom Tabs + Native Stack)
- **Zustand** for state management
- **AsyncStorage** for persistence
- **TypeScript** throughout

## 🚀 Getting Started

### Prerequisites

- **Node.js >= 20.19.4** (required by React Native 0.83 and Metro; `.nvmrc` pins 22)
  - Download from https://nodejs.org/en/download
  - Or use [nvm](https://github.com/nvm-sh/nvm): `nvm install` (reads `.nvmrc`)
  - `npm install` runs a `preinstall` check and fails with a clear message on older Node versions.
- For running on a device/emulator: Android Studio (Android SDK + JDK 17) or Xcode (iOS, macOS only).
  [Expo Go](https://expo.dev/go) is **not** enough for the share-sheet integration (see below) — use a development build.

### Install & Run

```bash
npm install
npx expo start          # Metro dev server; press a / i / w for Android / iOS / web
npm run android         # build + run a dev build on an Android emulator/device (expo run:android)
npm run ios             # same for iOS (macOS only)
```

### Scripts

| Command | What it does |
|---|---|
| `npm test` | Jest unit tests (smart organizer, Open Graph parsing, note store, deep links, dates) |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint with `eslint-config-expo` |
| `npm run validate` | typecheck + lint + tests (what CI runs) |

CI (`.github/workflows/ci.yml`) additionally runs `npx expo export --platform android` to verify the JS bundle builds.

### Environment variables

None. The app has no backend and needs no secrets, so there is no `.env` / `.env.example`.
The only network access is a best-effort fetch of Open Graph metadata (page title/description) for shared links.

### Build Android APK

```bash
npx expo prebuild --platform android   # note: regenerates android/ — see below
cd android
./gradlew assembleDebug
# APK at: android/app/build/outputs/apk/debug/app-debug.apk
```

Or with EAS (requires an Expo account; not needed for local builds): `eas build -p android --profile preview`.

> **Release signing:** `android/app/build.gradle` currently signs release builds with the **debug keystore**.
> Create your own upload keystore (or use EAS-managed credentials) before publishing to the Play Store.

### How sharing works (Android)

The `android/` folder is committed and contains native code that `expo prebuild` would otherwise not generate:

- `MainActivity` handles **"Forward – Pick Folder"** (`ACTION_SEND` → `forward://share?text=…&mode=picker`).
- `ShareActivity` is a no-UI trampoline for **"Forward – Auto Add"** (`mode=auto`).
- Both end up in `ShareReceivedScreen` via the `forward://share` deep link (parsed by `src/utils/deepLink.ts`).

Running `expo prebuild --clean` would overwrite `ShareActivity.kt` and the manifest, so avoid `--clean` or re-apply those files.
iOS has no share extension yet (see Roadmap).

## 🗺 Roadmap / known gaps

- iOS share extension (only the `forward://` URL scheme exists on iOS today).
- Keyword-based topic detection is English-only and heuristic; see `src/utils/smartOrganizer.ts`.
- Dependencies are a few patch releases behind Expo SDK 55 recommendations (`npx expo install --check`) and `npm audit` reports advisories, mostly in Expo build tooling.
- Release builds are signed with the debug keystore (see above).

## 📁 Project Structure

```
src/
  types/        # TypeScript interfaces
  constants/    # Colors, theme
  utils/        # Smart organizer, Open Graph fetch, deep-link parsing, date utils
  __tests__/    # Jest unit tests
  store/        # Zustand store with AsyncStorage
  screens/      # All screens (Home, Folders, FolderDetail, NoteDetail, AddNote, EditNote, Search, Settings, ShareReceived)
  components/   # NoteCard, FolderCard, FolderPicker, EmptyState, SearchBar
  navigation/   # Tab + Stack navigators
```
