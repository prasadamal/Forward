# Forward

**Forward anything. Find it sorted. Keep it safe.**

Forward is an iOS and Android app you share things *into* — from YouTube, Instagram, X,
WhatsApp, Photos, Files, any browser — and it files them for you, on your phone, inside an
encrypted vault. The same vault holds the important stuff too: debit and credit cards,
passwords and secret notes. Plus the silly memes.

> You find a Bangalore food vlog on YouTube, a spot to visit on Instagram and an app for
> Bangalore on X. Share each one to Forward. All three land in **Bangalore** — as
> `Bangalore › Food`, `Bangalore › Places to Visit` and `Bangalore › Apps & Tech` — no matter
> which app they came from.
>
> Instagram often hides captions from other apps. When Forward can't read a post, it says so
> and asks for a word or two ("Bangalore café") to file it.

## What it does

- **Share from any app.** Links, text, images (GIFs included), videos and files arrive through
  the system share sheet (an iOS Share Extension, Android share intents). Up to 10 images at
  once.
- **Sorted for you, offline.** An on-device classifier recognises places and 13 topics (Food,
  Places to Visit, Apps & Tech, Events, Shopping, Movies & Music, Memes…). It knows about 280
  cities, states and countries, plus 300 neighbourhoods, landmarks and treks that point to
  their place: Koramangala → Bangalore, Hampta Pass → Manali. It reads titles, captions,
  hashtags (`#bangalorefoodie`), URL slugs (`zomato.com/bangalore/…`) and known sites, and
  matches whole words only. "Real Madrid", "Mysore Pak" and "Mumbai-style" don't count as
  places, and "Kolkata biryani in Bangalore" goes to Bangalore. No AI service and no API
  keys.
- **Folders as deep as you like.** Folders nest without limit, items can live in several
  folders, and any folder can **auto-collect** items that mention its keywords. Smart folders
  keep working after you rename or move them.
- **A wallet.** Cards (Visa, Mastercard, RuPay, Amex…, with Luhn and expiry checks), logins
  with a password generator, and secure notes. Secrets are only loaded when you open them and
  confirm it's you, and copying one clears the clipboard after 45 seconds.
- **Locked by default.** 6-digit PIN or password, Face ID or fingerprint, auto-lock,
  screenshot blocking and a blurred app-switcher preview.
- **Yours, and only yours.** No account, no server, no analytics. Encrypted backups are a
  single file you keep wherever you like.

## Privacy, security and "permission from anyone"

Everything is stored **encrypted on the device** (SQLCipher, AES-256). The vault key is
protected by your passcode plus a device-bound secret held in the iOS Keychain or Android
Keystore. See [SECURITY.md](SECURITY.md) for the full design and its limits.

Because Forward has no servers, nothing you save is collected, uploaded or seen by anyone
else. Some practical consequences, which are not legal advice:

- **No licences to store data.** Forward isn't a payment wallet. It never processes payments
  or sees card data, so there is nothing to register with banks, card networks or the RBI. It
  is a private vault on your own phone.
- **No permission prompts for your data.** No contacts, location, camera, microphone or
  storage access. Photos and files are chosen in the system pickers, which hand over only what
  you pick. (iOS asks once before Face ID is first used, if you turn it on.)
- **Barely any network.** Internet access is used only for optional link previews: Forward
  asks the shared site itself, its image server, or that platform's public oEmbed endpoint
  (YouTube, X) for a title and thumbnail. Turn previews off in Settings to stay fully offline.
- **Store listings.** Nothing is sent to the developer or to any analytics or ad SDK, which
  is what the App Store privacy label and Google Play's Data safety form ask about. Both
  stores require a privacy policy: [PRIVACY.md](PRIVACY.md) is ready to host.
- **Encryption export compliance.** Forward contains encryption (SQLCipher), so App Store
  Connect asks export-compliance questions when you upload a build. For consumer software
  using standard encryption this is a self-classification, not a licence or an approval.
  Apple's guide "Complying with encryption export regulations" walks through it; confirm the
  answers for your situation before you ship.

## Running it

Forward uses native modules (SQLCipher, a share extension, Keychain/Keystore, biometrics), so
it runs in a **development build, not Expo Go**. Native projects are generated from
`app.json` by `expo prebuild` (Continuous Native Generation), so `ios/` and `android/` are not
committed.

