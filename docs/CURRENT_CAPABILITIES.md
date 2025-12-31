Hound Master Capability List (current state)

1) Playback Engine

Can
- Load local audio files via custom protocol (houndfile://).
- Play / Pause / Next / Previous.
- Seek with slider.
- Crossfade between tracks (if enabled in settings state).
- Loudness normalization per track (analyze + gain).
- Queue playback (plays queued items first).
- Resume playback from last session if enabled (stored locally).

Cannot
- Stream from network sources.
- Handle remote URLs.
- Persist queue across app restarts.
- Play when Electron protocol is not registered.

Key files
- apps/hound-listener/ui/src/App.jsx (playback controls, loadAndPlay, handleNext, handlePrev, handleStop)
- apps/hound-listener/electron/main.cjs (protocol registration)
- apps/hound-listener/electron/preload.cjs (file open + loudness IPC)
- apps/hound-listener/ui/index.html (CSP allows houndfile:)

2) Import and Library

Can
- Import local audio files (mp3, wav, m4a, flac, aac, alac, ogg, opus).
- Maintain a library list in memory.
- Clear library (resets tracks, stops playback).
- Display library as a table with Title/Artist/Album/Duration.
- Hover-only action icons.

Cannot
- Store library to disk (beyond localStorage state).
- Scan folders or watch directories.
- Batch import beyond file picker.

Key files
- apps/hound-listener/ui/src/App.jsx (import, track list, library UI)
- apps/hound-listener/electron/main.cjs (file dialog IPC)

3) Rotation and Save Core

Track state fields
- saved
- rotation
- rotationOverride (none | force_on | force_off)
- rotationScore (0–100)
- playCountTotal
- lastPositiveListenAt, lastNegativeListenAt
- playHistory (last 20 plays)

Can
- Save/Unsave tracks manually.
- Manual rotation override: force on/off.
- Auto-rotation based on score + thresholds.
- Block auto-rotation on first listen.
- Decay rotation on early skips.
- Rotation popover with Auto / Force On / Force Off.

Cannot
- Persist Save/Rotation beyond local storage (no disk or db).
- Apply long-term ignore decay.
- Use rotation in autoplay selection (no orbit weighting).
- Show rotation score (hidden by design).

Key files
- apps/hound-listener/ui/src/App.jsx (rotation logic, save, telemetry, UI)

4) Telemetry

Collected per play
- play_start_time
- play_end_time
- play_duration_seconds
- track_total_duration
- percent_listened
- skipped_early
- replayed_same_session
- completed_play
- manual_skip / auto_advance
- timestamp

Can
- Track telemetry in memory (playHistory).
- Use telemetry for rotation scoring.

Cannot
- Export telemetry.
- Display telemetry or analytics UI.
- Persist telemetry across restarts.

Key files
- apps/hound-listener/ui/src/App.jsx (telemetry capture)

5) Orbits (Rotation, Recent, Discovery)

Can
- Compute Recent (based on latest play history).
- Compute Discovery (tracks never played).
- Show rows in Home UI.

Cannot
- Enforce orbit boundaries in autoplay.
- Track recent expiration windows or appearance caps.
- Prevent overlap across orbits.

Key files
- apps/hound-listener/ui/src/App.jsx (home list computation only)

6) Autoplay and Next Track Selection

Can
- If queue exists, plays next queued track.
- If queue empty, follows current context, shuffle, repeat rules.
- Stops playback at end if no next item.

Cannot
- Weighted orbit selection.
- Rotation pool priority.
- Discovery injection.

Key files
- apps/hound-listener/ui/src/App.jsx (handleNext)

7) UI Shell

Top Bar
- Can: menu toggle, page title, settings shortcut.
- Cannot: back button in UI (keyboard only).

Sidebar
- Can: icon rail closed (72px), full open (260px).
- Can: nav shortcuts Ctrl+1..5, Ctrl+B.
- Cannot: badges or notifications.

Bottom Bar (mini player)
- Always visible.
- Shows mini art, title/artist.
- Play/Pause, Seek, Save, Queue, Volume.
- Clicking art or text opens Now Playing.
- Cannot: hide for full screen.

Key files
- apps/hound-listener/ui/src/App.jsx (styles and layout)

8) Home View

Can
- Continue Listening (recent tracks).
- In Rotation (rotation tracks).
- Recently Heard (recent tracks).
- Something New (unplayed tracks).
- Tile click plays track.

Cannot
- Explain why tracks appear.
- See all links.

9) Library View

Can
- Hover-only action icons.
- Save and Rotation icon (Rotation visible only if in rotation or forced).
- Right-click context menu.

Cannot
- Sort or filter.
- Multi-select.

10) Search View

Can
- Auto-focus input on entry.
- Tracks / Artists / Albums sections.
- Track click plays.
- Artist/Album click opens subviews.

Cannot
- Show Saved or Rotation badges.
- Filter by Saved or Rotation.

11) Now Playing

Can
- Big art, title, artist–album line.
- Transport controls.
- Seek bar.
- Save + Rotation + Queue icons.
- Rotation popover.

Cannot
- Lyrics or credits.
- Expanded back side.

12) Queue View

Can
- Clear queue.
- Drag reorder.
- Click queued track to play.

Cannot
- Persist queue.
- Show upcoming autoplay tracks.

13) Context Menu

Can
- Custom right-click menu on tracks.
- Play / Add to Queue / Save or Unsave / Rotation submenu.

Cannot
- Remove from library.
- Not interested.

14) Settings

Can
- Account/Storage/Advanced sections.
- Show Advanced toggle (currently only shows a placeholder line).

Cannot
- Audio device selection.
- Import path management.
- Rotation score debug display (hidden).

15) Performance and Animations

Can
- Static UI (no marquee, no loading pulse).
- Removed animation loops to reduce lag.

Cannot
- Smooth marquee text (intentionally disabled).

16) Protocols and Platform

Protocols
- houndfile:// (local audio)
- http://localhost:5173 and ws://localhost:5173 (dev server)
- https://rbhlvbutqzgqogsrqwet.supabase.co (gate, disabled)

Cannot
- Play audio without Electron scheme registration.
