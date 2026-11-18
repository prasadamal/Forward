# Privacy forms: the answers

These match what the code does. Re-check them if a network call, SDK or permission is ever added.

## Google Play: Data safety

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | Not applicable (nothing is collected) |
| Do you provide a way for users to request that their data is deleted? | Not applicable (no account, no server). Data is deleted in the app: Settings › Erase vault |

Link previews fetch a public page's title and thumbnail straight from that site. Nothing is
sent to the developer, so this is not "collection" under Play's definition.

Other Play declarations:

- **Ads:** No ads.
- **App access:** All functionality is available without special access (no login). In the
  review notes, say: "Create any 6-digit PIN on first launch."
- **Target audience:** 18 and over is the simplest choice (the app stores cards and
  passwords); 13+ is also accurate.
- **Financial features:** None. Forward stores card details the user types in. It does not
  process payments, lend, or move money.
- **Permissions:** Internet, biometrics, vibrate only. No photo, media, camera, microphone,
  location or contacts permission (they are blocked in `app.json`).

## App Store: App Privacy

- **Data collection:** "Data Not Collected".
- **Tracking:** No.
- **Privacy policy URL:** `https://forward-privacy.onrender.com/privacy/` (after the
  "Publish privacy policy" workflow has run).

## App Store: export compliance

Forward includes SQLCipher (AES-256). When App Store Connect asks:

- "Does your app use encryption?" **Yes.**
- It uses standard, published algorithms (AES, PBKDF2, HMAC-SHA512) and no proprietary ones.

Follow Apple's "Complying with encryption export regulations" for the remaining questions and
confirm the answers for your own situation. This is a self-classification, not legal advice.

## Review notes (both stores)

```
Forward has no account and no server. On first launch, choose any 6-digit PIN
(for example 271828). To test saving: open Safari or Chrome, tap Share, choose
Forward (on iPhone it may be under "More" the first time). The item appears
in the app, sorted into a folder.
```