**Requirements:** Node ≥ 20.19.4 (`nvm install` reads `.nvmrc`). Android Studio for Android;
Xcode on macOS for iOS.

```bash
npm install            # also applies patches/ via patch-package
npx expo run:android   # build, install and start on an emulator/device
npx expo run:ios       # macOS only
```

Or build in the cloud with [EAS](https://docs.expo.dev/build/introduction/):

```bash
npx eas build --profile development --platform android   # or ios
npx eas build --profile production --platform all
```

### Releasing

Checked against the store rules in force in October 2026:

- **Platform requirements are already met.** Expo SDK 55 targets Android 16 (API 36), which
  Google Play has required since 31 August 2026. EAS builds SDK 55 apps with Xcode 26.2, which
  meets Apple's iOS 26 SDK rule.
- **App ID.** `app.json` uses `com.prasadamal.forward` for both stores (v1's `com.forward.app`
  was too generic to be sure of on Google Play). If you choose a studio name, change it before
  the first upload, because it can never change afterwards.
- **iOS share extension.** It needs the App Group `group.<bundle id>` on the app and on the
  `ForwardShare` target. EAS sets this up for you. When building locally, enable App Groups for
  both targets in Xcode and pick your team. In the share sheet, Forward appears as
  **Forward**; the first time, users may need to tap **More** to add it to their favourites.
- **Privacy policy.** Host [PRIVACY.md](PRIVACY.md) (for example at `/privacy/forward`) and
  fill in its three placeholders. Then put the URL in both store listings and set
  `"extra": { "privacyPolicyUrl": "…" }` in `app.json`, so Settings › Privacy & security links
  to it. Both stores also need a support URL or email.
- **Store forms.**
  - Google Play Data safety: no data collected or shared.
  - App Store privacy label: Data Not Collected.
  - Answer the content rating questionnaire and Apple's encryption export questions (see above).
- **Testing.** A personal Google Play account created after 13 November 2023 must run a closed
  test with at least 12 testers opted in for 14 days in a row before production unlocks. Use
  TestFlight on iOS.
- **Listing.** "Forward" is a common word, hard to rank or trademark. Consider a store title
  such as "Forward: Save Reels & Links", and use screenshots from a real build.

## Development

```bash
npm test           # 179 unit tests (classifier, URL tools, folder tree, repository on sql.js,
                   # keyring, backups, share parsing, ingestion pipeline, wallet utils)
npm run typecheck  # TypeScript, strict
```

```
App.tsx                 Lock-gated shell: onboarding → lock screen → app; share intake; auto-lock
plugins/                Local config plugin (share extension display name)
patches/                expo-share-intent: keep the sending app's title & captions on Android
src/
  types/                Data model: items, folders, settings, incoming shares
  organizer/            On-device classifier (places, topics) and auto-filing planner
  ingest/               Share parsing, drafts, link previews (oEmbed/OpenGraph), media import
  folders/              Unlimited-depth folder tree helpers
  db/                   SQLite schema & migrations, repository, encrypted backups, v1 import
  security/             Keyring, SQLCipher/Keychain bindings, biometrics, auto-lock, clipboard
  store/                Zustand stores (vault, prefs), selectors, in-memory image cache
  share/                Share-sheet intake hook
  wallet/               Card and password utilities
  screens/, ui/, theme/ Screens, components and design tokens
```

Upgrading from Forward 1.x? On first launch the old notes (stored as plain JSON) move into the
encrypted vault, and the plaintext copy is deleted. This only works for an install that has the
same app ID. 1.x used `com.forward.app`, so a test phone with 1.x data needs a 2.x build with
that ID, or the notes re-saved by hand.

## Ideas for next steps

- City lists and a map of saved places
- Shareable collections ("Bangalore cafés") as a link or image
- Resurfacing ("6 saved places in Goa") from the folders you open, without asking for location
- Read the text inside memes and screenshots with on-device OCR (Apple Vision, bundled ML Kit)
  so images sort themselves too
- One-time codes (TOTP) for logins
- A quick-save share sheet that files items without opening the app
- Optional end-to-end-encrypted sync between your own devices
- Import from Google Keep, Pocket export files and browser bookmarks; home-screen widgets
