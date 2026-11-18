# Release checklist

What is already done in the repository, and what only the owner can do. Work top to bottom.

## Done in the repository

- [x] App ID `com.prasadamal.forward` on both platforms; Expo SDK 55 (Android API 36, Xcode 26).
- [x] CI on every push and pull request: typecheck, 179+ unit tests, Android and iOS bundles,
      native project generation including the iOS share extension.
- [x] Privacy policy text (`PRIVACY.md`) and a workflow that publishes it as a web page.
- [x] In-app link to the policy (Settings › Privacy & security).
- [x] Store listing copy (`LISTING.md`) and privacy-form answers (`DATA_SAFETY.md`).
- [x] Android backups off, media permissions blocked, screenshots blocked while locked.

## Owner steps

1. **Accounts.** Google Play Console ($25 once), Apple Developer ($99 a year), expo.dev (free).
2. **Decide the app ID now.** It can never change after the first upload. To use a studio
   name instead, change `bundleIdentifier` and `package` in `app.json`.
3. **Privacy policy.** Fill the three `[bracketed]` blanks in `PRIVACY.md`. In GitHub:
   Settings → Pages → Source: GitHub Actions. Push to `main`; the page appears at
   `https://forward-privacy.onrender.com/privacy/`. (Pages on a private repository needs a
   paid GitHub plan; otherwise make the repository public or host the page elsewhere and
   update `extra.privacyPolicyUrl` in `app.json`.)
4. **Link the project to EAS.** `npx eas login`, then `npx eas init`.
5. **First builds.** `npx eas build --profile preview --platform android` for an APK to
   install directly; `npx eas build --profile production --platform ios` for TestFlight.
6. **Device test** (below). Fix anything that fails before going further.
7. **Google Play closed test.** Personal accounts created after 13 November 2023 need 12
   testers opted in for 14 days in a row before production access. Start this early.
8. **Listings.** Paste `LISTING.md`, upload real screenshots, complete the forms from
   `DATA_SAFETY.md`.
9. **Production builds and submit.** `npx eas build --profile production --platform all`,
   then `npx eas submit --profile production --platform android` (and `ios`).

## Device test (run on one Android phone and one iPhone)

These need real hardware; none of them can be checked in CI.

| # | Do | Expect |
| --- | --- | --- |
| 1 | Fresh install, set a 6-digit PIN, turn on biometrics | Lands on Home; next launch offers Face ID / fingerprint |
| 2 | Share a YouTube link from the YouTube app | Receipt shows the real title and a folder; Android returns to YouTube on Done |
| 3 | Share an Instagram reel | Receipt explains captions are hidden; adding "Bangalore café" files it |
| 4 | Share 10 photos at once from Photos / Gallery | 10 items saved, each with a thumbnail |
| 5 | Share a PDF from Files | Saved as a file; opens in another app from the item screen |
| 6 | Share while the app is locked | Unlock prompt first, then the receipt |
| 7 | iPhone: first share from Safari | "Forward" is in the share sheet (possibly under More) |
| 8 | Add a card and a login; reveal and copy a password | Asks for PIN / biometrics; clipboard is empty after 45 seconds |
| 9 | Background the app longer than the auto-lock time | Returns to the lock screen |
| 10 | Take a screenshot on a secret screen; open the app switcher | Screenshot blocked (Android) and preview blurred |
| 11 | Enter a wrong PIN 5 times | 30-second lockout, growing with more failures |
| 12 | Export a backup, erase the vault, set up again, import the backup | All items and folders return |
| 13 | Force-quit while a file is open in another app, relaunch | No decrypted copies left behind (cache is cleared at start) |
| 14 | Airplane mode: share a link | Saved with a placeholder title; details fill in when back online |
| 15 | Change the passcode; relaunch | Old passcode refused, new one works |
