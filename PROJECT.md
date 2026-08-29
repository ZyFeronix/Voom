# Project: Voom! /settings/design & /messages Modernization

## Architecture
- **Framework & Runtime**: SvelteKit 5 (Svelte 5 Runes `$state`, `$derived`, `$props`, `$effect`) running on Node.js.
- **Database & Storage**: Universal async adapter (`frontend/src/lib/server/db.js`) with `@libsql/client` (WAL mode, prepared statements, async promises).
- **Real-Time Layer**: Socket.IO (`frontend/src/lib/server/socket.js`) with in-memory presence map (`Map<userId, Set<socketId>>`), room management (`user_${userId}`, `conv_${convId}`), and event dispatching (`typing`, `zumbido`, `messages_read`, `presence:update`). WebRTC calls via `lib/rtc.js`.
- **Design System**: Handcrafted Pure CSS Glassmorphism 2.0 + Neo-Aero token system (`frontend/src/routes/layout.css`). GPU layer promotion (`translateZ(0)`), CSS containment (`contain: layout style`), signature `--ease-spring` overshoot curve (`cubic-bezier(0.34, 1.56, 0.64, 1)`), volumetric collapse shields (`44px` / `28px`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---|---|---|---|
| 1 | Global Glass Border Tokens | Define `--glass-border-t` across all theme blocks in `layout.css` (`:root`, light, dark, midnight) | M1 | Survey 2 & 3 |
| 2 | Live WYSIWYG Design Studio | Verify `/settings/design` and `AppPreviewStage.svelte` parities (accent, wallpaper modes cover/tile/fit, card opacity, border radius, aeroGloss specular shine) | M1 | Survey 1, R1, R4 |
| 3 | Debounced Cloud Autosave & Navigation Safety | Bidirectional syncing with status chips (`Guardando…`, `Sincronizado`, `Autoguardado en nube`) and `beforeNavigate` flush safety | M1 | Survey 1, R1, R5 |
| 4 | Conversations Sidebar Neo-Aero Overhaul | Liquid crystal surfaces, unread badge contrast, search filtering, and 44px/28px volumetric collapse shields on avatars and action buttons | M2 | Survey 2, R2 |
| 5 | Chat Pane & Message Bubbles Redesign | Liquid crystal message bubbles (own vs peer), `--glass-border-t` specular edge, accent neon glow shadows, read receipts, peer typing indicator | M2 | Survey 2, R2 |
| 6 | Chat Composer & Discardable Media Previews | Rich image and video thumbnail preview with discard button before sending, emoji/MSN emoticon integration, 44px/28px button shields | M3 | Survey 2, R3 |
| 7 | Voice Recorder Spring Microinteractions | `--ease-spring` overshoot physics on record/cancel/send buttons and pulse waveforms in `VoiceRecorder.svelte` | M3 | Survey 2, R3 |
| 8 | Mobile Responsive Sliding Navigation | Smooth animated sliding transition for viewports <= 768px between sidebar and chat pane with accessible back navigation | M3 | Survey 2, R3 |
| 9 | Full Test, Lint & Build Verification | 100% Vitest test pass (12+ suites / 152+ tests), 0 ESLint errors (`npm run lint`), clean production build (`npm run build`), and Forensic Integrity Audit | M4 | Survey 3, R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | Design System & Studio Parity | `layout.css` tokens, `/settings/design`, `AppPreviewStage.svelte`, `appearanceStore.svelte.js` | none | DONE |
| 2 | /messages Glassmorphism 2.0 UI Overhaul | `ConversationsSidebar.svelte`, `ChatPane.svelte`, `MessageBubble.svelte`, volumetric shields | M1 | IN_PROGRESS |
| 3 | Messages Interactivity, Voice & Mobile | `ChatComposer.svelte`, `VoiceRecorder.svelte`, media discard, <=768px sliding responsive layout | M2 | PLANNED |
| 4 | Quality Gate, Tests, Lint & Build | Vitest test suites, ESLint/Prettier, SvelteKit production build, Forensic Audit | M3 | PLANNED |

## Interface Contracts
### `appearanceStore` ↔ `AppPreviewStage` & `layout.css`
- Attributes: `data-theme`, `data-border-radius`, `data-card-glass`, `data-wallpaper-mode`, `data-density`.
- Variables: `--accent-blue-base`, `--accent-blue-light`, `--accent-blue-dark`, `--card-opacity`, `--gloss-strength`, `--app-wallpaper`, `--wallpaper-dim`, `--glass-border-t`.

### `ConversationsSidebar` ↔ `ChatPane`
- Props / Events: `activeConversationId`, `conversations`, `onSelectConversation(id)`, `onBackToList()`.
- Mobile state: Smooth slide transform with `aria-hidden` management and mobile back button.

### `ChatComposer` ↔ `VoiceRecorder` & Media Attachments
- Attachment state: `{ type: 'image' | 'video' | 'audio', url: string, file: File, thumbnail?: string }`.
- Actions: `onSend({ content, attachments, replyToId })`, `onDiscardAttachment(index)`.
- Audio callback: `onAudioRecorded({ blob, duration })`.

## Code Layout
- `frontend/src/routes/layout.css`: Handcrafted CSS tokens, Glassmorphism, animations, theme modifiers.
- `frontend/src/routes/settings/design/+page.svelte`: Dual-hub design studio (`Profile` & `App`).
- `frontend/src/lib/components/settings/design/`: `AppPreviewStage.svelte`, `SurfacePanel.svelte`, `WallpaperPicker.svelte`, `ProfileCustomizer.svelte`.
- `frontend/src/routes/messages/+page.svelte`: Core messages container and responsive layout.
- `frontend/src/routes/messages/ConversationsSidebar.svelte`: Conversation list, search, unread badges.
- `frontend/src/routes/messages/ChatPane.svelte`: Active conversation header, message feed, typing state.
- `frontend/src/routes/messages/MessageBubble.svelte`: Liquid crystal message bubbles, status indicators, media.
- `frontend/src/routes/messages/ChatComposer.svelte`: Input field, attachment preview with discard, voice/emoji toggles.
- `frontend/src/routes/messages/VoiceRecorder.svelte`: Voice recorder with waveform and `--ease-spring` physics.
