# Security design

Forward keeps everything on the device, encrypted. There is no server, no account and no
telemetry, so the main questions are how data is protected at rest, while the app is in use,
and when it leaves the device because you exported or shared it.

## Key hierarchy

```
passcode (6-digit PIN or password)  ─┐
                                      ├─► SQLCipher PBKDF2-HMAC-SHA512 (256,000 rounds)
pepper: 32 random bytes             ─┘        │
  in Keychain / Android Keystore              ▼
  (this device only, never backed up)     keyring.db  ──contains──►  vault key (32 random bytes)
                                                                          │
Face ID / fingerprint (optional) ──► Keychain/Keystore item               │
  bound to current biometrics ──────────────── copy of vault key ─────────┤
                                                                          ▼
                                             vault.db: SQLCipher, raw 256-bit key
                                             (AES-256-CBC + HMAC-SHA512 per page)
```

- **Vault database** (`vault.db`): all items, folders, file contents (memes, PDFs, videos as
  encrypted BLOBs), secrets and settings. It uses SQLCipher with a random 256-bit key, plus
  `secure_delete` and WAL.
- **Keyring** (`keyring.db`): a tiny SQLCipher database holding the vault key. Its passphrase
  is `hex(NFKC(passcode)) : hex(pepper)`, run through SQLCipher's PBKDF2. Every page is
  authenticated, so a wrong passcode fails cleanly. Changing the passcode writes a new keyring
  atomically; the vault itself is never re-encrypted.
- **Pepper**: 32 random bytes in secure storage (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`). Without
  it, a copied keyring cannot be brute-forced offline, even when the passcode is a short PIN.
- **Biometric unlock**: an extra copy of the vault key in the Keychain (`.biometryCurrentSet`)
  or in an Android Keystore key that requires user authentication. If the enrolled biometrics
  change, the OS invalidates that copy and the passcode is required again.
- **SQLCipher check**: the app refuses to create or open a vault unless `PRAGMA
  cipher_version` reports SQLCipher. Data is never written to a plain SQLite database, for
  example in Expo Go.

## In use

- **Locking.** The vault auto-locks after 0 s to 15 min in the background (default 1 min).
  Locking closes the database, zeroes the in-memory key, clears decrypted image caches and
  temporary files, and wipes any secret still on the clipboard.
- **Wrong passcodes.** Five tries, then waits of 30 s, 1 min, 5 min, 15 min and 1 h. The
  counter lives in secure storage, so restarting the app doesn't reset it.
- **Secrets.** Card numbers, CVVs, PINs, passwords and secure notes live in a separate
  column. They are loaded only when you open the item and confirm with Face ID, fingerprint or
  the device passcode, or with the Forward passcode on phones without a screen lock. Search
  never touches them.
- **Screens.** Screenshots and screen recording are blocked by default, and always on wallet
  and secret screens. iOS blurs the app-switcher snapshot; Android's `FLAG_SECURE` blanks
  Recents.
- **Clipboard.** Copied secrets are cleared after 45 s by default (configurable).
- **Imported files.** Shared or picked files are read into the encrypted database. The
  temporary plaintext copies made by the share extension or pickers are then deleted, but only
  inside the app's cache or App Group container, never your original files.

## Leaving the device

- **Backups** are a full SQLCipher copy (`sqlcipher_export`) encrypted with a separate backup
  password (PBKDF2-HMAC-SHA512, 256k rounds). Restoring merges into the current vault without
  duplicates.
- **OS backups.** Android `allowBackup` is off. iOS device backups may contain `vault.db` and
  `keyring.db`, but they can't be opened without the device-bound pepper. A vault restored
  this way onto a new phone is detected as "belongs to another phone"; move vaults with a
  Forward backup instead.
- **Link previews** (on by default, can be turned off): when you forward a link, Forward
  fetches the title and thumbnail from that site or its public oEmbed endpoint (YouTube, X).
  That site learns that someone fetched the link, just as when you open it.
- **Sharing out / opening files** decrypts the file to a temporary file in the app cache for
  the share sheet or video player. It is deleted when you're done and again on lock.

## Limitations (what this doesn't protect against)

- A device that is **compromised while the vault is unlocked** (malware with root or
  jailbreak, a debugger) can read memory, including decrypted data held by JavaScript, which
  cannot be reliably wiped.
- With root access and the pepper extracted from secure hardware, a **6-digit PIN** can be
  brute-forced. Choose a password if that's in your threat model.
- **Forgetting the passcode** without biometrics or a backup means the data is gone. That is
  the cost of no recovery back door.
- Data handed to the system share sheet, or opened in another app, is then that app's
  responsibility.

## Reporting a vulnerability

Please open a private security advisory on this GitHub repository rather than a public issue.
