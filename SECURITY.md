# Security policy

## Threat model
Protects chat content against: network eavesdropping and third-party tracking (nothing is sent), casual access to a shared device (encryption at rest, auto-lock, blur), cross-site scripting (CSP and output escaping), and offline passcode guessing (600,000-round PBKDF2 plus AES-GCM authentication).

## Controls
- Content-Security-Policy: `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'`
- All user-derived text is escaped before insertion into HTML.
- Encryption: PBKDF2-SHA256 -> AES-256-GCM, random 16-byte salt and fresh 12-byte IV per save. The iteration count is stored with the profile so it can be raised later.
- Brute-force friction: lockout after 5 failures, delay doubles up to 5 minutes.
- Session hygiene: key and decrypted chats exist only in memory and are dropped on sign out or after 5 idle minutes.
- Input limits: `.txt` files under 5 MB, chat name limited to 60 characters.

## Known limits
- Malware or a malicious browser extension on the device can read memory. A weak passcode weakens encryption. Forgotten passcodes cannot be recovered.
- localStorage is per browser and origin. Clearing site data deletes the profile.

## Reporting
Open a GitHub issue titled "security" with reproduction steps.
