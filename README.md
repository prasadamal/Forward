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
- **Dark Theme** — Beautiful dark-first UI with purple accent

## 📱 Screens

| Screen | Description |
|---|---|
| **Forward (Home)** | All notes with platform filter chips (YouTube, Instagram, Twitter…) |
| **Folders** | Grid of auto-created smart folders + create custom folders |
| **Folder Detail** | Notes scoped to a specific folder |
| **Note Detail** | Full note with link, tags, folder badges, pin/edit/delete |
| **Add Note** | Paste or type content with live smart-tag preview |
| **Search** | Global search across all notes |
| **Settings** | Stats, how-to tips, clear data |

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

- **Node.js >= 20.19.4** (required by React Native 0.83 and Metro)
  - Download from https://nodejs.org/en/download
  - Or use [nvm](https://github.com/nvm-sh/nvm): `nvm install` (reads `.nvmrc`)

### Install & Run

```bash
npm install
npx expo start
```

### Build Android APK

```bash
npx expo prebuild --platform android
cd android
./gradlew assembleDebug
# APK at: android/app/build/outputs/apk/debug/app-debug.apk
```

## 📁 Project Structure

```
src/
  types/        # TypeScript interfaces
  constants/    # Colors, theme
  utils/        # Smart organizer, date utils
  store/        # Zustand store with AsyncStorage
  screens/      # All 7 screens
  components/   # NoteCard, FolderCard, EmptyState, SearchBar
  navigation/   # Tab + Stack navigators
```
