# Architecture notes

## Goals
1. Nothing about a conversation may leave the device.
2. The analysis must be explainable (every score has reasons).
3. The core must be testable without a browser.

## Layers
| Layer | File | Depends on | Responsibility |
|---|---|---|---|
| Core | `js/engine.js` | nothing | Parse exports, resolve dates, score messages, find decisions and unkept promises |
| Infrastructure | `js/crypto.js`, `js/vault.js` | Web Crypto, localStorage | Encrypt and persist, lockout counters |
| State | `js/state.js` | nothing | One in-memory object, never persisted unencrypted |
| Presentation | `js/ui.js` | core, state | Pure render functions returning escaped HTML |
| Controller | `js/main.js` | all of the above | Routing, event delegation, auth flow, idle lock |
| Offline | `sw.js` | cache API | Cache-first app shell |

## Decisions
- **Rules over an LLM for the default path.** Instant, deterministic, explainable, no model download. An optional on-device LLM is on the roadmap.
- **No framework, no build step.** Smaller attack surface, nothing to compromise in a supply chain, deployable to any static host.
- **Encrypt one blob.** Settings and chats are sealed together with AES-GCM and a fresh IV on every save.
- **Dynamic styles via CSSOM.** Bar widths and avatar colors are applied from `data-*` attributes so the CSP can forbid inline styles.
- **Reference time = last message.** "Passed while you were away" is judged against the final message in the chat, which keeps results reproducible.

## Data flow
Export text -> `parse` -> (optional time-away filter) -> `analyze` -> grouped view models -> escaped HTML. Only the raw text is encrypted and stored; analysis is recomputed on demand.
